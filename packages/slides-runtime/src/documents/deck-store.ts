/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  DeckContent,
  DeckSection,
  FontFace,
  HtmlCompileResult,
  NormalizationDiagnostics,
  Slide,
  SlideId,
  ThemeFonts,
} from "../deck-contracts";
import type {
  ArtifactContentCodec,
  ArtifactDocument,
  ArtifactDocumentEnvironment,
} from "./artifact-document";
import type { LimboSlide } from "./removed-slides";

/** Order and sections of a deck: the part of the content that structural edits replace. */
export interface DeckOrderAndSections {
  order: SlideId[];
  sections?: DeckSection[];
}

/** What the deck store records while normalising and compiling the document it loaded. */
export interface SlidesBootReport extends NormalizationDiagnostics {
  /** Structural errors found when compiling the deck's HTML. */
  htmlErrors?: number;
  htmlWarnings?: number;
  /** The first error, formatted for display. */
  htmlErrorSample?: string;
}

/** The codec that turns a stored presentation into deck content and back. */
export interface SlidesArtifactDocumentOptions
  extends ArtifactContentCodec<DeckContent> {
  serializeContent(content: DeckContent, title: string): unknown;
  contentHold(rawContent: unknown): string | undefined;
  defaultTitle: string;
}

/** Builds the document a store edits instead of the default embedded one. */
export type SlidesArtifactDocumentFactory = (
  options: SlidesArtifactDocumentOptions,
) => ArtifactDocument<DeckContent> | undefined;

/** Order and sections as they were before a structural edit and after it; used to undo section changes. */
export interface SectionsUndoMark {
  sections?: DeckSection[];
  after?: DeckSection[];
  sealed?: boolean;
}

/** The slides, order, assets and theme settings a view renders from. */
export interface DeckSnapshot {
  meta: {
    v: 1;
    title: string;
    theme: DeckContent["theme"];
    order: SlideId[];
  };
  /** The slides in order. */
  slides: Slide[];
  /** The slides typography inference was last based on. */
  baseline: Slide[];
  assets: Map<string, string>;
  fonts?: ThemeFonts;
  faces?: FontFace[];
  format?: DeckContent["format"];
  sections?: DeckSection[];
  cover?: SlideId;
}

/** The deck store: edits to the deck content, each applied to the underlying document. */
export interface SlidesDocumentStoreInstance {
  doc: ArtifactDocument<DeckContent>;
  bootReport: SlidesBootReport;
  getSnapshot(): DeckSnapshot;
  subscribe(listener: () => void): () => boolean;
  content(): DeckContent;
  getSlide(slideId: SlideId): Slide | undefined;
  setSlide(slide: Slide): void;
  updateSlide(slideId: SlideId, update: (slide: Slide) => Slide): void;
  setFaces(faces: FontFace[] | undefined): void;
  insertSlide(
    slide: Slide,
    index: number,
    options?: { joinTop?: boolean },
  ): void;
  removeSlide(slideId: SlideId): void;
  removeSlideKeepAssets(slideId: SlideId): void;
  setCover(slideId: SlideId | undefined): void;
  moveSlide(
    slideId: SlideId,
    index: number,
    options?: { joinTop?: boolean },
  ): void;
  snapshotAssetsFor(slideId: SlideId): Record<string, string>;
  restoreSlide(
    slide: Slide,
    index: number,
    assets: Record<string, string>,
  ): void;
  insertSlides(
    slides: Slide[],
    arrange: (content: DeckContent) => DeckOrderAndSections | undefined,
  ): boolean;
  applyStructure(
    compute: (content: DeckContent) => DeckOrderAndSections | undefined,
  ): boolean;
  sectionsSnapshot(): SectionsUndoMark;
  arm(mark: SectionsUndoMark): SectionsUndoMark;
  restoreSections(mark: SectionsUndoMark): void;
  forgetParked(slideIds: SlideId[]): void;
  prepareAsset(src: string): string;
  setAssetEntry(assetId: string, value: string): void;
  removeAssetEntry(assetId: string): void;
  getAsset(assetId: string): string | undefined;
}

