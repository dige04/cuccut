import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyJobsEvent } from '@cuccut/client';
import { TextGenerationError } from '@cuccut/models';
import {
  chatCompletionReply,
  fakeGoogleHandler,
  fakeOpenAiHandler,
  startFakeProviderServer,
  type FakeHandler,
  type FakeProviderServer,
} from '@cuccut/providers/testing';
import { RpcError, type CapabilityNotConfiguredDetails, type JobRecord, type JobsSnapshot } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';

/**
 * Text generation (`models.generateText`, the in-process `TextGenerator`; architecture design §6.1, §6.4) and `models.refreshProvider` and `models.setCapabilityParameters` (§6.8), end to end through the gateway: selection and “no configuration”; defaults and stale defaults; task → fake provider → validation → artifact → read back via `artifacts.openHandle`; idempotent commandId; refreshing the model list; and keys appearing in no record.
 * The test connects only to a fake provider on a loopback address; the key is a made-up string in the test.
 */

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-text-e2e-0123456789';
const GOOGLE_KEY = 'AIzaTESTONLY-text-e2e-0123456789abcdefgh';

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

async function startSide(servers: { openai?: FakeProviderServer; google?: FakeProviderServer }): Promise<Side> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-text-gen-'));
  const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  const runtime = await startRuntime({
    home,
    drivers: () => [],
    watchSpace: false,
    engineHost: null,
    videoGraceMs: 100,
    modelWorker: null,
    jobIdleMs: 60_000,
    online: {
      baseUrls: {
        ...(servers.openai ? { openai: `${servers.openai.origin}/v1` } : {}),
        ...(servers.google ? { google: `${servers.google.origin}/v1beta` } : {}),
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

/** Keys must not appear in logs, the ledger, configuration, topics, or the diagnostics directory. */
async function expectNoSecret(side: Side, secret: string) {
  const files = [path.join(side.home.logsDir, 'runtime.log'), side.home.jobsFile, side.home.modelServicesFile];
  for (const file of files) expect(await fs.readFile(file, 'utf8').catch(() => ''), file).not.toContain(secret);
  const diagnostics = path.join(side.home.logsDir, 'diagnostics');
  for (const name of await fs.readdir(diagnostics, { recursive: true }).catch(() => [] as string[])) {
    const file = path.join(diagnostics, String(name));
    expect(await fs.readFile(file, 'utf8').catch(() => ''), file).not.toContain(secret);
  }
  expect(JSON.stringify(side.received)).not.toContain(secret);
  expect(JSON.stringify(await side.client.request('jobs.list', {}))).not.toContain(secret);
  expect(JSON.stringify(await side.client.request('models.capabilities', {}))).not.toContain(secret);
}

async function readArtifact(side: Side, artifactId: string): Promise<{ text: string; mimeType: string }> {
  const handle = await side.client.request('artifacts.openHandle', { artifactId });
  const response = await fetch(handle.url);
  expect(response.status).toBe(200);
  return { text: await response.text(), mimeType: handle.mimeType };
}

describe('text generation (via gateway)', () => {
  let side: Side | undefined;
  let openai: FakeProviderServer | undefined;
  let google: FakeProviderServer | undefined;

  afterEach(async () => {
    await stopSide(side);
    await openai?.close();
    await google?.close();
    side = openai = google = undefined;
  });

  it('nothing configured: capability view lists all built-in text providers, no factory default; submit and in-process calls both rejected with CAPABILITY_NOT_CONFIGURED', async () => {
    side = await startSide({});
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.generateText).toMatchObject({ default: null, effective: null, parameters: { effort: null, concurrency: 4 } });
    expect(capabilities.generateText.providers.map((p) => p.providerId)).toEqual([
      'openai',
      'google',
      'anthropic',
      'deepseek',
      'moonshot',
      'qwen',
      'zhipu',
      'minimax',
      'volcengine',
      'xai',
      'mistral',
      'groq',
      'openrouter',
      'siliconflow',
    ]);
    expect(capabilities.generateText.providers.every((p) => !p.available)).toBe(true);

    const error = await side.client
      .request('models.generateText', { messages: [{ role: 'user', content: 'hi' }] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect(error).toMatchObject({
      code: 'conflict',
      details: {
        code: 'CAPABILITY_NOT_CONFIGURED',
        capability: 'generateText',
        reason: 'no-default',
        remedy: { action: 'configure-provider' },
      },
    });
    expect(((error as RpcError).details as CapabilityNotConfiguredDetails).remedy.hint).toMatch(/./);
    const inProcess = await side.runtime.models.services
      .textGenerator()
      .generate({ messages: [{ role: 'user', content: 'hi' }] })
      .catch((e: unknown) => e);
    expect(inProcess).toMatchObject({ code: 'conflict', details: { code: 'CAPABILITY_NOT_CONFIGURED' } });
    expect(await side.client.request('jobs.list', {})).toEqual({ jobs: [] });
  });

  it('OpenAI is default: task completes, full text is the artifact (read back by openHandle), result carries preview; commandId idempotent; key appears in no record', async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler('Hello from the fake model.'));
    side = await startSide({ openai });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const { default: ref } = await side.client.request('models.setDefault', { capability: 'generateText', providerId: 'openai' });
    expect(ref).toEqual({ providerId: 'openai', modelId: 'gpt-6.1-sol' });
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.generateText.effective).toEqual({ providerId: 'openai', modelId: 'gpt-6.1-sol', source: 'user-default' });

    const request = {
      messages: [
        { role: 'system' as const, content: 'Be friendly.' },
        { role: 'user' as const, content: 'Say hello' },
      ],
      effort: 'high' as const,
      commandId: 'cmd_text_e2e_1',
    };
    const { jobId } = await side.client.request('models.generateText', request);
    expect((await side.client.request('models.generateText', request)).jobId).toBe(jobId);
    const job = await settled(side, jobId);
    expect(job).toMatchObject({
      state: 'completed',
      kind: 'generateText',
      providerId: 'openai',
      modelId: 'gpt-6.1-sol',
      generation: { capability: 'generateText', effort: 'high', requestedEffort: 'high', maxOutputTokens: 128_000 },
      result: {
        documentId: null,
        text: {
          mediaType: 'text/plain',
          preview: 'Hello from the fake model.',
          finishReason: 'stop',
          modelVersion: 'gpt-6.1-sol-2026-09-01',
          usage: { inputTokens: 12, outputTokens: 5 },
        },
      },
    });
    const artifact = await readArtifact(side, job.result!.artifactId);
    expect(artifact.text).toBe('Hello from the fake model.');
    expect(artifact.mimeType).toMatch(/^text\/plain/);
    expect(openai.requests.filter((r) => r.path === '/v1/chat/completions')).toHaveLength(1);
    expect(openai.requests[0]!.json).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'high' });
    expect(side.runtime.models.services.textStats()).toEqual({ openai: { calls: 1, retries: 0, failures: 0 } });
    await expectNoSecret(side, OPENAI_KEY);
  });

  it('Google structured output: publishes validated JSON; when not matching schema MODEL_OUTPUT_INVALID, key not in the error', async () => {
    let reply = '{"title":"Hi"}';
    const handler: FakeHandler = (request, server) =>
      request.path.endsWith(':generateContent') ? fakeGoogleHandler(reply)(request, server) : fakeGoogleHandler()(request, server);
    google = await startFakeProviderServer(handler);
    side = await startSide({ google });
    await side.client.request('models.configure', { providerId: 'google', enabled: true, credential: GOOGLE_KEY });
    const schema = { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] };
    const submit = () =>
      side!.client.request('models.generateText', {
        messages: [{ role: 'user', content: 'title please' }],
        responseFormat: { type: 'json', schema },
        provider: 'google',
        temperature: 0.3,
        seed: 42,
      });
    let job = await settled(side, (await submit()).jobId);
    expect(job).toMatchObject({ state: 'completed', modelId: 'gemini-3.8-flash', result: { text: { mediaType: 'application/json' } } });
    expect(JSON.parse((await readArtifact(side, job.result!.artifactId)).text)).toEqual({ title: 'Hi' });
    expect(google.requests[0]!.headers['x-goog-api-key']).toBe(GOOGLE_KEY);

    reply = '{"title":5}';
    job = await settled(side, (await submit()).jobId);
    expect(job).toMatchObject({ state: 'failed', error: { code: 'MODEL_OUTPUT_INVALID', details: { reason: 'schema' } } });
    await expectNoSecret(side, GOOGLE_KEY);
  });

  it('context too long and auth failure use a closed set of error codes; in-process calls get the same error codes and counts', async () => {
    let mode: 'too-long' | 'auth' | 'ok' = 'too-long';
    openai = await startFakeProviderServer((request) => {
      if (mode === 'too-long') return { status: 400, json: { error: { code: 'context_length_exceeded', message: 'too long' } } };
      if (mode === 'auth') return { status: 401, json: { error: { message: `Incorrect API key ${OPENAI_KEY}` } } };
      return chatCompletionReply(request, 'in-process ok');
    });
    side = await startSide({ openai });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const { jobId } = await side.client.request('models.generateText', { messages: [{ role: 'user', content: 'x' }], provider: 'openai' });
    expect((await settled(side, jobId)).error).toMatchObject({ code: 'INPUT_TOO_LONG', details: { reason: 'context-length' } });

    mode = 'auth';
    const generator = side.runtime.models.services.textGenerator();
    const error = await generator.generate({ messages: [{ role: 'user', content: 'x' }], provider: 'openai' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TextGenerationError);
    expect(error).toMatchObject({ code: 'PROVIDER_AUTH_FAILED', details: { providerId: 'openai' } });
    expect(JSON.stringify(error) + (error as Error).message).not.toContain(OPENAI_KEY);

    mode = 'ok';
    const result = await generator.generate({
      messages: [{ role: 'user', content: 'x' }],
      provider: 'openai',
      model: 'gpt-6-luna',
      effort: 'minimal',
    });
    expect(result).toMatchObject({
      text: 'in-process ok',
      finishReason: 'stop',
      modelId: 'gpt-6-luna',
      effort: { requested: 'minimal', applied: 'minimal' },
    });
    expect(generator.stats()).toEqual({ openai: { calls: 3, retries: 0, failures: 2 } });
    await expectNoSecret(side, OPENAI_KEY);
  });

  it('capability parameters: default reasoning intensity goes into frozen parameters; concurrency limit can be changed and restored to factory value', async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler('ok'));
    side = await startSide({ openai });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    expect(
      await side.client.request('models.setCapabilityParameters', { capability: 'generateText', effort: 'low', concurrency: 2 }),
    ).toEqual({
      parameters: { effort: 'low', concurrency: 2 },
    });
    expect((await side.client.request('models.capabilities', {})).capabilities.generateText.parameters).toEqual({
      effort: 'low',
      concurrency: 2,
    });
    const { jobId } = await side.client.request('models.generateText', { messages: [{ role: 'user', content: 'x' }], provider: 'openai' });
    expect((await settled(side, jobId)).generation).toMatchObject({ requestedEffort: 'low', effort: 'low' });
    expect(
      await side.client.request('models.setCapabilityParameters', { capability: 'generateText', effort: null, concurrency: null }),
    ).toEqual({
      parameters: { effort: null, concurrency: 4 },
    });
    const invalid = await side.client
      .request('models.setCapabilityParameters', { capability: 'generateText', concurrency: 0 })
      .catch((e: unknown) => e);
    expect(invalid).toMatchObject({ code: 'invalid-request' });
  });

  it('refreshProvider: on success marks models not in the list; default values pointing to it become stale, submit rejected with CAPABILITY_NOT_CONFIGURED; on failure the built-in list is still used', async () => {
    let fail = false;
    openai = await startFakeProviderServer((request) => {
      if (request.method === 'GET' && request.path === '/v1/models') {
        return fail
          ? { status: 500, json: { error: { message: `boom ${OPENAI_KEY}` } } }
          : { status: 200, json: { data: [{ id: 'gpt-6.1-sol' }] } };
      }
      return fakeOpenAiHandler()(request, openai!);
    });
    side = await startSide({ openai });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await side.client.request('models.setDefault', { capability: 'generateText', providerId: 'openai', modelId: 'gpt-6-astra' });

    const { refreshed, provider } = await side.client.request('models.refreshProvider', { providerId: 'openai' });
    expect(refreshed).toMatchObject({ ok: true, models: 1 });
    expect(provider.config!.refreshed).toEqual(refreshed);
    expect(provider.capabilities.generateText!.models.find((m) => m.modelId === 'gpt-6-astra')).toMatchObject({
      available: false,
      unavailableReason: 'unsupported',
    });
    const stale = await side.client.request('models.generateText', { messages: [{ role: 'user', content: 'x' }] }).catch((e: unknown) => e);
    expect(stale).toMatchObject({ code: 'conflict', details: { code: 'CAPABILITY_NOT_CONFIGURED', capability: 'generateText' } });

    fail = true;
    const failed = await side.client.request('models.refreshProvider', { providerId: 'openai' });
    expect(failed.refreshed).toMatchObject({ ok: false });
    expect(failed.refreshed.error).not.toContain(OPENAI_KEY);
    expect(failed.provider.capabilities.generateText!.models.every((m) => m.available !== false)).toBe(true);
    // Back to the built-in list: the default is usable again.
    const { jobId } = await side.client.request('models.generateText', { messages: [{ role: 'user', content: 'x' }] });
    expect(await settled(side, jobId)).toMatchObject({ state: 'completed', modelId: 'gpt-6-astra' });

    const local = await side.client.request('models.refreshProvider', { providerId: 'local' }).catch((e: unknown) => e);
    expect(local).toMatchObject({ code: 'invalid-request' });
    await expectNoSecret(side, OPENAI_KEY);
  });

  it('disabling the default Provider: default kept but unavailable, submit rejected with CAPABILITY_NOT_CONFIGURED', async () => {
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    side = await startSide({ openai });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await side.client.request('models.setDefault', { capability: 'generateText', providerId: 'openai' });
    await side.client.request('models.configure', { providerId: 'openai', enabled: false });
    const { capabilities } = await side.client.request('models.capabilities', {});
    expect(capabilities.generateText.default).toEqual({ providerId: 'openai', modelId: 'gpt-6.1-sol' });
    const error = await side.client.request('models.generateText', { messages: [{ role: 'user', content: 'x' }] }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'conflict', details: { code: 'CAPABILITY_NOT_CONFIGURED', capability: 'generateText' } });
    expect(openai.requests).toHaveLength(0);
  });
});
