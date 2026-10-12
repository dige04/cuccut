/** Restored application module; prepare first, initialize in original order. */
import type {
  ButtonHTMLAttributes,
  ForwardRefExoticComponent,
  MouseEvent,
  MouseEventHandler,
  ReactElement,
  ReactNode,
  RefAttributes,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Returns the element a property popover positions itself against. */
export type PopoverAnchorGetter = () => Element | null | undefined;

/** Optional numeric limits of one editable number field. */
export interface NumberFieldBounds {
  min?: number;
  max?: number;
  step?: number;
}

/** Drop-shadow record edited by the shadow editor. */
export interface ShadowRecord {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
}

export type ShadowField = "x" | "y" | "blur" | "spread";

export type ShadowFieldBounds = Partial<Record<ShadowField, NumberFieldBounds>>;

export interface PropertyPopoverPanelProps {
  title: ReactNode;
  onClose: () => void;
  /** CSS length of the label column (default "3rem"). */
  labelWidth?: string;
  children?: ReactNode;
}

export interface ShadowPropertyEditorProps {
  title: ReactNode;
  value: ShadowRecord;
  onChange: (value: ShadowRecord) => void;
  /** Live (uncommitted) update while scrubbing; enabled together with onLiveEnd. */
  onLive?: (value: ShadowRecord) => void;
  onLiveEnd?: () => void;
  onClose: () => void;
  /** Whether the spread row is shown (default true). */
  spread?: boolean;
  bounds?: ShadowFieldBounds;
  disabled?: boolean;
  /** Color swatches forwarded untouched to the color row. */
  swatches?: readonly unknown[];
  unifiedPopover?: boolean;
  editsAreUndoSteps?: boolean;
}

export interface PropertyPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  anchor?: PopoverAnchorGetter;
  side?: "left" | "right" | "top" | "bottom";
  focusOnOpen?: boolean;
  className?: string;
  editsAreUndoSteps?: boolean;
  children?: ReactNode;
}

export interface RemovePropertyButtonProps {
  /** Property label; lower-cased into the accessible name. */
  label: string;
  onClick?: MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  disabledReason?: ReactNode;
}

export interface PropertyPopoverTriggerProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "color" | "onClick" | "disabled"
  > {
  label: string;
  /** CSS color of the chip; omit for no chip, null for an empty chip. */
  color?: string | null;
  text: string;
  /** Popover open state; adds aria-haspopup/aria-expanded when defined. */
  open?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactdC: ReactNamespace;
    jsxcC: JsxNamespace;
    PropertyPopoverPanel: (props: PropertyPopoverPanelProps) => ReactElement;
    ShadowPropertyEditor: (props: ShadowPropertyEditorProps) => ReactElement;
    PropertyPopover: (props: PropertyPopoverProps) => ReactElement;
    PropertyPopoverTrigger: ForwardRefExoticComponent<
      PropertyPopoverTriggerProps & RefAttributes<HTMLButtonElement>
    >;
    RemovePropertyButton: (props: RemovePropertyButtonProps) => ReactElement;
  }
}

