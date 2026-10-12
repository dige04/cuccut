/** Restored application module; prepare first, initialize in original order. */
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { FontVariant } from "../fonts/variants";
import type { ContrastRequirement } from "./contrast";
import type { ColorSwatch, SwatchKind } from "./color-select";
import type { DataAttributeProps } from "./editor-selection";
import type { InspectorIcon } from "./inspector-icons";
import type { SelectItem } from "./select";

/** What `useSessionPopupKeyboardFocus` hands to a popover and its trigger. */
export interface SessionPopupKeyboardFocus {
  /** Whether the popover was last opened with the keyboard. */
  byKey: boolean;
  /** Ref of the element that wraps the popover content. */
  body: RefObject<HTMLDivElement | null>;
  /** Picks the element to focus when the popover opens. */
  initialFocus: () => HTMLElement | null;
  /** Handlers to spread on the trigger button. */
  keyed: {
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
    onPointerDown: () => void;
  };
}
/** A mouse event whose target is known to be an element. */
export type SessionMouseEvent = ReactMouseEvent<HTMLElement> & {
  target: Element;
};
export interface SessionPropertyPopoverProps {
  testid?: string;
  title: string;
  icon: InspectorIcon;
  /** Value shown next to the icon, with a chevron. */
  readout?: ReactNode;
  disabled?: boolean;
  align?: "left" | "right";
  popoverClassName?: string;
  editsAreUndoSteps?: boolean;
  /** Content, or a function that receives a callback to close the popover. */
  children?: ReactNode | ((close: () => void) => ReactNode);
}
/** One option of a choice popover. */
export interface SessionChoiceOption {
  value: string;
  label: string;
  icon: InspectorIcon;
  /** Why the option is unavailable; it is shown disabled. */
  disabledReason?: string;
}
export interface SessionChoicePopoverProps {
  testid?: string;
  title: string;
  /** Icon of the current choice, shown on the trigger. */
  face: InspectorIcon;
  value: string;
  options: SessionChoiceOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}
/** One entry of the text style list. */
export interface SessionTextStyleOption {
  value: string;
  label: ReactNode;
  /** Plain text used to match the search query. */
  text: string;
  hint?: string;
  title?: string;
  group?: string;
  subgroup?: string;
}
/** State of a number field backed by a style property. */
export interface SessionNumberState {
  value: number | undefined;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Called with `undefined` when the field is cleared. */
  onValue: (value: number | undefined) => void;
  onScrub: (value: number) => void;
  onScrubEnd: () => void;
}
/** The font controls of the custom text style panel. */
export interface SessionCustomTextStyle {
  family: {
    options: SelectItem[];
    value: string;
    onChange: (value: string) => void;
    searchable?: boolean;
    onOpenChange?: (open: boolean) => void;
  };
  face: FontVariant & {
    /** Variants the family provides. */
    faces: Iterable<FontVariant>;
    onChange: (weight: number, italic: boolean) => void;
    onOpenChange?: (open: boolean) => void;
  };
  size: SessionNumberState;
  lineHeight: SessionNumberState;
  letterSpacing: SessionNumberState;
}
export interface SessionTextStylePopoverProps {
  testid?: string;
  value: string;
  /** Text of the chip on the trigger. */
  chipText: ReactNode;
  options: SessionTextStyleOption[];
  onChange: (value: string) => void;
  /** Either the font controls or a ready-made body. */
  custom: SessionCustomTextStyle | { body: ReactNode };
  /** Shown above the style list. */
  systemHeader?: ReactNode;
}
/** The free color picker of a color popover. */
export interface SessionCustomColor {
  /** Color the picker starts from. */
  seed?: string;
  unset?: boolean;
  opaque?: boolean;
  onChange: (css: string) => void;
  onPickEnd?: (css: string) => void;
  contrast?: ContrastRequirement;
  /** Skip the contrast announcement when a swatch is picked. */
  quietSwatch?: boolean;
}
export interface SessionColorPopoverProps {
  testid?: string;
  title: string;
  /** CSS color of the dot on the trigger. */
  paint?: string;
  swatches: ColorSwatch[];
  /** Name of the chosen swatch, or null when none matches. */
  value: string | null;
  onSwatch: (name: string) => void;
  custom?: SessionCustomColor;
  kind?: SwatchKind;
  face?: ReactNode;
  editsAreUndoSteps?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export interface SessionNumberFieldProps {
  testid?: string;
  title: string;
  label: string;
  icon: InspectorIcon;
  value: number;
  min: number;
  max: number;
  /** Replaces the title when the value is at the maximum. */
  maxReason?: string;
  hint?: string;
  onValue: (value: number) => void;
}
export interface SessionImageReplaceButtonProps {
  src?: string;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactD9: ReactNamespace;
    jsxpJ: JsxNamespace;
    SELECTION_HOVER_CLASS: string;
    SESSION_POPOVER_CLOSE_DELAY_MS: number;
    isTextInputEventTarget: (target: EventTarget | null | undefined) => boolean;
    SESSION_POPUP_SELECTOR: string;
    SESSION_POPUP_ATTRIBUTES: DataAttributeProps;
    useSessionPopupKeyboardFocus: (
      open: boolean,
      toggle: () => void,
    ) => SessionPopupKeyboardFocus;
    SESSION_POPUP_ITEM_SELECTORS: string[];
    SESSION_POPUP_PRESSED_SELECTOR: string;
    SESSION_POPUP_ENABLED_SELECTOR: string;
    sessionPopupInitialFocus: (
      popup: Element | null | undefined,
    ) => HTMLElement | null;
    SessionPropertyPopover: (props: SessionPropertyPopoverProps) => ReactElement;
    SessionChoicePopover: (props: SessionChoicePopoverProps) => ReactElement;
    SessionTextStylePopover: (
      props: SessionTextStylePopoverProps,
    ) => ReactElement;
    CustomTextStylePanel: (props: { c: SessionCustomTextStyle }) => ReactElement;
    SessionColorPopover: (props: SessionColorPopoverProps) => ReactElement;
    preserveSessionSelection: (event: SessionMouseEvent) => void;
    SessionSwatchDot: (props: { css?: string }) => ReactElement;
    isScrollbarMouseDown: (event: SessionMouseEvent) => boolean;
    SessionNumberField: (props: SessionNumberFieldProps) => ReactElement;
    IMAGE_CHECKERBOARD_BACKGROUND: string;
    SessionImageReplaceButton: (
      props: SessionImageReplaceButtonProps,
    ) => ReactElement;
  }
}

