import { create } from 'zustand';
import { applyAgentSetupEvent } from '@cuccut/client';
import type { AgentSetupEvent, AgentSetupRun, AgentSetupSnapshot, Id } from '@cuccut/protocol';

/**
 * Mirror of the Agent install and upgrade commands run on the settings page (`agent-setup` topic). Subscribed only while the Agent providers tab is open (`watchAgentSetup`);
 * cleared on leaving.
 *
 * `shown`: the runs seen as "running" during this subscription. The log box shows only those (and any still running). The Runtime keeps the latest 20 in memory, and earlier finished runs are no longer attached under the command (the run state of useCmdRun in the design draft is held by the card and is lost when the page is left).
 */
export interface AgentSetupStore {
  ready: boolean;
  runs: AgentSetupRun[];
  shown: ReadonlySet<Id>;
  replace(snapshot: AgentSetupSnapshot): void;
  apply(event: AgentSetupEvent): void;
  reset(): void;
}

function withLive(shown: ReadonlySet<Id>, runs: readonly AgentSetupRun[]): ReadonlySet<Id> {
  const live = runs.filter((run) => run.state === 'running' && !shown.has(run.runId));
  return live.length ? new Set([...shown, ...live.map((run) => run.runId)]) : shown;
}

export const useAgentSetup = create<AgentSetupStore>()((set) => ({
  ready: false,
  runs: [],
  shown: new Set(),
  replace: (snapshot) => set((s) => ({ ready: true, runs: snapshot.runs, shown: withLive(s.shown, snapshot.runs) })),
  apply: (event) =>
    set((s) => {
      const { runs } = applyAgentSetupEvent(s, event);
      return { runs, shown: withLive(s.shown, runs) };
    }),
  reset: () => set({ ready: false, runs: [], shown: new Set() }),
}));
