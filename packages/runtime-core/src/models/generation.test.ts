import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyJobsEvent } from '@cuccut/client';
import {
  corruptPngFixture,
  fakeElevenLabsHandler,
  fakeGoogleHandler,
  fakeOpenAiHandler,
  mp3Fixture,
  pngFixture,
  startFakeProviderServer,
  type FakeProviderServer,
} from '@cuccut/providers/testing';
import { RpcError, newId, type CapabilityNotConfiguredDetails, type JobRecord, type JobsSnapshot } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';

/**
 * Generation capabilities (`models.synthesizeSpeech`, `models.generateImage`, architecture design §6.6, §7), end to end through the gateway: selection and “not configured”, checks at submission, JobManager → fake provider → ffprobe decode check → artifact → read back via `artifacts.openHandle`. When a video is given, it is imported as an asset through the real engine. The test connects only to fake providers on the loopback address; the keys are strings made up in the test.
 */

const engine = resolveEngineHostCommand();
const ffprobe = (() => {
  try {
    execFileSync(process.env.CUCCUT_FFPROBE || 'ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!ffprobe) console.warn('跳过生成任务的端到端测试：没有 ffprobe');
if (!engine) console.warn('跳过生成结果导入视频的测试：没有构建 engine-host（npm run build:engine）');

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-0123456789abcdef';
const GOOGLE_KEY = 'AIzaTESTONLY-0123456789abcdefghijklmn';
const ELEVENLABS_KEY = 'sk_test_ONLY_FOR_TESTS_0123456789abcdef';

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

interface Side {
  dir: string;
  home: RuntimeHome;
  runtime: RunningRuntime;
  client: CucCutClient;
  received: unknown[];
  jobs(): JobsSnapshot | null;
}

async function startSide(
  servers: { openai?: FakeProviderServer; google?: FakeProviderServer; elevenlabs?: FakeProviderServer },
  withEngine = false,
): Promise<Side> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-generation-'));
  const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  const runtime = await startRuntime({
    home,
    drivers: () => [],
    watchSpace: false,
    engineHost: withEngine ? engine : null,
    videoGraceMs: 100,
    modelWorker: null,
    jobIdleMs: 60_000,
    online: {
      baseUrls: {
        ...(servers.openai ? { openai: `${servers.openai.origin}/v1` } : {}),
        ...(servers.google ? { google: `${servers.google.origin}/v1beta` } : {}),
        ...(servers.elevenlabs ? { elevenlabs: `${servers.elevenlabs.origin}/v1` } : {}),
      },
      http: { backoffMs: () => 10 },
    },
  });
  const { endpoint, token } = runtime.discovery;
  const client = new CucCutClient({
    resolve: async () => ({ endpoint, token }),
    client: { kind: 'desktop', name: 'test', version: '0' },
    reconnect: false,
  });
  await client.connect();
  const received: unknown[] = [];
  let jobs: JobsSnapshot | null = null;
  client.subscribeJobs({
    snapshot: (snapshot) => {
      received.push(snapshot);
      jobs = snapshot;
    },
    event: (event) => {
      received.push(event);
      jobs = applyJobsEvent(jobs!, event);
    },
  });
  client.subscribeModels({ snapshot: (s) => received.push(s), event: (e) => received.push(e) });
  await until(() => jobs);
  return { dir, home, runtime, client, received, jobs: () => jobs };
}

async function stopSide(side: Side | undefined): Promise<void> {
  if (!side) return;
  side.client.close();
  await side.runtime.close();
  await fs.rm(side.dir, { recursive: true, force: true });
}

function settled(side: Side, jobId: string): Promise<JobRecord> {
  return until(() => side.jobs()!.jobs.find((j) => j.jobId === jobId && ['completed', 'failed', 'cancelled'].includes(j.state)));
}

/** Keys must not appear in logs, ledgers, config, themes, or the records the CLI sees; the diagnostics directory is the same. */
async function expectNoSecret(side: Side, secret: string) {
  const files = [path.join(side.home.logsDir, 'runtime.log'), side.home.jobsFile, side.home.modelServicesFile];
  for (const file of files) expect(await fs.readFile(file, 'utf8').catch(() => ''), file).not.toContain(secret);
  const diagnostics = path.join(side.home.logsDir, 'diagnostics');
  for (const name of await fs.readdir(diagnostics, { recursive: true }).catch(() => [] as string[])) {
    const file = path.join(diagnostics, String(name));
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    expect(text, file).not.toContain(secret);
  }
  expect(JSON.stringify(side.received)).not.toContain(secret);
  expect(JSON.stringify(await side.client.request('jobs.list', {}))).not.toContain(secret);
}

/** Bytes of the artifact retrieved through `artifacts.openHandle`. */
async function readArtifact(side: Side, artifactId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const handle = await side.client.request('artifacts.openHandle', { artifactId });
  const response = await fetch(handle.url);
  expect(response.status).toBe(200);
  return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: handle.mimeType };
}

describe('generation capabilities: selection and checks at submission (does not need ffprobe)', () => {
  let side: Side | undefined;
  let openai: FakeProviderServer | undefined;

  afterEach(async () => {
    await stopSide(side);
    await openai?.close();
    side = openai = undefined;
  });

  it('nothing configured: neither capability has a factory default; rejects with CAPABILITY_NOT_CONFIGURED and creates no task', async () => {
    side = await startSide({});
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.synthesizeSpeech).toMatchObject({ default: null, effective: null });
    // The local Provider lists speech synthesis (the model bundle is not installed, so it is unavailable); both online providers are unavailable too.
    expect(capabilities.synthesizeSpeech.providers.map((p) => [p.providerId, p.available])).toEqual([
      ['local', false],
      ['openai', false],
      ['elevenlabs', false],
    ]);
    // Image generation also lists the local Provider (the text-to-image model bundle is not installed), ranked after the online services.
    expect(capabilities.generateImage.providers.map((p) => p.providerId)).toEqual(['openai', 'google', 'local']);
    expect(capabilities.generateImage.providers.every((p) => !p.available)).toBe(true);

    // Speech synthesis has an installable local model bundle, so the remedy is to install the model; the local model bundle for image generation is not offered as a remedy (the UI only falls back to the cloud), so the remedy is to configure an online service.
    for (const [method, params, capability, action] of [
      ['models.synthesizeSpeech', { text: '你好' }, 'synthesizeSpeech', 'install-model'],
      ['models.generateImage', { prompt: 'a cat' }, 'generateImage', 'configure-provider'],
    ] as const) {
      const error = await side.client.request(method, params as never).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RpcError);
      expect(error).toMatchObject({
        code: 'conflict',
        details: { code: 'CAPABILITY_NOT_CONFIGURED', capability, reason: 'no-default', remedy: { action } },
      });
      expect(((error as RpcError).details as CapabilityNotConfiguredDetails).remedy.hint).toMatch(/./);
    }
    expect(await side.client.request('jobs.list', {})).toEqual({ jobs: [] });
  });

  it('provider enabled but no default set: prompts to set a default; explicit selection works; after setDefault it becomes the effective default', async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    side = await startSide({ openai });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const error = await side.client.request('models.synthesizeSpeech', { text: '你好' }).catch((e: unknown) => e);
    expect(error).toMatchObject({
      details: { code: 'CAPABILITY_NOT_CONFIGURED', reason: 'no-default', remedy: { action: 'set-default' } },
    });

    // Checks at submission: text over the model's limit, voices the model does not have, and parameters the model does not accept are all rejected at submission, not truncated.
    const long = 'a'.repeat(4097);
    const tooLong = await side.client.request('models.synthesizeSpeech', { text: long, provider: 'openai' }).catch((e: unknown) => e);
    expect(tooLong).toMatchObject({
      code: 'invalid-request',
      details: { providerId: 'openai', modelId: 'gpt-4o-mini-tts', length: 4097, limit: 4096 },
    });
    const badVoice = await side.client
      .request('models.synthesizeSpeech', { text: 'hi', provider: 'openai', model: 'tts-1', voice: 'marin' })
      .catch((e: unknown) => e);
    expect(badVoice).toMatchObject({ code: 'invalid-request' });
    const noInstructions = await side.client
      .request('models.synthesizeSpeech', { text: 'hi', provider: 'openai', model: 'tts-1', instructions: 'cheerful' })
      .catch((e: unknown) => e);
    expect(noInstructions).toMatchObject({ code: 'invalid-request' });
    const badSize = await side.client
      .request('models.generateImage', { prompt: 'x', provider: 'openai', size: '640x480' })
      .catch((e: unknown) => e);
    expect(badSize).toMatchObject({ code: 'invalid-request' });
    const notOpen = await side.client
      .request('models.synthesizeSpeech', { text: 'hi', provider: 'openai', videoId: 'mov_missing' })
      .catch((e: unknown) => e);
    expect(notOpen).toMatchObject({ code: 'not-found' });
    expect(await side.client.request('jobs.list', {})).toEqual({ jobs: [] });

    const { default: ref } = await side.client.request('models.setDefault', { capability: 'synthesizeSpeech', providerId: 'openai' });
    expect(ref).toEqual({ providerId: 'openai', modelId: 'gpt-4o-mini-tts' });
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.synthesizeSpeech.effective).toEqual({ providerId: 'openai', modelId: 'gpt-4o-mini-tts', source: 'user-default' });
    expect(openai.requests).toHaveLength(0);
  });
});

