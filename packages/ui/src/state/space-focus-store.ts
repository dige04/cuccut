import { create } from 'zustand';
import type { Id, SpaceEntry } from '@cuccut/protocol';
import { useShell } from './shell-store.ts';

/**
 * The item to open for "View in Space" (tool results, task details): navigates to that Space category and records the item; once the Space page mounts, it opens the item's viewer and clears the marker.
 * Lives only in memory, not in the route.
 */
export const useSpaceFocus = create<{ focus: Id | null }>()(() => ({ focus: null }));

export function showInSpace(entry: Pick<SpaceEntry, 'id' | 'kind'>): void {
  useSpaceFocus.setState({ focus: entry.id });
  useShell.getState().go({ tab: 'space', category: entry.kind, projectId: null });
}

/** The Space page takes the marker: if the item is already in the catalog, returns its ID and clears the marker; otherwise null (kept until the catalog arrives). */
export function takeSpaceFocus(known: (id: Id) => boolean): Id | null {
  const { focus } = useSpaceFocus.getState();
  if (!focus || !known(focus)) return null;
  useSpaceFocus.setState({ focus: null });
  return focus;
}
