import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 剪成短视频交出去的一次（产品设计 §5.10「结果页」）：发到哪条会话、哪个任务（排了队的还没有）、什么时候交的、从哪部视频发起的。
 * 结果页按它认这一轮切出的子视频（`model/shorts-result.ts` `shortsBatch`），`landed` 记着跑完后是否已经把 AI 工具 Tab 翻到结果页，
 * 免得每次打开父视频都再翻一次。
 */
export interface ShortsRun {
  conversationId: Id;
  parentVideoId: Id;
  taskId: Id | null;
  handedAt: string;
  landed: boolean;
  /** 结果页上次打开的那一支（开着父视频时头上的「第 k/N」停在它）。 */
  focus: Id | null;
}

/** 最多留几次：老的从最早交出去的丢起。 */
const KEEP = 40;

/**
 * 按会话记（父视频与子视频之间来回切、重启 App 都还在）：持久化方式同 `useAiToolAgentRuns`（ai-tools-nav.ts）。
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

/** 读回来的记录：形状不对的丢掉。 */
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

/** 记下新交出去的一次；同一条会话再交一次时覆盖（「再切几支」可能发回同一条会话）。 */
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

/** 从这部视频发起的最近一次（没有时 null）。 */
export function latestShortsRun(runs: Record<Id, ShortsRun>, parentVideoId: Id): ShortsRun | null {
  let latest: ShortsRun | null = null;
  for (const run of Object.values(runs)) {
    if (run.parentVideoId !== parentVideoId) continue;
    if (!latest || run.handedAt > latest.handedAt) latest = run;
  }
  return latest;
}
