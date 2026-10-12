import { describe, expect, it } from 'vitest';
import type { DocumentRecord, SpaceEntry, TimelineItem } from '@cuccut/protocol';
import { SHORTS_COPY } from '../components/editor/shorts-copy.ts';
import { MADE_SHOWN, createdVideoIds, framingShots, madeShorts, pagerIndex, readDerivation, shortsBatch } from './shorts-result.ts';

function video(id: string, over: Partial<SpaceEntry> = {}): SpaceEntry {
  return {
    id: `e-${id}`,
    kind: 'video',
    name: id,
    fileName: id,
    source: { projectId: 'p1', conversationId: null },
    relPath: id,
    size: 0,
    lastActivityAt: '2026-10-10T10:00:00.000Z',
    createdAt: '2026-10-10T10:00:00.000Z',
    status: null,
    user: { favorite: false, displayName: null, trashedAt: null },
    ref: { videoId: id },
    ...over,
  };
}
const child = (id: string, createdAt: string, over: Partial<SpaceEntry> = {}) =>
  video(id, { createdAt, origin: { source: 'derived', projectId: 'p1', videoId: 'parent', capability: 'videos-derive' }, ...over });

describe('shortsBatch', () => {
  const key = { parentVideoId: 'parent', conversationId: 'c1', handedAt: '2026-10-10T12:00:00.000Z', created: null };

  it('picks the parent’s children created after the handoff, oldest first', () => {
    const entries = [
      video('parent'),
      child('old', '2026-10-10T11:00:00.000Z'),
      child('b', '2026-10-10T12:05:00.000Z'),
      child('a', '2026-10-10T12:01:00.000Z'),
      video('other', { createdAt: '2026-10-10T12:02:00.000Z', origin: { source: 'derived', videoId: 'elsewhere' } }),
      child('gone', '2026-10-10T12:03:00.000Z', { user: { favorite: false, displayName: null, trashedAt: '2026-10-10T12:10:00.000Z' } }),
    ];
    expect(shortsBatch(entries, key).map((e) => e.name)).toEqual(['a', 'gone', 'b']);
  });

  it('also takes the videos the session created, and prefers origin.conversationId when present', () => {
    const entries = [
      child('earlier', '2026-10-10T11:00:00.000Z'),
      child('tagged', '2026-10-10T12:01:00.000Z', {
        origin: { source: 'derived', videoId: 'parent', conversationId: 'c2' },
      }),
      child('mine', '2026-10-10T09:00:00.000Z', { origin: { source: 'derived', videoId: 'parent', conversationId: 'c1' } }),
    ];
    expect(shortsBatch(entries, { ...key, created: new Set(['earlier']) }).map((e) => e.name)).toEqual(['mine', 'earlier']);
  });

  it('falls back to last activity when the runtime gives no creation time', () => {
    const entries = [child('x', '', { createdAt: null, lastActivityAt: '2026-10-10T12:30:00.000Z' })];
    expect(shortsBatch(entries, key)).toHaveLength(1);
  });
});

describe('createdVideoIds', () => {
  it('collects video-created items and stays null until the timeline loads', () => {
    expect(createdVideoIds(undefined)).toBeNull();
    const items = [
      { kind: 'video-created', videoId: 'v1' },
      { kind: 'user-message' },
    ] as unknown as TimelineItem[];
    expect([...createdVideoIds(items)!]).toEqual(['v1']);
  });
});

describe('readDerivation', () => {
  it('reads the derivation summary of a child', () => {
    const record = {
      id: 'd1',
      kind: 'derivation',
      name: 'Derivation',
      currentRevision: 'r1',
      revisions: {
        r1: {
          revision: 'r1',
          contentHash: '',
          byteLength: 0,
          createdAt: '',
          createdBy: 't',
          summary: { schema: 'cuccut.derivation/1', parentVideoId: 'parent', parentRevision: 'v3', range: { start: 12.5, end: 48 }, primaryAssetId: 'a1' },
        },
      },
    } as DocumentRecord;
    expect(readDerivation({ d1: record })).toEqual({
      parentVideoId: 'parent',
      parentRevision: 'v3',
      range: { start: 12.5, end: 48 },
      primaryAssetId: 'a1',
      hook: null,
      reason: null,
      notes: [],
      shots: 0,
    });
    expect(readDerivation({})).toBeNull();
    expect(readDerivation(null)).toBeNull();
  });

  it('reads the optional hook, reason and notes; blanks and non-strings are dropped', () => {
    const summary = {
      schema: 'cuccut.derivation/1',
      parentVideoId: 'parent',
      parentRevision: 'v3',
      range: { start: 1, end: 2 },
      primaryAssetId: null,
      hook: ' So here is the thing. ',
      reason: 'Self-contained',
      notes: ['Opens on a reaction shot', '', 3],
    };
    const record = {
      id: 'd1',
      kind: 'derivation',
      name: 'Derivation',
      currentRevision: 'r1',
      revisions: { r1: { revision: 'r1', contentHash: '', byteLength: 0, createdAt: '', createdBy: 't', summary } },
    } as DocumentRecord;
    expect(readDerivation({ d1: record })).toMatchObject({ hook: 'So here is the thing.', reason: 'Self-contained', notes: ['Opens on a reaction shot'] });
  });
});

