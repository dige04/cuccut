/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomClientNamespace,
  type ReactNamespace,
} from "../bindings";
import type { Frame, Slide, SlideNode } from "../deck-contracts";
import type { EmbedCaptureRequest } from "./embed-capture";
import type { RasterizedEmbedFrames } from "./image-shrinking";
import type { RenderedLinkRect, RenderedSemantics } from "./rendered-semantics";
import type { Root } from "react-dom/client";
import type {
  PdfBlock,
  PdfBlockBox,
  PdfBlockRole,
  PdfLink,
  PdfLosslessImage,
  PdfTextRun,
} from "./pdf-writer";

/** Slide assets by name: stored name to the URL the surface renders. */
export type CaptureAssets = ReadonlyMap<string, string>;

/** Font problems found while capturing; each flag is set only when it applies. */
export interface CaptureFontFindings {
  /** Some fonts had not loaded when the slides were captured. */
  late?: boolean;
  /** Some fonts were unavailable or could not be fetched. */
  missing?: boolean;
  /** Some web fonts were too large to include. */
  overBudget?: boolean;
}

/** Options of `mountSlidesOffscreen`. */
export interface MountSlidesOptions {
  /** How long to wait for the document fonts; unbounded when undefined. */
  fontsReadyMs?: number | undefined;
  /** Whether to name fonts the stylesheets import but the document never registered. */
  nameMissingFonts?: boolean | undefined;
}

/** Options of a slide capture. */
export interface SlideCaptureOptions extends MountSlidesOptions {
  /** Inline the web fonts the slides use instead of falling back. */
  packWebFonts?: boolean | undefined;
}

/** Options of a whole-deck PDF capture. */
export interface PdfCaptureOptions extends SlideCaptureOptions {
  /** Wall-clock deadline (epoch ms) by which the capture must finish. */
  deadline?: number | undefined;
  signal?: AbortSignal | undefined;
  /** Also keep a lossless copy of every page when the budget allows. */
  losslessPages?: boolean | undefined;
  /** Size ceiling of the final file, in bytes. */
  maxBytes?: number | undefined;
}

/** Raster scale and JPEG quality of one capture attempt. */
export interface CaptureQuality {
  scale: number;
  quality: number;
}

/** Quality attempts from best to cheapest; never empty. */
export type CaptureQualityLadder = [CaptureQuality, ...CaptureQuality[]];

/** The slides mounted into a hidden host element, ready to be measured or serialized. */
export interface MountedSlides {
  host: HTMLElement;
  /** The rendered root element of slide `index`. */
  surface: (index: number) => HTMLElement;
  /** Problems met while mounting (undecodable images). */
  warnings: string[];
  /** Font families that were still loading when the wait ended. */
  lateFamilies: string[];
  /** Font families the stylesheets import but the document never registered. */
  missingFamilies: string[];
  /** Unmounts the slides and removes the host. */
  dispose: () => void;
}

/** How a canvas is encoded into image bytes. */
export interface CanvasEncodeOptions {
  mime: string;
  quality?: number | undefined;
}

/** How one slide is rasterized. */
export interface SlideRasterOptions extends CanvasEncodeOptions {
  scale: number;
  /** Returns the time budget (ms) for a lossless copy of the page; 0 skips it. */
  lossless?: (() => number) | undefined;
}

/** A rasterized slide. */
export interface SlideRaster {
  bytes: Uint8Array<ArrayBuffer>;
  lossless?: PdfLosslessImage | undefined;
  /** Time spent producing the lossless copy. */
  losslessMs?: number | undefined;
  /** Why the lossless copy is missing, when it was attempted. */
  losslessError?: "too slow" | "unreadable" | undefined;
}

/** Slides mounted for capture, with their fonts inlined and their embeds rasterized. */
export interface PreparedCapture extends MountedSlides {
  /** Rasterized web embeds per slide. */
  embedImages: RasterizedEmbedFrames;
  fontFindings: CaptureFontFindings;
  /** Re-collects the font CSS when fonts finished loading since the last call. */
  refreshFonts: () => Promise<void>;
  raster: (index: number, options: SlideRasterOptions) => Promise<SlideRaster>;
}

/**
 * One captured slide page of a PDF export. Kept as wide as the speaker-notes
 * pipeline that merges these pages with its own (lossless copy and blocks may be absent).
 */
export interface CapturedPdfPage {
  jpeg: Uint8Array;
  lossless?: PdfLosslessImage | null | undefined;
  textRuns: PdfTextRun[];
  links: PdfLink[];
  blocks?: PdfBlock[] | null | undefined;
}

/** Result of `exportSlidesPdf`. */
export interface PdfCaptureResult {
  pages: CapturedPdfPage[];
  warnings: string[];
  fontFindings: CaptureFontFindings;
  /** Milliseconds spent on lossless page copies. */
  copyMs: number;
}

/** Result of `exportSlidePng`. */
export interface PngCaptureResult {
  png: Uint8Array<ArrayBuffer>;
  warnings: string[];
  fontFindings: CaptureFontFindings;
}

/** Tracks how much time and size is left while capturing pages one by one. */
export interface AdaptiveCaptureBudget {
  /** Marks the start of a page. */
  slide: () => void;
  /** True when the pages so far are on course to exceed the size budget. */
  readonly overSize: boolean;
  /** Milliseconds the next page may spend on a lossless copy (0 means skip it). */
  limit: () => number;
  /** Records a finished page: its lossless copy time and its stored size. */
  done: (copyMs: number | undefined, storedBytes: number) => void;
  /** Total milliseconds spent on lossless copies so far. */
  readonly copyMs: number;
}

/** Fetches the text of a web font stylesheet. */
export type FontStylesheetFetcher = (href: string) => Promise<string>;
/** Fetches a font file as a data URL. */
export type FontDataUrlFetcher = (url: string) => Promise<string>;
/** Tells whether a font stylesheet variant is available. */
export type FontVariantCheck = (href: string) => boolean;

/** Options of the web font packing step. */
export interface PackedFontFetchOptions {
  /** Whether the slides use the (lower-cased) family. */
  familyNamed?: ((family: string) => boolean) | undefined;
  /** Concurrent fetch limit. */
  batch?: number | undefined;
  /** Wait for fonts that are still loading. */
  loadedFaces?: "settled" | undefined;
  fetchText?: FontStylesheetFetcher | undefined;
  fetchDataUrl?: FontDataUrlFetcher | undefined;
  faceInUse?: FontVariantCheck | undefined;
}

/** The Google Fonts stylesheets a CSS text imports. */
interface GoogleFontImports {
  /** Stylesheet URLs, without duplicates. */
  hrefs: string[];
  /** Stylesheet URLs of optional variants (italics, extra weights) that may be missing. */
  optional: ReadonlySet<string>;
}

/** A web embed to rasterize, with where it sits in the deck. */
interface EmbedFrameRequest extends EmbedCaptureRequest {
  slide: number;
  frameId: string;
}

/** Outcome of packing the web fonts the slides use. */
export interface GoogleFontInlineResult {
  /** Stylesheet text with the font files embedded; empty when nothing could be packed. */
  css: string;
  /** Some fonts could not be fetched. */
  unavailable: boolean;
  /** Some fonts were left out to stay within the size budget. */
  overBudget: boolean;
}

/** A text run in slide pixels, before conversion to PDF points. */
export interface CapturedTextRun {
  text: string;
  /** Left edge. */
  x: number;
  /** Baseline, measured from the top of the slide. */
  y: number;
  sizePx: number;
  /** Width. */
  w: number;
}

/** A character range of a text node that sits on one rendered line. */
export interface TextLineRange {
  start: number;
  end: number;
}

/** Text runs, structure blocks and truncation flag of one rendered slide. */
export interface RenderedTextCapture {
  runs: PdfTextRun[];
  blocks: PdfBlock[];
  /** True when the text limit cut the walk short. */
  truncated: boolean;
}

/** Links and truncation flag of one rendered slide. */
export interface RenderedLinkCapture {
  links: PdfLink[];
  truncated: boolean;
}

/** How many pages went without a lossless copy, by reason. */
interface LosslessSkipTally {
  /** Skipped or cut short to finish in time. */
  time: number;
  /** Skipped because the file was heading over the size limit. */
  size: number;
  /** Took more than ten seconds to compress. */
  slow: number;
  /** One-based numbers of the slides that could not be read back or compressed. */
  unreadable: number[];
}

/** Where in the page structure a text run sits. */
type TextRunStructure = Pick<PdfTextRun, "block" | "item" | "cell" | "link">;

/** The block and cell index of a table cell. */
interface TableCellRef {
  block: number;
  cell: number;
}

/** Vertical range (px) that clips the text of an element. */
interface TextClipRange {
  top: number;
  bottom: number;
}

/** What the text walk knows about the element that holds a text node. */
interface TextElementState {
  /** Whether its text is visible. */
  ok: boolean;
  sizePx: number;
  clip: TextClipRange | undefined;
}

