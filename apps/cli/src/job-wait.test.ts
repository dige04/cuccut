import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ProgressReporter } from './catalog/progress.ts';
import { CliError } from './envelope.ts';
import { isFinished, waitForJob, watchJobs } from './job-wait.ts';
import { FakeClient, jobRecord } from './testing/fake-client.ts';

const progress = () => new ProgressReporter('jsonl', new PassThrough());
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('waitForJob (Agent surface design §5.4)', () => {
  it('terminal states match isTerminal in packages/jobs: needs-reconciliation counts; an interruption from a Worker retry does not count', () => {
    for (const state of ['completed', 'failed', 'cancelled', 'needs-reconciliation'] as const) {
      expect(isFinished(jobRecord({ jobId: 'j', state })), state).toBe(true);
    }
    expect(isFinished(jobRecord({ jobId: 'j', state: 'running' }))).toBe(false);
    expect(isFinished(jobRecord({ jobId: 'j', state: 'interrupted', error: { code: 'WORKER_CRASHED', message: 'x' } as never }))).toBe(
      false,
    );
    expect(isFinished(jobRecord({ jobId: 'j', state: 'interrupted', error: { code: 'JOB_INTERRUPTED', message: 'x' } as never }))).toBe(
      true,
    );
  });

  it('subscribed events end at a terminal state; needs-reconciliation also ends', async () => {
    const fake = new FakeClient();
    const watcher = watchJobs(fake.client);
    const waiting = waitForJob(fake.client, 'job_1', watcher, { progress: progress() });
    fake.snapshot([jobRecord({ jobId: 'job_1', state: 'running' })]);
    await tick();
    fake.emit(jobRecord({ jobId: 'job_other', state: 'failed' }));
    fake.emit(jobRecord({ jobId: 'job_1', state: 'needs-reconciliation' }));
    await expect(waiting).resolves.toMatchObject({ kind: 'finished', job: { state: 'needs-reconciliation' } });
    expect(fake.subscribed).toBe(false);
  });

  it('minAttempt: the terminal state of an earlier attempt does not count (jobs retry reuses the same jobId)', async () => {
    const fake = new FakeClient();
    const watcher = watchJobs(fake.client);
    fake.snapshot([jobRecord({ jobId: 'job_1', state: 'failed', attempt: 1 })]);
    const waiting = waitForJob(fake.client, 'job_1', watcher, { progress: progress(), minAttempt: 2 });
    let settled = false;
    void waiting.then(() => (settled = true));
    await tick();
    expect(settled).toBe(false);
    fake.emit(jobRecord({ jobId: 'job_1', state: 'running', attempt: 2 }));
    fake.emit(jobRecord({ jobId: 'job_1', state: 'completed', attempt: 2 }));
    await expect(waiting).resolves.toMatchObject({ kind: 'finished', job: { state: 'completed', attempt: 2 } });
  });

  it('initial: when the snapshot has not arrived yet, uses the record already fetched; an already ended job need not wait', async () => {
    const fake = new FakeClient();
    const watcher = watchJobs(fake.client);
    const initial = jobRecord({ jobId: 'job_1', state: 'failed', error: { code: 'GRANT_REQUIRED', message: '要授权' } as never });
    await expect(waitForJob(fake.client, 'job_1', watcher, { progress: progress(), initial })).resolves.toMatchObject({
      kind: 'finished',
      job: { state: 'failed' },
    });
  });

  it('timeout: the result is timeout with the latest record, the task is not cancelled', async () => {
    const fake = new FakeClient();
    const watcher = watchJobs(fake.client);
    fake.snapshot([jobRecord({ jobId: 'job_1', state: 'running' })]);
    const outcome = await waitForJob(fake.client, 'job_1', watcher, { progress: progress(), timeoutSec: 0.05 });
    expect(outcome).toMatchObject({ kind: 'timeout', job: { state: 'running' } });
    expect(fake.calls.map((call) => call.method)).not.toContain('jobs.cancel');
  });

  it('connection lost: RUNTIME_UNAVAILABLE (exit code 3), with jobId', async () => {
    const fake = new FakeClient();
    const watcher = watchJobs(fake.client);
    const waiting = waitForJob(fake.client, 'job_1', watcher, { progress: progress() });
    fake.disconnect('Runtime 退出了');
    const error = await waiting.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(CliError);
    expect(error).toMatchObject({ code: 'RUNTIME_UNAVAILABLE', extra: { jobId: 'job_1' } });
  });
});
