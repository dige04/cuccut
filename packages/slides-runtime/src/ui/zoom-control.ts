/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { CommandHistory } from "../editor/command-history";

/** Scale limits reported by a zoomable surface, with optional explanations. */
export interface ZoomLimits {
  minScale?: number | null;
  maxScale?: number | null;
  /** Why the zoom cannot go lower. */
  minTip?: string;
  /** Why the zoom cannot go higher. */
  maxTip?: string;
}

/** A checkbox row appended to the zoom menu. */
export interface ZoomViewToggle {
  label: string;
  checked: boolean;
  shortcut?: string;
  describedBy?: string;
  onToggle: () => void;
}

/** The slice of the command history the zoom menu drives. */
export type ZoomMenuHistory = Pick<
  CommandHistory,
  "canUndo" | "canRedo" | "undo" | "redo"
>;

export interface ZoomControlProps {
  /** Current scale where 1 is 100%. */
  getScale: () => number;
  onPickScale: (scale: number) => void;
  onFit: () => void;
  getLimits?: () => ZoomLimits;
  fitLabel?: string;
  tip?: string;
  disabled?: boolean;
  disabledTip?: string;
  tipSide?: "top" | "bottom" | "left" | "right";
  "data-testid"?: string;
  /** Show the percentage readout instead of the fit icon. */
  readout?: boolean;
  /** Subscribes to scale changes; returns the unsubscribe function. */
  subscribeScale?: (listener: (scale: number) => void) => () => void;
  /** Step the zoom in (1) or out (-1). */
  onStepZoom?: (direction: 1 | -1) => void;
  undo?: ZoomMenuHistory;
  zoomRowsDisabled?: boolean;
  zoomRowsDisabledTip?: string;
  viewToggles?: readonly ZoomViewToggle[];
}

export interface ZoomLimitMessages {
  below: string;
  above: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactRF: ReactNamespace;
    jsxh6: JsxNamespace;
    ZOOM_PRESETS: readonly [0.25, 0.5, 0.75, 1, 1.5, 2];
    ZOOM_LIMIT_MESSAGES: ZoomLimitMessages;
    fitZoomIcon: ReactElement;
    isValidZoomScale: (scale: number) => number;
    ZoomControl: (props: ZoomControlProps) => ReactElement;
  }
}

