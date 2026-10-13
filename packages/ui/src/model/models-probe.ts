import {
  intlLocale,
  type GenerateImageRequest,
  type GenerateTextRequest,
  type GeneratedOutput,
  type ImageModelInfo,
  type JobRecord,
  type ModelInfoBase,
  type OnlineCapability,
  type SpeechModelInfo,
  type SynthesizeSpeechRequest,
  type TextJobResult,
} from '@cuccut/protocol';
import { M } from './models-probe-copy.ts';
import { jobErrorText } from './localized-text.ts';

/**
 * Cloud model “Test synthesis / Test image / Test generation” (design draft settings-cloud.jsx test dialog): submits a real generation job; progress and results go through the `jobs` theme; on completion it reads the first output aloud or shows it, and text reads the preview in the result. The job also appears in background tasks; it is a real, paid call.
 * Speech recognition testing needs an audio clip, and `models.transcribe` only accepts material from a video. There is no interface for standalone testing yet, so it is not done here.
 */

/** Test synthesis text: one sentence in the current UI language. */
export const probeSpeechText = (): string => M.speechText;
/** Test image prompt (design draft IMG_SAMPLE). */
export const PROBE_IMAGE_PROMPT = 'a paper crane on a wooden desk, soft morning light';

/** Test text generation prompt (design draft settings-cloud.jsx:368 “Reply with OK.”). */
export const PROBE_TEXT_PROMPT = 'Reply with OK.';

/** Whether this capability can be tested on its own in this version. */
export function probeSupported(capability: OnlineCapability): boolean {
  return capability !== 'transcribe';
}

/** When the model has no preset voice and no default voice (a self-hosted provider without a voice ID filled in), the test asks the user for a voice ID. */
export function probeNeedsVoice(model: ModelInfoBase): boolean {
  const m = model as SpeechModelInfo;
  return Array.isArray(m.voices) && m.voices.length === 0 && m.defaultVoice === null;
}

/** Voice used for the test: the one given if any, otherwise the model's default (or the first preset if there is none). */
export function probeVoice(model: SpeechModelInfo, typed: string): string | undefined {
  return typed.trim() || model.defaultVoice || model.voices[0]?.voiceId || undefined;
}

/** Test synthesis request: one sentence, default format, no video imported. */
export function speechProbeRequest(providerId: string, model: SpeechModelInfo, typedVoice = ''): Omit<SynthesizeSpeechRequest, 'commandId'> {
  const voice = probeVoice(model, typedVoice);
  return { text: probeSpeechText(), provider: providerId, model: model.modelId, ...(voice ? { voice } : {}) };
}

/** Test image request: one image at the model's default size (no size given, so Codex-style models that reject sizes also pass), no video imported. */
export function imageProbeRequest(providerId: string, model: Pick<ImageModelInfo, 'modelId'>): Omit<GenerateImageRequest, 'commandId'> {
  return { prompt: PROBE_IMAGE_PROMPT, provider: providerId, model: model.modelId, count: 1 };
}

/** Step count for the local image “Test draw” (design draft image-gen.jsx `ImageProbeDialog`, local branch: one 512² image, 8 steps). */
export const IMAGE_TRY_STEPS = 8;

/** Local image “Test draw”: the user's prompt, one 512 × 512 image, 8 steps, `provider: 'local'`, `model` is the model pack ID; no video imported. */
export function imageTryRequest(bundleId: string, prompt: string): Omit<GenerateImageRequest, 'commandId'> {
  return { prompt: prompt.trim(), provider: 'local', model: bundleId, size: '512x512', count: 1, steps: IMAGE_TRY_STEPS };
}

/**
 * Test text generation request: one user message, with no output limit or reasoning effort given (uses the model's limit and the default set on the model page); no video imported.
 * The result is listed in the Space's documents like any other text generation (runtime-core space/space-derive.ts).
 */
export function textProbeRequest(providerId: string, model: Pick<ModelInfoBase, 'modelId'>): Omit<GenerateTextRequest, 'commandId'> {
  return { messages: [{ role: 'user', content: PROBE_TEXT_PROMPT }], provider: providerId, model: model.modelId };
}

