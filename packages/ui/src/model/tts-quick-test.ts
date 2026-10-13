import { intlLocale, live, type JobRecord, type ModelBundleStatus, type SpeechModelInfo, type SynthesizeSpeechRequest } from '@cuccut/protocol';
import { languageName } from './caption-tracks.ts';
import { isBundleInstalled } from './models-local.ts';
import { canClone, quickKind, type QuickKind } from './models-tts-local.ts';
import { M } from './tts-quick-test-copy.ts';

/**
 * Local speech synthesis “Preview” (design draft settings-tts.jsx's TtsQuickTest, model-tts.js's `quick*`): the chips only change the selection,
 * and only pressing “Generate preview” submits one real `models.synthesizeSpeech` (`provider: 'local'`, `model` = the model pack). A result carries its own identity
 * (`quickKey` = the request itself); when the selection changes, the old result is just “the previous one”. Sample lines, quick voices and tones follow the design draft.
 */

/* ---------- Sample lines (design draft SAMPLE_KINDS / SAMPLE_LINES: eleven languages × three lines) ---------- */

export type SampleKind = 'intro' | 'numbers' | 'mood';
export const SAMPLE_KINDS: readonly { k: SampleKind; label: string }[] = [
  {
    k: 'intro',
    get label() {
      return M.kindIntro;
    },
  },
  {
    k: 'numbers',
    get label() {
      return M.kindNumbers;
    },
  },
  {
    k: 'mood',
    get label() {
      return M.kindMood;
    },
  },
];

/** Sample lines are fixed to the language of the line, and do not change with the UI language. */
// i18n-ignore-start: sample lines stay fixed to their language, not the UI language
export const SAMPLE_LINES: readonly { code: string; kind: SampleKind; text: string }[] = [
  { code: 'zh', kind: 'intro', text: '欢迎使用 CucCut！转录、翻译、配音，全都在你自己的电脑上完成。' },
  { code: 'zh', kind: 'numbers', text: '这条 4K 片段 3 分 28 秒，导出只用了 1 分 12 秒。' },
  { code: 'zh', kind: 'mood', text: '是不是快得有点不像话？而且素材从头到尾没离开过你的电脑！' },
  { code: 'en', kind: 'intro', text: 'Welcome to CucCut! Transcribe, translate and voice over, all on your own machine.' },
  { code: 'en', kind: 'numbers', text: 'This 4K clip runs 3 minutes 28 seconds, and the export took just 1 minute 12.' },
  { code: 'en', kind: 'mood', text: "Fast, isn't it? And your footage never leaves your computer!" },
  { code: 'ja', kind: 'intro', text: 'CucCut へようこそ！文字起こしも翻訳も吹き替えも、ぜんぶ自分のパソコンで終わります。' },
  { code: 'ja', kind: 'numbers', text: 'この 4K クリップは 3 分 28 秒、書き出しはたったの 1 分 12 秒でした。' },
  { code: 'ja', kind: 'mood', text: '驚くほど速いでしょう？素材は一度もパソコンから出ていません！' },
  { code: 'ko', kind: 'intro', text: 'CucCut에 오신 것을 환영합니다! 전사, 번역, 더빙까지 모두 내 컴퓨터에서 끝납니다.' },
  { code: 'ko', kind: 'numbers', text: '이 4K 클립은 3분 28초이고, 내보내기는 1분 12초밖에 걸리지 않았습니다.' },
  { code: 'ko', kind: 'mood', text: '놀랄 만큼 빠르죠? 게다가 소재는 컴퓨터 밖으로 나가지 않습니다!' },
  { code: 'es', kind: 'intro', text: '¡Bienvenido a CucCut! Transcribe, traduce y dobla, todo en tu propio equipo.' },
  { code: 'es', kind: 'numbers', text: 'Este clip en 4K dura 3 minutos y 28 segundos, y exportarlo llevó solo 1 minuto y 12.' },
  { code: 'es', kind: 'mood', text: '¿A que es rapidísimo? ¡Y tu material nunca sale de tu ordenador!' },
  { code: 'de', kind: 'intro', text: 'Willkommen bei CucCut! Transkribieren, Übersetzen und Vertonen, alles auf deinem eigenen Rechner.' },
  { code: 'de', kind: 'numbers', text: 'Dieser 4K-Clip dauert 3 Minuten und 28 Sekunden, der Export nur 1 Minute 12.' },
  { code: 'de', kind: 'mood', text: 'Ganz schön schnell, oder? Und dein Material verlässt deinen Rechner nie!' },
  { code: 'fr', kind: 'intro', text: 'Bienvenue dans CucCut ! Transcription, traduction et doublage, tout se passe sur votre ordinateur.' },
  { code: 'fr', kind: 'numbers', text: "Ce clip 4K dure 3 minutes 28, et l'export n'a pris qu'une minute 12." },
  { code: 'fr', kind: 'mood', text: 'Plutôt rapide, non ? Et vos rushes ne quittent jamais votre ordinateur !' },
  { code: 'it', kind: 'intro', text: 'Benvenuto in CucCut! Trascrizione, traduzione e doppiaggio, tutto sul tuo computer.' },
  { code: 'it', kind: 'numbers', text: "Questa clip in 4K dura 3 minuti e 28 secondi, e l'esportazione ha richiesto solo 1 minuto e 12." },
  { code: 'it', kind: 'mood', text: 'Veloce, vero? E il tuo materiale non lascia mai il computer!' },
  { code: 'pt', kind: 'intro', text: 'Bem-vindo ao CucCut! Transcrição, tradução e dublagem, tudo no seu próprio computador.' },
  { code: 'pt', kind: 'numbers', text: 'Este clipe em 4K tem 3 minutos e 28 segundos, e a exportação levou apenas 1 minuto e 12.' },
  { code: 'pt', kind: 'mood', text: 'Rápido, não é? E o seu material nunca sai do seu computador!' },
  { code: 'ru', kind: 'intro', text: 'Добро пожаловать в CucCut! Расшифровка, перевод и озвучка — всё на вашем компьютере.' },
  { code: 'ru', kind: 'numbers', text: 'Этот 4K-фрагмент длится 3 минуты 28 секунд, а экспорт занял всего 1 минуту 12 секунд.' },
  { code: 'ru', kind: 'mood', text: 'Быстро, правда? И ваши материалы никогда не покидают компьютер!' },
  { code: 'ar', kind: 'intro', text: 'مرحبًا بك في CucCut! التفريغ والترجمة والدبلجة، كلها تتم على جهازك.' },
  { code: 'ar', kind: 'numbers', text: 'هذا المقطع بدقة 4K مدته 3 دقائق و28 ثانية، والتصدير استغرق دقيقة و12 ثانية فقط.' },
  { code: 'ar', kind: 'mood', text: 'سريع، أليس كذلك؟ وموادك لا تغادر جهازك أبدًا!' },
];
// i18n-ignore-end

