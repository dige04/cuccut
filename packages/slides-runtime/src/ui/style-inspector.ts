/** Restored application module; prepare first, initialize in original order. */
import type {
  Dispatch,
  FocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import type {
  CssSizeValue,
  GradientStop,
  GradientValue,
  StyleBag,
  StylePropertyName,
} from "../deck-contracts";
import type {
  NumericBounds,
  StyleNodeKind,
  StyleValue,
  StyleValueSchema,
} from "../model/style-schema";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** A record whose fields are validated before use; compound style values may be hand-authored. */
export type StyleRecord = Record<string, unknown>;
/** A value the inspector commits to a style property; the style schema normalises it downstream. */
export type StyleDraftValue = StyleValue | StyleRecord | readonly StyleRecord[];
/** Property name to new value; `undefined` clears the property. */
export type StylePatch = Record<string, StyleDraftValue | undefined>;
/** Kinds of numeric validator the inspector builds itself. */
export type StyleNumericKind = "len" | "num";
/** Numeric/enum view of a style value schema; `numericValidator` also builds these ad hoc. */
export interface StyleValidatorView {
  kind: string;
  lo?: number;
  hi?: number;
  step?: number;
  values?: readonly string[];
}
/** Properties mapped to the properties that are cleared together with them. */
export type StyleKeyGroups = Partial<
  Record<StylePropertyName, readonly StylePropertyName[]>
>;
export type StyleCompoundShape = "shadow" | "gradient" | "filter" | "transform";
/** How one style property is edited in the inspector. */
export type StyleRowModel =
  | { row: "slider"; min: number; max: number; step: number }
  | { row: "number"; min: number; max: number; step: number }
  | { row: "segmented"; options: string[] }
  | { row: "select"; options: string[] }
  | { row: "color" }
  | { row: "text" }
  | { row: "size" }
  | { row: "compound"; shape: StyleCompoundShape }
  | { row: "deferred" };
export interface StyleRowEntry {
  key: StylePropertyName;
  model: StyleRowModel;
}
export interface StyleGroup {
  group: string;
  rows: StyleRowEntry[];
}
/** One numeric field of a compound value (shadow, filter, transform) with its limits. */
export interface StyleFieldDescriptor {
  field: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  kind: StyleNumericKind;
}
/** The x, y and blur fields of a shadow, in editor order. */
export type ShadowFieldDescriptors = [
  StyleFieldDescriptor,
  StyleFieldDescriptor,
  StyleFieldDescriptor,
];
export interface StyleFieldBounds {
  min: number;
  max: number;
  step: number;
}
/** Shadow layer as the shadow editor reads and writes it. */
export type StyleShadowDraft = {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  inset?: boolean;
  color: string;
};
export interface StyleEnumOption {
  value: string;
  label: string;
}
/** Which shadow the "Drop shadow" row edits: the box, or the text of a text node. */
export type ShadowTarget = "box" | "text";
export interface StyleEffectAddItem {
  label: string;
  onSelect: () => void;
  disabledReason?: string;
}
/** Which compound row has its popover open: the property and the index of the layer. */
export interface StyleOpenEditor {
  key: StylePropertyName;
  index: number;
}
export type StyleCommit = (
  key: StylePropertyName,
  value: StyleDraftValue | undefined,
) => void;
export type StyleBagCallback = (
  bag: StyleBag | undefined,
  patch: StylePatch,
) => void;
/** Options for `createStyleEditor` (and the props shared by the inspector components). */
export interface StyleEditorOptions {
  /** Node kind whose style schema applies, e.g. `slides-text`. */
  kind: StyleNodeKind;
  bag?: StyleBag;
  onCommit: StyleBagCallback;
  /** Live (uncommitted) update while scrubbing; enabled together with `onLiveEnd`. */
  onLive?: StyleBagCallback;
  onLiveEnd?: () => void;
  disabled?: boolean;
  /** Properties that cannot be edited, mapped to the reason shown on the row. */
  disabledKeys?: ReadonlyMap<string, string>;
  /** Color swatches forwarded untouched to the color rows. */
  swatches?: readonly unknown[];
  /** Properties cleared together with a property (a shorthand and its longhands). */
  clearKeys?: StyleKeyGroups;
  /** Properties whose value differs across the selection. */
  mixedKeys?: ReadonlySet<string>;
  unifiedColorPopover?: boolean;
}
/** Editing handle for one style bag, shared by the rows of an inspector. */
export interface StyleEditor {
  kind: StyleNodeKind;
  bag: StyleBag | undefined;
  disabled: boolean;
  disabledKeys: ReadonlyMap<string, string> | undefined;
  swatches: readonly unknown[] | undefined;
  clearKeys: StyleKeyGroups | undefined;
  mixedKeys: ReadonlySet<string> | undefined;
  unifiedColorPopover: boolean;
  clear: (keys: readonly StylePropertyName[]) => void;
  commit: StyleCommit;
  live: StyleCommit | undefined;
  liveEnd: (() => void) | undefined;
}
/** A style editor plus the inspector-wide "which popover is open" state. */
export interface StyleEditorState extends StyleEditor {
  openEditor?: StyleOpenEditor | undefined;
  setOpenEditor?: Dispatch<SetStateAction<StyleOpenEditor | undefined>>;
  whyDisabled?: string;
}
export interface StyleInspectorProps extends StyleEditorOptions {
  nested?: boolean;
  effectsLifted?: boolean;
  hiddenKeys?: ReadonlySet<string>;
  onlyKeys?: readonly StylePropertyName[];
}
export interface StyleEffectsInspectorProps extends StyleEditorOptions {
  subsection?: boolean;
  blurRows?: boolean;
  children?: ReactNode;
  shadowTarget?: ShadowTarget;
  dropShadowDisabledReason?: string;
  silhouette?: boolean;
  silhouetteReason?: string;
  addItems?: readonly StyleEffectAddItem[];
  openEditor?: StyleOpenEditor | undefined;
  setOpenEditor?: Dispatch<SetStateAction<StyleOpenEditor | undefined>>;
}
export interface StylePropertyRowProps {
  propKey: StylePropertyName;
  model: StyleRowModel;
  ed: StyleEditorState;
}
export interface StyleValueRowProps extends StylePropertyRowProps {
  value: StyleValue | undefined;
  onReset: (() => void) | undefined;
}
export interface StyleColorTextRowProps {
  label: string;
  value: string | undefined;
  propKey: StylePropertyName;
  ed: StyleEditorState;
  onReset: (() => void) | undefined;
}
export interface StyleLengthRowProps {
  label: string;
  value: StyleValue | undefined;
  propKey: StylePropertyName;
  ed: StyleEditorState;
  onReset: (() => void) | undefined;
}
export interface StyleRecordRowProps {
  label: string;
  shape: StyleCompoundShape;
  value: StyleValue | undefined;
  propKey: StylePropertyName;
  ed: StyleEditorState;
  onReset: (() => void) | undefined;
}
/** Numeric `onScrub` props for a number row; empty when the editor has no live updates. */
export interface StyleScrubProps {
  onScrub?: (value: number) => void;
  onScrubEnd?: () => void;
}
export interface StyleLiveProps<T> {
  onLive?: (value: T) => void;
  onLiveEnd?: () => void;
}
/** State of one compound-value popover (open flag, anchor, keyboard origin). */
export interface NestedStyleEditor {
  open: boolean;
  setOpen: (open: boolean) => void;
  removed: () => void;
  byKeyboard: boolean;
  setByKeyboard: Dispatch<SetStateAction<boolean>>;
  wrapRef: RefObject<HTMLSpanElement | null>;
  anchor: () => Element | null;
}
export type StyleFieldSetter = (
  field: string,
  value: number | undefined,
) => void;
export type StyleFieldLiveSetter = (
  field: string,
) => ((value: number) => void) | undefined;
export interface NestedStyleNumberRowsProps {
  fields: readonly StyleFieldDescriptor[];
  rec: StyleRecord;
  setField: StyleFieldSetter;
  liveField: StyleFieldLiveSetter;
  ed: StyleEditorState;
}
export interface NestedStylePopoverRowProps {
  label: string;
  fields: readonly StyleFieldDescriptor[];
  propKey: StylePropertyName;
  rec: StyleRecord | undefined;
  ed: StyleEditorState;
  setField: StyleFieldSetter;
  liveField: StyleFieldLiveSetter;
}
export interface ShadowStyleRowProps {
  propKey: StylePropertyName;
  list: StyleRecord[];
  index: number;
  rec: StyleRecord | undefined;
  ed: StyleEditorState;
  label?: string;
}
export interface BlurStyleRowProps {
  label: string;
  propKey: StylePropertyName;
  rec: StyleRecord;
  ed: StyleEditorState;
}
/** Gradient stop whose position may still be unset (spread evenly by the gradient editor). */
export interface GradientStopDraft {
  color: string;
  pos?: number;
}
export interface GradientStyleEditorProps {
  rec: StyleRecord | GradientValue;
  propKey: StylePropertyName;
  ed: StyleEditor;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactL9: ReactNamespace;
    jsxTJ: JsxNamespace;
    propertyValidatorKind: (validator: StyleValidatorView) => string;
    propertyValidatorNumber: (
      validator: StyleValidatorView,
      key: "lo" | "hi" | "step",
      fallback: number,
    ) => number;
    propertyValidatorStringArray: (
      validator: StyleValidatorView,
      key: "values",
    ) => string[];
    stylePropertyValidator: (
      property: StylePropertyName,
      kind: StyleNodeKind,
    ) => StyleValueSchema;
    stylePropertyRowModel: (
      validator: StyleValidatorView,
      coarse: boolean,
    ) => StyleRowModel;
    stylePropertyGroup: (property: string) => string;
    stylePropertyGroups: (kind: StyleNodeKind, coarse: boolean) => StyleGroup[];
    setStyleProperty: (
      bag: StyleBag | undefined,
      key: StylePropertyName,
      value: StyleDraftValue | undefined,
    ) => StyleBag;
    deleteStyleProperty: (
      bag: StyleBag | undefined,
      key: StylePropertyName,
    ) => StyleBag | undefined;
    setStyleShorthand: (
      bag: StyleBag | undefined,
      key: StylePropertyName,
      value: StyleDraftValue | undefined,
    ) => StyleBag | undefined;
    styleShorthandPatch: (
      key: StylePropertyName,
      value: StyleDraftValue | undefined,
    ) => StylePatch;
    normalizeNegativeZero: (value: number) => number;
    clampValidatorNumber: (
      validator: StyleValidatorView,
      value: number,
    ) => number;
    clampStyleNumber: (value: number, min: number, max: number) => number;
    numericValidator: (
      kind: StyleNumericKind,
      min: number,
      max: number,
    ) => StyleValidatorView;
    styleLengthValue: (unit: string, value: number) => CssSizeValue;
    styleFieldDescriptor: (
      bounds: Readonly<Record<string, NumericBounds | undefined>>,
      field: string,
      label: string,
      kind: StyleNumericKind,
      step: number,
      unit?: string,
    ) => StyleFieldDescriptor;
    clampStyleField: (field: StyleFieldDescriptor, value: number) => number;
    defaultStylePropertyValue: (
      property: StylePropertyName,
      kind: StyleNodeKind,
    ) => StyleDraftValue | undefined;
    defaultShadowValue: (
      property: StylePropertyName,
      inset: boolean,
    ) => StyleShadowDraft;
    ownStyleProperty: (
      bag: StyleBag | undefined,
      key: StylePropertyName,
    ) => StyleValue | undefined;
    finiteStyleNumber: (value: unknown) => number | undefined;
    styleStringValue: (value: unknown) => string | undefined;
    styleRecordValue: (value: unknown) => StyleRecord | undefined;
    styleEffectRecords: (value: unknown) => StyleRecord[];
    styleEffectLabel: (key: StylePropertyName, value: unknown) => string;
    stylePropertyLabel: (key: string) => string;
    styleEnumValueLabel: (value: string) => string;
    styleEnumOptions: (values: readonly string[]) => StyleEnumOption[];
    styleValuesEqual: (left: unknown, right: unknown) => boolean;
    changedStyleProperty: (
      bag: StyleBag | undefined,
      key: StylePropertyName,
      value: StyleDraftValue | undefined,
    ) => { next: StyleBag | undefined } | undefined;
    createStyleEditor: (options: StyleEditorOptions) => StyleEditor;
    StyleInspector: (props: StyleInspectorProps) => ReactElement | null;
    styleEffectAddItems: (
      kind: StyleNodeKind,
      bag: StyleBag | undefined,
      commit: StyleCommit,
      shadowTarget?: ShadowTarget,
      canInset?: string,
      mixed?: boolean,
      dropShadowReason?: string,
    ) => StyleEffectAddItem[];
    shadowStyleKey: (
      kind: StyleNodeKind,
      target: ShadowTarget,
    ) => "textShadow" | "boxShadow";
    StyleEffectsInspector: (
      props: StyleEffectsInspectorProps,
    ) => ReactElement | null;
    StylePropertyRow: (props: StylePropertyRowProps) => ReactElement;
    styleScrubProps: (
      editor: StyleEditor,
      key: StylePropertyName,
      convert: (value: number) => StyleDraftValue | undefined,
    ) => StyleScrubProps;
    styleLiveColorProps: (
      editor: StyleEditor,
      key: StylePropertyName,
      convert: (value: number) => StyleDraftValue | undefined,
    ) => StyleLiveProps<number>;
    validatedColorLiveProps: (
      editor: StyleEditor,
      onChange: ((value: string) => void) | undefined,
    ) => StyleLiveProps<string>;
    StyleValueRow: (props: StyleValueRowProps) => ReactElement | null;
    StyleRemoveShorthandButton: (
      editor: StyleEditor,
      key: StylePropertyName,
      label: string,
    ) => ReactElement | undefined;
    validatedStyleColor: (color: string) => string | undefined;
    StyleColorTextRow: (props: StyleColorTextRowProps) => ReactElement;
    StyleLengthRow: (props: StyleLengthRowProps) => ReactElement;
    setRecordField: (
      record: StyleRecord | undefined,
      field: string,
      value: unknown,
    ) => StyleRecord | undefined;
    StyleRecordRow: (props: StyleRecordRowProps) => ReactElement;
    useNestedStyleEditor: (
      key: StylePropertyName,
      editor: StyleEditorState,
      index?: number,
    ) => NestedStyleEditor;
    NestedStyleNumberRows: (props: NestedStyleNumberRowsProps) => ReactElement;
    normalizedShadowRecord: (
      record: StyleRecord,
      withSpread: boolean,
    ) => StyleShadowDraft;
    validatedShadowRecord: (
      record: StyleShadowDraft,
      previous: Partial<StyleShadowDraft> | undefined,
      withSpread: boolean,
      blurField?: StyleFieldDescriptor,
    ) => StyleShadowDraft;
    ShadowStyleRow: (props: ShadowStyleRowProps) => ReactElement;
    BlurStyleRow: (props: BlurStyleRowProps) => ReactElement;
    nestedStyleSummary: (
      fields: readonly StyleFieldDescriptor[],
      record: StyleRecord,
    ) => string;
    NestedStylePopoverRow: (props: NestedStylePopoverRowProps) => ReactElement;
    gradientStopRecords: (record: { stops?: unknown }) => GradientStop[];
    sortedGradientStops: (stops: readonly GradientStop[]) => GradientStop[];
    GradientPickerStyleEditor: (props: GradientStyleEditorProps) => ReactElement;
    GradientStopsStyleEditor: (props: GradientStyleEditorProps) => ReactElement;
    MAX_INLINE_ENUM_CHOICES: number;
    MAX_INLINE_ENUM_LABEL_LENGTH: number;
    enumChoicesFitInline: (values: readonly string[]) => boolean;
    STYLE_GROUP_ORDER: readonly string[];
    HIDDEN_STYLE_PROPERTY_KEYS: ReadonlySet<string>;
    STYLE_SHORTHAND_LONGHANDS: StyleKeyGroups;
    STYLE_LENGTH_UNITS: readonly string[];
    MAX_STYLE_LENGTH_PX: number;
    MIN_STYLE_PERCENT: number;
    MAX_STYLE_PERCENT: number;
    SHADOW_FIELDS: ShadowFieldDescriptors;
    SHADOW_SPREAD_FIELD: StyleFieldDescriptor;
    FILTER_FIELDS: StyleFieldDescriptor[];
    FILTER_PERCENT_FIELDS: ReadonlySet<string>;
    TRANSFORM_FIELDS: StyleFieldDescriptor[];
    MIN_GRADIENT_STOPS: number;
    MAX_GRADIENT_STOPS: number;
    STYLE_PROPERTY_LABELS: Readonly<Record<string, string>>;
    BLUR_EFFECT_LABELS: Readonly<Record<string, string>>;
    STYLE_ENUM_VALUE_LABELS: Readonly<Record<string, string>>;
    MAX_STYLE_EFFECT_ADD_CHOICES: number;
    INNER_TEXT_SHADOW_DISABLED_REASON: string;
    SHAPE_SHADOW_DISABLED_REASON: string;
    STYLE_EFFECT_KEYS: readonly StylePropertyName[];
    MIXED_STYLE_CHOICE: string;
    SHADOW_EDITOR_BOUNDS: Record<string, StyleFieldBounds>;
  }
}

