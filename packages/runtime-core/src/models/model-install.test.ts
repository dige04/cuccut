import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyJobsEvent, applyModelsEvent } from '@cuccut/client';
import { FAKE_MODEL_WORKER } from '@cuccut/jobs';
import {
  BUNDLES,
  MODELS_ENDPOINT_ENV,
  MODEL_ASSETS_ENV,
  QWEN3_ASR_0_6B_BUNDLE,
  defaultTranscribeBundle,
  resolveModelAssetsDir,
} from '@cuccut/models';
import {
  serveRepo,
  startFakeModelSource,
  syntheticBytes,
  syntheticManifest,
  type FakeModelSource,
  type SyntheticRepo,
} from '@cuccut/models/testing';
import {
  RpcError,
  newId,
  type JobRecord,
  type JobsSnapshot,
  type ModelBundleStatus,
  type ModelsEvent,
  type ModelsSnapshot,
} from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, mcp, tool, until } from '../agent-tools/testing/fake-agent.ts';

/**
 * End-to-end model installation (architecture design §6.3): the gateway's `models.install / cancelInstall / repair / remove / test` → JobManager → downloader →
 * a fake model source on the loopback address (a synthetic repository and manifest); self-tests go through a fake Model Worker. The model directory is a temporary directory; there is no access to the real network and no real models are downloaded. Transcription uses Qwen3-ASR 0.6B on this machine (MLX on Apple Silicon, candle on other platforms); the speech synthesis model bundle is MLX, and it is tested only on macOS with Apple Silicon.
 */

const appleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
/** Qwen3-ASR 0.6B model bundle on this machine: MLX on Apple Silicon, candle on other platforms (same repository). */
const TRANSCRIBE_BUNDLE = appleSilicon ? QWEN3_ASR_0_6B_BUNDLE : 'qwen3-asr-0.6b@candle';
if (!appleSilicon) console.warn('跳过语音合成模型包的安装测试：它们是 MLX 的，只在 Apple Silicon 的 macOS 上可用');

const def = BUNDLES.find((b) => b.bundleId === TRANSCRIBE_BUNDLE)!;
const repos: SyntheticRepo[] = [
  {
    repo: def.components.asr!.repo,
    revision: def.components.asr!.revision,
    files: { 'config.json': Buffer.from('{"synthetic":"asr"}'), 'model.safetensors': syntheticBytes(400_000, 11) },
  },
  {
    repo: def.components.vad!.repo,
    revision: def.components.vad!.revision,
    files: { 'config.json': Buffer.from('{}'), 'model.safetensors': syntheticBytes(60_000, 12) },
  },
  // Optional aligner: install and repair still download it.
  {
    repo: def.components.aligner!.repo,
    revision: def.components.aligner!.revision,
    files: { 'config.json': Buffer.from('{"synthetic":"aligner"}'), 'model.safetensors': syntheticBytes(30_000, 14) },
  },
];
/** Local speech synthesis: a model bundle with a single component; the self-test synthesizes one sentence with the default voice (the fake Worker writes a 1-second sine WAV, or silence for `silent-output`). */
const SPEECH_BUNDLE = 'voxcpm2@mlx-int8';
const speechDef = BUNDLES.find((b) => b.bundleId === SPEECH_BUNDLE)!;
const speechRepo: SyntheticRepo = {
  repo: speechDef.components.tts!.repo,
  revision: speechDef.components.tts!.revision,
  files: { 'config.json': Buffer.from('{"synthetic":"tts"}'), 'model.safetensors': syntheticBytes(80_000, 13) },
};
/** Local text-to-image: the whole repository is a single `image` component; the self-test generates one 256² image with a fixed prompt and seed in a few steps (the fake Worker writes a gradient PNG). */
const IMAGE_BUNDLE = 'qwen-image-2.1@mlx-4bit';
const imageDef = BUNDLES.find((b) => b.bundleId === IMAGE_BUNDLE)!;
const imageRepo: SyntheticRepo = {
  repo: imageDef.components.image!.repo,
  revision: imageDef.components.image!.revision,
  files: { 'model_index.json': Buffer.from('{"synthetic":"image"}'), 'vae/model.safetensors': syntheticBytes(50_000, 15) },
};
/** Local vocal separation: a single `separator` component; the self-test splits the recognition sample into two tracks (the fake Worker writes vocals and a background 12 dB lower). */
const SEPARATE_BUNDLE = 'htdemucs-ft@mlx';
const separateDef = BUNDLES.find((b) => b.bundleId === SEPARATE_BUNDLE)!;
const separateRepo: SyntheticRepo = {
  repo: separateDef.components.separator!.repo,
  revision: separateDef.components.separator!.revision,
  files: { 'htdemucs_ft_config.json': Buffer.from('{"synthetic":"sep"}'), 'htdemucs_ft.safetensors': syntheticBytes(50_000, 15) },
};
/** The “speaker diarization” model bundle (the one Qwen3-ASR uses on this machine): Pyannote segmentation and WeSpeaker, two components, with no separate check. */
const diarizationDef = BUNDLES.find((b) => b.bundleId === def.diarization)!;
const diarizationRepos: SyntheticRepo[] = [
  {
    repo: diarizationDef.components.segmentation!.repo,
    revision: diarizationDef.components.segmentation!.revision,
    files: { 'config.json': Buffer.from('{"synthetic":"seg"}'), 'model.safetensors': syntheticBytes(20_000, 16) },
  },
  {
    repo: diarizationDef.components.speaker!.repo,
    revision: diarizationDef.components.speaker!.revision,
    files: { 'config.json': Buffer.from('{"synthetic":"spk"}'), 'model.safetensors': syntheticBytes(20_000, 17) },
  },
];
const repoBytes = (r: SyntheticRepo) => Object.values(r.files).reduce((s, b) => s + b.length, 0);
const TOTAL = repos.reduce((sum, r) => sum + repoBytes(r), 0);
/**
 * The default transcription model bundle on this machine (MOSS): its own recognition weights, plus the aligner and speaker model (WeSpeaker) shared with the above. The agent's download tool installs it when no `bundleId` is given.
 */
