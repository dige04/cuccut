import { DESIGN_SYSTEM_ANNOTATION_LIMITS, type DesignSystemAnnotation, type FileTarget } from '@cuccut/protocol';
import type { EditorThread } from '@cuccut/slides/editor-messages';
import { targetKey } from './workspace.ts';

/**
 * Design-system annotations in a session (docs/design/canvas §10.6): adding and removing drafts, the numbered markers in the editor, and the set handed over when sending.
 * Ported from the prototype designs/cuccut/app/model-home-design-system-notes.js (`add`, `remove`, `pins`), with the same rules as the design annotations (design-annotations.ts).
 * Pure functions, no React, no DOM. A number is the position in this session's design-system annotation draft. Slides and design annotations are numbered separately.
 */

/** One item in the draft: the protocol's `DesignSystemAnnotation` plus an id that only the UI uses (for delete, the editor's number markers, and jumping). */
export type DraftDesignSystemAnnotation = DesignSystemAnnotation & { id: string };

/** Reasons it cannot be added: empty, too long, or over the item limit. */
export type DesignSystemAnnotationError = 'empty' | 'too-long' | 'too-many';

/** Add one: trim the note's leading and trailing whitespace. Empty, too long, or over the item limit are not accepted. */
export function addDesignSystemAnnotation(
  list: readonly DraftDesignSystemAnnotation[],
  note: DraftDesignSystemAnnotation,
): { list: readonly DraftDesignSystemAnnotation[]; error: DesignSystemAnnotationError | null } {
  const text = note.text.trim();
  if (!text) return { list, error: 'empty' };
  if (text.length > DESIGN_SYSTEM_ANNOTATION_LIMITS.text) return { list, error: 'too-long' };
  if (list.length >= DESIGN_SYSTEM_ANNOTATION_LIMITS.perMessage) return { list, error: 'too-many' };
  return { list: [...list, { ...note, text }], error: null };
}

export function removeDesignSystemAnnotation(list: readonly DraftDesignSystemAnnotation[], id: string): readonly DraftDesignSystemAnnotation[] {
  return list.some((n) => n.id === id) ? list.filter((n) => n.id !== id) : list;
}

/** The number marker for this design system in the editor: the number is the position in the whole draft, matching the composer list. It includes the section, so jumping back goes to that section first. */
export function systemThreads(list: readonly DraftDesignSystemAnnotation[], system: FileTarget): EditorThread[] {
  const key = targetKey(system);
  return list.flatMap((n, i) =>
    targetKey(n.system) === key ? [{ id: n.id, anchor: n.anchor, n: i + 1, ...(n.section ? { section: n.section } : {}) }] : [],
  );
}

/** The set handed over with the message: UI ids removed, fields in protocol order. */
export function sentDesignSystemAnnotations(list: readonly DraftDesignSystemAnnotation[]): DesignSystemAnnotation[] {
  return list.map(({ system, anchor, section, label, detail, text }) => ({
    system,
    anchor,
    ...(section ? { section } : {}),
    label,
    ...(detail ? { detail } : {}),
    text,
  }));
}
