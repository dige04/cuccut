/**
 * Deck storage: maps the host file interface that the Slides runtime expects onto a deck in the session working directory (docs/design/slides §2).
 *
 * Paths the runtime sees carry a `project/` prefix; on disk they are the same-named files in the deck directory:
 *   project/deck.json          ↔ <deck>/deck.json
 *   project/slides/<id>.html   ↔ <deck>/slides/<id>.html
 *   project/ds/**              ↔ <deck>/ds/**
 *   /_blob/<id>                ↔ <deck>/assets/<id>.<ext> (Content-Type recorded in assets/index.json)
 * Only these kinds of files are in the manifest and can be read or written. Other files in the deck directory (the agent's drafts, original asset images) are not visible to the editor and cannot be changed by it. A path containing a symbolic link is treated as nonexistent and not writable, since a symlink may point outside the deck directory.
 *
 * Design canvases (docs/design/canvas §2.2) use the same storage with a different file layout: swap `DeckLayout` for the layout from `@cuccut/design`, and all regular files in the directory (excluding `assets/`, dot-prefixed names and symlinks) go into the manifest. The default is the deck layout (`DECK_LAYOUT`).
 * The design system (docs/design/canvas §10.1) layout is in `@cuccut/design-system`: `assets/<group>/` is content, uploaded assets go into `DeckLayout.blobDir` (`_blobs/`), and `/_blob/<id>` is served from there.
 *
 * The read and write HTTP routes are in deck-routes.ts; protocol types are in file-protocol.ts.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLOB_ID_PATTERN,
  isProjectPath,
  isWriteEntry,
  type ConflictError,
  type ConflictPath,
  type DeckChangeEvent,
  type FileListing,
  type GenericPublishError,
  type ListingEntry,
  type PublishResult,
  type Sha256,
  type UploadResult,
  type WireEntry,
} from './file-protocol.ts';

/**
 * Content-Type by file extension (the manifest's `contentType` and the response headers for `project/*`). `project/*` carries `nosniff`, so every type a page loads as a sub-resource must be listed here: the design system preview loads `.js` with `<script src>` (docs/design/canvas §10.4), and browsers refuse to run it if the type is wrong.
 * The values match the original design system's `FILE_MIME_TYPES_BY_EXTENSION`, plus `mov`.
 */
const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  json: 'application/json',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  md: 'text/markdown',
  txt: 'text/plain',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  wasm: 'application/wasm',
};

/** Asset file extension, chosen by Content-Type; unrecognized types are stored as .bin. */
const EXT_BY_MIME: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/x-icon': 'ico',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
};

/** Subdirectory in the deck directory for assets (the default for `DeckLayout.blobDir`) and its type index. */
export const ASSETS_DIR = 'assets';
const ASSET_INDEX = 'index.json';

