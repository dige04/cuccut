/** Application interaction contracts recovered from the shipped navigation and focus controllers. */
import type { ReactNode, RefObject } from "react";
import type { AssetGridInteractions, DesignSystemEditPreparation } from "./editor-runtime";
import type {
  MarkdownCommitClock,
  ParsedAssetGroup,
  ParsedComponent,
  ScalarToken,
  ShadowToken,
  TokenFamily,
  TypographyGroup,
} from "../contracts";
export interface SectionRow {
  id: string;
  label: string;
  count?: number;
  countLabel?: string;
}
export interface SearchEntry {
  section: string;
  label: string;
  words: string[];
  target?: string;
  asset?: string;
}
export interface SearchHit {
  entry: SearchEntry;
  detail?: string;
}
export interface SearchResult {
  groups: { section: string; hits: SearchHit[] }[];
  total: number;
  hidden: number;
  bestRow: number;
}
export interface RankedSearchEntry {
  entry: SearchEntry;
  rank: number;
}
export interface SearchRankGroup {
  section: string;
  head?: number;
  named: RankedSearchEntry[];
  other: RankedSearchEntry[];
}
export interface SearchColorToken {
  name: string;
  value: Record<string, string>;
  alias?: Record<string, { css: string }>;
  usage: string;
}
export type SearchSnapshot = Pick<
  ApplicationView,
  | "docs"
  | "colorGroups"
  | "typeGroups"
  | "familyNames"
  | "spacing"
  | "corners"
  | "shadows"
  | "components"
  | "assetGroups"
  | "extras"
>;

export interface NavigationPillActivity {
  bump(milliseconds?: number): void;
  hold(held: boolean): void;
  dispose(): void;
}
export type NavigationPillClock = MarkdownCommitClock;
export interface FocusRegion {
  el(): HTMLElement | null;
  fallback?(): HTMLElement | null;
  home?: boolean;
  ownsKey?: boolean;
  landOnSelf?: boolean;
}
export interface LiveFocusRegion {
  region: FocusRegion;
  el: HTMLElement;
}
export interface FocusRegionOptions {
  blocked?(): boolean;
  rendered?(element: HTMLElement): boolean;
  say?(message: string): void;
  now?(): number;
}
export interface FocusRegionController {
  move(direction: number): boolean;
  hint(name: string): void;
  dispose(): void;
}
export interface SectionPosition {
  id: string;
  top: number;
}
export interface ScrollViewport {
  top: number;
  bottom: number;
}
export type ScrollEdge = "top" | "bottom" | null;
export interface SectionScroller {
  current: string;
  jump(section: string): void;
  wanted: Set<string>;
  want(section: string): void;
  mark(section: string): void;
  attach(element: HTMLElement | null): void;
  moved: boolean;
  port: HTMLElement | null;
}
export interface LazySectionProps {
  root: Element | null;
  eager?: boolean;
  standIn: ReactNode;
  children(): ReactNode;
}
export type SectionRefs = RefObject<
  Record<string, HTMLElement | null | undefined>
>;

export interface NavigationSearchRuntime {
  isApplePlatform(): boolean;
  commentTargetId(kind: string, identifier: string): string;
  assetGroupDisplayName(name: string): string;
  extraTokenFamilySectionId(key: string): string;
  optionMatchesQuery(query: string, ...values: string[]): boolean;
  markdownCommitClock: NavigationPillClock;
}
export interface NavigationSearch {
  index: SearchEntry[];
  tail?: SearchEntry[];
  onPick(entry: SearchEntry): void;
}
export interface PendingSections {
  rows: SectionRow[];
  tip: string;
  panel(row: SectionRow, close: () => void): ReactNode;
}
export interface NavigationProps {
  sections: SectionRow[];
  tail?: SectionRow[];
  current: string;
  onJump(section: string): void;
  marks?: ReadonlySet<string>;
  pending?: PendingSections;
  search?: NavigationSearch;
  footer?: ReactNode;
  navRef?: import("react").Ref<HTMLElement>;
  dropProps?: import("react").HTMLAttributes<HTMLElement>;
}
export interface FloatingNavigationProps extends NavigationProps {
  status?: ReactNode;
  edgeRef?: import("react").Ref<HTMLDivElement>;
  port: HTMLElement | null;
}
export interface NavigationRowsProps extends Omit<NavigationProps, "search"> {
  hits?: { result: SearchResult; onPick(entry: SearchEntry): void };
}
export interface PendingSectionRowProps {
  row: SectionRow;
  tip: string;
  tipId: string;
  panel(row: SectionRow, close: () => void): ReactNode;
}
export interface NavigationSearchState {
  query: string;
  setQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
  result: SearchResult | null;
  box: RefObject<HTMLSpanElement | null>;
}
export interface SectionSearchFieldProps extends NavigationSearchState {
  escapeToRow?: boolean;
}
export interface NavigationRuntime {
  reactSectionNavigation: typeof import("react");
  searchSectionsAndFiles(
    index: SearchEntry[],
    files: SearchEntry[] | undefined,
    query: string,
  ): SearchResult;
  createNavigationPillActivity(
    hold: number,
    onChange: (active: boolean) => void,
  ): NavigationPillActivity;
  isFindShortcut(event: KeyboardEvent): boolean;
  isComposingEvent(
    event: KeyboardEvent | import("react").KeyboardEvent,
  ): boolean;
  hasOpenOverlay(): boolean;
  isOverlayClosed(element: Element): boolean;
  OPEN_OVERLAY_SELECTOR: string;
  createOptionListKeyHandler(
    selector: string,
  ): import("react").KeyboardEventHandler<HTMLElement>;
}
export type ScalarTokenKind = "spacing" | "radius" | "extra";
export type AddTokenKind = "color" | "type" | "shadow" | ScalarTokenKind;
export interface NewTokenGroup {
  key: string;
  label: string;
  seed: string;
}
export interface NewTypeStyle {
  family: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  letterSpacing: string;
}
export interface AddTokenBase {
  name: string;
  taken: ReadonlySet<string>;
}
export type AddTokenRequest =
  | (AddTokenBase & {
      kind: "color";
      themes: { id: string; name: string }[];
      names: ReadonlySet<string>;
      value: string;
      groups: NewTokenGroup[];
      group: string;
      namespace: string;
      seedFor(group: string): string;
      groupOf(name: string): string;
    })
  | (AddTokenBase & {
      kind: "type";
      families: Record<string, string>;
      familyNames: Record<string, string>;
      fontNames: string[];
      style: NewTypeStyle;
      sets: string[];
      set: string;
    })
  | (AddTokenBase & {
      kind: "shadow";
      themes: { id: string; name: string }[];
      value: string;
    })
  | (AddTokenBase & {
      kind: ScalarTokenKind;
      label: string;
      value: string;
      namespace?: string;
      group?: string;
      groups?: NewTokenGroup[];
      groupOf?(name: string): string;
    });
