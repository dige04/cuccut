import { describe, expect, it } from 'vitest';
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_QUESTION_TEXT,
  PROFILE_LIMITS,
  PROFILE_RULE_ID_PATTERN,
  clipProfileText,
  profileRuleId,
  profileRuleSlug,
  remainingInterviewQuestions,
  sortProfileRules,
} from './profile.ts';
import { methodParamSchemas } from './schemas.ts';
import { WEB_DEFAULT_METHODS, WEB_READ_METHODS, WEB_TOPIC_METHODS, webMethodAccess } from './web.ts';

describe('profile.* parameters', () => {
  it('accept the documented examples', () => {
    expect(methodParamSchemas['profile.get'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['profile.getProject'].safeParse({ projectId: 'prj_1' }).success).toBe(true);
    expect(methodParamSchemas['profile.saveAnswers'].safeParse({ answers: { who: 'Coding streams on Twitch', names: '' } }).success).toBe(true);
    expect(methodParamSchemas['profile.saveAnswers'].safeParse({ answers: {}, commandId: 'cmd_1' }).success).toBe(true);
    expect(methodParamSchemas['profile.skipInterview'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['profile.reopenInterview'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['profile.dismissReminder'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['profile.writeFromAnswers'].safeParse({}).success).toBe(true);
    expect(methodParamSchemas['profile.writeFromAnswers'].safeParse({ answers: { who: 'Tutorials for junior devs' } }).success).toBe(true);
    expect(methodParamSchemas['profile.writeFromAnswers'].safeParse({ answers: { mood: 'x' } }).success).toBe(false);
    expect(methodParamSchemas['profile.setPreferences'].safeParse({ own: '- Hooks under 3 seconds' }).success).toBe(true);
    expect(methodParamSchemas['profile.setPreferences'].safeParse({ projectId: 'prj_1', own: '' }).success).toBe(true);
    const rule = { name: 'Gameplay stays clear', when: 'the clip is gameplay', instruction: 'Never cover the game with pictures.' };
    expect(methodParamSchemas['profile.putRule'].safeParse({ rule }).success).toBe(true);
    expect(
      methodParamSchemas['profile.putRule'].safeParse({
        rule: { ...rule, id: 'gameplay-stays-clear-0a1b2c3d', instruction: '', templateId: 'quote-card', stage: 'edit', order: 30, enabled: false, note: 'from the March stream' },
        projectId: 'prj_1',
      }).success,
    ).toBe(true);
    expect(methodParamSchemas['profile.removeRule'].safeParse({ id: 'gameplay-stays-clear-0a1b2c3d' }).success).toBe(true);
    expect(methodParamSchemas['profile.reorderRules'].safeParse({ ids: ['b-1', 'a-2'], projectId: 'prj_1' }).success).toBe(true);
  });

  it('reject unknown question ids, over-long text and unknown fields', () => {
    const save = methodParamSchemas['profile.saveAnswers'];
    expect(save.safeParse({ answers: { favourite: 'x' } }).success).toBe(false);
    expect(save.safeParse({ answers: { who: 'x'.repeat(PROFILE_LIMITS.answer + 1) } }).success).toBe(false);
    expect(save.safeParse({ answers: { who: 'x'.repeat(PROFILE_LIMITS.answer) } }).success).toBe(true);
    expect(save.safeParse({ answers: { who: 3 } }).success).toBe(false);

    const prefs = methodParamSchemas['profile.setPreferences'];
    expect(prefs.safeParse({ own: 'x'.repeat(PROFILE_LIMITS.preferences + 1) }).success).toBe(false);
    expect(prefs.safeParse({ interview: 'x'.repeat(PROFILE_LIMITS.preferences + 1) }).success).toBe(false);
    expect(prefs.safeParse({ text: 'x' }).success).toBe(false);

    const put = methodParamSchemas['profile.putRule'];
    const rule = { name: 'n', when: 'w', instruction: 'i' };
    expect(put.safeParse({ rule: { ...rule, name: 'x'.repeat(PROFILE_LIMITS.name + 1) } }).success).toBe(false);
    expect(put.safeParse({ rule: { ...rule, when: 'x'.repeat(PROFILE_LIMITS.when + 1) } }).success).toBe(false);
    expect(put.safeParse({ rule: { ...rule, instruction: 'x'.repeat(PROFILE_LIMITS.instruction + 1) } }).success).toBe(false);
    expect(put.safeParse({ rule: { ...rule, note: 'x'.repeat(PROFILE_LIMITS.note + 1) } }).success).toBe(false);
    expect(put.safeParse({ rule: { ...rule, stage: 'creating' } }).success).toBe(false);
    expect(put.safeParse({ rule: { ...rule, order: 1.5 } }).success).toBe(false);
    expect(put.safeParse({ rule: { ...rule, source: { pack: 'x' } } }).success).toBe(false);
    expect(put.safeParse({ rule: { when: 'w' } }).success).toBe(false);

    const reorder = methodParamSchemas['profile.reorderRules'];
    expect(reorder.safeParse({ ids: Array.from({ length: PROFILE_LIMITS.rules + 1 }, (_, i) => `r-${i}`) }).success).toBe(false);
  });

  it('the profile topic can be subscribed to', () => {
    expect(methodParamSchemas.subscribe.safeParse({ topic: 'profile' }).success).toBe(true);
  });
});

describe('web access to the profile', () => {
  it('reading is open (also read-only), writing is desktop only', () => {
    const readOnly = { readOnly: true, methods: null };
    for (const method of ['profile.get', 'profile.getProject']) {
      expect(WEB_DEFAULT_METHODS).toContain(method);
      expect(WEB_READ_METHODS).toContain(method);
      expect(webMethodAccess(method, readOnly)).toBe('allowed');
    }
    for (const method of [
      'profile.saveAnswers',
      'profile.skipInterview',
      'profile.reopenInterview',
      'profile.dismissReminder',
      'profile.writeFromAnswers',
      'profile.setPreferences',
      'profile.putRule',
      'profile.removeRule',
      'profile.reorderRules',
    ]) {
      expect(webMethodAccess(method, { readOnly: false, methods: null }), method).toBe('not-allowed');
    }
    expect(WEB_TOPIC_METHODS.profile).toBe('profile.get');
  });
});

describe('profile helpers', () => {
  it('remaining questions keep the asking order and skip answered ones', () => {
    expect(remainingInterviewQuestions({})).toEqual([...INTERVIEW_QUESTIONS]);
    expect(remainingInterviewQuestions({ who: 'x', annoys: 'y', names: '  ' })).toEqual(['record', 'platforms', 'names']);
    for (const q of INTERVIEW_QUESTIONS) expect(INTERVIEW_QUESTION_TEXT[q]).toBeTruthy();
  });

  it('rules sort by order, then by id', () => {
    const sorted = sortProfileRules([
      { id: 'b', order: 20 },
      { id: 'c', order: 10 },
      { id: 'a', order: 20 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('rule ids: ASCII slug of the name, at most 55, then 8 hex', () => {
    expect(profileRuleSlug('Gameplay stays clear!')).toBe('gameplay-stays-clear');
    expect(profileRuleSlug('Phụ đề đặt ở dưới')).toBe('phu-de-dat-o-duoi');
    expect(profileRuleSlug('字幕')).toBe('rule');
    expect(profileRuleSlug('---')).toBe('rule');
    expect(profileRuleSlug('a'.repeat(80))).toHaveLength(55);
    const id = profileRuleId('Gameplay stays clear', '0A1B2C3D');
    expect(id).toBe('gameplay-stays-clear-0a1b2c3d');
    expect(PROFILE_RULE_ID_PATTERN.test(id)).toBe(true);
    expect(PROFILE_RULE_ID_PATTERN.test(profileRuleId('x'.repeat(200), 'ffffffff'))).toBe(true);
  });

  it('clipping never splits a surrogate pair', () => {
    expect(clipProfileText('abc', 5)).toBe('abc');
    expect(clipProfileText('abcdef', 3)).toBe('abc');
    expect(clipProfileText('ab😀', 3)).toBe('ab');
  });
});
