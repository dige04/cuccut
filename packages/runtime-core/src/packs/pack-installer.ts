import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  PACK_ID_PATTERN,
  PACK_RECORD_FILE,
  PACK_TRASH_TTL_MS,
  RpcError,
  SKILL_SOURCE_FILE,
  type InstalledPackRecord,
  type LibraryName,
  type PackChangeResult,
  type PackInstalledDir,
  type PackInstalledLibraryItem,
  type PackItemKind,
  type PackItemRef,
  type PackPreview,
  type PackRemoveResult,
  type SkillSource,
} from '@cuccut/protocol';
import { RcPacks } from '@cuccut/protocol/messages/runtime-core';
import type { SkillCatalog } from '../skills/skill-catalog.ts';
import type { TemplateCatalog } from '../templates/template-catalog.ts';
import { blockedError, inspectStagedPack, type InspectedDir, type PackInspection } from './pack-inspect.ts';
import type { PackPreviewEntry, PackPreviews } from './pack-previews.ts';
import { packDirHash, type PackLibraryView, type PackRegistry } from './pack-registry.ts';
import { checkStagedPack, readPackSource, type PackSourceOptions } from './pack-source.ts';

/**
 * Install, remove and restore (pack spec §6). Only the desktop UI and the CLI reach it (`packs.inspect`, `install`, `remove` and `restore` are not on the Web allowlist).
 *
 * Install, from a preview token or straight from a source:
 * 1. The staged folder is checked again (`checkStagedPack`) and inspected again, so states are those of now; blocking scan hits refuse it (`PACK_BLOCKED`).
 * 2. Library files are imported through the library (an entry an installed pack already created from the same bytes is reused).
 * 3. Template and skill directories are renamed into `<home>/templates` and `<home>/skills`: built-in ids are skipped; the user's own items and items changed since the last
 *    install are skipped unless `replace`, which moves them to the trash first; items this pack wrote and nobody changed are updated. Items an earlier version wrote that
 *    this version dropped go, when unchanged.
 * 4. The pack folder (`pack.json`, the style guide, reference files, reserved files, and the record `.cuccut-pack.json`) is written last.
 * Any failure undoes the moves of this attempt and deletes the library entries it created; the preview stays installable.
 *
 * Remove moves the pack folder and its unchanged templates and skills to `.trash/<trashId>/` (kept 24 hours for `restore`); changed items, library entries, project choices
 * and skill toggles stay. Mutations run one at a time; a retry with the same `commandId` returns the first result.
 */

/** The library as the installer uses it. */
export interface PackLibrary extends PackLibraryView {
  import(file: string): Promise<{ library: LibraryName; id: string }>;
  remove(library: LibraryName, id: string): Promise<void>;
}

export type PackInstallStep = 'library' | 'templates' | 'skills' | 'folder';

export interface PackInstallerOptions {
  registry: PackRegistry;
  previews: PackPreviews;
  templates: TemplateCatalog;
  skills: SkillCatalog;
  library: PackLibrary;
  /** Reading sources: strict offline mode, GitHub and `https://` fetches (tests inject fakes). */
  source: Omit<PackSourceOptions, 'packsDir'>;
  now?: () => Date;
  trashTtlMs?: number;
  /** Tests: called before each install step; a throw there exercises the rollback. */
  onStep?: (step: PackInstallStep) => void | Promise<void>;
}

/** `.trash/<id>/.trash.json`: what a trash folder holds. */
interface TrashMeta {
  schemaVersion: 1;
  /** `pack`: a removed pack (restorable); `replaced`: the user's items an install replaced; `install`: an install's scratch space. */
  kind: 'pack' | 'replaced' | 'install';
  trashedAt: string;
  packId: string;
  packName: string;
  templates: string[];
  skills: string[];
}

const TRASH_META = '.trash.json';
const TRASH_ID = /^[A-Za-z0-9_-]{8,128}$/;

type Undo = () => Promise<void>;

export class PackInstaller {
  readonly #o: PackInstallerOptions;
  readonly #commands = new Map<string, Promise<unknown>>();
  #queue: Promise<unknown> = Promise.resolve();

  constructor(options: PackInstallerOptions) {
    this.#o = options;
  }

