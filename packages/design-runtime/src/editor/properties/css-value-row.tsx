/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesCssValueRow(
  runtime: RuntimeBindings,
): () => void {
  function PropertyCssTextRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let { text: value, placeholder: value2 }: Dynamic = (0,
    runtime.inspectorFieldDisplay)(state);
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertyTextInput
          display={value}
          placeholder={value2}
          hint={state.hint}
          aria-label={state.label}
          disabled={state.disabled}
          onCommitText={(input?: Dynamic): Dynamic =>
            onCommit(
              state.prop,
              input.trim()
                ? (0, runtime.normalizePropertyNumber)(state.prop, input.trim())
                : null,
            )
          }
        />
      </runtime.PropertyRow>
    );
  }
  function propertyOptionLabel(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input?.optionLabels?.[options];
    if (value) return value;
    let value2: Dynamic = options.replace(/-/g, " ");
    return value2.charAt(0).toUpperCase() + value2.slice(1);
  }
  function PropertyCssEnumRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let { text: value, isLiteral: value2 }: Dynamic = (0,
    runtime.inspectorFieldDisplay)(state);
    if (!value2 && value)
      return (
        <PropertyCssTextRow state={state} onCommit={onCommit} shell={shell} />
      );
    let value3: Dynamic = state.spec?.options ?? [],
      value4: Dynamic = value || "",
      value5: Dynamic = (state.fallback ?? "").trim(),
      value6: Dynamic = value4 === "" && !state.mixed,
      value7: Dynamic = value4 !== "" && !value3.includes(value4),
      items: Dynamic = [...(value7 ? [value4] : []), ...value3],
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        value7 && input === value4
          ? input
          : propertyOptionLabel(state.spec, input),
      value8: Dynamic = value3.includes(value5)
        ? propertyOptionLabel(state.spec, value5)
        : value5;
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertySelect
          aria-label={state.label}
          items={items.map(
            (input?: Dynamic): Dynamic => ({
              value: input,
              label: callback(input),
            }),
          )}
          value={state.mixed ? null : value4 || null}
          placeholder={state.mixed ? "Mixed" : value5 ? value8 : undefined}
          hint={runtime.Value_6}
          title={
            value6 && !state.inheritedFrom
              ? "Inherited \u2014 right-click to keep unset"
              : undefined
          }
          disabled={state.disabled}
          onChange={(input?: Dynamic): Dynamic => {
            (input || null) !== (value4 || null) &&
              onCommit(state.prop, input || null);
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "PropertyCssTextRow", () => PropertyCssTextRow);
  bindRuntimeValue(runtime, "propertyOptionLabel", () => propertyOptionLabel);
  bindRuntimeValue(runtime, "PropertyCssEnumRow", () => PropertyCssEnumRow);
  return () => {};
}
