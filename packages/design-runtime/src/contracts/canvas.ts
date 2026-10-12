import type { Point, Rectangle } from "./geometry";
import type { PaperSizeName } from "./export";
import type { VersionedIndex } from "./storage";
export type GuideAlignment = "stretch" | "start" | "center" | "end";
export interface TrackGuide {
  kind: "columns" | "rows";
  count: number | "auto";
  gutter?: number;
  margin?: number;
  align?: GuideAlignment;
  size?: number;
  offset?: number;
  color?: string;
  hidden?: boolean;
}
export interface GridGuide {
  kind: "grid";
  size: number;
  color?: string;
  hidden?: boolean;
}
export type LayoutGuide = TrackGuide | GridGuide;
export interface Artboard extends Rectangle {
  file: string;
  title?: string;
  page?: string;
  is_interactive?: boolean;
  frameless?: boolean;
  expand?: "fill";
  print?: "flow";
  paper?: PaperSizeName;
  guides?: LayoutGuide[];
}
export interface CanvasPage {
  id: string;
  name: string;
}
export type CanvasLaunch =
  | { view: "canvas"; page?: string }
  | { view: "focused"; file: string; page?: string };
export interface AnnotationBase extends Point {
  id: string;
  page?: string;
  rotate?: number;
}
export interface NoteAnnotation extends AnnotationBase {
  kind: "note";
  w: number;
  text: string;
}
export interface BoxAnnotation extends AnnotationBase {
  kind: "rect" | "oval";
  w: number;
  h: number;
  flipX?: boolean;
  flipY?: boolean;
}
export interface LineAnnotation extends AnnotationBase {
  kind: "line" | "arrow";
  x2: number;
  y2: number;
}
export interface ImageAnnotation extends AnnotationBase {
  kind: "image";
  w: number;
  h: number;
  src: string;
  flipX?: boolean;
  flipY?: boolean;
}
export interface PenAnnotation extends AnnotationBase {
  kind: "pen";
  w: number;
  h: number;
  d: string;
}
export type CanvasAnnotation =
  | NoteAnnotation
  | BoxAnnotation
  | LineAnnotation
  | ImageAnnotation
  | PenAnnotation;
/** Validated editor model: annotations are an ordered list; artboards contain file names. */
export interface CanvasDocument {
  title?: string;
  artboards: Artboard[];
  annotations: CanvasAnnotation[];
  pages?: CanvasPage[];
  cover?: string;
  launch?: CanvasLaunch;
}
/** Persisted index representation: the codec reconstructs the validated editor model. */
export interface CanvasIndex extends VersionedIndex {
  title?: string;
  boards: Record<string, unknown>;
  order: string[];
  notes: Record<string, unknown>;
  cover?: string;
  launch?: unknown;
  pages?: unknown;
}
