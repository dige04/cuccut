import { afterEach, describe, expect, it } from 'vitest';
import type { AgentsView, DriverInfo } from '@cuccut/protocol';
import { defaultDriver, useConnection } from './connection-store.ts';

const driver = (id: 'claude' | 'codex', isDefault = false) => ({ id, isDefault }) as DriverInfo;

describe('agent list in the connection mirror', () => {
  afterEach(() => useConnection.setState({ drivers: null, checking: [], agentPreferences: null }));

  it('setAgents replaces the whole thing: probe results, the Driver being probed for the first time, and preferences', () => {
    const preferences = { drivers: {}, rules: [] } as unknown as AgentsView['preferences'];
    useConnection.getState().setAgents({ drivers: [], checking: ['claude', 'codex'], preferences });
    expect(useConnection.getState()).toMatchObject({ drivers: [], checking: ['claude', 'codex'], agentPreferences: preferences });
    useConnection.getState().setAgents({ drivers: [driver('codex', true)], checking: ['claude'], preferences });
    expect(useConnection.getState()).toMatchObject({ drivers: [{ id: 'codex' }], checking: ['claude'] });
  });

  it('defaultDriver: the one marked default takes priority; if none is marked default and some are being detected, no conclusion yet', () => {
    expect(defaultDriver(null, [])).toBeNull();
    expect(defaultDriver([driver('claude'), driver('codex', true)], ['claude'])?.id).toBe('codex');
    // The default one is probably still being detected, so do not substitute the first one.
    expect(defaultDriver([driver('claude')], ['codex'])).toBeNull();
    expect(defaultDriver([driver('claude'), driver('codex')], [])?.id).toBe('claude');
  });
});
