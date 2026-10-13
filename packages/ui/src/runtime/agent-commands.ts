import {
  newId,
  type AgentMode,
  type AgentPolicy,
  type AgentSetupAction,
  type AgentSetupRun,
  type AgentsView,
  type DriverId,
  type DriverInstallOption,
  type Id,
  type ModelCapabilitiesView,
  type ProviderView,
} from '@cuccut/protocol';
import { useAgentSetup } from '../state/agent-setup-store.ts';
import { useConnection } from '../state/connection-store.ts';
import { useModels } from '../state/models-store.ts';
import { useSettings } from '../state/settings-store.ts';
import type { RuntimeSession } from './session.ts';

/**
 * Commands for the Agent provider settings (`agents.*`). Each returns the complete `AgentsView`; once received, the whole view is written back to the connection mirror, and the UI does not change agent state locally.
 * Like the other `RuntimeSession` commands, they go through its connection. They live in a separate file so the settings page's commands do not overload the session channel.
 */
async function apply(view: Promise<AgentsView>): Promise<AgentsView> {
  const result = await view;
  useConnection.getState().setAgents(result);
  return result;
}

/** “Re-detect”: does not use the cache; re-probes installation, version and login, and refreshes the model table. */
export function detectAgents(session: RuntimeSession, driverId?: DriverId): Promise<AgentsView> {
  return apply(session.client.request('agents.detect', driverId ? { driverId } : {}));
}

/**
 * Enable or disable; default model and effort; a manually specified executable (null clears the choice and returns to automatic lookup).
 * If only `defaultModel` is changed, without `defaultEffort`, the Runtime resets the effort to the model's default.
 */
export function configureAgent(
  session: RuntimeSession,
  driverId: DriverId,
  patch: { enabled?: boolean; defaultModel?: string | null; defaultEffort?: string | null; executable?: string | null },
): Promise<AgentsView> {
  return apply(session.client.request('agents.configure', { driverId, ...patch }));
}

export function setDefaultAgent(session: RuntimeSession, driverId: DriverId): Promise<AgentsView> {
  return apply(session.client.request('agents.setDefault', { driverId }));
}

/**
 * Adds an ACP-speaking agent (a catalog entry or a custom command; product design §7.6). The Runtime stores it, registers it as a Driver, and probes it in the background. Right after returning, it is most likely still `checking`; the probe result is delivered through the `agents` topic. A duplicate id is rejected with `conflict` (`details.code: 'AGENT_PROVIDER_EXISTS'`).
 * Browser sessions cannot call it (it is not on the Web allowlist).
 */
export function addAgentProvider(
  session: RuntimeSession,
  provider: { id: DriverId; name: string; command: string[]; env?: Record<string, string> },
): Promise<AgentsView> {
  return apply(session.client.request('agents.addProvider', { ...provider, commandId: newId('cmd') }));
}

/** Removes a user-added agent, along with its probe cache, enabled state and default model preference. Built-in agents cannot be removed (disable them with `configureAgent`). */
export function removeAgentProvider(session: RuntimeSession, id: DriverId): Promise<AgentsView> {
  return apply(session.client.request('agents.removeProvider', { id }));
}

export function updateAgentPreferences(
  session: RuntimeSession,
  patch: { policy?: Partial<AgentPolicy>; modelAutoUpdate?: boolean },
): Promise<AgentsView> {
  return apply(session.client.request('agents.updatePreferences', patch));
}

export function removeAgentRule(session: RuntimeSession, rule: string): Promise<AgentsView> {
  return apply(session.client.request('agents.removeRule', { rule }));
}

/**
 * Default access mode for new sessions (setting `agent.defaultAccessMode`, §3.12). Sessions that have never changed their access mode also follow it.
 * The returned snapshot is written into `useSettings` first; the change pushed later on the `settings` topic is the same value.
 */
export async function setDefaultAccessMode(session: RuntimeSession, mode: AgentMode): Promise<void> {
  const snapshot = await session.client.request('settings.set', { values: { 'agent.defaultAccessMode': mode } });
  useSettings.getState().replace(snapshot);
}

// ---- Install, upgrade and login (architecture design §12.9): the commands are all taken from the probe results by the Runtime; here we only say which Agent and what to do, and in which way ----

/**
 * Runs an install or upgrade command from the settings page (only brew and npm kinds; called only after the user has seen the full command in the confirmation dialog). Returns the run that was just registered; later output and results are delivered through the `agent-setup` topic (`watchAgentSetup`).
 */
