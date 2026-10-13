import { describe, expect, it } from 'vitest';
import type { FileTarget } from '@cuccut/protocol';
import {
  addSlideAnnotation,
  deckThreads,
  removeSlideAnnotation,
  sentAnnotationId,
  sentSlideAnnotations,
  slideIdOfDetail,
  type DraftSlideAnnotation,
} from './slide-annotations.ts';
import { useDraftSlideAnnotations } from '../state/draft-slide-annotations-store.ts';

// Test cases ported from the prototype designs/cuccut/app/model-home-slides.test.js (add, remove, number markers), with the deck replaced by the protocol's FileTarget.
const deck1: FileTarget = { conversationId: 'c1', path: 'talk/deck.json' };
const deck2: FileTarget = { projectId: 'p1', path: 'slides/intro/deck.json' };
const note = (over: Partial<DraftSlideAnnotation> = {}): DraftSlideAnnotation => ({
  id: 'n1',
  deck: deck1,
  anchor: 's01#title',
  label: 'Slide 1 › Title',
  text: '改短一点',
  ...over,
});

describe('slide annotation draft', () => {
  it('adding an annotation: trims surrounding whitespace; empty, overlong, or beyond 20 entries are rejected', () => {
    const one = addSlideAnnotation([], note({ text: '  改短一点 \n' }));
    expect(one.error).toBe(null);
    expect(one.list[0]!.text).toBe('改短一点');
    expect(addSlideAnnotation([], note({ text: '  ' })).error).toBe('empty');
    expect(addSlideAnnotation([], note({ text: 'x'.repeat(2001) })).error).toBe('too-long');
    expect(addSlideAnnotation([], note({ text: 'x'.repeat(2000) })).error).toBe(null);
    const full = Array.from({ length: 20 }, (_, i) => note({ id: `n${i}` }));
    const over = addSlideAnnotation(full, note({ id: 'n20' }));
    expect(over.error).toBe('too-many');
    expect(over.list).toBe(full);
  });

  it('removing annotations; the editor\'s numbered markers follow the draft\'s whole sequence, and other decks are skipped without renumbering', () => {
    const notes = [note(), note({ id: 'n2', anchor: 's02#list' }), note({ id: 'n3', deck: deck2 }), note({ id: 'n4' })];
    expect(removeSlideAnnotation(notes, 'missing')).toBe(notes);
    expect(removeSlideAnnotation(notes, 'n2').map((n) => n.id)).toEqual(['n1', 'n3', 'n4']);
    expect(deckThreads(notes, deck1)).toEqual([
      { id: 'n1', anchor: 's01#title', n: 1 },
      { id: 'n2', anchor: 's02#list', n: 2 },
      { id: 'n4', anchor: 's01#title', n: 4 },
    ]);
    // The same deck is still recognized when the object is swapped (compared by targetKey)
    expect(deckThreads(notes, { projectId: 'p1', path: 'slides/intro/deck.json' })).toEqual([{ id: 'n3', anchor: 's01#title', n: 3 }]);
  });

  it('the exported copy strips UI ids, and empty optional fields are omitted', () => {
    expect(sentSlideAnnotations([note({ slideId: 's01', detail: 'Slide 1 #s01 · title', area: true }), note({ id: 'n2' })])).toEqual([
      { deck: deck1, anchor: 's01#title', slideId: 's01', label: 'Slide 1 › Title', detail: 'Slide 1 #s01 · title', area: true, text: '改短一点' },
      { deck: deck1, anchor: 's01#title', label: 'Slide 1 › Title', text: '改短一点' },
    ]);
  });

  it('slide id in the location description; the jump id for a sent item', () => {
    expect(slideIdOfDetail('Slide 3 #s03 · heading "Hello"')).toBe('s03');
    expect(slideIdOfDetail('Area on slide 2 #intro-2 (40%, 10%)')).toBe('intro-2');
    expect(slideIdOfDetail('Slide 3 · heading')).toBe(undefined);
    expect(slideIdOfDetail(undefined)).toBe(undefined);
    expect(sentAnnotationId('msg_1', 2)).toBe('msg_1:2');
  });
});

describe('useDraftSlideAnnotations', () => {
  it('separated by session; sent items are removed, and items added during sending are kept', () => {
    const store = useDraftSlideAnnotations.getState();
    expect(store.add('c1', note())).toBe(null);
    expect(store.add('c1', note({ id: 'n2' }))).toBe(null);
    expect(store.add('c2', note({ id: 'other' }))).toBe(null);
    expect(store.add('c1', note({ id: 'blank', text: ' ' }))).toBe('empty');
    useDraftSlideAnnotations.getState().sent('c1', ['n1']);
    expect(useDraftSlideAnnotations.getState().annotations.c1?.map((n) => n.id)).toEqual(['n2']);
    useDraftSlideAnnotations.getState().remove('c1', 'n2');
    expect(useDraftSlideAnnotations.getState().annotations.c1).toBe(undefined);
    useDraftSlideAnnotations.getState().clear('c2');
    expect(useDraftSlideAnnotations.getState().annotations).toEqual({});
  });
});
