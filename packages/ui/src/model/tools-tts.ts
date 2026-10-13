import type { GeneratedOutput, JobRecord, LibraryEntrySummary, SpeechFormat, SpeechModelInfo, SynthesizeSpeechRequest } from '@cuccut/protocol';
import { clip } from './task-list.ts';
import {
  codePoints,
  detectLang,
  langName,
  languagesShort,
  modelKeyOf,
  parseSeed,
  primaryLanguage,
  speaks,
  type ToolModelOption,
} from './tools-models.ts';
import { M, oneDecimal } from './tools-tts-copy.ts';
import { VOICE_CLONE_PROVIDERS } from './voices-library.ts';

/**
 * Speech generation workspace (the cloud part of design mockup tool-tts.jsx, plus model-tools.js, model-cloud-tts.js, model-tts.js):
 * form, validation, request and record card. It accepts only the parameters that `generation-options` takes: voice, language, format, style instruction, speaking rate, seed;
 * when the text exceeds the model's limit, the Runtime rejects it at submit (it does not split it), so it is caught here first with a clear message.
 */

export type SpeechOption = ToolModelOption<SpeechModelInfo>;

/** The sentence used when no text is written (design mockup tool-tts.jsx `EMPTY_TEXT`): it is not spoken before 「生成语音」 (Generate speech) is pressed. */
export function emptyText(): string {
  return M.emptyText;
}

/** 「填一段示例」 (Fill in a sample): the sample sentence from the design mockup's intro, chosen by the language to be spoken, and not changed by the UI language. */
export const TTS_SAMPLES = {
  // i18n-ignore: Chinese sample sentence, spoken by models that can speak Chinese; chosen by the language being spoken
  zh: '欢迎使用 CucCut！转录、翻译、配音，全都在你自己的电脑上完成。',
  en: 'Welcome to CucCut! Transcribe, translate and voice over, all on your own machine.',
} as const;

/** Ready-made delivery styles (design mockup model-tools.js `VIBES`): clicking one fills this sentence into 「风格」 (Style). */
function vibe<K extends keyof typeof M.vibes>(key: K) {
  return {
    key,
    get name(): string {
      return M.vibes[key].name;
    },
    get style(): string {
      return M.vibes[key].style;
    },
  };
}
export const VIBES = [vibe('radio'), vibe('launch'), vibe('bedtime'), vibe('news'), vibe('teach'), vibe('vlog')] as const;

/**
 * How a voice is chosen: the model's default voice, one of the preset voices it lists, a voice ID typed in by hand from the provider account (when the model accepts `custom`),
 * or one of 「我的声音」 (My voices) (`library:<entry ID>`: the Runtime synthesizes with its valid clone on the selected Provider).
 */
export type VoiceKey = 'default' | 'custom' | `preset:${string}` | `library:${string}`;

/** My voices (summary of the user library's `voices`); null when not yet read. */
export type MyVoices = readonly LibraryEntrySummary[] | null;

export interface TtsDraft {
  text: string;
  /** `providerId/modelId`; null when not yet chosen. */
  model: string | null;
  voice: VoiceKey;
  customVoice: string;
  /** Style instruction (sent only when the model accepts `instructions`). */
  instructions: string;
  /** Speaking rate; null when it has not been set (not sent, so the provider's default is used). */
  speed: number | null;
  /** Seed (sent only when the model accepts `seed`); empty means not given. */
  seed: string;
  /** null means the model's default format. */
  format: SpeechFormat | null;
  /** BCP 47; empty means automatic (not sent). */
  language: string;
}

export const BLANK_TTS: TtsDraft = {
  text: '',
  model: null,
  voice: 'default',
  customVoice: '',
  instructions: '',
  speed: null,
  seed: '',
  format: null,
  language: '',
};

// ---- Text ----

/** Segmenting (design mockup model-tts.js `segments`): after a full stop, question mark or exclamation mark; after an English period followed by whitespace; or at a line break. */
export function segments(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])\s*|(?<=\.)\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CJK = /[぀-ヿ㐀-鿿가-힯]/g;

