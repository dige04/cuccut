/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  OptionListProps,
} from "../contracts/composition";
export function installUiPropertySearch(runtime: RuntimeBindings): () => void {
  var SelectReact: ReactNamespace;
  var jsxCommentSelection: JsxNamespace;
  var COMMENT_AREA_RESIZE_MIN_PX: number;
  function optionMatchesQuery(
    query: string,
    ...values: (string | undefined)[]
  ) {
    let value = query.trim().toLowerCase();
    return (
      value === "" ||
      values.some(
        (input: string | undefined) =>
          input !== undefined && input.toLowerCase().includes(value),
      )
    );
  }
  function optionTypeaheadMatch(query: string, options: readonly string[]) {
    let value = query.trim().toLowerCase(),
      callback = (input: (value: string) => boolean) =>
        options.findIndex((input2: string) => input(input2.toLowerCase()));
    return (
      [
        callback((input: string) => input === value),
        callback((input: string) => input.startsWith(value)),
      ].find((input: number) => input >= 0) ?? 0
    );
  }
  function createOptionListKeyHandler(
    command: string,
    {
      across: options = false,
    }: {
      across?: boolean;
    } = {},
  ) {
    return (event: React.KeyboardEvent<HTMLElement>) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }
      let value =
          event.key === "ArrowUp" || (options && event.key === "ArrowLeft"),
        value2 =
          event.key === "ArrowDown" || (options && event.key === "ArrowRight");
      if (!value && !value2 && event.key !== "Home" && event.key !== "End") {
        return;
      }
      let target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      let value3 = Array.from<HTMLElement>(
          event.currentTarget.querySelectorAll<HTMLElement>(command),
        ).flatMap((input: HTMLElement) => {
          if (!input.matches(":disabled")) {
            return [input];
          }
          let parentElement = input.parentElement;
          if (
            parentElement !== null &&
            parentElement !== event.currentTarget &&
            parentElement.tabIndex >= 0 &&
            parentElement.firstElementChild === input &&
            parentElement.querySelectorAll<HTMLElement>(command).length === 1
          ) {
            return [parentElement];
          } else {
            return [];
          }
        }),
        value4 = value3.indexOf(target);
      if (value4 === -1) {
        return;
      }
      let value5 =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? value3.length - 1
            : (value4 + (value2 ? 1 : -1) + value3.length) % value3.length;
      event.preventDefault();
      value3[value5].focus();
    };
  }
  function OptionList({
    value: value,
    onChange: onChange,
    label: label,
    rowSelector: rowSelector,
    onEnterIndex: onEnterIndex,
    className: className,
    "data-testid": dataTestid,
  }: OptionListProps) {
    return (
      <div className={className ?? "mt-0.5 mb-2 w-0 min-w-full"}>
        <runtime.TextInput
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
          onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            let value2 = Array.from<HTMLElement>(
                event.currentTarget
                  .closest("[data-search-scope]")
                  ?.querySelectorAll<HTMLElement>(rowSelector) ?? [],
              ).filter((input: HTMLElement) => !input.matches(":disabled")),
              value3 =
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
            if (event.key !== "Escape" && event.key !== "Tab") {
              event.stopPropagation();
            }
          }}
          slotStart={
            <runtime.KitIcon
              name={"Search"}
              size={14}
              className={"text-muted"}
            />
          }
          placeholder={label}
          aria-label={label}
          clearable={true}
          onClear={() => onChange("")}
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
  bindRuntimeValue(
    runtime,
    "SelectReact",
    () => SelectReact,
    (value) => {
      SelectReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCommentSelection",
    () => jsxCommentSelection,
    (value) => {
      jsxCommentSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_AREA_RESIZE_MIN_PX",
    () => COMMENT_AREA_RESIZE_MIN_PX,
    (value) => {
      COMMENT_AREA_RESIZE_MIN_PX = value;
    },
  );
  bindRuntimeValue(runtime, "optionMatchesQuery", () => optionMatchesQuery);
  bindRuntimeValue(runtime, "optionTypeaheadMatch", () => optionTypeaheadMatch);
  bindRuntimeValue(
    runtime,
    "createOptionListKeyHandler",
    () => createOptionListKeyHandler,
  );
  bindRuntimeValue(runtime, "OptionList", () => OptionList);
  return () => {
    SelectReact = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxCommentSelection = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COMMENT_AREA_RESIZE_MIN_PX = 12;
  };
}
