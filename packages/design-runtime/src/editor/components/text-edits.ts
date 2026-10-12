/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsTextEdits(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsTextEditsClickDblclickPattern: Dynamic;
  var ComponentsTextEditsPattern: Dynamic;
  var ComponentsTextEditsPattern_2: Dynamic;
  var ComponentsTextEditsPattern_3: Dynamic;
  var ComponentsTextEditsLimit: Dynamic;
  function normalizeTextWhitespace(input?: Dynamic): Dynamic {
    return input
      .replace(/[ \t\n\r\f\u00a0]*[ \t\n\r\f][ \t\n\r\f\u00a0]*/g, " ")
      .replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, "");
  }
  function normalizeTextWords(input?: Dynamic): Dynamic {
    return input.replace(/[ \t\n\r\f]+/g, " ").replace(/^ | $/g, "");
  }
  function collectTemplateTextValues(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(),
      count: Dynamic = 5e3,
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        if (typeof input2 == "string") values.add(normalizeTextWords(input2));
        else if (typeof input2 == "number" && Number.isFinite(input2))
          values.add(String(input2));
        else if (
          input2 != null &&
          typeof input2 == "object" &&
          options2 < 6 &&
          --count > 0
        )
          for (let value of Object.values(input2) as Dynamic)
            callback(value, options2 + 1);
      };
    for (let value of input as Dynamic) callback(value.value, 0);
    callback(options.values, 0);
    for (let value of Object.values(options.propsMeta) as Dynamic)
      callback(value?.default, 1);
    return values;
  }
  function componentTextOptions(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.parseComponentImport)(
      input.tag,
      input.attrs,
    );
    if (value == null || value.kind === "canvas") return [];
    let entries: Dynamic = new Map(),
      flag: Dynamic = false,
      flag2: Dynamic = false,
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        input2 !== "" &&
          entries.set(input2, entries.has(input2) ? null : options2);
      },
      callback2: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value2: Dynamic = ComponentsTextEditsPattern.exec(options2);
        if (value2) {
          let value4: Dynamic = value2[1];
          return callback(
            normalizeTextWords(
              value4 == null
                ? (value2[3] ?? "")
                : value4 === "true" || value4 === "false"
                  ? value4
                  : String(Number(value4)),
            ),
            null,
          );
        }
        if (!options2.includes("{{")) {
          let value4: Dynamic = normalizeTextWords(options2);
          return callback(
            value4,
            value4.length > ComponentsTextEditsLimit ? null : input2,
          );
        }
        context !== "handler" && (flag = true);
        let value3: Dynamic = options2.split(/\{\{[^{}]*\}\}/);
        if (context === "deep")
          for (let value4 of value3 as Dynamic)
            callback(normalizeTextWords(value4), null);
        else
          (value3.length > 2 ||
            value3.some(
              (input3?: Dynamic): Dynamic => /[^\s{}]/.test(input3),
            )) &&
            (flag2 = true);
      };
    callback2(input.text != null ? "__text" : null, input.ownText, "own");
    for (let value2 of input.deepText as Dynamic)
      callback2(null, value2, "deep");
    for (let [value2, value3] of Object.entries(input.attrs) as Dynamic) {
      (value2 === "dc-props" || value2 === "dcProps") && (flag = true);
      !runtime.ComponentsImportsComponentFromGlobalScopePattern.test(value2) &&
        callback2(
          (0, runtime.isProtectedAttribute)("@" + value2, [input.tag]) ||
            ComponentsTextEditsPattern_2.test(value3.trim())
            ? null
            : "@" + value2,
          value3,
          ComponentsTextEditsClickDblclickPattern.test(value2)
            ? "handler"
            : "attr",
        );
    }
    if (flag2) return [];
    let items: Dynamic = [];
    for (let [value2, value3] of entries as Dynamic)
      value3 != null &&
        !(
          flag &&
          (value2.length < 2 ||
            ComponentsTextEditsPattern_3.test(value2) ||
            options.has(value2))
        ) &&
        items.push({
          words: value2,
          key: value3,
        });
    return items;
  }
  function normalizeComponentTextEdit(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (input == null || typeof input != "object")
      return {
        kind: "drop",
      };
    let key: Dynamic = input.key,
      words: Dynamic = input.words;
    if (
      typeof key != "string" ||
      typeof words != "string" ||
      typeof items != "string"
    )
      return {
        kind: "drop",
      };
    if (
      !context.some(
        (input2?: Dynamic): Dynamic =>
          input2.key === key && input2.words === words,
      )
    )
      return {
        kind: "refuse",
      };
    if (items.length > runtime.ComponentsPropsResolvedValue)
      return {
        kind: "toolong",
      };
    let value: Dynamic = normalizeTextWhitespace(items);
    return value.length > ComponentsTextEditsLimit
      ? {
          kind: "toolong",
        }
      : value === "" || value === words
        ? {
            kind: "noop",
          }
        : {
            kind: "commit",
            key: key,
            text: value,
          };
  }
  bindRuntimeValue(
    runtime,
    "normalizeTextWhitespace",
    () => normalizeTextWhitespace,
  );
  bindRuntimeValue(runtime, "normalizeTextWords", () => normalizeTextWords);
  bindRuntimeValue(
    runtime,
    "collectTemplateTextValues",
    () => collectTemplateTextValues,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextEditsClickDblclickPattern",
    () => ComponentsTextEditsClickDblclickPattern,
    (value) => {
      ComponentsTextEditsClickDblclickPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextEditsPattern",
    () => ComponentsTextEditsPattern,
    (value) => {
      ComponentsTextEditsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextEditsPattern_2",
    () => ComponentsTextEditsPattern_2,
    (value) => {
      ComponentsTextEditsPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextEditsPattern_3",
    () => ComponentsTextEditsPattern_3,
    (value) => {
      ComponentsTextEditsPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextEditsLimit",
    () => ComponentsTextEditsLimit,
    (value) => {
      ComponentsTextEditsLimit = value;
    },
  );
  bindRuntimeValue(runtime, "componentTextOptions", () => componentTextOptions);
  bindRuntimeValue(
    runtime,
    "normalizeComponentTextEdit",
    () => normalizeComponentTextEdit,
  );
  return () => {
    ComponentsTextEditsClickDblclickPattern =
      /^on(-|[A-Z]|(click|dblclick|auxclick|contextmenu|change|input|beforeinput|submit|reset|invalid|focus|blur|focus(in|out)|key(down|up|press)|mouse(down|up|enter|leave|over|out|move)|pointer(down|up|enter|leave|over|out|move|cancel)|touch(start|end|move|cancel)|drag(start|end|enter|leave|over)?|drop|copy|cut|paste|wheel|scroll|resize|select|toggle|load|error|open|close|animation(start|end|iteration)|transition(start|end|run|cancel))$)/;
    ComponentsTextEditsPattern =
      /^\s*\{\{\s*(?:(-?\d+(?:\.\d+)?|true|false)|(['"])([^{}]*)\2)\s*\}\}\s*$/;
    ComponentsTextEditsPattern_2 = /^(-?\d+(\.\d+)?|true|false)$/;
    ComponentsTextEditsPattern_3 = /^-?[\d.,\s]+$/;
    ComponentsTextEditsLimit = 2e3;
  };
}
