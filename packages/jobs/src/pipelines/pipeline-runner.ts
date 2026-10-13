import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  newId,
  nowIso,
  type Id,
  type JobError,
  type JobPhase,
  type JobProgress,
  type JobRecord,
  type JobSubmitter,
  type JobWait,
  type PipelineInfo,
  type PipelineRun,
  type PipelineStepState,
} from '@cuccut/protocol';
import { JobsPipelineRunner as J } from '@cuccut/protocol/messages/jobs/pipeline-runner.ts';
import type { VideoPlace } from '../application-ledger.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';
import { errorRef, errorText, jobError, resolveText, textParts, type JobText, type LazyText } from '../job-text.ts';
import type { JobLibrary } from '../job-library.ts';
import type { HostedJob, HostedJobControl, JobManager } from '../job-manager.ts';
import { silentLog, type JobsLogger } from '../jobs-logger.ts';
import { ResourceExceedsCapacity, type ResourceLease } from '../resource-scheduler.ts';
import {
  PipelineStepError,
  type PipelineDefinition,
  type PipelineStep,
  type PipelineStepContext,
  type StepOutput,
  type StepOutputs,
} from './pipeline.ts';
import { TARGET_STEP, readVideoTarget, type PipelineTargets, type VideoLease } from './video-target.ts';

/**
 * Orchestration of fixed pipelines (architecture design §7.9). The executing subject is `system:pipeline`; no agent session is created:
 *
 * - One execution is a parent task (`kind: 'pipeline'`, whose submitter is the connection or service that started it). Each step is a subtask (`kind: 'pipeline-step'`, `parentJobId` points to the parent task, submitter `{ kind: 'pipeline', id: <parent task> }`).
 *   The parent task's progress is counted by steps (`unit: 'steps'`); its stage and call count follow the step being executed.
 * - Steps run in order and pass results on only through outputs (recorded in the parent task's `pipeline.steps[].output`).
 * - When a step fails, the pipeline stops at that step: the steps completed before it are kept, the parent task becomes `failed`, and `pipeline.stoppedAt` records this step.
 *   `pipelines.retry` re-executes from this step (the parent task's `attempt` goes up by one, and this step gets a new subtask), reusing the outputs of the earlier steps.
 *   Outputs that are no longer usable (`reusable` is false, for example a file in staging is gone) cause a rerun from that step.
 * - Cancelling the parent task first blocks new steps from starting, then aborts the step being executed. Cancelling any subtask is the same as cancelling the whole pipeline.
 * - When the Runtime stops, the step being executed is aborted, and the parent task and subtasks are marked `interrupted`. After a restart, pipelines that did not reach a terminal state are likewise marked `interrupted`; all of them can be retried.
 * - Video target (§7.9): a pipeline that accepts `target` resolves `{ entryId }` at submission and opens it with a Runtime lease. If the entry is wrong or locked by another process, `pipelines.start` rejects directly and no task is created. The target is recorded as the output of the first step. The leases the pipeline holds (those handed over by the step that resolves the target, or by the step that creates a video) are released when this execution ends, is cancelled or fails. Leases exist only in memory: after a Runtime restart the pipeline is `interrupted`, and on retry the leases are re-acquired at the recorded position. Once the step that creates a video has completed, retry does not redo it.
 */

/** The actor that writes video for fixed pipelines (architecture design §7.3, §7.9). */
export const PIPELINE_ACTOR_ID = 'system:pipeline';

export interface PipelineRunnerOptions {
  jobs: JobManager;
  /** The staging directory of Runtime Home; a pipeline uses `<stagingDir>/pipelines/<parent task>`. */
  stagingDir: string;
  /** Each pipeline's parameter type is different. */
  definitions: Array<PipelineDefinition<any, any>>;
  /** User library: the versions of the entries used by a fixed pipeline (`PipelinePlan.library`). Uses the same one as JobManager. */
  library?: Pick<JobLibrary, 'pin' | 'unpin'>;
  /** Resolution, opening and creation of video targets (provided by the Runtime). When not given, `{ entryId }` targets are rejected. */
  targets?: PipelineTargets;
  log?: JobsLogger;
}

