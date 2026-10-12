import type {
  Point,
  Size,
  Rectangle,
  ResizeHandle,
  ResizeMember,
  SizeLimits,
  AffineTuple,
  AffineTransform,
  ContainerPoint,
  PreviewHandle,
  VerticalInterval,
} from "./contracts/geometry";
import type {
  OwnedBytes,
  StoredZipEntry,
  ExportNameOptions,
  ExportNameAllocator,
  PaperSize,
  PaperSizeName,
  ExportArtboard,
  ExportHeight,
  ImageCaptureScale,
} from "./contracts/export";
import type {
  JsonValue,
  DataRecord,
  MergePolicy,
  MergeContext,
  VersionedIndex,
  IndexStateOptions,
  IndexFileState,
  ValidatedIndexStateOptions,
} from "./contracts/storage";
import type {
  PageStyles,
  PageStyleInput,
  PageDeclarations,
  PageStyleResult,
  MarkupRange,
  HelmetMarkup,
  PageStylesheet,
  LayoutProbe,
  ComputedStyleProbe,
  ProbeRectangle,
  ElementHitProbe,
  NearestRectangle,
  MarkupMatch,
} from "./contracts/fast-edit";
import type {
  UnicodeRange,
  FontDescriptor,
  ExportFontFace,
  FontUsageIndex,
  FontPruning,
  ExportAssetResolver,
  FontAwareResolver,
} from "./contracts/fonts";
import type { UIContracts } from "./ui-runtime-contracts";
/** Reviewed callable contracts for application module boundaries. */
export interface ApplicationContracts extends UIContracts {
  snapRotation(angle: number, snap15Degrees?: boolean): number;
  angleBetweenPoints(x1: number, y1: number, x2: number, y2: number): number;
  rotatePoint(point: Point, center: Point, degrees: number): Point;
  rotatedRectCorner(rect: Rectangle, degrees: number, area: Rectangle): boolean;
  resizeRotatedRect(
    rect: Rectangle,
    degrees: number,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    min: Size,
    max: Size,
    keepAspect?: boolean,
  ): Rectangle;
  resizeRect(
    rect: Rectangle,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    min: Size,
    max: Size,
  ): Rectangle;
  resizeRectKeepingAspect(
    rect: Rectangle,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    min: Size,
    max: Size,
  ): Rectangle;
  unionRects(rects: readonly Rectangle[]): Rectangle | null;
  transformPointBetweenRects(
    point: Point,
    from: Rectangle,
    to: Rectangle,
  ): Point;
  transformRectBetweenRects(
    rect: Rectangle,
    from: Rectangle,
    to: Rectangle,
  ): Rectangle;
  selectionResizeLimits(
    size: Size,
    members: readonly ResizeMember[],
  ): SizeLimits;
  measureInsertionContainerTransform(
    componentName: string,
    templateId: number,
    clientX: number,
    clientY: number,
  ): AffineTuple | null;
  parseInsertionContainerTransform(value: unknown): AffineTransform | null;
  insertionPointInContainer(
    transform: AffineTransform,
    clientX: number,
    clientY: number,
  ): ContainerPoint | null;
  requestInsertionContainerTransform(
    webview: PreviewHandle,
    componentName: string,
    templateId: number,
    clientX: number,
    clientY: number,
    timeoutMs?: number,
  ): Promise<AffineTransform | null>;
  zipCrc32(bytes: Uint8Array): number;
  createStoredZip(entries: readonly StoredZipEntry[]): Blob;
  gzipExportAsset(bytes: OwnedBytes): Promise<OwnedBytes>;
  verifyExportAssetIntegrity(
    bytes: OwnedBytes,
    integrity: string,
  ): Promise<boolean>;
  exportBaseFileName(path: string, options?: ExportNameOptions): string;
  sanitizeExportFileName(name: string, maxCharacters?: number): string;
  exportFileName(path: string, title?: string): string;
  uniqueExportFileNames(): ExportNameAllocator;
  computePaginationCuts(
    intervals: readonly VerticalInterval[],
    contentHeight: number,
    pageHeight: number,
    maxPages: number,
    overlap?: number,
  ): number[];
  inferLocalePaperSize(
    languages?: readonly (string | null | undefined)[],
  ): PaperSizeName;
  inferArtboardPaperSize(size: Size): PaperSizeName | undefined;
  resolveMeasuredExportHeight(
    declared: number,
    measured: number,
    naturalHeight?: number,
  ): ExportHeight;
  getArtboardPaperSize(artboard: ExportArtboard): PaperSizeName;
  paperHeightForWidth(width: number, paper: PaperSizeName): number;
  maxImageCaptureScale(width: number, height: number): number;
  imageCaptureScaleOptions(width: number, height: number): ImageCaptureScale[];
  sha256Fallback(input: string | Uint8Array): string;
  sha256(input: string | Uint8Array<ArrayBuffer>): Promise<string>;
  serializedDocumentBytes(input: JsonValue): number;
  isPlainRecord(input: unknown): input is DataRecord;
  sortJsonObjectKeys(key: string, value: unknown): unknown;
  stableStringify(value: object): string;
  structurallyEqual(left: unknown, right: unknown): boolean;
  deepMerge(base: DataRecord, patch: DataRecord): DataRecord;
  mergeCompatibleRecords(
    base: DataRecord,
    patch: DataRecord,
  ): DataRecord | null;
  diffRecord(
    before: DataRecord | undefined,
    after: DataRecord,
  ): DataRecord | null;
  removeNullValues(input: DataRecord): DataRecord;
  countRecordNulls(input: DataRecord): number;
  recordDepth(value: unknown, depthLimit?: number): number;
  dirname(path: string): string;
  basename(path: string): string;
  preserveIndexProvenance<Value>(value: Value, ...sources: unknown[]): Value;
  setSafeObjectKey(object: DataRecord, key: string, value: unknown): void;
  replaceIndexObjectProperties(target: DataRecord, source: DataRecord): void;
  equalIndexValue(left: unknown, right: unknown): boolean;
  getChildMergePolicy(
    policy: MergePolicy | undefined,
    key: string,
    ...values: unknown[]
  ): MergePolicy;
  mergeLeafValue(
    base: unknown,
    local: unknown,
    remote: unknown,
    path: string,
    context: MergeContext,
  ): unknown;
  uniqueMergeKeys(keys: readonly string[]): string[];
  mergeOrderedStringList(
    base: readonly string[],
    local: readonly string[],
    remote: readonly string[],
    allowedKeys?: ReadonlySet<string> | readonly string[],
  ): string[];
  normalizeMergeMap(
    value: unknown,
    idProperty: string,
  ): Record<string, DataRecord>;
  mergeMapValues(
    base: DataRecord | undefined,
    local: DataRecord,
    remote: DataRecord,
    policy: MergePolicy,
    path: string,
    context: MergeContext,
  ): DataRecord;
  mergeIndexValues(
    base: unknown,
    local: unknown,
    remote: unknown,
    policy: MergePolicy,
    context?: MergeContext,
  ): unknown;
  isPlainMergeObject(input: unknown): input is DataRecord;
  isStringList(input: unknown): input is string[];
  getOwnMergeValue(input: DataRecord | undefined, key: string): unknown;
  cloneIndexValue(input: unknown): unknown;
  canonicalizeIndexValue(value: unknown, topLevel?: boolean): unknown;
  stringifyCanonicalIndex(value: unknown): string;
  createIndexFileState<Index extends VersionedIndex>(
    options: ValidatedIndexStateOptions<Index>,
  ): IndexFileState<Index>;
  createIndexFileState(
    options: IndexStateOptions<VersionedIndex>,
  ): IndexFileState<VersionedIndex>;
  findPairedMarkupTags(
    html: string,
    openingPattern: RegExp,
    closingPattern: RegExp,
  ): MarkupRange | null;
  splitHelmetMarkup(html: string): HelmetMarkup | null;
  stripHelmetMarkup(html: string): string;
  preserveHelmetMarkup(before: string, after: string): string;
  validatePageColor(value: unknown): string | null;
  validatePageFontFamilies(
    value: unknown,
    knownFamilies: Iterable<string>,
  ): string | null;
  serializePageStyleDeclarations(styles: PageDeclarations): string;
  updatePageStyleSheet(
    html: string,
    styles: PageStyleInput,
    families: Iterable<string>,
  ): PageStyleResult;
  readPageStylesFromSheet(html: string, families: Iterable<string>): PageStyles;
  readPageStylesFromSection(html: string): PageStyles;
  validatePageStyles(
    styles: PageStyleInput,
    families: Iterable<string>,
  ): PageStyles;
  findMarkupBlock(
    html: string,
    opening: RegExp,
    closing: RegExp,
  ): MarkupMatch | null;
  findHelmetBlock(html: string): MarkupMatch | null;
  findStyleBlock(html: string): MarkupMatch | null;
  findPageStylesheet(html: string): PageStylesheet | null;
  hasPageStylesheet(html: string): boolean;
  parseLayoutProbe(value: unknown): LayoutProbe | null;
  probeRenderedElementLayout(
    webview: PreviewHandle,
    selector: string,
  ): Promise<LayoutProbe | null>;
  parseComputedColor(value: unknown): string | null;
  parseComputedStyleProbe(value: unknown): ComputedStyleProbe;
  parseDomProbeRectangles(value: unknown): ProbeRectangle[];
  findNearestProbeRectangle(
    rectangles: readonly ProbeRectangle[],
    x: number,
    y: number,
  ): NearestRectangle | null;
  parseElementHitProbe(value: unknown): ElementHitProbe | null;
  probeRenderedElementHit(
    webview: PreviewHandle,
    selector: string,
    index?: number | null,
  ): Promise<ElementHitProbe | null>;
  boundedDomProbeString(value: unknown): string;
  normalizeDomProbeText(value: unknown): string;
  collectArtboardFontDescriptors(
    webview: PreviewHandle,
  ): Promise<FontDescriptor[] | null>;
  parseFontUnicodeRanges(unicodeRange?: string): UnicodeRange[] | null;
  normalizeFontWeightRange(weight: string): string;
  parseExportFontFaceRules(css: string): ExportFontFace[];
  indexExportFontUsage(fontFaces: readonly FontDescriptor[]): FontUsageIndex;
  pruneUnusedExportFontFaces(
    css: string,
    fontUsage: FontUsageIndex,
  ): FontPruning;
  createFontAwareExportResolver(
    resolveAsset: ExportAssetResolver,
    fontDescriptors: readonly FontDescriptor[],
  ): FontAwareResolver;
  fontLoadProbeScript(timeoutMs: number): string;
  isValidExportFontDescriptor(state: unknown): state is FontDescriptor;
  normalizeFontFamily(family: string): string;
  fontUnicodeRangesKey(ranges: readonly UnicodeRange[]): string;
  fontFaceKey(family: string, style: string, weight: string): string;
  fontRangesContainSpace(ranges: readonly UnicodeRange[]): boolean;
  cssFontFacePropertyPattern(property: string): RegExp;
  artboardsInReadingOrder<Board extends { x?: number; y?: number; h: number }>(
    boards: readonly Board[],
  ): Board[];
  encodeBinaryBase64(bytes: Uint8Array | ArrayBuffer): string;
  decodeBinaryBase64(base64: string): OwnedBytes;
}
