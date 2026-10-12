/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode, MouseEvent as ReactMouseEvent } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { ArtifactClipboardPayload } from "../host/artifact-clipboard";
import type { ContextMenuPoint, ContextMenuPopupProps } from "./context-menu-popup";

/** Ids of the built-in edit commands that come with a label and shortcut. */
export type EditCommandId =
  | "cut"
  | "copy"
  | "paste"
  | "duplicate"
  | "front"
  | "back"
  | "group"
  | "ungroup"
  | "delete"
  | "select-all";
/** Label and shortcut of a built-in edit command. */
export interface EditCommandDefinition {
  label: string;
  shortcut: string;
}
/** The built-in commands by id; any other id yields `undefined`. */
export interface EditCommandDefinitions
  extends Record<EditCommandId, EditCommandDefinition> {
  [id: string]: EditCommandDefinition | undefined;
}
/** A menu entry with its own label and shortcut instead of a built-in command id. */
export interface EditCommandItem {
  id: string;
  label: string;
  shortcut?: string;
}
/** One separator-delimited group of menu commands: built-in ids or custom items. */
export type EditCommandGroup = Array<string | EditCommandItem>;
export interface EditCommandMenuItemsProps {
  groups: EditCommandGroup[];
  /** Why a command is unavailable, keyed by command id. */
  refusals: Partial<Record<string, string>>;
  /** Show single-key shortcuts such as "]" too. */
  plainKeys?: boolean;
  onCommand: (id: string, event?: ReactMouseEvent<HTMLElement>) => void;
}
/** Where the menu opens and how it was raised. */
export interface EditContextMenuAnchor extends ContextMenuPoint {
  from?: string;
  /** True when opened from the keyboard, so the first item takes focus. */
  keyboard?: boolean;
}
export interface EditContextMenuProps extends EditCommandMenuItemsProps {
  at: EditContextMenuAnchor | null;
  /** Accessible name of the menu. */
  name?: string;
  className?: string;
  returnFocus?: ContextMenuPopupProps["returnFocus"];
  onClose: () => void;
}
/** A rectangle in viewport coordinates. */
export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** The pointer state the context click checks read. */
export type ContextClickPointer = Pick<
  PointerEvent,
  "pointerType" | "button" | "ctrlKey"
>;

declare module "../bindings" {
  interface RuntimeBindings {
    isMacControlClick: (event: ContextClickPointer) => boolean;
    isPlainMousePointer: (event: ContextClickPointer) => boolean;
    isContextMenuEditingTarget: (target: Element | null | undefined) => boolean;
    jsxCv: JsxNamespace;
    EDIT_COMMAND_DEFINITIONS: EditCommandDefinitions;
    EditCommandMenuItems: (props: EditCommandMenuItemsProps) => ReactNode;
    EditContextMenu: (props: EditContextMenuProps) => ReactElement;
    contextMenuAnchorPoint: (
      element: AnchorRect | null,
      container: AnchorRect,
    ) => ContextMenuPoint;
    /** Message shown when the menu can only paste what was just copied from it. */
    internalPasteOnlyMessage: (kind: string) => string;
    copySelectionForCommand: (
      command: "cut" | "copy",
      kind: string,
      payload: ArtifactClipboardPayload,
    ) => boolean;
    isContextMenuKey: (event: Pick<KeyboardEvent, "key" | "shiftKey">) => boolean;
  }
}

