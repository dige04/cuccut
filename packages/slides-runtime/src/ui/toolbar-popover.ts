/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";

/** Where focus goes when the popup closes: `false` keeps it where it is, a ref picks an element. */
export type ToolbarPopoverFinalFocus = boolean | React.RefObject<HTMLElement | null>;
export interface ToolbarPopoverProps {
  label: string;
  /** Tooltip text; falls back to the label. */
  tip?: string;
  descriptionSuffix?: string;
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Tooltip text shown while the trigger is disabled. */
  disabledTip?: string;
  finalFocus?: ToolbarPopoverFinalFocus;
  className?: string;
  "data-testid"?: string;
  /** Icon name or rendered icon for the trigger. */
  icon?: React.ReactNode;
  glyph?: React.ReactNode;
  /** Current value shown in the trigger instead of an icon. */
  readout?: string;
  /** Widest possible readout, used to reserve space. */
  readoutSizer?: string;
  pressed?: boolean;
  emphasis?: boolean;
  iconOnly?: boolean;
  caret?: boolean;
}
export interface ToolbarMenuItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  glyph?: React.ReactNode;
  label: string;
  /** Shortcut written like `Cmd+K`. */
  shortcut?: string;
  pressed?: boolean;
  /** When set, the item is a radio that reports this state. */
  checked?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactv4: ReactNamespace;
    jsxeQ: JsxNamespace;
    jsx_T: JsxNamespace;
    ToolbarPopover: (props: ToolbarPopoverProps) => React.ReactElement;
    ToolbarMenuItem: (props: ToolbarMenuItemProps) => React.ReactElement;
  }
}

