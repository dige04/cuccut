import { TopicLog, type Logger } from '@cuccut/harness';
import type { JobAdmission, JobAdmissionRequest } from '@cuccut/jobs';
import { capabilityLabel, type ModelServices } from '@cuccut/models';
import {
  CAPABILITY_DATA_KINDS,
  MODEL_SERVICE_CAPABILITIES,
  PROVIDER_ENABLE_DATA_KINDS,
  RpcError,
  estimateCallCost,
  refOf,
  type ApprovalGrantChoice,
  type Grant,
  type GrantCreateParams,
  type GrantDataKind,
  type GrantRequestItem,
  type GrantRevokeResult,
  type GrantUpdateParams,
  type GrantUsageReport,
  type GrantsEvent,
  type GrantsSnapshot,
  type Id,
  type JobError,
  type JobGrantUse,
  type JobRecord,
  type JobState,
  type JobSubmitter,
  type Localized,
  type MessageRef,
  type ModelCost,
  type ModelInfoBase,
  type ModelServiceCapability,
  type Money,
  type ProviderKind,
  type TaskBudgetLimits,
  type TaskBudgetPolicy,
} from '@cuccut/protocol';
import { GrantStore, type GrantCall, type GrantEvaluation, type GrantReservation } from '@cuccut/runtime-storage';
import {
  grantRevokedJobError,
  grantRpcError,
  retryBudgetJobError,
  taskBudgetRpcError,
  approvableReason,
  withPendingGrants,
  type GrantErrorContext,
} from './grant-errors.ts';
import { RcGrants } from '@cuccut/protocol/messages/runtime-core';
import { jobMessage } from '../localized.ts';

/**
 * Authorization and budgets for outbound data transfer (architecture design §12.5, §7.8): a service built on the ledger (`GrantStore`).
 *
 * - JobManager admission (`JobAdmission`): when submitting online or agent-provider tasks, it checks and reserves, re-checks before execution starts, and settles when finished;
 * - Before approval, tools and external services use `plan` to decide whether this call needs a grant and whether the quota is sufficient. After approval, `issueForApproval` issues the grant;
 * - When a provider is enabled, a default grant is issued (§6.8 migration rule): data kinds are derived from capabilities (`PROVIDER_ENABLE_DATA_KINDS`), no amount cap, count-based with unknown amount. Revoked when disabled or removed;
 * - Task budgets (§3.2, §7.8): each outbound call must also pass the budget of its task, in addition to the grant. Jobs submitted by agents, fixed flows started within a task, and their sub-steps all count toward that task (a flow's sub-task finds the agent task that submitted it via its parent task);
 * - `grants` topic: issuance, usage, and revocation of grants.
 */

export interface GrantServiceOptions {
  file: string;
  services: ModelServices;
  log: Logger;
  now?: () => Date;
}

/** Input to `plan`: the capability, provider, and scope of one model call. */
export interface OutboundCall {
  capability: ModelServiceCapability;
  /** Provider given by the caller; when not given, the effective default for this capability is used. */
  providerId?: string | undefined;
  modelId?: string | null | undefined;
  videoId: Id | null;
  taskId: Id | null;
  dataKinds?: GrantDataKind[];
  quantity?: { count?: number; chars?: number };
  purpose: string;
  /** When the Runtime writes `purpose`, this is its reference: pending items in approval and the issued grant carry it, and the UI regenerates it in the current language. */
  purposeRef?: MessageRef;
}

/** The purpose the Runtime writes: text and its reference (`purpose` / `purposeRef` of `OutboundCall`). */
export function outboundPurpose(purpose: Localized): Pick<OutboundCall, 'purpose' | 'purposeRef'> {
  return { purpose: purpose.text, purposeRef: refOf(purpose) };
}

/**
 * Result of `plan`:
 * - `none`: no grant needed (local or node), or the provider cannot be resolved or is not enabled (rejected at submission, so no data is sent out);
 * - `covered`: a grant covers it and the quota is sufficient;
 * - `approval`: the user must approve this outbound transfer (`item` goes into the approval).
 * If the quota is insufficient (`BUDGET_EXCEEDED`), it throws directly and does not enter approval: the budget cap applies in every access mode.
 */
