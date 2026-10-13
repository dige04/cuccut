import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyJobsEvent } from '@cuccut/client';
import { chatCompletionReply, startFakeProviderServer, type FakeHandler, type FakeProviderServer } from '@cuccut/providers/testing';
import { grantCreateParamsFor, newId, type GrantRequestItem, type JobRecord, type JobsSnapshot } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';

/**
 * Translating subtitle files (architecture design §7.9) end to end through the gateway: file to file, against a fake OpenAI on a loopback address, without touching a video. Rejected when no text model is configured.
 * Subtitle text is authorized under `transcript`. After the default authorization is revoked, startup is rejected (the desktop UI shows a pending approval item; the CLI does not). After approval, the same commandId is submitted again.
 * The output is a Space entry with generation records. The test connects only to fake providers; the key is a made-up string; the directories are in the temp directory.
 */

const engine = resolveEngineHostCommand();
const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-subtitles-0123456789';

const SRT = '1\r\n00:00:01,000 --> 00:00:02,000\r\n大家好\r\n\r\n2\r\n00:00:02,500 --> 00:00:04,000\r\n今天讲<i>剪辑</i>\r\n';

/** Command-line entry (apps/cli): runs the source file directly with node, with only PATH and HOME and CUCCUT_HOME pointing at the test directories. */
const CLI_MAIN = fileURLToPath(new URL('../../../../apps/cli/src/main.ts', import.meta.url));

function cli(home: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_MAIN, ...args],
      { cwd, env: { PATH: process.env.PATH ?? '', HOME: home, CUCCUT_HOME: home }, timeout: 60_000 },
      (error, stdout, stderr) => resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, stdout, stderr }),
    );
  });
}

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Fake OpenAI: returns translations by ID. */
function translator(state: { calls: number }): FakeHandler {
  return (request) => {
    if (request.method === 'GET' && request.path.endsWith('/models')) return { status: 200, json: { object: 'list', data: [] } };
    if (request.method !== 'POST' || !request.path.endsWith('/chat/completions'))
      return { status: 404, json: { error: { message: 'not found' } } };
    state.calls++;
    const messages = (request.json as { messages: Array<{ role: string; content: string }> }).messages;
    const user = messages.find((m) => m.role === 'user')!.content;
    const items = JSON.parse(user.split('<material>\n')[1]!.split('\n</material>')[0]!) as Array<{ id: string; text: string }>;
    return chatCompletionReply(request, JSON.stringify({ translations: items.map((i) => ({ id: i.id, text: `[en] ${i.text}` })) }));
  };
}

