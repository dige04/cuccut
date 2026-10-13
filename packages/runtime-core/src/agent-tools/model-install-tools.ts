import { z } from 'zod';
import { defaultTranscribeBundle, type ModelCatalog } from '@cuccut/models';
import { RpcError, type Localized, type ModelBundleStatus, type ModelInstallPlan } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { ModelInstallService } from '../models/model-install-service.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { commandIdArg } from './video-tools.ts';

/**
 * Downloading local models (architecture design §3.5, §6.3): before doing something that needs a local model, the agent
 * submits "download the model" as a prerequisite step.
 *
 * First plan to get the size, then confirm at `command` risk (the access mode decides whether to ask the user; the
 * confirmation text states size and source); once confirmed, submit the install job; the result carries the size.
 * `surfaces` are the tool bridge and the CLI: the MCP external service offers no install or removal (it is not in the
 * design's external list; letting external clients trigger multi-GB downloads is administration of this machine, for
 * the same reason the web service does not expose `models.install`). Removal and repair happen only in the UI and CLI.
 *
 * The same group also has `models_list` (local model bundles and their state, the gateway's `models.list`, on all three
 * surfaces) and `models_test` (runs fixed samples to check one model bundle, the gateway's `models.test`; it uses local
 * compute, so like `models_install` it is not exposed to MCP).
 *
 * For music generation bundles (backend `audio-cpp`), the audio.cpp engine is a required component (`audiocpp-engine`):
 * it is in the same install plan, its size counts toward the bundle, and one confirmation covers both.
 */

export interface ModelInstallToolsDeps {
  installs: ModelInstallService;
  /** Catalog of local model bundles (`models_list`). */
  catalog: Pick<ModelCatalog, 'list'>;
  scope: ToolScope;
}

