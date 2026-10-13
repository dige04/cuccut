import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  GenerateMusicRequest,
  ModelBundleStatus,
  MusicModelInfo,
} from '@cuccut/protocol';
import { RpcError } from '@cuccut/protocol';
import { BUNDLES } from './bundle-registry.ts';
import { musicParameters } from './generation-options.ts';
import { LocalProviderSource } from './local-source.ts';
import {
  AUDIO_CPP_CLI_ENV,
  localMusicModelInfo,
  localMusicSeed,
  musicEngineRunOf,
  semanticMaxTokens,
} from './local-music.ts';
import { MANIFEST_FILE, ModelCatalog } from './model-catalog.ts';
import type { ModelChoice } from './model-selection.ts';
import {
  AUDIO_CPP_ENGINE,
  MUSIC_BUNDLES,
  YUE2_SEMANTIC_TOKENS_PER_SEC,
} from './music-bundles.ts';
import {
  MUSIC_SELF_TEST,
  musicSelfTestParameters,
  musicSelfTestVerdict,
} from './music-self-test.ts';
import { AUDIO_CPP_ENGINE_COMPONENT, AUDIO_CPP_RELEASE } from './music-engine.ts';
import { repoManifestFor } from './repo-manifests.ts';
import { MUSIC_OUTPUT_FILE } from './worker-contract.ts';

/** Registration of locally generated music model packages, model descriptions, conversion of frozen parameters to engine command-line arguments, and the self-test verdict (architecture design §6.1, §6.3; Model Worker protocol spec §4.4). */

const YUE = MUSIC_BUNDLES[0]!;
const GiB = 1024 * 1024 * 1024;
const status = { detail: undefined } as unknown as ModelBundleStatus;