/** The previous run of the text walk, used to decide word spacing. */
interface PreviousTextRun {
  block: number | undefined;
  /** List item or table cell the run belongs to. */
  part: number | undefined;
  node: Text;
  /** End offset of the run in its text node. */
  end: number;
  baseline: number;
  sizePx: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    PdfCaptureReact: ReactNamespace;
    PdfCaptureReactDomClient: ReactDomClientNamespace;
    pdfCaptureExports: PdfCaptureExports;
    pdfDefaultRasterScale: number;
    pdfDefaultJpegQuality: number;
    pdfCaptureQualityLadder: CaptureQualityLadder;
    pdfMinimumCaptureTimeMs: number;
    pdfMaximumPageCaptureTimeMs: number;
    pdfFinalizationTimeReserveMs: number;
    pdfCaptureBudgetMultiplier: number;
    pdfFontsReadyTimeoutMs: number;
    pdfFontInliningBudget: number;
    maxFontFetchCacheEntries: number;
    fontFetchFallbackWarning: string;
    fontInliningBudgetWarning: string;
    localFontSourcePattern: RegExp;
    fetchLocalFontDataUrl: FontDataUrlFetcher;
    uncapturedEmbedWarning: string;
    textRunBaselineDescentFactor: number;
    pdfMaximumTextRunFontSize: number;
    pdfMaximumTextCoordinate: number;
    maxCapturedSlideTextCharacters: number;
    maxCapturedTextRangeCharacters: number;
    ignoredTextCaptureElementNames: Set<string>;
    headingElementNames: PdfBlockRole[];
    pdfSlideWidthPoints: number;
    pdfSlideHeightPoints: number;
    pdfCaptureInternals: PdfCaptureInternals;
    initializePdfCapture: () => void;
    /** Names the fonts a deck imports from Google Fonts but the document never registered. */
    missingFontsWarning: (
      css: string,
      deadline: () => string,
      fontFaces: readonly FontFace[],
      requiredFamilies: readonly string[],
    ) => string[];
    missingGoogleFontFamilies: (css: string) => string[];
    /** Waits until web font faces from `css` show up in the document; true when more arrived. */
    waitForGoogleFontRegistration: (
      css: string,
      deadline: number,
    ) => Promise<boolean>;
    throwIfExportAborted: (signal?: AbortSignal) => void;
    remainingCaptureTimeBudget: (
      pageNumber: number,
      deadline: number,
      predictedCopyMs: number,
      predictedCaptureMs?: number,
      completedPages?: number,
    ) => number;
    createAdaptiveCaptureBudget: (
      pageCount: number,
      totalBudget: number,
      losslessBudget?: number,
      overhead?: number,
      now?: () => number,
    ) => AdaptiveCaptureBudget;
    canvasImageBytes: (
      canvas: HTMLCanvasElement,
      options: CanvasEncodeOptions,
    ) => Uint8Array<ArrayBuffer> | undefined;
    documentStylesheetCss: () => string;
    captureFontCss: (
      styles: string[],
      warnings: CaptureFontFindings,
      slideText: () => string,
      readThemeCss: () => string,
      includeLoading: SlideCaptureOptions,
      fontFaces?: boolean,
      failedUrls?: readonly string[],
      argument?: Set<string>,
    ) => Promise<string>;
    captureInlineFontCss: (
      css: string,
      warnings: string[],
      text: string,
      fetchOptions?: PackedFontFetchOptions,
      localOnly?: boolean,
      state?: CaptureFontFindings,
    ) => Promise<string>;
    inlineGoogleFontsFallback: (
      css: string,
      warnings: string[],
      fetchText?: FontStylesheetFetcher,
      fetchDataUrl?: FontDataUrlFetcher,
      available?: FontVariantCheck,
      options?: CaptureFontFindings,
      used?: (family: string) => boolean,
    ) => Promise<string>;
    inlineLocalFonts: (
      css: string,
      warnings: string[],
      fetchDataUrl?: FontDataUrlFetcher,
      options?: CaptureFontFindings,
      ignoredFamilies?: readonly string[],
    ) => Promise<string>;
    decodeExportImages: (root: ParentNode) => Promise<string[]>;
    slideForeignObjectSvg: (
      element: Element,
      css: string,
      width: string,
      replacements?: ReadonlyMap<string, string>,
    ) => string;
    rasterizeSlideSvg: (
      element: Element,
      css: string,
      width: string,
      replacements: ReadonlyMap<string, string> | undefined,
      options: SlideRasterOptions,
    ) => Promise<SlideRaster>;
    rasterizeEmbedFrames: (
      host: ParentNode,
      slides: readonly Slide[],
      warnings: string[],
    ) => Promise<RasterizedEmbedFrames>;
    labelUncapturedEmbeds: (
      host: ParentNode,
      slides: readonly Slide[],
      captures: RasterizedEmbedFrames,
    ) => void;
    replaceEmbedPlaceholders: (
      root: ParentNode,
      captures?: ReadonlyMap<string, string>,
    ) => void;
    capturedTextRunToPdf: (run: CapturedTextRun) => PdfTextRun;
    runWithinPdfWriterLimits: (run: PdfTextRun) => boolean;
    isUtf16LowSurrogate: (text: string, index: number) => boolean;
    renderedTextLineRanges: (textNode: Text, range: Range) => TextLineRange[];
    collectRenderedTextRuns: (
      root: HTMLElement,
      slide: DOMRect,
      warnings: ReadonlySet<string> | undefined,
      anchors: ((frameId: string, nodePath: string) => number) | undefined,
      language: ReadonlyMap<Element, number> | undefined,
    ) => RenderedTextCapture;
    renderedLinkToPdf: (link: RenderedLinkRect) => PdfLink;
    renderedElementLink: (element: Element) => string | null;
    collectRenderedLinksAndBlocks: (
      root: Element,
      anchors?: Map<Element, number>,
    ) => RenderedLinkCapture;
    mountSlidesOffscreen: (
      slides: readonly Slide[],
      assets: CaptureAssets,
      options?: MountSlidesOptions,
    ) => Promise<MountedSlides>;
    prepareSlidesForCapture: (
      slides: readonly Slide[],
      assets: CaptureAssets,
      options: SlideCaptureOptions,
    ) => Promise<PreparedCapture>;
    /** The slide may be undefined because callers pass the first entry of a list checked elsewhere. */
    exportSlidePng: (
      slide: Slide | undefined,
      assets: CaptureAssets,
      scale: number,
      options?: SlideCaptureOptions,
    ) => Promise<PngCaptureResult>;
    exportSlidesPdf: (
      slides: readonly Slide[],
      assets: CaptureAssets,
      quality?: CaptureQuality,
      options?: PdfCaptureOptions,
    ) => Promise<PdfCaptureResult>;
    pdfFilename: (title: string) => string;
  }
}

/** Internals the unit tests reach into. */
export interface PdfCaptureInternals {
  collectCssText: RuntimeBindings["captureFontCss"];
  inlineLinkedFonts: RuntimeBindings["inlineGoogleFontsFallback"];
  inlinePackedFonts: RuntimeBindings["captureInlineFontCss"];
  LOSSLESS_COPY_TIMEOUT_MS: number;
  losslessTimeLimit: RuntimeBindings["remainingCaptureTimeBudget"];
  losslessSchedule: RuntimeBindings["createAdaptiveCaptureBudget"];
  missingFontFamilies: RuntimeBindings["missingFontsWarning"];
  linkedSheetsArrived: RuntimeBindings["waitForGoogleFontRegistration"];
}

/** What the PDF capture module exposes to the editor (live getters, filled when it initializes). */
export interface PdfCaptureExports {
  runWithinWriterLimits: RuntimeBindings["runWithinPdfWriterLimits"];
  replaceEmbedPlaceholders: RuntimeBindings["replaceEmbedPlaceholders"];
  rasterizeEmbedFrames: RuntimeBindings["rasterizeEmbedFrames"];
  pdfFilename: RuntimeBindings["pdfFilename"];
  mountSlidesOffscreen: RuntimeBindings["mountSlidesOffscreen"];
  labelUncapturedEmbeds: RuntimeBindings["labelUncapturedEmbeds"];
  inlineLocalFonts: RuntimeBindings["inlineLocalFonts"];
  designRunToPageRun: RuntimeBindings["capturedTextRunToPdf"];
  designLinkToPageLink: RuntimeBindings["renderedLinkToPdf"];
  composeSlideSvg: RuntimeBindings["slideForeignObjectSvg"];
  collectSlideTextRuns: RuntimeBindings["collectRenderedTextRuns"];
  collectSlideLinks: RuntimeBindings["collectRenderedLinksAndBlocks"];
  collectDocumentCss: RuntimeBindings["documentStylesheetCss"];
  captureSlidesAsJpegs: RuntimeBindings["exportSlidesPdf"];
  captureSlideAsPng: RuntimeBindings["exportSlidePng"];
  _test: PdfCaptureInternals;
  PAGE_W_PT: number;
  PAGE_H_PT: number;
  CAPTURE_TIERS: CaptureQualityLadder;
  CAPTURE_SCALE: number;
  BASELINE_CENTER_OFFSET: number;
}