const SAMPLE_CODES = [...new Set(SAMPLE_LINES.map((l) => l.code))];

/**
 * Which languages this model can preview: among the languages the model declares, those with sample lines, in the order of the sample table; when the model accepts any language (`any`), every language in the sample table is offered.
 * A declared language with no sample lines gets no chip; that language can still be read with “Write your own line”. Neither Chinese nor English is assumed.
 */
export function sampleLangs(model: Pick<SpeechModelInfo, 'languages'>): { code: string; label: string }[] {
  const declared = model.languages;
  const codes = declared === 'any' ? SAMPLE_CODES : SAMPLE_CODES.filter((c) => declared.some((d) => d.toLowerCase().split('-')[0] === c));
  return codes.map((code) => ({ code, label: languageName(code) }));
}

/** Which kinds of line this language has. */
export function sampleKinds(code: string): { k: SampleKind; label: string }[] {
  return SAMPLE_KINDS.filter((k) => SAMPLE_LINES.some((l) => l.code === code && l.kind === k.k));
}

/** Gets a sample sentence by language plus line kind; if that kind is missing, falls back to the language's first sentence, then to the table header. */
export function sampleLine(code: string | null, kind: SampleKind): { code: string; kind: SampleKind; text: string } {
  return SAMPLE_LINES.find((l) => l.code === code && l.kind === kind) ?? SAMPLE_LINES.find((l) => l.code === code) ?? SAMPLE_LINES[0]!;
}

/* ---------- Voices ---------- */

/** Qwen3-TTS CustomVoice speakers: the name is an identifier in the weights and is not translated; the subtitle describes how it sounds (design draft PRESETS). */
export const PRESET_SUB: Readonly<Record<string, string>> = live(() => M.presetSub);
/** The four presets shown directly on the row, two male and two female; the rest go under “More voices”. */
export const QUICK_PRESETS: readonly string[] = ['Vivian', 'Serena', 'Eric', 'Uncle_Fu'];