const DEFAULT_TRANSCRIBE_BUNDLE = defaultTranscribeBundle(process.platform, process.arch);
const defaultDef = BUNDLES.find((b) => b.bundleId === DEFAULT_TRANSCRIBE_BUNDLE)!;
const defaultAsrRepo: SyntheticRepo = {
  repo: defaultDef.components.asr!.repo,
  revision: defaultDef.components.asr!.revision,
  files: { 'config.json': Buffer.from('{"synthetic":"moss"}'), 'model.safetensors': syntheticBytes(90_000, 18) },
};
const DEFAULT_TOTAL = Object.values(defaultDef.components)
  .map((c) => [defaultAsrRepo, ...repos, ...diarizationRepos].find((r) => r.repo === c!.repo)!)
  .reduce((sum, r) => sum + repoBytes(r), 0);

interface Side {
  dir: string;
  home: RuntimeHome;
  runtime: RunningRuntime;
  client: CucCutClient;
  driver: ToolDriver;
  control: string;
  jobs: () => JobsSnapshot | null;
  models: () => ModelsSnapshot | null;
  modelEvents: ModelsEvent[];
}

async function startSide(source: FakeModelSource, free: { bytes: number | null }): Promise<Side> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-model-install-'));
  const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  const control = path.join(dir, 'fake-worker-control.json');
  await fs.writeFile(control, '{}');
  const driver = new ToolDriver();
  const runtime = await startRuntime({
    home,
    drivers: () => [driver],
    watchSpace: false,
    engineHost: null,
    modelWorker: { command: process.execPath, args: [FAKE_MODEL_WORKER, '--control', control] },
    jobIdleMs: 60_000,
    modelInstall: {
      env: { [MODELS_ENDPOINT_ENV]: source.endpoint },
      installer: {
        manifests: [...repos, ...diarizationRepos, defaultAsrRepo, speechRepo, imageRepo, separateRepo].map((r) => syntheticManifest(r)),
        freeBytes: async () => free.bytes,
        backoffMs: () => 5,
      },
    },
  });
  const { endpoint, token } = runtime.discovery;
  const client = new CucCutClient({
    resolve: async () => ({ endpoint, token }),
    client: { kind: 'desktop', name: 'test', version: '0' },
    reconnect: false,
  });
  await client.connect();
  let jobs: JobsSnapshot | null = null;
  let models: ModelsSnapshot | null = null;
  const modelEvents: ModelsEvent[] = [];
  client.subscribeJobs({
    snapshot: (snapshot) => (jobs = snapshot),
    event: (event) => (jobs = applyJobsEvent(jobs!, event)),
  });
  client.subscribeModels({
    snapshot: (snapshot) => (models = snapshot),
    event: (event) => {
      modelEvents.push(event);
      models = applyModelsEvent(models!, event);
    },
  });
  await until(() => jobs && models);
  return { dir, home, runtime, client, driver, control, jobs: () => jobs, models: () => models, modelEvents };
}

async function stopSide(side: Side | undefined): Promise<void> {
  if (!side) return;
  side.client.close();
  await side.runtime.close();
  await fs.rm(side.dir, { recursive: true, force: true });
}

const bundleOf = (side: Side): ModelBundleStatus | undefined =>
  side.models()?.bundles.find((b) => b.bundleId === TRANSCRIBE_BUNDLE);
const jobOf = (side: Side, jobId: string): JobRecord | undefined => side.jobs()?.jobs.find((j) => j.jobId === jobId);
const terminal = (job: JobRecord | undefined) => job && ['completed', 'failed', 'cancelled', 'interrupted'].includes(job.state) && job;

