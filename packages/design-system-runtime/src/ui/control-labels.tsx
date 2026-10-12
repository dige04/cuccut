/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiControlLabels(runtime: RuntimeBindings): () => void {
  var jsxsM: typeof import("react/jsx-runtime");
  var checkboxVisualClasses: string;
  var CONTROL_LABEL_CLASS: string;
  var CHECKBOX_LABEL_ALIGNMENT_CLASS: string;
  function CheckboxGlyph({ indeterminate = false }: C.CheckboxGlyphProps) {
    return (
      <runtime.Icon
        name={indeterminate ? "Minus" : "Check"}
        size={"sm"}
        bold={true}
        style={{
          fontSize: "var(--cds-checkbox-glyph)",
        }}
      />
    );
  }
  function CheckboxVisual({
    checked: checked,
    indeterminate = false,
    className: className,
  }: C.CheckboxVisualProps) {
    let value = checked || indeterminate;
    return (
      <span
        data-checked={checked && !indeterminate ? "" : undefined}
        data-indeterminate={indeterminate ? "" : undefined}
        data-unchecked={value ? undefined : ""}
        className={(0, runtime.cn)(
          checkboxVisualClasses,
          value && "bg-fill-accent border-transparent",
          className,
        )}
      >
        {value && (
          <span className={"text-on-accent"}>
            <CheckboxGlyph indeterminate={indeterminate} />
          </span>
        )}
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxsM",
    () => jsxsM,
    (value) => {
      jsxsM = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "checkboxVisualClasses",
    () => checkboxVisualClasses,
    (value) => {
      checkboxVisualClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTROL_LABEL_CLASS",
    () => CONTROL_LABEL_CLASS,
    (value) => {
      CONTROL_LABEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHECKBOX_LABEL_ALIGNMENT_CLASS",
    () => CHECKBOX_LABEL_ALIGNMENT_CLASS,
    (value) => {
      CHECKBOX_LABEL_ALIGNMENT_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "CheckboxGlyph", () => CheckboxGlyph);
  bindRuntimeValue(runtime, "CheckboxVisual", () => CheckboxVisual);
  return () => {
    jsxsM = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    checkboxVisualClasses =
      "flex shrink-0 size-[var(--cds-checkbox)] items-center justify-center rounded-[var(--cds-checkbox-radius)] border border-strong bg-transparent";
    CONTROL_LABEL_CLASS =
      "inline-flex gap-xs text-start font-sans text-body font-normal text-primary";
    CHECKBOX_LABEL_ALIGNMENT_CLASS =
      "mt-[calc((1lh_-_var(--cds-checkbox,1rem))_/_2)]";
  };
}
