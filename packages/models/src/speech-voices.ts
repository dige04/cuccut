import { modelAssetPath } from './model-assets.ts';

/**
 * Built-in voices for local speech synthesis (architecture design §6.1): eight reference recordings bundled with the app, one male and one female for each of four languages (`assets/tts-voices/`; source and licence in the `COPYING.txt` in the same directory). Models that can only clone (IndexTTS, GPT-SoVITS, VoxCPM2, OmniVoice, Qwen3-TTS Base) list them as preset voices: picking one means cloning with that recording and its transcript.
 *
 * `description` is a one-sentence English voice description, kept for reuse by models that create voices from descriptions (not translated: it is text handed to the model, not UI copy).
 */
export interface BuiltinVoice {
  id: string;
  /** BCP 47 primary language subtag. */
  language: string;
  gender: 'female' | 'male';
  /** Recording duration (seconds). */
  seconds: number;
  /** Transcript of the recording. */
  transcript: string;
  description: string;
  /** Source of the material (dataset · subset · original file). */
  credit: string;
  /** Relative path of the recording within the model data directory (`model-assets.ts`); the absolute path is resolved with `builtinVoiceFile` at the point of use. */
  asset: string;
}

const ARCTIC_TRANSCRIPT = 'Author of the danger trail, Philip Steels, etc. Not at this particular case, Tom, apologized Whittemore.';

function asset(id: string): string {
  return `tts-voices/${id}.wav`;
}

/** The order is the UI order: Chinese, English, Japanese, Spanish, with the female voice before the male in each. */
export const BUILTIN_VOICES: readonly BuiltinVoice[] = [
  {
    id: 'zh-female',
    language: 'zh',
    gender: 'female',
    seconds: 6.72,
    // i18n-ignore: transcript of the reference recording, handed to the model
    transcript: '一般来说，卫星电话不能取代移动电话，因为只有在卫星信号畅通的室外，才能进行通话。',
    description: 'A warm, natural young female voice speaking Mandarin Chinese at an even, unhurried pace',
    credit: 'FLEURS · cmn_hans_cn · dev · 11138309825590803862',
    asset: asset('zh-female'),
  },
  {
    id: 'zh-male',
    language: 'zh',
    gender: 'male',
    seconds: 6.16,
    // i18n-ignore: transcript of the reference recording, handed to the model
    transcript: '游猎活动也许是非洲最吸引人的旅游活动，也是许多游客行程中的亮点。',
    description: 'A calm, steady adult male voice speaking Mandarin Chinese, clear and even',
    credit: 'FLEURS · cmn_hans_cn · dev · 7878925372167965477',
    asset: asset('zh-male'),
  },
  {
    id: 'en-female',
    language: 'en',
    gender: 'female',
    seconds: 7.32,
    transcript: ARCTIC_TRANSCRIPT,
    description: 'A warm, clear adult female voice speaking American English at an even pace',
    credit: 'CMU ARCTIC · cmu_us_slt_arctic · a0001 + a0002',
    asset: asset('en-female'),
  },
  {
    id: 'en-male',
    language: 'en',
    gender: 'male',
    seconds: 6.9,
    transcript: ARCTIC_TRANSCRIPT,
    description: 'A deep, steady adult male voice speaking American English, clear and even',
    credit: 'CMU ARCTIC · cmu_us_bdl_arctic · a0001 + a0002',
    asset: asset('en-male'),
  },
  {
    id: 'ja-female',
    language: 'ja',
    gender: 'female',
    seconds: 8.44,
    // i18n-ignore: transcript of the reference recording, handed to the model
    transcript: '州間の税法や関税を無効にする権限もありませんでした。',
    description: 'A bright, gentle young female voice speaking Japanese at an even pace',
    credit: 'FLEURS · ja_jp · dev · 9633305044980004895',
    asset: asset('ja-female'),
  },
  {
    id: 'ja-male',
    language: 'ja',
    gender: 'male',
    seconds: 6.4,
    // i18n-ignore: transcript of the reference recording, handed to the model
    transcript: '宇宙にある人工衛星は通話を受信して、ほぼ瞬時にそれを反映します。',
    description: 'A calm, low adult male voice speaking Japanese, clear and even',
    credit: 'FLEURS · ja_jp · dev · 18146068393309246703',
    asset: asset('ja-male'),
  },
  {
    id: 'es-female',
    language: 'es',
    gender: 'female',
    seconds: 6.92,
    transcript: 'Los canales navegables internos pueden ser una buena temática para las vacaciones.',
    description: 'A warm, clear adult female voice speaking Latin American Spanish at an even pace',
    credit: 'FLEURS · es_419 · dev · 16573424493246998243',
    asset: asset('es-female'),
  },
  {
    id: 'es-male',
    language: 'es',
    gender: 'male',
    seconds: 7.86,
    transcript: 'Cuando uno se comunica con alguien que está a miles de millas de distancia, se está haciendo uso de un satélite.',
    description: 'A deep, steady adult male voice speaking Latin American Spanish, clear and even',
    credit: 'FLEURS · es_419 · dev · 14695292064114231662',
    asset: asset('es-male'),
  },
];

/** Absolute path of a built-in voice recording; null when the model data directory cannot be found (reading it reports `APP_FILE_MISSING`). */
export function builtinVoiceFile(voice: BuiltinVoice, env: NodeJS.ProcessEnv = process.env): string | null {
  return modelAssetPath(voice.asset, env);
}

export function builtinVoice(id: string): BuiltinVoice | null {
  return BUILTIN_VOICES.find((v) => v.id === id) ?? null;
}

/**
 * Which built-in voice is used when no voice is specified: the female voice for the request's language; if there is none for that language, the first voice of that language; if there is none at all, the first voice (the Chinese female voice).
 * The language is not guessed from the text: with no language given, it is the first one.
 */
export function defaultBuiltinVoice(language: string | null): BuiltinVoice {
  const primary = language?.toLowerCase().split('-')[0] ?? null;
  const same = primary ? BUILTIN_VOICES.filter((v) => v.language === primary) : [];
  return same.find((v) => v.gender === 'female') ?? same[0] ?? BUILTIN_VOICES[0]!;
}
