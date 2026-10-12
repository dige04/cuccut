/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCodePropertyCode(
  runtime: RuntimeBindings,
): () => void {
  var CodePropertyCodeConstant: Dynamic;
  var CodePropertyCodeConstant_2: Dynamic;
  var CodePropertyCodeResolvedValue: Dynamic;
  function getSelectionCodeEntries(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.map((input2?: Dynamic): Dynamic => {
      let entries: Dynamic = new Map();
      for (let value5 of (0, runtime.parseStyleDeclarations)(
        input.effectiveStyleAttr(input2),
      ) as Dynamic)
        entries.set(value5.prop, value5.value);
      let value4: Dynamic = input.attributes(input2);
      for (let [value5, value6] of Object.entries(value4) as Dynamic)
        runtime.InspectorClassTargetsDataDcDataScPattern.test(value5) ||
          entries.set("@" + value5, value6);
      return entries;
    });
    if (value.length === 0)
      return {
        entries: [],
        mixed: [],
      };
    let value2: Dynamic = value[0],
      items: Dynamic = [],
      items2: Dynamic = [],
      values: Dynamic = new Set();
    for (let value4 of value as Dynamic)
      for (let value5 of value4.keys() as Dynamic) values.add(value5);
    let value3: Dynamic = [
      ...value2.keys(),
      ...[...values].filter((input2?: Dynamic): Dynamic => !value2.has(input2)),
    ].sort(
      (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        Number(input2.startsWith("@")) - Number(options2.startsWith("@")),
    );
    for (let value4 of value3 as Dynamic) {
      let value5: Dynamic = value.map(
        (input2?: Dynamic): Dynamic => input2.get(value4),
      );
      value5.every(
        (input2?: Dynamic): Dynamic =>
          input2 !== undefined && input2 === value5[0],
      )
        ? items.push({
            key: value4,
            value: value5[0],
          })
        : items2.push(value4);
    }
    return {
      entries: items,
      mixed: items2,
    };
  }
  function serializeSelectionCode(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic => !input2.key.startsWith("@"),
      ),
      value2: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic => input2.key.startsWith("@"),
      ),
      items: Dynamic = [];
    for (let value3 of value as Dynamic)
      items.push(value3.key + ": " + value3.value + ";");
    for (let value3 of options.filter(
      (input2?: Dynamic): Dynamic => !input2.startsWith("@"),
    ) as Dynamic)
      items.push("// " + value3 + ": (mixed)");
    if (
      value2.length > 0 ||
      options.some((input2?: Dynamic): Dynamic => input2.startsWith("@"))
    ) {
      items.length > 0 && items.push("");
      for (let value3 of value2 as Dynamic)
        items.push(value3.key + ": " + value3.value);
      for (let value3 of options.filter(
        (input2?: Dynamic): Dynamic => input2.startsWith("@"),
      ) as Dynamic)
        items.push("// " + value3 + ": (mixed)");
    }
    return items.join(`
`);
  }
  function selectionCodeText(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = getSelectionCodeEntries(input, options);
    return serializeSelectionCode(value.entries, value.mixed);
  }
  function focusPropertyCodeLine(input?: Dynamic, items?: Dynamic): Dynamic {
    let value: Dynamic = input.value.split(`
`),
      value2: Dynamic = value.findIndex(
        (input2?: Dynamic): Dynamic =>
          input2.trimStart().startsWith(items + ":"),
      );
    if (value2 < 0) return;
    let value3: Dynamic = value[value2],
      value4: Dynamic = value
        .slice(0, value2)
        .reduce(
          (input2?: Dynamic, items2?: Dynamic): Dynamic =>
            input2 + items2.length + 1,
          0,
        ),
      value5: Dynamic = value3.slice(
        value3.indexOf(items + ":") + items.length + 1,
      );
    input.setSelectionRange(
      value4 + value3.length - value5.trimStart().length,
      value4 + value3.length,
    );
    let parentElement: Dynamic = input.parentElement;
    parentElement &&
      (parentElement.scrollTop = Math.max(
        0,
        input.offsetTop -
          parentElement.offsetTop +
          (value4 / Math.max(1, input.value.length)) * input.offsetHeight -
          parentElement.clientHeight / 2,
      ));
  }
  function parseInspectorCode(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      value: Dynamic = input.split(`
`);
    for (let index: Dynamic = 0; index < value.length; index++) {
      let value2: Dynamic = value[index].trim();
      if (value2 === "" || value2.startsWith("//")) continue;
      if (value2.startsWith("/*")) {
        if (value2.endsWith("*/")) continue;
        return {
          ok: false,
          line: index + 1,
          message: "unterminated comment",
        };
      }
      value2.endsWith(";") && (value2 = value2.slice(0, -1).trimEnd());
      let value3: Dynamic = value2.startsWith("@")
        ? (/^(@[A-Za-z_][\w-]*(?::[A-Za-z_][\w-]*)*?)\s*:(?=\s|$)\s*([\s\S]*)$/.exec(
            value2,
          ) ?? /^(@[A-Za-z_][\w-]*)\s*:\s*([\s\S]*)$/.exec(value2))
        : /^(-{0,2}[A-Za-z_][\w-]*)\s*:\s*([\s\S]*)$/.exec(value2);
      if (!value3)
        return {
          ok: false,
          line: index + 1,
          message: "expected  name: value",
        };
      let value4: Dynamic = value3[1].startsWith("@")
          ? value3[1]
          : (0, runtime.normalizeCssProperty)(value3[1]),
        value5: Dynamic = value3[2].trim();
      if (value5 === "" && !value4.startsWith("@"))
        return {
          ok: false,
          line: index + 1,
          message: "missing value",
        };
      if (!value4.startsWith("@")) {
        let index2: Dynamic = 0,
          value6: Dynamic = null,
          text: Dynamic = "",
          flag: Dynamic = true;
        for (let index3: Dynamic = 0; index3 < value5.length; index3++) {
          let value7: Dynamic = value5[index3];
          if (value6) {
            value7 === value6 && (value6 = null);
            continue;
          }
          if (flag && value7 === "{" && value5[index3 + 1] === "{") {
            let value8: Dynamic = value5.indexOf("}}", index3 + 3);
            flag = value8 >= 0;
            if (flag) {
              let value9: Dynamic = value5.slice(index3 + 2, value8);
              if (value9.replace(/"[^"]*"|'[^']*'/g, "").includes(";"))
                return {
                  ok: false,
                  line: index + 1,
                  message: "unexpected ;",
                };
              text += value9;
              index3 = value8 + 1;
              continue;
            }
          }
          if (value7 === '"' || value7 === "'") value6 = value7;
          else if (value7 === "(") index2++;
          else if (value7 === ")") index2--;
          else if (
            index2 === 0 &&
            (value7 === "{" || value7 === "}" || value7 === ";")
          )
            return {
              ok: false,
              line: index + 1,
              message: "unexpected " + value7,
            };
          if (index2 < 0)
            return {
              ok: false,
              line: index + 1,
              message: "unbalanced )",
            };
        }
        if (index2 !== 0 || value6)
          return {
            ok: false,
            line: index + 1,
            message: "unbalanced ( or quote",
          };
        if (/[{}]/.test(value5)) {
          let value7: Dynamic = (0, runtime.parseStyleDeclarations)(
            "--a: " + value5 + "; --b: 0",
          );
          if (value7.length !== 2 || value7[0].value !== value5) {
            let callback: Dynamic = (input2?: Dynamic): Dynamic =>
                text.split(input2).length % 2 === 0,
              value8: Dynamic =
                callback("'") ||
                callback('"') ||
                text.split("(").length !== text.split(")").length;
            return {
              ok: false,
              line: index + 1,
              message: value8 ? "unbalanced ( or quote" : "unexpected {",
            };
          }
        }
      }
      if (entries.has(value4))
        return {
          ok: false,
          line: index + 1,
          message: "duplicate " + value4,
        };
      entries.set(value4, value5);
    }
    return {
      ok: true,
      map: entries,
    };
  }
  function useCodeErrorAnnouncement(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(
      undefined,
    );
    (0, runtime.reactInspectorAnnotation.useEffect)((): Dynamic => {
      input === undefined && (value.current = undefined);
      if (input === undefined || input === value.current) return;
      let value2: Dynamic = (window as Dynamic).setTimeout((): Dynamic => {
        value.current = input;
        (0, runtime.announce)((0, runtime.pausedChangesAnnouncement)(input));
      }, CodePropertyCodeConstant);
      return (): Dynamic => (window as Dynamic).clearTimeout(value2);
    }, [input, options]);
  }
  bindRuntimeValue(
    runtime,
    "getSelectionCodeEntries",
    () => getSelectionCodeEntries,
  );
  bindRuntimeValue(
    runtime,
    "serializeSelectionCode",
    () => serializeSelectionCode,
  );
  bindRuntimeValue(runtime, "selectionCodeText", () => selectionCodeText);
  bindRuntimeValue(
    runtime,
    "focusPropertyCodeLine",
    () => focusPropertyCodeLine,
  );
  bindRuntimeValue(runtime, "parseInspectorCode", () => parseInspectorCode);
  bindRuntimeValue(
    runtime,
    "CodePropertyCodeConstant",
    () => CodePropertyCodeConstant,
    (value) => {
      CodePropertyCodeConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CodePropertyCodeConstant_2",
    () => CodePropertyCodeConstant_2,
    (value) => {
      CodePropertyCodeConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CodePropertyCodeResolvedValue",
    () => CodePropertyCodeResolvedValue,
    (value) => {
      CodePropertyCodeResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCodeErrorAnnouncement",
    () => useCodeErrorAnnouncement,
  );
  return () => {
    CodePropertyCodeConstant = 2e3;
    CodePropertyCodeConstant_2 = 1e3;
    CodePropertyCodeResolvedValue =
      runtime.AccessibilityAnnouncerConstant + 250;
  };
}
