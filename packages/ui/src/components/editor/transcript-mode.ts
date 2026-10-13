import { create } from 'zustand';
import type { TranscriptView } from '../../model/transcript-text.ts';

/** The two modes of the transcript panel: edit source text (改原文, only the transcript words change), and cut (剪辑音画, cut audio and picture; cut words stay struck through). */
export type TranscriptMode = 'edit' | 'cut';

/**
 * Mode and language view of the transcript panel (transcript-panel.tsx). Not persisted, but kept across page switches: when the panel unmounts and mounts again, it looks as it did before.
 * When `language` is null, it follows the first translation. The mode is also written from outside the panel: a sub-video lands on the transcript, and entering the transcript to adjust start and end opens cut mode (shorts-entry.ts).
 */
export const useTranscriptMode = create<{
  mode: TranscriptMode;
  view: TranscriptView;
  language: string | null;
  setMode(mode: TranscriptMode): void;
  setView(view: TranscriptView): void;
  setLanguage(language: string | null): void;
}>()((set) => ({
  mode: 'edit',
  view: 'source',
  language: null,
  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),
  setLanguage: (language) => set({ language }),
}));
