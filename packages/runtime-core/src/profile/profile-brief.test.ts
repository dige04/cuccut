import { describe, expect, it } from 'vitest';
import { PROFILE_LIMITS, type ProfileRule } from '@cuccut/protocol';
import { PROFILE_BLOCK_NAMES, interviewNudge, joinBlocks, profileBlock, ruleLine, type ProfileBlockInput } from './profile-brief.ts';

const rule = (id: string, extra: Partial<ProfileRule> = {}): ProfileRule => ({
  id,
  name: `Rule ${id}`,
  when: 'the clip is gameplay',
  instruction: 'Never cover the game with pictures',
  templateId: null,
  stage: 'any',
  order: 10,
  enabled: true,
  note: 'secret note to self',
  source: null,
  ...extra,
});

const empty: ProfileBlockInput = { general: { interview: '', own: '' }, project: null, rules: [], names: [] };

describe('profileBlock', () => {
  it('nothing to say: no block', () => {
    expect(profileBlock(empty)).toBe('');
    expect(profileBlock({ ...empty, general: { interview: '  ', own: '\n' }, project: '  ' })).toBe('');
  });

  it('sections in order: general (interview, then own), project, rules, names', () => {
    const block = profileBlock({
      general: { interview: '- Captions spell names right', own: '- Hooks under 3 seconds' },
      project: '- Vertical only',
      rules: [rule('a', { stage: 'clip' }), rule('b', { stage: 'edit', instruction: '', templateId: 'quote-card' })],
      names: ['Deska', 'Next.js'],
    });
    expect(block.startsWith('<cuccut-profile>\n')).toBe(true);
    expect(block.endsWith('\n</cuccut-profile>')).toBe(true);
    const order = ['## In general', '- Captions spell names right', '- Hooks under 3 seconds', '## For this project', '- Vertical only', '## Rules', '## Names to spell exactly'].map(
      (s) => block.indexOf(s),
    );
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(block).toContain('1. Rule a [choosing clips] — When: the clip is gameplay. Do: Never cover the game with pictures.');
    expect(block).toContain('2. Rule b [editing] — When: the clip is gameplay. Use the template quote-card.');
    expect(block).toContain('Deska, Next.js');
    expect(block).toContain('the request wins');
  });

  it('empty parts are left out', () => {
    const block = profileBlock({ ...empty, rules: [rule('a')] });
    expect(block).not.toContain('## In general');
    expect(block).not.toContain('## For this project');
    expect(block).not.toContain('## Names');
    expect(block).toContain('## Rules');
  });

  it('never includes a rule note', () => {
    expect(profileBlock({ ...empty, rules: [rule('a')] })).not.toContain('secret note');
    expect(ruleLine(rule('a', { stage: 'any', when: 'two\nlines!' }), 3)).toBe('3. Rule a [any] — When: two lines! Do: Never cover the game with pictures.');
  });

  it('lists at most 80 names', () => {
    const names = Array.from({ length: 100 }, (_, i) => `Name${i}`);
    const block = profileBlock({ ...empty, names });
    expect(block).toContain(`Name${PROFILE_BLOCK_NAMES - 1}`);
    expect(block).not.toContain(`Name${PROFILE_BLOCK_NAMES},`);
    expect(block).not.toContain(`Name${PROFILE_BLOCK_NAMES}\n`);
  });

  it('caps the block at 6000 characters, cutting names first, then general, with an overflow line', () => {
    const own = Array.from({ length: 400 }, (_, i) => `- preference line ${i}`).join('\n');
    const input: ProfileBlockInput = {
      general: { interview: '', own },
      project: '- project line',
      rules: [rule('a'), rule('b')],
      names: Array.from({ length: 80 }, (_, i) => `SomeLongerName${i}`),
    };
    const block = profileBlock(input);
    expect(block.length).toBeLessThanOrEqual(PROFILE_LIMITS.block);
    expect(block).toMatch(/\(… \d+ more characters not shown; profile_show has the rest\)/);
    // Names went first (down to the overflow line), then general was cut; project and rules are whole.
    const names = block.slice(block.indexOf('## Names to spell exactly'));
    expect(names).not.toContain('SomeLongerName0');
    expect(block).toContain('- preference line 0');
    expect(block).not.toContain('- preference line 399');
    expect(block).toContain('- project line');
    expect(block).toContain('2. Rule b');
    expect(block.endsWith('</cuccut-profile>')).toBe(true);
  });

  it('only cuts as much as it must', () => {
    const names = Array.from({ length: 80 }, (_, i) => `N${i}`);
    const fits = profileBlock({ ...empty, general: { interview: '', own: 'x'.repeat(4000) }, names });
    expect(fits).not.toContain('more characters not shown');
    const tight = profileBlock({ ...empty, general: { interview: '', own: 'x'.repeat(5300) }, names });
    expect(tight.length).toBeLessThanOrEqual(PROFILE_LIMITS.block);
    expect(tight).toContain('x'.repeat(5300));
    expect(tight).toContain('more characters not shown');
  });
});

describe('interviewNudge', () => {
  it('names the unanswered questions and the tools', () => {
    const nudge = interviewNudge(['record', 'names']);
    expect(nudge.startsWith('<cuccut-interview>\n')).toBe(true);
    expect(nudge.endsWith('\n</cuccut-interview>')).toBe(true);
    expect(nudge).toContain('record ("What do you usually record?")');
    expect(nudge).toContain('names ("Names that must be spelled right")');
    expect(nudge).not.toContain('who (');
    expect(nudge).toContain('profile_answer');
    expect(nudge).toContain('profile_write');
    expect(nudge).toContain('profile_skip');
    expect(interviewNudge([])).not.toContain('profile_answer');
  });
});

describe('joinBlocks', () => {
  it('leaves out empty blocks', () => {
    expect(joinBlocks(['a', '', '  ', 'b'])).toBe('a\n\nb');
    expect(joinBlocks(['', ''])).toBe('');
  });
});