export async function runAgentSetup(
  session: RuntimeSession,
  driverId: DriverId,
  action: AgentSetupAction,
  kind: DriverInstallOption['kind'],
): Promise<AgentSetupRun> {
  const { run } = await session.client.request('agents.runSetup', { driverId, action, kind, commandId: newId('cmd') });
  // Topic events may arrive first (already carrying output). They are added only if this run is not yet in the mirror, so the output is not overwritten with an empty one.
  const store = useAgentSetup.getState();
  if (!store.runs.some((r) => r.runId === run.runId)) store.apply({ type: 'setup.updated', run });
  return run;
}

export async function cancelAgentSetup(session: RuntimeSession, runId: Id): Promise<void> {
  await session.client.request('agents.cancelSetup', { runId });
}

/**
 * Runs a login, install or upgrade command in the system terminal (for commands that are interactive, need a password, or come from an official script).
 * When the result is `unsupported` (a terminal cannot be opened on this machine), it includes the command, and the caller falls back to copying it.
 */
export function openAgentTerminal(
  session: RuntimeSession,
  driverId: DriverId,
  action: 'login' | AgentSetupAction,
  kind?: DriverInstallOption['kind'],
): Promise<{ status: 'opened' | 'unsupported'; command: string }> {
  return session.client.request('agents.openTerminal', kind ? { driverId, action, kind } : { driverId, action });
}

/**
 * Subscribes to the `agent-setup` topic and writes into `useAgentSetup`. Returns an unsubscribe function (which also clears the mirror). Subscribed only while the Agent provider tab is mounted.
 *
 * When a run reaches its terminal state, the Runtime has already re-probed. It first reads `agents.list` and writes it back to the connection mirror, then hands the terminal state to the UI, so that when the UI sees “completed”, the version and login state are already new. `onFinished` is called after that (the success toast uses it).
 * The `agents` topic also pushes new views, but the protocol does not guarantee that they arrive before the `agent-setup` terminal state, so this still reads the list once actively.
 * Snapshots and events are processed serially in arrival order, so the list read does not let later events jump ahead.
 */
export function watchAgentSetup(session: RuntimeSession, onFinished?: (run: AgentSetupRun, view: AgentsView | null) => void): () => void {
  let stopped = false;
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (step: () => Promise<void> | void) => {
    queue = queue.then(step).catch(() => {});
  };
  const unsubscribe = session.client.subscribeAgentSetup({
    snapshot: (snapshot) => enqueue(() => {
      if (!stopped) useAgentSetup.getState().replace(snapshot);
    }),
    event: (event) =>
      enqueue(async () => {
        if (stopped) return;
        const finished = event.type === 'setup.updated' && event.run.state !== 'running' ? event.run : null;
        const wasRunning = finished ? useAgentSetup.getState().runs.find((r) => r.runId === finished.runId)?.state === 'running' : false;
        const view = finished ? await apply(session.client.request('agents.list', {})).catch(() => null) : null;
        if (stopped) return;
        useAgentSetup.getState().apply(event);
        // Only the callback for a run that was seen running through to the end in this subscription; old terminal states replayed after a reconnect do not pop up again.
        if (finished && wasRunning) onFinished?.(finished, view);
      }),
  });
  return () => {
    stopped = true;
    unsubscribe();
    useAgentSetup.getState().reset();
  };
}

// ---- Image generation with Codex (the image-generation agent provider `agent:codex`, architecture design §6.9): the switch is on the Codex card, and its state is a view of the model service ----

/**
 * Probes model capabilities once (`models.capabilities`: asks the Driver and nodes, up to about 2 seconds) and writes the result into `useModels`.
 * When the view has not changed, the `models` topic pushes no event, so this writes it directly.
 */
export async function probeModelCapabilities(session: RuntimeSession): Promise<ModelCapabilitiesView> {
  const { capabilities } = await session.client.request('models.capabilities', {});
  useModels.getState().apply({ type: 'capabilities.updated', capabilities });
  return capabilities;
}

/** Turns an agent provider on or off (toggle only). The new view reaches `useModels` through the `models` topic, so it is not written separately here. */
export async function setAgentProviderEnabled(session: RuntimeSession, providerId: string, enabled: boolean): Promise<ProviderView> {
  const { provider } = await session.client.request('models.configure', { providerId, enabled });
  return provider;
}
