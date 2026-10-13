import {
  RpcError,
  isCurrency,
  microsToMoney,
  moneyToMicros,
  newId,
  refOf,
  type Grant,
  type GrantBudgetMode,
  type GrantCreateParams,
  type GrantDataKind,
  type GrantOrigin,
  type GrantRevokeResult,
  type GrantScope,
  type GrantState,
  type GrantUpdateParams,
  type Id,
  type JobGrantSettlement,
  type MessageRef,
  type Money,
  type TaskBudgetLimits,
  type TaskBudgetPolicy,
} from '@cuccut/protocol';
import { writeJsonAtomic } from './json-file.ts';
import { readJsonOrQuarantine, type StoreLog } from './store-file.ts';
import { RuntimeStorageGrants as SG } from '@cuccut/protocol/messages/runtime-storage';

/**
 * The ledger of outbound data authorizations and budgets (architecture design §12.5, §7.8). The file is `<runtime-home>/store/grants.json` (0600).
 *
 * - Checks and reservations are both synchronous: within the same event-loop turn, the quota is checked and the reservation recorded, so concurrent submissions cannot together pass the limit. Disk writes run serially afterwards
 *   (write temp file, fsync, rename, fsync directory). On a crash, at most the last few reservations are lost. Their tasks were not written to disk either, and on restart they are settled as orphaned reservations.
 * - The exception is “started”: `start` waits until it is on disk before letting the call through. Before the data is handed over, the ledger must already record that this reservation has started. After a restart it is not treated as not started and released.
 * - Amounts are recorded as integers in millionths, not floats. Estimates in a different currency from the grant's cap are treated as impossible to estimate.
 * - Settlement rules (§7.8): reservations that end before execution starts are all released. Completed ones are charged the fee the service reports; without a report, they are charged the reservation's estimate
 *   (without an estimate, only the count is charged and the amount is unknown). Calls that fail, are cancelled, or are interrupted after execution started are, if the service reports nothing, conservatively charged as one call with the reservation's estimate deducted.
 * - Task budget (§3.2, §7.8): one policy per task (count and amount caps, summed across Providers). After a call passes authorization, it must also pass the task budget. The same reservation occupies both,
 *   and start and settlement are also a single operation: the start is written to disk once, and at settlement the grant's and the task's usage are recorded together, exactly once (orphaned reservations after a restart are likewise settled only once).
 *   When there is an amount cap, the estimate must be in the cap's currency. A call in another currency or with unknown amount among the used total, or an estimate that cannot be made among the reservations, means the cap cannot be guaranteed.
 */

/** The authorization one call requires. */
export interface GrantCall {
  recipient: string;
  dataKinds: readonly GrantDataKind[];
  /** Which video the outbound data comes from (or the result goes into). null when there is none; then only grants covering all videos apply. */
  videoId: Id | null;
  /** The task the call happens in (one execution within a session). null when there is none; grants that belong only to a task do not cover it. */
  taskId: Id | null;
  /** Upper bound of the estimated amount. null when there is no price. */
  estimate: Money | null;
  /** Only this grant is used (it was issued for this one call at approval time). */
  grantId?: Id;
}

export type GrantEvaluation =
  | { status: 'covered'; grant: Grant }
  /** The grant covering it has run out of quota: count or amount. */
  | { status: 'exhausted'; grant: Grant; measure: 'calls' | 'amount' }
  /** The grant covering it has an amount cap, but this call's amount cannot be estimated (the model has no price, or the currency differs). */
  | { status: 'unverifiable'; grant: Grant }
  /** No grant covers it. `revoked` is the one that covered it before and has since been revoked or expired. */
  | { status: 'none'; revoked: Grant | null };

/** One reservation. */
export interface GrantReservation {
  reservationId: Id;
  grantId: Id;
  generation: number;
  budgetMode: GrantBudgetMode;
  amount: Money | null;
}

/** The task budget is insufficient (count or amount), or there is an amount cap and this call's amount cannot be estimated in the same currency. */
export type TaskBudgetRefusal =
  { status: 'exhausted'; policy: TaskBudgetPolicy; measure: 'calls' | 'amount' } | { status: 'unverifiable'; policy: TaskBudgetPolicy };

export type GrantAdmission =
  | { ok: true; reservation: GrantReservation; grant: Grant }
  | { ok: false; evaluation: GrantEvaluation }
  | { ok: false; task: TaskBudgetRefusal };

/** The outcome at settlement: completed (possibly with a fee the service reports), or failed, cancelled, or interrupted. */
export type GrantOutcome = { kind: 'completed'; reported?: Money | null } | { kind: 'failed' };

export interface GrantIssue extends GrantCreateParams {
  /** The text reference the Runtime writes for `purpose` (the UI regenerates it in the current language). */
  purposeRef?: MessageRef;
  origin: GrantOrigin;
  once?: boolean;
  approvalId?: Id | null;
}

