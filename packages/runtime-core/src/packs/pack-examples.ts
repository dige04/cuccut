import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  PACK_DIRS,
  PACK_EXAMPLE_EXTENSIONS,
  PACK_LIMITS,
  PACK_TRASH_TTL_MS,
  RpcError,
  scanPackText,
  type PackDetail,
  type PackExample,
  type PackExampleKind,
  type PackExampleRemoveResult,
  type PackFileHit,
} from '@cuccut/protocol';
import { RcPacks } from '@cuccut/protocol/messages/runtime-core';
import { blockedError } from './pack-inspect.ts';
import type { InstalledPack, PackRegistry } from './pack-registry.ts';
import { rewriteInstalledPack } from './pack-style.ts';

/**
 * Reference files on the pack page (pack spec §7.3): the images and videos that show the style, each with a title and what to take from it. They live in the installed
 * pack's `examples/` and are named by its `pack.json` and record, like the ones a pack brings, so export carries them and the session block lists them.
 *
 * - Add copies a local file in under a clean name; a video gets a still beside it (`examples/<file>.jpg`), taken with ffmpeg. Without ffmpeg (or when it can't read the
 *   video) the reference is added without a still, and the page says so.
 * - Titles and notes are scanned like the guide: a flagged line refuses the change (`PACK_BLOCKED`).
 * - Remove acts at once: the file and its still go to `<home>/packs/.trash/<trashId>/` for 24 hours, and restore puts them back where they were.
 * - Every change runs in the installer's queue, so it never interleaves with an install or a removal of the same pack.
 */

/** Takes one still of a video into `still` (a JPEG). false: none could be taken (no ffmpeg, or it could not read the video). */
export type PackStillMaker = (video: string, still: string) => Promise<boolean>;

export interface PackExamplesOptions {
  registry: PackRegistry;
  still: PackStillMaker;
  exclusive?: <T>(run: () => Promise<T>) => Promise<T>;
  now?: () => Date;
  trashTtlMs?: number;
}

/** `.trash/<trashId>/.example.json`: a removed reference file and where it stood. */
interface ExampleTrash {
  schemaVersion: 1;
  packId: string;
  index: number;
  example: PackExample;
  trashedAt: string;
}

const EXAMPLE_TRASH_META = '.example.json';
/** What the installer reads to purge a trash folder after 24 hours. */
const TRASH_META = '.trash.json';
const TRASH_ID = /^[A-Za-z0-9_-]{8,128}$/;
const STILL_TIMEOUT_MS = 60_000;

export class PackExamples {
  readonly #o: PackExamplesOptions;

  constructor(options: PackExamplesOptions) {
    this.#o = options;
  }

