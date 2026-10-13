import { z } from 'zod';
import { RpcError, type Id, type JobRecord, type JobState } from '@cuccut/protocol';
import {
  DUB_PIPELINE,
  isTerminal,
  LINK_IMPORT_PIPELINE,
  TRANSCODE_PIPELINE,
  TRANSCRIBE_PIPELINE,
  TRANSLATE_PIPELINE,
  TRANSLATE_SUBTITLES_PIPELINE,
  type JobManager,
  type PipelineRunner,
} from '@cuccut/jobs';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { approvalField, confirmSummary, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * Job tools (agent surface design §4.3, §6.2): inspect a job (`jobs_inspect`), cancel a job you submitted (`jobs_cancel`), wait for a
 * job to finish (`jobs_wait`), list visible jobs (`jobs_list`), and rerun a failed fixed pipeline (`jobs_retry`, i.e. the gateway's
 * `pipelines.retry`). Which jobs are visible is decided by the scope (`visibleJob` / `visibleJobs`): for a session, the ones it
 * submitted and those on videos opened from its source directory; for the external service, the ones it submitted; for the
 * terminal, all of them. Available on all three surfaces.
 *
 * Cancelling is a write (rejected in plan mode and at the `read` level, confirmed each time at the `ask` level), its risk level is
 * `command`, and only jobs you submitted can be cancelled.
 *
 * `jobs_wait` returns the same result as `jobs_inspect` (built directly with this group's `jobs_inspect`, no separate summary), plus
 * `settled`. It waits at most 50 seconds: common MCP clients time out requests at 60 seconds; if the job is not done, call it again.
 */

export interface JobToolsDeps {
  jobs: Pick<JobManager, 'settled' | 'cancel'>;
  pipelines: Pick<PipelineRunner, 'retry'>;
  scope: ToolScope;
}

/** Maximum wait (seconds). */
export const JOB_WAIT_MAX_SEC = 50;

/** Job states, one-to-one with the protocol's `JobState` (type checking fails if one is missing). */
const JOB_STATES = ['queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted', 'needs-reconciliation'] as const;
type MissingState = Exclude<JobState, (typeof JOB_STATES)[number]>;
const _allStates: MissingState extends never ? true : never = true;
void _allStates;

/** `jobs_list` state filter: one of `JobState`, or `settled` (finished, any terminal state). */
const STATE_FILTERS = [...JOB_STATES, 'settled'] as const;

const jobIdArg = z.string().min(1).max(200).describe('The jobId returned on submission');

const schemas = {
  jobs_inspect: z.strictObject({ jobId: jobIdArg }),
  jobs_cancel: z.strictObject({ jobId: jobIdArg }),
  jobs_wait: z.strictObject({
    jobId: jobIdArg,
    timeoutSec: z
      .number()
      .int()
      .min(1)
      .max(JOB_WAIT_MAX_SEC)
      .optional()
      .describe(`Optional. Maximum seconds to wait, 1 to ${JOB_WAIT_MAX_SEC}, default ${JOB_WAIT_MAX_SEC}; if the job has not finished by then, returns its current state (settled: false)`),
  }),
  jobs_list: z.strictObject({
    video: z.string().min(1).max(200).optional().describe('Optional. Only list jobs on this video: videoId'),
    state: z
      .enum(STATE_FILTERS)
      .optional()
      .describe(`Optional. Only list jobs in this state: ${JOB_STATES.join(', ')}; settled means finished (everything except queued and running)`),
    limit: z.number().int().min(1).max(100).optional().describe('Optional. Maximum number to list, default 20, at most 100'),
  }),
  jobs_retry: z.strictObject({
    jobId: jobIdArg.describe('The jobId of a failed, cancelled or interrupted fixed pipeline (given the jobId of a step in a pipeline, reruns that pipeline)'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  jobs_inspect: {
    title: 'Inspect job',
    description: [
      'Inspects a job\'s state, progress and results.',
      'State (queued, running, completed, failed, cancelled, interrupted), phase and progress, the frozen provider, model and parameters, error and remedy; on completion, every output (artifactId, media facts, the assetId from importing into a video; documentId for a transcription).',
      'Read-only; triggers no new computation. You can see jobs you submitted in this session and jobs on videos opened in the working directory.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Inspect a job', args: { jobId: 'job_1' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'jobId',
  },
  jobs_cancel: {
    title: 'Cancel job',
    description: [
      'Cancels a job you submitted in this session.',
      'A queued job is cancelled immediately; a running one waits for the provider to stop. Returns the final state.',
      'When the user stops the task, this session\'s queued or running jobs are cancelled with it.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: 'Cancel a job', args: { jobId: 'job_1' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'jobId',
  },
  jobs_wait: {
    title: 'Wait for job',
    description: [
      `Waits for a job to finish and returns the same record as jobs_inspect. Waits at most ${JOB_WAIT_MAX_SEC} seconds.`,
      `Blocks until the job reaches a terminal state (completed, failed, cancelled, interrupted, needs-reconciliation) or times out; a timeout is not an error: settled is false, and per next you call jobs_wait again to keep waiting. The limit is ${JOB_WAIT_MAX_SEC} seconds (timeoutSec also defaults to ${JOB_WAIT_MAX_SEC}), to stay under the 60-second request timeout of common clients.`,
      'Read-only; triggers no new computation; the visible jobs are the same as for jobs_inspect. Prefer it for waiting on a job; do not poll by calling jobs_inspect repeatedly.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Wait for a job to finish', args: { jobId: 'job_1' } },
      { title: 'Wait at most 10 seconds', args: { jobId: 'job_1', timeoutSec: 10 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'jobId',
  },
  jobs_list: {
    title: 'List jobs',
    description: [
      'Lists the jobs you can see, newest first.',
      'Each entry is a summary: jobId, kind, state, phase and progress, video, provider and model, who submitted it, times and error code; use jobs_inspect for details and jobs_wait to wait for completion. The steps of a fixed pipeline are folded into the pipeline and not listed separately.',
      'A session sees the jobs it submitted and jobs on videos opened in the working directory; the external service sees only the ones it submitted.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Recent jobs', args: {} },
      { title: 'Jobs still running on one video', args: { video: 'video_0123456789abcdef', state: 'running' } },
      { title: 'The five most recent failures', args: { state: 'failed', limit: 5 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  jobs_retry: {
    title: 'Rerun failed pipeline',
    description: [
      'Reruns a fixed pipeline from the step that failed. Pipelines are multi-step jobs such as transcription, translation, dubbing or download.',
      'Only failed, cancelled or interrupted pipelines can be rerun; steps already completed reuse their earlier outputs. A single model job (speech, image, transcription) cannot be rerun; submit it again.',
      'Returns the jobId (the same as before, with attempt incremented); then use jobs_wait to wait for it to finish. You can only rerun pipelines you submitted.',
    ].join('\n'),
    annotations: { destructiveHint: false },
    effect: 'job',
    examples: [{ title: 'Rerun a failed pipeline', args: { jobId: 'job_1' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'jobId',
  },
};

/** The agent's next step when a job fails (the recovery rules in the command and protocol spec §11.3). */
const FAILURE_NEXT: Record<string, string> = {
  PROVIDER_AUTH_FAILED:
    'The provider rejected the key: ask the user to check or replace the key in the model configuration in Settings (or cuccut models configure <providerId> --key-stdin --verify). Do not retry, and do not switch providers to work around it.',
  PROVIDER_QUOTA_EXCEEDED: 'The provider rate-limited the request or the quota is used up: tell the user, and let the user decide when to resubmit or whether to use another service. Do not retry automatically.',
  PROVIDER_REJECTED: 'The provider rejected this request: adjust the parameters or switch models per message, then resubmit; do not retry unchanged.',
  PROVIDER_UNAVAILABLE: 'The provider is temporarily unavailable: resubmit later, or ask the user to decide whether to use another service.',
  MODEL_OUTPUT_INVALID: 'The model output failed validation and there is no artifact: you may resubmit once (as a new job); if it keeps failing, tell the user.',
  STALE_JOB_INPUT:
    'The job\'s input or target video has changed (e.g. the video was closed): the artifact is kept but was not written to the video. Run videos_inspect again; the generated outputs can be imported with edits_apply importAsset + artifactId (from outputs), without regenerating.',
  APPLY_FAILED:
    'The result was generated, but writing it to the video was rejected: the artifact is kept. Run videos_inspect again to see the current state and tell the user; if needed, import it again with edits_apply importAsset + artifactId (from outputs), without regenerating.',
  JOB_INTERRUPTED: 'The job was interrupted (the Runtime stopped or restarted): resubmit if needed.',
  TASK_PROTECTED:
    'This step\'s write touched a "do not change" range the user set in the task contract (the protections touched are in details); nothing was written to the video, and the results of earlier steps are kept. Do not work around it another way; tell the user and let the user decide whether to adjust the protected range or handle it themselves.',
  EXPORT_VALIDATION_FAILED: 'The exported file failed validation and was not published (details lists the problems): tell the user; do not retry unchanged.',
  EXPORT_RENDER_FAILED: 'ffmpeg failed to render and nothing was published: pass details on to the user; do not work around it another way.',
  EXPORT_TOOL_MISSING: 'ffmpeg / ffprobe is missing: pass details.remedy on to the user and let the user install it; do not install it yourself or work around it.',
  EXPORT_DESTINATION_EXISTS: 'The target file already existed at publish time: export again with a different fileName; if it really should be replaced, ask the user first.',
  EXPORT_DESTINATION_UNWRITABLE: 'The target directory was not writable at publish time: export again to a different directory, or tell the user.',
  ASSET_MISSING: 'An asset file went missing before the export started: tell the user and ask them to relink it.',
  ASSET_CHANGED: 'A linked asset was modified before the export started: tell the user, ask them to confirm and relink it, then export again.',
  RESOURCE_ADMISSION_UNSATISFIABLE:
    'This work needs more memory, GPU memory or disk than this machine can provide (details.dimensions): tell the user; you may narrow the scope or lower the output size and resubmit, but do not retry unchanged.',
};

export class JobTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: JobToolsDeps;

  constructor(deps: JobToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'jobs_inspect':
        return this.#inspect(args as Args<'jobs_inspect'>, principal);
      case 'jobs_cancel':
        return this.#cancel(args as Args<'jobs_cancel'>, principal);
      case 'jobs_wait':
        return this.#wait(args as Args<'jobs_wait'>, principal);
      case 'jobs_list':
        return this.#list(args as Args<'jobs_list'>, principal);
      case 'jobs_retry':
        return this.#retry(args as Args<'jobs_retry'>, principal);
      default:
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    }
  }

  // ---- Inspect and cancel ----

  async #inspect(args: Args<'jobs_inspect'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    return digestJob(await scope.visibleJob(args.jobId, access));
  }

  async #cancel(args: Args<'jobs_cancel'>, principal: ToolPrincipal) {
    const { scope, jobs } = this.#deps;
    const access = scope.authorize(principal, true);
    const record = await scope.visibleJob(args.jobId, access);
    if (!scope.owns(record, access)) {
      throw new ToolError('JOB_NOT_OWNED', 'You can only cancel jobs you submitted in this session; jobs submitted by others are for the user to decide');
    }
    const approval = await scope.confirm(access, {
      tool: 'jobs_cancel',
      ...confirmSummary(RcAgentTools.cancelJobSummary({ jobId: record.jobId })),
      risk: 'command',
    });
    const { state } = await jobs.cancel(record.jobId);
    return { jobId: record.jobId, state, ...approvalField(approval) };
  }

  // ---- Wait, list, rerun ----

  async #wait(args: Args<'jobs_wait'>, principal: ToolPrincipal) {
    const { scope, jobs } = this.#deps;
    const access = scope.authorize(principal, false);
    const record = await scope.visibleJob(args.jobId, access);
    const timeoutSec = args.timeoutSec ?? JOB_WAIT_MAX_SEC;
    if (!isTerminal(record.state)) {
      await untilSettled(jobs.settled(record.jobId), timeoutSec * 1000, principal.kind === 'service' ? principal.signal : undefined);
    }
    const inspected = await this.#inspect({ jobId: record.jobId }, principal);
    const settled = isTerminal(inspected.state as JobState);
    if (settled) return { ...inspected, settled };
    const waiting = inspected.waiting as { detail?: string } | undefined;
    return {
      ...inspected,
      settled,
      next: `Not finished after waiting ${timeoutSec} seconds${waiting?.detail ? ` (still waiting for resources: ${waiting.detail})` : ''}: call jobs_wait again to keep waiting. Do not resubmit, and do not claim it is done.`,
    };
  }

  async #list(args: Args<'jobs_list'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    const limit = args.limit ?? 20;
    const matched = (await scope.visibleJobs(access))
      .filter((r) => !r.parentJobId)
      .filter((r) => args.video === undefined || r.videoId === args.video)
      .filter((r) => args.state === undefined || (args.state === 'settled' ? isTerminal(r.state) : r.state === args.state))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      jobs: matched.slice(0, limit).map(summaryOf),
      total: matched.length,
      truncated: matched.length > limit,
      next:
        matched.length > limit
          ? `Only the newest ${limit} of ${matched.length} are listed: add state or video to narrow it down, or raise limit. Use jobs_inspect for details and jobs_wait to wait for completion.`
          : 'Use jobs_inspect for details and jobs_wait to wait for completion.',
    };
  }

  async #retry(args: Args<'jobs_retry'>, principal: ToolPrincipal) {
    const { scope, pipelines } = this.#deps;
    const access = scope.authorize(principal, true);
    let record = await scope.visibleJob(args.jobId, access);
    // A step in a pipeline: rerun its pipeline.
    if (record.kind === 'pipeline-step' && record.parentJobId) record = await scope.visibleJob(record.parentJobId, access);
    if (record.kind !== 'pipeline' || !record.pipeline) {
      throw new ToolError(
        'JOB_NOT_RETRYABLE',
        'This job is not a fixed pipeline and cannot be rerun: submit a single model job (speech, image, transcription) again (as a new job)',
        { kind: record.kind },
      );
    }
    if (!scope.owns(record, access)) {
      throw new ToolError('JOB_NOT_OWNED', 'You can only rerun pipelines you submitted; ones submitted by others are for the user to decide');
    }
    if (!isTerminal(record.state)) {
      throw new ToolError('JOB_NOT_RETRYABLE', 'The pipeline has not finished yet: use jobs_wait to wait for it; rerun it only if it fails', { state: record.state });
    }
    const approval = await scope.confirm(access, {
      tool: 'jobs_retry',
      ...confirmSummary(
        RcAgentTools.retryPipelineSummary({ jobId: record.jobId, pipeline: record.pipeline.name, attempt: record.attempt + 1 }),
      ),
      risk: 'command',
    });
    const { jobId } = await pipelines.retry(record.jobId).catch((error: unknown) => {
      throw toolErrorOf(error);
    });
    return {
      jobId,
      pipeline: record.pipeline.name,
      attempt: record.attempt + 1,
      ...approvalField(approval),
      next: 'The pipeline restarted from the step where it stopped (same jobId, attempt incremented): use jobs_wait to wait for it to finish; it is done only when state is completed. Do not resubmit.',
    };
  }
}

/** Waits until the job settles, the timeout elapses or the request is aborted, whichever comes first; timeout and abort are not errors. */
async function untilSettled(settled: Promise<unknown>, timeoutMs: number, signal: AbortSignal | undefined): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    await Promise.race([
      settled.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
      new Promise<void>((resolve) => {
        if (!signal) return;
        if (signal.aborted) return resolve();
        onAbort = resolve;
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}

/** One `jobs_list` entry: the summary part of `jobs_inspect`, without parameters, outputs or next. */
function summaryOf(record: JobRecord) {
  return {
    jobId: record.jobId,
    kind: record.kind,
    ...(record.pipeline ? { pipeline: record.pipeline.name } : {}),
    state: record.state,
    phase: record.phase,
    progress: record.progress,
    attempt: record.attempt,
    videoId: record.videoId,
    providerId: record.providerId,
    modelId: record.modelId,
    submittedBy: record.submitter.kind === 'agent' ? 'agent' : record.submitter.kind === 'service' ? 'external' : 'user',
    createdAt: record.createdAt,
    endedAt: record.endedAt,
    ...(record.error ? { error: { code: record.error.code, message: record.error.message } } : {}),
    ...(record.wait ? { waiting: { reason: record.wait.reason, detail: record.wait.detail } } : {}),
  };
}

/** Turns a service rejection into a tool error: `details.code` (`JOB_NOT_RETRYABLE`, ...) becomes the tool error code. */
function toolErrorOf(error: unknown): unknown {
  if (error instanceof RpcError && typeof error.details === 'object' && error.details !== null) {
    const { code, ...rest } = error.details as Record<string, unknown>;
    if (typeof code === 'string') return new ToolError(code, error.message, rest);
  }
  return error;
}

/** The next step after a fixed pipeline completes: where the results are (`pipeline.summary`) and what can come next. Unknown pipelines get the generic text. */
export function pipelineNext(name: string, summary: Record<string, unknown> | null, videoId: Id | null): string | null {
  switch (name) {
    case TRANSCRIBE_PIPELINE:
      if (summary && 'files' in summary && !('documentId' in summary)) {
        return 'Transcription completed without creating a video: pipeline.summary.files are the TXT and SRT transcripts written (the same as the paths in outputs). Tell the user where they are; to read the content, read these files directly.';
      }
      return 'Transcription completed: pipeline.summary.documentId is the newly written transcript (a speech document, can be passed to documents_read), and summary.captions is the caption layer created (when status is created, documentId is the caption document); when a video was created, summary.videoId is the new video. Next you can use documents_read, captions_create or export.';
    case TRANSLATE_PIPELINE:
      return 'Translation completed: pipeline.summary.documentId is the newly written translation (a translation document), and summary.captions is the target-language caption layer created. Use export to get a file.';
    case TRANSLATE_SUBTITLES_PIPELINE:
      return 'Translation completed: pipeline.summary.file (outputs[0].path) is the translated subtitle file. Tell the user where it is.';
    case DUB_PIPELINE:
      return 'Dubbing completed: the dub is on a new dub track (pipeline.summary.trackId), summary.translation is the translation used, and summary.units says how many sentences were placed, how many were not synthesized and why. Tell the user the result; use export for the finished video.';
    case TRANSCODE_PIPELINE:
      return 'Transcode completed: the paths in outputs (pipeline.summary.files) are the output files; the original files are untouched. Tell the user where they are.';
    case LINK_IMPORT_PIPELINE:
      // Download-only link import: the files are already written (the paths in outputs), and so are the transcript and subtitles.
      if (videoId === null) {
        return 'Download completed, not imported into a video: the paths in outputs are the downloaded files (the media, plus a TXT transcript and SRT subtitles when transcribed). Tell the user where they are; to read the transcript, read its path directly, or if you cannot, save its artifactId into the working directory with artifacts_save. To translate, do it yourself, write a new file in the working directory, then put it in the downloads directory with downloads_save.';
      }
      return `${
        summary?.createdVideo === true
          ? 'Download completed and a new video was created: summary.videoId is the new video, the downloaded media is placed on the timeline (main track, starting at 0), and pipeline.summary.assetId is the imported asset'
          : 'Download completed and imported into an existing video: summary.videoId is that video, and pipeline.summary.assetId is the imported asset (placed on the main track if the timeline was empty, otherwise only in the asset library; to use it, place it with edits_apply addItem)'
      }${
        summary && typeof summary.transcribeJobId === 'string'
          ? `; the transcription was written to the video's speech document (${
              typeof summary.documentId === 'string' ? 'summary.documentId' : 'in the documents from videos_inspect'
            })${linkImportCaptionsNext(summary.captions)}`
          : ''
      }.`;
    default:
      return null;
  }
}

/** Next step for the link import's caption step: if created, points to the caption document; if not (disabled, not on the timeline, ...), points to captions_create. */
function linkImportCaptionsNext(captions: unknown): string {
  const status = captions && typeof captions === 'object' ? (captions as { status?: unknown }).status : undefined;
  if (status === 'created') return ', and the caption layer was created too (the documentId in summary.captions is the caption document)';
  return '; use captions_create to add a caption layer';
}

/** The model-facing view of a job record: the frozen choices and parameters, error and next step, and every output. */
function digestJob(record: JobRecord) {
  const generation = record.generation
    ? record.generation.capability === 'synthesizeSpeech'
      ? (({ text, ...rest }) => ({ ...rest, textChars: [...text].length }))(record.generation)
      : record.generation.capability === 'generateText'
        ? (({ messages, responseFormat, ...rest }) => ({
            ...rest,
            messages: messages.length,
            inputChars: messages.reduce((sum, m) => sum + [...m.content].length, 0),
            responseFormat: responseFormat.type,
          }))(record.generation)
        : record.generation
    : undefined;
  const outputs = record.result?.outputs?.map((o) => ({
    artifactId: o.artifactId,
    mediaType: o.mediaType,
    assetId: o.assetId,
    media: o.media,
    // Export: the published file, format and validation result.
    ...(o.path !== undefined ? { path: o.path } : {}),
    ...(o.format !== undefined ? { format: o.format } : {}),
    ...(o.validation !== undefined ? { validation: o.validation } : {}),
  }));
  return {
    jobId: record.jobId,
    kind: record.kind,
    state: record.state,
    phase: record.phase,
    progress: record.progress,
    attempt: record.attempt,
    providerId: record.providerId,
    modelId: record.modelId,
    videoId: record.videoId,
    ...(record.assetId ? { assetId: record.assetId, assetRevision: record.assetRevision } : {}),
    ...(generation ? { parameters: generation } : {}),
    ...(record.export
      ? { export: { settings: record.export.settings, videoRevision: record.export.videoRevision, destination: record.export.destination } }
      : {}),
    submittedBy: record.submitter.kind === 'agent' ? 'agent' : record.submitter.kind === 'service' ? 'external' : 'user',
    createdAt: record.createdAt,
    endedAt: record.endedAt,
    ...(record.error
      ? {
          error: {
            code: record.error.code,
            message: record.error.message,
            ...(record.error.details !== undefined ? { details: record.error.details } : {}),
          },
        }
      : {}),
    ...(record.warnings.length ? { warnings: record.warnings } : {}),
    // Attempts to apply to the video (state and reason only) and the three cancellation facts (§7.2, §7.4): visible to the agent, but it cannot reconcile them.
    ...(record.applications?.length
      ? {
          applications: record.applications.map((a) => ({
            state: a.state,
            videoId: a.videoId,
            ...(a.error ? { reason: a.error.message } : {}),
          })),
        }
      : {}),
    ...(record.cancellation ? { cancellation: record.cancellation } : {}),
    // Fixed pipeline (top-level verbs transcribe, translate, dub, transcode, download): each step's status and the summary on completion (new transcript, caption layer, files).
    ...(record.pipeline
      ? {
          pipeline: {
            name: record.pipeline.name,
            steps: record.pipeline.steps.map((step) => ({ name: step.name, status: step.status })),
            stoppedAt: record.pipeline.stoppedAt,
            summary: record.pipeline.summary,
          },
        }
      : {}),
    // What a queued job is waiting for (§7.6, §7.7): concurrency in the same queue, or resources on the machine.
    ...(record.wait ? { waiting: { reason: record.wait.reason, detail: record.wait.detail, since: record.wait.since } } : {}),
    ...(record.result
      ? record.kind === 'transcribe'
        ? { result: { documentId: record.result.documentId, artifactId: record.result.artifactId } }
        : record.result.text
          ? { result: { artifactId: record.result.artifactId, text: record.result.text } }
          : { outputs: outputs ?? [] }
      : {}),
    next: nextFor(record),
  };
}

function nextFor(record: JobRecord): string {
  switch (record.state) {
    case 'queued':
    case 'running':
      if (record.wait?.reason === 'resources') {
        return `Not started yet; waiting for resources (${record.wait.detail}): it starts automatically when earlier jobs finish. Wait with jobs_wait again in a while; do not resubmit, and do not cancel and start over.`;
      }
      return 'Not finished yet: use jobs_wait to wait for it. Do not resubmit, and do not claim it is done.';
    case 'completed':
      if (record.kind === 'export') {
        return 'Export completed: outputs holds each file\'s path (already written to disk) and validation result. Tell the user the paths; mention any warnings too.';
      }
      if (record.kind === 'transcribe') {
        return record.result?.documentId
          ? 'The transcription was written to the video\'s speech document (documentId), visible in the documents from videos_inspect.'
          : 'Transcription completed, but no speech or audio track was detected, so no document was written (see warnings).';
      }
      if (record.kind === 'generateText') {
        return 'The text was published as an artifact (artifactId), and result.text.preview is its opening; if warnings contains output-truncated, the content is incomplete.';
      }
      if (record.kind === 'pipeline' && record.pipeline) {
        const done = pipelineNext(record.pipeline.name, record.pipeline.summary, record.videoId);
        if (done) return done;
      }
      if (record.videoId !== null) {
        const imported = record.result?.outputs?.every((o) => o.assetId !== null) ?? false;
        return imported
          ? 'The outputs were imported into the video as candidate assets (assetId) and are not on the timeline yet. To use one, first get the revision with videos_inspect, then edits_apply addItem (with this assetId as asset).'
          : 'The outputs were generated, but some could not be imported into the video (assetId is null): the artifacts are kept. Run videos_inspect again to see the video\'s state and tell the user.';
      }
      return 'The outputs were only published as artifacts (artifactId), not imported into any video, and there is no file in the working directory. To put one in a video, use edits_apply {"type":"importAsset","artifactId":…} (no regeneration); when you need the file itself, use artifacts_save.';
    case 'failed':
      if (record.kind === 'export' && record.result?.outputs?.length) {
        return 'The export only partly completed: the files in outputs were published, and error.details.failed lists the files not exported and why. Tell the user exactly that.';
      }
      // The result touched the task's protected range (§3.2): only the user can decide whether to apply it; the agent must not import it again to work around that.
      if ((record.error?.details as { reason?: unknown } | undefined)?.reason === 'TASK_PROTECTED') {
        return 'The result was generated, but it touched a "do not change" range the user set in the task contract (details.protections), so it was not written to the video; the artifact is kept as a candidate. Do not import it again with edits_apply or work around it another way; tell the user and let the user decide whether to apply it (the user can apply it in the task list).';
      }
      return FAILURE_NEXT[record.error?.code ?? ''] ?? 'The job failed: tell the user the error; do not work around it another way.';
    case 'cancelled':
      return record.result
        ? 'The job was stopped: the result was generated, but after stopping it is no longer applied to the video automatically (the artifact is kept as a candidate; see applications). Tell the user and let the user decide whether to use it.'
        : 'The job was cancelled and has no result.';
    case 'needs-reconciliation':
      return 'The outbound call had no result when the Runtime stopped: it is unknown whether the remote side ran it or charged for it. Do not resubmit; tell the user to decide in the task list whether to retry or abandon it (the agent cannot do this for them).';
    case 'interrupted':
      return FAILURE_NEXT.JOB_INTERRUPTED!;
  }
}
