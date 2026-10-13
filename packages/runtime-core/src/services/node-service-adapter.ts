import { RpcError, type ShareStatus } from '@cuccut/protocol';
import { RcServices } from '@cuccut/protocol/messages/runtime-core';
import type { NodeService } from '@cuccut/nodes';
import type { ManagedService, ServiceReport } from './service-manager.ts';

/**
 * What the node service looks like in ServiceManager (architecture design §4.8, §6.7). The authority is `NodeService` (`nodes.share.*` and `node-share.json`); here its state is only projected into a unified shape, with no separate copy:
 *
 * - Sharing off: `off`; on and listening: `on`; on but not listening (port taken): `error`, with the reason from the node service;
 * - "Start with Runtime" is the sharing switch itself (sharing that is on resumes listening when the Runtime starts);
 * - Config (port, name, pairing, capabilities) is only through `nodes.share.*`; the pairing code and paired clients appear only in `nodes.share.status`, and are not paraphrased here.
 */
export class NodeServiceAdapter implements ManagedService {
  readonly id = 'node' as const;
  get label(): string {
    return RcServices.nodeServiceLabel().text;
  }
  readonly available = true;
  readonly projected = true;
  readonly #nodes: NodeService;

  constructor(nodes: NodeService) {
    this.#nodes = nodes;
  }

  async start(): Promise<void> {
    await this.#nodes.start({});
  }

  async stop(): Promise<void> {
    await this.#nodes.stop();
  }

  status(): ServiceReport {
    return projectShare(this.#nodes.status());
  }

  async applyConfig(): Promise<boolean> {
    throw new RpcError('invalid-request', RcServices.nodeServiceConfigure());
  }
}

export function projectShare(share: ShareStatus): ServiceReport {
  const state = !share.enabled ? 'off' : share.listening ? 'on' : 'error';
  const address = share.addresses[0];
  return {
    state,
    error: state === 'error' ? (share.error ?? RcServices.nodeServiceNotListening().text) : null,
    autostart: share.enabled,
    port: share.port,
    endpoint: share.listening && address ? `http://${address}:${share.port}` : null,
    policy: null,
    clients: [],
    recentRequests: [],
  };
}