/**
 * Names and recording durations of the built-in voices (design draft BUILTIN_REFS; the recordings, source texts and credits are in the Runtime's packages/models/src/speech-voices.ts,
 * and the model descriptions only give `voiceId` and language).
 */
const BUILTIN_SECONDS: Readonly<Record<string, number>> = {
  'zh-female': 6.72,
  'zh-male': 6.16,
  'en-female': 7.32,
  'en-male': 6.9,
  'ja-female': 8.44,
  'ja-male': 6.4,
  'es-female': 6.92,
  'es-male': 7.86,
};
export const BUILTIN_VOICE_INFO: Readonly<Record<string, { label: string; seconds: number }>> = live(() =>
  Object.fromEntries(Object.entries(BUILTIN_SECONDS).map(([id, seconds]) => [id, { label: M.builtinVoice[id] ?? id, seconds }])),
);
/** The four built-in voices shown directly on the chips; the rest go under “More voices”. */
export const QUICK_BUILTINS: readonly string[] = ['zh-female', 'zh-male', 'en-female', 'en-male'];
/** Credit for the built-in voice recordings (design draft REF_CREDIT). */
export const builtinCredit = (): string => M.builtinCredit;

/** Seconds are written as numbers in the current language (`min` / `max` decimal places). */
function formatSeconds(seconds: number, max: number, min = 0): string {
  return new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(seconds);
}

export function builtinLabel(id: string): string {
  return BUILTIN_VOICE_INFO[id]?.label ?? id;
}

/** Three ready-made descriptions for “Design a voice from a description” (design draft DESCRIBE_VOICES), for models that only accept free-form descriptions. */
export const DESCRIBE_VOICES: readonly { k: string; label: string; text: string }[] = [
  {
    k: 'warm',
    get label() {
      return M.describeWarm;
    },
    get text() {
      return M.describeWarmText;
    },
  },
  {
    k: 'anchor',
    get label() {
      return M.describeAnchor;
    },
    get text() {
      return M.describeAnchorText;
    },
  },
  {
    k: 'bright',
    get label() {
      return M.describeBright;
    },
    get text() {
      return M.describeBrightText;
    },
  },
];

/**
 * Tones for the preview (design draft INSTRUCT_TONES): only for models that take preset speakers and accept a style note (`instructions: 'style'`); they become `instructions`.
 * The design draft's emotion presets for IndexTTS (EMOTION_TONES) cannot be sent by this version's request, so they are not drawn.
 */
export const INSTRUCT_TONES: readonly { k: string; label: string; text?: string }[] = [
  {
    k: 'upbeat',
    get label() {
      return M.toneUpbeat;
    },
    get text() {
      return M.toneUpbeatText;
    },
  },
  {
    k: 'natural',
    get label() {
      return M.toneNatural;
    },
  },
  {
    k: 'anchor',
    get label() {
      return M.toneAnchor;
    },
    get text() {
      return M.toneAnchorText;
    },
  },
  {
    k: 'soft',
    get label() {
      return M.toneSoft;
    },
    get text() {
      return M.toneSoftText;
    },
  },
];

export function quickTones(model: SpeechModelInfo): readonly { k: string; label: string; text?: string }[] {
  return quickKind(model) === 'preset' && model.local?.instructions === 'style' ? INSTRUCT_TONES : [];
}

/** An item of the voice chips and of “More voices”. */
export interface VoiceOption {
  key: string;
  label: string;
  /** Secondary note (hover hint / menu subtitle). */
  sub?: string;
}

/** One voice from “My voices” (`library:<id>` is handed to the cloning model). */
export interface MyVoice {
  id: string;
  name: string;
}

export const DEFAULT_VOICE = 'default';
export const FILE_VOICE = 'file';
export const CUSTOM_DESCRIBE = 'describe';
export const MY_PREFIX = 'my:';

const builtinIds = (model: SpeechModelInfo) => model.voices.filter((v) => v.source === 'builtin').map((v) => v.voiceId);
const speakerIds = (model: SpeechModelInfo) => model.voices.filter((v) => v.source !== 'builtin').map((v) => v.voiceId);
const quickSpeakers = (model: SpeechModelInfo) => {
  const ids = speakerIds(model);
  const quick = QUICK_PRESETS.filter((id) => ids.includes(id));
  return quick.length ? quick : ids.slice(0, 4);
};

/**
 * Quick voices (design draft `quickVoices`): preset models get four speakers; models that design a voice from a description get the four quick built-in voices (for them each is a description) + the three ready-made descriptions
 * + a custom description; models that can clone get the default voice, My voices, the four quick built-in voices and “Use a clip for now”.
 */
