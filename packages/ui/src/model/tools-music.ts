import type { GenerateMusicRequest, Id, JobRecord, ModelCapabilitiesView, MusicMode, MusicModelInfo, MusicPlanning } from '@cuccut/protocol';
import { M } from './tools-music-copy.ts';
import { codePoints, localModelOptions, localNotDownloaded, modelKeyOf, parseSeed, type ToolModelOption } from './tools-models.ts';

/**
 * Local music generation (design mocks model-music.js, tool-music.jsx, settings-music.jsx): Tools › Generate music and the Settings › Music generation "Preview"
 * share code with the editor's AI tool "Generate soundtrack". Form fields are named after `GenerateMusicRequest` (mode / style / lyrics / targetDurationSec /
 * maxDurationSec / planning / seed / model); converting duration to semantic tokens follows the same rule as the Runtime (25 tokens per second).
 * The duration cap, planning method and step count come from the model's capability description, not hard-coded numbers for any one model.
 */

export type MusicOption = ToolModelOption<MusicModelInfo>;

export { localNotDownloaded };

/** Local music model packs: all are listed (uninstalled ones too; choosing one shows a download card). Music generation only has local models. */
export function musicModelOptions(view: ModelCapabilitiesView): MusicOption[] {
  return localModelOptions(view, 'generateMusic');
}

/** Semantic tokens per second (the Runtime's `semantic_max_tokens` is converted with it). */
export const TOKENS_PER_SEC = 25;
/** The duration slider's minimum, step and default; the maximum comes from the model's `maxDurationSec`. */
export const DURATION = { min: 10, step: 5, dflt: 30 } as const;
/** The default cap leaves 20% more than the target, since the model may write a bit long; a result that hits the cap carries a "truncated" warning. */
export const MAX_HEADROOM = 1.2;
/** Estimated time = duration × factor (Apple Silicon and CPU); the UI only says "about". */
export const SPEED = { silicon: 6, cpu: 20 } as const;
/** The cap used when the model doesn't state a duration cap (the value registered for YuE2). */
const FALLBACK_MAX_SEC = 300;

export const MUSIC_MODE_ORDER: readonly MusicMode[] = ['instrumental', 'song'];
/** Planning arrangements (design `PLANNINGS`): full arrangement, melody first, generate directly. */
export const MUSIC_PLANNING_ORDER: readonly MusicPlanning[] = ['full', 'melody', 'off'];

export type MusicStyleKey = 'calm-piano' | 'upbeat-pop' | 'lofi' | 'ambient' | 'acoustic' | 'epic';

/** Style chips: click to fill the style box. What is sent to the model is an English description (YuE2 is trained on English tags) and does not change with the UI language; the name on the chip is in the copy. */
export const MUSIC_STYLES: readonly { key: MusicStyleKey; style: string }[] = [
  { key: 'calm-piano', style: 'calm solo piano, slow tempo, soft, cinematic' },
  { key: 'upbeat-pop', style: 'upbeat pop, bright synths, clean drums, 120 bpm' },
  { key: 'lofi', style: 'lo-fi hip hop beat, warm, vinyl crackle, relaxed' },
  { key: 'ambient', style: 'ambient electronic, slow pads, airy, minimal percussion' },
  { key: 'acoustic', style: 'acoustic folk guitar, fingerpicking, warm, intimate' },
  { key: 'epic', style: 'epic orchestral, strings and brass, building, cinematic trailer' },
];

export const styleLabel = (key: MusicStyleKey): string => M.styles[key];
export const modeLabel = (mode: MusicMode): string => M.modes[mode].label;
export const modeDesc = (mode: MusicMode): string => M.modes[mode].desc;
export const planningLabel = (planning: MusicPlanning): string => M.plannings[planning].label;
export const planningDesc = (planning: MusicPlanning): string => M.plannings[planning].desc;

