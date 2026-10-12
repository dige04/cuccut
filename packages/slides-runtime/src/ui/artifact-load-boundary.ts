/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { ClassNameInput } from "./property-icons";

/** Load phase reported by a document; "cached" and others count as live here. */
export type ArtifactLoadPhase = "loading" | "failed" | "live";

/** The slice of the artifact document the load boundary observes. */
export interface ArtifactLoadBoundaryDocument {
  loadState?: () => string;
  subscribeLoad?: (listener: () => void) => (() => void) | void;
  save?: () => void;
}

export interface ArtifactClassNameProps {
  className?: ClassNameInput;
}

export interface ArtifactLoadBoundaryProps {
  doc: ArtifactLoadBoundaryDocument;
  skeleton?: ReactNode;
  /** When true a custom skeleton is flush with the top, without the toolbar overlay padding. */
  skeletonFlush?: boolean;
  children?: ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactGQ: ReactNamespace;
    jsxX1: JsxNamespace;
    ArtifactSkeleton: (props: ArtifactClassNameProps) => ReactElement;
    ArtifactLoadingSpinner: (props: ArtifactClassNameProps) => ReactElement;
    ARTIFACT_LOAD_FAILURE_MESSAGE: string;
    ARTIFACT_LOAD_DELAY_MS: number;
    ArtifactLoadBoundary: (props: ArtifactLoadBoundaryProps) => ReactElement;
  }
}

export function installUiArtifactLoadBoundary(
  runtime: RuntimeBindings,
): () => void {
  var reactGQ: ReactNamespace;
  var jsxX1: JsxNamespace;
  var ARTIFACT_LOAD_FAILURE_MESSAGE: string;
  var ARTIFACT_LOAD_DELAY_MS: number;
  function ArtifactSkeleton({
    className: className,
  }: ArtifactClassNameProps): ReactElement {
    return jsxX1.jsx("span", {
      "aria-hidden": "true",
      className: "contents",
      children: jsxX1.jsx(runtime.SkeletonPrimitive, {
        className: (0, runtime.joinClassNames)("block", className),
      }),
    });
  }
  function ArtifactLoadingSpinner({
    className: className,
  }: ArtifactClassNameProps): ReactElement {
    return jsxX1.jsx("span", {
      className: (0, runtime.joinClassNames)("inline-flex", className),
      children: jsxX1.jsx(runtime.Spinner, {
        label: "Loading",
      }),
    });
  }
  function ArtifactLoadBoundary({
    doc: doc,
    skeleton: skeleton,
    skeletonFlush: skeletonFlush,
    children: children,
  }: ArtifactLoadBoundaryProps): ReactElement {
    let callback = (): ArtifactLoadPhase => {
        let value5 =
          typeof doc.loadState === "function" ? doc.loadState() : "live";
        if (value5 === "loading" || value5 === "failed") {
          return value5;
        } else {
          return "live";
        }
      },
      [value, value2] = reactGQ.useState(callback),
      [value3, value4] = reactGQ.useState(""),
      ref = reactGQ.useRef<HTMLElement | null>(null),
      ref2 = reactGQ.useRef(false),
      ref3 = reactGQ.useRef(true);
    reactGQ.useEffect(() => {
      ref2.current = false;
      ref3.current = true;
      value2(callback());
      return doc.subscribeLoad?.(() => {
        let value5 = callback();
        if (value5 === "loading" && ref.current !== null) {
          ref2.current = document.activeElement === ref.current;
        }
        value2(value5);
      });
    }, [doc]);
    reactGQ.useEffect(() => {
      if (value !== "failed") {
        if (value === "live") {
          ref2.current = false;
          ref3.current = true;
        }
        value4("");
        return;
      }
      let activeElement = document.activeElement,
        value5 =
          document.hasFocus() &&
          (activeElement === null ||
            activeElement === document.body ||
            activeElement === document.documentElement);
      if (ref2.current && value5) {
        ref.current?.focus({
          preventScroll: true,
        });
      }
      if (!ref3.current) {
        return;
      }
      let value6 = setTimeout(() => {
          ref3.current = false;
          value4(ARTIFACT_LOAD_FAILURE_MESSAGE);
        }, ARTIFACT_LOAD_DELAY_MS),
        value7 = setTimeout(
          () => value4(""),
          ARTIFACT_LOAD_DELAY_MS + runtime.ANNOUNCEMENT_CLEAR_MS,
        );
      return () => {
        clearTimeout(value6);
        clearTimeout(value7);
      };
    }, [value]);
    if (value === "live") {
      return jsxX1.jsx(jsxX1.Fragment, {
        children: children,
      });
    }
    return jsxX1.jsxs("div", {
      className: (0, runtime.joinClassNames)(
        "mc-loadgate relative h-full min-h-40 w-full",
        !(skeletonFlush && skeleton != null) && "pt-[var(--tb-overlay-h,0px)]",
      ),
      "aria-busy": value === "loading",
      children: [
        skeleton ??
          jsxX1.jsx(ArtifactSkeleton, {
            className: "m-6 h-48 rounded-lg",
          }),
        jsxX1.jsx("span", {
          className: "sr-only",
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "true",
          "data-kit": "load-status",
          children: value3,
        }),
        jsxX1.jsx("div", {
          className:
            "pointer-events-none absolute inset-x-0 top-[calc(var(--tb-overlay-h,0px)+1rem)] flex justify-center",
          children:
            value === "loading"
              ? jsxX1.jsx(ArtifactLoadingSpinner, {})
              : jsxX1.jsxs("span", {
                  className:
                    "pointer-events-auto inline-flex items-center gap-2 rounded-md border border-border-line bg-panel px-3 py-1.5 text-xs text-fg-muted shadow-sm",
                  children: [
                    ARTIFACT_LOAD_FAILURE_MESSAGE,
                    jsxX1.jsx(runtime.TextLink, {
                      ref: ref,
                      onClick: () => {
                        ref3.current = true;
                        doc.save?.();
                      },
                      children: "Retry",
                    }),
                  ],
                }),
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactGQ",
    () => reactGQ,
    (value) => {
      reactGQ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxX1",
    () => jsxX1,
    (value) => {
      jsxX1 = value;
    },
  );
  bindRuntimeValue(runtime, "ArtifactSkeleton", () => ArtifactSkeleton);
  bindRuntimeValue(
    runtime,
    "ArtifactLoadingSpinner",
    () => ArtifactLoadingSpinner,
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_LOAD_FAILURE_MESSAGE",
    () => ARTIFACT_LOAD_FAILURE_MESSAGE,
    (value) => {
      ARTIFACT_LOAD_FAILURE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_LOAD_DELAY_MS",
    () => ARTIFACT_LOAD_DELAY_MS,
    (value) => {
      ARTIFACT_LOAD_DELAY_MS = value;
    },
  );
  bindRuntimeValue(runtime, "ArtifactLoadBoundary", () => ArtifactLoadBoundary);
  return () => {
    (0, runtime.initializeNumberScrubNoop)();
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiAnnouncements)();
    reactGQ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxX1 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    ARTIFACT_LOAD_FAILURE_MESSAGE = "The latest content failed to load";
    ARTIFACT_LOAD_DELAY_MS = 100;
  };
}
