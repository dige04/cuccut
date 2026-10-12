/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";
import type { SnapCandidate, SnapRect } from "../layout/snapping";

/** A resize handle position on a selection: `null` is the middle of that axis. */
export interface SelectionHandle {
  x: "left" | "right" | null;
  y: "top" | "bottom" | null;
}
/** Which handles a selection shows: a preset or an explicit list. */
export type SelectionHandleSet = "corners" | "all" | "none" | readonly SelectionHandle[];
/** Visual state of a selection outline. */
export type SelectionState = "selected" | "hover" | "member";
/** Whether the selection belongs to an ordinary object or a component. */
export type SelectionVariant = "object" | "component";
/** Palette slot of a collaborator selection (1 to 6). */
export type CollaboratorIndex = 1 | 2 | 3 | 4 | 5 | 6;
/** Rectangle a selection is drawn around, in slide coordinates. */
export type SelectionFrame = SnapRect;
/** Pixel sizes shared by selection rings, grips and guides. */
export interface SelectionMetrics {
  ring: number;
  ringHover: number;
  ringMember: number;
  ringCollaborator: number;
  grip: number;
  gripRadius: number;
  guide: number;
}
/** `data-*` attributes accepted by components that pass their props through to the DOM. */
export interface DataAttributeProps {
  [attribute: `data-${string}`]: string | undefined;
}
/** Position of a selection label: pixels or CSS lengths. */
export interface SelectionLabelPosition {
  left: number | string;
  top: number | string;
}
export interface SelectionOutlineOptions {
  frame: SelectionFrame;
  scale: number;
  rotation?: number;
  stroke: number;
  collaborator?: CollaboratorIndex;
  variant?: SelectionVariant;
}
export interface SelectionGripProps {
  stroke?: number;
  disabled?: boolean;
  variant?: SelectionVariant;
}
export interface SelectionLabelProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "style" | "className">,
    DataAttributeProps {
  scale: number;
  rotation?: number;
  at: SelectionLabelPosition;
  anchor?: "center" | "start";
  variant?: SelectionVariant;
}
/** A snap guide line drawn over the canvas. */
export type AlignmentGuide = Pick<SnapCandidate, "axis" | "pos" | "label">;
export interface AlignmentGuidesProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    DataAttributeProps {
  guides: readonly AlignmentGuide[];
  scale?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxForUiEditorSelection: JsxNamespace;
    reactForUiEditorSelection: ReactNamespace;
    jsxForUiEditorSelection2: JsxNamespace;
    equalSelectionPoint: (left: SelectionHandle, right: SelectionHandle) => boolean;
    selectionHandlePositions: (
      handles?: SelectionHandleSet,
      state?: SelectionState,
      collaborator?: CollaboratorIndex,
    ) => readonly SelectionHandle[];
    validSelectionScale: (scale: number) => number;
    selectionHandleCssPosition: (point: SelectionHandle) => { left: string; top: string };
    finiteSelectionRotation: (rotation?: number) => number;
    selectionRingWidth: (state?: SelectionState, collaborator?: CollaboratorIndex) => number;
    collaboratorSelectionIndex: (index?: number) => CollaboratorIndex | undefined;
    collaboratorSelectionColor: (index?: number) => string | undefined;
    SelectionOutline: (options: SelectionOutlineOptions) => React.CSSProperties;
    SelectionGrip: (props: SelectionGripProps) => React.ReactElement;
    SelectionLabel: (props: SelectionLabelProps) => React.ReactElement;
    SELECTION_METRICS: SelectionMetrics;
    ALL_SELECTION_HANDLES: SelectionHandle[];
    CORNER_SELECTION_HANDLES: SelectionHandle[];
    EDGE_SELECTION_HANDLES: SelectionHandle[];
    SELECTION_OUTLINE_CLASS: string;
    ROTATION_HANDLE_POSITION: SelectionLabelPosition;
    initializeUiEditorSelection: () => void;
    initializeUiEditorSelection2: () => void;
    AlignmentGuides: React.ForwardRefExoticComponent<
      AlignmentGuidesProps & React.RefAttributes<HTMLDivElement>
    >;
  }
}

