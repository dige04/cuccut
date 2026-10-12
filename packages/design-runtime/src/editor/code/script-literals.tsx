/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCodeScriptLiterals(
  runtime: RuntimeBindings,
): () => void {
  var CodeScriptLiteralsAFAFPattern: Dynamic;
  var reactCodeScriptLiterals: Dynamic;
  function decodeScriptStringEscape(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input[options];
    switch (value) {
      case "n":
        return {
          ch: `
`,
          next: options + 1,
        };
      case "t":
        return {
          ch: "	",
          next: options + 1,
        };
      case "r":
        return {
          ch: "\r",
          next: options + 1,
        };
      case "b":
        return {
          ch: "\b",
          next: options + 1,
        };
      case "f":
        return {
          ch: "\f",
          next: options + 1,
        };
      case "v":
        return {
          ch: "\v",
          next: options + 1,
        };
      case "0":
        return {
          ch: "\0",
          next: options + 1,
        };
      case "x": {
        let value2: Dynamic = input.slice(options + 1, options + 3);
        return value2.length === 2 &&
          CodeScriptLiteralsAFAFPattern.test(value2[0]) &&
          CodeScriptLiteralsAFAFPattern.test(value2[1])
          ? {
              ch: String.fromCharCode(parseInt(value2, 16)),
              next: options + 3,
            }
          : {
              ch: value,
              next: options + 1,
            };
      }
      case "u": {
        if (input[options + 1] === "{") {
          let value3: Dynamic = input.indexOf("}", options + 2);
          if (value3 !== -1) {
            let value4: Dynamic = input.slice(options + 2, value3);
            if (
              value4.length > 0 &&
              value4.length <= 6 &&
              /^[0-9a-fA-F]+$/.test(value4)
            ) {
              let value5: Dynamic = parseInt(value4, 16);
              if (value5 <= 1114111)
                return {
                  ch: String.fromCodePoint(value5),
                  next: value3 + 1,
                };
            }
          }
          return {
            ch: value,
            next: options + 1,
          };
        }
        let value2: Dynamic = input.slice(options + 1, options + 5);
        return value2.length === 4 && /^[0-9a-fA-F]+$/.test(value2)
          ? {
              ch: String.fromCharCode(parseInt(value2, 16)),
              next: options + 5,
            }
          : {
              ch: value,
              next: options + 1,
            };
      }
      case `
`:
        return {
          ch: "",
          next: options + 1,
        };
      case "\r":
        return {
          ch: "",
          next:
            input[options + 1] ===
            `
`
              ? options + 2
              : options + 1,
        };
      default:
        return {
          ch: value,
          next: options + 1,
        };
    }
  }
  function isScriptRegexPosition(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options - 1;
    for (; value >= 0 && (input[value] === " " || input[value] === "	"); )
      value--;
    if (value < 0) return true;
    let value2: Dynamic = input[value];
    if (/[\w$\])]/.test(value2)) {
      let value3: Dynamic = value;
      for (; value3 >= 0 && /[\w$]/.test(input[value3]); ) value3--;
      let value4: Dynamic = input.slice(value3 + 1, value + 1);
      return (
        value4 === "return" ||
        value4 === "typeof" ||
        value4 === "delete" ||
        value4 === "void" ||
        value4 === "throw" ||
        value4 === "in" ||
        value4 === "of" ||
        value4 === "instanceof" ||
        value4 === "new" ||
        value4 === "yield" ||
        value4 === "await" ||
        value4 === "case" ||
        value4 === "do" ||
        value4 === "else"
      );
    }
    return true;
  }
  function tokenizeScriptLiterals(items?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      index: Dynamic = 0,
      length: Dynamic = items.length;
    for (; index < length; ) {
      let value: Dynamic = items[index];
      if (value === "/" && items[index + 1] === "/") {
        for (
          index += 2;
          index < length &&
          items[index] !==
            `
`;

        )
          index++;
        continue;
      }
      if (value === "/" && items[index + 1] === "*") {
        for (
          index += 2;
          index < length && !(items[index] === "*" && items[index + 1] === "/");

        )
          index++;
        index += 2;
        continue;
      }
      if (value === "/" && isScriptRegexPosition(items, index)) {
        index++;
        let flag: Dynamic = false;
        for (; index < length; ) {
          let value2: Dynamic = items[index];
          if (value2 === "\\") {
            index += 2;
            continue;
          }
          if (value2 === "[") flag = true;
          else if (value2 === "]") flag = false;
          else if (value2 === "/" && !flag) {
            index++;
            break;
          } else if (
            value2 ===
            `
`
          )
            break;
          index++;
        }
        for (; index < length && /[a-z]/.test(items[index]); ) index++;
        continue;
      }
      if (value === "'" || value === '"' || value === "`") {
        let value2: Dynamic = value,
          value3: Dynamic = index;
        index++;
        let text: Dynamic = "",
          flag: Dynamic = false,
          flag2: Dynamic = false;
        for (; index < length; ) {
          let value4: Dynamic = items[index];
          if (value4 === "\\") {
            let { ch: value5, next: value6 }: Dynamic =
              decodeScriptStringEscape(items, index + 1);
            text += value5;
            index = value6;
            continue;
          }
          if (value4 === value2) {
            index++;
            flag2 = true;
            break;
          }
          if (value2 === "`" && value4 === "$" && items[index + 1] === "{") {
            flag = true;
            index += 2;
            let count: Dynamic = 1;
            for (; index < length && count > 0; ) {
              items[index] === "{" ? count++ : items[index] === "}" && count--;
              index++;
            }
            continue;
          }
          if (
            value2 !== "`" &&
            (value4 ===
              `
` ||
              value4 === "\r")
          )
            break;
          text += value4;
          index++;
        }
        flag2 &&
          !flag &&
          text.length >= 2 &&
          items2.push({
            value: text,
            start: value3,
            end: index,
            quote: value2,
          });
        continue;
      }
      index++;
    }
    return items2;
  }
  function quoteScriptString(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
        options === "`" || options === "'" || options === '"' ? options : "'",
      text: Dynamic = "";
    for (let value2 of input as Dynamic)
      value2 === "\\"
        ? (text += "\\\\")
        : value2 === value
          ? (text += "\\" + value)
          : value2 ===
              `
`
            ? (text +=
                value === "`"
                  ? `
`
                  : "\\n")
            : value2 === "\r"
              ? (text += "\\r")
              : value === "`" && value2 === "$"
                ? (text += "\\$")
                : (text += value2);
    text = text.replace(/<(\/?(?:script|x-dc)|!--)/gi, "\\x3C$1");
    return value + text + value;
  }
  bindRuntimeValue(
    runtime,
    "CodeScriptLiteralsAFAFPattern",
    () => CodeScriptLiteralsAFAFPattern,
    (value) => {
      CodeScriptLiteralsAFAFPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeScriptStringEscape",
    () => decodeScriptStringEscape,
  );
  bindRuntimeValue(
    runtime,
    "isScriptRegexPosition",
    () => isScriptRegexPosition,
  );
  bindRuntimeValue(
    runtime,
    "tokenizeScriptLiterals",
    () => tokenizeScriptLiterals,
  );
  bindRuntimeValue(runtime, "quoteScriptString", () => quoteScriptString);
  bindRuntimeValue(
    runtime,
    "reactCodeScriptLiterals",
    () => reactCodeScriptLiterals,
    (value) => {
      reactCodeScriptLiterals = value;
    },
  );
  return () => {
    CodeScriptLiteralsAFAFPattern = /[0-9a-fA-F]/;
    reactCodeScriptLiterals = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}
