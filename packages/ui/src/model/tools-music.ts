import type { GenerateMusicRequest, Id, JobRecord, ModelCapabilitiesView, MusicMode, MusicModelInfo, MusicPlanning } from '@cuccut/protocol';
import { M } from './tools-music-copy.ts';
import { codePoints, localModelOptions, localNotDownloaded, modelKeyOf, parseSeed, type ToolModelOption } from './tools-models.ts';

/**
 * 本机音乐生成（设计稿 model-music.js、tool-music.jsx、settings-music.jsx）：工具 › 生成音乐、设置 › 音乐生成的「试听」
 * 与编辑器 AI 工具的「生成配乐」共用。表单字段照 `GenerateMusicRequest` 命名（mode / style / lyrics / targetDurationSec /
 * maxDurationSec / planning / seed / model），时长 → 语义 token 与 Runtime 同一条规则（25 token / 秒）。
 * 时长上限、规划方式与步数取模型的能力描述，不写死某一只模型的数。
 */

export type MusicOption = ToolModelOption<MusicModelInfo>;

export { localNotDownloaded };

/** 本机的音乐模型包：都列出来（没装的也列，选中时给下载卡）。音乐生成只有本机模型。 */
export function musicModelOptions(view: ModelCapabilitiesView): MusicOption[] {
  return localModelOptions(view, 'generateMusic');
}

/** 每秒的语义 token（Runtime 的 `semantic_max_tokens` 按它换算）。 */
export const TOKENS_PER_SEC = 25;
/** 时长滑块的下限、步长与缺省；上限取模型的 `maxDurationSec`。 */
export const DURATION = { min: 10, step: 5, dflt: 30 } as const;
/** 上限缺省比目标多留两成：模型可能写得长一点；到了上限的结果带「被截断」提醒。 */
export const MAX_HEADROOM = 1.2;
/** 预计耗时 = 时长 × 倍数（Apple Silicon 与 CPU）；界面上只说「大约」。 */
export const SPEED = { silicon: 6, cpu: 20 } as const;
/** 模型没说时长上限时用的上限（YuE2 登记的值）。 */
const FALLBACK_MAX_SEC = 300;

export const MUSIC_MODE_ORDER: readonly MusicMode[] = ['instrumental', 'song'];
/** 规划的排列（设计稿 `PLANNINGS`）：完整编排、先定旋律、直接生成。 */
export const MUSIC_PLANNING_ORDER: readonly MusicPlanning[] = ['full', 'melody', 'off'];

export type MusicStyleKey = 'calm-piano' | 'upbeat-pop' | 'lofi' | 'ambient' | 'acoustic' | 'epic';

/** 风格芯片：点一下填进风格框。给模型的是英文描述（YuE2 按英文标签训练），不随界面语言变；芯片上的名字在文案里。 */
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
  /** 手改过的上限；null 为跟着目标走（多两成）。 */
  maxDurationSec: number | null;
  planning: MusicPlanning;
  seed: string;
  /** `providerId/modelId`；null 为还没选。 */
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

/** 这只模型的时长上限（秒）。 */
export function maxSecOf(info: Pick<MusicModelInfo, 'maxDurationSec'> | null | undefined): number {
  return info?.maxDurationSec && info.maxDurationSec > 0 ? info.maxDurationSec : FALLBACK_MAX_SEC;
}

/**
 * 视频时长 → 可用的目标时长：按 5 秒向上取整（音乐不比视频短，铺上去只截不补），夹在范围内；没有时长用缺省
 * （超过上限的长视频夹到上限，加到视频时循环铺满，见 `soundtrackFor` 与 music-bed.ts）。
 */
export function clampDuration(sec: number | null | undefined, max = FALLBACK_MAX_SEC): number {
  const n = Number(sec);
  if (!(n > 0)) return DURATION.dflt;
  return Math.min(max, Math.max(DURATION.min, Math.ceil(n / DURATION.step) * DURATION.step));
}

/**
 * 「生成配乐」进来时的那一段（产品设计 §2.7「生成配乐」；设计稿 `soundtrackFor`）：视频不超过这只模型的单次上限时目标时长
 * 按视频预填、一段铺完；超过时预填上限、`loop` 为 true——加到视频时循环铺满、接缝交叉淡化、片尾淡出，横幅要写明。
 */
