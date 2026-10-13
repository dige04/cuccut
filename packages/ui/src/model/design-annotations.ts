import { DESIGN_ANNOTATION_LIMITS, type DesignAnnotation, type FileTarget } from '@cuccut/protocol';
import type { EditorThread } from '@cuccut/slides/editor-messages';
import { targetKey } from './workspace.ts';

/**
 * Design draft annotations in a session (docs/design/canvas §8.2, §9): adding and removing drafts, the numbered markers in the editor, and the copy handed over when sending.
 * Ported from the prototype designs/cuccut/app/model-home-design.js (`add`, `remove`, `pins`), following the same rules as slide annotations (slide-annotations.ts).
 * Pure functions, no React, no DOM. Numbers are the ordinal within this session's design annotation drafts; slide annotations are numbered separately.
 */

/** One entry in the draft: the protocol's `DesignAnnotation` plus a UI-only id (used for deletion, editor number markers and jumping). */
export type DraftDesignAnnotation = DesignAnnotation & { id: string };

/** Reasons an entry cannot be added: empty, too long, or over the count limit. */
export type DesignAnnotationError = 'empty' | 'too-long' | 'too-many';

/** Adds one entry: the annotation is trimmed of leading and trailing whitespace; empty, too-long, or over-the-limit entries are not accepted. */
export function addDesignAnnotation(
  list: readonly DraftDesignAnnotation[],
  note: DraftDesignAnnotation,
): { list: readonly DraftDesignAnnotation[]; error: DesignAnnotationError | null } {
  const text = note.text.trim();
  if (!text) return { list, error: 'empty' };
  if (text.length > DESIGN_ANNOTATION_LIMITS.text) return { list, error: 'too-long' };
  if (list.length >= DESIGN_ANNOTATION_LIMITS.perMessage) return { list, error: 'too-many' };
  return { list: [...list, { ...note, text }], error: null };
}

export function removeDesignAnnotation(list: readonly DraftDesignAnnotation[], id: string): readonly DraftDesignAnnotation[] {
  return list.some((n) => n.id === id) ? list.filter((n) => n.id !== id) : list;
}

/** Number markers for this design draft in the editor: the number is the ordinal across the whole draft, matching the composer list. */
export function canvasThreads(list: readonly DraftDesignAnnotation[], canvas: FileTarget): EditorThread[] {
  const key = targetKey(canvas);
  return list.flatMap((n, i) => (targetKey(n.canvas) === key ? [{ id: n.id, anchor: n.anchor, n: i + 1 }] : []));
}

/** The copy handed over with the message: UI ids removed, fields ordered per the protocol. */
export function sentDesignAnnotations(list: readonly DraftDesignAnnotation[]): DesignAnnotation[] {
  return list.map(({ canvas, anchor, board, label, detail, area, text }) => ({
    canvas,
    anchor,
    ...(board ? { board } : {}),
    label,
    ...(detail ? { detail } : {}),
    ...(area ? { area } : {}),
    text,
  }));
}

/** Path of an artboard file (relative to the design draft directory): each segment starts with a letter, digit or `_`, and ends with `.dc.html` (the design draft format, skill design SKILL.md). */
const BOARD = String.raw`(?:[A-Za-z0-9_][A-Za-z0-9_.-]*/)*[A-Za-z0-9_][A-Za-z0-9_.-]*\.dc\.html`;
const ELEMENT_DETAIL = new RegExp(`^(${BOARD})(?::\\s|$)`);
const AREA_DETAIL = new RegExp(`^Area over (${BOARD}) \\([^)]*\\)(?::[^;]*)?$`);

/**
 * Artboard file in the location description given to the model at runtime: an element or a whole artboard is `Main.dc.html: #… button "…"` / `Main.dc.html`,
 * and a region falling on just one artboard is `Area over Main.dc.html (part): …` (runtime comments/labels.ts).
 * A region across several artboards, blank space on the canvas, and sticky notes have no single artboard, so it returns undefined.
 */
export function boardOfDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail.match(ELEMENT_DETAIL)?.[1] ?? detail.match(AREA_DETAIL)?.[1];
}
