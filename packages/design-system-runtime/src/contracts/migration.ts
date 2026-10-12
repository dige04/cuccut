/** Versioned migration protocols used by the existing files/store adapters. */
import type * as Model from "../contracts";
import type * as Files from "./files-core";
import type * as Storage from "./model-storage";
export type StoreSnapshot = Map<string, Model.FilesMigrationStoreDocument>;
export interface DatabaseRule {
  path: string;
  read?: string;
  write?: string;
}
export type FileReadState =
  | { state: "absent" }
  | { state: "unreadable" }
  | { state: "text"; text: string };
export interface MigrationTree<Index extends object = MigrationWireIndex> {
  files: Map<string, Model.FilePublishInput>;
  index: Index;
  sources: Map<string, string[]>;
  indexSources?: string[];
}
export interface FoldContext<Index extends object = MigrationWireIndex> {
  index: Index;
  changed: Model.FilesMigrationStoreDocument[];
  removed?: string[];
  recorded: Map<string, Record<string, string>>;
  snapshot: StoreSnapshot;
  readFile(path: string): Promise<string | null>;
  readFileState(path: string): Promise<FileReadState>;
}
export interface FoldTree<Index extends object = MigrationWireIndex>
  extends MigrationTree<Index> {
  unfolded?: string[];
  indexSourcesGone?: string[];
}
export interface MigrationCodec<Index extends object = MigrationWireIndex> {
  toTree(
    snapshot: StoreSnapshot,
    options?: { preflight?: boolean },
  ): Promise<MigrationTree<Index>>;
  serializeIndex(index: Index): string;
  fold(context: FoldContext<Index>): FoldTree<Index> | Promise<FoldTree<Index>>;
}
export interface MigrationAdapter<Index extends object = MigrationWireIndex> {
  type: Files.FileArtifactType;
  indexPath: string;
  metaPath: string;
  lockPath: string;
  allowlist: Model.FilesMigrationAllowlistEntry[];
  dbRules: DatabaseRule[];
  codec: MigrationCodec<Index>;
  home?: string;
  secretFields?: string[];
  digestView?(
    document: Model.FilesMigrationStoreDocument,
  ): Record<string, unknown>;
  kept?(): Record<string, { sha256: string }>;
  indexHolds?(index: Index, documentPath: string): boolean;
}
export interface MigrationOptions<Index extends object = MigrationWireIndex> {
  adapter: MigrationAdapter<Index>;
  files: MigrationFilesPort;
  store: Model.FilesMigrationStore;
  timers: Model.FilesTimers;
  holder: string;
  by: string;
  artifactId?: string;
  force?: boolean;
  versionCaps?: Files.FileVersionCaps;
  sharedExternally?(): Promise<boolean | null>;
  embedsArtifacts?(): Promise<boolean | null>;
  onStage?(stage: string): void;
}
export type MigrationOutcome =
  | {
      result: "converted";
      version: string;
      files: number;
      calls: number;
      rechecks: number;
      ms: number;
      tombstoned?: false;
      leftOut?: (string | { path: string; why: string })[];
    }
  | { result: "busy"; until?: string }
  | {
      result: "skipped";
      reason: string;
      tombstoned?: boolean;
      leftOut?: (string | { path: string; why: string })[];
    }
  | { result: "aborted"; stage: string; code: string; ms?: number };