export function quickVoices(model: SpeechModelInfo, mine: readonly MyVoice[]): VoiceOption[] {
  const kind = quickKind(model);
  if (kind === 'preset') return quickSpeakers(model).map((id) => ({ key: id, label: PRESET_SUB[id] ?? id, sub: id }));
  const builtins = QUICK_BUILTINS.filter((id) => builtinIds(model).includes(id)).map((id) => ({ key: id, label: builtinLabel(id) }));
  if (kind === 'describe') {
    return [
      ...builtins,
      ...DESCRIBE_VOICES.map((v) => ({ key: v.k, label: v.label, sub: v.text })),
      { key: CUSTOM_DESCRIBE, label: M.customDescribe },
    ];
  }
  return [
    { key: DEFAULT_VOICE, label: M.defaultVoice },
    ...mine.map((v) => ({ key: MY_PREFIX + v.id, label: v.name, sub: M.myVoices })),
    ...builtins,
    { key: FILE_VOICE, label: M.fileVoice },
  ];
}

/** “More voices”: preset models include the remaining speakers; others include the built-in voices other than the four quick ones. */
export function moreVoices(model: SpeechModelInfo): VoiceOption[] {
  if (quickKind(model) === 'preset') {
    const quick = quickSpeakers(model);
    return speakerIds(model)
      .filter((id) => !quick.includes(id))
      .map((id) => ({ key: id, label: PRESET_SUB[id] ?? id, sub: id }));
  }
  return builtinIds(model)
    .filter((id) => !QUICK_BUILTINS.includes(id))
    .map((id) => {
      const info = BUILTIN_VOICE_INFO[id];
      return { key: id, label: builtinLabel(id), ...(info ? { sub: M.seconds(formatSeconds(info.seconds, 2)) } : {}) };
    });
}

/** The built-in voice for this language: looks for a female voice first, then the language's first voice, and when neither exists takes the first voice (same rule as the Runtime's `defaultBuiltinVoice`). */
export function defaultBuiltin(model: SpeechModelInfo, lang: string | null): string | null {
  const builtins = model.voices.filter((v) => v.source === 'builtin');
  const same = lang ? builtins.filter((v) => v.language === lang) : [];
  return (same.find((v) => v.voiceId.endsWith('-female')) ?? same[0] ?? builtins[0])?.voiceId ?? null;
}

/* ---------- Selection → request ---------- */

/** The selection for this preview row (kept per model for this page session). */
export interface QuickPick {
  lang: string | null;
  kind: SampleKind;
  voice: string;
  /** The user has picked a voice themselves; until then, changing language makes the default built-in voice follow the language. */
  voicePicked: boolean;
  tone: string;
  /** “Write your own line” is on: reads `draft`, otherwise reads a sample line. When turned off, the line written earlier is kept. */
  editing: boolean;
  draft: string;
  /** The sentence for “Describe the voice yourself”. */
  describe: string;
  /** “Use a clip for now”: a recording the user picked, or a built-in voice brought in by “Use sample recording”. */
  file: { path: string; name: string } | null;
  sample: string | null;
  /** Source text of a recording the user picked (can be filled in when the model reads the source). */
  transcript: string;
}

export function quickDefaults(model: SpeechModelInfo): QuickPick {
  const langs = sampleLangs(model);
  const lang = langs[0]?.code ?? null;
  const kind = quickKind(model);
  const voice =
    kind === 'preset'
      ? (quickSpeakers(model)[0] ?? '')
      : (defaultBuiltin(model, lang) ?? (kind === 'describe' ? CUSTOM_DESCRIBE : DEFAULT_VOICE));
  const tones = quickTones(model);
  return {
    lang,
    kind: 'intro',
    voice,
    voicePicked: false,
    tone: tones[0]?.k ?? 'natural',
    editing: false,
    draft: '',
    describe: '',
    file: null,
    sample: null,
    transcript: '',
  };
}

/** Changing language: to hear the same line read in another language, the line kind is kept (if this language has none, falls back to the first sentence); until a voice is picked, the default built-in voice follows the language. */
export function chooseLang(model: SpeechModelInfo, pick: QuickPick, lang: string): QuickPick {
  const next: QuickPick = { ...pick, lang, kind: sampleLine(lang, pick.kind).kind, editing: false };
  if (!pick.voicePicked && quickKind(model) !== 'preset') {
    const builtin = defaultBuiltin(model, lang);
    if (builtin) next.voice = builtin;
  }
  return next;
}

