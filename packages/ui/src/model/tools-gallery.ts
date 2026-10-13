import {
  defineMessages,
  localizeText,
  type ModelCapabilitiesView,
  type ModelServiceCapability,
  type PipelineInfo,
  type ToolInputKind,
  type ToolProblem,
  type ToolStatus,
} from '@cuccut/protocol';
import { cloudProviders } from './models-cloud.ts';
import type { ToolId } from './tool-catalog.ts';
import { zhHans } from './tools-gallery.zh-Hans.ts';
import { zhHant } from './tools-gallery.zh-Hant.ts';
import { ja } from './tools-gallery.ja.ts';
import { ko } from './tools-gallery.ko.ts';
import { es } from './tools-gallery.es.ts';
import { fr } from './tools-gallery.fr.ts';
import { de } from './tools-gallery.de.ts';
import { nl } from './tools-gallery.nl.ts';
import { ptBR } from './tools-gallery.pt-BR.ts';
import { it } from './tools-gallery.it.ts';
import { ru } from './tools-gallery.ru.ts';
import { pl } from './tools-gallery.pl.ts';
import { tr } from './tools-gallery.tr.ts';
import { vi } from './tools-gallery.vi.ts';

/** Copy for the status line on tool cards (translations in `tools-gallery.<语言>.ts`). */
const en = {
  transcode: 'Encoded on this computer with ffmpeg · nothing uploaded',
  linkReady: 'Download tool ready',
  pipelineMissing: 'This version of Runtime doesn’t have a pipeline for this tool yet, so it can’t be used for now',
  /** After the reason, the remedy follows (both sentences come from the Runtime; the trailing punctuation of the reason has been removed). */
  withRemedy: (message: string, remedy: string) => `${message}. ${remedy}`,
  localModels: (n: number) => `${n} local ${n === 1 ? 'model' : 'models'}`,
  cloudConnected: (n: number) => `${n} online ${n === 1 ? 'provider' : 'providers'} connected`,
  noSpeech: 'No speech synthesis model available yet',
  noImage: 'No image generation model available yet',
  noText: 'No text model available yet',
};
export type ToolsGalleryMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Tool overview (design mock page-tools.jsx `ToolsGallery`): one status line per card.
 * Whether a tool is usable follows the Runtime's `tools.list` (when unavailable, show its first reason). When usable, the model tools count local models and cloud providers from the capability view of the `models` topic, by `models`;
 * compression and merging run locally with ffmpeg on this computer, and importing from a link shows that the download tool is ready.
 */

/** Tools not built yet, and their reasons. None now: subtitle translation can already translate a subtitle file (`translate-subtitles` flow). */
const PLANNED_REASON: Partial<Record<ToolId, string>> = {};

/** Compress, merge and extract audio run through the Runtime's `transcode` flow, encoded locally with ffmpeg on this computer, not uploaded. */
export function transcodeCardStatus(): string {
  return M.transcode;
}
/** Status when importing from a link is usable (the download tool is ready). */
export function linkReadyStatus(): string {
  return M.linkReady;
}
/** The registry lists the tool, but the Runtime has no flow to run it yet (not in `pipelines.list`), so it can't be run. */
export function pipelineMissing(): string {
  return M.pipelineMissing;
}

/** Reason a tool isn't usable yet; null when it is usable. */
export function plannedReason(id: ToolId): string | null {
  return PLANNED_REASON[id] ?? null;
}

export interface ToolCardStatus {
  on: boolean;
  text: string;
}

/** The sentence shown for one unavailable reason: the Runtime's `message`, with the remedy appended when there is one. */
export function problemText(problem: ToolProblem, withRemedy = false): string {
  // Reasons and remedies are regenerated in the current UI language (the Runtime's language may differ, or they were read before the language was switched).
  const said = localizeText(problem.message, problem.messageRef);
  const remedy = problem.remedy ? localizeText(problem.remedy, problem.remedyRef) : '';
  if (!withRemedy || !remedy) return said;
  const message = said.replace(/[。.]$/, '');
  // When the remedy and the reason are the same sentence (the Runtime also gives CAPABILITY_NOT_CONFIGURED's hint as the reason), write it only once.
  if (message.includes(remedy.replace(/[。.]$/, ''))) return said;
  return M.withRemedy(message, remedy);
}

