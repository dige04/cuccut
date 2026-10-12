import type * as React from "react";
import type * as Model from "../contracts";
import type * as Application from "./application";
export interface SelectionKeys {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}
export interface AssetSelectionController extends Model.AssetSelection {
  has(id: string): boolean;
  click(id: string, event: SelectionKeys): void;
  only(id: string): void;
  extend(id: string): void;
  all(): void;
  clear(): void;
  set(ids: string[]): void;
}
export interface ContrastMatcher {
  name: string;
  re: RegExp;
}
export interface ContrastMention {
  name: string;
  start: number;
  end: number;
}
export interface InferredContrastPair {
  against: string[];
  source: "usage" | "on" | "name";
}
export interface FontCatalogEntry {
  family: string;
  stack?: string;
  weights?: number[];
  generic?: "sans" | "serif" | "mono";
  wght?: number[];
  statics?: number[];
  italic?: boolean;
}
export interface PreviewFitBoxProps {
  width: number;
  height: number;
  "data-testid": string;
  children?: React.ReactNode;
}
export interface EditPreparationOptions {
  nameOf(path: string): string;
  say?: (message: string) => void;
  ask?: (
    confirmation: Omit<Application.ConfirmationState, "confirmLabel">,
  ) => void;
}
export interface CarriedMigrationFile {
  form: string;
  path: string;
  reason?: string;
}
export interface PipelineStoredStatus {
  convertedAt?: string;
  carried: CarriedMigrationFile[];
  carriedMore: number;
}

export type EditPreparationResult =
  | { ok: true }
  | { ok: false; tooMany?: boolean; failed: string[] };
export interface DesignSystemEditPreparation {
  busy(): boolean;
  needs(edit: Application.ContentMutation): string[];
  prepare(edit: Application.ContentMutation): Promise<EditPreparationResult>;
}
export interface AssetGrab {
  dx: number;
  dy: number;
  w: number;
  h: number;
}
export interface AssetDragView extends Model.AssetDragState {
  grab: AssetGrab;
}
export interface AssetDragOptions {
  enabled: boolean;
  order: string[];
  selected: string[];
  onGrab(id: string): void;
  scroller: React.RefObject<HTMLElement | null>;
  onDrop(ids: string[], target: Model.AssetDropTarget): void;
}
export interface AssetPointerSession {
  id: string;
  ids: string[];
  pointerId: number;
  sx: number;
  sy: number;
  moved: boolean;
  grab: AssetGrab;
}
export interface AssetDragListeners {
  move(event: PointerEvent): void;
  up(event: PointerEvent): void;
  cancel(): void;
  key(event: KeyboardEvent): void;
}
export interface AssetDragController {
  drag: AssetDragView | null;
  ghostRef: React.RefObject<HTMLElement | null>;
  onPointerDown(event: React.PointerEvent<HTMLElement>, id: string): void;
  justDropped(): boolean;
  cancel(): void;
}
export interface AssetGridMenu {
  x: number;
  y: number;
  paths: string[];
  anchor: "point" | "tap";
}
export interface AssetGridOptions {
  order: string[];
  editable: boolean;
  coarse: boolean;
  scroller: React.RefObject<HTMLElement | null>;
  onDrop(ids: string[], target: Model.AssetDropTarget): void;
  onOpen(path: string): void;
  onRemove(paths: string[]): void;
}
export interface AssetGridInteractions {
  selection: AssetSelectionController;
  selected: ReadonlySet<string>;
  focusId: string | null;
  editable: boolean;
  coarse: boolean;
  drag: AssetDragView | null;
  ghostRef: React.RefObject<HTMLElement | null>;
  menu: AssetGridMenu | null;
  closeMenu(): void;
  focus(id: string | null): void;
  remove(ids: string[]): void;
  onPointerDown(event: React.PointerEvent<HTMLElement>, id: string): void;
  onClick(event: React.MouseEvent<HTMLElement>, id: string): void;
  onDoubleClick(id: string): void;
  onContextMenu(event: React.MouseEvent<HTMLElement>, id: string): void;
  onKeyDown(event: React.KeyboardEvent<HTMLElement>, id: string): void;
}
export interface FileDropZoneProps {
  onFiles(files: File[]): void;
  onLeftOut?: (count: number) => void;
  folder?: boolean;
  large?: boolean;
  line?: React.ReactNode;
  hint?: React.ReactNode;
  testid: string;
}
export interface PendingUploadFilesProps {
  files: File[];
  onRemove?: (index: number) => void;
  testid: string;
}
export interface NewAssetGroupDialogProps {
  groups: string[];
  onCreate(name: string, files: File[]): void;
  onClose(): void;
  onLeftOut?: (count: number) => void;
  "data-testid"?: string;
}
export interface AssetContextEdit {
  rename(asset: Application.EditorAsset): void;
  moveTo(assets: Application.EditorAsset[], group: string | symbol): void;
  remove(assets: Application.EditorAsset[]): void;
}
export interface AssetContextMenuProps {
  at: { x: number; y: number } | null;
  anchor?: "point" | "tap";
  onClose(): void;
  items: Application.EditorAsset[];
  groups: Application.EditorAssetGroup[];
  onOpen(asset: Application.EditorAsset): void;
  onDownload(asset: Application.EditorAsset): void;
  edit?: AssetContextEdit;
}
export interface AssetDetailsPreviewProps {
  asset: AssetThumbnail;
  files: Model.FileTable;
  storage: Model.StorageCatalog;
  size: "full" | "grid" | "small" | "tile";
}
export interface AssetDetailsDialogProps {
  asset: Application.EditorAsset;
  files: Model.FileTable;
  storage: Model.StorageCatalog;
  onClose(): void;
  onDownload(): void;
  onRename?: (name: string) => boolean | void;
  onRemove?: () => void;
  focusName?: boolean;
}
export interface DownloadCapability {
  save(options: {
    filename: string;
    data: Blob | ArrayBuffer;
    request?: unknown;
  }): Promise<unknown>;
}
export type ShellSaveData = Blob | ArrayBuffer | ArrayLike<number>;
export interface AddressedLoadState
  extends Omit<Model.AddressedFileLoadState, "gaveUpAt"> {
  gaveUpAt: string | null | undefined;
}
export type FileSource = () => string | undefined;
export interface ThumbnailEvent {
  currentTarget: HTMLImageElement | HTMLVideoElement;
}
export interface ThumbnailProbeResult {
  ok: boolean;
  status: number;
}
export interface ThumbnailSource {
  part: number;
  src?: string;
  onLoad?: () => void;
  onError?: (event: ThumbnailEvent) => void;
}
export type UploadDestination =
  | { to: "fonts" }
  | { to: "assets"; group: string; subpath: string };