describe.skipIf(!ffprobe)('generation task: fake provider, then verification, then output', () => {
  let side: Side;
  let openai: FakeProviderServer;
  let google: FakeProviderServer;
  let elevenlabs: FakeProviderServer;

  beforeEach(async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    google = await startFakeProviderServer(fakeGoogleHandler());
    elevenlabs = await startFakeProviderServer(fakeElevenLabsHandler());
    side = await startSide({ openai, google, elevenlabs });
  });

  afterEach(async () => {
    await stopSide(side);
    await openai.close();
    await google.close();
    await elevenlabs.close();
  });

  it('OpenAI speech (default): freezes model and voice, verifies decoding, publishes the output, reads back the same bytes', async () => {
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await side.client.request('models.setDefault', { capability: 'synthesizeSpeech', providerId: 'openai' });
    const { jobId } = await side.client.request('models.synthesizeSpeech', { text: '欢迎来到 CucCut', speed: 1.25 });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({
      kind: 'synthesizeSpeech',
      state: 'completed',
      providerId: 'openai',
      modelId: 'gpt-4o-mini-tts',
      videoId: null,
      assetId: null,
      bundleId: null,
      error: null,
      generation: { capability: 'synthesizeSpeech', text: '欢迎来到 CucCut', voice: 'marin', format: 'mp3', speed: 1.25, language: null },
      result: { documentId: null, artifactId: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) },
    });
    expect(job.contentHash).toMatch(/^sha256:/);
    const [output] = job.result!.outputs!;
    expect(output).toMatchObject({ mediaType: 'audio/mpeg', assetId: null, media: { kind: 'audio', sampleRate: 44100, channels: 1 } });
    expect((output!.media as { durationSec: number }).durationSec).toBeGreaterThan(0.4);
    const artifact = await readArtifact(side, output!.artifactId);
    expect(artifact.bytes.equals(mp3Fixture())).toBe(true);
    expect(artifact.mimeType).toBe('audio/mpeg');

    const request = openai.requests.find((r) => r.path === '/v1/audio/speech')!;
    expect(request.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(request.json).toEqual({
      model: 'gpt-4o-mini-tts',
      input: '欢迎来到 CucCut',
      voice: 'marin',
      response_format: 'mp3',
      speed: 1.25,
    });
    expect(request.path).not.toContain(OPENAI_KEY);
    await expectNoSecret(side, OPENAI_KEY);
  });

  it('Google image: requests by aspect ratio, one image at a time, output is PNG with reported width and height', async () => {
    await side.client.request('models.configure', { providerId: 'google', enabled: true, credential: GOOGLE_KEY });
    const { jobId } = await side.client.request('models.generateImage', {
      prompt: 'a red fox',
      provider: 'google',
      size: '16:9',
      count: 2,
    });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({
      kind: 'generateImage',
      state: 'completed',
      providerId: 'google',
      modelId: 'gemini-3.1-flash-image',
      generation: { capability: 'generateImage', prompt: 'a red fox', size: '1376x768', aspectRatio: '16:9', count: 2, format: 'png' },
    });
    expect(job.result!.outputs).toHaveLength(2);
    for (const output of job.result!.outputs!) {
      expect(output).toMatchObject({ mediaType: 'image/png', media: { kind: 'image', width: 16, height: 9 } });
      expect((await readArtifact(side, output.artifactId)).bytes.equals(pngFixture())).toBe(true);
    }
    const requests = google.requests.filter((r) => r.path === '/v1beta/interactions');
    expect(requests).toHaveLength(2);
    expect(requests[0]!.headers['x-goog-api-key']).toBe(GOOGLE_KEY);
    expect(requests[0]!.json).toMatchObject({
      model: 'gemini-3.1-flash-image',
      input: [{ type: 'text', text: 'a red fox' }],
      response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '16:9', image_size: '1K' },
    });
    await expectNoSecret(side, GOOGLE_KEY);
  });

  it('ElevenLabs: voices belong to the account; without a voice, submission is rejected; with a voice, it uses xi-api-key and output_format', async () => {
    await side.client.request('models.configure', { providerId: 'elevenlabs', enabled: true, credential: ELEVENLABS_KEY });
    const noVoice = await side.client
      .request('models.synthesizeSpeech', { text: 'hello', provider: 'elevenlabs' })
      .catch((e: unknown) => e);
    expect(noVoice).toMatchObject({ code: 'invalid-request' });
    const { jobId } = await side.client.request('models.synthesizeSpeech', {
      text: 'hello',
      provider: 'elevenlabs',
      voice: 'voice_abc123',
      format: 'wav',
      seed: 42,
    });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({ state: 'completed', modelId: 'eleven_multilingual_v2', generation: { voice: 'voice_abc123', seed: 42 } });
    expect(job.result!.outputs![0]).toMatchObject({ mediaType: 'audio/wav', media: { kind: 'audio', sampleRate: 24000, channels: 1 } });
    const request = elevenlabs.requests.find((r) => r.method === 'POST')!;
    expect(request.path).toBe('/v1/text-to-speech/voice_abc123?output_format=wav_24000');
    expect(request.headers['xi-api-key']).toBe(ELEVENLABS_KEY);
    expect(request.headers.authorization).toBeUndefined();
    expect(request.json).toEqual({ text: 'hello', model_id: 'eleven_multilingual_v2', seed: 42 });
    await expectNoSecret(side, ELEVENLABS_KEY);
  });

  it('output cannot be decoded: MODEL_OUTPUT_INVALID, no output published, no retry', async () => {
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    openai.handler = (request) =>
      request.path.endsWith('/images/generations')
        ? { status: 200, json: { data: [{ b64_json: corruptPngFixture().toString('base64') }] } }
        : { status: 404 };
    const { jobId } = await side.client.request('models.generateImage', { prompt: 'x', provider: 'openai' });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({ state: 'failed', result: null, error: { code: 'MODEL_OUTPUT_INVALID' } });
    expect(openai.requests).toHaveLength(1);
    expect(await fs.readdir(side.home.artifactsDir).catch(() => [])).toEqual([]);
  });

  it('provider rejects key: PROVIDER_AUTH_FAILED; an echoed key appears nowhere', async () => {
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    openai.handler = () => ({ status: 401, json: { error: { message: `Incorrect API key provided: ${OPENAI_KEY}` } } });
    const { jobId } = await side.client.request('models.synthesizeSpeech', { text: 'hi', provider: 'openai' });
    const job = await settled(side, jobId);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'PROVIDER_AUTH_FAILED', details: { providerId: 'openai' } } });
    expect(job.error!.message).not.toContain(OPENAI_KEY);
    await expectNoSecret(side, OPENAI_KEY);
  });

  it('cancel a running generation: aborts the in-flight request, task cancelled', async () => {
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    openai.handler = () => 'hang';
    const { jobId } = await side.client.request('models.synthesizeSpeech', { text: 'hi', provider: 'openai' });
    await openai.waitForRequests(1);
    await until(() => side.jobs()!.jobs.find((j) => j.jobId === jobId && j.phase === 'generating'));
    expect(await side.client.request('jobs.cancel', { jobId })).toEqual({ state: 'cancelled' });
    await openai.waitForClosedEarly(1);
    expect((await side.client.request('jobs.inspect', { jobId })).state).toBe('cancelled');
  });

  it('the same parameters submitted twice are two tasks; the same commandId is one task', async () => {
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const a = await side.client.request('models.synthesizeSpeech', { text: 'same', provider: 'openai' });
    const b = await side.client.request('models.synthesizeSpeech', { text: 'same', provider: 'openai' });
    expect(a.jobId).not.toBe(b.jobId);
    const commandId = newId('cmd');
    const c = await side.client.request('models.synthesizeSpeech', { text: 'same', provider: 'openai', commandId });
    const d = await side.client.request('models.synthesizeSpeech', { text: 'other', provider: 'openai', commandId });
    expect(d.jobId).toBe(c.jobId);
    for (const { jobId } of [a, b, c]) expect((await settled(side, jobId)).state).toBe('completed');
  });

  it('artifacts.openHandle: nonexistent artifact gives not-found', async () => {
    const error = await side.client.request('artifacts.openHandle', { artifactId: `sha256:${'0'.repeat(64)}` }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'not-found' });
  });
});