  get trashDir(): string {
    return path.join(this.#o.registry.dir, '.trash');
  }

  /** `packs.addExample`: copies a local image or video into the pack's reference files. */
  add(params: { id: string; path: string; title?: string; note?: string }): Promise<PackDetail> {
    return this.#exclusive(() => this.#add(params));
  }

  /** `packs.updateExample`: a reference file's title or note. */
  update(params: { id: string; file: string; title?: string; note?: string }): Promise<PackDetail> {
    return this.#exclusive(() => this.#update(params));
  }

  /** `packs.removeExample`: the file and its still go to the trash; `trashId` is the Undo. */
  remove(params: { id: string; file: string }): Promise<PackExampleRemoveResult> {
    return this.#exclusive(() => this.#remove(params));
  }

  /** `packs.restoreExample`: undo a removal. */
  restore(params: { id: string; trashId: string }): Promise<PackDetail> {
    return this.#exclusive(() => this.#restore(params));
  }

  /** For `packs.openHandle`: a reference file or its still, by its pack-relative path. Anything else: `PACK_EXAMPLE_NOT_FOUND`. */
  async locate(id: string, file: string): Promise<{ root: string; file: string }> {
    const pack = await this.#o.registry.require(id);
    if (!pack.record.examples.some((e) => e.file === file || e.still === file)) throw notFound(pack, file);
    return { root: pack.dir, file };
  }

  async #add({ id, path: source, title = '', note = '' }: { id: string; path: string; title?: string; note?: string }): Promise<PackDetail> {
    const { registry } = this.#o;
    const pack = await registry.require(id);
    const examples = pack.record.examples;
    if (examples.length >= PACK_LIMITS.examples) {
      throw new RpcError('invalid-request', RcPacks.exampleLimit({ limit: PACK_LIMITS.examples }), {
        code: 'PACK_EXAMPLE_LIMIT',
        packId: id,
        limit: PACK_LIMITS.examples,
      });
    }
    const stat = await fsp.stat(source).catch(() => null);
    if (!stat?.isFile()) throw new RpcError('not-found', RcPacks.sourceNotFound({ source }), { code: 'PACK_SOURCE_NOT_FOUND', packId: id, path: source });
    const kind = exampleKind(source);
    if (!kind) {
      const extensions = [...PACK_EXAMPLE_EXTENSIONS.image, ...PACK_EXAMPLE_EXTENSIONS.video].join(', ');
      throw new RpcError('invalid-request', RcPacks.exampleUnsupported({ file: path.basename(source), extensions }), {
        code: 'PACK_EXAMPLE_UNSUPPORTED',
        packId: id,
        path: source,
        extensions: [...PACK_EXAMPLE_EXTENSIONS.image, ...PACK_EXAMPLE_EXTENSIONS.video],
      });
    }
    scanDetails(id, examples.length, title, note);
    const total = (await folderBytes(pack.dir)) + stat.size;
    if (total > PACK_LIMITS.totalBytes) {
      throw new RpcError('invalid-request', RcPacks.exampleTooLarge({ bytes: total, limit: PACK_LIMITS.totalBytes }), {
        code: 'PACK_TOO_LARGE',
        packId: id,
        bytes: total,
        limit: PACK_LIMITS.totalBytes,
      });
    }

    const taken = await takenNames(pack);
    const file = `${PACK_DIRS.examples}/${exampleName(source, taken)}`;
    const target = path.join(pack.dir, ...file.split('/'));
    const written: string[] = [];
    try {
      await copyAtomic(source, target);
      written.push(target);
      let still: string | undefined;
      if (kind === 'video') {
        const stillFile = `${file}.jpg`;
        if (!taken.has(stillFile.toLowerCase())) {
          const stillTarget = path.join(pack.dir, ...stillFile.split('/'));
          if (await this.#o.still(target, stillTarget).catch(() => false)) {
            written.push(stillTarget);
            still = stillFile;
          }
        }
      }
      const example: PackExample = { file, kind, title, note, ...(still ? { still } : {}) };
      const next = [...examples, example];
      await rewriteInstalledPack(pack, { examples: next }, { examples: next }, this.#now());
    } catch (error) {
      for (const file of written) await fsp.rm(file, { force: true }).catch(() => {});
      throw error;
    }
    return registry.detail(id);
  }

  async #update({ id, file, title, note }: { id: string; file: string; title?: string; note?: string }): Promise<PackDetail> {
    const { registry } = this.#o;
    const pack = await registry.require(id);
    const examples = pack.record.examples;
    const index = examples.findIndex((e) => e.file === file);
    if (index < 0) throw notFound(pack, file);
    const current = examples[index]!;
    const next: PackExample = { ...current, title: title ?? current.title, note: note ?? current.note };
    scanDetails(id, index, next.title, next.note);
    if (next.title !== current.title || next.note !== current.note) {
      const list = examples.map((e, i) => (i === index ? next : e));
      await rewriteInstalledPack(pack, { examples: list }, { examples: list }, this.#now());
    }
    return registry.detail(id);
  }

  async #remove({ id, file }: { id: string; file: string }): Promise<PackExampleRemoveResult> {
    const { registry } = this.#o;
    const pack = await registry.require(id);
    const examples = pack.record.examples;
    const index = examples.findIndex((e) => e.file === file);
    if (index < 0) throw notFound(pack, file);
    const example = examples[index]!;
    const trashId = crypto.randomBytes(16).toString('base64url');
    const trash = path.join(this.trashDir, trashId);
    const now = this.#now();
    const moved: [string, string][] = [];
    try {
      await fsp.mkdir(path.join(trash, 'files'), { recursive: true });
      const meta: ExampleTrash = { schemaVersion: 1, packId: id, index, example, trashedAt: now.toISOString() };
      await fsp.writeFile(path.join(trash, EXAMPLE_TRASH_META), `${JSON.stringify(meta, null, 2)}\n`);
      await fsp.writeFile(
        path.join(trash, TRASH_META),
        `${JSON.stringify({ schemaVersion: 1, kind: 'example', trashedAt: meta.trashedAt, packId: id, packName: pack.record.name, templates: [], skills: [] }, null, 2)}\n`,
      );
      for (const rel of [example.file, ...(example.still ? [example.still] : [])]) {
        const from = path.join(pack.dir, ...rel.split('/'));
        const to = path.join(trash, 'files', ...rel.split('/'));
        if (!(await exists(from))) continue;
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.rename(from, to);
        moved.push([from, to]);
      }
      const list = examples.filter((_, i) => i !== index);
      await rewriteInstalledPack(pack, { examples: list }, { examples: list }, now);
    } catch (error) {
      for (const [from, to] of moved.reverse()) await fsp.rename(to, from).catch(() => {});
      await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return { ...(await registry.detail(id)), trashId };
  }

  async #restore({ id, trashId }: { id: string; trashId: string }): Promise<PackDetail> {
    const { registry } = this.#o;
    const expired = () => new RpcError('conflict', RcPacks.trashExpired(), { code: 'PACK_TRASH_EXPIRED', packId: id, trashId });
    if (!TRASH_ID.test(trashId)) throw expired();
    const trash = path.join(this.trashDir, trashId);
    const meta = await readExampleTrash(trash);
    if (!meta || meta.packId !== id) throw expired();
    if (this.#now().getTime() - Date.parse(meta.trashedAt) >= (this.#o.trashTtlMs ?? PACK_TRASH_TTL_MS)) {
      await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
      throw expired();
    }
    const pack = await registry.require(id);
    const examples = pack.record.examples;
    if (examples.length >= PACK_LIMITS.examples) {
      throw new RpcError('invalid-request', RcPacks.exampleLimit({ limit: PACK_LIMITS.examples }), {
        code: 'PACK_EXAMPLE_LIMIT',
        packId: id,
        limit: PACK_LIMITS.examples,
      });
    }
    const { example } = meta;
    const files = [example.file, ...(example.still ? [example.still] : [])];
    const taken = await takenNames(pack);
    for (const rel of files) {
      if (taken.has(rel.toLowerCase())) {
        throw new RpcError('conflict', RcPacks.exampleNameTaken({ file: rel }), { code: 'PACK_RESTORE_CONFLICT', packId: id, trashId, id: rel });
      }
    }
    const moved: [string, string][] = [];
    let still = example.still;
    try {
      for (const rel of files) {
        const from = path.join(trash, 'files', ...rel.split('/'));
        const to = path.join(pack.dir, ...rel.split('/'));
        if (!(await exists(from))) {
          // The reference itself must come back; a lost still only drops the still.
          if (rel === example.file) throw expired();
          still = undefined;
          continue;
        }
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.rename(from, to);
        moved.push([from, to]);
      }
      const { still: _still, ...rest } = example;
      const back: PackExample = { ...rest, ...(still ? { still } : {}) };
      const list = [...examples];
      list.splice(Math.min(meta.index, list.length), 0, back);
      await rewriteInstalledPack(pack, { examples: list }, { examples: list }, this.#now());
    } catch (error) {
      for (const [from, to] of moved.reverse()) await fsp.rename(to, from).catch(() => {});
      throw error;
    }
    await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
    return registry.detail(id);
  }

  #exclusive<T>(run: () => Promise<T>): Promise<T> {
    return this.#o.exclusive ? this.#o.exclusive(run) : run();
  }