export type UploadClassification =
  | { mode: "original"; warning?: string }
  | { mode: "reject"; reason: string };
export interface BlobFetchResponse {
  ok: boolean;
  headers?: Pick<Headers, "get">;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type BlobFetcher = (url: string) => Promise<BlobFetchResponse>;
export interface BlobResource {
  src: string;
  type: string;
  bytes?: number;
}
export interface AddressedFontSource {
  path: string;
  of: string;
  at: string;
  weight: string;
  style: string;
}
export interface AddressedFontFace {
  face: FontFace;
  of: string;
  at: string;
}
export type AssetTile = { kind: "asset" | "slot"; a: Application.EditorAsset };
export interface AssetLookup {
  a: Application.EditorAsset;
  g: Application.EditorAssetGroup;
}
export interface AssetGroupsListProps {
  groups: Application.EditorAssetGroup[];
  renderThumb(asset: AssetThumbnail): React.ReactNode;
  tiles?: AssetGridInteractions;
  onOpen(asset: Application.EditorAsset): void;
  footer?: React.ReactNode;
  headFor?: (
    group: Application.EditorAssetGroup,
  ) => Partial<import("./token-editors").SectionHead>;
  onUpload?: (group: Application.EditorAssetGroup) => void;
  onDropFiles?: (
    group: Application.EditorAssetGroup,
    event: React.DragEvent<HTMLElement>,
  ) => void;
  onRename?: (asset: Application.EditorAsset, name: string) => boolean | void;
  reveal?: string | null;
}
export interface AssetDragOverlayProps {
  drag: AssetDragView;
  tiles: AssetGridInteractions;
  lookup: Map<string, AssetLookup>;
  renderThumb: AssetGroupsListProps["renderThumb"];
}
export interface AssetGroupGridProps
  extends Omit<AssetGroupsListProps, "groups" | "headFor" | "reveal"> {
  group: Application.EditorAssetGroup;
  items: AssetTile[];
  head?: Partial<import("./token-editors").SectionHead>;
  title: string;
  tabStop: string | null;
  wanted?: string | null;
  targeted: boolean;
}
export interface AssetEditCommands
  extends Application.ApplicationCommands,
    DesignSystemEditPreparation {
  content(): Model.DesignSystemContent;
  lastNotUndoable(): string[];
}
export interface AssetGroupEditorOptions
  extends Omit<Application.AssetGroupEditorOptions, "edit"> {
  edit?: AssetEditCommands;
}
export interface AssetGroupEditorResult
  extends Omit<Application.AssetGroupEditor, "tiles"> {
  tiles: AssetGridInteractions;
}
export type DownloadBytesFetcher = (url: string) => Promise<Uint8Array | null>;
export interface DroppedFiles {
  files: File[];
  leftOut: number;
}
export interface DroppedDirectoryReader {
  readEntries(
    success: (entries: DroppedEntry[]) => void,
    error?: () => void,
  ): void;
}
export interface DroppedEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, error?: () => void) => void;
  createReader?: () => DroppedDirectoryReader;
}
export interface InferredFontMetadata {
  family: string;
  weight: string;
  style: "normal" | "italic" | "oblique";
}
export interface ColorContrastFixRequest {
  token: string;
  theme?: string;
  failing: { ground: string; ratio: string }[];
  min: string;
}
export type HandoffFile = Pick<
  Application.RefusedUpload,
  "name" | "bytes" | "handOff"
