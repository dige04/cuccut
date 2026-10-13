import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOSS_LANGUAGES, QWEN3_ASR_LANGUAGES, WHISPER_LANGUAGES, transcribeLanguages } from './asr-languages.ts';
import {
  BUNDLES,
  QWEN3_FORCED_ALIGNER,
  WESPEAKER,
  backendSupported,
  platformBundles,
  requiredSources,
  type BundleDefinition,
} from './bundle-registry.ts';
import { modelFileUrl } from './download-source.ts';
import { LocalProviderSource } from './local-source.ts';
import { MANIFEST_FILE, ModelCatalog } from './model-catalog.ts';
import { scanModelsDir } from './models-dir.ts';
import { REPO_MANIFESTS, repoManifestFor, weightBytes } from './repo-manifests.ts';

/**
 * Registration of local speech-recognition model bundles (Model Worker protocol spec §4.1): the larger-tier Qwen3-ASR, the pre-registered repository manifests, the per-model-family language tables, and optional components. Components shared by several bundles that were added later (the aligner, the speaker model) are optional, so a missing one does not make a bundle incomplete. Two bundles each for Whisper (Core ML and GGML) and the MOSS bundles are registered.
 */

const ASR_REPOS = [
  'aufklarer/Qwen3-ASR-1.7B-MLX-8bit',
  'aufklarer/Qwen3-ForcedAligner-0.6B-4bit',
  'aufklarer/WeSpeaker-ResNet34-LM-MLX',
  'aufklarer/Pyannote-Segmentation-MLX',
  'argmaxinc/whisperkit-coreml',
  'aufklarer/Whisper-Large-v3-Turbo-CoreML',
  'openai/whisper-large-v3',
  'OpenMOSS-Team/MOSS-Transcribe-Diarize',
];

const manifestOf = (repo: string) => REPO_MANIFESTS.find((m) => m.repo === repo)!;
const source = (family: Parameters<typeof transcribeLanguages>[0], repo: string, optional = false) => ({
  family,
  repo,
  revision: manifestOf(repo).revision,
  ...(optional ? { optional: true as const } : {}),
});

/** Whisper shape: the Core ML recognition model, VAD, a tokenizer in a separate repository, and an optional aligner. */
const WHISPER_SHAPED: BundleDefinition = {
  bundleId: 'whisper-large-v3-turbo@coreml',
  capability: 'transcribe',
  backend: 'coreml',
  device: 'ane',
  label: 'Whisper large-v3 turbo',
  components: {
    asr: source('whisper-coreml', 'aufklarer/Whisper-Large-v3-Turbo-CoreML'),
    vad: { family: 'silero-vad', repo: 'aufklarer/Silero-VAD-v6.2.1-MLX', revision: BUNDLES[0]!.components.vad!.revision },
    tokenizer: source('whisper-tokenizer', 'openai/whisper-large-v3'),
    aligner: source('qwen3-forced-aligner', 'aufklarer/Qwen3-ForcedAligner-0.6B-4bit', true),
  },
};

/** MOSS: segments by itself (no VAD), with an optional aligner and speaker model. */
const MOSS = BUNDLES.find((b) => b.bundleId === 'moss-transcribe-diarize@mlx-8bit')!;

