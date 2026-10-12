/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** Structure role of a tagged-PDF block. */
export type PdfBlockRole =
  | "P"
  | "H1"
  | "H2"
  | "H3"
  | "H4"
  | "H5"
  | "H6"
  | "L"
  | "Table"
  | "Figure"
  | "Artifact";
/** Roles of blocks that directly hold text runs (not tables or figures). */
export type PdfTextBlockRole = Exclude<PdfBlockRole, "Table" | "Figure">;
/** List numbering kinds a "L" block can declare. */
export type PdfListNumbering =
  | "None"
  | "Disc"
  | "Circle"
  | "Square"
  | "Decimal"
  | "UpperRoman"
  | "LowerRoman"
  | "UpperAlpha"
  | "LowerAlpha";
/** How the invisible text layer is encoded: base-14 Helvetica (WinAnsi) or an embedded glyphless Unicode font. */
export type PdfTextEncoding = "winansi" | "unicode";

/** A text run of a page, in PDF points with the origin at the bottom-left corner. */
export interface PdfTextRun {
  text: string;
  xPt: number;
  yPt: number;
  sizePt: number;
  widthPt: number;
  /** Index of the page block the run belongs to. */
  block?: number | undefined;
  /** List item index (blocks with role "L"). */
  item?: number | undefined;
  /** Row-major cell index (blocks with role "Table"). */
  cell?: number | undefined;
  /** Link id of the run (matches the anchor of a link annotation). */
  link?: number | undefined;
  /** Whether a word space separates this run from the previous one; undefined when unknown. */
  spaceBefore?: boolean | undefined;
}
export interface PdfBlockBox {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}
/** A structural block of a page for the tagged-PDF tree. Members beyond `role` belong to specific roles. */
export interface PdfBlock {
  role: PdfBlockRole;
  /** Figure: bounding box on the page. */
  box?: PdfBlockBox | undefined;
  /** Figure: alternative text. */
  alt?: string | undefined;
  /** Figure: link id of the figure, matching a link annotation anchor. */
  link?: number | undefined;
  /** Table: row and column counts. */
  rows?: number | undefined;
  cols?: number | undefined;
  /** Table: leading rows that are column headers. */
  headerRows?: number | null | undefined;
  /** List: numbering kind. */
  numbering?: PdfListNumbering | null | undefined;
}
/** A clickable link rectangle on a page, in PDF points. */
export interface PdfLink {
  uri: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  /** Link id tying the rectangle to text runs or a figure block. */
  anchor?: number | undefined;
}
/** A page's pixels as a zlib stream of 8-bit RGB rows (lossless alternative to the page JPEG). */
export interface PdfLosslessImage {
  width: number;
  height: number;
  zlib: Uint8Array;
}
/** One page: its JPEG picture plus the text, structure and links laid over it. */
export interface PdfPageInput {
  jpeg: Uint8Array;
  lossless?: PdfLosslessImage | null | undefined;
  widthPt: number;
  heightPt: number;
  textRuns?: PdfTextRun[] | undefined;
  blocks?: PdfBlock[] | null | undefined;
  links?: PdfLink[] | undefined;
}
export interface PdfDocumentOptions {
  title?: string | undefined;
  /** Defaults to "winansi". */
  textEncoding?: PdfTextEncoding | undefined;
  /** Produce a tagged PDF (structure tree, language, figure and link tags). */
  tagged?: boolean | undefined;
  /** Add bookmarks from heading blocks (tagged PDFs only). */
  outline?: boolean | undefined;
  /** BCP 47 language tag of the document (tagged PDFs only). */
  lang?: string | undefined;
}
export interface PdfJpegInfo {
  width: number;
  height: number;
  components: 1 | 3;
}
/** Anything that can read back canvas pixels. */
export type PdfPixelSource = Pick<CanvasRenderingContext2D, "getImageData">;
/** A text string encoded for a PDF content stream: the Tj operand and its advance width in em. */
export interface PdfEncodedText {
  operand: string;
  em: number;
  /** Set when right-to-left text was reordered into visual order. */
  reordered?: boolean;
}
export type PdfTextEncoder = (text: string) => PdfEncodedText | undefined;
/** Glyph bookkeeping of the embedded Unicode font: code points beyond the BMP get private CIDs. */
export interface PdfGlyphUsage {
  astral: Map<number, number>;
  highBytes: Set<number>;
}
/** A marked-content sequence of a page that the structure tree points at. */
export interface PdfMark {
  mcid: number;
  block: number | undefined;
  item: number | undefined;
  link: number | undefined;
}
/** Content-stream operators for a page together with the marked-content sequences they open. */
export interface PdfContentOperators {
  ops: string;
  marks: PdfMark[];
}
/** A text run after validation and encoding. */
export interface PreparedPdfTextRun {
  run: PdfTextRun;
  encoded: PdfEncodedText;
  block: number | undefined;
  item: number | undefined;
  link: number | undefined;
}
/** Link annotation dictionaries of a page, with the anchor of each one. */
export interface PdfLinkAnnotations {
  dicts: string[];
  anchors: (number | undefined)[];
}
/** Objects of a PDF structure part: the root object number, the next free one, and the bodies by relative object number. */
export interface PdfObjectGroup {
  rootObj: number;
  nextObj: number;
  bodies: string[];
}
/** Clipped bounds of a block on its page, in PDF points. */
export interface PdfClipBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** A PDF object made of byte chunks (dictionary, stream data, ...). */
export type PdfObjectBytes = Uint8Array[];

/** Number-or-reference entries of a structure element's /K array. */
type StructureKid = number | string;
interface StructureTable {
  rows: number[];
  cells: number[];
  mcids: StructureKid[][];
}
interface StructureListItem {
  li: number;
  body: number;
  mcids: StructureKid[];
}
interface StructureBlock {
  obj: number;
  mcids: StructureKid[];
  items: Map<number, StructureListItem>;
  table: StructureTable | undefined;
}
/** A /Link structure element wrapping marked content. */
interface StructureLink {
  obj: number;
  kids: StructureKid[];
  parent: number;
}
/** A bookmark entry. */
interface PdfOutlineItem {
  page: number;
  title: string;
}

/** What the PDF writer exposes to the editor (live getters, filled when the writer initializes). */
export interface PdfWriterExports {
  safeLinkUri: (uri: unknown) => string | undefined;
  parseJpeg: (bytes: Uint8Array) => PdfJpegInfo;
  listNumbering: (listStyle: string) => PdfListNumbering | undefined;
  jpegPagesToPdf: (
    pages: PdfPageInput[],
    options?: PdfDocumentOptions,
  ) => Uint8Array;
  jpegBytesFromDataUri: (dataUri: string) => Uint8Array | undefined;
  isLanguageTag: (tag: unknown) => boolean;
  guessLanguage: (text: string) => string | undefined;
  documentLanguage: (text: string, preferredLanguage?: string) => string;
  deflatePagePixels: (
    context: PdfPixelSource,
    width: number,
    height: number,
    byteLimit?: number,
    timeLimitMs?: number,
  ) => Promise<PdfLosslessImage | undefined>;
  cssPxToPt: (px: number) => number;
  PDF_TEXT_BLOCK_ROLES: readonly PdfTextBlockRole[];
  PDF_LIST_NUMBERINGS: readonly PdfListNumbering[];
  PDF_BLOCK_ROLES: readonly PdfBlockRole[];
  PAGE_PIXELS_TOO_SLOW: string;
  MAX_BLOCKS_PER_PAGE: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    pdfWriterExports: PdfWriterExports;
    pdfListNumbering: PdfWriterExports["listNumbering"];
    cssPixelsToPdfPoints: PdfWriterExports["cssPxToPt"];
    jpegBytesFromDataUri: PdfWriterExports["jpegBytesFromDataUri"];
    deflatePagePixels: PdfWriterExports["deflatePagePixels"];
    compressionTimeoutMessage: string;
    initializePdfWriter: () => void;
    base64ToBytes: (base64: string) => Uint8Array;
    parseJpegDimensions: PdfWriterExports["parseJpeg"];
    deflateWorstCaseBytes: (byteLength: number) => number;
    validateLosslessPageImage: (
      image: PdfLosslessImage,
      page: PdfJpegInfo,
    ) => void;
    winAnsiCodePoint: (codePoint: number) => number | undefined;
    winAnsiGlyphWidth: (code: number) => number;
    encodeWinAnsiText: (text: string) => number[] | undefined;
    escapePdfWinAnsiText: (bytes: number[]) => string;
    unicodePdfGlyphWidth: (codePoint: number) => number;
    unicodeHex4: (code: number) => string;
    encodeUnicodePdfText: (
      text: string,
      glyphs: PdfGlyphUsage,
    ) => number[] | undefined;
    pdfCmapEntries: (kind: string, entries: string[]) => string;
    unicodeToPdfCmap: (glyphs: PdfGlyphUsage) => string;
    pdfUnicodeFontObjects: (
      firstObjectId: number,
      glyphs: PdfGlyphUsage,
    ) => PdfObjectBytes[];
    simpleRtlVisualOrder: (text: string) => string | undefined;
    createUnicodePdfTextEncoder: (glyphs: PdfGlyphUsage) => PdfTextEncoder;
    preparePdfTextRuns: (
      runs: PdfTextRun[],
      pageIndex: number,
      pageWidth: number,
      pageHeight: number,
      encoder: PdfTextEncoder,
      blocks: PdfBlock[] | null | undefined,
      tagged: boolean,
    ) => PreparedPdfTextRun[];
    pdfRunsNeedSpace: (previousRun: PdfTextRun, run: PdfTextRun) => boolean;
    pdfTextOperators: (
      runs: PreparedPdfTextRun[],
      spaceOperand: PdfEncodedText,
      tagged: boolean,
      pageRoles: PdfBlockRole[],
      blocks: PdfBlock[] | null | undefined,
      knownLinks: ReadonlySet<number>,
    ) => PdfContentOperators;
    clipPdfBlockBounds: (
      block: PdfBlock,
      width: number,
      height: number,
    ) => PdfClipBounds | undefined;
    pdfFigureOperators: (
      blocks: PdfBlock[] | null | undefined,
      width: number,
      height: number,
      nextMcid: number,
      tagged: boolean,
    ) => PdfContentOperators;
    pdfFigureLinkBlocks: (
      blocks: PdfBlock[] | null | undefined,
      textRuns: PreparedPdfTextRun[],
      width: number,
      height: number,
    ) => Map<number, number>;
    textSegmentsNeedSpace: (
      previousText: string,
      text: string,
      explicit: boolean,
    ) => boolean;
    safePdfLinkUri: PdfWriterExports["safeLinkUri"];
    pdfLinkAnnotations: (
      links: PdfLink[] | undefined,
      width: number,
      height: number,
      maximum: number,
      warn: () => void,
      objectId?: number,
      anchorId?: (anchor: number) => string | undefined,
    ) => PdfLinkAnnotations;
    guessTextLanguage: PdfWriterExports["guessLanguage"];
    scoreLatinLanguages: (words: string[]) => [string, number][];
    isLanguageTag: PdfWriterExports["isLanguageTag"];
    documentLanguage: PdfWriterExports["documentLanguage"];
    pdfHeadingStructureLevels: (
      pages: PdfPageInput[],
      textRuns: PreparedPdfTextRun[][],
    ) => PdfBlockRole[][];
    pdfStructureTreeObjects: (
      firstObjectId: number,
      pages: PdfPageInput[],
      textMarks: PdfContentOperators[],
      figureMarks: PdfContentOperators[],
      pageRoles: PdfBlockRole[][],
      annotationObjects: number[][],
      annotationAnchors: (number | undefined)[][],
      figureBlocksByLink: Map<number, number>[],
      pageObjectId: (page: number) => number,
    ) => PdfObjectGroup;
    pdfOutlineObjects: (
      firstObjectId: number,
      textRuns: PreparedPdfTextRun[][],
      pageRoles: PdfBlockRole[][],
      pageObjectId: (page: number) => number,
    ) => PdfObjectGroup | undefined;
    asciiPdfBytes: (text: string) => Uint8Array;
    formatPdfNumber: (value: number) => string;
    sanitizePdfMetadataText: (
      text: string,
      fontMode: PdfTextEncoding,
    ) => string;
    sanitizeUnicodeMetadata: (text: string, maxLength: number) => string;
    normalizePdfOutlineTitle: (text: string, maxLength: number) => string;
    pdfStringOperand: (text: string) => string;
    pdfInfoTextOperand: (text: string, fontMode: PdfTextEncoding) => string;
    pdfXmpMetadata: (title: string) => PdfObjectBytes;
    jpegPagesToPdf: PdfWriterExports["jpegPagesToPdf"];
    pdfListNumberingNames: Record<string, PdfListNumbering>;
    maxLosslessPageDimension: number;
    losslessCompressionRowsPerChunk: number;
    winAnsiExtraCodePoints: Record<number, number>;
    helveticaAsciiGlyphWidths: number[];
    unicodeAstralGlyphCidStart: number;
    maxAstralPdfGlyphs: number;
    unicodeReplacementCodePoint: number;
    embeddedPdfFontBase64: string;
    compressedPdfCidToGidMapBase64: string;
    wideUnicodeGlyphRanges: [number, number][];
    defaultUnicodeGlyphWidth: number;
    rtlTextPattern: RegExp;
    rtlCandidatePattern: RegExp;
    unicodeLetterPatternForRtl: RegExp;
    rtlTextClusterPattern: RegExp;
    pdfEncodedSpaceOperands: Record<PdfTextEncoding, PdfEncodedText>;
    encodeWinAnsiPdfText: PdfTextEncoder;
    maxPdfPageTextCharacters: number;
    pdfStructureRoles: readonly PdfBlockRole[];
    pdfTextStructureRoles: readonly PdfTextBlockRole[];
    pdfListNumberingKinds: readonly PdfListNumbering[];
    pdfStructureRoleSet: ReadonlySet<PdfBlockRole>;
    pdfListNumberingKindSet: ReadonlySet<PdfListNumbering>;
    maxPdfStructureBlocks: number;
    pdfTableCellStructureRole: (
      block: PdfBlock,
      cellIndex: number,
    ) => "TH" | "TD";
    maxPdfFigureAltLength: number;
    noWordSpaceScriptPattern: RegExp;
    maxPdfLinkLength: number;
    maxPdfAnnotations: number;
    maxPdfDocumentLinks: number;
    minPdfLinkSizePoints: number;
    latinLanguageWordLists: [string, string][];
    distinctiveLanguageScriptPatterns: [string, RegExp][];
    japaneseScriptPattern: RegExp;
    hanScriptPattern: RegExp;
    koreanScriptPattern: RegExp;
    latinScriptPattern: RegExp;
    languageTagPattern: RegExp;
    inferredScriptLanguages: [RegExp, string, string][];
    maxPdfPages: number;
    minPdfPagePoints: number;
    maxPdfPagePoints: number;
    maxPdfTextCoordinate: number;
  }
}

