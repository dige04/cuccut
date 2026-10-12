/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type {
  DeckContent,
  FontFace,
  FontFamilyValue,
  TextFill,
  TextNode,
  TextRole,
  ThemeFonts,
} from "../deck-contracts";
import type { DesignSystem } from "../design-system/tokens";
import type { NamedSlideColors } from "../model/type-scales";
import type { TypographyCombo } from "../model/typography";

/** Theme a deck renders with (`DeckContent.theme`). */
export type RenderingTheme = DeckContent["theme"];
/** Typography of one text role after the theme's font stack has been applied. */
export interface RenderedTypeEntry {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  /** Set when the role uses the serif display face. */
  serifDisplay?: true;
}
/** Rendered type scale of a theme: one entry per text role; other keys (unvalidated callers) may be absent. */
export interface RenderedTypeScale extends Record<TextRole, RenderedTypeEntry> {
  [role: string]: RenderedTypeEntry | undefined;
}
/** The typographic properties `typographyStyleCss` reads from a text style. */
export type TypographyStyleSource = Pick<
  TypographyCombo,
  "role" | "fontFamily" | "fontSize" | "fontWeight" | "italic" | "textTransform"
>;
/** One weight/italic combination a font family offers. */
export interface ThemeFontVariant {
  weight: number;
  italic: boolean;
}
/** The text node properties that decide its base CSS. */
export type TextNodeCssSource = Pick<
  TextNode,
  "role" | "color" | "wrap" | "align" | "hangingIndent"
>;
/** A swatch of the deck colour picker; `picks` is the name the swatch selects when it stands for another entry. */
export interface DeckColorSwatch {
  name: string;
  color: string;
  label?: string;
  group?: string;
  subgroup?: string;
  picks?: string;
}
/** A row of the deck colour list. */
export interface DeckColorRow {
  name: string;
  value: string;
  label?: string;
  group?: string;
  subgroup?: string;
  picks?: string;
}
/** Colour rows and quick swatches offered for a deck, plus the number of design systems they come from. */
export interface DeckColorChoices {
  rows: DeckColorRow[];
  quick: DeckColorSwatch[];
  systems: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ThemeReact: ReactNamespace;
    renderingNamedColors: NamedSlideColors;
    renderingTheme: RenderingTheme;
    serifThemeFontStack: string;
    sansThemeFontStack: string;
    defaultThemeFontFamilies: Record<keyof ThemeFonts, string>;
    googleFontImportPattern: RegExp;
    neutralThemeFontStack: string;
    anthropicRenderedTypeScale: RenderedTypeScale;
    neutralRenderedTypeScale: RenderedTypeScale;
    defaultDeckColorNames: string[];
    initializeRenderingTheme: () => void;
    setRenderingTheme: (theme: RenderingTheme) => void;
    getRenderingTheme: () => RenderingTheme;
    themeAccentColor: (theme?: RenderingTheme) => string;
    resolveSlideColor: (color?: string) => string | undefined;
    stripHexAlpha: (color: string) => string;
    slideTextColor: (background?: string) => string;
    buildDeckThemeCss: (theme?: ThemeFonts, faces?: FontFace[]) => string;
    addOptionalGoogleFontImports: (css: string) => string;
    buildRenderedTypeScale: (theme?: RenderingTheme) => RenderedTypeScale;
    renderingTypeScaleForRole: (role: TextRole) => RenderedTypeEntry;
    typographyStyleCss: (style: TypographyStyleSource) => CSSProperties;
    resolvedFontVariants: (
      font: FontFamilyValue | undefined,
      role: TextRole,
      themeFamilies?: ThemeFonts,
    ) => ThemeFontVariant[];
    fontFamilyCss: (font?: FontFamilyValue) => CSSProperties;
    textNodeBaseCss: (
      node: TextNodeCssSource,
      background?: string,
    ) => CSSProperties;
    textFillCssImage: (fill?: TextFill) => string | undefined;
    applyTextFillCss: (style: CSSProperties, fill?: TextFill) => CSSProperties;
    slideBackgroundColor: (background?: string) => string;
    slideColorOrUndefined: (color: string) => string | undefined;
    namedSwatchColor: (
      swatches: DeckColorSwatch[],
      name: string | null,
    ) => string | undefined;
    selectedSwatchName: (
      swatches: DeckColorSwatch[],
      color: string,
    ) => string | null;
    useDeckColorChoices: (
      colors?: string[],
      quickColors?: string[],
    ) => DeckColorChoices;
  }
}

