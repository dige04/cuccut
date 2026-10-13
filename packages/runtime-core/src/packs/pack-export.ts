import crypto, { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  PACK_DEFAULT_VERSION,
  PACK_DIRS,
  PACK_DOC_FILE_PATTERN,
  PACK_FORMAT,
  PACK_LIMITS,
  PACK_MANIFEST_FILE,
  PACK_SCHEMA_VERSION,
  PACK_STYLE_FILE,
  RpcError,
  packFileRole,
  slugPackId,
  type LibraryName,
  type PackExample,
  type PackExportParams,
  type PackExportResult,
  type PackFileEntry,
  type PackLibraryItem,
  type PackManifest,
} from '@cuccut/protocol';
import { parsePackManifest } from '@cuccut/protocol/schemas';
import { RcPacks, RcSkills, RcTemplates } from '@cuccut/protocol/messages/runtime-core';
import type { SkillCatalog } from '../skills/skill-catalog.ts';
import type { TemplateCatalog } from '../templates/template-catalog.ts';
import type { PackRegistry } from './pack-registry.ts';
import { checkStagedPack } from './pack-source.ts';

/**
 * Export (pack spec §6.4): writes a pack folder from the user's own templates, skills, library entries, quick actions and an installed pack's style guide with its
 * reference files, with the `files` index, so the folder can be sent as it is, pushed to GitHub, or served from any static host.
 *
 * - Templates are the user's own (`<home>/templates`), never built-in ones; skills are any but built-in ones. Their directories are copied without dot files (a skill's
 *   `.cuccut-skill.json` stays behind).
 * - Library entries are written as the library's own exchange files (`library.export`), so `library.import` takes them back; voices never travel.
 * - The target must be empty (dot files and root README / LICENSE files do not count) or an earlier export of the same id that holds nothing but what its `pack.json`
 *   names; those files are replaced. A `.git` folder and the documentation files stay, so an export can be pushed again; anything else in it (a `docs/` folder, notes)
 *   makes the export refuse, so nothing the export did not write is ever deleted.
 * - Everything is written into a dot folder inside the target first and checked the way a read checks a pack (`checkStagedPack`, index required); only then does it
 *   replace what was there. A failure leaves the target as it was.
 */

/** The library as export uses it. */
export interface PackExportLibrary {
  /** The entry's name and the extension its exchange file takes (`md`, `json`, or the media file's own). `not-found` when there is none. */
  exportInfo(library: Exclude<LibraryName, 'voices'>, id: string): { name: string; extension: string };
  /** Writes the entry as an exchange file at `target` (which must not exist). */
  exportTo(library: Exclude<LibraryName, 'voices'>, id: string, target: string): Promise<void>;
}

export interface PackExporterOptions {
  registry: PackRegistry;
  templates: TemplateCatalog;
  skills: SkillCatalog;
  library: PackExportLibrary;
  /** Runs the export in the installer's queue, so a pack folder is not read while it is being rewritten. */
  exclusive?: <T>(run: () => Promise<T>) => Promise<T>;
}

const STAGING_PREFIX = '.cuccut-export-';

export class PackExporter {
  readonly #o: PackExporterOptions;

  constructor(options: PackExporterOptions) {
    this.#o = options;
  }

  export(params: PackExportParams): Promise<PackExportResult> {
    return this.#o.exclusive ? this.#o.exclusive(() => this.#export(params)) : this.#export(params);
  }

  async #export(params: PackExportParams): Promise<PackExportResult> {
    const { registry, templates: templateCatalog, skills: skillCatalog, library } = this.#o;
    const dir = path.resolve(params.dir);
    await this.#checkTarget(dir, params.manifest.id);

