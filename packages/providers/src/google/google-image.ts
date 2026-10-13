// Google Gemini image generation adapter (architecture design §6.4). Documentation read on 2026-10-03:
//   https://ai.google.dev/gemini-api/docs/image-generation
//   https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image
//   https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image
//   https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-image
// Confirmed by the docs: `POST {base}/interactions`, with the `x-goog-api-key` and `Api-Revision` request headers; `input: [{ type: 'text', text }]`;
// top-level `response_format: { type: 'image', mime_type, aspect_ratio, image_size }` (`image_size` is '512', '1K', '2K' or '4K',
// with K in uppercase); the result is in `content[]` of the `steps[]` entries with `type: 'model_output'`, as an image block `{ type: 'image', data (base64), mime_type }`;
// steps with `type: 'thought'` hold unbilled intermediate images (not taken); each model's aspect ratio and pixel size table (copied here as is); the 3.1 Flash Image input limit
// is 131,072 tokens, and 3 Pro Image and 3.1 Flash Lite Image are 65,536; reference images: 3.x allows up to 14, 2.5 up to 3 (not used in this version);
// gemini-2.5-flash-image only accepts `aspect_ratio`.
// Not confirmed: how many images one request returns (the docs have no count parameter, so one image per request, with a maximum of 4 as our own limit); `seed` (not exposed);
// `mime_type: 'image/webp'` (not offered); the pixel sizes for each aspect ratio of 3.1 Flash Lite Image (the docs give only aspect ratios, so the 1K sizes of 3.1 Flash Image are declared);
// the prompt length limit in characters (declared as 32000 characters, far below the token limit).
import { ProviderFailure } from '@cuccut/models';
import type { ImageAspectRatio, ImageFormat, ImageModelInfo } from '@cuccut/protocol';
import {
  generationTimeoutMs,
  IMAGE_MEDIA,
  type AdapterConfig,
  type ImageAdapter,
  type ImageOutput,
  type ImageRequest,
} from '../adapter.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { classifyGoogle, GOOGLE_API_REVISION, googleAuthOf, googleHttpOptions } from './google-adapter.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

const LABEL = 'Google Gemini';
const RESOLUTIONS = ['512', '1K', '2K', '4K'] as const;
type Resolution = (typeof RESOLUTIONS)[number];

/** Size table for 3.x: aspect ratio → pixel size at each resolution (3 Pro Image and 3.1 Flash Image are the same at 1K/2K/4K). */
const GEMINI_3_SIZES: Record<string, Record<Resolution, string>> = {
  '1:1': { '512': '512x512', '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' },
  '1:4': { '512': '256x1024', '1K': '512x2048', '2K': '1024x4096', '4K': '2048x8192' },
  '1:8': { '512': '192x1536', '1K': '384x3072', '2K': '768x6144', '4K': '1536x12288' },
  '2:3': { '512': '424x632', '1K': '848x1264', '2K': '1696x2528', '4K': '3392x5056' },
  '3:2': { '512': '632x424', '1K': '1264x848', '2K': '2528x1696', '4K': '5056x3392' },
  '3:4': { '512': '448x600', '1K': '896x1200', '2K': '1792x2400', '4K': '3584x4800' },
  '4:1': { '512': '1024x256', '1K': '2048x512', '2K': '4096x1024', '4K': '8192x2048' },
  '4:3': { '512': '600x448', '1K': '1200x896', '2K': '2400x1792', '4K': '4800x3584' },
  '4:5': { '512': '464x576', '1K': '928x1152', '2K': '1856x2304', '4K': '3712x4608' },
  '5:4': { '512': '576x464', '1K': '1152x928', '2K': '2304x1856', '4K': '4608x3712' },
  '8:1': { '512': '1536x192', '1K': '3072x384', '2K': '6144x768', '4K': '12288x1536' },
  '9:16': { '512': '384x688', '1K': '768x1376', '2K': '1536x2752', '4K': '3072x5504' },
  '16:9': { '512': '688x384', '1K': '1376x768', '2K': '2752x1536', '4K': '5504x3072' },
  '21:9': { '512': '792x168', '1K': '1584x672', '2K': '3168x1344', '4K': '6336x2688' },
};

const TEN_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/** gemini-2.5-flash-image: one fixed size per aspect ratio. */
const GEMINI_25_SIZES: Record<string, string> = {
  '1:1': '1024x1024',
  '2:3': '832x1248',
  '3:2': '1248x832',
  '3:4': '864x1184',
  '4:3': '1184x864',
  '4:5': '896x1152',
  '5:4': '1152x896',
  '9:16': '768x1344',
  '16:9': '1344x768',
  '21:9': '1536x672',
};

/** How a size is expressed in the request. */
interface SizeSpec {
  aspectRatio: string;
  imageSize: Resolution | null;
}

interface GoogleImageModel {
  info: ImageModelInfo;
  sizes: Map<string, SizeSpec>;
}

function gemini3(ratios: string[], resolutions: readonly Resolution[]): Map<string, SizeSpec> {
  const sizes = new Map<string, SizeSpec>();
  for (const resolution of resolutions) {
    for (const ratio of ratios) sizes.set(GEMINI_3_SIZES[ratio]![resolution], { aspectRatio: ratio, imageSize: resolution });
  }
  return sizes;
}