export function installUiSessionProperties(
  runtime: RuntimeBindings,
): () => void {
  var reactD9: ReactNamespace;
  var jsxpJ: JsxNamespace;
  var SELECTION_HOVER_CLASS: string;
  var SESSION_POPOVER_CLOSE_DELAY_MS: number;
  var isTextInputEventTarget: RuntimeBindings["isTextInputEventTarget"];
  var SESSION_POPUP_SELECTOR: string;
  var SESSION_POPUP_ATTRIBUTES: DataAttributeProps;
  var SESSION_POPUP_ITEM_SELECTORS: string[];
  var SESSION_POPUP_PRESSED_SELECTOR: string;
  var SESSION_POPUP_ENABLED_SELECTOR: string;
  var sessionPopupInitialFocus: RuntimeBindings["sessionPopupInitialFocus"];
  var preserveSessionSelection: RuntimeBindings["preserveSessionSelection"];
  var IMAGE_CHECKERBOARD_BACKGROUND: string;
  function useSessionPopupKeyboardFocus(
    open: boolean,
    toggle: () => void,
  ): SessionPopupKeyboardFocus {
    let [value, value2] = reactD9.useState(false),
      ref = reactD9.useRef<HTMLDivElement>(null),
      callback = () => sessionPopupInitialFocus(ref.current);
    return {
      byKey: value,
      body: ref,
      initialFocus: callback,
      keyed: {
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            value2(true);
          } else if (
            event.key === "ArrowDown" &&
            !event.defaultPrevented &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey
          ) {
            let currentTarget = event.currentTarget;
            for (let value3 of document.querySelectorAll(
              runtime.OPEN_OVERLAY_SELECTOR,
            )) {
              if (
                value3.matches("[data-mc-scrim]") ||
                (0, runtime.isOverlayClosed)(value3)
              ) {
                continue;
              }
              if (
                !(
                  currentTarget instanceof Node &&
                  value3.contains(currentTarget)
                ) &&
                !(open && ref.current !== null && value3.contains(ref.current))
              ) {
                return;
              }
            }
            if (open) {
              let value3 =
                  ref.current?.closest("[data-mc-popover]") ?? null,
                value4 =
                  callback() ??
                  (value3 !== null
                    ? ((0, runtime.collectFocusableDescendants)(value3)[0] ??
                      null)
                    : null);
              if (value4 === null) {
                return;
              }
              event.preventDefault();
              value2(true);
              value4.focus();
              return;
            }
            event.preventDefault();
            value2(true);
            toggle();
          }
        },
        onPointerDown: () => value2(false),
      },
    };
  }
  function SessionPropertyPopover({
    testid: testid,
    title: title,
    icon: icon,
    readout: readout,
    disabled: disabled,
    align = "left",
    popoverClassName: popoverClassName,
    editsAreUndoSteps: editsAreUndoSteps,
    children: children,
  }: SessionPropertyPopoverProps): ReactElement {
    let [value, value2] = reactD9.useState(false),
      {
        byKey: byKey,
        body: body,
        initialFocus: initialFocus,
        keyed: keyed,
      } = useSessionPopupKeyboardFocus(
        value,
        () => value2(true),
      ),
      value3 =
        typeof icon === "string"
          ? icon
          : jsxpJ.jsx(runtime.Icon, {
              customIcon: icon,
              size: "auto",
              className: "shrink-0",
            }),
      value4 =
        readout === undefined
          ? jsxpJ.jsx(runtime.ToolbarStripButton, {
              "data-testid": testid,
              icon: value3,
              title: title,
              "aria-label": title,
              className: value ? SELECTION_HOVER_CLASS : undefined,
              disabled: disabled,
              ...keyed,
            })
          : jsxpJ.jsx(runtime.ToolbarStripButton, {
              "data-testid": testid,
              icon: value3,
              title: title,
              "aria-label": title,
              className: value ? SELECTION_HOVER_CLASS : undefined,
              disabled: disabled,
              chevron: true,
              ...keyed,
              children: jsxpJ.jsx("span", {
                className: "tabular-nums",
                children: readout,
              }),
            });
    return jsxpJ.jsx("span", {
      className: "relative inline-flex",
      children: jsxpJ.jsx(runtime.PropertyPopup, {
        open: value,
        onOpen: () => value2(true),
        onClose: () => value2(false),
        trigger: value4,
        align: align,
        focusOnOpen: byKey,
        initialFocus: initialFocus,
        keepFocus: true,
        padding: "none",
        className: (0, runtime.joinClassNames)("p-2", popoverClassName),
        editsAreUndoSteps: editsAreUndoSteps,
        children: jsxpJ.jsx("div", {
          ref: body,
          "data-session-strip": "",
          onKeyDownCapture: runtime.popupPointerEvent,
          children:
            typeof children === "function"
              ? children(() => value2(false))
              : children,
        }),
      }),
    });
  }
  function SessionChoicePopover({
    testid: testid,
    title: title,
    face: face,
    value: value,
    options: options,
    onChange: onChange,
    disabled: disabled,
  }: SessionChoicePopoverProps): ReactElement {
    return jsxpJ.jsx(SessionPropertyPopover, {
      testid: testid,
      title: title,
      icon: face,
      popoverClassName: "min-w-0!",
      disabled: disabled,
      children: (input: () => void) =>
        jsxpJ.jsx("div", {
          role: "group",
          "aria-label": title,
          "data-icon-row": "",
          className: "flex items-center gap-1",
          onKeyDown: (0, runtime.createOptionListKeyHandler)("button", {
            across: true,
          }),
          children: options.map(
            (input2: SessionChoiceOption) =>
              jsxpJ.jsx(
                runtime.ToolbarStripButton,
                {
                  "data-testid": testid
                    ? testid + "-" + input2.value
                    : undefined,
                  icon:
                    typeof input2.icon === "string"
                      ? input2.icon
                      : jsxpJ.jsx(runtime.Icon, {
                          customIcon: input2.icon,
                          size: "auto",
                          className: "shrink-0",
                        }),
                  title: input2.disabledReason ?? input2.label,
                  "aria-label": input2.label,
                  "aria-pressed":
                    input2.disabledReason !== undefined
                      ? undefined
                      : input2.value === value,
                  disabled: input2.disabledReason !== undefined,
                  onClick: () => {
                    input();
                    if (input2.value !== value) {
                      onChange(input2.value);
                    }
                  },
                },
                input2.value,
              ),
          ),
        }),
    });
  }
  function SessionTextStylePopover({
    testid: testid,
    value: value,
    chipText: chipText,
    options: options,
    onChange: onChange,
    custom: custom,
    systemHeader: systemHeader,
  }: SessionTextStylePopoverProps): ReactElement {
    let [value2, value3] = reactD9.useState(false),
      {
        byKey: byKey,
        body: body,
        initialFocus: initialFocus,
        keyed: keyed,
      } = useSessionPopupKeyboardFocus(
        value2,
        () => value3(true),
      ),
      value4 = options.length > 0 || systemHeader != null,
      [value5, value6] = reactD9.useState("system"),
      value7 = value4 ? value5 : "custom",
      value8 =
        options.some((input: SessionTextStyleOption) => input.group !== undefined) ||
        options.length > runtime.OPTION_LIST_MAX_HEIGHT,
      [value9, value10] = reactD9.useState("");
    if (!value2 && value9 !== "") {
      value10("");
    }
    let value11 = value8 ? value9.trim().toLowerCase() : "",
      value12 = options.filter(
        (input: SessionTextStyleOption) =>
          (0, runtime.optionMatchesQuery)(
            value11,
            input.text,
            input.hint,
            input.subgroup,
            input.group,
          ),
      ),
      value13 = options.reduce(
        (
          input: number,
          options2: SessionTextStyleOption,
          context: number,
        ): number => {
          let value16 =
            options2.group !== undefined &&
            options2.group !== options[context - 1]?.group;
          return (
            input +
            1 +
            (value16 ? 1 : 0) +
            (options2.subgroup !== undefined &&
            (value16 || options2.subgroup !== options[context - 1]?.subgroup)
              ? 1
              : 0)
          );
        },
        0,
      ),
      value14 = value4
        ? Math.max(
            SESSION_POPOVER_CLOSE_DELAY_MS,
            52 +
              (systemHeader != null ? 40 : 0) +
              (value8 ? 36 : 0) +
              Math.min(384, 32 * value13),
          )
        : undefined,
      value15 = jsxpJ.jsx(runtime.ToolbarStripButton, {
        "data-testid": testid,
        "data-mc-bordered": "",
        title: "Text style",
        chevron: true,
        className: (0, runtime.joinClassNames)(
          "rounded-lg border border-border-line px-2",
          value2 && SELECTION_HOVER_CLASS,
        ),
        ...keyed,
        children: jsxpJ.jsxs("span", {
          className: "inline-flex items-center gap-1.5",
          children: [
            jsxpJ.jsx(runtime.KitIcon, {
              name: "TextAa",
              size: 13,
              className: "text-muted",
            }),
            jsxpJ.jsx("span", {
              className: "min-w-14 max-w-40 truncate text-left",
              children: chipText,
            }),
          ],
        }),
      });
    return jsxpJ.jsx("span", {
      className: "relative inline-flex",
      children: jsxpJ.jsx(runtime.PropertyPopup, {
        open: value2,
        onOpen: () => value3(true),
        onClose: () => value3(false),
        trigger: value15,
        align: "left",
        focusOnOpen: byKey,
        initialFocus: initialFocus,
        keepFocus: true,
        padding: "none",
        planHeight: value14,
        className: "w-60 p-2 pointer-coarse:w-auto pointer-coarse:min-w-60",
        children: jsxpJ.jsxs("div", {
          ref: body,
          "data-session-strip": "",
          onKeyDownCapture: runtime.popupPointerEvent,
          children: [
            value4
              ? jsxpJ.jsx(runtime.ColorHexInput, {
                  value: value7,
                  onChange: value6,
                })
              : null,
            value7 === "system"
              ? jsxpJ.jsxs("div", {
                  role: "group",
                  "aria-label": "Text style",
                  children: [
                    systemHeader,
                    jsxpJ.jsxs("div", {
                      "data-search-scope": "",
                      onKeyDown: (0, runtime.createOptionListKeyHandler)(
                        '[data-kit="MenuItem"]',
                      ),
                      children: [
                        value8
                          ? jsxpJ.jsx(runtime.OptionList, {
                              value: value9,
                              onChange: value10,
                              label: runtime.STYLE_SEARCH_LABEL,
                              rowSelector: '[data-kit="MenuItem"]',
                              onEnterIndex: () =>
                                (0, runtime.optionTypeaheadMatch)(
                                  value11,
                                  value12.map(
                                    (input: SessionTextStyleOption) =>
                                      input.text,
                                  ),
                                ),
                              "data-testid": testid
                                ? testid + "-search"
                                : undefined,
                            })
                          : null,
                        value12.length === 0
                          ? jsxpJ.jsx("p", {
                              role: "status",
                              className: "px-2 py-1 text-footnote text-muted",
                              children: runtime.NO_COLOR_MATCHES_LABEL,
                            })
                          : null,
                        jsxpJ.jsx("div", {
                          className:
                            "kit-scrollbar max-h-[min(24rem,max(6rem,calc(var(--available-height,100vh)_-_8rem)))] overflow-y-auto",
                          children: value12.map(
                            (
                              input: SessionTextStyleOption,
                              options2: number,
                            ) => {
                              let value16 =
                                  input.group !== undefined &&
                                  input.group !== value12[options2 - 1]?.group,
                                value17 =
                                  input.subgroup !== undefined &&
                                  (value16 ||
                                    input.subgroup !==
                                      value12[options2 - 1]?.subgroup);
                              return jsxpJ.jsxs(
                                reactD9.Fragment,
                                {
                                  children: [
                                    value16
                                      ? jsxpJ.jsx(runtime.ColorPickerHeader, {
                                          text: input.group,
                                          title: true,
                                        })
                                      : null,
                                    value17
                                      ? jsxpJ.jsx(runtime.ColorPickerHeader, {
                                          text: input.subgroup,
                                        })
                                      : null,
                                    jsxpJ.jsx(runtime.PropertyMenuItem, {
                                      checked: input.value === value,
                                      title: input.title,
                                      "data-testid": testid
                                        ? testid + "-" + input.value
                                        : undefined,
                                      onClick: () => {
                                        value3(false);
                                        if (input.value !== value) {
                                          onChange(input.value);
                                        }
                                      },
                                      children: jsxpJ.jsxs("span", {
                                        className:
                                          "flex min-w-0 flex-1 items-center gap-0.5",
                                        style: {
                                          lineHeight: "27px",
                                        },
                                        children: [
                                          jsxpJ.jsx("span", {
                                            className:
                                              "flex min-w-0 overflow-x-clip pe-1 [font-variation-settings:normal]",
                                            children: input.label,
                                          }),
                                          input.hint !== undefined
                                            ? jsxpJ.jsx("span", {
                                                className:
                                                  "shrink-0 text-footnote text-muted",
                                                children: input.hint,
                                              })
                                            : null,
                                        ],
                                      }),
                                    }),
                                  ],
                                },
                                input.value,
                              );
                            },
                          ),
                        }),
                      ],
                    }),
                  ],
                })
              : "body" in custom
                ? jsxpJ.jsx("div", {
                    className: "flex flex-col gap-2",
                    "aria-label": "Custom text style",
                    children: custom.body,
                  })
                : jsxpJ.jsx(CustomTextStylePanel, {
                    c: custom,
                  }),
          ],
        }),
      }),
    });
  }
  function CustomTextStylePanel({
    c: c,
  }: {
    c: SessionCustomTextStyle;
  }): ReactElement {
    return jsxpJ.jsxs("div", {
      className: "flex flex-col gap-2",
      "aria-label": "Custom text style",
      children: [
        jsxpJ.jsx("div", {
          className: "flex",
          children: jsxpJ.jsx(runtime.Select, {
            "aria-label": "Font",
            items: c.family.options,
            value: c.family.value,
            onChange: c.family.onChange,
            searchable: c.family.searchable,
            searchLabel: "Search fonts",
            onOpenChange: c.family.onOpenChange,
            popupAttrs: SESSION_POPUP_ATTRIBUTES,
          }),
        }),
        jsxpJ.jsxs("div", {
          className: "grid grid-cols-2 gap-2",
          children: [
            jsxpJ.jsx(runtime.Select, {
              "aria-label": "Weight",
              items: (0, runtime.fontVariantChoices)(c.face.faces, c.face),
              value: (0, runtime.fontVariantKey)(c.face.weight, c.face.italic),
              onOpenChange: c.face.onOpenChange,
              onChange: (input: string) => {
                let value = (0, runtime.parseFontVariantKey)(input);
                if (value !== undefined) {
                  c.face.onChange(value.weight, value.italic);
                }
              },
              popupAttrs: SESSION_POPUP_ATTRIBUTES,
            }),
            jsxpJ.jsx(runtime.PropertyNumberInput, {
              "aria-label": "Font size",
              unit: "px",
              title: "Font size (px); clear it for the style's own",
              clearable: true,
              ...c.size,
            }),
            jsxpJ.jsx(runtime.PropertyNumberInput, {
              prefix: jsxpJ.jsx(runtime.PropertyIcon, {
                icon: runtime.LINE_HEIGHT_ICON,
              }),
              "aria-label": "Line height",
              title: "Line height (× the font size)",
              clearable: true,
              ...c.lineHeight,
              step: c.lineHeight.step ?? 0.05,
            }),
            jsxpJ.jsx(runtime.PropertyNumberInput, {
              prefix: jsxpJ.jsx(runtime.PropertyIcon, {
                icon: "LetterSpacing",
              }),
              "aria-label": "Letter spacing",
              unit: "px",
              title: "Letter spacing (px)",
              clearable: true,
              ...c.letterSpacing,
              step: c.letterSpacing.step ?? 0.5,
            }),
          ],
        }),
      ],
    });
  }
  function SessionColorPopover(props: SessionColorPopoverProps): ReactElement {
    let [value, value2] = reactD9.useState(false),
      ref = reactD9.useRef(props.onOpenChange);
    ref.current = props.onOpenChange;
    reactD9.useEffect(() => ref.current?.(value), [value]);
    let {
        byKey: byKey,
        body: body,
        initialFocus: initialFocus,
        keyed: keyed,
      } = useSessionPopupKeyboardFocus(
        value,
        () => value2(true),
      ),
      value3 =
        props.custom !== undefined &&
        props.swatches.some(
          (input: ColorSwatch) =>
            input.empty !== true && input.name !== "default",
        ),
      value4 = jsxpJ.jsx(runtime.ToolbarStripButton, {
        "data-testid": props.testid,
        title: props.title,
        "aria-label": props.title,
        icon: jsxpJ.jsx(SessionSwatchDot, {
          css: props.paint,
        }),
        className: value ? SELECTION_HOVER_CLASS : undefined,
        ...keyed,
      });
    return jsxpJ.jsx("span", {
      className: "relative inline-flex",
      children: jsxpJ.jsx(runtime.PropertyPopup, {
        open: value,
        onOpen: () => value2(true),
        onClose: () => value2(false),
        trigger: value4,
        align: "left",
        focusOnOpen: byKey,
        initialFocus: initialFocus,
        keepFocus: true,
        padding: "none",
        planHeight:
          value3 || props.kind !== undefined
            ? runtime.COLOR_PICKER_POPOVER_HEIGHT
            : undefined,
        className: runtime.COLOR_PICKER_POPOVER_CLASS,
        editsAreUndoSteps: props.editsAreUndoSteps,
        children: jsxpJ.jsx("div", {
          ref: body,
          "data-session-strip": "",
          onKeyDownCapture: runtime.popupPointerEvent,
          onMouseDown: preserveSessionSelection,
          children: jsxpJ.jsx(runtime.SwatchPalette, {
            testid: props.testid,
            title: props.title,
            swatches: props.swatches,
            current: props.value,
            onSwatch: (input: string) => {
              props.onSwatch(input);
              let value5 = props.custom?.contrast;
              if (value5 === undefined || props.custom?.quietSwatch === true) {
                return;
              }
              let value6 = props.swatches.find(
                (input2: ColorSwatch) => input2.name === input,
              )?.color;
              if (value6 === undefined) {
                return;
              }
              (0, runtime.announceLiveMessage)(() => {
                let value7 = (0, runtime.colorContrastResults)(
                  value6,
                  value5,
                );
                if (value7 === undefined) {
                  return null;
                } else {
                  return (0, runtime.contrastDisplayInfo)(value7).spoken;
                }
              });
            },
            onPicked: () => value2(false),
            fold: true,
            color:
              props.custom !== undefined
                ? {
                    value: props.custom.seed,
                    unset: props.custom.unset,
                    opaque: props.custom.opaque,
                    onChange: props.custom.onChange,
                    onPickEnd: props.custom.onPickEnd,
                    contrast: props.custom.contrast,
                  }
                : undefined,
            kind: props.kind,
            face: props.face,
          }),
        }),
      }),
    });
  }
  function SessionSwatchDot({ css: css }: { css?: string }): ReactElement {
    return jsxpJ.jsx("span", {
      "aria-hidden": "true",
      "data-swatch-dot": "",
      className: (0, runtime.joinClassNames)(
        "inline-block h-4 w-4 shrink-0 rounded-[4px] border border-border-strong pointer-coarse:h-5 pointer-coarse:w-5",
        css === undefined && "border-dashed",
      ),
      style: (0, runtime.swatchPreviewStyle)(css),
    });
  }
  function isScrollbarMouseDown(event: SessionMouseEvent): boolean {
    let target = event.target;
    return (
      target.scrollHeight > target.clientHeight &&
      event.nativeEvent.offsetX >= target.clientWidth
    );
  }
  function SessionNumberField({
    testid: testid,
    title: title,
    label: label,
    icon: icon,
    value: value,
    min: min,
    max: max,
    maxReason: maxReason,
    hint: hint,
    onValue: onValue,
  }: SessionNumberFieldProps): ReactElement {
    let [value2, value3] = reactD9.useState<number | null>(null),
      ref = reactD9.useRef<number | null>(null),
      callback = (input?: number) => {
        if (input !== undefined && Math.round(input) !== value) {
          onValue(Math.round(input));
        }
      };
    return jsxpJ.jsx("span", {
      "data-testid": testid,
      className: "inline-flex w-[76px]",
      children: jsxpJ.jsx(runtime.PropertyNumberInput, {
        prefix: jsxpJ.jsx(runtime.PropertyIcon, {
          icon: icon,
        }),
        "aria-label": label,
        title:
          value >= max
            ? (maxReason ?? title)
            : hint !== undefined
              ? title + ". " + hint
              : title,
        value: value2 ?? value,
        min: min,
        max: max,
        step: 1,
        onValue: callback,
        onScrub: (input: number) => {
          ref.current = input;
          value3(input);
        },
        onScrubEnd: () => {
          let current = ref.current;
          ref.current = null;
          value3(null);
          callback(current ?? undefined);
        },
      }),
    });
  }
  function SessionImageReplaceButton({
    src: src,
    title: title,
    onClick: onClick,
    disabled: disabled,
  }: SessionImageReplaceButtonProps): ReactElement {
    return jsxpJ.jsx(runtime.ToolbarStripButton, {
      "data-testid": "frame-image-replace",
      title: title,
      "aria-label": title,
      disabled: disabled,
      onClick: onClick,
      className: "px-1",
      children:
        src !== undefined
          ? jsxpJ.jsx("img", {
              alt: "",
              "aria-hidden": "true",
              src: src,
              draggable: false,
              style: {
                background: IMAGE_CHECKERBOARD_BACKGROUND,
              },
              className:
                "h-5 w-5 shrink-0 rounded-[4px] border border-border-strong object-cover pointer-coarse:h-7 pointer-coarse:w-7",
            })
          : jsxpJ.jsx("span", {
              "aria-hidden": "true",
              className:
                "inline-block h-5 w-5 rounded-[4px] border border-dashed border-border-strong pointer-coarse:h-7 pointer-coarse:w-7",
            }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactD9",
    () => reactD9,
    (value) => {
      reactD9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxpJ",
    () => jsxpJ,
    (value) => {
      jsxpJ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECTION_HOVER_CLASS",
    () => SELECTION_HOVER_CLASS,
    (value) => {
      SELECTION_HOVER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SESSION_POPOVER_CLOSE_DELAY_MS",
    () => SESSION_POPOVER_CLOSE_DELAY_MS,
    (value) => {
      SESSION_POPOVER_CLOSE_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isTextInputEventTarget",
    () => isTextInputEventTarget,
    (value) => {
      isTextInputEventTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SESSION_POPUP_SELECTOR",
    () => SESSION_POPUP_SELECTOR,
    (value) => {
      SESSION_POPUP_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SESSION_POPUP_ATTRIBUTES",
    () => SESSION_POPUP_ATTRIBUTES,
    (value) => {
      SESSION_POPUP_ATTRIBUTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useSessionPopupKeyboardFocus",
    () => useSessionPopupKeyboardFocus,
  );
  bindRuntimeValue(
    runtime,
    "SESSION_POPUP_ITEM_SELECTORS",
    () => SESSION_POPUP_ITEM_SELECTORS,
    (value) => {
      SESSION_POPUP_ITEM_SELECTORS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SESSION_POPUP_PRESSED_SELECTOR",
    () => SESSION_POPUP_PRESSED_SELECTOR,
    (value) => {
      SESSION_POPUP_PRESSED_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SESSION_POPUP_ENABLED_SELECTOR",
    () => SESSION_POPUP_ENABLED_SELECTOR,
    (value) => {
      SESSION_POPUP_ENABLED_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sessionPopupInitialFocus",
    () => sessionPopupInitialFocus,
    (value) => {
      sessionPopupInitialFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionPropertyPopover",
    () => SessionPropertyPopover,
  );
  bindRuntimeValue(runtime, "SessionChoicePopover", () => SessionChoicePopover);
  bindRuntimeValue(
    runtime,
    "SessionTextStylePopover",
    () => SessionTextStylePopover,
  );
  bindRuntimeValue(runtime, "CustomTextStylePanel", () => CustomTextStylePanel);
  bindRuntimeValue(runtime, "SessionColorPopover", () => SessionColorPopover);
  bindRuntimeValue(
    runtime,
    "preserveSessionSelection",
    () => preserveSessionSelection,
    (value) => {
      preserveSessionSelection = value;
    },
  );
  bindRuntimeValue(runtime, "SessionSwatchDot", () => SessionSwatchDot);
  bindRuntimeValue(runtime, "isScrollbarMouseDown", () => isScrollbarMouseDown);
  bindRuntimeValue(runtime, "SessionNumberField", () => SessionNumberField);
  bindRuntimeValue(
    runtime,
    "IMAGE_CHECKERBOARD_BACKGROUND",
    () => IMAGE_CHECKERBOARD_BACKGROUND,
    (value) => {
      IMAGE_CHECKERBOARD_BACKGROUND = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionImageReplaceButton",
    () => SessionImageReplaceButton,
  );
  return () => {
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiAnnouncements)();
    (0, runtime.initializeUiColorPicker)();
    (0, runtime.initializeUiPropertySearch)();
    (0, runtime.initializeColorSelect)();
    (0, runtime.initializeUiContrast)();
    (0, runtime.initializeUiContrastControls)();
    (0, runtime.initializeUiPropertyIcons)();
    (0, runtime.initializeUiNumberControls2)();
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiPropertyFocus)();
    (0, runtime.initializeSelect)();
    (0, runtime.initializeFontVariants)();
    reactD9 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeUiPropertyLabels)();
    jsxpJ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    SELECTION_HOVER_CLASS = "bg-fill-ghost-hover";
    SESSION_POPOVER_CLOSE_DELAY_MS = 180;
    isTextInputEventTarget = (target: EventTarget | null | undefined): boolean =>
      target instanceof Element &&
      target.closest(runtime.TEXT_EDITABLE_SELECTOR) !== null;
    SESSION_POPUP_SELECTOR = '[data-session-strip="popup"]';
    SESSION_POPUP_ATTRIBUTES = {
      "data-session-strip": "popup",
    };
    SESSION_POPUP_ITEM_SELECTORS = [
      '[data-kit="MenuItem"]',
      "[data-swatch]",
      "[data-icon-row] button",
    ];
    SESSION_POPUP_PRESSED_SELECTOR = SESSION_POPUP_ITEM_SELECTORS.map(
      (input: string) =>
        input + '[aria-pressed="true"]:not(:disabled)',
    ).join(", ");
    SESSION_POPUP_ENABLED_SELECTOR = SESSION_POPUP_ITEM_SELECTORS.map(
      (input: string) => input + ":not(:disabled)",
    ).join(", ");
    sessionPopupInitialFocus = (
      popup: Element | null | undefined,
    ): HTMLElement | null =>
      popup?.querySelector<HTMLElement>(SESSION_POPUP_PRESSED_SELECTOR) ??
      popup?.querySelector<HTMLElement>(SESSION_POPUP_ENABLED_SELECTOR) ??
      null;
    preserveSessionSelection = (event: SessionMouseEvent): void => {
      if (
        !isTextInputEventTarget(event.target) &&
        !isScrollbarMouseDown(event)
      ) {
        event.preventDefault();
      }
    };
    IMAGE_CHECKERBOARD_BACKGROUND =
      "repeating-conic-gradient(#a8a6a0 0% 25%, #d2d0ca 0% 50%) 0 / 8px 8px padding-box";
  };
}
