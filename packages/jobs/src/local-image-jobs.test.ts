import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type GenerateImageRequest, type JobRecord, type JobSubmitter } from '@cuccut/protocol';
import { FileCredentialStore } from '@cuccut/runtime-storage';
import { LibraryStore } from '@cuccut/runtime-storage/library';
import {
  IMAGE_BUNDLES,
  LocalProviderSource,
  MANIFEST_FILE,
  ModelCatalog,
  ModelServiceStore,
  ModelServices,
  imageSelfTestVerdict,
  inspectPng,
  type BundleDefinition,
} from '@cuccut/models';
import { JobManager, type JobVideos } from './job-manager.ts';
import { LocalTranscribeProvider } from './local-provider.ts';
import { MODEL_WORKER_DEMAND, modelWorkerHolder } from './resource-profiles.ts';
import { ResourceScheduler } from './resource-scheduler.ts';
import { FAKE_MODEL_WORKER } from './index.ts';

/**
 * Local text-to-image runs the full path (architecture design §6.1, §6.5): ModelServices selects the `local` image model, JobManager freezes the size and seed at submission, and the local Provider executes in the Model Worker process (a fake Worker, `testing/fake-model-worker.ts`). Output is validated and published by the rules for generation jobs.
 * The model package is for testing: a candle backend (runs on any platform), with the model description borrowed from a real model package.
 */

const GiB = 1024 * 1024 * 1024;
const REAL = IMAGE_BUNDLES[0]!;
const imageBundle = (bundleId: string, peakBytes = REAL.image!.peakBytes): BundleDefinition => ({
  bundleId,
  label: bundleId,
  capability: 'image',
  backend: 'candle',
  device: 'cpu',
  components: { image: { family: 'qwen-image', repo: 'test/image', revision: 'r-image' } },
  license: REAL.license!,
  image: { ...REAL.image!, peakBytes },
});
const IMAGE = 'image@cpu';
const BIG = 'big@cpu';
const BUNDLES = [imageBundle(IMAGE), imageBundle(BIG, 3 * GiB)];

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

