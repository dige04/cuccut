import { randomUUID } from 'node:crypto';
import {
  RESOURCE_DIMENSIONS,
  type JobWait,
  type ResourceAmounts,
  type ResourceCapacity,
  type ResourceDemand,
  type ResourceDimension,
  type ResourceLeaseView,
  type ResourcePriority,
  type ResourcesSnapshot,
  live,
  type Localized,
} from '@cuccut/protocol';
import { JobsResourceScheduler as J } from '@cuccut/protocol/messages/jobs/resource-scheduler.ts';
import { LocalizedError, textParts } from './job-text.ts';
import { silentLog, type JobsLogger } from './jobs-logger.ts';
import { MachineCapacity, type CapacitySource } from './machine-capacity.ts';
import { defaultReserves, type ResourceReserves } from './resource-profiles.ts';

/**
 * Resource scheduling (architecture design §7.6, §7.7): heavy local work is first admitted by its peak demand, starts only once it holds a lease, and returns the lease when it ends.
 *
 * - **Concurrency queues**: each job may belong to a queue (the same model package, the same online provider, …). Within a queue, order is first-come first-served and it does not exceed the queue's concurrency limit. This is the original JobManager per-queue concurrency, now one constraint of scheduling rather than a separate system. Online provider calls have only this one constraint.
 * - **Peak admission**: demand is measured per dimension (memory, GPU memory, CPU threads, staging disk). A job starts only if it fits; if it does not fit, it queues and records what it is waiting for. If a single demand is larger than this machine can ever provide, it is rejected directly (`RESOURCE_ADMISSION_UNSATISFIABLE`) rather than waiting forever.
 * - **No queue-jumping**: a job waiting on some dimensions blocks later jobs that also need those dimensions. Later jobs may start first only if they do not touch those dimensions.
 * - **Interactive first**: `interactive` goes ahead of `background`, and may use the interactive reserve; background work cannot consume the interactive reserve. It does not preempt running work (§7.6 “do not assume forced preemption is possible”).
 * - **Shared resident process (holder)**: one model package's Model Worker is used by several tasks in turn, and its amount is counted once. The task lease and the process each hold a share: when the task ends but the process is still there, it is still counted; the amount is returned only when the process actually exits (or the model is unloaded) (§7.7 “sending a release request does not mean the resources have been returned”).
 * - An idle holder is evicted in least-recently-used order when queued work needs the resources it holds.
 */

export interface ResourceRequest {
  /** The task's `jobId`. */
  owner: string;
  /** Kind, for display to people. */
  label: string;
  priority?: ResourcePriority;
  queue?: { key: string; concurrency: number } | null;
  /** This job's own peak demand. */
  demand?: ResourceDemand;
  /** The shared holder used: admitted together with its amount if it does not exist yet; not counted again if it already exists. */
  holder?: { id: string; demand: ResourceDemand } | null;
}

export interface ResourceLease {
  readonly leaseId: string;
  /** Return (idempotent). Only called after the resources have actually been released. */
  release(): void;
}

export interface ResourceTicket {
  /** Withdraws a request that is still waiting (does nothing if it has already been admitted or rejected). */
  withdraw(): void;
}

export interface ResourceHandlers {
  /** Admission: a synchronous call that returns a lease. */
  admit(lease: ResourceLease): void;
  /** The demand exceeds what this machine can provide; it can never fit. */
  reject(error: ResourceExceedsCapacity): void;
  /** What is being waited on has changed (null: no longer waiting, admit immediately). */
  wait?(wait: JobWait | null): void;
}

/** Dimensions over capacity: the demand and the most this priority can use. */
export interface ExceededDimension {
  dimension: ResourceDimension;
  demand: number;
  limit: number;
}

export class ResourceExceedsCapacity extends LocalizedError {
  readonly code = 'RESOURCE_ADMISSION_UNSATISFIABLE';
  readonly dimensions: ExceededDimension[];

  constructor(dimensions: ExceededDimension[]) {
    super(J.exceedsCapacity({ dimensions: dimensions.map((d) => d.dimension).join(',') }));
    this.name = 'ResourceExceedsCapacity';
    this.dimensions = dimensions;
  }
}