export interface GrantStoreOptions {
  now?: () => Date;
  /** How many ended grants (revoked, expired, or used up) are kept at most (default 200). Those with reservations still pending are not evicted. */
  maxEnded?: number;
  /** How many task budgets are kept at most (default 1000). When exceeded, the oldest without reservations are evicted. */
  maxTaskBudgets?: number;
  log?: StoreLog;
}

interface StoredGrant {
  grantId: Id;
  dataKinds: GrantDataKind[];
  recipient: string;
  scope: GrantScope;
  purpose: string;
  purposeRef?: MessageRef;
  budgetMode: GrantBudgetMode;
  budgetCap: Money | null;
  maxCalls: number | null;
  expiresAt: string | null;
  generation: number;
  taskId: Id | null;
  once: boolean;
  origin: GrantOrigin;
  approvalId: Id | null;
  /** The grant issued by default when a Provider is enabled: the time of that enabling. One grant is issued per enabling; after revocation it is not re-issued automatically. */
  providerEnabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  used: { calls: number; amountMicros: string; unknownCostCalls: number };
}

interface StoredReservation {
  reservationId: Id;
  grantId: Id;
  generation: number;
  jobId: Id | null;
  amountMicros: string | null;
  started: boolean;
  createdAt: string;
  /** The task budget held at the same time (absent in earlier records). */
  taskPolicyId?: Id | null;
  /** The estimate for this call (any currency; null when there is none), used to settle the task budget. */
  taskEstimate?: Money | null;
}

interface StoredTaskBudget {
  policyId: Id;
  taskId: Id;
  maxCalls: number | null;
  cap: Money | null;
  /** Settled usage. Amounts are listed by currency (integers in millionths). */
  used: { calls: number; amounts: Record<string, string>; unknownCostCalls: number };
  createdAt: string;
  updatedAt: string;
}

interface GrantsFile {
  schemaVersion: 1;
  grants: StoredGrant[];
  reservations: StoredReservation[];
  /** Task budget (absent in earlier files). */
  taskBudgets?: StoredTaskBudget[];
}

export class GrantStore {
  readonly #file: string;
  readonly #now: () => Date;
  readonly #maxEnded: number;
  readonly #maxTaskBudgets: number;
  readonly #grants = new Map<Id, StoredGrant>();
  /** Task budgets, per task. */
  readonly #taskBudgets = new Map<Id, StoredTaskBudget>();
  readonly #reservations = new Map<Id, StoredReservation>();
  readonly #listeners = new Set<(change: { grant: Grant } | { removed: Id }) => void>();
  #writing: Promise<void> = Promise.resolve();
  /** The queued write that has not started yet: later changes are carried by it. Resolves to the write's error (null on success). */
  #queued: Promise<unknown> | null = null;
  /** The last disk write failed: the in-memory ledger is newer than the disk. */
  #unsaved = false;

  private constructor(file: string, options: GrantStoreOptions) {
    this.#file = file;
    this.#now = options.now ?? (() => new Date());
    this.#maxEnded = options.maxEnded ?? 200;
    this.#maxTaskBudgets = options.maxTaskBudgets ?? 1000;
  }

