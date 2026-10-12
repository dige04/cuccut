/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorComponentsPropEditors(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsPropEditorsDataTweakPopupConfig: Dynamic;
  var ComponentsPropEditorsPattern: Dynamic;
  var ComponentsPropEditors234Config: Dynamic;
  function primitivePropText(input?: Dynamic): Dynamic {
    return input == null || typeof input == "object" ? "" : String(input);
  }
  function numericPropValue(input?: Dynamic): Dynamic {
    if (typeof input == "number")
      return Number.isFinite(input) ? input : undefined;
    if (typeof input == "string" && input.trim() !== "") {
      let value: Dynamic = Number(input);
      return Number.isFinite(value) ? value : undefined;
    }
  }
  function propStepDecimalPlaces(input?: Dynamic): Dynamic {
    let value: Dynamic = String(input),
      value2: Dynamic = value.indexOf(".");
    return value2 === -1 || value.includes("e") ? 0 : value.length - value2 - 1;
  }
  function clampPropStep(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (!(value > 0)) return Math.min(context, Math.max(options, input));
    let value2: Dynamic = Math.max(
        propStepDecimalPlaces(value),
        propStepDecimalPlaces(options),
      ),
      value3: Dynamic = Number(
        (Math.round((input - options) / value) * value + options).toFixed(
          value2,
        ),
      );
    return Math.min(context, Math.max(options, value3));
  }
  function propOptionItems(input?: Dynamic): Dynamic {
    return (input ?? []).map(
      (input2?: Dynamic): Dynamic =>
        input2 != null && typeof input2 == "object" && "value" in input2
          ? {
              value: input2.value,
              label: String(input2.label ?? input2.value),
            }
          : {
              value: input2,
              label: String(input2),
            },
    );
  }
  function isLightHexColor(input?: Dynamic): Dynamic {
    let value: Dynamic = input.replace("#", ""),
      value2: Dynamic =
        value.length === 3
          ? value.replace(/./g, (input2?: Dynamic): Dynamic => input2 + input2)
          : value.padEnd(6, "0"),
      value3: Dynamic = parseInt(value2.slice(0, 6), 16);
    if (Number.isNaN(value3)) return true;
    let value4: Dynamic = (value3 >> 16) & 255,
      value5: Dynamic = (value3 >> 8) & 255,
      value6: Dynamic = value3 & 255;
    return value4 * 299 + value5 * 587 + value6 * 114 > 148e3;
  }
  function PropPaletteCards({
    options: options,
    value: value,
    onChange: onChange,
    size = "card",
    "aria-label": ariaLabel,
  }: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        String(JSON.stringify(input)).toLowerCase(),
      value2: Dynamic = callback(value),
      value3: Dynamic = size === "row";
    return (
      <div
        className={(0, runtime.cn)(
          "flex min-w-0 flex-1 gap-1.5",
          value3 && "flex-wrap gap-1 py-0.5",
        )}
        role={"radiogroup"}
        aria-label={ariaLabel}
      >
        {options.map((input?: Dynamic, options2?: Dynamic): Dynamic => {
          let value4: Dynamic = (Array.isArray(input) ? input : [input]).map(
              String,
            ),
            [value5 = "#000", ...value6]: Dynamic = value4,
            value7: Dynamic = value6.slice(0, value3 ? 3 : 4),
            value8: Dynamic = callback(input) === value2;
          return (
            <button
              key={options2}
              type={"button"}
              role={"radio"}
              aria-checked={value8}
              aria-label={value4.join(", ")}
              title={value4.join(" \xB7 ")}
              onClick={(): Dynamic => onChange(input)}
              className={(0, runtime.cn)(
                "relative min-w-0 cursor-default overflow-hidden border-0 p-0",
                value3
                  ? "h-control basis-[calc((100%-0.5rem)/3)] rounded pointer-coarse:h-10"
                  : "h-[46px] flex-1 rounded-md",
                "transition-[transform,box-shadow] duration-[120ms] ease-[cubic-bezier(.3,.7,.4,1)]",
                value8
                  ? "shadow-[0_0_0_1.5px_var(--cds-text-primary),0_2px_6px_rgba(0,0,0,0.15)]"
                  : (0, runtime.cn)(
                      "shadow-card-ring hover:shadow-field-hover",
                      !value3 && "hover:-translate-y-px",
                    ),
              )}
              style={{
                background: (0, runtime.sanitizeCssBackground)(value5),
              }}
            >
              {value7.length > 0 && (
                <span
                  className={
                    "absolute inset-y-0 right-0 flex w-[34%] flex-col shadow-[-1px_0_0_rgba(0,0,0,0.1)]"
                  }
                >
                  {value7.map(
                    (input2?: Dynamic, options3?: Dynamic): Dynamic => (
                      <i
                        key={options3}
                        className={(0, runtime.cn)(
                          "flex-1",
                          options3 > 0 &&
                            "shadow-[0_-1px_0_color-mix(in_srgb,var(--cds-text-primary)_18%,transparent)]",
                        )}
                        style={{
                          background: (0, runtime.sanitizeCssBackground)(
                            input2,
                          ),
                        }}
                      />
                    ),
                  )}
                </span>
              )}
              {value8 && (
                <svg
                  viewBox={"0 0 14 14"}
                  aria-hidden={"true"}
                  className={(0, runtime.cn)(
                    "absolute drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]",
                    value3
                      ? "left-1 top-1 h-[11px] w-[11px]"
                      : "left-1.5 top-1.5 h-[13px] w-[13px]",
                  )}
                >
                  <path
                    d={"M3 7.2 5.8 10 11 4.2"}
                    fill={"none"}
                    strokeWidth={"2.2"}
                    strokeLinecap={"round"}
                    strokeLinejoin={"round"}
                    stroke={
                      isLightHexColor(value5) ? "rgba(0,0,0,.78)" : "#fff"
                    }
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  function propColorEditorKind(items?: Dynamic): Dynamic {
    return items.length > 0 &&
      !items.every((input?: Dynamic): Dynamic => typeof input == "string")
      ? "palette-cards"
      : "color-well";
  }
  function canonicalPropHexColor(input?: Dynamic): Dynamic {
    return (0, runtime.hsvaToRgbaHex)((0, runtime.parseHsvaColor)(input));
  }
  function propColorOptionKeys(input?: Dynamic): Dynamic {
    return input.map((input2?: Dynamic, options?: Dynamic): Dynamic => {
      let value: Dynamic = input2.trim();
      return ComponentsPropEditorsPattern.test(value)
        ? canonicalPropHexColor(value)
        : /\bvar\s*\(/i.test(value)
          ? `\0unkeyable-${options}`
          : /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(
                value,
              )
            ? `\0unkeyable-${options}`
            : typeof CSS !== "undefined" &&
                typeof CSS.supports == "function" &&
                CSS.supports("color", value)
              ? canonicalPropHexColor(value)
              : `\0unkeyable-${options}`;
    });
  }
  function restorePropColorOption(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.indexOf(canonicalPropHexColor(context));
    return value >= 0 ? input[value] : context.toLowerCase();
  }
  function designSystemPropColorOptions(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.designSystemColorOptions)(context),
      entries: Dynamic = new Map();
    for (let value2 of value as Dynamic) {
      if (
        typeof value2 == "string" ||
        !ComponentsPropEditorsPattern.test(value2.value) ||
        (0, runtime.parseHsvaColor)(value2.value).a < 1
      )
        continue;
      let value3: Dynamic = canonicalPropHexColor(value2.value);
      entries.has(value3) || entries.set(value3, value2.label ?? value2.name);
    }
    return [
      ...input.map((input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value2: Dynamic = ComponentsPropEditorsPattern.test(input2.trim())
          ? entries.get(options[options2])
          : undefined;
        return value2 === undefined
          ? input2
          : {
              name: input2,
              value: input2,
              label: value2,
            };
      }),
      ...value,
    ];
  }
  function PropRangeInput({
    name: name,
    cur: cur,
    min: min2,
    max: max,
    step: step,
    unit: unit,
    onChange: onChange,
    onReset: onReset,
  }: Dynamic): Dynamic {
    let value: Dynamic = numericPropValue(cur) ?? min2,
      value2: Dynamic = (0, runtime.reactInspectorContext_3.useRef)(value);
    value2.current = value;
    return (
      <runtime.PropertyRangeRow
        label={name}
        value={value}
        min={min2}
        max={max}
        step={step}
        unit={unit}
        onValue={(input?: Dynamic): Dynamic => {
          let value3: Dynamic = clampPropStep(input, min2, max, step);
          value3 !== value2.current &&
            ((value2.current = value3), onChange(value3));
        }}
        onReset={onReset}
      />
    );
  }
  function PropColorInput({
    name: name,
    cur: cur,
    swatches: swatches,
    onChange: onChange,
    onReset: onReset,
    tweak: tweak,
  }: Dynamic): Dynamic {
    let value: Dynamic = typeof cur == "string" ? cur.trim() : "",
      value2: Dynamic =
        value !== "" && (0, runtime.sanitizeCssColor)(value) === value
          ? value
          : undefined,
      value3: Dynamic = (0, runtime.reactInspectorContext_3.useMemo)(
        (): Dynamic => swatches,
        [swatches.join("\0"), swatches.length],
      ),
      value4: Dynamic = (0, runtime.reactInspectorContext_3.useMemo)(
        (): Dynamic => propColorOptionKeys(value3),
        [value3],
      ),
      value5: Dynamic = (0, runtime.useDesignSystems)(),
      value6: Dynamic = (0, runtime.reactInspectorContext_3.useMemo)(
        (): Dynamic => designSystemPropColorOptions(value3, value4, value5),
        [value3, value4, value5],
      );
    return (
      <runtime.PropertyHexRow
        label={name}
        value={value2}
        swatches={value6}
        onReset={onReset}
        popupAttrs={
          tweak ? ComponentsPropEditorsDataTweakPopupConfig : undefined
        }
        onChange={(input?: Dynamic): Dynamic => {
          input !== undefined &&
            onChange(restorePropColorOption(value3, value4, input));
        }}
      />
    );
  }
  function propOptionsFitSegments(items?: Dynamic): Dynamic {
    return items.length < 2 || items.length > runtime.PropertiesRowsLimit
      ? false
      : items.reduce(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            Math.max(input, options.label.length),
          0,
        ) <= (ComponentsPropEditors234Config[items.length] ?? 0);
  }
  function ComponentPropInput({
    name: name,
    meta: meta,
    value: value,
    onChange: onChange,
    onReset: onReset,
    tweak = false,
    unsetHint: unsetHint,
  }: Dynamic): Dynamic {
    let value2: Dynamic =
      value === undefined &&
      (unsetHint === undefined || meta.editor === "boolean")
        ? meta.default
        : value;
    switch (meta.editor) {
      case "boolean":
        return (
          <runtime.PropertyBooleanRow
            label={name}
            checked={!!value2}
            onChange={onChange}
            onReset={onReset}
          />
        );
      case "int":
      case "float": {
        let value3: Dynamic = meta.editor === "int",
          value4: Dynamic = value3
            ? Math.max(1, Math.trunc(meta.step ?? 1))
            : (meta.step ?? 1);
        return (
          <runtime.PropertyNumberRow
            label={name}
            value={numericPropValue(value2)}
            min={meta.min}
            max={meta.max}
            step={value4}
            smallStep={value3 ? value4 : undefined}
            unit={meta.unit}
            placeholder={unsetHint}
            clearable={true}
            onValue={(input?: Dynamic): Dynamic => {
              if (input === undefined) return onChange(undefined);
              onChange(value3 ? Math.trunc(input) : input);
            }}
            onReset={onReset}
          />
        );
      }
      case "range":
        return (
          <PropRangeInput
            name={name}
            cur={value2}
            min={meta.min ?? 0}
            max={meta.max ?? 100}
            step={meta.step ?? 1}
            unit={meta.unit}
            onChange={onChange}
            onReset={onReset}
          />
        );
      case "color": {
        let value3: Dynamic = (
          Array.isArray(meta.options) ? meta.options : []
        ).slice(0, 64);
        return propColorEditorKind(value3) === "palette-cards" ? (
          <runtime.PropertyTextRow label={name} onReset={onReset}>
            <PropPaletteCards
              size={"row"}
              aria-label={name}
              options={value3}
              value={value2}
              onChange={onChange}
            />
          </runtime.PropertyTextRow>
        ) : (
          <PropColorInput
            name={name}
            cur={value2}
            swatches={value3}
            onChange={onChange}
            onReset={onReset}
            tweak={tweak}
          />
        );
      }
      case "enum": {
        let value3: Dynamic = propOptionItems(meta.options),
          value4: Dynamic = value3.map(
            (input?: Dynamic, options?: Dynamic): Dynamic => ({
              value: String(options),
              label: input.label,
            }),
          ),
          value5: Dynamic =
            value2 ?? (unsetHint === undefined ? value3[0]?.value : undefined),
          value6: Dynamic = value3.findIndex(
            (input?: Dynamic): Dynamic => input.value === value5,
          );
        value6 < 0 &&
          (value6 = value3.findIndex(
            (input?: Dynamic): Dynamic =>
              String(input.value) === primitivePropText(value5),
          ));
        let callback: Dynamic = (input?: Dynamic): Dynamic => {
          let value9: Dynamic = value3[Number(input)];
          value9 !== undefined && onChange(value9.value);
        };
        if (
          propOptionsFitSegments(value3) &&
          !(unsetHint !== undefined && value2 === undefined)
        )
          return (
            <runtime.PropertyEnumRow
              label={name}
              options={value4}
              popupAttrs={
                tweak ? ComponentsPropEditorsDataTweakPopupConfig : undefined
              }
              value={String(value6)}
              onChange={callback}
              onReset={onReset}
            />
          );
        let value7: Dynamic = (0, runtime.isToolNameList)(
            value3.map((input?: Dynamic): Dynamic => input.value),
          ),
          value8: Dynamic = value7
            ? value4.map(
                (input?: Dynamic, options?: Dynamic): Dynamic => ({
                  ...input,
                  icon:
                    (0, runtime.getSupportedTool)(value3[options].value) ??
                    null,
                }),
              )
            : value4;
        return (
          <runtime.PropertySelectRow
            label={name}
            options={value8}
            popupAttrs={
              tweak ? ComponentsPropEditorsDataTweakPopupConfig : undefined
            }
            value={value6 < 0 ? "" : String(value6)}
            placeholder={
              value2 === undefined && unsetHint !== undefined
                ? undefined
                : primitivePropText(value5)
            }
            hint={unsetHint}
            searchable={value4.length > 12}
            searchLabel={value7 ? "Search icons" : undefined}
            onChange={callback}
            onReset={onReset}
          />
        );
      }
      default:
        return (
          <runtime.PropertyTextRow
            label={name}
            onReset={onReset}
            onPress={(element?: Dynamic): Dynamic =>
              element.querySelector("input")?.focus()
            }
          >
            <runtime.TextInput
              aria-label={name}
              value={primitivePropText(value2)}
              onChange={(event?: Dynamic): Dynamic =>
                onChange(event.target.value)
              }
            />
          </runtime.PropertyTextRow>
        );
    }
  }
  bindRuntimeValue(runtime, "primitivePropText", () => primitivePropText);
  bindRuntimeValue(runtime, "numericPropValue", () => numericPropValue);
  bindRuntimeValue(
    runtime,
    "propStepDecimalPlaces",
    () => propStepDecimalPlaces,
  );
  bindRuntimeValue(runtime, "clampPropStep", () => clampPropStep);
  bindRuntimeValue(
    runtime,
    "ComponentsPropEditorsDataTweakPopupConfig",
    () => ComponentsPropEditorsDataTweakPopupConfig,
    (value) => {
      ComponentsPropEditorsDataTweakPopupConfig = value;
    },
  );
  bindRuntimeValue(runtime, "propOptionItems", () => propOptionItems);
  bindRuntimeValue(runtime, "isLightHexColor", () => isLightHexColor);
  bindRuntimeValue(runtime, "PropPaletteCards", () => PropPaletteCards);
  bindRuntimeValue(runtime, "propColorEditorKind", () => propColorEditorKind);
  bindRuntimeValue(
    runtime,
    "canonicalPropHexColor",
    () => canonicalPropHexColor,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropEditorsPattern",
    () => ComponentsPropEditorsPattern,
    (value) => {
      ComponentsPropEditorsPattern = value;
    },
  );
  bindRuntimeValue(runtime, "propColorOptionKeys", () => propColorOptionKeys);
  bindRuntimeValue(
    runtime,
    "restorePropColorOption",
    () => restorePropColorOption,
  );
  bindRuntimeValue(
    runtime,
    "designSystemPropColorOptions",
    () => designSystemPropColorOptions,
  );
  bindRuntimeValue(runtime, "PropRangeInput", () => PropRangeInput);
  bindRuntimeValue(runtime, "PropColorInput", () => PropColorInput);
  bindRuntimeValue(
    runtime,
    "ComponentsPropEditors234Config",
    () => ComponentsPropEditors234Config,
    (value) => {
      ComponentsPropEditors234Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "propOptionsFitSegments",
    () => propOptionsFitSegments,
  );
  bindRuntimeValue(runtime, "ComponentPropInput", () => ComponentPropInput);
  return () => {
    ComponentsPropEditorsDataTweakPopupConfig = {
      "data-tweak-popup": "",
    };
    ComponentsPropEditorsPattern =
      /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    ComponentsPropEditors234Config = {
      2: 12,
      3: 7,
      4: 4,
    };
  };
}
