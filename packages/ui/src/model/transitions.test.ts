import { describe, expect, it } from 'vitest';
import type { Sequence, Transition } from '@cuccut/protocol';
import { applyEasing, transitionReach, transitionWindow } from './transitions.ts';

const base: Transition = { id: 't', kind: 'dissolve', durationFrames: 10, easing: 'linear', placement: 'center' };
const left = { fromFrame: 0, durationFrames: 30 };
const right = { fromFrame: 30, durationFrames: 30 };

describe('transition window', () => {
  it('both sides placed on the cut point per placement (centered, rounded down)', () => {
    expect(transitionWindow(base, left, right)).toEqual([25, 35]);
    expect(transitionWindow({ ...base, durationFrames: 9 }, left, right)).toEqual([26, 35]);
    expect(transitionWindow({ ...base, placement: 'start-at-cut' }, left, right)).toEqual([30, 40]);
    expect(transitionWindow({ ...base, placement: 'end-at-cut' }, left, right)).toEqual([20, 30]);
  });

  it('in starts at the instance start, out ends at the instance end', () => {
    expect(transitionWindow(base, undefined, right)).toEqual([30, 40]);
    expect(transitionWindow(base, left, undefined)).toEqual([20, 30]);
    expect(transitionWindow(base, undefined, undefined)).toBeNull();
  });
});

describe('easing', () => {
  it('matches the four from Rust', () => {
    expect(applyEasing('linear', 0.25)).toBe(0.25);
    expect(applyEasing('ease-in', 0.5)).toBe(0.25);
    expect(applyEasing('ease-out', 0.5)).toBe(0.75);
    expect(applyEasing('ease-in-out', 0.25)).toBeCloseTo(0.15625, 12);
    expect(applyEasing('ease-in-out', 0.5)).toBe(0.5);
  });
});

describe('frames the transition makes the instance occupy', () => {
  it('both sides: left draws to the window end, right starts at the window start; one side unchanged', () => {
    const items = [
      { id: 'a', span: left },
      { id: 'b', span: right },
      { id: 'c', span: { fromFrame: 60, durationFrames: 30 } },
    ];
    const sequence = {
      items,
      transitions: [
        { ...base, leftItemId: 'a', rightItemId: 'b' },
        { ...base, id: 't2', rightItemId: 'c' },
      ],
    } as unknown as Sequence;
    const reach = transitionReach(sequence);
    expect(reach.get('a')).toEqual([0, 35]);
    expect(reach.get('b')).toEqual([25, 60]);
    expect(reach.has('c')).toBe(false);
  });
});
