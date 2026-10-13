import { AsyncLocalStorage } from 'node:async_hooks';
import type { PipelineDefinition, PipelinePlan } from '@cuccut/jobs';
import type { ModelServices, TextGenerator } from '@cuccut/models';
import { refOf, RpcError, type GrantDataKind, type GrantRequestItem, type Id, type ModelServiceCapability } from '@cuccut/protocol';
import { combinedGrantError, withPendingGrants } from './grant-errors.ts';
import type { GrantService } from './grant-service.ts';
import { RcGrants } from '@cuccut/protocol/messages/runtime-core';

/**
 * Outbound calls in fixed pipelines (architecture design §7.9, §12.5). Pipeline steps call the text model in batches within the process, without going through JobManager submission, so authorization and budget are attached here:
 *
 * - At start (and on retry), check first. Without a grant covering it, or with insufficient quota, `pipelines.start` rejects directly with `GRANT_REQUIRED` / `BUDGET_EXCEEDED`. One rejection covers all the kinds of outbound calls the pipeline makes (`remedy.commands` gives each one). A rejection to a user who is present (the desktop UI) also carries `pendingGrants`.
 * - At execution, each call (including re-sends when the output does not match the contract) reserves once and settles when it ends. Retries also consume budget. If quota runs out midway, this step fails with `BUDGET_EXCEEDED`, and it can be retried with `pipelines.retry` after the limit is raised.
 * - A step's subtask `jobId` is recorded on the reservation (visible in `grants.usage`). The step record itself carries no `grant`, since a step makes many calls.
 * - A pipeline started by an agent within a task charges each call to that task's budget (the task is found through the subtask, `GrantService.begin`). The task budget is not checked at start (§7.8). Steps that send nothing out (download, import) still complete. When the budget is exceeded, the pipeline stops at the outbound step and fails with `TASK_BUDGET_EXCEEDED`.
 */

interface StepGrantContext {
  videoId: Id | null;
  jobId: Id;
}

const stepContext = new AsyncLocalStorage<StepGrantContext>();

/** An outbound call to judge before a pipeline starts: which capability, which Provider and model it goes to, and which data it sends. */
export interface PipelineOutbound {
  capability: ModelServiceCapability;
  providerId: string;
  modelId: string;
  dataKinds: GrantDataKind[];
}

/**
 * Wrapper: while a step runs, it carries the video and subtask, so outbound calls can be matched against the scope of the grant. `outbound` lists the outbound calls to judge before start (when not given, it is the one text generation of the frozen executor). A pipeline can have several kinds, for example text generation and speech synthesis for translation and dubbing.
 */
export function withPipelineGrants<P, R>(
  definition: PipelineDefinition<P, R>,
  grants: GrantService,
  dataKinds: GrantDataKind[],
  outbound?: (plan: PipelinePlan<P>) => PipelineOutbound[],
): PipelineDefinition<P, R> {
  return {
    ...definition,
    async prepare(params, options) {
      const plan = await definition.prepare(params, options);
      // A pipeline started (or retried) by an agent within a task: the task is used only to match grants that belong to it. The task budget is checked at each outbound step (§7.8).
      const taskId = options.submitter ? grants.taskOf(options.submitter) : null;
      const calls = outbound
        ? outbound(plan)
        : [{ capability: 'generateText' as const, providerId: plan.providerId, modelId: plan.modelId, dataKinds }];
      // Judgment before start: with no grant or insufficient quota, no pipeline is created. All kinds of outbound calls are judged first, so one rejection explains everything to be done.
      // A rejection to a user who is present (the tool page) carries the pending items. The client grants them and resubmits with the same commandId (§7.9). Grants are never issued here.
      const items: GrantRequestItem[] = [];
      const refusals: RpcError[] = [];
      const purpose = RcGrants.pipelinePurpose({ label: typeof definition.label === 'function' ? definition.label() : definition.label });
      for (const call of calls) {
        const item = grants.pending(
          {
            capability: call.capability,
            providerId: call.providerId,
            modelId: call.modelId,
            videoId: plan.videoId,
            taskId,
            dataKinds: call.dataKinds,
            purpose: purpose.text,
            purposeRef: refOf(purpose),
          },
          { taskBudget: false },
        );
        if (!item || items.some((other) => sameOutbound(other, item))) continue;
        try {
          grants.assertCovered(
            { recipient: item.recipient, dataKinds: item.dataKinds, videoId: plan.videoId, taskId, estimate: item.estimate },
            item.recipient,
            { taskBudget: false },
          );
        } catch (error) {
          if (!(error instanceof RpcError)) throw error;
          items.push(item);
          refusals.push(error);
        }
      }
      if (refusals.length > 0) {
        const refusal = combinedGrantError(refusals);
        throw grants.present(options.submitter) ? withPendingGrants(refusal, items) : refusal;
      }
      return plan;
    },
    steps: definition.steps.map((step) => ({
      ...step,
      run: (context) => stepContext.run({ videoId: videoOf(context.params), jobId: context.jobId }, () => step.run(context)),
    })),
  };
}

/** Text generation for pipelines: each call is judged, reserved and settled. Calls to local and node models do not go through grants. */
export function grantedTextGenerator(
  text: Pick<TextGenerator, 'generate'>,
  grants: GrantService,
  services: ModelServices,
  dataKinds: GrantDataKind[],
): Pick<TextGenerator, 'generate'> {
  return {
    async generate(request, options) {
      const selection = await services.selectText({
        ...(request.provider !== undefined ? { provider: request.provider } : {}),
        ...(request.model !== undefined ? { model: request.model } : {}),
      });
      if (selection.kind === 'local' || selection.kind === 'node') return text.generate(request, options);
      const context = stepContext.getStore();
      grants.ensureDefault(selection.providerId, selection.label, 'generateText');
      const settle = await grants.begin({
        recipient: selection.providerId,
        dataKinds,
        videoId: context?.videoId ?? null,
        taskId: null,
        estimate: null,
        label: selection.label,
        jobId: context?.jobId ?? null,
      });
      try {
        const result = await text.generate({ ...request, provider: selection.providerId, model: selection.modelId }, options);
        settle({ state: 'completed' });
        return result;
      } catch (error) {
        settle({ state: 'failed' });
        throw error;
      }
    },
  };
}

/** Same recipient, same data, same video: one grant covers both. */
function sameOutbound(a: GrantRequestItem, b: GrantRequestItem): boolean {
  return (
    a.recipient === b.recipient &&
    a.videoId === b.videoId &&
    a.dataKinds.length === b.dataKinds.length &&
    a.dataKinds.every((k) => b.dataKinds.includes(k))
  );
}

function videoOf(params: unknown): Id | null {
  const videoId = (params as { videoId?: unknown } | null)?.videoId;
  return typeof videoId === 'string' ? videoId : null;
}
