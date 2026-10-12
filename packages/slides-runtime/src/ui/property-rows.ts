/** Restored application module; prepare first, initialize in original order. */
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  ColorSwatchInput,
  SwatchKind,
  SwatchKindOption,
  SwatchPaletteTab,
} from "./color-select";
import type { ContrastRequirement } from "./contrast";
import type { ContrastCheck, ContrastForeground } from "./contrast-controls";
import type { DataAttributeProps } from "./editor-selection";
import type { InspectorIcon } from "./inspector-icons";
import type { NumberStepOptions } from "./number-controls";
import type { PopoverSide } from "./property-focus";
import type { SelectItem, SelectValue } from "./select";

/** Props of a row that only wraps `PropertyRow`. */
export interface InspectorPropertyRowProps {
  label?: ReactNode;
  onReset?: () => void;
  title?: string;
  description?: ReactNode;
  /** Called with the row when its label area or empty space is pressed. */
  onPress?: (row: HTMLElement) => void;
  disabled?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
}
/** What every labelled property row takes. */
export interface PropertyRowCommonProps {
  /** Also the accessible name of the row's control. */
  label: string;
  /** Shows a reset button next to the label. */
  onReset?: () => void;
  title?: string;
  description?: ReactNode;
  disabled?: boolean;
  trailing?: ReactNode;
}
export interface NumberPropertyRowProps
  extends PropertyRowCommonProps,
    NumberStepOptions {
  /** `undefined` when the field is empty. */
  value?: number;
  /** Called with `undefined` when a clearable field is emptied. */
  onValue: (value: number | undefined) => void;
  /** Called while scrubbing; falls back to `onValue`. */
  onScrub?: (value: number) => void;
  onScrubEnd?: () => void;
  smallStep?: number;
  placeholder?: string;
  hint?: string;
  /** Value the first arrow-key step starts from; `null` disables stepping an empty field. */
  emptyStepFrom?: number | null;
  clearable?: boolean;
  prefix?: ReactNode;
  unit?: string;
  /** Units to pick from; a unit picker is shown when `onUnit` is given too. */
  units?: readonly string[];
  onUnit?: (unit: string) => void;
  mixed?: boolean;
  adornment?: ReactNode;
}
export interface SliderPropertyRowProps extends PropertyRowCommonProps {
  value: number;
  onValue: (value: number) => void;
  /** Called while dragging; falls back to `onValue`. */
  onLive?: (value: number) => void;
  /** Called once the drag or scrub ends, with the last live value. */
  onLiveEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  adornment?: ReactNode;
  mixed?: boolean;
}
export interface TogglePropertyRowProps extends PropertyRowCommonProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}
/** One option of a choice row. */
export interface ChoicePropertyRowOption {
  value: SelectValue;
  label: string;
  /** With icons on every option the choice is a row of icon buttons. */
  icon?: InspectorIcon;
  title?: string;
  /** Disables the option and says why. */
  whyDisabled?: string;
}
export interface ChoicePropertyRowProps extends PropertyRowCommonProps {
  options: readonly ChoicePropertyRowOption[];
  value: SelectValue | null;
  onChange: (value: SelectValue) => void;
  popupAttrs?: DataAttributeProps;
}
export interface SelectPropertyRowProps extends PropertyRowCommonProps {
  icon?: string;
  hint?: string;
  options: readonly SelectItem[];
  value: SelectValue | null;
  onChange: (value: SelectValue) => void;
  placeholder?: string;
  popupAttrs?: DataAttributeProps;
  searchable?: boolean;
  searchLabel?: string;
  onOpenChange?: (open: boolean) => void;
}
export interface ColorChipProps {
  /** CSS color of the chip; `null` leaves it empty. */
  hex: string | null;
  /** Opacity in percent (default 100). */
  alpha?: number;
  className?: string;
}
/** Shown instead of a swatch when the fill is a gradient or an image. */
export interface ColorFillChip {
  css: string;
  text: string;
}
/** The fill type switch in the header of a color popover. */
export interface ColorHeaderTabs {
  value: string;
  options: SwatchKindOption[];
  onChange: SwatchKind["onChange"];
  label?: string;
  /** The tab value that means a plain color; "color" when omitted. */
  colorTab?: string;
}
/** Where a color popover opens. */
export interface ColorPopoverPosition {
  side?: PopoverSide;
  /** Finds the element to anchor to from the row's color field. */
  anchor?: (field: Element) => Element | null | undefined;
}
export interface ColorPropertyRowProps {
  label: string;
  /** A CSS color; `undefined` when unset. */
  value?: string;
  onChange: (color: string | undefined) => void;
  /** Called while a color is being dragged; falls back to `onChange`. */
  onLive?: (color: string) => void;
  onLiveEnd?: (color: string) => void;
  swatches?: readonly ColorSwatchInput[];
  /** Name of the chosen swatch; `null` when none is. */
  current?: string | null;
  onSwatch?: (name: string) => void;
  fold?: boolean;
  opaque?: boolean;
  description?: string;
  contrast?: ContrastRequirement;
  /** Shows the contrast mark next to the value. */
  contrastMark?: boolean;
  placeholder?: string;
  clearLabel?: string;
  popupAttrs?: DataAttributeProps;
  mixed?: boolean;
  unset?: boolean;
  /** Name shown instead of the color value; `null` shows the value. */
  valueName?: string | null;
  chip?: ColorFillChip;
  headerTabs?: ColorHeaderTabs;
  /** Shown instead of the color picker when the header tab is not a plain color. */
  panel?: ReactNode;
  closeLabel?: string;
  popoverTitle?: string;
  allowNone?: boolean;
  onNone?: () => void;
  isNone?: boolean;
  noneDisabledReason?: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Keeps the editor's text selection while the popover is used. */
  keepFocus?: boolean;
  editsAreUndoSteps?: boolean;
  popover?: ColorPopoverPosition;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  testid?: string;
}
export interface ColorTextPropertyRowProps
  extends Omit<ColorPropertyRowProps, "open" | "onOpenChange"> {
  adornment?: ReactNode;
  trailing?: ReactNode;
  onReset?: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactK30: ReactNamespace;
    reactZ7: ReactNamespace;
    jsxmq: JsxNamespace;
    InspectorPropertyRow: (props: InspectorPropertyRowProps) => ReactElement;
    NumberPropertyRow: (props: NumberPropertyRowProps) => ReactElement;
    sliderFraction: (value: number, min: number, max: number) => number;
    sliderValueAtFraction: (
      fraction: number,
      min: number,
      max: number,
      step: number,
    ) => number;
    SliderPropertyRow: (props: SliderPropertyRowProps) => ReactElement;
    TogglePropertyRow: (props: TogglePropertyRowProps) => ReactElement;
    /** Choices beyond this many are shown as a dropdown instead of inline. */
    MAX_INLINE_CHOICE_OPTIONS: number;
    ChoicePropertyRow: (props: ChoicePropertyRowProps) => ReactElement;
    SelectPropertyRow: (props: SelectPropertyRowProps) => ReactElement;
    COLOR_CHIP_PATTERN: RegExp;
    ColorChip: (props: ColorChipProps) => ReactElement;
    useContrastResult: (
      contrast: ContrastRequirement | undefined,
      value: ContrastForeground,
    ) => ContrastCheck[] | undefined;
    ColorPropertyRow: (props: ColorPropertyRowProps) => ReactElement;
    preventDefaultEvent: (event: { preventDefault(): void }) => void;
    ColorTextPropertyRow: (props: ColorTextPropertyRowProps) => ReactElement;
  }
}

