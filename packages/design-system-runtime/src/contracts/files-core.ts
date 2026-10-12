import type { HotFileChange, HotEvent } from "./platform-host";
/** File persistence contracts recovered from version checks, merge branches and storage ports. */
import type { ArtifactDocument } from "./platform-host";
import type { ChangedFileRow } from "../contracts";
import type {
  FileKind,
  FilesIndex,
  FileListingRow,
  FileContents,
  FilePublishInput,
  FilePublishFailure,
  FileTable,
  FilesCrashStash,
  StashedFileEdit,
  BrowserFilesPort,
  FilesTimers,
} from "../contracts";
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonMergeValue[]
  | JsonRecord;
export interface JsonRecord {
  [key: string]: JsonValue | undefined;
}
export type JsonMergeValue = JsonValue | undefined;
export type MergeChoice = "mine" | "theirs";
export type MergeSchema =
  | { kind: "leaf" }
  | { kind: "list"; membersOf?: string }
  | { kind: "records"; by: string }
  | { kind: "map"; keys?: Record<string, MergeSchema>; of?: MergeSchema };
export interface JsonMergeResult {
  value: JsonMergeValue;
  conflicts: string[];
}
export type TokenMergeResult =
  | { ok: true; text: string; kept: string[] }
  | { ok: false; why: "unreadable" | "conflict"; conflicts: string[] };
export interface LazyReadState {
  rows: Map<string, FileListingRow>;
  lastDoc?: string;
}
export interface FileData {
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
}
export interface NormalizedFilePublishInput {
  content: FileContents;
  contentType: string;
}
export interface FilePublishRejection {
  why: string;
  cause: "name" | "kind" | "unreadable" | "damaged_text";
}
export interface FileVersionCaps {
  files: number;
  bytes: number;
}
export interface CarriedFileEdit {
  text: string;
  base?: string | null;
  baseText?: string;
}
export interface CarriedView {
  v: 1;
  section?: string;
  flagged?: string[];
}
export type CarriedFilesIndex = Omit<FilesIndex, "title" | "docs"> &
  Partial<Pick<FilesIndex, "title" | "docs">>;
export interface CarriedIndexEdit {
  base: CarriedFilesIndex;
  mine: CarriedFilesIndex;
}
export interface CarrySnapshot {
  mine?: Record<string, CarriedFileEdit>;
  owe?: Record<string, CarriedFileEdit>;
  index?: CarriedIndexEdit;
  view?: CarriedView;
}
export interface CarryViewInput {
  section?: unknown;
  flagged?: unknown;
}
export interface FileIndexDelta {
  from: Partial<FilesIndex>;
  to: Partial<FilesIndex>;
}
export interface IndexMergeNotice {
  conflicts: string[];
  mine: FilesIndex;
  base: FilesIndex;
  merged: FilesIndex;
}
export interface IndexPresentationPatch {
  sections?: Record<string, string | undefined>;
  assetGroups?: Record<
    string,
    { tile: FilesIndex["assetGroups"][string]["tile"] }
  >;
}
export interface IndexPresentationDelta {
  from: IndexPresentationPatch;
  to: IndexPresentationPatch;
}
export interface FileMergeOptions {
  excluded?: ReadonlySet<string>;
  stale?(path: string): boolean;
  merge?(
    path: string,
    base: string,
    theirs: string,
    mine: string,
  ): string | null;
  theirIndex?: (FileIndexDelta | IndexPresentationDelta)[];
  earlierSide?: "from" | "to";
}
export interface FileMergeResult {
  next: FileTable;
  viaIndex: boolean;
  files: string[];
  localOnly: string[];
  skipped: string[];
  index: boolean;
  indexKept: string[];
  empty: boolean;
}
export interface FileDocumentState<Content = { files: FileTable }> {
  title: string;
  content: Content;
  comments: import("./platform-host").ArtifactComment[];
}
export interface FileCodec<Index, Content> {
  indexPath: string;
  type: FileArtifactType;
  schema: MergeSchema;
  emptyIndex(): Index;
  wants?(row: FileListingRow): boolean;
  indexOf(state: FileDocumentState<Content>, before?: Index): Index;
  filesOf(state: FileDocumentState<Content>): Map<string, string>;
  compose(
    index: Index,
    files: Map<string, string>,
  ): { title: string; content: Content };
  externalMembers?(
    path: string,
    files: Map<string, string>,
  ): ReadonlySet<string>;
}
export type DesignFilesCodec = FileCodec<
  FilesIndex,
  import("../contracts").DesignSystemContent
