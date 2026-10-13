import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The export dialog's choices, remembered across sessions (design draft preference `txFrontmatter`): the script page's "front matter metadata", checked if never saved.
 * It is only a UI preference. The protocol's default is still not to write it (command and protocol spec §4.4).
 */
export interface ExportPrefsStore {
  transcriptFrontmatter: boolean;
  setTranscriptFrontmatter(on: boolean): void;
}

export const useExportPrefs = create<ExportPrefsStore>()(
  persist(
    (set) => ({
      transcriptFrontmatter: true,
      setTranscriptFrontmatter: (transcriptFrontmatter) => set({ transcriptFrontmatter }),
    }),
    {
      name: 'cuccut.export',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ transcriptFrontmatter: s.transcriptFrontmatter }),
    },
  ),
);
