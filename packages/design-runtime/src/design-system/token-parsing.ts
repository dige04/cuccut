/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemTokenParsing(
  runtime: RuntimeBindings,
): () => void {
  function parseColorDesignSystem(
    input?: Dynamic,
    options: Dynamic = {},
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input?.color;
    if (
      typeof value != "object" ||
      value === null ||
      !Array.isArray(value.tokens)
    )
      return;
    let value2: Dynamic = Array.isArray(value.themes)
        ? value.themes.map((input2?: Dynamic): Dynamic => input2)
        : [],
      value3: Dynamic = value2
        .map(
          (input2?: Dynamic): Dynamic =>
            typeof input2?.id == "string" ? input2.id.toLowerCase() : undefined,
        )
        .filter((input2?: Dynamic): Dynamic => input2 !== undefined),
      entries: Dynamic = new Map();
    value3.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      entries.has(input2) || entries.set(input2, options2);
    });
    let entries2: Dynamic = new Map();
    for (let value7 of value.tokens as Dynamic) {
      let value8: Dynamic = value7,
        value9: Dynamic = (0, runtime.normalizeColorTokenName)(value8?.name);
      if (value9 === undefined || entries2.has(value9)) continue;
      let value10: Dynamic = value8?.value,
        value11: Dynamic = typeof value10 == "string" ? value10 : undefined;
      if (
        typeof value10 == "object" &&
        value10 !== null &&
        !Array.isArray(value10)
      ) {
        let entries4: Dynamic = new Map(
            Object.entries(value10).map(
              ([input2, input3]: Dynamic): Dynamic => [
                input2.toLowerCase(),
                input3,
              ],
            ),
          ),
          value12: Dynamic = 1 / 0;
        for (let [value13, value14] of entries4 as Dynamic) {
          if (typeof value14 != "string") continue;
          let entry: Dynamic = entries.get(value13);
          (entry !== undefined
            ? entry < value12
            : value12 === 1 / 0 && value11 === undefined) &&
            ((value11 = value14), entry !== undefined && (value12 = entry));
        }
      }
      entries2.set(value9, typeof value11 == "string" ? value11.trim() : "");
    }
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value7: Dynamic = /^\{(.+)\}$/.exec(input2)?.[1];
        if (value7 === undefined) return (0, runtime.normalizeCssColor)(input2);
        let entry: Dynamic = entries2.get(
          (0, runtime.normalizeColorTokenName)(value7) ?? "",
        );
        return entry !== undefined && options2 < 16
          ? callback(entry, options2 + 1)
          : undefined;
      },
      entries3: Dynamic = new Map(),
      state: Dynamic = {
        total: entries2.size,
        unresolved: 0,
        truncated: 0,
      };
    for (let [value7, value8] of entries2 as Dynamic) {
      let value9: Dynamic = callback(value8, 0);
      value9 === undefined
        ? state.unresolved++
        : entries3.size >= 600
          ? state.truncated++
          : entries3.set(value7, value9);
    }
    context !== undefined && Object.assign(context, state);
    let value4: Dynamic = [...entries2]
        .filter(
          ([input2, input3]: Dynamic): Dynamic =>
            entries3.has(input2) ||
            runtime.DesignSystemTypeDeclarationsRgbaHslaPattern.test(input3),
        )
        .map(([input2]: Dynamic): Dynamic => input2),
      value5: Dynamic = (0, runtime.groupColorTokens)(value4).flatMap(
        (input2?: Dynamic): Dynamic =>
          input2.names.flatMap(
            (input3?: Dynamic): Dynamic =>
              entries3.has(input3)
                ? [
                    {
                      name: input3,
                      value: entries3.get(input3),
                      group: input2.label,
                    },
                  ]
                : [],
          ),
      ),
      value6: Dynamic = value2.find(
        (input2?: Dynamic): Dynamic => typeof input2?.id == "string",
      );
    return (0, runtime.createDesignSystemModel)(
      (0, runtime.boundedDesignSystemText)(options.title, 80) ??
        (0, runtime.designSystemName)(input),
      options.url,
      typeof value6?.name == "string" ? value6.name : value6?.id,
      value5,
    );
  }
  function parseCompleteDesignSystem(
    input?: Dynamic,
    options: Dynamic = {},
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = parseColorDesignSystem(input, options, context),
      value2: Dynamic = (0, runtime.parseTypographyStyles)(input);
    return value2.length === 0
      ? value
      : value !== undefined
        ? {
            ...value,
            type: value2,
          }
        : (0, runtime.createDesignSystemModel)(
            (0, runtime.boundedDesignSystemText)(options.title, 80) ??
              (0, runtime.designSystemName)(input),
            options.url,
            undefined,
            [],
            value2,
          );
  }
  bindRuntimeValue(
    runtime,
    "parseColorDesignSystem",
    () => parseColorDesignSystem,
  );
  bindRuntimeValue(
    runtime,
    "parseCompleteDesignSystem",
    () => parseCompleteDesignSystem,
  );
  return () => {};
}