/** Estimated spoken duration in seconds (design mockup model-tts.js `estimateDuration`): 4.2 Chinese characters per second, 2.6 English words per second, 0.18 seconds per pause. */
export function estimateDuration(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const cjk = (t.match(CJK) ?? []).length;
  const latinWords = (t.replace(CJK, ' ').match(/[A-Za-z0-9']+/g) ?? []).length;
  const pauses = (t.match(/[，,。.!！?？;；]/g) ?? []).length;
  return Number((cjk / 4.2 + latinWords / 2.6 + pauses * 0.18).toFixed(1));
}

/** Character count line (design mockup model-tools.js `textStats`): 「128 / 4096 字 · 3 段 · 约 12.4 秒」 (128 / 4096 characters · 3 segments · about 12.4 seconds). */
export function textStats(text: string, max: number): string {
  const t = text.trim();
  if (!t) return M.statsEmpty(max);
  return M.stats(codePoints(t), max, segments(t).length, oneDecimal(estimateDuration(t)));
}

/** Sample sentence: by the selected language; when automatic, by whether the model can speak Chinese. */
export function sampleText(draft: Pick<TtsDraft, 'language'>, info: Pick<SpeechModelInfo, 'languages'> | null): string {
  const lang = draft.language ? primaryLanguage(draft.language) : info && !speaks(info.languages, 'zh') ? 'en' : 'zh';
  return lang === 'zh' ? TTS_SAMPLES.zh : TTS_SAMPLES.en;
}

// ---- Delivery styles ----

/** Clicking a delivery style card: clicking the same card again clears it; if the text box is empty, a sample is filled in at the same time (design mockup `pickVibe`). */
export function pickVibe(draft: TtsDraft, key: string, info: SpeechModelInfo | null): Partial<TtsDraft> {
  const vibe = VIBES.find((v) => v.key === key);
  if (!vibe) return {};
  if (draft.instructions === vibe.style) return { instructions: '' };
  return draft.text.trim() ? { instructions: vibe.style } : { instructions: vibe.style, text: sampleText(draft, info) };
}

/** 「换一句」 (Another one): randomly picks a delivery style card different from the current one (`rnd` makes unit-test injection easy). */
export function rollVibe(draft: TtsDraft, info: SpeechModelInfo | null, rnd: () => number = Math.random): Partial<TtsDraft> {
  const others = VIBES.filter((v) => v.style !== draft.instructions);
  const vibe = others[Math.floor(rnd() * others.length)] ?? VIBES[0];
  return pickVibe({ ...draft, instructions: '' }, vibe.key, info);
}

// ---- Voice ----

export interface VoiceOption {
  key: VoiceKey;
  label: string;
}

export function customVoiceAllowed(info: Pick<SpeechModelInfo, 'voiceModes'>): boolean {
  return info.voiceModes.includes('custom');
}

function presetLabel(info: SpeechModelInfo, voiceId: string): string {
  return info.voices.find((v) => v.voiceId === voiceId)?.label ?? voiceId;
}

/** Voice dropdown: default (when the model has a default voice), preset voices, and a hand-typed voice ID (when the model accepts `custom`). */
export function voiceOptions(info: SpeechModelInfo): VoiceOption[] {
  const list: VoiceOption[] = [];
  if (info.defaultVoice) list.push({ key: 'default', label: M.defaultVoiceOption(presetLabel(info, info.defaultVoice)) });
  for (const v of info.voices) list.push({ key: `preset:${v.voiceId}`, label: v.label });
  if (customVoiceAllowed(info)) list.push({ key: 'custom', label: M.customVoiceOption });
  return list;
}

const LIBRARY_PREFIX = 'library:';

export function libraryVoiceKey(id: string): VoiceKey {
  return `${LIBRARY_PREFIX}${id}`;
}

/** The entry ID of `library:<id>`; null for other choices. */
export function libraryIdOf(key: string): string | null {
  return key.startsWith(LIBRARY_PREFIX) ? key.slice(LIBRARY_PREFIX.length) : null;
}

/**
 * Whether a voice from 「我的声音」 (My voices) can be used with this model: null if it can, otherwise one sentence giving the reason. The Runtime uses only this provider's valid clone, and it requires a declaration of consent from the person themselves; otherwise it rejects with `VOICE_CLONE_REQUIRED` / `VOICE_CONSENT_REQUIRED`. Clones are created in 模型 › 语音合成 › 我的声音 (Models › Speech synthesis › My voices).
 */
export function libraryVoiceBlock(
  voice: Pick<LibraryEntrySummary, 'consentDeclared' | 'clones'>,
  option: Pick<SpeechOption, 'providerId' | 'provider' | 'modelId' | 'info'>,
): string | null {
  if (!customVoiceAllowed(option.info)) return M.presetOnly(option.modelId);
  const clone = voice.clones?.find((c) => c.providerId === option.providerId);
  if (!clone && !VOICE_CLONE_PROVIDERS.includes(option.providerId)) return M.cannotClone(option.provider);
  if (!voice.consentDeclared) return M.noConsent;
  if (clone?.state === 'valid') return null;
  if (clone?.state === 'stale') return M.cloneStale(option.provider);
  return M.notCloned(option.provider);
}

/**
 * Whether the voice in the draft still holds for this model; when it does not, it falls back to the default (or to the first item if there is no default). A voice from 「我的声音」 (My voices) is kept as is:
 * if it has been deleted or cannot be used with this provider, `ttsProblems` says so, and it is not silently swapped for another voice.
 */
export function voiceKeyFor(draft: Pick<TtsDraft, 'voice'>, info: SpeechModelInfo): VoiceKey {
  if (libraryIdOf(draft.voice) !== null) return draft.voice;
  const options = voiceOptions(info);
  if (options.some((o) => o.key === draft.voice)) return draft.voice;
  return options[0]?.key ?? 'default';
}

/** The voice ID actually passed to the Runtime; undefined for the default (the Runtime uses the model's `defaultVoice`); a voice from My Voices is passed unchanged as `library:<id>`. */
export function voiceToSend(draft: Pick<TtsDraft, 'voice' | 'customVoice'>, info: SpeechModelInfo): string | undefined {
  const key = voiceKeyFor(draft, info);
  if (key === 'custom') return draft.customVoice.trim() || undefined;
  if (libraryIdOf(key) !== null) return key;
  if (key.startsWith('preset:')) return key.slice('preset:'.length);
  return undefined;
}

/** Short name of the voice, used in status lines and record cards. A voice from My Voices uses its name (before it has been read, 「我的声音」 (My voice); if deleted, 「已删除的音色」 (deleted voice)). */
export function voiceLabel(draft: Pick<TtsDraft, 'voice' | 'customVoice'>, info: SpeechModelInfo, voices: MyVoices = null): string {
  const key = voiceKeyFor(draft, info);
  if (key === 'custom') return draft.customVoice.trim() || M.customVoice;
  const id = libraryIdOf(key);
  if (id !== null) return voices ? (voices.find((v) => v.id === id)?.name ?? M.deletedVoice) : M.myVoices;
  if (key.startsWith('preset:')) return presetLabel(info, key.slice('preset:'.length));
  return info.defaultVoice ? presetLabel(info, info.defaultVoice) : M.defaultVoice;
}

// ---- Speaking rate, format, seed ----

/** Speaking rate on the slider: 1 when it has not been set (falls within the range). */
export function speedValue(draft: Pick<TtsDraft, 'speed'>, range: { min: number; max: number }): number {
  const v = draft.speed ?? 1;
  return Math.min(range.max, Math.max(range.min, v));
}

export function formatFor(draft: Pick<TtsDraft, 'format'>, info: Pick<SpeechModelInfo, 'formats' | 'defaultFormat'>): SpeechFormat {
  return draft.format && info.formats.includes(draft.format) ? draft.format : info.defaultFormat;
}

/**
 * Switching models: voice, speaking rate and format return to this model's defaults; the language returns to automatic if the model cannot speak it; text and style are kept.
 * When a voice from My Voices is selected, it is kept (it follows the person, not the model): if this model cannot use it, the picker and `ttsProblems` say so.
 */
export function switchModel(draft: TtsDraft, option: SpeechOption): Partial<TtsDraft> {
  const language = draft.language && !speaks(option.info.languages, draft.language) ? '' : draft.language;
  const voice = libraryIdOf(draft.voice) !== null ? draft.voice : 'default';
  return { model: option.key, voice, customVoice: '', speed: null, format: null, language };
}

// ---- Validation and request ----

/** Language problem: the language that was selected, or (when automatic) the language detected from the text, is not on the model's list. */
function languageProblem(draft: TtsDraft, option: SpeechOption): string | null {
  const tag = draft.language || detectLang(draft.text);
  if (!tag || speaks(option.info.languages, tag)) return null;
  return M.cannotSpeak(option.modelId, langName(primaryLanguage(tag)));
}

/** Problem with the My Voices entry: it was deleted, or it cannot be used with this model. Until My Voices has been read, only whether the model accepts it is checked (the rest is left to the Runtime to verify). */
function libraryProblem(id: string, option: SpeechOption, voices: MyVoices): string | null {
  if (!voices) return customVoiceAllowed(option.info) ? null : M.presetOnly(option.modelId);
  const voice = voices.find((v) => v.id === id);
  return voice ? libraryVoiceBlock(voice, option) : M.voiceDeleted;
}

/** Problems before generating (empty means it can be submitted). The button is not greyed out; pressing it explains what is missing (design mockup model-tools.js `validate`). */
export function ttsProblems(draft: TtsDraft, option: SpeechOption | null, voices: MyVoices = null, material: TtsMaterial | null = null): string[] {
  const problems: string[] = [];
  const text = material ? '' : draft.text.trim();
  if (!text && !material) problems.push(M.emptyText);
  if (!option) return problems;
  const info = option.info;
  if (codePoints(text) > info.maxInputChars) problems.push(M.tooLong(option.modelId, info.maxInputChars));
  const key = voiceKeyFor(draft, info);
  if (key === 'custom' && !draft.customVoice.trim()) problems.push(M.enterVoiceId);
  const libraryId = libraryIdOf(key);
  const mine = libraryId !== null ? libraryProblem(libraryId, option, voices) : null;
  if (mine) problems.push(mine);
  if (key === 'default' && !info.defaultVoice) problems.push(voiceOptions(info).length ? M.pickVoice : M.noVoices);
  if (text) {
    const lang = languageProblem(draft, option);
    if (lang) problems.push(lang);
  }
  if (info.acceptsSeed && !parseSeed(draft.seed).ok) problems.push(M.seedInteger);
  return problems;
}

/**
 * Speak a document or subtitles from the Space (`material`, architecture design §7.9 「Space 条目作输入」 (Space entries as input)): the Runtime reads the entry's text as `text` (timecodes removed from subtitles).
 * When it exceeds the model's character limit, it is rejected at submit and not truncated. `name` is for display only.
 */
export interface TtsMaterial {
  entryId: string;
  name: string;
}

/** Parameters for `models.synthesizeSpeech`: includes only the fields this model accepts, and imports no video. When a material is given, `text` is an empty string and `material` is included. */
export function speechRequest(draft: TtsDraft, option: SpeechOption, material: TtsMaterial | null = null): Omit<SynthesizeSpeechRequest, 'commandId'> {
  const info = option.info;
  const voice = voiceToSend(draft, info);
  const instructions = draft.instructions.trim();
  const seed = parseSeed(draft.seed);
  return {
    text: material ? '' : draft.text.trim(),
    ...(material ? { material: { entryId: material.entryId } } : {}),
    provider: option.providerId,
    model: option.modelId,
    ...(voice ? { voice } : {}),
    ...(draft.language ? { language: draft.language } : {}),
    format: formatFor(draft, info),
    ...(info.acceptsInstructions && instructions ? { instructions } : {}),
    ...(info.speedRange && draft.speed !== null ? { speed: speedValue(draft, info.speedRange) } : {}),
    ...(info.acceptsSeed && seed.ok && seed.seed !== null ? { seed: seed.seed } : {}),
  };
}

export interface BarStatus {
  text: string;
  /** When the gate is not passed or there is a problem: turns orange. */
  bad: boolean;
}

/**
 * The sentence next to the primary button (design mockup tool-tts.jsx `status`): first states the gate (no model, not connected), then the first problem (the no-text problem is only stated after the button has been pressed once),
 * and when there are none, reads out the model, voice, duration and character count that this run will use.
 */
export function ttsStatus(draft: TtsDraft, option: SpeechOption | null, tried: boolean, voices: MyVoices = null, material: TtsMaterial | null = null): BarStatus {
  if (!option) return { text: M.noModel, bad: true };
  if (!option.usable) return { text: option.connected ? `${option.provider} · ${option.why}` : M.connectFirst(option.provider), bad: true };
  const empty = M.emptyText;
  const problem = ttsProblems(draft, option, voices, material).find((p) => tried || p !== empty);
  if (problem) return { text: problem, bad: true };
  if (material) return { text: M.readsMaterial(option.modelId, voiceLabel(draft, option.info, voices), material.name), bad: false };
  const text = draft.text.trim();
  const tail = text ? M.estimate(oneDecimal(estimateDuration(text)), codePoints(text)) : '';
  return { text: `${option.modelId} · ${voiceLabel(draft, option.info, voices)}${tail}`, bad: false };
}

// ---- Records ----

/** Minutes:seconds, two digits each (「00:07」 in design mockup `recordMeta`). */
function mmss(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function khz(rate: number): string {
  return `${Number((rate / 1000).toFixed(2))} kHz`;
}

/** The first audio output. */
export function audioOutput(job: Pick<JobRecord, 'result'>): GeneratedOutput | null {
  return job.result?.outputs?.find((o) => o.media.kind === 'audio') ?? null;
}

/**
 * The metadata line of the record card (design mockup model-tools.js `recordMeta`): 「00:07 · 24 kHz · OpenAI · gpt-4o-mini-tts · alloy · 中文 · 24 字」 (00:07 · 24 kHz · OpenAI · gpt-4o-mini-tts · alloy · Chinese · 24 characters).
 * Duration and sample rate are facts about the finished output, so they are not written until it has been generated.
 */
export function speechMeta(job: JobRecord, provider: string): string {
  const g = job.generation?.capability === 'synthesizeSpeech' ? job.generation : null;
  const out = audioOutput(job);
  const media = out?.media.kind === 'audio' ? out.media : null;
  return [
    media ? mmss(media.durationSec) : null,
    media ? khz(media.sampleRate) : null,
    `${provider} · ${job.modelId}`,
    g?.voice ?? null,
    g?.language ? langName(primaryLanguage(g.language)) : null,
    g ? M.chars(codePoints(g.text)) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The text that is spoken. */
export function speechText(job: Pick<JobRecord, 'generation'>): string {
  return job.generation?.capability === 'synthesizeSpeech' ? job.generation.text : '';
}

/** Record card title: the beginning of the text. */
export function speechTitle(job: Pick<JobRecord, 'generation'>): string {
  return clip(speechText(job), 18) || M.speech;
}

const AUDIO_EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac' };

/** Download file name: the beginning of the text (with characters not allowed in file names removed), plus the format's extension. */
export function audioFileName(job: Pick<JobRecord, 'generation'>, output: Pick<GeneratedOutput, 'mediaType'>): string {
  const g = job.generation?.capability === 'synthesizeSpeech' ? job.generation : null;
  const ext = AUDIO_EXT[output.mediaType] ?? g?.format ?? 'mp3';
  const stem = Array.from(speechText(job).replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, 24)
    .join('')
    .trim();
  return `${stem || M.speech}.${ext}`;
}

/** The entry ID of the My Voices entry used, when a voice from My Voices is used (the user library entry frozen by the job); the frozen `voice` is its clone ID on the provider's side. */
function libraryVoiceOf(job: Pick<JobRecord, 'library'>): string | null {
  return job.library?.entries.find((e) => e.library === 'voices')?.id ?? null;
}

/** 「带回左边再改一版」 (Bring back to the left and revise): text and settings return to the form; the voice is matched back to My Voices, or matched back to a preset or hand-typed voice from this model's list. */
export function draftFromJob(job: JobRecord, info: SpeechModelInfo | null): Partial<TtsDraft> | null {
  const g = job.generation?.capability === 'synthesizeSpeech' ? job.generation : null;
  if (!g) return null;
  const mine = libraryVoiceOf(job);
  const preset = info?.voices.some((v) => v.voiceId === g.voice);
  const isDefault = info?.defaultVoice === g.voice;
  return {
    text: g.text,
    model: modelKeyOf(job.providerId, job.modelId),
    voice: mine !== null ? libraryVoiceKey(mine) : isDefault ? 'default' : preset ? `preset:${g.voice}` : 'custom',
    customVoice: mine !== null || isDefault || preset ? '' : g.voice,
    instructions: g.instructions ?? '',
    speed: g.speed,
    seed: g.seed !== null ? String(g.seed) : '',
    format: g.format,
    language: g.language ?? '',
  };
}

/**
 * 「再试一次 / 重新排队」 (Try again / re-queue): submits again with the frozen parameters unchanged (same provider, model and voice). When a voice from My Voices is used, `library:<id>` is still given,
 * and the Runtime verifies the clone again (if it has expired, it is rejected as is); the old clone ID is not used to get around this.
 */
export function speechRetry(job: JobRecord): Omit<SynthesizeSpeechRequest, 'commandId'> | null {
  const g = job.generation?.capability === 'synthesizeSpeech' ? job.generation : null;
  if (!g) return null;
  const mine = libraryVoiceOf(job);
  return {
    text: g.text,
    provider: job.providerId,
    model: job.modelId,
    voice: mine !== null ? libraryVoiceKey(mine) : g.voice,
    ...(g.language ? { language: g.language } : {}),
    format: g.format,
    ...(g.instructions ? { instructions: g.instructions } : {}),
    ...(g.speed !== null ? { speed: g.speed } : {}),
    ...(g.seed !== null ? { seed: g.seed } : {}),
  };
}

/**
 * The sentence on the right of the model line (design mockup tool-tts.jsx `ModelLine`, `c.line`): what this model can do, all taken from its capability description:
 * how many voices, whether it accepts a style instruction, the speaking-rate range, which languages it can speak, and the maximum characters per request.
 */
export function speechModelLine(info: SpeechModelInfo): string {
  return [
    info.notes ?? null,
    info.voices.length ? M.presetVoices(info.voices.length) : customVoiceAllowed(info) ? M.customVoiceId : null,
    info.acceptsInstructions ? M.takesStyle : null,
    info.speedRange ? M.speedRange(info.speedRange.min, info.speedRange.max) : null,
    languagesShort(info.languages),
    M.maxChars(info.maxInputChars),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The tag in the page header (design mockup model-cloud-tts.js `headerChip`): which service it goes through. Billing differs by provider, so it only says 「按用量计费」 (billed by usage). */
export function headerChip(option: Pick<SpeechOption, 'provider'> | null): string | null {
  return option ? M.headerChip(option.provider) : null;
}
