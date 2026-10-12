/**
 * 编辑器页面里的宿主 shim（editor/editor-host.ts）与 Runtime 的幻灯片路由（deck-routes.ts）之间的文件协议
 * （docs/design/slides §2.2、§6）。
 *
 * 形状照 Slides 运行时的实际读写方式来定（运行时的 files/browser-port.ts、documents/self-publish.ts、
 * media/assets.ts），两端共用这一份，避免各写一套后悄悄跑偏。路径是运行时看到的样子（`project/…`），
 * 与磁盘格式（deck 目录里的 deck.json、slides/、assets/）的换算在 deck-store.ts。
 */

/** 小写 64 位 hex 的 SHA-256。运行时只认这种格式的 ifMatch（FILE_SHA256_PATTERN）。 */
export type Sha256 = string;

/** 32 位 hex 的素材 id，引用写成 `/_blob/<id>`。 */
export type BlobId = string;

export const BLOB_ID_PATTERN = /^[0-9a-f]{32}$/;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** deck 的源文件都在 project/ 下；只有这些路径可以写。 */
export type ProjectPath = `project/${string}`;

// ---------- 读取：GET _files.json ----------

export interface ListingEntry {
  sha256: Sha256;
  size: number;
  contentType: string;
}

export interface FileListing {
  /** 当前版本号；任何文件变化都会让它变。 */
  ver: string;
  files: Record<string, ListingEntry>;
}

// ---------- 写入：slidesHost.artifact.publish(batch) ----------

/**
 * 写一个文件。ifMatch 是调用方读到的 sha，和磁盘上不一致就整批拒绝（conflict）；为 null 时要求文件还不存在
 * （编辑器新建文件时这样传），已经有了同样是 conflict。
 */
export interface PublishWrite {
  content: string | Blob;
  contentType: string;
  ifMatch?: Sha256 | null;
}

/** 删除一个文件；带 ifMatch 时同样做并发检查。 */
export interface PublishDelete {
  delete: true;
  ifMatch?: Sha256;
}

/** 值为 null 表示不带检查地删除。 */
export type PublishEntry = PublishWrite | PublishDelete | null;

export type PublishBatch = Record<string, PublishEntry>;

export interface PublishResult {
  version: string;
  seq?: number;
  /** 写入后每个文件的 sha；运行时据此判断宿主支持带 ifMatch 的删除。 */
  shas?: Record<string, Sha256>;
  changed?: { path: string; sha256: Sha256 }[];
  unchanged?: boolean;
}

/** 运行时认识的发布错误码（documents/self-publish.ts 的 SELF_PUBLISH_ERROR_CODE_SET）。 */
export type PublishErrorCode =
  | 'conflict'
  | 'not_writer'
  | 'not_declared'
  | 'too_large'
  | 'invalid_content'
  | 'read_only_path'
  | 'rate_limited'
  | 'consent_required'
  | 'upstream_error'
  | 'not_granted'
  | 'capability_disabled'
  | 'capability_removed'
  | 'transform_error';

export interface ConflictPath {
  path: string;
  /** 现在的 sha；文件不存在时为 null。 */
  actual: Sha256 | null;
  /** 调用方给的 ifMatch；null 表示要求文件不存在。 */
  expected: Sha256 | null;
}

export interface ConflictError {
  code: 'conflict';
  /** 冲突时的最新版本，运行时会据此重新读取再合并。 */
  live: string;
  paths: ConflictPath[];
  message?: string;
}

export interface GenericPublishError {
  code: Exclude<PublishErrorCode, 'conflict'>;
  message: string;
}

/** publish 失败时抛出的值（不是 Error 实例，运行时按 code 字段识别）。 */
export type PublishError = ConflictError | GenericPublishError;

export function isPublishError(value: unknown): value is PublishError {
  return typeof value === 'object' && value !== null && typeof (value as { code?: unknown }).code === 'string';
}

// ---------- 素材：slidesHost.assets.upload(file) ----------

export interface UploadOptions {
  type?: string;
}

export interface UploadResult {
  id: BlobId;
  /** `/_blob/<id>`；运行时把它原样写进 <img src>。 */
  url: string;
  sizeBytes?: number;
}

// ---------- 开发服务器的 HTTP 形式：POST /__deck/publish ----------

/** HTTP 上传不了 Blob，内容转成 base64。 */
export interface WireWrite {
  base64: string;
  contentType: string;
  ifMatch?: Sha256 | null;
}

export type WireEntry = WireWrite | PublishDelete | null;

export interface WirePublishRequest {
  files: Record<string, WireEntry>;
}

/** 编辑器页面下的相对路由（相对 `/slides/<grant>/`）。素材的 `/_blob/<id>` 是根级路由，不在这里。 */
export const DECK_ROUTES = {
  listing: '_files.json',
  publish: '__deck/publish',
  assets: '__deck/assets',
  /** 外部改动的事件流（SSE），见 deck-routes.ts。 */
  events: '__deck/events',
  /** 这次打开的权限：`{ canEdit }`。 */
  session: '__deck/session',
} as const;

/** `__deck/events` 推送的事件：deck 目录被编辑器以外的东西改了，`paths` 是运行时看到的路径。 */
export interface DeckChangeEvent {
  type: 'external-change';
  paths: string[];
  /** 改动后的清单版本。 */
  ver: string;
}

export function isProjectPath(p: string): p is ProjectPath {
  if (!p.startsWith('project/') || p.includes('\\') || p.includes('\0')) return false;
  return p.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export function isWriteEntry<T extends PublishWrite | WireWrite>(entry: T | PublishDelete | null): entry is T {
  return entry !== null && !('delete' in entry);
}
