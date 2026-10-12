/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPropertiesStyleBag(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesStyleBag: Dynamic;
  var jsxPropertiesStyleBag: Dynamic;
  var PropertiesStyleBagBorderWidthBorderRadiusConfig: Dynamic;
  var PropertiesStyleBagItems: Dynamic;
  var styleRangeFieldValue: Dynamic;
  var PropertiesStyleBagItems_2: Dynamic;
  var PropertiesStyleBagItems_3: Dynamic;
  var PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig: Dynamic;
  var PropertiesStyleBagFilterBackdropFilterConfig: Dynamic;
  var PropertiesStyleBagConstant: Dynamic;
  var InnerShadowNeedsAFillOrMessage: Dynamic;
  var NotOnDiamondOrArrowShapesMessage: Dynamic;
  function styleValidatorKind(source?: Dynamic): Dynamic {
    let kind: Dynamic = source.kind;
    return typeof kind == "string" ? kind : "";
  }
  function styleFiniteField(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input[options];
    return typeof value == "number" && Number.isFinite(value) ? value : context;
  }
  function styleStringListField(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input[options];
    return Array.isArray(value)
      ? value.filter((input2?: Dynamic): Dynamic => typeof input2 == "string")
      : [];
  }
  function propertyValidatorForNode(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = runtime.styleSchema[input];
    return options === "slides-shape" && value.shapeValue !== undefined
      ? value.shapeValue
      : options.startsWith("slides-") && value.slidesValue !== undefined
        ? value.slidesValue
        : value.value;
  }
  function setStyleBagValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return {
      ...input,
      [options]: context,
    };
  }
  function removeStyleBagValue(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input === undefined) return;
    let { [options]: value, ...value2 }: Dynamic = input;
    return Object.keys(value2).length === 0 ? undefined : value2;
  }
  function replaceStyleBagValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input;
    for (let value2 of (PropertiesStyleBagBorderWidthBorderRadiusConfig[
      options
    ] ?? []) as Dynamic)
      value = removeStyleBagValue(value, value2);
    return context === undefined
      ? removeStyleBagValue(value, options)
      : setStyleBagValue(value, options, context);
  }
  function propertyResetPatch(input?: Dynamic, options?: Dynamic): Dynamic {
    let state: Dynamic = {};
    for (let value of (PropertiesStyleBagBorderWidthBorderRadiusConfig[input] ??
      []) as Dynamic)
      state[value] = undefined;
    state[input] = options;
    return state;
  }
  function normalizeNegativeZero(input?: Dynamic): Dynamic {
    return input === 0 ? 0 : input;
  }
  function clampStyleField(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = styleValidatorKind(input),
      value2: Dynamic = styleFiniteField(input, "lo", -1e9),
      value3: Dynamic = styleFiniteField(input, "hi", 1e9),
      value4: Dynamic = Number.isFinite(options) ? options : value2;
    if (value === "int") {
      let value5: Dynamic = Math.max(1e-9, styleFiniteField(input, "step", 1));
      value4 = Math.round(value4 / value5) * value5;
    }
    value4 = Math.min(value3, Math.max(value2, value4));
    value === "len"
      ? (value4 = Math.round(value4 * 10) / 10)
      : value === "num" && (value4 = Math.round(value4 * 1e4) / 1e4);
    return normalizeNegativeZero(value4);
  }
  function numericStyleValidator(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return {
      kind: input,
      lo: options,
      hi: context,
    };
  }
  function styleRangeField(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input[options];
    if (value2 === undefined)
      throw new Error(`style panel: no validator range for field ${options}`);
    return detail === undefined
      ? {
          field: options,
          label: context,
          min: value2.min,
          max: value2.max,
          step: extra,
          kind: value,
        }
      : {
          field: options,
          label: context,
          min: value2.min,
          max: value2.max,
          step: extra,
          unit: detail,
          kind: value,
        };
  }
  function clampStyleRangeField(source?: Dynamic, options?: Dynamic): Dynamic {
    return clampStyleField(
      numericStyleValidator(source.kind, source.min, source.max),
      options,
    );
  }
  function propertyDefaultEditorValue(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = propertyValidatorForNode(input, options);
    switch (styleValidatorKind(value)) {
      case "len":
      case "num":
      case "int": {
        let value2: Dynamic = styleFiniteField(value, "lo", 0),
          value3: Dynamic = styleFiniteField(value, "hi", 100);
        return clampStyleField(value, value2 + (value3 - value2) / 2);
      }
      case "enum":
        return styleStringListField(value, "values")[0];
      case "color":
        return "#445566";
      case "fontFamily":
        return "sans";
      case "str":
        return "sample";
      case "size":
        return {
          px: 240,
        };
      case "shadow":
        return [defaultShadowValue(input, false)];
      case "gradient":
        return {
          angle: 180,
          stops: [
            {
              color: "#ffffff",
              pos: 0,
            },
            {
              color: "#000000",
              pos: 100,
            },
          ],
        };
      case "filter":
        return {
          blur: 0,
        };
      case "transform":
        return {
          rotate: 0,
        };
      default:
        return;
    }
  }
  function defaultShadowValue(input?: Dynamic, options?: Dynamic): Dynamic {
    return input !== "boxShadow"
      ? {
          x: 0,
          y: 1,
          blur: 3,
          color: "#00000033",
        }
      : options
        ? {
            x: 0,
            y: 1,
            blur: 2,
            spread: 0,
            inset: true,
            color: "#00000033",
          }
        : {
            x: 0,
            y: 2,
            blur: 8,
            spread: 0,
            color: "#00000033",
          };
  }
  function ownStyleBagValue(input?: Dynamic, options?: Dynamic): Dynamic {
    return input !== undefined && Object.hasOwn(input, options)
      ? input[options]
      : undefined;
  }
  function asFiniteStyleNumber(input?: Dynamic): Dynamic {
    return typeof input == "number" && Number.isFinite(input)
      ? input
      : undefined;
  }
  function asStyleString(input?: Dynamic): Dynamic {
    return typeof input == "string" ? input : undefined;
  }
  function asStyleRecord(input?: Dynamic): Dynamic {
    return input !== null && typeof input == "object" && !Array.isArray(input)
      ? input
      : undefined;
  }
  function styleRecordList(input?: Dynamic): Dynamic {
    return (
      Array.isArray(input) ? input : input === undefined ? [] : [input]
    ).flatMap(
      (input2?: Dynamic): Dynamic =>
        asStyleRecord(input2) !== undefined ? [input2] : [],
    );
  }
  function shadowEffectLabel(input?: Dynamic, options?: Dynamic): Dynamic {
    return input === "boxShadow" && asStyleRecord(options)?.inset === true
      ? "Inner shadow"
      : propertyEffectLabel(input);
  }
  function propertyEffectLabel(input?: Dynamic): Dynamic {
    let value: Dynamic = Object.hasOwn(
      PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig,
      input,
    )
      ? PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig[
          input
        ]
      : undefined;
    if (value !== undefined) return value;
    let value2: Dynamic = input
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase();
    return value2.charAt(0).toUpperCase() + value2.slice(1);
  }
  function equalStyleBags(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input === options) return true;
    if (
      input === null ||
      options === null ||
      typeof input != "object" ||
      typeof options != "object"
    )
      return false;
    let value: Dynamic = Array.isArray(input);
    if (value !== Array.isArray(options)) return false;
    if (value) {
      let value5: Dynamic = input,
        value6: Dynamic = options;
      return (
        value5.length === value6.length &&
        value5.every(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            equalStyleBags(input2, value6[options2]),
        )
      );
    }
    let value2: Dynamic = input,
      value3: Dynamic = options,
      value4: Dynamic = Object.keys(value2);
    return (
      value4.length === Object.keys(value3).length &&
      value4.every(
        (input2?: Dynamic): Dynamic =>
          Object.hasOwn(value3, input2) &&
          equalStyleBags(value2[input2], value3[input2]),
      )
    );
  }
  function changedStyleBag(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = replaceStyleBagValue(input, options, context);
    return equalStyleBags(value, input)
      ? undefined
      : {
          next: value,
        };
  }
  function createStyleBagEditor({
    kind: kind,
    bag: bag,
    onCommit: onCommit,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    disabled: disabled2 = false,
    disabledKeys: disabledKeys,
    swatches: swatches,
    clearKeys: clearKeys,
    mixedKeys: mixedKeys,
    unifiedColorPopover = false,
  }: Dynamic): Dynamic {
    return {
      kind: kind,
      bag: bag,
      disabled: disabled2,
      disabledKeys: disabledKeys,
      swatches: swatches,
      clearKeys: clearKeys,
      mixedKeys: mixedKeys,
      unifiedColorPopover: unifiedColorPopover,
      clear: (input?: Dynamic): Dynamic => {
        let value: Dynamic = bag,
          state: Dynamic = {};
        for (let value2 of input as Dynamic) {
          value = replaceStyleBagValue(value, value2, undefined);
          state = {
            ...state,
            ...propertyResetPatch(value2, undefined),
          };
        }
        (!equalStyleBags(value, bag) ||
          input.some((input2?: Dynamic): Dynamic => mixedKeys?.has(input2))) &&
          onCommit(value, state);
      },
      commit: (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value: Dynamic = changedStyleBag(bag, input, options);
        value
          ? onCommit(value.next, propertyResetPatch(input, options))
          : mixedKeys?.has(input) &&
            onCommit(bag, propertyResetPatch(input, options));
      },
      live: onLive
        ? (input?: Dynamic, options?: Dynamic): Dynamic =>
            onLive(
              replaceStyleBagValue(bag, input, options),
              propertyResetPatch(input, options),
            )
        : undefined,
      liveEnd: onLiveEnd,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactPropertiesStyleBag",
    () => reactPropertiesStyleBag,
    (value) => {
      reactPropertiesStyleBag = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesStyleBag",
    () => jsxPropertiesStyleBag,
    (value) => {
      jsxPropertiesStyleBag = value;
    },
  );
  bindRuntimeValue(runtime, "styleValidatorKind", () => styleValidatorKind);
  bindRuntimeValue(runtime, "styleFiniteField", () => styleFiniteField);
  bindRuntimeValue(runtime, "styleStringListField", () => styleStringListField);
  bindRuntimeValue(
    runtime,
    "propertyValidatorForNode",
    () => propertyValidatorForNode,
  );
  bindRuntimeValue(runtime, "setStyleBagValue", () => setStyleBagValue);
  bindRuntimeValue(runtime, "removeStyleBagValue", () => removeStyleBagValue);
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagBorderWidthBorderRadiusConfig",
    () => PropertiesStyleBagBorderWidthBorderRadiusConfig,
    (value) => {
      PropertiesStyleBagBorderWidthBorderRadiusConfig = value;
    },
  );
  bindRuntimeValue(runtime, "replaceStyleBagValue", () => replaceStyleBagValue);
  bindRuntimeValue(runtime, "propertyResetPatch", () => propertyResetPatch);
  bindRuntimeValue(
    runtime,
    "normalizeNegativeZero",
    () => normalizeNegativeZero,
  );
  bindRuntimeValue(runtime, "clampStyleField", () => clampStyleField);
  bindRuntimeValue(
    runtime,
    "numericStyleValidator",
    () => numericStyleValidator,
  );
  bindRuntimeValue(runtime, "styleRangeField", () => styleRangeField);
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagItems",
    () => PropertiesStyleBagItems,
    (value) => {
      PropertiesStyleBagItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "styleRangeFieldValue",
    () => styleRangeFieldValue,
    (value) => {
      styleRangeFieldValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagItems_2",
    () => PropertiesStyleBagItems_2,
    (value) => {
      PropertiesStyleBagItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagItems_3",
    () => PropertiesStyleBagItems_3,
    (value) => {
      PropertiesStyleBagItems_3 = value;
    },
  );
  bindRuntimeValue(runtime, "clampStyleRangeField", () => clampStyleRangeField);
  bindRuntimeValue(
    runtime,
    "propertyDefaultEditorValue",
    () => propertyDefaultEditorValue,
  );
  bindRuntimeValue(runtime, "defaultShadowValue", () => defaultShadowValue);
  bindRuntimeValue(runtime, "ownStyleBagValue", () => ownStyleBagValue);
  bindRuntimeValue(runtime, "asFiniteStyleNumber", () => asFiniteStyleNumber);
  bindRuntimeValue(runtime, "asStyleString", () => asStyleString);
  bindRuntimeValue(runtime, "asStyleRecord", () => asStyleRecord);
  bindRuntimeValue(runtime, "styleRecordList", () => styleRecordList);
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig",
    () =>
      PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig,
    (value) => {
      PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig =
        value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagFilterBackdropFilterConfig",
    () => PropertiesStyleBagFilterBackdropFilterConfig,
    (value) => {
      PropertiesStyleBagFilterBackdropFilterConfig = value;
    },
  );
  bindRuntimeValue(runtime, "shadowEffectLabel", () => shadowEffectLabel);
  bindRuntimeValue(runtime, "propertyEffectLabel", () => propertyEffectLabel);
  bindRuntimeValue(runtime, "equalStyleBags", () => equalStyleBags);
  bindRuntimeValue(runtime, "changedStyleBag", () => changedStyleBag);
  bindRuntimeValue(runtime, "createStyleBagEditor", () => createStyleBagEditor);
  bindRuntimeValue(
    runtime,
    "PropertiesStyleBagConstant",
    () => PropertiesStyleBagConstant,
    (value) => {
      PropertiesStyleBagConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InnerShadowNeedsAFillOrMessage",
    () => InnerShadowNeedsAFillOrMessage,
    (value) => {
      InnerShadowNeedsAFillOrMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotOnDiamondOrArrowShapesMessage",
    () => NotOnDiamondOrArrowShapesMessage,
    (value) => {
      NotOnDiamondOrArrowShapesMessage = value;
    },
  );
  return () => {
    reactPropertiesStyleBag = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxPropertiesStyleBag = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesStyleBagBorderWidthBorderRadiusConfig = {
      borderWidth: [
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
      ],
      borderRadius: [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
      ],
    };
    PropertiesStyleBagItems = [
      styleRangeField(
        runtime.StyleSchemaShadowXYBlurConfig,
        "x",
        "X",
        "len",
        1,
        "px",
      ),
      styleRangeField(
        runtime.StyleSchemaShadowXYBlurConfig,
        "y",
        "Y",
        "len",
        1,
        "px",
      ),
      styleRangeField(
        runtime.StyleSchemaShadowXYBlurConfig,
        "blur",
        "Blur",
        "len",
        1,
        "px",
      ),
    ];
    styleRangeFieldValue = styleRangeField(
      runtime.StyleSchemaShadowXYBlurConfig,
      "spread",
      "Spread",
      "len",
      1,
      "px",
    );
    PropertiesStyleBagItems_2 = [
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "blur",
        "Blur",
        "len",
        0.5,
        "px",
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "brightness",
        "Brightness",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "contrast",
        "Contrast",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "saturate",
        "Saturate",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "grayscale",
        "Grayscale",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "sepia",
        "Sepia",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "invert",
        "Invert",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue,
        "hueRotate",
        "Hue",
        "num",
        1,
        "\xB0",
      ),
    ];
    PropertiesStyleBagItems_3 = [
      styleRangeField(
        runtime.styleFieldBoundsValue_2,
        "translateX",
        "Move X",
        "len",
        1,
        "px",
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue_2,
        "translateY",
        "Move Y",
        "len",
        1,
        "px",
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue_2,
        "scale",
        "Scale",
        "num",
        0.05,
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue_2,
        "rotate",
        "Rotate",
        "num",
        1,
        "\xB0",
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue_2,
        "skewX",
        "Skew X",
        "num",
        1,
        "\xB0",
      ),
      styleRangeField(
        runtime.styleFieldBoundsValue_2,
        "skewY",
        "Skew Y",
        "num",
        1,
        "\xB0",
      ),
    ];
    PropertiesStyleBagTextAlignTextDecorationLineTextDecorationStyleConfig = {
      textAlign: "Align",
      textDecorationLine: "Decoration",
      textDecorationStyle: "Line style",
      textDecorationColor: "Line color",
      textTransform: "Case",
      fontFamily: "Family",
      fontVariantNumeric: "Numerals",
      letterSpacing: "Letter space",
      textStrokeWidth: "Stroke width",
      textStrokeColor: "Stroke color",
      backgroundColor: "Background",
      backgroundGradient: "Gradient",
      boxShadow: "Drop shadow",
      backdropFilter: "Backdrop",
      mixBlendMode: "Blend mode",
    };
    PropertiesStyleBagFilterBackdropFilterConfig = {
      filter: "Layer blur",
      backdropFilter: "Background blur",
    };
    PropertiesStyleBagConstant = 4;
    InnerShadowNeedsAFillOrMessage =
      "Inner shadow needs a fill or border on this text";
    NotOnDiamondOrArrowShapesMessage = "Not on diamond or arrow shapes";
  };
}