/**
 * Why this tool can't be run right now (per `tools.list`): the first reason when unavailable; if the flow that runs it (by input kind, `executionByInput`) is not in `pipelines.list`, `pipelineMissing()`.
 * `requiredCapabilities` also counts the optional capability limits selected for this run.
 * null when usable, or when the state hasn't arrived yet. When `pipelines` is null, the flow is not checked.
 */
export function toolBlock(
  status: ToolStatus | null | undefined,
  pipelines: readonly PipelineInfo[] | null,
  input?: ToolInputKind,
  withRemedy = false,
  requiredCapabilities: readonly ModelServiceCapability[] = [],
): string | null {
  if (!status) return null;
  if (!status.available) return status.problems[0] ? problemText(status.problems[0], withRemedy) : M.pipelineMissing;
  // Downloading itself doesn't need a transcription model; when the user also wants transcription, the matching optional capability limit is what blocks submission.
  const missing = status.limitations.find((problem) => problem.capability && requiredCapabilities.includes(problem.capability));
  if (missing) return problemText(missing, withRemedy);
  const execution = (input && status.executionByInput?.[input]) || status.execution;
  if (pipelines && execution.kind === 'pipeline' && !pipelines.some((p) => p.name === execution.pipeline)) return M.pipelineMissing;
  return null;
}

/** How many cloud providers are usable for this capability (connected and usable at this tier; agent providers such as Codex image generation are not counted). */
export function usableCloudCount(view: ModelCapabilitiesView, capability: ModelServiceCapability): number {
  // Vocal separation and music generation are local only; there are no cloud providers.
  if (capability === 'separateAudio' || capability === 'generateMusic') return 0;
  return cloudProviders(view, capability).filter((card) => card.connected && card.available).length;
}

/** How many usable local models are installed for this capability (`kind: 'local'` providers; text generation has no local models). */
export function usableLocalCount(view: ModelCapabilitiesView, capability: ModelServiceCapability): number {
  return view[capability].providers
    .filter((p) => p.kind === 'local' && p.available)
    .reduce((n, p) => n + p.models.filter((m) => m.available !== false && !m.unavailableReason).length, 0);
}

/** The tool's row for models: how many local and how many cloud providers; when there are none, write `none` per the tier and grey it out. */
function modelStatus(view: ModelCapabilitiesView, capability: ModelServiceCapability, none: string): ToolCardStatus {
  const local = usableLocalCount(view, capability);
  const cloud = usableCloudCount(view, capability);
  const parts = [local ? M.localModels(local) : null, cloud ? M.cloudConnected(cloud) : null].filter(Boolean);
  return parts.length ? { on: true, text: parts.join(' · ') } : { on: false, text: none };
}

/**
 * The card's status line; null when nothing can be said. `block` is the unavailable reason computed by `toolBlock` (per `tools.list`; on the Web service,
 * `WEB_METHOD_NOT_ALLOWED` and `PATH_OUTSIDE_PROJECT` also appear here): when given, show it and grey the card. null means confirmed usable; undefined means the state hasn't arrived yet.
 */
export function toolCardStatus(id: ToolId, view: ModelCapabilitiesView | null, block?: string | null): ToolCardStatus | null {
  const planned = plannedReason(id);
  if (planned) return { on: false, text: planned };
  const transcode = id === 'compress-video' || id === 'merge-video' || id === 'extract-audio';
  if (block) return { on: false, text: block };
  if (transcode) return block === null ? { on: true, text: M.transcode } : null;
  if (id === 'link-import') return block === null ? { on: true, text: M.linkReady } : null;
  if (!view) return null;
  if (id === 'synthesize-speech') return modelStatus(view, 'synthesizeSpeech', M.noSpeech);
  if (id === 'generate-image') return modelStatus(view, 'generateImage', M.noImage);
  if (id === 'generate-text') return modelStatus(view, 'generateText', M.noText);
  return null;
}