export function installUiEditorSelection(runtime: RuntimeBindings): () => void {
  var jsxForUiEditorSelection: JsxNamespace;
  var SELECTION_METRICS: SelectionMetrics;
  var ALL_SELECTION_HANDLES: SelectionHandle[];
  var CORNER_SELECTION_HANDLES: SelectionHandle[];
  var EDGE_SELECTION_HANDLES: SelectionHandle[];
  var SELECTION_OUTLINE_CLASS: string;
  var ROTATION_HANDLE_POSITION: SelectionLabelPosition;
  var initializeUiEditorSelection: () => void;
  var reactForUiEditorSelection: ReactNamespace;
  var jsxForUiEditorSelection2: JsxNamespace;
  var AlignmentGuides: RuntimeBindings["AlignmentGuides"];
  var initializeUiEditorSelection2: () => void;
  function equalSelectionPoint(left: SelectionHandle, right: SelectionHandle): boolean {
    return left.x === right.x && left.y === right.y;
  }
  function selectionHandlePositions(
    handles?: SelectionHandleSet,
    variant?: SelectionState,
    collaborator?: CollaboratorIndex,
  ): readonly SelectionHandle[] {
    if (collaborator !== undefined) {
      return [];
    }
    if (handles === undefined) {
      if (variant === "selected") {
        return CORNER_SELECTION_HANDLES;
      } else {
        return [];
      }
    }
    if (handles === "corners") {
      return CORNER_SELECTION_HANDLES;
    }
    if (handles === "all") {
      return ALL_SELECTION_HANDLES;
    }
    if (handles === "none") {
      return [];
    }
    return ALL_SELECTION_HANDLES.filter((input: SelectionHandle): boolean =>
      handles.some(
        (input2: SelectionHandle): boolean => equalSelectionPoint(input2, input),
      ),
    );
  }
  function validSelectionScale(scale: number): number {
    if (Number.isFinite(scale) && scale > 0) {
      return scale;
    } else {
      return 1;
    }
  }
  function selectionHandleCssPosition(point: SelectionHandle): { left: string; top: string } {
    return {
      left: point.x === "left" ? "0%" : point.x === "right" ? "100%" : "50%",
      top: point.y === "top" ? "0%" : point.y === "bottom" ? "100%" : "50%",
    };
  }
  function finiteSelectionRotation(rotation?: number): number {
    if (rotation !== undefined && Number.isFinite(rotation)) {
      return rotation;
    } else {
      return 0;
    }
  }
  function selectionRingWidth(
    variant?: SelectionState,
    collaborator?: CollaboratorIndex,
  ): number {
    if (collaborator !== undefined) {
      return SELECTION_METRICS.ringCollaborator;
    }
    if (variant === "hover") {
      return SELECTION_METRICS.ringHover;
    }
    if (variant === "member") {
      return SELECTION_METRICS.ringMember;
    }
    return SELECTION_METRICS.ring;
  }
  function collaboratorSelectionIndex(index?: number): CollaboratorIndex | undefined {
    if (
      index !== undefined &&
      Number.isInteger(index) &&
      index >= 1 &&
      index <= 6
    ) {
      return index as CollaboratorIndex;
    } else {
      return undefined;
    }
  }
  function collaboratorSelectionColor(index?: number): string | undefined {
    let value = collaboratorSelectionIndex(index);
    if (value === undefined) {
      return undefined;
    } else {
      return runtime.designTokens.editor.collaborator[value].cssVar;
    }
  }
  function SelectionOutline({
    frame: frame,
    scale: scale,
    rotation: rotation,
    stroke: stroke,
    collaborator: collaborator,
    variant: variant,
  }: SelectionOutlineOptions): React.CSSProperties {
    let value = finiteSelectionRotation(rotation),
      value2 =
        value === 0
          ? ""
          : `translate(${frame.w / 2}px, ${frame.h / 2}px) rotate(${value}rad) translate(${-frame.w / 2}px, ${-frame.h / 2}px) `,
      state: React.CSSProperties = {
        position: "absolute",
        left: 0,
        top: 0,
        width: frame.w * scale,
        height: frame.h * scale,
        transformOrigin: "0 0",
        transform: `translate(${frame.x}px, ${frame.y}px) ${value2}scale(${1 / scale})`,
        outlineWidth: stroke,
        outlineStyle: "solid",
        outlineOffset: 0,
        pointerEvents: "none",
      },
      value3 = collaboratorSelectionColor(collaborator);
    if (value3 !== undefined) {
      state.outlineColor = value3;
    } else if (variant === "component") {
      state.outlineColor = runtime.designTokens.fill.pro.cssVar;
    }
    return state;
  }
  function SelectionGrip({
    stroke = SELECTION_METRICS.ring,
    disabled: disabled,
    variant: variant,
  }: SelectionGripProps): React.ReactElement {
    let grip = SELECTION_METRICS.grip,
      value = variant === "component",
      value2 = value
        ? runtime.designTokens.on.pro.cssVar
        : runtime.designTokens.on.accent.cssVar,
      value3 = value
        ? runtime.designTokens.fill.pro.cssVar
        : runtime.designTokens.fill.accent.cssVar;
    return jsxForUiEditorSelection.jsx("span", {
      "data-selection-grip": "",
      "data-disabled": disabled ? "" : undefined,
      className: (0, runtime.cn)(
        "absolute left-1/2 top-1/2 box-border block -translate-x-1/2 -translate-y-1/2",
        SELECTION_OUTLINE_CLASS,
      ),
      style: {
        width: grip,
        height: grip,
        borderRadius: SELECTION_METRICS.gripRadius,
        backgroundColor: value2,
        outlineStyle: "solid",
        outlineWidth: stroke,
        outlineOffset: -stroke,
        outlineColor: disabled
          ? `color-mix(in srgb, ${value3} calc(${runtime.designTokens.opacity.disabled.cssVar} * 100%), ${value2})`
          : value
            ? value3
            : undefined,
        pointerEvents: "none",
      },
    });
  }
  function SelectionLabel({
    scale: scale,
    rotation = 0,
    at: at,
    anchor: anchor,
    variant: variant,
    children: children,
    ...remainingProps
  }: SelectionLabelProps): React.ReactElement {
    let value = 1 / scale,
      value2 = finiteSelectionRotation(rotation),
      value3 =
        typeof at.left === "number" && typeof at.top === "number",
      value4 = value3 ? `translate(${at.left}px, ${at.top}px) ` : "";
    return jsxForUiEditorSelection.jsx("span", {
      ...remainingProps,
      "data-variant": variant,
      className: (0, runtime.cn)(
        "absolute block whitespace-nowrap rounded-full font-sans text-caption font-medium",
        variant === "component"
          ? "bg-fill-pro text-on-pro"
          : "bg-fill-accent text-on-accent",
      ),
      style: {
        left: value3 ? 0 : at.left,
        top: value3 ? 0 : at.top,
        padding: "0 6px",
        pointerEvents: "none",
        transformOrigin: anchor === "center" ? "50% 50%" : "0 0",
        transform:
          anchor === "center"
            ? `${value4}translate(-50%, -50%) rotate(${-value2}rad) scale(${value})`
            : `${value4}scale(${value})`,
      },
      children: children,
    });
  }
  bindRuntimeValue(runtime, "equalSelectionPoint", () => equalSelectionPoint);
  bindRuntimeValue(
    runtime,
    "selectionHandlePositions",
    () => selectionHandlePositions,
  );
  bindRuntimeValue(runtime, "validSelectionScale", () => validSelectionScale);
  bindRuntimeValue(
    runtime,
    "selectionHandleCssPosition",
    () => selectionHandleCssPosition,
  );
  bindRuntimeValue(
    runtime,
    "finiteSelectionRotation",
    () => finiteSelectionRotation,
  );
  bindRuntimeValue(runtime, "selectionRingWidth", () => selectionRingWidth);
  bindRuntimeValue(
    runtime,
    "collaboratorSelectionIndex",
    () => collaboratorSelectionIndex,
  );
  bindRuntimeValue(
    runtime,
    "collaboratorSelectionColor",
    () => collaboratorSelectionColor,
  );
  bindRuntimeValue(runtime, "SelectionOutline", () => SelectionOutline);
  bindRuntimeValue(runtime, "SelectionGrip", () => SelectionGrip);
  bindRuntimeValue(runtime, "SelectionLabel", () => SelectionLabel);
  bindRuntimeValue(
    runtime,
    "jsxForUiEditorSelection",
    () => jsxForUiEditorSelection,
    (value) => {
      jsxForUiEditorSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECTION_METRICS",
    () => SELECTION_METRICS,
    (value) => {
      SELECTION_METRICS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ALL_SELECTION_HANDLES",
    () => ALL_SELECTION_HANDLES,
    (value) => {
      ALL_SELECTION_HANDLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CORNER_SELECTION_HANDLES",
    () => CORNER_SELECTION_HANDLES,
    (value) => {
      CORNER_SELECTION_HANDLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDGE_SELECTION_HANDLES",
    () => EDGE_SELECTION_HANDLES,
    (value) => {
      EDGE_SELECTION_HANDLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECTION_OUTLINE_CLASS",
    () => SELECTION_OUTLINE_CLASS,
    (value) => {
      SELECTION_OUTLINE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROTATION_HANDLE_POSITION",
    () => ROTATION_HANDLE_POSITION,
    (value) => {
      ROTATION_HANDLE_POSITION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiEditorSelection",
    () => initializeUiEditorSelection,
    (value) => {
      initializeUiEditorSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiEditorSelection",
    () => reactForUiEditorSelection,
    (value) => {
      reactForUiEditorSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiEditorSelection2",
    () => jsxForUiEditorSelection2,
    (value) => {
      jsxForUiEditorSelection2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AlignmentGuides",
    () => AlignmentGuides,
    (value) => {
      AlignmentGuides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiEditorSelection2",
    () => initializeUiEditorSelection2,
    (value) => {
      initializeUiEditorSelection2 = value;
    },
  );
  return () => {
    SELECTION_OUTLINE_CLASS = "outline-fill-accent";
    initializeUiEditorSelection = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeUiEditorTokens)();
      jsxForUiEditorSelection = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      SELECTION_METRICS = {
        ring: 2,
        ringHover: 1.5,
        ringMember: 1,
        ringCollaborator: 1.5,
        grip: 12,
        gripRadius: 1,
        guide: 1,
      };
      ALL_SELECTION_HANDLES = [
        {
          x: "left",
          y: "top",
        },
        {
          x: null,
          y: "top",
        },
        {
          x: "right",
          y: "top",
        },
        {
          x: "right",
          y: null,
        },
        {
          x: "right",
          y: "bottom",
        },
        {
          x: null,
          y: "bottom",
        },
        {
          x: "left",
          y: "bottom",
        },
        {
          x: "left",
          y: null,
        },
      ];
      CORNER_SELECTION_HANDLES = ALL_SELECTION_HANDLES.filter(
        (input: SelectionHandle): boolean => input.x !== null && input.y !== null,
      );
      EDGE_SELECTION_HANDLES = ALL_SELECTION_HANDLES.filter(
        (input: SelectionHandle): boolean => (input.x === null) !== (input.y === null),
      );
      ROTATION_HANDLE_POSITION = {
        left: "50%",
        top: "calc(100% + 20.5px)",
      };
    });
    initializeUiEditorSelection2 = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeClassNames)();
      initializeUiEditorSelection();
      reactForUiEditorSelection = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiEditorSelection2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      AlignmentGuides = reactForUiEditorSelection.forwardRef(function (
        {
          guides: guides,
          scale = 1,
          className: className,
          style: style,
          ...props
        }: AlignmentGuidesProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement {
        let value = validSelectionScale(scale),
          guide = SELECTION_METRICS.guide,
          value2 = 1 / value;
        return jsxForUiEditorSelection2.jsx("div", {
          ...props,
          ref: options,
          "data-cds": "AlignmentGuides",
          "aria-hidden": "true",
          className: (0, runtime.cn)("absolute inset-0", className),
          style: {
            ...style,
            pointerEvents: "none",
          },
          children: guides.map(
            (input: AlignmentGuide, options2: number): React.ReactElement =>
              jsxForUiEditorSelection2.jsxs(
                "span",
                {
                  "data-axis": input.axis,
                  children: [
                    jsxForUiEditorSelection2.jsx("span", {
                      "data-guide-line": "",
                      className: "absolute block bg-fill-accent",
                      style:
                        input.axis === "x"
                          ? {
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: guide,
                              transformOrigin: "0 0",
                              transform: `translateX(${input.pos}px) scaleX(${value2})`,
                              pointerEvents: "none",
                            }
                          : {
                              top: 0,
                              left: 0,
                              right: 0,
                              height: guide,
                              transformOrigin: "0 0",
                              transform: `translateY(${input.pos}px) scaleY(${value2})`,
                              pointerEvents: "none",
                            },
                    }),
                    input.label !== undefined
                      ? jsxForUiEditorSelection2.jsx(SelectionLabel, {
                          "data-guide-label": "",
                          scale: value,
                          anchor: "start",
                          at:
                            input.axis === "x"
                              ? {
                                  left: input.pos + 6 / value,
                                  top: 8 / value,
                                }
                              : {
                                  left: 8 / value,
                                  top: input.pos + 6 / value,
                                },
                          children: input.label,
                        })
                      : null,
                  ],
                },
                `${input.axis}-${input.pos}-${options2}`,
              ),
          ),
        });
      });
      AlignmentGuides.displayName = "AlignmentGuides";
    });
  };
}
