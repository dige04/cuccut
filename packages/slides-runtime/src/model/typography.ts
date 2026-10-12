/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type {
  DeckContent,
  FontFace,
  FontFamilyValue,
  Slide,
  SlideNode,
  StyleBag,
  TextNode,
  TextRole,
  TextTransformValue,
  ThemeFonts,
} from "../deck-contracts";
import type { DesignSystem, DesignTypeFamily } from "../design-system/tokens";
import type { TypeScaleEntry } from "./type-scales";

/** Theme of a deck; it selects the type scale and whether styles are inferred from the deck. */
export type TypographyTheme = DeckContent["theme"];
/** The typographic properties that identify one text style. */
export interface TypographyCombo {
  role: TextRole;
  fontFamily: FontFamilyValue | undefined;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: TextTransformValue | undefined;
}
/** Where a typography style comes from: the theme type scale, the deck's own text, or a design system. */
export type TypographyStyleSource = "ladder" | "deck" | "system";
/** A named text style offered to the user (theme ladder entry, inferred deck style or design system style). */
export interface TypographyStyle extends TypographyCombo {
  id: string;
  name: string;
  hint: string;
  count: number;
  source: TypographyStyleSource;
  group?: string;
  subgroup?: string;
  title?: string;
}
/** One typographic combination found in a deck together with how often it is used. */
export interface TypographyUsage {
  combo: TypographyCombo;
  count: number;
  roles: Map<TextRole, number>;
  weights: Map<number, number>;
  italics: Map<boolean, number>;
}
/** The style that exactly or approximately matches a set of text nodes, and whether the nodes disagree. */
export interface TypographyNodeMatch {
  style: TypographyStyle | null;
  mixed: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    emptyTypographyStyles: TypographyStyle[];
    systemTypographyStylesCache: Map<TypographyTheme, TypographyStyle[]>;
    inferredBodyRolePriority: readonly TextRole[];
    clampTypographyValue: (value: number, min: number, max: number) => number;
    initializeTypographyInference: () => void;
    typeScaleForRole: (
      role: TextRole,
      theme: TypographyTheme,
    ) => TypeScaleEntry;
    typographyFontKey: (
      font: FontFamilyValue | undefined,
      role: TextRole,
      theme: TypographyTheme,
    ) => string;
    typographyComboKey: (
      combo: TypographyCombo,
      theme: TypographyTheme,
      fontKey?: string,
    ) => string;
    nodeTypographyCombo: (
      node: TextNode,
      theme: TypographyTheme,
    ) => TypographyCombo;
    systemTypographyStyles: (theme: TypographyTheme) => TypographyStyle[];
    iterateDeckTextNodes: (
      slides: Slide[],
    ) => Generator<TextNode, void, undefined>;
    typographyIsEmphasized: (combo: TypographyCombo) => boolean;
    inferTypographyRoles: (
      combo: TypographyCombo,
      headingThreshold: number,
    ) => TextRole[];
    mostFrequentValue: <K>(
      counts: Map<K, number>,
      compare: (a: K, b: K) => number,
    ) => K;
    dominantTypographyCombo: (
      combinations: TypographyUsage[],
      theme: TypographyTheme,
      rank?: (usage: TypographyUsage) => number,
    ) => TypographyUsage | undefined;
    compareTypographyComboKeys: (
      combo: TypographyUsage,
      otherCombo: TypographyUsage,
      theme: TypographyTheme,
    ) => number;
    inferDeckTypographyStyles: (
      slides: Slide[],
      theme: TypographyTheme,
    ) => TypographyStyle[];
    fontFamilyLabel: (font: FontFamilyValue) => string;
    typographyStylesSignature: (
      styles: TypographyStyle[],
      theme: TypographyTheme,
    ) => string;
    nodeTypographyLabel: (node: TextNode, theme: TypographyTheme) => string;
    defaultBodyTypographyStyle: (
      styles: TypographyStyle[],
    ) => TypographyStyle | null;
    typographyEmphasisMatches: (
      combo: TypographyCombo,
      otherCombo: TypographyCombo,
    ) => boolean;
    findTypographyStyle: (
      node: TextNode,
      styles: TypographyStyle[],
      theme: TypographyTheme,
    ) => TypographyStyle | null;
    findExactTypographyStyle: (
      node: TextNode,
      styles: TypographyStyle[],
      theme: TypographyTheme,
    ) => TypographyStyle | null;
    matchingTypographyNodes: (
      node: TextNode,
      slides: TextNode[],
      styles: TypographyStyle[],
      theme: TypographyTheme,
    ) => TypographyNodeMatch;
    clearTypographyOverrides: (
      node: TextNode,
      style: TypographyStyle,
      theme: TypographyTheme,
    ) => TextNode;
    typographyEmphasisVariant: (
      node: TextNode,
      styles: TypographyStyle[],
      theme: TypographyTheme,
    ) => number | undefined;
    resolveNodeTypographyStyle: (
      node: TextNode,
      styles: TypographyStyle[],
      fallbackStyles: TypographyStyle[],
      theme: TypographyTheme,
      exact?: boolean,
    ) => TypographyStyle | undefined;
    resolveTypographyEmphasisVariant: (
      node: TextNode,
      styles: TypographyStyle[],
      fallbackStyles: TypographyStyle[],
      theme: TypographyTheme,
    ) => number | undefined;
    typographyUsesSystemFont: (
      style: TypographyStyle,
      theme: TypographyTheme,
    ) => boolean;
    applyTypographyStyle: (
      node: TextNode,
      style: TypographyStyle,
      theme: TypographyTheme,
    ) => TextNode;
    collectDeckFontFamilies: (
      faces: FontFace[] | undefined,
      families: ThemeFonts | undefined,
    ) => Map<string, string>;
    modelFontFromDesignToken: (
      font: DesignTypeFamily | undefined,
      knownFamilies: Map<string, string>,
    ) => FontFamilyValue | undefined;
    designSystemTypographyStyles: (
      systems: DesignSystem[],
      theme: TypographyTheme,
      knownFamilies?: Map<string, string>,
    ) => TypographyStyle[];
  }
}

