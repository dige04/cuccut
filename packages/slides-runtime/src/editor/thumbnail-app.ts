/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  FontFace,
  Slide,
  SlideColor,
  SlideId,
  ThemeFonts,
} from "../deck-contracts";

/** The document-store snapshot the cover thumbnail renders from. */
export interface ThumbnailSnapshot {
  slides: Slide[];
  cover?: SlideId;
  fonts?: ThemeFonts;
  faces?: FontFace[];
  assets: ReadonlyMap<string, string>;
}
/** A document that can report its title and notify on change. */
export interface ThumbnailDocument {
  subscribe(listener: () => void): () => void;
  title(): string;
}
/** A document that also reports whether its content has finished loading. */
export interface ThumbnailLoadAwareDocument extends ThumbnailDocument {
  subscribeLoad(listener: () => void): () => void;
  loadState(): string;
}
/** The slice of the document store the thumbnail app reads. */
export interface ThumbnailDocumentStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ThumbnailSnapshot;
  doc: ThumbnailDocument | ThumbnailLoadAwareDocument;
}
export interface SlidesThumbnailSlideProps {
  slide: Slide | undefined;
  assets: ReadonlyMap<string, string>;
  /** CSS that declares the deck's theme fonts. */
  fontCss: string;
  /** The deck title shown when the deck has no slide to show. */
  title: string | undefined;
}
export interface SlidesTitleCoverProps {
  title: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSlidesThumbnail: ReactNamespace;
    SlidesThumbnailJsx: JsxNamespace;
    DEFAULT_THUMBNAIL_THEME: SlideColor;
    chooseThumbnailCoverSlide: (
      slides: readonly Slide[],
      coverId?: SlideId,
    ) => Slide | undefined;
    SlidesThumbnailApp: () => ReactElement;
    SlidesThumbnailSlide: (props: SlidesThumbnailSlideProps) => ReactElement;
    SlidesTitleCover: (props: SlidesTitleCoverProps) => ReactElement;
  }
}

