import { create } from 'zustand';
import type { TranscriptView } from '../../model/transcript-text.ts';

/** 文稿面板的两个模式：改字（只改转写文字）与剪辑（剪掉音画，剪掉的字划线保留）。 */
export type TranscriptMode = 'edit' | 'cut';

/**
 * 文稿面板的模式与语言视图（transcript-panel.tsx）：不持久化，但在切页之间保持（面板卸载再装上时还是原来的样子）。
 * `language` 为 null 时跟着第一门译文。面板之外也会写模式：子视频落在文稿、进文稿调起止时打开剪辑（shorts-entry.ts）。
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