/** Clicked a voice chip or an item under “More voices”. */
export function chooseVoice(pick: QuickPick, voice: string): QuickPick {
  return { ...pick, voice, voicePicked: true };
}

/** A recording of the user's own has been chosen (replacing the sample recording). */
export function chooseFile(pick: QuickPick, path: string): QuickPick {
  const name = path.split(/[\\/]/).pop() || path;
  return { ...pick, voice: FILE_VOICE, voicePicked: true, file: { path, name }, sample: null };
}

/** “Use sample recording”: uses this language's built-in voice as the reference (it is a recording shipped with the app), so no file needs to be found. */
export function chooseSample(model: SpeechModelInfo, pick: QuickPick): QuickPick {
  const sample = defaultBuiltin(model, pick.lang);
  return sample ? { ...pick, voice: FILE_VOICE, voicePicked: true, sample, file: null } : pick;
}

export type QuickRequest = Omit<SynthesizeSpeechRequest, 'commandId'>;

export interface QuickForm {
  /** The request when it can be submitted; null when there is a problem. */
  request: QuickRequest | null;
  /** The first problem to state clearly when “Generate preview” is pressed (the button is not greyed out; the problem is raised on press). */
  problem: string | null;
  /** Result identity: a result with the same identity is what “the current selection” reads out. */
  key: string;
}

/** The text being read: the written line when “Write your own line” is on, otherwise the sample line. */
export function quickText(pick: QuickPick): string {
  return pick.editing ? pick.draft : sampleLine(pick.lang, pick.kind).text;
}

/**
 * Selection → request for `models.synthesizeSpeech` (design draft `quickForm` + `validatePreview`). At most one of `voice`, `reference` and `voiceDescription`
 * is given (the Runtime rejects more than one as well). The language is included when reading a sample line; a self-written line does not have its language guessed.
 */
export function quickForm(model: SpeechModelInfo, pick: QuickPick, mine: readonly MyVoice[]): QuickForm {
  const kind = quickKind(model);
  const text = quickText(pick);
  const base: QuickRequest = { text, provider: 'local', model: model.modelId };
  if (!pick.editing && pick.lang) base.language = pick.lang;
  const tone = quickTones(model).find((t) => t.k === pick.tone);
  if (tone?.text) base.instructions = tone.text;

  let request: QuickRequest = base;
  let problem: string | null = null;
  if (!text.trim()) problem = M.textRequired;
  else if ([...text].length > model.maxInputChars) problem = M.textTooLong(model.maxInputChars);

  if (kind === 'preset') {
    request = { ...base, voice: pick.voice };
  } else if (kind === 'describe') {
    const preset = DESCRIBE_VOICES.find((v) => v.k === pick.voice);
    if (pick.voice === CUSTOM_DESCRIBE) {
      if (!pick.describe.trim()) problem ??= M.describeRequired;
      request = { ...base, voiceDescription: pick.describe.trim() };
    } else if (preset) request = { ...base, voiceDescription: preset.text };
    else request = { ...base, voice: pick.voice };
  } else if (pick.voice === DEFAULT_VOICE) {
    request = base;
  } else if (pick.voice.startsWith(MY_PREFIX)) {
    const id = pick.voice.slice(MY_PREFIX.length);
    if (!mine.some((v) => v.id === id)) problem ??= M.myVoiceGone;
    request = { ...base, voice: `library:${id}` };
  } else if (pick.voice === FILE_VOICE) {
    if (pick.sample) request = { ...base, voice: pick.sample };
    else if (pick.file) {
      const transcript = model.local?.reference?.acceptsTranscript ? pick.transcript.trim() : '';
      request = { ...base, reference: { file: pick.file.path, ...(transcript ? { transcript } : {}) } };
    } else problem ??= M.referenceRequired;
  } else {
    request = { ...base, voice: pick.voice };
  }
  return { request: problem ? null : request, problem, key: JSON.stringify(request) };
}

/* ---------- Progress and result ---------- */

/**
 * Which step a running preview is at: queued → loading the model → synthesizing (shows the step number when the Worker reports step counts) → writing the audio. The Worker's own preparation and encoding of the reference recording
 * do not become a separate task stage; only the synthesis step count is passed through to the task progress.
 */