export function installModelTypography(runtime: RuntimeBindings): () => void {
  var emptyTypographyStyles: RuntimeBindings["emptyTypographyStyles"];
  var systemTypographyStylesCache: RuntimeBindings["systemTypographyStylesCache"];
  var inferredBodyRolePriority: RuntimeBindings["inferredBodyRolePriority"];
  var clampTypographyValue: RuntimeBindings["clampTypographyValue"];
  var initializeTypographyInference: RuntimeBindings["initializeTypographyInference"];
  function typeScaleForRole(
    role: TextRole,
    theme: TypographyTheme,
  ): TypeScaleEntry {
    return (
      theme === "neutral"
        ? runtime.neutralTypeScale
        : runtime.anthropicTypeScale
    )[role];
  }
  function typographyFontKey(
    font: FontFamilyValue | undefined,
    role: TextRole,
    theme: TypographyTheme,
  ): string {
    if (font === undefined) {
      if (theme === "neutral") {
        return "system";
      } else {
        if (typeScaleForRole(role, theme).serifDisplay) {
          return "theme-serif";
        } else {
          return "theme-sans";
        }
      }
    }
    if (font === "helvetica") {
      return "face:helvetica";
    }
    if (typeof font === "string") {
      return font;
    } else {
      return "face:" + font.family.toLowerCase();
    }
  }
  function typographyComboKey(
    combo: TypographyCombo,
    theme: TypographyTheme,
    fontKey: string = typographyFontKey(combo.fontFamily, combo.role, theme),
  ): string {
    let items: (string | number)[] = [
      fontKey,
      combo.fontSize,
      combo.lineHeight,
    ];
    if (theme === "neutral") {
      items.push(combo.letterSpacing, combo.textTransform ?? "");
    }
    return items
      .join("-")
      .toLowerCase()
      .replace(/\./g, "p")
      .replace(/[^a-z0-9-]+/g, "_")
      .replace(/[-_]+$/, "");
  }
  function nodeTypographyCombo(
    node: TextNode,
    theme: TypographyTheme,
  ): TypographyCombo {
    let value = typeScaleForRole(node.role, theme),
      value2: StyleBag = node.style ?? {};
    return {
      role: node.role,
      fontFamily: value2.fontFamily,
      fontSize: value2.fontSize ?? value.fontSize,
      fontWeight: value2.fontWeight ?? value.fontWeight,
      italic: value2.fontStyle === "italic",
      lineHeight: value2.lineHeight ?? value.lineHeight,
      letterSpacing: value2.letterSpacing ?? 0,
      textTransform:
        value2.textTransform !== undefined && value2.textTransform !== "none"
          ? value2.textTransform
          : undefined,
    };
  }
  function systemTypographyStyles(theme: TypographyTheme): TypographyStyle[] {
    let entry = systemTypographyStylesCache.get(theme);
    if (entry === undefined) {
      entry = (runtime.textRoles as readonly TextRole[]).map(
        (input): TypographyStyle => {
          let value = typeScaleForRole(input, theme);
          return {
            ...{
              role: input,
              fontFamily: undefined,
              fontSize: value.fontSize,
              fontWeight: value.fontWeight,
              italic: false,
              lineHeight: value.lineHeight,
              letterSpacing: 0,
            },
            id: input,
            name: runtime.textRoleLabels[input],
            hint: String(value.fontSize),
            count: 0,
            source: "ladder",
          };
        },
      );
      systemTypographyStylesCache.set(theme, entry);
    }
    return entry;
  }
  function* iterateDeckTextNodes(
    slides: Slide[],
  ): Generator<TextNode, void, undefined> {
    let callback = function* (
      source: SlideNode,
    ): Generator<TextNode, void, undefined> {
      if (source.kind === "text") {
        yield source;
      }
      for (let value of (0, runtime.nodeChildren)(source) ?? [])
        yield* callback(value);
    };
    for (let value of slides)
      for (let value2 of value.frames) yield* callback(value2.node);
  }
  function typographyIsEmphasized(combo: TypographyCombo): boolean {
    return (
      combo.fontWeight >= 600 ||
      combo.textTransform === "uppercase" ||
      combo.letterSpacing > 0
    );
  }
  function inferTypographyRoles(
    combo: TypographyCombo,
    headingThreshold: number,
  ): TextRole[] {
    let value: TextRole =
        combo.fontSize >= 40
          ? "lead"
          : combo.fontSize < 28
            ? "caption"
            : "body",
      value2: TextRole[] =
        combo.fontWeight >= 600 &&
        combo.fontSize > 30 &&
        combo.fontSize < headingThreshold
          ? ["h3"]
          : typographyIsEmphasized(combo) && combo.fontSize <= 30
            ? ["eyebrow"]
            : [];
    return [...new Set<TextRole>([...value2, value, "body"])];
  }
  function mostFrequentValue<K>(
    counts: Map<K, number>,
    compare: (a: K, b: K) => number,
  ): K {
    return [...counts.entries()].sort(
      (input, options) =>
        options[1] - input[1] || compare(input[0], options[0]),
    )[0]![0];
  }
  function dominantTypographyCombo(
    combinations: TypographyUsage[],
    theme: TypographyTheme,
    rank: (usage: TypographyUsage) => number = (): number => 0,
  ): TypographyUsage | undefined {
    return [...combinations].sort(
      (input, options) =>
        rank(input) - rank(options) ||
        options.count - input.count ||
        options.combo.fontSize - input.combo.fontSize ||
        compareTypographyComboKeys(input, options, theme),
    )[0];
  }
  function compareTypographyComboKeys(
    combo: TypographyUsage,
    otherCombo: TypographyUsage,
    theme: TypographyTheme,
  ): number {
    let value = typographyComboKey(combo.combo, theme),
      value2 = typographyComboKey(otherCombo.combo, theme);
    if (value < value2) {
      return -1;
    } else {
      if (value > value2) {
        return 1;
      } else {
        return 0;
      }
    }
  }
  function inferDeckTypographyStyles(
    slides: Slide[],
    theme: TypographyTheme,
  ): TypographyStyle[] {
    if (theme !== "neutral") {
      return systemTypographyStyles(theme);
    }
    let entries = new Map<string, TypographyUsage>();
    for (let value8 of iterateDeckTextNodes(slides)) {
      let value9 = nodeTypographyCombo(value8, theme),
        value10 = typographyComboKey(value9, theme),
        value11: TypographyUsage = entries.get(value10) ?? {
          combo: value9,
          count: 0,
          roles: new Map(),
          weights: new Map(),
          italics: new Map(),
        };
      value11.count += 1;
      value11.roles.set(value8.role, (value11.roles.get(value8.role) ?? 0) + 1);
      value11.weights.set(
        value9.fontWeight,
        (value11.weights.get(value9.fontWeight) ?? 0) + 1,
      );
      value11.italics.set(
        value9.italic,
        (value11.italics.get(value9.italic) ?? 0) + 1,
      );
      entries.set(value10, value11);
    }
    if (entries.size === 0) {
      return systemTypographyStyles(theme);
    }
    let value = [...entries.values()].map((input): TypographyUsage => {
        let value8 = mostFrequentValue(
            input.roles,
            (input2, options) =>
              runtime.textRoles.indexOf(input2) -
              runtime.textRoles.indexOf(options),
          ),
          fontWeight = typeScaleForRole(value8, theme).fontWeight,
          value9 = mostFrequentValue(input.weights, (input2, options) =>
            input2 === fontWeight
              ? -1
              : options === fontWeight
                ? 1
                : input2 - options,
          ),
          value10 = mostFrequentValue(input.italics, (input2) =>
            input2 ? 1 : -1,
          );
        return {
          ...input,
          combo: {
            ...input.combo,
            role: value8,
            fontWeight: value9,
            italic: value10,
          },
        };
      }),
      entries2 = new Map<TextRole, TypographyUsage>(),
      callback = (
        input: TextRole,
        options: TypographyUsage | undefined,
      ): void => {
        if (options !== undefined && !entries2.has(input)) {
          entries2.set(input, options);
        }
      },
      value2 = value.filter(
        (input) => input.combo.role === "h1" || input.combo.role === "display",
      ),
      value3 = [...value2].sort(
        (input, options) =>
          options.combo.fontSize - input.combo.fontSize ||
          options.count - input.count ||
          compareTypographyComboKeys(input, options, theme),
      )[0],
      value4 = value2.filter((input) => input !== value3),
      value5 = dominantTypographyCombo(value4, theme);
    if (
      value3 !== undefined &&
      value5 !== undefined &&
      value4.every(
        (input) => value3.combo.fontSize > input.combo.fontSize,
      )
    ) {
      callback("display", value3);
      callback("h1", value5);
    } else {
      callback("h1", dominantTypographyCombo(value2, theme));
    }
    callback(
      "h2",
      dominantTypographyCombo(
        value.filter((input) => input.combo.role === "h2"),
        theme,
      ),
    );
    callback(
      "h3",
      dominantTypographyCombo(
        value.filter((input) => input.combo.role === "h3"),
        theme,
      ),
    );
    let values = new Set<TypographyUsage>(),
      value6 =
        entries2.get("h2")?.combo.fontSize ??
        entries2.get("h1")?.combo.fontSize ??
        1 / 0,
      value7 = value.filter(
        (input) =>
          input.combo.role !== "display" &&
          input.combo.role !== "h1" &&
          input.combo.role !== "h2" &&
          input.combo.role !== "h3",
      );
    for (let value8 of inferredBodyRolePriority) {
      if (entries2.has(value8)) {
        continue;
      }
      let callback2 = (input: TypographyUsage): number =>
          inferTypographyRoles(input.combo, value6).indexOf(value8) * 2 +
          (value8 !== "h3" &&
          value8 !== "eyebrow" &&
          typographyIsEmphasized(input.combo)
            ? 1
            : 0),
        value9 = dominantTypographyCombo(
          value7.filter(
            (input) =>
              !values.has(input) &&
              inferTypographyRoles(input.combo, value6).includes(value8),
          ),
          theme,
          callback2,
        );
      if (value9 !== undefined) {
        entries2.set(value8, value9);
        values.add(value9);
      }
    }
    if (!entries2.has("body")) {
      let value8 = (["caption", "lead"] as const).find(
        (input) =>
          entries2.has(input) &&
          !typographyIsEmphasized(entries2.get(input)!.combo),
      );
      if (value8 !== undefined) {
        entries2.set("body", entries2.get(value8)!);
        entries2.delete(value8);
      }
    }
    let entry = entries2.get("body"),
      entry2 = entries2.get("caption");
    if (
      entry !== undefined &&
      entry2 !== undefined &&
      entry.combo.fontSize < entry2.combo.fontSize
    ) {
      entries2.set("body", entry2);
      entries2.set("caption", entry);
    }
    return (runtime.textRoles as readonly TextRole[])
      .filter((input) => entries2.has(input))
      .map((input): TypographyStyle => {
        let entry3 = entries2.get(input)!;
        return {
          ...entry3.combo,
          role: input,
          id: input,
          name: runtime.textRoleLabels[input],
          hint: String(entry3.combo.fontSize),
          count: entry3.count,
          source: "deck",
        };
      });
  }
  function fontFamilyLabel(font: FontFamilyValue): string {
    if (typeof font === "string") {
      return font.charAt(0).toUpperCase() + font.slice(1);
    } else {
      return font.family;
    }
  }
  function typographyStylesSignature(
    styles: TypographyStyle[],
    theme: TypographyTheme,
  ): string {
    return styles
      .map(
        (input) =>
          input.id +
          ":" +
          typographyComboKey(input, theme) +
          ":" +
          String(input.fontWeight) +
          (input.italic ? "i" : ""),
      )
      .join("|");
  }
  function nodeTypographyLabel(node: TextNode, theme: TypographyTheme): string {
    let value = nodeTypographyCombo(node, theme);
    return (
      (value.fontFamily !== undefined
        ? fontFamilyLabel(value.fontFamily)
        : theme === "neutral"
          ? "System"
          : typeScaleForRole(node.role, theme).serifDisplay
            ? "Serif"
            : "Sans") +
      " · " +
      String(value.fontSize)
    );
  }
  function defaultBodyTypographyStyle(
    styles: TypographyStyle[],
  ): TypographyStyle | null {
    let value = styles.filter((input) => input.count > 0),
      value2 = value
        .filter((input) => input.role === "lead" || input.role === "caption")
        .sort(
          (input, options) =>
            options.count - input.count || input.fontSize - options.fontSize,
        );
    return (
      value.find((input) => input.role === "body") ??
      value2[0] ??
      value.find((input) => input.role === "eyebrow") ??
      [...value].sort((input, options) => options.count - input.count)[0] ??
      null
    );
  }
  function typographyEmphasisMatches(
    combo: TypographyCombo,
    otherCombo: TypographyCombo,
  ): boolean {
    return (
      combo.fontWeight >= 600 === otherCombo.fontWeight >= 600 &&
      combo.italic === otherCombo.italic
    );
  }
  function findTypographyStyle(
    node: TextNode,
    styles: TypographyStyle[],
    theme: TypographyTheme,
  ): TypographyStyle | null {
    let value = nodeTypographyCombo(node, theme),
      value2 = typographyComboKey(value, theme),
      callback = (input: TypographyStyle): boolean =>
        input.fontWeight === value.fontWeight && input.italic === value.italic,
      callback2 = (input: TypographyStyle[]): TypographyStyle | undefined =>
        input.find(
          (input2) =>
            callback(input2) && input2.letterSpacing === value.letterSpacing,
        ) ??
        input.find(callback) ??
        input.find((input2) => typographyEmphasisMatches(value, input2)) ??
        input[0],
      value3 = callback2(
        styles.filter((input) => typographyComboKey(input, theme) === value2),
      );
    if (value3 !== undefined) {
      return value3;
    }
    let value4 = typographyComboKey(value, theme, "system");
    return (
      callback2(
        styles.filter(
          (input) =>
            typographyUsesSystemFont(input, theme) &&
            typographyComboKey(input, theme, "system") === value4,
        ),
      ) ?? null
    );
  }
  function findExactTypographyStyle(
    node: TextNode,
    styles: TypographyStyle[],
    theme: TypographyTheme,
  ): TypographyStyle | null {
    let value = findTypographyStyle(node, styles, theme);
    if (
      value !== null &&
      typographyEmphasisMatches(nodeTypographyCombo(node, theme), value)
    ) {
      return value;
    } else {
      return null;
    }
  }
  function matchingTypographyNodes(
    node: TextNode,
    slides: TextNode[],
    styles: TypographyStyle[],
    theme: TypographyTheme,
  ): TypographyNodeMatch {
    let value = findExactTypographyStyle(node, styles, theme),
      value2 = nodeTypographyCombo(node, theme),
      value3 = typographyComboKey(value2, theme),
      callback = (input: TextNode): boolean => {
        if (value !== null) {
          return findExactTypographyStyle(input, styles, theme) === value;
        }
        let value4 = nodeTypographyCombo(input, theme);
        return (
          findExactTypographyStyle(input, styles, theme) === null &&
          typographyComboKey(value4, theme) === value3 &&
          typographyEmphasisMatches(value4, value2)
        );
      };
    return {
      style: value,
      mixed: slides.some((input) => !callback(input)),
    };
  }
  function clearTypographyOverrides(
    node: TextNode,
    style: TypographyStyle,
    theme: TypographyTheme,
  ): TextNode {
    let {
        fontSize: value,
        fontWeight: value2,
        lineHeight: value3,
        letterSpacing: value4,
        textTransform: value5,
        fontFamily: value6,
        ...value7
      }: StyleBag = node.style ?? {},
      value8: StyleBag =
        typographyUsesSystemFont(style, theme) && value6 !== undefined
          ? {
              ...value7,
              fontFamily: value6,
            }
          : value7,
      state: TextNode = {
        ...node,
      };
    if (Object.keys(value8).length === 0) {
      delete state.style;
    } else {
      state.style = value8;
    }
    return applyTypographyStyle(state, style, theme);
  }
  function typographyEmphasisVariant(
    node: TextNode,
    styles: TypographyStyle[],
    theme: TypographyTheme,
  ): number | undefined {
    let value = findTypographyStyle(node, styles, theme);
    if (value === null) {
      return;
    }
    let value2 = nodeTypographyCombo(node, theme).fontWeight >= 600,
      value3 = typographyComboKey(
        value,
        theme,
        typographyUsesSystemFont(value, theme) ? "system" : undefined,
      );
    return (
      styles.find(
        (input) =>
          input !== value &&
          typographyComboKey(
            input,
            theme,
            typographyUsesSystemFont(input, theme) ? "system" : undefined,
          ) === value3 &&
          input.italic === value.italic &&
          input.fontWeight >= 600 !== value2,
      ) ?? value
    ).fontWeight;
  }
  function resolveNodeTypographyStyle(
    node: TextNode,
    styles: TypographyStyle[],
    fallbackStyles: TypographyStyle[],
    theme: TypographyTheme,
    exact: boolean = false,
  ): TypographyStyle | undefined {
    let value = exact ? findExactTypographyStyle : findTypographyStyle,
      value2 = value(node, styles, theme) ?? undefined;
    if (theme !== "neutral") {
      if (value2?.source === "system") {
        return value2;
      } else {
        return undefined;
      }
    }
    return (
      value2 ??
      value(node, fallbackStyles, theme) ??
      fallbackStyles.find(
        (dataset) => dataset.source === "deck" && dataset.id === node.role,
      )
    );
  }
  function resolveTypographyEmphasisVariant(
    node: TextNode,
    styles: TypographyStyle[],
    fallbackStyles: TypographyStyle[],
    theme: TypographyTheme,
  ): number | undefined {
    return (
      typographyEmphasisVariant(node, styles, theme) ??
      typographyEmphasisVariant(node, fallbackStyles, theme)
    );
  }
  function typographyUsesSystemFont(
    style: TypographyStyle,
    theme: TypographyTheme,
  ): boolean {
    if (style.fontFamily !== undefined || !("source" in style)) {
      return false;
    }
    return (
      style.source === "system" ||
      (style.source === "ladder" && theme === "neutral")
    );
  }
  function applyTypographyStyle(
    node: TextNode,
    style: TypographyStyle,
    theme: TypographyTheme,
  ): TextNode {
    let value = "source" in style && style.source === "system",
      value2 = value ? node.role : style.role,
      value3 = typeScaleForRole(value2, theme),
      state: StyleBag = {
        ...node.style,
      },
      callback = <K extends keyof StyleBag>(
        input: K,
        options: StyleBag[K],
        context: boolean,
      ): void => {
        if (context) {
          delete state[input];
        } else {
          state[input] = options;
        }
      };
    callback("fontSize", style.fontSize, style.fontSize === value3.fontSize);
    callback(
      "lineHeight",
      style.lineHeight,
      style.lineHeight === value3.lineHeight,
    );
    let value4 = typographyUsesSystemFont(style, theme),
      value5 = nodeTypographyCombo(node, theme),
      value6 =
        typographyComboKey(value5, theme, value4 ? "system" : undefined) ===
          typographyComboKey(style, theme, value4 ? "system" : undefined) &&
        (value
          ? value5.fontWeight === style.fontWeight &&
            value5.italic === style.italic
          : typographyEmphasisMatches(value5, style))
          ? value5.fontWeight
          : style.fontWeight;
    callback("fontWeight", value6, value6 === value3.fontWeight);
    callback("fontStyle", "italic", !style.italic);
    if (theme === "neutral" || value) {
      callback("letterSpacing", style.letterSpacing, style.letterSpacing === 0);
    }
    if (theme === "neutral") {
      callback(
        "textTransform",
        style.textTransform,
        style.textTransform === undefined,
      );
    }
    if (style.fontFamily !== undefined) {
      state.fontFamily = style.fontFamily;
    } else if (!value4) {
      delete state.fontFamily;
    }
    let state2: TextNode = {
      ...node,
      role: value2,
    };
    if (Object.keys(state).length === 0) {
      delete state2.style;
    } else {
      state2.style = state;
    }
    return state2;
  }
  function collectDeckFontFamilies(
    faces: FontFace[] | undefined,
    families: ThemeFonts | undefined,
  ): Map<string, string> {
    let entries = new Map<string, string>();
    for (let value of [
      ...(faces ?? []),
      ...(Object.values(families ?? {}) as (FontFace | undefined)[]),
    ])
      if (value !== undefined && !entries.has(value.family.toLowerCase())) {
        entries.set(value.family.toLowerCase(), value.family);
      }
    return entries;
  }
  function modelFontFromDesignToken(
    font: DesignTypeFamily | undefined,
    knownFamilies: Map<string, string>,
  ): FontFamilyValue | undefined {
    if (font === undefined) {
      return;
    }
    if (
      !(
        runtime.customFontFamilyPattern.test(font.name) &&
        !(0, runtime.isGenericFontFamily)(font.name) &&
        !/^(inherit|initial|unset|revert|revert-layer|default)$/i.test(
          font.name,
        )
      )
    ) {
      return font.generic;
    }
    let entry = knownFamilies.get(font.name.toLowerCase());
    if (entry !== undefined) {
      return {
        family: entry,
        fallback: font.generic,
      };
    }
    return (0, runtime.resolveFontFamilyAlias)(font.name) ?? font.generic;
  }
  function designSystemTypographyStyles(
    systems: DesignSystem[],
    theme: TypographyTheme,
    knownFamilies: Map<string, string> = new Map(),
  ): TypographyStyle[] {
    let value = (0, runtime.designSystemTypeRows)(systems);
    if (value.length === 0) {
      return emptyTypographyStyles;
    }
    let callback = (input: TypographyStyle): string =>
        typographyComboKey(
          input,
          theme,
          typographyUsesSystemFont(input, theme) ? "system" : undefined,
        ) +
        ":" +
        String(input.fontWeight) +
        (input.italic ? "i" : "") +
        ":" +
        String(input.letterSpacing),
      values = new Set<string>(),
      items: TypographyStyle[] = [];
    for (let value2 of value) {
      let style = value2.style,
        state: TypographyCombo = {
          role: "body",
          fontFamily: modelFontFromDesignToken(style.family, knownFamilies),
          fontSize: clampTypographyValue(
            Math.round(style.fontSize * 10) / 10,
            8,
            400,
          ),
          fontWeight: clampTypographyValue(
            Math.round(style.fontWeight / 100) * 100,
            100,
            900,
          ),
          italic: style.italic,
          lineHeight: clampTypographyValue(
            Math.round(style.lineHeight * 100) / 100,
            0.5,
            4,
          ),
          letterSpacing: clampTypographyValue(
            Math.round(style.letterSpacing * 10) / 10,
            -24,
            32,
          ),
        },
        state2: TypographyStyle = {
          ...state,
          id: value2.id,
          name: style.name,
          hint: String(state.fontSize),
          count: 0,
          source: "system",
          group: value2.group,
          ...(value2.subgroup !== undefined
            ? {
                subgroup: value2.subgroup,
              }
            : {}),
          title: style.name + " · " + value2.subtitle,
        };
      if (values.has(callback(state2))) {
        continue;
      }
      values.add(callback(state2));
      items.push(state2);
    }
    return items;
  }
  bindRuntimeValue(runtime, "typeScaleForRole", () => typeScaleForRole);
  bindRuntimeValue(runtime, "typographyFontKey", () => typographyFontKey);
  bindRuntimeValue(runtime, "typographyComboKey", () => typographyComboKey);
  bindRuntimeValue(runtime, "nodeTypographyCombo", () => nodeTypographyCombo);
  bindRuntimeValue(
    runtime,
    "systemTypographyStyles",
    () => systemTypographyStyles,
  );
  bindRuntimeValue(runtime, "iterateDeckTextNodes", () => iterateDeckTextNodes);
  bindRuntimeValue(
    runtime,
    "typographyIsEmphasized",
    () => typographyIsEmphasized,
  );
  bindRuntimeValue(runtime, "inferTypographyRoles", () => inferTypographyRoles);
  bindRuntimeValue(runtime, "mostFrequentValue", () => mostFrequentValue);
  bindRuntimeValue(
    runtime,
    "dominantTypographyCombo",
    () => dominantTypographyCombo,
  );
  bindRuntimeValue(
    runtime,
    "compareTypographyComboKeys",
    () => compareTypographyComboKeys,
  );
  bindRuntimeValue(
    runtime,
    "inferDeckTypographyStyles",
    () => inferDeckTypographyStyles,
  );
  bindRuntimeValue(runtime, "fontFamilyLabel", () => fontFamilyLabel);
  bindRuntimeValue(
    runtime,
    "typographyStylesSignature",
    () => typographyStylesSignature,
  );
  bindRuntimeValue(runtime, "nodeTypographyLabel", () => nodeTypographyLabel);
  bindRuntimeValue(
    runtime,
    "defaultBodyTypographyStyle",
    () => defaultBodyTypographyStyle,
  );
  bindRuntimeValue(
    runtime,
    "typographyEmphasisMatches",
    () => typographyEmphasisMatches,
  );
  bindRuntimeValue(runtime, "findTypographyStyle", () => findTypographyStyle);
  bindRuntimeValue(
    runtime,
    "findExactTypographyStyle",
    () => findExactTypographyStyle,
  );
  bindRuntimeValue(
    runtime,
    "matchingTypographyNodes",
    () => matchingTypographyNodes,
  );
  bindRuntimeValue(
    runtime,
    "clearTypographyOverrides",
    () => clearTypographyOverrides,
  );
  bindRuntimeValue(
    runtime,
    "typographyEmphasisVariant",
    () => typographyEmphasisVariant,
  );
  bindRuntimeValue(
    runtime,
    "resolveNodeTypographyStyle",
    () => resolveNodeTypographyStyle,
  );
  bindRuntimeValue(
    runtime,
    "resolveTypographyEmphasisVariant",
    () => resolveTypographyEmphasisVariant,
  );
  bindRuntimeValue(
    runtime,
    "typographyUsesSystemFont",
    () => typographyUsesSystemFont,
  );
  bindRuntimeValue(runtime, "applyTypographyStyle", () => applyTypographyStyle);
  bindRuntimeValue(
    runtime,
    "collectDeckFontFamilies",
    () => collectDeckFontFamilies,
  );
  bindRuntimeValue(
    runtime,
    "modelFontFromDesignToken",
    () => modelFontFromDesignToken,
  );
  bindRuntimeValue(
    runtime,
    "designSystemTypographyStyles",
    () => designSystemTypographyStyles,
  );
  bindRuntimeValue(
    runtime,
    "emptyTypographyStyles",
    () => emptyTypographyStyles,
    (value) => {
      emptyTypographyStyles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "systemTypographyStylesCache",
    () => systemTypographyStylesCache,
    (value) => {
      systemTypographyStylesCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inferredBodyRolePriority",
    () => inferredBodyRolePriority,
    (value) => {
      inferredBodyRolePriority = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampTypographyValue",
    () => clampTypographyValue,
    (value) => {
      clampTypographyValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTypographyInference",
    () => initializeTypographyInference,
    (value) => {
      initializeTypographyInference = value;
    },
  );
  return () => {
    clampTypographyValue = (input, options, context) =>
      Math.min(context, Math.max(options, input));
    initializeTypographyInference = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeDesignTokenParser)();
      (0, runtime.initializeDesignSystemsStore)();
      (0, runtime.initializeStyleSchema)();
      (0, runtime.initializeSlideTypeScales)();
      (0, runtime.initializeHtmlCompiler)();
      emptyTypographyStyles = [];
      systemTypographyStylesCache = new Map();
      inferredBodyRolePriority = ["h3", "eyebrow", "lead", "caption", "body"];
    });
  };
}
