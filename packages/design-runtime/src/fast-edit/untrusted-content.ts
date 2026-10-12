/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditUntrustedContent(
  runtime: RuntimeBindings,
): () => void {
  var issuedUntrustedMarkers: Dynamic;
  var MAX_UNTRUSTED_MARKER_HISTORY: Dynamic;
  var UNTRUSTED_FENCE_SEPARATOR: Dynamic;
  var UNTRUSTED_MARKER_WORD_PATTERN: Dynamic;
  var MAX_UNTRUSTED_SANITIZE_PASSES: Dynamic;
  var UNTRUSTED_REMOVED_PLACEHOLDER: Dynamic;
  function createUntrustedMarker(): Dynamic {
    let value: Dynamic = new Uint8Array(16);
    crypto.getRandomValues(value);
    let value2: Dynamic = Array.from(
      value,
      (input?: Dynamic): Dynamic => input.toString(16).padStart(2, "0"),
    ).join("");
    issuedUntrustedMarkers.push(value2);
    issuedUntrustedMarkers.length > MAX_UNTRUSTED_MARKER_HISTORY &&
      issuedUntrustedMarkers.shift();
    return value2;
  }
  function sanitizeUntrustedText(value?: Dynamic): Dynamic {
    let sanitized: Dynamic = String(value).replace(/\p{Cf}/gu, "");
    for (let index: Dynamic = 0; ; index++) {
      if (index >= MAX_UNTRUSTED_SANITIZE_PASSES)
        return UNTRUSTED_REMOVED_PLACEHOLDER;
      let value2: Dynamic = sanitized;
      for (let value3 of issuedUntrustedMarkers as Dynamic)
        sanitized.includes(value3) &&
          (sanitized = sanitized.split(value3).join(""));
      sanitized = sanitized.replace(UNTRUSTED_MARKER_WORD_PATTERN, "");
      if (sanitized === value2) return sanitized;
    }
  }
  function fenceUntrustedContent(
    label?: Dynamic,
    content?: Dynamic,
    marker?: Dynamic,
  ): Dynamic {
    let sanitized: Dynamic = sanitizeUntrustedText(content)
      .replace(
        /\p{Cc}/gu,
        (input?: Dynamic): Dynamic =>
          input ===
            `
` || input === "	"
            ? input
            : " ",
      )
      .replace(
        /<{2,}|>{2,}/g,
        (input?: Dynamic): Dynamic =>
          input.split("").join(UNTRUSTED_FENCE_SEPARATOR),
      );
    return (
      "<<<" +
      marker +
      " " +
      label.replace(/[^A-Za-z0-9 ]/g, "") +
      `
` +
      sanitized +
      `
` +
      marker +
      ">>>"
    );
  }
  bindRuntimeValue(
    runtime,
    "issuedUntrustedMarkers",
    () => issuedUntrustedMarkers,
    (value) => {
      issuedUntrustedMarkers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_UNTRUSTED_MARKER_HISTORY",
    () => MAX_UNTRUSTED_MARKER_HISTORY,
    (value) => {
      MAX_UNTRUSTED_MARKER_HISTORY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNTRUSTED_FENCE_SEPARATOR",
    () => UNTRUSTED_FENCE_SEPARATOR,
    (value) => {
      UNTRUSTED_FENCE_SEPARATOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createUntrustedMarker",
    () => createUntrustedMarker,
  );
  bindRuntimeValue(
    runtime,
    "UNTRUSTED_MARKER_WORD_PATTERN",
    () => UNTRUSTED_MARKER_WORD_PATTERN,
    (value) => {
      UNTRUSTED_MARKER_WORD_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_UNTRUSTED_SANITIZE_PASSES",
    () => MAX_UNTRUSTED_SANITIZE_PASSES,
    (value) => {
      MAX_UNTRUSTED_SANITIZE_PASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNTRUSTED_REMOVED_PLACEHOLDER",
    () => UNTRUSTED_REMOVED_PLACEHOLDER,
    (value) => {
      UNTRUSTED_REMOVED_PLACEHOLDER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeUntrustedText",
    () => sanitizeUntrustedText,
  );
  bindRuntimeValue(
    runtime,
    "fenceUntrustedContent",
    () => fenceUntrustedContent,
  );
  return () => {
    issuedUntrustedMarkers = [];
    MAX_UNTRUSTED_MARKER_HISTORY = 2e3;
    UNTRUSTED_FENCE_SEPARATOR = "\u200B";
    UNTRUSTED_MARKER_WORD_PATTERN =
      /end[\s\-_]*untrusted(?:[\s\-_]*data)?|untrusted[\s\-_]*data/gi;
    MAX_UNTRUSTED_SANITIZE_PASSES = 64;
    UNTRUSTED_REMOVED_PLACEHOLDER = "[removed]";
  };
}
