import { describe, expect, it } from 'vitest';
import type { DocumentRecord, Sequence } from '@cuccut/protocol';
import { fallbackUndoOperations, inDubGroup, mutedItemsOf, planTransaction } from './dub-undo.ts';

const sequence = (extra: Partial<Sequence> = {}): Sequence =>
  ({
    id: 'seq',
    items: [
      { id: 'v1', type: 'video', embeddedAudio: { enabled: false, volume: 1 } },
      { id: 'a1', type: 'audio', mix: { volume: 1, muted: true } },
      { id: 'a2', type: 'audio', mix: { volume: 1 } },
      {
        id: 'd1',
        type: 'audio',
        mix: { volume: 1 },
        role: 'dub',
        extensions: { 'cuccut.dub': { groupId: 'dub_p1', language: 'en', unitId: 'u1' } },
      },
      {
        id: 'd2',
        type: 'audio',
        mix: { volume: 1 },
        role: 'dub',
        extensions: { 'cuccut.dub': { groupId: 'dub_p1', language: 'en', unitId: 'u2' } },
      },
      {
        id: 'bg',
        type: 'audio',
        mix: { volume: 1 },
        role: 'music',
        extensions: { 'cuccut.dub': { groupId: 'dub_p1', stem: 'background' } },
      },
      { id: 'other', type: 'audio', mix: { volume: 1 }, role: 'dub', extensions: { 'cuccut.dub': { groupId: 'dub_p0' } } },
    ],
    ducking: [
      { id: 'r1', enabled: true, trigger: { kind: 'items', trackIds: ['trk-dub'] }, target: { itemIds: ['v1'] }, depth: 12 },
      { id: 'r2', enabled: true, trigger: { kind: 'items', trackIds: ['trk-music'] }, target: { itemIds: ['v1'] }, depth: 6 },
    ],
    ...extra,
  }) as unknown as Sequence;

describe('undo this dub group', () => {
  it('applying the dub edit: createdBy of the dub plan\'s earliest version', () => {
    const record = {
      revisions: {
        r2: { revision: 'r2', createdAt: '2026-10-03T10:05:00Z', createdBy: 'tx-edit', contentHash: '', byteLength: 0 },
        r1: { revision: 'r1', createdAt: '2026-10-03T10:00:00Z', createdBy: 'tx-apply', contentHash: '', byteLength: 0 },
      },
    } as unknown as DocumentRecord;
    expect(planTransaction(record)).toBe('tx-apply');
    expect(planTransaction(undefined)).toBeNull();
  });

  it('reads the instances muted this time from the dub plan', () => {
    expect(mutedItemsOf({ extensions: { 'cuccut.dub': { mutedItemIds: ['v1', 'a1', 3] } } })).toEqual(['v1', 'a1']);
    expect(mutedItemsOf({ extensions: {} })).toEqual([]);
    expect(mutedItemsOf(null)).toEqual([]);
  });

  it('partial undo: delete this group\'s instances (including background), restore those still muted, remove ducking triggered by the dub track', () => {
    expect(inDubGroup({ extensions: { 'cuccut.dub': { groupId: 'dub_p1' } } }, 'dub_p1')).toBe(true);
    const fallback = fallbackUndoOperations(sequence(), { groupId: 'dub_p1', trackId: 'trk-dub' }, ['v1', 'a1', 'a2', 'gone']);
    expect(fallback.operations).toEqual([
      { type: 'deleteItems', sequenceId: 'seq', itemIds: ['d1', 'd2', 'bg'] },
      { type: 'setAudioMix', sequenceId: 'seq', itemId: 'v1', muted: false },
      { type: 'setAudioMix', sequenceId: 'seq', itemId: 'a1', muted: false },
      { type: 'removeDucking', sequenceId: 'seq', ruleId: 'r1' },
    ]);
    expect(fallback).toMatchObject({ removed: 3, unmuted: 2, ducking: 1 });
  });

  it('no operation when nothing is left (instances deleted, ducking removed, sound restored)', () => {
    const bare = sequence({ items: [{ id: 'a2', type: 'audio', mix: { volume: 1 } }] as unknown as Sequence['items'], ducking: undefined });
    expect(fallbackUndoOperations(bare, { groupId: 'dub_p1', trackId: 'trk-dub' }, ['a2']).operations).toEqual([]);
  });
});
