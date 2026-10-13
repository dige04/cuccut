import { describe, expect, it } from 'vitest';
import type { JobWait, ResourceCapacity } from '@cuccut/protocol';
import { MachineCapacity, unifiedGpuEstimate, type CapacitySource } from './machine-capacity.ts';
import type { ResourceReserves } from './resource-profiles.ts';
import { ResourceExceedsCapacity, ResourceScheduler, type ResourceLease, type ResourceRequest } from './resource-scheduler.ts';

/**
 * Resource scheduling (architecture design §7.6, §7.7): capacity and reserves are injected fake values, and admission is synchronous, so no waiting is needed.
 */

const GiB = 1024 * 1024 * 1024;
const MiB = 1024 * 1024;

class FakeCapacity implements CapacitySource {
  value: ResourceCapacity;

  constructor(patch: Partial<ResourceCapacity> = {}) {
    this.value = {
      memory: 16 * GiB,
      gpuMemory: null,
      cpuThreads: 8,
      scratchDisk: null,
      unifiedMemory: false,
      sources: { memory: 'system', gpuMemory: 'unknown', cpuThreads: 'system', scratchDisk: 'unknown' },
      ...patch,
    };
  }

  current(): ResourceCapacity {
    return this.value;
  }
}

/** System reserves 4 GiB, interactive reserves 2 GiB: background at most 10 GiB, interactive at most 12 GiB. */
const RESERVES = (capacity: ResourceCapacity): ResourceReserves => ({
  system: { memory: 4 * GiB, gpuMemory: capacity.gpuMemory === null ? null : 0, cpuThreads: 0, scratchDisk: 0 },
  interactive: { memory: 2 * GiB, gpuMemory: capacity.gpuMemory === null ? null : 1 * GiB, cpuThreads: 0, scratchDisk: 0 },
});

/** Records the requesters that were admitted, rejected, and waiting. */
class Probe {
  lease: ResourceLease | null = null;
  rejected: ResourceExceedsCapacity | null = null;
  waits: Array<JobWait | null> = [];

  get wait(): JobWait | null {
    return this.waits.at(-1) ?? null;
  }

  handlers() {
    return {
      admit: (lease: ResourceLease) => {
        this.lease = lease;
      },
      reject: (error: ResourceExceedsCapacity) => {
        this.rejected = error;
      },
      wait: (wait: JobWait | null) => {
        this.waits.push(wait);
      },
    };
  }
}

function setup(patch: Partial<ResourceCapacity> = {}) {
  const capacity = new FakeCapacity(patch);
  const scheduler = new ResourceScheduler({ capacity, reserves: RESERVES });
  const request = (req: Partial<ResourceRequest> & { owner: string }) => {
    const probe = new Probe();
    const ticket = scheduler.request({ label: 'test', ...req }, probe.handlers());
    return Object.assign(probe, { ticket });
  };
  return { capacity, scheduler, request };
}

