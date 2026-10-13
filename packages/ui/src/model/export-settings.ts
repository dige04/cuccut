import {
  burnedCaptionLanguages,
  defineMessages,
  DEFAULT_LOUDNESS_TARGET,
  type AudioExportFormat,
  type AudioExportSource,
  type DocumentRecord,
  type ExportScope,
  type ExportSettings,
  type Id,
  type LoudnessTarget,
  type Sequence,
  type SubtitleExportFormat,
  type TranscriptExportFormat,
} from '@cuccut/protocol';
import { captionChips, languageName } from './caption-tracks.ts';
import { zhHans } from './export-settings.zh-Hans.ts';
import { zhHant } from './export-settings.zh-Hant.ts';
import { ja } from './export-settings.ja.ts';
import { ko } from './export-settings.ko.ts';
import { es } from './export-settings.es.ts';
import { fr } from './export-settings.fr.ts';
import { de } from './export-settings.de.ts';
import { nl } from './export-settings.nl.ts';
import { ptBR } from './export-settings.pt-BR.ts';
import { it } from './export-settings.it.ts';
import { ru } from './export-settings.ru.ts';
import { pl } from './export-settings.pl.ts';
import { tr } from './export-settings.tr.ts';
import { vi } from './export-settings.vi.ts';

/** Export settings copy (English is the source of keys and types; translations are in `export-settings.zh-Hans.ts`). Format names (WAV, SRT, ...) are not put in the catalog. */
const en = {
  quality: { small: 'Smaller file', standard: 'Standard', high: 'High quality' } as Record<'small' | 'standard' | 'high', string>,
  qualityNote: {
    small: 'Stronger compression, slightly less detail, smaller file',
    standard: 'Default quality and size',
    high: 'More detail, larger file',
  } as Record<'small' | 'standard' | 'high', string>,
  loudnessOn: (lufs: string, truePeak: string) => `Normalize the whole mix to ${lufs} LUFS, with true peak no higher than ${truePeak} dBTP.`,
  loudnessOff: 'Off: export the mix as it is in the video.',
  audioFormatNote: {
    wav: 'Lossless · Largest file · Use this for further post-production',
    mp3: 'Universal · Works with podcast platforms, car stereos, and older devices',
    m4a: 'AAC · A little clearer than MP3 at the same bitrate · Native to Apple devices',
  } as Record<'wav' | 'mp3' | 'm4a', string>,
  dubGroup: (language: string | null) => (language ? `${language} voice-over` : 'This voice-over group'),
  mix: 'Export mix',
  mixNote: 'Same as what you hear on the timeline now',
  originalOnly: 'Original audio only',
  originalOnlyNote: 'Removes all voice-overs and restores original audio they muted',
  dubOnly: (label: string) => `${label} only`,
  dubOnlyNote: 'Keeps only this voice-over group, without the original audio, music, or other voice-overs',
  mono: 'Mono',
  stereo: 'Stereo',
  subtitleFormatNote: {
    srt: 'Universal: works with almost every player and platform',
    vtt: 'For web players, with position hints',
    ass: 'Keeps subtitle styling (font, outline, position); fewer players support it',
    json: 'Word-level timestamps for each entry, for scripts and tools',
  } as Record<'srt' | 'vtt' | 'ass' | 'json', string>,
  transcription: 'Transcript',
  plainText: 'Plain text',
  transcriptFormatNote: {
    md: 'Optional front matter, chapters as headings, speakers in bold, translations as quotes · Paste into notes or documents',
    txt: 'No formatting marks · Chapter headings get their own line',
  } as Record<'md' | 'txt', string>,
};
export type ExportSettingsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Settings on each page of the export popover → `settings` of `exports.create` (design draft model-export.js, model-audio-export.js, model-loudness.js,
 * model-transcript.js; architecture design §9.13; the contract is in packages/protocol/src/exports.ts).
 *
 * Only what the Runtime recognizes is computed: anything in the design draft that the Runtime has no matching parameter for (bitrate and size estimates, per-track overrides, splitting voices into parts, ...) is not here;
 * the UI greys it out and states the reason.
 */

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

// ---- Final video: size tiers ----

export type QualityKey = 'small' | 'standard' | 'high';

