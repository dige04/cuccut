import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUNDLES,
  platformBundles,
  QWEN3_ASR_0_6B_BUNDLE,
  QWEN3_FORCED_ALIGNER,
  SPEAKER_DIARIZATION_BUNDLE,
  WESPEAKER,
} from './bundle-registry.ts';
import { LocalProviderSource } from './local-source.ts';
import { MANIFEST_FILE, ModelCatalog, resolveModelsDir, resolveModelsRoot } from './model-catalog.ts';
import { weightBytes } from './repo-manifests.ts';

/** Write a synthetic repository into the model directory: a few small files and a matching manifest. */
async function writeRepo(root: string, repo: string, revision: string, files: Record<string, string>): Promise<string> {
  const dir = path.join(root, ...repo.split('/'));
  await fs.mkdir(dir, { recursive: true });
  const entries = [];
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
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
    JSON.stringify({ format_version: 1, repo, revision, source: 'https://huggingface.co', files: entries }),
  );
  return dir;
}

const def = BUNDLES.find((b) => b.bundleId === QWEN3_ASR_0_6B_BUNDLE)!;
const asr = def.components.asr!;
const vad = def.components.vad!;

describe('ModelCatalog', () => {
  let root: string;
  const mac = { platform: 'darwin' as const, arch: 'arm64' };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-models-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function installBoth() {
    await writeRepo(root, asr.repo, asr.revision, { 'config.json': '{"a":1}', 'model.safetensors': 'weights-asr', 'sub/vocab.json': '{}' });
    await writeRepo(root, vad.repo, vad.revision, { 'config.json': '{}', 'model.safetensors': 'weights-vad' });
  }

  it('model catalogue root: CUCCUT_MODELS_DIR overrides the default <home>/models', () => {
    expect(resolveModelsRoot('/h', {})).toBe(path.join('/h', 'models'));
    expect(resolveModelsRoot('/h', { CUCCUT_MODELS_DIR: '/m' })).toBe(path.resolve('/m'));
    // Set `models.dir` after the environment variable but before the default. Setting it to the default location is the same as not setting it.
    expect(resolveModelsDir('/h', {}, '/s')).toEqual({
      path: path.resolve('/s'),
      source: 'setting',
      defaultPath: path.join('/h', 'models'),
    });
    expect(resolveModelsDir('/h', { CUCCUT_MODELS_DIR: '/m' }, '/s')).toMatchObject({ path: path.resolve('/m'), source: 'env' });
    expect(resolveModelsDir('/h', {}, path.join('/h', 'models'))).toMatchObject({ source: 'default' });
  });

  it('after changing the catalogue root it is recomputed from the new directory; bundles are unavailable while it is being moved', async () => {
    const catalog = new ModelCatalog({ root, ...mac });
    await installBoth();
    expect((await catalog.status(QWEN3_ASR_0_6B_BUNDLE))?.state).toBe('installed');
    const changed: string[] = [];
    catalog.onChange((id) => changed.push(id));
    catalog.setRelocating(true);
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'error', reason: 'relocating' });
    catalog.setRelocating(false);
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-catalog-empty-'));
    try {
      catalog.setRoot(empty);
      expect(catalog.root).toBe(empty);
      expect(changed).toContain(QWEN3_ASR_0_6B_BUNDLE);
      expect((await catalog.status(QWEN3_ASR_0_6B_BUNDLE))?.state).toBe('not-installed');
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });

  it('missing manifest, missing file, size mismatch, or version mismatch are all not-installed; only some components missing is incomplete; complete is installed', async () => {
    const catalog = new ModelCatalog({ root, ...mac });
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({
      state: 'not-installed',
      reason: 'missing-manifest',
      capability: 'transcribe',
      backend: 'mlx',
      device: 'metal',
      // The description carries a reference: the UI and CLI regenerate it in the reader's language.
      detailRef: { key: 'modelsModelCatalog.noManifest', params: { repo: expect.any(String) } },
    });
    await installBoth();
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toEqual({
      bundleId: QWEN3_ASR_0_6B_BUNDLE,
      capability: 'transcribe',
      backend: 'mlx',
      device: 'metal',
      label: 'Qwen3-ASR 0.6B',
      state: 'installed',
      // The download size of required components, estimated from the manifest shipped with the app (does not look at locally installed files).
      estimatedBytes: 714_289_971,
      license: expect.objectContaining({ name: 'Apache-2.0', commercialUse: true }),
      components: [
        // Each component also carries a download size estimated from the manifest (even when installed). The UI uses it to say how much to download when components are missing.
        {
          component: 'asr',
          repo: asr.repo,
          revision: asr.revision,
          state: 'installed',
          bytes: 20,
          estimatedBytes: 713_031_680,
          sharedWith: [],
        },
        // The larger Qwen3-ASR tier uses the same VAD.
        {
          component: 'vad',
          repo: vad.repo,
          revision: vad.revision,
          state: 'installed',
          bytes: 13,
          estimatedBytes: 1_258_291,
          sharedWith: ['qwen3-asr-1.7b@mlx-8bit', 'whisper-large-v3@coreml', 'whisper-large-v3-turbo@coreml'],
        },
        // The optional aligner is not installed: the model pack still counts as installed.
        {
          component: 'aligner',
          repo: QWEN3_FORCED_ALIGNER.repo,
          revision: QWEN3_FORCED_ALIGNER.revision,
          state: 'missing',
          bytes: null,
          estimatedBytes: 983_141_596,
          sharedWith: [
            'qwen3-asr-1.7b@mlx-8bit',
            'whisper-large-v3@coreml',
            'whisper-large-v3-turbo@coreml',
            'moss-transcribe-diarize@mlx-8bit',
          ],
          optional: true,
          // Each component's own license is carried along with its status.
          license: QWEN3_FORCED_ALIGNER.license,
        },
      ],
    });
    expect((await catalog.list()).map((b) => b.bundleId)).toEqual(platformBundles('darwin', 'arm64').map((b) => b.bundleId));

    // ASR good, VAD bad: some components are missing. Report incomplete and name the missing components and reasons, rather than treating the whole pack as not installed.
    const weights = path.join(catalog.repoDir(vad.repo), 'model.safetensors');
    await fs.writeFile(weights, 'weights-vad-longer');
    let status = await catalog.status(QWEN3_ASR_0_6B_BUNDLE);
    expect(status).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect(status!.detail).toContain('大小不符');
    expect(status!.components!.map((c) => c.state)).toEqual(['installed', 'missing', 'missing']);
    await fs.rm(weights);
    status = await catalog.status(QWEN3_ASR_0_6B_BUNDLE);
    expect(status).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect(status!.detail).toContain('缺少 model.safetensors');

    await writeRepo(root, vad.repo, 'other-revision', { 'model.safetensors': 'x' });
    expect((await catalog.status(QWEN3_ASR_0_6B_BUNDLE))!.detail).toContain('版本不是');
    // Both components missing: report the specific reason of the first component.
    await fs.rm(path.join(catalog.repoDir(asr.repo), 'config.json'));
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'not-installed', reason: 'missing-file' });
    expect(await catalog.status('nope')).toBeNull();
  });

  it('components carry their own registered license: MOSS\'s speaker model is CC-BY-4.0 with attribution; components without a registered license carry none', async () => {
    const catalog = new ModelCatalog({ root, ...mac });
    const moss = await catalog.status('moss-transcribe-diarize@mlx-8bit');
    const speaker = moss!.components!.find((c) => c.component === 'speaker')!;
    expect(speaker.license).toEqual(WESPEAKER.license);
    expect(speaker.license).toMatchObject({ name: 'CC-BY-4.0', commercialUse: true });
    expect(speaker.license!.summary).toMatch(/署名：.*WeSpeaker.*pyannote\.audio/);
    expect(moss!.components!.find((c) => c.component === 'asr')).not.toHaveProperty('license');
    const qwen = await catalog.status(QWEN3_ASR_0_6B_BUNDLE);
    expect(qwen!.components!.find((c) => c.component === 'vad')).not.toHaveProperty('license');
  });

  it('weights the Worker loads: recognition sums the manifest; separation weights are stored at 16 bits and computed at 32, counted at twice the file size; synthesis is not estimated', async () => {
    const catalog = new ModelCatalog({ root, ...mac });
    const separate = BUNDLES.find((b) => b.bundleId === 'htdemucs-ft@mlx')!;
    const file = weightBytes([separate.components.separator!]);
    expect(file).toBeGreaterThan(300_000_000);
    expect(await catalog.workerWeightBytes(separate.bundleId)).toBe(file! * 2);
    expect(await catalog.workerWeightBytes(QWEN3_ASR_0_6B_BUNDLE)).toBe(weightBytes([asr, vad]));
    const speech = BUNDLES.find((b) => b.capability === 'synthesize')!;
    expect(await catalog.workerWeightBytes(speech.bundleId)).toBeNull();
  });

  it('separation bundles by platform: Apple Silicon lists the MLX one, other platforms list the candle one (same repository), each the default for vocal separation; the candle resident amount is twice the file size, and the pool follows the device', async () => {
    const silicon = new ModelCatalog({ root, ...mac });
    const siliconSeparate = silicon.definitions().filter((d) => d.capability === 'separate');
    expect(siliconSeparate.map((d) => d.bundleId)).toEqual(['htdemucs-ft@mlx']);
    const siliconView = await new LocalProviderSource({ catalog: silicon, transcriber: null }).describe('local', 'view');
    expect(siliconView!.capabilities.separateAudio!.models).toMatchObject([{ modelId: 'htdemucs-ft@mlx', default: true }]);
    for (const [platform, arch] of [
      ['win32', 'x64'],
      ['linux', 'x64'],
      ['linux', 'arm64'],
      ['darwin', 'x64'],
    ] as const) {
      const other = new ModelCatalog({ root, platform, arch });
      const separate = other.definitions().filter((d) => d.capability === 'separate');
      expect(
        separate.map((d) => d.bundleId),
        `${platform}/${arch}`,
      ).toEqual(['htdemucs-ft@candle']);
      expect(separate[0]).toMatchObject({ backend: 'candle', device: 'cpu', components: siliconSeparate[0]!.components });
      expect(await other.status('htdemucs-ft@mlx'), `${platform}/${arch}`).toBeNull();
      const view = await new LocalProviderSource({ catalog: other, transcriber: null }).describe('local', 'view');
      expect(view!.capabilities.separateAudio!.models, `${platform}/${arch}`).toMatchObject([
        { modelId: 'htdemucs-ft@candle', default: true },
      ]);
    }
    // candle's separation is upcast to f32 on both CPU and CUDA: resident memory is twice the file size. CPU counts toward memory, CUDA counts toward GPU memory.
    const linux = new ModelCatalog({ root, platform: 'linux', arch: 'x64' });
    const bytes = (await linux.workerWeightBytes('htdemucs-ft@candle'))!;
    expect(bytes).toBe(await silicon.workerWeightBytes('htdemucs-ft@mlx'));
    expect(await linux.workerFootprint('htdemucs-ft@candle')).toEqual({ bytes, pool: 'memory' });
    linux.setWorkerDevice('candle', 'cuda');
    expect(await linux.workerFootprint('htdemucs-ft@candle')).toEqual({ bytes, pool: 'gpuMemory' });
  });

  it('mlx is available only on darwin/arm64; other platforms do not list it, and one registered directly is error / unsupported', async () => {
    await installBoth();
    const linux = new ModelCatalog({ root, platform: 'linux', arch: 'x64' });
    expect(await linux.status(QWEN3_ASR_0_6B_BUNDLE)).toBeNull();
    for (const platform of ['linux', 'darwin'] as const) {
      const forced = new ModelCatalog({ root, platform, arch: 'x64', bundles: [def] });
      expect(await forced.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'error', reason: 'unsupported' });
    }
  });

  it('listed by platform: Apple Silicon lists only MLX and Core ML, other platforms only candle and GGML, and audio.cpp everywhere; names and repositories are the same, and the default bundle follows the platform', async () => {
    const ids = (catalog: ModelCatalog) => catalog.definitions().map((d) => d.bundleId);
    const silicon = new ModelCatalog({ root, ...mac });
    expect(silicon.definitions().every((d) => d.backend === 'mlx' || d.backend === 'coreml' || d.backend === 'audio-cpp')).toBe(true);
    expect(ids(silicon)).toEqual(
      expect.arrayContaining([
        'qwen3-asr-0.6b@mlx-4bit',
        'qwen3-asr-1.7b@mlx-8bit',
        'moss-transcribe-diarize@mlx-8bit',
        'whisper-large-v3@coreml',
        'speaker-diarization@mlx',
        'yue2-3b@audio-cpp-q8',
      ]),
    );
    expect(silicon.defaultTranscribeBundle()).toBe('moss-transcribe-diarize@mlx-8bit');

    for (const [platform, arch] of [
      ['linux', 'x64'],
      ['win32', 'x64'],
      ['linux', 'arm64'],
      ['darwin', 'x64'],
    ] as const) {
      const catalog = new ModelCatalog({ root, platform, arch });
      expect(ids(catalog), `${platform}/${arch}`).toEqual([
        'qwen3-asr-0.6b@candle',
        'qwen3-asr-1.7b@candle',
        'moss-transcribe-diarize@candle',
        'speaker-diarization@candle',
        'whisper-large-v3@ggml',
        'whisper-large-v3-turbo@ggml',
        'qwen3-tts-0.6b-base@candle',
        'qwen3-tts-0.6b-customvoice@candle',
        'qwen3-tts-1.7b-base@candle',
        'qwen3-tts-1.7b-customvoice@candle',
        'qwen3-tts-1.7b-voicedesign@candle',
        'indextts2@candle',
        'index-tts2.5@candle',
        'gpt-sovits-v2@candle',
        'voxcpm2@candle',
        'omnivoice@candle',
        'qwen-image-2.1@candle',
        'yue2-3b@audio-cpp-q8',
        'htdemucs-ft@candle',
      ]);
      expect(catalog.defaultTranscribeBundle()).toBe('moss-transcribe-diarize@candle');
    }

    const linux = new ModelCatalog({ root, platform: 'linux', arch: 'x64' });
    for (const candle of linux.definitions().filter((d) => d.backend === 'candle')) {
      const twin = silicon.definitions().find((d) => d.label === candle.label)!;
      expect(twin, candle.bundleId).toBeDefined();
      expect(candle.components).toEqual(twin.components);
      expect(candle).toMatchObject({ backend: 'candle', device: 'cpu', capability: twin.capability });
    }
    expect(linux.definitions().map((d) => d.label)).toEqual([
      'Qwen3-ASR 0.6B',
      'Qwen3-ASR 1.7B',
      'MOSS Transcribe',
      '说话人区分',
      'Whisper large-v3',
      'Whisper large-v3 turbo',
      'Qwen3-TTS 0.6B Base',
      'Qwen3-TTS 0.6B CustomVoice',
      'Qwen3-TTS 1.7B Base',
      'Qwen3-TTS 1.7B CustomVoice',
      'Qwen3-TTS 1.7B VoiceDesign',
      'IndexTTS2',
      'IndexTTS 2.5',
      'GPT-SoVITS v2',
      'VoxCPM2',
      'OmniVoice',
      'Qwen-Image-2.1',
      'YuE2 3B',
      'HTDemucs-FT',
    ]);
    expect(silicon.definitions().some((d) => d.backend === 'ggml')).toBe(false);
  });

  it('GGML bundles: the device is what the Worker reports in its handshake (CUDA, Vulkan or CPU); the resident amount is the stored bytes of the Whisper weights plus candle\'s VAD and aligner', async () => {
    const turbo = BUNDLES.find((b) => b.bundleId === 'whisper-large-v3-turbo@ggml')!;
    const whisper = turbo.components.asr!;
    await writeRepo(root, whisper.repo, whisper.revision, { 'ggml-large-v3-turbo-q8_0.bin': 'ggml-weights' });
    await writeRepo(root, vad.repo, vad.revision, { 'config.json': '{}', 'model.safetensors': 'weights-vad' });
    const windows = new ModelCatalog({ root, platform: 'win32', arch: 'x64', threads: 2 });
    expect(await windows.status(turbo.bundleId)).toMatchObject({ state: 'installed', backend: 'ggml', device: 'cpu' });
    // The optional aligner is not installed: Whisper's weight bytes (the built-in manifest size is unknown, so the estimated 834 MiB), plus VAD's f32 resident size on candle CPU, counted toward memory.
    const memory = { bytes: 834 * 1024 * 1024 + vad.parameters! * 4, pool: 'memory' };
    expect(await windows.workerFootprint(turbo.bundleId)).toEqual(memory);
    windows.setWorkerDevice('ggml', 'vulkan');
    expect(await windows.status(turbo.bundleId)).toMatchObject({ device: 'vulkan' });
    expect(await windows.bundleFor(turbo.bundleId)).toMatchObject({ backend: 'ggml', device: 'vulkan' });
    expect(await windows.workerFootprint(turbo.bundleId)).toEqual({ ...memory, pool: 'gpuMemory' });
    // A CUDA install's Worker reporting `cuda`: also counted toward GPU memory.
    windows.setWorkerDevice('ggml', 'cuda');
    expect(await windows.status(turbo.bundleId)).toMatchObject({ device: 'cuda' });
    expect(await windows.bundleFor(turbo.bundleId)).toMatchObject({ backend: 'ggml', device: 'cuda' });
    expect(await windows.workerFootprint(turbo.bundleId)).toEqual({ ...memory, pool: 'gpuMemory' });
    // candle's device and GGML's are tracked separately.
    expect(await windows.status('qwen3-asr-0.6b@candle')).toMatchObject({ device: 'cpu' });
    windows.setWorkerDevice('ggml', null);
    expect(await windows.status(turbo.bundleId)).toMatchObject({ device: 'cpu' });
  });

  it('candle bundles: usable once installed; the device is what the Worker reports in its handshake (CUDA or CPU), and it is also used when handed to the Worker', async () => {
    await installBoth();
    const linux = new ModelCatalog({ root, platform: 'linux', arch: 'x64', threads: 2 });
    expect(await linux.status('qwen3-asr-0.6b@candle')).toMatchObject({ state: 'installed', backend: 'candle', device: 'cpu' });
    expect(await linux.bundleFor('qwen3-asr-0.6b@candle')).toMatchObject({ backend: 'candle', device: 'cpu' });
    const changed: string[] = [];
    linux.onChange((id) => changed.push(id));
    linux.setWorkerDevice('candle', 'cuda');
    expect(changed.sort()).toEqual(
      [
        'htdemucs-ft@candle',
        'moss-transcribe-diarize@candle',
        'qwen-image-2.1@candle',
        'qwen3-asr-0.6b@candle',
        'qwen3-asr-1.7b@candle',
        'qwen3-tts-0.6b-base@candle',
        'qwen3-tts-0.6b-customvoice@candle',
        'qwen3-tts-1.7b-base@candle',
        'qwen3-tts-1.7b-customvoice@candle',
        'qwen3-tts-1.7b-voicedesign@candle',
        'indextts2@candle',
        'index-tts2.5@candle',
        'gpt-sovits-v2@candle',
        'voxcpm2@candle',
        'omnivoice@candle',
        'speaker-diarization@candle',
      ].sort(),
    );
    expect(await linux.status('qwen3-asr-0.6b@candle')).toMatchObject({ device: 'cuda' });
    expect(await linux.bundleFor('qwen3-asr-0.6b@candle')).toMatchObject({ device: 'cuda' });
    expect(await linux.bundleFor('qwen3-asr-0.6b@candle', { device: 'cpu' })).toMatchObject({ device: 'cpu' });
    linux.setWorkerDevice('candle', null);
    expect(await linux.status('qwen3-asr-0.6b@candle')).toMatchObject({ device: 'cpu' });
    // MLX's device is registered and does not change with the handshake.
    const silicon = new ModelCatalog({ root, ...mac });
    silicon.setWorkerDevice('mlx', 'cpu');
    expect(await silicon.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ device: 'metal' });
  });

  it('bundleFor gives the absolute directory and manifest files per protocol spec §4', async () => {
    await installBoth();
    const catalog = new ModelCatalog({ root, ...mac, threads: 3 });
    const bundle = await catalog.bundleFor(QWEN3_ASR_0_6B_BUNDLE);
    expect(bundle).toEqual({
      bundleId: QWEN3_ASR_0_6B_BUNDLE,
      backend: 'mlx',
      device: 'metal',
      threads: 3,
      memoryBudgetBytes: null,
      components: {
        asr: {
          family: 'qwen3-asr',
          revision: asr.revision,
          dir: path.join(root, 'aufklarer', 'Qwen3-ASR-0.6B-MLX-4bit'),
          files: [
            { path: 'config.json', sha256: expect.stringMatching(/^[0-9a-f]{64}$/), byteLength: 7 },
            { path: 'model.safetensors', sha256: expect.any(String), byteLength: 11 },
            { path: 'sub/vocab.json', sha256: expect.any(String), byteLength: 2 },
          ],
        },
        vad: {
          family: 'silero-vad',
          revision: vad.revision,
          dir: path.join(root, 'aufklarer', 'Silero-VAD-v6.2.1-MLX'),
          files: [
            { path: 'config.json', sha256: expect.any(String), byteLength: 2 },
            { path: 'model.safetensors', sha256: expect.any(String), byteLength: 11 },
          ],
        },
      },
    });
    expect(path.isAbsolute(bundle.components.asr!.dir)).toBe(true);
  });

  it('speaker diarization bundle: once installed, the recognition bundle it pairs with carries its components, and its weights count toward the resident amount; MOSS diarizes on its own, so it is not carried when not installed', async () => {
    await installBoth();
    const catalog = new ModelCatalog({ root, ...mac });
    const pack = catalog.definition(SPEAKER_DIARIZATION_BUNDLE)!;
    expect(pack).toMatchObject({ capability: 'diarize', label: '说话人区分' });
    expect(catalog.definition(QWEN3_ASR_0_6B_BUNDLE)!.diarization).toBe(SPEAKER_DIARIZATION_BUNDLE);
    expect(catalog.diarizationUsers(SPEAKER_DIARIZATION_BUNDLE)).toEqual(
      expect.arrayContaining([
        QWEN3_ASR_0_6B_BUNDLE,
        'qwen3-asr-1.7b@mlx-8bit',
        'whisper-large-v3@coreml',
        'whisper-large-v3-turbo@coreml',
      ]),
    );
    expect(catalog.diarizationUsers(SPEAKER_DIARIZATION_BUNDLE)).not.toContain('moss-transcribe-diarize@mlx-8bit');
    const local = async () =>
      (await new LocalProviderSource({ catalog, transcriber: null }).describe('local', 'view'))!.capabilities.transcribe!.models;

    // Not installed: the recognition model pack does not include the speaker component.
    const before = await catalog.workerWeightBytes(QWEN3_ASR_0_6B_BUNDLE);
    expect(Object.keys((await catalog.bundleFor(QWEN3_ASR_0_6B_BUNDLE)).components).sort()).toEqual(['asr', 'vad']);
    expect(await catalog.speakers(QWEN3_ASR_0_6B_BUNDLE)).toBe('none');
    expect(await catalog.speakers('moss-transcribe-diarize@mlx-8bit')).toBe('native');
    // Even when not installed, name which model pack is needed (the UI uses this to offer “下载”, download). MOSS distinguishes speakers itself, so nothing is given.
    expect(await local()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ modelId: QWEN3_ASR_0_6B_BUNDLE, speakers: 'none', diarizationPack: SPEAKER_DIARIZATION_BUNDLE }),
      ]),
    );
    expect((await local()).find((m) => m.modelId === 'moss-transcribe-diarize@mlx-8bit')).not.toHaveProperty('diarizationPack');
    expect((await local()).some((m) => m.modelId === SPEAKER_DIARIZATION_BUNDLE)).toBe(false);

    // Only half installed (WeSpeaker missing): still not included.
    const segmentation = pack.components.segmentation!;
    const speaker = pack.components.speaker!;
    expect(speaker.optional).toBeFalsy();
    await writeRepo(root, segmentation.repo, segmentation.revision, { 'config.json': '{}', 'model.safetensors': 'weights-seg' });
    expect(await catalog.speakers(QWEN3_ASR_0_6B_BUNDLE)).toBe('none');
    await writeRepo(root, speaker.repo, speaker.revision, { 'config.json': '{}', 'model.safetensors': 'weights-spk' });

    expect((await catalog.status(SPEAKER_DIARIZATION_BUNDLE))?.state).toBe('installed');
    expect(await catalog.speakers(QWEN3_ASR_0_6B_BUNDLE)).toBe('pack');
    const bundle = await catalog.bundleFor(QWEN3_ASR_0_6B_BUNDLE);
    expect(bundle.components.segmentation).toMatchObject({ family: 'pyannote-segmentation', revision: segmentation.revision });
    expect(bundle.components.speaker).toMatchObject({ family: 'wespeaker', revision: speaker.revision });
    expect(await catalog.workerWeightBytes(QWEN3_ASR_0_6B_BUNDLE)).toBeGreaterThan(before!);
    expect(await local()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ modelId: QWEN3_ASR_0_6B_BUNDLE, speakers: 'pack', diarizationPack: SPEAKER_DIARIZATION_BUNDLE }),
      ]),
    );
  });

  it('a manifest path that leaves the directory is treated as no manifest', async () => {
    await installBoth();
    const manifestFile = path.join(root, ...vad.repo.split('/'), MANIFEST_FILE);
    const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    manifest.files[0].path = '../escape.json';
    await fs.writeFile(manifestFile, JSON.stringify(manifest));
    const catalog = new ModelCatalog({ root, ...mac });
    const status = await catalog.status(QWEN3_ASR_0_6B_BUNDLE);
    expect(status).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect(status!.detail).toContain('没有清单');
  });

  it('verify explicitly checks sha256 and caches the result; enable clears it', async () => {
    await installBoth();
    const catalog = new ModelCatalog({ root, ...mac });
    expect((await catalog.verify(QWEN3_ASR_0_6B_BUNDLE)).ok).toBe(true);
    // Same size, different content: only verify can detect this.
    await fs.writeFile(path.join(catalog.repoDir(asr.repo), 'model.safetensors'), 'weights-ASR');
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'installed' });
    const result = await catalog.verify(QWEN3_ASR_0_6B_BUNDLE);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([{ repo: asr.repo, path: 'model.safetensors', problem: 'hash-mismatch' }]);
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'not-installed', reason: 'hash-mismatch' });
    catalog.enable(QWEN3_ASR_0_6B_BUNDLE);
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'installed' });
  });

  it('runtime status, disabled state and no Worker are layered on top of the disk state', async () => {
    await installBoth();
    let worker = true;
    const catalog = new ModelCatalog({ root, ...mac, workerAvailable: () => worker });
    catalog.setRuntimeState(QWEN3_ASR_0_6B_BUNDLE, 'busy');
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'busy' });
    catalog.setRuntimeState(QWEN3_ASR_0_6B_BUNDLE, null);
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'installed' });
    catalog.block(QWEN3_ASR_0_6B_BUNDLE, 'error', 'resource', '反复崩溃');
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'error', reason: 'resource', detail: '反复崩溃' });
    catalog.enable(QWEN3_ASR_0_6B_BUNDLE);
    worker = false;
    expect(await catalog.status(QWEN3_ASR_0_6B_BUNDLE)).toMatchObject({ state: 'error', reason: 'worker-missing' });
  });

  const realRoot = '/Users/jim/Library/Application Support/CucCut/models';
  // The real directory is read only when explicitly asked (CUCCUT_REAL_MODELS_TEST=1). Ordinary tests do not touch the user's data directory.
  const realAvailable =
    process.env.CUCCUT_REAL_MODELS_TEST === '1' &&
    process.platform === 'darwin' &&
    process.arch === 'arm64' &&
    fsSync.existsSync(path.join(realRoot, ...asr.repo.split('/'), MANIFEST_FILE));

  it.skipIf(!realAvailable)('reads the real model directory on this machine (checks sizes only, no hashing)', async () => {
    const catalog = new ModelCatalog({ root: realRoot });
    const status = await catalog.status(QWEN3_ASR_0_6B_BUNDLE);
    expect(status?.state).toBe('installed');
    const bundle = await catalog.bundleFor(QWEN3_ASR_0_6B_BUNDLE);
    expect(bundle.components.asr!.files.length).toBeGreaterThan(0);
    expect(bundle.components.vad!.files.map((f) => f.path)).toContain('model.safetensors');
  });
});