  get trashDir(): string {
    return path.join(this.#o.registry.dir, '.trash');
  }

  /** Reads a source into a preview: nothing is installed. */
  inspect(params: { source: string; commandId?: string }): Promise<PackPreview> {
    return this.#once(params.commandId && `inspect:${params.commandId}`, async () => {
      const entry = await this.#stage(params.source);
      try {
        const inspection = await this.#inspect(entry);
        return { token: entry.token, expiresAt: new Date(entry.expiresAt).toISOString(), ...inspection.preview };
      } catch (error) {
        await this.#o.previews.release(entry.token);
        throw error;
      }
    });
  }

  install(params: ({ token: string } | { source: string }) & { replace?: boolean; commandId?: string }): Promise<PackChangeResult> {
    return this.#once(params.commandId && `install:${params.commandId}`, async () => {
      const fromSource = 'source' in params;
      const entry = fromSource ? await this.#stage(params.source) : await this.#o.previews.get(params.token);
      let done = false;
      try {
        const result = await this.#serial(() => this.#install(entry, params.replace === true));
        done = true;
        return result;
      } finally {
        // A preview stays installable after a failed attempt (everything was put back); one staged for this call alone goes either way.
        if (done || fromSource) await this.#o.previews.release(entry.token);
      }
    });
  }

  remove(id: string): Promise<PackRemoveResult> {
    return this.#serial(() => this.#remove(id));
  }

  restore(trashId: string): Promise<PackChangeResult> {
    return this.#serial(() => this.#restore(trashId));
  }

  /** At startup: previews do not survive a restart, and trash older than 24 hours is purged (with the toggles of the skills it held). */
  async startup(): Promise<void> {
    await this.#o.previews.sweepAll();
    await this.purgeTrash();
  }

  /** Deletes trash folders older than the trash period. A removed pack's skills lose their toggles then, unless a skill with the id is back. */
  async purgeTrash(): Promise<void> {
    const ttl = this.#o.trashTtlMs ?? PACK_TRASH_TTL_MS;
    const now = this.#now().getTime();
    const entries = await fsp.readdir(this.trashDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.trashDir, entry.name);
      const meta = await readTrashMeta(dir);
      const at = meta ? Date.parse(meta.trashedAt) : (await fsp.stat(dir).catch(() => null))?.mtimeMs;
      if (at !== undefined && Number.isFinite(at) && now - at < ttl) continue;
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
      if (meta?.kind === 'pack') {
        for (const id of meta.skills) if (!(await exists(path.join(this.#o.registry.skillsDir, id)))) await this.#o.skills.prefs.forget(id);
      }
    }
  }

  // ---- Install ----

  async #stage(source: string): Promise<PackPreviewEntry> {
    return this.#o.previews.stage((dir) => readPackSource(source, dir, { ...this.#o.source, packsDir: this.#o.registry.dir }));
  }

  #inspect(entry: PackPreviewEntry): Promise<PackInspection> {
    const { registry, templates, skills, library } = this.#o;
    return inspectStagedPack(entry.staged, { registry, templates, skills, library });
  }

  async #install(entry: PackPreviewEntry, replace: boolean): Promise<PackChangeResult> {
    const { registry, library } = this.#o;
    const { staged: before } = entry;
    const staged = await checkStagedPack(before.dir, before.source, { requireIndex: before.source.kind === 'url' });
    const inspection = await this.#inspect({ ...entry, staged });
    const { manifest } = staged;
    if (inspection.preview.blocked.length) throw blockedError(manifest.id, inspection.preview.blocked, inspection.preview.style?.text.length ?? 0);

    const now = this.#now().toISOString();
    const attempt = crypto.randomBytes(9).toString('base64url');
    const scratch = path.join(this.trashDir, `install-${attempt}`);
    const replacedDir = path.join(this.trashDir, `replaced-${attempt}`);
    const meta = (kind: TrashMeta['kind']): TrashMeta => ({ schemaVersion: 1, kind, trashedAt: now, packId: manifest.id, packName: manifest.name, templates: [], skills: [] });
    await writeTrashMeta(scratch, meta('install'));
    const undo: Undo[] = [];
    const created: { library: LibraryName; id: string }[] = [];
    const skipped: PackChangeResult['skipped'] = [];
    const replaced = meta('replaced');
    const previous = inspection.previous?.record ?? null;
    try {
      await this.#o.onStep?.('library');
      const libraryItems: PackInstalledLibraryItem[] = [];
      for (const item of inspection.library) {
        if (item.reuse) {
          libraryItems.push({ file: item.item.file, library: item.reuse.library, entryId: item.reuse.entryId, contentHash: item.contentHash });
          continue;
        }
        const entry = await library.import(item.source);
        created.push(entry);
        libraryItems.push({ file: item.item.file, library: entry.library, entryId: entry.id, contentHash: item.contentHash });
      }

      const place = async (kind: 'template' | 'skill', items: InspectedDir[], before: readonly PackInstalledDir[], root: string) => {
        const out: PackInstalledDir[] = [];
        const listed = kind === 'template' ? replaced.templates : replaced.skills;
        for (const item of items) {
          if (item.state === 'builtin') {
            skipped.push({ kind, id: item.id, reason: 'builtin' });
            continue;
          }
          if ((item.state === 'exists' || item.state === 'changed') && !replace) {
            skipped.push({ kind, id: item.id, reason: item.state });
            // A changed item stays this pack's, so its page says "changed since".
            const kept = item.state === 'changed' ? before.find((b) => b.id === item.id) : undefined;
            if (kept) out.push(kept);
            continue;
          }
          if (kind === 'skill') await writeSkillSource(item.source, { kind: 'pack', packId: manifest.id, packName: manifest.name, packVersion: manifest.version, installedAt: now });
          if (item.state === 'update') {
            await this.#move(item.target, path.join(scratch, `${kind}s`, item.id), undo);
          } else if (item.state === 'exists' || item.state === 'changed') {
            await this.#move(item.target, path.join(replacedDir, `${kind}s`, item.id), undo);
            listed.push(item.id);
            await writeTrashMeta(replacedDir, replaced);
          }
          await this.#move(item.source, item.target, undo);
          out.push({ id: item.id, dirHash: await packDirHash(item.target) });
        }
        // Items an earlier version wrote that this one no longer names: unchanged ones go; changed ones stay as the user's.
        const ids = new Set(items.map((i) => i.id));
        for (const old of before) {
          if (ids.has(old.id)) continue;
          const target = path.join(root, old.id);
          if ((await packDirHash(target).catch(() => null)) === old.dirHash) await this.#move(target, path.join(scratch, `${kind}s`, old.id), undo);
        }
        return out;
      };

      await this.#o.onStep?.('templates');
      const templates = await place('template', inspection.templates, previous?.installed.templates ?? [], registry.templatesDir);
      await this.#o.onStep?.('skills');
      const skills = await place('skill', inspection.skills, previous?.installed.skills ?? [], registry.skillsDir);

      await this.#o.onStep?.('folder');
      const record: InstalledPackRecord = {
        schemaVersion: 1,
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        license: manifest.license,
        source: staged.source,
        manifestHash: staged.manifestHash,
        installedAt: previous?.installedAt ?? now,
        updatedAt: now,
        provides: { templates: [...manifest.templates], skills: [...manifest.skills] },
        installed: { templates, skills, library: libraryItems },
        style: manifest.style !== '',
        examples: manifest.examples,
        quickActions: manifest.quickActions,
        reserved: { rules: manifest.rules.length, review: manifest.review !== '' },
      };
      const folder = path.join(scratch, 'folder');
      await fsp.mkdir(folder, { recursive: true });
      for (const file of staged.files) {
        if (!['manifest', 'style', 'example', 'still', 'rules', 'review'].includes(file.role)) continue;
        const dest = path.join(folder, ...file.path.split('/'));
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.copyFile(path.join(staged.dir, ...file.path.split('/')), dest, fsp.constants.COPYFILE_EXCL);
      }
      await fsp.writeFile(path.join(folder, PACK_RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
      const packDir = registry.packDir(manifest.id);
      if (await exists(packDir)) await this.#move(packDir, path.join(scratch, 'previous-folder'), undo);
      await this.#move(folder, packDir, undo);
    } catch (error) {
      for (const step of undo.reverse()) await step().catch(() => {});
      for (const entry of created) await library.remove(entry.library, entry.id).catch(() => {});
      await fsp.rm(scratch, { recursive: true, force: true }).catch(() => {});
      await fsp.rm(replacedDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    await fsp.rm(scratch, { recursive: true, force: true }).catch(() => {});
    const list = await registry.list();
    const pack = list.packs.find((p) => p.id === manifest.id) ?? registry.summaryOf(await registry.require(manifest.id));
    return { ...list, pack, skipped };
  }

  // ---- Remove and restore ----

  async #remove(id: string): Promise<PackRemoveResult> {
    const { registry } = this.#o;
    const pack = await registry.require(id);
    const { record } = pack;
    const states = await registry.itemStates(record);
    const trashId = crypto.randomBytes(16).toString('base64url');
    const trash = path.join(this.trashDir, trashId);
    const kept: PackItemRef[] = [];
    const meta: TrashMeta = {
      schemaVersion: 1,
      kind: 'pack',
      trashedAt: this.#now().toISOString(),
      packId: record.id,
      packName: record.name,
      templates: [],
      skills: [],
    };
    const undo: Undo[] = [];
    try {
      await writeTrashMeta(trash, meta);
      for (const [kind, items, root] of [
        ['template', states.templates, registry.templatesDir],
        ['skill', states.skills, registry.skillsDir],
      ] as const) {
        for (const item of items) {
          if (item.state === 'changed') kept.push({ kind, id: item.id });
          if (item.state !== 'present') continue;
          await this.#move(path.join(root, item.id), path.join(trash, `${kind}s`, item.id), undo);
          (kind === 'template' ? meta.templates : meta.skills).push(item.id);
        }
      }
      await writeTrashMeta(trash, meta);
      await this.#move(pack.dir, path.join(trash, 'pack'), undo);
    } catch (error) {
      for (const step of undo.reverse()) await step().catch(() => {});
      await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return {
      ...(await registry.list()),
      removed: { id: record.id, name: record.name },
      trashId,
      kept,
      moved: { templates: meta.templates.length, skills: meta.skills.length },
    };
  }

  async #restore(trashId: string): Promise<PackChangeResult> {
    const { registry } = this.#o;
    const expired = () => new RpcError('conflict', RcPacks.trashExpired(), { code: 'PACK_TRASH_EXPIRED', trashId });
    if (!TRASH_ID.test(trashId)) throw expired();
    const trash = path.join(this.trashDir, trashId);
    const meta = await readTrashMeta(trash);
    if (!meta || meta.kind !== 'pack' || !(await exists(path.join(trash, 'pack')))) throw expired();
    if (this.#now().getTime() - Date.parse(meta.trashedAt) >= (this.#o.trashTtlMs ?? PACK_TRASH_TTL_MS)) {
      await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
      throw expired();
    }
    const moves: [string, string, PackItemKind | 'pack', string][] = [
      [path.join(trash, 'pack'), registry.packDir(meta.packId), 'pack', meta.packId],
      ...meta.templates.map((id): [string, string, PackItemKind, string] => [path.join(trash, 'templates', id), path.join(registry.templatesDir, id), 'template', id]),
      ...meta.skills.map((id): [string, string, PackItemKind, string] => [path.join(trash, 'skills', id), path.join(registry.skillsDir, id), 'skill', id]),
    ];
    for (const [, target, kind, id] of moves) {
      if (await exists(target)) {
        throw new RpcError('conflict', RcPacks.restoreConflict({ id }), { code: 'PACK_RESTORE_CONFLICT', trashId, packId: meta.packId, kind, id });
      }
    }
    const undo: Undo[] = [];
    try {
      for (const [from, to] of moves) await this.#move(from, to, undo);
    } catch (error) {
      for (const step of undo.reverse()) await step().catch(() => {});
      throw error;
    }
    await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
    const list = await registry.list();
    const pack = list.packs.find((p) => p.id === meta.packId) ?? registry.summaryOf(await registry.require(meta.packId));
    return { ...list, pack, skipped: [] };
  }

  // ---- Shared ----

  /** Renames `from` to `to` (creating `to`'s parent) and records how to put it back. */
  async #move(from: string, to: string, undo: Undo[]): Promise<void> {
    await fsp.mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
    undo.push(() => rename(to, from));
  }

  #now(): Date {
    return this.#o.now ? this.#o.now() : new Date();
  }

  #serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.#queue.catch(() => {}).then(run);
    this.#queue = next;
    return next;
  }

  #once<T>(key: string | undefined | '', run: () => Promise<T>): Promise<T> {
    if (!key) return run();
    const done = this.#commands.get(key);
    if (done) return done as Promise<T>;
    const pending = run();
    this.#commands.set(key, pending);
    // Failures are not remembered: the same commandId can be retried.
    pending.catch(() => this.#commands.delete(key));
    return pending;
  }
}

