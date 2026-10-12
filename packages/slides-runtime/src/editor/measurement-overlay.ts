/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** Edges of a measured box in slide units. */
export interface MeasureBox {
  l: number;
  t: number;
  r: number;
  b: number;
}
/** One distance guide segment; `ext` marks a dashed extension line. */
export interface MeasureLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ext?: 1;
}
/** One distance readout placed on the axis it measures. */
export interface MeasureLabel {
  x: number;
  y: number;
  text: string;
  axis: "x" | "y";
}
/** Guides and readouts between a selected box and a reference box. */
export interface DistanceMeasurements {
  lines: MeasureLine[];
  labels: MeasureLabel[];
}
export interface MeasureOverlayProps {
  m: DistanceMeasurements;
  scale: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxlH: JsxNamespace;
    measureDistances: (
      selected: MeasureBox,
      reference: MeasureBox,
      scale: number,
    ) => DistanceMeasurements;
    MeasureOverlay: (props: MeasureOverlayProps) => ReactElement;
  }
}

export function installEditorMeasurementOverlay(
  runtime: RuntimeBindings,
): () => void {
  var jsxlH: JsxNamespace;
  function measureDistances(
    selected: MeasureBox,
    reference: MeasureBox,
    scale: number,
  ): DistanceMeasurements {
    let state: DistanceMeasurements = {
        lines: [],
        labels: [],
      },
      value = scale > 0 && isFinite(scale) ? scale : 1,
      count = 0.01,
      callback = (input: MeasureBox, options: MeasureBox): boolean =>
        options.l <= input.l + 0.01 &&
        options.t <= input.t + 0.01 &&
        options.r >= input.r - 0.01 &&
        options.b >= input.b - 0.01;
    if (callback(reference, selected)) {
      let value7 = selected;
      selected = reference;
      reference = value7;
    }
    let value2 = callback(selected, reference),
      callback2 = (
        input: number,
        options: number,
        context: number,
        value7: number,
      ): number | null => {
        let value8 = Math.max(input, context),
          value9 = Math.min(options, value7);
        if (value9 > value8) {
          return (value8 + value9) / 2;
        } else {
          return null;
        }
      },
      callback3 = (
        input: "x" | "y",
        options: number,
        context: number,
        value7: number,
        extra: number,
        detail: number,
      ): void => {
        let value8 = Math.round(Math.abs(context - options) / value);
        if (value8 < 1) {
          return;
        }
        let value9 = String(value8);
        if (input === "x") {
          state.lines.push({
            x1: Math.min(options, context),
            y1: value7,
            x2: Math.max(options, context),
            y2: value7,
          });
          state.labels.push({
            x: (options + context) / 2,
            y: value7,
            text: value9,
            axis: input,
          });
          if (value7 < extra) {
            state.lines.push({
              x1: context,
              y1: value7,
              x2: context,
              y2: extra,
              ext: 1,
            });
          } else if (value7 > detail) {
            state.lines.push({
              x1: context,
              y1: detail,
              x2: context,
              y2: value7,
              ext: 1,
            });
          }
        } else if (
          (state.lines.push({
            x1: value7,
            y1: Math.min(options, context),
            x2: value7,
            y2: Math.max(options, context),
          }),
          state.labels.push({
            x: value7,
            y: (options + context) / 2,
            text: value9,
            axis: input,
          }),
          value7 < extra)
        ) {
          state.lines.push({
            x1: value7,
            y1: context,
            x2: extra,
            y2: context,
            ext: 1,
          });
        } else if (value7 > detail) {
          state.lines.push({
            x1: detail,
            y1: context,
            x2: value7,
            y2: context,
            ext: 1,
          });
        }
      },
      value3 = callback2(
        selected.t,
        selected.b,
        reference.t,
        reference.b,
      ),
      value4 = value3 == null ? (selected.t + selected.b) / 2 : value3,
      value5 = callback2(
        selected.l,
        selected.r,
        reference.l,
        reference.r,
      ),
      value6 = value5 == null ? (selected.l + selected.r) / 2 : value5;
    if (value2) {
      callback3("x", selected.l, reference.l, value4, reference.t, reference.b);
      callback3("x", selected.r, reference.r, value4, reference.t, reference.b);
      callback3("y", selected.t, reference.t, value6, reference.l, reference.r);
      callback3("y", selected.b, reference.b, value6, reference.l, reference.r);
      return state;
    }
    if (reference.r <= selected.l) {
      callback3("x", selected.l, reference.r, value4, reference.t, reference.b);
    } else if (reference.l >= selected.r) {
      callback3("x", selected.r, reference.l, value4, reference.t, reference.b);
    }
    if (reference.b <= selected.t) {
      callback3("y", selected.t, reference.b, value6, reference.l, reference.r);
    } else if (reference.t >= selected.b) {
      callback3("y", selected.b, reference.t, value6, reference.l, reference.r);
    }
    return state;
  }
  function MeasureOverlay({
    m: m,
    scale: scale,
  }: MeasureOverlayProps): ReactElement {
    return jsxlH.jsxs(jsxlH.Fragment, {
      children: [
        jsxlH.jsx("svg", {
          "data-testid": "measure-overlay",
          "aria-hidden": "true",
          style: {
            position: "absolute",
            left: 0,
            top: 0,
            overflow: "visible",
            pointerEvents: "none",
          },
          width: 1,
          height: 1,
          children: m.lines.map(
            (input: MeasureLine, options: number): ReactElement =>
              jsxlH.jsx(
                "line",
                {
                  x1: input.x1,
                  y1: input.y1,
                  x2: input.x2,
                  y2: input.y2,
                  style: {
                    stroke: "var(--t-measure)",
                    strokeWidth: 1 / scale,
                    strokeDasharray: input.ext
                      ? String(3 / scale) + " " + String(3 / scale)
                      : undefined,
                    opacity: input.ext ? 0.6 : 1,
                  },
                },
                "ml" + String(options),
              ),
          ),
        }),
        m.labels.map(
          (input: MeasureLabel, options: number): ReactElement =>
            jsxlH.jsx(
              "div",
              {
                "data-testid": "measure-label",
                "aria-hidden": "true",
                style: {
                  position: "absolute",
                  left: input.x,
                  top: input.y,
                  transform:
                    input.axis === "x"
                      ? "translate(-50%, " + String(5 / scale) + "px)"
                      : "translate(" + String(5 / scale) + "px, -50%)",
                  background: "var(--t-measure)",
                  color: "#FFFFFF",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 11 / scale,
                  lineHeight: 1.4,
                  fontVariantNumeric: "tabular-nums",
                  padding: String(1 / scale) + "px " + String(5 / scale) + "px",
                  borderRadius: 4 / scale,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                },
                children: input.text,
              },
              "mt" + String(options),
            ),
        ),
      ],
    });
  }
  bindRuntimeValue(runtime, "measureDistances", () => measureDistances);
  bindRuntimeValue(
    runtime,
    "jsxlH",
    () => jsxlH,
    (value) => {
      jsxlH = value;
    },
  );
  bindRuntimeValue(runtime, "MeasureOverlay", () => MeasureOverlay);
  return () => {
    (0, runtime.initializeImageCrop)();
    jsxlH = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
