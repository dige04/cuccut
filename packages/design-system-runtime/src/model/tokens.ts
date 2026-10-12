/** Restored application module; prepare first, initialize in original order. */
import type * as Model from "../contracts";
import type * as Core from "../contracts/model-core";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  NormalizedTokens,
  ParseReport,
  TokenCssOptions,
} from "../contracts";
export function installModelTokens(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var TOKEN_NAME_PATTERN: RegExp;
  var HEX_COLOR_PATTERN: RegExp;
  var COLOR_ALIAS_PATTERN: RegExp;
  var EXTRA_TOKEN_FAMILY_PATTERN: RegExp;
  var BUILTIN_TOKEN_DOCUMENT_KEYS: string[];
  var MAX_COLOR_ALIAS_DEPTH: number;
  var COLOR_FUNCTION_PATTERN: RegExp;
  var CSS_LENGTH_PATTERN: RegExp;
  var FONT_WEIGHT_PATTERN: RegExp;
  var FONT_STACK_PATTERN: RegExp;
  var MAX_COLOR_THEMES: number;
  var MAX_COLOR_TOKENS: number;
  var MAX_PARSED_FONT_FACES: number;
  var MAX_FONT_FAMILIES: number;
  var MAX_TYPOGRAPHY_GROUPS: number;
  var MAX_TYPOGRAPHY_STYLES: number;
  var MAX_TOKENS_PER_FAMILY: number;
  var MAX_EXTRA_TOKEN_FAMILIES: number;
  var MAX_TOKEN_LABEL_LENGTH: number;
  var MAX_TOKEN_NOTE_LENGTH: number;
  var MAX_TOKEN_USAGE_LENGTH: number;
  var MAX_TYPE_SAMPLE_LENGTHModelTokens: number;
  var BOX_SHADOW_PATTERN: RegExp;
  var MOTION_DURATION_PATTERN: RegExp;
  var MOTION_EASING_PATTERN: RegExp;
  var EXTRA_TOKEN_VALUE_PATTERN: RegExp;
  var isTokenObject: (value: unknown) => value is Record<string, unknown>;
  var normalizeThemeColorValue: (value: unknown) => string | undefined;
  var UNPREFIXED_HEX_COLOR_PATTERN: RegExp;
  var CSS_VARIABLE_TOKEN_FAMILIES: Core.ValueTokenKind[];
  var colorTokenIndexCache: WeakMap<
    Model.ColorToken[],
    Map<string, Model.ColorToken>
  >;
  var FONT_FACE_FORMAT_NAMES: Record<string, string>;
  var cachedGeneratedTokensCss: {
    tokens: string;
    name: string;
    fonts: string;
    css: string | null;
  } | null;
  function defineOwnEnumerableProperty(
    target: object,
    key: PropertyKey,
    value: unknown,
  ): void {
    Object.defineProperty(target, key, {
      value: value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  function isSafeFontStack(stack: string): boolean {
    if (!FONT_STACK_PATTERN.test(stack)) {
      return false;
    }
    if (stack.includes("/*") || stack.includes("*/")) {
      return false;
    }
    let quote: string | null = null;
    for (let value of stack) {
      if (quote === null) {
        if (value === '"' || value === "'") {
          quote = value;
        }
      } else if (value === quote) {
        quote = null;
      }
    }
    return quote === null;
  }
  function isColorLiteral(value: unknown): boolean {
    return (
      typeof value === "string" &&
      (HEX_COLOR_PATTERN.test(value) ||
        (COLOR_FUNCTION_PATTERN.test(value) &&
          !/url|var|expression/.test(value)))
    );
  }
  function isCssLength(value: unknown): boolean {
    return typeof value === "string" && CSS_LENGTH_PATTERN.test(value);
  }
  function isSafeBoxShadow(value: unknown): boolean {
    if (
      typeof value !== "string" ||
      !BOX_SHADOW_PATTERN.test(value) ||
      /(?:url|var|expression|image|image-set|src)\s*\(/.test(value) ||
      value.trim() === ""
    ) {
      return false;
    }
    let depth: number = 0;
    for (let value2 of value) {
      if (value2 === "(") {
        depth++;
      } else if (value2 === ")" && --depth < 0) {
        return false;
      }
    }
    return depth === 0;
  }
  function normalizeBoxShadow(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return;
    }
    let normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (isSafeBoxShadow(normalized)) {
      return normalized;
    } else {
      return undefined;
    }
  }
  function motionValueKind(value: string): string | undefined {
    if (MOTION_DURATION_PATTERN.test(value)) {
      return "duration";
    } else {
      if (MOTION_EASING_PATTERN.test(value)) {
        return "easing";
      } else {
        return undefined;
      }
    }
  }
  function normalizeMotionValue(value: unknown): string | undefined {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value < 1e6
    ) {
      return String(Math.round(value)) + "ms";
    }
    if (typeof value !== "string") {
      return;
    }
    let normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalized.startsWith(".")) {
      normalized = "0" + normalized;
    }
    if (motionValueKind(normalized) !== undefined) {
      return normalized;
    } else {
      return undefined;
    }
  }
  function normalizeExtraTokenValue(value: unknown): string | undefined {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) < 1e6
    ) {
      return String(value);
    }
    if (typeof value !== "string") {
      return;
    }
    let normalized = value.trim().replace(/\s+/g, " ");
    if (
      !EXTRA_TOKEN_VALUE_PATTERN.test(normalized) ||
      /(?:url|var|expression|image|image-set|src)\s*\(/i.test(normalized)
    ) {
      return;
    }
    let depth: number = 0;
    for (let value2 of normalized) {
      if (value2 === "(") {
        depth++;
      } else if (value2 === ")" && --depth < 0) {
        return;
      }
    }
    if (depth === 0) {
      return normalized;
    } else {
      return undefined;
    }
  }
  function normalizeScalarTokenValue(family: Core.ScalarKind, value: unknown) {
    if (family === "extra") {
      return normalizeExtraTokenValue(value);
    } else {
      return normalizeCssLength(value, family === "radius");
    }
  }
  function colorAliasTarget(value: string | undefined) {
    if (value === undefined) {
      return undefined;
    } else {
      return COLOR_ALIAS_PATTERN.exec(value)?.[1];
    }
  }
  function isColorOrAlias(value: unknown) {
    return (
      isColorLiteral(value) ||
      (typeof value === "string" && COLOR_ALIAS_PATTERN.test(value))
    );
  }
  function truncateTokenText(value: unknown, maxLength: number) {
    if (typeof value !== "string") {
      return "";
    }
    let characters = Array.from(value);
    if (characters.length > maxLength) {
      return characters.slice(0, maxLength).join("");
    } else {
      return value;
    }
  }
  function asTokenArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    } else {
      return [];
    }
  }
  function normalizeColorOrAlias(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return;
    }
    let literal = value.trim().toLowerCase();
    if (isColorLiteral(literal)) {
      return literal;
    }
    let alias = value.trim().replace(/^\{--/, "{");
    if (COLOR_ALIAS_PATTERN.test(alias)) {
      return alias;
    } else {
      return undefined;
    }
  }
  function normalizeColorEditorInput(input: string) {
    let trimmed = input.trim();
    if (colorAliasTarget(trimmed) !== undefined) {
      return trimmed;
    }
    let lowered = trimmed.toLowerCase();
    if (UNPREFIXED_HEX_COLOR_PATTERN.test(lowered)) {
      return "#" + lowered;
    } else {
      return lowered;
    }
  }
  function normalizeCssLength(
    value: unknown,
    allowFullRadius: boolean,
  ): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      if (Math.abs(value) >= 1e4) {
        return;
      }
      if (value === 0) {
        return "0";
      } else {
        return String(Math.round(value * 1000) / 1000) + "px";
      }
    }
    if (typeof value !== "string") {
      return;
    }
    let normalized = value.trim().toLowerCase();
    if (allowFullRadius && normalized === "full") {
      return "9999px";
    }
    if (isCssLength(normalized)) {
      return normalized;
    } else {
      return undefined;
    }
  }
  function normalizeFontWeight(value: unknown): string | undefined {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 1000
    ) {
      return String(value);
    }
    if (typeof value !== "string") {
      return;
    }
    let normalized = value.trim().replace(/\s+/g, " ");
    if (normalized === "normal") {
      return "400";
    }
    if (normalized === "bold") {
      return "700";
    }
    if (FONT_WEIGHT_PATTERN.test(normalized)) {
      return normalized;
    } else {
      return undefined;
    }
  }
  function normalizeLineHeight(value: unknown): string | undefined {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0 &&
      value < 10
    ) {
      return String(Math.round(value * 1000) / 1000);
    }
    if (typeof value === "string" && /^\d(?:\.\d{1,6})?$/.test(value.trim())) {
      if (Number(value) > 0) {
        return value.trim();
      } else {
        return undefined;
      }
    }
    return normalizeCssLength(value, false);
  }
  function normalizeTypographyProperty<K extends Core.TypographyProperty>(
    property: K,
    value: unknown,
    families: Record<string, string>,
  ): Model.TypographyStyle[K] | undefined;
  function normalizeTypographyProperty(
    property: string,
    value: unknown,
    families: Record<string, string>,
  ) {
    let trimmed = typeof value === "string" ? value.trim() : value;
    switch (property) {
      case "fontSize":
        return normalizeCssLength(trimmed, false);
      case "lineHeight":
        return normalizeLineHeight(trimmed);
      case "fontWeight":
        return normalizeFontWeight(trimmed);
      case "letterSpacing": {
        let value2 = trimmed === "" ? "0" : normalizeCssLength(trimmed, false);
        if (typeof value2 === "string" && value2.endsWith("%")) {
          return undefined;
        } else {
          return value2;
        }
      }
      case "fontStyle":
        if (trimmed === "italic" || trimmed === "normal") {
          return trimmed;
        } else {
          return undefined;
        }
      case "opticalSize": {
        if (
          trimmed === null ||
          trimmed === "" ||
          trimmed === "auto" ||
          trimmed === "none"
        ) {
          return null;
        }
        let value2 =
          typeof trimmed === "number"
            ? trimmed
            : typeof trimmed === "string" &&
                /^\d{1,4}(?:\.\d{1,3})?$/.test(trimmed)
              ? Number(trimmed)
              : NaN;
        if (Number.isFinite(value2) && value2 >= 1 && value2 <= 1000) {
          return value2;
        } else {
          return undefined;
        }
      }
      case "family": {
        let value2 = typeof trimmed === "string" ? trimmed.toLowerCase() : "";
        if (value2 === "" || Object.hasOwn(families, value2)) {
          return value2;
        } else {
          return undefined;
        }
      }
    }
  }
  function parseTokens(
    input: unknown,
    report: ParseReport = {
      dropped: [],
      warnings: [],
    },
  ): NormalizedTokens {
    let source: Record<string, unknown> = {};
    if (typeof input === "string") {
      try {
        let value: unknown = JSON.parse(input);
        if (isTokenObject(value)) {
          source = value;
        } else {
          report.dropped.push("tokens.json: not a JSON object");
        }
      } catch (value) {
        if (input.trim() !== "") {
          report.dropped.push(
            "tokens.json: " + String((value as Error).message).slice(0, 120),
          );
        }
      }
    } else if (isTokenObject(input)) {
      source = input;
    }
    let sourceColor = isTokenObject(source.color) ? source.color : {},
      themes: Model.ColorTheme[] = [],
      themeIds = new Set<string>();
    for (let value of asTokenArray(sourceColor.themes)) {
      if (themes.length >= MAX_COLOR_THEMES) {
        break;
      }
      let value2 =
        isTokenObject(value) && typeof value.id === "string"
          ? value.id.trim().toLowerCase()
          : typeof value === "string"
            ? value.trim().toLowerCase()
            : "";
      if (
        !TOKEN_NAME_PATTERN.test(value2) ||
        themeIds.has(value2) ||
        value2 === "constructor" ||
        value2 === "prototype" ||
        Object.hasOwn(Object.prototype, value2)
      ) {
        report.dropped.push(
          "theme " + JSON.stringify(value2) + ": bad or duplicate id",
        );
        continue;
      }
      themeIds.add(value2);
      themes.push({
        id: value2,
        name:
          truncateTokenText(
            isTokenObject(value) ? value.name : "",
            MAX_TOKEN_LABEL_LENGTH,
          ) || value2,
      });
    }
    if (themes.length === 0) {
      themes.push({
        id: "light",
        name: "Light",
      });
    }
    let baseThemeId = themes[0].id,
      colorNames = new Set<string>(),
      colorTokens: Model.ColorToken[] = [],
      sourceColorTokens = Array.isArray(sourceColor.tokens)
        ? asTokenArray(sourceColor.tokens)
        : asTokenArray(sourceColor.groups).flatMap((input2) =>
            isTokenObject(input2) ? asTokenArray(input2.tokens) : [],
          );
    if (
      Array.isArray(sourceColor.tokens) &&
      Array.isArray(sourceColor.groups)
    ) {
      report.warnings.push(
        'tokens.json color has both "tokens" and a legacy "groups" — only "tokens" is read',
      );
    }
    for (let value of sourceColorTokens) {
      if (colorTokens.length >= MAX_COLOR_TOKENS) {
        report.warnings.push(
          "color tokens capped at " +
            String(MAX_COLOR_TOKENS) +
            " — the rest are ignored",
        );
        break;
      }
      if (!isTokenObject(value)) {
        continue;
      }
      let value2 =
        typeof value.name === "string"
          ? value.name.trim().replace(/^--/, "")
          : "";
      if (!TOKEN_NAME_PATTERN.test(value2) || colorNames.has(value2)) {
        report.dropped.push(
          "color " + JSON.stringify(value2) + ": bad or duplicate name",
        );
        continue;
      }
      let state: Record<string, string> = {};
      if (isTokenObject(value.value)) {
        for (let value3 of themes) {
          let value4 = Object.hasOwn(value.value, value3.id)
            ? normalizeThemeColorValue(value.value[value3.id])
            : undefined;
          if (value4 !== undefined) {
            state[value3.id] = value4;
          } else if (Object.hasOwn(value.value, value3.id)) {
            report.dropped.push(
              "color " + value2 + " [" + value3.id + "]: not a color value",
            );
          }
        }
      } else {
        let value3 = normalizeThemeColorValue(value.value);
        if (value3 !== undefined) {
          state[baseThemeId] = value3;
        }
      }
      if (!Object.hasOwn(state, baseThemeId)) {
        let value3 = themes
          .map((input2) =>
            Object.hasOwn(state, input2.id) ? state[input2.id] : undefined,
          )
          .find((input2): boolean => input2 !== undefined);
        if (value3 === undefined) {
          report.dropped.push("color " + value2 + ": no valid value");
          continue;
        }
        state[baseThemeId] = value3;
      }
      colorNames.add(value2);
      colorTokens.push({
        name: value2,
        value: state,
        usage: truncateTokenText(value.usage, MAX_TOKEN_USAGE_LENGTH),
      });
    }
    removeInvalidColorAliases(themes, colorTokens, report);
    let sourceType = isTokenObject(source.type) ? source.type : {},
      fonts: Model.FontFace[] = [],
      sourceFonts = asTokenArray(sourceType.fonts),
      fontsExamined: number = 0;
    for (let value of sourceFonts) {
      if (fonts.length >= MAX_PARSED_FONT_FACES) {
        break;
      }
      fontsExamined++;
      if (!isTokenObject(value)) {
        continue;
      }
      let value2 = truncateTokenText(
          value.family,
          MAX_TOKEN_LABEL_LENGTH,
        ).trim(),
        value3 = typeof value.file === "string" ? value.file.trim() : "";
      if (value2 === "" || !isSafeFontStack(value2) || /["']/.test(value2)) {
        report.dropped.push(
          "font " + JSON.stringify(value3) + ": bad family name",
        );
        continue;
      }
      let value4 = value3.includes("/") ? value3 : "fonts/" + value3;
      if (
        value3 === "" ||
        !(0, runtime.isValidDesignSystemPath)(value4) ||
        /^[a-z][a-z0-9+.-]*:/i.test(value3)
      ) {
        report.dropped.push(
          "font " +
            JSON.stringify(value2) +
            ": bad file path (a relative path into the file table, e.g. fonts/Name.woff2)",
        );
        continue;
      }
      let value5 = normalizeFontWeight(value.weight) ?? "400",
        value6: Model.FontFace["style"] =
          value.style === "italic" || value.style === "oblique"
            ? value.style
            : "normal";
      fonts.push({
        family: value2,
        file: value4,
        weight: value5,
        style: value6,
      });
    }
    let unreadFonts = sourceFonts.slice(fontsExamined);
    if (unreadFonts.length > 0) {
      (report.notes ??= []).push(
        "tokens.json type.fonts: " +
          String(unreadFonts.length) +
          (unreadFonts.length === 1
            ? " entry after the first " +
              String(MAX_PARSED_FONT_FACES) +
              " fonts is"
            : " entries after the first " +
              String(MAX_PARSED_FONT_FACES) +
              " fonts are") +
          " kept in the file but not read; remove fonts until the list holds " +
          String(MAX_PARSED_FONT_FACES) +
          " or fewer",
      );
    }
    let families: Record<string, string> = {};
    if (isTokenObject(sourceType.families)) {
      let index: number = 0;
      for (let value of Object.keys(sourceType.families)) {
        if (index >= MAX_FONT_FAMILIES) {
          break;
        }
        let value2 = value.trim().toLowerCase(),
          value3 = sourceType.families[value];
        if (
          !TOKEN_NAME_PATTERN.test(value2) ||
          typeof value3 !== "string" ||
          !isSafeFontStack(value3.trim())
        ) {
          report.dropped.push(
            "font family " + JSON.stringify(value) + ": bad key or stack",
          );
          continue;
        }
        families[value2] = value3.trim();
        index++;
      }
    }
    let styleNames = new Set<string>(),
      styleCount: number = 0,
      typographyGroups: Model.TypographyGroup[] = [];
    for (let value of asTokenArray(sourceType.groups)) {
      if (typographyGroups.length >= MAX_TYPOGRAPHY_GROUPS) {
        break;
      }
      if (!isTokenObject(value)) {
        continue;
      }
      let value2 =
          typeof value.family === "string" &&
          Object.hasOwn(families, value.family.trim().toLowerCase())
            ? value.family.trim().toLowerCase()
            : "",
        items: Model.TypographyStyle[] = [];
      for (let value3 of asTokenArray(value.styles)) {
        if (styleCount >= MAX_TYPOGRAPHY_STYLES) {
          break;
        }
        if (!isTokenObject(value3)) {
          continue;
        }
        let value4 =
          typeof value3.name === "string"
            ? value3.name.trim().replace(/^\./, "")
            : "";
        if (!TOKEN_NAME_PATTERN.test(value4) || styleNames.has(value4)) {
          report.dropped.push(
            "type style " + JSON.stringify(value4) + ": bad or duplicate name",
          );
          continue;
        }
        let value5 = normalizeCssLength(value3.fontSize, false);
        if (value5 === undefined) {
          report.dropped.push("type style " + value4 + ": bad fontSize");
          continue;
        }
        let value6 = normalizeLineHeight(value3.lineHeight) ?? "1.4",
          value7 =
            typeof value3.family === "string" &&
            Object.hasOwn(families, value3.family.trim().toLowerCase())
              ? value3.family.trim().toLowerCase()
              : "";
        items.push({
          name: value4,
          fontSize: value5,
          lineHeight: value6,
          fontWeight: normalizeFontWeight(value3.fontWeight) ?? "400",
          letterSpacing: normalizeCssLength(value3.letterSpacing, false) ?? "0",
          fontStyle: value3.fontStyle === "italic" ? "italic" : "normal",
          opticalSize:
            normalizeTypographyProperty(
              "opticalSize",
              value3.opticalSize,
              families,
            ) ?? null,
          family: value7,
          sample: truncateTokenText(
            value3.sample,
            MAX_TYPE_SAMPLE_LENGTHModelTokens,
          ),
          usage: truncateTokenText(value3.usage, MAX_TOKEN_USAGE_LENGTH),
        });
        styleNames.add(value4);
        styleCount++;
      }
      typographyGroups.push({
        name: truncateTokenText(value.name, MAX_TOKEN_LABEL_LENGTH) || "Type",
        family: value2,
        note: truncateTokenText(value.note, MAX_TOKEN_NOTE_LENGTH),
        styles: items,
      });
    }
    let tokenFamiliesByName = new Map(
      colorTokens.map((input2) => [input2.name, "color"]),
    );
    function parseScalarFamily<Value extends string | Record<string, string>>(
      input2: unknown,
      options: string,
      context: (value: unknown, name: string) => Value | undefined,
    ): Model.TokenFamily<{ name: string; value: Value; usage: string }> {
      let value = isTokenObject(input2) ? input2 : {},
        items: { name: string; value: Value; usage: string }[] = [];
      for (let value2 of asTokenArray(value.tokens)) {
        if (items.length >= MAX_TOKENS_PER_FAMILY) {
          break;
        }
        if (!isTokenObject(value2)) {
          continue;
        }
        let value3 =
            typeof value2.name === "string"
              ? value2.name.trim().replace(/^--/, "")
              : "",
          entry = tokenFamiliesByName.get(value3);
        if (!TOKEN_NAME_PATTERN.test(value3) || entry === options) {
          report.dropped.push(
            options + " " + JSON.stringify(value3) + ": bad or duplicate name",
          );
          continue;
        }
        if (entry !== undefined) {
          report.dropped.push(
            options +
              " " +
              value3 +
              ": a " +
              entry +
              " token already has that name (one --" +
              value3 +
              " across every family)",
          );
          continue;
        }
        let value4 = context(value2.value, value3);
        if (value4 === undefined) {
          report.dropped.push(options + " " + value3 + ": bad value");
          continue;
        }
        tokenFamiliesByName.set(value3, options);
        items.push({
          name: value3,
          value: value4,
          usage: truncateTokenText(value2.usage, MAX_TOKEN_USAGE_LENGTH),
        });
      }
      return {
        note: truncateTokenText(value.note, MAX_TOKEN_NOTE_LENGTH),
        tokens: items,
      };
    }
    let parseShadowValue = (input2: unknown, options: string) => {
        let state: Record<string, string> = {};
        if (isTokenObject(input2)) {
          for (let value of themes) {
            if (!Object.hasOwn(input2, value.id)) {
              continue;
            }
            let value2 = normalizeBoxShadow(input2[value.id]);
            if (value2 !== undefined) {
              state[value.id] = value2;
            } else {
              report.dropped.push(
                "shadow " +
                  options +
                  " [" +
                  value.id +
                  "]: not a box-shadow value",
              );
            }
          }
        } else {
          let value = normalizeBoxShadow(input2);
          if (value !== undefined) {
            state[baseThemeId] = value;
          }
        }
        if (!Object.hasOwn(state, baseThemeId)) {
          let value = themes.find((input3) => Object.hasOwn(state, input3.id));
          if (value === undefined) {
            return;
          }
          state[baseThemeId] = state[value.id];
          delete state[value.id];
        }
        return state;
      },
      spacing = parseScalarFamily(source.spacing, "spacing", (input2) =>
        normalizeCssLength(input2, false),
      ),
      radius = parseScalarFamily(source.radius, "radius", (input2) =>
        normalizeCssLength(input2, true),
      ),
      shadow = parseScalarFamily(source.shadow, "shadow", parseShadowValue),
      extra: Model.ExtraTokenFamily[] = [],
      kept: Record<string, unknown> = {};
    for (let value of ["shadow"]) {
      if (
        Object.hasOwn(source, value) &&
        !(isTokenObject(source[value]) && Array.isArray(source[value].tokens))
      ) {
        (report.notes ??= []).push(
          "tokens.json " +
            JSON.stringify(value) +
            ' is not shaped {"tokens":[{name,value,usage}]} — kept in the file, not shown',
        );
        defineOwnEnumerableProperty(kept, value, source[value]);
      }
    }
    for (let value of Object.keys(source)) {
      if (BUILTIN_TOKEN_DOCUMENT_KEYS.includes(value)) {
        continue;
      }
      let value2 = source[value];
      if (value === "name" && typeof value2 === "string") {
        defineOwnEnumerableProperty(kept, value, value2);
        continue;
      }
      if (
        !EXTRA_TOKEN_FAMILY_PATTERN.test(value) ||
        !isTokenObject(value2) ||
        !Array.isArray(value2.tokens)
      ) {
        (report.notes ??= []).push(
          "tokens.json " +
            JSON.stringify(value.slice(0, 40)) +
            ' is not a token family ({"tokens":[{name,value,usage}]}) — kept in the file, not shown',
        );
        defineOwnEnumerableProperty(kept, value, value2);
        continue;
      }
      if (extra.length >= MAX_EXTRA_TOKEN_FAMILIES) {
        (report.notes ??= []).push(
          "token families beyond the built-in ones are capped at " +
            String(MAX_EXTRA_TOKEN_FAMILIES) +
            " — " +
            JSON.stringify(value) +
            " kept in the file, not shown",
        );
        defineOwnEnumerableProperty(kept, value, value2);
        continue;
      }
      extra.push({
        key: value,
        ...parseScalarFamily(
          value2,
          value,
          value === "motion"
            ? (input2) =>
                normalizeMotionValue(input2) ?? normalizeExtraTokenValue(input2)
            : normalizeExtraTokenValue,
        ),
      });
    }
    return {
      version: 1,
      color: {
        themes: themes,
        tokens: colorTokens,
      },
      type: {
        fonts: fonts,
        families: families,
        groups: typographyGroups,
        ...(unreadFonts.length > 0
          ? {
              unreadFonts: unreadFonts,
            }
          : {}),
      },
      spacing: spacing,
      radius: radius,
      shadow: shadow,
      extra: extra,
      kept: kept,
    };
  }
  function explainColorAliasError(
    token: Model.ColorToken,
    themeId: string,
    baseThemeId: string,
    tokensByName: Map<string, Model.ColorToken>,
  ) {
    let seenNames = new Set([token.name]),
      currentToken = token;
    for (let index: number = 0; index <= MAX_COLOR_ALIAS_DEPTH; index++) {
      let value = colorAliasTarget(
        currentToken.value[themeId] ?? currentToken.value[baseThemeId],
      );
      if (value === undefined) {
        return;
      }
      let entry = tokensByName.get(value);
      if (entry === undefined) {
        return {
          why:
            (index === 0 ? "" : "reaches {" + value + "}, which ") +
            "names no color token",
          own: index === 0,
        };
      }
      if (seenNames.has(value)) {
        return {
          why: "is a cycle",
          own: value === token.name,
        };
      }
      seenNames.add(value);
      currentToken = entry;
    }
    return {
      why: "chains deeper than " + String(MAX_COLOR_ALIAS_DEPTH),
      own: true,
    };
  }
  function removeInvalidColorAliases(
    themes: Model.ColorTheme[],
    tokens: Model.ColorToken[],
    report: ParseReport,
  ): void {
    let baseThemeId = themes[0].id;
    for (;;) {
      let entries = new Map(tokens.map((input) => [input.name, input])),
        items: [Model.ColorToken, string, string, boolean][] = [];
      for (let value2 of tokens) {
        for (let value3 of themes) {
          if (colorAliasTarget(value2.value[value3.id]) === undefined) {
            continue;
          }
          let value4 = explainColorAliasError(
            value2,
            value3.id,
            baseThemeId,
            entries,
          );
          if (value4 !== undefined) {
            items.push([value2, value3.id, value4.why, value4.own]);
          }
        }
      }
      if (items.length === 0) {
        return;
      }
      let value = items.some((input) => input[3]);
      for (let [value2, value3, value4, value5] of items) {
        if (value && !value5) {
          continue;
        }
        report.dropped.push(
          "color " +
            value2.name +
            " [" +
            value3 +
            "]: " +
            String(value2.value[value3]) +
            " " +
            value4,
        );
        delete value2.value[value3];
      }
      for (let index: number = 0; index < tokens.length; index++) {
        let value2 = tokens[index];
        if (Object.hasOwn(value2.value, baseThemeId)) {
          continue;
        }
        let value3 = themes.find((input) =>
          Object.hasOwn(value2.value, input.id),
        );
        if (value3 === undefined) {
          report.dropped.push("color " + value2.name + ": no valid value");
          tokens.splice(index--, 1);
        } else {
          value2.value[baseThemeId] = value2.value[value3.id];
          delete value2.value[value3.id];
        }
      }
    }
  }
  function serializeTokens(tokens: NormalizedTokens): string {
    let { shadow: shadow, extra: extra, kept: kept, ...builtin } = tokens,
      { unreadFonts: unreadFonts, ...type } = builtin.type,
      serialized: Record<string, unknown> = {
        ...builtin,
        type:
          unreadFonts === undefined
            ? type
            : {
                ...type,
                fonts: [...type.fonts, ...unreadFonts],
              },
      };
    if (shadow.tokens.length > 0) {
      serialized.shadow = shadow;
    }
    for (let value of extra) {
      if (value.tokens.length > 0) {
        serialized[value.key] = {
          note: value.note,
          tokens: value.tokens,
        };
      }
    }
    for (let value of Object.keys(kept)) {
      if (!Object.hasOwn(serialized, value)) {
        defineOwnEnumerableProperty(serialized, value, kept[value]);
      }
    }
    return (
      JSON.stringify(serialized, null, 2) +
      `
`
    );
  }
  function allColorTokens(tokens: NormalizedTokens) {
    return tokens.color.tokens;
  }
  function allTypographyStyles(tokens: NormalizedTokens) {
    return tokens.type.groups.flatMap((input) => input.styles);
  }
  function allExtraTokens(tokens: NormalizedTokens) {
    return tokens.extra.flatMap((input) => input.tokens);
  }
  function tokenNamesForFamily(
    tokens: NormalizedTokens,
    family: Core.TokenKind,
  ) {
    if (family === "type") {
      return allTypographyStyles(tokens).map((input) => input.name);
    }
    if (family === "extra") {
      return allExtraTokens(tokens).map((input) => input.name);
    }
    return tokens[family].tokens.map((input) => input.name);
  }
  function conflictingTokenNames(
    tokens: NormalizedTokens,
    family: Core.TokenKind,
  ) {
    if (family === "type") {
      return tokenNamesForFamily(tokens, "type");
    } else {
      return CSS_VARIABLE_TOKEN_FAMILIES.flatMap((input) =>
        tokenNamesForFamily(tokens, input),
      );
    }
  }
  function shadowValueForTheme(
    token: Model.ShadowToken,
    themeId: string,
    tokens: NormalizedTokens,
  ) {
    let baseThemeId = tokens.color.themes[0].id;
    if (Object.hasOwn(token.value, themeId)) {
      return token.value[themeId];
    } else {
      return token.value[baseThemeId];
    }
  }
  function colorValueForThemeModelTokens(
    token: Model.ColorToken,
    themeId: string,
    tokens: NormalizedTokens,
  ) {
    let baseThemeId = tokens.color.themes[0].id;
    if (Object.hasOwn(token.value, themeId)) {
      return token.value[themeId];
    } else {
      return token.value[baseThemeId];
    }
  }
  function colorTokenIndex(tokens: NormalizedTokens) {
    let index = colorTokenIndexCache.get(tokens.color.tokens);
    if (index === undefined) {
      index = new Map(tokens.color.tokens.map((input) => [input.name, input]));
      colorTokenIndexCache.set(tokens.color.tokens, index);
    }
    return index;
  }
  function resolveColorTokenValue(
    token: Model.ColorToken,
    themeId: string,
    tokens: NormalizedTokens,
  ) {
    let index = colorTokenIndex(tokens),
      value: string | undefined = colorValueForThemeModelTokens(
        token,
        themeId,
        tokens,
      );
    for (let index2: number = 0; index2 <= index.size; index2++) {
      let value2 = colorAliasTarget(value);
      if (value2 === undefined) {
        return value;
      }
      let entry = index.get(value2);
      value =
        entry === undefined
          ? undefined
          : colorValueForThemeModelTokens(entry, themeId, tokens);
    }
    return;
  }
  function detectColorAliasCycle(
    tokens: NormalizedTokens,
    name: string,
    themeId: string,
    proposedValue: string,
  ): {theme: string; via: string[] | "deep"} | undefined {
    let themes = tokens.color.themes,
      baseThemeId = themes[0]?.id ?? "";
    if (proposedValue !== "" && colorAliasTarget(proposedValue) === undefined) {
      return;
    }
    let index = colorTokenIndex(tokens),
      token = index.get(name),
      value = proposedValue !== "" ? proposedValue : token?.value[baseThemeId],
      inheritingThemes =
        proposedValue !== "" && themeId === baseThemeId && token !== undefined
          ? themes
              .filter(
                (input) =>
                  input.id !== baseThemeId &&
                  token.value[input.id] === undefined,
              )
              .map((input) => input.id)
          : [];
    for (let value2 of [themeId, ...inheritingThemes]) {
      let items: string[] = [],
        value3 = colorAliasTarget(value);
      for (
        let index2: number = 0;
        index2 < MAX_COLOR_ALIAS_DEPTH &&
        value3 !== undefined &&
        value3 !== name;
        index2++
      ) {
        let value4 = items.includes(value3) ? undefined : index.get(value3);
        if (value4 === undefined) {
          value3 = undefined;
        } else {
          items.push(value3);
          value3 = colorAliasTarget(
            value4.value[value2] ?? value4.value[baseThemeId],
          );
        }
      }
      if (value3 !== undefined) {
        return {
          theme: value2,
          via: value3 === name ? items : "deep",
        };
      }
    }
    return;
  }
  function typographyStyleFamily(
    style: Model.TypographyStyle,
    group: Model.TypographyGroup,
  ) {
    if (style.family !== "") {
      return style.family;
    } else {
      return group.family;
    }
  }
  function typographyShorthandVariables(tokens: NormalizedTokens) {
    let occupiedNames = new Set(
        conflictingTokenNames(tokens, "color").map(escapeTokenCssIdentifier),
      ),
      variables = new Map<string, string>();
    for (let value of tokens.type.groups) {
      for (let value2 of value.styles) {
        let value3: string = "text-" + escapeTokenCssIdentifier(value2.name);
        if (!occupiedNames.has(value3)) {
          variables.set(value2.name, "--" + value3);
        }
      }
    }
    return variables;
  }
  function escapeTokenCssIdentifier(name: string): string {
    let escaped = name.replace(/\./g, "\\.");
    if (/^[0-9]/.test(escaped)) {
      escaped = "\\3" + escaped[0] + " " + escaped.slice(1);
    }
    return escaped;
  }
  function escapeTokenCssComment(usage: string) {
    return usage
      .replace(/\*\//g, "* /")
      .replace(/<\//g, "< /")
      .replace(/[\r\n\f]+/g, " ")
      .trim();
  }
  function generateTokensCss(
    tokens: NormalizedTokens,
    options: TokenCssOptions = {},
  ): string {
    let rules = [],
      themes = tokens.color.themes,
      baseThemeId = themes[0].id,
      colors = allColorTokens(tokens),
      shadows = tokens.shadow.tokens,
      usageComment = (input: string): string =>
        options.usageComments === true && input !== ""
          ? " /* " + escapeTokenCssComment(input) + " */"
          : "",
      colorDeclaration = (
        input: Model.ColorToken,
        options2: string,
        context: boolean,
      ): string => {
        let value = colorAliasTarget(options2);
        return (
          "  --" +
          escapeTokenCssIdentifier(input.name) +
          ": " +
          (value !== undefined
            ? "var(--" + escapeTokenCssIdentifier(value) + ")"
            : options2) +
          ";" +
          (context ? usageComment(input.usage) : "")
        );
      },
      scalarDeclaration = (
        input: Model.ScalarToken | Model.ShadowToken,
        options2: string,
        context: boolean,
      ): string =>
        "  --" +
        escapeTokenCssIdentifier(input.name) +
        ": " +
        options2 +
        ";" +
        (context ? usageComment(input.usage) : "");
    if (colors.length > 0 || shadows.length > 0) {
      rules.push(':root, [data-theme="' + baseThemeId + '"] {');
      for (let value of colors) {
        rules.push(colorDeclaration(value, value.value[baseThemeId], true));
      }
      for (let value of shadows) {
        rules.push(scalarDeclaration(value, value.value[baseThemeId], true));
      }
      rules.push("}");
      for (let value of themes.slice(1)) {
        let items = [
          ...colors
            .filter(
              (input) =>
                input.value[value.id] !== undefined ||
                colorAliasTarget(input.value[baseThemeId]) !== undefined,
            )
            .map((input) =>
              colorDeclaration(
                input,
                input.value[value.id] ?? input.value[baseThemeId],
                false,
              ),
            ),
          ...shadows
            .filter((input): boolean => input.value[value.id] !== undefined)
            .map((input) =>
              scalarDeclaration(input, input.value[value.id], false),
            ),
        ];
        if (items.length > 0) {
          rules.push('[data-theme="' + value.id + '"] {', ...items, "}");
        }
      }
    }
    let rootVariables = [];
    for (let value of tokens.spacing.tokens) {
      rootVariables.push(
        "  --" +
          escapeTokenCssIdentifier(value.name) +
          ": " +
          value.value +
          ";" +
          usageComment(value.usage),
      );
    }
    for (let value of tokens.radius.tokens) {
      rootVariables.push(
        "  --" +
          escapeTokenCssIdentifier(value.name) +
          ": " +
          value.value +
          ";" +
          usageComment(value.usage),
      );
    }
    for (let value of allExtraTokens(tokens)) {
      rootVariables.push(
        "  --" +
          escapeTokenCssIdentifier(value.name) +
          ": " +
          value.value +
          ";" +
          usageComment(value.usage),
      );
    }
    for (let [value, value2] of Object.entries(tokens.type.families)) {
      rootVariables.push(
        "  --font-" + escapeTokenCssIdentifier(value) + ": " + value2 + ";",
      );
    }
    if (options.styleVars === true) {
      let value = typographyShorthandVariables(tokens);
      for (let value2 of tokens.type.groups) {
        for (let value3 of value2.styles) {
          let entry = value.get(value3.name);
          if (entry === undefined) {
            continue;
          }
          let value4 = typographyStyleFamily(value3, value2);
          rootVariables.push(
            "  " +
              entry +
              ": " +
              (value3.fontStyle !== "normal" ? value3.fontStyle + " " : "") +
              String(value3.fontWeight) +
              " " +
              value3.fontSize +
              "/" +
              value3.lineHeight +
              (value4 !== ""
                ? " var(--font-" + escapeTokenCssIdentifier(value4) + ")"
                : " inherit") +
              ";" +
              usageComment(value3.usage),
          );
        }
      }
    }
    if (rootVariables.length > 0) {
      rules.push(":root {", ...rootVariables, "}");
    }
    for (let value of tokens.type.groups) {
      for (let value2 of value.styles) {
        let value3 = typographyStyleFamily(value2, value),
          items = [
            ...(value3 !== ""
              ? [
                  "  font-family: var(--font-" +
                    escapeTokenCssIdentifier(value3) +
                    ");",
                ]
              : []),
            "  font-size: " + value2.fontSize + ";",
            "  line-height: " + value2.lineHeight + ";",
            "  font-weight: " + value2.fontWeight + ";",
            "  letter-spacing: " + value2.letterSpacing + ";",
            ...(value2.fontStyle !== "normal"
              ? ["  font-style: " + value2.fontStyle + ";"]
              : []),
            ...(value2.opticalSize !== null
              ? [
                  "  font-variation-settings: 'opsz' " +
                    String(value2.opticalSize) +
                    ";",
                ]
              : []),
          ];
        rules.push(
          "." + escapeTokenCssIdentifier(value2.name) + " {",
          ...items,
          "}",
        );
      }
    }
    if (options.fontFaces !== false) {
      rules.push(...generateFontFaceRules(tokens, options.fontSrc));
    }
    return (
      rules.join(`
`) +
      (rules.length > 0
        ? `
`
        : "")
    );
  }
  function generateFontFaceRules(
    tokens: NormalizedTokens,
    fontSource?: (path: string) => string | null,
  ) {
    let rules = [];
    for (let value of tokens.type.fonts) {
      let value2 = fontSource
        ? fontSource(value.file)
        : (0, runtime.encodeRelativeUrlPath)(value.file);
      if (value2 === null) {
        continue;
      }
      let value3 = value.file
          .slice(value.file.lastIndexOf(".") + 1)
          .toLowerCase(),
        value4 = FONT_FACE_FORMAT_NAMES[value3];
      rules.push(
        "@font-face {",
        '  font-family: "' + value.family + '";',
        '  src: url("' +
          value2.replace(/["\\\n\r\f]/g, "") +
          '")' +
          (value4 !== undefined ? ' format("' + value4 + '")' : "") +
          ";",
        "  font-weight: " + value.weight + ";",
        "  font-style: " + value.style + ";",
        "  font-display: swap;",
        "}",
      );
    }
    return rules;
  }
  function generateFontFacesCss(
    tokens: NormalizedTokens,
    fontSource?: (path: string) => string | null,
  ): string {
    let rules = generateFontFaceRules(tokens, fontSource);
    return (
      rules.join(`
`) +
      (rules.length > 0
        ? `
`
        : "")
    );
  }
  function generateNamedTokensCss(
    tokens: NormalizedTokens,
    name: string,
    fontSource?: (path: string) => string | null,
  ): string {
    return (
      "/* " +
      (name.trim() !== ""
        ? Array.from(name.replace(/\s+/g, " ").trim())
            .slice(0, 200)
            .join("")
            .replace(/\*\//g, "* /")
            .replace(/<\//g, "< /")
        : "Design system") +
      ` — generated from tokens.json */
` +
      generateTokensCss(tokens, {
        usageComments: true,
        styleVars: true,
        fontSrc: fontSource,
      })
    );
  }
  function generatedTokensCssForFiles(files: Model.FileTable) {
    if (!Object.hasOwn(files, runtime.DESIGN_SYSTEM_PATHS.tokens)) {
      return null;
    }
    let manifestName = (0, runtime.parseManifest)(
        files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
      ).name,
      name = typeof manifestName === "string" ? manifestName : "",
      fontSource = (input: string) => {
        let value = (0, runtime.storagePointerForFile)(
          input,
          files[input] ?? "",
        );
        if (value === null) {
          return (0, runtime.encodeRelativeUrlPath)(input);
        } else {
          if (value.store === "blob") {
            return (0, runtime.blobRelativeUrlModelFilePolicy)(value.id);
          } else {
            return (0, runtime.encodeRelativeUrlPath)(
              value.rel === "" ? input : value.rel,
            );
          }
        }
      },
      tokensText = files[runtime.DESIGN_SYSTEM_PATHS.tokens],
      fontCacheKey = Object.keys(files)
        .filter((input) =>
          input.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir),
        )
        .sort()
        .map(
          (input): string =>
            input +
            "=" +
            ((0, runtime.storagePointerForFile)(input, files[input]) !== null
              ? files[input]
              : "inline"),
        ).join(`
`);
    if (
      cachedGeneratedTokensCss !== null &&
      cachedGeneratedTokensCss.tokens === tokensText &&
      cachedGeneratedTokensCss.name === name &&
      cachedGeneratedTokensCss.fonts === fontCacheKey
    ) {
      return cachedGeneratedTokensCss.css;
    }
    let generatedCss = generateNamedTokensCss(
        parseTokens(tokensText),
        name,
        fontSource,
      ),
      safeCss =
        generatedCss.includes(String.fromCharCode(65533)) ||
        generatedCss.includes("</")
          ? null
          : generatedCss;
    cachedGeneratedTokensCss = {
      tokens: tokensText,
      name: name,
      fonts: fontCacheKey,
      css: safeCss,
    };
    return safeCss;
  }
  function tokensJsonWithManifestName(files: Model.FileTable) {
    let tokensText = files[runtime.DESIGN_SYSTEM_PATHS.tokens];
    if (tokensText === undefined) {
      return null;
    }
    let name = truncateTokenText(
      (0, runtime.parseManifest)(
        files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
      ).name,
      MAX_TOKEN_LABEL_LENGTH,
    ).trim();
    if (name === "" || name.includes(String.fromCharCode(65533))) {
      return tokensText;
    }
    try {
      let value: unknown = JSON.parse(tokensText);
      if (
        !isTokenObject(value) ||
        value.name === name ||
        (value.name !== undefined && typeof value.name !== "string")
      ) {
        return tokensText;
      }
      let { name: value2, ...value3 } = value,
        value4: string =
          JSON.stringify(
            {
              name: name,
              ...value3,
            },
            null,
            2,
          ) +
          `
`;
      if (value4.includes(String.fromCharCode(65533))) {
        return tokensText;
      } else {
        return value4;
      }
    } catch {
      return tokensText;
    }
  }
  bindRuntimeValue(
    runtime,
    "defineOwnEnumerableProperty",
    () => defineOwnEnumerableProperty,
  );
  bindRuntimeValue(
    runtime,
    "TOKEN_NAME_PATTERN",
    () => TOKEN_NAME_PATTERN,
    (value) => {
      TOKEN_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HEX_COLOR_PATTERN",
    () => HEX_COLOR_PATTERN,
    (value) => {
      HEX_COLOR_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_ALIAS_PATTERN",
    () => COLOR_ALIAS_PATTERN,
    (value) => {
      COLOR_ALIAS_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXTRA_TOKEN_FAMILY_PATTERN",
    () => EXTRA_TOKEN_FAMILY_PATTERN,
    (value) => {
      EXTRA_TOKEN_FAMILY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUILTIN_TOKEN_DOCUMENT_KEYS",
    () => BUILTIN_TOKEN_DOCUMENT_KEYS,
    (value) => {
      BUILTIN_TOKEN_DOCUMENT_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COLOR_ALIAS_DEPTH",
    () => MAX_COLOR_ALIAS_DEPTH,
    (value) => {
      MAX_COLOR_ALIAS_DEPTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_FUNCTION_PATTERN",
    () => COLOR_FUNCTION_PATTERN,
    (value) => {
      COLOR_FUNCTION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CSS_LENGTH_PATTERN",
    () => CSS_LENGTH_PATTERN,
    (value) => {
      CSS_LENGTH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_WEIGHT_PATTERN",
    () => FONT_WEIGHT_PATTERN,
    (value) => {
      FONT_WEIGHT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_STACK_PATTERN",
    () => FONT_STACK_PATTERN,
    (value) => {
      FONT_STACK_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "isSafeFontStack", () => isSafeFontStack);
  bindRuntimeValue(
    runtime,
    "MAX_COLOR_THEMES",
    () => MAX_COLOR_THEMES,
    (value) => {
      MAX_COLOR_THEMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COLOR_TOKENS",
    () => MAX_COLOR_TOKENS,
    (value) => {
      MAX_COLOR_TOKENS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PARSED_FONT_FACES",
    () => MAX_PARSED_FONT_FACES,
    (value) => {
      MAX_PARSED_FONT_FACES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FONT_FAMILIES",
    () => MAX_FONT_FAMILIES,
    (value) => {
      MAX_FONT_FAMILIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPOGRAPHY_GROUPS",
    () => MAX_TYPOGRAPHY_GROUPS,
    (value) => {
      MAX_TYPOGRAPHY_GROUPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPOGRAPHY_STYLES",
    () => MAX_TYPOGRAPHY_STYLES,
    (value) => {
      MAX_TYPOGRAPHY_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TOKENS_PER_FAMILY",
    () => MAX_TOKENS_PER_FAMILY,
    (value) => {
      MAX_TOKENS_PER_FAMILY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_EXTRA_TOKEN_FAMILIES",
    () => MAX_EXTRA_TOKEN_FAMILIES,
    (value) => {
      MAX_EXTRA_TOKEN_FAMILIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TOKEN_LABEL_LENGTH",
    () => MAX_TOKEN_LABEL_LENGTH,
    (value) => {
      MAX_TOKEN_LABEL_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TOKEN_NOTE_LENGTH",
    () => MAX_TOKEN_NOTE_LENGTH,
    (value) => {
      MAX_TOKEN_NOTE_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TOKEN_USAGE_LENGTH",
    () => MAX_TOKEN_USAGE_LENGTH,
    (value) => {
      MAX_TOKEN_USAGE_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TYPE_SAMPLE_LENGTHModelTokens",
    () => MAX_TYPE_SAMPLE_LENGTHModelTokens,
    (value) => {
      MAX_TYPE_SAMPLE_LENGTHModelTokens = value;
    },
  );
  bindRuntimeValue(runtime, "isColorLiteral", () => isColorLiteral);
  bindRuntimeValue(runtime, "isCssLength", () => isCssLength);
  bindRuntimeValue(
    runtime,
    "BOX_SHADOW_PATTERN",
    () => BOX_SHADOW_PATTERN,
    (value) => {
      BOX_SHADOW_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "isSafeBoxShadow", () => isSafeBoxShadow);
  bindRuntimeValue(runtime, "normalizeBoxShadow", () => normalizeBoxShadow);
  bindRuntimeValue(
    runtime,
    "MOTION_DURATION_PATTERN",
    () => MOTION_DURATION_PATTERN,
    (value) => {
      MOTION_DURATION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MOTION_EASING_PATTERN",
    () => MOTION_EASING_PATTERN,
    (value) => {
      MOTION_EASING_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "motionValueKind", () => motionValueKind);
  bindRuntimeValue(runtime, "normalizeMotionValue", () => normalizeMotionValue);
  bindRuntimeValue(
    runtime,
    "EXTRA_TOKEN_VALUE_PATTERN",
    () => EXTRA_TOKEN_VALUE_PATTERN,
    (value) => {
      EXTRA_TOKEN_VALUE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeExtraTokenValue",
    () => normalizeExtraTokenValue,
  );
  bindRuntimeValue(
    runtime,
    "normalizeScalarTokenValue",
    () => normalizeScalarTokenValue,
  );
  bindRuntimeValue(runtime, "colorAliasTarget", () => colorAliasTarget);
  bindRuntimeValue(runtime, "isColorOrAlias", () => isColorOrAlias);
  bindRuntimeValue(
    runtime,
    "isTokenObject",
    () => isTokenObject,
    (value) => {
      isTokenObject = value;
    },
  );
  bindRuntimeValue(runtime, "truncateTokenText", () => truncateTokenText);
  bindRuntimeValue(runtime, "asTokenArray", () => asTokenArray);
  bindRuntimeValue(
    runtime,
    "normalizeColorOrAlias",
    () => normalizeColorOrAlias,
  );
  bindRuntimeValue(
    runtime,
    "normalizeThemeColorValue",
    () => normalizeThemeColorValue,
    (value) => {
      normalizeThemeColorValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNPREFIXED_HEX_COLOR_PATTERN",
    () => UNPREFIXED_HEX_COLOR_PATTERN,
    (value) => {
      UNPREFIXED_HEX_COLOR_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeColorEditorInput",
    () => normalizeColorEditorInput,
  );
  bindRuntimeValue(runtime, "normalizeCssLength", () => normalizeCssLength);
  bindRuntimeValue(runtime, "normalizeFontWeight", () => normalizeFontWeight);
  bindRuntimeValue(runtime, "normalizeLineHeight", () => normalizeLineHeight);
  bindRuntimeValue(
    runtime,
    "normalizeTypographyProperty",
    () => normalizeTypographyProperty,
  );
  bindRuntimeValue(runtime, "parseTokens", () => parseTokens);
  bindRuntimeValue(
    runtime,
    "explainColorAliasError",
    () => explainColorAliasError,
  );
  bindRuntimeValue(
    runtime,
    "removeInvalidColorAliases",
    () => removeInvalidColorAliases,
  );
  bindRuntimeValue(runtime, "serializeTokens", () => serializeTokens);
  bindRuntimeValue(runtime, "allColorTokens", () => allColorTokens);
  bindRuntimeValue(runtime, "allTypographyStyles", () => allTypographyStyles);
  bindRuntimeValue(runtime, "allExtraTokens", () => allExtraTokens);
  bindRuntimeValue(runtime, "tokenNamesForFamily", () => tokenNamesForFamily);
  bindRuntimeValue(
    runtime,
    "CSS_VARIABLE_TOKEN_FAMILIES",
    () => CSS_VARIABLE_TOKEN_FAMILIES,
    (value) => {
      CSS_VARIABLE_TOKEN_FAMILIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "conflictingTokenNames",
    () => conflictingTokenNames,
  );
  bindRuntimeValue(runtime, "shadowValueForTheme", () => shadowValueForTheme);
  bindRuntimeValue(
    runtime,
    "colorValueForThemeModelTokens",
    () => colorValueForThemeModelTokens,
  );
  bindRuntimeValue(
    runtime,
    "colorTokenIndexCache",
    () => colorTokenIndexCache,
    (value) => {
      colorTokenIndexCache = value;
    },
  );
  bindRuntimeValue(runtime, "colorTokenIndex", () => colorTokenIndex);
  bindRuntimeValue(
    runtime,
    "resolveColorTokenValue",
    () => resolveColorTokenValue,
  );
  bindRuntimeValue(
    runtime,
    "detectColorAliasCycle",
    () => detectColorAliasCycle,
  );
  bindRuntimeValue(
    runtime,
    "typographyStyleFamily",
    () => typographyStyleFamily,
  );
  bindRuntimeValue(
    runtime,
    "typographyShorthandVariables",
    () => typographyShorthandVariables,
  );
  bindRuntimeValue(
    runtime,
    "escapeTokenCssIdentifier",
    () => escapeTokenCssIdentifier,
  );
  bindRuntimeValue(
    runtime,
    "FONT_FACE_FORMAT_NAMES",
    () => FONT_FACE_FORMAT_NAMES,
    (value) => {
      FONT_FACE_FORMAT_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "escapeTokenCssComment",
    () => escapeTokenCssComment,
  );
  bindRuntimeValue(runtime, "generateTokensCss", () => generateTokensCss);
  bindRuntimeValue(
    runtime,
    "generateFontFaceRules",
    () => generateFontFaceRules,
  );
  bindRuntimeValue(runtime, "generateFontFacesCss", () => generateFontFacesCss);
  bindRuntimeValue(
    runtime,
    "generateNamedTokensCss",
    () => generateNamedTokensCss,
  );
  bindRuntimeValue(
    runtime,
    "cachedGeneratedTokensCss",
    () => cachedGeneratedTokensCss,
    (value) => {
      cachedGeneratedTokensCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "generatedTokensCssForFiles",
    () => generatedTokensCssForFiles,
  );
  bindRuntimeValue(
    runtime,
    "tokensJsonWithManifestName",
    () => tokensJsonWithManifestName,
  );
  return () => {
    TOKEN_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
    HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
    COLOR_ALIAS_PATTERN = /^\{([A-Za-z0-9][A-Za-z0-9_.-]{0,63})\}$/;
    EXTRA_TOKEN_FAMILY_PATTERN =
      /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z][A-Za-z0-9_-]{0,31}$/;
    BUILTIN_TOKEN_DOCUMENT_KEYS = [
      "version",
      "color",
      "type",
      "spacing",
      "radius",
      "shadow",
    ];
    MAX_COLOR_ALIAS_DEPTH = 16;
    COLOR_FUNCTION_PATTERN =
      /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([0-9a-z.,%/ \-]{1,60}\)$/;
    CSS_LENGTH_PATTERN = /^-?\d{1,4}(?:\.\d{1,6})?(?:px|rem|em|%)$|^0$/;
    FONT_WEIGHT_PATTERN = /^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/;
    FONT_STACK_PATTERN = /^[^;{}<>()\\\r\n\f]{1,200}$/;
    MAX_COLOR_THEMES = 8;
    MAX_COLOR_TOKENS = 600;
    MAX_PARSED_FONT_FACES = 4096;
    MAX_FONT_FAMILIES = 12;
    MAX_TYPOGRAPHY_GROUPS = 12;
    MAX_TYPOGRAPHY_STYLES = 80;
    MAX_TOKENS_PER_FAMILY = 60;
    MAX_EXTRA_TOKEN_FAMILIES = 12;
    MAX_TOKEN_LABEL_LENGTH = 120;
    MAX_TOKEN_NOTE_LENGTH = 400;
    MAX_TOKEN_USAGE_LENGTH = 1000;
    MAX_TYPE_SAMPLE_LENGTHModelTokens = 200;
    BOX_SHADOW_PATTERN = /^[a-z0-9 #%(),./+-]{1,400}$/;
    MOTION_DURATION_PATTERN = /^(?:\d{1,6}(?:\.\d{1,3})?|\.\d{1,3})m?s$/;
    MOTION_EASING_PATTERN =
      /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\([-\d., ]{1,60}\)|steps\([a-z0-9, -]{1,40}\))$/;
    EXTRA_TOKEN_VALUE_PATTERN = /^[A-Za-z0-9 #%(),./+_-]{1,200}$/;
    isTokenObject = (input: unknown): input is Record<string, unknown> =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    normalizeThemeColorValue = normalizeColorOrAlias;
    UNPREFIXED_HEX_COLOR_PATTERN =
      /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
    CSS_VARIABLE_TOKEN_FAMILIES = [
      "color",
      "spacing",
      "radius",
      "shadow",
      "extra",
    ];
    colorTokenIndexCache = new WeakMap();
    FONT_FACE_FORMAT_NAMES = {
      woff2: "woff2",
      woff: "woff",
      ttf: "truetype",
      otf: "opentype",
    };
    cachedGeneratedTokensCss = null;
  };
}
