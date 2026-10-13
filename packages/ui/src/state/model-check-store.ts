import { create } from 'zustand';
import type { CheckRejection } from '../model/model-check.ts';

/**
 * Two things the local-model "check" needs that the Runtime does not know, keyed by model package ID (model/model-check.ts):
 * - `rejections`: the most recent submitted check was rejected (the check could not start). Cleared on the next submission.
 * - `repairs`: the repair task started from this row. After it finishes, the check runs again automatically, and then the entry is cleared.
 * Valid only for this run, not written to disk. It is still there after leaving and returning to the settings page.
 */
export interface ModelCheckStore {
  rejections: Record<string, CheckRejection>;
  repairs: Record<string, string>;
  reject(bundleId: string, rejection: CheckRejection | null): void;
  setRepair(bundleId: string, jobId: string | null): void;
}

export const useModelCheck = create<ModelCheckStore>()((set) => ({
  rejections: {},
  repairs: {},
  reject: (bundleId, rejection) =>
    set((s) => {
      const next = { ...s.rejections };
      if (rejection) next[bundleId] = rejection;
      else delete next[bundleId];
      return { rejections: next };
    }),
  setRepair: (bundleId, jobId) =>
    set((s) => {
      const next = { ...s.repairs };
      if (jobId) next[bundleId] = jobId;
      else delete next[bundleId];
      return { repairs: next };
    }),
}));
