import type { GenerateImageRequest, ImageModelInfo, JobRecord, ModelCapabilitiesView } from '@cuccut/protocol';
import { M } from './tools-image-copy.ts';
import { cloudModelOptions, codePoints, localModelOptions, localNotDownloaded, modelKeyOf, parseSeed, type ToolModelOption } from './tools-models.ts';

/**
 * Image generation workbench (design mocks tool-image.jsx, image-gen.jsx `ImageGenForm`, and the cloud and local parts of model-cloud-image.js):
 * prompt, model, aspect ratio, count, seed; local models also have steps. Reference images and LAN nodes have no backend in this version, so they are greyed out on the page with a reason. Codex image generation is used in the session.
 */

export type ImageOption = ToolModelOption<ImageModelInfo>;

export { localNotDownloaded };

/** Local image model packs: all are listed (uninstalled ones too; choosing one shows a download card), named with the model's name. */
export function localImageOptions(view: ModelCapabilitiesView): ImageOption[] {
  return localModelOptions(view, 'generateImage');
}

/** Model menu for image generation: cloud first, then local (of the three groups in the design, Codex is not on the tools page in this version). */
export function imageModelOptions(view: ModelCapabilitiesView): ImageOption[] {
  return [...cloudModelOptions(view, 'generateImage'), ...localImageOptions(view)];
}

/** The fallback when the page opens only goes to cloud (design `preferred`): local models must be chosen by the user or set as default. */
export const imageFallback = (option: ImageOption): boolean => !option.local;

/** The sentence shown when no prompt is written (design mock model-cloud-image.js `EMPTY_PROMPT`). */
export function emptyPrompt(): string {
  return M.emptyPrompt;
}

/** "Fill in a sample" cycles through the samples (design mock image-gen.jsx `SAMPLES`): Chinese and English prompts are mixed, and they don't change with the UI language. */
// i18n-ignore-start: sample prompts deliberately mix Chinese and English, to show that both languages work
export const IMAGE_SAMPLES = [
  'A paper crane on a wooden desk, soft morning light, shallow depth of field',
  '一间明亮的播客工作室，木质桌面上放着麦克风与一杯咖啡，插画风格，暖色',
  'Flat vector illustration of a cheerful robot holding a video camera, pastel palette, white background',
  '水墨风格的山间小路，晨雾，留白',
] as const;
// i18n-ignore-end

export interface ImageDraft {
  prompt: string;
  /** `providerId/modelId`; null means none chosen yet. */
  model: string | null;
  /** Aspect ratio: `W:H` aspect ratio or `WIDTHxHEIGHT` size; null means the model's default. */
  size: string | null;
  count: number;
  seed: string;
  /** Whether "Advanced" is expanded. */
  advanced: boolean;
  /** Denoising steps for a local model; null means the model's default. */
  steps: number | null;
}

export const BLANK_IMAGE: ImageDraft = { prompt: '', model: null, size: null, count: 1, seed: '', advanced: false, steps: null };

// ---- Aspect ratio ----

