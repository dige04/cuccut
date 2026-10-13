import { describe, expect, it, vi } from 'vitest';
import { RpcError, type ModelInstallPlan } from '@cuccut/protocol';
import type { HostBridge } from '../../host.ts';
import { RuntimeSession } from '../../runtime/session.ts';
import { bundle } from '../../model/models-test-fixtures.ts';
import { confirmInstall, planInstall, removeBundle, startSelfTest, stopInstall } from './local-model-actions.ts';

/**
 * The model package commands run through a real `RuntimeSession` (with added thin methods); only `client.request` is replaced with a fake: it records the method and arguments, and returns a result by method.
 * Nothing is downloaded and no Worker runs; install and check both stop at this layer.
 */

const QWEN = 'qwen3-asr-0.6b@mlx-4bit';

function plan(patch: Partial<ModelInstallPlan> = {}): ModelInstallPlan {
  return {
    bundleId: QWEN,
    components: [{ component: 'asr', repo: 'Qwen/Qwen3-ASR-0.6B', revision: 'abc', action: 'download', files: ['a.safetensors'], bytes: 400 }],
    downloadBytes: 400,
    estimatedBytes: 400,
    confirmBytes: 400,
    resumedBytes: 0,
    availableBytes: 10_000,
    source: 'https://huggingface.co',
    upToDate: false,
    ...patch,
  };
}

type Reply = (params: Record<string, unknown>) => unknown;

function fakeSession(replies: Record<string, Reply>) {
  const session = new RuntimeSession({} as HostBridge);
  const calls: [string, Record<string, unknown>][] = [];
  vi.spyOn(session.client, 'request').mockImplementation((async (method: string, params: Record<string, unknown>) => {
    calls.push([method, params]);
    const reply = replies[method];
    if (!reply) throw new Error(`没有料到的调用 ${method}`);
    return reply(params);
  }) as never);
  return { session, calls };
}

describe('install and repair: two-step confirmation', () => {
  it('step one only requests the plan, without confirmBytes and commandId', async () => {
    const { session, calls } = fakeSession({ 'models.install': () => ({ plan: plan(), jobId: null }), 'models.repair': () => ({ plan: plan(), jobId: null }) });
    await planInstall(session, 'install', QWEN);
    await planInstall(session, 'repair', QWEN);
    expect(calls).toEqual([
      ['models.install', { bundleId: QWEN }],
      ['models.repair', { bundleId: QWEN }],
    ]);
  });

  it('step two returns confirmBytes unchanged (with commandId) and gets the task', async () => {
    const { session, calls } = fakeSession({ 'models.install': () => ({ plan: plan(), jobId: 'job_1' }) });
    expect(await confirmInstall(session, 'install', plan())).toEqual({ kind: 'started', jobId: 'job_1' });
    expect(calls[0]![1]).toMatchObject({ bundleId: QWEN, confirmBytes: 400 });
    expect(calls[0]![1]).toHaveProperty('commandId');
  });

  it('size changed: bring back the new plan so the dialog confirms again; not counted as a failure', async () => {
    const next = plan({ confirmBytes: 520, downloadBytes: 520 });
    const error = new RpcError('conflict', '要下载的字节数变了，请按新的计划重新确认', { code: 'MODEL_INSTALL_SIZE_CHANGED', plan: next });
    const { session } = fakeSession({
      'models.repair': () => {
        throw error;
      },
    });
    expect(await confirmInstall(session, 'repair', plan())).toEqual({ kind: 'replan', plan: next });
  });

  it('already complete: no task', async () => {
    const done = plan({ upToDate: true, confirmBytes: 0, downloadBytes: 0 });
    const { session } = fakeSession({ 'models.repair': () => ({ plan: done, jobId: null }) });
    expect(await confirmInstall(session, 'repair', done)).toEqual({ kind: 'up-to-date', plan: done });
  });

  it('rejections such as strict offline mode or insufficient disk space are rethrown as is', async () => {
    const error = new RpcError('conflict', '严格离线模式下不下载模型', { code: 'OFFLINE_STRICT' });
    const { session } = fakeSession({
      'models.install': () => {
        throw error;
      },
    });
    await expect(confirmInstall(session, 'install', plan())).rejects.toBe(error);
  });
});

describe('stop, delete and check', () => {
  it('pause keeps what has been downloaded; cancelling the download deletes it too', async () => {
    const { session, calls } = fakeSession({ 'models.cancelInstall': () => ({ bundle: bundle(QWEN, { state: 'not-installed' }) }) });
    await stopInstall(session, QWEN, false);
    await stopInstall(session, QWEN, true);
    expect(calls).toEqual([
      ['models.cancelInstall', { bundleId: QWEN }],
      ['models.cancelInstall', { bundleId: QWEN, discard: true }],
    ]);
  });

  it('delete returns what Runtime actually deleted and what it kept; rethrown as is when in use', async () => {
    const result = { removed: ['Qwen/Qwen3-ASR-0.6B'], kept: [{ repo: 'silero/vad', usedBy: ['b@mlx'] }], bundle: bundle(QWEN, { state: 'not-installed' }) };
    const { session } = fakeSession({ 'models.remove': () => result });
    expect(await removeBundle(session, QWEN)).toEqual(result);

    const busy = new RpcError('conflict', '模型包正在使用', { code: 'MODEL_IN_USE', bundleId: QWEN, jobIds: ['job_2'] });
    const { session: other } = fakeSession({
      'models.remove': () => {
        throw busy;
      },
    });
    await expect(removeBundle(other, QWEN)).rejects.toBe(busy);
  });

  it('check submits one task (with commandId)', async () => {
    const { session, calls } = fakeSession({ 'models.test': () => ({ jobId: 'job_3' }) });
    expect(await startSelfTest(session, QWEN)).toBe('job_3');
    expect(calls[0]![0]).toBe('models.test');
    expect(calls[0]![1]).toMatchObject({ bundleId: QWEN });
    expect(calls[0]![1]).toHaveProperty('commandId');
  });
});
