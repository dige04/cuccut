import { promises as fs } from 'node:fs';
import os from 'node:os';
import type { ResourceCapacity, ResourceCapacitySetting } from '@cuccut/protocol';

/**
 * Machine capacity (architecture design §7.6, §7.7, §9.6): uses only the Node standard library.
 *
 * - Memory: `os.totalmem()`; CPU threads: `os.availableParallelism()`.
 * - GPU memory: Apple chips have unified memory, so the amount the GPU can use is estimated as 2/3 of memory (3/4 for 32 GiB and above), and GPU demand is counted in memory at the same time.
 *   Other machines have no dependency-free way to query it, so they report it as unknown and do not admit based on it (§9.6 “report unknown when unknown”).
 * - Disk: the available space on the volume containing staging (`fs.statfs`), refreshed in the background; admission only reads the cached value.
 * - The preference `resources.capacity` can override memory, GPU memory and thread count (when an item is null, it stays automatic).
 */

/** The source of capacity for scheduling: `current()` synchronously gives the most recent value; `refresh()` re-probes the parts that change (disk). */
export interface CapacitySource {
  current(): ResourceCapacity;
  refresh?(): Promise<void>;
}

export interface SystemFacts {
  platform: NodeJS.Platform;
  arch: string;
  totalMemory: number;
  cpuThreads: number;
}

export interface MachineCapacityOptions {
  /** The staging directory: disk is measured on the volume it lives on. When not given, disk is unknown. */
  scratchDir?: string;
  /** The override from preferences (re-read on every read, so changes take effect immediately). */
  override?: () => ResourceCapacitySetting | null;
  /** Injection for tests: replaces the facts given by the OS. */
  system?: Partial<SystemFacts>;
}

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

export function systemFacts(): SystemFacts {
  return { platform: process.platform, arch: process.arch, totalMemory: os.totalmem(), cpuThreads: os.availableParallelism() };
}

/** The amount the GPU can use on a unified-memory machine (estimate): 2/3 for 32 GiB and below, 3/4 above that. */
export function unifiedGpuEstimate(totalMemory: number): number {
  return Math.floor(totalMemory <= 32 * GiB ? (totalMemory * 2) / 3 : (totalMemory * 3) / 4);
}

export class MachineCapacity implements CapacitySource {
  readonly #options: MachineCapacityOptions;
  readonly #system: SystemFacts;
  #scratchFree: number | null = null;

  constructor(options: MachineCapacityOptions = {}) {
    this.#options = options;
    this.#system = { ...systemFacts(), ...options.system };
  }

  current(): ResourceCapacity {
    const system = this.#system;
    const override = safeOverride(this.#options.override);
    const unified = system.platform === 'darwin' && system.arch === 'arm64';
    const memory = override?.memoryMiB != null ? override.memoryMiB * MiB : system.totalMemory;
    const gpuMemory = override?.gpuMemoryMiB != null ? override.gpuMemoryMiB * MiB : unified ? unifiedGpuEstimate(memory) : null;
    const cpuThreads = override?.cpuThreads != null ? override.cpuThreads : system.cpuThreads;
    return {
      memory,
      gpuMemory,
      cpuThreads,
      scratchDisk: this.#scratchFree,
      unifiedMemory: unified,
      sources: {
        memory: override?.memoryMiB != null ? 'setting' : 'system',
        gpuMemory: override?.gpuMemoryMiB != null ? 'setting' : unified ? 'unified-estimate' : 'unknown',
        cpuThreads: override?.cpuThreads != null ? 'setting' : 'system',
        scratchDisk: this.#scratchFree === null ? 'unknown' : 'statfs',
      },
    };
  }

  async refresh(): Promise<void> {
    const dir = this.#options.scratchDir;
    if (!dir) return;
    try {
      await fs.mkdir(dir, { recursive: true });
      const stats = await fs.statfs(dir);
      this.#scratchFree = stats.bavail * stats.bsize;
    } catch {
      this.#scratchFree = null;
    }
  }
}

/** When reading settings fails (not yet opened, file corrupted), treat it as having no override. */
function safeOverride(read: (() => ResourceCapacitySetting | null) | undefined): ResourceCapacitySetting | null {
  try {
    return read?.() ?? null;
  } catch {
    return null;
  }
}
