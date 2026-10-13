import {
  NODE_DEFAULT_PORT,
  NODE_SHAREABLE_CAPABILITIES,
  REMOTE_NODE_ERROR,
  type DiscoveredNode,
  type ModelCapabilitiesView,
  type PairedNode,
  type ShareStatus,
} from '@cuccut/protocol';
import { REMOTE_COPY, REMOTE_TASK_COPY } from '../copy.ts';
import { agoLabel, formatDuration } from './format.ts';
import type { ServiceTone } from './services.ts';

/**
 * Pure model for the remote compute page (product design §2.1; prototype designs/cuccut/app/page-shell.jsx `RemotePage` and model-services.js `REMOTE_TASKS`). It reads the real return values of `nodes.share.status` / `nodes.list` / `nodes.discover` and does not invent numbers.
 */

// ---- Share this Mac ----

/** “192.168.1.31:47610”; IPv6 addresses are wrapped in brackets. */
export function hostPort(host: string, port: number): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}

/** Addresses that can be reached right now, one `host:port` per item; empty when not listening. */
export function shareAddresses(status: Pick<ShareStatus, 'addresses' | 'port'>): string[] {
  return status.addresses.map((address) => hostPort(address, status.port));
}

/** The pairing code is grouped in threes for readability: “481924” → “481 924”. */
export function formatPairingCode(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

function clockTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export type PairingView =
  | { kind: 'code'; code: string; hint: string }
  | { kind: 'locked'; text: string }
  | { kind: 'none'; text: string };

/**
 * Contents of the pairing code block: when there is a code, shows the code and a countdown; when too many wrong attempts have been made, shows the time the lock lifts; when the code has been used, has expired (judged locally by `expiresAt`, without waiting for the next poll), or there is no code after a Runtime restart, gives one sentence on why, and the button becomes “生成配对码”（Generate pairing code).
 */
export function pairingView(pairing: ShareStatus['pairing'], now: number): PairingView {
  if (pairing && 'lockedUntil' in pairing && Date.parse(pairing.lockedUntil) > now) {
    return { kind: 'locked', text: REMOTE_COPY.pairingLocked(clockTime(pairing.lockedUntil)) };
  }
  if (pairing && 'code' in pairing) {
    const left = Date.parse(pairing.expiresAt) - now;
    if (left > 0) {
      return { kind: 'code', code: formatPairingCode(pairing.code), hint: REMOTE_COPY.pairingHint(formatDuration(Math.ceil(left / 1000) * 1000)) };
    }
  }
  return { kind: 'none', text: REMOTE_COPY.pairingNone };
}

/** Transcription models available on this machine (the model packs available in the local Provider); node-received transcription tasks use these. null when the model view has not loaded yet. */
export function localTranscribeModels(capabilities: ModelCapabilitiesView | null): string[] | null {
  if (!capabilities) return null;
  return capabilities.transcribe.providers
    .filter((provider) => provider.kind === 'local' && provider.available)
    .flatMap((provider) => provider.models.filter((model) => model.available !== false).map((model) => model.label));
}

export interface RemoteTaskRow {
  key: string;
  name: string;
  /** The capability name in the node protocol; null = this version cannot share this kind of task. */
  capability: string | null;
  on: boolean;
  disabled: boolean;
  desc: string | null;
  /** The local models this kind of task uses (transcription only). */
  models: string[];
}

/**
 * Rows of “tasks offered to other computers”, in the same order as the prototype's task catalog. The shareable ones (`NODE_SHAREABLE_CAPABILITIES`) have toggles that read and write `capabilities[...].enabled`; when no model is installed, the toggle is not disabled (the backend can still be turned on), and the sub-line only says that the other side's tasks will fail. The other kinds have no backend in this version; they are drawn as disabled, switched-off toggles with the reason explained.
 */
export function remoteTaskRows(
  status: Pick<ShareStatus, 'capabilities'>,
  transcribeModels: string[] | null,
): RemoteTaskRow[] {
  const shareable = NODE_SHAREABLE_CAPABILITIES as readonly string[];
  return REMOTE_TASK_COPY.map((task) => {
    const capability = task.capability && shareable.includes(task.capability) ? task.capability : null;
    if (!capability) {
      return { key: task.key, name: task.name, capability: null, on: false, disabled: true, desc: REMOTE_COPY.taskUnsupported, models: [] };
    }
    const models = capability === 'transcribe' ? (transcribeModels ?? []) : [];
    const noun = task.noun;
    const missing = capability === 'transcribe' && transcribeModels !== null && !transcribeModels.length;
    return {
      key: task.key,
      name: task.name,
      capability,
      on: status.capabilities[capability]?.enabled === true,
      disabled: false,
      desc: missing && noun ? REMOTE_COPY.taskNoModel(noun) : null,
      models,
    };
  });
}

/** Summary on the right of the section heading: the number of enabled capabilities / the number of capabilities this version can share. */
export function remoteTaskSummary(rows: RemoteTaskRow[]): string {
  const real = rows.filter((row) => row.capability);
  return REMOTE_COPY.taskSummary(real.filter((row) => row.on).length, real.length);
}

export function jobsLabel(jobs: { running: number; queued: number }): string {
  return jobs.running || jobs.queued ? REMOTE_COPY.jobs(jobs.running, jobs.queued) : REMOTE_COPY.idle;
}

export function shareClientMeta(client: ShareStatus['clients'][number], now: number): string {
  return REMOTE_COPY.clientMeta(agoLabel(client.pairedAt, now), client.lastSeenAt ? agoLabel(client.lastSeenAt, now) : null);
}

// ---- Using other computers ----

const OS_LABEL: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

/** Status of a model pack being usable (installed, whether or not it is currently loaded); `not-installed` and `error` don't count. */
const USABLE_BUNDLE = new Set(['installed', 'loading', 'ready', 'busy', 'unloading']);

export interface NodeCardView {
  address: string;
  tone: ServiceTone;
  chip: { text: string; variant: 'positive' | 'neutral' | 'notice' };
  meta: string;
  /** One sentence on why it can't be used and what to do about it (assembled from `problem`; not called a diagnosis). */
  problem: string | null;
}

export function nodeCardView(node: PairedNode): NodeCardView {
  const address = hostPort(node.host, node.port);
  const meta: string[] = [address];
  const health = node.health;
  if (health) {
    meta.push(OS_LABEL[health.platform.os] ?? health.platform.os, health.platform.arch, `CucCut ${health.runtimeVersion}`);
    const transcribe = health.capabilities.transcribe;
    if (!transcribe.enabled) meta.push(REMOTE_COPY.transcribeOff);
    else meta.push(REMOTE_COPY.transcribeModels(transcribe.bundles.filter((b) => USABLE_BUNDLE.has(b.state)).length));
    if (transcribe.running || transcribe.queued) meta.push(REMOTE_COPY.jobs(transcribe.running, transcribe.queued));
  }
  const problem = node.problem ? REMOTE_COPY.problem[node.problem] : null;
  if (node.problem === 'unreachable' || (!node.problem && !health)) {
    return { address, tone: 'off', chip: { text: REMOTE_COPY.offline, variant: 'neutral' }, meta: meta.join(' · '), problem };
  }
  if (node.problem === 'version') {
    return { address, tone: 'error', chip: { text: REMOTE_COPY.versionMismatch, variant: 'notice' }, meta: meta.join(' · '), problem };
  }
  if (node.problem === 'unpaired') {
    return { address, tone: 'error', chip: { text: REMOTE_COPY.unpaired, variant: 'notice' }, meta: meta.join(' · '), problem };
  }
  return { address, tone: 'on', chip: { text: REMOTE_COPY.online, variant: 'positive' }, meta: meta.join(' · '), problem: null };
}

/** Removes nearby computers that are already paired (by nodeId; by address for those that did not report a nodeId). */
export function unpairedNearby(found: DiscoveredNode[], paired: PairedNode[]): DiscoveredNode[] {
  const ids = new Set(paired.map((node) => node.nodeId));
  const addresses = new Set(paired.map((node) => hostPort(node.host, node.port)));
  return found.filter((node) => (node.nodeId ? !ids.has(node.nodeId) : !addresses.has(hostPort(node.host, node.port))));
}

export type ParsedAddress = { host: string; port: number } | { error: string };

/** Input for “Add by address”: `host`, `host:port`, `[v6]:port`; may include `http://` and a trailing `/`. Without a port, the node's default port is used. */
export function parseNodeAddress(text: string): ParsedAddress {
  const raw = text.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!raw) return { error: REMOTE_COPY.addressEmpty };
  let host: string;
  let portText: string | undefined;
  const v6 = /^\[([0-9a-fA-F:.]+)\](?::(\d*))?$/.exec(raw);
  if (v6) {
    host = v6[1] as string;
    portText = v6[2];
  } else if ((raw.match(/:/g) ?? []).length > 1) {
    if (!/^[0-9a-fA-F:.]+$/.test(raw)) return { error: REMOTE_COPY.addressInvalid };
    host = raw;
  } else {
    const plain = /^([^\s:/[\]]+)(?::(\d*))?$/.exec(raw);
    if (!plain) {
      return /^[^\s:/[\]]+:/.test(raw) ? { error: REMOTE_COPY.portInvalid } : { error: REMOTE_COPY.addressInvalid };
    }
    host = plain[1] as string;
    portText = plain[2];
  }
  if (portText === undefined) return { host, port: NODE_DEFAULT_PORT };
  const port = Number(portText);
  if (!/^\d{1,5}$/.test(portText) || port < 1 || port > 65535) return { error: REMOTE_COPY.portInvalid };
  return { host, port };
}

/** Pairing code input: after removing spaces and hyphens, it must be 6 digits. */
export function normalizePairingCode(text: string): string | null {
  const code = text.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

/** The message shown to the person when `nodes.pair` fails: for `details.code` / `details.reason` values it recognizes, it explains clearly what to do; for unrecognized ones, it includes the original text. */
export function pairErrorMessage(error: unknown): string {
  const details = (error as { details?: unknown } | null)?.details;
  if (details && typeof details === 'object') {
    const { code, reason } = details as { code?: unknown; reason?: unknown };
    if (code === REMOTE_NODE_ERROR.LOST) return REMOTE_COPY.pairErrors.lost;
    if (code === REMOTE_NODE_ERROR.REJECTED && typeof reason === 'string' && reason !== 'lost' && reason in REMOTE_COPY.pairErrors) {
      return REMOTE_COPY.pairErrors[reason as keyof typeof REMOTE_COPY.pairErrors];
    }
  }
  return REMOTE_COPY.pairFailed(error instanceof Error ? error.message : String(error));
}
