/**
 * File protocol between the host shim in the editor page (editor/editor-host.ts) and the runtime's slide routes (deck-routes.ts)
 * (docs/design/slides §2.2, §6).
 *
 * The shapes follow how the Slides runtime actually reads and writes (files/browser-port.ts, documents/self-publish.ts,
 * media/assets.ts in the runtime). Both ends share this one definition, so they do not each write their own and quietly drift apart. Paths are as the runtime sees them (`project/…`);
 * the conversion to the on-disk format (deck.json, slides/, assets/ in the deck directory) is in deck-store.ts.
 */

/** SHA-256 as 64 lowercase hex digits. The runtime only accepts ifMatch in this format (FILE_SHA256_PATTERN). */
export type Sha256 = string;

/** Asset id as 32 hex digits; references are written as `/_blob/<id>`. */
export type BlobId = string;

export const BLOB_ID_PATTERN = /^[0-9a-f]{32}$/;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** The deck's source files are all under project/; only these paths may be written. */
export type ProjectPath = `project/${string}`;

// ---------- Read: GET _files.json ----------

export interface ListingEntry {
  sha256: Sha256;
  size: number;
  contentType: string;
}

export interface FileListing {
  /** Current version number; it changes whenever any file changes. */
  ver: string;
  files: Record<string, ListingEntry>;
}

// ---------- Write: slidesHost.artifact.publish(batch) ----------

/**
 * Writes one file. ifMatch is the sha the caller read; if it does not match what is on disk, the whole batch is rejected (conflict). When null, the file must not exist yet (the editor passes this when creating a new file); if it already exists, that is also a conflict.
 */
export interface PublishWrite {
  content: string | Blob;
  contentType: string;
  ifMatch?: Sha256 | null;
}

/** Deletes one file; when ifMatch is given, the same concurrency check is done. */
export interface PublishDelete {
  delete: true;
  ifMatch?: Sha256;
}

/** A value of null means delete without any check. */
export type PublishEntry = PublishWrite | PublishDelete | null;

export type PublishBatch = Record<string, PublishEntry>;

export interface PublishResult {
  version: string;
  seq?: number;
  /** The sha of each file after writing; the runtime uses this to tell whether the host supports deletes with ifMatch. */
  shas?: Record<string, Sha256>;
  changed?: { path: string; sha256: Sha256 }[];
  unchanged?: boolean;
}

/** Publish error codes the runtime recognizes (SELF_PUBLISH_ERROR_CODE_SET in documents/self-publish.ts). */
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
  /** The current sha; null when the file does not exist. */
  actual: Sha256 | null;
  /** The ifMatch the caller supplied; null means the file must not exist. */
  expected: Sha256 | null;
}

export interface ConflictError {
  code: 'conflict';
  /** The latest version on conflict; the runtime re-reads based on it and then merges. */
  live: string;
  paths: ConflictPath[];
  message?: string;
}

export interface GenericPublishError {
  code: Exclude<PublishErrorCode, 'conflict'>;
  message: string;
}

/** The value thrown when publish fails (not an Error instance; the runtime identifies it by its code field). */
export type PublishError = ConflictError | GenericPublishError;

export function isPublishError(value: unknown): value is PublishError {
  return typeof value === 'object' && value !== null && typeof (value as { code?: unknown }).code === 'string';
}

// ---------- Assets: slidesHost.assets.upload(file) ----------

export interface UploadOptions {
  type?: string;
}

export interface UploadResult {
  id: BlobId;
  /** `/_blob/<id>`; the runtime writes it as-is into <img src>. */
  url: string;
  sizeBytes?: number;
}

// ---------- HTTP form on the dev server: POST /__deck/publish ----------

/** HTTP cannot upload a Blob, so content is converted to base64. */
export interface WireWrite {
  base64: string;
  contentType: string;
  ifMatch?: Sha256 | null;
}

export type WireEntry = WireWrite | PublishDelete | null;

export interface WirePublishRequest {
  files: Record<string, WireEntry>;
}

/** Relative routes under the editor page (relative to `/slides/<grant>/`). Assets' `/_blob/<id>` is a root-level route and is not here. */
export const DECK_ROUTES = {
  listing: '_files.json',
  publish: '__deck/publish',
  assets: '__deck/assets',
  /** Event stream for external changes (SSE); see deck-routes.ts. */
  events: '__deck/events',
  /** Permissions for this open: `{ canEdit }`. */
  session: '__deck/session',
} as const;

/** Event pushed by `__deck/events`: something other than the editor changed the deck directory; `paths` are the paths as the runtime sees them. */
export interface DeckChangeEvent {
  type: 'external-change';
  paths: string[];
  /** Manifest version after the change. */
  ver: string;
}

export function isProjectPath(p: string): p is ProjectPath {
  if (!p.startsWith('project/') || p.includes('\\') || p.includes('\0')) return false;
  return p.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export function isWriteEntry<T extends PublishWrite | WireWrite>(entry: T | PublishDelete | null): entry is T {
  return entry !== null && !('delete' in entry);
}
