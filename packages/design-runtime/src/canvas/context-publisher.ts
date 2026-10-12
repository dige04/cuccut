/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasContextPublisher(
  runtime: RuntimeBindings,
): () => void {
  var maxDesignContextBytes: Dynamic;
  var maxDesignContextFields: Dynamic;
  var maxDesignContextSelectionItems: Dynamic;
  var defaultDesignContextLabelLength: Dynamic;
  var maxDesignContextValueBytes: Dynamic;
  var maxDesignContextIdLength: Dynamic;
  var designContextFieldNamePattern: Dynamic;
  var reservedDesignContextFields: Dynamic;
  var designContextIdPattern: Dynamic;
  var forbiddenDesignContextIdCodepoints: Dynamic;
  var forbiddenDesignContextLabelCharacters: Dynamic;
  var blankDesignContextLabelPattern: Dynamic;
  var extendedPictographicPattern: Dynamic;
  function isValidDesignContextId(value?: Dynamic): Dynamic {
    if (
      typeof value != "string" ||
      value.length > maxDesignContextIdLength ||
      !designContextIdPattern.test(value)
    )
      return false;
    try {
      return !forbiddenDesignContextIdCodepoints.test(
        decodeURIComponent(value).normalize("NFKD"),
      );
    } catch {
      return false;
    }
  }
  function normalizedSingleContextCharacter(character?: Dynamic): Dynamic {
    let value: Dynamic = character.normalize("NFKD");
    return [...value].length === 1 ? value : character;
  }
  function isUnicodeTagCodepoint(codepoint?: Dynamic): Dynamic {
    return (
      codepoint !== undefined && codepoint >= 917536 && codepoint <= 917631
    );
  }
  function isForbiddenContextCodepoint(codepoint?: Dynamic): Dynamic {
    return (
      (codepoint >= 55296 && codepoint <= 57343) ||
      (codepoint & 65534) === 65534 ||
      (codepoint >= 64976 && codepoint <= 65007) ||
      (codepoint >= 65520 && codepoint <= 65528) ||
      (codepoint >= 917504 && codepoint <= 921599)
    );
  }
  function sanitizeDesignContextText(
    value?: Dynamic,
    limit: Dynamic = defaultDesignContextLabelLength,
  ): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0,
      flag: Dynamic = false,
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value2: Dynamic = input.codePointAt(0) ?? 0;
        return value2 <= 32 ||
          (value2 >= 127 && value2 <= 160) ||
          /\s/u.test(input)
          ? ((flag = text !== ""), false)
          : isForbiddenContextCodepoint(value2) ||
              forbiddenDesignContextLabelCharacters.test(input)
            ? false
            : forbiddenDesignContextLabelCharacters.test(
                  normalizedSingleContextCharacter(input),
                ) ||
                (isUnicodeTagCodepoint(options.codePointAt(0)) &&
                  extendedPictographicPattern.test(input))
              ? ((flag = text !== ""), false)
              : (flag && ((text += " "), (index += 1), (flag = false)),
                (text += input),
                (index += 1),
                index > limit);
      },
      text2: Dynamic = "";
    for (let value2 of value.normalize("NFC") as Dynamic) {
      if (text2 !== "" && callback(text2, value2)) {
        text2 = "";
        break;
      }
      text2 = value2;
    }
    text2 !== "" && callback(text2, "");
    return blankDesignContextLabelPattern.test(text)
      ? ""
      : index <= limit
        ? text
        : [...text]
            .slice(0, limit - 1)
            .join("")
            .trimEnd() + "\u2026";
  }
  function sanitizeDesignContextSelection(selection?: Dynamic): Dynamic {
    return selection
      .filter(
        (input?: Dynamic): Dynamic =>
          typeof input == "object" &&
          input !== null &&
          isValidDesignContextId(input.id),
      )
      .slice(-maxDesignContextSelectionItems)
      .map(({ id: id, kind: kind, label: label }: Dynamic): Dynamic => {
        let state: Dynamic = {
          id: id,
        };
        isValidDesignContextId(kind) && (state.kind = kind);
        let value: Dynamic =
          typeof label == "string" ? sanitizeDesignContextText(label) : "";
        value !== "" && (state.label = value);
        return state;
      });
  }
  function sanitizeDesignContextFields(fields?: Dynamic): Dynamic {
    let state: Dynamic = {},
      state2: Dynamic = {};
    for (let value of Object.keys(fields) as Dynamic) {
      if (
        !designContextFieldNamePattern.test(value) ||
        value === "prototype" ||
        value in Object.prototype ||
        reservedDesignContextFields.includes(value)
      )
        continue;
      let value2: Dynamic = fields[value];
      if (typeof value2 == "boolean" || value2 === null)
        state[value] = state2[value] = value2;
      else if (typeof value2 == "number")
        state[value] = state2[value] = Number.isSafeInteger(value2)
          ? value2
          : null;
      else if (Array.isArray(value2)) {
        let value3: Dynamic = value2;
        value3.some(
          (input?: Dynamic): Dynamic =>
            typeof input == "object" && input !== null,
        )
          ? (state[value] = sanitizeDesignContextSelection(value3))
          : (state[value] = state2[value] =
              value3
                .filter(isValidDesignContextId)
                .slice(-maxDesignContextFields));
      } else if (typeof value2 == "object") {
        let value3: Dynamic =
          typeof value2.text == "string"
            ? sanitizeDesignContextText(value2.text)
            : "";
        value3 !== "" && (state[value] = value3);
      } else
        state[value] = state2[value] = isValidDesignContextId(value2)
          ? value2
          : null;
    }
    return {
      full: state,
      lean: state2,
    };
  }
  function createDesignContextPublisher(): Dynamic {
    let value: Dynamic = !(0, runtime.hasRoomCapability)(),
      value2: Dynamic = null,
      text: Dynamic = "",
      text2: Dynamic = "",
      text3: Dynamic = "",
      flag: Dynamic = false,
      flag2: Dynamic = false,
      flag3: Dynamic = false,
      value3: Dynamic,
      flag4: Dynamic = false,
      callback: Dynamic = (): Dynamic => {};
    value ||
      (callback = (0, runtime.subscribeEditCount)((): Dynamic => {
        value7();
      }));
    function value4(input?: Dynamic): Dynamic {
      let value8: Dynamic = (0, runtime.getEditCount)();
      return value8 > 0
        ? {
            ...input,
            edits: value8,
          }
        : input;
    }
    let callback2: Dynamic = (input?: Dynamic): Dynamic =>
      new TextEncoder().encode(input).length <= maxDesignContextBytes;
    function value5(input?: Dynamic): Dynamic {
      for (let value8 of [
        value4(input.full),
        value4(input.lean),
        input.lean,
      ] as Dynamic) {
        let value9: Dynamic = JSON.stringify(value8);
        if (callback2(value9))
          return {
            view: value8,
            json: value9,
          };
      }
      return {
        view: null,
        json: "",
      };
    }
    function value6(): Dynamic {
      clearTimeout(value3);
      value3 = setTimeout((): Dynamic => {
        value7();
      }, maxDesignContextValueBytes);
    }
    async function value7(): Promise<Dynamic> {
      clearTimeout(value3);
      value3 = undefined;
      if (value || flag || value2 === null) return;
      flag = true;
      let { view: value8, json: value9 }: Dynamic = value5(value2);
      value8 === null &&
        !flag2 &&
        ((flag2 = true),
        console.warn(
          "appifact presence: context over 3 KiB \u2014 cleared, not published",
        ));
      let value10: Dynamic = JSON.stringify(value4(value2.full)),
        value11: Dynamic = text2,
        value12: Dynamic = (0, runtime.getEditCount)();
      try {
        if (value9 === text3) return;
        let value13: Dynamic = await (0, runtime.publishRoomPresence)({
          context: value8,
        });
        value13 === "off" &&
          ((value = true),
          callback(),
          !flag3 &&
            text3 !== "" &&
            (0, runtime.publishRoomPresence)({
              context: null,
            }));
        value13 === "ok" && (text3 = value9);
        flag4 = value13 === "retry";
      } finally {
        flag = false;
        value2 !== null &&
          JSON.stringify(value4(value2.full)) !== value10 &&
          (text2 === value11 && (0, runtime.getEditCount)() === value12
            ? value3 === undefined && value6()
            : value7());
      }
    }
    return {
      report(input: Dynamic): Dynamic {
        if (value) return;
        let value8: Dynamic = sanitizeDesignContextFields(input),
          value9: Dynamic = JSON.stringify(value8.full);
        if (value9 === text) {
          flag4 && value3 === undefined && value7();
          return;
        }
        let value10: Dynamic = JSON.stringify(value8.lean),
          value11: Dynamic = !flag4 && value2 !== null && value10 === text2;
        value2 = value8;
        text = value9;
        text2 = value10;
        value11 ? value6() : value7();
      },
      dispose(): Dynamic {
        clearTimeout(value3);
        callback();
        !value &&
          (text3 !== "" || flag) &&
          (0, runtime.publishRoomPresence)({
            context: null,
          });
        value2 = null;
        value = flag3 = true;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "maxDesignContextBytes",
    () => maxDesignContextBytes,
    (value) => {
      maxDesignContextBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDesignContextFields",
    () => maxDesignContextFields,
    (value) => {
      maxDesignContextFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDesignContextSelectionItems",
    () => maxDesignContextSelectionItems,
    (value) => {
      maxDesignContextSelectionItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultDesignContextLabelLength",
    () => defaultDesignContextLabelLength,
    (value) => {
      defaultDesignContextLabelLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDesignContextValueBytes",
    () => maxDesignContextValueBytes,
    (value) => {
      maxDesignContextValueBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxDesignContextIdLength",
    () => maxDesignContextIdLength,
    (value) => {
      maxDesignContextIdLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designContextFieldNamePattern",
    () => designContextFieldNamePattern,
    (value) => {
      designContextFieldNamePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reservedDesignContextFields",
    () => reservedDesignContextFields,
    (value) => {
      reservedDesignContextFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designContextIdPattern",
    () => designContextIdPattern,
    (value) => {
      designContextIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "forbiddenDesignContextIdCodepoints",
    () => forbiddenDesignContextIdCodepoints,
    (value) => {
      forbiddenDesignContextIdCodepoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidDesignContextId",
    () => isValidDesignContextId,
  );
  bindRuntimeValue(
    runtime,
    "forbiddenDesignContextLabelCharacters",
    () => forbiddenDesignContextLabelCharacters,
    (value) => {
      forbiddenDesignContextLabelCharacters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blankDesignContextLabelPattern",
    () => blankDesignContextLabelPattern,
    (value) => {
      blankDesignContextLabelPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "extendedPictographicPattern",
    () => extendedPictographicPattern,
    (value) => {
      extendedPictographicPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizedSingleContextCharacter",
    () => normalizedSingleContextCharacter,
  );
  bindRuntimeValue(
    runtime,
    "isUnicodeTagCodepoint",
    () => isUnicodeTagCodepoint,
  );
  bindRuntimeValue(
    runtime,
    "isForbiddenContextCodepoint",
    () => isForbiddenContextCodepoint,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeDesignContextText",
    () => sanitizeDesignContextText,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeDesignContextSelection",
    () => sanitizeDesignContextSelection,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeDesignContextFields",
    () => sanitizeDesignContextFields,
  );
  bindRuntimeValue(
    runtime,
    "createDesignContextPublisher",
    () => createDesignContextPublisher,
  );
  return () => {
    maxDesignContextBytes = 3072;
    maxDesignContextFields = 20;
    maxDesignContextSelectionItems = 5;
    defaultDesignContextLabelLength = 60;
    maxDesignContextValueBytes = 400;
    maxDesignContextIdLength = 256;
    designContextFieldNamePattern = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
    reservedDesignContextFields = ["edits"];
    designContextIdPattern = /^(?:[A-Za-z0-9_./#:@+!~*'()-]|%[0-9A-Fa-f]{2})*$/;
    forbiddenDesignContextIdCodepoints =
      /[\p{Cc}\p{Co}\p{Cs}]|[^\P{Cf}\u200C\u200D]|["`<>\\\p{Zl}\p{Zp}]/u;
    forbiddenDesignContextLabelCharacters =
      /[<>"`\\]|[^\P{Cf}\u200C\u200D]|[\p{Co}\u034F\u115F\u1160\u17B4\u17B5\u2065\u2800\u3164\uFFA0\uFFFC\uFFFD\u{16FE4}\u{1D159}]/u;
    blankDesignContextLabelPattern =
      /^[ \u200C\u200D\p{Variation_Selector}]*$/u;
    extendedPictographicPattern = /\p{Extended_Pictographic}/u;
  };
}
