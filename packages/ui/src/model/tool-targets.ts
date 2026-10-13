import {
  live,
  type Id,
  type JobRecord,
  type ToolCandidate,
  type ToolCandidateDocument,
  type TranscribeDestination,
} from '@cuccut/protocol';
import type { VideoToolId } from './tool-catalog.ts';
import { M } from './tool-targets-copy.ts';
import { langName } from './tools-models.ts';
import { sameLanguage } from './translate-setup.ts';

/**
 * Input targets for video tools (product design §2.7, design mock model-tool-targets.js): the picker rows for videos, disabled reasons, labels, preselection,
 * the hint when writing into an existing video, and translations that dubbing can pick; the landing target for retranscription, the impact preview when choosing "replace" (product design §5.11),
 * the transcription action in the Space video item menu, and the failed run to prefill for "Retry transcription…" (§4.4).
 *
 * Candidates come from the Runtime's `tools.candidates` (reads the Space catalog and content index, does not open videos): the `videos` rule lists all videos (transcripts not listed),
 * `videos-with-transcript` lists only videos that have a transcript (ones not indexed yet are still listed, and `documents` may be incomplete).
 * "Transcribing / queued / last failed" is inferred from the `jobs` topic (it is not in candidates); missing media and media missing inside a video can't be seen in candidates, so they are not judged.
 */

/** What this tool needs from a video: transcription needs nothing (media availability can't be seen in candidates), translated subtitles and translated dubbing need a transcript, and importing from a link into an existing video needs nothing. */
export const NEEDS: Record<VideoToolId, 'media' | 'transcript' | 'any'> = {
  transcribe: 'media',
  'translate-subtitles': 'transcript',
  dub: 'transcript',
  'link-import': 'any',
};

export type TranscribeState = 'running' | 'queued' | 'failed' | null;

export interface PickerTag {
  key: 'transcript' | 'translation' | 'dub' | 'pending';
  label: string;
}

export interface PickerRow {
  entryId: Id;
  videoId: Id | null;
  name: string;
  projectId: Id | null;
  lastActivityAt: string;
  indexed: boolean;
  documents: ToolCandidateDocument[];
  tags: PickerTag[];
  eligible: boolean;
  /** Why this can't be selected; null when it can. */
  reason: string | null;
}

/** Display name of a language tag (`en` → English); “unknown language” when there is none. */
export function langLabel(tag: string | null | undefined): string {
  return tag ? langName(tag) : M.unknownLanguage;
}

/** A set of languages → "English, Japanese"; the same language appearing more than once is recorded as "English ×2". */
export function langsText(langs: readonly (string | null)[]): string {
  const order: string[] = [];
  const count = new Map<string, number>();
  for (const lang of langs) {
    const label = langLabel(lang);
    if (!count.has(label)) order.push(label);
    count.set(label, (count.get(label) ?? 0) + 1);
  }
  return M.joinLangs(order.map((label) => (count.get(label)! > 1 ? M.langCount(label, count.get(label)!) : label)));
}

function isTranscribeJob(job: JobRecord): boolean {
  return job.kind === 'transcribe' || job.pipeline?.name === 'transcribe';
}

/** What transcription is doing for this video (inferred from `jobs`): running or queued; a most recent failure also counts (a later successful transcription does not). */
export function transcribeState(videoId: Id | null, jobs: readonly JobRecord[]): TranscribeState {
  if (!videoId) return null;
  const mine = jobs.filter((j) => j.videoId === videoId && isTranscribeJob(j));
  if (mine.some((j) => j.state === 'running')) return 'running';
  if (mine.some((j) => j.state === 'queued')) return 'queued';
  const last = [...mine].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0];
  return last?.state === 'failed' ? 'failed' : null;
}

/** Label on each picker row: transcript · Chinese / translation · English, Japanese / dub · English. */
export function tagsOf(documents: readonly ToolCandidateDocument[]): PickerTag[] {
  const out: PickerTag[] = [];
  if (documents.length) out.push({ key: 'transcript', label: M.tagTranscript(langsText(documents.map((d) => d.language))) });
  const translations = documents.flatMap((d) => d.translations);
  if (translations.length) out.push({ key: 'translation', label: M.tagTranslation(langsText(translations.map((t) => t.language))) });
  const dubs = documents.flatMap((d) => d.dubs);
  if (dubs.length) out.push({ key: 'dub', label: M.tagDub(langsText(dubs.map((d) => d.language))) });
  return out;
}

