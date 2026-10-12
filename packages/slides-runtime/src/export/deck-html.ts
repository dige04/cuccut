/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  BuildEffectName,
  Frame,
  HtmlNode,
  Slide,
} from "../deck-contracts";
import type {
  ExportImage,
  ImageEncoder,
  ShrinkExportImagesResult,
} from "./image-shrinking";
import type {
  DeckPageBuildEvent,
  DeckPageConfig,
  DeckPageEffect,
  DeckPageEmbed,
  DeckPageSlide,
  DeckPageStep,
} from "./page-runtime";
import type { CaptureAssets, CaptureFontFindings } from "./pdf-capture";

/** Options of `renderDeckHtml`. */
export interface RenderDeckHtmlOptions {
  /** Add the markup the Hz importer looks for (page roles, canvas size). */
  importerReady?: boolean | undefined;
  /** Pack the web fonts the slides use into the file. */
  inlineWebFonts?: boolean | undefined;
  /** Size ceiling of the hosted file, in bytes. */
  maxBytes?: number | undefined;
  /** Re-encode pictures to fit `maxBytes`. */
  shrinkImages?: boolean | undefined;
  /** Wall-clock deadline (epoch ms) by which the export must finish. */
  deadline?: number | undefined;
  encodeImage?: ImageEncoder | undefined;
  opaqueImage?: ((image: ExportImage) => boolean) | undefined;
  /** How long to wait for the document fonts; unbounded when undefined. */
  fontsReadyMs?: number | undefined;
  /** Whether to name fonts the stylesheets import but the document never registered. */
  nameMissingFonts?: boolean | undefined;
}

/** The exported HTML file with what the editor should tell the user about it. */
export interface RenderDeckHtmlResult {
  html: string;
  warnings: string[];
  fontFindings: CaptureFontFindings;
  /** Set when pictures were re-encoded to fit the size limit. */
  reducedNote: string | undefined;
}

/** Options of `fitHtmlPictures`. */
export interface FitHtmlPicturesOptions {
  /** Size ceiling of the hosted file, in bytes. */
  maxBytes: number;
  /** Whether web fonts will be packed afterwards (leave room for them). */
  packing: boolean;
  deadline?: number | undefined;
  encode?: ImageEncoder | undefined;
  opaque?: ((image: ExportImage) => boolean) | undefined;
}

/** The pages (and the document built from them) after pictures were re-encoded to fit. */
export interface FitHtmlPicturesResult {
  pages: string[];
  html: string;
  /** Set when pictures were reduced. */
  note?: string | undefined;
}

/** A stylesheet split into its Google Fonts imports and the remaining CSS. */
export interface SplitFontImports {
  /** Stylesheet URLs of the imports. */
  links: string[];
  css: string;
}

/** Page label and speaker notes of one exported slide. */
export interface ExportedPageInfo {
  label?: string;
  notes?: string;
}

/** Everything `buildDeckPage` assembles the document from. */
export interface BuildDeckPageOptions {
  title: string;
  /** Google Fonts stylesheet URLs. */
  fontLinks: string[];
  css: string;
  /** Inline style of the `<main>` element. */
  rootStyle: string;
  /** Serialized slide markup, one per slide. */
  slides: string[];
  motion: DeckPageConfig;
  importerReady?: boolean | undefined;
  pageInfo?: readonly ExportedPageInfo[] | undefined;
}

/** Internals the unit tests reach into. */
export interface DeckHtmlTestHooks {
  packedFontBudget: RuntimeBindings["packedFontBudget"];
  hostedBytes: RuntimeBindings["hostedHtmlBytes"];
  imagesReducedNote: RuntimeBindings["imagesReducedNote"];
  fitPictures: RuntimeBindings["fitHtmlPictures"];
  pageInfo: RuntimeBindings["exportedPageInfo"];
  FONT_ROOM: number;
  REBUILD_MS: number;
  FONT_PACK_MS: number;
}

/** What the HTML export module exposes to the editor (live getters, filled when it initializes). */
export interface DeckHtmlExports {
  splitFontImports: RuntimeBindings["splitFontImports"];
  serializeSlide: RuntimeBindings["serializeSlide"];
  resolveInlineVars: RuntimeBindings["resolveInlineVars"];
  renderDeckHtml: RuntimeBindings["renderDeckHtml"];
  pageCss: RuntimeBindings["pageCss"];
  motionSchedule: RuntimeBindings["motionSchedule"];
  motionConfig: RuntimeBindings["motionConfig"];
  htmlFilename: RuntimeBindings["htmlFilename"];
  buildDeckPage: RuntimeBindings["buildDeckPage"];
  _test: DeckHtmlTestHooks;
  /** Content-Security-Policy of the exported page. */
  PAGE_CSP: string;
  /** Whether web embeds run live in the exported page. */
  LIVE_EMBEDS: boolean;
}

/** One build animation of a step, as the step planner reports it. */
interface MotionBuildEffect {
  frame: Frame;
  dir: "in" | "out";
  effect: BuildEffectName;
}

/** A frame that holds a web embed. */
type HtmlFrame = Frame & { node: HtmlNode };

/** An element whose inline `style` can be read and rewritten. */
type StyledElement = Element & ElementCSSInlineStyle;