export function soundtrackFor(videoSec: number | null | undefined, max = FALLBACK_MAX_SEC): { targetDurationSec: number; loop: boolean } {
  const v = Number(videoSec);
  if (!(v > max)) return { targetDurationSec: clampDuration(v, max), loop: false };
  return { targetDurationSec: max, loop: true };
}

/** 上限：手改过的用手改的，否则比目标多两成、不超过模型的上限。 */
export function maxOf(draft: Pick<MusicDraft, 'targetDurationSec' | 'maxDurationSec'>, max = FALLBACK_MAX_SEC): number {
  if (draft.maxDurationSec) return draft.maxDurationSec;
  return Math.min(max, Math.round((draft.targetDurationSec || DURATION.dflt) * MAX_HEADROOM));
}

/** 预算：这段音乐最多生成多少语义 token。 */
export function tokens(sec: number): number {
  return Math.max(1, Math.round((sec || 0) * TOKENS_PER_SEC));
}

/** 这只模型接受的规划方式（按界面的排列）；模型没说时三种都给。 */
export function planningsOf(info: Pick<MusicModelInfo, 'local'> | null | undefined): MusicPlanning[] {
  const allowed = info?.local?.planning.options;
  return MUSIC_PLANNING_ORDER.filter((p) => !allowed || allowed.includes(p));
}

/** 草稿的规划在这只模型下成不成立；不成立时用模型的默认，再不行取第一种。 */
export function planningFor(draft: Pick<MusicDraft, 'planning'>, info: Pick<MusicModelInfo, 'local'> | null | undefined): MusicPlanning {
  const options = planningsOf(info);
  if (options.includes(draft.planning)) return draft.planning;
  const dflt = info?.local?.planning.default;
  return dflt && options.includes(dflt) ? dflt : (options[0] ?? 'melody');
}

/** 这只模型接受的形式；模型没说时两种都给。 */
export function modesOf(info: Pick<MusicModelInfo, 'modes'> | null | undefined): MusicMode[] {
  return MUSIC_MODE_ORDER.filter((m) => !info?.modes.length || info.modes.includes(m));
}

/** 换一只模型：时长夹进它的上限，规划落到它认的一种。 */
export function switchMusicModel(draft: MusicDraft, option: MusicOption): Partial<MusicDraft> {
  const max = maxSecOf(option.info);
  return {
    model: option.key,
    targetDurationSec: Math.min(draft.targetDurationSec, max),
    maxDurationSec: draft.maxDurationSec !== null ? Math.min(draft.maxDurationSec, max) : null,
    planning: planningFor(draft, option.info),
  };
}

/** 改目标时长：手改过的上限比新目标短了，就回到跟着目标走。 */
export function setTarget(draft: Pick<MusicDraft, 'maxDurationSec'>, sec: number): Partial<MusicDraft> {
  return { targetDurationSec: sec, maxDurationSec: draft.maxDurationSec !== null && draft.maxDurationSec < sec ? null : draft.maxDurationSec };
}

// ---- 校验与请求 ----

/** 表单的问题，按设计稿 `validate` 的顺序（先模型、再风格、歌词、时长、上限、种子）。 */
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
 * `models.generateMusic` 的参数。纯音乐不带歌词（不是空串：协议拒绝）；种子留空就不带（Runtime 抽一个并冻结）；
 * 工具页不改步数（用模型的默认）。`videoId` 给了时做好的音乐收进那部视频（编辑器「生成配乐」带来的）。
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

/** 预计耗时的一句：「本机大约 3 分钟」；`cpu` 用 CPU 的倍数；直接生成快两成。 */
export function etaText(sec: number, opts: { cpu?: boolean; planning?: MusicPlanning } = {}): string {
  const mult = opts.cpu ? SPEED.cpu : SPEED.silicon;
  const s = Math.max(1, Math.round((sec || 0) * mult * (opts.planning === 'off' ? 0.8 : 1)));
  const amount = s < 90 ? M.etaSeconds(Math.max(10, Math.round(s / 10) * 10)) : M.etaMinutes(Math.max(1, Math.round(s / 60)));
  return opts.cpu ? M.etaCpu(amount) : M.eta(amount);
}