export type OutboundPlan =
  | { status: 'none'; kind: ProviderKind | null }
  | { status: 'covered'; kind: ProviderKind; grant: Grant }
  | { status: 'approval'; kind: ProviderKind; item: GrantRequestItem };

interface Judged {
  status: 'judged';
  provider: ProviderInfo;
  dataKinds: GrantDataKind[];
  estimate: Money | null;
  evaluation: GrantEvaluation;
}

/** One item for the user to approve: why a grant is needed, according to the evaluation result. */
function requestItem(call: OutboundCall, judged: Judged): GrantRequestItem {
  const { provider, dataKinds, estimate, evaluation } = judged;
  return {
    capability: call.capability,
    dataKinds,
    recipient: provider.providerId,
    videoId: call.videoId,
    purpose: call.purpose,
    ...(call.purposeRef ? { purposeRef: call.purposeRef } : {}),
    reason:
      evaluation.status === 'unverifiable'
        ? 'unverifiable'
        : evaluation.status === 'exhausted'
          ? 'exhausted'
          : evaluation.status === 'none' && evaluation.revoked
            ? 'revoked'
            : 'none',
    cost: provider.model.cost ?? 'unknown',
    estimate,
    maxCalls: null,
  };
}

interface ProviderInfo {
  providerId: string;
  kind: ProviderKind;
  label: string;
  enabled: boolean;
  model: ModelInfoBase & { cost?: ModelCost };
}

export class GrantService implements JobAdmission {
  readonly store: GrantStore;
  readonly topic: TopicLog<GrantsSnapshot, GrantsEvent>;
  readonly #services: ModelServices;
  readonly #log: Logger;
  #jobs: (() => JobRecord[]) | null = null;
  #job: ((jobId: Id) => JobRecord | null) | null = null;
  #present: (submitter: JobSubmitter) => boolean = () => false;

  private constructor(store: GrantStore, options: GrantServiceOptions) {
    this.store = store;
    this.#services = options.services;
    this.#log = options.log.child('grants');
    this.topic = new TopicLog<GrantsSnapshot, GrantsEvent>(() => ({ grants: store.list({ includeEnded: true }) }), '0');
    store.onChange((change) =>
      this.topic.publish(
        'grant' in change ? { type: 'grant.upsert', grant: change.grant } : { type: 'grant.removed', grantId: change.removed },
      ),
    );
  }

  static async open(options: GrantServiceOptions): Promise<GrantService> {
    const store = await GrantStore.open(options.file, { log: options.log.child('grants'), ...(options.now ? { now: options.now } : {}) });
    return new GrantService(store, options);
  }

  /** The source of a task record (the usage report lists the tasks that used a grant; a flow's sub-task finds the agent task it belongs to through this). */
  attachJobs(jobs: () => JobRecord[], job?: (jobId: Id) => JobRecord | null): void {
    this.#jobs = jobs;
    this.#job = job ?? ((jobId) => jobs().find((r) => r.jobId === jobId) ?? null);
  }

  /**
   * Which submitters are present users (on-the-spot grant in the tool page, §7.9): the Runtime registers desktop UI connections. When a present user starts a flow or submits a task directly, a rejection for a missing grant or insufficient quota carries the pending items (`pendingGrants`). The client asks the user to confirm, issues the grant, and resubmits. This never issues grants itself. If unset, nobody is present.
   */
  setPresence(present: (submitter: JobSubmitter) => boolean): void {
    this.#present = present;
  }

  present(submitter: JobSubmitter | undefined): boolean {
    return submitter !== undefined && this.#present(submitter);
  }

  // ---- Task budget (§3.2, §7.8) ----

  /** A task's budget and usage; null when none. */
  taskBudget(taskId: Id): TaskBudgetPolicy | null {
    return this.store.taskBudget(taskId);
  }