export function installExportPdfCapture(runtime: RuntimeBindings): () => void {
  var pdfCaptureExports: RuntimeBindings["pdfCaptureExports"];
  var PdfCaptureReact: ReactNamespace;
  var PdfCaptureReactDomClient: ReactDomClientNamespace;
  var pdfDefaultRasterScale: RuntimeBindings["pdfDefaultRasterScale"];
  var pdfDefaultJpegQuality: RuntimeBindings["pdfDefaultJpegQuality"];
  var pdfCaptureQualityLadder: RuntimeBindings["pdfCaptureQualityLadder"];
  var pdfMinimumCaptureTimeMs: RuntimeBindings["pdfMinimumCaptureTimeMs"];
  var pdfMaximumPageCaptureTimeMs: RuntimeBindings["pdfMaximumPageCaptureTimeMs"];
  var pdfFinalizationTimeReserveMs: RuntimeBindings["pdfFinalizationTimeReserveMs"];
  var pdfCaptureBudgetMultiplier: RuntimeBindings["pdfCaptureBudgetMultiplier"];
  var pdfFontsReadyTimeoutMs: RuntimeBindings["pdfFontsReadyTimeoutMs"];
  var pdfFontInliningBudget: RuntimeBindings["pdfFontInliningBudget"];
  var maxFontFetchCacheEntries: RuntimeBindings["maxFontFetchCacheEntries"];
  var fontFetchFallbackWarning: RuntimeBindings["fontFetchFallbackWarning"];
  var fontInliningBudgetWarning: RuntimeBindings["fontInliningBudgetWarning"];
  var localFontSourcePattern: RuntimeBindings["localFontSourcePattern"];
  var fetchLocalFontDataUrl: RuntimeBindings["fetchLocalFontDataUrl"];
  var uncapturedEmbedWarning: RuntimeBindings["uncapturedEmbedWarning"];
  var textRunBaselineDescentFactor: RuntimeBindings["textRunBaselineDescentFactor"];
  var pdfMaximumTextRunFontSize: RuntimeBindings["pdfMaximumTextRunFontSize"];
  var pdfMaximumTextCoordinate: RuntimeBindings["pdfMaximumTextCoordinate"];
  var maxCapturedSlideTextCharacters: RuntimeBindings["maxCapturedSlideTextCharacters"];
  var maxCapturedTextRangeCharacters: RuntimeBindings["maxCapturedTextRangeCharacters"];
  var ignoredTextCaptureElementNames: RuntimeBindings["ignoredTextCaptureElementNames"];
  var headingElementNames: RuntimeBindings["headingElementNames"];
  var pdfSlideWidthPoints: RuntimeBindings["pdfSlideWidthPoints"];
  var pdfSlideHeightPoints: RuntimeBindings["pdfSlideHeightPoints"];
  var pdfCaptureInternals: RuntimeBindings["pdfCaptureInternals"];
  var initializePdfCapture: RuntimeBindings["initializePdfCapture"];
  function missingFontsWarning(
    css: string,
    deadline: () => string,
    fontFaces: readonly FontFace[],
    requiredFamilies: readonly string[],
  ): string[] {
    let familyKey = (input: FontFace): string =>
        input.family.replace(/["']/g, "").toLowerCase(),
      usedFamilies = new Set(fontFaces.map(familyKey)),
      loadedFamilies = new Set(
        fontFaces
          .filter((state: FontFace): boolean => state.status === "loaded")
          .map(familyKey),
      ),
      requiredFamilyNames = new Set(
        requiredFamilies.map((input: string): string => input.toLowerCase()),
      ),
      loadingFamilies: string[] = (0, runtime.uniqueFontFamilyNames)(
        fontFaces.filter(
          (state: FontFace): boolean => state.status === "error",
        ),
      ).filter(
        (input: string): boolean => !loadedFamilies.has(input.toLowerCase()),
      ),
      value: string[] = (0, runtime.googleFontImports)(css)
        .hrefs.flatMap(runtime.googleFontUrlFamilies)
        .filter(
          (input: string): boolean => !usedFamilies.has(input.toLowerCase()),
        ),
      value2 = [...loadingFamilies, ...value].filter(
        (input: string): boolean =>
          !requiredFamilyNames.has(input.toLowerCase()),
      );
    if (value2.length === 0) {
      return [];
    }
    let value3: string = (0, runtime.fontUsageHints)(css, deadline()).replace(
        /&quot;|&#39;/g,
        "'",
      ),
      callback = (input: string): boolean =>
        new RegExp(
          `(?:^|[\\s'",:;(>])` +
            input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            `\\s*(?:$|['",;&)}<])`,
        ).test(value3),
      items: string[] = [];
    for (let value4 of value2) {
      let value5 = value4.toLowerCase();
      if (requiredFamilyNames.has(value5) || !callback(value5)) {
        continue;
      }
      requiredFamilyNames.add(value5);
      items.push(value4);
    }
    return items;
  }
  function missingGoogleFontFamilies(css: string): string[] {
    let documentFamilies = new Set<string>(
      [...(0, runtime.documentFontSet)()].map(
        (input: FontFace): string =>
          input.family.replace(/["']/g, "").toLowerCase(),
      ),
    );
    return (0, runtime.googleFontImports)(css)
      .hrefs.flatMap(runtime.googleFontUrlFamilies)
      .filter(
        (input: string): boolean =>
          !documentFamilies.has(input.toLowerCase()),
      );
  }
  async function waitForGoogleFontRegistration(
    css: string,
    deadline: number,
  ): Promise<boolean> {
    let initialMissing = missingGoogleFontFamilies(css).length,
      missing = initialMissing;
    while (missing > 0 && Date.now() < deadline) {
      await new Promise<void>((input) => setTimeout(input, 100));
      missing = missingGoogleFontFamilies(css).length;
    }
    return missing < initialMissing;
  }
  function throwIfExportAborted(signal?: AbortSignal): void {
    if (signal?.aborted === true) {
      throw signal.reason ?? new DOMException("export cancelled", "AbortError");
    }
  }
  function remainingCaptureTimeBudget(
    pageNumber: number,
    deadline: number,
    predictedCopyMs: number,
    predictedCaptureMs?: number,
    completedPages: number = 0,
  ): number {
    let remaining =
        deadline -
        (pageNumber - 1 + completedPages) *
          predictedCopyMs *
          pdfCaptureBudgetMultiplier,
      captureReserve =
        (pageNumber - 1) *
        (predictedCaptureMs ?? 0) *
        pdfCaptureBudgetMultiplier;
    if (
      !(remaining > 0) ||
      (predictedCaptureMs ?? 0) + captureReserve > remaining
    ) {
      return 0;
    }
    return Math.min(pdfMaximumPageCaptureTimeMs, remaining - captureReserve);
  }
  function createAdaptiveCaptureBudget(
    pageCount: number,
    totalBudget: number,
    losslessBudget: number = Number.POSITIVE_INFINITY,
    overhead: number = 0,
    now: () => number = (): number => performance.now(),
  ): AdaptiveCaptureBudget {
    let value = Number.isFinite(losslessBudget) ? pageCount : 0,
      value2 = Number.isFinite(losslessBudget)
        ? totalBudget - overhead * pdfCaptureBudgetMultiplier
        : totalBudget,
      index = 0,
      index2 = 0,
      index3 = 0,
      index4 = 0,
      index5 = 0,
      index6 = 0;
    return {
      slide(): void {
        index2 = now();
      },
      get overSize(): boolean {
        return index6 * pageCount > losslessBudget * index;
      },
      limit(): number {
        let value3 = now();
        return remainingCaptureTimeBudget(
          pageCount - index,
          value2 - value3,
          (index3 + value3 - index2) / (index + 1),
          index5 > 0 ? index4 / index5 : undefined,
          value,
        );
      },
      done(input: number | undefined, options: number): void {
        if (input !== undefined) {
          index4 += input;
          index5++;
        }
        index3 += now() - index2 - (input ?? 0);
        index6 += options;
        index++;
      },
      get copyMs(): number {
        return index4;
      },
    };
  }
  function canvasImageBytes(
    canvas: HTMLCanvasElement,
    options: CanvasEncodeOptions,
  ): Uint8Array<ArrayBuffer> | undefined {
    let dataUrl = canvas.toDataURL(options.mime, options.quality),
      prefix = "data:" + options.mime + ";base64,";
    if (!dataUrl.startsWith(prefix)) {
      return;
    }
    try {
      let value = atob(dataUrl.slice(prefix.length)),
        value2 = new Uint8Array(value.length);
      for (let index = 0; index < value.length; index++)
        value2[index] = value.charCodeAt(index);
      return value2;
    } catch {
      return;
    }
  }
  function documentStylesheetCss(): string {
    let css: string[] = [];
    for (let value of Array.from<CSSStyleSheet>(document.styleSheets)) {
      let value2: CSSRuleList;
      try {
        value2 = value.cssRules;
      } catch {
        continue;
      }
      for (let value3 of Array.from<CSSRule>(value2))
        css.push(value3.cssText);
    }
    return css.join(`
`);
  }
  async function captureFontCss(
    styles: string[],
    warnings: CaptureFontFindings,
    slideText: () => string,
    readThemeCss: () => string,
    includeLoading: SlideCaptureOptions,
    fontFaces: boolean = false,
    failedUrls: readonly string[] = [],
    argument: Set<string> = new Set(),
  ): Promise<string> {
    let css = documentStylesheetCss(),
      usageHints: string = (0, runtime.fontUsageHints)(css, readThemeCss()),
      isUsed = (input: string): boolean => usageHints.includes(input),
      fetchFont = async (input: string): Promise<string> => {
        if (argument.has(input)) {
          throw Error("failed earlier in this capture");
        }
        return fetchLocalFontDataUrl(input).catch((input2: unknown): never => {
          throw (argument.add(input), input2);
        });
      },
      value: string = await inlineLocalFonts(
        (0, runtime.removeUnusedFontFaces)(css, usageHints),
        styles,
        fetchFont,
        warnings,
        failedUrls,
      );
    if (includeLoading.packWebFonts !== true) {
      return inlineGoogleFontsFallback(
        value,
        styles,
        undefined,
        undefined,
        undefined,
        warnings,
        isUsed,
      );
    }
    return captureInlineFontCss(
      value,
      styles,
      slideText(),
      {
        familyNamed: isUsed,
        batch: maxFontFetchCacheEntries,
        ...(fontFaces && {
          loadedFaces: "settled",
        }),
      },
      fontFaces || failedUrls.length > 0,
      warnings,
    );
  }
  async function captureInlineFontCss(
    css: string,
    warnings: string[],
    text: string,
    fetchOptions: PackedFontFetchOptions = {},
    localOnly: boolean = false,
    state: CaptureFontFindings = {},
  ): Promise<string> {
    let result: GoogleFontInlineResult = await (0, runtime.inlineGoogleFontFaces)(css, {
      budget: pdfFontInliningBudget,
      ...fetchOptions,
      text: text,
    });
    if (
      result.css === "" &&
      !result.unavailable &&
      !result.overBudget &&
      text.trim() !== "" &&
      !localOnly
    ) {
      return inlineGoogleFontsFallback(
        css,
        warnings,
        fetchOptions.fetchText,
        fetchOptions.fetchDataUrl,
        fetchOptions.faceInUse,
        state,
        fetchOptions.familyNamed,
      );
    }
    if (result.unavailable) {
      warnings.push(fontFetchFallbackWarning);
      state.missing = true;
    }
    if (result.overBudget) {
      warnings.push(fontInliningBudgetWarning);
      state.overBudget = true;
    }
    let flag = false;
    return css.replace(
      runtime.googleFontsImportRegex,
      (): string => (flag ? "" : ((flag = true), result.css)),
    );
  }
  async function inlineGoogleFontsFallback(
    css: string,
    warnings: string[],
    fetchText: FontStylesheetFetcher = runtime.fetchFontStylesheet,
    fetchDataUrl: FontDataUrlFetcher = runtime.fetchFontDataUrl,
    available: FontVariantCheck = runtime.googleFontVariantAvailable,
    options: CaptureFontFindings = {},
    used: (family: string) => boolean = (): boolean => true,
  ): Promise<string> {
    let { hrefs: hrefs, optional: optional }: GoogleFontImports = (0,
    runtime.googleFontImports)(css);
    if (hrefs.length === 0) {
      return css;
    }
    let inlinedSheets = new Map<string, string>(
        hrefs.map((input: string): [string, string] => [input, ""]),
      ),
      unavailable = new Set<string>(),
      overBudget = false;
    await Promise.all(
      [...inlinedSheets.keys()].map(
        async (input: string): Promise<void> => {
          if (
            (optional.has(input) && !available(input)) ||
            !(0, runtime.googleFontUrlFamilies)(input).some(
              (input2: string): boolean => used(input2.toLowerCase()),
            )
          ) {
            unavailable.add(input);
            return;
          }
          try {
            let value = await fetchText(input),
              entries = new Map<string, string>();
            for (let value2 of value.matchAll(runtime.googleFontFileUrlRegex))
              entries.set(value2[2]!, "");
            await Promise.all(
              [...entries.keys()].map(
                async (input2: string): Promise<void> => {
                  try {
                    entries.set(input2, await fetchDataUrl(input2));
                  } catch {
                    overBudget = true;
                  }
                },
              ),
            );
            inlinedSheets.set(
              input,
              value.replace(
                runtime.googleFontFileUrlRegex,
                (input2: string, options2: string, context: string): string =>
                  entries.get(context)
                    ? 'url("' + entries.get(context) + '")'
                    : input2,
              ),
            );
          } catch {
            overBudget = true;
          }
        },
      ),
    );
    if (overBudget) {
      warnings.push(
        "a linked web font could not be fetched; its text exports in the fallback font",
      );
      options.missing = true;
    }
    return css.replace(
      runtime.googleFontsImportRegex,
      (input: string, options2: string, context: string): string =>
        inlinedSheets.get(context) ||
        (optional.has(context) || unavailable.has(context) ? "" : input),
    );
  }
  async function inlineLocalFonts(
    css: string,
    warnings: string[],
    fetchDataUrl: FontDataUrlFetcher = fetchLocalFontDataUrl,
    options: CaptureFontFindings = {},
    ignoredFamilies: readonly string[] = [],
  ): Promise<string> {
    let urls = new Set<string>();
    for (let value of css.matchAll(localFontSourcePattern))
      urls.add(value[3]!);
    if (urls.size === 0) {
      return css;
    }
    let ignored = new Set(
        ignoredFamilies.map((input: string): string => input.toLowerCase()),
      ),
      faces: string[] = css.match(/@font-face\s*\{[^}]*\}/g) ?? [],
      callback = (input: string): string | undefined =>
        /font-family\s*:\s*["']?([^"';}]+)/
          .exec(
            faces.find((input2: string): boolean => input2.includes(input)) ??
              "",
          )?.[1]
          ?.trim()
          .toLowerCase(),
      entries = new Map<string, string>(),
      flag = false;
    await Promise.all(
      [...urls]
        .filter(
          (input: string): boolean => !ignored.has(callback(input) ?? ""),
        )
        .map(async (input: string): Promise<void> => {
          try {
            entries.set(input, await fetchDataUrl(input));
          } catch {
            flag = true;
          }
        }),
    );
    if (flag) {
      warnings.push(
        "a typeface file could not be fetched; its text exports in the fallback font",
      );
      options.missing = true;
    }
    return css.replace(
      localFontSourcePattern,
      (
        input: string,
        options2: string,
        context: string,
        value: string,
      ): string => {
        let entry = entries.get(value);
        if (entry === undefined) {
          return input;
        } else {
          return 'url("' + entry + '")';
        }
      },
    );
  }
  async function decodeExportImages(root: ParentNode): Promise<string[]> {
    let warnings: string[] = [],
      images = Array.from<HTMLImageElement>(root.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (input: HTMLImageElement): Promise<void> =>
          input.decode().catch((): void => {
            warnings.push(
              "an image failed to decode and may render blank in the export",
            );
          }),
      ),
    );
    return warnings;
  }
  function slideForeignObjectSvg(
    element: Element,
    css: string,
    width: string,
    replacements?: ReadonlyMap<string, string>,
  ): string {
    let clone = element.cloneNode(true) as Element;
    for (let value2 of Array.from<HTMLScriptElement>(
      clone.querySelectorAll("script"),
    ))
      value2.remove();
    replaceEmbedPlaceholders(clone, replacements);
    for (let value2 of Array.from<HTMLImageElement>(
      clone.querySelectorAll("img"),
    ))
      value2.setAttribute("decoding", "sync");
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    let callback = (input: string): string =>
        input.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""),
      value =
        '<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;font:' +
        width
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/"/g, "&quot;") +
        '">' +
        callback(new XMLSerializer().serializeToString(clone)) +
        "</div>";
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      String(runtime.SLIDE_WIDTH) +
      '" height="' +
      String(runtime.SLIDE_HEIGHT) +
      '"><foreignObject width="' +
      String(runtime.SLIDE_WIDTH) +
      '" height="' +
      String(runtime.SLIDE_HEIGHT) +
      '"><style><![CDATA[' +
      css.replaceAll("]]>", "]]]]><![CDATA[>") +
      "]]></style>" +
      value +
      "</foreignObject></svg>"
    );
  }
  function rasterizeSlideSvg(
    element: Element,
    css: string,
    width: string,
    replacements: ReadonlyMap<string, string> | undefined,
    options: SlideRasterOptions,
  ): Promise<SlideRaster> {
    let svg = slideForeignObjectSvg(element, css, width, replacements),
      dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return new Promise<SlideRaster>((input, options2) => {
      let value = new Image(),
        value2 = setTimeout((): void => {
          options2(Error("timed out rendering the slide"));
        }, pdfFontsReadyTimeoutMs);
      value.onerror = (): void => {
        clearTimeout(value2);
        let text = "";
        try {
          let element2 = new DOMParser()
            .parseFromString(svg, "image/svg+xml")
            .querySelector("parsererror");
          if (element2?.textContent != null) {
            text =
              ": " + element2.textContent.replace(/\s+/g, " ").slice(0, 200);
          }
        } catch {}
        options2(Error("the slide could not be rendered" + text));
      };
      value.onload = (): void => {
        clearTimeout(value2);
        try {
          let value3 = document.createElement("canvas");
          value3.width = Math.round(runtime.SLIDE_WIDTH * options.scale);
          value3.height = Math.round(runtime.SLIDE_HEIGHT * options.scale);
          let value4 = value3.getContext("2d");
          if (value4 === null) {
            throw Error("no 2d canvas in this host");
          }
          value4.fillStyle = "#fff";
          value4.fillRect(0, 0, value3.width, value3.height);
          value4.drawImage(value, 0, 0, value3.width, value3.height);
          try {
            value4.getImageData(0, 0, 1, 1);
          } catch {
            throw Error(
              "the slide uses content that can't be exported (embedded web content)",
            );
          }
          let value5 = canvasImageBytes(value3, options);
          if (value5 === undefined) {
            throw Error(
              "this browser could not encode the slide as " +
                (options.mime === "image/png" ? "PNG" : "JPEG"),
            );
          }
          let value6 = options.lossless?.() ?? 0;
          if (!(value6 > 0)) {
            input({
              bytes: value5,
            });
            return;
          }
          let value7 = performance.now();
          (0, runtime.deflatePagePixels)(
            value4,
            value3.width,
            value3.height,
            value5.length,
            value6,
          ).then(
            (input2): void =>
              input({
                bytes: value5,
                lossless: input2,
                losslessMs: performance.now() - value7,
              }),
            (input2: unknown): void =>
              input({
                bytes: value5,
                losslessMs: performance.now() - value7,
                losslessError:
                  input2 instanceof Error &&
                  input2.message === runtime.compressionTimeoutMessage
                    ? "too slow"
                    : "unreadable",
              }),
          );
        } catch (value3: unknown) {
          options2(value3 instanceof Error ? value3 : Error(String(value3)));
        }
      };
      value.src = dataUri;
    });
  }
  async function rasterizeEmbedFrames(
    host: ParentNode,
    slides: readonly Slide[],
    warnings: string[],
  ): Promise<RasterizedEmbedFrames> {
    let captures = new Map<number, Map<string, string>>(),
      requests: EmbedFrameRequest[] = [];
    slides.forEach((input: Slide, options: number): void => {
      let value2 = host.querySelector(
        '[data-pdf-slide="' + String(options) + '"]',
      )?.firstElementChild;
      if (!value2) {
        return;
      }
      for (let value3 of input.frames) {
        if (value3.node.kind !== "html") {
          continue;
        }
        let value4 = value2
          .querySelector(
            '[data-frame-id="' + value3.id + '"] [data-node-path=""]',
          )
          ?.getBoundingClientRect();
        if (
          value4 === undefined ||
          value3.node.html === "" ||
          value4.width <= 0 ||
          value4.height <= 0
        ) {
          warnings.push(uncapturedEmbedWarning);
          continue;
        }
        requests.push({
          key: String(options) + "/" + value3.id,
          html: value3.node.html,
          w: value4.width,
          h: value4.height,
          slide: options,
          frameId: value3.id,
        });
      }
    });
    if (requests.length === 0) {
      return captures;
    }
    let value = await (0, runtime.captureHtmlEmbeds)(requests);
    for (let value2 of requests) {
      let entry = value.get(value2.key);
      if (entry === undefined) {
        warnings.push(uncapturedEmbedWarning);
        continue;
      }
      let entry2 = captures.get(value2.slide);
      if (entry2 === undefined) {
        entry2 = new Map<string, string>();
        captures.set(value2.slide, entry2);
      }
      entry2.set(value2.frameId, entry.dataUri);
    }
    return captures;
  }
  function labelUncapturedEmbeds(
    host: ParentNode,
    slides: readonly Slide[],
    captures: RasterizedEmbedFrames,
  ): void {
    slides.forEach((input: Slide, options: number): void => {
      for (let value of input.frames) {
        if (
          value.node.kind !== "html" ||
          captures.get(options)?.has(value.id)
        ) {
          continue;
        }
        let element = host.querySelector(
          '[data-pdf-slide="' +
            String(options) +
            '"] [data-frame-id="' +
            value.id +
            '"] [data-node-path=""]',
        );
        if (element !== null) {
          element.textContent =
            "Interactive web embed: not captured for export";
        }
      }
    });
  }
  function replaceEmbedPlaceholders(
    root: ParentNode,
    captures?: ReadonlyMap<string, string>,
  ): void {
    if (captures === undefined) {
      return;
    }
    for (let [value, value2] of captures) {
      let element = root.querySelector(
        '[data-frame-id="' + value + '"] [data-node-path=""]',
      );
      if (element === null) {
        continue;
      }
      let value3 = element.ownerDocument.createElement("img");
      value3.setAttribute("src", value2);
      value3.setAttribute("alt", "web embed");
      value3.setAttribute("style", "display:block;width:100%;height:100%");
      element.replaceWith(value3);
    }
  }
  function capturedTextRunToPdf(run: CapturedTextRun): PdfTextRun {
    return {
      text: run.text,
      xPt: run.x / 2,
      yPt: pdfSlideHeightPoints - run.y / 2,
      sizePt: run.sizePx / 2,
      widthPt: run.w / 2,
    };
  }
  function runWithinPdfWriterLimits(run: PdfTextRun): boolean {
    return (
      run.sizePt <= pdfMaximumTextRunFontSize &&
      run.widthPt <= pdfMaximumTextCoordinate &&
      Math.abs(run.xPt) <= pdfMaximumTextCoordinate &&
      Math.abs(run.yPt) <= pdfMaximumTextCoordinate
    );
  }
  function isUtf16LowSurrogate(text: string, index: number): boolean {
    let value = text.charCodeAt(index);
    return value >= 56320 && value <= 57343;
  }
  function renderedTextLineRanges(
    textNode: Text,
    range: Range,
  ): TextLineRange[] {
    let length = textNode.data.length,
      items: TextLineRange[] = [],
      index = 0;
    for (let count = 1; count <= length; count++) {
      range.setStart(textNode, index);
      range.setEnd(textNode, count);
      let index2 = 0;
      for (let value of Array.from<DOMRect>(range.getClientRects()))
        if (value.width > 0.01 && value.height > 0.01) {
          index2++;
        }
      if (index2 > 1 && count - 1 > index) {
        items.push({
          start: index,
          end: count - 1,
        });
        index = count - 1;
      } else if (
        count - index >= maxCapturedTextRangeCharacters &&
        !isUtf16LowSurrogate(textNode.data, count)
      ) {
        items.push({
          start: index,
          end: count,
        });
        index = count;
      }
    }
    if (length > index) {
      items.push({
        start: index,
        end: length,
      });
    }
    return items;
  }
  function collectRenderedTextRuns(
    root: HTMLElement,
    slide: DOMRect,
    warnings: ReadonlySet<string> | undefined,
    anchors: ((frameId: string, nodePath: string) => number) | undefined,
    language: ReadonlyMap<Element, number> | undefined,
  ): RenderedTextCapture {
    let ownerDocument = root.ownerDocument,
      items: PdfTextRun[] = [],
      items2: PdfBlock[] = [],
      entries = new Map<Element, number>(),
      callback = (element: Element): number | undefined => {
        if (items2.length >= runtime.maxPdfStructureBlocks) {
          return;
        }
        let value4 =
            element.getAttribute("role") === "heading"
              ? Number(element.getAttribute("aria-level"))
              : NaN,
          length = items2.length,
          element2 = element.querySelector("li");
        if (element.hasAttribute("data-icon-path")) {
          items2.push({
            role: "Artifact",
          });
        } else if (element2 !== null) {
          let value5 = (0, runtime.pdfListNumbering)(
            getComputedStyle(element2).listStyleType,
          );
          items2.push(
            value5 === undefined
              ? {
                  role: "L",
                }
              : {
                  role: "L",
                  numbering: value5,
                },
          );
        } else {
          items2.push({
            role: headingElementNames[value4 - 1] ?? "P",
          });
        }
        entries.set(element, length);
        return length;
      },
      entries2 = new Map<Element, TableCellRef>(),
      values = new Set<Element>(),
      index = 0,
      callback2 = (input: Element): void => {
        let parentElement = input.parentElement;
        if (parentElement === null || values.has(parentElement)) {
          return;
        }
        values.add(parentElement);
        if (items2.length >= runtime.maxPdfStructureBlocks) {
          return;
        }
        let value4 = Array.from<Element>(parentElement.children).filter(
            (input2: Element): boolean => input2.hasAttribute("data-cell"),
          ),
          callback7 = (element: Element): number[] =>
            (element.getAttribute("data-cell") ?? "").split(".").map(Number),
          value5 =
            Math.max(
              ...value4.map(
                (input2: Element): number => callback7(input2)[0] ?? NaN,
              ),
            ) + 1,
          value6 =
            Math.max(
              ...value4.map(
                (input2: Element): number => callback7(input2)[1] ?? NaN,
              ),
            ) + 1;
        if (
          !Number.isInteger(value5) ||
          !Number.isInteger(value6) ||
          value5 < 1 ||
          value6 < 1 ||
          index + value5 * value6 > runtime.maxPdfStructureBlocks
        ) {
          return;
        }
        index += value5 * value6;
        let value7 =
            parentElement
              .closest("[data-frame-id]")
              ?.getAttribute("data-frame-id") ?? "",
          value8 = Math.max(
            0,
            Math.min(
              value5,
              Math.floor(
                anchors?.(
                  value7,
                  parentElement.getAttribute("data-node-path") ?? "",
                ) ?? 0,
              ),
            ),
          ),
          length = items2.length;
        items2.push(
          value8 > 0
            ? {
                role: "Table",
                rows: value5,
                cols: value6,
                headerRows: value8,
              }
            : {
                role: "Table",
                rows: value5,
                cols: value6,
              },
        );
        for (let value9 of value4) {
          let [value10, value11] = callback7(value9);
          if (
            value10 !== undefined &&
            value11 !== undefined &&
            Number.isInteger(value10) &&
            Number.isInteger(value11) &&
            value10 >= 0 &&
            value11 >= 0
          ) {
            entries2.set(value9, {
              block: length,
              cell: value10 * value6 + value11,
            });
          }
        }
      },
      callback3 = (input: Element): TextRunStructure => {
        let ancestor = input.closest(
          "[data-text-path], [data-cell], [data-icon-path], [data-img-path]",
        );
        if (ancestor === null || !root.contains(ancestor)) {
          return {};
        }
        if (ancestor.hasAttribute("data-cell")) {
          if (!entries2.has(ancestor)) {
            callback2(ancestor);
          }
          return entries2.get(ancestor) ?? {};
        }
        let value4 = entries.get(ancestor) ?? callback(ancestor);
        if (value4 === undefined) {
          return {};
        }
        if (items2[value4]!.role !== "L") {
          return {
            block: value4,
          };
        }
        let ancestor2 = input.closest("li");
        return {
          block: value4,
          item:
            ancestor2 !== null && ancestor.contains(ancestor2)
              ? Math.min(
                  runtime.maxPdfStructureBlocks - 1,
                  Math.max(
                    0,
                    Array.prototype.indexOf.call(
                      ancestor.querySelectorAll("li"),
                      ancestor2,
                    ),
                  ),
                )
              : 0,
        };
      },
      flag = false,
      value = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT),
      value2 = ownerDocument.createRange(),
      entries3 = new Map<Element, boolean>(),
      callback4 = (input: Element): boolean => {
        let entry = entries3.get(input);
        if (entry !== undefined) {
          return entry;
        }
        let value4 =
            input instanceof HTMLElement || input instanceof SVGElement
              ? input.style.visibility
              : "",
          value5: boolean;
        if (value4 === "hidden" || value4 === "collapse") {
          value5 = true;
        } else if (value4 === "visible") {
          value5 = false;
        } else {
          value5 =
            input !== root && input.parentElement !== null
              ? callback4(input.parentElement)
              : false;
        }
        entries3.set(input, value5);
        return value5;
      },
      entries4 = new Map<Element, boolean>(),
      callback5 = (input: Element): boolean => {
        let entry = entries4.get(input);
        if (entry !== undefined) {
          return entry;
        }
        let value4 =
          parseFloat(getComputedStyle(input).opacity) <= 0 ||
          (input !== root && input.parentElement !== null
            ? callback5(input.parentElement)
            : false);
        entries4.set(input, value4);
        return value4;
      },
      entries5 = new Map<Element, TextElementState>(),
      entries6 = new Map<Element, boolean>(),
      entries7 = new Map<Element, TextClipRange | undefined>(),
      callback6 = (input: Element): TextClipRange | undefined => {
        if (input === root) {
          return;
        }
        if (entries7.has(input)) {
          return entries7.get(input);
        }
        let value4 =
            input.parentElement !== null
              ? callback6(input.parentElement)
              : undefined,
          value5 = getComputedStyle(input);
        if (value5.overflowY === "clip" || value5.overflowY === "hidden") {
          let bounds = input.getBoundingClientRect(),
            value6 = bounds.top + (parseFloat(value5.borderTopWidth) || 0),
            value7 =
              bounds.bottom - (parseFloat(value5.borderBottomWidth) || 0);
          value4 =
            value4 === undefined
              ? {
                  top: value6,
                  bottom: value7,
                }
              : {
                  top: Math.max(value4.top, value6),
                  bottom: Math.min(value4.bottom, value7),
                };
        }
        entries7.set(input, value4);
        return value4;
      };
    for (let value4 of Array.from<HTMLElement>(
      root.querySelectorAll<HTMLElement>(
        "[data-text-path], [data-cell], [data-img-path], [data-icon-path]",
      ),
    )) {
      if (value4.hasAttribute("data-cell")) {
        if (!entries2.has(value4)) {
          callback2(value4);
        }
        continue;
      }
      if (!value4.hasAttribute("data-img-path")) {
        if (!entries.has(value4)) {
          callback(value4);
        }
        continue;
      }
      let ancestor = value4.closest('[aria-hidden="true"]');
      if (ancestor !== null && root.contains(ancestor)) {
        continue;
      }
      if ((value4.textContent ?? "").trim() !== "") {
        callback(value4);
        continue;
      }
      if (
        callback4(value4) ||
        callback5(value4) ||
        getComputedStyle(value4).display === "none"
      ) {
        continue;
      }
      let value5 =
          value4.tagName === "IMG" ? value4 : value4.querySelector("img"),
        value6 = (
          value5 !== null
            ? (value5.getAttribute("alt") ?? "")
            : (value4.getAttribute("aria-label") ?? "")
        )
          .replace(/\s+/g, " ")
          .trim();
      if (value6 === "") {
        continue;
      }
      let bounds = value4.getBoundingClientRect(),
        value7 = callback6(value4),
        state = {
          left: bounds.left,
          width: bounds.width,
          top: Math.max(bounds.top, value7?.top ?? -1 / 0),
          bottom: Math.min(bounds.bottom, value7?.bottom ?? 1 / 0),
        };
      if (state.width <= 0.01 || state.bottom - state.top <= 0.01) {
        continue;
      }
      let state2: PdfBlockBox = {
        xPt: (state.left - slide.left) / 2,
        yPt: pdfSlideHeightPoints - (state.bottom - slide.top) / 2,
        widthPt: state.width / 2,
        heightPt: (state.bottom - state.top) / 2,
      };
      if (
        items2.length >= runtime.maxPdfStructureBlocks ||
        ![state2.xPt, state2.yPt, state2.widthPt, state2.heightPt].every(
          (input: number): boolean =>
            Number.isFinite(input) &&
            Math.abs(input) <= pdfMaximumTextCoordinate,
        )
      ) {
        continue;
      }
      entries.set(value4, items2.length);
      items2.push({
        role: "Figure",
        alt: value6,
        box: state2,
      });
    }
    let index2 = 0,
      value3: PreviousTextRun | undefined,
      flag2 = false;
    for (
      let value4 = value.nextNode();
      value4 !== null;
      value4 = value.nextNode()
    ) {
      let value5 = value4 as Text;
      if (value5.data.trim() === "") {
        if (value5.data !== "") {
          flag2 = true;
        }
        continue;
      }
      let parentElement = value5.parentElement;
      if (
        parentElement === null ||
        ignoredTextCaptureElementNames.has(parentElement.tagName)
      ) {
        continue;
      }
      if (warnings !== undefined && warnings.size > 0) {
        let entry2 = entries6.get(parentElement);
        if (entry2 === undefined) {
          let ancestor = parentElement.closest("[data-frame-id]");
          entry2 =
            ancestor !== null &&
            warnings.has(ancestor.getAttribute("data-frame-id") ?? "");
          entries6.set(parentElement, entry2);
        }
        if (entry2) {
          continue;
        }
      }
      let entry = entries5.get(parentElement);
      if (entry === undefined) {
        let value8 = getComputedStyle(parentElement);
        entry = {
          ok:
            !callback4(parentElement) &&
            value8.display !== "none" &&
            !callback5(parentElement),
          sizePx: parseFloat(value8.fontSize),
          clip: callback6(parentElement),
        };
        entries5.set(parentElement, entry);
      }
      if (!entry.ok || !Number.isFinite(entry.sizePx) || entry.sizePx <= 0) {
        flag2 = true;
        continue;
      }
      index2 += value5.data.length;
      if (index2 > maxCapturedSlideTextCharacters) {
        flag = true;
        break;
      }
      let value6 =
          language === undefined ? null : parentElement.closest("a"),
        value7 =
          value6 !== null && root.contains(value6)
            ? language!.get(value6)
            : undefined;
      for (let value8 of renderedTextLineRanges(value5, value2)) {
        let value9 = value5.data.slice(value8.start, value8.end);
        if (value9.trim() === "") {
          flag2 = true;
          continue;
        }
        value2.setStart(value5, value8.start);
        value2.setEnd(value5, value8.end);
        let bounds = value2.getBoundingClientRect();
        if (bounds.width <= 0.01 || bounds.height <= 0.01) {
          flag2 = true;
          continue;
        }
        if (
          entry.clip !== undefined &&
          (bounds.top + bounds.height / 2 > entry.clip.bottom ||
            bounds.bottom - bounds.height / 2 < entry.clip.top)
        ) {
          flag2 = true;
          continue;
        }
        let value10 = bounds.left - slide.left,
          value11 = bounds.top - slide.top;
        if (
          value10 >= runtime.SLIDE_WIDTH ||
          value10 + bounds.width <= 0 ||
          value11 >= runtime.SLIDE_HEIGHT ||
          value11 + bounds.height <= 0
        ) {
          flag2 = true;
          continue;
        }
        let value12 = Math.min(
            runtime.SLIDE_HEIGHT,
            Math.max(
              0,
              value11 +
                bounds.height / 2 +
                entry.sizePx * textRunBaselineDescentFactor,
            ),
          ),
          value13 = capturedTextRunToPdf({
            text: value9,
            x: value10,
            y: value12,
            sizePx: entry.sizePx,
            w: bounds.width,
          });
        if (!runWithinPdfWriterLimits(value13)) {
          flag2 = true;
          continue;
        }
        let value14: TextRunStructure =
            value7 === undefined
              ? callback3(parentElement)
              : {
                  ...callback3(parentElement),
                  link: value7,
                },
          value15 =
            value3 === undefined
              ? ""
              : value3.node === value5
                ? value5.data.slice(value3.end, value8.start)
                : value3.node.data.slice(value3.end) +
                  value5.data.slice(0, value8.start),
          value16 =
            value3 !== undefined &&
            Math.abs(value12 - value3.baseline) <
              0.5 * Math.max(entry.sizePx, value3.sizePx),
          value17 = value14.item ?? value14.cell,
          value18: boolean | undefined =
            value3 === undefined ||
            value3.block !== value14.block ||
            value3.part !== value17 ||
            value14.block === undefined
              ? undefined
              : flag2 || /\s/u.test(value15)
                ? true
                : value3.node === value5 || value16
                  ? false
                  : undefined;
        items.push(
          value18 === undefined
            ? {
                ...value13,
                ...value14,
              }
            : {
                ...value13,
                ...value14,
                spaceBefore: value18,
              },
        );
        value3 = {
          block: value14.block,
          part: value17,
          node: value5,
          end: value8.end,
          baseline: value12,
          sizePx: entry.sizePx,
        };
        flag2 = false;
      }
    }
    return {
      runs: items,
      blocks: items2,
      truncated: flag,
    };
  }
  function renderedLinkToPdf(link: RenderedLinkRect): PdfLink {
    let state: PdfLink = {
      uri: link.u,
      xPt: link.x / 2,
      yPt: pdfSlideHeightPoints - (link.y + link.h) / 2,
      widthPt: link.w / 2,
      heightPt: link.h / 2,
    };
    if (link.a === undefined) {
      return state;
    } else {
      return {
        ...state,
        anchor: link.a,
      };
    }
  }
  function renderedElementLink(element: Element): string | null {
    let value: string =
      element.getAttribute("href") ||
      /(?:^|\s)(https?:\/\/\S+)$/i.exec(
        element.getAttribute("title") ?? "",
      )?.[1] ||
      "";
    if ((0, runtime.isSafeHyperlink)(value)) {
      return value;
    } else {
      return null;
    }
  }
  function collectRenderedLinksAndBlocks(
    root: Element,
    anchors?: Map<Element, number>,
  ): RenderedLinkCapture {
    let value: RenderedSemantics = (0, runtime.inspectRenderedSemantics)(
      getComputedStyle,
      root,
      runtime.SLIDE_WIDTH,
      runtime.SLIDE_HEIGHT,
      {
        hrefOf: renderedElementLink,
        inlineVisibility: true,
        ...(anchors !== undefined
          ? {
              anchorId: (input: Element): number | undefined =>
                anchors.get(input) ??
                anchors.set(input, anchors.size).get(input),
            }
          : {}),
      },
    );
    return {
      links: value.links.map(renderedLinkToPdf),
      truncated: value.truncated,
    };
  }
  async function mountSlidesOffscreen(
    slides: readonly Slide[],
    assets: CaptureAssets,
    options: MountSlidesOptions = {},
  ): Promise<MountedSlides> {
    let host: HTMLElement = document.createElement("div");
    host.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;z-index:-1000;overflow:hidden;width:0;height:0;";
    host.setAttribute("data-appifact-content", "");
    document.body.appendChild(host);
    let value: Root = PdfCaptureReactDomClient.createRoot(host),
      callback: () => void = (): void => {
        value.unmount();
        host.remove();
      };
    try {
      (0, runtime.renderReactSynchronously)(
        value,
        PdfCaptureReact.createElement(
          "div",
          null,
          slides.map(
            (input: Slide, options2: number) =>
              PdfCaptureReact.createElement(
                "div",
                {
                  key: input.id,
                  "data-pdf-slide": String(options2),
                },
                PdfCaptureReact.createElement(runtime.SlideSurface, {
                  slide: input,
                  assets: assets,
                  animate: false,
                }),
              ),
          ),
        ),
      );
      host.offsetHeight;
      let value2: number | undefined =
          options.fontsReadyMs === undefined
            ? undefined
            : Date.now() + options.fontsReadyMs,
        value3: FontFace[] = await (0, runtime.waitForDocumentFonts)(
          document.fonts,
          options.fontsReadyMs,
        ),
        value4: string =
          options.nameMissingFonts === true ? documentStylesheetCss() : "";
      if (
        value2 !== undefined &&
        options.nameMissingFonts === true &&
        (await waitForGoogleFontRegistration(
          value4,
          Math.min(value2, Date.now() + pdfMinimumCaptureTimeMs),
        ))
      ) {
        host.offsetHeight;
        value3 = await (0, runtime.waitForDocumentFonts)(
          document.fonts,
          Math.max(0, value2 - Date.now()),
        );
      }
      let value5: Promise<FontFace[] | void> = document.fonts
        .load("90px mc-anthropicons")
        .catch((): void => {});
      await (value2 === undefined
        ? value5
        : (0, runtime.promiseWithTimeout)(
            value5,
            Math.max(0, value2 - Date.now()),
          ));
      let value6: string[] = await decodeExportImages(host),
        value7: string[] = (0, runtime.uniqueFontFamilyNames)(value3),
        value8: string[] =
          options.nameMissingFonts === true
            ? missingFontsWarning(
                value4,
                (): string => host.innerHTML,
                [...(0, runtime.documentFontSet)()],
                value7,
              )
            : [];
      if (document.visibilityState === "visible") {
        await new Promise<void>((input): void => {
          let value9 = setTimeout(input, 1000);
          requestAnimationFrame(
            (): number =>
              requestAnimationFrame((): void => {
                clearTimeout(value9);
                input();
              }),
          );
        });
      }
      return {
        host: host,
        surface(input: number): HTMLElement {
          let value9 = host.querySelector(
            '[data-pdf-slide="' + String(input) + '"]',
          )?.firstElementChild;
          if (!value9) {
            throw Error("slide " + String(input + 1) + " did not render");
          }
          return value9 as HTMLElement;
        },
        warnings: value6,
        lateFamilies: value7,
        missingFamilies: value8,
        dispose: callback,
      };
    } catch (value2: unknown) {
      throw (callback(), value2);
    }
  }
  async function prepareSlidesForCapture(
    slides: readonly Slide[],
    assets: CaptureAssets,
    options: SlideCaptureOptions,
  ): Promise<PreparedCapture> {
    let mounted: MountedSlides = await mountSlidesOffscreen(slides, assets, {
      fontsReadyMs: options.fontsReadyMs,
      nameMissingFonts: options.nameMissingFonts,
    });
    try {
      let value: RasterizedEmbedFrames = await rasterizeEmbedFrames(
        mounted.host,
        slides,
        mounted.warnings,
      );
      labelUncapturedEmbeds(mounted.host, slides, value);
      let callback: () => string = (): string =>
          slides.map(
            (input: Slide, options2: number): string =>
              mounted.surface(options2).textContent ?? "",
          ).join(`
`),
        value2: string =
          getComputedStyle(document.body).font ||
          "16px system-ui, sans-serif",
        callback2: () => string = (): string =>
          slides.map(
            (input: Slide, options2: number): string =>
              mounted.surface(options2).outerHTML,
          ).join(`
`) + value2,
        value3: boolean = mounted.lateFamilies.length > 0;
      if (value3) {
        mounted.warnings.push(
          (0, runtime.fontTimeoutWarning)(mounted.lateFamilies, "drawn"),
        );
      }
      if (mounted.missingFamilies.length > 0) {
        mounted.warnings.push(
          (0, runtime.fontUnavailableWarning)(mounted.missingFamilies, "drawn"),
        );
      }
      let value4: CaptureFontFindings = value3
        ? {
            late: true,
          }
        : {};
      if (mounted.missingFamilies.length > 0) {
        value4.missing = true;
      }
      let value5: FontFace[] = value3
          ? [...(0, runtime.documentFontSet)()].filter(
              (state: FontFace): boolean => state.status === "loading",
            )
          : [],
        values: Set<string> = new Set(),
        value6: string = await captureFontCss(
          mounted.warnings,
          value4,
          callback,
          callback2,
          options,
          value3,
          mounted.missingFamilies,
          values,
        );
      return {
        ...mounted,
        embedImages: value,
        fontFindings: value4,
        refreshFonts: async (): Promise<void> => {
          while (
            value5.some((state: FontFace): boolean => state.status === "loaded")
          ) {
            value5 = value5.filter(
              (state: FontFace): boolean => state.status === "loading",
            );
            value6 = await captureFontCss(
              mounted.warnings,
              value4,
              callback,
              callback2,
              options,
              true,
              mounted.missingFamilies,
              values,
            );
          }
          value5 = value5.filter(
            (state: FontFace): boolean => state.status === "loading",
          );
        },
        raster: (input: number, options2: SlideRasterOptions): Promise<SlideRaster> =>
          rasterizeSlideSvg(
            mounted.surface(input),
            value6,
            value2,
            value.get(input),
            options2,
          ),
      };
    } catch (value: unknown) {
      throw (mounted.dispose(), value);
    }
  }
  async function exportSlidePng(
    slide: Slide | undefined,
    assets: CaptureAssets,
    scale: number,
    options: SlideCaptureOptions = {},
  ): Promise<PngCaptureResult> {
    let capture: PreparedCapture = await prepareSlidesForCapture(
      [slide!],
      assets,
      options,
    );
    try {
      await capture.refreshFonts();
      return {
        png: (
          await capture.raster(0, {
            mime: "image/png",
            scale: scale,
          })
        ).bytes,
        warnings: Array.from<string>(new Set(capture.warnings)),
        fontFindings: capture.fontFindings,
      };
    } finally {
      capture.dispose();
    }
  }
  async function exportSlidesPdf(
    slides: readonly Slide[],
    assets: CaptureAssets,
    quality: CaptureQuality = pdfCaptureQualityLadder[0],
    options: PdfCaptureOptions = {},
  ): Promise<PdfCaptureResult> {
    let startedAt: number = performance.now(),
      deadline: number =
        options.deadline === undefined
          ? Number.POSITIVE_INFINITY
          : startedAt +
            (options.deadline - Date.now()) -
            pdfFinalizationTimeReserveMs;
    throwIfExportAborted(options.signal);
    let capture: PreparedCapture = await prepareSlidesForCapture(
        slides,
        assets,
        options,
      ),
      { warnings: warnings, embedImages: value }: PreparedCapture = capture,
      value2: boolean =
        options.losslessPages === true &&
        typeof CompressionStream === "function";
    if (options.losslessPages === true && !value2) {
      console.warn(
        "[pdf-export] this browser cannot compress page pixels; every slide is stored as its JPEG",
      );
    }
    let value3: AdaptiveCaptureBudget | undefined = value2
        ? createAdaptiveCaptureBudget(
            slides.length,
            deadline,
            options.maxBytes,
            performance.now() - startedAt,
          )
        : undefined,
      state: LosslessSkipTally = {
        time: 0,
        size: 0,
        slow: 0,
        unreadable: [],
      };
    try {
      let items: CapturedPdfPage[] = [];
      for (let index: number = 0; index < slides.length; index++) {
        throwIfExportAborted(options.signal);
        await capture.refreshFonts();
        value3?.slide();
        let value4: HTMLElement = capture.surface(index),
          entries: Map<Element, number> = new Map(),
          items3: PdfLink[] = [];
        try {
          let value5: RenderedLinkCapture = collectRenderedLinksAndBlocks(
            value4,
            entries,
          );
          items3 = value5.links;
          if (value5.truncated) {
            console.warn(
              "[pdf-export] slide " +
                String(index + 1) +
                " has more links than the PDF keeps; the rest are not clickable",
            );
          }
        } catch (value5: unknown) {
          entries.clear();
          console.warn(
            "[pdf-export] slide " +
              String(index + 1) +
              ": links could not be measured",
            value5,
          );
        }
        let items4: PdfTextRun[] = [],
          items5: PdfBlock[] = [];
        try {
          let value5: Slide = slides[index]!,
            value6: RenderedTextCapture = collectRenderedTextRuns(
              value4,
              value4.getBoundingClientRect(),
              new Set(value.get(index)?.keys() ?? []),
              (input: string, options2: string): number => {
                let value7: Frame | undefined = value5.frames.find(
                    (input2: Frame): boolean => input2.id === input,
                  ),
                  value8: number[] = options2
                    .split(".")
                    .filter((input2: string): boolean => input2 !== "")
                    .map(Number),
                  value9: SlideNode | undefined =
                    value7 === undefined ||
                    value8.some(
                      (input2: number): boolean =>
                        !Number.isInteger(input2) || input2 < 0,
                    )
                      ? undefined
                      : (0, runtime.nodeAtPath)(value7.node, value8);
                if (
                  value9 !== undefined &&
                  value9.kind === "table" &&
                  value9.header
                ) {
                  return 1;
                } else {
                  return 0;
                }
              },
              entries,
            );
          items4 = value6.runs;
          items5 = value6.blocks;
          if (value6.truncated) {
            warnings.push(
              "slide " +
                String(index + 1) +
                ": text past 50,000 characters is in the image only and can't be selected, copied or searched.",
            );
          }
        } catch {
          warnings.push(
            "slide " +
              String(index + 1) +
              ": its text could not be read, so that slide is an image only; nothing on it can be selected, copied or searched.",
          );
        }
        try {
          let index2: number = 0,
            value5: (() => number) | undefined =
              value3 &&
              ((): number => {
                if (value3.overSize) {
                  state.size++;
                  return 0;
                }
                index2 = value3.limit();
                if (index2 === 0) {
                  state.time++;
                }
                return index2;
              }),
            value6: SlideRaster = await capture.raster(index, {
              mime: "image/jpeg",
              ...quality,
              lossless: value5,
            });
          value3?.done(
            value6.losslessMs,
            value6.lossless?.zlib.length ?? value6.bytes.length,
          );
          if (value6.losslessError === "too slow") {
            state[index2 < pdfMaximumPageCaptureTimeMs ? "time" : "slow"]++;
          } else if (value6.losslessError === "unreadable") {
            state.unreadable.push(index + 1);
          }
          items.push({
            jpeg: value6.bytes,
            lossless: value6.lossless,
            textRuns: items4,
            blocks: items5,
            links: items3,
          });
        } catch (value5: unknown) {
          throw Error(
            "slide " +
              String(index + 1) +
              ": " +
              (value5 instanceof Error ? value5.message : String(value5)),
          );
        }
      }
      let items2: string[] = [];
      if (state.time > 0) {
        items2.push(
          String(state.time) + " skipped or cut short to finish in time",
        );
      }
      if (state.size > 0) {
        items2.push(
          String(state.size) +
            " skipped because the file was heading over the " +
            String(Math.round((options.maxBytes ?? 0) / 1048576)) +
            " MiB export limit",
        );
      }
      if (state.slow > 0) {
        items2.push(
          String(state.slow) + " took more than ten seconds to compress",
        );
      }
      if (state.unreadable.length > 0) {
        items2.push(
          (state.unreadable.length === 1 ? "slide " : "slides ") +
            state.unreadable.join(", ") +
            " could not be read back or compressed",
        );
      }
      if (items2.length > 0) {
        let value4: number =
          state.time + state.size + state.slow + state.unreadable.length;
        console.warn(
          "[pdf-export] no lossless copy was made for " +
            String(value4) +
            " of " +
            String(slides.length) +
            " slides (each keeps its JPEG): " +
            items2.join("; "),
        );
      }
      return {
        pages: items,
        warnings: Array.from<string>(new Set(warnings)),
        fontFindings: capture.fontFindings,
        copyMs: value3?.copyMs ?? 0,
      };
    } finally {
      capture.dispose();
    }
  }
  function pdfFilename(title: string): string {
    return (0, runtime.exportFilename)(title, "pdf");
  }
  bindRuntimeValue(
    runtime,
    "pdfCaptureExports",
    () => pdfCaptureExports,
    (value) => {
      pdfCaptureExports = value;
    },
  );
  bindRuntimeValue(runtime, "missingFontsWarning", () => missingFontsWarning);
  bindRuntimeValue(
    runtime,
    "missingGoogleFontFamilies",
    () => missingGoogleFontFamilies,
  );
  bindRuntimeValue(
    runtime,
    "waitForGoogleFontRegistration",
    () => waitForGoogleFontRegistration,
  );
  bindRuntimeValue(runtime, "throwIfExportAborted", () => throwIfExportAborted);
  bindRuntimeValue(
    runtime,
    "remainingCaptureTimeBudget",
    () => remainingCaptureTimeBudget,
  );
  bindRuntimeValue(
    runtime,
    "createAdaptiveCaptureBudget",
    () => createAdaptiveCaptureBudget,
  );
  bindRuntimeValue(runtime, "canvasImageBytes", () => canvasImageBytes);
  bindRuntimeValue(
    runtime,
    "documentStylesheetCss",
    () => documentStylesheetCss,
  );
  bindRuntimeValue(runtime, "captureFontCss", () => captureFontCss);
  bindRuntimeValue(runtime, "captureInlineFontCss", () => captureInlineFontCss);
  bindRuntimeValue(
    runtime,
    "inlineGoogleFontsFallback",
    () => inlineGoogleFontsFallback,
  );
  bindRuntimeValue(runtime, "inlineLocalFonts", () => inlineLocalFonts);
  bindRuntimeValue(runtime, "decodeExportImages", () => decodeExportImages);
  bindRuntimeValue(
    runtime,
    "slideForeignObjectSvg",
    () => slideForeignObjectSvg,
  );
  bindRuntimeValue(runtime, "rasterizeSlideSvg", () => rasterizeSlideSvg);
  bindRuntimeValue(runtime, "rasterizeEmbedFrames", () => rasterizeEmbedFrames);
  bindRuntimeValue(
    runtime,
    "labelUncapturedEmbeds",
    () => labelUncapturedEmbeds,
  );
  bindRuntimeValue(
    runtime,
    "replaceEmbedPlaceholders",
    () => replaceEmbedPlaceholders,
  );
  bindRuntimeValue(runtime, "capturedTextRunToPdf", () => capturedTextRunToPdf);
  bindRuntimeValue(
    runtime,
    "runWithinPdfWriterLimits",
    () => runWithinPdfWriterLimits,
  );
  bindRuntimeValue(runtime, "isUtf16LowSurrogate", () => isUtf16LowSurrogate);
  bindRuntimeValue(
    runtime,
    "renderedTextLineRanges",
    () => renderedTextLineRanges,
  );
  bindRuntimeValue(
    runtime,
    "collectRenderedTextRuns",
    () => collectRenderedTextRuns,
  );
  bindRuntimeValue(runtime, "renderedLinkToPdf", () => renderedLinkToPdf);
  bindRuntimeValue(runtime, "renderedElementLink", () => renderedElementLink);
  bindRuntimeValue(
    runtime,
    "collectRenderedLinksAndBlocks",
    () => collectRenderedLinksAndBlocks,
  );
  bindRuntimeValue(runtime, "mountSlidesOffscreen", () => mountSlidesOffscreen);
  bindRuntimeValue(
    runtime,
    "prepareSlidesForCapture",
    () => prepareSlidesForCapture,
  );
  bindRuntimeValue(runtime, "exportSlidePng", () => exportSlidePng);
  bindRuntimeValue(runtime, "exportSlidesPdf", () => exportSlidesPdf);
  bindRuntimeValue(runtime, "pdfFilename", () => pdfFilename);
  bindRuntimeValue(
    runtime,
    "PdfCaptureReact",
    () => PdfCaptureReact,
    (value) => {
      PdfCaptureReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureReactDomClient",
    () => PdfCaptureReactDomClient,
    (value) => {
      PdfCaptureReactDomClient = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfDefaultRasterScale",
    () => pdfDefaultRasterScale,
    (value) => {
      pdfDefaultRasterScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfDefaultJpegQuality",
    () => pdfDefaultJpegQuality,
    (value) => {
      pdfDefaultJpegQuality = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfCaptureQualityLadder",
    () => pdfCaptureQualityLadder,
    (value) => {
      pdfCaptureQualityLadder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfMinimumCaptureTimeMs",
    () => pdfMinimumCaptureTimeMs,
    (value) => {
      pdfMinimumCaptureTimeMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfMaximumPageCaptureTimeMs",
    () => pdfMaximumPageCaptureTimeMs,
    (value) => {
      pdfMaximumPageCaptureTimeMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfFinalizationTimeReserveMs",
    () => pdfFinalizationTimeReserveMs,
    (value) => {
      pdfFinalizationTimeReserveMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfCaptureBudgetMultiplier",
    () => pdfCaptureBudgetMultiplier,
    (value) => {
      pdfCaptureBudgetMultiplier = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfFontsReadyTimeoutMs",
    () => pdfFontsReadyTimeoutMs,
    (value) => {
      pdfFontsReadyTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfFontInliningBudget",
    () => pdfFontInliningBudget,
    (value) => {
      pdfFontInliningBudget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxFontFetchCacheEntries",
    () => maxFontFetchCacheEntries,
    (value) => {
      maxFontFetchCacheEntries = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFetchFallbackWarning",
    () => fontFetchFallbackWarning,
    (value) => {
      fontFetchFallbackWarning = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontInliningBudgetWarning",
    () => fontInliningBudgetWarning,
    (value) => {
      fontInliningBudgetWarning = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "localFontSourcePattern",
    () => localFontSourcePattern,
    (value) => {
      localFontSourcePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchLocalFontDataUrl",
    () => fetchLocalFontDataUrl,
    (value) => {
      fetchLocalFontDataUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "uncapturedEmbedWarning",
    () => uncapturedEmbedWarning,
    (value) => {
      uncapturedEmbedWarning = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textRunBaselineDescentFactor",
    () => textRunBaselineDescentFactor,
    (value) => {
      textRunBaselineDescentFactor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfMaximumTextRunFontSize",
    () => pdfMaximumTextRunFontSize,
    (value) => {
      pdfMaximumTextRunFontSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfMaximumTextCoordinate",
    () => pdfMaximumTextCoordinate,
    (value) => {
      pdfMaximumTextCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCapturedSlideTextCharacters",
    () => maxCapturedSlideTextCharacters,
    (value) => {
      maxCapturedSlideTextCharacters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCapturedTextRangeCharacters",
    () => maxCapturedTextRangeCharacters,
    (value) => {
      maxCapturedTextRangeCharacters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ignoredTextCaptureElementNames",
    () => ignoredTextCaptureElementNames,
    (value) => {
      ignoredTextCaptureElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "headingElementNames",
    () => headingElementNames,
    (value) => {
      headingElementNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfSlideWidthPoints",
    () => pdfSlideWidthPoints,
    (value) => {
      pdfSlideWidthPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfSlideHeightPoints",
    () => pdfSlideHeightPoints,
    (value) => {
      pdfSlideHeightPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pdfCaptureInternals",
    () => pdfCaptureInternals,
    (value) => {
      pdfCaptureInternals = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePdfCapture",
    () => initializePdfCapture,
    (value) => {
      initializePdfCapture = value;
    },
  );
  return () => {
    pdfCaptureExports = {} as PdfCaptureExports;
    (0, runtime.defineLiveExports)(pdfCaptureExports, {
      runWithinWriterLimits: () => runWithinPdfWriterLimits,
      replaceEmbedPlaceholders: () => replaceEmbedPlaceholders,
      rasterizeEmbedFrames: () => rasterizeEmbedFrames,
      pdfFilename: () => pdfFilename,
      mountSlidesOffscreen: () => mountSlidesOffscreen,
      labelUncapturedEmbeds: () => labelUncapturedEmbeds,
      inlineLocalFonts: () => inlineLocalFonts,
      designRunToPageRun: () => capturedTextRunToPdf,
      designLinkToPageLink: () => renderedLinkToPdf,
      composeSlideSvg: () => slideForeignObjectSvg,
      collectSlideTextRuns: () => collectRenderedTextRuns,
      collectSlideLinks: () => collectRenderedLinksAndBlocks,
      collectDocumentCss: () => documentStylesheetCss,
      captureSlidesAsJpegs: () => exportSlidesPdf,
      captureSlideAsPng: () => exportSlidePng,
      _test: () => pdfCaptureInternals,
      PAGE_W_PT: () => pdfSlideWidthPoints,
      PAGE_H_PT: () => pdfSlideHeightPoints,
      CAPTURE_TIERS: () => pdfCaptureQualityLadder,
      CAPTURE_SCALE: () => pdfDefaultRasterScale,
      BASELINE_CENTER_OFFSET: () => textRunBaselineDescentFactor,
    });
    pdfDefaultJpegQuality = 0.9;
    pdfMinimumCaptureTimeMs = 2000;
    pdfMaximumPageCaptureTimeMs = 1e4;
    pdfFinalizationTimeReserveMs = 5000;
    pdfCaptureBudgetMultiplier = 1.25;
    pdfFontsReadyTimeoutMs = 20000;
    pdfFontInliningBudget = 16777216;
    maxFontFetchCacheEntries = 32;
    fontFetchFallbackWarning =
      "a web font could not be fetched; some text is in the fallback font";
    fontInliningBudgetWarning =
      "the web fonts the slides use are too large to include in full; some text is in the fallback font";
    fetchLocalFontDataUrl = (input: string): Promise<string> =>
      runtime.modelStoredBlobPattern.test(input)
        ? (0, runtime.fetchWithSingleRetry)(
            (input2: number): Promise<string> =>
              (0, runtime.fetchStoredBlob)(input, input2, {
                ignoreRecentFailure: true,
              }),
            runtime.resourceFetchTimeoutMs,
            true,
          )
        : (0, runtime.fetchResourceDataUrl)(
            input,
            runtime.resourceFetchTimeoutMs,
            {
              credentials: "same-origin",
              retry: true,
            },
          );
    uncapturedEmbedWarning =
      "a web embed could not be rendered and exported as a placeholder";
    textRunBaselineDescentFactor = 0.2555;
    pdfMaximumTextRunFontSize = 14400;
    maxCapturedSlideTextCharacters = 50000;
    maxCapturedTextRangeCharacters = 2000;
    initializePdfCapture = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeAssetStorage)();
      (0, runtime.initializePdfWriter)();
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeModelEditing)();
      (0, runtime.initializeSlideRenderer)();
      (0, runtime.initializeEmbedCapture)();
      (0, runtime.initializeSynchronousReactRender)();
      (0, runtime.initializeFontFetching)();
      (0, runtime.initializeFontInlining)();
      (0, runtime.initializeCaptureFallback)();
      PdfCaptureReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      PdfCaptureReactDomClient = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactDomClientNamespace)(),
        1,
      );
      pdfDefaultRasterScale = runtime.embedCaptureScale;
      pdfCaptureQualityLadder = [
        {
          scale: pdfDefaultRasterScale,
          quality: pdfDefaultJpegQuality,
        },
        {
          scale: 1.5,
          quality: 0.85,
        },
        {
          scale: 1,
          quality: 0.8,
        },
      ];
      localFontSourcePattern = new RegExp(
        `url\\((["']?)([^"')\\s]*?(_blob/[0-9a-f]{32}|` +
          runtime.designSystemFontPathSource +
          "))\\1\\)",
        "g",
      );
      pdfMaximumTextCoordinate = 4 * pdfMaximumTextRunFontSize;
      ignoredTextCaptureElementNames = new Set([
        "SCRIPT",
        "STYLE",
        "NOSCRIPT",
        "TEMPLATE",
      ]);
      headingElementNames = ["H1", "H2", "H3", "H4", "H5", "H6"];
      pdfSlideWidthPoints = runtime.SLIDE_WIDTH / 2;
      pdfSlideHeightPoints = runtime.SLIDE_HEIGHT / 2;
      pdfCaptureInternals = {
        collectCssText: captureFontCss,
        inlineLinkedFonts: inlineGoogleFontsFallback,
        inlinePackedFonts: captureInlineFontCss,
        LOSSLESS_COPY_TIMEOUT_MS: pdfMaximumPageCaptureTimeMs,
        losslessTimeLimit: remainingCaptureTimeBudget,
        losslessSchedule: createAdaptiveCaptureBudget,
        missingFontFamilies: missingFontsWarning,
        linkedSheetsArrived: waitForGoogleFontRegistration,
      };
    });
  };
}
