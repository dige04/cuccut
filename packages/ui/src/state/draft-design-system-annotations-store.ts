import { create } from 'zustand';
import type { Id } from '@cuccut/protocol';
import {
  addDesignSystemAnnotation,
  removeDesignSystemAnnotation,
  type DesignSystemAnnotationError,
  type DraftDesignSystemAnnotation,
} from '../model/design-system-annotations.ts';

/**
 * Annotations on design-system tags added to the conversation (docs/design/canvas §10.6), keyed by session id. The composer shows "design system annotations · N",
 * and they are handed over with the message when it is sent. Only in this window, not persisted (same as design annotations, draft-design-annotations-store.ts).
 * Annotations are only added to sessions that already exist: when the design-system tab's location has no session yet, they are not accepted (the tab itself shows a hint).
 */
interface DraftDesignSystemAnnotationsStore {
  /** Session id → annotations in the order added. */
  annotations: Record<Id, readonly DraftDesignSystemAnnotation[]>;
  /** Append one. If it cannot be added, return the reason and leave the draft unchanged. */
  add(conversationId: Id, note: DraftDesignSystemAnnotation): DesignSystemAnnotationError | null;
  remove(conversationId: Id, id: string): void;
  clear(conversationId: Id): void;
  /** Sent: remove the annotations that were sent (ones added during sending are kept). */
  sent(conversationId: Id, ids: readonly string[]): void;
}

const EMPTY: readonly DraftDesignSystemAnnotation[] = [];

export const useDraftDesignSystemAnnotations = create<DraftDesignSystemAnnotationsStore>()((set, get) => {
  const write = (conversationId: Id, next: readonly DraftDesignSystemAnnotation[]) =>
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
      const { list, error } = addDesignSystemAnnotation(get().annotations[conversationId] ?? EMPTY, note);
      if (!error) write(conversationId, list);
      return error;
    },
    remove: (conversationId, id) => write(conversationId, removeDesignSystemAnnotation(get().annotations[conversationId] ?? EMPTY, id)),
    clear: (conversationId) => write(conversationId, EMPTY),
    sent: (conversationId, ids) => {
      const gone = new Set(ids);
      const before = get().annotations[conversationId] ?? EMPTY;
      const after = before.filter((n) => !gone.has(n.id));
      write(conversationId, after.length === before.length ? before : after);
    },
  };
});

/** The design-system annotations in this session's draft. When there are none, the same empty array is returned (so subscribers don't churn). */
export function useDraftDesignSystemAnnotationList(conversationId: Id | null): readonly DraftDesignSystemAnnotation[] {
  return useDraftDesignSystemAnnotations((s) => (conversationId ? (s.annotations[conversationId] ?? EMPTY) : EMPTY));
}
