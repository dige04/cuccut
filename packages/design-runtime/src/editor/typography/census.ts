/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographyCensus(
  runtime: RuntimeBindings,
): () => void {
  var TypographyCensusBorderBorderWidthBorderStyleValues: Dynamic;
  var TypographyCensusSubscribers: Dynamic;
  var TypographyCensusPattern: Dynamic;
  var TypographyCensusItems: Dynamic;
  var TypographyCensusH1H2H3Config: Dynamic;
  var TypographyCensusItems_2: Dynamic;
  var TypographyCensusHeadingPattern: Dynamic;
  var TypographyCensusPattern_2: Dynamic;
  var TypographyCensusPattern_3: Dynamic;
  var TypographyCensusRgbaPattern: Dynamic;
  function hasAuthoredAppearance(input?: Dynamic): Dynamic {
    return (0, runtime.parseStyleDeclarations)(input).some(
      (input2?: Dynamic): Dynamic =>
        TypographyCensusSubscribers.has(input2.prop),
    );
  }
  function inspectSvgLine(input?: Dynamic): Dynamic {
    if (!input || input.tagName.toLowerCase() !== "svg") return null;
    let value: Dynamic = null;
    for (let value9 of Array.from(input.children) as Dynamic)
      if (value9.tagName.toLowerCase() === "path") {
        if (value) return null;
        value = value9;
      }
    if (!value) return null;
    let value2: Dynamic = TypographyCensusPattern.exec(
      value.getAttribute("d") ?? "",
    );
    if (!value2) return null;
    let value3: Dynamic = +value2[1],
      value4: Dynamic = +value2[2],
      value5: Dynamic = +value2[3],
      value6: Dynamic = +value2[4];
    if (![value3, value4, value5, value6].every(Number.isFinite)) return null;
    let value7: Dynamic = Math.abs(value4 - value6) < 0.01,
      value8: Dynamic = Math.abs(value3 - value5) < 0.01;
    return value7 && !value8 ? "height" : value8 && !value7 ? "width" : null;
  }
  function selectedSvgElements(input?: Dynamic, options?: Dynamic): Dynamic {
    let values: Dynamic = new Set(options),
      callback: Dynamic = (element?: Dynamic): Dynamic => {
        let value: Dynamic = parseInt(
          element.getAttribute("data-dc-tpl") ?? "-1",
          10,
        );
        return value >= 0 && values.has(value);
      };
    return [
      ...new Set(
        options.map((input2?: Dynamic): Dynamic => {
          let value: Dynamic = input.element(input2);
          if (!value || !runtime.svgShapeTags.has(value.tagName.toLowerCase()))
            return input2;
          let ancestor: Dynamic = value.closest("svg");
          if (!ancestor || !(0, runtime.findSvgShaft)(ancestor, callback))
            return input2;
          let value2: Dynamic = parseInt(
            ancestor.getAttribute("data-dc-tpl") ?? "-1",
            10,
          );
          return value2 >= 0 ? value2 : input2;
        }),
      ),
    ];
  }
  function collectFontFamilies(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value: Dynamic = input2.split(",")[0].trim().replace(/['"]/g, "");
        value && !value.includes("{{") && values.add(value);
      };
    for (let value of input.matchAll(
      /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    ) as Dynamic)
      for (let value2 of value[1].matchAll(
        /font-family\s*:\s*([^;}]+)/gi,
      ) as Dynamic)
        callback(value2[1]);
    for (let value of input.matchAll(/\bstyle="([^"]*)"/gi) as Dynamic)
      for (let value2 of value[1]
        .replace(/&quot;/g, "'")
        .matchAll(/font-family\s*:\s*([^;]+)/gi) as Dynamic)
        callback(value2[1]);
    return [...values];
  }
  function collectGoogleFontFamilies(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set();
    for (let value of input.matchAll(
      /fonts\.googleapis\.com\/css2\?([^"')\s<>]*)/g,
    ) as Dynamic)
      for (let value2 of value[1]
        .replace(/&amp;/g, "&")
        .replace(/%20|%2B/gi, "+")
        .matchAll(/(?:^|&)family=([^&:%]+)/g) as Dynamic)
        values.add(value2[1].replace(/\+/g, " ").slice(0, 60));
    return [...values].slice(0, 40);
  }
  function collectFontSizes(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      value: Dynamic = /font-size\s*:\s*([^;">}]+)/gi,
      value2: Dynamic;
    for (; (value2 = value.exec(input)); ) {
      let value3: Dynamic = value2[1].trim();
      /^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/.test(value3) && values.add(value3);
    }
    return [...values];
  }
  function collectFontSizeFamilyUsage(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        if (!options || !/^\d+(?:\.\d+)?(?:px|pt)$/.test(input2)) return;
        let value5: Dynamic = entries.get(input2) ?? new Map();
        value5.set(options, (value5.get(options) ?? 0) + 1);
        entries.set(input2, value5);
      },
      entries2: Dynamic = new Map(),
      value: Dynamic,
      value2: Dynamic = /<([a-z][a-z0-9-]*)\b([^<>]*)>/gi;
    for (; (value = value2.exec(input)); ) {
      let value5: Dynamic = value[1].toLowerCase(),
        value6: Dynamic = value[2],
        value7: Dynamic = /\bclass="([^"]*)"/.exec(value6)?.[1] ?? "";
      for (let value9 of value7.split(/\s+/).filter(Boolean) as Dynamic) {
        let value10: Dynamic = entries2.get(value9) ?? new Map();
        value10.set(value5, (value10.get(value5) ?? 0) + 1);
        entries2.set(value9, value10);
      }
      let value8: Dynamic = /font-size\s*:\s*([^;"]+)/i
        .exec(/\bstyle="([^"]*)"/.exec(value6)?.[1] ?? "")?.[1]
        ?.trim();
      value8 &&
        callback(
          value8,
          inferTypographyRole(value5, value7, /\brole="button"/.test(value6)),
        );
    }
    let value3: Dynamic = [
        ...input.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
      ].map((input2?: Dynamic): Dynamic => input2[1]).join(`
`),
      value4: Dynamic = /([^{}]+)\{([^{}]*)\}/g;
    for (; (value = value4.exec(value3)); ) {
      let value5: Dynamic = /(?:^|[\s;])font-size\s*:\s*([^;]+)/i
        .exec(value[2])?.[1]
        ?.trim();
      if (value5)
        for (let value6 of value[1].split(",") as Dynamic) {
          let value7: Dynamic =
              value6
                .trim()
                .split(/[\s>+~]+/)
                .pop() ?? "",
            value8: Dynamic = [...value7.matchAll(/\.([\w-]+)/g)].map(
              (input2?: Dynamic): Dynamic => input2[1],
            ),
            value9: Dynamic =
              /^[a-z][a-z0-9-]*/i.exec(value7)?.[0]?.toLowerCase() ?? "";
          !value9 &&
            value8.length > 0 &&
            (value9 =
              [...(entries2.get(value8[0]) ?? new Map())].sort(
                (input2?: Dynamic, options?: Dynamic): Dynamic =>
                  options[1] - input2[1],
              )[0]?.[0] ?? "");
          /^(b|strong)$/.test(value9) &&
            value8.length === 0 &&
            (value8 = [...value6.matchAll(/\.([\w-]+)/g)].map(
              (input2?: Dynamic): Dynamic => input2[1],
            ));
          callback(
            value5,
            inferTypographyRole(value9, value8.join(" "), false),
          );
        }
    }
    return entries;
  }
  function collectTypographyRoles(input?: Dynamic): Dynamic {
    let state: Dynamic = {
        serif: "serif",
        "ui-serif": "serif",
        "sans-serif": "sans-serif",
        "ui-sans-serif": "sans-serif",
        "system-ui": "sans-serif",
        "-apple-system": "sans-serif",
        blinkmacsystemfont: "sans-serif",
        "ui-rounded": "sans-serif",
        monospace: "monospace",
        "ui-monospace": "monospace",
      },
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value7: Dynamic = (input2 ?? "")
          .split(",")
          .map(
            (input3?: Dynamic): Dynamic =>
              input3.trim().replace(/^["']|["']$/g, ""),
          )
          .filter(Boolean);
        return (
          value7.find(
            (input3?: Dynamic): Dynamic =>
              !(input3.toLowerCase() in state) &&
              !/^(cursive|fantasy|emoji|math|fangsong|inherit|initial|unset)$/i.test(
                input3,
              ),
          ) ??
          value7
            .map((input3?: Dynamic): Dynamic => state[input3.toLowerCase()])
            .find((input3?: Dynamic): Dynamic => input3 !== undefined) ??
          null
        );
      },
      callback2: Dynamic = (
        input2?: Dynamic,
        options: Dynamic = false,
      ): Dynamic =>
        callback(
          (options
            ? /(?:^|[\s;])font-family\s*:\s*([^;}]+)/i
            : /(?:^|[\s;"])font-family\s*:\s*([^;"]+)/i
          )
            .exec(input2)?.[1]
            ?.trim(),
        ),
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        /(?:^|[\s;"])font-size\s*:\s*([^;"]+)/i.exec(input2)?.[1]?.trim(),
      entries: Dynamic = new Map(),
      callback4: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        if (!input2 || !options || !/^\d+(?:\.\d+)?(?:px|pt)$/.test(input2))
          return;
        let value7: Dynamic = entries.get(input2) ?? new Map();
        value7.set(options, (value7.get(options) ?? 0) + 1);
        entries.set(input2, value7);
      },
      value: Dynamic = null,
      value2: Dynamic,
      value3: Dynamic = [
        ...input.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
      ].map((input2?: Dynamic): Dynamic => input2[1]).join(`
`),
      value4: Dynamic = /([^{}]+)\{([^{}]*)\}/g;
    for (; (value2 = value4.exec(value3)); ) {
      /(^|,)\s*(body|html|:root)\s*(,|$)/i.test(value2[1].trim()) &&
        (value = callback2(value2[2], true) ?? value);
      callback4(callback3(value2[2]), callback2(value2[2], true));
    }
    let value5: Dynamic = /<[a-z][a-z0-9-]*\b[^<>]*\bstyle="([^"]*)"[^<>]*>/gi;
    for (; (value2 = value5.exec(input)); ) {
      let value7: Dynamic = value2[1].replace(/&quot;/g, "'");
      callback4(callback3(value7), callback2(value7));
    }
    let entries2: Dynamic = new Map(),
      value6: Dynamic = /font-size\s*:\s*(\d+(?:\.\d+)?(?:px|pt))/gi;
    for (; (value2 = value6.exec(input)); )
      if (!entries2.has(value2[1])) {
        let value7: Dynamic =
          [...(entries.get(value2[1]) ?? [])].sort(
            (input2?: Dynamic, options?: Dynamic): Dynamic =>
              options[1] - input2[1],
          )[0]?.[0] ?? value;
        value7 && entries2.set(value2[1], value7);
      }
    return entries2;
  }
  function inferTypographyRole(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context) return "Button";
    if (/^h[1-6]$/.test(input)) return TypographyCensusH1H2H3Config[input];
    for (let [value, value2] of TypographyCensusItems as Dynamic)
      if (value.test(options)) return value2;
    return TypographyCensusH1H2H3Config[input] ?? null;
  }
  function summarizeFontSizeUsage(items?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        [...(options.get(input)?.values() ?? [])].reduce(
          (input2?: Dynamic, options2?: Dynamic): Dynamic => input2 + options2,
          0,
        ),
      entries: Dynamic = new Map();
    for (let value2 of items as Dynamic)
      entries.set(
        value2,
        [...(options.get(value2) ?? [])]
          .sort(
            (input?: Dynamic, options2?: Dynamic): Dynamic =>
              options2[1] - input[1] ||
              TypographyCensusItems_2.indexOf(input[0]) -
                TypographyCensusItems_2.indexOf(options2[0]),
          )
          .map(([input]: Dynamic): Dynamic => input),
      );
    let value: Dynamic =
      items
        .filter((input?: Dynamic): Dynamic => entries.get(input)[0] === "Body")
        .sort(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            callback(options2) - callback(input) || input - options2,
        )[0] ??
      [...items].sort(
        (input?: Dynamic, options2?: Dynamic): Dynamic => input - options2,
      )[Math.floor(items.length / 2)] ??
      16;
    for (let value2 of items as Dynamic)
      entries
        .get(value2)
        .push(
          value2 > value ? "Heading" : value2 === value ? "Body" : "Caption",
        );
    let entries2: Dynamic = new Map(),
      items2: Dynamic = [],
      values: Dynamic = new Set(items);
    for (let value2 of items as Dynamic)
      TypographyCensusHeadingPattern.test(entries.get(value2)[0]) &&
        (items2.push(value2), values.delete(value2));
    for (let value2 of TypographyCensusItems_2.filter(
      (input?: Dynamic): Dynamic => !TypographyCensusHeadingPattern.test(input),
    ) as Dynamic) {
      let value3: Dynamic = [...values]
        .filter(
          (input?: Dynamic): Dynamic => entries.get(input).includes(value2),
        )
        .sort(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            entries.get(input).indexOf(value2) -
              entries.get(options2).indexOf(value2) ||
            callback(options2) - callback(input) ||
            options2 - input,
        );
      value3[0] !== undefined &&
        (entries2.set(value3[0], value2), values.delete(value3[0]));
    }
    for (let value2 of values as Dynamic) value2 > value && items2.push(value2);
    items2
      .sort((input?: Dynamic, options2?: Dynamic): Dynamic => options2 - input)
      .forEach(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          entries2.set(input, "Heading " + String(options2 + 1)),
      );
    return entries2;
  }
  function collectColorTokens(input?: Dynamic, options?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      value: Dynamic = /(--[\w-]+)\s*:\s*([^;"'>}]+)/g,
      value2: Dynamic;
    for (; (value2 = value.exec(input)); )
      entries.set(value2[1], value2[2].trim());
    let entries2: Dynamic = new Map(),
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        entries2.set(input2, (entries2.get(input2) ?? 0) + 1);
      },
      value3: Dynamic =
        /(?:^|[\s;"'{])(?:color|background-color|border-color|fill|stroke)\s*:\s*([^;"'>}]+)/gi;
    for (; (value2 = value3.exec(input)); ) {
      let value4: Dynamic = value2[1].trim().replace(/\s*!important$/i, ""),
        value5: Dynamic = TypographyCensusPattern_2.exec(value4)?.[1];
      for (
        let index: Dynamic = 0;
        value5 !== undefined &&
        options?.has(value5) !== true &&
        entries.has(value5) &&
        index < 8;
        index++
      ) {
        value4 = entries.get(value5);
        value5 = TypographyCensusPattern_2.exec(value4)?.[1];
      }
      if (value5 !== undefined) {
        let value7: Dynamic = resolveColorToken(entries, value5);
        options?.has(value5) === true &&
          callback(
            "var(" + value5 + (value7 !== null ? ", " + value7 : "") + ")",
          );
        continue;
      }
      if (
        !value4 ||
        value4.includes("{{") ||
        /^(none|inherit|currentcolor|transparent|initial|unset)$/i.test(value4)
      )
        continue;
      let value6: Dynamic = normalizeHexColor(value4);
      value6 && callback(value6);
    }
    return entries2;
  }
  function resolveColorToken(input?: Dynamic, options?: Dynamic): Dynamic {
    let entry: Dynamic = input.get(options);
    for (let index: Dynamic = 0; entry !== undefined && index < 8; index++) {
      let value: Dynamic = TypographyCensusPattern_2.exec(entry)?.[1];
      if (value === undefined) return normalizeHexColor(entry);
      entry = input.get(value);
    }
    return null;
  }
  function normalizeHexColor(input?: Dynamic): Dynamic {
    let value: Dynamic,
      value2: Dynamic,
      value3: Dynamic,
      count: Dynamic = 1,
      value4: Dynamic = TypographyCensusPattern_3.exec(input.trim());
    if (value4) {
      let value6: Dynamic = value4[1];
      value6.length <= 4 &&
        (value6 = [...value6]
          .map((input2?: Dynamic): Dynamic => input2 + input2)
          .join(""));
      value = parseInt(value6.slice(0, 2), 16);
      value2 = parseInt(value6.slice(2, 4), 16);
      value3 = parseInt(value6.slice(4, 6), 16);
      value6.length === 8 && (count = parseInt(value6.slice(6, 8), 16) / 255);
    } else {
      let value6: Dynamic = TypographyCensusRgbaPattern.exec(input.trim());
      if (
        !value6 ||
        ((value = +value6[1]),
        (value2 = +value6[2]),
        (value3 = +value6[3]),
        value6[4] !== undefined &&
          (count = value6[4].endsWith("%")
            ? parseFloat(value6[4]) / 100
            : parseFloat(value6[4])),
        [value, value2, value3].some(
          (input2?: Dynamic): Dynamic => input2 > 255,
        ) || !(count >= 0 && count <= 1))
      )
        return null;
    }
    if (count < 0.2) return null;
    let value5: Dynamic =
      "#" +
      [value, value2, value3]
        .map(
          (input2?: Dynamic): Dynamic => input2.toString(16).padStart(2, "0"),
        )
        .join("");
    return count >= 0.999
      ? value5
      : "rgba(" +
          value +
          ", " +
          value2 +
          ", " +
          value3 +
          ", " +
          String(Math.round(count * 100) / 100) +
          ")";
  }
  bindRuntimeValue(
    runtime,
    "TypographyCensusBorderBorderWidthBorderStyleValues",
    () => TypographyCensusBorderBorderWidthBorderStyleValues,
    (value) => {
      TypographyCensusBorderBorderWidthBorderStyleValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusSubscribers",
    () => TypographyCensusSubscribers,
    (value) => {
      TypographyCensusSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasAuthoredAppearance",
    () => hasAuthoredAppearance,
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusPattern",
    () => TypographyCensusPattern,
    (value) => {
      TypographyCensusPattern = value;
    },
  );
  bindRuntimeValue(runtime, "inspectSvgLine", () => inspectSvgLine);
  bindRuntimeValue(runtime, "selectedSvgElements", () => selectedSvgElements);
  bindRuntimeValue(runtime, "collectFontFamilies", () => collectFontFamilies);
  bindRuntimeValue(
    runtime,
    "collectGoogleFontFamilies",
    () => collectGoogleFontFamilies,
  );
  bindRuntimeValue(runtime, "collectFontSizes", () => collectFontSizes);
  bindRuntimeValue(
    runtime,
    "collectFontSizeFamilyUsage",
    () => collectFontSizeFamilyUsage,
  );
  bindRuntimeValue(
    runtime,
    "collectTypographyRoles",
    () => collectTypographyRoles,
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusItems",
    () => TypographyCensusItems,
    (value) => {
      TypographyCensusItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusH1H2H3Config",
    () => TypographyCensusH1H2H3Config,
    (value) => {
      TypographyCensusH1H2H3Config = value;
    },
  );
  bindRuntimeValue(runtime, "inferTypographyRole", () => inferTypographyRole);
  bindRuntimeValue(
    runtime,
    "TypographyCensusItems_2",
    () => TypographyCensusItems_2,
    (value) => {
      TypographyCensusItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusHeadingPattern",
    () => TypographyCensusHeadingPattern,
    (value) => {
      TypographyCensusHeadingPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "summarizeFontSizeUsage",
    () => summarizeFontSizeUsage,
  );
  bindRuntimeValue(runtime, "collectColorTokens", () => collectColorTokens);
  bindRuntimeValue(
    runtime,
    "TypographyCensusPattern_2",
    () => TypographyCensusPattern_2,
    (value) => {
      TypographyCensusPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "resolveColorToken", () => resolveColorToken);
  bindRuntimeValue(
    runtime,
    "TypographyCensusPattern_3",
    () => TypographyCensusPattern_3,
    (value) => {
      TypographyCensusPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TypographyCensusRgbaPattern",
    () => TypographyCensusRgbaPattern,
    (value) => {
      TypographyCensusRgbaPattern = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeHexColor", () => normalizeHexColor);
  return () => {
    TypographyCensusBorderBorderWidthBorderStyleValues = [
      "border",
      "border-width",
      "border-style",
      "border-color",
      "border-top",
      "border-right",
      "border-bottom",
      "border-left",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "border-top-style",
      "border-right-style",
      "border-bottom-style",
      "border-left-style",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
    ];
    TypographyCensusSubscribers = new Set(
      TypographyCensusBorderBorderWidthBorderStyleValues,
    );
    TypographyCensusPattern =
      /^\s*M\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*L\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*$/;
    TypographyCensusItems = [
      [/eyebrow|kicker|overline/i, "Eyebrow"],
      [/subhead|\blead\b|\bdek\b|intro|standfirst/i, "Lead"],
      [/display|hero-?title/i, "Display"],
      [/caption|footnote|\bmeta\b|footer|fine-?print|muted|byline/i, "Caption"],
      [/quote/i, "Quote"],
      [/\bcode\b|mono/i, "Code"],
      [/\bstat|metric|kpi|figure|numeral/i, "Stat"],
      [/wordmark|logo|brand/i, "Wordmark"],
      [/\bbtn\b|button|cta/i, "Button"],
      [/\bnav|menu|link/i, "Link"],
      [/label|tag\b|badge|chip|pill/i, "Label"],
    ];
    TypographyCensusH1H2H3Config = {
      h1: "Heading 1",
      h2: "Heading 2",
      h3: "Heading 3",
      h4: "Heading 4",
      h5: "Heading 5",
      h6: "Heading 6",
      p: "Body",
      li: "Body",
      td: "Body",
      th: "Body",
      dd: "Body",
      dt: "Body",
      div: "Body",
      button: "Button",
      a: "Link",
      blockquote: "Quote",
      q: "Quote",
      code: "Code",
      pre: "Code",
      kbd: "Code",
      small: "Caption",
      figcaption: "Caption",
      caption: "Caption",
      label: "Label",
      span: "Caption",
      b: "Strong",
      strong: "Strong",
      em: "Body",
      i: "Body",
    };
    TypographyCensusItems_2 = [
      "Display",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Heading 4",
      "Heading 5",
      "Heading 6",
      "Lead",
      "Eyebrow",
      "Body",
      "Button",
      "Link",
      "Stat",
      "Wordmark",
      "Quote",
      "Code",
      "Label",
      "Caption",
      "Strong",
    ];
    TypographyCensusHeadingPattern = /^Heading( [1-6])?$/;
    TypographyCensusPattern_2 = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/;
    TypographyCensusPattern_3 = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    TypographyCensusRgbaPattern =
      /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/i;
  };
}
