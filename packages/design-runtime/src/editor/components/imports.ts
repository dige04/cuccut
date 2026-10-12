/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsImports(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsImportsComponentFromGlobalScopePattern: Dynamic;
  function parseComponentImport(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input !== "dc-import" && input !== "x-import") return null;
    let value: Dynamic = input === "dc-import",
      value2: Dynamic = options["component-from-global-scope"] || "",
      value3: Dynamic = options.component || "",
      value4: Dynamic = value
        ? options.name || value3
        : value2 || (options.from != null ? value3 : "");
    if (
      ((options.from || "") + " " + value2 + " " + value3)
        .toLowerCase()
        .includes("deck-stage") ||
      value4.toLowerCase() === "image-slot"
    )
      return null;
    let value5: Dynamic = value4.lastIndexOf(value ? "/" : "."),
      value6: Dynamic = value4.slice(value5 + 1);
    if (value6 === "" || value4.includes("{{")) return null;
    let state: Dynamic = {
        kind: value
          ? "canvas"
          : options.from == null && value2.includes(".")
            ? "system"
            : "module",
        ref: value4,
        name: value6,
      },
      value7: Dynamic = value4.slice(0, Math.max(value5, 0)),
      value8: Dynamic = value
        ? value7
            .split("/")
            .filter(function (input2?: Dynamic): Dynamic {
              return input2 !== "" && input2 !== "." && input2 !== "..";
            })
            .join("/")
        : value7;
    value8 !== "" && (state.scope = value8);
    return state;
  }
  function sharedComponentImport(input?: Dynamic): Dynamic {
    let value: Dynamic = input[0];
    return value == null ||
      input.some((input2?: Dynamic): Dynamic => input2 == null)
      ? null
      : {
          shared: input.every(
            (source?: Dynamic): Dynamic =>
              source.kind === value.kind && source.ref === value.ref,
          )
            ? value
            : null,
        };
  }
  bindRuntimeValue(
    runtime,
    "ComponentsImportsComponentFromGlobalScopePattern",
    () => ComponentsImportsComponentFromGlobalScopePattern,
    (value) => {
      ComponentsImportsComponentFromGlobalScopePattern = value;
    },
  );
  bindRuntimeValue(runtime, "parseComponentImport", () => parseComponentImport);
  bindRuntimeValue(
    runtime,
    "sharedComponentImport",
    () => sharedComponentImport,
  );
  return () => {
    ComponentsImportsComponentFromGlobalScopePattern =
      /^(component(-from-global-scope|FromGlobalScope)?|from|dc-props|dcProps|sc-name|hint-size|hintSize|style-.*|data-(dc|om)-.*)$/;
    (0, runtime.initializeEditorAttributeValidation)();
  };
}
