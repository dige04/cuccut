import { AI_TOOL_PIPELINE, type DocumentRecord, type JobRecord } from '@cuccut/protocol';
import { describe, expect, it } from 'vitest';
import { aiToolJobFacts, aiToolRowState, pendingCutCount, soundtrackJobFacts, type AiToolRowFacts } from './ai-tool-row-state.ts';
import { toolJob } from './tools-test-fixtures.ts';

describe('aiToolRowState', () => {
  it('no status shown when nothing is present', () => {
    expect(aiToolRowState('polish', {})).toBeNull();
    expect(aiToolRowState('cleanup', { pendingCuts: 0, staleSentences: 0, chapters: 0, last: null, running: null })).toBeNull();
  });

  it('running: includes percentage; null when the percentage is unknown (the list writes \'running\')', () => {
    expect(aiToolRowState('polish', { running: { percent: 40 } })).toEqual({ kind: 'running', percent: 40 });
    expect(aiToolRowState('polish', { running: { percent: null } })).toEqual({ kind: 'running', percent: null });
  });

  it('unreviewed results and speaker proposals', () => {
    expect(aiToolRowState('summary', { result: true })).toEqual({ kind: 'result' });
    expect(aiToolRowState('speakers', { review: true })).toEqual({ kind: 'review' });
  });

  it('finding cut points: count of pending suggestions', () => {
    expect(aiToolRowState('cleanup', { pendingCuts: 3 })).toEqual({ kind: 'pending', count: 3 });
  });

  it('refresh stale translations: count of stale sentences', () => {
    expect(aiToolRowState('stale', { staleSentences: 5 })).toEqual({ kind: 'stale', count: 5 });
  });

  it('generate chapters: number of chapters on the timeline', () => {
    expect(aiToolRowState('chapters', { chapters: 4 })).toEqual({ kind: 'chapters', count: 4 });
  });

  it('last completed time; if that entry was undone, it shows as undone', () => {
    expect(aiToolRowState('title', { last: { at: '2026-10-09T08:00:00Z', undone: false } })).toEqual({ kind: 'last', at: '2026-10-09T08:00:00Z' });
    expect(aiToolRowState('polish', { last: { at: '2026-10-09T08:00:00Z', undone: true } })).toEqual({ kind: 'undone' });
  });

  it('pending, stale and chapters each count only their own tools', () => {
    const facts: AiToolRowFacts = { pendingCuts: 3, staleSentences: 5, chapters: 4 };
    expect(aiToolRowState('polish', facts)).toBeNull();
    expect(aiToolRowState('summary', facts)).toBeNull();
    expect(aiToolRowState('cleanup', facts)?.kind).toBe('pending');
    expect(aiToolRowState('stale', facts)?.kind).toBe('stale');
    expect(aiToolRowState('chapters', facts)?.kind).toBe('chapters');
  });

  describe('priority: running > pending > stale > chapters > last run', () => {
    const last = { at: '2026-10-09T08:00:00Z', undone: false };
    it('running overrides everything', () => {
      const all: AiToolRowFacts = { running: { percent: 10 }, result: true, review: true, pendingCuts: 2, staleSentences: 2, chapters: 2, last };
      for (const tool of ['cleanup', 'stale', 'chapters', 'speakers', 'polish'] as const) expect(aiToolRowState(tool, all)?.kind).toBe('running');
    });
    it('unreviewed results override chapters and last run', () => {
      expect(aiToolRowState('chapters', { result: true, chapters: 3, last })?.kind).toBe('result');
    });
    it('pending overrides last run', () => {
      expect(aiToolRowState('cleanup', { pendingCuts: 2, last })?.kind).toBe('pending');
    });
    it('stale overrides last run', () => {
      expect(aiToolRowState('stale', { staleSentences: 2, last })?.kind).toBe('stale');
    });
    it('chapters override last run and undone', () => {
      expect(aiToolRowState('chapters', { chapters: 3, last })?.kind).toBe('chapters');
      expect(aiToolRowState('chapters', { chapters: 3, last: { ...last, undone: true } })?.kind).toBe('chapters');
    });
  });
});