const schemas = {
  models_install: z.strictObject({
    bundleId: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        `Optional. The local model bundle to download; defaults to this machine's default transcription bundle ${defaultTranscribeBundle(process.platform, process.arch)}; required for local speech synthesis, image generation and music generation. The local Provider's models in models_capabilities are the bundles (transcription under transcribe, synthesis under synthesizeSpeech, image generation under generateImage, music under generateMusic)`,
      ),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  models_list: z.strictObject({}),
  models_test: z.strictObject({
    bundleId: z.string().min(1).max(200).describe('The local model bundle to check: a bundleId from models_list (must already be installed)'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName = 'models_install'> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  models_install: {
    title: 'Download local model',
    description: [
      'Download and install a local model bundle (a few hundred MB to several GB).',
      'Local transcription, speech synthesis, image generation and music generation are only available once it is installed. Use only when the local model is not installed (CAPABILITY_NOT_CONFIGURED with remedy.action install-model).',
      'Music generation bundles include the audio.cpp engine (component audiocpp-engine), downloaded together with the bundle and already counted in its size; if music is unavailable because the engine is not installed, also use this tool with that bundle to install it.',
      'Before submitting it tells the user the size and confirms according to the access mode; if already installed nothing is downloaded (jobId is null). Only missing parts are downloaded, and unfinished earlier downloads resume.',
      'Returns jobId and size immediately (downloadBytes; null when the size is unknown, with estimatedBytes as the estimate). Wait for it with jobs_wait (for progress use jobs_inspect; progress.unit is bytes); it is installed only when state is completed. Then submit the transcription, or submit synthesis or image generation with provider: local and this bundle (they have no factory default). Do not submit the same thing twice.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'job',
    examples: [
      { title: 'Download the default transcription bundle', args: {} },
      { title: 'Download a specific bundle', args: { bundleId: 'qwen3-asr-0.6b@mlx-4bit' } },
    ],
    surfaces: ['agent', 'cli'],
  },
  models_list: {
    title: 'List local model bundles',
    description: [
      'List the local model bundles on this machine and their state.',
      'Each bundle: bundleId, name, capability (transcribe, align, synthesize, separate, image, music, diarize), backend, state (not-installed, downloading, installed, ready, etc.) and reason, estimated download size, weights license, install progress and the result of the latest check.',
      'Read-only. Before using a local model, check here whether it is installed; download missing ones with models_install (in sessions and the terminal); see models_capabilities for capabilities and defaults.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'List local model bundles', args: {} }],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  models_test: {
    title: 'Check local model bundle',
    description: [
      'Run an installed local model bundle on fixed samples to check that it works.',
      'Recognition bundles transcribe a fixed recording, synthesis bundles synthesize a fixed short sentence, image bundles generate a small image, and separation bundles separate a recording; speaker diarization bundles have no separate check. No user content is involved.',
      'Returns jobId immediately; wait for it with jobs_wait: completed means passed; on failed, error.details.check is the reason (for MODEL_FILES_DAMAGED you can ask the user to repair). The result is also recorded in selfTest of models_list.',
    ].join('\n'),
    annotations: { destructiveHint: false },
    effect: 'job',
    examples: [{ title: 'Check a model bundle', args: { bundleId: 'qwen3-asr-0.6b@mlx-4bit' } }],
    surfaces: ['agent', 'cli'],
    positional: 'bundleId',
  },
};

export class ModelInstallTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #installs: ModelInstallService;
  readonly #catalog: Pick<ModelCatalog, 'list'>;
  readonly #scope: ToolScope;

  constructor(deps: ModelInstallToolsDeps) {
    this.#installs = deps.installs;
    this.#catalog = deps.catalog;
    this.#scope = deps.scope;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'models_install':
        return this.#install(args as Args, principal);
      case 'models_list':
        return this.#list(principal);
      case 'models_test':
        return this.#test(args as Args<'models_test'>, principal);
      default:
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    }
  }

  async #list(principal: ToolPrincipal) {
    this.#scope.authorize(principal, false);
    const bundles = await this.#catalog.list();
    return {
      bundles: bundles.map(digestBundle),
      next: 'Download bundles that are not installed with models_install (state not-installed; those with reason unsupported cannot be used on this machine); installed ones can be checked with models_test.',
    };
  }

  async #test(args: Args<'models_test'>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const approval = await this.#scope.confirm(access, {
      tool: 'models_test',
      ...confirmSummary(RcAgentTools.testModelSummary({ bundleId: args.bundleId })),
      risk: 'command',
    });
    const { jobId } = await this.#installs
      .test(
        { bundleId: args.bundleId, ...(args.commandId ? { commandId: this.#scope.commandId(access, args.commandId) } : {}) },
        access.submitter,
      )
      .catch((error: unknown) => {
        throw toolErrorOf(error);
      });
    return {
      jobId,
      bundleId: args.bundleId,
      ...approvalField(approval),
      next: 'Check submitted: wait for it with jobs_wait. completed means passed; on failed, error.details.check is the reason - tell the user. Do not submit it again.',
    };
  }

  async #install(args: Args, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const bundleId = args.bundleId ?? defaultTranscribeBundle(process.platform, process.arch);
    const first = await this.#installs.install({ bundleId }, access.submitter).catch((error: unknown) => {
      throw toolErrorOf(error);
    });
    if (first.jobId) return { ...resultOf(first.plan, first.jobId), next: 'This bundle is already downloading: wait for it with jobs_wait; do not submit again.' };
    if (first.plan.upToDate) return { ...resultOf(first.plan, null), next: 'The bundle is already installed, nothing to download; you can submit the transcription directly.' };
    const approval = await this.#scope.confirm(access, { tool: 'models_install', ...confirmSummary(summaryOf(first.plan)), risk: 'command' });
    const submitted = await this.#installs
      .install(
        {
          bundleId,
          confirmBytes: first.plan.confirmBytes,
          ...(args.commandId ? { commandId: this.#scope.commandId(access, args.commandId) } : {}),
        },
        access.submitter,
      )
      .catch((error: unknown) => {
        throw toolErrorOf(error);
      });
    return {
      ...resultOf(submitted.plan, submitted.jobId),
      ...approvalField(approval),
      next: 'Download submitted. Wait for it with jobs_wait (use jobs_inspect for progress); it is installed only when state is completed, then submit the transcription; on failure, error.details.remedy explains how to recover.',
    };
  }
}

/** The bundle state as shown to the model: components keep only their name and whether installed, with no local paths. */
function digestBundle(bundle: ModelBundleStatus) {
  return {
    bundleId: bundle.bundleId,
    label: bundle.label ?? bundle.bundleId,
    capability: bundle.capability,
    backend: bundle.backend,
    state: bundle.state,
    ...(bundle.reason ? { reason: bundle.reason } : {}),
    ...(bundle.detail ? { detail: bundle.detail } : {}),
    ...(bundle.estimatedBytes != null ? { estimatedBytes: bundle.estimatedBytes, size: formatBytes(bundle.estimatedBytes) } : {}),
    ...(bundle.license ? { license: { name: bundle.license.name, commercialUse: bundle.license.commercialUse } } : {}),
    ...(bundle.components?.length
      ? {
          components: bundle.components.map((c) => ({ component: c.component, state: c.state, ...(c.optional ? { optional: true } : {}) })),
        }
      : {}),
    ...(bundle.install
      ? {
          install: {
            jobId: bundle.install.jobId,
            state: bundle.install.state,
            receivedBytes: bundle.install.receivedBytes,
            totalBytes: bundle.install.totalBytes,
          },
        }
      : {}),
    ...(bundle.selfTest
      ? {
          selfTest: {
            state: bundle.selfTest.state,
            at: bundle.selfTest.at,
            ...(bundle.selfTest.code ? { code: bundle.selfTest.code } : {}),
            ...(bundle.selfTest.detail ? { detail: bundle.selfTest.detail } : {}),
          },
        }
      : {}),
  };
}

function resultOf(plan: ModelInstallPlan, jobId: string | null) {
  return {
    jobId,
    bundleId: plan.bundleId,
    downloadBytes: plan.downloadBytes,
    estimatedBytes: plan.estimatedBytes,
    resumedBytes: plan.resumedBytes,
    size: formatBytes(plan.confirmBytes) + (plan.downloadBytes === null ? ' (estimated)' : ''),
    components: plan.components
      .filter((c) => c.action === 'download')
      .map((c) => ({ component: c.component, repo: c.repo, bytes: c.bytes })),
    source: plan.source,
  };
}

function summaryOf(plan: ModelInstallPlan): Localized {
  const parts = plan.components.filter((c) => c.action === 'download').map((c) => c.repo);
  return RcAgentTools.installModelSummary({
    bundleId: plan.bundleId,
    size: formatBytes(plan.downloadBytes ?? plan.estimatedBytes),
    estimated: plan.downloadBytes === null,
    resumed: plan.resumedBytes > 0 ? formatBytes(plan.resumedBytes) : null,
    source: plan.source,
    parts: parts.join(RcAgentTools.listSeparator().text),
  });
}

/** Byte counts for humans: KB, MB, GB, with one decimal place. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Turns a service refusal into a tool error: `details.code` (`MODEL_INSTALL_SIZE_CHANGED`, `OFFLINE_STRICT`, ...) becomes the tool error code. */
function toolErrorOf(error: unknown): unknown {
  if (error instanceof RpcError && typeof error.details === 'object' && error.details !== null) {
    const { code, ...rest } = error.details as Record<string, unknown>;
    if (typeof code === 'string') return new ToolError(code, error.message, rest);
  }
  return error;
}
