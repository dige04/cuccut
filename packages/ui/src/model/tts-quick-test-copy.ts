import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './tts-quick-test-copy.zh-Hans.ts';
import { zhHant } from './tts-quick-test-copy.zh-Hant.ts';
import { ja } from './tts-quick-test-copy.ja.ts';
import { ko } from './tts-quick-test-copy.ko.ts';
import { es } from './tts-quick-test-copy.es.ts';
import { fr } from './tts-quick-test-copy.fr.ts';
import { de } from './tts-quick-test-copy.de.ts';
import { nl } from './tts-quick-test-copy.nl.ts';
import { ptBR } from './tts-quick-test-copy.pt-BR.ts';
import { it } from './tts-quick-test-copy.it.ts';
import { ru } from './tts-quick-test-copy.ru.ts';
import { pl } from './tts-quick-test-copy.pl.ts';
import { tr } from './tts-quick-test-copy.tr.ts';
import { vi } from './tts-quick-test-copy.vi.ts';

/**
 * Copy for the local speech synthesis “Preview” (model/tts-quick-test.ts; English is the source of keys and types, translations are in `tts-quick-test-copy.<lang>.ts`).
 * The ready-made voice descriptions and tone notes are both shown in the UI and passed as-is to the model as `voiceDescription` / `instructions`.
 */
const en = {
  kindIntro: 'Intro',
  kindNumbers: 'Numbers',
  kindMood: 'Tone',

  /** How each Qwen3-TTS CustomVoice speaker sounds (the names themselves are not translated). */
  presetSub: {
    Vivian: 'Female · Bright',
    Serena: 'Female · Calm',
    Uncle_Fu: 'Male · Deep',
    Dylan: 'Male · Young',
    Eric: 'Male · Broadcast',
    Ryan: 'Male · Upbeat',
    Aiden: 'Male · Narrative',
    Ono_Anna: 'Female · Japanese',
    Sohee: 'Female · Korean',
  } as Readonly<Record<string, string>>,

  /** Names of the built-in voices. */
  builtinVoice: {
    'zh-female': 'Chinese female',
    'zh-male': 'Chinese male',
    'en-female': 'English female',
    'en-male': 'English male',
    'ja-female': 'Japanese female',
    'ja-male': 'Japanese male',
    'es-female': 'Spanish female',
    'es-male': 'Spanish male',
  } as Readonly<Record<string, string>>,
  builtinCredit: 'FLEURS corpus (CC BY 4.0) and CMU ARCTIC · trimmed and loudness-normalized · original notices kept',

  describeWarm: 'Warm female',
  describeWarmText: 'A warm, friendly adult female voice at a moderate pace, like chatting with a friend',
  describeAnchor: 'Steady male',
  describeAnchorText: 'A steady, clear adult male voice with a broadcast tone and even rhythm',
  describeBright: 'Bright youth',
  describeBrightText: 'A bright, lively young voice with a relaxed tone',

  toneUpbeat: 'Upbeat',
  toneUpbeatText: 'Speak with bright, upbeat energy, a little faster than usual',
  toneNatural: 'Natural',
  toneAnchor: 'Steady',
  toneAnchorText: 'Speak in a steady, clear broadcast voice at an even pace',
  toneSoft: 'Soft',
  toneSoftText: 'Speak softly and more slowly, as if talking up close',

  customDescribe: 'Describe my own',
  defaultVoice: 'Default voice',
  myVoices: 'My voices',
  fileVoice: 'Use a clip once',
  seconds: (n: string) => `${n} s`,

  textRequired: 'Enter the text to synthesize first',
  textTooLong: (max: number) => `Up to ${max} characters at a time; use a shorter sentence for a preview`,
  describeRequired: 'Describe the voice you want in one sentence first',
  myVoiceGone: 'This voice is no longer in My voices; pick another',
  referenceRequired: 'Pick a reference recording first, or switch back to a built-in voice',

  phaseSubmitting: 'Submitting',
  phaseQueued: 'Queued',
  phaseLoading: 'Loading model',
  phaseGeneratingStep: (step: number, total: number) => `Generating audio · step ${step}/${total}`,
  phaseGenerating: 'Generating audio',
  phaseWriting: 'Writing audio',
  phasePreparing: 'Preparing',

  sampleVoice: (name: string) => `Sample · ${name}`,
  customText: 'Custom text',
  elapsed: (seconds: string) => `Took ${seconds} s`,
  audioLength: (seconds: string) => `Audio ${seconds} s`,
};

export type TtsQuickTestMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
