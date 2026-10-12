/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type * as React from "react";

export interface SegmentedPropertyOption {
  value: string;
  label?: string;
  tooltip?: string;
  /** Icon element shown in the segment. */
  icon?: React.ReactNode;
  /** Property glyph rendered through PropertyIcon. */
  glyph?: string;
  /** Why this option is unavailable, when it is. */
  whyDisabled?: string;
}
export interface SegmentedPropertyControlProps {
  label?: string;
  options: SegmentedPropertyOption[];
  value?: string;
  /** Value this property inherits when it is unset. */
  inherited?: string;
  inheritedHint?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  mixed?: boolean;
  vertical?: boolean;
  compact?: boolean;
  "data-testid"?: string;
}
export interface SegmentedPropertyRowProps extends SegmentedPropertyControlProps {
  title?: string;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  onReset?: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxz30: JsxNamespace;
    jsxoG: JsxNamespace;
    COMPACT_SEGMENTED_CLASS: string;
    TIGHT_SEGMENTED_CLASS: string;
    SegmentedPropertyControl: (props: SegmentedPropertyControlProps) => React.ReactElement;
    SegmentedPropertyRow: (props: SegmentedPropertyRowProps) => React.ReactElement;
  }
}

export function installUiSegmentedProperty(
  runtime: RuntimeBindings,
): () => void {
  var jsxz30: JsxNamespace;
  var jsxoG: JsxNamespace;
  var COMPACT_SEGMENTED_CLASS: string;
  var TIGHT_SEGMENTED_CLASS: string;
  function SegmentedPropertyControl({
    label: label,
    options: options,
    value: value,
    inherited: inherited,
    inheritedHint = runtime.INHERITED_LABEL,
    onChange: onChange,
    disabled: disabled,
    mixed: mixed,
    vertical: vertical,
    compact: compact,
    "data-testid": dataTestid,
  }: SegmentedPropertyControlProps): React.ReactElement {
    let value2 =
        value === undefined && !mixed && inherited !== undefined,
      value3 = options.every(
        (input) =>
          input.glyph !== undefined || input.icon !== undefined,
      ),
      value4 = mixed ? "" : (value ?? inherited ?? ""),
      callback = (input: SegmentedPropertyOption): string =>
        (input.tooltip ?? input.label) +
        (value2 && input.value === inherited ? " (" + inheritedHint + ")" : "");
    return jsxoG.jsx("span", {
      className: (0, runtime.joinClassNames)(
        "block min-w-0 flex-1",
        compact ? TIGHT_SEGMENTED_CLASS : value3 && COMPACT_SEGMENTED_CLASS,
      ),
      "data-testid": dataTestid,
      "data-inherited": value2 ? "" : undefined,
      onClickCapture:
        value2 && !disabled
          ? (event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
              let ancestor = (event.target as Element).closest('[role="radio"]');
              if (
                ancestor !== null &&
                ancestor.hasAttribute("data-checked") &&
                !ancestor.hasAttribute("data-disabled")
              ) {
                onChange(inherited);
              }
            }
          : undefined,
      children: jsxoG.jsx(runtime.SegmentedControl, {
        "aria-label": label,
        fullWidth: true,
        segments: options.map(
          (input) =>
            input.icon !== undefined
              ? {
                  value: input.value,
                  icon: input.icon,
                  tooltip: callback(input),
                  disabled: disabled || input.whyDisabled !== undefined,
                  disabledReason: input.whyDisabled,
                }
              : {
                  value: input.value,
                  label:
                    input.glyph !== undefined
                      ? jsxoG.jsx("span", {
                          role: "img",
                          "aria-label": input.label,
                          className: (0, runtime.joinClassNames)(
                            "inline-flex",
                            vertical && "rotate-90",
                          ),
                          children: jsxoG.jsx(runtime.PropertyIcon, {
                            icon: input.glyph,
                          }),
                        })
                      : input.label,
                  tooltip: callback(input),
                  disabled: disabled || input.whyDisabled !== undefined,
                  disabledReason: input.whyDisabled,
                },
        ),
        value: value4,
        onChange: (input: string) => {
          if (
            disabled ||
            options.find((input2) => input2.value === input)
              ?.whyDisabled !== undefined
          ) {
            return;
          }
          if (mixed || input !== value) {
            onChange(input);
          }
        },
      }),
    });
  }
  function SegmentedPropertyRow(input: SegmentedPropertyRowProps): React.ReactElement {
    let {
        label: label,
        onReset: onReset,
        title: title,
        description: description,
        trailing: trailing,
        options: options,
        disabled: disabled,
        "data-testid": value,
        ...remainingProps
      } = input,
      value2 = jsxoG.jsx(SegmentedPropertyControl, {
        ...remainingProps,
        label: label,
        options: options,
        disabled: disabled,
        "data-testid": value ? value + "-segments" : undefined,
      });
    if (options.length > 4) {
      return jsxoG.jsxs("div", {
        className: "contents",
        "data-testid": value,
        children: [
          jsxoG.jsx(runtime.PropertyRow, {
            label: label,
            title: title,
            onReset: onReset,
            disabled: disabled,
            className: "min-h-0 pt-1",
          }),
          jsxoG.jsx(runtime.PropertyRow, {
            title: title,
            description: description,
            trailing: trailing,
            disabled: disabled,
            children: value2,
          }),
        ],
      });
    }
    return jsxoG.jsx(runtime.PropertyRow, {
      label: label,
      title: title,
      description: description,
      onReset: onReset,
      trailing: trailing,
      disabled: disabled,
      "data-testid": value,
      children: value2,
    });
  }
  bindRuntimeValue(
    runtime,
    "jsxz30",
    () => jsxz30,
    (value) => {
      jsxz30 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxoG",
    () => jsxoG,
    (value) => {
      jsxoG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPACT_SEGMENTED_CLASS",
    () => COMPACT_SEGMENTED_CLASS,
    (value) => {
      COMPACT_SEGMENTED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TIGHT_SEGMENTED_CLASS",
    () => TIGHT_SEGMENTED_CLASS,
    (value) => {
      TIGHT_SEGMENTED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SegmentedPropertyControl",
    () => SegmentedPropertyControl,
  );
  bindRuntimeValue(runtime, "SegmentedPropertyRow", () => SegmentedPropertyRow);
  return () => {
    jsxz30 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiPropertyRow3)();
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeUiPropertyLabels)();
    jsxoG = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    COMPACT_SEGMENTED_CLASS =
      "[&_[role=radio]]:px-0 [&_[role=radio]]:min-w-[calc(var(--cds-h-control)_-_2px)]";
    TIGHT_SEGMENTED_CLASS =
      "[&_[data-cds=SegmentedControl]]:gap-0 [&_[data-cds=SegmentedControl]]:p-0 [&_[role=radio]]:px-0 [&_[role=radio]]:min-w-[var(--cds-h-control)]";
  };
}
