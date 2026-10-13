import { create } from 'zustand';
import type { Route } from './shell-store.ts';

/**
 * Go to "My voice" to clone a new voice, save it and bring it back (design store's `voiceHandoff`): when "Clone new voice…" is clicked in the preview panel, it records where it came from
 * and where to return; after My voice saves it, `voiceId` is filled in, and the part at the original place claims it (selects this voice) and then clears it.
 *
 * The other direction is "Preview clone" from "My voice": it records which preview row to expand on the local models page and which voice to select; that row claims it and then clears it.
 * Both are valid only for this run, not saved to disk.
 */
export interface VoiceHandoff {
  /** Who is waiting: `quick:<bundleId>` is the audition row on the local model page. */
  key: string;
  /** The "where it came from" on the return bar: the model name of the audition row ("Qwen3-TTS 0.6B Base"); the sentence is assembled by the return bar's copy. */
  from: string;
  route: Route;
  /** The saved voice; absent until one is saved. */
  voiceId?: string;
}

export interface VoiceAuditionFocus {
  bundleId: string;
  /** Voice key of the audition panel (`my:<id>`). */
  voice: string;
}

export interface VoiceHandoffStore {
  handoff: VoiceHandoff | null;
  focus: VoiceAuditionFocus | null;
  setHandoff(handoff: VoiceHandoff | null): void;
  /** My voice saved one: record it when someone is waiting. */
  saved(voiceId: string): void;
  setFocus(focus: VoiceAuditionFocus | null): void;
}

export const useVoiceHandoff = create<VoiceHandoffStore>()((set) => ({
  handoff: null,
  focus: null,
  setHandoff: (handoff) => set({ handoff }),
  saved: (voiceId) => set((s) => (s.handoff ? { handoff: { ...s.handoff, voiceId } } : {})),
  setFocus: (focus) => set({ focus }),
}));
