import type { ModelLicense } from '@cuccut/protocol';
import { ModelsMusicBundles as M } from '@cuccut/protocol/messages/models/music-bundles.ts';
import type { BundleDefinition } from './bundle-registry.ts';
import { AUDIO_CPP_COMMAND, AUDIO_CPP_ENGINE_COMPONENT } from './music-engine.ts';

/**
 * Locally generated music model packages (architecture design §6.3). `bundleId` is `<model>@<backend>-<quantisation>`. The weights are the GGUF conversion of YuE2, executed by the audio.cpp engine (`audiocpp_cli`), not via the Model Worker. The main model, VAE and tokeniser all live in one repository, and the whole repository is one `music` component; only the Q8 main model, F16 VAE and config files listed in the manifest (`repo-manifests.ts`) are downloaded. Other quantisations in the repository (Q4, BF16, F32 VAE) are not downloaded.
 * The second required component is the engine itself (`audiocpp-engine`, see `music-engine.ts`): platform-specific, downloaded with the model package, and one copy is shared by several model packages.
 *
 * The engine selects its device at build time (Metal on macOS; the Windows and Linux downloads are Vulkan), so the registered `device` is `auto`. All platforms are listed; on a host platform with no engine package, the model package is reported as `unsupported`.
 */

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/** Engine executable name (without extension). */
export const AUDIO_CPP_ENGINE = AUDIO_CPP_COMMAND;

const YUE2_LICENSE: ModelLicense = {
  name: 'CC-BY-NC-4.0',
  url: 'https://huggingface.co/audio-cpp/Yue2-3B-GGUF/blob/main/model_licenses.md',
  commercialUse: false,
  // The licence summary is for display: a getter, generated in the current language when read (when listing status or serialising over the wire).
  get summary() {
    return M.yue2License().text;
  },
};

/** The engine's semantic token frame rate: YuE2 produces 25 semantic tokens per second (the basis for converting upstream `semantic_max_tokens`). */
export const YUE2_SEMANTIC_TOKENS_PER_SEC = 25;

const YUE2_3B_Q8: BundleDefinition = {
  bundleId: 'yue2-3b@audio-cpp-q8',
  capability: 'music',
  backend: 'audio-cpp',
  device: 'auto',
  components: {
    music: { family: 'yue2', repo: 'audio-cpp/Yue2-3B-GGUF', revision: 'cca74d8980c00f30ab8d52248a367c01ad633ec2' },
    // Weights first: installation downloads in registration order.
    'audiocpp-engine': AUDIO_CPP_ENGINE_COMPONENT,
  },
  label: 'YuE2 3B',
  license: YUE2_LICENSE,
  music: {
    family: 'yue2',
    engine: AUDIO_CPP_ENGINE,
    modes: ['song', 'instrumental'],
    maxStyleChars: 2000,
    maxLyricsChars: 4000,
    // Upstream generation takes about two minutes by default; longer passages are proportionally slower, and the cap is set at five minutes for now.
    maxDurationSec: 300,
    defaultDurationSec: 120,
    semanticTokensPerSec: YUE2_SEMANTIC_TOKENS_PER_SEC,
    sampleRate: 44100,
    planning: { options: ['off', 'melody', 'full'], default: 'melody' },
    // The upstream CLI's `num_inference_steps` defaults to 8.
    steps: { min: 1, max: 50, step: 1, default: 8 },
    lyricLanguages: 'unverified',
    files: { model: 'yue2-3b-q8_0.gguf', vae: 'yue2-vae-f16.gguf' },
    // Upstream measured a peak VRAM of about 8867 MiB for Q8 with the F16 VAE on an RTX 5090; 10 GiB is reserved to absorb fluctuation. Not re-measured in this repository.
    peakBytes: 10 * GiB,
    peakEstimated: true,
    slow: true,
  },
};

export const MUSIC_BUNDLES: readonly BundleDefinition[] = [YUE2_3B_Q8];