/**
 * Three size tiers (design draft `QUALITY`). The design draft works from bitrate multipliers; the Runtime's final-video parameters are constant quality (crf) or a target bitrate, so here they map to H.264 crf:
 * smaller file 26, standard leaves it unset (the Runtime default is 20), high quality 16. There is no bitrate or size estimate (the Runtime does not give one), so the description covers only the quality trade-off.
 */
export const QUALITY_CHOICES: readonly { key: QualityKey; label: string; crf: number | undefined; note: string }[] = [
  ...(
    [
      ['small', 26],
      ['standard', undefined],
      ['high', 16],
    ] as const
  ).map(([key, crf]) => ({
    key,
    crf,
    get label() {
      return M.quality[key];
    },
    get note() {
      return M.qualityNote[key];
    },
  })),
];

// ---- Final video: resolution ----

export interface ResolutionChoice {
  /** Short edge (pixels): the edge that the resolution refers to. */
  short: number;
  width: number;
  height: number;
  /** 「4K」「1080p」。 */
  label: string;
  /** The canvas's own size (no `height`). */
  source: boolean;
}

/** Short edge → display name (design draft `resLabel`): 2160 reads as “4K”, the rest read as “{short edge}p”. */
export function resolutionLabel(short: number): string {
  return short === 2160 ? '4K' : `${short}p`;
}

const STANDARD_SHORTS = [2160, 1080, 720];

/**
 * Selectable resolutions (design draft `resChoices`): the canvas's own size comes first (the default), followed by smaller standard tiers. Nothing is scaled up —
 * scaling up does not make the picture any clearer. Width and height follow the canvas ratio and are rounded to even numbers (consistent with how the Runtime handles yuv420p).
 *
 * When another aspect ratio (`ratio`) is chosen, the short edge is still set by the tier, and the long edge is derived from the aspect ratio and rounded to an even number (`outputSize`); tiers that would exceed the `exports.create` limits
 * (width 7680, height 4320) are not listed (for example, for a canvas whose short edge is over 2430 exporting 9:16, the canvas's own tier).
 */
export function resolutionChoices(canvas: { width: number; height: number }, ratio?: RatioChoice): ResolutionChoice[] {
  const shortSide = Math.min(canvas.width, canvas.height);
  if (!(shortSide > 0)) return [];
  const scaled = (short: number, source: boolean): ResolutionChoice => {
    if (ratio) return { short, ...outputSize(short, ratio), label: resolutionLabel(short), source };
    const k = short / shortSide;
    return { short, width: source ? canvas.width : even(canvas.width * k), height: source ? canvas.height : even(canvas.height * k), label: resolutionLabel(short), source };
  };
  const all = [scaled(shortSide, true), ...STANDARD_SHORTS.filter((s) => s < shortSide).map((s) => scaled(s, false))];
  return ratio ? all.filter((c) => c.width <= MAX_OUTPUT.width && c.height <= MAX_OUTPUT.height) : all;
}

/** Output width and height limits for `exports.create` (packages/protocol/src/schemas.ts). */
const MAX_OUTPUT = { width: 7680, height: 4320 };

// ---- Final video: aspect ratio ----

export type RatioKey = '16:9' | '9:16' | '1:1' | '4:5';

export interface RatioChoice {
  key: RatioKey;
  /** Width : height. */
  w: number;
  h: number;
}

/**
 * Common presets for exporting at another aspect ratio: landscape, portrait, square and 4:5 portrait (the design draft's `ratios` in data.js also has 4:3, 2.35:1 and others, but no 4:5; only these four are taken here).
 * Unlike the design draft, which crops to the new aspect ratio, v3 changes the aspect ratio by adding black bars: the picture is scaled by the canvas ratio to the largest size that fits and centered, the rest is black, and the layout is not reflowed
 * (architecture design §14, “output ratio for final video export”). The default “follow canvas” carries no width or height.
 */
export const RATIO_CHOICES: readonly RatioChoice[] = [
  { key: '16:9', w: 16, h: 9 },
  { key: '9:16', w: 9, h: 16 },
  { key: '1:1', w: 1, h: 1 },
  { key: '4:5', w: 4, h: 5 },
];

/** Aspect ratios the canvas can choose: presets with the same ratio as the canvas are not listed (that one is “follow canvas”). */
export function ratioChoices(canvas: { width: number; height: number }): RatioChoice[] {
  return RATIO_CHOICES.filter((r) => r.w * canvas.height !== r.h * canvas.width);
}