const job = (over: Partial<JobRecord> & { tool?: string; video?: string }): JobRecord =>
  ({
    jobId: over.jobId ?? 'job_1',
    kind: 'pipeline',
    state: 'completed',
    phase: 'done',
    progress: null,
    videoId: over.video ?? 'video_1',
    endedAt: '2026-10-09T08:00:00Z',
    updatedAt: '2026-10-09T08:00:00Z',
    pipeline: { name: AI_TOOL_PIPELINE, params: { videoId: over.video ?? 'video_1', tool: over.tool ?? 'polish' }, steps: [], current: null, stoppedAt: null, summary: null },
    ...over,
  }) as JobRecord;

describe('aiToolJobFacts', () => {
  it('per tool: running ones include the percentage, completed ones take the most recent; other videos, other flows and failed ones do not count', () => {
    const facts = aiToolJobFacts(
      [
        job({ jobId: 'a', tool: 'polish', endedAt: '2026-10-09T07:00:00Z' }),
        job({ jobId: 'b', tool: 'polish', endedAt: '2026-10-09T09:00:00Z' }),
        job({ jobId: 'c', tool: 'polish', state: 'failed', endedAt: '2026-10-09T10:00:00Z' }),
        job({ jobId: 'd', tool: 'summary', state: 'running', endedAt: null, progress: { done: 1, total: 4, unit: 'steps' } }),
        job({ jobId: 'e', tool: 'title', video: 'video_2' }),
        job({ jobId: 'f', tool: 'blog', pipeline: { name: 'dub', params: { videoId: 'video_1', tool: 'blog' }, steps: [], current: null, stoppedAt: null, summary: null } }),
      ],
      'video_1',
    );
    expect(facts.polish).toEqual({ running: null, last: { jobId: 'b', at: '2026-10-09T09:00:00Z' } });
    expect(facts.summary).toEqual({ running: { percent: 25 }, last: null });
    expect(facts.title).toBeUndefined();
    expect(facts.blog).toBeUndefined();
  });
});

const doc = (id: string, kind: string, revision = 'r1'): DocumentRecord => ({ id, kind, name: id, currentRevision: revision, revisions: {} });

describe('pendingCutCount', () => {
  const documents = { sp: doc('sp', 'speech', 'r2'), pr: doc('pr', 'editorial-proposal') };
  const body = (revision: string) => ({
    schema: 'cuccut.editorial-proposal/1',
    speechRef: { id: 'sp', revision },
    suggestions: [{ status: 'pending' }, { status: 'pending' }, { status: 'accepted' }],
  });
  it('counts only undecided suggestions', () => {
    expect(pendingCutCount([{ record: documents.pr, body: body('r2') }], documents)).toBe(2);
  });
  it('not counted when the transcription was edited or the proposal expired; not counted when the body has not arrived or is unrecognized', () => {
    expect(pendingCutCount([{ record: documents.pr, body: body('r1') }], documents)).toBe(0);
    expect(pendingCutCount([{ record: documents.pr, body: undefined }], documents)).toBe(0);
    expect(pendingCutCount([{ record: documents.pr, body: { schema: 'other' } }], documents)).toBe(0);
  });
});

describe('soundtrackJobFacts', () => {
  const music = (patch: Parameters<typeof toolJob>[0]) => toolJob({ kind: 'generateMusic', providerId: 'local', modelId: 'yue2-3b@audio-cpp-q8', videoId: 'v1', ...patch });

  it('looks only at this video\'s generateMusic tasks: running ones include the percentage, and the most recent completed one records its time', () => {
    const jobs = [
      music({ jobId: 'j1', state: 'running', progress: { done: 25, total: 100, unit: 'seconds' } }),
      music({ jobId: 'j2', state: 'completed', endedAt: '2026-10-10T01:00:00.000Z' }),
      music({ jobId: 'j3', state: 'completed', endedAt: '2026-10-11T01:00:00.000Z' }),
      music({ jobId: 'j4', state: 'completed', videoId: 'v2', endedAt: '2026-10-12T01:00:00.000Z' }),
      toolJob({ jobId: 'j5', state: 'running', videoId: 'v1' }),
    ];
    expect(soundtrackJobFacts(jobs, 'v1')).toEqual({ running: { percent: 25 }, last: { jobId: 'j3', at: '2026-10-11T01:00:00.000Z' } });
    expect(soundtrackJobFacts(jobs, 'v3')).toBeNull();
  });
});