export interface MigrationPublisher {
  calls(): number;
  publish(
    entries: Model.FilePublishEntries,
    options?: Model.FilePublishPreconditions,
  ): Promise<Model.FilePublishResult>;
}
export interface MigrationSize {
  files: number;
  bytes: number;
  oversized: string[];
}
export interface FetchMigrationBlob {
  (id: string): Promise<{ bytes: Uint8Array<ArrayBuffer> } | null>;
}
export interface LegacyMigrationSystem {
  title: string;
  files: Model.FileTable;
  source: Record<string, unknown> | null;
  upgraded: Record<string, unknown> | null;
}
export interface MigrationFileProblem {
  path: string;
  reason: string;
}
export interface PublishProblem {
  why: string;
  cause: Files.UnsendableCause | "gone";
  forNow?: boolean;
}
export interface DesignSystemPortOptions {
  lazy?: Files.LazyReadState;
  tableText?(path: string, text: string): string;
  wireText?(path: string, text: string): string;
  onReadText?(path: string, text: string, sha: string): void;
  onSend?(texts: Record<string, string | null>): void;
  onPublish?(result: {
    paths: string[];
    held?: string[];
    ok: boolean;
    version?: string;
    texts?: Record<string, string | null>;
    shas?: Record<string, string>;
    code?: string;
  }): void;
  onDownloadsRefused?(): void;
}
export interface DesignSystemFilesPort extends Model.BrowserFilesPort {
  answersByReference(path: string): boolean;
  entryProblem(path: string, input: Model.FilePublishInput): string | undefined;
  entryProblemDetail(
    path: string,
    input: Model.FilePublishInput,
  ): PublishProblem | undefined;
}
export interface MigrationRuntime {
  isDownloadOnlyPublishInput(input: Model.FilePublishInput): boolean;
  validateMigrationAllowlist(
    adapter: Pick<MigrationAdapter<object>, "allowlist" | "dbRules">,
  ): void;
  migrationSentinelMatchesArtifact(
    sentinel: Model.FilesMigrationSentinel,
    artifactId?: string,
  ): boolean;
  hashStoreSnapshot(
    snapshot: StoreSnapshot,
    adapter: Pick<MigrationAdapter<object>, "secretFields" | "digestView">,
  ): Promise<Map<string, string>>;
  hashStoreFields(
    document: Record<string, unknown>,
    secretFields?: string[],
  ): Promise<Record<string, string>>;
  storeDocumentDigestView(
    document: Model.FilesMigrationStoreDocument,
    adapter?: Pick<MigrationAdapter<object>, "digestView">,
  ): Record<string, unknown>;
  splitMigrationPublishBatches(
    entries: Model.FilePublishEntries,
  ): Model.FilePublishEntries[];
  finishMigrationTombstone(
    options: Pick<
      MigrationOptions<object>,
      "files" | "store" | "timers" | "artifactId"
    > & { indexPath: string; metaPath: string },
  ): Promise<boolean | undefined>;
  MIGRATION_LEASE_TTL_MS: number;
  artifactHealth: {
    report(action: string, outcome: string, code?: string): void;
  };

  parseDesignSystemEnvelope(
    text: string,
  ): string | { envelope: import("./model-core").DesignSystemEnvelopeObject };
  parseDesignSystemContent(
    value: unknown,
    report?: Model.ParseReport,
    options?: { unbounded?: boolean },
  ): Model.DesignSystemContent;
  designSystemFilesMigrationTree(
    system: LegacyMigrationSystem,
    sourcesFor: (path: string) => string[],
  ): MigrationTree;
  materializeMigrationBlobFiles(
    files: Record<string, string>,
    title: string,
    fetch: FetchMigrationBlob,
  ): Promise<Model.FileTable>;
  serializeMigrationIndex(index: unknown): string;
  DesignSystemMigrationError: new (code: string) => Error & { code: string };
  migrationVersionSize(
    listing: Pick<Model.FileListingRow, "path" | "size">[],
    tree: Pick<MigrationTree<object>, "files">,
    path: string,
    index: Model.FilePublishInput,
  ): MigrationSize;
  isProjectContentPath(path: string): boolean;
  fileListingIsNarrowed(
    listing: Model.FileListing,
    files?: MigrationFilesPort,
  ): boolean;
  DESIGN_SYSTEM_ENVELOPE_PATH: string;

  cloneMergeValue<Value>(value: Value): Value;
  parseMigrationSentinel(
    text: string | null,
  ): Model.FilesMigrationSentinel | null;
  projectFilePath(path: string): string;
  hashCanonicalIndex(value: unknown): Promise<string>;
  legacyStoreSnapshotToFiles(
    snapshot: StoreSnapshot,
    fetch: FetchMigrationBlob,
  ): Promise<LegacyMigrationSystem>;
  migrationPublishInput(path: string, content: string): Model.FilePublishInput;
  parseStoredSystemMetadata(
    value: unknown,
  ): Storage.StoredSystemMetadata | null;
  encodeFileIndexKey(path: string): string;
  isAdditionalMarkdownPath(path: string): boolean;
  isAssetGroupName(value: unknown): value is string;
  isAssetTileSize(value: unknown): value is Model.AssetTileSize;
  stripGeneratedReadmeTail(text: string): string;
  createDesignSystemMigrationCodec(fetch: FetchMigrationBlob): MigrationCodec;
  migrateStoreToFiles<Index extends object = MigrationWireIndex>(
    options: MigrationOptions<Index>,
  ): Promise<MigrationOutcome>;
  readAllowlistedStoreDocuments(
    store: Model.FilesMigrationStore,
    allowlist: Model.FilesMigrationAllowlistEntry[],
  ): Promise<StoreSnapshot>;
  storeDocumentDataMap(
    snapshot: StoreSnapshot,
  ): Map<string, Record<string, unknown>>;
  MIGRATION_SENTINEL_PATH: string;
  DESIGN_SYSTEM_STORE_ALLOWLIST: Model.FilesMigrationAllowlistEntry[];
  FILES_INDEX_PROJECT_PATH: string;
  DESIGN_SYSTEM_MIGRATION_LOCK_PATH: string;
  designSystemMigrationDbRules(): DatabaseRule[];