export interface MusicDraft {
  mode: MusicMode;
  style: string;
  lyrics: string;
  targetDurationSec: number;
  /** A cap the user has edited by hand; null means it follows the target (20% more). */
  maxDurationSec: number | null;
  planning: MusicPlanning;
  seed: string;
  /** `providerId/modelId`; null means none chosen yet. */
  model: string | null;
}

export const BLANK_MUSIC: MusicDraft = {
  mode: 'instrumental',
  style: '',
  lyrics: '',
  targetDurationSec: DURATION.dflt,
  maxDurationSec: null,
  planning: 'melody',
  seed: '',
  model: null,
};

/** This model's duration cap (seconds). */
export function maxSecOf(info: Pick<MusicModelInfo, 'maxDurationSec'> | null | undefined): number {
  return info?.maxDurationSec && info.maxDurationSec > 0 ? info.maxDurationSec : FALLBACK_MAX_SEC;
}

/**
 * Video duration → usable target duration: rounded up to a multiple of 5 seconds (music is never shorter than the video, so it is trimmed, not padded), clamped to the range; with no duration, use the default
 * (a long video above the cap is clamped to the cap, and when added to the video it loops to fill, see `soundtrackFor` and music-bed.ts).
 */
export function clampDuration(sec: number | null | undefined, max = FALLBACK_MAX_SEC): number {
  const n = Number(sec);
  if (!(n > 0)) return DURATION.dflt;
  return Math.min(max, Math.max(DURATION.min, Math.ceil(n / DURATION.step) * DURATION.step));
}

/**
 * The part for entering "Generate soundtrack" (product design §2.7 "Generate soundtrack"; design mock `soundtrackFor`): when the video is no longer than this model's single-run cap, the target duration
 * is prefilled from the video and one piece covers it all; when longer, the cap is prefilled and `loop` is true. When added to the video it loops to fill, with cross-faded seams and a fade-out at the end, and the banner must say so.
 */
export function soundtrackFor(videoSec: number | null | undefined, max = FALLBACK_MAX_SEC): { targetDurationSec: number; loop: boolean } {
  const v = Number(videoSec);
  if (!(v > max)) return { targetDurationSec: clampDuration(v, max), loop: false };
  return { targetDurationSec: max, loop: true };
}

/** Cap: the hand-edited one if set; otherwise 20% more than the target, not exceeding the model's cap. */
export function maxOf(draft: Pick<MusicDraft, 'targetDurationSec' | 'maxDurationSec'>, max = FALLBACK_MAX_SEC): number {
  if (draft.maxDurationSec) return draft.maxDurationSec;
  return Math.min(max, Math.round((draft.targetDurationSec || DURATION.dflt) * MAX_HEADROOM));
}

/** Budget: the most semantic tokens this piece of music may generate. */
export function tokens(sec: number): number {
  return Math.max(1, Math.round((sec || 0) * TOKENS_PER_SEC));
}

/** Planning methods this model accepts (in the order shown in the UI); when the model doesn't say, all three are offered. */
export function planningsOf(info: Pick<MusicModelInfo, 'local'> | null | undefined): MusicPlanning[] {
  const allowed = info?.local?.planning.options;
  return MUSIC_PLANNING_ORDER.filter((p) => !allowed || allowed.includes(p));
}

/** Whether the draft's planning is valid for this model; if not, use the model's default, failing that the first one. */
export function planningFor(draft: Pick<MusicDraft, 'planning'>, info: Pick<MusicModelInfo, 'local'> | null | undefined): MusicPlanning {
  const options = planningsOf(info);
  if (options.includes(draft.planning)) return draft.planning;
  const dflt = info?.local?.planning.default;
  return dflt && options.includes(dflt) ? dflt : (options[0] ?? 'melody');
}

/** Forms this model accepts; when the model doesn't say, both are offered. */
export function modesOf(info: Pick<MusicModelInfo, 'modes'> | null | undefined): MusicMode[] {
  return MUSIC_MODE_ORDER.filter((m) => !info?.modes.length || info.modes.includes(m));
}

