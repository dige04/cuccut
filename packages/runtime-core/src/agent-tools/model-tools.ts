import fs from 'node:fs/promises';
import { z } from 'zod';
import {
  IMAGE_FORMATS,
  MUSIC_MODES,
  MUSIC_PLANNINGS,
  MODEL_SERVICE_CAPABILITIES,
  SPEECH_FORMATS,
  capabilitySettingsHref,
  type CapabilityView,
  type GrantRequestItem,
  type Id,
  type ModelServiceCapability,
  type RiskLevel,
} from '@cuccut/protocol';
import type { JobGrantHint } from '@cuccut/jobs';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { outboundPurpose, type OutboundCall, type OutboundPlan } from '../grants/grant-service.ts';
import type { ModelJobs } from '../models/model-jobs.ts';
import { prepareArtifactSave } from './artifact-save.ts';
import { modelCallRisk, outboundGrantOf } from './outbound-grants.ts';
import type { ToolInfo, ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolApprovalNote, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { commandIdArg, videoArg } from './video-tools.ts';

/**
 * Model tools (architecture design §3.5, §6.2): the agent views model capabilities, submits speech synthesis and image generation,
 * and saves artifacts into the working directory (transcription is the top-level verb `transcribe`, see `flow-tools.ts`; inspecting,
 * waiting for and cancelling jobs is in `job-tools.ts`). Every call goes back to the same in-process services as the gateway:
 * `ModelServices` provides the capability view and selection, `JobManager` checks, freezes and queues; the tool layer does no
 * selection or checks of its own.
 *
 * - The submitter comes from the scope: a session (`{ kind: 'agent', id: session ID, taskId }`, §7.9) or an external service client
 *   (`{ kind: 'service', … }`, §4.8); submitting is a write, rejected in plan mode and at the `read` level, confirmed each time at
 *   the `ask` level.
 * - Risk level (§3.12): a local model is `edit`, an outbound call covered by a grant is `command`, an outbound call not covered is
 *   `high` (the approval lists the data to grant; when allowed, a "just this once" or standing grant is issued, §12.5); insufficient
 *   budget fails directly with `BUDGET_EXCEEDED` without an approval; `artifacts_save` overwriting an existing file is `high`,
 *   otherwise `edit`.
 * - The video resolves by scope (as in the video tools). When a video is given, results are imported as candidate assets, not put on
 *   the timeline.
 * - Without a video the result is an artifact: later import it into a video with `edits_apply` `importAsset` + `artifactId`, or copy
 *   it into the working directory with `artifacts_save`.
 * - Tools cannot enable or configure providers, set defaults or issue grants themselves; no tool reads or writes keys. Enabling a
 *   provider issues a default grant (the migration rule in §6.8); once the user revokes it, calls to that provider need approval again.
 */

export interface ModelToolsDeps {
  models: ModelJobs;
  scope: ToolScope;
}

const capabilityArg = z.enum(MODEL_SERVICE_CAPABILITIES as [ModelServiceCapability, ...ModelServiceCapability[]]);
const providerArg = z
  .string()
  .min(1)
  .max(200)
  .describe('Optional. Provider: local, node:<node>, openai, google, elevenlabs, custom:<name>, agent:codex; the default for this capability if omitted');
const modelArg = z.string().min(1).max(200).describe('Optional. Model ID (a modelId listed by models_capabilities); the provider\'s default model if omitted');
const outputVideoArg = videoArg.describe(
  'Optional. The video to import the result into: a path from videos_list, or the videoId of an open video. When given, the result is imported as a candidate asset (not placed on the timeline); otherwise you only get an artifact',
);
const assetNameArg = z.string().min(1).max(200).describe('Optional. Asset name when importing into the video');
const seedArg = z.number().int().min(0).max(4294967295).describe('Optional. Random seed (when the model accepts seed; the provider tries to reproduce results but does not guarantee it)');

const schemas = {
  models_capabilities: z.strictObject({
    capability: capabilityArg
      .optional()
      .describe('Optional. Only show one capability: transcribe, synthesizeSpeech, generateImage, generateMusic, generateText, separateAudio; lists all if omitted'),
  }),
  speak: z.strictObject({
    text: z.string().min(1).max(200_000).describe('Text to synthesize; must not exceed the model\'s maxInputChars (in models_capabilities)'),
    voice: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Optional. Voice ID, or library:<voice ID from the user\'s library> (only for agents in a session; the voice must already be cloned on this provider); the model\'s defaultVoice if omitted (required for models whose defaultVoice is null)',
      ),
    language: z.string().min(1).max(35).optional().describe('Optional. Language of the text (BCP 47)'),
    format: z
      .enum(SPEECH_FORMATS as [string, ...string[]])
      .optional()
      .describe(`Optional. Audio format: ${SPEECH_FORMATS.join(', ')}; the model's defaultFormat if omitted`),
    instructions: z.string().min(1).max(2000).optional().describe('Optional. Instructions on tone and style; only accepted by models with acceptsInstructions'),
    speed: z.number().positive().max(10).optional().describe('Optional. Speed multiplier, within the model\'s speedRange'),
    seed: seedArg.optional(),
    provider: providerArg.optional(),
    model: modelArg.optional(),
    video: outputVideoArg.optional(),
    name: assetNameArg.optional(),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  image: z.strictObject({
    prompt: z.string().min(1).max(100_000).describe('Prompt; must not exceed the model\'s maxPromptChars'),
    size: z
      .string()
      .regex(/^(\d{1,5}x\d{1,5}|\d{1,3}:\d{1,3})$/)
      .optional()
      .describe('Optional. Size WIDTHxHEIGHT (one of the model\'s sizes) or aspect ratio W:H (one of the model\'s aspectRatios); defaultSize if omitted'),
    count: z.number().int().min(1).max(16).optional().describe('Optional. Number of images, default 1, at most the model\'s maxCount'),
    format: z
      .enum(IMAGE_FORMATS as [string, ...string[]])
      .optional()
      .describe(`Optional. Image format: ${IMAGE_FORMATS.join(', ')}; the model's defaultFormat if omitted`),
    seed: seedArg.optional(),
    provider: providerArg.optional(),
    model: modelArg.optional(),
    video: outputVideoArg.optional(),
    name: assetNameArg.optional(),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  music: z.strictObject({
    mode: z.enum(MUSIC_MODES as [string, ...string[]]).describe('song is a song with vocals (lyrics required), instrumental is music only (lyrics not allowed)'),
    style: z.string().min(1).max(100_000).describe('Style description (genre, mood, instruments, tempo, vocal type, etc.; English gives the most reliable results); must not exceed the model\'s maxStyleChars'),
    lyrics: z.string().min(1).max(200_000).optional().describe('Lyrics, only when mode is song; must not exceed the model\'s maxLyricsChars'),
    targetDurationSec: z.number().positive().max(3600).optional().describe('Optional. Desired duration (seconds); only a creative intent for the model, not guaranteed to be exact'),
    maxDurationSec: z
      .number()
      .positive()
      .max(3600)
      .optional()
      .describe('Optional. Maximum duration (seconds), at most the model\'s maxDurationSec; if omitted, targetDurationSec, and failing that the model\'s defaultDurationSec. A result that hits the limit carries an output-truncated warning'),
    planning: z
      .enum(MUSIC_PLANNINGS as [string, ...string[]])
      .optional()
      .describe('Optional. Planning: off plans nothing, melody plans the melody first, full plans everything (slower); only values in the model\'s planning.options are allowed; the model\'s default if omitted'),
    seed: seedArg.optional(),
    provider: providerArg.optional(),
    model: modelArg.optional(),
    video: outputVideoArg.optional(),
    name: assetNameArg.optional(),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  artifacts_save: z.strictObject({
    artifactId: z
      .string()
      .regex(/^sha256:[0-9a-f]{64}$/)
      .describe('An artifactId from the outputs of jobs_inspect (result.artifactId for a transcription)'),
    path: z.string().min(1).max(1000).describe('File path in the working directory (relative to it); if the extension is omitted, the artifact\'s extension is added'),
    overwrite: z.boolean().optional().describe('Optional. Whether to replace the target file if it already exists, default false (rejected if it exists)'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const ARTIFACT_RULES =
  'Without video you only get an artifact (artifactId): to put it in a video later, use edits_apply {"type":"importAsset","artifactId":…} (no regeneration); when you need the file itself, copy it into the working directory with artifacts_save.';

const SUBMIT_RULES = [
  'Returns a jobId immediately and computes in the background: then use jobs_wait to wait for it to finish (jobs_inspect for progress); it is done only when state is completed.',
  'provider and model are optional and default to this capability\'s defaults; check models_capabilities first for what is available and the limits.',
  'When the capability is not configured, returns CAPABILITY_NOT_CONFIGURED: relay next to the user as instructed; do not work around it another way.',
].join('\n');

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  models_capabilities: {
    title: 'View model capabilities',
    description: [
      'Lists providers and models per capability: availability, limits, defaults.',
      'There are six capabilities: transcription (transcribe), speech synthesis (synthesizeSpeech), image generation (generateImage), music generation (generateMusic), text generation (generateText) and vocal/background separation (separateAudio). For each: providers and models, availability and why, limits (text length, sizes, image count, voices, formats, duration, context and output limits, reasoning effort) and defaults.',
      'generateMusic is local only (the audio.cpp engine plus a local model bundle) and very slow (several minutes to over ten minutes); submit with music.',
      'separateAudio is local only and used by translate-and-dub\'s "separate background" option; there is no submit tool for it.',
      'generateText is the text model called by fixed pipelines started from the tools page and the CLI (translation, polishing, etc.); there is no submit tool for it: in a session you do translation, polishing and summaries yourself, it being unconfigured does not stop you, and you cannot call other models through it.',
      'effective is what is actually used when no provider is specified; when it is null, calls without a provider are rejected with CAPABILITY_NOT_CONFIGURED.',
      'Read-only. Enabling and configuring services and setting defaults are done by the user in Settings; you cannot do it for them.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'List all capabilities', args: {} },
      { title: 'Only transcription', args: { capability: 'transcribe' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  speak: {
    title: 'Synthesize speech',
    description: [
      'Synthesizes a piece of text into speech.',
      'Text longer than the model\'s maxInputChars is rejected on submission with INPUT_TOO_LONG (with limit): split it by sentence or paragraph yourself and submit piece by piece; the Runtime does not truncate.',
      'With video, on completion the audio is imported as a candidate asset of that video (jobs_inspect gives the assetId) and is not placed on the timeline; to use it, add it with edits_apply addItem.',
      ARTIFACT_RULES,
      SUBMIT_RULES,
    ].join('\n'),
    effect: 'job',
    examples: [
      { title: 'Synthesize a line of narration', args: { text: 'Welcome to today\'s show.' } },
      { title: 'Synthesize and import into a video', args: { text: 'Welcome back.', language: 'en', video: 'demo', name: 'Opening narration' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'text',
  },
  image: {
    title: 'Generate image',
    description: [
      'Generates images from a prompt.',
      'This version does not accept reference images. Size, count and format must be within what the model declares, and the prompt must not exceed maxPromptChars.',
      'With video, on completion each image is imported as a candidate asset of that video (jobs_inspect gives the assetId) and is not placed on the timeline; to use one, add it with edits_apply addItem.',
      ARTIFACT_RULES,
      SUBMIT_RULES,
    ].join('\n'),
    effect: 'job',
    examples: [
      { title: 'Generate a cover image', args: { prompt: 'A seaside town at sunset, watercolor style' } },
      { title: 'Generate two by aspect ratio and import into a video', args: { prompt: 'a minimalist title card', size: '16:9', count: 2, video: 'demo' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'prompt',
  },
  music: {
    title: 'Generate music',
    description: [
      'Generates a piece of music from a style description and optional lyrics. Use it for a soundtrack, an intro theme or a song with vocals.',
      'Local models only (the audio.cpp engine plus a local model bundle); one piece takes several minutes to over ten minutes: after submitting, wait with jobs_wait and do not resubmit. Check models_capabilities first for available generateMusic models, the duration limit and planning options.',
      'For a video soundtrack: set maxDurationSec to the length of the section to score (slightly longer is fine; trim it on the timeline later), use mode instrumental, and spell out mood, tempo and instruments in the style.',
      'With video, on completion the audio is imported as a candidate asset of that video (jobs_inspect gives the assetId) and is not placed on the timeline; to use it, add it with edits_apply addItem.',
      ARTIFACT_RULES,
      SUBMIT_RULES,
    ].join('\n'),
    effect: 'job',
    examples: [
      { title: 'Score a video with background music', args: { mode: 'instrumental', style: 'warm acoustic guitar, gentle, hopeful, 90 bpm', maxDurationSec: 60, video: 'demo' } },
      { title: 'Generate a song', args: { mode: 'song', style: 'upbeat pop, female vocal, bright synths', lyrics: '[verse]\nMorning light on the city street\n[chorus]\nWe keep on running', planning: 'melody' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'style',
  },
  artifacts_save: {
    title: 'Save artifact to working directory',
    description: [
      'Copies an artifact to a file in the working directory.',
      'An artifact is generated audio or an image, or a transcription result JSON; for you to read or to hand to other commands.',
      'Only for when you need the file itself; to put it in a video there is no need to save first, use edits_apply importAsset + artifactId directly.',
      'Only artifacts of jobs visible to this session can be used (same as jobs_inspect). path is relative to the working directory; it cannot write outside via .. or symlinks, nor into a video directory; an existing file with the same name is rejected; pass overwrite: true only when it really should be replaced.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Save the generated narration as a file',
        args: { artifactId: 'sha256:abababababababababababababababababababababababababababababababab', path: 'narration' },
      },
    ],
    // The external service has no working directory: design §6.2's list of additions does not include it, so it is not on the MCP surface for now.
    surfaces: ['agent', 'cli'],
  },
};

export class ModelTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #models: ModelJobs;
  readonly #scope: ToolScope;

  constructor(deps: ModelToolsDeps) {
    this.#models = deps.models;
    this.#scope = deps.scope;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'models_capabilities':
        return this.#capabilities(args as Args<'models_capabilities'>, principal);
      case 'speak':
        return this.#synthesizeSpeech(args as Args<'speak'>, principal);
      case 'image':
        return this.#generateImage(args as Args<'image'>, principal);
      case 'music':
        return this.#generateMusic(args as Args<'music'>, principal);
      case 'artifacts_save':
        return this.#save(args as Args<'artifacts_save'>, principal);
    }
  }

  // ---- Capabilities ----

  async #capabilities(args: Args<'models_capabilities'>, principal: ToolPrincipal) {
    this.#scope.authorize(principal, false);
    const view = await this.#models.services.capabilities();
    const capabilities = args.capability ? [args.capability] : MODEL_SERVICE_CAPABILITIES;
    return { capabilities: capabilities.map((capability) => digestCapability(capability, view[capability])) };
  }

  // ---- Submission ----

  async #synthesizeSpeech(args: Args<'speak'>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const videoId = args.video !== undefined ? (await this.#scope.open(args.video, access)).ref.videoId : undefined;
    const chars = [...args.text].length;
    const plan = await this.#plan(access, {
      capability: 'synthesizeSpeech',
      providerId: args.provider,
      modelId: args.model,
      videoId: videoId ?? null,
      quantity: { chars },
      ...outboundPurpose(RcAgentTools.speechPurpose({ chars })),
    });
    const approval = await this.#scope.confirm(access, {
      tool: 'speak',
      ...(args.video !== undefined ? { video: args.video } : {}),
      ...confirmSummary(RcAgentTools.speechSummary({ chars, provider: args.provider ?? null, voice: args.voice ?? null })),
      ...this.#risk(plan),
    });
    const hint = this.#grantHint(plan, approval, access);
    const { video: _, format, commandId, ...rest } = args;
    const { jobId } = await this.#models.grants.submitWith(hint, () =>
      this.#models.jobs.submitSynthesizeSpeech(
        {
          ...optional(rest),
          ...optional({
            format: format as (typeof SPEECH_FORMATS)[number] | undefined,
            videoId,
            commandId: this.#commandId(access, commandId),
          }),
          text: args.text,
        },
        access.submitter,
        hint,
      ),
    );
    return { ...this.#submitted(jobId), ...approvalField(approval) };
  }

  async #generateImage(args: Args<'image'>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const videoId = args.video !== undefined ? (await this.#scope.open(args.video, access)).ref.videoId : undefined;
    const plan = await this.#plan(access, {
      capability: 'generateImage',
      providerId: args.provider,
      modelId: args.model,
      videoId: videoId ?? null,
      quantity: { count: args.count ?? 1 },
      ...outboundPurpose(RcAgentTools.imagePurpose({ prompt: clip(args.prompt, 40) })),
    });
    const approval = await this.#scope.confirm(access, {
      tool: 'image',
      ...(args.video !== undefined ? { video: args.video } : {}),
      ...confirmSummary(
        RcAgentTools.imageSummary({
          count: args.count ?? 1,
          size: args.size ?? null,
          provider: args.provider ?? null,
          prompt: clip(args.prompt, 80),
        }),
      ),
      ...this.#risk(plan),
    });
    const hint = this.#grantHint(plan, approval, access);
    const { video: _, format, commandId, ...rest } = args;
    const { jobId } = await this.#models.grants.submitWith(hint, () =>
      this.#models.jobs.submitGenerateImage(
        {
          ...optional(rest),
          ...optional({
            format: format as (typeof IMAGE_FORMATS)[number] | undefined,
            videoId,
            commandId: this.#commandId(access, commandId),
          }),
          prompt: args.prompt,
        },
        access.submitter,
        hint,
      ),
    );
    return { ...this.#submitted(jobId), ...approvalField(approval) };
  }

  async #generateMusic(args: Args<'music'>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const videoId = args.video !== undefined ? (await this.#scope.open(args.video, access)).ref.videoId : undefined;
    const plan = await this.#plan(access, {
      capability: 'generateMusic',
      providerId: args.provider,
      modelId: args.model,
      videoId: videoId ?? null,
      quantity: {},
      ...outboundPurpose(RcAgentTools.musicPurpose({ style: clip(args.style, 40) })),
    });
    const approval = await this.#scope.confirm(access, {
      tool: 'music',
      ...(args.video !== undefined ? { video: args.video } : {}),
      ...confirmSummary(
        RcAgentTools.musicSummary({
          mode: args.mode,
          seconds: args.maxDurationSec ?? args.targetDurationSec ?? null,
          provider: args.provider ?? null,
          style: clip(args.style, 80),
        }),
      ),
      ...this.#risk(plan),
    });
    const hint = this.#grantHint(plan, approval, access);
    const { video: _, mode, planning, commandId, ...rest } = args;
    const { jobId } = await this.#models.grants.submitWith(hint, () =>
      this.#models.jobs.submitGenerateMusic(
        {
          ...optional(rest),
          ...optional({
            planning: planning as (typeof MUSIC_PLANNINGS)[number] | undefined,
            videoId,
            commandId: this.#commandId(access, commandId),
          }),
          mode: mode as (typeof MUSIC_MODES)[number],
          style: args.style,
        },
        access.submitter,
        hint,
      ),
    );
    return { ...this.#submitted(jobId), ...approvalField(approval) };
  }

  /**
   * The outbound decision for this call (§12.5): who it goes to, whether a grant covers it, whether the budget suffices. First
   * recomputes the capability view from probes (consistent with the selection at submission); throws `BUDGET_EXCEEDED` when the
   * budget is insufficient, without an approval.
   */
  async #plan(access: ToolAccess, call: Omit<OutboundCall, 'taskId'>): Promise<OutboundPlan> {
    await this.#models.services.capabilities();
    return this.#models.grants.plan({ ...call, taskId: taskOf(access) });
  }

  /** The confirmation's risk level (§3.12) and the data to grant: an outbound call not covered by a grant is `high`, and the approval lists it. */
  #risk(plan: OutboundPlan): { risk: RiskLevel; grants?: GrantRequestItem[] } {
    const risk = modelCallRisk(outboundGrantOf(plan));
    return plan.status === 'approval' ? { risk, grants: [plan.item] } : { risk };
  }

  /**
   * Once the approval allows it, issues a grant ("just this once", or the standing grant the user chose) and names it at submission.
   * When the confirmation brings back no choice (which does not happen for an allowed outbound call), nothing is issued: submission
   * is rejected with `GRANT_REQUIRED`.
   */
  #grantHint(plan: OutboundPlan, approval: ToolApprovalNote | void, access: ToolAccess): JobGrantHint | undefined {
    if (plan.status !== 'approval' || !approval?.grant) return undefined;
    const grant = this.#models.grants.issueForApproval(plan.item, approval.grant, { approvalId: null, taskId: taskOf(access) });
    return { grantId: grant.grantId };
  }

  /** Maps the caller's idempotency key to the one used for submission (separated per client for the external service); no dedup when not given. */
  #commandId(access: ToolAccess, given: string | undefined): string | undefined {
    return given === undefined ? undefined : this.#scope.commandId(access, given);
  }

  /** The submission receipt: job ID and the frozen choices. */
  #submitted(jobId: Id) {
    const record = this.#models.jobs.inspect(jobId);
    return {
      jobId,
      kind: record.kind,
      state: record.state,
      providerId: record.providerId,
      modelId: record.modelId,
      videoId: record.videoId,
      next: 'Job submitted. Use jobs_wait to wait for it to finish (jobs_inspect for progress); it is done only when state is completed. Do not submit the same thing again.',
    };
  }

  // ---- Artifacts ----

  /**
   * Copies an artifact into the working directory (writes only this one file, see `prepareArtifactSave`). The path is checked first
   * (an invalid one produces no approval); overwriting an existing file is `high`, otherwise `edit`; it writes only after confirmation.
   */
  async #save(args: Args<'artifacts_save'>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const { record, output, file: source } = await this.#scope.visibleArtifact(args.artifactId, access);
    const plan = await prepareArtifactSave({
      source,
      root: this.#scope.saveRoot(access),
      target: args.path,
      overwrite: args.overwrite ?? false,
    });
    const approval = await this.#scope.confirm(access, {
      tool: 'artifacts_save',
      targets: [plan.relPath],
      ...confirmSummary(
        (plan.exists ? RcAgentTools.overwriteArtifactSummary : RcAgentTools.saveArtifactSummary)({ artifactId: args.artifactId, path: plan.relPath }),
      ),
      risk: plan.exists ? 'high' : 'edit',
    });
    const saved = await plan.commit();
    const { size } = await fs.stat(source);
    return {
      artifactId: args.artifactId,
      jobId: record.jobId,
      path: saved.relPath,
      mediaType: output?.mediaType ?? 'application/json',
      byteLength: size,
      overwritten: saved.overwritten,
      ...approvalField(approval),
      next: 'The file was written to the working directory (path is relative to it). It is only a copy: to put it in a video, still use edits_apply importAsset + artifactId.',
    };
  }
}

