import { describe, expect, it } from 'vitest';
import type { JobRecord } from '@cuccut/protocol';
import { job, task } from '../testing/task-records.ts';
import { jobRow, agentRow, type TaskContext, type TaskRow } from './task-list.ts';
import { CARD_MAX, pillCard, pillFace, pillLabel, pillList, pillRow } from './task-pill.ts';

const ctx: TaskContext = { projects: [], conversations: [{ id: 'c2', projectId: null, activity: 'awaiting-approval' }] };
const NOW = Date.parse('2026-10-01T10:00:00Z');
const at = (minute: number) => `2026-10-01T09:${String(minute).padStart(2, '0')}:00Z`;

/** A Job row; when `videoId` is not given it belongs to the open video v1. */
const jobAt = (jobId: string, minute: number, patch: Partial<JobRecord> = {}) =>
  jobRow(job({ jobId, startedAt: at(minute), createdAt: at(minute), ...patch }), ctx);

const ids = (rows: TaskRow[]) => rows.map((r) => r.id);

describe('pillList', () => {
  it('only includes live ones: running, queued, awaiting approval; finished ones stay out of the table', () => {
    const rows = [
      jobAt('run', 1),
      jobAt('queue', 2, { state: 'queued', startedAt: null }),
      jobAt('done', 3, { state: 'completed' }),
      agentRow(task({ taskId: 'wait', conversationId: 'c2', startedAt: at(4) }), ctx),
      agentRow(task({ taskId: 'over', status: 'stopped', startedAt: at(5) }), ctx),
    ];
    expect(ids(pillList(rows))).toEqual(['wait', 'run', 'queue']);
  });

  it('sort order: the one being viewed → this video\'s → other running → queued; within a tier, later ones first', () => {
    const rows = [
      jobAt('other-old', 1, { videoId: 'v2' }),
      jobAt('other-new', 5, { videoId: 'v2' }),
      jobAt('other-queued', 9, { videoId: 'v2', state: 'queued', startedAt: null }),
      jobAt('mine-old', 2),
      jobAt('mine-new', 3),
      jobAt('focus', 0, { videoId: 'v3' }),
    ];
    expect(ids(pillList(rows, { videoId: 'v1', focusId: 'focus' }))).toEqual([
      'focus',
      'mine-new',
      'mine-old',
      'other-new',
      'other-old',
      'other-queued',
    ]);
  });

  it('this video\'s exports stay out of the table; other videos\' exports are included as usual', () => {
    const mineExport: TaskRow = { ...jobAt('mine-export', 1), kind: 'export' };
    const otherExport: TaskRow = { ...jobAt('other-export', 2, { videoId: 'v2' }), kind: 'export' };
    expect(ids(pillList([mineExport, otherExport, jobAt('mine', 3)], { videoId: 'v1' }))).toEqual(['mine', 'other-export']);
  });

  it('mineOnly reports only this video\'s; agent tasks have no video and stay out of the video bar\'s capsule; with no video open, nothing is reported', () => {
    const rows = [jobAt('mine', 1), jobAt('other', 2, { videoId: 'v2' }), agentRow(task({ taskId: 'agent', startedAt: at(3) }), ctx)];
    expect(ids(pillList(rows, { videoId: 'v1', mineOnly: true }))).toEqual(['mine']);
    expect(ids(pillList(rows, { videoId: null, mineOnly: true }))).toEqual([]);
  });
});

describe('pillFace / pillLabel', () => {
  it('"+N" always equals the number of other rows in the card; not drawn when the table is empty', () => {
    const list = [jobAt('a', 3, { progress: { done: 37, total: 100, unit: 'seconds' } }), jobAt('b', 2), jobAt('c', 1)];
    const face = pillFace(list)!;
    expect(face.label).toBe('转录 · 37%');
    expect(face.more).toBe(2);
    expect(face.more).toBe(pillCard(list, 'v1', NOW).rows.length - 1);
    expect(pillFace([])).toBeNull();
  });

  it('indeterminate progress reads only the kind; queued reads "排队中"; awaiting approval reads "需要你确认"', () => {
    expect(pillLabel(jobAt('a', 1))).toBe('转录');
    expect(pillLabel(jobAt('b', 1, { state: 'queued' }))).toBe('转录 · 排队中');
    expect(pillLabel(agentRow(task({ taskId: 'w', conversationId: 'c2' }), ctx))).toBe('Agent 任务 · 需要你确认');
  });
});

describe('pillRow / pillCard', () => {
  it('a row: title, stage · where, start time · this video, progress', () => {
    const row = pillRow(jobAt('a', 15, { progress: { done: 1, total: 4, unit: 'segments' } }), 'v1', NOW);
    expect(row).toEqual({
      id: 'a',
      title: '转录',
      detail: '识别中 · whisper-large-v3 · 本机',
      meta: '45 分钟前开始 · 这个视频',
      state: '25%',
      progress: 25,
      cancellable: true,
    });
  });

  it('just-started reads "刚开始"; queued shows no start time or progress bar; indeterminate progress spins', () => {
    const fresh = pillRow(jobRow(job({ jobId: 'f', startedAt: '2026-10-01T09:59:40Z' }), ctx), null, NOW);
    expect(fresh.meta).toBe('刚开始');
    expect(fresh.progress).toBe('indet');
    const queued = pillRow(jobAt('q', 1, { state: 'queued', videoId: 'v2' }), 'v1', NOW);
    expect(queued.meta).toBe('');
    expect(queued.progress).toBeNull();
  });

  it(`with several items, a count header, at most ${CARD_MAX} rows and an overflow count; with one item, no count header`, () => {
    const list = Array.from({ length: 7 }, (_, i) => jobAt(`j${i}`, i));
    const card = pillCard(list, 'v1', NOW);
    expect(card).toMatchObject({ multi: true, title: '7 个后台任务', overflow: 2 });
    expect(card.rows).toHaveLength(CARD_MAX);
    expect(pillCard(list.slice(0, 1), 'v1', NOW)).toMatchObject({ multi: false, title: null, overflow: 0 });
  });
});
