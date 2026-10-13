import { describe, expect, it } from 'vitest';
import { M } from './profile-copy.ts';
import {
  formatAnswerSaved,
  formatProfile,
  formatRules,
  formatWriteResult,
  movedOrder,
  parseQuestionId,
  questionLabel,
  stageLabel,
  type ProfileShow,
  type ShownRule,
} from './profile-output.ts';

/** `cuccut profile` output. Asserted against the copy catalog, so it holds in whichever language the tests run. */

const rule = (over: Partial<ShownRule> = {}): ShownRule => ({
  id: 'gameplay-stays-clear-0a1b2c3d',
  name: 'Gameplay stays clear',
  when: 'the clip is gameplay',
  instruction: 'Never cover the game.',
  templateId: null,
  stage: 'edit',
  order: 10,
  enabled: true,
  ...over,
});

const shown = (over: Partial<ProfileShow> = {}): ProfileShow => ({
  interview: {
    status: 'skipped',
    questions: [
      { id: 'who', text: 'What do you make, and who is it for?', required: true, answered: true },
      { id: 'record', text: 'What do you usually record?', required: false, answered: false },
      { id: 'platforms', text: 'Where does it go, and how long should it be?', required: false, answered: false },
      { id: 'annoys', text: 'What annoys you about your videos today?', required: false, answered: false },
      { id: 'names', text: 'Names that must be spelled right', required: false, answered: true },
    ],
    answers: { who: 'Coding tutorials', names: 'Deska' },
  },
  preferences: { general: '- Hooks short\n- Captions on', interviewSection: '', project: null },
  rules: { workspace: [rule()], project: null },
  names: ['Deska', 'Next.js'],
  project: null,
  ...over,
});

describe('cuccut profile output', () => {
  it('show: the interview with its answers, preferences, rules and names; the project level only with a project', () => {
    const lines = formatProfile(shown());
    expect(lines[0]).toBe(M.interviewLine(M.statusSkipped, 2, 5));
    expect(lines.slice(1, 6)).toEqual([
      M.answerLine(M.questionWho, 'Coding tutorials'),
      M.answerLine(M.questionRecord, M.unanswered),
      M.answerLine(M.questionPlatforms, M.unanswered),
      M.answerLine(M.questionAnnoys, M.unanswered),
      M.answerLine(M.questionNames, 'Deska'),
    ]);
    expect(lines).toContain(M.generalHeading);
    expect(lines).toContain('  - Hooks short');
    expect(lines).not.toContain(M.interviewHeading);
    expect(lines).toContain(M.ruleLine(1, 'Gameplay stays clear', M.stageEdit, false, 'gameplay-stays-clear-0a1b2c3d'));
    expect(lines.at(-1)).toBe(M.namesLine('Deska, Next.js'));
    expect(lines.some((line) => line === M.projectHeading('Show'))).toBe(false);

    const withProject = formatProfile(
      shown({
        preferences: { general: '', interviewSection: '- Written', project: '- Vertical' },
        rules: { workspace: [], project: [rule({ enabled: false, instruction: '', templateId: 'quote-card', stage: 'any' })] },
        names: [],
        project: { projectId: 'prj_1', name: 'Show' },
      }),
      true,
    );
    expect(withProject).toEqual(
      expect.arrayContaining([M.noText, M.interviewHeading, '  - Written', M.projectHeading('Show'), '  - Vertical', M.noRules, M.projectRulesHeading('Show')]),
    );
    expect(withProject).toContain(M.ruleLine(1, 'Gameplay stays clear', M.stageAny, true, 'gameplay-stays-clear-0a1b2c3d'));
    expect(withProject).toContain(M.ruleTemplate('quote-card'));
    expect(withProject).not.toContain(M.ruleDo(''));
    expect(withProject.at(-1)).toBe(M.readOnly);
  });

  it('rules: numbered in reading order with stage, condition and action; empty says so', () => {
    expect(formatRules([rule(), rule({ id: 'b', name: 'B', stage: 'clip', order: 20 })])).toEqual([
      M.ruleLine(1, 'Gameplay stays clear', M.stageEdit, false, 'gameplay-stays-clear-0a1b2c3d'),
      M.ruleWhen('the clip is gameplay'),
      M.ruleDo('Never cover the game.'),
      M.ruleLine(2, 'B', M.stageClip, false, 'b'),
      M.ruleWhen('the clip is gameplay'),
      M.ruleDo('Never cover the game.'),
    ]);
    expect(formatRules([])).toEqual([M.noRules]);
    expect(stageLabel('any')).toBe(M.stageAny);
  });

  it('interview write: says whether the agent wrote it or why the answers were kept, and the names added', () => {
    expect(formatWriteResult({ preferences: '- Hooks short', names: ['Deska'], usedAgent: true })).toEqual([
      M.writtenByAgent,
      '  - Hooks short',
      M.namesAdded('Deska'),
      M.takesEffect,
    ]);
    expect(formatWriteResult({ preferences: '- Who: x', names: [], usedAgent: false, fallbackReason: 'no-agent' })[0]).toBe(M.keptAsTyped(M.reasonNoAgent));
    expect(formatWriteResult({ preferences: '- Who: x', names: [], usedAgent: false, fallbackReason: 'bad-output' })[0]).toBe(M.keptAsTyped(M.reasonBadOutput));
    expect(formatWriteResult({ preferences: '- Who: x', names: [], usedAgent: false, fallbackReason: 'agent-failed' })[0]).toBe(
      M.keptAsTyped(M.reasonAgentFailed),
    );
  });

  it('answers set: a known question id, saved or cleared', () => {
    expect(parseQuestionId('Who')).toBe('who');
    expect(() => parseQuestionId('mood')).toThrow(M.badQuestion('mood', 'who, record, platforms, annoys, names'));
    expect(formatAnswerSaved('names', 'Deska')).toBe(M.answerSaved(questionLabel('names')));
    expect(formatAnswerSaved('names', '  ')).toBe(M.answerCleared(questionLabel('names')));
  });

  it('rules move: up, down, or to a position (clamped to the list)', () => {
    const ids = ['a', 'b', 'c'];
    expect(movedOrder(ids, 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(movedOrder(ids, 'a', 'up')).toEqual(['a', 'b', 'c']);
    expect(movedOrder(ids, 'b', 'down')).toEqual(['a', 'c', 'b']);
    expect(movedOrder(ids, 'c', 'down')).toEqual(['a', 'b', 'c']);
    expect(movedOrder(ids, 'c', '1')).toEqual(['c', 'a', 'b']);
    expect(movedOrder(ids, 'a', '9')).toEqual(['b', 'c', 'a']);
    expect(() => movedOrder(ids, 'a', '0')).toThrow(M.badMove('0'));
    expect(() => movedOrder(ids, 'a', 'top')).toThrow(M.badMove('top'));
    expect(() => movedOrder(ids, 'z', 'up')).toThrow(M.ruleMissing('z'));
  });
});