export function installUiToolbarPopover(runtime: RuntimeBindings): () => void {
  var reactv4: ReactNamespace;
  var jsxeQ: JsxNamespace;
  var jsx_T: JsxNamespace;
  function ToolbarPopover(props: ToolbarPopoverProps): React.ReactElement {
    let {
        label: label,
        tip: tip,
        descriptionSuffix: descriptionSuffix,
        children: children,
        align = "start",
        side = "bottom",
        open: open,
        onOpenChange: onOpenChange,
        disabled = false,
        disabledTip: disabledTip,
        finalFocus: finalFocus,
        className: className,
        "data-testid": value,
      } = props,
      value2 = reactv4.useContext(runtime.ToolbarFloatingContext),
      ref = reactv4.useRef<HTMLSpanElement>(null),
      ref2 = reactv4.useRef<HTMLElement | null>(null),
      [value3, value4] = reactv4.useState(false),
      value5 = open ?? value3,
      [value6, value7] = reactv4.useState(false),
      value8 = finalFocus === true ? undefined : finalFocus,
      ref3 = reactv4.useRef(false),
      ref4 = reactv4.useRef<{
        disabled: boolean;
        popupFinalFocus: ToolbarPopoverFinalFocus | undefined;
      }>({
        disabled: disabled,
        popupFinalFocus: value8,
      });
    ref4.current = {
      disabled: disabled,
      popupFinalFocus: value8,
    };
    let ref5 = reactv4.useRef(false),
      callback = reactv4.useCallback((input: HTMLElement | null): void => {
        ref2.current = input;
        if (input === null) {
          setTimeout(() => {
            ref3.current = false;
            let current = ref.current;
            if (
              !ref5.current ||
              !ref4.current.disabled ||
              current === null ||
              ref4.current.popupFinalFocus === false ||
              !current.ownerDocument.hasFocus()
            ) {
              return;
            }
            let activeElement = current.ownerDocument.activeElement;
            if (
              activeElement === null ||
              activeElement === current.ownerDocument.body ||
              !activeElement.isConnected
            ) {
              current.focus({
                preventScroll: true,
              });
            }
          }, 0);
        }
      }, []),
      value9 = props.icon ?? props.glyph,
      value10 =
        props.readout === undefined || props.readout === ""
          ? label
          : props.readout + ", " + label,
      value11 =
        props.readout === undefined ? props.pressed : undefined,
      value12 = props.readout === undefined && props.emphasis === true,
      value13 = props.iconOnly === true || (value2 && !value12),
      value14 = (0, runtime.useDisabledButtonDescription)({
        disabled: disabled,
        name: value10,
        reason: disabledTip ?? tip,
        pressed: value11,
        expanded: false,
        hasPopup: "menu",
      });
    (0, runtime.useDeferredTooltipFocus)(ref, disabled);
    let content = (0, runtime.toolbarTooltipContent)({
        label: label,
        tip: tip,
        disabledTip: disabledTip,
        disabled: disabled,
      }).content,
      value15 = (0, runtime.useButtonAccessibility)({
        disabled: disabled,
        name: value10,
        tip: content,
        descriptionSuffix: descriptionSuffix,
      }),
      value16 =
        props.readout !== undefined
          ? jsxeQ.jsx(runtime.Menu.Trigger, {
              render: jsxeQ.jsxs(runtime.Button, {
                variant: "ghost",
                disabled: disabled,
                "aria-label": value10,
                "aria-describedby": value15.describedBy,
                ...value14.inner,
                "data-testid": value,
                className: "shrink-0 tabular-nums",
                children: [
                  props.readoutSizer === undefined
                    ? props.readout
                    : jsxeQ.jsx("span", {
                        "data-sizer": props.readoutSizer,
                        className:
                          "inline-flex flex-col items-center before:invisible before:h-0 before:content-[attr(data-sizer)]",
                        children: props.readout,
                      }),
                  jsxeQ.jsx(runtime.ToolbarCaret, {}),
                ],
              }),
            })
          : jsxeQ.jsx(runtime.Menu.Trigger, {
              render:
                value13 && props.caret !== true
                  ? jsxeQ.jsx(runtime.Button, {
                      iconOnly: true,
                      variant: "ghost",
                      icon: value9,
                      pressed: value11,
                      disabled: disabled,
                      "aria-label": label,
                      "aria-describedby": value15.describedBy,
                      ...value14.inner,
                      "data-testid": value,
                      className: "shrink-0",
                    })
                  : jsxeQ.jsxs(runtime.Button, {
                      variant: value12
                        ? disabled
                          ? "secondary"
                          : "primary"
                        : "ghost",
                      icon: value9,
                      pressed: value11,
                      disabled: disabled,
                      "aria-label": label,
                      "aria-describedby": value15.describedBy,
                      ...value14.inner,
                      "data-testid": value,
                      className: "shrink-0",
                      children: [
                        value13 ? null : label,
                        props.caret === true
                          ? jsxeQ.jsx(runtime.ToolbarCaret, {
                              inherit: value12 && !disabled,
                            })
                          : null,
                      ],
                    }),
            }),
      value17 = (0, runtime.joinClassNames)(
        "relative inline-flex shrink-0 rounded align-top outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
        className,
      );
    reactv4.useLayoutEffect(() => {
      if (disabled && value5) {
        if (open === undefined) {
          value4(false);
        }
        onOpenChange?.(false);
      }
      value7(
        !disabled &&
          ref.current !== null &&
          ref.current.contains(ref.current.ownerDocument.activeElement),
      );
    }, [disabled]);
    let value18 = value5 && !disabled,
      ref6 = reactv4.useRef(false);
    reactv4.useLayoutEffect(() => {
      if (ref6.current && !value18) {
        ref5.current = ref2.current?.querySelector(":focus-visible") != null;
      }
      if (ref6.current && !value18 && !disabled && value8 !== false) {
        let current = ref.current;
        if (
          current !== null &&
          current.contains(current.ownerDocument.activeElement)
        ) {
          value7(true);
        } else {
          ref3.current = true;
        }
      }
      ref6.current = value18;
    }, [value18]);
    return jsxeQ.jsxs(runtime.Menu.Root, {
      open: value18,
      disabled: disabled,
      onOpenChange: (input: boolean): void => {
        if (open === undefined) {
          value4(input);
        }
        onOpenChange?.(input);
      },
      children: [
        jsxeQ.jsx(runtime.Tooltip, {
          content: content,
          side: side,
          hoverable: false,
          open: !disabled && (value5 || value6) ? false : undefined,
          children: jsxeQ.jsxs("span", {
            ref: ref,
            tabIndex: disabled ? 0 : -1,
            ...value14.props,
            onPointerEnter: value6 ? () => value7(false) : undefined,
            onBlur: value6 ? () => value7(false) : undefined,
            onFocus: (input: React.FocusEvent<HTMLSpanElement>): void => {
              let relatedTarget = input.relatedTarget,
                value19 =
                  relatedTarget !== null &&
                  relatedTarget.isConnected &&
                  !ref2.current?.contains(relatedTarget) &&
                  !ref.current?.contains(relatedTarget);
              if (ref3.current) {
                ref3.current = false;
                if (!value19 && !disabled) {
                  value7(true);
                }
              } else if (value6 && value19) {
                value7(false);
              }
            },
            "data-tb-icon":
              props.readout === undefined && props.caret !== true && value13
                ? ""
                : undefined,
            "data-tb-readout": props.readout !== undefined ? "" : undefined,
            className: value17,
            children: [value16, value15.mirror, value14.mirror],
          }),
        }),
        jsxeQ.jsx(runtime.Menu.Popup, {
          ref: callback,
          side: side,
          align: align,
          finalFocus: value8,
          children: children,
        }),
      ],
    });
  }
  function ToolbarMenuItem({
    glyph: glyph,
    label: label,
    shortcut: shortcut,
    pressed: pressed,
    checked: checked,
    "aria-describedby": ariaDescribedby,
    "aria-keyshortcuts": ariaKeyshortcuts,
    ...remainingProps
  }: ToolbarMenuItemProps): React.ReactElement {
    let value = checked ?? pressed,
      value2 = (0, runtime.useButtonAccessibility)({
        disabled: remainingProps.disabled === true,
        name: label,
        tip: shortcut !== undefined ? (remainingProps.title ?? "") : "",
        shortcut: shortcut,
        describedBy: ariaDescribedby,
      });
    return jsx_T.jsxs("button", {
      type: "button",
      ...(checked === undefined
        ? {
            "aria-pressed": pressed,
          }
        : {
            role: "radio",
            "aria-checked": checked,
          }),
      ...remainingProps,
      "aria-describedby": value2.describedBy,
      "aria-keyshortcuts": ariaKeyshortcuts ?? value2.keyShortcuts,
      className: (0, runtime.joinClassNames)(
        "flex h-7 w-full cursor-default select-none items-center gap-2 rounded-md px-2 text-left text-xs text-fg",
        "enabled:hover:bg-wash-1 enabled:active:bg-wash-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-10 pointer-coarse:text-sm",
        value && "bg-wash-1",
      ),
      children: [
        jsx_T.jsx("span", {
          className:
            "flex h-4 w-4 shrink-0 items-center justify-center text-fg-secondary pointer-coarse:h-5 pointer-coarse:w-5",
          children: glyph,
        }),
        jsx_T.jsx("span", {
          className: "min-w-0 flex-1 truncate",
          children: label,
        }),
        shortcut !== undefined
          ? jsx_T.jsx("span", {
              "aria-hidden": "true",
              className: "ml-3 shrink-0 text-fg-muted pointer-coarse:hidden",
              children: (0, runtime.shortcutSymbols)(shortcut),
            })
          : null,
        value2.mirror,
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactv4",
    () => reactv4,
    (value) => {
      reactv4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxeQ",
    () => jsxeQ,
    (value) => {
      jsxeQ = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarPopover", () => ToolbarPopover);
  bindRuntimeValue(
    runtime,
    "jsx_T",
    () => jsx_T,
    (value) => {
      jsx_T = value;
    },
  );
  bindRuntimeValue(runtime, "ToolbarMenuItem", () => ToolbarMenuItem);
  return () => {
    (0, runtime.initializeUiInputs210)();
    reactv4 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxeQ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    jsx_T = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