>;
export interface FilePeer {
  tab: string;
  editing: boolean;
  at: number;
}
export interface FilesPeerSource {
  getSnapshot(): FilePeer[];
  subscribe(listener: () => void): () => void;
}
export interface FileRetryError {
  status?: number;
  code?: string;
  name?: string;
  message?: string;
}
export interface CrashStashStorageRaw {
  all(): Promise<unknown[]>;
  put(entry: import("../contracts").CrashStashEntry): Promise<void>;
  delete(key: string): Promise<void>;
}
export type CrashStashOffer = Awaited<ReturnType<FilesCrashStash["read"]>>;
export type FilesRuntimeTimers = FilesTimers;

export interface MergeDocumentOptions {
  conflicts?: string[];
  externalMembers?(
    path: string,
  ): ReadonlySet<string> | readonly string[] | undefined;
}
export type IndexFileErrorCode = "unreadable" | "newer_version" | "not_found";
export interface IndexFileException extends Error {
  code: IndexFileErrorCode;
}
export interface IndexFileErrorConstructor {
  new (code: IndexFileErrorCode, message: string): IndexFileException;
}
export type IndexStoreBinder = (
  path: string,
  read: () => string,
  base: string | null,
) => void;
export interface IndexFileStoreOptions<Index extends { v: number }> {
  empty(): Index;
  path: string;
  port: BrowserFilesPort;
  schema: MergeSchema;
  maxVersion?: number;
  externalMembers?: MergeDocumentOptions["externalMembers"];
}
export interface IndexFileStore<Index extends { v: number }> {
  path: string;
  parse(text: string): Index;
  load(): Promise<Index>;
  loadText(text: string, sha: string | null): Index;
  init(value?: Index): Index;
  get(): Index;
  base(): Index;
  baseSha(): string | null;
  dirty(): boolean;
  lastConflicts(): string[];
  update(mutator: (index: Index) => void): void;
  mergeFrom(index: Index): Index;
  serialize(): string;
  bind(callback: IndexStoreBinder): void;
  markSaved(text: string, sha: string): void;
  reloadAndMerge(): Promise<string[]>;
}
export interface FileMutation {
  label: string;
  do(): void;
  undo(): void;
  canDo?(): boolean;
  canUndo?(): boolean;
}
export interface FileMutationBatch<
  Mutation extends FileMutation = FileMutation,
> {
  exec(mutation: Mutation): void;
  seed(mutation: Mutation): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  redoDepth(): number;
  clear(): void;
  subscribe(listener: () => void): () => void;
  prune(predicate: (mutation: Mutation) => boolean): number;
}
export interface VersionedIndex extends JsonRecord {
  v: number;
}
export interface DesignSystemPaths {
  readme: string;
  tokens: string;
  manifest: string;
  componentsDir: string;
  libDir: string;
  bundleJs: string;
  bundleCss: string;
  indexDts: string;
  fontsDir: string;
  assetsDir: string;
  archivedDir: string;
}
export type FileArtifactType =
  | "design"
  | "slides"
  | "design_system"
  | "migrated_design";
export interface PathCheckException extends Error {
  code: "bad_path" | "bad_prefix" | "escapes_prefix";
  subject: string;
}
export interface PathCheckErrorConstructor {
  new (code: PathCheckException["code"], subject: string): PathCheckException;
}
export type JsonFileState =
  | { state: "unreadable"; narrowed?: boolean }
  | { state: "absent" }
  | { state: "read"; value: unknown; text: string; sha256: string };
