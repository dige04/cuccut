import { afterEach, describe, expect, it } from 'vitest';
import type { AgentSetupEvent, AgentSetupRun, AgentSetupSnapshot, AgentsView, DriverInfo, ModelCapabilitiesView } from '@cuccut/protocol';
import { useAgentSetup } from '../state/agent-setup-store.ts';
import { useConnection } from '../state/connection-store.ts';
import { useModels } from '../state/models-store.ts';
import {
  addAgentProvider,
  probeModelCapabilities,
  removeAgentProvider,
  runAgentSetup,
  setAgentProviderEnabled,
  watchAgentSetup,
} from './agent-commands.ts';
import type { RuntimeSession } from './session.ts';

/** `watchAgentSetup` and its mirror: a fake session, with only subscription and `agents.list`. */

function setupRun(patch: Partial<AgentSetupRun> = {}): AgentSetupRun {
  return {
    runId: 'setup_1',
    driverId: 'codex',
    action: 'upgrade',
    kind: 'brew',
    command: 'brew upgrade codex',
    state: 'running',
    exitCode: null,
    output: [],
    droppedLines: 0,
    startedAt: '2026-10-03T00:00:00.000Z',
    endedAt: null,
    error: null,
    ...patch,
  };
}

function fakeSession() {
  let handlers: { snapshot: (s: AgentSetupSnapshot) => void; event: (e: AgentSetupEvent) => void } | null = null;
  const calls: string[] = [];
  let release: (() => void) | null = null;
  let hold = false;
  const view = { drivers: [{ id: 'codex', version: '0.131.0' } as DriverInfo], checking: [], preferences: {} } as unknown as AgentsView;
  const session = {
    client: {
      subscribeAgentSetup: (h: typeof handlers) => {
        handlers = h;
        return () => (handlers = null);
      },
      request: async (method: string, params: { driverId?: string; kind?: string }) => {
        calls.push(method);
        if (method === 'agents.list') {
          // Hold back the list first (only once), and check that before it returns, the terminal state does not enter the mirror, and that later events do not jump ahead.
          if (hold) {
            hold = false;
            await new Promise<void>((resolve) => (release = resolve));
          }
          return view;
        }
        if (method === 'agents.runSetup') return { run: setupRun({ runId: 'setup_2', kind: params.kind as 'brew' }) };
        throw new Error(method);
      },
    },
  } as unknown as RuntimeSession;
  return {
    session,
    calls,
    view,
    emit: () => handlers!,
    hold: () => (hold = true),
    release: () => release?.(),
    subscribed: () => handlers !== null,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('watchAgentSetup', () => {
  afterEach(() => useAgentSetup.getState().reset());

  it('terminal state first reads agents.list and writes back to the connection mirror, then goes to the run mirror; the callback fires once only for the run being watched to completion', async () => {
    const fake = fakeSession();
    const finished: AgentSetupRun[] = [];
    const stop = watchAgentSetup(fake.session, (run) => finished.push(run));
    fake.emit().snapshot({ runs: [setupRun({ runId: 'old', state: 'completed', exitCode: 0 })] });
    fake.emit().event({ type: 'setup.updated', run: setupRun() });
    fake.emit().event({ type: 'setup.output', runId: 'setup_1', lines: ['==> Upgrading'] });
    await flush();
    expect(useAgentSetup.getState()).toMatchObject({ ready: true });
    expect(useAgentSetup.getState().runs.map((r) => r.runId)).toEqual(['setup_1', 'old']);
    // Runs that finished before are not shown; runs seen running in this subscription are shown.
    expect([...useAgentSetup.getState().shown]).toEqual(['setup_1']);

    fake.hold();
    fake.emit().event({ type: 'setup.updated', run: setupRun({ state: 'completed', exitCode: 0, output: ['==> Upgrading'] }) });
    fake.emit().event({ type: 'setup.updated', run: setupRun({ runId: 'old', state: 'completed', exitCode: 0 }) });
    await flush();
    expect(useAgentSetup.getState().runs.map((r) => r.state)).toEqual(['running', 'completed']);
    expect(fake.calls).toEqual(['agents.list']);
    fake.release();
    await flush();
    await flush();
    expect(fake.calls).toEqual(['agents.list', 'agents.list']);
    expect(useConnection.getState().drivers).toEqual(fake.view.drivers);
    expect(useAgentSetup.getState().runs[0]).toMatchObject({ state: 'completed', output: ['==> Upgrading'] });
    expect(finished.map((r) => r.runId)).toEqual(['setup_1']);

    stop();
    expect(fake.subscribed()).toBe(false);
    expect(useAgentSetup.getState()).toMatchObject({ ready: false, runs: [] });
  });

  it('runAgentSetup: when the theme event arrives first, it is not overwritten by empty output', async () => {
    const fake = fakeSession();
    const stop = watchAgentSetup(fake.session);
    fake.emit().snapshot({ runs: [] });
    fake.emit().event({ type: 'setup.updated', run: setupRun({ runId: 'setup_2' }) });
    fake.emit().event({ type: 'setup.output', runId: 'setup_2', lines: ['a'] });
    await flush();
    await runAgentSetup(fake.session, 'codex', 'upgrade', 'brew');
    expect(useAgentSetup.getState().runs).toHaveLength(1);
    expect(useAgentSetup.getState().runs[0]!.output).toEqual(['a']);
    stop();
  });
});

describe('the two commands for drawing diagrams with Codex', () => {
  afterEach(() => useModels.setState({ ready: false, capabilities: null }));

  it('probeModelCapabilities writes probe results into useModels; setAgentProviderEnabled carries only the toggle', async () => {
    const capabilities = { generateImage: { default: null, effective: null, providers: [] } } as unknown as ModelCapabilitiesView;
    const calls: [string, unknown][] = [];
    const session = {
      client: {
        request: async (method: string, params: unknown) => {
          calls.push([method, params]);
          if (method === 'models.capabilities') return { capabilities };
          if (method === 'models.configure') return { provider: { providerId: 'agent:codex' } };
          throw new Error(method);
        },
      },
    } as unknown as RuntimeSession;
    await probeModelCapabilities(session);
    expect(useModels.getState()).toMatchObject({ ready: true, capabilities });
    const provider = await setAgentProviderEnabled(session, 'agent:codex', true);
    expect(provider.providerId).toBe('agent:codex');
    expect(calls).toEqual([
      ['models.capabilities', {}],
      ['models.configure', { providerId: 'agent:codex', enabled: true }],
    ]);
  });
});

describe('adding and removing agents', () => {
  afterEach(() => useConnection.setState({ drivers: null, checking: [], agentPreferences: null }));

  it('addAgentProvider carries the new commandId, and the returned view is written back to the connection mirror in full; removeAgentProvider carries only the id', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const added = { drivers: [], checking: ['goose'], preferences: {} } as unknown as AgentsView;
    const removed = { drivers: [], checking: [], preferences: {} } as unknown as AgentsView;
    const session = {
      client: {
        request: async (method: string, params: Record<string, unknown>) => {
          calls.push([method, params]);
          if (method === 'agents.addProvider') return added;
          if (method === 'agents.removeProvider') return removed;
          throw new Error(method);
        },
      },
    } as unknown as RuntimeSession;
    await addAgentProvider(session, { id: 'goose', name: 'goose', command: ['goose', 'acp'] });
    expect(useConnection.getState().checking).toEqual(['goose']);
    expect(calls[0]![1]).toMatchObject({ id: 'goose', name: 'goose', command: ['goose', 'acp'] });
    expect(calls[0]![1].commandId).toMatch(/^cmd/);
    expect('env' in calls[0]![1]).toBe(false);
    await removeAgentProvider(session, 'goose');
    expect(calls[1]).toEqual(['agents.removeProvider', { id: 'goose' }]);
    expect(useConnection.getState().checking).toEqual([]);
  });
});