export type AddedToken =
  | {
      kind: "color";
      name: string;
      group: string;
      newGroup: boolean;
      values: Record<string, string>;
      usage: string;
    }
  | {
      kind: "shadow";
      name: string;
      values: Record<string, string>;
      usage: string;
    }
  | {
      kind: "type";
      name: string;
      set: string;
      newSet: boolean;
      style: NewTypeStyle;
      font?: string;
      usage: string;
    }
  | {
      kind: ScalarTokenKind;
      name: string;
      value: string | undefined;
      usage: string;
      group?: string;
    };
export interface AddTokenDialogProps {
  req: AddTokenRequest;
  onSubmit(token: AddedToken): void;
  onClose(): void;
  "data-testid"?: string;
}
export interface AddDialogFieldProps {
  label: string;
  testid?: string;
  children: ReactNode;
  hint?: ReactNode;
  knob?: string;
  top?: boolean;
}
export interface AddTokenDialogRuntime {
  reactDesignSystemEditors: typeof import("react");
  normalizeTokenName(value: string): string;
  normalizeColorEditorInput(value: string): string;
  isColorOrAlias(value: string): boolean;
  isColorLiteral(value: string): boolean;
  colorAliasTarget(value: string): string | undefined;
  normalizeScalarTokenValue(
    kind: ScalarTokenKind,
    value: string,
  ): string | undefined;
  normalizeCssLength(value: string, negative: boolean): string | undefined;
  normalizeLineHeight(value: string): string | undefined;
  normalizeThemeId(value: string): string;
  normalizeBoxShadow(value: string): string | undefined;
  validateNewFontFamily(
    family: string,
    existing: Record<string, string>,
  ): string | null;
  validateTokenRename(
    name: string,
    current: string,
    taken: ReadonlySet<string>,
  ): string | null;
  parseEditableCssLength(value: string): { n: number; unit: string } | null;
  typeStylePreviewStyle(
    style: Omit<NewTypeStyle, "family"> & { name: string },
    family: string,
  ): import("react").CSSProperties;
  isSafeBoxShadow(value: string): boolean;
  cssLengthPreviewPixels(value: string): number | null;
  cssLengthInputStep(unit: string): number;
  MAX_EDITABLE_CSS_LENGTH: number;
  MAX_TOKEN_LABEL_LENGTH: number;
  isComposingEvent(
    event: KeyboardEvent | import("react").KeyboardEvent,
  ): boolean;
}
export interface FileEditStep {
  label: string;
  do(): void;
  undo(): void;
  canDo?(): boolean;
  canUndo?(): boolean;
}
export interface FileEditHistory {
  exec(step: FileEditStep): void;
  seed(step: FileEditStep): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  redoDepth(): number;
  clear(): void;
  subscribe(listener: () => void): () => void;
}
export interface ApplicationSaveState {
  status:
    | "saved"
    | "ready"
    | "dirty"
    | "saving"
    | "error"
    | "readonly"
    | "loading"
    | "cached";
  message?: string;
}
export interface ApplicationDocument {
  title(): string;
  stashOffer(): { at: number } | undefined;
  restoreStash(): FileEditStep | undefined;
  discardStash(): void;
  content(): import("../contracts").DesignSystemContent;
  readOnly(): boolean;
  dirty(): boolean;
  restoreCount(): number;
  save(): Promise<void>;
  saveMode(): "manual" | "auto";
  saveState(): ApplicationSaveState;
  subscribe(listener: () => void): () => void;
  subscribeSave(listener: (state: ApplicationSaveState) => void): () => void;
  readonly neverSaves?: (
    path: string,
    value: string,
  ) => FileSaveProblem | undefined;
}
export interface ApplicationStore {
  doc: ApplicationDocument;
  bootReport: import("../contracts").ParseReport;
  holdAutosave: boolean;
  beforeSave: (() => Promise<unknown>) | null;
  content(): import("../contracts").DesignSystemContent;
  getSnapshot(): import("../contracts").ParsedDesignSystem & { title: string };
  subscribe(listener: () => void): () => void;
  update(
    mutate: (
      content: import("../contracts").DesignSystemContent,
    ) => import("../contracts").DesignSystemContent,
    options?: { auto?: boolean },
  ): void;
  setNote(
    note: string,
    announcedFiles?: import("../contracts").FileTable,
  ): void;
}
export interface ApplicationCommands extends DesignSystemEditPreparation {
  undo: FileEditHistory;
  exec(
    label: string,
    mutate: (
      content: import("../contracts").DesignSystemContent,
    ) => import("../contracts").DesignSystemContent,
    options?: { withoutBytes?: string[] },
  ): boolean;
  set(
    key: string,
    mutate: (
      content: import("../contracts").DesignSystemContent,
    ) => import("../contracts").DesignSystemContent,
  ): boolean;
  seal(): void;
}
export interface EditorScalarToken {
  name: string;
  value: string;
  usage?: string;
}
export interface EditorScale<T = EditorScalarToken> {
  note?: string;
  tokens: T[];
}
export interface EditorTypeStyle extends Omit<NewTypeStyle, "family"> {
  name: string;
  familyKey?: string;
  opticalSize?: number;
  sample?: string;
  usage?: string;
}
export interface EditorTypeGroup {
  name: string;
  family: string;
  note?: string;
  styles: EditorTypeStyle[];
}
export interface EditorColorToken {
  name: string;
  value: Record<string, string>;
  alias?: Record<string, { to: string; css?: string }>;
  usage?: string;
}
export interface EditorColorGroup {
  name: string;
  tokens: EditorColorToken[];
  numeric?: boolean;
}
export interface EditorFont {
  path: string;
  family: string;
  weight: string;
  style: string;
  format: string;
  missing: boolean;
  stray: boolean;
  asset?: true;
}
export interface EditorAsset
  extends Omit<import("../contracts").ParsedAsset, "isText"> {}
