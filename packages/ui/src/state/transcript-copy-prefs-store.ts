import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COPY_DEFAULTS, type TranscriptCopyPrefs } from '../model/transcript-copy-options.ts';

/**
 * The copy combination remembered by the transcript panel (design preference `txCopy`): once the copy settings are changed they are remembered, and the next click of the copy button uses this combination. It is only a UI preference,
 * recorded on this machine across conversations (also available on the web), and not in the Runtime's settings.
 */
export interface TranscriptCopyPrefsStore extends TranscriptCopyPrefs {
  set(patch: Partial<TranscriptCopyPrefs>): void;
}

export const useTranscriptCopyPrefs = create<TranscriptCopyPrefsStore>()(
  persist(
    (set) => ({
      ...COPY_DEFAULTS,
      set: (patch) => set(patch),
    }),
    {
      name: 'cuccut.transcript-copy',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ format, frontmatter, chapters, timestamps, speakers, skipCut }) => ({ format, frontmatter, chapters, timestamps, speakers, skipCut }),
    },
  ),
);

/** Reads only the combination itself (without `set`), for computations. */
export function copyPrefsOf(store: TranscriptCopyPrefsStore): TranscriptCopyPrefs {
  const { format, frontmatter, chapters, timestamps, speakers, skipCut } = store;
  return { format, frontmatter, chapters, timestamps, speakers, skipCut };
}