export function quickPhase(job: JobRecord | undefined): { label: string; percent: number | null } {
  if (!job) return { label: M.phaseSubmitting, percent: null };
  switch (job.phase) {
    case 'queued':
      return { label: M.phaseQueued, percent: null };
    case 'starting':
    case 'loading':
      return { label: M.phaseLoading, percent: null };
    case 'generating': {
      const p = job.progress;
      if (p && p.unit === 'steps' && p.total) {
        return { label: M.phaseGeneratingStep(Math.min(p.done + 1, p.total), p.total), percent: Math.round((p.done / p.total) * 100) };
      }
      return { label: M.phaseGenerating, percent: null };
    }
    case 'validating':
    case 'publishing':
    case 'encoding':
    case 'finalizing':
      return { label: M.phaseWriting, percent: 100 };
    default:
      return { label: M.phasePreparing, percent: null };
  }
}

/** Which voice this result line uses (the voice of design draft `quickSummary`). */
export function voiceLabel(model: SpeechModelInfo, pick: QuickPick, mine: readonly MyVoice[]): string {
  const kind = quickKind(model);
  if (kind === 'preset') return pick.voice;
  if (kind === 'describe') {
    if (pick.voice === CUSTOM_DESCRIBE) return M.customDescribe;
    return DESCRIBE_VOICES.find((v) => v.k === pick.voice)?.label ?? builtinLabel(pick.voice);
  }
  if (pick.voice === DEFAULT_VOICE) return M.defaultVoice;
  if (pick.voice.startsWith(MY_PREFIX)) return mine.find((v) => MY_PREFIX + v.id === pick.voice)?.name ?? M.myVoices;
  if (pick.voice === FILE_VOICE) return pick.sample ? M.sampleVoice(builtinLabel(pick.sample)) : (pick.file?.name ?? M.fileVoice);
  return builtinLabel(pick.voice);
}

/**
 * Result line: “Vivian · 热情洋溢 · 中文 · 用时 1.6 秒 · 音频 3.9 秒” (Vivian · enthusiastic · Chinese · took 1.6 s · audio 3.9 s). When the line is not an introduction, the kind is written; a self-written line is written as “自定义文本” (custom text).
 * Time taken and audio duration both come from the task's real numbers; when absent, they are not written.
 */
export function quickSummary(
  model: SpeechModelInfo,
  pick: QuickPick,
  mine: readonly MyVoice[],
  facts: { seconds: number | null; audioSec: number | null },
): string {
  const voice = voiceLabel(model, pick, mine);
  const tone = quickTones(model).find((t) => t.k === pick.tone && t.k !== 'natural');
  const kind = SAMPLE_KINDS.find((k) => k.k === pick.kind);
  const said = pick.editing
    ? M.customText
    : pick.lang
      ? kind && kind.k !== 'intro'
        ? `${languageName(pick.lang)} · ${kind.label}`
        : languageName(pick.lang)
      : '';
  const parts = [tone ? `${voice} · ${tone.label}` : voice, said];
  if (facts.seconds !== null) parts.push(M.elapsed(formatSeconds(facts.seconds, 1, 1)));
  if (facts.audioSec !== null) parts.push(M.audioLength(formatSeconds(facts.audioSec, 1, 1)));
  return parts.filter(Boolean).join(' · ');
}

/* ---------- Preview cloning for “My voices” ---------- */

/** Order for choosing a model for “My voices” (design draft model-voices.js CLONE_MODELS), compared by the part of the model pack ID before `@`; cloning models not in the table come after. */
export const CLONE_ORDER: readonly string[] = [
  'indextts2',
  'qwen3-tts-0.6b-base',
  'gpt-sovits-v2',
  'index-tts2.5',
  'qwen3-tts-1.7b-base',
  'voxcpm2',
];

/** Which row “Preview cloning” goes to: the first installed cloning-capable model pack by `CLONE_ORDER`; null when none is installed. */
export function auditionBundle(bundles: readonly ModelBundleStatus[], models: ReadonlyMap<string, SpeechModelInfo>): string | null {
  const rank = (id: string) => {
    const i = CLONE_ORDER.indexOf(id.split('@')[0]!);
    return i < 0 ? CLONE_ORDER.length : i;
  };
  const candidates = bundles
    .filter((b) => b.capability === 'synthesize' && isBundleInstalled(b))
    .filter((b) => {
      const model = models.get(b.bundleId);
      return !!model && canClone(model);
    })
    .sort((a, b) => rank(a.bundleId) - rank(b.bundleId) || a.bundleId.localeCompare(b.bundleId));
  return candidates[0]?.bundleId ?? null;
}

export type { QuickKind };