/** A rename that also works across volumes (copy, then delete). */
async function rename(from: string, to: string): Promise<void> {
  try {
    await fsp.rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await fsp.cp(from, to, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
    await fsp.rm(from, { recursive: true, force: true });
  }
}

async function writeSkillSource(dir: string, source: SkillSource): Promise<void> {
  await fsp.writeFile(path.join(dir, SKILL_SOURCE_FILE), `${JSON.stringify({ schemaVersion: 1, ...source }, null, 2)}\n`);
}

async function writeTrashMeta(dir: string, meta: TrashMeta): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, TRASH_META), `${JSON.stringify(meta, null, 2)}\n`);
}

async function readTrashMeta(dir: string): Promise<TrashMeta | null> {
  try {
    const raw = JSON.parse(await fsp.readFile(path.join(dir, TRASH_META), 'utf8')) as Partial<TrashMeta>;
    if (raw.schemaVersion !== 1 || typeof raw.trashedAt !== 'string' || typeof raw.packId !== 'string' || !PACK_ID_PATTERN.test(raw.packId)) return null;
    if (raw.kind !== 'pack' && raw.kind !== 'replaced' && raw.kind !== 'install') return null;
    const ids = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !v.includes('/') && !v.startsWith('.')) : []);
    return {
      schemaVersion: 1,
      kind: raw.kind,
      trashedAt: raw.trashedAt,
      packId: raw.packId,
      packName: typeof raw.packName === 'string' ? raw.packName : raw.packId,
      templates: ids(raw.templates),
      skills: ids(raw.skills),
    };
  } catch {
    return null;
  }
}

async function exists(target: string): Promise<boolean> {
  return fsp.lstat(target).then(
    () => true,
    () => false,
  );
}