describe('local text-to-image (fake Model Worker)', () => {
  let dir: string;
  let controlFile: string;
  let recordFile: string;
  let catalog: ModelCatalog;
  let services: ModelServices;
  let provider: LocalTranscribeProvider;
  let library: LibraryStore;
  let scheduler: ResourceScheduler;
  let manager: JobManager;
  const submitter: JobSubmitter = { kind: 'connection', id: 'conn_1' };

  const control = (value: { capabilities?: string[]; faults?: string[]; imageFamilies?: string[] }) =>
    fs.writeFile(controlFile, JSON.stringify({ record: recordFile, ...value }));
  const recorded = async (): Promise<Array<Record<string, unknown>>> =>
    (await fs.readFile(recordFile, 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-local-image-'));
    controlFile = path.join(dir, 'control.json');
    recordFile = path.join(dir, 'runs.jsonl');
    await control({ capabilities: ['transcribe', 'image'] });
    const models = path.join(dir, 'models');
    await writeRepo(models, 'test/image', 'r-image');
    catalog = new ModelCatalog({ root: models, bundles: BUNDLES });
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
      sources: [new LocalProviderSource({ catalog, transcriber: provider, image: provider.imageGenerator() })],
    });
    library = await LibraryStore.open({ dir: path.join(dir, 'library'), validateAudio: async () => {} });
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
      // Decode validation: uses the self-checking PNG parser in place of ffprobe.
      probe: async (file) => {
        const parsed = inspectPng(await fs.readFile(file));
        return parsed.ok
          ? { ok: true, media: { kind: 'image', width: parsed.png.width, height: parsed.png.height } }
          : { ok: false, problems: [parsed.problem] };
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

  async function draw(request: Partial<GenerateImageRequest> = {}): Promise<JobRecord> {
    const { jobId } = await manager.submitGenerateImage({ prompt: '一只红苹果', provider: 'local', model: IMAGE, ...request }, submitter);
    await manager.settled(jobId);
    return manager.inspect(jobId);
  }

  it('capability view: local provides generateImage, model description comes from the model pack (one image at a time, PNG, accepts seed, free)', async () => {
    const view = await services.refresh();
    expect(view.generateImage.default).toBeNull();
    expect(view.generateImage.effective).toBeNull();
    const capability = view.generateImage.providers.find((p) => p.providerId === 'local')!;
    expect(capability).toMatchObject({ kind: 'local', available: true });
    expect(capability.models.map((m) => m.modelId)).toEqual([IMAGE, BIG]);
    expect(capability.models[0]).toMatchObject({
      sizes: [...REAL.image!.aspects.map((a) => a.size), '512x512'],
      defaultSize: '1024x1024',
      maxCount: 1,
      formats: ['png'],
      acceptsSeed: true,
      referenceImages: null,
      cost: 'free-local',
      local: { steps: { min: 8, max: 40, step: 4, default: 20 } },
    });
    // A trial 512² submits successfully but does not enter the aspect ratios (only the few ratios whose long side is 1024).
    expect(capability.models[0]!.aspectRatios.map((a) => a.size)).not.toContain('512x512');
  });

  it('submit freezes size and seed (a seed is drawn if none is given); the Worker receives image job.run, and the output PNG is validated before publishing', async () => {
    const job = await draw({ size: '16:9' });
    expect(job).toMatchObject({
      state: 'completed',
      kind: 'generateImage',
      providerId: 'local',
      modelId: IMAGE,
      bundleId: IMAGE,
      progress: { unit: 'steps', done: 20, total: 20 },
      generation: { capability: 'generateImage', size: '1024x576', count: 1, format: 'png' },
    });
    const seed = (job.generation as { seed: number | null }).seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
    const [run] = await recorded();
    expect(run).toMatchObject({
      jobId: job.jobId,
      capability: 'image',
      options: { prompt: '一只红苹果', width: 1024, height: 576, steps: null, seed },
      outputContract: 'cuccut.image-png/v1',
    });
    expect(job.result!.outputs).toEqual([
      expect.objectContaining({ mediaType: 'image/png', media: { kind: 'image', width: 1024, height: 576 } }),
    ]);
    const artifact = await fs.readFile(path.join(dir, 'artifacts', `${job.result!.artifactId.replace('sha256:', '')}.png`));
    expect(imageSelfTestVerdict(artifact, { width: 1024, height: 576 })).toMatchObject({ passed: true });
  });

  it('a given seed is used; re-execution reuses the frozen seed', async () => {
    const job = await draw({ seed: 42 });
    expect(job.generation).toMatchObject({ seed: 42, size: '1024x1024' });
    expect((await recorded())[0]).toMatchObject({ options: { seed: 42, width: 1024, height: 1024 } });
  });

  it('a given step count is frozen and handed to the Worker; when none is given, nothing is written (the Worker uses its default steps)', async () => {
    const job = await draw({ size: '512x512', steps: 8 });
    expect(job).toMatchObject({
      state: 'completed',
      progress: { unit: 'steps', done: 8, total: 8 },
      generation: { size: '512x512', aspectRatio: null, steps: 8 },
    });
    expect((await recorded())[0]).toMatchObject({ options: { width: 512, height: 512, steps: 8 } });
    expect((await draw()).generation).not.toHaveProperty('steps');
  });

  it('resource scheduling counts the Model Worker by the peak registered by the model pack: candle counts memory on CPU and does not take GPU memory', async () => {
    expect((await draw()).state).toBe('completed');
    expect(scheduler.snapshot().holders).toMatchObject([
      { holder: modelWorkerHolder(IMAGE), demand: { ...MODEL_WORKER_DEMAND, memory: REAL.image!.peakBytes, gpuMemory: 0 } },
    ]);
  });

  it('model pack with a peak above the fixed requirement: the Model Worker is counted at the peak', async () => {
    expect((await draw({ model: BIG })).state).toBe('completed');
    expect(scheduler.snapshot().holders).toMatchObject([
      { holder: modelWorkerHolder(BIG), demand: { ...MODEL_WORKER_DEMAND, memory: 3 * GiB, gpuMemory: 0 } },
    ]);
  });

  it('sizes, counts and formats the model does not support are rejected at submission, no task is created', async () => {
    for (const request of [{ size: '640x640' }, { count: 2 }, { format: 'jpeg' as const }, { steps: 4 }, { steps: 41 }, { steps: 8.5 }]) {
      const refused = await manager.submitGenerateImage({ prompt: 'x', provider: 'local', model: IMAGE, ...request }, submitter).then(
        () => null,
        (error: RpcError) => error,
      );
      expect(refused, JSON.stringify(request)).toBeInstanceOf(RpcError);
    }
    expect(manager.list()).toEqual([]);
  });

  it('Worker does not declare image: MODEL_LOAD_FAILED (capability-missing), nothing is loaded, the model pack is not disabled', async () => {
    await control({ capabilities: ['transcribe'] });
    expect(await draw()).toMatchObject({
      state: 'failed',
      error: { code: 'MODEL_LOAD_FAILED', details: expect.objectContaining({ reason: 'unsupported', detail: 'capability-missing' }) },
    });
    expect(await recorded()).toEqual([]);
    expect(catalog.blocked(IMAGE)).toBe(false);
  });

  it('Worker does not list this family: likewise capability-missing, no model.load is sent, the model pack is not disabled', async () => {
    await control({ capabilities: ['transcribe', 'image'], imageFamilies: [] });
    expect(await draw()).toMatchObject({
      state: 'failed',
      error: {
        code: 'MODEL_LOAD_FAILED',
        details: expect.objectContaining({ detail: 'capability-missing', family: 'qwen-image', imageFamilies: [] }),
      },
    });
    expect(await recorded()).toEqual([]);
    expect(catalog.blocked(IMAGE)).toBe(false);
    expect(await catalog.status(IMAGE)).toMatchObject({ state: 'installed' });
  });
});
