/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  SelectionToolbarOptions,
} from "../contracts/composition";
export function installUiSelectionToolbar(
  runtime: RuntimeBindings,
): () => void {
  var reactSelectionToolbar: ReactNamespace;
  var HIDDEN_SELECTION_TOOLBAR_STYLE: React.CSSProperties;
  function useSelectionToolbar(
    containerRef: React.RefObject<HTMLElement | null>,
    options: SelectionToolbarOptions = {},
  ) {
    let {
        gap = 8,
        holdWhileFocusIn: holdWhileFocusIn,
        enabled = true,
      } = options,
      stripRef = reactSelectionToolbar.useRef<HTMLElement | null>(null),
      rangeRef = reactSelectionToolbar.useRef<Range | null>(null),
      [selectionRect, setSelectionRect] =
        reactSelectionToolbar.useState<DOMRect | null>(null),
      [style, setStyle] = reactSelectionToolbar.useState(
        HIDDEN_SELECTION_TOOLBAR_STYLE,
      ),
      [placed, setPlaced] = reactSelectionToolbar.useState<"above" | "below">(
        "above",
      ),
      [stripWidth, setStripWidth] = reactSelectionToolbar.useState(0),
      refreshSelection = reactSelectionToolbar.useCallback(() => {
        let current = containerRef.current;
        if (!enabled || current === null) {
          return setSelectionRect(null);
        }
        let value = holdWhileFocusIn?.current;
        if (
          value != null &&
          value.contains(current.ownerDocument.activeElement)
        ) {
          let current2 = rangeRef.current;
          if (current2 !== null) {
            setSelectionRect(current2.getBoundingClientRect());
          }
          return;
        }
        let value2 = current.ownerDocument.getSelection();
        if (value2 === null || value2.rangeCount === 0 || value2.isCollapsed) {
          return setSelectionRect(null);
        }
        let value3 = value2.getRangeAt(0);
        if (
          !current.contains(value3.startContainer) ||
          !current.contains(value3.endContainer)
        ) {
          return setSelectionRect(null);
        }
        let bounds = value3.getBoundingClientRect();
        if (bounds.width === 0 && bounds.height === 0) {
          return setSelectionRect(null);
        }
        rangeRef.current = value3.cloneRange();
        setSelectionRect(bounds);
      }, [containerRef, enabled, holdWhileFocusIn]);
    reactSelectionToolbar.useEffect(() => {
      if (!enabled) {
        return setSelectionRect(null);
      }
      let value = containerRef.current?.ownerDocument ?? document,
        value2 = value.defaultView ?? window;
      value.addEventListener("selectionchange", refreshSelection);
      value2.addEventListener("scroll", refreshSelection, {
        capture: true,
        passive: true,
      });
      value2.addEventListener("resize", refreshSelection);
      return () => {
        value.removeEventListener("selectionchange", refreshSelection);
        value2.removeEventListener("scroll", refreshSelection, {
          capture: true,
        });
        value2.removeEventListener("resize", refreshSelection);
      };
    }, [containerRef, enabled, refreshSelection]);
    reactSelectionToolbar.useEffect(() => {
      let current = stripRef.current;
      if (current === null || typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(() =>
        setStripWidth(current.offsetWidth),
      );
      observer.observe(current);
      return () => observer.disconnect();
    }, []);
    reactSelectionToolbar.useLayoutEffect(() => {
      if (selectionRect === null) {
        return setStyle(HIDDEN_SELECTION_TOOLBAR_STYLE);
      }
      let current = stripRef.current,
        value = current?.offsetWidth ?? 0,
        value2 = current?.offsetHeight ?? 0,
        value3 =
          containerRef.current?.ownerDocument.documentElement.clientWidth ??
          window.innerWidth,
        value4 = selectionRect.left + selectionRect.width / 2 - value / 2;
      value4 = Math.max(8, Math.min(value4, value3 - value - 8));
      let value5 = selectionRect.top - gap - value2 < 8,
        value6 = value5
          ? selectionRect.bottom + gap
          : selectionRect.top - gap - value2;
      setPlaced(value5 ? "below" : "above");
      setStyle({
        position: "fixed",
        top: Math.round(value6),
        left: Math.round(value4),
      });
    }, [selectionRect, gap, containerRef, stripWidth]);
    return {
      open: selectionRect !== null,
      style: style,
      placed: placed,
      stripRef: stripRef,
      range: () => rangeRef.current,
      refresh: refreshSelection,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactSelectionToolbar",
    () => reactSelectionToolbar,
    (value) => {
      reactSelectionToolbar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HIDDEN_SELECTION_TOOLBAR_STYLE",
    () => HIDDEN_SELECTION_TOOLBAR_STYLE,
    (value) => {
      HIDDEN_SELECTION_TOOLBAR_STYLE = value;
    },
  );
  bindRuntimeValue(runtime, "useSelectionToolbar", () => useSelectionToolbar);
  return () => {
    reactSelectionToolbar = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    HIDDEN_SELECTION_TOOLBAR_STYLE = {
      position: "fixed",
      top: 0,
      left: 0,
      visibility: "hidden",
      pointerEvents: "none",
    };
  };
}
