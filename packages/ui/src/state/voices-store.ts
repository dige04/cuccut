import { create } from 'zustand';
import type { LibraryEntrySummary } from '@cuccut/protocol';
import { onLibraryEntries } from './library-feed.ts';

/** My voices: entries of `voices` in the user library (summaries), sorted by name. Full content (transcript, language, consent statement) is fetched on demand with `library.get`. */
export interface VoicesStore {
  ready: boolean;
  voices: LibraryEntrySummary[];
}

export const useVoices = create<VoicesStore>()(() => ({ ready: false, voices: [] }));

onLibraryEntries((entries) => {
  const voices = entries.filter((e) => e.library === 'voices').sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id));
  useVoices.setState({ ready: true, voices });
});
