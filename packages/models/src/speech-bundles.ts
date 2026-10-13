import type { ModelLicense, SpeechVoiceDescription } from '@cuccut/protocol';
import { ModelsSpeechBundles as M } from '@cuccut/protocol/messages/models/speech-bundles.ts';
import type { BundleComponentSource, BundleDefinition, SpeechBundleProfile } from './bundle-registry.ts';

/**
 * Model packages for local speech synthesis (architecture design §6.3). `bundleId` is `<model>@<backend>-<quantisation>`; the model name matches the synthesis model table in the prototype.
 * The repositories, revisions and file manifests (`repo-manifests.ts`) are taken from the fixed manifests that the old CucCut version used for the same revision.
 *
 * Components: `tts` is the main model; `codec` is the speech codec shared by Qwen3-TTS (one copy, kept by reference); `aux` is the IndexTTS2 auxiliary weights used by IndexTTS 2.5 (w2v-BERT, CAM++, BigVGAN and statistics). It shares the whole IndexTTS2 repository directly: the same repository and revision as `indextts2@mlx-fp16`, installed once and kept by reference. The cost is that installing only 2.5 also downloads IndexTTS2's main weights (see architecture design §14).
 *
 * Engines are wired into the Model Worker one by one. The Worker declares the model families it has wired in under `synthesizeFamilies` in `worker.hello`, and the Runtime refuses unwired ones before loading them, without disabling the model package (Model Worker protocol spec §2.1).
 *
 * Every MLX model package has a candle variant (`<model>@candle`, architecture design §6.5): the same repository and revision. At load time, the quantised weights are dequantised and the weights converted to the compute precision (f32 on CPU, kept at half precision on CUDA). It is listed only on platforms other than Apple Silicon. `weightBits` / `parameters` on components are used only for the candle estimate of resident memory (`candleResidentBytes`). The parameter count is taken from the safetensors header; quantised tensors are expanded by bit width, and `scales` / `biases` are not counted.
 */

const QWEN3_TTS_CODEC: BundleComponentSource = {
  family: 'qwen3-tts-tokenizer',
  repo: 'Qwen/Qwen3-TTS-Tokenizer-12Hz',
  revision: '7dd38ad4e9bad454aae9cd937d0cd577604fe229',
  weightBits: 32,
  parameters: 170_557_441,
};

const INDEX_TTS2_REPO = { repo: 'aufklarer/IndexTTS2-MLX-fp16', revision: '208b3d6ea53a119f3501b3bfd8e666b9b5e8c705' };

/** Storage bit width and parameter count of the main model component (used for the candle resident-memory estimate). */
type WeightSize = Required<Pick<BundleComponentSource, 'weightBits' | 'parameters'>>;

const QWEN3_TTS_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es', 'it', 'pt', 'ru'];
/** The nine speakers of Qwen3-TTS CustomVoice (the same table for 0.6B and 1.7B); the names are identifiers in the weights and are not translated. */
export const QWEN3_TTS_SPEAKERS = ['Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee'];

/** Suggested length of a reference recording for cloning: 3–15 seconds (shared by the five engines that can clone). */
const REFERENCE_SECONDS: [number, number] = [3, 15];

/** OmniVoice's closed vocabulary for voice description: at most one entry per category; entries for each language in the same category correspond by index. */
// i18n-ignore-start: voice-description vocabulary handed to the model (each language's entries are passed through to OmniVoice as-is)
export const OMNIVOICE_VOCABULARY: SpeechVoiceDescription = {
  kind: 'vocabulary',
  categories: [
    { category: 'gender', terms: { en: ['male', 'female'], zh: ['男', '女'] } },
    {
      category: 'age',
      terms: { en: ['child', 'teenager', 'young adult', 'middle-aged', 'elderly'], zh: ['儿童', '少年', '青年', '中年', '老年'] },
    },
    {
      category: 'pitch',
      terms: {
        en: ['very low pitch', 'low pitch', 'moderate pitch', 'high pitch', 'very high pitch'],
        zh: ['极低音调', '低音调', '中音调', '高音调', '极高音调'],
      },
    },
    { category: 'style', terms: { en: ['whisper'], zh: ['耳语'] } },
    {
      category: 'accent',
      terms: {
        en: [
          'american accent',
          'british accent',
          'australian accent',
          'chinese accent',
          'canadian accent',
          'indian accent',
          'korean accent',
          'portuguese accent',
          'russian accent',
          'japanese accent',
        ],
      },
    },
    {
      category: 'dialect',
      terms: {
        zh: ['河南话', '陕西话', '四川话', '贵州话', '云南话', '桂林话', '济南话', '石家庄话', '甘肃话', '宁夏话', '青岛话', '东北话'],
      },
    },
  ],
};
// i18n-ignore-end

