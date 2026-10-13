import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Id } from '@cuccut/protocol';

/**
 * Record of "Generate soundtrack" results that were automatically laid onto the video's music track (product design §2.7 "Generate soundtrack"): the task numbers already laid. This is only a UI marker, recorded on this machine across conversations:
 * after the user deletes the laid music and reopens the video, it is not laid again. Keeps at most the latest several hundred entries.
 */
interface SoundtrackStore {
  placed: Record<Id, true>;
  markPlaced(jobId: Id): void;
}

const KEEP = 500;

export const useSoundtrackStore = create<SoundtrackStore>()(
  persist(
    (set) => ({
      placed: {},
      markPlaced: (jobId) =>
        set((s) => {
          const entries = Object.entries(s.placed).filter(([k]) => k !== jobId);
          const trimmed = entries.length >= KEEP ? entries.slice(entries.length - KEEP + 1) : entries;
          return { placed: { ...Object.fromEntries(trimmed), [jobId]: true } };
        }),
    }),
    { name: 'cuccut.soundtrack-placed', version: 1, storage: createJSONStorage(() => localStorage), partialize: ({ placed }) => ({ placed }) },
  ),
);
