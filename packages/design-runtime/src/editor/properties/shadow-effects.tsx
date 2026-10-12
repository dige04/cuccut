/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesShadowEffects(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesShadowEffectsFromEntriesValue: Dynamic;
  var reactPropertiesShadowEffects: Dynamic;
  function canonicalStyleColor(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.validateStyleColor)(input);
    return typeof value == "string"
      ? value
      : value === true
        ? input.trim().toLowerCase()
        : undefined;
  }
  function setOptionalEffectField(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context !== undefined)
      return {
        ...input,
        [options]: context,
      };
    let { [options]: value, ...value2 }: Dynamic = input ?? {};
    return Object.keys(value2).length === 0 ? undefined : value2;
  }
  function useEffectPopover(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 0,
  ): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactPropertiesStyleBag.useState)(undefined),
      value3: Dynamic =
        options.setOpenEditor !== undefined ? options.openEditor : value,
      value4: Dynamic = options.setOpenEditor ?? value2,
      value5: Dynamic = value3?.key === input && value3.index === context,
      [value6, value7]: Dynamic = (0, runtime.reactPropertiesStyleBag.useState)(
        false,
      ),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        value4(
          (input3?: Dynamic): Dynamic =>
            input2
              ? {
                  key: input,
                  index: context,
                }
              : input3?.key === input && input3.index === context
                ? undefined
                : input3,
        ),
      callback2: Dynamic = (): Dynamic =>
        value4(
          (input2?: Dynamic): Dynamic =>
            input2?.key !== input
              ? input2
              : input2.index === context
                ? undefined
                : input2.index > context
                  ? {
                      key: input,
                      index: input2.index - 1,
                    }
                  : input2,
        ),
      value8: Dynamic = (0, runtime.reactPropertiesStyleBag.useRef)(null);
    return {
      open: value5,
      setOpen: callback,
      removed: callback2,
      byKeyboard: value6,
      setByKeyboard: value7,
      wrapRef: value8,
      anchor: (): Dynamic =>
        value8.current?.closest("[data-property-row]") ?? null,
    };
  }
  function shadowEditorValue(input?: Dynamic, options?: Dynamic): Dynamic {
    return {
      x: (0, runtime.asFiniteStyleNumber)(input.x) ?? 0,
      y: (0, runtime.asFiniteStyleNumber)(input.y) ?? 0,
      blur: (0, runtime.asFiniteStyleNumber)(input.blur) ?? 0,
      ...(options
        ? {
            spread: (0, runtime.asFiniteStyleNumber)(input.spread) ?? 0,
          }
        : {}),
      color: (0, runtime.asStyleString)(input.color) ?? "#000000",
    };
  }
  function normalizeShadowEditorValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let [value2, value3, value4]: Dynamic = runtime.PropertiesStyleBagItems,
      state: Dynamic = {
        x: (0, runtime.clampStyleRangeField)(value2, input.x),
        y: (0, runtime.clampStyleRangeField)(value3, input.y),
        blur: (0, runtime.clampStyleRangeField)(value ?? value4, input.blur),
        color: canonicalStyleColor(input.color) ?? options?.color ?? "#000000",
      };
    context &&
      (state.spread = (0, runtime.clampStyleRangeField)(
        runtime.styleRangeFieldValue,
        input.spread ?? 0,
      ));
    options?.inset === true && (state.inset = true);
    return state;
  }
  function ShadowEffectRow({
    propKey: propKey,
    list: list,
    index: index,
    rec: rec,
    ed: ed2,
    label: label,
  }: Dynamic): Dynamic {
    let {
        open: value,
        setOpen: value2,
        removed: value3,
        byKeyboard: value4,
        setByKeyboard: value5,
        wrapRef: value6,
        anchor: value7,
      }: Dynamic = useEffectPopover(propKey, ed2, index),
      value8: Dynamic = propKey === "boxShadow",
      value9: Dynamic = label ?? (0, runtime.shadowEffectLabel)(propKey, rec),
      value10: Dynamic =
        rec !== undefined ? shadowEditorValue(rec, value8) : undefined,
      value11: Dynamic = (0, runtime.styleRangeField)(
        (0, runtime.shadowFieldBounds)(
          (0, runtime.propertyValidatorForNode)(propKey, ed2.kind),
        ),
        "blur",
        "Blur",
        "len",
        1,
        "px",
      ),
      value12: Dynamic =
        value11.max === PropertiesShadowEffectsFromEntriesValue.blur?.max
          ? PropertiesShadowEffectsFromEntriesValue
          : {
              ...PropertiesShadowEffectsFromEntriesValue,
              blur: {
                min: value11.min,
                max: value11.max,
                step: value11.step,
              },
            },
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value13: Dynamic =
          input === undefined
            ? list.filter(
                (input2?: Dynamic, options?: Dynamic): Dynamic =>
                  options !== index,
              )
            : list.map(
                (input2?: Dynamic, options?: Dynamic): Dynamic =>
                  options === index ? input : input2,
              );
        return value13.length === 0 ? undefined : value13;
      },
      live: Dynamic = ed2.live;
    return (
      <runtime.PropertyTextRow
        label={value9}
        disabled={ed2.disabled}
        title={ed2.whyDisabled}
        trailing={
          <runtime.RemovePropertyButton
            label={value9}
            disabled={ed2.disabled || rec === undefined}
            onClick={(): Dynamic => {
              value3();
              ed2.commit(propKey, callback(undefined));
            }}
          />
        }
      >
        <span ref={value6} className={"relative flex min-w-0 flex-1"}>
          <runtime.PropertyEditorPopover
            open={value && rec !== undefined}
            onOpenChange={value2}
            trigger={
              <runtime.ColorEffectButton
                label={value9}
                color={value10?.color ?? null}
                text={
                  value10 !== undefined
                    ? `${value10.x}, ${value10.y} \xB7 ${value10.blur}px`
                    : "None"
                }
                disabled={ed2.disabled}
                onClick={(input?: Dynamic): Dynamic => {
                  rec === undefined &&
                    ed2.commit(
                      propKey,
                      (0, runtime.propertyDefaultEditorValue)(
                        propKey,
                        ed2.kind,
                      ),
                    );
                  value5(input.detail === 0);
                }}
              />
            }
            anchor={value7}
            focusOnOpen={value4}
          >
            <runtime.ShadowEditor
              title={value9}
              value={value10 ?? shadowEditorValue({}, value8)}
              spread={value8}
              bounds={value12}
              disabled={ed2.disabled}
              swatches={ed2.swatches}
              unifiedPopover={ed2.unifiedColorPopover}
              onChange={(input?: Dynamic): Dynamic =>
                ed2.commit(
                  propKey,
                  callback(
                    normalizeShadowEditorValue(input, rec, value8, value11),
                  ),
                )
              }
              {...(live && ed2.liveEnd
                ? {
                    onLive: (input?: Dynamic): Dynamic =>
                      live(
                        propKey,
                        callback(
                          normalizeShadowEditorValue(
                            input,
                            rec,
                            value8,
                            value11,
                          ),
                        ),
                      ),
                    onLiveEnd: ed2.liveEnd,
                  }
                : {})}
              onClose={(): Dynamic => value2(false)}
            />
          </runtime.PropertyEditorPopover>
        </span>
      </runtime.PropertyTextRow>
    );
  }
  function BlurEffectRow({
    label: label,
    propKey: propKey,
    rec: rec,
    ed: ed2,
  }: Dynamic): Dynamic {
    let value: Dynamic = runtime.PropertiesStyleBagItems_2.find(
        (input?: Dynamic): Dynamic => input.field === "blur",
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        setOptionalEffectField(rec, value.field, input),
      live: Dynamic = ed2.live;
    return (
      <runtime.PropertyNumberRow
        label={label}
        value={(0, runtime.asFiniteStyleNumber)(rec[value.field])}
        placeholder={"0"}
        min={value.min}
        max={value.max}
        step={value.step}
        unit={value.unit}
        disabled={ed2.disabled}
        onValue={(input?: Dynamic): Dynamic =>
          input !== undefined &&
          ed2.commit(
            propKey,
            callback((0, runtime.clampStyleRangeField)(value, input)),
          )
        }
        {...(live && ed2.liveEnd
          ? {
              onScrub: (input?: Dynamic): Dynamic =>
                live(
                  propKey,
                  callback((0, runtime.clampStyleRangeField)(value, input)),
                ),
              onScrubEnd: ed2.liveEnd,
            }
          : {})}
        trailing={
          <runtime.RemovePropertyButton
            label={label}
            disabled={ed2.disabled}
            onClick={(): Dynamic => ed2.commit(propKey, callback(undefined))}
          />
        }
      />
    );
  }
  bindRuntimeValue(runtime, "canonicalStyleColor", () => canonicalStyleColor);
  bindRuntimeValue(
    runtime,
    "setOptionalEffectField",
    () => setOptionalEffectField,
  );
  bindRuntimeValue(runtime, "useEffectPopover", () => useEffectPopover);
  bindRuntimeValue(
    runtime,
    "PropertiesShadowEffectsFromEntriesValue",
    () => PropertiesShadowEffectsFromEntriesValue,
    (value) => {
      PropertiesShadowEffectsFromEntriesValue = value;
    },
  );
  bindRuntimeValue(runtime, "shadowEditorValue", () => shadowEditorValue);
  bindRuntimeValue(
    runtime,
    "normalizeShadowEditorValue",
    () => normalizeShadowEditorValue,
  );
  bindRuntimeValue(runtime, "ShadowEffectRow", () => ShadowEffectRow);
  bindRuntimeValue(runtime, "BlurEffectRow", () => BlurEffectRow);
  bindRuntimeValue(
    runtime,
    "reactPropertiesShadowEffects",
    () => reactPropertiesShadowEffects,
    (value) => {
      reactPropertiesShadowEffects = value;
    },
  );
  return () => {
    PropertiesShadowEffectsFromEntriesValue = Object.fromEntries(
      [...runtime.PropertiesStyleBagItems, runtime.styleRangeFieldValue].map(
        (input?: Dynamic): Dynamic => [
          input.field,
          {
            min: input.min,
            max: input.max,
            step: input.step,
          },
        ],
      ),
    );
    reactPropertiesShadowEffects = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}