export interface ResourceSchedulerOptions {
  /** Capacity source; when not given, uses this machine (excluding disk). */
  capacity?: CapacitySource;
  /** Reserves; when not given, uses `defaultReserves`. */
  reserves?: (capacity: ResourceCapacity) => ResourceReserves;
  /** How often capacity that changes, such as disk, is refreshed (default 2 seconds; refreshed only on admission or return). */
  refreshMs?: number;
  log?: JobsLogger;
}

export const DIMENSION_LABELS: Readonly<Record<ResourceDimension, string>> = live(() => ({
  memory: J.dimensionMemory().text,
  gpuMemory: J.dimensionGpuMemory().text,
  cpuThreads: J.dimensionCpuThreads().text,
  scratchDisk: J.dimensionScratchDisk().text,
}));

interface Waiter {
  seq: number;
  request: ResourceRequest;
  handlers: ResourceHandlers;
  wait: JobWait | null;
}

interface Lease {
  leaseId: string;
  request: ResourceRequest;
  priority: ResourcePriority;
  since: string;
  released: boolean;
}

interface Holder {
  id: string;
  demand: ResourceDemand;
  users: number;
  processes: number;
  since: string;
  lastUsed: number;
  evict: (() => void) | null;
  evicting: boolean;
}

type Amounts = Record<ResourceDimension, number>;

const ZERO: Amounts = { memory: 0, gpuMemory: 0, cpuThreads: 0, scratchDisk: 0 };

export class ResourceScheduler {
  readonly #capacity: CapacitySource;
  readonly #reserves: (capacity: ResourceCapacity) => ResourceReserves;
  readonly #refreshMs: number;
  readonly #log: JobsLogger;
  readonly #waiters: Waiter[] = [];
  readonly #leases = new Map<string, Lease>();
  readonly #holders = new Map<string, Holder>();
  /** Running lease count and concurrency limit of each queue (from the most recent request). */
  readonly #queues = new Map<string, { concurrency: number; running: number }>();
  #seq = 0;
  #pumping = false;
  #again = false;
  #refreshing = false;
  #refreshedAt = -Infinity;
  #refreshTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Peak disk amount leased since the last disk probe. The probed free space may already have had the files written under these leases subtracted. After they are returned and before the next probe, when deciding “never fits”, this amount is still added back, to avoid wrongly rejecting based on stale free space.
   */
  #diskPeak = 0;

  constructor(options: ResourceSchedulerOptions = {}) {
    this.#capacity = options.capacity ?? new MachineCapacity();
    this.#reserves = options.reserves ?? defaultReserves;
    this.#refreshMs = options.refreshMs ?? 2_000;
    this.#log = options.log ?? silentLog;
  }

  /** Queued request: admitted synchronously when it fits (`admit` is called before returning). */
  request(request: ResourceRequest, handlers: ResourceHandlers): ResourceTicket {
    const waiter: Waiter = { seq: ++this.#seq, request, handlers, wait: null };
    this.#waiters.push(waiter);
    this.#pump();
    return {
      withdraw: () => {
        const index = this.#waiters.indexOf(waiter);
        if (index < 0) return;
        this.#waiters.splice(index, 1);
        this.#pump();
      },
    };
  }

  /** Promise form of `request`: on abort, withdraws and rejects with the abort reason; when over capacity, rejects with `ResourceExceedsCapacity`. */
  acquire(
    request: ResourceRequest,
    options: { signal?: AbortSignal; onWait?: (wait: JobWait | null) => void } = {},
  ): Promise<ResourceLease> {
    const { signal, onWait } = options;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        ticket.withdraw();
        reject(signal!.reason);
      };
      const ticket = this.request(request, {
        admit: (lease) => {
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          resolve(lease);
        },
        reject: (error) => {
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        },
        ...(onWait ? { wait: onWait } : {}),
      });
      if (!settled) signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** Check at submission: whether this demand can never fit on this machine (not counting what is currently leased). */
  check(request: ResourceRequest): ResourceExceedsCapacity | null {
    const capacity = this.#capacity.current();
    const exceeded = this.#exceeded(this.#additional(request, capacity), request.priority ?? 'background', capacity);
    return exceeded.length > 0 ? new ResourceExceedsCapacity(exceeded) : null;
  }

  /**
   * A resident process holds one share of a holder (for example, when starting a Model Worker). After the process actually exits, call the returned function to release it. Returns null when there is no holder (no use going through scheduling). `evict` is the method requested when idle to yield (for example, unloading a model package): it only sends a request, and the actual release still waits for the process to exit.
   */
  retain(holderId: string, evict?: () => void): (() => void) | null {
    const holder = this.#holders.get(holderId);
    if (!holder) return null;
    holder.processes++;
    if (evict) holder.evict = evict;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holder.processes--;
      this.#dropIfUnused(holder);
      this.#pump();
    };
  }