describe.skipIf(!ffprobe || !engine)('generation result import into video (real engine)', () => {
  let side: Side;
  let openai: FakeProviderServer;

  beforeEach(async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    side = await startSide({ openai }, true);
  });

  afterEach(async () => {
    await stopSide(side);
    await openai.close();
  });

  it('video given: imported as a candidate media item under system:jobs (not placed on the timeline), with source recorded as generated and a parameter digest', async () => {
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const { project } = await side.client.request('projects.create', { name: '生成' });
    const opened = await side.client.request('videos.create', { projectId: project.id });
    const videoId = opened.ref.videoId;
    const before = opened.snapshot.video;

    const speech = await side.client.request('models.synthesizeSpeech', {
      text: '第一句旁白',
      provider: 'openai',
      videoId,
      name: '旁白 1',
    });
    const image = await side.client.request('models.generateImage', { prompt: 'a lighthouse', provider: 'openai', videoId, count: 2 });
    const speechJob = await settled(side, speech.jobId);
    const imageJob = await settled(side, image.jobId);
    expect(speechJob).toMatchObject({ state: 'completed', videoId });
    expect(imageJob).toMatchObject({ state: 'completed', videoId });

    const video = side.runtime.videos.mirror(videoId)!.video;
    const voiceId = speechJob.result!.outputs![0]!.assetId!;
    const voice = video.assets[voiceId]!;
    expect(voice.name).toBe('旁白 1');
    const revision = voice.revisions[voice.currentRevision]!;
    expect(revision.mediaType).toBe('audio/mpeg');
    expect(revision.provenance).toMatchObject({
      origin: 'generated',
      source: {
        jobId: speech.jobId,
        capability: 'synthesizeSpeech',
        providerId: 'openai',
        modelId: 'gpt-4o-mini-tts',
        inputHash: speechJob.inputHash,
        artifactId: speechJob.result!.outputs![0]!.artifactId,
        parameters: { voice: 'marin', format: 'mp3' },
      },
    });
    // The source does not record the original text.
    expect(JSON.stringify(revision.provenance)).not.toContain('第一句旁白');

    const images = imageJob.result!.outputs!.map((o) => video.assets[o.assetId!]!);
    expect(images.map((a) => a.name)).toEqual(['图片：a lighthouse 1', '图片：a lighthouse 2']);
    // It is only a candidate asset: the timeline is unchanged.
    expect(JSON.stringify(video.sequences)).toBe(JSON.stringify(before.sequences));
    await expectNoSecret(side, OPENAI_KEY);
  });
});