export function installExportPdfWriter(runtime: RuntimeBindings): () => void {
  var pdfWriterExports: RuntimeBindings["pdfWriterExports"];
  var pdfListNumberingNames: RuntimeBindings["pdfListNumberingNames"];
  var maxLosslessPageDimension: RuntimeBindings["maxLosslessPageDimension"];
  var losslessCompressionRowsPerChunk: RuntimeBindings["losslessCompressionRowsPerChunk"];
  var compressionTimeoutMessage: RuntimeBindings["compressionTimeoutMessage"];
  var winAnsiExtraCodePoints: RuntimeBindings["winAnsiExtraCodePoints"];
  var helveticaAsciiGlyphWidths: RuntimeBindings["helveticaAsciiGlyphWidths"];
  var unicodeAstralGlyphCidStart: RuntimeBindings["unicodeAstralGlyphCidStart"];
  var maxAstralPdfGlyphs: RuntimeBindings["maxAstralPdfGlyphs"];
  var unicodeReplacementCodePoint: RuntimeBindings["unicodeReplacementCodePoint"];
  var embeddedPdfFontBase64: RuntimeBindings["embeddedPdfFontBase64"];
  var compressedPdfCidToGidMapBase64: RuntimeBindings["compressedPdfCidToGidMapBase64"];
  var wideUnicodeGlyphRanges: RuntimeBindings["wideUnicodeGlyphRanges"];
  var defaultUnicodeGlyphWidth: RuntimeBindings["defaultUnicodeGlyphWidth"];
  var rtlTextPattern: RuntimeBindings["rtlTextPattern"];
  var rtlCandidatePattern: RuntimeBindings["rtlCandidatePattern"];
  var unicodeLetterPatternForRtl: RuntimeBindings["unicodeLetterPatternForRtl"];
  var rtlTextClusterPattern: RuntimeBindings["rtlTextClusterPattern"];
  var pdfEncodedSpaceOperands: RuntimeBindings["pdfEncodedSpaceOperands"];
  var encodeWinAnsiPdfText: RuntimeBindings["encodeWinAnsiPdfText"];
  var maxPdfPageTextCharacters: RuntimeBindings["maxPdfPageTextCharacters"];
  var pdfStructureRoles: RuntimeBindings["pdfStructureRoles"];
  var pdfTextStructureRoles: RuntimeBindings["pdfTextStructureRoles"];
  var pdfListNumberingKinds: RuntimeBindings["pdfListNumberingKinds"];
  var pdfStructureRoleSet: RuntimeBindings["pdfStructureRoleSet"];
  var pdfListNumberingKindSet: RuntimeBindings["pdfListNumberingKindSet"];
  var maxPdfStructureBlocks: RuntimeBindings["maxPdfStructureBlocks"];
  var pdfTableCellStructureRole: RuntimeBindings["pdfTableCellStructureRole"];
  var maxPdfFigureAltLength: RuntimeBindings["maxPdfFigureAltLength"];
  var noWordSpaceScriptPattern: RuntimeBindings["noWordSpaceScriptPattern"];
  var maxPdfLinkLength: RuntimeBindings["maxPdfLinkLength"];
  var maxPdfAnnotations: RuntimeBindings["maxPdfAnnotations"];
  var maxPdfDocumentLinks: RuntimeBindings["maxPdfDocumentLinks"];
  var minPdfLinkSizePoints: RuntimeBindings["minPdfLinkSizePoints"];
  var latinLanguageWordLists: RuntimeBindings["latinLanguageWordLists"];
  var distinctiveLanguageScriptPatterns: RuntimeBindings["distinctiveLanguageScriptPatterns"];
  var japaneseScriptPattern: RuntimeBindings["japaneseScriptPattern"];
  var hanScriptPattern: RuntimeBindings["hanScriptPattern"];
  var koreanScriptPattern: RuntimeBindings["koreanScriptPattern"];
  var latinScriptPattern: RuntimeBindings["latinScriptPattern"];
  var languageTagPattern: RuntimeBindings["languageTagPattern"];
  var inferredScriptLanguages: RuntimeBindings["inferredScriptLanguages"];
  var maxPdfPages: RuntimeBindings["maxPdfPages"];
  var minPdfPagePoints: RuntimeBindings["minPdfPagePoints"];
  var maxPdfPagePoints: RuntimeBindings["maxPdfPagePoints"];
  var maxPdfTextCoordinate: RuntimeBindings["maxPdfTextCoordinate"];
  var initializePdfWriter: RuntimeBindings["initializePdfWriter"];
  function pdfListNumbering(listStyle: string): PdfListNumbering | undefined {
    return pdfListNumberingNames[listStyle.trim().toLowerCase()];
  }
  function cssPixelsToPdfPoints(px: number): number {
    return (px * 72) / 96;
  }
  function jpegBytesFromDataUri(dataUri: string): Uint8Array | undefined {
    if (!dataUri.startsWith("data:image/jpeg;base64,")) {
      return;
    }
    try {
      return base64ToBytes(dataUri.slice(23));
    } catch {
      return;
    }
  }
  function base64ToBytes(base64: string): Uint8Array {
    let binary = atob(base64),
      bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  function parseJpegDimensions(bytes: Uint8Array): PdfJpegInfo {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) {
      throw Error("not a JPEG image (missing SOI marker)");
    }
    let offset = 2;
    for (;;) {
      if (offset + 1 >= bytes.length) {
        throw Error("not a valid JPEG image (no frame header found)");
      }
      if (bytes[offset] !== 255) {
        throw Error("not a valid JPEG image (corrupt marker stream)");
      }
      let value = offset + 1;
      while (value < bytes.length && bytes[value] === 255) value++;
      if (value >= bytes.length) {
        throw Error("not a valid JPEG image (truncated)");
      }
      let value2 = bytes[value]!;
      if (value2 === 1 || (value2 >= 208 && value2 <= 215)) {
        offset = value + 1;
        continue;
      }
      if (value2 === 217 || value2 === 218) {
        throw Error("not a valid JPEG image (no frame header found)");
      }
      if (offset + 3 >= bytes.length || value + 2 >= bytes.length) {
        throw Error("not a valid JPEG image (truncated)");
      }
      let value3 = (bytes[value + 1]! << 8) | bytes[value + 2]!;
      if (value3 < 2 || value + 1 + value3 > bytes.length) {
        throw Error("not a valid JPEG image (truncated segment)");
      }
      if (value2 === 192 || value2 === 193 || value2 === 194) {
        if (value3 < 8) {
          throw Error("not a valid JPEG image (bad frame header)");
        }
        let value4 = bytes[value + 3],
          value5 = (bytes[value + 4]! << 8) | bytes[value + 5]!,
          value6 = (bytes[value + 6]! << 8) | bytes[value + 7]!,
          value7 = bytes[value + 8];
        if (value4 !== 8) {
          throw Error("unsupported JPEG (only 8-bit precision embeds)");
        }
        if (value6 === 0 || value5 === 0) {
          throw Error("not a valid JPEG image (zero size)");
        }
        if (value7 !== 1 && value7 !== 3) {
          throw Error(
            "unsupported JPEG color layout (" +
              String(value7) +
              " components — only grayscale and RGB embed)",
          );
        }
        return {
          width: value6,
          height: value5,
          components: value7,
        };
      }
      if (
        value2 >= 195 &&
        value2 <= 207 &&
        value2 !== 196 &&
        value2 !== 200 &&
        value2 !== 204
      ) {
        throw Error("unsupported JPEG variant (not baseline or progressive)");
      }
      offset = value + 1 + value3;
    }
  }
  async function deflatePagePixels(
    context: PdfPixelSource,
    width: number,
    height: number,
    byteLimit: number = Number.POSITIVE_INFINITY,
    timeLimitMs: number = Number.POSITIVE_INFINITY,
  ): Promise<PdfLosslessImage | undefined> {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > maxLosslessPageDimension ||
      height > maxLosslessPageDimension
    ) {
      throw Error(
        "cannot compress a page of " +
          String(width) +
          "×" +
          String(height) +
          " pixels",
      );
    }
    if (typeof CompressionStream !== "function") {
      throw Error("this browser cannot compress page pixels");
    }
    let startedAt = performance.now(),
      stream = new CompressionStream("deflate"),
      writer = stream.writable.getWriter(),
      reader = stream.readable.getReader(),
      chunks: Uint8Array[] = [],
      compressedBytes = 0,
      processedRows = 0,
      overBudget = false,
      reading = (async (): Promise<void> => {
        for (;;) {
          let { done: value, value: value2 } = await reader.read();
          if (value) {
            return;
          }
          compressedBytes += value2!.length;
          if (
            compressedBytes >= byteLimit ||
            (processedRows * 4 >= height &&
              compressedBytes * (height / processedRows) > 2 * byteLimit)
          ) {
            overBudget = true;
            await reader.cancel().catch(() => {});
            return;
          }
          chunks.push(value2!);
        }
      })();
    reading.catch(() => {});
    try {
      for (
        let index = 0;
        index < height && !overBudget;
        index += losslessCompressionRowsPerChunk
      ) {
        if (performance.now() - startedAt >= timeLimitMs) {
          throw Error(compressionTimeoutMessage);
        }
        let value = Math.min(
          losslessCompressionRowsPerChunk,
          height - index,
        );
        processedRows = index + value;
        let { data: value2 } = context.getImageData(
          0,
          index,
          width,
          value,
        );
        if (value2.length !== width * value * 4) {
          throw Error("the canvas returned the wrong amount of pixel data");
        }
        let value3 = new Uint8Array(width * value * 3);
        for (
          let index2 = 0, index3 = 0;
          index2 < value2.length;
          index2 += 4, index3 += 3
        ) {
          let value4 = value2[index2 + 3]!;
          if (value4 === 255) {
            value3[index3] = value2[index2]!;
            value3[index3 + 1] = value2[index2 + 1]!;
            value3[index3 + 2] = value2[index2 + 2]!;
          } else {
            value3[index3] = Math.round(
              (value2[index2]! * value4 + 255 * (255 - value4)) / 255,
            );
            value3[index3 + 1] = Math.round(
              (value2[index2 + 1]! * value4 + 255 * (255 - value4)) / 255,
            );
            value3[index3 + 2] = Math.round(
              (value2[index2 + 2]! * value4 + 255 * (255 - value4)) / 255,
            );
          }
        }
        await writer.write(value3);
      }
      if (!overBudget) {
        await writer.close();
      }
    } catch (value: unknown) {
      if (!overBudget) {
        throw (writer.abort(value).catch(() => {}), value);
      }
    }
    await reading;
    if (overBudget) {
      writer.abort().catch(() => {});
      return;
    }
    let zlib = new Uint8Array(compressedBytes),
      offset = 0;
    for (let value of chunks) {
      zlib.set(value, offset);
      offset += value.length;
    }
    return {
      width: width,
      height: height,
      zlib: zlib,
    };
  }
  function deflateWorstCaseBytes(byteLength: number): number {
    return (
      byteLength +
      Math.floor(byteLength / 4096) +
      Math.floor(byteLength / 16384) +
      Math.floor(byteLength / 33554432) +
      13
    );
  }
  function validateLosslessPageImage(image: PdfLosslessImage, page: PdfJpegInfo): void {
    if (typeof image !== "object" || image === null) {
      throw Error("its lossless picture is not an object");
    }
    if (
      !Number.isInteger(image.width) ||
      !Number.isInteger(image.height) ||
      image.width !== page.width ||
      image.height !== page.height
    ) {
      throw Error(
        "its lossless picture is " +
          String(image.width) +
          "×" +
          String(image.height) +
          " pixels but its JPEG is " +
          String(page.width) +
          "×" +
          String(page.height),
      );
    }
    let zlib = image.zlib;
    if (
      Object.prototype.toString.call(zlib) !== "[object Uint8Array]" ||
      zlib.length < 8 ||
      zlib.length > deflateWorstCaseBytes(image.width * image.height * 3) ||
      (zlib[0]! & 15) !== 8 ||
      zlib[0]! >> 4 > 7 ||
      ((zlib[0]! << 8) | zlib[1]!) % 31 !== 0 ||
      (zlib[1]! & 32) !== 0
    ) {
      throw Error("its lossless picture is not a zlib stream of its pixels");
    }
  }
  function winAnsiCodePoint(codePoint: number): number | undefined {
    if (codePoint >= 32 && codePoint <= 126) {
      return codePoint;
    }
    if (codePoint >= 160 && codePoint <= 255) {
      return codePoint;
    }
    return winAnsiExtraCodePoints[codePoint];
  }
  function winAnsiGlyphWidth(code: number): number {
    if (code >= 32 && code <= 126) {
      return helveticaAsciiGlyphWidths[code - 32]!;
    }
    return 556;
  }
  function encodeWinAnsiText(text: string): number[] | undefined {
    let items: number[] = [],
      flag = false;
    for (let value of text) {
      let value2 = value.codePointAt(0)!,
        value3 = winAnsiCodePoint(value2);
      if (value3 === undefined) {
        items.push(32);
      } else if ((items.push(value3), value3 !== 32)) {
        flag = true;
      }
    }
    if (flag) {
      return items;
    } else {
      return undefined;
    }
  }
  function escapePdfWinAnsiText(bytes: number[]): string {
    let text = "";
    for (let value of bytes)
      if (value === 92) {
        text += "\\\\";
      } else if (value === 40) {
        text += "\\(";
      } else if (value === 41) {
        text += "\\)";
      } else if (value >= 32 && value <= 126) {
        text += String.fromCharCode(value);
      } else {
        text += "\\" + value.toString(8).padStart(3, "0");
      }
    return text;
  }
  function unicodePdfGlyphWidth(codePoint: number): number {
    if (codePoint >= 32 && codePoint <= 126) {
      return helveticaAsciiGlyphWidths[codePoint - 32]!;
    }
    if (
      wideUnicodeGlyphRanges.some(
        ([input, input2]) =>
          codePoint >= input && codePoint <= input2,
      )
    ) {
      return 1000;
    } else {
      return defaultUnicodeGlyphWidth;
    }
  }
  function unicodeHex4(code: number): string {
    return code.toString(16).padStart(4, "0");
  }
  function encodeUnicodePdfText(text: string, glyphs: PdfGlyphUsage): number[] | undefined {
    let codes: number[] = [],
      hasText = false;
    for (let value of text) {
      let value2 = value.codePointAt(0)!,
        value3: number;
      if (value2 < 32 || (value2 >= 127 && value2 <= 159)) {
        value3 = 32;
      } else if (value2 >= 55296 && value2 <= 57343) {
        value3 = unicodeReplacementCodePoint;
        hasText = true;
      } else if (value2 > 65535) {
        let entry = glyphs.astral.get(value2);
        if (entry === undefined && glyphs.astral.size < maxAstralPdfGlyphs) {
          entry = unicodeAstralGlyphCidStart + glyphs.astral.size;
          glyphs.astral.set(value2, entry);
        }
        value3 = entry ?? unicodeReplacementCodePoint;
        hasText = true;
      } else if (((value3 = value2), value.trim() !== "")) {
        hasText = true;
      }
      codes.push(value3);
      if (
        value3 < unicodeAstralGlyphCidStart ||
        value3 >= unicodeAstralGlyphCidStart + maxAstralPdfGlyphs
      ) {
        glyphs.highBytes.add(value3 >> 8);
      }
    }
    if (hasText) {
      return codes;
    } else {
      return undefined;
    }
  }
  function pdfCmapEntries(kind: string, entries: string[]): string {
    let text = "";
    for (let index = 0; index < entries.length; index += 100) {
      let value = entries.slice(index, index + 100);
      text +=
        String(value.length) +
        " begin" +
        kind +
        `
` +
        value.join("") +
        "end" +
        kind +
        `
`;
    }
    return text;
  }
  function unicodeToPdfCmap(glyphs: PdfGlyphUsage): string {
    let ranges = [...glyphs.highBytes]
        .sort((input, options) => input - options)
        .map(
          (input) =>
            "<" +
            unicodeHex4(input << 8) +
            "> <" +
            unicodeHex4((input << 8) | 255) +
            "> <" +
            unicodeHex4(input << 8) +
            `>
`,
        ),
      astralMappings: string[] = [];
    for (let [value, value2] of glyphs.astral) {
      let value3 = value - 65536;
      astralMappings.push(
        "<" +
          unicodeHex4(value2) +
          "> <" +
          unicodeHex4(55296 + (value3 >> 10)) +
          unicodeHex4(56320 + (value3 & 1023)) +
          `>
`,
      );
    }
    return (
      `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <ffff>
endcodespacerange
` +
      pdfCmapEntries("bfrange", ranges) +
      pdfCmapEntries("bfchar", astralMappings) +
      `endcmap
CMapName currentdict /CMap defineresource pop
end
end
`
    );
  }
  function pdfUnicodeFontObjects(
    firstObjectId: number,
    glyphs: PdfGlyphUsage,
  ): PdfObjectBytes[] {
    let objectReference = (input: number) =>
        String(firstObjectId + input) + " 0 R",
      streamObject = (input: string, items: Uint8Array): PdfObjectBytes => [
        asciiPdfBytes(
          input +
            " /Length " +
            String(items.length) +
            ` >>
stream
`,
        ),
        items,
        asciiPdfBytes(`
endstream`),
      ],
      fontBytes = base64ToBytes(embeddedPdfFontBase64),
      widths =
        "/DW " +
        String(defaultUnicodeGlyphWidth) +
        " /W [32 [" +
        helveticaAsciiGlyphWidths.join(" ") +
        "] " +
        wideUnicodeGlyphRanges
          .map(
            ([input, input2]) =>
              String(input) + " " + String(input2) + " 1000",
          )
          .join(" ") +
        "]";
    return [
      [
        asciiPdfBytes(
          "<< /Type /Font /Subtype /Type0 /BaseFont /Glyphless /Encoding /Identity-H /DescendantFonts [" +
            objectReference(1) +
            "] /ToUnicode " +
            objectReference(5) +
            " >>",
        ),
      ],
      [
        asciiPdfBytes(
          "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Glyphless /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor " +
            objectReference(2) +
            " " +
            widths +
            " /CIDToGIDMap " +
            objectReference(4) +
            " >>",
        ),
      ],
      [
        asciiPdfBytes(
          "<< /Type /FontDescriptor /FontName /Glyphless /Flags 4 /FontBBox [0 -207 500 718] /ItalicAngle 0 /Ascent 718 /Descent -207 /CapHeight 718 /StemV 80 /FontFile2 " +
            objectReference(3) +
            " >>",
        ),
      ],
      streamObject("<< /Length1 " + String(fontBytes.length), fontBytes),
      streamObject(
        "<< /Filter /FlateDecode",
        base64ToBytes(compressedPdfCidToGidMapBase64),
      ),
      streamObject("<<", asciiPdfBytes(unicodeToPdfCmap(glyphs))),
    ];
  }
  function simpleRtlVisualOrder(text: string): string | undefined {
    if (!rtlCandidatePattern.test(text)) {
      return;
    }
    let clusters = text.match(rtlTextClusterPattern) ?? [];
    if (
      clusters.some(
        (input) =>
          unicodeLetterPatternForRtl.test(input) && !rtlTextPattern.test(input),
      )
    ) {
      return;
    }
    return clusters.reverse().join("");
  }
  function createUnicodePdfTextEncoder(glyphs: PdfGlyphUsage): PdfTextEncoder {
    return (input) => {
      let value = simpleRtlVisualOrder(input),
        value2 = encodeUnicodePdfText(value ?? input, glyphs);
      if (value2 === undefined) {
        return;
      }
      return {
        operand: "<" + value2.map(unicodeHex4).join("") + ">",
        em:
          value2.reduce(
            (input2, options) =>
              input2 + unicodePdfGlyphWidth(options),
            0,
          ) / 1000,
        reordered: value !== undefined,
      };
    };
  }
  function preparePdfTextRuns(
    runs: PdfTextRun[],
    pageIndex: number,
    pageWidth: number,
    pageHeight: number,
    warnings: PdfTextEncoder,
    encode: PdfBlock[] | null | undefined,
    fontMode: boolean,
  ): PreparedPdfTextRun[] {
    let index = 0,
      items: PreparedPdfTextRun[] = [],
      flag = false;
    runs.forEach((input, options) => {
      let value =
          flag && input.spaceBefore !== undefined
            ? {
                ...input,
                spaceBefore: undefined,
              }
            : input,
        value2 =
          "page " + String(pageIndex + 1) + " text run " + String(options + 1);
      if (
        typeof value.text !== "string" ||
        !Number.isFinite(value.xPt) ||
        !Number.isFinite(value.yPt) ||
        !Number.isFinite(value.sizePt) ||
        !Number.isFinite(value.widthPt) ||
        value.sizePt <= 0 ||
        value.widthPt < 0 ||
        value.sizePt > maxPdfPagePoints ||
        value.widthPt > maxPdfTextCoordinate ||
        Math.abs(value.xPt) > maxPdfTextCoordinate ||
        Math.abs(value.yPt) > maxPdfTextCoordinate
      ) {
        throw Error(value2 + " is not a valid text run");
      }
      if (
        fontMode &&
        value.block !== undefined &&
        !(
          Number.isInteger(value.block) &&
          value.block >= 0 &&
          value.block < (encode?.length ?? 0) &&
          encode?.[value.block] != null
        )
      ) {
        throw Error(value2 + " names a block the page does not have");
      }
      if (
        fontMode &&
        value.block !== undefined &&
        encode?.[value.block]?.role === "Figure"
      ) {
        throw Error(
          value2 +
            " points at block " +
            String(value.block + 1) +
            ", a figure, which can hold no text",
        );
      }
      if (
        fontMode &&
        value.spaceBefore !== undefined &&
        typeof value.spaceBefore !== "boolean"
      ) {
        throw Error(
          value2 +
            " has a spaceBefore other than true or false (leave it out when unknown)",
        );
      }
      if (
        fontMode &&
        value.link !== undefined &&
        !(Number.isInteger(value.link) && value.link >= 0)
      ) {
        throw Error(
          value2 +
            " has link " +
            (typeof value.link === "string"
              ? JSON.stringify(value.link)
              : String(value.link)
            ).slice(0, 20) +
            "; it must be a whole number, 0 or more",
        );
      }
      if (
        fontMode &&
        value.item !== undefined &&
        !(
          Number.isInteger(value.item) &&
          value.item >= 0 &&
          value.item < maxPdfStructureBlocks
        )
      ) {
        throw Error(
          value2 + " names a list item that is not a whole number from 0",
        );
      }
      let value3 =
        fontMode &&
        value.block !== undefined &&
        encode?.[value.block]?.role === "Table"
          ? encode[value.block]
          : undefined;
      if (
        value3 !== undefined &&
        value.cell !== undefined &&
        !(
          Number.isInteger(value.cell) &&
          value.cell >= 0 &&
          value.cell < value3.rows! * value3.cols!
        )
      ) {
        throw Error(
          value2 +
            " names table cell " +
            String(value.cell).slice(0, 20) +
            ", but block " +
            String(value.block! + 1) +
            " is a " +
            String(value3.rows) +
            " × " +
            String(value3.cols) +
            " table whose cells are numbered 0 to " +
            String(value3.rows! * value3.cols! - 1),
        );
      }
      index += value.text.length;
      if (index > maxPdfPageTextCharacters) {
        throw Error(
          "page " +
            String(pageIndex + 1) +
            " has an implausibly large text layer",
        );
      }
      if (
        value.xPt > pageWidth ||
        value.yPt < 0 ||
        value.yPt > pageHeight ||
        value.xPt + value.widthPt < 0
      ) {
        flag = true;
        return;
      }
      let value4 =
        value.sizePt < 0.005 ? undefined : warnings(value.text);
      if (value4 === undefined) {
        flag = true;
        return;
      }
      flag = false;
      let value5 = encode?.[value.block ?? -1]?.role;
      items.push({
        run: value,
        encoded: value4,
        block: value.block,
        item:
          value5 === "L"
            ? (value.item ?? 0)
            : value5 === "Table"
              ? (value.cell ?? 0)
              : undefined,
        link: fontMode && value5 !== "Artifact" ? value.link : undefined,
      });
    });
    return items;
  }
  function pdfRunsNeedSpace(previousRun: PdfTextRun, run: PdfTextRun): boolean {
    if (run.spaceBefore !== undefined) {
      return (
        run.spaceBefore &&
        textSegmentsNeedSpace(previousRun.text, run.text, true)
      );
    } else {
      return (
        Math.abs(run.yPt - previousRun.yPt) >=
          0.5 * Math.max(previousRun.sizePt, run.sizePt) &&
        textSegmentsNeedSpace(previousRun.text, run.text, false)
      );
    }
  }
  function pdfTextOperators(
    runs: PreparedPdfTextRun[],
    pageIndex: PdfEncodedText,
    fontMode: boolean,
    unicodeEncoder: PdfBlockRole[],
    warnings: PdfBlock[] | null | undefined,
    knownLinks: ReadonlySet<number>,
  ): PdfContentOperators {
    if (runs.length === 0) {
      return {
        ops: "",
        marks: [],
      };
    }
    runs = runs.map(
      (input) =>
        input.link === undefined || knownLinks.has(input.link)
          ? input
          : {
              ...input,
              link: undefined,
            },
    );
    let marks: PdfMark[] = [],
      operators = `BT
3 Tr
`,
      callback = (
        input: PreparedPdfTextRun,
        options: PreparedPdfTextRun | undefined,
      ): boolean =>
        options !== undefined &&
        input.block !== undefined &&
        options.block === input.block &&
        options.item === input.item,
      callback2 = (
        input: PreparedPdfTextRun,
        options: PreparedPdfTextRun,
      ): boolean =>
        callback(input, options) && options.link === input.link;
    runs.forEach((input, options) => {
      let {
          run: value,
          encoded: value2,
          block: value3,
          item: value4,
          link: value5,
        } = input,
        value6 = runs[options + 1];
      if (fontMode && !(options > 0 && callback2(runs[options - 1]!, input))) {
        if (options > 0) {
          operators += `EMC
`;
        }
        let value10 =
            value3 === undefined ? "P" : unicodeEncoder[value3],
          value11 =
            value10 === "L"
              ? "LBody"
              : value10 === "Table"
                ? pdfTableCellStructureRole(warnings![value3!]!, value4 ?? 0)
                : value10;
        if (value11 === "Artifact") {
          operators += `/Artifact BMC
`;
        } else {
          operators +=
            "/" +
            (value5 !== undefined ? "Link" : value11) +
            " << /MCID " +
            String(marks.length) +
            ` >> BDC
`;
          marks.push({
            mcid: marks.length,
            block: value3,
            item: value4,
            link: value5,
          });
        }
      }
      let value7 =
          fontMode &&
          callback(input, value6) &&
          value2.reordered !== true &&
          pdfRunsNeedSpace(value, value6!.run)
            ? pageIndex
            : undefined,
        value8 = value2.em * value.sizePt,
        value9 = value8 > 0 ? (100 * value.widthPt) / value8 : 100;
      value9 = Math.max(10, Math.min(1000, value9));
      operators +=
        "/F0 " +
        formatPdfNumber(value.sizePt) +
        ` Tf
` +
        formatPdfNumber(value9) +
        ` Tz
1 0 0 1 ` +
        formatPdfNumber(value.xPt) +
        " " +
        formatPdfNumber(value.yPt) +
        ` Tm
`;
      operators +=
        value7 === undefined
          ? value2.operand +
            ` Tj
`
          : "[" +
            value2.operand +
            " " +
            formatPdfNumber(value7.em * 1000) +
            " " +
            value7.operand +
            `] TJ
`;
    });
    return {
      ops:
        operators +
        (fontMode
          ? `EMC
`
          : "") +
        `ET
`,
      marks: marks,
    };
  }
  function clipPdfBlockBounds(
    block: PdfBlock,
    width: number,
    height: number,
  ): PdfClipBounds | undefined {
    let box = block.box!,
      [left, bottom, right, top] = [
        Math.max(0, box.xPt),
        Math.max(0, box.yPt),
        Math.min(width, box.xPt + box.widthPt),
        Math.min(height, box.yPt + box.heightPt),
      ];
    if (right - left < 0.5 || top - bottom < 0.5) {
      return undefined;
    } else {
      return {
        x0: left,
        y0: bottom,
        x1: right,
        y1: top,
      };
    }
  }
  function pdfFigureOperators(
    blocks: PdfBlock[] | null | undefined,
    width: number,
    height: number,
    nextMcid: number,
    tagged: boolean,
  ): PdfContentOperators {
    let marks: PdfMark[] = [],
      operators = "";
    if (!tagged) {
      return {
        ops: operators,
        marks: marks,
      };
    }
    (blocks ?? []).forEach((input, options) => {
      if (input.role !== "Figure") {
        return;
      }
      let value = clipPdfBlockBounds(input, width, height);
      if (value === undefined) {
        return;
      }
      let value2 = nextMcid + marks.length;
      marks.push({
        mcid: value2,
        block: options,
        item: undefined,
        link: undefined,
      });
      operators +=
        "/Figure << /MCID " +
        String(value2) +
        ` >> BDC
` +
        [value.x0, value.y0, value.x1 - value.x0, value.y1 - value.y0]
          .map(formatPdfNumber)
          .join(" ") +
        ` re n
EMC
`;
    });
    return {
      ops: operators,
      marks: marks,
    };
  }
  function pdfFigureLinkBlocks(
    blocks: PdfBlock[] | null | undefined,
    textRuns: PreparedPdfTextRun[],
    width: number,
    height: number,
  ): Map<number, number> {
    let linkedTextIds = new Set(
        textRuns
          .map((input) => input.link)
          .filter((input) => input !== undefined),
      ),
      figureBlocksByLink = new Map<number, number>();
    (blocks ?? []).forEach((input, options) => {
      if (
        input.role !== "Figure" ||
        input.link === undefined ||
        linkedTextIds.has(input.link) ||
        figureBlocksByLink.has(input.link) ||
        clipPdfBlockBounds(input, width, height) === undefined
      ) {
        return;
      }
      figureBlocksByLink.set(input.link, options);
    });
    return figureBlocksByLink;
  }
  function textSegmentsNeedSpace(
    previousText: string,
    text: string,
    explicit: boolean,
  ): boolean {
    if (
      previousText === "" ||
      text === "" ||
      /\s$/u.test(previousText) ||
      /^\s/u.test(text) ||
      (!explicit && /[\-\u00ad\u2010-\u2014]$/u.test(previousText))
    ) {
      return false;
    }
    return !(
      noWordSpaceScriptPattern.test(previousText.slice(-1)) ||
      noWordSpaceScriptPattern.test(text[0]!)
    );
  }
  function safePdfLinkUri(uri: unknown): string | undefined {
    if (typeof uri !== "string" || uri.length > maxPdfLinkLength) {
      return;
    }
    let value = uri.trim();
    if (!/^(?:https?:\/\/|mailto:)/i.test(value)) {
      return;
    }
    let value2: string;
    try {
      let value3 = new URL(value);
      if (
        value3.protocol !== "http:" &&
        value3.protocol !== "https:" &&
        value3.protocol !== "mailto:"
      ) {
        return;
      }
      if (value3.username !== "" || value3.password !== "") {
        return;
      }
      if (value3.protocol === "mailto:" && value3.pathname === "") {
        return;
      }
      value2 = value3.href;
    } catch {
      return;
    }
    if (value2.length > maxPdfLinkLength || !/^[\x21-\x7e]+$/.test(value2)) {
      return;
    }
    return value2;
  }
  function pdfLinkAnnotations(
    links: PdfLink[] | undefined,
    width: number,
    height: number,
    maximum: number,
    warn: () => void,
    objectId?: number,
    anchorId?: (anchor: number) => string | undefined,
  ): PdfLinkAnnotations {
    let annotations: string[] = [],
      anchors: (number | undefined)[] = [];
    if (!Array.isArray(links)) {
      return {
        dicts: annotations,
        anchors: anchors,
      };
    }
    for (let value of links) {
      if (annotations.length >= maximum) {
        warn();
      }
      if (annotations.length >= Math.min(maxPdfAnnotations, maximum)) {
        break;
      }
      if (typeof value !== "object" || value === null) {
        continue;
      }
      let value2 = safePdfLinkUri(value.uri);
      if (value2 === undefined) {
        continue;
      }
      if (
        !Number.isFinite(value.xPt) ||
        !Number.isFinite(value.yPt) ||
        !Number.isFinite(value.widthPt) ||
        !Number.isFinite(value.heightPt)
      ) {
        continue;
      }
      let value3 = Math.max(0, value.xPt),
        value4 = Math.max(0, value.yPt),
        value5 = Math.min(width, value.xPt + value.widthPt),
        value6 = Math.min(height, value.yPt + value.heightPt);
      if (
        value5 - value3 < minPdfLinkSizePoints ||
        value6 - value4 < minPdfLinkSizePoints
      ) {
        continue;
      }
      let value7 = value2.replace(/[\\()]/g, "\\$&"),
        value8 =
          typeof value.anchor === "number" &&
          Number.isInteger(value.anchor) &&
          value.anchor >= 0
            ? value.anchor
            : undefined,
        value9 =
          value8 !== undefined && anchorId !== undefined
            ? anchorId(value8)
            : undefined;
      anchors.push(value8);
      annotations.push(
        "<< /Type /Annot /Subtype /Link /Rect [" +
          [value3, value4, value5, value6].map(formatPdfNumber).join(" ") +
          "] /Border [0 0 0] /H /N /F 4 /A << /Type /Action /S /URI /URI (" +
          value7 +
          ") >>" +
          (objectId === undefined
            ? ""
            : " /StructParent " +
              String(objectId + annotations.length) +
              " /Contents " +
              (value9 !== undefined
                ? pdfStringOperand(value9)
                : "(" + value7 + ")")) +
          " >>",
      );
    }
    return {
      dicts: annotations,
      anchors: anchors,
    };
  }
  function guessTextLanguage(text: string): string | undefined {
    let sample = text.slice(0, 200000),
      count = (input: RegExp): number =>
        (sample.match(input) ?? []).length,
      letterCount = count(/\p{L}/gu);
    if (letterCount < 10) {
      return;
    }
    let [japanese, han, korean] = [
        count(japaneseScriptPattern),
        count(hanScriptPattern),
        count(koreanScriptPattern),
      ],
      weightedLetterCount =
        letterCount + 2 * (japanese + han + korean),
      dominant = (input: number, options = 1): boolean =>
        input * options * 2 > weightedLetterCount;
    if (dominant(japanese + han, 3)) {
      if (japanese >= 2 && japanese * 12 >= japanese + han) {
        return "ja";
      }
      if (japanese * 12 < japanese + han && korean === 0) {
        return "zh";
      } else {
        return undefined;
      }
    }
    if (dominant(korean, 3)) {
      return "ko";
    }
    for (let [value2, value3] of distinctiveLanguageScriptPatterns)
      if (dominant(count(value3))) {
        return value2;
      }
    if (!dominant(count(latinScriptPattern))) {
      return;
    }
    let value = [
        ...scoreLatinLanguages(sample.toLowerCase().match(/\p{L}+/gu) ?? []),
      ].sort(
        (input, options) => options[1] - input[1],
      ),
      [items, items2] = [value[0]!, value[1]!];
    if (items[1] >= 5 && items[1] >= 2 * items2[1]) {
      return items[0];
    } else {
      return undefined;
    }
  }
  function scoreLatinLanguages(words: string[]): [string, number][] {
    return latinLanguageWordLists.map(([input, input2]) => {
      let values = new Set(input2.split(" "));
      return [
        input,
        words.reduce(
          (input3, options) =>
            input3 + (values.has(options) ? 1 : 0),
          0,
        ),
      ];
    });
  }
  function isLanguageTag(tag: unknown): boolean {
    return typeof tag === "string" && languageTagPattern.test(tag);
  }
  function documentLanguage(
    text: string,
    preferredLanguage: string | undefined = globalThis.navigator?.language,
  ): string {
    let guessed = guessTextLanguage(text);
    if (guessed !== undefined) {
      return guessed;
    }
    if (!isLanguageTag(preferredLanguage)) {
      return "und";
    }
    let [language, ...subtags] = preferredLanguage!
        .toLowerCase()
        .split("-") as [string, ...string[]],
      script = subtags.find(
        (input) => /^[a-z]{4}$/.test(input),
      ),
      languageScript =
        language +
        (script === undefined
          ? ""
          : "-" + script[0]!.toUpperCase() + script.slice(1)),
      value = text.slice(0, 200000),
      length = (value.match(/\p{L}/gu) ?? []).length;
    if (length < 10) {
      return languageScript;
    }
    for (let [value2, value3, value4] of inferredScriptLanguages) {
      let length2 = (value.match(value2) ?? []).filter(
        (input) => unicodeLetterPatternForRtl.test(input),
      ).length;
      if (length2 * 2 <= length) {
        continue;
      }
      if (
        !(script !== undefined
          ? value3.toLowerCase().split(" ").includes(script)
          : value4.split(" ").includes(language))
      ) {
        return "und";
      }
      if (
        language === "en" &&
        (value.match(/[A-Za-z]/g) ?? []).length * 40 < length2 * 39
      ) {
        return "und";
      }
      if (
        latinLanguageWordLists.some(
          ([input]) => input === language,
        )
      ) {
        let value5 = value.toLowerCase().match(/\p{L}+/gu) ?? [],
          value6 = scoreLatinLanguages(value5),
          value7 = value6.find(
            ([input]) => input === language,
          )![1];
        if (
          value6.some(([, input]) => input > value7) ||
          (value5.length >= 30 && value7 * 16 < value5.length)
        ) {
          return "und";
        }
      }
      return languageScript;
    }
    return "und";
  }
  function pdfHeadingStructureLevels(
    pages: PdfPageInput[],
    textRuns: PreparedPdfTextRun[][],
  ): PdfBlockRole[][] {
    let items: number[] = [];
    return textRuns.map((input, options) => {
      let value = (pages[options]!.blocks ?? []).map(
          (input2) => input2.role,
        ),
        values = new Set(
          input.map((input2) => input2.block),
        );
      value.forEach((input2, options2) => {
        let value2 = values.has(options2)
          ? /^H([1-6])$/.exec(input2)
          : null;
        if (value2 === null) {
          return;
        }
        let value3 = Number(value2[1]);
        while (items.length > 0 && items[items.length - 1]! >= value3)
          items.pop();
        items.push(value3);
        value[options2] = ("H" + String(items.length)) as PdfBlockRole;
      });
      return value;
    });
  }
  function pdfStructureTreeObjects(
    firstObjectId: number,
    pages: PdfPageInput[],
    marks: PdfContentOperators[],
    roles: PdfContentOperators[],
    links: PdfBlockRole[][],
    tagged: number[][],
    outlines: (number | undefined)[][],
    title: Map<number, number>[],
    pageObjectId: (page: number) => number,
  ): PdfObjectGroup {
    let value = firstObjectId,
      callback = () => value++,
      value2 = callback(),
      value3 = callback(),
      value4 = callback(),
      callback2 = (input: number): string => String(input) + " 0 R",
      callback3 = (
        input: string,
        options: number,
        context: number,
        value5: string,
        extra = "",
      ): string =>
        "<< /Type /StructElem /S /" +
        input +
        " /P " +
        callback2(options) +
        " /Pg " +
        callback2(pageObjectId(context)) +
        extra +
        " /K " +
        value5 +
        " >>",
      callback4 = (items5: StructureKid[]): string =>
        items5.length === 1 ? String(items5[0]) : "[" + items5.join(" ") + "]",
      entries = new Map<number, string>(),
      items: number[] = [],
      items2: string[] = [],
      items3: string[] = [];
    pages.forEach((input, options) => {
      let value5 = callback();
      items.push(value5);
      let items5: number[] = [],
        items6: number[] = [],
        entries2 = new Map<number, StructureBlock>(),
        items7: StructureLink[] = [],
        entries3 = new Map<number, StructureLink>(),
        values = new Set(
          [...marks[options]!.marks, ...roles[options]!.marks].map(
            (input2) => input2.block,
          ),
        ),
        values2 = new Set(
          outlines[options]!.filter(
            (input2) => input2 !== undefined,
          ),
        ),
        entries4 = new Map<number, number>();
      for (let [value6, value7] of title[options]!)
        if (values2.has(value6)) {
          entries4.set(value7, value6);
        }
      let entries5 = new Map<number, number>(),
        index = 0,
        callback5 = (input2: number): void => {
          for (; index <= input2; index++) {
            if (!values.has(index)) {
              continue;
            }
            let value6 = callback(),
              value7 = input.blocks![index]!,
              value8: StructureTable | undefined =
                value7.role === "Table"
                  ? {
                      rows: Array.from(
                        {
                          length: value7.rows!,
                        },
                        callback,
                      ),
                      cells: Array.from(
                        {
                          length: value7.rows! * value7.cols!,
                        },
                        callback,
                      ),
                      mcids: Array.from(
                        {
                          length: value7.rows! * value7.cols!,
                        },
                        () => [],
                      ),
                    }
                  : undefined;
            entries2.set(index, {
              obj: value6,
              mcids: [],
              items: new Map(),
              table: value8,
            });
            let entry = entries4.get(index);
            if (entry === undefined) {
              items5.push(value6);
              continue;
            }
            let state = {
              obj: callback(),
              kids: [callback2(value6)],
              parent: value5,
            };
            items7.push(state);
            entries3.set(entry, state);
            entries5.set(index, state.obj);
            items5.push(state.obj);
          }
        },
        callback6 = (
          input2: PdfMark,
          options2: number,
          context: StructureKid[],
        ): void => {
          if (input2.link === undefined) {
            context.push(input2.mcid);
            items6[input2.mcid] = options2;
            return;
          }
          let state = {
            obj: callback(),
            kids: [input2.mcid],
            parent: options2,
          };
          items7.push(state);
          if (!entries3.has(input2.link)) {
            entries3.set(input2.link, state);
          }
          context.push(callback2(state.obj));
          items6[input2.mcid] = state.obj;
        };
      for (let value6 of marks[options]!.marks) {
        if (value6.block === undefined) {
          let value7 = callback();
          items5.push(value7);
          let items8: StructureKid[] = [];
          callback6(value6, value7, items8);
          entries.set(
            value7,
            callback3("P", value5, options, callback4(items8)),
          );
          continue;
        }
        callback5(value6.block);
        let entry = entries2.get(value6.block)!;
        if (entry.table !== undefined) {
          callback6(
            value6,
            entry.table.cells[value6.item!]!,
            entry.table.mcids[value6.item!]!,
          );
        } else if (value6.item === undefined) {
          callback6(value6, entry.obj, entry.mcids);
        } else {
          let entry2 = entry.items.get(value6.item);
          if (entry2 === undefined) {
            entry2 = {
              li: callback(),
              body: callback(),
              mcids: [],
            };
            entry.items.set(value6.item, entry2);
          }
          callback6(value6, entry2.body, entry2.mcids);
        }
      }
      callback5((input.blocks?.length ?? 0) - 1);
      for (let value6 of roles[options]!.marks) {
        entries2.get(value6.block!)!.mcids.push(value6.mcid);
        items6[value6.mcid] = entries2.get(value6.block!)!.obj;
      }
      for (let [value6, value7] of entries2) {
        let value8 = links[options]![value6]!;
        if (value8 === "Figure") {
          let value10 = input.blocks![value6]!,
            value11 = clipPdfBlockBounds(
              value10,
              input.widthPt,
              input.heightPt,
            )!,
            value12 =
              typeof value10.alt === "string"
                ? sanitizeUnicodeMetadata(
                    value10.alt,
                    maxPdfFigureAltLength,
                  ).trim()
                : "",
            value13 =
              value12 !== "" ? " /Alt " + pdfStringOperand(value12) : "";
          entries.set(
            value7.obj,
            callback3(
              "Figure",
              entries5.get(value6) ?? value5,
              options,
              callback4(value7.mcids),
              value13 +
                " /A << /O /Layout /BBox [" +
                [value11.x0, value11.y0, value11.x1, value11.y1]
                  .map(formatPdfNumber)
                  .join(" ") +
                "] /Placement /Block >>",
            ),
          );
          continue;
        }
        if (value8 === "Table") {
          let { cols: value10 } = input.blocks![value6]! as { cols: number },
            value11 = input.blocks![value6]!.headerRows ?? 0,
            table = value7.table!;
          entries.set(
            value7.obj,
            callback3(
              "Table",
              value5,
              options,
              "[" + table.rows.map(callback2).join(" ") + "]",
            ),
          );
          table.rows.forEach(
            (input2, options2) => {
              entries.set(
                input2,
                callback3(
                  "TR",
                  value7.obj,
                  options,
                  "[" +
                    table.cells
                      .slice(options2 * value10, (options2 + 1) * value10)
                      .map(callback2)
                      .join(" ") +
                    "]",
                ),
              );
              for (let index2 = 0; index2 < value10; index2++) {
                let value12 = options2 * value10 + index2,
                  value13 =
                    options2 < value11
                      ? " /A << /O /Table /Scope /Column >>"
                      : "",
                  value14 = table.mcids[value12]!;
                entries.set(
                  table.cells[value12]!,
                  value14.length === 0
                    ? "<< /Type /StructElem /S /" +
                        (options2 < value11 ? "TH" : "TD") +
                        " /P " +
                        callback2(input2) +
                        " /Pg " +
                        callback2(pageObjectId(options)) +
                        value13 +
                        " >>"
                    : callback3(
                        options2 < value11 ? "TH" : "TD",
                        input2,
                        options,
                        callback4(value14),
                        value13,
                      ),
                );
              }
            },
          );
          continue;
        }
        if (value8 !== "L") {
          entries.set(
            value7.obj,
            callback3(value8, value5, options, callback4(value7.mcids)),
          );
          continue;
        }
        let numbering = input.blocks![value6]!.numbering,
          value9 =
            numbering == null
              ? ""
              : " /A << /O /List /ListNumbering /" + numbering + " >>";
        entries.set(
          value7.obj,
          callback3(
            "L",
            value5,
            options,
            "[" +
              [...value7.items.values()]
                .map((input2) => callback2(input2.li))
                .join(" ") +
              "]",
            value9,
          ),
        );
        for (let value10 of value7.items.values()) {
          entries.set(
            value10.li,
            callback3(
              "LI",
              value7.obj,
              options,
              "[" + callback2(value10.body) + "]",
            ),
          );
          entries.set(
            value10.body,
            callback3("LBody", value10.li, options, callback4(value10.mcids)),
          );
        }
      }
      let entries6 = new Map<number, string[]>();
      tagged[options]!.forEach(
        (input2, options2) => {
          let value6 =
              "<< /Type /OBJR /Obj " +
              callback2(input2) +
              " /Pg " +
              callback2(pageObjectId(options)) +
              " >>",
            value7 = outlines[options]![options2],
            value8 =
              value7 === undefined ? undefined : entries3.get(value7)?.obj;
          if (value8 !== undefined) {
            entries6.set(value8, [...(entries6.get(value8) ?? []), value6]);
          } else {
            value8 = callback();
            items5.push(value8);
            entries.set(value8, callback3("Link", value5, options, value6));
          }
          items3.push(
            String(pages.length + items3.length) + " " + callback2(value8),
          );
        },
      );
      for (let value6 of items7)
        entries.set(
          value6.obj,
          callback3(
            "Link",
            value6.parent,
            options,
            callback4([...value6.kids, ...(entries6.get(value6.obj) ?? [])]),
          ),
        );
      entries.set(
        value5,
        items5.length === 0
          ? "<< /Type /StructElem /S /Sect /P " +
              callback2(value4) +
              " /Pg " +
              callback2(pageObjectId(options)) +
              " >>"
          : callback3(
              "Sect",
              value4,
              options,
              "[" + items5.map(callback2).join(" ") + "]",
            ),
      );
      items2.push(
        String(options) + " [" + items6.map(callback2).join(" ") + "]",
      );
    });
    let items4: string[] = [];
    items4[value2 - firstObjectId] =
      "<< /Type /StructTreeRoot /K " +
      callback2(value4) +
      " /ParentTree " +
      callback2(value3) +
      " /ParentTreeNextKey " +
      String(pages.length + items3.length) +
      " >>";
    items4[value3 - firstObjectId] =
      "<< /Nums [" + [...items2, ...items3].join(" ") + "] >>";
    items4[value4 - firstObjectId] =
      "<< /Type /StructElem /S /Document /P " +
      callback2(value2) +
      " /K [" +
      items.map(callback2).join(" ") +
      "] >>";
    for (let [value5, value6] of entries)
      items4[value5 - firstObjectId] = value6;
    return {
      rootObj: value2,
      nextObj: value,
      bodies: items4,
    };
  }
  function pdfOutlineObjects(
    firstObjectId: number,
    marks: PreparedPdfTextRun[][],
    roles: PdfBlockRole[][],
    pageObjectId: (page: number) => number,
  ): PdfObjectGroup | undefined {
    let items: PdfOutlineItem[] = [];
    marks.forEach((input, options) => {
      roles[options]!.some((input2, options2) => {
        if (!/^H[1-6]$/.test(input2)) {
          return false;
        }
        let text = "",
          value: PdfTextRun | undefined;
        for (let value2 of input) {
          if (value2.block !== options2) {
            continue;
          }
          text +=
            (value !== undefined && pdfRunsNeedSpace(value, value2.run)
              ? " "
              : "") + value2.run.text;
          value = value2.run;
        }
        text = normalizePdfOutlineTitle(text, maxPdfPages);
        if (text === "") {
          return false;
        }
        items.push({
          page: options,
          title: text,
        });
        return true;
      });
    });
    if (items.length === 0) {
      return;
    }
    let callback = (input: number): string =>
        String(input) + " 0 R",
      items2 = [
        "<< /Type /Outlines /First " +
          callback(firstObjectId + 1) +
          " /Last " +
          callback(firstObjectId + items.length) +
          " /Count " +
          String(items.length) +
          " >>",
      ];
    items.forEach((input, options) => {
      let value = firstObjectId + 1 + options;
      items2.push(
        "<< /Title " +
          pdfStringOperand(input.title) +
          " /Parent " +
          callback(firstObjectId) +
          (options > 0 ? " /Prev " + callback(value - 1) : "") +
          (options < items.length - 1 ? " /Next " + callback(value + 1) : "") +
          " /Dest [" +
          callback(pageObjectId(input.page)) +
          " /XYZ null null null] >>",
      );
    });
    return {
      rootObj: firstObjectId,
      nextObj: firstObjectId + items2.length,
      bodies: items2,
    };
  }
  function asciiPdfBytes(text: string): Uint8Array {
    let bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index++) {
      let value = text.charCodeAt(index);
      if (value > 127) {
        throw Error("internal: non-ASCII in PDF structure");
      }
      bytes[index] = value;
    }
    return bytes;
  }
  function formatPdfNumber(value: number): string {
    return String(Math.round(value * 100) / 100);
  }
  function sanitizePdfMetadataText(text: string, fontMode: PdfTextEncoding): string {
    if (fontMode === "winansi") {
      return Array.from(
        text.slice(0, 256),
        (input) =>
          /^[\x20-\x7e]$/.test(input) ? input : " ",
      ).join("");
    }
    return sanitizeUnicodeMetadata(text, 256);
  }
  function sanitizeUnicodeMetadata(text: string, maxLength: number): string {
    return Array.from(text.slice(0, 2 * maxLength))
      .slice(0, maxLength)
      .map((input) => {
        let value = input.codePointAt(0)!;
        if (value < 32 || (value >= 127 && value <= 159)) {
          return " ";
        }
        if (value >= 55296 && value <= 57343) {
          return String.fromCharCode(unicodeReplacementCodePoint);
        } else {
          return input;
        }
      })
      .join("");
  }
  function normalizePdfOutlineTitle(text: string, maxLength: number): string {
    return sanitizeUnicodeMetadata(
      text.replace(/[\s\p{Cc}]+/gu, " ").trim(),
      maxLength,
    ).trimEnd();
  }
  function pdfStringOperand(text: string): string {
    if (/^[\x20-\x7e]*$/.test(text)) {
      return "(" + text.replace(/[\\()]/g, "\\$&") + ")";
    }
    let hex = "feff";
    for (let index = 0; index < text.length; index++)
      hex += unicodeHex4(text.charCodeAt(index));
    return "<" + hex + ">";
  }
  function pdfInfoTextOperand(text: string, fontMode: PdfTextEncoding): string {
    if (text === "") {
      return "";
    }
    let sanitized = sanitizePdfMetadataText(text, fontMode);
    if (
      fontMode === "winansi" ||
      Array.from(text)
        .slice(0, 256)
        .every((input) => /^[\x20-\x7e]$/.test(input))
    ) {
      return "(" + sanitized.replace(/[\\()]/g, "\\$&") + ")";
    }
    let hex = "feff";
    for (let index = 0; index < sanitized.length; index++)
      hex += unicodeHex4(sanitized.charCodeAt(index));
    return "<" + hex + ">";
  }
  function pdfXmpMetadata(title: string): PdfObjectBytes {
    let items = [
        "<dc:format>application/pdf</dc:format>",
        ...(title === ""
          ? []
          : [
              '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">' +
                ((input) =>
                  input
                    .replace(
                      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,
                      String.fromCharCode(65533),
                    )
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;"))(title) +
                "</rdf:li></rdf:Alt></dc:title>",
            ]),
      ],
      value =
        `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
` +
        `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
` +
        items.join(`
`) +
        `
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`,
      value2 = new TextEncoder().encode(value);
    return [
      asciiPdfBytes(
        "<< /Type /Metadata /Subtype /XML /Length " +
          String(value2.length) +
          ` >>
stream
`,
      ),
      value2,
      asciiPdfBytes(`
endstream`),
    ];
  }
  function jpegPagesToPdf(pages: PdfPageInput[], options?: PdfDocumentOptions): Uint8Array {
    if (pages.length === 0) {
      throw Error("nothing to export — no pages were produced");
    }
    let value = pages.map(
        (input, options2) => {
          if (
            !Number.isFinite(input.widthPt) ||
            !Number.isFinite(input.heightPt) ||
            input.widthPt < minPdfPagePoints ||
            input.heightPt < minPdfPagePoints ||
            input.widthPt > maxPdfPagePoints ||
            input.heightPt > maxPdfPagePoints
          ) {
            throw Error(
              "page " + String(options2 + 1) + " has an out-of-range page size",
            );
          }
          try {
            let value29 = parseJpegDimensions(input.jpeg);
            if (input.lossless != null) {
              validateLosslessPageImage(input.lossless, value29);
            }
            if (options?.tagged === true && input.blocks != null) {
              if (!Array.isArray(input.blocks)) {
                throw Error("its blocks are not a list");
              }
              if (input.blocks.length > maxPdfStructureBlocks) {
                throw Error(
                  "it has more than " +
                    String(maxPdfStructureBlocks) +
                    " blocks",
                );
              }
              let value30 = input.blocks.findIndex(
                (input2) =>
                  typeof input2 !== "object" ||
                  input2 === null ||
                  !pdfStructureRoleSet.has(input2.role),
              );
              if (value30 >= 0) {
                throw Error(
                  "block " +
                    String(value30 + 1) +
                    " has a role other than " +
                    pdfStructureRoles.join(", "),
                );
              }
              let value31 = input.blocks.findIndex(
                  (input2) =>
                    input2.role === "Figure" &&
                    !(
                      typeof input2.box === "object" &&
                      input2.box !== null &&
                      [
                        input2.box.xPt,
                        input2.box.yPt,
                        input2.box.widthPt,
                        input2.box.heightPt,
                      ].every(
                        (input3) =>
                          Number.isFinite(input3) &&
                          Math.abs(input3) <= maxPdfTextCoordinate,
                      ) &&
                      (input2.alt === undefined ||
                        typeof input2.alt === "string")
                    ),
                ),
                value32 = input.blocks.findIndex(
                  (input2) =>
                    input2.role === "Table" &&
                    !(
                      Number.isInteger(input2.cols) &&
                      Number.isInteger(input2.rows) &&
                      input2.cols! >= 1 &&
                      input2.rows! >= 1 &&
                      input2.cols! * input2.rows! <= maxPdfStructureBlocks &&
                      (input2.headerRows == null ||
                        (Number.isInteger(input2.headerRows) &&
                          input2.headerRows >= 0 &&
                          input2.headerRows <= input2.rows!))
                    ),
                );
              if (value32 >= 0) {
                let value35 = input.blocks[value32]!,
                  callback6 = (input2: unknown): string =>
                    String(input2).slice(0, 20);
                throw Error(
                  "block " +
                    String(value32 + 1) +
                    " is a table with rows " +
                    callback6(value35.rows) +
                    ", cols " +
                    callback6(value35.cols) +
                    ", headerRows " +
                    callback6(value35.headerRows) +
                    ": rows and cols must be whole numbers from 1 with rows × cols at most " +
                    String(maxPdfStructureBlocks) +
                    ", and headerRows, when given, a whole number from 0 to rows",
                );
              }
              if (
                input.blocks.reduce(
                  (input2, options3) =>
                    input2 +
                    (options3.role === "Table"
                      ? options3.rows! * options3.cols!
                      : 0),
                  0,
                ) > maxPdfStructureBlocks
              ) {
                throw Error(
                  "its tables hold more than " +
                    String(maxPdfStructureBlocks) +
                    " cells in all",
                );
              }
              if (value31 >= 0) {
                throw Error(
                  "block " +
                    String(value31 + 1) +
                    " is a figure with a bad box (xPt, yPt, widthPt and heightPt must each be a finite number of at most " +
                    String(maxPdfTextCoordinate) +
                    ") or an alt that is not a string",
                );
              }
              let value33 = input.blocks.findIndex(
                (input2) =>
                  input2.role === "Figure" &&
                  input2.link !== undefined &&
                  !(Number.isInteger(input2.link) && input2.link >= 0),
              );
              if (value33 >= 0) {
                let link = input.blocks[value33]!.link;
                throw Error(
                  "block " +
                    String(value33 + 1) +
                    " is a figure with link " +
                    (typeof link === "string"
                      ? JSON.stringify(link)
                      : String(link)
                    ).slice(0, 20) +
                    "; it must be a whole number, 0 or more",
                );
              }
              let value34 = input.blocks.findIndex(
                (input2) =>
                  input2.numbering != null &&
                  !(
                    typeof input2.numbering === "string" &&
                    pdfListNumberingKindSet.has(input2.numbering)
                  ),
              );
              if (value34 >= 0) {
                throw Error(
                  "block " +
                    String(value34 + 1) +
                    " has list numbering " +
                    JSON.stringify(
                      String(input.blocks[value34]!.numbering).slice(0, 40),
                    ) +
                    "; allowed: " +
                    pdfListNumberingKinds.join(", "),
                );
              }
            }
            return value29;
          } catch (value29: unknown) {
            throw Error(
              "page " +
                String(options2 + 1) +
                ": " +
                (value29 instanceof Error ? value29.message : String(value29)),
            );
          }
        },
      ),
      callback = (input: number): number => 4 + 3 * input,
      callback2 = (input: number): number => 5 + 3 * input,
      callback3 = (input: number): number => 6 + 3 * input,
      value2 = pages.some(
        (input) => (input.textRuns?.length ?? 0) > 0,
      ),
      value3: PdfTextEncoding =
        options?.textEncoding === "unicode" ? "unicode" : "winansi",
      state: PdfGlyphUsage = {
        astral: new Map(),
        highBytes: new Set(),
      },
      value4 =
        value3 === "unicode"
          ? createUnicodePdfTextEncoder(state)
          : encodeWinAnsiPdfText,
      value5 = 4 + 3 * pages.length,
      value6 = !value2 ? 0 : value3 === "unicode" ? 6 : 1,
      value7 = options?.tagged === true,
      value8 = options?.lang;
    if (value7 && value8 !== undefined && !isLanguageTag(value8)) {
      throw Error(
        "the document language " +
          JSON.stringify(String(value8).slice(0, 40)) +
          ' is not a language tag such as "en" or "ja-JP"',
      );
    }
    let value9 = pages.map(
        (input, options2) =>
          (input.textRuns?.length ?? 0) > 0
            ? preparePdfTextRuns(
                input.textRuns!,
                options2,
                input.widthPt,
                input.heightPt,
                value4,
                input.blocks,
                value7,
              )
            : [],
      ),
      value10 = value9.map(
        (input, options2) =>
          value7
            ? pdfFigureLinkBlocks(
                pages[options2]!.blocks,
                input,
                pages[options2]!.widthPt,
                pages[options2]!.heightPt,
              )
            : new Map<number, number>(),
      ),
      value11 = value9.map(
        (input, options2) => {
          let entries = new Map<number, { text: string; last: PdfTextRun }>();
          for (let value29 of input) {
            if (value29.link === undefined) {
              continue;
            }
            let entry = entries.get(value29.link);
            if (entry === undefined) {
              entries.set(value29.link, {
                text: value29.run.text,
                last: value29.run,
              });
            } else {
              entries.set(value29.link, {
                text:
                  entry.text +
                  (pdfRunsNeedSpace(entry.last, value29.run) ? " " : "") +
                  value29.run.text,
                last: value29.run,
              });
            }
          }
          let entries2 = new Map<number, string>();
          for (let [value29, value30] of entries) {
            let value31 = normalizePdfOutlineTitle(
              value30.text,
              maxPdfPages,
            );
            if (value31 !== "") {
              entries2.set(value29, value31);
            }
          }
          for (let [value29, value30] of value10[options2]!) {
            let alt = pages[options2]!.blocks![value30]!.alt,
              value31 =
                typeof alt === "string"
                  ? normalizePdfOutlineTitle(alt, maxPdfPages)
                  : "";
            if (value31 !== "") {
              entries2.set(value29, value31);
            }
          }
          return (input2: number) => entries2.get(input2);
        },
      ),
      value12 = maxPdfDocumentLinks,
      flag = false,
      index = 0,
      value13 = pages.map(
        (input, options2) => {
          let value29 = pdfLinkAnnotations(
            input.links,
            input.widthPt,
            input.heightPt,
            value12,
            () => (flag = true),
            value7 ? pages.length + index : undefined,
            value7 ? value11[options2] : undefined,
          );
          value12 -= value29.dicts.length;
          index += value29.dicts.length;
          return value29;
        },
      );
    if (flag) {
      console.warn(
        "[pdf] the file holds " +
          String(maxPdfDocumentLinks) +
          " links; any further ones are not clickable",
      );
    }
    let value14 = value5 + value6,
      value15 = value13.map(
        (input) => input.dicts.map(() => value14++),
      ),
      value16 = value15.map(
        (input) =>
          input
            .map((input2) => String(input2) + " 0 R")
            .join(" "),
      ),
      value17: PdfBlockRole[][] = value7
        ? pdfHeadingStructureLevels(pages, value9)
        : pages.map(() => []),
      value18 = value9.map(
        (input, options2) =>
          pdfTextOperators(
            input,
            pdfEncodedSpaceOperands[value3],
            value7,
            value17[options2]!,
            pages[options2]!.blocks,
            new Set(
              value13[options2]!.anchors.filter(
                (input2) => input2 !== undefined,
              ),
            ),
          ),
      ),
      value19 = pages.map(
        (input, options2) =>
          pdfFigureOperators(
            input.blocks,
            input.widthPt,
            input.heightPt,
            value18[options2]!.marks.length,
            value7,
          ),
      );
    if (value7 && value3 === "unicode") {
      state.highBytes.add(0);
    }
    let value20 = value7
        ? pdfStructureTreeObjects(
            value14,
            pages,
            value18,
            value19,
            value17,
            value15,
            value13.map((input) => input.anchors),
            value10,
            callback,
          )
        : undefined,
      value21 =
        value20 !== undefined && options?.outline === true
          ? pdfOutlineObjects(value20.nextObj, value9, value17, callback)
          : undefined,
      value22 =
        value20 !== undefined
          ? (value21?.nextObj ?? value20.nextObj)
          : undefined,
      value23 = value22 ?? value14 - 1,
      value24 = pages
        .map(
          (input, options2) =>
            String(callback(options2)) + " 0 R",
        )
        .join(" "),
      value25 = pdfInfoTextOperand(options?.title ?? "", value3),
      items: PdfObjectBytes[] = [];
    items.push([
      asciiPdfBytes(
        value20 === undefined
          ? "<< /Type /Catalog /Pages 2 0 R >>"
          : "<< /Type /Catalog /Pages 2 0 R /MarkInfo << /Marked true >> /ViewerPreferences << /DisplayDocTitle true >> /Lang (" +
              (value8 ?? "und") +
              ") /StructTreeRoot " +
              String(value20.rootObj) +
              " 0 R" +
              (value21 !== undefined
                ? " /Outlines " + String(value21.rootObj) + " 0 R"
                : "") +
              " /Metadata " +
              String(value22) +
              " 0 R >>",
      ),
    ]);
    items.push([
      asciiPdfBytes(
        "<< /Type /Pages /Kids [" +
          value24 +
          "] /Count " +
          String(pages.length) +
          " >>",
      ),
    ]);
    items.push([
      asciiPdfBytes(
        "<<" + (value25 === "" ? "" : " /Title " + value25) + " >>",
      ),
    ]);
    pages.forEach((input, options2) => {
      let value29 = value[options2]!,
        value30 =
          input.lossless != null &&
          input.lossless.zlib.length + 2 < input.jpeg.length
            ? input.lossless
            : undefined,
        value31 = formatPdfNumber(input.widthPt),
        value32 = formatPdfNumber(input.heightPt),
        value33 = (input.textRuns?.length ?? 0) > 0;
      items.push([
        asciiPdfBytes(
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
            value31 +
            " " +
            value32 +
            "] /Resources << /XObject << /Im0 " +
            String(callback3(options2)) +
            " 0 R >> " +
            (value33 ? "/Font << /F0 " + String(value5) + " 0 R >> " : "") +
            "/ProcSet [/PDF /ImageC" +
            (value33 ? " /Text" : "") +
            "] >> /Contents " +
            String(callback2(options2)) +
            " 0 R" +
            (value16[options2] === ""
              ? ""
              : " /Annots [" + value16[options2] + "]") +
            (value20 === undefined
              ? ""
              : " /StructParents " + String(options2) + " /Tabs /S") +
            " >>",
        ),
      ]);
      let value34 =
          `q
` +
          value31 +
          " 0 0 " +
          value32 +
          ` 0 0 cm
/Im0 Do
Q
`,
        value35 =
          (value20 === undefined
            ? value34
            : `/Artifact BMC
` +
              value34 +
              `EMC
`) +
          value18[options2]!.ops +
          value19[options2]!.ops;
      items.push([
        asciiPdfBytes(
          "<< /Length " +
            String(value35.length) +
            ` >>
stream
` +
            value35 +
            "endstream",
        ),
      ]);
      let value36 = value30 !== undefined ? value30.zlib : input.jpeg;
      items.push([
        asciiPdfBytes(
          "<< /Type /XObject /Subtype /Image /Width " +
            String(value29.width) +
            " /Height " +
            String(value29.height) +
            " /ColorSpace " +
            (value30 !== undefined || value29.components === 3
              ? "/DeviceRGB"
              : "/DeviceGray") +
            " /BitsPerComponent 8 /Filter " +
            (value30 !== undefined ? "/FlateDecode" : "/DCTDecode") +
            " /Length " +
            String(value36.length) +
            ` >>
stream
`,
        ),
        value36,
        asciiPdfBytes(`
endstream`),
      ]);
    });
    if (value2 && value3 === "unicode") {
      items.push(...pdfUnicodeFontObjects(value5, state));
    } else if (value2) {
      items.push([
        asciiPdfBytes(
          "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        ),
      ]);
    }
    for (let value29 of value13)
      for (let value30 of value29.dicts)
        items.push([asciiPdfBytes(value30)]);
    if (value20 !== undefined) {
      for (let value29 of value20.bodies)
        items.push([asciiPdfBytes(value29)]);
      for (let value29 of (value21?.bodies ?? []))
        items.push([asciiPdfBytes(value29)]);
      items.push(
        pdfXmpMetadata(sanitizePdfMetadataText(options?.title ?? "", value3)),
      );
    }
    let items2: Uint8Array[] = [],
      index2 = 0,
      callback4 = (items4: Uint8Array): void => {
        items2.push(items4);
        index2 += items4.length;
      };
    callback4(
      asciiPdfBytes(
        value20 === undefined
          ? `%PDF-1.4
`
          : `%PDF-1.7
`,
      ),
    );
    callback4(Uint8Array.from([37, 226, 227, 207, 211, 10]));
    let items3: number[] = [];
    items.forEach((input, options2) => {
      items3.push(index2);
      callback4(
        asciiPdfBytes(
          String(options2 + 1) +
            ` 0 obj
`,
        ),
      );
      for (let value29 of input) callback4(value29);
      callback4(
        asciiPdfBytes(`
endobj
`),
      );
    });
    let value26 = index2,
      callback5 = (input: number): string =>
        String(input).padStart(10, "0");
    callback4(
      asciiPdfBytes(
        `xref
0 ` +
          String(value23 + 1) +
          `
0000000000 65535 f 
` +
          items3
            .map(
              (input) =>
                callback5(input) +
                ` 00000 n 
`,
            )
            .join("") +
          `trailer
<< /Size ` +
          String(value23 + 1) +
          ` /Root 1 0 R /Info 3 0 R >>
startxref
` +
          String(value26) +
          `
%%EOF
`,
      ),
    );
    let value27 = items2.reduce(
        (input, items4) => input + items4.length,
        0,
      ),
      value28 = new Uint8Array(value27),
      index3 = 0;
    for (let value29 of items2) {
      value28.set(value29, index3);
      index3 += value29.length;
    }
    return value28;
  }
  bindRuntimeValue(
    runtime,
    "pdfWriterExports",
    () => pdfWriterExports,
    (value) => {
      pdfWriterExports = value;
    },
  );
  bindRuntimeValue(runtime, "pdfListNumbering", () => pdfListNumbering);
  bindRuntimeValue(runtime, "cssPixelsToPdfPoints", () => cssPixelsToPdfPoints);
  bindRuntimeValue(runtime, "jpegBytesFromDataUri", () => jpegBytesFromDataUri);
  bindRuntimeValue(runtime, "base64ToBytes", () => base64ToBytes);
  bindRuntimeValue(runtime, "parseJpegDimensions", () => parseJpegDimensions);
  bindRuntimeValue(runtime, "deflatePagePixels", () => deflatePagePixels);
  bindRuntimeValue(
    runtime,
    "deflateWorstCaseBytes",
    () => deflateWorstCaseBytes,
  );
  bindRuntimeValue(
    runtime,
    "validateLosslessPageImage",
    () => validateLosslessPageImage,
  );
  bindRuntimeValue(runtime, "winAnsiCodePoint", () => winAnsiCodePoint);
  bindRuntimeValue(runtime, "winAnsiGlyphWidth", () => winAnsiGlyphWidth);
  bindRuntimeValue(runtime, "encodeWinAnsiText", () => encodeWinAnsiText);
  bindRuntimeValue(runtime, "escapePdfWinAnsiText", () => escapePdfWinAnsiText);
  bindRuntimeValue(runtime, "unicodePdfGlyphWidth", () => unicodePdfGlyphWidth);
  bindRuntimeValue(runtime, "unicodeHex4", () => unicodeHex4);
  bindRuntimeValue(runtime, "encodeUnicodePdfText", () => encodeUnicodePdfText);
  bindRuntimeValue(runtime, "pdfCmapEntries", () => pdfCmapEntries);
  bindRuntimeValue(runtime, "unicodeToPdfCmap", () => unicodeToPdfCmap);
  bindRuntimeValue(
    runtime,
    "pdfUnicodeFontObjects",
    () => pdfUnicodeFontObjects,
  );
  bindRuntimeValue(runtime, "simpleRtlVisualOrder", () => simpleRtlVisualOrder);
  bindRuntimeValue(
    runtime,
    "createUnicodePdfTextEncoder",
    () => createUnicodePdfTextEncoder,
  );
  bindRuntimeValue(runtime, "preparePdfTextRuns", () => preparePdfTextRuns);
  bindRuntimeValue(runtime, "pdfRunsNeedSpace", () => pdfRunsNeedSpace);
  bindRuntimeValue(runtime, "pdfTextOperators", () => pdfTextOperators);
  bindRuntimeValue(runtime, "clipPdfBlockBounds", () => clipPdfBlockBounds);
  bindRuntimeValue(runtime, "pdfFigureOperators", () => pdfFigureOperators);
  bindRuntimeValue(runtime, "pdfFigureLinkBlocks", () => pdfFigureLinkBlocks);
  bindRuntimeValue(
    runtime,
    "textSegmentsNeedSpace",
    () => textSegmentsNeedSpace,
  );
  bindRuntimeValue(runtime, "safePdfLinkUri", () => safePdfLinkUri);
  bindRuntimeValue(runtime, "pdfLinkAnnotations", () => pdfLinkAnnotations);
  bindRuntimeValue(runtime, "guessTextLanguage", () => guessTextLanguage);
  bindRuntimeValue(runtime, "scoreLatinLanguages", () => scoreLatinLanguages);
  bindRuntimeValue(runtime, "isLanguageTag", () => isLanguageTag);
  bindRuntimeValue(runtime, "documentLanguage", () => documentLanguage);
  bindRuntimeValue(
    runtime,
    "pdfHeadingStructureLevels",
    () => pdfHeadingStructureLevels,
  );
  bindRuntimeValue(
    runtime,
    "pdfStructureTreeObjects",
    () => pdfStructureTreeObjects,
  );
  bindRuntimeValue(runtime, "pdfOutlineObjects", () => pdfOutlineObjects);
  bindRuntimeValue(runtime, "asciiPdfBytes", () => asciiPdfBytes);
  bindRuntimeValue(runtime, "formatPdfNumber", () => formatPdfNumber);
  bindRuntimeValue(
    runtime,
    "sanitizePdfMetadataText",
    () => sanitizePdfMetadataText,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeUnicodeMetadata",
    () => sanitizeUnicodeMetadata,
  );
  bindRuntimeValue(
    runtime,
    "normalizePdfOutlineTitle",
    () => normalizePdfOutlineTitle,
  );
  bindRuntimeValue(runtime, "pdfStringOperand", () => pdfStringOperand);
  bindRuntimeValue(runtime, "pdfInfoTextOperand", () => pdfInfoTextOperand);
  bindRuntimeValue(runtime, "pdfXmpMetadata", () => pdfXmpMetadata);
  bindRuntimeValue(runtime, "jpegPagesToPdf", () => jpegPagesToPdf);
  bindRuntimeValue(
    runtime,
    "pdfListNumberingNames",
    () => pdfListNumberingNames,
    (value) => {
      pdfListNumberingNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxLosslessPageDimension",
    () => maxLosslessPageDimension,
    (value) => {
      maxLosslessPageDimension = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "losslessCompressionRowsPerChunk",
    () => losslessCompressionRowsPerChunk,
    (value) => {
      losslessCompressionRowsPerChunk = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compressionTimeoutMessage",
    () => compressionTimeoutMessage,
    (value) => {
      compressionTimeoutMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "winAnsiExtraCodePoints",
    () => winAnsiExtraCodePoints,
    (value) => {
      winAnsiExtraCodePoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "helveticaAsciiGlyphWidths",
    () => helveticaAsciiGlyphWidths,
    (value) => {
      helveticaAsciiGlyphWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeAstralGlyphCidStart",
    () => unicodeAstralGlyphCidStart,
    (value) => {
      unicodeAstralGlyphCidStart = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxAstralPdfGlyphs",
    () => maxAstralPdfGlyphs,
    (value) => {
      maxAstralPdfGlyphs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeReplacementCodePoint",
    () => unicodeReplacementCodePoint,
    (value) => {
      unicodeReplacementCodePoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedPdfFontBase64",
    () => embeddedPdfFontBase64,
    (value) => {
      embeddedPdfFontBase64 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compressedPdfCidToGidMapBase64",
    () => compressedPdfCidToGidMapBase64,
    (value) => {
      compressedPdfCidToGidMapBase64 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "wideUnicodeGlyphRanges",
    () => wideUnicodeGlyphRanges,
    (value) => {
      wideUnicodeGlyphRanges = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultUnicodeGlyphWidth",
    () => defaultUnicodeGlyphWidth,
    (value) => {
      defaultUnicodeGlyphWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rtlTextPattern",
    () => rtlTextPattern,
    (value) => {
      rtlTextPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rtlCandidatePattern",
    () => rtlCandidatePattern,
    (value) => {
      rtlCandidatePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeLetterPatternForRtl",
    () => unicodeLetterPatternForRtl,
    (value) => {
      unicodeLetterPatternForRtl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rtlTextClusterPattern",
    () => rtlTextClusterPattern,
    (value) => {
      rtlTextClusterPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfEncodedSpaceOperands",
    () => pdfEncodedSpaceOperands,
    (value) => {
      pdfEncodedSpaceOperands = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeWinAnsiPdfText",
    () => encodeWinAnsiPdfText,
    (value) => {
      encodeWinAnsiPdfText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfPageTextCharacters",
    () => maxPdfPageTextCharacters,
    (value) => {
      maxPdfPageTextCharacters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfStructureRoles",
    () => pdfStructureRoles,
    (value) => {
      pdfStructureRoles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfTextStructureRoles",
    () => pdfTextStructureRoles,
    (value) => {
      pdfTextStructureRoles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfListNumberingKinds",
    () => pdfListNumberingKinds,
    (value) => {
      pdfListNumberingKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfStructureRoleSet",
    () => pdfStructureRoleSet,
    (value) => {
      pdfStructureRoleSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfListNumberingKindSet",
    () => pdfListNumberingKindSet,
    (value) => {
      pdfListNumberingKindSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfStructureBlocks",
    () => maxPdfStructureBlocks,
    (value) => {
      maxPdfStructureBlocks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfTableCellStructureRole",
    () => pdfTableCellStructureRole,
    (value) => {
      pdfTableCellStructureRole = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfFigureAltLength",
    () => maxPdfFigureAltLength,
    (value) => {
      maxPdfFigureAltLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noWordSpaceScriptPattern",
    () => noWordSpaceScriptPattern,
    (value) => {
      noWordSpaceScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfLinkLength",
    () => maxPdfLinkLength,
    (value) => {
      maxPdfLinkLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfAnnotations",
    () => maxPdfAnnotations,
    (value) => {
      maxPdfAnnotations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfDocumentLinks",
    () => maxPdfDocumentLinks,
    (value) => {
      maxPdfDocumentLinks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minPdfLinkSizePoints",
    () => minPdfLinkSizePoints,
    (value) => {
      minPdfLinkSizePoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "latinLanguageWordLists",
    () => latinLanguageWordLists,
    (value) => {
      latinLanguageWordLists = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "distinctiveLanguageScriptPatterns",
    () => distinctiveLanguageScriptPatterns,
    (value) => {
      distinctiveLanguageScriptPatterns = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "japaneseScriptPattern",
    () => japaneseScriptPattern,
    (value) => {
      japaneseScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hanScriptPattern",
    () => hanScriptPattern,
    (value) => {
      hanScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "koreanScriptPattern",
    () => koreanScriptPattern,
    (value) => {
      koreanScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "latinScriptPattern",
    () => latinScriptPattern,
    (value) => {
      latinScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "languageTagPattern",
    () => languageTagPattern,
    (value) => {
      languageTagPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inferredScriptLanguages",
    () => inferredScriptLanguages,
    (value) => {
      inferredScriptLanguages = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfPages",
    () => maxPdfPages,
    (value) => {
      maxPdfPages = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minPdfPagePoints",
    () => minPdfPagePoints,
    (value) => {
      minPdfPagePoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfPagePoints",
    () => maxPdfPagePoints,
    (value) => {
      maxPdfPagePoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxPdfTextCoordinate",
    () => maxPdfTextCoordinate,
    (value) => {
      maxPdfTextCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePdfWriter",
    () => initializePdfWriter,
    (value) => {
      initializePdfWriter = value;
    },
  );
  return () => {
    pdfWriterExports = {} as PdfWriterExports;
    (0, runtime.defineLiveExports)(pdfWriterExports, {
      safeLinkUri: () => safePdfLinkUri,
      parseJpeg: () => parseJpegDimensions,
      listNumbering: () => pdfListNumbering,
      jpegPagesToPdf: () => jpegPagesToPdf,
      jpegBytesFromDataUri: () => jpegBytesFromDataUri,
      isLanguageTag: () => isLanguageTag,
      guessLanguage: () => guessTextLanguage,
      documentLanguage: () => documentLanguage,
      deflatePagePixels: () => deflatePagePixels,
      cssPxToPt: () => cssPixelsToPdfPoints,
      PDF_TEXT_BLOCK_ROLES: () => pdfTextStructureRoles,
      PDF_LIST_NUMBERINGS: () => pdfListNumberingKinds,
      PDF_BLOCK_ROLES: () => pdfStructureRoles,
      PAGE_PIXELS_TOO_SLOW: () => compressionTimeoutMessage,
      MAX_BLOCKS_PER_PAGE: () => maxPdfStructureBlocks,
    });
    maxLosslessPageDimension = 65535;
    losslessCompressionRowsPerChunk = 128;
    compressionTimeoutMessage = "compressing the page's pixels took too long";
    unicodeAstralGlyphCidStart = 55296;
    maxAstralPdfGlyphs = 2048;
    unicodeReplacementCodePoint = 65533;
    embeddedPdfFontBase64 =
      "AAEAAAAKAIAAAwAgT1MvMkSQQzcAAAEoAAAAYGNtYXAADABGAAABkAAAACxnbHlmVRS2+AAAAcQAAAAaaGVhZGELQt8AAACsAAAANmhoZWEExAEoAAAA5AAAACRobXR4AfQAAAAAAYgAAAAIbG9jYQANAAAAAAG8AAAABm1heHAABAAGAAABCAAAACBuYW1lA4cLdQAAAeAAAAA+cG9zdAADAAAAAAIgAAAAIAABAAAAAQAAm3oJWV8PPPUAAwPoAAAAAAAAAAAAAAAAAAAAAAAA/zEB9ALOAAAAAwACAAAAAAAAAAEAAALO/zEAAAH0AAAAAAH0AAEAAAAAAAAAAAAAAAAAAAACAAEAAAACAAQAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwH0AZAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPz8/PwAAAAAAAALO/zEAAALOAM8AAAAAAAAAAAAAAAAAAAAgAAAAAAAAAfQAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAGAAAAAIAAgAAAAD//wAA//8AAQAAAAAAAAANAAAAAQAA/zEB9ALOAAMAABURIREB9M8DnfxjAAAAAAAAAgAeAAMAAQQJAAEAEgAAAAMAAQQJAAIADgASAEcAbAB5AHAAaABsAGUAcwBzAFIAZQBnAHUAbABhAHIAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    compressedPdfCidToGidMapBase64 =
      "eNrtwgEJAAAAAqD6fzpoh2gaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBsA/wAQ";
    defaultUnicodeGlyphWidth = 556;
    encodeWinAnsiPdfText = (input) => {
      let value = encodeWinAnsiText(input);
      if (value === undefined) {
        return;
      }
      return {
        operand: "(" + escapePdfWinAnsiText(value) + ")",
        em:
          value.reduce(
            (input2, options) =>
              input2 + winAnsiGlyphWidth(options),
            0,
          ) / 1000,
      };
    };
    maxPdfPageTextCharacters = 200000;
    maxPdfStructureBlocks = 1e4;
    pdfTableCellStructureRole = (
      input,
      options,
    ) =>
      options < (input.headerRows ?? 0) * input.cols! ? "TH" : "TD";
    maxPdfFigureAltLength = 1000;
    maxPdfLinkLength = 2048;
    maxPdfAnnotations = 4000;
    maxPdfDocumentLinks = 1e4;
    minPdfLinkSizePoints = 0.5;
    maxPdfPages = 200;
    minPdfPagePoints = 3;
    maxPdfPagePoints = 14400;
    initializePdfWriter = (0, runtime.initializeOnce)(() => {
      pdfListNumberingNames = {
        none: "None",
        disc: "Disc",
        circle: "Circle",
        square: "Square",
        decimal: "Decimal",
        "decimal-leading-zero": "Decimal",
        "upper-roman": "UpperRoman",
        "lower-roman": "LowerRoman",
        "upper-alpha": "UpperAlpha",
        "upper-latin": "UpperAlpha",
        "lower-alpha": "LowerAlpha",
        "lower-latin": "LowerAlpha",
      };
      winAnsiExtraCodePoints = {
        8364: 128,
        8218: 130,
        402: 131,
        8222: 132,
        8230: 133,
        8224: 134,
        8225: 135,
        710: 136,
        8240: 137,
        352: 138,
        8249: 139,
        338: 140,
        381: 142,
        8216: 145,
        8217: 146,
        8220: 147,
        8221: 148,
        8226: 149,
        8211: 150,
        8212: 151,
        732: 152,
        8482: 153,
        353: 154,
        8250: 155,
        339: 156,
        382: 158,
        376: 159,
      };
      helveticaAsciiGlyphWidths = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333,
        278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278,
        584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278,
        500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
        667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556,
        278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
        278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
      ];
      wideUnicodeGlyphRanges = [
        [11904, 40959],
        [44032, 55203],
        [55296, 57343],
        [63744, 64255],
        [65281, 65376],
      ];
      rtlTextPattern = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
      rtlCandidatePattern =
        /(?=\p{L})[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u;
      unicodeLetterPatternForRtl = /\p{L}/u;
      rtlTextClusterPattern =
        /[+\-\u2212#$%\u00a2-\u00a5\u00b0\u00b1\u066a\u2030\u2031\u20a0-\u20cf]{0,4}[0-9\u0660-\u0669\u066b\u066c\u06f0-\u06f9]+(?:[+\-\u2012\u2013\u2212,.:/\u00a0\u060c\u202f][0-9\u0660-\u0669\u066b\u066c\u06f0-\u06f9]+)*[#$%\u00a2-\u00a5\u00b0\u00b1\u066a\u2030\u2031\u20a0-\u20cf]{0,4}|[^]/gu;
      pdfEncodedSpaceOperands = {
        winansi: {
          operand: "( )",
          em: winAnsiGlyphWidth(32) / 1000,
        },
        unicode: {
          operand: "<0020>",
          em: unicodePdfGlyphWidth(32) / 1000,
        },
      };
      pdfStructureRoles = Object.freeze([
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "L",
        "Table",
        "Figure",
        "Artifact",
      ]);
      pdfTextStructureRoles = Object.freeze([
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "L",
        "Artifact",
      ]);
      pdfListNumberingKinds = Object.freeze([
        "None",
        "Disc",
        "Circle",
        "Square",
        "Decimal",
        "UpperRoman",
        "LowerRoman",
        "UpperAlpha",
        "LowerAlpha",
      ]);
      pdfStructureRoleSet = new Set(pdfStructureRoles);
      pdfListNumberingKindSet = new Set(pdfListNumberingKinds);
      noWordSpaceScriptPattern =
        /[\u0e00-\u0e7f\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/u;
      latinLanguageWordLists = [
        [
          "en",
          "the and of to in is for that with on are as be this by from at or an was it you your we our not have has will can",
        ],
        [
          "es",
          "de la el en y los las del que por con para una un es se no su al como más lo sus este esta son",
        ],
        [
          "fr",
          "de la le les et des en du une un est pour que dans qui par sur au pas plus avec ce cette nous vous sont ne",
        ],
        [
          "de",
          "der die und das in den von zu mit ist für auf dem des eine ein im nicht sich auch als an es wir sie werden bei oder",
        ],
        [
          "pt",
          "de da do em para com que os as uma um dos das não por mais se na no ao como é são seu sua",
        ],
        [
          "it",
          "di il la che in per del con le della un una dei è al non da sono alla più come gli delle nel questo",
        ],
        [
          "nl",
          "de het van een en in is op te voor met dat die zijn niet aan er om ook als bij door wordt deze dit wij",
        ],
      ];
      distinctiveLanguageScriptPatterns = [
        ["he", /(?=\p{L})[\u0590-\u05ff]/gu],
        ["th", /(?=\p{L})[\u0e00-\u0e7f]/gu],
        ["el", /(?=\p{L})[\u0370-\u03ff]/gu],
      ];
      japaneseScriptPattern = /(?=\p{L})[\u3040-\u30ff\uff66-\uff9f]/gu;
      hanScriptPattern = /[\u3400-\u4dbf\u4e00-\u9fff]/gu;
      koreanScriptPattern = /(?=\p{L})[\uac00-\ud7a3\u1100-\u11ff]/gu;
      latinScriptPattern = /\p{Script=Latin}/gu;
      languageTagPattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/;
      inferredScriptLanguages = [
        [
          /\p{Script=Latin}/gu,
          "Latn",
          "en es fr de pt it nl ca gl eu pl cs sk sl hu ro hr bs sq sv da nb nn no fi et lv lt is ga cy mt tr az uz tk id ms vi tl fil sw af zu xh yo ha so lb eo la",
        ],
        [/\p{Script=Cyrillic}/gu, "Cyrl", "ru uk be bg mk sr kk ky mn tg"],
        [/\p{Script=Arabic}/gu, "Arab", "ar fa ur ps ug sd ckb"],
        [/\p{Script=Devanagari}/gu, "Deva", "hi mr ne sa"],
        [/\p{Script=Bengali}/gu, "Beng", "bn as"],
        [/\p{Script=Gurmukhi}/gu, "Guru", "pa"],
        [/\p{Script=Gujarati}/gu, "Gujr", "gu"],
        [/\p{Script=Tamil}/gu, "Taml", "ta"],
        [/\p{Script=Telugu}/gu, "Telu", "te"],
        [/\p{Script=Kannada}/gu, "Knda", "kn"],
        [/\p{Script=Malayalam}/gu, "Mlym", "ml"],
        [/\p{Script=Sinhala}/gu, "Sinh", "si"],
        [/\p{Script=Thai}/gu, "Thai", "th"],
        [/\p{Script=Lao}/gu, "Laoo", "lo"],
        [/\p{Script=Khmer}/gu, "Khmr", "km"],
        [/\p{Script=Myanmar}/gu, "Mymr", "my"],
        [/\p{Script=Georgian}/gu, "Geor", "ka"],
        [/\p{Script=Armenian}/gu, "Armn", "hy"],
        [/\p{Script=Ethiopic}/gu, "Ethi", "am ti"],
        [/\p{Script=Hebrew}/gu, "Hebr", "he iw yi"],
        [/\p{Script=Greek}/gu, "Grek", "el"],
        [
          /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu,
          "Hani Hans Hant Jpan",
          "zh ja yue",
        ],
        [/\p{Script=Hangul}/gu, "Hang Kore", "ko"],
      ];
      maxPdfTextCoordinate = 4 * maxPdfPagePoints;
    });
  };
}