>;
export interface ConflictFlag {
  path: string;
  theirsSha: string | null;
  why?: string;
  clash?: string;
}
export interface ConflictSides {
  mine: string | null;
  theirs: string | null;
}
export interface ConflictDiffLine {
  kind: "same" | "mine" | "theirs";
  text: string;
}
export interface StuckSave {
  retryable: boolean;
  message: string;
}
export interface ConflictDocument {
  flaggedSides(path: string): Promise<ConflictSides>;
  resolveFlagged(
    path: string,
    side: "mine" | "theirs" | "copy",
  ): Promise<unknown> | void;
  retryStuck(): Promise<unknown> | void;
  flags?(): ReadonlyMap<string, ConflictFlag>;
  subscribeFlagged?: (listener: () => void) => () => void;
  stuck?(): StuckSave | undefined;
  subscribeSave?: (listener: () => void) => () => void;
}
export type ComponentPropValue = string | number | boolean;
export type ComponentPropValues = Record<string, ComponentPropValue>;
export type ComponentPreviewRenderer = (
  component: Application.EditorComponent,
  size: { height: number },
  mode: import("./preview").PreviewMode,
  tweaks?: ComponentPropValues,
) => React.ReactNode;
export interface ComponentStageProps {
  c: Application.EditorComponent;
  mode: import("./preview").PreviewMode;
  tweaks?: ComponentPropValues;
  renderPreview: ComponentPreviewRenderer;
}
export interface ComponentGuidelinesProps {
  c: Application.EditorComponent;
  edit?: Application.ComponentEditActions;
}
export interface ComponentPropFieldProps {
  spec: Model.InferredPropControl;
  value?: ComponentPropValue;
  placeholder?: string;
  onChange(value: ComponentPropValue | undefined): void;
}
export interface ComponentPropsEditorProps {
  c: Application.EditorComponent;
  specs: Model.InferredPropControl[];
  values?: ComponentPropValues;
  onChange(name: string, value: ComponentPropValue | undefined): void;
  onReset(): void;
}
export interface ComponentsSectionProps {
  components: Application.EditorComponent[];
  mode: import("./preview").PreviewMode;
  renderPreview: ComponentPreviewRenderer;
  propsOf?: (
    component: Application.EditorComponent,
  ) => Model.InferredPropControl[];
  edit?: Application.ComponentEditActions;
  head?: import("./token-editors").SectionHead;
  staticNote?: string;
  staticFiles?: readonly string[];
}
export interface CoverPreviewProps {
  cover: { height: number; previewHtml: string };
  head: import("./preview").PreviewHeadResult;
}
export type AssetUploadApi = Pick<
  import("./model-storage").AssetsCapability,
  "upload"