export function installUiEditContextMenu(runtime: RuntimeBindings): () => void {
  var isMacControlClick: RuntimeBindings["isMacControlClick"];
  var isPlainMousePointer: RuntimeBindings["isPlainMousePointer"];
  var isContextMenuEditingTarget: RuntimeBindings["isContextMenuEditingTarget"];
  var jsxCv: JsxNamespace;
  var EDIT_COMMAND_DEFINITIONS: RuntimeBindings["EDIT_COMMAND_DEFINITIONS"];
  var internalPasteOnlyMessage: RuntimeBindings["internalPasteOnlyMessage"];
  var isContextMenuKey: RuntimeBindings["isContextMenuKey"];
  function EditCommandMenuItems({
    groups: groups,
    refusals: refusals,
    plainKeys = true,
    onCommand: onCommand,
  }: EditCommandMenuItemsProps): ReactNode {
    return groups.flatMap(
      (input: EditCommandGroup, options: number): Array<ReactElement | null> => [
        options > 0
          ? jsxCv.jsx(
              runtime.Menu.Separator,
              {},
              "separator-" + String(options),
            )
          : null,
        ...input.map((input2: string | EditCommandItem): ReactElement => {
          let {
            id: value,
            label: value2,
            shortcut: value3,
          } = typeof input2 === "string"
            ? {
                id: input2,
                ...EDIT_COMMAND_DEFINITIONS[input2],
              }
            : input2;
          return jsxCv.jsx(
            runtime.Menu.Item,
            {
              shortcut: plainKeys || value3?.length !== 1 ? value3 : undefined,
              variant: value === "delete" ? "danger" : undefined,
              disabled: refusals[value] !== undefined,
              disabledReason: refusals[value] ?? null,
              onClick: (input3?: ReactMouseEvent<HTMLElement>): void =>
                onCommand(value, input3),
              children: value2,
            },
            value,
          );
        }),
      ],
    );
  }
  function EditContextMenu({
    at: at,
    name: name,
    className: className,
    returnFocus: returnFocus,
    onClose: onClose,
    ...remainingProps
  }: EditContextMenuProps): ReactElement {
    return jsxCv.jsx(runtime.ContextMenuPopup, {
      at: at,
      "aria-label": name,
      focusFirstItem: at?.from === "key" || at?.keyboard === true,
      className: className,
      returnFocus: returnFocus,
      onClose: onClose,
      children: jsxCv.jsx(EditCommandMenuItems, {
        ...remainingProps,
      }),
    });
  }
  function contextMenuAnchorPoint(
    element: AnchorRect | null,
    container: AnchorRect,
  ): ContextMenuPoint {
    let callback = (
        input: number,
        options: number,
        context: number,
      ): number =>
        Math.min(Math.max(input, options + 8), options + context - 8),
      value =
        element === null
          ? container.left + container.width / 2
          : element.left + Math.min(40, element.width / 2),
      value2 =
        element === null
          ? container.top + container.height / 2
          : element.top + Math.min(24, element.height / 2);
    return {
      x: callback(value, container.left, container.width),
      y: callback(value2, container.top, container.height),
    };
  }
  function copySelectionForCommand(
    command: "cut" | "copy",
    kind: string,
    payload: ArtifactClipboardPayload,
  ): boolean {
    if ((0, runtime.copyArtifactToClipboard)(kind, payload)) {
      return true;
    }
    (0, runtime.showToast)(
      "That could not be " +
        (command === "cut" ? "cut" : "copied") +
        ". Press " +
        (0, runtime.formatCommandShortcut)(command === "cut" ? "X" : "C") +
        " instead.",
    );
    return false;
  }
  bindRuntimeValue(
    runtime,
    "isMacControlClick",
    () => isMacControlClick,
    (value) => {
      isMacControlClick = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPlainMousePointer",
    () => isPlainMousePointer,
    (value) => {
      isPlainMousePointer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isContextMenuEditingTarget",
    () => isContextMenuEditingTarget,
    (value) => {
      isContextMenuEditingTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCv",
    () => jsxCv,
    (value) => {
      jsxCv = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDIT_COMMAND_DEFINITIONS",
    () => EDIT_COMMAND_DEFINITIONS,
    (value) => {
      EDIT_COMMAND_DEFINITIONS = value;
    },
  );
  bindRuntimeValue(runtime, "EditCommandMenuItems", () => EditCommandMenuItems);
  bindRuntimeValue(runtime, "EditContextMenu", () => EditContextMenu);
  bindRuntimeValue(
    runtime,
    "contextMenuAnchorPoint",
    () => contextMenuAnchorPoint,
  );
  bindRuntimeValue(
    runtime,
    "internalPasteOnlyMessage",
    () => internalPasteOnlyMessage,
    (value) => {
      internalPasteOnlyMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "copySelectionForCommand",
    () => copySelectionForCommand,
  );
  bindRuntimeValue(
    runtime,
    "isContextMenuKey",
    () => isContextMenuKey,
    (value) => {
      isContextMenuKey = value;
    },
  );
  return () => {
    isMacControlClick = (event: ContextClickPointer): boolean =>
      event.pointerType === "mouse" &&
      event.button === 0 &&
      event.ctrlKey === true &&
      (0, runtime.isApplePlatform)();
    isPlainMousePointer = (event: ContextClickPointer): boolean =>
      event.button !== 2 &&
      !(event.ctrlKey && (0, runtime.isApplePlatform)()) &&
      event.pointerType !== "pen" &&
      event.pointerType !== "touch";
    isContextMenuEditingTarget = (target: Element | null | undefined): boolean =>
      target?.closest?.(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ) != null;
    (0, runtime.initializeUiInputs210)();
    jsxCv = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    EDIT_COMMAND_DEFINITIONS = {
      cut: {
        label: "Cut",
        shortcut: "cmd+x",
      },
      copy: {
        label: "Copy",
        shortcut: "cmd+c",
      },
      paste: {
        label: "Paste",
        shortcut: "cmd+v",
      },
      duplicate: {
        label: "Duplicate",
        shortcut: "cmd+d",
      },
      front: {
        label: "Bring to front",
        shortcut: "]",
      },
      back: {
        label: "Send to back",
        shortcut: "[",
      },
      group: {
        label: "Group",
        shortcut: "cmd+g",
      },
      ungroup: {
        label: "Ungroup",
        shortcut: "shift+cmd+g",
      },
      delete: {
        label: "Delete",
        shortcut: "backspace",
      },
      "select-all": {
        label: "Select all",
        shortcut: "cmd+a",
      },
    };
    internalPasteOnlyMessage = (kind: string): string =>
      "This menu can only paste " +
      kind +
      " you have just copied here. Press " +
      (0, runtime.formatCommandShortcut)("V") +
      " to paste anything else.";
    isContextMenuKey = (event: Pick<KeyboardEvent, "key" | "shiftKey">): boolean =>
      event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
  };
}