/** Output size (v2 `dims`): the short edge is set by the resolution, the long edge is derived from the aspect ratio and rounded to an even number; 1080 at 9:16 is 1080×1920. */
export function outputSize(short: number, ratio: { w: number; h: number }): { width: number; height: number } {
  const s = even(short);
  return ratio.w >= ratio.h ? { width: even((s * ratio.w) / ratio.h), height: s } : { width: s, height: even((s * ratio.h) / ratio.w) };
}

// ---- Loudness (design draft model-loudness.js) ----

export interface LoudnessForm {
  on: boolean;
  lufs: number;
  truePeak: number;
}

/** Off by default; when turned on, the initial values are the Runtime's default targets (−16 LUFS, −1.2 dBTP). */
export const DEFAULT_LOUDNESS_FORM: LoudnessForm = { on: false, lufs: DEFAULT_LOUDNESS_TARGET.integratedLufs, truePeak: DEFAULT_LOUDNESS_TARGET.truePeakDb };
/** Common presets: streaming −14; podcast / short video −16, −19; broadcast EBU R128 −23; ATSC A/85 −24. */
export const LUFS_CHOICES = [-14, -16, -19, -23, -24];
export const TRUE_PEAK_CHOICES = [-1, -1.2, -1.5, -2];

/** Typographic minus sign (U+2212); one decimal place appears only when needed: −16, −1.5. */
export function formatDb(value: number): string {
  const n = Math.round(value * 10) / 10;
  return `${n < 0 ? '−' : ''}${Math.abs(n)}`;
}

/** Presets in the dropdown: if the current value is not among the common presets, it is added, sorted from largest to smallest. */
export function dbChoices(list: readonly number[], value: number): number[] {
  return [...new Set([...list, value])].sort((a, b) => b - a);
}

export function loudnessTarget(form: LoudnessForm): LoudnessTarget | undefined {
  return form.on ? { integratedLufs: form.lufs, truePeakDb: form.truePeak } : undefined;
}

export function loudnessNote(form: LoudnessForm): string {
  return form.on ? M.loudnessOn(formatDb(form.lufs), formatDb(form.truePeak)) : M.loudnessOff;
}

// ---- Final video ----

export interface VideoForm {
  quality: QualityKey;
  /** The chosen short edge; null means the canvas's own size. */
  short: number | null;
  /** The chosen aspect ratio; null means follow the canvas. */
  ratio: RatioKey | null;
  burnCaptions: boolean;
  /** Content that cannot be drawn: rejected by default; after a rejection, if the user chooses “skip them and export again” (跳过它们再导), it is `skip`. */
  onUnsupported: 'fail' | 'skip';
  /** Sound source for the final video (same as audio export; only the sound changes, the picture stays the same). */
  source: AudioSourceKey;
}

export const DEFAULT_VIDEO_FORM: VideoForm = {
  quality: 'standard',
  short: null,
  ratio: null,
  burnCaptions: true,
  onUnsupported: 'fail',
  source: 'mix',
};

/** The form's aspect ratio applied to this canvas: undefined when following the canvas or when it matches the canvas ratio. */
export function videoRatio(form: Pick<VideoForm, 'ratio'>, canvas: { width: number; height: number }): RatioChoice | undefined {
  return ratioChoices(canvas).find((r) => r.key === form.ratio);
}

export function videoSettings(form: VideoForm, canvas: { width: number; height: number }, scope: ExportScope, loudness: LoudnessForm): ExportSettings {
  const ratio = videoRatio(form, canvas);
  const choices = resolutionChoices(canvas, ratio);
  const choice = choices.find((c) => c.short === form.short) ?? (ratio ? choices[0] : undefined);
  const crf = QUALITY_CHOICES.find((q) => q.key === form.quality)?.crf;
  const target = loudnessTarget(loudness);
  return {
    kind: 'video',
    format: 'mp4',
    ...scope,
    // When the aspect ratio changes, give both width and height (the engine adds black bars); when only the resolution changes, give only height, and width follows the canvas ratio.
    ...(ratio && choice ? { width: choice.width, height: choice.height } : choice && !choice.source ? { height: choice.height } : {}),
    ...(crf !== undefined ? { crf } : {}),
    burnCaptions: form.burnCaptions,
    ...(form.source !== 'mix' ? { source: audioSource(form.source) } : {}),
    ...(form.onUnsupported === 'skip' ? { onUnsupported: 'skip' as const } : {}),
    ...(target ? { audio: { loudness: target } } : {}),
  };
}

