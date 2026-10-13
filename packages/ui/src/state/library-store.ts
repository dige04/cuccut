import { create } from 'zustand';
import type { LibraryEntrySummary, LibraryName } from '@cuccut/protocol';
import { onLibraryEntries } from './library-feed.ts';

/**
 * Mirror of the glossary and the brand kit (`library` topic, architecture design §5.9): entry summaries for the two libraries, sorted by name (same order as the Runtime's `library.list`).
 * Only the list. Color values, terms and files are fetched in detail with `library.get`. `ready` is false until the snapshot arrives.
 * The topic is subscribed once and distributed to each library's mirror through `library-feed`. Voices are in `voices-store`.
 */
export interface LibraryStore {
  ready: boolean;
  glossaries: LibraryEntrySummary[];
  brand: LibraryEntrySummary[];
}

export const useLibrary = create<LibraryStore>()(() => ({ ready: false, glossaries: [], brand: [] }));

const byName = (a: LibraryEntrySummary, b: LibraryEntrySummary) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

function pick(entries: readonly LibraryEntrySummary[], library: LibraryName): LibraryEntrySummary[] {
  return entries.filter((entry) => entry.library === library).sort(byName);
}

onLibraryEntries((entries) => {
  useLibrary.setState({ ready: true, glossaries: pick(entries, 'glossaries'), brand: pick(entries, 'brand') });
});