export function installUiStyleInspector(runtime: RuntimeBindings): () => void {
  var reactL9: ReactNamespace;
  var jsxTJ: JsxNamespace;
  var MAX_INLINE_ENUM_CHOICES: number;
  var MAX_INLINE_ENUM_LABEL_LENGTH: number;
  var enumChoicesFitInline: (values: readonly string[]) => boolean;
  var STYLE_GROUP_ORDER: readonly string[];
  var HIDDEN_STYLE_PROPERTY_KEYS: ReadonlySet<string>;
  var STYLE_SHORTHAND_LONGHANDS: StyleKeyGroups;
  var STYLE_LENGTH_UNITS: readonly string[];
  var MAX_STYLE_LENGTH_PX: number;
  var MIN_STYLE_PERCENT: number;
  var MAX_STYLE_PERCENT: number;
  var SHADOW_FIELDS: ShadowFieldDescriptors;
  var SHADOW_SPREAD_FIELD: StyleFieldDescriptor;
  var FILTER_FIELDS: StyleFieldDescriptor[];
  var FILTER_PERCENT_FIELDS: ReadonlySet<string>;
  var TRANSFORM_FIELDS: StyleFieldDescriptor[];
  var MIN_GRADIENT_STOPS: number;
  var MAX_GRADIENT_STOPS: number;
  var STYLE_PROPERTY_LABELS: Readonly<Record<string, string>>;
  var BLUR_EFFECT_LABELS: Readonly<Record<string, string>>;
  var STYLE_ENUM_VALUE_LABELS: Readonly<Record<string, string>>;
  var MAX_STYLE_EFFECT_ADD_CHOICES: number;
  var INNER_TEXT_SHADOW_DISABLED_REASON: string;
  var SHAPE_SHADOW_DISABLED_REASON: string;
  var STYLE_EFFECT_KEYS: readonly StylePropertyName[];
  var MIXED_STYLE_CHOICE: string;
  var SHADOW_EDITOR_BOUNDS: Record<string, StyleFieldBounds>;
  function propertyValidatorKind(validator: StyleValidatorView): string {
    let kind = validator.kind;
    if (typeof kind === "string") {
      return kind;
    } else {
      return "";
    }
  }
  function propertyValidatorNumber(
    validator: StyleValidatorView,
    key: "lo" | "hi" | "step",
    fallback: number,
  ): number {
    let value = validator[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    } else {
      return fallback;
    }
  }
  function propertyValidatorStringArray(
    validator: StyleValidatorView,
    key: "values",
  ): string[] {
    let value = validator[key];
    if (Array.isArray(value)) {
      return value.filter(
        (input) => typeof input === "string",
      );
    } else {
      return [];
    }
  }
  function stylePropertyValidator(
    property: StylePropertyName,
    kind: StyleNodeKind,
  ): StyleValueSchema {
    let value = runtime.stylePropertyRegistry[property];
    if (kind === "slides-shape" && value.shapeValue !== undefined) {
      return value.shapeValue;
    }
    if (kind.startsWith("slides-") && value.slidesValue !== undefined) {
      return value.slidesValue;
    } else {
      return value.value;
    }
  }
  function stylePropertyRowModel(
    validator: StyleValidatorView,
    coarse: boolean,
  ): StyleRowModel {
    let value = propertyValidatorKind(validator);
    switch (value) {
      case "len":
      case "num": {
        let value2 = propertyValidatorNumber(validator, "lo", 0),
          value3 = propertyValidatorNumber(validator, "hi", 1000);
        if (value === "num" && value2 === 0 && value3 === 1) {
          return {
            row: "slider",
            min: value2,
            max: value3,
            step: 0.01,
          };
        }
        return {
          row: "number",
          min: value2,
          max: value3,
          step: value === "len" ? 1 : 0.1,
        };
      }
      case "int":
        return {
          row: "number",
          min: propertyValidatorNumber(validator, "lo", 0),
          max: propertyValidatorNumber(validator, "hi", 1000),
          step: propertyValidatorNumber(validator, "step", 1),
        };
      case "enum": {
        let value2 = propertyValidatorStringArray(validator, "values");
        if (
          value2.length <= MAX_INLINE_ENUM_CHOICES &&
          !coarse &&
          enumChoicesFitInline(value2)
        ) {
          return {
            row: "segmented",
            options: value2,
          };
        } else {
          return {
            row: "select",
            options: value2,
          };
        }
      }
      case "color":
        return {
          row: "color",
        };
      case "fontFamily":
        return {
          row: "select",
          options: ["sans", "serif", "mono", "helvetica"],
        };
      case "str":
        return {
          row: "text",
        };
      case "size":
        return {
          row: "size",
        };
      case "shadow":
      case "gradient":
      case "filter":
      case "transform":
        return {
          row: "compound",
          shape: value,
        };
      default:
        return {
          row: "deferred",
        };
    }
  }
  function stylePropertyGroup(property: string): string {
    if (/shadow|filter|blend/i.test(property) || property === "transform") {
      return "Effects";
    }
    if (
      property === "color" ||
      /^(font|line|letter|text|white|word)/.test(property)
    ) {
      return "Typography";
    }
    if (/^(background|opacity)/.test(property)) {
      return "Color & fill";
    }
    if (/^(padding|margin|gap)/.test(property)) {
      return "Spacing";
    }
    if (/^(border|outline|radius)/.test(property)) {
      return "Border";
    }
    if (/(width|height)$/i.test(property)) {
      return "Size";
    }
    return "Layout";
  }
  function stylePropertyGroups(
    kind: StyleNodeKind,
    coarse: boolean,
  ): StyleGroup[] {
    let entries = new Map<string, StyleRowEntry[]>();
    for (let value of runtime.stylePropertyNames) {
      if (HIDDEN_STYLE_PROPERTY_KEYS.has(value)) {
        continue;
      }
      if (!(0, runtime.stylePropertyAppliesToNode)(value, kind)) {
        continue;
      }
      let value2 = stylePropertyRowModel(
        stylePropertyValidator(value, kind),
        coarse,
      );
      if (value2.row === "deferred") {
        continue;
      }
      let value3 = stylePropertyGroup(value),
        entry = entries.get(value3);
      if (entry) {
        entry.push({
          key: value,
          model: value2,
        });
      } else {
        entries.set(value3, [
          {
            key: value,
            model: value2,
          },
        ]);
      }
    }
    return STYLE_GROUP_ORDER.flatMap((input) => {
      let entry = entries.get(input);
      if (entry) {
        return [
          {
            group: input,
            rows: entry,
          },
        ];
      } else {
        return [];
      }
    });
  }
  function setStyleProperty(
    bag: StyleBag | undefined,
    key: StylePropertyName,
    value: StyleDraftValue | undefined,
  ): StyleBag {
    return {
      ...bag,
      [key]: value,
    };
  }
  function deleteStyleProperty(
    bag: StyleBag | undefined,
    key: StylePropertyName,
  ): StyleBag | undefined {
    if (bag === undefined) {
      return;
    }
    let { [key]: J, ...remainingProps } = bag;
    if (Object.keys(remainingProps).length === 0) {
      return undefined;
    } else {
      return remainingProps;
    }
  }
  function setStyleShorthand(
    bag: StyleBag | undefined,
    key: StylePropertyName,
    value: StyleDraftValue | undefined,
  ): StyleBag | undefined {
    let value2 = bag;
    for (let value3 of STYLE_SHORTHAND_LONGHANDS[key] ?? [])
      value2 = deleteStyleProperty(value2, value3);
    if (value === undefined) {
      return deleteStyleProperty(value2, key);
    } else {
      return setStyleProperty(value2, key, value);
    }
  }
  function styleShorthandPatch(
    key: StylePropertyName,
    value: StyleDraftValue | undefined,
  ): StylePatch {
    let state: StylePatch = {};
    for (let value2 of STYLE_SHORTHAND_LONGHANDS[key] ?? [])
      state[value2] = undefined;
    state[key] = value;
    return state;
  }
  function normalizeNegativeZero(value: number): number {
    if (value === 0) {
      return 0;
    } else {
      return value;
    }
  }
  function clampValidatorNumber(
    validator: StyleValidatorView,
    value: number,
  ): number {
    let value2 = propertyValidatorKind(validator),
      value3 = propertyValidatorNumber(validator, "lo", -1e9),
      value4 = propertyValidatorNumber(validator, "hi", 1e9),
      value5 = Number.isFinite(value) ? value : value3;
    if (value2 === "int") {
      let value6 = Math.max(
        0.000000001,
        propertyValidatorNumber(validator, "step", 1),
      );
      value5 = Math.round(value5 / value6) * value6;
    }
    value5 = Math.min(value4, Math.max(value3, value5));
    if (value2 === "len") {
      value5 = Math.round(value5 * 10) / 10;
    } else if (value2 === "num") {
      value5 = Math.round(value5 * 1e4) / 1e4;
    }
    return normalizeNegativeZero(value5);
  }
  function clampStyleNumber(value: number, min: number, max: number): number {
    let value2 = Number.isFinite(value) ? value : min;
    return normalizeNegativeZero(
      Math.round(Math.min(max, Math.max(min, value2)) * 1e4) / 1e4,
    );
  }
  function numericValidator(
    kind: StyleNumericKind,
    min: number,
    max: number,
  ): StyleValidatorView {
    return {
      kind: kind,
      lo: min,
      hi: max,
    };
  }
  function styleLengthValue(unit: string, value: number): CssSizeValue {
    if (unit === "%") {
      return {
        pct: clampValidatorNumber(
          numericValidator("num", MIN_STYLE_PERCENT, MAX_STYLE_PERCENT),
          value,
        ),
      };
    } else {
      return {
        px: clampValidatorNumber(
          numericValidator("len", 0, MAX_STYLE_LENGTH_PX),
          value,
        ),
      };
    }
  }
  function styleFieldDescriptor(
    bounds: Readonly<Record<string, NumericBounds | undefined>>,
    field: string,
    label: string,
    kind: StyleNumericKind,
    step: number,
    unit?: string,
  ): StyleFieldDescriptor {
    let value = bounds[field];
    if (value === undefined) {
      throw Error(`style panel: no validator range for field ${field}`);
    }
    if (unit === undefined) {
      return {
        field: field,
        label: label,
        min: value.min,
        max: value.max,
        step: step,
        kind: kind,
      };
    } else {
      return {
        field: field,
        label: label,
        min: value.min,
        max: value.max,
        step: step,
        unit: unit,
        kind: kind,
      };
    }
  }
  function clampStyleField(field: StyleFieldDescriptor, value: number): number {
    return clampValidatorNumber(
      numericValidator(field.kind, field.min, field.max),
      value,
    );
  }
  function defaultStylePropertyValue(
    property: StylePropertyName,
    kind: StyleNodeKind,
  ): StyleDraftValue | undefined {
    let value = stylePropertyValidator(property, kind);
    switch (propertyValidatorKind(value)) {
      case "len":
      case "num":
      case "int": {
        let value2 = propertyValidatorNumber(value, "lo", 0),
          value3 = propertyValidatorNumber(value, "hi", 100);
        return clampValidatorNumber(value, value2 + (value3 - value2) / 2);
      }
      case "enum":
        return propertyValidatorStringArray(value, "values")[0];
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
        return [defaultShadowValue(property, false)];
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
  function defaultShadowValue(
    property: StylePropertyName,
    inset: boolean,
  ): StyleShadowDraft {
    if (property !== "boxShadow") {
      return {
        x: 0,
        y: 1,
        blur: 3,
        color: "#00000033",
      };
    }
    if (inset) {
      return {
        x: 0,
        y: 1,
        blur: 2,
        spread: 0,
        inset: true,
        color: "#00000033",
      };
    } else {
      return {
        x: 0,
        y: 2,
        blur: 8,
        spread: 0,
        color: "#00000033",
      };
    }
  }
  function ownStyleProperty(
    bag: StyleBag | undefined,
    key: StylePropertyName,
  ): StyleValue | undefined {
    if (bag !== undefined && Object.hasOwn(bag, key)) {
      return bag[key];
    } else {
      return undefined;
    }
  }
  function finiteStyleNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    } else {
      return undefined;
    }
  }
  function styleStringValue(value: unknown): string | undefined {
    if (typeof value === "string") {
      return value;
    } else {
      return undefined;
    }
  }
  function styleRecordValue(value: unknown): StyleRecord | undefined {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return value as StyleRecord;
    } else {
      return undefined;
    }
  }
  function styleEffectRecords(value: unknown): StyleRecord[] {
    return (
      Array.isArray(value) ? value : value === undefined ? [] : [value]
    ).flatMap(
      (input) =>
        styleRecordValue(input) !== undefined ? [input] : [],
    ) as StyleRecord[];
  }
  function styleEffectLabel(key: StylePropertyName, value: unknown): string {
    if (key === "boxShadow" && styleRecordValue(value)?.inset === true) {
      return "Inner shadow";
    } else {
      return stylePropertyLabel(key);
    }
  }
  function stylePropertyLabel(key: string): string {
    let value = Object.hasOwn(STYLE_PROPERTY_LABELS, key)
      ? STYLE_PROPERTY_LABELS[key]
      : undefined;
    if (value !== undefined) {
      return value;
    }
    let value2 = key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase();
    return value2.charAt(0).toUpperCase() + value2.slice(1);
  }
  function styleEnumValueLabel(value: string): string {
    let value2 = Object.hasOwn(STYLE_ENUM_VALUE_LABELS, value)
      ? STYLE_ENUM_VALUE_LABELS[value]
      : undefined;
    if (value2 !== undefined) {
      return value2;
    }
    let value3 = value.replace(/-/g, " ");
    return value3.charAt(0).toUpperCase() + value3.slice(1);
  }
  function styleEnumOptions(values: readonly string[]): StyleEnumOption[] {
    return values.map(
      (input) => ({
        value: input,
        label: styleEnumValueLabel(input),
      }),
    );
  }
  function styleValuesEqual(left: unknown, right: unknown): boolean {
    if (left === right) {
      return true;
    }
    if (left === null || right === null) {
      return false;
    }
    if (typeof left !== "object" || typeof right !== "object") {
      return false;
    }
    let value = Array.isArray(left);
    if (value !== Array.isArray(right)) {
      return false;
    }
    if (value) {
      let value5 = left as unknown[],
        value6 = right as unknown[];
      return (
        value5.length === value6.length &&
        value5.every(
          (input, options) =>
            styleValuesEqual(input, value6[options]),
        )
      );
    }
    let value2 = left as StyleRecord,
      value3 = right as StyleRecord,
      value4 = Object.keys(value2);
    return (
      value4.length === Object.keys(value3).length &&
      value4.every(
        (input): boolean =>
          Object.hasOwn(value3, input) &&
          styleValuesEqual(value2[input], value3[input]),
      )
    );
  }
  function changedStyleProperty(
    bag: StyleBag | undefined,
    key: StylePropertyName,
    value: StyleDraftValue | undefined,
  ): { next: StyleBag | undefined } | undefined {
    let value2 = setStyleShorthand(bag, key, value);
    if (styleValuesEqual(value2, bag)) {
      return undefined;
    } else {
      return {
        next: value2,
      };
    }
  }
  function createStyleEditor({
    kind: options,
    bag: bag,
    onCommit: onCommit,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    disabled = false,
    disabledKeys: disabledKeys,
    swatches: swatches,
    clearKeys: clearKeys,
    mixedKeys: mixedKeys,
    unifiedColorPopover = false,
  }: StyleEditorOptions): StyleEditor {
    return {
      kind: options,
      bag: bag,
      disabled: disabled,
      disabledKeys: disabledKeys,
      swatches: swatches,
      clearKeys: clearKeys,
      mixedKeys: mixedKeys,
      unifiedColorPopover: unifiedColorPopover,
      clear: (input: readonly StylePropertyName[]) => {
        let value = bag,
          state: StylePatch = {};
        for (let value2 of input) {
          value = setStyleShorthand(value, value2, undefined);
          state = {
            ...state,
            ...styleShorthandPatch(value2, undefined),
          };
        }
        if (
          !styleValuesEqual(value, bag) ||
          input.some((input2) => mixedKeys?.has(input2))
        ) {
          onCommit(value, state);
        }
      },
      commit: (
        input: StylePropertyName,
        options2: StyleDraftValue | undefined,
      ) => {
        let value = changedStyleProperty(bag, input, options2);
        if (value) {
          onCommit(value.next, styleShorthandPatch(input, options2));
        } else if (mixedKeys?.has(input)) {
          onCommit(bag, styleShorthandPatch(input, options2));
        }
      },
      live: onLive
        ? (input: StylePropertyName, options2: StyleDraftValue | undefined) =>
            onLive(
              setStyleShorthand(bag, input, options2),
              styleShorthandPatch(input, options2),
            )
        : undefined,
      liveEnd: onLiveEnd,
    };
  }
  function StyleInspector(props: StyleInspectorProps): ReactElement | null {
    let {
        kind: kind,
        nested = false,
        effectsLifted = false,
        hiddenKeys: hiddenKeys,
        onlyKeys: onlyKeys,
      } = props,
      value = (0, runtime.useCoarsePointer)(),
      memo = reactL9.useMemo(() => {
        let value4 = stylePropertyGroups(kind, value);
        if (hiddenKeys === undefined || hiddenKeys.size === 0) {
          return value4;
        }
        return value4
          .map(
            (input) => ({
              group: input.group,
              rows: input.rows.filter(
                (input2) => !hiddenKeys.has(input2.key),
              ),
            }),
          )
          .filter((input) => input.rows.length > 0);
      }, [kind, value, hiddenKeys]),
      [value2, value3] = reactL9.useState<StyleOpenEditor | undefined>(
        undefined,
      ),
      state = {
        ...createStyleEditor(props),
        openEditor: value2,
        setOpenEditor: value3,
      };
    if (onlyKeys !== undefined) {
      let entries = new Map(
          memo
            .flatMap((input) => input.rows)
            .map((input): [StylePropertyName, StyleRowEntry] => [
              input.key,
              input,
            ]),
        ),
        value4 = onlyKeys
          .map((input) => entries.get(input))
          .filter((input) => input !== undefined);
      if (value4.length === 0) {
        return null;
      }
      return jsxTJ.jsx(jsxTJ.Fragment, {
        children: value4.map(
          ({ key: key, model: model }) =>
            jsxTJ.jsx(
              StylePropertyRow,
              {
                propKey: key,
                model: model,
                ed: state,
              },
              key,
            ),
        ),
      });
    }
    if (memo.length === 0) {
      return null;
    }
    return jsxTJ.jsx(jsxTJ.Fragment, {
      children: memo.map((input) => {
        if (input.group !== "Effects") {
          return jsxTJ.jsx(
            runtime.PropertySection,
            {
              title: input.group,
              subsection: nested,
              children: input.rows.map(
                ({ key: key, model: model }) =>
                  jsxTJ.jsx(
                    StylePropertyRow,
                    {
                      propKey: key,
                      model: model,
                      ed: state,
                    },
                    key,
                  ),
              ),
            },
            input.group,
          );
        }
        let value4 = input.rows
          .filter((input2) => input2.key !== "boxShadow")
          .map(
            ({ key: key, model: model }) =>
              jsxTJ.jsx(
                StylePropertyRow,
                {
                  propKey: key,
                  model: model,
                  ed: state,
                },
                key,
              ),
          );
        if (effectsLifted) {
          return jsxTJ.jsx(
            runtime.PropertySection,
            {
              title: input.group,
              subsection: nested,
              children: value4,
            },
            input.group,
          );
        } else {
          return jsxTJ.jsx(
            StyleEffectsInspector,
            {
              ...props,
              subsection: nested,
              blurRows: false,
              openEditor: value2,
              setOpenEditor: value3,
              children: value4,
            },
            input.group,
          );
        }
      }),
    });
  }
  function styleEffectAddItems(
    kind: StyleNodeKind,
    bag: StyleBag | undefined,
    commit: StyleCommit,
    shadowTarget: ShadowTarget = "box",
    canInset?: string,
    mixed: boolean = false,
    dropShadowReason: string = SHAPE_SHADOW_DISABLED_REASON,
  ): StyleEffectAddItem[] {
    let items: StyleEffectAddItem[] = [],
      value = shadowStyleKey(kind, shadowTarget);
    if ((0, runtime.stylePropertyAppliesToNode)(value, kind)) {
      let value2 = styleEffectRecords(ownStyleProperty(bag, value)),
        value3 =
          value2.length >= runtime.maxShadowCount
            ? {
                disabledReason: `At most ${runtime.maxShadowCount} per element`,
              }
            : {},
        callback =
          (input: boolean) =>
          () =>
            commit(value, [...value2, defaultShadowValue(value, input)]),
        value4 =
          canInset ??
          (value2.length >= runtime.maxShadowCount
            ? `At most ${runtime.maxShadowCount} per element`
            : undefined);
      items.push(
        value4 !== undefined
          ? {
              label: "Drop shadow",
              onSelect: () => {},
              disabledReason: value4,
            }
          : {
              label: "Drop shadow",
              onSelect: callback(false),
            },
      );
      items.push(
        value === "textShadow"
          ? {
              label: "Inner shadow",
              onSelect: () => {},
              disabledReason: mixed
                ? dropShadowReason
                : INNER_TEXT_SHADOW_DISABLED_REASON,
            }
          : {
              label: "Inner shadow",
              onSelect: callback(true),
              ...value3,
              ...(mixed
                ? {
                    disabledReason: dropShadowReason,
                  }
                : {}),
            },
      );
    }
    for (let value2 of ["filter", "backdropFilter"] as StylePropertyName[]) {
      let value3 = styleRecordValue(ownStyleProperty(bag, value2));
      if (
        !(0, runtime.stylePropertyAppliesToNode)(value2, kind) ||
        value3?.blur !== undefined
      ) {
        continue;
      }
      items.push({
        label: BLUR_EFFECT_LABELS[value2] ?? stylePropertyLabel(value2),
        onSelect: () =>
          commit(
            value2,
            setRecordField(value3, "blur", MAX_STYLE_EFFECT_ADD_CHOICES),
          ),
        ...(mixed && value2 === "backdropFilter"
          ? {
              disabledReason: dropShadowReason,
            }
          : {}),
      });
    }
    return items;
  }
  function shadowStyleKey(
    kind: StyleNodeKind,
    target: ShadowTarget,
  ): "textShadow" | "boxShadow" {
    if (
      target === "text" &&
      (0, runtime.stylePropertyAppliesToNode)("textShadow", kind)
    ) {
      return "textShadow";
    } else {
      return "boxShadow";
    }
  }
  function StyleEffectsInspector(
    props: StyleEffectsInspectorProps,
  ): ReactElement | null {
    let {
        kind: kind,
        bag: bag,
        subsection: subsection,
        blurRows = true,
        children: children,
        shadowTarget = "box",
        dropShadowDisabledReason: dropShadowDisabledReason,
      } = props,
      value = reactL9.useState<StyleOpenEditor | undefined>(undefined),
      [value2, value3] =
        props.setOpenEditor !== undefined
          ? [props.openEditor, props.setOpenEditor]
          : value,
      state = {
        ...createStyleEditor(props),
        openEditor: value2,
        setOpenEditor: value3,
      },
      items = [
        ...styleEffectAddItems(
          kind,
          bag,
          (input, items2) => {
            if (Array.isArray(items2)) {
              value3({
                key: input,
                index: items2.length - 1,
              });
            }
            state.commit(input, items2);
          },
          shadowTarget,
          dropShadowDisabledReason,
          props.silhouette,
          props.silhouetteReason,
        ),
        ...(props.addItems ?? []),
      ];
    if (
      items.length === 0 &&
      bag === undefined &&
      children === undefined &&
      !STYLE_EFFECT_KEYS.some(
        (input) =>
          (0, runtime.stylePropertyAppliesToNode)(input, kind),
      )
    ) {
      return null;
    }
    let value4: StylePropertyName[] =
        shadowStyleKey(kind, shadowTarget) === "textShadow"
          ? ["boxShadow", "textShadow"]
          : ["boxShadow"],
      callback = (input: StylePropertyName, options: StyleRecord) => {
        if (shadowTarget !== "text") {
          return styleEffectLabel(input, options);
        }
        if (input === "textShadow") {
          return "Drop shadow";
        }
        if (input === "boxShadow") {
          if (styleRecordValue(options)?.inset === true) {
            return "Inner shadow";
          } else {
            return "Box shadow";
          }
        }
        return styleEffectLabel(input, options);
      };
    return jsxTJ.jsxs(runtime.PropertySection, {
      title: "Effects",
      subsection: subsection,
      iconColumn: true,
      actions: jsxTJ.jsx(runtime.PropertySectionActions, {
        section: "Effects",
        items: items,
        disabled: state.disabled,
      }),
      children: [
        value4.flatMap((input) => {
          let value5 = styleEffectRecords(
            ownStyleProperty(bag, input),
          );
          return value5.map(
            (input2, options) =>
              jsxTJ.jsx(
                ShadowStyleRow,
                {
                  propKey: input,
                  list: value5,
                  index: options,
                  rec: input2,
                  ed: state,
                  label: callback(input, input2),
                },
                input + String(options),
              ),
          );
        }),
        blurRows &&
          (["filter", "backdropFilter"] as StylePropertyName[]).map((input) => {
            let value5 = styleRecordValue(
              ownStyleProperty(bag, input),
            );
            if (
              value5?.blur !== undefined &&
              (0, runtime.stylePropertyAppliesToNode)(input, kind)
            ) {
              return jsxTJ.jsx(
                BlurStyleRow,
                {
                  label: BLUR_EFFECT_LABELS[input] ?? stylePropertyLabel(input),
                  propKey: input,
                  rec: value5,
                  ed: state,
                },
                input,
              );
            } else {
              return null;
            }
          }),
        children,
      ],
    });
  }
  function StylePropertyRow({
    propKey: propKey,
    model: model,
    ed: ed2,
  }: StylePropertyRowProps): ReactElement {
    let value = ownStyleProperty(ed2.bag, propKey),
      value2 = ed2.disabledKeys?.get(propKey),
      value3 =
        value2 !== undefined
          ? {
              ...ed2,
              disabled: true,
              whyDisabled: value2,
            }
          : ed2,
      value4 =
        value !== undefined && !value3.disabled
          ? () => ed2.commit(propKey, undefined)
          : undefined;
    return jsxTJ.jsx(StyleValueRow, {
      propKey: propKey,
      model: model,
      value: value,
      ed: value3,
      onReset: value4,
    });
  }
  function styleScrubProps(
    editor: StyleEditor,
    key: StylePropertyName,
    convert: (value: number) => StyleDraftValue | undefined,
  ): StyleScrubProps {
    let { live: live, liveEnd: liveEnd } = editor;
    if (!live || !liveEnd) {
      return {};
    }
    return {
      onScrub: (input: number) => live(key, convert(input)),
      onScrubEnd: liveEnd,
    };
  }
  function styleLiveColorProps(
    editor: StyleEditor,
    key: StylePropertyName,
    convert: (value: number) => StyleDraftValue | undefined,
  ): StyleLiveProps<number> {
    let { live: live, liveEnd: liveEnd } = editor;
    if (!live || !liveEnd) {
      return {};
    }
    return {
      onLive: (input: number) => live(key, convert(input)),
      onLiveEnd: () => liveEnd(),
    };
  }
  function validatedColorLiveProps(
    editor: StyleEditor,
    onChange: ((value: string) => void) | undefined,
  ): StyleLiveProps<string> {
    let { liveEnd: liveEnd } = editor;
    if (!onChange || !liveEnd) {
      return {};
    }
    return {
      onLive: (input: string) => {
        let value = validatedStyleColor(input);
        if (value !== undefined) {
          onChange(value);
        }
      },
      onLiveEnd: () => liveEnd(),
    };
  }
  function StyleValueRow({
    propKey: propKey,
    model: model,
    value: value,
    ed: ed2,
    onReset: onReset,
  }: StyleValueRowProps): ReactElement | null {
    let value2 = stylePropertyLabel(propKey),
      value3 = ed2.mixedKeys?.has(propKey) === true;
    switch (model.row) {
      case "number": {
        let value4 = stylePropertyValidator(propKey, ed2.kind);
        return jsxTJ.jsx(runtime.NumberPropertyRow, {
          label: value2,
          title: ed2.whyDisabled,
          onReset: onReset,
          value: value3 ? undefined : finiteStyleNumber(value),
          mixed: value3,
          emptyStepFrom: value3 ? null : undefined,
          hint: "default",
          clearable: true,
          min: model.min,
          max: model.max,
          step: model.step,
          onValue: (input: number | undefined) =>
            ed2.commit(
              propKey,
              input === undefined
                ? undefined
                : clampValidatorNumber(value4, input),
            ),
          unit: propertyValidatorKind(value4) === "len" ? "px" : undefined,
          disabled: ed2.disabled,
          ...styleScrubProps(
            ed2,
            propKey,
            (input) => clampValidatorNumber(value4, input),
          ),
        });
      }
      case "slider": {
        let value4 = stylePropertyValidator(propKey, ed2.kind);
        return jsxTJ.jsx(runtime.SliderPropertyRow, {
          label: value2,
          title: ed2.whyDisabled,
          onReset: onReset,
          value: finiteStyleNumber(value) ?? model.max,
          mixed: value3,
          min: model.min,
          max: model.max,
          step: model.step,
          disabled: ed2.disabled,
          onValue: (input: number) =>
            ed2.commit(propKey, clampValidatorNumber(value4, input)),
          ...styleLiveColorProps(
            ed2,
            propKey,
            (input) => clampValidatorNumber(value4, input),
          ),
        });
      }
      case "segmented":
        return jsxTJ.jsx(runtime.ChoicePropertyRow, {
          label: value2,
          title: ed2.whyDisabled,
          onReset: onReset,
          value: value3 ? "" : (styleStringValue(value) ?? ""),
          options: styleEnumOptions(model.options),
          disabled: ed2.disabled,
          onChange: (input: string) => ed2.commit(propKey, input),
        });
      case "select":
        return jsxTJ.jsx(runtime.SelectPropertyRow, {
          label: value2,
          title: ed2.whyDisabled,
          onReset: onReset,
          value: value3 ? MIXED_STYLE_CHOICE : (styleStringValue(value) ?? ""),
          placeholder: value3 ? runtime.MIXED_LABEL : undefined,
          options: [
            {
              value: "",
              label: "Default",
            },
            ...styleEnumOptions(model.options),
          ],
          disabled: ed2.disabled,
          onChange: (input: string) =>
            ed2.commit(propKey, input === "" ? undefined : input),
        });
      case "color":
        return jsxTJ.jsx(runtime.ColorTextPropertyRow, {
          label: value2,
          title: ed2.whyDisabled,
          onReset: onReset,
          value: styleStringValue(value),
          mixed: value3,
          disabled: ed2.disabled,
          swatches: ed2.swatches,
          popoverTitle: ed2.unifiedColorPopover
            ? runtime.COLOR_LABEL
            : undefined,
          ...(ed2.unifiedColorPopover && propKey === "backgroundColor"
            ? {
                allowNone: true,
                onNone: () =>
                  ed2.clear([propKey, ...(ed2.clearKeys?.[propKey] ?? [])]),
                isNone:
                  !value3 &&
                  [propKey, ...(ed2.clearKeys?.[propKey] ?? [])].every(
                    (input) =>
                      ownStyleProperty(ed2.bag, input) === undefined &&
                      ed2.mixedKeys?.has(input) !== true,
                  ),
              }
            : {}),
          trailing: StyleRemoveShorthandButton(ed2, propKey, value2),
          onChange: (input: string | undefined) => {
            if (input === undefined) {
              ed2.commit(propKey, undefined);
              return;
            }
            let value4 = validatedStyleColor(input);
            if (value4 !== undefined) {
              ed2.commit(propKey, value4);
            }
          },
          ...validatedColorLiveProps(
            ed2,
            ed2.live
              ? (input: string) => ed2.live?.(propKey, input)
              : undefined,
          ),
        });
      case "text":
        return jsxTJ.jsx(StyleColorTextRow, {
          label: value2,
          value: styleStringValue(value),
          propKey: propKey,
          ed: ed2,
          onReset: onReset,
        });
      case "size":
        return jsxTJ.jsx(StyleLengthRow, {
          label: value2,
          value: value,
          propKey: propKey,
          ed: ed2,
          onReset: onReset,
        });
      case "compound":
        return jsxTJ.jsx(StyleRecordRow, {
          label: value2,
          shape: model.shape,
          value: value,
          propKey: propKey,
          ed: ed2,
          onReset: onReset,
        });
      default:
        return null;
    }
  }
  function StyleRemoveShorthandButton(
    input: StyleEditor,
    options: StylePropertyName,
    context: string,
  ): ReactElement | undefined {
    let value = input.clearKeys?.[options];
    if (value === undefined) {
      return;
    }
    let items = [options, ...value];
    if (
      !items.some(
        (input2) =>
          ownStyleProperty(input.bag, input2) !== undefined ||
          input.mixedKeys?.has(input2) === true,
      )
    ) {
      return;
    }
    return jsxTJ.jsx(runtime.RemovePropertyButton, {
      label: context,
      disabled: input.disabled,
      onClick: () => input.clear(items),
    });
  }
  function validatedStyleColor(color: string): string | undefined {
    let value: string | true | undefined = (0, runtime.normalizeCssColor)(color);
    if (typeof value === "string") {
      return value;
    }
    if (value === true) {
      return color.trim().toLowerCase();
    } else {
      return undefined;
    }
  }
  function StyleColorTextRow({
    label: label,
    value: value,
    propKey: propKey,
    ed: ed2,
    onReset: onReset,
  }: StyleColorTextRowProps): ReactElement {
    return jsxTJ.jsx(runtime.InspectorPropertyRow, {
      label: label,
      onReset: onReset,
      title: ed2.whyDisabled,
      onPress: (element: HTMLElement) =>
        element.querySelector("input")?.focus(),
      children: jsxTJ.jsx(
        runtime.TextInput,
        {
          "aria-label": label,
          defaultValue: value ?? "",
          placeholder: "default",
          disabled: ed2.disabled,
          onBlur: (input: FocusEvent<HTMLInputElement>) => {
            let value2 = input.currentTarget.value.trim();
            ed2.commit(propKey, value2 === "" ? undefined : value2);
          },
          onKeyDown: (input: ReactKeyboardEvent<HTMLInputElement>) => {
            if (input.key === "Enter") {
              input.currentTarget.blur();
            }
            if (input.key === "Escape") {
              input.currentTarget.value = value ?? "";
              input.currentTarget.blur();
            }
            input.stopPropagation();
          },
        },
        value ?? "",
      ),
    });
  }
  function StyleLengthRow({
    label: label,
    value: value,
    propKey: propKey,
    ed: ed2,
    onReset: onReset,
  }: StyleLengthRowProps): ReactElement {
    let value2 = styleRecordValue(value),
      value3 = value2 ? finiteStyleNumber(value2.pct) : undefined,
      value4 = value2 ? finiteStyleNumber(value2.px) : undefined,
      value5 = value3 !== undefined ? "%" : "px",
      value6 = value3 ?? value4,
      value7 = value5 === "%" ? MIN_STYLE_PERCENT : 0,
      value8 =
        value5 === "%" ? MAX_STYLE_PERCENT : MAX_STYLE_LENGTH_PX;
    return jsxTJ.jsx(runtime.NumberPropertyRow, {
      label: label,
      title: ed2.whyDisabled,
      onReset: onReset,
      value: value6,
      placeholder: "auto",
      clearable: true,
      min: value7,
      max: value8,
      step: 1,
      unit: value5,
      units: STYLE_LENGTH_UNITS,
      onUnit: (input: string) => {
        if (value6 !== undefined) {
          ed2.commit(propKey, styleLengthValue(input, value6));
        }
      },
      disabled: ed2.disabled,
      onValue: (input: number | undefined) =>
        ed2.commit(
          propKey,
          input === undefined ? undefined : styleLengthValue(value5, input),
        ),
      ...styleScrubProps(
        ed2,
        propKey,
        (input) => styleLengthValue(value5, input),
      ),
    });
  }
  function setRecordField(
    record: StyleRecord | undefined,
    field: string,
    value: unknown,
  ): StyleRecord | undefined {
    if (value !== undefined) {
      return {
        ...record,
        [field]: value,
      };
    }
    let { [field]: J, ...remainingProps } = record ?? {};
    if (Object.keys(remainingProps).length === 0) {
      return undefined;
    } else {
      return remainingProps;
    }
  }
  function StyleRecordRow({
    label: label,
    shape: shape,
    value: value,
    propKey: propKey,
    ed: ed2,
    onReset: onReset,
  }: StyleRecordRowProps): ReactElement {
    let value2 = styleRecordValue(value),
      callback = (input: string, options: number | undefined) =>
        ed2.commit(propKey, setRecordField(value2, input, options)),
      callback2 = (input: string) =>
        ed2.live && ed2.liveEnd
          ? (input2: number) =>
              ed2.live?.(propKey, setRecordField(value2, input, input2))
          : undefined;
    if (shape === "shadow") {
      let value4 = styleEffectRecords(value);
      return jsxTJ.jsx(reactL9.Fragment, {
        children: (value4.length > 0 ? value4 : [undefined]).map(
          (input, options) =>
            jsxTJ.jsx(
              ShadowStyleRow,
              {
                propKey: propKey,
                list: value4,
                index: options,
                rec: input,
                ed: ed2,
              },
              options,
            ),
        ),
      });
    }
    if (shape === "filter" || shape === "transform") {
      return jsxTJ.jsx(NestedStylePopoverRow, {
        label: label,
        fields: shape === "filter" ? FILTER_FIELDS : TRANSFORM_FIELDS,
        propKey: propKey,
        rec: value2,
        ed: ed2,
        setField: callback,
        liveField: callback2,
      });
    }
    let value3 = value2 !== undefined;
    return jsxTJ.jsxs(reactL9.Fragment, {
      children: [
        jsxTJ.jsx(runtime.TogglePropertyRow, {
          label: label,
          title: ed2.whyDisabled,
          onReset: onReset,
          checked: value3,
          disabled: ed2.disabled,
          onChange: (input: boolean) =>
            ed2.commit(
              propKey,
              input ? defaultStylePropertyValue(propKey, ed2.kind) : undefined,
            ),
        }),
        value3 &&
          jsxTJ.jsx("div", {
            className:
              "ml-3.5 flex flex-col border-l border-alpha-2 [--pp-label-w:66px]",
            children: jsxTJ.jsx(GradientStopsStyleEditor, {
              rec: value2,
              propKey: propKey,
              ed: ed2,
            }),
          }),
      ],
    });
  }
  function useNestedStyleEditor(
    key: StylePropertyName,
    editor: StyleEditorState,
    index: number = 0,
  ): NestedStyleEditor {
    let [value, value2] = reactL9.useState<StyleOpenEditor | undefined>(
        undefined,
      ),
      value3 =
        editor.setOpenEditor !== undefined ? editor.openEditor : value,
      value4 = editor.setOpenEditor ?? value2,
      value5 = value3?.key === key && value3.index === index,
      [value6, value7] = reactL9.useState(false),
      callback = (input: boolean) =>
        value4(
          (input2: StyleOpenEditor | undefined) =>
            input
              ? {
                  key: key,
                  index: index,
                }
              : input2?.key === key && input2.index === index
                ? undefined
                : input2,
        ),
      callback2 = () =>
        value4(
          (input: StyleOpenEditor | undefined) =>
            input?.key !== key
              ? input
              : input.index === index
                ? undefined
                : input.index > index
                  ? {
                      key: key,
                      index: input.index - 1,
                    }
                  : input,
        ),
      ref = reactL9.useRef<HTMLSpanElement | null>(null);
    return {
      open: value5,
      setOpen: callback,
      removed: callback2,
      byKeyboard: value6,
      setByKeyboard: value7,
      wrapRef: ref,
      anchor: () =>
        ref.current?.closest("[data-property-row]") ?? null,
    };
  }
  function NestedStyleNumberRows({
    fields: fields,
    rec: rec,
    setField: setField,
    liveField: liveField,
    ed: ed2,
  }: NestedStyleNumberRowsProps): ReactElement {
    return jsxTJ.jsx(reactL9.Fragment, {
      children: fields.map((input) => {
        let value = liveField(input.field);
        return jsxTJ.jsx(
          runtime.NumberPropertyRow,
          {
            label: input.label,
            value: finiteStyleNumber(rec[input.field]),
            placeholder: FILTER_PERCENT_FIELDS.has(input.field) ? "1" : "0",
            clearable: true,
            min: input.min,
            max: input.max,
            step: input.step,
            unit: input.unit,
            disabled: ed2.disabled,
            onValue: (input2: number | undefined) =>
              setField(
                input.field,
                input2 === undefined
                  ? undefined
                  : clampStyleField(input, input2),
              ),
            ...(value && ed2.liveEnd
              ? {
                  onScrub: (input2: number) =>
                    value(clampStyleField(input, input2)),
                  onScrubEnd: ed2.liveEnd,
                }
              : {}),
          },
          input.field,
        );
      }),
    });
  }
  function normalizedShadowRecord(
    record: StyleRecord,
    withSpread: boolean,
  ): StyleShadowDraft {
    return {
      x: finiteStyleNumber(record.x) ?? 0,
      y: finiteStyleNumber(record.y) ?? 0,
      blur: finiteStyleNumber(record.blur) ?? 0,
      ...(withSpread
        ? {
            spread: finiteStyleNumber(record.spread) ?? 0,
          }
        : {}),
      color: styleStringValue(record.color) ?? "#000000",
    };
  }
  function validatedShadowRecord(
    record: StyleShadowDraft,
    previous: Partial<StyleShadowDraft> | undefined,
    withSpread: boolean,
    blurField?: StyleFieldDescriptor,
  ): StyleShadowDraft {
    let [value, value2, value3] = SHADOW_FIELDS,
      state: StyleShadowDraft = {
        x: clampStyleField(value, record.x),
        y: clampStyleField(value2, record.y),
        blur: clampStyleField(blurField ?? value3, record.blur),
        color:
          validatedStyleColor(record.color) ?? previous?.color ?? "#000000",
      };
    if (withSpread) {
      state.spread = clampStyleField(SHADOW_SPREAD_FIELD, record.spread ?? 0);
    }
    if (previous?.inset === true) {
      state.inset = true;
    }
    return state;
  }
  function ShadowStyleRow({
    propKey: propKey,
    list: list,
    index: index,
    rec: rec,
    ed: ed2,
    label: label,
  }: ShadowStyleRowProps): ReactElement {
    let {
        open: open,
        setOpen: setOpen,
        removed: removed,
        byKeyboard: byKeyboard,
        setByKeyboard: setByKeyboard,
        wrapRef: wrapRef,
        anchor: anchor,
      } = useNestedStyleEditor(propKey, ed2, index),
      value = propKey === "boxShadow",
      value2 = label ?? styleEffectLabel(propKey, rec),
      value3 =
        rec !== undefined ? normalizedShadowRecord(rec, value) : undefined,
      value4 = styleFieldDescriptor(
        (0, runtime.shadowSchemaBounds)(
          stylePropertyValidator(propKey, ed2.kind),
        ),
        "blur",
        "Blur",
        "len",
        1,
        "px",
      ),
      value5 =
        value4.max === SHADOW_EDITOR_BOUNDS.blur?.max
          ? SHADOW_EDITOR_BOUNDS
          : {
              ...SHADOW_EDITOR_BOUNDS,
              blur: {
                min: value4.min,
                max: value4.max,
                step: value4.step,
              },
            },
      callback = (input: StyleRecord | undefined) => {
        let value6 =
          input === undefined
            ? list.filter(
                (input2, options) =>
                  options !== index,
              )
            : list.map(
                (input2, options) =>
                  options === index ? input : input2,
              );
        if (value6.length === 0) {
          return undefined;
        } else {
          return value6;
        }
      },
      live = ed2.live;
    return jsxTJ.jsx(runtime.InspectorPropertyRow, {
      label: value2,
      disabled: ed2.disabled,
      title: ed2.whyDisabled,
      trailing: jsxTJ.jsx(runtime.RemovePropertyButton, {
        label: value2,
        disabled: ed2.disabled || rec === undefined,
        onClick: () => {
          removed();
          ed2.commit(propKey, callback(undefined));
        },
      }),
      children: jsxTJ.jsx("span", {
        ref: wrapRef,
        className: "relative flex min-w-0 flex-1",
        children: jsxTJ.jsx(runtime.PropertyPopover, {
          open: open && rec !== undefined,
          onOpenChange: setOpen,
          trigger: jsxTJ.jsx(runtime.PropertyPopoverTrigger, {
            label: value2,
            color: value3?.color ?? null,
            text:
              value3 !== undefined
                ? `${value3.x}, ${value3.y} · ${value3.blur}px`
                : "None",
            disabled: ed2.disabled,
            onClick: (input: ReactMouseEvent) => {
              if (rec === undefined) {
                ed2.commit(
                  propKey,
                  defaultStylePropertyValue(propKey, ed2.kind),
                );
              }
              setByKeyboard(input.detail === 0);
            },
          }),
          anchor: anchor,
          focusOnOpen: byKeyboard,
          children: jsxTJ.jsx(runtime.ShadowPropertyEditor, {
            title: value2,
            value: value3 ?? normalizedShadowRecord({}, value),
            spread: value,
            bounds: value5,
            disabled: ed2.disabled,
            swatches: ed2.swatches,
            unifiedPopover: ed2.unifiedColorPopover,
            onChange: (input: StyleShadowDraft) =>
              ed2.commit(
                propKey,
                callback(validatedShadowRecord(input, rec, value, value4)),
              ),
            ...(live && ed2.liveEnd
              ? {
                  onLive: (input: StyleShadowDraft) =>
                    live(
                      propKey,
                      callback(
                        validatedShadowRecord(input, rec, value, value4),
                      ),
                    ),
                  onLiveEnd: ed2.liveEnd,
                }
              : {}),
            onClose: () => setOpen(false),
          }),
        }),
      }),
    });
  }
  function BlurStyleRow({
    label: label,
    propKey: propKey,
    rec: rec,
    ed: ed2,
  }: BlurStyleRowProps): ReactElement {
    let value = FILTER_FIELDS.find(
        (input) => input.field === "blur",
      )!,
      callback = (input: number | undefined) =>
        setRecordField(rec, value.field, input),
      live = ed2.live;
    return jsxTJ.jsx(runtime.NumberPropertyRow, {
      label: label,
      value: finiteStyleNumber(rec[value.field]),
      placeholder: "0",
      min: value.min,
      max: value.max,
      step: value.step,
      unit: value.unit,
      disabled: ed2.disabled,
      onValue: (input: number | undefined) =>
        input !== undefined &&
        ed2.commit(propKey, callback(clampStyleField(value, input))),
      ...(live && ed2.liveEnd
        ? {
            onScrub: (input: number) =>
              live(propKey, callback(clampStyleField(value, input))),
            onScrubEnd: ed2.liveEnd,
          }
        : {}),
      trailing: jsxTJ.jsx(runtime.RemovePropertyButton, {
        label: label,
        disabled: ed2.disabled,
        onClick: () => ed2.commit(propKey, callback(undefined)),
      }),
    });
  }
  function nestedStyleSummary(
    fields: readonly StyleFieldDescriptor[],
    record: StyleRecord,
  ): string {
    let value = fields.flatMap((input) => {
      let value2 = finiteStyleNumber(record[input.field]);
      if (value2 === undefined) {
        return [];
      } else {
        return [`${input.label} ${value2}${input.unit ?? ""}`];
      }
    });
    if (value.length > 0) {
      return value.join(" · ");
    } else {
      return "None";
    }
  }
  function NestedStylePopoverRow({
    label: label,
    fields: fields,
    propKey: propKey,
    rec: rec,
    ed: ed2,
    setField: setField,
    liveField: liveField,
  }: NestedStylePopoverRowProps): ReactElement {
    let {
      open: open,
      setOpen: setOpen,
      byKeyboard: byKeyboard,
      setByKeyboard: setByKeyboard,
      wrapRef: wrapRef,
      anchor: anchor,
    } = useNestedStyleEditor(propKey, ed2);
    return jsxTJ.jsx(runtime.InspectorPropertyRow, {
      label: label,
      disabled: ed2.disabled,
      title: ed2.whyDisabled,
      trailing: jsxTJ.jsx(runtime.RemovePropertyButton, {
        label: label,
        disabled: ed2.disabled || rec === undefined,
        onClick: () => {
          setOpen(false);
          ed2.commit(propKey, undefined);
        },
      }),
      children: jsxTJ.jsx("span", {
        ref: wrapRef,
        className: "relative flex min-w-0 flex-1",
        children: jsxTJ.jsx(runtime.PropertyPopover, {
          open: open && rec !== undefined,
          onOpenChange: setOpen,
          trigger: jsxTJ.jsx(runtime.PropertyPopoverTrigger, {
            label: label,
            text: rec !== undefined ? nestedStyleSummary(fields, rec) : "None",
            disabled: ed2.disabled,
            onClick: (input: ReactMouseEvent) => {
              if (rec === undefined) {
                ed2.commit(
                  propKey,
                  defaultStylePropertyValue(propKey, ed2.kind),
                );
              }
              setByKeyboard(input.detail === 0);
            },
          }),
          anchor: anchor,
          focusOnOpen: byKeyboard,
          children: jsxTJ.jsx(runtime.PropertyPopoverPanel, {
            title: label,
            labelWidth: "4.5rem",
            onClose: () => setOpen(false),
            children:
              rec !== undefined &&
              jsxTJ.jsx(NestedStyleNumberRows, {
                fields: fields,
                rec: rec,
                setField: setField,
                liveField: liveField,
                ed: ed2,
              }),
          }),
        }),
      }),
    });
  }
  function gradientStopRecords(record: { stops?: unknown }): GradientStop[] {
    return (Array.isArray(record.stops) ? record.stops : []).flatMap(
      (input: unknown) => {
        let value = styleRecordValue(input),
          value2 = value ? styleStringValue(value.color) : undefined,
          value3 = value ? finiteStyleNumber(value.pos) : undefined;
        if (value2 !== undefined && value3 !== undefined) {
          return [
            {
              color: value2,
              pos: value3,
            },
          ];
        } else {
          return [];
        }
      },
    );
  }
  function sortedGradientStops(stops: readonly GradientStop[]): GradientStop[] {
    return [...stops].sort(
      (input, options) => input.pos - options.pos,
    );
  }
  function GradientPickerStyleEditor({
    rec: rec,
    propKey: propKey,
    ed: ed2,
  }: GradientStyleEditorProps): ReactElement {
    let value = gradientStopRecords(rec),
      [value2, value3] = reactL9.useState(0),
      value4 = Math.min(value2, Math.max(0, value.length - 1)),
      callback = (input: GradientStopDraft[]) => {
        let value7: number[] = (0, runtime.normalizeGradientStopPositions)(
          input,
        );
        return input.map(
          (input2, options) => ({
            color: input2.color,
            pos: clampStyleNumber(input2.pos ?? value7[options]!, 0, 100),
          }),
        );
      },
      callback2 = (input: GradientStopDraft[]) =>
        ed2.commit(propKey, {
          ...rec,
          stops: sortedGradientStops(callback(input)),
        }),
      value5 =
        ed2.live && ed2.liveEnd
          ? (input: GradientStopDraft[]) =>
              ed2.live?.(propKey, {
                ...rec,
                stops: callback(input),
              })
          : undefined,
      value6 = rec.radial === true;
    return jsxTJ.jsx(runtime.GradientEditor, {
      testid: "sp-gradient",
      radial: value6,
      onRadial: (input: boolean) => {
        let { radial: value7, ...value8 } = rec;
        ed2.commit(
          propKey,
          input
            ? {
                ...value8,
                radial: true,
              }
            : value8,
        );
      },
      angle: finiteStyleNumber(rec.angle),
      onAngle: (input: number | undefined) =>
        ed2.commit(propKey, {
          ...rec,
          angle:
            input === undefined ? undefined : clampStyleNumber(input, 0, 360),
        }),
      ...(ed2.live && ed2.liveEnd
        ? {
            onAngleScrub: (input: number) =>
              ed2.live?.(propKey, {
                ...rec,
                angle: clampStyleNumber(input, 0, 360),
              }),
            onAngleScrubEnd: ed2.liveEnd,
          }
        : {}),
      stops: value,
      selected: value4,
      onSelect: value3,
      onStops: callback2,
      ...(value5
        ? {
            onStopsLive: value5,
            onLiveEnd: ed2.liveEnd,
          }
        : {}),
      minStops: MIN_GRADIENT_STOPS,
      maxStops: MAX_GRADIENT_STOPS,
      disabled: ed2.disabled,
      renderStopPicker: (input: number) =>
        jsxTJ.jsx(runtime.ColorPicker, {
          value: value[input]?.color ?? "#000000",
          onChange: (input2: string) => {
            let value7 = validatedStyleColor(input2);
            if (value7 === undefined) {
              return;
            }
            let value8 = value.map(
              (input3, options) =>
                options === input
                  ? {
                      ...input3,
                      color: value7,
                    }
                  : input3,
            );
            if (value5) {
              value5(value8);
            } else {
              callback2(value8);
            }
          },
          ...(value5
            ? {
                onPickEnd: (input2: string) => {
                  ed2.liveEnd?.();
                  let value7 = validatedStyleColor(input2);
                  if (value7 !== undefined) {
                    callback2(
                      value.map(
                        (input3, options) =>
                          options === input
                            ? {
                                ...input3,
                                color: value7,
                              }
                            : input3,
                      ),
                    );
                  }
                },
              }
            : {}),
        }),
    });
  }
  function GradientStopsStyleEditor({
    rec: rec,
    propKey: propKey,
    ed: ed2,
  }: GradientStyleEditorProps): ReactElement {
    let value = gradientStopRecords(rec),
      callback = (input: GradientStop[]) =>
        ed2.commit(propKey, {
          ...rec,
          stops: sortedGradientStops(input),
        }),
      value2 =
        ed2.live && ed2.liveEnd
          ? (input: GradientStop[]) =>
              ed2.live?.(propKey, {
                ...rec,
                stops: input,
              })
          : undefined,
      callback2 = (input: number, options: Partial<GradientStop>) =>
        value.map(
          (input2, options2) =>
            options2 === input
              ? {
                  ...input2,
                  ...options,
                }
              : input2,
        ),
      value3 = rec.radial === true;
    return jsxTJ.jsxs(reactL9.Fragment, {
      children: [
        jsxTJ.jsx(runtime.TogglePropertyRow, {
          label: "Radial",
          checked: value3,
          disabled: ed2.disabled,
          onChange: (input: boolean) => {
            let { radial: value4, ...value5 } = rec;
            ed2.commit(
              propKey,
              input
                ? {
                    ...value5,
                    radial: true,
                  }
                : value5,
            );
          },
        }),
        jsxTJ.jsx(runtime.NumberPropertyRow, {
          label: "Angle",
          value: finiteStyleNumber(rec.angle),
          placeholder: "180",
          clearable: true,
          min: 0,
          max: 360,
          step: 1,
          unit: "°",
          disabled: ed2.disabled || value3,
          onValue: (input: number | undefined) =>
            ed2.commit(propKey, {
              ...rec,
              angle:
                input === undefined
                  ? undefined
                  : clampStyleNumber(input, 0, 360),
            }),
          ...styleScrubProps(
            ed2,
            propKey,
            (input) => ({
              ...rec,
              angle: clampStyleNumber(input, 0, 360),
            }),
          ),
        }),
        value.map(
          (input, options) =>
            jsxTJ.jsxs(
              reactL9.Fragment,
              {
                children: [
                  jsxTJ.jsx(runtime.ColorTextPropertyRow, {
                    label: "Stop " + String(options + 1),
                    value: input.color,
                    disabled: ed2.disabled,
                    popoverTitle: ed2.unifiedColorPopover
                      ? runtime.COLOR_LABEL
                      : undefined,
                    onChange: (input2: string | undefined) => {
                      if (input2 === undefined) {
                        return;
                      }
                      let value4 = validatedStyleColor(input2);
                      if (value4 !== undefined) {
                        callback(
                          callback2(options, {
                            color: value4,
                          }),
                        );
                      }
                    },
                    ...validatedColorLiveProps(
                      ed2,
                      value2
                        ? (input2: string) =>
                            value2(
                              callback2(options, {
                                color: input2,
                              }),
                            )
                        : undefined,
                    ),
                  }),
                  jsxTJ.jsx(runtime.NumberPropertyRow, {
                    label: "Position " + String(options + 1),
                    value: input.pos,
                    min: 0,
                    max: 100,
                    step: 1,
                    unit: "%",
                    disabled: ed2.disabled,
                    onValue: (input2: number | undefined) =>
                      callback(
                        callback2(options, {
                          pos: clampStyleNumber(input2 ?? 0, 0, 100),
                        }),
                      ),
                    ...(value2 && ed2.liveEnd
                      ? {
                          onScrub: (input2: number) =>
                            value2(
                              callback2(options, {
                                pos: clampStyleNumber(input2, 0, 100),
                              }),
                            ),
                          onScrubEnd: () => {
                            ed2.liveEnd?.();
                            callback(value);
                          },
                        }
                      : {}),
                  }),
                  value.length > MIN_GRADIENT_STOPS &&
                    jsxTJ.jsx(runtime.InspectorPropertyRow, {
                      label: "Stop " + String(options + 1),
                      children: jsxTJ.jsx(runtime.Button, {
                        variant: "ghost",
                        size: "sm",
                        disabled: ed2.disabled,
                        onClick: () =>
                          callback(
                            value.filter(
                              (input2, options2) =>
                                options2 !== options,
                            ),
                          ),
                        children: "Remove stop",
                      }),
                    }),
                ],
              },
              String(options),
            ),
        ),
        value.length < MAX_GRADIENT_STOPS &&
          jsxTJ.jsx(runtime.InspectorPropertyRow, {
            label: "Stops",
            children: jsxTJ.jsx(runtime.Button, {
              variant: "ghost",
              size: "sm",
              icon: "Add",
              disabled: ed2.disabled,
              onClick: () => {
                let value4 = value[value.length - 1] ?? {
                    color: "#000000",
                    pos: 100,
                  },
                  value5 = value[value.length - 2] ?? {
                    color: "#ffffff",
                    pos: 0,
                  };
                callback([
                  ...value,
                  {
                    color: value4.color,
                    pos: clampStyleNumber(
                      (value4.pos + value5.pos) / 2 + 25,
                      0,
                      100,
                    ),
                  },
                ]);
              },
              children: "Add stop",
            }),
          }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactL9",
    () => reactL9,
    (value) => {
      reactL9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxTJ",
    () => jsxTJ,
    (value) => {
      jsxTJ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "propertyValidatorKind",
    () => propertyValidatorKind,
  );
  bindRuntimeValue(
    runtime,
    "propertyValidatorNumber",
    () => propertyValidatorNumber,
  );
  bindRuntimeValue(
    runtime,
    "propertyValidatorStringArray",
    () => propertyValidatorStringArray,
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyValidator",
    () => stylePropertyValidator,
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_ENUM_CHOICES",
    () => MAX_INLINE_ENUM_CHOICES,
    (value) => {
      MAX_INLINE_ENUM_CHOICES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_ENUM_LABEL_LENGTH",
    () => MAX_INLINE_ENUM_LABEL_LENGTH,
    (value) => {
      MAX_INLINE_ENUM_LABEL_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "enumChoicesFitInline",
    () => enumChoicesFitInline,
    (value) => {
      enumChoicesFitInline = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stylePropertyRowModel",
    () => stylePropertyRowModel,
  );
  bindRuntimeValue(
    runtime,
    "STYLE_GROUP_ORDER",
    () => STYLE_GROUP_ORDER,
    (value) => {
      STYLE_GROUP_ORDER = value;
    },
  );
  bindRuntimeValue(runtime, "stylePropertyGroup", () => stylePropertyGroup);
  bindRuntimeValue(
    runtime,
    "HIDDEN_STYLE_PROPERTY_KEYS",
    () => HIDDEN_STYLE_PROPERTY_KEYS,
    (value) => {
      HIDDEN_STYLE_PROPERTY_KEYS = value;
    },
  );
  bindRuntimeValue(runtime, "stylePropertyGroups", () => stylePropertyGroups);
  bindRuntimeValue(runtime, "setStyleProperty", () => setStyleProperty);
  bindRuntimeValue(runtime, "deleteStyleProperty", () => deleteStyleProperty);
  bindRuntimeValue(
    runtime,
    "STYLE_SHORTHAND_LONGHANDS",
    () => STYLE_SHORTHAND_LONGHANDS,
    (value) => {
      STYLE_SHORTHAND_LONGHANDS = value;
    },
  );
  bindRuntimeValue(runtime, "setStyleShorthand", () => setStyleShorthand);
  bindRuntimeValue(runtime, "styleShorthandPatch", () => styleShorthandPatch);
  bindRuntimeValue(
    runtime,
    "normalizeNegativeZero",
    () => normalizeNegativeZero,
  );
  bindRuntimeValue(runtime, "clampValidatorNumber", () => clampValidatorNumber);
  bindRuntimeValue(runtime, "clampStyleNumber", () => clampStyleNumber);
  bindRuntimeValue(runtime, "numericValidator", () => numericValidator);
  bindRuntimeValue(
    runtime,
    "STYLE_LENGTH_UNITS",
    () => STYLE_LENGTH_UNITS,
    (value) => {
      STYLE_LENGTH_UNITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_STYLE_LENGTH_PX",
    () => MAX_STYLE_LENGTH_PX,
    (value) => {
      MAX_STYLE_LENGTH_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_STYLE_PERCENT",
    () => MIN_STYLE_PERCENT,
    (value) => {
      MIN_STYLE_PERCENT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_STYLE_PERCENT",
    () => MAX_STYLE_PERCENT,
    (value) => {
      MAX_STYLE_PERCENT = value;
    },
  );
  bindRuntimeValue(runtime, "styleLengthValue", () => styleLengthValue);
  bindRuntimeValue(runtime, "styleFieldDescriptor", () => styleFieldDescriptor);
  bindRuntimeValue(
    runtime,
    "SHADOW_FIELDS",
    () => SHADOW_FIELDS,
    (value) => {
      SHADOW_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHADOW_SPREAD_FIELD",
    () => SHADOW_SPREAD_FIELD,
    (value) => {
      SHADOW_SPREAD_FIELD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILTER_FIELDS",
    () => FILTER_FIELDS,
    (value) => {
      FILTER_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILTER_PERCENT_FIELDS",
    () => FILTER_PERCENT_FIELDS,
    (value) => {
      FILTER_PERCENT_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TRANSFORM_FIELDS",
    () => TRANSFORM_FIELDS,
    (value) => {
      TRANSFORM_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_GRADIENT_STOPS",
    () => MIN_GRADIENT_STOPS,
    (value) => {
      MIN_GRADIENT_STOPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_GRADIENT_STOPS",
    () => MAX_GRADIENT_STOPS,
    (value) => {
      MAX_GRADIENT_STOPS = value;
    },
  );
  bindRuntimeValue(runtime, "clampStyleField", () => clampStyleField);
  bindRuntimeValue(
    runtime,
    "defaultStylePropertyValue",
    () => defaultStylePropertyValue,
  );
  bindRuntimeValue(runtime, "defaultShadowValue", () => defaultShadowValue);
  bindRuntimeValue(runtime, "ownStyleProperty", () => ownStyleProperty);
  bindRuntimeValue(runtime, "finiteStyleNumber", () => finiteStyleNumber);
  bindRuntimeValue(runtime, "styleStringValue", () => styleStringValue);
  bindRuntimeValue(runtime, "styleRecordValue", () => styleRecordValue);
  bindRuntimeValue(runtime, "styleEffectRecords", () => styleEffectRecords);
  bindRuntimeValue(
    runtime,
    "STYLE_PROPERTY_LABELS",
    () => STYLE_PROPERTY_LABELS,
    (value) => {
      STYLE_PROPERTY_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLUR_EFFECT_LABELS",
    () => BLUR_EFFECT_LABELS,
    (value) => {
      BLUR_EFFECT_LABELS = value;
    },
  );
  bindRuntimeValue(runtime, "styleEffectLabel", () => styleEffectLabel);
  bindRuntimeValue(runtime, "stylePropertyLabel", () => stylePropertyLabel);
  bindRuntimeValue(
    runtime,
    "STYLE_ENUM_VALUE_LABELS",
    () => STYLE_ENUM_VALUE_LABELS,
    (value) => {
      STYLE_ENUM_VALUE_LABELS = value;
    },
  );
  bindRuntimeValue(runtime, "styleEnumValueLabel", () => styleEnumValueLabel);
  bindRuntimeValue(runtime, "styleEnumOptions", () => styleEnumOptions);
  bindRuntimeValue(runtime, "styleValuesEqual", () => styleValuesEqual);
  bindRuntimeValue(runtime, "changedStyleProperty", () => changedStyleProperty);
  bindRuntimeValue(runtime, "createStyleEditor", () => createStyleEditor);
  bindRuntimeValue(runtime, "StyleInspector", () => StyleInspector);
  bindRuntimeValue(
    runtime,
    "MAX_STYLE_EFFECT_ADD_CHOICES",
    () => MAX_STYLE_EFFECT_ADD_CHOICES,
    (value) => {
      MAX_STYLE_EFFECT_ADD_CHOICES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INNER_TEXT_SHADOW_DISABLED_REASON",
    () => INNER_TEXT_SHADOW_DISABLED_REASON,
    (value) => {
      INNER_TEXT_SHADOW_DISABLED_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHAPE_SHADOW_DISABLED_REASON",
    () => SHAPE_SHADOW_DISABLED_REASON,
    (value) => {
      SHAPE_SHADOW_DISABLED_REASON = value;
    },
  );
  bindRuntimeValue(runtime, "styleEffectAddItems", () => styleEffectAddItems);
  bindRuntimeValue(runtime, "shadowStyleKey", () => shadowStyleKey);
  bindRuntimeValue(
    runtime,
    "STYLE_EFFECT_KEYS",
    () => STYLE_EFFECT_KEYS,
    (value) => {
      STYLE_EFFECT_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleEffectsInspector",
    () => StyleEffectsInspector,
  );
  bindRuntimeValue(runtime, "StylePropertyRow", () => StylePropertyRow);
  bindRuntimeValue(runtime, "styleScrubProps", () => styleScrubProps);
  bindRuntimeValue(runtime, "styleLiveColorProps", () => styleLiveColorProps);
  bindRuntimeValue(
    runtime,
    "validatedColorLiveProps",
    () => validatedColorLiveProps,
  );
  bindRuntimeValue(runtime, "StyleValueRow", () => StyleValueRow);
  bindRuntimeValue(
    runtime,
    "MIXED_STYLE_CHOICE",
    () => MIXED_STYLE_CHOICE,
    (value) => {
      MIXED_STYLE_CHOICE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleRemoveShorthandButton",
    () => StyleRemoveShorthandButton,
  );
  bindRuntimeValue(runtime, "validatedStyleColor", () => validatedStyleColor);
  bindRuntimeValue(runtime, "StyleColorTextRow", () => StyleColorTextRow);
  bindRuntimeValue(runtime, "StyleLengthRow", () => StyleLengthRow);
  bindRuntimeValue(runtime, "setRecordField", () => setRecordField);
  bindRuntimeValue(runtime, "StyleRecordRow", () => StyleRecordRow);
  bindRuntimeValue(runtime, "useNestedStyleEditor", () => useNestedStyleEditor);
  bindRuntimeValue(
    runtime,
    "NestedStyleNumberRows",
    () => NestedStyleNumberRows,
  );
  bindRuntimeValue(
    runtime,
    "SHADOW_EDITOR_BOUNDS",
    () => SHADOW_EDITOR_BOUNDS,
    (value) => {
      SHADOW_EDITOR_BOUNDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizedShadowRecord",
    () => normalizedShadowRecord,
  );
  bindRuntimeValue(
    runtime,
    "validatedShadowRecord",
    () => validatedShadowRecord,
  );
  bindRuntimeValue(runtime, "ShadowStyleRow", () => ShadowStyleRow);
  bindRuntimeValue(runtime, "BlurStyleRow", () => BlurStyleRow);
  bindRuntimeValue(runtime, "nestedStyleSummary", () => nestedStyleSummary);
  bindRuntimeValue(
    runtime,
    "NestedStylePopoverRow",
    () => NestedStylePopoverRow,
  );
  bindRuntimeValue(runtime, "gradientStopRecords", () => gradientStopRecords);
  bindRuntimeValue(runtime, "sortedGradientStops", () => sortedGradientStops);
  bindRuntimeValue(
    runtime,
    "GradientPickerStyleEditor",
    () => GradientPickerStyleEditor,
  );
  bindRuntimeValue(
    runtime,
    "GradientStopsStyleEditor",
    () => GradientStopsStyleEditor,
  );
  return () => {
    (0, runtime.initializeTypographyInference)();
    (0, runtime.initializeStyleSchema)();
    (0, runtime.initializeUiPointerMedia)();
    (0, runtime.initializeUiPropertyLabels)();
    (0, runtime.initializeUiInputs210)();
    reactL9 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeStyleSchema)();
    jsxTJ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    MAX_INLINE_ENUM_CHOICES = 4;
    MAX_INLINE_ENUM_LABEL_LENGTH = 20;
    enumChoicesFitInline = (values: readonly string[]) =>
      values.reduce(
        (input: number, options: string) =>
          input + styleEnumValueLabel(options).length,
        0,
      ) <= MAX_INLINE_ENUM_LABEL_LENGTH;
    STYLE_GROUP_ORDER = [
      "Typography",
      "Color & fill",
      "Spacing",
      "Border",
      "Size",
      "Layout",
      "Effects",
    ];
    HIDDEN_STYLE_PROPERTY_KEYS = new Set([
      "visibility",
      "pointerEvents",
      "borderSides",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ]);
    STYLE_SHORTHAND_LONGHANDS = {
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
    STYLE_LENGTH_UNITS = ["px", "%"];
    MAX_STYLE_LENGTH_PX = 4000;
    MIN_STYLE_PERCENT = 1;
    MAX_STYLE_PERCENT = 100;
    SHADOW_FIELDS = [
      styleFieldDescriptor(
        runtime.defaultShadowBounds,
        "x",
        "X",
        "len",
        1,
        "px",
      ),
      styleFieldDescriptor(
        runtime.defaultShadowBounds,
        "y",
        "Y",
        "len",
        1,
        "px",
      ),
      styleFieldDescriptor(
        runtime.defaultShadowBounds,
        "blur",
        "Blur",
        "len",
        1,
        "px",
      ),
    ];
    SHADOW_SPREAD_FIELD = styleFieldDescriptor(
      runtime.defaultShadowBounds,
      "spread",
      "Spread",
      "len",
      1,
      "px",
    );
    FILTER_FIELDS = [
      styleFieldDescriptor(
        runtime.filterBounds,
        "blur",
        "Blur",
        "len",
        0.5,
        "px",
      ),
      styleFieldDescriptor(
        runtime.filterBounds,
        "brightness",
        "Brightness",
        "num",
        0.05,
      ),
      styleFieldDescriptor(
        runtime.filterBounds,
        "contrast",
        "Contrast",
        "num",
        0.05,
      ),
      styleFieldDescriptor(
        runtime.filterBounds,
        "saturate",
        "Saturate",
        "num",
        0.05,
      ),
      styleFieldDescriptor(
        runtime.filterBounds,
        "grayscale",
        "Grayscale",
        "num",
        0.05,
      ),
      styleFieldDescriptor(runtime.filterBounds, "sepia", "Sepia", "num", 0.05),
      styleFieldDescriptor(
        runtime.filterBounds,
        "invert",
        "Invert",
        "num",
        0.05,
      ),
      styleFieldDescriptor(
        runtime.filterBounds,
        "hueRotate",
        "Hue",
        "num",
        1,
        "°",
      ),
    ];
    FILTER_PERCENT_FIELDS = new Set([
      "brightness",
      "contrast",
      "saturate",
      "scale",
    ]);
    TRANSFORM_FIELDS = [
      styleFieldDescriptor(
        runtime.transformBounds,
        "translateX",
        "Move X",
        "len",
        1,
        "px",
      ),
      styleFieldDescriptor(
        runtime.transformBounds,
        "translateY",
        "Move Y",
        "len",
        1,
        "px",
      ),
      styleFieldDescriptor(
        runtime.transformBounds,
        "scale",
        "Scale",
        "num",
        0.05,
      ),
      styleFieldDescriptor(
        runtime.transformBounds,
        "rotate",
        "Rotate",
        "num",
        1,
        "°",
      ),
      styleFieldDescriptor(
        runtime.transformBounds,
        "skewX",
        "Skew X",
        "num",
        1,
        "°",
      ),
      styleFieldDescriptor(
        runtime.transformBounds,
        "skewY",
        "Skew Y",
        "num",
        1,
        "°",
      ),
    ];
    MIN_GRADIENT_STOPS = 2;
    MAX_GRADIENT_STOPS = 8;
    STYLE_PROPERTY_LABELS = {
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
    BLUR_EFFECT_LABELS = {
      filter: "Layer blur",
      backdropFilter: "Background blur",
    };
    STYLE_ENUM_VALUE_LABELS = {
      "line-through": "Strikethrough",
      "tabular-nums": "Tabular numbers",
    };
    MAX_STYLE_EFFECT_ADD_CHOICES = 4;
    INNER_TEXT_SHADOW_DISABLED_REASON =
      "Inner shadow needs a fill or border on this text";
    SHAPE_SHADOW_DISABLED_REASON = "Not on diamond or arrow shapes";
    STYLE_EFFECT_KEYS = ["boxShadow", "filter", "backdropFilter"];
    MIXED_STYLE_CHOICE = "\x00mixed";
    SHADOW_EDITOR_BOUNDS = Object.fromEntries(
      [...SHADOW_FIELDS, SHADOW_SPREAD_FIELD].map(
        (input): [string, StyleFieldBounds] => [
          input.field,
          {
            min: input.min,
            max: input.max,
            step: input.step,
          },
        ],
      ),
    );
  };
}