    // What travels, checked before anything is written.
    const templateIds = unique(params.templates);
    const skillIds = unique(params.skills);
    const { templates: loadedTemplates } = await templateCatalog.scan();
    const templates = templateIds.map((id) => {
      const found = loadedTemplates.find((t) => t.manifest.id === id);
      if (!found) throw new RpcError('not-found', RcTemplates.templateNotFound({ id }), { code: 'TEMPLATE_NOT_FOUND', templateId: id });
      if (found.origin !== 'user') throw invalid(RcPacks.exportBuiltinTemplate({ id }).text, dir);
      return { id, dir: found.dir };
    });
    const { skills: loadedSkills } = await skillCatalog.scan();
    const skills = skillIds.map((id) => {
      const found = loadedSkills.find((s) => s.id === id);
      if (!found) throw new RpcError('not-found', RcSkills.skillNotFound({ id }), { code: 'SKILL_NOT_FOUND', skillId: id });
      if (found.scope !== 'user' || found.guide) throw invalid(RcPacks.exportBuiltinSkill({ id }).text, dir);
      return { id, dir: found.dir };
    });
    const seen = new Set<string>();
    const entries = params.library.filter((e) => !seen.has(`${e.library}:${e.id}`) && seen.add(`${e.library}:${e.id}`));
    const libraryInfo = entries.map((e) => ({ ...e, ...library.exportInfo(e.library, e.id) }));
    const stylePack = params.stylePack ? await registry.require(params.stylePack) : null;

    const created = !(await fsp.stat(dir).catch(() => null));
    const staging = path.join(dir, `${STAGING_PREFIX}${crypto.randomBytes(9).toString('base64url')}`);
    await fsp.mkdir(staging, { recursive: true });
    let done = false;
    try {
      // Limits are checked as files are written, so a library video too large for a pack stops the export early.
      let files = 1;
      let bytes = 0;
      const count = (copied: { files: number; bytes: number }) => {
        files += copied.files;
        bytes += copied.bytes;
        if (files > PACK_LIMITS.files || bytes > PACK_LIMITS.totalBytes) throw tooLarge(files, bytes, dir);
      };
      const one = async (file: string) => count({ files: 1, bytes: (await fsp.stat(file)).size });
      for (const t of templates) count(await copyDir(t.dir, path.join(staging, PACK_DIRS.templates, t.id)));
      for (const s of skills) count(await copyDir(s.dir, path.join(staging, PACK_DIRS.skills, s.id)));

      const libraryItems: PackLibraryItem[] = [];
      const taken = new Set<string>();
      await fsp.mkdir(path.join(staging, PACK_DIRS.library), { recursive: true });
      for (const item of libraryInfo) {
        const file = `${PACK_DIRS.library}/${uniqueFileName(item.name, item.extension, taken)}`;
        const target = path.join(staging, ...file.split('/'));
        await library.exportTo(item.library, item.id, target);
        await one(target);
        libraryItems.push({ file, name: item.name.slice(0, PACK_LIMITS.libraryName) });
      }

      let style = '';
      const examples: PackExample[] = [];
      if (stylePack) {
        const { manifest, record } = stylePack;
        if (manifest.style) {
          const from = path.join(stylePack.dir, ...manifest.style.split('/'));
          if (await isFile(from)) {
            await fsp.copyFile(from, path.join(staging, PACK_STYLE_FILE), fsp.constants.COPYFILE_EXCL);
            await one(from);
            style = PACK_STYLE_FILE;
          }
        }
        for (const example of record.examples) {
          const from = path.join(stylePack.dir, ...example.file.split('/'));
          if (!(await isFile(from))) continue;
          await copyInto(from, path.join(staging, ...example.file.split('/')));
          await one(from);
          let still: string | undefined;
          if (example.still) {
            const stillFrom = path.join(stylePack.dir, ...example.still.split('/'));
            if (await isFile(stillFrom)) {
              await copyInto(stillFrom, path.join(staging, ...example.still.split('/')));
              await one(stillFrom);
              still = example.still;
            }
          }
          examples.push({ file: example.file, kind: example.kind, title: example.title, note: example.note, ...(still ? { still } : {}) });
        }
      }
      if (!libraryItems.length) await fsp.rmdir(path.join(staging, PACK_DIRS.library)).catch(() => {});

      const m = params.manifest;
      const manifest: PackManifest = {
        format: PACK_FORMAT,
        schema: PACK_SCHEMA_VERSION,
        id: m.id,
        name: m.name.trim(),
        version: m.version?.trim() || PACK_DEFAULT_VERSION,
        description: m.description?.trim() ?? '',
        author: m.author?.trim() ?? '',
        license: m.license?.trim() ?? '',
        templates: templates.map((t) => t.id),
        skills: skills.map((s) => s.id),
        library: libraryItems,
        style,
        examples,
        quickActions: params.quickActions.map((a) => ({ label: a.label, text: a.text })),
        rules: [],
        review: '',
        files: await filesIndex(staging),
      };
      // The manifest is checked as a reader will check it, so a pack that can't be read back is never written.
      const parsed = parsePackManifest(manifest);
      if (!parsed.ok) throw invalid(parsed.issues[0] ?? '', dir, parsed.issues);
      await fsp.writeFile(path.join(staging, PACK_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
      const staged = await checkStagedPack(staging, { kind: 'local', path: dir }, { requireIndex: true });

      await replaceContents(dir, staging);
      done = true;
      return { dir, files: staged.files.length, bytes: staged.bytes };
    } finally {
      await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
      // A folder this export created and could not fill goes too.
      if (!done && created) await fsp.rmdir(dir).catch(() => {});
    }
  }

  /** The target is empty (dot entries and root documentation files aside), or an earlier export of the same id; it is never inside CucCut's own folders. */
  async #checkTarget(dir: string, id: string): Promise<void> {
    const { registry } = this.#o;
    const real = await fsp.realpath(dir).catch(() => dir);
    for (const own of [registry.dir, registry.templatesDir, registry.skillsDir]) {
      const ownReal = await fsp.realpath(own).catch(() => own);
      if (within(ownReal, real) || within(real, ownReal)) throw invalid(RcPacks.exportTargetInHome().text, dir);
    }
    const stat = await fsp.stat(dir).catch(() => null);
    if (!stat) return;
    const notEmpty = () => new RpcError('conflict', RcPacks.exportTargetNotEmpty(), { code: 'PACK_EXPORT_TARGET_NOT_EMPTY', dir });
    if (!stat.isDirectory()) throw notEmpty();
    const entries = (await fsp.readdir(dir)).filter((name) => !name.startsWith('.') && !PACK_DOC_FILE_PATTERN.test(name));
    if (!entries.length) return;
    const earlier = await earlierExport(dir, id);
    if (earlier && (await onlyOwnedFiles(dir, entries, earlier))) return;
    throw notEmpty();
  }
}

