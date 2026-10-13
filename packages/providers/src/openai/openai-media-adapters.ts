// Models for OpenAI speech synthesis and image generation (architecture design §6.4). Docs read on 2026-10-03:
//   https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
//   https://developers.openai.com/api/docs/guides/text-to-speech
//   https://developers.openai.com/api/reference/resources/images/methods/generate
//   https://developers.openai.com/api/docs/guides/image-generation
// Confirmed by the docs: speech models tts-1, tts-1-hd, gpt-4o-mini-tts; 13 built-in voices, of which tts-1 / tts-1-hd have only 9; the guide recommends marin and cedar; text ≤ 4096 characters; languages broadly the same as Whisper (the languages the guide lists); mp3 is the default format; `speed` 0.25–4.0; `instructions` is not used for the tts-1 series; no `seed`. Image models gpt-image-1, gpt-image-1-mini, gpt-image-1.5, gpt-image-2 (dall-e-2/3 were retired on 2026-05-12); sizes 1024x1024, 1536x1024, 1024x1536 and `auto` (omit `size`); gpt-image-2 accepts any WIDTHxHEIGHT (side lengths multiples of 16, aspect ratio 1:3 to 3:1, maximum 3840x2160; above 2560x1440 is experimental); `n` 1–10; prompt ≤ 32000 characters; no `seed`; reference images go through `/images/edits` (not used in this version).
// Not confirmed: custom voices (`{ id }`) are declared only for gpt-4o-mini-tts; the opus and aac containers (not provided); the maximum number of reference images (declared as 16); for gpt-image-2 only a few common 16:9 non-standard sizes are listed, arbitrary sizes are not exposed.
import type { ImageAspectRatio, ImageModelInfo, SpeechModelInfo, SpeechVoice } from '@cuccut/protocol';
import type { AdapterConfig, ImageAdapter, ImageOutput, ImageRequest, SpeechAdapter, SpeechOutput, SpeechRequest } from '../adapter.ts';
import { openAiGenerateImages, openAiSynthesize } from './openai-generation.ts';
import { WHISPER_LANGUAGES } from './openai-transcription.ts';

const LABEL = 'OpenAI';

const ALL_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
const TTS1_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

function voices(ids: string[]): SpeechVoice[] {
  return ids.map((voiceId) => ({ voiceId, label: voiceId[0]!.toUpperCase() + voiceId.slice(1) }));
}

const SPEECH_BASE = {
  languages: WHISPER_LANGUAGES,
  maxInputChars: 4096,
  formats: ['mp3', 'wav', 'flac'],
  defaultFormat: 'mp3',
  speedRange: { min: 0.25, max: 4 },
  acceptsSeed: false,
  cost: 'unknown',
} satisfies Partial<SpeechModelInfo>;

const SPEECH_MODELS: SpeechModelInfo[] = [
  {
    ...SPEECH_BASE,
    modelId: 'gpt-4o-mini-tts',
    label: 'GPT-4o mini TTS',
    default: true,
    voices: voices(ALL_VOICES),
    defaultVoice: 'marin',
    voiceModes: ['preset', 'custom'],
    acceptsInstructions: true,
  },
  {
    ...SPEECH_BASE,
    modelId: 'tts-1-hd',
    label: 'TTS-1 HD',
    voices: voices(TTS1_VOICES),
    defaultVoice: 'alloy',
    voiceModes: ['preset'],
    acceptsInstructions: false,
  },
  {
    ...SPEECH_BASE,
    modelId: 'tts-1',
    label: 'TTS-1',
    voices: voices(TTS1_VOICES),
    defaultVoice: 'alloy',
    voiceModes: ['preset'],
    acceptsInstructions: false,
  },
];

const STANDARD_RATIOS: ImageAspectRatio[] = [
  { ratio: '1:1', size: '1024x1024' },
  { ratio: '3:2', size: '1536x1024' },
  { ratio: '2:3', size: '1024x1536' },
];
const WIDE_RATIOS: ImageAspectRatio[] = [...STANDARD_RATIOS, { ratio: '16:9', size: '1536x864' }, { ratio: '9:16', size: '864x1536' }];

const IMAGE_BASE = {
  defaultSize: null,
  maxCount: 10,
  maxPromptChars: 32_000,
  formats: ['png', 'jpeg', 'webp'],
  defaultFormat: 'png',
  referenceImages: { max: 16 },
  acceptsSeed: false,
  cost: 'unknown',
} satisfies Partial<ImageModelInfo>;

const STANDARD_SIZES = STANDARD_RATIOS.map((r) => r.size);

const IMAGE_MODELS: ImageModelInfo[] = [
  {
    ...IMAGE_BASE,
    modelId: 'gpt-image-2',
    label: 'GPT Image 2',
    default: true,
    sizes: [...WIDE_RATIOS.map((r) => r.size), '2560x1440', '1440x2560'],
    aspectRatios: WIDE_RATIOS,
  },
  { ...IMAGE_BASE, modelId: 'gpt-image-1.5', label: 'GPT Image 1.5', sizes: STANDARD_SIZES, aspectRatios: STANDARD_RATIOS },
  { ...IMAGE_BASE, modelId: 'gpt-image-1', label: 'GPT Image 1', sizes: STANDARD_SIZES, aspectRatios: STANDARD_RATIOS },
  { ...IMAGE_BASE, modelId: 'gpt-image-1-mini', label: 'GPT Image 1 mini', sizes: STANDARD_SIZES, aspectRatios: STANDARD_RATIOS },
];

export class OpenAiSpeechAdapter implements SpeechAdapter {
  readonly version = 'cuccut-providers/openai-speech@1';

  models(_config: AdapterConfig): SpeechModelInfo[] {
    return structuredClone(SPEECH_MODELS);
  }

  synthesize(request: SpeechRequest): Promise<SpeechOutput> {
    return openAiSynthesize(request, { label: LABEL, compatible: false });
  }
}

export class OpenAiImageAdapter implements ImageAdapter {
  readonly version = 'cuccut-providers/openai-image@1';

  models(_config: AdapterConfig): ImageModelInfo[] {
    return structuredClone(IMAGE_MODELS);
  }

  generate(request: ImageRequest): Promise<ImageOutput> {
    return openAiGenerateImages(request, { label: LABEL, compatible: false });
  }
}