describe.skipIf(!engine)('字幕文件的翻译（网关 + 假供应商）', () => {
  let dir: string;
  let openai: FakeProviderServer;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let jobs: JobsSnapshot | null;
  const state = { calls: 0 };

  beforeEach(async () => {
    state.calls = 0;
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-subtitles-e2e-'));
    openai = await startFakeProviderServer(translator(state));
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
      jobIdleMs: 60_000,
      online: { baseUrls: { openai: `${openai.origin}/v1` }, http: { backoffMs: () => 10 } },
    });
    client = new CucCutClient({
      resolve: async () => runtime.discovery,
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    jobs = null;
    client.subscribeJobs({
      snapshot: (snapshot) => (jobs = snapshot),
      event: (event) => (jobs = applyJobsEvent(jobs!, event)),
    });
    await until(() => jobs);
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await openai.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function configure() {
    await client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await client.request('models.setDefault', { capability: 'generateText', providerId: 'openai' });
  }

  async function subtitleFile(): Promise<string> {
    const { project } = await client.request('projects.create', { name: '字幕' });
    const file = path.join(project.path, 'talk.srt');
    await fs.writeFile(file, SRT);
    return file;
  }

  const settled = (jobId: string): Promise<JobRecord> =>
    until(() => jobs!.jobs.find((j) => j.jobId === jobId && ['completed', 'failed', 'cancelled'].includes(j.state)));

  it('没有配置文本模型：以 CAPABILITY_NOT_CONFIGURED 拒绝，不改交智能体、不建任务', async () => {
    const input = await subtitleFile();
    const error = await client
      .request('pipelines.start', { pipeline: 'translate-subtitles', params: { input, targetLanguage: 'en' } })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'conflict', details: { code: 'CAPABILITY_NOT_CONFIGURED', capability: 'generateText' } });
    expect(await client.request('jobs.list', { children: true })).toEqual({ jobs: [] });
  });

  it('文件到文件：写出同样条数与时间码的译文字幕，不碰视频；输出是 Space 里带生成记录的条目', async () => {
    await configure();
    const input = await subtitleFile();
    // The output directory is the project directory that holds the source file, so the published file and the scanned one are the same entry (when not given, it is the save location; see pipelines.test.ts).
    const { jobId } = await client.request('pipelines.start', {
      pipeline: 'translate-subtitles',
      params: { input, targetLanguage: 'en', outDir: path.dirname(input) },
    });
    const job = await settled(jobId);
    expect(job, JSON.stringify(job.error)).toMatchObject({
      kind: 'pipeline',
      state: 'completed',
      videoId: null,
      providerId: 'openai',
      pipeline: { name: 'translate-subtitles', summary: { cueCount: 2, translatedCount: 2, markupStripped: 1 } },
    });
    const out = path.join(path.dirname(input), 'talk.en.srt');
    expect(await fs.readFile(out, 'utf8')).toBe(
      '1\n00:00:01,000 --> 00:00:02,000\n[en] 大家好\n\n2\n00:00:02,500 --> 00:00:04,000\n[en] 今天讲剪辑\n',
    );
    expect(job.result!.outputs![0]).toMatchObject({ path: out, mediaType: 'application/x-subrip', format: 'srt' });

    await client.request('space.rescan', {});
    await runtime.space.idle();
    const { entries } = await client.request('space.list', { kind: 'subtitle' });
    expect(entries.find((e) => e.fileName === 'talk.en.srt')).toMatchObject({
      status: 'published',
      ref: { artifactId: job.result!.outputs![0]!.artifactId },
      origin: { source: 'generated', jobId, capability: 'translate-subtitles', provider: { providerId: 'openai' } },
    });
    expect(entries.find((e) => e.fileName === 'talk.srt')!.origin).toBeUndefined();
  });

  it('字幕文本按 transcript 授权：撤销默认授权后启动即拒绝；桌面界面带待批准项、命令行不带；批准之后同一个 commandId 重新提交', async () => {
    await configure();
    const input = await subtitleFile();
    const byDefault = (await client.request('grants.list', { recipient: 'openai' })).grants.find((g) => g.origin === 'provider-enable')!;
    expect(byDefault.dataKinds).toContain('transcript');
    await client.request('grants.revoke', { grantId: byDefault.grantId });
    const before = (await client.request('grants.list', { includeEnded: true })).grants.length;

    const commandId = newId('cmd');
    const start = () =>
      client.request('pipelines.start', { pipeline: 'translate-subtitles', params: { input, targetLanguage: 'en' }, commandId });
    const refused = (await start().catch((e: unknown) => e)) as { code: string; details: Record<string, unknown> };
    expect(refused).toMatchObject({
      code: 'forbidden',
      details: { code: 'GRANT_REVOKED', recipient: 'openai', dataKinds: ['transcript'], remedy: { action: 'create-grant' } },
    });
    const pending = refused.details.pendingGrants as GrantRequestItem[];
    expect(pending).toEqual([
      expect.objectContaining({ capability: 'generateText', recipient: 'openai', dataKinds: ['transcript'], videoId: null }),
    ]);
    // A rejection grants nothing, loosens no authorization, creates no job, and sends nothing out.
    expect((await client.request('grants.list', { includeEnded: true })).grants).toHaveLength(before);
    expect(await client.request('jobs.list', { children: true })).toEqual({ jobs: [] });
    expect(state.calls).toBe(0);

    const cli = new CucCutClient({
      resolve: async () => runtime.discovery,
      client: { kind: 'cli', name: 'test', version: '0' },
      reconnect: false,
    });
    await cli.connect();
    try {
      const cliRefusal = (await cli
        .request('pipelines.start', { pipeline: 'translate-subtitles', params: { input, targetLanguage: 'en' } })
        .catch((e: unknown) => e)) as { details: Record<string, unknown> };
      expect(cliRefusal.details).toMatchObject({ code: 'GRANT_REVOKED', remedy: { action: 'create-grant' } });
      expect(cliRefusal.details).not.toHaveProperty('pendingGrants');
    } finally {
      cli.close();
    }

    for (const item of pending) await client.request('grants.create', grantCreateParamsFor(item));
    const { jobId } = await start();
    expect((await settled(jobId)).state).toBe('completed');
    expect(state.calls).toBe(1);
  });

  it('读不准的字幕文件：启动就以 SUBTITLE_FILE_INVALID 拒绝，带行号，不建任务', async () => {
    await configure();
    const { project } = await client.request('projects.create', { name: '坏字幕' });
    const input = path.join(project.path, 'broken.vtt');
    await fs.writeFile(input, '00:01.000 --> 00:02.000\nno header\n');
    const error = await client
      .request('pipelines.start', { pipeline: 'translate-subtitles', params: { input, targetLanguage: 'en' } })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'invalid-request', details: { code: 'SUBTITLE_FILE_INVALID', line: 1 } });
    expect(await client.request('jobs.list', { children: true })).toEqual({ jobs: [] });
  });

  it('命令行：cuccut translate --file 换格式、双语、输出目录与 --json；读不准的文件与视频输入同时给时报错', async () => {
    await configure();
    const input = await subtitleFile();
    const home = path.join(dir, 'home');
    const cwd = path.dirname(input);
    const ok = await cli(
      home,
      ['translate', '--file', 'talk.srt', '--to', 'en', '--format', 'vtt', '--bilingual', '--out-dir', 'out', '--json'],
      cwd,
    );
    expect(ok.code, ok.stderr).toBe(0);
    // Directory-derived command: stdout is the envelope, and the result is in `result` (the job summary is in job.pipeline.summary).
    const printed = JSON.parse(ok.stdout) as {
      ok: boolean;
      result: { jobId: string; job: { pipeline: { summary: { file: string; cueCount: number } } }; outputs: Array<{ path: string }> };
    };
    const out = path.join(cwd, 'out', 'talk.en.bilingual.vtt');
    expect(printed.ok).toBe(true);
    expect(printed.result).toMatchObject({
      job: { pipeline: { summary: { file: out, cueCount: 2, format: 'vtt', bilingual: true } } },
      outputs: [{ path: out }],
    });
    expect(await fs.readFile(out, 'utf8')).toBe(
      'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\n大家好\n[en] 大家好\n\n2\n00:00:02.500 --> 00:00:04.000\n今天讲剪辑\n[en] 今天讲剪辑\n',
    );

    await fs.writeFile(path.join(cwd, 'bad.srt'), '1\n00:00:01,000 -> 00:00:02,000\nA\n');
    const bad = await cli(home, ['translate', '--file', 'bad.srt', '--to', 'en'], cwd);
    // When stdout is not a TTY, a failure is also a one-line envelope (written to stdout).
    expect(bad.code).toBe(1);
    expect(bad.stdout + bad.stderr).toContain('SUBTITLE_FILE_INVALID');
    const both = await cli(home, ['translate', 'vid_1', '--file', 'talk.srt', '--to', 'en'], cwd);
    expect(both.code).not.toBe(0);
    expect(JSON.parse(both.stdout) as { ok: boolean }).toMatchObject({ ok: false });
  });
});
