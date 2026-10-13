import { live, type ResourceCapacity, type ResourceCapacitySetting, type ResourceDemand, type ResourceDimension, type ResourcesSnapshot } from '@cuccut/protocol';
import { M } from './resource-capacity-copy.ts';
import { formatBytes } from './space.ts';

/**
 * “Resource scheduling” in Settings → Diagnostics (architecture design §7.6, §7.7; the design draft has no such section): reads `jobs.resources` to show where the machine's capacity comes from, how much background work can still use right now, who is using it, and who is waiting. The preference `resources.capacity` can override memory, GPU memory and CPU thread count; leaving any one of them empty keeps automatic detection. Disk cannot be overridden (it follows the free space on the volume where staging lives).
 */

const MiB = 1024 * 1024;

const SOURCE_LABEL: Record<ResourceCapacity['sources'][ResourceDimension], string> = live(() => M.sources);

const DIMENSION_LABEL: Record<ResourceDimension, string> = live(() => M.dimensions);

/** Memory and GPU memory are always shown in GB with one decimal place, matching the unit and placeholder of the override box; temp disk converts units as usual. */
function amount(dimension: ResourceDimension, value: number | null): string {
  if (value === null) return M.unknown;
  if (dimension === 'cpuThreads') return M.threads(value);
  if (dimension === 'scratchDisk') return formatBytes(value);
  return `${(value / 1024 / MiB).toFixed(1)} GB`;
}

export interface CapacityRow {
  dimension: ResourceDimension;
  label: string;
  /** “16 GB”, “10 线程”（10 threads）, “未知”（unknown）. */
  total: string;
  /** Source · allocated · still available to background work; with unified memory, the GPU row's note says it is also counted in memory. */
  desc: string;
  /** The source is a manual setting. */
  overridden: boolean;
}

/** One row per dimension: capacity, source, the amount already allocated out, and the amount background tasks can still use right now. */
export function capacityRows(snapshot: ResourcesSnapshot): CapacityRow[] {
  const { capacity, leased, available } = snapshot;
  return (['memory', 'gpuMemory', 'cpuThreads', 'scratchDisk'] as const).map((dimension) => {
    const total = capacity[dimension];
    const facts = [SOURCE_LABEL[capacity.sources[dimension]]];
    if (dimension === 'gpuMemory' && capacity.unifiedMemory) facts.push(M.unifiedMemory);
    if (total !== null) {
      if (leased[dimension]) facts.push(M.inUse(amount(dimension, leased[dimension])));
      facts.push(M.backgroundAvailable(amount(dimension, available.background[dimension])));
    }
    return {
      dimension,
      label: DIMENSION_LABEL[dimension],
      total: amount(dimension, total),
      desc: facts.join(' · '),
      overridden: capacity.sources[dimension] === 'setting',
    };
  });
}

/** The amount one job takes: “内存 2.0 GB、CPU 4 线程”（memory 2.0 GB, CPU 4 threads); “不占本机资源”（uses no local resources) when it takes nothing. */
export function demandLine(demand: ResourceDemand): string {
  const parts = (['memory', 'gpuMemory', 'cpuThreads', 'scratchDisk'] as const)
    .filter((d) => demand[d])
    .map((d) => M.demandPart(DIMENSION_LABEL[d], amount(d, demand[d] ?? 0)));
  return parts.length ? M.joinDemand(parts) : M.noDemand;
}

/** Form: memory and GPU memory are entered in GB (one decimal place allowed); the thread count is an integer; null means “auto”. */
export interface CapacityForm {
  memoryGB: number | null;
  gpuMemoryGB: number | null;
  cpuThreads: number | null;
}

export const CAPACITY_LIMITS = {
  /** The minimum for the setting is 512 MiB. */
  memoryGB: { min: 0.5, max: 16 * 1024 },
  gpuMemoryGB: { min: 0, max: 16 * 1024 },
  cpuThreads: { min: 1, max: 4096 },
} as const;

const toGB = (mib: number | null) => (mib === null ? null : Math.round((mib / 1024) * 10) / 10);
const toMiB = (gb: number | null) => (gb === null || Number.isNaN(gb) ? null : Math.round(gb * 1024));

export function capacityForm(setting: ResourceCapacitySetting | null): CapacityForm {
  return { memoryGB: toGB(setting?.memoryMiB ?? null), gpuMemoryGB: toGB(setting?.gpuMemoryMiB ?? null), cpuThreads: setting?.cpuThreads ?? null };
}

/** The value written back to the setting: when all three are automatic, the whole setting is null. */
export function capacitySetting(form: CapacityForm): ResourceCapacitySetting | null {
  const threads = form.cpuThreads === null || Number.isNaN(form.cpuThreads) ? null : Math.round(form.cpuThreads);
  const setting = { memoryMiB: toMiB(form.memoryGB), gpuMemoryMiB: toMiB(form.gpuMemoryGB), cpuThreads: threads };
  return setting.memoryMiB === null && setting.gpuMemoryMiB === null && setting.cpuThreads === null ? null : setting;
}

/** Whether two settings hold the same value (null and three empty items count as equal). */
export function sameCapacity(a: ResourceCapacitySetting | null, b: ResourceCapacitySetting | null): boolean {
  const x = capacitySetting(capacityForm(a));
  const y = capacitySetting(capacityForm(b));
  return x?.memoryMiB === y?.memoryMiB && x?.gpuMemoryMiB === y?.gpuMemoryMiB && x?.cpuThreads === y?.cpuThreads;
}

/** The value of this item under automatic detection (the placeholder in the override box): items set manually don't know the system value, so they show “auto”. */
export function autoPlaceholder(snapshot: ResourcesSnapshot | null, key: keyof CapacityForm): string {
  if (!snapshot) return M.auto;
  const { capacity } = snapshot;
  if (key === 'memoryGB') return capacity.sources.memory === 'system' ? M.autoWith((capacity.memory / 1024 / MiB).toFixed(1)) : M.auto;
  if (key === 'gpuMemoryGB')
    return capacity.sources.gpuMemory === 'unified-estimate' && capacity.gpuMemory !== null
      ? M.autoWith((capacity.gpuMemory / 1024 / MiB).toFixed(1))
      : M.auto;
  return capacity.sources.cpuThreads === 'system' ? M.autoWith(String(capacity.cpuThreads)) : M.auto;
}