  #now(): Date {
    return this.#o.now ? this.#o.now() : new Date();
  }
}

/**
 * A still maker that runs ffmpeg: one frame a second in (the first frame for a shorter video), scaled to at most 1280 pixels wide, as a JPEG. `ffmpeg` finds the binary;
 * null means there is none, and no still is taken. Only the local file is read (`file:` protocol, no shell).
 */
export function ffmpegStillMaker(ffmpeg: () => Promise<string | null>): PackStillMaker {
  return async (video, still) => {
    const command = await ffmpeg().catch(() => null);
    if (!command) return false;
    const temp = path.join(path.dirname(still), `.${path.basename(still)}.${process.pid}.${Date.now()}.tmp`);
    const run = (seek: boolean) =>
      new Promise<boolean>((resolve) => {
        const args = [
          '-nostdin',
          '-hide_banner',
          '-v',
          'error',
          '-y',
          '-protocol_whitelist',
          'file',
          ...(seek ? ['-ss', '1'] : []),
          '-i',
          `file:${video}`,
          '-map',
          '0:v:0',
          '-frames:v',
          '1',
          '-vf',
          "scale='min(1280,iw)':-2",
          '-q:v',
          '3',
          '-f',
          'image2',
          '-c:v',
          'mjpeg',
          `file:${temp}`,
        ];
        execFile(command, args, { timeout: STILL_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 }, (error) => resolve(!error));
      });
    try {
      for (const seek of [true, false]) {
        if ((await run(seek)) && ((await fsp.stat(temp).catch(() => null))?.size ?? 0) > 0) {
          await fsp.rename(temp, still);
          return true;
        }
      }
      return false;
    } finally {
      await fsp.rm(temp, { force: true }).catch(() => {});
    }
  };
}

