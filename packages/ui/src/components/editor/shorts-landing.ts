import { useEffect } from 'react';
import type { Id } from '@cuccut/protocol';
import { agentRunState } from '../../model/ai-tools-handoff.ts';
import { createdVideoIds, shortsBatch } from '../../model/shorts-result.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useSpace } from '../../state/space-store.ts';
import { useTimeline } from '../../state/timeline-store.ts';
import { openShortsResult } from './ai-tools-nav.ts';
import { latestShortsRun, markShortsRunLanded, useShortsRuns } from './shorts-runs.ts';

/**
 * When a “cut into shorts” run finishes, flip to the result page (product design §5.10). If the parent video that started the round is open and that round has not been flipped yet, watch that session. When the task ends
 * (completed, failed or stopped) and child videos were cut, the right panel switches to the result page of the AI Tools tab. Whether or not it flipped, record it (`landed`), so opening this video later does not flip again by itself.
 * If a video was just created in the session and no shorts have arrived in Space yet, wait a moment first, so an empty list does not count as already flipped.
 * The web host has no AI Tools tab: when `enabled` is false, do nothing.
 */
export function useShortsLanding(videoId: Id | null, enabled: boolean): void {
  const runtime = useRuntime();
  const run = useShortsRuns((s) => {
    const latest = videoId ? latestShortsRun(s.runs, videoId) : null;
    return latest && !latest.landed ? latest : null;
  });
  const conversationId = enabled ? (run?.conversationId ?? null) : null;
  useEffect(() => (conversationId ? runtime.watchConversation(conversationId) : undefined), [runtime, conversationId]);
  const items = useTimeline((s) => (conversationId ? s.byConversationId[conversationId]?.items : undefined));
  const entries = useSpace((s) => s.entries);
  const spaceReady = useSpace((s) => s.ready);

  useEffect(() => {
    if (!enabled || !run || !videoId || !items || !spaceReady) return;
    const state = agentRunState({ taskId: run.taskId, handedAt: run.handedAt, items });
    if (state.kind !== 'done' && state.kind !== 'failed' && state.kind !== 'stopped') return;
    const created = createdVideoIds(items);
    const batch = shortsBatch(entries, { parentVideoId: videoId, conversationId: run.conversationId, handedAt: run.handedAt, created });
    if (!batch.length && created?.size) return;
    markShortsRunLanded(run.conversationId);
    if (batch.some((e) => !e.user.trashedAt)) openShortsResult(videoId, videoId);
  }, [enabled, run, videoId, items, entries, spaceReady]);
}