const QWEN3_TTS_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base',
  commercialUse: true,
  // The licence summary is for display: a getter, generated in the current language when read (when listing status or serialising over the wire).
  get summary() {
    return M.qwen3TtsLicense().text;
  },
};
const INDEX_TTS2_LICENSE: ModelLicense = {
  name: 'bilibili Model Use License Agreement',
  url: 'https://huggingface.co/IndexTeam/IndexTTS-2/blob/main/LICENSE.txt',
  commercialUse: true,
  get summary() {
    return M.indexTts2License().text;
  },
};
const INDEX_TTS25_LICENSE: ModelLicense = {
  name: 'bilibili Model Use License Agreement',
  url: 'https://huggingface.co/IndexTeam/IndexTTS-2.5/blob/main/LICENSE',
  commercialUse: true,
  get summary() {
    return M.indexTts25License().text;
  },
};

const MLX = { backend: 'mlx', device: 'metal', capability: 'synthesize' } as const;

function qwen3(
  bundleId: string,
  label: string,
  repo: string,
  revision: string,
  size: WeightSize,
  variant: 'base' | 'customvoice' | 'voicedesign',
  slow: boolean,
  license: ModelLicense = QWEN3_TTS_LICENSE,
): BundleDefinition {
  const common = {
    family: 'qwen3-tts',
    languages: QWEN3_TTS_LANGUAGES,
    emotion: false,
    knobs: {},
    maxDurationSec: null,
    acceptsSeed: true,
    readings: 'homophone',
    sampleRate: 24_000,
    slow,
  } as const;
  const speech: SpeechBundleProfile =
    variant === 'customvoice'
      ? {
          ...common,
          voiceModes: ['preset'],
          presets: 'model',
          speakers: QWEN3_TTS_SPEAKERS,
          reference: null,
          voiceDescription: null,
          instructions: 'style',
        }
      : variant === 'voicedesign'
        ? {
            ...common,
            voiceModes: ['preset', 'describe'],
            presets: 'builtin-description',
            reference: null,
            voiceDescription: { kind: 'free' },
            instructions: null,
          }
        : {
            ...common,
            voiceModes: ['preset', 'clone'],
            presets: 'builtin-reference',
            reference: { recommendedSeconds: REFERENCE_SECONDS, withTranscriptSeconds: null, acceptsTranscript: true },
            voiceDescription: null,
            instructions: null,
          };
  return {
    bundleId,
    label,
    ...MLX,
    components: { tts: { family: 'qwen3-tts', repo, revision, ...size }, codec: QWEN3_TTS_CODEC },
    license,
    speech,
  };
}

