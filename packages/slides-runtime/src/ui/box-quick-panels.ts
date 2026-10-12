/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { BorderStyleValue } from "../deck-contracts";
import type { BorderCornerName, BorderSideName, BorderWidths } from "../model/editing";
import type { InspectorCustomIcon, InspectorIcon } from "./inspector-icons";
import type { SessionMouseEvent } from "./session-properties";

/** Border styles the quick panel offers. */
export type BorderQuickStyle = Exclude<BorderStyleValue, "double">;
/** Per-side border widths; a side is absent when it is not part of the patch. */
export type BorderSideWidthPatch = Partial<BorderWidths>;
/** Per-side spacing values; a side is absent when it is not part of the patch. */
export type SideSpacingPatch = Partial<Record<BorderSideName, number | undefined>>;
/** Per-corner radii; a corner is absent when it is not part of the patch. */
export type CornerRadiusPatch = Partial<
  Record<BorderCornerName, number | undefined>
>;
/** One edit made in the border panel. */
export type BorderQuickPanelChange =
  | { style: BorderQuickStyle }
  | { width: number | undefined }
  | { sides: BorderSideName[] | undefined };
/** What the border panel can offer for the selection. */
export interface BorderQuickPanelSupports {
  styles: readonly BorderStyleValue[];
  /** `true` when sides can be chosen, otherwise the reason they cannot. */
  sides?: true | string;
  /** Largest border width. */
  widthMax?: number;
  /** Why a style is unavailable. */
  styleReason?: string;
}
/** Per-side border widths, for selections that can set each side. */
export interface BorderQuickPanelWidths {
  value: Partial<BorderWidths>;
  onChange: (patch: BorderSideWidthPatch) => void;
  onLive?: (patch: BorderSideWidthPatch) => void;
  onLiveEnd?: () => void;
}
export interface BorderQuickPanelProps {
  style?: BorderStyleValue;
  /** Uniform border width, `undefined` when it differs by side. */
  width?: number;
  /** Sides that draw a border; `undefined` means all four. */
  sides?: BorderSideName[];
  /** The border color control. */
  color: ReactNode;
  onChange: (change: BorderQuickPanelChange) => void;
  onLive?: (change: { width: number }) => void;
  onLiveEnd?: () => void;
  supports: BorderQuickPanelSupports;
  widths?: BorderQuickPanelWidths;
}
export interface QuickPanelButtonProps {
  icon: InspectorIcon;
  label: string;
  pressed: boolean;
  disabledReason?: string;
  hint?: string;
  onClick: () => void;
}
/** Where a quick panel popover opens relative to its anchor. */
export interface QuickPanelPopoverPosition {
  side: "top" | "right" | "bottom" | "left";
  anchor: (element: Element) => Element | null;
}
/** Per-corner radii of a selection that can set each corner. */
export interface CornerRadiiBinding {
  value: Partial<Record<BorderCornerName, number>>;
  onChange: (patch: CornerRadiusPatch) => void;
  onLive?: (patch: CornerRadiusPatch) => void;
  onLiveEnd?: () => void;
}
export interface CornerQuickPanelProps {
  /** Shared radius, `undefined` when the corners differ. */
  radius?: number;
  max?: number;
  onChange: (radius: number | undefined) => void;
  onLive?: (radius: number) => void;
  onLiveEnd?: () => void;
  /** Why the corners cannot be set one by one. */
  individualReason?: string;
  corners?: CornerRadiiBinding;
}
/** Padding or margin of the four sides. */
export interface SideSpacingBinding {
  value: SideSpacingPatch;
  onChange: (patch: SideSpacingPatch) => void;
  onLive?: (patch: SideSpacingPatch) => void;
  onLiveEnd?: () => void;
}
export interface SpacingQuickPanelProps {
  padding: SideSpacingPatch;
  max?: number;
  onChange: (patch: SideSpacingPatch) => void;
  onLive?: (patch: SideSpacingPatch) => void;
  onLiveEnd?: () => void;
  margin?: SideSpacingBinding & { max?: number };
}
export interface SideSpacingFieldsProps {
  title: string;
  max?: number;
  binding: SideSpacingBinding;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactU_: ReactNamespace;
    jsxk5: JsxNamespace;
    BORDER_SIDE_MENU_ORDER: (BorderSideName | null)[];
    BORDER_SIDE_NAMES: BorderSideName[];
    BORDER_SIDE_LABELS: Record<BorderSideName, string>;
    BORDER_SIDE_SHORT_LABELS: Record<BorderSideName, string>;
    BORDER_STYLE_VALUES: BorderQuickStyle[];
    BORDER_STYLE_LABELS: Record<BorderQuickStyle, string>;
    BORDER_STYLE_ICONS: Record<
      Exclude<BorderQuickStyle, "none">,
      InspectorCustomIcon
    >;
    preserveQuickPanelSelection: (event: SessionMouseEvent) => void;
    QUICK_PANEL_CLASS: string;
    QUICK_PANEL_POPOVER_POSITION: QuickPanelPopoverPosition;
    QUICK_PANEL_HINT_CLASS: string;
    QuickPanelButton: (props: QuickPanelButtonProps) => ReactElement;
    BorderQuickPanel: (props: BorderQuickPanelProps) => ReactElement;
    CORNER_KEYS: BorderCornerName[];
    CORNER_LABELS: Record<BorderCornerName, string>;
    CornerRadiusField: (
      binding: CornerRadiiBinding,
      corner: BorderCornerName,
      max: number | undefined,
      fallback: number | undefined,
    ) => ReactElement;
    CornerQuickPanel: (props: CornerQuickPanelProps) => ReactElement;
    SpacingQuickPanel: (props: SpacingQuickPanelProps) => ReactElement;
    SideSpacingFields: (props: SideSpacingFieldsProps) => ReactElement;
  }
}

