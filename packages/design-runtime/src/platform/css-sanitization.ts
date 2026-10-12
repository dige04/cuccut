/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformCssSanitization(
  runtime: RuntimeBindings,
): () => void {
  var PlatformCssSanitizationExpressionImagePattern: Dynamic;
  function sanitizeCssDisplayValue(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (typeof input != "string") return "transparent";
    let value: Dynamic = input.trim();
    return value.length === 0 ||
      value.length > 512 ||
      PlatformCssSanitizationExpressionImagePattern.test(value) ||
      (typeof CSS !== "undefined" &&
        typeof CSS.supports == "function" &&
        !CSS.supports(options, value))
      ? "transparent"
      : value;
  }
  function sanitizeCssColor(input?: Dynamic): Dynamic {
    return sanitizeCssDisplayValue(input, "color");
  }
  function sanitizeCssBackground(input?: Dynamic): Dynamic {
    return sanitizeCssDisplayValue(input, "background");
  }
  bindRuntimeValue(
    runtime,
    "PlatformCssSanitizationExpressionImagePattern",
    () => PlatformCssSanitizationExpressionImagePattern,
    (value) => {
      PlatformCssSanitizationExpressionImagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeCssDisplayValue",
    () => sanitizeCssDisplayValue,
  );
  bindRuntimeValue(runtime, "sanitizeCssColor", () => sanitizeCssColor);
  bindRuntimeValue(
    runtime,
    "sanitizeCssBackground",
    () => sanitizeCssBackground,
  );
  return () => {
    PlatformCssSanitizationExpressionImagePattern =
      /[;{}\\@<>]|\/\*|url\s*\(|expression\s*\(|image(-set)?\s*\(|element\s*\(|cross-fade\s*\(|paint\s*\(|[\r\n]/i;
  };
}
