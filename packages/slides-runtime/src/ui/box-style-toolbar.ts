/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type {
  BorderStyleValue,
  GradientValue,
  SlideNode,
  StyleBag,
} from "../deck-contracts";
import type {
  BorderCornerName,
  BorderRadii,
  BorderSideName,
  BorderWidths,
  StylePatch,
} from "../model/editing";
import type { StyleNodeKind } from "../model/style-schema";
import type {
  BorderQuickPanelChange,
  BorderQuickPanelSupports,
  BorderSideWidthPatch,
  CornerQuickPanelProps,
  CornerRadiusPatch,
  SideSpacingPatch,
} from "./box-quick-panels";
import type { ColorSwatch } from "./color-select";

/** Edits the style of the selected box: commits, previews and settles style patches. */
export interface BoxStyleBinding {
  bag: StyleBag | undefined;
  kind: StyleNodeKind | undefined;
  /** The selection does not share one fill. */
  fillMixed?: boolean;
  commit: (patch: StylePatch) => void;
  live: (patch: StylePatch) => void;
  /** Commits a patch computed from the current style. */
  update: (build: (bag: StyleBag | undefined) => StylePatch) => void;
  /** Previews a patch computed from the current style. */
  liveWith: (build: (bag: StyleBag | undefined) => StylePatch) => void;
  settle: () => void;
}
/** Props of `BoxStyleToolbar`. */
export interface BoxStyleToolbarProps {
  compact?: boolean;
  wrap?: boolean;
  swatches: ColorSwatch[];
  io: BoxStyleBinding;
  /** Offers the spacing control. */
  padding?: boolean;
  corner?: CornerQuickPanelProps;
  border?: Pick<BorderQuickPanelSupports, "sides" | "widthMax">;
  /** Why "no background" cannot be picked. */
  noneReason?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxK7: JsxNamespace;
    STYLE_SIDE_NAMES: BorderSideName[];
    ensureVisibleBorderStyle: (
      before: StyleBag | undefined,
      patch: StylePatch,
      borderColor: string,
    ) => StylePatch;
    BORDER_REQUIRED_REASON: string;
    SHAPE_BORDER_SIDES_REASON: string;
    isClosedShape: (node: SlideNode) => boolean;
    ensureShapeFill: <T extends SlideNode>(node: T) => T;
    updateNodeShapeStyle: <T extends SlideNode>(
      node: T,
      patch: StylePatch,
    ) => T;
    BORDER_STYLE_CLEAR_PATCH: StylePatch;
    normalizedBorderPatch: (patch: StylePatch) => StylePatch;
    borderColorPatch: (
      style: StyleBag | undefined,
      color: string,
    ) => StylePatch;
    uniformVisibleBorderWidth: (widths: BorderWidths) => number | undefined;
    activeBorderSides: (widths: BorderWidths) => BorderSideName[] | undefined;
    definedBorderSides: (sides: BorderSideWidthPatch) => BorderSideWidthPatch;
    BORDER_STYLES: BorderStyleValue[];
    BoxStyleToolbar: (props: BoxStyleToolbarProps) => ReactElement;
    paddingStylePatch: (sides: SideSpacingPatch) => StylePatch;
    CornerStylePopover: (props: CornerQuickPanelProps) => ReactElement;
    cornerStyleBindings: (binding: BoxStyleBinding) => CornerQuickPanelProps;
  }
}

