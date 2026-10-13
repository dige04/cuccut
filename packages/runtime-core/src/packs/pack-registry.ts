import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  PACK_DIRS,
  PACK_ID_PATTERN,
  PACK_LIMITS,
  PACK_MANIFEST_FILE,
  PACK_RECORD_FILE,
  RpcError,
  type InstalledPackRecord,
  type LibraryName,
  type PackDetail,
  type PackDiagnostic,
  type PackExampleView,
  type PackItemKind,
  type PackItemView,
  type PackListResult,
  type PackManifest,
  type PackRef,
  type PackReservedTexts,
  type PackSummary,
} from '@cuccut/protocol';
import { parsePackManifest } from '@cuccut/protocol/schemas';
import { RcPacks } from '@cuccut/protocol/messages/runtime-core';
import type { PackOwnerLookup } from '../templates/template-catalog.ts';

/**
 * Installed packs (pack spec §6): each `<home>/packs/<id>/` holds the pack's own files (`pack.json`, the style guide, reference files, reserved files) and CucCut's record
 * `.cuccut-pack.json`. The registry reads them on every call, like the template and skill catalogs: a folder dropped or deleted by hand shows on the next list.
 *
 * - A folder whose record or manifest can't be read becomes a diagnostic of `packs.list`, never a failure.
 * - Item states (`present`, `changed`, `deleted`) compare each installed template and skill directory with the digest recorded at install (`packDirHash`).
 * - `owners()` answers which pack a template or skill came from: the pack that wrote it, else a pack whose manifest names it (its style still applies when the user kept their
 *   own copy).
 */

/** The library as the registry sees it: whether an entry a pack created is still there, and its name. */
export interface PackLibraryView {
  entry(library: LibraryName, id: string): { name: string } | null;
}

export interface PackRegistryOptions {
  /** `<home>/packs`. */
  dir: string;
  /** `<home>/templates`. */
  templatesDir: string;
  /** `<home>/skills`. */
  skillsDir: string;
  library?: PackLibraryView;
}

/** One readable installed pack. */
export interface InstalledPack {
  record: InstalledPackRecord;
  /** `pack.json` as installed. */
  manifest: PackManifest;
  /** `<home>/packs/<id>`. */
  dir: string;
}

const RECORD_MAX_BYTES = 1024 * 1024;

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local'), path: z.string() }),
  z.object({
    kind: z.literal('github'),
    url: z.string(),
    owner: z.string(),
    repo: z.string(),
    ref: z.string(),
    commit: z.string(),
    path: z.string(),
  }),
  z.object({ kind: z.literal('url'), url: z.string() }),
]);
const dirSchema = z.object({ id: z.string(), dirHash: z.string() });
const recordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(PACK_ID_PATTERN),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  license: z.string(),
  source: sourceSchema,
  manifestHash: z.string(),
  installedAt: z.string(),
  updatedAt: z.string(),
  provides: z.object({ templates: z.array(z.string()), skills: z.array(z.string()) }),
  installed: z.object({
    templates: z.array(dirSchema),
    skills: z.array(dirSchema),
    library: z.array(
      z.object({ file: z.string(), library: z.enum(['glossaries', 'voices', 'brand']), entryId: z.string(), contentHash: z.string() }),
    ),
  }),
  style: z.boolean(),
  examples: z.array(
    z.object({
      file: z.string(),
      kind: z.enum(['image', 'video']),
      title: z.string(),
      note: z.string(),
      still: z.string().optional(),
    }),
  ),
  quickActions: z.array(z.object({ label: z.string(), text: z.string() })),
  reserved: z.object({ rules: z.number().int().nonnegative(), review: z.boolean() }),
});

export class PackRegistry {
  readonly dir: string;
  readonly templatesDir: string;
  readonly skillsDir: string;
  readonly #library: PackLibraryView | undefined;

  constructor(options: PackRegistryOptions) {
    this.dir = path.resolve(options.dir);
    this.templatesDir = path.resolve(options.templatesDir);
    this.skillsDir = path.resolve(options.skillsDir);
    this.#library = options.library;
  }

  /** `<home>/packs/<id>`. */
  packDir(id: string): string {
    return path.join(this.dir, id);
  }