describe('registration of local music model packs', () => {
  it('YuE2 3B\'s q8 GGUF is in the overall registry as music / audio-cpp; the repo as a whole is one music component, the second component is the engine, with a non-commercial license and name', () => {
    expect(MUSIC_BUNDLES.map((b) => b.bundleId)).toEqual([
      'yue2-3b@audio-cpp-q8',
    ]);
    expect(BUNDLES).toContain(YUE);
    expect(YUE).toMatchObject({
      capability: 'music',
      backend: 'audio-cpp',
      device: 'auto',
      label: 'YuE2 3B',
    });
    expect(Object.keys(YUE.components)).toEqual(['music', 'audiocpp-engine']);
    expect(YUE.components.music!.family).toBe('yue2');
    expect(YUE.components['audiocpp-engine']).toBe(AUDIO_CPP_ENGINE_COMPONENT);
    expect(YUE.music).toMatchObject({
      family: 'yue2',
      engine: AUDIO_CPP_ENGINE,
      modes: ['song', 'instrumental'],
      slow: true,
      peakEstimated: true,
    });
    expect(YUE.music!.peakBytes).toBe(10 * GiB);
    expect(YUE.music!.planning).toEqual({
      options: ['off', 'melody', 'full'],
      default: 'melody',
    });
    expect(YUE.license).toMatchObject({ commercialUse: false });
  });

  it('built-in manifest: all 6 files have sha256 and size, estimated bytes equal the sum of sizes; registered weight and VAE files are all present', () => {
    const source = YUE.components.music!;
    const manifest = repoManifestFor(source.repo, source.revision)!;
    expect(manifest).not.toBeNull();
    expect(manifest.files).toHaveLength(6);
    let total = 0;
    for (const file of manifest.files) {
      expect(file.sha256, file.path).toMatch(/^[0-9a-f]{64}$/);
      expect(file.size, file.path).toBeGreaterThan(0);
      total += file.size!;
    }
    expect(manifest.estimatedBytes).toBe(total);
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toContain(YUE.music!.files.model);
    expect(paths).toContain(YUE.music!.files.vae);
  });

  describe('status in the directory', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-music-bundles-'));
    });
    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('every platform is listed; not-installed when not installed; having only the model without the engine is not-installed / incomplete, installed only once the engine is complete; a platform without an engine pack is unsupported', async () => {
      for (const [platform, arch] of [
        ['darwin', 'arm64'],
        ['win32', 'x64'],
        ['linux', 'x64'],
      ] as const) {
        const catalog = new ModelCatalog({
          root: dir,
          platform,
          arch,
          workerAvailable: () => false,
        });
        expect(
          catalog
            .definitions()
            .filter((d) => d.capability === 'music')
            .map((d) => d.bundleId),
          `${platform}/${arch}`,
        ).toEqual([YUE.bundleId]);
        expect(
          await catalog.status(YUE.bundleId),
          `${platform}/${arch}`,
        ).toMatchObject({
          capability: 'music',
          state: 'not-installed',
          backend: 'audio-cpp',
        });
      }
      // The engine is the second required component: if the weights are present but the engine is not installed, the status is incomplete (download or repair of the model package fixes it); whether the Model Worker is present has nothing to do with it.
      await writeRepo(
        dir,
        YUE.components.music!.repo,
        YUE.components.music!.revision,
        {
          [YUE.music!.files.model]: 'gguf',
          [YUE.music!.files.vae]: 'vae',
        },
      );
      const catalog = new ModelCatalog({
        root: dir,
        platform: 'darwin',
        arch: 'arm64',
        workerAvailable: () => false,
      });
      const incomplete = await catalog.status(YUE.bundleId);
      expect(incomplete).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
      expect(incomplete!.components!.map((c) => c.component)).toEqual(['music', 'audiocpp-engine']);
      expect(incomplete!.components![1]).toMatchObject({
        repo: '0xShug0/audio.cpp',
        origin: 'github-release',
        state: 'missing',
      });
      expect(catalog.engineExecutable(YUE.bundleId)).toBeNull();
      const exe = await writeEngine(dir, 'audiocpp_cli');
      catalog.changed(YUE.bundleId);
      expect(await catalog.status(YUE.bundleId)).toMatchObject({ state: 'installed' });
      expect(catalog.engineExecutable(YUE.bundleId)).toBe(exe);
      // The component handed to the executor does not include the engine (it is not the weights that the Worker reads).
      expect(Object.keys((await catalog.bundleFor(YUE.bundleId)).components)).toEqual(['music']);
      // This platform has no engine package: error / unsupported, with the platform named in the description.
      const arm = new ModelCatalog({ root: dir, platform: 'linux', arch: 'arm64', workerAvailable: () => false });
      const unsupported = await arm.status(YUE.bundleId);
      expect(unsupported).toMatchObject({ state: 'error', reason: 'unsupported' });
      expect(unsupported!.detail).toContain('linux-arm64');
    });

    it('peak takes the pool from the registered estimate: Apple Silicon counts GPU memory, other platforms count memory; null when not a music pack', () => {
      const mac = new ModelCatalog({
        root: dir,
        platform: 'darwin',
        arch: 'arm64',
      });
      expect(mac.musicPeak(YUE.bundleId)).toEqual({
        bytes: 10 * GiB,
        pool: 'gpuMemory',
      });
      expect(mac.musicPeak('qwen3-asr-0.6b@mlx-4bit')).toBeNull();
      const win = new ModelCatalog({
        root: dir,
        platform: 'win32',
        arch: 'x64',
      });
      expect(win.musicPeak(YUE.bundleId)).toEqual({
        bytes: 10 * GiB,
        pool: 'memory',
      });
    });

    it('local provider: not-installed when not installed; only the engine missing is also not-installed (repairing the model pack is enough); usable once the engine is complete; unsupported on a platform without an engine pack', async () => {
      const catalog = (arch: 'arm64' | 'x64' = 'arm64', platform: 'darwin' | 'linux' = 'darwin') =>
        new ModelCatalog({ root: dir, platform, arch, workerAvailable: () => false });
      const music = {} as never;
      const describe = (c: ModelCatalog) =>
        new LocalProviderSource({ catalog: c, transcriber: null, music }).describe('local', 'view');
      const neither = await describe(catalog());
      expect(neither!.capabilities.generateMusic).toMatchObject({
        available: false,
        unavailableReason: 'not-installed',
      });
      expect(neither!.capabilities.generateMusic!.models[0]).toMatchObject({
        modelId: YUE.bundleId,
        available: false,
        unavailableReason: 'not-installed',
      });
      expect(
        neither!.capabilities.generateMusic!.models[0]!.local!.engine,
      ).toEqual({ id: AUDIO_CPP_ENGINE, executable: null });

      await writeRepo(
        dir,
        YUE.components.music!.repo,
        YUE.components.music!.revision,
        {
          [YUE.music!.files.model]: 'gguf',
          [YUE.music!.files.vae]: 'vae',
        },
      );
      const missing = await describe(catalog());
      expect(missing!.capabilities.generateMusic).toMatchObject({
        available: false,
        unavailableReason: 'not-installed',
      });
      expect(missing!.capabilities.generateMusic!.models[0]!.detail).toBeTruthy();

      const exe = await writeEngine(dir, 'audiocpp_cli');
      const present = await describe(catalog());
      expect(present!.capabilities.generateMusic).toMatchObject({ available: true });
      expect(
        present!.capabilities.generateMusic!.models[0]!.local!.engine
          .executable,
      ).toBe(exe);

      const arm = await describe(catalog('arm64', 'linux'));
      expect(arm!.capabilities.generateMusic).toMatchObject({
        available: false,
        unavailableReason: 'unsupported',
      });
    });
  });
});