/** Which task a session call belongs to (a grant within a task covers only that task). */
function taskOf(access: ToolAccess): Id | null {
  return access.submitter.kind === 'agent' ? access.submitter.taskId : null;
}

/** Long text in a summary keeps only its beginning. */
function clip(text: string, max: number): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

/** Drops keys whose value is undefined (request types use optional properties and do not accept an explicit undefined). */
function optional<T extends Record<string, unknown>>(values: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

/** A capability's view, trimmed for the model: no endpoint addresses or configuration details; keys are never in the view anyway. */
function digestCapability(capability: ModelServiceCapability, view: CapabilityView) {
  const providers = view.providers.map((p) => ({
    providerId: p.providerId,
    kind: p.kind,
    label: p.label,
    available: p.available,
    ...(p.unavailableReason ? { unavailableReason: p.unavailableReason } : {}),
    ...(p.detail ? { detail: p.detail } : {}),
    // Online and agent providers: whether the user has enabled it (enabling means agreeing to send it data, §6.8, §6.9). The model's notes and cost are passed through as is.
    ...(p.config ? { enabled: p.config.enabled } : {}),
    models: p.models.map((m) => structuredClone(m)),
  }));
  const usable = providers.filter((p) => p.available).map((p) => p.providerId);
  return {
    capability,
    settingsHref: capabilitySettingsHref(capability),
    default: view.default,
    effective: view.effective,
    usableProviders: usable,
    providers,
    ...(view.parameters ? { parameters: view.parameters } : {}),
    next:
      capability === 'generateText'
        ? 'This is the text model used by fixed pipelines from the tools page and the CLI: in a session you do translation, polishing, summaries and writing yourself without it; if it is not configured, do not ask the user to configure it.'
        : capability === 'separateAudio'
          ? view.effective !== null
            ? `Translate-and-dub uses the local ${view.effective.modelId} when separating the background.`
            : 'No separation model bundle is available locally: translate-and-dub skips this step when separation is requested. If needed, ask the user to install one under "Models › Source separation" in Settings, using settingsHref as a Markdown settings link.'
          : view.effective !== null
            ? `Without a provider, ${view.effective.modelId} from ${view.effective.providerId} is used.`
            : usable.length > 0
              ? `No usable default: pass provider explicitly when calling (${usable.join(', ')}), or ask the user to set a default in Settings, using settingsHref as a Markdown settings link.`
              : 'No service is available: this capability cannot be used right now. Tell the user they need to enable and configure a service in the model configuration in Settings, using settingsHref as a Markdown settings link whose text names the capability in the user\'s language; do not work around it another way.',
  };
}
