import type * as React from "react";
import type * as Color from "../../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installUiColorPicker(runtime: RuntimeBindings): () => void {
  var jsxForUiColorPicker: typeof import("react/jsx-runtime");
  var COLOR_ALPHA_CHECKERBOARD: string;
  var COLOR_SWATCH_BUTTON_CLASS: string;
  var COLOR_PICKER_POPOVER_HEIGHT: number;
  var COLOR_PICKER_POPOVER_CLASS: string;
  function joinPickerClasses(...input: (string | false | null | undefined)[]) {
    return input.filter(Boolean).join(" ");
  }
  function normalizedRgbToHsva(
    input: number,
    options: number,
    context: number,
    value: number,
  ): Color.HsvaColor {
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
  function parseCssColorToHsva(input: string): Color.HsvaColor {
    let value = input.match(/^#([0-9a-f]{3,8})$/i)?.[1];
    if (value && value.length !== 5 && value.length !== 7) {
      let value5 =
          value.length <= 4
            ? value.replace(/[0-9a-f]/gi, (input2: string) => input2 + input2)
            : value.padEnd(8, "f"),
        callback = (input2: number) =>
          parseInt(value5.slice(input2 * 2, input2 * 2 + 2), 16) / 255;
      return normalizedRgbToHsva(
        callback(0),
        callback(1),
        callback(2),
        value.length === 4 || value.length === 8 ? callback(3) : 1,
      );
    }
    let value2 = input.match(
      /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/,
    );
    if (value2) {
      let callback = (input2: number) => Math.min(1, Math.max(0, input2));
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
    value3.style.color = input;
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
  function hsvaToCssColor(input: Color.HsvaColor): string {
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
  function hsvaToHexColor(input: Color.HsvaColor): string {
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
        .map((input2: number) => input2.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }
  function rgbaHexColor(color: Color.HsvaColor): string {
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
    event: React.PointerEvent<HTMLElement>,
    onMove: Color.PointerMove,
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
    let callback = (input: PointerEvent) => {
        if (input.pointerId !== pointerId) {
          return;
        }
        onMove(input.clientX, input.clientY, bounds);
      },
      callback2 = () => {
        window.removeEventListener("pointermove", callback);
        window.removeEventListener("pointerup", callback3);
        window.removeEventListener("pointercancel", callback3);
      },
      callback3 = (input: PointerEvent) => {
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
  }: Color.ColorPickerLabelProps): React.ReactElement {
    return (
      <div
        className={joinPickerClasses(
          "w-full truncate text-footnote",
          title ? "font-medium text-primary" : "text-muted",
        )}
        title={text}
      >
        {text}
      </div>
    );
  }
  function ColorPickerGroup({
    label: label,
    className: className,
    role = "group",
    scroll = true,
    children: children,
  }: Color.ColorPickerGroupProps): React.ReactElement {
    return (
      <div
        role={role}
        aria-label={label}
        className={joinPickerClasses(
          "flex flex-col",
          scroll &&
            "kit-scrollbar max-h-[min(18rem,max(6rem,calc(var(--available-height,100vh)_-_7.5rem)))] overflow-y-auto",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  function ColorPickerHeader({
    text: text,
    title: title,
  }: Color.ColorPickerLabelProps): React.ReactElement {
    return (
      <div
        role={"presentation"}
        className={"flex h-8 shrink-0 items-center px-2"}
      >
        <ColorPickerLabel text={text} title={title} />
      </div>
    );
  }
  function SwatchDot({
    paint: paint,
    current = false,
  }: Color.SwatchDotProps): React.ReactElement {
    return (
      <span
        aria-hidden={"true"}
        data-swatch-dot={""}
        className={joinPickerClasses(
          "inline-block h-4 w-4 shrink-0 rounded-[4px] border border-border-strong",
          paint === undefined && "border-dashed",
          current && "outline outline-2 outline-offset-1 outline-border-strong",
        )}
        style={paint}
      />
    );
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
  }: Color.SwatchButtonProps): React.ReactElement {
    let value = (
      <jsxForUiColorPicker.Fragment>
        {[
          <SwatchDot paint={paint} current={current} />,
          <span
            className={"min-w-0 flex-1 truncate text-footnote text-primary"}
          >
            {label}
          </span>,
          current ? (
            <span
              data-swatch-check={""}
              aria-hidden={"true"}
              className={
                "-mr-1 flex size-icon shrink-0 items-center justify-center"
              }
              style={{
                color: "var(--cds-fill-accent)",
              }}
            >
              <runtime.Icon name={"Check"} size={"auto"} bold={true} />
            </span>
          ) : null,
        ]}
      </jsxForUiColorPicker.Fragment>
    );
    if (readOnly) {
      return (
        <div
          role={"listitem"}
          title={title ?? label}
          aria-label={label}
          className={joinPickerClasses(
            COLOR_SWATCH_BUTTON_CLASS,
            "cursor-default",
          )}
          {...remainingProps}
        >
          {value}
        </div>
      );
    }
    return (
      <button
        type={"button"}
        title={disabled ? undefined : (title ?? label)}
        aria-label={label}
        aria-pressed={current}
        disabled={disabled}
        onClick={onClick}
        className={joinPickerClasses(
          COLOR_SWATCH_BUTTON_CLASS,
          disabled
            ? "pointer-events-none opacity-50"
            : "cursor-default hover:bg-fill-ghost-hover focus-visible:outline-hidden focus-visible:shadow-focus forced-colors:focus-visible:-outline-offset-2",
          current && "bg-fill-ghost-hover",
        )}
        {...remainingProps}
      >
        {value}
      </button>
    );
  }
  function ColorHexInput({
    value: value,
    onChange: onChange,
    className = "mb-2",
  }: Color.ColorHexInputProps): React.ReactElement {
    let ref = (
        runtime.reactForUiColorPicker as typeof React
      ).useRef<HTMLDivElement | null>(null),
      callback = (input: string) => {
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
    return (
      <runtime.Tabs.Root
        ref={ref}
        value={value}
        onValueChange={(input: unknown) => callback(input as string)}
      >
        <runtime.Tabs.List
          aria-label={"Source"}
          className={className}
          onMouseDown={(event: React.MouseEvent<HTMLElement>) =>
            event.preventDefault()
          }
        >
          {[
            <runtime.Tabs.Tab value={"system"}>{"Theme"}</runtime.Tabs.Tab>,
            <runtime.Tabs.Tab value={"custom"}>{"Custom"}</runtime.Tabs.Tab>,
          ]}
        </runtime.Tabs.List>
      </runtime.Tabs.Root>
    );
  }
  function ColorPicker({
    value: value,
    unset: unset,
    opaque: opaque,
    onChange: onChange,
    onPickEnd: onPickEnd,
    contrast: contrast,
  }: Color.ColorPickerProps): React.ReactElement {
    let callback = (input: Color.HsvaColor) =>
        opaque
          ? {
              ...input,
              a: 1,
            }
          : input,
      [value2, value3] = (
        runtime.reactForUiColorPicker as typeof React
      ).useState(() => callback(parseCssColorToHsva(value))),
      ref = (runtime.reactForUiColorPicker as typeof React).useRef(value2);
    ref.current = value2;
    let ref2 = (runtime.reactForUiColorPicker as typeof React).useRef(false),
      [value4, value5] = (
        runtime.reactForUiColorPicker as typeof React
      ).useState(() => hsvaToHexColor(value2)),
      [value6, value7] = (
        runtime.reactForUiColorPicker as typeof React
      ).useState(() => Math.round(value2.a * 100).toString()),
      ref3 = (
        runtime.reactForUiColorPicker as typeof React
      ).useRef<HTMLInputElement | null>(null),
      ref4 = (
        runtime.reactForUiColorPicker as typeof React
      ).useRef<HTMLInputElement | null>(null),
      ref5 = (runtime.reactForUiColorPicker as typeof React).useRef(
        unset ?? false,
      );
    ref5.current = unset ?? false;
    let ref6 = (runtime.reactForUiColorPicker as typeof React).useRef(
      opaque ?? false,
    );
    ref6.current = opaque ?? false;
    let ref7 = (runtime.reactForUiColorPicker as typeof React).useRef(
      onPickEnd,
    );
    ref7.current = onPickEnd;
    let ref8 = (runtime.reactForUiColorPicker as typeof React).useRef(contrast);
    ref8.current = contrast;
    let callback2 = (runtime.reactForUiColorPicker as typeof React).useCallback(
        (input: string, options?: boolean) => {
          ref7.current?.(input);
          let current = ref8.current;
          if (!options || current === undefined) {
            return;
          }
          (0, runtime.announceLiveMessage)(() => {
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
      ref9 = (runtime.reactForUiColorPicker as typeof React).useRef(false),
      ref10 = (runtime.reactForUiColorPicker as typeof React).useRef(value),
      callback3 = (runtime.reactForUiColorPicker as typeof React).useCallback(
        (input: string) => {
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
    (runtime.reactForUiColorPicker as typeof React).useEffect(() => {
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
        input: React.FocusEvent<HTMLInputElement>,
        options: boolean,
      ) => {
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
      callback5 = (runtime.reactForUiColorPicker as typeof React).useCallback(
        (input: Color.HsvaColor) => {
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
      callback6 = (runtime.reactForUiColorPicker as typeof React).useCallback(
        (input: Color.HsvaColor) => {
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
      callback7 = (
        runtime.reactForUiColorPicker as typeof React
      ).useCallback(() => {
        return (input?: boolean) => {
          callback2(rgbaHexColor(ref.current), input);
        };
      }, [callback2]),
      ref11 = (runtime.reactForUiColorPicker as typeof React).useRef(
        new Set<() => void>(),
      ),
      [value8, value9] = (
        runtime.reactForUiColorPicker as typeof React
      ).useState<Color.ColorGestureState | undefined>(undefined),
      value10 = value8 !== undefined,
      ref12 = (
        runtime.reactForUiColorPicker as typeof React
      ).useRef<HTMLSpanElement | null>(null),
      ref13 = (runtime.reactForUiColorPicker as typeof React).useRef(false),
      callback8 = (input: boolean) => {
        if (!input) {
          ref3.current?.focus();
        }
      };
    (runtime.reactForUiColorPicker as typeof React).useEffect(
      () => () => {
        for (let value18 of ref11.current) {
          value18();
        }
        ref11.current.clear();
      },
      [],
    );
    let callback9 = (
        input: React.PointerEvent<HTMLElement>,
        options: Color.ColorGestureMove,
      ) => {
        if (input.button !== 0) {
          return;
        }
        if (ref12.current?.contains(document.activeElement)) {
          callback8(input.pointerType === "touch");
        }
        value9(
          (input2) =>
            input2 ?? {
              shade: memo3,
            },
        );
        let value18 = callback7(),
          flag = false,
          callback18 = () => {},
          callback19 = (input2: boolean) => {
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
          callback20 = () => callback19(false);
        callback18 = beginColorPickerPointerGesture(
          input,
          (input2: number, options2: number, context: DOMRect) => {
            if (options(input2, options2, context)) {
              flag = true;
            }
          },
          () => callback19(true),
        );
        ref11.current.add(callback20);
      },
      callback10 = (input: React.PointerEvent<HTMLElement>) =>
        callback9(input, (input2: number, options: number, context: DOMRect) =>
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
      callback11 = (input: React.PointerEvent<HTMLElement>) =>
        callback9(input, (input2: number, options: number, context: DOMRect) =>
          callback5({
            ...ref.current,
            h: colorTrackFraction(input2, context) * 360,
          }),
        ),
      callback12 = (input: React.PointerEvent<HTMLElement>) =>
        callback9(input, (input2: number, options: number, context: DOMRect) =>
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
      callback14 = () => {
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
      callback15 = () => {
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
      memo = (runtime.reactForUiColorPicker as typeof React).useMemo(
        () => contrast,
        [value13],
      ),
      memo2 = (runtime.reactForUiColorPicker as typeof React).useMemo(
        () =>
          memo === undefined
            ? undefined
            : (0, runtime.colorContrastResults)(value12, memo),
        [memo, value12],
      ),
      memo3 = (runtime.reactForUiColorPicker as typeof React).useMemo(
        () =>
          memo === undefined || value10
            ? undefined
            : (0, runtime.contrastColorFix)(value12, memo),
        [memo, value12, value10],
      ),
      value14 = value8 !== undefined ? value8.shade : memo3,
      value15 = memo2 !== undefined && value14 !== undefined;
    (runtime.reactForUiColorPicker as typeof React).useLayoutEffect(() => {
      if (!ref13.current) {
        return;
      }
      ref13.current = false;
      if (!value15) {
        ref3.current?.focus();
      }
    }, [value15]);
    let callback16 = (input: boolean) => {
        if (memo3 === undefined) {
          return;
        }
        callback6(parseCssColorToHsva(memo3.css));
        callback8(input);
      },
      callback17 = () => {
        ref13.current = true;
      },
      value16 = (runtime.reactForUiColorPicker as typeof React).useId(),
      value17 = memo2 === undefined ? undefined : value16;
    return (
      <div className={"flex w-full min-w-56 flex-col"}>
        {[
          <div
            className={"relative aspect-[3/2] w-full touch-none rounded-md"}
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${value2.h}, 100%, 50%))`,
            }}
            onPointerDown={callback10}
          >
            <div
              className={
                "pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
              }
              style={{
                left: `calc(${value2.s} * (100% - 14px) + 7px)`,
                top: `calc(${1 - value2.v} * (100% - 14px) + 7px)`,
                background: value11,
              }}
            />
          </div>,
          <div
            className={"relative touch-none pt-2 pb-1 pointer-coarse:py-3.5"}
            onPointerDown={callback11}
          >
            <div
              className={
                "relative h-3 w-full rounded-md bg-[linear-gradient(to_right,#f00_0%,#ff0_17%,#0f0_33%,#0ff_50%,#00f_67%,#f0f_83%,#f00_100%)]"
              }
            >
              <div
                className={
                  "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                }
                style={{
                  left: `calc(${value2.h / 360} * (100% - 14px) + 7px)`,
                  background: `hsl(${value2.h}, 100%, 50%)`,
                }}
              />
            </div>
          </div>,
          !opaque && (
            <div
              className={"relative touch-none py-1 pointer-coarse:py-3.5"}
              onPointerDown={callback12}
            >
              <div
                className={"relative h-3 w-full rounded-md"}
                style={{
                  background: `linear-gradient(to right, transparent, ${value11}), ${COLOR_ALPHA_CHECKERBOARD}`,
                }}
              >
                <div
                  className={
                    "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                  }
                  style={{
                    left: `calc(${value2.a} * (100% - 14px) + 7px)`,
                    background: hsvaToCssColor(value2),
                  }}
                />
              </div>
            </div>
          ),
          <div className={"mt-1 flex items-center gap-2"}>
            {[
              isEyeDropperAvailable() && (
                <button
                  type={"button"}
                  title={"Pick color from screen"}
                  aria-label={"Pick color from screen"}
                  onClick={callback13}
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted outline-none hover:bg-alpha-1 hover:text-primary focus-visible:outline-hidden focus-visible:shadow-focus pointer-coarse:h-10 pointer-coarse:w-10"
                  }
                >
                  <runtime.Icon name={"EyeDropper"} size={"sm"} />
                </button>
              ),
              <div
                className={
                  "flex h-6 min-w-0 flex-1 items-center rounded bg-fill-field shadow-field-ring transition duration-fast hover:not-focus-within:shadow-field-hover has-[:focus-visible]:shadow-focus pointer-coarse:h-10"
                }
              >
                {[
                  <input
                    ref={ref3}
                    className={
                      "h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[11px] text-primary outline-none focus-visible:outline-hidden"
                    }
                    value={value4}
                    aria-label={"Hex color"}
                    aria-describedby={value17}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      ref9.current = true;
                      value5(event.target.value);
                    }}
                    onFocus={() => {
                      ref9.current = false;
                    }}
                    onBlur={(input: React.FocusEvent<HTMLInputElement>) =>
                      callback4(input, callback14())
                    }
                    onKeyDown={(
                      event: React.KeyboardEvent<HTMLInputElement> & {
                        target: HTMLInputElement;
                      },
                    ) => {
                      if (event.key === "Enter") {
                        event.target.blur();
                      } else if (event.key === "Escape") {
                        ref2.current = true;
                        value5(hsvaToHexColor(value2));
                        event.target.blur();
                      }
                      event.stopPropagation();
                    }}
                  />,
                  !opaque && (
                    <jsxForUiColorPicker.Fragment>
                      {[
                        <div
                          className={
                            "my-1 w-px shrink-0 self-stretch bg-alpha-2"
                          }
                        />,
                        <input
                          ref={ref4}
                          className={
                            "h-full w-[34px] bg-transparent pl-1.5 pr-1 text-right font-mono text-[11px] text-primary outline-none focus-visible:outline-hidden"
                          }
                          value={value6}
                          aria-label={"Alpha percent"}
                          aria-describedby={value17}
                          onChange={(
                            event: React.ChangeEvent<HTMLInputElement>,
                          ) => value7(event.target.value)}
                          onBlur={(input: React.FocusEvent<HTMLInputElement>) =>
                            callback4(input, callback15())
                          }
                          onKeyDown={(
                            event: React.KeyboardEvent<HTMLInputElement> & {
                              target: HTMLInputElement;
                            },
                          ) => {
                            if (event.key === "Enter") {
                              event.target.blur();
                            } else if (event.key === "Escape") {
                              ref2.current = true;
                              value7(Math.round(value2.a * 100).toString());
                              event.target.blur();
                            }
                            event.stopPropagation();
                          }}
                        />,
                        <span className={"pr-1.5 text-[10px] text-muted"}>
                          {"%"}
                        </span>,
                      ]}
                    </jsxForUiColorPicker.Fragment>
                  ),
                ]}
              </div>,
            ]}
          </div>,
          memo2 !== undefined ? (
            <runtime.ContrastColorDetails
              fg={value12}
              results={memo2}
              sentenceId={value16}
              {...(value15
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
                : {})}
            />
          ) : null,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxForUiColorPicker",
    () => jsxForUiColorPicker,
    (value) => {
      jsxForUiColorPicker = value;
    },
  );
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
  bindRuntimeValue(
    runtime,
    "COLOR_ALPHA_CHECKERBOARD",
    () => COLOR_ALPHA_CHECKERBOARD,
    (value) => {
      COLOR_ALPHA_CHECKERBOARD = value;
    },
  );
  bindRuntimeValue(runtime, "ColorPickerLabel", () => ColorPickerLabel);
  bindRuntimeValue(runtime, "ColorPickerGroup", () => ColorPickerGroup);
  bindRuntimeValue(runtime, "ColorPickerHeader", () => ColorPickerHeader);
  bindRuntimeValue(
    runtime,
    "COLOR_SWATCH_BUTTON_CLASS",
    () => COLOR_SWATCH_BUTTON_CLASS,
    (value) => {
      COLOR_SWATCH_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "SwatchDot", () => SwatchDot);
  bindRuntimeValue(runtime, "SwatchButton", () => SwatchButton);
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
  bindRuntimeValue(runtime, "ColorHexInput", () => ColorHexInput);
  bindRuntimeValue(runtime, "ColorPicker", () => ColorPicker);
  return () => {
    jsxForUiColorPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COLOR_ALPHA_CHECKERBOARD =
      "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 8px 8px";
    COLOR_SWATCH_BUTTON_CLASS =
      "flex h-8 w-full min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-left outline-none pointer-coarse:h-10";
    COLOR_PICKER_POPOVER_HEIGHT = 440;
    COLOR_PICKER_POPOVER_CLASS = "w-64 p-4";
  };
}
