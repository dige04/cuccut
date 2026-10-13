import { describe, expect, it } from 'vitest';
import { PROFILE_LIMITS, PROFILE_RULE_ID_PATTERN, RpcError, type ProfileRule } from '@cuccut/protocol';
import { effectiveRules, nextOrder, ruleInvalidError, rulesForStage, validateRule, type RuleCheckContext } from './profile-rules.ts';

const rule = (id: string, extra: Partial<ProfileRule> = {}): ProfileRule => ({
  id,
  name: `Rule ${id}`,
  when: 'the clip is gameplay',
  instruction: 'Never cover the game.',
  templateId: null,
  stage: 'any',
  order: 10,
  enabled: true,
  note: '',
  source: null,
  ...extra,
});

const context = (extra: Partial<RuleCheckContext> = {}): RuleCheckContext => ({
  existing: [],
  installedTemplates: new Set(['quote-card']),
  randomHex: () => '0a1b2c3d',
  ...extra,
});

const keysOf = (check: ReturnType<typeof validateRule>) => (check.ok ? [] : check.problems.map((p) => (p.params?.field as { key: string }).key));

describe('validateRule', () => {
  it('a complete rule gets a generated id, the defaults, and an order after the last one', () => {
    const check = validateRule({ name: '  Gameplay stays clear ', when: ' the clip is gameplay ', instruction: 'Never cover the game.' }, context({ existing: [rule('a', { order: 40 })] }));
    expect(check).toEqual({
      ok: true,
      created: true,
      warnings: [],
      rule: {
        id: 'gameplay-stays-clear-0a1b2c3d',
        name: 'Gameplay stays clear',
        when: 'the clip is gameplay',
        instruction: 'Never cover the game.',
        templateId: null,
        stage: 'any',
        order: 50,
        enabled: true,
        note: '',
        source: null,
      },
    });
  });

  it('name and condition are required; so is an instruction or a template', () => {
    const check = validateRule({ name: ' ', when: '', instruction: '  ' }, context());
    expect(check.ok).toBe(false);
    expect(keysOf(check)).toEqual(['rcProfile.fieldName', 'rcProfile.fieldWhen', 'rcProfile.fieldInstruction']);
    if (!check.ok) {
      expect(check.problems.map((p) => (p.params?.problem as { key: string }).key)).toEqual([
        'rcProfile.required',
        'rcProfile.required',
        'rcProfile.needInstructionOrTemplate',
      ]);
      // Readable as "Field: problem".
      for (const p of check.problems) expect(p.text).toMatch(/^.+: .+$/);
    }
    expect(validateRule({ name: 'n', when: 'w', templateId: 'quote-card' }, context()).ok).toBe(true);
  });

  it('a template that is not installed is a warning; one that is not a template id is an error', () => {
    const missing = validateRule({ name: 'n', when: 'w', templateId: 'lower-third' }, context());
    expect(missing.ok && missing.warnings.map((w) => [w.code, w.messageRef?.key])).toEqual([['template-missing', 'rcProfile.templateMissing']]);
    expect(missing.ok && missing.rule.templateId).toBe('lower-third');
    // Templates not known: no warning.
    const unknown = validateRule({ name: 'n', when: 'w', templateId: 'lower-third' }, context({ installedTemplates: null }));
    expect(unknown.ok && unknown.warnings).toEqual([]);
    expect(keysOf(validateRule({ name: 'n', when: 'w', instruction: 'i', templateId: 'Lower Third' }, context()))).toEqual(['rcProfile.fieldTemplate']);
    // An empty template id is no template.
    const blank = validateRule({ name: 'n', when: 'w', instruction: 'i', templateId: ' ' }, context());
    expect(blank.ok && blank.rule.templateId).toBeNull();
  });

  it('checks the id pattern, lengths and the per-level limit', () => {
    expect(keysOf(validateRule({ id: 'Bad Id', name: 'n', when: 'w', instruction: 'i' }, context()))).toEqual(['rcProfile.fieldId']);
    expect(keysOf(validateRule({ name: 'x'.repeat(PROFILE_LIMITS.name + 1), when: 'w', instruction: 'i' }, context()))).toEqual(['rcProfile.fieldName']);
    expect(keysOf(validateRule({ name: 'n', when: 'w', instruction: 'i', note: 'x'.repeat(PROFILE_LIMITS.note + 1) }, context()))).toEqual(['rcProfile.fieldNote']);
    const full = Array.from({ length: PROFILE_LIMITS.rules }, (_, i) => rule(`r-${i}`));
    const over = validateRule({ name: 'n', when: 'w', instruction: 'i' }, context({ existing: full }));
    expect(over.ok ? null : over.problems.map((p) => p.key)).toEqual(['rcProfile.ruleLimit']);
    // Replacing one at the limit is fine.
    expect(validateRule({ id: 'r-3', name: 'n', when: 'w', instruction: 'i' }, context({ existing: full })).ok).toBe(true);
  });

  it('generated ids do not collide with the level, even with a stuck random source', () => {
    const existing = [rule('gameplay-0a1b2c3d')];
    const check = validateRule({ name: 'Gameplay', when: 'w', instruction: 'i' }, context({ existing }));
    expect(check.ok && check.rule.id).not.toBe('gameplay-0a1b2c3d');
    expect(check.ok && PROFILE_RULE_ID_PATTERN.test(check.rule.id)).toBe(true);
  });

  it('replacing keeps the fields the input leaves out', () => {
    const current = rule('keep-1', { stage: 'edit', order: 30, enabled: false, note: 'mine', templateId: 'quote-card' });
    const check = validateRule({ id: 'keep-1', name: 'Renamed', when: 'w2' }, context({ existing: [current] }));
    expect(check).toMatchObject({
      ok: true,
      created: false,
      rule: { id: 'keep-1', name: 'Renamed', when: 'w2', instruction: current.instruction, stage: 'edit', order: 30, enabled: false, note: 'mine', templateId: 'quote-card' },
    });
    const cleared = validateRule({ id: 'keep-1', name: 'n', when: 'w', templateId: null }, context({ existing: [current] }));
    expect(cleared.ok && cleared.rule.templateId).toBeNull();
    // A given id that is not there yet creates the rule with that id (Undo puts a removed rule back like this).
    const back = validateRule({ id: 'gone-1', name: 'n', when: 'w', instruction: 'i', order: 20 }, context({ existing: [current] }));
    expect(back).toMatchObject({ ok: true, created: true, rule: { id: 'gone-1', order: 20 } });
  });

  it('the error carries every problem', () => {
    const check = validateRule({ name: '', when: '', instruction: '' }, context());
    const error = ruleInvalidError(check.ok ? [] : check.problems);
    expect(error).toBeInstanceOf(RpcError);
    expect(error.code).toBe('invalid-request');
    expect(error.details).toMatchObject({ code: 'PROFILE_RULE_INVALID' });
    expect((error.details as { problems: string[] }).problems).toHaveLength(3);
    expect(error.messageRef?.key).toBe('rcProfile.ruleInvalid');
  });
});

describe('rules that hold', () => {
  it('workspace then project; a project rule shadows a workspace one by id; disabled rules left out', () => {
    const workspace = [rule('a'), rule('b'), rule('off', { enabled: false })];
    const project = [rule('b', { name: 'project b' }), rule('c')];
    expect(effectiveRules(workspace, project).map((r) => `${r.id}:${r.name}`)).toEqual(['a:Rule a', 'b:project b', 'c:Rule c']);
  });

  it('by stage: that stage and any', () => {
    const rules = [rule('any'), rule('clip', { stage: 'clip' }), rule('edit', { stage: 'edit' })];
    expect(rulesForStage(rules, 'clip').map((r) => r.id)).toEqual(['any', 'clip']);
    expect(rulesForStage(rules, 'edit').map((r) => r.id)).toEqual(['any', 'edit']);
    expect(rulesForStage(rules, 'any').map((r) => r.id)).toEqual(['any', 'clip', 'edit']);
  });

  it('next order', () => {
    expect(nextOrder([])).toBe(10);
    expect(nextOrder([rule('a', { order: 7 }), rule('b', { order: 25 })])).toBe(35);
  });
});
