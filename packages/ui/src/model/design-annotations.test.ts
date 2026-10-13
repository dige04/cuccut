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
  it('add one: annotation is trimmed; empty, overlong or over-limit annotations are rejected', () => {
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

  it('remove one; returns the input unchanged when the item is absent', () => {
    const list = [note(), note({ id: 'n2' })];
    expect(removeDesignAnnotation(list, 'missing')).toBe(list);
    expect(removeDesignAnnotation(list, 'n1').map((n) => n.id)).toEqual(['n2']);
  });

  it('number markers: only for this design, numbered by position in the whole draft', () => {
    const list = [note(), note({ id: 'n2', canvas: other }), note({ id: 'n3', anchor: 'b' })];
    expect(canvasThreads(list, canvas)).toEqual([
      { id: 'n1', anchor: 'a:Main.dc.html#0.1', n: 1 },
      { id: 'n3', anchor: 'b', n: 3 },
    ]);
    expect(canvasThreads(list, { projectId: 'p1', path: 'designs/landing' })).toEqual([]);
  });

  it('exported copy: strips UI ids and omits empty optional fields', () => {
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

  it('recognize the artboard file from the runtime locator description', () => {
    expect(boardOfDetail('Main.dc.html: #1.2 button "Book now"')).toBe('Main.dc.html');
    expect(boardOfDetail('screens/Phone_2.dc.html')).toBe('screens/Phone_2.dc.html');
    expect(boardOfDetail('Area over Main.dc.html (part): #1 text "Hi"')).toBe('Main.dc.html');
    expect(boardOfDetail('Area over Main.dc.html (whole)')).toBe('Main.dc.html');
    // Spans several artboards, blank space on the canvas, or sticky notes: no single artboard.
    expect(boardOfDetail('Area over A.dc.html (whole); B.dc.html (part)')).toBeUndefined();
    expect(boardOfDetail('canvas 120,40')).toBeUndefined();
    expect(boardOfDetail('note "Flows"')).toBeUndefined();
    expect(boardOfDetail(undefined)).toBeUndefined();
  });
});