  /** Capacity or reserves may have changed (settings were changed): re-examine the queued work. */
  recheck(): void {
    this.#refreshedAt = -Infinity;
    this.#pump();
  }

  /** The current lease count plus the holder count (for tests: 0 once everything is returned). */
  get outstanding(): number {
    return this.#leases.size + this.#holders.size;
  }

  snapshot(): ResourcesSnapshot {
    const capacity = this.#capacity.current();
    const reserves = this.#reserves(capacity);
    const leased = this.#leased(capacity);
    const view = (amounts: Amounts): ResourceAmounts => ({
      memory: amounts.memory,
      gpuMemory: capacity.gpuMemory === null ? null : amounts.gpuMemory,
      cpuThreads: amounts.cpuThreads,
      scratchDisk: capacity.scratchDisk === null ? null : amounts.scratchDisk,
    });
    const available = (priority: ResourcePriority): ResourceAmounts => {
      const line = this.#line(priority, capacity, reserves);
      const left = {} as Amounts;
      for (const d of RESOURCE_DIMENSIONS) left[d] = Math.max(0, line[d] - leased[d]);
      return view(left);
    };
    const leases: ResourceLeaseView[] = [...this.#leases.values()].map((lease) => ({
      leaseId: lease.leaseId,
      owner: lease.request.owner,
      label: lease.request.label,
      priority: lease.priority,
      demand: { ...lease.request.demand },
      holder: lease.request.holder?.id ?? null,
      queue: lease.request.queue?.key ?? null,
      since: lease.since,
    }));
    return {
      capacity,
      reserves: { system: reserves.system, interactive: reserves.interactive },
      leased: view(leased),
      available: { interactive: available('interactive'), background: available('background') },
      leases,
      holders: [...this.#holders.values()].map((h) => ({
        holder: h.id,
        demand: { ...h.demand },
        users: h.users,
        processes: h.processes,
        since: h.since,
      })),
      waiting: this.#ordered().map((w) => ({
        owner: w.request.owner,
        label: w.request.label,
        priority: w.request.priority ?? 'background',
        demand: { ...w.request.demand },
        holder: w.request.holder?.id ?? null,
        queue: w.request.queue?.key ?? null,
        wait: w.wait,
      })),
    };
  }

  // ---- Admission ----

  #pump(): void {
    if (this.#pumping) {
      this.#again = true;
      return;
    }
    this.#pumping = true;
    try {
      do {
        this.#again = false;
        this.#pass();
      } while (this.#again);
    } finally {
      this.#pumping = false;
    }
    this.#maybeRefresh();
  }

  /** Looks at the queued work once, in order: interactive first, then background, each by arrival order. */
  #pass(): void {
    const capacity = this.#capacity.current();
    const reserves = this.#reserves(capacity);
    const leased = this.#leased(capacity);
    /** Dimensions that earlier waiting work is blocked on: later work cannot take these (no queue-jumping). */
    const blocked = new Set<ResourceDimension>();
    /** The number of items waiting ahead in each queue. */
    const queued = new Map<string, number>();
    /** When the queue is not full but earlier work in the same queue is waiting for resources, the dimensions it is waiting on (later work counts as waiting for resources too). */
    const queueBlockedOn = new Map<string, ResourceDimension[]>();
    let resourceAhead = 0;
    for (const waiter of this.#ordered()) {
      if (!this.#waiters.includes(waiter)) continue;
      const { request } = waiter;
      const priority = request.priority ?? 'background';
      const key = request.queue?.key ?? null;
      if (key !== null) {
        const queue = this.#queue(key, request.queue!.concurrency);
        const ahead = queued.get(key) ?? 0;
        if (ahead > 0 || queue.running >= queue.concurrency) {
          queued.set(key, ahead + 1);
          const dimensions = queue.running >= queue.concurrency ? undefined : queueBlockedOn.get(key);
          if (dimensions) {
            this.#setWait(waiter, { reason: 'resources', dimensions, ahead: resourceAhead, ...waitDetail(resourceDetail(dimensions, true)) });
            resourceAhead++;
          } else {
            this.#setWait(waiter, { reason: 'concurrency', ahead, ...waitDetail(concurrencyDetail(ahead)) });
          }
          continue;
        }
      }
      const additional = this.#additional(request, capacity);
      const exceeded = this.#exceeded(additional, priority, capacity);
      if (exceeded.length > 0) {
        this.#remove(waiter);
        this.#log.warn('Resource demand exceeds machine capacity; rejected', { owner: request.owner, label: request.label, exceeded });
        this.#call(() => waiter.handlers.reject(new ResourceExceedsCapacity(exceeded)));
        continue;
      }
      const line = this.#line(priority, capacity, reserves);
      const short: ResourceDimension[] = [];
      const behind: ResourceDimension[] = [];
      for (const d of RESOURCE_DIMENSIONS) {
        if (additional[d] <= 0 || !enforced(d, capacity)) continue;
        if (leased[d] + additional[d] > line[d]) short.push(d);
        else if (blocked.has(d)) behind.push(d);
      }
      if (short.length === 0 && behind.length === 0) {
        for (const d of RESOURCE_DIMENSIONS) leased[d] += additional[d];
        this.#diskPeak = Math.max(this.#diskPeak, leased.scratchDisk);
        this.#admit(waiter);
        continue;
      }
      for (const d of short) blocked.add(d);
      const dimensions = RESOURCE_DIMENSIONS.filter((d) => short.includes(d) || behind.includes(d));
      if (key !== null) {
        queued.set(key, (queued.get(key) ?? 0) + 1);
        if (!queueBlockedOn.has(key)) queueBlockedOn.set(key, dimensions);
      }
      this.#setWait(waiter, {
        reason: 'resources',
        dimensions,
        ahead: resourceAhead,
        ...waitDetail(resourceDetail(dimensions, short.length === 0)),
      });
      resourceAhead++;
    }
    this.#maybeEvict(blocked, capacity);
  }

  #admit(waiter: Waiter): void {
    this.#remove(waiter);
    const { request } = waiter;
    if (request.queue) this.#queue(request.queue.key, request.queue.concurrency).running++;
    if (request.holder) {
      let holder = this.#holders.get(request.holder.id);
      if (!holder) {
        holder = {
          id: request.holder.id,
          demand: { ...request.holder.demand },
          users: 0,
          processes: 0,
          since: new Date().toISOString(),
          lastUsed: Date.now(),
          evict: null,
          evicting: false,
        };
        this.#holders.set(holder.id, holder);
      }
      holder.users++;
      holder.lastUsed = Date.now();
      holder.evicting = false;
    }
    const lease: Lease = {
      leaseId: randomUUID(),
      request,
      priority: request.priority ?? 'background',
      since: new Date().toISOString(),
      released: false,
    };
    this.#leases.set(lease.leaseId, lease);
    const handle: ResourceLease = { leaseId: lease.leaseId, release: () => this.#release(lease) };
    if (waiter.wait) this.#call(() => waiter.handlers.wait?.(null));
    let admitted = false;
    this.#call(() => {
      waiter.handlers.admit(handle);
      admitted = true;
    });
    if (!admitted) handle.release();
  }

  #release(lease: Lease): void {
    if (lease.released) return;
    lease.released = true;
    this.#leases.delete(lease.leaseId);
    const { request } = lease;
    if (request.queue) {
      const queue = this.#queues.get(request.queue.key);
      if (queue) {
        queue.running--;
        if (queue.running <= 0 && !this.#waiters.some((w) => w.request.queue?.key === request.queue!.key)) {
          this.#queues.delete(request.queue.key);
        }
      }
    }
    if (request.holder) {
      const holder = this.#holders.get(request.holder.id);
      if (holder) {
        holder.users--;
        holder.lastUsed = Date.now();
        this.#dropIfUnused(holder);
      }
    }
    this.#pump();
  }

  /** When an idle holder (no task using it, process still alive) blocks queued work, asks the least recently used one to yield (one at a time). */
  #maybeEvict(blocked: Set<ResourceDimension>, capacity: ResourceCapacity): void {
    if (blocked.size === 0) return;
    if ([...this.#holders.values()].some((h) => h.evicting)) return;
    const wanted = new Set(this.#waiters.map((w) => w.request.holder?.id).filter((id): id is string => !!id));
    const candidates = [...this.#holders.values()]
      .filter((h) => h.users === 0 && h.processes > 0 && h.evict && !wanted.has(h.id))
      .filter((h) => {
        const charge = chargeOf(h.demand, capacity);
        return [...blocked].some((d) => charge[d] > 0);
      })
      .sort((a, b) => a.lastUsed - b.lastUsed);
    const victim = candidates[0];
    if (!victim) return;
    victim.evicting = true;
    this.#log.info('Idle resident process yields to queued work', { holder: victim.id });
    this.#call(() => victim.evict!());
  }

  /** Capacity that changes, such as disk: refreshed on admission or return (at most once per `refreshMs`); when work is waiting on disk, refreshed once more when it expires. */
  #maybeRefresh(): void {
    const refresh = this.#capacity.refresh;
    if (!refresh || this.#refreshing) return;
    const age = performance.now() - this.#refreshedAt;
    if (age < this.#refreshMs) {
      const waitingDisk = this.#waiters.some((w) => w.wait?.dimensions?.includes('scratchDisk'));
      if (waitingDisk && !this.#refreshTimer) {
        this.#refreshTimer = setTimeout(() => {
          this.#refreshTimer = null;
          this.#pump();
        }, this.#refreshMs - age);
        this.#refreshTimer.unref?.();
      }
      return;
    }
    this.#refreshing = true;
    refresh
      .call(this.#capacity)
      .catch(() => {})
      .finally(() => {
        this.#refreshing = false;
        this.#refreshedAt = performance.now();
        this.#diskPeak = this.#leased(this.#capacity.current()).scratchDisk;
        if (this.#waiters.length > 0) this.#pump();
      });
  }

  // ---- Metering ----

  /** The amount this work adds on admission: its own demand, plus the amount of any holder that does not exist yet. */
  #additional(request: ResourceRequest, capacity: ResourceCapacity): Amounts {
    const own = chargeOf(request.demand ?? {}, capacity);
    const holder = request.holder && !this.#holders.has(request.holder.id) ? chargeOf(request.holder.demand, capacity) : ZERO;
    const total = {} as Amounts;
    for (const d of RESOURCE_DIMENSIONS) total[d] = own[d] + holder[d];
    total.cpuThreads = Math.min(total.cpuThreads, this.#cpuCeiling(capacity));
    return total;
  }

  /** The amount already leased: each lease's own amount, plus each holder's (counted once). */
  #leased(capacity: ResourceCapacity): Amounts {
    const total: Amounts = { ...ZERO };
    const add = (demand: ResourceDemand) => {
      const charge = chargeOf(demand, capacity);
      charge.cpuThreads = Math.min(charge.cpuThreads, this.#cpuCeiling(capacity));
      for (const d of RESOURCE_DIMENSIONS) total[d] += charge[d];
    };
    for (const lease of this.#leases.values()) add(lease.request.demand ?? {});
    for (const holder of this.#holders.values()) add(holder.demand);
    return total;
  }

  /**
   * The most this priority can use: capacity minus the system reserve, and for background additionally minus the interactive reserve. For disk, the capacity is the current free space. Since leased work may already have written some of it, the disk ceiling adds the leased amount back (conservatively assuming none of it has been written).
   */
  #line(priority: ResourcePriority, capacity: ResourceCapacity, reserves: ResourceReserves): Amounts {
    const line = {} as Amounts;
    for (const d of RESOURCE_DIMENSIONS) {
      const total = capacity[d] ?? 0;
      const reserved = (reserves.system[d] ?? 0) + (priority === 'background' ? (reserves.interactive[d] ?? 0) : 0);
      line[d] = Math.max(0, total - reserved);
    }
    line.scratchDisk = Math.max(0, line.scratchDisk);
    return line;
  }

  /**
   * The dimensions that cannot fit even with nothing leased (disk uses the probed free space plus the peak leased since the probe). CPU does not overflow: demand is capped at the limit, so the work just runs slower.
   */
  #exceeded(additional: Amounts, priority: ResourcePriority, capacity: ResourceCapacity): ExceededDimension[] {
    const line = this.#line(priority, capacity, this.#reserves(capacity));
    const leasedDisk = Math.max(this.#leased(capacity).scratchDisk, this.#diskPeak);
    const result: ExceededDimension[] = [];
    for (const d of RESOURCE_DIMENSIONS) {
      if (d === 'cpuThreads' || additional[d] <= 0 || !enforced(d, capacity)) continue;
      const limit = d === 'scratchDisk' ? line[d] + leasedDisk : line[d];
      if (additional[d] > limit) result.push({ dimension: d, demand: additional[d], limit });
    }
    return result;
  }

  /** The CPU thread limit: the number of threads background work can use (at least 1). */
  #cpuCeiling(capacity: ResourceCapacity): number {
    const reserves = this.#reserves(capacity);
    return Math.max(1, capacity.cpuThreads - reserves.system.cpuThreads - reserves.interactive.cpuThreads);
  }

  // ---- Miscellaneous ----

  #ordered(): Waiter[] {
    const rank = (w: Waiter) => ((w.request.priority ?? 'background') === 'interactive' ? 0 : 1);
    return [...this.#waiters].sort((a, b) => rank(a) - rank(b) || a.seq - b.seq);
  }

  #queue(key: string, concurrency: number): { concurrency: number; running: number } {
    let queue = this.#queues.get(key);
    if (!queue) {
      queue = { concurrency, running: 0 };
      this.#queues.set(key, queue);
    }
    queue.concurrency = concurrency;
    return queue;
  }

  #remove(waiter: Waiter): void {
    const index = this.#waiters.indexOf(waiter);
    if (index >= 0) this.#waiters.splice(index, 1);
  }

  #dropIfUnused(holder: Holder): void {
    if (holder.users <= 0 && holder.processes <= 0 && this.#holders.get(holder.id) === holder) this.#holders.delete(holder.id);
  }

  #setWait(waiter: Waiter, next: Omit<JobWait, 'since'>): void {
    const previous = waiter.wait;
    if (
      previous &&
      previous.reason === next.reason &&
      previous.ahead === next.ahead &&
      previous.detail === next.detail &&
      (previous.dimensions ?? []).join() === (next.dimensions ?? []).join()
    ) {
      return;
    }
    const wait: JobWait = { ...next, since: previous?.since ?? new Date().toISOString() };
    if (!wait.dimensions) delete wait.dimensions;
    waiter.wait = wait;
    this.#call(() => waiter.handlers.wait?.(wait));
  }

  #call(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.#log.error('Resource scheduler callback failed', { error: String(error) });
    }
  }
}