const MLX_SPEECH_BUNDLES: readonly BundleDefinition[] = [
  qwen3(
    'qwen3-tts-0.6b-base@mlx-8bit',
    'Qwen3-TTS 0.6B Base',
    'aufklarer/Qwen3-TTS-12Hz-0.6B-Base-MLX-8bit',
    '2a20f4adf0436810367cea5a51aa7eb1bc50b6d8',
    { weightBits: 8, parameters: 914_643_008 },
    'base',
    false,
  ),
  qwen3(
    'qwen3-tts-0.6b-customvoice@mlx-bf16',
    'Qwen3-TTS 0.6B CustomVoice',
    'aufklarer/Qwen3-TTS-12Hz-0.6B-CustomVoice-MLX-bf16',
    '3affbf656d9d6aa9255ec0b31cc90055605170bc',
    { weightBits: 16, parameters: 905_788_672 },
    'customvoice',
    false,
  ),
  qwen3(
    'qwen3-tts-1.7b-base@mlx-8bit',
    'Qwen3-TTS 1.7B Base',
    'aufklarer/Qwen3-TTS-12Hz-1.7B-Base-MLX-8bit',
    '87d008f1e1a20d265bee01c7ccb0a78f5b8d1132',
    { weightBits: 8, parameters: 1_928_677_440 },
    'base',
    true,
  ),
  qwen3(
    'qwen3-tts-1.7b-customvoice@mlx-8bit',
    'Qwen3-TTS 1.7B CustomVoice',
    'mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit',
    '41d3337e8b7f2843a75841595fc14e4b9a7a4b96',
    { weightBits: 8, parameters: 1_916_676_352 },
    'customvoice',
    true,
  ),
  qwen3(
    'qwen3-tts-1.7b-voicedesign@mlx-8bit',
    'Qwen3-TTS 1.7B VoiceDesign',
    'mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit',
    'f90d617701d9f7f4ca499291e0b57f2b3c2fd2ee',
    { weightBits: 8, parameters: 1_916_676_352 },
    'voicedesign',
    true,
    { ...QWEN3_TTS_LICENSE, url: 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign' },
  ),
  {
    bundleId: 'indextts2@mlx-fp16',
    label: 'IndexTTS2',
    ...MLX,
    // The whole repository (including `aux/`) is counted against this model package.
    components: { tts: { family: 'indextts2', ...INDEX_TTS2_REPO, weightBits: 16, parameters: 1_915_602_132 } },
    license: INDEX_TTS2_LICENSE,
    speech: {
      family: 'indextts2',
      languages: 'any',
      voiceModes: ['preset', 'clone'],
      presets: 'builtin-reference',
      // IndexTTS takes the voice only from the reference recording, not from the transcript.
      reference: { recommendedSeconds: REFERENCE_SECONDS, withTranscriptSeconds: null, acceptsTranscript: false },
      voiceDescription: null,
      instructions: null,
      emotion: true,
      knobs: {},
      maxDurationSec: null,
      acceptsSeed: true,
      readings: 'inline-pinyin',
      sampleRate: 22_050,
      slow: false,
    },
  },
  {
    bundleId: 'index-tts2.5@mlx-fp16',
    label: 'IndexTTS 2.5',
    ...MLX,
    components: {
      tts: {
        family: 'indextts2.5',
        repo: 'mlx-community/IndexTTS-2.5-fp16',
        revision: '65644cd70da15309ffeb74aa03f3686bb04e3eb1',
        weightBits: 16,
        parameters: 966_515_596,
      },
      // Reads only the w2v-BERT, CAM++, BigVGAN and statistics under `aux/`; the parameter count counts only these.
      aux: { family: 'indextts2-aux', ...INDEX_TTS2_REPO, weightBits: 16, parameters: 699_767_331 },
    },
    license: INDEX_TTS25_LICENSE,
    speech: {
      family: 'indextts2',
      languages: ['zh', 'en', 'ja', 'es', 'ar'],
      voiceModes: ['preset', 'clone'],
      presets: 'builtin-reference',
      reference: { recommendedSeconds: REFERENCE_SECONDS, withTranscriptSeconds: null, acceptsTranscript: false },
      voiceDescription: null,
      instructions: null,
      emotion: true,
      // The speaking rate scales the number of target semantic tokens by the multiplier.
      knobs: { speed: { min: 0.5, max: 1.5, step: 0.05, default: 1 } },
      maxDurationSec: null,
      acceptsSeed: true,
      readings: 'annotated',
      sampleRate: 22_050,
      slow: false,
    },
  },
  {
    bundleId: 'gpt-sovits-v2@mlx-fp16',
    label: 'GPT-SoVITS v2',
    ...MLX,
    components: {
      tts: {
        family: 'gpt-sovits',
        repo: 'PJMixers-Dev/lj1995_GPT-SoVITS-safetensors',
        revision: 'cea8b8279588e63c2fdc10e02610c11f02af5450',
        weightBits: 16,
        parameters: 550_408_203,
      },
    },
    license: {
      name: 'MIT',
      url: 'https://huggingface.co/lj1995/GPT-SoVITS',
      commercialUse: true,
      get summary() {
        return M.gptSovitsLicense().text;
      },
    },
    speech: {
      family: 'gpt-sovits',
      languages: ['zh', 'en'],
      voiceModes: ['preset', 'clone'],
      presets: 'builtin-reference',
      // When a transcript is given, the reference recording must be 3–10 seconds.
      reference: { recommendedSeconds: REFERENCE_SECONDS, withTranscriptSeconds: [3, 10], acceptsTranscript: true },
      voiceDescription: null,
      instructions: null,
      emotion: false,
      knobs: {},
      maxDurationSec: null,
      acceptsSeed: true,
      readings: 'unsupported',
      sampleRate: 32_000,
      slow: false,
    },
  },
  {
    bundleId: 'voxcpm2@mlx-int8',
    label: 'VoxCPM2',
    ...MLX,
    components: {
      tts: {
        family: 'voxcpm2',
        repo: 'aufklarer/VoxCPM2-MLX-int8',
        revision: '471a37b830ccf5e23fdb4c822649ec7c3b7320b4',
        weightBits: 8,
        parameters: 2_383_791_364,
      },
    },
    license: {
      name: 'Apache-2.0',
      url: 'https://huggingface.co/openbmb/VoxCPM2',
      commercialUse: true,
      get summary() {
        return M.voxcpm2License().text;
      },
    },
    speech: {
      family: 'voxcpm2',
      languages: 'any',
      voiceModes: ['preset', 'clone'],
      presets: 'builtin-reference',
      reference: { recommendedSeconds: REFERENCE_SECONDS, withTranscriptSeconds: null, acceptsTranscript: true },
      voiceDescription: null,
      // The style description is placed before the text; when it is given, the continuation-style high-fidelity cloning is not used.
      instructions: 'style',
      emotion: false,
      knobs: { cfg: { min: 1, max: 3, step: 0.1, default: 2 }, steps: { min: 1, max: 50, step: 1, default: 10 } },
      maxDurationSec: null,
      acceptsSeed: true,
      readings: 'unsupported',
      sampleRate: 48_000,
      slow: false,
    },
  },
  {
    bundleId: 'omnivoice@mlx-int8',
    label: 'OmniVoice',
    ...MLX,
    components: {
      tts: {
        family: 'omnivoice',
        repo: 'aufklarer/OmniVoice-MLX-int8',
        revision: 'e815dfafaf9c90f995ddc9fcfe52fd0d80babe4e',
        weightBits: 8,
        parameters: 813_977_833,
      },
    },
    license: {
      name: 'CC-BY-NC-4.0',
      url: 'https://huggingface.co/k2-fsa/OmniVoice',
      commercialUse: false,
      get summary() {
        return M.omnivoiceLicense().text;
      },
    },
    speech: {
      family: 'omnivoice',
      languages: 'any',
      voiceModes: ['preset', 'clone', 'describe'],
      presets: 'builtin-reference',
      reference: { recommendedSeconds: REFERENCE_SECONDS, withTranscriptSeconds: null, acceptsTranscript: true },
      voiceDescription: OMNIVOICE_VOCABULARY,
      instructions: null,
      emotion: false,
      knobs: {
        speed: { min: 0.5, max: 1.5, step: 0.05, default: 1 },
        cfg: { min: 0, max: 4, step: 0.1, default: 2 },
        steps: { min: 4, max: 64, step: 1, default: 32 },
      },
      maxDurationSec: 60,
      acceptsSeed: true,
      readings: 'unsupported',
      sampleRate: 24_000,
      slow: false,
    },
  },
];

/** The candle variant of an MLX model package: same repository and features, ID `<model>@candle`, registered device `cpu` (the Runtime switches to `cuda` when the Worker reports CUDA). */
function onCandle(def: BundleDefinition): BundleDefinition {
  return { ...def, bundleId: `${def.bundleId.split('@')[0]}@candle`, backend: 'candle', device: 'cpu' };
}

export const SPEECH_BUNDLES: readonly BundleDefinition[] = [...MLX_SPEECH_BUNDLES, ...MLX_SPEECH_BUNDLES.map(onCandle)];