/** Switching models: the duration is clamped to its cap, and the planning falls back to one it accepts. */
export function switchMusicModel(draft: MusicDraft, option: MusicOption): Partial<MusicDraft> {
  const max = maxSecOf(option.info);
  return {
    model: option.key,
    targetDurationSec: Math.min(draft.targetDurationSec, max),
    maxDurationSec: draft.maxDurationSec !== null ? Math.min(draft.maxDurationSec, max) : null,
    planning: planningFor(draft, option.info),
  };
}

/** Changing the target duration: if a hand-edited cap is now shorter than the new target, it goes back to following the target. */
export function setTarget(draft: Pick<MusicDraft, 'maxDurationSec'>, sec: number): Partial<MusicDraft> {
  return { targetDurationSec: sec, maxDurationSec: draft.maxDurationSec !== null && draft.maxDurationSec < sec ? null : draft.maxDurationSec };
}

// ---- Validation and request ----

/** The form's problems, in the order of the design mock `validate` (model first, then style, lyrics, duration, cap, seed). */
export function musicProblems(draft: MusicDraft, option: MusicOption | null): string[] {
  const problems: string[] = [];
  if (!option) return [M.pickModel];
  const info = option.info;
  const max = maxSecOf(info);
  const style = draft.style.trim();
  if (!style) problems.push(M.emptyStyle);
  else if (codePoints(style) > info.maxStyleChars) problems.push(M.styleTooLong(codePoints(style), info.maxStyleChars));
  if (draft.mode === 'song') {
    const lyrics = draft.lyrics.trim();
    if (!lyrics) problems.push(M.needLyrics);
    else if (codePoints(lyrics) > info.maxLyricsChars) problems.push(M.lyricsTooLong(codePoints(lyrics), info.maxLyricsChars));
  }
  if (!modesOf(info).includes(draft.mode)) problems.push(M.modeUnsupported(modeLabel(draft.mode)));
  const target = draft.targetDurationSec;
  if (!(target >= DURATION.min && target <= max)) problems.push(M.durationRange(DURATION.min, max));
  else if (maxOf(draft, max) < target) problems.push(M.maxBelowTarget);
  else if (maxOf(draft, max) > max) problems.push(M.durationRange(DURATION.min, max));
  if (!/^\d*$/.test(draft.seed.trim()) || !parseSeed(draft.seed).ok) problems.push(M.seedDigits);
  return problems;
}

/**
 * Parameters for `models.generateMusic`. Instrumental carries no lyrics (not an empty string: the protocol rejects that); an empty seed is not sent (the Runtime picks one and freezes it);
 * the tools page doesn't change the step count (it uses the model's default). `videoId`, when given, puts the finished music into that video (from the editor's "Generate soundtrack").
 */
export function musicRequest(draft: MusicDraft, option: MusicOption, videoId?: Id | null): Omit<GenerateMusicRequest, 'commandId'> {
  const max = maxSecOf(option.info);
  const seed = parseSeed(draft.seed);
  return {
    mode: draft.mode,
    style: draft.style.trim(),
    ...(draft.mode === 'song' ? { lyrics: draft.lyrics.trim() } : {}),
    targetDurationSec: draft.targetDurationSec,
    maxDurationSec: maxOf(draft, max),
    planning: planningFor(draft, option.info),
    ...(seed.ok && seed.seed !== null ? { seed: seed.seed } : {}),
    provider: option.providerId,
    model: option.modelId,
    ...(videoId ? { videoId } : {}),
  };
}