describe('本地识别的模型包登记', () => {
  it('两档 Qwen3-ASR：同样的组件形状、同一份许可；默认模型包不变', () => {
    const small = BUNDLES.find((b) => b.bundleId === 'qwen3-asr-0.6b@mlx-4bit')!;
    const large = BUNDLES.find((b) => b.bundleId === 'qwen3-asr-1.7b@mlx-8bit')!;
    expect(large).toMatchObject({ capability: 'transcribe', backend: 'mlx', device: 'metal' });
    expect(large.components.asr).toEqual({
      family: 'qwen3-asr',
      repo: 'aufklarer/Qwen3-ASR-1.7B-MLX-8bit',
      revision: 'e5450a26d1fd417c45fc9c405651ddc3180a27a6',
      weightBits: 8,
      parameters: 2_038_052_480,
    });
    expect(large.components.vad).toEqual(small.components.vad);
    expect(Object.keys(large.components).sort()).toEqual(['aligner', 'asr', 'vad']);
    expect(large.license).toMatchObject({ name: 'Apache-2.0', commercialUse: true });
    expect(small.components.asr!.repo).toBe('aufklarer/Qwen3-ASR-0.6B-MLX-4bit');
    expect(Object.keys(small.components).sort()).toEqual(['aligner', 'asr', 'vad']);
    expect(small.license).toEqual({ ...large.license, url: 'https://huggingface.co/Qwen/Qwen3-ASR-0.6B' });
  });

  it('识别模型包共用可选的对齐器，只有 MOSS 带说话人模型；对齐器与说话人模型各有上游许可', () => {
    const transcribe = BUNDLES.filter((b) => b.capability === 'transcribe');
    // The 5 MLX bundles (including 2 Whisper bundles not listed), the 2 Core ML bundles, plus the 3 candle bundles (same components) and the 2 GGML bundles.
    expect(transcribe).toHaveLength(12);
    for (const def of transcribe) {
      expect(def.components.aligner, def.bundleId).toBe(QWEN3_FORCED_ALIGNER);
      const moss = def.components.asr?.family === 'moss-transcribe-diarize';
      expect(def.components.speaker, def.bundleId).toBe(moss ? WESPEAKER : undefined);
    }
    expect(transcribe.filter((b) => b.backend === 'candle').map((b) => [b.bundleId, b.device, b.label])).toEqual([
      ['qwen3-asr-0.6b@candle', 'cpu', 'Qwen3-ASR 0.6B'],
      ['qwen3-asr-1.7b@candle', 'cpu', 'Qwen3-ASR 1.7B'],
      ['moss-transcribe-diarize@candle', 'cpu', 'MOSS Transcribe'],
    ]);
    for (const def of transcribe.filter((b) => b.components.asr?.family === 'qwen3-asr')) {
      expect(requiredSources(def).map((s) => s.family)).toEqual(['qwen3-asr', 'silero-vad']);
    }
    expect(QWEN3_FORCED_ALIGNER).toMatchObject({
      ...source('qwen3-forced-aligner', 'aufklarer/Qwen3-ForcedAligner-0.6B-4bit', true),
      license: { name: 'Apache-2.0', commercialUse: true },
    });
    expect(WESPEAKER).toMatchObject({
      ...source('wespeaker', 'aufklarer/WeSpeaker-ResNet34-LM-MLX', true),
      license: { name: 'CC-BY-4.0', commercialUse: true },
    });
    // CC-BY-4.0 requires attribution: the license note states the work, its sources (WeSpeaker and pyannote.audio), and the conversion.
    expect(WESPEAKER.license!.summary).toMatch(/WeSpeaker.*pyannote\.audio.*CC-BY-4\.0.*MLX/);
  });

  it('预先登记的仓库清单：每个文件都有 sha256 与大小，总数相符', () => {
    for (const repo of ASR_REPOS) {
      const matching = REPO_MANIFESTS.filter((m) => m.repo === repo);
      expect(matching, repo).toHaveLength(1);
      const manifest = matching[0]!;
      expect(manifest.revision, repo).toMatch(/^[0-9a-f]{40}$/);
      expect(manifest.files.length, repo).toBeGreaterThan(0);
      for (const file of manifest.files) {
        expect(file.sha256, `${repo}/${file.path}`).toMatch(/^[0-9a-f]{64}$/);
        expect(file.size, `${repo}/${file.path}`).toBeGreaterThan(0);
      }
      expect(manifest.estimatedBytes, repo).toBe(manifest.files.reduce((sum, f) => sum + f.size!, 0));
      expect(weightBytes([manifest]), repo).toBe(manifest.estimatedBytes);
    }
    // Core ML models are directories (.mlmodelc): the manifest lists each file in the directory.
    expect(manifestOf('aufklarer/Whisper-Large-v3-Turbo-CoreML').files.some((f) => f.path.includes('.mlmodelc/'))).toBe(true);
    // Every registered bundle's components have a manifest. Release-page components (the audio.cpp engine) register archives per platform and have no repository manifest.
    for (const def of BUNDLES) {
      for (const s of Object.values(def.components)) {
        if (s!.release) continue;
        expect(repoManifestFor(s!.repo, s!.revision), `${def.bundleId} ${s!.repo}`).not.toBeNull();
      }
    }
    expect(weightBytes([{ repo: 'nobody/nothing', revision: 'r' }])).toBeNull();
  });

  it('coreml 与 mlx 一样只在 Apple Silicon 的 macOS 上可用', () => {
    expect(backendSupported('coreml', 'darwin', 'arm64')).toBe(true);
    expect(backendSupported('coreml', 'darwin', 'x64')).toBe(false);
    expect(backendSupported('coreml', 'linux', 'arm64')).toBe(false);
    expect(backendSupported('candle', 'win32', 'x64')).toBe(true);
    expect(backendSupported('ggml', 'win32', 'x64')).toBe(true);
    expect(backendSupported('ggml', 'linux', 'arm64')).toBe(true);
  });

  it('断言的语言按 asr 的模型族把关：每个模型族自己的表', () => {
    expect(QWEN3_ASR_LANGUAGES).toHaveLength(30);
    expect(WHISPER_LANGUAGES).toHaveLength(100);
    expect(MOSS_LANGUAGES).toHaveLength(101);
    expect(transcribeLanguages('qwen3-asr')).toBe(QWEN3_ASR_LANGUAGES);
    expect(transcribeLanguages('whisper-mlx')).toBe(WHISPER_LANGUAGES);
    expect(transcribeLanguages('whisper-coreml')).toBe(WHISPER_LANGUAGES);
    expect(transcribeLanguages('whisper-ggml')).toBe(WHISPER_LANGUAGES);
    expect(transcribeLanguages('moss-transcribe-diarize')).toBe(MOSS_LANGUAGES);
    expect(transcribeLanguages('silero-vad')).toBeNull();
    for (const table of [QWEN3_ASR_LANGUAGES, WHISPER_LANGUAGES, MOSS_LANGUAGES]) expect(new Set(table).size).toBe(table.length);
    expect(WHISPER_LANGUAGES).toContain('yue');
    expect(QWEN3_ASR_LANGUAGES).not.toContain('sw');
  });

  it('Whisper（CoreML）的两个模型包：共用 Silero 与 openai/whisper-large-v3 的分词器，各自的许可；可选的对齐器', () => {
    const large = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3@coreml')!;
    const turbo = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3-turbo@coreml')!;
    for (const def of [large, turbo]) {
      expect(def).toMatchObject({ capability: 'transcribe', backend: 'coreml', device: 'ane' });
      expect(requiredSources(def).map((s) => s.family)).toEqual(['whisper-coreml', 'silero-vad', 'whisper-tokenizer']);
      expect(def.components.vad).toEqual(BUNDLES[0]!.components.vad);
      expect(def.components.tokenizer).toEqual(source('whisper-tokenizer', 'openai/whisper-large-v3'));
      expect(Object.keys(def.components)).toEqual(['asr', 'vad', 'tokenizer', 'aligner']);
    }
    expect(large.components.asr).toEqual({
      ...source('whisper-coreml', 'argmaxinc/whisperkit-coreml'),
      subdir: 'openai_whisper-large-v3_947MB',
    });
    // Files in a subdirectory are all of the built-in manifest's files.
    expect(manifestOf('argmaxinc/whisperkit-coreml').files.every((f) => f.path.startsWith('openai_whisper-large-v3_947MB/'))).toBe(true);
    expect(turbo.components.asr).toEqual(WHISPER_SHAPED.components.asr);
    expect(large.license).toMatchObject({ name: 'Apache-2.0', commercialUse: true });
    expect(turbo.license).toMatchObject({ name: 'MIT', commercialUse: true });
  });

  it('Whisper（MLX）的两个模型包：mlx-community 的 fp16 权重，分词器与 Core ML 的共用；登记了但不列出', () => {
    const large = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3@mlx')!;
    const turbo = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3-turbo@mlx')!;
    const coreml = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3-turbo@coreml')!;
    for (const def of [large, turbo]) {
      expect(def).toMatchObject({ capability: 'transcribe', backend: 'mlx', device: 'metal' });
      expect(requiredSources(def).map((s) => s.family)).toEqual(['whisper-mlx', 'silero-vad', 'whisper-tokenizer']);
      expect(def.components.tokenizer).toEqual(coreml.components.tokenizer);
      expect(Object.keys(def.components)).toEqual(['asr', 'vad', 'tokenizer', 'aligner']);
      expect(def.license!.summary).toContain('mlx-community');
      for (const [platform, arch] of [
        ['darwin', 'arm64'],
        ['linux', 'x64'],
      ] as const) {
        expect(platformBundles(platform, arch).map((b) => b.bundleId)).not.toContain(def.bundleId);
      }
    }
    expect(large.components.asr).toEqual(source('whisper-mlx', 'mlx-community/whisper-large-v3-fp16'));
    expect(turbo.components.asr).toEqual(source('whisper-mlx', 'mlx-community/whisper-large-v3-turbo-fp16'));
    expect(large.label).toBe(BUNDLES.find((b) => b.bundleId === 'whisper-large-v3@coreml')!.label);
    expect(turbo.label).toBe(coreml.label);
    expect(large.license).toMatchObject({ name: 'Apache-2.0', commercialUse: true });
    expect(turbo.license).toMatchObject({ name: 'MIT', commercialUse: true });
    // The MLX Whisper reads generation_config.json from the tokenizer repository (the Core ML one does not).
    expect(manifestOf('openai/whisper-large-v3').files.map((f) => f.path)).toContain('generation_config.json');
  });

  it('Whisper（GGML）的两个模型包：单文件权重、没有分词器，共用 Silero 与可选的对齐器；上游同一仓库，large-v3 登记在兄弟目录', () => {
    const large = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3@ggml')!;
    const turbo = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3-turbo@ggml')!;
    for (const def of [large, turbo]) {
      expect(def).toMatchObject({ capability: 'transcribe', backend: 'ggml', device: 'cpu' });
      expect(requiredSources(def).map((s) => s.family)).toEqual(['whisper-ggml', 'silero-vad']);
      expect(Object.keys(def.components)).toEqual(['asr', 'vad', 'aligner']);
      expect(def.components.vad).toEqual(BUNDLES[0]!.components.vad);
      const manifest = repoManifestFor(def.components.asr!.repo, def.components.asr!.revision)!;
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0]!.path).toMatch(/^ggml-.*\.bin$/);
      expect(manifest.files[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(large.components.asr).toEqual(source('whisper-ggml', 'ggerganov/whisper.cpp-large-v3'));
    expect(turbo.components.asr).toEqual(source('whisper-ggml', 'ggerganov/whisper.cpp'));
    expect(large.components.asr!.revision).toBe(turbo.components.asr!.revision);
    // The two manifests' files do not overlap: installing one does not pull down the other. large-v3's files are still downloaded from the upstream repository.
    const largeManifest = manifestOf('ggerganov/whisper.cpp-large-v3');
    const turboManifest = manifestOf('ggerganov/whisper.cpp');
    expect(largeManifest.files.map((f) => [f.path, f.size])).toEqual([['ggml-large-v3-q5_0.bin', null]]);
    expect(turboManifest.files.map((f) => [f.path, f.size])).toEqual([['ggml-large-v3-turbo-q8_0.bin', null]]);
    expect(largeManifest.sourceRepo).toBe('ggerganov/whisper.cpp');
    expect(turboManifest.sourceRepo).toBeUndefined();
    expect(modelFileUrl('https://huggingface.co', largeManifest.sourceRepo!, largeManifest.revision, 'ggml-large-v3-q5_0.bin')).toBe(
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-q5_0.bin',
    );
    expect([largeManifest.estimatedBytes, turboManifest.estimatedBytes]).toEqual([1031 * 1024 * 1024, 834 * 1024 * 1024]);
    expect(large.license).toMatchObject({ name: 'Apache-2.0', commercialUse: true });
    expect(turbo.license).toMatchObject({ name: 'MIT', commercialUse: true });
    for (const def of [large, turbo]) expect(def.license!.summary).toContain('GGML');
  });

  it('GGML 模型包不在 Apple Silicon 上列出（那里用 Core ML 的），别的平台都列出', () => {
    const ggml = (platform: NodeJS.Platform, arch: string) =>
      platformBundles(platform, arch)
        .filter((b) => b.backend === 'ggml')
        .map((b) => b.bundleId);
    expect(ggml('darwin', 'arm64')).toEqual([]);
    for (const [platform, arch] of [
      ['win32', 'x64'],
      ['linux', 'x64'],
      ['linux', 'arm64'],
      ['darwin', 'x64'],
    ] as const) {
      expect(ggml(platform, arch), `${platform}/${arch}`).toEqual(['whisper-large-v3@ggml', 'whisper-large-v3-turbo@ggml']);
    }
  });

  it('Whisper 形状的定义与 MOSS：必需组件只算没有标可选的', () => {
    expect(requiredSources(WHISPER_SHAPED).map((s) => s.family)).toEqual(['whisper-coreml', 'silero-vad', 'whisper-tokenizer']);
    expect(requiredSources(MOSS).map((s) => s.family)).toEqual(['moss-transcribe-diarize']);
  });

  it('MOSS 的模型包：MLX、没有 VAD，asr 的仓库与内置清单同一修订，上游许可 Apache-2.0', () => {
    expect(MOSS).toMatchObject({ capability: 'transcribe', backend: 'mlx', device: 'metal' });
    expect(Object.keys(MOSS.components)).toEqual(['asr', 'aligner', 'speaker']);
    expect(MOSS.components.asr).toEqual({
      ...source('moss-transcribe-diarize', 'OpenMOSS-Team/MOSS-Transcribe-Diarize'),
      weightBits: 16,
      parameters: 908_513_280,
    });
    expect(MOSS.components.asr!.revision).toBe('e5118b411bf5a77d7a90c4941066bec93c967312');
    expect(MOSS.license).toMatchObject({ name: 'Apache-2.0', commercialUse: true });
  });
});

/** Writes a synthetic repository in the model directory: one small file and a manifest that matches it. */
async function writeRepo(root: string, repo: string, revision: string): Promise<void> {
  const dir = path.join(root, ...repo.split('/'));
  await fs.mkdir(dir, { recursive: true });
  const content = `weights of ${repo}`;
  await fs.writeFile(path.join(dir, 'model.safetensors'), content);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  await fs.writeFile(
    path.join(dir, MANIFEST_FILE),
    JSON.stringify({ format_version: 1, repo, revision, files: [{ path: 'model.safetensors', size: content.length, sha256 }] }),
  );
}

describe('可选组件', () => {
  let root: string;
  const mac = { platform: 'darwin' as const, arch: 'arm64' };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-asr-bundles-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const install = (def: BundleDefinition, which: 'required' | 'all') =>
    Promise.all((which === 'all' ? Object.values(def.components) : requiredSources(def)).map((s) => writeRepo(root, s!.repo, s!.revision)));

  it('缺可选组件时模型包仍算装好，组件状态标出可选；交给 Worker 时略去，装了就带上', async () => {
    const catalog = new ModelCatalog({ root, bundles: [WHISPER_SHAPED, MOSS], ...mac, threads: 2 });
    expect(await catalog.status(MOSS.bundleId)).toMatchObject({ state: 'not-installed' });
    await install(MOSS, 'required');
    const status = (await catalog.status(MOSS.bundleId))!;
    expect(status.state).toBe('installed');
    expect(status.components).toEqual([
      expect.objectContaining({ component: 'asr', state: 'installed' }),
      expect.objectContaining({ component: 'aligner', state: 'missing', optional: true }),
      expect.objectContaining({ component: 'speaker', state: 'missing', optional: true }),
    ]);
    expect(status.components![0]).not.toHaveProperty('optional');
    expect(Object.keys((await catalog.bundleFor(MOSS.bundleId)).components)).toEqual(['asr']);
    // Optional components that are not installed do not count toward the weights the Worker loads.
    expect(await catalog.workerWeightBytes(MOSS.bundleId)).toBe(manifestOf('OpenMOSS-Team/MOSS-Transcribe-Diarize').estimatedBytes);
    expect((await catalog.verify(MOSS.bundleId)).ok).toBe(true);

    // If part of a required component is missing, the bundle is still incomplete. Optional ones do not count toward that.
    await install(WHISPER_SHAPED, 'required');
    await fs.rm(path.join(root, 'openai'), { recursive: true });
    expect(await catalog.status(WHISPER_SHAPED.bundleId)).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect((await catalog.status(WHISPER_SHAPED.bundleId))!.detail).not.toContain('aligner');

    await install(WHISPER_SHAPED, 'all');
    const whisper = await catalog.bundleFor(WHISPER_SHAPED.bundleId);
    expect(whisper.backend).toBe('coreml');
    expect(Object.keys(whisper.components)).toEqual(['asr', 'vad', 'tokenizer', 'aligner']);
    expect(whisper.components.tokenizer).toMatchObject({
      family: 'whisper-tokenizer',
      revision: WHISPER_SHAPED.components.tokenizer!.revision,
    });
    // Once the shared aligner is installed, a MOSS-shaped bundle includes it too.
    expect(Object.keys((await catalog.bundleFor(MOSS.bundleId)).components)).toEqual(['asr', 'aligner']);
    // Weights the Worker loads: the required components plus the installed optional ones (aligner installed, speaker model not installed).
    expect(await catalog.workerWeightBytes(MOSS.bundleId)).toBe(
      ['OpenMOSS-Team/MOSS-Transcribe-Diarize', 'aufklarer/Qwen3-ForcedAligner-0.6B-4bit'].reduce(
        (sum, repo) => sum + manifestOf(repo).estimatedBytes,
        0,
      ),
    );
  });

  it('Qwen3-ASR 没装对齐器照样可用、词时间是估计的；装上对齐器后交给 Worker 并报告原生词时间', async () => {
    const qwen = BUNDLES.find((b) => b.bundleId === 'qwen3-asr-0.6b@mlx-4bit')!;
    const catalog = new ModelCatalog({ root, bundles: [qwen], ...mac, threads: 2 });
    const wordTimestamps = async () => {
      const view = await new LocalProviderSource({ catalog, transcriber: null }).describe('local', 'view');
      return view!.capabilities.transcribe!.models.find((m) => m.modelId === qwen.bundleId)!.wordTimestamps;
    };
    await install(qwen, 'required');
    expect(await catalog.status(qwen.bundleId)).toMatchObject({ state: 'installed' });
    expect(Object.keys((await catalog.bundleFor(qwen.bundleId)).components)).toEqual(['asr', 'vad']);
    expect(await wordTimestamps()).toBe('none');

    await install(qwen, 'all');
    expect(Object.keys((await catalog.bundleFor(qwen.bundleId)).components)).toEqual(['asr', 'vad', 'aligner']);
    expect(await wordTimestamps()).toBe('native');
  });

  it('MOSS 是默认的转写模型；没装时默认退回已装好的识别模型，都没装时仍标 MOSS', async () => {
    const qwen = BUNDLES.find((b) => b.bundleId === 'qwen3-asr-0.6b@mlx-4bit')!;
    const catalog = new ModelCatalog({ root, bundles: [qwen, MOSS], ...mac, threads: 2 });
    const defaults = async () => {
      const view = await new LocalProviderSource({ catalog, transcriber: null }).describe('local', 'view');
      return view!.capabilities.transcribe!.models.filter((m) => m.default).map((m) => m.modelId);
    };
    expect(catalog.defaultTranscribeBundle()).toBe(MOSS.bundleId);
    expect(await defaults()).toEqual([MOSS.bundleId]);
    await install(qwen, 'required');
    expect(await defaults()).toEqual([qwen.bundleId]);
    await install(MOSS, 'required');
    expect(await defaults()).toEqual([MOSS.bundleId]);
  });

  it('扫描模型目录：必需组件齐了就认出模型包', async () => {
    await install(MOSS, 'required');
    const scan = await scanModelsDir(root, [WHISPER_SHAPED, MOSS]);
    expect(scan.bundleIds).toEqual([MOSS.bundleId]);
  });

  it('本机 Provider 报告每个识别模型包按模型族的语言', async () => {
    const registered = BUNDLES.filter((b) => b.capability === 'transcribe');
    const catalog = new ModelCatalog({ root, bundles: registered, ...mac });
    const view = await new LocalProviderSource({ catalog, transcriber: null }).describe('local', 'view');
    const models = view!.capabilities.transcribe!.models;
    const expected = {
      'qwen3-asr': QWEN3_ASR_LANGUAGES,
      'whisper-mlx': WHISPER_LANGUAGES,
      'whisper-coreml': WHISPER_LANGUAGES,
      'whisper-ggml': WHISPER_LANGUAGES,
      'moss-transcribe-diarize': MOSS_LANGUAGES,
    } as const;
    for (const def of registered) {
      const family = def.components.asr!.family as keyof typeof expected;
      expect(models.find((m) => m.modelId === def.bundleId)!.languages, def.bundleId).toEqual([...expected[family]]);
    }
    expect(models.map((m) => m.modelId)).toContain(MOSS.bundleId);
  });

  it('本机 Provider 的识别模型用登记的人看的名字，不带模型包 ID 与后端', async () => {
    const registered = BUNDLES.filter((b) => b.capability === 'transcribe');
    const catalog = new ModelCatalog({ root, bundles: registered, ...mac });
    const view = await new LocalProviderSource({ catalog, transcriber: null }).describe('local', 'view');
    const models = view!.capabilities.transcribe!.models;
    for (const def of registered) {
      const label = models.find((m) => m.modelId === def.bundleId)!.label;
      expect(label, def.bundleId).toBe(def.label);
      expect(label, def.bundleId).not.toContain('@');
    }
  });

  it('每个模型包都有名字；同一个模型换后端（MLX / candle、Core ML / GGML）名字相同；同一平台同一能力里名字不重复', () => {
    for (const def of BUNDLES) expect(def.label.trim(), def.bundleId).not.toBe('');
    const byModel = new Map<string, Set<string>>();
    for (const def of BUNDLES) {
      const model = def.bundleId.split('@')[0]!;
      byModel.set(model, (byModel.get(model) ?? new Set()).add(def.label));
    }
    for (const [model, labels] of byModel) expect([...labels], model).toHaveLength(1);

    const label = (id: string) => BUNDLES.find((b) => b.bundleId === id)!.label;
    expect(label('whisper-large-v3@coreml')).toBe('Whisper large-v3');
    expect(label('whisper-large-v3@ggml')).toBe('Whisper large-v3');
    expect(label('whisper-large-v3-turbo@coreml')).toBe('Whisper large-v3 turbo');
    expect(label('whisper-large-v3-turbo@ggml')).toBe('Whisper large-v3 turbo');

    for (const [platform, arch] of [
      ['darwin', 'arm64'],
      ['linux', 'x64'],
    ] as const) {
      const seen = new Set<string>();
      for (const def of platformBundles(platform, arch)) {
        const key = `${def.capability}:${def.label}`;
        expect(seen.has(key), `${platform}/${arch} ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('MOSS 不收识别提示；只对齐长行，装了对齐器也不算原生词时间', async () => {
    const catalog = new ModelCatalog({ root, bundles: [MOSS], ...mac, threads: 2 });
    const describe = async () => {
      const view = await new LocalProviderSource({ catalog, transcriber: null }).describe('local', 'view');
      return view!.capabilities.transcribe!.models.find((m) => m.modelId === MOSS.bundleId)!;
    };
    await install(MOSS, 'all');
    expect(Object.keys((await catalog.bundleFor(MOSS.bundleId)).components)).toEqual(['asr', 'aligner', 'speaker']);
    expect(await describe()).toMatchObject({ available: true, acceptsHint: false, wordTimestamps: 'none', cost: 'free-local' });
  });

  it('Whisper 的 large-v3 在仓库子目录里：交给 Worker 的是子目录与其下的文件；叠放在仓库根的分词器文件不影响装好', async () => {
    const large = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3@coreml')!;
    const catalog = new ModelCatalog({ root, bundles: [large], ...mac, threads: 2 });
    // Old layout: the subdirectory holds the CoreML model, and the tokenizer files are stacked at the repository root. The manifest lists both.
    const repo = large.components.asr!;
    const dir = path.join(root, ...repo.repo.split('/'));
    const files = [`${repo.subdir}/MelSpectrogram.mlmodelc/model.mil`, `${repo.subdir}/generation_config.json`, 'tokenizer.json'];
    for (const file of files) {
      await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await fs.writeFile(path.join(dir, file), file);
    }
    await fs.writeFile(
      path.join(dir, MANIFEST_FILE),
      JSON.stringify({
        format_version: 1,
        repo: repo.repo,
        revision: repo.revision,
        files: files.map((file) => ({ path: file, size: file.length, sha256: crypto.createHash('sha256').update(file).digest('hex') })),
      }),
    );
    for (const s of [large.components.vad!, large.components.tokenizer!]) await writeRepo(root, s.repo, s.revision);
    expect((await catalog.status(large.bundleId))!.state).toBe('installed');
    const bundle = await catalog.bundleFor(large.bundleId);
    expect(bundle.components.asr!.dir).toBe(path.join(dir, repo.subdir!));
    expect(bundle.components.asr!.files.map((f) => f.path)).toEqual(['MelSpectrogram.mlmodelc/model.mil', 'generation_config.json']);
    expect(bundle.components.tokenizer!.dir).toBe(path.join(root, 'openai', 'whisper-large-v3'));
    expect((await catalog.verify(large.bundleId)).ok).toBe(true);
  });
});