/** The amount one demand counts on each dimension: on a unified-memory machine, GPU memory is also counted in memory. */
function chargeOf(demand: ResourceDemand, capacity: ResourceCapacity): Amounts {
  const charge: Amounts = { ...ZERO };
  for (const d of RESOURCE_DIMENSIONS) charge[d] = Math.max(0, demand[d] ?? 0);
  if (capacity.unifiedMemory) charge.memory += charge.gpuMemory;
  return charge;
}

/** A dimension whose capacity is unknown is not used for admission. */
function enforced(dimension: ResourceDimension, capacity: ResourceCapacity): boolean {
  return capacity[dimension] !== null;
}

function concurrencyDetail(ahead: number): Localized {
  return ahead > 0 ? J.queuedBehind({ ahead }) : J.queuedRunning();
}

function resourceDetail(dimensions: ResourceDimension[], behind: boolean): Localized {
  const keys = dimensions.join(',');
  return behind ? J.waitingBehind({ dimensions: keys }) : J.waitingShort({ dimensions: keys });
}

/** `JobWait`'s `detail` and its reference. */
function waitDetail(detail: Localized): Pick<JobWait, 'detail' | 'detailRef'> {
  const { text, ref } = textParts(detail);
  return ref ? { detail: text, detailRef: ref } : { detail: text };
}