  /** Every installed pack, sorted by name; unreadable folders as diagnostics. Dot folders (`.staging`, `.trash`) are not packs. */
  async scan(): Promise<{ packs: InstalledPack[]; diagnostics: PackDiagnostic[] }> {
    const entries = await fsp.readdir(this.dir, { withFileTypes: true }).catch(() => []);
    const packs: InstalledPack[] = [];
    const diagnostics: PackDiagnostic[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const dir = path.join(this.dir, entry.name);
      if (!entry.isDirectory()) continue;
      const read = await readInstalledPack(dir);
      if ('issues' in read) diagnostics.push({ dir: entry.name, path: dir, message: RcPacks.recordUnreadable().text, issues: read.issues });
      else if (read.record.id !== entry.name) {
        diagnostics.push({
          dir: entry.name,
          path: dir,
          message: RcPacks.recordUnreadable().text,
          issues: [RcPacks.recordIdMismatch({ id: read.record.id, dir: entry.name }).text],
        });
      } else packs.push(read);
    }
    packs.sort((a, b) => a.record.name.localeCompare(b.record.name) || a.record.id.localeCompare(b.record.id));
    return { packs, diagnostics };
  }

  async list(): Promise<PackListResult> {
    const { packs, diagnostics } = await this.scan();
    return { packs: packs.map((p) => this.summaryOf(p)), diagnostics };
  }

  /** An installed pack, or null when there is none (or it can't be read). */
  async get(id: string): Promise<InstalledPack | null> {
    if (!PACK_ID_PATTERN.test(id)) return null;
    const read = await readInstalledPack(this.packDir(id));
    return 'issues' in read || read.record.id !== id ? null : read;
  }

  /** An installed pack, or `not-found` (`PACK_NOT_FOUND`). */
  async require(id: string): Promise<InstalledPack> {
    const pack = await this.get(id);
    if (!pack) throw new RpcError('not-found', RcPacks.packNotFound({ id }), { code: 'PACK_NOT_FOUND', packId: id });
    return pack;
  }

  summaryOf({ record, dir }: InstalledPack): PackSummary {
    return {
      id: record.id,
      name: record.name,
      version: record.version,
      description: record.description,
      author: record.author,
      license: record.license,
      source: record.source,
      installedAt: record.installedAt,
      updatedAt: record.updatedAt,
      counts: {
        templates: record.installed.templates.length,
        skills: record.installed.skills.length,
        library: record.installed.library.length,
        examples: record.examples.length,
        quickActions: record.quickActions.length,
      },
      hasStyle: record.style,
      quickActions: record.quickActions,
      provides: record.provides,
      path: dir,
    };
  }

  /**
   * A lookup over one scan: the pack a template or skill id came from. The pack that installed it wins; otherwise a pack whose manifest names it (the user kept their own
   * copy, and the pack's style still applies to it).
   */
  async owners(): Promise<PackOwnerLookup> {
    const { packs } = await this.scan();
    const installed = new Map<string, PackRef>();
    const provided = new Map<string, PackRef>();
    for (const { record } of packs) {
      const ref = { id: record.id, name: record.name };
      for (const t of record.installed.templates) if (!installed.has(`template:${t.id}`)) installed.set(`template:${t.id}`, ref);
      for (const s of record.installed.skills) if (!installed.has(`skill:${s.id}`)) installed.set(`skill:${s.id}`, ref);
      for (const id of record.provides.templates) if (!provided.has(`template:${id}`)) provided.set(`template:${id}`, ref);
      for (const id of record.provides.skills) if (!provided.has(`skill:${id}`)) provided.set(`skill:${id}`, ref);
    }
    return (kind, id) => installed.get(`${kind}:${id}`) ?? provided.get(`${kind}:${id}`) ?? null;
  }

  async ownerOf(kind: 'template' | 'skill', id: string): Promise<PackRef | null> {
    return (await this.owners())(kind, id);
  }

  /** What a pack brought, as it is now. */
  async itemStates(record: InstalledPackRecord): Promise<PackDetail['items']> {
    const dirState = async (root: string, item: { id: string; dirHash: string }, kind: PackItemKind): Promise<PackItemView> => {
      const hash = await packDirHash(path.join(root, item.id)).catch(() => null);
      return { kind, id: item.id, state: hash === null ? 'deleted' : hash === item.dirHash ? 'present' : 'changed' };
    };
    const templates = await Promise.all(record.installed.templates.map((t) => dirState(this.templatesDir, t, 'template')));
    const skills = await Promise.all(record.installed.skills.map((s) => dirState(this.skillsDir, s, 'skill')));
    const library = record.installed.library.map((item): PackItemView => {
      const entry = this.#library?.entry(item.library, item.entryId) ?? null;
      return {
        kind: 'library',
        id: item.entryId,
        library: item.library,
        state: entry ? 'present' : 'deleted',
        ...(entry ? { name: entry.name } : {}),
      };
    });
    return { templates, skills, library };
  }

