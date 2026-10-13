import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, type ReviewResult } from '@cuccut/protocol';
import {
  badgeOf,
  defaultCheckId,
  findingLine,
  formatReviewValue,
  groupFindings,
  isStale,
  limitInput,
  limitText,
  parseLimit,
  rubricLine,
  severityChange,
  skipText,
} from './review.ts';
import { answeredSince, rubricHandoff } from './review-rubric.ts';

beforeEach(() => {
  vi.stubEnv('CUCCUT_LOCALE', 'en');
  setLocale('en');
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

function result(over: Partial<ReviewResult> = {}): ReviewResult {
  return {
    schema: 'cuccut.review-result/1',
    videoId: 'vid_1',
    sequenceId: 'seq_1',
    videoName: 'Clip',
    at: '2026-10-13T10:00:00.000Z',
    revision: '7',
    criteriaSource: 'builtin',
    stages: ['project'],
    verdict: 'failed',
    checks: [
      { id: 'blank', metric: 'video.longestBlankSec', severity: 'suggestion', value: 1.25, limit: { max: 0.5 }, ok: false, fix: 'Close the gap.' },
      { id: 'placeholders', metric: 'items.placeholders', severity: 'critical', value: 2, limit: { max: 0 }, ok: false, fix: 'Fill them.' },
      { id: 'text-edge', metric: 'text.offCanvas', severity: 'suggestion', value: false, limit: { is: false }, ok: true, fix: 'Move it.' },
      {
        id: 'shots',
        metric: 'video.shots',
        severity: 'nitpick',
        value: 1,
        limit: { min: 3 },
        ok: false,
        fix: 'Cut more.',
        waived: { reason: 'One take on purpose', by: 'user' },
        lowered: { from: 'suggestion', reason: 'Fine for a teaser' },
      },
    ],
    rubric: [
      {
        id: 'hook-clear',
        ask: 'Is the hook clear?',
        severity: 'suggestion',
        fix: 'Rewrite the hook.',
        evidenceKind: 'timestamp',
        verdict: 'cannot-tell',
        evidence: '',
        note: 'The review did not reach this question.',
        ok: false,
      },
    ],
    skipped: [
      { id: 'square-only', reason: 'aspect', detail: '9:16' },
      { id: 'loud', reason: 'not-exported' },
      { id: 'hook-words', reason: 'unreadable', detail: 'hook.words' },
    ],
    measured: { project: {} },
    ...over,
  };
}

describe('review findings in the UI’s words', () => {
  it('groups open (most severe first), let stand, holds and not read; a waiver keeps the finding', () => {
    const groups = groupFindings(result());
    expect(groups.open.map((f) => f.id)).toEqual(['placeholders', 'blank', 'hook-clear']);
    expect(groups.waived.map((f) => f.id)).toEqual(['shots']);
    expect(groups.waived[0]).toMatchObject({ waived: { reason: 'One take on purpose', by: 'user' }, lowered: { from: 'suggestion' } });
    expect(groups.holds.map((f) => f.id)).toEqual(['text-edge']);
    expect(groups.skipped).toEqual([
      { id: 'square-only', why: 'Not for this shape (9:16)' },
      { id: 'loud', why: 'Needs a finished export first' },
      { id: 'hook-words', why: 'Hook words couldn’t be read on this video' },
    ]);
  });

  it('says what was found and what it was held to, with units', () => {
    expect(findingLine({ metric: 'items.placeholders', value: 2, limit: { max: 0 } })).toEqual({
      said: 'Placeholder boxes is 2',
      detail: 'asks for at most 0',
    });
    expect(findingLine({ metric: 'video.longestBlankSec', value: 1.256, limit: { max: 0.5 } }).said).toBe('Longest blank is 1.26 s');
    expect(findingLine({ metric: 'text.offCanvas', value: true, limit: { is: false } })).toEqual({ said: 'Text past the edge is yes', detail: 'asks for no' });
    expect(limitText({ min: 3, max: 60 }, 'video.durationSec')).toBe('3 s to 60 s');
    expect(limitText({ min: -16 })).toBe('at least -16');
    expect(formatReviewValue('unknown.metric', 4)).toBe('4');
    expect(findingLine({ metric: 'unknown.metric', value: 4, limit: {} })).toEqual({ said: 'unknown.metric is 4', detail: 'asks for anything' });
  });

  it('phrases answers, and a question the review did not reach as could not be told', () => {
    expect(rubricLine({ ask: 'Q?', verdict: 'cannot-tell', note: '', evidence: '' })).toEqual({ said: 'Q?', detail: 'could not be told' });
    expect(rubricLine({ ask: 'Q?', verdict: 'fails', note: 'Too slow', evidence: '00:04' }).detail).toBe('Too slow — 00:04');
    expect(rubricLine({ ask: 'Q?', verdict: 'holds', note: '', evidence: '' }).detail).toBe('holds');
    expect(skipText({ id: 'x', reason: 'unknown-metric', detail: 'video.fps' })).toBe('video.fps isn’t a measurement CucCut takes');
    expect(skipText({ id: 'x', reason: 'not-asked' })).toBe('The questions haven’t been asked yet');
  });
});

describe('parseLimit', () => {
  it('reads at most, at least and ranges, including negatives and decimals', () => {
    expect(parseLimit('≤ 60')).toEqual({ max: 60 });
    expect(parseLimit('<=60')).toEqual({ max: 60 });
    expect(parseLimit('≥ 3')).toEqual({ min: 3 });
    expect(parseLimit('>= 2.5')).toEqual({ min: 2.5 });
    expect(parseLimit('3–60')).toEqual({ min: 3, max: 60 });
    expect(parseLimit(' 3 - 60 ')).toEqual({ min: 3, max: 60 });
    expect(parseLimit('-16–-14')).toEqual({ min: -16, max: -14 });
    expect(parseLimit('0,5–1')).toEqual({ min: 0.5, max: 1 });
  });

  it('rejects a bare number, a backwards range and anything else', () => {
    expect(parseLimit('60')).toBeNull();
    expect(parseLimit('')).toBeNull();
    expect(parseLimit('60–3')).toBeNull();
    expect(parseLimit('about 60')).toBeNull();
    expect(parseLimit('≤')).toBeNull();
  });

  it('writes a limit back the way it reads', () => {
    for (const text of ['≤ 60', '≥ 3', '3–60', '-16–-14']) expect(limitInput(parseLimit(text)!)).toBe(text);
    expect(limitInput({ is: true })).toBe('yes');
  });
});

describe('ids, badges, staleness and severity changes', () => {
  it('derives a check id from the metric and suffixes it on collision', () => {
    expect(defaultCheckId('video.durationSec', [])).toBe('video-durationsec');
    expect(defaultCheckId('video.durationSec', ['video-durationsec', 'video-durationsec-2'])).toBe('video-durationsec-3');
  });

  it('gives a badge per verdict, and none checked reads as not checked', () => {
    expect(badgeOf({ verdict: 'passed' })).toBe('passed');
    expect(badgeOf({ verdict: 'passed-with-findings' })).toBe('findings');
    expect(badgeOf({ verdict: 'failed' })).toBe('failed');
    expect(badgeOf({ verdict: 'not-reviewed' })).toBe('notReviewed');
    expect(badgeOf(undefined)).toBe('notReviewed');
  });

  it('says which tier is older than the live video', () => {
    const r = result({
      measured: { project: {}, export: { bag: {}, jobId: 'job_1', revision: '5' } },
      answers: { revision: '7', at: '2026-10-13T10:00:00.000Z', by: 'agent', items: [] },
    });
    expect(isStale(r, '7')).toEqual({ project: false, export: true, answers: false, any: true });
    expect(isStale(r, '8')).toEqual({ project: true, export: true, answers: true, any: true });
    expect(isStale(result(), '7').any).toBe(false);
    expect(isStale(r, null).any).toBe(false);
  });

  it('tells raising (at once) from lowering (with a reason) and from giving the standard back', () => {
    expect(severityChange('suggestion', 'suggestion', 'critical')).toEqual({ kind: 'raise', severity: 'critical' });
    expect(severityChange('critical', 'critical', 'suggestion')).toEqual({ kind: 'lower', severity: 'suggestion' });
    expect(severityChange('critical', 'nitpick', 'suggestion')).toEqual({ kind: 'lower', severity: 'suggestion' });
    expect(severityChange('critical', 'nitpick', 'critical')).toEqual({ kind: 'restore' });
    expect(severityChange('suggestion', 'critical', 'suggestion')).toEqual({ kind: 'restore' });
    expect(severityChange('suggestion', 'suggestion', 'suggestion')).toEqual({ kind: 'none' });
  });
});

describe('the judged pass handed to the agent', () => {
  const source = { projectId: 'prj_1', conversationId: null };
  const conversations = [
    { id: 'c_old', projectId: 'prj_1', title: 'old', archived: false, updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'c_new', projectId: 'prj_1', title: 'new', archived: false, updatedAt: '2026-10-12T00:00:00Z' },
    { id: 'c_other', projectId: 'prj_2', title: 'other', archived: false, updatedAt: '2026-10-13T00:00:00Z' },
  ];

  it('goes to the video’s own conversation, else a new one, and names the tools', () => {
    const plan = rubricHandoff({ videoId: 'vid_1', video: { name: 'Teaser', source }, current: null, conversations });
    expect(plan.session).toEqual({ id: 'c_new' });
    expect(plan.text).toContain('“Teaser”');
    expect(plan.text).toContain('review_criteria');
    expect(plan.text).toContain('review_answer');
    expect(rubricHandoff({ videoId: 'vid_1', video: { name: 'Teaser', source }, current: 'c_old', conversations }).session).toEqual({ id: 'c_old' });
    expect(rubricHandoff({ videoId: 'vid_1', video: null, current: null, conversations }).session).toBe('new');
  });

  it('counts answers given since the questions were asked', () => {
    expect(answeredSince(undefined, '2026-10-13T10:00:00Z')).toBe(false);
    expect(answeredSince({ at: '2026-10-13T09:59:59Z' }, '2026-10-13T10:00:00Z')).toBe(false);
    expect(answeredSince({ at: '2026-10-13T10:00:01Z' }, '2026-10-13T10:00:00Z')).toBe(true);
  });
});
