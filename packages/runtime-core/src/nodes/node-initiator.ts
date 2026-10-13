import type { Logger } from '@cuccut/harness';
import { NodeInitiator, defaultDiscoverer, noDiscoverer, type Discoverer, type RemoteTiming } from '@cuccut/nodes';
import type { CredentialStore, RuntimeHome } from '@cuccut/runtime-storage';

/** Initiator options for `startRuntime`: production defaults; tests swap in a fake discovery and short deadlines. */
export interface NodeInitiatorRuntimeOptions {
  /** Discovery; when not given, it depends on the platform (macOS uses `dns-sd`); null means no browsing. */
  discoverer?: Discoverer | null;
  /** Deadline and backoff for remote jobs (short in tests). */
  timing?: Partial<RemoteTiming>;
  /** Name given to the node when pairing; defaults to the hostname. */
  clientName?: string;
  probeTimeoutMs?: number;
}

/** Assembles the initiator: paired nodes are stored in `<home>/store/nodes.json`, tokens in the credential store, and the remote node provider is handed to the JobManager. */
export function openNodeInitiator(
  home: RuntimeHome,
  credentials: CredentialStore,
  log: Logger,
  options: NodeInitiatorRuntimeOptions = {},
): Promise<NodeInitiator> {
  const scoped = log.child('nodes');
  const discoverer = options.discoverer === undefined ? defaultDiscoverer(process.platform, scoped) : (options.discoverer ?? noDiscoverer);
  return NodeInitiator.open({
    file: home.nodesFile,
    credentials,
    log: scoped,
    discoverer,
    ...(options.timing ? { timing: options.timing } : {}),
    ...(options.clientName ? { clientName: options.clientName } : {}),
    ...(options.probeTimeoutMs ? { probeTimeoutMs: options.probeTimeoutMs } : {}),
  });
}
