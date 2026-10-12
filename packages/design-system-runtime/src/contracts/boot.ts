import type * as Model from "../contracts";
import type * as Host from "./platform-host";
import type * as Storage from "./model-storage";
export type HealthReport = [name: string, value?: unknown, context?: unknown];
export interface NativeAuthoritySnapshot {
  metadata?: { fromCache?: boolean; hasPendingWrites?: boolean };
}
export interface NativeLegacyDocumentSnapshot extends NativeAuthoritySnapshot {
  id: string;
  exists: boolean;
  data(): Storage.DatabaseRecord | undefined;
}
export interface NativeLegacyQuerySnapshot
  extends NativeAuthoritySnapshot,
    Storage.DatabaseQuerySnapshot {
  docs: NativeLegacyDocumentSnapshot[];
}
export interface NativeLegacyQuery {
  limit(count: number): NativeLegacyQuery;
  get(): Promise<NativeLegacyQuerySnapshot>;
  onSnapshot(
    listener: (snapshot: NativeLegacyQuerySnapshot) => void,
    onError: (error: unknown) => void,
  ): () => void;
}
export interface NativeLegacyDocument {
  get(): Promise<NativeLegacyDocumentSnapshot>;
  update(value: Storage.DatabaseRecord): Promise<unknown>;
  set(value: Storage.DatabaseRecord): Promise<unknown>;
  delete(): Promise<unknown>;
  acquire?(options: {
    holder: string;
    ttlMs: number;
  }): Promise<{ acquired?: unknown; expiresAt?: unknown }>;
}
export interface NativeLegacyDatabase {
  collection(path: string): NativeLegacyQuery;
  doc(path: string): NativeLegacyDocument;
}
export type MetaOutcome =
  | { state: "present"; meta?: unknown }
  | { state: "absent"; meta?: undefined }
  | { state: "unavailable"; fault: string; meta?: undefined };
export type TimerPair = Pick<Host.TimerPort, "setTimeout" | "clearTimeout">;
export interface MetaReadOptions {
  handle?: NativeLegacyDatabase | null;
  port: Storage.DatabasePort;
}
export type FileHomeKind =
  | "absent"
  | "marked"
  | "envelope"
  | "unmarked"
  | "unread"
  | "other";
export interface FileHomes {
  project: FileHomeKind;
  root: FileHomeKind;
  projectText?: string;
  rootText?: string;
  sameText?: boolean;
}
export interface FileHomeDecision {
  at: "none" | "root" | "project";
  ignoredRoot: boolean;
  ignoredSingleFile: boolean;
  strayRoot: boolean;
  twoIndexes: boolean;
  unread: boolean;
  asGoodAsMissing: boolean;
}
export interface BootModeOptions {
  typePage: boolean;
  origin: string;
  ownLayout: string;
  stateFileFound?: boolean;
  storeAbsent: boolean;
  forcedReadOnly: boolean;
  emulator: boolean;
  mayStartOnFiles(): Promise<boolean>;
}
export interface TreeBootOptions {
  project: FileHomeKind;
  origin: string;
  tree: boolean;
  pipeline: boolean;
  editingOff: boolean;
}
export interface TreeBootOutcome {
  boot: "readonly" | "tree" | "failed" | "empty";
  reason?: string;
  readOnly?: string;
}
export interface MayInitializeOptions {
  canReopen: boolean;
  automation: boolean;
  pipeline: boolean;
  switchOn(): Promise<boolean>;
  canWrite(): Promise<boolean>;
}
export interface MayMigrateOptions extends MayInitializeOptions {
  typeHost: boolean;
  lastChange: unknown;
  skipped: boolean;
}
export type MigrationExit = "landed" | "busy" | "restart" | "reload";
export interface MigrationBootExit {
  end: MigrationExit;
  notice?: string;
}
export interface MigrationOutcome {
  result: string;
  reason?: string;
  code?: string;
  stage?: string;
  ms?: number;
}
export interface CompleteMigrationOptions extends MigrationBootExit {
  waitForTheirs(): void;
  skip(): void;
  carryNotice(notice: string): void;
  restart(): void;
  reload(): void;
}
export interface RestartFallback {
  restart?: (options: { note: string }) => void;
  note: string;
  watchdogMs: number;
  setTimeout(callback: () => void, delay: number): unknown;
  ask(): void;
}
export interface EditingHold {
  held(): boolean;
  hold(message: string): void;
  release(): void;
}
export interface ReopenNote {
  why: string;
  at: number;
  focus?: string;
}
export interface AnnounceReopenOptions {
  timers: Host.TimerPort;
  say(message: string): void;
  message: string;
  leadMs?: number;
  maxHoldMs?: number;
  isTyping?(): boolean;
  hasUnsentEdits?(): boolean;
  reopen(): void;
  note?: {
    store: Pick<globalThis.Storage, "setItem"> | null | undefined;
    why: string;
    focus?: string;
  };
}
export interface AnnounceReopenedOptions {
  store?: Pick<globalThis.Storage, "getItem" | "removeItem"> | null;
  now: number;
  focus(id?: string): void;
  say(message: string): void;
  message(note: ReopenNote): string;
}
export interface InitializeStoreOptions {
  files: Model.BrowserFilesPort;
  indexPath: string;
  timers?: Model.FilesTimers;
  otherHome?(): Promise<"absent" | "content" | "unreadable">;
  storeUntouched(): Promise<boolean>;
  emptyIndex(): Model.FilesIndex;
  serializeIndex(index: Model.FilesIndex): string;
  at: string;
  rootHoldsContent?(value: unknown): boolean;
  mark?: {
    type: string;
    store: Model.FilesMigrationStore;
    metaPath: string;
    artifactId?: string;
  };
}
export type InitializeStoreResult =
  | { result: "created"; version: string }
  | { result: "skipped"; reason: string }
  | { result: "failed"; code: string };