// ---- Audio (design draft model-audio-export.js) ----

export const AUDIO_FORMATS: readonly { key: AudioExportFormat; label: string; lossless: boolean; note: string }[] = [
  ...(
    [
      ['wav', 'WAV', true],
      ['mp3', 'MP3', false],
      ['m4a', 'M4A', false],
    ] as const
  ).map(([key, label, lossless]) => ({
    key,
    label,
    lossless,
    get note() {
      return M.audioFormatNote[key];
    },
  })),
];
export const BITRATES = [128, 192, 320];
export const DEFAULT_BITRATE = 192;

/** A dub group: instances whose `extensions['cuccut.dub']` carries the same `groupId` and that have no `stem` (separated background tracks carry a `stem` and are not the dub itself). */
export interface DubGroup {
  groupId: string;
  language: string | null;
  /** “English 配音” (English dub). */
  label: string;
  items: number;
}

export function dubGroups(sequence: Sequence): DubGroup[] {
  const groups = new Map<string, DubGroup>();
  for (const item of sequence.items) {
    const mark = item.extensions?.['cuccut.dub'] as { groupId?: unknown; language?: unknown; stem?: unknown } | undefined;
    if (!mark || typeof mark !== 'object' || typeof mark.groupId !== 'string' || mark.stem !== undefined) continue;
    const language = typeof mark.language === 'string' ? mark.language : null;
    const known = groups.get(mark.groupId);
    if (known) known.items += 1;
    else groups.set(mark.groupId, { groupId: mark.groupId, language, label: M.dubGroup(language ? languageName(language) : null), items: 1 });
  }
  return [...groups.values()];
}

/** Quick choices (design draft `presets`): final mix / original sound only / one option per dub group. “只要音乐” (music only) has no matching sound source in the Runtime, so it is greyed out. */
export type AudioSourceKey = 'mix' | 'original' | `dub:${string}`;

export interface AudioSourceChoice {
  key: AudioSourceKey;
  label: string;
  note: string;
}

export function audioSourceChoices(groups: readonly DubGroup[]): AudioSourceChoice[] {
  return [
    { key: 'mix', label: M.mix, note: M.mixNote },
    ...(groups.length ? [{ key: 'original' as const, label: M.originalOnly, note: M.originalOnlyNote }] : []),
    ...groups.map((g) => ({ key: `dub:${g.groupId}` as const, label: M.dubOnly(g.label), note: M.dubOnlyNote })),
  ];
}

export function audioSource(key: AudioSourceKey): AudioExportSource {
  return key === 'mix' || key === 'original' ? key : { dubGroupId: key.slice('dub:'.length) };
}

export interface AudioForm {
  format: AudioExportFormat;
  bitrate: number;
  channels: 1 | 2;
  source: AudioSourceKey;
}

export const DEFAULT_AUDIO_FORM: AudioForm = { format: 'mp3', bitrate: DEFAULT_BITRATE, channels: 2, source: 'mix' };

/** WAV does not accept a bitrate; the mix (the default source) carries no `source`. */
export function audioSettings(form: AudioForm, scope: ExportScope, loudness: LoudnessForm): ExportSettings {
  const target = loudnessTarget(loudness);
  return {
    kind: 'audio',
    format: form.format,
    ...scope,
    ...(form.source !== 'mix' ? { source: audioSource(form.source) } : {}),
    channels: form.channels,
    ...(form.format !== 'wav' ? { bitrateKbps: form.bitrate } : {}),
    ...(target ? { loudness: target } : {}),
  };
}

export function audioQualityLine(form: AudioForm): string {
  const channels = form.channels === 1 ? M.mono : M.stereo;
  return form.format === 'wav' ? `48 kHz · 16-bit · ${channels}` : `${form.bitrate} kbps · ${channels}`;
}

// ---- Subtitles ----

export const SUBTITLE_FORMATS: readonly { key: SubtitleExportFormat; label: string; note: string }[] = [
  ...(
    [
      ['srt', 'SRT'],
      ['vtt', 'VTT'],
      ['ass', 'ASS'],
      ['json', 'JSON'],
    ] as const
  ).map(([key, label]) => ({
    key,
    label,
    get note() {
      return M.subtitleFormatNote[key];
    },
  })),
];

