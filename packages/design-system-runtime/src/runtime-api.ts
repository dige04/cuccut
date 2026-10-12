/** Typed entry points for the recovered model, parser and publishing boundaries. */
import type {
  AssetGroupMetadata,
  DesignSystemContent,
  FileBudgetUsage,
  FileKind,
  FileTable,
  LastChange,
  NormalizedTokens,
  ParseReport,
  ParsedDesignSystem,
  StorageCatalog,
  StoragePointer,
  TokenCssOptions,
} from "./contracts";
export interface DesignSystemApi {
  /** Original binding V$; see reconstruction-manifest.json. */
  parseTokens(input: unknown, report?: ParseReport): NormalizedTokens;
  /** Original binding A_; see reconstruction-manifest.json. */
  serializeTokens(tokens: NormalizedTokens): string;
  /** Original binding x_; see reconstruction-manifest.json. */
  parseDesignSystemFiles(
    files: FileTable,
    budgetProvider?: { pageBytes?(path: string): number | undefined },
  ): ParsedDesignSystem;
  /** Original binding FZ; see reconstruction-manifest.json. */
  parsedDesignSystem(
    content: DesignSystemContent,
    budgetProvider?: { pageBytes?(path: string): number | undefined },
  ): ParsedDesignSystem;
  /** Original binding DK; see reconstruction-manifest.json. */
  parseDesignSystemContent(
    input: unknown,
    report?: ParseReport,
    options?: { unbounded?: boolean },
  ): DesignSystemContent;
  /** Original binding iD5; see reconstruction-manifest.json. */
  parseFileTable(
    input: unknown,
    report?: ParseReport,
    options?: { unbounded?: boolean },
  ): FileTable;
  /** Original binding oJ; see reconstruction-manifest.json. */
  storageCatalogFromManifest(
    manifestInput: unknown,
    report?: ParseReport,
  ): StorageCatalog;
  /** Original binding Sj; see reconstruction-manifest.json. */
  parseAssetGroupMetadata(
    manifestInput: unknown,
    report?: ParseReport,
  ): AssetGroupMetadata;
  /** Original binding R_; see reconstruction-manifest.json. */
  parseLastChange(input: unknown): {
    value: LastChange | null;
    warnings: string[];
  };
  /** Original binding cY; see reconstruction-manifest.json. */
  parseStoragePointer(value: string): StoragePointer | null;
  /** Original binding M8; see reconstruction-manifest.json. */
  parseDataUriHeader(
    content: string,
  ): { mime: string; base64: boolean; payloadOffset: number } | null;
  /** Original binding C8; see reconstruction-manifest.json. */
  classifyDesignSystemFile(path: string): FileKind;
  /** Original binding rD5; see reconstruction-manifest.json. */
  computeFileBudgetUsage(
    files: FileTable,
    storedBytesForPath?: (path: string) => number,
    inlineBytesForPath?: (path: string) => number | undefined,
  ): FileBudgetUsage;
  /** Original binding j8; see reconstruction-manifest.json. */
  isValidDesignSystemPath(path: string): boolean;
  /** Original binding jo; see reconstruction-manifest.json. */
  normalizePathSegmentForComparison(segment: string): string;
  /** Original binding jj; see reconstruction-manifest.json. */
  normalizePathForComparison(path: string): string;
  /** Original binding VK; see reconstruction-manifest.json. */
  pathBasename(path: string): string;
  /** Original binding K$; see reconstruction-manifest.json. */
  pathDirname(path: string): string;
  /** Original binding W6; see reconstruction-manifest.json. */
  fileExtension(path: string): string;
  /** Original binding i4; see reconstruction-manifest.json. */
  mimeTypeForPath(path: string): string;
  /** Original binding m2; see reconstruction-manifest.json. */
  assetKindForPath(
    path: string,
  ): "svg" | "image" | "video" | "font" | "audio" | "other";
  /** Original binding J2; see reconstruction-manifest.json. */
  isColorLiteral(value: unknown): boolean;
  /** Original binding J07; see reconstruction-manifest.json. */
  isCssLength(value: unknown): boolean;
  /** Original binding jK; see reconstruction-manifest.json. */
  normalizeBoxShadow(value: unknown): string | undefined;
  /** Original binding Y07; see reconstruction-manifest.json. */
  normalizeMotionValue(value: unknown): string | undefined;
  /** Original binding Eo; see reconstruction-manifest.json. */
  normalizeExtraTokenValue(value: unknown): string | undefined;
  /** Original binding vy; see reconstruction-manifest.json. */
  normalizeColorOrAlias(value: unknown): string | undefined;
  /** Original binding U$; see reconstruction-manifest.json. */
  normalizeCssLength(
    value: unknown,
    allowFullRadius: boolean,
  ): string | undefined;
  /** Original binding yo; see reconstruction-manifest.json. */
  normalizeFontWeight(value: unknown): string | undefined;
  /** Original binding gy; see reconstruction-manifest.json. */
  normalizeLineHeight(value: unknown): string | undefined;
  /** Original binding F1; see reconstruction-manifest.json. */
  escapeTokenCssIdentifier(name: string): string;
  /** Original binding t1; see reconstruction-manifest.json. */
  encodeFileIndexKey(key: string): string;
  /** Original binding SK; see reconstruction-manifest.json. */
  decodeFileIndexKey(key: string): string;
  /** Original binding h47; see reconstruction-manifest.json. */
  isPublishableSvgText(text: string): boolean;
  /** Original binding n2; see reconstruction-manifest.json. */
  publishableFileMimeType(path: string, contents: string): string | null;
  /** Original binding fo; see reconstruction-manifest.json. */
  generateTokensCss(
    tokens: NormalizedTokens,
    options?: TokenCssOptions,
  ): string;
  /** Original binding fy; see reconstruction-manifest.json. */
  generateFontFacesCss(
    tokens: NormalizedTokens,
    fontSource: (path: string) => string | null,
  ): string;
  /** Original binding I_; see reconstruction-manifest.json. */
  generateNamedTokensCss(
    tokens: NormalizedTokens,
    name: string,
    fontSource: (path: string) => string | null,
  ): string;
  /** Original binding B67; see reconstruction-manifest.json. */
  isChangeMetadataObject(input: unknown): input is Record<string, unknown>;
}