/** The estimate sentence: "About 3 minutes on this machine"; `cpu` uses the CPU factor; direct generation is 20% faster. */
export function etaText(sec: number, opts: { cpu?: boolean; planning?: MusicPlanning } = {}): string {
  const mult = opts.cpu ? SPEED.cpu : SPEED.silicon;
  const s = Math.max(1, Math.round((sec || 0) * mult * (opts.planning === 'off' ? 0.8 : 1)));
  const amount = s < 90 ? M.etaSeconds(Math.max(10, Math.round(s / 10) * 10)) : M.etaMinutes(Math.max(1, Math.round(s / 60)));
  return opts.cpu ? M.etaCpu(amount) : M.eta(amount);
}

/** The sentence beside the main button: the first problem if there is one (before any submission, don't say "write a style first"); otherwise the budget and estimated time. */
export function musicStatus(draft: MusicDraft, option: MusicOption | null, tried: boolean, cpu = false): { text: string; bad: boolean } {
  if (!option) return { text: M.pickModel, bad: true };
  if (!option.usable) {
    return { text: option.why === localNotDownloaded() ? M.downloadFirst(option.label) : `${option.label} · ${option.why}`, bad: true };
  }
  const problem = musicProblems(draft, option).find((p) => tried || p !== M.emptyStyle);
  if (problem) return { text: problem, bad: true };
  const max = maxOf(draft, maxSecOf(option.info));
  return { text: `${M.tokens(tokens(max))} · ${etaText(draft.targetDurationSec, { cpu, planning: planningFor(draft, option.info) })}`, bad: false };
}

/** The header chip: when a model is chosen and usable, it shows the model name and "Generated on this machine · offline". */
export function musicHeaderChip(option: Pick<MusicOption, 'label' | 'usable'> | null): string {
  return option?.usable ? M.headerChip(option.label) : M.headerChipNone;
}