/** Outcome of packing the web fonts the slides use. */
interface InlinedGoogleFonts {
  css: string;
  unavailable: boolean;
  overBudget: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    deckHtmlExports: DeckHtmlExports;
    WEB_FONT_OFFLINE_NOTE: string;
    WEB_FONT_BUDGET_NOTE: string;
    LIVE_EXPORTED_EMBEDS: boolean;
    /** Bytes reserved for packed web fonts when fitting the hosted file. */
    EXPORTED_FONT_BUDGET: number;
    HTML_REBUILD_TIMEOUT_MS: number;
    FONT_PACK_TIMEOUT_MS: number;
    /** Fixed overhead the host adds around the hosted file, in bytes. */
    HOSTED_HTML_OVERHEAD_BYTES: number;
    UNSAFE_EXPORT_ELEMENT_SELECTOR: string;
    EXPORT_LENGTH_STYLE_PATTERN: RegExp;
    EXPORTED_PAGE_LABEL_MAX: number;
    EXPORTED_CANVAS_WIDTH: string;
    EXPORTED_CANVAS_HEIGHT: string;
    EXPORTED_HTML_CSP: string;
    BASIC_PAGE_ROOT_CSS: string[];
    IMPORTABLE_PAGE_ROOT_CSS: string[];
    BASIC_PAGE_LAYOUT_CSS: string[];
    IMPORTABLE_PAGE_LAYOUT_CSS: string[];
    PAGE_PAGER_CSS: string[];
    BASIC_PAGE_MOBILE_CSS: string;
    IMPORTABLE_PAGE_MOBILE_CSS: string;
    PAGE_STAGE_CSS: string[];
    BASIC_PAGE_PRINT_CSS: string;
    IMPORTABLE_PAGE_PRINT_CSS: string;
    deckHtmlTestHooks: DeckHtmlTestHooks;
    initializeDeckHtml: () => void;
    imagesReducedNote: (count: number, maxBytes: number) => string;
    /** Rebuilds the document after re-encoding pictures when it exceeds `maxBytes`. */
    fitHtmlPictures: (
      pages: string[],
      buildHtml: (pages: string[]) => string,
      collectImages: () => Promise<ExportImage[]>,
      options: FitHtmlPicturesOptions,
    ) => Promise<FitHtmlPicturesResult>;
    renderDeckHtml: (
      title: string,
      slides: readonly Slide[],
      assets: CaptureAssets,
      options?: RenderDeckHtmlOptions,
    ) => Promise<RenderDeckHtmlResult>;
    splitFontImports: (css: string) => SplitFontImports;
    motionSchedule: (
      slides: readonly Slide[],
      live?: boolean,
    ) => DeckPageSlide[];
    motionConfig: (slides: readonly Slide[]) => DeckPageConfig;
    inlineSafeJson: (value: unknown) => string;
    /** Size of `html` once the host has wrapped and escaped it, in bytes. */
    hostedHtmlBytes: (html: string) => number;
    packedFontBudget: (html: string, maxBytes: number) => number;
    resolveInlineVars: (source: StyledElement, clone: StyledElement) => void;
    serializeSlide: (
      surface: HTMLElement,
      assets?: ReadonlyMap<string, string>,
      importerReady?: boolean,
    ) => string;
    exportedPageInfo: (slide: Slide) => ExportedPageInfo;
    exportedPageAttributes: (info?: ExportedPageInfo) => string;
    escapeHtmlAttribute: (text: string) => string;
    escapeStyleClosingTag: (css: string) => string;
    pageCss: (importerReady?: boolean) => string;
    inlineDeckRuntimeSource: () => string;
    buildDeckPage: (options: BuildDeckPageOptions) => string;
    htmlFilename: (title: string) => string;
  }
}

