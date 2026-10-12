/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type * as React from "react";

export interface OptionListKeyHandlerOptions {
  /** Also move with the left and right arrow keys (for rows laid out horizontally). */
  across?: boolean;
}
export interface OptionListProps {
  /** Current search text. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Selector for the option rows the arrow keys jump to. */
  rowSelector: string;
  /** Index of the row Enter activates (among the enabled rows); defaults to the first. */
  onEnterIndex?: () => number;
  className?: string;
  "data-testid"?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxForUiPropertySearch: JsxNamespace;
    optionMatchesQuery: (query: string, ...values: (string | undefined)[]) => boolean;
    optionTypeaheadMatch: (query: string, options: readonly string[]) => number;
    createOptionListKeyHandler: (
      command: string,
      options?: OptionListKeyHandlerOptions,
    ) => (event: React.KeyboardEvent<HTMLElement>) => void;
    OptionList: (props: OptionListProps) => React.ReactElement;
    /** Option count above which a list gets a search box. */
    OPTION_LIST_MAX_HEIGHT: number;
    initializeUiPropertySearch: () => void;
  }
}

export function installUiPropertySearch(runtime: RuntimeBindings): () => void {
  var jsxForUiPropertySearch: JsxNamespace;
  var OPTION_LIST_MAX_HEIGHT: number;
  var initializeUiPropertySearch: () => void;
  function optionMatchesQuery(query: string, ...values: (string | undefined)[]): boolean {
    let value = query.trim().toLowerCase();
    return (
      value === "" ||
      values.some(
        (input) =>
          input !== undefined && input.toLowerCase().includes(value),
      )
    );
  }
  function optionTypeaheadMatch(query: string, options: readonly string[]): number {
    let value = query.trim().toLowerCase(),
      callback = (input: (option: string) => boolean): number =>
        options.findIndex(
          (input2: string): boolean => input(input2.toLowerCase()),
        );
    return (
      [
        callback((input: string): boolean => input === value),
        callback((input: string): boolean => input.startsWith(value)),
      ].find((input) => input >= 0) ?? 0
    );
  }
  function createOptionListKeyHandler(
    command: string,
    { across: options = false }: OptionListKeyHandlerOptions = {},
  ): (event: React.KeyboardEvent<HTMLElement>) => void {
    return (event: React.KeyboardEvent<HTMLElement>): void => {
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
      let value3 = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(command),
        ).flatMap((input) => {
          if (!input.matches(":disabled")) {
            return [input];
          }
          let parentElement = input.parentElement;
          if (
            parentElement !== null &&
            parentElement !== event.currentTarget &&
            parentElement.tabIndex >= 0 &&
            parentElement.firstElementChild === input &&
            parentElement.querySelectorAll(command).length === 1
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
      value3[value5]!.focus();
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
  }: OptionListProps): React.ReactElement {
    return jsxForUiPropertySearch.jsx("div", {
      className: className ?? "mt-0.5 mb-2 w-0 min-w-full",
      children: jsxForUiPropertySearch.jsx(runtime.TextInput, {
        value: value,
        onChange: (event: React.ChangeEvent<HTMLInputElement>): void => onChange(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>): void => {
          if (event.nativeEvent.isComposing) {
            return;
          }
          let value2 = Array.from<HTMLElement>(
              event.currentTarget
                .closest("[data-search-scope]")
                ?.querySelectorAll<HTMLElement>(rowSelector) ?? [],
            ).filter((input): boolean => !input.matches(":disabled")),
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
        },
        slotStart: jsxForUiPropertySearch.jsx(runtime.KitIcon, {
          name: "Search",
          size: 14,
          className: "text-muted",
        }),
        placeholder: label,
        "aria-label": label,
        clearable: true,
        onClear: () => onChange(""),
        autoComplete: "off",
        spellCheck: false,
        "data-testid": dataTestid,
        "data-kit-search": "",
        "data-kit": "list-search",
        className: "w-full",
      }),
    });
  }
  bindRuntimeValue(runtime, "optionMatchesQuery", () => optionMatchesQuery);
  bindRuntimeValue(runtime, "optionTypeaheadMatch", () => optionTypeaheadMatch);
  bindRuntimeValue(
    runtime,
    "createOptionListKeyHandler",
    () => createOptionListKeyHandler,
  );
  bindRuntimeValue(runtime, "OptionList", () => OptionList);
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertySearch",
    () => jsxForUiPropertySearch,
    (value) => {
      jsxForUiPropertySearch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPTION_LIST_MAX_HEIGHT",
    () => OPTION_LIST_MAX_HEIGHT,
    (value) => {
      OPTION_LIST_MAX_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertySearch",
    () => initializeUiPropertySearch,
    (value) => {
      initializeUiPropertySearch = value;
    },
  );
  return () => {
    OPTION_LIST_MAX_HEIGHT = 12;
    initializeUiPropertySearch = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiPropertyIcons)();
      jsxForUiPropertySearch = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}
