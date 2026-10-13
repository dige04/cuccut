import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError, emptyReviewPlan, emptyReviewStandard, setLocale, type ReviewCheck, type ReviewCriteriaView, type ReviewStandard } from '@cuccut/protocol';
import {
  checkDraftProblem,
  checkFromDraft,
  checkLine,
  checkRows,
  criteriaErrorText,
  defaultQuestionId,
  emptyCheckDraft,
  emptyQuestionDraft,
  lintText,
  questionDraftProblem,
  questionFromDraft,
  questionMeta,
  standardStatus,
  takenIds,
  validReviewId,
  withBuiltinSeverity,
  withCheck,
  withCheckSeverity,
  withQuestion,
  withoutCheck,
  withoutQuestion,
} from './review-settings.ts';

beforeEach(() => {
  vi.stubEnv('CUCCUT_LOCALE', 'en');
  setLocale('en');
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

const placeholders: ReviewCheck = { id: 'placeholders', metric: 'items.placeholders', max: 0, severity: 'critical', fix: 'Fill them.' };
const blank: ReviewCheck = { id: 'blank', metric: 'video.longestBlankSec', max: 0.5, severity: 'suggestion', fix: 'Cover the gap.' };
const length: ReviewCheck = { id: 'video-durationsec', metric: 'video.durationSec', min: 3, max: 60, severity: 'suggestion', fix: '', aspect: '9:16' };

function view(standard: ReviewStandard, active: ReviewCheck[], builtinIds: string[]): ReviewCriteriaView {
  return {
    source: standard.checks.length || standard.rubric.length ? 'user' : 'builtin',
    reason: '',
    checks: active,
    rubric: standard.rubric,
    plan: emptyReviewPlan(),
    builtinIds,
    standard,
    revision: 1,
    warnings: [],
  };
}

describe('the rows of Settings › Review', () => {
  it('lists the user’s checks first, then the built-ins nothing replaced', () => {
    const standard = { ...emptyReviewStandard(), checks: [length] };
    const rows = checkRows(view(standard, [placeholders, blank, length], ['placeholders', 'blank']));
    expect(rows.map((r) => [r.check.id, r.builtin])).toEqual([
      ['video-durationsec', false],
      ['placeholders', true],
      ['blank', true],
    ]);
  });

  it('writes a check as measurement, limit symbols and shape', () => {
    expect(checkLine(length)).toBe('Length ≥ 3 s, ≤ 60 s · 9:16');
    expect(checkLine(placeholders)).toBe('Placeholder boxes ≤ 0');
    expect(checkLine({ id: 'text-edge', metric: 'text.offCanvas', is: false, severity: 'suggestion', fix: '' })).toBe('Text past the edge: no');
    expect(questionMeta({ severity: 'critical', evidence: 'quote' })).toBe('Critical · answered with: A quote');
  });

  it('says “Built-in” for an empty standard and counts otherwise; nothing before the topic', () => {
    expect(standardStatus(null)).toBeNull();
    expect(standardStatus(emptyReviewStandard())).toBe('Built-in');
    const q = { id: 'q', ask: 'Opens on the point?', evidence: 'timestamp' as const, severity: 'suggestion' as const, fix: '' };
    expect(standardStatus({ ...emptyReviewStandard(), checks: [length, blank], rubric: [q] })).toBe('2 checks · 1 question');
  });
});

describe('lint in words', () => {
  it('maps every code to a sentence naming the check', () => {
    expect(lintText({ code: 'unknown-metric', level: 'warning', id: 'x', metric: 'video.lenght', suggestions: ['video.durationSec'] })).toContain('video.durationSec');
    expect(lintText({ code: 'no-limit', level: 'warning', id: 'x' })).toContain('x');
    expect(lintText({ code: 'limit-kind', level: 'warning', id: 'x', metric: 'captions.on' })).toContain('Captions shown');
    expect(lintText({ code: 'min-over-max', level: 'warning', id: 'x' })).toContain('x');
    expect(lintText({ code: 'critical-no-fix', level: 'warning', id: 'x' })).toContain('critical');
    expect(lintText({ code: 'duplicate-id', level: 'error', id: 'x' })).toContain('twice');
    expect(lintText({ code: 'too-long', level: 'error', id: 'x', field: 'fix', limit: 200 })).toContain('200');
    expect(lintText({ code: 'too-many', level: 'error', field: 'checks', limit: 64 })).toContain('64');
  });

  it('words a refused save from its lint errors, else keeps the Runtime’s message', () => {
    const invalid = new RpcError('invalid-request', 'refused', {
      code: 'REVIEW_CRITERIA_INVALID',
      issues: [{ code: 'duplicate-id', level: 'error', id: 'blank' }],
    });
    expect(criteriaErrorText(invalid)).toBe('blank is used twice.');
    expect(criteriaErrorText(new RpcError('conflict', 'Someone changed it', { code: 'REVIEW_CRITERIA_CONFLICT' }))).toBe('Someone changed it');
  });
});

describe('the add forms', () => {
  it('says why a check cannot be added yet', () => {
    const draft = emptyCheckDraft();
    expect(checkDraftProblem(draft)).toBe('Pick a measurement first.');
    expect(checkDraftProblem({ ...draft, metric: 'video.durationSec' })).toBe('Write the limit first.');
    // A bare number says nothing about which side is wrong.
    expect(checkDraftProblem({ ...draft, metric: 'video.durationSec', limit: '60' })).toMatch(/^Write the limit as/);
    expect(checkDraftProblem({ ...draft, metric: 'video.durationSec', limit: '≤ 60', severity: 'critical' })).toMatch(/critical/);
    expect(checkDraftProblem({ ...draft, metric: 'video.durationSec', limit: '≤ 60' })).toBeNull();
    // A yes-or-no needs no typed limit.
    expect(checkDraftProblem({ ...draft, metric: 'captions.on', is: true })).toBeNull();
  });

  it('makes a check with the metric as its id, suffixed when taken', () => {
    const taken = ['video-durationsec'];
    expect(checkFromDraft({ ...emptyCheckDraft(), metric: 'video.durationSec', limit: '3–60', aspect: '9:16', fix: ' Trim it. ' }, taken)).toEqual({
      id: 'video-durationsec-2',
      metric: 'video.durationSec',
      min: 3,
      max: 60,
      severity: 'suggestion',
      fix: 'Trim it.',
      aspect: '9:16',
    });
    expect(checkFromDraft({ ...emptyCheckDraft(), metric: 'captions.on', is: true, severity: 'critical', fix: 'Burn captions.' }, [])).toEqual({
      id: 'captions-on',
      metric: 'captions.on',
      is: true,
      severity: 'critical',
      fix: 'Burn captions.',
    });
    expect(checkFromDraft(emptyCheckDraft(), [])).toBeNull();
  });

  it('makes a question with an id from its first words', () => {
    expect(questionDraftProblem(emptyQuestionDraft())).toBe('Write the question first.');
    const q = questionFromDraft({ ...emptyQuestionDraft(), ask: 'Does it open on the point it makes?', evidence: 'timestamp' }, []);
    expect(q).toEqual({ id: 'does-it-open-on', ask: 'Does it open on the point it makes?', evidence: 'timestamp', severity: 'suggestion', fix: '' });
    expect(defaultQuestionId('Đoạn mở đầu có rõ không?', [])).toBe('doan-mo-dau-co');
    expect(defaultQuestionId('开头清楚吗？', [])).toBe('question');
    expect(defaultQuestionId('开头清楚吗？', ['question'])).toBe('question-2');
    for (const id of ['does-it-open-on', 'doan-mo-dau-co', 'question-2']) expect(validReviewId(id)).toBe(true);
  });

  it('counts built-in ids as taken', () => {
    expect(takenIds({ ...emptyReviewStandard(), checks: [length] }, ['placeholders'])).toEqual(['video-durationsec', 'placeholders']);
  });
});

describe('edits of the standard', () => {
  it('removes and puts back at the same place (Undo)', () => {
    const standard = { ...emptyReviewStandard(), checks: [length, blank] };
    const removed = withoutCheck(standard, 'video-durationsec');
    expect(removed.checks.map((c) => c.id)).toEqual(['blank']);
    expect(withCheck(removed, length, 0).checks.map((c) => c.id)).toEqual(['video-durationsec', 'blank']);
    // Putting back what is already there does not double it.
    expect(withCheck(standard, length, 0).checks).toHaveLength(2);
    const q = { id: 'q', ask: 'Q?', evidence: 'quote' as const, severity: 'nitpick' as const, fix: '' };
    expect(withoutQuestion(withQuestion(standard, q), 'q').rubric).toEqual([]);
  });

  it('turns a built-in given another severity into the user’s own check on that metric', () => {
    const next = withBuiltinSeverity(emptyReviewStandard(), placeholders, 'suggestion');
    expect(next.checks).toEqual([{ ...placeholders, severity: 'suggestion' }]);
    expect(withCheckSeverity(next, 'placeholders', 'nitpick').checks[0]?.severity).toBe('nitpick');
  });
});
