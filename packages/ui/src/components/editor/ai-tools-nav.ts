import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiToolId } from '../../model/ai-tools.ts';
import { adoptRestoredRuns, type StoredAgentRun } from '../../model/ai-tools-handoff.ts';
import { useEditor, type PanelTab } from '../../state/editor-store.ts';

/** Context carried when another panel navigates here: which translation a stale-translation refresh comes from, and the language a translate-and-dub pairs with. */
export interface AiToolPreset {
  /** The translation's language name (e.g. 「英语」, English). */
  language?: string | null;
  /** Refresh stale translations: which translation it comes from (the subtitle panel's translation list); when calling the model directly, it refreshes that one by default. */
  translationId?: Id | null;
  /** Short video's 「再切几支」 (cut a few more clips): the parameters page's checkbox 「已经切过的不再找」 (do not look for ones already cut). */
  skipDone?: boolean;
}

export interface AiToolPage {
  tool: AiToolId;
  preset: AiToolPreset | null;
  /** Navigate to the short-video result page (product design §5.10 「结果页」 (result page)); when not given, it goes to the parameters page. */
  phase?: 'setup' | 'result';
  /** Which parent video the result page belongs to: when a child video is open, the parent video's round of results is also shown. */
  host?: Id;
}

/**
 * The tool page open on the AI tools tab, kept per video (not persisted); when none is open, the tab shows the list page (product design §5.10).
 * Clicking a row on the list page, or an entry from another panel carrying a range (prototype `ctx.requestAi`), opens it; the tool page's 「返回」 (Back) returns to the list.
 */
export const useAiToolsNav = create<{ pages: Record<Id, AiToolPage> }>(() => ({ pages: {} }));

export function setAiToolPage(videoId: Id, page: AiToolPage | null): void {
  useAiToolsNav.setState((s) => {
    const { [videoId]: _drop, ...rest } = s.pages;
    return { pages: page ? { ...rest, [videoId]: page } : rest };
  });
}

/** Open a tool page: switch to the AI tools tab (expanding the panel if it is collapsed), carrying the context the entry gave. */
export function openAiTool(videoId: Id, tool: AiToolId, preset: AiToolPreset | null = null): void {
  setAiToolPage(videoId, { tool, preset });
  useEditor.getState().showPanel('aitools');
}

/** Open the short-video result page (on the parent video or on one of its child videos). */
export function openShortsResult(videoId: Id, host: Id): void {
  setAiToolPage(videoId, { tool: 'shortscut', preset: null, phase: 'result', host });
  useEditor.getState().showPanel('aitools');
}

const landings = new Map<Id, PanelTab>();

/**
 * Which page the right-hand panel lands on when switching to another video: a result page opens a child video, and the banner returning to the original lands on the AI tools tab rather than the default script.
 * Taken once, when the editor mounts that video (`takePanelLanding`), and used only once.
 */
export function setPanelLanding(videoId: Id, tab: PanelTab): void {
  landings.set(videoId, tab);
}

export function takePanelLanding(videoId: Id): PanelTab | undefined {
  const tab = landings.get(videoId);
  landings.delete(videoId);
  return tab;
}

/** Close the tool page and go back to the list; if `to` is given, also switch to that page (after translation starts, go to the subtitle page to watch progress). Does not expand the panel on its own if it is collapsed. */
export function closeAiTool(videoId: Id | null, to?: PanelTab): void {
  if (videoId) setAiToolPage(videoId, null);
  if (to && useEditor.getState().panelTab === 'aitools') useEditor.setState({ panelTab: to });
}

/** The one-time handoff from a tool that stays in place (`agentStaysOnPage`): which conversation it went to, which task (none yet for queued ones), and when it was handed off. */
export interface AiToolAgentRun extends StoredAgentRun {
  handedAt: string;
}

/**
 * After finding cut points and refreshing stale translations are handed to the Agent, that one handoff is recorded per 「视频 · 工具」 (video · tool) (`toolDraftKey`): if present, the tool page draws the progress card in place
 * (prototype panel-aitools.jsx `phase === 'agent'`), and it is still there when re-entering from the list. 「重新设置」 (Set up again) and 「完成」 (Done) clear it, and the conversation is not affected.
 * It is recorded on this machine: records read back after a restart are marked `restored`; once the directory is read, they are matched to that conversation (`adoptRestoredRuns`), so ones whose task is still running are reconnected and ones that finished are dropped.
 */
export const useAiToolAgentRuns = create<{ runs: Record<string, AiToolAgentRun> }>()(
  persist(() => ({ runs: {} as Record<string, AiToolAgentRun> }), {
    name: 'cuccut.ai-tool-agent-runs',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: ({ runs }) => ({ runs }),
    merge: (persisted, current) => ({ ...current, runs: restoredRuns(persisted) }),
  }),
);

/** Records read back: malformed ones are dropped, and the rest are marked `restored`. */
function restoredRuns(persisted: unknown): Record<string, AiToolAgentRun> {
  const raw = (persisted as { runs?: unknown } | null)?.runs;
  if (!raw || typeof raw !== 'object') return {};
  const runs: Record<string, AiToolAgentRun> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const run = value as Partial<AiToolAgentRun> | null;
    if (!run || typeof run.conversationId !== 'string' || typeof run.handedAt !== 'string') continue;
    runs[key] = { conversationId: run.conversationId, taskId: typeof run.taskId === 'string' ? run.taskId : null, handedAt: run.handedAt, restored: true };
  }
  return runs;
}

export function setAiToolAgentRun(key: string, run: AiToolAgentRun | null): void {
  useAiToolAgentRuns.setState((s) => {
    const { [key]: _drop, ...rest } = s.runs;
    return { runs: run ? { ...rest, [key]: run } : rest };
  });
}

/** Match the record left last time to its conversation (`adoptRestoredRuns`): match again if the directory or the queue changed. */
export function syncAiToolAgentRuns(context: Parameters<typeof adoptRestoredRuns>[1]): void {
  useAiToolAgentRuns.setState((s) => {
    const runs = adoptRestoredRuns(s.runs, context);
    return runs === s.runs ? s : { runs };
  });
}
