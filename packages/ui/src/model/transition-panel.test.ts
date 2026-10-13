import { describe, expect, it } from 'vitest';
import type { Sequence, SequenceItem, Transition } from '@cuccut/protocol';
import { durationLimits, slotNeighbor, slotOperations, slotState, slotTransition } from './transition-panel.ts';

const fps = { num: 30, den: 1 };

function visual(id: string, trackId: string, fromFrame: number, durationFrames: number, type: 'video' | 'image' = 'video'): SequenceItem {
  return {
    id,
    trackId,
    type,
    enabled: true,
    span: { fromFrame, durationFrames },
    embeddedAudio: { enabled: true, volume: 1 },
  } as unknown as SequenceItem;
}

function sequence(items: SequenceItem[], transitions: Transition[] = []): Sequence {
  return { id: 'seq', revision: '1', fps, items, transitions } as unknown as Sequence;
}

const a = visual('a', 'v1', 0, 60);
const b = visual('b', 'v1', 60, 60);
const c = visual('c', 'v2', 60, 60);
const pair: Transition = {
  id: 't1',
  leftItemId: 'a',
  rightItemId: 'b',
  kind: 'wipe',
  params: { direction: 'up' },
  durationFrames: 15,
  easing: 'ease-out',
  placement: 'end-at-cut',
};

describe('transition section', () => {
  it('two edges: entering checks rightItemId, leaving checks leftItemId; neighbors must abut on the same track', () => {
    const seq = sequence([a, b, c], [pair]);
    expect(slotTransition(seq, 'b', 'in')).toBe(pair);
    expect(slotTransition(seq, 'a', 'out')).toBe(pair);
    expect(slotTransition(seq, 'b', 'out')).toBeUndefined();
    expect(slotNeighbor(seq, b, 'in')?.id).toBe('a');
    expect(slotNeighbor(seq, a, 'out')?.id).toBe('b');
    expect(slotNeighbor(seq, c, 'in')).toBeUndefined();
  });

  it('reads the edge: kind, direction, duration (seconds), easing, whether it abuts', () => {
    expect(slotState(sequence([a, b], [pair]), b, 'in')).toEqual({
      kind: 'wipe',
      direction: 'up',
      color: '#000000',
      seconds: 0.5,
      easing: 'ease-out',
      joined: true,
      audioCrossfade: false,
    });
    // No transition: with a neighbour, the default is a joined transition.
    expect(slotState(sequence([a, b]), b, 'in')).toMatchObject({ kind: 'none', joined: true, direction: 'right', seconds: 0.5 });
    expect(slotState(sequence([c]), c, 'in')).toMatchObject({ kind: 'none', joined: false });
    // Unrecognised kind: no tile is selected, and this is stated.
    expect(slotState(sequence([a, b], [{ ...pair, kind: 'iris' }]), b, 'in')).toMatchObject({ kind: 'none', unknownKind: 'iris' });
  });

  it('both sides: keep the existing placement; parameters include only what this kind needs; cross-fade only when both sides have audio', () => {
    const seq = sequence([a, b], [pair]);
    const state = slotState(seq, b, 'in');
    expect(slotOperations(seq, b, 'in', { ...state, kind: 'dissolve', audioCrossfade: true })).toEqual([
      {
        type: 'setTransition',
        sequenceId: 'seq',
        leftItemId: 'a',
        rightItemId: 'b',
        kind: 'dissolve',
        duration: { unit: 'seconds', value: '0.5' },
        alignment: 'nearest-frame',
        easing: 'ease-out',
        placement: 'end-at-cut',
        audioCrossfade: true,
      },
    ]);
    const image = visual('b', 'v1', 60, 60, 'image');
    const mixed = sequence([a, image], [pair]);
    expect(slotOperations(mixed, image, 'in', { ...state, kind: 'dip-to-color', color: '#FF0000', audioCrossfade: true })[0]).toMatchObject({
      kind: 'dip-to-color',
      params: { color: '#FF0000' },
    });
    expect(slotOperations(mixed, image, 'in', { ...state, audioCrossfade: true })[0]).not.toHaveProperty('audioCrossfade');
  });

  it('one side: only that side, centered, no cross-fade; wipe has no parameters (a direction from an older draft is no longer written back)', () => {
    const seq = sequence([a, b], [pair]);
    const state = slotState(seq, a, 'out');
    expect(slotOperations(seq, a, 'out', { ...state, joined: false, seconds: 1.25, audioCrossfade: true })).toEqual([
      {
        type: 'setTransition',
        sequenceId: 'seq',
        leftItemId: 'a',
        kind: 'wipe',
        duration: { unit: 'seconds', value: '1.25' },
        alignment: 'nearest-frame',
        easing: 'ease-out',
        placement: 'center',
      },
    ]);
  });

  it('choosing \'none\' removes the existing one; does nothing when there is none', () => {
    const seq = sequence([a, b], [pair]);
    expect(slotOperations(seq, b, 'in', { ...slotState(seq, b, 'in'), kind: 'none' })).toEqual([
      { type: 'removeTransition', sequenceId: 'seq', transitionId: 't1' },
    ]);
    expect(slotOperations(seq, b, 'out', { ...slotState(seq, b, 'out'), kind: 'none' })).toEqual([]);
  });

  it('duration range: slider up to min(2, clip length / 2), exact input up to clip length (not over 10 seconds)', () => {
    expect(durationLimits(visual('x', 'v1', 0, 600), fps)).toEqual({ min: 0.1, max: 2, hardMax: 10 });
    expect(durationLimits(visual('x', 'v1', 0, 30), fps)).toEqual({ min: 0.1, max: 0.5, hardMax: 1 });
    expect(durationLimits(visual('x', 'v1', 0, 2), fps).max).toBeCloseTo(1 / 30, 9);
  });
});