>;
export interface AssetFileUploadOptions
  extends Partial<Application.AssetIntakeOptions> {
  api?: AssetUploadApi | null;
  now?: () => string;
  sleep?: (delay: number) => Promise<void>;
}
export interface UploadProgress {
  i: number;
  n: number;
  batch?: Model.AssetUploadBatchState;
}
export type UploadedBlob = import("./model-storage").KnownStoredBlob & {
  sha256: string;
};
export type FileUploadResult = Model.AssetUploadResult & {
  record?: Model.AssetUploadRecord;
  warning?: string;
};
export type UploadedFileValue = { value: string } | { reason: string };
export type AssetUploadRoute = import("./model-storage").UploadBudget & {
  cat: Model.StorageCatalog;
};
export type AssetBatchUploadOptions = Application.AssetUploadOptions &
  AssetFileUploadOptions;
export interface UploadProblem {
  problem: Application.FileSaveProblem;
  path: string;
}
export interface RoomPeer {
  peer: string;
  by: string | null;
  isMe: boolean;
  sameTab: boolean;
  presence: object;
  updatedAt: number;
}
export interface RoomCapability {
  presence?: unknown;
  onPeers?: (
    success: (event: { peers: unknown }) => void,
    failure: () => void,
  ) => unknown;
}
export interface ClaudeEnvironment {
  // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
  designSystemHost?: {
    use?: (capability: string) => Promise<unknown> | unknown;
    room?: RoomCapability;
    comments?: OwnerChatCapability;
  };
  document?: Pick<Document, "body">;
}
export interface SessionPayload {
  request: string;
  label?: string;
  selectedText?: string;
}
export interface SessionRequest {
  request: string;
  fallbackPrompt: string;
  selection?: { text: string; label?: string } | null;
  deliver?: "send";
  onStatus?: (status: unknown) => void;
}
export interface SessionSender {
  sendToClaudeSession(
    payload: SessionPayload,
    options?: { deliver: "send"; onStatus?: (status: unknown) => void },
  ): Promise<unknown>;
  canSendToClaudeSession?: () => Promise<unknown> | unknown;
}
export interface SessionRoute {
  ns: SessionSender;
  road: "pane" | "summon" | "open" | "confirm";
}
export interface SessionRouteOptions {
  confirm?: boolean;
  resolveRoom?: () => Promise<unknown> | unknown;
}
export interface OwnerChatCapability {
  available?: boolean;
  canSendToClaude?: () => Promise<unknown> | unknown;
  anchorFor?: (element: Element) => Promise<unknown> | unknown;
  sendToClaude?: (payload: {
    anchor: unknown;
    text: string;
  }) => Promise<{ threadId?: unknown } | null | undefined>;
}
export interface RoomPeerStore {
  getSnapshot(): readonly RoomPeer[];
  subscribe(listener: () => void): () => boolean;
}
export interface FeatureFlagApi {
  ready(): Promise<unknown>;
  get(name: string, fallback: unknown): unknown;
  all(): unknown;
}
export type FeatureFlagValue =
  | boolean
  | string
  | number
  | bigint
  | symbol
  | null
  | undefined
  | object;
export type WidenFlag<T> = T extends boolean
  ? boolean
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends bigint
        ? bigint
        : T extends symbol
          ? symbol
          : T extends undefined
            ? undefined
            : T extends null
              ? unknown
              : T extends readonly unknown[]
                ? unknown[]
                : object;
export interface AnalyticsMessage {
  __frame_cap: true;
  cap: "analytics";
  id: string;
  method: "track";
  args: [string];
}
export interface AnalyticsTransport {
  framed(): boolean;
  post(message: AnalyticsMessage): void;
}
export type HealthReportArgs = Parameters<
  import("./platform-host").HealthReporter["report"]