/** The label shown when the content hasn't been fully read and no transcript can be read: the video is selectable, and the Runtime picks the transcript when starting. */
export const PENDING_TAG: PickerTag = {
  key: 'pending',
  get label() {
    return M.tagPending;
  },
};

/** Why this video can't be selected for this tool; null when it can. */
export function blockReason(tool: VideoToolId, candidate: Pick<ToolCandidate, 'documents' | 'indexed'>, state: TranscribeState): string | null {
  const need = NEEDS[tool];
  if (need === 'any') return null;
  if (need === 'media') {
    if (state === 'running') return M.blockTranscribing;
    if (state === 'queued') return M.blockQueued;
    return null;
  }
  if (candidate.documents.length) return null;
  if (state === 'running') return M.blockTranscribingWait;
  if (state === 'queued') return M.blockQueuedWait;
  if (state === 'failed') return M.blockFailed;
  // Not indexed yet: the Runtime still lists it (it can't rule out a transcript), and the flow itself looks for the transcript when starting.
  if (!candidate.indexed) return null;
  return M.blockNoTranscript;
}

/**
 * Candidate rows for a tool: searched by name; selectable ones come first, and the order from the Runtime is kept within each group (most recent activity first).
 * Non-selectable ones stay in the list (greyed out), with `reason` saying why. `extra` holds the transcripts for the same videos (the transcription tool's `videos` rule doesn't list transcripts, so candidates from the with-transcript rule fill them in, for labels and the "does not overwrite" hint).
 */
export function pickerRows(
  tool: VideoToolId,
  candidates: readonly ToolCandidate[],
  jobs: readonly JobRecord[],
  query = '',
  extra?: ReadonlyMap<Id, ToolCandidateDocument[]>,
): PickerRow[] {
  const q = query.trim().toLowerCase();
  const rows = candidates
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .map((c, index) => {
      const documents = c.documents.length ? c.documents : (extra?.get(c.entryId) ?? []);
      const state = transcribeState(c.videoId, jobs);
      const reason = blockReason(tool, { documents, indexed: c.indexed }, state);
      const tags = tagsOf(documents);
      if (!reason && NEEDS[tool] === 'transcript' && !documents.length) tags.push(PENDING_TAG);
      const row: PickerRow = {
        entryId: c.entryId,
        videoId: c.videoId,
        name: c.name,
        projectId: c.projectId,
        lastActivityAt: c.lastActivityAt,
        indexed: c.indexed,
        documents,
        tags,
        eligible: reason === null,
        reason,
      };
      return { row, index };
    });
  rows.sort((a, b) => Number(b.row.eligible) - Number(a.row.eligible) || a.index - b.index);
  return rows.map((r) => r.row);
}

/** Collects transcript candidates into a table keyed by document ID (for `extra` in `pickerRows`). */
export function documentsByEntry(candidates: readonly ToolCandidate[]): Map<Id, ToolCandidateDocument[]> {
  return new Map(candidates.filter((c) => c.documents.length).map((c) => [c.entryId, c.documents]));
}

/** How many are selectable. */
export function eligibleCount(rows: readonly PickerRow[]): number {
  return rows.filter((r) => r.eligible).length;
}

/** Preselection: the given video if it is selectable, otherwise the first selectable one; null if none is selectable. */
export function pick(rows: readonly Pick<PickerRow, 'entryId' | 'eligible'>[], want: Id | null | undefined): Id | null {
  const hit = want ? rows.find((r) => r.entryId === want && r.eligible) : undefined;
  if (hit) return hit.entryId;
  return rows.find((r) => r.eligible)?.entryId ?? null;
}

/** The transcript to use: the chosen one, otherwise the last one (the most recently written); null if there is none. */
export function sourceDocument(row: Pick<PickerRow, 'documents'> | null, documentId?: Id | null): ToolCandidateDocument | null {
  if (!row || !row.documents.length) return null;
  return row.documents.find((d) => d.documentId === documentId) ?? row.documents[row.documents.length - 1]!;
}

