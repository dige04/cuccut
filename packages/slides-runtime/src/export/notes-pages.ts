/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide, SlideNode, StyleBag, TextNode } from "../deck-contracts";
import type {
  PdfBlock,
  PdfLink,
  PdfLosslessImage,
  PdfTextRun,
} from "./pdf-writer";

/** The text layer of a captured page: runs, links and structure blocks in PDF points. */
export interface PageTextLayer {
  textRuns: PdfTextRun[];
  links: PdfLink[];
  blocks?: PdfBlock[] | null | undefined;
}
/** A text layer whose structure blocks are always present. */
export interface PlacedTextLayer extends PageTextLayer {
  blocks: PdfBlock[];
}
/** A captured slide page: its JPEG (and lossless copy) plus the text layer read from it. */
export interface CapturedPage extends PageTextLayer {
  jpeg: Uint8Array;
  lossless?: PdfLosslessImage | null | undefined;
}
/** Layout constants of a speaker-notes page, in slide pixels. */
export interface NotesPageMetrics {
  margin: number;
  pictureHeight: number;
  gap: number;
  fontPx: number;
  lineHeight: number;
  /** Width of one narrow glyph in em, used to estimate how many columns fit. */
  glyphEm: number;
  maxPages: number;
}
/** Where the slide picture sits on a notes page. */
export interface NotesPicturePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Picture size relative to the slide it shows. */
  scale: number;
}
/** The notes of a deck laid out as extra pages that follow their slides. */
export interface NotesPagePlan {
  noteSlides: Slide[];
  /** How many notes pages follow each slide. */
  after: number[];
  /** 1-based numbers of the slides whose notes were cut at the page limit. */
  cut: number[];
}
/** Rewrites the notes text node before it is placed on a notes page. */
export type NotesNodeMapper = (node: TextNode) => SlideNode;
/** A wrapped line of notes with the whitespace that joined it to the previous one. */
interface NotesLine {
  text: string;
  glue: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    notesPageExports: NotesPageExports;
    NOTES_PAGE: NotesPageMetrics;
    NOTES_TEXT_TOP: number;
    NOTES_TEXT_HEIGHT: number;
    NOTES_TEXT_WIDTH: number;
    NOTES_LINES_PER_PAGE: number;
    NOTES_COLUMNS_PER_LINE: number;
    /** East Asian wide and emoji glyphs, counted as two columns. */
    WIDE_GLYPH_PATTERN: RegExp;
    /** Columns the text takes: 2 per wide glyph, 1 per other. */
    notesGlyphWidth: (text: string) => number;
    NOTES_PICTURE_PLACEMENT: NotesPicturePlacement;
    /** Asset id under which a slide's picture is stored for its notes pages. */
    notesPictureAsset: (slideId: string) => string;
    initializeNotesPages: () => void;
    /** Splits off the first line of text that fits `maxWidth` columns. */
    splitNotesLine: (text: string, maxWidth: number) => [string, string];
    paginateNotes: (
      text: string,
      maxLines?: number,
      maxColumns?: number,
      maxPages?: number,
    ) => { pages: string[]; cut: boolean };
    notesPageSlides: (
      slide: Slide,
      slideNumber: number,
      mapNode?: NotesNodeMapper,
    ) => { pages: Slide[]; cut: boolean };
    planNotesPages: (
      slides: readonly Slide[],
      mapNode?: NotesNodeMapper,
    ) => NotesPagePlan;
    /** Data URIs of the slide pictures the notes pages show, by asset id. */
    notesPictureAssets: (
      slides: readonly Slide[],
      captures: readonly Pick<CapturedPage, "jpeg">[],
      pageCounts: readonly number[],
    ) => Map<string, string>;
    /** Maps a slide's text layer into the picture area of its first notes page. */
    transformSlideForNotesPage: (
      slide: PageTextLayer,
      pageHeight: number,
      scale: number,
    ) => PlacedTextLayer;
    /** Merges each slide page with the captured pages of its notes. */
    placeNotesPages: (
      slides: readonly CapturedPage[],
      notePages: readonly CapturedPage[],
      after: readonly number[],
      scale: number,
    ) => CapturedPage[];
  }
}