export interface LegacyFailure {
  fail: string;
  at: "fetch" | "read";
  missing: boolean;
  answered: boolean;
  status?: number;
}
export interface LegacyFailureConstructor {
  new (
    fail: string,
    at: LegacyFailure["at"],
    missing?: boolean,
    answered?: boolean,
    status?: number,
  ): LegacyFailure;
}
export interface RawEnvelope extends Storage.RawDocumentSeed {
  [field: string]: unknown;
}
export interface LegacyReadSuccess {
  envelope: RawEnvelope;
  note?: string;
}
export type LegacyReadAnswer = LegacyReadSuccess | LegacyFailure;
export type LegacyAnswerKind = "accepted" | "missing" | "refused" | "unread";
export type LegacyInitialState = {
  state: RawEnvelope;
  note?: string;
  stateFileAt?: string;
  stateFileAnswers?: Record<string, LegacyAnswerKind>;
  stateFileFound?: boolean;
  error?: string;
  errorAt?: "fetch" | "read";
} & ({ origin: "instance" } | { origin: "demo" } | { origin: "failed" });
export interface LegacyReadOptions {
  fetch?(url: string): Promise<Pick<Response, "ok" | "status" | "text">>;
  stateFiles?: string[];
  stateFile?: string;
  read(text: string, path: string): LegacyReadSuccess | string;
  mayWrite?(): Promise<boolean | null | undefined>;
  wait?(delay: number): Promise<void>;
  refusedWaits?: number[];
  demoFile: string;
  onOwn?(
    state: RawEnvelope | "missing" | "unreadable",
    answers: Record<string, LegacyAnswerKind>,
  ): void;
}
export type BootFailureClass =
  | "newer_build"
  | "damaged_index"
  | "access_revoked"
  | "no_index"
  | "transient";
export interface BootReadException extends Error {
  code: "access_revoked" | "no_index" | "unreadable";
  path: string;
  status?: number;
  narrowed?: boolean;
}
export interface BootReadConstructor {
  new (
    code: BootReadException["code"],
    path: string,
    message: string,
    status?: number,
    narrowed?: boolean,
  ): BootReadException;
}
export interface BootReadEvent {
  type: string;
  path?: string;
  from?: string;
  to?: string;
  attempt?: number;
  status?: number;
  waitMs?: number;
  reason?: string;
}
export interface BootReaderOptions {
  port: Model.BrowserFilesPort;
  indexPath: string;
  waits?: number[];
  wants?(row: Model.FileListingRow): boolean;
  timers?: Pick<Host.TimerPort, "setTimeout">;
  early?: Host.HotReloadBridge;
  maxPasses?: number;
  mayWrite?: boolean;
  onEvent?(event: BootReadEvent): void;
}
export interface BootReadResult {
  version: Model.FileVersion;
  listing: Model.FileListing;
  index: Model.FileTextRead;
  files: Map<string, Model.FileTextRead>;
  retries: number;
  passes: number;
  narrowed?: boolean;
}
export interface ThumbnailLoadDocument {
  loadState(): string;
  subscribeLoad(listener: () => void): () => void;
}
export interface ThumbnailOptions {
  document?: Document;
  whenPainted?(): PromiseLike<unknown>;
}
export interface CoverCaptureReader {
  text(path: string): Promise<string | null>;
  bytes(path: string): Promise<Uint8Array | null>;
}
export interface CoverFontLimits {
  bytes: number;
  files: number;
  deadlineMs: number;
}
export interface CapturedCover {
  system: Model.ParsedDesignSystem;
  fonts: string[];
}
export interface StuckSave {
  stashed?: boolean;
  file?: string;
  code: string;
  nextRetryAt?: number;
}
export interface UnsavedFile {
  path: string;
  why: string;
}
export type MigrationPreflight =
  | null
  | "not_single_file"
  | "not_now"
  | "too_large"
  | "moved_before"
  | { unpublishable: { path: string }[] };
export interface FoldKeptFile {
  path: string;
  why: string;
}
export type ActiveDocument = Host.ArtifactDocument<Model.DesignSystemContent> &
  Partial<
    Pick<
      import("./design-system-document").DesignSystemFilesDocument,
      "flushNow"
    >
  >;