export function contentTypeOf(file: string): string {
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

export function assetExtensionOf(contentType: string): string {
  return EXT_BY_MIME[contentType.split(';')[0]!.trim().toLowerCase()] ?? 'bin';
}

export function sha256(bytes: Uint8Array | string): Sha256 {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Runtime path → relative path in the deck directory; returns null for files that are not one of the readable and writable kinds.
 * `project/deck.json`, `project/slides/<name>.html` (one level only), `project/ds/**`.
 */
export function deckFileOf(runtimePath: string): string | null {
  if (!isProjectPath(runtimePath)) return null;
  const rel = runtimePath.slice('project/'.length);
  return isDeckFile(rel) ? rel : null;
}

/** Whether a relative path (`/`-separated) in the deck directory is a file visible to the editor. Any segment starting with a dot never counts. */
export function isDeckFile(rel: string): boolean {
  const parts = rel.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..' || part.startsWith('.'))) return false;
  if (rel === 'deck.json') return true;
  if (parts[0] === 'slides') return parts.length === 2 && parts[1]!.endsWith('.html');
  return parts[0] === 'ds' && parts.length > 1;
}

/**
 * File layout served by the editor: which files go into the manifest, which can be read and written, and which directories the manifest and watcher start from. Decks use `DECK_LAYOUT`; the design canvas layout is in `@cuccut/design` (canvas-layout.ts), the design system's is in `@cuccut/design-system`, and the Runtime hands it to SlidesServer.
 * Segments starting with a dot and symlinks never count under any layout. The asset directory (`blobDir`) is managed by the storage itself, and a layout should not count it.
 */
export interface DeckLayout {
  /** Subdirectory where uploaded assets go (`<id>.<ext>` and the type index `index.json`). Defaults to `assets`. */
  readonly blobDir?: string;
  /** Whether a relative path (`/`-separated) in the directory is a file visible to the editor and writable. */
  isFile(rel: string): boolean;
  /** The directories the manifest and watcher start from (`''` is the root); with `descend`, subdirectories are walked too. */
  readonly roots: readonly { readonly rel: string; readonly descend: boolean }[];
  /** Whether to enter this subdirectory (relative path) when descending. If not given, all subdirectories not starting with a dot are entered. */
  descendInto?(rel: string): boolean;
  /** When the watcher reports that this relative path changed, whether to re-compare the manifest: a visible file, or a directory that may contain them. */
  watches(rel: string): boolean;
  /** The manifest lists at most this many files; when exceeded, only the first this many files found in traversal order (sorted by name) are listed, and `onTruncated` is called once. */
  readonly maxFiles?: number;
  /** Total upper limit of content written in one publish (bytes, after decoding). */
  readonly maxPublishBytes?: number;
  /** Per-file upper limit when publishing (bytes, after decoding). */
  readonly maxFileBytes?: number;
  /** Upper limit for uploading one asset (bytes); differs by Content-Type (e.g. SVG is smaller). If not given, only the route's request body limit applies. */
  maxBlobBytes?(contentType: string): number;
  /** Message given to the editor when publishing to a non-writable path. */
  readOnlyMessage(runtimePath: string): string;
}

/** Deck layout (docs/design/slides §2.2): `deck.json`, `slides/*.html` (one level only), `ds/**`. */
export const DECK_LAYOUT: DeckLayout = {
  isFile: isDeckFile,
  roots: [
    { rel: '', descend: false },
    { rel: 'slides', descend: false },
    { rel: 'ds', descend: true },
  ],
  watches: rel => rel === 'slides' || rel === 'ds' || isDeckFile(rel),
  readOnlyMessage: p => `${p}: only deck.json, slides/*.html and ds/** can be written`,
};

export interface DeckStoreOptions {
  /** Called the first time the manifest exceeds `layout.maxFiles` (once per storage only). */
  onTruncated?: (limit: number) => void;
}

/** Result of a publish; distinguishes success from the various failures by HTTP status. */
export type PublishOutcome =
  | { status: 200; body: PublishResult }
  | { status: 409; body: ConflictError }
  | { status: 400 | 413; body: GenericPublishError };

/** Lists the relative paths of visible files under the layout (does not follow symlinks; skips dot-prefixed names). Directories are traversed in name order and it stops when `limit` is reached. */
async function collectFiles(root: string, layout: DeckLayout, limit: number): Promise<{ rels: string[]; truncated: boolean }> {
  const rels: string[] = [];
  const seen = new Set<string>();
  let truncated = false;
  const visit = async (relDir: string, descend: boolean): Promise<void> => {
    const dir = relDir === '' ? root : path.join(root, ...relDir.split('/'));
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (truncated) return;
      if (entry.name.startsWith('.')) continue;
      const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (descend && (layout.descendInto?.(rel) ?? true)) await visit(rel, true);
      } else if (entry.isFile() && layout.isFile(rel) && !seen.has(rel)) {
        if (rels.length >= limit) {
          truncated = true;
          return;
        }
        seen.add(rel);
        rels.push(rel);
      }
    }
  };
  for (const start of layout.roots) {
    if (truncated) break;
    await visit(start.rel, start.descend);
  }
  return { rels, truncated };
}

