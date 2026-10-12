/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsEditorSelectionGeometry(
  runtime: RuntimeBindings,
): () => void {
  var jsxEditorSelectionGeometry: Dynamic;
  var selectionMetrics: Dynamic;
  var allSelectionPoints: Dynamic;
  var cornerSelectionPoints: Dynamic;
  var EditorSelectionGeometryFilterValue: Dynamic;
  var OutlineFillAccentValue: Dynamic;
  var EditorSelectionGeometryLeftTopConfig: Dynamic;
  var initializeEditorSelectionGeometry: Dynamic;
  function sameSelectionPoint(input?: Dynamic, options?: Dynamic): Dynamic {
    return input.x === options.x && input.y === options.y;
  }
  function resolveSelectionPoints(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return context !== undefined
      ? []
      : input === undefined
        ? options === "selected"
          ? cornerSelectionPoints
          : []
        : input === "corners"
          ? cornerSelectionPoints
          : input === "all"
            ? allSelectionPoints
            : input === "none"
              ? []
              : allSelectionPoints.filter(
                  (input2?: Dynamic): Dynamic =>
                    input.some(
                      (input3?: Dynamic): Dynamic =>
                        sameSelectionPoint(input3, input2),
                    ),
                );
  }
  function normalizeSelectionScale(input?: Dynamic): Dynamic {
    return Number.isFinite(input) && input > 0 ? input : 1;
  }
  function selectionPointPosition(input?: Dynamic): Dynamic {
    return {
      left: input.x === "left" ? "0%" : input.x === "right" ? "100%" : "50%",
      top: input.y === "top" ? "0%" : input.y === "bottom" ? "100%" : "50%",
    };
  }
  function normalizeSelectionRotation(input?: Dynamic): Dynamic {
    return input !== undefined && Number.isFinite(input) ? input : 0;
  }
  function selectionRingStroke(input?: Dynamic, options?: Dynamic): Dynamic {
    return options !== undefined
      ? selectionMetrics.ringCollaborator
      : input === "hover"
        ? selectionMetrics.ringHover
        : input === "member"
          ? selectionMetrics.ringMember
          : selectionMetrics.ring;
  }
  function normalizeCollaboratorIndex(input?: Dynamic): Dynamic {
    return input !== undefined &&
      Number.isInteger(input) &&
      input >= 1 &&
      input <= 6
      ? input
      : undefined;
  }
  function collaboratorColor(input?: Dynamic): Dynamic {
    let value: Dynamic = normalizeCollaboratorIndex(input);
    return value === undefined
      ? undefined
      : runtime.tokens.editor.collaborator[value].cssVar;
  }
  function SelectionRingSvg({
    frame: frame,
    scale: scale,
    rotation: rotation,
    stroke: stroke,
    collaborator: collaborator,
    variant: variant,
  }: Dynamic): Dynamic {
    let value: Dynamic = normalizeSelectionRotation(rotation),
      value2: Dynamic =
        value === 0
          ? ""
          : `translate(${frame.w / 2}px, ${frame.h / 2}px) rotate(${value}rad) translate(${-frame.w / 2}px, ${-frame.h / 2}px) `,
      state: Dynamic = {
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
      value3: Dynamic = collaboratorColor(collaborator);
    value3 !== undefined
      ? (state.outlineColor = value3)
      : variant === "component" &&
        (state.outlineColor = runtime.tokens.fill.pro.cssVar);
    return state;
  }
  function SelectionGrip({
    stroke = selectionMetrics.ring,
    disabled: disabled2,
    variant: variant,
  }: Dynamic): Dynamic {
    let grip: Dynamic = selectionMetrics.grip,
      value: Dynamic = variant === "component",
      value2: Dynamic = value
        ? runtime.tokens.on.pro.cssVar
        : runtime.tokens.on.accent.cssVar,
      value3: Dynamic = value
        ? runtime.tokens.fill.pro.cssVar
        : runtime.tokens.fill.accent.cssVar;
    return (
      <span
        data-selection-grip={""}
        data-disabled={disabled2 ? "" : undefined}
        className={(0, runtime.cn)(
          "absolute left-1/2 top-1/2 box-border block -translate-x-1/2 -translate-y-1/2",
          OutlineFillAccentValue,
        )}
        style={{
          width: grip,
          height: grip,
          borderRadius: selectionMetrics.gripRadius,
          backgroundColor: value2,
          outlineStyle: "solid",
          outlineWidth: stroke,
          outlineOffset: -stroke,
          outlineColor: disabled2
            ? `color-mix(in srgb, ${value3} calc(${runtime.tokens.opacity.disabled.cssVar} * 100%), ${value2})`
            : value
              ? value3
              : undefined,
          pointerEvents: "none",
        }}
      />
    );
  }
  function SelectionPoint({
    scale: scale,
    rotation = 0,
    at: at,
    anchor: anchor,
    variant: variant,
    children: children,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = 1 / scale,
      value2: Dynamic = normalizeSelectionRotation(rotation),
      value3: Dynamic = typeof at.left == "number" && typeof at.top == "number",
      value4: Dynamic = value3 ? `translate(${at.left}px, ${at.top}px) ` : "";
    return (
      <span
        {...props}
        data-variant={variant}
        className={(0, runtime.cn)(
          "absolute block whitespace-nowrap rounded-full font-sans text-caption font-medium",
          variant === "component"
            ? "bg-fill-pro text-on-pro"
            : "bg-fill-accent text-on-accent",
        )}
        style={{
          left: value3 ? 0 : at.left,
          top: value3 ? 0 : at.top,
          padding: "0 6px",
          pointerEvents: "none",
          transformOrigin: anchor === "center" ? "50% 50%" : "0 0",
          transform:
            anchor === "center"
              ? `${value4}translate(-50%, -50%) rotate(${-value2}rad) scale(${value})`
              : `${value4}scale(${value})`,
        }}
      >
        {children}
      </span>
    );
  }
  bindRuntimeValue(runtime, "sameSelectionPoint", () => sameSelectionPoint);
  bindRuntimeValue(
    runtime,
    "resolveSelectionPoints",
    () => resolveSelectionPoints,
  );
  bindRuntimeValue(
    runtime,
    "normalizeSelectionScale",
    () => normalizeSelectionScale,
  );
  bindRuntimeValue(
    runtime,
    "selectionPointPosition",
    () => selectionPointPosition,
  );
  bindRuntimeValue(
    runtime,
    "normalizeSelectionRotation",
    () => normalizeSelectionRotation,
  );
  bindRuntimeValue(runtime, "selectionRingStroke", () => selectionRingStroke);
  bindRuntimeValue(
    runtime,
    "normalizeCollaboratorIndex",
    () => normalizeCollaboratorIndex,
  );
  bindRuntimeValue(runtime, "collaboratorColor", () => collaboratorColor);
  bindRuntimeValue(runtime, "SelectionRingSvg", () => SelectionRingSvg);
  bindRuntimeValue(runtime, "SelectionGrip", () => SelectionGrip);
  bindRuntimeValue(runtime, "SelectionPoint", () => SelectionPoint);
  bindRuntimeValue(
    runtime,
    "jsxEditorSelectionGeometry",
    () => jsxEditorSelectionGeometry,
    (value) => {
      jsxEditorSelectionGeometry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionMetrics",
    () => selectionMetrics,
    (value) => {
      selectionMetrics = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allSelectionPoints",
    () => allSelectionPoints,
    (value) => {
      allSelectionPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cornerSelectionPoints",
    () => cornerSelectionPoints,
    (value) => {
      cornerSelectionPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EditorSelectionGeometryFilterValue",
    () => EditorSelectionGeometryFilterValue,
    (value) => {
      EditorSelectionGeometryFilterValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineFillAccentValue",
    () => OutlineFillAccentValue,
    (value) => {
      OutlineFillAccentValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EditorSelectionGeometryLeftTopConfig",
    () => EditorSelectionGeometryLeftTopConfig,
    (value) => {
      EditorSelectionGeometryLeftTopConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEditorSelectionGeometry",
    () => initializeEditorSelectionGeometry,
    (value) => {
      initializeEditorSelectionGeometry = value;
    },
  );
  return () => {
    initializeEditorSelectionGeometry = (0, runtime.initializeOnce)(
      (): Dynamic => {
        (0, runtime.initializeClassNames)();
        (0, runtime.initializeTokens)();
        jsxEditorSelectionGeometry = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        selectionMetrics = {
          ring: 2,
          ringHover: 1.5,
          ringMember: 1,
          ringCollaborator: 1.5,
          grip: 12,
          gripRadius: 1,
          guide: 1,
        };
        allSelectionPoints = [
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
        cornerSelectionPoints = allSelectionPoints.filter(
          (input?: Dynamic): Dynamic => input.x !== null && input.y !== null,
        );
        EditorSelectionGeometryFilterValue = allSelectionPoints.filter(
          (input?: Dynamic): Dynamic =>
            (input.x === null) != (input.y === null),
        );
        OutlineFillAccentValue = "outline-fill-accent";
        EditorSelectionGeometryLeftTopConfig = {
          left: "50%",
          top: "calc(100% + 20.5px)",
        };
      },
    );
  };
}
