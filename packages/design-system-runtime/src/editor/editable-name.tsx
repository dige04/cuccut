import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorEditableName(
  runtime: RuntimeBindings,
): () => void {
  var reactTokenRename: typeof import("react");
  var jsxTokenRename: typeof import("react/jsx-runtime");
  var TOKEN_ROW_SELECTOR: string;
  var RENAME_NAME_SELECTOR: string;
  var RENAME_BUTTON_SELECTOR: string;
  function showEditorNotification(message: string, options?: number): void {
    (0, runtime.clearNonActionToasts)();
    (0, runtime.showToast)(message, options);
  }
  function showEditorPromiseNotification(
    promise: string,
    options: Parameters<RuntimeBindings["showActionToast"]>[1],
  ): number {
    (0, runtime.clearAllToasts)();
    return (0, runtime.showActionToast)(promise, options);
  }
  function validateTokenRename(
    name: string,
    currentName: string,
    taken: ReadonlySet<string>,
  ): string | null {
    if (name === "") {
      return "A token needs a name.";
    }
    if (!runtime.TOKEN_NAME_PATTERN.test(name)) {
      return (
        "“" + name + "” is not a token name — letters, digits, . _ and - only."
      );
    }
    if (name !== currentName && taken.has(name)) {
      return "“" + name + "” already exists.";
    }
    return null;
  }
  function normalizeSectionTitle(title: string, defaultTitle?: string): string {
    let value = title.replace(/\s+/g, " ").trim();
    if (value === defaultTitle) {
      return "";
    } else {
      return value;
    }
  }
  function captureRenameFocusContext(
    input: HTMLElement,
  ): Token.RenameFocusContext {
    return {
      doc: input.ownerDocument,
      scope: input.closest('section, table, [role="table"]'),
      inRow: input.closest(TOKEN_ROW_SELECTOR) !== null,
    };
  }
  function restoreRenameFocus(
    { doc: doc, scope: scope, inRow: inRow }: Token.RenameFocusContext,
    committedName: string,
    originalName: string,
  ): void {
    let callback = (input: ParentNode, options: string) => {
      return (
        [...input.querySelectorAll<HTMLElement>(RENAME_NAME_SELECTOR)]
          .find(
            (input2) =>
              input2.dataset.rnName === options &&
              (input2.closest(TOKEN_ROW_SELECTOR) !== null) === inRow,
          )
          ?.querySelector<HTMLElement>('[role="button"]') ?? undefined
      );
    };
    requestAnimationFrame((): void => {
      if (doc.activeElement !== null && doc.activeElement !== doc.body) {
        return;
      }
      let value = scope?.isConnected === true ? scope : doc;
      (
        callback(value, committedName) ??
        callback(doc, committedName) ??
        (originalName !== committedName
          ? (callback(value, originalName) ?? callback(doc, originalName))
          : undefined)
      )?.focus({
        preventScroll: true,
      });
    });
  }
  function EditableName({
    name: name,
    taken: taken,
    commit: commit,
    kind = "token",
    defaultTitle: defaultTitle,
    placeholder: placeholder,
    onEditing: onEditing,
    autoEdit = false,
    className: className,
    inputTestId: inputTestId,
    tabIndex = 0,
    ...props
  }: Token.EditableNameProps): React.ReactElement {
    let ref = reactTokenRename.useRef<Token.RenameFocusContext | null>(null),
      value: string =
        "ds-rn" +
        (kind === "title" ? " ds-rn-title" : "") +
        (className !== undefined ? " " + className : ""),
      callback = (input: string) => {
        if (commit === undefined) {
          return name;
        }
        if (kind === "title") {
          let value5 = input.replace(/\s+/g, " ").trim();
          if (value5 === name || (autoEdit && value5 === "")) {
            return name;
          }
          let value6 = normalizeSectionTitle(input, defaultTitle),
            value7 = commit(value6);
          if (value7 === false) {
            showEditorNotification("Could not rename " + name + ".");
            return name;
          }
          if (typeof value7 === "string") {
            return value7;
          } else {
            if (value6 === "") {
              return defaultTitle ?? name;
            } else {
              return value5;
            }
          }
        }
        let value2 = (0, runtime.normalizeTokenName)(input).replace(
          /\s+/g,
          "-",
        );
        if (value2 === name) {
          return name;
        }
        let value3 = validateTokenRename(value2, name, taken);
        if (value3 !== null) {
          showEditorNotification(value3);
          return name;
        }
        let value4 = commit(value2);
        if (value4 === false) {
          showEditorNotification("Could not rename " + name + ".");
          return name;
        }
        if (typeof value4 === "string") {
          return value4;
        } else {
          return value2;
        }
      },
      callback2 = (input: string): void => {
        let current = ref.current;
        ref.current = null;
        if (current !== null && tabIndex === 0) {
          restoreRenameFocus(current, input, name);
        }
      };
    return (
      <span
        className={"contents"}
        data-rn-name={commit !== undefined ? name : undefined}
        onKeyDownCapture={(
          event: React.KeyboardEvent<HTMLSpanElement> & {
            target: HTMLElement;
          },
        ): void => {
          let target = event.target;
          if (target.tagName !== "INPUT") {
            if (event.repeat && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              event.stopPropagation();
            }
            return;
          }
          if ((0, runtime.isComposingEvent)(event)) {
            return;
          }
          if (
            event.key === "Enter" ||
            event.key === "Tab" ||
            event.key === "Escape"
          ) {
            ref.current = captureRenameFocusContext(target);
          }
        }}
      >
        <runtime.EditableText
          value={name}
          readOnly={commit === undefined}
          onCommit={(input: string) => callback2(callback(input))}
          onEditingChange={(input: boolean): void => {
            if (input) {
              ref.current = null;
            }
            onEditing?.(input);
            if (!input) {
              callback2(name);
            }
          }}
          defaultEditing={autoEdit}
          initialDraft={autoEdit ? "" : undefined}
          placeholder={
            kind === "title" ? (placeholder ?? defaultTitle) : undefined
          }
          tabIndex={tabIndex}
          className={value}
          inputTestId={inputTestId}
          data-testid={props["data-testid"]}
        />
      </span>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactTokenRename",
    () => reactTokenRename,
    (value) => {
      reactTokenRename = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "showEditorNotification",
    () => showEditorNotification,
  );
  bindRuntimeValue(
    runtime,
    "showEditorPromiseNotification",
    () => showEditorPromiseNotification,
  );
  bindRuntimeValue(
    runtime,
    "jsxTokenRename",
    () => jsxTokenRename,
    (value) => {
      jsxTokenRename = value;
    },
  );
  bindRuntimeValue(runtime, "validateTokenRename", () => validateTokenRename);
  bindRuntimeValue(
    runtime,
    "normalizeSectionTitle",
    () => normalizeSectionTitle,
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_ROW_SELECTOR",
    () => TOKEN_ROW_SELECTOR,
    (value) => {
      TOKEN_ROW_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RENAME_NAME_SELECTOR",
    () => RENAME_NAME_SELECTOR,
    (value) => {
      RENAME_NAME_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RENAME_BUTTON_SELECTOR",
    () => RENAME_BUTTON_SELECTOR,
    (value) => {
      RENAME_BUTTON_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "captureRenameFocusContext",
    () => captureRenameFocusContext,
  );
  bindRuntimeValue(runtime, "restoreRenameFocus", () => restoreRenameFocus);
  bindRuntimeValue(runtime, "EditableName", () => EditableName);
  return () => {
    reactTokenRename = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxTokenRename = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    TOKEN_ROW_SELECTOR = ".ds-tokrow, tr";
    RENAME_NAME_SELECTOR = "[data-rn-name]";
    RENAME_BUTTON_SELECTOR = RENAME_NAME_SELECTOR + ' [role="button"]';
  };
}