/** Atomic write: writes a dot-prefixed temp file in the same directory (Space and the external-change watcher skip it), then renames it. */
async function writeFileAtomic(file: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

export class DeckStore {
  /** Deck directory (the level containing deck.json), or design canvas directory (the level containing canvas.json). */
  readonly root: string;
  readonly layout: DeckLayout;
  /** Runtime paths of files this process has just written → the sha at write time (deletions recorded as ""), used to tell "the editor saved it itself" from "external change". */
  readonly ownWrites = new Map<string, Sha256 | ''>();
  private queue: Promise<unknown> = Promise.resolve();
  private seq = 0;
  private readonly onTruncated: ((limit: number) => void) | undefined;
  private truncationReported = false;

  constructor(root: string, layout: DeckLayout = DECK_LAYOUT, options: DeckStoreOptions = {}) {
    this.root = root;
    this.layout = layout;
    this.onTruncated = options.onTruncated;
  }

  /** Subdirectory where uploaded assets are placed. */
  get blobDir(): string {
    return this.layout.blobDir ?? ASSETS_DIR;
  }

  /** Runtime path → relative path in the directory; null for files this layout cannot read or write. */
  fileOf(runtimePath: string): string | null {
    if (!isProjectPath(runtimePath)) return null;
    const rel = runtimePath.slice('project/'.length);
    return this.layout.isFile(rel) ? rel : null;
  }

  /**
   * Disk path of a file in the deck directory (the file itself may not exist yet). null if any segment of the path is a symlink, or the name is not a regular file.
   */
  private async diskPath(rel: string): Promise<string | null> {
    const realRoot = await realpath(this.root).catch(() => null);
    if (realRoot === null) return null;
    const file = path.join(realRoot, ...rel.split('/'));
    // From the file's directory, go up to the first directory that exists; its real path must be itself
    for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
      const real = await realpath(dir).catch(() => null);
      if (real === null) continue;
      if (real !== dir) return null;
      break;
    }
    const info = await lstat(file).catch(() => null);
    return info && !info.isFile() ? null : file;
  }

  async listing(): Promise<FileListing> {
    const limit = this.layout.maxFiles ?? Number.POSITIVE_INFINITY;
    const { rels, truncated } = await collectFiles(this.root, this.layout, limit);
    if (truncated && !this.truncationReported) {
      this.truncationReported = true;
      this.onTruncated?.(limit);
    }
    const files: Record<string, ListingEntry> = {};
    for (const rel of rels.sort()) {
      const file = await this.diskPath(rel);
      if (file === null) continue;
      const bytes = await readFile(file).catch(() => null);
      if (bytes === null) continue;
      files[`project/${rel}`] = { sha256: sha256(bytes), size: bytes.length, contentType: contentTypeOf(rel) };
    }
    return { ver: versionOf(files), files };
  }

  async readProjectFile(p: string): Promise<Uint8Array | null> {
    const rel = this.fileOf(p);
    const file = rel === null ? null : await this.diskPath(rel);
    if (file === null) return null;
    try {
      return await readFile(file);
    } catch {
      return null;
    }
  }

  /** Runs serially, so there is no interleaving between the ifMatch check and the write. */
  publish(files: Record<string, WireEntry>): Promise<PublishOutcome> {
    const run = this.queue.then(() => this.publishNow(files));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async publishNow(batch: Record<string, WireEntry>): Promise<PublishOutcome> {
    const files = new Map<string, string>();
    let total = 0;
    const maxFileBytes = this.layout.maxFileBytes;
    for (const [p, entry] of Object.entries(batch)) {
      const rel = this.fileOf(p);
      const file = rel === null ? null : await this.diskPath(rel);
      if (file === null) {
        return { status: 400, body: { code: 'read_only_path', message: this.layout.readOnlyMessage(p) } };
      }
      files.set(p, file);
      if (!isWriteEntry(entry)) continue;
      const bytes = Buffer.byteLength(entry.base64, 'base64');
      if (maxFileBytes !== undefined && bytes > maxFileBytes) {
        return { status: 413, body: { code: 'too_large', message: `${p}: a file can be at most ${maxFileBytes} bytes` } };
      }
      total += bytes;
    }
    const maxBytes = this.layout.maxPublishBytes;
    if (maxBytes !== undefined && total > maxBytes) {
      return { status: 413, body: { code: 'too_large', message: `a publish can write at most ${maxBytes} bytes` } };
    }
    const before = await this.listing();
    const conflicts: ConflictPath[] = [];
    for (const [p, entry] of Object.entries(batch)) {
      const expected = entry?.ifMatch;
      // null requires the file to not exist yet: unlike "does not exist" null, an existing file is a conflict.
      if (expected === undefined) continue;
      const actual = before.files[p]?.sha256 ?? null;
      if (actual !== expected) conflicts.push({ path: p, actual, expected });
    }
    if (conflicts.length > 0) {
      return { status: 409, body: { code: 'conflict', live: before.ver, paths: conflicts } };
    }

    const shas: Record<string, Sha256> = {};
    for (const [p, entry] of Object.entries(batch)) {
      const file = files.get(p)!;
      if (!isWriteEntry(entry)) {
        this.ownWrites.set(p, '');
        await rm(file, { force: true });
        continue;
      }
      const bytes = Buffer.from(entry.base64, 'base64');
      const sha = sha256(bytes);
      // Register before writing: the fs.watch callback may arrive before the write returns
      this.ownWrites.set(p, sha);
      await writeFileAtomic(file, bytes);
      shas[p] = sha;
    }
    const after = await this.listing();
    this.seq += 1;
    return { status: 200, body: { version: after.ver, seq: this.seq, shas } };
  }

  private async assetIndex(): Promise<Record<string, string>> {
    try {
      const file = await this.diskPath(`${this.blobDir}/${ASSET_INDEX}`);
      if (file === null) return {};
      const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  /** Assets are content-addressed: the id is the first 32 hex characters of sha256, so the same image is stored once. */
  putBlob(bytes: Uint8Array, contentType: string): Promise<UploadResult> {
    // Shares the queue with publishing: the read-modify-write of index.json in the asset directory must not interleave
    const run = this.queue.then(() => this.putBlobNow(bytes, contentType));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async putBlobNow(bytes: Uint8Array, contentType: string): Promise<UploadResult> {
    const id = sha256(bytes).slice(0, 32);
    const type = contentType.split(';')[0]!.trim().toLowerCase() || 'application/octet-stream';
    const existing = await this.findBlobFile(id);
    if (existing === null) {
      const file = await this.diskPath(`${this.blobDir}/${id}.${assetExtensionOf(type)}`);
      if (file === null) throw new Error(`${this.blobDir} directory is not writable`);
      await writeFileAtomic(file, bytes);
    }
    const index = await this.assetIndex();
    const indexFile = await this.diskPath(`${this.blobDir}/${ASSET_INDEX}`);
    if (index[id] !== type && indexFile !== null) {
      index[id] = type;
      await writeFileAtomic(indexFile, Buffer.from(JSON.stringify(index, null, 2) + '\n'));
    }
    return { id, url: `/_blob/${id}`, sizeBytes: bytes.byteLength };
  }

  /** The file in the asset directory whose name starts with `<id>.`. */
  private async findBlobFile(id: string): Promise<string | null> {
    try {
      const name = (await readdir(path.join(this.root, this.blobDir))).find(n => n.startsWith(`${id}.`) && !n.endsWith('.tmp'));
      if (name === undefined) return null;
      const file = await this.diskPath(`${this.blobDir}/${name}`);
      return file !== null && (await lstat(file).catch(() => null))?.isFile() ? file : null;
    } catch {
      return null;
    }
  }

  async hasBlob(id: string): Promise<boolean> {
    return BLOB_ID_PATTERN.test(id) && (await this.findBlobFile(id)) !== null;
  }

  /** The asset's disk file and Content-Type (the route streams the file back). */
  async blobFile(id: string): Promise<{ file: string; contentType: string } | null> {
    if (!BLOB_ID_PATTERN.test(id)) return null;
    const file = await this.findBlobFile(id);
    if (file === null) return null;
    return { file, contentType: (await this.assetIndex())[id] ?? contentTypeOf(file) };
  }

  async getBlob(id: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const found = await this.blobFile(id);
    if (found === null) return null;
    try {
      return { bytes: await readFile(found.file), contentType: found.contentType };
    } catch {
      return null;
    }
  }

  /**
   * Among these runtime paths, which have current content not written by this process. `seen` is content the caller already knows (what was on disk when watching started, or what was already reported): content matching it does not count either. Checked paths are recorded at their current content.
   */
  async externalChanges(paths: Iterable<string>, seen?: Map<string, Sha256 | ''>): Promise<string[]> {
    const external: string[] = [];
    for (const p of paths) {
      const rel = this.fileOf(p);
      if (rel === null) continue;
      let sha = '';
      try {
        const file = await this.diskPath(rel);
        if (file !== null && (await lstat(file)).isFile()) sha = sha256(await readFile(file));
      } catch {
        sha = '';
      }
      if (this.ownWrites.get(p) !== sha && seen?.get(p) !== sha) external.push(p);
      seen?.set(p, sha);
    }
    return external;
  }
}

/** The version number is determined by the manifest content: same content, same version. */
export function versionOf(files: Record<string, ListingEntry>): string {
  const digest = sha256(
    Object.entries(files)
      .map(([p, f]) => `${p}:${f.sha256}`)
      .join('\n'),
  );
  return 'local-' + digest.slice(0, 16);
}

/** If any segment of a relative path reported by fs.watch starts with `.` (.swp files, sed's .!123!x.html, this module's temp files), it does not count as a deck change. */
export function isIgnoredWatchPath(rel: string): boolean {
  return rel.split('/').some(part => part.startsWith('.'));
}

/**
 * Watches the deck directory. When something other than the editor changes it (the agent edits a slide with file tools, or rewrites deck.json), the callback fires once after a 300 ms debounce.
 * A file the editor saved itself has a sha matching ownWrites and does not trigger it. Content identical to what it was when watching started does not trigger either (macOS FSEvents can report writes from shortly before watching started, e.g. a newly created deck). Only directories are watched: Linux's recursive fs.watch watches file inodes, and after an atomic save replaces a file, later changes to it would be lost.
 * Directory watches are rebuilt when directories are added or removed, and new and deleted files are identified by the full manifest.
 * Which directories are watched follows the storage layout (`DeckLayout.roots` and `descendInto`). A design canvas is the whole directory tree (excluding `assets/` and hidden directories); a design system is the whole directory tree (excluding `_blobs/` and hidden directories). The number of directories is capped by `maxFiles`.
 * Returns a function that stops watching.
 */
export function watchExternalEdits(store: DeckStore, onChange: (event: DeckChangeEvent) => void, onError: (error: unknown) => void = () => {}): () => void {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  const watchers = new Map<string, { watcher: FSWatcher; identity: string }>();
  let queue = Promise.resolve();
  const seen = store.listing().then(
    listing => new Map<string, Sha256 | ''>(Object.entries(listing.files).map(([p, f]) => [p, f.sha256])),
    () => new Map<string, Sha256 | ''>(),
  );
  const layout = store.layout;
  const maxDirectories = layout.maxFiles ?? Number.POSITIVE_INFINITY;
  const refresh = () => {
    const directories = new Map<string, string>();
    const visit = (rel: string, descend: boolean) => {
      if (directories.size >= maxDirectories) return;
      const dir = rel === '' ? store.root : path.join(store.root, ...rel.split('/'));
      if (directories.has(dir) || !existsSync(dir)) return;
      const info = lstatSync(dir);
      if (!info.isDirectory()) return;
      directories.set(dir, `${info.dev}:${info.ino}`);
      if (descend) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
          const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
          if (layout.descendInto?.(child) ?? true) visit(child, true);
        }
      }
    };
    for (const start of layout.roots) visit(start.rel, start.descend);
    for (const [dir, item] of watchers) {
      if (directories.get(dir) !== item.identity) {
        item.watcher.close();
        watchers.delete(dir);
      }
    }
    for (const [dir, identity] of directories) {
      if (watchers.has(dir)) continue;
      const watcher = watch(dir, (event, name) => {
        if (stopped) return;
        if (name) {
          const changed = path.join(dir, String(name));
          // On Linux, deleting and recreating a directory may reuse the inode. On receiving a rename of the parent directory, discard the old handle;
          // do not rely only on the dev/ino check in refresh. Subdirectory watches are also still bound to the deleted tree.
          if (event === 'rename' && watchers.has(changed)) {
            for (const [watchedDir, item] of watchers) {
              if (watchedDir === changed || watchedDir.startsWith(changed + path.sep)) {
                item.watcher.close();
                watchers.delete(watchedDir);
              }
            }
          }
          const rel = path.relative(store.root, changed).split(path.sep).join('/');
          if (isIgnoredWatchPath(rel) || !layout.watches(rel)) return;
        }
        clearTimeout(timer);
        timer = setTimeout(() => { queue = queue.then(flush); }, 300);
      });
      watcher.on('error', onError);
      watchers.set(dir, { watcher, identity });
    }
  };
  const flush = async () => {
    if (stopped) return;
    try {
      refresh();
      const known = await seen;
      const current = await store.listing();
      const external = await store.externalChanges(new Set([...known.keys(), ...Object.keys(current.files)]), known);
      if (stopped || external.length === 0) return;
      onChange({ type: 'external-change', paths: external, ver: (await store.listing()).ver });
    } catch (error) {
      onError(error);
    }
  };
  try {
    refresh();
  } catch (error) {
    onError(error);
  }
  return () => {
    stopped = true;
    clearTimeout(timer);
    for (const item of watchers.values()) item.watcher.close();
    watchers.clear();
  };
}
