/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssInheritance(
  runtime: RuntimeBindings,
): () => void {
  function resolveCssVariable(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/s.exec(
      context.trim(),
    );
    if (!value) return "";
    for (let value2 of [options, "html", ":root"] as Dynamic) {
      let value3: Dynamic = (0, runtime.getCssRuleProperty)(
        input,
        value2,
        value[1],
      );
      if (value3 && !/^var\(/i.test(value3)) return value3;
    }
    return value[2]?.trim() ?? "";
  }
  function utilityClassSelector(input?: Dynamic): Dynamic {
    return input.parent !== undefined
      ? `.${input.parent} .${input.className}`
      : input.also !== undefined
        ? `.${input.className}.${input.also}`
        : `.${input.className}`;
  }
  function mergeAuthoredStyle(
    items?: Dynamic,
    items2?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = (0, runtime.parseStyleDeclarations)(context);
    if (items2.length === 0 || items.length === 0) return value2;
    let values: Dynamic = new Set(items2),
      entries: Dynamic = new Map(),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        entries.delete(input.prop);
        entries.set(
          input.prop,
          options === undefined
            ? {
                prop: input.prop,
                value: input.value,
              }
            : {
                prop: input.prop,
                value: input.value,
                selector: options,
              },
        );
      };
    for (let value3 of items as Dynamic)
      if (
        !(value3.parent !== undefined || value3.also !== undefined) &&
        values.has(value3.className)
      )
        for (let value4 of value3.decls as Dynamic)
          callback(value4, utilityClassSelector(value3));
    for (let value3 of items as Dynamic)
      if (values.has(value3.className)) {
        if (value3.also !== undefined) {
          if (!values.has(value3.also)) continue;
        } else if (value3.parent !== undefined) {
          if (!value || !value.has(value3.parent)) continue;
        } else continue;
        for (let value4 of value3.decls as Dynamic)
          callback(value4, utilityClassSelector(value3));
      }
    for (let value3 of value2 as Dynamic) callback(value3);
    return [...entries.values()];
  }
  function getCssPropertySources(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        entries.delete(input2);
        entries.set(input2, options);
      };
    for (let value2 of input as Dynamic) {
      let value3: Dynamic = (0, runtime.expandCssShorthand)(value2);
      if (value3) {
        callback(value2.prop, value2.selector);
        for (let value4 of value3 as Dynamic)
          callback(value4.prop, value2.selector);
      } else callback(value2.prop, value2.selector);
    }
    let value: Dynamic = Object.create(null);
    for (let [value2, value3] of entries as Dynamic)
      value3 !== undefined && (value[value2] = value3);
    return value;
  }
  bindRuntimeValue(runtime, "resolveCssVariable", () => resolveCssVariable);
  bindRuntimeValue(runtime, "utilityClassSelector", () => utilityClassSelector);
  bindRuntimeValue(runtime, "mergeAuthoredStyle", () => mergeAuthoredStyle);
  bindRuntimeValue(
    runtime,
    "getCssPropertySources",
    () => getCssPropertySources,
  );
  return () => {};
}