  /** Creates or changes a task's budget cap. */
  setTaskBudget(taskId: Id, limits: TaskBudgetLimits): TaskBudgetPolicy {
    return this.store.setTaskBudget(taskId, limits);
  }

  /**
   * The agent task of the submitter: an agent's submission belongs to its task. Sub-tasks of a flow, and Jobs submitted within a flow, look up through the parent task. Others (connections, system, nodes, external services) are not part of a task.
   */
  taskOf(submitter: JobSubmitter): Id | null {
    let current: JobSubmitter | undefined = submitter;
    for (let depth = 0; current && depth < 8; depth++) {
      if (current.kind === 'agent') return current.taskId;
      if (current.kind !== 'pipeline') return null;
      current = this.#job?.(current.id)?.submitter;
    }
    return null;
  }

  /** The agent task a Job (a flow's step sub-task) belongs to. */
  taskOfJob(jobId: Id | null): Id | null {
    if (jobId === null) return null;
    const record = this.#job?.(jobId);
    return record ? this.taskOf(record.submitter) : null;
  }

  /** On startup: after the task ledger is reconciled, leftover reservations that no task claims (in-process calls, and tasks not yet flushed to disk) are settled according to whether they started. */
  settleOrphans(): void {
    const count = this.store.settleOrphans();
    if (count > 0) this.#log.warn('Settled outbound reservations left over from last time', { count });
  }

  // ---- Default grant when a provider is enabled (§6.8) ----

  /**
   * Reconciles against the model service's configuration: each enabled online and agent provider has one default grant (issued once per enablement; not reissued after the user revokes it). For a provider that is disabled or removed, the default grant it received when enabled is revoked.
   */
  reconcile(): void {
    const store = this.#services.store;
    const ids = new Set(store.providerIds());
    const kinds = this.#providerKinds();
    for (const providerId of ids) {
      const config = store.configView(providerId);
      if (!config.enabled) {
        if (this.store.revokeProviderGrants(providerId) > 0) this.#log.info('Provider turned off; default grant revoked', { providerId });
        continue;
      }
      const info = kinds.get(providerId);
      if (!info || info.dataKinds.length === 0) continue;
      this.store.ensureProviderGrant({
        recipient: providerId,
        dataKinds: info.dataKinds,
        enabledAt: enabledKey(config.enabledAt),
        label: info.label,
      });
    }
    for (const grant of this.store.list()) {
      if (grant.origin === 'provider-enable' && !ids.has(grant.recipient)) {
        this.store.revokeProviderGrants(grant.recipient);
        this.#log.info('Provider removed; default grant revoked', { providerId: grant.recipient });
      }
    }
  }

  /** Before a call, fills in its provider's default grant if it is missing (the view has not been computed yet, or it was just enabled and not reconciled). */
  ensureDefault(providerId: string, label: string, capability: ModelServiceCapability): void {
    const config = this.#services.store.configView(providerId);
    if (!config.enabled) return;
    const kinds = new Set(this.#providerKinds().get(providerId)?.dataKinds ?? []);
    for (const kind of PROVIDER_ENABLE_DATA_KINDS[capability]) kinds.add(kind);
    this.store.ensureProviderGrant({ recipient: providerId, dataKinds: [...kinds], enabledAt: enabledKey(config.enabledAt), label });
  }

  /** The online and agent providers in the view: the data kinds derived from what they offer. */
  #providerKinds(): Map<string, { label: string; dataKinds: GrantDataKind[] }> {
    const view = this.#services.view();
    const out = new Map<string, { label: string; dataKinds: GrantDataKind[] }>();
    for (const capability of MODEL_SERVICE_CAPABILITIES) {
      for (const provider of view[capability].providers) {
        if (provider.kind !== 'online' && provider.kind !== 'agent') continue;
        const entry = out.get(provider.providerId) ?? { label: provider.label, dataKinds: [] };
        for (const kind of PROVIDER_ENABLE_DATA_KINDS[capability]) if (!entry.dataKinds.includes(kind)) entry.dataKinds.push(kind);
        out.set(provider.providerId, entry);
      }
    }
    return out;
  }