/** 主按钮旁那句：有问题写第一条（没提交过时不说「先写风格」），否则写预算与预计耗时。 */
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

/** 页头那枚标签：选好且能用时写模型名与「在本机生成 · 不联网」。 */
export function musicHeaderChip(option: Pick<MusicOption, 'label' | 'usable'> | null): string {
  return option?.usable ? M.headerChip(option.label) : M.headerChipNone;
}

/** 模型那一行右边的一句：时长上限、歌词与种子。 */
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

// ---- 记录 ----

type MusicGeneration = Extract<NonNullable<JobRecord['generation']>, { capability: 'generateMusic' }>;

export function musicGeneration(job: Pick<JobRecord, 'generation'>): MusicGeneration | null {
  return job.generation?.capability === 'generateMusic' ? job.generation : null;
}

/** 记录卡的标题：风格描述。 */
export function musicTitle(job: Pick<JobRecord, 'generation'>): string {
  return musicGeneration(job)?.style ?? '';
}

/** 记录卡的正文：风格，带唱的接歌词第一行。 */
export function musicText(job: Pick<JobRecord, 'generation'>): string {
  const g = musicGeneration(job);
  if (!g) return '';
  const first = g.mode === 'song' && g.lyrics ? g.lyrics.split('\n').find((l) => l.trim()) : null;
  return first ? `${g.style} — ${first.trim()}…` : g.style;
}

/** 记录卡下面那一行：「纯音乐 · 30 秒 · 先定旋律 · YuE2 3B · 种子 7」。 */
export function musicRecordMeta(job: JobRecord, modelName: string): string {
  const g = musicGeneration(job);
  if (!g) return modelName;
  return [modeLabel(g.mode), M.sec(g.targetDurationSec ?? g.maxDurationSec), planningLabel(g.planning), modelName, M.seed(g.seed)].join(' · ');
}

/** 做好的结果写到了上限（Runtime 的 `output-truncated` 警告）：提醒加长上限。 */
export function musicTruncated(job: Pick<JobRecord, 'warnings'>): boolean {
  return job.warnings.some((w) => w.code === 'output-truncated');
}

/** 「带回左边再改一版」：这一版的设置回到表单，种子留空重新随机。 */
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

/** 「再试一次」：照冻结的参数原样再提交一次（同一只模型、同一个种子）。 */
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

/** 下载的文件名：风格头几个字，`music` 兜底。 */
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

// ---- 设置里的「试听」：固定几秒的纯音乐，只挑风格 ----

export const QUICK = { seconds: 10, steps: 8 } as const;

export interface MusicQuickPick {
  style: MusicStyleKey;
  mode: MusicMode;
}

export const QUICK_DEFAULTS: MusicQuickPick = { style: 'calm-piano', mode: 'instrumental' };

/** 试听的步数：模型收步数时夹进它的范围，否则不带。 */
export function quickSteps(info: Pick<MusicModelInfo, 'local'> | null | undefined): number | null {
  const range = info?.local?.steps;
  if (!range) return null;
  return Math.min(range.max, Math.max(range.min, QUICK.steps));
}

/** 试听用的歌词（带唱时）：一小段英文，只为听听人声出不出得来，不随界面语言变。 */
const QUICK_LYRICS = '[verse]\nLa la la, the morning light\n[chorus]\nSing along, everything is bright';

/** 试听的请求：固定 10 秒、直接生成、少几步；只看这只模型与引擎能不能出声。 */
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

/** 试听的那一组设置（换了就是新的一段）。 */
export function quickKey(pick: MusicQuickPick, bundleId: string): string {
  return `${bundleId}|${pick.mode}|${pick.style}`;
}

/** 做好后那一行：「Lo-fi 节拍 · 10 秒 · 8 步 · 用了 42 秒」。 */
export function quickSummary(pick: MusicQuickPick, steps: number | null, elapsedSec: number): string {
  return [styleLabel(pick.style), M.sec(QUICK.seconds), steps !== null ? M.steps(steps) : null, M.took(Math.max(1, Math.round(elapsedSec || 0)))]
    .filter(Boolean)
    .join(' · ');
}