export interface EditorAssetGroup {
  name: string;
  slug: string;
  folder: string;
  tile: import("../contracts").AssetTileSize;
  assets: EditorAsset[];
}
export interface EditorComponent {
  name: string;
  previewHtml?: string;
  previewHeight: number;
  previewWidth?: number;
  guidelines?: string;
  guidelinesPath?: string;
  types?: string;
  group?: string;
  subtitle?: string;
  floor?: true;
}
export interface EditorExtraScale {
  key: string;
  id: string;
  title: string;
  scale: EditorScale;
}
export interface ApplicationView {
  colorGroups: EditorColorGroup[];
  typeGroups: EditorTypeGroup[];
  familyNames: Record<string, string>;
  families: Record<string, string>;
  fonts: EditorFont[];
  spacing: EditorScale;
  corners: EditorScale;
  shadows: EditorScale<{
    name: string;
    value: Record<string, string>;
    usage?: string;
  }>;
  extras: EditorExtraScale[];
  components: EditorComponent[];
  assetGroups: EditorAssetGroup[];
  readme: string;
  docs: { path: string; id: string; title: string; markdown: string }[];
}
export interface TokenDialogState {
  req: AddTokenRequest;
  land(token: AddedToken): void;
}
export interface ConfirmationState {
  title: string;
  confirmLabel?: string;
  body: ReactNode;
  run(): void;
}
export interface TokenFlashTarget {
  name: string;
  scroll: boolean;
  group?: string;
}
export interface AssetRevealTarget {
  kind: "type" | "assets" | "guidance";
  key: string;
  focus?: boolean | "title";
}
export interface ArtifactDownloadOutcome {
  outcome:
    | "declined"
    | "withheld"
    | "saved"
    | "downloaded"
    | "refused"
    | "failed";
  shell: ShellSaveResult;
}

