import type { LibraryEntrySummary, LibraryEvent, LibrarySnapshot } from '@cuccut/protocol';

/**
 * The single entry point for the `library` topic (architecture design §5.9). `RuntimeSession.start()` subscribes only once and hands snapshots and events here.
 * Each library's mirror (my voices, glossary, brand kit, ...) registers with `onLibraryEntries`, receives the entries of all libraries, and selects its own by `library`.
 *
 * Why not subscribe in each one: `CucCutClient` records only one set of callbacks per topic, so a second `subscribe('library')` would replace the first.
 */

/** The entry table after an event on the topic. `entry.upsert` replaces or appends by library and ID, and `entry.removed` removes one. */
export function applyLibraryEvent(entries: readonly LibraryEntrySummary[], event: LibraryEvent): LibraryEntrySummary[] {
  switch (event.type) {
    case 'entry.upsert': {
      const { entry } = event;
      const index = entries.findIndex((e) => e.library === entry.library && e.id === entry.id);
      if (index < 0) return [...entries, entry];
      const next = entries.slice();
      next[index] = entry;
      return next;
    }
    case 'entry.removed':
      return entries.filter((e) => !(e.library === event.library && e.id === event.id));
  }
}

type Listener = (entries: readonly LibraryEntrySummary[]) => void;

let current: LibraryEntrySummary[] | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  if (!current) return;
  for (const listener of listeners) listener(current);
}

/** Passed to `client.subscribe('library', libraryFeed)`. */
export const libraryFeed = {
  snapshot(snapshot: LibrarySnapshot): void {
    current = snapshot.entries.slice();
    emit();
  },
  event(event: LibraryEvent): void {
    // No events arrive before the snapshot. If one does come, just record it first.
    current = applyLibraryEvent(current ?? [], event);
    emit();
  },
};

/** Register a mirror. If a snapshot already exists, it receives everything once immediately, and after each change it receives all entries. Returns the unregister function. */
export function onLibraryEntries(listener: Listener): () => void {
  listeners.add(listener);
  if (current) listener(current);
  return () => void listeners.delete(listener);
}