/** The second component of the music model pack, the audio.cpp engine (architecture design §6.3): the archive is chosen by host platform, placed in the tools directory, and can be replaced with `engineOverride`. */
describe('ModelCatalog audio.cpp engine component', () => {
  const YUE = 'yue2-3b@audio-cpp-q8';
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-engine-catalog-'));
    const def = BUNDLES.find((b) => b.bundleId === YUE)!;
    await writeRepo(root, def.components.music!.repo, def.components.music!.revision, { 'model.gguf': 'gguf' });
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('platforms without an engine bundle: still listed, with status error / unsupported and a message that names the platform; the platform key can be set by the test', async () => {
    const arm = new ModelCatalog({ root, platform: 'linux', arch: 'arm64' });
    expect(arm.platformKey).toBe('linux-arm64');
    expect(arm.definitions().map((d) => d.bundleId)).toContain(YUE);
    const status = await arm.status(YUE);
    expect(status).toMatchObject({ state: 'error', reason: 'unsupported' });
    expect(status!.detail).toContain('linux-arm64');
    expect(status!.estimatedBytes).toBeNull();
    expect(arm.engineExecutable(YUE)).toBeNull();
    // Same host, viewed with the specified platform key: an engine pack exists, and with the engine not installed it is not-installed / incomplete.
    const pinned = new ModelCatalog({ root, platform: 'linux', arch: 'arm64', platformKey: 'linux-x64' });
    expect(await pinned.status(YUE)).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect((await pinned.status(YUE))!.estimatedBytes).toBeGreaterThan(0);
  });

  it('engineOverride: when the file is present the component counts as installed (bytes is null) and no unsupported-platform error is reported; when absent it does not count', async () => {
    const exe = path.join(root, 'my-audiocpp_cli');
    await fs.writeFile(exe, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const catalog = new ModelCatalog({ root, platform: 'linux', arch: 'arm64', engineOverride: exe });
    const status = await catalog.status(YUE);
    expect(status).toMatchObject({ state: 'installed' });
    expect(status!.components!.find((c) => c.component === 'audiocpp-engine')).toMatchObject({
      origin: 'github-release',
      state: 'installed',
      bytes: null,
    });
    expect(catalog.engineExecutable(YUE)).toBe(exe);
    expect((await catalog.verify(YUE)).ok).toBe(true);

    const gone = new ModelCatalog({ root, platform: 'darwin', arch: 'arm64', engineOverride: path.join(root, 'nope') });
    expect(await gone.status(YUE)).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
    expect(gone.engineExecutable(YUE)).toBeNull();
  });

  it('an engine from an older install (has the executable, no manifest) counts as installed and passes verification; the tool directory defaults to .ccut-tools inside the model directory', async () => {
    const catalog = new ModelCatalog({ root, platform: 'darwin', arch: 'arm64' });
    expect(catalog.toolsDir).toBe(path.join(root, '.ccut-tools'));
    const dir = path.join(catalog.toolsDir, 'audiocpp', '0.9.1');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'audiocpp_cli'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    expect(await catalog.status(YUE)).toMatchObject({ state: 'installed' });
    expect(catalog.engineExecutable(YUE)).toBe(path.join(dir, 'audiocpp_cli'));
    expect((await catalog.verify(YUE)).ok).toBe(true);
    // Specified tools directory.
    const elsewhere = new ModelCatalog({ root, platform: 'darwin', arch: 'arm64', toolsDir: path.join(root, 'tools') });
    expect(elsewhere.toolsDir).toBe(path.join(root, 'tools'));
    expect(await elsewhere.status(YUE)).toMatchObject({ state: 'not-installed', reason: 'incomplete' });
  });
});