export interface ApplicationRuntime
  extends ApplicationAssetsRuntime,
    ApplicationHandoffRuntime,
    ApplicationModelRuntime,
    ApplicationUiRuntime {
  EMPTY_SECTION_HINTS: Readonly<Record<string, string>>;
  tokenScaleGroups(
    kind: ScalarTokenKind,
    scale: EditorScale,
  ): ScalarScaleGroup[];
  extraTokenScaleGroups(families: EditorExtraScale[]): ScalarScaleGroup[];
  tokenScaleGroupId(group: ScalarScaleGroup): string;
  tokenScaleGroupLabel(group: ScalarScaleGroup): string;
  groupedTokenScale(
    kind: ScalarTokenKind,
    tokens: EditorScalarToken[],
  ): { name: string; tokens: EditorScalarToken[] }[] | null;

  STARTER_SECTION_IDS: string[];
  useEditorCardFlash(root: import("react").RefObject<HTMLElement | null>): {
    reveal(target: AssetRevealTarget): void;
    pending: { kind: string; key: string; focus?: boolean | "title" } | null;
  };
  createEditorSectionNavigationActions(
    options: EditorSectionNavigationActionOptions,
  ): EditorSectionNavigationActions;
  useEditorSectionNavigation(
    options: EditorSectionNavigationActions & {
      sections: SectionRefs;
      port: HTMLElement | null;
    },
  ): { release(): void; reveal(target: EditorSectionReveal): void };
  inferComponentPropControls(
    name: string,
    sources: (string | undefined)[],
    options?: { keep?: string[] },
  ): import("../contracts").InferredPropControl[];
  hasOnlyManifestFile(files: import("../contracts").FileTable): boolean;
  emptyDesignSystemSections(
    view: ApplicationView,
    storage: { storedBytes: number },
  ): Set<string>;
  starterSectionState(
    empty: ReadonlySet<string>,
    editable: boolean,
    assetsEmpty: boolean,
    hasStarter?: boolean,
  ): { hint: boolean; starter: Set<string> };
  tokenNamesForFamily(
    tokens: import("../contracts").NormalizedTokens,
    kind: AddTokenKind,
  ): string[];
  commonTokenNamePrefix(names: string[]): string;
  tokenGroupRenamePairs(
    names: string[],
    namespace: string,
    previous: string,
    next: string,
  ): [string, string][];
  unusedTokenName(
    tokens: import("../contracts").NormalizedTokens,
    kind: AddTokenKind,
    seed: string,
  ): string;

  subscribeStoredSystemStatus(listener: () => void): () => void;
  getStoredSystemStatus(): {
    loaded: boolean;
    editingOff?: boolean;
    carried: unknown[];
    carriedMore: number;
  };
  DesignSystemStore: new () => ApplicationStore;
  createFileMutationBatch(): FileEditHistory;
  createAnnouncedHistory(history: FileEditHistory): FileEditHistory;
  createDesignSystemCommands(
    doc: ApplicationDocument,
    history: FileEditHistory,
    shared: FileEditHistory,
  ): ApplicationCommands;
  useConflictedSections(doc: ApplicationDocument): ReadonlySet<string>;
  designSystemEditorView(
    model: import("../contracts").ParsedDesignSystem,
  ): ApplicationView;
  knownWebFontFamily(family: string): string | undefined;
  googleFontStylesheetUrl(family: string): string;
  resolveColorTokenValue(
    token: import("../contracts").ColorToken,
    theme: string,
    tokens: import("../contracts").NormalizedTokens,
  ): string | undefined;
  isColorLiteral(value: string): boolean;
  isDarkThemeName(name: string): boolean;
  initialSectionFromHash(
    sections: string[] | ((section: string) => boolean),
    fallback: string,
  ): string;
  extraTokenFamilySectionId(key: string): string;
  unsupportedDownloadMessage(name: string, code: string): string;
  DOWNLOADS_UNAVAILABLE_MESSAGE: string;
  migrationOpenedAnalyticsEvents(context: unknown): unknown[];
  reportMigrationAnalytics(event: unknown): void;
  useFocusRegions(regions: FocusRegion[]): Pick<FocusRegionController, "hint">;
  notificationsFocusRegion(): FocusRegion;
  buildSectionSearchIndex(
    snapshot: SearchSnapshot,
    sections: SectionRow[],
    titles?: Readonly<Record<string, string>>,
  ): SearchEntry[];
  useSectionScroller(
    ids: string[],
    header: () => number | undefined,
    sections: SectionRefs,
    initial: string,
  ): SectionScroller;
}

export interface WelcomeIntakeSummary {
  refused: string[];
  landTo: "type" | "assets" | null;
}
export interface IntakeQueueEntry {
  files: File[];
  group: string | null;
  fromStart: boolean;
}
export interface TokenEditActions {
  remove(name: string): void;
  rename(name: string, next: string): boolean;
  done(): void;
}
export interface ColorEditActions extends TokenEditActions {
  usage(name: string, usage: string): void;
  value(name: string, theme: string, value: string): void;
  clear(name: string, theme: string): void;
  addTo(group: EditorColorGroup): void;
  addGroup(newGroup?: boolean): void;
  removeGroup(group: EditorColorGroup): void;
  renameGroup(group: EditorColorGroup, next: string): boolean;
}
export interface ScalarEditActions extends TokenEditActions {
  value(name: string, value: string): void;
  usage(name: string, usage: string): void;
  note(note: string): void;
}
export interface ShadowEditActions extends TokenEditActions {
  value(name: string, theme: string, value: string): void;
  live(name: string, theme: string, value: string): void;
  usage(name: string, usage: string): void;
}
export type TypographyEditableField =
  | keyof NewTypeStyle
  | "opticalSize"
  | "sample";
