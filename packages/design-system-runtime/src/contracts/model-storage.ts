import type * as Model from "../contracts";
import type * as Application from "./application";
import type * as Host from "./platform-host";
/** Untrusted object records at the JSON / database boundary. */
export type DatabaseRecord = Record<string, unknown>;
export type DocumentRecords = Map<string, DatabaseRecord>;
export interface DatabaseError {
  code: string;
  message: string;
}
export type DatabaseChange =
  | { type: "removed"; path: string }
  | { type: "added" | "modified"; path: string; data: DatabaseRecord };
export interface DatabaseSnapshotInfo {
  initial: boolean;
  fromCache: boolean;
  hasPendingWrites: boolean;
}
export interface DatabasePort {
  subscribe(
    collection: string,
    listener: (changes: DatabaseChange[], info: DatabaseSnapshotInfo) => void,
    onError: (error: DatabaseError) => void,
  ): () => void;
  set(path: string, data: DatabaseRecord): Promise<void>;
  update(path: string, data: DatabaseRecord): Promise<void>;
  del(path: string): Promise<void>;
}
export interface DatabaseDocumentSnapshot {
  id: string;
  data(): DatabaseRecord | undefined;
}
export interface DatabaseQuerySnapshot {
  docChanges(): {
    type: DatabaseChange["type"];
    doc: DatabaseDocumentSnapshot;
  }[];
  metadata?: { fromCache?: boolean; hasPendingWrites?: boolean };
}
export interface NativeDatabase {
  collection(path: string): {
    limit(count: number): {
      onSnapshot(
        listener: (snapshot: DatabaseQuerySnapshot) => void,
        onError: (error: unknown) => void,
      ): () => void;
    };
  };
  doc(path: string): {
    set(data: DatabaseRecord): Promise<unknown>;
    update(data: DatabaseRecord): Promise<unknown>;
    delete(): Promise<unknown>;
  };
}
export interface RawComment extends DatabaseRecord {
  id: string;
}
export interface RawDocumentSeed extends DatabaseRecord {
  title?: string;
  content?: unknown;
  comments?: unknown;
}
export type SystemBootResult =
  | { origin: "instance"; state: RawDocumentSeed; stateFileFound?: boolean }
  | {
      origin: "demo";
      state: RawDocumentSeed;
      stateFileFound?: boolean;
      error?: string;
    }
  | { origin: "failed"; state?: RawDocumentSeed; error?: string };
export type SystemBootMode =
  | { mode: "instance"; state: RawDocumentSeed }
  | { mode: "readonly"; state: RawDocumentSeed; reason: string };
export interface StorageLimits {
  file: number;
  svgFile: number;
  total: number;
  files: number;
}
export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
  font?: boolean;
}
export interface UploadBudget {
  room: number;
  tier: string;
  blobUsed: number;
  blobCount: number;
  blobMaxBytes?: number;
  blobMaxFiles?: number;
}
export type UploadRoute =
  | { to: "inline" }
  | { to: "blob"; type: string }
  | { to: "refuse"; reason: string; handOff?: "figma" | "too-large" };
export interface KnownStoredBlob {
  id: string;
  bytes: number;
  type: string;
  url?: string;
}
export interface StorageComparison {
  missing: string[];
  missingIds: string[];
  unreferenced: string[];
}
export interface SerializedStorageCatalog {
  files: Record<string, Model.StorageRecord>;
  blobBytesUsed: number;
}
export type StoredFileKind = "code" | "font" | "image" | "text" | "binary";
export interface BinaryHeader {
  mime: string;
  base64: boolean;
  payloadOffset: number;
}
export type StoredConversionRoute =
  | { to: "inline" }
  | { to: "data-uri"; carried: string }
  | { to: "omit"; carried: string }
  | { to: "blob"; contentType: string; carried?: string };
