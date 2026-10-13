import { create } from 'zustand';
import { applyConversationEvent } from '@cuccut/client';
import type { ConversationEvent, ConversationSnapshot, Id, TimelineItem } from '@cuccut/protocol';

/**
 * Mirror of conversation content, stored by conversation ID (architecture design §11.4). The reducer is a pure function; unchanged entries keep the same reference,
 * so entry components wrapped in memo re-render only when they change.
 */
export interface TimelineStore {
  byConversationId: Record<Id, ConversationSnapshot>;
  replace(id: Id, snapshot: ConversationSnapshot): void;
  apply(id: Id, event: ConversationEvent): void;
  drop(id: Id): void;
}

export const useTimeline = create<TimelineStore>()((set) => ({
  byConversationId: {},
  replace: (id, snapshot) => set((s) => ({ byConversationId: { ...s.byConversationId, [id]: snapshot } })),
  apply: (id, event) =>
    set((s) => {
      const current = s.byConversationId[id];
      if (!current) return s;
      const next = applyConversationEvent(current, event);
      const byConversationId = { ...s.byConversationId };
      if (next) byConversationId[id] = next;
      else delete byConversationId[id];
      return { byConversationId };
    }),
  drop: (id) =>
    set((s) => {
      const byConversationId = { ...s.byConversationId };
      delete byConversationId[id];
      return { byConversationId };
    }),
}));

const EMPTY: readonly TimelineItem[] = [];

export function useTimelineItems(id: Id | null): readonly TimelineItem[] {
  return useTimeline((s) => (id ? (s.byConversationId[id]?.items ?? EMPTY) : EMPTY));
}

export function useTimelineLoaded(id: Id | null): boolean {
  return useTimeline((s) => (id ? id in s.byConversationId : false));
}
