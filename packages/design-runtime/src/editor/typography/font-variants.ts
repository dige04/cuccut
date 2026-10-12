/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographyFontVariants(
  runtime: RuntimeBindings,
): () => void {
  var TypographyFontVariants100200300Config: Dynamic;
  var TypographyFontVariantsItems: Dynamic;
  var TypographyFontVariantsItems_2: Dynamic;
  var TypographyFontVariantsFlatMapValue: Dynamic;
  var TypographyFontVariantsSubscribers: Dynamic;
  var sortFontVariants: Dynamic;
  function normalizeFontWeightHundreds(input?: Dynamic): Dynamic {
    return Math.min(900, Math.max(100, Math.round(input / 100) * 100));
  }
  function fontVariantLabel(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      TypographyFontVariants100200300Config[
        normalizeFontWeightHundreds(input)
      ] ?? String(input);
    return options
      ? normalizeFontWeightHundreds(input) === 400
        ? "Italic"
        : value + " italic"
      : value;
  }
  function fontVariantKey(input?: Dynamic, options?: Dynamic): Dynamic {
    return String(normalizeFontWeightHundreds(input)) + (options ? "i" : "");
  }
  function parseFontVariantKey(input?: Dynamic): Dynamic {
    let value: Dynamic = /^([1-9]00)(i?)$/.exec(input);
    return value
      ? {
          weight: Number(value[1]),
          italic: value[2] === "i",
        }
      : undefined;
  }
  function normalizeFirstFontFamily(input?: Dynamic): Dynamic {
    return (input.split(",")[0] ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
  }
  function getAvailableFontVariants(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = normalizeFirstFontFamily(options).toLowerCase(),
      entries: Dynamic = new Map();
    for (let value2 of input as Dynamic) {
      if (
        typeof value2?.family != "string" ||
        typeof value2.weight != "string" ||
        typeof value2.style != "string" ||
        value2.status === "error" ||
        normalizeFirstFontFamily(value2.family).toLowerCase() !== value
      )
        continue;
      let value3: Dynamic = /^(?:italic|oblique)/.test(value2.style.trim()),
        value4: Dynamic = value2.weight.trim(),
        value5: Dynamic = /^(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?$/.exec(
          value4,
        ),
        value6: Dynamic =
          value4 === "normal"
            ? 400
            : value4 === "bold"
              ? 700
              : value5
                ? Number(value5[1])
                : NaN;
      if (!Number.isFinite(value6)) continue;
      let value7: Dynamic =
          value5?.[2] !== undefined ? Number(value5[2]) : value6,
        value8: Dynamic = TypographyFontVariantsItems.filter(
          (input2?: Dynamic): Dynamic =>
            input2 >= Math.min(value6, value7) &&
            input2 <= Math.max(value6, value7),
        );
      for (let value9 of (value8.length > 0
        ? value8
        : [normalizeFontWeightHundreds(value6)]) as Dynamic)
        entries.set(fontVariantKey(value9, value3), {
          weight: value9,
          italic: value3,
        });
    }
    return entries.size === 0 ? undefined : sortFontVariants(entries.values());
  }
  function knownWebFontVariants(input?: Dynamic): Dynamic {
    let value: Dynamic = normalizeFirstFontFamily(input),
      value2: Dynamic = (0, runtime.getKnownWebFont)(value);
    if (value2 !== undefined)
      return (
        value2.wght !== undefined
          ? TypographyFontVariantsItems.filter(
              (input2?: Dynamic): Dynamic =>
                input2 >= value2.wght[0] && input2 <= value2.wght[1],
            )
          : [...(value2.statics ?? [400])]
      ).flatMap(
        (input2?: Dynamic): Dynamic =>
          value2.italic
            ? [
                {
                  weight: input2,
                  italic: false,
                },
                {
                  weight: input2,
                  italic: true,
                },
              ]
            : [
                {
                  weight: input2,
                  italic: false,
                },
              ],
      );
    let value3: Dynamic = value.toLowerCase();
    if (
      TypographyFontVariantsSubscribers.has(value3) ||
      value3 === "helvetica neue" ||
      runtime.TypographyFontCatalogSerifSansSerifPattern.test(value3) ||
      /^(?:-apple-system|blinkmacsystemfont)$/.test(value3)
    )
      return [...TypographyFontVariantsItems_2];
  }
  function resolveFontVariants(input?: Dynamic, items?: Dynamic): Dynamic {
    return (
      knownWebFontVariants(input) ??
      (items !== undefined && items.length > 0
        ? items
        : TypographyFontVariantsFlatMapValue)
    );
  }
  function includeCurrentFontVariant(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = sortFontVariants(input);
    options !== undefined &&
      !value.some(
        (input2?: Dynamic): Dynamic =>
          input2.weight === normalizeFontWeightHundreds(options.weight) &&
          input2.italic === options.italic,
      ) &&
      value.unshift({
        weight: normalizeFontWeightHundreds(options.weight),
        italic: options.italic,
      });
    return value.map(
      (input2?: Dynamic): Dynamic => ({
        value: fontVariantKey(input2.weight, input2.italic),
        label: fontVariantLabel(input2.weight, input2.italic),
      }),
    );
  }
  bindRuntimeValue(
    runtime,
    "TypographyFontVariants100200300Config",
    () => TypographyFontVariants100200300Config,
    (value) => {
      TypographyFontVariants100200300Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontVariantsItems",
    () => TypographyFontVariantsItems,
    (value) => {
      TypographyFontVariantsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontVariantsItems_2",
    () => TypographyFontVariantsItems_2,
    (value) => {
      TypographyFontVariantsItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontVariantsFlatMapValue",
    () => TypographyFontVariantsFlatMapValue,
    (value) => {
      TypographyFontVariantsFlatMapValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyFontVariantsSubscribers",
    () => TypographyFontVariantsSubscribers,
    (value) => {
      TypographyFontVariantsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFontWeightHundreds",
    () => normalizeFontWeightHundreds,
  );
  bindRuntimeValue(runtime, "fontVariantLabel", () => fontVariantLabel);
  bindRuntimeValue(runtime, "fontVariantKey", () => fontVariantKey);
  bindRuntimeValue(runtime, "parseFontVariantKey", () => parseFontVariantKey);
  bindRuntimeValue(
    runtime,
    "normalizeFirstFontFamily",
    () => normalizeFirstFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "sortFontVariants",
    () => sortFontVariants,
    (value) => {
      sortFontVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getAvailableFontVariants",
    () => getAvailableFontVariants,
  );
  bindRuntimeValue(runtime, "knownWebFontVariants", () => knownWebFontVariants);
  bindRuntimeValue(runtime, "resolveFontVariants", () => resolveFontVariants);
  bindRuntimeValue(
    runtime,
    "includeCurrentFontVariant",
    () => includeCurrentFontVariant,
  );
  return () => {
    TypographyFontVariants100200300Config = {
      100: "Thin",
      200: "Extra light",
      300: "Light",
      400: "Regular",
      500: "Medium",
      600: "Semibold",
      700: "Bold",
      800: "Extra bold",
      900: "Black",
    };
    TypographyFontVariantsItems = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    TypographyFontVariantsItems_2 = [
      {
        weight: 400,
        italic: false,
      },
      {
        weight: 400,
        italic: true,
      },
      {
        weight: 700,
        italic: false,
      },
      {
        weight: 700,
        italic: true,
      },
    ];
    TypographyFontVariantsFlatMapValue = TypographyFontVariantsItems.flatMap(
      (input?: Dynamic): Dynamic => [
        {
          weight: input,
          italic: false,
        },
        {
          weight: input,
          italic: true,
        },
      ],
    );
    TypographyFontVariantsSubscribers = new Set(
      runtime.TypographyFontCatalogItems.map(
        (input?: Dynamic): Dynamic => input.family.toLowerCase(),
      ),
    );
    sortFontVariants = (input?: Dynamic): Dynamic =>
      [...input].sort(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          input2.weight - options.weight ||
          Number(input2.italic) - Number(options.italic),
      );
  };
}