describe('模型安装（假模型来源 + 假 Model Worker）', () => {
  let source: FakeModelSource;
  let side: Side | undefined;
  const free = { bytes: (10 * 1024 * 1024 * 1024) as number | null };

  beforeEach(async () => {
    source = await startFakeModelSource();
    for (const repo of [...repos, ...diarizationRepos, defaultAsrRepo, speechRepo, imageRepo, separateRepo]) serveRepo(source, repo);
    free.bytes = 10 * 1024 * 1024 * 1024;
  });

  afterEach(async () => {
    await stopSide(side);
    side = undefined;
    await source.close();
  });

  it('两步安装：先给大小，确认后是普通任务；进度在 jobs 主题（字节），状态在 models 主题；取消即暂停，再装续传；自检通过', async () => {
    side = await startSide(source, free);
    expect(bundleOf(side)).toMatchObject({ state: 'not-installed', reason: 'missing-manifest' });

    // Step 1: return only the plan; no task is created.
    const first = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    expect(first.jobId).toBeNull();
    expect(first.plan).toMatchObject({
      downloadBytes: TOTAL,
      confirmBytes: TOTAL,
      resumedBytes: 0,
      source: source.endpoint,
      upToDate: false,
    });
    expect((await side.client.request('jobs.list', {})).jobs).toEqual([]);

    // Byte count does not match: rejected, and a new plan is returned.
    const changed = await side.client
      .request('models.install', { bundleId: TRANSCRIBE_BUNDLE, confirmBytes: TOTAL + 1 })
      .catch((e: unknown) => e);
    expect(changed).toBeInstanceOf(RpcError);
    expect(changed).toMatchObject({ code: 'conflict', details: { code: 'MODEL_INSTALL_SIZE_CHANGED', plan: { confirmBytes: TOTAL } } });

    // Step 2: confirm. Download is slowed so it can be cancelled midway.
    source.throttle(8 * 1024, 20);
    const submitted = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE, confirmBytes: TOTAL });
    const jobId = submitted.jobId!;
    expect(jobId).toMatch(/^job_/);
    // The same model bundle is already being installed: submitting again returns the same task.
    expect((await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE, confirmBytes: TOTAL })).jobId).toBe(jobId);

    const downloading = await until(() => {
      const job = jobOf(side!, jobId);
      return job?.phase === 'downloading' && job.progress && job.progress.done > 20_000 && job;
    });
    expect(downloading).toMatchObject({
      kind: 'modelInstall',
      bundleId: TRANSCRIBE_BUNDLE,
      progress: { unit: 'bytes', total: TOTAL },
    });
    expect(downloading.submitter).toMatchObject({ kind: 'connection' });
    const status = await until(() => bundleOf(side!)?.state === 'downloading' && bundleOf(side!));
    expect(status.install).toMatchObject({ jobId, state: 'downloading', totalBytes: TOTAL });
    expect(side.modelEvents.some((e) => e.type === 'bundle.updated' && e.bundle.state === 'downloading')).toBe(true);
    // Cannot self-test while downloading.
    const busy = await side.client.request('models.test', { bundleId: TRANSCRIBE_BUNDLE }).catch((e: unknown) => e);
    expect(busy).toMatchObject({ code: 'conflict', details: { code: 'MODEL_UNAVAILABLE' } });

    // Cancel: the task is cancelled, staging is kept, and the model bundle reports paused.
    const cancelled = await side.client.request('models.cancelInstall', { bundleId: TRANSCRIBE_BUNDLE });
    expect(cancelled.bundle).toMatchObject({ state: 'not-installed', install: { state: 'paused', jobId: null, totalBytes: TOTAL } });
    const paused = cancelled.bundle.install!.receivedBytes;
    expect(paused).toBeGreaterThan(0);
    expect(paused).toBeLessThan(TOTAL);
    expect((await until(() => terminal(jobOf(side!, jobId)))).state).toBe('cancelled');
    await until(() => bundleOf(side!)?.install?.state === 'paused');

    // Install again: only the remaining bytes are counted; it resumes.
    source.throttle(64 * 1024, 0);
    const again = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    expect(again.plan.resumedBytes).toBe(paused);
    expect(again.plan.downloadBytes).toBe(TOTAL - paused);
    const before = source.requests.length;
    const resumed = await side.client.request('models.install', {
      bundleId: TRANSCRIBE_BUNDLE,
      confirmBytes: again.plan.confirmBytes,
    });
    const done = await until(() => terminal(jobOf(side!, resumed.jobId!)));
    expect(done.state).toBe('completed');
    expect(done.result).toMatchObject({ documentId: null, artifactId: expect.any(String) });
    expect(source.requests.slice(before).some((r) => r.range !== null)).toBe(true);
    await until(() => bundleOf(side!)?.state === 'installed');
    expect(bundleOf(side!)!.install).toBeUndefined();
    const listed = (await side.client.request('models.list', {})).bundles.find((b) => b.bundleId === TRANSCRIBE_BUNDLE)!;
    expect(listed).toMatchObject({ state: 'installed' });
    expect(listed.components!.map((c) => c.state)).toEqual(['installed', 'installed', 'installed']);
    // Local transcription capability becomes available as a result.
    await until(async () => {
      const { capabilities } = await side!.client.request('models.capabilities', {});
      const local = capabilities.transcribe.providers.find((p) => p.providerId === 'local');
      return local?.available === true;
    });
    expect((await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE })).plan.upToDate).toBe(true);

    // Self-test: the sample goes through the full Worker flow, and the result is recorded on the model bundle.
    const { jobId: testJob } = await side.client.request('models.test', { bundleId: TRANSCRIBE_BUNDLE });
    const tested = await until(() => terminal(jobOf(side!, testJob)), 15_000);
    expect(tested).toMatchObject({ kind: 'modelTest', state: 'completed', bundleId: TRANSCRIBE_BUNDLE });
    expect(tested.result).toMatchObject({ documentId: null, artifactId: expect.any(String) });
    const selfTest = await until(() => bundleOf(side!)?.selfTest);
    expect(selfTest).toMatchObject({ state: 'passed', jobId: testJob });
    expect(selfTest.detail).toContain('testing one two three');
    // Neither kind of task belongs to an agent task.
    expect(side.jobs()!.jobs.every((j) => j.submitter.kind === 'connection')).toBe(true);
  });

  it('删除：自检进行中拒绝（MODEL_IN_USE），结束后删除；修复只补缺的文件；严格离线拒绝下载', async () => {
    side = await startSide(source, free);
    const plan = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    const { jobId } = await side.client.request('models.install', {
      bundleId: TRANSCRIBE_BUNDLE,
      confirmBytes: plan.plan.confirmBytes,
    });
    expect((await until(() => terminal(jobOf(side!, jobId!)))).state).toBe('completed');

    // Repair: delete one file, corrupt another (same size); only these two are re-downloaded.
    const asrDir = path.join(side.home.modelsDir, ...repos[0]!.repo.split('/'));
    await fs.rm(path.join(asrDir, 'config.json'));
    const weights = Buffer.from(repos[0]!.files['model.safetensors']!);
    weights[0] = weights[0]! ^ 0xff;
    await fs.writeFile(path.join(asrDir, 'model.safetensors'), weights);
    const repair = await side.client.request('models.repair', { bundleId: TRANSCRIBE_BUNDLE });
    expect(repair.plan.components.map((c) => [c.component, c.action, c.files])).toEqual([
      ['asr', 'download', ['config.json', 'model.safetensors']],
      ['vad', 'keep', []],
      ['aligner', 'keep', []],
    ]);
    const before = source.requests.length;
    const repaired = await side.client.request('models.repair', {
      bundleId: TRANSCRIBE_BUNDLE,
      confirmBytes: repair.plan.confirmBytes,
    });
    expect((await until(() => terminal(jobOf(side!, repaired.jobId!)))).state).toBe('completed');
    expect(
      source.requests
        .slice(before)
        .filter((r) => r.method === 'GET')
        .map((r) => `${r.repo}:${r.file}`),
    ).toEqual([`${repos[0]!.repo}:config.json`, `${repos[0]!.repo}:model.safetensors`]);
    expect(await fs.readFile(path.join(asrDir, 'model.safetensors'))).toEqual(repos[0]!.files['model.safetensors']);

    // A slow self-test is running: deletion is rejected.
    await fs.writeFile(side.control, JSON.stringify({ faults: ['slow'] }));
    const { jobId: testJob } = await side.client.request('models.test', { bundleId: TRANSCRIBE_BUNDLE });
    // The Worker is already executing (progress exists), not just queued.
    await until(() => jobOf(side!, testJob)?.progress, 10_000);
    const refused = await side.client.request('models.remove', { bundleId: TRANSCRIBE_BUNDLE }).catch((e: unknown) => e);
    expect(refused).toMatchObject({ code: 'conflict', details: { code: 'MODEL_IN_USE', jobIds: [testJob] } });
    expect((await fs.stat(asrDir)).isDirectory()).toBe(true);

    await side.client.request('jobs.cancel', { jobId: testJob });
    await until(() => terminal(jobOf(side!, testJob)));
    // Transcription has a factory default: the default pointing to the deleted model bundle is kept and reported as unavailable (§6.8).
    await side.client.request('models.setDefault', { capability: 'transcribe', providerId: 'local', modelId: TRANSCRIBE_BUNDLE });
    const removed = await side.client.request('models.remove', { bundleId: TRANSCRIBE_BUNDLE });
    expect(removed.removed.sort()).toEqual(repos.map((r) => r.repo).sort());
    expect(removed.kept).toEqual([]);
    expect(removed.bundle).toMatchObject({ state: 'not-installed', reason: 'missing-manifest' });
    expect(await fs.stat(asrDir).catch(() => null)).toBeNull();
    await until(() => bundleOf(side!)?.state === 'not-installed');
    const kept = (await side.client.request('models.capabilities', {})).capabilities.transcribe;
    expect(kept.default).toEqual({ providerId: 'local', modelId: TRANSCRIBE_BUNDLE });
    expect(kept.effective).toBeNull();

    // Insufficient space: the task fails after confirmation, and the error includes a remedy.
    free.bytes = 1000;
    const tight = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    expect(tight.plan.availableBytes).toBe(1000);
    const failing = await side.client.request('models.install', {
      bundleId: TRANSCRIBE_BUNDLE,
      confirmBytes: tight.plan.confirmBytes,
    });
    const failed = await until(() => terminal(jobOf(side!, failing.jobId!)));
    expect(failed).toMatchObject({
      state: 'failed',
      error: {
        code: 'MODEL_DOWNLOAD_NO_SPACE',
        details: { requiredBytes: TOTAL, availableBytes: 1000, remedy: expect.stringContaining('磁盘空间不足') },
      },
    });

    // Strict offline: no download.
    await side.client.request('settings.set', { values: { 'offline.strict': true } });
    const offline = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE }).catch((e: unknown) => e);
    expect(offline).toMatchObject({ code: 'conflict', details: { code: 'OFFLINE_STRICT' } });
    const unknown = await side.client.request('models.remove', { bundleId: 'nope' }).catch((e: unknown) => e);
    expect(unknown).toMatchObject({ code: 'not-found' });
  });

  it('补齐可选组件：装好的模型包缺对齐器时照常算装好，安装只下载它；装好后空闲的 Worker 先卸下，下一个任务带上它', async () => {
    side = await startSide(source, free);
    const plan = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    const { jobId } = await side.client.request('models.install', {
      bundleId: TRANSCRIBE_BUNDLE,
      confirmBytes: plan.plan.confirmBytes,
    });
    expect((await until(() => terminal(jobOf(side!, jobId!)))).state).toBe('completed');
    // The self-test loaded the Worker, which is idle after finishing (`jobIdleMs` is one minute).
    const { jobId: testJob } = await side.client.request('models.test', { bundleId: TRANSCRIBE_BUNDLE });
    expect((await until(() => terminal(jobOf(side!, testJob)), 15_000)).state).toBe('completed');
    const provider = side.runtime.models.provider;
    expect(provider.workerPid(TRANSCRIBE_BUNDLE)).not.toBeNull();

    // Aligner missing: the model bundle still counts as installed, and the component reports as missing.
    const aligner = repos[2]!;
    await fs.rm(path.join(side.home.modelsDir, ...aligner.repo.split('/')), { recursive: true });
    const listed = (await side.client.request('models.list', {})).bundles.find((b) => b.bundleId === TRANSCRIBE_BUNDLE)!;
    expect(listed.state).not.toBe('not-installed');
    expect(listed.components!.find((c) => c.component === 'aligner')).toMatchObject({ optional: true, state: 'missing', bytes: null });

    // Installing downloads only the aligner; the installed components are untouched.
    const complete = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    expect(complete.plan.upToDate).toBe(false);
    expect(complete.plan.components.map((c) => [c.component, c.action])).toEqual([
      ['asr', 'keep'],
      ['vad', 'keep'],
      ['aligner', 'download'],
    ]);
    const before = source.requests.length;
    const completed = await side.client.request('models.install', {
      bundleId: TRANSCRIBE_BUNDLE,
      confirmBytes: complete.plan.confirmBytes,
    });
    expect((await until(() => terminal(jobOf(side!, completed.jobId!)))).state).toBe('completed');
    expect(new Set(source.requests.slice(before).filter((r) => r.method === 'GET').map((r) => r.repo))).toEqual(new Set([aligner.repo]));
    // The old Worker has no aligner: idle ones are unloaded, and the next task reloads them.
    await until(() => provider.workerPid(TRANSCRIBE_BUNDLE) === null);
    expect((await side.client.request('models.list', {})).bundles.find((b) => b.bundleId === TRANSCRIBE_BUNDLE)!.components!.map((c) => c.state)).toEqual([
      'installed',
      'installed',
      'installed',
    ]);
  });

  it('「说话人区分」模型包：装好后识别模型包报告能区分说话人；没有单独的检查；识别模型包在用时不能删', async () => {
    side = await startSide(source, free);
    const install = async (bundleId: string) => {
      const plan = (await side!.client.request('models.install', { bundleId })).plan;
      const { jobId } = await side!.client.request('models.install', { bundleId, confirmBytes: plan.confirmBytes });
      expect((await until(() => terminal(jobOf(side!, jobId!)), 15_000)).state).toBe('completed');
    };
    const speakers = async () =>
      (await side!.client.request('models.capabilities', {})).capabilities.transcribe.providers
        .find((p) => p.providerId === 'local')!
        .models.find((m) => m.modelId === TRANSCRIBE_BUNDLE)?.speakers;
    await install(TRANSCRIBE_BUNDLE);
    expect(await speakers()).toBe('none');
    expect(side.models()!.bundles.find((b) => b.bundleId === diarizationDef.bundleId)).toMatchObject({
      capability: 'diarize',
      state: 'not-installed',
    });

    await install(diarizationDef.bundleId);
    expect(await speakers()).toBe('pack');
    const untestable = await side.client.request('models.test', { bundleId: diarizationDef.bundleId }).catch((e: unknown) => e);
    expect(untestable).toBeInstanceOf(RpcError);
    expect(untestable).toMatchObject({ code: 'unsupported' });

    // A slow self-test of the recognition bundle is running: its Worker has this bundle's components loaded, so deletion is rejected.
    await fs.writeFile(side.control, JSON.stringify({ faults: ['slow'] }));
    const { jobId: testJob } = await side.client.request('models.test', { bundleId: TRANSCRIBE_BUNDLE });
    await until(() => jobOf(side!, testJob)?.progress, 10_000);
    const refused = await side.client.request('models.remove', { bundleId: diarizationDef.bundleId }).catch((e: unknown) => e);
    expect(refused).toMatchObject({ code: 'conflict', details: { code: 'MODEL_IN_USE', jobIds: [testJob] } });
    await side.client.request('jobs.cancel', { jobId: testJob });
    await until(() => terminal(jobOf(side!, testJob)));

    const removed = await side.client.request('models.remove', { bundleId: diarizationDef.bundleId });
    expect(removed.removed.sort()).toEqual(diarizationRepos.map((r) => r.repo).sort());
    expect(await speakers()).toBe('none');
  });

  it.skipIf(!appleSilicon)(
    '语音合成模型包：装好后自检合成一句，WAV 能解码、时长合理、有声音才通过；静音判为不通过；删掉默认的那只时清掉默认值',
    async () => {
      side = await startSide(source, free);
      await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'synthesize'] }));
      const plan = (await side.client.request('models.install', { bundleId: SPEECH_BUNDLE })).plan;
      const { jobId } = await side.client.request('models.install', { bundleId: SPEECH_BUNDLE, confirmBytes: plan.confirmBytes });
      expect((await until(() => terminal(jobOf(side!, jobId!)), 15_000)).state).toBe('completed');
      const speechOf = () => side!.models()?.bundles.find((b) => b.bundleId === SPEECH_BUNDLE);
      await until(() => speechOf()?.state === 'installed');
      expect(speechOf()).toMatchObject({ capability: 'synthesize', label: 'VoxCPM2', license: { commercialUse: true } });

      const { jobId: testJob } = await side.client.request('models.test', { bundleId: SPEECH_BUNDLE });
      const tested = await until(() => terminal(jobOf(side!, testJob)), 15_000);
      expect(tested).toMatchObject({ kind: 'modelTest', state: 'completed', bundleId: SPEECH_BUNDLE });
      expect(tested.result).toMatchObject({ artifactId: expect.stringMatching(/^sha256:/) });
      expect(await until(() => speechOf()?.selfTest)).toMatchObject({ state: 'passed', jobId: testJob, detail: '1.00 秒 · 24000 Hz' });

      // Synthesis produced silence: self-test fails, and the reason is recorded on the model bundle.
      await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'synthesize'], faults: ['silent-output'] }));
      const { jobId: silentJob } = await side.client.request('models.test', { bundleId: SPEECH_BUNDLE });
      const silent = await until(() => terminal(jobOf(side!, silentJob)), 15_000);
      expect(silent).toMatchObject({
        state: 'failed',
        error: { code: 'MODEL_SELF_TEST_FAILED', details: { check: 'MODEL_OUTPUT_WRONG' } },
      });
      expect(await until(() => speechOf()?.selfTest?.jobId === silentJob && speechOf()!.selfTest)).toMatchObject({
        state: 'failed',
        detail: '输出是静音',
        code: 'MODEL_OUTPUT_WRONG',
      });

      // Deleting the default synthesis model bundle: speech synthesis has no factory default, so the default pointing to it is cleared too (“not set”), and capabilities.updated is emitted.
      await side.client.request('models.setDefault', { capability: 'synthesizeSpeech', providerId: 'local', modelId: SPEECH_BUNDLE });
      expect((await side.client.request('models.capabilities', {})).capabilities.synthesizeSpeech.default).toEqual({
        providerId: 'local',
        modelId: SPEECH_BUNDLE,
      });
      const eventsBefore = side.modelEvents.length;
      await side.client.request('models.remove', { bundleId: SPEECH_BUNDLE });
      expect((await side.client.request('models.capabilities', {})).capabilities.synthesizeSpeech.default).toBeNull();
      await until(() => side!.models()?.capabilities.synthesizeSpeech.default === null);
      expect(
        side.modelEvents
          .slice(eventsBefore)
          .some((e) => e.type === 'capabilities.updated' && e.capabilities.synthesizeSpeech.default === null),
      ).toBe(true);
    },
  );

  it.skipIf(!appleSilicon)(
    '文生图模型包：装好后自检生成一张 256² 的小图（4 步、固定 seed），PNG 能解码、尺寸对、不是纯色才通过',
    async () => {
      side = await startSide(source, free);
      const runs = path.join(side.dir, 'runs.jsonl');
      await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'image'], record: runs }));
      const plan = (await side.client.request('models.install', { bundleId: IMAGE_BUNDLE })).plan;
      const { jobId } = await side.client.request('models.install', { bundleId: IMAGE_BUNDLE, confirmBytes: plan.confirmBytes });
      expect((await until(() => terminal(jobOf(side!, jobId!)), 15_000)).state).toBe('completed');
      const imageOf = () => side!.models()?.bundles.find((b) => b.bundleId === IMAGE_BUNDLE);
      await until(() => imageOf()?.state === 'installed');
      expect(imageOf()).toMatchObject({ capability: 'image', label: 'Qwen-Image-2.1', license: { commercialUse: false } });
      // After installation, local provides generateImage; there is no factory default, so it is not used unless specified.
      const capabilities = (await side.client.request('models.capabilities', {})).capabilities;
      expect(capabilities.generateImage.providers.find((p) => p.providerId === 'local')).toMatchObject({ available: true });
      expect(capabilities.generateImage.effective).toBeNull();

      const { jobId: testJob } = await side.client.request('models.test', { bundleId: IMAGE_BUNDLE });
      const tested = await until(() => terminal(jobOf(side!, testJob)), 15_000);
      expect(tested).toMatchObject({ kind: 'modelTest', state: 'completed', bundleId: IMAGE_BUNDLE });
      expect(await until(() => imageOf()?.selfTest)).toMatchObject({ state: 'passed', jobId: testJob, detail: '256×256 · 4 步' });
      const [run] = (await fs.readFile(runs, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(run).toMatchObject({ capability: 'image', options: { width: 256, height: 256, steps: 4, seed: 7 } });

      // Output is a solid colour throughout: self-test fails, and the reason is recorded on the model bundle.
      await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'image'], faults: ['flat-output'] }));
      const { jobId: flatJob } = await side.client.request('models.test', { bundleId: IMAGE_BUNDLE });
      const flat = await until(() => terminal(jobOf(side!, flatJob)), 15_000);
      expect(flat).toMatchObject({ state: 'failed', error: { code: 'MODEL_SELF_TEST_FAILED', details: { check: 'MODEL_OUTPUT_WRONG' } } });
      expect(await until(() => imageOf()?.selfTest?.jobId === flatJob && imageOf()!.selfTest)).toMatchObject({
        state: 'failed',
        code: 'MODEL_OUTPUT_WRONG',
        detail: expect.stringContaining('纯色'),
      });
    },
  );

  it.skipIf(!appleSilicon)('人声分离模型包：装好后自检把样本分成两路，等长、人声明显比背景响才通过；人声是静音判为不通过', async () => {
    side = await startSide(source, free);
    await fs.writeFile(side.control, JSON.stringify({ capabilities: ['separate'] }));
    const plan = (await side.client.request('models.install', { bundleId: SEPARATE_BUNDLE })).plan;
    const { jobId } = await side.client.request('models.install', { bundleId: SEPARATE_BUNDLE, confirmBytes: plan.confirmBytes });
    expect((await until(() => terminal(jobOf(side!, jobId!)), 15_000)).state).toBe('completed');
    const separateOf = () => side!.models()?.bundles.find((b) => b.bundleId === SEPARATE_BUNDLE);
    await until(() => separateOf()?.state === 'installed');
    expect(separateOf()).toMatchObject({ capability: 'separate', label: 'HTDemucs-FT', license: { name: 'MIT', commercialUse: true } });
    // Capability view: the factory default for vocal separation is the separation model bundle installed on this machine; it can be set as a user default (the same approach as speech recognition).
    const separateView = async () => (await side!.client.request('models.capabilities', {})).capabilities.separateAudio;
    expect(await separateView()).toMatchObject({
      default: null,
      effective: { providerId: 'local', modelId: SEPARATE_BUNDLE, source: 'factory-default' },
      providers: [
        {
          providerId: 'local',
          available: true,
          models: [{ modelId: SEPARATE_BUNDLE, label: 'HTDemucs-FT', default: true, cost: 'free-local' }],
        },
      ],
    });
    const { default: chosen } = await side.client.request('models.setDefault', { capability: 'separateAudio', providerId: 'local' });
    expect(chosen).toEqual({ providerId: 'local', modelId: SEPARATE_BUNDLE });
    expect((await separateView()).effective).toEqual({ providerId: 'local', modelId: SEPARATE_BUNDLE, source: 'user-default' });

    const { jobId: testJob } = await side.client.request('models.test', { bundleId: SEPARATE_BUNDLE });
    const tested = await until(() => terminal(jobOf(side!, testJob)), 15_000);
    expect(tested, JSON.stringify(tested.error)).toMatchObject({ kind: 'modelTest', state: 'completed', bundleId: SEPARATE_BUNDLE });
    expect(await until(() => separateOf()?.selfTest)).toMatchObject({
      state: 'passed',
      jobId: testJob,
      detail: expect.stringMatching(/^\d+\.\d\d 秒 · 44100 Hz · 人声比背景高 12 dB$/),
    });

    await fs.writeFile(side.control, JSON.stringify({ capabilities: ['separate'], faults: ['silent-output'] }));
    const { jobId: silentJob } = await side.client.request('models.test', { bundleId: SEPARATE_BUNDLE });
    const silent = await until(() => terminal(jobOf(side!, silentJob)), 15_000);
    expect(silent).toMatchObject({ state: 'failed', error: { code: 'MODEL_SELF_TEST_FAILED', details: { check: 'MODEL_OUTPUT_WRONG' } } });
    expect(await until(() => separateOf()?.selfTest?.jobId === silentJob && separateOf()!.selfTest)).toMatchObject({
      state: 'failed',
      detail: '人声是静音',
      code: 'MODEL_OUTPUT_WRONG',
    });
  });

  it.skipIf(!appleSilicon)(
    '检查没通过的原因：加载时文件缺失或损坏是模型文件的问题，资源不足是内存不够；记在模型包上，技术细节里有 Worker 的错误码',
    async () => {
      side = await startSide(source, free);
      await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'synthesize'] }));
      const plan = (await side.client.request('models.install', { bundleId: SPEECH_BUNDLE })).plan;
      const { jobId } = await side.client.request('models.install', { bundleId: SPEECH_BUNDLE, confirmBytes: plan.confirmBytes });
      expect((await until(() => terminal(jobOf(side!, jobId!)), 15_000)).state).toBe('completed');
      const speechOf = () => side!.models()?.bundles.find((b) => b.bundleId === SPEECH_BUNDLE);
      for (const [fault, code] of [
        ['load-fail:MODEL_NOT_INSTALLED', 'MODEL_FILES_DAMAGED'],
        ['load-fail:MODEL_RESOURCE', 'MODEL_OUT_OF_MEMORY'],
      ] as const) {
        // A previous load failure blocked the model bundle: it can be checked again only after it is re-enabled.
        await side.client.request('models.enable', { bundleId: SPEECH_BUNDLE });
        await until(() => speechOf()?.state === 'installed');
        await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'synthesize'], faults: [fault] }));
        const { jobId: loadJob } = await side.client.request('models.test', { bundleId: SPEECH_BUNDLE });
        const failed = await until(() => terminal(jobOf(side!, loadJob)), 15_000);
        expect(failed, fault).toMatchObject({ state: 'failed', error: { code: 'MODEL_SELF_TEST_FAILED', details: { check: code } } });
        const recorded = await until(() => speechOf()?.selfTest?.jobId === loadJob && speechOf()!.selfTest);
        expect(recorded, fault).toMatchObject({ state: 'failed', code });
        expect(recorded.facts, fault).toEqual(expect.arrayContaining([`workerCode: ${fault.slice('load-fail:'.length)}`]));
        expect(recorded.facts!.join('\n'), fault).not.toContain(side.dir);
      }
    },
  );

  it.skipIf(!appleSilicon)(
    '随应用分发的文件不在：自检在提交时以 APP_FILE_MISSING 拒绝（转写的样本、合成的内置音色录音）；执行前才不见的，任务以 APP_FILE_MISSING 失败、不记成自测没通过',
    async () => {
      const assets = path.join(os.tmpdir(), `cuccut-model-assets-${newId('t')}`);
      await fs.cp(resolveModelAssetsDir()!, assets, { recursive: true });
      const saved = process.env[MODEL_ASSETS_ENV];
      try {
        side = await startSide(source, free);
        await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'synthesize'] }));
        for (const bundleId of [TRANSCRIBE_BUNDLE, SPEECH_BUNDLE]) {
          const plan = (await side.client.request('models.install', { bundleId })).plan;
          const { jobId } = await side.client.request('models.install', { bundleId, confirmBytes: plan.confirmBytes });
          expect((await until(() => terminal(jobOf(side!, jobId!)), 15_000)).state).toBe('completed');
        }
        const statusOf = (bundleId: string) => side!.models()?.bundles.find((b) => b.bundleId === bundleId);
        await until(() => statusOf(SPEECH_BUNDLE)?.state === 'installed' && statusOf(TRANSCRIBE_BUNDLE)?.state === 'installed');

        // At submission: the model data directory is empty.
        const empty = path.join(assets, 'empty');
        await fs.mkdir(empty);
        process.env[MODEL_ASSETS_ENV] = empty;
        const jobsBefore = side.jobs()!.jobs.length;
        for (const bundleId of [TRANSCRIBE_BUNDLE, SPEECH_BUNDLE]) {
          const refused = await side.client.request('models.test', { bundleId }).catch((e: unknown) => e);
          expect(refused).toBeInstanceOf(RpcError);
          expect(refused).toMatchObject({ code: 'conflict', details: { code: 'APP_FILE_MISSING', file: expect.stringContaining(empty) } });
          expect((refused as RpcError).message).toContain('重新安装 CucCut');
          expect((refused as RpcError).message).not.toContain(empty);
        }
        expect(side.jobs()!.jobs.length).toBe(jobsBefore);

        // Before execution: the first self-test holds this model bundle's queue (the fake Worker is slowed), and the second waits in line; at this point the built-in voice recording is deleted.
        process.env[MODEL_ASSETS_ENV] = assets;
        await fs.writeFile(side.control, JSON.stringify({ capabilities: ['transcribe', 'synthesize'], faults: ['slow'] }));
        const { jobId: first } = await side.client.request('models.test', { bundleId: SPEECH_BUNDLE });
        await until(() => (jobOf(side!, first)?.progress?.done ?? 0) > 0, 15_000);
        const { jobId: second } = await side.client.request('models.test', { bundleId: SPEECH_BUNDLE });
        await fs.rm(path.join(assets, 'tts-voices'), { recursive: true });
        expect(await until(() => terminal(jobOf(side!, first)), 15_000)).toMatchObject({ state: 'completed' });
        const failed = await until(() => terminal(jobOf(side!, second)), 15_000);
        expect(failed).toMatchObject({
          kind: 'modelTest',
          state: 'failed',
          error: { code: 'APP_FILE_MISSING', details: { check: 'APP_FILE_MISSING' } },
        });
        expect(failed.error!.message).toContain('重新安装 CucCut');
        expect(failed.error!.message).not.toContain(assets);
        // The self-test result on the model bundle is still the first one: an incomplete install does not count as a failed model self-test.
        expect(statusOf(SPEECH_BUNDLE)?.selfTest).toMatchObject({ state: 'passed', jobId: first });
      } finally {
        if (saved === undefined) delete process.env[MODEL_ASSETS_ENV];
        else process.env[MODEL_ASSETS_ENV] = saved;
        await fs.rm(assets, { recursive: true, force: true });
      }
    },
  );

  it('暂停后丢弃：cancelInstall 带 discard 删掉暂存区', async () => {
    side = await startSide(source, free);
    source.throttle(8 * 1024, 20);
    const { plan } = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE });
    const { jobId } = await side.client.request('models.install', { bundleId: TRANSCRIBE_BUNDLE, confirmBytes: plan.confirmBytes });
    await until(() => (jobOf(side!, jobId!)?.progress?.done ?? 0) > 10_000);
    const result = await side.client.request('models.cancelInstall', { bundleId: TRANSCRIBE_BUNDLE, discard: true });
    expect(result.bundle.install).toBeUndefined();
    expect(await fs.readdir(side.home.modelsDir)).toEqual([]);
  });

  it('智能体的下载工具：先给大小、按 command 确认，结果带大小；MCP 对外服务没有安装与删除', async () => {
    side = await startSide(source, free);
    const { project } = await side.client.request('projects.create', { name: '模型安装' });
    const {
      conversation: { id: conversationId },
    } = await side.client.request('conversations.create', { projectId: project.id });
    await side.client.request('conversations.send', {
      conversationId,
      text: '转写',
      commandId: newId('cmd'),
      accessMode: 'autoAcceptEdits',
    });
    const session = await until(() => side!.driver.sessions[0]);
    await until(() => session.turnId);

    const listed = await mcp(session, 'tools/list');
    expect((listed.result!.tools as { name: string }[]).map((t) => t.name)).toContain('models_install');

    const calling = tool(session, 'models_install', {});
    const pending = await until(() => side!.runtime.harness.approvals.pending()[0]);
    expect(pending).toMatchObject({ action: { name: 'models_install' }, risk: 'command' });
    expect(JSON.stringify(pending)).toContain(source.endpoint);
    expect((await side.client.request('jobs.list', {})).jobs).toEqual([]);
    await side.client.request('approvals.respond', { approvalId: pending.approvalId, decision: 'allow' });
    const result = await calling;
    expect(result.isError).toBe(false);
    expect(result.body).toMatchObject({
      jobId: expect.stringMatching(/^job_/),
      bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
      downloadBytes: DEFAULT_TOTAL,
      size: expect.stringMatching(/KB$/),
      source: source.endpoint,
      approval: { mode: 'autoAcceptEdits', risk: 'command', decidedBy: 'user' },
    });
    const job = await until(() => terminal(jobOf(side!, result.body.jobId)));
    expect(job).toMatchObject({ kind: 'modelInstall', state: 'completed', submitter: { kind: 'agent' } });

    // Already installed: no further confirmation, and jobId is null.
    const again = await tool(session, 'models_install', {});
    expect(again.body).toMatchObject({ jobId: null, downloadBytes: 0 });
    expect(side.runtime.harness.approvals.pending()).toEqual([]);
  });
});