export function installExportDeckHtml(runtime: RuntimeBindings): () => void {
  var deckHtmlExports: RuntimeBindings["deckHtmlExports"];
  var WEB_FONT_OFFLINE_NOTE: RuntimeBindings["WEB_FONT_OFFLINE_NOTE"];
  var WEB_FONT_BUDGET_NOTE: RuntimeBindings["WEB_FONT_BUDGET_NOTE"];
  var LIVE_EXPORTED_EMBEDS: RuntimeBindings["LIVE_EXPORTED_EMBEDS"];
  var EXPORTED_FONT_BUDGET: RuntimeBindings["EXPORTED_FONT_BUDGET"];
  var HTML_REBUILD_TIMEOUT_MS: RuntimeBindings["HTML_REBUILD_TIMEOUT_MS"];
  var FONT_PACK_TIMEOUT_MS: RuntimeBindings["FONT_PACK_TIMEOUT_MS"];
  var HOSTED_HTML_OVERHEAD_BYTES: RuntimeBindings["HOSTED_HTML_OVERHEAD_BYTES"];
  var UNSAFE_EXPORT_ELEMENT_SELECTOR: RuntimeBindings["UNSAFE_EXPORT_ELEMENT_SELECTOR"];
  var EXPORT_LENGTH_STYLE_PATTERN: RuntimeBindings["EXPORT_LENGTH_STYLE_PATTERN"];
  var EXPORTED_PAGE_LABEL_MAX: RuntimeBindings["EXPORTED_PAGE_LABEL_MAX"];
  var EXPORTED_CANVAS_WIDTH: RuntimeBindings["EXPORTED_CANVAS_WIDTH"];
  var EXPORTED_CANVAS_HEIGHT: RuntimeBindings["EXPORTED_CANVAS_HEIGHT"];
  var EXPORTED_HTML_CSP: RuntimeBindings["EXPORTED_HTML_CSP"];
  var BASIC_PAGE_ROOT_CSS: RuntimeBindings["BASIC_PAGE_ROOT_CSS"];
  var IMPORTABLE_PAGE_ROOT_CSS: RuntimeBindings["IMPORTABLE_PAGE_ROOT_CSS"];
  var BASIC_PAGE_LAYOUT_CSS: RuntimeBindings["BASIC_PAGE_LAYOUT_CSS"];
  var IMPORTABLE_PAGE_LAYOUT_CSS: RuntimeBindings["IMPORTABLE_PAGE_LAYOUT_CSS"];
  var PAGE_PAGER_CSS: RuntimeBindings["PAGE_PAGER_CSS"];
  var BASIC_PAGE_MOBILE_CSS: RuntimeBindings["BASIC_PAGE_MOBILE_CSS"];
  var IMPORTABLE_PAGE_MOBILE_CSS: RuntimeBindings["IMPORTABLE_PAGE_MOBILE_CSS"];
  var PAGE_STAGE_CSS: RuntimeBindings["PAGE_STAGE_CSS"];
  var BASIC_PAGE_PRINT_CSS: RuntimeBindings["BASIC_PAGE_PRINT_CSS"];
  var IMPORTABLE_PAGE_PRINT_CSS: RuntimeBindings["IMPORTABLE_PAGE_PRINT_CSS"];
  var deckHtmlTestHooks: RuntimeBindings["deckHtmlTestHooks"];
  var initializeDeckHtml: RuntimeBindings["initializeDeckHtml"];
  function imagesReducedNote(count: number, maxBytes: number): string {
    return (
      String(count) +
      (count === 1 ? " picture was" : " pictures were") +
      " reduced to fit the " +
      String(Math.round(maxBytes / 1024 / 1024)) +
      " MB export limit"
    );
  }
  async function fitHtmlPictures(
    pages: string[],
    buildHtml: (pages: string[]) => string,
    collectImages: () => Promise<ExportImage[]>,
    options: FitHtmlPicturesOptions,
  ): Promise<FitHtmlPicturesResult> {
    let value = buildHtml(pages),
      state: FitHtmlPicturesResult = {
        pages: pages,
        html: value,
      },
      value2 = hostedHtmlBytes(value) + 1 - options.maxBytes;
    if (value2 <= 0) {
      return state;
    }
    try {
      let value3: ShrinkExportImagesResult = await (0,
      runtime.shrinkExportImages)(pages, await collectImages(), {
        mustSave: value2,
        wantSave: value2 + (options.packing ? EXPORTED_FONT_BUDGET : 0),
        deadline:
          options.deadline === undefined
            ? undefined
            : options.deadline - HTML_REBUILD_TIMEOUT_MS,
        wantDeadline:
          options.deadline === undefined || !options.packing
            ? undefined
            : options.deadline -
              HTML_REBUILD_TIMEOUT_MS -
              FONT_PACK_TIMEOUT_MS -
              runtime.resourceFetchRetryBudgetMs,
        encode: options.encode,
        opaque: options.opaque,
      });
      if (!value3.fits) {
        return state;
      }
      let value4 = buildHtml(value3.pages);
      if (hostedHtmlBytes(value4) + 1 > options.maxBytes) {
        return state;
      }
      return {
        pages: value3.pages,
        html: value4,
        note: imagesReducedNote(value3.reduced, options.maxBytes),
      };
    } catch {
      return state;
    }
  }
  async function renderDeckHtml(
    title: string,
    slides: readonly Slide[],
    assets: CaptureAssets,
    {
      importerReady: options = false,
      inlineWebFonts = false,
      maxBytes = 1 / 0,
      shrinkImages = false,
      deadline: deadline,
      encodeImage: encodeImage,
      opaqueImage: opaqueImage,
      fontsReadyMs: fontsReadyMs,
      nameMissingFonts: nameMissingFonts,
    }: RenderDeckHtmlOptions = {},
  ): Promise<RenderDeckHtmlResult> {
    let value = await (0, runtime.mountSlidesOffscreen)(slides, assets, {
        fontsReadyMs: fontsReadyMs,
        nameMissingFonts: nameMissingFonts,
      }),
      { host: host, warnings: warnings } = value;
    if (value.lateFamilies.length > 0) {
      warnings.push(
        (0, runtime.fontTimeoutWarning)(value.lateFamilies, "sized"),
      );
    }
    if (value.missingFamilies.length > 0) {
      warnings.push(
        (0, runtime.fontUnavailableWarning)(value.missingFamilies, "sized"),
      );
    }
    let value2: CaptureFontFindings =
      value.lateFamilies.length > 0
        ? {
            late: true,
          }
        : {};
    if (value.missingFamilies.length > 0) {
      value2.missing = true;
    }
    try {
      let value3 = await (0, runtime.rasterizeEmbedFrames)(
        host,
        slides,
        warnings,
      );
      (0, runtime.labelUncapturedEmbeds)(host, slides, value3);
      let items: string[] = [];
      for (let index = 0; index < slides.length; index++)
        items.push(
          serializeSlide(value.surface(index), value3.get(index), options),
        );
      let value4 = getComputedStyle(host),
        value5 =
          "font:" +
          (value4.font || "16px system-ui, sans-serif") +
          ";color:" +
          (value4.color || "#141413"),
        value6 = (0, runtime.documentStylesheetCss)(),
        value7 = splitFontImports(value6),
        value8: string = (0, runtime.fontUsageHints)(
          value7.css,
          items.join(`
`) + value5,
        ),
        value9: string = (0, runtime.removeRuntimeFontFaces)(
          await (0, runtime.inlineLocalFonts)(
            (0, runtime.removeUnusedFontFaces)(value7.css, value8),
            warnings,
            undefined,
            value2,
            value.missingFamilies,
          ),
        ),
        state: BuildDeckPageOptions = {
          title: title,
          fontLinks: value7.links,
          css: value9,
          rootStyle: value5,
          slides: items,
          motion: motionConfig(slides),
          importerReady: options,
          pageInfo: slides.map(exportedPageInfo),
        },
        value10 = inlineWebFonts && value7.links.length > 0,
        value11: string,
        value12: string | undefined;
      if (shrinkImages && maxBytes !== 1 / 0) {
        let value13 = await fitHtmlPictures(
          items,
          (input: string[]): string =>
            buildDeckPage({
              ...state,
              slides: input,
            }),
          (): Promise<ExportImage[]> =>
            (0, runtime.collectExportImages)(
              slides.map((input, options2) => value.surface(options2)),
              value3,
              runtime.SLIDE_WIDTH,
            ),
          {
            maxBytes: maxBytes,
            packing: value10,
            deadline: deadline,
            encode: encodeImage,
            opaque: opaqueImage,
          },
        );
        items = value13.pages;
        value11 = value13.html;
        value12 = value13.note;
      } else {
        value11 = buildDeckPage(state);
      }
      if (inlineWebFonts) {
        let text = "";
        for (let index = 0; index < slides.length; index++)
          text += value.surface(index).textContent ?? "";
        let value13: InlinedGoogleFonts = await (0,
        runtime.inlineGoogleFontFaces)(value6, {
          text: text,
          budget: packedFontBudget(value11, maxBytes),
          deadline:
            deadline === undefined
              ? undefined
              : deadline -
                HTML_REBUILD_TIMEOUT_MS -
                runtime.resourceFetchRetryBudgetMs,
          familyNamed: (input: string): boolean => value8.includes(input),
        });
        if (value13.unavailable) {
          warnings.push(WEB_FONT_OFFLINE_NOTE);
          value2.missing = true;
        }
        if (value13.overBudget) {
          warnings.push(WEB_FONT_BUDGET_NOTE);
          value2.overBudget = true;
        }
        if (value13.css !== "") {
          value11 = buildDeckPage({
            ...state,
            slides: items,
            css:
              value9 +
              `
` +
              value13.css,
          });
        }
      }
      return {
        html: value11,
        warnings: Array.from<string>(new Set(warnings)),
        fontFindings: value2,
        reducedNote: value12,
      };
    } finally {
      value.dispose();
    }
  }
  function splitFontImports(css: string): SplitFontImports {
    let values = new Set<string>(),
      value = css.replace(
        runtime.googleFontsImportRegex,
        (input: string, options: string, context: string): string => {
          values.add(context);
          return "";
        },
      );
    return {
      links: [...values],
      css: value,
    };
  }
  function motionSchedule(
    slides: readonly Slide[],
    live: boolean = LIVE_EXPORTED_EMBEDS,
  ): DeckPageSlide[] {
    return slides.map((input): DeckPageSlide => {
      let items: DeckPageStep[] = [];
      for (
        let index = 0;
        index <= (0, runtime.slideBuildCount)(input);
        index++
      )
        items.push({
          hidden: [...(0, runtime.hiddenBuildFrameIds)(input, index)],
          events:
            index === 0
              ? []
              : (0, runtime.slideBuildStepEffects)(input, index).map(
                  (input2: MotionBuildEffect): DeckPageBuildEvent => ({
                    id: input2.frame.id,
                    dir: input2.dir,
                    effect: input2.effect,
                  }),
                ),
          auto:
            index === 0
              ? false
              : (0, runtime.slideBuildStepIsAutomatic)(input, index),
        });
      let value: DeckPageEmbed[] = live
        ? input.frames
            .filter(
              (input2): input2 is HtmlFrame => input2.node.kind === "html",
            )
            .map(
              (input2): DeckPageEmbed => ({
                id: input2.id,
                srcdoc: (0, runtime.buildEmbedSrcdoc)(input2.node.html, {
                  allowScripts: runtime.allowEmbedScripts,
                }),
              }),
            )
        : [];
      return {
        ...(input.transition !== undefined
          ? {
              transition: input.transition,
            }
          : {}),
        bg: (0, runtime.slideBackgroundColor)(input.bg),
        steps: items,
        embeds: value,
      };
    });
  }
  function motionConfig(slides: readonly Slide[]): DeckPageConfig {
    let state: Record<string, DeckPageEffect> = {};
    for (let value of runtime.buildEffectValues)
      state[value] = (0, runtime.buildEffectTransition)(value);
    return {
      w: runtime.SLIDE_WIDTH,
      h: runtime.SLIDE_HEIGHT,
      buildMs: runtime.buildEffectDurationMs,
      exitEasing: runtime.buildExitEasing,
      effects: state,
      transMs: {
        ...runtime.slideTransitionDurations,
      },
      transEase: runtime.slideTransitionEasing,
      live: LIVE_EXPORTED_EMBEDS,
      slides: motionSchedule(slides),
    };
  }
  function inlineSafeJson(value: unknown): string {
    return JSON.stringify(value).replaceAll("<", "\\u003c");
  }
  function hostedHtmlBytes(html: string): number {
    let value = HOSTED_HTML_OVERHEAD_BYTES;
    for (let index = 0; index < html.length; index++) {
      let value2 = html.charCodeAt(index);
      if (value2 < 128) {
        value += 1;
      } else if (value2 < 2048) {
        value += 2;
      } else if (
        value2 >= 55296 &&
        value2 < 56320 &&
        index + 1 < html.length &&
        (html.charCodeAt(index + 1) & 64512) === 56320
      ) {
        value += 4;
        index += 1;
        continue;
      } else {
        value += 3;
      }
      if (
        value2 === 34 ||
        value2 === 92 ||
        value2 === 10 ||
        value2 === 13 ||
        value2 === 9
      ) {
        value += 1;
      } else if (value2 === 60 || value2 < 32) {
        value += 5;
      }
    }
    return value;
  }
  function packedFontBudget(html: string, maxBytes: number): number {
    if (maxBytes === 1 / 0) {
      return runtime.defaultFontInliningBudget;
    }
    let value = maxBytes - hostedHtmlBytes(html) - 1;
    if (value <= 0) {
      return 0;
    } else {
      return Math.min(runtime.defaultFontInliningBudget, value);
    }
  }
  function resolveInlineVars(source: StyledElement, clone: StyledElement): void {
    let value = source.ownerDocument?.defaultView;
    if (!value) {
      return;
    }
    let items: StyledElement[] = [
        source,
        ...Array.from<StyledElement>(
          source.querySelectorAll<StyledElement>("*"),
        ),
      ],
      items2: StyledElement[] = [
        clone,
        ...Array.from<StyledElement>(
          clone.querySelectorAll<StyledElement>("*"),
        ),
      ];
    if (items.length !== items2.length) {
      return;
    }
    for (let index = 0; index < items2.length; index++) {
      let style = items2[index]!.style;
      if (style === undefined || style.length === 0) {
        continue;
      }
      let value2 = Array.from<string>(style),
        value3: CSSStyleDeclaration | undefined;
      if (
        style.getPropertyValue("box-sizing") === "" &&
        value2.some((input: string): boolean =>
          EXPORT_LENGTH_STYLE_PATTERN.test(input),
        )
      ) {
        value3 ??= value.getComputedStyle(items[index]!);
        let value4 = value3.getPropertyValue("box-sizing");
        if (value4 !== "") {
          style.setProperty("box-sizing", value4);
        }
      }
      for (let value4 of value2) {
        if (value4.startsWith("--")) {
          style.removeProperty(value4);
          continue;
        }
        let value5 = style.getPropertyValue(value4);
        if (value5 !== "" && !value5.includes("var(")) {
          continue;
        }
        value3 ??= value.getComputedStyle(items[index]!);
        let value6 = value3.getPropertyValue(value4);
        if (value6 !== "") {
          style.setProperty(value4, value6, style.getPropertyPriority(value4));
        }
      }
    }
  }
  function serializeSlide(
    surface: HTMLElement,
    assets?: ReadonlyMap<string, string>,
    importerReady: boolean = false,
  ): string {
    let value = surface.cloneNode(true) as HTMLElement;
    if (importerReady) {
      resolveInlineVars(surface, value);
      value.classList.add("slide");
      value.setAttribute("data-canvas-width", EXPORTED_CANVAS_WIDTH);
      value.setAttribute("data-canvas-height", EXPORTED_CANVAS_HEIGHT);
    }
    (0, runtime.replaceEmbedPlaceholders)(value, assets);
    for (let value2 of Array.from<Element>(
      value.querySelectorAll(UNSAFE_EXPORT_ELEMENT_SELECTOR),
    ))
      value2.remove();
    for (let value2 of [
      value,
      ...Array.from<Element>(value.querySelectorAll("*")),
    ])
      for (let value3 of Array.from<Attr>(value2.attributes))
        if (/^on/i.test(value3.name)) {
          value2.removeAttribute(value3.name);
        } else if (
          /^(?:href|src|xlink:href|action|formaction)$/i.test(value3.name) &&
          /^javascript:/i.test(value3.value.replace(/[\u0000-\u0020]/g, ""))
        ) {
          value2.removeAttribute(value3.name);
        }
    for (let value2 of Array.from<HTMLStyleElement>(
      value.querySelectorAll("style"),
    ))
      value2.textContent = escapeStyleClosingTag(value2.textContent ?? "");
    for (let value2 of Array.from<HTMLElement>(
      value.querySelectorAll<HTMLElement>("a[title]:not([href])"),
    )) {
      let value3 =
        /(?:^|\s)(https?:\/\/\S+)$/i.exec(
          value2.getAttribute("title") ?? "",
        )?.[1] ?? "";
      if (!(0, runtime.isSafeHyperlink)(value3)) {
        continue;
      }
      value2.setAttribute("href", value3);
      value2.setAttribute("target", "_blank");
      value2.setAttribute("rel", "noopener noreferrer");
      value2.setAttribute("title", value3);
      value2.style.cursor = "pointer";
    }
    for (let value2 of Array.from<Element>(
      value.querySelectorAll("[data-video-watch]"),
    )) {
      let value3 = value2.getAttribute("data-video-watch") ?? "";
      value2.removeAttribute("data-video-watch");
      if (!(0, runtime.isSafeHyperlink)(value3) || value2.parentNode === null) {
        continue;
      }
      let value4 = value2.ownerDocument.createElement("a");
      value4.setAttribute("href", value3);
      value4.setAttribute("target", "_blank");
      value4.setAttribute("rel", "noopener noreferrer");
      value4.setAttribute("style", "display:contents");
      value2.parentNode.replaceChild(value4, value2);
      value4.appendChild(value2);
    }
    value.removeAttribute("data-uncommentable");
    return value.outerHTML;
  }
  function exportedPageInfo(slide: Slide): ExportedPageInfo {
    let value = (0, runtime.slideTitleSnippet)(slide, EXPORTED_PAGE_LABEL_MAX),
      value2 = (slide.notes ?? "").trim();
    return {
      ...(value !== "" && {
        label: value,
      }),
      ...(value2 !== "" && {
        notes: value2,
      }),
    };
  }
  function exportedPageAttributes(info: ExportedPageInfo = {}): string {
    return (
      ' data-document-role="page"' +
      (info.label === undefined
        ? ""
        : ' data-label="' + escapeHtmlAttribute(info.label) + '"') +
      (info.notes === undefined
        ? ""
        : ' data-speaker-notes="' + escapeHtmlAttribute(info.notes) + '"')
    );
  }
  function escapeHtmlAttribute(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeStyleClosingTag(css: string): string {
    return css.replaceAll("</", "\\3C/");
  }
  function pageCss(importerReady?: boolean): string {
    return [
      ...(importerReady ? IMPORTABLE_PAGE_ROOT_CSS : BASIC_PAGE_ROOT_CSS),
      ...(importerReady ? IMPORTABLE_PAGE_LAYOUT_CSS : BASIC_PAGE_LAYOUT_CSS),
      ...PAGE_PAGER_CSS,
      importerReady ? IMPORTABLE_PAGE_MOBILE_CSS : BASIC_PAGE_MOBILE_CSS,
      ...PAGE_STAGE_CSS,
      importerReady ? IMPORTABLE_PAGE_PRINT_CSS : BASIC_PAGE_PRINT_CSS,
    ].join(`
`);
  }
  function inlineDeckRuntimeSource(): string {
    let value = (0, runtime.deckPageRuntimeSource)();
    if (/<\/script|<\!--/i.test(value)) {
      throw Error("page runtime source is not inline-safe");
    }
    return value;
  }
  function buildDeckPage(options: BuildDeckPageOptions): string {
    let length = options.slides.length,
      value = options.importerReady === true;
    return (
      `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="` +
      EXPORTED_HTML_CSP +
      `">
<meta name="viewport" content="width=device-width, initial-scale=1">
` +
      (value
        ? `<meta name="hz:slide-selector" content=".slide">
<meta name="hz:canvas-width" content="` +
          EXPORTED_CANVAS_WIDTH +
          `">
<meta name="hz:canvas-height" content="` +
          EXPORTED_CANVAS_HEIGHT +
          `">
`
        : "") +
      "<title>" +
      escapeHtmlAttribute(options.title) +
      `</title>
` +
      options.fontLinks
        .map(
          (input: string): string =>
            '<link rel="stylesheet" href="' +
            escapeHtmlAttribute(input) +
            `">
`,
        )
        .join("") +
      `<style>
` +
      escapeStyleClosingTag(options.css) +
      `
</style>
<style>
` +
      pageCss(value) +
      `
</style>
<script type="application/json" id="deck-motion">` +
      inlineSafeJson(options.motion) +
      `<\/script>
<script>(` +
      inlineDeckRuntimeSource() +
      `)(JSON.parse(document.getElementById("deck-motion").textContent));<\/script>
</head>
<body>
<main data-appifact-content style="` +
      escapeHtmlAttribute(options.rootStyle) +
      `">
` +
      options.slides
        .map(
          (input: string, options2: number): string =>
            '<section class="deck-slide" id="' +
            String(options2 + 1) +
            '" aria-roledescription="slide" aria-label="Slide ' +
            String(options2 + 1) +
            " of " +
            String(length) +
            '"' +
            (value
              ? exportedPageAttributes(options.pageInfo?.[options2])
              : "") +
            '><div class="deck-fit"><div class="deck-scaler">' +
            input +
            `</div></div></section>
`,
        )
        .join("") +
      `</main>
<div class="deck-pager" aria-hidden="true"></div>
</body>
</html>
`
    );
  }
  function htmlFilename(title: string): string {
    return (0, runtime.exportFilename)(title, "html");
  }
  bindRuntimeValue(
    runtime,
    "deckHtmlExports",
    () => deckHtmlExports,
    (value) => {
      deckHtmlExports = value;
    },
  );
  bindRuntimeValue(runtime, "imagesReducedNote", () => imagesReducedNote);
  bindRuntimeValue(runtime, "fitHtmlPictures", () => fitHtmlPictures);
  bindRuntimeValue(runtime, "renderDeckHtml", () => renderDeckHtml);
  bindRuntimeValue(runtime, "splitFontImports", () => splitFontImports);
  bindRuntimeValue(runtime, "motionSchedule", () => motionSchedule);
  bindRuntimeValue(runtime, "motionConfig", () => motionConfig);
  bindRuntimeValue(runtime, "inlineSafeJson", () => inlineSafeJson);
  bindRuntimeValue(runtime, "hostedHtmlBytes", () => hostedHtmlBytes);
  bindRuntimeValue(runtime, "packedFontBudget", () => packedFontBudget);
  bindRuntimeValue(runtime, "resolveInlineVars", () => resolveInlineVars);
  bindRuntimeValue(runtime, "serializeSlide", () => serializeSlide);
  bindRuntimeValue(runtime, "exportedPageInfo", () => exportedPageInfo);
  bindRuntimeValue(
    runtime,
    "exportedPageAttributes",
    () => exportedPageAttributes,
  );
  bindRuntimeValue(runtime, "escapeHtmlAttribute", () => escapeHtmlAttribute);
  bindRuntimeValue(
    runtime,
    "escapeStyleClosingTag",
    () => escapeStyleClosingTag,
  );
  bindRuntimeValue(runtime, "pageCss", () => pageCss);
  bindRuntimeValue(
    runtime,
    "inlineDeckRuntimeSource",
    () => inlineDeckRuntimeSource,
  );
  bindRuntimeValue(runtime, "buildDeckPage", () => buildDeckPage);
  bindRuntimeValue(runtime, "htmlFilename", () => htmlFilename);
  bindRuntimeValue(
    runtime,
    "WEB_FONT_OFFLINE_NOTE",
    () => WEB_FONT_OFFLINE_NOTE,
    (value) => {
      WEB_FONT_OFFLINE_NOTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WEB_FONT_BUDGET_NOTE",
    () => WEB_FONT_BUDGET_NOTE,
    (value) => {
      WEB_FONT_BUDGET_NOTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_EXPORTED_EMBEDS",
    () => LIVE_EXPORTED_EMBEDS,
    (value) => {
      LIVE_EXPORTED_EMBEDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORTED_FONT_BUDGET",
    () => EXPORTED_FONT_BUDGET,
    (value) => {
      EXPORTED_FONT_BUDGET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HTML_REBUILD_TIMEOUT_MS",
    () => HTML_REBUILD_TIMEOUT_MS,
    (value) => {
      HTML_REBUILD_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_PACK_TIMEOUT_MS",
    () => FONT_PACK_TIMEOUT_MS,
    (value) => {
      FONT_PACK_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOSTED_HTML_OVERHEAD_BYTES",
    () => HOSTED_HTML_OVERHEAD_BYTES,
    (value) => {
      HOSTED_HTML_OVERHEAD_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNSAFE_EXPORT_ELEMENT_SELECTOR",
    () => UNSAFE_EXPORT_ELEMENT_SELECTOR,
    (value) => {
      UNSAFE_EXPORT_ELEMENT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORT_LENGTH_STYLE_PATTERN",
    () => EXPORT_LENGTH_STYLE_PATTERN,
    (value) => {
      EXPORT_LENGTH_STYLE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORTED_PAGE_LABEL_MAX",
    () => EXPORTED_PAGE_LABEL_MAX,
    (value) => {
      EXPORTED_PAGE_LABEL_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORTED_CANVAS_WIDTH",
    () => EXPORTED_CANVAS_WIDTH,
    (value) => {
      EXPORTED_CANVAS_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORTED_CANVAS_HEIGHT",
    () => EXPORTED_CANVAS_HEIGHT,
    (value) => {
      EXPORTED_CANVAS_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORTED_HTML_CSP",
    () => EXPORTED_HTML_CSP,
    (value) => {
      EXPORTED_HTML_CSP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BASIC_PAGE_ROOT_CSS",
    () => BASIC_PAGE_ROOT_CSS,
    (value) => {
      BASIC_PAGE_ROOT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IMPORTABLE_PAGE_ROOT_CSS",
    () => IMPORTABLE_PAGE_ROOT_CSS,
    (value) => {
      IMPORTABLE_PAGE_ROOT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BASIC_PAGE_LAYOUT_CSS",
    () => BASIC_PAGE_LAYOUT_CSS,
    (value) => {
      BASIC_PAGE_LAYOUT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IMPORTABLE_PAGE_LAYOUT_CSS",
    () => IMPORTABLE_PAGE_LAYOUT_CSS,
    (value) => {
      IMPORTABLE_PAGE_LAYOUT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PAGE_PAGER_CSS",
    () => PAGE_PAGER_CSS,
    (value) => {
      PAGE_PAGER_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BASIC_PAGE_MOBILE_CSS",
    () => BASIC_PAGE_MOBILE_CSS,
    (value) => {
      BASIC_PAGE_MOBILE_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IMPORTABLE_PAGE_MOBILE_CSS",
    () => IMPORTABLE_PAGE_MOBILE_CSS,
    (value) => {
      IMPORTABLE_PAGE_MOBILE_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PAGE_STAGE_CSS",
    () => PAGE_STAGE_CSS,
    (value) => {
      PAGE_STAGE_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BASIC_PAGE_PRINT_CSS",
    () => BASIC_PAGE_PRINT_CSS,
    (value) => {
      BASIC_PAGE_PRINT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IMPORTABLE_PAGE_PRINT_CSS",
    () => IMPORTABLE_PAGE_PRINT_CSS,
    (value) => {
      IMPORTABLE_PAGE_PRINT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deckHtmlTestHooks",
    () => deckHtmlTestHooks,
    (value) => {
      deckHtmlTestHooks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDeckHtml",
    () => initializeDeckHtml,
    (value) => {
      initializeDeckHtml = value;
    },
  );
  return () => {
    deckHtmlExports = {} as DeckHtmlExports;
    (0, runtime.defineLiveExports)(deckHtmlExports, {
      splitFontImports: () => splitFontImports,
      serializeSlide: () => serializeSlide,
      resolveInlineVars: () => resolveInlineVars,
      renderDeckHtml: () => renderDeckHtml,
      pageCss: () => pageCss,
      motionSchedule: () => motionSchedule,
      motionConfig: () => motionConfig,
      htmlFilename: () => htmlFilename,
      buildDeckPage: () => buildDeckPage,
      _test: () => deckHtmlTestHooks,
      PAGE_CSP: () => EXPORTED_HTML_CSP,
      LIVE_EMBEDS: () => LIVE_EXPORTED_EMBEDS,
    });
    WEB_FONT_OFFLINE_NOTE =
      "a web font could not be included in the file; its text keeps that typeface only while online";
    WEB_FONT_BUDGET_NOTE =
      "some web fonts were too large to include in the file; their text keeps those typefaces only while online";
    LIVE_EXPORTED_EMBEDS = true;
    EXPORTED_FONT_BUDGET = 1048576;
    HTML_REBUILD_TIMEOUT_MS = 2000;
    FONT_PACK_TIMEOUT_MS = 4000;
    HOSTED_HTML_OVERHEAD_BYTES = 131072;
    UNSAFE_EXPORT_ELEMENT_SELECTOR =
      "script,noscript,iframe,object,embed,frame,template,xmp,plaintext,noembed,noframes,base,link,meta,animate,set,video,audio,source,track";
    EXPORTED_PAGE_LABEL_MAX = 80;
    EXPORTED_HTML_CSP =
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:; frame-src about:; child-src about:; worker-src 'none'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
    BASIC_PAGE_MOBILE_CSS =
      "@media (max-aspect-ratio:1/1){html{scroll-snap-type:y proximity}.deck-slide{height:auto;padding:6px 0;scroll-snap-stop:normal}.deck-slide:first-child{padding-top:0}}";
    IMPORTABLE_PAGE_MOBILE_CSS =
      "@media (max-aspect-ratio:1/1){html.deck-js{scroll-snap-type:y proximity}.deck-js .deck-slide{height:auto;padding:6px 0;scroll-snap-stop:normal}.deck-js .deck-slide:first-child{padding-top:0}}";
    BASIC_PAGE_PRINT_CSS =
      "@media print{html,body{background:none;overflow:visible;height:auto;color-scheme:light}.deck-slide{display:block;height:auto;padding:0;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}.deck-slide:last-child{break-after:auto;page-break-after:auto}.deck-fit{width:auto;height:auto}.deck-scaler{transform:none}.deck-pager{display:none}iframe{display:none!important}}";
    IMPORTABLE_PAGE_PRINT_CSS =
      "@media print{html,html.deck-js,body{background:none;overflow:visible;height:auto;color-scheme:light}:root .deck-slide{display:block;height:auto;padding:0;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}:root .deck-slide:last-child{break-after:auto;page-break-after:auto}:root .deck-fit{width:auto;height:auto}:root .deck-scaler{transform:none}.deck-pager{display:none}iframe{display:none!important}}";
    initializeDeckHtml = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeEmbeds)();
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeBuildEffects)();
      (0, runtime.initializeSlideRenderer)();
      (0, runtime.initializeRenderingTheme)();
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeFontFetching)();
      (0, runtime.initializeCaptureFallback)();
      (0, runtime.initializePdfCapture)();
      (0, runtime.initializeImageShrinking)();
      (0, runtime.initializeFontInlining)();
      EXPORT_LENGTH_STYLE_PATTERN = /^padding|^border(-\w+)*-width$/;
      EXPORTED_CANVAS_WIDTH = String(runtime.SLIDE_WIDTH);
      EXPORTED_CANVAS_HEIGHT = String(runtime.SLIDE_HEIGHT);
      BASIC_PAGE_ROOT_CSS = [
        "html{overflow:hidden auto;scroll-snap-type:y mandatory;scrollbar-width:none;background:#000;color-scheme:dark}",
        "html::-webkit-scrollbar{display:none}",
        "body{margin:0;background:#000;overflow:visible}",
        "main{color-scheme:light}",
      ];
      IMPORTABLE_PAGE_ROOT_CSS = [
        "html{background:#000;color-scheme:dark}",
        "html.deck-js{overflow:hidden auto;scroll-snap-type:y mandatory;scrollbar-width:none}",
        "html.deck-js::-webkit-scrollbar{display:none}",
        "body{margin:0;background:#000;overflow:visible}",
        "main{color-scheme:light}",
      ];
      BASIC_PAGE_LAYOUT_CSS = [
        ".deck-slide{height:100vh;height:100dvh;display:flex;align-items:center;justify-content:center;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always}",
        ".deck-fit{flex:none;position:relative;width:calc(" +
          EXPORTED_CANVAS_WIDTH +
          "px*var(--deck-s,.5));height:calc(" +
          EXPORTED_CANVAS_HEIGHT +
          "px*var(--deck-s,.5));overflow:hidden}",
        ".deck-scaler{width:" +
          EXPORTED_CANVAS_WIDTH +
          "px;height:" +
          EXPORTED_CANVAS_HEIGHT +
          "px;transform:scale(var(--deck-s,.5));transform-origin:0 0}",
      ];
      IMPORTABLE_PAGE_LAYOUT_CSS = [
        ".deck-slide{display:block;width:" +
          EXPORTED_CANVAS_WIDTH +
          "px;height:" +
          EXPORTED_CANVAS_HEIGHT +
          "px}",
        ".deck-fit{position:relative;width:" +
          EXPORTED_CANVAS_WIDTH +
          "px;height:" +
          EXPORTED_CANVAS_HEIGHT +
          "px;overflow:hidden}",
        ".deck-scaler{width:" +
          EXPORTED_CANVAS_WIDTH +
          "px;height:" +
          EXPORTED_CANVAS_HEIGHT +
          "px}",
        ".deck-js .deck-slide{width:auto;height:100vh;height:100dvh;display:flex;align-items:center;justify-content:center;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always}",
        ".deck-js .deck-fit{flex:none;width:calc(" +
          EXPORTED_CANVAS_WIDTH +
          "px*var(--deck-s));height:calc(" +
          EXPORTED_CANVAS_HEIGHT +
          "px*var(--deck-s))}",
        ".deck-js .deck-scaler{transform:scale(var(--deck-s));transform-origin:0 0}",
      ];
      PAGE_PAGER_CSS = [
        ".deck-pager{position:fixed;z-index:3;right:16px;bottom:16px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.7);color:#fff;font:12px/1.5 system-ui,sans-serif;font-variant-numeric:tabular-nums;opacity:0;transition:opacity .3s;pointer-events:none}",
        ".deck-pager[data-on]{opacity:1}",
      ];
      PAGE_STAGE_CSS = [
        "@media screen{html.deck-stage{overflow:hidden}.deck-stage body{overflow:hidden}.deck-stage main{position:fixed;inset:0}.deck-stage .deck-slide{position:absolute;inset:0;height:auto;padding:0;z-index:1}.deck-stage .deck-slide[data-off]{opacity:0;pointer-events:none;z-index:0}.deck-stage .deck-slide[data-leaving]{z-index:2;pointer-events:none}.deck-stage [data-build-hidden],.deck-stage [data-magic-hidden],.deck-stage [data-embed-under],.deck-stage [data-embed-dead] [data-embed-pic]{visibility:hidden}.deck-stage [data-embed-dead-label]{display:flex}}",
        "[data-embed-dead-label]{display:none}",
        "@page{size:" +
          EXPORTED_CANVAS_WIDTH +
          "px " +
          EXPORTED_CANVAS_HEIGHT +
          "px;margin:0}",
      ];
      deckHtmlTestHooks = {
        packedFontBudget: packedFontBudget,
        hostedBytes: hostedHtmlBytes,
        imagesReducedNote: imagesReducedNote,
        fitPictures: fitHtmlPictures,
        pageInfo: exportedPageInfo,
        FONT_ROOM: EXPORTED_FONT_BUDGET,
        REBUILD_MS: HTML_REBUILD_TIMEOUT_MS,
        FONT_PACK_MS: FONT_PACK_TIMEOUT_MS,
      };
    });
  };
}
