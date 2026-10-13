import type { Localized, PairedNode, ProviderCapability, ProviderUnavailableReason, ProviderView, TranscribeModelInfo } from '@cuccut/protocol';
import {
  BUNDLES,
  DEFAULT_TRANSCRIBE_BUNDLES,
  modelDetail,
  type DescribeMode,
  type ProviderQueue,
  type ProviderSource,
  type TranscribeProvider,
} from '@cuccut/models';
import type { PairedNodeRecord } from './node-store.ts';
import { NodesClient as NC } from '@cuccut/protocol/messages/nodes';

/**
 * Provider source for paired nodes (`node:<nodeId>`, architecture design §6.7): each paired node is a Provider, and its models are the model packs on that node.
 *
 * Availability is determined in two ways (see `DescribeMode`):
 * - Selection at submit time (`select`) makes no network calls: a node counts as available while it is paired. Whether it can be reached and whether its model pack is ready is decided by the pre-attempt check
 *   (failures are the task's `REMOTE_NODE_*`, as before);
 * - `models.capabilities` (`probe`) runs one health probe per node (`NodeInitiator.probe`, at most 2 seconds each, in parallel) and records the results;
 *   later recomputation caused by configuration changes (`view`) reuses the most recent probe results and makes no network calls.
 *
 * Without probe results, the model list uses the transcription model packs registered locally on this machine (nodes most likely have those installed too), and availability is not marked.
 */

/** The part of NodeInitiator that this source needs. */
export interface NodeSourceInitiator {
  readonly store: {
    list(): PairedNodeRecord[];
    get(nodeId: string): PairedNodeRecord | null;
    resolve(ref: string): PairedNodeRecord | null;
    credentialProblem(nodeId: string): string | null;
  };
  readonly provider: TranscribeProvider;
  probe(nodeId: string): Promise<PairedNode | null>;
}

const PREFIX = 'node:';

export class NodeProviderSource implements ProviderSource {
  readonly kind = 'node' as const;
  readonly #initiator: NodeSourceInitiator;
  /** Result of the most recent probe. */
  readonly #probed = new Map<string, PairedNode>();

  constructor(initiator: NodeSourceInitiator) {
    this.#initiator = initiator;
  }

  owns(providerId: string): boolean {
    return providerId.startsWith(PREFIX);
  }

  /** `node:<nodeId or alias>` → `node:<nodeId>`. */
  resolve(providerId: string): string | null {
    if (!this.owns(providerId)) return null;
    const record = this.#initiator.store.resolve(providerId.slice(PREFIX.length));
    return record ? `${PREFIX}${record.nodeId}` : null;
  }

  async list(mode: DescribeMode): Promise<ProviderView[]> {
    const records = this.#initiator.store.list();
    const views = await Promise.all(records.map((record) => this.#describe(record, mode)));
    // Nodes that are no longer paired keep no probe results.
    const ids = new Set(records.map((r) => r.nodeId));
    for (const nodeId of this.#probed.keys()) if (!ids.has(nodeId)) this.#probed.delete(nodeId);
    return views;
  }

  async describe(providerId: string, mode: DescribeMode): Promise<ProviderView | null> {
    const resolved = this.resolve(providerId);
    const record = resolved ? this.#initiator.store.get(resolved.slice(PREFIX.length)) : null;
    return record ? this.#describe(record, mode) : null;
  }

  transcriber(providerId: string): TranscribeProvider | null {
    return this.owns(providerId) ? this.#initiator.provider : null;
  }

  /** One queue per node: this machine submits at most one task at a time to a given node (the node queues on its own). */
  queue(providerId: string): ProviderQueue {
    return { key: providerId, concurrency: 1 };
  }

  executors(): TranscribeProvider[] {
    return [this.#initiator.provider];
  }

  async #describe(record: PairedNodeRecord, mode: DescribeMode): Promise<ProviderView> {
    let probed: PairedNode | null = null;
    if (mode === 'probe') {
      probed = await this.#initiator.probe(record.nodeId).catch(() => null);
      if (probed) this.#probed.set(record.nodeId, probed);
    } else if (mode === 'view') {
      probed = this.#probed.get(record.nodeId) ?? null;
    }
    return {
      providerId: `${PREFIX}${record.nodeId}`,
      kind: 'node',
      label: NC.nodeLabel({ alias: record.alias }).text,
      config: null,
      capabilities: { transcribe: transcribeCapability(probed, this.#initiator.store.credentialProblem(record.nodeId)) },
    };
  }
}

function transcribeCapability(probed: PairedNode | null, credentialProblem: string | null): ProviderCapability<TranscribeModelInfo> {
  const transcribe = probed?.health?.capabilities?.transcribe;
  const models: TranscribeModelInfo[] = transcribe
    ? transcribe.bundles.map((b) => {
        const reason = bundleReason(b.state);
        return model(
          b.bundleId,
          NC.bundleLabel({ bundleId: b.bundleId, backend: b.backend, device: b.device }).text,
          reason ? { available: false, unavailableReason: reason } : { available: true },
        );
      })
    : BUNDLES.filter((b) => b.capability === 'transcribe').map((b) => model(b.bundleId, NC.bundleLabel({ bundleId: b.bundleId, backend: b.backend, device: b.device }).text, {}));
  const usable = models.filter((m) => m.available !== false);
  const preferred = usable.find((m) => DEFAULT_TRANSCRIBE_BUNDLES.includes(m.modelId)) ?? usable[0] ?? models[0];
  if (preferred) preferred.default = true;

  let reason: ProviderUnavailableReason | null = null;
  let detail: Localized | undefined;
  if (credentialProblem) [reason, detail] = ['not-paired', NC.tokenUnreadable({ problem: credentialProblem })];
  else if (probed?.problem === 'unreachable') [reason, detail] = ['not-connected', NC.unreachable()];
  else if (probed?.problem === 'version') [reason, detail] = ['unsupported', NC.versionIncompatible()];
  else if (probed?.problem === 'unpaired') [reason, detail] = ['not-paired', NC.pairingRevoked()];
  else if (transcribe && !transcribe.enabled)
    [reason, detail] = ['unsupported', NC.transcribeSharingOff()];
  else if (transcribe && usable.length === 0) [reason, detail] = ['not-installed', NC.noTranscribeBundle()];
  return { models, available: reason === null, ...(reason ? { unavailableReason: reason } : {}), ...(detail ? modelDetail(detail) : {}) };
}

function bundleReason(state: string): ProviderUnavailableReason | null {
  if (state === 'not-installed') return 'not-installed';
  if (state === 'error') return 'unsupported';
  return null;
}

function model(modelId: string, label: string, availability: Partial<TranscribeModelInfo>): TranscribeModelInfo {
  return {
    modelId,
    label,
    maxInputBytes: null,
    maxDurationSec: null,
    wordTimestamps: 'none',
    languages: 'any',
    acceptsHint: true,
    cost: 'free-local',
    ...availability,
  };
}