export interface RemoteFileRecord extends DatabaseRecord {
  path: string;
  kind: StoredFileKind;
  dataRef: string;
  dataBytes: number;
  contentType?: string;
  sha256?: string;
  storedSha256?: string;
  name?: string;
  addedAt?: string;
  via?: string;
}
export interface RemoteFileMetadata {
  bytes?: number;
  contentType?: string;
  sha256?: string;
  storedSha256?: string;
  name?: string;
  addedAt?: string;
  via?: string;
}
export interface KnownUpload extends RemoteFileMetadata {
  id: string;
}
export type KnownUploadInput = string | KnownUpload;
export interface ConversionUpload {
  path: string;
  docPath: string;
  paths: string[];
  kind: StoredFileKind;
  contentType: string;
  bytes: Uint8Array<ArrayBuffer>;
  byteLength: number;
  sha256?: string;
}
export type CarriedForm =
  | "omitted"
  | "data-uri"
  | "blob"
  | "text-doc"
  | "not-in-snapshot";
export interface CarriedFile {
  path: string;
  reason: string;
  form: CarriedForm;
  referrers?: string[];
}
export interface StoredSystemMetadata extends DatabaseRecord {
  v: 1;
  title: string;
  namespace?: string;
  libraries?: unknown[];
  assetGroups?: unknown[];
  sections?: DatabaseRecord;
  lastChange?: DatabaseRecord;
  convertedFrom?: TimestampMetadata;
  snapshot?: TimestampMetadata;
  carried?: CarriedFile[];
  carriedMore?: number;
}
export interface ConversionPlan {
  title: string;
  docs: DocumentRecords;
  uploads: ConversionUpload[];
  carried: CarriedFile[];
}
export interface UploadStamp {
  addedAt?: string;
  via?: string;
}
export interface BinaryFile {
  bytes: Uint8Array<ArrayBuffer>;
  sha256?: string;
}
export interface ConversionOptions {
  known?: ReadonlyMap<string, KnownUploadInput | null>;
  binaries?: ReadonlyMap<string, BinaryFile>;
  detached?: ReadonlyMap<string, BinaryFile>;
  sha256?: (bytes: Uint8Array) => string;
  stamp?: UploadStamp;
  derived?: boolean;
  meta?: Pick<StoredSystemMetadata, "convertedFrom" | "snapshot">;
  precarried?: CarriedFile[];
}
export interface StoredSystemFiles {
  title: string;
  files: Model.FileTable;
  remoteText: Map<string, RemoteFileRecord>;
  meta: StoredSystemMetadata | null;
  source: DatabaseRecord | null;
  upgraded: DatabaseRecord | null;
  hidden: number;
}
export interface MigrationStamp {
  at: string;
  by?: string;
  home?: string;
  path?: string;
  ver?: string;
}
/** A copied lease timestamp is validated only when the marker is read back. */
export interface MovedMarkerStamp {
  at: unknown;
  path?: string;
  ver?: string;
}
export interface ConvertedMarker extends DatabaseRecord {
  v: 1;
  home: string;
  at: string;
  by?: string;
}
export interface CreatedMarker extends DatabaseRecord {
  v: 1;
  at: string;
}
export interface MovedMarker extends DatabaseRecord {
  path: string;
  at: string;
  ver?: unknown;
  dropping?: string;
  dropped?: string;
  took?: string;
}
export interface ConvertingMarker extends DatabaseRecord {
  holder: string;
  at?: unknown;
}
export type MigrationMarker = {
  kind: "converted" | "created";
  marker: DatabaseRecord;
};
export interface ListedAsset {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
export interface AssetUsage {
  files: number;
  bytes: number;
  maxFiles: number;
  maxBytes: number;
}
export type AssetsCatalogueState =
  | { state: "unknown" }
  | { state: "unavailable"; code: string }
  | { state: "listed"; byId: Map<string, ListedAsset>; usage: AssetUsage };
export interface AssetsTierState {
  state: "off" | "untried" | "on";
  why: string | null;
}
export interface AssetsCapability {
  upload(blob: Blob, options: { type: string }): Promise<unknown>;
  list(): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}
export interface AssetSdk {
  assets?: Partial<AssetsCapability>;
  use?(name: string): Promise<unknown> | unknown;
}
export type AssetUploadFailureKind =
  | "inline-if-fits"
  | "too-large"
  | "quota"
  | "backoff"
  | "retry-once"
  | "reload"
  | "error"
  | "not-granted"
  | "tier-off";
export type StoredAssetUploadResult =
  | { ok: true; id: string; bytes: number; type: string; url?: string }
  | { ok: false; kind: AssetUploadFailureKind; code: string };
export interface AssetRetryOptions {
  sleep?(delay: number): Promise<void>;
  now?(): string;
  onWait?(delay: number, code: string): void;
}
export interface OrphanedAsset {
  path?: string;
  sha256?: string;
  id: string;
  bytes: number;
  at?: number;
}
export interface AssetDeletionResult {
  freed: Map<string, number>;
  unavailable: boolean;
  rateLimited: boolean;
  kept: string[];
}
export type FetchText = (url: string) => Promise<string | null>;
export interface RemoteTextEntry {
  ptr: RemoteFileRecord;
  text?: string;
}
export interface UploadedRemoteText {
  text: string;
  known: KnownUpload;
}
export interface RemoteTextProblem {
  path: string;
  message: string;
}
export interface RemoteTextHydrator {
  hydrate(path: string, text: string, onlyIfMissing?: boolean): unknown;
}
export interface TimestampMetadata extends DatabaseRecord {
  at: string;
}
export interface StoredPriorityGroup {
  name?: unknown;
  order?: readonly string[] | string;
  tile?: unknown;
}
export interface SystemCarry {
  meta?: Pick<StoredSystemMetadata, "convertedFrom" | "snapshot">;
}
export interface StoredSystemFlags {
  migratedFrom?: "claude-design";
  upgraded?: boolean;
  editingOff?: boolean;
}
export interface StoredSystemStatus extends StoredSystemFlags {
  loaded: boolean;
  carried: CarriedFile[];
  carriedMore: number;
  convertedAt?: string;
  snapshotAt?: string;
  movedToFiles?: boolean;
}
export interface ComposedDocument
  extends Host.ArtifactEnvelope<Model.DesignSystemContent> {
  carry: SystemCarry;
  dangling: string[];
}
export interface RetainedDerivedSystem {
  derived: DocumentRecords;
  readmeTail: string;
  meta: Pick<StoredSystemMetadata, "namespace" | "libraries">;
}
export interface SystemDocumentCodec {
  collections: string[];
  metaPath: string;
  decompose(
    document: import("./platform-host").ArtifactEnvelope<Model.DesignSystemContent>,
    previous?: ReadonlyMap<string, DatabaseRecord>,
    carry?: SystemCarry,
  ): DocumentRecords;
  compose(records: DocumentRecords, previous?: unknown): ComposedDocument;
  refuse(
    path: string,
    record: DatabaseRecord,
    collectionBytes: number,
  ): string | undefined;
  replaceOnly(path: string): boolean;
}
export type RemoteTextFetch = (
  url: string,
) => Promise<Pick<Response, "ok" | "text">>;
export type RemoteTextUpload = (
  blob: Blob,
  options: { type: string },
) => Promise<unknown>;
export interface AssetReclamation {
  missing: string[];
  missingIds: Set<string>;
  reclaimable: { id: string; bytes: number }[];
  reclaimableBytes: number;
  windowed: boolean;
}
export interface PublishedAssetProbe {
  url?: string;
  fetchText?: FetchText;
}
export interface SelfPublishCapability {
  publish(
    input: string | Model.FilePublishEntries,
  ): Promise<Host.PublishResult | undefined>;
}
export interface MirrorPublisherOptions {
  onStale?(message: string): void;
}
export type HealthEvent = [
  name: "render" | "sync" | "save" | "download",
  outcome: "success" | "failure" | "aborted",
  detail?: string,
];
export type SyncHealthReporter = (event: HealthEvent) => void;
export interface MonitoredSaveState extends Host.SaveState {
  leftOut?: { id: string; cause: string }[];
}
export interface MonitoredSyncDocument {
  loadState(): string;
  cachedSettled?(): boolean;
  syncDetail(): { lastError?: { code?: string } };
  subscribeLoad(listener: () => void): () => void;
  saveState(): MonitoredSaveState;
  subscribeSave(listener: (state: MonitoredSaveState) => void): () => void;
  subscribeStuck?(listener: () => void): () => void;
  dirty(): boolean;
}
export interface DownloadOutcome {
  outcome: "saved" | "declined" | "withheld" | "unsupported";
  code?: string;
}
export interface MirrorPublishError extends Host.PublishError {
  say: string;
}
export type SystemDocument =
  | Host.ArtifactDocument<Model.DesignSystemContent>
  | SyncedSystemDocument;
export interface SyncedSystemDocument
  extends Host.ArtifactDocument<Model.DesignSystemContent> {
  loadState(): string;
  cachedSettled?(): boolean;
  syncDetail(): { lastError?: { code?: string } };
  subscribeLoad(listener: () => void): () => void;
  subscribeStuck?(listener: () => void): () => void;
  neverSaves?(
    path: string,
    value: string,
  ): Application.FileSaveProblem | undefined;
}
export interface DocumentBootConfiguration {
  boot: SystemBootMode;
  opts: Partial<Host.DocumentOptions<Model.DesignSystemContent>>;
  instance: boolean;
}
export interface StoreOptions {
  by?: string | PromiseLike<string>;
  now?(): string;
  legacyServed?(convertedAt?: string): Promise<boolean | null | undefined>;
}
export interface AnnouncedNote {
  paths: Set<string>;
  values: Set<string>;
  asOf: Model.FileTable;
  present: boolean;
}
export interface DesignSystemStore extends Application.ApplicationStore {
  doc: SystemDocument;
  beforeSave: (() => Promise<unknown>) | null;
  stampBy(): string;
  stampNow(): string;
  setNote(note: string, announcedFiles?: Model.FileTable): void;
}
export interface PreparedHeldBytes {
  value: string;
  witness: unknown;
}
export interface FileCommandStep extends Application.FileEditStep {
  touch(): void;
  dropped?: boolean;
  leavesAlone?(path: string): boolean;
  dropPaths?(paths: Set<string>): void;
}
export interface CommandDocument
  extends Host.ArtifactDocument<Model.DesignSystemContent> {
  stepCommand(
    label: string,
    state: () => {
      before: Model.DesignSystemContent;
      after: Model.DesignSystemContent;
    },
    options?: { applied?: boolean },
  ): FileCommandStep;
  bindUndoStack?(stack: Application.FileEditHistory): void;
  heldBytes?(path: string): Promise<PreparedHeldBytes | null>;
  heldGone?(path: string): boolean;
  heldStillGood?(path: string, witness: unknown): string | undefined;
  setPreparing?(preparing: boolean): void;
  tell?(message: string): void;
  sendProblem?(path: string, value: string): unknown;
  editProblem?(
    before: Model.DesignSystemContent,
    after: Model.DesignSystemContent,
  ): unknown;
  carrying?(): void;
}
export interface CoalescedEdit {
  key: string;
  base: Model.DesignSystemContent;
  latest: Model.DesignSystemContent;
  step?: FileCommandStep;
}
export type ContentMutation = (
  content: Model.DesignSystemContent,
) => Model.DesignSystemContent;
export type PreparedEditResult =
  | { ok: true }
  | { ok: false; failed: string[]; tooMany: boolean };
export interface SystemCommands extends Application.ApplicationCommands {
  content(): Model.DesignSystemContent;
  needs(mutate: ContentMutation): string[];
  busy(): boolean;
  lastNotUndoable(): string[];
  prepare(mutate: ContentMutation): Promise<PreparedEditResult>;
}
