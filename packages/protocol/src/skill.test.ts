import { describe, expect, it } from 'vitest';
import { methodParamSchemas } from './schemas.ts';
import { messageSkills, SKILL_LIMITS, sendSkillRefs } from './skill.ts';

describe('skills picked in conversations.send', () => {
  const send = methodParamSchemas['conversations.send'];
  const base = { conversationId: 'c', text: 'hi', commandId: 'k' };

  it('accepts a single skill and an ordered skills list', () => {
    expect(send.safeParse({ ...base, skill: { id: 'caption-layout' } }).success).toBe(true);
    expect(send.safeParse({ ...base, skills: [{ id: 'caption-layout' }, { id: 'b-roll' }] }).success).toBe(true);
    expect(send.safeParse({ ...base, skill: { id: 'a' }, skills: [{ id: 'b' }] }).success).toBe(true);
    expect(send.safeParse({ ...base, skills: [] }).success).toBe(true);
  });

  it('rejects invalid ids, extra fields and lists over the limit', () => {
    expect(send.safeParse({ ...base, skills: [{ id: 'Caption Layout' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, skills: [{ id: 'a', name: 'x' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, skills: { id: 'a' } }).success).toBe(false);
    const many = Array.from({ length: SKILL_LIMITS.perMessage + 1 }, (_, i) => ({ id: `s${i}` }));
    expect(send.safeParse({ ...base, skills: many }).success).toBe(false);
    expect(send.safeParse({ ...base, skills: many.slice(1) }).success).toBe(true);
  });

  it('composed list: single skill first, in order, duplicates keep only the first occurrence', () => {
    expect(sendSkillRefs({})).toEqual([]);
    expect(sendSkillRefs({ skill: { id: 'a' } })).toEqual([{ id: 'a' }]);
    expect(sendSkillRefs({ skills: [{ id: 'b' }, { id: 'a' }, { id: 'b' }] })).toEqual([{ id: 'b' }, { id: 'a' }]);
    expect(sendSkillRefs({ skill: { id: 'a' }, skills: [{ id: 'b' }, { id: 'a' }] })).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('message marker stays compatible with old records that only wrote a single skill', () => {
    const ref = (id: string) => ({ id, name: id, origin: 'builtin' as const });
    expect(messageSkills({})).toEqual([]);
    expect(messageSkills({ skill: ref('a') })).toEqual([ref('a')]);
    expect(messageSkills({ skills: [ref('a'), ref('b')] })).toEqual([ref('a'), ref('b')]);
  });
});
