import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_ANNOTATION_LIMITS } from '@cuccut/protocol';
import {
  addDesignSystemAnnotation,
  removeDesignSystemAnnotation,
  sentDesignSystemAnnotations,
  systemThreads,
  type DraftDesignSystemAnnotation,
} from './design-system-annotations.ts';

const system = { conversationId: 'c1', path: 'spectrum-2' };
const other = { conversationId: 'c1', path: 'ember' };
const note = (over: Partial<DraftDesignSystemAnnotation> = {}): DraftDesignSystemAnnotation => ({
  id: 'n1',
  system,
  anchor: 'comp-Button',
  section: 'components',
  label: '设计系统「Spectrum 2」 › Components › 组件 “Button”',
  text: '圆角改小',
  ...over,
});

describe('design-system-annotations', () => {
  it('add one: annotation is trimmed; empty, overlong or over-limit annotations are rejected', () => {
    const one = addDesignSystemAnnotation([], note({ text: '  小一点 \n' }));
    expect(one.error).toBeNull();
    expect(one.list[0]!.text).toBe('小一点');
    expect(addDesignSystemAnnotation([], note({ text: '   ' })).error).toBe('empty');
    expect(addDesignSystemAnnotation([], note({ text: 'x'.repeat(DESIGN_SYSTEM_ANNOTATION_LIMITS.text + 1) })).error).toBe('too-long');
    expect(addDesignSystemAnnotation([], note({ text: 'x'.repeat(DESIGN_SYSTEM_ANNOTATION_LIMITS.text) })).error).toBeNull();
    const full = Array.from({ length: DESIGN_SYSTEM_ANNOTATION_LIMITS.perMessage }, (_, i) => note({ id: `n${i}` }));
    const over = addDesignSystemAnnotation(full, note({ id: 'extra' }));
    expect(over.error).toBe('too-many');
    expect(over.list).toBe(full);
  });

  it('remove one; returns the input unchanged when the item is absent', () => {
    const list = [note(), note({ id: 'n2' })];
    expect(removeDesignSystemAnnotation(list, 'missing')).toBe(list);
    expect(removeDesignSystemAnnotation(list, 'n1').map((n) => n.id)).toEqual(['n2']);
  });

  it('number markers: only for this design system, numbered by position in the whole draft, including the section', () => {
    const list = [note(), note({ id: 'n2', system: other }), note({ id: 'n3', anchor: 'ds-cover', section: undefined })];
    expect(systemThreads(list, system)).toEqual([
      { id: 'n1', anchor: 'comp-Button', n: 1, section: 'components' },
      { id: 'n3', anchor: 'ds-cover', n: 3 },
    ]);
    expect(systemThreads(list, { projectId: 'p1', path: 'spectrum-2' })).toEqual([]);
  });

  it('exported copy: strips UI ids and omits empty optional fields', () => {
    expect(sentDesignSystemAnnotations([note({ detail: 'Component "Button" in section components (components/Button/) · comp-Button' })])).toEqual([
      {
        system,
        anchor: 'comp-Button',
        section: 'components',
        label: '设计系统「Spectrum 2」 › Components › 组件 “Button”',
        detail: 'Component "Button" in section components (components/Button/) · comp-Button',
        text: '圆角改小',
      },
    ]);
    const [bare] = sentDesignSystemAnnotations([note({ section: undefined })]);
    expect(bare).not.toHaveProperty('section');
    expect(bare).not.toHaveProperty('detail');
  });
});
