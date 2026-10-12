/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesGridRow(
  runtime: RuntimeBindings,
): () => void {
  function PropertyGridColumnsRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.parseEqualGridColumns)(
        state.mixed ? null : state.value,
      ),
      value2: Dynamic = (0, runtime.parseEqualGridColumns)(state.fallback),
      value3: Dynamic = state.spec?.min ?? 1,
      value4: Dynamic = state.spec?.max ?? 12,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value5: Dynamic = input.trim();
        if (!value5) {
          onCommit(state.prop, null);
          return;
        }
        let value6: Dynamic = /^\d{1,3}$/.test(value5)
          ? parseInt(value5, 10)
          : null;
        onCommit(
          state.prop,
          value6 != null && value6 >= 1
            ? (0, runtime.serializeEqualGridColumns)(
                Math.min(value4, Math.max(value3, value6)),
              )
            : value5,
        );
      };
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertyTextInput
          display={state.mixed || value == null ? "" : String(value)}
          placeholder={
            state.mixed ? "Mixed" : value2 != null ? String(value2) : "auto"
          }
          title={state.spec?.hint}
          aria-label={state.label}
          disabled={state.disabled}
          onCommitText={callback}
          onArrowStep={(input?: Dynamic, options?: Dynamic): Dynamic => {
            if (state.mixed) return null;
            let value5: Dynamic = /^\d{1,3}$/.test(input.trim())
              ? parseInt(input.trim(), 10)
              : (value ?? value2 ?? 1);
            return String(Math.min(value4, Math.max(value3, value5 + options)));
          }}
        />
      </runtime.PropertyRow>
    );
  }
  function parseGridSpan(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim().toLowerCase(),
      value2: Dynamic = /^span\s+(\d{1,2})$/.exec(value);
    if (!value2) return null;
    let value3: Dynamic = parseInt(value2[1], 10);
    return value3 >= 1 ? value3 : null;
  }
  function PropertyGridSpanRow({
    state: state,
    onCommit: onCommit,
    shell: shell,
  }: Dynamic): Dynamic {
    let value: Dynamic = parseGridSpan(state.mixed ? null : state.value),
      value2: Dynamic = state.inheritedFrom
        ? parseGridSpan(state.fallback ?? null)
        : null,
      value3: Dynamic = state.spec?.min ?? 1,
      value4: Dynamic = state.spec?.max ?? 12,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        onCommit(
          state.prop,
          input <= 1 ? (state.inheritedFrom ? "auto" : null) : `span ${input}`,
        );
    return (
      <runtime.PropertyRow {...shell}>
        <runtime.PropertyTextInput
          display={state.mixed || value == null ? "" : String(value)}
          placeholder={
            state.mixed
              ? "Mixed"
              : String(parseGridSpan(state.fallback ?? null) ?? 1)
          }
          aria-label={state.label}
          disabled={state.disabled}
          onCommitText={(input?: Dynamic): Dynamic => {
            let value5: Dynamic = input.trim();
            if (!value5) return callback(1);
            let value6: Dynamic = /^\d{1,2}$/.test(value5)
              ? parseInt(value5, 10)
              : null;
            value6 != null
              ? callback(Math.min(value4, Math.max(value3, value6)))
              : onCommit(state.prop, value5);
          }}
          onArrowStep={(input?: Dynamic, options?: Dynamic): Dynamic => {
            if (state.mixed) return null;
            let value5: Dynamic = /^\d{1,2}$/.test(input.trim())
              ? parseInt(input.trim(), 10)
              : (value ?? value2 ?? 1);
            return String(Math.min(value4, Math.max(value3, value5 + options)));
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(
    runtime,
    "PropertyGridColumnsRow",
    () => PropertyGridColumnsRow,
  );
  bindRuntimeValue(runtime, "parseGridSpan", () => parseGridSpan);
  bindRuntimeValue(runtime, "PropertyGridSpanRow", () => PropertyGridSpanRow);
  return () => {};
}
