import { intlLocale, type PairedNode, type ShareStatus } from '@cuccut/protocol';
import { M } from './nodes-copy.ts';

/**
 * Output and arguments of `cuccut nodes` and `cuccut share` (Node protocol spec §10). Split out of main.ts so it can be tested on its own.
 * Tokens never pass through here: neither `ShareStatus` nor `PairedNode` carries a token.
 */

function capabilityLabel(capability: string): string {
  return M.capabilityLabels[capability] ?? capability;
}

/** Arguments of `cuccut share capability <capability> <on|off>`. */
export function parseCapabilitySwitch(args: string[]): { capability: string; enabled: boolean } {
  const [capability, state, ...extra] = args;
  if (!capability || (state !== 'on' && state !== 'off') || extra.length > 0) {
    throw new Error(M.capabilityUsage);
  }
  return { capability, enabled: state === 'on' };
}

/** The lines of `ShareStatus` shown to people. */
export function formatShareStatus(status: ShareStatus): string[] {
  const lines: string[] = [];
  const state = !status.enabled ? M.shareOff : status.listening ? M.shareOn : M.shareNotListening(status.error || null);
  lines.push(M.shareState(state));
  lines.push(M.name(status.name, status.nodeId || null));
  lines.push(M.port(status.port, Boolean(status.allowAnySource)));
  // The address exists only while listening. The reason it is on but not listening is already written on the status line.
  if (status.listening)
    lines.push(
      M.addresses(status.addresses.length > 0 ? status.addresses.map((a) => formatHostPort(a, status.port)).join('  ') : null),
    );
  const capabilities = Object.entries(status.capabilities);
  lines.push(M.capabilitiesHead(capabilities.length === 0));
  for (const [capability, { enabled }] of capabilities) lines.push(M.capabilityLine(capabilityLabel(capability), capability, enabled));
  const pairing = status.pairing;
  if (pairing && 'code' in pairing) lines.push(M.pairingCode(pairing.code, timeOf(pairing.expiresAt)));
  else if (pairing && 'lockedUntil' in pairing) lines.push(M.pairingLocked(timeOf(pairing.lockedUntil)));
  else if (status.enabled) lines.push(M.noPairingCode);
  lines.push(M.clientsHead(status.clients.length === 0));
  for (const c of status.clients) lines.push(M.clientLine(c.name, c.clientId, c.pairedAt, c.lastSeenAt || null));
  if (status.enabled) lines.push(M.remoteTasks(status.jobs.running, status.jobs.queued));
  return lines;
}

function timeOf(at: string | number): string {
  return new Date(at).toLocaleTimeString(intlLocale());
}

/** One line per paired node: cannot connect, version incompatible, pairing invalid, or the status of each capability. */
export function describeNode(node: PairedNode): string {
  const problem =
    node.problem === 'unreachable'
      ? M.unreachable
      : node.problem === 'version'
        ? M.versionMismatch
        : node.problem === 'unpaired'
          ? M.unpaired
          : null;
  let state = problem ?? M.available;
  const transcribe = node.health?.capabilities.transcribe;
  if (!problem && transcribe) {
    const ready = transcribe.bundles.filter((b) => b.state !== 'not-installed' && b.state !== 'error').map((b) => b.bundleId);
    state = transcribe.enabled ? M.transcribeReady(ready, transcribe.running, transcribe.queued) : M.transcribeOff;
  }
  return `${node.alias}  ${node.nodeId}  ${formatHostPort(node.host, node.port)}  ${state}`;
}

export function formatHostPort(host: string, port: number): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}
