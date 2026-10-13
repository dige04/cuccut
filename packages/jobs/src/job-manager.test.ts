import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type EditOperation, type JobRecord, type JobState } from '@cuccut/protocol';
import { FileCredentialStore } from '@cuccut/runtime-storage';
import {
  DEFAULT_TRANSCRIBE_BUNDLE,
  LocalProviderSource,
  MANIFEST_FILE,
  ModelCatalog,
  ModelServiceStore,
  ModelServices,
  ProviderFailure,
  type BundleDefinition,
  type ProviderSource,
  type TranscribeAttempt,
  type TranscribeProvider,
  type TranscribeRun,
  type TranscribeSink,
} from '@cuccut/models';
import { JobLedger } from './job-ledger.ts';
import { JobManager, type FileJobOutput, type FileTranscribeRequest, type JobVideos } from './job-manager.ts';
import { LocalTranscribeProvider } from './local-provider.ts';
import { FAKE_MODEL_WORKER } from './index.ts';

/**
 * JobManager and the local Provider, run against a fake Model Worker (`testing/fake-model-worker.ts`).
 * Faults are injected through a `#` suffix on the model package ID. The model catalog is a synthetic small file and manifest.
 */

const COMPONENTS: BundleDefinition['components'] = {
  asr: { family: 'qwen3-asr', repo: 'test/asr', revision: 'r-asr' },
  vad: { family: 'silero-vad', repo: 'test/vad', revision: 'r-vad' },
};
const FAULTS = [
  '',
  '#crash-once',
  '#crash-on-run',
  '#hang-on-cancel,slow',
  '#slow',
  '#slow-load',
  '#invalid-output',
  '#load-fail:MODEL_NOT_INSTALLED',
  '#no-speech',
];
/** The “speaker diarization” model package. Once installed, the fake model package's Worker carries its component, and the fake Worker uses it to tag speakers on segments and words. */
const FAKE_DIARIZATION: BundleDefinition = {
  bundleId: 'fake-diarization@cpu',
  capability: 'diarize',
  backend: 'candle',
  device: 'cpu',
  label: 'Fake Diarization',
  components: {
    segmentation: { family: 'pyannote-segmentation', repo: 'test/segmentation', revision: 'r-seg' },
    speaker: { family: 'wespeaker', repo: 'test/speaker', revision: 'r-spk' },
  },
};
const BUNDLES: BundleDefinition[] = [
  ...FAULTS.map((suffix): BundleDefinition => ({
    bundleId: `fake@cpu${suffix}`,
    capability: 'transcribe',
    backend: 'candle',
    device: 'cpu',
    label: 'Fake',
    components: COMPONENTS,
    diarization: FAKE_DIARIZATION.bundleId,
  })),
  FAKE_DIARIZATION,
  // A model package that segments by itself and does not accept recognition prompts (like MOSS).
  {
    bundleId: 'fake-moss@cpu',
    capability: 'transcribe',
    backend: 'candle',
    device: 'cpu',
    label: 'Fake MOSS',
    components: { asr: { family: 'moss-transcribe-diarize', repo: 'test/asr', revision: 'r-asr' } },
  },
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

/** In-memory video: one asset, and it records leases and submitted edits. */
class FakeVideos implements JobVideos {
  leases = 0;
  revision = 7;
  contentHash = 'sha256:' + 'a'.repeat(64);
  applied: Array<{ commandId: string; expectedRevision: string; operations: EditOperation[] }> = [];
  file: string;

  constructor(file: string) {
    this.file = file;
  }

  retain(): void {
    this.leases++;
  }

  release(): void {
    this.leases--;
  }

  async source(videoId: string, assetId: string) {
    if (videoId !== 'mov_1') throw new RpcError('not-found', '视频没有打开');
    if (assetId !== 'ast_1') throw new RpcError('not-found', '素材不存在');
    return { file: this.file, revision: '1', contentHash: this.contentHash, mediaType: 'audio/wav' };
  }

  current() {
    return { videoRevision: String(this.revision), asset: { revision: '1', contentHash: this.contentHash } };
  }

  videoRevision(videoId: string) {
    return videoId === 'mov_1' ? String(this.revision) : null;
  }

  async apply(_videoId: string, request: { commandId: string; expectedRevision: string; operations: EditOperation[] }) {
    this.applied.push(request);
    this.revision++;
    return { refs: { speech: 'doc_speech' } };
  }
}

/**
 * Fake remote node Provider (id `node`): records each attempt and executes according to the `next` script. On completion it borrows the local Provider to produce a real result in staging (`runGeneration` can be replaced by the node's own attempt sequence number). It is used to check the JobManager's routing, queue and failure normalization.
 */
class FakeNodeProvider implements TranscribeProvider {
  readonly id = 'node';
  readonly runs: TranscribeRun[] = [];
  next: (run: TranscribeRun, sink: TranscribeSink, signal: AbortSignal) => Promise<TranscribeAttempt>;

  constructor(local: () => LocalTranscribeProvider) {
    this.next = (run, sink, signal) => local().transcribe({ ...run, bundleId: 'fake@cpu' }, sink, signal);
  }

  transcribe(run: TranscribeRun, sink: TranscribeSink, signal: AbortSignal): Promise<TranscribeAttempt> {
    this.runs.push(run);
    return this.next(run, sink, signal);
  }

  async close(): Promise<void> {}
}

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Node source for tests: every node that `resolveNode` recognizes is online, and accepts any model package. */
function fakeNodeSource(remote: TranscribeProvider, resolveNode: (node: string) => string | null): ProviderSource {
  const resolve = (providerId: string) => {
    const nodeId = providerId.startsWith('node:') ? resolveNode(providerId.slice('node:'.length)) : null;
    return nodeId ? `node:${nodeId}` : null;
  };
  const view = (providerId: string) => ({
    providerId,
    kind: 'node' as const,
    label: providerId,
    config: null,
    capabilities: {
      transcribe: {
        models: [
          {
            modelId: DEFAULT_TRANSCRIBE_BUNDLE,
            label: DEFAULT_TRANSCRIBE_BUNDLE,
            default: true,
            maxInputBytes: null,
            maxDurationSec: null,
            wordTimestamps: 'native' as const,
            languages: 'any' as const,
            acceptsHint: true,
            cost: 'free-local' as const,
          },
        ],
        available: true,
      },
    },
  });
  return {
    kind: 'node',
    owns: (providerId) => providerId.startsWith('node:'),
    resolve,
    list: async () => [view('node:node_a')],
    describe: async (providerId) => (resolve(providerId) ? view(resolve(providerId)!) : null),
    transcriber: () => remote,
    queue: (providerId) => ({ key: providerId, concurrency: 1 }),
    executors: () => [remote],
  };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('JobManager (fake Model Worker)', () => {
  let dir: string;
  let paths: { jobsFile: string; stagingDir: string; artifactsDir: string; diagnosticsDir: string };
  let catalog: ModelCatalog;
  let videos: FakeVideos;
  let provider: LocalTranscribeProvider;
  let manager: JobManager;
  let events: JobRecord[];

  async function start(
    options: {
      idleMs?: number;
      crashLimit?: number;
      crashWindowMs?: number;
      remote?: TranscribeProvider;
      resolveNode?: (node: string) => string | null;
      /** Contents of the fake Worker's control file (`capabilities`, `transcribeFamilies`, etc.). */
      control?: object;
    } = {},
  ) {
    catalog = new ModelCatalog({ root: path.join(dir, 'models'), bundles: BUNDLES });
    const controlArgs: string[] = [];
    if (options.control) {
      const controlFile = path.join(dir, 'control.json');
      await fs.writeFile(controlFile, JSON.stringify(options.control));
      controlArgs.push('--control', controlFile);
    }
    provider = new LocalTranscribeProvider({
      catalog,
      command: () => ({ command: process.execPath, args: [FAKE_MODEL_WORKER, ...controlArgs] }),
      env: async () => process.env,
      idleMs: options.idleMs ?? 60_000,
      // When not given, use the Provider's default (3 times within 5 minutes).
      ...(options.crashLimit !== undefined ? { crashLimit: options.crashLimit } : {}),
      ...(options.crashWindowMs !== undefined ? { crashWindowMs: options.crashWindowMs } : {}),
      cancelGraceMs: 5_000,
    });
    const store = await ModelServiceStore.open(
      { modelServicesFile: path.join(dir, 'store', 'model-services.json') },
      new FileCredentialStore(path.join(dir, 'store', 'model-credentials.json')),
    );
    const sources: ProviderSource[] = [new LocalProviderSource({ catalog, transcriber: provider })];
    if (options.remote) sources.push(fakeNodeSource(options.remote, options.resolveNode ?? (() => null)));
    manager = new JobManager({ paths, catalog, router: new ModelServices({ store, sources }), videos });
    await manager.open();
    events = [];
    manager.onChange((job) => events.push(job));
  }

  const submit = (bundleId = 'fake@cpu', extra: object = {}) =>
    manager.submitTranscribe({ videoId: 'mov_1', assetId: 'ast_1', bundleId, ...extra }, { kind: 'connection', id: 'conn_1' });

  async function run(bundleId = 'fake@cpu'): Promise<JobRecord> {
    const { jobId } = await submit(bundleId);
    await manager.settled(jobId);
    return manager.inspect(jobId);
  }

  const stagingOf = (jobId: string) => path.join(paths.stagingDir, 'jobs', jobId);
  const exists = (file: string) =>
    fs.stat(file).then(
      () => true,
      () => false,
    );

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-jobs-'));
    paths = {
      jobsFile: path.join(dir, 'store', 'jobs.jsonl'),
      stagingDir: path.join(dir, 'staging'),
      artifactsDir: path.join(dir, 'artifacts'),
      diagnosticsDir: path.join(dir, 'logs', 'diagnostics'),
    };
    await writeRepo(path.join(dir, 'models'), 'test/asr', 'r-asr');
    await writeRepo(path.join(dir, 'models'), 'test/vad', 'r-vad');
    const audio = path.join(dir, 'audio.wav');
    await fs.writeFile(audio, 'not really audio');
    videos = new FakeVideos(audio);
  });

  afterEach(async () => {
    await manager?.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('first GPU kernel compilation takes over 5 seconds: on Intel Mac, wait for the handshake to complete; other platforms keep the original deadline', async () => {
    await start({ control: { helloDelayMs: 5500 } });
    const job = await run();
    if (process.platform === 'darwin' && process.arch === 'x64') {
      expect(job.state).toBe('completed');
      expect(job.error).toBeNull();
    } else {
      expect(job.state).toBe('failed');
      expect(job.error?.details).toMatchObject({ detail: 'hello-timeout' });
    }
  }, 15_000);

  it('completion: writes the speech document, publishes the raw result, deletes staging, topic events are in order', async () => {
    await start();
    const job = await run();
    expect(job).toMatchObject({
      state: 'completed',
      phase: 'done',
      attempt: 1,
      error: null,
      kind: 'transcribe',
      providerId: 'local',
      bundleId: 'fake@cpu',
      assetRevision: '1',
      contentHash: videos.contentHash,
      submitter: { kind: 'connection', id: 'conn_1' },
      result: { documentId: 'doc_speech', artifactId: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) },
      warnings: [],
    });
    expect(job.inputHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    // Apply: one putDocument, based on the video revision at that time.
    expect(videos.applied).toHaveLength(1);
    expect(videos.applied[0]!.expectedRevision).toBe('7');
    const op = videos.applied[0]!.operations[0] as Extract<EditOperation, { type: 'putDocument' }>;
    const body = op.body as { words: Array<{ id: string; start: number; end: number; text: string }> } & Record<string, unknown>;
    expect(op).toMatchObject({
      type: 'putDocument',
      ref: 'speech',
      kind: 'speech',
      name: '转写',
      language: 'en',
      sourceAsset: { assetId: 'ast_1' },
    });
    expect(body).toMatchObject({
      schema: 'cuccut.speech/1',
      clock: 'source-asset',
      timescale: 1_000_000,
      engine: {
        provider: 'local',
        bundleId: 'fake@cpu',
        models: { asr: { family: 'qwen3-asr', revision: 'r-asr' }, vad: { family: 'silero-vad', revision: 'r-vad' } },
        backend: 'candle',
        device: 'cpu',
        workerVersion: '0.0.0-fake',
      },
      speakers: [],
      sentences: null,
      chapters: [],
    });
    expect(typeof body.createdAt).toBe('string');
    expect(body.words.map((w) => w.text).join(' ')).toBe('testing one two three cuccut is ready');
    expect(body.words[0]).toEqual({ id: 'w-000001', start: 0, end: 400_000, text: 'testing', timingQuality: 'estimated' });
    expect(body.words[6]!.id).toBe('w-000007');
    expect(op.summary).toEqual({ wordCount: 7, speakerCount: 0, sentenceCount: null, chapterCount: 0, language: 'en' });
    expect(op.extensions).toMatchObject({
      rawResultArtifactId: job.result!.artifactId,
      asrOutcome: 'transcribed',
      language: { tag: 'en', source: 'detected', confidence: 0.87 },
      warnings: [],
      inputHash: job.inputHash,
    });

    // Artifacts and staging
    const artifact = path.join(paths.artifactsDir, `${job.result!.artifactId.slice('sha256:'.length)}.json`);
    expect(JSON.parse(await fs.readFile(artifact, 'utf8'))).toMatchObject({ schema: 'cuccut.asr-result/v1', outcome: 'transcribed' });
    expect(await exists(stagingOf(job.jobId))).toBe(false);
    expect(videos.leases).toBe(0);

    // Topic events: queued → running (load, recognize, validate, publish, apply) → completed
    const states = events.map((e) => e.state).filter((s, i, all) => s !== all[i - 1]);
    expect(states).toEqual(['queued', 'running', 'completed']);
    const phases = events.map((e) => e.phase).filter((p, i, all) => p !== all[i - 1]);
    expect(phases).toEqual(
      expect.arrayContaining(['queued', 'starting', 'loading', 'transcribing', 'validating', 'publishing', 'applying', 'done']),
    );
    expect(phases.indexOf('transcribing')).toBeLessThan(phases.indexOf('applying'));
    expect(events.some((e) => e.progress?.unit === 'segments' && e.progress.total === 3)).toBe(true);

    // Ledger
    const ledger = { jobs: await new JobLedger(paths.jobsFile).load() };
    expect(ledger.jobs[0]!.record).toMatchObject({ jobId: job.jobId, state: 'completed' });
    expect(manager.list('mov_1').map((j) => j.jobId)).toEqual([job.jobId]);
    expect(manager.list('other')).toEqual([]);
  });

  it('speaker diarization: without a diarize setting, follows the model; if the \'speaker diarization\' model pack is installed, diarization happens and speakers go into the speech document; explicitly turned off means no diarization', async () => {
    await start();
    // Each task waits until it finishes before the next one is submitted, so the last applied one is its speech document.
    const lastSpeech = () => {
      const op = videos.applied.at(-1)!.operations[0];
      return (op as Extract<EditOperation, { type: 'putDocument' }>).body as {
        speakers: Array<{ id: string; name: string }>;
        words: Array<{ text: string; speaker?: string }>;
      };
    };
    // Not installed: no diarization, and no warning. When diarization is explicitly requested, report diarization-unavailable.
    const plain = await run();
    expect(plain.warnings).toEqual([]);
    expect(lastSpeech().speakers).toEqual([]);
    // The record holds the requested language and the effective speaker diarization (the model line on the video card reads it).
    expect(plain.transcribe).toEqual({ language: { mode: 'prefer', tag: null }, diarize: false });
    const { jobId: wanted } = await submit('fake@cpu', { diarize: true });
    await manager.settled(wanted);
    expect(manager.inspect(wanted).warnings).toEqual([{ code: 'diarization-unavailable' }]);
    expect(manager.inspect(wanted).transcribe?.diarize).toBe(true);

    await writeRepo(path.join(dir, 'models'), 'test/segmentation', 'r-seg');
    await writeRepo(path.join(dir, 'models'), 'test/speaker', 'r-spk');
    await provider.unload('fake@cpu');
    const { jobId } = await submit('fake@cpu', { hint: 'with speakers' });
    await manager.settled(jobId);
    const job = manager.inspect(jobId);
    expect(job).toMatchObject({ state: 'completed', warnings: [], transcribe: { diarize: true } });
    const body = lastSpeech();
    expect(body.speakers).toEqual([
      { id: 'spk-1', name: '说话人 1' },
      { id: 'spk-2', name: '说话人 2' },
    ]);
    expect(body.words.map((w) => w.speaker)).toEqual(['spk-1', 'spk-1', 'spk-1', 'spk-2', 'spk-2', 'spk-2', 'spk-1']);

    const { jobId: off } = await submit('fake@cpu', { hint: 'without speakers', diarize: false });
    await manager.settled(off);
    expect(manager.inspect(off).warnings).toEqual([]);
    expect(manager.inspect(off).transcribe?.diarize).toBe(false);
    expect(lastSpeech().speakers).toEqual([]);
  });

  it('model does not accept recognition hints: transcription proceeds as usual, the hint is not passed to the model, and the task carries a hint-ignored warning from queueing to completion', async () => {
    await start();
    const { jobId } = await submit('fake-moss@cpu', { hint: '人名：山田', diarize: false });
    const queued = manager.inspect(jobId).warnings;
    expect(queued).toEqual([expect.objectContaining({ code: 'hint-ignored', detail: expect.stringContaining('Fake MOSS') })]);
    await manager.settled(jobId);
    const job = manager.inspect(jobId);
    expect(job.state).toBe('completed');
    expect(job.warnings).toEqual(queued);
    // The prompt is not part of the input: the same submission without a prompt has the same input digest, and no reminder.
    const { jobId: plain } = await submit('fake-moss@cpu', { diarize: false });
    await manager.settled(plain);
    expect(manager.inspect(plain)).toMatchObject({ state: 'completed', inputHash: job.inputHash, warnings: [] });
  });

  it('in-flight tasks with the same input are deduplicated; commandId is deduplicated; different input is a new task', async () => {
    await start();
    const first = await submit('fake@cpu#slow');
    expect(await submit('fake@cpu#slow')).toEqual(first);
    const other = await submit('fake@cpu#slow', { language: { mode: 'assert', tag: 'zh-cn' } });
    expect(other.jobId).not.toBe(first.jobId);
    const byCommand = await submit('fake@cpu', { commandId: 'cmd_x' });
    expect(await submit('fake@cpu', { commandId: 'cmd_x', hint: 'different' })).toEqual(byCommand);
    expect(manager.inspect(other.jobId).state).toBe('queued');
    for (const jobId of [first.jobId, other.jobId, byCommand.jobId]) await manager.cancel(jobId);
    expect(videos.leases).toBe(0);
  });

  it('validation at submission: unknown model pack, unavailable model pack, invalid language tag', async () => {
    await start();
    await expect(submit('nope')).rejects.toMatchObject({ code: 'not-found' });
    await expect(submit('fake@cpu', { language: { mode: 'assert', tag: '???' } })).rejects.toMatchObject({ code: 'invalid-request' });
    await expect(
      manager.submitTranscribe({ videoId: 'mov_2', assetId: 'ast_1', bundleId: 'fake@cpu' }, { kind: 'system', id: 'rt' }),
    ).rejects.toMatchObject({
      code: 'not-found',
    });
    await fs.rm(path.join(dir, 'models', 'test', 'vad'), { recursive: true });
    const error = await submit().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    // An explicitly specified local model package that is not installed is rejected at submission with `CAPABILITY_NOT_CONFIGURED`, and no task is created (§6.2).
    expect(error).toMatchObject({
      code: 'conflict',
      details: { code: 'CAPABILITY_NOT_CONFIGURED', reason: 'not-installed', providerId: 'local', remedy: { action: 'install-model' } },
    });
    expect(manager.list()).toEqual([]);
  });

  it('cancel: the Worker stops at a segment boundary and confirms; the process and model stay loaded, and the next task uses them directly', async () => {
    await start();
    const { jobId } = await submit('fake@cpu#slow');
    await until(() => manager.inspect(jobId).progress);
    const pid = provider.workerPid('fake@cpu#slow')!;
    const started = Date.now();
    expect(await manager.cancel(jobId)).toEqual({ state: 'cancelled' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(manager.inspect(jobId)).toMatchObject({ state: 'cancelled', result: null, error: null });
    expect(await exists(stagingOf(jobId))).toBe(false);
    expect(alive(pid)).toBe(true);
    expect((await catalog.status('fake@cpu#slow'))!.state).toBe('ready');
    expect(videos.leases).toBe(0);
    expect(await manager.cancel(jobId)).toEqual({ state: 'cancelled' });
  });

  it('cancel: the Worker confirms but does not stop; when the deadline passes the process is ended, and the next task starts a new process on demand', async () => {
    await start();
    const bundle = 'fake@cpu#hang-on-cancel,slow';
    const { jobId } = await submit(bundle);
    await until(() => manager.inspect(jobId).progress);
    const pid = provider.workerPid(bundle)!;
    const started = Date.now();
    expect(await manager.cancel(jobId)).toEqual({ state: 'cancelled' });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThan(4_500);
    expect(elapsed).toBeLessThan(6_500);
    await until(() => !alive(pid));
    expect(provider.workerPid(bundle)).toBeNull();
    expect((await catalog.status(bundle))!.state).toBe('installed');
    const next = await run(bundle);
    expect(next.state).toBe('completed');
    expect(provider.workerPid(bundle)).not.toBe(pid);
  }, 30_000);

  it('cancel during model loading: the task is cancelled immediately, and loading completes in the background', async () => {
    await start();
    const { jobId } = await submit('fake@cpu#slow-load');
    await until(() => manager.inspect(jobId).phase === 'loading');
    const started = Date.now();
    expect(await manager.cancel(jobId)).toEqual({ state: 'cancelled' });
    expect(Date.now() - started).toBeLessThan(500);
    await until(async () => (await catalog.status('fake@cpu#slow-load'))!.state === 'ready');
    expect(provider.workerPid('fake@cpu#slow-load')).not.toBeNull();
  });

  it('crashes once: marked interrupted, automatically retried, completes as attempt 2', async () => {
    await start();
    const job = await run('fake@cpu#crash-once');
    expect(job).toMatchObject({ state: 'completed', attempt: 2, error: null, result: { documentId: 'doc_speech' } });
    const states = events.map((e) => e.state).filter((s, i, all) => s !== all[i - 1]);
    expect(states).toEqual(['queued', 'running', 'interrupted', 'running', 'completed']);
    const interrupted = events.find((e) => e.state === 'interrupted')!;
    expect(interrupted).toMatchObject({ attempt: 1, error: { code: 'MODEL_WORKER_CRASHED' } });
  });

  it('repeated crashes: MODEL_WORKER_CRASHED after two attempts; by default the 3rd crash within 5 minutes disables the model pack, and enable restores it', async () => {
    // The default limit and window count crashes, not tasks: the first task retries automatically once, so it uses two.
    await start();
    const first = await run('fake@cpu#crash-on-run');
    expect(first).toMatchObject({ state: 'failed', attempt: 2, error: { code: 'MODEL_WORKER_CRASHED' } });
    const details = first.error!.details as { stderrTail: string; exitCode: number };
    expect(details.stderrTail).toContain('模拟崩溃');
    expect(details.exitCode).toBe(70);
    expect(await exists(stagingOf(first.jobId))).toBe(false);

    // A third crash deactivates the model package: this task is not retried.
    const second = await run('fake@cpu#crash-on-run');
    expect(second).toMatchObject({ state: 'failed', attempt: 1, error: { code: 'MODEL_WORKER_CRASHED' } });
    expect(await catalog.status('fake@cpu#crash-on-run')).toMatchObject({ state: 'error', reason: 'resource' });
    await expect(submit('fake@cpu#crash-on-run')).rejects.toMatchObject({ code: 'conflict' });

    manager.enable('fake@cpu#crash-on-run');
    expect(await catalog.status('fake@cpu#crash-on-run')).toMatchObject({ state: 'installed' });
    const third = await run('fake@cpu#crash-on-run');
    expect(third.attempt).toBe(2);
  });

  it('crash window: crashes outside the window do not accumulate, and the model pack is not disabled', async () => {
    await start({ crashWindowMs: 1_000 });
    const first = await run('fake@cpu#crash-on-run');
    expect(first).toMatchObject({ state: 'failed', attempt: 2, error: { code: 'MODEL_WORKER_CRASHED' } });
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    // Only this task's two crashes remain in the window: it still retries automatically, and the model package remains usable.
    const second = await run('fake@cpu#crash-on-run');
    expect(second).toMatchObject({ state: 'failed', attempt: 2, error: { code: 'MODEL_WORKER_CRASHED' } });
    expect(await catalog.status('fake@cpu#crash-on-run')).toMatchObject({ state: 'installed' });
    expect((await submit('fake@cpu#crash-on-run')).jobId).toMatch(/^job_/);
  });

  it('output violates the contract: MODEL_OUTPUT_INVALID, not retried, raw result kept in the diagnostics directory', async () => {
    await start();
    const job = await run('fake@cpu#invalid-output');
    expect(job).toMatchObject({ state: 'failed', attempt: 1, error: { code: 'MODEL_OUTPUT_INVALID' }, result: null });
    expect((job.error!.details as { problems: string[] }).problems).toContain('segments[1] 与前一段重叠或没有按 start 递增');
    const kept = path.join(paths.diagnosticsDir, job.jobId, 'result.json');
    expect(JSON.parse(await fs.readFile(kept, 'utf8'))).toMatchObject({ schema: 'cuccut.asr-result/v1' });
    expect(await exists(path.join(paths.diagnosticsDir, job.jobId, 'job.json'))).toBe(true);
    expect(await exists(stagingOf(job.jobId))).toBe(false);
    expect(videos.applied).toEqual([]);
  });

  it('load failure: MODEL_LOAD_FAILED, not retried, the model pack is recorded as not installed', async () => {
    await start();
    const job = await run('fake@cpu#load-fail:MODEL_NOT_INSTALLED');
    expect(job).toMatchObject({
      state: 'failed',
      attempt: 1,
      error: { code: 'MODEL_LOAD_FAILED', details: { reason: 'not-installed', workerCode: 'MODEL_NOT_INSTALLED' } },
    });
    expect(await catalog.status('fake@cpu#load-fail:MODEL_NOT_INSTALLED')).toMatchObject({ state: 'not-installed', reason: 'load-failed' });
    expect(provider.workerPid('fake@cpu#load-fail:MODEL_NOT_INSTALLED')).toBeNull();
  });

  it('Worker does not list the asr family or does not declare transcribe: capability-missing, no model.load is sent, and the model pack is not disabled', async () => {
    for (const control of [{ transcribeFamilies: ['whisper-coreml'] }, { capabilities: ['synthesize'] }]) {
      await manager?.shutdown();
      await start({ control });
      const job = await run();
      expect(job).toMatchObject({
        state: 'failed',
        attempt: 1,
        error: {
          code: 'MODEL_LOAD_FAILED',
          details: expect.objectContaining({ reason: 'unsupported', detail: 'capability-missing', family: 'qwen3-asr' }),
        },
      });
      expect(catalog.blocked('fake@cpu')).toBe(false);
      expect(await catalog.status('fake@cpu')).toMatchObject({ state: 'installed' });
    }
  });

  it('idle unload: after idleMs, model.unload is sent and the process is closed', async () => {
    // Publishing the result and writing to disk may take longer than 200 ms. Leave time to check the alive state after completion, then verify the idle exit.
    await start({ idleMs: 1000 });
    await run();
    const pid = provider.workerPid('fake@cpu')!;
    expect(alive(pid)).toBe(true);
    expect((await catalog.status('fake@cpu'))!.state).toBe('ready');
    await until(() => !alive(pid), 3000);
    expect(provider.workerPid('fake@cpu')).toBeNull();
    await until(async () => (await catalog.status('fake@cpu'))!.state === 'installed');
    // The next task is started on demand.
    expect((await run()).state).toBe('completed');
  });

  it('no speech: completes without writing a document, and the result kind is recorded in warnings', async () => {
    await start();
    const job = await run('fake@cpu#no-speech');
    expect(job).toMatchObject({ state: 'completed', result: { documentId: null }, warnings: [{ code: 'no-speech' }] });
    expect(job.result!.artifactId).toMatch(/^sha256:/);
    expect(videos.applied).toEqual([]);
  });

  it('media changed during transcription: STALE_JOB_INPUT, artifact kept, no document written', async () => {
    await start();
    const { jobId } = await submit('fake@cpu#slow');
    await until(() => manager.inspect(jobId).progress);
    videos.contentHash = 'sha256:' + 'b'.repeat(64);
    await manager.settled(jobId);
    const job = manager.inspect(jobId);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'STALE_JOB_INPUT' }, result: { documentId: null } });
    expect(await exists(path.join(paths.artifactsDir, `${job.result!.artifactId.slice(7)}.json`))).toBe(true);
    expect(videos.applied).toEqual([]);
  }, 15_000);

  it('startup reconciliation: tasks running at last run are marked interrupted, and staging directories that do not belong to in-flight tasks are deleted', async () => {
    const record = (jobId: string, state: JobState): JobRecord => ({
      jobId,
      kind: 'transcribe',
      state,
      phase: 'transcribing',
      progress: null,
      videoId: 'mov_1',
      assetId: 'ast_1',
      assetRevision: '1',
      contentHash: 'sha256:x',
      bundleId: 'fake@cpu',
      providerId: 'local',
      modelId: 'fake@cpu',
      inputHash: 'sha256:y',
      submitter: { kind: 'connection', id: 'c' },
      attempt: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      startedAt: null,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
    });
    const spec = {
      contentHash: 'sha256:x',
      track: 0,
      range: null,
      language: { mode: 'prefer', tag: null },
      bundleId: 'fake@cpu',
      diarize: false,
      hint: null,
      outputContract: 'cuccut.asr-result/v1',
    };
    // Old-format `jobs.json`: imported into `jobs.jsonl` at startup, and the old file is renamed `.migrated`.
    const legacy = path.join(path.dirname(paths.jobsFile), 'jobs.json');
    await fs.mkdir(path.dirname(paths.jobsFile), { recursive: true });
    await fs.writeFile(
      legacy,
      JSON.stringify({
        formatVersion: 1,
        jobs: [
          { record: record('job_running', 'running'), spec, workerVersion: null },
          { record: record('job_done', 'completed'), spec, workerVersion: null },
        ],
      }),
    );
    for (const name of ['job_running', 'job_done', 'job_unknown']) {
      await fs.mkdir(stagingOf(name), { recursive: true });
      await fs.writeFile(path.join(stagingOf(name), 'segments.jsonl'), '{}\n');
    }
    await start();
    expect(manager.inspect('job_running')).toMatchObject({ state: 'interrupted', error: { code: 'JOB_INTERRUPTED' } });
    expect(manager.inspect('job_done').state).toBe('completed');
    for (const name of ['job_running', 'job_done', 'job_unknown']) expect(await exists(stagingOf(name))).toBe(false);
    expect(await exists(legacy)).toBe(false);
    expect(await exists(`${legacy}.migrated`)).toBe(true);
    const jobs = await new JobLedger(paths.jobsFile).load();
    expect(jobs.map((j) => j.record.state)).toEqual(['interrupted', 'completed']);
  });

  it('artifact references: artifact ids appearing in results, outputs and frozen specs of tasks in any state in the ledger all count', async () => {
    const result = `sha256:${'a'.repeat(64)}`;
    const output = `sha256:${'b'.repeat(64)}`;
    const inSpec = `sha256:${'c'.repeat(64)}`;
    const base = {
      kind: 'transcribe',
      phase: 'transcribing',
      progress: null,
      videoId: 'mov_1',
      assetId: 'ast_1',
      assetRevision: '1',
      contentHash: 'sha256:x',
      bundleId: 'fake@cpu',
      providerId: 'local',
      modelId: 'fake@cpu',
      inputHash: 'sha256:y',
      submitter: { kind: 'connection', id: 'c' },
      attempt: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      startedAt: null,
      endedAt: '2026-01-01T00:00:00.000Z',
      error: null,
      warnings: [],
    };
    const spec = { contentHash: 'sha256:x', track: 0, range: null, language: { mode: 'prefer', tag: null }, bundleId: 'fake@cpu' };
    await fs.mkdir(path.dirname(paths.jobsFile), { recursive: true });
    await fs.writeFile(
      path.join(path.dirname(paths.jobsFile), 'jobs.json'),
      JSON.stringify({
        formatVersion: 1,
        jobs: [
          {
            record: { ...base, jobId: 'job_done', state: 'completed', result: { documentId: null, artifactId: result, outputs: [{ artifactId: output }] } },
            spec,
            workerVersion: null,
          },
          { record: { ...base, jobId: 'job_failed', state: 'failed', result: null }, spec: { ...spec, reference: inSpec }, workerVersion: null },
        ],
      }),
    );
    await start();
    expect([...manager.referencedArtifactIds()].sort()).toEqual([result, output, inSpec]);
  });

  it('stop: in-flight tasks marked interrupted, and the Worker process exits', async () => {
    await start();
    const { jobId } = await submit('fake@cpu#slow');
    const queued = await submit('fake@cpu#slow', { hint: 'another' });
    await until(() => manager.inspect(jobId).progress);
    const pid = provider.workerPid('fake@cpu#slow')!;
    await manager.shutdown();
    expect(manager.inspect(jobId)).toMatchObject({ state: 'interrupted', error: { code: 'JOB_INTERRUPTED' } });
    expect(manager.inspect(queued.jobId).state).toBe('interrupted');
    expect(alive(pid)).toBe(false);
    expect(videos.leases).toBe(0);
    await expect(submit()).rejects.toMatchObject({ code: 'busy' });
  });

  describe('live segments (job.segments)', () => {
    type Update = { jobId: string; from: number; segments: Array<{ start: number; end: number; text: string }> };
    let updates: Update[];
    const listen = () => {
      updates = [];
      manager.onSegments((update) => updates.push(update));
    };

    it('notifies per segment, from increments, tick converted to seconds; included in the snapshot while running, and not included once completed', async () => {
      await start();
      listen();
      const { jobId } = await submit();
      await manager.settled(jobId);
      expect(manager.inspect(jobId).state).toBe('completed');
      expect(updates).toEqual([
        { jobId, from: 0, segments: [{ start: 0, end: 1.4, text: 'testing one two' }] },
        { jobId, from: 1, segments: [{ start: 1.6, end: 3, text: 'three cuccut is' }] },
        { jobId, from: 2, segments: [{ start: 3.2, end: 3.6, text: 'ready' }] },
      ]);
      expect(manager.snapshot()).not.toHaveProperty('liveSegments');
    });

    it('while running, the snapshot includes all segments so far; dropped after cancel', async () => {
      await start();
      listen();
      const { jobId } = await submit('fake@cpu#slow');
      const live = await until(() => {
        const list = manager.snapshot().liveSegments?.[jobId];
        return list && list.length >= 2 ? list : null;
      });
      expect(live).toEqual(updates.slice(0, live.length).flatMap((u) => u.segments));
      expect(updates.map((u) => u.from)).toEqual(updates.map((_, i) => i));
      await manager.cancel(jobId);
      await manager.settled(jobId);
      expect(manager.inspect(jobId).state).toBe('cancelled');
      expect(manager.snapshot()).not.toHaveProperty('liveSegments');
    });

    it('automatic retry after crash: segments are dropped on interruption, and the new attempt starts again from from 0', async () => {
      await start();
      listen();
      const atInterrupt: unknown[] = [];
      manager.onChange((job) => {
        if (job.state === 'interrupted') atInterrupt.push(manager.snapshot().liveSegments);
      });
      const job = await run('fake@cpu#crash-once');
      expect(job).toMatchObject({ state: 'completed', attempt: 2 });
      expect(atInterrupt).toEqual([undefined]);
      expect(updates.map((u) => u.from)).toEqual([0, 0, 1, 2]);
      expect(updates[0]!.segments).toEqual(updates[1]!.segments);
      expect(manager.snapshot()).not.toHaveProperty('liveSegments');
    });

    it('blank text and invalid times are dropped; segments arriving late after the task fails are no longer accepted', async () => {
      const remote = new FakeNodeProvider(() => provider);
      await start({ remote, resolveNode: (node) => (node === 'studio' ? 'node_a' : null) });
      listen();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let late: TranscribeSink | null = null;
      remote.next = async (_run, sink) => {
        late = sink;
        sink.segment({ id: 'seg-0001', start: 2_500_000, end: 3_000_000, text: '  hi  ', speakerId: null, words: [] });
        sink.segment({ id: 'seg-0002', start: 3_000_000, end: 3_100_000, text: '   ', speakerId: null, words: [] });
        sink.segment({ id: 'seg-0003', start: 4_000_000, end: 3_900_000, text: 'backwards', speakerId: null, words: [] });
        sink.segment({ id: 'seg-0004', start: Number.NaN, end: 5_000_000, text: 'nan', speakerId: null, words: [] });
        sink.segment({ id: 'seg-0005', start: 5_000_000, end: 5_000_000, text: 'point', speakerId: null, words: [] });
        await gate;
        throw new ProviderFailure('node-lost', '节点失联', { reason: 'stream-lost', node: 'node_a' });
      };
      const { jobId } = await submit('fake@cpu', { node: 'studio' });
      await until(() => updates.length === 2);
      expect(updates).toEqual([
        { jobId, from: 0, segments: [{ start: 2.5, end: 3, text: 'hi' }] },
        { jobId, from: 1, segments: [{ start: 5, end: 5, text: 'point' }] },
      ]);
      expect(manager.snapshot().liveSegments).toEqual({ [jobId]: [updates[0]!.segments[0], updates[1]!.segments[0]] });
      release();
      await manager.settled(jobId);
      expect(manager.inspect(jobId).state).toBe('failed');
      expect(manager.snapshot()).not.toHaveProperty('liveSegments');
      late!.segment({ id: 'seg-0006', start: 6_000_000, end: 7_000_000, text: 'late', speakerId: null, words: [] });
      expect(updates).toHaveLength(2);
    });
  });

  describe('remote node (node parameter)', () => {
    const resolveNode = (node: string) => (node === 'studio' || node === 'node_a' ? 'node_a' : null);
    let remote: FakeNodeProvider;
    const startRemote = () => {
      remote = new FakeNodeProvider(() => provider);
      return start({ remote, resolveNode });
    };

    it('does not look at the local model directory: providerId is node:<nodeId>, and the result is validated, published and applied as usual', async () => {
      await startRemote();
      // On the node, the Worker crashed and was retried: the result is backfilled with the node's attempt sequence number 2.
      remote.next = async (run, sink, signal) => {
        const attempt = await provider.transcribe({ ...run, bundleId: 'fake@cpu', runGeneration: 2 }, sink, signal);
        return attempt.outcome === 'completed' ? { ...attempt, runGeneration: 2 } : attempt;
      };
      const { jobId } = await submit(undefined, { bundleId: undefined, node: 'studio' });
      await manager.settled(jobId);
      const job = manager.inspect(jobId);
      expect(job).toMatchObject({
        state: 'completed',
        attempt: 1,
        providerId: 'node:node_a',
        bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
        result: { documentId: 'doc_speech' },
      });
      expect(remote.runs).toHaveLength(1);
      expect(remote.runs[0]).toMatchObject({
        node: 'node_a',
        mediaType: 'audio/wav',
        runGeneration: 1,
        bundleId: DEFAULT_TRANSCRIBE_BUNDLE,
      });
      expect(videos.applied).toHaveLength(1);
      expect(await exists(stagingOf(jobId))).toBe(false);
    });

    it('the result\'s runGeneration is still strictly validated: when the provider does not specify it, the local attempt number is used', async () => {
      await startRemote();
      remote.next = (run, sink, signal) => provider.transcribe({ ...run, bundleId: 'fake@cpu', runGeneration: 2 }, sink, signal);
      const { jobId } = await submit(undefined, { node: 'studio' });
      await manager.settled(jobId);
      expect(manager.inspect(jobId)).toMatchObject({ state: 'failed', error: { code: 'MODEL_OUTPUT_INVALID' } });
    });

    it('unknown node: not-found; without an initiating side, the node parameter always gives not-found', async () => {
      await startRemote();
      await expect(submit(undefined, { node: 'nowhere' })).rejects.toMatchObject({ code: 'not-found' });
      await manager.shutdown();
      await start();
      await expect(submit(undefined, { node: 'studio' })).rejects.toMatchObject({ code: 'not-found' });
    });

    it('the input hash includes the node: a local task and a remote task on the same media are two tasks; remote tasks do not occupy the local model pack\'s queue', async () => {
      await startRemote();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      remote.next = async (run, sink, signal) => {
        await gate;
        return provider.transcribe({ ...run, bundleId: 'fake@cpu' }, sink, signal);
      };
      const remoteJob = await submit('fake@cpu', { node: 'studio' });
      expect(await submit('fake@cpu', { node: 'node_a' })).toEqual(remoteJob);
      await until(() => manager.inspect(remoteJob.jobId).state === 'running');
      // While a remote task is stuck, local tasks for the same model package still run.
      const local = await run('fake@cpu');
      expect(local.state).toBe('completed');
      expect(local.jobId).not.toBe(remoteJob.jobId);
      expect(local.inputHash).not.toBe(manager.inspect(remoteJob.jobId).inputHash);
      release();
      await manager.settled(remoteJob.jobId);
      expect(manager.inspect(remoteJob.jobId).state).toBe('completed');
    });

    it('remote tasks for the same node are handed over one at a time (one queue per node)', async () => {
      await startRemote();
      let inFlight = 0;
      let peak = 0;
      remote.next = async (run, sink, signal) => {
        peak = Math.max(peak, ++inFlight);
        try {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return await provider.transcribe({ ...run, bundleId: 'fake@cpu' }, sink, signal);
        } finally {
          inFlight--;
        }
      };
      const jobs = await Promise.all(['a', 'b', 'c'].map((hint) => submit('fake@cpu', { node: 'studio', hint })));
      for (const { jobId } of jobs) await manager.settled(jobId);
      expect(peak).toBe(1);
      expect(jobs.map(({ jobId }) => manager.inspect(jobId).state)).toEqual(['completed', 'completed', 'completed']);
    });

    it('failure normalization: rejections and disconnections are not retried; a failure on a node keeps the node\'s error code and records the node', async () => {
      await startRemote();
      const cases: Array<[ProviderFailure, object]> = [
        [
          new ProviderFailure('node-rejected', '模型包在节点上不可用', { reason: 'model-not-ready', node: 'node_a' }),
          { code: 'REMOTE_NODE_REJECTED', details: { reason: 'model-not-ready', node: 'node_a' } },
        ],
        [
          new ProviderFailure('node-lost', '节点失联', { reason: 'stream-lost', node: 'node_a' }),
          { code: 'REMOTE_NODE_LOST', details: { reason: 'stream-lost', node: 'node_a' } },
        ],
        [
          new ProviderFailure('remote-failed', 'Worker 反复崩溃', {
            code: 'MODEL_WORKER_CRASHED',
            node: 'node_a',
            details: { attempts: 2 },
          }),
          { code: 'MODEL_WORKER_CRASHED', message: 'Worker 反复崩溃', details: { attempts: 2, node: 'node_a' } },
        ],
      ];
      for (const [index, [failure, error]] of cases.entries()) {
        remote.runs.length = 0;
        remote.next = async () => {
          throw failure;
        };
        const { jobId } = await submit('fake@cpu', { node: 'studio', hint: `case ${index}` });
        await manager.settled(jobId);
        expect(manager.inspect(jobId)).toMatchObject({ state: 'failed', attempt: 1, error });
        expect(remote.runs).toHaveLength(1);
      }
      expect(videos.leases).toBe(0);
    });

    it('cancel: the provider\'s cancellation warning goes into the task record', async () => {
      await startRemote();
      remote.next = (_run, _sink, signal) =>
        new Promise((resolve) => {
          const cancelled = () => resolve({ outcome: 'cancelled', workerVersion: null, warnings: [{ code: 'remote-cancel-unconfirmed' }] });
          if (signal.aborted) cancelled();
          else signal.addEventListener('abort', cancelled);
        });
      const { jobId } = await submit('fake@cpu', { node: 'studio' });
      await until(() => manager.inspect(jobId).state === 'running');
      await manager.cancel(jobId);
      await manager.settled(jobId);
      expect(manager.inspect(jobId)).toMatchObject({ state: 'cancelled', warnings: [{ code: 'remote-cancel-unconfirmed' }] });
    });
  });

  describe('external file task (node)', () => {
    const NODE = { kind: 'node', id: 'client-a' } as const;
    const fileRequest = async (extra: Partial<FileTranscribeRequest> = {}): Promise<FileTranscribeRequest> => {
      const file = path.join(dir, 'remote-input');
      await fs.writeFile(file, 'remote audio');
      return {
        file,
        contentHash: 'sha256:' + 'b'.repeat(64),
        bundleId: 'fake@cpu',
        resultFile: path.join(dir, 'remote-result.json'),
        ...extra,
      };
    };

    it('completion: the result goes to the specified file, no artifact is published and the video is untouched; the record has no video', async () => {
      await start();
      const outputs: FileJobOutput[] = [];
      const languages: string[] = [];
      const warnings: string[] = [];
      const request = await fileRequest({ jobId: 'job_remote', diarize: true, timescale: 1000, range: { start: 0, end: 5000 } });
      const { jobId } = await manager.submitFile(request, NODE, {
        output: (o) => outputs.push(o),
        language: (tag) => languages.push(tag),
        warning: (w) => warnings.push(w.code),
      });
      expect(jobId).toBe('job_remote');
      expect(await manager.settled(jobId)).toBe('completed');
      const job = manager.inspect(jobId);
      expect(job).toMatchObject({
        state: 'completed',
        submitter: NODE,
        videoId: null,
        assetId: null,
        assetRevision: null,
        contentHash: request.contentHash,
        result: null,
        warnings: [{ code: 'diarization-unavailable' }],
      });
      expect(languages).toEqual(['en']);
      expect(warnings).toEqual(['diarization-unavailable']);
      const bytes = await fs.readFile(request.resultFile);
      expect(outputs).toEqual([
        { file: request.resultFile, byteLength: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') },
      ]);
      const result = JSON.parse(bytes.toString()) as { timescale: number };
      expect(result.timescale).toBe(1000);
      expect(videos.applied).toEqual([]);
      expect(videos.leases).toBe(0);
      expect(await fs.readdir(paths.artifactsDir).catch(() => [])).toEqual([]);
      expect(await exists(stagingOf(jobId))).toBe(false);
      // External file tasks are not deduplicated: submitting the same input again is a new task.
      const again = await manager.submitFile(await fileRequest(), NODE);
      expect(again.jobId).not.toBe(jobId);
      await manager.settled(again.jobId);
      expect(manager.list().map((j) => j.submitter.kind)).toEqual(['node', 'node']);
    });

    it('validation at submission', async () => {
      await start();
      await expect(manager.submitFile(await fileRequest({ file: 'relative' }), NODE)).rejects.toMatchObject({ code: 'invalid-request' });
      await expect(manager.submitFile(await fileRequest({ resultFile: 'out.json' }), NODE)).rejects.toMatchObject({
        code: 'invalid-request',
      });
      await expect(manager.submitFile(await fileRequest({ contentHash: 'md5:1' }), NODE)).rejects.toMatchObject({
        code: 'invalid-request',
      });
      await expect(manager.submitFile(await fileRequest({ bundleId: 'nope' }), NODE)).rejects.toBeInstanceOf(RpcError);
      await expect(manager.submitFile(await fileRequest({ range: { start: 5, end: 5 } }), NODE)).rejects.toMatchObject({
        code: 'invalid-request',
      });
      const { jobId } = await manager.submitFile(await fileRequest({ jobId: 'job_dup' }), NODE);
      await expect(manager.submitFile(await fileRequest({ jobId: 'job_dup' }), NODE)).rejects.toMatchObject({ code: 'conflict' });
      await manager.settled(jobId);
    });

    it('crashes once: notifies retry first, then marks interrupted, completes as attempt 2', async () => {
      await start();
      const retries: number[] = [];
      const seen: string[] = [];
      manager.onChange((job) => seen.push(`${job.state}:${job.attempt}`));
      const { jobId } = await manager.submitFile(await fileRequest({ bundleId: 'fake@cpu#crash-once' }), NODE, {
        retrying: (attempt) => {
          retries.push(attempt);
          seen.push(`retrying:${attempt}`);
        },
      });
      await manager.settled(jobId);
      expect(manager.inspect(jobId)).toMatchObject({ state: 'completed', attempt: 2 });
      expect(retries).toEqual([2]);
      expect(seen.indexOf('retrying:2')).toBeLessThan(seen.indexOf('interrupted:1'));
    });

    it('shares one queue with video tasks: the same model pack handles one at a time in arrival order', async () => {
      await start();
      const first = await submit('fake@cpu#slow-load');
      const remote = await manager.submitFile(await fileRequest({ bundleId: 'fake@cpu#slow-load' }), NODE);
      const second = await submit('fake@cpu#slow-load', { hint: 'second' });
      expect(manager.inspect(remote.jobId).state).toBe('queued');
      for (const { jobId } of [first, remote, second]) await manager.settled(jobId);
      const records = [first, remote, second].map(({ jobId }) => manager.inspect(jobId));
      for (let i = 1; i < records.length; i++) {
        expect(Date.parse(records[i]!.startedAt!)).toBeGreaterThanOrEqual(Date.parse(records[i - 1]!.endedAt!));
      }
      expect(videos.applied).toHaveLength(2);
    });

    it('output violates the contract: no raw result is kept in the diagnostics directory (it may contain transcribed text)', async () => {
      await start();
      const { jobId } = await manager.submitFile(await fileRequest({ bundleId: 'fake@cpu#invalid-output' }), NODE);
      await manager.settled(jobId);
      expect(manager.inspect(jobId)).toMatchObject({ state: 'failed', error: { code: 'MODEL_OUTPUT_INVALID' } });
      expect(await exists(path.join(paths.diagnosticsDir, jobId, 'job.json'))).toBe(true);
      expect(await exists(path.join(paths.diagnosticsDir, jobId, 'result.json'))).toBe(false);
    });

    it('stop and restart: in-flight external file tasks are marked interrupted', async () => {
      await start();
      const { jobId } = await manager.submitFile(await fileRequest({ bundleId: 'fake@cpu#slow' }), NODE);
      await until(() => manager.inspect(jobId).state === 'running');
      await manager.shutdown();
      expect(manager.inspect(jobId)).toMatchObject({ state: 'interrupted', videoId: null });
      await start();
      expect(manager.inspect(jobId)).toMatchObject({ state: 'interrupted', submitter: NODE, videoId: null });
    });
  });
});