/** A title or note an agent will read: a flagged line refuses the change, named as in the preview (`pack.json#examples[n].title`). */
function scanDetails(packId: string, index: number, title: string, note: string): void {
  const hits: PackFileHit[] = [
    ...scanPackText(title).map((hit) => ({ ...hit, file: `pack.json#examples[${index}].title` })),
    ...scanPackText(note).map((hit) => ({ ...hit, file: `pack.json#examples[${index}].note` })),
  ];
  if (hits.length) throw blockedError(packId, hits);
}

function notFound(pack: InstalledPack, file: string): RpcError {
  return new RpcError('not-found', RcPacks.exampleNotFound({ file, pack: pack.record.name }), { code: 'PACK_EXAMPLE_NOT_FOUND', packId: pack.record.id, file });
}

function exampleKind(file: string): PackExampleKind | null {
  const extension = path.extname(file).slice(1).toLowerCase();
  if (PACK_EXAMPLE_EXTENSIONS.image.includes(extension)) return 'image';
  if (PACK_EXAMPLE_EXTENSIONS.video.includes(extension)) return 'video';
  return null;
}

/** Pack-relative paths (lowercase) already used under `examples/`, on disk or in the record, so a new file never replaces one. */
async function takenNames(pack: InstalledPack): Promise<Set<string>> {
  const taken = new Set<string>();
  for (const e of pack.record.examples) for (const rel of [e.file, e.still]) if (rel) taken.add(rel.toLowerCase());
  const entries = await fsp.readdir(path.join(pack.dir, PACK_DIRS.examples)).catch(() => [] as string[]);
  for (const name of entries) taken.add(`${PACK_DIRS.examples}/${name}`.toLowerCase());
  return taken;
}

/** A clean file name for a reference: lowercase letters, digits, dots and dashes, the extension kept, `-2`, `-3`… when the name is taken. */
export function exampleName(source: string, taken: ReadonlySet<string>): string {
  const extension = path.extname(source).slice(1).toLowerCase();
  const stem =
    path
      .basename(source, path.extname(source))
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80)
      .replace(/[-.]+$/, '') || 'reference';
  for (let n = 1; ; n++) {
    const name = `${stem}${n > 1 ? `-${n}` : ''}.${extension}`;
    const rel = `${PACK_DIRS.examples}/${name}`.toLowerCase();
    if (!taken.has(rel) && !taken.has(`${rel}.jpg`)) return name;
  }
}

/** Copies a file in through a dot-named temporary file and a rename, so the pack never holds half of it. */
async function copyAtomic(from: string, to: string): Promise<void> {
  const temp = path.join(path.dirname(to), `.${path.basename(to)}.${process.pid}.${Date.now()}.tmp`);
  await fsp.mkdir(path.dirname(to), { recursive: true });
  try {
    await fsp.copyFile(from, temp);
    await fsp.rename(temp, to);
  } catch (error) {
    await fsp.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

/** Bytes of the regular files under `dir`, dot entries skipped (as the pack limits count them). */
async function folderBytes(dir: string): Promise<number> {
  let total = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await folderBytes(abs);
    else if (entry.isFile()) total += (await fsp.lstat(abs).catch(() => null))?.size ?? 0;
  }
  return total;
}

async function readExampleTrash(dir: string): Promise<ExampleTrash | null> {
  try {
    const raw = JSON.parse(await fsp.readFile(path.join(dir, EXAMPLE_TRASH_META), 'utf8')) as Partial<ExampleTrash>;
    const e = raw.example;
    if (raw.schemaVersion !== 1 || typeof raw.packId !== 'string' || typeof raw.trashedAt !== 'string' || typeof raw.index !== 'number' || !e) return null;
    const under = (rel: unknown): rel is string =>
      typeof rel === 'string' && rel.startsWith(`${PACK_DIRS.examples}/`) && !rel.split('/').some((seg) => seg === '' || seg === '.' || seg === '..' || seg.startsWith('.'));
    if (!under(e.file) || (e.still !== undefined && !under(e.still)) || (e.kind !== 'image' && e.kind !== 'video')) return null;
    if (typeof e.title !== 'string' || typeof e.note !== 'string') return null;
    return {
      schemaVersion: 1,
      packId: raw.packId,
      index: Math.max(0, Math.floor(raw.index)),
      trashedAt: raw.trashedAt,
      example: { file: e.file, kind: e.kind, title: e.title, note: e.note, ...(e.still ? { still: e.still } : {}) },
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
