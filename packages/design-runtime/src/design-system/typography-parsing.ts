/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemTypographyParsing(
  runtime: RuntimeBindings,
): () => void {
  var DesignSystemTypographyParsingLimit: Dynamic;
  var DesignSystemTypographyParsingLimit_2: Dynamic;
  var DesignSystemTypographyParsingLimit_3: Dynamic;
  var DesignSystemTypographyParsingConstant: Dynamic;
  var DesignSystemTypographyParsingPattern: Dynamic;
  var DesignSystemTypographyParsingPattern_2: Dynamic;
  var DesignSystemTypographyParsingHandler: Dynamic;
  var typographyLengthToPixels: Dynamic;
  var DesignSystemTypographyParsing300330400Config: Dynamic;
  function isSafeFontFamily(input?: Dynamic): Dynamic {
    if (
      !DesignSystemTypographyParsingPattern_2.test(input) ||
      input.includes("/*") ||
      input.includes("*/")
    )
      return false;
    let value: Dynamic = null;
    for (let value2 of input as Dynamic)
      value === null
        ? (value = value2 === '"' || value2 === "'" ? value2 : null)
        : value2 === value && (value = null);
    return value === null;
  }
  function parseTypographyLength(input?: Dynamic): Dynamic {
    if (typeof input == "number")
      return Number.isFinite(input) && Math.abs(input) < 1e4
        ? {
            n: DesignSystemTypographyParsingHandler(input),
            unit: "px",
          }
        : undefined;
    if (typeof input != "string") return;
    let value: Dynamic = input.trim().toLowerCase();
    if (value === "0")
      return {
        n: 0,
        unit: "px",
      };
    let value2: Dynamic = DesignSystemTypographyParsingPattern.exec(value);
    return value2 === null
      ? undefined
      : {
          n: Number(value2[1]),
          unit: value2[2],
        };
  }
  function parseTypographyFamily(input?: Dynamic): Dynamic {
    let value: Dynamic =
        /^\s*(?:"([^"]{1,80})"|'([^']{1,80})'|([A-Za-z0-9 _-]{1,80}))/.exec(
          input,
        ),
      value2: Dynamic = (input.split(",").pop() ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
      value3: Dynamic = /mono/.test(value2)
        ? "mono"
        : /(^|ui-)serif$/.test(value2)
          ? "serif"
          : "sans";
    return {
      name: (value?.[1] ?? value?.[2] ?? value?.[3] ?? "").trim(),
      stack: input,
      generic: value3,
    };
  }
  function parseTypographyStyles(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.type;
    if (typeof value != "object" || value === null) return [];
    let entries: Dynamic = new Map();
    if (
      typeof value.families == "object" &&
      value.families !== null &&
      !Array.isArray(value.families)
    )
      for (let [value2, value3] of Object.entries(value.families) as Dynamic) {
        if (entries.size >= DesignSystemTypographyParsingLimit_3) break;
        let value4: Dynamic = value2.trim().toLowerCase();
        runtime.DesignSystemTypeDeclarationsAZaZAZaZPattern.test(value4) &&
          typeof value3 == "string" &&
          isSafeFontFamily(value3.trim()) &&
          entries.set(value4, value3.trim());
      }
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "string" && entries.has(input2.trim().toLowerCase())
          ? input2.trim().toLowerCase()
          : "",
      items: Dynamic = [],
      values: Dynamic = new Set(),
      index: Dynamic = 0;
    for (let value2 of (Array.isArray(value.groups)
      ? value.groups
      : []) as Dynamic) {
      if (index >= DesignSystemTypographyParsingLimit_2) break;
      if (typeof value2 != "object" || value2 === null || Array.isArray(value2))
        continue;
      let value3: Dynamic = value2;
      index++;
      let value4: Dynamic =
          (typeof value3.name == "string"
            ? [...value3.name]
                .slice(0, DesignSystemTypographyParsingConstant)
                .join("")
            : "") || "Type",
        value5: Dynamic = callback(value3.family);
      for (let value6 of (Array.isArray(value3.styles)
        ? value3.styles
        : []) as Dynamic) {
        if (values.size >= DesignSystemTypographyParsingLimit) break;
        if (
          typeof value6 != "object" ||
          value6 === null ||
          Array.isArray(value6)
        )
          continue;
        let value7: Dynamic = value6,
          value8: Dynamic =
            typeof value7.name == "string"
              ? value7.name.trim().replace(/^\./, "")
              : "",
          value9: Dynamic = parseTypographyLength(value7.fontSize);
        if (
          !runtime.DesignSystemTypeDeclarationsAZaZAZaZPattern.test(value8) ||
          values.has(value8) ||
          value9 === undefined
        )
          continue;
        values.add(value8);
        let value10: Dynamic = DesignSystemTypographyParsingHandler(
          typographyLengthToPixels(value9),
        );
        if (value10 <= 0) continue;
        let value11: Dynamic =
            typeof value7.lineHeight == "string"
              ? value7.lineHeight.trim()
              : value7.lineHeight,
          value12: Dynamic =
            typeof value11 == "number"
              ? value11
              : typeof value11 == "string" && /^\d(?:\.\d{1,6})?$/.test(value11)
                ? Number(value11)
                : undefined,
          count: Dynamic = 1.4;
        if (value12 !== undefined && value12 > 0 && value12 < 10)
          count = DesignSystemTypographyParsingHandler(value12);
        else if (typeof value11 != "string" || value12 === undefined) {
          let value17: Dynamic = parseTypographyLength(value11);
          value17 !== undefined &&
            (count =
              value17.n >= 0
                ? DesignSystemTypographyParsingHandler(
                    typographyLengthToPixels(value17) / value10,
                  )
                : 1.3);
        }
        let fontWeight: Dynamic = value7.fontWeight,
          value13: Dynamic =
            typeof fontWeight == "number" &&
            Number.isInteger(fontWeight) &&
            fontWeight >= 1 &&
            fontWeight <= 1e3
              ? fontWeight
              : typeof fontWeight == "string"
                ? fontWeight.trim() === "bold"
                  ? 700
                  : /^(?:[1-9]\d{0,2}|1000)(?:\s+(?:[1-9]\d{0,2}|1000))?$/.test(
                        fontWeight.trim(),
                      )
                    ? Number(fontWeight.trim().split(/\s+/)[0])
                    : 400
                : 400,
          value14: Dynamic = parseTypographyLength(value7.letterSpacing),
          value15: Dynamic =
            value14 === undefined
              ? 0
              : DesignSystemTypographyParsingHandler(
                  value14.unit === "em"
                    ? value14.n * value10
                    : value14.unit === "%"
                      ? (value14.n / 100) * value10
                      : value14.unit === "rem"
                        ? value14.n * 16
                        : value14.n,
                ),
          value16: Dynamic = callback(value7.family) || value5;
        items.push({
          name: value8,
          group: value4,
          fontSize: value10,
          lineHeight: count,
          fontWeight: value13,
          letterSpacing: value15,
          italic: value7.fontStyle === "italic",
          ...(value16 !== ""
            ? {
                family: parseTypographyFamily(entries.get(value16)),
              }
            : {}),
        });
      }
    }
    return items;
  }
  function typographyStyleSubtitle(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      String(Math.round(input2 * 10) / 10);
    return (
      (input.family !== undefined && input.family.name !== ""
        ? input.family.name + " \xB7 "
        : "") +
      callback(input.fontSize) +
      "/" +
      String(Math.round(input.fontSize * input.lineHeight)) +
      " \xB7 " +
      (DesignSystemTypographyParsing300330400Config[input.fontWeight] ??
        String(input.fontWeight)) +
      (input.italic ? " \xB7 italic" : "")
    );
  }
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingLimit",
    () => DesignSystemTypographyParsingLimit,
    (value) => {
      DesignSystemTypographyParsingLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingLimit_2",
    () => DesignSystemTypographyParsingLimit_2,
    (value) => {
      DesignSystemTypographyParsingLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingLimit_3",
    () => DesignSystemTypographyParsingLimit_3,
    (value) => {
      DesignSystemTypographyParsingLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingConstant",
    () => DesignSystemTypographyParsingConstant,
    (value) => {
      DesignSystemTypographyParsingConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingPattern",
    () => DesignSystemTypographyParsingPattern,
    (value) => {
      DesignSystemTypographyParsingPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingPattern_2",
    () => DesignSystemTypographyParsingPattern_2,
    (value) => {
      DesignSystemTypographyParsingPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "isSafeFontFamily", () => isSafeFontFamily);
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsingHandler",
    () => DesignSystemTypographyParsingHandler,
    (value) => {
      DesignSystemTypographyParsingHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseTypographyLength",
    () => parseTypographyLength,
  );
  bindRuntimeValue(
    runtime,
    "typographyLengthToPixels",
    () => typographyLengthToPixels,
    (value) => {
      typographyLengthToPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseTypographyFamily",
    () => parseTypographyFamily,
  );
  bindRuntimeValue(
    runtime,
    "parseTypographyStyles",
    () => parseTypographyStyles,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemTypographyParsing300330400Config",
    () => DesignSystemTypographyParsing300330400Config,
    (value) => {
      DesignSystemTypographyParsing300330400Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyStyleSubtitle",
    () => typographyStyleSubtitle,
  );
  return () => {
    DesignSystemTypographyParsingLimit = 80;
    DesignSystemTypographyParsingLimit_2 = 12;
    DesignSystemTypographyParsingLimit_3 = 12;
    DesignSystemTypographyParsingConstant = 120;
    DesignSystemTypographyParsingPattern =
      /^(-?\d{1,4}(?:\.\d{1,6})?)(px|rem|em|%)$/;
    DesignSystemTypographyParsingPattern_2 = /^[^;{}<>()\\\r\n\f]{1,200}$/;
    DesignSystemTypographyParsingHandler = (input?: Dynamic): Dynamic =>
      Math.round(input * 1e3) / 1e3;
    typographyLengthToPixels = (input?: Dynamic): Dynamic =>
      input.unit === "rem" || input.unit === "em" ? input.n * 16 : input.n;
    DesignSystemTypographyParsing300330400Config = {
      300: "Light",
      330: "Book",
      400: "Regular",
      430: "Text",
      500: "Medium",
      600: "Semibold",
      700: "Bold",
      800: "Heavy",
    };
  };
}