interface ActiveRun {
  jobId: Id;
  def: PipelineDefinition<unknown>;
  params: unknown;
  parent: HostedJob;
  abort: AbortController;
  /** Reason for stopping: whichever came first counts (a Runtime stop that follows a cancellation still counts as a cancellation). */
  stop: 'cancelled' | 'interrupted' | null;
  staging: string;
  /** The video lease held by this execution: released when the execution ends (completed, failed, cancelled or interrupted). */
  leases: VideoLease[];
  /** The target resolved at submission (`entryId`): recorded as the output of the `target` step. null for other targets (this step is skipped). */
  target: StepOutput | null;
  /** This execution, including the cleanup after it has ended, has finished. */
  done?: Promise<void>;
}

const RETRYABLE = new Set(['failed', 'cancelled', 'interrupted']);

export class PipelineRunner {
  readonly #jobs: JobManager;
  readonly #defs = new Map<string, PipelineDefinition<unknown>>();
  readonly #staging: string;
  readonly #log: JobsLogger;
  readonly #library: PipelineRunnerOptions['library'];
  readonly #targets: PipelineTargets | null;
  readonly #runs = new Map<Id, ActiveRun>();
  readonly #done = new Set<Promise<void>>();

  constructor(options: PipelineRunnerOptions) {
    this.#jobs = options.jobs;
    this.#staging = path.join(options.stagingDir, 'pipelines');
    this.#log = options.log ?? silentLog;
    this.#library = options.library;
    this.#targets = options.targets ?? null;
    for (const def of options.definitions) {
      if (def.target && def.steps[0]?.name !== TARGET_STEP) throw new Error(`Pipeline "${def.name}" accepts a target, so its first step must be targetStep()`);
      this.#defs.set(def.name, def);
    }
  }

