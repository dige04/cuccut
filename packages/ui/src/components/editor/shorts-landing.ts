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
 * 剪成短视频跑完就翻到结果页（产品设计 §5.10）：开着的是发起那一轮的父视频、那一轮还没翻过时，看着那条会话；任务结束
 * （完成、失败或停下）且切出了子视频，右侧面板换到 AI 工具 Tab 的结果页。翻没翻都记下（`landed`），之后打开这部视频不再自己翻。
 * 会话里新建了视频、Space 还一支都没收到时先等一等，免得列表是空的就算翻过了。
 * 网页宿主没有 AI 工具 Tab：`enabled` 为 false 时什么都不做。
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
