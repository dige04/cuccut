import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * One submission of “cut into shorts” (product design §5.10, “result page”): which session it was sent to, which task (none yet if it is still queued), when it was submitted, and which video it was started from.
 * The result page uses it to recognize the child videos cut in this round (`model/shorts-result.ts` `shortsBatch`). `landed` records whether the AI Tools tab has already been flipped to the result page after the run finished,
 * so it is not flipped again every time the parent video is opened.
 */
export interface ShortsRun {
  conversationId: Id;
  parentVideoId: Id;
  taskId: Id | null;
  handedAt: string;
  landed: boolean;
  /** The clip last opened on the result page (while the parent video is open, the “k of N” indicator at the top stays on it). */
  focus: Id | null;
}

/** Maximum number of runs kept: old ones are dropped starting from the earliest submitted. */
const KEEP = 40;

/**
 * Recorded per session (survives switching back and forth between parent and child videos, and restarting the app). Persisted the same way as `useAiToolAgentRuns` (ai-tools-nav.ts).
 */
export const useShortsRuns = create<{ runs: Record<Id, ShortsRun> }>()(
  persist(() => ({ runs: {} as Record<Id, ShortsRun> }), {
    name: 'cuccut.shorts-cut-runs',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: ({ runs }) => ({ runs }),
    merge: (persisted, current) => ({ ...current, runs: restoredShortsRuns(persisted) }),
  }),
);

/** Records read back: any with the wrong shape are dropped. */
export function restoredShortsRuns(persisted: unknown): Record<Id, ShortsRun> {
  const raw = (persisted as { runs?: unknown } | null)?.runs;
  if (!raw || typeof raw !== 'object') return {};
  const runs: Record<Id, ShortsRun> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const run = value as Partial<ShortsRun> | null;
    if (!run || typeof run.conversationId !== 'string' || typeof run.parentVideoId !== 'string' || typeof run.handedAt !== 'string') continue;
    runs[key] = {
      conversationId: run.conversationId,
      parentVideoId: run.parentVideoId,
      taskId: typeof run.taskId === 'string' ? run.taskId : null,
      handedAt: run.handedAt,
      landed: run.landed === true,
      focus: typeof run.focus === 'string' ? run.focus : null,
    };
  }
  return runs;
}

/** Records a newly submitted run. If the same session is submitted again, it overwrites (“cut a few more” may send back to the same session). */
export function recordShortsRun(run: Omit<ShortsRun, 'landed' | 'focus'>): void {
  useShortsRuns.setState((s) => {
    const next: Record<Id, ShortsRun> = { ...s.runs, [run.conversationId]: { ...run, landed: false, focus: null } };
    const keys = Object.keys(next);
    if (keys.length > KEEP) {
      keys
        .sort((a, b) => next[a]!.handedAt.localeCompare(next[b]!.handedAt))
        .slice(0, keys.length - KEEP)
        .forEach((key) => delete next[key]);
    }
    return { runs: next };
  });
}

export function markShortsRunLanded(conversationId: Id): void {
  useShortsRuns.setState((s) => {
    const run = s.runs[conversationId];
    return run && !run.landed ? { runs: { ...s.runs, [conversationId]: { ...run, landed: true } } } : s;
  });
}

export function focusShortsRun(conversationId: Id, videoId: Id): void {
  useShortsRuns.setState((s) => {
    const run = s.runs[conversationId];
    return run && run.focus !== videoId ? { runs: { ...s.runs, [conversationId]: { ...run, focus: videoId } } } : s;
  });
}

/** The most recent run started from this video (null if none). */
export function latestShortsRun(runs: Record<Id, ShortsRun>, parentVideoId: Id): ShortsRun | null {
  let latest: ShortsRun | null = null;
  for (const run of Object.values(runs)) {
    if (run.parentVideoId !== parentVideoId) continue;
    if (!latest || run.handedAt > latest.handedAt) latest = run;
  }
  return latest;
}
