/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { InspectorIcon } from "./inspector-icons";
import type { FourPartLabels } from "./property-labels";

/** Which four-part value the row edits. */
export type SidesKind = "side" | "corner";

/** Index of a side (top, right, bottom, left) or of a corner (top left, top right, bottom right, bottom left). */
export type SideIndex = 0 | 1 | 2 | 3;

/** One edited side or corner; an undefined value clears it. */
export interface SideChange {
  side: SideIndex;
  value: number | undefined;
}

export interface SidesPropertyRowProps {
  label: string;
  kind?: SidesKind;
  /** The four current values; undefined entries are unset. */
  values: readonly (number | undefined)[];
  /** Placeholders shown for unset entries. */
  placeholders?: readonly string[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  smallStep?: number;
  mixed?: boolean;
  disabled?: boolean;
  toggleDisabledReason?: string;
  onSides: (changes: SideChange[]) => void;
  onScrubSides?: (changes: SideChange[]) => void;
  onScrubEnd?: (changes: SideChange[]) => void;
  onReset?: () => void;
  title?: string;
  description?: ReactNode;
  icon?: InspectorIcon;
  /** Name of the per-part editor in the toggle's accessible label. */
  expandLabel?: string;
  partLabels?: FourPartLabels;
  "data-testid"?: string;
}

export type CornersPropertyRowProps = Omit<SidesPropertyRowProps, "kind">;

export interface SideOrCornerIconProps {
  kind: SidesKind;
  index: SideIndex;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactSl: ReactNamespace;
    jsxW9: JsxNamespace;
    SIDE_INPUT_ORDER: Record<SidesKind, readonly SideIndex[]>;
    ALL_SIDE_INDICES: readonly [0, 1, 2, 3];
    SIDE_ICON_NAMES: FourPartLabels;
    CORNER_ICON_NAMES: FourPartLabels;
    SidesPropertyRow: (props: SidesPropertyRowProps) => ReactElement;
    CornersPropertyRow: (props: CornersPropertyRowProps) => ReactElement;
    SideOrCornerIcon: (props: SideOrCornerIconProps) => ReactElement;
  }
}