describe('ResourceScheduler', () => {
  it('队列的并发上限是调度的约束：同一队列按先后，记下在等并发', () => {
    const { scheduler, request } = setup();
    const queue = { key: 'fake@cpu', concurrency: 1 };
    const a = request({ owner: 'a', queue });
    const b = request({ owner: 'b', queue });
    const c = request({ owner: 'c', queue });
    expect(a.lease).not.toBeNull();
    expect(b.lease).toBeNull();
    expect(b.wait).toMatchObject({ reason: 'concurrency', ahead: 0 });
    expect(c.wait).toMatchObject({ reason: 'concurrency', ahead: 1 });
    // Other queues are unaffected.
    expect(request({ owner: 'd', queue: { key: 'other', concurrency: 1 } }).lease).not.toBeNull();
    a.lease!.release();
    expect(b.lease).not.toBeNull();
    expect(b.wait).toBeNull();
    expect(c.wait).toMatchObject({ reason: 'concurrency', ahead: 0 });
    b.lease!.release();
    c.lease!.release();
    expect(scheduler.snapshot().waiting).toEqual([]);
  });

  it('放不下的等资源，记下缺的维度；归还之后按先后准入', () => {
    const { scheduler, request } = setup();
    const a = request({ owner: 'a', demand: { memory: 6 * GiB } });
    const b = request({ owner: 'b', demand: { memory: 6 * GiB } });
    expect(a.lease).not.toBeNull();
    expect(b.lease).toBeNull();
    expect(b.wait).toMatchObject({ reason: 'resources', dimensions: ['memory'], ahead: 0 });
    expect(b.wait!.detail).toContain('内存');
    const snapshot = scheduler.snapshot();
    expect(snapshot.leased.memory).toBe(6 * GiB);
    expect(snapshot.available.background.memory).toBe(4 * GiB);
    expect(snapshot.waiting).toMatchObject([{ owner: 'b', wait: { reason: 'resources' } }]);
    a.lease!.release();
    expect(b.lease).not.toBeNull();
    b.lease!.release();
    expect(scheduler.outstanding).toBe(0);
  });

  it('单个需求超过这台机器能给的量：提交时检查与准入时都直接拒绝，不等', () => {
    const { scheduler, request } = setup();
    const huge: ResourceRequest = { owner: 'x', label: 'test', demand: { memory: 11 * GiB } };
    const error = scheduler.check(huge);
    expect(error).toBeInstanceOf(ResourceExceedsCapacity);
    expect(error!.code).toBe('RESOURCE_ADMISSION_UNSATISFIABLE');
    expect(error!.dimensions).toEqual([{ dimension: 'memory', demand: 11 * GiB, limit: 10 * GiB }]);
    // Interactive can use the interactive reserve: 11 GiB fits.
    expect(scheduler.check({ ...huge, priority: 'interactive' })).toBeNull();
    const x = request({ owner: 'x', demand: { memory: 11 * GiB } });
    expect(x.rejected?.code).toBe('RESOURCE_ADMISSION_UNSATISFIABLE');
    expect(x.lease).toBeNull();
    expect(scheduler.snapshot().waiting).toEqual([]);
  });

  it('不插队：后来的不能拿前面在等的维度；不碰这些维度的可以先开始', () => {
    const { request } = setup();
    const a = request({ owner: 'a', demand: { memory: 6 * GiB } });
    const b = request({ owner: 'b', demand: { memory: 6 * GiB } });
    // 3 GiB would fit on its own, but b is waiting for memory, so it queues behind b.
    const c = request({ owner: 'c', demand: { memory: 3 * GiB } });
    expect(c.lease).toBeNull();
    expect(c.wait).toMatchObject({ reason: 'resources', dimensions: ['memory'], ahead: 1 });
    expect(c.wait!.detail).toContain('前面的任务在等');
    // CPU-only work with no demand (calls to online providers) starts as usual.
    expect(request({ owner: 'd', demand: { cpuThreads: 2 } }).lease).not.toBeNull();
    expect(request({ owner: 'e' }).lease).not.toBeNull();
    a.lease!.release();
    // b and c total 9 GiB; both fit.
    expect(b.lease).not.toBeNull();
    expect(c.lease).not.toBeNull();
  });

  it('共用的 holder：已经有了就不再计，进程持有的一份在任务之后仍然计入，进程退出后才归还', () => {
    const { scheduler, request } = setup();
    const holder = { id: 'model-worker:fake', demand: { memory: 3 * GiB } };
    const a = request({ owner: 'a', holder, demand: { memory: 1 * GiB } });
    expect(a.lease).not.toBeNull();
    const releaseProcess = scheduler.retain(holder.id)!;
    expect(scheduler.snapshot().leased.memory).toBe(4 * GiB);
    a.lease!.release();
    // The task has finished but the process is still alive: the holder is still counted.
    expect(scheduler.snapshot().holders).toMatchObject([{ holder: holder.id, users: 0, processes: 1 }]);
    expect(scheduler.snapshot().leased.memory).toBe(3 * GiB);
    // A large one is blocked; then another that uses the same holder and needs only 1 GiB: the holder is no longer counted, only its own amount is.
    const big = request({ owner: 'big', demand: { memory: 8 * GiB } });
    expect(big.wait).toMatchObject({ reason: 'resources' });
    const reuse = request({ owner: 'reuse', holder, demand: { cpuThreads: 1 } });
    expect(reuse.lease).not.toBeNull();
    reuse.lease!.release();
    releaseProcess();
    expect(scheduler.retain(holder.id)).toBeNull();
    expect(big.lease).not.toBeNull();
    big.lease!.release();
    expect(scheduler.outstanding).toBe(0);
  });

  it('空闲的 holder 挡住排队的工作时被请求让位（最久没用的先），进程退出后才准入', () => {
    const { scheduler, request } = setup();
    const evicted: string[] = [];
    const releases = new Map<string, () => void>();
    for (const id of ['model-worker:old', 'model-worker:new']) {
      const holder = { id, demand: { memory: 4 * GiB } };
      const job = request({ owner: id, holder });
      releases.set(
        id,
        scheduler.retain(id, () => evicted.push(id))!,
      );
      job.lease!.release();
    }
    expect(evicted).toEqual([]);
    const waiting = request({ owner: 'export', demand: { memory: 4 * GiB } });
    expect(waiting.lease).toBeNull();
    expect(evicted).toEqual(['model-worker:old']);
    // Only the request has been sent: the process has not exited yet, so the amount has not been returned.
    expect(waiting.lease).toBeNull();
    releases.get('model-worker:old')!();
    expect(waiting.lease).not.toBeNull();
    expect(evicted).toEqual(['model-worker:old']);
  });

  it('后台不能吃掉交互预留；交互排在后台前面', () => {
    const { request } = setup();
    const a = request({ owner: 'a', demand: { memory: 9 * GiB } });
    expect(a.lease).not.toBeNull();
    const background = request({ owner: 'bg', demand: { memory: 2 * GiB } });
    expect(background.lease).toBeNull();
    // An interactive operation of the same 2 GiB uses the interactive reserve and starts immediately.
    const interactive = request({ owner: 'ui', demand: { memory: 2 * GiB }, priority: 'interactive' });
    expect(interactive.lease).not.toBeNull();
    interactive.lease!.release();
    // Interactive waiters go ahead of background work that arrived earlier.
    const ui2 = request({ owner: 'ui2', demand: { memory: 3 * GiB + 512 * MiB }, priority: 'interactive' });
    expect(ui2.lease).toBeNull();
    a.lease!.release();
    expect(ui2.lease).not.toBeNull();
    expect(background.lease).not.toBeNull();
  });

  it('CPU 线程超过总数时按上限计（只会变慢），未知的维度不准入', () => {
    const { scheduler, request } = setup();
    expect(scheduler.check({ owner: 'x', label: 'test', demand: { cpuThreads: 64 } })).toBeNull();
    const a = request({ owner: 'a', demand: { cpuThreads: 64, gpuMemory: 100 * GiB, scratchDisk: 100 * GiB } });
    expect(a.lease).not.toBeNull();
    expect(scheduler.snapshot().leased.gpuMemory).toBeNull();
    const b = request({ owner: 'b', demand: { cpuThreads: 1 } });
    expect(b.wait).toMatchObject({ reason: 'resources', dimensions: ['cpuThreads'] });
  });

  it('统一内存：GPU 的需求同时计入内存', () => {
    const { scheduler, request } = setup({
      gpuMemory: 10 * GiB,
      unifiedMemory: true,
      sources: { memory: 'system', gpuMemory: 'unified-estimate', cpuThreads: 'system', scratchDisk: 'unknown' },
    });
    const a = request({ owner: 'a', demand: { memory: 1 * GiB, gpuMemory: 4 * GiB } });
    expect(a.lease).not.toBeNull();
    expect(scheduler.snapshot().leased).toMatchObject({ memory: 5 * GiB, gpuMemory: 4 * GiB });
    const b = request({ owner: 'b', demand: { gpuMemory: 6 * GiB } });
    expect(b.wait).toMatchObject({ reason: 'resources', dimensions: ['memory', 'gpuMemory'] });
  });

  it('磁盘按可用空间：已经租出的加回去判断永远放不下', () => {
    const { capacity, scheduler, request } = setup({
      scratchDisk: 10 * GiB,
      sources: { memory: 'system', gpuMemory: 'unknown', cpuThreads: 'system', scratchDisk: 'statfs' },
    });
    const a = request({ owner: 'a', demand: { scratchDisk: 8 * GiB } });
    expect(a.lease).not.toBeNull();
    // Part was written, so free space decreased: the 12 GiB demand fits after a returns (6 free + 8), so it waits rather than being rejected.
    capacity.value = { ...capacity.value, scratchDisk: 6 * GiB };
    const b = request({ owner: 'b', demand: { scratchDisk: 12 * GiB } });
    expect(b.rejected).toBeNull();
    expect(b.wait).toMatchObject({ reason: 'resources', dimensions: ['scratchDisk'] });
    expect(scheduler.check({ owner: 'c', label: 'test', demand: { scratchDisk: 15 * GiB } })).toBeInstanceOf(ResourceExceedsCapacity);
    a.lease!.release();
    capacity.value = { ...capacity.value, scratchDisk: 14 * GiB };
    scheduler.recheck();
    expect(b.lease).not.toBeNull();
  });

  it('acquire：中止时撤回，后面的照常准入', async () => {
    const { scheduler, request } = setup();
    const a = request({ owner: 'a', demand: { memory: 8 * GiB } });
    const controller = new AbortController();
    const waits: Array<JobWait | null> = [];
    const pending = scheduler.acquire(
      { owner: 'b', label: 'step', demand: { memory: 8 * GiB } },
      { signal: controller.signal, onWait: (w) => waits.push(w) },
    );
    expect(waits.at(-1)).toMatchObject({ reason: 'resources' });
    const c = request({ owner: 'c', demand: { memory: 1 * GiB } });
    expect(c.lease).toBeNull();
    controller.abort(new Error('cancelled'));
    await expect(pending).rejects.toThrow('cancelled');
    // After b withdraws, c no longer queues behind it.
    expect(c.lease).not.toBeNull();
    a.lease!.release();
    c.lease!.release();
    expect(scheduler.outstanding).toBe(0);
    const lease = await scheduler.acquire({ owner: 'd', label: 'step', demand: { memory: 1 * GiB } });
    lease.release();
    lease.release();
    expect(scheduler.outstanding).toBe(0);
  });

  it('撤回排队的请求不留痕迹', () => {
    const { scheduler, request } = setup();
    const a = request({ owner: 'a', queue: { key: 'q', concurrency: 1 } });
    const b = request({ owner: 'b', queue: { key: 'q', concurrency: 1 } });
    b.ticket.withdraw();
    a.lease!.release();
    expect(b.lease).toBeNull();
    expect(scheduler.outstanding).toBe(0);
    expect(scheduler.snapshot().waiting).toEqual([]);
  });
});

