import { randomInt } from 'node:crypto';
import path from 'node:path';

import type { GenerationParameters, ModelBundleStatus, MusicModelInfo } from '@cuccut/protocol';
import { ModelsLocalMusic as M } from '@cuccut/protocol/messages/models/local-music.ts';
import type { BundleDefinition, MusicBundleProfile } from './bundle-registry.ts';
import { MUSIC_OUTPUT_FILE } from './worker-contract.ts';

/**
 * Local music generation (architecture design §6.1, §6.3): the model pack description, the seed frozen at submission, and the conversion from frozen parameters to the audio.cpp engine command line.
 * The engine (`audiocpp_cli`) starts one process per task, reads the GGUF in the model pack directory, and writes a WAV into staging. No Model Worker is involved.
 */

export type MusicParameters = Extract<GenerationParameters, { capability: 'generateMusic' }>;

/** Environment variable for the engine executable: when given, it is used exclusively (for development, point to your own build or downloaded `audiocpp_cli`; the directory's `engineOverride`), and PATH is ignored. */
export const AUDIO_CPP_CLI_ENV = 'CUCCUT_AUDIOCPP_CLI';
/** Environment variable for the engine backend (`metal` / `cuda` / `vulkan` / `cpu`): when not given, the engine chooses according to its build. */
export const AUDIO_CPP_BACKEND_ENV = 'CUCCUT_AUDIOCPP_BACKEND';

/**
 * The model description for `generateMusic`: songs and instrumental tracks, WAV output only, accepts seed and steps. Limits come from the features the model pack registers. `engine` is the engine component's executable (`ModelCatalog.engineExecutable`; null when not installed, in which case the model is entirely unavailable, and the caller supplies `unavailableReason`). The engine is a required component of the model pack; when it is not installed, the explanation is the `detail` of the model pack's status.
 */
export function localMusicModelInfo(def: BundleDefinition, status: ModelBundleStatus, usable: boolean, engine: string | null): MusicModelInfo {
  const profile = def.music!;
  return {
    modelId: def.bundleId,
    label: def.label,
    modes: [...profile.modes],
    maxStyleChars: profile.maxStyleChars,
    maxLyricsChars: profile.maxLyricsChars,
    maxDurationSec: profile.maxDurationSec,
    defaultDurationSec: profile.defaultDurationSec,
    formats: ['wav'],
    defaultFormat: 'wav',
    acceptsSeed: true,
    cost: 'free-local',
    available: usable && engine !== null,
    local: {
      family: profile.family,
      engine: { id: profile.engine, executable: engine },
      sampleRate: profile.sampleRate,
      lyricLanguages: profile.lyricLanguages === 'unverified' ? 'unverified' : [...profile.lyricLanguages],
      planning: { options: [...profile.planning.options], default: profile.planning.default },
      steps: { ...profile.steps },
      slow: profile.slow,
      license: def.license!,
    },
    ...(profile.slow ? { notes: M.slowLocal().text } : {}),
    ...((!usable || engine === null) && status.detail
      ? { detail: status.detail, ...(status.detailRef ? { detailRef: status.detailRef } : {}) }
      : {}),
  };
}

/**
 * The music seed is frozen at submission: if the request doesn't give one, one is drawn here (`0..2^32-1`). Retries and re-runs use the same one, so on the same machine they produce the same piece.
 */
export function localMusicSeed(seed: number | undefined | null): number {
  return seed ?? randomInt(0, 2 ** 32);
}

/** `maxDurationSec` → the engine's semantic token limit (integer, at least 1). */
export function semanticMaxTokens(maxDurationSec: number, profile: Pick<MusicBundleProfile, 'semanticTokensPerSec'>): number {
  return Math.max(1, Math.round(maxDurationSec * profile.semanticTokensPerSec));
}

export interface MusicEngineRun {
  /** Engine command-line arguments (excluding the executable). */
  args: string[];
  /** Output file (absolute path, in staging). */
  output: string;
  /** Token limit passed to the engine (used to tell whether it hit the limit). */
  semanticMaxTokens: number;
}

/**
 * Frozen parameters → audio.cpp engine command line (upstream `audiocpp_cli --task gen --family yue2`). Instrumental tracks use empty lyrics; arrangement is `cot`. There is no direct duration parameter, so duration is converted to `semantic_max_tokens` by the semantic frame rate. Steps take the frozen `steps`; if absent, take the caller's value (the model-pack self-test uses few steps for a short clip); if neither, do not pass it (the engine uses its default). If `backend` is not given, the engine chooses according to its build.
 */
export function musicEngineRunOf(
  parameters: MusicParameters,
  profile: MusicBundleProfile,
  options: { modelDir: string; staging: string; threads: number; backend?: string | null; steps?: number | null },
): MusicEngineRun {
  const tokens = semanticMaxTokens(parameters.maxDurationSec, profile);
  const steps = parameters.steps ?? options.steps ?? null;
  const args = [
    '--task',
    'gen',
    '--family',
    profile.family,
    '--model',
    options.modelDir,
    '--threads',
    String(options.threads),
    '--lyrics',
    parameters.mode === 'instrumental' ? '' : (parameters.lyrics ?? ''),
    '--request-option',
    `style=${parameters.style}`,
    '--request-option',
    `cot=${parameters.planning}`,
    '--request-option',
    `seed=${parameters.seed}`,
    '--request-option',
    `semantic_max_tokens=${tokens}`,
    ...(steps !== null ? ['--request-option', `num_inference_steps=${steps}`] : []),
    // The engine requires the GGUF path to be relative to the model root given by `--model` (absolute paths are rejected: `yue2.model_gguf must be relative to the Yue2 model root`).
    '--session-option',
    `${profile.family}.model_gguf=${profile.files.model}`,
    '--session-option',
    `${profile.family}.vae_gguf=${profile.files.vae}`,
    '--out-dir',
    options.staging,
    '--out',
    MUSIC_OUTPUT_FILE,
    '--log',
  ];
  if (options.backend) args.push('--backend', options.backend);
  return { args, output: path.join(options.staging, MUSIC_OUTPUT_FILE), semanticMaxTokens: tokens };
}
