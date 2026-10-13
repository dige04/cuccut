import { SLIDE_ANNOTATION_LIMITS, type FileTarget, type SlideAnnotation } from '@cuccut/protocol';
import type { EditorThread } from '@cuccut/slides/editor-messages';
import { targetKey } from './workspace.ts';

/**
 * Slide annotations in a session (docs/design/slides §8.2, §9): adding and removing drafts, the numbered markers in the editor, and the copy handed over on send.
 * Ported from the prototype designs/cuccut/app/model-home-slides.js (`add`, `remove`, `pins`). Pure functions, no React, no DOM.
 *
 * The draft is attached to the session (the draft key is the session id): the slide tag adds to it, the composer reads it to show “Slide annotations · N”, and after sending it is recorded with the message in the session, the draft is cleared, and the numbered markers in the editor disappear. Numbers are the sequence over the whole draft; the composer list, the editor markers, and the text given to the agent agree.
 */

/** One item in the draft: the protocol's `SlideAnnotation` plus an id used only in the UI (for deletion, the editor's numbered markers, and jumping). */
export type DraftSlideAnnotation = SlideAnnotation & { id: string };

/** Reason an item cannot be added: empty, too long, or over the item-count limit. */
export type SlideAnnotationError = 'empty' | 'too-long' | 'too-many';

/** Add a new item: the note is trimmed of leading and trailing whitespace; empty, too long, or over-limit items are not accepted. */
export function addSlideAnnotation(
  list: readonly DraftSlideAnnotation[],
  note: DraftSlideAnnotation,
): { list: readonly DraftSlideAnnotation[]; error: SlideAnnotationError | null } {
  const text = note.text.trim();
  if (!text) return { list, error: 'empty' };
  if (text.length > SLIDE_ANNOTATION_LIMITS.text) return { list, error: 'too-long' };
  if (list.length >= SLIDE_ANNOTATION_LIMITS.perMessage) return { list, error: 'too-many' };
  return { list: [...list, { ...note, text }], error: null };
}

export function removeSlideAnnotation(list: readonly DraftSlideAnnotation[], id: string): readonly DraftSlideAnnotation[] {
  return list.some((n) => n.id === id) ? list.filter((n) => n.id !== id) : list;
}

/** The numbered markers for this deck in the editor: numbers are the sequence over the whole draft, matching the composer list. */
export function deckThreads(list: readonly DraftSlideAnnotation[], deck: FileTarget): EditorThread[] {
  const key = targetKey(deck);
  return list.flatMap((n, i) => (targetKey(n.deck) === key ? [{ id: n.id, anchor: n.anchor, n: i + 1 }] : []));
}

/** The copy handed over with the message: UI ids removed, fields in protocol order. */
export function sentSlideAnnotations(list: readonly DraftSlideAnnotation[]): SlideAnnotation[] {
  return list.map(({ deck, anchor, slideId, label, detail, area, text }) => ({
    deck,
    anchor,
    ...(slideId ? { slideId } : {}),
    label,
    ...(detail ? { detail } : {}),
    ...(area ? { area } : {}),
    text,
  }));
}

/**
 * The slide id carried in the location description given to the model by the runtime (`Slide 3 #s03 …`, `Area on slide 3 #s03 …`); undefined when there is none.
 * Only slides that have an id written in the deck have one.
 */
export function slideIdOfDetail(detail: string | undefined): string | undefined {
  return detail?.match(/\b[Ss]lide \d+ #([A-Za-z0-9][\w-]{0,199})/)?.[1];
}

/** The id used to jump to an item in an already-sent message in the editor: the message id plus a sequence number (sent items are no longer in the draft, so they have no draft id). */
export function sentAnnotationId(messageId: string, index: number): string {
  return `${messageId}:${index}`;
}
