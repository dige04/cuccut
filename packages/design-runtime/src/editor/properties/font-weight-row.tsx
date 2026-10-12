/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesFontWeightRow(
  runtime: RuntimeBindings,
): () => void {
  function PropertyFontWeightRow({
    state: state,
    onCommit: onCommit,
    onCommitMany: onCommitMany,
    onFacesOpen: onFacesOpen,
    shell: shell,
  }: Dynamic): Dynamic {
    let { text: value, isLiteral: value2 }: Dynamic = (0,
      runtime.inspectorFieldDisplay)(state),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input === "bold"
          ? 700
          : input === "normal"
            ? 400
            : /^\d+(\.\d+)?$/.test(input)
              ? Number(input)
              : undefined;
    if (value && (!value2 || callback(value.trim()) === undefined))
      return (
        <runtime.PropertyCssTextRow
          state={state}
          onCommit={onCommit}
          shell={shell}
        />
      );
    let value3: Dynamic = (state.companionValue ?? "").trim(),
      value4: Dynamic = /^(italic|oblique)/.test(
        value3 || (state.companionFallback ?? "").trim(),
      ),
      state2: Dynamic = {
        weight:
          callback(value.trim()) ??
          callback((state.fallback ?? "").trim()) ??
          400,
        italic: value4,
      },
      value5: Dynamic = value !== "" || value3 !== "",
      value6: Dynamic = state.mixed || state.companionMixed;
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertySelect
          aria-label={state.label}
          items={(0, runtime.includeCurrentFontVariant)(
            state.faces ?? runtime.TypographyFontVariantsFlatMapValue,
            state2,
          )}
          value={
            value6 || !value5
              ? null
              : (0, runtime.fontVariantKey)(state2.weight, state2.italic)
          }
          placeholder={
            value6
              ? "Mixed"
              : (0, runtime.fontVariantLabel)(state2.weight, state2.italic)
          }
          hint={runtime.Value_6}
          title={
            !value5 && !value6 && !state.inheritedFrom
              ? "Inherited \u2014 right-click to keep unset"
              : undefined
          }
          disabled={state.disabled}
          onOpenChange={(input?: Dynamic): Dynamic => input && onFacesOpen?.()}
          onChange={(input?: Dynamic): Dynamic => {
            let value7: Dynamic = (0, runtime.parseFontVariantKey)(input);
            if (
              value7 === undefined ||
              (value5 &&
                !value6 &&
                value7.weight === state2.weight &&
                value7.italic === state2.italic)
            )
              return;
            let value8: Dynamic = value7.italic
                ? "italic"
                : value4
                  ? "normal"
                  : value3 || null,
              items: Dynamic = [
                {
                  prop: state.prop,
                  value: String(value7.weight),
                },
                {
                  prop: "font-style",
                  value: value8,
                },
              ];
            if (onCommitMany) onCommitMany(items);
            else
              for (let value9 of items as Dynamic)
                onCommit(value9.prop, value9.value);
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(
    runtime,
    "PropertyFontWeightRow",
    () => PropertyFontWeightRow,
  );
  return () => {};
}