>;
export type HealthAnalyticsReporter = (
  report: HealthReportArgs,
  event: string,
) => void;
export interface MigrationAnalyticsEvents {
  cleanupShown: string;
  cleanupPressed: string;
  cleanupOwnerChat: string;
  cleanupOutcome: Partial<Record<Application.ClaudeDeliveryKind, string>>;
  openedEditingOff: string;
  openedEditable: string;
  editingCameOn: string;
  openedNoColors: string;
  openedPreviewsMissing: string;
  foreignFilesNoticed: string;
}
export interface MigrationContext {
  editingOff?: boolean;
  editable: boolean;
  content: {
    components: Application.EditorComponent[];
    hasFiles: boolean;
    colorsEmpty: boolean;
    previewsCantRun: boolean;
  } | null;
}
export type MigrationStatus = Pick<
  import("./model-storage").StoredSystemStatus,
  "loaded" | "editingOff" | "migratedFrom" | "upgraded"
>;
export type TrackedClaudeRequest = Application.ClaudeRequest & {
  usage?: string;
};
export interface MigrationCleanupBannerProps {
  ask?: (request: TrackedClaudeRequest, trigger: HTMLElement | null) => void;
  busy?: boolean;
}
export interface MigrationCleanupButtonProps {
  busy?: boolean;
  onPress(trigger: HTMLButtonElement): void;
  "data-testid": string;
}
export interface ClaudeRequestButtonProps {
  label: string;
  ask: NonNullable<MigrationCleanupBannerProps["ask"]>;
  busy?: boolean;
  onAsked(): void;
}
export type PreviewFrameWindow = Window & {
  ResizeObserver?: typeof ResizeObserver;
  MutationObserver?: typeof MutationObserver;
};
export type PreviewAnimation = Animation & {
  transitionProperty?: string;
  effect: (AnimationEffect & { target?: Element | null }) | null;
};
export type PreviewAnimationDocument = Document & {
  getAnimations(): PreviewAnimation[];
};
export interface AnimatedPreviewHeight {
  a: PreviewAnimation;
  el: HTMLElement;
  h0: number;
}
export type PreviewPoolPhase = "idle" | "queued" | "live";
export interface PreviewPoolEntry {
  phase: PreviewPoolPhase;
  visible: boolean;
  lastVisible: number;
  booting: boolean;
  bootStartedAt: number;
}
export interface PreviewPoolSnapshot {
  live: string[];
  queued: string[];
  booting: string | null;
}
export interface PreviewFramePool {
  maxLive: number;
  now(): number;
  entries: Map<string, PreviewPoolEntry>;
  queue: string[];
  listeners: Set<() => void>;
  clock: number;
  phase(owner: string): PreviewPoolPhase;
  subscribe(listener: () => void): () => boolean;
  snapshot(): PreviewPoolSnapshot;
  visible(owner: string, visible: boolean): void;
  booted(owner: string): void;
  remove(owner: string): void;
  tick(): void;
  entry(owner: string): PreviewPoolEntry;
  liveCount(): number;
  anyBooting(): boolean;
  pump(): void;
  evictOne(): boolean;
}
export interface PreviewWaiting {
  taken?: () => void;
  remove(): void;
  notify(): void;
}
export interface PreviewRegistryOptions {
  global: string;
  tokenPrefix: string;
}
export interface PreviewDocumentRegistry<Doc> {
  docs: Map<string, Doc>;
  waiting: Map<string, PreviewWaiting>;
  seq: number;
  tookAt: number;
  take(token: string): Doc | undefined;
}
export type StatefulPreviewRegistry<Doc, State> = PreviewDocumentRegistry<Doc> &
  State;
export interface PreviewRunnerDocument {
  url: string;
  html: string;
}
export interface PreviewRunnerState {
  on: boolean;
  worked: boolean;
  strikes: number;
  struckAt: number;
  off: boolean;
  refusals: number;
  pauses: number[];
  refusedSeq: number;
  refusedAt: number;
  suspended: boolean;
}
export type PreviewRunnerRegistry = StatefulPreviewRegistry<
  PreviewRunnerDocument,
  PreviewRunnerState
>;
export type PreviewRuntimeHead = Omit<
  Model.SwatchHead,
  "runtimeScripts" | "runtimeTags" | "urls"
