import { create } from 'zustand';
import type { Id } from '@cuccut/protocol';
import { addSlideAnnotation, removeSlideAnnotation, type DraftSlideAnnotation, type SlideAnnotationError } from '../model/slide-annotations.ts';

/**
 * Annotations on slide tags added to the conversation (docs/design/slides §8.2), keyed by session id. The composer shows "slide annotations · N",
 * and they are handed over with the message when it is sent. Only in this window, not persisted (same as selected skills and attached images).
 * Annotations are only added to sessions that already exist: when the slide tab's location has no session yet, they are not accepted (the tab itself shows a hint).
 */
interface DraftSlideAnnotationsStore {
  /** Session id → annotations in the order added. */
  annotations: Record<Id, readonly DraftSlideAnnotation[]>;
  /** Append one. If it cannot be added, return the reason and leave the draft unchanged. */
  add(conversationId: Id, note: DraftSlideAnnotation): SlideAnnotationError | null;
  remove(conversationId: Id, id: string): void;
  clear(conversationId: Id): void;
  /** Sent: remove the annotations that were sent (ones added during sending are kept). */
  sent(conversationId: Id, ids: readonly string[]): void;
}

const EMPTY: readonly DraftSlideAnnotation[] = [];

export const useDraftSlideAnnotations = create<DraftSlideAnnotationsStore>()((set, get) => {
  const write = (conversationId: Id, next: readonly DraftSlideAnnotation[]) =>
    set((s) => {
      if (next === (s.annotations[conversationId] ?? EMPTY)) return {};
      const annotations = { ...s.annotations };
      if (next.length) annotations[conversationId] = next;
      else delete annotations[conversationId];
      return { annotations };
    });
  return {
    annotations: {},
    add: (conversationId, note) => {
      const { list, error } = addSlideAnnotation(get().annotations[conversationId] ?? EMPTY, note);
      if (!error) write(conversationId, list);
      return error;
    },
    remove: (conversationId, id) => write(conversationId, removeSlideAnnotation(get().annotations[conversationId] ?? EMPTY, id)),
    clear: (conversationId) => write(conversationId, EMPTY),
    sent: (conversationId, ids) => {
      const gone = new Set(ids);
      const before = get().annotations[conversationId] ?? EMPTY;
      const after = before.filter((n) => !gone.has(n.id));
      write(conversationId, after.length === before.length ? before : after);
    },
  };
});

/** The annotations in this session's draft. When there are none, the same empty array is returned (so subscribers don't churn). */
export function useDraftSlideAnnotationList(conversationId: Id | null): readonly DraftSlideAnnotation[] {
  return useDraftSlideAnnotations((s) => (conversationId ? (s.annotations[conversationId] ?? EMPTY) : EMPTY));
}
