/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** An untyped JSON object read from a design-token payload. */
type RawRecord = Record<string, unknown>;
/** An entry of a raw token list or theme list: any JSON value, usually an object. */
type RawEntry = RawRecord | null | undefined;
/** Linear or gamma-encoded red, green and blue channels in the 0..1 range. */
type RgbChannels = [number, number, number];
/** Channel texts of a CSS colour function: three channels and an optional alpha. */
type ColorFunctionChannels = [string, string, string, string?];

/** One colour of a design system palette. */
export interface DesignColorToken {
  name: string;
  value: string;
  group: string;
}
/** Font family declared by a typography token: first family name, the full stack and the generic family it maps to. */
export interface DesignTypeFamily {
  name: string;
  stack: string;
  generic: "sans" | "serif" | "mono";
}
/** One typography style of a design system. */
export interface DesignTypeToken {
  name: string;
  group: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
  italic: boolean;
  family?: DesignTypeFamily;
}
/** A design system as shown in the colour and type panels. */
export interface DesignSystem {
  title: string;
  url?: string;
  theme?: string;
  colors: DesignColorToken[];
  type?: DesignTypeToken[];
}
/** Display name and source of a design system, supplied next to its tokens. */
export interface DesignTokenMetadata {
  title?: string;
  url?: string;
}
/** Group labels attached to colour and type rows of a design system. */
export interface DesignTokenGrouping {
  group: string;
  subgroup?: string;
}
/** Counters filled while the colour tokens are resolved. */
export interface ColorTokenStats {
  total: number;
  unresolved: number;
  truncated: number;
}
/** Colour token names that share a group label. */
export interface ColorTokenGroup {
  label: string;
  names: string[];
}
/** A CSS length of a typography token. */
export interface TypeTokenLength {
  n: number;
  unit: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    designSystemsCapabilityName: string;
    designTokenNamePattern: RegExp;
    clampColorChannel: (input: number) => number;
    colorChannelToHex: (input: number) => string;
    linearSrgbToSrgb: (input: number) => number;
    defaultPaletteTitle: string;
    numericTokenSuffixPattern: RegExp;
    designColorTokenPattern: RegExp;
    designSystemSingleGroupCache: WeakMap<DesignSystem, boolean>;
    maxTypographyDesignTokens: number;
    maxTypographyTokenGroups: number;
    maxTypographyTokenFamilies: number;
    maxTypographyTokenGroupNameLength: number;
    cssTypeTokenLengthPattern: RegExp;
    safeFontTokenStringPattern: RegExp;
    genericFontFamilyPattern: RegExp;
    roundTypeTokenValue: (input: number) => number;
    typeTokenLengthPixels: (input: TypeTokenLength) => number;
    fontWeightLabels: Record<number, string>;
    initializeDesignTokenParser: () => void;
    parseColorNumberOrPercent: (
      text: string,
      percentBase: number,
    ) => number | undefined;
    parseColorHueDegrees: (hue: string) => number | undefined;
    splitColorFunctionChannels: (
      value: string,
      functionName: string,
    ) => ColorFunctionChannels | undefined;
    oklabToSrgb: (lightness: number, a: number, b: number) => RgbChannels;
    labToSrgb: (lightness: number, a: number, b: number) => RgbChannels;
    normalizeDesignTokenColor: (color: string) => string | undefined;
    commonTokenNamePrefix: (names: string[]) => string;
    tokenGroupName: (name: string, prefix?: string) => string;
    tokenHasGroupSuffix: (name: string, prefix?: string) => boolean;
    groupColorTokenNames: (names: string[]) => ColorTokenGroup[];
    normalizeTokenName: (name: unknown) => string | undefined;
    boundedNonemptyString: (
      value: unknown,
      maxLength: number,
    ) => string | undefined;
    designSystemName: (tokens?: RawRecord) => string | undefined;
    createDesignSystemPalette: (
      title: string | undefined,
      url: string | undefined,
      mode: unknown,
      colors: DesignColorToken[],
      typography?: DesignTypeToken[],
    ) => DesignSystem | undefined;
    designSystemColorGrouping: (
      system: DesignSystem,
      color: DesignColorToken,
    ) => DesignTokenGrouping;
    designSystemHasSingleColorGroup: (system: DesignSystem) => boolean;
    designSystemTypeGrouping: (
      system: DesignSystem,
      typography: DesignTypeToken,
    ) => DesignTokenGrouping;
    normalizeDesignSystemPayload: (
      payload: unknown,
    ) => DesignSystem | undefined;
    normalizeDesignSystems: (payload: unknown) => DesignSystem[];
    parseColorDesignTokens: (
      tokens?: RawRecord,
      metadata?: DesignTokenMetadata,
      theme?: ColorTokenStats,
    ) => DesignSystem | undefined;
    parseDesignTokens: (
      tokens?: RawRecord,
      metadata?: DesignTokenMetadata,
      theme?: ColorTokenStats,
    ) => DesignSystem | undefined;
    isSafeFontTokenString: (value: string) => boolean;
    parseTypeTokenLength: (value: unknown) => TypeTokenLength | undefined;
    isGenericFontFamily: (family: string) => boolean;
    parseTypeTokenFontFamily: (value: string) => DesignTypeFamily;
    parseTypographyDesignTokens: (tokens?: RawRecord) => DesignTypeToken[];
    typographyTokenSubtitle: (typography: DesignTypeToken) => string;
  }
}

