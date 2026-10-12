/**
 * Reconstructed expressions subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 148344..149782.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */

import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export var IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*/,
  NUMBER_LITERAL_PATTERN = /^-?\d+(\.\d+)?$/;
export function evaluateExpression(
  scope: RenderValues | null | undefined,
  expression: unknown,
): RuntimeValue {
  const trimmed: RuntimeValue = String(expression).trim();
  if (!trimmed) return;
  if (trimmed[0] === "(" && trimmed[trimmed.length - 1] === ")" && hasOuterParentheses(trimmed))
    return evaluateExpression(scope, trimmed.slice(1, -1));
  const equality: RuntimeValue = findEqualityOperator(trimmed);
  if (equality) {
    const left: RuntimeValue = evaluateExpression(scope, trimmed.slice(0, equality.index)),
      right: RuntimeValue = evaluateExpression(
        scope,
        trimmed.slice(equality.index + equality.op.length),
      );
    switch (equality.op) {
      case "===":
        return left === right;
      case "!==":
        return left !== right;
      case "==":
        return left == right;
      default:
        return left != right;
    }
  }
  if (trimmed[0] === "!") return !evaluateExpression(scope, trimmed.slice(1));
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed !== "undefined")
    return NUMBER_LITERAL_PATTERN.test(trimmed)
      ? Number(trimmed)
      : trimmed.length >= 2 &&
          (trimmed[0] === '"' || trimmed[0] === "'") &&
          trimmed[trimmed.length - 1] === trimmed[0]
        ? trimmed.slice(1, -1)
        : resolvePropertyPath(scope, trimmed);
}
export function hasOuterParentheses(expression: string): boolean {
  let depth = 0;
  for (let index = 0; index < expression.length - 1; index++)
    if (expression[index] === "(") depth++;
    else if (expression[index] === ")" && (depth--, depth === 0)) return false;
  return true;
}
export function findEqualityOperator(expression: string): {
  index: number;
  op: string;
} | null {
  let depth = 0;
  for (let index = 0; index < expression.length; index++) {
    const character: RuntimeValue = expression[index];
    if (character === "[" || character === "(") depth++;
    else if (character === "]" || character === ")") depth--;
    else if (
      depth === 0 &&
      (character === "=" || character === "!") &&
      expression[index + 1] === "="
    ) {
      if (
        (index > 0 && (expression[index - 1] === "=" || expression[index - 1] === "!")) ||
        !expression.slice(0, index).trim()
      )
        continue;
      const operator: RuntimeValue =
        expression[index + 2] === "=" ? character + "==" : character + "=";
      return {
        index: index,
        op: operator,
      };
    }
  }
  return null;
}
export function resolvePropertyPath(
  scope: RenderValues | null | undefined,
  propertyPath: string,
): RuntimeValue {
  const firstIdentifier: RuntimeValue = propertyPath.match(IDENTIFIER_PATTERN);
  if (!firstIdentifier) return;
  let value: RuntimeValue = scope?.[firstIdentifier[0]],
    offset: RuntimeValue = firstIdentifier[0].length;
  for (; offset < propertyPath.length; )
    if (propertyPath[offset] === ".") {
      const identifier: RuntimeValue =
        propertyPath.slice(offset + 1).match(IDENTIFIER_PATTERN) ||
        propertyPath.slice(offset + 1).match(/^\d+/);
      if (!identifier) return;
      value = value?.[identifier[0]];
      offset += 1 + identifier[0].length;
    } else if (propertyPath[offset] === "[") {
      let bracketDepth = 1,
        closingOffset: RuntimeValue = offset + 1;
      for (; closingOffset < propertyPath.length && bracketDepth > 0; ) {
        if (propertyPath[closingOffset] === "[") bracketDepth++;
        else if (propertyPath[closingOffset] === "]" && (bracketDepth--, bracketDepth === 0)) break;
        closingOffset++;
      }
      if (bracketDepth !== 0) return;
      const propertyKey: RuntimeValue = evaluateExpression(
        scope,
        propertyPath.slice(offset + 1, closingOffset),
      );
      value = value?.[propertyKey];
      offset = closingOffset + 1;
    } else return;
  return value;
}
