import { describe, expect, it } from 'vitest';
import { HIDDEN_LIMIT, aheadOf, didNotFinish, failureText, hideJob, listedRecords, liveCount, phaseLabel, queuedDetail, recordStatus, stateLabel, toolJobs } from './tools-records.ts';
import { imageJob, toolJob } from './tools-test-fixtures.ts';

describe('records on the tools page', () => {
  const jobs = [
    toolJob({ jobId: 'old', createdAt: '2026-10-03T00:00:00.000Z', state: 'completed' }),
    toolJob({ jobId: 'new', createdAt: '2026-10-03T00:05:00.000Z' }),
    toolJob({ jobId: 'video', videoId: 'vid_1' }),
    toolJob({ jobId: 'agent', submitter: { kind: 'agent', id: 'conv_1', taskId: 'task_1' } }),
    imageJob({ jobId: 'image' }),
  ];

  it('lists only UI-submitted tasks that are not video tasks, newest first; hidden ones are not listed', () => {
    expect(toolJobs(jobs, 'synthesizeSpeech', []).map((j) => j.jobId)).toEqual(['new', 'old']);
    expect(toolJobs(jobs, 'synthesizeSpeech', ['new']).map((j) => j.jobId)).toEqual(['old']);
    expect(toolJobs(jobs, 'generateImage', []).map((j) => j.jobId)).toEqual(['image']);
  });

  it('count of in-progress items', () => {
    expect(liveCount(toolJobs(jobs, 'synthesizeSpeech', []))).toBe(1);
  });

  it('cancelled ones are not listed; ones that may already be billed are kept as they are', () => {
    const cancel = (cost: 'none' | 'possible' | 'charged') => ({ requestedAt: '2026-10-03T00:00:00.000Z', localStoppedAt: null, remote: 'unknown' as const, cost });
    const list = [
      toolJob({ jobId: 'done', state: 'completed' }),
      toolJob({ jobId: 'free', state: 'cancelled' }),
      toolJob({ jobId: 'none', state: 'cancelled', cancellation: cancel('none') }),
      toolJob({ jobId: 'maybe', state: 'cancelled', cancellation: cancel('possible') }),
      toolJob({ jobId: 'paid', state: 'cancelled', cancellation: cancel('charged') }),
    ];
    expect(listedRecords(list).map((j) => j.jobId)).toEqual(['done', 'maybe', 'paid']);
  });

  it('how many are ahead: earlier submissions on the same provider that have not finished (video ones also count in the queue)', () => {
    const all = [
      toolJob({ jobId: 'a', state: 'running', createdAt: '2026-10-03T00:00:00.000Z' }),
      toolJob({ jobId: 'b', state: 'queued', videoId: 'vid_1', createdAt: '2026-10-03T00:00:01.000Z' }),
      toolJob({ jobId: 'c', state: 'queued', providerId: 'elevenlabs', createdAt: '2026-10-03T00:00:01.500Z' }),
      toolJob({ jobId: 'd', state: 'completed', createdAt: '2026-10-03T00:00:01.800Z' }),
      toolJob({ jobId: 'me', state: 'queued', createdAt: '2026-10-03T00:00:02.000Z' }),
    ];
    expect(aheadOf(all, all[4]!)).toBe(2);
    expect(aheadOf(all, all[0]!)).toBe(0);
  });

  it('while queued, says what the Runtime recorded it is waiting for; null when nothing is recorded (falls back to estimate); not read out once running', () => {
    const wait = { reason: 'concurrency' as const, ahead: 1, detail: '排队中：同一队列前面还有 1 个任务', since: '2026-10-03T00:00:00.000Z' };
    expect(queuedDetail(toolJob({ state: 'queued', wait }))).toBe('排队中：同一队列前面还有 1 个任务');
    expect(queuedDetail(toolJob({ state: 'queued' }))).toBeNull();
    expect(queuedDetail(toolJob({ state: 'running', wait }))).toBeNull();
  });

  it('hidden records are not counted twice; at most HIDDEN_LIMIT are counted', () => {
    expect(hideJob(['a'], 'a')).toEqual(['a']);
    expect(hideJob(['a'], 'b')).toEqual(['a', 'b']);
    const many = Array.from({ length: HIDDEN_LIMIT }, (_, i) => `j${i}`);
    const next = hideJob(many, 'last');
    expect(next).toHaveLength(HIDDEN_LIMIT);
    expect(next[0]).toBe('j1');
    expect(next.at(-1)).toBe('last');
  });
});

describe('status of the record card', () => {
  const now = Date.parse('2026-10-03T00:10:00.000Z');

  it('finished ones show how long ago; the rest show status', () => {
    expect(recordStatus(toolJob({ state: 'completed' }))).toBe('done');
    expect(stateLabel(toolJob({ state: 'completed', endedAt: '2026-10-03T00:07:00.000Z' }), now)).toBe('3 分钟前');
    expect(stateLabel(toolJob({ state: 'running' }), now)).toBe('生成中');
    expect(stateLabel(toolJob({ state: 'queued' }), now)).toBe('排队中');
    expect(stateLabel(toolJob({ state: 'cancelled' }), now)).toBe('已取消');
  });

  it('a stage shows which image of how many and a percentage; percentage omitted when the total is unknown', () => {
    expect(phaseLabel({ phase: 'generating', progress: { done: 1, total: 4, unit: 'outputs' } })).toBe('生成中 1/4 · 25%');
    expect(phaseLabel({ phase: 'generating', progress: null })).toBe('生成中');
    expect(phaseLabel({ phase: 'publishing', progress: { done: 3, total: null, unit: 'seconds' } })).toBe('保存结果');
  });

  it('one sentence when it failed', () => {
    expect(failureText({ state: 'failed', error: { code: 'PROVIDER_REJECTED', message: '服务商拒绝了这条提示词' } })).toBe('服务商拒绝了这条提示词');
    expect(failureText({ state: 'interrupted', error: null })).toBe('Runtime 停止或重启，这一条没有做完');
    expect(failureText({ state: 'needs-reconciliation', error: null })).toBe('Runtime 重启时这次调用还没有回音，结果不明，可能已经计费');
    expect(failureText({ state: 'failed', error: null })).toBe('没有生成出来');
    const ended = '2026-10-01T09:00:00Z';
    expect(
      ['failed', 'interrupted', 'needs-reconciliation', 'cancelled', 'completed'].map((state) => didNotFinish({ state: state as never, endedAt: ended })),
    ).toEqual([true, true, true, false, false]);
  });

  it('after a crash, items auto-re-running (interrupted, no endedAt yet) count as running, not failed', () => {
    expect(didNotFinish({ state: 'interrupted', endedAt: null })).toBe(false);
    expect(recordStatus({ state: 'interrupted', endedAt: null })).toBe('running');
    expect(stateLabel({ state: 'interrupted', endedAt: null, createdAt: '2026-10-01T09:00:00Z' }, 0)).toBe('生成中');
  });
});
