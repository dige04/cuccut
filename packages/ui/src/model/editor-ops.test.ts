import { describe, expect, it } from 'vitest';
import type { AssetRecord, AudioItem, CaptionItem, CompositionItem, DocumentRecord, Sequence, Track, VideoItem } from '@cuccut/protocol';
import {
  assetFilePath,
  assetUsages,
  audioAside,
  deletableItemIds,
  dubGroupCard,
  dubGroupIds,
  dubPlanRecord,
  importAndPlace,
  isPlaceable,
  itemsAtFrame,
  libraryAssets,
  moveOperation,
  nudgeDelta,
  placeAsset,
  splitOperations,
  trimBounds,
  trimOperation,
  usageCount,
} from './editor-ops.ts';

const fps = { num: 30, den: 1 };

function track(id: string, order: number, kind: Track['kind'], locked = false): Track {
  return { id, order, kind, locked, visible: true, muted: false, solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' } };
}

function video(id: string, trackId: string, fromFrame: number, durationFrames: number): VideoItem {
  return {
    id,
    trackId,
    type: 'video',
    enabled: true,
    locked: false,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'asset_v', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 30 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

function sequence(tracks: Track[], items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps,
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks,
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  };
}

const clip: AssetRecord & { kind: 'video' } = {
  id: 'asset_v',
  kind: 'video',
  name: 'clip',
  currentRevision: '1',
  revisions: {
    '1': {
      revision: '1',
      contentHash: 'h',
      byteLength: 1,
      mediaType: 'video/mp4',
      storage: { mode: 'managed' },
      duration: { ticks: '2', timescale: 1 },
      provenance: { origin: 'import' },
    },
  },
};

describe('edit operations', () => {
  it('add to timeline: a video clip goes on the empty track above the topmost one at the playhead, creating one if none; when a track is specified and occupied, it is appended to the end', () => {
    const tracks = [track('v1', 0, 'visual'), track('a1', 1, 'audio'), track('v2', 2, 'visual')];
    const empty = sequence(tracks, []);
    expect(placeAsset(empty, clip, 15)).toMatchObject([{ type: 'addItem', trackId: 'v1', at: { unit: 'frames', value: 15 } }]);

    const busy = sequence(tracks, [video('x', 'v1', 0, 90)]);
    expect(placeAsset(busy, clip, 15)).toMatchObject([{ trackId: 'v2', at: { value: 15 } }]);

    // Above is empty at the playhead and below is occupied: put it above. Above is occupied and below is empty: below would be covered, so create a new one.
    const full = sequence(tracks, [video('x', 'v1', 0, 90), video('y', 'v2', 30, 30)]);
    const overlay = placeAsset(full, clip, 15);
    expect(overlay.map((op) => op.type)).toEqual(['addTrack', 'insertItems']);
    expect(overlay[0]).toMatchObject({ kind: 'visual', ref: 'place-track' });
    expect(overlay[1]).toMatchObject({
      items: [
        {
          type: 'video',
          trackRef: 'place-track',
          name: 'clip',
          span: { fromFrame: 15, durationFrames: 60 },
          place: {},
          mode: 'fullscreen',
          assetRef: { id: 'asset_v', revision: '1' },
          fit: 'contain',
          embeddedAudio: { enabled: true, volume: 1 },
        },
      ],
    });
    const topBusy = sequence(tracks, [video('y', 'v2', 0, 90)]);
    expect(placeAsset(topBusy, clip, 15).map((op) => op.type)).toEqual(['addTrack', 'insertItems']);

    const image = { ...clip, id: 'asset_i', kind: 'image' as const, name: 'sticker' };
    const still = placeAsset(full, image, 15);
    expect(still[1]).toMatchObject({ items: [{ type: 'image', span: { fromFrame: 15, durationFrames: 150 } }] });
    expect(still[1]).not.toHaveProperty('items.0.timeMap');

    const dropped = placeAsset(full, clip, 15, 'v1');
    expect(dropped).toMatchObject([{ trackId: 'v1' }]);
    expect(dropped[0]).not.toHaveProperty('at');

    const locked = sequence([track('v1', 0, 'visual', true), track('v2', 2, 'visual')], []);
    expect(placeAsset(locked, clip, 0)).toMatchObject([{ trackId: 'v2' }]);
  });

  it('dragged-in files: import and placement in one transaction, the first placed at the drop point', () => {
    const seq = sequence([track('v1', 0, 'visual'), track('a1', 1, 'audio')], []);
    const ops = importAndPlace(
      seq,
      [
        { path: '/a.mp4', kind: 'video' },
        { path: '/b.wav', kind: 'audio' },
        { path: '/c.txt', kind: null },
      ],
      45,
      'v1',
    );
    expect(ops.map((op) => op.type)).toEqual(['importAsset', 'addItem', 'importAsset', 'addItem', 'importAsset']);
    expect(ops[1]).toMatchObject({ asset: { ref: 'drop0' }, trackId: 'v1', at: { value: 45 } });
    // Audio cannot go onto a visual track: leave it to the engine to pick an audio track, appended at the end.
    expect(ops[3]).toEqual({ type: 'addItem', sequenceId: 'seq', asset: { ref: 'drop1' }, alignment: 'exact-frame' });
    expect(ops[0]).toEqual({ type: 'importAsset', path: '/a.mp4', ref: 'drop0' });
  });

  it('passes along the media name and source when the importer knows them', () => {
    const seq = sequence([track('v1', 0, 'visual')], []);
    const provenance = { origin: 'link-import', source: { url: 'https://example.com/v' } };
    const [op] = importAndPlace(seq, [{ path: '/d/访谈.mp4', kind: 'video', name: '访谈', provenance }], 0);
    expect(op).toEqual({ type: 'importAsset', path: '/d/访谈.mp4', ref: 'drop0', name: '访谈', provenance });
  });

  it('drag: a single clip can change tracks; multiple clips shift together', () => {
    const seq = sequence([track('v1', 0, 'visual'), track('v2', 2, 'visual')], [video('a', 'v1', 0, 30), video('b', 'v1', 60, 30)]);
    expect(moveOperation(seq, { itemId: 'a', itemIds: ['a'], deltaFrames: 0, trackId: 'v1' })).toBeNull();
    expect(moveOperation(seq, { itemId: 'a', itemIds: ['a'], deltaFrames: 10, trackId: 'v2' })).toMatchObject({
      type: 'moveItem',
      at: { value: 10 },
      trackId: 'v2',
    });
    expect(moveOperation(seq, { itemId: 'a', itemIds: ['a', 'b'], deltaFrames: -5, trackId: 'v2' })).toMatchObject({
      type: 'moveItems',
      moves: [
        { itemId: 'a', at: { value: 0 } },
        { itemId: 'b', at: { value: 55 } },
      ],
    });
  });

  it('trim keeps at least one frame; no commit when unchanged', () => {
    const seq = sequence([track('v1', 0, 'visual')], [video('a', 'v1', 30, 30)]);
    const item = seq.items[0]!;
    expect(trimOperation(seq, item, 'start', 60)).toBeNull();
    expect(trimOperation(seq, item, 'start', 30)).toBeNull();
    expect(trimOperation(seq, item, 'start', 40)).toMatchObject({ edge: 'start', at: { value: 40 } });
    expect(trimOperation(seq, item, 'end', 30)).toBeNull();
    expect(trimOperation(seq, item, 'end', 50)).toMatchObject({ edge: 'end', at: { value: 50 } });
  });

  it('subtitle and composition instances use the same move, trim and split; code-package media cannot be placed directly on the timeline', () => {
    const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };
    const caption: CaptionItem = {
      ...base,
      id: 'c',
      trackId: 's1',
      type: 'caption',
      span: { fromFrame: 30, durationFrames: 60 },
      documentId: 'doc',
    };
    const composition: CompositionItem = {
      ...base,
      id: 'k',
      trackId: 'v1',
      type: 'composition',
      span: { fromFrame: 30, durationFrames: 30 },
      place: {},
      source: { kind: 'bundle', assetRef: { id: 'asset_b', revision: '1' } },
      parameterValues: {},
      timeMap: { kind: 'linear', sourceIn: { ticks: '15', timescale: 30 }, rate: { num: 1, den: 1 } },
    };
    const bundle: AssetRecord = { ...clip, id: 'asset_b', kind: 'bundle', name: '片头' };
    const assets = { asset_v: clip, asset_b: bundle };
    const seq = sequence([track('v1', 0, 'visual'), track('s1', 1, 'subtitle')], [composition, caption]);

    expect(moveOperation(seq, { itemId: 'c', itemIds: ['c'], deltaFrames: 15, trackId: null })).toMatchObject({
      type: 'moveItem',
      at: { value: 45 },
    });
    expect(trimOperation(seq, caption, 'end', 120)).toMatchObject({ edge: 'end', at: { value: 120 } });
    expect(splitOperations(seq, [], 45).map((op) => 'itemId' in op && op.itemId)).toEqual(['k', 'c']);

    // Subtitles have no source time, so neither end is limited.
    expect(trimBounds(caption, assets, seq)).toEqual({ min: 0, max: Number.POSITIVE_INFINITY });
    // The composition's start cannot be earlier than source time 0 (in point 0.5 s → at most 15 frames earlier). A code package has no duration, so the end is not limited.
    expect(trimBounds(composition, assets, seq)).toEqual({ min: 15, max: Number.POSITIVE_INFINITY });
    // With a pre-rendered stand-in, the end is limited by the stand-in's length (a 2 s stand-in, in point 0.5 s → 45 frames can still play).
    const prerendered = { ...composition, prerender: { id: 'asset_v', revision: '1' } };
    expect(trimBounds(prerendered, assets, seq)).toEqual({ min: 15, max: 75 });

    expect(usageCount(seq, 'asset_b')).toBe(1);
    expect(usageCount(sequence(seq.tracks, [prerendered]), 'asset_v')).toBe(1);
    expect(usageCount(seq, 'asset_v')).toBe(0);
    expect(isPlaceable(bundle)).toBe(false);
  });

  it('media library paginates by category, each page sorted by name', () => {
    const asset = (id: string, kind: AssetRecord['kind'], name: string) =>
      ({ id, kind, name, currentRevision: '1', revisions: {} }) as AssetRecord;
    const assets = {
      v2: asset('v2', 'video', '乙.mp4'),
      a1: asset('a1', 'audio', '配乐.m4a'),
      v1: asset('v1', 'video', '甲.mp4'),
      b1: asset('b1', 'bundle', '片头'),
    };
    expect(libraryAssets(assets, 'video').map((a) => a.id)).toEqual(['v1', 'v2']);
    expect(libraryAssets(assets, 'audio').map((a) => a.id)).toEqual(['a1']);
    expect(libraryAssets(assets, 'image')).toEqual([]);
  });

  it('split: selected clips first; with no selection, split all unlocked clips that cross the playhead', () => {
    const seq = sequence(
      [track('v1', 0, 'visual'), track('v2', 2, 'visual', true)],
      [video('a', 'v1', 0, 60), video('b', 'v2', 0, 60), video('c', 'v1', 60, 30)],
    );
    expect(splitOperations(seq, [], 30).map((op) => 'itemId' in op && op.itemId)).toEqual(['a']);
    expect(splitOperations(seq, ['c'], 30)).toEqual([]);
    expect(splitOperations(seq, [], 60)).toEqual([]);
  });
});

describe('delete selection (Delete key, transport, inspector and context menu)', () => {
  it('deletes clips in the selection that are still on the timeline; locked ones are still passed to the engine to decide; stale IDs in the selection are ignored', () => {
    const seq = sequence([track('v1', 0, 'visual'), track('v2', 1, 'visual', true)], [video('a', 'v1', 0, 30), video('b', 'v2', 0, 30)]);
    expect(deletableItemIds(seq, [])).toEqual([]);
    expect(deletableItemIds(seq, ['gone'])).toEqual([]);
    expect(deletableItemIds(seq, ['b', 'gone', 'a'])).toEqual(['a', 'b']);
  });
});

describe('clips under the playhead (⌘A)', () => {
  it('time ranges covering the playhead frame (the end frame excluded)', () => {
    const seq = sequence([track('v1', 0, 'visual'), track('v2', 1, 'visual')], [video('a', 'v1', 0, 30), video('b', 'v2', 20, 30)]);
    expect(itemsAtFrame(seq, 25)).toEqual(['a', 'b']);
    expect(itemsAtFrame(seq, 30)).toEqual(['b']);
    expect(itemsAtFrame(seq, 50)).toEqual([]);
  });
});

describe('nudge time (⌥←/→)', () => {
  const seq = sequence(
    [track('v1', 0, 'visual'), track('v2', 1, 'visual', true)],
    [video('a', 'v1', 10, 20), video('b', 'v1', 40, 20), video('c', 'v2', 0, 20)],
  );
  it('cumulative offset: does not go past 0, and does not collide with unselected clips on the same track', () => {
    expect(nudgeDelta(seq, ['a'], 0, 5)).toBe(5);
    expect(nudgeDelta(seq, ['a'], 5, 5)).toBe(10);
    expect(nudgeDelta(seq, ['a'], 10, 1)).toBe(10);
    expect(nudgeDelta(seq, ['a'], 0, -10)).toBe(-10);
    expect(nudgeDelta(seq, ['a'], -10, -1)).toBe(-10);
  });
  it('clips selected together do not block each other; locked clips do not move', () => {
    expect(nudgeDelta(seq, ['a', 'b'], 0, 30)).toBe(30);
    expect(nudgeDelta(seq, ['c'], 0, 5)).toBe(0);
  });
});

describe('media menu: where used, show in folder', () => {
  it('sorted by start, with the track name from the timeline row header', () => {
    const seq = sequence(
      [track('v1', 0, 'visual'), { ...track('v2', 1, 'visual'), name: 'B-roll' }],
      [{ ...video('b', 'v2', 60, 30), name: '桌面' }, video('a', 'v1', 0, 30), { ...video('c', 'v1', 90, 15), assetRef: { id: 'other', revision: '1' } }],
    );
    expect(assetUsages(seq, 'asset_v')).toEqual([
      { itemId: 'a', track: '画面 1', name: '', start: 0, end: 1 },
      { itemId: 'b', track: '画面 · B-roll', name: '桌面', start: 2, end: 3 },
    ]);
    expect(assetUsages(null, 'asset_v')).toEqual([]);
  });

  it('linked media gives the original file (a relative path is appended after the video directory); media collected into the video directory has no separate location', () => {
    const linked = (path: string): AssetRecord => ({
      ...clip,
      revisions: { '1': { ...clip.revisions['1']!, storage: { mode: 'linked', locator: { path }, frozen: false } } },
    });
    expect(assetFilePath(linked('/Users/me/a.mp4'), '/v/demo')).toBe('/Users/me/a.mp4');
    expect(assetFilePath(linked('media/a.mp4'), '/v/demo/')).toBe('/v/demo/media/a.mp4');
    expect(assetFilePath(linked('media\\a.mp4'), 'C:\\v\\demo')).toBe('C:\\v\\demo\\media\\a.mp4');
    // For a link outside the video directory, fold `..` away and do not go past the root.
    expect(assetFilePath(linked('../downloads/a b.webm'), '/p/proj/demo')).toBe('/p/proj/downloads/a b.webm');
    expect(assetFilePath(linked('..\\downloads\\a.webm'), 'C:\\p\\demo')).toBe('C:\\p\\downloads\\a.webm');
    expect(assetFilePath(linked('../../../a.mp4'), '/v/demo')).toBe('/a.mp4');
    expect(assetFilePath(linked('../../x/a.mp4'), '\\\\nas\\share\\demo')).toBe('\\\\nas\\share\\x\\a.mp4');
    expect(assetFilePath(linked('media/a.mp4'), null)).toBeNull();
    expect(assetFilePath(clip, '/v/demo')).toBeNull();
  });
});

describe('dub groups on the audio page', () => {
  const dubAsset = (id: string, name: string, extra: Record<string, unknown>, seconds = 2): AssetRecord => ({
    id,
    kind: 'audio',
    name,
    currentRevision: '1',
    revisions: {
      '1': {
        revision: '1',
        contentHash: id,
        byteLength: 1,
        mediaType: 'audio/wav',
        storage: { mode: 'managed' },
        duration: { ticks: String(seconds), timescale: 1 },
        provenance: { origin: 'generated', source: { pipeline: 'dub', jobId: 'job_7', ...extra } },
      },
    },
  });
  const voice = (id: string, trackId: string, assetId: string, fromFrame: number, mark: Record<string, unknown> | null, muted = false): AudioItem => ({
    id,
    trackId,
    type: 'audio',
    enabled: true,
    locked: false,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    assetRef: { id: assetId, revision: '1' },
    fromFrame,
    subframeOffset: { ticks: '0', timescale: 1 },
    playDuration: { ticks: '3', timescale: 2 },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } },
    mix: { volume: 1, ...(muted ? { muted: true } : {}) },
    ...(mark ? { role: 'dub', extensions: { 'cuccut.dub': mark } } : {}),
  });
  const assets: Record<string, AssetRecord> = {
    s1: dubAsset('s1', '配音（en）第 1 句', { language: 'en', unitId: 'u1' }),
    s2: dubAsset('s2', '配音（en）第 2 句', { language: 'en', unitId: 'u2' }),
    bg: dubAsset('bg', '背景（分离）', { capability: 'separateAudio', stem: 'background' }, 60),
    song: { ...clip, id: 'song', kind: 'audio', name: 'song.mp3' },
  };
  const seq = sequence(
    [track('a1', 0, 'audio'), track('a2', 1, 'audio'), track('a3', 2, 'audio')],
    [
      voice('d2', 'a1', 's2', 90, { groupId: 'dub_7', language: 'en', unitId: 'u2' }, true),
      voice('d1', 'a1', 's1', 30, { groupId: 'dub_7', language: 'en', unitId: 'u1' }),
      voice('b1', 'a2', 'bg', 0, { groupId: 'dub_7', stem: 'background' }),
      voice('m', 'a3', 'song', 0, null),
    ],
  );
  const plan = {
    units: [
      { id: 'd-u1', status: 'ready', script: { text: 'Hello there.' }, extensions: { 'cuccut.dub': { translationUnitId: 'u1' } } },
      { id: 'd-u2', status: 'ready', script: { text: 'Second line.' }, extensions: { 'cuccut.dub': { translationUnitId: 'u2' } } },
      { id: 'd-u3', status: 'failed', script: { text: 'Lost one.' }, extensions: { 'cuccut.dub': { translationUnitId: 'u3' } } },
      { id: 'd-u4', status: 'stale', script: null, extensions: { 'cuccut.dub': { translationUnitId: 'u4' } } },
    ],
    extensions: { 'cuccut.dub': { voice: { providerId: 'local', modelId: 'Qwen3-TTS', voice: 'v' }, mutedItemIds: ['orig'] } },
  };

  it('dub instances on the timeline and media generated by dub flows are grouped together; other audio is listed flat', () => {
    const { groups, loose } = dubGroupIds(seq, Object.values(assets));
    expect(groups).toEqual(['dub_7']);
    expect(loose.map((a) => a.id)).toEqual(['song']);
  });

  it('group card: one row for background, one row per sentence (sorted by time, with translation); unsynthesized and stale sentences are also listed; subtitle as in the design file', () => {
    const card = dubGroupCard(seq, assets, 'dub_7', plan);
    expect(card).toMatchObject({ groupId: 'dub_7', language: 'en', badge: 'EN', title: '配音 · English', state: 'on', trackId: 'a1', regen: 1 });
    expect([...card.itemIds].sort()).toEqual(['b1', 'd1', 'd2']);
    expect(card.files.map((f) => [f.kind, f.itemId, f.name, f.text, f.status, f.muted, f.seconds])).toEqual([
      ['bed', 'b1', '背景（分离）', '分离出来的背景声', null, false, 60],
      ['sentence', 'd1', '第 1 句', 'Hello there.', null, false, 1.5],
      ['sentence', 'd2', '第 2 句', 'Second line.', null, true, 1.5],
      ['sentence', null, '第 3 句', 'Lost one.', 'failed', false, null],
      ['sentence', null, '第 4 句', '', 'stale', false, null],
    ]);
    expect(card.line).toBe('3 个文件 · 4 句 · 1 句没合成 · 1 句译文过期 · 1 句静音 · Qwen3-TTS');
  });

  it('when the plan has not been fetched, list by instance; track mute shows \'track off\', and when all instances are deleted it shows \'not on timeline\'', () => {
    const early = dubGroupCard(seq, assets, 'dub_7', undefined);
    expect(early.line).toBe('3 个文件 · 2 句 · 1 句静音');
    expect(early.files.filter((f) => f.kind === 'sentence').map((f) => f.name)).toEqual(['配音（en）第 1 句', '配音（en）第 2 句']);
    const off = dubGroupCard({ ...seq, tracks: seq.tracks.map((t) => (t.id === 'a1' ? { ...t, muted: true } : t)) }, assets, 'dub_7', plan);
    expect(off.state).toBe('off');
    const gone = dubGroupCard({ ...seq, items: seq.items.filter((i) => i.id === 'm') }, assets, 'dub_7', plan);
    expect(gone).toMatchObject({ state: 'gone', trackId: null, itemIds: [], language: 'en' });
    expect(gone.files[0]).toMatchObject({ kind: 'bed', itemId: null, seconds: 60 });
  });

  it('dub plan is found by groupId in the summary; section header side note as in the design file', () => {
    const record = (id: string, kind: string, groupId: string): DocumentRecord => ({
      id,
      kind,
      name: id,
      currentRevision: 'r',
      revisions: { r: { revision: 'r', contentHash: '', byteLength: 0, createdAt: '', createdBy: 't', summary: { groupId } } },
    });
    const documents = { a: record('a', 'translation', 'dub_7'), b: record('b', 'dubbing-plan', 'dub_8'), c: record('c', 'dubbing-plan', 'dub_7') };
    expect(dubPlanRecord(documents, 'dub_7')?.id).toBe('c');
    expect(dubPlanRecord(documents, 'dub_9')).toBeUndefined();
    expect(audioAside(2, 65)).toBe('2 组配音 · 65 个文件');
    expect(audioAside(0, 2)).toBe('2 个文件');
  });
});