/** The manifest of an earlier export of this id in the folder (its `pack.json` parses and names this id), or null. */
async function earlierExport(dir: string, id: string): Promise<PackManifest | null> {
  try {
    const raw = JSON.parse((await fsp.readFile(path.join(dir, PACK_MANIFEST_FILE), 'utf8')).replace(/^﻿/, '')) as unknown;
    const parsed = parsePackManifest(raw);
    return parsed.ok && parsed.manifest.id === id ? parsed.manifest : null;
  } catch {
    return null;
  }
}

/**
 * Whether every file under the given top-level entries is one the earlier export wrote: `pack.json` and the files its `files` index lists (an export always writes one;
 * a hand-written manifest without it falls back to what the manifest names). Dot entries inside them (`.DS_Store`) do not count; a link or any other kind of entry
 * does, so the folder is refused.
 */
async function onlyOwnedFiles(dir: string, entries: readonly string[], manifest: PackManifest): Promise<boolean> {
  const indexed = manifest.files ? new Set([PACK_MANIFEST_FILE, ...manifest.files.map((f) => f.path)]) : null;
  const owned = (rel: string) => (indexed ? indexed.has(rel) : (packFileRole(manifest, rel) ?? 'doc') !== 'doc');
  const walk = async (abs: string, rel: string): Promise<boolean> => {
    const stat = await fsp.lstat(abs);
    if (stat.isFile()) return owned(rel);
    if (!stat.isDirectory()) return false;
    for (const name of await fsp.readdir(abs)) {
      if (name.startsWith('.')) continue;
      if (!(await walk(path.join(abs, name), `${rel}/${name}`))) return false;
    }
    return true;
  };
  for (const name of entries) if (!(await walk(path.join(dir, name), name))) return false;
  return true;
}

