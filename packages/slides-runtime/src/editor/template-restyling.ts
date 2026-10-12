/** Restored application module; prepare first, initialize in original order. */
import type {
  Frame,
  GradientStop,
  OverlayLayer,
  Slide,
  SlideColor,
  SlideNode,
  TextNode,
  TextRole,
} from "../deck-contracts";
import type {
  TypographyCombo,
  TypographyStyle,
  TypographyTheme,
} from "../model/typography";
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** How a text role is treated when picking its colour in a restyled slide. */
export type RestyleTextInk = "heading" | "label" | "plain";
/** What a template restyler keeps of the slide being replaced. */
export interface TemplateRestylerOptions {
  /** The slide whose background and type styles the result adopts. */
  current: Slide | undefined;
  slides: readonly Slide[];
  typeStyles: TypographyStyle[];
  theme: TypographyTheme;
}
/** Restyles a template slide to look like the current deck. */
export type TemplateRestyler = (slide: Slide) => Slide;
/** A text node of the deck with the facts that decide its colour. */
interface RestyleTextSample {
  color: SlideColor | undefined;
  style: TextRole | undefined;
  ink: RestyleTextInk;
}
/** A colour with how often it occurs. */
interface RestyleColorCount {
  first: SlideColor | undefined;
  n: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    HEADING_TEXT_ROLES: Set<TextRole>;
    RESTYLE_ROLE_FALLBACKS: Record<TextRole, TextRole[]>;
    classifyRestyleTextRole: (
      role: TextRole,
      label: boolean,
    ) => RestyleTextInk;
    normalizeRestyleColor: (
      color: SlideColor | undefined,
    ) => string | undefined;
    hexColorToRgbUnit: (color: string) => number[];
    compositeColorOverBackground: (
      foreground: string,
      background: string,
    ) => number[];
    rgbUnitToHexColor: (rgb: readonly number[]) => string;
    restyleColorContrast: (foreground: string, background: string) => number;
    MIN_RESTYLE_TEXT_CONTRAST: number;
    isRestyleNodeTranslucent: (node: SlideNode) => boolean;
    colorHasOpaqueBackground: (color: SlideColor | undefined) => boolean;
    nodeProvidesRestyleBackground: (node: SlideNode) => boolean;
    subtreeProvidesRestyleBackground: (node: SlideNode) => boolean;
    iterateUnbackedTextNodes: (node: SlideNode) => Generator<TextNode, void>;
    mostCommonRestyleColor: (
      colors: Iterable<SlideColor | undefined>,
    ) => SlideColor | undefined;
    recursivelyRestyleNode: (
      node: SlideNode,
      restyle: (node: SlideNode) => SlideNode,
    ) => SlideNode;
    createTemplateRestyler: (
      options: TemplateRestylerOptions,
    ) => TemplateRestyler;
  }
}

