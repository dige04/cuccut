import { describe, expect, it } from 'vitest';
import {
  aspectCanvas,
  aspectOf,
  captionStyleRoot,
  colorParts,
  colorString,
  decimalSeconds,
  editableTextStyle,
  formatDb,
  nested,
  patchCaptionStyle,
  patchShape,
  patchTextStyle,
  percentFromVolume,
  rateFromSpeed,
  volumeFromPercent,
  withAlpha,
} from './property-values.ts';

describe('speed change', () => {
  it('speed rounds to two decimals, then reduces the fraction', () => {
    expect(rateFromSpeed(1.5)).toEqual({ num: 3, den: 2 });
    expect(rateFromSpeed(0.25)).toEqual({ num: 1, den: 4 });
    expect(rateFromSpeed(0.33)).toEqual({ num: 33, den: 100 });
    expect(rateFromSpeed(2)).toEqual({ num: 2, den: 1 });
    expect(rateFromSpeed(1.234)).toEqual({ num: 123, den: 100 });
  });
});

describe('volume', () => {
  it('volume is a linear multiplier: 1 is 100%, 0% is muted, up to 400%', () => {
    expect(percentFromVolume(1)).toBe(100);
    expect(volumeFromPercent(200)).toBe(2);
    expect(percentFromVolume(volumeFromPercent(200))).toBe(200);
    expect(volumeFromPercent(0)).toBe(0);
    expect(percentFromVolume(0)).toBe(0);
    expect(volumeFromPercent(5000)).toBe(4);
    expect(percentFromVolume(9)).toBe(400);
  });

  it('dB reading includes a sign', () => {
    expect(formatDb(6.02)).toBe('+6.0 dB');
    expect(formatDb(-3.5)).toBe('−3.5 dB');
    expect(formatDb(0)).toBe('0.0 dB');
    expect(formatDb(-96)).toBe('−∞ dB');
  });
});

describe('aspect ratio', () => {
  it('short side is unchanged; long side is scaled proportionally to an even number', () => {
    const hd = { width: 1920, height: 1080 };
    expect(aspectCanvas(hd, '9:16')).toEqual({ width: 1080, height: 1920 });
    expect(aspectCanvas(hd, '1:1')).toEqual({ width: 1080, height: 1080 });
    expect(aspectCanvas(hd, '4:3')).toEqual({ width: 1440, height: 1080 });
    expect(aspectCanvas({ width: 1080, height: 1920 }, '16:9')).toEqual({ width: 1920, height: 1080 });
    expect(aspectCanvas({ width: 1000, height: 1000 }, '16:9')).toEqual({ width: 1778, height: 1000 });
  });

  it('recognizes the current aspect ratio; null if unrecognized', () => {
    expect(aspectOf({ width: 1920, height: 1080 })).toBe('16:9');
    expect(aspectOf({ width: 1080, height: 1350 })).toBeNull();
  });
});

describe('color', () => {
  it('splits into six-digit hex and opacity, then joins them back', () => {
    expect(colorParts('rgba(0, 0, 0, 0.8)', '#FFFFFF')).toEqual({ hex: '#000000', alpha: 0.8 });
    expect(colorParts('#3b63fb', '#FFFFFF')).toEqual({ hex: '#3B63FB', alpha: 1 });
    expect(colorParts(undefined, '#ffffff')).toEqual({ hex: '#FFFFFF', alpha: 1 });
    expect(colorString('#3B63FB', 1)).toBe('#3B63FB');
    expect(colorString('#3b63fb', 0.5)).toBe('#3B63FB80');
    expect(withAlpha('#FF0000', 0.45, '#000000')).toBe('#FF000073');
  });
});

describe('style object replaced as a whole', () => {
  it('text style: patch is applied on top, other fields are kept, no schema added', () => {
    const style = { fontSize: 40, fontColor: '#FFFFFF' };
    expect(patchTextStyle(style, { bold: true })).toEqual({
      fontSize: 40,
      fontColor: '#FFFFFF',
      bold: true,
    });
    expect(style).toEqual({ fontSize: 40, fontColor: '#FFFFFF' });
  });

  it('nested fields only replace the keys given', () => {
    const style = { dropShadow: { on: false, color: '#000000', rotation: 45 } };
    expect(patchTextStyle(style, nested(style, 'dropShadow', { on: true }))).toEqual({
      dropShadow: { on: true, color: '#000000', rotation: 45 },
    });
    expect(nested({}, 'glow', { on: true })).toEqual({ glow: { on: true } });
  });

  it('shape parameters: patch is applied on top; defaults to rectangle when there is no kind', () => {
    expect(patchShape({ shape: 'ellipse', fill: '#FF0000' }, { cornerRadius: [12, 12, 12, 12] })).toEqual({
      shape: 'ellipse',
      fill: '#FF0000',
      cornerRadius: [12, 12, 12, 12],
    });
    expect(patchShape(undefined, { fill: '#00FF00' })).toEqual({ shape: 'rect', fill: '#00FF00' });
  });

  it('text style with a schema (another format) cannot be changed', () => {
    expect(editableTextStyle({})).toBe(true);
    expect(editableTextStyle(undefined)).toBe(true);
    expect(editableTextStyle({ schema: 'cuccut.legacy-text-style/0' })).toBe(false);
    expect(editableTextStyle({ schema: 'other/1' })).toBe(false);
  });
});

describe('subtitle style document', () => {
  it('root object of the Studio style; other schemas are read-only', () => {
    expect(captionStyleRoot({ schema: 'cuccut.legacy-studio-style/0.1', style: { y: 80 } })).toEqual({ y: 80 });
    expect(captionStyleRoot({ schema: 'cuccut.boxed-caption-style/1' })).toBeNull();
  });

  it('a patch only touches the style root object; other body fields are kept', () => {
    const body = { schema: 'cuccut.legacy-studio-style/0.1', name: '默认', style: { y: 86, fontSize: 30 } };
    expect(patchCaptionStyle(body, { y: 10 })).toEqual({
      schema: 'cuccut.legacy-studio-style/0.1',
      name: '默认',
      style: { y: 10, fontSize: 30 },
    });
  });
});

describe('time', () => {
  it('seconds are written as a decimal string', () => {
    expect(decimalSeconds(1.5)).toBe('1.5');
    expect(decimalSeconds(0)).toBe('0');
    expect(decimalSeconds(0.1 + 0.2)).toBe('0.3');
    expect(decimalSeconds(-1)).toBe('0');
  });
});
