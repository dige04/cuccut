import { create } from 'zustand';
import type { MusicQuickPick } from '../model/tools-music.ts';

/** One submitted music audition: task ID, the settings identity at submission, and the selection (the result row is written from it). */
export interface MusicQuickRun {
  jobId: string;
  key: string;
  pick: MusicQuickPick;
}

/** One model row's audition draft: the selection, the most recent submission, and the last one that succeeded (kept even when the most recent one did not succeed). */
export interface MusicQuickDraft {
  pick: MusicQuickPick;
  run: MusicQuickRun | null;
  last: MusicQuickRun | null;
}

/**
 * The local-model "audition" under Settings › Models › Music generation (same as state/tts-quick-store.ts): which rows are expanded, and each model's selection and most recent results.
 * Keyed by model package ID and valid only for this run, not written to disk. The task itself is in the `jobs` topic, and this records only its ID.
 */
export interface MusicQuickStore {
  open: string[];
  drafts: Record<string, MusicQuickDraft>;
  setOpen(bundleId: string, open: boolean): void;
  setDraft(bundleId: string, draft: MusicQuickDraft): void;
}

export const useMusicQuick = create<MusicQuickStore>()((set) => ({
  open: [],
  drafts: {},
  setOpen: (bundleId, open) =>
    set((s) => ({ open: open ? (s.open.includes(bundleId) ? s.open : [...s.open, bundleId]) : s.open.filter((id) => id !== bundleId) })),
  setDraft: (bundleId, draft) => set((s) => ({ drafts: { ...s.drafts, [bundleId]: draft } })),
}));
