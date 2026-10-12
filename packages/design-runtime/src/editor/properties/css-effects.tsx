/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesCssEffects(
  runtime: RuntimeBindings,
): () => void {
  var ParagraphValue: Dynamic;
  var PropertiesCssEffectsMin: Dynamic;
  var PropertiesCssEffectsBoxShadowTextShadowFilterConfig: Dynamic;
  var PropertiesCssEffectsBoxShadowFilterBackdropFilterValues: Dynamic;
  var PropertiesCssEffectsBoxShadowTextShadowFilterValues: Dynamic;
  var ThisTextAlreadyHasAShadowMessage: Dynamic;
  var NotOnShapesInsideAGraphicMessage: Dynamic;
  var WebkitBackdropFilterValue: Dynamic;
  var PropertiesCssEffectsXYBlurConfig: Dynamic;
  var PropertiesCssEffectsXYBlurConfig_2: Dynamic;
  function useEditorColorSwatches(): Dynamic {
    let { designColorTokens: value }: Dynamic = (0,
    runtime.useInspectorContext)();
    return (0, runtime.reactComponentsPropsPanel.useMemo)(
      (): Dynamic =>
        value.map(
          (input?: Dynamic): Dynamic => ({
            name: input.name,
            value: input.value,
            label: input.name.startsWith("#")
              ? input.name.toUpperCase()
              : input.name,
          }),
        ),
      [value],
    );
  }
  function splitEffectTokens(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0,
      text: Dynamic = "";
    for (let value of input as Dynamic) {
      value === "("
        ? index++
        : value === ")" && (index = Math.max(0, index - 1));
      if (index === 0 && options.test(value)) {
        (text.trim() || context) && items.push(text.trim());
        text = "";
        continue;
      }
      text += value;
    }
    (text.trim() || context) && items.push(text.trim());
    return items;
  }
  function parseCssShadow(input?: Dynamic, options?: Dynamic): Dynamic {
    let flag: Dynamic = false,
      flag2: Dynamic = false,
      items: Dynamic = [],
      items2: Dynamic = [],
      items3: Dynamic = [];
    for (let value7 of splitEffectTokens(input, /\s/) as Dynamic) {
      let value8: Dynamic = (0, runtime.parseCssNumber)(value7);
      if (
        !!value8 &&
        (value8.unit === "px" || (value8.unit === "" && value8.value === 0))
      ) {
        if (flag2 || items.length >= 4) return null;
        items.push(value8.value);
        continue;
      }
      if (value8) return null;
      items.length > 0 && (flag2 = true);
      if (value7.toLowerCase() === "inset") {
        if (flag) return null;
        flag = true;
        continue;
      }
      (items.length === 0 ? items2 : items3).push(value7);
    }
    if (
      items.length < 2 ||
      (items2.length > 0 && items3.length > 0) ||
      (!options && (flag || items.length > 3))
    )
      return null;
    let value: Dynamic = [...items2, ...items3].join(" "),
      value2: Dynamic = (0, runtime.validateStyleColor)(
        value || "currentcolor",
      );
    if (value2 === undefined) return null;
    let [value3, value4, value5 = 0, value6 = 0]: Dynamic = items;
    return !PropertiesCssEffectsMin(
      value3,
      runtime.StyleSchemaShadowXYBlurConfig.x,
    ) ||
      !PropertiesCssEffectsMin(
        value4,
        runtime.StyleSchemaShadowXYBlurConfig.y,
      ) ||
      !PropertiesCssEffectsMin(
        value5,
        runtime.StyleSchemaShadowXYBlurConfig.blur,
      ) ||
      !PropertiesCssEffectsMin(
        value6,
        runtime.StyleSchemaShadowXYBlurConfig.spread,
      )
      ? null
      : options
        ? flag
          ? {
              x: value3,
              y: value4,
              blur: value5,
              spread: value6,
              inset: true,
              color: value2,
            }
          : {
              x: value3,
              y: value4,
              blur: value5,
              spread: value6,
              color: value2,
            }
        : {
            x: value3,
            y: value4,
            blur: value5,
            color: value2,
          };
  }
  function parseCssShadows(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    if (!value || value === "none") return [];
    if ((0, runtime.classifyStyleValue)(value).kind !== "literal") return null;
    let value2: Dynamic = splitEffectTokens(value, /,/, true);
    if (value2.length === 0 || value2.length > runtime.StyleSchemaValuesLimit)
      return null;
    let items: Dynamic = [];
    for (let value3 of value2 as Dynamic) {
      let value4: Dynamic =
        value3 === "" ? null : parseCssShadow(value3, options);
      if (!value4) return null;
      items.push(value4);
    }
    return items;
  }
  function parseCssBlur(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    if (!value || value === "none") return {};
    if ((0, runtime.classifyStyleValue)(value).kind !== "literal") return null;
    let value2: Dynamic = /^blur\(\s*([^)]+)\)$/i.exec(value);
    if (!value2) return null;
    let value3: Dynamic = (0, runtime.parseCssNumber)(value2[1].trim());
    return !value3 ||
      !(value3.unit === "px" || (value3.unit === "" && value3.value === 0)) ||
      !PropertiesCssEffectsMin(value3.value, runtime.styleFieldBoundsValue.blur)
      ? null
      : {
          blur: value3.value,
        };
  }
  function parseCssFilters(input?: Dynamic): Dynamic {
    if (/[^\S \t\n\r\f]/.test(input ?? "")) return null;
    let value: Dynamic = (input ?? "").trim();
    if (!value || value === "none")
      return {
        shadows: [],
        filter: {},
      };
    if ((0, runtime.classifyStyleValue)(value).kind !== "literal") return null;
    let items: Dynamic = [],
      value2: Dynamic = splitEffectTokens(value, /\s/);
    for (let [value3, value4] of value2.entries() as Dynamic) {
      let value5: Dynamic = /^drop-shadow\(([\s\S]*)\)$/i.exec(value4);
      if (!value5) {
        let value7: Dynamic =
          value3 === value2.length - 1 ? parseCssBlur(value4) : null;
        return value7?.blur === undefined
          ? null
          : {
              shadows: items,
              filter: value7,
            };
      }
      let value6: Dynamic =
        items.length < runtime.StyleSchemaValuesLimit
          ? parseCssShadow(value5[1], false)
          : null;
      if (!value6) return null;
      items.push(value6);
    }
    return {
      shadows: items,
      filter: {},
    };
  }
  function serializeEffectValue(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options === undefined) return null;
    let value: Dynamic = (0, runtime.styleObjectToCss)(
      {
        [input]: options,
      },
      ParagraphValue,
    )[input];
    return value === undefined || value === "none" ? null : String(value);
  }
  function serializeDropShadowFilters(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (Array.isArray(input) ? input : []).map(
      (input2?: Dynamic): Dynamic =>
        serializeEffectValue("textShadow", [input2]),
    );
    if (value.some((input2?: Dynamic): Dynamic => input2 === null)) return [];
    let value2: Dynamic = serializeEffectValue("filter", options),
      items: Dynamic = [
        ...value.map((input2?: Dynamic): Dynamic => `drop-shadow(${input2})`),
        ...(value2 !== null ? [value2] : []),
      ];
    return [
      {
        prop: "filter",
        value: items.length > 0 ? items.join(" ") : null,
      },
    ];
  }
  function CssEffectsSection({
    rows: rows,
    shadowTarget = "box",
    dropShadowReason: dropShadowReason,
    onCommitMany: onCommitMany,
    renderRows: renderRows,
    addItemsFor: addItemsFor,
    fallback: fallback,
  }: Dynamic): Dynamic {
    let value: Dynamic = useEditorColorSwatches(),
      entries: Dynamic = new Map(
        rows.map((input?: Dynamic): Dynamic => [input.prop, input]),
      ),
      value2: Dynamic = shadowTarget === "text",
      value3: Dynamic = shadowTarget === "shape",
      entry: Dynamic = entries.get("box-shadow"),
      entry2: Dynamic = entries.get("text-shadow"),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        !!input && (input.mixed === true || input.varSource !== undefined),
      value4: Dynamic =
        value3 && !callback(entries.get("filter"))
          ? parseCssFilters(entries.get("filter")?.value)
          : null,
      state: Dynamic = {
        boxShadow: value3
          ? []
          : callback(entry)
            ? null
            : parseCssShadows(entry?.value, true),
        filter: value3
          ? (value4?.filter ?? null)
          : callback(entries.get("filter"))
            ? null
            : parseCssBlur(entries.get("filter")?.value),
        backdropFilter: value3
          ? {}
          : callback(entries.get("backdrop-filter"))
            ? null
            : parseCssBlur(entries.get("backdrop-filter")?.value),
        textShadow: value3
          ? (value4?.shadows ?? null)
          : callback(entry2)
            ? null
            : parseCssShadows(entry2?.value, false),
      },
      value5: Dynamic = state.textShadow === null,
      value6: Dynamic = (value2 || value3) && !value5,
      value7: Dynamic = value6
        ? PropertiesCssEffectsBoxShadowTextShadowFilterValues
        : PropertiesCssEffectsBoxShadowFilterBackdropFilterValues,
      value8: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => onCommitMany(input),
      ),
      value9: Dynamic = (0, runtime.reactComponentsPropsPanel.useRef)({}),
      [value10, value11]: Dynamic = (0,
      runtime.reactComponentsPropsPanel.useState)(undefined),
      value12: Dynamic = value10?.key === "textShadow",
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        value11(
          (input2?: Dynamic): Dynamic =>
            input
              ? {
                  key: "textShadow",
                  index: 0,
                }
              : input2?.key === "textShadow"
                ? undefined
                : input2,
        );
    if (
      state.boxShadow === null ||
      state.filter === null ||
      state.backdropFilter === null
    )
      return (
        <runtime.jsxPropertiesLiveScrub.Fragment>
          {fallback}
        </runtime.jsxPropertiesLiveScrub.Fragment>
      );
    let value13: Dynamic =
        !value6 && (state.textShadow === null || state.textShadow.length > 1),
      state2: Dynamic = {
        ...(state.boxShadow.length > 0
          ? {
              boxShadow: state.boxShadow,
            }
          : {}),
        ...(value6 && state.textShadow && state.textShadow.length > 0
          ? {
              textShadow: state.textShadow,
            }
          : {}),
        ...(state.filter.blur !== undefined
          ? {
              filter: state.filter,
            }
          : {}),
        ...(state.backdropFilter.blur !== undefined
          ? {
              backdropFilter: state.backdropFilter,
            }
          : {}),
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let items2: Dynamic = [],
          value16: Dynamic = state2,
          value17: Dynamic = input ?? {},
          callback7: Dynamic = (input2?: Dynamic): Dynamic =>
            !(0, runtime.equalStyleBags)(
              value17[input2],
              input2 in value9.current
                ? value9.current[input2]
                : value16[input2],
            );
        for (let value18 of value7 as Dynamic) {
          if (
            !callback7(value18) ||
            (value3 && (value18 === "textShadow" || value18 === "filter"))
          )
            continue;
          let value19: Dynamic = serializeEffectValue(
            value18,
            value17[value18],
          );
          items2.push({
            prop: PropertiesCssEffectsBoxShadowTextShadowFilterConfig[value18],
            value: value19,
          });
          value18 === "backdropFilter" &&
            items2.push({
              prop: WebkitBackdropFilterValue,
              value: value19,
            });
        }
        value3 &&
          (callback7("textShadow") || callback7("filter")) &&
          items2.push(
            ...serializeDropShadowFilters(value17.textShadow, value17.filter),
          );
        return items2;
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        (input.value ?? "").trim().toLowerCase() === "none",
      callback5: Dynamic = (input?: Dynamic): Dynamic =>
        value3 &&
        ["box-shadow", "backdrop-filter", "text-shadow"].includes(input.prop),
      value14: Dynamic = rows.filter(
        (input?: Dynamic): Dynamic =>
          callback5(input)
            ? !!input.value || input.mixed === true
            : ["box-shadow", "filter", "backdrop-filter"].includes(input.prop)
              ? callback4(input)
              : input.prop === "text-shadow"
                ? value13 || callback4(input)
                : true,
      ),
      value15: Dynamic = value6 || value13 ? undefined : state.textShadow?.[0],
      callback6: Dynamic = (input?: Dynamic): Dynamic => {
        let value16: Dynamic = input
          ? serializeEffectValue("textShadow", [input])
          : null;
        (input && value16 === null) ||
          onCommitMany([
            {
              prop: "text-shadow",
              value: value16,
            },
          ]);
      },
      items: Dynamic = [
        ...(entry2 && !value2 && !value3 && !value13 && !value15
          ? [
              {
                label: "Text shadow",
                disabled: entry2.disabled,
                disabledReason: entry2.disabled
                  ? entry2.whyDisabled
                  : undefined,
                onSelect: (): Dynamic => {
                  callback2(true);
                  callback6(PropertiesCssEffectsXYBlurConfig);
                },
              },
            ]
          : []),
        ...addItemsFor(value14),
      ];
    return (
      <runtime.EffectsSection
        kind={ParagraphValue}
        bag={state2}
        shadowTarget={value3 ? "text" : shadowTarget}
        silhouette={value3}
        silhouetteReason={value3 ? NotOnShapesInsideAGraphicMessage : undefined}
        dropShadowDisabledReason={
          dropShadowReason ??
          (value2 && value5 ? ThisTextAlreadyHasAShadowMessage : undefined)
        }
        openEditor={value10}
        setOpenEditor={value11}
        unifiedColorPopover={true}
        swatches={value}
        onCommit={(input?: Dynamic): Dynamic => {
          let value16: Dynamic = callback3(input);
          value9.current = {};
          value16.length > 0 && onCommitMany(value16);
        }}
        onLive={(input?: Dynamic): Dynamic => {
          let value16: Dynamic = callback3(input);
          for (let value17 of value7 as Dynamic)
            value9.current[value17] = input?.[value17];
          value16.length > 0 && value8.onScrub(value16);
        }}
        onLiveEnd={(): Dynamic => {
          value9.current = {};
          value8.onScrubEnd();
        }}
        addItems={items}
      >
        {entry2 && value15 !== undefined && (
          <runtime.DropShadowEditor
            value={value15}
            open={value12}
            onOpenChange={callback2}
            disabled={entry2.disabled}
            onChange={callback6}
            onLive={(input?: Dynamic): Dynamic => {
              let value16: Dynamic = serializeEffectValue("textShadow", [
                  input,
                ]),
                value17: Dynamic =
                  "textShadow" in value9.current
                    ? value9.current.textShadow
                    : (entry2.value ?? null);
              value9.current.textShadow = value16;
              value16 !== null &&
                value16 !== value17 &&
                value8.onScrub([
                  {
                    prop: "text-shadow",
                    value: value16,
                  },
                ]);
            }}
            onLiveEnd={(): Dynamic => {
              value9.current = {};
              value8.onScrubEnd();
            }}
          />
        )}
        {renderRows(value14)}
      </runtime.EffectsSection>
    );
  }
  bindRuntimeValue(
    runtime,
    "useEditorColorSwatches",
    () => useEditorColorSwatches,
  );
  bindRuntimeValue(
    runtime,
    "ParagraphValue",
    () => ParagraphValue,
    (value) => {
      ParagraphValue = value;
    },
  );
  bindRuntimeValue(runtime, "splitEffectTokens", () => splitEffectTokens);
  bindRuntimeValue(
    runtime,
    "PropertiesCssEffectsMin",
    () => PropertiesCssEffectsMin,
    (value) => {
      PropertiesCssEffectsMin = value;
    },
  );
  bindRuntimeValue(runtime, "parseCssShadow", () => parseCssShadow);
  bindRuntimeValue(runtime, "parseCssShadows", () => parseCssShadows);
  bindRuntimeValue(runtime, "parseCssBlur", () => parseCssBlur);
  bindRuntimeValue(runtime, "parseCssFilters", () => parseCssFilters);
  bindRuntimeValue(
    runtime,
    "PropertiesCssEffectsBoxShadowTextShadowFilterConfig",
    () => PropertiesCssEffectsBoxShadowTextShadowFilterConfig,
    (value) => {
      PropertiesCssEffectsBoxShadowTextShadowFilterConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesCssEffectsBoxShadowFilterBackdropFilterValues",
    () => PropertiesCssEffectsBoxShadowFilterBackdropFilterValues,
    (value) => {
      PropertiesCssEffectsBoxShadowFilterBackdropFilterValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesCssEffectsBoxShadowTextShadowFilterValues",
    () => PropertiesCssEffectsBoxShadowTextShadowFilterValues,
    (value) => {
      PropertiesCssEffectsBoxShadowTextShadowFilterValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisTextAlreadyHasAShadowMessage",
    () => ThisTextAlreadyHasAShadowMessage,
    (value) => {
      ThisTextAlreadyHasAShadowMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotOnShapesInsideAGraphicMessage",
    () => NotOnShapesInsideAGraphicMessage,
    (value) => {
      NotOnShapesInsideAGraphicMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WebkitBackdropFilterValue",
    () => WebkitBackdropFilterValue,
    (value) => {
      WebkitBackdropFilterValue = value;
    },
  );
  bindRuntimeValue(runtime, "serializeEffectValue", () => serializeEffectValue);
  bindRuntimeValue(
    runtime,
    "serializeDropShadowFilters",
    () => serializeDropShadowFilters,
  );
  bindRuntimeValue(runtime, "CssEffectsSection", () => CssEffectsSection);
  bindRuntimeValue(
    runtime,
    "PropertiesCssEffectsXYBlurConfig",
    () => PropertiesCssEffectsXYBlurConfig,
    (value) => {
      PropertiesCssEffectsXYBlurConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesCssEffectsXYBlurConfig_2",
    () => PropertiesCssEffectsXYBlurConfig_2,
    (value) => {
      PropertiesCssEffectsXYBlurConfig_2 = value;
    },
  );
  return () => {
    ParagraphValue = "paragraph";
    PropertiesCssEffectsMin = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input >= options.min &&
      input <= options.max &&
      Math.round(input * 10) / 10 === input;
    PropertiesCssEffectsBoxShadowTextShadowFilterConfig = {
      boxShadow: "box-shadow",
      textShadow: "text-shadow",
      filter: "filter",
      backdropFilter: "backdrop-filter",
    };
    PropertiesCssEffectsBoxShadowFilterBackdropFilterValues = [
      "boxShadow",
      "filter",
      "backdropFilter",
    ];
    PropertiesCssEffectsBoxShadowTextShadowFilterValues = [
      "boxShadow",
      "textShadow",
      "filter",
      "backdropFilter",
    ];
    ThisTextAlreadyHasAShadowMessage =
      "This text already has a shadow that can't be edited here";
    NotOnShapesInsideAGraphicMessage = "Not on shapes inside a graphic";
    WebkitBackdropFilterValue = "-webkit-backdrop-filter";
    PropertiesCssEffectsXYBlurConfig = {
      x: 0,
      y: 1,
      blur: 3,
      color: "#00000033",
    };
    PropertiesCssEffectsXYBlurConfig_2 = {
      x: {
        ...runtime.StyleSchemaShadowXYBlurConfig.x,
        step: 1,
      },
      y: {
        ...runtime.StyleSchemaShadowXYBlurConfig.y,
        step: 1,
      },
      blur: {
        ...runtime.StyleSchemaShadowXYBlurConfig.blur,
        step: 1,
      },
    };
  };
}