export function installEditorTemplateRestyling(
  runtime: RuntimeBindings,
): () => void {
  var HEADING_TEXT_ROLES: RuntimeBindings["HEADING_TEXT_ROLES"];
  var RESTYLE_ROLE_FALLBACKS: RuntimeBindings["RESTYLE_ROLE_FALLBACKS"];
  var hexColorToRgbUnit: RuntimeBindings["hexColorToRgbUnit"];
  var rgbUnitToHexColor: RuntimeBindings["rgbUnitToHexColor"];
  var MIN_RESTYLE_TEXT_CONTRAST: RuntimeBindings["MIN_RESTYLE_TEXT_CONTRAST"];
  var isRestyleNodeTranslucent: RuntimeBindings["isRestyleNodeTranslucent"];
  function classifyRestyleTextRole(
    role: TextRole,
    label: boolean,
  ): RestyleTextInk {
    if (HEADING_TEXT_ROLES.has(role)) {
      return "heading";
    } else {
      if (role === "eyebrow" || label) {
        return "label";
      } else {
        return "plain";
      }
    }
  }
  function normalizeRestyleColor(
    color: SlideColor | undefined,
  ): string | undefined {
    let normalized: string | undefined = (0, runtime.resolveSlideColor)(
      color,
    )?.toLowerCase();
    if (normalized === undefined) {
      return;
    }
    if (normalized.length === 4 || normalized.length === 5) {
      return (
        "#" +
        [...normalized.slice(1)]
          .map((input: string): string => input + input)
          .join("")
      );
    } else {
      if (normalized.length === 7 || normalized.length === 9) {
        return normalized;
      } else {
        return (0, runtime.stripHexAlpha)(normalized).toLowerCase();
      }
    }
  }
  function compositeColorOverBackground(
    foreground: string,
    background: string,
  ): number[] {
    let alpha =
        foreground.length === 9
          ? parseInt(foreground.slice(7, 9), 16) / 255
          : 1,
      backgroundRgb = hexColorToRgbUnit(background);
    return hexColorToRgbUnit(foreground).map(
      (input: number, options: number): number =>
        alpha * input + (1 - alpha) * backgroundRgb[options]!,
    );
  }
  function restyleColorContrast(
    foreground: string,
    background: string,
  ): number {
    let foregroundColor = (0, runtime.parseContrastColor)(foreground),
      backgroundColor = (0, runtime.parseContrastColor)(background);
    if (foregroundColor === undefined || backgroundColor === undefined) {
      return 1;
    } else {
      return (0, runtime.contrastRatio)(foregroundColor, backgroundColor);
    }
  }
  function colorHasOpaqueBackground(color: SlideColor | undefined): boolean {
    let normalized = normalizeRestyleColor(color);
    return (
      normalized !== undefined &&
      (normalized.length < 9 || parseInt(normalized.slice(7, 9), 16) > 127)
    );
  }
  function nodeProvidesRestyleBackground(node: SlideNode): boolean {
    if (isRestyleNodeTranslucent(node)) {
      return false;
    }
    return (
      colorHasOpaqueBackground(node.style?.backgroundColor) ||
      node.style?.backgroundGradient !== undefined ||
      node.kind === "img" ||
      node.kind === "html" ||
      node.kind === "shape" ||
      (node.kind === "overlay" && nodeProvidesRestyleBackground(node.base))
    );
  }
  function subtreeProvidesRestyleBackground(node: SlideNode): boolean {
    return (
      nodeProvidesRestyleBackground(node) ||
      (!isRestyleNodeTranslucent(node) &&
        ((0, runtime.nodeChildren)(node) ?? []).some(
          subtreeProvidesRestyleBackground,
        ))
    );
  }
  function* iterateUnbackedTextNodes(
    node: SlideNode,
  ): Generator<TextNode, void> {
    if (nodeProvidesRestyleBackground(node) || isRestyleNodeTranslucent(node)) {
      return;
    }
    if (node.kind === "text") {
      yield node;
    } else if (node.kind === "overlay") {
      yield* iterateUnbackedTextNodes(node.base);
      if (subtreeProvidesRestyleBackground(node.base)) {
        return;
      }
      for (let value of node.layers) {
        if (subtreeProvidesRestyleBackground(value.node)) {
          break;
        }
        yield* iterateUnbackedTextNodes(value.node);
      }
    } else {
      for (let value of (0, runtime.nodeChildren)(node) ?? [])
        yield* iterateUnbackedTextNodes(value);
    }
  }
  function mostCommonRestyleColor(
    colors: Iterable<SlideColor | undefined>,
  ): SlideColor | undefined {
    let counts = new Map<string | undefined, RestyleColorCount>();
    for (let value of colors) {
      let value2 = normalizeRestyleColor(value),
        value3: RestyleColorCount = counts.get(value2) ?? {
          first: value,
          n: 0,
        };
      value3.n += 1;
      counts.set(value2, value3);
    }
    return [...counts.values()].sort(
      (input: RestyleColorCount, options: RestyleColorCount): number =>
        options.n - input.n,
    )[0]?.first;
  }
  function recursivelyRestyleNode(
    node: SlideNode,
    restyle: (node: SlideNode) => SlideNode,
  ): SlideNode {
    if ((0, runtime.isFlowContainer)(node)) {
      return restyle({
        ...node,
        children: node.children.map(
          (input: SlideNode): SlideNode => recursivelyRestyleNode(input, restyle),
        ),
      });
    }
    if (node.kind === "overlay") {
      return restyle({
        ...node,
        base: recursivelyRestyleNode(node.base, restyle),
        layers: node.layers.map(
          (input: OverlayLayer): OverlayLayer => ({
            ...input,
            node: recursivelyRestyleNode(input.node, restyle),
          }),
        ),
      });
    }
    return restyle(node);
  }
  function createTemplateRestyler(
    options: TemplateRestylerOptions,
  ): TemplateRestyler {
    let {
      current: current,
      slides: slides,
      typeStyles: typeStyles,
      theme: theme,
    } = options;
    if (current === undefined) {
      return (input: Slide): Slide => input;
    }
    let value = (0, runtime.isGradientBackgroundSlide)(current)
        ? current.frames[0]
        : undefined,
      callback = (input: Slide, options2: Frame[]): Slide => ({
        ...input,
        bg: current.bg,
        frames: [
          ...(value
            ? [
                {
                  ...value,
                  id: (0, runtime.deterministicEmbedId)(input.id, 0),
                },
              ]
            : []),
          ...options2,
        ],
      }),
      value2 = (0, runtime.defaultBodyTypographyStyle)(typeStyles);
    if (value2 === null) {
      return (input: Slide): Slide =>
        input.frames.length === 0 ? callback(input, []) : input;
    }
    let value3 = typeStyles.filter(
        (input: TypographyStyle): boolean => input.count > 0,
      ),
      callback2 = (input: string): TypographyStyle | undefined =>
        value3.find((input2: TypographyStyle): boolean => input2.id === input),
      callback3 = (input: TextRole): TypographyStyle | TypographyCombo => {
        let value7 =
          callback2(input) ??
          (input === "display" ? callback2("h1") : undefined);
        if (value7 !== undefined) {
          return value7;
        }
        let value8 = (0, runtime.typeScaleForRole)(input, theme),
          callback12 = (
            input2: TypographyCombo,
            options2: boolean,
          ): TypographyCombo => ({
            role: input,
            fontFamily: input2.fontFamily,
            fontSize: Math.min(
              400,
              Math.max(
                8,
                Math.round(
                  (value8.fontSize * input2.fontSize) /
                    (0, runtime.typeScaleForRole)(input2.role, theme).fontSize,
                ),
              ),
            ),
            fontWeight: options2 ? input2.fontWeight : value8.fontWeight,
            italic: options2 && input2.italic,
            lineHeight: value8.lineHeight,
            letterSpacing: 0,
          }),
          value9 = RESTYLE_ROLE_FALLBACKS[input]
            .map(callback2)
            .find(
              (input2: TypographyStyle | undefined): boolean =>
                input2 !== undefined,
            );
        if (HEADING_TEXT_ROLES.has(input)) {
          if (value9 !== undefined) {
            return callback12(value9, true);
          } else {
            return callback12(value2, false);
          }
        }
        let value10 = value9 ?? value2;
        if (
          HEADING_TEXT_ROLES.has(value10.role) ||
          (input !== "eyebrow" &&
            (value10.role === "eyebrow" ||
              (0, runtime.typographyIsEmphasized)(value10)))
        ) {
          return callback12(value10, false);
        } else {
          return value10;
        }
      },
      callback4 = (input: Slide): string =>
        String(normalizeRestyleColor(input.bg)?.slice(0, 7)) +
        ((0, runtime.isGradientBackgroundSlide)(input)
          ? JSON.stringify(input.frames[0]!.node.style?.backgroundGradient)
          : ""),
      value4 = (normalizeRestyleColor(current.bg) ?? "#ffffff").slice(0, 7),
      value5 = (value?.node.style?.backgroundGradient?.stops ?? []).flatMap(
        (input: GradientStop): string[] => {
        let value7 = normalizeRestyleColor(input.color);
        if (value7 !== undefined) {
          return [value7];
        } else {
          return [];
        }
      }),
      items: string[] = [
        ...(value5.length > 0 &&
        value5.every((items2: string): boolean => items2.length === 7)
          ? []
          : [value4]),
        ...value5.map(
          (input: string): string =>
            rgbUnitToHexColor(compositeColorOverBackground(input, value4)),
        ),
      ],
      callback5 = (input: Pick<Frame, "x" | "y">): boolean => {
        let value7 = (0, runtime.frameBounds)(input.x, input.y);
        return (
          value7.x <= 0 &&
          value7.y <= 0 &&
          value7.x + value7.w >= runtime.SLIDE_WIDTH &&
          value7.y + value7.h >= runtime.SLIDE_HEIGHT
        );
      },
      callback6 = (source: SlideNode): boolean =>
        nodeProvidesRestyleBackground(source) ||
        ((0, runtime.isFlowContainer)(source) &&
          source.children.length > 0 &&
          source.children.every(callback6)) ||
        (source.kind === "overlay" &&
          source.layers.some(
            (input: OverlayLayer): boolean =>
              callback5(input) && callback6(input.node),
          )),
      callback7 = (input: Frame): boolean =>
        callback6(input.node) && callback5(input),
      callback8 = (input: Slide): TextNode[] => {
        let value7 = (0, runtime.isGradientBackgroundSlide)(input)
          ? input.frames.slice(1)
          : input.frames;
        if (value7.some(callback7)) {
          return [];
        } else {
          return value7.flatMap((input2: Frame): TextNode[] => [
            ...iterateUnbackedTextNodes(input2.node),
          ]);
        }
      },
      value6: RestyleTextSample[] = [
        current,
        ...slides.filter(
          (input: Slide): boolean =>
            input !== current && callback4(input) === callback4(current),
        ),
      ]
        .flatMap(callback8)
        .map((input: TextNode): RestyleTextSample => {
          let value7 = (0, runtime.findTypographyStyle)(
            input,
            typeStyles,
            theme,
          )?.role;
          return {
            color: input.color,
            style: value7,
            ink: classifyRestyleTextRole(
              value7 ?? input.role,
              (0, runtime.typographyIsEmphasized)(
                (0, runtime.nodeTypographyCombo)(input, theme),
              ),
            ),
          };
        }),
      callback9 = (input: SlideColor | undefined): boolean => {
        let value7 = normalizeRestyleColor(input);
        return (
          value7 === undefined ||
          items.every(
            (input2: string): boolean =>
              restyleColorContrast(value7, input2) >= MIN_RESTYLE_TEXT_CONTRAST,
          )
        );
      },
      callback10 = (
        input: TextRole | undefined,
        options2: TextRole,
      ): SlideColor | undefined => {
        let items2: RestyleTextSample[][] = [
          value6.filter(
            (input2: RestyleTextSample): boolean =>
              input !== undefined && input2.style === input,
          ),
          value6.filter(
            (input2: RestyleTextSample): boolean =>
              input2.ink === classifyRestyleTextRole(options2, false),
          ),
          value6,
        ];
        for (let value7 of items2) {
          let value8 = value7
            .map((input2: RestyleTextSample): SlideColor | undefined => input2.color)
            .filter(callback9);
          if (value8.length > 0) {
            return mostCommonRestyleColor(value8);
          }
        }
        return;
      },
      callback11 = (source: SlideNode): SlideNode => {
        if (source.kind !== "text" && source.kind !== "table") {
          return source;
        }
        let value7 = callback3(source.kind === "text" ? source.role : "body"),
          value8 = "source" in value7 ? value7.role : undefined;
        if (source.kind === "table") {
          let value11 = normalizeRestyleColor(callback10(value8, "body")),
            {
              fontFamily: value12,
              fontSize: value13,
              lineHeight: value14,
              fontWeight: value15,
              italic: value16,
            } = value7;
          return {
            ...source,
            style: {
              ...source.style,
              ...(value12 !== undefined
                ? {
                    fontFamily: value12,
                  }
                : {}),
              fontSize: value13,
              lineHeight: value14,
              fontWeight: value15,
              ...(value16
                ? {
                    fontStyle: "italic",
                  }
                : {}),
              ...(value11 !== undefined
                ? {
                    color: value11,
                  }
                : {}),
            },
          };
        }
        let value9 = (0, runtime.applyTypographyStyle)(
            {
              ...source,
              style: {
                ...source.style,
                fontWeight: value7.fontWeight,
              },
            },
            value7 as TypographyStyle,
            theme,
          ),
          value10 = callback10(value8, source.role);
        if (value10 !== undefined) {
          return {
            ...value9,
            color: value10,
          };
        }
        delete value9.color;
        return value9;
      };
    return (input: Slide): Slide =>
      callback(
        input,
        input.frames.map(
          (input2: Frame): Frame => ({
            ...input2,
            node: recursivelyRestyleNode(input2.node, callback11),
          }),
        ),
      );
  }
  bindRuntimeValue(
    runtime,
    "HEADING_TEXT_ROLES",
    () => HEADING_TEXT_ROLES,
    (value) => {
      HEADING_TEXT_ROLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESTYLE_ROLE_FALLBACKS",
    () => RESTYLE_ROLE_FALLBACKS,
    (value) => {
      RESTYLE_ROLE_FALLBACKS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyRestyleTextRole",
    () => classifyRestyleTextRole,
  );
  bindRuntimeValue(
    runtime,
    "normalizeRestyleColor",
    () => normalizeRestyleColor,
  );
  bindRuntimeValue(
    runtime,
    "hexColorToRgbUnit",
    () => hexColorToRgbUnit,
    (value) => {
      hexColorToRgbUnit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compositeColorOverBackground",
    () => compositeColorOverBackground,
  );
  bindRuntimeValue(
    runtime,
    "rgbUnitToHexColor",
    () => rgbUnitToHexColor,
    (value) => {
      rgbUnitToHexColor = value;
    },
  );
  bindRuntimeValue(runtime, "restyleColorContrast", () => restyleColorContrast);
  bindRuntimeValue(
    runtime,
    "MIN_RESTYLE_TEXT_CONTRAST",
    () => MIN_RESTYLE_TEXT_CONTRAST,
    (value) => {
      MIN_RESTYLE_TEXT_CONTRAST = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRestyleNodeTranslucent",
    () => isRestyleNodeTranslucent,
    (value) => {
      isRestyleNodeTranslucent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "colorHasOpaqueBackground",
    () => colorHasOpaqueBackground,
  );
  bindRuntimeValue(
    runtime,
    "nodeProvidesRestyleBackground",
    () => nodeProvidesRestyleBackground,
  );
  bindRuntimeValue(
    runtime,
    "subtreeProvidesRestyleBackground",
    () => subtreeProvidesRestyleBackground,
  );
  bindRuntimeValue(
    runtime,
    "iterateUnbackedTextNodes",
    () => iterateUnbackedTextNodes,
  );
  bindRuntimeValue(
    runtime,
    "mostCommonRestyleColor",
    () => mostCommonRestyleColor,
  );
  bindRuntimeValue(
    runtime,
    "recursivelyRestyleNode",
    () => recursivelyRestyleNode,
  );
  bindRuntimeValue(
    runtime,
    "createTemplateRestyler",
    () => createTemplateRestyler,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeHtmlWriter)();
    (0, runtime.initializeHtmlCompiler)();
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeUiContrast)();
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeTypographyInference)();
    HEADING_TEXT_ROLES = new Set(["display", "h1", "h2", "h3"]);
    RESTYLE_ROLE_FALLBACKS = {
      display: ["h1", "h2", "h3"],
      h1: ["display", "h2", "h3"],
      h2: ["h1", "h3", "display"],
      h3: ["h2", "h1", "display"],
      lead: ["body", "caption"],
      eyebrow: ["caption", "body"],
      body: [],
      caption: ["body", "lead"],
    };
    hexColorToRgbUnit = (color: string): number[] =>
      [1, 3, 5].map(
        (input: number): number =>
          parseInt(color.slice(input, input + 2), 16) / 255,
      );
    rgbUnitToHexColor = (rgb: readonly number[]): string =>
      "#" +
      rgb
        .map(
          (input: number): string =>
            Math.round(input * 255)
              .toString(16)
              .padStart(2, "0"),
        )
        .join("");
    MIN_RESTYLE_TEXT_CONTRAST = 3;
    isRestyleNodeTranslucent = (node: SlideNode): boolean =>
      (node.style?.opacity ?? 1) <= 0.5;
  };
}
