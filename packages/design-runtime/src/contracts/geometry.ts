/** Coordinates use canvas CSS pixels; angles are degrees. */
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface Rectangle extends Point, Size {}
export type CoordinatePair = [number, number];
export type AffineTuple = [number, number, number, number, number, number];
export interface AffineTransform {
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
}
export interface ContainerPoint {
  left: number;
  top: number;
}
export interface ResizeHandle {
  x: "left" | "right" | null;
  y: "top" | "bottom" | null;
}
export interface SizeLimits {
  min: Size;
  max: Size;
}
export interface ResizeMember extends Size {
  min?: Partial<Size>;
  max?: Partial<Size>;
}
export type VerticalInterval = readonly [top: number, bottom: number];
/** Preview execution returns untrusted data; decoders accept unknown. */
export interface PreviewHandle {
  executeJavaScript(code: string, timeoutMs?: number): Promise<unknown>;
  executeJavaScriptUnchecked(code: string): void;
  pageFonts?(): string[];
}
export interface CanvasView extends Point {
  scale: number;
}
