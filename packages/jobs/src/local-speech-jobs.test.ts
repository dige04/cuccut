import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type EditOperation, type JobRecord, type JobSubmitter, type SynthesizeSpeechRequest } from '@cuccut/protocol';
import { FileCredentialStore } from '@cuccut/runtime-storage';
import { LibraryStore } from '@cuccut/runtime-storage/library';
import {
  LocalProviderSource,
  MANIFEST_FILE,
  MODEL_ASSETS_ENV,
  ModelCatalog,
  ModelServiceStore,
  ModelServices,
  SPEECH_BUNDLES,
  builtinVoice,
  builtinVoiceFile,
  speechSelfTestVerdict,
  type BundleDefinition,
} from '@cuccut/models';
import { JobManager, type JobVideos } from './job-manager.ts';
import { LocalTranscribeProvider } from './local-provider.ts';
import { FAKE_MODEL_WORKER } from './index.ts';
import { MODEL_WORKER_DEMAND, modelWorkerHolder } from './resource-profiles.ts';
import { ResourceScheduler } from './resource-scheduler.ts';

const GiB = 1024 ** 3;

/**
 * Local speech synthesis runs the full path (architecture design §6.1, §6.5): ModelServices selects the `local` synthesis model, JobManager freezes the voice at submission,
 * and the local Provider executes in the Model Worker process (a fake Worker, `testing/fake-model-worker.ts`). Output is validated and published by the rules for generation jobs.
 * The model package is for testing: a candle backend (runs on any platform), with the voice description borrowed from a real model package.
 */

const real = (id: string) => SPEECH_BUNDLES.find((b) => b.bundleId === id)!;
const speechBundle = (bundleId: string, like: string, withCodec: boolean): BundleDefinition => ({
  bundleId,
  label: bundleId,
  capability: 'synthesize',
  backend: 'candle',
  device: 'cpu',
  components: {
    // The parameter count is fake: it is given only so that resource scheduling estimates the Model Worker from candle's resident size.
    tts: { family: 'qwen3-tts', repo: 'test/tts', revision: 'r-tts', weightBits: 8, parameters: 500_000_000 },
    ...(withCodec
      ? {
          codec: {
            family: 'qwen3-tts-tokenizer',
            repo: 'test/codec',
            revision: 'r-codec',
            weightBits: 32 as const,
            parameters: 100_000_000,
          },
        }
      : {}),
  },
  license: real(like).license!,
  speech: real(like).speech!,
});
const CLONE = 'clone@cpu';
const SPEAKERS = 'speakers@cpu';
const SILENT = 'clone@cpu#silent-output';
const BUNDLES: BundleDefinition[] = [
  speechBundle(CLONE, 'qwen3-tts-0.6b-base@mlx-8bit', true),
  speechBundle(SPEAKERS, 'qwen3-tts-1.7b-customvoice@mlx-8bit', true),
  speechBundle(SILENT, 'qwen3-tts-0.6b-base@mlx-8bit', true),
];

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

class FakeVideos implements JobVideos {
  applied: Array<{ commandId: string; expectedRevision: string; operations: EditOperation[] }> = [];
  retain(): void {}
  release(): void {}
  async source(): Promise<never> {
    throw new RpcError('not-found', '没有素材');
  }
  current() {
    return null;
  }
  videoRevision() {
    return null;
  }
  async apply(): Promise<never> {
    throw new Error('不用');
  }
}