/** A row in “which tracks to export” (导哪几条): one subtitle document (the same document on several tracks counts as one row). */
export interface SubtitleLane {
  documentId: Id;
  /** “原文” (original text) or a language name (named the same as on the subtitle track bar). */
  label: string;
  /** Document name. */
  name: string;
  kind: 'original' | 'translation' | 'speech';
  language: string | null;
  /** On the timeline (has enabled instances and the track is not disabled). */
  shown: boolean;
}

/** Subtitle documents on the timeline; when there are no subtitle tracks, falls back to the transcript document (`speech`), which the Runtime projects onto the timeline. */
export function subtitleLanes(sequence: Sequence, documents: Record<Id, DocumentRecord>): SubtitleLane[] {
  const lanes: SubtitleLane[] = [];
  for (const chip of captionChips(sequence, documents)) {
    const known = lanes.find((l) => l.documentId === chip.documentId);
    if (known) {
      known.shown ||= chip.state === 'on';
      continue;
    }
    lanes.push({ documentId: chip.documentId, label: chip.label, name: chip.name, kind: chip.kind, language: documents[chip.documentId]?.language ?? null, shown: chip.state === 'on' });
  }
  if (lanes.length) return [...lanes.filter((l) => l.kind === 'original'), ...lanes.filter((l) => l.kind !== 'original')];
  return Object.values(documents)
    .filter((d) => d.kind === 'speech')
    .map((d) => ({ documentId: d.id, label: M.transcription, name: d.name, kind: 'speech' as const, language: d.language ?? null, shown: false }));
}

/** When opened, checks the ones that are on in the timeline; if none are on, checks the first one. */
export function initialSubtitlePick(lanes: readonly SubtitleLane[]): Id[] {
  const shown = lanes.filter((l) => l.shown).map((l) => l.documentId);
  return shown.length ? shown : lanes.slice(0, 1).map((l) => l.documentId);
}

export type SubtitleBlock = 'none' | 'too-many' | 'each';

export interface SubtitlePlan {
  /** The document parameters sent to the Runtime; null when it cannot be exported. */
  options: { documentId: Id; bilingual?: { documentId: Id } } | null;
  block: SubtitleBlock | null;
}

/**
 * Selection → document parameters. One export produces only one subtitle file: one entry is itself; two entries with “combine into one” are bilingual (original text first);
 * two entries with “one file each” and three or more entries cannot be done by the Runtime in one go (they would need several exports), so they are greyed out.
 */
export function subtitlePlan(lanes: readonly SubtitleLane[], picked: readonly Id[], merge: boolean): SubtitlePlan {
  const ordered = lanes.filter((l) => picked.includes(l.documentId));
  if (!ordered.length) return { options: null, block: 'none' };
  if (ordered.length > 2) return { options: null, block: 'too-many' };
  if (ordered.length === 2 && !merge) return { options: null, block: 'each' };
  const [first, second] = ordered as [SubtitleLane, SubtitleLane | undefined];
  return { options: { documentId: first.documentId, ...(second ? { bilingual: { documentId: second.documentId } } : {}) }, block: null };
}

export function subtitleSettings(format: SubtitleExportFormat, options: NonNullable<SubtitlePlan['options']>, scope: ExportScope): ExportSettings {
  return { kind: 'subtitles', format, ...scope, ...options };
}

// ---- Transcript (design draft model-transcript.js, export-transcript.jsx) ----

export const TRANSCRIPT_FORMATS: readonly { key: TranscriptExportFormat; label: string; note: string }[] = [
  {
    key: 'md',
    label: 'Markdown',
    get note() {
      return M.transcriptFormatNote.md;
    },
  },
  {
    key: 'txt',
    get label() {
      return M.plainText;
    },
    get note() {
      return M.transcriptFormatNote.txt;
    },
  },
];

/** One source for a transcript: the transcription (or the subtitles on the timeline), together with the translation derived from it. */
export interface TranscriptSource {
  documentId: Id;
  name: string;
  language: string | null;
  translations: { documentId: Id; language: string | null; label: string }[];
}

/**
 * Documents that can produce a transcript: the transcription (`speech`) is checked first, and if there is none, the enabled subtitles on the timeline (in the same order the Runtime uses to pick the main transcript document).
 * A translation (`translation`) can only be the second document of a bilingual pair, not a transcript on its own — the Runtime's main document accepts only transcriptions and subtitles.
 */