  convertedFromMarker(input: {
    at: string;
    by: string;
    home?: string;
  }): Storage.ConvertedMarker;

  composeStoredSystemFiles(
    records: ReadonlyMap<string, Record<string, unknown>>,
  ): Storage.StoredSystemFiles;
  hydrateStoredSystemText(
    state: Storage.StoredSystemFiles,
    text: ReadonlyMap<string, string>,
  ): Model.FileTable;
  blobIdFromReference(reference: string): string | null;
  blobFilesOwedToFileStorage(
    files: Model.FileTable,
  ): { path: string; id: string }[];
  storageCatalogFromManifest(input: unknown): Model.StorageCatalog;
  filesLeftOutOfMigration(files: Model.FileTable): MigrationFileProblem[];
  publishableProjectFiles(files: Model.FileTable): Map<string, string>;
  validDerivedProjectFiles(files: Model.FileTable): Map<string, string>;
  buildFilesIndex(
    title: string,
    files: Model.FileTable,
    previous?: Model.FilesIndex,
  ): Model.FilesIndex;
  createEmptyFilesIndex(): Model.FilesIndex;
  documentPathForFile(path: string): string;
  stringifyManifestWithinBudget(value: unknown): string;
  parsedDesignSystem(
    content: Model.DesignSystemContent,
  ): Model.ParsedDesignSystem;
  buildDesignSystemManifest(
    system: Model.ParsedDesignSystem,
    title: string,
  ): import("./model-core").DesignSystemManifestResult;
  foldLegacyStoreChangesIntoFiles(
    context: FoldContext,
    fetch: FetchMigrationBlob,
  ): Promise<FoldTree>;
  DESIGN_SYSTEM_PATHS: import("./model-core").DesignSystemPaths;
  SYSTEM_COLLECTION: string;
  SYSTEM_META_DOCUMENT_PATH: string;
  SYSTEM_SOURCE_DOCUMENT_PATH: string;
  SYSTEM_UPGRADED_DOCUMENT_PATH: string;
  SYSTEM_TOKENS_DOCUMENT_PATH: string;
  RAW_TOKENS_DOCUMENT_PATH: string;
  META_DOCUMENT_ID: string;
  TOKENS_DOCUMENT_ID: string;
  SOURCE_DOCUMENT_ID: string;
  UPGRADED_DOCUMENT_ID: string;
  FONTS_COLLECTION: string;
  FILES_COLLECTION: string;
  ASSETS_COLLECTION: string;
  COMPONENTS_COLLECTION: string;
  PREVIEWS_COLLECTION: string;
  ARTIFACT_FILE_CAPACITY: { files: number; bytes: number };