  /**
   * Reconciliation (JobManager has already marked the tasks that did not terminate as `interrupted`): marks the step that was still executing in these pipelines as interrupted and records where it stopped.
   * Deletes staging directories that are no longer needed (only pipelines that can be retried keep theirs).
   */
  async open(): Promise<void> {
    await fs.mkdir(this.#staging, { recursive: true });
    const retryable = new Set<Id>();
    for (const record of this.#jobs.list()) {
      const run = record.pipeline;
      if (record.kind !== 'pipeline' || !run) continue;
      if (RETRYABLE.has(record.state) && record.state !== 'cancelled') retryable.add(record.jobId);
      // JobManager only gives the generic “interrupted”; fill in where it stopped: the step being executed, or the next step when it is between steps.
      if (record.state !== 'interrupted' || record.error?.details) continue;
      const step = run.steps.find((s) => s.status === 'running') ?? run.steps.find((s) => s.status === 'pending');
      const stoppedAt = step?.name ?? run.stoppedAt;
      const steps = run.steps.map((s): PipelineStepState => (s.status === 'running' ? { ...s, status: 'interrupted' } : s));
      await this.#jobs.amend(record.jobId, { pipeline: { ...run, steps, current: null, stoppedAt }, error: interruptedError(stoppedAt) });
    }
    for (const name of await fs.readdir(this.#staging)) {
      if (!retryable.has(name)) await fs.rm(path.join(this.#staging, name), { recursive: true, force: true });
    }
  }

  list(): PipelineInfo[] {
    return [...this.#defs.values()].map((def) => ({
      name: def.name,
      label: String(resolveText(def.label)),
      description: String(resolveText(def.description)),
      steps: def.steps.map((s) => ({ name: s.name, label: String(resolveText(s.label)), optional: s.when !== undefined })),
      paramsSchema: structuredClone(def.paramsSchema),
    }));
  }

  /** Starts a pipeline: validates and freezes the parameters, runs the pre-start checks, and returns the parent task immediately. The same `commandId` starts only once. */
  async start(
    request: { pipeline: string; params: Record<string, unknown>; commandId?: Id },
    submitter: JobSubmitter,
  ): Promise<{ jobId: Id }> {
    const def = this.#defs.get(request.pipeline);
    if (!def) throw new RpcError('not-found', J.unknownPipeline({ name: request.pipeline }));
    if (request.commandId) {
      const existing = this.#jobs.jobForCommand(request.commandId);
      if (existing) return { jobId: existing };
    }
    // The target's lease: released if an error occurs before it is handed to this execution.
    const leases: VideoLease[] = [];
    let handed = false;
    try {
      const { raw, target } = await this.#resolveTarget(def, request.params, leases);
      const plan = await def.prepare(def.parse(raw), { retry: false, submitter });
      if (request.commandId) {
        const existing = this.#jobs.jobForCommand(request.commandId);
        if (existing) return { jobId: existing };
      }
      const jobId = this.#host(def, plan, request.commandId, submitter, leases, target);
      handed = true;
      return { jobId };
    } finally {
      if (!handed) for (const lease of leases) lease.release();
    }
  }

  /**
   * Reads the video target (§7.9): `{ entryId }` is resolved to a video and opened with a lease (the lease goes into `leases`), and the `videoId` is substituted into the parameters handed to `parse`.
   * `{ videoId }` is replaced by the top-level `videoId`; `{ create }` is passed to the pipeline as it is. Pipelines that do not accept a target pass the parameters through as they are.
   */
  async #resolveTarget(
    def: PipelineDefinition<unknown>,
    params: Record<string, unknown>,
    leases: VideoLease[],
  ): Promise<{ raw: Record<string, unknown>; target: StepOutput | null }> {
    if (!def.target) return { raw: params, target: null };
    const target = readVideoTarget(params, def.target);
    const { target: _, videoId: given, ...rest } = params;
    if (!target) return { raw: given === undefined ? rest : { ...rest, videoId: given }, target: null };
    if ('videoId' in target) return { raw: { ...rest, videoId: target.videoId }, target: null };
    if ('create' in target) return { raw: { ...rest, target }, target: null };
    if (!this.#targets)
      throw new RpcError('invalid-request', J.entryTargetUnsupported(), { code: 'PIPELINE_TARGET_UNSUPPORTED' });
    const place = await this.#targets.entry(target.entryId);
    const lease = await this.#targets.lease(place);
    leases.push(lease);
    if (given !== undefined && given !== lease.videoId) {
      throw new RpcError('invalid-request', J.targetMismatch());
    }
    return {
      raw: { ...rest, videoId: lease.videoId },
      target: { entryId: target.entryId, videoId: lease.videoId, place: lease.place },
    };
  }

  /** Registers the parent task and starts execution; the target's lease is handed to this execution. */
  #host(
    def: PipelineDefinition<unknown>,
    plan: Awaited<ReturnType<PipelineDefinition<unknown>['prepare']>>,
    commandId: Id | undefined,
    submitter: JobSubmitter,
    leases: VideoLease[],
    target: StepOutput | null,
  ): Id {
    const now = nowIso();
    const params = structuredClone(plan.params) as Record<string, unknown>;
    const jobId = newId('job');
    // Library entries used: pinned to a version with the parent task as holder (already frozen at resolution; if one was deleted in the meantime, this throws not-found and no task is created).
    let library: JobRecord['library'];
    if (plan.library?.length) {
      if (!this.#library) throw new RpcError('invalid-request', J.noLibrary());
      library = { entries: this.#library.pin(jobId, plan.library) };
    }
    const record: JobRecord = {
      jobId,
      kind: 'pipeline',
      state: 'running',
      phase: 'starting',
      progress: { done: 0, total: def.steps.length, unit: 'steps' },
      videoId: plan.videoId,
      assetId: null,
      assetRevision: null,
      contentHash: plan.contentHash,
      providerId: plan.providerId,
      modelId: plan.modelId,
      bundleId: null,
      inputHash: `sha256:${sha256Hex(canonicalJson({ pipeline: def.name, params }))}`,
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
      ...(library ? { library } : {}),
      pipeline: {
        name: def.name,
        params,
        steps: def.steps.map((s): PipelineStepState => ({ name: s.name, ...stepLabel(s.label), status: 'pending', jobId: null, attempts: 0, output: null })),
        current: null,
        stoppedAt: null,
        summary: null,
      },
    };
    const run = this.#newRun(record.jobId, def, params);
    try {
      run.parent = this.#jobs.host(record, {
        hosted: 'pipeline',
        control: this.#control(run),
        commandId: commandId ?? null,
        leaseVideo: true,
      });
    } catch (error) {
      if (library) void this.#library!.unpin(jobId).catch(() => {});
      throw error;
    }
    run.leases = leases;
    run.target = target;
    this.#log.info('Pipeline started', { jobId: record.jobId, pipeline: def.name });
    this.#launch(run, 0);
    return record.jobId;
  }

  /** Re-executes from the step where it stopped (reusing the outputs of the earlier steps). When it is still running or already completed, `conflict` (`JOB_NOT_RETRYABLE`). */
  async retry(jobId: Id): Promise<{ jobId: Id }> {
    // The parent task has already reached a terminal state but execution is still wrapping up (the terminal state emits its event before it is written to disk). Wait for it to finish, so that a retry right after seeing the failure is not rejected.
    const finishing = this.#runs.get(jobId);
    if (finishing && RETRYABLE.has(this.#jobs.inspect(jobId).state)) await finishing.done;
    const record = this.#jobs.inspect(jobId);
    const run0 = record.pipeline;
    if (record.kind !== 'pipeline' || !run0) throw new RpcError('invalid-request', J.notPipeline());
    if (this.#runs.has(jobId) || !RETRYABLE.has(record.state)) {
      throw new RpcError('conflict', J.notRetryable(), { code: 'JOB_NOT_RETRYABLE', state: record.state });
    }
    const def = this.#defs.get(run0.name);
    if (!def) throw new RpcError('conflict', J.pipelineMissing({ name: run0.name }), { code: 'JOB_NOT_RETRYABLE' });
    // Records are matched by step name (a step that an earlier version did not have: the target-resolution step is recorded as skipped; others run from the start).
    const states = def.steps.map(
      (step): PipelineStepState =>
        run0.steps.find((s) => s.name === step.name) ?? {
          name: step.name,
          ...stepLabel(step.label),
          status: step.name === TARGET_STEP ? 'skipped' : 'pending',
          jobId: null,
          attempts: 0,
          output: null,
        },
    );
    const leases: VideoLease[] = [];
    let handed = false;
    try {
      // First re-acquire the video the pipeline holds (the earlier lease is gone after a Runtime restart), then run the pre-start checks, since the checks read this video.
      await this.#reacquire(def, states, leases);
      await def.prepare(run0.params, { retry: true, submitter: record.submitter });
      if (this.#runs.has(jobId)) throw new RpcError('conflict', J.alreadyRetrying(), { code: 'JOB_NOT_RETRYABLE' });
      const staging = path.join(this.#staging, jobId);
      let from = 0;
      for (; from < def.steps.length; from++) {
        const state = states[from]!;
        if (state.status === 'skipped') continue;
        if (state.status !== 'completed' || !state.output) break;
        const reusable = def.steps[from]!.reusable;
        if (reusable && !(await reusable(state.output, { params: run0.params, staging, artifacts: this.#jobs.artifacts }))) break;
      }
      if (this.#runs.has(jobId)) throw new RpcError('conflict', J.alreadyRetrying(), { code: 'JOB_NOT_RETRYABLE' });
      // Steps that hold a video (target resolution, video creation) that have completed are not redone; the later steps rerun from `from` as usual.
      const steps = states.map((s, i): PipelineStepState =>
        i < from || (def.steps[i]!.holdsVideo && s.status === 'completed') ? s : { ...s, status: 'pending', output: null },
      );
      this.#reopen(jobId, record, def, steps, from, leases);
      handed = true;
      return { jobId };
    } finally {
      if (!handed) for (const lease of leases) lease.release();
    }
  }

  /** On retry, re-acquires the lease at the position recorded by the completed `holdsVideo` step. Refuses the retry if the video that is opened is not the original one. */
  async #reacquire(def: PipelineDefinition<unknown>, states: PipelineStepState[], leases: VideoLease[]): Promise<void> {
    for (const [index, step] of def.steps.entries()) {
      const state = states[index]!;
      if (!step.holdsVideo || state.status !== 'completed' || !state.output) continue;
      const { videoId, place } = state.output as { videoId?: unknown; place?: unknown };
      if (typeof videoId !== 'string' || !place || typeof place !== 'object') continue;
      if (!this.#targets) throw new RpcError('conflict', J.cannotOpenTarget(), { code: 'JOB_NOT_RETRYABLE' });
      const lease = await this.#targets.lease(place as VideoPlace);
      leases.push(lease);
      if (lease.videoId !== videoId) {
        throw new RpcError('conflict', J.targetReplaced(), { code: 'STALE_JOB_INPUT', videoId });
      }
    }
  }

  #reopen(
    jobId: Id,
    record: JobRecord,
    def: PipelineDefinition<unknown>,
    steps: PipelineStepState[],
    from: number,
    leases: VideoLease[],
  ): void {
    const run0 = record.pipeline!;
    // Re-pins the frozen library versions (the earlier pins are gone after a Runtime restart); versions that no longer exist are skipped, since their content was already written into the artifact at start.
    for (const entry of record.library?.entries ?? []) {
      try {
        this.#library?.pin(jobId, [entry]);
      } catch (error) {
        this.#log.warn('Could not pin library versions on retry', {
          jobId,
          entry: `${entry.library}/${entry.id}@${entry.version}`,
          error: String(error),
        });
      }
    }

    const run = this.#newRun(jobId, def, run0.params);
    run.leases = leases;
    run.parent = this.#jobs.reopen(jobId, {
      control: this.#control(run),
      leaseVideo: true,
      patch: {
        phase: 'starting',
        progress: { done: from, total: def.steps.length, unit: 'steps' },
        pipeline: { ...run0, steps, current: null, stoppedAt: null, summary: null },
      },
    });
    this.#log.info('Pipeline retry', { jobId, pipeline: def.name, from: def.steps[from]?.name ?? null });
    this.#launch(run, from);
  }

  /** Waits for all in-flight pipelines to stop (used by tests and on stop). */
  async idle(): Promise<void> {
    while (this.#done.size > 0) await Promise.allSettled([...this.#done]);
  }

  #newRun(jobId: Id, def: PipelineDefinition<unknown>, params: unknown): ActiveRun {
    // `parent` is filled in after registration.
    return {
      jobId,
      def,
      params,
      parent: null as unknown as HostedJob,
      abort: new AbortController(),
      stop: null,
      staging: path.join(this.#staging, jobId),
      leases: [],
      target: null,
    };
  }

  #control(run: ActiveRun): HostedJobControl {
    return {
      cancel: () => {
        run.stop ??= 'cancelled';
        run.abort.abort();
      },
      interrupt: () => {
        run.stop ??= 'interrupted';
        run.abort.abort();
      },
    };
  }

  #launch(run: ActiveRun, from: number): void {
    this.#runs.set(run.jobId, run);
    const done: Promise<void> = this.#drive(run, from)
      .catch(async (error: unknown) => {
        this.#log.error('Pipeline failed', { jobId: run.jobId, error: String(error) });
        await run.parent.finish('failed', { error: jobError('INTERNAL', J.pipelineFailed()) });
      })
      .finally(() => {
        // Releases the library versions pinned by this execution (JobManager also releases them when it terminates the task; releasing twice has no effect).
        void this.#library?.unpin(run.jobId).catch(() => {});
        // Releases the video this execution holds (when no one else has it open, it is closed after a grace period).
        for (const lease of run.leases.splice(0)) lease.release();
        if (this.#runs.get(run.jobId) === run) this.#runs.delete(run.jobId);
        this.#done.delete(done);
      });
    run.done = done;
    this.#done.add(done);
  }

  async #drive(run: ActiveRun, from: number): Promise<void> {
    const { def } = run;
    await fs.mkdir(run.staging, { recursive: true });
    for (let index = from; index < def.steps.length; index++) {
      // Barrier for cancellation: after stopping, no new steps are started.
      if (run.stop) return this.#end(run, run.stop, index, null);
      const step = def.steps[index]!;
      if (def.target && step.name === TARGET_STEP) {
        if ((await this.#recordTarget(run, index, step)) !== 'completed') return;
        continue;
      }
      // A step that holds a video has completed (kept on retry): it is not redone.
      if (step.holdsVideo && run.parent.record().pipeline!.steps[index]?.status === 'completed') continue;
      const outputs = this.#outputs(run);
      if (step.when && !step.when(run.params, outputs)) {
        this.#setStep(run, index, { status: 'skipped', output: null }, true);
        continue;
      }
      const outcome = await this.#runStep(run, index, step, outputs);
      if (outcome !== 'completed') return;
    }
    if (run.stop) return this.#end(run, run.stop, def.steps.length, null);
    let completion: Awaited<ReturnType<PipelineDefinition<unknown>['complete']>>;
    try {
      completion = await def.complete({ params: run.params, outputs: this.#outputs(run), artifacts: this.#jobs.artifacts });
    } catch (error) {
      return this.#end(run, 'failed', def.steps.length, jobErrorOf(error, this.#log));
    }
    const current = run.parent.record().pipeline!;
    run.parent.update({
      pipeline: { ...current, current: null, summary: completion.summary },
      phase: 'done',
      progress: this.#stepProgress(run, def.steps.length),
    });
    await fs.rm(run.staging, { recursive: true, force: true }).catch(() => {});
    this.#log.info('Pipeline completed', { jobId: run.jobId, pipeline: def.name });
    await run.parent.finish('completed', { result: completion.result });
  }

  /** The target-resolution step: a target already resolved at submission (`entryId`) is recorded as completed, and a subtask is opened to note it. Other targets are recorded as skipped. */
  async #recordTarget(run: ActiveRun, index: number, step: PipelineStep<unknown>): Promise<'completed' | 'stopped'> {
    if (!run.target) {
      this.#setStep(run, index, { status: 'skipped', output: null }, true);
      return 'completed';
    }
    let child: HostedJob;
    try {
      child = this.#child(run, index, resolveText(step.label), 1);
    } catch {
      run.stop ??= 'interrupted';
      await this.#end(run, run.stop, index, null);
      return 'stopped';
    }
    await child.finish('completed');
    this.#setStep(run, index, { status: 'completed', jobId: child.jobId, attempts: 1, output: run.target }, true, {
      progress: this.#stepProgress(run, index + 1),
    });
    return 'completed';
  }

  /** Runs one step: opens a subtask, executes it, terminates the subtask according to the result, and records the output. */
  async #runStep(run: ActiveRun, index: number, step: PipelineStep<unknown>, outputs: StepOutputs): Promise<'completed' | 'stopped'> {
    const attempts = (run.parent.record().pipeline!.steps[index]?.attempts ?? 0) + 1;
    let child: HostedJob;
    try {
      child = this.#child(run, index, resolveText(step.label), attempts);
    } catch {
      // The Runtime is stopping.
      run.stop ??= 'interrupted';
      await this.#end(run, run.stop, index, null);
      return 'stopped';
    }
    this.#setStep(run, index, { status: 'running', jobId: child.jobId, attempts }, true, { phase: 'starting' });

    const report = (job: HostedJob) => (progress: JobProgress | null, phase?: JobPhase) => {
      job.update({ progress, ...(phase ? { phase } : {}) });
      const base = this.#stepProgress(run, index);
      run.parent.update({ ...(phase ? { phase } : {}), progress: progress?.calls ? { ...base, calls: progress.calls } : base });
    };
    const context: PipelineStepContext<unknown> = {
      params: run.params,
      parentJobId: run.jobId,
      jobId: child.jobId,
      attempt: attempts,
      run: { runId: run.jobId, runGeneration: String(run.parent.record().attempt) },
      signal: run.abort.signal,
      outputs,
      staging: run.staging,
      artifacts: this.#jobs.artifacts,
      progress: report(child),
      warn: (warning) => {
        child.update({ warnings: [...child.record().warnings, warning] }, { persist: true });
        run.parent.update({ warnings: [...run.parent.record().warnings, warning] }, { persist: true });
      },
      spawn: async (label, fn) => {
        const extra = this.#child(run, index, J.subtask({ step: resolveText(step.label), label }), attempts);
        try {
          const value = await fn({ jobId: extra.jobId, progress: report(extra) });
          await extra.finish('completed');
          return value;
        } catch (error) {
          await extra.finish(run.stop ?? 'failed', this.#stopError(run, step.name, error));
          throw error;
        }
      },
      hold: (lease) => {
        run.leases.push(lease);
        run.parent.update({ videoId: lease.videoId }, { persist: true });
      },
    };

    let lease: ResourceLease | null = null;
    try {
      lease = await this.#admit(run, child, step, outputs);
      const { output, result } = await step.run(context);
      lease?.release();
      lease = null;
      await child.finish('completed', result ? { result } : {});
      this.#setStep(run, index, { status: 'completed', output }, true, { progress: this.#stepProgress(run, index + 1) });
      return 'completed';
    } catch (error) {
      lease?.release();
      const state = run.stop ?? 'failed';
      const patch = this.#stopError(run, step.name, error);
      await child.finish(state, patch);
      this.#setStep(run, index, { status: state }, false);
      await this.#end(run, state, index, patch.error ?? null);
      return 'stopped';
    }
  }

  /**
   * A step that declares its peak resource needs first goes through resource-scheduling admission (§7.6, §7.7). While it waits, the subtask and parent task record what they are waiting for; cancellation and stop withdraw the request.
   * If this machine can never fit it, the step fails with `RESOURCE_ADMISSION_UNSATISFIABLE`.
   */
  async #admit(run: ActiveRun, child: HostedJob, step: PipelineStep<unknown>, outputs: StepOutputs): Promise<ResourceLease | null> {
    if (!step.resources) return null;
    const onWait = (wait: JobWait | null) => {
      for (const job of [child, run.parent]) {
        const record = job.record();
        if (wait) job.update({ wait });
        else if (record.wait) job.update({ wait: undefined });
      }
    };
    try {
      return await this.#jobs.resources.acquire(
        { owner: child.jobId, label: `${run.def.name}:${step.name}`, ...step.resources(run.params, outputs) },
        { signal: run.abort.signal, onWait },
      );
    } catch (error) {
      if (error instanceof ResourceExceedsCapacity) {
        throw new PipelineStepError(error.code, errorText(error), { dimensions: error.dimensions });
      }
      throw error;
    } finally {
      onWait(null);
    }
  }

  #child(run: ActiveRun, index: number, labelText: JobText, attempts: number): HostedJob {
    const parent = run.parent.record();
    const step = run.def.steps[index]!;
    const now = nowIso();
    const { text: label, ref: labelRef } = textParts(labelText);
    const record: JobRecord = {
      jobId: newId('job'),
      kind: 'pipeline-step',
      state: 'running',
      phase: 'starting',
      progress: null,
      videoId: parent.videoId,
      assetId: null,
      assetRevision: null,
      contentHash: parent.contentHash,
      providerId: parent.providerId,
      modelId: parent.modelId,
      bundleId: null,
      inputHash: `sha256:${sha256Hex(canonicalJson({ parent: run.jobId, step: step.name, attempt: attempts, label }))}`,
      submitter: { kind: 'pipeline', id: run.jobId },
      attempt: attempts,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
      parentJobId: run.jobId,
      step: { pipeline: run.def.name, name: step.name, label, ...(labelRef ? { labelRef } : {}), index },
    };
    // Cancelling or interrupting any one subtask is the same as cancelling or interrupting the whole pipeline.
    return this.#jobs.host(record, { hosted: 'pipeline-step', control: this.#control(run) });
  }

  /** The error when stopped: cancellation has no error, an interruption is `JOB_INTERRUPTED`, and a failure is the step's error. */
  #stopError(run: ActiveRun, stepName: string, error: unknown): { error?: JobError } {
    if (run.stop === 'cancelled') return {};
    if (run.stop === 'interrupted') return { error: interruptedError(stepName) };
    return { error: jobErrorOf(error, this.#log) };
  }

  /** The parent task stops: records the step where it stopped. Deletes staging on completion and cancellation; keeps it for retry on failure and interruption. */
  async #end(run: ActiveRun, state: 'failed' | 'cancelled' | 'interrupted', index: number, error: JobError | null): Promise<void> {
    const current = run.parent.record().pipeline!;
    const stoppedAt = run.def.steps[index]?.name ?? null;
    run.parent.update({ pipeline: { ...current, current: null, stoppedAt } }, { persist: true });
    if (state === 'cancelled') await fs.rm(run.staging, { recursive: true, force: true }).catch(() => {});
    const parentError: JobError | undefined =
      state === 'cancelled'
        ? undefined
        : state === 'interrupted'
          ? interruptedError(stoppedAt)
          : error
            ? withStep(error, stoppedAt)
            : undefined;
    this.#log.info('Pipeline stopped', { jobId: run.jobId, state, step: stoppedAt, code: parentError?.code });
    await run.parent.finish(state, parentError ? { error: parentError } : {});
  }

  #setStep(
    run: ActiveRun,
    index: number,
    patch: Partial<PipelineStepState>,
    persist: boolean,
    extra: { phase?: JobPhase; progress?: JobProgress } = {},
  ): void {
    const current = run.parent.record().pipeline!;
    const steps = current.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    const pipeline: PipelineRun = { ...current, steps, current: patch.status === 'running' ? index : current.current };
    run.parent.update(
      { pipeline, ...(extra.phase ? { phase: extra.phase } : {}), progress: extra.progress ?? this.#stepProgress(run, index) },
      { persist },
    );
  }

  #stepProgress(run: ActiveRun, done: number): JobProgress {
    return { done, total: run.def.steps.length, unit: 'steps' };
  }

  #outputs(run: ActiveRun): StepOutputs {
    const steps = run.parent.record().pipeline!.steps;
    const outputs: Record<string, StepOutput | null> = {};
    for (const step of steps) if (step.status === 'completed' || step.status === 'skipped') outputs[step.name] = step.output;
    return outputs;
  }
}