  // ---- Tools and external services: judgment before approval ----

  /** Whether this call needs a grant and whether the quota is sufficient (does not reserve). Throws `BUDGET_EXCEEDED` when the quota is insufficient. */
  plan(call: OutboundCall): OutboundPlan {
    const judged = this.#judge(call);
    if (judged.status === 'none') return judged;
    const { provider, dataKinds, evaluation } = judged;
    if (evaluation.status === 'covered') return { status: 'covered', kind: provider.kind, grant: evaluation.grant };
    if (evaluation.status === 'exhausted') {
      throw grantRpcError(evaluation, { recipient: provider.providerId, label: provider.label, dataKinds, videoId: call.videoId });
    }
    return { status: 'approval', kind: provider.kind, item: requestItem(call, judged) };
  }

  /**
   * Judgment before a flow starts (on-the-spot grant in the tool page, §7.9): the items this call needs the user to approve. Insufficient quota (`exhausted`) counts too. Null when no grant is needed or an existing grant covers it. Does not reserve. If the task budget is insufficient, it still throws: approving an outbound transfer cannot loosen the task budget. `taskBudget: false` ignores the task budget (flow start, §7.8). `taskId` is still used to match grants that belong only to this task.
   */
  pending(call: OutboundCall, options: { taskBudget?: boolean } = {}): GrantRequestItem | null {
    const judged = this.#judge(call, options);
    if (judged.status === 'none' || judged.evaluation.status === 'covered') return null;
    return requestItem(call, judged);
  }

