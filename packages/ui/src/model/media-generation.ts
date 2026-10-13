import { defineMessages, type GenerateImageRequest, type Id, type ImageModelInfo, type JobRecord, type SynthesizeSpeechRequest } from '@cuccut/protocol';
import { zhHans } from './media-generation.zh-Hans.ts';
import { zhHant } from './media-generation.zh-Hant.ts';
import { ja } from './media-generation.ja.ts';
import { ko } from './media-generation.ko.ts';
import { es } from './media-generation.es.ts';
import { fr } from './media-generation.fr.ts';
import { de } from './media-generation.de.ts';
import { nl } from './media-generation.nl.ts';
import { ptBR } from './media-generation.pt-BR.ts';
import { it } from './media-generation.it.ts';
import { ru } from './media-generation.ru.ts';
import { pl } from './media-generation.pl.ts';
import { tr } from './media-generation.tr.ts';
import { vi } from './media-generation.vi.ts';
import { aspectOptions, imageRequest, type AspectOption, type ImageDraft, type ImageOption } from './tools-image.ts';
import { didNotFinish } from './tools-records.ts';
import { jobLive } from './task-list.ts';
import { speechRequest, type SpeechOption, type TtsDraft } from './tools-tts.ts';

/**
 * Editor-side panels “Audio › Generate speech / Clone voice” and “Image › AI generate” (design files panel-tts.jsx, panel-image-gen.jsx):
 * they share the same form and request as the tool pages, and only add `videoId`. Per the contract, when a generation task with `videoId` finishes, the Runtime imports the result as an asset of this video (`result.outputs[i].assetId`, with source recorded as `generated`), but does not put it on the timeline; placing it is still a separate step (`placeAsset`).
 */

// ---- Request ----

/** Copy for this section (the English is the source of the keys and types; translations live in `media-generation.<locale>.ts`). */
const en = {
  /** Name given to a generated speech asset when imported: the start of the text (`head`, already with an ellipsis when truncated). */
  speechAssetName: (head: string) => `Speech: ${head}`,
};

export type MediaGenerationMessages = typeof en;

const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Name given to a generated speech asset when imported: “Voice:” followed by the start of the text (truncated to 24 characters, same as the Runtime default name). */
export function speechAssetName(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return M.speechAssetName(`${chars.slice(0, 24).join('')}${chars.length > 24 ? '…' : ''}`);
}

export function editorSpeechRequest(draft: TtsDraft, option: SpeechOption, videoId: Id): Omit<SynthesizeSpeechRequest, 'commandId'> {
  const request = speechRequest(draft, option);
  return { ...request, videoId, name: speechAssetName(request.text) };
}

/** Image-generation draft in the editor: adds a “follow video canvas” option (design `fit`). */
export interface EditorImageDraft extends ImageDraft {
  /** Aspect ratio follows the video canvas: when this option is chosen, `size` is not used and the closest preset to the canvas is picked. */
  fit: boolean;
}

/** Which aspect-ratio preset is closest to the canvas (by logarithmic distance of the aspect ratio); null when this model does not allow choosing a size. */
export function canvasAspect(canvas: { width: number; height: number }, options: readonly AspectOption[]): AspectOption | null {
  if (!options.length || canvas.width <= 0 || canvas.height <= 0) return null;
  const target = Math.log(canvas.width / canvas.height);
  let best = options[0]!;
  for (const o of options) if (Math.abs(Math.log(o.ratio) - target) < Math.abs(Math.log(best.ratio) - target)) best = o;
  return best;
}

/** The “follow video canvas” preset; null when there are no selectable aspect ratios. */
export function fittedAspect(info: Pick<ImageModelInfo, 'aspectRatios' | 'sizes'>, canvas: { width: number; height: number }): AspectOption | null {
  return canvasAspect(canvas, aspectOptions(info));
}

/** The draft as actually submitted: when “follow video canvas” is chosen, the aspect ratio is replaced by the canvas preset. */
export function effectiveImageDraft(draft: EditorImageDraft, info: ImageModelInfo, canvas: { width: number; height: number }): ImageDraft {
  const fitted = draft.fit ? fittedAspect(info, canvas) : null;
  return fitted ? { ...draft, size: fitted.key } : draft;
}

export function editorImageRequest(
  draft: EditorImageDraft,
  option: ImageOption,
  videoId: Id,
  canvas: { width: number; height: number },
): Omit<GenerateImageRequest, 'commandId'> {
  return { ...imageRequest(effectiveImageDraft(draft, option.info, canvas), option), videoId };
}

/** Retries must also return to this video: the tool page's “resubmit with frozen parameters” does not carry `videoId`, so it is added here. */
export function withVideo<R extends object>(request: R | null, videoId: Id): (R & { videoId: Id }) | null {
  return request ? { ...request, videoId } : null;
}

// ---- Records ----

/** Generation tasks of this kind in this video, newest first; tasks hidden on this machine are not listed. Not limited to the submitter: tasks an Agent generated in this video are included too. */
export function videoGenerationJobs(jobs: readonly JobRecord[], videoId: Id, kind: 'synthesizeSpeech' | 'generateImage', hidden: readonly Id[]): JobRecord[] {
  const skip = new Set(hidden);
  return jobs
    .filter((job) => job.kind === kind && job.videoId === videoId && !skip.has(job.jobId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** The asset a generation result was imported as (null if the import failed or has not happened yet). */
export function outputAsset(job: Pick<JobRecord, 'result'>, artifactId: string): Id | null {
  return job.result?.outputs?.find((o) => o.artifactId === artifactId)?.assetId ?? null;
}

/**
 * Where the generate-speech subpage is (design `phase`): setup before submission; run while queued, running, or just submitted but not yet in the task mirror;
 * done when finished; failed when it did not succeed (failed, interrupted, or outcome unknown); cancelling returns to setup.
 */
export type TtsStage = 'setup' | 'run' | 'done' | 'failed';

export function ttsStage(jobId: Id | null, job: JobRecord | null): TtsStage {
  if (!jobId) return 'setup';
  if (!job) return 'run';
  if (jobLive(job)) return 'run';
  if (job.state === 'completed') return 'done';
  if (didNotFinish(job)) return 'failed';
  return 'setup';
}
