import { create } from 'zustand';
import { applySpaceEvent } from '@cuccut/client';
import type { SpaceEntry, SpaceEvent, SpaceScanIssue, SpaceSnapshot } from '@cuccut/protocol';

/** Mirror of the Space catalog (architecture design §5.7). Rewritten only by the Runtime's snapshots and events. */
export interface SpaceStore {
  ready: boolean;
  scanning: boolean;
  entries: SpaceEntry[];
  issues: SpaceScanIssue[];
  replace(snapshot: SpaceSnapshot): void;
  apply(event: SpaceEvent): void;
}

export const useSpace = create<SpaceStore>()((set) => ({
  ready: false,
  scanning: true,
  entries: [],
  issues: [],
  replace: (snapshot) => set({ ready: true, ...snapshot }),
  apply: (event) => set((s) => applySpaceEvent(s, event)),
}));
