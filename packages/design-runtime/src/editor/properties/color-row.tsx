/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesColorRow(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesColorRowSizeFillShadowSet: Dynamic;
  function backgroundWellValue(input?: Dynamic): Dynamic {
    if (input.mixed)
      return {
        empty: true,
      };
    let value: Dynamic = (input.fallback ?? "").trim(),
      value2: Dynamic =
        value && (0, runtime.classifyStyleValue)(value).kind === "literal"
          ? {
              css: value,
              empty: false,
            }
          : {
              empty: true,
            },
      value3: Dynamic = (input.value ?? "").trim();
    if (!value3) return value2;
    let kind: Dynamic = (0, runtime.classifyStyleValue)(value3).kind;
    return kind === "var"
      ? value2
      : kind !== "literal"
        ? {
            empty: true,
          }
        : {
            css: value3,
            empty: false,
          };
  }
  function PropertyCssColorRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let {
        dsColorTokens: value,
        artboardColors: value2,
        iframeDefinedVars: value3,
        editsAreUndoSteps: value4,
      }: Dynamic = (0, runtime.useInspectorContext)(),
      { text: value5, placeholder: value6 }: Dynamic = (0,
      runtime.inspectorFieldDisplay)(state),
      { css: value7, empty: value8 }: Dynamic = backgroundWellValue(state),
      value9: Dynamic = (0, runtime.resolveColorTokenValue)(
        state.varSource ?? state.value,
        value,
      );
    value9 && ((value7 = value9), (value8 = false));
    let value10: Dynamic = state.mixed
        ? undefined
        : (state.varSource ?? (value5 || value6)) || undefined,
      value11: Dynamic = state.varPartial ? value5 || value6 : value10,
      value12: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useMemo)(
        (): Dynamic =>
          (0, runtime.matchArtboardColorToken)(value11, value, value3),
        [value11, value, value3],
      ),
      value13: Dynamic =
        !!state.inheritedFrom || !(state.varSource ?? state.value ?? "").trim(),
      [value14, value15]: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useState)(undefined),
      value16: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useMemo)(
        (): Dynamic =>
          (0, runtime.mergeDesignSystemSwatches)(
            value14,
            (0, runtime.editorColorSwatches)(value),
          ),
        [value14, value],
      ),
      value17: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useMemo)(
        (): Dynamic =>
          (0, runtime.matchAuthoredColorToken)(value10, value16, value3),
        [value10, value16, value3],
      ),
      value18: Dynamic =
        value7 !== undefined &&
        (0, runtime.PropertiesDropShadowEditorTest)(value7)
          ? ((0, runtime.normalizeCssColor)(value7) ??
            (0, runtime.normalizeCssColor)(
              (0, runtime.describeColorValue)(value7),
            ) ??
            value7)
          : undefined;
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertyColorRow
          testid={`dc-color-${state.prop}`}
          label={state.label}
          value={value8 ? undefined : value18}
          clearLabel={
            (0, runtime.describeColorValue)(value5) ||
            (0, runtime.describeColorValue)(value6) ||
            runtime.Value_6
          }
          unset={value13}
          valueName={value12 ?? null}
          mixed={state.mixed}
          disabled={state.disabled}
          swatches={value16}
          current={value17}
          fold={true}
          popoverTitle={runtime.ColorValue}
          editsAreUndoSteps={value4}
          onOpenChange={(input?: Dynamic): Dynamic => {
            input && value15((0, runtime.artboardColorSwatchGroup)(value2));
          }}
          onSwatch={(input?: Dynamic): Dynamic => {
            let value19: Dynamic = (0, runtime.resolveColorSwatchValue)(
              input,
              value16,
              value3,
            );
            value19 !== undefined && onCommit(state.prop, value19);
          }}
          onChange={(input?: Dynamic): Dynamic => {
            input !== undefined && onCommit(state.prop, input);
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "backgroundWellValue", () => backgroundWellValue);
  bindRuntimeValue(runtime, "PropertyCssColorRow", () => PropertyCssColorRow);
  bindRuntimeValue(
    runtime,
    "PropertiesColorRowSizeFillShadowSet",
    () => PropertiesColorRowSizeFillShadowSet,
    (value) => {
      PropertiesColorRowSizeFillShadowSet = value;
    },
  );
  return () => {
    PropertiesColorRowSizeFillShadowSet = new Set([
      "size",
      "fill",
      "shadow",
      "image",
      "transform",
    ]);
  };
}
