/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  CompileDiagnostic,
  DeckContent,
  FontFace,
  HtmlCompileResult,
  ListRenderingMode,
  Slide,
  SlideId,
} from "../deck-contracts";
import type {
  RecordCodecComposed,
  SlideCodecCarry,
} from "../files/slide-codec";
import type { SerializedSlideRecord } from "../model/artifact-store-records";
import type { ArtifactState } from "./artifact-document";
import type { DocumentRecord, DocumentRecords } from "./json-records";

/** One slide the deck record lists, as the slide outline shows it while slides stream in. */
export interface SlideOutlineEntry {
  id: SlideId;
  /** The slide's record is present in the document. */
  here: boolean;
  /** The slide has been seen before in this session. */
  seenBefore: boolean;
}

/** The serialised record last made for a slide, with what it was made from. */
export interface DecomposedSlideRecord {
  theme: DeckContent["theme"];
  assets: DeckContent["assets"];
  inline: boolean;
  rec: SerializedSlideRecord;
}

/** The result of parsing one slide record: the slide, if one could be read, and what is wrong with it. */
export interface ParsedSlideRecord {
  slide: Slide | undefined;
  error?: string;
}

/** The record-level codec of a slide document. */
export interface SlideRecordCodec {
  /** The collections whose documents belong to the deck. */
  collections: string[];
  metaPath: string;
  decompose(
    envelope: ArtifactState<DeckContent>,
    previousRecords: ReadonlyMap<string, DocumentRecord> | undefined,
    carry: SlideCodecCarry | undefined,
  ): DocumentRecords;
  compose(
    records: ReadonlyMap<string, DocumentRecord>,
    carry: SlideCodecCarry | undefined,
  ): RecordCodecComposed;
  /** Why a record may not be synced, or undefined. */
  refuse(
    path: string,
    record: DocumentRecord,
    totalBytes: number,
  ): string | undefined;
}

export interface SlideDocumentCodecOptions {
  now?: () => number;
  /** Show no slides while the deck record says the deck moved elsewhere. */
  hideMovedDeck?: boolean;
}

/** A record codec together with what it learned from the records it composed. */
export interface SlideDocumentCodec {
  codec: SlideRecordCodec;
  /** Why the slide's HTML is held back, or undefined. */
  slideHtmlHold(slideId: SlideId): string | undefined;
  /** Slides listed by the deck record are still missing. */
  awaitingSlides(): boolean;
  awaitedSlideCount(): number;
  slideOutline(): SlideOutlineEntry[];
  hidingMovedDeck(): boolean;
  /** The deck record as last composed. */
  metaFields(): DocumentRecord | undefined;
  subscribeMeta(listener: () => void): () => void;
  reset(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    DECK_HTML_DOCUMENT_PATH: string;
    DECK_ASSETS_DOCUMENT_PATH: string;
    MAX_SYNC_DOCUMENT_BYTES: number;
    MAX_SYNC_TOTAL_BYTES: number;
    SYNC_RECORD_ID_PATTERN: RegExp;
    decomposedSlideRecordCache: WeakMap<Slide, DecomposedSlideRecord>;
    decomposedDeckMetaCache: WeakMap<FontFace, FontFace>;
    cachedDecomposeDeckMeta: (fontFace: FontFace) => FontFace;
    cachedDecomposeSlideHtml: (
      content: DeckContent,
      slide: Slide,
      inlineNotes: boolean,
    ) => SerializedSlideRecord;
    restoreDanglingSlideOrder: (
      order: SlideId[],
      carry: SlideCodecCarry | undefined,
    ) => SlideId[];
    reuseEqualDocumentRecord: (
      previousRecords: ReadonlyMap<string, DocumentRecord> | undefined,
      path: string,
      record: object,
    ) => DocumentRecord;
    offsetHtmlDiagnosticLines: (
      diagnostic: CompileDiagnostic,
      lineOffset: number,
    ) => string;
    optionalString: (input: unknown) => string | undefined;
    INVALID_FONT_PLACEHOLDER_DATA_URI: string;
    SLIDE_HTML_HOLD_TIMEOUT_MS: number;
    EMPTY_AWAITING_SLIDE_LIST: SlideOutlineEntry[];
    createSlideDocumentCodec: (
      options?: SlideDocumentCodecOptions,
    ) => SlideDocumentCodec;
    bytesToKilobytes: (bytes: number) => string;
    validateSyncDocumentSize: (
      path: string,
      record: DocumentRecord,
      totalBytes: number,
    ) => string | undefined;
    defaultSlideDocumentCodec: SlideDocumentCodec;
    slideDocumentCodec: SlideRecordCodec;
    slideHtmlHold: SlideDocumentCodec["slideHtmlHold"];
    awaitingSlideHtml: SlideDocumentCodec["awaitingSlides"];
    slideDocumentCodecByDocument: WeakMap<object, SlideDocumentCodec>;
    registerSlideDocumentCodec: (
      document: object,
      codec: SlideDocumentCodec,
    ) => void;
    getSlideDocumentCodec: (document: object) => SlideDocumentCodec;
  }
}