> & {
  runtimeScripts: readonly string[];
  runtimeTags?: readonly Model.SwatchRuntimeTag[];
  urls?: PreviewRuntimeUrls;
};
export interface PreviewRuntimeUrls {
  bundleCss?: SwatchUrlReference;
  bundleJs?: SwatchUrlReference;
  runtimeScripts: readonly (SwatchUrlReference | undefined)[];
  fonts: readonly (SwatchUrlReference & {
    face?: Model.SwatchFontReference["face"];
  })[];
}
export interface StaticPreviewFrameProps
  extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  html: string;
  head?: PreviewRuntimeHead;
  pageW?: number;
  pageH?: number;
  fitWidth: number;
  title: string;
}
export type PublishedFileKind = "style" | "script" | "font";
export interface PublishedFileWire {
  sha256?: unknown;
  size?: unknown;
  contentType?: unknown;
}
export interface PublishedListingWire {
  files?: unknown;
  ver?: unknown;
  narrowed?: unknown;
}
export interface PublishedListing {
  version: string;
  facts: Map<string, Model.PublishedFileFacts>;
  complete: boolean;
}
export interface ListingRetryState {
  tries: number;
  narrowed: boolean;
  until: number;
}
export interface PublishedRegistryOptions {
  fetchListing?: () => Promise<unknown>;
  addressedVersion?: () => string;
  now?: () => number;
}
export interface PublishedFilesRegistry {
  addressedFile(path: string): Model.PublishedFileFacts | null | undefined;
  addressedSettled(): string | boolean;
  onAddressedChange(listener: () => void): () => void;
}
export interface PreviewHashEntry {
  value: string;
  stays: boolean;
  sha?: string;
}
export interface PublishedPreviewCacheOptions {
  enabled?: () => boolean;
  addressedFile?: (path: string) => Model.PublishedFileFacts | null | undefined;
  baseURI?: () => string;
  hash?: (bytes: string | Uint8Array) => string | Promise<string>;
  setTimer?: (callback: () => void, delay: number) => unknown;
  warn?: (text: string) => void;
  info?: (text: string) => void;
  onAddressedChange?: (listener: () => void) => () => void;
}
export interface PublishedPreviewCache {
  publishedUrl(
    path: string,
    contents: string,
    kind: PublishedFileKind,
  ): Model.PublishedFileReference | undefined;
  noteFailed(
    url: string,
    label: string | undefined,
    timeoutSeconds?: string | number,
  ): void;
  noteAddressBehind(): void;
  stillOffered(url: string): boolean;
  generation(): number;
  subscribe(listener: () => void): () => void;
}
export interface SwatchUrlReference {
  url: string;
  integrity?: string;
  file?: string;
}
export interface SwatchHeadEntry {
  head: PreviewRuntimeHead;
  refs: number;
  missed(piece: string | number): void;
}
export type HeadScriptPiece = "o" | "t" | "f" | "F" | "c" | "b" | number;
export type HeadPlacementState =
  | { state: "gone" | "placed" | "not-reached" | "no-document" }
  | { state: "waiting"; on?: SwatchUrlReference };
export interface SwatchHeadUrls {
  urls?: PreviewRuntimeUrls;
  heldFonts: boolean;
  awaited: SwatchUrlReference[];
}
export interface LiveSwatchOptions
  extends Omit<Model.SwatchDocumentOptions, "head" | "onUrlMissed"> {
  head: PreviewRuntimeHead;
  onUrlMissed?: (reference: SwatchUrlReference) => void;
}
export interface LiveSwatch {
  iframe: HTMLIFrameElement;
  awaited: SwatchUrlReference[];
  headProgress(): HeadPlacementState;
  documentAgeMs(): number | undefined;
  dispose(): void;
}
export type PreviewMessageKind =
  | "drop"
  | "navigating"
  | "ready"
  | "error"
  | "error-react";
export interface ComponentPreviewProps {
  html: string;
  cardFile?: string;
  fromProps?: boolean;
  head: PreviewRuntimeHead;
  height: number;
  title: string;
  staticReason?: string;
  staticPageWidth?: number;
  onStaticNote?: (note: string | null) => void;
  "data-testid"?: string;
}

export type AssetThumbnail = Pick<Application.EditorAsset,"path"|"name"|"kind"|"ext"> & Partial<Omit<Application.EditorAsset,"path"|"name"|"kind"|"ext">>;
