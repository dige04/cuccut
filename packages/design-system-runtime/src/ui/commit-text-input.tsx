/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  CommitTextInputProps,
  EditableTextProps,
} from "../contracts/composition";
export function installUiCommitTextInput(runtime: RuntimeBindings): () => void {
  var jsxSC: JsxNamespace;
  var reactJW: ReactNamespace;
  var jsxForUiCommitTextInput: JsxNamespace;
  function AppDesignProvider({ children: children }: React.PropsWithChildren) {
    return (
      <runtime.CdsRoot
        density={runtime.APP_DENSITY}
        font={"anthropic"}
        className={"contents"}
      >
        <runtime.TooltipImplementationProvider>
          <runtime.ToastProvider>{children}</runtime.ToastProvider>
        </runtime.TooltipImplementationProvider>
      </runtime.CdsRoot>
    );
  }
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
  }: CommitTextInputProps) {
    let [value2, value3] = reactJW.useState(value),
      ref = reactJW.useRef(false),
      ref2 = reactJW.useRef(false),
      ref3 = reactJW.useRef(false),
      ref4 = reactJW.useRef<HTMLInputElement | null>(null);
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
    return (
      <input
        {...remainingProps}
        ref={ref4}
        className={(0, runtime.joinClassNames)("kit-rn-in", className)}
        value={value2}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete={"off"}
        size={Math.max(2, value4.length + 1)}
        onChange={(input: React.ChangeEvent<HTMLInputElement>) => {
          value3(input.currentTarget.value);
          onChange?.(input.currentTarget.value);
        }}
        onBlur={(input: React.FocusEvent<HTMLInputElement>) => {
          onBlur?.(input);
          callback();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
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
        }}
      />
    );
  }
  function EditableText({
    value: value,
    onCommit: onCommit,
    readOnly = false,
    onEditingChange: onEditingChange,
    defaultEditing = false,
    initialDraft: initialDraft,
    placeholder: placeholder,
    maxLength: maxLength,
    tabIndex = 0,
    className: className,
    inputTestId: inputTestId,
    "aria-label": ariaLabel,
    "data-testid": testId,
  }: EditableTextProps) {
    let [editing, setEditing] = reactJW.useState(defaultEditing && !readOnly),
      initialRenderRef = reactJW.useRef(true),
      editingChangeRef = reactJW.useRef(onEditingChange);
    editingChangeRef.current = onEditingChange;
    let previousEditingRef = reactJW.useRef(false),
      inputRef = reactJW.useRef<HTMLSpanElement | null>(null),
      cancelledRef = reactJW.useRef(false);
    reactJW.useLayoutEffect(() => {
      if (editing !== previousEditingRef.current) {
        previousEditingRef.current = editing;
        editingChangeRef.current?.(editing);
      }
      if (!editing && cancelledRef.current) {
        cancelledRef.current = false;
        inputRef.current?.focus({
          preventScroll: true,
        });
      }
    }, [editing]);
    let callback = (input: boolean) => {
      initialRenderRef.current = false;
      cancelledRef.current = input;
      setEditing(false);
    };
    if (readOnly) {
      return (
        <span
          className={(0, runtime.joinClassNames)("kit-rn", className)}
          data-testid={testId}
        >
          {value}
        </span>
      );
    }
    if (!editing) {
      return (
        <span
          ref={inputRef}
          className={(0, runtime.joinClassNames)(
            "kit-rn kit-rn-editable",
            className,
          )}
          role={"button"}
          tabIndex={tabIndex}
          aria-description={"Click to rename"}
          data-testid={testId}
          onClick={(input: React.MouseEvent<HTMLSpanElement>) => {
            input.stopPropagation();
            setEditing(true);
          }}
          onKeyDown={(event: React.KeyboardEvent<HTMLSpanElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              setEditing(true);
            }
          }}
        >
          {value}
        </span>
      );
    }
    return (
      <span
        className={(0, runtime.joinClassNames)("kit-rn-on", className)}
        onClick={(input: React.MouseEvent<HTMLSpanElement>) =>
          input.stopPropagation()
        }
      >
        <CommitTextInput
          value={
            initialRenderRef.current && initialDraft !== undefined
              ? initialDraft
              : value
          }
          placeholder={placeholder}
          maxLength={maxLength}
          aria-label={ariaLabel ?? "Rename " + value}
          data-testid={
            inputTestId ??
            (testId !== undefined ? testId + "-input" : undefined)
          }
          onCommit={(input: string, options: "enter" | "blur") => {
            callback(options === "enter");
            onCommit(input);
          }}
          onCancel={() => callback(true)}
        />
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxSC",
    () => jsxSC,
    (value) => {
      jsxSC = value;
    },
  );
  bindRuntimeValue(runtime, "AppDesignProvider", () => AppDesignProvider);
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
    "jsxForUiCommitTextInput",
    () => jsxForUiCommitTextInput,
    (value) => {
      jsxForUiCommitTextInput = value;
    },
  );
  bindRuntimeValue(runtime, "CommitTextInput", () => CommitTextInput);
  bindRuntimeValue(runtime, "EditableText", () => EditableText);
  return () => {
    jsxSC = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    reactJW = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiCommitTextInput = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