describe('local speech synthesis (fake Model Worker)', () => {
  let dir: string;
  let controlFile: string;
  let recordFile: string;
  let catalog: ModelCatalog;
  let services: ModelServices;
  let provider: LocalTranscribeProvider;
  let library: LibraryStore;
  let manager: JobManager;
  let scheduler: ResourceScheduler;
  let probed: string[];
  const submitter: JobSubmitter = { kind: 'connection', id: 'conn_1' };

  const control = (value: { capabilities?: string[]; faults?: string[]; synthesizeFamilies?: string[]; readingsDropped?: unknown[] }) =>
    fs.writeFile(controlFile, JSON.stringify({ record: recordFile, ...value }));
  const recorded = async (): Promise<Array<Record<string, unknown>>> =>
    (await fs.readFile(recordFile, 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-local-speech-'));
    controlFile = path.join(dir, 'control.json');
    recordFile = path.join(dir, 'runs.jsonl');
    await control({ capabilities: ['transcribe', 'synthesize'] });
    const models = path.join(dir, 'models');
    await writeRepo(models, 'test/tts', 'r-tts');
    await writeRepo(models, 'test/codec', 'r-codec');
    // The built-in manifest is only for resource scheduling (candle's resident size requires each component to have a manifest).
    const manifest = (repo: string, revision: string) => {
      const size = `weights of ${repo}`.length;
      return { repo, revision, files: [{ path: 'model.safetensors', size, sha256: null }], estimatedBytes: size, provenance: 'test' };
    };
    catalog = new ModelCatalog({
      root: models,
      bundles: BUNDLES,
      manifests: [manifest('test/tts', 'r-tts'), manifest('test/codec', 'r-codec')],
    });
    provider = new LocalTranscribeProvider({
      catalog,
      command: () => ({ command: process.execPath, args: [FAKE_MODEL_WORKER, '--control', controlFile] }),
      env: async () => process.env,
      idleMs: 60_000,
      cancelGraceMs: 5_000,
    });
    const store = await ModelServiceStore.open(
      { modelServicesFile: path.join(dir, 'store', 'model-services.json') },
      new FileCredentialStore(path.join(dir, 'store', 'model-credentials.json')),
    );
    services = new ModelServices({
      store,
      sources: [new LocalProviderSource({ catalog, transcriber: provider, speech: provider.speechGenerator() })],
    });
    library = await LibraryStore.open({ dir: path.join(dir, 'library'), validateAudio: async () => {} });
    probed = [];
    scheduler = new ResourceScheduler({});
    manager = new JobManager({
      paths: {
        jobsFile: path.join(dir, 'store', 'jobs.jsonl'),
        stagingDir: path.join(dir, 'staging'),
        artifactsDir: path.join(dir, 'artifacts'),
        diagnosticsDir: path.join(dir, 'logs', 'diagnostics'),
      },
      catalog,
      router: services,
      videos: new FakeVideos(),
      library,
      resources: scheduler,
      // Decode validation: uses the self-checking WAV judgement in place of ffprobe (it only checks whether the file can be decoded).
      probe: async (file) => {
        probed.push(file);
        const verdict = speechSelfTestVerdict(await fs.readFile(file));
        return verdict.wav
          ? { ok: true, media: { kind: 'audio', durationSec: verdict.wav.durationSec, sampleRate: verdict.wav.sampleRate, channels: 1 } }
          : { ok: false, problems: [verdict.passed ? '' : verdict.problem] };
      },
    });
    await manager.open();
  });

  afterEach(async () => {
    await manager.shutdown();
    await provider.close();
    await library.idle();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function speak(request: Partial<SynthesizeSpeechRequest> = {}): Promise<JobRecord> {
    const { jobId } = await manager.submitSynthesizeSpeech(
      { text: '你好，世界。', provider: 'local', model: CLONE, ...request },
      submitter,
    );
    await manager.settled(jobId);
    return manager.inspect(jobId);
  }
  const rejection = (promise: Promise<unknown>) =>
    promise.then(
      () => {
        throw new Error('应当被拒绝');
      },
      (error: RpcError) => error,
    );

  it('no default and none specified: CAPABILITY_NOT_CONFIGURED (no-default, install or choose a local model); usable directly once set as default', async () => {
    const refused = await rejection(manager.submitSynthesizeSpeech({ text: '你好' }, submitter));
    expect(refused.details).toMatchObject({ code: 'CAPABILITY_NOT_CONFIGURED', capability: 'synthesizeSpeech', reason: 'no-default' });
    expect(manager.list()).toEqual([]);

    expect(await services.setDefault('synthesizeSpeech', 'local', SPEAKERS)).toEqual({ providerId: 'local', modelId: SPEAKERS });
    const { jobId } = await manager.submitSynthesizeSpeech({ text: '你好', voice: 'Ryan' }, submitter);
    await manager.settled(jobId);
    const job = manager.inspect(jobId);
    expect(job).toMatchObject({
      state: 'completed',
      providerId: 'local',
      modelId: SPEAKERS,
      bundleId: SPEAKERS,
      generation: { voice: 'Ryan', voiceMode: 'preset', format: 'wav' },
    });
    expect(job.generation).not.toHaveProperty('reference');
    const [run] = await recorded();
    expect(run).toMatchObject({
      capability: 'synthesize',
      input: null,
      options: { text: '你好', voice: { mode: 'preset', id: 'Ryan' } },
      outputContract: 'cuccut.speech-wav/v1',
    });
  });

  it('built-in voice: recordings shipped with the app have their digest frozen at submission; the Worker receives the clone and the source text, and the output WAV is validated before publishing', async () => {
    const job = await speak({ voice: 'en-female', language: 'en', seed: 7 });
    const voice = builtinVoice('en-female')!;
    const voiceFile = builtinVoiceFile(voice)!;
    const sha256 = `sha256:${crypto
      .createHash('sha256')
      .update(await fs.readFile(voiceFile))
      .digest('hex')}`;
    expect(job).toMatchObject({
      state: 'completed',
      kind: 'synthesizeSpeech',
      bundleId: CLONE,
      progress: { unit: 'steps', done: 4, total: 4 },
      generation: {
        capability: 'synthesizeSpeech',
        voice: 'en-female',
        voiceMode: 'preset',
        language: 'en',
        seed: 7,
        reference: { source: 'builtin', path: voiceFile, sha256, transcript: voice.transcript },
      },
    });
    const [run] = await recorded();
    expect(run).toMatchObject({
      jobId: job.jobId,
      runGeneration: 1,
      input: { file: voiceFile, contentHash: sha256, track: 0 },
      options: { language: 'en', voice: { mode: 'clone', transcript: voice.transcript }, seed: 7 },
    });
    expect(job.result!.outputs).toEqual([
      expect.objectContaining({ mediaType: 'audio/wav', media: expect.objectContaining({ kind: 'audio' }) }),
    ]);
    const artifact = await fs.readFile(path.join(dir, 'artifacts', `${job.result!.artifactId.replace('sha256:', '')}.wav`));
    expect(speechSelfTestVerdict(artifact)).toMatchObject({ passed: true, wav: { sampleRate: 24_000, durationSec: 1 } });
    expect(probed).toHaveLength(1);
  });

  it('resource scheduling counts the Model Worker by the candle model pack\'s resident size: parameter count × 4 (f32 on CPU) plus 1 GiB, counted in memory, not GPU memory', async () => {
    expect((await speak()).state).toBe('completed');
    expect(scheduler.snapshot().holders).toMatchObject([
      { holder: modelWorkerHolder(CLONE), demand: { ...MODEL_WORKER_DEMAND, memory: (500_000_000 + 100_000_000) * 4 + GiB, gpuMemory: 0 } },
    ]);
  });

  it('clone from a file: frozen at submission; if the file changes before execution, fail (ASSET_MISSING), do not swap the voice', async () => {
    const ref = path.join(dir, 'ref.wav');
    await fs.writeFile(ref, 'my voice');
    const job = await speak({ reference: { file: ref, transcript: '我的声音' } });
    expect(job).toMatchObject({
      state: 'completed',
      generation: {
        voice: 'reference',
        voiceMode: 'clone',
        reference: { source: 'file', path: ref, transcript: '我的声音', byteLength: 8 },
      },
    });

    // The file is modified after submission and before execution: the slow job holds the Worker, and the second job waits behind it.
    await control({ capabilities: ['transcribe', 'synthesize'], faults: ['slow'] });
    const first = await manager.submitSynthesizeSpeech({ text: '一', provider: 'local', model: CLONE }, submitter);
    const second = await manager.submitSynthesizeSpeech(
      { text: '二', provider: 'local', model: CLONE, reference: { file: ref } },
      submitter,
    );
    await fs.writeFile(ref, 'someone else');
    await manager.settled(first.jobId);
    await manager.settled(second.jobId);
    expect(manager.inspect(second.jobId)).toMatchObject({ state: 'failed', error: { code: 'ASSET_MISSING' } });
    expect((await recorded()).filter((r) => (r.options as { text: string }).text === '二')).toEqual([]);
  });

  it('voice library entry: uses its reference recording directly (no online clone needed), the task freezes the entry\'s version', async () => {
    const ref = path.join(dir, 'lib.wav');
    await fs.copyFile(builtinVoiceFile(builtinVoice('zh-male')!)!, ref);
    const content = {
      name: '我',
      language: null,
      transcript: '你好',
      origin: 'recorded' as const,
      consent: { declared: true, statement: '本人' },
    };
    const voice = (await library.put({ library: 'voices', content, file: { path: ref } })).entry;
    const job = await speak({ voice: `library:${voice.id}` });
    expect(job).toMatchObject({
      state: 'completed',
      generation: {
        voice: `library:${voice.id}`,
        voiceMode: 'clone',
        reference: { source: 'library', sha256: voice.content.reference.sha256, transcript: '你好' },
      },
      library: { entries: [{ library: 'voices', id: voice.id, version: 1, contentHash: voice.contentHash }] },
    });
    expect((await recorded())[0]).toMatchObject({ options: { voice: { mode: 'clone', transcript: '你好' } } });
  });

  it('a mode the model cannot do is rejected at submission, no task is created', async () => {
    for (const request of [
      { model: SPEAKERS, reference: { file: path.join(dir, 'x.wav') } },
      { voiceDescription: 'calm' },
      { voice: 'Vivian' },
      { cfg: 2 },
      { format: 'mp3' as const },
      { reference: { file: path.join(dir, 'missing.wav') } },
    ]) {
      expect(
        (await rejection(manager.submitSynthesizeSpeech({ text: '你好', provider: 'local', model: CLONE, ...request }, submitter))).code,
      ).toBe('invalid-request');
    }
    expect(manager.list()).toEqual([]);
    expect(await recorded()).toEqual([]);
  });

  it('unreadable reference recording: a user-supplied file is INPUT_UNREADABLE (the sentence names the file); a recording shipped with the app is APP_FILE_MISSING (reinstall, the sentence has no path)', async () => {
    const missing = path.join(dir, 'gone', 'my-voice.wav');
    const refused = await rejection(
      manager.submitSynthesizeSpeech({ text: '你好', provider: 'local', model: CLONE, reference: { file: missing } }, submitter),
    );
    expect(refused).toMatchObject({ code: 'invalid-request', details: { code: 'INPUT_UNREADABLE', reference: 'file', file: missing } });
    expect(refused.message).toContain('「my-voice.wav」');
    expect(refused.message).not.toContain(dir);

    // The model data directory is empty: the built-in voice's recording is missing, so the installation is incomplete.
    const empty = path.join(dir, 'empty-assets');
    await fs.mkdir(empty);
    const saved = process.env[MODEL_ASSETS_ENV];
    process.env[MODEL_ASSETS_ENV] = empty;
    try {
      const builtin = await rejection(
        manager.submitSynthesizeSpeech({ text: '你好', provider: 'local', model: CLONE, voice: 'en-female', language: 'en' }, submitter),
      );
      expect(builtin).toMatchObject({
        code: 'conflict',
        details: { code: 'APP_FILE_MISSING', asset: 'tts-voices/en-female.wav', file: path.join(empty, 'tts-voices', 'en-female.wav') },
      });
      expect(builtin.message).toContain('重新安装 CucCut');
      expect(builtin.message).not.toContain(empty);
    } finally {
      if (saved === undefined) delete process.env[MODEL_ASSETS_ENV];
      else process.env[MODEL_ASSETS_ENV] = saved;
    }
    expect(manager.list()).toEqual([]);
    expect(await recorded()).toEqual([]);
  });

  it('built-in voice recording missing after submission and before execution: task fails with APP_FILE_MISSING (not ASSET_MISSING), voice not swapped', async () => {
    const assets = path.join(dir, 'assets');
    await fs.mkdir(path.join(assets, 'tts-voices'), { recursive: true });
    const voiceFile = path.join(assets, 'tts-voices', 'en-female.wav');
    await fs.copyFile(builtinVoiceFile(builtinVoice('en-female')!)!, voiceFile);
    const ref = path.join(dir, 'ref.wav');
    await fs.writeFile(ref, 'my voice');
    const saved = process.env[MODEL_ASSETS_ENV];
    process.env[MODEL_ASSETS_ENV] = assets;
    try {
      // The slow job holds the Worker, and the second job waits behind it.
      await control({ capabilities: ['transcribe', 'synthesize'], faults: ['slow'] });
      const first = await manager.submitSynthesizeSpeech(
        { text: '一', provider: 'local', model: CLONE, reference: { file: ref } },
        submitter,
      );
      const second = await manager.submitSynthesizeSpeech(
        { text: '二', provider: 'local', model: CLONE, voice: 'en-female', language: 'en' },
        submitter,
      );
      await fs.rm(voiceFile);
      await manager.settled(first.jobId);
      await manager.settled(second.jobId);
      const failed = manager.inspect(second.jobId);
      expect(failed).toMatchObject({
        state: 'failed',
        error: { code: 'APP_FILE_MISSING', details: expect.objectContaining({ file: voiceFile }) },
      });
      expect(failed.error!.message).toContain('重新安装 CucCut');
      expect(failed.error!.message).not.toContain(assets);
      expect((await recorded()).filter((r) => (r.options as { text: string }).text === '二')).toEqual([]);
    } finally {
      if (saved === undefined) delete process.env[MODEL_ASSETS_ENV];
      else process.env[MODEL_ASSETS_ENV] = saved;
    }
  });

  it('Worker does not declare synthesize: MODEL_LOAD_FAILED (capability-missing), nothing is loaded, the model pack is not disabled', async () => {
    await control({ capabilities: ['transcribe'] });
    const job = await speak({ voice: 'en-female' });
    expect(job).toMatchObject({
      state: 'failed',
      error: { code: 'MODEL_LOAD_FAILED', details: expect.objectContaining({ reason: 'unsupported', detail: 'capability-missing' }) },
    });
    expect(await recorded()).toEqual([]);
    // A Worker that declares synthesize makes it usable again: the model package was not disabled, and its status is still installed.
    expect(catalog.blocked(CLONE)).toBe(false);
    expect(await catalog.status(CLONE)).toMatchObject({ state: 'installed' });
  });

  it('Worker does not list this family: likewise capability-missing, no model.load is sent, the model pack is not disabled', async () => {
    await control({ capabilities: ['transcribe', 'synthesize'], synthesizeFamilies: ['voxcpm2', 'omnivoice'] });
    const job = await speak({ voice: 'en-female' });
    expect(job).toMatchObject({
      state: 'failed',
      error: {
        code: 'MODEL_LOAD_FAILED',
        details: expect.objectContaining({
          reason: 'unsupported',
          detail: 'capability-missing',
          family: 'qwen3-tts',
          synthesizeFamilies: ['voxcpm2', 'omnivoice'],
        }),
      },
    });
    expect(await recorded()).toEqual([]);
    expect(catalog.blocked(CLONE)).toBe(false);
    expect(await catalog.status(CLONE)).toMatchObject({ state: 'installed' });
  });

  it('a pronunciation annotation that cannot be spoken: the task still completes, each one carries a reading-dropped warning', async () => {
    await control({
      capabilities: ['transcribe', 'synthesize'],
      readingsDropped: [{ start: 1, end: 2, reading: 'hang2', origin: 'user' }],
    });
    const job = await speak({ voice: 'en-female' });
    expect(job.state).toBe('completed');
    expect(job.warnings).toEqual([
      {
        code: 'reading-dropped',
        detail: expect.stringContaining('hang2'),
        detailRef: expect.objectContaining({ key: 'jobsLocalProvider.readingDroppedOne' }),
      },
    ]);
  });

  it('output is silence: decode validation passes as usual (silence is valid WAV), the self-check fails it', async () => {
    const job = await speak({ model: SILENT, voice: 'en-female' });
    expect(job.state).toBe('completed');
    const artifact = await fs.readFile(path.join(dir, 'artifacts', `${job.result!.artifactId.replace('sha256:', '')}.wav`));
    expect(speechSelfTestVerdict(artifact)).toMatchObject({ passed: false, problem: '输出是静音' });
  });
});