export interface NotesPageExports {
  planNotesPages: RuntimeBindings["planNotesPages"];
  placeNotesPages: RuntimeBindings["placeNotesPages"];
  paginateNotes: RuntimeBindings["paginateNotes"];
  notesPictureAssets: RuntimeBindings["notesPictureAssets"];
  notesPictureAsset: RuntimeBindings["notesPictureAsset"];
  notesPageSlides: RuntimeBindings["notesPageSlides"];
  NOTES_PAGE: NotesPageMetrics;
  NOTES_LINES_PER_PAGE: number;
  NOTES_COLS_PER_LINE: number;
}

export function installExportNotesPages(runtime: RuntimeBindings): () => void {
  var notesPageExports: RuntimeBindings["notesPageExports"];
  var NOTES_PAGE: RuntimeBindings["NOTES_PAGE"];
  var NOTES_TEXT_TOP: RuntimeBindings["NOTES_TEXT_TOP"];
  var NOTES_TEXT_HEIGHT: RuntimeBindings["NOTES_TEXT_HEIGHT"];
  var NOTES_TEXT_WIDTH: RuntimeBindings["NOTES_TEXT_WIDTH"];
  var NOTES_LINES_PER_PAGE: RuntimeBindings["NOTES_LINES_PER_PAGE"];
  var NOTES_COLUMNS_PER_LINE: RuntimeBindings["NOTES_COLUMNS_PER_LINE"];
  var WIDE_GLYPH_PATTERN: RuntimeBindings["WIDE_GLYPH_PATTERN"];
  var notesGlyphWidth: RuntimeBindings["notesGlyphWidth"];
  var NOTES_PICTURE_PLACEMENT: RuntimeBindings["NOTES_PICTURE_PLACEMENT"];
  var notesPictureAsset: RuntimeBindings["notesPictureAsset"];
  var initializeNotesPages: RuntimeBindings["initializeNotesPages"];
  function splitNotesLine(text: string, maxWidth: number): [string, string] {
    let value = Array.from(text),
      index = 0,
      index2 = 0;
    while (
      index2 < value.length &&
      index + notesGlyphWidth(value[index2]!) <= maxWidth
    )
      index += notesGlyphWidth(value[index2++]!);
    if (index2 === 0) {
      index2 = 1;
    }
    return [value.slice(0, index2).join(""), value.slice(index2).join("")];
  }
  function paginateNotes(
    text: string,
    maxLines: number = NOTES_LINES_PER_PAGE,
    maxColumns: number = NOTES_COLUMNS_PER_LINE,
    maxPages: number = NOTES_PAGE.maxPages,
  ): { pages: string[]; cut: boolean } {
    let value = Math.max(1, maxLines),
      value2 = Math.max(1, maxColumns),
      items: NotesLine[] = [];
    for (let value4 of text.replace(
      /\r\n?/g,
      `
`,
    ).split(`
`)) {
      let text2 = "",
        value5 = `
`,
        callback = (input: string): void => {
          items.push({
            text: text2,
            glue: value5,
          });
          text2 = "";
          value5 = input;
        };
      for (let value6 of value4.split(/[ \t]+/).filter((input) => input !== "")) {
        let value7 = value6;
        while (notesGlyphWidth(value7) > value2) {
          if (text2 !== "") {
            callback(" ");
          }
          let [value8, value9] = splitNotesLine(value7, value2);
          text2 = value8;
          callback("");
          value7 = value9;
        }
        if (text2 === "") {
          text2 = value7;
        } else if (
          notesGlyphWidth(text2) + 1 + notesGlyphWidth(value7) <=
          value2
        ) {
          text2 += " " + value7;
        } else {
          callback(" ");
          text2 = value7;
        }
      }
      callback(`
`);
    }
    while (items.length > 0 && items[items.length - 1]!.text.trim() === "")
      items.pop();
    while (items.length > 0 && items[0]!.text.trim() === "") items.shift();
    let items2: string[] = [],
      flag = false,
      value3 = Math.max(1, maxPages);
    for (let index = 0; index < items.length; index += value) {
      let value4 =
          items2.length + 1 >= value3
            ? items.slice(index)
            : items.slice(index, index + value),
        value5 = value4
          .map(
            (input, options) =>
              (options === 0 ? "" : input.glue) + input.text,
          )
          .join("")
          .trim();
      if (value5 !== "") {
        items2.push(value5);
      }
      if (items2.length >= value3) {
        flag = value4.length > value;
        break;
      }
    }
    return {
      pages: items2,
      cut: flag,
    };
  }
  function notesPageSlides(
    slide: Slide,
    slideNumber: number,
    mapNode: NotesNodeMapper = (input) => input,
  ): { pages: Slide[]; cut: boolean } {
    let { pages: pages, cut: cut } = paginateNotes(slide.notes ?? "");
    return {
      pages: pages.map((input, options): Slide => {
        let value = mapNode({
            kind: "text",
            role: "body",
            text: input,
            color: "#1f1f1f",
            align: "start",
            fit: "shrink",
          }),
          state: StyleBag = {
            ...value.style,
            fontSize: NOTES_PAGE.fontPx,
            lineHeight: NOTES_PAGE.lineHeight,
          };
        return {
          v: 1,
          id: slide.id + "-notes-" + String(options + 1),
          bg: "#ffffff",
          frames: [
            {
              id: "picture",
              x: {
                anchor: "center",
                margin: 0,
                offset: 0,
                size: NOTES_PICTURE_PLACEMENT.w,
              },
              y: {
                anchor: "leading",
                margin: NOTES_PICTURE_PLACEMENT.y,
                offset: 0,
                size: NOTES_PICTURE_PLACEMENT.h,
              },
              node: {
                kind: "img",
                asset: notesPictureAsset(slide.id),
                alt: "Slide " + String(slideNumber),
                fit: "contain",
              },
            },
            {
              id: "notes",
              x: {
                anchor: "fill",
                margin: NOTES_PAGE.margin,
                offset: 0,
              },
              y: {
                anchor: "leading",
                margin: NOTES_TEXT_TOP,
                offset: 0,
                size: NOTES_TEXT_HEIGHT,
              },
              node: {
                ...value,
                style: state,
              },
            },
          ],
        };
      }),
      cut: cut,
    };
  }
  function planNotesPages(
    slides: readonly Slide[],
    mapNode?: NotesNodeMapper,
  ): NotesPagePlan {
    let items: Slide[] = [],
      items2: number[] = [],
      items3: number[] = [];
    slides.forEach((input, options): void => {
      let value = notesPageSlides(input, options + 1, mapNode);
      items2.push(value.pages.length);
      items.push(...value.pages);
      if (value.cut) {
        items3.push(options + 1);
      }
    });
    return {
      noteSlides: items,
      after: items2,
      cut: items3,
    };
  }
  function notesPictureAssets(
    slides: readonly Slide[],
    captures: readonly Pick<CapturedPage, "jpeg">[],
    pageCounts: readonly number[],
  ): Map<string, string> {
    let entries = new Map<string, string>();
    slides.forEach((input, options): void => {
      if ((pageCounts[options] ?? 0) > 0) {
        entries.set(
          notesPictureAsset(input.id),
          "data:image/jpeg;base64," +
            (0, runtime.bytesToBase64)(captures[options]!.jpeg),
        );
      }
    });
    return entries;
  }
  function transformSlideForNotesPage(
    slide: PageTextLayer,
    pageHeight: number,
    scale: number,
  ): PlacedTextLayer {
    let scale2 = NOTES_PICTURE_PLACEMENT.scale,
      value = NOTES_PICTURE_PLACEMENT.x * scale,
      value2 =
        pageHeight -
        (NOTES_PICTURE_PLACEMENT.y + NOTES_PICTURE_PLACEMENT.h) * scale,
      value3 = runtime.SLIDE_WIDTH * scale,
      callback = (input: PdfTextRun): PdfTextRun => {
        let value4 = Math.max(0, input.xPt);
        return {
          ...input,
          xPt: value4,
          widthPt: Math.max(
            0,
            Math.min(value3, input.xPt + input.widthPt) - value4,
          ),
        };
      };
    return {
      textRuns: slide.textRuns.map(callback).map((input) => ({
        ...input,
        xPt: value + input.xPt * scale2,
        yPt: value2 + input.yPt * scale2,
        sizePt: input.sizePt * scale2,
        widthPt: input.widthPt * scale2,
      })),
      links: slide.links.map((input) => ({
        ...input,
        xPt: value + input.xPt * scale2,
        yPt: value2 + input.yPt * scale2,
        widthPt: input.widthPt * scale2,
        heightPt: input.heightPt * scale2,
      })),
      blocks: (slide.blocks ?? []).map((input): PdfBlock => {
        if (input.box === undefined) {
          return input;
        }
        let value4 = Math.max(0, input.box.xPt),
          value5 = Math.max(0, input.box.yPt),
          value6 = Math.max(
            0,
            Math.min(value3, input.box.xPt + input.box.widthPt) - value4,
          ),
          value7 = Math.max(
            0,
            Math.min(pageHeight, input.box.yPt + input.box.heightPt) - value5,
          );
        return {
          ...input,
          box: {
            xPt: value + value4 * scale2,
            yPt: value2 + value5 * scale2,
            widthPt: value6 * scale2,
            heightPt: value7 * scale2,
          },
        };
      }),
    };
  }
  function placeNotesPages(
    slides: readonly CapturedPage[],
    notePages: readonly CapturedPage[],
    after: readonly number[],
    scale: number,
  ): CapturedPage[] {
    let items: CapturedPage[] = [],
      value = runtime.SLIDE_HEIGHT * scale,
      index = 0;
    slides.forEach((input, options): void => {
      let value2 = after[options] ?? 0;
      if (value2 === 0) {
        items.push(input);
        return;
      }
      let value3 = transformSlideForNotesPage(input, value, scale),
        blocks = value3.blocks,
        value4 = value3.links.reduce(
          (input2, options2) =>
            options2.anchor === undefined
              ? input2
              : Math.max(input2, options2.anchor + 1),
          0,
        );
      for (let index2 = 0; index2 < value2; index2++) {
        let value5 = notePages[index++]!,
          value6 = value5.textRuns.map((input2): PdfTextRun => {
            let value9: PdfTextRun =
              input2.block === undefined
                ? input2
                : {
                    ...input2,
                    block: input2.block + blocks.length,
                  };
            if (value9.link === undefined) {
              return value9;
            } else {
              return {
                ...value9,
                link: value9.link + value4,
              };
            }
          }),
          value7 = value5.links.map(
            (input2): PdfLink =>
              input2.anchor === undefined
                ? input2
                : {
                    ...input2,
                    anchor: input2.anchor + value4,
                  },
          );
        if (index2 === 0) {
          items.push({
            ...value5,
            textRuns: [...value3.textRuns, ...value6],
            blocks: [...blocks, ...(value5.blocks ?? [])],
            links: [...value3.links, ...value7],
          });
          continue;
        }
        let items2: PdfBlock[] = [
            ...blocks.map(
              (): PdfBlock => ({
                role: "Artifact",
              }),
            ),
            ...(value5.blocks ?? []),
            {
              role: "Artifact",
            },
          ],
          value8 = value3.textRuns.map(
            (input2): PdfTextRun =>
              input2.block === undefined
                ? {
                    ...input2,
                    block: items2.length - 1,
                  }
                : input2,
          );
        items.push({
          ...value5,
          textRuns: [...value8, ...value6],
          blocks: items2,
          links: [...value3.links, ...value7],
        });
      }
    });
    return items;
  }
  bindRuntimeValue(
    runtime,
    "notesPageExports",
    () => notesPageExports,
    (value) => {
      notesPageExports = value;
    },
  );
  bindRuntimeValue(runtime, "splitNotesLine", () => splitNotesLine);
  bindRuntimeValue(runtime, "paginateNotes", () => paginateNotes);
  bindRuntimeValue(runtime, "notesPageSlides", () => notesPageSlides);
  bindRuntimeValue(runtime, "planNotesPages", () => planNotesPages);
  bindRuntimeValue(runtime, "notesPictureAssets", () => notesPictureAssets);
  bindRuntimeValue(
    runtime,
    "transformSlideForNotesPage",
    () => transformSlideForNotesPage,
  );
  bindRuntimeValue(runtime, "placeNotesPages", () => placeNotesPages);
  bindRuntimeValue(
    runtime,
    "NOTES_PAGE",
    () => NOTES_PAGE,
    (value) => {
      NOTES_PAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NOTES_TEXT_TOP",
    () => NOTES_TEXT_TOP,
    (value) => {
      NOTES_TEXT_TOP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NOTES_TEXT_HEIGHT",
    () => NOTES_TEXT_HEIGHT,
    (value) => {
      NOTES_TEXT_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NOTES_TEXT_WIDTH",
    () => NOTES_TEXT_WIDTH,
    (value) => {
      NOTES_TEXT_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NOTES_LINES_PER_PAGE",
    () => NOTES_LINES_PER_PAGE,
    (value) => {
      NOTES_LINES_PER_PAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NOTES_COLUMNS_PER_LINE",
    () => NOTES_COLUMNS_PER_LINE,
    (value) => {
      NOTES_COLUMNS_PER_LINE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WIDE_GLYPH_PATTERN",
    () => WIDE_GLYPH_PATTERN,
    (value) => {
      WIDE_GLYPH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notesGlyphWidth",
    () => notesGlyphWidth,
    (value) => {
      notesGlyphWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NOTES_PICTURE_PLACEMENT",
    () => NOTES_PICTURE_PLACEMENT,
    (value) => {
      NOTES_PICTURE_PLACEMENT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notesPictureAsset",
    () => notesPictureAsset,
    (value) => {
      notesPictureAsset = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeNotesPages",
    () => initializeNotesPages,
    (value) => {
      initializeNotesPages = value;
    },
  );
  return () => {
    notesPageExports = {} as NotesPageExports;
    (0, runtime.defineLiveExports)(notesPageExports, {
      planNotesPages: () => planNotesPages,
      placeNotesPages: () => placeNotesPages,
      paginateNotes: () => paginateNotes,
      notesPictureAssets: () => notesPictureAssets,
      notesPictureAsset: () => notesPictureAsset,
      notesPageSlides: () => notesPageSlides,
      NOTES_PAGE: () => NOTES_PAGE,
      NOTES_LINES_PER_PAGE: () => NOTES_LINES_PER_PAGE,
      NOTES_COLS_PER_LINE: () => NOTES_COLUMNS_PER_LINE,
    });
    notesGlyphWidth = (input) =>
      Array.from(input).reduce(
        (input2, options) =>
          input2 + (WIDE_GLYPH_PATTERN.test(options) ? 2 : 1),
        0,
      );
    notesPictureAsset = (slideId) => "notes-picture-" + slideId;
    initializeNotesPages = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      NOTES_PAGE = {
        margin: 64,
        pictureHeight: 432,
        gap: 40,
        fontPx: 26,
        lineHeight: 1.4,
        glyphEm: 0.55,
        maxPages: 8,
      };
      NOTES_TEXT_TOP =
        NOTES_PAGE.margin + NOTES_PAGE.pictureHeight + NOTES_PAGE.gap;
      NOTES_TEXT_HEIGHT =
        runtime.SLIDE_HEIGHT - NOTES_TEXT_TOP - NOTES_PAGE.margin;
      NOTES_TEXT_WIDTH = runtime.SLIDE_WIDTH - 2 * NOTES_PAGE.margin;
      NOTES_LINES_PER_PAGE = Math.floor(
        NOTES_TEXT_HEIGHT / (NOTES_PAGE.fontPx * NOTES_PAGE.lineHeight),
      );
      NOTES_COLUMNS_PER_LINE = Math.floor(
        NOTES_TEXT_WIDTH / (NOTES_PAGE.fontPx * NOTES_PAGE.glyphEm),
      );
      WIDE_GLYPH_PATTERN =
        /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u;
      NOTES_PICTURE_PLACEMENT = ((): NotesPicturePlacement => {
        let value = Math.round(
          (NOTES_PAGE.pictureHeight * runtime.SLIDE_WIDTH) /
            runtime.SLIDE_HEIGHT,
        );
        return {
          x: (runtime.SLIDE_WIDTH - value) / 2,
          y: NOTES_PAGE.margin,
          w: value,
          h: NOTES_PAGE.pictureHeight,
          scale: NOTES_PAGE.pictureHeight / runtime.SLIDE_HEIGHT,
        };
      })();
    });
  };
}
