/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  AnimatableStyleProperty,
  AnimationDirectionValue,
  AnimationKeyframe,
  AnimationStyle,
  AnimationValue,
  BlendModeValue,
  BorderSidesValue,
  BorderStyleValue,
  CssSizeValue,
  CursorValue,
  DisplayValue,
  EasingValue,
  FilterValue,
  FloatValue,
  FontFamilyFallback,
  FontFamilyValue,
  FontStyleValue,
  FontVariantNumericValue,
  GradientStop,
  GradientValue,
  HoverStyle,
  OverflowValue,
  PointerEventsValue,
  PositionValue,
  RadialGradientExtent,
  ShadowValue,
  StyleBag,
  StylePropertyName,
  TextAlignValue,
  TextDecorationLineValue,
  TextDecorationStyleValue,
  TextTransformValue,
  TransformValue,
  TransitionValue,
  VisibilityValue,
} from "../deck-contracts";

/** A plain (non-array) object read off untrusted style input. */
export type RawRecord = Record<string, unknown>;
/** A style bag under construction; cast to the typed bag once it is complete. */
type StyleBuilder = Record<string, unknown>;
/** Node kind the style schema distinguishes: document nodes (`table` ...) and `slides-*` kinds. */
export type StyleNodeKind = string;
export type NodeKindList = readonly StyleNodeKind[];

/** Numeric value schemas: `len` rounds to 0.1, `num` to 1e-4, `int` snaps to `step`. */
export interface LengthSchema {
  kind: "len";
  lo: number;
  hi: number;
}
export interface NumberSchema {
  kind: "num";
  lo: number;
  hi: number;
}
export interface IntegerSchema {
  kind: "int";
  lo: number;
  hi: number;
  step: number;
}
export type NumericSchema = LengthSchema | NumberSchema | IntegerSchema;
export interface EnumSchema {
  kind: "enum";
  values: readonly string[];
}
export interface ColorSchema {
  kind: "color";
}
export interface ShadowSchema {
  kind: "shadow";
  /** Whether `spread` and `inset` are allowed (box shadows). */
  spread: boolean;
  blur?: NumericSchema;
}
export interface GradientSchema {
  kind: "gradient";
  repeat?: boolean;
}
/** Value kinds whose schema carries no parameters. */
export interface KindOnlySchema {
  kind:
    | "fontFamily"
    | "filter"
    | "transform"
    | "size"
    | "transition"
    | "animation";
}
export type StyleValueSchema =
  | NumericSchema
  | EnumSchema
  | ColorSchema
  | ShadowSchema
  | GradientSchema
  | KindOnlySchema;
/** One numeric field of a filter or transform value. */
export interface StyleComponentSchema<F extends string = string> {
  field: F;
  cls: NumericSchema;
}
/** A filter field also names its CSS function and unit. */
export interface FilterComponentSchema
  extends StyleComponentSchema<keyof FilterValue> {
  fn: string;
  unit: string;
}
export type TransformComponentSchema = StyleComponentSchema<keyof TransformValue>;
export interface NumericBounds {
  min: number;
  max: number;
}
export type ShadowBounds = Record<"x" | "y" | "blur" | "spread", NumericBounds>;
export type FilterBounds = Record<keyof FilterValue, NumericBounds>;
export type TransformBounds = Record<keyof TransformValue, NumericBounds>;

/** Declarative definition of one style property. */
export interface StylePropertyDefinition {
  /** Schema for document nodes. */
  v: StyleValueSchema;
  /** Schema override for `slides-*` nodes. */
  slides?: StyleValueSchema;
  /** Schema override for `slides-shape`. */
  shape?: StyleValueSchema;
  /** Node kinds the property applies to. */
  on: NodeKindList;
  /** Node kinds that store the property outside the style bag. */
  routed?: NodeKindList;
}
export type StylePropertyDefinitions = Record<
  StylePropertyName,
  StylePropertyDefinition
>;
export interface StylePropertyRegistryEntry {
  value: StyleValueSchema;
  slidesValue: StyleValueSchema | undefined;
  shapeValue: StyleValueSchema | undefined;
  applies: NodeKindList;
  routed: NodeKindList;
  effect: boolean;
  hover: boolean;
  animatable: boolean;
}
/** Registry of every known style property; unvalidated names resolve to undefined. */
export interface StylePropertyRegistry
  extends Record<StylePropertyName, StylePropertyRegistryEntry> {
  [name: string]: StylePropertyRegistryEntry | undefined;
}
/** Any value a normalised style property can hold. */
export type StyleValue = NonNullable<StyleBag[StylePropertyName]>;
/** Result of normalising a style object: the kept properties and the dropped count. */
export interface StyleNormalizationResult<T> {
  bag?: T;
  dropped: number;
}
export interface StyleAnimationResult {
  value?: AnimationValue;
  dropped: number;
}
type StylePropertyFilter = (property: StylePropertyName) => boolean;
/** Flattened transform used to measure how costly an animation is to paint. */
export interface TransformComplexity {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  rot: number;
  skx: number;
  sky: number;
}
interface TransformKeyframe {
  at: number;
  t: TransformValue;
}
/** CSS declarations keyed by camelCase property name. */
export type CssDeclarations = Record<string, string | number>;
/** Keyframes and options ready for `Element.animate`. */
export interface StyleAnimationKeyframes {
  keyframes: CssDeclarations[];
  options: {
    duration: number;
    delay: number;
    iterations: number;
    direction: AnimationDirectionValue;
    easing: EasingValue;
  };
}
/** The part of `CSS` the schema feature-detects. */
interface CssSupportsApi {
  supports?(property: string, value: string): boolean;
}
interface CssSupportsHost {
  CSS?: CssSupportsApi;
}

declare module "../bindings" {
  interface RuntimeBindings {
    buildStylePropertyRegistry: () => StylePropertyRegistry;
    stylePropertyAppliesToNode: (
      property: StylePropertyName,
      nodeKind: StyleNodeKind | undefined,
    ) => boolean;
    stylePropertyValueSchema: (
      property: StylePropertyName,
      nodeKind?: StyleNodeKind,
    ) => StyleValueSchema;
    sanitizeCssValue: (value: unknown) => string | undefined;
    isPlainStyleRecord: (value: unknown) => value is RawRecord;
    normalizeNumericStyleValue: (
      schema: NumericSchema,
      value: unknown,
    ) => number | undefined;
    numericStyleValueOrDefault: (
      schema: NumericSchema,
      value: unknown,
      fallback: number,
    ) => number | undefined;
    normalizeEnumStyleValue: <T extends string>(
      values: readonly T[],
      value: unknown,
    ) => T | undefined;
    normalizeCssColor: (color: unknown) => string | undefined;
    normalizeFontFamily_KR_: (font: unknown) => FontFamilyValue | undefined;
    numericSchemaBounds: (schema: NumericSchema) => NumericBounds;
    componentSchemaBounds: <F extends string>(
      components: readonly StyleComponentSchema<F>[],
    ) => Record<F, NumericBounds>;
    shadowSchemaBounds: (schema?: StyleValueSchema) => ShadowBounds;
    normalizeShadows: (
      shadows: unknown,
      allowSpread: boolean,
      blurSchema?: NumericSchema,
    ) => ShadowValue[] | undefined;
    normalizeShadow: (
      shadow: unknown,
      allowSpread: boolean,
      blurSchema?: NumericSchema,
    ) => ShadowValue | undefined;
    normalizeGradient: (
      gradient: unknown,
      allowRepeating?: boolean,
    ) => GradientValue | undefined;
    radialGradientPrelude: (gradient: GradientValue) => string;
    radialGradientPrefix: (gradient: GradientValue) => string;
    normalizeStyleComponents: <F extends string>(
      components: readonly StyleComponentSchema<F>[],
      values: unknown,
    ) => Partial<Record<F, number>> | undefined;
    normalizeCssSize: (size: unknown) => CssSizeValue | undefined;
    normalizeTransition: (transition: unknown) => TransitionValue | undefined;
    normalizeStylePropertyValue: (
      property: StylePropertyName,
      value: unknown,
      nodeKind?: StyleNodeKind,
    ) => StyleValue | undefined;
    animationPaintComplexity: (animation: AnimationValue) => boolean;
    transformComponentsForComplexity: (
      transform: unknown,
    ) => TransformComplexity | undefined;
    logarithmicScaleDistance: (scale: number, otherScale: number) => number;
    transformComplexityDistance: (
      transform: TransformComplexity,
      otherTransform: TransformComplexity,
    ) => number;
    transformAnimationExceedsBudget: (
      keyframes: TransformKeyframe[],
      maximumComplexity: boolean,
    ) => boolean;
    normalizeAnimationStyle: (
      style: unknown,
      allowsProperty: StylePropertyFilter,
      nodeKind?: StyleNodeKind,
    ) => StyleNormalizationResult<AnimationStyle>;
    normalizeStyleAnimation: (
      animation: unknown,
      allowsProperty: StylePropertyFilter,
      nodeKind?: StyleNodeKind,
    ) => StyleAnimationResult;
    normalizeHoverStyle: (
      hover: unknown,
      nodeKind?: StyleNodeKind,
    ) => StyleNormalizationResult<HoverStyle>;
    normalizeStyleBag: (
      style: unknown,
      nodeKind?: StyleNodeKind,
    ) => StyleNormalizationResult<StyleBag>;
    shadowsToCss: (
      shadows: readonly ShadowValue[],
      allowSpread: boolean,
    ) => string;
    gradientToCss: (gradient: GradientValue) => string;
    filterToCss: (filter: FilterValue) => string;
    transformToCss: (transform: TransformValue) => string;
    cssSizeToString: (size: CssSizeValue) => string;
    transitionToCss: (transition: TransitionValue) => string;
    writeCssStyleProperty: (
      css: CssDeclarations,
      property: StylePropertyName,
      value: StyleValue,
    ) => void;
    supportsPaintContainment: () => boolean;
    styleBagToCss: (
      style: StyleBag,
      nodeKind?: StyleNodeKind,
    ) => CssDeclarations;
    hoverStyleToCss: (
      style: StyleBag,
      nodeKind?: StyleNodeKind,
    ) => CssDeclarations | undefined;
    styleAnimationToKeyframes: (
      style: StyleBag,
      nodeKind?: StyleNodeKind,
    ) => StyleAnimationKeyframes | undefined;
    hasPaintEffects: (style: StyleBag) => boolean;
    paintEffectCost: (style: StyleBag) => number;
    isSlideNodeStyleKind: (kind: StyleNodeKind) => boolean;
    documentTextNodeKinds: NodeKindList;
    documentBlockNodeKinds: NodeKindList;
    documentTableNodeKinds: NodeKindList;
    documentTableCellNodeKinds: NodeKindList;
    slideTextNodeKinds: NodeKindList;
    slideImageNodeKinds: NodeKindList;
    slideIconNodeKinds: NodeKindList;
    slideContainerNodeKinds: NodeKindList;
    slideTableNodeKinds: NodeKindList;
    slideShapeNodeKinds: NodeKindList;
    concatenateNodeKinds: (...lists: NodeKindList[]) => StyleNodeKind[];
    allStyleNodeKinds: NodeKindList;
    transformableNodeKinds: NodeKindList;
    typographyNodeKinds: NodeKindList;
    paintEffectNodeKinds: NodeKindList;
    documentStyleNodeKinds: NodeKindList;
    fontStyleValues: readonly FontStyleValue[];
    textAlignValues: readonly TextAlignValue[];
    textTransformValues: readonly TextTransformValue[];
    textDecorationLineValues: readonly TextDecorationLineValue[];
    textDecorationStyleValues: readonly TextDecorationStyleValue[];
    fontFamilyFallbackValues: readonly FontFamilyFallback[];
    customFontFamilyPattern: RegExp;
    reservedFontFamilies: ReadonlySet<string>;
    fontVariantNumericValues: readonly FontVariantNumericValue[];
    borderStyleValues: readonly BorderStyleValue[];
    borderSidesValues: readonly BorderSidesValue[];
    blendModeValues: readonly BlendModeValue[];
    positionValues: readonly PositionValue[];
    floatValues: readonly FloatValue[];
    displayValues: readonly DisplayValue[];
    visibilityValues: readonly VisibilityValue[];
    overflowValues: readonly OverflowValue[];
    pointerEventsValues: readonly PointerEventsValue[];
    cursorValues: readonly CursorValue[];
    easingValues: readonly EasingValue[];
    animationDirectionValues: readonly AnimationDirectionValue[];
    cssFontFamilyFallbacks: Record<FontFamilyFallback, string>;
    lengthSchema: (lo: number, hi: number) => LengthSchema;
    numberSchema: (lo: number, hi: number) => NumberSchema;
    integerSchema: (lo: number, hi: number, step: number) => IntegerSchema;
    enumSchema: (values: readonly string[]) => EnumSchema;
    colorSchema: ColorSchema;
    maxShadowCount: number;
    radialGradientExtentValues: readonly string[];
    filterComponentSchemas: readonly FilterComponentSchema[];
    transformComponentSchemas: readonly TransformComponentSchema[];
    stylePropertyNames: readonly StylePropertyName[];
    paintEffectProperties: readonly StylePropertyName[];
    animatableStyleProperties: readonly AnimatableStyleProperty[];
    hoverStyleProperties: readonly (keyof HoverStyle)[];
    nonTransformAnimationProperties: readonly Exclude<keyof AnimationStyle, "transform">[];
    stylePropertyNameSet: ReadonlySet<string>;
    paintEffectPropertySet: ReadonlySet<string>;
    animatableStylePropertySet: ReadonlySet<string>;
    hoverStylePropertySet: ReadonlySet<string>;
    stylePropertyDefinitions: StylePropertyDefinitions;
    stylePropertyRegistry: StylePropertyRegistry;
    transformForbiddenNodeKinds: NodeKindList;
    maxCssValueLength: number;
    unsafeCssValuePattern: RegExp;
    cssHexColorPattern: RegExp;
    cssNamedColors: ReadonlySet<string>;
    cssUnsignedNumberSource: string;
    cssOptionalWhitespaceSource: string;
    cssRequiredWhitespaceSource: string;
    legacyRgbColorPattern: RegExp;
    modernRgbColorPattern: RegExp;
    legacyHslColorPattern: RegExp;
    modernHslColorPattern: RegExp;
    isAllowedCustomFontFamily: (input: unknown) => input is string;
    hasOwnStyleProperty: (target: object, key: string) => boolean;
    shadowOffsetSchema: NumericSchema;
    shadowBlurSchema: NumericSchema;
    shadowSpreadSchema: NumericSchema;
    defaultShadowBounds: ShadowBounds;
    filterBounds: FilterBounds;
    transformBounds: TransformBounds;
    gradientAngleSchema: NumericSchema;
    gradientStopPositionSchema: NumericSchema;
    radialGradientCenterSchema: NumericSchema;
    gradientRepeatLengthSchema: NumericSchema;
    minGradientStops: number;
    maxGradientStops: number;
    cssPixelSizeSchema: NumericSchema;
    cssPercentSizeSchema: NumericSchema;
    transitionDurationSchema: NumericSchema;
    transitionDelaySchema: NumericSchema;
    animationDurationSchema: NumericSchema;
    animationDelaySchema: NumericSchema;
    animationIterationsSchema: NumericSchema;
    animationKeyframePositionSchema: NumericSchema;
    minAnimationKeyframes: number;
    maxAnimationKeyframes: number;
    maxAnimationComplexity: number;
    transformTranslationCostScale: number;
    transformAngleCostScale: number;
    transformScaleCostScale: number;
    cssPixels: (px: number) => string;
    transitionPropertyCssNames: Record<AnimatableStyleProperty, string>;
    paintContainmentDependentProperties: readonly StylePropertyName[];
    paintContainmentSupported: boolean | undefined;
    dynamicStyleAttribute: string;
    initializeStyleSchema: () => void;
  }
}

