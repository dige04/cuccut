/** Normalized model values and validated file/manifest boundaries recovered from the bundle. */
import type * as Model from "../contracts";
import type { UploadAssetInput, UploadFontInput } from "./application";
export type TokenKind =
  | "color"
  | "type"
  | "spacing"
  | "radius"
  | "shadow"
  | "extra";
export type ScalarKind = "spacing" | "radius" | "extra";
export type ValueTokenKind = Exclude<TokenKind, "type">;
export type ValueToken =
  | Model.ColorToken
  | Model.ShadowToken
  | Model.ScalarToken;
export type TypographyProperty = Exclude<
  keyof Model.TypographyStyle,
  "name" | "usage"
>;
export interface PackagedLibrary {
  name: string;
  version: string;
  provides: string[];
  requires: string[];
  packedFile: string;
  sha256: string;
  cdn: { url: string; integrity: string };
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
export interface InlineLimits {
  readme: number;
  tokens: number;
  manifest: number;
  bundleJs: number;
  bundleCss: number;
  dtsTotal: number;
  preview: number;
  componentReadme: number;
  componentLib: number;
  font: number;
  asset: number;
  other: number;
  imageSlotState: number;
  total: number;
}
export interface DataUriHeader {
  mime: string;
  base64: boolean;
  payloadOffset: number;
}
export type ManifestObject = Record<string, unknown>;
export interface ModelCoreRuntime {
  DESIGN_SYSTEM_PATHS: DesignSystemPaths;
  DESIGN_SYSTEM_INLINE_LIMITS: InlineLimits;
  COMPONENT_FILENAMES: { preview: string; readme: string };
  COMPONENT_NAME_PATTERN: RegExp;
  FONT_STACK_PATTERN: RegExp;
  MAX_TOKEN_USAGE_LENGTH: number;
  MAX_TOKEN_NOTE_LENGTH: number;
  MAX_TOKEN_LABEL_LENGTH: number;
  MAX_DESIGN_SYSTEM_FILES: number;
  isPublishableFilePathModelFileTable(path: string): boolean;
  mirrorMimeTypeForPath(path: string): string | null;
  HELD_BINARY_MIME_TYPES: Readonly<Record<string, string>>;
  explainToolConfigurationPath(path: string): string | null;
  isImageSlotStatePath(path: string): boolean;
  hasGeneratedSystemHeader(path: string, content: string): boolean;
  carriedDocumentPath(path: string): string;
  storageKindForFile(path: string, content: string): Model.StorageKind;
  MAX_FONT_FAMILIES: number;
  TOKEN_NAME_PATTERN: RegExp;
  allExtraTokens(tokens: Model.NormalizedTokens): Model.ScalarToken[];
  normalizeColorOrAlias(value: unknown): string | undefined;
  normalizeBoxShadow(value: unknown): string | undefined;
  normalizeScalarTokenValue(
    kind: ScalarKind,
    value: unknown,
  ): string | undefined;
  colorAliasTarget(value: string | undefined): string | undefined;
  detectColorAliasCycle(
    tokens: Model.NormalizedTokens,
    name: string,
    theme: string,
    value: string,
  ): { theme: string; via: string[] | "deep" } | undefined;
  normalizeTypographyProperty<K extends TypographyProperty>(
    property: K,
    value: unknown,
    families: Record<string, string>,
  ): Model.TypographyStyle[K] | undefined;
  tokenNamesForFamily(
    tokens: Model.NormalizedTokens,
    family: TokenKind,
  ): string[];
  conflictingTokenNames(
    tokens: Model.NormalizedTokens,
    family: TokenKind,
  ): string[];
  resolveColorTokenValue(
    token: Model.ColorToken,
    theme: string,
    tokens: Model.NormalizedTokens,
  ): string | undefined;
  colorValueForThemeModelTokens(
    token: Model.ColorToken,
    theme: string,
    tokens: Model.NormalizedTokens,
  ): string | undefined;
  setDesignSystemReadme(
    content: Model.DesignSystemContent,
    markdown: string,
  ): Model.DesignSystemContent;
  encodeRelativeUrlPath(path: string): string;
  blobRelativeUrlModelFilePolicy(id: string): string;
  WINDOW_NAMESPACE_PATTERN: RegExp;
  PACKAGED_LIBRARY_PATH_PATTERN: RegExp;
  LIBRARY_NAME_PATTERN: RegExp;
  LIBRARY_VERSION_PATTERN: RegExp;
  RESERVED_PROTOTYPE_NAMES: ReadonlySet<string>;
  isDesignSystemContentObject(input: unknown): input is Record<string, unknown>;
  parseFileTable(
    input: unknown,
    report?: Model.ParseReport,
    options?: { unbounded?: boolean },
  ): Model.FileTable;
  pathBasename(path: string): string;
  mimeTypeForPath(path: string): string;
  assetKindForPath(path: string): Model.AssetKind;
  isHeldFilePointer(path: string, content: string): boolean;
  estimateDataUriBytes(content: string): number;
  storageRecordForFile(
    files: Model.FileTable,
    catalog: Model.StorageCatalog,
    path: string,
  ): Model.StorageRecord | null;
  parseManifestBundleMetadata(
    input: unknown,
    report?: Model.ParseReport,
  ): { namespace: string | null; libraries: Model.DeclaredLibrary[] | null };
  parseAssetGroupMetadata(
    input: unknown,
    report?: Model.ParseReport,
  ): Model.AssetGroupMetadata;
  lastChangeFromManifest(
    input: unknown,
    report?: Model.ParseReport,
  ): Model.LastChange | null;
  storageCatalogFromManifest(
    input: unknown,
    report?: Model.ParseReport,
  ): Model.StorageCatalog;
  sectionTitlesFromManifest(
    input: string | ManifestObject,
  ): Readonly<Record<string, string>>;
  parseBundleHeader(script: string): Model.BundleHeader | null;
  inferDeclaredLibraries(
    declared: Model.DeclaredLibrary[],
    hasFile: (path: string) => boolean,
    catalog?: PackagedLibrary[],
  ): Model.DeclaredLibrary[];
  resolvePreviewLibraries(
    declared: Model.DeclaredLibrary[],
    hasFile?: (path: string) => boolean,
    catalog?: PackagedLibrary[],
    allowCdn?: boolean,
  ): Model.ResolvedLibraries;
  componentCardMetadata(html: string): Model.ComponentCardMetadata | null;
  ownPropertyOrUndefined<Value>(
    record: Record<string, Value>,
    key: string,
  ): Value | undefined;
  uniqueStoredBlobBytes(storage: Model.StorageCatalog): number;
  computeFileBudgetUsage(
    files: Model.FileTable,
    storedBytes?: (path: string) => number,
    inlineBytes?: (path: string) => number | undefined,
  ): Model.FileBudgetUsage;
  serializeLastChange(
    change: Model.LastChange | null,
  ): Record<string, string> | undefined;
  reconcileStorageCatalog(
    files: Model.FileTable,
    storage: Model.StorageCatalog,
  ): Model.StorageCatalog;
  serializeStorageCatalog(
    storage: Model.StorageCatalog,
  ): import("./model-storage").SerializedStorageCatalog | undefined;
  serializeSectionTitles(
    titles: Readonly<Record<string, string>>,
  ): Record<string, string> | undefined;
  serializeResolvedLibraries(
    declared: Model.DeclaredLibrary[],
    resolved: Model.ResolvedLibraries,
    catalog?: PackagedLibrary[],
  ): Model.DeclaredLibrary[];
  generatedTokensCssForFiles(files: Model.FileTable): string | null;
  isMirrorEligibleFile(path: string, content: string): boolean;
  explainUnsafeMirrorPath(path: string): string | null;
  MAX_DISPLAYED_DOCUMENTS: number;
  MAX_PRETTY_MANIFEST_BYTES: number;
  DESIGN_SYSTEM_MANIFEST_VERSION: number;
  GENERATED_TOKENS_CSS_PATH: string;
  DEFAULT_ASSET_TILE_SIZE: Model.AssetTileSize;
  DEFAULT_COMPONENT_PREVIEW_HEIGHT: number;
  COVER_COMPONENT_NAME: string;
  UNGROUPED_ASSETS_NAME: string;
  MAX_COLOR_TOKENS: number;
  MAX_TOKENS_PER_FAMILY: number;
  MAX_TYPOGRAPHY_STYLES: number;
  MAX_TYPOGRAPHY_GROUPS: number;
  normalizeTokenName(name: string): string;
  isAssetGroupName(name: unknown): name is string;
  pathDirname(path: string): string;
  protectedFilePathPredicate(path: string): boolean;
  isWallAssetKind(kind: Model.AssetKind): boolean;
  orderAssetTiles<Asset extends { key: string; wall: boolean }>(
    assets: Asset[],
    order: string[],
  ): Asset[];
  serializeAssetGroupMetadata(
    metadata: Model.AssetGroupMetadata,
  ): { name: string; tile?: Model.AssetTileSize; order?: string[] }[];
  stringifyManifestWithinBudget(manifest: unknown): string;
  dropMissingBlobDigests(
    catalog: Model.StorageCatalog,
    ids: ReadonlySet<string>,
  ): Model.StorageCatalog;
  parseLastChange(input: unknown): {
    value: Model.LastChange | null;
    warnings: string[];
  };
  buildDesignSystemManifest(
    system: Model.ParsedDesignSystem,
    name: string,
  ): DesignSystemManifestResult;
  serializeDesignSystemManifest(manifest: unknown): string;
  normalizeSectionTitleModelManifestMetadata(title: string): string;
  renameDesignSystemFile(
    content: Model.DesignSystemContent,
    oldPath: string,
    newPath: string,
  ): Model.DesignSystemContent;
  createParseReport(): Model.ParseReport;
  parseManifest(input: unknown, report?: Model.ParseReport): ManifestObject;
  parsedDesignSystem(
    content: Model.DesignSystemContent,
  ): Model.ParsedDesignSystem;
  serializeTokens(tokens: Model.NormalizedTokens): string;
  parseTokens(
    input: unknown,
    report?: Model.ParseReport,
  ): Model.NormalizedTokens;
  updateTokens(
    content: Model.DesignSystemContent,
    mutate: (tokens: Model.NormalizedTokens) => boolean,
  ): Model.DesignSystemContent;
  pruneUnusedFontFamilies(tokens: Model.NormalizedTokens): void;
  parseStoragePointer(value: string): Model.StoragePointer | null;
  parseDataUriHeader(value: string): DataUriHeader | null;
  isTextFilePath(path: string): boolean;
  isValidDesignSystemPath(path: string): boolean;
  normalizeDesignSystemPath(path: string): string;
  explainGeneratedOrRetiredPath(path: string): string | null;
  explainReservedSystemPath(path: string): string | null;
  estimateEmbeddedStringBytes(value: string): number;
  isUnboundedFileParsing(): boolean;
  classifyDesignSystemFile(path: string): Model.FileKind;
  inlineLimitForPath(path: string, kind?: Model.FileKind): number;
  storagePointerForFile(
    path: string,
    value: string,
  ): Model.StoragePointer | null;
  canUseStoragePointer(path: string): boolean;
  fileExtension(path: string): string;
  sanitizeUploadFileName(name: string): string;
  unusedFileName(
    files: Model.FileTable,
    directory: string,
    filename: string,
  ): string;
  setDesignSystemFile(
    content: Model.DesignSystemContent,
    path: string,
    value: string,
  ): Model.DesignSystemContent;
  setFileStorageRecord(
    content: Model.DesignSystemContent,
    path: string,
    record: Model.StorageRecord,
  ): Model.DesignSystemContent;
  deleteDesignSystemFiles(
    content: Model.DesignSystemContent,
    paths: string[],
  ): Model.DesignSystemContent;
}
export interface PageBudgetProvider {
  pageBytes?(path: string): number | undefined;
}
export interface ComponentFileSources {
  preview: string | null;
  readme: string | null;
  dts: string | null;
}
export interface ComponentManifestEntry {
  name: string;
  group?: string;
  summary?: string;
  page?: true;
}
export interface EmulatorFlags {
  // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
  designSystemHost?: { __emulator?: boolean };
  window?: { designSystemHost?: { __emulator?: boolean } };
}
export interface AssetGroupLocation {
  group: string;
  key: string;
}
export interface LastChangeDraft {
  by: unknown;
  at: unknown;
  via?: unknown;
  note?: unknown;
  extra?: Record<string, unknown>;
}

export interface DesignSystemEnvelopeObject {
  content: Record<string, unknown>;
  [field: string]: unknown;
}
export interface DesignSystemManifestResult {
  manifestVersion: number;
  name: string;
  namespace: string | null;
  files: string[];
  libraries: Model.DeclaredLibrary[];
  components: ComponentManifestEntry[];
  lastChange?: Record<string, string>;
  assetGroups: {
    name: string;
    tile?: Model.AssetTileSize;
    order?: string[];
    files?: { path: string; id: string }[];
  }[];
  storage?: import("./model-storage").SerializedStorageCatalog;
  sections?: Record<string, string>;
}
