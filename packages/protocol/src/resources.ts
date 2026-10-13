import type { Id } from './domain.ts';
import type { MessageRef } from './message-ref.ts';

/**
 * Resource scheduling (architecture design §7.6, §7.7): heavy local jobs first pass admission by peak working set and only start once they hold a lease; if they don't fit, they queue, and the record says what they are waiting for.
 * Byte counts are always bytes.
 */

/** Admission dimensions: memory, GPU memory (on unified-memory machines it is also counted in memory), CPU threads, and the disk of the volume where staging lives. */
export type ResourceDimension = 'memory' | 'gpuMemory' | 'cpuThreads' | 'scratchDisk';

export const RESOURCE_DIMENSIONS: readonly ResourceDimension[] = ['memory', 'gpuMemory', 'cpuThreads', 'scratchDisk'];

/** Amounts per dimension. In a capacity, null means unknown (no admission on that dimension; §9.6 “report unknown when unknown”). */
export interface ResourceAmounts {
  memory: number;
  gpuMemory: number | null;
  cpuThreads: number;
  scratchDisk: number | null;
}

/** Peak demand declared by one unit of work; dimensions not listed are 0. */
export type ResourceDemand = Partial<Record<ResourceDimension, number>>;

/** Admission priority: `interactive` is a short operation the user is synchronously waiting for in the UI, and may use the interactive reserve; everything else is `background`. */
export type ResourcePriority = 'interactive' | 'background';

/**
 * Why a queued job is waiting (`JobRecord.wait`): `concurrency` is the concurrency cap of the same queue (same model bundle, same provider…),
 * `resources` means the machine lacks resources (`dimensions` lists the missing ones; a job also counts here when earlier jobs are waiting for the same resources, and does not jump the queue). Cleared when execution starts.
 */
export interface JobWait {
  reason: 'concurrency' | 'resources';
  /** For `resources`: the missing dimensions. */
  dimensions?: ResourceDimension[];
  /** How many jobs are waiting ahead in the same queue or for the same resources. */
  ahead?: number;
  /** A one-sentence description for people. */
  detail: string;
  /** Message reference for `detail`: re-rendered in the reader's language when displayed. */
  detailRef?: MessageRef;
  /** When waiting started. */
  since: string;
}

/** Machine capacity and its source: `system` from the OS, `setting` from the preference `resources.capacity`, `unified-estimate` estimated from unified memory. */
export interface ResourceCapacity extends ResourceAmounts {
  /** GPU and CPU share memory (Apple chips): GPU demand is also counted in memory. */
  unifiedMemory: boolean;
  sources: {
    memory: 'system' | 'setting';
    gpuMemory: 'unified-estimate' | 'setting' | 'unknown';
    cpuThreads: 'system' | 'setting';
    scratchDisk: 'statfs' | 'unknown';
  };
}

/** A lease: the amount held by a job (or one of its steps). */
export interface ResourceLeaseView {
  leaseId: string;
  /** The job's `jobId`. */
  owner: Id;
  /** Human-readable kind: `transcribe`, `export:video`… */
  label: string;
  priority: ResourcePriority;
  /** The amount this lease counts itself (amounts of a shared holder are recorded on the holder and not double-counted). */
  demand: ResourceDemand;
  /** Shared holder used (e.g. `model-worker:<bundleId>`). */
  holder: string | null;
  /** The concurrency queue it belongs to. */
  queue: string | null;
  since: string;
}

/** A long-lived resource shared by several jobs in turn (e.g. a Model Worker process for a model bundle): counted once. */
export interface ResourceHolderView {
  holder: string;
  demand: ResourceDemand;
  /** Number of leases currently using it; 0 means idle (the process is still there and can be evicted to make way for other jobs). */
  users: number;
  /** Number of processes not yet confirmed to have exited: the holder's amounts are not released until the process actually exits (or the model is unloaded). */
  processes: number;
  since: string;
}

export interface ResourceWaiterView {
  owner: Id;
  label: string;
  priority: ResourcePriority;
  demand: ResourceDemand;
  holder: string | null;
  queue: string | null;
  wait: JobWait | null;
}

/** `jobs.resources`: capacity, reservations, amounts leased out, what each priority can use right now, and leases and the queue. */
export interface ResourcesSnapshot {
  capacity: ResourceCapacity;
  reserves: {
    /** Reserved for the system and other apps; no job may use it. */
    system: ResourceAmounts;
    /** Reserved for interactive operations: background jobs cannot use it. */
    interactive: ResourceAmounts;
  };
  leased: ResourceAmounts;
  available: { interactive: ResourceAmounts; background: ResourceAmounts };
  leases: ResourceLeaseView[];
  holders: ResourceHolderView[];
  waiting: ResourceWaiterView[];
}

/**
 * Preference `resources.capacity`: overrides the auto-detected capacity (MiB and thread count). When a field is null it is still auto-detected;
 * when the whole setting is null, everything is automatic. Disk cannot be overridden (it uses the free space of the volume where staging lives).
 */
export interface ResourceCapacitySetting {
  memoryMiB: number | null;
  gpuMemoryMiB: number | null;
  cpuThreads: number | null;
}
