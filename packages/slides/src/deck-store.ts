/**
 * deck 存储：把 Slides 运行时期望的宿主文件接口落到会话工作目录里的一份 deck 上（docs/design/slides §2）。
 *
 * 运行时看到的路径带 `project/` 前缀，磁盘上是 deck 目录里的同名文件：
 *   project/deck.json          ↔ <deck>/deck.json
 *   project/slides/<id>.html   ↔ <deck>/slides/<id>.html
 *   project/ds/**              ↔ <deck>/ds/**
 *   /_blob/<id>                ↔ <deck>/assets/<id>.<ext>（Content-Type 记在 assets/index.json）
 * 只有这几类文件进清单、可以读写；deck 目录里别的文件（智能体的草稿、素材原图）编辑器看不到也改不了。
 * 路径上有符号链接的一律当作不存在、不可写：符号链接可能指到 deck 目录外。
 *
 * 设计稿（docs/design/canvas §2.2）用同一个存储，只是文件布局不同：把 `DeckLayout` 换成 `@cuccut/design` 的布局，
 * 整个目录里的普通文件（不含 `assets/`、以点开头的与符号链接）都进清单。默认是 deck 的布局（`DECK_LAYOUT`）。
 * 设计系统（docs/design/canvas §10.1）的布局在 `@cuccut/design-system`：`assets/<组>/` 是内容，上传的素材放在
 * `DeckLayout.blobDir`（`_blobs/`），`/_blob/<id>` 从那里取。
 *
 * 读写的 HTTP 路由在 deck-routes.ts；协议类型见 file-protocol.ts。
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
 * 按扩展名给的 Content-Type（清单的 `contentType` 与 `project/*` 的响应头）。`project/*` 带 `nosniff`，所以页面要当
 * 子资源加载的类型都得列在这里：设计系统的预览用 `<script src>` 加载 `.js`（docs/design/canvas §10.4），类型不对时浏览器拒绝执行。
 * 取值同原版设计系统的 `FILE_MIME_TYPES_BY_EXTENSION`，另加 `mov`。
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

/** 素材文件的扩展名：按 Content-Type 取，认不出的存成 .bin。 */
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

/** deck 目录里放素材的子目录（`DeckLayout.blobDir` 的默认值）与它的类型索引。 */
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
 * 运行时路径 → deck 目录里的相对路径；不是可读写的那几类文件时返回 null。
 * `project/deck.json`、`project/slides/<名>.html`（只一层）、`project/ds/**`。
 */
export function deckFileOf(runtimePath: string): string | null {
  if (!isProjectPath(runtimePath)) return null;
  const rel = runtimePath.slice('project/'.length);
  return isDeckFile(rel) ? rel : null;
}

/** deck 目录里的相对路径（`/` 分隔）是否属于编辑器可见的文件。以点开头的段一律不算。 */
export function isDeckFile(rel: string): boolean {
  const parts = rel.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..' || part.startsWith('.'))) return false;
  if (rel === 'deck.json') return true;
  if (parts[0] === 'slides') return parts.length === 2 && parts[1]!.endsWith('.html');
  return parts[0] === 'ds' && parts.length > 1;
}

/**
 * 编辑器服务的文件布局：哪些文件进清单、可以读写，清单与监听从哪些目录开始。deck 用 `DECK_LAYOUT`；
 * 设计稿的布局在 `@cuccut/design`（canvas-layout.ts），设计系统的在 `@cuccut/design-system`，由 Runtime 交给 SlidesServer。
 * 以点开头的段与符号链接不论布局都不算；素材目录（`blobDir`）由存储自己管，布局不应把它算进来。
 */
export interface DeckLayout {
  /** 上传的素材放在哪个子目录（`<id>.<ext>` 与类型索引 `index.json`）。不给时是 `assets`。 */
  readonly blobDir?: string;
  /** 目录里的相对路径（`/` 分隔）是否属于编辑器可见、可写的文件。 */
  isFile(rel: string): boolean;
  /** 清单与监听从哪些目录开始（`''` 是根）；`descend` 时往下走子目录。 */
  readonly roots: readonly { readonly rel: string; readonly descend: boolean }[];
  /** 往下走时进不进这个子目录（相对路径）。不给时进所有不以点开头的。 */
  descendInto?(rel: string): boolean;
  /** 监听报上来这个相对路径变了时要不要重新比对清单：可见的文件，或可能装着它们的目录。 */
  watches(rel: string): boolean;
  /** 清单至多列几个文件；超出时只列遍历（按名字排序）到的前这么多个，并经 `onTruncated` 记一次。 */
  readonly maxFiles?: number;
  /** 一次发布里写入内容的合计上限（字节，解码后）。 */
  readonly maxPublishBytes?: number;
  /** 发布时单个文件的上限（字节，解码后）。 */
  readonly maxFileBytes?: number;
  /** 上传一个素材的上限（字节）；按 Content-Type 区分（例如 SVG 更小）。不给时只受路由的请求体上限约束。 */
  maxBlobBytes?(contentType: string): number;
  /** 发布到不可写的路径时给编辑器的说明。 */
  readOnlyMessage(runtimePath: string): string;
}