/** A finished test: generated speech and images have an output (`output`); text is a result summary (`text`); only one of the two. */
export type ProbeResult = { output: GeneratedOutput; text: null } | { output: null; text: TextJobResult };

export type ProbeState =
  | { status: 'ready' }
  | { status: 'submitting' }
  | { status: 'running'; jobId: string }
  | ({ status: 'done'; jobId: string; seconds: number | null } & ProbeResult)
  | { status: 'failed'; message: string; jobId?: string };

function elapsed(job: JobRecord): number | null {
  const start = job.startedAt ?? job.createdAt;
  if (!start || !job.endedAt) return null;
  const ms = Date.parse(job.endedAt) - Date.parse(start);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 100) / 10 : null;
}

/** Job record → state of the test dialog. Still counts as running when it has not yet appeared in the `jobs` theme. */
export function probeFromJob(jobId: string, job: JobRecord | undefined): ProbeState {
  if (!job) return { status: 'running', jobId };
  switch (job.state) {
    case 'queued':
    case 'running':
      return { status: 'running', jobId };
    case 'completed': {
      const text = job.kind === 'generateText' ? job.result?.text : undefined;
      if (text) return { status: 'done', jobId, output: null, text, seconds: elapsed(job) };
      const output = job.result?.outputs?.[0];
      if (!output) return { status: 'failed', jobId, message: M.noResult };
      return { status: 'done', jobId, output, text: null, seconds: elapsed(job) };
    }
    case 'failed':
      return { status: 'failed', jobId, message: jobErrorText(job.error) ?? M.failed };
    case 'cancelled':
      return { status: 'failed', jobId, message: M.cancelled };
    case 'interrupted':
      return { status: 'failed', jobId, message: M.interrupted };
    case 'needs-reconciliation':
      return { status: 'failed', jobId, message: M.unknownOutcome };
  }
}

/** One fact line for a result: audio gives duration and sample rate; images give pixels. */
export function outputFacts(output: GeneratedOutput): string {
  const media = output.media;
  const type = output.mediaType.split('/')[1]?.toUpperCase() ?? output.mediaType;
  switch (media.kind) {
    case 'audio':
      return M.audioFacts(media.durationSec.toFixed(1), media.sampleRate / 1000, type);
    case 'image':
      return `${media.width} × ${media.height} · ${type}`;
    case 'video':
      return M.videoFacts(media.width, media.height, media.durationSec.toFixed(1), type);
    case 'text':
      return M.textFacts(media.entries, media.durationSec.toFixed(1), type);
    case 'package':
      return M.packageFacts(media.files, type);
    case 'project':
      return M.projectFacts(media.clips, media.durationSec.toFixed(1), type);
    case 'file':
      return type;
  }
}

/** One fact line for a text result: character count, tokens used, and whether the output limit was reached. */
export function textProbeFacts(text: Pick<TextJobResult, 'length' | 'usage' | 'finishReason'>): string {
  const usage = text.usage;
  return [
    M.chars(text.length.toLocaleString(intlLocale())),
    usage && usage.inputTokens !== null ? M.inputTokens(usage.inputTokens.toLocaleString(intlLocale())) : null,
    usage && usage.outputTokens !== null ? M.outputTokens(usage.outputTokens.toLocaleString(intlLocale())) : null,
    text.finishReason === 'length' ? M.hitLimit : text.finishReason === 'content-filter' ? M.filtered : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Verdict on a model row (only records tests since this page was opened). */
export function probeVerdict(state: ProbeState | undefined): { text: string; tone: 'neutral' | 'positive' | 'negative' } {
  if (!state || state.status === 'ready') return { text: M.untested, tone: 'neutral' };
  if (state.status === 'submitting' || state.status === 'running') return { text: M.testing, tone: 'neutral' };
  if (state.status === 'done') return { text: state.seconds !== null ? M.passedIn(state.seconds) : M.passed, tone: 'positive' };
  return { text: state.message, tone: 'negative' };
}
