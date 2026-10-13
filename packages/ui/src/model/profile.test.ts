import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROFILE_RULE_ID_PATTERN, setLocale, type ProfileRule, type ProfileSnapshot } from '@cuccut/protocol';
import { PROFILE_COPY } from '../components/profile/profile-copy.ts';
import { RULES_COPY } from '../components/profile/rules-copy.ts';
import {
  answerCount,
  canWriteAnswers,
  changedAnswers,
  hasWriterAgent,
  interviewLine,
  isRequiredQuestion,
  moveRule,
  newRuleId,
  nextQuestion,
  railSummary,
  renumber,
  ruleDraft,
  ruleDraftErrors,
  ruleEffects,
  ruleInputOf,
  ruleInputOfDraft,
  stageLabel,
} from './profile.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

function rule(id: string, patch: Partial<ProfileRule> = {}): ProfileRule {
  return {
    id,
    name: id,
    when: 'the clip is gameplay',
    instruction: 'keep the game visible',
    templateId: null,
    stage: 'any',
    order: 10,
    enabled: true,
    note: '',
    source: null,
    ...patch,
  };
}

function snapshot(patch: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    interview: { status: 'pending', reminder: true, answers: {}, remaining: [], writtenAt: null, usedAgent: null, namesGlossaryId: null },
    preferences: { own: '', interview: '' },
    hasPreferences: false,
    rules: [],
    writing: null,
    readOnly: false,
    ...patch,
  };
}

describe('interview', () => {
  it('says what the status means for the answers', () => {
    const line = PROFILE_COPY.interview.line;
    expect(interviewLine('pending', false)).toBe(line.pending);
    expect(interviewLine('skipped', true)).toBe(line.skipped);
    expect(interviewLine('done', true)).toBe(line.doneWithSection);
    expect(interviewLine('done', false)).toBe(line.doneRemoved);
  });

  it('counts only answers with text; writing needs the first question', () => {
    expect(answerCount({ who: 'streams', record: '  ', names: 'Deska' })).toBe(2);
    expect(canWriteAnswers({ record: 'webcam' })).toBe(false);
    expect(canWriteAnswers({ who: '  ' })).toBe(false);
    expect(canWriteAnswers({ who: 'streams' })).toBe(true);
    expect(isRequiredQuestion('who')).toBe(true);
    expect(isRequiredQuestion('names')).toBe(false);
  });

  it('asks the first unanswered question not put off in this session', () => {
    expect(nextQuestion({ answers: {} }, [])).toBe('who');
    expect(nextQuestion({ answers: { who: 'x' } }, ['record'])).toBe('platforms');
    expect(nextQuestion({ answers: { who: 'x', record: 'y' } }, ['platforms', 'annoys', 'names'])).toBeNull();
  });

  it('sends only changed answers, a cleared one as empty text', () => {
    expect(changedAnswers({ who: ' streams ', record: '', names: 'Deska' }, { who: 'streams', record: 'webcam' })).toEqual({
      record: '',
      names: 'Deska',
    });
    expect(changedAnswers({ who: 'a' }, { who: 'a' })).toEqual({});
  });

  it('knows whether a write will find an agent, and does not guess before the list arrives', () => {
    expect(hasWriterAgent(null)).toBeNull();
    expect(hasWriterAgent([])).toBe(false);
    expect(hasWriterAgent([{ enabled: true, state: 'ready', verified: false }])).toBe(false);
    expect(hasWriterAgent([{ enabled: false, state: 'ready', verified: true }])).toBe(false);
    expect(hasWriterAgent([{ enabled: true, state: 'ready', verified: true }])).toBe(true);
  });
});

describe('rail', () => {
  it('summarises You and Rules; nothing before the snapshot', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(railSummary(null)).toBeNull();
    expect(railSummary(snapshot())).toEqual({ you: 'No preferences yet', rules: 'None yet' });
    const answered = snapshot({ interview: { ...snapshot().interview, answers: { who: 'a', record: 'b' } } });
    expect(railSummary(answered)?.you).toBe('2 answers');
    expect(railSummary({ ...answered, hasPreferences: true })?.you).toBe('Preferences written, 2 answers');
    expect(railSummary(snapshot({ hasPreferences: true }))?.you).toBe('Preferences written');
    expect(railSummary(snapshot({ rules: [rule('a'), rule('b', { enabled: false }), rule('c')] }))?.rules).toBe('3 rules, 1 off');
    expect(railSummary(snapshot({ rules: [rule('a')] }))?.rules).toBe('1 rule');
  });
});