export interface AspectOption {
  /** The `size` handed to the Runtime: an aspect ratio or a size. */
  key: string;
  /** Aspect ratio (`16:9`). */
  label: string;
  /** Pixel size (`1792×1024`); null when unknown. */
  sub: string | null;
  /** Aspect ratio of the preview box (width / height). */
  ratio: number;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

function parseSize(size: string): [number, number] | null {
  const m = /^(\d+)x(\d+)$/i.exec(size);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** `1536x1024` → `3:2`。 */
export function ratioOfSize(size: string): string {
  const wh = parseSize(size);
  if (!wh) return size;
  const d = gcd(wh[0], wh[1]) || 1;
  return `${wh[0] / d}:${wh[1] / d}`;
}

function ratioNumber(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  return w && h ? w / h : 1;
}

const times = (size: string) => size.replace(/x/i, '×');

/** Aspect ratio options: if the model gives aspect ratios, list them (with their default size); otherwise list the sizes it accepts. Empty when neither is given (the provider decides the size). */
export function aspectOptions(info: Pick<ImageModelInfo, 'aspectRatios' | 'sizes'>): AspectOption[] {
  if (info.aspectRatios.length) {
    return info.aspectRatios.map((a) => ({ key: a.ratio, label: a.ratio, sub: times(a.size), ratio: ratioNumber(a.ratio) }));
  }
  return info.sizes.map((size) => ({ key: size, label: ratioOfSize(size), sub: times(size), ratio: ratioNumber(ratioOfSize(size)) }));
}

/** Whether the draft's aspect ratio is valid for this model; if not, use the model's default (the aspect ratio of its default size, or the default size itself); failing that, take the first option. */
export function sizeKeyFor(draft: Pick<ImageDraft, 'size'>, info: ImageModelInfo): string | null {
  const options = aspectOptions(info);
  if (!options.length) return null;
  if (draft.size && options.some((o) => o.key === draft.size)) return draft.size;
  const def = info.defaultSize;
  const byDefault = def ? (info.aspectRatios.find((a) => a.size === def)?.ratio ?? (info.sizes.includes(def) ? def : null)) : null;
  return byDefault && options.some((o) => o.key === byDefault) ? byDefault : options[0]!.key;
}

export function countFor(draft: Pick<ImageDraft, 'count'>, info: Pick<ImageModelInfo, 'maxCount'>): number {
  return Math.min(Math.max(1, info.maxCount), Math.max(1, Math.round(draft.count) || 1));
}

/** Steps for a local model: the draft's (clamped to range), otherwise the model's default; null for models that don't take steps. */
export function stepsFor(draft: Pick<ImageDraft, 'steps'>, info: Pick<ImageModelInfo, 'local'>): number | null {
  const range = info.local?.steps;
  if (!range) return null;
  if (draft.steps === null || !Number.isFinite(draft.steps)) return range.default;
  return Math.min(range.max, Math.max(range.min, Math.round(draft.steps)));
}

/** Switching models: the aspect ratio and count go back to the range this model accepts; the prompt and seed are kept. */
export function switchImageModel(draft: ImageDraft, option: ImageOption): Partial<ImageDraft> {
  return { model: option.key, size: sizeKeyFor({ size: draft.size }, option.info), count: countFor(draft, option.info) };
}

// ---- Validation and request ----

export function imageProblems(draft: ImageDraft, option: ImageOption | null): string[] {
  const problems: string[] = [];
  const prompt = draft.prompt.trim();
  if (!prompt) problems.push(M.emptyPrompt);
  if (!option) return problems;
  const info = option.info;
  const n = codePoints(prompt);
  if (n > info.maxPromptChars) problems.push(M.promptTooLong(n, info.maxPromptChars));
  if (draft.count > info.maxCount) problems.push(M.maxImages(info.maxCount));
  if (info.acceptsSeed && !parseSeed(draft.seed).ok) problems.push(M.seedInteger);
  return problems;
}

/** Parameters for `models.generateImage`: imports no video. */
export function imageRequest(draft: ImageDraft, option: ImageOption): Omit<GenerateImageRequest, 'commandId'> {
  const info = option.info;
  const size = sizeKeyFor(draft, info);
  const seed = parseSeed(draft.seed);
  const steps = stepsFor(draft, info);
  return {
    prompt: draft.prompt.trim(),
    provider: option.providerId,
    model: option.modelId,
    ...(size ? { size } : {}),
    count: countFor(draft, info),
    ...(info.acceptsSeed && seed.ok && seed.seed !== null ? { seed: seed.seed } : {}),
    ...(steps !== null ? { steps } : {}),
  };
}

/** The sentence beside the main button (design mock image-gen.jsx `statusOf`). */
export function imageStatus(draft: ImageDraft, option: ImageOption | null, tried: boolean): { text: string; bad: boolean } {
  if (!option) return { text: M.pickModel, bad: true };
  if (!option.usable) {
    if (option.local)
      return { text: option.why === localNotDownloaded() ? M.downloadFirst(option.label) : `${option.label} · ${option.why}`, bad: true };
    return { text: option.connected ? `${option.provider} · ${option.why}` : M.connectFirst(option.provider), bad: true };
  }
  const empty = M.emptyPrompt;
  const problem = imageProblems(draft, option).find((p) => tried || p !== empty);
  if (problem) return { text: problem, bad: true };
  const size = sizeKeyFor(draft, option.info);
  if (option.local) {
    // Time varies a lot from machine to machine, and this version has no measured per-step time to look up (the design's `statusLine` sentence for when nothing has been measured).
    const steps = stepsFor(draft, option.info);
    return {
      text: [M.local, size ? times(size) : null, steps ? M.steps(steps) : null, M.deviceTime, M.offline].filter(Boolean).join(' · '),
      bad: false,
    };
  }
  const count = countFor(draft, option.info);
  return { text: [option.modelId, size ? times(size) : null, M.images(count)].filter(Boolean).join(' · '), bad: false };
}

/** The sentence at the right of the model line (design mock image-gen.jsx `ModelLine`'s `m.desc`): derived from the capability description: how many aspect ratios, how many per run, whether it takes a seed. */
export function imageModelLine(info: ImageModelInfo): string {
  const aspects = aspectOptions(info).length;
  return [
    info.notes ?? null,
    aspects ? M.aspects(aspects) : M.providerSize,
    M.maxImages(info.maxCount),
    info.acceptsSeed ? M.takesSeed : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The header chip (design mock model-cloud-image.js `headerChip`): who serves it. Billing differs by provider, so it only says “billed by usage”. */
export function imageHeaderChip(option: Pick<ImageOption, 'provider' | 'local'> | null): string | null {
  if (!option) return null;
  return option.local ? M.localChip : M.cloudChip(option.provider);
}

// ---- Records ----

export interface ImageResult {
  artifactId: string;
  width: number;
  height: number;
  /** "Image 1". */
  name: string;
  /** "1024×1024 · seed 42" (only the size when there is no seed). */
  meta: string;
}

/** The generated image (only the image output is taken). */
export function imageResults(job: JobRecord): ImageResult[] {
  const g = job.generation?.capability === 'generateImage' ? job.generation : null;
  const seed = g?.seed ?? null;
  return (job.result?.outputs ?? []).flatMap((o, i) =>
    o.media.kind === 'image'
      ? [
          {
            artifactId: o.artifactId,
            width: o.media.width,
            height: o.media.height,
            name: M.imageName(i + 1),
            meta: [`${o.media.width}×${o.media.height}`, seed !== null ? M.seed(seed) : null].filter(Boolean).join(' · '),
          },
        ]
      : [],
  );
}

/**
 * The line shown while a local image generation is running (the local branch of the design mock model-cloud-image.js `phase`): denoising reports progress per step (`steps`), and once all steps are done it is decoding.
 * null when there is no per-step progress (cloud, or a local model still loading or encoding the prompt): use the generic stage wording.
 */
export function imageStepPhase(job: Pick<JobRecord, 'progress'>): string | null {
  const p = job.progress;
  if (!p || p.unit !== 'steps' || !p.total) return null;
  return p.done >= p.total ? M.decoding : M.stepOf(Math.max(1, p.done), p.total);
}

/** The prompt for an image generation task. */
export function imagePrompt(job: Pick<JobRecord, 'generation'>): string {
  return job.generation?.capability === 'generateImage' ? job.generation.prompt : '';
}

/** Subheading for a batch of results (design mock `IM.recordMeta`): "OpenAI · gpt-image-1 · 16:9 · 2 images". */
export function imageBatchMeta(job: JobRecord, provider: string): string {
  const g = job.generation?.capability === 'generateImage' ? job.generation : null;
  return [
    `${provider} · ${job.modelId}`,
    g ? (g.aspectRatio ?? (g.size ? times(g.size) : null)) : null,
    g ? M.images(g.count) : null,
    g?.steps !== undefined ? M.steps(g.steps) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Another version": this version's prompt and settings go back to the form, and the seed is cleared to randomize again. */
export function againDraft(job: JobRecord): Partial<ImageDraft> | null {
  const g = job.generation?.capability === 'generateImage' ? job.generation : null;
  if (!g) return null;
  return {
    prompt: g.prompt,
    model: modelKeyOf(job.providerId, job.modelId),
    size: g.aspectRatio ?? g.size,
    count: g.count,
    seed: '',
    steps: g.steps ?? null,
  };
}

/** "Try again": resubmits the frozen parameters unchanged (same provider and model). */
export function retryRequest(job: JobRecord): Omit<GenerateImageRequest, 'commandId'> | null {
  const g = job.generation?.capability === 'generateImage' ? job.generation : null;
  if (!g) return null;
  const size = g.aspectRatio ?? g.size;
  return {
    prompt: g.prompt,
    provider: job.providerId,
    model: job.modelId,
    ...(size ? { size } : {}),
    count: g.count,
    format: g.format,
    ...(g.seed !== null ? { seed: g.seed } : {}),
    ...(g.steps !== undefined ? { steps: g.steps } : {}),
  };
}

/** Filename for image downloads: "Image 1.png", with the extension taken from the output type. */
export function imageFileName(name: string, mediaType: string): string {
  const ext = mediaType === 'image/jpeg' ? 'jpg' : mediaType === 'image/webp' ? 'webp' : 'png';
  return `${name}.${ext}`;
}
