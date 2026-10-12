/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  ButtonHTMLAttributes,
  ChangeEvent as ReactChangeEvent,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from "react";
import type { ContrastColorFixResult, ContrastRequirement } from "./contrast";

/** A color as hue (0-360), saturation, value and alpha (each 0-1). */
export interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}
/** Follows the pointer while a picker gesture runs: client position and the bounds of the track. */
export type ColorPickerPointerMove = (
  clientX: number,
  clientY: number,
  bounds: DOMRect,
) => void;
/** Applies a pointer position to the color; true when the color changed or must be committed. */
export type ColorPickerPointerChange = (
  clientX: number,
  clientY: number,
  bounds: DOMRect,
) => boolean;
/** A key event on one of the picker's text inputs (the target is the input itself). */
type ColorInputKeyEvent = ReactKeyboardEvent<HTMLInputElement> & {
  target: HTMLInputElement;
};
export interface ColorPickerLabelProps {
  text: string;
  title?: boolean;
}
export interface ColorPickerGroupProps {
  label?: string;
  className?: string;
  role?: string;
  scroll?: boolean;
  children?: ReactNode;
}
export interface ColorPickerHeaderProps {
  text: string;
  title?: boolean;
}
export interface SwatchDotProps {
  /** Inline style painting the dot; undefined draws an empty (dashed) swatch. */
  paint?: CSSProperties;
  current?: boolean;
}
export interface SwatchButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  paint?: CSSProperties;
  current?: boolean;
  readOnly?: boolean;
}
export interface ColorHexInputProps {
  /** Selected source tab: the theme palette or a custom color. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}
/** The contrast fix the picker keeps showing while a gesture holds it. */
interface ColorPickerHeldFix {
  shade: ContrastColorFixResult | undefined;
}
export interface ColorPickerProps {
  value: string;
  /** The value may be cleared: committing an unchanged color still reports it. */
  unset?: boolean;
  /** Hide the alpha slider and keep the color opaque. */
  opaque?: boolean;
  onChange: (color: string) => void;
  onPickEnd?: (color: string) => void;
  contrast?: ContrastRequirement;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiColorPicker: ReactNamespace;
    jsxForUiColorPicker: JsxNamespace;
    joinPickerClasses: (...input: (string | false | null | undefined)[]) => string;
    normalizedRgbToHsva: (
      input: number,
      options: number,
      context: number,
      value: number,
    ) => HsvaColor;
    parseCssColorToHsva: (input: string | undefined) => HsvaColor;
    hsvaToCssColor: (input: HsvaColor) => string;
    hsvaToHexColor: (input: HsvaColor) => string;
    rgbaHexColor: (color: HsvaColor) => string;
    isEyeDropperAvailable: () => boolean;
    pickScreenColor: () => Promise<string | null>;
    beginColorPickerPointerGesture: (
      event: ReactPointerEvent<HTMLElement>,
      onMove: ColorPickerPointerMove,
      onEnd?: () => void,
    ) => () => void;
    colorTrackFraction: (
      clientX: number,
      rectangle: Pick<DOMRect, "left" | "width">,
    ) => number;
    ColorPickerLabel: (props: ColorPickerLabelProps) => ReactElement;
    ColorPickerGroup: (props: ColorPickerGroupProps) => ReactElement;
    ColorPickerHeader: (props: ColorPickerHeaderProps) => ReactElement;
    SwatchDot: (props: SwatchDotProps) => ReactElement;
    SwatchButton: (props: SwatchButtonProps) => ReactElement;
    ColorHexInput: (props: ColorHexInputProps) => ReactElement;
    ColorPicker: (props: ColorPickerProps) => ReactElement;
    COLOR_ALPHA_CHECKERBOARD: string;
    COLOR_SWATCH_BUTTON_CLASS: string;
    COLOR_PICKER_POPOVER_HEIGHT: number;
    COLOR_PICKER_POPOVER_CLASS: string;
    initializeUiColorPicker: () => void;
  }
}

