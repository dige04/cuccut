import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RpcError, type DesignSystemAnnotation, type FileTarget, type SlideAnnotation } from '@cuccut/protocol';
import { resolveDesignSystemAnnotations, resolveSlideAnnotations } from './slides.ts';

/** Slide annotations carried by a message: the deck is replaced with a path relative to the session's working directory (docs/design/slides §9). */

const cwd = path.resolve('/work/project');
const other = path.resolve('/work/other');
const note = (deck: FileTarget): SlideAnnotation => ({ deck, anchor: 'a', label: '第 1 页', text: '改' });
const locate = (target: FileTarget) => {
  if ('entryId' in target) {
    if (target.entryId === 'gone') throw new RpcError('not-found', 'gone');
    return target.entryId === 'far' ? { root: other, file: path.join(other, 'decks', 'far') } : { root: cwd, file: path.join(cwd, 'decks', 'near') };
  }
  return { root: cwd, file: target.path };
};

describe('resolveSlideAnnotations', () => {
  it('undefined when there is no annotation', () => {
    expect(resolveSlideAnnotations(undefined, cwd, locate)).toBeUndefined();
    expect(resolveSlideAnnotations([], cwd, locate)).toBeUndefined();
  });

  it('a deck in the working directory is written as a relative path ending in /; absolute paths given for Space entries are also converted to relative', () => {
    const resolved = resolveSlideAnnotations(
      [note({ conversationId: 'c', path: 'talk' }), note({ projectId: 'p', path: 'decks/talk/' }), note({ entryId: 'near' }), note({ conversationId: 'c', path: '.' })],
      cwd,
      locate,
    );
    expect(resolved?.map((r) => r.deckPath)).toEqual(['talk/', 'decks/talk/', 'decks/near/', './']);
    expect(resolved?.[0]?.annotation).toEqual(note({ conversationId: 'c', path: 'talk' }));
  });

  it('a path outside the working directory is written as absolute; an entry not found is rejected in full', () => {
    const [far] = resolveSlideAnnotations([note({ entryId: 'far' })], cwd, locate)!;
    expect(far!.deckPath).toBe(`${path.join(other, 'decks', 'far')}/`);
    expect(() => resolveSlideAnnotations([note({ entryId: 'gone' })], cwd, locate)).toThrow(RpcError);
  });
});

describe('resolveDesignSystemAnnotations (docs/design/canvas §10.6)', () => {
  const system = (target: FileTarget): DesignSystemAnnotation => ({ system: target, anchor: 'comp-Button', section: 'components', label: 'Button', text: '改' });

  it('same format as slide annotations: undefined when absent, relative path inside the working directory, absolute path outside, entire entry rejected when not found', () => {
    expect(resolveDesignSystemAnnotations(undefined, cwd, locate)).toBeUndefined();
    expect(resolveDesignSystemAnnotations([], cwd, locate)).toBeUndefined();
    const resolved = resolveDesignSystemAnnotations([system({ conversationId: 'c', path: 'spectrum-2' }), system({ entryId: 'far' })], cwd, locate);
    expect(resolved?.map((r) => r.systemPath)).toEqual(['spectrum-2/', `${path.join(other, 'decks', 'far')}/`]);
    expect(resolved?.[0]?.annotation).toEqual(system({ conversationId: 'c', path: 'spectrum-2' }));
    expect(() => resolveDesignSystemAnnotations([system({ entryId: 'gone' })], cwd, locate)).toThrow(RpcError);
  });
});