/** The target languages for translation should not include the transcript's own language. */
export function targetLangs(langs: readonly string[], source: ToolCandidateDocument | null): string[] {
  const from = source?.language;
  return from ? langs.filter((l) => !sameLanguage(l, from)) : [...langs];
}

/**
 * Default target language (design mock tool-translate.jsx): keep the previously chosen one if it is still selectable; otherwise, if the source is English, translate to Simplified Chinese, and translate to English for anything else;
 * the first selectable one if neither can be chosen.
 */
export function defaultTargetLang(available: readonly string[], want: string | null, source: string | null): string | null {
  if (want && available.includes(want)) return want;
  const fallback = source && sameLanguage(source, 'en') ? 'zh-Hans' : 'en';
  return available.includes(fallback) ? fallback : (available[0] ?? null);
}

/**
 * Explanation shown when writing into an existing video; null when there is no matching result. Transcript: by default it creates a new video; choosing "replace this video's transcript" uses the replace-transcript flow (§5.11);
 * translations and dubs: do not overwrite, add a new one (§2.7). `lang`: the target language for translated subtitles / translated dubbing.
 */
export function duplicateNote(tool: VideoToolId, row: Pick<PickerRow, 'documents'> | null, lang?: string | null): string | null {
  if (!row) return null;
  const docs = row.documents;
  if (tool === 'transcribe' && docs.length) {
    return M.duplicateTranscript(langsText(docs.map((d) => d.language)));
  }
  if (tool === 'translate-subtitles' && lang && docs.some((d) => d.translations.some((t) => t.language && sameLanguage(t.language, lang)))) {
    return M.duplicateTranslation(langLabel(lang));
  }
  if (tool === 'dub' && lang && docs.some((d) => d.dubs.some((x) => x.language && sameLanguage(x.language, lang)))) {
    return M.duplicateDub(langLabel(lang));
  }
  return null;
}

/** Title of the hint shown when writing into an existing video. */
export const DUPLICATE_TITLE: Record<Exclude<VideoToolId, 'link-import'>, string> = live(() => M.duplicateTitle);

export interface TranslationOption {
  /** Translation document ID (`DubParams.translationId`). */
  id: Id;
  /** The transcript this was translated from (`DubParams.documentId`). */
  documentId: Id;
  lang: string | null;
  label: string;
  sub: string;
  /** Number of stale units (the source was changed, the translation left empty). */
  stale: number;
}

/** Translations that dubbing can use directly: one entry each, labelled with the language of the source transcript; when there are several in the same language, add "Copy N". */
export function translationOptions(row: Pick<PickerRow, 'documents'> | null): TranslationOption[] {
  if (!row) return [];
  const all = row.documents.flatMap((d) => d.translations.map((t) => ({ t, from: d })));
  return all.map(({ t, from }) => {
    const same = all.filter((x) => langLabel(x.t.language) === langLabel(t.language));
    const nth = same.length > 1 ? same.findIndex((x) => x.t.documentId === t.documentId) + 1 : null;
    return {
      id: t.documentId,
      documentId: from.documentId,
      lang: t.language,
      label: M.translationOption(langLabel(t.language), nth),
      sub: from.language ? M.translatedFrom(langLabel(from.language)) : '',
      stale: t.staleUnits,
    };
  });
}

// ---- Retranscription target (product design §5.11, §2.7; design mock model-tool-targets.js `retargetOptions` / `replaceImpact`) ----

export interface RetargetOption {
  key: TranscribeDestination;
  label: string;
  note: string;
}

/** Single choice of target: when the video already has a transcript, "New video" (default) or "Replace this video's transcript"; null when there is no transcript (no target is shown, and it writes directly into the video). */
export function retargetOptions(row: Pick<PickerRow, 'documents'> | null): RetargetOption[] | null {
  if (!row || !row.documents.length) return null;
  return [
    { key: 'new-video', label: M.destNewVideo, note: M.destNewVideoNote },
    { key: 'replace', label: M.destReplace, note: M.destReplaceNote },
  ];
}

