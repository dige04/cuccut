import { create } from 'zustand';
import type { ConnectionState } from '@cuccut/client';
import type { AgentPreferences, AgentsView, DriverId, DriverInfo } from '@cuccut/protocol';

/** Connection and capability snapshot with the Runtime (architecture design §3.6). */
export interface ConnectionStore {
  state: ConnectionState;
  /** The most recent probe result for each Driver (at startup, from the Runtime's disk cache). null = no snapshot for the `agents` topic yet. */
  drivers: DriverInfo[] | null;
  /** Drivers that have no probe result yet and are being probed for the first time (not in `drivers`). */
  checking: DriverId[];
  /** Agent preferences (default Agent, default model, last access mode, the allow policy and its rules). */
  agentPreferences: AgentPreferences | null;
  setState(state: ConnectionState): void;
  setAgents(view: AgentsView): void;
}

export const useConnection = create<ConnectionStore>()((set) => ({
  state: { status: 'connecting', attempt: 0 },
  drivers: null,
  checking: [],
  agentPreferences: null,
  setState: (state) => set({ state }),
  setAgents: (view) => set({ drivers: view.drivers, checking: view.checking, agentPreferences: view.preferences }),
}));

/**
 * The Agent used by default for new sessions. If no entry in the result is marked as default and some Driver is still being probed for the first time, the default is probably still being detected:
 * return null (display "detecting"). Do not substitute the first one, so that the Agent is not silently switched to another one.
 */
export function defaultDriver(drivers: readonly DriverInfo[] | null, checking: readonly DriverId[]): DriverInfo | null {
  const marked = drivers?.find((d) => d.isDefault);
  if (marked) return marked;
  return checking.length ? null : (drivers?.[0] ?? null);
}
