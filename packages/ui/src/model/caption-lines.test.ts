import { describe, expect, it } from 'vitest';
import { resolveLineStyle, type Json } from '../render/text-style.ts';
import { editBlock, editLine, followRatio, followShared, lineOverrides, lineSize, lineView, withCaptionStyle } from './caption-lines.ts';

/** The font size the renderer draws on a 540-short-side canvas equals the effective size on the 30-point basis. */
const drawn = (root: Json, kind: 'original' | 'translation', compact: boolean) =>
  resolveLineStyle(root, kind, { width: 960, height: 540 }, compact).fontSize;

describe('scale chain', () => {
  it('defaults: root 30, bilingual original 20, translation 32; monolingual original 30', () => {
    expect(lineSize({}, 'original', true)).toMatchObject({ size: 20, root: 30, explicit: false });
    expect(lineSize({}, 'translation', true).size).toBeCloseTo(32);
    expect(lineSize({}, 'original', false).size).toBe(30);
  });

  it('same algorithm as the renderer', () => {
    const root = { fontSize: 40, bilingualOrigScale: 0.5, transScale: 1.5, origStyle: { fontSize: 22 } };
    for (const kind of ['original', 'translation'] as const)
      for (const compact of [true, false]) expect(lineSize(root, kind, compact).size).toBeCloseTo(drawn(root, kind, compact));
  });

  it('the line shown: overrides layered on top, font size replaced by the effective font size', () => {
    expect(lineView({ fontColor: '#fff', transStyle: { fontColor: '#ff0' } }, 'translation', true)).toMatchObject({ fontColor: '#ff0', fontSize: 32 });
  });
});

describe('original / translation edited separately', () => {
  it('translation: written into transStyle, original untouched', () => {
    const root = { fontColor: '#FFFFFF' };
    const next = editLine(root, { fontColor: '#FFE14D' }, 'translation', true, true);
    expect(next).toEqual({ fontColor: '#FFFFFF', transStyle: { fontColor: '#FFE14D' } });
  });

  it('translation size changes transScale, original size changes root size, what is drawn is the entered number', () => {
    const t = editLine({}, { fontSize: 40 }, 'translation', true, true);
    expect(t.transStyle).toEqual({});
    expect(drawn(t, 'translation', true)).toBeCloseTo(40);
    expect(drawn(t, 'original', true)).toBeCloseTo(20);
    const o = editLine({}, { fontSize: 24 }, 'original', true, true);
    expect(drawn(o, 'original', true)).toBeCloseTo(24);
    expect(drawn(o, 'translation', true)).toBeCloseTo(24 * 1.6);
  });

  it('a size set separately changes that separate value', () => {
    const next = editLine({ transStyle: { fontSize: 18 } }, { fontSize: 26 }, 'translation', true, true);
    expect(next.transStyle).toEqual({ fontSize: 26 });
    expect(followRatio(next, 'translation')).toEqual({});
  });

  it('only one line kind: write root style, remove same-named keys from overrides', () => {
    const next = editLine({ fontColor: '#fff', origStyle: { fontColor: '#f00', bold: true } }, { fontColor: '#0f0' }, 'original', false, false);
    expect(next).toEqual({ fontColor: '#0f0', origStyle: { bold: true } });
    expect(editLine({ origStyle: { fontColor: '#f00' } }, { fontColor: '#0f0', fontSize: 36 }, 'original', false, false)).toEqual({
      fontColor: '#0f0',
      fontSize: 36,
    });
    expect(drawn(editLine({}, { fontSize: 36 }, 'translation', false, false), 'translation', false)).toBeCloseTo(36);
  });

  it('all follow, count, whole body', () => {
    const root = { y: 80, transStyle: { fontColor: '#ff0', bgOn: null } };
    expect(lineOverrides(root, 'translation')).toBe(2);
    expect(lineOverrides(root, 'original')).toBe(0);
    expect(followShared(root, 'translation')).toEqual({ y: 80 });
    expect(withCaptionStyle({ schema: 'x', style: { a: 1 }, extra: 2 }, { b: 1 })).toEqual({
      schema: 'cuccut.legacy-studio-style/0.1',
      style: { b: 1 },
      extra: 2,
    });
  });
});

describe('both lines changed together', () => {
  it('write root style, remove same-named keys from both line overrides, keep other overrides', () => {
    const root = { fontColor: '#FFFFFF', origStyle: { fontColor: '#f00', bold: true }, transStyle: { fontColor: '#0f0' } };
    expect(editBlock(root, { fontColor: '#FFE14D' })).toEqual({ fontColor: '#FFE14D', origStyle: { bold: true } });
  });

  it('font size converted back to root size per original line, separately set size removed, translation follows the scale', () => {
    const next = editBlock({ fontSize: 30, origStyle: { fontSize: 18 }, transStyle: { fontSize: 40 } }, { fontSize: 24 });
    expect(next).toEqual({ fontSize: 36 });
    expect(drawn(next, 'original', true)).toBeCloseTo(24);
    expect(drawn(next, 'translation', true)).toBeCloseTo(24 * (32 / 20));
  });
});
