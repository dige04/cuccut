/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";

type CommitSource = "enter" | "blur";
export interface CommitTextInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "onKeyDown" | "className" | "placeholder" | "size"
> {
  value: string;
  /** Called once when editing ends, by Enter or by losing focus. */
  onCommit: (value: string, source: CommitSource) => void;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  selectOnOpen?: boolean;
  className?: string;
  placeholder?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactJW: ReactNamespace;
    jsxlp0: JsxNamespace;
    CommitTextInput: (props: CommitTextInputProps) => React.ReactElement;
  }
}

export function installUiCommitTextInput(runtime: RuntimeBindings): () => void {
  var reactJW: ReactNamespace;
  var jsxlp0: JsxNamespace;
  function CommitTextInput({
    value: value,
    onCommit: onCommit,
    onCancel: onCancel,
    onChange: onChange,
    selectOnOpen = true,
    className: className,
    placeholder: placeholder,
    onKeyDown: onKeyDown,
    onBlur: onBlur,
    ...remainingProps
  }: CommitTextInputProps): React.ReactElement {
    let [value2, value3] = reactJW.useState(value),
      ref = reactJW.useRef(false),
      ref2 = reactJW.useRef(false),
      ref3 = reactJW.useRef(false),
      ref4 = reactJW.useRef<HTMLInputElement>(null);
    reactJW.useEffect(() => {
      let current = ref4.current;
      if (current === null) {
        return;
      }
      current.focus({
        preventScroll: true,
      });
      if (selectOnOpen) {
        current.select();
      } else {
        current.setSelectionRange(current.value.length, current.value.length);
      }
    }, [selectOnOpen]);
    let callback = () => {
        if (ref3.current) {
          return;
        }
        ref3.current = true;
        if (ref.current) {
          ref.current = false;
          onCancel?.();
          return;
        }
        onCommit(value2, ref2.current ? "enter" : "blur");
      },
      value4 = value2 !== "" ? value2 : (placeholder ?? "");
    return jsxlp0.jsx("input", {
      ...remainingProps,
      ref: ref4,
      className: (0, runtime.joinClassNames)("kit-rn-in", className),
      value: value2,
      placeholder: placeholder,
      spellCheck: false,
      autoComplete: "off",
      size: Math.max(2, value4.length + 1),
      onChange: (input: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
        value3(input.currentTarget.value);
        onChange?.(input.currentTarget.value);
      },
      onBlur: (input: React.FocusEvent<HTMLInputElement, Element>) => {
        onBlur?.(input);
        callback();
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(event);
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          ref2.current = true;
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          ref.current = true;
          event.currentTarget.blur();
        }
      },
    });
  }
  bindRuntimeValue(
    runtime,
    "reactJW",
    () => reactJW,
    (value) => {
      reactJW = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxlp0",
    () => jsxlp0,
    (value) => {
      jsxlp0 = value;
    },
  );
  bindRuntimeValue(runtime, "CommitTextInput", () => CommitTextInput);
  return () => {
    (0, runtime.initializeUiNumberControls2)();
    reactJW = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxlp0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
