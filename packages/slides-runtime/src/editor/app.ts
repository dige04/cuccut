/** Restored application module; prepare first, initialize in original order. */
import type { ChangeEvent, DragEvent as ReactDragEvent, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactElement, ReactNode, RefObject, WheelEvent as ReactWheelEvent } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type {
  Axis,
  FontFace as DeckFontFace,
  DeckContent,
  Frame,
  ShapeVariant,
  Slide,
  SlideId,
  SlideNode,
  TextNode,
} from "../deck-contracts";
import type { ParsedCommentAnchor } from "../comments/anchors";
import type { DeckOrderAndSections, SectionsUndoMark } from "../documents/deck-store";
import type { PdfExportOptions, PdfExportQuality } from "../delivery/pdf-options";
import type { ExportEntry, ExportProduceOptions, ExportResult, ExportedFile } from "../delivery/provider";
import type { ShellSaveResult } from "../delivery/shell-downloads";
import type { CapturedPage } from "../export/notes-pages";
import type { CaptureQuality, PdfCaptureOptions, PdfCaptureResult } from "../export/pdf-capture";
import type { ArtifactPresence } from "../host/artifact-presence";
import type { SlideAnimationEngine } from "../presentation/animation-engine";
import type { SectionInsertTarget } from "../model/sections";
import type { CursorPresence } from "../ui/peer-cursors";
import type { StoredImageAsset } from "../media/assets";
import type {
  VideoMetadata,
  VideoPoster,
} from "../media/video-assets";
import type {
  VideoEncodingPlan,
  VideoProbe,
} from "../media/video-encoding-plans";
import type { VideoLink } from "../media/video-links";
import type { VideoShrinkResult } from "../media/video-shrink-queue";
import type { SlideRect } from "../model/geometry";
import type { NodePath } from "../model/editing";
import type { PlaceLinkReporter } from "../bridge/place-links";
import type { GroupMeasure, NodeSelection } from "../layout/selection-groups";
import type { FrameOrder } from "../model/editing";
import type { ObjectContextEditing } from "../model/selection";
import type { FullscreenOutcome } from "../presentation/fullscreen";
import type { ActivationEvent } from "../ui/video-playback-actions";
import type { CommandHistory } from "./command-history";
import type { PagePlaceLink } from "./current-slide";
import type { SlidePeerSelectionsProps } from "../collaboration/slide-selection";
import type { GridSlideHit } from "./grid-notes-click";
import type { SlideGridTile } from "./slide-grid";
import type { RailMeasure } from "./slide-rail-layout";
import type { SlideTemplatePickerProps } from "./templates";
import type { EditorViewState } from "./view-state";

declare module "../bindings" {
  interface RuntimeBindings {
    SlidesAppJsx: JsxNamespace;
    placeInsertedFrame: (
      sourceFrame: InsertAnchor | undefined,
      width: number,
      height?: number,
    ) => FramePlacement;
    EMPTY_SLIDE_GRID_SELECTION: SlideGridSelection;
    ZOOM_KEYBOARD_SHORTCUT_LABEL: string;
    QUICK_INSERT_SHAPES: string[];
    QUICK_INSERT_LINE_SHAPES: string[];
    SHAPE_INSERT_SHORTCUTS: Record<string, ShapeInsertShortcut>;
    getShapeInsertShortcut: (shape: string) => string | undefined;
    TEXT_INSERT_SHORTCUT_KEY: string;
    parseShapeInsertShortcut: (event: ShortcutKeyEvent) => string | undefined;
    disabledInsertControlProps: (disabled?: boolean) => DisabledControlProps;
    isLocalEmbeddableResource: (url: string) => boolean;
    readEmbeddableImageResource: (url: string) => Promise<string>;
    inlineLocalDeckResources: (
      slides: readonly Slide[],
      assets: ReadonlyMap<string, string>,
    ) => Promise<InlinedDeckResources>;
    DAMAGED_SLIDE_ACTION_MESSAGE: string;
    LOADING_PRESENTATION_PASTE_MESSAGE: string;
    presentationCapacityMessage: (count: number) => string;
    SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE: string;
    ALL_SLIDES_SKIPPED_EXPORT_MESSAGE: string;
    PRESENTATION_BUILDING_MESSAGE: string;
    formatPresentationBuildProgress: (
      loadedCount: number,
      totalCount: number,
    ) => string;
    PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE: string;
    incompleteDeckExportConfirmation: (
      action: string,
      loadedCount: number,
      totalCount: number,
    ) => IncompleteDeckConfirmation;
    PresentationWaitingAnnouncement: (
      props: PresentationWaitingAnnouncementProps,
    ) => ReactElement | null;
    EXTRA_EXPORT_FORMATS_META_NAME: string;
    EMPTY_EXTRA_EXPORT_FORMATS: string[];
    SHELL_EXPORT_IMAGE_REDUCTION_NOTE: string;
    GOOGLE_SLIDES_BUILD_TIMEOUT_MS: number;
    MAX_BROWSER_EXPORT_BYTES: number;
    BROWSER_EXPORT_IMAGE_REDUCTION_NOTE: string;
    exportFormatSupportsNotes: (format: string) => boolean;
    EXPORT_FORMAT_MIME_AND_EXTENSION: Record<string, ExportFormatMimeAndLabel>;
    getActiveSlideSurfaceRect: () => DOMRect | undefined;
    ACTIVE_SLIDE_SURFACE_SELECTOR: string;
    GRID_COMMENT_SLIDE_TARGET_SELECTOR: string;
    findActiveCommentSlideTarget: (slideKey: string | null) => HTMLElement | null;
    EDITOR_TAB_TARGET_SELECTOR: string;
    isCanvasEditorFocusTarget: (element: EventTarget | null) => boolean;
    ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR: string;
    findVisibleSlidesViewSwitch: () => HTMLElement | null;
    VIDEO_UPLOAD_TIMEOUT_MS: number;
    ignoreGlobalFileDrop: () => void;
    COPIED_VIDEO_OMISSION_MESSAGE: string;
    jpegReplacementUploadInput: (
      input: File,
      options: VideoPosterCapture,
    ) => JpegReplacementUpload;
    VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES: Set<string>;
    MAX_VIDEO_DURATION_MS: number;
    VIDEO_REPLACEMENT_STALE_MESSAGE: string;
    EMPTY_VIDEO_POSTER_DATA_URI: string;
    editorHasBlockingOverlay: (extraDialogSelector?: string) => boolean;
    SlidesApp: (props?: SlidesAppProps) => ReactElement;
    EmptyPresentationView: (props: EmptyPresentationViewProps) => ReactElement;
    EmptyPresentationStatus: (
      props: EmptyPresentationStatusProps,
    ) => ReactElement;
    SlidesAppLoadingSkeleton: (
      props: SlidesAppLoadingSkeletonProps,
    ) => ReactElement;
    loadImageDimensions: (src: string) => Promise<ImageDimensions>;
    isFrameCaptureMode: (document2?: Document) => boolean;
  }
}