export function installEditorThumbnailApp(
  runtime: RuntimeBindings,
): () => void {
  var ReactSlidesThumbnail: ReactNamespace;
  var SlidesThumbnailJsx: JsxNamespace;
  var DEFAULT_THUMBNAIL_THEME: RuntimeBindings["DEFAULT_THUMBNAIL_THEME"];
  function chooseThumbnailCoverSlide(
    slides: readonly Slide[],
    coverId?: SlideId,
  ): Slide | undefined {
    let hasFrames = (input: Slide): boolean => input.frames.length > 0,
      cover =
        coverId !== undefined
          ? slides.find((input: Slide): boolean => input.id === coverId)
          : undefined;
    return (
      (cover !== undefined && hasFrames(cover) ? cover : undefined) ??
      slides.find(
        (input: Slide): boolean => input.skipped !== true && hasFrames(input),
      ) ??
      slides.find(hasFrames)
    );
  }
  function SlidesThumbnailApp(): ReactElement {
    let memo = ReactSlidesThumbnail.useMemo(
        (): ThumbnailDocumentStore => new runtime.SlidesDocumentStore(),
        [],
      ),
      value = ReactSlidesThumbnail.useSyncExternalStore(
        ReactSlidesThumbnail.useCallback(
          (input: () => void): (() => void) => memo.subscribe(input),
          [memo],
        ),
        (): ThumbnailSnapshot => memo.getSnapshot(),
      ),
      value2 = ReactSlidesThumbnail.useSyncExternalStore(
        ReactSlidesThumbnail.useCallback(
          (input: () => void): (() => void) =>
            memo.doc.subscribe((): void => input()),
          [memo],
        ),
        (): string => memo.doc.title() || document.title,
      ),
      value3 = ReactSlidesThumbnail.useSyncExternalStore(
        ReactSlidesThumbnail.useCallback(
          (input: () => void): (() => void) =>
            "subscribeLoad" in memo.doc
              ? memo.doc.subscribeLoad(input)
              : (): void => {},
          [memo],
        ),
        (): boolean =>
          !("loadState" in memo.doc) || memo.doc.loadState() === "live",
      ),
      memo2 = ReactSlidesThumbnail.useMemo(
        (): string => (0, runtime.buildDeckThemeCss)(value.fonts, value.faces),
        [value.fonts, value.faces],
      ),
      ref = ReactSlidesThumbnail.useRef<Slide | undefined>(undefined);
    if (value3 && ref.current === undefined) {
      ref.current = chooseThumbnailCoverSlide(value.slides, value.cover);
    }
    return SlidesThumbnailJsx.jsx(SlidesThumbnailSlide, {
      slide: ref.current,
      assets: value.assets,
      fontCss: memo2,
      title: value3 ? value2 : undefined,
    });
  }
  function SlidesThumbnailSlide({
    slide: slide,
    assets: assets,
    fontCss: fontCss,
    title: title,
  }: SlidesThumbnailSlideProps): ReactElement {
    let ref = ReactSlidesThumbnail.useRef<HTMLDivElement>(null),
      [value, value2] = ReactSlidesThumbnail.useState(1);
    ReactSlidesThumbnail.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current) {
        return;
      }
      let callback = (): void =>
        value2(
          Math.min(
            current.clientWidth / runtime.SLIDE_WIDTH,
            current.clientHeight / runtime.SLIDE_HEIGHT,
          ) || 1,
        );
      callback();
      let observer = new ResizeObserver(callback);
      observer.observe(current);
      return (): void => observer.disconnect();
    }, []);
    let value3 = (0, runtime.slideBackgroundColor)(
      slide?.bg ?? DEFAULT_THUMBNAIL_THEME,
    );
    return SlidesThumbnailJsx.jsxs("div", {
      ref: ref,
      "data-appifact-content": "",
      "data-slides-cover": "",
      style: {
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: value3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      children: [
        SlidesThumbnailJsx.jsx("style", {
          children: runtime.SLIDES_PRINT_STYLES,
        }),
        fontCss !== ""
          ? SlidesThumbnailJsx.jsx("style", {
              children: fontCss,
            })
          : null,
        SlidesThumbnailJsx.jsx("div", {
          style: {
            width: runtime.SLIDE_WIDTH * value,
            height: runtime.SLIDE_HEIGHT * value,
            flex: "none",
          },
          children: SlidesThumbnailJsx.jsx("div", {
            style: {
              width: runtime.SLIDE_WIDTH,
              height: runtime.SLIDE_HEIGHT,
              transform: "scale(" + String(value) + ")",
              transformOrigin: "top left",
            },
            children:
              slide !== undefined
                ? SlidesThumbnailJsx.jsx(runtime.SlideSurface, {
                    slide: slide,
                    assets: assets,
                    animate: false,
                  })
                : title !== undefined
                  ? SlidesThumbnailJsx.jsx(SlidesTitleCover, {
                      title: title,
                    })
                  : null,
          }),
        }),
      ],
    });
  }
  function SlidesTitleCover({ title: title }: SlidesTitleCoverProps): ReactElement {
    let value = (0, runtime.renderingTypeScaleForRole)("display");
    return SlidesThumbnailJsx.jsx("div", {
      "data-slides-title-cover": "",
      style: {
        width: runtime.SLIDE_WIDTH,
        height: runtime.SLIDE_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 160,
        boxSizing: "border-box",
      },
      children: SlidesThumbnailJsx.jsx("div", {
        style: {
          fontFamily: value.fontFamily,
          fontSize: value.fontSize,
          fontWeight: value.fontWeight,
          lineHeight: value.lineHeight,
          ...(value.serifDisplay
            ? {
                fontVariationSettings: "'opsz' 48",
              }
            : null),
          color: (0, runtime.slideTextColor)(DEFAULT_THUMBNAIL_THEME),
          textAlign: "center",
          overflowWrap: "anywhere",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        },
        children: title,
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactSlidesThumbnail",
    () => ReactSlidesThumbnail,
    (value) => {
      ReactSlidesThumbnail = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlidesThumbnailJsx",
    () => SlidesThumbnailJsx,
    (value) => {
      SlidesThumbnailJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_THUMBNAIL_THEME",
    () => DEFAULT_THUMBNAIL_THEME,
    (value) => {
      DEFAULT_THUMBNAIL_THEME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chooseThumbnailCoverSlide",
    () => chooseThumbnailCoverSlide,
  );
  bindRuntimeValue(runtime, "SlidesThumbnailApp", () => SlidesThumbnailApp);
  bindRuntimeValue(runtime, "SlidesThumbnailSlide", () => SlidesThumbnailSlide);
  bindRuntimeValue(runtime, "SlidesTitleCover", () => SlidesTitleCover);
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeSlideRenderer)();
    ReactSlidesThumbnail = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeRenderingTheme)();
    SlidesThumbnailJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    DEFAULT_THUMBNAIL_THEME = "ivory-warm";
  };
}