export interface SlidesDocumentStoreConstructor {
  new (
    doc?: ArtifactDocument<DeckContent>,
    now?: () => number,
  ): SlidesDocumentStoreInstance;
}

declare module "../bindings" {
  interface RuntimeBindings {
    deckOrderAndSections: (content: DeckOrderAndSections) => DeckOrderAndSections;
    buildDeckExportContent: (
      content: DeckContent,
      orderState: DeckOrderAndSections,
    ) => DeckContent;
    jsonValuesEqual: (left: unknown, right: unknown) => boolean;
    moveSectionStartBeforeInsertedSlide: (
      sections: DeckSection[] | undefined,
      order: SlideId[],
      insertedId: SlideId,
    ) => DeckSection[] | undefined;
    removeDeckCoverIfMatches: (
      content: DeckContent,
      slideId: SlideId,
    ) => DeckContent;
    setDeckSections: (
      content: DeckContent,
      sections: DeckSection[] | undefined,
    ) => DeckContent;
    artifactDocumentOptions: ArtifactDocumentEnvironment;
    configureArtifactDocument: (options: ArtifactDocumentEnvironment) => void;
    artifactDocumentFactory: SlidesArtifactDocumentFactory | undefined;
    configureArtifactDocumentFactory: (
      factory: SlidesArtifactDocumentFactory | undefined,
    ) => void;
    createSlidesArtifactDocumentOptions: (
      bootReport?: SlidesBootReport,
    ) => SlidesArtifactDocumentOptions;
    describeInvalidDeckHtml: (content: unknown) => string | undefined;
    SlidesDocumentStore: SlidesDocumentStoreConstructor;
  }
}

