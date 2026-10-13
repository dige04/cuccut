import { beforeEach, describe, expect, it } from 'vitest';
import { useDraftSkills } from './draft-skills-store.ts';

describe('skill draft picked in the input box', () => {
  beforeEach(() => useDraftSkills.setState({ skills: {} }));

  it('appended in the order attached; duplicates are not added again; different draft keys do not affect each other', () => {
    const store = useDraftSkills.getState();
    store.add('c1', 'caption-layout');
    store.add('c1', 'b-roll');
    store.add('c1', 'caption-layout');
    store.add('c2', 'blog-post');
    expect(useDraftSkills.getState().skills).toEqual({ c1: ['caption-layout', 'b-roll'], c2: ['blog-post'] });
  });

  it('removed one by one; when all are removed the key is also removed', () => {
    const store = useDraftSkills.getState();
    store.set('c1', ['a', 'b', 'a', 'c']);
    expect(useDraftSkills.getState().skills.c1).toEqual(['a', 'b', 'c']);
    store.remove('c1', 'b');
    expect(useDraftSkills.getState().skills.c1).toEqual(['a', 'c']);
    store.remove('c1', 'a');
    store.remove('c1', 'c');
    expect(useDraftSkills.getState().skills).toEqual({});
  });

  it('no change keeps the same reference; the whole group moves to another draft key', () => {
    const store = useDraftSkills.getState();
    store.add('draft', 'a');
    const before = useDraftSkills.getState().skills;
    store.add('draft', 'a');
    store.remove('draft', 'nope');
    expect(useDraftSkills.getState().skills).toBe(before);
    store.add('draft', 'b');
    store.move('draft', 'c1');
    expect(useDraftSkills.getState().skills).toEqual({ c1: ['a', 'b'] });
  });
});
