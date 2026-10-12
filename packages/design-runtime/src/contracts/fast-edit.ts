import type { Rectangle } from "./geometry";
export type PageStyles = Partial<
  Record<"background" | "color" | "font", string>
>;
export type PageStyleInput = Partial<
  Record<"background" | "color" | "font", unknown>
>;
export interface PageDeclarations {
  background?: string;
  color?: string;
  families?: string;
}
export type PageStyleResult =
  | { ok: true; template: string }
  | { ok: false; why: "no_sheet" | "sentinels" | "value" | "outside" };
export interface MarkupRange {
  at: number;
  innerAt: number;
  innerEnd: number;
  end: number;
}
export interface HelmetMarkup {
  a: string;
  h: string;
  b: string;
}
export interface MarkupMatch {
  index: number;
  0: string;
  1: string;
}
export interface PageStylesheet {
  hm: MarkupMatch;
  sm: MarkupMatch;
}
export type LayoutProbe =
  | "column_stretch"
  | "column"
  | "row"
  | "inline"
  | "block";
export type ProbeRectangle = [
  left: number,
  top: number,
  right: number,
  bottom: number,
];
export interface ComputedStyleProbe {
  size?: number;
  weight?: number;
  style?: "italic" | "oblique";
  color?: string;
  ground?: string;
  behind?: string;
  align?: "center" | "right" | "justify";
  w?: number;
  h?: number;
}
export interface ElementHitProbe {
  tid: number | null;
  tag: string;
  own: string;
  all: string;
  hollow: boolean;
  imported: boolean;
  atPath: boolean;
  words: ProbeRectangle[];
  look: ComputedStyleProbe;
}
export interface NearestRectangle {
  px: number;
  side: "left" | "right" | "above" | "below";
}
export interface RankedRectangle extends NearestRectangle {
  d: number;
  level: boolean;
}
