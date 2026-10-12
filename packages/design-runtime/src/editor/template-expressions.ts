/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installEditorTemplateExpressions(
  runtime: RuntimeBindings,
): () => void {
  var EditorTemplateExpressionsAZaZAZaZPattern: Dynamic;
  var EditorTemplateExpressionsPattern: Dynamic;
  function evaluateTemplateExpression(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = String(options).trim();
    if (!value) return;
    if (
      value[0] === "(" &&
      value[value.length - 1] === ")" &&
      hasOuterExpressionParentheses(value)
    )
      return evaluateTemplateExpression(input, value.slice(1, -1));
    let value2: Dynamic = findExpressionComparison(value);
    if (value2) {
      let value3: Dynamic = evaluateTemplateExpression(
          input,
          value.slice(0, value2.index),
        ),
        value4: Dynamic = evaluateTemplateExpression(
          input,
          value.slice(value2.index + value2.op.length),
        );
      switch (value2.op) {
        case "===":
          return value3 === value4;
        case "!==":
          return value3 !== value4;
        case "==":
          return value3 == value4;
        default:
          return value3 != value4;
      }
    }
    if (value[0] === "!")
      return !evaluateTemplateExpression(input, value.slice(1));
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value !== "undefined")
      return EditorTemplateExpressionsPattern.test(value)
        ? Number(value)
        : value.length >= 2 &&
            (value[0] === '"' || value[0] === "'") &&
            value[value.length - 1] === value[0]
          ? value.slice(1, -1)
          : resolveExpressionPath(input, value);
  }
  function hasOuterExpressionParentheses(items?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < items.length - 1; index2++)
      if (items[index2] === "(") index++;
      else if (items[index2] === ")" && (index--, index === 0)) return false;
    return true;
  }
  function findExpressionComparison(items?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < items.length; index2++) {
      let value: Dynamic = items[index2];
      if (value === "[" || value === "(") index++;
      else if (value === "]" || value === ")") index--;
      else if (
        index === 0 &&
        (value === "=" || value === "!") &&
        items[index2 + 1] === "="
      ) {
        if (
          (index2 > 0 &&
            (items[index2 - 1] === "=" || items[index2 - 1] === "!")) ||
          !items.slice(0, index2).trim()
        )
          continue;
        let value2: Dynamic =
          items[index2 + 2] === "=" ? value + "==" : value + "=";
        return {
          index: index2,
          op: value2,
        };
      }
    }
    return null;
  }
  function resolveExpressionPath(input?: Dynamic, items?: Dynamic): Dynamic {
    let value: Dynamic = items.match(EditorTemplateExpressionsAZaZAZaZPattern);
    if (!value) return;
    let value2: Dynamic = input?.[value[0]],
      length: Dynamic = value[0].length;
    for (; length < items.length; )
      if (items[length] === ".") {
        let value3: Dynamic =
          items
            .slice(length + 1)
            .match(EditorTemplateExpressionsAZaZAZaZPattern) ||
          items.slice(length + 1).match(/^\d+/);
        if (!value3) return;
        value2 = value2?.[value3[0]];
        length += 1 + value3[0].length;
      } else if (items[length] === "[") {
        let count: Dynamic = 1,
          value3: Dynamic = length + 1;
        for (; value3 < items.length && count > 0; ) {
          if (items[value3] === "[") count++;
          else if (items[value3] === "]" && (count--, count === 0)) break;
          value3++;
        }
        if (count !== 0) return;
        let value4: Dynamic = evaluateTemplateExpression(
          input,
          items.slice(length + 1, value3),
        );
        value2 = value2?.[value4];
        length = value3 + 1;
      } else return;
    return value2;
  }
  bindRuntimeValue(
    runtime,
    "EditorTemplateExpressionsAZaZAZaZPattern",
    () => EditorTemplateExpressionsAZaZAZaZPattern,
    (value) => {
      EditorTemplateExpressionsAZaZAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EditorTemplateExpressionsPattern",
    () => EditorTemplateExpressionsPattern,
    (value) => {
      EditorTemplateExpressionsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "evaluateTemplateExpression",
    () => evaluateTemplateExpression,
  );
  bindRuntimeValue(
    runtime,
    "hasOuterExpressionParentheses",
    () => hasOuterExpressionParentheses,
  );
  bindRuntimeValue(
    runtime,
    "findExpressionComparison",
    () => findExpressionComparison,
  );
  bindRuntimeValue(
    runtime,
    "resolveExpressionPath",
    () => resolveExpressionPath,
  );
  return () => {
    EditorTemplateExpressionsAZaZAZaZPattern = /^[A-Za-z_$][A-Za-z0-9_$]*/;
    EditorTemplateExpressionsPattern = /^-?\d+(\.\d+)?$/;
  };
}