  #judge(call: OutboundCall, options: { taskBudget?: boolean } = {}): { status: 'none'; kind: ProviderKind | null } | Judged {
    const provider = this.#provider(call.capability, call.providerId, call.modelId);
    if (!provider || !provider.enabled) return { status: 'none', kind: provider?.kind ?? null };
    if (provider.kind === 'local' || provider.kind === 'node') return { status: 'none', kind: provider.kind };
    this.ensureDefault(provider.providerId, provider.label, call.capability);
    const dataKinds = call.dataKinds ?? [...CAPABILITY_DATA_KINDS[call.capability]];
    const estimate = estimateCallCost(provider.model.price, call.quantity ?? {});
    // If the task budget is insufficient, reject directly and do not enter approval: even if the user approves this one outbound transfer, the task budget cannot be loosened.
    const task = options.taskBudget === false ? null : this.store.evaluateTask({ taskId: call.taskId, estimate });
    if (task) throw taskBudgetRpcError(task, { recipient: provider.providerId, label: provider.label, dataKinds, videoId: call.videoId });
    const evaluation = this.store.evaluate({
      recipient: provider.providerId,
      dataKinds,
      videoId: call.videoId,
      taskId: call.taskId,
      estimate,
    });
    return { status: 'judged', provider, dataKinds, estimate, evaluation };
  }

  /**
   * Issues grants after approval is given (§12.5). Returns the grant this call must cite: the “this time only” grant, or the newly issued persistent grant.
   * - If `choice` is not given, or `persist: false`: a grant covering only this call (amount unknown). If `taskId` is given, it belongs only to that task.
   * - `persist: true`: a persistent grant (by default covering only this video). If an amount cap is given but this model cannot estimate amounts, the persistent grant is still issued, and this call uses a separate “this time only” grant (amount unknown), so that this call is not rejected with `BUDGET_UNVERIFIABLE`.
   */
  issueForApproval(
    item: GrantRequestItem,
    choice: ApprovalGrantChoice | undefined,
    context: { approvalId: Id | null; taskId: Id | null },
  ): Grant {
    const once = () =>
      this.store.create({
        dataKinds: item.dataKinds,
        recipient: item.recipient,
        scope: { videoId: item.videoId },
        purpose: item.purpose,
        ...(item.purposeRef ? { purposeRef: item.purposeRef } : {}),
        budgetMode: 'per-call-unknown-cost',
        origin: 'approval',
        once: true,
        approvalId: context.approvalId,
        taskId: context.taskId,
      });
    if (!choice?.persist) return once();
    const budgetCap = choice.budgetCap ?? null;
    const persistent = this.store.create({
      dataKinds: item.dataKinds,
      recipient: item.recipient,
      scope: { videoId: choice.scope === 'all' ? null : item.videoId },
      purpose: item.purpose,
      ...(item.purposeRef ? { purposeRef: item.purposeRef } : {}),
      budgetMode: budgetCap ? 'estimate-cap' : 'per-call-unknown-cost',
      budgetCap,
      // The count cap on a persistent grant depends only on the user's choice. The count the task requests applies only to grants that belong to this task alone.
      maxCalls: choice.maxCalls ?? null,
      expiresAt: choice.expiresAt ?? null,
      origin: 'approval',
      approvalId: context.approvalId,
    });
    this.#log.info('Persistent grant issued on approval', { grantId: persistent.grantId, recipient: item.recipient });
    if (budgetCap && (!item.estimate || item.estimate.currency !== budgetCap.currency)) return once();
    return persistent;
  }

  /**
   * After a merged approval (`grants_request`) is allowed: each item gets a grant belonging only to this task (its count cap is the requested count), or a persistent grant is issued according to the user's choice.
   */
  issueForTask(
    items: GrantRequestItem[],
    choice: ApprovalGrantChoice | undefined,
    context: { approvalId: Id | null; taskId: Id },
  ): Grant[] {
    return items.map((item) => {
      if (choice?.persist) return this.issueForApproval(item, choice, context);
      return this.store.create({
        dataKinds: item.dataKinds,
        recipient: item.recipient,
        scope: { videoId: item.videoId },
        purpose: item.purpose,
        ...(item.purposeRef ? { purposeRef: item.purposeRef } : {}),
        budgetMode: 'per-call-unknown-cost',
        maxCalls: item.maxCalls,
        origin: 'approval',
        approvalId: context.approvalId,
        taskId: context.taskId,
      });
    });
  }

  /**
   * If submission is rejected after issuing (parameter check, model unavailable, or quota taken by concurrent calls): the call did not happen, so the unused “this time only” grants issued for it are revoked, so an unusable one is not left in the list. Persistent grants are untouched, since the user chose to issue them.
   */
  discardUnused(grantId: Id): void {
    const grant = this.store.get(grantId);
    if (!grant || !grant.once || grant.state !== 'active') return;
    if (grant.usage.calls > 0 || grant.usage.reservedCalls > 0) return;
    this.store.revoke(grantId);
  }

  /** Submitted with a just-issued grant: when submission is rejected, the unused “this time only” grant is revoked (`discardUnused`), and the error is rethrown as is. */
  async submitWith<T>(hint: { grantId?: Id } | undefined, submit: () => Promise<T>): Promise<T> {
    try {
      return await submit();
    } catch (error) {
      if (hint?.grantId) this.discardUnused(hint.grantId);
      throw error;
    }
  }

  // ---- JobManager admission (§7.8) ----

  admit(request: JobAdmissionRequest): JobGrantUse | null {
    if (request.providerKind === 'local' || request.providerKind === 'node') return null;
    this.ensureDefault(request.providerId, request.label, request.capability);
    const dataKinds = request.hint?.dataKinds ?? [...CAPABILITY_DATA_KINDS[request.capability]];
    const estimate = estimateCallCost(request.model.price, request.quantity);
    try {
      return this.#reserve(
        {
          recipient: request.providerId,
          dataKinds,
          videoId: request.videoId,
          taskId: this.taskOf(request.submitter),
          estimate,
          ...(request.hint?.grantId ? { grantId: request.hint.grantId } : {}),
        },
        { label: request.label, jobId: request.jobId },
      );
    } catch (error) {
      // A present user submitting directly (voice, image, and text generation in the tool page): the rejection carries this one pending outbound item (the §7.9 on-the-spot grant).
      const reason = approvableReason(error);
      if (reason === null || !this.present(request.submitter)) throw error;
      const purpose = RcGrants.toolPurpose({ tool: capabilityLabel(request.capability) });
      throw withPendingGrants(error, [
        {
          capability: request.capability,
          dataKinds,
          recipient: request.providerId,
          videoId: request.videoId,
          purpose: purpose.text,
          purposeRef: refOf(purpose),
          reason,
          cost: (request.model as ModelInfoBase & { cost?: ModelCost }).cost ?? 'unknown',
          estimate,
          maxCalls: null,
        },
      ]);
    }
  }

  async start(use: JobGrantUse): Promise<JobError | null> {
    const started = await this.store.start(use.reservationId);
    if (started.ok) return null;
    if (started.unsaved) {
      return { code: 'INTERNAL', ...jobMessage(RcGrants.ledgerUnsaved()), details: { grantId: use.grantId } };
    }
    // The provider was disabled while queued: the default grant is revoked with it, but the real reason is that the provider is unavailable (consistent with the error when no grant exists).
    const grant = started.grant;
    if (grant?.origin === 'provider-enable' && !this.#services.store.configView(grant.recipient).enabled) {
      return {
        code: 'MODEL_LOAD_FAILED',
        ...jobMessage(RcGrants.providerDisabledBeforeStart()),
        details: { providerId: grant.recipient },
      };
    }
    return grantRevokedJobError(grant);
  }

  begun(use: JobGrantUse): boolean {
    return this.store.started(use.reservationId);
  }

  retry(use: JobGrantUse, call: { providerId: string; videoId: Id | null; submitter: JobSubmitter }): JobGrantUse | JobError {
    const previous = this.settle(use, { state: 'failed' }).settled!;
    try {
      const next = this.#reserve(
        {
          recipient: call.providerId,
          dataKinds: use.dataKinds,
          videoId: call.videoId,
          taskId: this.taskOf(call.submitter),
          estimate: use.reserved.amount,
          grantId: use.grantId,
        },
        { label: call.providerId, jobId: null },
      );
      return { ...next, retries: [...(use.retries ?? []), previous] };
    } catch (error) {
      if (error instanceof RpcError) return retryBudgetJobError(error);
      throw error;
    }
  }

  settle(use: JobGrantUse, outcome: { state: JobState; reported?: Money | null }): JobGrantUse {
    const settlement = this.store.settle(
      use.reservationId,
      outcome.state === 'completed' ? { kind: 'completed', reported: outcome.reported ?? null } : { kind: 'failed' },
    );
    return { ...use, settled: settlement ?? { calls: 0, amount: null, basis: 'released', at: new Date().toISOString() } };
  }

  /** In-process call (per-batch translation in a fixed flow): checks and reserves, starts, and returns a settlement to call when finished. Throws if it does not pass. */
  async begin(
    call: GrantCall & { label: string; jobId: Id | null },
  ): Promise<(outcome: { state: JobState; reported?: Money | null }) => void> {
    // A call made within a flow step does not know its own task: it finds the agent task that submitted the flow via its sub-task, and counts toward that task's budget.
    const taskId = call.taskId ?? this.taskOfJob(call.jobId);
    const use = this.#reserve({ ...call, taskId }, { label: call.label, jobId: call.jobId });
    const refused = await this.start(use);
    if (refused) {
      this.settle(use, { state: 'failed' });
      throw new RpcError('forbidden', refused.message, { code: refused.code, ...(refused.details as object) });
    }
    let done = false;
    return (outcome) => {
      if (done) return;
      done = true;
      this.settle(use, outcome);
    };
  }

  /** Has a covering grant and sufficient quota; otherwise throws the matching error (does not reserve). `taskBudget: false` ignores the task budget (same as `pending`). */
  assertCovered(call: GrantCall, label: string = call.recipient, options: { taskBudget?: boolean } = {}): void {
    const ctx = { recipient: call.recipient, label, dataKinds: call.dataKinds, videoId: call.videoId };
    const evaluation = this.store.evaluate(call);
    if (evaluation.status !== 'covered') throw grantRpcError(evaluation, ctx);
    if (options.taskBudget === false) return;
    const task = this.store.evaluateTask(call);
    if (task) throw taskBudgetRpcError(task, ctx);
  }

  #reserve(call: GrantCall, context: { label: string; jobId: Id | null }): JobGrantUse {
    const admission = this.store.admit(call, { jobId: context.jobId });
    if (!admission.ok) {
      const ctx: GrantErrorContext = { recipient: call.recipient, label: context.label, dataKinds: call.dataKinds, videoId: call.videoId };
      if ('task' in admission) throw taskBudgetRpcError(admission.task, ctx);
      throw grantRpcError(admission.evaluation as Exclude<typeof admission.evaluation, { status: 'covered' }>, ctx);
    }
    return useOf(admission.reservation, call.dataKinds);
  }

  // ---- Methods ----

  list(params: { recipient?: string; videoId?: Id; includeEnded?: boolean }): { grants: Grant[] } {
    return { grants: this.store.list(params) };
  }

  create(params: GrantCreateParams): { grant: Grant } {
    const grant = this.store.create({ ...params, origin: 'user' });
    this.#log.info('Grant issued', { grantId: grant.grantId, recipient: grant.recipient, dataKinds: grant.dataKinds });
    return { grant };
  }

  update(params: GrantUpdateParams): { grant: Grant } {
    return { grant: this.store.update(params) };
  }

  revoke(grantId: Id): GrantRevokeResult {
    const result = this.store.revoke(grantId);
    this.#log.info('Grant revoked', { grantId, running: result.runningJobs.length });
    return result;
  }

  usage(grantId: Id): GrantUsageReport {
    const grant = this.store.get(grantId);
    if (!grant) throw new RpcError('not-found', RcGrants.noSuchGrant());
    const jobs = (this.#jobs?.() ?? [])
      .filter((r) => r.grant?.grantId === grantId)
      .map((r) => ({ jobId: r.jobId, state: r.state, reserved: r.grant!.reserved, settled: r.grant!.settled }));
    return { grant, jobs };
  }

  flush(): Promise<void> {
    return this.store.flush();
  }

  // ---- Internal ----

  /** Providers and models in the capability view (synchronous; uses the most recently computed view). */
  #provider(capability: ModelServiceCapability, providerId: string | undefined, modelId: string | null | undefined): ProviderInfo | null {
    const view = this.#services.view()[capability];
    const id = providerId ?? view.effective?.providerId;
    if (id === undefined) return null;
    const provider = view.providers.find((p) => p.providerId === id);
    if (!provider) return null;
    const wanted = modelId ?? (providerId === undefined ? view.effective?.modelId : undefined);
    const model = (wanted !== undefined ? provider.models.find((m) => m.modelId === wanted) : undefined) ??
      provider.models.find((m) => m.default) ??
      provider.models[0] ?? { modelId: wanted ?? '', label: wanted ?? '' };
    const enabled = provider.kind === 'local' || provider.kind === 'node' || provider.config?.enabled === true;
    return { providerId: provider.providerId, kind: provider.kind, label: provider.label, enabled, model };
  }
}

/**
 * Identifier for one enablement: default grants are issued once per enablement (not reissued after the user revokes them; reissued only when re-enabled). Providers enabled in versions from before the enablement time was recorded have no `enabledAt`: they use a fixed identifier, so after the upgrade they still get the default grant, and a revocation is not reissued on restart.
 */
const LEGACY_ENABLED_AT = 'legacy';

function enabledKey(enabledAt: string | null): string {
  return enabledAt ?? LEGACY_ENABLED_AT;
}

function useOf(reservation: GrantReservation, dataKinds: readonly GrantDataKind[]): JobGrantUse {
  return {
    grantId: reservation.grantId,
    generation: reservation.generation,
    reservationId: reservation.reservationId,
    budgetMode: reservation.budgetMode,
    dataKinds: [...dataKinds],
    reserved: { calls: 1, amount: reservation.amount },
    settled: null,
  };
}