export function installUiPropertyRows(runtime: RuntimeBindings): () => void {
  var reactK30: ReactNamespace;
  var reactZ7: ReactNamespace;
  var jsxmq: JsxNamespace;
  var MAX_INLINE_CHOICE_OPTIONS: number;
  var COLOR_CHIP_PATTERN: RegExp;
  var preventDefaultEvent: RuntimeBindings["preventDefaultEvent"];
  function InspectorPropertyRow({
    label: label,
    onReset: onReset,
    title: title,
    description: description,
    onPress: onPress,
    disabled: disabled,
    trailing: trailing,
    children: children,
  }: InspectorPropertyRowProps): ReactElement {
    return jsxmq.jsx(runtime.PropertyRow, {
      label: label,
      onReset: onReset,
      onPress: onPress,
      disabled: disabled,
      title: title,
      description: description,
      trailing: trailing,
      children: children,
    });
  }
  function NumberPropertyRow({
    label: label,
    value: value,
    onValue: onValue,
    onScrub: onScrub,
    onScrubEnd: onScrubEnd,
    min: min,
    max: max,
    step: step,
    smallStep: smallStep,
    placeholder: placeholder,
    hint: hint,
    emptyStepFrom: emptyStepFrom,
    clearable: clearable,
    prefix: prefix,
    unit: unit,
    units: units,
    onUnit: onUnit,
    mixed: mixed,
    adornment: adornment,
    trailing: trailing,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
  }: NumberPropertyRowProps): ReactElement {
    let ref = reactZ7.useRef(false),
      callback = (): void => {
        ref.current = true;
        setTimeout(() => {
          ref.current = false;
        }, 0);
        onScrubEnd?.();
      },
      value2 =
        onScrub &&
        emptyStepFrom !== null &&
        placeholder !== undefined &&
        /^-?\d+(\.\d+)?$/.test(placeholder)
          ? Number(placeholder)
          : undefined,
      value3 =
        value ??
        (typeof emptyStepFrom === "number" && Number.isFinite(emptyStepFrom)
          ? emptyStepFrom
          : value2),
      value4 = !disabled && !mixed && value3 !== undefined,
      value5 = (0, runtime.useNumberScrubGesture)({
        value: value3 ?? NaN,
        step: step,
        min: min,
        max: max,
        disabled: !value4,
        onScrub: (input: number): void => (onScrub ?? onValue)(input),
        onScrubEnd: callback,
      }),
      value6 = units !== undefined && onUnit !== undefined;
    return jsxmq.jsxs(runtime.PropertyRow, {
      label: label,
      title: title,
      description: description,
      disabled: disabled,
      onReset: onReset,
      trailing: trailing,
      labelProps: {
        onMouseDown: value4 ? value5 : undefined,
        onPointerDown: value4 ? runtime.captureNumberScrubPointer : undefined,
        className: value4 ? "cursor-ew-resize" : undefined,
      },
      onPress: (element: HTMLElement): void => {
        if (ref.current) {
          return;
        }
        element.querySelector("input")?.focus();
      },
      children: [
        jsxmq.jsx(runtime.PropertyNumberInput, {
          "aria-label": label,
          prefix: prefix,
          unit: value6 ? undefined : unit,
          value: value,
          onValue: onValue,
          onScrub: onScrub,
          onScrubEnd: callback,
          min: min,
          max: max,
          step: step,
          smallStep: smallStep,
          placeholder: placeholder,
          hint: hint,
          emptyStepFrom: emptyStepFrom,
          clearable: clearable,
          mixed: mixed,
          disabled: disabled,
        }),
        value6
          ? jsxmq.jsx(runtime.Select, {
              compact: true,
              "aria-label": label + " unit",
              title: "Unit",
              items: units!.map((input: string) => ({
                value: input,
                label: input,
              })),
              value: unit ?? units![0] ?? null,
              onChange: onUnit,
              disabled: disabled,
              align: "end",
            })
          : null,
        adornment,
      ],
    });
  }
  function sliderFraction(value: number, min: number, max: number): number {
    if (max <= min) {
      return 0;
    }
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
  function sliderValueAtFraction(
    fraction: number,
    min: number,
    max: number,
    step: number,
  ): number {
    let value = min + Math.max(0, Math.min(1, fraction)) * (max - min);
    if (!step || step <= 0) {
      return value;
    }
    let value2 = Math.round((value - min) / step) * step + min,
      callback = (input: number): number => {
        let value5 = String(input),
          value6 = value5.indexOf(".");
        if (value6 === -1) {
          return 0;
        } else {
          return value5.length - value6 - 1;
        }
      },
      value3 = Math.max(callback(step), callback(min)),
      value4 = value3 === 0 ? value2 : Number(value2.toFixed(value3));
    return Math.max(min, Math.min(max, value4));
  }
  function SliderPropertyRow({
    label: label,
    value: value,
    onValue: onValue,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    min = 0,
    max = 100,
    step = 1,
    unit: unit,
    adornment: adornment,
    mixed = false,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
  }: SliderPropertyRowProps): ReactElement {
    let ref = reactZ7.useRef(new Set<() => void>()),
      ref2 = reactZ7.useRef(onLiveEnd);
    ref2.current = onLiveEnd;
    let ref3 = reactZ7.useRef(value);
    reactZ7.useEffect(
      () => () => {
        for (let value3 of ref.current) value3();
        ref.current.clear();
      },
      [],
    );
    let callback = (input: ReactPointerEvent<HTMLDivElement>): void => {
        if (disabled) {
          return;
        }
        if (input.button !== 0) {
          return;
        }
        let currentTarget = input.currentTarget,
          bounds = currentTarget.getBoundingClientRect(),
          pointerId = input.pointerId;
        try {
          currentTarget.setPointerCapture(pointerId);
        } catch {}
        currentTarget.focus();
        let value3 = value,
          flag = false,
          callback3 = (input2: number): void => {
            let value4 = sliderValueAtFraction(
              (input2 - bounds.left - 6) / (bounds.width - 12),
              min,
              max,
              step,
            );
            if (value4 === value3) {
              return;
            }
            value3 = value4;
            flag = true;
            (onLive ?? onValue)(value4);
          };
        callback3(input.clientX);
        let callback4 = (input2: PointerEvent): void => {
            if (input2.pointerId !== pointerId) {
              return;
            }
            callback3(input2.clientX);
          },
          callback5 = (): void => {
            window.removeEventListener("pointermove", callback4);
            window.removeEventListener("pointerup", callback7);
            window.removeEventListener("pointercancel", callback7);
          },
          callback6 = (): void => {
            ref.current.delete(callback6);
            callback5();
            if (flag) {
              flag = false;
              ref2.current?.(value3);
            }
          },
          callback7 = (input2: PointerEvent): void => {
            if (input2.pointerId !== pointerId) {
              return;
            }
            callback6();
          };
        window.addEventListener("pointermove", callback4);
        window.addEventListener("pointerup", callback7);
        window.addEventListener("pointercancel", callback7);
        ref.current.add(callback6);
      },
      callback2 = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        if (disabled) {
          return;
        }
        let value3: number | undefined;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          value3 = (0, runtime.steppedNumberValue)(value, 1, event, {
            step: step,
            min: min,
            max: max,
          });
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          value3 = (0, runtime.steppedNumberValue)(value, -1, event, {
            step: step,
            min: min,
            max: max,
          });
        } else if (event.key === "Home") {
          value3 = min;
        } else if (event.key === "End") {
          value3 = max;
        } else if (event.key === " ") {
          event.preventDefault();
          return;
        }
        if (value3 === undefined) {
          return;
        }
        event.preventDefault();
        if (value3 === value) {
          return;
        }
        onValue(value3);
      },
      value2 = sliderFraction(value, min, max);
    return jsxmq.jsxs(runtime.PropertyRow, {
      label: label,
      title: title,
      description: description,
      disabled: disabled,
      onReset: onReset,
      children: [
        jsxmq.jsx("div", {
          className: "w-[68px] shrink-0",
          children: jsxmq.jsx(runtime.PropertyNumberInput, {
            "aria-label": label,
            value: mixed ? undefined : value,
            mixed: mixed,
            emptyStepFrom: mixed ? null : undefined,
            onValue: (input: number | undefined): void => {
              if (input !== undefined) {
                onValue(input);
              }
            },
            onScrub: (input: number): void => {
              ref3.current = input;
              (onLive ?? onValue)(input);
            },
            onScrubEnd: () => ref2.current?.(ref3.current),
            min: min,
            max: max,
            step: step,
            scrubOrigin: min,
            unit: unit,
            steppers: false,
            disabled: disabled,
          }),
        }),
        jsxmq.jsxs("div", {
          role: "slider",
          "aria-label": label,
          "aria-valuemin": min,
          "aria-valuemax": max,
          "aria-valuenow": mixed ? undefined : value,
          "aria-valuetext": mixed ? runtime.MIXED_LABEL : undefined,
          "aria-disabled": disabled || undefined,
          tabIndex: disabled ? -1 : 0,
          onPointerDown: callback,
          onKeyDown: callback2,
          className:
            "group/track relative ml-1 flex h-control min-w-8 flex-1 touch-none select-none items-center px-1.5 outline-none focus-visible:outline-hidden aria-disabled:opacity-50 pointer-coarse:h-10",
          children: [
            jsxmq.jsx("div", {
              className: "h-0.5 w-full rounded-full bg-alpha-2",
              children: mixed
                ? null
                : jsxmq.jsx("div", {
                    className: "h-full rounded-full bg-fill-accent",
                    style: {
                      width: String(value2 * 100) + "%",
                    },
                  }),
            }),
            mixed
              ? null
              : jsxmq.jsx("div", {
                  "data-kit": "slider-thumb",
                  className: (0, runtime.joinClassNames)(
                    "pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full",
                    "bg-surface-3 shadow-panel-sm group-focus-visible/track:shadow-focus",
                  ),
                  style: {
                    left: "calc(" + String(value2) + " * (100% - 12px) + 6px)",
                  },
                }),
          ],
        }),
        adornment,
      ],
    });
  }
  function TogglePropertyRow({
    label: label,
    checked: checked,
    onChange: onChange,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
  }: TogglePropertyRowProps): ReactElement {
    return jsxmq.jsx(runtime.PropertyRow, {
      label: label,
      title: title,
      description: description,
      disabled: disabled,
      onReset: onReset,
      onPress: () => onChange(!checked),
      children: jsxmq.jsx(runtime.Switch, {
        checked: checked,
        onCheckedChange: (input: boolean): void => onChange(input),
        "aria-label": label,
        disabled: disabled,
      }),
    });
  }
  function ChoicePropertyRow({
    label: label,
    options: options,
    value: value,
    onChange: onChange,
    popupAttrs: popupAttrs,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
  }: ChoicePropertyRowProps): ReactElement {
    let value2 = options.length > MAX_INLINE_CHOICE_OPTIONS;
    return jsxmq.jsx(runtime.PropertyRow, {
      label: label,
      title: title,
      description: description,
      disabled: disabled,
      onReset: onReset,
      onPress: value2
        ? (element: HTMLElement): void =>
            element
              .querySelector<HTMLElement>('[data-kit="PropertySelect"]')
              ?.click()
        : undefined,
      children: value2
        ? jsxmq.jsx(runtime.Select, {
            "aria-label": label,
            items: options.map((input: ChoicePropertyRowOption) => ({
              value: input.value,
              label: input.label,
            })),
            value: value,
            onChange: onChange,
            disabled: disabled,
            popupAttrs: popupAttrs,
          })
        : jsxmq.jsx(runtime.SegmentedControl, {
            "aria-label": label,
            fullWidth: !options.every(
              (input: ChoicePropertyRowOption): boolean =>
                input.icon !== undefined,
            ),
            segments: options.map((input: ChoicePropertyRowOption) => {
              let state = {
                disabled: disabled || input.whyDisabled !== undefined,
                disabledReason: input.whyDisabled,
              };
              if (input.icon !== undefined) {
                return {
                  value: input.value,
                  icon: input.icon,
                  tooltip: input.title ?? input.label,
                  ...state,
                };
              } else {
                return {
                  value: input.value,
                  label: input.label,
                  tooltip: input.title,
                  ...state,
                };
              }
            }),
            value: value,
            onChange: disabled
              ? () => {
                  return;
                }
              : onChange,
          }),
    });
  }
  function SelectPropertyRow({
    label: label,
    icon: icon,
    hint: hint,
    options: options,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    popupAttrs: popupAttrs,
    searchable: searchable,
    searchLabel: searchLabel,
    onOpenChange: onOpenChange,
    trailing: trailing,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
  }: SelectPropertyRowProps): ReactElement {
    return jsxmq.jsx(runtime.PropertyRow, {
      label: label,
      title: title,
      description: description,
      disabled: disabled,
      onReset: onReset,
      trailing: trailing,
      onPress: (element: HTMLElement): void =>
        element
          .querySelector<HTMLElement>('[data-kit="PropertySelect"]')
          ?.click(),
      children: jsxmq.jsx(runtime.Select, {
        "aria-label": label,
        icon: icon,
        hint: hint,
        items: options,
        value: value,
        onChange: onChange,
        placeholder: placeholder,
        disabled: disabled,
        popupAttrs: popupAttrs,
        searchable: searchable,
        searchLabel: searchLabel,
        onOpenChange: onOpenChange,
      }),
    });
  }
  function ColorChip({
    hex: hex,
    alpha = 100,
    className: className,
  }: ColorChipProps): ReactElement {
    return jsxmq.jsx("span", {
      "aria-hidden": "true",
      className: (0, runtime.joinClassNames)(
        runtime.COLOR_SWATCH_CLASS,
        className,
      ),
      children:
        hex !== null
          ? jsxmq.jsxs(jsxmq.Fragment, {
              children: [
                jsxmq.jsx("span", {
                  className: "absolute inset-y-0 left-0 w-1/2",
                  style: {
                    backgroundColor: hex,
                  },
                }),
                jsxmq.jsx("span", {
                  className: "absolute inset-y-0 right-0 w-1/2",
                  style: {
                    backgroundColor: hex,
                    opacity: Math.round(alpha * 100) / 1e4,
                  },
                }),
              ],
            })
          : null,
    });
  }
  function useContrastResult(
    contrast: ContrastRequirement | undefined,
    value: ContrastForeground,
  ): ContrastCheck[] | undefined {
    let value2 =
      contrast === undefined ? undefined : JSON.stringify(contrast);
    return reactZ7.useMemo(
      () =>
        contrast === undefined || value === undefined
          ? undefined
          : (0, runtime.colorContrastResults)(value, contrast),
      [value2, value],
    );
  }
  function ColorPropertyRow({
    label: label,
    value: value,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    swatches: swatches,
    current: current,
    onSwatch: onSwatch,
    fold: fold,
    opaque: opaque,
    description: description,
    contrast: contrast,
    contrastMark = false,
    placeholder: placeholder,
    clearLabel: clearLabel,
    popupAttrs: popupAttrs,
    mixed = false,
    unset = false,
    valueName: valueName,
    chip: chip,
    headerTabs: headerTabs,
    panel: panel,
    closeLabel = runtime.DEFAULT_CLOSE_LABEL,
    popoverTitle: popoverTitle,
    allowNone: allowNone,
    onNone: onNone,
    isNone: isNone,
    noneDisabledReason: noneDisabledReason,
    disabled: disabled,
    disabledReason: disabledReason,
    keepFocus = false,
    editsAreUndoSteps: editsAreUndoSteps,
    popover: popover,
    open: open,
    onOpenChange: onOpenChange,
    title: title,
    testid: testid,
  }: ColorPropertyRowProps): ReactElement {
    let [value2, value3] = reactZ7.useState(false),
      value4 = open ?? value2,
      callback = (input: boolean): void => {
        value3(input);
        onOpenChange?.(input);
      },
      [value5, value6] = reactZ7.useState(false),
      ref = reactZ7.useRef(false),
      ref2 = reactZ7.useRef<HTMLSpanElement>(null),
      value7 = popover?.anchor,
      value8 =
        value7 === undefined
          ? undefined
          : () =>
              ref2.current === null ? null : value7(ref2.current),
      memo = reactZ7.useMemo(() => {
        let value23 = value ?? placeholder;
        if (value23 === undefined) {
          return;
        }
        let value24 = (0, runtime.parseCssColorToHsva)(value23);
        return {
          solid: (0, runtime.hsvaToHexColor)(value24),
          alpha: value24.a,
        };
      }, [value, placeholder]),
      value9 = value !== undefined && COLOR_CHIP_PATTERN.test(value),
      memo2 = reactZ7.useMemo(() => {
        if (!value9 || memo === undefined) {
          return;
        }
        if (valueName !== undefined) {
          return valueName ?? undefined;
        }
        if (swatches === undefined) {
          return;
        }
        if (current !== undefined) {
          if (current === null) {
            return;
          }
          let value24 = swatches.find(
            (input: ColorSwatchInput): boolean =>
              typeof input !== "string" &&
              (input.name === current ||
                ("picks" in input && input.picks === current)),
          );
          if (
            value24 !== undefined &&
            typeof value24 !== "string" &&
            value24.label !== undefined &&
            value24.label.trim() !== ""
          ) {
            return value24.label;
          } else {
            return undefined;
          }
        }
        let value23 = memo.solid.toLowerCase();
        for (let value24 of swatches) {
          let value25 =
            typeof value24 === "string"
              ? value24
              : "value" in value24
                ? value24.value
                : value24.color;
          if (!COLOR_CHIP_PATTERN.test(value25)) {
            continue;
          }
          let value26 = (0, runtime.parseCssColorToHsva)(value25);
          if (value26.a < 1) {
            continue;
          }
          if ((0, runtime.hsvaToHexColor)(value26).toLowerCase() !== value23) {
            continue;
          }
          if (
            typeof value24 !== "string" &&
            value24.label !== undefined &&
            value24.label.trim() !== ""
          ) {
            return value24.label;
          } else {
            return undefined;
          }
        }
        return;
      }, [value9, memo, swatches, current, valueName]),
      value10 =
        value !== undefined
          ? typeof valueName === "string"
            ? valueName
            : value9 && memo !== undefined
              ? (memo2 ?? memo.solid.toUpperCase())
              : value
          : (clearLabel ?? placeholder ?? "None"),
      value11 =
        value9 && memo !== undefined && memo.alpha < 1
          ? Math.round(memo.alpha * 100) + "%"
          : undefined,
      value12 =
        mixed || chip !== undefined ? undefined : (value ?? placeholder),
      value13 = useContrastResult(contrast, value12),
      memo3 = reactZ7.useMemo(
        () =>
          value13 === undefined
            ? undefined
            : (0, runtime.contrastDisplayInfo)(value13).sentence,
        [value13],
      ),
      value14 =
        description !== undefined && description !== ""
          ? memo3 !== undefined
            ? description.replace(/\.?\s*$/, ". ") + memo3
            : description
          : memo3,
      value15 = reactZ7.useId(),
      value16 = swatches !== undefined && swatches.length > 0,
      value17 =
        headerTabs === undefined ||
        headerTabs.value === (headerTabs.colorTab ?? "color"),
      [value18, value19] = reactZ7.useState<SwatchPaletteTab>("system"),
      [value20, value21] = reactZ7.useState(value4);
    if (value4 !== value20) {
      value21(value4);
      if (value4) {
        value19(value16 && value17 ? "system" : "custom");
        value6(ref.current);
        ref.current = false;
      }
    }
    let value22 = jsxmq.jsx(runtime.ColorSelect, {
      testid: testid !== undefined ? testid + "-menu" : undefined,
      title: popoverTitle ?? label,
      swatches: swatches,
      current: current,
      onSwatch: onSwatch,
      fold: fold,
      value: value ?? placeholder ?? "#000000",
      unset: value === undefined || mixed || !value17 || unset,
      repick: unset && current != null,
      opaque: opaque,
      contrast: value12 !== undefined ? contrast : undefined,
      onChange: onLive ?? onChange,
      onPickEnd: onLive ? onLiveEnd : undefined,
      none: allowNone
        ? {
            current:
              isNone ??
              (value === undefined &&
                placeholder === undefined &&
                chip === undefined &&
                !mixed),
            onPick: () => {
              if (onNone) {
                onNone();
              } else {
                onChange(undefined);
              }
              callback(false);
            },
            ...(noneDisabledReason !== undefined
              ? {
                  disabledReason: noneDisabledReason,
                }
              : {}),
          }
        : undefined,
      kind:
        headerTabs !== undefined
          ? {
              value: headerTabs.value,
              options: headerTabs.options,
              onChange: headerTabs.onChange,
              label: headerTabs.label ?? label,
              colorValue: headerTabs.colorTab,
            }
          : undefined,
      face: panel,
      tab: value16 ? value18 : undefined,
      onTab: value19,
      heading: popoverTitle ?? label,
      headerEnd:
        value16 || headerTabs !== undefined || popoverTitle !== undefined
          ? jsxmq.jsx(runtime.Button, {
              variant: "ghost",
              size: "sm",
              iconOnly: true,
              icon: jsxmq.jsx(runtime.Icon, {
                name: "X",
                size: "sm",
                className: "text-secondary",
              }),
              "aria-label": closeLabel,
              onClick: () => callback(false),
              className: "relative shrink-0",
            })
          : undefined,
    });
    return jsxmq.jsxs("span", {
      ref: ref2,
      className: "relative flex min-w-0 flex-1",
      title: disabled ? disabledReason : undefined,
      children: [
        jsxmq.jsx(runtime.PropertyPopup, {
          open: value4,
          onOpen: () => callback(true),
          onClose: () => callback(false),
          trigger: jsxmq.jsx(runtime.FieldButton, {
            "data-testid": testid,
            title: disabled ? (disabledReason ?? title) : title,
            "aria-label":
              label +
              ": " +
              (mixed
                ? runtime.MIXED_LABEL
                : chip !== undefined
                  ? chip.text
                  : value !== undefined
                    ? value10 + (value11 !== undefined ? " " + value11 : "")
                    : clearLabel !== undefined &&
                        /[\p{L}\p{N}]/u.test(clearLabel)
                      ? clearLabel
                      : clearLabel !== undefined
                        ? "none"
                        : "unset"),
            "aria-describedby": value14 !== undefined ? value15 : undefined,
            disabled: disabled,
            onClick: (input: ReactMouseEvent<HTMLButtonElement>): void => {
              if (!value4) {
                ref.current = input.detail === 0;
              }
            },
            onMouseDown: keepFocus ? preventDefaultEvent : undefined,
            muted: mixed,
            chip: mixed
              ? jsxmq.jsxs(runtime.PropertyColorPreview, {
                  "data-kit": "swatch-mixed",
                  children: [
                    jsxmq.jsx("span", {
                      className: "absolute inset-y-0 left-0 w-1/2",
                      style: {
                        backgroundColor: "#ffffff",
                      },
                    }),
                    jsxmq.jsx("span", {
                      className: "absolute inset-y-0 right-0 w-1/2",
                      style: {
                        backgroundColor: "#141413",
                      },
                    }),
                  ],
                })
              : chip !== undefined
                ? jsxmq.jsx(runtime.PropertyColorPreview, {
                    "data-kit": "swatch-chip",
                    background: chip.css,
                  })
                : jsxmq.jsx(ColorChip, {
                    hex: memo?.solid ?? null,
                    alpha: (memo?.alpha ?? 1) * 100,
                  }),
            caption: !mixed && chip === undefined ? value11 : undefined,
            trailing:
              contrastMark && value13 !== undefined
                ? jsxmq.jsx(runtime.ContrastMark, {
                    results: value13,
                    sentence: false,
                    className: "ml-auto pl-1",
                  })
                : undefined,
            children: mixed
              ? runtime.MIXED_LABEL
              : chip !== undefined
                ? chip.text
                : value10,
          }),
          align: "left",
          side: popover?.side,
          positionAnchor: value8,
          padding: "none",
          "aria-label": popoverTitle ?? label,
          className: runtime.COLOR_PICKER_POPOVER_CLASS,
          popupAttrs: popupAttrs,
          editsAreUndoSteps: editsAreUndoSteps,
          focusOnOpen: value5,
          keepFocus: keepFocus,
          planHeight:
            value16 || headerTabs !== undefined
              ? runtime.COLOR_PICKER_POPOVER_HEIGHT
              : undefined,
          children: keepFocus
            ? jsxmq.jsx("div", {
                "data-session-strip": "",
                onKeyDownCapture: runtime.popupPointerEvent,
                children: value22,
              })
            : value22,
        }),
        value14 !== undefined
          ? jsxmq.jsx("span", {
              id: value15,
              hidden: true,
              "data-kit": "field-description",
              children: value14,
            })
          : null,
      ],
    });
  }
  function ColorTextPropertyRow({
    label: label,
    value: value,
    onChange: onChange,
    contrast: contrast,
    placeholder: placeholder,
    clearLabel: clearLabel,
    adornment: adornment,
    trailing: trailing,
    mixed = false,
    chip: chip,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
    ...remainingProps
  }: ColorTextPropertyRowProps): ReactElement {
    let [value2, value3] = reactZ7.useState(false);
    return jsxmq.jsxs(runtime.PropertyRow, {
      label: label,
      title: title,
      disabled: disabled,
      onReset:
        onReset ??
        (clearLabel !== undefined && value !== undefined
          ? () => onChange(undefined)
          : undefined),
      trailing: trailing,
      onPress: () => {
        if (disabled) {
          return;
        }
        value3(!value2);
      },
      onPointerDown: (
        event: ReactPointerEvent<HTMLDivElement> & { target: Element },
      ): void => {
        if (
          value2 &&
          !(0, runtime.propertyRowPressShouldIgnore)(
            event.currentTarget,
            event.target,
          )
        ) {
          event.stopPropagation();
        }
      },
      children: [
        jsxmq.jsx(ColorPropertyRow, {
          ...remainingProps,
          label: label,
          value: value,
          onChange: onChange,
          description: description,
          contrast: contrast,
          placeholder: placeholder,
          clearLabel: clearLabel,
          mixed: mixed,
          chip: chip,
          disabled: disabled,
          open: value2,
          onOpenChange: value3,
        }),
        adornment,
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactK30",
    () => reactK30,
    (value) => {
      reactK30 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactZ7",
    () => reactZ7,
    (value) => {
      reactZ7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxmq",
    () => jsxmq,
    (value) => {
      jsxmq = value;
    },
  );
  bindRuntimeValue(runtime, "InspectorPropertyRow", () => InspectorPropertyRow);
  bindRuntimeValue(runtime, "NumberPropertyRow", () => NumberPropertyRow);
  bindRuntimeValue(runtime, "sliderFraction", () => sliderFraction);
  bindRuntimeValue(
    runtime,
    "sliderValueAtFraction",
    () => sliderValueAtFraction,
  );
  bindRuntimeValue(runtime, "SliderPropertyRow", () => SliderPropertyRow);
  bindRuntimeValue(runtime, "TogglePropertyRow", () => TogglePropertyRow);
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_CHOICE_OPTIONS",
    () => MAX_INLINE_CHOICE_OPTIONS,
    (value) => {
      MAX_INLINE_CHOICE_OPTIONS = value;
    },
  );
  bindRuntimeValue(runtime, "ChoicePropertyRow", () => ChoicePropertyRow);
  bindRuntimeValue(runtime, "SelectPropertyRow", () => SelectPropertyRow);
  bindRuntimeValue(
    runtime,
    "COLOR_CHIP_PATTERN",
    () => COLOR_CHIP_PATTERN,
    (value) => {
      COLOR_CHIP_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "ColorChip", () => ColorChip);
  bindRuntimeValue(runtime, "useContrastResult", () => useContrastResult);
  bindRuntimeValue(runtime, "ColorPropertyRow", () => ColorPropertyRow);
  bindRuntimeValue(
    runtime,
    "preventDefaultEvent",
    () => preventDefaultEvent,
    (value) => {
      preventDefaultEvent = value;
    },
  );
  bindRuntimeValue(runtime, "ColorTextPropertyRow", () => ColorTextPropertyRow);
  return () => {
    reactK30 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiPropertyRow3)();
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeIconButton)();
    (0, runtime.initializeUiColorPicker)();
    (0, runtime.initializeUiContrast)();
    (0, runtime.initializeUiContrastControls)();
    (0, runtime.initializeColorSelect)();
    (0, runtime.initializeUiPropertyRow)();
    (0, runtime.initializeUiNumberControls2)();
    (0, runtime.initializeUiPropertyRow3)();
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiPropertyFocus)();
    (0, runtime.initializeSelect)();
    (0, runtime.initializeUiNumberControls)();
    (0, runtime.initializeNumberScrubNoop)();
    (0, runtime.initializeUiPropertyLabels)();
    reactZ7 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxmq = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    MAX_INLINE_CHOICE_OPTIONS = 4;
    COLOR_CHIP_PATTERN =
      /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,/]+[\d.]+)?\s*\))$/i;
    preventDefaultEvent = (event: { preventDefault(): void }): void =>
      event.preventDefault();
  };
}
