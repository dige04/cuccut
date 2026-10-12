/** Restored application module; prepare first, initialize in original order. */
import type { ComponentClass, ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { DeckContent, SlideId } from "../deck-contracts";

/** A slide parsed ahead of the full document load, with the deck content it needs to render. */
export interface EarlySlide {
  id: SlideId;
  content: DeckContent;
}
/** Where a document publishes its early slide, and how to hear about changes. */
export interface EarlySlideSource {
  earlySlide(): EarlySlide | undefined;
  subscribeEarly(listener: () => void): () => void;
}
export interface EarlySlideFallbackProps {
  /** The store document that may carry an early slide. */
  doc: EarlySlideSource;
  /** Shown until an early slide exists, or when rendering it fails. */
  fallback: ReactNode;
}
export interface EarlySlideViewProps {
  early: EarlySlide;
}
export interface EarlySlideErrorBoundaryProps {
  fallback: ReactNode;
  children?: ReactNode;
}
export interface EarlySlideErrorBoundaryState {
  failed: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactEarlySlide: ReactNamespace;
    EarlySlideJsx: JsxNamespace;
    SLIDES_PRINT_STYLES: string;
    emptyEarlySlideSource: EarlySlideSource;
    getEarlySlideSource: (document: EarlySlideSource) => EarlySlideSource;
    EarlySlideFallback: (props: EarlySlideFallbackProps) => ReactElement;
    EarlySlideErrorBoundary: ComponentClass<
      EarlySlideErrorBoundaryProps,
      EarlySlideErrorBoundaryState
    >;
    EARLY_SLIDE_PAINT_TIMEOUT_MS: number;
    waitForEarlySlidePaint: () => Promise<void>;
    EarlySlideView: (props: EarlySlideViewProps) => ReactElement;
  }
}