describe('rules', () => {
  const templates = [{ id: 'launch-film', title: 'Launch film' }];

  it('lists a rule’s effects: the template by its name, a missing one marked, then the instruction', () => {
    expect(ruleEffects(rule('a', { templateId: 'launch-film' }), templates)).toEqual([
      { kind: 'template', text: RULES_COPY.effect.template('Launch film') },
      { kind: 'instruction', text: RULES_COPY.effect.instruction('keep the game visible') },
    ]);
    const missing = ruleEffects(rule('a', { templateId: 'gone', instruction: '' }), templates);
    expect(missing).toEqual([{ kind: 'template', text: `${RULES_COPY.effect.template('gone')} ${RULES_COPY.effect.templateMissing}`, missing: true }]);
    expect(ruleEffects(rule('a', { instruction: '  ' }), templates)).toEqual([]);
    expect(stageLabel('clip')).toBe(RULES_COPY.stage.clip);
  });

  it('moves a rule one place and renumbers 10, 20, 30', () => {
    expect(moveRule(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveRule(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveRule(['a', 'b'], 0, -1)).toBeNull();
    expect(moveRule(['a', 'b'], 1, 1)).toBeNull();
    expect(renumber(['c', 'a'])).toEqual([
      { id: 'c', order: 10 },
      { id: 'a', order: 20 },
    ]);
  });

  it('makes ids the Runtime accepts from any name', () => {
    expect(newRuleId('Keep gameplay visible', 'ABCDEF12')).toBe('keep-gameplay-visible-abcdef12');
    expect(newRuleId('Giữ nguyên đồ hoạ', '0011aabb')).toBe('giu-nguyen-do-hoa-0011aabb');
    expect(newRuleId('！！', '00000000')).toBe('rule-00000000');
    const random = newRuleId('x'.repeat(80));
    expect(random).toMatch(PROFILE_RULE_ID_PATTERN);
    expect(random).toMatch(/^x{55}-[0-9a-f]{8}$/);
  });

  it('says why a draft can’t be saved yet', () => {
    const empty = ruleDraft(null);
    expect(empty).toMatchObject({ id: null, stage: 'any', enabled: true, order: '' });
    expect(ruleDraftErrors(empty)).toBe(RULES_COPY.form.needName);
    expect(ruleDraftErrors({ ...empty, name: 'n' })).toBe(RULES_COPY.form.needWhen);
    expect(ruleDraftErrors({ ...empty, name: 'n', when: 'w' })).toBe(RULES_COPY.form.needAction);
    expect(ruleDraftErrors({ ...empty, name: 'n', when: 'w', templateId: 'launch-film' })).toBeNull();
    expect(ruleDraftErrors({ ...empty, name: 'n', when: 'w', instruction: 'i', order: '1.5' })).toBe(RULES_COPY.form.badOrder);
    expect(ruleDraftErrors({ ...empty, name: 'n', when: 'w', instruction: 'i', order: '-20' })).toBeNull();
  });

  it('turns a draft into putRule input: trimmed, no order for a new rule, the given id kept', () => {
    const draft = { ...ruleDraft(null), name: ' Gameplay ', when: ' gameplay ', instruction: ' keep it ', templateId: '' };
    expect(ruleInputOfDraft(draft, 'gameplay-00000000')).toEqual({
      id: 'gameplay-00000000',
      name: 'Gameplay',
      when: 'gameplay',
      instruction: 'keep it',
      templateId: null,
      stage: 'any',
      enabled: true,
      note: '',
    });
    const saved = rule('keep-1', { order: 30, note: 'mine', templateId: 'launch-film' });
    const input = ruleInputOfDraft(ruleDraft(saved));
    expect(input).toMatchObject({ id: 'keep-1', order: 30, note: 'mine', templateId: 'launch-film' });
    expect(ruleInputOfDraft({ ...ruleDraft(null), name: 'New one' }).id).toMatch(/^new-one-[0-9a-f]{8}$/);
  });

  it('puts a saved rule back without the reserved source field', () => {
    const input = ruleInputOf(rule('a', { order: 20 }), { enabled: false });
    expect(input).not.toHaveProperty('source');
    expect(input).toMatchObject({ id: 'a', order: 20, enabled: false });
  });
});