export function installUiBoxStyleToolbar(runtime: RuntimeBindings): () => void {
  var jsxK7: JsxNamespace;
  var STYLE_SIDE_NAMES: RuntimeBindings["STYLE_SIDE_NAMES"];
  var BORDER_REQUIRED_REASON: RuntimeBindings["BORDER_REQUIRED_REASON"];
  var SHAPE_BORDER_SIDES_REASON: RuntimeBindings["SHAPE_BORDER_SIDES_REASON"];
  var isClosedShape: RuntimeBindings["isClosedShape"];
  var BORDER_STYLE_CLEAR_PATCH: RuntimeBindings["BORDER_STYLE_CLEAR_PATCH"];
  var BORDER_STYLES: RuntimeBindings["BORDER_STYLES"];
  function ensureVisibleBorderStyle(
    before: StyleBag | undefined,
    patch: StylePatch,
    node: string,
  ): StylePatch {
    if (
      !(
        [
          "borderWidth",
          "borderTopWidth",
          "borderRightWidth",
          "borderBottomWidth",
          "borderLeftWidth",
        ] as const
      ).some(
        (input) =>
          typeof patch[input] === "number" && patch[input] > 0,
      ) ||
      (before?.borderStyle !== undefined && before.borderStyle !== "none")
    ) {
      return patch;
    }
    return {
      ...patch,
      borderStyle: "solid",
      ...(before?.borderColor === undefined
        ? {
            borderColor: node,
          }
        : {}),
    };
  }
  function ensureShapeFill<T extends SlideNode>(node: T): T {
    if (
      !isClosedShape(node) ||
      node.style?.backgroundColor !== undefined ||
      (0, runtime.shapeHasOutline)(node.style)
    ) {
      return node;
    }
    return (0, runtime.patchNodeStyle)(node, {
      backgroundColor: (0, runtime.themeAccentColor)(),
      backgroundGradient: undefined,
    });
  }
  function updateNodeShapeStyle<T extends SlideNode>(
    node: T,
    patch: StylePatch,
  ): T {
    if (!isClosedShape(node)) {
      return (0, runtime.patchNodeStyle)(node, patch);
    }
    if (
      "backgroundColor" in patch &&
      patch.backgroundColor === undefined &&
      !(0, runtime.shapeHasOutline)(node.style)
    ) {
      return node;
    }
    if (
      node.kind === "shape" &&
      node.shape === "line" &&
      (patch.borderStyle === "dashed" || patch.borderStyle === "dotted")
    ) {
      return node;
    }
    return ensureShapeFill((0, runtime.patchNodeStyle)(node, patch));
  }
  function normalizedBorderPatch(patch: StylePatch): StylePatch {
    if (
      (
        [
          "borderWidth",
          "borderTopWidth",
          "borderRightWidth",
          "borderBottomWidth",
          "borderLeftWidth",
        ] as const
      ).some(
        (input) =>
          typeof patch[input] === "number" && patch[input] > 0,
      )
    ) {
      return patch;
    } else {
      return {
        ...BORDER_STYLE_CLEAR_PATCH,
      };
    }
  }
  function borderColorPatch(
    style: StyleBag | undefined,
    color: string,
  ): StylePatch {
    let value = (0, runtime.borderWidthsBySide)(style);
    if (
      value.top > 0 ||
      value.right > 0 ||
      value.bottom > 0 ||
      value.left > 0
    ) {
      return {
        borderColor: color,
      };
    }
    let value2 =
      style?.borderStyle !== undefined && style.borderStyle !== "none";
    return {
      borderColor: color,
      ...(value2
        ? {}
        : {
            borderStyle: "solid",
          }),
      ...((style?.borderWidth ?? 0) === 0 &&
      !(0, runtime.hasPerSideBorderWidths)(style)
        ? {
            borderWidth: 1,
          }
        : {}),
    };
  }
  function uniformVisibleBorderWidth(widths: BorderWidths): number | undefined {
    let value = STYLE_SIDE_NAMES.filter(
      (input: BorderSideName): boolean => widths[input] > 0,
    );
    if (value.length === 0) {
      return;
    }
    if (
      value.every(
        (input: BorderSideName): boolean => widths[input] === widths[value[0]!],
      )
    ) {
      return widths[value[0]!];
    } else {
      return undefined;
    }
  }
  function activeBorderSides(widths: BorderWidths): BorderSideName[] | undefined {
    let value = STYLE_SIDE_NAMES.filter(
      (input: BorderSideName): boolean => widths[input] > 0,
    );
    if (value.length === 0 || value.length === 4) {
      return undefined;
    } else {
      return value;
    }
  }
  function definedBorderSides(sides: BorderSideWidthPatch): BorderSideWidthPatch {
    let state: BorderSideWidthPatch = {};
    for (let value of STYLE_SIDE_NAMES)
      if (sides[value] !== undefined) {
        state[value] = sides[value];
      }
    return state;
  }
  function BoxStyleToolbar({
    compact: compact,
    wrap = true,
    swatches: swatches,
    io: io2,
    padding: padding,
    corner: corner,
    border = {
      sides: true,
      widthMax: 16,
    },
    noneReason: noneReason,
  }: BoxStyleToolbarProps): ReactElement {
    let bag = io2.bag,
      value = bag?.backgroundColor,
      value2 =
        value !== undefined
          ? swatches.find(
              (input: ColorSwatch): boolean =>
                (0, runtime.colorsEqual)(input.color, value),
            )
          : undefined,
      value3 =
        value2 === undefined ? null : (value2.picks ?? value2.name),
      value4 =
        bag?.backgroundGradient !== undefined
          ? (0, runtime.styleBagToCss)(
              {
                backgroundGradient: bag.backgroundGradient,
              },
              "slides-stack",
            ).backgroundImage
          : undefined,
      value5 = typeof value4 === "string" ? value4 : undefined,
      value6 = bag?.borderStyle,
      value7 = (0, runtime.borderWidthsBySide)(bag),
      value8 =
        value7.top > 0 ||
        value7.right > 0 ||
        value7.bottom > 0 ||
        value7.left > 0,
      value9 =
        value6 === undefined
          ? undefined
          : !value8
            ? "none"
            : value6 === "double"
              ? "solid"
              : value6,
      text = "#141413",
      value10 = bag?.backgroundGradient,
      value11 =
        io2.kind !== undefined &&
        io2.fillMixed !== true &&
        (0, runtime.stylePropertyAppliesToNode)("backgroundGradient", io2.kind)
          ? (0, runtime.createStyleEditor)({
              kind: io2.kind,
              bag: bag,
              swatches: undefined,
              unifiedColorPopover: true,
              onCommit: (input: StyleBag | undefined, options: StylePatch): void =>
                io2.commit(options),
              onLive: (input: StyleBag | undefined, options: StylePatch): void =>
                io2.live(options),
              onLiveEnd: io2.settle,
            })
          : undefined;
    return jsxK7.jsxs(jsxK7.Fragment, {
      children: [
        jsxK7.jsxs(runtime.ToolbarGroup, {
          wrap: wrap,
          children: [
            jsxK7.jsx(runtime.SessionColorPopover, {
              testid: "frame-bg-color",
              title: "Background color",
              paint: value5 ?? value,
              swatches: [
                {
                  name: "none",
                  label: "No background",
                  color: "transparent",
                  empty: true,
                  ...(noneReason !== undefined
                    ? {
                        disabledReason: noneReason,
                      }
                    : {}),
                },
                ...swatches,
              ],
              value:
                value5 !== undefined
                  ? null
                  : value === undefined
                    ? "none"
                    : value3,
              onSwatch: (input: string): void => {
                let value12 = swatches.find(
                  (input2: ColorSwatch): boolean => input2.name === input,
                );
                io2.commit({
                  backgroundColor: value12?.color,
                  backgroundGradient: undefined,
                });
              },
              custom: {
                seed: value ?? "#FFFFFF",
                unset: value === undefined,
                onChange: (input: string): void =>
                  io2.live({
                    backgroundColor: input,
                    backgroundGradient: undefined,
                  }),
                onPickEnd: () => io2.settle(),
              },
              ...(value11 !== undefined
                ? {
                    kind: {
                      value: value10 !== undefined ? "gradient" : "color",
                      options: [
                        {
                          value: "color",
                          label: "Color",
                        },
                        {
                          value: "gradient",
                          label: "Gradient",
                        },
                      ],
                      onChange: (input: string): void => {
                        if (input === "gradient" && value10 === undefined) {
                          io2.commit({
                            backgroundGradient: (0,
                            runtime.defaultStylePropertyValue)(
                              "backgroundGradient",
                              io2.kind!,
                            ) as GradientValue | undefined,
                          });
                        }
                        if (input === "color" && value10 !== undefined) {
                          io2.commit({
                            backgroundGradient: undefined,
                          });
                        }
                      },
                    },
                    face:
                      value10 !== undefined
                        ? jsxK7.jsx("div", {
                            "data-testid": "frame-bg-gradient-panel",
                            children: jsxK7.jsx(
                              runtime.GradientPickerStyleEditor,
                              {
                                rec: value10,
                                propKey: "backgroundGradient",
                                ed: value11,
                              },
                            ),
                          })
                        : null,
                  }
                : {}),
            }),
            jsxK7.jsx(runtime.SessionPropertyPopover, {
              testid: "frame-border",
              title: "Border",
              icon: runtime.BORDER_WEIGHT_ICON,
              children: jsxK7.jsx(runtime.BorderQuickPanel, {
                style: value9,
                width: uniformVisibleBorderWidth(value7),
                sides: activeBorderSides(value7),
                color: jsxK7.jsx(runtime.ColorPropertyRow, {
                  testid: "frame-border-color",
                  label: "Border color",
                  title: "Border color",
                  value: bag?.borderColor,
                  swatches: swatches,
                  fold: true,
                  disabled: !value8,
                  disabledReason: "Pick a border style first",
                  onChange: (input: string | undefined): void => {
                    if (input !== undefined) {
                      io2.update(
                        (input2: StyleBag | undefined): StylePatch =>
                          borderColorPatch(input2, input),
                      );
                    }
                  },
                  onLive: (input: string): void =>
                    io2.liveWith(
                      (input2: StyleBag | undefined): StylePatch =>
                        borderColorPatch(input2, input),
                    ),
                  onLiveEnd: io2.settle,
                  keepFocus: true,
                  popover: runtime.QUICK_PANEL_POPOVER_POSITION,
                }),
                onChange: (input: BorderQuickPanelChange): void => {
                  if ("style" in input) {
                    if (input.style === undefined || input.style === "none") {
                      io2.commit({
                        ...BORDER_STYLE_CLEAR_PATCH,
                      });
                    } else {
                      let style = input.style;
                      io2.update(
                        (input2: StyleBag | undefined): StylePatch => ({
                          borderStyle: style,
                          ...((input2?.borderWidth ?? 0) === 0 &&
                          !(0, runtime.hasPerSideBorderWidths)(input2)
                            ? {
                                borderWidth: 1,
                              }
                            : {}),
                          ...(input2?.borderColor === undefined
                            ? {
                                borderColor: "#141413",
                              }
                            : {}),
                        }),
                      );
                    }
                    return;
                  }
                  if ("width" in input) {
                    let value12 = input.width ?? 0;
                    if (value12 === 0) {
                      io2.commit({
                        ...BORDER_STYLE_CLEAR_PATCH,
                      });
                      return;
                    }
                    io2.update((input2: StyleBag | undefined): StylePatch => {
                      return normalizedBorderPatch(
                        ensureVisibleBorderStyle(
                          input2,
                          (0, runtime.setBorderWidthsPreservingSides)(
                            input2,
                            value12,
                          ),
                          "#141413",
                        ),
                      );
                    });
                    return;
                  }
                  if ("sides" in input && input.sides === undefined) {
                    io2.update((input2: StyleBag | undefined): StylePatch => {
                      let value12 = (0, runtime.borderWidthsBySide)(
                          input2,
                        ),
                        value13 = Math.max(
                          value12.top,
                          value12.right,
                          value12.bottom,
                          value12.left,
                        );
                      return (0, runtime.borderPatchFromWidths)({
                        top: value13,
                        right: value13,
                        bottom: value13,
                        left: value13,
                      });
                    });
                  }
                },
                onLive: (input: { width: number }): void => {
                  if (input.width !== undefined) {
                    let width = input.width;
                    io2.liveWith((input2: StyleBag | undefined): StylePatch => {
                      return normalizedBorderPatch(
                        ensureVisibleBorderStyle(
                          input2,
                          (0, runtime.setBorderWidthsPreservingSides)(
                            input2,
                            width,
                          ),
                          "#141413",
                        ),
                      );
                    });
                  }
                },
                onLiveEnd: io2.settle,
                widths: {
                  value: value7,
                  onChange: (input: BorderSideWidthPatch): void =>
                    io2.update(
                      (input2: StyleBag | undefined): StylePatch =>
                        normalizedBorderPatch(
                          ensureVisibleBorderStyle(
                            input2,
                            (0, runtime.borderPatchFromWidths)({
                              ...(0, runtime.borderWidthsBySide)(input2),
                              ...definedBorderSides(input),
                            }),
                            "#141413",
                          ),
                        ),
                    ),
                  onLive: (input: BorderSideWidthPatch): void =>
                    io2.liveWith(
                      (input2: StyleBag | undefined): StylePatch =>
                        normalizedBorderPatch(
                          ensureVisibleBorderStyle(
                            input2,
                            (0, runtime.borderPatchFromWidths)({
                              ...(0, runtime.borderWidthsBySide)(input2),
                              ...definedBorderSides(input),
                            }),
                            "#141413",
                          ),
                        ),
                    ),
                  onLiveEnd: io2.settle,
                },
                supports: {
                  styles: BORDER_STYLES,
                  sides: border.sides,
                  widthMax: border.widthMax,
                },
              }),
            }),
          ],
        }),
        compact ? null : jsxK7.jsx(runtime.ToolbarDivider, {}),
        corner !== undefined || padding
          ? jsxK7.jsxs(jsxK7.Fragment, {
              children: [
                jsxK7.jsxs(runtime.ToolbarGroup, {
                  wrap: wrap,
                  children: [
                    corner !== undefined
                      ? jsxK7.jsx(CornerStylePopover, {
                          ...corner,
                        })
                      : null,
                    padding
                      ? jsxK7.jsx(runtime.SessionPropertyPopover, {
                          testid: "frame-spacing",
                          title: "Spacing",
                          icon: runtime.SPACING_ICON,
                          children: jsxK7.jsx(runtime.SpacingQuickPanel, {
                            padding: {
                              top: bag?.paddingTop,
                              right: bag?.paddingRight,
                              bottom: bag?.paddingBottom,
                              left: bag?.paddingLeft,
                            },
                            max: 256,
                            onChange: (input: SideSpacingPatch): void =>
                              io2.commit(paddingStylePatch(input)),
                            onLive: (input: SideSpacingPatch): void =>
                              io2.live(paddingStylePatch(input)),
                            onLiveEnd: io2.settle,
                          }),
                        })
                      : null,
                  ],
                }),
                compact ? null : jsxK7.jsx(runtime.ToolbarDivider, {}),
              ],
            })
          : null,
      ],
    });
  }
  function paddingStylePatch(sides: SideSpacingPatch): StylePatch {
    let state: Record<string, number | undefined> = {};
    for (let value of STYLE_SIDE_NAMES)
      if (value in sides) {
        state["padding" + value[0]!.toUpperCase() + value.slice(1)] =
          sides[value];
      }
    return state;
  }
  function CornerStylePopover(props: CornerQuickPanelProps): ReactElement {
    return jsxK7.jsx(runtime.SessionPropertyPopover, {
      testid: "frame-corner",
      title: "Corner radius",
      icon: runtime.CORNER_RADIUS_ICON,
      children: jsxK7.jsx(runtime.CornerQuickPanel, {
        ...props,
      }),
    });
  }
  function cornerStyleBindings(binding: BoxStyleBinding): CornerQuickPanelProps {
    let callback = (input: number): BorderRadii => ({
        tl: input,
        tr: input,
        br: input,
        bl: input,
      }),
      callback2 = (input: CornerRadiusPatch): Partial<BorderRadii> => {
        let state: Partial<BorderRadii> = {};
        for (let value of ["tl", "tr", "br", "bl"] as BorderCornerName[])
          if (value in input) {
            state[value] = input[value] ?? 0;
          }
        return state;
      };
    return {
      radius: (0, runtime.hasPerCornerRadius)(binding.bag)
        ? ((input) =>
            input.tl === input.tr &&
            input.tl === input.br &&
            input.tl === input.bl
              ? input.tl
              : undefined)((0, runtime.borderRadiiByCorner)(binding.bag))
        : binding.bag?.borderRadius,
      max: 256,
      onChange: (input: number | undefined): void =>
        binding.update(
          () => (0, runtime.borderRadiusPatch)(callback(input ?? 0)),
        ),
      onLive: (input: number): void =>
        binding.liveWith(
          () => (0, runtime.borderRadiusPatch)(callback(input)),
        ),
      onLiveEnd: binding.settle,
      corners: {
        value: (0, runtime.borderRadiiByCorner)(binding.bag),
        onChange: (input: CornerRadiusPatch): void =>
          binding.update(
            (input2: StyleBag | undefined): StylePatch =>
              (0, runtime.borderRadiusPatch)({
                ...(0, runtime.borderRadiiByCorner)(input2),
                ...callback2(input),
              }),
          ),
        onLive: (input: CornerRadiusPatch): void =>
          binding.liveWith(
            (input2: StyleBag | undefined): StylePatch =>
              (0, runtime.borderRadiusPatch)({
                ...(0, runtime.borderRadiiByCorner)(input2),
                ...callback2(input),
              }),
          ),
        onLiveEnd: binding.settle,
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "jsxK7",
    () => jsxK7,
    (value) => {
      jsxK7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STYLE_SIDE_NAMES",
    () => STYLE_SIDE_NAMES,
    (value) => {
      STYLE_SIDE_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ensureVisibleBorderStyle",
    () => ensureVisibleBorderStyle,
  );
  bindRuntimeValue(
    runtime,
    "BORDER_REQUIRED_REASON",
    () => BORDER_REQUIRED_REASON,
    (value) => {
      BORDER_REQUIRED_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHAPE_BORDER_SIDES_REASON",
    () => SHAPE_BORDER_SIDES_REASON,
    (value) => {
      SHAPE_BORDER_SIDES_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isClosedShape",
    () => isClosedShape,
    (value) => {
      isClosedShape = value;
    },
  );
  bindRuntimeValue(runtime, "ensureShapeFill", () => ensureShapeFill);
  bindRuntimeValue(runtime, "updateNodeShapeStyle", () => updateNodeShapeStyle);
  bindRuntimeValue(
    runtime,
    "BORDER_STYLE_CLEAR_PATCH",
    () => BORDER_STYLE_CLEAR_PATCH,
    (value) => {
      BORDER_STYLE_CLEAR_PATCH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizedBorderPatch",
    () => normalizedBorderPatch,
  );
  bindRuntimeValue(runtime, "borderColorPatch", () => borderColorPatch);
  bindRuntimeValue(
    runtime,
    "uniformVisibleBorderWidth",
    () => uniformVisibleBorderWidth,
  );
  bindRuntimeValue(runtime, "activeBorderSides", () => activeBorderSides);
  bindRuntimeValue(runtime, "definedBorderSides", () => definedBorderSides);
  bindRuntimeValue(
    runtime,
    "BORDER_STYLES",
    () => BORDER_STYLES,
    (value) => {
      BORDER_STYLES = value;
    },
  );
  bindRuntimeValue(runtime, "BoxStyleToolbar", () => BoxStyleToolbar);
  bindRuntimeValue(runtime, "paddingStylePatch", () => paddingStylePatch);
  bindRuntimeValue(runtime, "CornerStylePopover", () => CornerStylePopover);
  bindRuntimeValue(runtime, "cornerStyleBindings", () => cornerStyleBindings);
  return () => {
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeRenderingTheme)();
    jsxK7 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    STYLE_SIDE_NAMES = ["top", "right", "bottom", "left"];
    BORDER_REQUIRED_REASON = "Add a border first";
    SHAPE_BORDER_SIDES_REASON = "A shape draws one stroke all round";
    isClosedShape = (source: SlideNode): boolean =>
      source.kind === "shape" && source.shape !== "connector";
    BORDER_STYLE_CLEAR_PATCH = {
      borderStyle: undefined,
      borderWidth: undefined,
      borderColor: undefined,
      borderSides: undefined,
      borderTopWidth: undefined,
      borderRightWidth: undefined,
      borderBottomWidth: undefined,
      borderLeftWidth: undefined,
    };
    BORDER_STYLES = ["none", "solid", "dashed", "dotted"];
  };
}
