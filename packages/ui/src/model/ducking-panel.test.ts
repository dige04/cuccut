import { describe, expect, it } from 'vitest';
import type { DuckingRule, Sequence, SequenceItem, Track } from '@cuccut/protocol';
import {
  changeOperation,
  disableOperations,
  duckingRuleFor,
  enableOperations,
  isDefault,
  isOwnRule,
  resetOperation,
  ruleValues,
  singleTrigger,
  triggerOptions,
} from './ducking-panel.ts';

function track(id: string, order: number, kind: Track['kind']): Track {
  return { id, order, kind } as Track;
}

function audio(id: string, trackId: string, enabled = true): SequenceItem {
  return { id, trackId, type: 'audio', enabled } as SequenceItem;
}

const voice = audio('voice', 'a1');
const music = audio('music', 'a2');
const video = {
  id: 'clip',
  trackId: 'v1',
  type: 'video',
  enabled: true,
  embeddedAudio: { enabled: false, volume: 1 },
} as unknown as SequenceItem;
const ms = (n: number) => ({ ticks: String(n), timescale: 1000 });
const rule: DuckingRule = {
  id: 'd1',
  enabled: true,
  trigger: { kind: 'items', trackIds: ['a1'] },
  target: { itemIds: ['music'] },
  depth: 10,
  attack: ms(20),
  release: ms(350),
};

function sequence(ducking: DuckingRule[] = []): Sequence {
  return {
    id: 'seq',
    tracks: [track('v1', 0, 'visual'), track('a1', 1, 'audio'), track('a2', 2, 'audio')],
    items: [video, voice, music],
    ducking,
  } as unknown as Sequence;
}

describe('duck original sound', () => {
  it('find rule: rules naming the clip take priority, then rules naming the track', () => {
    const byTrack = { ...rule, id: 'd2', target: { trackIds: ['a2'] } };
    expect(duckingRuleFor(sequence([byTrack, rule]), music)?.id).toBe('d1');
    expect(duckingRuleFor(sequence([byTrack]), music)?.id).toBe('d2');
    expect(duckingRuleFor(sequence([rule]), voice)).toBeUndefined();
    expect(isOwnRule(rule, music)).toBe(true);
    expect(isOwnRule(byTrack, music)).toBe(false);
  });

  it('the \'duck under\' options: other tracks that have sounding clips', () => {
    // The video's own sound is off. The picture track does not count.
    expect(triggerOptions(sequence(), music).map((o) => o.key)).toEqual(['a1']);
    expect(triggerOptions(sequence(), video).map((o) => o.key)).toEqual(['a1', 'a2']);
  });

  it('turn on: creates a rule naming only this clip; a disabled rule is re-enabled', () => {
    expect(enableOperations(sequence(), music, 'a1')).toEqual([
      { type: 'setDucking', sequenceId: 'seq', trigger: { kind: 'items', trackIds: ['a1'] }, target: { itemIds: ['music'] } },
    ]);
    expect(enableOperations(sequence([{ ...rule, enabled: false }]), music, 'a1')).toEqual([
      { type: 'setDucking', sequenceId: 'seq', ruleId: 'd1', enabled: true },
    ]);
    expect(enableOperations(sequence([rule]), music, 'a1')).toEqual([]);
  });

  it('turn off: own rules are deleted, shared ones are disabled', () => {
    expect(disableOperations(sequence([rule]), music)).toEqual([{ type: 'removeDucking', sequenceId: 'seq', ruleId: 'd1' }]);
    const shared = { ...rule, target: { itemIds: ['music', 'clip'] } };
    expect(disableOperations(sequence([shared]), music)).toEqual([{ type: 'setDucking', sequenceId: 'seq', ruleId: 'd1', enabled: false }]);
  });

  it('readout and changes: seconds are decimal strings; restoring defaults writes back the three fields', () => {
    expect(ruleValues(rule)).toEqual({ depth: 10, attack: 0.02, release: 0.35 });
    expect(isDefault(rule)).toBe(true);
    expect(isDefault({ ...rule, depth: 18 })).toBe(false);
    expect(singleTrigger(rule)).toBe('a1');
    expect(singleTrigger({ ...rule, trigger: { kind: 'items', trackIds: ['a1'], itemIds: ['x'] } })).toBeNull();
    // A rule triggered by speech does not correspond to any track.
    expect(singleTrigger({ ...rule, trigger: { kind: 'speech' } })).toBeNull();
    expect(changeOperation(sequence([rule]), rule, { trigger: 'v1', release: 1.2 })).toEqual({
      type: 'setDucking',
      sequenceId: 'seq',
      ruleId: 'd1',
      trigger: { kind: 'items', trackIds: ['v1'] },
      release: '1.2',
    });
    expect(resetOperation(sequence([rule]), rule)).toEqual({
      type: 'setDucking',
      sequenceId: 'seq',
      ruleId: 'd1',
      depth: 10,
      attack: '0.02',
      release: '0.35',
    });
  });
});
