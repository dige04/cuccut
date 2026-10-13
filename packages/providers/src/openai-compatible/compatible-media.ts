// Speech synthesis and image generation for OpenAI-compatible endpoints (architecture design §6.4): users declare models with `capability` `synthesizeSpeech` / `generateImage`, and the request shape matches OpenAI (`POST {base}/audio/speech`, `POST {base}/images/generations`, see openai-generation.ts).
// All of this is assumed, not confirmed for each implementation: compatible endpoints accept any string as `voice` and the declared format as `response_format`; image endpoints accept
// `response_format: 'b64_json'` and return the image in `data[].b64_json` (endpoints that return only `url` are not supported); `output_format` may be ignored,
// and if the endpoint returns an image format different from the declared one, it fails the validation before publishing (`MODEL_OUTPUT_INVALID`).
import type { DeclaredModel, ImageModelInfo, SpeechModelInfo } from '@cuccut/protocol';
import type { AdapterConfig, ImageAdapter, ImageOutput, ImageRequest, SpeechAdapter, SpeechOutput, SpeechRequest } from '../adapter.ts';
import { openAiGenerateImages, openAiSynthesize } from '../openai/openai-generation.ts';
import { declaredOf } from './compatible-adapter.ts';

export class CompatibleSpeechAdapter implements SpeechAdapter {
  readonly version = 'cuccut-providers/openai-compatible-speech@1';
  readonly #label: () => string;

  constructor(label: () => string) {
    this.#label = label;
  }

  models(config: AdapterConfig): SpeechModelInfo[] {
    return declaredOf(config, 'synthesizeSpeech').map((m, i) => declaredSpeechInfo(m, i === 0));
  }

  synthesize(request: SpeechRequest): Promise<SpeechOutput> {
    return openAiSynthesize(request, { label: this.#label(), compatible: true });
  }
}

export class CompatibleImageAdapter implements ImageAdapter {
  readonly version = 'cuccut-providers/openai-compatible-image@1';
  readonly #label: () => string;

  constructor(label: () => string) {
    this.#label = label;
  }

  models(config: AdapterConfig): ImageModelInfo[] {
    return declaredOf(config, 'generateImage').map((m, i) => declaredImageInfo(m, i === 0));
  }

  generate(request: ImageRequest): Promise<ImageOutput> {
    return openAiGenerateImages(request, { label: this.#label(), compatible: true });
  }
}

/** Fills in conservative defaults for declared speech models: the first voice is the default voice, and voice IDs that were not declared are also accepted. */
export function declaredSpeechInfo(model: DeclaredModel, isDefault: boolean): SpeechModelInfo {
  const voices = (model.voices ?? []).map((voiceId) => ({ voiceId, label: voiceId }));
  const formats = model.formats?.length ? [...model.formats] : (['mp3'] as const);
  return {
    modelId: model.modelId,
    label: model.label ?? model.modelId,
    ...(isDefault ? { default: true } : {}),
    declared: true,
    voices,
    defaultVoice: voices[0]?.voiceId ?? null,
    voiceModes: voices.length > 0 ? ['preset', 'custom'] : ['custom'],
    languages: 'any',
    maxInputChars: model.maxInputChars ?? 4096,
    formats: [...formats],
    defaultFormat: formats[0]!,
    acceptsInstructions: false,
    speedRange: null,
    acceptsSeed: false,
    cost: 'unknown',
  };
}

/** Fills in conservative defaults for declared image models: the first size is the default size (1024x1024 if none is declared), one image at a time, `png`. */
export function declaredImageInfo(model: DeclaredModel, isDefault: boolean): ImageModelInfo {
  const sizes = model.sizes?.length ? [...model.sizes] : ['1024x1024'];
  return {
    modelId: model.modelId,
    label: model.label ?? model.modelId,
    ...(isDefault ? { default: true } : {}),
    declared: true,
    sizes,
    aspectRatios: [],
    defaultSize: sizes[0]!,
    maxCount: model.maxCount ?? 1,
    maxPromptChars: model.maxPromptChars ?? 4000,
    formats: ['png'],
    defaultFormat: 'png',
    referenceImages: null,
    acceptsSeed: false,
    cost: 'unknown',
  };
}