export function installEditorEarlySlide(runtime: RuntimeBindings): () => void {
  var ReactEarlySlide: ReactNamespace;
  var SLIDES_PRINT_STYLES: RuntimeBindings["SLIDES_PRINT_STYLES"];
  var EarlySlideJsx: JsxNamespace;
  var emptyEarlySlideSource: RuntimeBindings["emptyEarlySlideSource"];
  var getEarlySlideSource: RuntimeBindings["getEarlySlideSource"];
  var EarlySlideErrorBoundary: RuntimeBindings["EarlySlideErrorBoundary"];
  var EARLY_SLIDE_PAINT_TIMEOUT_MS: RuntimeBindings["EARLY_SLIDE_PAINT_TIMEOUT_MS"];
  function EarlySlideFallback({
    doc: doc,
    fallback: fallback,
  }: EarlySlideFallbackProps): ReactElement {
    let value = getEarlySlideSource(doc),
      value2 = ReactEarlySlide.useSyncExternalStore(
        value.subscribeEarly,
        value.earlySlide,
      );
    if (value2 === undefined) {
      return EarlySlideJsx.jsx(EarlySlideJsx.Fragment, {
        children: fallback,
      });
    } else {
      return EarlySlideJsx.jsx(
        EarlySlideErrorBoundary,
        {
          fallback: fallback,
          children: EarlySlideJsx.jsx(EarlySlideView, {
            early: value2,
          }),
        },
        value2.id,
      );
    }
  }
  function waitForEarlySlidePaint(): Promise<void> {
    if (
      typeof document === "undefined" ||
      document.visibilityState !== "visible" ||
      typeof requestAnimationFrame !== "function"
    ) {
      return Promise.resolve();
    }
    return new Promise<void>((input): void => {
      let value = setTimeout(input, EARLY_SLIDE_PAINT_TIMEOUT_MS);
      document.addEventListener("visibilitychange", (): void => input(), {
        once: true,
      });
      requestAnimationFrame(
        (): void =>
          void setTimeout((): void => {
            clearTimeout(value);
            input();
          }, 0),
      );
    });
  }
  function EarlySlideView({ early: early }: EarlySlideViewProps): ReactElement {
    let { content: content } = early;
    (0, runtime.setRenderingTheme)(content.theme);
    let memo = ReactEarlySlide.useMemo(
        (): string =>
          (0, runtime.buildDeckThemeCss)(content.fonts, content.faces),
        [content.fonts, content.faces],
      ),
      memo2 = ReactEarlySlide.useMemo(
        (): Map<string, string> =>
          new Map(Object.entries<string>(content.assets)),
        [content.assets],
      ),
      [value, value2, value3] = (0, runtime.useToolbarInsets)(),
      ref = ReactEarlySlide.useRef<HTMLDivElement | null>(null),
      callback = ReactEarlySlide.useCallback(
        (input: HTMLDivElement | null): void => {
          ref.current = input;
          value2(input);
        },
        [value2],
      ),
      [value4, value5] = ReactEarlySlide.useState({
        w: 0,
        h: 0,
      });
    ReactEarlySlide.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current) {
        return;
      }
      current.setAttribute("inert", "");
      let callback2 = (): void =>
        value5({
          w: current.clientWidth,
          h: current.clientHeight,
        });
      callback2();
      let observer = new ResizeObserver(callback2);
      observer.observe(current);
      return (): void => observer.disconnect();
    }, []);
    let value6 = (0, runtime.fitSlideEditorViewport)({
      w: value4.w,
      h: Math.max(0, value4.h - value),
      top: value,
      ...(value3 > 0
        ? {
            sidePad: value3,
          }
        : {}),
    });
    return EarlySlideJsx.jsxs("div", {
      ref: callback,
      "aria-hidden": true,
      "data-slides-early": "",
      className: "absolute inset-0 overflow-hidden",
      children: [
        EarlySlideJsx.jsx("style", {
          children: SLIDES_PRINT_STYLES,
        }),
        memo !== ""
          ? EarlySlideJsx.jsx("style", {
              children: memo,
            })
          : null,
        value4.w > 0
          ? EarlySlideJsx.jsx("div", {
              style: {
                position: "absolute",
                left: -value6.x * value6.scale,
                top: -value6.y * value6.scale,
                width: runtime.SLIDE_WIDTH,
                height: runtime.SLIDE_HEIGHT,
                transform: "scale(" + String(value6.scale) + ")",
                transformOrigin: "top left",
              },
              children: EarlySlideJsx.jsx(runtime.SlideSurface, {
                slide: content.slides[early.id],
                assets: memo2,
                animate: false,
              }),
            })
          : null,
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactEarlySlide",
    () => ReactEarlySlide,
    (value) => {
      ReactEarlySlide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_PRINT_STYLES",
    () => SLIDES_PRINT_STYLES,
    (value) => {
      SLIDES_PRINT_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EarlySlideJsx",
    () => EarlySlideJsx,
    (value) => {
      EarlySlideJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyEarlySlideSource",
    () => emptyEarlySlideSource,
    (value) => {
      emptyEarlySlideSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getEarlySlideSource",
    () => getEarlySlideSource,
    (value) => {
      getEarlySlideSource = value;
    },
  );
  bindRuntimeValue(runtime, "EarlySlideFallback", () => EarlySlideFallback);
  bindRuntimeValue(
    runtime,
    "EarlySlideErrorBoundary",
    () => EarlySlideErrorBoundary,
    (value) => {
      EarlySlideErrorBoundary = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EARLY_SLIDE_PAINT_TIMEOUT_MS",
    () => EARLY_SLIDE_PAINT_TIMEOUT_MS,
    (value) => {
      EARLY_SLIDE_PAINT_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "waitForEarlySlidePaint",
    () => waitForEarlySlidePaint,
  );
  bindRuntimeValue(runtime, "EarlySlideView", () => EarlySlideView);
  return () => {
    ReactEarlySlide = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeSlideRenderer)();
    SLIDES_PRINT_STYLES = [
      "@page{size:1920px 1080px;margin:0;}",
      ".slides-print-sheet{display:none;}",
      "@media print{",
      "  #root{display:none !important;}",
      "  [data-mc-chrome]{display:none !important;}",
      "  .slides-print-sheet{display:block !important;}",
      "  .slides-print-slide{break-after:page;page-break-after:always;break-inside:avoid;}",
      "  .slides-print-slide:last-child{break-after:auto;page-break-after:auto;}",
      "}",
    ].join(`
`);
    (0, runtime.initializeRenderingTheme)();
    EarlySlideJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    emptyEarlySlideSource = {
      earlySlide: (): undefined => {
        return;
      },
      subscribeEarly: (): (() => void) => (): void => {},
    };
    getEarlySlideSource = (document2: EarlySlideSource): EarlySlideSource =>
      typeof document2.earlySlide === "function"
        ? document2
        : emptyEarlySlideSource;
    EarlySlideErrorBoundary = class EarlySlideErrorBoundary extends ReactEarlySlide.Component<
      EarlySlideErrorBoundaryProps,
      EarlySlideErrorBoundaryState
    > {
      declare props: Readonly<EarlySlideErrorBoundaryProps>;
      state: EarlySlideErrorBoundaryState = {
        failed: false,
      };
      static getDerivedStateFromError(): EarlySlideErrorBoundaryState {
        return {
          failed: true,
        };
      }
      componentDidCatch(input: Error): void {
        try {
          if (typeof reportError === "function") {
            reportError(input);
          }
        } catch {}
      }
      render(): ReactNode {
        if (this.state.failed) {
          return this.props.fallback;
        } else {
          return this.props.children;
        }
      }
    };
    EARLY_SLIDE_PAINT_TIMEOUT_MS = 100;
  };
}