export interface IndexedCrashStashOptions {
  indexedDB?: IDBFactory;
  viewerId?: unknown;
  artifactId?: string;
  tabId?: string;
  now?: () => number;
  liveTabs?: () => Promise<Set<string>>;
}
export interface CrashStashHead {
  key: string;
  at: number;
}
export interface CrashStashWireValue {
  key?: unknown;
  artifactId?: unknown;
  viewerId?: unknown;
  createdAt?: unknown;
  at?: unknown;
  chars?: unknown;
  edits?: unknown;
}
export interface PortListingMetadata {
  sha256: string;
  size: number;
  contentType: string;
}
export type PortListingCache = Map<string, PortListingMetadata> & {
  readonly narrowed?: boolean;
};
export interface PublishedFileOverride {
  sha256: string;
  bytes: Uint8Array<ArrayBufferLike>;
  contentType: string;
}
export interface PortRawListingValue {
  path?: unknown;
  sha256?: unknown;
  size?: unknown;
  contentType?: unknown;
  actual?: unknown;
  liveSha?: unknown;
  expected?: unknown;
}
export interface PortRawListing {
  files?: Record<string, PortRawListingValue> | null;
  ver?: unknown;
  narrowed?: unknown;
}
export interface PublishErrorWire {
  code?: unknown;
  retryAfterMs?: unknown;
  retry_after_ms?: unknown;
  live?: unknown;
  paths?: unknown;
  changed?: unknown;
}
export type PublishCapabilityEntry =
  | (NormalizedFilePublishInput & { ifMatch?: string | null })
  | { delete: true; ifMatch: string }
  | null;
export type FilePublishReply = Omit<
  import("../contracts").FilePublishSuccess,
  "ok"
>;
export interface FilesPublishCapability {
  publish(
    entries: Record<string, PublishCapabilityEntry>,
  ): Promise<FilePublishReply>;
}
export interface BrowserFilesPortOptions {
  fetch?(url: string): Promise<Response>;
  fetchFresh?(url: string): Promise<Response>;
  onRead?(url: string, ms: number, status: number, fresh: boolean): void;
  resolveNs?(): Promise<FilesPublishCapability | null>;
  location?: Pick<Location, "pathname">;
  bootVersion?: import("../contracts").FileVersion;
  canWrite?: boolean;
  bootFiles?:
    | ({ path: string } & PortRawListingValue)[]
    | Record<string, PortRawListingValue>;
  bootNarrowed?: boolean;
  preconditions?: false | { writes?: boolean; deletes?: boolean };
  onPublishError?(error: unknown): void;
}
export interface BrowserFilesPortExtended extends BrowserFilesPort {
  peekBytes(path: string): Promise<{
    bytes: Uint8Array<ArrayBufferLike>;
    sha256?: string;
    contentType: string;
  }>;
  peekRows(): import("../contracts").FileListing | undefined;
  noteAdopted(version: import("../contracts").FileVersion): void;
}
export interface DirtyFileEntry {
  value(): FilePublishInput;
  base: string | null | undefined;
  gen: number;
}
export interface FileSaveConflict {
  path: string;
  base: string | null | undefined;
  mine: FilePublishInput;
  theirsSha: string | null;
  unreadable?: boolean;
}
export type UnsendableCause =
  | FilePublishRejection["cause"]
  | "other"
  | "size"
  | "gone";