export function installRenderingTheme(runtime: RuntimeBindings): () => void {
  var ThemeReact: ReactNamespace;
  var renderingNamedColors: RuntimeBindings["renderingNamedColors"];
  var renderingTheme: RuntimeBindings["renderingTheme"];
  var serifThemeFontStack: RuntimeBindings["serifThemeFontStack"];
  var sansThemeFontStack: RuntimeBindings["sansThemeFontStack"];
  var defaultThemeFontFamilies: RuntimeBindings["defaultThemeFontFamilies"];
  var googleFontImportPattern: RuntimeBindings["googleFontImportPattern"];
  var neutralThemeFontStack: RuntimeBindings["neutralThemeFontStack"];
  var anthropicRenderedTypeScale: RuntimeBindings["anthropicRenderedTypeScale"];
  var neutralRenderedTypeScale: RuntimeBindings["neutralRenderedTypeScale"];
  var defaultDeckColorNames: RuntimeBindings["defaultDeckColorNames"];
  var initializeRenderingTheme: RuntimeBindings["initializeRenderingTheme"];
  function setRenderingTheme(theme: RenderingTheme): void {
    renderingTheme = theme;
  }
  function getRenderingTheme(): RenderingTheme {
    return renderingTheme;
  }
  function themeAccentColor(theme: RenderingTheme = renderingTheme): string {
    if (theme === "neutral") {
      return "#9aa0a6";
    } else {
      return runtime.anthropicAccentColor;
    }
  }
  function resolveSlideColor(color?: string): string | undefined {
    if (!color) {
      return;
    }
    return (
      renderingNamedColors[color] ?? (color.startsWith("#") ? color : undefined)
    );
  }
  function stripHexAlpha(color: string): string {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map((input: string): string => input + input).join("");
    }
    return "#" + hex.slice(0, 6);
  }
  function slideTextColor(background?: string): string {
    return (0, runtime.strongerContrastColor)(
      stripHexAlpha(resolveSlideColor(background) ?? "#F5F4ED"),
      "#FAF9F5",
      "#141413",
    );
  }
  function buildDeckThemeCss(theme?: ThemeFonts, faces?: FontFace[]): string {
    let text = "",
      text2 = "",
      text3 = "";
    for (let value of faces ?? [])
      if ("href" in value) {
        let value2 = "@import url(" + value.href + ");";
        if (!text.includes(value2)) {
          text += value2;
        }
      } else {
        text2 +=
          "@font-face{font-family:'" +
          value.family +
          "';src:url(" +
          value.src +
          ");font-weight:100 900;font-display:swap;}";
      }
    if (!theme) {
      return addOptionalGoogleFontImports(text) + text2;
    }
    for (let value of runtime.themeFontFamilyKinds) {
      let value2 = theme[value];
      if (!value2) {
        continue;
      }
      let text4 = "";
      if ("href" in value2) {
        let value3 = "@import url(" + value2.href + ");";
        if (!text.includes(value3)) {
          text += value3;
        }
        text4 = ",'" + defaultThemeFontFamilies[value] + "'";
      } else {
        text2 +=
          "@font-face{font-family:'" +
          value2.family +
          "';src:url(" +
          value2.src +
          ");font-weight:100 900;font-display:swap;}";
      }
      text3 += "--deck-" + value + ":'" + value2.family + "'" + text4 + ";";
    }
    text = addOptionalGoogleFontImports(text);
    if (text3 === "") {
      return text + text2;
    } else {
      return text + text2 + ":root{" + text3 + "}";
    }
  }
  function addOptionalGoogleFontImports(css: string): string {
    let value = css;
    for (let value2 of css.matchAll(googleFontImportPattern))
      for (let value3 of (0, runtime.optionalGoogleFontStylesheetUrls)(
        value2[1],
        runtime.defaultGoogleFontWeights,
      )) {
        let value4 = "@import url(" + value3 + ");";
        if (!value.includes(value4)) {
          value += value4;
        }
      }
    return value;
  }
  function buildRenderedTypeScale(theme?: RenderingTheme): RenderedTypeScale {
    let value =
        theme === "neutral"
          ? runtime.neutralTypeScale
          : runtime.anthropicTypeScale,
      state = {} as RenderedTypeScale;
    for (let value2 of Object.keys(value) as TextRole[]) {
      let value3 = value[value2];
      state[value2] = {
        fontFamily:
          theme === "neutral"
            ? neutralThemeFontStack
            : value3.serifDisplay
              ? serifThemeFontStack
              : sansThemeFontStack,
        fontSize: value3.fontSize,
        fontWeight: value3.fontWeight,
        lineHeight: value3.lineHeight,
        ...(value3.serifDisplay
          ? {
              serifDisplay: true,
            }
          : {}),
      };
    }
    return state;
  }
  function renderingTypeScaleForRole(role: TextRole): RenderedTypeEntry {
    return (
      renderingTheme === "neutral"
        ? neutralRenderedTypeScale
        : anthropicRenderedTypeScale
    )[role];
  }
  function typographyStyleCss(style: TypographyStyleSource): CSSProperties {
    let value = renderingTypeScaleForRole(style.role);
    return {
      fontFamily:
        style.fontFamily !== undefined
          ? String(
              (0, runtime.styleBagToCss)(
                {
                  fontFamily: style.fontFamily,
                },
                "slides-text",
              ).fontFamily ?? value.fontFamily,
            )
          : value.fontFamily,
      fontWeight: style.fontWeight,
      ...(style.italic
        ? {
            fontStyle: "italic",
          }
        : null),
      fontSize: Math.round(
        13 + ((Math.min(128, Math.max(24, style.fontSize)) - 24) * 7) / 104,
      ),
      ...(style.textTransform !== undefined
        ? {
            textTransform: style.textTransform,
          }
        : null),
      ...(style.fontFamily === undefined && value.serifDisplay
        ? {
            fontVariationSettings: "'opsz' 48",
          }
        : null),
    };
  }
  function resolvedFontVariants(
    font: FontFamilyValue | undefined,
    role: TextRole,
    themeFamilies?: ThemeFonts,
  ): ThemeFontVariant[] {
    let generic: keyof ThemeFonts = renderingTypeScaleForRole(role).serifDisplay
        ? "serif"
        : "sans",
      family: string =
        typeof font === "object"
          ? font.family
          : font !== undefined || renderingTheme === "neutral"
            ? (0, runtime.firstFontFamily)(
                String(
                  (0, runtime.styleBagToCss)(
                    {
                      fontFamily: font ?? "sans",
                    },
                    "slides-text",
                  ).fontFamily ?? "",
                ),
              )
            : (themeFamilies?.[generic]?.family ??
              defaultThemeFontFamilies[generic]);
    return (
      (0, runtime.knownFontVariants)(family) ??
      (0, runtime.fontVariantsOrDefault)(
        family,
        typeof document !== "undefined" && document.fonts
          ? (0, runtime.availableFontVariants)(
              Array.from(document.fonts),
              family,
            )
          : undefined,
      )
    );
  }
  function fontFamilyCss(font?: FontFamilyValue): CSSProperties {
    return {
      fontFamily: String(
        (0, runtime.styleBagToCss)(
          {
            fontFamily: font,
          },
          "slides-text",
        ).fontFamily ?? "",
      ),
    };
  }
  function textNodeBaseCss(
    node: TextNodeCssSource,
    background?: string,
  ): CSSProperties {
    let defaults = renderingTypeScaleForRole(node.role),
      css: CSSProperties = {
        fontFamily: defaults.fontFamily,
        fontSize: defaults.fontSize,
        fontWeight: defaults.fontWeight,
        lineHeight: defaults.lineHeight,
        color: resolveSlideColor(node.color) ?? slideTextColor(background),
        margin: 0,
        whiteSpace: node.wrap === "nowrap" ? "pre" : "pre-wrap",
        overflowWrap: node.wrap === "nowrap" ? "normal" : "break-word",
      };
    if (defaults.serifDisplay) {
      css.fontVariationSettings = "'opsz' 48";
      if (node.wrap !== "nowrap") {
        css.textWrap = "balance";
      }
    } else if (node.wrap !== "nowrap") {
      css.textWrap = "pretty";
    }
    if (node.align === "center") {
      css.textAlign = "center";
    } else if (node.align === "end") {
      css.textAlign = "right";
    } else if (node.align === "justify") {
      css.textAlign = "justify";
    }
    if (node.hangingIndent !== undefined) {
      css.textIndent = -node.hangingIndent;
      css.paddingLeft = node.hangingIndent;
    }
    return css;
  }
  function textFillCssImage(fill?: TextFill): string | undefined {
    if (fill === undefined) {
      return;
    }
    if (fill.kind === "gradient") {
      let backgroundImage = (0, runtime.styleBagToCss)(
        {
          backgroundGradient: fill.gradient,
        },
        "slides-text",
      ).backgroundImage;
      if (typeof backgroundImage === "string") {
        return backgroundImage;
      } else {
        return undefined;
      }
    }
    if ((0, runtime.isRenderableImageSource)(fill.src)) {
      return (
        'url("' +
        fill.src +
        '") center / ' +
        (fill.size ?? "cover") +
        " no-repeat"
      );
    } else {
      return undefined;
    }
  }
  function applyTextFillCss(
    style: CSSProperties,
    fill?: TextFill,
  ): CSSProperties {
    if (
      fill === undefined ||
      (fill.kind === "image" && !(0, runtime.isRenderableImageSource)(fill.src))
    ) {
      return style;
    }
    let {
        backgroundColor: backgroundColor,
        background: background,
        textShadow: textShadow,
        ...restStyle
      } = style,
      image =
        fill.kind === "gradient"
          ? textFillCssImage(fill)
          : 'url("' + fill.src + '")';
    if (image === undefined) {
      return style;
    }
    return {
      ...restStyle,
      backgroundColor:
        fill.kind === "image" && typeof restStyle.color === "string"
          ? restStyle.color
          : undefined,
      backgroundImage: image,
      backgroundSize:
        fill.kind === "image" ? (fill.size ?? "cover") : undefined,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    };
  }
  function slideBackgroundColor(background?: string): string {
    return resolveSlideColor(background) ?? "#F5F4ED";
  }
  function slideColorOrUndefined(color: string): string | undefined {
    if ((0, runtime.isSlideColor)(color)) {
      return color;
    } else {
      return undefined;
    }
  }
  function namedSwatchColor(
    swatches: DeckColorSwatch[],
    name: string | null,
  ): string | undefined {
    return swatches.find((input: DeckColorSwatch): boolean => input.name === name)
      ?.color;
  }
  function selectedSwatchName(
    swatches: DeckColorSwatch[],
    color: string,
  ): string | null {
    let normalized = (resolveSlideColor(color) ?? color).toLowerCase(),
      swatch = swatches.find(
        (input: DeckColorSwatch): boolean => input.color === normalized,
      );
    if (swatch === undefined) {
      return null;
    } else {
      return swatch.picks ?? swatch.name;
    }
  }
  function useDeckColorChoices(
    colors: string[] = defaultDeckColorNames,
    quickColors: string[] = defaultDeckColorNames,
  ): DeckColorChoices {
    let value = (0, runtime.useDesignSystems)();
    return ThemeReact.useMemo((): DeckColorChoices => {
      if (!(0, runtime.hasDesignSystems)(value)) {
        return {
          rows: colors.map(
            (input: string): DeckColorRow => ({
              name: input,
              value: input,
              label: input.toUpperCase(),
            }),
          ),
          quick: colors.map(
            (input: string): DeckColorSwatch => ({
              name: "design:" + input,
              color: input,
              label: input.toUpperCase(),
            }),
          ),
          systems: 0,
        };
      }
      let value2 =
          quickColors.length > 0
            ? {
                label: runtime.SLIDE_COLORS_LABEL,
                colors: quickColors,
              }
            : undefined,
        value3: DeckColorSwatch[] = (0, runtime.designSystemColorRows)(
          value,
        ).map(
          (input): DeckColorSwatch =>
            typeof input === "string"
              ? {
                  name: input,
                  color: input,
                }
              : {
                  name: input.name,
                  color: input.value,
                  label: input.label,
                  group: input.group,
                  subgroup: input.subgroup,
                },
        );
      return {
        rows: (0, runtime.mergeDesignSystemSwatches)(value2, value3).map(
          (input: DeckColorSwatch): DeckColorRow => ({
            name: input.name,
            value: input.color,
            label: input.label,
            group: input.group,
            subgroup: input.subgroup,
            ...(input.picks !== undefined
              ? {
                  picks: input.picks,
                }
              : {}),
          }),
        ),
        quick: (0, runtime.mergeDesignSystemSwatches)(
          value2,
          value.flatMap(
            (input: DesignSystem, options: number): DeckColorSwatch[] =>
              input.colors.map(
                (input2): DeckColorSwatch => ({
                  name: "ds:" + String(options) + ":" + input2.name,
                  color: input2.value,
                  label: input2.name,
                  ...(0, runtime.designSystemColorGrouping)(input, input2),
                }),
              ),
          ),
        ),
        systems: value.length,
      };
    }, [value, colors, quickColors]);
  }
  bindRuntimeValue(runtime, "setRenderingTheme", () => setRenderingTheme);
  bindRuntimeValue(runtime, "getRenderingTheme", () => getRenderingTheme);
  bindRuntimeValue(runtime, "themeAccentColor", () => themeAccentColor);
  bindRuntimeValue(runtime, "resolveSlideColor", () => resolveSlideColor);
  bindRuntimeValue(runtime, "stripHexAlpha", () => stripHexAlpha);
  bindRuntimeValue(runtime, "slideTextColor", () => slideTextColor);
  bindRuntimeValue(runtime, "buildDeckThemeCss", () => buildDeckThemeCss);
  bindRuntimeValue(
    runtime,
    "addOptionalGoogleFontImports",
    () => addOptionalGoogleFontImports,
  );
  bindRuntimeValue(
    runtime,
    "buildRenderedTypeScale",
    () => buildRenderedTypeScale,
  );
  bindRuntimeValue(
    runtime,
    "renderingTypeScaleForRole",
    () => renderingTypeScaleForRole,
  );
  bindRuntimeValue(runtime, "typographyStyleCss", () => typographyStyleCss);
  bindRuntimeValue(runtime, "resolvedFontVariants", () => resolvedFontVariants);
  bindRuntimeValue(runtime, "fontFamilyCss", () => fontFamilyCss);
  bindRuntimeValue(runtime, "textNodeBaseCss", () => textNodeBaseCss);
  bindRuntimeValue(runtime, "textFillCssImage", () => textFillCssImage);
  bindRuntimeValue(runtime, "applyTextFillCss", () => applyTextFillCss);
  bindRuntimeValue(runtime, "slideBackgroundColor", () => slideBackgroundColor);
  bindRuntimeValue(
    runtime,
    "slideColorOrUndefined",
    () => slideColorOrUndefined,
  );
  bindRuntimeValue(runtime, "namedSwatchColor", () => namedSwatchColor);
  bindRuntimeValue(runtime, "selectedSwatchName", () => selectedSwatchName);
  bindRuntimeValue(runtime, "useDeckColorChoices", () => useDeckColorChoices);
  bindRuntimeValue(
    runtime,
    "ThemeReact",
    () => ThemeReact,
    (value) => {
      ThemeReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "renderingNamedColors",
    () => renderingNamedColors,
    (value) => {
      renderingNamedColors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "renderingTheme",
    () => renderingTheme,
    (value) => {
      renderingTheme = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serifThemeFontStack",
    () => serifThemeFontStack,
    (value) => {
      serifThemeFontStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sansThemeFontStack",
    () => sansThemeFontStack,
    (value) => {
      sansThemeFontStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultThemeFontFamilies",
    () => defaultThemeFontFamilies,
    (value) => {
      defaultThemeFontFamilies = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleFontImportPattern",
    () => googleFontImportPattern,
    (value) => {
      googleFontImportPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "neutralThemeFontStack",
    () => neutralThemeFontStack,
    (value) => {
      neutralThemeFontStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anthropicRenderedTypeScale",
    () => anthropicRenderedTypeScale,
    (value) => {
      anthropicRenderedTypeScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "neutralRenderedTypeScale",
    () => neutralRenderedTypeScale,
    (value) => {
      neutralRenderedTypeScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultDeckColorNames",
    () => defaultDeckColorNames,
    (value) => {
      defaultDeckColorNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeRenderingTheme",
    () => initializeRenderingTheme,
    (value) => {
      initializeRenderingTheme = value;
    },
  );
  return () => {
    renderingTheme = "anthropic";
    serifThemeFontStack =
      "var(--deck-serif, Georgia), Georgia, 'Times New Roman', serif";
    // CucCut: the platform's Anthropic Sans is not bundled; the theme's sans default is the system UI font.
    sansThemeFontStack =
      "var(--deck-sans, system-ui), -apple-system, 'Helvetica Neue', sans-serif";
    neutralThemeFontStack =
      "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
    initializeRenderingTheme = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeColorSelect)();
      (0, runtime.initializeUiPropertyLabels)();
      (0, runtime.initializeUiContrast)();
      (0, runtime.initializeFontCatalog)();
      (0, runtime.initializeFontVariants)();
      (0, runtime.initializeDesignTokenParser)();
      (0, runtime.initializeDesignSystemsStore)();
      (0, runtime.initializeSlideTypeScales)();
      (0, runtime.initializeStyleSchema)();
      ThemeReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      renderingNamedColors = {
        ...runtime.namedSlideColors,
      };
      defaultThemeFontFamilies = {
        serif: "Georgia",
        sans: "system-ui",
      };
      googleFontImportPattern = /@import url\(([^)]+)\);/g;
      anthropicRenderedTypeScale = buildRenderedTypeScale("anthropic");
      neutralRenderedTypeScale = buildRenderedTypeScale("neutral");
      defaultDeckColorNames = [];
    });
  };
}