export function installDocumentsSlideCodec(
  runtime: RuntimeBindings,
): () => void {
  var DECK_HTML_DOCUMENT_PATH: string;
  var DECK_ASSETS_DOCUMENT_PATH: string;
  var MAX_SYNC_DOCUMENT_BYTES: number;
  var MAX_SYNC_TOTAL_BYTES: number;
  var SYNC_RECORD_ID_PATTERN: RegExp;
  var decomposedSlideRecordCache: WeakMap<Slide, DecomposedSlideRecord>;
  var decomposedDeckMetaCache: WeakMap<FontFace, FontFace>;
  var INVALID_FONT_PLACEHOLDER_DATA_URI: string;
  var SLIDE_HTML_HOLD_TIMEOUT_MS: number;
  var EMPTY_AWAITING_SLIDE_LIST: SlideOutlineEntry[];
  var bytesToKilobytes: (bytes: number) => string;
  var defaultSlideDocumentCodec: SlideDocumentCodec;
  var slideDocumentCodec: SlideRecordCodec;
  var slideHtmlHold: SlideDocumentCodec["slideHtmlHold"];
  var awaitingSlideHtml: SlideDocumentCodec["awaitingSlides"];
  var slideDocumentCodecByDocument: WeakMap<object, SlideDocumentCodec>;
  function cachedDecomposeDeckMeta(fontFace: FontFace): FontFace {
    let cached = decomposedDeckMetaCache.get(fontFace);
    if (cached === undefined) {
      decomposedDeckMetaCache.set(
        fontFace,
        (cached = (0, runtime.cloneFontFaceRecord)(fontFace)),
      );
    }
    return cached;
  }
  function cachedDecomposeSlideHtml(
    content: DeckContent,
    slide: Slide,
    inlineNotes: boolean,
  ): SerializedSlideRecord {
    let cached = decomposedSlideRecordCache.get(slide);
    if (
      cached !== undefined &&
      cached.theme === content.theme &&
      cached.assets === content.assets &&
      cached.inline === inlineNotes
    ) {
      return cached.rec;
    }
    let record = (0, runtime.serializedSlideRecord)(
      content,
      slide,
      inlineNotes,
    );
    decomposedSlideRecordCache.set(slide, {
      theme: content.theme,
      assets: content.assets,
      inline: inlineNotes,
      rec: record,
    });
    return record;
  }
  function restoreDanglingSlideOrder(
    order: SlideId[],
    carry: SlideCodecCarry | undefined,
  ): SlideId[] {
    let restoredOrder = [...order];
    for (let { id: value, after: value2 } of carry?.dangling ?? []) {
      if (restoredOrder.includes(value)) {
        continue;
      }
      let value3 = value2 === null ? -1 : restoredOrder.indexOf(value2);
      restoredOrder.splice(
        value2 === null ? 0 : value3 < 0 ? restoredOrder.length : value3 + 1,
        0,
        value,
      );
    }
    return restoredOrder;
  }
  function reuseEqualDocumentRecord(
    previousRecords: ReadonlyMap<string, DocumentRecord> | undefined,
    path: string,
    record: object,
  ): DocumentRecord {
    let prior = previousRecords?.get(path);
    if (
      prior !== undefined &&
      (prior === record || (0, runtime.documentRecordsEqual)(prior, record))
    ) {
      return prior;
    } else {
      return record as DocumentRecord;
    }
  }
  function offsetHtmlDiagnosticLines(
    diagnostic: CompileDiagnostic,
    lineOffset: number,
  ): string {
    let adjustLine = (input: number): number => Math.max(1, input - lineOffset),
      message = diagnostic.message
        .split('"')
        .map((input, options) =>
          options % 2 === 0
            ? input.replace(
                /\b(\d+):(\d+)\b/g,
                (input2: string, options2: string, context: string) =>
                  String(adjustLine(Number(options2))) + ":" + context,
              )
            : input,
        )
        .join('"');
    return (0, runtime.formatCompileDiagnostic)({
      line: adjustLine(diagnostic.line),
      col: diagnostic.col,
      message: message,
    });
  }
  function optionalString(input: unknown): string | undefined {
    if (typeof input === "string") {
      return input;
    } else {
      return undefined;
    }
  }
  function createSlideDocumentCodec(
    options: SlideDocumentCodecOptions = {},
  ): SlideDocumentCodec {
    let parsedSlideCache = new Map<string, ParsedSlideRecord>(),
      heldSlideHtml = new Map<SlideId, string>(),
      slideHtmlErrors = new Map<SlideId, string>(),
      hasMissingSlides = false,
      missingSlideCount = 0,
      outline = EMPTY_AWAITING_SLIDE_LIST,
      seenSlideIds = new Set<SlideId>(),
      assets: Record<string, string> = {},
      rawDeckMeta: DocumentRecord | undefined,
      hideMovedDeck = false,
      notesBySlide = new Map<SlideId, string>(),
      missingNotesSince = new Map<SlideId, number>(),
      notesStreamSettled = false,
      now = options.now ?? ((): number => Date.now()),
      hasShownSlides = false,
      awaitingSlides = new Set<() => void>();
    function decompose(
      input: ArtifactState<DeckContent>,
      options2: ReadonlyMap<string, DocumentRecord> | undefined,
      context: SlideCodecCarry | undefined,
    ): DocumentRecords {
      let content = input.content;
      assets = content.assets;
      let value = hideMovedDeck ? [] : content.order;
      if (value.length > 0) {
        hasShownSlides = true;
      }
      let entries: DocumentRecords = new Map();
      for (let value4 of (0, runtime.uniqueDeckFontFaces)(content))
        entries.set(
          runtime.FONT_STORE_COLLECTION +
            "/" +
            (0, runtime.fontStoreKey)(value4.family),
          reuseEqualDocumentRecord(
            options2,
            runtime.FONT_STORE_COLLECTION +
              "/" +
              (0, runtime.fontStoreKey)(value4.family),
            cachedDecomposeDeckMeta(value4),
          ),
        );
      let values = new Set<SlideId>(context?.inlineNotes);
      for (let value4 of value) {
        let value5 = content.slides[value4];
        if (value5 === undefined) {
          continue;
        }
        if (typeof value5.notes === "string") {
          notesBySlide.set(value4, value5.notes);
          missingNotesSince.delete(value4);
        } else if (notesStreamSettled && value5.notes === undefined) {
          notesBySlide.delete(value4);
        } else if (
          !notesStreamSettled &&
          value5.notes === undefined &&
          notesBySlide.has(value4) &&
          !missingNotesSince.has(value4)
        ) {
          missingNotesSince.set(value4, now());
        }
        let value6 = runtime.SLIDE_STORE_COLLECTION + "/" + value4,
          value7 = reuseEqualDocumentRecord(
            options2,
            value6,
            cachedDecomposeSlideHtml(content, value5, values.has(value4)),
          );
        if (slideHtmlErrors.has(value4)) {
          let entry = heldSlideHtml.get(value4);
          if (entry === undefined) {
            heldSlideHtml.set(value4, optionalString(value7.html) ?? "");
          } else if (entry !== value7.html) {
            let entries2 = new Map(slideHtmlErrors);
            entries2.delete(value4);
            slideHtmlErrors = entries2;
          }
        }
        entries.set(value6, value7);
      }
      (0, runtime.decomposeCommentDocuments)(input.comments, options2, entries);
      let value2 = restoreDanglingSlideOrder(value, context),
        value3 =
          (hideMovedDeck ? undefined : content.cover) ??
          (context?.cover !== undefined && value2.includes(context.cover)
            ? context.cover
            : undefined);
      entries.set(
        DECK_HTML_DOCUMENT_PATH,
        reuseEqualDocumentRecord(
          options2,
          DECK_HTML_DOCUMENT_PATH,
          (0, runtime.legacyDeckMetadata)(
            input.title,
            value2,
            content.sections,
            value3,
          ),
        ),
      );
      return entries;
    }
    function parseSlideRecord(
      input: string,
      options2: string,
      context: number,
      value: SlideId,
      extra: string,
      detail: Map<string, ParsedSlideRecord>,
      argument: ListRenderingMode | undefined,
    ): ParsedSlideRecord {
      let value2 =
          (argument ?? "") +
          "\x00" +
          value +
          "\x00" +
          options2 +
          "\x00" +
          extra,
        value3 = parsedSlideCache.get(value2) ?? detail.get(value2);
      if (value3 === undefined) {
        let value4 =
            `<!doctype html><html>
` +
            input +
            `<body>
`,
          value5: HtmlCompileResult = (0, runtime.compileSlideHtml)(
            value4 +
              extra +
              `
</body></html>`,
            {
              sectionId: value,
              ...(argument !== undefined
                ? {
                    lists: argument,
                  }
                : {}),
            },
          ),
          value6 =
            value4.split(`
`).length - 1,
          value7 = Array.isArray(value5.content.order)
            ? value5.content.order
            : [],
          value8 = value5.content.slides ?? {},
          value9 = Object.hasOwn(value8, value) ? value8[value] : undefined,
          value10: string | undefined =
            value5.errors[0] !== undefined
              ? offsetHtmlDiagnosticLines(value5.errors[0], value6)
              : undefined;
        if (value10 === undefined && value7.length !== 1) {
          value10 =
            "a slide record holds exactly one <section> (found " +
            String(value7.length) +
            ")";
        }
        let value11 =
          (Array.isArray(value5.content.faces)
            ? value5.content.faces.length
            : 0) - context;
        if (
          value10 === undefined &&
          (value5.hoisted > 0 || value5.title !== undefined || value11 > 0)
        ) {
          value10 =
            "a slide record may not carry <title>, <link> or <style> (typefaces are fonts/<family> documents)";
        }
        value3 = {
          slide: value9,
          ...(value10 !== undefined
            ? {
                error: value10,
              }
            : {}),
        };
      }
      detail.set(value2, value3);
      return value3;
    }
    function compose(
      input: ReadonlyMap<string, DocumentRecord>,
      options2: SlideCodecCarry | undefined,
    ): RecordCodecComposed {
      let entry = input.get(DECK_HTML_DOCUMENT_PATH);
      rawDeckMeta = entry;
      (0, runtime.publishDesignSystems)(input.get(DECK_ASSETS_DOCUMENT_PATH));
      let items: SlideId[] = [],
        items2: { id: SlideId; after: SlideId | null }[] = [],
        items3: string[] = [],
        items4: SlideOutlineEntry[] = [],
        index = 0,
        value: SlideId | null = null,
        value2 =
          options.hideMovedDeck === true &&
          !hasShownSlides &&
          (0, runtime.readMovedToMarker)(entry) !== null;
      hideMovedDeck = value2;
      for (let value12 of (Array.isArray(entry?.order)
        ? entry.order
        : []) as unknown[]) {
        if (
          typeof value12 !== "string" ||
          items.includes(value12) ||
          items2.some((input2) => input2.id === value12)
        ) {
          continue;
        }
        if (value2) {
          items2.push({
            id: value12,
            after: value,
          });
        } else if (
          !SYNC_RECORD_ID_PATTERN.test(value12) ||
          items.length >= runtime.maxDeckSlides
        ) {
          items2.push({
            id: value12,
            after: value,
          });
          index += 1;
        } else if (!input.has(runtime.SLIDE_STORE_COLLECTION + "/" + value12)) {
          items2.push({
            id: value12,
            after: value,
          });
          items3.push(runtime.SLIDE_STORE_COLLECTION + "/" + value12);
          if (items4.length < runtime.maxDeckSlides) {
            items4.push({
              id: value12,
              here: false,
              seenBefore: seenSlideIds.has(value12),
            });
          }
        } else if (
          (items.push(value12), items4.length < runtime.maxDeckSlides)
        ) {
          items4.push({
            id: value12,
            here: true,
            seenBefore: seenSlideIds.has(value12),
          });
        }
        value = value12;
      }
      outline = items4;
      if (index > 0) {
        console.warn(
          "slides: " +
            String(index) +
            " order entr" +
            (index === 1 ? "y" : "ies") +
            " not shown (id outside [A-Za-z0-9_-]{1,64} or past " +
            String(runtime.maxDeckSlides) +
            " slides); kept in the order",
        );
      }
      let entries = new Map<string, DocumentRecord>();
      for (let [value12, value13] of [...input]
        .filter(([input2]) =>
          input2.startsWith(runtime.FONT_STORE_COLLECTION + "/"),
        )
        .sort(([input2], [options3]) => (input2 < options3 ? -1 : 1))) {
        if (typeof value13.family !== "string") {
          continue;
        }
        let value14 = (0, runtime.fontStoreKey)(value13.family);
        if (
          !entries.has(value14) ||
          (0, runtime.basenameDocumentPath)(value12) === value14
        ) {
          entries.set(value14, value13);
        }
      }
      let value3 = [...entries]
          .sort(([input2], [options3]) => (input2 < options3 ? -1 : 1))
          .map(([, input2]) => input2),
        value4 = (0, runtime.normalizeFontFaces)(value3),
        value5 = (value4 ?? []).map((input2) => input2.family),
        value6 = (0, runtime.serializeDeckHead)(
          value5.length > 0
            ? {
                faces: value5.map((input2) => ({
                  family: input2,
                  src: INVALID_FONT_PLACEHOLDER_DATA_URI,
                })),
              }
            : {},
          "",
        ),
        value7: Record<SlideId, Partial<Slide>> = Object.create(null),
        items5: SlideId[] = [],
        entries2 = new Map<SlideId, string>(),
        entries3 = new Map<string, ParsedSlideRecord>(),
        value8 = (0, runtime.readMovedToMarker)(entry) !== null;
      notesStreamSettled = value8;
      let value9 = (0, runtime.normalizeListRenderingMode)(entry?.lists);
      items.forEach((input2) => {
        seenSlideIds.add(input2);
        let entry2 = input.get(
            runtime.SLIDE_STORE_COLLECTION + "/" + input2,
          )!,
          value12 = optionalString(entry2.html),
          value13 =
            value12 !== undefined
              ? parseSlideRecord(
                  value6,
                  value5.join("\x01"),
                  value5.length,
                  input2,
                  value12,
                  entries3,
                  value9,
                )
              : undefined,
          value14 = optionalString(entry2.notes),
          value15 = value13?.slide?.notes,
          value16 =
            value14 ?? (typeof value15 === "string" ? value15 : undefined);
        if (value16 !== undefined) {
          notesBySlide.set(input2, value16);
          missingNotesSince.delete(input2);
        } else if (!value8) {
          if (notesBySlide.has(input2) && !missingNotesSince.has(input2)) {
            missingNotesSince.set(input2, now());
          }
        } else {
          if (missingNotesSince.has(input2)) {
            if (
              now() - missingNotesSince.get(input2)! >
              SLIDE_HTML_HOLD_TIMEOUT_MS
            ) {
              notesBySlide.delete(input2);
            }
            missingNotesSince.delete(input2);
          }
          value14 = notesBySlide.get(input2);
        }
        if (value13?.slide === undefined) {
          entries2.set(
            input2,
            value12 === undefined
              ? "the record has no html string"
              : (value13?.error ?? "no readable <section>"),
          );
          value7[input2] = {
            v: 1,
            id: input2,
            bg: "#ffffff",
            ...(value14 !== undefined
              ? {
                  notes: value14,
                }
              : {}),
          };
          return;
        }
        if (value14 !== undefined) {
          value7[input2] = {
            ...value13.slide,
            notes: value14,
          };
        } else if (
          ((value7[input2] = value13.slide), value13.slide.notes !== undefined)
        ) {
          items5.push(input2);
        }
        if (value13.error !== undefined) {
          entries2.set(input2, value13.error);
        }
      });
      parsedSlideCache = entries3;
      slideHtmlErrors = entries2;
      hasMissingSlides = items3.length > 0;
      missingSlideCount = items3.filter(
        (input2) =>
          !seenSlideIds.has((0, runtime.basenameDocumentPath)(input2)),
      ).length;
      heldSlideHtml = new Map();
      for (let value12 of [...awaitingSlides]) queueMicrotask(value12);
      let value10 = optionalString(entry?.cover),
        value11 =
          value10 !== undefined &&
          items2.some((input2) => input2.id === value10)
            ? value10
            : undefined;
      return {
        title: optionalString(entry?.title) ?? "",
        content: {
          theme: "neutral",
          format: "html",
          ...(value10 !== undefined && items.includes(value10)
            ? {
                cover: value10,
              }
            : {}),
          order: items,
          slides: value7,
          assets: assets,
          ...(value4 !== undefined
            ? {
                faces: value3,
              }
            : {}),
          ...(entry !== undefined &&
          typeof entry.sections === "object" &&
          entry.sections !== null &&
          !Array.isArray(entry.sections)
            ? {
                sections: entry.sections,
              }
            : {}),
          ...(value9 !== undefined
            ? {
                lists: value9,
              }
            : {}),
        },
        comments: (0, runtime.composeCommentDocuments)(input),
        carry: {
          dangling: items2,
          inlineNotes: items5,
          ...(value11 !== undefined
            ? {
                cover: value11,
              }
            : {}),
        },
        dangling: items3,
      };
    }
    return {
      codec: {
        collections: [
          runtime.FONT_STORE_COLLECTION,
          runtime.SLIDE_STORE_COLLECTION,
          "comments",
          "deck",
        ],
        metaPath: DECK_HTML_DOCUMENT_PATH,
        decompose: decompose,
        compose: compose,
        refuse: validateSyncDocumentSize,
      },
      slideHtmlHold: (input) => slideHtmlErrors.get(input),
      awaitingSlides: () => hasMissingSlides,
      awaitedSlideCount: () => missingSlideCount,
      slideOutline: () => outline,
      hidingMovedDeck: () => hideMovedDeck,
      metaFields: () => rawDeckMeta,
      subscribeMeta(input) {
        awaitingSlides.add(input);
        return () => void awaitingSlides.delete(input);
      },
      reset() {
        rawDeckMeta = undefined;
        hasShownSlides = false;
        hideMovedDeck = false;
        notesBySlide.clear();
        missingNotesSince.clear();
        notesStreamSettled = false;
        parsedSlideCache = new Map();
        slideHtmlErrors = new Map();
        hasMissingSlides = false;
        missingSlideCount = 0;
        outline = EMPTY_AWAITING_SLIDE_LIST;
        seenSlideIds.clear();
        heldSlideHtml = new Map();
        assets = {};
      },
    };
  }
  function validateSyncDocumentSize(
    path: string,
    record: DocumentRecord,
    totalBytes: number,
  ): string | undefined {
    let bytes = (0, runtime.estimateEmbeddedJsonBytes)(record);
    if (bytes > MAX_SYNC_DOCUMENT_BYTES) {
      if (path.startsWith(runtime.SLIDE_STORE_COLLECTION + "/")) {
        return (
          "Slide “" +
          (0, runtime.basenameDocumentPath)(path) +
          "” is too large to sync (" +
          bytesToKilobytes(bytes) +
          " KB > 240 KB). Drop images onto the slide so they upload as assets, or move some content to another slide."
        );
      }
      if (path.startsWith(runtime.FONT_STORE_COLLECTION + "/")) {
        return (
          "The typeface “" +
          (optionalString(record.family) ??
            (0, runtime.basenameDocumentPath)(path)) +
          "” is too large to sync (" +
          bytesToKilobytes(bytes) +
          " KB > 240 KB). Link it from Google Fonts or embed a smaller file."
        );
      }
      return (
        "A change is too large to sync (" + bytesToKilobytes(bytes) + " KB)."
      );
    }
    if (totalBytes > MAX_SYNC_TOTAL_BYTES) {
      let value = path.slice(0, path.indexOf("/"));
      if (value === runtime.SLIDE_STORE_COLLECTION) {
        return "This presentation’s slides are over the 2 MB live-sync budget. Drop images onto slides so they upload as assets, or split the presentation.";
      } else {
        return (
          "This presentation’s " +
          (value === runtime.FONT_STORE_COLLECTION
            ? "typefaces"
            : value === "deck"
              ? "metadata documents"
              : value) +
          " are over the 2 MB live-sync budget."
        );
      }
    }
    return;
  }
  function registerSlideDocumentCodec(
    document2: object,
    codec: SlideDocumentCodec,
  ): void {
    slideDocumentCodecByDocument.set(document2, codec);
  }
  function getSlideDocumentCodec(document2: object): SlideDocumentCodec {
    return (
      slideDocumentCodecByDocument.get(document2) ?? defaultSlideDocumentCodec
    );
  }
  bindRuntimeValue(
    runtime,
    "DECK_HTML_DOCUMENT_PATH",
    () => DECK_HTML_DOCUMENT_PATH,
    (value) => {
      DECK_HTML_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DECK_ASSETS_DOCUMENT_PATH",
    () => DECK_ASSETS_DOCUMENT_PATH,
    (value) => {
      DECK_ASSETS_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SYNC_DOCUMENT_BYTES",
    () => MAX_SYNC_DOCUMENT_BYTES,
    (value) => {
      MAX_SYNC_DOCUMENT_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SYNC_TOTAL_BYTES",
    () => MAX_SYNC_TOTAL_BYTES,
    (value) => {
      MAX_SYNC_TOTAL_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYNC_RECORD_ID_PATTERN",
    () => SYNC_RECORD_ID_PATTERN,
    (value) => {
      SYNC_RECORD_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decomposedSlideRecordCache",
    () => decomposedSlideRecordCache,
    (value) => {
      decomposedSlideRecordCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decomposedDeckMetaCache",
    () => decomposedDeckMetaCache,
    (value) => {
      decomposedDeckMetaCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedDecomposeDeckMeta",
    () => cachedDecomposeDeckMeta,
  );
  bindRuntimeValue(
    runtime,
    "cachedDecomposeSlideHtml",
    () => cachedDecomposeSlideHtml,
  );
  bindRuntimeValue(
    runtime,
    "restoreDanglingSlideOrder",
    () => restoreDanglingSlideOrder,
  );
  bindRuntimeValue(
    runtime,
    "reuseEqualDocumentRecord",
    () => reuseEqualDocumentRecord,
  );
  bindRuntimeValue(
    runtime,
    "offsetHtmlDiagnosticLines",
    () => offsetHtmlDiagnosticLines,
  );
  bindRuntimeValue(runtime, "optionalString", () => optionalString);
  bindRuntimeValue(
    runtime,
    "INVALID_FONT_PLACEHOLDER_DATA_URI",
    () => INVALID_FONT_PLACEHOLDER_DATA_URI,
    (value) => {
      INVALID_FONT_PLACEHOLDER_DATA_URI = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_HTML_HOLD_TIMEOUT_MS",
    () => SLIDE_HTML_HOLD_TIMEOUT_MS,
    (value) => {
      SLIDE_HTML_HOLD_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_AWAITING_SLIDE_LIST",
    () => EMPTY_AWAITING_SLIDE_LIST,
    (value) => {
      EMPTY_AWAITING_SLIDE_LIST = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSlideDocumentCodec",
    () => createSlideDocumentCodec,
  );
  bindRuntimeValue(
    runtime,
    "bytesToKilobytes",
    () => bytesToKilobytes,
    (value) => {
      bytesToKilobytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateSyncDocumentSize",
    () => validateSyncDocumentSize,
  );
  bindRuntimeValue(
    runtime,
    "defaultSlideDocumentCodec",
    () => defaultSlideDocumentCodec,
    (value) => {
      defaultSlideDocumentCodec = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideDocumentCodec",
    () => slideDocumentCodec,
    (value) => {
      slideDocumentCodec = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideHtmlHold",
    () => slideHtmlHold,
    (value) => {
      slideHtmlHold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "awaitingSlideHtml",
    () => awaitingSlideHtml,
    (value) => {
      awaitingSlideHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideDocumentCodecByDocument",
    () => slideDocumentCodecByDocument,
    (value) => {
      slideDocumentCodecByDocument = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerSlideDocumentCodec",
    () => registerSlideDocumentCodec,
  );
  bindRuntimeValue(
    runtime,
    "getSlideDocumentCodec",
    () => getSlideDocumentCodec,
  );
  return () => {
    (0, runtime.initializeDesignTokenParser)();
    (0, runtime.initializeDesignSystemsStore)();
    (0, runtime.initializeHtmlWriter)();
    (0, runtime.initializeHtmlCompiler)();
    (0, runtime.initializeSlideModel)();
    DECK_HTML_DOCUMENT_PATH =
      runtime.DECK_STORE_COLLECTION + "/" + runtime.DECK_META_STORE_KEY;
    DECK_ASSETS_DOCUMENT_PATH =
      runtime.DECK_STORE_COLLECTION + "/" + runtime.designSystemsCapabilityName;
    MAX_SYNC_DOCUMENT_BYTES = runtime.maxDeckFontCssBytes;
    MAX_SYNC_TOTAL_BYTES = runtime.maxDeckAssetBytes;
    SYNC_RECORD_ID_PATTERN = /^[\w-]{1,64}$/;
    decomposedSlideRecordCache = new WeakMap();
    decomposedDeckMetaCache = new WeakMap();
    INVALID_FONT_PLACEHOLDER_DATA_URI = "data:font/woff2;base64,AAAA";
    SLIDE_HTML_HOLD_TIMEOUT_MS = 60000;
    EMPTY_AWAITING_SLIDE_LIST = [];
    bytesToKilobytes = (input) => String(Math.ceil(input / 1024));
    defaultSlideDocumentCodec = createSlideDocumentCodec();
    slideDocumentCodec = defaultSlideDocumentCodec.codec;
    slideHtmlHold = defaultSlideDocumentCodec.slideHtmlHold;
    awaitingSlideHtml = defaultSlideDocumentCodec.awaitingSlides;
    slideDocumentCodecByDocument = new WeakMap();
  };
}
