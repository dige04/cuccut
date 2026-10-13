import { create } from 'zustand';
import type { Id, SequenceItem } from '@cuccut/protocol';

/**
 * The timeline clipboard (prototype editor-keys clipRef / genRef): in-app, and it does not touch the system clipboard, because what is copied is clips, not text.
 * Not persisted. It survives switching videos, but can only be pasted back into the video it was copied from (asset and document IDs are valid only within that video).
 */
export interface ClipboardStore {
  /** Snapshot of the clips at the moment of copying, ordered by track from bottom to top, then by time. */
  entries: SequenceItem[];
  /** The video it was copied from. */
  videoId: Id | null;
  /** How many times this session has pasted (duplicates included). Each copy is offset one more step on screen. */
  generation: number;
  put(videoId: Id, entries: SequenceItem[]): void;
  /** Which paste number the next paste will be. */
  nextGeneration(): number;
}

export const useClipboard = create<ClipboardStore>()((set, get) => ({
  entries: [],
  videoId: null,
  generation: 0,
  put: (videoId, entries) => set({ videoId, entries }),
  nextGeneration: () => {
    const generation = get().generation + 1;
    set({ generation });
    return generation;
  },
}));
