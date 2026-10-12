/** Restored application module; prepare first, initialize in original order. */
import type * as Model from "../contracts";
import type * as Core from "../contracts/model-core";
import type { UploadFontInput } from "../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type { LastChange } from "../contracts";
export function installModelLastChange(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var MAX_CHANGE_AUTHOR_LENGTH: number;
  var MAX_CHANGE_VIA_LENGTH: number;
  var MAX_CHANGE_NOTE_LENGTH: number;
  var MAX_CHANGE_EXTRA_KEYS: number;
  var MAX_CHANGE_EXTRA_VALUE_LENGTH: number;
  var CHANGE_EXTRA_KEY_PATTERN: RegExp;
  var CHANGE_STANDARD_KEYS: Set<string>;
  var isChangeMetadataObject: (
    input: unknown,
  ) => input is Record<string, unknown>;
  var CHANGE_UNSAFE_CHARACTER_PATTERN: RegExp;
  function sanitizeChangeMetadataText(value: unknown): string {
    if (typeof value === "string") {
      return value
        .replace(CHANGE_UNSAFE_CHARACTER_PATTERN, " ")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      return "";
    }
  }
  function parseLastChange(input: unknown): {
    value: LastChange | null;
    warnings: string[];
  } {
    let warnings: string[] = [];
    if (input === undefined) {
      return {
        value: null,
        warnings: warnings,
      };
    }
    if (!isChangeMetadataObject(input)) {
      return {
        value: null,
        warnings: ["manifest.json lastChange: not an object — ignored"],
      };
    }
    let by2 = sanitizeChangeMetadataText(input.by);
    if (by2 === "") {
      return {
        value: null,
        warnings: [
          'manifest.json lastChange: needs "by" (who wrote it) — ignored',
        ],
      };
    }
    if (by2.length > MAX_CHANGE_AUTHOR_LENGTH) {
      by2 = by2.slice(0, MAX_CHANGE_AUTHOR_LENGTH);
      warnings.push(
        "manifest.json lastChange.by: over " +
          String(MAX_CHANGE_AUTHOR_LENGTH) +
          " characters — clamped",
      );
    }
    let at2 = sanitizeChangeMetadataText(input.at);
    if (at2 === "" || at2.length > 40 || !Number.isFinite(Date.parse(at2))) {
      return {
        value: null,
        warnings: [
          'manifest.json lastChange: "at" is not an ISO-8601 timestamp — ignored',
        ],
      };
    }
    let change: LastChange = {
      by: by2,
      at: at2,
      extra: {},
    };
    if (input.via !== undefined && input.via !== null) {
      let value = sanitizeChangeMetadataText(input.via);
      if (value.length > MAX_CHANGE_VIA_LENGTH) {
        value = value.slice(0, MAX_CHANGE_VIA_LENGTH);
        warnings.push(
          "manifest.json lastChange.via: over " +
            String(MAX_CHANGE_VIA_LENGTH) +
            " characters — clamped",
        );
      }
      if (value !== "") {
        change.via = value;
      }
    }
    if (input.note !== undefined && input.note !== null) {
      let value = sanitizeChangeMetadataText(input.note);
      if (value.length > MAX_CHANGE_NOTE_LENGTH) {
        value = value.slice(0, MAX_CHANGE_NOTE_LENGTH);
        warnings.push(
          "manifest.json lastChange.note: over " +
            String(MAX_CHANGE_NOTE_LENGTH) +
            " characters — clamped",
        );
      }
      if (value !== "") {
        change.note = value;
      }
    }
    let droppedExtras: number = 0;
    for (let value of Object.keys(input)) {
      if (CHANGE_STANDARD_KEYS.has(value)) {
        continue;
      }
      let value2 = input[value];
      if (
        !(
          typeof value2 === "string" ||
          typeof value2 === "number" ||
          typeof value2 === "boolean"
        ) ||
        !CHANGE_EXTRA_KEY_PATTERN.test(value) ||
        Object.keys(change.extra).length >= MAX_CHANGE_EXTRA_KEYS
      ) {
        droppedExtras++;
        continue;
      }
      let value3 = sanitizeChangeMetadataText(String(value2));
      if (value3.length > MAX_CHANGE_EXTRA_VALUE_LENGTH) {
        droppedExtras++;
        continue;
      }
      change.extra[value] = value3;
    }
    if (droppedExtras > 0) {
      warnings.push(
        "manifest.json lastChange: " +
          String(droppedExtras) +
          " extra key(s) dropped (keys [A-Za-z0-9_.-]≤40, string/number/boolean values ≤" +
          String(MAX_CHANGE_EXTRA_VALUE_LENGTH) +
          " chars, at most " +
          String(MAX_CHANGE_EXTRA_KEYS) +
          ")",
      );
    }
    return {
      value: change,
      warnings: warnings,
    };
  }
  function serializeLastChange(
    change: LastChange | null,
  ): Record<string, string> | undefined {
    if (change === null) {
      return;
    }
    return {
      by: change.by,
      ...(change.via !== undefined
        ? {
            via: change.via,
          }
        : {}),
      at: change.at,
      ...(change.note !== undefined
        ? {
            note: change.note,
          }
        : {}),
      ...change.extra,
    };
  }
  function isCiLastChange(change: LastChange | null): boolean {
    return change !== null && /^ci\b/i.test(change.via ?? "");
  }
  function lastChangeFromManifest(
    manifestInput: unknown,
    report: Model.ParseReport = {
      dropped: [],
      warnings: [],
    },
  ) {
    let manifest = (0, runtime.parseManifest)(manifestInput, report);
    if (!Object.hasOwn(manifest, "lastChange")) {
      return null;
    }
    let change = parseLastChange(manifest.lastChange);
    report.warnings.push(...change.warnings);
    return change.value;
  }
  bindRuntimeValue(
    runtime,
    "MAX_CHANGE_AUTHOR_LENGTH",
    () => MAX_CHANGE_AUTHOR_LENGTH,
    (value) => {
      MAX_CHANGE_AUTHOR_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CHANGE_VIA_LENGTH",
    () => MAX_CHANGE_VIA_LENGTH,
    (value) => {
      MAX_CHANGE_VIA_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CHANGE_NOTE_LENGTH",
    () => MAX_CHANGE_NOTE_LENGTH,
    (value) => {
      MAX_CHANGE_NOTE_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CHANGE_EXTRA_KEYS",
    () => MAX_CHANGE_EXTRA_KEYS,
    (value) => {
      MAX_CHANGE_EXTRA_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CHANGE_EXTRA_VALUE_LENGTH",
    () => MAX_CHANGE_EXTRA_VALUE_LENGTH,
    (value) => {
      MAX_CHANGE_EXTRA_VALUE_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHANGE_EXTRA_KEY_PATTERN",
    () => CHANGE_EXTRA_KEY_PATTERN,
    (value) => {
      CHANGE_EXTRA_KEY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHANGE_STANDARD_KEYS",
    () => CHANGE_STANDARD_KEYS,
    (value) => {
      CHANGE_STANDARD_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isChangeMetadataObject",
    () => isChangeMetadataObject,
    (value) => {
      isChangeMetadataObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHANGE_UNSAFE_CHARACTER_PATTERN",
    () => CHANGE_UNSAFE_CHARACTER_PATTERN,
    (value) => {
      CHANGE_UNSAFE_CHARACTER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeChangeMetadataText",
    () => sanitizeChangeMetadataText,
  );
  bindRuntimeValue(runtime, "parseLastChange", () => parseLastChange);
  bindRuntimeValue(runtime, "serializeLastChange", () => serializeLastChange);
  bindRuntimeValue(runtime, "isCiLastChange", () => isCiLastChange);
  bindRuntimeValue(
    runtime,
    "lastChangeFromManifest",
    () => lastChangeFromManifest,
  );
  return () => {
    MAX_CHANGE_AUTHOR_LENGTH = 200;
    MAX_CHANGE_VIA_LENGTH = 120;
    MAX_CHANGE_NOTE_LENGTH = 280;
    MAX_CHANGE_EXTRA_KEYS = 16;
    MAX_CHANGE_EXTRA_VALUE_LENGTH = 500;
    CHANGE_EXTRA_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;
    CHANGE_STANDARD_KEYS = new Set(["by", "via", "at", "note"]);
    isChangeMetadataObject = (
      input: unknown,
    ): input is Record<string, unknown> =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    CHANGE_UNSAFE_CHARACTER_PATTERN =
      /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]+/g;
  };
}
