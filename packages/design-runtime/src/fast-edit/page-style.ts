import type {
  PageStyles,
  PageStyleInput,
  PageDeclarations,
  PageStyleResult,
  MarkupRange,
  HelmetMarkup,
  PageStylesheet,
  MarkupMatch,
} from "../contracts/fast-edit";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditPageStyle(runtime: RuntimeBindings): () => void {
  var MAX_PAGE_COLOR_CHARS: number;
  var CSS_COLOR_KEYWORDS: Set<string>;
  var CSS_HEX_COLOR_PATTERN: RegExp;
  var CSS_COLOR_NUMBER_PATTERN: string;
  var CSS_FUNCTIONAL_COLOR_PATTERN: RegExp;
  var PAGE_STYLE_START_MARKER: string;
  var PAGE_STYLE_END_MARKER: string;
  var GENERIC_FONT_FAMILIES: Set<string>;
  var FONT_FAMILY_PATTERN: RegExp;
  var PAGE_FONT_LIST_PATTERN: RegExp;
  var PAGE_BODY_STYLE_PATTERN: RegExp;
  var findMarkupBlock: (
    html: string,
    opening: RegExp,
    closing: RegExp,
  ) => MarkupMatch | null;
  var findHelmetBlock: (html: string) => MarkupMatch | null;
  var findStyleBlock: (html: string) => MarkupMatch | null;
  var findPageStylesheet: (html: string) => PageStylesheet | null;
  var hasPageStylesheet: (html: string) => boolean;
  var SECTION_ATTRIBUTE_PATTERN: RegExp;
  var serializePageStyleAttributes: Dynamic;
  function findPairedMarkupTags(
    html: string,
    openingPattern: RegExp,
    closingPattern: RegExp,
  ): MarkupRange | null {
    let opening = openingPattern.exec(html);
    if (opening === null) return null;
    closingPattern.lastIndex = opening.index + opening[0].length;
    let closing = closingPattern.exec(html);
    return closing === null
      ? null
      : {
          at: opening.index,
          innerAt: opening.index + opening[0].length,
          innerEnd: closing.index,
          end: closing.index + closing[0].length,
        };
  }
  function splitHelmetMarkup(html: string): HelmetMarkup | null {
    let helmetRange = findPairedMarkupTags(
      html,
      /<helmet\b[^>]*>/i,
      /<\/helmet\s*>/gi,
    );
    return helmetRange === null
      ? null
      : {
          a: html.slice(0, helmetRange.at),
          h: html.slice(helmetRange.at, helmetRange.end),
          b: html.slice(helmetRange.end),
        };
  }
  function stripHelmetMarkup(html: string): string {
    let helmet = splitHelmetMarkup(html);
    return helmet === null ? html : helmet.a + helmet.b;
  }
  function preserveHelmetMarkup(before: string, after: string): string {
    let helmet = splitHelmetMarkup(before);
    return helmet === null
      ? after
      : after === helmet.a + helmet.b
        ? before
        : helmet.a !== "" && after.startsWith(helmet.a)
          ? helmet.a + helmet.h + after.slice(helmet.a.length)
          : helmet.a + helmet.h + after;
  }
  function validatePageColor(value: unknown): string | null {
    if (typeof value != "string") return null;
    let color = value.trim();
    return color === "" || color.length > MAX_PAGE_COLOR_CHARS
      ? null
      : CSS_HEX_COLOR_PATTERN.test(color)
        ? color
        : CSS_COLOR_KEYWORDS.has(color.toLowerCase())
          ? color.toLowerCase()
          : CSS_FUNCTIONAL_COLOR_PATTERN.test(color)
            ? color
            : null;
  }
  function validatePageFontFamilies(
    value: unknown,
    knownFamilies: Iterable<string>,
  ): string | null {
    if (typeof value != "string" || value.length > 160) return null;
    let families = value
      .split(",")
      .map((input) =>
        input
          .trim()
          .replace(
            /^"([^"]*)"$|^'([^']*)'$/,
            (input2, options, context) => options ?? context ?? "",
          ),
      );
    if (families.length === 0 || families.length > 3) return null;
    let values = new Set(
        [...knownFamilies].map((input) => input.toLowerCase()),
      ),
      items: string[] = [];
    for (let value2 of families) {
      if (
        !FONT_FAMILY_PATTERN.test(value2) ||
        value2.trim() !== value2 ||
        /\s{2,}/.test(value2)
      )
        return null;
      if (GENERIC_FONT_FAMILIES.has(value2.toLowerCase()))
        items.push(value2.toLowerCase());
      else if (values.has(value2.toLowerCase())) items.push('"' + value2 + '"');
      else return null;
    }
    return items.join(",");
  }
  function serializePageStyleDeclarations(styles: PageDeclarations): string {
    let declarations = [
      styles.background !== undefined ? "background:" + styles.background : "",
      styles.color !== undefined ? "color:" + styles.color : "",
      styles.families !== undefined ? "font-family:" + styles.families : "",
    ].filter((input) => input !== "");
    return declarations.length === 0
      ? ""
      : PAGE_STYLE_START_MARKER +
          "body{" +
          declarations.join(";") +
          "}" +
          PAGE_STYLE_END_MARKER;
  }
  function updatePageStyleSheet(
    html: string,
    styles: PageStyleInput,
    families: Iterable<string>,
  ): PageStyleResult {
    let sheet = findPageStylesheet(html);
    if (sheet === null)
      return {
        ok: false,
        why: "no_sheet",
      };
    let { hm: helmetMatch, sm: styleMatch } = sheet,
      styleOffset =
        helmetMatch.index +
        helmetMatch[0].indexOf(helmetMatch[1]) +
        styleMatch.index +
        styleMatch[0].indexOf(">") +
        1,
      value = styleMatch[1];
    if (html.slice(styleOffset, styleOffset + value.length) !== value)
      return {
        ok: false,
        why: "no_sheet",
      };
    let value2 = value.split(PAGE_STYLE_START_MARKER).length - 1,
      value3 = value.split(PAGE_STYLE_END_MARKER).length - 1;
    if (
      value2 !== value3 ||
      value2 > 1 ||
      /ask:page/.test(
        value
          .split(PAGE_STYLE_START_MARKER)
          .join("")
          .split(PAGE_STYLE_END_MARKER)
          .join(""),
      )
    )
      return {
        ok: false,
        why: "sentinels",
      };
    let value4 = value,
      text = "",
      state: PageDeclarations = {};
    if (value2 === 1) {
      let value8 = value.indexOf(PAGE_STYLE_START_MARKER),
        value9 = value.indexOf(PAGE_STYLE_END_MARKER);
      if (value9 < value8)
        return {
          ok: false,
          why: "sentinels",
        };
      let value10 = PAGE_BODY_STYLE_PATTERN.exec(
        value.slice(value8 + PAGE_STYLE_START_MARKER.length, value9),
      );
      if (value10 === null)
        return {
          ok: false,
          why: "sentinels",
        };
      for (let value11 of value10[1]!.split(";")) {
        let value12 = value11.indexOf(":"),
          value13 = value11.slice(0, value12),
          value14 = value11.slice(value12 + 1);
        value13 === "background"
          ? (state.background = value14)
          : value13 === "color"
            ? (state.color = value14)
            : (state.families = value14);
      }
      value4 = value.slice(0, value8);
      text = value.slice(value9 + PAGE_STYLE_END_MARKER.length);
    }
    let state2: PageDeclarations = {
      ...state,
    };
    if (styles.background !== undefined)
      if (styles.background === "") delete state2.background;
      else {
        let value8 = validatePageColor(styles.background);
        if (value8 === null)
          return {
            ok: false,
            why: "value",
          };
        state2.background = value8;
      }
    if (styles.color !== undefined)
      if (styles.color === "") delete state2.color;
      else {
        let value8 = validatePageColor(styles.color);
        if (value8 === null)
          return {
            ok: false,
            why: "value",
          };
        state2.color = value8;
      }
    if (styles.font !== undefined)
      if (styles.font === "") delete state2.families;
      else {
        let value8 = validatePageFontFamilies(styles.font, families);
        if (value8 === null)
          return {
            ok: false,
            why: "value",
          };
        state2.families = value8;
      }
    if (
      (state2.background !== undefined &&
        validatePageColor(state2.background) === null) ||
      (state2.color !== undefined &&
        validatePageColor(state2.color) === null) ||
      (state2.families !== undefined &&
        !PAGE_FONT_LIST_PATTERN.test(state2.families))
    )
      return {
        ok: false,
        why: "sentinels",
      };
    let value5 = serializePageStyleDeclarations(state2),
      value6 = value2 === 1 ? value4 + text + value5 : value + value5,
      value7 =
        html.slice(0, styleOffset) +
        value6 +
        html.slice(styleOffset + value.length),
      callback: (css: string) => string = (input) => {
        let value8 = input.indexOf(PAGE_STYLE_START_MARKER),
          value9 = input.indexOf(PAGE_STYLE_END_MARKER);
        return value8 < 0
          ? input
          : input.slice(0, value8) +
              input.slice(value9 + PAGE_STYLE_END_MARKER.length);
      };
    return html.slice(0, styleOffset) !== value7.slice(0, styleOffset) ||
      html.slice(styleOffset + value.length) !==
        value7.slice(styleOffset + value6.length) ||
      callback(value6) !== callback(value)
      ? {
          ok: false,
          why: "outside",
        }
      : value6.split(PAGE_STYLE_START_MARKER).length - 1 !==
            (value5 === "" ? 0 : 1) ||
          value6.split(PAGE_STYLE_END_MARKER).length - 1 !==
            (value5 === "" ? 0 : 1)
        ? {
            ok: false,
            why: "outside",
          }
        : {
            ok: true,
            template: value7,
          };
  }
  function readPageStylesFromSheet(
    html: string,
    families: Iterable<string>,
  ): PageStyles {
    let helmetMatch = findHelmetBlock(html),
      styleMatch = helmetMatch === null ? null : findStyleBlock(helmetMatch[1]);
    if (styleMatch === null) return {};
    let styles: PageStyles = {};
    for (let value of styleMatch[1]
      .slice(0, styleMatch[1].lastIndexOf("}") + 1)
      .matchAll(/body\s*\{([^}]*)\}/gi))
      for (let value2 of value[1]!.split(";")) {
        let value3 = value2.indexOf(":");
        if (value3 <= 0) continue;
        let value4 = value2.slice(0, value3).trim().toLowerCase(),
          value5 = value2.slice(value3 + 1).trim();
        if (value4 === "background" || value4 === "background-color") {
          let value6 = validatePageColor(value5);
          value6 !== null
            ? (styles.background = value6)
            : delete styles.background;
        } else if (value4 === "color") {
          let value6 = validatePageColor(value5);
          value6 !== null ? (styles.color = value6) : delete styles.color;
        } else if (value4 === "font-family") {
          let value6 = validatePageFontFamilies(value5, families);
          value6 !== null
            ? (styles.font = value6.replace(/"/g, ""))
            : delete styles.font;
        }
      }
    return styles;
  }
  function readPageStylesFromSection(html: string): PageStyles {
    let styles: PageStyles = {},
      sectionMatch = /^<section\b/i.exec(html);
    if (sectionMatch === null) return styles;
    SECTION_ATTRIBUTE_PATTERN.lastIndex = sectionMatch[0].length;
    for (
      let value = SECTION_ATTRIBUTE_PATTERN.exec(html);
      value !== null;
      value = SECTION_ATTRIBUTE_PATTERN.exec(html)
    )
      if (value[1]!.toLowerCase() === "style") {
        for (let value2 of (value[2] ?? value[3] ?? value[4] ?? "")
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&amp;/g, "&")
          .split(";")) {
          let value3 = value2.indexOf(":"),
            value4 =
              value3 <= 0 ? "" : value2.slice(0, value3).trim().toLowerCase(),
            value5 = value2.slice(value3 + 1).trim();
          value4 === "background" || value4 === "background-color"
            ? (styles.background = value5)
            : value4 === "color"
              ? (styles.color = value5)
              : value4 === "font-family" && (styles.font = value5);
        }
        break;
      }
    return styles;
  }
  function validatePageStyles(
    styles: PageStyleInput,
    families: Iterable<string>,
  ): PageStyles {
    let background = validatePageColor(styles.background),
      color = validatePageColor(styles.color),
      font = validatePageFontFamilies(styles.font, families);
    return {
      ...(background !== null
        ? {
            background: background,
          }
        : {}),
      ...(color !== null
        ? {
            color: color,
          }
        : {}),
      ...(font !== null
        ? {
            font: font.replace(/"/g, ""),
          }
        : {}),
    };
  }
  bindRuntimeValue(runtime, "findPairedMarkupTags", () => findPairedMarkupTags);
  bindRuntimeValue(runtime, "splitHelmetMarkup", () => splitHelmetMarkup);
  bindRuntimeValue(runtime, "stripHelmetMarkup", () => stripHelmetMarkup);
  bindRuntimeValue(runtime, "preserveHelmetMarkup", () => preserveHelmetMarkup);
  bindRuntimeValue(
    runtime,
    "MAX_PAGE_COLOR_CHARS",
    () => MAX_PAGE_COLOR_CHARS,
    (value) => {
      MAX_PAGE_COLOR_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_COLOR_KEYWORDS",
    () => CSS_COLOR_KEYWORDS,
    (value) => {
      CSS_COLOR_KEYWORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_HEX_COLOR_PATTERN",
    () => CSS_HEX_COLOR_PATTERN,
    (value) => {
      CSS_HEX_COLOR_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_COLOR_NUMBER_PATTERN",
    () => CSS_COLOR_NUMBER_PATTERN,
    (value) => {
      CSS_COLOR_NUMBER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_FUNCTIONAL_COLOR_PATTERN",
    () => CSS_FUNCTIONAL_COLOR_PATTERN,
    (value) => {
      CSS_FUNCTIONAL_COLOR_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "validatePageColor", () => validatePageColor);
  bindRuntimeValue(
    runtime,
    "PAGE_STYLE_START_MARKER",
    () => PAGE_STYLE_START_MARKER,
    (value) => {
      PAGE_STYLE_START_MARKER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PAGE_STYLE_END_MARKER",
    () => PAGE_STYLE_END_MARKER,
    (value) => {
      PAGE_STYLE_END_MARKER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERIC_FONT_FAMILIES",
    () => GENERIC_FONT_FAMILIES,
    (value) => {
      GENERIC_FONT_FAMILIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_FAMILY_PATTERN",
    () => FONT_FAMILY_PATTERN,
    (value) => {
      FONT_FAMILY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validatePageFontFamilies",
    () => validatePageFontFamilies,
  );
  bindRuntimeValue(
    runtime,
    "serializePageStyleDeclarations",
    () => serializePageStyleDeclarations,
  );
  bindRuntimeValue(
    runtime,
    "PAGE_FONT_LIST_PATTERN",
    () => PAGE_FONT_LIST_PATTERN,
    (value) => {
      PAGE_FONT_LIST_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PAGE_BODY_STYLE_PATTERN",
    () => PAGE_BODY_STYLE_PATTERN,
    (value) => {
      PAGE_BODY_STYLE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findMarkupBlock",
    () => findMarkupBlock,
    (value) => {
      findMarkupBlock = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findHelmetBlock",
    () => findHelmetBlock,
    (value) => {
      findHelmetBlock = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findStyleBlock",
    () => findStyleBlock,
    (value) => {
      findStyleBlock = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findPageStylesheet",
    () => findPageStylesheet,
    (value) => {
      findPageStylesheet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasPageStylesheet",
    () => hasPageStylesheet,
    (value) => {
      hasPageStylesheet = value;
    },
  );
  bindRuntimeValue(runtime, "updatePageStyleSheet", () => updatePageStyleSheet);
  bindRuntimeValue(
    runtime,
    "readPageStylesFromSheet",
    () => readPageStylesFromSheet,
  );
  bindRuntimeValue(
    runtime,
    "SECTION_ATTRIBUTE_PATTERN",
    () => SECTION_ATTRIBUTE_PATTERN,
    (value) => {
      SECTION_ATTRIBUTE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readPageStylesFromSection",
    () => readPageStylesFromSection,
  );
  bindRuntimeValue(runtime, "validatePageStyles", () => validatePageStyles);
  bindRuntimeValue(
    runtime,
    "serializePageStyleAttributes",
    () => serializePageStyleAttributes,
    (value) => {
      serializePageStyleAttributes = value;
    },
  );
  return () => {
    MAX_PAGE_COLOR_CHARS = 64;
    CSS_COLOR_KEYWORDS = new Set(
      "transparent black silver gray grey white maroon red purple fuchsia green lime olive yellow navy blue teal aqua orange aliceblue antiquewhite aquamarine azure beige bisque blanchedalmond blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen gainsboro ghostwhite gold goldenrod greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow limegreen linen magenta mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite oldlace olivedrab orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna skyblue slateblue slategray slategrey snow springgreen steelblue tan thistle tomato turquoise violet wheat whitesmoke yellowgreen rebeccapurple".split(
        " ",
      ),
    );
    CSS_HEX_COLOR_PATTERN =
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
    CSS_COLOR_NUMBER_PATTERN = "-?(?:\\d{1,4}(?:\\.\\d{1,4})?|\\.\\d{1,4})%?";
    CSS_FUNCTIONAL_COLOR_PATTERN = new RegExp(
      "^(?:rgb|rgba|hsl|hsla)\\(\\s*" +
        CSS_COLOR_NUMBER_PATTERN +
        "(?:deg)?(?:\\s*,\\s*|\\s+)" +
        CSS_COLOR_NUMBER_PATTERN +
        "(?:\\s*,\\s*|\\s+)" +
        CSS_COLOR_NUMBER_PATTERN +
        "(?:\\s*,\\s*" +
        CSS_COLOR_NUMBER_PATTERN +
        ")?\\s*\\)$",
      "i",
    );
    PAGE_STYLE_START_MARKER = "/*ask:page*/";
    PAGE_STYLE_END_MARKER = "/*ask:page-end*/";
    GENERIC_FONT_FAMILIES = new Set([
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
    ]);
    FONT_FAMILY_PATTERN = /^[A-Za-z0-9 \-]{1,40}$/;
    PAGE_FONT_LIST_PATTERN =
      /^(?:"[A-Za-z0-9 \-]{1,40}"|[a-z-]{1,12})(?:,(?:"[A-Za-z0-9 \-]{1,40}"|[a-z-]{1,12})){0,2}$/;
    PAGE_BODY_STYLE_PATTERN =
      /^body\{((?:background:[^;{}]+|color:[^;{}]+|font-family:[^;{}]+)(?:;(?:background:[^;{}]+|color:[^;{}]+|font-family:[^;{}]+))*)\}$/;
    findMarkupBlock = (
      html: string,
      opening: RegExp,
      closing: RegExp,
    ): MarkupMatch | null => {
      let value = findPairedMarkupTags(html, opening, closing);
      return value === null
        ? null
        : {
            index: value.at,
            0: html.slice(value.at, value.end),
            1: html.slice(value.innerAt, value.innerEnd),
          };
    };
    findHelmetBlock = (html: string): MarkupMatch | null =>
      findMarkupBlock(html, /<helmet\b[^>]*>/i, /<\/helmet>/gi);
    findStyleBlock = (html: string): MarkupMatch | null =>
      findMarkupBlock(html, /<style\b[^>]*>/i, /<\/style>/gi);
    findPageStylesheet = (html: string): PageStylesheet | null => {
      let value = findHelmetBlock(html),
        value2 = value === null ? null : findStyleBlock(value[1]);
      return value === null || value2 === null
        ? null
        : {
            hm: value,
            sm: value2,
          };
    };
    hasPageStylesheet = (html: string): boolean =>
      findPageStylesheet(html) !== null;
    SECTION_ATTRIBUTE_PATTERN =
      /\s+([^\s=>"'\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/y;
    serializePageStyleAttributes = (input?: Dynamic): Dynamic =>
      ' data-page-background="' +
      (input.background ?? "") +
      '" data-page-color="' +
      (input.color ?? "") +
      '" data-page-font="' +
      (input.font ?? "") +
      '"';
  };
}
