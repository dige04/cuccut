/** Restored application module; prepare first, initialize in original order. */
import type {
  ChangeEvent,
  FocusEventHandler,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  MouseEventHandler,
  PointerEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** List styles a text element can have. */
export type TextListKind = "none" | "bullet" | "number";

export interface TextListOption {
  value: TextListKind;
  label: string;
  icon: string;
}

export interface LinkEditorProps {
  value: string;
  invalid?: boolean;
  /** Tooltip shown while the draft is invalid. */
  invalidHint?: string;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onCancel: () => void;
  /** Present when an existing link can be removed. */
  onRemove?: () => void;
}

/** Explanations shown instead of the action when it is unavailable, keyed by button. */
export interface SelectionActionDisabledReasons {
  comment?: string;
  delete?: string;
  more?: string;
}

export interface SelectionActionButtonsProps {
  /** Content placed before the buttons. */
  lead?: ReactNode;
  /** Opens the comment composer anchored to the button; null hides the button. */
  onComment: ((anchor: HTMLElement) => void) | null;
  /** Delete handler; the button shows only on coarse pointers. */
  onDelete?: MouseEventHandler<HTMLElement>;
  deleteTitle?: string;
  onOpenInspector?: MouseEventHandler<HTMLElement>;
  disabledReason?: string | SelectionActionDisabledReasons;
  moreMenu?: { label?: string; open?: boolean };
  testids?: { comment?: string; delete?: string; more?: string };
}

declare module "../bindings" {
  interface RuntimeBindings {
    reacttv_: ReactNamespace;
    jsxNY: JsxNamespace;
    TEXT_LIST_LABELS: Record<TextListKind, string>;
    TEXT_LIST_OPTIONS: TextListOption[];
    LINK_INPUT_CLASS: string;
    LinkEditor: (props: LinkEditorProps) => ReactElement;
    normalizeExternalLink: (value: string) => string | null;
    SelectionActionButtons: (
      props: SelectionActionButtonsProps,
    ) => ReactElement | null;
  }
}

export function installUiSelectionActions(
  runtime: RuntimeBindings,
): () => void {
  var reacttv_: ReactNamespace;
  var jsxNY: JsxNamespace;
  var TEXT_LIST_LABELS: Record<TextListKind, string>;
  var TEXT_LIST_OPTIONS: TextListOption[];
  var LINK_INPUT_CLASS: string;
  function LinkEditor({
    value: value,
    invalid: invalid,
    invalidHint: invalidHint,
    onChange: onChange,
    onKeyDown: onKeyDown,
    onBlur: onBlur,
    onCancel: onCancel,
    onRemove: onRemove,
  }: LinkEditorProps): ReactElement {
    return jsxNY.jsxs("span", {
      className: "flex items-center gap-1",
      "data-link-mode": "",
      onKeyDown: (event: ReactKeyboardEvent<HTMLSpanElement>): void => {
        if (event.key !== "Escape" || event.defaultPrevented) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      },
      children: [
        jsxNY.jsx("span", {
          "aria-hidden": "true",
          className:
            "inline-flex h-6 w-6 items-center justify-center text-muted",
          children: jsxNY.jsx(runtime.KitIcon, {
            name: "Link",
          }),
        }),
        jsxNY.jsx("input", {
          autoFocus: true,
          "aria-label": "Link URL",
          placeholder: "https://…",
          value: value,
          "aria-invalid": invalid || undefined,
          onChange: (event: ChangeEvent<HTMLInputElement>): void =>
            onChange(event.target.value),
          onPointerDown: (input: PointerEvent<HTMLInputElement>): void =>
            input.stopPropagation(),
          onBlur: onBlur,
          onKeyDown: (input: ReactKeyboardEvent<HTMLInputElement>): void => {
            input.stopPropagation();
            onKeyDown(input);
          },
          className: LINK_INPUT_CLASS,
          title: invalid
            ? (invalidHint ?? "Enter an http:// or https:// address")
            : undefined,
        }),
        onRemove !== undefined &&
          jsxNY.jsx(runtime.ToolbarStripButton, {
            icon: "Trash",
            "aria-label": "Remove link",
            title: "Remove the link",
            onClick: onRemove,
          }),
        jsxNY.jsx(runtime.ToolbarStripButton, {
          icon: "X",
          "aria-label": "Cancel link",
          title: "Cancel (Esc)",
          onClick: onCancel,
        }),
      ],
    });
  }
  function normalizeExternalLink(value: string): string | null {
    let value2 = /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : "https://" + value.trim();
    value2 = value2.replace(/^https?:\/\//i, (input) => input.toLowerCase());
    if (/^https?:\/\/\S+$/.test(value2) && value2.length <= 2048) {
      return value2;
    } else {
      return null;
    }
  }
  function SelectionActionButtons({
    lead: lead,
    onComment: onComment,
    onDelete: onDelete,
    deleteTitle = "Delete this element",
    onOpenInspector: onOpenInspector,
    disabledReason: disabledReason,
    moreMenu: moreMenu,
    testids: testids,
  }: SelectionActionButtonsProps): ReactElement | null {
    let value = (0, runtime.useCoarsePointer)() ? onDelete : undefined,
      value2: SelectionActionDisabledReasons =
        typeof disabledReason === "string"
          ? {
              more: disabledReason,
            }
          : (disabledReason ?? {});
    if (
      lead == null &&
      onComment === null &&
      value === undefined &&
      onOpenInspector === undefined &&
      value2.more === undefined
    ) {
      return null;
    }
    return jsxNY.jsxs(runtime.ToolbarGroup, {
      children: [
        lead,
        onComment !== null &&
          jsxNY.jsx(runtime.ToolbarStripButton, {
            icon: "ChatAdd",
            "data-testid": testids?.comment,
            title: value2.comment ?? "Comment on this element",
            "aria-label": "Comment",
            disabled: value2.comment !== undefined,
            onClick: (input: MouseEvent<HTMLElement>): void =>
              onComment(input.currentTarget),
          }),
        value !== undefined &&
          jsxNY.jsx(runtime.ToolbarStripButton, {
            icon: "Trash",
            "data-testid": testids?.delete ?? "frame-delete",
            title: value2.delete ?? deleteTitle,
            "aria-label": "Delete",
            disabled: value2.delete !== undefined,
            onClick: value,
          }),
        (onOpenInspector !== undefined || value2.more !== undefined) &&
          jsxNY.jsx(runtime.ToolbarStripButton, {
            icon: "DotsVertical",
            "data-testid": testids?.more ?? "frame-more",
            title:
              value2.more ?? moreMenu?.label ?? "Open the Properties panel",
            "aria-label": moreMenu?.label ?? "Properties",
            "aria-haspopup": moreMenu ? "menu" : undefined,
            "aria-expanded": moreMenu?.open,
            disabled: value2.more !== undefined,
            onClick: onOpenInspector,
          }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reacttv_",
    () => reacttv_,
    (value) => {
      reacttv_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxNY",
    () => jsxNY,
    (value) => {
      jsxNY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LIST_LABELS",
    () => TEXT_LIST_LABELS,
    (value) => {
      TEXT_LIST_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LIST_OPTIONS",
    () => TEXT_LIST_OPTIONS,
    (value) => {
      TEXT_LIST_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LINK_INPUT_CLASS",
    () => LINK_INPUT_CLASS,
    (value) => {
      LINK_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "LinkEditor", () => LinkEditor);
  bindRuntimeValue(
    runtime,
    "normalizeExternalLink",
    () => normalizeExternalLink,
  );
  bindRuntimeValue(
    runtime,
    "SelectionActionButtons",
    () => SelectionActionButtons,
  );
  return () => {
    (0, runtime.initializeUiPropertyIcons)();
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeUiPointerMedia)();
    reacttv_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxNY = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    TEXT_LIST_LABELS = {
      none: "None",
      bullet: "Bulleted list",
      number: "Numbered list",
    };
    TEXT_LIST_OPTIONS = [
      {
        value: "none",
        label: TEXT_LIST_LABELS.none,
        icon: "Prohibit",
      },
      {
        value: "bullet",
        label: TEXT_LIST_LABELS.bullet,
        icon: "ListBullet",
      },
      {
        value: "number",
        label: TEXT_LIST_LABELS.number,
        icon: "ListNumbered",
      },
    ];
    LINK_INPUT_CLASS =
      "h-control w-72 rounded bg-fill-field px-2 text-body text-primary shadow-field-ring outline-none placeholder:text-muted focus-visible:outline-hidden focus-visible:shadow-focus aria-[invalid]:shadow-[0_0_0_2px_var(--cds-color-border-danger,#d9534f)] pointer-coarse:h-10 pointer-coarse:w-56";
  };
}