describe('MachineCapacity', () => {
  it('Apple 芯片按统一内存估计 GPU 内存；设置可以逐项覆盖', () => {
    let override: { memoryMiB: number | null; gpuMemoryMiB: number | null; cpuThreads: number | null } | null = null;
    const capacity = new MachineCapacity({
      system: { platform: 'darwin', arch: 'arm64', totalMemory: 24 * GiB, cpuThreads: 10 },
      override: () => override,
    });
    expect(capacity.current()).toMatchObject({
      memory: 24 * GiB,
      gpuMemory: 16 * GiB,
      cpuThreads: 10,
      scratchDisk: null,
      unifiedMemory: true,
      sources: { memory: 'system', gpuMemory: 'unified-estimate', cpuThreads: 'system', scratchDisk: 'unknown' },
    });
    expect(unifiedGpuEstimate(64 * GiB)).toBe(48 * GiB);
    override = { memoryMiB: 12 * 1024, gpuMemoryMiB: null, cpuThreads: 4 };
    expect(capacity.current()).toMatchObject({
      memory: 12 * GiB,
      gpuMemory: 8 * GiB,
      cpuThreads: 4,
      sources: { memory: 'setting', gpuMemory: 'unified-estimate', cpuThreads: 'setting' },
    });
  });

  it('其余机器的 GPU 内存未知（除非设置给出）；磁盘按 staging 所在卷的可用空间', async () => {
    let override: { memoryMiB: number | null; gpuMemoryMiB: number | null; cpuThreads: number | null } | null = null;
    const capacity = new MachineCapacity({
      scratchDir: process.cwd(),
      system: { platform: 'linux', arch: 'x64', totalMemory: 32 * GiB, cpuThreads: 16 },
      override: () => override,
    });
    expect(capacity.current()).toMatchObject({ gpuMemory: null, unifiedMemory: false, sources: { gpuMemory: 'unknown' } });
    await capacity.refresh();
    const current = capacity.current();
    expect(current.sources.scratchDisk).toBe('statfs');
    expect(current.scratchDisk).toBeGreaterThan(0);
    override = { memoryMiB: null, gpuMemoryMiB: 8 * 1024, cpuThreads: null };
    expect(capacity.current()).toMatchObject({ memory: 32 * GiB, gpuMemory: 8 * GiB, sources: { gpuMemory: 'setting' } });
  });
});
