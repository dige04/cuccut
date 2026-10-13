import { SHAPE_OUTLINES } from './shape-outlines.ts';

/** Recognized shapes: rectangle, ellipse, and 20 outline shapes (`shape-outlines.ts`). */
export function knownShape(kind: unknown): boolean {
  return kind === 'rect' || kind === 'ellipse' || (typeof kind === 'string' && Object.hasOwn(SHAPE_OUTLINES, kind));
}
