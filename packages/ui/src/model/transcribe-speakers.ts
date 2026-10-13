import { defineMessages, type Id, type JobRecord, type ModelBundleStatus, type ModelCapabilitiesView, type ModelRef, type TranscribeModelInfo } from '@cuccut/protocol';
import { bundleName, downloadBytes, isBundleInstalled } from './models-local.ts';
import { zhHans } from './transcribe-speakers.zh-Hans.ts';
import { zhHant } from './transcribe-speakers.zh-Hant.ts';
import { ja } from './transcribe-speakers.ja.ts';
import { ko } from './transcribe-speakers.ko.ts';
import { es } from './transcribe-speakers.es.ts';
import { fr } from './transcribe-speakers.fr.ts';
import { de } from './transcribe-speakers.de.ts';
import { nl } from './transcribe-speakers.nl.ts';
import { ptBR } from './transcribe-speakers.pt-BR.ts';
import { it } from './transcribe-speakers.it.ts';
import { ru } from './transcribe-speakers.ru.ts';
import { pl } from './transcribe-speakers.pl.ts';
import { tr } from './transcribe-speakers.tr.ts';
import { vi } from './transcribe-speakers.vi.ts';

/** Copy for the “Identify speakers” toggle (translations are in `transcribe-speakers.<language>.ts`). */
const en = {
  packFallback: 'Speaker diarization',
  builtinNote: (model: string) => `${model} tells speakers apart on its own, during transcription`,
  builtinSummary: 'Identify speakers · built into the model',
  noneNote: (model: string) => `${model} doesn’t tell speakers apart. If you need it, switch to a local model or a service that has it built in`,
  missingNote: (pack: string, size: string | null) => `Download “${pack}”${size ? ` (${size})` : ''} first to tell speakers apart`,
  missingSummary: 'Identify speakers · download the model first',
  onNote: 'After transcribing, “Speaker diarization” labels each sentence with its speaker, and subtitles and transcripts include the names',
  summaryOn: 'Identify speakers',
  offNote: 'Speakers aren’t told apart; subtitles and transcripts won’t include names',
  summaryOff: 'Don’t identify speakers',
  /** The line on the download gate card: when `pct` is null, the progress is not yet known. */
  downloading: (pack: string, pct: number | null) => `Downloading “${pack}”${pct === null ? '…' : ` · ${pct}%`}`,
};
export type TranscribeSpeakersMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/*
 * Under the speech model, “More options › Identify speakers” (product design §2.7, design mockup model-tool-runs.js `speakerSwitch` / `speakerCopy`,
 * tool-transcribe.jsx `AsrMoreOptions`). Shared by the transcription tool page and re-transcription.
 * - The model separates speakers itself (`speakers: 'native'`, MOSS Transcribe): on, locked;
 * - Speakers are separated after transcription with the “speaker diarization” model pack (the description has `diarizationPack`, e.g. Qwen3-ASR, Whisper): can be toggled; when the pack is installed it defaults to on, and when it is not installed it defaults to off,
 *   and turning it on without the pack installed requires downloading it first;
 * - No separation (online services, and models without a registered model pack): off, locked.
 * A value the user has set by hand (`pick`) is kept across models; when never set, the defaults above apply.
 */

export type SpeakerKind = 'builtin' | 'pack' | 'none';

export interface SpeakerSwitch {
  kind: SpeakerKind;
  /** Whether this run identifies speakers: sent unchanged as `diarize` on submit. */
  on: boolean;
  /** Cannot be toggled (the model separates speakers itself, or does not separate them). */
  locked: boolean;
  /** On, but “speaker diarization” is not installed: download it first, otherwise it cannot start. */
  missing: boolean;
  /** After transcription, “Identify speakers” is listed as a separate step (not listed separately when the model separates speakers itself). */
  step: boolean;
}

/** The 「说话人区分」 model pack this model needs after transcription; null when the model separates speakers itself or does not separate them. */
export function speakerPackId(info: TranscribeModelInfo | null | undefined): string | null {
  if (!info || info.speakers === 'native') return null;
  return info.diarizationPack ?? null;
}

/** Whether the model pack is installed; when this model pack is not listed on this computer, the model description is used (`speakers: 'pack'` means installed). */
export function speakerPackInstalled(info: TranscribeModelInfo | null | undefined, pack: ModelBundleStatus | null): boolean {
  return pack ? isBundleInstalled(pack) : info?.speakers === 'pack';
}