  /**
   * Reads the ledger. Throws when the file is not JSON, is not recognized, or was written by a newer version (Runtime startup fails). The file is left as is: authorizations and reservations must not be silently lost,
   * and this version must not overwrite them (`store-file.ts` with `quarantine: false`). An empty file is treated as absent.
   */
  static async open(file: string, options: GrantStoreOptions = {}): Promise<GrantStore> {
    const store = new GrantStore(file, options);
    const read = await readJsonOrQuarantine(file, {
      log: options.log,
      quarantine: false,
      recognize: (raw) => (Array.isArray(raw.grants) && Array.isArray(raw.reservations) ? (raw as unknown as GrantsFile) : null),
    });
    if (read.status === 'unrecognized') throw new Error(`Malformed grants file: ${file}`);
    if (read.status === 'newer-version') throw new Error(`Grants file was written by a newer version (schemaVersion ${read.version}): ${file}`);
    const data = read.value;
    if (data !== null) {
      for (const grant of data.grants) store.#grants.set(grant.grantId, grant);
      for (const r of data.reservations) if (store.#grants.has(r.grantId)) store.#reservations.set(r.reservationId, r);
      for (const budget of Array.isArray(data.taskBudgets) ? data.taskBudgets : []) store.#taskBudgets.set(budget.taskId, budget);
    }
    return store;
  }

  // ---- Reading ----

  list(filter: { recipient?: string; videoId?: Id; includeEnded?: boolean } = {}): Grant[] {
    return [...this.#grants.values()]
      .map((g) => this.#view(g))
      .filter((g) => (filter.includeEnded ? true : g.state === 'active'))
      .filter((g) => filter.recipient === undefined || g.recipient === filter.recipient)
      .filter((g) => filter.videoId === undefined || g.scope.videoId === null || g.scope.videoId === filter.videoId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  get(grantId: Id): Grant | null {
    const grant = this.#grants.get(grantId);
    return grant ? this.#view(grant) : null;
  }

  /** One grant's reservations (calls not yet settled). */
  reservations(grantId: Id): Array<{ reservationId: Id; jobId: Id | null; started: boolean; amount: Money | null }> {
    const grant = this.#grants.get(grantId);
    return [...this.#reservations.values()]
      .filter((r) => r.grantId === grantId)
      .map((r) => ({
        reservationId: r.reservationId,
        jobId: r.jobId,
        started: r.started,
        amount:
          r.amountMicros !== null && grant?.budgetCap
            ? { amount: microsToMoney(BigInt(r.amountMicros)), currency: grant.budgetCap.currency }
            : null,
      }));
  }

  onChange(listener: (change: { grant: Grant } | { removed: Id }) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // ---- Checking and reserving (synchronous) ----

  /** Whether an authorization covers this call, and whether the quota is enough. Changes nothing. */
  evaluate(call: GrantCall): GrantEvaluation {
    const now = this.#now();
    const candidates = [...this.#grants.values()].filter((g) => this.#matches(g, call));
    const live = candidates.filter((g) => g.revokedAt === null && !expired(g, now)).sort(preference);
    let failure: GrantEvaluation | null = null;
    for (const grant of live) {
      const fit = this.#fit(grant, call);
      if (fit === 'ok') return { status: 'covered', grant: this.#view(grant) };
      failure ??=
        fit === 'unverifiable'
          ? { status: 'unverifiable', grant: this.#view(grant) }
          : { status: 'exhausted', grant: this.#view(grant), measure: fit };
    }
    if (failure) return failure;
    const ended = candidates.filter((g) => g.revokedAt !== null || expired(g, now)).sort(byUpdatedDesc)[0];
    return { status: 'none', revoked: ended ? this.#view(ended) : null };
  }

  /** Whether this call is within its task budget (changes nothing). Returns null when it is not in a task, the task has no budget, or it is within budget. */
  evaluateTask(call: Pick<GrantCall, 'taskId' | 'estimate'>): TaskBudgetRefusal | null {
    const budget = call.taskId !== null ? this.#taskBudgets.get(call.taskId) : undefined;
    if (!budget) return null;
    const fit = this.#taskFit(budget, call.estimate);
    if (fit === 'ok') return null;
    return fit === 'unverifiable'
      ? { status: 'unverifiable', policy: this.#taskView(budget) }
      : { status: 'exhausted', policy: this.#taskView(budget), measure: fit };
  }

  /** Checks and reserves one call within the same synchronous call (§7.8 atomic reservation): authorization first, then the task budget. One reservation occupies both. */
  admit(call: GrantCall, options: { jobId?: Id | null } = {}): GrantAdmission {
    const evaluation = this.evaluate(call);
    if (evaluation.status !== 'covered') return { ok: false, evaluation };
    const task = this.evaluateTask(call);
    if (task) return { ok: false, task };
    const grant = this.#grants.get(evaluation.grant.grantId)!;
    const amountMicros = grant.budgetCap && call.estimate ? moneyToMicros(call.estimate.amount).toString() : null;
    const budget = call.taskId !== null ? this.#taskBudgets.get(call.taskId) : undefined;
    const reservation: StoredReservation = {
      reservationId: newId('grs'),
      grantId: grant.grantId,
      generation: grant.generation,
      jobId: options.jobId ?? null,
      amountMicros,
      started: false,
      createdAt: this.#now().toISOString(),
      ...(budget ? { taskPolicyId: budget.policyId, taskEstimate: call.estimate } : {}),
    };
    this.#reservations.set(reservation.reservationId, reservation);
    this.#changed(grant);
    return { ok: true, reservation: this.#ticket(reservation, grant), grant: this.#view(grant) };
  }

  /**
   * When a reserved call is about to execute (data is about to be handed over), it is recorded as started, provided the authorization is still valid and the generation has not changed. `ok` resolves **only after the write reaches disk** (§7.8).
   * If the authorization has been revoked, has expired, or was tightened (the generation changed), that grant is returned. The caller ends the call with `GRANT_REVOKED` and releases the reservation.
   * If the write cannot reach disk, the “started” mark is withdrawn and `unsaved` is returned. The caller does not send the request. Otherwise, after a restart it would be treated as not started and released.
   */
  async start(reservationId: Id): Promise<{ ok: true } | { ok: false; grant: Grant | null; unsaved?: true }> {
    const reservation = this.#reservations.get(reservationId);
    if (!reservation) return { ok: false, grant: null };
    const grant = this.#grants.get(reservation.grantId);
    if (!grant) return { ok: false, grant: null };
    if (grant.revokedAt !== null || grant.generation !== reservation.generation || expired(grant, this.#now())) {
      return { ok: false, grant: this.#view(grant) };
    }
    if (!reservation.started) {
      reservation.started = true;
      const error = await this.#schedule();
      if (error) {
        reservation.started = false;
        void this.#schedule();
        return { ok: false, grant: this.#view(grant), unsaved: true };
      }
    }
    return { ok: true };
  }

  /** The reservation still exists and has been recorded as started. */
  started(reservationId: Id): boolean {
    return this.#reservations.get(reservationId)?.started === true;
  }

  /** The reservation still exists and has not started executing. */
  pending(reservationId: Id): boolean {
    const reservation = this.#reservations.get(reservationId);
    return reservation !== undefined && !reservation.started;
  }

  /** Settles one reservation (see the rules at the top of the file). Returns null if it has already been settled. */
  settle(reservationId: Id, outcome: GrantOutcome): JobGrantSettlement | null {
    const reservation = this.#reservations.get(reservationId);
    if (!reservation) return null;
    this.#reservations.delete(reservationId);
    this.#chargeTask(reservation, outcome);
    const grant = this.#grants.get(reservation.grantId);
    const at = this.#now().toISOString();
    if (!grant) return { calls: 0, amount: null, basis: 'released', at };
    let settlement: JobGrantSettlement;
    if (!reservation.started) {
      settlement = { calls: 0, amount: null, basis: 'released', at };
    } else {
      const currency = grant.budgetCap?.currency ?? null;
      const estimate = reservation.amountMicros !== null ? BigInt(reservation.amountMicros) : null;
      const reported = outcome.kind === 'completed' ? (outcome.reported ?? null) : null;
      let micros: bigint | null;
      let basis: JobGrantSettlement['basis'];
      if (reported && isCurrency(reported.currency) && (currency === null || reported.currency === currency)) {
        micros = currency === null ? null : moneyToMicros(reported.amount);
        basis = 'reported';
      } else if (outcome.kind === 'completed') {
        micros = estimate;
        basis = estimate !== null ? 'estimate' : 'unknown';
      } else {
        micros = estimate;
        basis = 'conservative';
      }
      grant.used.calls += 1;
      if (micros !== null) grant.used.amountMicros = (BigInt(grant.used.amountMicros) + micros).toString();
      else if (basis !== 'reported') grant.used.unknownCostCalls += 1;
      const amount =
        basis === 'reported' && reported
          ? reported
          : micros !== null && currency !== null
            ? { amount: microsToMoney(micros), currency }
            : null;
      settlement = { calls: 1, amount, basis, at };
      grant.updatedAt = at;
    }
    this.#changed(grant);
    return settlement;
  }

  /**
   * Settles reservations that no task has claimed (after a Runtime restart: in-process calls, and tasks that were not written to disk in time). Those that started executing are conservatively deducted,
   * and those that did not start are released. Those for which `keep` returns true are kept. Returns the number of reservations settled.
   */
  settleOrphans(keep: (reservation: { reservationId: Id; jobId: Id | null }) => boolean = () => false): number {
    let count = 0;
    for (const reservation of [...this.#reservations.values()]) {
      if (keep({ reservationId: reservation.reservationId, jobId: reservation.jobId })) continue;
      this.settle(reservation.reservationId, { kind: 'failed' });
      count++;
    }
    return count;
  }

  // ---- Issuing, changing, and revoking ----

  create(input: GrantIssue): Grant {
    const now = this.#now().toISOString();
    if ((input.budgetMode as GrantBudgetMode) === 'free-local') throw new RpcError('invalid-request', SG.localNeedsNoGrant());
    if (input.dataKinds.length === 0) throw new RpcError('invalid-request', SG.dataKindRequired());
    const budgetCap = input.budgetCap ?? null;
    if (input.budgetMode === 'estimate-cap' && budgetCap === null) throw new RpcError('invalid-request', SG.budgetCapRequired());
    if (input.budgetMode === 'per-call-unknown-cost' && budgetCap !== null) {
      throw new RpcError('invalid-request', SG.unknownCostNoCap());
    }
    if (budgetCap) moneyToMicrosOrThrow(budgetCap);
    if (input.expiresAt && Date.parse(input.expiresAt) <= this.#now().getTime()) throw new RpcError('invalid-request', SG.expiryPassed());
    const grant: StoredGrant = {
      grantId: newId('grant'),
      dataKinds: [...new Set(input.dataKinds)],
      recipient: input.recipient,
      scope: { videoId: input.scope?.videoId ?? null },
      purpose: input.purpose,
      ...(input.purposeRef ? { purposeRef: input.purposeRef } : {}),
      budgetMode: input.budgetMode,
      budgetCap,
      maxCalls: input.once ? 1 : (input.maxCalls ?? null),
      expiresAt: input.expiresAt ?? null,
      generation: 1,
      taskId: input.taskId ?? null,
      once: input.once ?? false,
      origin: input.origin,
      approvalId: input.approvalId ?? null,
      providerEnabledAt: null,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
      used: { calls: 0, amountMicros: '0', unknownCostCalls: 0 },
    };
    this.#grants.set(grant.grantId, grant);
    this.#prune();
    this.#changed(grant);
    return this.#view(grant);
  }

  /** Changes a grant: the fields given replace the existing ones. A tightening (fewer data kinds, a narrower scope, a lower or newly set cap, an earlier or newly set expiry) increments the generation by one. */
  update(params: GrantUpdateParams): Grant {
    const grant = this.#grants.get(params.grantId);
    if (!grant) throw new RpcError('not-found', SG.grantNotFound());
    if (grant.revokedAt !== null) throw new RpcError('conflict', SG.grantRevoked());
    const next: StoredGrant = structuredClone(grant);
    if (params.dataKinds !== undefined) {
      if (params.dataKinds.length === 0) throw new RpcError('invalid-request', SG.dataKindRequired());
      next.dataKinds = [...new Set(params.dataKinds)];
    }
    if (params.scope !== undefined) next.scope = { videoId: params.scope.videoId };
    if (params.purpose !== undefined) {
      next.purpose = params.purpose;
      delete next.purposeRef;
    }
    if (params.budgetCap !== undefined) {
      if (params.budgetCap === null && grant.budgetMode === 'estimate-cap') {
        throw new RpcError('invalid-request', SG.cannotRemoveCap());
      }
      if (params.budgetCap !== null && grant.budgetMode !== 'estimate-cap') {
        throw new RpcError('invalid-request', SG.unknownCostCannotCap());
      }
      if (params.budgetCap) {
        moneyToMicrosOrThrow(params.budgetCap);
        if (grant.budgetCap && params.budgetCap.currency !== grant.budgetCap.currency) throw new RpcError('invalid-request', SG.cannotChangeCurrency());
      }
      next.budgetCap = params.budgetCap;
    }
    if (params.maxCalls !== undefined) next.maxCalls = params.maxCalls;
    if (params.expiresAt !== undefined) {
      if (params.expiresAt !== null && Date.parse(params.expiresAt) <= this.#now().getTime()) {
        throw new RpcError('invalid-request', SG.expiryPassedRevoke());
      }
      next.expiresAt = params.expiresAt;
    }
    if (tightened(grant, next)) next.generation = grant.generation + 1;
    next.updatedAt = this.#now().toISOString();
    this.#grants.set(next.grantId, next);
    this.#changed(next);
    return this.#view(next);
  }

  /** Revokes: the grant no longer covers new calls. The generation increments by one, and calls reserved under the old generation that have not started executing are rejected when they start. Repeated revocation does not increment the generation again. */
  revoke(grantId: Id): GrantRevokeResult {
    const grant = this.#grants.get(grantId);
    if (!grant) throw new RpcError('not-found', SG.grantNotFound());
    if (grant.revokedAt === null) {
      const now = this.#now().toISOString();
      grant.revokedAt = now;
      grant.updatedAt = now;
      grant.generation += 1;
      this.#changed(grant);
    }
    const view = this.#view(grant);
    const runningJobs = [...this.#reservations.values()]
      .filter((r) => r.grantId === grantId && r.started && r.jobId !== null)
      .map((r) => r.jobId!);
    return {
      grant: view,
      alreadySent: {
        calls: grant.used.calls,
        amount: grant.budgetCap ? { amount: microsToMoney(BigInt(grant.used.amountMicros)), currency: grant.budgetCap.currency } : null,
        unknownCostCalls: grant.used.unknownCostCalls,
      },
      runningJobs,
      note: SG.revokeNote().text,
      noteRef: refOf(SG.revokeNote()),
    };
  }

  // ---- Task budgets (§3.2, §7.8) ----

  /** One task's budget. null when there is none. */
  taskBudget(taskId: Id): TaskBudgetPolicy | null {
    const budget = this.#taskBudgets.get(taskId);
    return budget ? this.#taskView(budget) : null;
  }

  /**
   * Creates or changes a task's budget caps (`null` leaves that item unset). Usage is unchanged. If the cap is lowered below what has already been used, later calls are rejected, and reservations already held settle as usual.
   */
  setTaskBudget(taskId: Id, limits: TaskBudgetLimits): TaskBudgetPolicy {
    if (limits.maxCalls !== null && (!Number.isInteger(limits.maxCalls) || limits.maxCalls <= 0)) {
      throw new RpcError('invalid-request', SG.taskCallLimit());
    }
    if (limits.cap) moneyToMicrosOrThrow(limits.cap);
    const now = this.#now().toISOString();
    const existing = this.#taskBudgets.get(taskId);
    const budget: StoredTaskBudget = existing
      ? { ...existing, maxCalls: limits.maxCalls, cap: limits.cap, updatedAt: now }
      : {
          policyId: newId('tbp'),
          taskId,
          maxCalls: limits.maxCalls,
          cap: limits.cap,
          used: { calls: 0, amounts: {}, unknownCostCalls: 0 },
          createdAt: now,
          updatedAt: now,
        };
    this.#taskBudgets.set(taskId, budget);
    this.#pruneTaskBudgets();
    void this.#schedule();
    return this.#taskView(budget);
  }

  // ---- Default grants when enabling a Provider (migration rule, §6.8) ----

  /**
   * The default grant issued when an online or agent Provider is enabled. Its data kinds are derived from its capabilities. No amount cap is set, and it is counted per call with the amount unknown.
   * It is issued only once per enabling (`enabledAt`). After the user revokes it, it is not re-issued automatically; re-enabling is what issues it again. When the capabilities change, the new data kinds are added (a widening, not a generation bump).
   */
  ensureProviderGrant(input: { recipient: string; dataKinds: readonly GrantDataKind[]; enabledAt: string; label: string }): Grant | null {
    if (input.dataKinds.length === 0) return null;
    const existing = [...this.#grants.values()].find(
      (g) => g.origin === 'provider-enable' && g.recipient === input.recipient && g.providerEnabledAt === input.enabledAt,
    );
    if (existing) {
      if (existing.revokedAt !== null) return null;
      const missing = input.dataKinds.filter((k) => !existing.dataKinds.includes(k));
      if (missing.length > 0) {
        existing.dataKinds = [...existing.dataKinds, ...missing];
        existing.updatedAt = this.#now().toISOString();
        this.#changed(existing);
      }
      return this.#view(existing);
    }
    const purpose = SG.providerGrantPurpose({ label: input.label });
    const created = this.create({
      dataKinds: [...input.dataKinds],
      recipient: input.recipient,
      purpose: purpose.text,
      purposeRef: refOf(purpose),
      budgetMode: 'per-call-unknown-cost',
      origin: 'provider-enable',
    });
    const stored = this.#grants.get(created.grantId)!;
    stored.providerEnabledAt = input.enabledAt;
    void this.#schedule();
    return this.#view(stored);
  }

  /** When a Provider is disabled or removed, revokes the grants issued by default when it was enabled. Grants the user issued themselves are left alone. Returns the number of grants revoked. */
  revokeProviderGrants(recipient: string): number {
    let count = 0;
    for (const grant of this.#grants.values()) {
      if (grant.origin !== 'provider-enable' || grant.recipient !== recipient || grant.revokedAt !== null) continue;
      this.revoke(grant.grantId);
      count++;
    }
    return count;
  }

  /** Waits for the disk write to finish. If the last write failed, writes again (if it still cannot be written, give up; no infinite retries). */
  async flush(): Promise<void> {
    await this.#writing;
    if (this.#unsaved) await this.#schedule();
  }

  // ---- Internal ----

  #matches(grant: StoredGrant, call: GrantCall): boolean {
    if (call.grantId !== undefined) {
      if (grant.grantId !== call.grantId) return false;
    } else if (grant.once) {
      return false;
    }
    if (grant.recipient !== call.recipient) return false;
    if (!call.dataKinds.every((k) => grant.dataKinds.includes(k))) return false;
    if (grant.scope.videoId !== null && grant.scope.videoId !== call.videoId) return false;
    if (grant.taskId !== null && grant.taskId !== call.taskId) return false;
    return true;
  }

  #fit(grant: StoredGrant, call: GrantCall): 'ok' | 'calls' | 'amount' | 'unverifiable' {
    const reserved = [...this.#reservations.values()].filter((r) => r.grantId === grant.grantId);
    if (grant.maxCalls !== null && grant.used.calls + reserved.length + 1 > grant.maxCalls) return 'calls';
    if (grant.budgetMode !== 'estimate-cap' || grant.budgetCap === null) return 'ok';
    if (!call.estimate || call.estimate.currency !== grant.budgetCap.currency) return 'unverifiable';
    const reservedMicros = reserved.reduce((sum, r) => sum + (r.amountMicros !== null ? BigInt(r.amountMicros) : 0n), 0n);
    const total = BigInt(grant.used.amountMicros) + reservedMicros + moneyToMicros(call.estimate.amount);
    return total > moneyToMicros(grant.budgetCap.amount) ? 'amount' : 'ok';
  }

  #taskFit(budget: StoredTaskBudget, estimate: Money | null): 'ok' | 'calls' | 'amount' | 'unverifiable' {
    const reserved = [...this.#reservations.values()].filter((r) => r.taskPolicyId === budget.policyId);
    if (budget.maxCalls !== null && budget.used.calls + reserved.length + 1 > budget.maxCalls) return 'calls';
    if (budget.cap === null) return 'ok';
    const currency = budget.cap.currency;
    if (!estimate || estimate.currency !== currency) return 'unverifiable';
    const foreign = Object.entries(budget.used.amounts).some(([c, micros]) => c !== currency && BigInt(micros) > 0n);
    if (foreign || budget.used.unknownCostCalls > 0) return 'unverifiable';
    if (reserved.some((r) => !r.taskEstimate || r.taskEstimate.currency !== currency)) return 'unverifiable';
    const reservedMicros = reserved.reduce((sum, r) => sum + moneyToMicros(r.taskEstimate!.amount), 0n);
    const total = BigInt(budget.used.amounts[currency] ?? '0') + reservedMicros + moneyToMicros(estimate.amount);
    return total > moneyToMicros(budget.cap.amount) ? 'amount' : 'ok';
  }

  /** Recorded into the task budget at settlement (in the same operation as the grant's settlement). Calls that started are counted once. The amount is the reported one, the estimate, or the conservative estimate; if none exists, it is recorded as amount unknown. */
  #chargeTask(reservation: StoredReservation, outcome: GrantOutcome): void {
    if (!reservation.taskPolicyId || !reservation.started) return;
    const budget = [...this.#taskBudgets.values()].find((b) => b.policyId === reservation.taskPolicyId);
    if (!budget) return;
    const reported = outcome.kind === 'completed' ? (outcome.reported ?? null) : null;
    const amount = reported && isCurrency(reported.currency) ? reported : (reservation.taskEstimate ?? null);
    budget.used.calls += 1;
    if (amount) {
      const before = BigInt(budget.used.amounts[amount.currency] ?? '0');
      budget.used.amounts[amount.currency] = (before + moneyToMicros(amount.amount)).toString();
    } else {
      budget.used.unknownCostCalls += 1;
    }
    budget.updatedAt = this.#now().toISOString();
  }

  #taskView(budget: StoredTaskBudget): TaskBudgetPolicy {
    const reserved = [...this.#reservations.values()].filter((r) => r.taskPolicyId === budget.policyId);
    const reservedByCurrency = new Map<string, bigint>();
    for (const r of reserved) {
      if (!r.taskEstimate) continue;
      const before = reservedByCurrency.get(r.taskEstimate.currency) ?? 0n;
      reservedByCurrency.set(r.taskEstimate.currency, before + moneyToMicros(r.taskEstimate.amount));
    }
    return structuredClone({
      policyId: budget.policyId,
      taskId: budget.taskId,
      maxCalls: budget.maxCalls,
      cap: budget.cap,
      usage: {
        calls: budget.used.calls,
        reservedCalls: reserved.length,
        spent: Object.entries(budget.used.amounts).map(([currency, micros]) => ({ amount: microsToMoney(BigInt(micros)), currency })),
        reserved: [...reservedByCurrency].map(([currency, micros]) => ({ amount: microsToMoney(micros), currency })),
        unknownCostCalls: budget.used.unknownCostCalls,
      },
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    } satisfies TaskBudgetPolicy);
  }

  /** Evicts the oldest task budgets (those with pending reservations are left alone). */
  #pruneTaskBudgets(): void {
    if (this.#taskBudgets.size <= this.#maxTaskBudgets) return;
    const busy = new Set([...this.#reservations.values()].map((r) => r.taskPolicyId).filter((id): id is Id => !!id));
    const idle = [...this.#taskBudgets.values()]
      .filter((b) => !busy.has(b.policyId))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0));
    for (const budget of idle.slice(0, this.#taskBudgets.size - this.#maxTaskBudgets)) this.#taskBudgets.delete(budget.taskId);
  }

  #ticket(reservation: StoredReservation, grant: StoredGrant): GrantReservation {
    return {
      reservationId: reservation.reservationId,
      grantId: grant.grantId,
      generation: reservation.generation,
      budgetMode: grant.budgetMode,
      amount:
        reservation.amountMicros !== null && grant.budgetCap
          ? { amount: microsToMoney(BigInt(reservation.amountMicros)), currency: grant.budgetCap.currency }
          : null,
    };
  }

  #state(grant: StoredGrant, reservedCalls: number): GrantState {
    if (grant.revokedAt !== null) return 'revoked';
    if (expired(grant, this.#now())) return 'expired';
    if (grant.maxCalls !== null && grant.used.calls >= grant.maxCalls && reservedCalls === 0) return 'exhausted';
    if (grant.budgetCap && BigInt(grant.used.amountMicros) >= moneyToMicros(grant.budgetCap.amount) && reservedCalls === 0)
      return 'exhausted';
    return 'active';
  }

  #view(grant: StoredGrant): Grant {
    const reserved = [...this.#reservations.values()].filter((r) => r.grantId === grant.grantId);
    const currency = grant.budgetCap?.currency ?? null;
    const reservedMicros = reserved.reduce((sum, r) => sum + (r.amountMicros !== null ? BigInt(r.amountMicros) : 0n), 0n);
    return structuredClone({
      grantId: grant.grantId,
      dataKinds: grant.dataKinds,
      recipient: grant.recipient,
      scope: grant.scope,
      purpose: grant.purpose,
      ...(grant.purposeRef ? { purposeRef: grant.purposeRef } : {}),
      budgetMode: grant.budgetMode,
      budgetCap: grant.budgetCap,
      maxCalls: grant.maxCalls,
      expiresAt: grant.expiresAt,
      generation: grant.generation,
      taskId: grant.taskId,
      once: grant.once,
      origin: grant.origin,
      approvalId: grant.approvalId,
      state: this.#state(grant, reserved.length),
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      revokedAt: grant.revokedAt,
      usage: {
        calls: grant.used.calls,
        reservedCalls: reserved.length,
        amount: currency !== null ? microsToMoney(BigInt(grant.used.amountMicros)) : null,
        reservedAmount: currency !== null ? microsToMoney(reservedMicros) : null,
        unknownCostCalls: grant.used.unknownCostCalls,
      },
    } satisfies Grant);
  }

  /** Evicts the oldest ended grants (those with pending reservations are left alone). */
  #prune(): void {
    const ended = [...this.#grants.values()]
      .filter((g) => this.#state(g, 0) !== 'active' && ![...this.#reservations.values()].some((r) => r.grantId === g.grantId))
      .sort(byUpdatedDesc);
    for (const grant of ended.slice(this.#maxEnded)) {
      this.#grants.delete(grant.grantId);
      for (const listener of this.#listeners) safe(() => listener({ removed: grant.grantId }));
    }
  }

  #changed(grant: StoredGrant): void {
    void this.#schedule();
    const view = this.#view(grant);
    for (const listener of this.#listeners) safe(() => listener({ grant: structuredClone(view) }));
  }

  /** Queues a disk write (merged into one already queued). Resolves to this write's error, or null on success. */
  #schedule(): Promise<unknown> {
    if (this.#queued) return this.#queued;
    const write = this.#writing.then(async () => {
      // Changes from here on must be queued again.
      this.#queued = null;
      const file: GrantsFile = {
        schemaVersion: 1,
        grants: [...this.#grants.values()],
        reservations: [...this.#reservations.values()],
        taskBudgets: [...this.#taskBudgets.values()],
      };
      try {
        await writeJsonAtomic(this.#file, file, { mode: 0o600, durable: true });
        this.#unsaved = false;
        return null;
      } catch (error) {
        // If the disk write fails, the in-memory ledger still takes effect. The next change or flush writes again.
        this.#unsaved = true;
        return error;
      }
    });
    this.#queued = write;
    this.#writing = write.then(() => {});
    return write;
  }
}

function expired(grant: StoredGrant, now: Date): boolean {
  return grant.expiresAt !== null && Date.parse(grant.expiresAt) <= now.getTime();
}

/** Prefers the most specific grant: one that belongs to this task first, then one that covers only this video, then one that covers all videos. Among the same level, newer ones come first. */
function preference(a: StoredGrant, b: StoredGrant): number {
  const rank = (g: StoredGrant) => (g.taskId !== null ? 0 : g.scope.videoId !== null ? 1 : 2);
  return rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
}

function byUpdatedDesc(a: StoredGrant, b: StoredGrant): number {
  return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
}

/** Tightening: the same call may no longer be covered under the new grant. */
function tightened(before: StoredGrant, after: StoredGrant): boolean {
  if (before.dataKinds.some((k) => !after.dataKinds.includes(k))) return true;
  if (before.scope.videoId !== after.scope.videoId && after.scope.videoId !== null) return true;
  if (after.maxCalls !== null && (before.maxCalls === null || after.maxCalls < before.maxCalls)) return true;
  if (after.budgetCap && before.budgetCap && moneyToMicros(after.budgetCap.amount) < moneyToMicros(before.budgetCap.amount)) return true;
  if (after.expiresAt !== null && (before.expiresAt === null || Date.parse(after.expiresAt) < Date.parse(before.expiresAt))) return true;
  return false;
}

function moneyToMicrosOrThrow(money: Money): bigint {
  if (!isCurrency(money.currency)) throw new RpcError('invalid-request', SG.invalidCurrency({ currency: money.currency }));
  try {
    return moneyToMicros(money.amount);
  } catch (error) {
    throw new RpcError('invalid-request', (error as Error).message);
  }
}

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    // Errors from subscribers do not affect the ledger.
  }
}