/** deck 的布局（docs/design/slides §2.2）：`deck.json`、`slides/*.html`（只一层）、`ds/**`。 */
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
  /** 清单第一次超出 `layout.maxFiles` 时调用（每个存储只调一次）。 */
  onTruncated?: (limit: number) => void;
}

/** publish 的结果，按 HTTP 状态区分成功和各类失败。 */
export type PublishOutcome =
  | { status: 200; body: PublishResult }
  | { status: 409; body: ConflictError }
  | { status: 400 | 413; body: GenericPublishError };

/** 按布局列出可见文件的相对路径（不跟随符号链接、跳过以点开头的）。目录按名字排序遍历，超过 `limit` 时停下。 */
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

/** 原子写：同目录下以点开头的临时文件（Space 与外部改动监听都跳过）写完再 rename。 */
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
  /** deck 目录（含 deck.json 的那一层），或设计稿目录（含 canvas.json 的那一层）。 */
  readonly root: string;
  readonly layout: DeckLayout;
  /** 本进程刚写过的文件（运行时路径）→ 写入时的 sha（删除记为 ""），用来区分「编辑器自己保存」和「外部改动」。 */
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

  /** 上传素材所在的子目录。 */
  get blobDir(): string {
    return this.layout.blobDir ?? ASSETS_DIR;
  }

  /** 运行时路径 → 目录里的相对路径；不是这个布局可读写的文件时 null。 */
  fileOf(runtimePath: string): string | null {
    if (!isProjectPath(runtimePath)) return null;
    const rel = runtimePath.slice('project/'.length);
    return this.layout.isFile(rel) ? rel : null;
  }

  /**
   * deck 目录里一个文件的磁盘路径（文件本身可以还不存在）。路径上任何一段是符号链接、或这个名字不是普通文件时 null。
   */
  private async diskPath(rel: string): Promise<string | null> {
    const realRoot = await realpath(this.root).catch(() => null);
    if (realRoot === null) return null;
    const file = path.join(realRoot, ...rel.split('/'));
    // 从文件所在目录往上找到第一个存在的目录，它的真实路径必须就是它自己
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

  /** 串行执行，保证 ifMatch 检查和写入之间没有交错。 */
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
      // null 要求文件还不存在：与「不存在」的 null 相比，已经有了就冲突。
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
      // 先登记再写：fs.watch 的回调可能在写入返回前就到
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

  /** 素材按内容寻址：id 是 sha256 的前 32 位，同一张图只存一份。 */
  putBlob(bytes: Uint8Array, contentType: string): Promise<UploadResult> {
    // 与发布共用队列：素材目录里 index.json 的读改写不能交错
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

  /** 素材目录里以 `<id>.` 开头的那个文件。 */
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

  /** 素材的磁盘文件与 Content-Type（路由按文件流式返回）。 */
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
   * 这些运行时路径里，哪些的当前内容不是本进程写进去的。`seen` 是调用方已经知道的内容（开始监听时盘上的、报过的）：
   * 与它一致的也不算；查过的路径记成当前内容。
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

/** 版本号由清单内容决定：内容不变，版本不变。 */
export function versionOf(files: Record<string, ListingEntry>): string {
  const digest = sha256(
    Object.entries(files)
      .map(([p, f]) => `${p}:${f.sha256}`)
      .join('\n'),
  );
  return 'local-' + digest.slice(0, 16);
}

/** fs.watch 报上来的相对路径里，任何一段以 . 开头（.swp、sed 的 .!123!x.html、本模块的临时文件）都不算 deck 改动。 */
export function isIgnoredWatchPath(rel: string): boolean {
  return rel.split('/').some(part => part.startsWith('.'));
}

/**
 * 监听 deck 目录：被编辑器以外的东西改了（智能体用文件工具改 slide、重写 deck.json），去抖 300 ms 后
 * 回调一次。编辑器自己保存的文件 sha 与 ownWrites 一致，不触发；内容与开始监听时一样的也不触发（macOS 的 FSEvents
 * 会补报监听开始前不久的写入，比如刚建好的 deck）。只监听目录：Linux 的递归 fs.watch 会监听文件 inode，
 * 原子保存替换文件后会丢掉后续修改。目录增删时重建目录监听，并按完整清单识别新增与删除。返回停止监听的函数。
 * 监听哪些目录按存储的布局（`DeckLayout.roots` 与 `descendInto`）；设计稿是整棵目录树（不含 `assets/` 与隐藏目录），
 * 设计系统是整棵目录树（不含 `_blobs/` 与隐藏目录），目录数按 `maxFiles` 封顶。
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
          // Linux 删除重建目录时可能复用 inode；收到父目录的 rename 就废弃旧 handle，
          // 不能只靠 refresh 的 dev/ino 判断。子目录的监听也仍绑定在被删除的树上。
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
