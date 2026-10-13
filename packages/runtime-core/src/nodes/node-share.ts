import type { Logger } from '@cuccut/harness';
import { NodeService, type Advertiser, type Clock, type NodeLimits, type PairingLimits } from '@cuccut/nodes';
import type { RuntimeHome } from '@cuccut/runtime-storage';
import type { ModelJobs } from '../models/model-jobs.ts';

/** Options for the node service in `startRuntime`: production defaults; tests swap in loopback, a fake mDNS, and short deadlines. */
export interface NodeShareOptions {
  /** Address to listen on (default `0.0.0.0`). */
  host?: string;
  /** mDNS registration; when not given, it depends on the platform (macOS uses `dns-sd`); null means no registration. */
  advertiser?: Advertiser | null;
  clock?: Clock;
  limits?: Partial<NodeLimits>;
  pairing?: Partial<PairingLimits>;
  freeBytes?: (dir: string) => Promise<number>;
  heartbeatMs?: number;
}

/** Assembles the node service: remote jobs go into the Runtime's single JobManager, and model pack state comes from the same model directory. */
export function openNodeShare(home: RuntimeHome, models: ModelJobs, log: Logger, options: NodeShareOptions = {}): Promise<NodeService> {
  return NodeService.open({
    shareFile: home.nodeShareFile,
    jobsDir: home.nodeJobsDir,
    runner: models.jobs,
    models: models.catalog,
    log: log.child('nodes'),
    ...options,
  });
}