export function installDesignSystemTokens(
  runtime: RuntimeBindings,
): () => void {
  var designSystemsCapabilityName: RuntimeBindings["designSystemsCapabilityName"];
  var designTokenNamePattern: RuntimeBindings["designTokenNamePattern"];
  var clampColorChannel: RuntimeBindings["clampColorChannel"];
  var colorChannelToHex: RuntimeBindings["colorChannelToHex"];
  var linearSrgbToSrgb: RuntimeBindings["linearSrgbToSrgb"];
  var defaultPaletteTitle: RuntimeBindings["defaultPaletteTitle"];
  var numericTokenSuffixPattern: RuntimeBindings["numericTokenSuffixPattern"];
  var designColorTokenPattern: RuntimeBindings["designColorTokenPattern"];
  var designSystemSingleGroupCache: RuntimeBindings["designSystemSingleGroupCache"];
  var maxTypographyDesignTokens: RuntimeBindings["maxTypographyDesignTokens"];
  var maxTypographyTokenGroups: RuntimeBindings["maxTypographyTokenGroups"];
  var maxTypographyTokenFamilies: RuntimeBindings["maxTypographyTokenFamilies"];
  var maxTypographyTokenGroupNameLength: RuntimeBindings["maxTypographyTokenGroupNameLength"];
  var cssTypeTokenLengthPattern: RuntimeBindings["cssTypeTokenLengthPattern"];
  var safeFontTokenStringPattern: RuntimeBindings["safeFontTokenStringPattern"];
  var genericFontFamilyPattern: RuntimeBindings["genericFontFamilyPattern"];
  var roundTypeTokenValue: RuntimeBindings["roundTypeTokenValue"];
  var typeTokenLengthPixels: RuntimeBindings["typeTokenLengthPixels"];
  var fontWeightLabels: RuntimeBindings["fontWeightLabels"];
  var initializeDesignTokenParser: RuntimeBindings["initializeDesignTokenParser"];
  function parseColorNumberOrPercent(
    text: string,
    percentBase: number,
  ): number | undefined {
    if (text === "none") {
      return 0;
    }
    let value = /^(-?\d*\.?\d+(?:e-?\d+)?)(%?)$/.exec(text);
    if (value === null) {
      return;
    }
    if (value[2] === "%") {
      return (Number(value[1]) / 100) * percentBase;
    } else {
      return Number(value[1]);
    }
  }
  function parseColorHueDegrees(hue: string): number | undefined {
    let value = /^(-?\d*\.?\d+)(deg|rad|grad|turn)?$/.exec(
      hue === "none" ? "0" : hue,
    );
    if (value === null) {
      return;
    }
    return (
      (((Number(value[1]) *
        (value[2] === "rad"
          ? 180 / Math.PI
          : value[2] === "grad"
            ? 0.9
            : value[2] === "turn"
              ? 360
              : 1)) %
        360) +
        360) %
      360
    );
  }
  function splitColorFunctionChannels(
    value: string,
    functionName: string,
  ): ColorFunctionChannels | undefined {
    let value2 = new RegExp("^" + functionName + "\\((.*)\\)$").exec(value);
    if (value2 === null) {
      return;
    }
    let value3 = value2[1]!.trim().split(/\s*[,/]\s*|\s+/);
    if (value3.length === 3 || value3.length === 4) {
      return value3 as ColorFunctionChannels;
    } else {
      return undefined;
    }
  }
  function oklabToSrgb(lightness: number, a: number, b: number): RgbChannels {
    let value = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3,
      value2 = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3,
      value3 = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      linearSrgbToSrgb(
        4.0767416621 * value - 3.3077115913 * value2 + 0.2309699292 * value3,
      ),
      linearSrgbToSrgb(
        -1.2684380046 * value + 2.6097574011 * value2 - 0.3413193965 * value3,
      ),
      linearSrgbToSrgb(
        -0.0041960863 * value - 0.7034186147 * value2 + 1.707614701 * value3,
      ),
    ];
  }
  function labToSrgb(lightness: number, a: number, b: number): RgbChannels {
    let value = (lightness + 16) / 116,
      value2 = value + a / 500,
      value3 = value - b / 200,
      callback = (input: number): number =>
        input ** 3 > 0.008856451679035631
          ? input ** 3
          : (116 * input - 16) / 903.2962962962963,
      [items, items2, items3] = [
        callback(value2) * 0.96422,
        (lightness > 8 ? value ** 3 : lightness / 903.2962962962963) * 1,
        callback(value3) * 0.82521,
      ],
      value4 = 0.9555766 * items - 0.0230393 * items2 + 0.0631636 * items3,
      value5 = -0.0282895 * items + 1.0099416 * items2 + 0.0210077 * items3,
      value6 = 0.0122982 * items - 0.020483 * items2 + 1.3299098 * items3;
    return [
      linearSrgbToSrgb(
        3.2404542 * value4 - 1.5371385 * value5 - 0.4985314 * value6,
      ),
      linearSrgbToSrgb(
        -0.969266 * value4 + 1.8760108 * value5 + 0.041556 * value6,
      ),
      linearSrgbToSrgb(
        0.0556434 * value4 - 0.2040259 * value5 + 1.0572252 * value6,
      ),
    ];
  }
  function normalizeDesignTokenColor(color: string): string | undefined {
    let value = color.trim().toLowerCase();
    if (value.length > 96) {
      return;
    }
    let value2 = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1];
    if (value2 !== undefined) {
      let value8 =
        value2.length <= 4
          ? [...value2].map((input) => input + input).join("")
          : value2;
      return (
        "#" +
        (value8.endsWith("ff") && value8.length === 8
          ? value8.slice(0, 6)
          : value8)
      );
    }
    let value3 = /^(rgba?|hsla?|oklch|oklab|lab|lch)\(/.exec(value)?.[1],
      value4 =
        value3 !== undefined
          ? splitColorFunctionChannels(value, value3)
          : undefined;
    if (value3 === undefined || value4 === undefined) {
      return;
    }
    let value5 =
        value4[3] !== undefined ? parseColorNumberOrPercent(value4[3], 1) : 1,
      value6: RgbChannels | undefined;
    if (value3 === "rgb" || value3 === "rgba") {
      let [items, items2, items3] = [
        parseColorNumberOrPercent(value4[0], 255),
        parseColorNumberOrPercent(value4[1], 255),
        parseColorNumberOrPercent(value4[2], 255),
      ];
      if (items !== undefined && items2 !== undefined && items3 !== undefined) {
        value6 = [items / 255, items2 / 255, items3 / 255];
      }
    } else if (value3 === "hsl" || value3 === "hsla") {
      let [items, items2, items3] = [
        parseColorHueDegrees(value4[0]),
        parseColorNumberOrPercent(value4[1].replace(/%$/, ""), 100),
        parseColorNumberOrPercent(value4[2].replace(/%$/, ""), 100),
      ];
      if (items !== undefined && items2 !== undefined && items3 !== undefined) {
        let [items4, items5] = [
            clampColorChannel(items2 / 100),
            clampColorChannel(items3 / 100),
          ],
          callback = (input: number): number => {
            let value8 = (input + items / 30) % 12;
            return (
              items5 -
              items4 *
                Math.min(items5, 1 - items5) *
                Math.max(-1, Math.min(value8 - 3, 9 - value8, 1))
            );
          };
        value6 = [callback(0), callback(8), callback(4)];
      }
    } else if (value3 === "oklab" || value3 === "oklch") {
      let value8 = parseColorNumberOrPercent(value4[0], 1),
        value9 = parseColorNumberOrPercent(value4[1], 0.4),
        value10 =
          value3 === "oklab"
            ? parseColorNumberOrPercent(value4[2], 0.4)
            : undefined;
      if (value3 === "oklch") {
        let value11 = parseColorHueDegrees(value4[2]);
        if (value9 !== undefined && value11 !== undefined) {
          [value9, value10] = [
            Math.max(0, value9) * Math.cos((value11 * Math.PI) / 180),
            Math.max(0, value9) * Math.sin((value11 * Math.PI) / 180),
          ];
        }
      }
      if (
        value8 !== undefined &&
        value9 !== undefined &&
        value10 !== undefined
      ) {
        value6 = oklabToSrgb(clampColorChannel(value8), value9, value10);
      }
    } else {
      let value8 = parseColorNumberOrPercent(value4[0], 100),
        value9 = parseColorNumberOrPercent(
          value4[1],
          value3 === "lab" ? 125 : 150,
        ),
        value10 =
          value3 === "lab"
            ? parseColorNumberOrPercent(value4[2], 125)
            : undefined;
      if (value3 === "lch") {
        let value11 = parseColorHueDegrees(value4[2]);
        if (value9 !== undefined && value11 !== undefined) {
          [value9, value10] = [
            Math.max(0, value9) * Math.cos((value11 * Math.PI) / 180),
            Math.max(0, value9) * Math.sin((value11 * Math.PI) / 180),
          ];
        }
      }
      if (
        value8 !== undefined &&
        value9 !== undefined &&
        value10 !== undefined
      ) {
        value6 = labToSrgb(Math.max(0, Math.min(100, value8)), value9, value10);
      }
    }
    if (
      value6 === undefined ||
      value5 === undefined ||
      value6.some((input) => !Number.isFinite(input))
    ) {
      return;
    }
    let value7 =
      "#" +
      colorChannelToHex(value6[0]) +
      colorChannelToHex(value6[1]) +
      colorChannelToHex(value6[2]);
    if (value5 >= 1) {
      return value7;
    } else {
      return value7 + colorChannelToHex(value5);
    }
  }
  function commonTokenNamePrefix(names: string[]): string {
    if (names.length < 2) {
      return "";
    }
    let value = names[0]!,
      text = "";
    for (
      let value2 = value.indexOf("-");
      value2 > 0;
      value2 = value.indexOf("-", value2 + 1)
    ) {
      let value3 = value.slice(0, value2 + 1);
      if (
        !names.every(
          (items) => items.startsWith(value3) && items.length > value3.length,
        )
      ) {
        break;
      }
      if (names.some((input) => tokenHasGroupSuffix(input, value3))) {
        text = value3;
      }
    }
    return text;
  }
  function tokenGroupName(name: string, prefix: string = ""): string {
    let value =
        prefix !== "" && name.startsWith(prefix) && name.length > prefix.length
          ? name.slice(prefix.length)
          : name,
      value2 = numericTokenSuffixPattern.exec(value);
    if (value2 !== null && value2[1] !== undefined && value2[1] !== "") {
      return value2[1];
    }
    let value3 = value.indexOf("-");
    if (value3 > 0) {
      return value.slice(0, value3);
    } else {
      return value;
    }
  }
  function tokenHasGroupSuffix(name: string, prefix: string = ""): boolean {
    let value =
      prefix !== "" && name.startsWith(prefix) && name.length > prefix.length
        ? name.slice(prefix.length)
        : name;
    return tokenGroupName(name, prefix) !== value;
  }
  function groupColorTokenNames(names: string[]): ColorTokenGroup[] {
    let value = commonTokenNamePrefix(names),
      entries = new Map<string, string[]>();
    for (let value2 of names) {
      let value3 = tokenGroupName(value2, value),
        entry = entries.get(value3);
      if (entry === undefined) {
        entries.set(value3, (entry = []));
      }
      entry.push(value2);
    }
    let items: ColorTokenGroup[] = [],
      items2: string[] = [];
    for (let [value2, value3] of entries)
      if (value3.some((input) => tokenHasGroupSuffix(input, value))) {
        items.push({
          label: value2,
          names: value3,
        });
      } else {
        items2.push(...value3);
      }
    let entries2 = new Map<string, number>(
      names.map((input, options) => [input, options]),
    );
    items2.sort(
      (input, options) =>
        (entries2.get(input) ?? 0) - (entries2.get(options) ?? 0),
    );
    if (items2.length > 0) {
      return [
        {
          label: defaultPaletteTitle,
          names: items2,
        },
        ...items,
      ];
    } else {
      return items;
    }
  }
  function normalizeTokenName(name: unknown): string | undefined {
    if (typeof name !== "string") {
      return;
    }
    let value = name.replace(/^(--|\.)/, "");
    if (designTokenNamePattern.test(value)) {
      return value;
    } else {
      return undefined;
    }
  }
  function boundedNonemptyString(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (typeof value !== "string" || value.trim() === "") {
      return;
    }
    let value2 = value.trim();
    if (value2.length > maxLength) {
      return Array.from(value2).slice(0, maxLength).join("");
    } else {
      return value2;
    }
  }
  function designSystemName(tokens?: RawRecord): string | undefined {
    return boundedNonemptyString(tokens?.name, 80);
  }
  function createDesignSystemPalette(
    title: string | undefined,
    url: string | undefined,
    mode: unknown,
    colors: DesignColorToken[],
    typography: DesignTypeToken[] = [],
  ): DesignSystem | undefined {
    if (colors.length === 0 && typography.length === 0) {
      return;
    }
    let value = boundedNonemptyString(url, 2000),
      value2 = boundedNonemptyString(mode, 80);
    return {
      title: boundedNonemptyString(title, 80) ?? "Design system",
      ...(value !== undefined && /^https:\/\//.test(value)
        ? {
            url: value,
          }
        : {}),
      ...(value2 !== undefined
        ? {
            theme: value2,
          }
        : {}),
      colors: colors,
      ...(typography.length > 0
        ? {
            type: typography,
          }
        : {}),
    };
  }
  function designSystemColorGrouping(
    system: DesignSystem,
    color: DesignColorToken,
  ): DesignTokenGrouping {
    if (designSystemHasSingleColorGroup(system)) {
      return {
        group: system.title,
      };
    } else {
      return {
        group: system.title,
        subgroup: color.group,
      };
    }
  }
  function designSystemHasSingleColorGroup(system: DesignSystem): boolean {
    let entry = designSystemSingleGroupCache.get(system);
    if (entry === undefined) {
      designSystemSingleGroupCache.set(
        system,
        (entry = system.colors.every(
          (input) => input.group === system.colors[0]!.group,
        )),
      );
    }
    return entry;
  }
  function designSystemTypeGrouping(
    system: DesignSystem,
    typography: DesignTypeToken,
  ): DesignTokenGrouping {
    let value = system.type ?? [];
    if (value.every((input) => input.group === value[0]!.group)) {
      return {
        group: system.title,
      };
    } else {
      return {
        group: system.title,
        subgroup: typography.group,
      };
    }
  }
  function normalizeDesignSystemPayload(
    payload: unknown,
  ): DesignSystem | undefined {
    if (typeof payload !== "object" || payload === null) {
      return;
    }
    let value = payload as RawRecord;
    return parseDesignTokens(value.tokens as RawRecord | undefined, {
      title: boundedNonemptyString(value.title, 80),
      url: boundedNonemptyString(value.url, 2000),
    });
  }
  function normalizeDesignSystems(payload: unknown): DesignSystem[] {
    if (typeof payload !== "object" || payload === null) {
      return [];
    }
    let value = payload as RawRecord;
    if (
      value.systems === undefined &&
      ((typeof value.color === "object" && value.color !== null) ||
        (typeof value.type === "object" && value.type !== null))
    ) {
      return normalizeDesignSystems({
        v: 1,
        systems: [
          {
            tokens: payload,
          },
        ],
      });
    }
    if (
      (value.v !== undefined && value.v !== 1) ||
      !Array.isArray(value.systems)
    ) {
      return [];
    }
    let value2 = value.systems
        .map(normalizeDesignSystemPayload)
        .filter((input) => input !== undefined),
      items: DesignSystem[] = [];
    for (let value3 of value2) {
      if (items.length >= 4) {
        break;
      }
      let title = value3.title;
      for (
        let count = 2;
        items.some((input) => input.title === title) ||
        (title !== value3.title &&
          value2.some((input) => input.title === title));
        count++
      )
        title = value3.title + " " + String(count);
      items.push(
        title === value3.title
          ? value3
          : {
              ...value3,
              title: title,
            },
      );
    }
    return items;
  }
  function parseColorDesignTokens(
    tokens?: RawRecord,
    metadata: DesignTokenMetadata = {},
    theme?: ColorTokenStats,
  ): DesignSystem | undefined {
    let value = tokens?.color as RawRecord | null | undefined;
    if (
      typeof value !== "object" ||
      value === null ||
      !Array.isArray(value.tokens)
    ) {
      return;
    }
    let value2: RawEntry[] = Array.isArray(value.themes)
        ? value.themes.map((input: RawEntry) => input)
        : [],
      value3 = value2
        .map((input) =>
          typeof input?.id === "string" ? input.id.toLowerCase() : undefined,
        )
        .filter((input) => input !== undefined),
      entries = new Map<string, number>();
    value3.forEach(
      (input, options) =>
        void (entries.has(input) || entries.set(input, options)),
    );
    let entries2 = new Map<string, string>();
    for (let value7 of value.tokens as RawEntry[]) {
      let value8 = value7,
        value9 = normalizeTokenName(value8?.name);
      if (value9 === undefined || entries2.has(value9)) {
        continue;
      }
      let value10 = value8?.value,
        value11 = typeof value10 === "string" ? value10 : undefined;
      if (
        typeof value10 === "object" &&
        value10 !== null &&
        !Array.isArray(value10)
      ) {
        let entries4 = new Map<string, unknown>(
            Object.entries(value10 as RawRecord).map(([input, input2]) => [
              input.toLowerCase(),
              input2,
            ]),
          ),
          value12 = 1 / 0;
        for (let [value13, value14] of entries4) {
          if (typeof value14 !== "string") {
            continue;
          }
          let entry = entries.get(value13);
          if (
            entry !== undefined
              ? entry < value12
              : value12 === 1 / 0 && value11 === undefined
          ) {
            value11 = value14;
            if (entry !== undefined) {
              value12 = entry;
            }
          }
        }
      }
      entries2.set(value9, typeof value11 === "string" ? value11.trim() : "");
    }
    let callback = (input: string, options: number): string | undefined => {
        let value7 = /^\{(.+)\}$/.exec(input)?.[1];
        if (value7 === undefined) {
          return normalizeDesignTokenColor(input);
        }
        let entry = entries2.get(normalizeTokenName(value7) ?? "");
        if (entry !== undefined && options < 16) {
          return callback(entry, options + 1);
        } else {
          return undefined;
        }
      },
      entries3 = new Map<string, string>(),
      state: ColorTokenStats = {
        total: entries2.size,
        unresolved: 0,
        truncated: 0,
      };
    for (let [value7, value8] of entries2) {
      let value9 = callback(value8, 0);
      if (value9 === undefined) {
        state.unresolved++;
      } else if (entries3.size >= 600) {
        state.truncated++;
      } else {
        entries3.set(value7, value9);
      }
    }
    if (theme !== undefined) {
      Object.assign(theme, state);
    }
    let value4 = [...entries2]
        .filter(
          ([input, input2]) =>
            entries3.has(input) || designColorTokenPattern.test(input2),
        )
        .map(([input]) => input),
      value5: DesignColorToken[] = groupColorTokenNames(value4).flatMap(
        (input) =>
          input.names.flatMap((input2) =>
            entries3.has(input2)
              ? [
                  {
                    name: input2,
                    value: entries3.get(input2)!,
                    group: input.label,
                  },
                ]
              : [],
          ),
      ),
      value6 = value2.find((input) => typeof input?.id === "string");
    return createDesignSystemPalette(
      boundedNonemptyString(metadata.title, 80) ?? designSystemName(tokens),
      metadata.url,
      typeof value6?.name === "string" ? value6.name : value6?.id,
      value5,
    );
  }
  function parseDesignTokens(
    tokens?: RawRecord,
    metadata: DesignTokenMetadata = {},
    theme?: ColorTokenStats,
  ): DesignSystem | undefined {
    let value = parseColorDesignTokens(tokens, metadata, theme),
      value2 = parseTypographyDesignTokens(tokens);
    if (value2.length === 0) {
      return value;
    }
    if (value !== undefined) {
      return {
        ...value,
        type: value2,
      };
    } else {
      return createDesignSystemPalette(
        boundedNonemptyString(metadata.title, 80) ?? designSystemName(tokens),
        metadata.url,
        undefined,
        [],
        value2,
      );
    }
  }
  function isSafeFontTokenString(value: string): boolean {
    if (
      !safeFontTokenStringPattern.test(value) ||
      value.includes("/*") ||
      value.includes("*/")
    ) {
      return false;
    }
    let value2: string | null = null;
    for (let value3 of value)
      if (value2 === null) {
        value2 = value3 === '"' || value3 === "'" ? value3 : null;
      } else if (value3 === value2) {
        value2 = null;
      }
    return value2 === null;
  }
  function parseTypeTokenLength(value: unknown): TypeTokenLength | undefined {
    if (typeof value === "number") {
      if (Number.isFinite(value) && Math.abs(value) < 1e4) {
        return {
          n: roundTypeTokenValue(value),
          unit: "px",
        };
      } else {
        return undefined;
      }
    }
    if (typeof value !== "string") {
      return;
    }
    let value2 = value.trim().toLowerCase();
    if (value2 === "0") {
      return {
        n: 0,
        unit: "px",
      };
    }
    let value3 = cssTypeTokenLengthPattern.exec(value2);
    if (value3 === null) {
      return undefined;
    } else {
      return {
        n: Number(value3[1]),
        unit: value3[2]!,
      };
    }
  }
  function isGenericFontFamily(family: string): boolean {
    return genericFontFamilyPattern.test(family);
  }
  function parseTypeTokenFontFamily(value: string): DesignTypeFamily {
    let value2 =
        /^\s*(?:"([^"]{1,80})"|'([^']{1,80})'|([A-Za-z0-9 _-]{1,80}))/.exec(
          value,
        ),
      value3 = (value.split(",").pop() ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
      value4: DesignTypeFamily["generic"] = /mono/.test(value3)
        ? "mono"
        : /(^|ui-)serif$/.test(value3)
          ? "serif"
          : "sans";
    return {
      name: (value2?.[1] ?? value2?.[2] ?? value2?.[3] ?? "").trim(),
      stack: value,
      generic: value4,
    };
  }
  function parseTypographyDesignTokens(tokens?: RawRecord): DesignTypeToken[] {
    let value = tokens?.type as RawRecord | null | undefined;
    if (typeof value !== "object" || value === null) {
      return [];
    }
    let entries = new Map<string, string>();
    if (
      typeof value.families === "object" &&
      value.families !== null &&
      !Array.isArray(value.families)
    ) {
      for (let [value2, value3] of Object.entries(
        value.families as RawRecord,
      )) {
        if (entries.size >= maxTypographyTokenFamilies) {
          break;
        }
        let value4 = value2.trim().toLowerCase();
        if (
          designTokenNamePattern.test(value4) &&
          typeof value3 === "string" &&
          isSafeFontTokenString(value3.trim())
        ) {
          entries.set(value4, value3.trim());
        }
      }
    }
    let callback = (input: unknown): string =>
        typeof input === "string" && entries.has(input.trim().toLowerCase())
          ? input.trim().toLowerCase()
          : "",
      items: DesignTypeToken[] = [],
      values = new Set<string>(),
      index = 0;
    for (let value2 of (Array.isArray(value.groups)
      ? value.groups
      : []) as unknown[]) {
      if (index >= maxTypographyTokenGroups) {
        break;
      }
      if (
        typeof value2 !== "object" ||
        value2 === null ||
        Array.isArray(value2)
      ) {
        continue;
      }
      let value3 = value2 as RawRecord;
      index++;
      let value4 =
          (typeof value3.name === "string"
            ? [...value3.name]
                .slice(0, maxTypographyTokenGroupNameLength)
                .join("")
            : "") || "Type",
        value5 = callback(value3.family);
      for (let value6 of (Array.isArray(value3.styles)
        ? value3.styles
        : []) as unknown[]) {
        if (values.size >= maxTypographyDesignTokens) {
          break;
        }
        if (
          typeof value6 !== "object" ||
          value6 === null ||
          Array.isArray(value6)
        ) {
          continue;
        }
        let value7 = value6 as RawRecord,
          value8 =
            typeof value7.name === "string"
              ? value7.name.trim().replace(/^\./, "")
              : "",
          value9 = parseTypeTokenLength(value7.fontSize);
        if (
          !designTokenNamePattern.test(value8) ||
          values.has(value8) ||
          value9 === undefined
        ) {
          continue;
        }
        values.add(value8);
        let value10 = roundTypeTokenValue(typeTokenLengthPixels(value9));
        if (value10 <= 0) {
          continue;
        }
        let value11 =
            typeof value7.lineHeight === "string"
              ? value7.lineHeight.trim()
              : value7.lineHeight,
          value12 =
            typeof value11 === "number"
              ? value11
              : typeof value11 === "string" &&
                  /^\d(?:\.\d{1,6})?$/.test(value11)
                ? Number(value11)
                : undefined,
          count = 1.4;
        if (value12 !== undefined && value12 > 0 && value12 < 10) {
          count = roundTypeTokenValue(value12);
        } else if (typeof value11 !== "string" || value12 === undefined) {
          let value17 = parseTypeTokenLength(value11);
          if (value17 !== undefined) {
            count =
              value17.n >= 0
                ? roundTypeTokenValue(typeTokenLengthPixels(value17) / value10)
                : 1.3;
          }
        }
        let fontWeight = value7.fontWeight,
          value13 =
            typeof fontWeight === "number" &&
            Number.isInteger(fontWeight) &&
            fontWeight >= 1 &&
            fontWeight <= 1000
              ? fontWeight
              : typeof fontWeight === "string"
                ? fontWeight.trim() === "bold"
                  ? 700
                  : /^(?:[1-9]\d{0,2}|1000)(?:\s+(?:[1-9]\d{0,2}|1000))?$/.test(
                        fontWeight.trim(),
                      )
                    ? Number(fontWeight.trim().split(/\s+/)[0])
                    : 400
                : 400,
          value14 = parseTypeTokenLength(value7.letterSpacing),
          value15 =
            value14 === undefined
              ? 0
              : roundTypeTokenValue(
                  value14.unit === "em"
                    ? value14.n * value10
                    : value14.unit === "%"
                      ? (value14.n / 100) * value10
                      : value14.unit === "rem"
                        ? value14.n * 16
                        : value14.n,
                ),
          value16 = callback(value7.family) || value5;
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
                family: parseTypeTokenFontFamily(entries.get(value16)!),
              }
            : {}),
        });
      }
    }
    return items;
  }
  function typographyTokenSubtitle(typography: DesignTypeToken): string {
    let callback = (input: number): string =>
      String(Math.round(input * 10) / 10);
    return (
      (typography.family !== undefined && typography.family.name !== ""
        ? typography.family.name + " · "
        : "") +
      callback(typography.fontSize) +
      "/" +
      String(Math.round(typography.fontSize * typography.lineHeight)) +
      " · " +
      (fontWeightLabels[typography.fontWeight] ??
        String(typography.fontWeight)) +
      (typography.italic ? " · italic" : "")
    );
  }
  bindRuntimeValue(
    runtime,
    "parseColorNumberOrPercent",
    () => parseColorNumberOrPercent,
  );
  bindRuntimeValue(runtime, "parseColorHueDegrees", () => parseColorHueDegrees);
  bindRuntimeValue(
    runtime,
    "splitColorFunctionChannels",
    () => splitColorFunctionChannels,
  );
  bindRuntimeValue(runtime, "oklabToSrgb", () => oklabToSrgb);
  bindRuntimeValue(runtime, "labToSrgb", () => labToSrgb);
  bindRuntimeValue(
    runtime,
    "normalizeDesignTokenColor",
    () => normalizeDesignTokenColor,
  );
  bindRuntimeValue(
    runtime,
    "commonTokenNamePrefix",
    () => commonTokenNamePrefix,
  );
  bindRuntimeValue(runtime, "tokenGroupName", () => tokenGroupName);
  bindRuntimeValue(runtime, "tokenHasGroupSuffix", () => tokenHasGroupSuffix);
  bindRuntimeValue(runtime, "groupColorTokenNames", () => groupColorTokenNames);
  bindRuntimeValue(runtime, "normalizeTokenName", () => normalizeTokenName);
  bindRuntimeValue(
    runtime,
    "boundedNonemptyString",
    () => boundedNonemptyString,
  );
  bindRuntimeValue(runtime, "designSystemName", () => designSystemName);
  bindRuntimeValue(
    runtime,
    "createDesignSystemPalette",
    () => createDesignSystemPalette,
  );
  bindRuntimeValue(
    runtime,
    "designSystemColorGrouping",
    () => designSystemColorGrouping,
  );
  bindRuntimeValue(
    runtime,
    "designSystemHasSingleColorGroup",
    () => designSystemHasSingleColorGroup,
  );
  bindRuntimeValue(
    runtime,
    "designSystemTypeGrouping",
    () => designSystemTypeGrouping,
  );
  bindRuntimeValue(
    runtime,
    "normalizeDesignSystemPayload",
    () => normalizeDesignSystemPayload,
  );
  bindRuntimeValue(
    runtime,
    "normalizeDesignSystems",
    () => normalizeDesignSystems,
  );
  bindRuntimeValue(
    runtime,
    "parseColorDesignTokens",
    () => parseColorDesignTokens,
  );
  bindRuntimeValue(runtime, "parseDesignTokens", () => parseDesignTokens);
  bindRuntimeValue(
    runtime,
    "isSafeFontTokenString",
    () => isSafeFontTokenString,
  );
  bindRuntimeValue(runtime, "parseTypeTokenLength", () => parseTypeTokenLength);
  bindRuntimeValue(runtime, "isGenericFontFamily", () => isGenericFontFamily);
  bindRuntimeValue(
    runtime,
    "parseTypeTokenFontFamily",
    () => parseTypeTokenFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "parseTypographyDesignTokens",
    () => parseTypographyDesignTokens,
  );
  bindRuntimeValue(
    runtime,
    "typographyTokenSubtitle",
    () => typographyTokenSubtitle,
  );
  bindRuntimeValue(
    runtime,
    "designSystemsCapabilityName",
    () => designSystemsCapabilityName,
    (value) => {
      designSystemsCapabilityName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designTokenNamePattern",
    () => designTokenNamePattern,
    (value) => {
      designTokenNamePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampColorChannel",
    () => clampColorChannel,
    (value) => {
      clampColorChannel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "colorChannelToHex",
    () => colorChannelToHex,
    (value) => {
      colorChannelToHex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linearSrgbToSrgb",
    () => linearSrgbToSrgb,
    (value) => {
      linearSrgbToSrgb = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultPaletteTitle",
    () => defaultPaletteTitle,
    (value) => {
      defaultPaletteTitle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numericTokenSuffixPattern",
    () => numericTokenSuffixPattern,
    (value) => {
      numericTokenSuffixPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designColorTokenPattern",
    () => designColorTokenPattern,
    (value) => {
      designColorTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemSingleGroupCache",
    () => designSystemSingleGroupCache,
    (value) => {
      designSystemSingleGroupCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTypographyDesignTokens",
    () => maxTypographyDesignTokens,
    (value) => {
      maxTypographyDesignTokens = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTypographyTokenGroups",
    () => maxTypographyTokenGroups,
    (value) => {
      maxTypographyTokenGroups = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTypographyTokenFamilies",
    () => maxTypographyTokenFamilies,
    (value) => {
      maxTypographyTokenFamilies = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxTypographyTokenGroupNameLength",
    () => maxTypographyTokenGroupNameLength,
    (value) => {
      maxTypographyTokenGroupNameLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssTypeTokenLengthPattern",
    () => cssTypeTokenLengthPattern,
    (value) => {
      cssTypeTokenLengthPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "safeFontTokenStringPattern",
    () => safeFontTokenStringPattern,
    (value) => {
      safeFontTokenStringPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "genericFontFamilyPattern",
    () => genericFontFamilyPattern,
    (value) => {
      genericFontFamilyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roundTypeTokenValue",
    () => roundTypeTokenValue,
    (value) => {
      roundTypeTokenValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typeTokenLengthPixels",
    () => typeTokenLengthPixels,
    (value) => {
      typeTokenLengthPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontWeightLabels",
    () => fontWeightLabels,
    (value) => {
      fontWeightLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDesignTokenParser",
    () => initializeDesignTokenParser,
    (value) => {
      initializeDesignTokenParser = value;
    },
  );
  return () => {
    designSystemsCapabilityName = "design-systems";
    clampColorChannel = (input) =>
      Math.max(0, Math.min(1, input));
    colorChannelToHex = (input) =>
      Math.round(clampColorChannel(input) * 255)
        .toString(16)
        .padStart(2, "0");
    linearSrgbToSrgb = (input) =>
      input <= 0.0031308
        ? 12.92 * input
        : 1.055 * Math.pow(input, 0.4166666666666667) - 0.055;
    defaultPaletteTitle = "Palette";
    maxTypographyDesignTokens = 80;
    maxTypographyTokenGroups = 12;
    maxTypographyTokenFamilies = 12;
    maxTypographyTokenGroupNameLength = 120;
    roundTypeTokenValue = (input) =>
      Math.round(input * 1000) / 1000;
    typeTokenLengthPixels = (input) =>
      input.unit === "rem" || input.unit === "em" ? input.n * 16 : input.n;
    initializeDesignTokenParser = (0, runtime.initializeOnce)((): void => {
      designTokenNamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
      numericTokenSuffixPattern = /^(.*?)-\d{1,4}$/;
      designColorTokenPattern =
        /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgba?|hsla?|oklch|oklab|lab|lch|color)\([0-9a-z.,%/ \-]{1,60}\)|\{.+\})$/i;
      designSystemSingleGroupCache = new WeakMap();
      cssTypeTokenLengthPattern = /^(-?\d{1,4}(?:\.\d{1,6})?)(px|rem|em|%)$/;
      safeFontTokenStringPattern = /^[^;{}<>()\\\r\n\f]{1,200}$/;
      genericFontFamilyPattern =
        /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong|-apple-system|blinkmacsystemfont)$/i;
      fontWeightLabels = {
        300: "Light",
        330: "Book",
        400: "Regular",
        430: "Text",
        500: "Medium",
        600: "Semibold",
        700: "Bold",
        800: "Heavy",
      };
    });
  };
}