/**
 * The toggle's current state. `pick`: the value the user set by hand, null if never set; `installed`: whether 「说话人区分」 is installed (`speakerPackInstalled`).
 * Only models whose description has `diarizationPack`, or that already have `speakers: 'pack'`, can be toggled.
 */
export function speakerSwitch(info: TranscribeModelInfo | null | undefined, pick: boolean | null, installed: boolean): SpeakerSwitch {
  const kind: SpeakerKind =
    info?.speakers === 'native' ? 'builtin' : info && (info.diarizationPack || info.speakers === 'pack') ? 'pack' : 'none';
  if (kind === 'builtin') return { kind, on: true, locked: true, missing: false, step: false };
  if (kind === 'none') return { kind, on: false, locked: true, missing: false, step: false };
  const on = pick === null ? installed : pick;
  return { kind, on, locked: false, missing: on && !installed, step: on };
}

/** The 「说话人区分」 line: name and size (the total of the download job; when absent, computed from the missing components, the same figure as the settings page; not written when nothing is known). */
export interface SpeakerPackFacts {
  name: string;
  size: string | null;
}

export function speakerPackFacts(pack: ModelBundleStatus | null, size: (bytes: number) => string): SpeakerPackFacts {
  const total = pack ? pack.install?.totalBytes || downloadBytes(pack) : null;
  return { name: pack ? bundleName(pack) : M.packFallback, size: total ? size(total) : null };
}

/** The sentence below the toggle, and the status on the collapsed heading. `name`: the speech model's name as shown to people. */
export function speakerCopy(s: SpeakerSwitch, name: string, pack: SpeakerPackFacts): { note: string; summary: string } {
  if (s.kind === 'builtin') return { note: M.builtinNote(name), summary: M.builtinSummary };
  if (s.kind === 'none') return { note: M.noneNote(name), summary: M.summaryOff };
  if (s.missing) return { note: M.missingNote(pack.name, pack.size), summary: M.missingSummary };
  if (s.on) return { note: M.onNote, summary: M.summaryOn };
  return { note: M.offNote, summary: M.summaryOff };
}

/** The line on the download gate card: `说话人区分 · 23 MB` (Speaker diarization · 23 MB), and while downloading `正在下载「说话人区分」· 40%` (Downloading 「说话人区分」 · 40%). */
export function speakerGateLine(pack: SpeakerPackFacts, downloadingPct: number | null | undefined): string {
  if (downloadingPct !== undefined) return M.downloading(pack.name, downloadingPct);
  return pack.size ? `${pack.name} · ${pack.size}` : pack.name;
}

// ---- Run view ----

/** The job that actually does the transcription in a transcription run (`models.transcribe`, submitted by the flow, with the parent job as submitter); null before submission. */
export function transcribeJobOf(parentJobId: Id, jobs: readonly JobRecord[]): JobRecord | null {
  let hit: JobRecord | null = null;
  for (const j of jobs) {
    if (j.kind !== 'transcribe' || j.submitter.kind !== 'pipeline' || j.submitter.id !== parentJobId) continue;
    if (!hit || j.createdAt > hit.createdAt) hit = j;
  }
  return hit;
}

/**
 * Whether the step list of this transcription should list 「识别说话人」 separately: only when `diarize: true` and it is done by the 「说话人区分」 model pack (not listed separately when the model separates speakers itself).
 * The model used is the one recorded by the transcription job; before submission, it uses the frozen parameters, and then the effective default. When the model cannot be identified, it is not listed separately.
 */
export function diarizeStepOf(job: JobRecord, jobs: readonly JobRecord[], view: ModelCapabilitiesView | null): boolean {
  const pipeline = job.pipeline;
  if (!pipeline || pipeline.name !== 'transcribe' || pipeline.params.diarize !== true || !view) return false;
  const child = transcribeJobOf(job.jobId, jobs);
  const params = pipeline.params;
  const ref = child
    ? { providerId: child.providerId, modelId: child.modelId }
    : typeof params.provider === 'string' && typeof params.model === 'string'
      ? { providerId: params.provider, modelId: params.model }
      : view.transcribe.effective;
  return ref ? speakerPackId(transcribeModelInfo(view, ref)) !== null : false;
}

/** One speech recognition model in the capability view (by provider and model ID); null when not found. */
export function transcribeModelInfo(view: ModelCapabilitiesView, ref: ModelRef): TranscribeModelInfo | null {
  const provider = view.transcribe.providers.find((p) => p.providerId === ref.providerId);
  return provider?.models.find((m) => m.modelId === ref.modelId) ?? null;
}
