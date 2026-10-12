/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorColorPickerPrimitives(
  runtime: RuntimeBindings,
): () => void {
  var jsxColorPickerPrimitives: Dynamic;
  var alphaCheckerboardBackground: Dynamic;
  var ColorPickerPrimitivesClassNames: Dynamic;
  function joinPickerClasses(...input: Dynamic[]): Dynamic {
    return input.filter(Boolean).join(" ");
  }
  function rgbToHsva(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Math.max(input, options, context),
      value3: Dynamic = Math.min(input, options, context),
      value4: Dynamic = value2 - value3,
      index: Dynamic = 0;
    value4 !== 0 &&
      (value2 === input
        ? (index = ((options - context) / value4) % 6)
        : value2 === options
          ? (index = (context - input) / value4 + 2)
          : (index = (input - options) / value4 + 4),
      (index *= 60),
      index < 0 && (index += 360));
    let value5: Dynamic = value2 === 0 ? 0 : value4 / value2;
    return {
      h: index,
      s: value5,
      v: value2,
      a: value,
    };
  }
  function parseHsvaColor(cssColor?: Dynamic): Dynamic {
    let hex: Dynamic = cssColor.match(/^#([0-9a-f]{3,8})$/i)?.[1];
    if (hex && hex.length !== 5 && hex.length !== 7) {
      let value4: Dynamic =
          hex.length <= 4
            ? hex.replace(
                /[0-9a-f]/gi,
                (input?: Dynamic): Dynamic => input + input,
              )
            : hex.padEnd(8, "f"),
        callback: Dynamic = (input?: Dynamic): Dynamic =>
          parseInt(value4.slice(input * 2, input * 2 + 2), 16) / 255;
      return rgbToHsva(
        callback(0),
        callback(1),
        callback(2),
        hex.length === 4 || hex.length === 8 ? callback(3) : 1,
      );
    }
    let value: Dynamic = cssColor.match(
      /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/,
    );
    if (value) {
      let callback: Dynamic = (input?: Dynamic): Dynamic =>
        Math.min(1, Math.max(0, input));
      return rgbToHsva(
        callback(+(value[1] ?? 0) / 255),
        callback(+(value[2] ?? 0) / 255),
        callback(+(value[3] ?? 0) / 255),
        value[4] != null ? callback(+value[4]) : 1,
      );
    }
    if (
      typeof document === "undefined" ||
      typeof getComputedStyle === "undefined"
    )
      return {
        h: 0,
        s: 0,
        v: 0,
        a: 1,
      };
    let value2: Dynamic = (document as Dynamic).createElement("div");
    value2.style.color = cssColor;
    (document as Dynamic).body.appendChild(value2);
    let color: Dynamic = getComputedStyle(value2).color;
    (document as Dynamic).body.removeChild(value2);
    let value3: Dynamic = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
    );
    return value3
      ? rgbToHsva(
          +(value3[1] ?? 0) / 255,
          +(value3[2] ?? 0) / 255,
          +(value3[3] ?? 0) / 255,
          value3[4] != null ? +value3[4] : 1,
        )
      : {
          h: 0,
          s: 0,
          v: 0,
          a: 1,
        };
  }
  function hsvaToRgbaCss(color?: Dynamic): Dynamic {
    let { h: value, s: value2, v: value3, a: value4 }: Dynamic = color,
      value5: Dynamic = value3 * value2,
      value6: Dynamic = value5 * (1 - Math.abs(((value / 60) % 2) - 1)),
      value7: Dynamic = value3 - value5,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      index3: Dynamic = 0;
    value < 60
      ? ((index = value5), (index2 = value6))
      : value < 120
        ? ((index = value6), (index2 = value5))
        : value < 180
          ? ((index2 = value5), (index3 = value6))
          : value < 240
            ? ((index2 = value6), (index3 = value5))
            : value < 300
              ? ((index = value6), (index3 = value5))
              : ((index = value5), (index3 = value6));
    let value8: Dynamic = Math.round((index + value7) * 255),
      value9: Dynamic = Math.round((index2 + value7) * 255),
      value10: Dynamic = Math.round((index3 + value7) * 255);
    return value4 < 1
      ? `rgba(${value8}, ${value9}, ${value10}, ${+value4.toFixed(3)})`
      : `rgb(${value8}, ${value9}, ${value10})`;
  }
  function hsvaToRgbHex(color?: Dynamic): Dynamic {
    let value: Dynamic = hsvaToRgbaCss({
      ...color,
      a: 1,
    }).match(/(\d+),\s*(\d+),\s*(\d+)/);
    return value
      ? "#" +
          [+(value[1] ?? 0), +(value[2] ?? 0), +(value[3] ?? 0)]
            .map(
              (input?: Dynamic): Dynamic => input.toString(16).padStart(2, "0"),
            )
            .join("")
            .toUpperCase()
      : "#000000";
  }
  function hsvaToRgbaHex(color?: Dynamic): Dynamic {
    let value: Dynamic = hsvaToRgbHex(color);
    return color.a >= 1
      ? value
      : value +
          Math.round(color.a * 255)
            .toString(16)
            .padStart(2, "0")
            .toUpperCase();
  }
  function supportsEyeDropper(): Dynamic {
    return typeof EyeDropper !== "undefined";
  }
  async function pickEyeDropperColor(): Promise<Dynamic> {
    if (typeof EyeDropper === "undefined") return null;
    try {
      return (await new EyeDropper().open()).sRGBHex;
    } catch {
      return null;
    }
  }
  function trackColorPickerDrag(
    event?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    event.preventDefault();
    let currentTarget: Dynamic = event.currentTarget,
      bounds: Dynamic = currentTarget.getBoundingClientRect(),
      pointerId: Dynamic = event.pointerId;
    try {
      currentTarget.setPointerCapture(pointerId);
    } catch {}
    options(event.clientX, event.clientY, bounds);
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        input.pointerId === pointerId &&
          options(input.clientX, input.clientY, bounds);
      },
      callback2: Dynamic = (): Dynamic => {
        (window as Dynamic).removeEventListener("pointermove", callback);
        (window as Dynamic).removeEventListener("pointerup", callback3);
        (window as Dynamic).removeEventListener("pointercancel", callback3);
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        input.pointerId === pointerId && (callback2(), context?.());
      };
    (window as Dynamic).addEventListener("pointermove", callback);
    (window as Dynamic).addEventListener("pointerup", callback3);
    (window as Dynamic).addEventListener("pointercancel", callback3);
    return callback2;
  }
  function colorSliderPosition(input?: Dynamic, options?: Dynamic): Dynamic {
    return Math.max(
      0,
      Math.min(1, (input - options.left - 7) / (options.width - 14)),
    );
  }
  function PickerRowText({ text: text, title = false }: Dynamic): Dynamic {
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
  function PickerListGroup({
    label: label,
    className: className,
    role = "group",
    scroll = true,
    children: children,
  }: Dynamic): Dynamic {
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
  function PickerListHeader({ text: text, title: title }: Dynamic): Dynamic {
    return (
      <div
        role={"presentation"}
        className={"flex h-8 shrink-0 items-center px-2"}
      >
        <PickerRowText text={text} title={title} />
      </div>
    );
  }
  function ColorSwatchDot({ paint: paint, current = false }: Dynamic): Dynamic {
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
  function ColorSwatchRow({
    label: label,
    paint: paint,
    current = false,
    onClick: onClick,
    readOnly = false,
    disabled: disabled2 = false,
    title: title,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = (
      <jsxColorPickerPrimitives.Fragment>
        <ColorSwatchDot paint={paint} current={current} />
        <span className={"min-w-0 flex-1 truncate text-footnote text-primary"}>
          {label}
        </span>
        {current ? (
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
        ) : null}
      </jsxColorPickerPrimitives.Fragment>
    );
    return readOnly ? (
      <div
        role={"listitem"}
        title={title ?? label}
        aria-label={label}
        className={joinPickerClasses(
          ColorPickerPrimitivesClassNames,
          "cursor-default",
        )}
        {...props}
      >
        {value}
      </div>
    ) : (
      <button
        type={"button"}
        title={disabled2 ? undefined : (title ?? label)}
        aria-label={label}
        aria-pressed={current}
        disabled={disabled2}
        onClick={onClick}
        className={joinPickerClasses(
          ColorPickerPrimitivesClassNames,
          disabled2
            ? "pointer-events-none opacity-50"
            : "cursor-default hover:bg-fill-ghost-hover focus-visible:outline-hidden focus-visible:shadow-focus forced-colors:focus-visible:-outline-offset-2",
          current && "bg-fill-ghost-hover",
        )}
        {...props}
      >
        {value}
      </button>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxColorPickerPrimitives",
    () => jsxColorPickerPrimitives,
    (value) => {
      jsxColorPickerPrimitives = value;
    },
  );
  bindRuntimeValue(runtime, "joinPickerClasses", () => joinPickerClasses);
  bindRuntimeValue(runtime, "rgbToHsva", () => rgbToHsva);
  bindRuntimeValue(runtime, "parseHsvaColor", () => parseHsvaColor);
  bindRuntimeValue(runtime, "hsvaToRgbaCss", () => hsvaToRgbaCss);
  bindRuntimeValue(runtime, "hsvaToRgbHex", () => hsvaToRgbHex);
  bindRuntimeValue(runtime, "hsvaToRgbaHex", () => hsvaToRgbaHex);
  bindRuntimeValue(runtime, "supportsEyeDropper", () => supportsEyeDropper);
  bindRuntimeValue(runtime, "pickEyeDropperColor", () => pickEyeDropperColor);
  bindRuntimeValue(runtime, "trackColorPickerDrag", () => trackColorPickerDrag);
  bindRuntimeValue(runtime, "colorSliderPosition", () => colorSliderPosition);
  bindRuntimeValue(
    runtime,
    "alphaCheckerboardBackground",
    () => alphaCheckerboardBackground,
    (value) => {
      alphaCheckerboardBackground = value;
    },
  );
  bindRuntimeValue(runtime, "PickerRowText", () => PickerRowText);
  bindRuntimeValue(runtime, "PickerListGroup", () => PickerListGroup);
  bindRuntimeValue(runtime, "PickerListHeader", () => PickerListHeader);
  bindRuntimeValue(
    runtime,
    "ColorPickerPrimitivesClassNames",
    () => ColorPickerPrimitivesClassNames,
    (value) => {
      ColorPickerPrimitivesClassNames = value;
    },
  );
  bindRuntimeValue(runtime, "ColorSwatchDot", () => ColorSwatchDot);
  bindRuntimeValue(runtime, "ColorSwatchRow", () => ColorSwatchRow);
  return () => {
    jsxColorPickerPrimitives = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    alphaCheckerboardBackground =
      "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 8px 8px";
    ColorPickerPrimitivesClassNames =
      "flex h-8 w-full min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-left outline-none pointer-coarse:h-10";
  };
}