  relativeProjectFilePath(path: string): string | undefined;
  publishableFileMimeType(
    path: string | undefined,
    content?: string,
  ): string | null;
  isTextFilePath(path: string): boolean;
  decodeHeldFileDataUri(uri: string): Files.FileData | null;
  isTextMimeType(mime: string): boolean;
  isHeldFilePointer(path: string, text: string): boolean;
  filePointer(path?: string): string;
  canUseHeldFilePointer(path: string): boolean;
  assetKindForPath(path: string): Model.AssetKind;
  lazyFileReadMode(lazy: Files.LazyReadState, path: string): string;
  updateLazyReadListing(
    lazy: Files.LazyReadState,
    rows: Model.FileListing,
  ): void;
  bytesToFileDataUri(bytes: Uint8Array<ArrayBufferLike>, mime: string): string;
  sha256(value: string | Uint8Array<ArrayBufferLike>): Promise<string>;
  explainUnpublishableFile(
    path: string | undefined,
    text: string,
  ): PublishProblem | null;
  filePublishRejection(
    path: string,
    value: Model.FilePublishInput,
  ): PublishProblem | undefined;
  FILE_BINARY_MIME_TYPES: ReadonlySet<string>;
  serializeIndexDocument(value: unknown): string;
  readJsonFileState(
    port: MigrationFilesPort,
    path: string,
    timers: Model.FilesTimers,
  ): Promise<Files.JsonFileState>;
  readFileMigrationMarker(value: unknown): Storage.MigrationMarker | null;
  readMovedToMarker(value: unknown): Storage.MovedMarker | null;
  activeConvertingMarker(
    value: unknown,
    now: number,
  ): Storage.ConvertingMarker | null;
  readConvertingMarker(value: unknown): Storage.ConvertingMarker | null;
  movedToMarker(input: Storage.MovedMarkerStamp): Storage.DatabaseRecord;
  listWritableFiles(port: MigrationFilesPort): Promise<Model.FileListing>;
  filePublishRawBytes(input: Model.FilePublishInput): number;
  filePublishEncodedBytes(input: Model.FilePublishInput): number;
  normalizeFilePublishInput(
    path: string,
    value: Model.FilePublishInput,
  ): Files.NormalizedFilePublishInput | string | null;
  fileContentBytes(
    content: Model.FileContents,
  ): Promise<Uint8Array<ArrayBuffer>>;
  validateFilePath(path: string): string | undefined;
  canonicalFilePathWithinPrefix(prefix: string, path: string): string;
  isPrivateProjectFile(type: Files.FileArtifactType, path: string): boolean;
  removeUnpublishableMigrationFiles(
    files: Map<string, Model.FilePublishInput>,
    type?: Files.FileArtifactType,
  ): { path: string; why: string }[];
  damagedTextFiles(
    tree: MigrationTree<object>,
  ): { path: string; why: string }[];
  PROJECT_FILE_PREFIX: string;
  MAX_FILE_PUBLISH_ENCODED_BYTES: number;
  MIGRATION_MANIFEST_PATH: string;
  MIGRATION_LOCK_TTL_MS: number;
  DEFAULT_FILE_VERSION_CAPS: Files.FileVersionCaps;
  CONVERTING_MARKER_KEY: string;
  MOVED_TO_MARKER_KEY: string;
  CONVERTED_FROM_MARKER_KEY: string;
  CREATED_ON_FILES_MARKER_KEY: string;
}
export interface FoldSummary {
  kept: { path: string; why: string }[];
  came: boolean;
}
export interface NamedLegacyToken {
  name: string;
  [field: string]: unknown;
}
export type MigrationPreflight =
  | "too_large"
  | null
  | { unpublishable: MigrationFileProblem[] };
export type DesignSystemMigrationOptions = Omit<
  MigrationOptions,
  "adapter" | "sharedExternally" | "embedsArtifacts"
> & { fetchBlob: FetchMigrationBlob };

/** A fold can carry legacy order entries untouched; the next index read normalizes them. */
export interface MigrationWireAssetGroup
  extends Omit<Model.FilesIndexAssetGroup, "order"> {
  order: unknown[];
}
export interface MigrationWireIndex
  extends Omit<Model.FilesIndex, "assetGroups"> {
  assetGroups: Record<string, MigrationWireAssetGroup>;
}
export type MigrationFilesPort = Pick<
  Model.BrowserFilesPort,
  | "list"
  | "readText"
  | "publish"
  | "version"
  | "canWrite"
  | "narrowed"
  | "mayWrite"
  | "listUnlessNarrowed"
> &
  Partial<Pick<Model.BrowserFilesPort, "onRemoteChange">>;
export interface SingleFileMigrationAdapter {
  adapter: MigrationAdapter;
  builtFrom(): string | undefined;
  builtPaths(): Set<string>;
}
export type ReadSingleFile = () => Promise<Model.FileTextRead | null>;
export type FoldOutcome =
  | { result: "skipped"; reason: string }
  | { result: "clean" }
  | { result: "busy"; until?: string }
  | { result: "failed"; code: string; retryAfterMs?: number }
  | {
      result: "folded";
      documents: number;
      files: number;
      leftOut?: (string | { path: string; why: string })[];
    };
export interface StoreFoldOptions<Index extends object = MigrationWireIndex>
  extends Omit<MigrationOptions<Index>, "by"> {
  by?: string;
  write?(
    entries: Model.FilePublishEntries,
    options?: Model.FilePublishPreconditions,
  ): Promise<Model.FilePublishResult>;
  onFolded?(change: Model.FileRemoteChange): void;
  onOutcome?(outcome: FoldOutcome): void;
}
export interface StoreFoldSnapshot<Index extends object> {
  index: Index;
  markerKey: string;
  marker: Storage.DatabaseRecord;
  indexSha: string;
  record: Model.FilesMigrationSentinel;
  recordSha: string;
  snapshot: StoreSnapshot;
  digests: Map<string, string>;
  changed: Model.FilesMigrationStoreDocument[];
  removed: string[];
}
export interface StoreFoldController {
  check(): Promise<FoldOutcome>;
  watch(): () => void;
}

export interface MigrationNextAction {
  next: "reload" | "wait" | "stay";
  why: string;
  again?: true;
  notice?: string;
}
