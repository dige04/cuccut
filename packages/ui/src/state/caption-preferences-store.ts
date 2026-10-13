import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asObject, type Json, type LineKind } from '../render/text-style.ts';
import { cleanCaptionPreferences, preferredCaptionStyle, rememberCaptionPreferences } from '../model/caption-preferences.ts';

/** The client's own options for new subtitles; the actual video style is still stored in the video's caption-style document. */
export const useCaptionPreferences = create<{ preferences: Json; remember(before: Json, after: Json, singleLine?: LineKind): void }>()(
  persist((set) => ({
    preferences: {},
    remember: (before, after, singleLine) => set((s) => ({ preferences: rememberCaptionPreferences(s.preferences, before, after, singleLine) })),
  }), {
    name: 'cuccut.captionPreferences',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ preferences: s.preferences }),
    merge: (saved, current) => ({ ...current, preferences: cleanCaptionPreferences(asObject(saved).preferences) }),
  }),
);

export const newCaptionStyle = (): Json => preferredCaptionStyle(useCaptionPreferences.getState().preferences);