export function installUiBoxQuickPanels(runtime: RuntimeBindings): () => void {
  var reactU_: ReactNamespace;
  var jsxk5: JsxNamespace;
  var BORDER_SIDE_MENU_ORDER: RuntimeBindings["BORDER_SIDE_MENU_ORDER"];
  var BORDER_SIDE_NAMES: BorderSideName[];
  var BORDER_SIDE_LABELS: Record<BorderSideName, string>;
  var BORDER_SIDE_SHORT_LABELS: Record<BorderSideName, string>;
  var BORDER_STYLE_VALUES: BorderQuickStyle[];
  var BORDER_STYLE_LABELS: Record<BorderQuickStyle, string>;
  var BORDER_STYLE_ICONS: RuntimeBindings["BORDER_STYLE_ICONS"];
  var QUICK_PANEL_CLASS: string;
  var QUICK_PANEL_POPOVER_POSITION: QuickPanelPopoverPosition;
  var QUICK_PANEL_HINT_CLASS: string;
  var CORNER_KEYS: BorderCornerName[];
  var CORNER_LABELS: Record<BorderCornerName, string>;
  function preserveQuickPanelSelection(event: SessionMouseEvent): void {
    if (!event.target.closest(runtime.TEXT_EDITABLE_SELECTOR)) {
      event.preventDefault();
    }
  }
  function QuickPanelButton({
    icon: icon,
    label: label,
    pressed: pressed,
    disabledReason: disabledReason,
    hint: hint,
    onClick: onClick,
  }: QuickPanelButtonProps): ReactElement {
    return jsxk5.jsx(runtime.ToolbarStripButton, {
      icon: jsxk5.jsx(runtime.PropertyIcon, {
        icon: icon,
      }),
      "aria-label": label,
      "aria-pressed": pressed,
      title: disabledReason ?? hint,
      disabled: disabledReason !== undefined,
      onClick: onClick,
    });
  }
  function BorderQuickPanel({
    style: style,
    width: width,
    sides: sides,
    color: color,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    supports: supports,
    widths: widths,
  }: BorderQuickPanelProps): ReactElement {
    let value =
        widths !== undefined
          ? BORDER_SIDE_NAMES.map(
              (input: BorderSideName) => widths.value[input] ?? 0,
            ).filter((input: number) => input > 0)
          : [],
      value2 = new Set(value).size > 1,
      [value3, value4] = reactU_.useState(
        sides !== undefined || value2,
      ),
      value5 = (style ?? "none") === "none",
      value6 = sides ?? BORDER_SIDE_NAMES,
      value7 =
        supports.sides === true && (value3 || sides !== undefined || value2),
      callback = (input: BorderSideName) => {
        let value8 = BORDER_SIDE_NAMES.filter(
          (input2: BorderSideName) =>
            input2 === input
              ? !value6.includes(input)
              : value6.includes(input2),
        );
        onChange({
          sides:
            value8.length === BORDER_SIDE_NAMES.length ? undefined : value8,
        });
      },
      callback2 = () =>
        jsxk5.jsx(QuickPanelButton, {
          icon: runtime.BORDER_SIDES_ICON,
          label: "Individual borders",
          pressed: value7,
          hint:
            widths !== undefined
              ? "Set each side’s width"
              : "Choose which sides draw",
          disabledReason:
            supports.sides === true
              ? value5
                ? "Pick a border style first"
                : undefined
              : supports.sides,
          onClick: () => {
            if (value7) {
              value4(false);
              if (sides !== undefined || value2) {
                onChange({
                  sides: undefined,
                });
              }
            } else {
              value4(true);
            }
          },
        });
    return jsxk5.jsxs("div", {
      className: QUICK_PANEL_CLASS,
      onMouseDown: preserveQuickPanelSelection,
      "data-quick-panel": "border",
      children: [
        jsxk5.jsx(runtime.SegmentedControl, {
          "aria-label": "Border style",
          fullWidth: true,
          value: style ?? "none",
          onChange: (input: BorderQuickStyle) =>
            onChange({
              style: input,
            }),
          segments: BORDER_STYLE_VALUES.map(
            (input: BorderQuickStyle) => ({
              value: input,
              ...(input === "none"
                ? {
                    icon: "Prohibit",
                  }
                : {
                    label: jsxk5.jsxs(jsxk5.Fragment, {
                      children: [
                        jsxk5.jsx(runtime.PropertyIcon, {
                          icon: BORDER_STYLE_ICONS[input],
                        }),
                        jsxk5.jsx("span", {
                          className: "sr-only",
                          children: BORDER_STYLE_LABELS[input],
                        }),
                      ],
                    }),
                  }),
              tooltip: BORDER_STYLE_LABELS[input],
              disabled: !supports.styles.includes(input),
              disabledReason: supports.styleReason,
            }),
          ),
        }),
        jsxk5.jsxs("fieldset", {
          disabled: value5,
          className: (0, runtime.joinClassNames)(
            "m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0",
            value5 && "opacity-60",
          ),
          children: [
            jsxk5.jsx("div", {
              className: "min-w-0",
              children: color,
            }),
            jsxk5.jsx("div", {
              className: "grid grid-cols-[1fr_1fr_auto] items-center gap-1.5",
              role: "group",
              "aria-label":
                value7 && widths !== undefined ? "Side widths" : undefined,
              children:
                value7 && widths !== undefined
                  ? BORDER_SIDE_MENU_ORDER.map(
                      (input: BorderSideName | null, options: number) =>
                        input === null
                          ? options === 2
                            ? jsxk5.jsx(
                                reactU_.Fragment,
                                {
                                  children: callback2(),
                                },
                                "toggle",
                              )
                            : jsxk5.jsx("span", {}, "gap")
                          : jsxk5.jsx(
                              runtime.PropertyNumberInput,
                              {
                                prefix: BORDER_SIDE_SHORT_LABELS[input],
                                "aria-label":
                                  BORDER_SIDE_LABELS[input] + " border width",
                                title:
                                  BORDER_SIDE_LABELS[input] +
                                  " border width (px; 0 = none)",
                                value: widths.value[input],
                                min: 0,
                                max: supports.widthMax,
                                step: 1,
                                disabled: value5,
                                onValue: (input2: number | undefined) =>
                                  widths.onChange({
                                    [input]: input2 ?? 0,
                                  }),
                                onScrub: widths.onLive
                                  ? (input2: number) =>
                                      widths.onLive!({
                                        [input]: input2,
                                      })
                                  : undefined,
                                onScrubEnd: widths.onLiveEnd,
                              },
                              input,
                            ),
                    )
                  : jsxk5.jsxs(jsxk5.Fragment, {
                      children: [
                        jsxk5.jsx("div", {
                          className: "col-span-2 min-w-0",
                          children: jsxk5.jsx(runtime.PropertyNumberInput, {
                            prefix: jsxk5.jsx(runtime.PropertyIcon, {
                              icon: runtime.BORDER_WEIGHT_ICON,
                            }),
                            "aria-label": "Border weight",
                            unit: "px",
                            title: "Border weight",
                            value: value2 ? undefined : width,
                            min: 1,
                            max: supports.widthMax,
                            step: 1,
                            clearable: !value2,
                            placeholder: value2 ? "Mixed" : "0",
                            disabled: value5,
                            onValue: (input: number | undefined) => {
                              if (input !== undefined || !value2) {
                                onChange({
                                  width: input,
                                });
                              }
                            },
                            onScrub: onLive
                              ? (input: number) =>
                                  onLive({
                                    width: input,
                                  })
                              : undefined,
                            onScrubEnd: onLiveEnd,
                          }),
                        }),
                        callback2(),
                      ],
                    }),
            }),
            value7 &&
              widths === undefined &&
              jsxk5.jsx("div", {
                className:
                  "grid grid-cols-4 gap-0.5 rounded-md bg-fill-field p-0.5",
                role: "group",
                "aria-label": "Sides",
                children: BORDER_SIDE_NAMES.map((input: BorderSideName) => {
                  let value8 = value6.includes(input),
                    value9 = value8 && value6.length === 1;
                  return jsxk5.jsx(
                    runtime.ToolbarStripButton,
                    {
                      "aria-label": BORDER_SIDE_LABELS[input] + " border",
                      "aria-pressed": value8,
                      className: "justify-center",
                      disabled: value5 || value9,
                      title: value9
                        ? "Set the style to None to remove the border"
                        : BORDER_SIDE_LABELS[input] + " border",
                      onClick: () => callback(input),
                      children: BORDER_SIDE_SHORT_LABELS[input],
                    },
                    input,
                  );
                }),
              }),
          ],
        }),
      ],
    });
  }
  function CornerRadiusField(
    binding: CornerRadiiBinding,
    corner: BorderCornerName,
    max: number | undefined,
    fallback: number | undefined,
  ): ReactElement {
    return jsxk5.jsx(runtime.PropertyNumberInput, {
      prefix: corner.toUpperCase(),
      "aria-label": CORNER_LABELS[corner] + " radius",
      title: CORNER_LABELS[corner] + " radius",
      value: binding.value[corner],
      min: 0,
      max: max,
      step: 1,
      clearable: true,
      placeholder: String(fallback ?? 0),
      onValue: (input: number | undefined) =>
        binding.onChange({
          [corner]: input,
        }),
      onScrub: binding.onLive
        ? (input: number) =>
            binding.onLive?.({
              [corner]: input,
            })
        : undefined,
      onScrubEnd: binding.onLiveEnd,
    });
  }
  function CornerQuickPanel({
    radius: radius,
    max: max,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    individualReason: individualReason,
    corners: corners,
  }: CornerQuickPanelProps): ReactElement {
    let value =
        corners !== undefined &&
        new Set(
          CORNER_KEYS.map((input: BorderCornerName) => corners.value[input]),
        ).size > 1,
      [value2, value3] = reactU_.useState(value),
      value4 = corners !== undefined && value2,
      value5 = jsxk5.jsx(QuickPanelButton, {
        icon: runtime.INDIVIDUAL_CORNERS_ICON,
        label: "Individual corners",
        pressed: value4,
        hint: "Set each corner",
        disabledReason:
          corners === undefined
            ? (individualReason ?? "One radius for every corner")
            : undefined,
        onClick: () => {
          if (value4 && value && corners !== undefined) {
            onChange(
              Math.max(
                ...CORNER_KEYS.map(
                  (input: BorderCornerName) => corners.value[input] ?? 0,
                ),
              ),
            );
          }
          value3(!value4);
        },
      });
    return jsxk5.jsx("div", {
      className: QUICK_PANEL_CLASS,
      onMouseDown: preserveQuickPanelSelection,
      "data-quick-panel": "corner",
      children:
        value4 && corners !== undefined
          ? jsxk5.jsxs("div", {
              className: "grid grid-cols-[1fr_1fr_auto] items-center gap-1.5",
              children: [
                CornerRadiusField(corners, "tl", max, radius),
                CornerRadiusField(corners, "tr", max, radius),
                value5,
                CornerRadiusField(corners, "bl", max, radius),
                CornerRadiusField(corners, "br", max, radius),
                jsxk5.jsx("span", {}),
              ],
            })
          : jsxk5.jsxs("div", {
              className: "flex items-center gap-1.5",
              children: [
                jsxk5.jsx("div", {
                  className: "min-w-0 flex-1",
                  children: jsxk5.jsx(runtime.PropertyNumberInput, {
                    "aria-label": "Corner radius",
                    unit: "px",
                    title: "Corner radius",
                    value: value ? undefined : radius,
                    min: 0,
                    max: max,
                    step: 1,
                    clearable: !value,
                    placeholder: value ? "Mixed" : "0",
                    onValue: onChange,
                    onScrub: onLive,
                    onScrubEnd: onLiveEnd,
                  }),
                }),
                value5,
              ],
            }),
    });
  }
  function SpacingQuickPanel({
    padding: padding,
    max: max,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    margin: margin,
  }: SpacingQuickPanelProps): ReactElement {
    return jsxk5.jsxs("div", {
      className: QUICK_PANEL_CLASS,
      onMouseDown: preserveQuickPanelSelection,
      "data-quick-panel": "spacing",
      children: [
        jsxk5.jsx(SideSpacingFields, {
          title: "Padding",
          max: max,
          binding: {
            value: padding,
            onChange: onChange,
            onLive: onLive,
            onLiveEnd: onLiveEnd,
          },
        }),
        margin !== undefined &&
          jsxk5.jsx(SideSpacingFields, {
            title: "Margin",
            max: margin.max ?? max,
            binding: margin,
          }),
      ],
    });
  }
  function SideSpacingFields({
    title: title,
    max: max,
    binding: binding,
  }: SideSpacingFieldsProps): ReactElement {
    let {
        value: value,
        onChange: onChange,
        onLive: onLive,
        onLiveEnd: onLiveEnd,
      } = binding,
      [value2, value3] = reactU_.useState(
        value.left !== value.right || value.top !== value.bottom,
      ),
      callback = (
        input: string,
        options: string,
        context: BorderSideName[],
      ) => {
        let value5 = context.map(
            (input2: BorderSideName) => value[input2],
          ),
          value6 = value5.every(
            (input2: number | undefined) => input2 === value5[0],
          ),
          callback2 = (input2: number | undefined): SideSpacingPatch =>
            Object.fromEntries(
              context.map((input3: BorderSideName) => [input3, input2]),
            );
        return jsxk5.jsx(
          runtime.PropertyNumberInput,
          {
            prefix: input,
            "aria-label": title + " " + options,
            title: title + " " + options,
            value: value6 ? value5[0] : undefined,
            placeholder: value6 ? "0" : "Mixed",
            min: 0,
            max: max,
            step: 1,
            clearable: value6,
            onValue: (input2: number | undefined) => {
              if (input2 !== undefined || value6) {
                onChange(callback2(input2));
              }
            },
            onScrub: onLive
              ? (input2: number) => onLive(callback2(input2))
              : undefined,
            onScrubEnd: onLiveEnd,
          },
          input,
        );
      },
      value4 = jsxk5.jsx(QuickPanelButton, {
        icon: runtime.BORDER_SIDES_ICON,
        label: "Individual " + title.toLowerCase(),
        pressed: value2,
        hint: "Set each side",
        onClick: () => value3(!value2),
      });
    return jsxk5.jsxs("div", {
      className: "flex flex-col gap-1.5",
      role: "group",
      "aria-label": title,
      children: [
        jsxk5.jsx("div", {
          className: QUICK_PANEL_HINT_CLASS,
          children: title,
        }),
        jsxk5.jsx("div", {
          className: "grid grid-cols-[1fr_1fr_auto] items-center gap-1.5",
          children: value2
            ? jsxk5.jsxs(jsxk5.Fragment, {
                children: [
                  callback("T", "top", ["top"]),
                  callback("R", "right", ["right"]),
                  value4,
                  callback("B", "bottom", ["bottom"]),
                  callback("L", "left", ["left"]),
                  jsxk5.jsx("span", {}),
                ],
              })
            : jsxk5.jsxs(jsxk5.Fragment, {
                children: [
                  callback("H", "left and right", ["left", "right"]),
                  callback("V", "top and bottom", ["top", "bottom"]),
                  value4,
                ],
              }),
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactU_",
    () => reactU_,
    (value) => {
      reactU_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxk5",
    () => jsxk5,
    (value) => {
      jsxk5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_SIDE_MENU_ORDER",
    () => BORDER_SIDE_MENU_ORDER,
    (value) => {
      BORDER_SIDE_MENU_ORDER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_SIDE_NAMES",
    () => BORDER_SIDE_NAMES,
    (value) => {
      BORDER_SIDE_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_SIDE_LABELS",
    () => BORDER_SIDE_LABELS,
    (value) => {
      BORDER_SIDE_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_SIDE_SHORT_LABELS",
    () => BORDER_SIDE_SHORT_LABELS,
    (value) => {
      BORDER_SIDE_SHORT_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_STYLE_VALUES",
    () => BORDER_STYLE_VALUES,
    (value) => {
      BORDER_STYLE_VALUES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_STYLE_LABELS",
    () => BORDER_STYLE_LABELS,
    (value) => {
      BORDER_STYLE_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BORDER_STYLE_ICONS",
    () => BORDER_STYLE_ICONS,
    (value) => {
      BORDER_STYLE_ICONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveQuickPanelSelection",
    () => preserveQuickPanelSelection,
  );
  bindRuntimeValue(
    runtime,
    "QUICK_PANEL_CLASS",
    () => QUICK_PANEL_CLASS,
    (value) => {
      QUICK_PANEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "QUICK_PANEL_POPOVER_POSITION",
    () => QUICK_PANEL_POPOVER_POSITION,
    (value) => {
      QUICK_PANEL_POPOVER_POSITION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "QUICK_PANEL_HINT_CLASS",
    () => QUICK_PANEL_HINT_CLASS,
    (value) => {
      QUICK_PANEL_HINT_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "QuickPanelButton", () => QuickPanelButton);
  bindRuntimeValue(runtime, "BorderQuickPanel", () => BorderQuickPanel);
  bindRuntimeValue(
    runtime,
    "CORNER_KEYS",
    () => CORNER_KEYS,
    (value) => {
      CORNER_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CORNER_LABELS",
    () => CORNER_LABELS,
    (value) => {
      CORNER_LABELS = value;
    },
  );
  bindRuntimeValue(runtime, "CornerRadiusField", () => CornerRadiusField);
  bindRuntimeValue(runtime, "CornerQuickPanel", () => CornerQuickPanel);
  bindRuntimeValue(runtime, "SpacingQuickPanel", () => SpacingQuickPanel);
  bindRuntimeValue(runtime, "SideSpacingFields", () => SideSpacingFields);
  return () => {
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiNumberControls2)();
    (0, runtime.initializeUiPropertyFocus)();
    reactU_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiInspectorIcons)();
    jsxk5 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    BORDER_SIDE_MENU_ORDER = ["top", "right", null, "bottom", "left", null];
    BORDER_SIDE_NAMES = ["top", "right", "bottom", "left"];
    BORDER_SIDE_LABELS = {
      top: "Top",
      right: "Right",
      bottom: "Bottom",
      left: "Left",
    };
    BORDER_SIDE_SHORT_LABELS = {
      top: "T",
      right: "R",
      bottom: "B",
      left: "L",
    };
    BORDER_STYLE_VALUES = ["none", "solid", "dashed", "dotted"];
    BORDER_STYLE_LABELS = {
      none: "None",
      solid: "Solid",
      dashed: "Dashed",
      dotted: "Dotted",
    };
    BORDER_STYLE_ICONS = {
      solid: runtime.BORDER_SOLID_ICON,
      dashed: runtime.BORDER_DASHED_ICON,
      dotted: runtime.BORDER_DOTTED_ICON,
    };
    QUICK_PANEL_CLASS = "flex w-[184px] flex-col gap-1.5";
    QUICK_PANEL_POPOVER_POSITION = {
      side: "right",
      anchor: (input: Element) => input.closest("[data-quick-panel]"),
    };
    QUICK_PANEL_HINT_CLASS =
      "px-0.5 pt-0.5 text-footnote text-muted select-none";
    CORNER_KEYS = ["tl", "tr", "bl", "br"];
    CORNER_LABELS = {
      tl: "Top left",
      tr: "Top right",
      bl: "Bottom left",
      br: "Bottom right",
    };
  };
}