function interruptedError(step: string | null): JobError {
  return jobError('JOB_INTERRUPTED', J.interrupted(), step ? { step } : undefined);
}

function withStep(error: JobError, step: string | null): JobError {
  if (!step) return error;
  const details = error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : {};
  return { ...error, details: { ...details, step } };
}

/** Converts the error thrown by a step into a task error (command and protocol spec §11.3). Errors that are not recognized are recorded as `INTERNAL`; the original text goes only to the log. */
export function jobErrorOf(error: unknown, log: JobsLogger = silentLog): JobError {
  if (error instanceof RpcError) {
    const details = error.details && typeof error.details === 'object' ? (error.details as Record<string, unknown>) : undefined;
    const code = typeof details?.code === 'string' ? details.code : error.code.toUpperCase().replace(/-/g, '_');
    return withRef({ code, message: error.message, ...(details ? { details } : {}) }, error);
  }
  if (error instanceof Error) {
    const coded = error as Error & { code?: unknown; details?: unknown };
    if (typeof coded.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(coded.code)) {
      const details =
        coded.details && typeof coded.details === 'object' && Object.keys(coded.details).length > 0 ? coded.details : undefined;
      return withRef({ code: coded.code, message: error.message, ...(details ? { details } : {}) }, error);
    }
  }
  log.error('Step failed', { error: String(error) });
  return jobError('INTERNAL', J.stepFailed());
}

/** When an error carries a message reference, it is recorded in the task error (`messageRef`). */
function withRef(jobErr: JobError, error: unknown): JobError {
  const ref = errorRef(error);
  return ref ? { ...jobErr, messageRef: ref } : jobErr;
}

/** A step name and its reference (recorded in `PipelineStepState`). */
function stepLabel(label: LazyText): Pick<PipelineStepState, 'label' | 'labelRef'> {
  const { text, ref } = textParts(resolveText(label));
  return ref ? { label: text, labelRef: ref } : { label: text };
}
