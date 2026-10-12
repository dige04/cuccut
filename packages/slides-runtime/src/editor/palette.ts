/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide, SlideNode } from "../deck-contracts";

/** Receives every color value found on a node; values may be missing or not colors at all. */
export type PaletteColorVisitor = (color: unknown) => void;
interface PaletteGradient {
  stops?: Array<{ color?: unknown }>;
}
/** The color-carrying fields any slide node may have. */
interface ColorBearingNode {
  color?: unknown;
  fill?: { gradient?: PaletteGradient } | string | null;
  stroke?: unknown;
  marks?: Array<{ color?: unknown } | null | undefined>;
  style?: {
    backgroundColor?: unknown;
    borderColor?: unknown;
    color?: unknown;
    textDecorationColor?: unknown;
    textStrokeColor?: unknown;
    backgroundGradient?: PaletteGradient;
    boxShadow?: Array<{ color?: unknown }>;
    textShadow?: Array<{ color?: unknown }>;
  };
  cellStyles?: Record<string, { color?: unknown } | undefined>;
  rowStyles?: Record<string, { background?: unknown } | undefined>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    normalizePaletteColor: (color: unknown) => string | undefined;
    visitNodeColors: (node: SlideNode, visitColor: PaletteColorVisitor) => void;
    collectPresentationPalette: (
      slides: readonly Slide[],
      limit?: number,
    ) => string[];
  }
}

export function installEditorPalette(runtime: RuntimeBindings): () => void {
  function normalizePaletteColor(color: unknown): string | undefined {
    if (typeof color !== "string") {
      return;
    }
    let normalized = (
      (0, runtime.resolveSlideColor)(color.trim()) ?? color.trim()
    ).toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(normalized)) {
      return (
        "#" +
        normalized[1] +
        normalized[1] +
        normalized[2] +
        normalized[2] +
        normalized[3] +
        normalized[3]
      );
    }
    if (/^#[0-9a-f]{4}$/.test(normalized)) {
      return normalizePaletteColor(
        "#" +
          normalized[1] +
          normalized[1] +
          normalized[2] +
          normalized[2] +
          normalized[3] +
          normalized[3] +
          normalized[4] +
          normalized[4],
      );
    }
    if (/^#[0-9a-f]{6}$/.test(normalized)) {
      return normalized;
    }
    if (/^#[0-9a-f]{8}$/.test(normalized)) {
      if (parseInt(normalized.slice(7, 9), 16) < 51) {
        return undefined;
      } else {
        if (normalized.endsWith("ff")) {
          return normalized.slice(0, 7);
        } else {
          return normalized;
        }
      }
    }
    return;
  }
  function visitNodeColors(
    node: SlideNode,
    visitColor: PaletteColorVisitor,
  ): void {
    let currentNode = node as ColorBearingNode;
    visitColor(currentNode.color);
    if (typeof currentNode.fill === "object" && currentNode.fill !== null) {
      for (let value of currentNode.fill.gradient?.stops ?? [])
        visitColor(value.color);
    }
    visitColor(currentNode.stroke);
    if (Array.isArray(currentNode.marks)) {
      for (let value of currentNode.marks) visitColor(value?.color);
    }
    let style = currentNode.style;
    if (style) {
      visitColor(style.backgroundColor);
      visitColor(style.borderColor);
      visitColor(style.color);
      visitColor(style.textDecorationColor);
      visitColor(style.textStrokeColor);
      let backgroundGradient = style.backgroundGradient;
      for (let value of backgroundGradient?.stops ?? [])
        visitColor(value.color);
      for (let value of ["boxShadow", "textShadow"] as const) {
        let value2 = style[value];
        if (Array.isArray(value2)) {
          for (let value3 of value2) visitColor(value3.color);
        }
      }
    }
    for (let value of (0, runtime.nodeChildren)(node) ?? [])
      visitNodeColors(value, visitColor);
    for (let value of Object.values(currentNode.cellStyles ?? {}))
      visitColor(value?.color);
    for (let value of Object.values(currentNode.rowStyles ?? {}))
      visitColor(value?.background);
  }
  function collectPresentationPalette(
    slides: readonly Slide[],
    limit = 12,
  ): string[] {
    let counts = new Map<string, number>(),
      countColor: PaletteColorVisitor = (input: unknown): void => {
        let value = normalizePaletteColor(input);
        if (value === undefined) {
          return;
        }
        counts.set(value, (counts.get(value) ?? 0) + 1);
      };
    for (let value of slides) {
      countColor(value.bg);
      for (let value2 of value.frames)
        visitNodeColors(value2.node, countColor);
    }
    return [...counts]
      .sort((input, options): number => options[1] - input[1])
      .slice(0, limit)
      .map(([input]): string => input);
  }
  bindRuntimeValue(
    runtime,
    "normalizePaletteColor",
    () => normalizePaletteColor,
  );
  bindRuntimeValue(runtime, "visitNodeColors", () => visitNodeColors);
  bindRuntimeValue(
    runtime,
    "collectPresentationPalette",
    () => collectPresentationPalette,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeFontFetching)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeRenderingTheme)();
  };
}