export function installUiSidesProperty(runtime: RuntimeBindings): () => void {
  var reactSl: ReactNamespace;
  var jsxW9: JsxNamespace;
  var SIDE_INPUT_ORDER: Record<SidesKind, readonly SideIndex[]>;
  var ALL_SIDE_INDICES: readonly [0, 1, 2, 3];
  var SIDE_ICON_NAMES: FourPartLabels;
  var CORNER_ICON_NAMES: FourPartLabels;
  function SidesPropertyRow({
    label: label,
    kind = "side",
    values: values,
    placeholders: placeholders,
    unit = "px",
    min: min,
    max: max,
    step: step,
    smallStep: smallStep,
    mixed: mixed,
    disabled: disabled,
    toggleDisabledReason: toggleDisabledReason,
    onSides: onSides,
    onScrubSides: onScrubSides,
    onScrubEnd: onScrubEnd,
    onReset: onReset,
    title: title,
    description: description,
    icon: icon,
    expandLabel: expandLabel,
    partLabels: partLabels,
    "data-testid": dataTestid,
  }: SidesPropertyRowProps): ReactElement {
    let value =
        expandLabel ??
        (kind === "corner" ? runtime.PER_CORNER_LABEL : runtime.PER_SIDE_LABEL),
      value2 =
        partLabels ??
        (kind === "corner" ? runtime.CORNER_LABELS_rc0 : runtime.SIDE_LABELS),
      value3 =
        icon ??
        (kind === "corner"
          ? runtime.INDIVIDUAL_CORNERS_ICON
          : runtime.BORDER_SIDES_ICON),
      value4 = values.map(
        (input, options) =>
          input !== undefined ? String(input) : (placeholders?.[options] ?? ""),
      ),
      value5 =
        values.some((input) => input !== undefined) &&
        values.every(
          (input) => input !== undefined && input === values[0],
        ),
      value6 = value4.every((input) => input === value4[0]),
      value7 = !mixed && !value6 && !value5,
      [value8, value9] = reactSl.useState(value7);
    if (value7 && !value8) {
      value9(true);
    }
    let value10 = mixed || !value5 ? undefined : values[0],
      value11 = mixed || value7 ? undefined : value4[0],
      callback = (input: string | undefined) => {
        if (mixed) {
          return null;
        }
        let value15 =
          input === undefined || input.trim() === "" ? NaN : Number(input);
        if (Number.isFinite(value15)) {
          return value15;
        } else {
          return undefined;
        }
      },
      value12 = label.toLowerCase(),
      ref = reactSl.useRef<SideChange[]>([]),
      value13 =
        onScrubSides &&
        ((input: SideChange[]) => {
          ref.current = input;
          onScrubSides(input);
        }),
      callback2 = () => {
        let current = ref.current;
        ref.current = [];
        onScrubEnd?.(current);
      },
      value14 = jsxW9.jsx(runtime.DisabledReasonTooltip, {
        reason:
          toggleDisabledReason ??
          (!disabled && value7 && value8
            ? runtime.UNIFIED_VALUES_DISABLED_REASON
            : undefined),
        wrapperClassName: "shrink-0",
        children: jsxW9.jsx(runtime.Button, {
          variant: "ghost",
          iconOnly: true,
          icon: jsxW9.jsx(runtime.PropertyIcon, {
            icon: value3,
          }),
          "aria-label":
            (value8 ? runtime.HIDE_LABEL : runtime.EDIT_LABEL) +
            " " +
            value12 +
            " " +
            value.toLowerCase(),
          pressed: value8,
          disabled:
            disabled ||
            (value7 && value8) ||
            toggleDisabledReason !== undefined,
          "data-testid": dataTestid ? dataTestid + "-toggle" : undefined,
          onClick: () => value9((input) => !input),
          className: "shrink-0",
        }),
      });
    return jsxW9.jsxs(jsxW9.Fragment, {
      children: [
        jsxW9.jsx(runtime.PropertyRow, {
          label: label,
          title: title,
          description: description,
          onReset: onReset,
          disabled: disabled,
          "data-testid": dataTestid,
          onPress: (element: HTMLElement) =>
            element.querySelector("input")?.focus(),
          trailing: value14,
          children: jsxW9.jsx(runtime.PropertyNumberInput, {
            "aria-label": label,
            value: value10,
            placeholder: value11,
            hint: value7 ? value : undefined,
            unit: unit,
            min: min,
            max: max,
            step: step,
            smallStep: smallStep,
            mixed: mixed,
            clearable: true,
            refuseLetters: true,
            disabled: disabled,
            emptyStepFrom: value7 ? null : callback(value4[0]),
            onValue: (input: number | undefined) =>
              onSides(
                ALL_SIDE_INDICES.map((input2) => ({
                  side: input2,
                  value: input,
                })),
              ),
            onScrub:
              value13 &&
              ((input: number | undefined) =>
                value13(
                  ALL_SIDE_INDICES.map((input2) => ({
                    side: input2,
                    value: input,
                  })),
                )),
            onScrubEnd: callback2,
          }),
        }),
        value8
          ? jsxW9.jsx(runtime.PropertyRow, {
              label: "",
              title: title,
              disabled: disabled,
              "data-testid": dataTestid ? dataTestid + "-parts" : undefined,
              children: jsxW9.jsx("div", {
                className: "grid min-w-0 flex-1 grid-cols-2 gap-2",
                children: SIDE_INPUT_ORDER[kind].map(
                  (input) =>
                    jsxW9.jsx(
                      runtime.PropertyNumberInput,
                      {
                        "aria-label": label + " " + value2[input].toLowerCase(),
                        title: value2[input],
                        prefix: jsxW9.jsx(SideOrCornerIcon, {
                          kind: kind,
                          index: input,
                        }),
                        value: mixed ? undefined : values[input],
                        placeholder: mixed
                          ? undefined
                          : (placeholders?.[input] ?? ""),
                        emptyStepFrom: callback(placeholders?.[input]),
                        mixed: mixed,
                        min: min,
                        max: max,
                        step: step,
                        smallStep: smallStep,
                        clearable: true,
                        refuseLetters: true,
                        ownUnit: unit,
                        steppers: false,
                        disabled: disabled,
                        onValue: (input2: number | undefined) =>
                          onSides([
                            {
                              side: input,
                              value: input2,
                            },
                          ]),
                        onScrub:
                          value13 &&
                          ((input2: number | undefined) =>
                            value13([
                              {
                                side: input,
                                value: input2,
                              },
                            ])),
                        onScrubEnd: callback2,
                      },
                      input,
                    ),
                ),
              }),
            })
          : null,
      ],
    });
  }
  function CornersPropertyRow(input: CornersPropertyRowProps): ReactElement {
    return jsxW9.jsx(SidesPropertyRow, {
      ...input,
      kind: "corner",
    });
  }
  function SideOrCornerIcon({
    kind: kind,
    index: index,
  }: SideOrCornerIconProps): ReactElement {
    return jsxW9.jsx(runtime.KitIcon, {
      name: (kind === "corner" ? CORNER_ICON_NAMES : SIDE_ICON_NAMES)[index],
      size: 16,
    });
  }
  bindRuntimeValue(
    runtime,
    "reactSl",
    () => reactSl,
    (value) => {
      reactSl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxW9",
    () => jsxW9,
    (value) => {
      jsxW9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SIDE_INPUT_ORDER",
    () => SIDE_INPUT_ORDER,
    (value) => {
      SIDE_INPUT_ORDER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ALL_SIDE_INDICES",
    () => ALL_SIDE_INDICES,
    (value) => {
      ALL_SIDE_INDICES = value;
    },
  );
  bindRuntimeValue(runtime, "SidesPropertyRow", () => SidesPropertyRow);
  bindRuntimeValue(runtime, "CornersPropertyRow", () => CornersPropertyRow);
  bindRuntimeValue(
    runtime,
    "SIDE_ICON_NAMES",
    () => SIDE_ICON_NAMES,
    (value) => {
      SIDE_ICON_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CORNER_ICON_NAMES",
    () => CORNER_ICON_NAMES,
    (value) => {
      CORNER_ICON_NAMES = value;
    },
  );
  bindRuntimeValue(runtime, "SideOrCornerIcon", () => SideOrCornerIcon);
  return () => {
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiNumberControls2)();
    (0, runtime.initializeUiPropertyRow3)();
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeUiPropertyIcons)();
    (0, runtime.initializeUiPropertyLabels)();
    reactSl = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxW9 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    SIDE_INPUT_ORDER = {
      side: [0, 1, 2, 3],
      corner: [0, 1, 3, 2],
    };
    ALL_SIDE_INDICES = [0, 1, 2, 3];
    SIDE_ICON_NAMES = ["SideTop", "SideRight", "SideBottom", "SideLeft"];
    CORNER_ICON_NAMES = [
      "CornerTopLeft",
      "CornerTopRight",
      "CornerBottomRight",
      "CornerBottomLeft",
    ];
  };
}