export interface UnsendableFileEntry {
  value(): FilePublishInput;
  base: string | null | undefined;
  why: string;
  cause: UnsendableCause;
}
export interface FileSaveStuck {
  code: string;
  since: number;
  attempts: number;
  paths: string[];
  retryable: boolean;
  stashed: boolean;
  nextRetryAt?: number;
  file?: string;
}
export interface FileSaveQueueState {
  dirty: number;
  inFlight: boolean;
  lastError?: string;
  backoffUntil?: number;
  stuck?: FileSaveStuck;
  unsendable?: { path: string; why: string; cause: UnsendableCause }[];
  unsendableStashed?: boolean;
}
export interface FileSaveRetryWindow {
  since: number;
  refusals: number;
  budgetMs: number;
}
export interface FileSaveCounters {
  publishes: number;
  pathsSent: number;
  conflicts: number;
  retries: number;
  rateLimited: number;
  bytesSent: number;
  lastPublishMs: number;
  surfaced: number;
}
export interface SaveQueuePort extends BrowserFilesPort {
  entryProblemDetail?(
    path: string,
    value: FilePublishInput,
  ): { why: string; cause: UnsendableCause } | undefined;
  entryProblem?(path: string, value: FilePublishInput): string | undefined;
}
export interface SaveQueueIndex {
  path: string;
  bind(callback: IndexStoreBinder): void;
  baseSha(): string | null;
  markSaved(text: string, sha: string): void;
  reloadAndMerge(): Promise<string[]>;
}
export interface SaveQueuePeers {
  getSnapshot(): readonly {
    sameTab?: boolean;
    tab?: string;
    editing?: boolean;
    at?: number;
  }[];
  subscribe(listener: () => void): () => void;
}
export interface FilesSaveQueueOptions {
  port: SaveQueuePort;
  index?: SaveQueueIndex;
  timers?: FilesTimers;
  stash?: FilesCrashStash;
  paced?: boolean;
  peers?: SaveQueuePeers;
  retryBudgetMs?: number;
  stuckRetryMs?: number;
  minGapMs?: number;
  onState?(state: FileSaveQueueState): void;
  onShared?(): void;
  onConflict(conflict: FileSaveConflict): void;
  onUnsendable?(path: string, reason: string): void;
  tokens?: { advance?(path: string, sha: string): void };
  onIndexMerged?(conflicts: string[]): void;
}
export interface FilesSaveQueue {
  markDirty(
    path: string,
    read: () => FilePublishInput,
    base?: string | null,
  ): void;
  commit(): void;
  settle(): Promise<void>;
  dispose(): Promise<void>;
  counters: FileSaveCounters;
  state(): FileSaveQueueState;
  conflicted(): Map<string, FileSaveConflict>;
  unsendable(): Map<string, string>;
  resolveConflict(path: string, choice: MergeChoice): void;
  pending(): boolean;
  isOwnEcho(change: import("../contracts").ChangedFileRow): boolean;
  solo(): boolean;
  withdraw(path: string): void;
  withdrawn(): Set<string>;
  retryNow(): void;
  flushNow(): void;
  stashRestored(): void;
  stashHandedOff(): void;
}
export interface SaveLifecycleQueue {
  commit(): void;
  flushNow?(): void;
  pending?(): boolean;
}
export interface SaveLifecycleHost extends EventTarget {
  document?: Document;
}
export interface DebugFileRow {
  path: string;
  state?: string;
  sha?: string | null;
  liveSha?: string | null;
  size?: number;
}
export interface DebugQueueView {
  dirty: string[];
  inFlight?: boolean;
  conflicted?: string[];
  lastError?: string;
  note?: string;
}
export interface DebugProviders {
  files?(): DebugFileRow[];
  queue?(): DebugQueueView | undefined;
}
export interface FilesDebugger {
  tab: string;
  reloadReason: string;
  field(name: string, value: unknown): void;
  event(type: string, details?: unknown): void;
  hotEvent(event: import("./platform-host").HotEvent): void;
  beforeRestart(reason: string): void;
  saveStart(paths: string[], bytes: number): number;
  saveEnd(
    id: number,
    result: { ok: boolean; version?: string; code?: string; raw?: unknown },
  ): void;
  phase(name: string): void;
  read(path: string, ms: number, status: number, fresh?: boolean): void;
  visible(version: string, kind: string): void;
  sample(name: string, ms: number): void;
  mount(mode: string): void;
  exportJson(): string;
  option(key: string, label: string): () => boolean;
  provide(providers: DebugProviders): void;
}
export interface FilesHotStats {
  updates: number;
  applied: number;
  deferred: number;
  restarts: number;
  fetchRetries: number;
  lastGrantLagMs?: number;
  maxGrantLagMs?: number;
}
export interface FilesHotController {
  active: boolean;
  dispose(): void;
  stats(): FilesHotStats;
  events: FilesHotEvent[];
}
export interface FilesHotOptions
  extends Omit<import("./platform-host").HotAttachment, "onEvent"> {
  port: HotFilesPort;
  hot?: FilesHotCapability | null;
  embedded?: boolean;
  isBusy?(): boolean;
  isCode?(path: string): boolean;
  retryMs?: number[];
  timers?: FilesTimers;
  busyPollMs?: number;
  contentWhileBusy?: boolean;
  early?: import("./platform-host").HotReloadBridge;
  onEvent?(event: FilesHotEvent): void;
  applyRemote(
    change: import("../contracts").FileRemoteChange,
    listing?: Map<string, import("../contracts").FileBytesRead>,
  ): Promise<void>;
  revealHoldMs?: number;
}
export interface FilesRemoteAppliedRow extends ChangedFileRow {
  decision: "index" | "ignored" | "held" | "removed" | "theirs";
}
export interface FilesDocumentOptions<Index extends { v: number }, Content>
  extends Omit<FilesHotOptions, "applyRemote" | "onEvent"> {
  codec: FileCodec<Index, Content>;
  initialContent: Content;
  parseContent(value: unknown): Content;
  defaultTitle?: string;
  saveStash?: FilesCrashStash;
  paced?: boolean;
  peers?: SaveQueuePeers;
  onConflict?(conflict: FileSaveConflict): void;
  onNotice?(message: string): void;
  onIndexMerged?(merge: {
    conflicts: string[];
    base: Index;
    mine: Index;
    merged: Index;
  }): void;
  readOnlyReason?: string;
  commitMs?: number;
  holdRemote?(path: string): boolean;
  startWhenNoIndex?(): Index;
  onRemoteApplied?(
    rows: FilesRemoteAppliedRow[],
    change: import("../contracts").FileRemoteChange,
  ): void;
  onHotEvent?: FilesHotOptions["onEvent"];
}
export interface FilesDocument<Index extends { v: number }, Content>
  extends ArtifactDocument<Content> {
  loadState(): "loading" | "failed" | "live";
  shown(): boolean;
  cachedSettled(): boolean;
  subscribeLoad(listener: () => void): () => void;
  flushNow(): void;
  retryLoad(): void;
  bootFailure(): string | undefined;
  storeUntouched(): boolean;
  releaseHold(path: string): void;
  syncDetail(): {
    pending: number;
    inflight: string | null;
    flights: number;
    lastSyncedAt?: number;
    lastError?: { code: string; message: string };
  };
  dispose(): void;
  queue(): FilesSaveQueue;
  hot(): FilesHotController;
  index(): IndexFileStore<Index>;
  whenLoaded(): Promise<void>;
  whenLive(): Promise<void>;
  held(): Set<string>;
  retrySave(): void;
  applyRemote(change: import("../contracts").FileRemoteChange): Promise<void>;
}
export interface FilesDebuggerOptions {
  product: string;
  bootStartedAt?: number;
  hot?: import("./platform-host").HotCapability | null;
  room?: boolean;
  makeRoom?(side: "bottom" | "right" | null, size: number): void;
}
export interface FilesHotChange extends HotFileChange {
  to?: string | null;
  from?: string | null;
}
export interface FilesHotEvent extends HotEvent {
  asked?: boolean;
  error?: string;
  path?: string;
  attempt?: number;
  ok?: boolean;
  status?: number;
  redirectedTo?: string;
  msAfterAdopt?: number;
  paths?: string[];
  rows?: number;
  applied?: number;
  fetched?: number;
  skipped?: number;
  retries?: number;
  grantLagMs?: number;
  ms?: number;
}
export interface HotIdleOptions {
  timers?: Pick<FilesTimers, "setTimeout" | "clearTimeout"> &
    Partial<Pick<FilesTimers, "now">>;
  onEvent?(event: FilesHotEvent): void;
  carried?: boolean;
  holdMs?: number;
}
export interface FilesHotCapability
  extends Omit<import("./platform-host").HotCapability, "accept" | "ready"> {
  accept(
    callback: (
      update: import("./platform-host").HotUpdate,
    ) => void | "restart" | "deferred" | "applied" | Promise<"applied">,
  ): void;
  ready?(callback: (carried: unknown) => Promise<void> | undefined): void;
  signal?: AbortSignal;
}
export interface HotFilesPort extends BrowserFilesPort {
  answersByReference?(path: string): boolean;
}
export type FileStoragePolicy = Partial<Record<FileKind, "file" | "blob">>;
export interface DataUrlSignature {
  head: Uint8Array<ArrayBuffer>;
  tail: Uint8Array<ArrayBuffer>;
  length: number;
}
export interface StoredIndexMetadata {
  assetGroups?: { name: string; tile?: unknown; order?: string[] }[];
  sections?: Record<string, string>;
  libraries?: unknown[];
  namespace?: string;
}
export interface RestoredIndexedFiles {
  title: string;
  content: { v: 2; files: FileTable };
}
