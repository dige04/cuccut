/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesPickerSearch(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesPickerSearch: Dynamic;
  var joinClassNamesValue_3: Dynamic;
  var PropertiesPickerSearchMdLgConfig: Dynamic;
  function pickerSearchMatches(
    input?: Dynamic,
    ...options: Dynamic[]
  ): Dynamic {
    let value: Dynamic = input.trim().toLowerCase();
    return (
      value === "" ||
      options.some(
        (input2?: Dynamic): Dynamic =>
          input2 !== undefined && input2.toLowerCase().includes(value),
      )
    );
  }
  function pickerSearchInitialIndex(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.trim().toLowerCase(),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        options.findIndex(
          (input3?: Dynamic): Dynamic => input2(input3.toLowerCase()),
        );
    return (
      [
        callback((input2?: Dynamic): Dynamic => input2 === value),
        callback((input2?: Dynamic): Dynamic => input2.startsWith(value)),
      ].find((input2?: Dynamic): Dynamic => input2 >= 0) ?? 0
    );
  }
  function pickerSearchKeyHandler(
    input?: Dynamic,
    { across: options = false }: Dynamic = {},
  ): Dynamic {
    return (event?: Dynamic): Dynamic => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.nativeEvent.isComposing
      )
        return;
      let value: Dynamic =
          event.key === "ArrowUp" || (options && event.key === "ArrowLeft"),
        value2: Dynamic =
          event.key === "ArrowDown" || (options && event.key === "ArrowRight");
      if (!value && !value2 && event.key !== "Home" && event.key !== "End")
        return;
      let target: Dynamic = event.target;
      if (!(target instanceof HTMLElement)) return;
      let value3: Dynamic = Array.from(
          event.currentTarget.querySelectorAll(input),
        ).flatMap((input2?: Dynamic): Dynamic => {
          if (!input2.matches(":disabled")) return [input2];
          let parentElement: Dynamic = input2.parentElement;
          return parentElement !== null &&
            parentElement !== event.currentTarget &&
            parentElement.tabIndex >= 0 &&
            parentElement.firstElementChild === input2 &&
            parentElement.querySelectorAll(input).length === 1
            ? [parentElement]
            : [];
        }),
        value4: Dynamic = value3.indexOf(target);
      if (value4 === -1) return;
      let value5: Dynamic =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? value3.length - 1
            : (value4 + (value2 ? 1 : -1) + value3.length) % value3.length;
      event.preventDefault();
      value3[value5].focus();
    };
  }
  function PickerSearchInput({
    value: value,
    onChange: onChange,
    label: label,
    rowSelector: rowSelector,
    onEnterIndex: onEnterIndex,
    className: className,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    return (
      <div className={className ?? "mt-0.5 mb-2 w-0 min-w-full"}>
        <runtime.TextInput
          value={value}
          onChange={(event?: Dynamic): Dynamic => onChange(event.target.value)}
          onKeyDown={(event?: Dynamic): Dynamic => {
            if (event.nativeEvent.isComposing) return;
            let value2: Dynamic = Array.from(
                event.currentTarget
                  .closest("[data-search-scope]")
                  ?.querySelectorAll(rowSelector) ?? [],
              ).filter(
                (input?: Dynamic): Dynamic => !input.matches(":disabled"),
              ),
              value3: Dynamic =
                event.key === "ArrowDown"
                  ? value2[0]
                  : event.key === "ArrowUp"
                    ? value2[value2.length - 1]
                    : undefined;
            if (value3 !== undefined) {
              event.preventDefault();
              value3.focus();
            } else if (
              event.key === "Enter" &&
              value.trim() !== "" &&
              value2.length > 0
            ) {
              event.preventDefault();
              value2[onEnterIndex?.() ?? 0]?.click();
            } else if (event.key === "Escape" && value !== "") {
              event.preventDefault();
              event.stopPropagation();
              onChange("");
              return;
            }
            event.key !== "Escape" &&
              event.key !== "Tab" &&
              event.stopPropagation();
          }}
          slotStart={
            <runtime.EditorIcon
              name={"Search"}
              size={14}
              className={"text-muted"}
            />
          }
          placeholder={label}
          aria-label={label}
          clearable={true}
          onClear={(): Dynamic => onChange("")}
          autoComplete={"off"}
          spellCheck={false}
          data-testid={dataTestid}
          data-kit-search={""}
          data-kit={"list-search"}
          className={"w-full"}
        />
      </div>
    );
  }
  bindRuntimeValue(runtime, "pickerSearchMatches", () => pickerSearchMatches);
  bindRuntimeValue(
    runtime,
    "pickerSearchInitialIndex",
    () => pickerSearchInitialIndex,
  );
  bindRuntimeValue(
    runtime,
    "pickerSearchKeyHandler",
    () => pickerSearchKeyHandler,
  );
  bindRuntimeValue(runtime, "PickerSearchInput", () => PickerSearchInput);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesPickerSearch",
    () => jsxPropertiesPickerSearch,
    (value) => {
      jsxPropertiesPickerSearch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "joinClassNamesValue_3",
    () => joinClassNamesValue_3,
    (value) => {
      joinClassNamesValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesPickerSearchMdLgConfig",
    () => PropertiesPickerSearchMdLgConfig,
    (value) => {
      PropertiesPickerSearchMdLgConfig = value;
    },
  );
  return () => {
    jsxPropertiesPickerSearch = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    joinClassNamesValue_3 = (0, runtime.joinClassNames)(
      "group/select flex h-control min-w-0 items-center gap-1.5 border-0 pl-md pr-sm text-left font-sans text-body enabled:cursor-default pointer-coarse:h-10",
      runtime.PropertiesPrimitivesClassNames,
    );
    PropertiesPickerSearchMdLgConfig = {
      md: "min-h-6",
      lg: "min-h-7",
    };
  };
}
