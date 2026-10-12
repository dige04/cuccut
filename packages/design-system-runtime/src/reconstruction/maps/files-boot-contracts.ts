/** Contracts recovered from the file publisher, migration and crash recovery code. */
export type FileSha = string;
export type FileVersion = { version: string; seq?: number };
export type FileContents = string | Blob;
export type FilePublishInput =
  | FileContents
  | { content: FileContents; contentType: string }
  | null;
export interface FileListingRow {
  path: string;
  sha256: FileSha;
  size: number;
  contentType: string;
  provisional?: boolean;
}
export type FileListing = FileListingRow[] & { readonly narrowed?: boolean };
export type FilePublishEntries = Record<string, FilePublishInput>;
export interface FilePublishPreconditions {
  ifMatch?: Record<string, FileSha | null>;
}
export interface ChangedFileRow {
  path: string;
  sha256: FileSha | null;
}
export interface FileRemoteChange {
  from: FileVersion;
  to: FileVersion;
  changed: ChangedFileRow[];
}
export interface FilePublishSuccess {
  ok: true;
  version: string;
  seq?: number;
  shas?: Record<string, FileSha>;
  computed?: string[];
  changed?: ChangedFileRow[];
  unchanged?: boolean;
  preconditionsChecked?: boolean;
  unguarded?: string[];
}
export type FilePublishFailureCode =
  | "conflict"
  | "rate_limited"
  | "too_large"
  | "not_writer"
  | "not_declared"
  | "invalid_content"
  | "read_only_path"
  | "capability_disabled"
  | "upstream_error"
  | "index_newer_build"
  | "index_damaged";
export interface FilePublishFailure {
  ok: false;
  code: FilePublishFailureCode;
  live?: string;
  retryAfterMs?: number;
  paths?: {
    path: string;
    liveSha: FileSha | null;
    expected?: FileSha | null;
  }[];
  changed?: ChangedFileRow[];
}
export type FilePublishResult = FilePublishSuccess | FilePublishFailure;
export interface FileBytesRead {
  bytes: Uint8Array;
  sha256: FileSha;
  contentType: string;
}
export interface FileTextRead {
  text: string;
  sha256: FileSha;
}
export interface BrowserFilesPort {
  readonly canWrite: boolean;
  readonly mayWrite?: boolean;
  readonly narrowed?: boolean;
  version(): FileVersion;
  list(): Promise<FileListing>;
  readBytes(path: string): Promise<FileBytesRead>;
  readText(path: string): Promise<FileTextRead>;
  publish(
    entries: FilePublishEntries,
    options?: FilePublishPreconditions,
  ): Promise<FilePublishResult>;
  onRemoteChange(listener: (change: FileRemoteChange) => void): () => void;
  listUnlessNarrowed?(): Promise<FileListing>;
  forgetBootListing?(): void;
  readTextUnchecked?(path: string): Promise<FileTextRead>;
  heldSha?(path: string): FileSha | null | undefined;
  liveSha?(path: string): FileSha | null | undefined;
  knownListing?(): Map<string, FileSha>;
  primeRead?(path: string, read: FileBytesRead): void;
  noteIncoming?(rows: ChangedFileRow[]): void;
  noteAdopted?(to: FileVersion, from?: FileVersion): void;
  noteRemote?(change: FileRemoteChange): void;
  wroteSinceAdopt?(path: string): boolean;
  olderThanMyWrite?(version: string, path: string): boolean;
}
export interface FilesTimers {
  now(): number;
  setTimeout(
    callback: () => void,
    milliseconds: number,
  ): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
  random?(): number;
}
export interface FilesMigrationAllowlistEntry {
  collection: string;
  docId?: string;
}
export interface FilesMigrationStoreDocument {
  path: string;
  data: Record<string, unknown>;
}
export interface FilesMigrationStore {
  list(collection: string): Promise<FilesMigrationStoreDocument[]>;
  get(path: string): Promise<FilesMigrationStoreDocument | null>;
  update(path: string, data: Record<string, unknown>): Promise<void>;
  set?(path: string, data: Record<string, unknown>): Promise<void>;
  acquire(
    path: string,
    options: { holder: string; ttlMs: number },
  ): Promise<"unsupported" | { acquired: boolean; expiresAt?: string }>;
  watch?(collection: string, changed: (paths?: string[]) => void): () => void;
}
export interface MigrationFileWitness {
  sha256: FileSha;
  from: string[];
  of: Record<string, string>;
}
export interface FilesMigrationSentinel {
  v: 1 | 2;
  vouching?: number;
  type: string;
  at: string;
  artifact?: string;
  documents: Record<string, string>;
  fields?: Record<string, Record<string, string>>;
  files: Record<string, MigrationFileWitness>;
  indexSources?: Record<string, string>;
  kept?: Record<string, { sha256: string }>;
  dropping?: { at: string; documents?: string[]; stamp?: string };
  dropped?: { at: string; documents?: string[]; stamp?: string };
}
export interface StashedFileEdit {
  path: string;
  text: string | null;
  base: FileSha | null;
}
export interface CrashStashEntry {
  key: string;
  artifactId: string;
  viewerId: string;
  tabId: string;
  createdAt: number;
  at: number;
  version: string;
  edits: StashedFileEdit[];
  chars: number;
}
export interface CrashStashStorage {
  all(): Promise<CrashStashEntry[]>;
  put(entry: CrashStashEntry): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface FilesCrashStash {
  put(edits: StashedFileEdit[], version: string): Promise<boolean>;
  read(): Promise<
    Pick<CrashStashEntry, "createdAt" | "at" | "version" | "edits"> | undefined
  >;
  clear(): Promise<void>;
  clearOffered(): Promise<void>;
  clearArtifact(): Promise<void>;
  purgeOtherViewers(): Promise<void>;
}
