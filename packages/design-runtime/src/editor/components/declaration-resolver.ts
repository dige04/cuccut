/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsDeclarationResolver(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsDeclarationResolverNameTypeValueValues: Dynamic;
  var ComponentsDeclarationResolverDelayMs: Dynamic;
  var ComponentsDeclarationResolverLimit: Dynamic;
  var ComponentsDeclarationResolverElementCache: Dynamic;
  function getTypeDeclarationResolver(items?: Dynamic): Dynamic {
    if (
      runtime.ComponentsTypeInferenceTextsRsConfig !== null &&
      runtime.ComponentsTypeInferenceTextsRsConfig.texts.length ===
        items.length &&
      runtime.ComponentsTypeInferenceTextsRsConfig.texts.every(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input === items[options],
      )
    )
      return runtime.ComponentsTypeInferenceTextsRsConfig.rs.reuse();
    let value: Dynamic = new runtime.TypeDeclarationResolver(items);
    runtime.ComponentsTypeInferenceTextsRsConfig = {
      texts: items,
      rs: value,
    };
    return value;
  }
  function inferComponentProps(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    runtime.typeInferenceIncomplete = false;
    let value: Dynamic = options.filter(
      (input2?: Dynamic): Dynamic => typeof input2 == "string" && input2 !== "",
    );
    if (!(0, runtime.isValidTypeDeclarationName)(input) || value.length === 0)
      return [];
    let values: Dynamic = new Set(context?.keep),
      entries: Dynamic = new Map(),
      values2: Dynamic = new Set(),
      value2: Dynamic = getTypeDeclarationResolver(value),
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        if (
          options2 > runtime.ComponentsTypeInferenceLimit_5 ||
          values2.has(input2) ||
          entries.size >= runtime.ComponentsTypeInferenceLimit
        )
          return;
        values2.add(input2);
        let value3: Dynamic = value2.decl(input2);
        if (
          value3 === null ||
          value3.kind === "const" ||
          value3.kind === "enum"
        )
          return;
        let value4: Dynamic =
          value3.kind === "interface"
            ? [value3.body]
            : value2.heads(value3.head);
        for (let value5 of value4 as Dynamic)
          for (let value6 of value2.members(value5) as Dynamic) {
            value2.tick();
            if (entries.size >= runtime.ComponentsTypeInferenceLimit) break;
            if (
              (runtime.ComponentsTypeInferenceSubscribers_2.has(value6.name) &&
                !values.has(value6.name)) ||
              (value6.name.startsWith("on") && /^on[A-Z]/.test(value6.name)) ||
              /@deprecated\b/.test(value6.doc) ||
              /^\s*never\s*$/.test(value6.type)
            )
              continue;
            let value7: Dynamic = value2.resolve(value6.type, 0);
            if (value7 === null) continue;
            let entry: Dynamic = entries.get(value6.name);
            if (
              entry !== undefined &&
              !(
                entry.kind === "string" &&
                entry.typeName !== undefined &&
                value7.kind !== "string"
              )
            )
              continue;
            let state: Dynamic = {
              name: value6.name,
              kind: value7.kind,
            };
            value7.options !== undefined && (state.options = value7.options);
            value7.numeric === true && (state.numeric = true);
            value7.withBool === true && (state.withBool = true);
            value7.typeName !== undefined && (state.typeName = value7.typeName);
            let value8: Dynamic = (0, runtime.inferJSDocDefault)(
              value6.doc,
              value7,
            );
            value8 !== undefined && (state.default = value8);
            value6.optional || (state.required = true);
            entries.set(value6.name, state);
          }
        value2.charge(value3.head.length);
        for (let value5 of (0, runtime.typeExpressionReferences)(
          value3.head,
        ) as Dynamic)
          callback(value5, options2 + 1);
      };
    try {
      callback(input + "Props", 0);
    } catch (value3: Dynamic) {
      runtime.ComponentsTypeInferenceTextsRsConfig = null;
      if (value3 !== runtime.TYPE_INFERENCE_OVER_BUDGET) throw value3;
      runtime.typeInferenceIncomplete = true;
      return [];
    }
    let items: Dynamic = [...entries.values()];
    items.sort(
      (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        input2.name === "children" ? -1 : options2.name === "children" ? 1 : 0,
    );
    return items;
  }
  function filterEditableInferredProps(input?: Dynamic): Dynamic {
    return input.filter(
      (input2?: Dynamic): Dynamic =>
        input2.name !== "children" &&
        /^[a-z_][\w.-]*$/.test(input2.name) &&
        !(input2.name in Object.prototype),
    );
  }
  function inferPropsFromDeclarations(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    try {
      for (let value of input as Dynamic) {
        let value2: Dynamic = filterEditableInferredProps(
          inferComponentProps(value, options, {
            keep: context,
          }),
        );
        if (value2.length > 0) return value2;
      }
    } catch {}
    return [];
  }
  function componentTypeCandidates(input?: Dynamic): Dynamic {
    let value: Dynamic = input.split(".").slice(1);
    if (value.length === 0) return [];
    let value2: Dynamic = value[value.length - 1];
    return [...new Set([value.join(""), value2, value2 + "Root"])];
  }
  function typeExpressionTooDeep(items?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < items.length; index2++) {
      let value: Dynamic = items.charCodeAt(index2);
      if (value === 40 || value === 91 || value === 123) {
        if (++index > ComponentsDeclarationResolverLimit) return true;
      } else
        (value === 41 || value === 93 || value === 125) && index > 0 && index--;
    }
    return false;
  }
  bindRuntimeValue(
    runtime,
    "getTypeDeclarationResolver",
    () => getTypeDeclarationResolver,
  );
  bindRuntimeValue(runtime, "inferComponentProps", () => inferComponentProps);
  bindRuntimeValue(
    runtime,
    "filterEditableInferredProps",
    () => filterEditableInferredProps,
  );
  bindRuntimeValue(
    runtime,
    "inferPropsFromDeclarations",
    () => inferPropsFromDeclarations,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDeclarationResolverNameTypeValueValues",
    () => ComponentsDeclarationResolverNameTypeValueValues,
    (value) => {
      ComponentsDeclarationResolverNameTypeValueValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDeclarationResolverDelayMs",
    () => ComponentsDeclarationResolverDelayMs,
    (value) => {
      ComponentsDeclarationResolverDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "componentTypeCandidates",
    () => componentTypeCandidates,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDeclarationResolverLimit",
    () => ComponentsDeclarationResolverLimit,
    (value) => {
      ComponentsDeclarationResolverLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typeExpressionTooDeep",
    () => typeExpressionTooDeep,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsDeclarationResolverElementCache",
    () => ComponentsDeclarationResolverElementCache,
    (value) => {
      ComponentsDeclarationResolverElementCache = value;
    },
  );
  return () => {
    ComponentsDeclarationResolverNameTypeValueValues = [
      "name",
      "type",
      "value",
      "defaultValue",
    ];
    ComponentsDeclarationResolverDelayMs = 2e3;
    ComponentsDeclarationResolverLimit = 256;
    ComponentsDeclarationResolverElementCache = new WeakMap();
  };
}
