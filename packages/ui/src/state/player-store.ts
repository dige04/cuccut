import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * View state of the player (product design §3.3: closing and reopening the side panel keeps the playback position). It belongs to this window only and is not written to any file.
 * The playback position and the selected subtitle are kept in memory per file (`targetKey`); volume, mute, playback rate and whether subtitles are overlaid carry across files and are stored on this machine.
 */
export interface PlayerStore {
  positions: Record<string, number>;
  /** Subtitle file name chosen for each file; null means "no subtitles". When there is no record, the subtitle with the same name is picked automatically. */
  tracks: Record<string, string | null>;
  volume: number;
  muted: boolean;
  rate: number;
  captions: boolean;
  remember(key: string, time: number): void;
  chooseTrack(key: string, fileName: string | null): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setRate(rate: number): void;
  setCaptions(captions: boolean): void;
}

export const usePlayer = create<PlayerStore>()(
  persist(
    (set) => ({
      positions: {},
      tracks: {},
      volume: 1,
      muted: false,
      rate: 1,
      captions: true,
      remember: (key, time) => set((s) => ({ positions: { ...s.positions, [key]: time } })),
      chooseTrack: (key, fileName) => set((s) => ({ tracks: { ...s.tracks, [key]: fileName } })),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)), muted: false }),
      setMuted: (muted) => set({ muted }),
      setRate: (rate) => set({ rate }),
      setCaptions: (captions) => set({ captions }),
    }),
    {
      name: 'cuccut.player',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ volume: s.volume, muted: s.muted, rate: s.rate, captions: s.captions }),
    },
  ),
);