export function installUiZoomControl(runtime: RuntimeBindings): () => void {
  var reactRF: ReactNamespace;
  var jsxh6: JsxNamespace;
  var ZOOM_PRESETS: readonly [0.25, 0.5, 0.75, 1, 1.5, 2];
  var ZOOM_LIMIT_MESSAGES: ZoomLimitMessages;
  var fitZoomIcon: ReactElement;
  var isValidZoomScale: (scale: number) => number;
  function ZoomControl({
    getScale: getScale,
    onPickScale: onPickScale,
    onFit: onFit,
    getLimits: getLimits,
    fitLabel = "Fit",
    tip = "Zoom",
    disabled = false,
    disabledTip: disabledTip,
    tipSide: tipSide,
    "data-testid": dataTestid = "mc-zoom",
    readout = false,
    subscribeScale: subscribeScale,
    onStepZoom: onStepZoom,
    undo: undo,
    zoomRowsDisabled = false,
    zoomRowsDisabledTip: zoomRowsDisabledTip,
    viewToggles = [],
  }: ZoomControlProps): ReactElement {
    let [value, value2] = reactRF.useState(1),
      [value3, value4] = reactRF.useState(
        () => (readout ? getScale() : 1),
      ),
      ref = reactRF.useRef(false);
    reactRF.useLayoutEffect(() => {
      if (!readout || subscribeScale === undefined) {
        return;
      }
      return subscribeScale((input: number) => {
        value4(input);
        if (ref.current) {
          value2(input);
          value6(getLimits?.() ?? {});
        }
      });
    }, [readout, subscribeScale]);
    let [value5, value6] = reactRF.useState<ZoomLimits>({}),
      value7 = isValidZoomScale(value),
      value8 =
        value5.minScale == null ? -1 / 0 : Math.round(value5.minScale * 100),
      value9 =
        value5.maxScale == null ? 1 / 0 : Math.round(value5.maxScale * 100),
      callback = (input: boolean) => {
        ref.current = input;
        if (!input) {
          return;
        }
        value2(getScale());
        value6(getLimits?.() ?? {});
      },
      value10 =
        typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad/.test(navigator.platform),
      callback2 = (input: string) =>
        jsxh6.jsx("span", {
          "aria-hidden": "true",
          className: "pointer-coarse:hidden text-footnote text-muted",
          children: input,
        }),
      value11 =
        zoomRowsDisabledTip === undefined
          ? undefined
          : zoomRowsDisabled
            ? zoomRowsDisabledTip
            : null,
      value12 = jsxh6.jsxs(jsxh6.Fragment, {
        children: [
          onStepZoom !== undefined
            ? jsxh6.jsxs(jsxh6.Fragment, {
                children: [
                  jsxh6.jsx(runtime.Menu.Item, {
                    disabled: zoomRowsDisabled || value7 >= value9,
                    disabledReason: value11,
                    trailing: callback2(value10 ? "⌘+" : "Ctrl +"),
                    "aria-keyshortcuts": value10 ? "Meta+=" : "Control+=",
                    onClick: () => onStepZoom(1),
                    children: "Zoom in",
                  }),
                  jsxh6.jsx(runtime.Menu.Item, {
                    disabled: zoomRowsDisabled || value7 <= value8,
                    disabledReason: value11,
                    trailing: callback2(value10 ? "⌘−" : "Ctrl −"),
                    "aria-keyshortcuts": value10 ? "Meta+-" : "Control+-",
                    onClick: () => onStepZoom(-1),
                    children: "Zoom out",
                  }),
                ],
              })
            : null,
          jsxh6.jsx(runtime.Menu.Item, {
            disabled: zoomRowsDisabled,
            disabledReason: value11,
            onClick: onFit,
            children: fitLabel,
          }),
          jsxh6.jsx(runtime.Menu.Separator, {}),
          jsxh6.jsxs(runtime.Menu.Group, {
            children: [
              ZOOM_PRESETS.every(
                (input: number) =>
                  Math.round(input * 100) !== value7,
              )
                ? jsxh6.jsx(runtime.Menu.GroupLabel, {
                    children: jsxh6.jsxs("span", {
                      className: "tabular-nums",
                      children: ["Now ", value7, "%"],
                    }),
                  })
                : null,
              ZOOM_PRESETS.map((input: number) => {
                let value13 = Math.round(input * 100),
                  value14 =
                    value13 < value8
                      ? "below"
                      : value13 > value9
                        ? "above"
                        : null,
                  value15 = zoomRowsDisabled
                    ? (value11 ?? null)
                    : value14 === null
                      ? null
                      : value14 === "below"
                        ? (value5.minTip ?? ZOOM_LIMIT_MESSAGES.below)
                        : (value5.maxTip ?? ZOOM_LIMIT_MESSAGES.above);
                return jsxh6.jsxs(
                  runtime.Menu.Item,
                  {
                    checkedRole: "radio",
                    checked: value13 === value7,
                    disabled: zoomRowsDisabled || value14 !== null,
                    disabledReason: value15,
                    onClick: () => onPickScale(input),
                    children: [value13, "%"],
                  },
                  input,
                );
              }),
            ],
          }),
          viewToggles.length > 0
            ? jsxh6.jsxs(jsxh6.Fragment, {
                children: [
                  jsxh6.jsx(runtime.Menu.Separator, {}),
                  viewToggles.map(
                    (input: ZoomViewToggle) =>
                      jsxh6.jsx(
                        runtime.Menu.Item,
                        {
                          checkedRole: "checkbox",
                          checked: input.checked,
                          shortcut: input.shortcut,
                          "aria-describedby": input.describedBy,
                          onClick: input.onToggle,
                          children: input.label,
                        },
                        input.label,
                      ),
                  ),
                ],
              })
            : null,
          undo !== undefined
            ? jsxh6.jsxs(jsxh6.Fragment, {
                children: [
                  jsxh6.jsx(runtime.Menu.Separator, {}),
                  jsxh6.jsx(runtime.Menu.Item, {
                    disabled: !undo.canUndo(),
                    disabledReason: "Nothing to undo yet",
                    shortcut: "cmd+z",
                    onClick: () => undo.undo(),
                    children: "Undo",
                  }),
                  jsxh6.jsx(runtime.Menu.Item, {
                    disabled: !undo.canRedo(),
                    disabledReason: "Nothing to redo",
                    shortcut: "shift+cmd+z",
                    onClick: () => undo.redo(),
                    children: "Redo",
                  }),
                ],
              })
            : null,
        ],
      });
    if (readout) {
      return jsxh6.jsx(runtime.ToolbarPopover, {
        readout: String(isValidZoomScale(value3)) + "%",
        readoutSizer: "100%",
        label: "Zoom",
        tip: tip,
        disabled: disabled,
        disabledTip: disabledTip,
        side: tipSide,
        "data-testid": dataTestid,
        onOpenChange: callback,
        children: value12,
      });
    } else {
      return jsxh6.jsx(runtime.ToolbarPopover, {
        glyph: fitZoomIcon,
        iconOnly: true,
        label: "Zoom",
        tip: tip,
        disabled: disabled,
        disabledTip: disabledTip,
        side: tipSide,
        "data-testid": dataTestid,
        onOpenChange: callback,
        children: value12,
      });
    }
  }
  bindRuntimeValue(
    runtime,
    "reactRF",
    () => reactRF,
    (value) => {
      reactRF = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxh6",
    () => jsxh6,
    (value) => {
      jsxh6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ZOOM_PRESETS",
    () => ZOOM_PRESETS,
    (value) => {
      ZOOM_PRESETS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ZOOM_LIMIT_MESSAGES",
    () => ZOOM_LIMIT_MESSAGES,
    (value) => {
      ZOOM_LIMIT_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fitZoomIcon",
    () => fitZoomIcon,
    (value) => {
      fitZoomIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidZoomScale",
    () => isValidZoomScale,
    (value) => {
      isValidZoomScale = value;
    },
  );
  bindRuntimeValue(runtime, "ZoomControl", () => ZoomControl);
  return () => {
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiPropertyIcons)();
    reactRF = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxh6 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2];
    ZOOM_LIMIT_MESSAGES = {
      below: "Below the zoom limit — that's as far out as it goes",
      above: "Past the zoom limit — that's as far in as it goes",
    };
    fitZoomIcon = jsxh6.jsx(runtime.ZoomInIcon, {});
    isValidZoomScale = (scale: number) =>
      Number.isFinite(scale) && scale > 0
        ? Math.max(1, Math.round(scale * 100))
        : 100;
  };
}
