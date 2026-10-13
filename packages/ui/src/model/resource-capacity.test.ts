import { describe, expect, it } from 'vitest';
import type { ResourcesSnapshot } from '@cuccut/protocol';
import { autoPlaceholder, capacityForm, capacityRows, capacitySetting, demandLine, sameCapacity } from './resource-capacity.ts';

const GiB = 1024 ** 3;
const zero = { memory: 0, gpuMemory: 0, cpuThreads: 0, scratchDisk: 0 };

const snapshot = (patch: Partial<ResourcesSnapshot> = {}): ResourcesSnapshot => ({
  capacity: {
    memory: 16 * GiB,
    gpuMemory: (16 * GiB * 2) / 3,
    cpuThreads: 10,
    scratchDisk: 200 * GiB,
    unifiedMemory: true,
    sources: { memory: 'system', gpuMemory: 'unified-estimate', cpuThreads: 'system', scratchDisk: 'statfs' },
  },
  reserves: { system: zero, interactive: zero },
  leased: { memory: 2 * GiB, gpuMemory: 0, cpuThreads: 4, scratchDisk: 0 },
  available: { interactive: zero, background: { memory: 9.6 * GiB, gpuMemory: 6 * GiB, cpuThreads: 4, scratchDisk: 180 * GiB } },
  leases: [],
  holders: [],
  waiting: [],
  ...patch,
});

describe('resource scheduling', () => {
  it('one row per dimension: capacity, source, in use, still available in the background; unified memory note says the GPU counts toward memory', () => {
    const rows = capacityRows(snapshot());
    expect(rows.map((r) => [r.label, r.total])).toEqual([
      ['内存', '16.0 GB'],
      ['GPU 内存', '10.7 GB'],
      ['CPU 线程', '10 线程'],
      ['临时磁盘空间', '200 GB'],
    ]);
    expect(rows[0]!.desc).toBe('系统探测 · 正在用 2.0 GB · 后台任务还能用 9.6 GB');
    expect(rows[1]!.desc).toBe('按统一内存估计 · 与内存共用，GPU 的用量同时计入内存 · 后台任务还能用 6.0 GB');
    expect(rows[2]!.desc).toBe('系统探测 · 正在用 4 线程 · 后台任务还能用 4 线程');
  });

  it('unknown dimensions show no usage; manually set values are marked', () => {
    const s = snapshot();
    const rows = capacityRows({
      ...s,
      capacity: {
        ...s.capacity,
        gpuMemory: null,
        scratchDisk: null,
        unifiedMemory: false,
        sources: { ...s.capacity.sources, gpuMemory: 'unknown', scratchDisk: 'unknown', memory: 'setting' },
      },
    });
    expect(rows[1]).toMatchObject({ total: '未知', desc: '未知', overridden: false });
    expect(rows[3]).toMatchObject({ total: '未知', desc: '未知' });
    expect(rows[0]!.overridden).toBe(true);
    expect(rows[0]!.desc).toMatch(/^手动设定 · /);
  });

  it('the amount of one job', () => {
    expect(demandLine({ memory: 2 * GiB, cpuThreads: 4 })).toBe('内存 2.0 GB、CPU 线程 4 线程');
    expect(demandLine({})).toBe('不占本机资源');
  });

  it('the form takes GB and stores MiB; the whole setting is null when all three fields are empty', () => {
    expect(capacityForm(null)).toEqual({ memoryGB: null, gpuMemoryGB: null, cpuThreads: null });
    expect(capacityForm({ memoryMiB: 12288, gpuMemoryMiB: null, cpuThreads: 6 })).toEqual({ memoryGB: 12, gpuMemoryGB: null, cpuThreads: 6 });
    expect(capacitySetting({ memoryGB: 12.5, gpuMemoryGB: null, cpuThreads: 6 })).toEqual({ memoryMiB: 12800, gpuMemoryMiB: null, cpuThreads: 6 });
    expect(capacitySetting({ memoryGB: null, gpuMemoryGB: NaN, cpuThreads: null })).toBeNull();
    expect(sameCapacity(null, { memoryMiB: null, gpuMemoryMiB: null, cpuThreads: null })).toBe(true);
    expect(sameCapacity(null, { memoryMiB: 512, gpuMemoryMiB: null, cpuThreads: null })).toBe(false);
  });

  it('the placeholder for an empty field shows the automatically detected value', () => {
    expect(autoPlaceholder(snapshot(), 'memoryGB')).toBe('自动（16.0）');
    expect(autoPlaceholder(snapshot(), 'gpuMemoryGB')).toBe('自动（10.7）');
    expect(autoPlaceholder(snapshot(), 'cpuThreads')).toBe('自动（10）');
    expect(autoPlaceholder(null, 'cpuThreads')).toBe('自动');
  });
});
