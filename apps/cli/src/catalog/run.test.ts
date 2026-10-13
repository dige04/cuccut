import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogListResult, ModelInstallResult, RuntimeInfo } from '@cuccut/protocol';
import { defaultTranscribeBundle as modelsDefault } from '../../../../packages/models/src/bundle-registry.ts';
import type { Session } from '../runtime/connection.ts';
import { FakeClient, captureOutput, jobRecord } from '../testing/fake-client.ts';
import { buildTree, type CatalogCommand } from './command-tree.ts';
import { defaultGlobals, type GlobalFlags } from './flags.ts';
import { defaultTranscribeBundle, runTool, spill } from './run.ts';
import { loadSnapshot } from './snapshot.ts';

const snapshot = loadSnapshot();
if (!snapshot) throw new Error('没有目录快照：先运行 npm run build:catalog');
const tree = buildTree(snapshot.tools);

function command(noun: string, verb?: string): CatalogCommand {
  return verb === undefined ? tree.verbs.get(noun)! : tree.nouns.get(noun)!.get(verb)!;
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function setup(target: CatalogCommand, args: Record<string, unknown>, globals: Partial<GlobalFlags> = {}) {
  const fake = new FakeClient();
  const captured = captureOutput(true);
  const session: Session = { client: fake.client, info: {} as RuntimeInfo, started: false, catalog: snapshot as CatalogListResult };
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-cli-run-'));
  dirs.push(cwd);
  const run = () =>
    runTool({ session, command: target, args, globals: { ...defaultGlobals(), json: true, ...globals }, cwd, output: captured.output });
  return { fake, run, ...captured };
}

/** Task record pushed by the Runtime after submission. */
function later(fake: FakeClient, ...records: Parameters<typeof jobRecord>[0][]): void {
  setTimeout(() => {
    fake.snapshot([]);
    for (const record of records) fake.emit(jobRecord(record));
  }, 5);
}

describe('runTool: waits for the task (Agent surface design §5.2, §5.4)', () => {
  it('task failure gives an exit code by error code: 2 when the user must act, otherwise 1; needs-reconciliation counts as a failure', async () => {
    const cases = [
      { state: 'failed', error: { code: 'TOOL_CONSENT_REQUIRED', message: '要同意' }, exit: 2, code: 'TOOL_CONSENT_REQUIRED' },
      { state: 'failed', error: { code: 'MEDIA_DECODE_FAILED', message: '解不开' }, exit: 1, code: 'MEDIA_DECODE_FAILED' },
      { state: 'cancelled', error: null, exit: 1, code: 'JOB_CANCELLED' },
      { state: 'needs-reconciliation', error: null, exit: 1, code: 'JOB_NEEDS_RECONCILIATION' },
    ] as const;
    for (const item of cases) {
      const { fake, run, envelope } = setup(command('transcode'), { files: ['a.mp4'] });
      fake.tools.transcode = () => {
        later(fake, { jobId: 'job_1', state: item.state, error: item.error as never });
        return { ok: true, result: { jobId: 'job_1', next: '用 jobs_wait 等它结束' } };
      };
      fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_1', state: item.state, next: '看看 error' } });
      expect(await run(), item.state).toBe(item.exit);
      const body = envelope();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe(item.code);
      expect(body.error.next).toBe('看看 error');
      expect(body.error.job.next).toBeUndefined();
    }
  });

  it('completed: next appears only once, at the top level of the JSON envelope', async () => {
    const { fake, run, envelope } = setup(command('transcode'), { files: ['a.mp4'] });
    fake.tools.transcode = () => {
      later(fake, { jobId: 'job_1', state: 'completed' });
      return { ok: true, result: { jobId: 'job_1', next: '用 jobs_wait 等它结束' } };
    };
    fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_1', state: 'completed', outputs: [], next: '把产物给用户' } });
    expect(await run()).toBe(0);
    const body = envelope();
    expect(body.next).toBe('把产物给用户');
    expect(body.result.next).toBeUndefined();
    expect(body.result.job.next).toBeUndefined();
    expect(body.result.job.state).toBe('completed');
  });

  it('completed: the state in the submit receipt becomes the terminal state, matching job.state', async () => {
    const { fake, run, envelope } = setup(command('transcode'), { files: ['a.mp4'] });
    fake.tools.transcode = () => {
      later(fake, { jobId: 'job_1', state: 'completed' });
      return { ok: true, result: { jobId: 'job_1', kind: 'transcode', state: 'queued', next: '用 jobs_wait 等它结束' } };
    };
    fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_1', state: 'completed', outputs: [], next: '把产物给用户' } });
    expect(await run()).toBe(0);
    const body = envelope();
    expect(body.result.state).toBe('completed');
    expect(body.result.job.state).toBe('completed');
    expect(body.result.kind).toBe('transcode');
  });

  it('--timeout reached: WAIT_TIMEOUT, exit code 1, the task continues, next is cuccut jobs wait', async () => {
    const { fake, run, envelope } = setup(command('transcode'), { files: ['a.mp4'] }, { timeout: 0.05 });
    fake.tools.transcode = () => {
      later(fake, { jobId: 'job_1', state: 'running' });
      return { ok: true, result: { jobId: 'job_1' } };
    };
    expect(await run()).toBe(1);
    expect(envelope().error).toMatchObject({ code: 'WAIT_TIMEOUT', jobId: 'job_1', state: 'running', next: 'cuccut jobs wait job_1' });
    expect(fake.calls.map((call) => call.method)).not.toContain('jobs.cancel');
  });

  it('jobs retry: only counts records after the attempt in the result; the failure of the earlier attempt does not count', async () => {
    const { fake, run, envelope } = setup(command('jobs', 'retry'), { jobId: 'job_9' });
    fake.tools.jobs_retry = () => {
      setTimeout(() => {
        fake.snapshot([jobRecord({ jobId: 'job_9', state: 'failed', attempt: 1, error: { code: 'X', message: '上一次' } as never })]);
        setTimeout(() => fake.emit(jobRecord({ jobId: 'job_9', state: 'completed', attempt: 2 })), 10);
      }, 5);
      return { ok: true, result: { jobId: 'job_9', attempt: 2 } };
    };
    fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_9', state: 'completed', attempt: 2 } });
    expect(await run()).toBe(0);
    expect(envelope().result.job).toMatchObject({ state: 'completed', attempt: 2 });
  });
});

describe('runTool: jobs wait does not call jobs_wait, it takes the same path as the default wait', () => {
  it('waits until completed: exit code 0, with job; does not call jobs_wait', async () => {
    const { fake, run, envelope } = setup(command('jobs', 'wait'), { jobId: 'job_1' });
    fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_1', state: 'completed' } });
    fake.methods['jobs.inspect'] = () => {
      later(fake, { jobId: 'job_1', state: 'completed' });
      return jobRecord({ jobId: 'job_1', state: 'running' });
    };
    expect(await run()).toBe(0);
    expect(envelope().result).toMatchObject({ jobId: 'job_1', job: { state: 'completed' } });
    expect(fake.toolCalls()).not.toContain('jobs_wait');
  });

  it('already failed: exit code by error code (needing authorization is 2)', async () => {
    const { fake, run, envelope } = setup(command('jobs', 'wait'), { jobId: 'job_1' });
    fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_1', state: 'failed' } });
    fake.methods['jobs.inspect'] = () =>
      jobRecord({ jobId: 'job_1', state: 'failed', error: { code: 'GRANT_REQUIRED', message: '要授权' } as never });
    expect(await run()).toBe(2);
    expect(envelope().error.code).toBe('GRANT_REQUIRED');
  });

  it('--timeout (or --timeout-sec) reached: WAIT_TIMEOUT, exit code 1', async () => {
    const { fake, run, envelope } = setup(command('jobs', 'wait'), { jobId: 'job_1' }, { timeout: 0.05 });
    fake.tools.jobs_inspect = () => ({ ok: true, result: { jobId: 'job_1', state: 'running' } });
    fake.methods['jobs.inspect'] = () => jobRecord({ jobId: 'job_1', state: 'running' });
    expect(await run()).toBe(1);
    expect(envelope().error).toMatchObject({ code: 'WAIT_TIMEOUT', next: 'cuccut jobs wait job_1' });
  });

  it('task not visible: the jobs_inspect error is given as is', async () => {
    const { fake, run, envelope } = setup(command('jobs', 'wait'), { jobId: 'job_x' });
    fake.tools.jobs_inspect = () => ({ ok: false, error: { code: 'JOB_NOT_FOUND', message: '没有这个任务' } });
    expect(await run()).toBe(1);
    expect(envelope().error.code).toBe('JOB_NOT_FOUND');
    expect(fake.subscribed).toBe(false);
  });
});

describe('runTool: models install reports the size first (§4.3)', () => {
  const plan = (overrides: Partial<ModelInstallResult['plan']> = {}): ModelInstallResult['plan'] =>
    ({
      bundleId: 'qwen3-asr-0.6b@candle',
      components: [{ component: 'asr', repo: 'org/asr', revision: 'r', action: 'download', files: ['a'], bytes: 1_500_000_000 }],
      downloadBytes: 1_500_000_000,
      estimatedBytes: 1_500_000_000,
      confirmBytes: 1_500_000_000,
      resumedBytes: 0,
      source: 'huggingface.co',
      upToDate: false,
      ...overrides,
    }) as ModelInstallResult['plan'];

  it('no --yes: only fetches the plan, does not download; CONFIRMATION_REQUIRED (exit code 4) with package name, size and next', async () => {
    const { fake, run, envelope } = setup(command('models', 'install'), {});
    fake.methods['models.install'] = (params) => ({ plan: plan({ bundleId: params.bundleId as string }), jobId: null });
    expect(await run()).toBe(4);
    const error = envelope().error;
    expect(error).toMatchObject({ code: 'CONFIRMATION_REQUIRED', bundleId: defaultTranscribeBundle(), downloadBytes: 1_500_000_000 });
    expect(error.size).toBe('1.4 GB');
    expect(error.next).toBe(`cuccut models install --bundle-id ${defaultTranscribeBundle()} --yes`);
    expect(fake.calls).toEqual([{ method: 'models.install', params: { bundleId: defaultTranscribeBundle() } }]);
  });

  it('already installed or downloading: calls the tool as usual (it does not download again); with --yes, no separate plan is fetched', async () => {
    const upToDate = setup(command('models', 'install'), { bundleId: 'b' });
    upToDate.fake.methods['models.install'] = () => ({ plan: plan({ bundleId: 'b', upToDate: true }), jobId: null });
    upToDate.fake.tools.models_install = () => ({ ok: true, result: { jobId: null, bundleId: 'b' } });
    expect(await upToDate.run()).toBe(0);
    expect(upToDate.fake.toolCalls()).toEqual(['models_install']);

    const confirmed = setup(command('models', 'install'), { bundleId: 'b' }, { yes: true, wait: false });
    confirmed.fake.tools.models_install = () => ({ ok: true, result: { jobId: 'job_1', bundleId: 'b' } });
    expect(await confirmed.run()).toBe(0);
    expect(confirmed.fake.calls.map((call) => call.method)).toEqual(['catalog.call']);
  });

  it('the default transcription model pack is the same as @cuccut/models', () => {
    for (const [platform, arch] of [
      ['darwin', 'arm64'],
      ['darwin', 'x64'],
      ['win32', 'x64'],
      ['linux', 'arm64'],
    ] as const) {
      expect(defaultTranscribeBundle(platform, arch)).toBe(modelsDefault(platform, arch));
    }
  });
});

describe('large results are written to disk (§5.5)', () => {
  it('states the coverage and the arguments to keep reading: top-level keys, array length, file, suggested --max-bytes and paging flags', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-cli-spill-'));
    dirs.push(cwd);
    const result = {
      videoId: 'v1',
      items: Array.from({ length: 300 }, (_, i) => ({ id: `item_${i}`, text: 'x'.repeat(20) })),
      next: '下一步',
    };
    const spilled = spill(
      { globals: { ...defaultGlobals(), maxBytes: 1024 }, cwd, command: command('videos', 'inspect') },
      result,
    ) as Record<string, any>;
    expect(spilled.truncated).toBe(true);
    expect(JSON.parse(fs.readFileSync(spilled.path, 'utf8'))).toEqual(result);
    expect(spilled.coverage).toEqual({ keys: ['videoId', 'items'], arrays: { items: 300 } });
    expect(spilled.continueWith.file).toBe(spilled.path);
    expect(spilled.continueWith.maxBytes).toBeGreaterThanOrEqual(spilled.bytes);
    expect(spilled.continueWith.paging).toEqual(['--from-seconds', '--to-seconds', '--limit']);

    const chosen = spill(
      { globals: { ...defaultGlobals(), resultFile: 'out/full.json' }, cwd, command: command('videos', 'inspect') },
      { a: 1 },
    ) as Record<string, any>;
    expect(chosen.path).toBe(path.join(cwd, 'out', 'full.json'));
  });
});
