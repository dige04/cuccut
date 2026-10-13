import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './models-tts-local-copy.zh-Hans.ts';
import { zhHant } from './models-tts-local-copy.zh-Hant.ts';
import { ja } from './models-tts-local-copy.ja.ts';
import { ko } from './models-tts-local-copy.ko.ts';
import { es } from './models-tts-local-copy.es.ts';
import { fr } from './models-tts-local-copy.fr.ts';
import { de } from './models-tts-local-copy.de.ts';
import { nl } from './models-tts-local-copy.nl.ts';
import { ptBR } from './models-tts-local-copy.pt-BR.ts';
import { it } from './models-tts-local-copy.it.ts';
import { ru } from './models-tts-local-copy.ru.ts';
import { pl } from './models-tts-local-copy.pl.ts';
import { tr } from './models-tts-local-copy.tr.ts';
import { vi } from './models-tts-local-copy.vi.ts';

/** Copy for the local-model row under Settings › Models › Speech synthesis (the English is the source of keys and types; translations are in `models-tts-local-copy.<lang>.ts`). */

const voices = (n: number) => `${n} built-in ${n === 1 ? 'voice' : 'voices'}`;

/** Display name of a language label; when `Intl` does not recognize it, write the label itself. */
function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const en = {
  /** Short name of one language on the row. */
  languageShort: languageName,
  languagesAny: 'Any language',
  /** When there are more than five: the short names of the first four, and the total. */
  languagesMore: (shown: readonly string[], total: number) => `${shown.join(' / ')} and more (${total} languages)`,
  /** Built-in voices + cloning + voice from description; `byDuration`: can speak to a target duration. */
  summaryCloneDescribe: (builtins: number, byDuration: boolean) =>
    `${voices(builtins)}, clone a voice from a recording, or create a new voice by choosing gender, age and pitch${
      byDuration ? '; can read to a target duration' : ''
    }`,
  /** Built-in voices + cloning; `style`: a style can be specified in one sentence. */
  summaryClone: (builtins: number, style: boolean) =>
    `${voices(builtins)}, or clone a voice from a recording${style ? '; a one-line prompt can set the style' : ''}`,
  /** Voice from description; when `builtins` is 0, built-in voices are not mentioned. */
  summaryDescribe: (builtins: number) =>
    builtins
      ? `Describe the voice you want in one sentence and the model creates it; you can also use the ${voices(builtins)} directly`
      : 'Describe the voice you want in one sentence and the model creates it',
  /** The model's built-in speakers; `style`: tone can be specified in one sentence. */
  summaryPreset: (speakers: number, style: boolean) =>
    `${speakers} preset ${speakers === 1 ? 'voice' : 'voices'}; pick one and it reads${style ? '; a one-line prompt can set the tone' : ''}`,
  modeCloneDescribe: 'Built-in voices / Clone / Describe',
  modeClone: 'Built-in voices / Clone',
  modeDescribe: 'Voice from description',
  modePreset: 'Preset voices',
  factStyle: 'Style prompt',
  factSlow: 'Slower',
  /** Label for licenses that only permit non-commercial use. */
  nonCommercialChip: 'Non-commercial only',
  licenseCommercial: (name: string) => `${name} · Commercial use allowed`,
  licenseNonCommercial: (name: string, owner: string) =>
    `${name} · Non-commercial use only · For commercial use, apply to ${owner} separately`,
  /** Description of the engine family, taken from `LocalSpeechTraits.family`. */
  familyDesc: {
    'qwen3-tts':
      'Qwen3-TTS: CustomVoice has 9 preset speakers and a one-line prompt can set the tone; Base clones from a reference recording; 1.7B VoiceDesign creates a new voice from just a description. 1.7B sounds better but is slower.',
    indextts2:
      'IndexTTS: eight built-in voices, or clone your own recording; it takes only the timbre of the recording and does not read its transcript. IndexTTS 2.5 can also adjust the speaking rate.',
    'gpt-sovits':
      "GPT-SoVITS: eight built-in voices, or clone your own recording; it sounds closer if you also give the reference recording's transcript, and then the reference must be 3–10 seconds.",
    voxcpm2:
      "VoxCPM2: eight built-in voices, or clone your own recording; it sounds closest with the recording's transcript, and a one-line prompt can set the speaking style; outputs 48 kHz.",
    omnivoice:
      'OmniVoice: eight built-in voices, clone your own recording, or create a new voice by choosing gender, age and pitch from a word list; it reads the most languages. Non-commercial only.',
  } as Record<string, string>,
  quickDescribe: 'The voice is decided entirely by this description: change the description and you get a different person',
  quickVoxcpm: 'About real time: a sentence takes as long to generate as it does to read, and the first load takes about 5 seconds',
  quickNonCommercial: (license: string) => `Non-commercial only (${license}): switch to another model for content you'll use commercially`,
  quickSlow: 'Large model: synthesis is slower than similar models, and the first load takes a while longer',
};

export type TtsLocalMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