export function transcriptSources(sequence: Sequence, documents: Record<Id, DocumentRecord>): TranscriptSource[] {
  const all = Object.values(documents);
  const speech = all.filter((d) => d.kind === 'speech');
  const shown = [
    ...new Set(sequence.items.filter((i) => i.type === 'caption' && i.enabled).map((i) => (i as { documentId: Id }).documentId)),
  ]
    .map((id) => documents[id])
    .filter((d): d is DocumentRecord => !!d);
  const primaries = speech.length ? speech : shown;
  return primaries.map((d) => ({
    documentId: d.id,
    name: d.name,
    language: d.language ?? null,
    translations: all
      .filter((t) => t.kind === 'translation' && t.sourceDocumentId === d.id)
      .map((t) => ({ documentId: t.id, language: t.language ?? null, label: t.language ? languageName(t.language) : t.name })),
  }));
}

export interface TranscriptForm {
  documentId: Id | null;
  /** The translation for bilingual comparison; null means only the original text is exported. */
  translationId: Id | null;
  format: TranscriptExportFormat;
  timestamps: boolean;
  /** Front-matter metadata: written only for Markdown; omitted for plain text. */
  frontmatter: boolean;
  /** Chapter subheadings: turned off by the UI when the video has no chapter markers. */
  chapters: boolean;
  speakers: boolean;
  /** Skip the cut-out parts; when off, it is the full original text before cutting, with times based on the source asset. */
  skipCut: boolean;
}

/** Only includes options that differ from the protocol defaults (front matter, chapters and timestamps off; speaker names and skipping cut-out parts on). */

export function transcriptSettings(form: TranscriptForm, documentId: Id, scope: ExportScope): ExportSettings {
  return {
    kind: 'transcript',
    format: form.format,
    ...scope,
    documentId,
    ...(form.translationId ? { bilingual: { documentId: form.translationId } } : {}),
    ...(form.timestamps ? { timestamps: true } : {}),
    ...(form.frontmatter && form.format === 'md' ? { frontmatter: true } : {}),
    ...(form.chapters ? { chapters: true } : {}),
    ...(form.speakers ? {} : { speakers: false }),
    ...(form.skipCut ? {} : { skipCut: false }),
  };
}

// ---- Project ----

export type ProjectTarget = 'xmeml' | 'portable';

export function projectSettings(target: ProjectTarget, missingAssets: 'fail' | 'skip'): ExportSettings {
  return target === 'portable'
    ? { kind: 'portable', ...(missingAssets === 'skip' ? { missingAssets: 'skip' as const } : {}) }
    : { kind: 'project', format: 'xmeml' };
}

// ---- File name ----

/** Same rule as the Runtime (export-publish.ts `safeFileStem`): strips characters not allowed in file names; if nothing is left, it becomes “video”. */
export function safeFileStem(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 120);
  return cleaned || 'video';
}

/**
 * The expected file name before submission (the Runtime's default naming, see `ExportDestination`): “video name.kind suffix.extension”. A final video's suffix is the subtitle language burned into the picture
 * (`burnedCaptionLanguages`, which needs `sequence`; no suffix when no subtitles are burned in), and `.partN` is added when several segments are each exported as a file.
 * If the name clashes, the Runtime adds a number, so this is only an estimate; after submission, read the file name from the job record instead.
 */
export function defaultFileNames(
  videoName: string,
  settings: ExportSettings,
  documents: Record<Id, DocumentRecord>,
  sequence?: Pick<Sequence, 'tracks' | 'items'>,
): string[] {
  const stem = safeFileStem(videoName);
  if (settings.kind === 'portable') return [`${stem}.cuccut`];
  if (settings.kind === 'project') return [`${stem}.xmeml.xml`];
  let suffix = '';
  if (settings.kind === 'video') suffix = settings.burnCaptions !== false && sequence ? burnedCaptionLanguages(sequence, documents).join('-') : '';
  else if (settings.kind === 'audio') suffix = 'audio';
  else if (settings.kind === 'transcript') suffix = 'transcript';
  else if (settings.kind === 'subtitles') {
    const primary = settings.documentId ? documents[settings.documentId]?.language : undefined;
    const secondaryId = typeof settings.bilingual === 'object' ? settings.bilingual.documentId : undefined;
    const secondary = secondaryId ? documents[secondaryId]?.language : undefined;
    suffix = primary ? (secondary ? `${primary}-${secondary}` : primary) : 'subtitles';
  }
  const base = suffix ? `${stem}.${suffix}` : stem;
  const parts = settings.ranges?.length ?? 0;
  if (parts > 1) return Array.from({ length: parts }, (_, i) => `${base}.part${i + 1}.${settings.format}`);
  return [`${base}.${settings.format}`];
}