export function installUiPropertyPopover2(
  runtime: RuntimeBindings,
): () => void {
  var reactdC: ReactNamespace;
  var jsxcC: JsxNamespace;
  var PropertyPopoverTrigger: ForwardRefExoticComponent<
    PropertyPopoverTriggerProps & RefAttributes<HTMLButtonElement>
  >;
  function PropertyPopoverPanel({
    title: title,
    onClose: onClose,
    labelWidth = "3rem",
    children: children,
  }: PropertyPopoverPanelProps): ReactElement {
    return jsxcC.jsxs("div", {
      role: "dialog",
      "aria-label": typeof title === "string" ? title : undefined,
      className: "flex flex-col py-sm",
      style: {
        ["--pp-label-w"]: labelWidth,
        ["--pp-gutter-l"]: "var(--cds-pad-md)",
      },
      "data-kit": "effect-editor",
      children: [
        jsxcC.jsxs("div", {
          className: "flex items-center pr-xs pb-xs pl-md",
          children: [
            jsxcC.jsx("h3", {
              className:
                "min-w-0 flex-1 truncate text-body-semibold text-primary",
              children: title,
            }),
            jsxcC.jsx(runtime.Button, {
              variant: "ghost",
              size: "sm",
              iconOnly: true,
              icon: "X",
              "aria-label": "Close",
              tooltip: "Close",
              onClick: onClose,
            }),
          ],
        }),
        children,
      ],
    });
  }
  function ShadowPropertyEditor({
    title: title,
    value: value,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    onClose: onClose,
    spread = true,
    bounds = {},
    disabled: disabled,
    swatches: swatches,
    unifiedPopover: unifiedPopover,
    editsAreUndoSteps: editsAreUndoSteps,
  }: ShadowPropertyEditorProps): ReactElement {
    let callback = (input: Partial<ShadowRecord>) =>
        onChange({
          ...value,
          ...input,
        }),
      callback2 = (input: ShadowField) =>
        onLive && onLiveEnd
          ? {
              onScrub: (input2: number | undefined) =>
                onLive({
                  ...value,
                  [input]: input2,
                }),
              onScrubEnd: onLiveEnd,
            }
          : {};
    return jsxcC.jsxs(PropertyPopoverPanel, {
      title: title,
      onClose: onClose,
      children: [
        jsxcC.jsx(runtime.PropertyRow, {
          label: "Offset",
          disabled: disabled,
          onPress: (element: HTMLElement) =>
            element.querySelector("input")?.focus(),
          children: jsxcC.jsxs("div", {
            className: "flex min-w-0 flex-1 items-center gap-2",
            children: [
              jsxcC.jsx(runtime.PropertyNumberInput, {
                "aria-label": "Horizontal offset",
                prefix: "X",
                steppers: false,
                value: value.x,
                onValue: (input: number | undefined) =>
                  input !== undefined &&
                  callback({
                    x: input,
                  }),
                disabled: disabled,
                ...bounds.x,
                ...callback2("x"),
              }),
              jsxcC.jsx(runtime.PropertyNumberInput, {
                "aria-label": "Vertical offset",
                prefix: "Y",
                steppers: false,
                value: value.y,
                onValue: (input: number | undefined) =>
                  input !== undefined &&
                  callback({
                    y: input,
                  }),
                disabled: disabled,
                ...bounds.y,
                ...callback2("y"),
              }),
            ],
          }),
        }),
        jsxcC.jsx(runtime.NumberPropertyRow, {
          label: "Blur",
          unit: "px",
          value: value.blur,
          onValue: (input: number | undefined) =>
            input !== undefined &&
            callback({
              blur: input,
            }),
          disabled: disabled,
          min: 0,
          ...bounds.blur,
          ...callback2("blur"),
        }),
        spread &&
          jsxcC.jsx(runtime.NumberPropertyRow, {
            label: "Spread",
            unit: "px",
            value: value.spread ?? 0,
            onValue: (input: number | undefined) =>
              input !== undefined &&
              callback({
                spread: input,
              }),
            disabled: disabled,
            ...bounds.spread,
            ...callback2("spread"),
          }),
        jsxcC.jsx(runtime.ColorTextPropertyRow, {
          label: "Color",
          value: value.color,
          disabled: disabled,
          swatches: swatches,
          popoverTitle: unifiedPopover ? runtime.COLOR_LABEL : undefined,
          editsAreUndoSteps: editsAreUndoSteps,
          onChange: (input: string | undefined) =>
            input !== undefined &&
            callback({
              color: input,
            }),
          ...(onLive && onLiveEnd
            ? {
                onLive: (input: string) =>
                  onLive({
                    ...value,
                    color: input,
                  }),
                onLiveEnd: () => onLiveEnd(),
              }
            : {}),
        }),
      ],
    });
  }
  function PropertyPopover({
    open: open,
    onOpenChange: onOpenChange,
    trigger: trigger,
    anchor: anchor,
    side = "left",
    focusOnOpen: focusOnOpen,
    className: className,
    editsAreUndoSteps: editsAreUndoSteps,
    children: children,
  }: PropertyPopoverProps): ReactElement {
    return jsxcC.jsx(runtime.PropertyPopup, {
      open: open,
      onOpen: () => onOpenChange(true),
      onClose: () => onOpenChange(false),
      trigger: trigger,
      side: side,
      positionAnchor: anchor,
      focusOnOpen: focusOnOpen,
      padding: "none",
      className: (0, runtime.joinClassNames)(
        "w-[14.5rem] pointer-coarse:w-[17rem]",
        className,
      ),
      editsAreUndoSteps: editsAreUndoSteps,
      children: children,
    });
  }
  function RemovePropertyButton({
    label: label,
    onClick: onClick,
    disabled: disabled,
    disabledReason: disabledReason,
  }: RemovePropertyButtonProps): ReactElement {
    let value = "Remove " + label.toLowerCase();
    return jsxcC.jsx(runtime.Button, {
      variant: "ghost",
      iconOnly: true,
      icon: "Minus",
      "aria-label": value,
      tooltip: value,
      disabled: disabled,
      disabledReason: disabledReason,
      onClick: onClick,
      className: "shrink-0",
    });
  }
  bindRuntimeValue(
    runtime,
    "reactdC",
    () => reactdC,
    (value) => {
      reactdC = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxcC",
    () => jsxcC,
    (value) => {
      jsxcC = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyPopoverPanel", () => PropertyPopoverPanel);
  bindRuntimeValue(runtime, "ShadowPropertyEditor", () => ShadowPropertyEditor);
  bindRuntimeValue(runtime, "PropertyPopover", () => PropertyPopover);
  bindRuntimeValue(
    runtime,
    "PropertyPopoverTrigger",
    () => PropertyPopoverTrigger,
    (value) => {
      PropertyPopoverTrigger = value;
    },
  );
  bindRuntimeValue(runtime, "RemovePropertyButton", () => RemovePropertyButton);
  return () => {
    (0, runtime.initializeTooltipWrapper)();
    (0, runtime.initializeSelect)();
    (0, runtime.initializeUiPropertyRow2)();
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiNumberControls2)();
    (0, runtime.initializeUiPropertyRow3)();
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiColorPicker)();
    reactdC = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiPropertyLabels)();
    jsxcC = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    PropertyPopoverTrigger = reactdC.forwardRef<
      HTMLButtonElement,
      PropertyPopoverTriggerProps
    >(function (
      {
        label: label,
        color: color,
        text: text,
        open: open,
        onClick: onClick,
        disabled: disabled,
        ...props
      },
      options,
    ) {
      let memo = reactdC.useMemo(
        () =>
          typeof color === "string"
            ? (0, runtime.parseCssColorToHsva)(color)
            : undefined,
        [color],
      );
      return jsxcC.jsx(runtime.FieldButton, {
        ...(open !== undefined
          ? {
              "aria-haspopup": "dialog",
              "aria-expanded": open,
            }
          : undefined),
        ...props,
        ref: options,
        "aria-label": label + ": " + text,
        disabled: disabled,
        onClick: onClick,
        chip:
          color !== undefined
            ? jsxcC.jsx(runtime.ColorChip, {
                hex: memo ? (0, runtime.hsvaToHexColor)(memo) : null,
                alpha: (memo?.a ?? 1) * 100,
              })
            : undefined,
        caption:
          memo !== undefined ? Math.round(memo.a * 100) + "%" : undefined,
        children: text,
      });
    });
  };
}
