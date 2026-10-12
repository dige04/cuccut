import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RpcError, type DesignSystemAnnotation, type FileTarget, type SlideAnnotation } from '@cuccut/protocol';
import { resolveDesignSystemAnnotations, resolveSlideAnnotations } from './slides.ts';

/** 消息带的幻灯片标注：deck 换成相对会话工作目录的路径（docs/design/slides §9）。 */

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
  it('没有标注时为 undefined', () => {
    expect(resolveSlideAnnotations(undefined, cwd, locate)).toBeUndefined();
    expect(resolveSlideAnnotations([], cwd, locate)).toBeUndefined();
  });

  it('工作目录里的 deck 写相对路径，以 / 结尾；Space 条目给的绝对路径也换成相对的', () => {
    const resolved = resolveSlideAnnotations(
      [note({ conversationId: 'c', path: 'talk' }), note({ projectId: 'p', path: 'decks/talk/' }), note({ entryId: 'near' }), note({ conversationId: 'c', path: '.' })],
      cwd,
      locate,
    );
    expect(resolved?.map((r) => r.deckPath)).toEqual(['talk/', 'decks/talk/', 'decks/near/', './']);
    expect(resolved?.[0]?.annotation).toEqual(note({ conversationId: 'c', path: 'talk' }));
  });

  it('不在工作目录里的写绝对路径；找不到的整条拒绝', () => {
    const [far] = resolveSlideAnnotations([note({ entryId: 'far' })], cwd, locate)!;
    expect(far!.deckPath).toBe(`${path.join(other, 'decks', 'far')}/`);
    expect(() => resolveSlideAnnotations([note({ entryId: 'gone' })], cwd, locate)).toThrow(RpcError);
  });
});

describe('resolveDesignSystemAnnotations（docs/design/canvas §10.6）', () => {
  const system = (target: FileTarget): DesignSystemAnnotation => ({ system: target, anchor: 'comp-Button', section: 'components', label: 'Button', text: '改' });

  it('与幻灯片标注同一种写法：没有时为 undefined，工作目录里写相对路径，外面写绝对路径，找不到整条拒绝', () => {
    expect(resolveDesignSystemAnnotations(undefined, cwd, locate)).toBeUndefined();
    expect(resolveDesignSystemAnnotations([], cwd, locate)).toBeUndefined();
    const resolved = resolveDesignSystemAnnotations([system({ conversationId: 'c', path: 'spectrum-2' }), system({ entryId: 'far' })], cwd, locate);
    expect(resolved?.map((r) => r.systemPath)).toEqual(['spectrum-2/', `${path.join(other, 'decks', 'far')}/`]);
    expect(resolved?.[0]?.annotation).toEqual(system({ conversationId: 'c', path: 'spectrum-2' }));
    expect(() => resolveDesignSystemAnnotations([system({ entryId: 'gone' })], cwd, locate)).toThrow(RpcError);
  });
});