/**
 * Where a final video goes when no location was chosen: the folder that holds the source video (`file` is the absolute path of the main asset, the result of `assetFilePath`). When the asset is inside the video's directory
 * (imported and managed), it is null and the Runtime's default (`exports/` under the project) is used, so nothing is written into the video directory. Both macOS / Linux and Windows paths are recognized.
 */
export function exportSourceDir(file: string | null, videoDir: string | null): string | null {
  if (!file) return null;
  const windows = /^[A-Za-z]:[\\/]/.test(file) || file.startsWith('\\\\');
  const sep = windows ? '\\' : '/';
  const cut = Math.max(file.lastIndexOf('/'), windows ? file.lastIndexOf('\\') : -1);
  if (cut < 0) return null;
  const dir = cut === 0 ? sep : /^[A-Za-z]:$/.test(file.slice(0, cut)) ? `${file.slice(0, cut)}${sep}` : file.slice(0, cut);
  if (videoDir) {
    const norm = (p: string) => {
      const trimmed = p.replace(/[\\/]+$/, '');
      return windows ? trimmed.replace(/\//g, '\\').toLowerCase() : trimmed;
    };
    const inner = norm(dir);
    const video = norm(videoDir);
    if (inner === video || inner.startsWith(`${video}${sep}`)) return null;
  }
  return dir;
}

/**
 * The directory handed to the Runtime for this export (`destination.dir`): the one chosen this time (null means “use default location”) takes priority, then the one remembered from before; if neither exists,
 * a final video goes to the folder that holds the source video (`exportSourceDir`), and other kinds are null, leaving the Runtime's default (`exports/` under the project).
 */
export function exportTargetDir(
  kind: ExportSettings['kind'],
  picked: string | null | undefined,
  saved: string | null,
  sourceDir: string | null,
): string | null {
  if (picked !== undefined) return picked;
  return saved ?? (kind === 'video' ? sourceDir : null);
}

// ---- Audio: one file per dub type (design draft export-audio.jsx “how many voice files”, model-audio-export.js `voiceParts` / `audioFiles`) ----

/** “How many voice files” (人声分几份): `one` mixes according to the quick choice into one file; `each` produces one file per dub group (each file is one `exports.create` call). */
export type VoiceSplit = 'one' | 'each';

/** One of the per-type files: a dub group, with its export settings and file name. */
export interface DubPart {
  groupId: string;
  label: string;
  settings: ExportSettings;
  /**
   * The fixed file name given when only one file is produced (`视频名.audio.<语言>.<扩展名>`, that is, video name.audio.language.extension), so you can tell at a glance which dub it is; the Runtime's default naming does not include the dub group.
   * When the range is several segments each exported as a file, `destination.fileName` cannot be used (it would apply to every segment), so it is null and the Runtime's default naming numbers them.
   */
  fileName: string | null;
}

/** The dub label in the file name: the language code; dubs with no language are named by position, dub1, dub2; clashes get -2, -3 added. */
export function dubTags(groups: readonly Pick<DubGroup, 'language'>[]): string[] {
  const seen = new Map<string, number>();
  return groups.map((g, i) => {
    const base = g.language ? safeFileStem(g.language) : `dub${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base}-${n}` : base;
  });
}

/**
 * One file per dub group: the source is `{ dubGroupId }`, meaning only this dub group; the original sound, music, other dubs and separated background sound are all left out
 * (the design draft gives each file its own background sound and music, which the Runtime's sound-source format cannot express).
 */
export function dubParts(groups: readonly DubGroup[], form: AudioForm, scope: ExportScope, loudness: LoudnessForm, videoName: string): DubPart[] {
  const tags = dubTags(groups);
  const single = !(scope.ranges && scope.ranges.length > 1);
  const stem = safeFileStem(videoName);
  return groups.map((g, i) => ({
    groupId: g.groupId,
    label: g.label,
    settings: audioSettings({ ...form, source: `dub:${g.groupId}` }, scope, loudness),
    fileName: single ? `${stem}.audio.${tags[i]}.${form.format}` : null,
  }));
}
