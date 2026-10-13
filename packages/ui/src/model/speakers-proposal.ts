import {
  defineMessages,
  live,
  type Id,
  type JobRecord,
  type ModelBundleStatus,
  type ProposedSpeaker,
  type Sequence,
  type SpeakerClip,
  type SpeakersSummary,
} from '@cuccut/protocol';
import { isBundleInstalled } from './models-local.ts';
import { projectSpeech } from './speech-cues.ts';
import { zhHans } from './speakers-proposal.zh-Hans.ts';
import { zhHant } from './speakers-proposal.zh-Hant.ts';
import { ja } from './speakers-proposal.ja.ts';
import { ko } from './speakers-proposal.ko.ts';
import { es } from './speakers-proposal.es.ts';
import { fr } from './speakers-proposal.fr.ts';
import { de } from './speakers-proposal.de.ts';
import { nl } from './speakers-proposal.nl.ts';
import { ptBR } from './speakers-proposal.pt-BR.ts';
import { it } from './speakers-proposal.it.ts';
import { ru } from './speakers-proposal.ru.ts';
import { pl } from './speakers-proposal.pl.ts';
import { tr } from './speakers-proposal.tr.ts';
import { vi } from './speakers-proposal.vi.ts';

/** Copy for the “Identify speakers” run state, renaming, and the receipt (translations are in `speakers-proposal.<locale>.ts`). */
const en = {
  stages: ['Voiceprints', 'Clustering', 'Tidying up'] as readonly string[],
  nameEmpty: 'Name can’t be empty',
  nameTooLong: (max: number) => `Names can be at most ${max} characters`,
  /** Receipt: `duration` is already formatted. */
  receipt: (speakers: number, duration: string, engine: string) =>
    `Applied · Found ${speakers} ${speakers === 1 ? 'speaker' : 'speakers'} · ${duration} · ${engine}`,
};
export type SpeakersProposalMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/*
 * Pure functions for the AI tool “Identify speakers” (prototype panel-aitools-flows.jsx `SpeakerFlow`, architecture design §6.6): which “speaker diarization” model pack to use, which stage the run has reached, the preview clips and renames on the confirm page, and the line on the receipt.
 */

/** The “speaker diarization” model pack on this computer (the Runtime lists only the one usable on this platform); null when none is listed. */
export function diarizePack(bundles: readonly ModelBundleStatus[]): ModelBundleStatus | null {
  return bundles.find((b) => b.capability === 'diarize') ?? null;
}

export function diarizePackReady(pack: ModelBundleStatus | null): boolean {
  return !!pack && isBundleInstalled(pack);
}

/** The three stages of the run state (prototype `stages`): voiceprint, clustering, and tidy-up. */
export const SPEAKER_STAGES: readonly string[] = live(() => M.stages);

/**
 * The stage the parent task is at right now: once the “tidy-up” step has started, it counts as stage 3; after the sub-task of the “diarize speakers” step reports `diarizing`, it counts as clustering; everything else (queued, loading the model, decoding, computing voiceprints) counts as stage 1.
 */
export function speakersStage(job: JobRecord | null, jobs: readonly JobRecord[]): number {
  const steps = job?.pipeline?.steps ?? [];
  const propose = steps.find((s) => s.name === 'propose');
  if (propose && propose.status !== 'pending') return 2;
  const diarize = steps.find((s) => s.name === 'diarize');
  const child = diarize?.jobId ? jobs.find((j) => j.jobId === diarize.jobId) : undefined;
  if (child && (child.phase === 'diarizing' || child.phase === 'validating' || child.phase === 'finalizing')) return 1;
  return 0;
}

/** `mm:ss` (`h:mm:ss` for an hour or more). */
export function clockText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const CLIP_CHARS = 8;

/** The text on a preview clip (prototype `00:14 · 先从一个…`, “starting from one…”): the material time plus the start of this sentence, truncated after 8 characters. */
export function clipLabel(clip: SpeakerClip, timescale: number): string {
  const chars = [...clip.text.trim()];
  const head = chars.length > CLIP_CHARS ? `${chars.slice(0, CLIP_CHARS).join('').trimEnd()}…` : chars.join('');
  return `${clockText(clip.start / (timescale || 1))} · ${head}`;
}

/**
 * The range the clip occupies on the timeline (seconds): this sentence on the material clock, projected through an instance that uses this asset, taking the first contiguous part; null when it was cut or is not on the timeline.
 */
export function clipWindow(sequence: Sequence, assetId: Id, clip: SpeakerClip, timescale: number): { start: number; end: number } | null {
  const scale = timescale || 1;
  const placed = projectSpeech(sequence, assetId, [
    { id: clip.sentenceId, start: clip.start / scale, end: clip.end / scale, text: clip.text, paragraphStart: false },
  ]);
  const first = placed[0];
  return first && first.end > first.start ? { start: first.start, end: first.end } : null;
}

export const NAME_MAX = 100;

/** The rename problem; null when there is none. */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return M.nameEmpty;
  if ([...trimmed].length > NAME_MAX) return M.nameTooLong(NAME_MAX);
  return null;
}

/** The `names` sent on submit: only the ones changed (trimmed, different from the proposal); undefined when none were changed. */
export function changedNames(speakers: readonly ProposedSpeaker[], names: Readonly<Record<Id, string>>): Record<Id, string> | undefined {
  const out: Record<Id, string> = {};
  for (const speaker of speakers) {
    const name = names[speaker.id]?.trim();
    if (name && name !== speaker.name) out[speaker.id] = name;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The names after applying: changed ones use the changed value. */
export function finalName(speaker: ProposedSpeaker, names: Readonly<Record<Id, string>>): string {
  return names[speaker.id]?.trim() || speaker.name;
}

/** Diarization time: `9.2s`; over a minute, `1m 5s`. */
export function durationText(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}

/** Receipt (prototype `Receipt`): `Applied · 3 speakers identified · 9.2s · local voiceprint model`. */
export function speakersReceiptText(summary: Pick<SpeakersSummary, 'speakers' | 'diarizeMs'>, engine: string): string {
  return M.receipt(summary.speakers.length, durationText(summary.diarizeMs), engine);
}