/**
 * Moves the staged pack into `dir`: what was there (but dot entries and root documentation files; `#checkTarget` has made sure it is only what the earlier export wrote)
 * goes aside first and comes back if a move fails; it is deleted once the new files are in place.
 */
async function replaceContents(dir: string, staging: string): Promise<void> {
  const backup = path.join(dir, `${STAGING_PREFIX}old-${crypto.randomBytes(9).toString('base64url')}`);
  await fsp.mkdir(backup);
  const movedAside: string[] = [];
  const movedIn: string[] = [];
  try {
    for (const name of await fsp.readdir(dir)) {
      if (name.startsWith('.') || PACK_DOC_FILE_PATTERN.test(name)) continue;
      await fsp.rename(path.join(dir, name), path.join(backup, name));
      movedAside.push(name);
    }
    for (const name of await fsp.readdir(staging)) {
      await fsp.rename(path.join(staging, name), path.join(dir, name));
      movedIn.push(name);
    }
  } catch (error) {
    for (const name of movedIn.reverse()) await fsp.rm(path.join(dir, name), { recursive: true, force: true }).catch(() => {});
    for (const name of movedAside.reverse()) await fsp.rename(path.join(backup, name), path.join(dir, name)).catch(() => {});
    await fsp.rm(backup, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  await fsp.rm(backup, { recursive: true, force: true }).catch(() => {});
}

/** Copies the regular files of a directory (dot entries skipped, links not followed) and returns the bytes copied. */
async function copyDir(from: string, to: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const walk = async (abs: string, dest: string): Promise<void> => {
    await fsp.mkdir(dest, { recursive: true });
    for (const entry of await fsp.readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), path.join(dest, entry.name));
      else if (entry.isFile()) {
        await fsp.copyFile(path.join(abs, entry.name), path.join(dest, entry.name), fsp.constants.COPYFILE_EXCL);
        files += 1;
        bytes += (await fsp.lstat(path.join(abs, entry.name))).size;
      }
    }
  };
  await walk(from, to);
  return { files, bytes };
}

async function copyInto(from: string, to: string): Promise<void> {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.copyFile(from, to, fsp.constants.COPYFILE_EXCL);
}

/** `<slug>.<ext>`, made unique among the names already taken (`-2`, `-3`, …). */
export function uniqueFileName(name: string, extension: string, taken: Set<string>): string {
  const base = (slugPackId(name) ?? 'item').slice(0, 60).replace(/-+$/, '') || 'item';
  const ext = /^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : '';
  let candidate = `${base}${ext}`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}${ext}`;
  taken.add(candidate);
  return candidate;
}

/** The `files` index: every file under `dir` but `pack.json` (dot entries skipped), sorted, with size and sha256. */
async function filesIndex(dir: string): Promise<PackFileEntry[]> {
  const out: PackFileEntry[] = [];
  const walk = async (abs: string, rel: string): Promise<void> => {
    for (const entry of await fsp.readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), relPath);
      else if (entry.isFile() && relPath !== PACK_MANIFEST_FILE) {
        const file = path.join(abs, entry.name);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
        out.push({ path: relPath, size: (await fsp.lstat(file)).size, sha256: hash.digest('hex') });
      }
    }
  };
  await walk(dir, '');
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

async function isFile(file: string): Promise<boolean> {
  return (await fsp.lstat(file).catch(() => null))?.isFile() ?? false;
}

function within(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function invalid(issue: string, dir: string, issues: string[] = [issue]): RpcError {
  return new RpcError('invalid-request', RcPacks.invalid({ issue }), { code: 'PACK_INVALID', dir, issues });
}

function tooLarge(files: number, bytes: number, dir: string): RpcError {
  return new RpcError('invalid-request', RcPacks.tooLarge({ files, bytes, maxFiles: PACK_LIMITS.files, maxBytes: PACK_LIMITS.totalBytes }), {
    code: 'PACK_TOO_LARGE',
    dir,
    files,
    bytes,
    limit: { files: PACK_LIMITS.files, bytes: PACK_LIMITS.totalBytes },
  });
}