/** The sentence at the right of the model line: the duration cap, lyrics and seed. */
export function musicModelLine(info: MusicModelInfo): string {
  return [
    info.notes ?? null,
    M.upTo(maxSecOf(info)),
    modesOf(info).includes('song') ? M.takesLyrics : null,
    info.acceptsSeed ? M.takesSeed : null,
    info.local?.license.commercialUse === false ? M.nonCommercial : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ---- Records ----

type MusicGeneration = Extract<NonNullable<JobRecord['generation']>, { capability: 'generateMusic' }>;

export function musicGeneration(job: Pick<JobRecord, 'generation'>): MusicGeneration | null {
  return job.generation?.capability === 'generateMusic' ? job.generation : null;
}

/** Record card title: the style description. */
export function musicTitle(job: Pick<JobRecord, 'generation'>): string {
  return musicGeneration(job)?.style ?? '';
}

/** Record card body: the style, plus the first line of the lyrics if sung. */
export function musicText(job: Pick<JobRecord, 'generation'>): string {
  const g = musicGeneration(job);
  if (!g) return '';
  const first = g.mode === 'song' && g.lyrics ? g.lyrics.split('\n').find((l) => l.trim()) : null;
  return first ? `${g.style} — ${first.trim()}…` : g.style;
}

/** The line under a record card: "Instrumental · 30 seconds · melody first · YuE2 3B · seed 7". */
export function musicRecordMeta(job: JobRecord, modelName: string): string {
  const g = musicGeneration(job);
  if (!g) return modelName;
  return [modeLabel(g.mode), M.sec(g.targetDurationSec ?? g.maxDurationSec), planningLabel(g.planning), modelName, M.seed(g.seed)].join(' · ');
}

/** A finished result hit the cap (the Runtime's `output-truncated` warning): suggests a longer cap. */
export function musicTruncated(job: Pick<JobRecord, 'warnings'>): boolean {
  return job.warnings.some((w) => w.code === 'output-truncated');
}

/** "Bring back to the left to revise": this version's settings go back to the form, and the seed is cleared to randomize again. */
export function musicAgainDraft(job: JobRecord): Partial<MusicDraft> | null {
  const g = musicGeneration(job);
  if (!g) return null;
  const target = g.targetDurationSec ?? g.maxDurationSec;
  return {
    mode: g.mode,
    style: g.style,
    lyrics: g.lyrics ?? '',
    targetDurationSec: target,
    maxDurationSec: g.maxDurationSec === Math.round(target * MAX_HEADROOM) ? null : g.maxDurationSec,
    planning: g.planning,
    seed: '',
    model: modelKeyOf(job.providerId, job.modelId),
  };
}

/** "Try again": resubmits the frozen parameters unchanged (same model, same seed). */
export function musicRetryRequest(job: JobRecord): Omit<GenerateMusicRequest, 'commandId'> | null {
  const g = musicGeneration(job);
  if (!g) return null;
  return {
    mode: g.mode,
    style: g.style,
    ...(g.lyrics !== null ? { lyrics: g.lyrics } : {}),
    ...(g.targetDurationSec !== null ? { targetDurationSec: g.targetDurationSec } : {}),
    maxDurationSec: g.maxDurationSec,
    planning: g.planning,
    format: g.format,
    seed: g.seed,
    ...(g.steps !== undefined ? { steps: g.steps } : {}),
    provider: job.providerId,
    model: job.modelId,
    ...(job.videoId ? { videoId: job.videoId } : {}),
  };
}

/** Download filename: the first few characters of the style, with `music` as the fallback. */
export function musicFileName(style: string): string {
  const stem =
    style
      .trim()
      .replace(/[\\/:*?"<>|,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32)
      .trim() || 'music';
  return `${stem}.wav`;
}

// ---- "Preview" in Settings: a few seconds of instrumental, style only ----

export const QUICK = { seconds: 10, steps: 8 } as const;

export interface MusicQuickPick {
  style: MusicStyleKey;
  mode: MusicMode;
}

export const QUICK_DEFAULTS: MusicQuickPick = { style: 'calm-piano', mode: 'instrumental' };

/** Preview steps: clamped to the model's range when it takes steps; otherwise not sent. */
export function quickSteps(info: Pick<MusicModelInfo, 'local'> | null | undefined): number | null {
  const range = info?.local?.steps;
  if (!range) return null;
  return Math.min(range.max, Math.max(range.min, QUICK.steps));
}

/** Lyrics used for the preview (when sung): a short English passage, only to hear whether vocals come out; it does not change with the UI language. */
const QUICK_LYRICS = '[verse]\nLa la la, the morning light\n[chorus]\nSing along, everything is bright';

/** Preview request: fixed at 10 seconds, direct generation, a few steps; it only checks whether this model and engine can produce sound. */
export function quickRequest(pick: MusicQuickPick, bundleId: string, info: Pick<MusicModelInfo, 'local'> | null | undefined): Omit<GenerateMusicRequest, 'commandId'> {
  const style = (MUSIC_STYLES.find((s) => s.key === pick.style) ?? MUSIC_STYLES[0]!).style;
  const steps = quickSteps(info);
  return {
    mode: pick.mode,
    style,
    ...(pick.mode === 'song' ? { lyrics: QUICK_LYRICS } : {}),
    targetDurationSec: QUICK.seconds,
    maxDurationSec: QUICK.seconds,
    planning: 'off',
    ...(steps !== null ? { steps } : {}),
    provider: 'local',
    model: bundleId,
  };
}

/** The settings group for the preview (changing it makes a new piece). */
export function quickKey(pick: MusicQuickPick, bundleId: string): string {
  return `${bundleId}|${pick.mode}|${pick.style}`;
}

/** Line shown when done: "Lo-fi beat · 10 seconds · 8 steps · took 42 seconds". */
export function quickSummary(pick: MusicQuickPick, steps: number | null, elapsedSec: number): string {
  return [styleLabel(pick.style), M.sec(QUICK.seconds), steps !== null ? M.steps(steps) : null, M.took(Math.max(1, Math.round(elapsedSec || 0)))]
    .filter(Boolean)
    .join(' · ');
}