  /** `packs.get`: everything the pack page shows. */
  async detail(id: string): Promise<PackDetail> {
    const pack = await this.require(id);
    const { record, manifest, dir } = pack;
    const style = manifest.style ? await readText(path.join(dir, ...manifest.style.split('/')), PACK_LIMITS.readFileBytes) : null;
    const examples: PackExampleView[] = [];
    for (const example of record.examples) {
      const size = await fileSize(path.join(dir, ...example.file.split('/')));
      const still = example.kind === 'image' ? example.file : example.still;
      const hasStill = still ? (await fileSize(path.join(dir, ...still.split('/')))) !== null : false;
      examples.push({ ...example, hasStill, size: size ?? 0 });
    }
    return {
      pack: this.summaryOf(pack),
      style: style === null ? null : { text: style, hash: sha256Text(style) },
      examples,
      quickActions: record.quickActions,
      items: await this.itemStates(record),
      reserved: await readReservedTexts(dir, manifest),
    };
  }
}

/** Reads `.cuccut-pack.json` and `pack.json` of an installed pack folder. */
export async function readInstalledPack(dir: string): Promise<InstalledPack | { issues: string[] }> {
  const recordFile = path.join(dir, PACK_RECORD_FILE);
  let raw: unknown;
  try {
    const stat = await fsp.lstat(recordFile);
    if (!stat.isFile() || stat.size > RECORD_MAX_BYTES) return { issues: [RcPacks.recordMissing({ file: PACK_RECORD_FILE }).text] };
    raw = JSON.parse(await fsp.readFile(recordFile, 'utf8'));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { issues: [(code === 'ENOENT' ? RcPacks.recordMissing({ file: PACK_RECORD_FILE }) : RcPacks.recordNotJson({ file: PACK_RECORD_FILE })).text] };
  }
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) return { issues: parsed.error.issues.map((i) => `${PACK_RECORD_FILE} ${i.path.join('.') || '(root)'}: ${i.message}`) };
  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse((await fsp.readFile(path.join(dir, PACK_MANIFEST_FILE), 'utf8')).replace(/^﻿/, ''));
  } catch {
    return { issues: [RcPacks.recordNotJson({ file: PACK_MANIFEST_FILE }).text] };
  }
  const manifest = parsePackManifest(manifestRaw);
  if (!manifest.ok) return { issues: manifest.issues.map((issue) => `${PACK_MANIFEST_FILE}: ${issue}`) };
  return { record: parsed.data as InstalledPackRecord, manifest: manifest.manifest, dir };
}

/** The reserved files (rules and the review standard), read-only; files that aren't text, or are too large, are left out. */
export async function readReservedTexts(dir: string, manifest: Pick<PackManifest, 'rules' | 'review'>): Promise<PackReservedTexts> {
  const rules: { path: string; text: string }[] = [];
  if (manifest.rules.length) {
    for (const file of await listFiles(path.join(dir, PACK_DIRS.rules))) {
      const text = await readText(path.join(dir, PACK_DIRS.rules, ...file.split('/')), PACK_LIMITS.readFileBytes);
      if (text !== null) rules.push({ path: `${PACK_DIRS.rules}/${file}`, text });
    }
  }
  const review = manifest.review ? await readText(path.join(dir, manifest.review), PACK_LIMITS.readFileBytes) : null;
  return { rules, review };
}

/**
 * The digest of a template or skill directory (pack spec §6.2): sha256 over the sorted `(relative path, \0, bytes, \0)` of its regular files, dot files and dot folders
 * excluded (so a skill's `.cuccut-skill.json` does not count). Throws when the directory is missing.
 */
export async function packDirHash(dir: string): Promise<string> {
  const stat = await fsp.lstat(dir);
  if (!stat.isDirectory()) throw Object.assign(new Error('not a directory'), { code: 'ENOTDIR' });
  const files = await listFiles(dir);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    for await (const chunk of createReadStream(path.join(dir, ...file.split('/')))) hash.update(chunk as Buffer);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** sha256 (hex) of a file's bytes. */
export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Regular files under `dir` (relative, `/`-separated, sorted), dot entries skipped, links not followed. Empty when the folder is missing. */
async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (abs: string, rel: string): Promise<void> => {
    const entries = await fsp.readdir(abs, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), relPath);
      else if (entry.isFile()) out.push(relPath);
    }
  };
  await walk(dir, '');
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** A UTF-8 text file up to `max` bytes, or null (missing, not a regular file, too large, not UTF-8). */
export async function readText(file: string, max: number): Promise<string | null> {
  try {
    const stat = await fsp.lstat(file);
    if (!stat.isFile() || stat.size > max) return null;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await fsp.readFile(file));
    return text.includes('\u0000') ? null : text.replace(/^﻿/, '');
  } catch {
    return null;
  }
}

async function fileSize(file: string): Promise<number | null> {
  try {
    const stat = await fsp.lstat(file);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}
