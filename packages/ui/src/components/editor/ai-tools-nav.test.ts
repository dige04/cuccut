import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAiToolAgentRun, syncAiToolAgentRuns, useAiToolAgentRuns } from './ai-tools-nav.ts';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
});

const KEY = 'cuccut.ai-tool-agent-runs';
const run = { conversationId: 'c1', taskId: 't1', handedAt: '2026-10-10T08:00:00Z' };

/** Simulate a restart: what was stored stays, memory is cleared, and it is read back from this machine. */
async function restart() {
  const saved = localStorage.getItem(KEY);
  useAiToolAgentRuns.setState({ runs: {} });
  if (saved) localStorage.setItem(KEY, saved);
  await useAiToolAgentRuns.persist.rehydrate();
}

describe('tool page left in place: reattached after restart', () => {
  beforeEach(async () => {
    useAiToolAgentRuns.setState({ runs: {} });
    localStorage.removeItem(KEY);
    await useAiToolAgentRuns.persist.rehydrate();
  });

  it('what was handed off this time is not marked restored; everything read back after restart is marked', async () => {
    setAiToolAgentRun('aitool:v1:cleanup', run);
    expect(useAiToolAgentRuns.getState().runs['aitool:v1:cleanup']).toEqual(run);
    await restart();
    expect(useAiToolAgentRuns.getState().runs['aitool:v1:cleanup']).toEqual({ ...run, restored: true });
  });

  it('after the directory is read: tasks still running are reattached, finished ones are dropped', async () => {
    setAiToolAgentRun('aitool:v1:cleanup', run);
    setAiToolAgentRun('aitool:v1:stale', { ...run, conversationId: 'c2', taskId: 't2' });
    await restart();
    const conversations = [
      { id: 'c1', activeTaskId: 't1' },
      { id: 'c2', activeTaskId: null },
    ];
    syncAiToolAgentRuns({ ready: false, conversations, queued: () => false });
    expect(Object.values(useAiToolAgentRuns.getState().runs).every((r) => r.restored)).toBe(true);
    syncAiToolAgentRuns({ ready: true, conversations, queued: () => false });
    expect(useAiToolAgentRuns.getState().runs).toEqual({ 'aitool:v1:cleanup': run });
  });

  it('records with the wrong shape are dropped when read back', async () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { runs: { a: { conversationId: 1 }, b: run } }, version: 1 }));
    await useAiToolAgentRuns.persist.rehydrate();
    expect(useAiToolAgentRuns.getState().runs).toEqual({ b: { ...run, restored: true } });
  });
});
