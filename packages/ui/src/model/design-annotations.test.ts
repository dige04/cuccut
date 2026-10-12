import { describe, expect, it } from 'vitest';
import { DESIGN_ANNOTATION_LIMITS } from '@cuccut/protocol';
import {
  addDesignAnnotation,
  boardOfDetail,
  canvasThreads,
  removeDesignAnnotation,
  sentDesignAnnotations,
  type DraftDesignAnnotation,
} from './design-annotations.ts';

const canvas = { conversationId: 'c1', path: 'designs/landing' };
const other = { conversationId: 'c1', path: 'designs/poster' };
const note = (over: Partial<DraftDesignAnnotation> = {}): DraftDesignAnnotation => ({
  id: 'n1',
  canvas,
  anchor: 'a:Main.dc.html#0.1',
  label: 'Main › Button “Book now”',
  text: 'Make it bigger',
  ...over,
});

describe('design-annotations', () => {
  it('加一条：批注去掉首尾空白；空的、超长的、超过条数的不收', () => {
    const one = addDesignAnnotation([], note({ text: '  bigger \n' }));
    expect(one.error).toBeNull();
    expect(one.list[0]!.text).toBe('bigger');
    expect(addDesignAnnotation([], note({ text: '   ' })).error).toBe('empty');
    expect(addDesignAnnotation([], note({ text: 'x'.repeat(DESIGN_ANNOTATION_LIMITS.text + 1) })).error).toBe('too-long');
    expect(addDesignAnnotation([], note({ text: 'x'.repeat(DESIGN_ANNOTATION_LIMITS.text) })).error).toBeNull();
    const full = Array.from({ length: DESIGN_ANNOTATION_LIMITS.perMessage }, (_, i) => note({ id: `n${i}` }));
    const over = addDesignAnnotation(full, note({ id: 'extra' }));
    expect(over.error).toBe('too-many');
    expect(over.list).toBe(full);
  });

  it('删一条；没有这条时原样返回', () => {
    const list = [note(), note({ id: 'n2' })];
    expect(removeDesignAnnotation(list, 'missing')).toBe(list);
    expect(removeDesignAnnotation(list, 'n1').map((n) => n.id)).toEqual(['n2']);
  });

  it('编号标记：只给这份设计稿的，编号是在整份草稿里的序号', () => {
    const list = [note(), note({ id: 'n2', canvas: other }), note({ id: 'n3', anchor: 'b' })];
    expect(canvasThreads(list, canvas)).toEqual([
      { id: 'n1', anchor: 'a:Main.dc.html#0.1', n: 1 },
      { id: 'n3', anchor: 'b', n: 3 },
    ]);
    expect(canvasThreads(list, { projectId: 'p1', path: 'designs/landing' })).toEqual([]);
  });

  it('交出去的那份：去掉界面里的 id，空的可选字段不带', () => {
    expect(sentDesignAnnotations([note({ board: 'Main.dc.html', detail: 'Main.dc.html: #0.1 button', area: true })])).toEqual([
      {
        canvas,
        anchor: 'a:Main.dc.html#0.1',
        board: 'Main.dc.html',
        label: 'Main › Button “Book now”',
        detail: 'Main.dc.html: #0.1 button',
        area: true,
        text: 'Make it bigger',
      },
    ]);
    expect(sentDesignAnnotations([note()])[0]).not.toHaveProperty('board');
  });

  it('从运行时的定位描述里认出画板文件', () => {
    expect(boardOfDetail('Main.dc.html: #1.2 button "Book now"')).toBe('Main.dc.html');
    expect(boardOfDetail('screens/Phone_2.dc.html')).toBe('screens/Phone_2.dc.html');
    expect(boardOfDetail('Area over Main.dc.html (part): #1 text "Hi"')).toBe('Main.dc.html');
    expect(boardOfDetail('Area over Main.dc.html (whole)')).toBe('Main.dc.html');
    // 跨几块画板、画布上的空白处、便签：没有单一的画板
    expect(boardOfDetail('Area over A.dc.html (whole); B.dc.html (part)')).toBeUndefined();
    expect(boardOfDetail('canvas 120,40')).toBeUndefined();
    expect(boardOfDetail('note "Flows"')).toBeUndefined();
    expect(boardOfDetail(undefined)).toBeUndefined();
  });
});