export function installDocumentsDeckStore(
  runtime: RuntimeBindings,
): () => void {
  var artifactDocumentOptions: ArtifactDocumentEnvironment;
  var artifactDocumentFactory: SlidesArtifactDocumentFactory | undefined;
  var SlidesDocumentStore: SlidesDocumentStoreConstructor;
  function deckOrderAndSections(
    content: DeckOrderAndSections,
  ): DeckOrderAndSections {
    return {
      order: content.order,
      ...(content.sections !== undefined
        ? {
            sections: content.sections,
          }
        : {}),
    };
  }
  function buildDeckExportContent(
    content: DeckContent,
    orderState: DeckOrderAndSections,
  ): DeckContent {
    return {
      theme: content.theme,
      ...(content.format !== undefined
        ? {
            format: content.format,
          }
        : {}),
      ...(orderState.sections !== undefined
        ? {
            sections: orderState.sections,
          }
        : {}),
      ...(content.cover !== undefined &&
      orderState.order.includes(content.cover)
        ? {
            cover: content.cover,
          }
        : {}),
      order: orderState.order,
      slides: content.slides,
      assets: content.assets,
      ...(content.fonts !== undefined
        ? {
            fonts: content.fonts,
          }
        : {}),
      ...(content.faces !== undefined
        ? {
            faces: content.faces,
          }
        : {}),
      ...(content.lists !== undefined
        ? {
            lists: content.lists,
          }
        : {}),
    };
  }
  function jsonValuesEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  function moveSectionStartBeforeInsertedSlide(
    sections: DeckSection[] | undefined,
    order: SlideId[],
    insertedId: SlideId,
  ): DeckSection[] | undefined {
    if (
      sections === undefined ||
      order[0] !== insertedId ||
      order[1] === undefined
    ) {
      return sections;
    }
    if (
      sections.some((input) => input.start === insertedId) ||
      !sections.some((input) => input.start === order[1])
    ) {
      return sections;
    }
    return sections.map((input) =>
      input.start === order[1]
        ? {
            ...input,
            start: insertedId,
          }
        : input,
    );
  }
  function removeDeckCoverIfMatches(
    content: DeckContent,
    slideId: SlideId,
  ): DeckContent {
    if (content.cover !== slideId) {
      return content;
    }
    let { cover: cover, ...value } = content;
    return value;
  }
  function setDeckSections(
    content: DeckContent,
    sections: DeckSection[] | undefined,
  ): DeckContent {
    if (sections === content.sections) {
      return content;
    }
    let state: DeckContent = {
      ...content,
    };
    if (sections === undefined) {
      delete state.sections;
    } else {
      state.sections = sections;
    }
    return state;
  }
  function configureArtifactDocument(
    options: ArtifactDocumentEnvironment,
  ): void {
    artifactDocumentOptions = options;
  }
  function configureArtifactDocumentFactory(
    factory: SlidesArtifactDocumentFactory | undefined,
  ): void {
    artifactDocumentFactory = factory;
  }
  function createSlidesArtifactDocumentOptions(
    bootReport?: SlidesBootReport,
  ): SlidesArtifactDocumentOptions {
    return {
      parseContent: (input: unknown): DeckContent => {
        if (!(0, runtime.looksLikeSlideHtml)(input)) {
          return (0, runtime.normalizeDeck)(input, bootReport);
        }
        let value = (0, runtime.compileSlideHtml)(input);
        if (bootReport) {
          bootReport.htmlErrors = value.errors.length;
          bootReport.htmlWarnings =
            value.warnings.length + value.unsupported.length;
          if (value.errors[0] !== undefined) {
            bootReport.htmlErrorSample = (0, runtime.formatCompileDiagnostic)(
              value.errors[0],
            );
          }
        }
        return (0, runtime.normalizeDeck)(value.content, bootReport);
      },
      serializeContent: (input: DeckContent, options: string): unknown =>
        input.format === "html"
          ? (0, runtime.serializeDeckHtml)(input, options)
          : input,
      contentHold: describeInvalidDeckHtml,
      initialContent: (0, runtime.normalizeDeck)({
        format: "html",
        theme: "neutral",
        order: [],
        slides: {},
      }),
      defaultTitle: "Untitled",
    };
  }
  function describeInvalidDeckHtml(content: unknown): string | undefined {
    if (!(0, runtime.looksLikeSlideHtml)(content)) {
      return;
    }
    let parsed: HtmlCompileResult = (0, runtime.compileSlideHtml)(content);
    if (parsed.errors.length === 0) {
      return;
    }
    return (
      "This presentation’s HTML has " +
      String(parsed.errors.length) +
      " structural error" +
      (parsed.errors.length === 1 ? "" : "s") +
      " (first: " +
      (0, runtime.formatCompileDiagnostic)(parsed.errors[0]) +
      "). It is shown best-effort and cannot be saved from here — fix the source and rebuild."
    );
  }
  bindRuntimeValue(runtime, "deckOrderAndSections", () => deckOrderAndSections);
  bindRuntimeValue(
    runtime,
    "buildDeckExportContent",
    () => buildDeckExportContent,
  );
  bindRuntimeValue(runtime, "jsonValuesEqual", () => jsonValuesEqual);
  bindRuntimeValue(
    runtime,
    "moveSectionStartBeforeInsertedSlide",
    () => moveSectionStartBeforeInsertedSlide,
  );
  bindRuntimeValue(
    runtime,
    "removeDeckCoverIfMatches",
    () => removeDeckCoverIfMatches,
  );
  bindRuntimeValue(runtime, "setDeckSections", () => setDeckSections);
  bindRuntimeValue(
    runtime,
    "artifactDocumentOptions",
    () => artifactDocumentOptions,
    (value) => {
      artifactDocumentOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "configureArtifactDocument",
    () => configureArtifactDocument,
  );
  bindRuntimeValue(
    runtime,
    "artifactDocumentFactory",
    () => artifactDocumentFactory,
    (value) => {
      artifactDocumentFactory = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "configureArtifactDocumentFactory",
    () => configureArtifactDocumentFactory,
  );
  bindRuntimeValue(
    runtime,
    "createSlidesArtifactDocumentOptions",
    () => createSlidesArtifactDocumentOptions,
  );
  bindRuntimeValue(
    runtime,
    "describeInvalidDeckHtml",
    () => describeInvalidDeckHtml,
  );
  bindRuntimeValue(
    runtime,
    "SlidesDocumentStore",
    () => SlidesDocumentStore,
    (value) => {
      SlidesDocumentStore = value;
    },
  );
  return () => {
    (0, runtime.initializeHtmlCompiler)();
    (0, runtime.initializeHtmlWriter)();
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeTypographyInference)();
    artifactDocumentOptions = {};
    SlidesDocumentStore = class SlidesDocumentStore
      implements SlidesDocumentStoreInstance
    {
      doc: ArtifactDocument<DeckContent>;
      bootReport = {
        droppedStyles: 0,
      } as SlidesBootReport;
      listeners = new Set<() => void>();
      snapshot: DeckSnapshot;
      added = new Map<SlideId, number>();
      limbo: LimboSlide[] = [];
      awaited = false;
      now: () => number;
      constructor(
        input?: ArtifactDocument<DeckContent>,
        options: () => number = Date.now,
      ) {
        this.now = options;
        this.doc =
          input ??
          artifactDocumentFactory?.(
            createSlidesArtifactDocumentOptions(this.bootReport),
          ) ??
          (0, runtime.createArtifactDocument)({
            ...createSlidesArtifactDocumentOptions(this.bootReport),
            ...artifactDocumentOptions,
          });
        this.snapshot = this.buildSnapshot();
        this.doc.subscribe((input2) => this.bump(input2?.remote === true));
      }
      getSnapshot(): DeckSnapshot {
        return this.snapshot;
      }
      subscribe(input: () => void): () => boolean {
        this.listeners.add(input);
        return () => this.listeners.delete(input);
      }
      content(): DeckContent {
        return this.doc.content();
      }
      buildSnapshot(input: boolean = true): DeckSnapshot {
        let value = this.content();
        (0, runtime.setRenderingTheme)(value.theme);
        let items: Slide[] = [];
        for (let value2 of value.order) {
          let value3 = value.slides[value2];
          if (value3) {
            items.push(value3);
          }
        }
        return {
          meta: {
            v: 1,
            title: this.doc.title(),
            theme: value.theme,
            order: value.order,
          },
          slides: items,
          baseline: this.nextBaseline(items, value.theme, input),
          assets: new Map(Object.entries(value.assets)),
          ...(value.fonts !== undefined
            ? {
                fonts: value.fonts,
              }
            : {}),
          ...(value.faces !== undefined
            ? {
                faces: value.faces,
              }
            : {}),
          ...(value.format !== undefined
            ? {
                format: value.format,
              }
            : {}),
          ...(value.sections !== undefined
            ? {
                sections: value.sections,
              }
            : {}),
          ...(value.cover !== undefined
            ? {
                cover: value.cover,
              }
            : {}),
        };
      }
      nextBaseline(
        input: Slide[],
        options: DeckContent["theme"],
        context: boolean,
      ): Slide[] {
        let snapshot = this.snapshot;
        if (snapshot === undefined) {
          return input;
        }
        if (!context) {
          return snapshot.baseline;
        }
        let callback = (input2: Slide[]) =>
          (0, runtime.typographyStylesSignature)(
            (0, runtime.inferDeckTypographyStyles)(input2, options),
            options,
          );
        if (callback(input) === callback(snapshot.slides)) {
          return snapshot.baseline;
        } else {
          return input;
        }
      }
      bump(input: boolean = false): void {
        let snapshot = this.snapshot;
        this.snapshot = this.buildSnapshot(input);
        if (input && this.putBackAdded(snapshot)) {
          return;
        }
        for (let value of this.listeners) value();
      }
      putBackAdded(input: DeckSnapshot): boolean {
        let awaited = this.awaited;
        this.awaited = (0, runtime.getSlideDocumentCodec)(
          this.doc,
        ).awaitingSlides();
        if (this.added.size === 0 || this.doc.readOnly()) {
          return false;
        }
        let value = (0, runtime.preserveRecentlyRemovedSlides)({
          added: this.added,
          now: this.now(),
          before: {
            order: input.meta.order,
            slides: input.slides,
          },
          order: this.snapshot.meta.order,
          awaiting: this.awaited,
          wasAwaiting: awaited,
          limbo: this.limbo,
        });
        this.limbo = value.limbo;
        if (value.back.length === 0) {
          return false;
        }
        let snapshot = this.snapshot;
        this.doc.updateContent(
          (input2) => {
            let value2 = value.back
              .filter((input3) => !input2.order.includes(input3.id))
              .slice(
                0,
                Math.max(0, runtime.maxDeckSlides - input2.order.length),
              );
            if (value2.length === 0) {
              return input2;
            }
            for (let value3 of value2) this.added.delete(value3.id);
            return {
              ...input2,
              order: [
                ...input2.order,
                ...value2.map((input3) => input3.id),
              ],
              slides: {
                ...input2.slides,
                ...Object.fromEntries(
                  value2.map((input3) => [
                    input3.id,
                    (0, runtime.setDeckListStyle)(input3, input2.lists),
                  ]),
                ),
              },
            };
          },
          {
            auto: true,
          },
        );
        if (this.snapshot === snapshot) {
          return false;
        }
        queueMicrotask(() => void this.doc.save());
        return true;
      }
      forgetParked(input: SlideId[]): void {
        this.limbo = this.limbo.filter(
          (input2) => !input.includes(input2.slide.id),
        );
      }
      getSlide(input: SlideId): Slide | undefined {
        return this.content().slides[input];
      }
      setSlide(input: Slide): void {
        if (!Object.hasOwn(this.content().slides, input.id)) {
          return;
        }
        this.doc.updateContent((input2) => ({
          ...input2,
          slides: {
            ...input2.slides,
            [input.id]: (0, runtime.setDeckListStyle)(input, input2.lists),
          },
        }));
      }
      updateSlide(input: SlideId, options: (slide: Slide) => Slide): void {
        let value = this.getSlide(input);
        if (value) {
          this.setSlide(options(value));
        }
      }
      setFaces(items: FontFace[] | undefined): void {
        this.doc.updateContent((input) => {
          let { faces: value, ...value2 } = input;
          if (items !== undefined && items.length > 0) {
            return {
              ...value2,
              faces: [...items],
            };
          } else {
            return value2;
          }
        });
      }
      insertSlide(
        input: Slide,
        options: number,
        context: { joinTop?: boolean } = {},
      ): void {
        if (this.content().order.length >= runtime.maxDeckSlides) {
          return;
        }
        this.added.set(input.id, this.now());
        this.doc.updateContent((input2) => {
          let value = input2.order.filter((input3) => input3 !== input.id);
          value.splice(
            Math.max(0, Math.min(value.length, options)),
            0,
            input.id,
          );
          let value2 =
            context.joinTop === true
              ? moveSectionStartBeforeInsertedSlide(
                  input2.sections,
                  value,
                  input.id,
                )
              : input2.sections;
          return this.seal(
            setDeckSections(
              {
                ...input2,
                order: value,
                slides: {
                  ...input2.slides,
                  [input.id]: (0, runtime.setDeckListStyle)(
                    input,
                    input2.lists,
                  ),
                },
              },
              value2,
            ),
          );
        });
      }
      removeSlide(input: SlideId): void {
        this.forgetParked([input]);
        if (!Object.hasOwn(this.content().slides, input)) {
          return;
        }
        this.doc.updateContent((input2) => {
          let state = {
            ...input2.slides,
          };
          delete state[input];
          let value = input2.order.filter((input3) => input3 !== input);
          return this.seal(
            setDeckSections(
              {
                ...removeDeckCoverIfMatches(input2, input),
                order: value,
                slides: state,
                assets: (0, runtime.filterReferencedDeckAssets)(
                  state,
                  value,
                  input2.assets,
                ),
              },
              (0, runtime.reconcileSectionsWithSlideOrder)(
                (0, runtime.removeSlideFromSections)(
                  input2.sections,
                  input2.order,
                  input,
                ),
                value,
              ),
            ),
          );
        });
      }
      removeSlideKeepAssets(input: SlideId): void {
        this.forgetParked([input]);
        if (!Object.hasOwn(this.content().slides, input)) {
          return;
        }
        this.doc.updateContent((input2) => {
          let state = {
            ...input2.slides,
          };
          delete state[input];
          let value = input2.order.filter((input3) => input3 !== input);
          return this.seal(
            setDeckSections(
              {
                ...removeDeckCoverIfMatches(input2, input),
                order: value,
                slides: state,
              },
              (0, runtime.reconcileSectionsWithSlideOrder)(
                (0, runtime.removeSlideFromSections)(
                  input2.sections,
                  input2.order,
                  input,
                ),
                value,
              ),
            ),
          );
        });
      }
      setCover(input: SlideId | undefined): void {
        let value = this.content();
        if (
          value.cover === input ||
          (input !== undefined && !value.order.includes(input))
        ) {
          return;
        }
        this.doc.updateContent((input2) => {
          let { cover: value2, ...value3 } = input2;
          if (input !== undefined && input2.order.includes(input)) {
            return {
              ...value3,
              cover: input,
            };
          } else {
            return value3;
          }
        });
      }
      moveSlide(
        input: SlideId,
        options: number,
        context: { joinTop?: boolean } = {},
      ): void {
        let order = this.content().order,
          value = order.indexOf(input);
        if (value < 0) {
          return;
        }
        if (Math.max(0, Math.min(order.length - 1, options)) === value) {
          return;
        }
        this.doc.updateContent((input2) => {
          let items = [...input2.order];
          items.splice(value, 1);
          items.splice(Math.max(0, Math.min(items.length, options)), 0, input);
          let value2 = (0, runtime.reconcileSectionsWithSlideOrder)(
            (0, runtime.removeSlideFromSections)(
              input2.sections,
              input2.order,
              input,
            ),
            items,
          );
          return this.seal(
            setDeckSections(
              {
                ...input2,
                order: items,
              },
              context.joinTop === true
                ? moveSectionStartBeforeInsertedSlide(value2, items, input)
                : value2,
            ),
          );
        });
      }
      snapshotAssetsFor(input: SlideId): Record<string, string> {
        let value = this.content(),
          value2 = value.slides[input];
        if (!value2) {
          return {};
        }
        let values = new Set<string>();
        (0, runtime.collectSlideAssetIds)(value2, values);
        let state: Record<string, string> = {};
        for (let value3 of values) {
          let value4 = value.assets[value3];
          if (value4 !== undefined) {
            state[value3] = value4;
          }
        }
        return state;
      }
      restoreSlide(
        input: Slide,
        options: number,
        context: Record<string, string>,
      ): void {
        this.doc.updateContent((input2) => {
          let value = input2.order.filter((input3) => input3 !== input.id);
          value.splice(
            Math.max(0, Math.min(value.length, options)),
            0,
            input.id,
          );
          return {
            ...input2,
            order: value,
            slides: {
              ...input2.slides,
              [input.id]: (0, runtime.setDeckListStyle)(input, input2.lists),
            },
            assets: {
              ...input2.assets,
              ...context,
            },
          };
        });
      }
      insertSlides(
        items: Slide[],
        options: (content: DeckContent) => DeckOrderAndSections | undefined,
      ): boolean {
        let value = this.content();
        if (
          items.length === 0 ||
          value.order.length + items.length > runtime.maxDeckSlides ||
          items.some((input) => Object.hasOwn(value.slides, input.id))
        ) {
          return false;
        }
        let value2 = Object.fromEntries(
            items.map((input) => [
              input.id,
              (0, runtime.setDeckListStyle)(input, value.lists),
            ]),
          ),
          value3 = options({
            ...value,
            slides: {
              ...value.slides,
              ...value2,
            },
          });
        if (
          value3 === undefined ||
          !items.every((input) => value3.order.includes(input.id))
        ) {
          return false;
        }
        for (let value4 of items)
          this.added.set(value4.id, this.now());
        this.doc.updateContent((input) =>
            this.seal(
              buildDeckExportContent(
                {
                  ...input,
                  slides: {
                    ...input.slides,
                    ...value2,
                  },
                },
                deckOrderAndSections(value3),
              ),
            ),
        );
        return true;
      }
      applyStructure(
        input: (content: DeckContent) => DeckOrderAndSections | undefined,
      ): boolean {
        let value = this.content(),
          value2 = input(value);
        if (value2 === undefined) {
          return false;
        }
        let value3 = deckOrderAndSections(value2);
        if (jsonValuesEqual(deckOrderAndSections(value), value3)) {
          return false;
        }
        this.doc.updateContent((input2) =>
          buildDeckExportContent(input2, value3),
        );
        return true;
      }
      sectionsSnapshot(): SectionsUndoMark {
        return this.arm({});
      }
      arm(input: SectionsUndoMark): SectionsUndoMark {
        input.sections = this.content().sections;
        input.after = undefined;
        input.sealed = false;
        this.armed = input;
        queueMicrotask(() => {
          if (this.armed === input) {
            this.armed = undefined;
          }
        });
        return input;
      }
      armed: SectionsUndoMark | undefined;
      seal(input: DeckContent): DeckContent {
        if (this.armed !== undefined) {
          this.armed.after = input.sections;
          this.armed.sealed = true;
          this.armed = undefined;
        }
        return input;
      }
      restoreSections(input: SectionsUndoMark): void {
        if (input.sealed !== true) {
          return;
        }
        let value = this.content(),
          value2 = (0, runtime.diffSections)(
            {
              ...value,
              sections: input.after ?? [],
            },
            {
              ...value,
              sections: input.sections ?? [],
            },
          );
        if (
          value2.added.length === 0 &&
          value2.changed.length === 0 &&
          value2.removed.length === 0
        ) {
          return;
        }
        this.doc.updateContent((input2) =>
          (0, runtime.applySectionsDiff)(input2, value2),
        );
      }
      prepareAsset(input: string): string {
        if (!(0, runtime.isAllowedImageSource)(input)) {
          throw Error("assets must be raster or SVG data: URIs");
        }
        if (
          Object.keys(this.content().assets).length >= runtime.maxDeckAssets
        ) {
          throw Error(
            "asset limit reached (" + String(runtime.maxDeckAssets) + ")",
          );
        }
        return (0, runtime.createModelId)();
      }
      setAssetEntry(input: string, options: string): void {
        this.doc.updateContent((input2) => ({
          ...input2,
          assets: {
            ...input2.assets,
            [input]: options,
          },
        }));
      }
      removeAssetEntry(input: string): void {
        this.doc.updateContent((input2) => {
          if (!Object.hasOwn(input2.assets, input)) {
            return input2;
          }
          let state = {
            ...input2.assets,
          };
          delete state[input];
          return {
            ...input2,
            assets: state,
          };
        });
      }
      getAsset(input: string): string | undefined {
        return this.content().assets[input];
      }
    };
  };
}