describe('model description and frozen parameters', () => {
  it('songs and instrumentals, WAV output only, accepts seed, free; limits and arrangement options come from the model pack, hint the duration', () => {
    const info = localMusicModelInfo(YUE, status, true, '/opt/audiocpp_cli');
    expect(info).toMatchObject({
      modelId: YUE.bundleId,
      label: 'YuE2 3B',
      modes: ['song', 'instrumental'],
      maxStyleChars: 2000,
      maxLyricsChars: 4000,
      maxDurationSec: 300,
      defaultDurationSec: 120,
      formats: ['wav'],
      defaultFormat: 'wav',
      acceptsSeed: true,
      cost: 'free-local',
      available: true,
    });
    expect(info.notes).toBeTruthy();
    expect(info.local).toMatchObject({
      family: 'yue2',
      sampleRate: 44_100,
      lyricLanguages: 'unverified',
      slow: true,
    });
    expect(info.local!.steps).toEqual(YUE.music!.steps);
  });

  it('unavailable when the engine is not found, the explanation takes the model pack status; when the model pack has a problem, includes the explanation given by the directory', () => {
    const missing = localMusicModelInfo(YUE, { detail: 'audio.cpp engine 0.9.1 is not installed' } as unknown as ModelBundleStatus, true, null);
    expect(missing.available).toBe(false);
    expect(missing.detail).toContain('audio.cpp');
    expect(localMusicModelInfo(YUE, status, true, null).detail).toBeUndefined();
    const broken = {
      detail: 'checksum mismatch',
    } as unknown as ModelBundleStatus;
    expect(
      localMusicModelInfo(YUE, broken, false, '/opt/audiocpp_cli'),
    ).toMatchObject({ available: false, detail: 'checksum mismatch' });
  });

  it('seed: uses the given one, otherwise draws an integer from 0..2^32-1', () => {
    expect(localMusicSeed(0)).toBe(0);
    expect(localMusicSeed(4_294_967_295)).toBe(4_294_967_295);
    for (let i = 0; i < 20; i++) {
      const seed = localMusicSeed(null);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });

  it('duration to semantic token limit by the model family\'s frame rate, at least 1', () => {
    expect(YUE2_SEMANTIC_TOKENS_PER_SEC).toBe(25);
    expect(semanticMaxTokens(120, YUE.music!)).toBe(3000);
    expect(semanticMaxTokens(0.01, YUE.music!)).toBe(1);
  });

  it('frozen parameters to engine command line: songs with lyrics, instrumentals with empty lyrics; style, arrangement, seed, token limit are request-option; weight path is session-option; output is written to staging', () => {
    const run = musicEngineRunOf(
      {
        capability: 'generateMusic',
        mode: 'song',
        style: 'upbeat pop',
        lyrics: 'la la',
        targetDurationSec: 60,
        maxDurationSec: 90,
        planning: 'full',
        format: 'wav',
        seed: 42,
      },
      YUE.music!,
      { modelDir: '/models/yue2', staging: '/staging', threads: 4 },
    );
    expect(run.output).toBe(path.join('/staging', MUSIC_OUTPUT_FILE));
    expect(run.semanticMaxTokens).toBe(2250);
    const args = run.args;
    const option = (flag: string, prefix: string) =>
      args
        .filter((_, i) => args[i - 1] === flag)
        .find((v) => v.startsWith(prefix));
    expect(args.slice(0, 4)).toEqual(['--task', 'gen', '--family', 'yue2']);
    expect(args[args.indexOf('--model') + 1]).toBe('/models/yue2');
    expect(args[args.indexOf('--threads') + 1]).toBe('4');
    expect(args[args.indexOf('--lyrics') + 1]).toBe('la la');
    expect(option('--request-option', 'style=')).toBe('style=upbeat pop');
    expect(option('--request-option', 'cot=')).toBe('cot=full');
    expect(option('--request-option', 'seed=')).toBe('seed=42');
    expect(option('--request-option', 'semantic_max_tokens=')).toBe(
      'semantic_max_tokens=2250',
    );
    expect(option('--request-option', 'num_inference_steps=')).toBeUndefined();
    // Relative to the model root, not an absolute path: the engine rejects absolute paths
    expect(option('--session-option', 'yue2.model_gguf=')).toBe(`yue2.model_gguf=${YUE.music!.files.model}`);
    expect(option('--session-option', 'yue2.vae_gguf=')).toBe(`yue2.vae_gguf=${YUE.music!.files.vae}`);
    expect(args[args.indexOf('--out-dir') + 1]).toBe('/staging');
    expect(args[args.indexOf('--out') + 1]).toBe(MUSIC_OUTPUT_FILE);
    expect(args).toContain('--log');
    expect(args).not.toContain('--backend');

    const instrumental = musicEngineRunOf(
      { ...musicSelfTestParameters(), lyrics: 'ignored' as never },
      YUE.music!,
      {
        modelDir: '/m',
        staging: '/s',
        threads: 1,
        backend: 'metal',
        steps: MUSIC_SELF_TEST.steps,
      },
    );
    expect(instrumental.args[instrumental.args.indexOf('--lyrics') + 1]).toBe(
      '',
    );
    expect(instrumental.args).toContain(
      `num_inference_steps=${MUSIC_SELF_TEST.steps}`,
    );
    expect(instrumental.args.slice(-2)).toEqual(['--backend', 'metal']);
    expect(instrumental.semanticMaxTokens).toBe(
      MUSIC_SELF_TEST.maxDurationSec * 25,
    );
  });

  it('environment variable names are fixed', () => {
    expect(AUDIO_CPP_CLI_ENV).toBe('CUCCUT_AUDIOCPP_CLI');
  });
});

describe('checks at submission', () => {
  const model = (extra: Partial<MusicModelInfo> = {}): MusicModelInfo => ({
    ...localMusicModelInfo(YUE, status, true, '/opt/audiocpp_cli'),
    ...extra,
  });
  const choice = (
    info: MusicModelInfo = model(),
  ): ModelChoice<'generateMusic'> => ({
    capability: 'generateMusic',
    providerId: 'local',
    modelId: info.modelId,
    kind: 'local',
    label: info.label,
    source: 'user-default',
    model: info,
  });
  const base: GenerateMusicRequest = {
    mode: 'instrumental',
    style: 'calm piano',
  };
  const reject = (request: GenerateMusicRequest, info?: MusicModelInfo) => {
    try {
      musicParameters(choice(info), request, 1);
    } catch (error) {
      expect(error).toBeInstanceOf(RpcError);
      return (error as RpcError).code;
    }
    throw new Error('expected a rejection');
  };

  it('instrumentals without lyrics: duration defaults to the model\'s default, arrangement takes the model default, format wav, seed is frozen by the caller', () => {
    expect(musicParameters(choice(), base, 99)).toEqual({
      capability: 'generateMusic',
      mode: 'instrumental',
      style: 'calm piano',
      lyrics: null,
      targetDurationSec: null,
      maxDurationSec: 120,
      planning: 'melody',
      format: 'wav',
      seed: 99,
    });
  });

  it('songs require lyrics; with a target duration but no limit given, the limit equals the target; steps go into the frozen parameters only when within range', () => {
    const song = musicParameters(
      choice(),
      {
        mode: 'song',
        style: 's',
        lyrics: 'verse',
        targetDurationSec: 45,
        planning: 'off',
        steps: 8,
      },
      3,
    );
    expect(song).toMatchObject({
      mode: 'song',
      lyrics: 'verse',
      targetDurationSec: 45,
      maxDurationSec: 45,
      planning: 'off',
      steps: 8,
    });
    expect(reject({ mode: 'song', style: 's' })).toBe('invalid-request');
    expect(reject({ mode: 'song', style: 's', lyrics: '   ' })).toBe(
      'invalid-request',
    );
    expect(reject({ ...base, lyrics: 'x' })).toBe('invalid-request');
    expect(reject({ ...base, steps: 0 })).toBe('invalid-request');
    expect(reject({ ...base, steps: 7.5 })).toBe('invalid-request');
  });

  it('rejects an empty or overlong style, overlong lyrics, a duration out of range or a target over the limit, an unsupported mode or arrangement, or a wrong format', () => {
    expect(reject({ ...base, style: '  ' })).toBe('invalid-request');
    expect(reject({ ...base, style: 'x'.repeat(2001) })).toBe(
      'invalid-request',
    );
    expect(reject({ mode: 'song', style: 's', lyrics: 'x'.repeat(4001) })).toBe(
      'invalid-request',
    );
    expect(reject({ ...base, maxDurationSec: 301 })).toBe('invalid-request');
    expect(reject({ ...base, maxDurationSec: 0 })).toBe('invalid-request');
    expect(
      reject({ ...base, targetDurationSec: 100, maxDurationSec: 50 }),
    ).toBe('invalid-request');
    expect(
      reject(
        { ...base, planning: 'full' },
        model({
          local: {
            ...model().local!,
            planning: { options: ['off'], default: 'off' },
          },
        }),
      ),
    ).toBe('invalid-request');
    expect(
      reject(
        { mode: 'song', style: 's', lyrics: 'l' },
        model({ modes: ['instrumental'] }),
      ),
    ).toBe('invalid-request');
    expect(reject({ ...base, format: 'mp3' })).toBe('invalid-request');
  });
});

describe('self-check', () => {
  it('fixed input: a few seconds of instrumental, no arrangement, few steps, fixed seed; frozen parameters have the same shape as the real submission', () => {
    expect(MUSIC_SELF_TEST).toMatchObject({
      mode: 'instrumental',
      maxDurationSec: 8,
      seed: 7,
      steps: 4,
    });
    expect(musicSelfTestParameters()).toEqual({
      capability: 'generateMusic',
      mode: 'instrumental',
      style: MUSIC_SELF_TEST.style,
      lyrics: null,
      targetDurationSec: null,
      maxDurationSec: 8,
      planning: 'off',
      format: 'wav',
      seed: 7,
    });
  });

  it('verdict uses the same check as speech synthesis: audible WAV passes and reports duration and sample rate; non-WAV and silence fail', () => {
    const ok = musicSelfTestVerdict(wav({ seconds: 2, rate: 44_100 }));
    expect(ok).toMatchObject({ passed: true, wav: { sampleRate: 44_100 } });
    expect(
      (ok as { wav: { durationSec: number } }).wav.durationSec,
    ).toBeCloseTo(2, 2);
    expect(musicSelfTestVerdict(Buffer.from('not a wav'))).toMatchObject({
      passed: false,
    });
    expect(
      musicSelfTestVerdict(wav({ seconds: 2, sample: () => 0 })),
    ).toMatchObject({ passed: false });
  });
});

/** Writes a synthetic repository into the model directory: a few small files and a matching manifest. */
/** Engine installed by an old version: `<root>/.ccut-tools/audiocpp/<version>/` holds only the executable, with no manifest (it counts as installed). Returns the executable's path. */
async function writeEngine(root: string, executable: string): Promise<string> {
  const dir = path.join(root, '.ccut-tools', AUDIO_CPP_RELEASE.name, AUDIO_CPP_RELEASE.version);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, executable);
  await fs.writeFile(file, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return file;
}

async function writeRepo(
  root: string,
  repo: string,
  revision: string,
  files: Record<string, string>,
): Promise<void> {
  const dir = path.join(root, ...repo.split('/'));
  await fs.mkdir(dir, { recursive: true });
  const entries = [];
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content);
    entries.push({
      path: name,
      size: Buffer.byteLength(content),
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      source_verified: true,
    });
  }
  await fs.writeFile(
    path.join(dir, MANIFEST_FILE),
    JSON.stringify({
      format_version: 1,
      repo,
      revision,
      source: 'https://huggingface.co',
      files: entries,
    }),
  );
}

/** Synthesises a 16-bit mono WAV: `sample(i)` is the sample at index i, in the range -1..1. */
function wav(options: {
  seconds: number;
  rate?: number;
  sample?: (i: number) => number;
}): Buffer {
  const {
    seconds,
    rate = 24_000,
    sample = (i) => Math.sin(i / 10) * 0.25,
  } = options;
  const frames = Math.round(seconds * rate);
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++)
    data.writeInt16LE(Math.round(sample(i) * 32_767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
