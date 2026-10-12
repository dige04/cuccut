/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** Measurements of how much of the page the host UI covers at the bottom. */
export interface PageOcclusionLayout {
  viewportH: number;
  /** Bottom edge of the working area, or null when nothing was measured. */
  workingBottom: number | null;
  band: number;
  presenting: boolean;
}
export interface PageOcclusionReporterProps {
  band: number;
  presenting: boolean;
  /** Changes whenever the layout may have moved, so the inset is re-measured. */
  settle: string;
  /** Only the editor that owns the page reports to the host. */
  speaksForPage: boolean;
}
/** Callback refs the editor attaches to the elements that bound its working area. */
export interface PageOcclusionRefs {
  stage: (element: Element | null) => void;
  canvasView: (element: Element | null) => void;
  groundProbe: (element: Element | null) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactPageOcclusion: ReactNamespace;
    calculatePageOcclusionBottom: (layout: PageOcclusionLayout) => number;
    PageOcclusionReporter: (
      props: PageOcclusionReporterProps,
    ) => PageOcclusionRefs;
  }
}

export function installBridgePageOcclusion(
  runtime: RuntimeBindings,
): () => void {
  var ReactPageOcclusion: ReactNamespace;
  function calculatePageOcclusionBottom(layout: PageOcclusionLayout): number {
    if (layout.presenting || layout.workingBottom === null) {
      return 0;
    }
    return (
      Math.max(0, Math.round(layout.viewportH - layout.workingBottom)) +
      Math.max(0, Math.round(layout.band))
    );
  }
  function PageOcclusionReporter({
    band: band,
    presenting: presenting,
    settle: settle,
    speaksForPage: speaksForPage,
  }: PageOcclusionReporterProps): PageOcclusionRefs {
    let ref = ReactPageOcclusion.useRef<Element | null>(null),
      ref2 = ReactPageOcclusion.useRef<Element | null>(null),
      ref3 = ReactPageOcclusion.useRef<Element | null>(null),
      ref4 = ReactPageOcclusion.useRef<ResizeObserver | null>(null),
      ref5 = ReactPageOcclusion.useRef({
        band: band,
        presenting: presenting,
        speaks: speaksForPage,
      }),
      callback = ReactPageOcclusion.useCallback(() => {
        let {
          band: current,
          presenting: current2,
          speaks: current3,
        } = ref5.current;
        if (!current3) {
          return;
        }
        let value = ref.current ?? ref2.current,
          value2 = calculatePageOcclusionBottom({
            viewportH: document.documentElement.clientHeight,
            workingBottom:
              value === null ? null : value.getBoundingClientRect().bottom,
            band: current,
            presenting: current2,
          });
        (0, runtime.setHostFootState)({
          inset: value2,
          ground:
            current2 || ref3.current === null
              ? null
              : (0, runtime.readHostBackgroundColor)(ref3.current),
        });
      }, []),
      callback2 = ReactPageOcclusion.useCallback(() => {
        ref4.current?.disconnect();
        ref4.current = null;
        if (!ref5.current.speaks || typeof ResizeObserver === "undefined") {
          return;
        }
        let observer = new ResizeObserver(callback);
        ref4.current = observer;
        observer.observe(document.documentElement);
        if (ref.current !== null) {
          observer.observe(ref.current);
        }
        if (ref2.current !== null) {
          observer.observe(ref2.current);
        }
      }, [callback]),
      callback3 = ReactPageOcclusion.useCallback(
        (input: Element | null) => {
          ref.current = input;
          callback2();
        },
        [callback2],
      ),
      callback4 = ReactPageOcclusion.useCallback(
        (input: Element | null) => {
          ref2.current = input;
          callback2();
        },
        [callback2],
      ),
      callback5 = ReactPageOcclusion.useCallback(
        (input: Element | null) => {
          ref3.current = input;
          callback2();
        },
        [callback2],
      );
    ReactPageOcclusion.useEffect(() => {
      ref5.current = {
        band: band,
        presenting: presenting,
        speaks: speaksForPage,
      };
      if (ref4.current === null) {
        callback2();
      }
      callback();
    }, [band, presenting, speaksForPage, settle, callback2, callback]);
    ReactPageOcclusion.useEffect(() => {
      if (!speaksForPage) {
        return;
      }
      let value =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(callback);
      value?.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-mode", "class", "style"],
      });
      let value2 =
        typeof matchMedia === "function"
          ? matchMedia("(prefers-color-scheme: dark)")
          : null;
      if (typeof value2?.addEventListener === "function") {
        value2.addEventListener("change", callback);
      }
      return () => {
        value?.disconnect();
        if (typeof value2?.removeEventListener === "function") {
          value2.removeEventListener("change", callback);
        }
      };
    }, [speaksForPage, callback]);
    ReactPageOcclusion.useEffect(
      () => () => {
        ref4.current?.disconnect();
        ref4.current = null;
        if (ref5.current.speaks) {
          (0, runtime.setHostFootState)(null);
        }
      },
      [],
    );
    return {
      stage: callback3,
      canvasView: callback4,
      groundProbe: callback5,
    };
  }
  bindRuntimeValue(
    runtime,
    "ReactPageOcclusion",
    () => ReactPageOcclusion,
    (value) => {
      ReactPageOcclusion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calculatePageOcclusionBottom",
    () => calculatePageOcclusionBottom,
  );
  bindRuntimeValue(
    runtime,
    "PageOcclusionReporter",
    () => PageOcclusionReporter,
  );
  return () => {
    (0, runtime.initializeExternalLinks)();
    ReactPageOcclusion = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
  };
}
