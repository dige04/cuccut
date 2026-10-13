import { describe, expect, it } from 'vitest';
import type { SpaceEntry, SpaceSearchHit } from '@cuccut/protocol';
import {
  ANY_HIT,
  collectSpeakers,
  exactSpeaker,
  groupHits,
  hitChip,
  hitTarget,
  hitWhere,
  planGroupRows,
  SEARCH_LIMIT,
  searchNote,
  searchRequest,
  seekSeconds,
  snippetParts,
  speakerOptions,
} from './space-search.ts';

const video = (id: string, videoId: string, patch: Partial<SpaceEntry> = {}): SpaceEntry => ({
  id,
  kind: 'video',
  name: id,
  fileName: id,
  source: { projectId: 'p1', conversationId: null },
  relPath: `${id}`,
  size: 0,
  lastActivityAt: '2026-10-01T00:00:00.000Z',
  status: null,
  ref: { videoId },
  user: { favorite: false, displayName: null, trashedAt: null },
  ...patch,
});

describe('matched fragments', () => {
  it('splits by position; out-of-range and overlapping ranges are merged', () => {
    expect(snippetParts('今天讲剪辑和字幕', [[2, 4]])).toEqual([
      { text: '今天', hit: false },
      { text: '讲剪', hit: true },
      { text: '辑和字幕', hit: false },
    ]);
    expect(snippetParts('abcdef', [[3, 9], [0, 2], [1, 3]])).toEqual([{ text: 'abcdef', hit: true }]);
    expect(snippetParts('abc', [])).toEqual([{ text: 'abc', hit: false }]);
  });
});

describe('opening a match', () => {
  it('prefers the entry; cannot open when the entry is in the trash; can jump directly only when there is sequence time', () => {
    const entries = [video('v1', 'vid1'), video('v2', 'vid2', { user: { favorite: false, displayName: null, trashedAt: '2026-10-01T00:00:00.000Z' } })];
    expect(hitTarget({ entryId: 'v1', videoId: 'vid1' }, entries)).toEqual({ projectId: 'p1', path: 'v1' });
    expect(hitTarget({ entryId: null, videoId: 'vid1' }, entries)).toEqual({ projectId: 'p1', path: 'v1' });
    expect(hitTarget({ entryId: 'v2', videoId: 'vid2' }, entries)).toBeNull();
    expect(hitTarget({ entryId: null, videoId: 'gone' }, entries)).toBeNull();
    expect(seekSeconds({ time: { clock: 'sequence', start: 12.5, end: 13 } })).toBe(12.5);
    expect(seekSeconds({ time: { clock: 'source', start: 12.5, end: 13 } })).toBeNull();
  });

  it('explains when results are incomplete', () => {
    expect(searchNote({ complete: true, pendingVideos: 0, truncated: false, hits: [] })).toBeNull();
    expect(searchNote({ complete: false, pendingVideos: 2, truncated: true, hits: new Array(50) })).toBe(
      '还有 2 个视频的内容索引没有更新完，结果可能缺视频或是旧版本的；命中太多，只列出前 50 条。',
    );
  });
});

const hit = (videoId: string, start: number, patch: Partial<SpaceSearchHit> = {}): SpaceSearchHit => ({
  videoId,
  videoName: `视频 ${videoId}`,
  entryId: null,
  projectId: null,
  documentId: 'd1',
  documentKind: 'speech',
  language: 'zh',
  time: { clock: 'sequence', start, end: start + 1 },
  snippet: '剪辑',
  highlights: [[0, 2]],
  speaker: null,
  indexedRevision: 'r1',
  ...patch,
});

describe('filtering and grouping', () => {
  it('request: all kinds omit kinds, no speaker limit omits speaker; the project is unchanged', () => {
    expect(searchRequest('剪辑', null, ANY_HIT)).toEqual({ query: '剪辑', limit: SEARCH_LIMIT });
    expect(searchRequest('剪辑', 'none', { kind: 'translation', speaker: '宝玉' })).toEqual({
      query: '剪辑',
      limit: SEARCH_LIMIT,
      projectId: null,
      kinds: ['translation'],
      speaker: '宝玉',
    });
    expect(searchRequest('剪辑', 'p1', { kind: 'all', speaker: '' })).toEqual({ query: '剪辑', limit: SEARCH_LIMIT, projectId: 'p1' });
  });

  it('speaker matches the whole name string (the Runtime uses \'contains\'); options merge with the speakers already seen and include the selected ones', () => {
    const hits = [hit('a', 1, { speaker: '宝玉' }), hit('a', 2, { speaker: '宝玉的嘉宾' }), hit('b', 3)];
    expect(exactSpeaker(hits, '宝玉').map((h) => h.time.start)).toEqual([1]);
    expect(exactSpeaker(hits, null)).toHaveLength(3);
    const seen = collectSpeakers([], hits);
    expect(seen).toEqual(['宝玉', '宝玉的嘉宾']);
    expect(collectSpeakers(seen, [hit('c', 1, { speaker: '宝玉' })])).toEqual(seen);
    expect(speakerOptions(['b', 'a'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('grouping by video: groups in order of first appearance, items within a group keep their original order', () => {
    const groups = groupHits([hit('a', 1), hit('b', 5), hit('a', 3)]);
    expect(groups.map((g) => [g.videoId, g.videoName, g.hits.map((h) => h.time.start)])).toEqual([
      ['a', '视频 a', [1, 3]],
      ['b', '视频 b', [5]],
    ]);
    expect(groupHits([])).toEqual([]);
  });

  it('each group first shows ten rows; each \'show more\' adds ten more (design planRows)', () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    expect(planGroupRows(rows)).toMatchObject({ rest: 13, more: 10, next: 20 });
    expect(planGroupRows(rows).rows).toHaveLength(10);
    expect(planGroupRows(rows, 20)).toMatchObject({ rest: 3, more: 3, next: 30 });
    expect(planGroupRows(rows, 30)).toMatchObject({ rest: 0, more: 0 });
    expect(planGroupRows(rows, 30).rows).toHaveLength(23);
  });

  it('hit row: the label is the kind (translations include the language), the position is time · speaker', () => {
    expect(hitChip({ documentKind: 'translation', language: 'en' })).toBe('译文 · en');
    expect(hitChip({ documentKind: 'chapter', language: null })).toBe('章节');
    expect(hitWhere({ time: { clock: 'sequence', start: 65, end: 70 }, speaker: '宝玉' })).toBe('1:05 · 宝玉');
    expect(hitWhere({ time: { clock: 'source', start: 3, end: 4 }, speaker: null })).toBe('素材时间 0:03');
  });
});