function model(
  modelId: string,
  label: string,
  sizes: Map<string, SizeSpec>,
  referenceImages: number,
  extra: Partial<ImageModelInfo> = {},
): GoogleImageModel {
  // The aspect-ratio form uses 1K (2.5 has only one size).
  const aspectRatios: ImageAspectRatio[] = [];
  for (const [size, spec] of sizes) {
    if ((spec.imageSize === '1K' || spec.imageSize === null) && !aspectRatios.some((a) => a.ratio === spec.aspectRatio)) {
      aspectRatios.push({ ratio: spec.aspectRatio, size });
    }
  }
  return {
    info: {
      modelId,
      label,
      sizes: [...sizes.keys()],
      aspectRatios,
      defaultSize: null,
      maxCount: 4,
      maxPromptChars: 32_000,
      formats: ['png', 'jpeg'],
      defaultFormat: 'png',
      referenceImages: { max: referenceImages },
      acceptsSeed: false,
      cost: 'unknown',
      ...extra,
    },
    sizes,
  };
}

const MODELS: GoogleImageModel[] = [
  model('gemini-3.1-flash-image', 'Gemini 3.1 Flash Image', gemini3(Object.keys(GEMINI_3_SIZES), RESOLUTIONS), 14, { default: true }),
  model('gemini-3-pro-image', 'Gemini 3 Pro Image', gemini3(TEN_RATIOS, ['1K', '2K', '4K']), 14),
  model('gemini-3.1-flash-lite-image', 'Gemini 3.1 Flash Lite Image', gemini3(TEN_RATIOS, ['1K']), 14),
  model(
    'gemini-2.5-flash-image',
    'Gemini 2.5 Flash Image',
    new Map(Object.entries(GEMINI_25_SIZES).map(([ratio, size]) => [size, { aspectRatio: ratio, imageSize: null }])),
    3,
  ),
];

export class GoogleImageAdapter implements ImageAdapter {
  readonly version = 'cuccut-providers/google-image@1';

  models(_config: AdapterConfig): ImageModelInfo[] {
    return MODELS.map((m) => structuredClone(m.info));
  }

  async generate(request: ImageRequest): Promise<ImageOutput> {
    const { config, parameters } = request;
    const known = MODELS.find((m) => m.info.modelId === request.model.modelId);
    const spec = parameters.size ? known?.sizes.get(parameters.size) : undefined;
    if (parameters.size && !spec) {
      throw new ProviderFailure('rejected', PH.noImageSize({ label: LABEL, model: request.model.modelId, size: String(parameters.size) }).text, {
        code: 'PROVIDER_REJECTED',
      });
    }
    const mimeType = IMAGE_MEDIA[parameters.format].mediaType;
    const body = JSON.stringify({
      model: request.model.modelId,
      input: [{ type: 'text', text: parameters.prompt }],
      response_format: {
        type: 'image',
        mime_type: mimeType,
        ...(spec ? { aspect_ratio: spec.aspectRatio } : {}),
        ...(spec?.imageSize ? { image_size: spec.imageSize } : {}),
      },
    });
    // The docs have no count parameter: one image per request, sent in sequence (the queue for the same provider already limits concurrency).
    const images: Buffer[] = [];
    const usage: unknown[] = [];
    for (let i = 0; i < parameters.count; i++) {
      const response = await providerFetch(googleHttpOptions(config, request.http), {
        method: 'POST',
        url: `${config.baseUrl}/interactions`,
        headers: { 'content-type': 'application/json', 'api-revision': GOOGLE_API_REVISION },
        auth: googleAuthOf(config),
        body: () => body,
        timeoutMs: generationTimeoutMs(request.http),
        signal: request.signal,
        classify: classifyGoogle,
      });
      const { image, usage: one } = parseImageInteraction(response.json(), parameters.format);
      images.push(image);
      if (one !== undefined) usage.push(one);
      request.progress(images.length);
    }
    return { images, ...(usage.length > 0 ? { usage } : {}) };
  }
}

/** Takes the last image in the last `model_output` step; intermediate `thought` images are not counted. */
export function parseImageInteraction(value: unknown, format: ImageFormat): { image: Buffer; usage?: unknown } {
  if (!isObject(value)) throw new ProviderFailure('protocol', PH.notObject({ label: LABEL }).text);
  if (value.status === 'failed' || value.status === 'cancelled') {
    throw new ProviderFailure('rejected', PH.generateIncomplete({ label: LABEL, status: String(value.status) }).text, { code: 'PROVIDER_REJECTED' });
  }
  let found: Record<string, unknown> | null = null;
  const texts: string[] = [];
  for (const step of arrayOf(value.steps)) {
    if (step.type !== 'model_output') continue;
    for (const content of arrayOf(step.content)) {
      if (content.type === 'image' && typeof content.data === 'string' && content.data) found = content;
      if (content.type === 'text' && typeof content.text === 'string') texts.push(content.text);
    }
  }
  if (!found) {
    // When the model refuses to generate and returns only text (for example, due to a content policy), it is treated as a rejection, with a short excerpt of the original text attached.
    const said = texts.join(' ').trim().slice(0, 200);
    throw new ProviderFailure('rejected', (said ? PH.noImageReturnedSaid({ label: LABEL, said }) : PH.noImageReturned({ label: LABEL })).text, { code: 'PROVIDER_REJECTED' });
  }
  const expected = IMAGE_MEDIA[format].mediaType;
  if (typeof found.mime_type === 'string' && found.mime_type !== expected) {
    throw new ProviderFailure('protocol', PH.wrongMime({ label: LABEL, got: String(found.mime_type), want: expected }).text);
  }
  return { image: Buffer.from(found.data as string, 'base64'), ...(value.usage !== undefined ? { usage: value.usage } : {}) };
}

function arrayOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