export function installModelStyleSchema(runtime: RuntimeBindings): () => void {
  var isSlideNodeStyleKind: RuntimeBindings["isSlideNodeStyleKind"];
  var documentTextNodeKinds: RuntimeBindings["documentTextNodeKinds"];
  var documentBlockNodeKinds: RuntimeBindings["documentBlockNodeKinds"];
  var documentTableNodeKinds: RuntimeBindings["documentTableNodeKinds"];
  var documentTableCellNodeKinds: RuntimeBindings["documentTableCellNodeKinds"];
  var slideTextNodeKinds: RuntimeBindings["slideTextNodeKinds"];
  var slideImageNodeKinds: RuntimeBindings["slideImageNodeKinds"];
  var slideIconNodeKinds: RuntimeBindings["slideIconNodeKinds"];
  var slideContainerNodeKinds: RuntimeBindings["slideContainerNodeKinds"];
  var slideTableNodeKinds: RuntimeBindings["slideTableNodeKinds"];
  var slideShapeNodeKinds: RuntimeBindings["slideShapeNodeKinds"];
  var concatenateNodeKinds: RuntimeBindings["concatenateNodeKinds"];
  var allStyleNodeKinds: RuntimeBindings["allStyleNodeKinds"];
  var transformableNodeKinds: RuntimeBindings["transformableNodeKinds"];
  var typographyNodeKinds: RuntimeBindings["typographyNodeKinds"];
  var paintEffectNodeKinds: RuntimeBindings["paintEffectNodeKinds"];
  var documentStyleNodeKinds: RuntimeBindings["documentStyleNodeKinds"];
  var fontStyleValues: RuntimeBindings["fontStyleValues"];
  var textAlignValues: RuntimeBindings["textAlignValues"];
  var textTransformValues: RuntimeBindings["textTransformValues"];
  var textDecorationLineValues: RuntimeBindings["textDecorationLineValues"];
  var textDecorationStyleValues: RuntimeBindings["textDecorationStyleValues"];
  var fontFamilyFallbackValues: RuntimeBindings["fontFamilyFallbackValues"];
  var customFontFamilyPattern: RuntimeBindings["customFontFamilyPattern"];
  var reservedFontFamilies: RuntimeBindings["reservedFontFamilies"];
  var fontVariantNumericValues: RuntimeBindings["fontVariantNumericValues"];
  var borderStyleValues: RuntimeBindings["borderStyleValues"];
  var borderSidesValues: RuntimeBindings["borderSidesValues"];
  var blendModeValues: RuntimeBindings["blendModeValues"];
  var positionValues: RuntimeBindings["positionValues"];
  var floatValues: RuntimeBindings["floatValues"];
  var displayValues: RuntimeBindings["displayValues"];
  var visibilityValues: RuntimeBindings["visibilityValues"];
  var overflowValues: RuntimeBindings["overflowValues"];
  var pointerEventsValues: RuntimeBindings["pointerEventsValues"];
  var cursorValues: RuntimeBindings["cursorValues"];
  var easingValues: RuntimeBindings["easingValues"];
  var animationDirectionValues: RuntimeBindings["animationDirectionValues"];
  var cssFontFamilyFallbacks: RuntimeBindings["cssFontFamilyFallbacks"];
  var lengthSchema: RuntimeBindings["lengthSchema"];
  var numberSchema: RuntimeBindings["numberSchema"];
  var integerSchema: RuntimeBindings["integerSchema"];
  var enumSchema: RuntimeBindings["enumSchema"];
  var colorSchema: RuntimeBindings["colorSchema"];
  var maxShadowCount: RuntimeBindings["maxShadowCount"];
  var radialGradientExtentValues: RuntimeBindings["radialGradientExtentValues"];
  var filterComponentSchemas: RuntimeBindings["filterComponentSchemas"];
  var transformComponentSchemas: RuntimeBindings["transformComponentSchemas"];
  var stylePropertyNames: RuntimeBindings["stylePropertyNames"];
  var paintEffectProperties: RuntimeBindings["paintEffectProperties"];
  var animatableStyleProperties: RuntimeBindings["animatableStyleProperties"];
  var hoverStyleProperties: RuntimeBindings["hoverStyleProperties"];
  var nonTransformAnimationProperties: RuntimeBindings["nonTransformAnimationProperties"];
  var stylePropertyNameSet: RuntimeBindings["stylePropertyNameSet"];
  var paintEffectPropertySet: RuntimeBindings["paintEffectPropertySet"];
  var animatableStylePropertySet: RuntimeBindings["animatableStylePropertySet"];
  var hoverStylePropertySet: RuntimeBindings["hoverStylePropertySet"];
  var stylePropertyDefinitions: RuntimeBindings["stylePropertyDefinitions"];
  var stylePropertyRegistry: RuntimeBindings["stylePropertyRegistry"];
  var transformForbiddenNodeKinds: RuntimeBindings["transformForbiddenNodeKinds"];
  var maxCssValueLength: RuntimeBindings["maxCssValueLength"];
  var unsafeCssValuePattern: RuntimeBindings["unsafeCssValuePattern"];
  var cssHexColorPattern: RuntimeBindings["cssHexColorPattern"];
  var cssNamedColors: RuntimeBindings["cssNamedColors"];
  var cssUnsignedNumberSource: RuntimeBindings["cssUnsignedNumberSource"];
  var cssOptionalWhitespaceSource: RuntimeBindings["cssOptionalWhitespaceSource"];
  var cssRequiredWhitespaceSource: RuntimeBindings["cssRequiredWhitespaceSource"];
  var legacyRgbColorPattern: RuntimeBindings["legacyRgbColorPattern"];
  var modernRgbColorPattern: RuntimeBindings["modernRgbColorPattern"];
  var legacyHslColorPattern: RuntimeBindings["legacyHslColorPattern"];
  var modernHslColorPattern: RuntimeBindings["modernHslColorPattern"];
  var isAllowedCustomFontFamily: RuntimeBindings["isAllowedCustomFontFamily"];
  var hasOwnStyleProperty: RuntimeBindings["hasOwnStyleProperty"];
  var shadowOffsetSchema: RuntimeBindings["shadowOffsetSchema"];
  var shadowBlurSchema: RuntimeBindings["shadowBlurSchema"];
  var shadowSpreadSchema: RuntimeBindings["shadowSpreadSchema"];
  var defaultShadowBounds: RuntimeBindings["defaultShadowBounds"];
  var filterBounds: RuntimeBindings["filterBounds"];
  var transformBounds: RuntimeBindings["transformBounds"];
  var gradientAngleSchema: RuntimeBindings["gradientAngleSchema"];
  var gradientStopPositionSchema: RuntimeBindings["gradientStopPositionSchema"];
  var radialGradientCenterSchema: RuntimeBindings["radialGradientCenterSchema"];
  var gradientRepeatLengthSchema: RuntimeBindings["gradientRepeatLengthSchema"];
  var minGradientStops: RuntimeBindings["minGradientStops"];
  var maxGradientStops: RuntimeBindings["maxGradientStops"];
  var cssPixelSizeSchema: RuntimeBindings["cssPixelSizeSchema"];
  var cssPercentSizeSchema: RuntimeBindings["cssPercentSizeSchema"];
  var transitionDurationSchema: RuntimeBindings["transitionDurationSchema"];
  var transitionDelaySchema: RuntimeBindings["transitionDelaySchema"];
  var animationDurationSchema: RuntimeBindings["animationDurationSchema"];
  var animationDelaySchema: RuntimeBindings["animationDelaySchema"];
  var animationIterationsSchema: RuntimeBindings["animationIterationsSchema"];
  var animationKeyframePositionSchema: RuntimeBindings["animationKeyframePositionSchema"];
  var minAnimationKeyframes: RuntimeBindings["minAnimationKeyframes"];
  var maxAnimationKeyframes: RuntimeBindings["maxAnimationKeyframes"];
  var maxAnimationComplexity: RuntimeBindings["maxAnimationComplexity"];
  var transformTranslationCostScale: RuntimeBindings["transformTranslationCostScale"];
  var transformAngleCostScale: RuntimeBindings["transformAngleCostScale"];
  var transformScaleCostScale: RuntimeBindings["transformScaleCostScale"];
  var cssPixels: RuntimeBindings["cssPixels"];
  var transitionPropertyCssNames: RuntimeBindings["transitionPropertyCssNames"];
  var paintContainmentDependentProperties: RuntimeBindings["paintContainmentDependentProperties"];
  var paintContainmentSupported: RuntimeBindings["paintContainmentSupported"];
  var dynamicStyleAttribute: RuntimeBindings["dynamicStyleAttribute"];
  var initializeStyleSchema: RuntimeBindings["initializeStyleSchema"];
  function buildStylePropertyRegistry(): StylePropertyRegistry {
    let registry: StylePropertyRegistry = Object.create(null);
    for (let value of stylePropertyNames) {
      let value2: StylePropertyDefinition = stylePropertyDefinitions[value];
      registry[value] = {
        value: value2.v,
        slidesValue: value2.slides,
        shapeValue: value2.shape,
        applies: value2.on,
        routed: value2.routed ?? [],
        effect: paintEffectPropertySet.has(value),
        hover: hoverStylePropertySet.has(value),
        animatable: animatableStylePropertySet.has(value),
      };
    }
    return registry;
  }
  function stylePropertyAppliesToNode(
    property: StylePropertyName,
    nodeKind: StyleNodeKind | undefined,
  ): boolean {
    if (
      property === "transform" &&
      transformForbiddenNodeKinds.includes(nodeKind as StyleNodeKind)
    ) {
      return false;
    }
    return stylePropertyRegistry[property].applies.includes(
      nodeKind as StyleNodeKind,
    );
  }
  function stylePropertyValueSchema(
    property: StylePropertyName,
    nodeKind?: StyleNodeKind,
  ): StyleValueSchema {
    let definition: StylePropertyRegistryEntry = stylePropertyRegistry[property];
    if (nodeKind === "slides-shape" && definition.shapeValue !== undefined) {
      return definition.shapeValue;
    }
    if (nodeKind !== undefined && definition.slidesValue !== undefined) {
      if (isSlideNodeStyleKind(nodeKind)) {
        return definition.slidesValue;
      }
    }
    return definition.value;
  }
  function sanitizeCssValue(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return;
    }
    let trimmed: string = value.trim();
    if (trimmed.length === 0 || trimmed.length > maxCssValueLength) {
      return;
    }
    if (unsafeCssValuePattern.test(trimmed)) {
      return;
    }
    return trimmed;
  }
  function isPlainStyleRecord(value: unknown): value is RawRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function normalizeNumericStyleValue(
    schema: NumericSchema,
    value: unknown,
  ): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return;
    }
    if (schema.kind === "int") {
      let value2: number = Math.round(value / schema.step) * schema.step;
      return Math.min(schema.hi, Math.max(schema.lo, value2));
    }
    let clamped: number = Math.min(schema.hi, Math.max(schema.lo, value));
    if (schema.kind === "len") {
      return Math.round(clamped * 10) / 10;
    } else {
      return Math.round(clamped * 1e4) / 1e4;
    }
  }
  function numericStyleValueOrDefault(
    schema: NumericSchema,
    value: unknown,
    fallback: number,
  ): number | undefined {
    if (value === undefined) {
      return fallback;
    } else {
      return normalizeNumericStyleValue(schema, value);
    }
  }
  function normalizeEnumStyleValue<T extends string>(
    values: readonly T[],
    value: unknown,
  ): T | undefined {
    if (typeof value !== "string") {
      return;
    }
    let trimmed: string = value.trim();
    if (trimmed.length === 0 || trimmed.length > maxCssValueLength) {
      return;
    }
    if (values.includes(trimmed as T)) {
      return trimmed as T;
    } else {
      return undefined;
    }
  }
  function normalizeCssColor(color: unknown): string | undefined {
    let sanitized: string | undefined = sanitizeCssValue(color);
    if (sanitized === undefined) {
      return;
    }
    let normalized: string = sanitized.toLowerCase();
    if (
      !(
        cssNamedColors.has(normalized) ||
        cssHexColorPattern.test(normalized) ||
        legacyRgbColorPattern.test(normalized) ||
        modernRgbColorPattern.test(normalized) ||
        legacyHslColorPattern.test(normalized) ||
        modernHslColorPattern.test(normalized)
      )
    ) {
      return;
    }
    let css: CssSupportsApi | undefined = (globalThis as CssSupportsHost).CSS;
    if (css !== undefined && typeof css.supports === "function") {
      if (!css.supports("color", normalized)) {
        return;
      }
    }
    return normalized;
  }
  function normalizeFontFamily_KR_(font: unknown): FontFamilyValue | undefined {
    let generic: FontFamilyFallback | undefined = normalizeEnumStyleValue(
      fontFamilyFallbackValues,
      font,
    );
    if (generic !== undefined) {
      return generic;
    }
    if (!isPlainStyleRecord(font)) {
      return;
    }
    let { family: family, webSafe: webSafe } = font,
      fallback: FontFamilyFallback | undefined = normalizeEnumStyleValue(
        fontFamilyFallbackValues,
        font.fallback,
      );
    if (!isAllowedCustomFontFamily(family) || fallback === undefined) {
      return;
    }
    if (webSafe === undefined) {
      return {
        family: family,
        fallback: fallback,
      };
    }
    if (isAllowedCustomFontFamily(webSafe)) {
      return {
        family: family,
        fallback: fallback,
        webSafe: webSafe,
      };
    } else {
      return undefined;
    }
  }
  function numericSchemaBounds(schema: NumericSchema): NumericBounds {
    return {
      min: schema.lo,
      max: schema.hi,
    };
  }
  function componentSchemaBounds<F extends string>(
    components: readonly StyleComponentSchema<F>[],
  ): Record<F, NumericBounds> {
    let bounds = {} as Record<F, NumericBounds>;
    for (let value of components)
      bounds[value.field] = numericSchemaBounds(value.cls);
    return bounds;
  }
  function shadowSchemaBounds(schema?: StyleValueSchema): ShadowBounds {
    if (schema?.kind === "shadow" && schema.blur !== undefined) {
      return {
        ...defaultShadowBounds,
        blur: numericSchemaBounds(schema.blur),
      };
    } else {
      return defaultShadowBounds;
    }
  }
  function normalizeShadows(
    shadows: unknown,
    allowSpread: boolean,
    blurSchema?: NumericSchema,
  ): ShadowValue[] | undefined {
    let values: unknown[] = Array.isArray(shadows) ? shadows : [shadows];
    if (values.length === 0 || values.length > 8) {
      return;
    }
    let result: ShadowValue[] = [];
    for (let value of values) {
      let value2: ShadowValue | undefined = normalizeShadow(
        value,
        allowSpread,
        blurSchema,
      );
      if (value2 === undefined) {
        return;
      }
      result.push(value2);
    }
    return result;
  }
  function normalizeShadow(
    shadow: unknown,
    allowSpread: boolean,
    blurSchema: NumericSchema = shadowBlurSchema,
  ): ShadowValue | undefined {
    if (!isPlainStyleRecord(shadow)) {
      return;
    }
    let x: number | undefined = numericStyleValueOrDefault(
        shadowOffsetSchema,
        shadow.x,
        0,
      ),
      y: number | undefined = numericStyleValueOrDefault(
        shadowOffsetSchema,
        shadow.y,
        0,
      ),
      blur: number | undefined = numericStyleValueOrDefault(
        blurSchema,
        shadow.blur,
        0,
      ),
      color: string | undefined = normalizeCssColor(shadow.color);
    if (
      x === undefined ||
      y === undefined ||
      blur === undefined ||
      color === undefined
    ) {
      return;
    }
    if (!allowSpread) {
      return {
        x: x,
        y: y,
        blur: blur,
        color: color,
      };
    }
    let spread: number | undefined = numericStyleValueOrDefault(
      shadowSpreadSchema,
      shadow.spread,
      0,
    );
    if (spread === undefined) {
      return;
    }
    if (shadow.inset === true) {
      return {
        x: x,
        y: y,
        blur: blur,
        spread: spread,
        inset: true,
        color: color,
      };
    } else {
      return {
        x: x,
        y: y,
        blur: blur,
        spread: spread,
        color: color,
      };
    }
  }
  function normalizeGradient(
    gradient: unknown,
    allowRepeating: boolean = false,
  ): GradientValue | undefined {
    if (!isPlainStyleRecord(gradient)) {
      return;
    }
    let angle: number | undefined = numericStyleValueOrDefault(
      gradientAngleSchema,
      gradient.angle,
      180,
    );
    if (angle === undefined) {
      return;
    }
    let stops: unknown = gradient.stops;
    if (
      !Array.isArray(stops) ||
      stops.length < minGradientStops ||
      stops.length > maxGradientStops
    ) {
      return;
    }
    let stopCount: number = stops.length,
      normalizedStops: GradientStop[] = [];
    for (let index: number = 0; index < stopCount; index += 1) {
      let value: unknown = stops[index];
      if (!isPlainStyleRecord(value)) {
        return;
      }
      let value2: string | undefined = normalizeCssColor(value.color),
        value3: number | undefined = numericStyleValueOrDefault(
          gradientStopPositionSchema,
          value.pos,
          (index / (stopCount - 1)) * 100,
        );
      if (value2 === undefined || value3 === undefined) {
        return;
      }
      normalizedStops.push({
        color: value2,
        pos: value3,
      });
    }
    normalizedStops.sort((input, options) => input.pos - options.pos);
    let hasRepeat: boolean = allowRepeating && gradient.repeat !== undefined,
      repeat: number | undefined = hasRepeat
        ? normalizeNumericStyleValue(
            gradientRepeatLengthSchema,
            gradient.repeat,
          )
        : undefined;
    if (hasRepeat && repeat === undefined) {
      return;
    }
    let lastStop: GradientStop = normalizedStops[stopCount - 1]!;
    if (
      repeat !== undefined &&
      gradient.radial !== true &&
      lastStop.pos < 100
    ) {
      if (stopCount < maxGradientStops) {
        normalizedStops.push({
          color: lastStop.color,
          pos: 100,
        });
      } else {
        normalizedStops[stopCount - 1] = {
          color: lastStop.color,
          pos: 100,
        };
      }
    }
    let at: GradientValue["at"];
    if (isPlainStyleRecord(gradient.at)) {
      let value: number | undefined = normalizeNumericStyleValue(
          radialGradientCenterSchema,
          gradient.at.x,
        ),
        value2: number | undefined = normalizeNumericStyleValue(
          radialGradientCenterSchema,
          gradient.at.y,
        );
      if (
        value !== undefined &&
        value2 !== undefined &&
        (value !== 50 || value2 !== 50)
      ) {
        at = {
          x: value,
          y: value2,
        };
      }
    }
    let extent: RadialGradientExtent | undefined =
      radialGradientExtentValues.includes(gradient.extent as string)
        ? (gradient.extent as RadialGradientExtent)
        : undefined;
    return {
      angle: angle,
      ...(gradient.radial === true
        ? {
            radial: true,
          }
        : {}),
      ...(gradient.shape === "ellipse"
        ? {
            shape: "ellipse",
          }
        : {}),
      ...(extent !== undefined
        ? {
            extent: extent,
          }
        : {}),
      ...(at !== undefined
        ? {
            at: at,
          }
        : {}),
      ...(repeat !== undefined
        ? {
            repeat: repeat,
          }
        : {}),
      stops: normalizedStops,
    };
  }
  function radialGradientPrelude(gradient: GradientValue): string {
    let extent: string | undefined =
        radialGradientExtentValues.find((input) => input === gradient.extent),
      center: GradientValue["at"] = gradient.at,
      position: string | undefined =
        isPlainStyleRecord(center) &&
        typeof center.x === "number" &&
        typeof center.y === "number" &&
        Number.isFinite(center.x) &&
        Number.isFinite(center.y)
          ? `at ${center.x}% ${center.y}%`
          : undefined;
    return [
      gradient.shape === "ellipse" ? "ellipse" : "circle",
      extent,
      position,
    ]
      .filter((input) => input !== undefined)
      .join(" ");
  }
  function radialGradientPrefix(gradient: GradientValue): string {
    let value: string = radialGradientPrelude(gradient);
    if (value === "ellipse") {
      return "radial-gradient(";
    } else {
      return "radial-gradient(" + value + ", ";
    }
  }
  function normalizeStyleComponents<F extends string>(
    components: readonly StyleComponentSchema<F>[],
    values: unknown,
  ): Partial<Record<F, number>> | undefined {
    if (!isPlainStyleRecord(values)) {
      return;
    }
    let result: Partial<Record<F, number>> = Object.create(null),
      fieldCount: number = 0;
    for (let value of components) {
      if (!hasOwnStyleProperty(values, value.field)) {
        continue;
      }
      let value2: number | undefined = normalizeNumericStyleValue(
        value.cls,
        values[value.field],
      );
      if (value2 === undefined) {
        return;
      }
      result[value.field] = value2;
      fieldCount += 1;
    }
    if (fieldCount > 0) {
      return result;
    } else {
      return undefined;
    }
  }
  function normalizeCssSize(size: unknown): CssSizeValue | undefined {
    if (!isPlainStyleRecord(size)) {
      return;
    }
    let hasPixels: boolean = hasOwnStyleProperty(size, "px"),
      hasPercent: boolean = hasOwnStyleProperty(size, "pct");
    if (hasPixels === hasPercent) {
      return;
    }
    if (hasPixels) {
      let value2: number | undefined = normalizeNumericStyleValue(
        cssPixelSizeSchema,
        size.px,
      );
      if (value2 === undefined) {
        return undefined;
      } else {
        return {
          px: value2,
        };
      }
    }
    let value: number | undefined = normalizeNumericStyleValue(
      cssPercentSizeSchema,
      size.pct,
    );
    if (value === undefined) {
      return undefined;
    } else {
      return {
        pct: value,
      };
    }
  }
  function normalizeTransition(transition: unknown): TransitionValue | undefined {
    if (!isPlainStyleRecord(transition)) {
      return;
    }
    let value: AnimatableStyleProperty[],
      properties: unknown = transition.properties;
    if (properties === undefined || properties === "all") {
      value = [...animatableStyleProperties];
    } else {
      let value5: unknown[] = Array.isArray(properties)
        ? properties
        : [properties];
      if (
        value5.length === 0 ||
        value5.length > animatableStyleProperties.length
      ) {
        return;
      }
      let items: AnimatableStyleProperty[] = [];
      for (let value6 of value5) {
        let value7: AnimatableStyleProperty | undefined =
          normalizeEnumStyleValue(animatableStyleProperties, value6);
        if (value7 === undefined) {
          return;
        }
        if (!items.includes(value7)) {
          items.push(value7);
        }
      }
      value = items;
    }
    let value2: number | undefined = numericStyleValueOrDefault(
        transitionDurationSchema,
        transition.duration,
        200,
      ),
      value3: number | undefined = numericStyleValueOrDefault(
        transitionDelaySchema,
        transition.delay,
        0,
      ),
      value4: EasingValue | undefined =
        transition.easing === undefined
          ? "ease"
          : normalizeEnumStyleValue(easingValues, transition.easing);
    if (value2 === undefined || value3 === undefined || value4 === undefined) {
      return;
    }
    return {
      properties: value,
      duration: value2,
      delay: value3,
      easing: value4,
    };
  }
  function normalizeStylePropertyValue(
    property: StylePropertyName,
    value: unknown,
    nodeKind?: StyleNodeKind,
  ): StyleValue | undefined {
    let value2: StyleValueSchema = stylePropertyValueSchema(property, nodeKind);
    switch (value2.kind) {
      case "len":
      case "num":
      case "int":
        return normalizeNumericStyleValue(value2, value);
      case "enum":
        return normalizeEnumStyleValue(value2.values, value);
      case "color":
        return normalizeCssColor(value);
      case "fontFamily":
        return normalizeFontFamily_KR_(value);
      case "shadow":
        return normalizeShadows(value, value2.spread, value2.blur);
      case "gradient":
        return normalizeGradient(value, value2.repeat === true);
      case "filter":
        return normalizeStyleComponents(filterComponentSchemas, value);
      case "transform":
        return normalizeStyleComponents(transformComponentSchemas, value);
      case "size":
        return normalizeCssSize(value);
      case "transition":
        return normalizeTransition(value);
      case "animation":
        return;
    }
  }
  function animationPaintComplexity(animation: AnimationValue): boolean {
    let items: number[] = [],
      items2: TransformKeyframe[] = [];
    for (let value5 of animation.keyframes) {
      let style: AnimationStyle = value5.style;
      if (
        nonTransformAnimationProperties.some(
          (input) => style[input] !== undefined,
        )
      ) {
        items.push(value5.at);
      }
      if (style.transform !== undefined) {
        items2.push({
          at: value5.at,
          t: style.transform,
        });
      }
    }
    let value: boolean =
        animation.iterations === "infinite" || animation.iterations > 1,
      value2: boolean = value && animation.direction !== "alternate";
    if (value && transformAnimationExceedsBudget(items2, value2)) {
      for (let value5 of items2)
        if (!items.includes(value5.at)) {
          items.push(value5.at);
        }
      items.sort((input, options) => input - options);
    }
    if (items.length === 0) {
      return true;
    }
    if (value && animation.delay > 0) {
      return false;
    }
    if (items[0] !== 0) {
      items.unshift(0);
    }
    if (items[items.length - 1] !== 100) {
      items.push(100);
    }
    let value3: number = items.length - 1;
    if (value2) {
      value3 += 1;
    }
    if (animation.duration / value3 < maxAnimationComplexity) {
      return false;
    }
    let value4: number | undefined;
    for (let value5 of items) {
      if (
        value4 !== undefined &&
        ((value5 - value4) / 100) * animation.duration < maxAnimationComplexity
      ) {
        return false;
      }
      value4 = value5;
    }
    return true;
  }
  function transformComponentsForComplexity(
    transform: unknown,
  ): TransformComplexity | undefined {
    if (!isPlainStyleRecord(transform)) {
      return;
    }
    let callback = (input: unknown, options: number): number | undefined => {
        if (input === undefined) {
          return options;
        }
        if (typeof input === "number") {
          if (Number.isFinite(input)) {
            return input;
          } else {
            return undefined;
          }
        }
        if (
          typeof input === "string" &&
          /^-?\d+(?:\.\d+)?(?:px)?$/.test(input.trim())
        ) {
          return Number.parseFloat(input);
        }
        return;
      },
      value: number | undefined = callback(transform.translateX, 0),
      value2: number | undefined = callback(transform.translateY, 0),
      value3: number | undefined = callback(transform.scale, 1);
    if (value === undefined || value2 === undefined || value3 === undefined) {
      return;
    }
    let value4: number | undefined = callback(transform.scaleX, value3),
      value5: number | undefined = callback(transform.scaleY, value3),
      value6: number | undefined = callback(transform.rotate, 0),
      value7: number | undefined = callback(transform.skewX, 0),
      value8: number | undefined = callback(transform.skewY, 0);
    if (
      value4 === undefined ||
      value5 === undefined ||
      value6 === undefined ||
      value7 === undefined ||
      value8 === undefined
    ) {
      return;
    }
    return {
      tx: value,
      ty: value2,
      sx: value4,
      sy: value5,
      rot: value6,
      skx: value7,
      sky: value8,
    };
  }
  function logarithmicScaleDistance(scale: number, otherScale: number): number {
    if (scale === otherScale) {
      return 0;
    }
    if (scale <= 0 || otherScale <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.abs(Math.log(scale) - Math.log(otherScale));
  }
  function transformComplexityDistance(
    transform: TransformComplexity,
    otherTransform: TransformComplexity,
  ): number {
    return (
      Math.hypot(
        transform.tx - otherTransform.tx,
        transform.ty - otherTransform.ty,
      ) /
        transformTranslationCostScale +
      Math.abs(transform.rot - otherTransform.rot) / transformAngleCostScale +
      (Math.abs(transform.skx - otherTransform.skx) +
        Math.abs(transform.sky - otherTransform.sky)) /
        transformAngleCostScale +
      (logarithmicScaleDistance(transform.sx, otherTransform.sx) +
        logarithmicScaleDistance(transform.sy, otherTransform.sy)) /
        transformScaleCostScale
    );
  }
  function transformAnimationExceedsBudget(
    keyframes: TransformKeyframe[],
    maximumComplexity: boolean,
  ): boolean {
    if (keyframes.length === 0) {
      return false;
    }
    if (
      keyframes[0]!.at !== 0 ||
      keyframes[keyframes.length - 1]!.at !== 100
    ) {
      return true;
    }
    let items: TransformComplexity[] = [];
    for (let value of keyframes) {
      let value2: TransformComplexity | undefined =
        transformComponentsForComplexity(value.t);
      if (value2 === undefined) {
        return true;
      }
      items.push(value2);
    }
    let index: number = 0;
    for (let count: number = 1; count < items.length; count += 1)
      if (
        ((index += transformComplexityDistance(
          items[count - 1]!,
          items[count]!,
        )),
        index >= 1)
      ) {
        return true;
      }
    return (
      maximumComplexity &&
      index +
        transformComplexityDistance(items[items.length - 1]!, items[0]!) >=
        1
    );
  }
  function normalizeAnimationStyle(
    style: unknown,
    allowsProperty: StylePropertyFilter,
    nodeKind?: StyleNodeKind,
  ): StyleNormalizationResult<AnimationStyle> {
    if (style === undefined) {
      return {
        dropped: 0,
      };
    }
    if (!isPlainStyleRecord(style)) {
      return {
        dropped: 1,
      };
    }
    let value: StyleBuilder = Object.create(null),
      index: number = 0,
      index2: number = 0;
    for (let value2 of animatableStyleProperties) {
      if (!hasOwnStyleProperty(style, value2)) {
        continue;
      }
      if (!allowsProperty(value2)) {
        index += 1;
        continue;
      }
      let value3: StyleValue | undefined = normalizeStylePropertyValue(
        value2,
        style[value2],
        nodeKind,
      );
      if (
        value3 === undefined ||
        (value2 === "boxShadow" && (value3 as ShadowValue[]).length !== 1)
      ) {
        index += 1;
        continue;
      }
      value[value2] = value3;
      index2 += 1;
    }
    return {
      bag: index2 > 0 ? (value as AnimationStyle) : undefined,
      dropped: index,
    };
  }
  function normalizeStyleAnimation(
    animation: unknown,
    allowsProperty: StylePropertyFilter,
    nodeKind?: StyleNodeKind,
  ): StyleAnimationResult {
    if (animation === undefined) {
      return {
        dropped: 0,
      };
    }
    if (!isPlainStyleRecord(animation)) {
      return {
        dropped: 1,
      };
    }
    let keyframes: unknown = animation.keyframes;
    if (
      !Array.isArray(keyframes) ||
      keyframes.length < minAnimationKeyframes ||
      keyframes.length > maxAnimationKeyframes
    ) {
      return {
        dropped: 1,
      };
    }
    let index: number = 0,
      items: AnimationKeyframe[] = [];
    for (let value6 of keyframes) {
      if (!isPlainStyleRecord(value6)) {
        return {
          dropped: index + 1,
        };
      }
      let value7: number | undefined = normalizeNumericStyleValue(
        animationKeyframePositionSchema,
        value6.at,
      );
      if (value7 === undefined) {
        return {
          dropped: index + 1,
        };
      }
      let value8: StyleNormalizationResult<AnimationStyle> =
        normalizeAnimationStyle(value6.style, allowsProperty, nodeKind);
      index += value8.dropped;
      items.push({
        at: value7,
        style: value8.bag ?? Object.create(null),
      });
    }
    items.sort((input, options) => input.at - options.at);
    let value: number | undefined = numericStyleValueOrDefault(
        animationDurationSchema,
        animation.duration,
        1000,
      ),
      value2: number | undefined = numericStyleValueOrDefault(
        animationDelaySchema,
        animation.delay,
        0,
      ),
      value3: number | "infinite" | undefined;
    if (animation.iterations === undefined) {
      value3 = 1;
    } else if (animation.iterations === "infinite") {
      value3 = "infinite";
    } else {
      value3 = normalizeNumericStyleValue(
        animationIterationsSchema,
        animation.iterations,
      );
    }
    let value4: AnimationDirectionValue | undefined =
        animation.direction === undefined
          ? "normal"
          : normalizeEnumStyleValue(
              animationDirectionValues,
              animation.direction,
            ),
      value5: EasingValue | undefined =
        animation.easing === undefined
          ? "ease"
          : normalizeEnumStyleValue(easingValues, animation.easing);
    if (
      value === undefined ||
      value2 === undefined ||
      value3 === undefined ||
      value4 === undefined ||
      value5 === undefined
    ) {
      return {
        dropped: index + 1,
      };
    }
    let state: AnimationValue = {
      keyframes: items,
      duration: value,
      delay: value2,
      iterations: value3,
      direction: value4,
      easing: value5,
    };
    if (!animationPaintComplexity(state)) {
      return {
        dropped: index + 1,
      };
    }
    return {
      value: state,
      dropped: index,
    };
  }
  function normalizeHoverStyle(
    hover: unknown,
    nodeKind?: StyleNodeKind,
  ): StyleNormalizationResult<HoverStyle> {
    if (!isPlainStyleRecord(hover)) {
      return {
        dropped: 1,
      };
    }
    let value: StyleBuilder = Object.create(null),
      index: number = 0,
      index2: number = 0;
    for (let value2 of hoverStyleProperties) {
      if (!hasOwnStyleProperty(hover, value2)) {
        continue;
      }
      if (!stylePropertyAppliesToNode(value2, nodeKind)) {
        index += 1;
        continue;
      }
      let value3: StyleValue | undefined = normalizeStylePropertyValue(
        value2,
        hover[value2],
        nodeKind,
      );
      if (value3 === undefined) {
        index += 1;
        continue;
      }
      value[value2] = value3;
      index2 += 1;
    }
    for (let value2 of Object.keys(hover)) {
      if (hoverStylePropertySet.has(value2)) {
        continue;
      }
      index += 1;
    }
    return {
      bag: index2 > 0 ? (value as HoverStyle) : undefined,
      dropped: index,
    };
  }
  function normalizeStyleBag(
    style: unknown,
    nodeKind?: StyleNodeKind,
  ): StyleNormalizationResult<StyleBag> {
    if (style === undefined) {
      return {
        dropped: 0,
      };
    }
    if (!isPlainStyleRecord(style)) {
      return {
        dropped: 1,
      };
    }
    let bag: StyleBuilder = Object.create(null),
      dropped: number = 0,
      kept: number = 0;
    for (let value of stylePropertyNames) {
      if (!hasOwnStyleProperty(style, value)) {
        continue;
      }
      if (!stylePropertyAppliesToNode(value, nodeKind)) {
        dropped += 1;
        continue;
      }
      if (value === "animation") {
        let value3: StyleAnimationResult = normalizeStyleAnimation(
          style[value],
          (input: StylePropertyName): boolean =>
            stylePropertyAppliesToNode(input, nodeKind),
          nodeKind,
        );
        dropped += value3.dropped;
        if (value3.value !== undefined) {
          bag[value] = value3.value;
          kept += 1;
        }
        continue;
      }
      let value2: StyleValue | undefined = normalizeStylePropertyValue(
        value,
        style[value],
        nodeKind,
      );
      if (value2 === undefined) {
        dropped += 1;
        continue;
      }
      bag[value] = value2;
      kept += 1;
    }
    if (hasOwnStyleProperty(style, "hover")) {
      let value: StyleNormalizationResult<HoverStyle> = normalizeHoverStyle(
        style.hover,
        nodeKind,
      );
      dropped += value.dropped;
      if (value.bag !== undefined) {
        bag.hover = value.bag;
        kept += 1;
      }
    }
    for (let value of Object.keys(style)) {
      if (value === "hover" || stylePropertyNameSet.has(value)) {
        continue;
      }
      dropped += 1;
    }
    return {
      bag: kept > 0 ? (bag as StyleBag) : undefined,
      dropped: dropped,
    };
  }
  function shadowsToCss(
    shadows: readonly ShadowValue[],
    allowSpread: boolean,
  ): string {
    return shadows
      .map((input) =>
        allowSpread
          ? `${input.inset === true ? "inset " : ""}${cssPixels(input.x)} ${cssPixels(input.y)} ${cssPixels(input.blur)} ${cssPixels(input.spread ?? 0)} ${input.color}`
          : `${cssPixels(input.x)} ${cssPixels(input.y)} ${cssPixels(input.blur)} ${input.color}`,
      )
      .join(", ");
  }
  function gradientToCss(gradient: GradientValue): string {
    if (gradient.repeat !== undefined && gradient.radial !== true) {
      let callback = (input: number): string =>
          `${Math.round((input / 100) * gradient.repeat! * 100) / 100}px`,
        value2: string = gradient.stops
          .map((input) => `${input.color} ${callback(input.pos)}`)
          .join(", ");
      return `repeating-linear-gradient(${gradient.angle}deg, ${value2})`;
    }
    let value: string = gradient.stops
      .map((input) => `${input.color} ${input.pos}%`)
      .join(", ");
    if (gradient.radial === true) {
      return `${radialGradientPrefix(gradient)}${value})`;
    } else {
      return `linear-gradient(${gradient.angle}deg, ${value})`;
    }
  }
  function filterToCss(filter: FilterValue): string {
    let items: string[] = [];
    for (let value of filterComponentSchemas) {
      let value2: number | undefined = filter[value.field];
      if (value2 !== undefined) {
        items.push(`${value.fn}(${value2}${value.unit})`);
      }
    }
    if (items.length > 0) {
      return items.join(" ");
    } else {
      return "none";
    }
  }
  function transformToCss(transform: TransformValue): string {
    let items: string[] = [];
    if (
      transform.translateX !== undefined ||
      transform.translateY !== undefined
    ) {
      items.push(
        `translate(${cssPixels(transform.translateX ?? 0)}, ${cssPixels(transform.translateY ?? 0)})`,
      );
    }
    if (transform.rotate !== undefined) {
      items.push(`rotate(${transform.rotate}deg)`);
    }
    if (transform.scale !== undefined) {
      items.push(`scale(${transform.scale})`);
    }
    if (transform.skewX !== undefined || transform.skewY !== undefined) {
      items.push(
        `skew(${transform.skewX ?? 0}deg, ${transform.skewY ?? 0}deg)`,
      );
    }
    if (items.length > 0) {
      return items.join(" ");
    } else {
      return "none";
    }
  }
  function cssSizeToString(size: CssSizeValue): string {
    if ("px" in size) {
      return cssPixels(size.px);
    } else {
      return `${size.pct}%`;
    }
  }
  function transitionToCss(transition: TransitionValue): string {
    return transition.properties
      .map(
        (input) =>
          `${transitionPropertyCssNames[input]} ${transition.duration}ms ${transition.easing} ${transition.delay}ms`,
      )
      .join(", ");
  }
  function writeCssStyleProperty(
    css: CssDeclarations,
    property: StylePropertyName,
    value: StyleValue,
  ): void {
    switch (property) {
      case "fontSize":
      case "letterSpacing":
      case "marginTop":
      case "marginRight":
      case "marginBottom":
      case "marginLeft":
      case "paddingTop":
      case "paddingRight":
      case "paddingBottom":
      case "paddingLeft":
      case "borderWidth":
      case "borderRadius":
      case "top":
      case "right":
      case "bottom":
      case "left":
        css[property] = cssPixels(value as number);
        return;
      case "fontWeight":
      case "lineHeight":
      case "opacity":
      case "zIndex":
        css[property] = value as number;
        return;
      case "fontFamily": {
        let value2: FontFamilyValue = value as FontFamilyValue;
        css.fontFamily =
          typeof value2 === "string"
            ? cssFontFamilyFallbacks[value2]
            : '"' +
              value2.family +
              '", ' +
              (value2.webSafe !== undefined
                ? '"' + value2.webSafe + '", '
                : "") +
              cssFontFamilyFallbacks[value2.fallback];
        return;
      }
      case "backgroundGradient":
        css.backgroundImage = gradientToCss(value as GradientValue);
        return;
      case "boxShadow":
        css.boxShadow = shadowsToCss(value as ShadowValue[], true);
        return;
      case "textShadow":
        css.textShadow = shadowsToCss(value as ShadowValue[], false);
        return;
      case "filter":
        css.filter = filterToCss(value as FilterValue);
        return;
      case "backdropFilter": {
        let value2: string = filterToCss(value as FilterValue);
        css.backdropFilter = value2;
        css.WebkitBackdropFilter = value2;
        return;
      }
      case "textStrokeWidth":
        css.WebkitTextStrokeWidth = cssPixels(value as number);
        css.paintOrder = "stroke";
        return;
      case "textStrokeColor":
        css.WebkitTextStrokeColor = value as string;
        return;
      case "borderSides": {
        let value2: string | number = css.borderWidth ?? "medium",
          value3: string = " " + value + " ";
        css.borderWidth = ["top", "right", "bottom", "left"]
          .map((input) => (value3.includes(" " + input + " ") ? value2 : "0"))
          .join(" ");
        return;
      }
      case "borderTopWidth":
      case "borderRightWidth":
      case "borderBottomWidth":
      case "borderLeftWidth": {
        let value2: string[] = (
            css.borderWidth === undefined
              ? ["0"]
              : String(css.borderWidth).split(" ")
          ).map((input) => (input === "medium" ? "0" : input)),
          value3: (string | undefined)[] =
            value2.length === 4
              ? value2
              : [value2[0], value2[0], value2[0], value2[0]];
        value3[
          {
            borderTopWidth: 0,
            borderRightWidth: 1,
            borderBottomWidth: 2,
            borderLeftWidth: 3,
          }[property]
        ] = cssPixels(value as number);
        css.borderWidth = value3.join(" ");
        return;
      }
      case "borderTopLeftRadius":
      case "borderTopRightRadius":
      case "borderBottomRightRadius":
      case "borderBottomLeftRadius": {
        let value2: string[] =
            css.borderRadius === undefined
              ? ["0"]
              : String(css.borderRadius).split(" "),
          value3: (string | undefined)[] =
            value2.length === 4
              ? value2
              : [value2[0], value2[0], value2[0], value2[0]];
        value3[
          {
            borderTopLeftRadius: 0,
            borderTopRightRadius: 1,
            borderBottomRightRadius: 2,
            borderBottomLeftRadius: 3,
          }[property]
        ] = cssPixels(value as number);
        css.borderRadius = value3.join(" ");
        return;
      }
      case "transform":
        css.transform = transformToCss(value as TransformValue);
        return;
      case "width":
      case "height":
      case "minWidth":
      case "minHeight":
      case "maxWidth":
      case "maxHeight":
        css[property] = cssSizeToString(value as CssSizeValue);
        return;
      case "transition":
        css.transition = transitionToCss(value as TransitionValue);
        return;
      case "animation":
        return;
      default:
        css[property] = value as string;
        return;
    }
  }
  function supportsPaintContainment(): boolean {
    let CSS2: CssSupportsApi | undefined = (globalThis as CssSupportsHost).CSS;
    if (CSS2 === undefined || typeof CSS2.supports !== "function") {
      return true;
    }
    paintContainmentSupported ??= CSS2.supports("contain", "paint");
    return paintContainmentSupported;
  }
  function styleBagToCss(
    style: StyleBag,
    nodeKind?: StyleNodeKind,
  ): CssDeclarations {
    let css: CssDeclarations = {},
      bag: StyleBag = style;
    for (let value of stylePropertyNames) {
      if (value === "animation") {
        continue;
      }
      if (!hasOwnStyleProperty(bag, value)) {
        continue;
      }
      if (!stylePropertyAppliesToNode(value, nodeKind)) {
        continue;
      }
      if (
        paintContainmentDependentProperties.includes(value) &&
        !supportsPaintContainment()
      ) {
        continue;
      }
      let value2: StyleValue | undefined = normalizeStylePropertyValue(
        value,
        bag[value],
        nodeKind,
      );
      if (value2 === undefined) {
        continue;
      }
      writeCssStyleProperty(css, value, value2);
    }
    return css;
  }
  function hoverStyleToCss(
    style: StyleBag,
    nodeKind?: StyleNodeKind,
  ): CssDeclarations | undefined {
    let hover: HoverStyle | undefined = style.hover;
    if (!isPlainStyleRecord(hover)) {
      return;
    }
    let css: CssDeclarations = {};
    for (let value of hoverStyleProperties) {
      if (!hasOwnStyleProperty(hover, value)) {
        continue;
      }
      if (
        nodeKind !== undefined &&
        !stylePropertyAppliesToNode(value, nodeKind)
      ) {
        continue;
      }
      let value2: StyleValue | undefined = normalizeStylePropertyValue(
        value,
        hover[value],
        nodeKind,
      );
      if (value2 === undefined) {
        continue;
      }
      writeCssStyleProperty(css, value, value2);
    }
    if (Object.keys(css).length > 0) {
      return css;
    } else {
      return undefined;
    }
  }
  function styleAnimationToKeyframes(
    style: StyleBag,
    nodeKind?: StyleNodeKind,
  ): StyleAnimationKeyframes | undefined {
    let allowsProperty: StylePropertyFilter =
        nodeKind === undefined
          ? (): boolean => true
          : (input: StylePropertyName): boolean =>
              stylePropertyAppliesToNode(input, nodeKind),
      animation: AnimationValue | undefined = normalizeStyleAnimation(
        style.animation,
        allowsProperty,
        nodeKind,
      ).value;
    if (animation === undefined) {
      return;
    }
    let keyframes: CssDeclarations[] = [];
    for (let value of animation.keyframes) {
      let state2: CssDeclarations = {
          offset: value.at / 100,
        },
        style2: AnimationStyle = value.style;
      for (let value2 of animatableStyleProperties) {
        if (!hasOwnStyleProperty(style2, value2)) {
          continue;
        }
        writeCssStyleProperty(state2, value2, style2[value2]!);
      }
      keyframes.push(state2);
    }
    let state: StyleAnimationKeyframes["options"] = {
      duration: animation.duration,
      delay: animation.delay,
      iterations:
        animation.iterations === "infinite"
          ? Number.POSITIVE_INFINITY
          : animation.iterations,
      direction: animation.direction,
      easing: animation.easing,
    };
    return {
      keyframes: keyframes,
      options: state,
    };
  }
  function hasPaintEffects(style: StyleBag): boolean {
    let value: StyleBag = style;
    if (value.animation !== undefined) {
      return true;
    }
    let value2: RawRecord | undefined = isPlainStyleRecord(value.hover)
      ? value.hover
      : undefined;
    for (let value3 of paintEffectProperties) {
      if (value[value3] !== undefined) {
        return true;
      }
      if (value2 !== undefined && value2[value3] !== undefined) {
        return true;
      }
    }
    return false;
  }
  function paintEffectCost(style: StyleBag): number {
    if (!hasPaintEffects(style)) {
      return 0;
    }
    let value: StyleBag = style,
      value2: HoverStyle | undefined = isPlainStyleRecord(value.hover)
        ? value.hover
        : undefined,
      index: number = 0;
    for (let value3 of ["boxShadow", "textShadow"] as const)
      for (let value4 of [value[value3], value2?.[value3]])
        if (Array.isArray(value4) && value4.length > 1) {
          index += value4.length - 1;
        }
    return 1 + index;
  }
  bindRuntimeValue(
    runtime,
    "buildStylePropertyRegistry",
    () => buildStylePropertyRegistry,
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyAppliesToNode",
    () => stylePropertyAppliesToNode,
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyValueSchema",
    () => stylePropertyValueSchema,
  );
  bindRuntimeValue(runtime, "sanitizeCssValue", () => sanitizeCssValue);
  bindRuntimeValue(runtime, "isPlainStyleRecord", () => isPlainStyleRecord);
  bindRuntimeValue(
    runtime,
    "normalizeNumericStyleValue",
    () => normalizeNumericStyleValue,
  );
  bindRuntimeValue(
    runtime,
    "numericStyleValueOrDefault",
    () => numericStyleValueOrDefault,
  );
  bindRuntimeValue(
    runtime,
    "normalizeEnumStyleValue",
    () => normalizeEnumStyleValue,
  );
  bindRuntimeValue(runtime, "normalizeCssColor", () => normalizeCssColor);
  bindRuntimeValue(
    runtime,
    "normalizeFontFamily_KR_",
    () => normalizeFontFamily_KR_,
  );
  bindRuntimeValue(runtime, "numericSchemaBounds", () => numericSchemaBounds);
  bindRuntimeValue(
    runtime,
    "componentSchemaBounds",
    () => componentSchemaBounds,
  );
  bindRuntimeValue(runtime, "shadowSchemaBounds", () => shadowSchemaBounds);
  bindRuntimeValue(runtime, "normalizeShadows", () => normalizeShadows);
  bindRuntimeValue(runtime, "normalizeShadow", () => normalizeShadow);
  bindRuntimeValue(runtime, "normalizeGradient", () => normalizeGradient);
  bindRuntimeValue(
    runtime,
    "radialGradientPrelude",
    () => radialGradientPrelude,
  );
  bindRuntimeValue(runtime, "radialGradientPrefix", () => radialGradientPrefix);
  bindRuntimeValue(
    runtime,
    "normalizeStyleComponents",
    () => normalizeStyleComponents,
  );
  bindRuntimeValue(runtime, "normalizeCssSize", () => normalizeCssSize);
  bindRuntimeValue(runtime, "normalizeTransition", () => normalizeTransition);
  bindRuntimeValue(
    runtime,
    "normalizeStylePropertyValue",
    () => normalizeStylePropertyValue,
  );
  bindRuntimeValue(
    runtime,
    "animationPaintComplexity",
    () => animationPaintComplexity,
  );
  bindRuntimeValue(
    runtime,
    "transformComponentsForComplexity",
    () => transformComponentsForComplexity,
  );
  bindRuntimeValue(
    runtime,
    "logarithmicScaleDistance",
    () => logarithmicScaleDistance,
  );
  bindRuntimeValue(
    runtime,
    "transformComplexityDistance",
    () => transformComplexityDistance,
  );
  bindRuntimeValue(
    runtime,
    "transformAnimationExceedsBudget",
    () => transformAnimationExceedsBudget,
  );
  bindRuntimeValue(
    runtime,
    "normalizeAnimationStyle",
    () => normalizeAnimationStyle,
  );
  bindRuntimeValue(
    runtime,
    "normalizeStyleAnimation",
    () => normalizeStyleAnimation,
  );
  bindRuntimeValue(runtime, "normalizeHoverStyle", () => normalizeHoverStyle);
  bindRuntimeValue(runtime, "normalizeStyleBag", () => normalizeStyleBag);
  bindRuntimeValue(runtime, "shadowsToCss", () => shadowsToCss);
  bindRuntimeValue(runtime, "gradientToCss", () => gradientToCss);
  bindRuntimeValue(runtime, "filterToCss", () => filterToCss);
  bindRuntimeValue(runtime, "transformToCss", () => transformToCss);
  bindRuntimeValue(runtime, "cssSizeToString", () => cssSizeToString);
  bindRuntimeValue(runtime, "transitionToCss", () => transitionToCss);
  bindRuntimeValue(
    runtime,
    "writeCssStyleProperty",
    () => writeCssStyleProperty,
  );
  bindRuntimeValue(
    runtime,
    "supportsPaintContainment",
    () => supportsPaintContainment,
  );
  bindRuntimeValue(runtime, "styleBagToCss", () => styleBagToCss);
  bindRuntimeValue(runtime, "hoverStyleToCss", () => hoverStyleToCss);
  bindRuntimeValue(
    runtime,
    "styleAnimationToKeyframes",
    () => styleAnimationToKeyframes,
  );
  bindRuntimeValue(runtime, "hasPaintEffects", () => hasPaintEffects);
  bindRuntimeValue(runtime, "paintEffectCost", () => paintEffectCost);
  bindRuntimeValue(
    runtime,
    "isSlideNodeStyleKind",
    () => isSlideNodeStyleKind,
    (value) => {
      isSlideNodeStyleKind = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentTextNodeKinds",
    () => documentTextNodeKinds,
    (value) => {
      documentTextNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentBlockNodeKinds",
    () => documentBlockNodeKinds,
    (value) => {
      documentBlockNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentTableNodeKinds",
    () => documentTableNodeKinds,
    (value) => {
      documentTableNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentTableCellNodeKinds",
    () => documentTableCellNodeKinds,
    (value) => {
      documentTableCellNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideTextNodeKinds",
    () => slideTextNodeKinds,
    (value) => {
      slideTextNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideImageNodeKinds",
    () => slideImageNodeKinds,
    (value) => {
      slideImageNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideIconNodeKinds",
    () => slideIconNodeKinds,
    (value) => {
      slideIconNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideContainerNodeKinds",
    () => slideContainerNodeKinds,
    (value) => {
      slideContainerNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideTableNodeKinds",
    () => slideTableNodeKinds,
    (value) => {
      slideTableNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideShapeNodeKinds",
    () => slideShapeNodeKinds,
    (value) => {
      slideShapeNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "concatenateNodeKinds",
    () => concatenateNodeKinds,
    (value) => {
      concatenateNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allStyleNodeKinds",
    () => allStyleNodeKinds,
    (value) => {
      allStyleNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformableNodeKinds",
    () => transformableNodeKinds,
    (value) => {
      transformableNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyNodeKinds",
    () => typographyNodeKinds,
    (value) => {
      typographyNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "paintEffectNodeKinds",
    () => paintEffectNodeKinds,
    (value) => {
      paintEffectNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentStyleNodeKinds",
    () => documentStyleNodeKinds,
    (value) => {
      documentStyleNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontStyleValues",
    () => fontStyleValues,
    (value) => {
      fontStyleValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textAlignValues",
    () => textAlignValues,
    (value) => {
      textAlignValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textTransformValues",
    () => textTransformValues,
    (value) => {
      textTransformValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textDecorationLineValues",
    () => textDecorationLineValues,
    (value) => {
      textDecorationLineValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textDecorationStyleValues",
    () => textDecorationStyleValues,
    (value) => {
      textDecorationStyleValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyFallbackValues",
    () => fontFamilyFallbackValues,
    (value) => {
      fontFamilyFallbackValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "customFontFamilyPattern",
    () => customFontFamilyPattern,
    (value) => {
      customFontFamilyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reservedFontFamilies",
    () => reservedFontFamilies,
    (value) => {
      reservedFontFamilies = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontVariantNumericValues",
    () => fontVariantNumericValues,
    (value) => {
      fontVariantNumericValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderStyleValues",
    () => borderStyleValues,
    (value) => {
      borderStyleValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderSidesValues",
    () => borderSidesValues,
    (value) => {
      borderSidesValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blendModeValues",
    () => blendModeValues,
    (value) => {
      blendModeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "positionValues",
    () => positionValues,
    (value) => {
      positionValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "floatValues",
    () => floatValues,
    (value) => {
      floatValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "displayValues",
    () => displayValues,
    (value) => {
      displayValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "visibilityValues",
    () => visibilityValues,
    (value) => {
      visibilityValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "overflowValues",
    () => overflowValues,
    (value) => {
      overflowValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointerEventsValues",
    () => pointerEventsValues,
    (value) => {
      pointerEventsValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cursorValues",
    () => cursorValues,
    (value) => {
      cursorValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "easingValues",
    () => easingValues,
    (value) => {
      easingValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationDirectionValues",
    () => animationDirectionValues,
    (value) => {
      animationDirectionValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssFontFamilyFallbacks",
    () => cssFontFamilyFallbacks,
    (value) => {
      cssFontFamilyFallbacks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lengthSchema",
    () => lengthSchema,
    (value) => {
      lengthSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numberSchema",
    () => numberSchema,
    (value) => {
      numberSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "integerSchema",
    () => integerSchema,
    (value) => {
      integerSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "enumSchema",
    () => enumSchema,
    (value) => {
      enumSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "colorSchema",
    () => colorSchema,
    (value) => {
      colorSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxShadowCount",
    () => maxShadowCount,
    (value) => {
      maxShadowCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "radialGradientExtentValues",
    () => radialGradientExtentValues,
    (value) => {
      radialGradientExtentValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filterComponentSchemas",
    () => filterComponentSchemas,
    (value) => {
      filterComponentSchemas = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformComponentSchemas",
    () => transformComponentSchemas,
    (value) => {
      transformComponentSchemas = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyNames",
    () => stylePropertyNames,
    (value) => {
      stylePropertyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "paintEffectProperties",
    () => paintEffectProperties,
    (value) => {
      paintEffectProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animatableStyleProperties",
    () => animatableStyleProperties,
    (value) => {
      animatableStyleProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hoverStyleProperties",
    () => hoverStyleProperties,
    (value) => {
      hoverStyleProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nonTransformAnimationProperties",
    () => nonTransformAnimationProperties,
    (value) => {
      nonTransformAnimationProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyNameSet",
    () => stylePropertyNameSet,
    (value) => {
      stylePropertyNameSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "paintEffectPropertySet",
    () => paintEffectPropertySet,
    (value) => {
      paintEffectPropertySet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animatableStylePropertySet",
    () => animatableStylePropertySet,
    (value) => {
      animatableStylePropertySet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hoverStylePropertySet",
    () => hoverStylePropertySet,
    (value) => {
      hoverStylePropertySet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyDefinitions",
    () => stylePropertyDefinitions,
    (value) => {
      stylePropertyDefinitions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyRegistry",
    () => stylePropertyRegistry,
    (value) => {
      stylePropertyRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformForbiddenNodeKinds",
    () => transformForbiddenNodeKinds,
    (value) => {
      transformForbiddenNodeKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCssValueLength",
    () => maxCssValueLength,
    (value) => {
      maxCssValueLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsafeCssValuePattern",
    () => unsafeCssValuePattern,
    (value) => {
      unsafeCssValuePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssHexColorPattern",
    () => cssHexColorPattern,
    (value) => {
      cssHexColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssNamedColors",
    () => cssNamedColors,
    (value) => {
      cssNamedColors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssUnsignedNumberSource",
    () => cssUnsignedNumberSource,
    (value) => {
      cssUnsignedNumberSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssOptionalWhitespaceSource",
    () => cssOptionalWhitespaceSource,
    (value) => {
      cssOptionalWhitespaceSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssRequiredWhitespaceSource",
    () => cssRequiredWhitespaceSource,
    (value) => {
      cssRequiredWhitespaceSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "legacyRgbColorPattern",
    () => legacyRgbColorPattern,
    (value) => {
      legacyRgbColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modernRgbColorPattern",
    () => modernRgbColorPattern,
    (value) => {
      modernRgbColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "legacyHslColorPattern",
    () => legacyHslColorPattern,
    (value) => {
      legacyHslColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modernHslColorPattern",
    () => modernHslColorPattern,
    (value) => {
      modernHslColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isAllowedCustomFontFamily",
    () => isAllowedCustomFontFamily,
    (value) => {
      isAllowedCustomFontFamily = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasOwnStyleProperty",
    () => hasOwnStyleProperty,
    (value) => {
      hasOwnStyleProperty = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shadowOffsetSchema",
    () => shadowOffsetSchema,
    (value) => {
      shadowOffsetSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shadowBlurSchema",
    () => shadowBlurSchema,
    (value) => {
      shadowBlurSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shadowSpreadSchema",
    () => shadowSpreadSchema,
    (value) => {
      shadowSpreadSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultShadowBounds",
    () => defaultShadowBounds,
    (value) => {
      defaultShadowBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filterBounds",
    () => filterBounds,
    (value) => {
      filterBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformBounds",
    () => transformBounds,
    (value) => {
      transformBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientAngleSchema",
    () => gradientAngleSchema,
    (value) => {
      gradientAngleSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientStopPositionSchema",
    () => gradientStopPositionSchema,
    (value) => {
      gradientStopPositionSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "radialGradientCenterSchema",
    () => radialGradientCenterSchema,
    (value) => {
      radialGradientCenterSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientRepeatLengthSchema",
    () => gradientRepeatLengthSchema,
    (value) => {
      gradientRepeatLengthSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minGradientStops",
    () => minGradientStops,
    (value) => {
      minGradientStops = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxGradientStops",
    () => maxGradientStops,
    (value) => {
      maxGradientStops = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssPixelSizeSchema",
    () => cssPixelSizeSchema,
    (value) => {
      cssPixelSizeSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssPercentSizeSchema",
    () => cssPercentSizeSchema,
    (value) => {
      cssPercentSizeSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transitionDurationSchema",
    () => transitionDurationSchema,
    (value) => {
      transitionDurationSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transitionDelaySchema",
    () => transitionDelaySchema,
    (value) => {
      transitionDelaySchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationDurationSchema",
    () => animationDurationSchema,
    (value) => {
      animationDurationSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationDelaySchema",
    () => animationDelaySchema,
    (value) => {
      animationDelaySchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationIterationsSchema",
    () => animationIterationsSchema,
    (value) => {
      animationIterationsSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationKeyframePositionSchema",
    () => animationKeyframePositionSchema,
    (value) => {
      animationKeyframePositionSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minAnimationKeyframes",
    () => minAnimationKeyframes,
    (value) => {
      minAnimationKeyframes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxAnimationKeyframes",
    () => maxAnimationKeyframes,
    (value) => {
      maxAnimationKeyframes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxAnimationComplexity",
    () => maxAnimationComplexity,
    (value) => {
      maxAnimationComplexity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformTranslationCostScale",
    () => transformTranslationCostScale,
    (value) => {
      transformTranslationCostScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformAngleCostScale",
    () => transformAngleCostScale,
    (value) => {
      transformAngleCostScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transformScaleCostScale",
    () => transformScaleCostScale,
    (value) => {
      transformScaleCostScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssPixels",
    () => cssPixels,
    (value) => {
      cssPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transitionPropertyCssNames",
    () => transitionPropertyCssNames,
    (value) => {
      transitionPropertyCssNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "paintContainmentDependentProperties",
    () => paintContainmentDependentProperties,
    (value) => {
      paintContainmentDependentProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "paintContainmentSupported",
    () => paintContainmentSupported,
    (value) => {
      paintContainmentSupported = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dynamicStyleAttribute",
    () => dynamicStyleAttribute,
    (value) => {
      dynamicStyleAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeStyleSchema",
    () => initializeStyleSchema,
    (value) => {
      initializeStyleSchema = value;
    },
  );
  return () => {
    isSlideNodeStyleKind = (input: StyleNodeKind): boolean =>
      input.startsWith("slides-");
    concatenateNodeKinds = (...input: NodeKindList[]): StyleNodeKind[] =>
      input.flat();
    lengthSchema = (input: number, options: number): LengthSchema => ({
      kind: "len",
      lo: input,
      hi: options,
    });
    numberSchema = (input: number, options: number): NumberSchema => ({
      kind: "num",
      lo: input,
      hi: options,
    });
    integerSchema = (
      input: number,
      options: number,
      context: number,
    ): IntegerSchema => ({
      kind: "int",
      lo: input,
      hi: options,
      step: context,
    });
    enumSchema = (input: readonly string[]): EnumSchema => ({
      kind: "enum",
      values: input,
    });
    maxShadowCount = 8;
    maxCssValueLength = 64;
    cssUnsignedNumberSource = "(?:\\d{1,6}(?:\\.\\d{1,6})?|\\.\\d{1,6})";
    cssOptionalWhitespaceSource = "[ \\t\\n\\r\\f]*";
    cssRequiredWhitespaceSource = "[ \\t\\n\\r\\f]+";
    isAllowedCustomFontFamily = (input: unknown): input is string =>
      typeof input === "string" &&
      customFontFamilyPattern.test(input) &&
      !reservedFontFamilies.has(input.toLowerCase());
    hasOwnStyleProperty = (input: object, options: string): boolean =>
      Object.prototype.hasOwnProperty.call(input, options);
    minGradientStops = 2;
    maxGradientStops = 8;
    minAnimationKeyframes = 2;
    maxAnimationKeyframes = 8;
    maxAnimationComplexity = 333;
    transformTranslationCostScale = 100;
    transformAngleCostScale = 30;
    cssPixels = (input: number): string => `${input}px`;
    dynamicStyleAttribute = "data-style-dynamic";
    initializeStyleSchema = (0, runtime.initializeOnce)((): void => {
      documentTextNodeKinds = ["paragraph", "heading", "codeBlock"];
      documentBlockNodeKinds = [
        ...documentTextNodeKinds,
        "blockquote",
        "bulletList",
        "orderedList",
        "image",
      ];
      documentTableNodeKinds = ["table"];
      documentTableCellNodeKinds = ["table", "tableCell", "tableHeader"];
      slideTextNodeKinds = ["slides-text"];
      slideImageNodeKinds = ["slides-img"];
      slideIconNodeKinds = ["slides-icon"];
      slideContainerNodeKinds = ["slides-stack"];
      slideTableNodeKinds = ["slides-table"];
      slideShapeNodeKinds = ["slides-shape"];
      allStyleNodeKinds = concatenateNodeKinds(
        documentBlockNodeKinds,
        documentTableCellNodeKinds,
        slideTextNodeKinds,
        slideImageNodeKinds,
        slideIconNodeKinds,
        slideContainerNodeKinds,
        slideTableNodeKinds,
        slideShapeNodeKinds,
      );
      transformableNodeKinds = concatenateNodeKinds(
        documentBlockNodeKinds,
        documentTableCellNodeKinds,
        slideTextNodeKinds,
        slideImageNodeKinds,
        slideIconNodeKinds,
        slideContainerNodeKinds,
        slideTableNodeKinds,
      );
      typographyNodeKinds = concatenateNodeKinds(
        documentBlockNodeKinds,
        documentTableCellNodeKinds,
        slideTextNodeKinds,
        slideTableNodeKinds,
      );
      paintEffectNodeKinds = concatenateNodeKinds(
        documentBlockNodeKinds,
        documentTableNodeKinds,
        slideTextNodeKinds,
        slideImageNodeKinds,
        slideIconNodeKinds,
        slideContainerNodeKinds,
        slideTableNodeKinds,
        slideShapeNodeKinds,
      );
      documentStyleNodeKinds = concatenateNodeKinds(
        documentBlockNodeKinds,
        documentTableCellNodeKinds,
      );
      fontStyleValues = ["normal", "italic"];
      textAlignValues = ["left", "center", "right", "justify"];
      textTransformValues = ["none", "uppercase", "lowercase", "capitalize"];
      textDecorationLineValues = ["none", "underline", "line-through"];
      textDecorationStyleValues = [
        "solid",
        "double",
        "dotted",
        "dashed",
        "wavy",
      ];
      fontFamilyFallbackValues = ["sans", "serif", "mono", "helvetica"];
      customFontFamilyPattern = /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/;
      reservedFontFamilies = new Set([
        "inherit",
        "initial",
        "unset",
        "revert",
        "revert-layer",
        "default",
        "serif",
        "sans-serif",
        "monospace",
        "cursive",
        "fantasy",
        "system-ui",
        "math",
        "emoji",
        "fangsong",
        "ui-serif",
        "ui-sans-serif",
        "ui-monospace",
        "ui-rounded",
      ]);
      fontVariantNumericValues = ["normal", "tabular-nums"];
      borderStyleValues = ["none", "solid", "dashed", "dotted", "double"];
      borderSidesValues = [
        "top",
        "right",
        "bottom",
        "left",
        "top right",
        "top bottom",
        "top left",
        "right bottom",
        "right left",
        "bottom left",
        "top right bottom",
        "top right left",
        "top bottom left",
        "right bottom left",
      ];
      blendModeValues = [
        "normal",
        "multiply",
        "screen",
        "overlay",
        "darken",
        "lighten",
      ];
      positionValues = ["static", "relative", "absolute", "sticky", "fixed"];
      floatValues = ["none", "left", "right"];
      displayValues = ["block", "inline-block", "flex", "grid", "none"];
      visibilityValues = ["visible", "hidden"];
      overflowValues = ["visible", "hidden", "clip", "auto", "scroll"];
      pointerEventsValues = ["auto", "none"];
      cursorValues = [
        "default",
        "pointer",
        "text",
        "move",
        "grab",
        "grabbing",
        "crosshair",
        "not-allowed",
        "zoom-in",
        "zoom-out",
        "help",
        "wait",
      ];
      easingValues = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];
      animationDirectionValues = ["normal", "reverse", "alternate"];
      cssFontFamilyFallbacks = {
        sans: "ui-sans-serif, system-ui, sans-serif",
        serif: "ui-serif, Georgia, serif",
        mono: "ui-monospace, Menlo, Consolas, monospace",
        helvetica: "Helvetica Neue, Helvetica, Arial, sans-serif",
      };
      colorSchema = {
        kind: "color",
      };
      radialGradientExtentValues = [
        "closest-side",
        "closest-corner",
        "farthest-side",
      ];
      filterComponentSchemas = [
        {
          field: "blur",
          cls: lengthSchema(0, 20),
          fn: "blur",
          unit: "px",
        },
        {
          field: "brightness",
          cls: numberSchema(0, 2),
          fn: "brightness",
          unit: "",
        },
        {
          field: "contrast",
          cls: numberSchema(0, 2),
          fn: "contrast",
          unit: "",
        },
        {
          field: "saturate",
          cls: numberSchema(0, 3),
          fn: "saturate",
          unit: "",
        },
        {
          field: "grayscale",
          cls: numberSchema(0, 1),
          fn: "grayscale",
          unit: "",
        },
        {
          field: "sepia",
          cls: numberSchema(0, 1),
          fn: "sepia",
          unit: "",
        },
        {
          field: "invert",
          cls: numberSchema(0, 1),
          fn: "invert",
          unit: "",
        },
        {
          field: "hueRotate",
          cls: numberSchema(0, 360),
          fn: "hue-rotate",
          unit: "deg",
        },
      ];
      transformComponentSchemas = [
        {
          field: "translateX",
          cls: lengthSchema(-4096, 4096),
        },
        {
          field: "translateY",
          cls: lengthSchema(-4096, 4096),
        },
        {
          field: "rotate",
          cls: numberSchema(-180, 180),
        },
        {
          field: "scale",
          cls: numberSchema(0.5, 2),
        },
        {
          field: "skewX",
          cls: numberSchema(-60, 60),
        },
        {
          field: "skewY",
          cls: numberSchema(-60, 60),
        },
      ];
      stylePropertyNames = [
        "fontSize",
        "fontWeight",
        "fontStyle",
        "lineHeight",
        "letterSpacing",
        "textAlign",
        "textTransform",
        "textDecorationLine",
        "textDecorationStyle",
        "textDecorationColor",
        "fontFamily",
        "fontVariantNumeric",
        "color",
        "backgroundColor",
        "backgroundGradient",
        "marginTop",
        "marginRight",
        "marginBottom",
        "marginLeft",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "borderWidth",
        "borderStyle",
        "borderColor",
        "borderSides",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderRadius",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
        "opacity",
        "boxShadow",
        "textShadow",
        "textStrokeWidth",
        "textStrokeColor",
        "filter",
        "backdropFilter",
        "transform",
        "mixBlendMode",
        "position",
        "top",
        "right",
        "bottom",
        "left",
        "zIndex",
        "float",
        "display",
        "visibility",
        "overflow",
        "pointerEvents",
        "cursor",
        "width",
        "height",
        "minWidth",
        "minHeight",
        "maxWidth",
        "maxHeight",
        "transition",
        "animation",
      ];
      paintEffectProperties = [
        "boxShadow",
        "textShadow",
        "filter",
        "backdropFilter",
        "mixBlendMode",
      ];
      animatableStyleProperties = [
        "transform",
        "opacity",
        "color",
        "backgroundColor",
        "filter",
        "boxShadow",
      ];
      hoverStyleProperties = [
        "color",
        "backgroundColor",
        "backgroundGradient",
        "borderColor",
        "textDecorationLine",
        "textDecorationStyle",
        "textDecorationColor",
        "opacity",
        "boxShadow",
        "textShadow",
        "filter",
        "cursor",
      ];
      nonTransformAnimationProperties = [
        "opacity",
        "color",
        "backgroundColor",
        "filter",
        "boxShadow",
      ];
      stylePropertyNameSet = new Set(stylePropertyNames);
      paintEffectPropertySet = new Set(paintEffectProperties);
      animatableStylePropertySet = new Set(animatableStyleProperties);
      hoverStylePropertySet = new Set(hoverStyleProperties);
      stylePropertyDefinitions = {
        fontSize: {
          v: lengthSchema(8, 128),
          slides: lengthSchema(8, 400),
          on: typographyNodeKinds,
        },
        fontWeight: {
          v: integerSchema(100, 900, 100),
          on: typographyNodeKinds,
        },
        fontStyle: {
          v: enumSchema(fontStyleValues),
          on: typographyNodeKinds,
        },
        lineHeight: {
          v: numberSchema(0.75, 4),
          slides: numberSchema(0.5, 4),
          on: typographyNodeKinds,
        },
        letterSpacing: {
          v: lengthSchema(-4, 32),
          slides: lengthSchema(-24, 32),
          on: typographyNodeKinds,
        },
        textAlign: {
          v: enumSchema(textAlignValues),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTableNodeKinds,
          ),
          routed: slideTextNodeKinds,
        },
        textTransform: {
          v: enumSchema(textTransformValues),
          on: typographyNodeKinds,
        },
        textDecorationLine: {
          v: enumSchema(textDecorationLineValues),
          on: typographyNodeKinds,
        },
        textDecorationStyle: {
          v: enumSchema(textDecorationStyleValues),
          on: typographyNodeKinds,
        },
        textDecorationColor: {
          v: colorSchema,
          on: typographyNodeKinds,
        },
        fontFamily: {
          v: enumSchema(fontFamilyFallbackValues),
          slides: {
            kind: "fontFamily",
          },
          on: typographyNodeKinds,
        },
        fontVariantNumeric: {
          v: enumSchema(fontVariantNumericValues),
          on: typographyNodeKinds,
        },
        color: {
          v: colorSchema,
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTableNodeKinds,
          ),
          routed: concatenateNodeKinds(slideTextNodeKinds, slideIconNodeKinds),
        },
        backgroundColor: {
          v: colorSchema,
          on: allStyleNodeKinds,
        },
        backgroundGradient: {
          v: {
            kind: "gradient",
          },
          slides: {
            kind: "gradient",
            repeat: true,
          },
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            slideTextNodeKinds,
            slideImageNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
          ),
        },
        marginTop: {
          v: lengthSchema(0, 256),
          on: documentBlockNodeKinds,
        },
        marginRight: {
          v: lengthSchema(0, 256),
          on: documentBlockNodeKinds,
        },
        marginBottom: {
          v: lengthSchema(0, 256),
          on: documentBlockNodeKinds,
        },
        marginLeft: {
          v: lengthSchema(0, 256),
          on: documentBlockNodeKinds,
        },
        paddingTop: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
          ),
        },
        paddingRight: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
          ),
        },
        paddingBottom: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
          ),
        },
        paddingLeft: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
          ),
        },
        borderWidth: {
          v: lengthSchema(0, 16),
          shape: lengthSchema(0, 32),
          on: allStyleNodeKinds,
        },
        borderStyle: {
          v: enumSchema(borderStyleValues),
          on: allStyleNodeKinds,
        },
        borderColor: {
          v: colorSchema,
          on: allStyleNodeKinds,
        },
        borderSides: {
          v: enumSchema(borderSidesValues),
          on: transformableNodeKinds,
        },
        borderTopWidth: {
          v: lengthSchema(0, 16),
          on: transformableNodeKinds,
        },
        borderRightWidth: {
          v: lengthSchema(0, 16),
          on: transformableNodeKinds,
        },
        borderBottomWidth: {
          v: lengthSchema(0, 16),
          on: transformableNodeKinds,
        },
        borderLeftWidth: {
          v: lengthSchema(0, 16),
          on: transformableNodeKinds,
        },
        borderRadius: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideImageNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
            slideShapeNodeKinds,
          ),
        },
        borderTopLeftRadius: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideImageNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
            slideShapeNodeKinds,
          ),
        },
        borderTopRightRadius: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideImageNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
            slideShapeNodeKinds,
          ),
        },
        borderBottomRightRadius: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideImageNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
            slideShapeNodeKinds,
          ),
        },
        borderBottomLeftRadius: {
          v: lengthSchema(0, 256),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideTextNodeKinds,
            slideImageNodeKinds,
            slideContainerNodeKinds,
            slideTableNodeKinds,
            slideShapeNodeKinds,
          ),
        },
        opacity: {
          v: numberSchema(0, 1),
          on: allStyleNodeKinds,
        },
        boxShadow: {
          v: {
            kind: "shadow",
            spread: true,
          },
          slides: {
            kind: "shadow",
            spread: true,
            blur: lengthSchema(0, 160),
          },
          on: paintEffectNodeKinds,
        },
        textShadow: {
          v: {
            kind: "shadow",
            spread: false,
          },
          on: concatenateNodeKinds(
            documentTextNodeKinds,
            slideTextNodeKinds,
            slideTableNodeKinds,
          ),
        },
        textStrokeWidth: {
          v: lengthSchema(0, 8),
          on: concatenateNodeKinds(
            documentTextNodeKinds,
            slideTextNodeKinds,
            slideTableNodeKinds,
          ),
        },
        textStrokeColor: {
          v: colorSchema,
          on: concatenateNodeKinds(
            documentTextNodeKinds,
            slideTextNodeKinds,
            slideTableNodeKinds,
          ),
        },
        filter: {
          v: {
            kind: "filter",
          },
          on: paintEffectNodeKinds,
        },
        backdropFilter: {
          v: {
            kind: "filter",
          },
          on: paintEffectNodeKinds,
        },
        transform: {
          v: {
            kind: "transform",
          },
          on: transformableNodeKinds,
          routed: slideShapeNodeKinds,
        },
        mixBlendMode: {
          v: enumSchema(blendModeValues),
          on: paintEffectNodeKinds,
        },
        position: {
          v: enumSchema(positionValues),
          on: documentStyleNodeKinds,
        },
        top: {
          v: lengthSchema(-4096, 4096),
          on: documentStyleNodeKinds,
        },
        right: {
          v: lengthSchema(-4096, 4096),
          on: documentStyleNodeKinds,
        },
        bottom: {
          v: lengthSchema(-4096, 4096),
          on: documentStyleNodeKinds,
        },
        left: {
          v: lengthSchema(-4096, 4096),
          on: documentStyleNodeKinds,
        },
        zIndex: {
          v: integerSchema(-999, 999, 1),
          on: documentStyleNodeKinds,
        },
        float: {
          v: enumSchema(floatValues),
          on: documentStyleNodeKinds,
        },
        display: {
          v: enumSchema(displayValues),
          on: documentStyleNodeKinds,
        },
        visibility: {
          v: enumSchema(visibilityValues),
          on: allStyleNodeKinds,
        },
        overflow: {
          v: enumSchema(overflowValues),
          on: concatenateNodeKinds(
            documentBlockNodeKinds,
            documentTableCellNodeKinds,
            slideContainerNodeKinds,
          ),
        },
        pointerEvents: {
          v: enumSchema(pointerEventsValues),
          on: allStyleNodeKinds,
        },
        cursor: {
          v: enumSchema(cursorValues),
          on: allStyleNodeKinds,
        },
        width: {
          v: {
            kind: "size",
          },
          on: documentStyleNodeKinds,
        },
        height: {
          v: {
            kind: "size",
          },
          on: documentStyleNodeKinds,
        },
        minWidth: {
          v: {
            kind: "size",
          },
          on: documentStyleNodeKinds,
        },
        minHeight: {
          v: {
            kind: "size",
          },
          on: documentStyleNodeKinds,
        },
        maxWidth: {
          v: {
            kind: "size",
          },
          on: documentStyleNodeKinds,
        },
        maxHeight: {
          v: {
            kind: "size",
          },
          on: documentStyleNodeKinds,
        },
        transition: {
          v: {
            kind: "transition",
          },
          on: allStyleNodeKinds,
        },
        animation: {
          v: {
            kind: "animation",
          },
          on: allStyleNodeKinds,
        },
      };
      stylePropertyRegistry = buildStylePropertyRegistry();
      transformForbiddenNodeKinds = ["table", "tableCell", "tableHeader"];
      unsafeCssValuePattern =
        /[;{}@<>"'\\\n\r\f\0]|\/\*|(?:url|expression|image-set|image|element|cross-fade|paint|var|env|attr|src|counters?)\s*\(/i;
      cssHexColorPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
      cssNamedColors = new Set([
        "transparent",
        "currentcolor",
        "aliceblue",
        "antiquewhite",
        "aqua",
        "aquamarine",
        "azure",
        "beige",
        "bisque",
        "black",
        "blanchedalmond",
        "blue",
        "blueviolet",
        "brown",
        "burlywood",
        "cadetblue",
        "chartreuse",
        "chocolate",
        "coral",
        "cornflowerblue",
        "cornsilk",
        "crimson",
        "cyan",
        "darkblue",
        "darkcyan",
        "darkgoldenrod",
        "darkgray",
        "darkgrey",
        "darkgreen",
        "darkkhaki",
        "darkmagenta",
        "darkolivegreen",
        "darkorange",
        "darkorchid",
        "darkred",
        "darksalmon",
        "darkseagreen",
        "darkslateblue",
        "darkslategray",
        "darkslategrey",
        "darkturquoise",
        "darkviolet",
        "deeppink",
        "deepskyblue",
        "dimgray",
        "dimgrey",
        "dodgerblue",
        "firebrick",
        "floralwhite",
        "forestgreen",
        "fuchsia",
        "gainsboro",
        "ghostwhite",
        "gold",
        "goldenrod",
        "gray",
        "grey",
        "green",
        "greenyellow",
        "honeydew",
        "hotpink",
        "indianred",
        "indigo",
        "ivory",
        "khaki",
        "lavender",
        "lavenderblush",
        "lawngreen",
        "lemonchiffon",
        "lightblue",
        "lightcoral",
        "lightcyan",
        "lightgoldenrodyellow",
        "lightgray",
        "lightgrey",
        "lightgreen",
        "lightpink",
        "lightsalmon",
        "lightseagreen",
        "lightskyblue",
        "lightslategray",
        "lightslategrey",
        "lightsteelblue",
        "lightyellow",
        "lime",
        "limegreen",
        "linen",
        "magenta",
        "maroon",
        "mediumaquamarine",
        "mediumblue",
        "mediumorchid",
        "mediumpurple",
        "mediumseagreen",
        "mediumslateblue",
        "mediumspringgreen",
        "mediumturquoise",
        "mediumvioletred",
        "midnightblue",
        "mintcream",
        "mistyrose",
        "moccasin",
        "navajowhite",
        "navy",
        "oldlace",
        "olive",
        "olivedrab",
        "orange",
        "orangered",
        "orchid",
        "palegoldenrod",
        "palegreen",
        "paleturquoise",
        "palevioletred",
        "papayawhip",
        "peachpuff",
        "peru",
        "pink",
        "plum",
        "powderblue",
        "purple",
        "rebeccapurple",
        "red",
        "rosybrown",
        "royalblue",
        "saddlebrown",
        "salmon",
        "sandybrown",
        "seagreen",
        "seashell",
        "sienna",
        "silver",
        "skyblue",
        "slateblue",
        "slategray",
        "slategrey",
        "snow",
        "springgreen",
        "steelblue",
        "tan",
        "teal",
        "thistle",
        "tomato",
        "turquoise",
        "violet",
        "wheat",
        "white",
        "whitesmoke",
        "yellow",
        "yellowgreen",
      ]);
      legacyRgbColorPattern = new RegExp(
        "^rgba?\\(" +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          "," +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          "," +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          "(?:," +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          ")?\\)$",
      );
      modernRgbColorPattern = new RegExp(
        "^rgba?\\(" +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssRequiredWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssRequiredWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          "(?:/" +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          ")?\\)$",
      );
      legacyHslColorPattern = new RegExp(
        "^hsla?\\(" +
          cssOptionalWhitespaceSource +
          "-?" +
          cssUnsignedNumberSource +
          "(?:deg)?" +
          cssOptionalWhitespaceSource +
          "," +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%" +
          cssOptionalWhitespaceSource +
          "," +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%" +
          cssOptionalWhitespaceSource +
          "(?:," +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          ")?\\)$",
      );
      modernHslColorPattern = new RegExp(
        "^hsla?\\(" +
          cssOptionalWhitespaceSource +
          "-?" +
          cssUnsignedNumberSource +
          "(?:deg)?" +
          cssRequiredWhitespaceSource +
          cssUnsignedNumberSource +
          "%" +
          cssRequiredWhitespaceSource +
          cssUnsignedNumberSource +
          "%" +
          cssOptionalWhitespaceSource +
          "(?:/" +
          cssOptionalWhitespaceSource +
          cssUnsignedNumberSource +
          "%?" +
          cssOptionalWhitespaceSource +
          ")?\\)$",
      );
      shadowOffsetSchema = lengthSchema(-64, 64);
      shadowBlurSchema = lengthSchema(0, 64);
      shadowSpreadSchema = lengthSchema(-32, 32);
      defaultShadowBounds = {
        x: numericSchemaBounds(shadowOffsetSchema),
        y: numericSchemaBounds(shadowOffsetSchema),
        blur: numericSchemaBounds(shadowBlurSchema),
        spread: numericSchemaBounds(shadowSpreadSchema),
      };
      filterBounds = componentSchemaBounds(filterComponentSchemas);
      transformBounds = componentSchemaBounds(transformComponentSchemas);
      gradientAngleSchema = numberSchema(0, 360);
      gradientStopPositionSchema = numberSchema(0, 100);
      radialGradientCenterSchema = numberSchema(-100, 200);
      gradientRepeatLengthSchema = lengthSchema(2, 2048);
      cssPixelSizeSchema = lengthSchema(0, 4096);
      cssPercentSizeSchema = numberSchema(1, 100);
      transitionDurationSchema = numberSchema(0, 5000);
      transitionDelaySchema = numberSchema(0, 5000);
      animationDurationSchema = numberSchema(200, 1e4);
      animationDelaySchema = numberSchema(0, 5000);
      animationIterationsSchema = integerSchema(1, 1000, 1);
      animationKeyframePositionSchema = numberSchema(0, 100);
      transformScaleCostScale = Math.LN2;
      transitionPropertyCssNames = {
        transform: "transform",
        opacity: "opacity",
        color: "color",
        backgroundColor: "background-color",
        filter: "filter",
        boxShadow: "box-shadow",
      };
      paintContainmentDependentProperties = [
        "position",
        "top",
        "right",
        "bottom",
        "left",
        "zIndex",
        "float",
      ];
    });
  };
}
