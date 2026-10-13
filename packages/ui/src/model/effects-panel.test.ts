import { describe, expect, it } from 'vitest';
import type { Fx, SequenceItem } from '@cuccut/protocol';
import {
  effectKindsFor,
  effectNumber,
  effectOn,
  hasKnownEffects,
  resetEffects,
  setEffectsOperation,
  toggleEffect,
  unknownKinds,
  withEffect,
} from './effects-panel.ts';

const blurred: Fx = { blur: 4 };

describe('effects', () => {
  it('four cards are shown only for clips with fx: visual media and compositions; text, graphics and sound have none', () => {
    expect(effectKindsFor({ type: 'video' } as SequenceItem)).toEqual(['color-adjust', 'gaussian-blur', 'drop-shadow', 'stroke']);
    expect(effectKindsFor({ type: 'composition' } as SequenceItem)).toEqual(['color-adjust', 'gaussian-blur', 'drop-shadow', 'stroke']);
    expect(effectKindsFor({ type: 'text' } as SequenceItem)).toEqual([]);
    expect(effectKindsFor({ type: 'shape' } as SequenceItem)).toEqual([]);
    expect(effectKindsFor({ type: 'audio' } as SequenceItem)).toEqual([]);
  });

  it('edit one card: values merge into the fields it manages; if still off, it is turned on with default values, other fields untouched', () => {
    expect(withEffect(blurred, 'gaussian-blur', { radius: 9 })).toEqual({ blur: 9 });
    expect(withEffect({ grayscale: 1 }, 'drop-shadow', { opacity: 0.8 })).toEqual({
      grayscale: 1,
      shadow: { offsetX: 0, offsetY: 8, blur: 12, color: '#000000', opacity: 0.8 },
    });
    // Color correction: the item that was changed is written; the other four are filled in as 0 (when the card is open, all five are present).
    expect(withEffect(undefined, 'color-adjust', { hue: 0.2 })).toEqual({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      hue: 0.2,
    });
  });

  it('toggle: turning off removes the fields it manages (turning back on returns to defaults); already-on is unchanged', () => {
    expect(toggleEffect(blurred, 'gaussian-blur', false)).toEqual({});
    expect(toggleEffect({}, 'gaussian-blur', true)).toEqual({ blur: 8 });
    expect(toggleEffect(blurred, 'gaussian-blur', true)).toEqual(blurred);
    const tinted: Fx = { hue: 0.1, blur: 2 };
    expect(effectOn(tinted, 'color-adjust')).toBe(true);
    expect(toggleEffect(tinted, 'color-adjust', false)).toEqual({ blur: 2 });
  });

  it('readout: missing values use the effect\'s default', () => {
    expect(effectNumber(blurred, 'gaussian-blur', 'radius')).toBe(4);
    expect(effectNumber({}, 'gaussian-blur', 'radius')).toBe(8);
    expect(effectNumber(undefined, 'color-adjust', 'brightness')).toBe(0);
    expect(effectNumber({ stroke: { width: 2, color: '#FF0000' } }, 'stroke', 'width')).toBe(2);
    expect(effectNumber(undefined, 'drop-shadow', 'offsetY')).toBe(8);
  });

  it('fields with no control on the page are kept as is: reset does not touch them, and the ones actually in effect are listed', () => {
    const fx: Fx = { blur: 4, grayscale: 1, filterPreset: 'none', exposure: 0 };
    expect(resetEffects(fx)).toEqual({ grayscale: 1, filterPreset: 'none', exposure: 0 });
    expect(unknownKinds(fx)).toEqual(['灰度']);
    expect(hasKnownEffects({ grayscale: 1 })).toBe(false);
    expect(hasKnownEffects(fx)).toBe(true);
  });

  it('commit: replaces the whole fx; writes null when there is nothing', () => {
    expect(setEffectsOperation('seq', 'item', { blur: 3 })).toEqual({
      type: 'setEffects',
      sequenceId: 'seq',
      itemId: 'item',
      fx: { blur: 3 },
    });
    expect(setEffectsOperation('seq', 'item', {})).toEqual({ type: 'setEffects', sequenceId: 'seq', itemId: 'item', fx: null });
    expect(setEffectsOperation('seq', 'item', undefined)).toMatchObject({ fx: null });
  });
});