export function installEditorApp(runtime: RuntimeBindings): () => void {
  var SlidesAppJsx: JsxNamespace;
  var EMPTY_SLIDE_GRID_SELECTION: SlideGridSelection;
  var ZOOM_KEYBOARD_SHORTCUT_LABEL: string;
  var QUICK_INSERT_SHAPES: string[];
  var QUICK_INSERT_LINE_SHAPES: string[];
  var SHAPE_INSERT_SHORTCUTS: Record<string, ShapeInsertShortcut>;
  var TEXT_INSERT_SHORTCUT_KEY: string;
  var disabledInsertControlProps: (disabled?: boolean) => DisabledControlProps;
  var isLocalEmbeddableResource: (url: string) => boolean;
  var DAMAGED_SLIDE_ACTION_MESSAGE: string;
  var LOADING_PRESENTATION_PASTE_MESSAGE: string;
  var presentationCapacityMessage: (count: number) => string;
  var SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE: string;
  var ALL_SLIDES_SKIPPED_EXPORT_MESSAGE: string;
  var PRESENTATION_BUILDING_MESSAGE: string;
  var formatPresentationBuildProgress: (
    loadedCount: number,
    totalCount: number,
  ) => string;
  var PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE: string;
  var EXTRA_EXPORT_FORMATS_META_NAME: string;
  var EMPTY_EXTRA_EXPORT_FORMATS: string[];
  var SHELL_EXPORT_IMAGE_REDUCTION_NOTE: string;
  var GOOGLE_SLIDES_BUILD_TIMEOUT_MS: number;
  var MAX_BROWSER_EXPORT_BYTES: number;
  var BROWSER_EXPORT_IMAGE_REDUCTION_NOTE: string;
  var exportFormatSupportsNotes: (format: string) => boolean;
  var EXPORT_FORMAT_MIME_AND_EXTENSION: Record<string, ExportFormatMimeAndLabel>;
  var getActiveSlideSurfaceRect: () => DOMRect | undefined;
  var ACTIVE_SLIDE_SURFACE_SELECTOR: string;
  var GRID_COMMENT_SLIDE_TARGET_SELECTOR: string;
  var findActiveCommentSlideTarget: (slideKey: string | null) => HTMLElement | null;
  var EDITOR_TAB_TARGET_SELECTOR: string;
  var isCanvasEditorFocusTarget: (element: EventTarget | null) => boolean;
  var ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR: string;
  var VIDEO_UPLOAD_TIMEOUT_MS: number;
  var ignoreGlobalFileDrop: () => void;
  var COPIED_VIDEO_OMISSION_MESSAGE: string;
  var jpegReplacementUploadInput: (
    input: File,
    options: VideoPosterCapture,
  ) => JpegReplacementUpload;
  var VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES: Set<string>;
  var MAX_VIDEO_DURATION_MS: number;
  var VIDEO_REPLACEMENT_STALE_MESSAGE: string;
  var EMPTY_VIDEO_POSTER_DATA_URI: string;
  var editorHasBlockingOverlay: (extraDialogSelector?: string) => boolean;
  function placeInsertedFrame(
    sourceFrame: InsertAnchor | undefined,
    width: number,
    height?: number,
  ): FramePlacement {
    if (!sourceFrame) {
      return {
        x: {
          anchor: "center",
          margin: 0,
          offset: 0,
          size: width,
        },
        y: {
          anchor: "center",
          margin: 0,
          offset: 0,
          ...(height !== undefined
            ? {
                size: height,
              }
            : {}),
        },
      };
    }
    return {
      x: {
        anchor: "leading",
        margin: Math.max(0, Math.round(sourceFrame.x - width / 2)),
        offset: 0,
        size: width,
      },
      y: {
        anchor: "leading",
        margin: Math.max(0, Math.round(sourceFrame.y - (height ?? 80) / 2)),
        offset: 0,
        ...(height !== undefined
          ? {
              size: height,
            }
          : {}),
      },
    };
  }
  function getShapeInsertShortcut(shape: string): string | undefined {
    let shortcut = SHAPE_INSERT_SHORTCUTS[shape];
    if (shortcut === undefined) {
      return undefined;
    } else {
      return (shortcut.shift ? "shift+" : "") + shortcut.key;
    }
  }
  function parseShapeInsertShortcut(event: ShortcutKeyEvent): string | undefined {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.repeat ||
      event.isComposing ||
      typeof event.key !== "string"
    ) {
      return;
    }
    let key = event.key.toLowerCase();
    if (key === TEXT_INSERT_SHORTCUT_KEY && !event.shiftKey) {
      return "text";
    }
    return runtime.shapeVariants.find(
      (input: string) =>
        SHAPE_INSERT_SHORTCUTS[input]?.key === key &&
        (SHAPE_INSERT_SHORTCUTS[input]?.shift === true) === event.shiftKey,
    );
  }
  async function readEmbeddableImageResource(url: string): Promise<string> {
    if ((0, runtime.isStoredBlobReference)(url)) {
      return (0, runtime.fetchStoredBlob)(url);
    }
    let dataUri = await (0, runtime.fetchResourceDataUrl)(url, 8000, {
      credentials: "same-origin",
    });
    if (!/^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)[;,]/.test(dataUri)) {
      throw Error("not a picture");
    }
    return dataUri;
  }
  async function inlineLocalDeckResources(
    slides: readonly Slide[],
    assets: ReadonlyMap<string, string>,
  ): Promise<InlinedDeckResources> {
    let urls = new Set<string>(),
      localUrls = new Set<string>();
    for (let value of assets.values())
      if (isLocalEmbeddableResource(value)) {
        urls.add(value);
        localUrls.add(value);
      }
    let callback = (source: SlideNode) => {
      if (
        source.kind === "img" &&
        source.src !== undefined &&
        isLocalEmbeddableResource(source.src)
      ) {
        urls.add(source.src);
        localUrls.add(source.src);
      }
      if (
        source.kind === "text" &&
        source.fill?.kind === "image" &&
        isLocalEmbeddableResource(source.fill.src)
      ) {
        urls.add(source.fill.src);
      }
      for (let value of (0, runtime.nodeChildren)(source) ?? []) callback(value);
    };
    for (let value of slides)
      for (let value2 of value.frames) callback(value2.node);
    if (urls.size === 0) {
      return {
        slides: slides,
        assets: assets,
        warnings: [],
      };
    }
    let entries = new Map<string, string>(),
      index = 0,
      index2 = 0,
      values = new Set<string>();
    await Promise.all(
      [...urls].map(async (input: string) => {
        try {
          entries.set(input, await readEmbeddableImageResource(input));
        } catch {
          if (localUrls.has(input)) {
            index += 1;
          } else {
            index2 += 1;
          }
        }
      }),
    );
    let callback2: (source: SlideNode) => SlideNode = (source) => {
        if (source.kind === "img") {
          if (
            source.src === undefined ||
            !isLocalEmbeddableResource(source.src)
          ) {
            return source;
          }
          let { src: value, ...value2 } = source,
            entry = entries.get(value);
          if (entry !== undefined) {
            return {
              ...value2,
              src: entry,
            };
          } else {
            return value2;
          }
        }
        if (
          source.kind === "text" &&
          source.fill?.kind === "image" &&
          isLocalEmbeddableResource(source.fill.src)
        ) {
          let { fill: value, ...value2 } = source,
            entry = entries.get(value.src);
          if (
            entry !== undefined &&
            !(0, runtime.isRenderableImageSource)(entry)
          ) {
            values.add(
              entry.length > runtime.maxInlineSvgBytes &&
                entry.startsWith("data:image/svg+xml")
                ? "an SVG over " +
                    String(Math.round(runtime.maxInlineSvgBytes / 1024)) +
                    " KB"
                : entry.slice(5, Math.max(5, entry.indexOf(";"))) ||
                    "an unknown type",
            );
            return value2;
          }
          if (entry !== undefined) {
            return {
              ...value2,
              fill: {
                ...value,
                src: entry,
              },
            };
          } else {
            return value2;
          }
        }
        if (source.kind === "overlay") {
          return {
            ...source,
            base: callback2(source.base),
            layers: source.layers.map(
              (input) => ({
                ...input,
                node: callback2(input.node),
              }),
            ),
          };
        }
        if ((0, runtime.isFlowContainer)(source)) {
          return {
            ...source,
            children: source.children.map(callback2),
          };
        }
        return source;
      },
      entries2 = new Map<string, string>();
    for (let [value, value2] of assets)
      if (!isLocalEmbeddableResource(value2)) {
        entries2.set(value, value2);
      } else if (entries.has(value2)) {
        entries2.set(value, entries.get(value2)!);
      }
    return {
      slides: slides.map(
        (input) => ({
          ...input,
          frames: input.frames.map(
            (input2) => ({
              ...input2,
              node: callback2(input2.node),
            }),
          ),
        }),
      ),
      assets: entries2,
      warnings: [
        ...(index > 0
          ? [
              index === 1
                ? "1 image could not be loaded and was exported as a placeholder."
                : String(index) +
                  " images could not be loaded and were exported as placeholders.",
            ]
          : []),
        ...(index2 > 0
          ? [
              String(index2) +
                " text fill picture" +
                (index2 === 1 ? "" : "s") +
                " could not be loaded; that text exports in its plain colour.",
            ]
          : []),
        ...(values.size > 0
          ? [
              "a text fill picture came back as " +
                [...values].join(", ") +
                ", which cannot be inlined into the text; that text exports in its plain colour.",
            ]
          : []),
      ],
    };
  }
  function incompleteDeckExportConfirmation(
    action: string,
    loadedCount: number,
    totalCount: number,
  ): IncompleteDeckConfirmation {
    return {
      title: PRESENTATION_BUILDING_MESSAGE,
      message:
        (action === "Send" ? "Sending" : "Downloading") +
        " now would include only " +
        String(loadedCount) +
        " of " +
        String(totalCount) +
        " slides. " +
        action +
        " " +
        (loadedCount === 1 ? "that one" : "those") +
        " now, or wait for the rest, then " +
        action.toLowerCase() +
        " again.",
      confirmLabel: action + " anyway",
    };
  }
  function PresentationWaitingAnnouncement({
    waiting: waiting,
    slideCount: slideCount,
    turnBusy: turnBusy,
    startSaidElsewhere: startSaidElsewhere,
    onStartSaid: onStartSaid,
  }: PresentationWaitingAnnouncementProps): ReactElement | null {
    let ref = runtime.reactd0.useRef(waiting);
    runtime.reactd0.useEffect(() => {
      if (waiting) {
        if (startSaidElsewhere?.() !== true) {
          (0, runtime.announceLiveMessage)(
            () => {
              onStartSaid?.();
              return PRESENTATION_BUILDING_MESSAGE;
            },
            {
              ifIdle: true,
            },
          );
        }
      } else if (ref.current && !turnBusy && slideCount > 0) {
        (0, runtime.announceLiveMessage)(
          runtime.PRESENTATION_CHANGE_ANNOUNCEMENTS.ready(slideCount),
          {
            ifIdle: true,
          },
        );
      }
      ref.current = waiting;
    }, [waiting]);
    return null;
  }
  function findVisibleSlidesViewSwitch(): HTMLElement | null {
    for (let value of document.querySelectorAll<HTMLElement>(
      ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR,
    ))
      if (
        value.closest(
          '[inert], [aria-hidden="true"], [data-slides-grid-leaving]',
        ) === null
      ) {
        return value;
      }
    return null;
  }
  function SlidesApp({ host: host }: SlidesAppProps = {}): ReactElement {
    let memoryScope = host?.memoryScope ?? "";
    runtime.reactd0.useState(
      () => (0, runtime.setCommentAnchorScope)(memoryScope),
    );
    runtime.reactd0.useEffect(() => {
      (0, runtime.setCommentAnchorScope)(memoryScope);
      return () => (0, runtime.setCommentAnchorScope)("");
    }, [memoryScope]);
    let scopedSlideKey = runtime.reactd0.useCallback(
      (input: string) =>
        memoryScope === "" ? input : memoryScope + "/" + input,
      [memoryScope],
    );
    (0, runtime.useFileDrop)({
      onFiles: ignoreGlobalFileDrop,
      disabled: true,
    });
    let documentStore = runtime.reactd0.useMemo(
        () => new runtime.SlidesDocumentStore(),
        [],
      ),
      codecState = runtime.reactd0.useMemo(
        () => (0, runtime.getSlideDocumentCodec)(documentStore.doc),
        [documentStore],
      ),
      {
        slideHtmlHold: slideHtmlHold2,
        awaitingSlides: awaitingSlides,
        awaitedSlideCount: awaitedSlideCount,
        subscribeMeta: subscribeMeta,
        hidingMovedDeck: hidingMovedDeck,
      } = codecState,
      creationActivityRef = runtime.reactd0.useRef<CreationActivity | null>(null),
      undoHistory = runtime.reactd0.useMemo(
        () =>
          (0, runtime.createDeckCommandHistory)(
            host?.undo ?? (0, runtime.createCommandHistory)(),
            (input) => documentStore.doc.commit?.(input),
            (input, options) => {
              if (input === "do") {
                creationActivityRef.current?.(
                  options.structural === true ? "structure" : "edit",
                );
              }
              (0, runtime.reportArtifactFeedback)(
                input === "do"
                  ? "step"
                  : input === "declined"
                    ? "undo-declined"
                    : input,
                options,
              );
            },
            {
              tokens: () => {
                let doc = documentStore.doc;
                if (
                  typeof doc.takeTouched === "function" &&
                  typeof doc.structureRev === "function" &&
                  typeof doc.slideRev === "function" &&
                  typeof doc.clashLocal === "function"
                ) {
                  return doc;
                } else {
                  return undefined;
                }
              },
              tell: (input) => (0, runtime.showToast)(input),
            },
          ),
        [host?.undo, documentStore],
      ),
      snapshot = runtime.reactd0.useSyncExternalStore(
        runtime.reactd0.useCallback(
          (input: () => void) => documentStore.subscribe(input),
          [documentStore],
        ),
        () => documentStore.getSnapshot(),
      ),
      readOnly = documentStore.doc.readOnly(),
      saveMessage = runtime.reactd0.useSyncExternalStore(
        runtime.reactd0.useCallback(
          (input: () => void) =>
            documentStore.doc.subscribeSave(() => input()),
          [documentStore],
        ),
        () => documentStore.doc.saveState().message ?? "",
      ),
      initialPlaceLinkRef = runtime.reactd0.useRef<PagePlaceLink | null | undefined>(undefined);
    if (initialPlaceLinkRef.current === undefined) {
      initialPlaceLinkRef.current =
        host === undefined ? (0, runtime.resolvePagePlaceLink)() : null;
    }
    let pendingPlaceFragmentRef = runtime.reactd0.useRef(
        initialPlaceLinkRef.current?.why === "new"
          ? initialPlaceLinkRef.current.place
          : null,
      ),
      clearInitialPlaceLink = () => {
        if (initialPlaceLinkRef.current != null) {
          (0, runtime.writePlaceLinkField)(
            "link",
            initialPlaceLinkRef.current.place,
          );
        }
        initialPlaceLinkRef.current = null;
        pendingPlaceFragmentRef.current = null;
      },
      [initialCurrentSlide] = runtime.reactd0.useState(() => {
        let order = documentStore.getSnapshot().meta.order,
          value = (0, runtime.newLinkedSlideId)(
            order,
            initialPlaceLinkRef.current ?? null,
          );
        if (value !== undefined) {
          return {
            id: value,
            exact: true,
            at: order.indexOf(value),
            home: null,
          };
        } else {
          return (0, runtime.resolveRememberedCurrentSlide)(
            order,
            host?.memoryScope,
          );
        }
      }),
      [currentSlideId, setCurrentSlideId] = runtime.reactd0.useState(
        initialCurrentSlide.id,
      ),
      lastSelectedSlideIdRef = runtime.reactd0.useRef(
        initialCurrentSlide.id,
      ),
      rememberedSlideFallbackRef = runtime.reactd0.useRef(
        initialCurrentSlide.exact || initialCurrentSlide.id === null
          ? null
          : {
              id: initialCurrentSlide.id,
              at: initialCurrentSlide.at,
              home: initialCurrentSlide.home,
              load: true,
              since: Date.now(),
            },
      ),
      currentSlideIndexRef = runtime.reactd0.useRef(
        initialCurrentSlide.at,
      );
    runtime.reactd0.useEffect(() => {
      let order = snapshot.meta.order;
      if (order.length === 0) {
        return;
      }
      let value = Date.now(),
        callback = (input: string) => {
          lastSelectedSlideIdRef.current = input;
          setCurrentSlideId(input);
          setSelection([]);
          setTextEditState(null);
        },
        current = pendingPlaceFragmentRef.current;
      if (current === null) {
        clearInitialPlaceLink();
      } else {
        let value4 = (0, runtime.resolveSlidePlaceFragment)(
            current,
            order,
          ),
          value5 =
            currentSlideId !== null &&
            currentSlideId !== lastSelectedSlideIdRef.current;
        if (value4 !== undefined || value5 || !awaitingSlides()) {
          clearInitialPlaceLink();
        }
        if (
          value4 !== undefined &&
          !value5 &&
          value4 !== currentSlideId &&
          selectionRef.current.length === 0 &&
          !textEditingRef.current
        ) {
          rememberedSlideFallbackRef.current = null;
          callback(value4);
          return;
        }
      }
      if (currentSlideId === null) {
        let value4 = (0, runtime.resolveRememberedCurrentSlide)(
          order,
          host?.memoryScope,
          !awaitingSlides(),
        );
        if (value4.id === null) {
          return;
        }
        rememberedSlideFallbackRef.current = value4.exact
          ? null
          : {
              id: value4.id,
              at: value4.at,
              home: value4.home,
              load: true,
              since: value,
            };
        callback(value4.id);
        return;
      }
      if (
        rememberedSlideFallbackRef.current !== null &&
        rememberedSlideFallbackRef.current.id !== currentSlideId
      ) {
        rememberedSlideFallbackRef.current = null;
      }
      let current2 = rememberedSlideFallbackRef.current;
      if (
        current2 !== null &&
        current2.home !== null &&
        value - current2.since >= VIDEO_UPLOAD_TIMEOUT_MS
      ) {
        current2.home = null;
      }
      let value2 = current2 !== null ? current2.home : null,
        value3 = order.indexOf(currentSlideId);
      if (value3 < 0) {
        if (awaitingSlides()) {
          return;
        }
        let value4 =
          value2 !== null && order.includes(value2)
            ? value2
            : (0, runtime.slideAtClampedIndex)(
                order,
                currentSlideIndexRef.current,
              )!;
        rememberedSlideFallbackRef.current =
          value4 === value2
            ? null
            : {
                id: value4,
                at: order.indexOf(value4),
                home: value2 ?? currentSlideId,
                load: false,
                since:
                  current2 !== null && value2 !== null ? current2.since : value,
              };
        callback(value4);
        return;
      }
      if (value2 !== null && order.includes(value2)) {
        rememberedSlideFallbackRef.current = null;
        callback(value2);
        return;
      }
      currentSlideIndexRef.current = value3;
      if (current2 !== null && current2.load && current2.at === value3) {
        return;
      }
      if (current2 !== null) {
        current2.load = false;
      }
      (0, runtime.writeCurrentSlidePreference)(
        currentSlideId,
        value3,
        host?.memoryScope,
      );
    }, [currentSlideId, snapshot.meta.order, host?.memoryScope]);
    let [gridRequested, setGridRequested] =
        runtime.reactd0.useState(false),
      gridOpen = gridRequested && snapshot.slides.length > 0,
      deckEmpty = snapshot.slides.length === 0;
    runtime.reactd0.useEffect(() => {
      if (!deckEmpty) {
        return;
      }
      setGridRequested(false);
      setEditingGridSlide(false);
      setGridSlideSurround(null);
    }, [deckEmpty]);
    let [gridSelection, setGridSelection] = runtime.reactd0.useState(
        EMPTY_SLIDE_GRID_SELECTION,
      ),
      gridEnterFromRectRef = runtime.reactd0.useRef<GridEnterFrom | null>(null),
      [gridLeaving, setGridLeaving] = runtime.reactd0.useState(false),
      gridLeavingRef = runtime.reactd0.useRef(false);
    gridLeavingRef.current = gridLeaving;
    let [gridMountGeneration, bumpGridMountGeneration] =
        runtime.reactd0.useState(0),
      [editingGridSlide, setEditingGridSlide] =
        runtime.reactd0.useState(false),
      editingGridSlideRef = runtime.reactd0.useRef(false);
    editingGridSlideRef.current = editingGridSlide;
    let [gridSlideSurround, setGridSlideSurround] =
        runtime.reactd0.useState<GridSlideSurround | null>(null),
      selectGridSlideSurround = runtime.reactd0.useCallback(
        (input: string, options?: GridPick) => {
          let current = gridZoomApiRef.current,
            value = current?.tileRect(input);
          if (!current || !value) {
            return false;
          }
          setGridSlideSurround({
            id: input,
            rect: value,
            ...current.getLimits(),
            pick: options && {
              x: value.left + options.fx * value.width,
              y: value.top + options.fy * value.height,
            },
          });
          return true;
        },
        [],
      ),
      gridFollowRef = runtime.reactd0.useRef<GridFollow | null>(null),
      followGridEditingSlide =
        runtime.reactd0.useCallback(() => {
          let current = gridFollowRef.current;
          if (current) {
            gridZoomApiRef.current?.follow(
              current.id,
              current.view,
              current.rect,
            );
          }
        }, []),
      focusViewSwitchAfterCloseRef = runtime.reactd0.useRef(false),
      focusEditor = runtime.reactd0.useCallback(
        (input: string = ACTIVE_SLIDE_SURFACE_SELECTOR) => {
          requestAnimationFrame(() => {
            let current = focusViewSwitchAfterCloseRef.current;
            focusViewSwitchAfterCloseRef.current = false;
            if (
              document.activeElement?.closest(
                "[data-slides-editor]",
              )
            ) {
              return;
            }
            (
              (current ? findVisibleSlidesViewSwitch() : null) ??
              document.querySelector<HTMLElement>(input)
            )?.focus({
              preventScroll: true,
            });
          });
        },
        [],
      ),
      openGridSlideInEditor = runtime.reactd0.useCallback(
        (
          input: string,
          options?: GridPick,
          context: string = EDITOR_TAB_TARGET_SELECTOR,
        ) => {
          if (
            gridLeavingRef.current ||
            !selectGridSlideSurround(input, options)
          ) {
            return false;
          }
          setCurrentSlideId(input);
          setSelection([]);
          setTextEditState(null);
          setGridSelection(EMPTY_SLIDE_GRID_SELECTION);
          setCommentViewReveal(null);
          setGridRequested(false);
          setEditingGridSlide(true);
          if (
            document.activeElement instanceof HTMLElement &&
            document.activeElement.closest("[data-slides-grid]")
          ) {
            document.activeElement.blur();
          }
          focusViewSwitchAfterCloseRef.current = false;
          focusEditor(context);
          return true;
        },
        [selectGridSlideSurround, focusEditor],
      ),
      handleGridOpenSlide = runtime.reactd0.useCallback(
        (input: string, options?: GridPick) =>
          openGridSlideInEditor(
            input,
            options,
            options === undefined
              ? ACTIVE_SLIDE_SURFACE_SELECTOR
              : EDITOR_TAB_TARGET_SELECTOR,
          ),
        [openGridSlideInEditor],
      ),
      returnToGrid = runtime.reactd0.useCallback(
        (input?: ReturnToGridOptions) => {
          setEditingGridSlide(false);
          setGridSlideSurround(null);
          setSelection([]);
          setTextEditState(null);
          setInspectorOpen(false);
          setGridSelection(EMPTY_SLIDE_GRID_SELECTION);
          setGridRequested(true);
          if (input?.select !== undefined) {
            setCurrentSlideId(input.select);
          }
          if (input?.fit) {
            gridZoomApiRef.current?.fitAll(currentSlideRef.current?.id);
          }
        },
        [],
      ),
      openGrid = runtime.reactd0.useCallback(() => {
        if (documentStore.getSnapshot().meta.order.length === 0) {
          return;
        }
        if (editingGridSlideRef.current) {
          return returnToGrid({
            fit: true,
          });
        }
        let value = getActiveSlideSurfaceRect(),
          value2 = currentSlideRef.current?.id;
        gridEnterFromRectRef.current =
          value && value2 !== undefined
            ? {
                id: value2,
                rect: value,
              }
            : null;
        setSelection([]);
        setTextEditState(null);
        setInspectorOpen(false);
        setGridSelection(EMPTY_SLIDE_GRID_SELECTION);
        if (gridLeavingRef.current) {
          bumpGridMountGeneration((input) => input + 1);
        }
        focusViewSwitchAfterCloseRef.current = false;
        setGridLeaving(false);
        setGridRequested(true);
      }, [documentStore, returnToGrid]),
      wasEditingWhenGridLeftRef = runtime.reactd0.useRef(false),
      closeGrid = runtime.reactd0.useCallback(
        (input: boolean = false) => {
          wasEditingWhenGridLeftRef.current = editingGridSlideRef.current;
          focusViewSwitchAfterCloseRef.current =
            input && !editingGridSlideRef.current;
          if (editingGridSlideRef.current) {
            returnToGrid();
          }
          setGridSelection(EMPTY_SLIDE_GRID_SELECTION);
          setCommentViewReveal(null);
          setGridRequested(false);
          if (gridZoomApiRef.current !== null) {
            setGridLeaving(true);
          } else {
            focusEditor();
          }
        },
        [focusEditor, returnToGrid],
      ),
      closeGridFromButton = runtime.reactd0.useCallback(
        () => closeGrid(true),
        [closeGrid],
      ),
      setGridOpen = runtime.reactd0.useCallback(
        (input?: boolean) => (input ? openGrid() : closeGrid(true)),
        [openGrid, closeGrid],
      );
    runtime.reactd0.useEffect(() => {
      if (gridOpen) {
        gridEnterFromRectRef.current = null;
      }
    }, [gridOpen]);
    runtime.reactd0.useEffect(() => {
      if (!gridLeaving) {
        return;
      }
      let value = requestAnimationFrame(() => {
        let value2 = getActiveSlideSurfaceRect(),
          value3 = currentSlideRef.current?.id,
          current = gridZoomApiRef.current,
          callback = () => {
            setGridLeaving(false);
            if (!gridTransitionActiveRef.current) {
              focusEditor();
            }
          };
        if (!value2 || value3 === undefined || !current) {
          callback();
        } else {
          current.glideToSlide(value3, value2, callback);
        }
      });
      return () => cancelAnimationFrame(value);
    }, [gridLeaving, focusEditor]);
    let gridTransitionActiveRef = runtime.reactd0.useRef(false);
    gridTransitionActiveRef.current = gridOpen;
    let textEditRef = runtime.reactd0.useRef<TextEditTarget | null>(null);
    runtime.reactd0.useEffect(() => {
      let callback = (event: KeyboardEvent) => {
        if (
          event.defaultPrevented ||
          event.repeat ||
          presentingRef.current ||
          !(event.metaKey || event.ctrlKey) ||
          !event.shiftKey ||
          event.altKey ||
          event.code !== "Digit0"
        ) {
          return;
        }
        if ((0, runtime.hasOpenOverlay)() || textEditRef.current !== null) {
          return;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        if (gridTransitionActiveRef.current) {
          closeGrid();
        } else {
          openGrid();
        }
      };
      window.addEventListener("keydown", callback);
      return () =>
        window.removeEventListener("keydown", callback);
    }, [openGrid, closeGrid]);
    // CucCut: the editor sits in a resizable side tab and can mount while it is narrow, so until the user shows
    // or hides the slide rail it follows the viewport instead of keeping the size it had at mount.
    let railChosenRef = runtime.reactd0.useRef(false);
    runtime.reactd0.useEffect(() => {
      let callback = () => {
        if (!railChosenRef.current) {
          setRailOpen(
            (0, runtime.canResizeSlideRail)(
              window.innerWidth,
              window.innerHeight,
            ),
          );
        }
      };
      window.addEventListener("resize", callback);
      return () =>
        window.removeEventListener("resize", callback);
    }, []);
    let chooseRailOpen = runtime.reactd0.useCallback(
        (input: boolean) => {
          railChosenRef.current = true;
          setRailOpen(input);
          requestAnimationFrame(() => {
            document
              .querySelector<HTMLElement>(
                input ? "[data-slides-rail-hide]" : "[data-slides-rail-show]",
              )
              ?.focus({
                preventScroll: true,
              });
          });
        },
        [],
      ),
      presentingRef = runtime.reactd0.useRef(false),
      focusAfterPresentation =
        runtime.reactd0.useCallback(() => {
          let callback = () =>
            requestAnimationFrame(() => {
              if (presentingRef.current) {
                return;
              }
              if (!document.hasFocus()) {
                return;
              }
              let activeElement = document.activeElement;
              if (
                activeElement !== null &&
                activeElement !== document.body &&
                activeElement.getClientRects().length > 0 &&
                activeElement.closest("[data-slides-present-entry]") === null
              ) {
                return;
              }
              Array.from(
                document.querySelectorAll<HTMLElement>(
                  "[data-slides-present-entry] button",
                ),
              )
                .find(
                  (input) =>
                    input.getClientRects().length > 0,
                )
                ?.focus({
                  preventScroll: true,
                });
            });
          if ((0, runtime.getFullscreenElement)() === null) {
            callback();
            return;
          }
          let flag = false,
            callback2 = () => {
              if (flag) {
                return;
              }
              flag = true;
              value();
              clearTimeout(value2);
              callback();
            },
            value = (0, runtime.subscribeFullscreenChange)(callback2),
            value2 = setTimeout(callback2, 3000);
        }, []),
      exitPresentation = runtime.reactd0.useCallback(
        (input?: string, options: boolean = true) => {
          presentingRef.current = false;
          setPresentationStartIndex(null);
          setFullscreenRequest(null);
          setPresentationCurrentIndex(null);
          if (input !== undefined) {
            setCurrentSlideId(input);
          }
          if (options) {
            focusAfterPresentation();
          }
        },
        [focusAfterPresentation],
      ),
      lastRestoreCountRef = runtime.reactd0.useRef(0);
    runtime.reactd0.useEffect(
      () =>
        documentStore.doc.subscribe(() => {
          if (
            documentStore.doc.restoreCount() !== lastRestoreCountRef.current
          ) {
            lastRestoreCountRef.current = documentStore.doc.restoreCount();
            undoHistory.clear();
            setSelection([]);
            setTextEditState(null);
          }
        }),
      [documentStore, undoHistory],
    );
    let [selection, setSelectionState] = runtime.reactd0.useState<NodeSelection[]>([]),
      selectionRef = runtime.reactd0.useRef(selection);
    selectionRef.current = selection;
    let currentSelectionRef = runtime.reactd0.useRef(selection),
      setSelection = runtime.reactd0.useCallback(
        (input: SelectionUpdate) => {
          currentSelectionRef.current =
            typeof input === "function"
              ? input(currentSelectionRef.current)
              : input;
          setSelectionState(currentSelectionRef.current);
        },
        [],
      ),
      [gestureSelectionController] = runtime.reactd0.useState(
        () =>
          (0, runtime.createSlideGestureHistory)({
            latest: () => currentSelectionRef.current,
            onScreen: (input) =>
              currentSlideRef.current?.id === input && !presentingRef.current,
            selectable: (input) =>
              currentSlideRef.current?.id === input &&
              !gridTransitionActiveRef.current &&
              !presentingRef.current &&
              !textEditingRef.current &&
              !commentModeRef.current &&
              !liveGestureRef.current &&
              !dragActiveRef.current
                ? documentStore.getSlide(input)
                : undefined,
            select: setSelection,
          }),
      ),
      bootStyleNoticeShownRef = runtime.reactd0.useRef(false);
    runtime.reactd0.useEffect(() => {
      if (bootStyleNoticeShownRef.current) {
        return;
      }
      bootStyleNoticeShownRef.current = true;
      let droppedStyles = documentStore.bootReport.droppedStyles,
        value = documentStore.bootReport.htmlErrors ?? 0,
        value2 = documentStore.bootReport.htmlWarnings ?? 0,
        value3 = "releaseHold" in documentStore.doc;
      if (value > 0) {
        (0, runtime.showToast)(
          "The presentation’s HTML has " +
            String(value) +
            " structural error" +
            (value === 1 ? "" : "s") +
            (documentStore.bootReport.htmlErrorSample !== undefined
              ? " — first: " + documentStore.bootReport.htmlErrorSample
              : "") +
            (value3
              ? ". The readable part is what the live store was seeded with; fix the source file if something is missing."
              : ". Shown best-effort, not saveable."),
        );
      } else if (value2 > 0 && !documentStore.doc.readOnly()) {
        (0, runtime.showToast)(
          String(value2) +
            " value" +
            (value2 === 1 ? "" : "s") +
            " in the presentation’s HTML " +
            (value2 === 1 ? "was" : "were") +
            " healed at load" +
            (value3
              ? " (a slide is stored in its healed form when next edited)"
              : " (a Save writes the healed form)"),
        );
      }
      if (droppedStyles === 0 || documentStore.doc.readOnly()) {
        return;
      }
      (0, runtime.showToast)(
        droppedStyles === 1
          ? "1 style value isn't supported and was removed"
          : String(droppedStyles) +
              " style values aren't supported and were removed",
      );
    }, [documentStore]);
    let [textEdit, setTextEditState] = runtime.reactd0.useState<TextEditTarget | null>(null);
    textEditRef.current = textEdit;
    let touchLayout = (0, runtime.useCoarsePointer)(),
      toolbarButtonSize = touchLayout ? undefined : "xs",
      modalOpen = (0, runtime.useSmallCoarsePointer)(),
      [presentationStartIndex, setPresentationStartIndex] =
        runtime.reactd0.useState<number | null>(null),
      showCommentTargets =
        (gridOpen || gridLeaving || editingGridSlide) &&
        presentationStartIndex === null;
    presentingRef.current = presentationStartIndex !== null;
    let speakerNotesSession = (0, runtime.useSpeakerNotesSession)(),
      [dockSpeakerNotes, setDockSpeakerNotes] =
        runtime.reactd0.useState(false),
      [fullscreenRequest, setFullscreenRequest] =
        runtime.reactd0.useState<FullscreenRequest | null>(null),
      [presentationCurrentIndex, setPresentationCurrentIndex] =
        runtime.reactd0.useState(null),
      [exporting, setExporting] = runtime.reactd0.useState(false),
      downloadsWithheld2 = (0, runtime.useDownloadsWithheld)(),
      [extraExportFormats, setExtraExportFormats] =
        runtime.reactd0.useState(false);
    runtime.reactd0.useEffect(() => {
      let flag = true;
      (0, runtime.getFeatureFlagAsync)(
        EXTRA_EXPORT_FORMATS_META_NAME,
        false,
      ).then((input: boolean) => {
        if (flag) {
          setExtraExportFormats(input);
        }
      });
      return () => {
        flag = false;
      };
    }, []);
    let [exportDelivery, setExportDelivery] =
        runtime.reactd0.useState<ExportDeliveryRequest | null>(null),
      [exportNotes, setExportNotes] = runtime.reactd0.useState<ExportNotesState | null>(null),
      [templatePickerOpen, setTemplatePickerOpen] =
        runtime.reactd0.useState(false),
      [templatePickerReturnFocus, setTemplatePickerReturnFocus] =
        runtime.reactd0.useState<TemplatePickerReturnFocus | undefined>(undefined),
      openTemplatePicker = (input?: TemplatePickerOptions) => {
        setTemplatePickerReturnFocus(() => input?.returnFocus);
        setTemplatePickerOpen(true);
      },
      [insertMenuOpen, setInsertMenuOpen] =
        runtime.reactd0.useState(false),
      [focusInsertMenuOnOpen, setFocusInsertMenuOnOpen] =
        runtime.reactd0.useState(false);
    runtime.reactd0.useEffect(() => {
      if (readOnly) {
        setTextEditState(null);
        setTemplatePickerOpen(false);
        setInspectorOpen(false);
      }
    }, [readOnly]);
    let editorZoomApiRef = runtime.reactd0.useRef<EditorZoomApi | null>(null),
      editorScaleSubscribers = runtime.reactd0.useRef(new Set<ScaleListener>()),
      editorScaleRef = runtime.reactd0.useRef<number | null>(null),
      subscribeEditorScale = runtime.reactd0.useCallback(
        (input: ScaleListener) => {
          editorScaleSubscribers.current.add(input);
          if (editorScaleRef.current !== null) {
            input(editorScaleRef.current);
          }
          return () => {
            editorScaleSubscribers.current.delete(input);
          };
        },
        [],
      ),
      setToolbarScale = runtime.reactd0.useCallback(
        (input: number) => {
          editorScaleRef.current = input;
          for (let value of editorScaleSubscribers.current)
            value(input);
        },
        [],
      ),
      gridZoomApiRef = runtime.reactd0.useRef<GridZoomApi | null>(null),
      showCommentSlide = runtime.reactd0.useCallback(
        (input: string, options?: ClientPoint) =>
          gridZoomApiRef.current?.showSlide(input, options) ?? false,
        [],
      ),
      commentViewSettling = runtime.reactd0.useCallback(
        () => gridZoomApiRef.current?.settling() ?? true,
        [],
      ),
      [commentViewReveal, setCommentViewReveal] =
        runtime.reactd0.useState<ParsedCommentAnchor | null>(null),
      commentModeRef = runtime.reactd0.useRef(false),
      gridLeavingPanelRef = runtime.reactd0.useRef<HTMLElement | null>(null),
      gridScaleRef = runtime.reactd0.useRef<number | null>(null),
      gridScaleSubscribers = runtime.reactd0.useRef(new Set<ScaleListener>()),
      subscribeGridScale = runtime.reactd0.useCallback(
        (input: ScaleListener) => {
          gridScaleSubscribers.current.add(input);
          if (gridScaleRef.current !== null) {
            input(gridScaleRef.current);
          }
          return () => {
            gridScaleSubscribers.current.delete(input);
          };
        },
        [],
      ),
      onGridScaleChange = runtime.reactd0.useCallback(
        (input: number) => {
          gridScaleRef.current = input;
          for (let value of gridScaleSubscribers.current)
            value(input);
        },
        [],
      ),
      [railOpen, setRailOpen] = runtime.reactd0.useState(
        () =>
          (0, runtime.canResizeSlideRail)(
            window.innerWidth,
            window.innerHeight,
          ),
      ),
      [notesOpen, setNotesOpen] = runtime.reactd0.useState(false),
      [notesHeight, setNotesHeight] = runtime.reactd0.useState(
        runtime.DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT,
      ),
      [thumbWidth, setThumbWidth] = runtime.reactd0.useState(
        runtime.readRailThumbWidthPreference,
      ),
      railGeometryRef = runtime.reactd0.useRef<(() => RailMeasure | null) | null>(null),
      notesResizeGeometryRef = runtime.reactd0.useRef<RailMeasure | null>(null),
      [inspectorOpen, setInspectorOpen] =
        runtime.reactd0.useState(false),
      inspectorContentRef = runtime.reactd0.useRef<HTMLElement | null>(null),
      inspectorRegion = runtime.reactd0.useCallback(
        () =>
          inspectorContentRef.current?.closest(
            '[role="complementary"], [role="dialog"]',
          ) ?? null,
        [],
      ),
      inspectorCloseButton =
        runtime.reactd0.useCallback(() => {
          let value =
              inspectorContentRef.current?.querySelectorAll<HTMLElement>(
                runtime.FOCUS_REGION_FOCUSABLE_SELECTOR,
              ) ?? [],
            value2 = Array.from(value).find(
              (input) =>
                input.closest("[data-property-row]") !== null &&
                !input.matches('[data-kit="row-reset"]') &&
                input.getClientRects().length > 0,
            ),
            value3 = inspectorRegion()?.querySelector<HTMLElement>(
              '[data-kit="panel-header"] button',
            );
          return (
            value2 ??
            (value3 !== undefined &&
            value3 !== null &&
            value3.getClientRects().length > 0
              ? value3
              : null)
          );
        }, [inspectorRegion]),
      inspectorReturnFocusRef = runtime.reactd0.useRef<HTMLElement | null>(null),
      inspectorPointerInvocationRef = runtime.reactd0.useRef(false),
      inspectorHadFocusRef = runtime.reactd0.useRef(false),
      inspectorLastFocusRegionRef = runtime.reactd0.useRef<Element | null>(null),
      [pageOcclusionBand, setPageOcclusionBand] =
        runtime.reactd0.useState(0),
      pageOcclusionObserverRef = runtime.reactd0.useRef<ResizeObserver | null>(null),
      creationRailRef = runtime.reactd0.useCallback(
        (input: HTMLElement | null) => {
          pageOcclusionObserverRef.current?.disconnect();
          pageOcclusionObserverRef.current = null;
          if (input === null) {
            setPageOcclusionBand(0);
            return;
          }
          let callback = () => {
            let offsetParent = input.offsetParent;
            setPageOcclusionBand(
              offsetParent instanceof HTMLElement
                ? offsetParent.clientHeight - input.offsetTop
                : 0,
            );
          };
          callback();
          pageOcclusionObserverRef.current = new ResizeObserver(callback);
          pageOcclusionObserverRef.current.observe(input, {
            box: "border-box",
          });
        },
        [],
      ),
      imageUploadInputRef = runtime.reactd0.useRef<HTMLInputElement | null>(null),
      videoUploadInputRef = runtime.reactd0.useRef<HTMLInputElement | null>(null),
      videoLinksEnabled = (0, runtime.canEmbedVideoProvider)(
        "youtube",
      ),
      uploadInvocationRef = runtime.reactd0.useRef(false),
      clickUploadInput = (
        input: boolean,
        options: RefObject<HTMLInputElement | null> = imageUploadInputRef,
      ) => {
        uploadInvocationRef.current = input;
        options.current?.click();
      },
      insertMenuRef = runtime.reactd0.useRef<HTMLElement | null>(null),
      [insertMenuRecentlyActive, setInsertMenuRecentlyActive] =
        runtime.reactd0.useState(false),
      insertGestureActiveRef = runtime.reactd0.useRef(false),
      lastInsertGestureAtRef = runtime.reactd0.useRef(-1 / 0),
      insertGestureSequenceRef = runtime.reactd0.useRef(0);
    runtime.reactd0.useEffect(() => {
      let callback = () => {
          lastInsertGestureAtRef.current = performance.now();
          insertGestureActiveRef.current = true;
          insertGestureSequenceRef.current += 1;
        },
        callback2 = () => {
          lastInsertGestureAtRef.current = -1 / 0;
        },
        callback3 = (event: FocusEvent) => {
          insertGestureActiveRef.current =
            performance.now() - lastInsertGestureAtRef.current < 300;
          setInsertMenuRecentlyActive(
            event.target instanceof Node &&
              (insertMenuRef.current?.contains(event.target) ?? false),
          );
        },
        callback4 = (input: FocusEvent) => {
          setInsertMenuRecentlyActive(
            input.relatedTarget instanceof Node &&
              (insertMenuRef.current?.contains(input.relatedTarget) ?? false),
          );
        };
      document.addEventListener("pointerdown", callback, true);
      document.addEventListener("keydown", callback2, true);
      document.addEventListener("focusin", callback3);
      document.addEventListener("focusout", callback4);
      return () => {
        document.removeEventListener(
          "pointerdown",
          callback,
          true,
        );
        document.removeEventListener("keydown", callback2, true);
        document.removeEventListener("focusin", callback3);
        document.removeEventListener("focusout", callback4);
      };
    }, []);
    runtime.reactd0.useEffect(() => {
      if (!railOpen) {
        setInsertMenuRecentlyActive(false);
      }
    }, [railOpen]);
    let insertWasKeyboard = () =>
        !insertGestureActiveRef.current && !insertMenuRecentlyActive,
      slides = snapshot.slides,
      deckTypeStyles = runtime.reactd0.useMemo(
        () =>
          (0, runtime.inferDeckTypographyStyles)(
            snapshot.baseline,
            snapshot.meta.theme,
          ),
        [snapshot.baseline, snapshot.meta.theme],
      ),
      designSystem = (0, runtime.useDesignSystems)(),
      designSystemActive = (0, runtime.hasDesignSystems)(designSystem),
      typefaceLookup = runtime.reactd0.useMemo(
        () =>
          (0, runtime.collectDeckFontFamilies)(snapshot.faces, snapshot.fonts),
        [snapshot.faces, snapshot.fonts],
      ),
      currentTypeStyles = runtime.reactd0.useMemo(
        () =>
          designSystemActive
            ? (0, runtime.designSystemTypographyStyles)(
                designSystem,
                snapshot.meta.theme,
                typefaceLookup,
              )
            : deckTypeStyles,
        [
          designSystemActive,
          designSystem,
          snapshot.meta.theme,
          typefaceLookup,
          deckTypeStyles,
        ],
      ),
      allTypeStyles = runtime.reactd0.useMemo(
        () =>
          currentTypeStyles === deckTypeStyles
            ? currentTypeStyles
            : [...currentTypeStyles, ...deckTypeStyles],
        [currentTypeStyles, deckTypeStyles],
      ),
      commentController = (0, runtime.useSlideCommentController)({
        onMode: (input: boolean) => {
          if (!input) {
            return setCommentViewReveal(null);
          }
          setSelection([]);
          setTextEditState(null);
        },
        onReveal: (input: ParsedCommentAnchor) => {
          let value = (0, runtime.resolveCommentSlide)(input, slides);
          if (!value) {
            return;
          }
          if (presentationStartIndex !== null) {
            exitPresentation(undefined, false);
          }
          if (gridOpen && commentModeRef.current) {
            setCommentViewReveal(input);
          } else if (gridRequested) {
            closeGrid();
          }
          setCurrentSlideId(value.id);
        },
      }),
      commentMode =
        commentController.ctl !== null && commentController.on;
    commentModeRef.current = commentMode;
    let openCommentCounts = runtime.reactd0.useMemo(
        () =>
          commentMode
            ? (0, runtime.countOpenCommentsBySlide)(
                commentController.threads,
                slides,
              )
            : undefined,
        [commentMode, commentController.threads, slides],
      ),
      commentModePersistent = runtime.reactd0.useCallback(
        (input: Element) =>
          insertMenuRef.current?.contains(input) === true ||
          (gridTransitionActiveRef.current &&
            gridLeavingPanelRef.current?.contains(input) === true) ||
          input.closest("[data-slides-zoom], [data-mc-scrim]") !== null ||
          (input.closest(runtime.OPEN_OVERLAY_SELECTOR) !== null &&
            document.querySelector(
              '[data-slides-zoom] [aria-expanded="true"]',
            ) !== null),
        [],
      ),
      presentableSlides = runtime.reactd0.useMemo(
        () =>
          slides.filter((input) => input.skipped !== true),
        [slides],
      ),
      fontCss = runtime.reactd0.useMemo(
        () =>
          (0, runtime.buildDeckThemeCss)(snapshot.fonts, snapshot.faces),
        [snapshot.fonts, snapshot.faces],
      ),
      fullFontFaces = runtime.reactd0.useMemo(
        () =>
          !(0, runtime.canCarryAnotherFontFace)(
            snapshot.faces,
            (0, runtime.usedDeckFontFamilies)([
              ...snapshot.slides,
              ...snapshot.baseline,
            ]),
          ),
        [snapshot.faces, snapshot.slides, snapshot.baseline],
      );
    runtime.reactd0.useEffect(() => {
      if (presentationStartIndex === null || presentableSlides.length > 0) {
        return;
      }
      exitPresentation();
    }, [presentationStartIndex, presentableSlides.length, exitPresentation]);
    let railSlides = runtime.reactd0.useMemo(
        () =>
          Object.fromEntries(
            slides.map((input) => [input.id, input]),
          ),
        [slides],
      ),
      currentSlide =
        (currentSlideId !== null
          ? slides.find(
              (input) => input.id === currentSlideId,
            )
          : undefined) ??
        slides[Math.min(currentSlideIndexRef.current, slides.length - 1)],
      getCurrentSlide = () =>
        currentSlide !== undefined
          ? (documentStore.getSlide(currentSlide.id) ?? currentSlide)
          : undefined,
      templateRestyler = runtime.reactd0.useMemo(
        () =>
          templatePickerOpen
            ? (0, runtime.createTemplateRestyler)({
                current: currentSlide,
                slides: slides,
                typeStyles: deckTypeStyles,
                theme: snapshot.meta.theme,
              })
            : undefined,
        [
          templatePickerOpen,
          currentSlide,
          slides,
          deckTypeStyles,
          snapshot.meta.theme,
        ],
      ),
      slideHtmlError =
        currentSlide !== undefined
          ? slideHtmlHold2(currentSlide.id)
          : undefined,
      slideErrorMessage =
        slideHtmlError !== undefined
          ? (0, runtime.truncateUtf16Safely)(slideHtmlError, 160) +
            (slideHtmlError.length > 160 ? "…" : "")
          : undefined,
      currentSlideReadOnly =
        readOnly || slideErrorMessage !== undefined,
      canShowEmptyCreation =
        !currentSlide &&
        !readOnly &&
        (documentStore.bootReport.htmlErrors ?? 0) === 0 &&
        !hidingMovedDeck(),
      creationController = (0, runtime.useSlideCreation)({
        doc: documentStore.doc,
        codec: codecState,
        readOnly: readOnly,
        stripOpen: railOpen && !editingGridSlide,
        current: currentSlide?.id ?? null,
      });
    creationActivityRef.current = creationController.person;
    let creationView = creationController.view,
      creationOnEmptyDeck =
        !currentSlide &&
        (creationView.greySlide || creationView.holdsEmptyDeck) &&
        (documentStore.bootReport.htmlErrors ?? 0) === 0 &&
        !hidingMovedDeck(),
      [presentationBusy, setPresentationBusy] =
        runtime.reactd0.useState(false),
      resolvedAwaitedSlideCount = awaitedSlideCount(),
      resolvedAwaitingSlides = resolvedAwaitedSlideCount > 0,
      creationCanShowPlaceholder =
        creationController.mayDraw &&
        (creationView.greySlide ||
          (creationView.cells?.some(
            (input) => input.as === "box",
          ) ??
            false)),
      showAwaitingPlaceholder =
        resolvedAwaitingSlides && !creationCanShowPlaceholder,
      creationControllerRef =
        runtime.reactd0.useRef(creationController);
    creationControllerRef.current = creationController;
    let exportDialogPendingRef = runtime.reactd0.useRef<object | null>(null),
      withExportDialogPending = <T>(input: () => Promise<T>) => {
        let state: object = {};
        exportDialogPendingRef.current = state;
        return input().finally(() => {
          if (exportDialogPendingRef.current === state) {
            exportDialogPendingRef.current = null;
          }
        });
      },
      confirmCompleteDeckExport = (input: string) => {
        if (awaitedSlideCount() === 0) {
          return Promise.resolve(true);
        }
        return withExportDialogPending(
          () =>
            (0, runtime.confirmEditorAction)(
              incompleteDeckExportConfirmation(
                input,
                presentableSlides.length,
                slides.length + resolvedAwaitedSlideCount,
              ),
            ).then(
              (input2) =>
                input2 && exportStateRef.current.presentable.length > 0,
            ),
        );
      },
      askPdfOptions = () =>
        withExportDialogPending(
          () =>
            (0, runtime.requestPdfExportOptions)({
              defaults: runtime.DEFAULT_PDF_EXPORT_OPTIONS,
            }).then(
              (input) =>
                input !== null && exportStateRef.current.presentable.length > 0
                  ? input
                  : null,
            ),
        ),
      waitForGoogleSlidesReady = async (): Promise<void> => {
        if (exportDialogPendingRef.current === null) {
          return;
        }
        (0, runtime.dismissPdfExportOptions)();
        (0, runtime.dismissEditorDialog)();
        let state: object = {};
        exportDialogPendingRef.current = state;
        await new Promise((input) => {
          let value = setTimeout(input, 250);
          requestAnimationFrame(() => {
            clearTimeout(value);
            setTimeout(input, 0);
          });
        });
        if (exportDialogPendingRef.current === state) {
          exportDialogPendingRef.current = null;
        }
      };
    runtime.reactd0.useEffect(() => {
      let value = awaitedSlideCount();
      return subscribeMeta(() => {
        let value2 = awaitedSlideCount();
        if (value > 0 && value2 === 0) {
          (0, runtime.dismissEditorDialog)();
        }
        value = value2;
      });
    }, [awaitedSlideCount, subscribeMeta]);
    let singleSelectedGridSlide =
        gridOpen &&
        gridSelection.sections.length === 0 &&
        gridSelection.slides.length === 1 &&
        gridSelection.slides[0] === currentSlide?.id,
      currentSlideHeld = slideErrorMessage !== undefined;
    runtime.reactd0.useEffect(() => {
      if (currentSlideHeld) {
        setTextEditState(null);
      }
    }, [currentSlideHeld, currentSlide?.id]);
    let remoteHoldDocument =
        "releaseHold" in documentStore.doc ? documentStore.doc : null,
      activeSlideProtection = runtime.reactd0.useMemo(
        () =>
          remoteHoldDocument === null
            ? null
            : (0, runtime.createActiveSlideProtection)(
                (input) =>
                  remoteHoldDocument.releaseHold(input),
              ),
        [remoteHoldDocument],
      );
    runtime.reactd0.useEffect(
      () => () => activeSlideProtection?.dispose(),
      [activeSlideProtection],
    );
    let textEditing = textEdit !== null,
      textEditingRef = runtime.reactd0.useRef(false);
    textEditingRef.current = textEditing;
    runtime.reactd0.useEffect(
      () =>
        activeSlideProtection?.stage(currentSlide?.id, textEditing),
      [activeSlideProtection, currentSlide?.id, textEditing],
    );
    let setProtectedEditorSlide = runtime.reactd0.useCallback(
        (input: SlideId | undefined, options?: boolean) =>
          activeSlideProtection?.input(input, options),
        [activeSlideProtection],
      ),
      liveGestureRef = runtime.reactd0.useRef(false),
      dragActiveRef = runtime.reactd0.useRef(false),
      editorBusyPredicate = () =>
        presentingRef.current ||
        liveGestureRef.current ||
        dragActiveRef.current ||
        textEditingRef.current,
      recentGestureRef = runtime.reactd0.useRef(false);
    runtime.reactd0.useEffect(() => {
      (0, runtime.setRecentSlideBusyPredicate)(
        () => recentGestureRef.current || dragActiveRef.current,
      );
      return () => (0, runtime.setRecentSlideBusyPredicate)(undefined);
    }, []);
    let [gestureGeneration, bumpGestureGeneration] =
        runtime.reactd0.useState(0),
      onLiveChange = runtime.reactd0.useCallback(
        (input: Slide) => {
          if (slideHtmlHold2(input.id) !== undefined) {
            return;
          }
          setProtectedEditorSlide(
            input.id,
            textEditingRef.current ? undefined : true,
          );
          if (!textEditingRef.current) {
            recentGestureRef.current = true;
          }
          liveGestureRef.current = true;
          gestureSelectionController.gestureFrame(
            documentStore.getSlide(input.id),
          );
          documentStore.setSlide(input);
        },
        [setProtectedEditorSlide, documentStore, gestureSelectionController],
      );
    runtime.reactd0.useEffect(() => {
      if (!currentSlide) {
        return;
      }
      setSelection((items) => {
        let value = (0, runtime.filterValidSelections)(
          currentSlide,
          items,
        );
        if (value.length === items.length) {
          return items;
        } else {
          return value;
        }
      });
    }, [currentSlide]);
    let slideCapacityAvailable = runtime.reactd0.useCallback(
        (input: SlideId) => {
          if (slideHtmlHold2(input) === undefined) {
            return false;
          }
          (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
          return true;
        },
        [],
      ),
      canChangeSlide = runtime.reactd0.useCallback(
        (input: Slide) => {
          if (slideHtmlHold2(input.id) !== undefined) {
            (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
            return false;
          }
          documentStore.setSlide(input);
          return true;
        },
        [documentStore],
      ),
      commitDocumentBoundary = runtime.reactd0.useCallback(
        (input?: string) => documentStore.doc.commit?.(input),
        [documentStore],
      ),
      getSlideRevision = runtime.reactd0.useCallback(
        (input: SlideId) => documentStore.doc.slideRev?.(input) ?? 0,
        [documentStore],
      ),
      slideHasConflict = runtime.reactd0.useCallback(
        (input: SlideId) =>
          documentStore.doc.clashLocal?.(input) ?? false,
        [documentStore],
      ),
      commitSlideEdit = runtime.reactd0.useCallback(
        (
          input: Slide,
          options: Slide,
          context: string | undefined,
          value = false,
        ) => {
          if (JSON.stringify(input) === JSON.stringify(options)) {
            return;
          }
          if (slideHtmlHold2(options.id) !== undefined) {
            return void canChangeSlide(options);
          }
          let value2: number | null = null,
            callback = (
              input2: Slide,
              options2: "do" | "undo",
            ) => {
              let value3 =
                  value2 !== null && getSlideRevision(input2.id) !== value2,
                value4 = documentStore.getSlide(input2.id);
              if (!canChangeSlide(input2)) {
                return false;
              }
              if (value3 && slideHasConflict(input2.id)) {
                (0, runtime.reportArtifactFeedback)("undo-refused", {
                  slide: input2.id,
                  kind: options2,
                  label: context,
                  why: "a newer remote version of this slide arrived since the step was recorded",
                });
              } else {
                commitDocumentBoundary(
                  options2 === "do" ? "edit step" : "undo step",
                );
              }
              value2 = getSlideRevision(input2.id);
              return documentStore.getSlide(input2.id) !== value4;
            };
          undoHistory.exec(
            gestureSelectionController.command(
              options.id,
              context,
              (input2) =>
                callback(input2 === "do" ? options : input, input2),
              value ? input : undefined,
            ),
          );
        },
        [
          undoHistory,
          documentStore,
          canChangeSlide,
          commitDocumentBoundary,
          getSlideRevision,
          slideHasConflict,
          gestureSelectionController,
        ],
      ),
      notesEditGesture = runtime.reactd0.useMemo(
        () => ({
          live: (input: Slide) => {
            if (slideHtmlHold2(input.id) !== undefined) {
              return;
            }
            setProtectedEditorSlide(input.id, true);
            documentStore.updateSlide(
              input.id,
              (input2) =>
                (0, runtime.setSlideSpeakerNotes)(input2, input.notes),
            );
          },
          end: (input: Slide) => {
            setProtectedEditorSlide(input.id, false);
            let value = documentStore.getSlide(input.id);
            if (
              !value ||
              slideHtmlHold2(input.id) !== undefined ||
              value.notes === input.notes
            ) {
              return;
            }
            commitSlideEdit(
              (0, runtime.setSlideSpeakerNotes)(value, input.notes),
              value,
              "edit",
            );
          },
        }),
        [documentStore, commitSlideEdit, setProtectedEditorSlide],
      ),
      commitCompletedGesture = runtime.reactd0.useCallback(
        (input: Slide) => {
          let value = documentStore.getSlide(input.id);
          if (!value) {
            return;
          }
          commitSlideEdit(input, value, "edit", true);
        },
        [documentStore, commitSlideEdit],
      ),
      onGestureEnd = runtime.reactd0.useCallback(
        (input: Slide) => {
          if (slideHtmlHold2(input.id) === undefined) {
            commitCompletedGesture(input);
          }
          gestureSelectionController.gestureEnd();
          liveGestureRef.current = false;
          recentGestureRef.current = false;
          setProtectedEditorSlide(input.id, false);
          bumpGestureGeneration((input2) => input2 + 1);
          commitDocumentBoundary("pointer-up");
        },
        [
          commitCompletedGesture,
          setProtectedEditorSlide,
          commitDocumentBoundary,
          gestureSelectionController,
        ],
      );
    runtime.reactd0.useEffect(() => {
      if (!textEditing) {
        commitDocumentBoundary("caret closed");
      }
    }, [textEditing, commitDocumentBoundary]);
    let editorViewStateRef = runtime.reactd0.useRef<EditorViewState>({
      presenting: false,
      slideId: null,
      selection: [],
    });
    editorViewStateRef.current = {
      presenting: presentationStartIndex !== null,
      slideId:
        (presentationStartIndex !== null
          ? presentableSlides[
              presentationCurrentIndex ?? presentationStartIndex
            ]?.id
          : currentSlide?.id) ?? null,
      selection: selection,
    };
    let shownSlideId = editorViewStateRef.current.slideId,
      placeLinkReporterRef = runtime.reactd0.useRef<PlaceLinkReporter | null>(null),
      gotoSlideRef = runtime.reactd0.useRef<(input: SlideId | null) => void>(() => {
        return;
      });
    gotoSlideRef.current = (input: SlideId | null) => {
      if (presentationStartIndex !== null) {
        exitPresentation(undefined, false);
      }
      if (gridRequested) {
        closeGrid();
      }
      if (input === currentSlideId) {
        return;
      }
      setCurrentSlideId(input);
      setSelection([]);
      setTextEditState(null);
    };
    let placeLinkStateRef = runtime.reactd0.useRef<PlaceLinkState>({
      order: [],
      shownId: null,
    });
    placeLinkStateRef.current = {
      order: snapshot.meta.order,
      shownId: shownSlideId,
    };
    let standalonePage = host === undefined;
    runtime.reactd0.useEffect(() => {
      if (!standalonePage) {
        return;
      }
      let value = (0, runtime.createPlaceLinkReporter)();
      placeLinkReporterRef.current = value;
      let value2 = (0, runtime.subscribeGotoAnchorMessages)(
        (input) => {
          let value3 = (0, runtime.resolveSlidePlaceFragment)(
            input,
            placeLinkStateRef.current.order,
          );
          if (value3 !== undefined) {
            clearInitialPlaceLink();
            (0, runtime.writePlaceLinkField)("goto", input);
            gotoSlideRef.current(value3);
          }
          let value4 = value3 ?? placeLinkStateRef.current.shownId;
          if (value4 !== null) {
            value.answer((0, runtime.slidePlaceFragment)(value4));
          }
        },
      );
      return () => {
        value2();
        value.stop();
        placeLinkReporterRef.current = null;
      };
    }, [standalonePage]);
    runtime.reactd0.useEffect(() => {
      if (shownSlideId !== null) {
        placeLinkReporterRef.current?.report(
          (0, runtime.slidePlaceFragment)(shownSlideId),
        );
      }
    }, [shownSlideId]);
    let presentedSlideId = editorViewStateRef.current.presenting
        ? editorViewStateRef.current.slideId
        : null,
      lastReportedPresentationRef = runtime.reactd0.useRef<ReportedPresentation>({
        presenting: false,
        slideId: null,
      });
    runtime.reactd0.useEffect(() => {
      let current = lastReportedPresentationRef.current,
        value = presentationStartIndex !== null;
      if (
        value === current.presenting &&
        presentedSlideId === current.slideId
      ) {
        return;
      }
      (0, runtime.reportArtifactFeedback)("present", {
        state: !value ? "ended" : !current.presenting ? "started" : "slide",
        slide: presentedSlideId,
        ...(current.presenting && value
          ? {
              from: current.slideId,
            }
          : {}),
      });
      lastReportedPresentationRef.current = {
        presenting: value,
        slideId: presentedSlideId,
      };
    }, [presentationStartIndex, presentedSlideId]);
    let deferredPresentationRestoreRef = runtime.reactd0.useRef<EditorViewState | null>(null);
    runtime.reactd0.useEffect(
      () =>
        (0, runtime.registerEditorViewStateAdapter)({
          snapshot: () => editorViewStateRef.current,
          busy: editorBusyPredicate,
          restore: (input: EditorViewState) => {
            if (input.slideId !== null) {
              setCurrentSlideId(input.slideId);
            }
            if (Array.isArray(input.selection)) {
              setSelection(input.selection);
            }
            deferredPresentationRestoreRef.current = input.presenting
              ? input
              : null;
          },
        }),
      [],
    );
    runtime.reactd0.useEffect(() => {
      let current = deferredPresentationRestoreRef.current;
      if (
        current === null ||
        !current.presenting ||
        presentationStartIndex !== null
      ) {
        return;
      }
      let value = presentableSlides.findIndex(
        (input) => input.id === current.slideId,
      );
      if (value < 0) {
        return;
      }
      deferredPresentationRestoreRef.current = null;
      presentingRef.current = true;
      setFullscreenRequest("next");
      setPresentationStartIndex(value);
    }, [presentableSlides, presentationStartIndex]);
    runtime.reactd0.useEffect(() => {
      if (!liveGestureRef.current && !recentGestureRef.current) {
        return;
      }
      liveGestureRef.current = false;
      recentGestureRef.current = false;
      gestureSelectionController.gestureEnd();
      bumpGestureGeneration((input) => input + 1);
      activeSlideProtection?.poke();
    }, [
      readOnly,
      currentSlide?.id,
      activeSlideProtection,
      gestureSelectionController,
    ]);
    let onChangeSlide = runtime.reactd0.useCallback(
        (input: Slide, options?: DeckFontFace) => {
          let value = documentStore.getSlide(input.id);
          if (!value) {
            return;
          }
          let value2 = documentStore.getSnapshot().faces ?? [];
          if (
            options === undefined ||
            (0, runtime.fontFaceMenuLabel)(value2, options) ||
            slideHtmlHold2(input.id) !== undefined
          ) {
            return commitSlideEdit(value, input, "inspect");
          }
          let callback = (input2: Slide) =>
              (0, runtime.usedDeckFontFamilies)([
                ...documentStore
                  .getSnapshot()
                  .slides.map(
                    (input3) =>
                      input3.id === input2.id ? input2 : input3,
                  ),
                ...documentStore.getSnapshot().baseline,
              ]),
            items: DeckFontFace[] = [],
            items2: DeckFontFace[] = [];
          undoHistory.exec({
            label: "inspect",
            canDo: () => {
              let value3 = documentStore.getSnapshot().faces ?? [],
                value4 =
                  !documentStore.getSlide(input.id) ||
                  (0, runtime.fontFaceMenuLabel)(value3, options)
                    ? []
                    : (0, runtime.removableCarriedFontFaces)(
                        value3,
                        callback(input),
                      );
              if (value4 === null) {
                (0, runtime.showToast)(runtime.DECK_FONT_LIMIT_MESSAGE + ".");
              } else {
                items = value4;
              }
              return value4 !== null;
            },
            do: () => {
              if (!documentStore.getSlide(input.id) || !canChangeSlide(input)) {
                return;
              }
              let value3 = documentStore.getSnapshot().faces ?? [];
              if ((0, runtime.fontFaceMenuLabel)(value3, options)) {
                return;
              }
              items2 = items;
              let value4 = (0, runtime.addCarriedFontFace)(
                value3,
                options,
                items2,
                callback(input),
              );
              if (value4 !== null) {
                documentStore.setFaces(value4);
              }
            },
            undo: () => {
              if (!documentStore.getSlide(value.id) || !canChangeSlide(value)) {
                return;
              }
              documentStore.setFaces(
                (0, runtime.restoreCarriedFontFaces)(
                  documentStore.getSnapshot().faces ?? [],
                  options,
                  items2,
                  callback(value),
                ),
              );
            },
          });
        },
        [documentStore, undoHistory, commitSlideEdit, canChangeSlide],
      ),
      insertFrame = runtime.reactd0.useCallback(
        (
          input: Frame,
          options: string | undefined,
          context = false,
        ) => {
          let value = getCurrentSlide();
          if (!value || currentSlideReadOnly) {
            return false;
          }
          if (value.frames.length >= runtime.maxSlideFrames) {
            (0, runtime.showToast)(
              "This slide is full — remove an element first.",
            );
            return false;
          }
          if (
            gridOpen &&
            !(singleSelectedGridSlide && openGridSlideInEditor(value.id))
          ) {
            return false;
          }
          let value2 = value;
          commitSlideEdit(
            value2,
            (0, runtime.appendSlideFrame)(value2, input),
            options,
          );
          if (context && !gridOpen) {
            editorZoomApiRef.current?.landOnCreated(input.id);
          }
          setSelection([
            {
              frameId: input.id,
            },
          ]);
          return true;
        },
        [
          currentSlide,
          currentSlideReadOnly,
          commitSlideEdit,
          gridOpen,
          singleSelectedGridSlide,
          openGridSlideInEditor,
        ],
      ),
      insertVideoLink = (
        input: VideoLink,
        options: string | undefined,
        context = false,
      ) =>
        insertFrame(
          {
            id: (0, runtime.createModelId)(),
            ...placeInsertedFrame(undefined, 960, 540),
            node: {
              kind: "img",
              alt: "",
              fit: "cover",
              videoLink: input,
            },
          },
          options,
          context,
        ),
      videoLinkInsertionRef = runtime.reactd0.useRef({
        insertVideoLink: insertVideoLink,
        held: currentSlideHeld && !readOnly,
      });
    videoLinkInsertionRef.current = {
      insertVideoLink: insertVideoLink,
      held: currentSlideHeld && !readOnly,
    };
    let askYoutubeUrl = async (input?: boolean): Promise<void> => {
        let current = insertGestureSequenceRef.current,
          value = await (0, runtime.promptEditorText)({
            title: "Embed a YouTube video",
            inputLabel: "YouTube link",
            placeholder: "https://www.youtube.com/watch?v=…",
            confirmLabel: "Add video",
          });
        if (value === null) {
          return;
        }
        let value2 = (0, runtime.parseVideoLinkUrl)(value);
        if (value2 === null) {
          (0, runtime.showToast)("That isn’t a link to a YouTube video.");
        } else if (
          !videoLinkInsertionRef.current.insertVideoLink(
            value2,
            "insert video",
            input && insertGestureSequenceRef.current === current,
          ) &&
          videoLinkInsertionRef.current.held
        ) {
          (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
        }
      },
      canAddTableCells = (input: number) => {
        if (!currentSlide) {
          return false;
        }
        if (input <= 0) {
          return true;
        }
        if (
          (0, runtime.countSlideTableCells)(currentSlide) + input >
          runtime.maxSlideTableCells
        ) {
          (0, runtime.showToast)(
            "This slide can't hold more table cells — remove some first.",
          );
          return false;
        }
        if (
          (0, runtime.countDeckTableCells)(slides) + input >
          runtime.maxDeckTableCells
        ) {
          (0, runtime.showToast)(
            "This presentation can't hold more table cells — remove some first.",
          );
          return false;
        }
        return true;
      },
      canAddFrames = (input: number) => {
        if (!currentSlide) {
          return false;
        }
        if (input <= 0) {
          return true;
        }
        if (
          (0, runtime.countSlideEmbeds)(currentSlide) + input >
          runtime.maxSlideHtmlEmbeds
        ) {
          (0, runtime.showToast)(
            "This slide can’t hold more web embeds (" +
              String(runtime.maxSlideHtmlEmbeds) +
              " max) — remove one first.",
          );
          return false;
        }
        return true;
      },
      referencedAssetIds = () => {
        let values = new Set<string>();
        for (let value of documentStore.getSnapshot().meta.order) {
          let value2 = documentStore.getSlide(value);
          if (value2) {
            (0, runtime.collectSlideAssetIds)(value2, values);
          }
        }
        return values;
      },
      showPasteWarnings = (input: Iterable<[string, string]>) => {
        let items: string[] = [];
        for (let [value, value2] of input)
          if (documentStore.getAsset(value) === undefined) {
            documentStore.setAssetEntry(value, value2);
            items.push(value);
          }
        return items;
      },
      canAddStyledNodes = (input: SlideNode | SlideNode[]) => {
        let value = Array.isArray(input) ? input : [input],
          state = {
            effects: 0,
            animated: 0,
          };
        for (let value2 of value) {
          let value3 = (0, runtime.countNodeEffects)(value2);
          state.effects += value3.effects;
          state.animated += value3.animated;
        }
        if (state.effects === 0 && state.animated === 0) {
          return true;
        }
        let index = 0,
          index2 = 0;
        for (let value2 of slides)
          for (let value3 of value2.frames) {
            let value4 = (0, runtime.countNodeEffects)(value3.node);
            index += value4.effects;
            index2 += value4.animated;
          }
        if (
          state.effects > 0 &&
          index + state.effects > runtime.maxSlidePaintCost
        ) {
          (0, runtime.showToast)(
            "This presentation can't hold more visual effects — remove some first.",
          );
          return false;
        }
        if (
          state.animated > 0 &&
          index2 + state.animated > runtime.maxSlideAnimations
        ) {
          (0, runtime.showToast)(
            "This presentation can't hold more animations — remove some first.",
          );
          return false;
        }
        return true;
      },
      insertText = ({ at: input }: InsertPlacement = {}) => {
        let value = placeInsertedFrame(input, 800),
          value2 = (0, runtime.defaultBodyTypographyStyle)(
            deckTypeStyles,
          ),
          state: TextNode = {
            kind: "text",
            role: "body",
            text: "Text",
            ...(value2 !== null
              ? {
                  style: {
                    fontWeight: value2.fontWeight,
                  },
                }
              : {}),
          },
          state2 = {
            id: (0, runtime.createModelId)(),
            x: value.x,
            y: value.y,
            node:
              value2 !== null
                ? (0, runtime.applyTypographyStyle)(
                    state,
                    value2,
                    snapshot.meta.theme,
                  )
                : state,
          };
        if (insertFrame(state2, "insert text") && currentSlide !== undefined) {
          setTextEditState({
            frameId: state2.id,
            path: [],
          });
          setProtectedEditorSlide(currentSlide.id);
        }
      },
      insertTable = ({
        at: input,
        byKey: input2,
      }: InsertPlacement = {}) => {
        let items = [
          ["Column", "Column", "Column"],
          ["", "", ""],
          ["", "", ""],
        ];
        if (!canAddTableCells(items.length * 3)) {
          return;
        }
        let value = placeInsertedFrame(input, 900);
        insertFrame(
          {
            id: (0, runtime.createModelId)(),
            x: input
              ? value.x
              : {
                  anchor: "leading",
                  margin: 128,
                  offset: 0,
                  size: 900,
                },
            y: input
              ? value.y
              : {
                  anchor: "center",
                  margin: 0,
                  offset: 0,
                },
            node: {
              kind: "table",
              rows: items,
              cols: 3,
              header: true,
            },
          },
          "insert table",
          input2,
        );
      },
      insertShape = (
        input: string,
        { at: options, byKey: options2 }: InsertPlacement = {},
      ) => {
        let value = input === "line",
          value2 = input === "connector",
          value3 = placeInsertedFrame(
            options,
            value || value2 ? 480 : 300,
            value
              ? 8
              : value2
                ? 2 *
                  (0, runtime.connectorArrowInset)(
                    runtime.defaultShapeStrokeWidth,
                  )
                : 300,
          );
        insertFrame(
          {
            id: (0, runtime.createModelId)(),
            x: value3.x,
            y: value3.y,
            node: value2
              ? {
                  kind: "shape",
                  shape: input as ShapeVariant,
                  stroke: (0, runtime.themeAccentColor)(snapshot.meta.theme),
                  strokeWidth: runtime.defaultShapeStrokeWidth,
                }
              : {
                  kind: "shape",
                  shape: input === "rounded" ? "rect" : (input as ShapeVariant),
                  style: {
                    backgroundColor: value
                      ? snapshot.meta.theme === "neutral"
                        ? "#1a1a1a"
                        : "#141413"
                      : (0, runtime.themeAccentColor)(snapshot.meta.theme),
                    ...(input === "rounded"
                      ? {
                          borderRadius: runtime.maxShapeCornerRadius,
                        }
                      : {}),
                  },
                },
          },
          "insert shape",
          options2,
        );
      },
      imageReductionNoticesRef = runtime.reactd0.useRef(new Set<string>()),
      prepareImageAsset = async (
        input: Blob,
        options = "image",
      ): Promise<StoredImageAsset> => {
        let value = await (0, runtime.storeImageAsset)(input);
        if (
          value.kind === "data" &&
          value.reason !== "unsupported_type" &&
          !imageReductionNoticesRef.current.has(value.reason)
        ) {
          imageReductionNoticesRef.current.add(value.reason);
          (0, runtime.showToast)(
            "Stored a compressed copy of the " +
              options +
              " (" +
              (value.reason === "unavailable"
                ? "uploads aren’t available in this view"
                : value.reason === "too_large"
                  ? "it is too large to upload as-is"
                  : "the upload didn’t go through") +
              ").",
          );
        }
        return value;
      },
      [pendingUploads, setPendingUploads] = runtime.reactd0.useState<PendingUpload[]>(
        [],
      ),
      readImageUpload = async (
        input: File,
        options: (request: VideoShrinkPlan) => void,
      ): Promise<boolean> => {
        let value = (0, runtime.videoFileRefusalReason)(input),
          value2 =
            value === null || value === "too_large"
              ? (await (0, runtime.getAssetsCapability)()) !== null
              : true,
          value3 = value ?? (value2 ? null : "unavailable");
        if (value3 === null) {
          return false;
        }
        if (
          value3 === "too_large" &&
          value2 &&
          (await (0, runtime.canShrinkVideo)())
        ) {
          let value4 = (0, runtime.probeVideoFile)(input),
            value5 = await (0, runtime.captureVideoPoster)(input);
          if (typeof value5 === "string" && value5 !== "probe_timeout") {
            (0, runtime.showToast)((0, runtime.videoRefusalMessage)(value5));
            return true;
          }
          let value6 = await value4;
          if (!mountedRef.current) {
            return true;
          }
          let value7 =
            value6 === null || typeof value5 === "string"
              ? "cannot_decode"
              : (0, runtime.initialVideoEncodingPlan)(value6);
          if (
            value6 !== null &&
            typeof value5 !== "string" &&
            typeof value7 !== "string"
          ) {
            options({
              probe: value6,
              plan: value7,
              poster: jpegReplacementUploadInput(input, value5),
            });
            return true;
          }
          if (value7 === "too_long") {
            (0, runtime.showToast)(
              (0, runtime.videoShrinkFailureMessage)("too_long"),
            );
            return true;
          }
        }
        (0, runtime.showToast)((0, runtime.videoRefusalMessage)(value3));
        return true;
      },
      ownedUploadPathsRef = runtime.reactd0.useRef(new Set<number>()),
      ownedUploadUrlsRef = runtime.reactd0.useRef(new Set<number>()),
      mountedRef = runtime.reactd0.useRef(true);
    runtime.reactd0.useEffect(() => {
      mountedRef.current = true;
      let current = ownedUploadPathsRef.current,
        current2 = ownedUploadUrlsRef.current;
      return () => {
        mountedRef.current = false;
        if (
          (0, runtime.getVideoShrinkJobs)().some(
            (input) => current.has(input.id),
          )
        ) {
          (0, runtime.showToast)(
            "The video wasn’t added because its presentation was closed.",
            0,
          );
        }
        for (let value of [...current])
          (0, runtime.cancelVideoShrink)(value);
        for (let value of [...current2])
          (0, runtime.closeToast)(value);
      };
    }, []);
    let canShowUploadNotice = async (): Promise<boolean> => {
        while (mountedRef.current && presentingRef.current)
          await new Promise(
            (input) => setTimeout(input, 250),
          );
        return mountedRef.current;
      },
      showUploadWarning = (input: string) =>
        void canShowUploadNotice().then(
          (input2) =>
            input2 ? (0, runtime.showToast)(input, 0) : undefined,
        ),
      prepareVideoUpload = async (
        input: File,
        options: Pick<VideoShrinkPlan, "probe" | "plan">,
      ): Promise<ReadyVideoShrink | null> => {
        if (!mountedRef.current) {
          return null;
        }
        let value = (0, runtime.enqueueVideoShrink)({
          file: input,
          probe: options.probe,
          plan: options.plan,
          encoder: runtime.videoWorkerEncoder,
        });
        ownedUploadPathsRef.current.add(value.id);
        let value2 = await value.result,
          callback = () =>
            void ownedUploadPathsRef.current.delete(value.id);
        if (value2.kind === "ready" && mountedRef.current) {
          return {
            ...value2,
            release: () => {
              callback();
              return value2.release();
            },
            rest: () => {
              callback();
              return value2.rest();
            },
            resume: () =>
              value2.resume() &&
              (ownedUploadPathsRef.current.add(value.id), true),
          };
        }
        callback();
        if (value2.kind === "ready") {
          value2.release();
        } else if (value2.kind === "failed") {
          (0, runtime.reportArtifactFeedback)("video-shrink-failed", {
            reason: value2.reason,
            detail: value2.detail,
          });
          showUploadWarning(
            (0, runtime.videoShrinkFailureMessage)(value2.reason),
          );
        }
        return null;
      },
      canCompleteUpload = (
        input: SlideId,
        options: boolean,
        context = "added",
      ) => {
        let value = documentStore.getSlide(input);
        if (value === undefined) {
          showUploadWarning(
            "The video wasn’t " + context + " because its slide was deleted.",
          );
        } else if (
          documentStore.doc.readOnly() ||
          slideHtmlHold2(input) !== undefined
        ) {
          showUploadWarning(
            "The video wasn’t " +
              context +
              " because the presentation can’t be edited right now.",
          );
        } else if (options && value.frames.length >= runtime.maxSlideFrames) {
          showUploadWarning(
            "The video wasn’t added because its slide is full. Remove an element, then add the video again.",
          );
        } else {
          return true;
        }
        return false;
      },
      confirmVideoReplacement = async (
        input: ReadyVideoShrink,
      ): Promise<boolean> => {
        while (
          mountedRef.current &&
          !input.signal.aborted &&
          editorBusyPredicate()
        ) {
          input.waitingFor(
            textEditingRef.current && !presentingRef.current ? "typing" : null,
          );
          await new Promise(
            (input2) => setTimeout(input2, 250),
          );
        }
        input.waitingFor(null);
        return mountedRef.current && !input.signal.aborted;
      },
      reduceImageUpload = async (
        input: File,
      ): Promise<JpegReplacementUpload | null> => {
        let value = await (0, runtime.captureVideoPoster)(input);
        if (typeof value === "string") {
          (0, runtime.showToast)((0, runtime.videoRefusalMessage)(value));
          return null;
        }
        return jpegReplacementUploadInput(input, value);
      },
      uploadImageAsset = async (
        input: File,
        options: VideoMetadata,
      ): Promise<string | null> => {
        let value = await (0, runtime.storeVideoAsset)(input, {
          probed: options,
        });
        if (value.kind === "blob") {
          return value.src;
        }
        (0, runtime.showToast)((0, runtime.videoRefusalMessage)(value.reason));
        return null;
      },
      uploadReplacementImage = async (
        input: ReadyVideoShrink,
        options: VideoMetadata,
        context: () => boolean,
      ): Promise<string | null> => {
        for (let index = 0; ; index++) {
          if (index > 0 && !(mountedRef.current && context())) {
            return null;
          }
          if (index > 0 && !input.resume()) {
            return null;
          }
          let promise = new Promise<null>(
              (input2) =>
                input.signal.aborted
                  ? input2(null)
                  : input.signal.addEventListener(
                      "abort",
                      () => input2(null),
                      {
                        once: true,
                      },
                    ),
            ),
            value = await Promise.race([
              (0, runtime.storeVideoAsset)(input.file, {
                probed: options,
              }),
              promise,
            ]);
          if (value === null || input.signal.aborted) {
            return null;
          }
          if (value.kind === "blob") {
            return value.src;
          }
          if (VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES.has(value.reason)) {
            showUploadWarning((0, runtime.videoRefusalMessage)(value.reason));
            return null;
          }
          input.rest();
          if (!(await canShowUploadNotice())) {
            return null;
          }
          if (
            !(await new Promise((input2) => {
              let value2 = (0, runtime.showActionToast)(
                (0, runtime.videoRefusalMessage)(value.reason),
                SlidesAppJsx.jsx(runtime.Button, {
                  size: "sm",
                  variant: "secondary",
                  onClick: () => {
                    input2(true);
                    (0, runtime.closeToast)(value2);
                  },
                  children: "Try again",
                }),
                () => {
                  ownedUploadUrlsRef.current.delete(value2);
                  input2(false);
                },
              );
              ownedUploadUrlsRef.current.add(value2);
            }))
          ) {
            return null;
          }
        }
      },
      activeReplacementUploadsRef = runtime.reactd0.useRef(new Set<string>()),
      uploadAndInsertImage = async (
        input: string,
        options: NodePath,
        context: File,
        value?: VideoReplacementResume,
      ): Promise<void> => {
        let value2 = (0, runtime.isVideoFile)(context)
            ? context
            : undefined,
          value3: "video" | "image" = value2 !== undefined ? "video" : "image",
          value4 = value?.slideId ?? currentSlide?.id ?? "",
          value5 = value4 + "/" + input + "/" + options.join("."),
          value6 = (0, runtime.createModelId)(),
          value7: string | undefined,
          flag = false,
          value8: ReturnType<typeof setTimeout> | undefined,
          callback = () => {
            return;
          },
          callback2 = () => {
            clearTimeout(value8);
            if (flag) {
              activeReplacementUploadsRef.current.delete(value5);
            }
            flag = false;
            if (value7 !== undefined) {
              setPendingUploads(
                (input2) =>
                  input2.filter(
                    (input3) => input3.id !== value6,
                  ),
              );
              URL.revokeObjectURL(value7);
              value7 = undefined;
            }
          };
        try {
          if (
            value4 === "" ||
            (value === undefined
              ? currentSlideReadOnly
              : !canCompleteUpload(value4, false, "replaced"))
          ) {
            return;
          }
          if (activeReplacementUploadsRef.current.has(value5)) {
            (0, runtime.showToast)("Still uploading the last file.");
            return;
          }
          let value9 = documentStore.getSlide(value4),
            value10 = value9
              ? (0, runtime.frameById)(value9, input)
              : undefined,
            value11 = value10
              ? (0, runtime.nodeAtPath)(value10.node, options)
              : undefined;
          if (value11?.kind !== "img" || value10 === undefined) {
            if (value !== undefined) {
              showUploadWarning(VIDEO_REPLACEMENT_STALE_MESSAGE);
            }
            return;
          }
          let value12 = value?.clicked;
          if (
            value12 !== undefined &&
            (value12.asset !== value11.asset ||
              value12.src !== value11.src ||
              value12.video !== value11.video)
          ) {
            showUploadWarning(VIDEO_REPLACEMENT_STALE_MESSAGE);
            return;
          }
          if (value11.video !== undefined) {
            value3 = "video";
          }
          if (value2 !== undefined && value11.video === undefined) {
            (0, runtime.showToast)(
              "Pick an image file here. To add a video, use the Image or video button or drop it onto the slide.",
            );
            return;
          }
          let state = {
            asset: value11.asset,
            src: value11.src,
            video: value11.video,
          };
          if (
            value2 !== undefined &&
            value === undefined &&
            (await readImageUpload(
              value2,
              (input2) =>
                void uploadAndInsertImageRef.current(input, options, context, {
                  slideId: value4,
                  clicked: state,
                  ...input2,
                }),
            ))
          ) {
            return;
          }
          if (
            value2 !== undefined &&
            activeReplacementUploadsRef.current.has(value5)
          ) {
            return;
          }
          if (value2 !== undefined) {
            activeReplacementUploadsRef.current.add(value5);
            flag = true;
            value8 = setTimeout(
              callback2,
              value !== undefined ? MAX_VIDEO_DURATION_MS : 600000,
            );
          }
          let value13 =
            value?.poster ??
            (value2 !== undefined
              ? await reduceImageUpload(value2)
              : undefined);
          if (value13 === null) {
            return;
          }
          let value14 = value13?.file ?? context;
          if (value2 !== undefined) {
            value7 = URL.createObjectURL(value14);
            let value24 = value7;
            setPendingUploads(
              (input2) => [
                ...input2,
                {
                  id: value6,
                  slideId: value4,
                  rect: (0, runtime.frameBounds)(value10.x, value10.y),
                  url: value24,
                  what: value3,
                },
              ],
            );
          }
          let callback3 = (input2: Slide | undefined) => {
              let value24 = input2
                  ? (0, runtime.frameById)(input2, input)
                  : undefined,
                value25 = value24
                  ? (0, runtime.nodeAtPath)(value24.node, options)
                  : undefined;
              if (
                value25?.kind === "img" &&
                value25.asset === value11.asset &&
                value25.src === value11.src &&
                value25.video === value11.video
              ) {
                return value25;
              }
              if (value !== undefined) {
                showUploadWarning(VIDEO_REPLACEMENT_STALE_MESSAGE);
              } else {
                (0, runtime.showToast)(
                  "That " +
                    value3 +
                    " changed while the file was loading. Pick it again to replace it.",
                );
              }
              return;
            },
            callback4 = () =>
              canCompleteUpload(value4, false, "replaced") &&
              callback3(documentStore.getSlide(value4)) !== undefined,
            value15 = value2,
            value16: ReadyVideoShrink | null = null;
          if (value2 !== undefined && value !== undefined) {
            value16 = await prepareVideoUpload(value2, value);
            if (value16 === null) {
              return;
            }
            callback = value16.release;
            value15 = value16.file;
            if (!callback4()) {
              return;
            }
          }
          let value17 =
            value15 === undefined || value13 === undefined
              ? undefined
              : value16 !== null
                ? await uploadReplacementImage(value16, value13.meta, callback4)
                : await uploadImageAsset(value15, value13.meta);
          if (value17 === null || !mountedRef.current) {
            return;
          }
          let src = (
            await prepareImageAsset(
              value14,
              value2 !== undefined ? "video’s picture" : "image",
            )
          ).src;
          if (
            value16 !== null &&
            !(
              (await confirmVideoReplacement(value16)) &&
              canCompleteUpload(value4, false, "replaced")
            )
          ) {
            return;
          }
          let value18 = documentStore.getSlide(value4);
          if (
            !value18 ||
            documentStore.doc.readOnly() ||
            slideHtmlHold2(value18.id) !== undefined
          ) {
            return;
          }
          let value19 = callback3(value18);
          if (value19 === undefined) {
            return;
          }
          let value20 = documentStore.prepareAsset(src),
            value21 = value16 !== null && value16.sound !== "kept",
            value22 = (0, runtime.updateSlideFrame)(
              value18,
              input,
              (input2) => ({
                ...input2,
                node: (0, runtime.updateNodeAtPath)(
                  input2.node,
                  options,
                  (source) =>
                    source.kind === "img"
                      ? (0, runtime.replaceImageAsset)(
                          source,
                          value20,
                          context.name,
                          value17,
                          value21,
                        )
                      : source,
                ),
              }),
            ),
            value23 = (0, runtime.createUnusedAssetUndoOperation)(
              documentStore,
              value19.asset !== undefined ? [value19.asset] : [],
            );
          undoHistory.exec({
            label: "replace " + value3,
            do: () => {
              if (
                !documentStore.getSlide(value18.id) ||
                slideHtmlHold2(value18.id) !== undefined
              ) {
                return;
              }
              documentStore.setAssetEntry(value20, src);
              documentStore.setSlide(value22);
              value23.drop();
            },
            undo: () => {
              if (!canChangeSlide(value18)) {
                return;
              }
              value23.restore();
              documentStore.removeAssetEntry(value20);
            },
          });
          if (value !== undefined) {
            let value24 =
              "The video was replaced on slide " +
              String(
                documentStore.getSnapshot().meta.order.indexOf(value18.id) + 1,
              ) +
              ".";
            if (currentSlideRef.current?.id === value18.id) {
              (0, runtime.announceLiveMessage)(value24);
            } else {
              (0, runtime.showToast)(value24);
            }
          }
          if (value16?.sound === "dropped") {
            showUploadWarning(
              (0, runtime.videoShrinkFailureMessage)("sound_dropped"),
            );
          }
        } catch (value9: unknown) {
          let value10 =
            value9 instanceof Error ? value9.message : String(value9);
          if (value === undefined) {
            (0, runtime.showToast)(
              "Replacing the " + value3 + " failed: " + value10,
            );
          } else {
            (0, runtime.reportArtifactFeedback)("video-shrink-failed", {
              reason: "replace",
              detail: value10,
            });
            showUploadWarning(
              "The video couldn’t be replaced. Try replacing it again.",
            );
          }
        } finally {
          callback();
          callback2();
        }
      },
      uploadAndInsertImageRef =
        runtime.reactd0.useRef(uploadAndInsertImage);
    uploadAndInsertImageRef.current = uploadAndInsertImage;
    let removeSelectedImages = (input: NodeSelection[]) => {
        if (!currentSlide || currentSlideReadOnly) {
          return;
        }
        let value = documentStore.getSlide(currentSlide.id);
        if (!value || slideHtmlHold2(value.id) !== undefined) {
          return;
        }
        let items: string[] = [],
          index = 0,
          value2 = value;
        for (let value4 of input)
          value2 = (0, runtime.updateSlideFrame)(
            value2,
            value4.frameId,
            (input2) => ({
              ...input2,
              node: (0, runtime.updateNodeAtPath)(
                input2.node,
                value4.path!,
                (source) => {
                  if (
                    source.kind !== "img" ||
                    !(0, runtime.imageHasMedia)(source)
                  ) {
                    return source;
                  }
                  index++;
                  if (source.asset !== undefined) {
                    items.push(source.asset);
                  }
                  return (0, runtime.clearImageMedia)(source);
                },
              ),
            }),
          );
        if (index === 0) {
          return;
        }
        let value3 = (0, runtime.createUnusedAssetUndoOperation)(
          documentStore,
          items,
        );
        undoHistory.exec({
          label: "remove image",
          do: () => {
            if (canChangeSlide(value2)) {
              value3.drop();
            }
          },
          undo: () => {
            if (canChangeSlide(value)) {
              value3.restore();
            }
          },
        });
      },
      insertImageFromInput = async (
        input: File,
        { at: options, byKey: options2 }: InsertPlacement = {},
        context?: VideoInsertResume,
      ): Promise<void> => {
        if (
          context !== undefined &&
          !canCompleteUpload(context.slideId, true)
        ) {
          return;
        }
        let value =
          context !== undefined
            ? documentStore.getSlide(context.slideId)
            : getCurrentSlide();
        if (!value || (context === undefined && currentSlideReadOnly)) {
          return;
        }
        if (value.frames.length >= runtime.maxSlideFrames) {
          (0, runtime.showToast)(
            "This slide is full — remove an element first.",
          );
          return;
        }
        if (
          context === undefined &&
          gridOpen &&
          !(singleSelectedGridSlide && openGridSlideInEditor(value.id))
        ) {
          return;
        }
        let value2 =
            options2 === true && !gridOpen
              ? {
                  from: document.activeElement,
                  presses: insertGestureSequenceRef.current,
                }
              : null,
          value3 = (0, runtime.isVideoFile)(input) ? input : undefined,
          value4: "video" | "image" = value3 !== undefined ? "video" : "image",
          count = 640,
          callback = (input2: ImageDimensions) =>
            placeInsertedFrame(
              options,
              count,
              Math.round((count * input2.h) / input2.w) || 480,
            ),
          value5 = (0, runtime.createModelId)(),
          value6: string | undefined,
          flag = false,
          callback2 = () => {
            if (flag) {
              return;
            }
            flag = true;
            clearTimeout(value7);
            setPendingUploads(
              (input2) =>
                input2.filter(
                  (input3) => input3.id !== value5,
                ),
            );
            if (value6 !== undefined) {
              URL.revokeObjectURL(value6);
            }
          },
          callback3 = (
            input2: FramePlacement,
            options3: string,
          ) => {
            if (!flag) {
              setPendingUploads(
                (input3) => [
                  ...input3.filter(
                    (input4) => input4.id !== value5,
                  ),
                  {
                    id: value5,
                    slideId: value.id,
                    rect: (0, runtime.frameBounds)(input2.x, input2.y),
                    url: options3,
                    what: value4,
                  },
                ],
              );
            }
          },
          flag2 = false,
          value7 = setTimeout(
            () => {
              flag2 = true;
              callback2();
            },
            context !== undefined
              ? MAX_VIDEO_DURATION_MS
              : value3 !== undefined
                ? 600000
                : 90000,
          ),
          callback4 = () => {
            return;
          };
        try {
          if (
            value3 !== undefined &&
            context === undefined &&
            (await readImageUpload(
              value3,
              (input2) =>
                void insertImageFromInputRef.current(
                  input,
                  {
                    at: options,
                  },
                  {
                    slideId: value.id,
                    ...input2,
                  },
                ),
            ))
          ) {
            return;
          }
          if (value3 !== undefined && context === undefined) {
            callback3(
              callback({
                w: 16,
                h: 9,
              }),
              EMPTY_VIDEO_POSTER_DATA_URI,
            );
          }
          let value8 =
            context?.poster ??
            (value3 !== undefined
              ? await reduceImageUpload(value3)
              : undefined);
          if (value8 === null) {
            return;
          }
          let value9 = value8?.file ?? input,
            value10 = URL.createObjectURL(value9);
          value6 = value10;
          let value11 = loadImageDimensions(value10).then(
            (input2) =>
              input2.w > 0 && input2.h > 0 ? callback(input2) : undefined,
            () => {
              return;
            },
          );
          value11.then((input2) => {
            if (input2) {
              callback3(input2, value10);
            }
          });
          let callback5 = () =>
              canCompleteUpload(value.id, true),
            value12 = value3,
            value13: ReadyVideoShrink | null = null;
          if (value3 !== undefined && context !== undefined) {
            value13 = await prepareVideoUpload(value3, context);
            if (value13 === null) {
              return;
            }
            callback4 = value13.release;
            value12 = value13.file;
            if (!callback5()) {
              return;
            }
          }
          let value14 =
            value12 === undefined || value8 === undefined
              ? undefined
              : value13 !== null
                ? await uploadReplacementImage(value13, value8.meta, callback5)
                : await uploadImageAsset(value12, value8.meta);
          if (value14 === null || !mountedRef.current) {
            return;
          }
          let src = (
              await prepareImageAsset(
                value9,
                value3 !== undefined ? "video’s picture" : "image",
              )
            ).src,
            value15 = await loadImageDimensions(src),
            value16 =
              (await Promise.race([value11, Promise.resolve(undefined)])) ??
              callback(value15);
          if (
            value13 !== null &&
            !((await confirmVideoReplacement(value13)) && callback5())
          ) {
            return;
          }
          let value17 = documentStore.prepareAsset(src),
            state = {
              id: (0, runtime.createModelId)(),
              x: value16.x,
              y: value16.y,
              node: (0, runtime.replaceImageAsset)(
                {
                  kind: "img",
                  alt: "",
                  fit: "cover",
                },
                value17,
                input.name,
                value14,
                value13 !== null && value13.sound !== "kept",
              ),
            },
            value18 = documentStore.getSlide(value.id);
          if (
            !value18 ||
            documentStore.doc.readOnly() ||
            slideHtmlHold2(value18.id) !== undefined
          ) {
            (0, runtime.showToast)(
              "The " +
                value4 +
                " was not added: the presentation changed during the upload.",
            );
            return;
          }
          if (value18.frames.length >= runtime.maxSlideFrames) {
            (0, runtime.showToast)(
              "This slide is full — remove an element first.",
            );
            return;
          }
          let value19 = (0, runtime.appendSlideFrame)(value18, state);
          undoHistory.exec({
            label: "insert " + value4,
            do: () => {
              if (
                !documentStore.getSlide(value18.id) ||
                slideHtmlHold2(value18.id) !== undefined
              ) {
                return;
              }
              documentStore.setAssetEntry(value17, src);
              documentStore.setSlide(value19);
            },
            undo: () => {
              if (!canChangeSlide(value18)) {
                return;
              }
              documentStore.removeAssetEntry(value17);
            },
          });
          if (
            currentSlideRef.current?.id === value18.id &&
            !flag2 &&
            context === undefined
          ) {
            if (
              value2 !== null &&
              (0, runtime.clipboardPressTargetMatches)(
                value2,
                insertGestureSequenceRef.current,
                document.activeElement,
              )
            ) {
              editorZoomApiRef.current?.landOnCreated(state.id);
            }
            setSelection([
              {
                frameId: state.id,
              },
            ]);
          }
          if (context !== undefined) {
            let value20 =
              "The video was added to slide " +
              String(
                documentStore.getSnapshot().meta.order.indexOf(value18.id) + 1,
              ) +
              ".";
            if (currentSlideRef.current?.id === value18.id) {
              (0, runtime.announceLiveMessage)(value20);
            } else {
              (0, runtime.showToast)(value20);
            }
          }
          if (value13?.sound === "dropped") {
            showUploadWarning(
              (0, runtime.videoShrinkFailureMessage)("sound_dropped"),
            );
          }
        } catch (value8: unknown) {
          let value9 =
            value8 instanceof Error ? value8.message : String(value8);
          if (context === undefined) {
            (0, runtime.showToast)(
              (value3 !== undefined ? "Video" : "Image") +
                " insert failed: " +
                value9,
            );
          } else {
            (0, runtime.reportArtifactFeedback)("video-shrink-failed", {
              reason: "insert",
              detail: value9,
            });
            showUploadWarning(
              "The video couldn’t be added. Try adding it again.",
            );
          }
        } finally {
          callback4();
          callback2();
        }
      },
      insertImageFromInputRef =
        runtime.reactd0.useRef(insertImageFromInput);
    insertImageFromInputRef.current = insertImageFromInput;
    let onDropInsert = (
        input: string,
        options: number,
        context: number,
      ) => {
        setInsertMenuOpen(false);
        if (input === "text") {
          insertText({
            at: {
              x: options,
              y: context,
            },
          });
        } else if (input === "table") {
          insertTable({
            at: {
              x: options,
              y: context,
            },
          });
        } else if (input.startsWith("shape:")) {
          let value = input.slice(6);
          if (runtime.shapeVariants.includes(value)) {
            insertShape(value, {
              at: {
                x: options,
                y: context,
              },
            });
          }
        }
      },
      currentSlideIndex = currentSlide
        ? slides.findIndex(
            (input) => input.id === currentSlide.id,
          )
        : -1;
    runtime.reactd0.useLayoutEffect(() => {
      if (speakerNotesSession === null || presentationStartIndex !== null) {
        return;
      }
      speakerNotesSession.render(
        SlidesAppJsx.jsx(runtime.CompactSpeakerNotes, {
          win: speakerNotesSession.view.win,
          slide: currentSlide,
          index: currentSlideIndex,
        }),
      );
    }, [
      speakerNotesSession,
      presentationStartIndex,
      currentSlide,
      currentSlideIndex,
    ]);
    let presencePublisherRef = runtime.reactd0.useRef<ArtifactPresence | null>(null),
      cursorPublisherRef = runtime.reactd0.useRef<CursorPresence | null>(null);
    runtime.reactd0.useEffect(() => {
      let value = (0, runtime.createArtifactPresence)();
      presencePublisherRef.current = value;
      let value2 = (0, runtime.createCursorPresence)();
      cursorPublisherRef.current = value2;
      (0, runtime.currentUserProfile)().then(
        (input) =>
          value2.setWho(input?.name ?? "", input?.color ?? ""),
      );
      return () => {
        value.dispose();
        value2.dispose();
        presencePublisherRef.current = null;
        cursorPublisherRef.current = null;
      };
    }, []);
    let lastGridPointerRef = runtime.reactd0.useRef<GridPointerPosition | null>(null),
      clearGridCursor =
        presentationStartIndex !== null
          ? "present"
          : gridOpen
            ? "canvas"
            : (editingGridSlide ? "place:" : "slide:") +
              (currentSlide?.id ?? "");
    runtime.reactd0.useEffect(
      () => () => {
        cursorPublisherRef.current?.clear();
        lastGridPointerRef.current = null;
      },
      [clearGridCursor],
    );
    let publishGridPointer = (
        event: GridPointerEventLike,
        options = true,
      ) => {
        if (
          !(gridOpen || editingGridSlide) ||
          presentationStartIndex !== null ||
          event.pointerType === "touch"
        ) {
          return;
        }
        let value = (0, runtime.reduceGridNotesOutsideClick)({
          moved: options,
          target: (0, runtime.classifyGridNotesClickTarget)(event.target),
          hit:
            gridZoomApiRef.current?.slideAt(event.clientX, event.clientY) ??
            null,
          editing: editingGridSlide ? (currentSlide?.id ?? null) : null,
        });
        if (value === "clear") {
          cursorPublisherRef.current?.clear();
        } else if (value !== "ignore") {
          cursorPublisherRef.current?.move(
            scopedSlideKey(value.id),
            value.fx,
            value.fy,
          );
        }
      },
      publishGridPointerRef =
        runtime.reactd0.useRef(publishGridPointer);
    publishGridPointerRef.current = publishGridPointer;
    let republishGridPointerOnCameraChange =
        runtime.reactd0.useCallback(() => {
          let current = lastGridPointerRef.current;
          if (current === null) {
            return;
          }
          if (Date.now() - current.at >= runtime.PEER_CURSOR_STALE_MS) {
            return;
          }
          let value = document.elementFromPoint(
            current.clientX,
            current.clientY,
          );
          if (value) {
            publishGridPointerRef.current(
              {
                clientX: current.clientX,
                clientY: current.clientY,
                target: value,
              },
              false,
            );
          }
        }, []),
      documentDirty = runtime.reactd0.useSyncExternalStore(
        runtime.reactd0.useCallback(
          (input) => documentStore.subscribe(input),
          [documentStore],
        ),
        () => documentStore.doc.dirty(),
      );
    runtime.reactd0.useEffect(() => {
      let value =
          presentationStartIndex !== null
            ? "present"
            : gridOpen
              ? "grid"
              : "edit",
        value2 =
          presentationStartIndex !== null
            ? presentableSlides[
                presentationCurrentIndex ?? presentationStartIndex
              ]
            : currentSlide,
        value3 =
          value === "present"
            ? []
            : value === "grid"
              ? (0, runtime.normalizeObjectContextIds)(gridSelection.slides)
              : (0, runtime.selectedObjectContextIds)(selection, textEdit),
        callback = (input: string[]) =>
          input.flatMap((input2) => {
            let value10 = slides.find(
              (input3) => input3.id === input2,
            );
            if (value10) {
              return [
                {
                  id: input2,
                  kind: "slide",
                  label: (0, runtime.slideDisplayLabel)(value10) ?? "",
                },
              ];
            } else {
              return [];
            }
          }),
        value4 =
          value === "grid"
            ? (0, runtime.normalizeObjectContextIds)(gridSelection.sections)
            : [],
        value5 =
          value4.length > 0
            ? (0, runtime.sectionGroups)(
                (0, runtime.reconcileSectionsWithSlideOrder)(
                  snapshot.sections,
                  snapshot.meta.order,
                ),
                snapshot.meta.order,
              )
            : [],
        value6 = value4.flatMap((input) => {
          let value10 = value5.findIndex(
            (input2) => input2.section?.id === input,
          );
          if (value10 < 0) {
            return [];
          } else {
            return [
              {
                id: input,
                kind: "section",
                label:
                  value5[value10]!.section!.description ||
                  "Section " + String(value10 + 1),
              },
            ];
          }
        }),
        value7 =
          value === "present"
            ? []
            : value === "grid"
              ? [...callback(value3), ...value6]
              : currentSlide
                ? (0, runtime.selectedObjectContext)(
                    currentSlide,
                    selection,
                    textEdit,
                  )
                : [],
        value8 = value2
          ? slides.findIndex(
              (input) => input.id === value2.id,
            )
          : -1,
        value9 =
          value2 !== undefined ? slideHtmlHold2(value2.id) : undefined;
      presencePublisherRef.current?.report({
        ...(host?.presence
          ? {
              deckMode: value,
            }
          : {}),
        mode: value,
        deck:
          memoryScope === "" ? null : (0, runtime.frameContextId)(memoryScope),
        slideId: (0, runtime.frameContextId)(value2?.id),
        slideTitle: {
          text: (value2 && (0, runtime.slideDisplayLabel)(value2)) ?? "",
        },
        slideIndex: value8 + 1,
        slideCount: slides.length,
        dirty: documentDirty,
        ...(value9 !== undefined
          ? {
              slideHeld: true,
              slideHeldWhy: {
                text: value9,
              },
            }
          : {}),
        selected: value3,
        selection: value7,
        ...(value === "grid"
          ? {
              sections: value4,
              slideSections: value3.map(
                (input) =>
                  gridSelection.slideSections[
                    gridSelection.slides.indexOf(input)
                  ] ?? "-",
              ),
              selectedCount: gridSelection.slides.length,
              editingSection:
                gridSelection.editingSection === "-"
                  ? "-"
                  : (0, runtime.frameContextId)(gridSelection.editingSection),
            }
          : {}),
        ...host?.presence,
      });
    }, [
      currentSlide,
      slides,
      presentableSlides,
      presentationStartIndex,
      presentationCurrentIndex,
      gridOpen,
      gridSelection,
      snapshot.sections,
      snapshot.meta.order,
      selection,
      textEdit,
      documentDirty,
      memoryScope,
      host?.presence,
    ]);
    let [onPersonPaged, bumpPageNavigation] =
        runtime.reactd0.useState(0),
      pageSlide = (input: number) => {
        let value = slides[currentSlideIndex + input];
        if (!value) {
          return;
        }
        bumpPageNavigation((input2) => input2 + 1);
        setCurrentSlideId(value.id);
        setSelection([]);
        setTextEditState(null);
      },
      pickSlideTemplate = (input: Slide) => {
        if (readOnly) {
          return;
        }
        let value = (0, runtime.countSlideTableCells)(input);
        if (
          value > 0 &&
          (0, runtime.countDeckTableCells)(slides) + value >
            runtime.maxDeckTableCells
        ) {
          (0, runtime.showToast)(
            "This presentation can't hold more table cells — remove some first.",
          );
          return;
        }
        let value2 = (
            templateRestyler ??
            (0, runtime.createTemplateRestyler)({
              current: currentSlide,
              slides: slides,
              typeStyles: deckTypeStyles,
              theme: snapshot.meta.theme,
            })
          )(input),
          value3 =
            currentSlideIndex >= 0 ? currentSlideIndex + 1 : slides.length,
          value4 = documentStore.sectionsSnapshot();
        undoHistory.exec({
          label: "add slide",
          do: () => {
            documentStore.arm(value4);
            if (!slideCapacityAvailable(value2.id)) {
              documentStore.insertSlide(value2, value3, {
                joinTop: true,
              });
            }
          },
          undo: () => {
            if (slideCapacityAvailable(value2.id)) {
              return;
            }
            documentStore.removeSlide(value2.id);
            documentStore.restoreSections(value4);
          },
        });
        setCurrentSlideId(value2.id);
        setSelection([]);
      },
      duplicateSlide = (
        input: SlideId,
        options?: number,
      ) => {
        let value = documentStore.getSlide(input);
        if (readOnly || !value) {
          return null;
        }
        if (slides.length + 1 > runtime.maxDeckSlides) {
          (0, runtime.showToast)(presentationCapacityMessage(1));
          return null;
        }
        let value2 = (0, runtime.countSlideTableCells)(value);
        if (
          value2 > 0 &&
          (0, runtime.countDeckTableCells)(slides) + value2 >
            runtime.maxDeckTableCells
        ) {
          (0, runtime.showToast)(
            "This presentation can't hold more table cells — remove some first.",
          );
          return null;
        }
        let state = {
            ...value,
            id: (0, runtime.createModelId)(),
            frames: value.frames.map(
              (input2) => ({
                ...input2,
              }),
            ),
          },
          value3 =
            options ??
            slides.findIndex(
              (input2) => input2.id === input,
            ) + 1,
          value4 = documentStore.sectionsSnapshot(),
          entries = new Map(
            Object.entries(documentStore.snapshotAssetsFor(input)),
          );
        undoHistory.exec({
          label: "duplicate slide",
          do: () => {
            documentStore.arm(value4);
            if (!slideCapacityAvailable(state.id)) {
              showPasteWarnings(entries);
              documentStore.insertSlide(state, value3, {
                joinTop: true,
              });
            }
          },
          undo: () => {
            if (slideCapacityAvailable(state.id)) {
              return;
            }
            documentStore.removeSlide(state.id);
            documentStore.restoreSections(value4);
          },
        });
        setCurrentSlideId(state.id);
        return state.id;
      },
      duplicateSlides = (
        input: SlideId[],
        options?: SectionInsertTarget,
      ) => {
        let value = slides
          .flatMap(
            (input2) =>
              input.includes(input2.id)
                ? [documentStore.getSlide(input2.id)]
                : [],
          )
          .filter((input2): input2 is Slide => input2 !== undefined);
        if (readOnly || value.length === 0) {
          return [];
        }
        if (value.length === 1 && options === undefined) {
          let value6 = duplicateSlide(value[0]!.id);
          if (value6 === null) {
            return [];
          } else {
            return [value6];
          }
        }
        if (slides.length + value.length > runtime.maxDeckSlides) {
          (0, runtime.showToast)(presentationCapacityMessage(value.length));
          return [];
        }
        let value2 = (0, runtime.countDeckTableCells)(value);
        if (
          value2 > 0 &&
          (0, runtime.countDeckTableCells)(slides) + value2 >
            runtime.maxDeckTableCells
        ) {
          (0, runtime.showToast)(
            "This presentation can't hold more table cells — remove some first.",
          );
          return [];
        }
        if (
          !canAddStyledNodes(
            value.flatMap(
              (input2) =>
                input2.frames.map((input3) => input3.node),
            ),
          )
        ) {
          return [];
        }
        let value3 = value.map(
            (input2) => ({
              ...input2,
              id: (0, runtime.createModelId)(),
              frames: input2.frames.map(
                (input3) => ({
                  ...input3,
                }),
              ),
            }),
          ),
          entries = new Map(
            value.flatMap(
              (input2) =>
                Object.entries(
                  documentStore.snapshotAssetsFor(input2.id),
                ),
            ),
          ),
          id = value[value.length - 1]!.id,
          items: DuplicatedSlideRecord[] = [],
          callback = (input2: number) => {
            if (
              input2 === 0 ||
              documentStore.getSnapshot().meta.order.length + input2 <=
                runtime.maxDeckSlides
            ) {
              return true;
            }
            (0, runtime.showToast)(presentationCapacityMessage(input2));
            return false;
          },
          flag = false,
          items2 = [
            (0, runtime.createModelId)(),
            (0, runtime.createModelId)(),
          ],
          value4 =
            options === undefined
              ? undefined
              : (input2: DeckContent, options2: Slide[]) =>
                  (0, runtime.insertSlidesAtSectionTarget)(
                    input2,
                    options2.map((input3) => input3.id),
                    options,
                    ...items2,
                  ),
          callback2 = (input2: Slide[]) =>
            flag ||
            value4 === undefined ||
            value4(documentStore.doc.content(), input2) !== undefined;
        undoHistory.exec({
          label: "duplicate slides",
          canDo: () => {
            let value6 = value3.filter(
              (input2) =>
                documentStore.getSlide(input2.id) === undefined,
            );
            return callback(value6.length) && callback2(value6);
          },
          do: () => {
            flag = true;
            let order = documentStore.getSnapshot().meta.order;
            if (
              value3.some(
                (input2) =>
                  documentStore.getSlide(input2.id) !== undefined &&
                  slideCapacityAvailable(input2.id),
              )
            ) {
              return;
            }
            let value6 = value3.filter(
              (input2) =>
                documentStore.getSlide(input2.id) === undefined,
            );
            items = items.filter(
              (input2) =>
                documentStore.getSlide(input2.id) !== undefined,
            );
            if (value6.length > 0) {
              showPasteWarnings(entries);
            }
            if (value4 !== undefined) {
              let value8 = documentStore.sectionsSnapshot();
              if (
                documentStore.insertSlides(
                  value6,
                  (input2) => value4(input2, value6),
                )
              ) {
                items.push(
                  ...value6.map(
                    (input2) => ({
                      id: input2.id,
                      ob: value8,
                    }),
                  ),
                );
                return;
              }
            }
            let value7 = order.indexOf(id) + 1 || order.length;
            for (let value8 of value6) {
              items.push({
                id: value8.id,
                ob: documentStore.sectionsSnapshot(),
              });
              documentStore.insertSlide(value8, value7++, {
                joinTop: true,
              });
            }
          },
          undo: () => {
            documentStore.forgetParked(
              value3.map((input2) => input2.id),
            );
            let value6 = [...items]
              .reverse()
              .filter(
                (input2) =>
                  documentStore.getSlide(input2.id) !== undefined,
              );
            if (
              value6.some(
                (input2) =>
                  slideCapacityAvailable(input2.id),
              )
            ) {
              return;
            }
            value6.forEach(
              ({ id: id2, ob: ob }, options2) => {
                for (let [value7, value8] of Object.entries(
                  documentStore.snapshotAssetsFor(id2),
                ))
                  entries.set(value7, value8);
                documentStore.removeSlide(id2);
                if (value6[options2 + 1]?.ob !== ob) {
                  documentStore.restoreSections(ob);
                }
              },
            );
          },
        });
        let value5 = value3.flatMap(
          (input2) =>
            documentStore.getSlide(input2.id) !== undefined ? [input2.id] : [],
        );
        if (value5.length > 0) {
          setCurrentSlideId(value5[value5.length - 1]!);
        }
        return value5;
      },
      deleteSlide = (input: SlideId) => {
        let value = documentStore.getSlide(input);
        if (readOnly || !value || slides.length <= 1) {
          return false;
        }
        if (slideHtmlHold2(input) !== undefined) {
          (0, runtime.showToast)(
            "That slide can’t be edited until its saved content is fixed, so it can’t be deleted yet.",
          );
          return false;
        }
        let value2 = slides.findIndex(
            (input2) => input2.id === input,
          ),
          value3 = slides[value2 - 1]?.id,
          value4 = slides[value2 + 1]?.id,
          value5 = documentStore.snapshotAssetsFor(input),
          value6 = documentStore.sectionsSnapshot(),
          flag = false,
          flag2 = false;
        undoHistory.exec({
          label: "delete slide",
          do: () => {
            documentStore.forgetParked([input]);
            if (
              flag2 ||
              documentStore.getSlide(input) === undefined ||
              slideCapacityAvailable(input)
            ) {
              return;
            }
            documentStore.arm(value6);
            flag = documentStore.getSnapshot().cover === input;
            documentStore.removeSlide(input);
            flag2 = true;
          },
          canUndo: () => {
            if (
              !flag2 ||
              documentStore.getSnapshot().meta.order.length + 1 <=
                runtime.maxDeckSlides
            ) {
              return true;
            }
            (0, runtime.showToast)(
              "This presentation is full (" +
                String(runtime.maxDeckSlides) +
                " slides). Remove one first.",
            );
            return false;
          },
          undo: () => {
            if (!flag2 || slideCapacityAvailable(input)) {
              return;
            }
            let order = documentStore.getSnapshot().meta.order,
              value7 =
                value3 !== undefined ? order.indexOf(value3) : -1,
              value8 =
                value4 !== undefined ? order.indexOf(value4) : -1;
            documentStore.restoreSlide(
              value,
              value7 >= 0 ? value7 + 1 : value8 >= 0 ? value8 : value2,
              value5,
            );
            documentStore.restoreSections(value6);
            if (flag && documentStore.getSnapshot().cover === undefined) {
              documentStore.setCover(input);
            }
            flag2 = false;
          },
        });
        if (input === currentSlideId) {
          let value7 = slides[value2 + 1] ?? slides[value2 - 1];
          setCurrentSlideId(value7 ? value7.id : null);
          setSelection([]);
        }
        return true;
      },
      deleteSlides = (input: SlideId[]) => {
        let value = slides
          .flatMap(
            (input2, options) =>
              input.includes(input2.id)
                ? [
                    {
                      slide: documentStore.getSlide(input2.id),
                      at: options,
                    },
                  ]
                : [],
          )
          .filter((input2): input2 is SlideAtIndex => input2.slide !== undefined);
        if (readOnly || value.length === 0) {
          return false;
        }
        if (value.length === 1) {
          return deleteSlide(value[0]!.slide.id);
        }
        if (value.length >= slides.length) {
          (0, runtime.showToast)("A presentation keeps at least one slide.");
          return false;
        }
        if (
          value.some(
            (input2) =>
              slideHtmlHold2(input2.slide.id) !== undefined,
          )
        ) {
          (0, runtime.showToast)(
            "One of those slides can’t be edited until its saved content is fixed, so none were deleted.",
          );
          return false;
        }
        let values = new Set(
            value.map((input2) => input2.slide.id),
          ),
          value2 = slides.map(
            (input2) => input2.id,
          ),
          items: DeletedSlideRecord[] = [],
          flag = false,
          callback = () =>
            value.filter(
              (input2) =>
                documentStore.getSlide(input2.slide.id) !== undefined,
            );
        undoHistory.exec({
          label: "delete slides",
          canDo: () => {
            if (
              flag ||
              callback().length < documentStore.getSnapshot().meta.order.length
            ) {
              return true;
            }
            (0, runtime.showToast)("A presentation keeps at least one slide.");
            return false;
          },
          canUndo: () => {
            if (!flag) {
              return true;
            }
            let length = items.filter(
              (input2) =>
                documentStore.getSlide(input2.id) === undefined,
            ).length;
            if (
              documentStore.getSnapshot().meta.order.length + length <=
              runtime.maxDeckSlides
            ) {
              return true;
            }
            (0, runtime.showToast)(
              "This presentation can’t hold " +
                String(length) +
                " more slides. Remove some first.",
            );
            return false;
          },
          do: () => {
            if (flag) {
              return;
            }
            documentStore.forgetParked(
              value.map((input2) => input2.slide.id),
            );
            let value3 = callback();
            if (
              value3.some(
                (input2) =>
                  slideCapacityAvailable(input2.slide.id),
              )
            ) {
              return;
            }
            items = [];
            for (let value4 of value3) {
              let value5 = documentStore.getSlide(value4.slide.id)!;
              items.push({
                id: value5.id,
                at: value4.at,
                slide: value5,
                assets: documentStore.snapshotAssetsFor(value5.id),
                ob: documentStore.sectionsSnapshot(),
                cover: documentStore.getSnapshot().cover === value5.id,
              });
              documentStore.removeSlide(value5.id);
            }
            flag = true;
          },
          undo: () => {
            if (!flag) {
              return;
            }
            let value3 = [...items]
              .reverse()
              .filter(
                (input2) =>
                  documentStore.getSlide(input2.id) === undefined,
              );
            for (let value4 of value3) {
              let order = documentStore.getSnapshot().meta.order,
                value5 = value2
                  .slice(0, value4.at)
                  .reverse()
                  .find((input2) => order.includes(input2)),
                value6 = value2
                  .slice(value4.at + 1)
                  .find((input2) => order.includes(input2));
              documentStore.restoreSlide(
                value4.slide,
                value5 !== undefined
                  ? order.indexOf(value5) + 1
                  : value6 !== undefined
                    ? order.indexOf(value6)
                    : value4.at,
                value4.assets,
              );
              documentStore.restoreSections(value4.ob);
              if (
                value4.cover &&
                documentStore.getSnapshot().cover === undefined
              ) {
                documentStore.setCover(value4.id);
              }
            }
            flag = false;
          },
        });
        if (currentSlideId !== null && values.has(currentSlideId)) {
          let value3 = slides.findIndex(
              (input2) => input2.id === currentSlideId,
            ),
            value4 =
              slides
                .slice(value3 + 1)
                .find((input2) => !values.has(input2.id)) ??
              slides
                .slice(0, value3)
                .reverse()
                .find((input2) => !values.has(input2.id));
          setCurrentSlideId(value4 ? value4.id : null);
          setSelection([]);
        }
        return true;
      },
      moveSlide = (input: SlideId, options: number) => {
        let value = slides.findIndex(
          (input2) => input2.id === input,
        );
        if (readOnly || value < 0) {
          return;
        }
        let value2 = slides[value - 1]?.id,
          value3 = slides[value + 1]?.id,
          value4 = documentStore.sectionsSnapshot();
        undoHistory.exec({
          label: "reorder slide",
          do: () => {
            documentStore.arm(value4);
            documentStore.moveSlide(input, options, {
              joinTop: true,
            });
          },
          undo: () => {
            let value6 = documentStore
                .getSnapshot()
                .meta.order.filter(
                  (input2) => input2 !== input,
                ),
              value7 =
                value2 !== undefined ? value6.indexOf(value2) : -1,
              value8 =
                value3 !== undefined ? value6.indexOf(value3) : -1;
            documentStore.moveSlide(
              input,
              value7 >= 0 ? value7 + 1 : value8 >= 0 ? value8 : value,
            );
            documentStore.restoreSections(value4);
          },
        });
      },
      commitStructuralChange = runtime.reactd0.useCallback(
        (input: string, options: StructureCompute) => {
          if (readOnly || documentStore.doc.readOnly()) {
            return false;
          }
          let value = documentStore.doc.content(),
            callback = (
              input2: DeckContent,
              options2: DeckOrderAndSections,
            ) => {
              let value4 = (0, runtime.diffSections)(input2, options2);
              return (0, runtime.normalizeEmptySectionDescriptions)(options2, [
                ...value4.added.map((input3) => input3.id),
                ...value4.changed.map((input3) => input3.id),
              ]);
            };
          if (
            !documentStore.applyStructure((input2) => {
              let value4 = options(input2);
              if (value4 === undefined) {
                return undefined;
              } else {
                return callback(input2, value4);
              }
            })
          ) {
            return false;
          }
          let value2 = (0, runtime.diffSections)(
              value,
              documentStore.doc.content(),
            ),
            value3 = (0, runtime.invertSectionsDiff)(value2);
          undoHistory.seed({
            label: input,
            do: () =>
              void documentStore.applyStructure(
                (input2) =>
                  (0, runtime.applySectionsDiff)(input2, value2),
              ),
            undo: () =>
              void documentStore.applyStructure(
                (input2) =>
                  (0, runtime.applySectionsDiff)(input2, value3),
              ),
          });
          return true;
        },
        [documentStore, undoHistory, readOnly],
      ),
      setCoverSlide = (input: SlideId) => {
        if (
          readOnly ||
          documentStore.getSlide(input) === undefined ||
          documentStore.getSnapshot().cover === input
        ) {
          return;
        }
        let value =
            documentStore.getSnapshot().meta.order.indexOf(input) + 1,
          value2: SlideId | undefined;
        undoHistory.exec({
          label: "set thumbnail",
          do: () => {
            value2 = documentStore.getSnapshot().cover;
            documentStore.setCover(input);
          },
          undo: () => {
            if (documentStore.getSnapshot().cover !== input) {
              return;
            }
            documentStore.setCover(
              value2 !== undefined &&
                documentStore.getSlide(value2) !== undefined
                ? value2
                : undefined,
            );
          },
        });
        (0, runtime.showToast)(
          "Slide " + String(value) + " is now the thumbnail",
        );
      },
      toggleSlideSkipped = (input: SlideId) => {
        let value = documentStore.getSlide(input);
        if (readOnly || !value) {
          return;
        }
        if (slideHtmlHold2(input) !== undefined) {
          (0, runtime.showToast)(
            "That slide can’t be edited until its saved content is fixed, so it can’t be skipped yet.",
          );
          return;
        }
        setSlidesSkipped([input], value.skipped !== true);
      },
      setSlidesSkipped = (
        input: SlideId[],
        options: boolean,
      ) => {
        let value = input.filter((input2) => {
          let value2 = documentStore.getSlide(input2);
          return value2 !== undefined && (value2.skipped === true) !== options;
        });
        if (readOnly || value.length === 0) {
          return;
        }
        if (
          value.some(
            (input2) => slideHtmlHold2(input2) !== undefined,
          )
        ) {
          (0, runtime.showToast)(
            "One of those slides can’t be edited until its saved content is fixed, so none were changed.",
          );
          return;
        }
        let callback =
          (input2: boolean) =>
          () => {
            for (let value2 of value) {
              if (
                documentStore.getSlide(value2) === undefined ||
                slideCapacityAvailable(value2)
              ) {
                continue;
              }
              documentStore.updateSlide(value2, (input3) => {
                let state = {
                  ...input3,
                };
                if (input2) {
                  state.skipped = true;
                } else {
                  delete state.skipped;
                }
                return state;
              });
            }
          };
        undoHistory.exec({
          label:
            (options ? "skip " : "unskip ") +
            (value.length > 1 ? "slides" : "slide"),
          do: callback(options),
          undo: callback(!options),
        });
      },
      duplicateSelection = () => {
        let value = getCurrentSlide();
        if (!value || selection.length === 0) {
          return;
        }
        let value2 = (0, runtime.filterValidSelections)(
          value,
          selection,
        );
        if (value2.length === 0) {
          return;
        }
        let value3 = value2
            .map(
              (input) =>
                (0, runtime.selectedNode)(value, input),
            )
            .filter((input) => input !== undefined),
          value4 = value3.reduce(
            (input, options) =>
              input + (0, runtime.countNodeTableCells)(options),
            0,
          ),
          value5 = value3.reduce(
            (input, options) =>
              input + (0, runtime.countNodeEmbeds)(options),
            0,
          );
        if (!canAddTableCells(value4)) {
          return;
        }
        if (!canAddFrames(value5)) {
          return;
        }
        if (!canAddStyledNodes(value3)) {
          return;
        }
        let value6 = value2.filter(
          (input) => input.child === undefined,
        );
        if (value.frames.length + value6.length > runtime.maxSlideFrames) {
          (0, runtime.showToast)(
            "This slide is full — remove an element first.",
          );
          return;
        }
        for (let [value8, value9] of (() => {
          let entries3 = new Map<string, number>();
          for (let value10 of value2)
            if (value10.child !== undefined) {
              entries3.set(
                value10.frameId,
                (entries3.get(value10.frameId) ?? 0) + 1,
              );
            }
          return entries3;
        })()) {
          let value10 = (0, runtime.frameById)(value, value8);
          if (
            value10 !== undefined &&
            (0, runtime.isFlowContainer)(value10.node) &&
            value10.node.children.length + value9 > runtime.maxSlideFrames
          ) {
            (0, runtime.showToast)(
              "This group is full — remove an element first.",
            );
            return;
          }
        }
        let value7 = value,
          items: NodeSelection[] = [],
          entries = new Map<string, NodeSelection>();
        for (let value8 of (0, runtime.sortSelectionsInDocumentOrder)(
          value,
          value2,
        )) {
          if (value8.child !== undefined) {
            continue;
          }
          let value9 = (0, runtime.frameById)(value7, value8.frameId);
          if (!value9) {
            continue;
          }
          let state = {
            ...value9,
            id: (0, runtime.createModelId)(),
            x: (0, runtime.moveAxisSpec)(value9.x, 24),
            y: (0, runtime.moveAxisSpec)(value9.y, 24),
          };
          value7 = (0, runtime.appendSlideFrame)(value7, state);
          entries.set(value8.frameId, {
            frameId: state.id,
          });
        }
        for (let value8 of value2) {
          let value9 =
            value8.child === undefined
              ? entries.get(value8.frameId)
              : undefined;
          if (value9) {
            items.push(value9);
          }
        }
        let values = new Set(
            value2
              .filter((input) => input.child === undefined)
              .map((input) => input.frameId),
          ),
          entries2 = new Map<string, ChildIndexGroup>();
        for (let value8 of value2) {
          if (value8.child === undefined) {
            continue;
          }
          if (values.has(value8.frameId)) {
            continue;
          }
          if ((0, runtime.selectedNode)(value, value8)?.kind === "spacer") {
            continue;
          }
          let value9 = (0, runtime.frameById)(value, value8.frameId);
          if (value9 !== undefined && (0, runtime.isOverlayNode)(value9.node)) {
            if (value8.child === 0) {
              continue;
            }
            let value13 =
              entries2.get(value8.frameId + ":")?.indices.length ?? 0;
            if (
              value9.node.layers.length + value13 >=
              runtime.maxTextLineSpacing
            ) {
              (0, runtime.showToast)(
                "This overlay already holds its maximum of " +
                  String(runtime.maxTextLineSpacing) +
                  " layers.",
              );
              continue;
            }
          }
          let value10 = (0, runtime.selectionNodePath)(value8).slice(
              0,
              -1,
            ),
            value11 = value8.frameId + ":" + value10.join("."),
            value12 = entries2.get(value11) ?? {
              frameId: value8.frameId,
              parentPath: value10,
              indices: [],
            };
          value12.indices.push(
            (0, runtime.selectionNodePath)(value8)[
              (0, runtime.selectionNodePath)(value8).length - 1
            ]!,
          );
          entries2.set(value11, value12);
        }
        for (let {
          frameId: value8,
          parentPath: value9,
          indices: value10,
        } of entries2.values()) {
          value10.sort(
            (input, options) => input - options,
          );
          value10.forEach((input, options) => {
            value7 = (0, runtime.wrapNodeInContainer)(value7, value8, [
              ...value9,
              input + options,
            ]);
            items.push(
              (0, runtime.createNodeSelection)(value8, [
                ...value9,
                input + options + 1,
              ]),
            );
          });
        }
        if (value7 === value) {
          return;
        }
        commitSlideEdit(value, value7, "duplicate");
        setSelection(items);
      },
      getCopyableSelection = () => {
        let value = getCurrentSlide();
        if (!value) {
          return [];
        }
        let value2 = (0, runtime.filterValidSelections)(
            value,
            selection,
          ),
          items: CopyableUnit[] = [],
          current = editorElementRef.current,
          values = new Set(
            value2
              .filter((input) => {
                if (input.child === undefined) {
                  return true;
                }
                let value3 = (0, runtime.frameById)(
                  value,
                  input.frameId,
                );
                return (
                  value3 !== undefined &&
                  (0, runtime.isOverlayNode)(value3.node) &&
                  input.child === 0
                );
              })
              .map((input) => input.frameId),
          ),
          values2 = new Set<string>();
        for (let value3 of (0, runtime.sortSelectionsInDocumentOrder)(
          value,
          value2,
        )) {
          let value4 = (0, runtime.frameById)(value, value3.frameId);
          if (!value4) {
            continue;
          }
          let value5 =
            value3.child !== undefined &&
            (0, runtime.isOverlayNode)(value4.node) &&
            value3.child === 0;
          if (
            value3.child !== undefined &&
            !value5 &&
            values.has(value3.frameId)
          ) {
            continue;
          }
          if (value3.child === undefined || value5) {
            if (values2.has(value3.frameId)) {
              continue;
            }
            values2.add(value3.frameId);
            items.push({
              unit:
                value3.child === undefined
                  ? value3
                  : {
                      frameId: value3.frameId,
                    },
              frame: value4,
            });
            continue;
          }
          let value6 = (0, runtime.selectedNode)(value, value3);
          if (!value6 || value6.kind === "spacer" || !current) {
            continue;
          }
          let element = current.querySelector(
              '[data-frame-id="' + value3.frameId + '"]',
            ),
            value7 =
              element instanceof HTMLElement ? element.offsetParent : null,
            value8 = element?.querySelector(
              '[data-node-path="' +
                (0, runtime.selectionNodePath)(value3).join(".") +
                '"]',
            );
          if (
            !(value8 instanceof Element) ||
            !(value7 instanceof HTMLElement)
          ) {
            continue;
          }
          let bounds = value7.getBoundingClientRect();
          if (bounds.width <= 0) {
            continue;
          }
          let value9 = bounds.width / runtime.SLIDE_WIDTH,
            bounds2 = value8.getBoundingClientRect();
          items.push({
            unit: value3,
            frame: (0, runtime.createFreeFrameFromNode)(value6, {
              x: (bounds2.left - bounds.left) / value9,
              y: (bounds2.top - bounds.top) / value9,
              w: bounds2.width / value9,
              h: bounds2.height / value9,
            }),
          });
        }
        return items;
      },
      removeUnusedFrameAssets = (
        input: Slide,
        options: Slide,
        context: NodeSelection[],
      ) => {
        let value = editorZoomApiRef.current?.groupMeasure;
        if (value === undefined) {
          return options;
        }
        let callback = (input2: NodeSelection) => {
          let value2 = (0, runtime.frameById)(
              input,
              input2.frameId,
            )?.node,
            value3 =
              value2 !== undefined && (0, runtime.isOverlayNode)(value2)
                ? value2.layers.findIndex(
                    (input3) =>
                      input3.node ===
                      (0, runtime.selectedNode)(options, input2),
                  )
                : -1;
          if (value3 < 0) {
            return undefined;
          } else {
            return value.rect(
              (0, runtime.createNodeSelection)(input2.frameId, [value3 + 1]),
            );
          }
        };
        return (0, runtime.rewriteNestedOverlayPlacements)(
          options,
          new Set(context.map((input2) => input2.frameId)),
          {
            ...value,
            rect: callback,
          },
        );
      },
      deleteSelection = () => {
        let value = getCurrentSlide();
        if (!value || selection.length === 0) {
          return;
        }
        let value2 = (0, runtime.filterValidSelections)(
          value,
          selection,
        );
        if (value2.length === 0) {
          return;
        }
        let value3 = value,
          value4 = value2
            .filter((input) => input.child !== undefined)
            .sort(
              (input, options) =>
                (0, runtime.compareNodePaths)(
                  (0, runtime.selectionNodePath)(options),
                  (0, runtime.selectionNodePath)(input),
                ),
            );
        for (let value5 of value4)
          value3 = (0, runtime.removeSlideNode)(
            value3,
            value5.frameId,
            (0, runtime.selectionNodePath)(value5),
          );
        for (let value5 of value2)
          if (value5.child === undefined) {
            value3 = (0, runtime.removeSlideFrame)(value3, value5.frameId);
          }
        value3 = removeUnusedFrameAssets(value, value3, value4);
        commitSlideEdit(value, value3, "delete");
        setSelection([]);
      },
      selectedFrameIds = (
        input: Slide,
        options: readonly NodeSelection[],
      ) =>
        new Set(
          options
            .filter((input2) => {
              if (input2.child === undefined) {
                return true;
              }
              let value = (0, runtime.frameById)(
                input,
                input2.frameId,
              );
              return (
                value !== undefined &&
                (0, runtime.isOverlayNode)(value.node) &&
                input2.child === 0
              );
            })
            .map((input2) => input2.frameId),
        ),
      changeSelectionLayerOrder = (input: FrameOrder) => {
        let value = getCurrentSlide(),
          value2 = value
            ? selectedFrameIds(value, selection)
            : undefined;
        if (!value || value2 === undefined || value2.size === 0) {
          return false;
        }
        commitSlideEdit(
          value,
          (0, runtime.reorderSlideFrames)(value, value2, input),
          input === "back" ? "send to back" : "bring to front",
        );
        return true;
      },
      framePasteUnavailableMessage = (0,
      runtime.internalPasteOnlyMessage)("an object or slide"),
      [contextMenu, setContextMenu] =
        runtime.reactd0.useState<ContextMenuState | null>(null),
      openContextMenu = (
        input: ContextMenuAnchor,
        items: NodeSelection[],
      ) => {
        let current = editorZoomApiRef.current;
        if (current === null || !current.endTextEdit()) {
          return;
        }
        current.endCrop();
        let value = getCurrentSlide();
        if (!value) {
          return;
        }
        let value2 = (0, runtime.groupSelectedUnits)(
            value,
            items,
            current.groupMeasure,
          ),
          value3 = (0, runtime.ungroupSelectedUnits)(
            value,
            items,
            current.groupMeasure,
          ),
          value4 = selectedFrameIds(value, items),
          callback = (input2: FrameOrder) => {
            if (value4.size === 0) {
              return "Only an object placed directly on the slide can move to the front or back";
            }
            let value6 = (0, runtime.reorderSlideFrames)(
              value,
              value4,
              input2,
            );
            if (value6 === value) {
              return "The background stays behind everything";
            }
            if (
              value6.frames.every(
                (input3, options) =>
                  input3 === value.frames[options],
              )
            ) {
              return "Already at the " + input2;
            } else {
              return undefined;
            }
          },
          value5 = (0, runtime.getInternalClipboard)()?.kind,
          state = {
            paste:
              value5 === runtime.FRAME_CLIPBOARD_TYPE ||
              value5 === runtime.SLIDE_CLIPBOARD_TYPE
                ? undefined
                : framePasteUnavailableMessage,
            front: callback("front"),
            back: callback("back"),
            group: "refused" in value2 ? value2.refused : undefined,
            ungroup: "refused" in value3 ? value3.refused : undefined,
            properties: inspectorOpen
              ? "The Properties panel is already open"
              : undefined,
          };
        setContextMenu(
          (input2) =>
            input2?.at.from === "key" && input.from === "key"
              ? input2
              : {
                  at: input,
                  objects: items.length,
                  refusals: state,
                },
        );
      };
    if (
      contextMenu !== null &&
      (currentSlideReadOnly ||
        (contextMenu.objects > 0 && selection.length === 0))
    ) {
      setContextMenu(null);
    }
    let runContextMenuCommand = (
        input: ContextMenuCommandId,
        options: ActivationEvent,
      ) => {
        switch (input) {
          case "cut": {
            let value = frameClipboardAdapter.onCut();
            if (
              value !== undefined &&
              (0, runtime.copySelectionForCommand)(
                "cut",
                runtime.FRAME_CLIPBOARD_TYPE,
                value,
              )
            ) {
              value.commit();
            }
            return;
          }
          case "copy": {
            let value = frameClipboardAdapter.onCopy();
            if (value !== undefined) {
              (0, runtime.copySelectionForCommand)(
                "copy",
                runtime.FRAME_CLIPBOARD_TYPE,
                value,
              );
            }
            return;
          }
          case "paste": {
            let value = (0, runtime.getInternalClipboard)();
            if (value?.kind === runtime.FRAME_CLIPBOARD_TYPE) {
              frameClipboardAdapter.onPaste(value.data);
            } else if (value?.kind === runtime.SLIDE_CLIPBOARD_TYPE) {
              slideClipboardAdapter.onPaste(value.data);
            } else {
              (0, runtime.showToast)(framePasteUnavailableMessage);
            }
            return;
          }
          case "duplicate":
            return duplicateSelection();
          case "front":
          case "back":
            return void changeSelectionLayerOrder(input);
          case "group":
          case "ungroup":
            return groupOrUngroupSelection(input);
          case "properties":
            inspectorPointerInvocationRef.current = (0,
            runtime.isKeyboardOrPrimaryActivation)(options);
            return setInspectorOpen(true);
          case "delete":
            return deleteSelection();
          case "fit":
            return editorZoomApiRef.current?.returnToFit();
        }
      },
      groupOrUngroupSelection = (input: "group" | "ungroup") => {
        let value = getCurrentSlide(),
          value2 = editorZoomApiRef.current?.groupMeasure;
        if (!value || value2 === undefined) {
          return;
        }
        let value3 = (
          input === "group"
            ? runtime.groupSelectedUnits
            : runtime.ungroupSelectedUnits
        )(value, selection, value2);
        if ("refused" in value3) {
          (0, runtime.showToast)(value3.refused);
          return;
        }
        commitSlideEdit(value, value3.slide, input);
        setSelection(value3.selection);
        if (value3.note !== undefined) {
          (0, runtime.showToast)(value3.note);
        } else {
          (0, runtime.announceLiveMessage)(
            input === "group" ? "Grouped." : "Ungrouped.",
          );
        }
      },
      handleClipboardCommand = (event: KeyboardEvent) => {
        if (
          (0, runtime.groupingKeyCommand)(event) === undefined ||
          presentationStartIndex !== null ||
          (0, runtime.hasOpenOverlay)() ||
          gridTransitionActiveRef.current ||
          gridLeavingRef.current ||
          textEdit !== null
        ) {
          return false;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return false;
        }
        let value =
          target instanceof Element &&
          target.closest("[data-slides-comments]") !== null;
        return (
          !readOnly &&
          !currentSlideReadOnly &&
          !insertMenuRecentlyActive &&
          !dragActiveRef.current &&
          !value &&
          getCurrentSlide() !== undefined &&
          selection.length > 0
        );
      },
      clipboardCommandHandlerRef = runtime.reactd0.useRef(
        handleClipboardCommand,
      );
    clipboardCommandHandlerRef.current = handleClipboardCommand;
    let handleClipboardShortcut = runtime.reactd0.useCallback(
      (input: KeyboardEvent) => clipboardCommandHandlerRef.current(input),
      [],
    );
    runtime.reactd0.useEffect(() => {
      let callback = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
          return;
        }
        if (handleClipboardShortcut(event)) {
          event.preventDefault();
          if (!event.repeat) {
            groupOrUngroupSelection(
              (0, runtime.groupingKeyCommand)(event) === "ungroup"
                ? "ungroup"
                : "group",
            );
          }
          return;
        }
        if (presentationStartIndex !== null) {
          return;
        }
        if (!readOnly && (0, runtime.isDuplicateShortcut)(event)) {
          event.preventDefault();
        }
        let value = parseShapeInsertShortcut(event);
        if (
          (0, runtime.hasOpenOverlay)() &&
          !(insertMenuOpen && value !== undefined)
        ) {
          return;
        }
        if (gridTransitionActiveRef.current || gridLeavingRef.current) {
          return;
        }
        if (textEdit !== null) {
          return;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
        let value2 = event.metaKey || event.ctrlKey,
          value3 =
            editorElementRef.current?.querySelector("[data-slide-surface]") ??
            null,
          value4 =
            value3 !== null &&
            (value3.contains(target) ||
              target.contains(value3) ||
              (target instanceof Element &&
                target.closest("[data-object-proxies]") !== null)),
          value5 =
            target instanceof Element &&
            target.closest("[data-mc-strip]") !== null,
          value6 =
            (0, runtime.isInspectorFocusTarget)(target) ||
            (target instanceof Node &&
              (inspectorRegion()?.contains(target) ?? false)),
          value7 =
            value4 || (insertGestureActiveRef.current && !value5 && !value6);
        if (
          (event.key === "c" || event.key === "C") &&
          !value2 &&
          !event.altKey &&
          !event.shiftKey &&
          !event.repeat &&
          !event.isComposing &&
          !dragActiveRef.current &&
          !value6 &&
          !value5
        ) {
          let ctl = commentController.ctl;
          if (ctl?.enterMode) {
            event.preventDefault();
            if (commentController.on) {
              ctl.exitMode?.();
            } else {
              ctl.enterMode();
            }
            return;
          }
        }
        let value8 = getCurrentSlide();
        if (!value8) {
          return;
        }
        let value9 =
          target instanceof Element &&
          target.closest("[data-slides-comments]") !== null;
        if (
          (selection.length === 0 || currentSlideReadOnly || value9) &&
          !value5 &&
          !value6 &&
          (event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "PageUp" ||
            event.key === "PageDown")
        ) {
          event.preventDefault();
          pageSlide(
            event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 1,
          );
          return;
        }
        if (
          readOnly ||
          (currentSlideReadOnly && !insertMenuRecentlyActive) ||
          dragActiveRef.current ||
          value9
        ) {
          return;
        }
        if (
          event.key === "Enter" &&
          !event.repeat &&
          !value2 &&
          !event.shiftKey &&
          !event.altKey &&
          !insertMenuRecentlyActive &&
          selection.length === 1 &&
          (target === document.body || target.tabIndex < 0) &&
          !editorHasBlockingOverlay()
        ) {
          let value11 = selection[0]!,
            value12 = (0, runtime.selectedNode)(value8, value11);
          if (
            value12?.kind === "text" ||
            (value12?.kind === "table" &&
              value12.rows.length > 0 &&
              value12.cols > 0)
          ) {
            event.preventDefault();
            setTextEditState({
              frameId: value11.frameId,
              path: (0, runtime.selectionNodePath)(value11),
              ...(value12.kind === "table"
                ? {
                    cell: {
                      r: 0,
                      c: 0,
                    },
                  }
                : {}),
              caret: "end",
            });
            setProtectedEditorSlide(value8.id);
            return;
          }
        }
        if (value2 && event.key.toLowerCase() === "d") {
          if (insertMenuRecentlyActive) {
            event.preventDefault();
            duplicateSlide(value8.id);
            return;
          }
          if (selection.length > 0 && !currentSlideReadOnly) {
            event.preventDefault();
            duplicateSelection();
            return;
          }
          if (!event.shiftKey && !event.altKey) {
            event.preventDefault();
          }
          return;
        }
        if (currentSlideReadOnly) {
          return;
        }
        if (value !== undefined && !value6 && !value5) {
          event.preventDefault();
          setInsertMenuOpen(false);
          if (value === "text") {
            insertText();
          } else {
            insertShape(value, {
              byKey: insertWasKeyboard(),
            });
          }
          return;
        }
        let value10 = event.key.toLowerCase();
        if (
          value2 &&
          !event.shiftKey &&
          !event.altKey &&
          (value10 === "b" || value10 === "i" || value10 === "u")
        ) {
          let value11 = (0, runtime.filterValidSelections)(
            value8,
            selection,
          );
          if (value11.length === 0) {
            return;
          }
          if ((0, runtime.commonSelectedNodeKind)(value8, value11) !== "text") {
            return;
          }
          event.preventDefault();
          let value12 = (0, runtime.selectedNode)(
            value8,
            value11[value11.length - 1]!,
          );
          if (value12?.kind !== "text") {
            return;
          }
          let theme = snapshot.meta.theme,
            callback2 = (input: TextNode) =>
              value10 === "i"
                ? (0, runtime.nodeIsItalic)(input)
                : value10 === "u"
                  ? (0, runtime.nodeIsUnderlined)(input)
                  : (0, runtime.nodeIsBold)(input, theme),
            callback3 = (input: TextNode) =>
              value10 === "i"
                ? (0, runtime.toggleNodeItalic)(input)
                : value10 === "u"
                  ? (0, runtime.toggleNodeUnderline)(input)
                  : (0, runtime.toggleNodeBold)(
                      input,
                      theme,
                      (0, runtime.resolveTypographyEmphasisVariant)(
                        input,
                        currentTypeStyles,
                        deckTypeStyles,
                        theme,
                      ),
                    ),
            value13 =
              value10 === "u"
                ? value11
                    .map(
                      (input) =>
                        (0, runtime.selectedNode)(value8, input),
                    )
                    .find(
                      (input) =>
                        input?.kind === "text" &&
                        input.style?.textDecorationLine !== "line-through",
                    )
                : undefined,
            value14 = !callback2(
              value13?.kind === "text" ? value13 : value12,
            ),
            value15 = value11.reduce(
              (input, options) =>
                (0, runtime.updateSelectedNode)(
                  input,
                  options,
                  (source) =>
                    source.kind !== "text" || callback2(source) === value14
                      ? source
                      : callback3(source),
                ),
              value8,
            );
          commitSlideEdit(
            value8,
            value15,
            value10 === "i" ? "italic" : value10 === "u" ? "underline" : "bold",
          );
          return;
        }
        if (
          (0, runtime.isContextMenuKey)(event) &&
          value7 &&
          !insertMenuRecentlyActive &&
          !commentController.on
        ) {
          let value11 = editorZoomApiRef.current?.menuPoint();
          if (value11 == null) {
            return;
          }
          event.preventDefault();
          openContextMenu(
            {
              ...value11,
              from: "key",
            },
            selection,
          );
          return;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          selection.length > 0 &&
          value7
        ) {
          event.preventDefault();
          if (
            target instanceof Element &&
            target.closest("[data-object-proxy]") !== null
          ) {
            editorZoomApiRef.current?.focusSlide();
          }
          deleteSelection();
          return;
        }
        if (
          (event.key === "[" || event.key === "]") &&
          !event.metaKey &&
          (!event.ctrlKey || event.altKey) &&
          selection.length > 0 &&
          value7
        ) {
          if (changeSelectionLayerOrder(event.key === "[" ? "back" : "front")) {
            event.preventDefault();
          }
          return;
        }
        if (event.key.startsWith("Arrow") && selection.length > 0 && value7) {
          event.preventDefault();
          let value11 = event.shiftKey ? 1 : 8,
            value12 =
              event.key === "ArrowLeft"
                ? -value11
                : event.key === "ArrowRight"
                  ? value11
                  : 0,
            value13 =
              event.key === "ArrowUp"
                ? -value11
                : event.key === "ArrowDown"
                  ? value11
                  : 0,
            values = new Set(
              selection
                .filter((input) => input.child === undefined)
                .map((input) => input.frameId),
            );
          if (values.size === 0) {
            return;
          }
          let value14 = value8,
            state = {
              ...value14,
              frames: value14.frames.map(
                (input) =>
                  values.has(input.id)
                    ? {
                        ...input,
                        x: (0, runtime.moveAxisSpecPreservingSize)(
                          input.x,
                          value12,
                          (0, runtime.isTextNode)(input.node)
                            ? editorZoomApiRef.current?.measureUnit({
                                frameId: input.id,
                              })?.w
                            : undefined,
                          runtime.SLIDE_WIDTH,
                        ),
                        y: (0, runtime.moveAxisSpec)(input.y, value13),
                      }
                    : input,
              ),
            };
          commitSlideEdit(value14, state, "nudge");
          return;
        }
      };
      window.addEventListener("keydown", callback);
      return () =>
        window.removeEventListener("keydown", callback);
    }, [
      currentSlide,
      selection,
      presentationStartIndex,
      textEdit,
      insertFrame,
      commitSlideEdit,
      slides,
      currentSlideIndex,
      readOnly,
      currentSlideReadOnly,
      insertMenuOpen,
      snapshot.meta.theme,
      deckTypeStyles,
      inspectorRegion,
      inspectorOpen,
      commentController.ctl,
      commentController.on,
      insertMenuRecentlyActive,
    ]);
    runtime.reactd0.useEffect(() => {
      if (
        presentationStartIndex !== null ||
        (textEdit === null && selection.length === 0)
      ) {
        return;
      }
      let callback = (event: KeyboardEvent) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.isComposing
        ) {
          return;
        }
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
        if (
          target instanceof Node &&
          (inspectorRegion()?.contains(target) ?? false)
        ) {
          return;
        }
        if (
          target === document.body &&
          inspectorHadFocusRef.current &&
          inspectorRegion() !== null
        ) {
          return;
        }
        if (editorHasBlockingOverlay(", [data-media-crop]")) {
          return;
        }
        if (
          target instanceof Element &&
          target.closest("[data-link-mode]") !== null
        ) {
          return;
        }
        if (
          target instanceof Element &&
          target.closest("[data-mc-strip]") !== null
        ) {
          if (editorZoomApiRef.current?.focusSelection() === true) {
            event.preventDefault();
          }
          return;
        }
        if (textEdit !== null) {
          return;
        }
        event.preventDefault();
        if (
          target instanceof Element &&
          target.closest('[data-object-cursor="keys"]') !== null
        ) {
          editorZoomApiRef.current?.focusSlide();
          setSelection([]);
          return;
        }
        if (
          selection.length > 0 &&
          selection.every(
            (input) => input.child !== undefined,
          )
        ) {
          let items: NodeSelection[] = [],
            values = new Set<string>(),
            flag = false;
          for (let value of selection) {
            let value2 = (0, runtime.parentNodeSelection)(value);
            if (value2 === undefined) {
              continue;
            }
            let current = currentSlideRef.current,
              value3 =
                value2.child === undefined && current !== undefined
                  ? (0, runtime.frameById)(current, value2.frameId)
                  : undefined,
              value4 =
                value3 !== undefined &&
                current !== undefined &&
                (0, runtime.isPrimaryLayoutFrame)(current, value3)
                  ? value
                  : value2;
            if (value4 === value2) {
              flag = true;
            }
            let value5 =
              value4.frameId +
              ":" +
              (0, runtime.selectionNodePath)(value4).join(".");
            if (values.has(value5)) {
              continue;
            }
            values.add(value5);
            items.push(value4);
          }
          if (flag) {
            setSelection(items);
            return;
          }
        }
        if (
          target instanceof Element &&
          target.closest("[data-object-proxy]") !== null
        ) {
          editorZoomApiRef.current?.focusSlide();
        }
        setSelection([]);
      };
      window.addEventListener("keydown", callback, {
        capture: true,
      });
      return () =>
        window.removeEventListener("keydown", callback, {
          capture: true,
        });
    }, [presentationStartIndex, textEdit, selection, inspectorRegion]);
    runtime.reactd0.useEffect(() => {
      if (
        gridOpen ||
        !editingGridSlide ||
        presentationStartIndex !== null ||
        commentController.on ||
        textEdit !== null ||
        selection.length > 0 ||
        inspectorOpen ||
        currentSlide === undefined
      ) {
        return;
      }
      let callback = (event: KeyboardEvent) => {
        if (
          event.key !== "Escape" ||
          event.repeat ||
          event.defaultPrevented ||
          event.isComposing
        ) {
          return;
        }
        let target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
        if (editorHasBlockingOverlay()) {
          return;
        }
        event.preventDefault();
        returnToGrid();
      };
      window.addEventListener("keydown", callback);
      return () =>
        window.removeEventListener("keydown", callback);
    }, [
      gridOpen,
      editingGridSlide,
      presentationStartIndex,
      commentController.on,
      textEdit,
      selection.length,
      inspectorOpen,
      currentSlide,
      returnToGrid,
    ]);
    runtime.reactd0.useLayoutEffect(() => {
      if (!editingGridSlide) {
        gridFollowRef.current = null;
        return;
      }
      if (presentationStartIndex !== null) {
        return;
      }
      followGridEditingSlide();
      if (
        currentSlide &&
        gridSlideSurround &&
        gridSlideSurround.id !== currentSlide.id
      ) {
        selectGridSlideSurround(currentSlide.id);
      }
    }, [
      editingGridSlide,
      presentationStartIndex,
      currentSlide,
      gridSlideSurround,
      selectGridSlideSurround,
      followGridEditingSlide,
    ]);
    let editorSurround = runtime.reactd0.useMemo(
        () =>
          editingGridSlide && gridSlideSurround
            ? {
                seat: gridSlideSurround.rect,
                pick: gridSlideSurround.pick,
                minScale: gridSlideSurround.minScale,
                maxScale: gridSlideSurround.maxScale,
                onViewChange: (input: CameraView, options: ScreenRect) => {
                  gridFollowRef.current = {
                    id: gridSlideSurround.id,
                    view: input,
                    rect: options,
                  };
                  followGridEditingSlide();
                },
                onOutsideClick: (input: number, options: number) =>
                  returnToGrid({
                    select:
                      gridZoomApiRef.current?.tileAt(input, options) ??
                      undefined,
                  }),
                onFit: () =>
                  returnToGrid({
                    fit: true,
                  }),
              }
            : undefined,
        [
          editingGridSlide,
          gridSlideSurround,
          followGridEditingSlide,
          returnToGrid,
        ],
      ),
      frameClipboardAdapter = {
        kind: runtime.FRAME_CLIPBOARD_TYPE,
        enabled:
          presentationStartIndex === null && textEdit === null && !gridOpen,
        onCopy: () => {
          if (insertMenuRecentlyActive || !currentSlide) {
            return;
          }
          let value = getCopyableSelection();
          if (value.length === 0) {
            return;
          }
          let value2 = value.map(
            (input) => input.frame,
          );
          return {
            data: (0, runtime.createFramesClipboardPayload)(
              value2,
              snapshot.assets,
            ),
            text: (0, runtime.framesClipboardText)(value2),
          };
        },
        onCut: () => {
          let value = getCurrentSlide();
          if (
            currentSlideHeld &&
            !readOnly &&
            !insertMenuRecentlyActive &&
            selection.length > 0
          ) {
            (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
          }
          if (
            currentSlideReadOnly ||
            insertMenuRecentlyActive ||
            !value ||
            dragActiveRef.current
          ) {
            return;
          }
          let value2 = getCopyableSelection();
          if (value2.length === 0) {
            return;
          }
          let value3 = value2.map(
              (input) => input.frame,
            ),
            value4 = value,
            value5 = value2.map(
              (input) => input.unit,
            );
          return {
            data: (0, runtime.createFramesClipboardPayload)(
              value3,
              snapshot.assets,
            ),
            text: (0, runtime.framesClipboardText)(value3),
            commit: () => {
              let activeElement = document.activeElement;
              if (
                activeElement instanceof Element &&
                activeElement.closest("[data-object-proxy]") !== null
              ) {
                editorZoomApiRef.current?.focusSlide();
              }
              let value6 = value4,
                value7 = value5
                  .filter(
                    (input) => input.child !== undefined,
                  )
                  .sort(
                    (input, options) =>
                      (0, runtime.compareNodePaths)(
                        (0, runtime.selectionNodePath)(options),
                        (0, runtime.selectionNodePath)(input),
                      ),
                  );
              for (let value8 of value7)
                value6 = (0, runtime.removeSlideNode)(
                  value6,
                  value8.frameId,
                  (0, runtime.selectionNodePath)(value8),
                );
              for (let value8 of value5)
                if (value8.child === undefined) {
                  value6 = (0, runtime.removeSlideFrame)(
                    value6,
                    value8.frameId,
                  );
                }
              value6 = removeUnusedFrameAssets(value4, value6, value7);
              commitSlideEdit(value4, value6, "cut");
              setSelection([]);
            },
          };
        },
        onPaste: (input: unknown) => {
          let value = getCurrentSlide();
          if (currentSlideHeld && !readOnly) {
            (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
          }
          if (currentSlideReadOnly || !value || dragActiveRef.current) {
            return;
          }
          let value2 = (0, runtime.parsePastedFrames)(
            input,
            value,
            snapshot.assets,
          );
          if ("error" in value2) {
            (0, runtime.showToast)(value2.error);
            return;
          }
          let value3 = value2.frames.reduce(
            (input2, options) =>
              input2 + (0, runtime.countNodeTableCells)(options.node),
            0,
          );
          if (!canAddTableCells(value3)) {
            return;
          }
          if (
            !canAddStyledNodes(
              value2.frames.map((input2) => input2.node),
            )
          ) {
            return;
          }
          let value4 = value,
            state = {
              ...value4,
              frames: [...value4.frames, ...value2.frames],
            };
          undoHistory.exec({
            label: "paste",
            do: () => {
              if (slideHtmlHold2(state.id) !== undefined) {
                return void canChangeSlide(state);
              }
              for (let [value6, value7] of value2.addAssets)
                documentStore.setAssetEntry(value6, value7);
              documentStore.setSlide(state);
            },
            undo: () => {
              if (!canChangeSlide(value4)) {
                return;
              }
              for (let [value6] of value2.addAssets)
                documentStore.removeAssetEntry(value6);
            },
          });
          let value5 = value2.frames[value2.frames.length - 1];
          if (insertWasKeyboard() && value5 !== undefined) {
            editorZoomApiRef.current?.landOnCreated(value5.id);
          }
          setSelection(
            value2.frames.map(
              (input2) => ({
                frameId: input2.id,
              }),
            ),
          );
          if (value2.leftClips) {
            (0, runtime.showToast)(COPIED_VIDEO_OMISSION_MESSAGE);
          }
        },
        onPasteText: (input: string) => {
          if (currentSlideHeld && !readOnly) {
            (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
          }
          if (currentSlideReadOnly || !currentSlide || dragActiveRef.current) {
            return false;
          }
          let value = videoLinksEnabled
            ? (0, runtime.parseVideoLinkUrl)(input)
            : null;
          if (value !== null) {
            insertVideoLink(value, "paste", insertWasKeyboard());
            return true;
          }
          let value2 = (0, runtime.defaultBodyTypographyStyle)(
              deckTypeStyles,
            ),
            state: TextNode = {
              kind: "text",
              role: "body",
              text: (0, runtime.truncateUtf16Safely)(input, 2000),
              ...(value2 !== null
                ? {
                    style: {
                      fontWeight: value2.fontWeight,
                    },
                  }
                : {}),
            },
            state2 = {
              id: (0, runtime.createModelId)(),
              ...placeInsertedFrame(undefined, 720),
              node:
                value2 !== null
                  ? (0, runtime.applyTypographyStyle)(
                      state,
                      value2,
                      snapshot.meta.theme,
                    )
                  : state,
            };
          insertFrame(state2, "paste", insertWasKeyboard());
          return true;
        },
        onPasteFiles: (input: File[]) => {
          if (currentSlideHeld && !readOnly) {
            (0, runtime.showToast)(DAMAGED_SLIDE_ACTION_MESSAGE);
            return true;
          }
          let value = input.find(runtime.isImageFile) ?? input[0];
          if (
            currentSlideReadOnly ||
            !currentSlide ||
            dragActiveRef.current ||
            value === undefined
          ) {
            return false;
          }
          insertImageFromInput(value, {
            byKey: insertWasKeyboard(),
          });
          return true;
        },
        acceptFile: (input: File) =>
          (0, runtime.isImageFile)(input) || (0, runtime.isVideoFile)(input),
      };
    (0, runtime.useArtifactClipboard)(frameClipboardAdapter);
    let slideClipboardAdapter = {
      kind: runtime.SLIDE_CLIPBOARD_TYPE,
      enabled: presentationStartIndex === null && textEdit === null,
      onCopy: () => {
        if (gridOpen) {
          let value = slides.filter(
            (input) =>
              gridSelection.slides.includes(input.id),
          );
          if (value.length > 0) {
            return {
              data: (0, runtime.createSlidesClipboardPayload)(
                value,
                snapshot.assets,
              ),
              text: (0, runtime.slidesClipboardText)(value),
            };
          } else {
            return undefined;
          }
        }
        if (!insertMenuRecentlyActive || !currentSlide) {
          return;
        }
        return {
          data: (0, runtime.createSlideClipboardPayload)(
            currentSlide,
            snapshot.assets,
          ),
          text: (0, runtime.slideClipboardText)(currentSlide),
        };
      },
      onCut: () => {
        if (
          readOnly ||
          gridOpen ||
          !insertMenuRecentlyActive ||
          !currentSlide ||
          slides.length <= 1
        ) {
          return;
        }
        let value = currentSlide;
        return {
          data: (0, runtime.createSlideClipboardPayload)(
            value,
            snapshot.assets,
          ),
          text: (0, runtime.slideClipboardText)(value),
          commit: () => deleteSlide(value.id),
        };
      },
      onPaste: (input: unknown) => {
        if (readOnly) {
          return;
        }
        if (hidingMovedDeck()) {
          (0, runtime.showToast)(LOADING_PRESENTATION_PASTE_MESSAGE);
          return;
        }
        let value = (0, runtime.parsePastedSlides)(
          input,
          slides,
          snapshot.assets,
        );
        if ("error" in value) {
          (0, runtime.showToast)(value.error);
          return;
        }
        let value2 = gridOpen
            ? Math.max(
                currentSlideIndex,
                slides.findLastIndex(
                  (input2) =>
                    gridSelection.slides.includes(input2.id),
                ),
              )
            : currentSlideIndex,
          value3 = value2 >= 0 ? value2 + 1 : slides.length,
          entries = new Map(value.addAssets);
        {
          let values2 = new Set<string>();
          for (let value4 of value.slides)
            (0, runtime.collectSlideAssetIds)(value4, values2);
          for (let value4 of values2) {
            let value5 =
              entries.get(value4) ?? snapshot.assets.get(value4);
            if (value5 !== undefined) {
              entries.set(value4, value5);
            }
          }
        }
        let values = new Set<string>(),
          items: DuplicatedSlideRecord[] = [];
        undoHistory.exec({
          label: value.slides.length > 1 ? "paste slides" : "paste slide",
          canDo: () => {
            let length = value.slides.filter(
              (input2) =>
                documentStore.getSlide(input2.id) === undefined,
            ).length;
            if (
              length === 0 ||
              documentStore.getSnapshot().meta.order.length + length <=
                runtime.maxDeckSlides
            ) {
              return true;
            }
            (0, runtime.showToast)(
              "This presentation can’t hold " +
                String(length) +
                " more slides. Remove some first.",
            );
            return false;
          },
          do: () => {
            if (
              value.slides.some(
                (input2) =>
                  documentStore.getSlide(input2.id) !== undefined &&
                  slideCapacityAvailable(input2.id),
              )
            ) {
              return;
            }
            items = items.filter(
              (input2) =>
                documentStore.getSlide(input2.id) !== undefined,
            );
            let value4 = value.slides.filter(
              (input2) =>
                documentStore.getSlide(input2.id) === undefined,
            );
            if (value4.length > 0) {
              for (let value6 of showPasteWarnings(entries))
                values.add(value6);
            }
            let value5 = value3;
            for (let value6 of value4) {
              items.push({
                id: value6.id,
                ob: documentStore.sectionsSnapshot(),
              });
              documentStore.insertSlide(value6, value5++);
            }
          },
          undo: () => {
            documentStore.forgetParked(
              value.slides.map((input2) => input2.id),
            );
            let value4 = value.slides.filter(
              (input2) =>
                documentStore.getSlide(input2.id) !== undefined,
            );
            if (
              value4.some(
                ({ id: id }) => slideCapacityAvailable(id),
              )
            ) {
              return;
            }
            let entries2 = new Map(
              items.map((input2) => [input2.id, input2.ob]),
            );
            for (let { id: value6 } of [...value4].reverse()) {
              for (let [value7, value8] of Object.entries(
                documentStore.snapshotAssetsFor(value6),
              ))
                entries.set(value7, value8);
              documentStore.removeSlideKeepAssets(value6);
              let entry = entries2.get(value6);
              if (entry) {
                documentStore.restoreSections(entry);
              }
            }
            let value5 = referencedAssetIds();
            for (let value6 of values)
              if (!value5.has(value6)) {
                documentStore.removeAssetEntry(value6);
              }
            values = new Set(
              [...values].filter(
                (input2) => value5.has(input2),
              ),
            );
          },
        });
        if (value.leftClips) {
          (0, runtime.showToast)(COPIED_VIDEO_OMISSION_MESSAGE);
        }
        setCurrentSlideId(value.slides[value.slides.length - 1]!.id);
        setSelection([]);
      },
    };
    (0, runtime.useArtifactClipboard)(slideClipboardAdapter);
    let editorElementRef = runtime.reactd0.useRef<HTMLElement | null>(null),
      [topInset, registerEditorElement, sideInset]: ToolbarInsets = (0,
      runtime.useToolbarInsets)(),
      [gridTopInset, registerGridElement]: ToolbarInsets = (0,
      runtime.useToolbarInsets)(),
      railLayout = (0, runtime.PageOcclusionReporter)({
        band: pageOcclusionBand,
        presenting: presentationStartIndex !== null,
        settle: [
          railOpen,
          notesOpen,
          notesHeight,
          thumbWidth,
          gridOpen,
          editingGridSlide,
          currentSlide === undefined,
        ].join(),
        speaksForPage: host === undefined,
      }),
      { stage: setRailSlidesView, canvasView: setRailGridView } =
        railLayout,
      registerGridElementAndRail = runtime.reactd0.useCallback(
        (input: HTMLElement | null) => {
          registerGridElement(input);
          setRailGridView(input);
        },
        [registerGridElement, setRailGridView],
      ),
      findViewStateRef = runtime.reactd0.useRef({
        slides: snapshot.slides,
        currentId: currentSlideId,
        inGrid: gridOpen && !editingGridSlide,
      });
    findViewStateRef.current = {
      slides: snapshot.slides,
      currentId: currentSlideId,
      inGrid: gridOpen && !editingGridSlide,
    };
    let findViewSubscribers = runtime.reactd0.useRef(new Set<() => void>()),
      findViewGeneration = textEdit !== null;
    runtime.reactd0.useEffect(() => {
      for (let value of findViewSubscribers.current) value();
    }, [
      snapshot.slides,
      currentSlideId,
      gridOpen,
      editingGridSlide,
      findViewGeneration,
    ]);
    let findNavigationSequenceRef = runtime.reactd0.useRef(0),
      findPainter = runtime.reactd0.useMemo(
        () =>
          (0, runtime.createFindHighlightPainter)({
            slides: () => findViewStateRef.current.slides,
            subscribe: (input: () => void) => {
              findViewSubscribers.current.add(input);
              return () =>
                void findViewSubscribers.current.delete(input);
            },
            inGrid: () => findViewStateRef.current.inGrid,
            currentId: () => findViewStateRef.current.currentId,
            showSlide: (input: SlideId) => {
              editorZoomApiRef.current?.endTextEdit();
              (0, runtime.blurEditingTargetForFind)(
                document,
                "[data-notes-tray]",
              );
              findNavigationSequenceRef.current++;
              setCurrentSlideId(input);
              setSelection([]);
              setTextEditState(null);
            },
            panGridTo: (input: SlideId) =>
              void gridZoomApiRef.current?.tileRect(input),
            returnToFit: () => editorZoomApiRef.current?.returnToFit(),
            viewport: () =>
              document.querySelector("[data-slides-editor]"),
            surfaces: (input: SlideId) => {
              let value =
                  input === findViewStateRef.current.currentId
                    ? document.querySelector(
                        ACTIVE_SLIDE_SURFACE_SELECTOR,
                      )
                    : null,
                element = document.querySelector(
                  '[data-grid-tile="' + CSS.escape(input) + '"]',
                );
              return [value, element].filter(
                (input2) => input2 !== null,
              );
            },
          }),
        [],
      ),
      ownsPageFind = host !== undefined;
    runtime.reactd0.useEffect(
      () =>
        ownsPageFind ? (0, runtime.trackSlidesFindScope)(window) : undefined,
      [ownsPageFind],
    );
    let findController: ArtifactFindController = (0, runtime.useArtifactFind)({
        adapter: findPainter,
        enabled: presentationStartIndex === null,
        isOurs: (input: EventTarget | null) =>
          !ownsPageFind || (0, runtime.canHandleSlidesFindShortcut)(input),
        ownsStepChord: handleClipboardShortcut,
        viewMoves: () => findNavigationSequenceRef.current,
        restoreFocus: () => editorZoomApiRef.current?.focusSlide(),
      }),
      creationStageRef = runtime.reactd0.useCallback(
        (input: HTMLElement | null) => {
          editorElementRef.current = input;
          registerEditorElement(input);
          setRailSlidesView(input);
        },
        [registerEditorElement, setRailSlidesView],
      ),
      getFittedSlideScale =
        runtime.reactd0.useCallback(() => {
          let value =
            editorElementRef.current?.getBoundingClientRect();
          if (value === undefined) {
            return;
          }
          return (0, runtime.fitSlideEditorViewport)({
            w: value.width,
            h: Math.max(0, value.height - topInset - pageOcclusionBand),
            top: topInset,
            sidePad: sideInset > 0 ? sideInset : undefined,
          }).scale;
        }, [topInset, sideInset, pageOcclusionBand]),
      designPaletteRef = runtime.reactd0.useRef(
        EMPTY_EXTRA_EXPORT_FORMATS,
      ),
      designPalette = runtime.reactd0.useMemo(() => {
        if (liveGestureRef.current) {
          return designPaletteRef.current;
        }
        let value = designSystemActive
          ? EMPTY_EXTRA_EXPORT_FORMATS
          : (0, runtime.collectPresentationPalette)(slides);
        if (designPaletteRef.current.join() !== value.join()) {
          designPaletteRef.current = value;
        }
        return designPaletteRef.current;
      }, [slides, gestureGeneration, designSystemActive]),
      slidePaletteRef = runtime.reactd0.useRef(
        EMPTY_EXTRA_EXPORT_FORMATS,
      ),
      slidePalette = runtime.reactd0.useMemo(() => {
        if (liveGestureRef.current) {
          return slidePaletteRef.current;
        }
        let value =
          designSystemActive && currentSlide !== undefined
            ? (0, runtime.collectPresentationPalette)([currentSlide], 1 / 0)
            : EMPTY_EXTRA_EXPORT_FORMATS;
        if (slidePaletteRef.current.join() !== value.join()) {
          slidePaletteRef.current = value;
        }
        return slidePaletteRef.current;
      }, [currentSlide, gestureGeneration, designSystemActive]),
      currentSlideRef = runtime.reactd0.useRef(currentSlide);
    currentSlideRef.current = currentSlide;
    runtime.reactd0.useEffect(() => {
      let callback = (input: EventTarget | null) =>
          input instanceof Node &&
          (inspectorRegion()?.contains(input) ?? false),
        callback2 = (event: FocusEvent) => {
          inspectorHadFocusRef.current = callback(event.target);
          if (inspectorHadFocusRef.current) {
            inspectorLastFocusRegionRef.current = inspectorRegion();
          }
        },
        callback3 = (event: FocusEvent) => {
          if (
            callback(event.target) &&
            event.relatedTarget instanceof Node &&
            !callback(event.relatedTarget)
          ) {
            inspectorHadFocusRef.current = false;
          }
        },
        callback4 = (event: PointerEvent) => {
          let value =
            event.target instanceof Element &&
            event.target.closest(runtime.OPEN_OVERLAY_SELECTOR) !== null;
          if (!callback(event.target) && !value) {
            inspectorHadFocusRef.current = false;
          }
        };
      document.addEventListener("focusin", callback2);
      document.addEventListener("focusout", callback3);
      document.addEventListener("pointerdown", callback4, true);
      return () => {
        document.removeEventListener("focusin", callback2);
        document.removeEventListener("focusout", callback3);
        document.removeEventListener(
          "pointerdown",
          callback4,
          true,
        );
      };
    }, [inspectorRegion]);
    let inspectorWasOpenRef = runtime.reactd0.useRef(inspectorOpen);
    runtime.reactd0.useEffect(() => {
      let current = inspectorWasOpenRef.current;
      inspectorWasOpenRef.current = inspectorOpen;
      let current2 = inspectorPointerInvocationRef.current;
      inspectorPointerInvocationRef.current = false;
      if (inspectorOpen === current) {
        return;
      }
      let index = 0,
        callback = (input: number) => {
          index = requestAnimationFrame(() => {
            let activeElement = document.activeElement,
              value =
                activeElement === document.body ||
                activeElement === null;
            if (inspectorOpen) {
              if (!current2) {
                return;
              }
              let value2 = inspectorCloseButton();
              if (value2 === null) {
                if (input > 0) {
                  callback(input - 1);
                }
                return;
              }
              value2.focus({
                preventScroll: true,
              });
              return;
            }
            if (
              !(
                (value ||
                  (inspectorLastFocusRegionRef.current?.contains(
                    activeElement,
                  ) ??
                    false)) &&
                (current2 || inspectorHadFocusRef.current)
              )
            ) {
              return;
            }
            if (editorZoomApiRef.current?.focusSelection() !== true) {
              inspectorReturnFocusRef.current?.focus({
                preventScroll: true,
              });
            }
          });
        };
      callback(4);
      return () => cancelAnimationFrame(index);
    }, [inspectorOpen, inspectorCloseButton]);
    (0, runtime.useRegionKeyboardNavigation)(
      [
        {
          el: () =>
            document.querySelector("header.tb-root"),
        },
        {
          el: () => editorElementRef.current,
          home: true,
          enter: () =>
            editorZoomApiRef.current?.focusSelection() ?? false,
          fallback: () =>
            editorElementRef.current?.querySelector("[data-slide-surface]") ??
            null,
        },
        {
          el: () =>
            document.querySelector("[data-slides-strip]"),
        },
        {
          el: () => insertMenuRef.current,
          fallback: () =>
            insertMenuRef.current?.querySelector(
              '[role="option"][aria-selected="true"]',
            ) ?? null,
        },
        {
          el: inspectorRegion,
          fallback: inspectorCloseButton,
        },
        (0, runtime.notificationsFocusRegion)(),
      ],
      () =>
        presentingRef.current ||
        gridTransitionActiveRef.current ||
        gridLeavingRef.current,
    );
    (0, runtime.useCanvasFocusResolver)(
      () =>
        creationControllerRef.current.view.sheet !== "none"
          ? null
          : findActiveCommentSlideTarget(currentSlide?.id ?? null),
    );
    let focusRegionNavigatorRef = runtime.reactd0.useRef<SlideAnimationEngine | null>(null);
    runtime.reactd0.useEffect(() => {
      let current = editorElementRef.current;
      if (!current) {
        return;
      }
      let value = (0, runtime.createSlideAnimationEngine)({
        root: current,
        resolveBag: (input: Element) =>
          (0, runtime.replayClickedNodeAnimation)(
            currentSlideRef.current,
            input,
          ),
      });
      focusRegionNavigatorRef.current = value;
      return () => {
        value.dispose();
        focusRegionNavigatorRef.current = null;
      };
    }, [currentSlide !== undefined]);
    runtime.reactd0.useEffect(() => {
      focusRegionNavigatorRef.current?.refresh();
    }, [currentSlide, snapshot.assets]);
    let deliverExportFile = (
        input: ShellSaveResult,
        options: Blob,
        context: string,
        value: string,
        extra: string,
      ) => {
        if (input.outcome === "saved") {
          (0, runtime.showToast)("Saved " + context);
        } else if (input.outcome === "withheld") {
          (0, runtime.showToast)(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
        } else if (input.outcome === "unsupported") {
          if (input.code === "no_shell_save") {
            (0, runtime.downloadBlobInBrowser)(options, context);
            if (window.top === window) {
              return;
            }
          }
          setExportDelivery({
            blob: options,
            filename: context,
            mime: value,
            kind: extra,
            reason: input.code,
          });
        }
      },
      extraExportFormatsUnavailableMessage = (
        items: string[],
      ) =>
        "Export notes: " +
        String(items[0]) +
        (items.length > 1 ? " (+" + String(items.length - 1) + " more)" : ""),
      exportNotesToastRef = runtime.reactd0.useRef<number | null>(null),
      showExportNotes = (items: string[]) => {
        if (!extraExportFormats) {
          if (items.length > 0) {
            (0, runtime.showToast)(extraExportFormatsUnavailableMessage(items));
          }
          return;
        }
        let items2 = [...new Set(items)];
        if (items2.length === 0) {
          return;
        }
        if (exportNotesToastRef.current !== null) {
          (0, runtime.closeToast)(exportNotesToastRef.current);
        }
        if (items2.length === 1) {
          exportNotesToastRef.current = (0, runtime.showToast)(
            extraExportFormatsUnavailableMessage(items2),
          );
          return;
        }
        let value = (0, runtime.showActionToast)(
          extraExportFormatsUnavailableMessage(items2),
          SlidesAppJsx.jsx(runtime.Button, {
            size: "sm",
            variant: "secondary",
            onClick: () => {
              (0, runtime.closeToast)(value);
              setExportNotes(
                (input) => ({
                  notes: items2,
                  nth: (input?.nth ?? 0) + 1,
                }),
              );
            },
            children: "Details",
          }),
        );
        exportNotesToastRef.current = value;
      },
      renderPptxFile = async (input: PptxFontMode): Promise<ExportRender> => {
        let [
            { measureDeck: value2 },
            { deckToPptxBlob: value3, pptxFilename: value4 },
            { toBasicFonts: value5 },
            { measuredAsGoogleSlides: value6, toGoogleSlidesFonts: value7 },
            { pageFontSet: value8, toCurrentFonts: value9 },
            value,
          ] = await Promise.all([
            Promise.resolve().then(() => {
              (0, runtime.initializeDeckMeasurement)();
              return runtime.deckMeasurementExports;
            }),
            Promise.resolve().then(() => {
              (0, runtime.initializePptxExport)();
              return runtime.pptxGeometryExports;
            }),
            Promise.resolve().then(() => {
              (0, runtime.initializeFontSubstitution)();
              return runtime.fontSubstitutionExports;
            }),
            Promise.resolve().then(() => {
              (0, runtime.initializeGoogleSlidesFonts)();
              return runtime.googleSlidesFontExports;
            }),
            Promise.resolve().then(() => {
              (0, runtime.initializeCurrentFonts)();
              return runtime.currentFontExports;
            }),
            inlineLocalDeckResources(presentableSlides, snapshot.assets),
          ]),
          value11 = Date.now() + runtime.fontReadyTimeoutMs,
          value12 =
            input === "current" && extraExportFormats
              ? await value9(
                  value8(document),
                  value.slides,
                  snapshot.faces,
                  snapshot.fonts,
                  value11 - Date.now(),
                )
              : {
                  slides: value.slides,
                  moved: [],
                  notes: [],
                },
          { swapped: value13, swaps: value14 } = (0,
          runtime.createFontSubstitutionTracker)(),
          value15 =
            input === "basic"
              ? value5(value.slides, value13)
              : input === "google" && !extraExportFormats
                ? value7(value.slides, snapshot.faces, snapshot.fonts, value13)
                : value12.slides,
          value16 =
            input === "google" && extraExportFormats
              ? await value6(
                  document,
                  value.slides,
                  snapshot.faces,
                  snapshot.fonts,
                  (input2, options) => {
                    value15 = input2;
                    return value2(
                      snapshot.meta.title,
                      input2,
                      value.assets,
                      options,
                    );
                  },
                  {
                    swapped: value13,
                  },
                )
              : await value2(snapshot.meta.title, value15, value.assets, {
                  fontsReadyMs: Math.max(0, value11 - Date.now()),
                }),
          value17 = extraExportFormats && input !== "google",
          { blob: value18, warnings: value19 } = await value3(
            value16,
            {
              theme: value17,
              titlePlaceholders: value17,
            },
          ),
          value20 = !extraExportFormats
            ? []
            : input === "current"
              ? [
                  ...value12.notes,
                  ...[
                    (0, runtime.presentationFontPortabilityWarning)(
                      value12.slides,
                    ),
                  ].filter((input2) => input2 !== undefined),
                ]
              : (0, runtime.formatFontSubstitutionNotes)(value14(), input);
        return {
          blob: value18,
          filename: value4(snapshot.meta.title),
          warnings: [...value20, ...value.warnings, ...value19],
        };
      },
      downloadBasicPptx = async ({
        blob: blob,
        filename: filename,
        warnings: warnings,
      }: ExportRender): Promise<void> => {
        let value = await (0, runtime.saveThroughShell)(
          blob,
          filename,
        );
        deliverExportFile(
          value,
          blob,
          filename,
          runtime.PPTX_MIME_TYPE,
          "PPTX",
        );
        showExportNotes(warnings);
      },
      exportPptx = async (input: PptxFontMode): Promise<void> => {
        if (
          exporting ||
          exportDialogPendingRef.current ||
          presentableSlides.length === 0
        ) {
          return;
        }
        if (downloadsWithheld2) {
          (0, runtime.showToast)(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
          return;
        }
        if (!(await confirmCompleteDeckExport("Download"))) {
          return;
        }
        setExporting(true);
        try {
          let value =
            await exportStateRef.current.renderPptxFile(input);
          await downloadBasicPptx(value);
        } catch (value: unknown) {
          (0, runtime.showToast)(
            "PPTX export failed: " +
              (value instanceof Error ? value.message : String(value)),
          );
        } finally {
          setExporting(false);
        }
      },
      renderPdfFile = async (
        options: string,
        context: PdfPagesFinisher,
        value: PdfCaptureOptions = {},
        extra = false,
      ): Promise<TieredExportRender> => {
        let [
            {
              CAPTURE_TIERS: value4,
              PAGE_W_PT: value5,
              captureSlidesAsJpegs: value6,
            },
            value2,
            value3,
          ] = await Promise.all([
            Promise.resolve().then(() => {
              (0, runtime.initializePdfCapture)();
              return runtime.pdfCaptureExports;
            }),
            extra
              ? Promise.resolve().then(() => {
                  (0, runtime.initializeNotesPages)();
                  return runtime.notesPageExports;
                })
              : undefined,
            inlineLocalDeckResources(presentableSlides, snapshot.assets),
          ]),
          value7 = (0, runtime.defaultBodyTypographyStyle)(
            deckTypeStyles,
          ),
          value8 = value2?.planNotesPages(
            value3.slides,
            (input2) =>
              value7 !== null
                ? (0, runtime.applyTypographyStyle)(
                    input2,
                    value7,
                    snapshot.meta.theme,
                  )
                : input2,
          );
        return {
          tiers: value4,
          renderAt: async (
            input2: CaptureQuality,
            options2?: ExportRenderLimits,
          ): Promise<ExportRender> => {
            let state = {
                packWebFonts: extraExportFormats,
                fontsReadyMs: runtime.fontReadyTimeoutMs,
                ...(extraExportFormats && {
                  nameMissingFonts: true,
                }),
                ...value,
                ...options2,
              },
              value9 =
                value3.slides.length /
                (value3.slides.length + (value8?.noteSlides.length ?? 0)),
              value10 =
                options2 === undefined || value8 === undefined
                  ? state
                  : {
                      ...state,
                      deadline:
                        Date.now() + (options2.deadline - Date.now()) * value9,
                    },
              value11 = await value6(
                value3.slides,
                value3.assets,
                input2,
                value10,
              ),
              { pages: value12 } = value11,
              items = [...value3.warnings, ...value11.warnings],
              copyMs = value11.copyMs;
            if (
              value2 !== undefined &&
              value8 !== undefined &&
              value8.noteSlides.length > 0
            ) {
              let value15 = value2.notesPictureAssets(
                  value3.slides,
                  value11.pages,
                  value8.after,
                ),
                value16 = value8.after.flatMap(
                  (input3, options3) =>
                    Array.from(
                      {
                        length: input3,
                      },
                      () => options3 + 1,
                    ),
                ),
                callback = (input3: string) =>
                  input3.replace(
                    /\bslides? (\d+(?:, \d+)*)/g,
                    (input4: string, options3: string) => {
                      let value18 = options3
                        .split(", ")
                        .map(
                          (input5) =>
                            String(value16[Number(input5) - 1] ?? "?"),
                        );
                      return (
                        (value18.length === 1
                          ? "the notes page for slide "
                          : "the notes pages for slides ") + value18.join(", ")
                      );
                    },
                  ),
                value17: PdfCaptureResult;
              try {
                value17 = await value6(
                  value8.noteSlides,
                  new Map([...value3.assets, ...value15]),
                  input2,
                  state,
                );
              } catch (value18: unknown) {
                throw value18 instanceof Error
                  ? Error(callback(value18.message), {
                      cause: value18,
                    })
                  : value18;
              }
              value12 = value2.placeNotesPages(
                value12,
                value17.pages,
                value8.after,
                value5 / runtime.SLIDE_WIDTH,
              );
              for (let value18 of value17.warnings.map(callback))
                if (!items.includes(value18)) {
                  items.push(value18);
                }
              for (let value18 of value8.cut)
                items.push(
                  "slide " +
                    String(value18) +
                    ": its speaker notes run past " +
                    String(value2.NOTES_PAGE.maxPages) +
                    " notes pages, so the last one may be set smaller and not show them all",
                );
              copyMs = (copyMs ?? 0) + (value17.copyMs ?? 0);
            }
            let index = 0,
              index2 = 0;
            for (let value15 of value12) {
              index += value15.lossless?.zlib.length ?? 0;
              index2 += value15.lossless?.zlib.length ?? value15.jpeg.length;
            }
            let value13 = index2 > 0 ? 2 - index / index2 : 2,
              value14 = await context(value12, value3.slides);
            return {
              blob: value14,
              filename: options,
              warnings: items,
              sizeExponent: value13,
              copyMs: copyMs,
            };
          },
        };
      },
      preparePdfRender = async (
        input = false,
      ): Promise<TieredExportRender> => {
        let [
          { PAGE_H_PT: value, PAGE_W_PT: value2, pdfFilename: value3 },
          { documentLanguage: value4, jpegPagesToPdf: value5 },
        ] = await Promise.all([
          Promise.resolve().then(() => {
            (0, runtime.initializePdfCapture)();
            return runtime.pdfCaptureExports;
          }),
          Promise.resolve().then(() => {
            (0, runtime.initializePdfWriter)();
            return runtime.pdfWriterExports;
          }),
        ]);
        return renderPdfFile(
          value3(snapshot.meta.title),
          (input2) => {
            let value6 = value5(
              input2.map(
                (input3) => ({
                  jpeg: input3.jpeg,
                  lossless: input3.lossless,
                  widthPt: value2,
                  heightPt: value,
                  textRuns: input3.textRuns,
                  blocks: input3.blocks,
                  links: input3.links,
                }),
              ),
              extraExportFormats
                ? {
                    title: snapshot.meta.title,
                    textEncoding: "unicode",
                    tagged: true,
                    outline: true,
                    lang: value4(
                      snapshot.meta.title +
                        `
` +
                        input2.flatMap(
                          (input3) =>
                            input3.textRuns.map(
                              (input4) => input4.text,
                            ),
                        ).join(`
`),
                    ),
                  }
                : {
                    title: snapshot.meta.title,
                    textEncoding: "winansi",
                  },
            );
            return new Blob([value6.slice().buffer], {
              type: runtime.PDF_MIME_TYPE,
            });
          },
          {
            losslessPages: extraExportFormats,
          },
          input,
        );
      },
      preparePptxPicturesRender = async (): Promise<TieredExportRender> => {
        let [
          { slidePicturesToPptxBlob: value },
          { pptxFilename: value2 },
        ] = await Promise.all([
          Promise.resolve().then(() => {
            (0, runtime.initializePicturePptx)();
            return runtime.picturePptxExports;
          }),
          Promise.resolve().then(() => {
            (0, runtime.initializePptxExport)();
            return runtime.pptxGeometryExports;
          }),
        ]);
        return renderPdfFile(
          value2(snapshot.meta.title),
          (input, options) =>
            value(snapshot.meta.title, options, input),
        );
      },
      renderWithImageBudget = async (
        {
          tiers: tiers,
          renderAt: renderAt,
          reducedNote = () => SHELL_EXPORT_IMAGE_REDUCTION_NOTE,
        }: TieredExportRender,
        options: number,
        context: number,
        value?: AbortSignal,
      ): Promise<ExportRender> => {
        let callback = async (input: CaptureQuality): Promise<{ made: ExportRender; tookMs: number }> => {
            let value5 = Date.now(),
              value6 = await renderAt(input, {
                deadline: context,
                maxBytes:
                  options >= MAX_BROWSER_EXPORT_BYTES
                    ? Number.POSITIVE_INFINITY
                    : options,
                ...(value !== undefined && {
                  signal: value,
                }),
              });
            return {
              made: value6,
              tookMs: Math.max(0, Date.now() - value5 - (value6.copyMs ?? 0)),
            };
          },
          value2 = tiers[0]!,
          { made: value3, tookMs: value4 } = await callback(value2),
          warnings = value3.warnings;
        while (
          value3.blob.size > options &&
          Date.now() + value4 < context &&
          value?.aborted !== true
        ) {
          let value5 = value2,
            value6 = tiers.filter(
              (input) => input.scale < value5.scale,
            );
          if (value6.length === 0) {
            break;
          }
          value2 =
            value6.find(
              (input) =>
                value3.blob.size *
                  (input.scale / value5.scale) ** (value3.sizeExponent ?? 2) <=
                options,
            ) ?? value6[value6.length - 1]!;
          let value7: ExportRender;
          try {
            ({ made: value7, tookMs: value4 } = await callback(value2));
          } catch {
            break;
          }
          for (let value8 of value7.warnings)
            if (!warnings.includes(value8)) {
              warnings.push(value8);
            }
          value3 = value7;
          if (value3.blob.size <= options) {
            warnings.unshift(reducedNote(value2));
          }
        }
        return {
          ...value3,
          warnings: warnings,
        };
      },
      pdfQualityRenderOptions = (
        input: TieredExportRender,
        options: PdfExportQuality,
      ) => {
        let value = input.tiers.length - 1;
        return {
          ...input,
          tiers: input.tiers.slice(
            options === "best"
              ? 0
              : options === "better"
                ? Math.min(1, value)
                : value,
          ),
        };
      },
      renderAndDownload = async (
        {
          tiers: tiers,
          renderAt: renderAt,
          reducedNote = () => SHELL_EXPORT_IMAGE_REDUCTION_NOTE,
        }: TieredExportRender,
        options: string,
        context: string,
      ): Promise<void> => {
        let value2 = await renderAt(tiers[0]!),
          { filename: value3, warnings: value4 } = value2;
        let value5 = await (0, runtime.saveThroughShell)(
          value2.blob,
          value3,
        );
        for (
          let count = 1;
          value5.code === "too_large" && count < tiers.length;
          count++
        ) {
          let value6: ExportRender;
          try {
            value6 = await renderAt(tiers[count]!);
          } catch {
            break;
          }
          for (let value7 of value6.warnings)
            if (!value4.includes(value7)) {
              value4.push(value7);
            }
          value5 = await (0, runtime.saveThroughShell)(value6.blob, value3);
          if (value5.outcome === "saved") {
            value4.unshift(reducedNote(tiers[count]!));
          }
        }
        deliverExportFile(value5, value2.blob, value3, options, context);
        showExportNotes(value4);
      },
      downloadPdf = async (): Promise<void> => {
        if (
          exporting ||
          exportDialogPendingRef.current ||
          presentableSlides.length === 0
        ) {
          return;
        }
        if (downloadsWithheld2) {
          (0, runtime.showToast)(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
          return;
        }
        let value: PdfExportOptions | undefined;
        if (extraExportFormats) {
          value = (await askPdfOptions()) ?? undefined;
          if (value === undefined) {
            return;
          }
        } else if (!(await confirmCompleteDeckExport("Download"))) {
          return;
        }
        setExporting(true);
        try {
          let value2 = await exportStateRef.current.preparePdfRender(
            value?.notes === true,
          );
          await renderAndDownload(
            value === undefined
              ? value2
              : pdfQualityRenderOptions(value2, value.quality),
            runtime.PDF_MIME_TYPE,
            "PDF",
          );
        } catch (value2: unknown) {
          (0, runtime.showToast)(
            "PDF export failed: " +
              (value2 instanceof Error ? value2.message : String(value2)),
          );
        } finally {
          setExporting(false);
        }
      },
      getSlideToExport = () =>
        presentationStartIndex !== null
          ? presentableSlides[
              presentationCurrentIndex ?? presentationStartIndex
            ]
          : currentSlide,
      renderPngFile = async (): Promise<TieredExportRender> => {
        let value = getSlideToExport();
        if (value === undefined) {
          throw Error("there is no slide to export");
        }
        let values = new Set<string>();
        (0, runtime.collectSlideAssetIds)(value, values);
        let [
            { CAPTURE_TIERS: value3, captureSlideAsPng: value4 },
            value2,
          ] = await Promise.all([
            Promise.resolve().then(() => {
              (0, runtime.initializePdfCapture)();
              return runtime.pdfCaptureExports;
            }),
            inlineLocalDeckResources(
              [value],
              new Map(
                [...snapshot.assets].filter(
                  ([input]) => values.has(input),
                ),
              ),
            ),
          ]),
          value5 = (0, runtime.slideExportFilename)(
            snapshot.meta.title,
            slides.indexOf(value) + 1,
            "png",
          ),
          callback = async (input: CaptureQuality): Promise<ExportRender> => {
            let value6 = await value4(
              value2.slides[0],
              value2.assets,
              input.scale,
              {
                packWebFonts: extraExportFormats,
                fontsReadyMs: runtime.fontReadyTimeoutMs,
                ...(extraExportFormats && {
                  nameMissingFonts: true,
                }),
              },
            );
            return {
              blob: new Blob([value6.png], {
                type: runtime.PNG_MIME_TYPE,
              }),
              filename: value5,
              warnings: [...value2.warnings, ...value6.warnings],
            };
          },
          callback2 = (input: number) =>
            String(Math.round(runtime.SLIDE_WIDTH * input)) +
            "×" +
            String(Math.round(runtime.SLIDE_HEIGHT * input));
        return {
          tiers: value3,
          renderAt: callback,
          reducedNote: (input: CaptureQuality) =>
            "the image was saved at " +
            callback2(input.scale) +
            " instead of " +
            callback2(value3[0].scale) +
            " to fit the 16 MB export limit",
        };
      },
      downloadPng = async (): Promise<void> => {
        if (exporting || getSlideToExport() === undefined) {
          return;
        }
        if (downloadsWithheld2) {
          (0, runtime.showToast)(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
          return;
        }
        setExporting(true);
        try {
          await renderAndDownload(
            await renderPngFile(),
            runtime.PNG_MIME_TYPE,
            "PNG",
          );
        } catch (value: unknown) {
          (0, runtime.showToast)(
            "PNG export failed: " +
              (value instanceof Error ? value.message : String(value)),
          );
        } finally {
          setExporting(false);
        }
      },
      renderHtmlFile = async ({
        fit: fit,
        deadline: deadline,
      }: { fit: boolean; deadline?: number }): Promise<ExportRender> => {
        let [{ htmlFilename: value2, renderDeckHtml: value3 }, value] =
            await Promise.all([
              Promise.resolve().then(() => {
                (0, runtime.initializeDeckHtml)();
                return runtime.deckHtmlExports;
              }),
              inlineLocalDeckResources(presentableSlides, snapshot.assets),
            ]),
          value4 = await value3(
            snapshot.meta.title,
            value.slides,
            value.assets,
            {
              importerReady: extraExportFormats,
              inlineWebFonts: extraExportFormats,
              maxBytes: runtime.MAX_SHELL_DOWNLOAD_BYTES,
              shrinkImages: extraExportFormats && fit,
              deadline: deadline,
              fontsReadyMs: runtime.fontReadyTimeoutMs,
              ...(extraExportFormats && {
                nameMissingFonts: true,
              }),
            },
          );
        return {
          blob: new Blob([value4.html], {
            type: runtime.HTML_MIME_TYPE,
          }),
          filename: value2(snapshot.meta.title),
          warnings: [
            ...(value4.reducedNote === undefined ? [] : [value4.reducedNote]),
            ...value.warnings,
            ...value4.warnings,
          ],
        };
      },
      downloadHtml = async (): Promise<void> => {
        if (
          exporting ||
          exportDialogPendingRef.current ||
          presentableSlides.length === 0
        ) {
          return;
        }
        if (downloadsWithheld2) {
          (0, runtime.showToast)(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
          return;
        }
        if (!(await confirmCompleteDeckExport("Download"))) {
          return;
        }
        setExporting(true);
        try {
          let value = await exportStateRef.current.renderHtmlFile({
              fit: false,
            }),
            { blob: value2, filename: value3 } = value,
            { warnings: value4 } = value;
          let value5 = await (0, runtime.saveThroughShell)(
            value2,
            value3,
          );
          if (value5.code === "too_large" && extraExportFormats) {
            let value6 = await exportStateRef.current
              .renderHtmlFile({
                fit: true,
              })
              .catch(() => {
                return;
              });
            if (value6 !== undefined && value6.blob.size < value2.size) {
              value5 = await (0, runtime.saveThroughShell)(value6.blob, value3);
              if (value5.outcome === "saved") {
                value4 = value6.warnings;
              }
            }
          }
          deliverExportFile(
            value5,
            value2,
            value3,
            runtime.HTML_MIME_TYPE,
            "HTML",
          );
          showExportNotes(value4);
        } catch (value: unknown) {
          (0, runtime.showToast)(
            "Web page export failed: " +
              (value instanceof Error ? value.message : String(value)),
          );
        } finally {
          setExporting(false);
        }
      },
      exportWarningsRef = runtime.reactd0.useRef<Record<string, string[]>>({}),
      askInteractivePdfOptions = async <T>(
        input: ExportProduceOptions,
        options: () => void,
        context: () => Promise<T>,
      ): Promise<T> => {
        await waitForGoogleSlidesReady();
        if (input.signal.aborted) {
          throw new runtime.ExportCancelledError();
        }
        input.signal.addEventListener("abort", options);
        try {
          return await context();
        } finally {
          input.signal.removeEventListener("abort", options);
        }
      },
      createExportProducer =
        (input: ExportFileFormat, options: string, context: ExportRenderer) =>
        async (input2: ExportProduceOptions): Promise<ExportedFile> => {
          let value: PdfExportOptions | undefined;
          if (input === "pdf" && extraExportFormats && input2.interactive) {
            value =
              (await askInteractivePdfOptions(
                input2,
                runtime.dismissPdfExportOptions,
                askPdfOptions,
              )) ?? undefined;
            if (value === undefined) {
              throw new runtime.ExportCancelledError();
            }
          } else if (
            exportFormatSupportsNotes(input) &&
            resolvedAwaitingSlides
          ) {
            if (input2.interactive) {
              if (
                !(await askInteractivePdfOptions(
                  input2,
                  runtime.dismissEditorDialog,
                  () => confirmCompleteDeckExport("Download"),
                ))
              ) {
                throw new runtime.ExportCancelledError();
              }
            } else {
              (0, runtime.showToast)(
                formatPresentationBuildProgress(
                  slides.length,
                  slides.length + resolvedAwaitedSlideCount,
                ) +
                  "; exporting only " +
                  (presentableSlides.length === 1
                    ? "that one"
                    : "those " + String(presentableSlides.length)) +
                  ".",
              );
            }
          }
          let value2 = input2.interactive
              ? (0, runtime.showToast)("Exporting…", 0)
              : undefined,
            value3 = extraExportFormats ? input2.signal : undefined,
            value4: ExportRender;
          try {
            value4 = await context(value, value3);
          } catch (value5: unknown) {
            if (value3?.aborted === true) {
              throw new runtime.ExportCancelledError();
            }
            (0, runtime.showToast)(
              options +
                " export failed: " +
                (value5 instanceof Error ? value5.message : String(value5)),
            );
            throw value5;
          } finally {
            if (value2 !== undefined) {
              (0, runtime.closeToast)(value2);
            }
          }
          if (value3?.aborted === true) {
            throw new runtime.ExportCancelledError();
          }
          exportWarningsRef.current[input] = value4.warnings;
          return {
            filename: value4.filename,
            data: value4.blob,
          };
        },
      prepareExportWithNotesOption =
        (input: (choices: PdfExportOptions | undefined) => Promise<TieredExportRender>) =>
        async (input2: PdfExportOptions | undefined, options: AbortSignal | undefined): Promise<ExportRender> => {
          let value = Date.now() + GOOGLE_SLIDES_BUILD_TIMEOUT_MS,
            value2 = await input(input2);
          if (input2 === undefined) {
            return renderWithImageBudget(
              value2,
              runtime.MAX_SHELL_DOWNLOAD_BYTES,
              value,
              options,
            );
          } else {
            return renderWithImageBudget(
              {
                ...pdfQualityRenderOptions(value2, input2.quality),
                reducedNote: () => BROWSER_EXPORT_IMAGE_REDUCTION_NOTE,
              },
              MAX_BROWSER_EXPORT_BYTES,
              value,
              options,
            );
          }
        },
      exportStateRef = runtime.reactd0.useRef({
        presentable: presentableSlides,
        exporting: exporting,
        renderPptxFile: renderPptxFile,
        preparePdfRender: preparePdfRender,
        preparePptxPicturesRender: preparePptxPicturesRender,
        renderHtmlFile: renderHtmlFile,
        exportPptx: exportPptx,
      });
    exportStateRef.current = {
      presentable: presentableSlides,
      exporting: exporting,
      renderPptxFile: renderPptxFile,
      preparePdfRender: preparePdfRender,
      preparePptxPicturesRender: preparePptxPicturesRender,
      renderHtmlFile: renderHtmlFile,
      exportPptx: exportPptx,
    };
    let exportEntries = (
      extraExportFormats
        ? [
            {
              format: "pdf",
              interactive: true,
              produce: createExportProducer(
                "pdf",
                "PDF",
                prepareExportWithNotesOption(
                  (input) =>
                    exportStateRef.current.preparePdfRender(
                      input?.notes === true,
                    ),
                ),
              ),
            },
            {
              format: "pptx",
              variant: "current",
              produce: createExportProducer(
                "pptx",
                "PPTX",
                () => exportStateRef.current.renderPptxFile("current"),
              ),
            },
            {
              format: "pptx",
              variant: "basic",
              produce: createExportProducer(
                "pptx",
                "PPTX",
                () => exportStateRef.current.renderPptxFile("basic"),
              ),
            },
            {
              format: "pptx",
              variant: "pictures",
              produce: createExportProducer(
                "pptx",
                "PPTX",
                prepareExportWithNotesOption(
                  () =>
                    exportStateRef.current.preparePptxPicturesRender(),
                ),
              ),
            },
            {
              format: "png",
              available: getSlideToExport() !== undefined,
              produce: createExportProducer(
                "png",
                "PNG",
                prepareExportWithNotesOption(renderPngFile),
              ),
            },
            {
              format: "html",
              produce: createExportProducer(
                "html",
                "Web page",
                () =>
                  exportStateRef.current.renderHtmlFile({
                    fit: true,
                    deadline: Date.now() + GOOGLE_SLIDES_BUILD_TIMEOUT_MS,
                  }),
              ),
            },
          ]
        : [
            {
              format: "html",
              produce: createExportProducer(
                "html",
                "Web page",
                () =>
                  exportStateRef.current.renderHtmlFile({
                    fit: true,
                    deadline: Date.now() + GOOGLE_SLIDES_BUILD_TIMEOUT_MS,
                  }),
              ),
            },
            {
              format: "pdf",
              produce: createExportProducer(
                "pdf",
                "PDF",
                prepareExportWithNotesOption(
                  (input) =>
                    exportStateRef.current.preparePdfRender(
                      input?.notes === true,
                    ),
                ),
              ),
            },
            {
              format: "pptx",
              produce: createExportProducer(
                "pptx",
                "PPTX",
                () => exportStateRef.current.renderPptxFile("current"),
              ),
            },
          ]
    ).map(
      ({
        available = presentableSlides.length > 0,
        ...props
      }: ExportEntrySpec) => ({
        ...props,
        disabled: !available || exporting,
        ...(exportFormatSupportsNotes(props.format) && resolvedAwaitingSlides
          ? {
              interactive: true,
            }
          : {}),
        releaseRequestAfterMs: runtime.MAX_EXPORT_INLINE_CHARS,
      }),
    );
    (0, runtime.useExportEntries)(
      downloadsWithheld2 === true ? null : exportEntries,
      {
        onResult: (input: ExportResult) => {
          let value = EXPORT_FORMAT_MIME_AND_EXTENSION[input.format];
          if (input.late) {
            if (!value) {
              return;
            }
            let { saved: late, file: late2 } = input.late;
            deliverExportFile(
              late,
              late2.data instanceof Blob
                ? late2.data
                : new Blob([new Uint8Array(late2.data)]),
              late2.filename,
              ...value,
            );
          }
          if (input.outcome !== "delivered") {
            return;
          }
          showExportNotes(exportWarningsRef.current[input.format] ?? []);
        },
      },
    );
    let speakerNotesAvailable = (0, runtime.slidesHaveSpeakerNotes)(
        presentableSlides,
      ),
      presentationButtonLabel = (0, runtime.fullscreenAvailable)()
        ? "Present full screen"
        : "Present",
      startPresentation = (input: boolean) => {
        if (presentationStartIndex !== null) {
          return;
        }
        let index = 0;
        for (
          let index2 = 0;
          index2 < slides.length && index2 < currentSlideIndex;
          index2++
        ) {
          let value2 = slides[index2];
          if (value2 && value2.skipped !== true) {
            index++;
          }
        }
        let flag = false,
          flag2 = false;
        if (input && speakerNotesSession === null) {
          let value2 = touchLayout
            ? null
            : (0, runtime.openSpeakerNotes)();
          flag2 = value2?.kind === "opened";
          flag = !flag2;
          if (value2 !== null && !flag2) {
            (0, runtime.showToast)(SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE);
          }
        }
        let value =
          flag2 || navigator.userActivation?.isActive === false;
        setDockSpeakerNotes(flag);
        setFullscreenRequest(
          value ? "next" : (0, runtime.requestPresentationFullscreen)(),
        );
        presentingRef.current = true;
        setPresentationStartIndex(
          Math.max(0, Math.min(index, presentableSlides.length - 1)),
        );
      },
      presentationDisabledReason =
        presentableSlides.length === 0
          ? "Every slide is skipped — unskip one to present"
          : null,
      toolbarMenus = SlidesAppJsx.jsx("span", {
        "data-slides-present-entry": "",
        className: "contents",
        children: touchLayout
          ? SlidesAppJsx.jsx(runtime.ToolbarButton, {
              iconOnly: true,
              icon: "Play",
              label: "Present",
              tip:
                presentationDisabledReason ??
                presentationButtonLabel +
                  " from the current slide" +
                  (speakerNotesAvailable ? ", speaker notes below it" : ""),
              disabled: presentableSlides.length === 0,
              onClick: () => startPresentation(speakerNotesAvailable),
            })
          : SlidesAppJsx.jsxs(runtime.ToolbarPopover, {
              iconOnly: true,
              icon: "Play",
              label: "Present",
              tip:
                presentationDisabledReason ?? "Present from the current slide",
              disabled:
                presentableSlides.length === 0 ||
                presentationStartIndex !== null,
              children: [
                SlidesAppJsx.jsx(runtime.Menu.Item, {
                  icon: "Play",
                  onClick: () => startPresentation(false),
                  children: "Present",
                }),
                SlidesAppJsx.jsx(runtime.Menu.Item, {
                  icon: "BookText",
                  disabled:
                    !speakerNotesAvailable && speakerNotesSession === null,
                  disabledReason:
                    speakerNotesAvailable || speakerNotesSession !== null
                      ? null
                      : "No speaker notes in this presentation yet—add them under a slide (Speaker notes, by the thumbnails)",
                  onClick: () => startPresentation(true),
                  children: "Present with speaker notes",
                }),
              ],
            }),
      }),
      slideActions = {
        onAdd: openTemplatePicker,
        onDuplicate: (input: SlideId) => duplicateSlide(input),
        onCopy: (input: SlideId) => {
          let value = slides.find(
            (input2) => input2.id === input,
          );
          if (!value) {
            return;
          }
          (0, runtime.showToast)(
            (0, runtime.copyArtifactToClipboard)(runtime.SLIDE_CLIPBOARD_TYPE, {
              data: (0, runtime.createSlideClipboardPayload)(
                value,
                snapshot.assets,
              ),
              text: (0, runtime.slideClipboardText)(value),
            })
              ? "Slide copied"
              : "Couldn't copy the slide",
          );
        },
        onDelete: (input: SlideId) => void deleteSlide(input),
        onMove: moveSlide,
        onToggleSkip: toggleSlideSkipped,
        ...(host === undefined
          ? {
              onSetCover: setCoverSlide,
              coverId: snapshot.cover,
            }
          : {}),
        heldSlide: slideHtmlHold2,
      },
      stageCanShowSlide = !gridOpen && currentSlide === undefined,
      creationFitsEmptyStage =
        creationOnEmptyDeck && creationView.greySlide,
      showSlideContent =
        !creationView.greySlide || creationView.fromEmptyDeck;
    runtime.reactd0.useLayoutEffect(() => {
      let value = !stageCanShowSlide
        ? undefined
        : creationFitsEmptyStage
          ? getFittedSlideScale()
          : 1;
      if (value !== undefined) {
        setToolbarScale(value);
      }
    }, [
      stageCanShowSlide,
      creationFitsEmptyStage,
      getFittedSlideScale,
      setToolbarScale,
    ]);
    let fitViewLabel =
        gridOpen || editingGridSlide ? "Fit all slides" : "Fit the slide",
      toolbarTrailing = SlidesAppJsx.jsx("span", {
        "data-slides-zoom": "",
        className: "contents",
        children: SlidesAppJsx.jsx(
          runtime.ZoomControl,
          {
            readout: true,
            subscribeScale: gridOpen
              ? subscribeGridScale
              : subscribeEditorScale,
            getScale: () =>
              (gridOpen
                ? gridZoomApiRef.current?.getScale()
                : (editorZoomApiRef.current?.getScale() ??
                  (creationFitsEmptyStage
                    ? getFittedSlideScale()
                    : undefined))) ?? 1,
            getLimits: () =>
              gridOpen
                ? {
                    ...gridZoomApiRef.current?.getLimits(),
                    minTip: "Every slide is already in view",
                  }
                : {
                    ...editorZoomApiRef.current?.getLimits(),
                    minTip: editingGridSlide
                      ? "That's as far out as the Canvas view goes"
                      : "Smaller than the slide fits — that's as far out as it goes",
                  },
            onPickScale: (input: number) =>
              gridOpen
                ? gridZoomApiRef.current?.setScaleTo(input)
                : editorZoomApiRef.current?.setScaleTo(input),
            onFit: () =>
              gridOpen
                ? gridZoomApiRef.current?.fitAll()
                : editorZoomApiRef.current?.returnToFit(),
            onStepZoom: (input: number) =>
              (gridOpen
                ? gridZoomApiRef.current
                : editorZoomApiRef.current
              )?.stepZoom(input === 1 ? 1.25 : 0.8),
            undo: readOnly ? undefined : undoHistory,
            zoomRowsDisabled: stageCanShowSlide,
            zoomRowsDisabledTip: "No slide to zoom",
            fitLabel: fitViewLabel,
            tip:
              (gridOpen ? "Zoom the Canvas view (" : "Zoom (") +
              ZOOM_KEYBOARD_SHORTCUT_LABEL +
              ")",
          },
          gridOpen ? "grid" : "slide",
        ),
      }),
      insertActionTip = (
        input: string,
        options: string,
      ) =>
        gridOpen && !singleSelectedGridSlide
          ? gridSelection.slides.length === 0
            ? "Select a slide to insert onto it"
            : "Select one slide to insert onto it"
          : currentSlideReadOnly
            ? "This slide can’t be edited until its saved content is fixed, so inserting is paused"
            : gridOpen
              ? options
              : input,
      insertMenuDisabled =
        (gridOpen && !singleSelectedGridSlide) || currentSlideReadOnly;
    runtime.reactd0.useEffect(() => {
      if (insertMenuDisabled || modalOpen) {
        setInsertMenuOpen(false);
      }
    }, [insertMenuDisabled, modalOpen]);
    let shapeInsertMenuItem = (input: string) =>
        SlidesAppJsx.jsx(
          runtime.ToolbarMenuItem,
          {
            glyph: SlidesAppJsx.jsx(runtime.ShapeIcon, {
              shape: input,
              size: "100%",
            }),
            label: runtime.shapeVariantLabels[input],
            shortcut: gridOpen ? undefined : getShapeInsertShortcut(input),
            title: gridOpen
              ? "Click to insert on the selected slide"
              : "Click to insert, or drag onto the slide",
            draggable: !gridOpen,
            onDragStart: (input2: ReactDragEvent) =>
              input2.dataTransfer.setData(
                "application/x-slides-insert",
                "shape:" + input,
              ),
            onClick: (input2: ActivationEvent) => {
              setInsertMenuOpen(false);
              insertShape(input, {
                byKey: (0, runtime.isKeyboardOrPrimaryActivation)(input2),
              });
            },
          },
          input,
        ),
      toolbarExtras = SlidesAppJsx.jsx(SlidesAppJsx.Fragment, {
        children: SlidesAppJsx.jsx(runtime.ToolbarWhenVisible, {
          children: modalOpen
            ? SlidesAppJsx.jsxs(runtime.ToolbarPopover, {
                iconOnly: true,
                caret: true,
                icon: "Add",
                label: "Insert",
                tip: insertActionTip(
                  "Insert text, an image or video, a table, a shape or a line",
                  "Insert onto the selected slide",
                ),
                disabled: insertMenuDisabled,
                children: [
                  SlidesAppJsx.jsx(runtime.Menu.Item, {
                    icon: runtime.textFindResultIcon,
                    onClick: () => insertText(),
                    children: "Text",
                  }),
                  SlidesAppJsx.jsx(runtime.Menu.Item, {
                    icon: "Image",
                    onClick: (input: ActivationEvent) =>
                      clickUploadInput(
                        (0, runtime.isKeyboardOrPrimaryActivation)(input),
                      ),
                    children: "Image or video…",
                  }),
                  videoLinksEnabled
                    ? SlidesAppJsx.jsx(runtime.Menu.Item, {
                        icon: "Upload",
                        onClick: (input: ActivationEvent) =>
                          clickUploadInput(
                            (0, runtime.isKeyboardOrPrimaryActivation)(input),
                            videoUploadInputRef,
                          ),
                        children: "Upload video…",
                      })
                    : null,
                  videoLinksEnabled
                    ? SlidesAppJsx.jsx(runtime.Menu.Item, {
                        icon: "Recording",
                        onClick: (input: ActivationEvent) =>
                          void askYoutubeUrl(
                            (0, runtime.isKeyboardOrPrimaryActivation)(input),
                          ),
                        children: "Embed YouTube…",
                      })
                    : null,
                  SlidesAppJsx.jsx(runtime.Menu.Item, {
                    icon: "Table",
                    onClick: (input: ActivationEvent) =>
                      insertTable({
                        byKey: (0, runtime.isKeyboardOrPrimaryActivation)(
                          input,
                        ),
                      }),
                    children: "Table",
                  }),
                  SlidesAppJsx.jsx(runtime.Menu.Separator, {}),
                  QUICK_INSERT_SHAPES.map(
                    (input) =>
                      SlidesAppJsx.jsx(
                        runtime.Menu.Item,
                        {
                          icon: SlidesAppJsx.jsx(runtime.ShapeIcon, {
                            shape: input,
                            size: 20,
                          }),
                          onClick: (input2: ActivationEvent) =>
                            insertShape(input, {
                              byKey: (0, runtime.isKeyboardOrPrimaryActivation)(
                                input2,
                              ),
                            }),
                          children: runtime.shapeVariantLabels[input],
                        },
                        input,
                      ),
                  ),
                  SlidesAppJsx.jsx(runtime.Menu.Separator, {}),
                  QUICK_INSERT_LINE_SHAPES.map(
                    (input) =>
                      SlidesAppJsx.jsx(
                        runtime.Menu.Item,
                        {
                          icon: SlidesAppJsx.jsx(runtime.ShapeIcon, {
                            shape: input,
                            size: 20,
                          }),
                          onClick: (input2: ActivationEvent) =>
                            insertShape(input, {
                              byKey: (0, runtime.isKeyboardOrPrimaryActivation)(
                                input2,
                              ),
                            }),
                          children: runtime.shapeVariantLabels[input],
                        },
                        input,
                      ),
                  ),
                ],
              })
            : SlidesAppJsx.jsxs(SlidesAppJsx.Fragment, {
                children: [
                  SlidesAppJsx.jsx(runtime.ToolbarButton, {
                    iconOnly: true,
                    glyph: runtime.textFindResultIcon,
                    label: "Text",
                    shortcut: gridOpen ? undefined : TEXT_INSERT_SHORTCUT_KEY,
                    tip: insertActionTip(
                      "Add a text box — click, or drag onto the slide",
                      "Add a text box on the selected slide",
                    ),
                    disabled: insertMenuDisabled,
                    draggable: !insertMenuDisabled && !gridOpen,
                    onDragStart: (input: ReactDragEvent) =>
                      input.dataTransfer.setData(
                        "application/x-slides-insert",
                        "text",
                      ),
                    onClick: () => insertText(),
                  }),
                  SlidesAppJsx.jsx(runtime.ToolbarButton, {
                    iconOnly: true,
                    icon: "Image",
                    label: "Image or video",
                    tip: insertActionTip(
                      "Insert an image or video…",
                      "Insert an image or video on the selected slide…",
                    ),
                    disabled: insertMenuDisabled,
                    onClick: (input: ActivationEvent) =>
                      clickUploadInput(
                        (0, runtime.isKeyboardOrPrimaryActivation)(input),
                      ),
                  }),
                  videoLinksEnabled
                    ? SlidesAppJsx.jsxs(runtime.ToolbarPopover, {
                        iconOnly: true,
                        icon: "Recording",
                        label: "Video",
                        tip: insertActionTip(
                          "Insert a video…",
                          "Insert a video on the selected slide…",
                        ),
                        disabled: insertMenuDisabled,
                        "data-testid": "insert-video",
                        children: [
                          SlidesAppJsx.jsx(runtime.Menu.Item, {
                            icon: "Upload",
                            onClick: (input: ActivationEvent) =>
                              clickUploadInput(
                                (0, runtime.isKeyboardOrPrimaryActivation)(
                                  input,
                                ),
                                videoUploadInputRef,
                              ),
                            children: "Upload video…",
                          }),
                          SlidesAppJsx.jsx(runtime.Menu.Item, {
                            icon: "Recording",
                            onClick: (input: ActivationEvent) =>
                              void askYoutubeUrl(
                                (0, runtime.isKeyboardOrPrimaryActivation)(
                                  input,
                                ),
                              ),
                            children: "Embed YouTube…",
                          }),
                        ],
                      })
                    : null,
                  SlidesAppJsx.jsx(runtime.ToolbarButton, {
                    iconOnly: true,
                    icon: "Table",
                    label: "Table",
                    tip: insertActionTip(
                      "Insert a table — click, or drag onto the slide",
                      "Insert a table on the selected slide",
                    ),
                    disabled: insertMenuDisabled,
                    draggable: !insertMenuDisabled && !gridOpen,
                    onDragStart: (input: ReactDragEvent) =>
                      input.dataTransfer.setData(
                        "application/x-slides-insert",
                        "table",
                      ),
                    onClick: (input: ActivationEvent) =>
                      insertTable({
                        byKey: (0, runtime.isKeyboardOrPrimaryActivation)(
                          input,
                        ),
                      }),
                  }),
                  SlidesAppJsx.jsx("span", {
                    className: "relative",
                    children: SlidesAppJsx.jsxs(runtime.PropertyPopup, {
                      open: insertMenuOpen,
                      onOpen: () => setInsertMenuOpen(true),
                      onClose: () => setInsertMenuOpen(false),
                      trigger: SlidesAppJsx.jsx(runtime.ToolbarButton, {
                        iconOnly: true,
                        caret: true,
                        icon: "Shapes",
                        label: "Shapes",
                        tip: insertActionTip(
                          "Insert a shape, line, or connector — click a row, or drag it onto the slide",
                          "Insert a shape, line, or connector on the selected slide",
                        ),
                        disabled: insertMenuDisabled,
                        onClick: (input: ActivationEvent) =>
                          setFocusInsertMenuOnOpen(
                            (0, runtime.isKeyboardOrPrimaryActivation)(input),
                          ),
                      }),
                      align: "left",
                      "aria-label": "Shapes",
                      className: "min-w-32! p-1",
                      focusOnOpen: focusInsertMenuOnOpen,
                      children: [
                        QUICK_INSERT_SHAPES.map(shapeInsertMenuItem),
                        SlidesAppJsx.jsx("div", {
                          "aria-hidden": "true",
                          className: "mx-2 my-1 h-px bg-border-line",
                        }),
                        QUICK_INSERT_LINE_SHAPES.map(shapeInsertMenuItem),
                      ],
                    }),
                  }),
                ],
              }),
        }),
      }),
      pdfExportDisabled =
        extraExportFormats && presentableSlides.length === 0,
      toolbarExtrasEnd = SlidesAppJsx.jsxs(SlidesAppJsx.Fragment, {
        children: [
          SlidesAppJsx.jsxs(runtime.ToolbarPopover, {
            iconOnly: true,
            icon: "Download",
            label: exporting ? "Exporting…" : "Download",
            tip: downloadsWithheld2
              ? runtime.DOWNLOADS_UNAVAILABLE_MESSAGE
              : exporting
                ? "Exporting…"
                : !extraExportFormats
                  ? presentableSlides.length === 0
                    ? "Every slide is skipped — unskip one to export"
                    : "Download the presentation as a PDF, a web page or a PowerPoint file (skipped slides stay out)"
                  : getSlideToExport() === undefined
                    ? "Nothing to export yet"
                    : "Download the presentation as a PDF, a web page or a PowerPoint file (skipped slides stay out), or this slide as an image",
            disabled:
              downloadsWithheld2 ||
              (extraExportFormats
                ? getSlideToExport() === undefined
                : presentableSlides.length === 0) ||
              exporting,
            children: [
              SlidesAppJsx.jsx(runtime.Menu.Item, {
                disabled: pdfExportDisabled,
                disabledReason: ALL_SLIDES_SKIPPED_EXPORT_MESSAGE,
                onClick: () => void downloadPdf(),
                children: "PDF (.pdf)",
              }),
              SlidesAppJsx.jsx(runtime.Menu.Item, {
                disabled: pdfExportDisabled,
                disabledReason: ALL_SLIDES_SKIPPED_EXPORT_MESSAGE,
                onClick: () => void downloadHtml(),
                children: "Web page (.html)",
              }),
              extraExportFormats
                ? SlidesAppJsx.jsx(runtime.Menu.Item, {
                    onClick: () => void downloadPng(),
                    children: "Current slide as an image (.png)",
                  })
                : null,
              SlidesAppJsx.jsx(runtime.Menu.Separator, {}),
              SlidesAppJsx.jsxs(runtime.Menu.Group, {
                children: [
                  SlidesAppJsx.jsx(runtime.Menu.Item, {
                    disabled: pdfExportDisabled,
                    disabledReason: ALL_SLIDES_SKIPPED_EXPORT_MESSAGE,
                    onClick: () => void exportPptx("current"),
                    children: "PowerPoint, current fonts (.pptx)",
                  }),
                  SlidesAppJsx.jsx(runtime.Menu.Item, {
                    disabled: pdfExportDisabled,
                    disabledReason: ALL_SLIDES_SKIPPED_EXPORT_MESSAGE,
                    onClick: () => void exportPptx("basic"),
                    children: "PowerPoint, basic fonts (.pptx)",
                  }),
                  SlidesAppJsx.jsx(runtime.Menu.GroupLabel, {
                    children: "Basic fonts work on any computer",
                  }),
                ],
              }),
            ],
          }),
          toolbarMenus,
          SlidesAppJsx.jsx(runtime.ToolbarWhenVisible, {
            children: SlidesAppJsx.jsx(runtime.ArtifactToolbarDivider, {}),
          }),
          SlidesAppJsx.jsx(runtime.ToolbarWhenVisible, {
            children: SlidesAppJsx.jsx(runtime.ToolbarButton, {
              iconOnly: true,
              glyph: SlidesAppJsx.jsx(runtime.Icon, {
                name: "SidebarRight",
                size: "auto",
                className: "max-md:rotate-90",
              }),
              label: "Properties",
              tip: gridOpen
                ? "Open a slide to edit its properties"
                : inspectorOpen
                  ? "Hide the properties panel"
                  : "Show the properties panel",
              disabled: gridOpen,
              pressed: inspectorOpen && !gridOpen,
              ref: inspectorReturnFocusRef,
              onClick: (input: ActivationEvent) => {
                inspectorPointerInvocationRef.current = (0,
                runtime.isKeyboardOrPrimaryActivation)(input);
                setInspectorOpen((input2) => !input2);
              },
            }),
          }),
        ],
      });
    return SlidesAppJsx.jsxs(runtime.ArtifactShell, {
      doc: documentStore.doc,
      undo: undoHistory,
      undoShortcuts: presentationStartIndex === null && !readOnly,
      toolbarExtras: toolbarExtras,
      toolbarExtrasEnd: toolbarExtrasEnd,
      toolbarTrailing: toolbarTrailing,
      toolbarUndoButtons: false,
      toolbarTouchTargets: "square",
      toolbarVariant: host ? "docked" : "floating",
      alwaysShowExtras: true,
      skeleton: SlidesAppJsx.jsx(SlidesAppLoadingSkeleton, {
        doc: documentStore.doc,
        railOpen: railOpen,
      }),
      skeletonFlush: true,
      leading: host?.leading,
      aboveContent: host?.aboveContent,
      children: [
        SlidesAppJsx.jsx("style", {
          children: runtime.SLIDES_PRINT_STYLES,
        }),
        fontCss !== ""
          ? SlidesAppJsx.jsx("style", {
              children: fontCss,
            })
          : null,
        SlidesAppJsx.jsx("span", {
          ref: railLayout.groundProbe,
          "aria-hidden": true,
          className: "hidden bg-editor-canvas",
        }),
        SlidesAppJsx.jsx("input", {
          ref: imageUploadInputRef,
          type: "file",
          accept: "image/*," + runtime.videoFileAccept,
          className: "hidden",
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            let value = event.target.files?.[0];
            if (value) {
              insertImageFromInput(value, {
                byKey: uploadInvocationRef.current,
              });
            }
            event.target.value = "";
          },
        }),
        SlidesAppJsx.jsx("input", {
          ref: videoUploadInputRef,
          type: "file",
          accept: runtime.videoFileAccept,
          className: "hidden",
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            let value = event.target.files?.[0];
            if (value) {
              insertImageFromInput(value, {
                byKey: uploadInvocationRef.current,
              });
            }
            event.target.value = "";
          },
        }),
        SlidesAppJsx.jsxs("div", {
          className: "flex h-full min-h-0 flex-col",
          children: [
            SlidesAppJsx.jsxs("div", {
              className: "relative min-h-0 flex-1",
              onPointerMove: (input: ReactPointerEvent) => {
                lastGridPointerRef.current =
                  (gridOpen || editingGridSlide) &&
                  input.pointerType !== "touch"
                    ? {
                        clientX: input.clientX,
                        clientY: input.clientY,
                        at: Date.now(),
                      }
                    : null;
                publishGridPointer(input);
              },
              onWheel: (input: ReactWheelEvent) => {
                if (gridOpen || editingGridSlide) {
                  lastGridPointerRef.current = {
                    clientX: input.clientX,
                    clientY: input.clientY,
                    at: Date.now(),
                  };
                }
              },
              onPointerLeave: (input: ReactPointerEvent) => {
                lastGridPointerRef.current = null;
                if (
                  (gridOpen || editingGridSlide) &&
                  input.pointerType !== "touch"
                ) {
                  cursorPublisherRef.current?.clear();
                }
              },
              onPointerDownCapture: (event: ReactPointerEvent) => {
                if (
                  creationView.sheet !== "none" &&
                  currentSlide !== undefined &&
                  isCanvasEditorFocusTarget(event.target)
                ) {
                  creationController.stageTouched();
                }
              },
              onKeyDownCapture: (event: ReactKeyboardEvent) => {
                if (
                  creationView.sheet !== "none" &&
                  currentSlide !== undefined &&
                  isCanvasEditorFocusTarget(event.target)
                ) {
                  creationController.stageTouched();
                }
              },
              onFocusCapture: (event: ReactFocusEvent) => {
                if (
                  creationView.sheet !== "none" &&
                  currentSlide !== undefined &&
                  isCanvasEditorFocusTarget(event.target)
                ) {
                  creationController.stageTouched();
                }
              },
              children: [
                SlidesAppJsx.jsx(runtime.FindBar, {
                  ...findController.bar,
                }),
                showCommentTargets
                  ? SlidesAppJsx.jsx("div", {
                      className: (0, runtime.joinClassNames)(
                        "absolute inset-0",
                        gridLeaving ? "z-20" : gridOpen ? "z-10" : "z-0",
                      ),
                      "data-slides-grid-leaving": gridLeaving ? "" : undefined,
                      children: SlidesAppJsx.jsxs("div", {
                        className: (0, runtime.joinClassNames)(
                          "flex h-full flex-col",
                          gridLeaving && "pointer-events-none",
                        ),
                        children: [
                          SlidesAppJsx.jsx("div", {
                            ref: registerGridElementAndRail,
                            className: "min-h-0 flex-1",
                            "aria-busy":
                              presentationBusy && gridOpen ? true : undefined,
                            children: SlidesAppJsx.jsx(
                              runtime.SlideGrid,
                              {
                                topInset: gridTopInset,
                                order: snapshot.meta.order,
                                sections: snapshot.sections,
                                slides: railSlides,
                                assets: snapshot.assets,
                                currentId: currentSlide?.id ?? null,
                                readOnly: readOnly,
                                zoomApiRef: gridZoomApiRef,
                                onScaleChange: onGridScaleChange,
                                enterFrom: gridEnterFromRectRef.current,
                                inert:
                                  editingGridSlide ||
                                  (gridLeaving &&
                                    wasEditingWhenGridLeftRef.current),
                                behind:
                                  editingGridSlide && currentSlide
                                    ? currentSlide.id
                                    : null,
                                onSelectionChange:
                                  gridOpen && !gridLeaving
                                    ? setGridSelection
                                    : undefined,
                                notesShown: notesOpen,
                                commentCounts: openCommentCounts,
                                commenting: commentMode && gridOpen,
                                commentLayer:
                                  !gridOpen || !commentMode
                                    ? undefined
                                    : (input: RefObject<HTMLDivElement | null>) =>
                                        SlidesAppJsx.jsx(
                                          runtime.SlideGridCommentLayer,
                                          {
                                            ...commentController,
                                            slides: slides,
                                            typeStyles: allTypeStyles,
                                            containerRef: input,
                                            currentId: currentSlide?.id ?? null,
                                            keepsMode: commentModePersistent,
                                            topInset: gridTopInset,
                                            showSlide: showCommentSlide,
                                            settling: commentViewSettling,
                                            reveal: commentViewReveal,
                                            onRevealed: () =>
                                              setCommentViewReveal(null),
                                          },
                                        ),
                                peerLayer: touchLayout
                                  ? undefined
                                  : (
                                      input: number,
                                      options: SlideGridTile[],
                                    ) =>
                                      SlidesAppJsx.jsx(
                                        runtime.GridPeerCursorLayers,
                                        {
                                          tiles: options,
                                          surfaceOf: scopedSlideKey,
                                          glyphScale: input,
                                        },
                                      ),
                                onCameraChange:
                                  republishGridPointerOnCameraChange,
                                onSelect: (input: SlideId) => {
                                  setCurrentSlideId(input);
                                  setSelection([]);
                                  setTextEditState(null);
                                },
                                onOpen: handleGridOpenSlide,
                                onClose: closeGridFromButton,
                                onMoveSlidesTo: (
                                  items: SlideId[],
                                  options: string | null,
                                  context: number,
                                ) => {
                                  commitStructuralChange(
                                    items.length > 1
                                      ? "move slides"
                                      : "move slide",
                                    (input) =>
                                      (0, runtime.moveSlidesToSection)(
                                        input,
                                        items,
                                        options,
                                        context,
                                      ),
                                  );
                                },
                                ...slideActions,
                                onStartSectionWithSlides: (
                                  input: SlideId[],
                                  options: number,
                                ) => {
                                  commitStructuralChange(
                                    "new section",
                                    (input2) =>
                                      (0, runtime.moveSlidesIntoNewSection)(
                                        input2,
                                        input,
                                        options,
                                      ),
                                  );
                                },
                                onMoveSections: (
                                  items: string[],
                                  options: number,
                                ) => {
                                  commitStructuralChange(
                                    items.length > 1
                                      ? "move sections"
                                      : "move section",
                                    (input) =>
                                      (0, runtime.moveSectionsToGap)(
                                        input,
                                        items,
                                        options,
                                      ),
                                  );
                                },
                                onDeleteSlides: (input: SlideId[]) =>
                                  void deleteSlides(input),
                                onDuplicateSlides: duplicateSlides,
                                onCopySlides: (input: SlideId[]) => {
                                  let value = slides.filter(
                                    (input2) =>
                                      input.includes(input2.id),
                                  );
                                  if (value.length === 0) {
                                    return;
                                  }
                                  let value2 = (0,
                                  runtime.copyArtifactToClipboard)(
                                    runtime.SLIDE_CLIPBOARD_TYPE,
                                    {
                                      data: (0,
                                      runtime.createSlidesClipboardPayload)(
                                        value,
                                        snapshot.assets,
                                      ),
                                      text: (0, runtime.slidesClipboardText)(
                                        value,
                                      ),
                                    },
                                  );
                                  (0, runtime.showToast)(
                                    value2
                                      ? value.length > 1
                                        ? String(value.length) +
                                          " slides copied"
                                        : "Slide copied"
                                      : "Couldn't copy the slides",
                                  );
                                },
                                onSetSlidesSkipped: setSlidesSkipped,
                                onSectionFromSlides: (
                                  input: SlideId[],
                                ) =>
                                  void commitStructuralChange(
                                    "new section",
                                    (input2) =>
                                      (0, runtime.createSectionFromSlides)(
                                        input2,
                                        input,
                                      ),
                                  ),
                                onSetSectionDescription: (
                                  input: string | null,
                                  options: string,
                                ) =>
                                  void commitStructuralChange(
                                    "describe section",
                                    (input2) =>
                                      input === null
                                        ? input2.order[0] !== undefined
                                          ? (0, runtime.addSectionAtSlide)(
                                              input2,
                                              input2.order[0],
                                              options,
                                            )
                                          : undefined
                                        : (0, runtime.renameSection)(
                                            input2,
                                            input,
                                            options,
                                          ),
                                  ),
                                onRemoveSection: (input: string) =>
                                  void commitStructuralChange(
                                    "remove section",
                                    (input2) =>
                                      (0, runtime.deleteSection)(input2, input),
                                  ),
                                onAddSection: (input: string) =>
                                  void commitStructuralChange(
                                    "new section",
                                    (input2) =>
                                      (0, runtime.appendEmptySection)(
                                        input2,
                                        input,
                                      ),
                                  ),
                              },
                              gridMountGeneration,
                            ),
                          }),
                          gridLeaving
                            ? SlidesAppJsx.jsx("aside", {
                                inert: true,
                                "aria-hidden": true,
                                className:
                                  "shrink-0 border-t border-border-line bg-panel pb-[var(--sl-safe-b,0px)]",
                                children: SlidesAppJsx.jsx(
                                  runtime.SlideRailToolbar,
                                  {
                                    readOnly: readOnly,
                                    onAdd: slideActions.onAdd,
                                    notesOpen: notesOpen,
                                    onToggleNotes: () => {},
                                    ...(wasEditingWhenGridLeftRef.current
                                      ? {}
                                      : {
                                          notesDisabledReason: (0,
                                          runtime.slidesHaveSpeakerNotes)(
                                            slides,
                                          )
                                            ? undefined
                                            : readOnly
                                              ? "No speaker notes in this presentation"
                                              : "No speaker notes yet — open a slide to add some",
                                        }),
                                    gridOpen: false,
                                    onSetGridOpen: () => {},
                                    onCollapse: () => {},
                                    collapseDisabledReason:
                                      "Canvas view is showing, so there is no thumbnail strip to hide",
                                  },
                                ),
                              })
                            : null,
                        ],
                      }),
                    })
                  : null,
                gridOpen
                  ? presentationStartIndex !== null
                    ? SlidesAppJsx.jsx("div", {
                        className: "h-full bg-editor-canvas",
                      })
                    : null
                  : SlidesAppJsx.jsx("div", {
                      className: "relative z-10 h-full min-h-0",
                      children:
                        !currentSlide &&
                        (documentStore.bootReport.htmlErrors ?? 0) > 0
                          ? SlidesAppJsx.jsxs("div", {
                              className:
                                "flex h-full flex-col items-center justify-center gap-3 bg-editor-canvas p-6 text-center",
                              children: [
                                SlidesAppJsx.jsx("p", {
                                  className: "text-sm text-fg-secondary",
                                  children:
                                    "This presentation’s HTML couldn’t be read.",
                                }),
                                SlidesAppJsx.jsxs("p", {
                                  className: "max-w-md text-xs text-fg-muted",
                                  children: [
                                    String(documentStore.bootReport.htmlErrors),
                                    " structural error",
                                    documentStore.bootReport.htmlErrors === 1
                                      ? ""
                                      : "s",
                                    documentStore.bootReport.htmlErrorSample !==
                                    undefined
                                      ? " — first: " +
                                        documentStore.bootReport.htmlErrorSample
                                      : "",
                                    ". Fix the source and rebuild; nothing can be saved from here.",
                                  ],
                                }),
                              ],
                            })
                          : !currentSlide && hidingMovedDeck()
                            ? SlidesAppJsx.jsx("div", {
                                className: "h-full bg-editor-canvas",
                                "data-testid": "mc-moved-deck",
                              })
                            : !currentSlide && !creationOnEmptyDeck
                              ? SlidesAppJsx.jsx(EmptyPresentationView, {
                                  readOnly: readOnly,
                                  why: saveMessage,
                                  busy: presentationBusy,
                                  arriving: showAwaitingPlaceholder,
                                  onAdd: () => openTemplatePicker(),
                                })
                              : SlidesAppJsx.jsxs("div", {
                                  className:
                                    "relative flex h-full min-h-0 flex-col",
                                  children: [
                                    !currentSlide
                                      ? SlidesAppJsx.jsxs("div", {
                                          className:
                                            "relative flex min-h-0 flex-1",
                                          children: [
                                            SlidesAppJsx.jsx("div", {
                                              ref: creationStageRef,
                                              "data-creation-stage": "",
                                              className:
                                                "relative min-w-0 flex-1 bg-editor-canvas",
                                              "aria-busy":
                                                presentationBusy &&
                                                !showSlideContent
                                                  ? true
                                                  : undefined,
                                              children: showSlideContent
                                                ? SlidesAppJsx.jsx("div", {
                                                    className: (0,
                                                    runtime.joinClassNames)(
                                                      "absolute inset-0",
                                                      creationView.toEmptyDeck &&
                                                        "sl-creation-empty",
                                                      creationView.fromEmptyDeck &&
                                                        "sl-creation-empty-out",
                                                    ),
                                                    inert:
                                                      creationView.fromEmptyDeck,
                                                    children: SlidesAppJsx.jsx(
                                                      EmptyPresentationView,
                                                      {
                                                        readOnly: readOnly,
                                                        why: saveMessage,
                                                        busy:
                                                          presentationBusy &&
                                                          !creationView.fromEmptyDeck,
                                                        arriving:
                                                          showAwaitingPlaceholder,
                                                        onAdd: () =>
                                                          openTemplatePicker(),
                                                        still:
                                                          creationView.fromEmptyDeck,
                                                      },
                                                    ),
                                                  })
                                                : null,
                                            }),
                                            creationView.addSlideOnStage
                                              ? SlidesAppJsx.jsx("div", {
                                                  ref: creationRailRef,
                                                  className:
                                                    "pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center pb-[var(--sl-safe-b,0px)] [:root[data-mc-presentation=sheet]_&]:hidden",
                                                  children: SlidesAppJsx.jsxs(
                                                    runtime.Surface,
                                                    {
                                                      elevation:
                                                        runtime.PANEL_ELEVATION,
                                                      className:
                                                        "pointer-events-auto flex items-center gap-0.5 rounded-full p-2.25 select-none",
                                                      children: [
                                                        SlidesAppJsx.jsx(
                                                          runtime.Button,
                                                          {
                                                            variant: "ghost",
                                                            size: toolbarButtonSize,
                                                            onClick:
                                                              () =>
                                                                openTemplatePicker(),
                                                            children:
                                                              "Add slide",
                                                          },
                                                        ),
                                                        SlidesAppJsx.jsx(
                                                          "span",
                                                          {
                                                            className:
                                                              "mx-0.5 h-4 w-px bg-border-line",
                                                          },
                                                        ),
                                                        SlidesAppJsx.jsx(
                                                          runtime.Button,
                                                          {
                                                            iconOnly: true,
                                                            variant: "ghost",
                                                            size: toolbarButtonSize,
                                                            icon: "Slides",
                                                            "aria-label":
                                                              "Show slide thumbnails",
                                                            "data-slides-rail-show":
                                                              "",
                                                            onClick:
                                                              () =>
                                                                chooseRailOpen(
                                                                  true,
                                                                ),
                                                          },
                                                        ),
                                                      ],
                                                    },
                                                  ),
                                                })
                                              : null,
                                          ],
                                        })
                                      : SlidesAppJsx.jsxs(
                                          SlidesAppJsx.Fragment,
                                          {
                                            children: [
                                              showAwaitingPlaceholder
                                                ? SlidesAppJsx.jsx("div", {
                                                    "data-testid":
                                                      "slides-arriving-notice",
                                                    className:
                                                      "mt-[var(--tb-overlay-h,0px)] shrink-0 px-3.5 py-1.5",
                                                    children: SlidesAppJsx.jsx(
                                                      runtime.Callout,
                                                      {
                                                        variant: "neutral",
                                                        role: "none",
                                                        children:
                                                          formatPresentationBuildProgress(
                                                            slides.length,
                                                            slides.length +
                                                              resolvedAwaitedSlideCount,
                                                          ) + ".",
                                                      },
                                                    ),
                                                  })
                                                : null,
                                              SlidesAppJsx.jsx("div", {
                                                role: "status",
                                                className: "shrink-0",
                                                children:
                                                  slideErrorMessage !==
                                                    undefined &&
                                                  slideHtmlError !== undefined
                                                    ? SlidesAppJsx.jsx(
                                                        runtime.DamagedSlideNotice,
                                                        {
                                                          slideId:
                                                            currentSlide.id,
                                                          scope: memoryScope,
                                                          deckTitle:
                                                            snapshot.meta.title,
                                                          reason:
                                                            slideErrorMessage,
                                                          diagnostic:
                                                            slideHtmlError,
                                                          canAsk: !readOnly,
                                                          className: (0,
                                                          runtime.joinClassNames)(
                                                            !showAwaitingPlaceholder &&
                                                              "mt-[var(--tb-overlay-h,0px)]",
                                                            "px-3.5 py-1.5",
                                                          ),
                                                        },
                                                        currentSlide.id,
                                                      )
                                                    : null,
                                              }),
                                              SlidesAppJsx.jsx(
                                                runtime.SlideNavigationAnnouncement,
                                                {
                                                  slideKey:
                                                    currentSlideId !== null
                                                      ? currentSlide?.id
                                                      : undefined,
                                                  message: () =>
                                                    currentSlideIndex < 0 ||
                                                    presentationStartIndex !==
                                                      null ||
                                                    (
                                                      document
                                                    ).activeElement?.closest(
                                                      '[role="listbox"]',
                                                    ) != null
                                                      ? null
                                                      : (0,
                                                        runtime.formatPresentationSlideAnnouncement)(
                                                          currentSlideIndex,
                                                          slides.length,
                                                          (0,
                                                          runtime.slideTitleSnippet)(
                                                            currentSlide,
                                                          ),
                                                        ),
                                                },
                                              ),
                                              SlidesAppJsx.jsxs("div", {
                                                className:
                                                  "relative flex min-h-0 flex-1",
                                                children: [
                                                  SlidesAppJsx.jsxs("div", {
                                                    ref: creationStageRef,
                                                    "data-slides-editor": "",
                                                    className:
                                                      "relative min-w-0 flex-1",
                                                    children: [
                                                      SlidesAppJsx.jsx(
                                                        runtime.SlideCanvasEditor,
                                                        {
                                                          designColors:
                                                            designPalette,
                                                          slideColors:
                                                            slidePalette,
                                                          pickImage:
                                                            currentSlideReadOnly
                                                              ? undefined
                                                              : async (
                                                                  input: File,
                                                                ): Promise<string> =>
                                                                  (
                                                                    await prepareImageAsset(
                                                                      input,
                                                                    )
                                                                  ).src,
                                                          slide: currentSlide,
                                                          slideNumber:
                                                            slides.indexOf(
                                                              currentSlide,
                                                            ) + 1,
                                                          slideName:
                                                            currentSlideIndex <
                                                            0
                                                              ? "Slide"
                                                              : (0,
                                                                runtime.formatPresentationSlideAnnouncement)(
                                                                  currentSlideIndex,
                                                                  slides.length,
                                                                  (0,
                                                                  runtime.slideTitleSnippet)(
                                                                    currentSlide,
                                                                  ),
                                                                ),
                                                          busy: presentationBusy,
                                                          assets:
                                                            snapshot.assets,
                                                          pending:
                                                            pendingUploads.filter(
                                                              (
                                                                input,
                                                              ) =>
                                                                input.slideId ===
                                                                currentSlide.id,
                                                            ),
                                                          covered:
                                                            presentationStartIndex !==
                                                            null,
                                                          onPointerNorm: (
                                                            input: number,
                                                            options: number,
                                                          ) =>
                                                            cursorPublisherRef.current?.move(
                                                              scopedSlideKey(
                                                                currentSlide.id,
                                                              ),
                                                              input,
                                                              options,
                                                            ),
                                                          peerLayer: (
                                                            input: number,
                                                            options: SlidePeerSelectionsProps["measure"],
                                                          ) =>
                                                            SlidesAppJsx.jsxs(
                                                              SlidesAppJsx.Fragment,
                                                              {
                                                                children: [
                                                                  SlidesAppJsx.jsx(
                                                                    runtime.SlidePeerSelections,
                                                                    {
                                                                      hosted:
                                                                        host?.presence !==
                                                                        undefined,
                                                                      deck:
                                                                        memoryScope ===
                                                                        ""
                                                                          ? null
                                                                          : (0,
                                                                            runtime.frameContextId)(
                                                                              memoryScope,
                                                                            ),
                                                                      slideId:
                                                                        currentSlide.id,
                                                                      measure:
                                                                        options,
                                                                      scale:
                                                                        1 /
                                                                        input,
                                                                    },
                                                                  ),
                                                                  SlidesAppJsx.jsx(
                                                                    runtime.PeerCursors,
                                                                    {
                                                                      surface:
                                                                        scopedSlideKey(
                                                                          currentSlide.id,
                                                                        ),
                                                                      toLocal: (
                                                                        input2: number,
                                                                        options2: number,
                                                                      ) => ({
                                                                        left:
                                                                          input2 *
                                                                          runtime.SLIDE_WIDTH,
                                                                        top:
                                                                          options2 *
                                                                          runtime.SLIDE_HEIGHT,
                                                                      }),
                                                                      glyphScale:
                                                                        input,
                                                                    },
                                                                  ),
                                                                ],
                                                              },
                                                            ),
                                                          deckCellCount: (0,
                                                          runtime.countDeckTableCells)(
                                                            slides,
                                                          ),
                                                          withinStyleBudget:
                                                            canAddStyledNodes,
                                                          selection: selection,
                                                          onSelectionChange: (
                                                            input: NodeSelection[],
                                                          ) => {
                                                            setSelection(input);
                                                            if (
                                                              textEdit &&
                                                              !input.some(
                                                                (
                                                                  input2,
                                                                ) =>
                                                                  input2.frameId ===
                                                                  textEdit.frameId,
                                                              )
                                                            ) {
                                                              setTextEditState(
                                                                null,
                                                              );
                                                            }
                                                          },
                                                          onLiveChange:
                                                            onLiveChange,
                                                          onGestureEnd:
                                                            onGestureEnd,
                                                          dragLiveRef:
                                                            dragActiveRef,
                                                          textEdit: textEdit,
                                                          onTextEdit: (
                                                            input: TextEditTarget | null,
                                                          ) => {
                                                            setTextEditState(
                                                              input,
                                                            );
                                                            if (
                                                              input !== null
                                                            ) {
                                                              setProtectedEditorSlide(
                                                                currentSlide.id,
                                                              );
                                                            }
                                                          },
                                                          onDropImage: (
                                                            input: File,
                                                            options: number,
                                                            context: number,
                                                          ) =>
                                                            void insertImageFromInput(
                                                              input,
                                                              {
                                                                at: {
                                                                  x: options,
                                                                  y: context,
                                                                },
                                                              },
                                                            ),
                                                          onReplaceImage: (
                                                            input: string,
                                                            options: NodePath,
                                                            context: File,
                                                          ) =>
                                                            void uploadAndInsertImage(
                                                              input,
                                                              options,
                                                              context,
                                                            ),
                                                          faces: snapshot.faces,
                                                          facesFull:
                                                            fullFontFaces,
                                                          fonts: snapshot.fonts,
                                                          typeStyles:
                                                            currentTypeStyles,
                                                          deckTypeStyles:
                                                            deckTypeStyles,
                                                          onDropInsert:
                                                            onDropInsert,
                                                          onOpenInspector: (
                                                            input: ReactMouseEvent<HTMLElement>,
                                                          ) => {
                                                            if (
                                                              runtime.ENABLE_OBJECT_PROPERTIES_MENU
                                                            ) {
                                                              let [
                                                                  items,
                                                                  items2,
                                                                ] = [
                                                                  input.currentTarget,
                                                                  (0,
                                                                  runtime.isKeyboardOrPrimaryActivation)(
                                                                    input,
                                                                  ),
                                                                ],
                                                                bounds =
                                                                  items.getBoundingClientRect();
                                                              openContextMenu(
                                                                {
                                                                  x: bounds.left,
                                                                  y:
                                                                    bounds.bottom +
                                                                    6,
                                                                  from: "more",
                                                                  keyboard:
                                                                    items2,
                                                                },
                                                                selection,
                                                              );
                                                              if (
                                                                items2 &&
                                                                items.isConnected
                                                              ) {
                                                                items.focus({
                                                                  preventScroll: true,
                                                                });
                                                              }
                                                              return;
                                                            }
                                                            inspectorPointerInvocationRef.current =
                                                              (0,
                                                              runtime.isKeyboardOrPrimaryActivation)(
                                                                input,
                                                              );
                                                            setInspectorOpen(
                                                              true,
                                                            );
                                                          },
                                                          moreMenu:
                                                            runtime.ENABLE_OBJECT_PROPERTIES_MENU
                                                              ? {
                                                                  label:
                                                                    "More actions",
                                                                  open:
                                                                    contextMenu
                                                                      ?.at
                                                                      .from ===
                                                                    "more",
                                                                }
                                                              : undefined,
                                                          onDeleteSelection:
                                                            currentSlideReadOnly
                                                              ? undefined
                                                              : deleteSelection,
                                                          onMenu:
                                                            currentSlideReadOnly
                                                              ? undefined
                                                              : openContextMenu,
                                                          selectionMenuHidden:
                                                            inspectorOpen,
                                                          onChangeSlide:
                                                            onChangeSlide,
                                                          presenting:
                                                            presentationStartIndex !==
                                                            null,
                                                          commenting:
                                                            commentController.ctl !==
                                                              null &&
                                                            commentController.on &&
                                                            presentationStartIndex ===
                                                              null,
                                                          readOnly:
                                                            currentSlideReadOnly,
                                                          zoomApiRef:
                                                            editorZoomApiRef,
                                                          onScaleChange:
                                                            setToolbarScale,
                                                          bottomInset:
                                                            pageOcclusionBand,
                                                          topInset: topInset,
                                                          sideInset: sideInset,
                                                          surround:
                                                            editorSurround,
                                                          stageOverlay:
                                                            SlidesAppJsx.jsx(
                                                              runtime.SlideCommentLayer,
                                                              {
                                                                ...commentController,
                                                                slide:
                                                                  currentSlide,
                                                                slides: slides,
                                                                typeStyles:
                                                                  allTypeStyles,
                                                                containerRef:
                                                                  editorElementRef,
                                                                topInset:
                                                                  topInset,
                                                                hidden:
                                                                  presentationStartIndex !==
                                                                  null,
                                                                keepsMode:
                                                                  commentModePersistent,
                                                              },
                                                            ),
                                                        },
                                                        editingGridSlide
                                                          ? "in-place"
                                                          : "plain",
                                                      ),
                                                      SlidesAppJsx.jsx(
                                                        runtime.CanvasContextMenu,
                                                        {
                                                          at:
                                                            contextMenu?.at ??
                                                            null,
                                                          objects:
                                                            contextMenu?.objects ??
                                                            0,
                                                          fitLabel:
                                                            fitViewLabel,
                                                          refusals:
                                                            contextMenu?.refusals ??
                                                            {},
                                                          returnFocus: (
                                                            input: HTMLElement | null,
                                                          ) => {
                                                            if (
                                                              input !== null &&
                                                              (input.closest(
                                                                "[data-object-proxy]",
                                                              ) === null ||
                                                                input.hasAttribute(
                                                                  "data-object-cursor",
                                                                ))
                                                            ) {
                                                              return input;
                                                            }
                                                            if (
                                                              editorZoomApiRef.current?.focusSelection() !==
                                                              true
                                                            ) {
                                                              editorZoomApiRef.current?.focusSlide();
                                                            }
                                                            return null;
                                                          },
                                                          onCommand:
                                                            runContextMenuCommand,
                                                          onClose:
                                                            () =>
                                                              setContextMenu(
                                                                null,
                                                              ),
                                                        },
                                                      ),
                                                      !railOpen &&
                                                      !editingGridSlide
                                                        ? SlidesAppJsx.jsx(
                                                            "div",
                                                            {
                                                              ref: creationRailRef,
                                                              "data-slides-pager":
                                                                "",
                                                              className: (0,
                                                              runtime.joinClassNames)(
                                                                "pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center [:root[data-mc-presentation=sheet]_&]:hidden",
                                                                !notesOpen &&
                                                                  "pb-[var(--sl-safe-b,0px)]",
                                                                touchLayout &&
                                                                  textEdit !==
                                                                    null &&
                                                                  "invisible",
                                                              ),
                                                              children:
                                                                SlidesAppJsx.jsxs(
                                                                  runtime.Surface,
                                                                  {
                                                                    elevation:
                                                                      runtime.PANEL_ELEVATION,
                                                                    className:
                                                                      "pointer-events-auto flex items-center gap-0.5 rounded-full p-2.25 select-none",
                                                                    children: [
                                                                      SlidesAppJsx.jsx(
                                                                        runtime.Button,
                                                                        {
                                                                          iconOnly: true,
                                                                          variant:
                                                                            "ghost",
                                                                          size: toolbarButtonSize,
                                                                          icon: "CaretLeft",
                                                                          "aria-label":
                                                                            "Previous slide",
                                                                          tooltip:
                                                                            "Previous slide (←)",
                                                                          ...disabledInsertControlProps(
                                                                            currentSlideIndex <=
                                                                              0,
                                                                          ),
                                                                          onClick:
                                                                            () =>
                                                                              pageSlide(
                                                                                -1,
                                                                              ),
                                                                        },
                                                                      ),
                                                                      SlidesAppJsx.jsxs(
                                                                        "span",
                                                                        {
                                                                          className:
                                                                            "px-1 text-[11px] tabular-nums whitespace-nowrap text-fg-muted pointer-coarse:text-body",
                                                                          children:
                                                                            [
                                                                              currentSlideIndex +
                                                                                1,
                                                                              " / ",
                                                                              slides.length,
                                                                            ],
                                                                        },
                                                                      ),
                                                                      SlidesAppJsx.jsx(
                                                                        runtime.Button,
                                                                        {
                                                                          iconOnly: true,
                                                                          variant:
                                                                            "ghost",
                                                                          size: toolbarButtonSize,
                                                                          icon: "CaretRight",
                                                                          "aria-label":
                                                                            "Next slide",
                                                                          tooltip:
                                                                            "Next slide (→)",
                                                                          ...disabledInsertControlProps(
                                                                            currentSlideIndex >=
                                                                              slides.length -
                                                                                1,
                                                                          ),
                                                                          onClick:
                                                                            () =>
                                                                              pageSlide(
                                                                                1,
                                                                              ),
                                                                        },
                                                                      ),
                                                                      SlidesAppJsx.jsx(
                                                                        "span",
                                                                        {
                                                                          className:
                                                                            "mx-0.5 h-4 w-px bg-border-line",
                                                                        },
                                                                      ),
                                                                      SlidesAppJsx.jsx(
                                                                        runtime.Button,
                                                                        {
                                                                          iconOnly: true,
                                                                          variant:
                                                                            "ghost",
                                                                          size: toolbarButtonSize,
                                                                          icon: "BookText",
                                                                          "aria-label":
                                                                            "Speaker notes",
                                                                          tooltip:
                                                                            notesOpen
                                                                              ? "Hide speaker notes"
                                                                              : "Show speaker notes",
                                                                          pressed:
                                                                            notesOpen,
                                                                          onClick:
                                                                            () =>
                                                                              setNotesOpen(
                                                                                (
                                                                                  input,
                                                                                ) =>
                                                                                  !input,
                                                                              ),
                                                                        },
                                                                      ),
                                                                      SlidesAppJsx.jsx(
                                                                        runtime.Button,
                                                                        {
                                                                          iconOnly: true,
                                                                          variant:
                                                                            "ghost",
                                                                          size: toolbarButtonSize,
                                                                          icon: "Slides",
                                                                          "aria-label":
                                                                            "Show slide thumbnails",
                                                                          "data-slides-rail-show":
                                                                            "",
                                                                          onClick:
                                                                            () =>
                                                                              chooseRailOpen(
                                                                                true,
                                                                              ),
                                                                        },
                                                                      ),
                                                                    ],
                                                                  },
                                                                ),
                                                            },
                                                          )
                                                        : null,
                                                    ],
                                                  }),
                                                  SlidesAppJsx.jsx(
                                                    runtime.SidePanel,
                                                    {
                                                      id: "slides-inspector",
                                                      title: (() => {
                                                        let value = (0,
                                                        runtime.filterValidSelections)(
                                                          currentSlide,
                                                          selection,
                                                        );
                                                        if (value.length > 1) {
                                                          return (
                                                            String(
                                                              value.length,
                                                            ) + " selected"
                                                          );
                                                        }
                                                        let value2 =
                                                          value[
                                                            value.length - 1
                                                          ];
                                                        switch (
                                                          value2
                                                            ? (0,
                                                              runtime.selectedNode)(
                                                                currentSlide,
                                                                value2,
                                                              )?.kind
                                                            : undefined
                                                        ) {
                                                          case "text":
                                                            return "Text";
                                                          case "img":
                                                            return "Image";
                                                          case "icon":
                                                            return "Icon";
                                                          case "table":
                                                            return "Table";
                                                          case "stack":
                                                            return "Group";
                                                          case "grid":
                                                            return "Grid";
                                                          case "shape":
                                                            return "Shape";
                                                          case "html":
                                                            return "Embed";
                                                          case "spacer":
                                                            return "Spacer";
                                                          case "overlay":
                                                            return "Overlay";
                                                          default:
                                                            return "Slide";
                                                        }
                                                      })(),
                                                      open: inspectorOpen,
                                                      onClose: () =>
                                                        setInspectorOpen(false),
                                                      hideTitle: true,
                                                      wideHeader: false,
                                                      resizeLabel:
                                                        "Resize properties panel",
                                                      children:
                                                        SlidesAppJsx.jsx(
                                                          "div",
                                                          {
                                                            ref: inspectorContentRef,
                                                            className:
                                                              "contents",
                                                            children:
                                                              currentSlideReadOnly
                                                                ? SlidesAppJsx.jsx(
                                                                    "p",
                                                                    {
                                                                      className:
                                                                        "p-3.5 text-xs text-fg-muted",
                                                                      children:
                                                                        slideErrorMessage !==
                                                                        undefined
                                                                          ? "This slide can’t be edited until its saved content is fixed."
                                                                          : "This presentation is read-only here, so its properties can’t be edited.",
                                                                    },
                                                                  )
                                                                : SlidesAppJsx.jsx(
                                                                    runtime.SelectionInspector,
                                                                    {
                                                                      editsAreUndoSteps:
                                                                        textEdit ===
                                                                        null,
                                                                      designColors:
                                                                        designPalette,
                                                                      slideColors:
                                                                        slidePalette,
                                                                      assets:
                                                                        snapshot.assets,
                                                                      onReplaceImage:
                                                                        (
                                                                          input: string,
                                                                          options: NodePath,
                                                                          context: File,
                                                                        ) =>
                                                                          void uploadAndInsertImage(
                                                                            input,
                                                                            options,
                                                                            context,
                                                                          ),
                                                                      onRemoveImages:
                                                                        removeSelectedImages,
                                                                      slide:
                                                                        currentSlide,
                                                                      selection:
                                                                        selection,
                                                                      deckCellCount:
                                                                        (0,
                                                                        runtime.countDeckTableCells)(
                                                                          slides,
                                                                        ),
                                                                      typeStyles:
                                                                        currentTypeStyles,
                                                                      deckTypeStyles:
                                                                        deckTypeStyles,
                                                                      faces:
                                                                        snapshot.faces,
                                                                      facesFull:
                                                                        fullFontFaces,
                                                                      fonts:
                                                                        snapshot.fonts,
                                                                      onChange:
                                                                        onChangeSlide,
                                                                      onLiveChange:
                                                                        onLiveChange,
                                                                      onGestureEnd:
                                                                        onGestureEnd,
                                                                      onSelectUnit:
                                                                        (
                                                                          input: NodeSelection,
                                                                        ) =>
                                                                          setSelection(
                                                                            [
                                                                              input,
                                                                            ],
                                                                          ),
                                                                      measure: (
                                                                        input: NodeSelection,
                                                                      ) =>
                                                                        editorZoomApiRef.current?.measureUnit(
                                                                          input,
                                                                        ),
                                                                      pickImage:
                                                                        currentSlideReadOnly
                                                                          ? undefined
                                                                          : async (
                                                                              input: File,
                                                                            ): Promise<string> =>
                                                                              (
                                                                                await prepareImageAsset(
                                                                                  input,
                                                                                )
                                                                              )
                                                                                .src,
                                                                    },
                                                                  ),
                                                          },
                                                        ),
                                                    },
                                                  ),
                                                ],
                                              }),
                                            ],
                                          },
                                        ),
                                    SlidesAppJsx.jsxs("div", {
                                      className:
                                        "contents [:root[data-mc-presentation=sheet]_&]:hidden",
                                      children: [
                                        notesOpen && currentSlide
                                          ? SlidesAppJsx.jsx(
                                              runtime.SpeakerNotesEditor,
                                              {
                                                slide: currentSlide,
                                                height: notesHeight,
                                                onResize: setNotesHeight,
                                                onResizeStart: () => {
                                                  notesResizeGeometryRef.current =
                                                    railGeometryRef.current?.() ??
                                                    null;
                                                },
                                                heightFor: (
                                                  input: number,
                                                  options: number,
                                                  context: number,
                                                  value: number,
                                                ) =>
                                                  input +
                                                  (0,
                                                  runtime.clampStageRailResizeDelta)(
                                                    options,
                                                    notesResizeGeometryRef.current,
                                                    context - input,
                                                    value - input,
                                                  ),
                                                atScreenBottom:
                                                  !railOpen &&
                                                  !editingGridSlide,
                                                readOnly: currentSlideReadOnly,
                                                onLiveChange:
                                                  notesEditGesture.live,
                                                onGestureEnd:
                                                  notesEditGesture.end,
                                                onRelease: () =>
                                                  editorZoomApiRef.current?.focusSlide(),
                                              },
                                            )
                                          : null,
                                        railOpen &&
                                        !editingGridSlide &&
                                        (currentSlide !== undefined ||
                                          creationView.cells !== null)
                                          ? SlidesAppJsx.jsx("div", {
                                              className: "contents",
                                              children: SlidesAppJsx.jsx(
                                                runtime.SlideThumbnailRail,
                                                {
                                                  rootRef: insertMenuRef,
                                                  slides: slides,
                                                  assets: snapshot.assets,
                                                  currentId:
                                                    currentSlide?.id ?? null,
                                                  readOnly: readOnly,
                                                  pending:
                                                    creationView.cells !== null
                                                      ? {
                                                          cells:
                                                            creationView.cells,
                                                          active:
                                                            creationView.active,
                                                          follow:
                                                            creationView.place
                                                              ?.on === "cell"
                                                              ? creationView
                                                                  .place.id
                                                              : null,
                                                          growing:
                                                            creationView.growing,
                                                          growFirst:
                                                            creationView.fromEmptyDeck &&
                                                            !creationView.sheetIn,
                                                          fresh:
                                                            creationView.fresh,
                                                          leaving:
                                                            creationView.leftover,
                                                        }
                                                      : undefined,
                                                  personPaged: onPersonPaged,
                                                  onSelect: (
                                                    input: SlideId,
                                                  ) => {
                                                    setCurrentSlideId(input);
                                                    setSelection([]);
                                                    setTextEditState(null);
                                                  },
                                                  ...slideActions,
                                                  onDuplicateAt: (
                                                    input: SlideId,
                                                    options: number,
                                                  ) =>
                                                    duplicateSlide(
                                                      input,
                                                      options,
                                                    ),
                                                  onCollapse: () =>
                                                    chooseRailOpen(false),
                                                  onEnterSlide: () =>
                                                    editorZoomApiRef.current?.focusSlide(),
                                                  gridOpen: false,
                                                  onSetGridOpen: setGridOpen,
                                                  notesOpen: notesOpen,
                                                  onToggleNotes: () =>
                                                    setNotesOpen(
                                                      (
                                                        input,
                                                      ) => !input,
                                                    ),
                                                  commentCounts:
                                                    openCommentCounts,
                                                  peersDeck:
                                                    memoryScope === ""
                                                      ? null
                                                      : (0,
                                                        runtime.frameContextId)(
                                                          memoryScope,
                                                        ),
                                                  resize: {
                                                    canvas: editorElementRef,
                                                    thumbW: thumbWidth,
                                                    onThumbW: setThumbWidth,
                                                    paneH: notesOpen
                                                      ? (0,
                                                        runtime.clampSpeakerNotesEditorHeight)(
                                                          notesHeight,
                                                        )
                                                      : 0,
                                                    geometry: railGeometryRef,
                                                  },
                                                },
                                              ),
                                            })
                                          : null,
                                      ],
                                    }),
                                    creationView.phase !== "quiet" ||
                                    creationView.toEmptyDeck
                                      ? SlidesAppJsx.jsx(
                                          runtime.SlideCreationOverlay,
                                          {
                                            view: creationView,
                                            stage: editorElementRef,
                                            rail: insertMenuRef,
                                            insetTop: topInset,
                                            insetBottom: pageOcclusionBand,
                                            insetSide: sideInset,
                                            hidden:
                                              editingGridSlide ||
                                              presentationStartIndex !== null,
                                            onFit: creationFitsEmptyStage
                                              ? setToolbarScale
                                              : undefined,
                                          },
                                        )
                                      : null,
                                  ],
                                }),
                    }),
              ],
            }),
            (gridOpen || editingGridSlide) &&
            presentationStartIndex === null &&
            !deckEmpty
              ? SlidesAppJsx.jsx("aside", {
                  ref: gridLeavingPanelRef,
                  className:
                    "shrink-0 border-t border-border-line bg-panel pb-[var(--sl-safe-b,0px)] [:root[data-mc-presentation=sheet]_&]:pb-0",
                  children: SlidesAppJsx.jsx(runtime.SlideRailToolbar, {
                    readOnly: readOnly,
                    onAdd: slideActions.onAdd,
                    notesOpen: notesOpen,
                    onToggleNotes: () =>
                      setNotesOpen((input) => !input),
                    notesDisabledReason: gridOpen
                      ? (0, runtime.slidesHaveSpeakerNotes)(slides)
                        ? undefined
                        : readOnly
                          ? "No speaker notes in this presentation"
                          : "No speaker notes yet — open a slide to add some"
                      : undefined,
                    gridOpen: true,
                    slideShortcut: gridOpen ? "esc" : undefined,
                    canvasShortcut: editingGridSlide
                      ? "shift+cmd+0"
                      : undefined,
                    onSetGridOpen: setGridOpen,
                    onCollapse: () => chooseRailOpen(false),
                    collapseDisabledReason: gridOpen
                      ? "Canvas view is showing, so there is no thumbnail strip to hide"
                      : "Editing among the slides: the Canvas around this slide stands in for the thumbnail strip",
                  }),
                })
              : null,
          ],
        }),
        SlidesAppJsx.jsx(runtime.SlideTemplatePicker, {
          open: templatePickerOpen,
          onClose: () => setTemplatePickerOpen(false),
          onPick: pickSlideTemplate,
          restyle: templateRestyler,
          returnFocus: templatePickerReturnFocus,
        }),
        SlidesAppJsx.jsx(runtime.ExportDeliveryDialog, {
          delivery: exportDelivery,
          onClose: () => setExportDelivery(null),
        }),
        presentationStartIndex !== null && presentableSlides.length > 0
          ? SlidesAppJsx.jsx(runtime.PresentationView, {
              slides: presentableSlides,
              assets: snapshot.assets,
              fontCss: fontCss,
              heldSlide: slideHtmlHold2,
              editNotes: readOnly ? undefined : notesEditGesture,
              startIndex: presentationStartIndex,
              dockNotes: dockSpeakerNotes,
              fullscreenRequest: fullscreenRequest,
              onIndexChange: setPresentationCurrentIndex,
              onExit: (input: number) =>
                exitPresentation(presentableSlides[input]?.id),
            })
          : null,
        SlidesAppJsx.jsx(runtime.LiveAnnouncer, {}),
        SlidesAppJsx.jsx(PresentationWaitingAnnouncement, {
          waiting: resolvedAwaitingSlides,
          slideCount: slides.length,
          turnBusy: presentationBusy,
          startSaidElsewhere: () =>
            creationControllerRef.current.willCount(),
          onStartSaid: () => creationControllerRef.current.startSaid(),
        }),
        SlidesAppJsx.jsx(runtime.EditorDialogHost, {}),
        exportNotes === null
          ? null
          : SlidesAppJsx.jsx(
              runtime.ExportNotesDialog,
              {
                notes: exportNotes.notes,
                onClosed: () =>
                  setExportNotes(
                    (input) =>
                      input?.nth === exportNotes.nth ? null : input,
                  ),
              },
              exportNotes.nth,
            ),
        SlidesAppJsx.jsx(runtime.PdfExportOptionsHost, {
          warning: resolvedAwaitingSlides
            ? {
                ...incompleteDeckExportConfirmation(
                  "Download",
                  presentableSlides.length,
                  slides.length + resolvedAwaitedSlideCount,
                ),
                cleared: PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE,
              }
            : undefined,
          notesAvailable: speakerNotesAvailable,
        }),
        SlidesAppJsx.jsx(runtime.VideoShrinkToastBridge, {
          hidden: presentationStartIndex !== null,
        }),
        readOnly
          ? null
          : SlidesAppJsx.jsx(runtime.useRemoteChangeAnnouncer, {
              doc: documentStore.doc,
              empty: canShowEmptyCreation,
              items: () =>
                (0, runtime.createSlideAnnouncementFingerprints)(
                  documentStore.doc.content(),
                ),
              words: runtime.PRESENTATION_CHANGE_ANNOUNCEMENTS,
              onBusy: setPresentationBusy,
            }),
        runtime.reactDOMN3_.createPortal(
          SlidesAppJsx.jsx("div", {
            className: "slides-print-sheet",
            "data-appifact-content": "",
            children: presentableSlides.map(
              (input) =>
                SlidesAppJsx.jsx(
                  "div",
                  {
                    className: "slides-print-slide",
                    children: SlidesAppJsx.jsx(runtime.SlideSurface, {
                      slide: input,
                      assets: snapshot.assets,
                      animate: false,
                    }),
                  },
                  input.id,
                ),
            ),
          }),
          document.body,
        ),
      ],
    });
  }
  function EmptyPresentationView({
    readOnly: readOnly,
    why: why,
    busy: busy,
    arriving: arriving,
    onAdd: onAdd,
    still = false,
  }: EmptyPresentationViewProps): ReactElement {
    return SlidesAppJsx.jsx("div", {
      className:
        "flex h-full flex-col overflow-y-auto bg-editor-canvas pt-[var(--tb-overlay-h,0px)] text-center",
      children: readOnly
        ? SlidesAppJsx.jsxs("div", {
            className: "m-auto flex flex-col items-center gap-3 p-6",
            children: [
              SlidesAppJsx.jsx("p", {
                className: "text-sm text-fg-secondary",
                children: "No slides to show in this view.",
              }),
              SlidesAppJsx.jsx("p", {
                className: "max-w-sm text-xs text-fg-muted",
                children: why,
              }),
            ],
          })
        : SlidesAppJsx.jsx("div", {
            className: "m-auto p-6",
            children: SlidesAppJsx.jsx(EmptyPresentationStatus, {
              busy: (busy || arriving) && !still,
              arriving: arriving,
              onAdd: onAdd,
              still: still,
            }),
          }),
    });
  }
  function EmptyPresentationStatus({
    busy: busy,
    arriving: arriving,
    onAdd: onAdd,
    still = false,
  }: EmptyPresentationStatusProps): ReactElement {
    let value =
      ((0, runtime.useAgentActivity)() === "working" || arriving) && !still;
    return SlidesAppJsx.jsx(runtime.AgentWorkingCursor, {
      working: value,
      busy: busy,
      tint: "yellow",
      idle: SlidesAppJsx.jsxs(SlidesAppJsx.Fragment, {
        children: [
          SlidesAppJsx.jsx(runtime.Icon, {
            name: "Slides",
            customSize: 56,
            className: "text-fg-muted opacity-25",
          }),
          SlidesAppJsx.jsx("p", {
            className: "text-sm text-fg-muted",
            children:
              "This presentation has no slides yet. Add one, or let the agent add some.",
          }),
        ],
      }),
      action: SlidesAppJsx.jsx(runtime.Button, {
        size: "sm",
        onClick: onAdd,
        children: "Add slide",
      }),
    });
  }
  function SlidesAppLoadingSkeleton({
    doc: doc,
    railOpen: railOpen,
  }: SlidesAppLoadingSkeletonProps): ReactElement {
    return SlidesAppJsx.jsx("div", {
      className: "flex h-full min-h-0",
      children: SlidesAppJsx.jsxs("div", {
        className: "flex min-w-0 flex-1 flex-col",
        children: [
          SlidesAppJsx.jsx("div", {
            className:
              "relative flex min-h-0 flex-1 items-center justify-center bg-editor-canvas p-6 pt-[calc(1.5rem+var(--tb-overlay-h,0px))]",
            children: SlidesAppJsx.jsx(runtime.EarlySlideFallback, {
              doc: doc,
              fallback: SlidesAppJsx.jsx("div", {
                className:
                  "mc-shimmer aspect-video w-full max-w-3xl rounded-md",
              }),
            }),
          }),
          railOpen
            ? SlidesAppJsx.jsx("div", {
                className:
                  "flex shrink-0 gap-6 border-t border-border-line bg-panel p-3 pl-9",
                children: [0, 1, 2].map(
                  (input) =>
                    SlidesAppJsx.jsx(
                      "div",
                      {
                        className:
                          "mc-shimmer aspect-video shrink-0 rounded-sm",
                        style: {
                          width: runtime.MIN_RAIL_THUMB_WIDTH,
                        },
                      },
                      input,
                    ),
                ),
              })
            : SlidesAppJsx.jsx("div", {
                className:
                  "h-[calc(3.375rem+var(--sl-safe-b,0px))] shrink-0 bg-editor-canvas pointer-coarse:h-[calc(1.875rem+40px+var(--sl-safe-b,0px))]",
              }),
        ],
      }),
    });
  }
  function loadImageDimensions(src: string): Promise<ImageDimensions> {
    return new Promise((input, options) => {
      let value = new Image();
      value.onload = () =>
        input({
          w: value.naturalWidth,
          h: value.naturalHeight,
        });
      value.onerror = () => options(Error("could not read image"));
      value.src = src;
    });
  }
  function isFrameCaptureMode(document2: Document = document): boolean {
    return document2.documentElement.hasAttribute("data-frame-capture");
  }
  bindRuntimeValue(
    runtime,
    "SlidesAppJsx",
    () => SlidesAppJsx,
    (value) => {
      SlidesAppJsx = value;
    },
  );
  bindRuntimeValue(runtime, "placeInsertedFrame", () => placeInsertedFrame);
  bindRuntimeValue(
    runtime,
    "EMPTY_SLIDE_GRID_SELECTION",
    () => EMPTY_SLIDE_GRID_SELECTION,
    (value) => {
      EMPTY_SLIDE_GRID_SELECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ZOOM_KEYBOARD_SHORTCUT_LABEL",
    () => ZOOM_KEYBOARD_SHORTCUT_LABEL,
    (value) => {
      ZOOM_KEYBOARD_SHORTCUT_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "QUICK_INSERT_SHAPES",
    () => QUICK_INSERT_SHAPES,
    (value) => {
      QUICK_INSERT_SHAPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "QUICK_INSERT_LINE_SHAPES",
    () => QUICK_INSERT_LINE_SHAPES,
    (value) => {
      QUICK_INSERT_LINE_SHAPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHAPE_INSERT_SHORTCUTS",
    () => SHAPE_INSERT_SHORTCUTS,
    (value) => {
      SHAPE_INSERT_SHORTCUTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getShapeInsertShortcut",
    () => getShapeInsertShortcut,
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INSERT_SHORTCUT_KEY",
    () => TEXT_INSERT_SHORTCUT_KEY,
    (value) => {
      TEXT_INSERT_SHORTCUT_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseShapeInsertShortcut",
    () => parseShapeInsertShortcut,
  );
  bindRuntimeValue(
    runtime,
    "disabledInsertControlProps",
    () => disabledInsertControlProps,
    (value) => {
      disabledInsertControlProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isLocalEmbeddableResource",
    () => isLocalEmbeddableResource,
    (value) => {
      isLocalEmbeddableResource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readEmbeddableImageResource",
    () => readEmbeddableImageResource,
  );
  bindRuntimeValue(
    runtime,
    "inlineLocalDeckResources",
    () => inlineLocalDeckResources,
  );
  bindRuntimeValue(
    runtime,
    "DAMAGED_SLIDE_ACTION_MESSAGE",
    () => DAMAGED_SLIDE_ACTION_MESSAGE,
    (value) => {
      DAMAGED_SLIDE_ACTION_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LOADING_PRESENTATION_PASTE_MESSAGE",
    () => LOADING_PRESENTATION_PASTE_MESSAGE,
    (value) => {
      LOADING_PRESENTATION_PASTE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "presentationCapacityMessage",
    () => presentationCapacityMessage,
    (value) => {
      presentationCapacityMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE",
    () => SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE,
    (value) => {
      SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ALL_SLIDES_SKIPPED_EXPORT_MESSAGE",
    () => ALL_SLIDES_SKIPPED_EXPORT_MESSAGE,
    (value) => {
      ALL_SLIDES_SKIPPED_EXPORT_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_BUILDING_MESSAGE",
    () => PRESENTATION_BUILDING_MESSAGE,
    (value) => {
      PRESENTATION_BUILDING_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatPresentationBuildProgress",
    () => formatPresentationBuildProgress,
    (value) => {
      formatPresentationBuildProgress = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE",
    () => PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE,
    (value) => {
      PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "incompleteDeckExportConfirmation",
    () => incompleteDeckExportConfirmation,
  );
  bindRuntimeValue(
    runtime,
    "PresentationWaitingAnnouncement",
    () => PresentationWaitingAnnouncement,
  );
  bindRuntimeValue(
    runtime,
    "EXTRA_EXPORT_FORMATS_META_NAME",
    () => EXTRA_EXPORT_FORMATS_META_NAME,
    (value) => {
      EXTRA_EXPORT_FORMATS_META_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_EXTRA_EXPORT_FORMATS",
    () => EMPTY_EXTRA_EXPORT_FORMATS,
    (value) => {
      EMPTY_EXTRA_EXPORT_FORMATS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHELL_EXPORT_IMAGE_REDUCTION_NOTE",
    () => SHELL_EXPORT_IMAGE_REDUCTION_NOTE,
    (value) => {
      SHELL_EXPORT_IMAGE_REDUCTION_NOTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GOOGLE_SLIDES_BUILD_TIMEOUT_MS",
    () => GOOGLE_SLIDES_BUILD_TIMEOUT_MS,
    (value) => {
      GOOGLE_SLIDES_BUILD_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_BROWSER_EXPORT_BYTES",
    () => MAX_BROWSER_EXPORT_BYTES,
    (value) => {
      MAX_BROWSER_EXPORT_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BROWSER_EXPORT_IMAGE_REDUCTION_NOTE",
    () => BROWSER_EXPORT_IMAGE_REDUCTION_NOTE,
    (value) => {
      BROWSER_EXPORT_IMAGE_REDUCTION_NOTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportFormatSupportsNotes",
    () => exportFormatSupportsNotes,
    (value) => {
      exportFormatSupportsNotes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXPORT_FORMAT_MIME_AND_EXTENSION",
    () => EXPORT_FORMAT_MIME_AND_EXTENSION,
    (value) => {
      EXPORT_FORMAT_MIME_AND_EXTENSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getActiveSlideSurfaceRect",
    () => getActiveSlideSurfaceRect,
    (value) => {
      getActiveSlideSurfaceRect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ACTIVE_SLIDE_SURFACE_SELECTOR",
    () => ACTIVE_SLIDE_SURFACE_SELECTOR,
    (value) => {
      ACTIVE_SLIDE_SURFACE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COMMENT_SLIDE_TARGET_SELECTOR",
    () => GRID_COMMENT_SLIDE_TARGET_SELECTOR,
    (value) => {
      GRID_COMMENT_SLIDE_TARGET_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findActiveCommentSlideTarget",
    () => findActiveCommentSlideTarget,
    (value) => {
      findActiveCommentSlideTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITOR_TAB_TARGET_SELECTOR",
    () => EDITOR_TAB_TARGET_SELECTOR,
    (value) => {
      EDITOR_TAB_TARGET_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isCanvasEditorFocusTarget",
    () => isCanvasEditorFocusTarget,
    (value) => {
      isCanvasEditorFocusTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR",
    () => ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR,
    (value) => {
      ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findVisibleSlidesViewSwitch",
    () => findVisibleSlidesViewSwitch,
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_UPLOAD_TIMEOUT_MS",
    () => VIDEO_UPLOAD_TIMEOUT_MS,
    (value) => {
      VIDEO_UPLOAD_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ignoreGlobalFileDrop",
    () => ignoreGlobalFileDrop,
    (value) => {
      ignoreGlobalFileDrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COPIED_VIDEO_OMISSION_MESSAGE",
    () => COPIED_VIDEO_OMISSION_MESSAGE,
    (value) => {
      COPIED_VIDEO_OMISSION_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jpegReplacementUploadInput",
    () => jpegReplacementUploadInput,
    (value) => {
      jpegReplacementUploadInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES",
    () => VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES,
    (value) => {
      VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_VIDEO_DURATION_MS",
    () => MAX_VIDEO_DURATION_MS,
    (value) => {
      MAX_VIDEO_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_REPLACEMENT_STALE_MESSAGE",
    () => VIDEO_REPLACEMENT_STALE_MESSAGE,
    (value) => {
      VIDEO_REPLACEMENT_STALE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_VIDEO_POSTER_DATA_URI",
    () => EMPTY_VIDEO_POSTER_DATA_URI,
    (value) => {
      EMPTY_VIDEO_POSTER_DATA_URI = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorHasBlockingOverlay",
    () => editorHasBlockingOverlay,
    (value) => {
      editorHasBlockingOverlay = value;
    },
  );
  bindRuntimeValue(runtime, "SlidesApp", () => SlidesApp);
  bindRuntimeValue(
    runtime,
    "EmptyPresentationView",
    () => EmptyPresentationView,
  );
  bindRuntimeValue(
    runtime,
    "EmptyPresentationStatus",
    () => EmptyPresentationStatus,
  );
  bindRuntimeValue(
    runtime,
    "SlidesAppLoadingSkeleton",
    () => SlidesAppLoadingSkeleton,
  );
  bindRuntimeValue(runtime, "loadImageDimensions", () => loadImageDimensions);
  bindRuntimeValue(runtime, "isFrameCaptureMode", () => isFrameCaptureMode);
  return () => {
    (0, runtime.initializeUiPointerMedia)();
    SlidesAppJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    EMPTY_SLIDE_GRID_SELECTION = {
      slides: [],
      slideSections: [],
      sections: [],
      editingSection: null,
    };
    ZOOM_KEYBOARD_SHORTCUT_LABEL =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.platform)
        ? "⌘ + / ⌘ − / ⌘ 0"
        : "Ctrl + / Ctrl − / Ctrl 0";
    QUICK_INSERT_SHAPES = runtime.shapeVariants.filter(
      (input: string) => input !== "line" && input !== "connector",
    );
    QUICK_INSERT_LINE_SHAPES = runtime.shapeVariants.filter(
      (input: string) => input === "line" || input === "connector",
    );
    SHAPE_INSERT_SHORTCUTS = {
      rect: {
        key: "r",
      },
      rounded: {
        key: "r",
        shift: true,
      },
      ellipse: {
        key: "o",
      },
      diamond: {
        key: "d",
      },
      line: {
        key: "l",
      },
      connector: {
        key: "l",
        shift: true,
      },
    };
    TEXT_INSERT_SHORTCUT_KEY = "t";
    disabledInsertControlProps = (disabled?: boolean) => ({
      "aria-disabled": disabled || undefined,
      tabIndex: disabled ? -1 : undefined,
      className:
        "aria-disabled:[&_[data-cds=Icon]]:opacity-disabled aria-disabled:[&_[data-cds-part=paint]]:bg-transparent!",
    });
    isLocalEmbeddableResource = (url: string) =>
      (0, runtime.isStoredBlobReference)(url) ||
      runtime.designSystemImagePathPattern.test(url);
    DAMAGED_SLIDE_ACTION_MESSAGE =
      "That slide can’t be edited until its saved content is fixed. Nothing changed.";
    LOADING_PRESENTATION_PASTE_MESSAGE =
      "This presentation is still opening, so nothing was pasted. Paste again in a moment.";
    presentationCapacityMessage = (count: number) =>
      "This presentation can’t hold " +
      String(count) +
      (count === 1 ? " more slide" : " more slides") +
      ". Remove some first.";
    SPEAKER_NOTES_POPOUT_FALLBACK_MESSAGE =
      "Couldn't open a notes window here (no pop-ups, or one was blocked), so the notes are below the slide.";
    ALL_SLIDES_SKIPPED_EXPORT_MESSAGE =
      "Every slide is skipped — unskip one to export the presentation";
    PRESENTATION_BUILDING_MESSAGE = "The agent is still adding slides";
    formatPresentationBuildProgress = (loadedCount: number, totalCount: number) =>
      PRESENTATION_BUILDING_MESSAGE +
      " (" +
      String(loadedCount) +
      " of " +
      String(totalCount) +
      " so far)";
    PRESENTATION_EXPORT_ALL_SLIDES_ARRIVED_MESSAGE =
      "All the slides have arrived now, so the download will include every one.";
    EXTRA_EXPORT_FORMATS_META_NAME = "appifact_extra_export_formats";
    EMPTY_EXTRA_EXPORT_FORMATS = [];
    SHELL_EXPORT_IMAGE_REDUCTION_NOTE =
      "slide images were reduced to fit the 16 MB export limit";
    GOOGLE_SLIDES_BUILD_TIMEOUT_MS = 55000;
    MAX_BROWSER_EXPORT_BYTES = 209715200;
    BROWSER_EXPORT_IMAGE_REDUCTION_NOTE =
      "slide images were reduced to keep the file under 200 MB";
    exportFormatSupportsNotes = (format: string) => format !== "png";
    EXPORT_FORMAT_MIME_AND_EXTENSION = {
      pdf: [runtime.PDF_MIME_TYPE, "PDF"],
      pptx: [runtime.PPTX_MIME_TYPE, "PPTX"],
      html: [runtime.HTML_MIME_TYPE, "HTML"],
      png: [runtime.PNG_MIME_TYPE, "PNG"],
    };
    getActiveSlideSurfaceRect = () =>
      document
        .querySelector("[data-slides-editor] [data-slide-surface]")
        ?.getBoundingClientRect();
    ACTIVE_SLIDE_SURFACE_SELECTOR = "[data-slides-editor] [data-slide-surface]";
    GRID_COMMENT_SLIDE_TARGET_SELECTOR =
      '[data-slides-grid] [data-slides-comment-target="slide"]';
    findActiveCommentSlideTarget = (slideKey: string | null) => {
      let editorTarget =
        document.querySelector<HTMLElement>(
          '[data-slides-editor] [data-slides-comment-target="slide"]',
        ) ?? document.querySelector<HTMLElement>(ACTIVE_SLIDE_SURFACE_SELECTOR);
      if (editorTarget) {
        return editorTarget;
      }
      let callback = (input: HTMLElement) =>
          input.dataset.key === slideKey,
        items = [
          ...document.querySelectorAll<HTMLElement>(
            GRID_COMMENT_SLIDE_TARGET_SELECTOR,
          ),
        ],
        value = items.filter(
          (input) => !input.hasAttribute("data-parked"),
        );
      return (
        value.find(callback) ??
        value[0] ??
        items.find(callback) ??
        items[0] ??
        document.querySelector<HTMLElement>("[data-slides-grid]")
      );
    };
    EDITOR_TAB_TARGET_SELECTOR = "[data-slides-editor] [tabindex]";
    isCanvasEditorFocusTarget = (element: EventTarget | null) =>
      element instanceof Element &&
      element.closest("[data-slides-editor]") !== null &&
      element.closest("[data-slides-pager]") === null;
    ACTIVE_SLIDES_VIEW_SWITCH_SELECTOR =
      '[data-slides-view-switch] [role="radio"][aria-checked="true"]';
    VIDEO_UPLOAD_TIMEOUT_MS = 30000;
    ignoreGlobalFileDrop = () => {};
    COPIED_VIDEO_OMISSION_MESSAGE =
      "The video was left out: a video can’t be copied to another presentation.";
    jpegReplacementUploadInput = (
      input: File,
      options: VideoPosterCapture,
    ) => {
      let { blob: blob, ...value } = options;
      return {
        file: new File([blob], input.name.replace(/\.[^.]*$/, "") + ".jpg", {
          type: "image/jpeg",
        }),
        meta: value,
      };
    };
    VIDEO_UPLOAD_UNAVAILABLE_ERROR_CODES = new Set([
      "unavailable",
      "not_granted",
      "capability_disabled",
      "capability_removed",
      "quota_or_state",
    ]);
    MAX_VIDEO_DURATION_MS = 1800000;
    VIDEO_REPLACEMENT_STALE_MESSAGE =
      "That video changed before the new one was ready. Pick it again to replace it.";
    EMPTY_VIDEO_POSTER_DATA_URI =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23141413'/%3E%3C/svg%3E";
    editorHasBlockingOverlay = (extraDialogSelector: string = "") => {
      let callback = (input: Element | null) =>
        input !== null && input.closest('[data-cds="Toast"]') !== null;
      return [
        ...document.querySelectorAll(
          runtime.OPEN_OVERLAY_SELECTOR +
            ', [data-mc-pick], [role="dialog"]' +
            extraDialogSelector,
        ),
      ].some(
        (input) =>
          !(0, runtime.isOverlayClosed)(input) &&
          (!callback(input) || callback(document.activeElement)),
      );
    };
  };
}
/** How an exported PPTX treats the fonts the slides name: keep them, swap in basic fonts, or swap in Google Slides fonts. */
export type PptxFontMode = "current" | "basic" | "google";
/** The file formats the editor exports. */
export type ExportFileFormat = "pptx" | "pdf" | "html" | "png";
/** The last pointer position over the grid, kept to re-publish the cursor when the camera moves. */
export interface GridPointerPosition {
  clientX: number;
  clientY: number;
  /** `Date.now()` when the pointer was last seen. */
  at: number;
}
/** The part of a pointer event that the grid cursor publisher reads. */
export interface GridPointerEventLike {
  pointerType?: string;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}
/** A slide copy added by "duplicate slides", with the section layout to restore when it is undone. */
export interface DuplicatedSlideRecord {
  id: SlideId;
  ob: SectionsUndoMark;
}
/** A slide removed by "delete slides", with what undo needs to put it back. */
export interface DeletedSlideRecord {
  id: SlideId;
  at: number;
  slide: Slide;
  assets: Record<string, string>;
  ob: SectionsUndoMark;
  cover: boolean;
}
/** Computes the new slide order and sections of a deck, or undefined to refuse the change. */
export type StructureCompute = (content: DeckContent) => DeckOrderAndSections | undefined;
/** Sibling nodes of one container that are duplicated together. */
export interface ChildIndexGroup {
  frameId: string;
  parentPath: number[];
  indices: number[];
}
/** What `useToolbarInsets` returns: top inset, ref callback of the measured element, side inset. */
export type ToolbarInsets = [number, (element: HTMLElement | null) => void, number];
/** What the slide editor reads of `useArtifactFind`: the props to spread onto the find bar. */
export interface ArtifactFindController {
  bar: object;
}
/** A finished render of one export format. */
export interface ExportRender {
  blob: Blob;
  filename: string;
  warnings: string[];
  /** How the file size grows with the capture scale (about 2 for raster pages). */
  sizeExponent?: number;
  /** Milliseconds spent on lossless page copies, which the render budget does not count. */
  copyMs?: number;
}
/** The time and size limits one tiered render works within. */
export interface ExportRenderLimits {
  deadline: number;
  maxBytes: number;
  signal?: AbortSignal;
}
/** An export that can be rendered at several capture qualities, best first. */
export interface TieredExportRender {
  tiers: CaptureQuality[];
  renderAt: (tier: CaptureQuality, limits?: ExportRenderLimits) => Promise<ExportRender>;
  /** Names the reduction in a warning when a lower tier had to be used. */
  reducedNote?: (tier: CaptureQuality) => string;
}
/** Turns the captured pages of a deck into the exported file. */
export type PdfPagesFinisher = (pages: CapturedPage[], slides: readonly Slide[]) => Blob | Promise<Blob>;
/** Renders an export after the user's PDF choices (undefined when none were asked). */
export type ExportRenderer = (
  choices: PdfExportOptions | undefined,
  signal: AbortSignal | undefined,
) => Promise<ExportRender>;
/** An export format the editor offers, before it is registered with the host. */
export interface ExportEntrySpec {
  format: string;
  variant?: string;
  interactive?: boolean;
  available?: boolean;
  produce: ExportEntry["produce"];
}
/** One unit of a copied selection: the selection (or its frame) and the frame to paste. */
export interface CopyableUnit {
  unit: NodeSelection;
  frame: Frame;
}
/** A point in slide-surface pixels at which an inserted frame is centred. */
export interface InsertAnchor {
  x: number;
  y: number;
}
/** Horizontal and vertical placement of a newly inserted frame. */
export interface FramePlacement {
  x: Axis;
  y: Axis;
}
/** What the slide grid reports as selected (slide ids, their section ids, selected section ids). */
export interface SlideGridSelection {
  slides: string[];
  slideSections: string[];
  sections: string[];
  /** Section the keyboard focus is in ("-" for the unsectioned slides), if any. */
  editingSection: string | null;
}
/** Keyboard shortcut that inserts a shape. */
export interface ShapeInsertShortcut {
  key: string;
  shift?: boolean;
}
/** The part of a keyboard event that shape-insert shortcuts read. */
export type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "metaKey" | "ctrlKey" | "altKey" | "repeat" | "isComposing" | "key" | "shiftKey"
>;
/** Attributes that make an insert control look and behave disabled without removing it from the tab order logic. */
export interface DisabledControlProps {
  "aria-disabled": true | undefined;
  tabIndex: -1 | undefined;
  className: string;
}
export interface InlinedDeckResources {
  slides: readonly Slide[];
  assets: ReadonlyMap<string, string>;
  /** Human-readable notes about pictures that could not be inlined. */
  warnings: string[];
}
export interface IncompleteDeckConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
}
export interface PresentationWaitingAnnouncementProps {
  waiting: boolean;
  slideCount: number;
  turnBusy: boolean;
  startSaidElsewhere?: () => boolean;
  onStartSaid?: () => void;
}
/** `[mime type, upper-case label]` of an export format. */
export type ExportFormatMimeAndLabel = readonly [mime: string, label: string];
/** Result of capturing a poster frame from a video. */
export type VideoPosterCapture = VideoPoster;
/** A video's poster frame as a JPEG file, with the video's metadata. */
export interface JpegReplacementUpload {
  file: File;
  meta: VideoMetadata;
}
/** Where a new element lands and whether the insert came from the keyboard. */
export interface InsertPlacement {
  at?: InsertAnchor;
  byKey?: boolean;
}
/** A too-big video that was probed and planned, with the poster that stands in for it. */
export interface VideoShrinkPlan {
  probe: VideoProbe;
  plan: VideoEncodingPlan;
  poster: JpegReplacementUpload;
}
/** A shrunk video that is ready to be placed on a slide. */
export type ReadyVideoShrink = Extract<VideoShrinkResult, { kind: "ready" }>;
/** A video insert that resumes after its shrink finished. */
export interface VideoInsertResume extends VideoShrinkPlan {
  slideId: SlideId;
}
/** The image element a video replacement was started on. */
export interface ClickedVideoImage {
  asset: string | undefined;
  src: string | undefined;
  video: string | undefined;
}
/** A video replacement that resumes after its shrink finished. */
export interface VideoReplacementResume extends VideoInsertResume {
  clicked: ClickedVideoImage;
}
/** An upload that is in flight, drawn as a placeholder over its slide. */
export interface PendingUpload {
  id: string;
  slideId: SlideId;
  rect: SlideRect;
  url: string;
  what: "video" | "image";
}
export interface ImageDimensions {
  w: number;
  h: number;
}
/** What the hosting page may pass to the slides app. */
export interface SlidesAppHost {
  /** Prefix that keeps this deck's remembered state apart from other decks on the page. */
  memoryScope?: string;
  undo?: CommandHistory;
  presence?: Record<string, unknown>;
  leading?: ReactNode;
  aboveContent?: ReactNode;
}
export interface SlidesAppProps {
  host?: SlidesAppHost;
}
export interface EmptyPresentationViewProps {
  readOnly: boolean;
  why: string;
  busy: boolean;
  arriving: boolean;
  onAdd: () => void;
  still?: boolean;
}
export interface EmptyPresentationStatusProps {
  busy: boolean;
  arriving: boolean;
  onAdd: () => void;
  still?: boolean;
}
export interface SlidesAppLoadingSkeletonProps {
  doc: unknown;
  railOpen: boolean;
}
/** Reports that the person is acting on the deck (a structural change or an ordinary edit). */
export type CreationActivity = (kind: "structure" | "edit") => void;
/** An on-screen rectangle in client pixels. */
export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** A point in client pixels. */
export interface ClientPoint {
  x: number;
  y: number;
}
/** Where inside a grid tile the pointer was, as fractions of the tile's size. */
export type GridPick = Pick<GridSlideHit, "fx" | "fy">;
/** Scale limits of the grid or of the editor camera. */
export interface GridZoomLimits {
  minScale: number;
  maxScale: number;
}
/** Pan and zoom of the editor camera. */
export interface CameraView {
  x: number;
  y: number;
  scale: number;
}
/** The slide the grid opened in the editor: where its tile sat and how far the editor may zoom. */
export interface GridSlideSurround extends GridZoomLimits {
  id: string;
  rect: ScreenRect;
  pick?: ClientPoint;
}
/** The editor's view of the slide being edited in the grid, replayed onto the grid. */
export interface GridFollow {
  id: string;
  view: CameraView;
  rect: ScreenRect;
}
/** The slide surface the grid should grow out of when it opens. */
export interface GridEnterFrom {
  id: string;
  rect: DOMRect;
}
export interface ReturnToGridOptions {
  /** Slide to select in the grid. */
  select?: string;
  /** Fit all tiles into view. */
  fit?: boolean;
}
/** Imperative handle the slide grid publishes through its `zoomApiRef`. */
export interface GridZoomApi {
  getScale(): number;
  getLimits(): GridZoomLimits;
  setScaleTo(scale: number): void;
  fitAll(slideId?: string): void;
  /** Multiplies the current scale by `factor`. */
  stepZoom(factor: number): void;
  glideToSlide(
    slideId: string,
    rect: ScreenRect,
    done?: (completed: boolean) => void,
  ): void;
  follow(slideId: string, view: CameraView, rect: ScreenRect): void;
  tileRect(slideId: string): ScreenRect | null;
  tileAt(x: number, y: number): string | null;
  showSlide(slideId: string, point?: ClientPoint): boolean;
  settling(): boolean;
  slideAt(x: number, y: number): GridSlideHit | null;
}
/** Imperative handle the slide editor canvas publishes through its `zoomApiRef`. */
export interface EditorZoomApi {
  getScale(): number;
  getLimits(): GridZoomLimits;
  setScaleTo(scale: number): void;
  returnToFit(): void;
  stepZoom(factor: number): void;
  focusSlide(): void;
  focusSelection(): boolean;
  endTextEdit(): boolean;
  landOnCreated(frameId: string): void;
  measureUnit(unit: NodeSelection): { w?: number; h?: number } | undefined;
  groupMeasure: GroupMeasure;
  menuPoint(): ContextMenuPoint | null;
  endCrop(): void;
}
/** Where the object context menu opens when it is raised from the keyboard. */
export interface ContextMenuPoint {
  x: number;
  y: number;
}
/** Listener told the current scale (1 is 100%). */
export type ScaleListener = (scale: number) => void;
/** A new selection or a function computing it from the current one. */
export type SelectionUpdate =
  | NodeSelection[]
  | ((current: NodeSelection[]) => NodeSelection[]);
/** A pending fullscreen request made while presenting: "next" asks for the next user gesture. */
export type FullscreenRequest = "next" | Promise<FullscreenOutcome>;
/** A file the host could not save itself, offered for download instead. */
export interface ExportDeliveryRequest {
  blob: Blob;
  filename: string;
  mime: string;
  kind: string;
  reason: string;
}
/** Notes about the last export; `nth` changes whenever the dialog should reopen. */
export interface ExportNotesState {
  notes: string[];
  nth: number;
}
export type TemplatePickerReturnFocus = NonNullable<
  SlideTemplatePickerProps["returnFocus"]
>;
export interface TemplatePickerOptions {
  returnFocus?: TemplatePickerReturnFocus;
}
/** The open text edit; `caret` asks the editor to put the caret at the end of the text. */
export interface TextEditTarget extends ObjectContextEditing {
  caret?: "end";
}
/** What the page-level place link reports: the slide order and the slide currently shown. */
export interface PlaceLinkState {
  order: readonly string[];
  shownId: string | null;
}
/** What the presentation reporter last told the host. */
export interface ReportedPresentation {
  presenting: boolean;
  slideId: string | null;
}
/** A slide picked for deletion with the index it had in the deck. */
export interface SlideAtIndex {
  slide: Slide;
  at: number;
}
/** Where an object context menu opens and how it was raised. */
export interface ContextMenuAnchor extends ContextMenuPoint {
  from: "key" | "right-click" | "more";
  /** True when the menu was opened from the keyboard, so the first item takes focus. */
  keyboard?: boolean;
}
/** Why a context menu command is unavailable, keyed by command id. */
export type ContextMenuRefusals = Partial<Record<string, string>>;
/** The open object context menu. */
export interface ContextMenuState {
  at: ContextMenuAnchor;
  /** Number of selected objects; 0 means the slide itself. */
  objects: number;
  refusals: ContextMenuRefusals;
}
/** Commands the object context menu can run. */
export type ContextMenuCommandId =
  | "cut"
  | "copy"
  | "paste"
  | "duplicate"
  | "front"
  | "back"
  | "group"
  | "ungroup"
  | "properties"
  | "delete"
  | "fit";
