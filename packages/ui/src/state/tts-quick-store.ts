import { create } from 'zustand';
import type { QuickPick } from '../model/tts-quick-test.ts';

/** Preview for one submission: task ID, the request identity and choices at submit time (the result row is written from it). */
export interface QuickRun {
  jobId: string;
  key: string;
  pick: QuickPick;
}

/** Preview draft for one model row: choices, the latest submission, and the previous successful result (kept when the latest one did not succeed). */
export interface QuickDraft {
  pick: QuickPick;
  run: QuickRun | null;
  last: QuickRun | null;
}

/**
 * "Preview" for local models under Settings › Models › Speech synthesis: which rows are expanded, and each model's choices and latest results. Keyed by model pack ID; it survives collapsing, switching pages and coming back;
 * valid only for this run, not saved to disk. The tasks themselves are in the `jobs` topic; only IDs are recorded here.
 */
export interface TtsQuickStore {
  open: string[];
  drafts: Record<string, QuickDraft>;
  setOpen(bundleId: string, open: boolean): void;
  setDraft(bundleId: string, draft: QuickDraft): void;
}

export const useTtsQuick = create<TtsQuickStore>()((set) => ({
  open: [],
  drafts: {},
  setOpen: (bundleId, open) =>
    set((s) => ({ open: open ? (s.open.includes(bundleId) ? s.open : [...s.open, bundleId]) : s.open.filter((id) => id !== bundleId) })),
  setDraft: (bundleId, draft) => set((s) => ({ drafts: { ...s.drafts, [bundleId]: draft } })),
}));
