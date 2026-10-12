import type {
  CheckboxGlyphProps,
  CheckboxVisualProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsCheckbox(
  runtime: RuntimeBindings,
): () => void {
  var jsxComponentsCheckbox: typeof import("react/jsx-runtime");
  var ComponentsCheckboxClassNames: string;
  var initializeComponentsCheckbox: () => void;
  function CheckboxGlyph({
    indeterminate = false,
  }: CheckboxGlyphProps): React.ReactElement {
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
  }: CheckboxVisualProps): React.ReactElement {
    let value = checked || indeterminate;
    return (
      <span
        data-checked={checked && !indeterminate ? "" : undefined}
        data-indeterminate={indeterminate ? "" : undefined}
        data-unchecked={value ? undefined : ""}
        className={(0, runtime.cn)(
          ComponentsCheckboxClassNames,
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
  bindRuntimeValue(runtime, "CheckboxGlyph", () => CheckboxGlyph);
  bindRuntimeValue(runtime, "CheckboxVisual", () => CheckboxVisual);
  bindRuntimeValue(
    runtime,
    "jsxComponentsCheckbox",
    () => jsxComponentsCheckbox,
    (value) => {
      jsxComponentsCheckbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCheckboxClassNames",
    () => ComponentsCheckboxClassNames,
    (value) => {
      ComponentsCheckboxClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCheckbox",
    () => initializeComponentsCheckbox,
    (value) => {
      initializeComponentsCheckbox = value;
    },
  );
  return () => {
    initializeComponentsCheckbox = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeComponentsIcon_2)();
      jsxComponentsCheckbox = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsCheckboxClassNames =
        "flex shrink-0 size-[var(--cds-checkbox)] items-center justify-center rounded-[var(--cds-checkbox-radius)] border border-strong bg-transparent";
    });
  };
}