export interface TypographyEditActions extends TokenEditActions {
  setField(
    name: string,
    field: TypographyEditableField,
    value: string | number | null,
  ): void;
  setFont(name: string, family: string): void;
  setUsage(name: string, usage: string): void;
  dropMissingFonts(): void;
}
export interface ComponentEditActions {
  setGuidelines(name: string, markdown: string): void;
  done(): void;
}
export interface EditorSectionReveal {
  section: string;
  target: string;
  label: string;
}
export interface EditorSectionNavigationActions {
  shown(target: EditorSectionReveal): void;
  miss(target: EditorSectionReveal): void;
}
export interface EditorSectionNavigationActionOptions {
  sectionLabel(section: string): string | undefined;
  show(section: string): void;
  mark(section: string): void;
  sectionEl(section: string): HTMLElement | null | undefined;
  say(message: string): void;
}
export interface ScalarScaleGroup {
  kind: ScalarTokenKind;
  name: string;
  tokens: EditorScalarToken[];
  family?: { key: string; title: string };
}
/** The upload UI reads normalized results, while capability handles are only forwarded. */
export interface StoredAsset {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
export type AssetCatalogueState =
  | { state: "unknown" }
  | { state: "unavailable"; code: string }
  | {
      state: "listed";
      byId: Map<string, StoredAsset>;
      usage: {
        files: number;
        bytes: number;
        maxFiles: number;
        maxBytes: number;
      };
    };
export interface ReclaimableAsset {
  id: string;
  bytes: number;
}
export interface AssetReclamation {
  missing: string[];
  missingIds: Set<string>;
  reclaimable: ReclaimableAsset[];
  reclaimableBytes: number;
  windowed: boolean;
}
export interface AssetDeletionResult {
  freed: Map<string, number>;
  unavailable: boolean;
  rateLimited: boolean;
  kept: string[];
}
export interface RefusedUpload {
  name: string;
  bytes: number;
  reason: string;
  handOff?: string;
  atDoor?: boolean;
}
export interface AssetUploadSummary {
  fonts: number;
  assets: Record<string, number>;
  blobs: number;
  refused: RefusedUpload[];
  warnings: string[];
}
export interface UploadFontInput {
  fileName: string;
  value: string;
  family: string;
  weight: string;
  style: "normal" | "italic" | "oblique";
  record?: import("../contracts").AssetUploadRecord;
}
export interface UploadAssetInput {
  group: string;
  subpath: string;
  fileName: string;
  value: string;
  record?: import("../contracts").AssetUploadRecord;
}
export interface FileSaveProblem {
  forNow?: boolean;
  why: string;
  cause: string;
}
export type UploadCommitResult =
  | boolean
  | { problem: FileSaveProblem; path: string };
export type ContentMutation = (
  content: import("../contracts").DesignSystemContent,
) => import("../contracts").DesignSystemContent;
export interface AssetIntakeOptions {
  room(): number;
  catalogue(): import("../contracts").StorageCatalog;
  freeing(): ReadonlySet<string>;
  onProgress(text: string | null): void;
  onTierOff(reason: string): void;
}
export interface AssetUploadOptions extends AssetIntakeOptions {
  font(font: UploadFontInput, file: File): UploadCommitResult;
  asset(asset: UploadAssetInput, file: File): UploadCommitResult;
}
export interface ShellSaveResult {
  outcome: "saved" | "declined" | "withheld" | "unsupported";
  code: string;
}
export interface ZipEntry {
  name: string;
  data: string | Uint8Array;
}
export interface ClaudeRequest {
  label?: string;
  prompt: string;
  request?: string;
  deliver?: "send";
  ownerChat?: boolean;
}
export interface ClaudeDeliveryContext {
  sender: object | null;
  ownerChat: object | null;
}
export interface ClaudeDeliveryContextStore {
  current(): ClaudeDeliveryContext;
  refresh(): void;
}
export type ClaudeDeliveryRoad = "sender" | "held" | "ownerChat";
export type ClaudeDeliveryKind =
  | "sent"
  | "staged"
  | "unanswered"
  | "suggested"
  | "copied"
  | "failed";
export interface ClaudeDeliveryResult {
  kind: ClaudeDeliveryKind;
  held?: boolean;
  threadId?: string;
}
export interface AssetGridState extends AssetGridInteractions {}
export interface AssetGroupEditor {
  tiles: AssetGridState;
  headFor(group: EditorAssetGroup): {
    onRename?(name: string): void;
    onRemove?(): void;
    autoEdit?: { placeholder: string; onEnd(): void };
  };
  overlay: ReactNode;
  renaming: string | null;
  clearRenaming(): void;
  nameGroup(name: string): void;
  remove(paths: string[]): void;
}
export interface AssetGroupEditorOptions {
  groups: EditorAssetGroup[];
  edit?: ApplicationCommands;
  files(): import("../contracts").FileTable;
  scroller: RefObject<HTMLElement | null>;
  openAsset(path: string): void;
  downloadAsset(asset: EditorAsset): void;
  askRemove(confirmation: ConfirmationState): void;
  removed(message: string): void;
  reveal(target: AssetRevealTarget): void;
}
export interface DesignSystemFilesBrowser {
  row?: SectionRow;
  open: boolean;
  show(target?: string): void;
  close(restore?: boolean): void;
  leave(land: () => void): void;
  layer: ReactNode;
  covered: { inert?: boolean; "data-covered"?: string };
  searchEntries: SearchEntry[];
}
export interface ApplicationAssetsRuntime {
  getAssetsCatalogState(): AssetCatalogueState;
  resolveAssetsCapability(): Promise<unknown>;
  refreshAssetsCatalog(capability?: unknown): Promise<AssetCatalogueState>;
  subscribeAssetsState(listener: () => void): () => void;
  assessAssetReclamation(
    files: import("../contracts").FileTable,
    preserved?: ReadonlySet<string>,
  ): AssetReclamation | null;
  publishedPageBlobIds(): Promise<Set<string> | null>;
  excludePublishedAssets(
    assets: ReclaimableAsset[],
    published: ReadonlySet<string> | null,
  ): ReclaimableAsset[];
  deleteStoredAssets(
    assets: readonly ReclaimableAsset[],
    providedAssets?: Pick<
      import("./model-storage").AssetsCapability,
      "delete"
    > | null,
    options?: import("./model-storage").AssetRetryOptions,
  ): Promise<AssetDeletionResult>;
  reclaimAssetsResultMessage(result: AssetDeletionResult): string;
  reclaimAssetsConfirmation(count: number, bytes: number): string;
  reclaimAssetsButtonLabel(
    bytes: number,
    count: number,
    unavailable?: boolean,
    windowed?: boolean,
  ): string;
  missingAssetsMessage(paths: string[]): string;
  assetStorageUsageMessage(
    catalogue: AssetCatalogueState,
    usage: { files: number; bytes: number },
  ): string;
  uniqueStoredBlobCount(
    catalogue: import("../contracts").StorageCatalog,
  ): number;
  inlineStorageFallbackMessage(reason: string): string;
  isUnboundedFileParsing(): boolean;
  existingFontUploadFiles(
    files: import("../contracts").FileTable,
    options: AssetIntakeOptions,
    commit: (
      path: string,
      previous: string,
      next: string,
      record: import("../contracts").AssetUploadRecord,
    ) => boolean,
  ): Promise<number>;
  replaceInlineFileWithPointer(
    content: import("../contracts").DesignSystemContent,
    path: string,
    previous: string,
    next: string,
    record: import("../contracts").AssetUploadRecord,
  ): import("../contracts").DesignSystemContent;
  uploadAssetFiles(
    files: File[],
    options: AssetUploadOptions,
    group?: string,
  ): Promise<AssetUploadSummary>;
  commitUploadedAssetChange(
    change: (mutate: ContentMutation) => boolean,
    mutate: ContentMutation,
    validate?: (path: string, value: string) => FileSaveProblem | undefined,
  ): UploadCommitResult;
  mergeAssetUploadResults(
    left: AssetUploadSummary,
    right: AssetUploadSummary,
  ): AssetUploadSummary;
  countSuccessfulUploads(result: AssetUploadSummary): number;
  addedFilesSummary(result: AssetUploadSummary): string;
  uploadedFilesBuildSummary(result: AssetUploadSummary): string;
  uploadResultSummary(
    result: AssetUploadSummary,
    saved: boolean,
    build?: boolean,
  ): { text: string; handOff?: RefusedUpload[] } | null;
  uploadedAssetFile(file: File): import("../contracts").UploadedAssetFile;
  uploadedFileRelativePath(file: File): string;
  isIgnoredUploadFile(file: File): boolean;
  extractDroppedFiles(
    data: DataTransfer,
  ): Promise<{ files: File[]; leftOut: number }>;
  pickUploadFiles(multiple?: boolean, accept?: string): Promise<File[]>;
  readDownloadFileBytes(
    files: import("../contracts").FileTable,
    path: string,
    storage: import("../contracts").StorageCatalog,
  ): Promise<Uint8Array | null>;
  saveDownloadFile(
    name: string,
    data: string | Uint8Array,
    mime: string,
  ): Promise<ArtifactDownloadOutcome>;
  collectDownloadFiles(
    files: import("../contracts").FileTable,
    tokens: import("../contracts").NormalizedTokens,
    title: string,
    storage: import("../contracts").StorageCatalog,
  ): Promise<{ entries: ZipEntry[]; skipped: string[] }>;
  createStoredZip(entries: ZipEntry[]): Uint8Array;
  downloadZipBaseName(name: string): string;
  useAssetGroupEditor(options: AssetGroupEditorOptions): AssetGroupEditor;
  performDesignSystemEdit(
    editor: ApplicationCommands,
    mutate: ContentMutation,
    ready: (options?: { withoutBytes: string[] }) => boolean | void,
    options: {
      nameOf(path: string): string;
      say?(message: string): void;
      ask?(confirmation: Omit<ConfirmationState, "confirmLabel">): void;
    },
    verb?: string,
  ): boolean | void;
}
export interface ApplicationHandoffRuntime {
  createClaudeDeliveryContextStore(): ClaudeDeliveryContextStore;
  chooseClaudeDeliveryRoad(
    request: ClaudeRequest,
    context: ClaudeDeliveryContext,
    held: boolean,
  ): ClaudeDeliveryRoad;
  deliverClaudeRequest(
    request: ClaudeRequest,
    anchor: Element | null | undefined,
    context: ClaudeDeliveryContext,
    held?: boolean,
  ): Promise<ClaudeDeliveryResult>;
  copyTextToClipboard(text: string): Promise<boolean>;
  claudeSendResultMessage(
    kind:
      | "staged"
      | "waiting"
      | "unanswered"
      | "sent"
      | "started"
      | "copied"
      | "failed",
  ): string;
  claudeSendResultMessage(kind: string): string | undefined;
  claudeDeliveryStatusMessage(kind: ClaudeDeliveryKind, held: boolean): string;
  artifactPageAddress(): string;
  githubStarterPrompt(address: string): string;
  viewerGitHubSyncPrompt(address: string): string;
  viewerEmptySystemPrompt(address: string, action: string): string;
  ownerEmptySystemPrompt(address: string, action: string): string;
  viewerBuildFromFilesPrompt(
    count: number,
    address: string,
    action: string,
  ): string;
  ownerBuildFromFilesPrompt(
    files: { name: string; bytes: number }[],
    address: string,
    action: string,
  ): string;
  ownerHandoffFilesPrompt(files: RefusedUpload[], address: string): string;
  viewerHandoffFilesPrompt(files: RefusedUpload[], address: string): string;
  reportMigrationCleanupPressed(
    request: ClaudeRequest,
    road: ClaudeDeliveryRoad,
  ): void;
  reportMigrationCleanupResult(
    request: ClaudeRequest,
    road: ClaudeDeliveryRoad,
    result: ClaudeDeliveryKind,
  ): void;
}
/** Model editing operations preserve the v2 file document at every command boundary. */
export interface ApplicationModelRuntime {
  deleteToken(
    content: import("../contracts").DesignSystemContent,
    kind: AddTokenKind,
    name: string,
  ): import("../contracts").DesignSystemContent;
  renameToken(
    content: import("../contracts").DesignSystemContent,
    kind: AddTokenKind,
    name: string,
    next: string,
  ): import("../contracts").DesignSystemContent;
  setColorTokenUsage(
    content: import("../contracts").DesignSystemContent,
    name: string,
    usage: string,
  ): import("../contracts").DesignSystemContent;
  setColorTokenValue(
    content: import("../contracts").DesignSystemContent,
    name: string,
    theme: string,
    value: string,
  ): import("../contracts").DesignSystemContent;
  clearColorThemeOverride(
    content: import("../contracts").DesignSystemContent,
    name: string,
    theme: string,
  ): import("../contracts").DesignSystemContent;
  deleteColorTokens(
    content: import("../contracts").DesignSystemContent,
    names: string[],
  ): import("../contracts").DesignSystemContent;
  renameColorTokensAtomically(
    content: import("../contracts").DesignSystemContent,
    names: [string, string][],
  ): import("../contracts").DesignSystemContent;
  setScalarTokenValue(
    content: import("../contracts").DesignSystemContent,
    kind: ScalarTokenKind,
    name: string,
    value: string,
  ): import("../contracts").DesignSystemContent;
  setTokenUsage(
    content: import("../contracts").DesignSystemContent,
    kind: AddTokenKind,
    name: string,
    usage: string,
  ): import("../contracts").DesignSystemContent;
  setTokenFamilyNote(
    content: import("../contracts").DesignSystemContent,
    kind: ScalarTokenKind,
    note: string,
    family?: string,
  ): import("../contracts").DesignSystemContent;
  setShadowTokenValue(
    content: import("../contracts").DesignSystemContent,
    name: string,
    theme: string,
    value: string,
  ): import("../contracts").DesignSystemContent;
  setTypographyProperty(
    content: import("../contracts").DesignSystemContent,
    name: string,
    property: TypographyEditableField,
    value: string | number | null,
  ): import("../contracts").DesignSystemContent;
  setTypographyFontFamily(
    content: import("../contracts").DesignSystemContent,
    name: string,
    family: string,
  ): import("../contracts").DesignSystemContent;
  setTypographyStyleUsage(
    content: import("../contracts").DesignSystemContent,
    name: string,
    usage: string,
  ): import("../contracts").DesignSystemContent;
  removeMissingFontReferences(
    content: import("../contracts").DesignSystemContent,
  ): import("../contracts").DesignSystemContent;
  setComponentGuidelines(
    content: import("../contracts").DesignSystemContent,
    name: string,
    markdown: string,
  ): import("../contracts").DesignSystemContent;
  deleteFontFace(
    content: import("../contracts").DesignSystemContent,
    path: string,
  ): import("../contracts").DesignSystemContent;
  deleteAssetFile(
    content: import("../contracts").DesignSystemContent,
    path: string,
  ): import("../contracts").DesignSystemContent;
  addFontFace(
    content: import("../contracts").DesignSystemContent,
    font: UploadFontInput,
  ): import("../contracts").DesignSystemContent;
  addAssetFile(
    content: import("../contracts").DesignSystemContent,
    asset: UploadAssetInput,
  ): import("../contracts").DesignSystemContent;
  addColorToken(
    content: import("../contracts").DesignSystemContent,
    name: string,
    value: string,
    after?: string,
  ): import("../contracts").DesignSystemContent;
  addScalarToken(
    content: import("../contracts").DesignSystemContent,
    kind: ScalarTokenKind,
    name: string,
    value: string | undefined,
    after?: string,
    family?: string,
  ): import("../contracts").DesignSystemContent;
  addTypographyGroup(
    content: import("../contracts").DesignSystemContent,
    name: string,
  ): import("../contracts").DesignSystemContent;
  addTypographyStyle(
    content: import("../contracts").DesignSystemContent,
    name: string,
    after?: string,
    group?: string,
  ): import("../contracts").DesignSystemContent;
  addShadowToken(
    content: import("../contracts").DesignSystemContent,
    name: string,
    value: string,
  ): import("../contracts").DesignSystemContent;
  setDesignSystemReadme(
    content: import("../contracts").DesignSystemContent,
    markdown: string,
  ): import("../contracts").DesignSystemContent;
  setAdditionalDocument(
    content: import("../contracts").DesignSystemContent,
    path: string,
    markdown: string,
  ): import("../contracts").DesignSystemContent;
  renameDesignSystemFile(
    content: import("../contracts").DesignSystemContent,
    path: string,
    next: string,
  ): import("../contracts").DesignSystemContent;
  deleteDesignSystemFiles(
    content: import("../contracts").DesignSystemContent,
    paths: string[],
  ): import("../contracts").DesignSystemContent;
  renameTypographyGroup(
    content: import("../contracts").DesignSystemContent,
    group: string,
    next: string,
  ): import("../contracts").DesignSystemContent;
  deleteTypographyGroup(
    content: import("../contracts").DesignSystemContent,
    group: string,
  ): import("../contracts").DesignSystemContent;
  renameAssetFile(
    content: import("../contracts").DesignSystemContent,
    path: string,
    next: string,
  ): import("../contracts").DesignSystemContent;
  tokenHasGroupSuffix(name: string, namespace: string): boolean;
  tokenGroupName(name: string, namespace: string): string;
  conflictingTokenNames(
    tokens: import("../contracts").NormalizedTokens,
    kind: AddTokenKind,
  ): string[];
  fileFitsInlineBudgets(
    content: import("../contracts").DesignSystemContent,
    path: string,
    value: string,
  ): boolean;
  generateNamedTokensCss(
    tokens: import("../contracts").NormalizedTokens,
    title: string,
  ): string;
  sanitizeUploadFileName(name: string): string;
  removeTokenShortcutComments(markdown: string): string;
  firstMarkdownTitle(markdown: string): { line: number; text: string } | null;
  replaceMarkdownTitle(markdown: string, title: string): string;
  humanizeDocumentFilename(path: string): string;
  mimeTypeForPath(path: string): string;
  fileExtension(path: string): string;
  pathDirname(path: string): string;
  pathBasename(path: string): string;
  assetKindForPath(path: string): import("../contracts").AssetKind;
  isCiLastChange(change: import("../contracts").LastChange): boolean;
}
export interface ApplicationUiRuntime {
  useInlineFontFaces(
    fonts: import("../contracts").ParsedFont[],
    generation?: number,
  ): void;
  usePreviewStaticNotice(): boolean;
  usePublishedPreviewGeneration(doc: ApplicationDocument): number;
  reactArtifactRoot: typeof import("react");
  useBlobDataUrls(
    resources: { src: string; type: string; bytes?: number }[],
  ): number;
  useMigrationCleanupEnabled(): boolean;
  editorFeatureFlags: { componentProps: boolean };
  preferLivePreviewUrls: boolean;
  supportsLivePreviewUrls(): boolean;
  PALETTE_GROUP_NAME: string;
  README_STARTER_TEXT: string;
  WELCOME_OPTIONS: { connect: readonly string[]; upload: readonly string[] };
  DESIGN_SYSTEM_INLINE_LIMITS: { readme: number; total: number };
  DESIGN_SYSTEM_PATHS: {
    readme: string;
    tokens: string;
    fontsDir: string;
    assetsDir: string;
  };
  FONT_FILE_ACCEPT: string;
  MAX_DROPPED_FILES: number;
  FILES_SECTION_ID: string;
  MIGRATED_READONLY_MESSAGE: string;
  MIGRATION_EMPTY_PAGE_TITLE: string;
  RECLAIM_RECONNECTING_MESSAGE: string;
  RECLAIM_SAVE_FIRST_MESSAGE: string;
  RECLAIM_SAVING_MESSAGE: string;
  RECLAIM_WINDOWED_COLLECTION_MESSAGE: string;
  RECLAIM_LIST_FAILED_MESSAGE: string;
  RECLAIM_NOTHING_UNUSED_MESSAGE: string;
  BOOT_LIVE_NOTICE_MESSAGES: ReadonlySet<string>;
  DOWNLOAD_INTERNAL_FAILURE: import("./model-storage").HealthEvent;
  artifactHealth: {
    report(action: string, outcome: string, code?: string): void;
  };
  downloadHealthOutcome(
    result: ShellSaveResult,
  ): import("./model-storage").HealthEvent | undefined;
  UNCOMMENTABLE_PROPS: { [attribute: `data-${string}`]: string };
  flushMarkdownCommitQueues(): void;
}