describe('framingShots', () => {
  const derivation = (extra: Record<string, unknown>) =>
    readDerivation({
      d1: {
        id: 'd1',
        kind: 'derivation',
        name: 'Derivation',
        currentRevision: 'r1',
        revisions: {
          r1: {
            revision: 'r1',
            contentHash: '',
            byteLength: 0,
            createdAt: '',
            createdBy: 't',
            summary: { schema: 'cuccut.derivation/1', parentVideoId: 'parent', range: { start: 0, end: 30 }, primaryAssetId: 'a1', ...extra },
          },
        },
      } as DocumentRecord,
    });
  const crop = { left: 0.2, top: 0, right: 0.4, bottom: 0 };

  it('counts shots from settings.crops, falling back to framing.shots', () => {
    const crops = [{ from: 0, to: 10, ...crop }, { from: 10, to: 20, ...crop }, { from: 20, to: 30, ...crop }];
    // 剪口把一个镜头拆成了两段：framing.shots 比镜头多，按 settings.crops 数。
    const shots = [...crops, { from: 31, to: 32, ...crop }].map(({ from, to }) => ({ from, to, crop }));
    expect(derivation({ settings: { crops }, framing: { assetId: 'a1', shots } })?.shots).toBe(3);
    expect(derivation({ framing: { assetId: 'a1', shots: shots.slice(0, 2) } })?.shots).toBe(2);
    expect(derivation({ settings: { crop } })?.shots).toBe(0);
  });

  it('the result card shows the framing line only when there is more than one shot', () => {
    expect(framingShots({ shots: 3 })).toBe(3);
    expect(framingShots({ shots: 1 })).toBeNull();
    expect(framingShots({ shots: 0 })).toBeNull();
    expect(framingShots(null)).toBeNull();
    expect(SHORTS_COPY.framingShots(3)).toBe('按 3 个镜头分别取景 · 打开后在画布上拖某一段改');
  });
});

describe('pagerIndex', () => {
  it('follows the open child, then the remembered one, then the first', () => {
    expect(pagerIndex(['a', 'b', 'c'], 'b', 'c')).toBe(1);
    expect(pagerIndex(['a', 'b', 'c'], 'parent', 'c')).toBe(2);
    expect(pagerIndex(['a', 'b', 'c'], 'parent', null)).toBe(0);
    expect(pagerIndex([], 'a', null)).toBe(-1);
  });
});

describe('madeShorts', () => {
  it('lists the parent’s live children newest first, once per video, ties by name', () => {
    const entries = [
      video('parent'),
      child('old', '2026-10-10T09:00:00.000Z'),
      child('newest', '2026-10-10T12:00:00.000Z'),
      child('b-tie', '2026-10-10T11:00:00.000Z'),
      child('a-tie', '2026-10-10T11:00:00.000Z'),
      child('trashed', '2026-10-10T13:00:00.000Z', { user: { favorite: false, displayName: null, trashedAt: '2026-10-10T13:30:00.000Z' } }),
      child('dupe', '2026-10-10T10:00:00.000Z', { id: 'e-dupe-2', ref: { videoId: 'old' } }),
      video('other', { createdAt: '2026-10-10T14:00:00.000Z', origin: { source: 'derived', videoId: 'elsewhere' } }),
    ];
    expect(madeShorts(entries, 'parent').map((e) => e.name)).toEqual(['newest', 'a-tie', 'b-tie', 'old']);
    expect(madeShorts(entries, 'nobody')).toEqual([]);
    expect(MADE_SHOWN).toBe(6);
  });
});
