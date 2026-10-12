/** Contracts observed in the packaged Design System application. */
export type FileTable = Readonly<Record<string, string>>;
export interface DesignSystemContent {
  v: 2;
  files: FileTable;
}
export interface ParseReport {
  dropped: string[];
  warnings: string[];
  notes?: string[];
}
export interface ColorTheme {
  id: string;
  name: string;
}
export interface ColorToken {
  name: string;
  value: Record<string, string>;
  usage: string;
}
export interface ScalarToken {
  name: string;
  value: string;
  usage: string;
}
export interface ShadowToken {
  name: string;
  value: Record<string, string>;
  usage: string;
}
export interface TokenFamily<T = ScalarToken> {
  note: string;
  tokens: T[];
}
export interface ExtraTokenFamily extends TokenFamily {
  key: string;
}
export interface FontFace {
  family: string;
  file: string;
  weight: string;
  style: "normal" | "italic" | "oblique";
}
export interface TypographyStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing: string;
  fontStyle: "normal" | "italic";
  opticalSize: number | null;
  family: string;
  sample: string;
  usage: string;
}
export interface TypographyGroup {
  name: string;
  family: string;
  note: string;
  styles: TypographyStyle[];
}
export interface NormalizedTokens {
  version: 1;
  color: { themes: ColorTheme[]; tokens: ColorToken[] };
  type: {
    fonts: FontFace[];
    families: Record<string, string>;
    groups: TypographyGroup[];
    unreadFonts?: unknown[];
  };
  spacing: TokenFamily;
  radius: TokenFamily;
  shadow: TokenFamily<ShadowToken>;
  extra: ExtraTokenFamily[];
  /** Unrecognized source fields are preserved for serialization. */
  kept: Record<string, unknown>;
}
export type StoragePointer =
  | { store: "blob"; id: string }
  | { store: "file"; rel: string };
export type StorageKind = "inline" | "blob" | "file";
export interface StorageRecord {
  store: StorageKind;
  bytes: number;
  type: string;
  id?: string;
  url?: string;
  sha256?: string;
  storedSha256?: string;
  name?: string;
  addedAt?: string;
  via?: string;
  thumb?: string;
  supersedes?: string;
}
export interface StorageCatalog {
  files: Record<string, StorageRecord>;
}
export interface LastChange {
  by: string;
  at: string;
  via?: string;
  note?: string;
  extra: Record<string, string>;
}
export type AssetTileSize = "xs" | "s" | "m" | "l" | "xl";
export interface AssetGroupMetadata {
  groups: string[];
  tiles: Record<string, AssetTileSize>;
  orders: Record<string, string[]>;
}
export interface DeclaredLibrary {
  name: string;
  version: string;
  global?: string;
  file?: string;
}
export interface LoadedLibrary {
  name: string;
  version: string;
  global: string | null;
  file: string;
}
export interface FetchLibrary {
  name: string;
  version: string;
  global: string | null;
  url: string;
  integrity: string;
}
export interface ResolvedLibraries {
  load: LoadedLibrary[];
  fetch: FetchLibrary[];
  missing: string[];
  missingFiles: string[];
}
export interface BundleHeader {
  format: number | null;
  namespace: string | null;
  components: string[];
  inlinedExternals: string[];
}
export interface ParsedComponent {
  name: string;
  previewHtml: string | null;
  guidelinesMd: string | null;
  guidelinesPath: string | null;
  dts: string | null;
  dtsPath: string | null;
  group: string;
  subtitle: string;
  floor: boolean;
  page: boolean;
  previewHeight: number;
  previewWidth: number | null;
  listedBy: "header" | "files";
}
export interface ParsedFont {
  path: string;
  fileName: string;
  family: string;
  weight: string;
  style: string;
  format: string;
  src: string;
  store: StorageKind;
  bytes: number;
  referenced: boolean;
  missing: boolean;
}
export type AssetKind = "svg" | "image" | "video" | "font" | "audio" | "other";
export interface ParsedAsset {
  path: string;
  name: string;
  group: string;
  subpath: string;
  ext: string;
  mime: string;
  kind: AssetKind;
  isText: boolean;
  store: StorageKind;
  bytes: number;
}
export interface ParsedAssetGroup {
  name: string;
  slug: string;
  tile: AssetTileSize;
  order: string[];
  assets: ParsedAsset[];
}
export interface FileUsage {
  files: number;
  bytes: number;
}
export type FileKind =
  | "readme"
  | "doc"
  | "tokens"
  | "manifest"
  | "bundleJs"
  | "bundleCss"
  | "dts"
  | "preview"
  | "componentReadme"
  | "componentSource"
  | "componentLib"
  | "componentOther"
  | "font"
  | "asset"
  | "other";
export type FileBudgetUsage = Record<
  FileKind | "total" | "blob" | "beside",
  FileUsage
>;
export interface ParsedDesignSystem {
  files: FileTable;
  readme: string;
  docs: { path: string; title: string; markdown: string }[];
  docsLeftOut: string[];
  tokens: NormalizedTokens;
  tokensReport: ParseReport;
  assetsMeta: AssetGroupMetadata;
  lastChange: LastChange | null;
  sectionTitles: Readonly<Record<string, string>>;
  metaReport: ParseReport;
  bundle: {
    js: string | null;
    css: string | null;
    dts: { path: string; text: string }[];
    header: BundleHeader | null;
    namespace: string | null;
    declared: DeclaredLibrary[];
    libraries: ResolvedLibraries;
    jsBytes: number;
  };
  components: ParsedComponent[];
  cover: { previewHtml: string; height: number } | null;
  fonts: ParsedFont[];
  assetFonts: ParsedFont[];
  assetGroups: ParsedAssetGroup[];
  assetCount: number;
  otherFiles: string[];
  storage: StorageCatalog;
  blobBytesUsed: number;
  bytes: FileBudgetUsage;
}
export interface ComponentCardMetadata {
  group?: string;
  height?: number;
  width?: number;
  subtitle?: string;
  floor?: boolean;
  page?: boolean;
}
export interface InferredPropControl {
  name: string;
  kind: "enum" | "boolean" | "number" | "string";
  options?: string[];
  numeric?: true;
  withBool?: true;
  typeName?: string;
  default?: string | number | boolean;
  required?: true;
}
export interface ApiDocumentationIndexEntry {
  kind: string;
  name: string;
  purpose: string;
  path: string;
  size: number;
}
export interface ConsumptionDocumentation {
  files: Map<string, string>;
  readme: string;
  index: ApiDocumentationIndexEntry[];
}