/** Default target (also the default when the source was edited, §5.11). */
export const DEFAULT_DESTINATION: TranscribeDestination = 'new-video';

/** Default name for a new video: "<original name> · Retranscribe" (same as the Runtime's default when no name is given). */
export function newVideoName(name: string): string {
  return M.newVideoName(name);
}

export interface ReplaceImpact {
  /** One line per translation language: "English · 62 sentences". Not written when the reviewed-sentence count is not among the candidates. */
  translations: string[];
  /** One line per language's dub: the group count, and "sentences whose translation is unchanged are kept, marked as possibly inconsistent". */
  dubs: string[];
  /** Rule line for when a translation exists (how many sentences will go stale can't be computed before starting). */
  rule: string | null;
  undo: string;
}

/**
 * Impact preview when choosing "replace" (§5.11): before running, it only reports the existing counts. It reads facts from the candidates (content index): the translation's sentence count and language, and the dub groups;
 * the reviewed-sentence count and the number of subtitle pins are not in the index, so they are not reported (the result shows them). With several translations in the same language, each takes its own line.
 */
export function replaceImpact(row: Pick<PickerRow, 'documents'> | null): ReplaceImpact {
  const docs = row?.documents ?? [];
  const translations = docs.flatMap((d) => d.translations).map((t) => M.impactTranslation(langLabel(t.language), t.units));
  const groups = new Map<string, number>();
  for (const dub of docs.flatMap((d) => d.dubs)) {
    const label = langLabel(dub.language);
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  const dubs = [...groups].map(([label, n]) => M.impactDub(label, n));
  return { translations, dubs, rule: translations.length ? M.impactRule : null, undo: M.impactUndo };
}

// ---- Transcription action for a Space video item (product design §4.4; design mock model-space.js `transcribeAction`) ----

/** Already transcribed → Retranscribe…; last attempt failed → Retry transcription…; has media but never transcribed → Transcribe…. */
export type SpaceTranscribeAction = 'first' | 'redo' | 'retry';

/**
 * Which item to offer in the video item menu: none while transcribing, queued, or when the source file is missing (null). `transcribed` is whether a transcript exists (null if it can't be read:
 * candidates haven't loaded yet, so offer nothing, to avoid showing "Transcribe…" and then changing it to "Retranscribe…").
 */
export function spaceTranscribeAction(state: TranscribeState, transcribed: boolean | null, missing: boolean): SpaceTranscribeAction | null {
  if (missing || state === 'running' || state === 'queued') return null;
  if (state === 'failed') return 'retry';
  if (transcribed === null) return null;
  return transcribed ? 'redo' : 'first';
}

/** The most recent failed transcription for this video ("Retry transcription…" prefills its parameters): flow tasks take precedence (full parameters); one that later succeeded doesn't count; null if there is none. */
export function failedTranscribeJob(videoId: Id | null, jobs: readonly JobRecord[]): JobRecord | null {
  if (transcribeState(videoId, jobs) !== 'failed') return null;
  const mine = jobs.filter((j) => j.videoId === videoId && isTranscribeJob(j) && j.state === 'failed');
  const newest = (list: JobRecord[]) =>
    list.reduce<JobRecord | null>((best, j) => (!best || j.updatedAt > best.updatedAt ? j : best), null);
  return newest(mine.filter((j) => j.kind === 'pipeline')) ?? newest(mine);
}

/** The speech model and options of the failed run (`pipeline.params`; when absent, the provider and model on the task record). */
export interface AsrRetryParams {
  provider: string | null;
  model: string | null;
  language: string | null;
  diarize: boolean | null;
}

export function retryParamsOf(job: JobRecord): AsrRetryParams {
  const p = job.pipeline?.params ?? {};
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
  // The provider and model on a flow parent task record are not the ones used for transcription; only direct transcription tasks fall back to them.
  const own = job.kind === 'pipeline' ? null : job;
  return {
    provider: text(p.provider) ?? text(own?.providerId),
    model: text(p.model) ?? text(own?.modelId),
    language: text(p.language),
    diarize: typeof p.diarize === 'boolean' ? p.diarize : null,
  };
}