export function installUiColorPicker(runtime: RuntimeBindings): () => void {
  var reactForUiColorPicker: ReactNamespace;
  var jsxForUiColorPicker: JsxNamespace;
  var COLOR_ALPHA_CHECKERBOARD: string;
  var COLOR_SWATCH_BUTTON_CLASS: string;
  var COLOR_PICKER_POPOVER_HEIGHT: number;
  var COLOR_PICKER_POPOVER_CLASS: string;
  var initializeUiColorPicker: () => void;
  function joinPickerClasses(...input: (string | false | null | undefined)[]): string {
    return input.filter(Boolean).join(" ");
  }
  function normalizedRgbToHsva(
    input: number,
    options: number,
    context: number,
    value: number,
  ): HsvaColor {
    let value2 = Math.max(input, options, context),
      value3 = Math.min(input, options, context),
      value4 = value2 - value3,
      index = 0;
    if (value4 !== 0) {
      if (value2 === input) {
        index = ((options - context) / value4) % 6;
      } else if (value2 === options) {
        index = (context - input) / value4 + 2;
      } else {
        index = (input - options) / value4 + 4;
      }
      index *= 60;
      if (index < 0) {
        index += 360;
      }
    }
    let value5 = value2 === 0 ? 0 : value4 / value2;
    return {
      h: index,
      s: value5,
      v: value2,
      a: value,
    };
  }
  function parseCssColorToHsva(input: string | undefined): HsvaColor {
    let value = input!.match(/^#([0-9a-f]{3,8})$/i)?.[1];
    if (value && value.length !== 5 && value.length !== 7) {
      let value5 =
          value.length <= 4
            ? value.replace(
                /[0-9a-f]/gi,
                (input2: string): string => input2 + input2,
              )
            : value.padEnd(8, "f"),
        callback = (input2: number): number =>
          parseInt(value5.slice(input2 * 2, input2 * 2 + 2), 16) / 255;
      return normalizedRgbToHsva(
        callback(0),
        callback(1),
        callback(2),
        value.length === 4 || value.length === 8 ? callback(3) : 1,
      );
    }
    let value2 = input!.match(
      /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/,
    );
    if (value2) {
      let callback = (input2: number): number =>
        Math.min(1, Math.max(0, input2));
      return normalizedRgbToHsva(
        callback(+(value2[1] ?? 0) / 255),
        callback(+(value2[2] ?? 0) / 255),
        callback(+(value2[3] ?? 0) / 255),
        value2[4] != null ? callback(+value2[4]) : 1,
      );
    }
    if (
      typeof document === "undefined" ||
      typeof getComputedStyle === "undefined"
    ) {
      return {
        h: 0,
        s: 0,
        v: 0,
        a: 1,
      };
    }
    let value3 = document.createElement("div");
    value3.style.color = input!;
    document.body.appendChild(value3);
    let color = getComputedStyle(value3).color;
    document.body.removeChild(value3);
    let value4 = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
    );
    if (!value4) {
      return {
        h: 0,
        s: 0,
        v: 0,
        a: 1,
      };
    }
    return normalizedRgbToHsva(
      +(value4[1] ?? 0) / 255,
      +(value4[2] ?? 0) / 255,
      +(value4[3] ?? 0) / 255,
      value4[4] != null ? +value4[4] : 1,
    );
  }
  function hsvaToCssColor(input: HsvaColor): string {
    let { h: value, s: value2, v: value3, a: value4 } = input,
      value5 = value3 * value2,
      value6 = value5 * (1 - Math.abs(((value / 60) % 2) - 1)),
      value7 = value3 - value5,
      index = 0,
      index2 = 0,
      index3 = 0;
    if (value < 60) {
      index = value5;
      index2 = value6;
    } else if (value < 120) {
      index = value6;
      index2 = value5;
    } else if (value < 180) {
      index2 = value5;
      index3 = value6;
    } else if (value < 240) {
      index2 = value6;
      index3 = value5;
    } else if (value < 300) {
      index = value6;
      index3 = value5;
    } else {
      index = value5;
      index3 = value6;
    }
    let value8 = Math.round((index + value7) * 255),
      value9 = Math.round((index2 + value7) * 255),
      value10 = Math.round((index3 + value7) * 255);
    if (value4 < 1) {
      return `rgba(${value8}, ${value9}, ${value10}, ${+value4.toFixed(3)})`;
    } else {
      return `rgb(${value8}, ${value9}, ${value10})`;
    }
  }
  function hsvaToHexColor(input: HsvaColor): string {
    let value = hsvaToCssColor({
      ...input,
      a: 1,
    }).match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!value) {
      return "#000000";
    }
    return (
      "#" +
      [+(value[1] ?? 0), +(value[2] ?? 0), +(value[3] ?? 0)]
        .map(
          (input2) => input2.toString(16).padStart(2, "0"),
        )
        .join("")
        .toUpperCase()
    );
  }
  function rgbaHexColor(color: HsvaColor): string {
    let value = hsvaToHexColor(color);
    if (color.a >= 1) {
      return value;
    }
    return (
      value +
      Math.round(color.a * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    );
  }
  function isEyeDropperAvailable(): boolean {
    return typeof EyeDropper !== "undefined";
  }
  async function pickScreenColor(): Promise<string | null> {
    if (typeof EyeDropper === "undefined") {
      return null;
    }
    try {
      return (await new EyeDropper().open()).sRGBHex;
    } catch {
      return null;
    }
  }
  function beginColorPickerPointerGesture(
    event: ReactPointerEvent<HTMLElement>,
    onMove: ColorPickerPointerMove,
    onEnd?: () => void,
  ): () => void {
    event.preventDefault();
    let currentTarget = event.currentTarget,
      bounds = currentTarget.getBoundingClientRect(),
      pointerId = event.pointerId;
    try {
      currentTarget.setPointerCapture(pointerId);
    } catch {}
    onMove(event.clientX, event.clientY, bounds);
    let callback = (input: PointerEvent): void => {
        if (input.pointerId !== pointerId) {
          return;
        }
        onMove(input.clientX, input.clientY, bounds);
      },
      callback2 = (): void => {
        window.removeEventListener("pointermove", callback);
        window.removeEventListener("pointerup", callback3);
        window.removeEventListener("pointercancel", callback3);
      },
      callback3 = (input: PointerEvent): void => {
        if (input.pointerId !== pointerId) {
          return;
        }
        callback2();
        onEnd?.();
      };
    window.addEventListener("pointermove", callback);
    window.addEventListener("pointerup", callback3);
    window.addEventListener("pointercancel", callback3);
    return callback2;
  }
  function colorTrackFraction(
    clientX: number,
    rectangle: Pick<DOMRect, "left" | "width">,
  ): number {
    return Math.max(
      0,
      Math.min(1, (clientX - rectangle.left - 7) / (rectangle.width - 14)),
    );
  }
  function ColorPickerLabel({
    text: text,
    title = false,
  }: ColorPickerLabelProps): ReactElement {
    return jsxForUiColorPicker.jsx("div", {
      className: joinPickerClasses(
        "w-full truncate text-footnote",
        title ? "font-medium text-primary" : "text-muted",
      ),
      title: text,
      children: text,
    });
  }
  function ColorPickerGroup({
    label: label,
    className: className,
    role = "group",
    scroll = true,
    children: children,
  }: ColorPickerGroupProps): ReactElement {
    return jsxForUiColorPicker.jsx("div", {
      role: role,
      "aria-label": label,
      className: joinPickerClasses(
        "flex flex-col",
        scroll &&
          "kit-scrollbar max-h-[min(18rem,max(6rem,calc(var(--available-height,100vh)_-_7.5rem)))] overflow-y-auto",
        className,
      ),
      children: children,
    });
  }
  function ColorPickerHeader({
    text: text,
    title: title,
  }: ColorPickerHeaderProps): ReactElement {
    return jsxForUiColorPicker.jsx("div", {
      role: "presentation",
      className: "flex h-8 shrink-0 items-center px-2",
      children: jsxForUiColorPicker.jsx(ColorPickerLabel, {
        text: text,
        title: title,
      }),
    });
  }
  function SwatchDot({
    paint: paint,
    current = false,
  }: SwatchDotProps): ReactElement {
    return jsxForUiColorPicker.jsx("span", {
      "aria-hidden": "true",
      "data-swatch-dot": "",
      className: joinPickerClasses(
        "inline-block h-4 w-4 shrink-0 rounded-[4px] border border-border-strong",
        paint === undefined && "border-dashed",
        current && "outline outline-2 outline-offset-1 outline-border-strong",
      ),
      style: paint,
    });
  }
  function SwatchButton({
    label: label,
    paint: paint,
    current = false,
    onClick: onClick,
    readOnly = false,
    disabled = false,
    title: title,
    ...remainingProps
  }: SwatchButtonProps): ReactElement {
    let value = jsxForUiColorPicker.jsxs(
      jsxForUiColorPicker.Fragment,
      {
        children: [
          jsxForUiColorPicker.jsx(SwatchDot, {
            paint: paint,
            current: current,
          }),
          jsxForUiColorPicker.jsx("span", {
            className: "min-w-0 flex-1 truncate text-footnote text-primary",
            children: label,
          }),
          current
            ? jsxForUiColorPicker.jsx("span", {
                "data-swatch-check": "",
                "aria-hidden": "true",
                className:
                  "-mr-1 flex size-icon shrink-0 items-center justify-center",
                style: {
                  color: "var(--cds-fill-accent)",
                },
                children: jsxForUiColorPicker.jsx(runtime.Icon, {
                  name: "Check",
                  size: "auto",
                  bold: true,
                }),
              })
            : null,
        ],
      },
    );
    if (readOnly) {
      return jsxForUiColorPicker.jsx("div", {
        role: "listitem",
        title: title ?? label,
        "aria-label": label,
        className: joinPickerClasses(
          COLOR_SWATCH_BUTTON_CLASS,
          "cursor-default",
        ),
        ...remainingProps,
        children: value,
      });
    }
    return jsxForUiColorPicker.jsx("button", {
      type: "button",
      title: disabled ? undefined : (title ?? label),
      "aria-label": label,
      "aria-pressed": current,
      disabled: disabled,
      onClick: onClick,
      className: joinPickerClasses(
        COLOR_SWATCH_BUTTON_CLASS,
        disabled
          ? "pointer-events-none opacity-50"
          : "cursor-default hover:bg-fill-ghost-hover focus-visible:outline-hidden focus-visible:shadow-focus forced-colors:focus-visible:-outline-offset-2",
        current && "bg-fill-ghost-hover",
      ),
      ...remainingProps,
      children: value,
    });
  }
  function ColorHexInput({
    value: value,
    onChange: onChange,
    className = "mb-2",
  }: ColorHexInputProps): ReactElement {
    let ref = reactForUiColorPicker.useRef<HTMLDivElement | null>(null),
      callback = (input: string): void => {
        let activeElement = document.activeElement,
          value2 =
            ref.current?.closest('[data-mc-popover], [role="dialog"]') ??
            ref.current?.parentElement;
        if (
          activeElement instanceof HTMLElement &&
          value2 &&
          value2.contains(activeElement) &&
          !ref.current!.contains(activeElement)
        ) {
          activeElement.blur();
        }
        onChange(input);
      };
    return jsxForUiColorPicker.jsx(runtime.Tabs.Root, {
      ref: ref,
      value: value,
      onValueChange: (input: string): void => callback(input),
      children: jsxForUiColorPicker.jsxs(runtime.Tabs.List, {
        "aria-label": "Source",
        className: className,
        onMouseDown: (event: ReactMouseEvent): void => event.preventDefault(),
        children: [
          jsxForUiColorPicker.jsx(runtime.Tabs.Tab, {
            value: "system",
            children: "Theme",
          }),
          jsxForUiColorPicker.jsx(runtime.Tabs.Tab, {
            value: "custom",
            children: "Custom",
          }),
        ],
      }),
    });
  }
  function ColorPicker({
    value: value,
    unset: unset,
    opaque: opaque,
    onChange: onChange,
    onPickEnd: onPickEnd,
    contrast: contrast,
  }: ColorPickerProps): ReactElement {
    let callback = (input: HsvaColor): HsvaColor =>
        opaque
          ? {
              ...input,
              a: 1,
            }
          : input,
      [value2, value3] = reactForUiColorPicker.useState<HsvaColor>(
        (): HsvaColor => callback(parseCssColorToHsva(value)),
      ),
      ref = reactForUiColorPicker.useRef(value2);
    ref.current = value2;
    let ref2 = reactForUiColorPicker.useRef(false),
      [value4, value5] = reactForUiColorPicker.useState<string>(
        (): string => hsvaToHexColor(value2),
      ),
      [value6, value7] = reactForUiColorPicker.useState<string>(
        (): string => Math.round(value2.a * 100).toString(),
      ),
      ref3 = reactForUiColorPicker.useRef<HTMLInputElement | null>(null),
      ref4 = reactForUiColorPicker.useRef<HTMLInputElement | null>(null),
      ref5 = reactForUiColorPicker.useRef(unset ?? false);
    ref5.current = unset ?? false;
    let ref6 = reactForUiColorPicker.useRef(opaque ?? false);
    ref6.current = opaque ?? false;
    let ref7 = reactForUiColorPicker.useRef(onPickEnd);
    ref7.current = onPickEnd;
    let ref8 = reactForUiColorPicker.useRef(contrast);
    ref8.current = contrast;
    let callback2 = reactForUiColorPicker.useCallback(
        (input: string, options?: boolean): void => {
          ref7.current?.(input);
          let current = ref8.current;
          if (!options || current === undefined) {
            return;
          }
          (0, runtime.announceLiveMessage)((): string | null => {
            let value18 = (0, runtime.colorContrastResults)(input, current);
            if (value18 === undefined) {
              return null;
            } else {
              return (0, runtime.contrastDisplayInfo)(value18).spoken;
            }
          });
        },
        [],
      ),
      ref9 = reactForUiColorPicker.useRef(false),
      ref10 = reactForUiColorPicker.useRef(value),
      callback3 = reactForUiColorPicker.useCallback(
        (input: string): void => {
          ref10.current = input;
          let value18 = callback(parseCssColorToHsva(input));
          if (rgbaHexColor(value18) === rgbaHexColor(ref.current)) {
            return;
          }
          value3(value18);
          ref.current = value18;
          value5(hsvaToHexColor(value18));
          value7(Math.round(value18.a * 100).toString());
        },
        [],
      );
    reactForUiColorPicker.useEffect((): void => {
      if (value === ref10.current) {
        return;
      }
      let activeElement = document.activeElement;
      if (activeElement === ref3.current || activeElement === ref4.current) {
        return;
      }
      callback3(value);
    }, [value, callback3]);
    let callback4 = (
        input: ReactFocusEvent<HTMLInputElement>,
        options: boolean,
      ): void => {
        if (options) {
          return;
        }
        let relatedTarget = input.relatedTarget;
        if (
          relatedTarget !== null &&
          (relatedTarget === ref3.current || relatedTarget === ref4.current)
        ) {
          return;
        }
        if (value !== ref10.current) {
          callback3(value);
        }
      },
      callback5 = reactForUiColorPicker.useCallback(
        (input: HsvaColor): boolean => {
          let value18 = ref6.current
              ? {
                  ...input,
                  a: 1,
                }
              : input,
            value19 = rgbaHexColor(value18),
            value20 = value19 !== rgbaHexColor(ref.current);
          value3(value18);
          ref.current = value18;
          value5(hsvaToHexColor(value18));
          value7(Math.round(value18.a * 100).toString());
          if (!value20 && !ref5.current) {
            return false;
          }
          ref10.current = value19;
          onChange(value19);
          return true;
        },
        [onChange],
      ),
      callback6 = reactForUiColorPicker.useCallback(
        (input: HsvaColor): boolean => {
          let value18 = ref6.current
            ? {
                ...input,
                a: 1,
              }
            : input;
          if (
            !ref5.current &&
            rgbaHexColor(value18) === rgbaHexColor(ref.current)
          ) {
            value5(hsvaToHexColor(ref.current));
            value7(Math.round(ref.current.a * 100).toString());
            return false;
          }
          callback5(value18);
          callback2(rgbaHexColor(value18), true);
          return true;
        },
        [callback5, callback2],
      ),
      callback7 = reactForUiColorPicker.useCallback(
        (): ((options: boolean) => void) => {
          return (input: boolean): void => {
            callback2(rgbaHexColor(ref.current), input);
          };
        },
        [callback2],
      ),
      ref11 = reactForUiColorPicker.useRef(new Set<() => void>()),
      [value8, value9] = reactForUiColorPicker.useState<
        ColorPickerHeldFix | undefined
      >(undefined),
      value10 = value8 !== undefined,
      ref12 = reactForUiColorPicker.useRef<HTMLElement | null>(null),
      ref13 = reactForUiColorPicker.useRef(false),
      callback8 = (input: boolean): void => {
        if (!input) {
          ref3.current?.focus();
        }
      };
    reactForUiColorPicker.useEffect(
      (): (() => void) => (): void => {
        for (let value18 of ref11.current) value18();
        ref11.current.clear();
      },
      [],
    );
    let callback9 = (
        input: ReactPointerEvent<HTMLElement>,
        options: ColorPickerPointerChange,
      ): void => {
        if (input.button !== 0) {
          return;
        }
        if (ref12.current?.contains(document.activeElement)) {
          callback8(input.pointerType === "touch");
        }
        value9(
          (input2: ColorPickerHeldFix | undefined): ColorPickerHeldFix =>
            input2 ?? {
              shade: memo3,
            },
        );
        let value18 = callback7(),
          flag = false,
          callback18: () => void = (): void => {},
          callback19 = (input2: boolean): void => {
            ref11.current.delete(callback20);
            if (ref11.current.size === 0) {
              value9(undefined);
            }
            callback18();
            if (flag) {
              flag = false;
              value18(input2);
            }
          },
          callback20 = (): void => callback19(false);
        callback18 = beginColorPickerPointerGesture(
          input,
          (input2: number, options2: number, context: DOMRect): void => {
            if (options(input2, options2, context)) {
              flag = true;
            }
          },
          (): void => callback19(true),
        );
        ref11.current.add(callback20);
      },
      callback10 = (input: ReactPointerEvent<HTMLElement>): void =>
        callback9(
          input,
          (input2: number, options: number, context: DOMRect): boolean =>
            callback5({
              ...ref.current,
              s: colorTrackFraction(input2, context),
              v:
                1 -
                Math.max(
                  0,
                  Math.min(
                    1,
                    (options - context.top - 7) / (context.height - 14),
                  ),
                ),
            }),
        ),
      callback11 = (input: ReactPointerEvent<HTMLElement>): void =>
        callback9(
          input,
          (input2: number, options: number, context: DOMRect): boolean =>
            callback5({
              ...ref.current,
              h: colorTrackFraction(input2, context) * 360,
            }),
        ),
      callback12 = (input: ReactPointerEvent<HTMLElement>): void =>
        callback9(
          input,
          (input2: number, options: number, context: DOMRect): boolean =>
            callback5({
              ...ref.current,
              a: colorTrackFraction(input2, context),
            }),
        ),
      callback13 = async (): Promise<void> => {
        let value18 = await pickScreenColor();
        if (!value18) {
          return;
        }
        callback6({
          ...parseCssColorToHsva(value18),
          a: ref.current.a,
        });
      },
      callback14 = (): boolean => {
        if (ref2.current) {
          ref2.current = false;
          return false;
        }
        if (ref5.current && !ref9.current) {
          return false;
        }
        let value18 = value4.trim();
        if (
          /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
            value18,
          )
        ) {
          let value19 = parseCssColorToHsva(
              value18.startsWith("#") ? value18 : "#" + value18,
            ),
            length = value18.replace(/^#/, "").length;
          return callback6(
            length === 4 || length === 8
              ? value19
              : {
                  ...value19,
                  a: value2.a,
                },
          );
        }
        value5(hsvaToHexColor(value2));
        return false;
      },
      callback15 = (): boolean => {
        if (ref2.current) {
          ref2.current = false;
          return false;
        }
        let value18 = parseFloat(value6);
        if (isNaN(value18)) {
          value7(Math.round(value2.a * 100).toString());
          return false;
        }
        if (Math.round(value18) === Math.round(value2.a * 100)) {
          value7(Math.round(value2.a * 100).toString());
          return false;
        }
        return callback6({
          ...value2,
          a: Math.max(0, Math.min(1, value18 / 100)),
        });
      },
      value11 = hsvaToCssColor({
        ...value2,
        a: 1,
      }),
      value12 = rgbaHexColor(value2),
      value13 = contrast === undefined ? undefined : JSON.stringify(contrast),
      memo = reactForUiColorPicker.useMemo(
        (): ContrastRequirement | undefined => contrast,
        [value13],
      ),
      memo2 = reactForUiColorPicker.useMemo(
        () =>
          memo === undefined
            ? undefined
            : (0, runtime.colorContrastResults)(value12, memo),
        [memo, value12],
      ),
      memo3 = reactForUiColorPicker.useMemo(
        () =>
          memo === undefined || value10
            ? undefined
            : (0, runtime.contrastColorFix)(value12, memo),
        [memo, value12, value10],
      ),
      value14 = value8 !== undefined ? value8.shade : memo3,
      value15 = memo2 !== undefined && value14 !== undefined;
    reactForUiColorPicker.useLayoutEffect((): void => {
      if (!ref13.current) {
        return;
      }
      ref13.current = false;
      if (!value15) {
        ref3.current?.focus();
      }
    }, [value15]);
    let callback16 = (input: boolean): void => {
        if (memo3 === undefined) {
          return;
        }
        callback6(parseCssColorToHsva(memo3.css));
        callback8(input);
      },
      callback17 = (): void => {
        ref13.current = true;
      },
      value16 = reactForUiColorPicker.useId(),
      value17 = memo2 === undefined ? undefined : value16;
    return jsxForUiColorPicker.jsxs("div", {
      className: "flex w-full min-w-56 flex-col",
      children: [
        jsxForUiColorPicker.jsx("div", {
          className: "relative aspect-[3/2] w-full touch-none rounded-md",
          style: {
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${value2.h}, 100%, 50%))`,
          },
          onPointerDown: callback10,
          children: jsxForUiColorPicker.jsx("div", {
            className:
              "pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]",
            style: {
              left: `calc(${value2.s} * (100% - 14px) + 7px)`,
              top: `calc(${1 - value2.v} * (100% - 14px) + 7px)`,
              background: value11,
            },
          }),
        }),
        jsxForUiColorPicker.jsx("div", {
          className: "relative touch-none pt-2 pb-1 pointer-coarse:py-3.5",
          onPointerDown: callback11,
          children: jsxForUiColorPicker.jsx("div", {
            className:
              "relative h-3 w-full rounded-md bg-[linear-gradient(to_right,#f00_0%,#ff0_17%,#0f0_33%,#0ff_50%,#00f_67%,#f0f_83%,#f00_100%)]",
            children: jsxForUiColorPicker.jsx("div", {
              className:
                "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]",
              style: {
                left: `calc(${value2.h / 360} * (100% - 14px) + 7px)`,
                background: `hsl(${value2.h}, 100%, 50%)`,
              },
            }),
          }),
        }),
        !opaque &&
          jsxForUiColorPicker.jsx("div", {
            className: "relative touch-none py-1 pointer-coarse:py-3.5",
            onPointerDown: callback12,
            children: jsxForUiColorPicker.jsx("div", {
              className: "relative h-3 w-full rounded-md",
              style: {
                background: `linear-gradient(to right, transparent, ${value11}), ${COLOR_ALPHA_CHECKERBOARD}`,
              },
              children: jsxForUiColorPicker.jsx("div", {
                className:
                  "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]",
                style: {
                  left: `calc(${value2.a} * (100% - 14px) + 7px)`,
                  background: hsvaToCssColor(value2),
                },
              }),
            }),
          }),
        jsxForUiColorPicker.jsxs("div", {
          className: "mt-1 flex items-center gap-2",
          children: [
            isEyeDropperAvailable() &&
              jsxForUiColorPicker.jsx("button", {
                type: "button",
                title: "Pick color from screen",
                "aria-label": "Pick color from screen",
                onClick: callback13,
                className:
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted outline-none hover:bg-alpha-1 hover:text-primary focus-visible:outline-hidden focus-visible:shadow-focus pointer-coarse:h-10 pointer-coarse:w-10",
                children: jsxForUiColorPicker.jsx(runtime.Icon, {
                  name: "EyeDropper",
                  size: "sm",
                }),
              }),
            jsxForUiColorPicker.jsxs("div", {
              className:
                "flex h-6 min-w-0 flex-1 items-center rounded bg-fill-field shadow-field-ring transition duration-fast hover:not-focus-within:shadow-field-hover has-[:focus-visible]:shadow-focus pointer-coarse:h-10",
              children: [
                jsxForUiColorPicker.jsx("input", {
                  ref: ref3,
                  className:
                    "h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[11px] text-primary outline-none focus-visible:outline-hidden",
                  value: value4,
                  "aria-label": "Hex color",
                  "aria-describedby": value17,
                  onChange: (event: ReactChangeEvent<HTMLInputElement>): void => {
                    ref9.current = true;
                    value5(event.target.value);
                  },
                  onFocus: (): void => {
                    ref9.current = false;
                  },
                  onBlur: (input: ReactFocusEvent<HTMLInputElement>): void =>
                    callback4(input, callback14()),
                  onKeyDown: (event: ColorInputKeyEvent): void => {
                    if (event.key === "Enter") {
                      event.target.blur();
                    } else if (event.key === "Escape") {
                      ref2.current = true;
                      value5(hsvaToHexColor(value2));
                      event.target.blur();
                    }
                    event.stopPropagation();
                  },
                }),
                !opaque &&
                  jsxForUiColorPicker.jsxs(jsxForUiColorPicker.Fragment, {
                    children: [
                      jsxForUiColorPicker.jsx("div", {
                        className: "my-1 w-px shrink-0 self-stretch bg-alpha-2",
                      }),
                      jsxForUiColorPicker.jsx("input", {
                        ref: ref4,
                        className:
                          "h-full w-[34px] bg-transparent pl-1.5 pr-1 text-right font-mono text-[11px] text-primary outline-none focus-visible:outline-hidden",
                        value: value6,
                        "aria-label": "Alpha percent",
                        "aria-describedby": value17,
                        onChange: (
                          event: ReactChangeEvent<HTMLInputElement>,
                        ): void => value7(event.target.value),
                        onBlur: (input: ReactFocusEvent<HTMLInputElement>): void =>
                          callback4(input, callback15()),
                        onKeyDown: (event: ColorInputKeyEvent): void => {
                          if (event.key === "Enter") {
                            event.target.blur();
                          } else if (event.key === "Escape") {
                            ref2.current = true;
                            value7(Math.round(value2.a * 100).toString());
                            event.target.blur();
                          }
                          event.stopPropagation();
                        },
                      }),
                      jsxForUiColorPicker.jsx("span", {
                        className: "pr-1.5 text-[10px] text-muted",
                        children: "%",
                      }),
                    ],
                  }),
              ],
            }),
          ],
        }),
        memo2 !== undefined
          ? jsxForUiColorPicker.jsx(runtime.ContrastColorDetails, {
              fg: value12,
              results: memo2,
              sentenceId: value16,
              ...(value15
                ? {
                    fix: {
                      css: value14!.css,
                      ratio: value14!.ratio,
                      ground: value14!.ground.label,
                      onUse: callback16,
                    },
                    fixHeld: value10,
                    fixRef: ref12,
                    onFixGoneFocused: callback17,
                  }
                : {}),
            })
          : null,
      ],
    });
  }
  bindRuntimeValue(runtime, "joinPickerClasses", () => joinPickerClasses);
  bindRuntimeValue(runtime, "normalizedRgbToHsva", () => normalizedRgbToHsva);
  bindRuntimeValue(runtime, "parseCssColorToHsva", () => parseCssColorToHsva);
  bindRuntimeValue(runtime, "hsvaToCssColor", () => hsvaToCssColor);
  bindRuntimeValue(runtime, "hsvaToHexColor", () => hsvaToHexColor);
  bindRuntimeValue(runtime, "rgbaHexColor", () => rgbaHexColor);
  bindRuntimeValue(
    runtime,
    "isEyeDropperAvailable",
    () => isEyeDropperAvailable,
  );
  bindRuntimeValue(runtime, "pickScreenColor", () => pickScreenColor);
  bindRuntimeValue(
    runtime,
    "beginColorPickerPointerGesture",
    () => beginColorPickerPointerGesture,
  );
  bindRuntimeValue(runtime, "colorTrackFraction", () => colorTrackFraction);
  bindRuntimeValue(runtime, "ColorPickerLabel", () => ColorPickerLabel);
  bindRuntimeValue(runtime, "ColorPickerGroup", () => ColorPickerGroup);
  bindRuntimeValue(runtime, "ColorPickerHeader", () => ColorPickerHeader);
  bindRuntimeValue(runtime, "SwatchDot", () => SwatchDot);
  bindRuntimeValue(runtime, "SwatchButton", () => SwatchButton);
  bindRuntimeValue(runtime, "ColorHexInput", () => ColorHexInput);
  bindRuntimeValue(runtime, "ColorPicker", () => ColorPicker);
  bindRuntimeValue(
    runtime,
    "reactForUiColorPicker",
    () => reactForUiColorPicker,
    (value) => {
      reactForUiColorPicker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiColorPicker",
    () => jsxForUiColorPicker,
    (value) => {
      jsxForUiColorPicker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_ALPHA_CHECKERBOARD",
    () => COLOR_ALPHA_CHECKERBOARD,
    (value) => {
      COLOR_ALPHA_CHECKERBOARD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_SWATCH_BUTTON_CLASS",
    () => COLOR_SWATCH_BUTTON_CLASS,
    (value) => {
      COLOR_SWATCH_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_PICKER_POPOVER_HEIGHT",
    () => COLOR_PICKER_POPOVER_HEIGHT,
    (value) => {
      COLOR_PICKER_POPOVER_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_PICKER_POPOVER_CLASS",
    () => COLOR_PICKER_POPOVER_CLASS,
    (value) => {
      COLOR_PICKER_POPOVER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiColorPicker",
    () => initializeUiColorPicker,
    (value) => {
      initializeUiColorPicker = value;
    },
  );
  return () => {
    COLOR_ALPHA_CHECKERBOARD =
      "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 8px 8px";
    COLOR_SWATCH_BUTTON_CLASS =
      "flex h-8 w-full min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-left outline-none pointer-coarse:h-10";
    COLOR_PICKER_POPOVER_HEIGHT = 440;
    COLOR_PICKER_POPOVER_CLASS = "w-64 p-4";
    initializeUiColorPicker = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiAnnouncements)();
      (0, runtime.initializeUiContrast)();
      (0, runtime.initializeUiContrastControls)();
      reactForUiColorPicker = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiColorPicker = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}
