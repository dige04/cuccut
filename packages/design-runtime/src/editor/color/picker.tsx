/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorColorPicker(runtime: RuntimeBindings): () => void {
  var ColorPickerConstant: Dynamic;
  var ColorPickerLabel: Dynamic;
  function ColorHexInput({
    value: value,
    onChange: onChange,
    className = "mb-2",
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(null),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let activeElement: Dynamic = (document as Dynamic).activeElement,
          value3: Dynamic =
            value2.current?.closest('[data-mc-popover], [role="dialog"]') ??
            value2.current?.parentElement;
        activeElement instanceof HTMLElement &&
          value3 &&
          value3.contains(activeElement) &&
          !value2.current.contains(activeElement) &&
          activeElement.blur();
        onChange(input);
      };
    return (
      <runtime.TabsTabsRootListTabConfig.Root
        ref={value2}
        value={value}
        onValueChange={(input?: Dynamic): Dynamic => callback(input)}
      >
        <runtime.TabsTabsRootListTabConfig.List
          aria-label={"Source"}
          className={className}
          onMouseDown={(event?: Dynamic): Dynamic => event.preventDefault()}
        >
          <runtime.TabsTabsRootListTabConfig.Tab value={"system"}>
            {"Theme"}
          </runtime.TabsTabsRootListTabConfig.Tab>
          <runtime.TabsTabsRootListTabConfig.Tab value={"custom"}>
            {"Custom"}
          </runtime.TabsTabsRootListTabConfig.Tab>
        </runtime.TabsTabsRootListTabConfig.List>
      </runtime.TabsTabsRootListTabConfig.Root>
    );
  }
  function ColorPicker({
    value: value,
    unset: unset,
    opaque: opaque,
    onChange: onChange,
    onPickEnd: onPickEnd,
    contrast: contrast,
  }: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        opaque
          ? {
              ...input,
              a: 1,
            }
          : input,
      [value2, value3]: Dynamic = (0,
      runtime.reactAccessibilityAnnouncer.useState)(
        (): Dynamic => callback((0, runtime.parseHsvaColor)(value)),
      ),
      value4: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(value2);
    value4.current = value2;
    let value5: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(
        false,
      ),
      [value6, value7]: Dynamic = (0,
      runtime.reactAccessibilityAnnouncer.useState)(
        (): Dynamic => (0, runtime.hsvaToRgbHex)(value2),
      ),
      [value8, value9]: Dynamic = (0,
      runtime.reactAccessibilityAnnouncer.useState)(
        (): Dynamic => Math.round(value2.a * 100).toString(),
      ),
      value10: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(null),
      value11: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(null),
      value12: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(
        unset ?? false,
      );
    value12.current = unset ?? false;
    let value13: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(
      opaque ?? false,
    );
    value13.current = opaque ?? false;
    let value14: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(
      onPickEnd,
    );
    value14.current = onPickEnd;
    let value15: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(
      contrast,
    );
    value15.current = contrast;
    let value16: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useCallback)(
        (input?: Dynamic, options?: Dynamic): Dynamic => {
          value14.current?.(input);
          let current: Dynamic = value15.current;
          !options ||
            current === undefined ||
            (0, runtime.announce)((): Dynamic => {
              let value39: Dynamic = (0, runtime.evaluateColorContrast)(
                input,
                current,
              );
              return value39 === undefined
                ? null
                : (0, runtime.summarizeContrastResults)(value39).spoken;
            });
        },
        [],
      ),
      value17: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(false),
      value18: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(value),
      value19: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useCallback)(
        (input?: Dynamic): Dynamic => {
          value18.current = input;
          let value39: Dynamic = callback((0, runtime.parseHsvaColor)(input));
          (0, runtime.hsvaToRgbaHex)(value39) !==
            (0, runtime.hsvaToRgbaHex)(value4.current) &&
            (value3(value39),
            (value4.current = value39),
            value7((0, runtime.hsvaToRgbHex)(value39)),
            value9(Math.round(value39.a * 100).toString()));
        },
        [],
      );
    (0, runtime.reactAccessibilityAnnouncer.useEffect)((): Dynamic => {
      if (value === value18.current) return;
      let activeElement: Dynamic = (document as Dynamic).activeElement;
      activeElement === value10.current ||
        activeElement === value11.current ||
        value19(value);
    }, [value, value19]);
    let callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (options) return;
        let relatedTarget: Dynamic = input.relatedTarget;
        (relatedTarget !== null &&
          (relatedTarget === value10.current ||
            relatedTarget === value11.current)) ||
          (value !== value18.current && value19(value));
      },
      value20: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useCallback)(
        (input?: Dynamic): Dynamic => {
          let value39: Dynamic = value13.current
              ? {
                  ...input,
                  a: 1,
                }
              : input,
            value40: Dynamic = (0, runtime.hsvaToRgbaHex)(value39),
            value41: Dynamic =
              value40 !== (0, runtime.hsvaToRgbaHex)(value4.current);
          value3(value39);
          value4.current = value39;
          value7((0, runtime.hsvaToRgbHex)(value39));
          value9(Math.round(value39.a * 100).toString());
          return !value41 && !value12.current
            ? false
            : ((value18.current = value40), onChange(value40), true);
        },
        [onChange],
      ),
      value21: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useCallback)(
        (input?: Dynamic): Dynamic => {
          let value39: Dynamic = value13.current
            ? {
                ...input,
                a: 1,
              }
            : input;
          return !value12.current &&
            (0, runtime.hsvaToRgbaHex)(value39) ===
              (0, runtime.hsvaToRgbaHex)(value4.current)
            ? (value7((0, runtime.hsvaToRgbHex)(value4.current)),
              value9(Math.round(value4.current.a * 100).toString()),
              false)
            : (value20(value39),
              value16((0, runtime.hsvaToRgbaHex)(value39), true),
              true);
        },
        [value20, value16],
      ),
      value22: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useCallback)(
        (): Dynamic =>
          (input?: Dynamic): Dynamic => {
            value16((0, runtime.hsvaToRgbaHex)(value4.current), input);
          },
        [value16],
      ),
      value23: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(
        new Set(),
      ),
      [value24, value25]: Dynamic = (0,
      runtime.reactAccessibilityAnnouncer.useState)(undefined),
      value26: Dynamic = value24 !== undefined,
      value27: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(null),
      value28: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useRef)(false),
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        input || value10.current?.focus();
      };
    (0, runtime.reactAccessibilityAnnouncer.useEffect)(
      (): Dynamic => (): Dynamic => {
        for (let value39 of value23.current as Dynamic) value39();
        value23.current.clear();
      },
      [],
    );
    let callback4: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (input.button !== 0) return;
        value27.current?.contains((document as Dynamic).activeElement) &&
          callback3(input.pointerType === "touch");
        value25(
          (input2?: Dynamic): Dynamic =>
            input2 ?? {
              shade: value34,
            },
        );
        let value39: Dynamic = value22(),
          flag: Dynamic = false,
          callback13: Dynamic = (): Dynamic => {},
          callback14: Dynamic = (input2?: Dynamic): Dynamic => {
            value23.current.delete(callback15);
            value23.current.size === 0 && value25(undefined);
            callback13();
            flag && ((flag = false), value39(input2));
          },
          callback15: Dynamic = (): Dynamic => callback14(false);
        callback13 = (0, runtime.trackColorPickerDrag)(
          input,
          (
            input2?: Dynamic,
            options2?: Dynamic,
            context?: Dynamic,
          ): Dynamic => {
            options(input2, options2, context) && (flag = true);
          },
          (): Dynamic => callback14(true),
        );
        value23.current.add(callback15);
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic =>
        callback4(
          input,
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
            value20({
              ...value4.current,
              s: (0, runtime.colorSliderPosition)(input2, context),
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
      callback6: Dynamic = (input?: Dynamic): Dynamic =>
        callback4(
          input,
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
            value20({
              ...value4.current,
              h: (0, runtime.colorSliderPosition)(input2, context) * 360,
            }),
        ),
      callback7: Dynamic = (input?: Dynamic): Dynamic =>
        callback4(
          input,
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
            value20({
              ...value4.current,
              a: (0, runtime.colorSliderPosition)(input2, context),
            }),
        ),
      callback8: Dynamic = async (): Promise<Dynamic> => {
        let value39: Dynamic = await (0, runtime.pickEyeDropperColor)();
        value39 &&
          value21({
            ...(0, runtime.parseHsvaColor)(value39),
            a: value4.current.a,
          });
      },
      callback9: Dynamic = (): Dynamic => {
        if (value5.current) {
          value5.current = false;
          return false;
        }
        if (value12.current && !value17.current) return false;
        let value39: Dynamic = value6.trim();
        if (
          /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
            value39,
          )
        ) {
          let value40: Dynamic = (0, runtime.parseHsvaColor)(
              value39.startsWith("#") ? value39 : "#" + value39,
            ),
            length: Dynamic = value39.replace(/^#/, "").length;
          return value21(
            length === 4 || length === 8
              ? value40
              : {
                  ...value40,
                  a: value2.a,
                },
          );
        }
        value7((0, runtime.hsvaToRgbHex)(value2));
        return false;
      },
      callback10: Dynamic = (): Dynamic => {
        if (value5.current) {
          value5.current = false;
          return false;
        }
        let value39: Dynamic = parseFloat(value8);
        return isNaN(value39) ||
          Math.round(value39) === Math.round(value2.a * 100)
          ? (value9(Math.round(value2.a * 100).toString()), false)
          : value21({
              ...value2,
              a: Math.max(0, Math.min(1, value39 / 100)),
            });
      },
      value29: Dynamic = (0, runtime.hsvaToRgbaCss)({
        ...value2,
        a: 1,
      }),
      value30: Dynamic = (0, runtime.hsvaToRgbaHex)(value2),
      value31: Dynamic =
        contrast === undefined ? undefined : JSON.stringify(contrast),
      value32: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useMemo)(
        (): Dynamic => contrast,
        [value31],
      ),
      value33: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useMemo)(
        (): Dynamic =>
          value32 === undefined
            ? undefined
            : (0, runtime.evaluateColorContrast)(value30, value32),
        [value32, value30],
      ),
      value34: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useMemo)(
        (): Dynamic =>
          value32 === undefined || value26
            ? undefined
            : (0, runtime.findReadableShade)(value30, value32),
        [value32, value30, value26],
      ),
      value35: Dynamic = value24 !== undefined ? value24.shade : value34,
      value36: Dynamic = value33 !== undefined && value35 !== undefined;
    (0, runtime.reactAccessibilityAnnouncer.useLayoutEffect)((): Dynamic => {
      value28.current &&
        ((value28.current = false), value36 || value10.current?.focus());
    }, [value36]);
    let callback11: Dynamic = (input?: Dynamic): Dynamic => {
        value34 !== undefined &&
          (value21((0, runtime.parseHsvaColor)(value34.css)), callback3(input));
      },
      callback12: Dynamic = (): Dynamic => {
        value28.current = true;
      },
      value37: Dynamic = (0, runtime.reactAccessibilityAnnouncer.useId)(),
      value38: Dynamic = value33 === undefined ? undefined : value37;
    return (
      <div className={"flex w-full min-w-56 flex-col"}>
        <div
          className={"relative aspect-[3/2] w-full touch-none rounded-md"}
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${value2.h}, 100%, 50%))`,
          }}
          onPointerDown={callback5}
        >
          <div
            className={
              "pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
            }
            style={{
              left: `calc(${value2.s} * (100% - 14px) + 7px)`,
              top: `calc(${1 - value2.v} * (100% - 14px) + 7px)`,
              background: value29,
            }}
          />
        </div>
        <div
          className={"relative touch-none pt-2 pb-1 pointer-coarse:py-3.5"}
          onPointerDown={callback6}
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
        </div>
        {!opaque && (
          <div
            className={"relative touch-none py-1 pointer-coarse:py-3.5"}
            onPointerDown={callback7}
          >
            <div
              className={"relative h-3 w-full rounded-md"}
              style={{
                background: `linear-gradient(to right, transparent, ${value29}), ${runtime.alphaCheckerboardBackground}`,
              }}
            >
              <div
                className={
                  "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                }
                style={{
                  left: `calc(${value2.a} * (100% - 14px) + 7px)`,
                  background: (0, runtime.hsvaToRgbaCss)(value2),
                }}
              />
            </div>
          </div>
        )}
        <div className={"mt-1 flex items-center gap-2"}>
          {(0, runtime.supportsEyeDropper)() && (
            <button
              type={"button"}
              title={"Pick color from screen"}
              aria-label={"Pick color from screen"}
              onClick={callback8}
              className={
                "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted outline-none hover:bg-alpha-1 hover:text-primary focus-visible:outline-hidden focus-visible:shadow-focus pointer-coarse:h-10 pointer-coarse:w-10"
              }
            >
              <runtime.Icon name={"EyeDropper"} size={"sm"} />
            </button>
          )}
          <div
            className={
              "flex h-6 min-w-0 flex-1 items-center rounded bg-fill-field shadow-field-ring transition duration-fast hover:not-focus-within:shadow-field-hover has-[:focus-visible]:shadow-focus pointer-coarse:h-10"
            }
          >
            <input
              ref={value10}
              className={
                "h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[11px] text-primary outline-none focus-visible:outline-hidden"
              }
              value={value6}
              aria-label={"Hex color"}
              aria-describedby={value38}
              onChange={(event?: Dynamic): Dynamic => {
                value17.current = true;
                value7(event.target.value);
              }}
              onFocus={(): Dynamic => {
                value17.current = false;
              }}
              onBlur={(input?: Dynamic): Dynamic =>
                callback2(input, callback9())
              }
              onKeyDown={(event?: Dynamic): Dynamic => {
                event.key === "Enter"
                  ? event.target.blur()
                  : event.key === "Escape" &&
                    ((value5.current = true),
                    value7((0, runtime.hsvaToRgbHex)(value2)),
                    event.target.blur());
                event.stopPropagation();
              }}
            />
            {!opaque && (
              <runtime.jsxColorPickerPrimitives.Fragment>
                <div className={"my-1 w-px shrink-0 self-stretch bg-alpha-2"} />
                <input
                  ref={value11}
                  className={
                    "h-full w-[34px] bg-transparent pl-1.5 pr-1 text-right font-mono text-[11px] text-primary outline-none focus-visible:outline-hidden"
                  }
                  value={value8}
                  aria-label={"Alpha percent"}
                  aria-describedby={value38}
                  onChange={(event?: Dynamic): Dynamic =>
                    value9(event.target.value)
                  }
                  onBlur={(input?: Dynamic): Dynamic =>
                    callback2(input, callback10())
                  }
                  onKeyDown={(event?: Dynamic): Dynamic => {
                    event.key === "Enter"
                      ? event.target.blur()
                      : event.key === "Escape" &&
                        ((value5.current = true),
                        value9(Math.round(value2.a * 100).toString()),
                        event.target.blur());
                    event.stopPropagation();
                  }}
                />
                <span className={"pr-1.5 text-[10px] text-muted"}>{"%"}</span>
              </runtime.jsxColorPickerPrimitives.Fragment>
            )}
          </div>
        </div>
        {value33 !== undefined ? (
          <runtime.ContrastAdvice
            fg={value30}
            results={value33}
            sentenceId={value37}
            {...(value36
              ? {
                  fix: {
                    css: value35.css,
                    ratio: value35.ratio,
                    ground: value35.ground.label,
                    onUse: callback11,
                  },
                  fixHeld: value26,
                  fixRef: value27,
                  onFixGoneFocused: callback12,
                }
              : {})}
          />
        ) : null}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "ColorPickerConstant",
    () => ColorPickerConstant,
    (value) => {
      ColorPickerConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ColorPickerLabel",
    () => ColorPickerLabel,
    (value) => {
      ColorPickerLabel = value;
    },
  );
  bindRuntimeValue(runtime, "ColorHexInput", () => ColorHexInput);
  bindRuntimeValue(runtime, "ColorPicker", () => ColorPicker);
  return () => {
    ColorPickerConstant = 440;
    ColorPickerLabel = "w-64 p-4";
  };
}
