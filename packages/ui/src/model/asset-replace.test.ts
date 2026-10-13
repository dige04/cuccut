import { describe, expect, it } from 'vitest';
import type { AssetRecord, AudioItem, CaptionItem, EditOperation, Sequence, SequenceItem, Track, VideoItem } from '@cuccut/protocol';
import { describeReplace, planAssetReplace, REPLACE_IMPORT_REF, replaceSideEffects, type AssetReplacePlan } from './asset-replace.ts';

// Cases follow the design spec model-video-replace.test.js: the main track is split into three segments a / b / c, and one B-roll segment sits on another track. Frame rate 30.
const fps = { num: 30, den: 1 };
const f = (seconds: number) => Math.round(seconds * 30);

function track(id: string, kind: Track['kind'], locked = false): Track {
  return { id, order: 1, kind, locked, visible: true, muted: false, solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' } };
}

function clip(id: string, trackId: string, assetId: string, start: number, end: number, srcStart = 0, rate = 1): VideoItem {
  return {
    id,
    trackId,
    type: 'video',
    name: `${id}.mp4`,
    enabled: true,
    locked: false,
    paintOrder: 3,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame: f(start), durationFrames: f(end) - f(start) },
    place: { x: 45, y: 10, w: 50, opacity: 0.8 },
    mode: 'pip',
    assetRef: { id: assetId, revision: 'r1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(f(srcStart)), timescale: 30 }, rate: { num: rate, den: 1 } },
    fit: 'cover',
    crop: { left: 0.1, top: 0, right: 0, bottom: 0 },
    embeddedAudio: { enabled: false, volume: 0.7 },
    role: 'b-roll',
    extensions: { 'x.test': { keep: true } },
  };
}

function asset(id: string, kind: AssetRecord['kind'], seconds: number | null, name = `${id}.mp4`): AssetRecord {
  return {
    id,
    kind,
    name,
    currentRevision: 'r1',
    revisions: {
      r1: {
        revision: 'r1',
        contentHash: id,
        byteLength: 1,
        mediaType: 'video/mp4',
        storage: { mode: 'managed' },
        ...(seconds === null ? {} : { duration: { ticks: String(Math.round(seconds * 1000)), timescale: 1000 } }),
        provenance: { origin: 'imported' },
      },
    } as AssetRecord['revisions'],
  };
}

function sequence(items: SequenceItem[], tracks: Track[] = [track('v1', 'visual'), track('v2', 'visual')]): Sequence {
  return {
    id: 'seq',
    revision: 'r',
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

const lane = () => [
  clip('a', 'v1', 'first', 0, 28),
  clip('b', 'v1', 'main', 28, 45.2, 28),
  clip('c', 'v1', 'last', 45.2, 78, 45.2),
  clip('broll', 'v2', 'desk', 5, 15),
];

const ok = (plan: AssetReplacePlan) => {
  if (!plan.ok) throw new Error(plan.reason);
  return plan;
};
const op = <T extends EditOperation['type']>(plan: AssetReplacePlan, type: T) =>
  ok(plan).operations.find((o): o is Extract<EditOperation, { type: T }> => o.type === type);

describe('planAssetReplace', () => {
  it('new media starts at 0 seconds; if long enough, the clip length stays the same, placement, cropping and styling are copied over (design \'direct replace\')', () => {
    const seq = sequence([clip('v', 'v1', 'old', 10, 20, 30, 2)]);
    const plan = ok(planAssetReplace({ sequence: seq, asset: asset('old', 'video', 100), source: { from: 'library', asset: asset('new', 'video', 24) } }));
    expect(plan.replaced).toEqual([expect.objectContaining({ itemId: 'v', start: 10, end: 20, newStart: 10, newEnd: 20, delta: 0, aligned: false })]);
    const insert = op(plan, 'insertItems')!;
    const written = insert.items[0] as unknown as Record<string, unknown>;
    expect(written).toMatchObject({
      type: 'video',
      trackId: 'v1',
      assetRef: { id: 'new', revision: 'r1' },
      span: { fromFrame: 300, durationFrames: 300 },
      timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 30 }, rate: { num: 2, den: 1 } },
      place: { x: 45, y: 10, w: 50, opacity: 0.8 },
      mode: 'pip',
      fit: 'cover',
      crop: { left: 0.1, top: 0, right: 0, bottom: 0 },
      embeddedAudio: { enabled: false, volume: 0.7 },
      paintOrder: 3,
      role: 'b-roll',
      extensions: { 'x.test': { keep: true } },
      name: 'v.mp4',
    });
    expect(written).not.toHaveProperty('id');
    expect(written).not.toHaveProperty('lineage');
    expect(describeReplace(plan)).toBe('新素材够长，片段长度不变，时间线不变。');
    // A longer new asset does not stretch the clip (a deviation at the asset-library layer; see the model notes).
    const longer = ok(planAssetReplace({ sequence: seq, asset: asset('old', 'video', 100), source: { from: 'library', asset: asset('new', 'video', 60) } }));
    expect(longer.replaced[0]!.delta).toBe(0);
  });

  it('new media not long enough: clip gets shorter (converted by speed), and when it is the only clip on the track, the track shrinks with it', () => {
    const seq = sequence([clip('v', 'v1', 'old', 10, 20, 30, 2)]);
    const plan = ok(planAssetReplace({ sequence: seq, asset: asset('old', 'video', 100), source: { from: 'library', asset: asset('new', 'video', 6) } }));
    // Design spec: dur 6, speed 2 → new length 3 s, end point 13, 7 s shorter.
    expect(plan.replaced[0]).toMatchObject({ newEnd: 13, delta: -7 });
    expect((op(plan, 'insertItems')!.items[0] as VideoItem).span).toEqual({ fromFrame: 300, durationFrames: 90 });
    expect(op(plan, 'moveItems')).toBeUndefined();
    expect(describeReplace(plan)).toBe('片段会变短 7.0 秒，这条轨道跟着变短。');
  });

  it('same-track ripple: shortening pulls later clips forward; other tracks do not move (design \'same-track ripple\')', () => {
    const seq = sequence(lane());
    const plan = ok(planAssetReplace({ sequence: seq, asset: asset('main', 'video', 206), source: { from: 'library', asset: asset('x', 'video', 7.2) } }));
    expect(plan.replaced[0]).toMatchObject({ itemId: 'b', start: 28, end: 45.2, newEnd: 35.2, delta: expect.closeTo(-10, 6) });
    expect(op(plan, 'moveItems')!.moves).toEqual([{ itemId: 'c', offset: { unit: 'frames', value: -300 } }]);
    expect(plan.moved).toBe(1);
    expect(describeReplace(plan)).toBe('片段会变短 10.0 秒，同轨后面 1 段往前挪。');
    // The B-roll has its own track: only it changes.
    const broll = ok(planAssetReplace({ sequence: seq, asset: asset('desk', 'video', 30), source: { from: 'library', asset: asset('x', 'video', 4) } }));
    expect(broll.moved).toBe(0);
    expect(broll.replaced[0]).toMatchObject({ itemId: 'broll', newEnd: 9 });
    expect(describeReplace(broll)).toBe('片段会变短 6.0 秒，这条轨道跟着变短。');
  });

  it('one media used in several clips: all replaced together, each segment starts at 0 seconds, and shortening earlier segments shifts later start points', () => {
    const seq = sequence([
      clip('a', 'v1', 'main', 0, 28),
      clip('b', 'v1', 'main', 28, 45.2, 28),
      clip('c', 'v1', 'main', 45.2, 78, 45.2),
      clip('d', 'v1', 'other', 80, 90),
    ]);
    const plan = ok(planAssetReplace({ sequence: seq, asset: asset('main', 'video', 206), source: { from: 'library', asset: asset('x', 'video', 20) } }));
    expect(plan.replaced.map((r) => [r.itemId, r.newStart, +r.newEnd.toFixed(3)])).toEqual([
      ['a', 0, 20],
      ['b', 20, 37.2],
      ['c', 37.2, 57.2],
    ]);
    expect(op(plan, 'deleteItems')!.itemIds).toEqual(['a', 'b', 'c']);
    // d moves forward by the 20.8 s that a and c are shorter in total.
    expect(op(plan, 'moveItems')!.moves).toEqual([{ itemId: 'd', offset: { unit: 'frames', value: -624 } }]);
    expect(describeReplace(plan)).toBe('2 段会变短，一共短 20.8 秒，同轨后面 1 段往前挪。');
    // Operation order: delete → move → write back (overlaps are checked after the whole transaction).
    expect(plan.operations.map((o) => o.type)).toEqual(['deleteItems', 'moveItems', 'insertItems']);
  });

  it('replace only one clip (itemId from the canvas toolbar): other clips using the same media are not replaced, and same-track clips after it still move along', () => {
    const seq = sequence([
      clip('a', 'v1', 'main', 0, 28),
      clip('b', 'v1', 'main', 28, 45.2, 28),
      clip('c', 'v1', 'main', 45.2, 78, 45.2),
      clip('d', 'v1', 'other', 80, 90),
    ]);
    const main = asset('main', 'video', 206);
    const plan = ok(planAssetReplace({ sequence: seq, asset: main, source: { from: 'library', asset: asset('x', 'video', 10) }, itemId: 'b' }));
    expect(plan.replaced.map((r) => [r.itemId, r.newStart, +r.newEnd.toFixed(3)])).toEqual([['b', 28, 38]]);
    expect(op(plan, 'deleteItems')!.itemIds).toEqual(['b']);
    // b goes from 17.2 s to 10 s: c (same asset, not replaced) and d both move forward by 7.2 s.
    expect(op(plan, 'moveItems')!.moves).toEqual([
      { itemId: 'c', offset: { unit: 'frames', value: -216 } },
      { itemId: 'd', offset: { unit: 'frames', value: -216 } },
    ]);
    const locked = sequence([{ ...clip('b', 'v1', 'main', 28, 45.2, 28), locked: true }]);
    const refused = planAssetReplace({ sequence: locked, asset: main, source: { from: 'library', asset: asset('x', 'video', 10) }, itemId: 'b' });
    expect(refused).toEqual({ ok: false, reason: '这一段锁着，先解锁再换。' });
  });

  it('align by original media time: if the originally used segment still fits, keep it; if not, use plain replace (design \'same-source cut\')', () => {
    const seq = sequence(lane());
    const covered = ok(
      planAssetReplace({ sequence: seq, asset: asset('main', 'video', 206), source: { from: 'library', asset: asset('x', 'video', 50) }, align: true }),
    );
    expect(covered.replaced[0]).toMatchObject({ aligned: true, delta: 0 });
    expect((op(covered, 'insertItems')!.items[0] as VideoItem).timeMap).toEqual({
      kind: 'linear',
      sourceIn: { ticks: String(f(28)), timescale: 30 },
      rate: { num: 1, den: 1 },
    });
    const partial = ok(
      planAssetReplace({ sequence: seq, asset: asset('last', 'video', 206), source: { from: 'library', asset: asset('x', 'video', 50) }, align: true }),
    );
    expect(partial.replaced[0]).toMatchObject({ itemId: 'c', aligned: false, delta: 0 });
    expect((op(partial, 'insertItems')!.items[0] as VideoItem).timeMap).toMatchObject({ sourceIn: { ticks: '0' } });
  });

  it('only real problems are rejected: different category, same media, not used, all locked, new media shorter than one frame', () => {
    const seq = sequence(lane());
    const base = { sequence: seq, asset: asset('main', 'video', 206) };
    expect(planAssetReplace({ ...base, source: { from: 'library', asset: asset('song', 'audio', 30) } })).toEqual({
      ok: false,
      reason: '只能换成同一类的素材：这里要一份视频。',
    });
    expect(planAssetReplace({ ...base, source: { from: 'library', asset: asset('main', 'video', 206) } }).ok).toBe(false);
    expect(planAssetReplace({ ...base, asset: asset('unused', 'video', 10), source: { from: 'library', asset: asset('x', 'video', 9) } })).toEqual({
      ok: false,
      reason: '时间线上没有用到这个素材，不用替换。',
    });
    expect(planAssetReplace({ ...base, source: { from: 'library', asset: asset('x', 'video', 0.01) } })).toEqual({
      ok: false,
      reason: '新素材太短，放不下一帧。',
    });
    const locked = sequence([{ ...clip('b', 'v1', 'main', 28, 45.2), locked: true }]);
    expect(planAssetReplace({ ...base, sequence: locked, source: { from: 'library', asset: asset('x', 'video', 9) } }).ok).toBe(false);
  });

  it('locked clips and locked tracks stay as they are; same-track ripple stops at a locked clip', () => {
    const items = [
      clip('a', 'v1', 'main', 0, 10),
      { ...clip('b', 'v1', 'other', 10, 20), locked: true },
      clip('c', 'v1', 'other', 20, 30),
      clip('d', 'v2', 'main', 0, 10),
    ];
    const plan = ok(
      planAssetReplace({
        sequence: sequence(items, [track('v1', 'visual'), track('v2', 'visual', true)]),
        asset: asset('main', 'video', 60),
        source: { from: 'library', asset: asset('x', 'video', 4) },
      }),
    );
    expect(plan.replaced.map((r) => r.itemId)).toEqual(['a']);
    expect(plan.kept).toEqual([{ itemId: 'd', name: 'd.mp4', start: 0, end: 10, reason: 'locked' }]);
    expect(op(plan, 'moveItems')).toBeUndefined();
  });

  it('local file: imported first within the same transaction, written-back instance references the imported ref; if duration is unknown, keep the original duration first (design \'keep\')', () => {
    const seq = sequence(lane());
    const plan = ok(
      planAssetReplace({
        sequence: seq,
        asset: asset('main', 'video', 206),
        source: { from: 'file', path: '/Users/me/new.mov', name: 'new.mov', kind: 'video' },
      }),
    );
    expect(plan.durationKnown).toBe(false);
    expect(plan.operations[0]).toEqual({ type: 'importAsset', path: '/Users/me/new.mov', ref: REPLACE_IMPORT_REF });
    const written = op(plan, 'insertItems')!.items[0] as unknown as Record<string, unknown>;
    expect(written.assetImportRef).toBe(REPLACE_IMPORT_REF);
    expect(written).not.toHaveProperty('assetRef');
    expect(written.span).toEqual({ fromFrame: f(28), durationFrames: f(45.2) - f(28) });
    expect(describeReplace(plan)).toBe('素材时长未知，先保留片段原时长。');
    expect(
      planAssetReplace({ sequence: seq, asset: asset('main', 'video', 206), source: { from: 'file', path: '/a.mp3', name: 'a.mp3', kind: 'audio' } }).ok,
    ).toBe(false);
  });

  it('if the clip name is still the old media name (the default name when placed), change it to the new media name; renamed clips keep their name', () => {
    const named = { ...clip('x', 'v1', 'old', 0, 10), name: 'old.mp4' };
    const renamed = { ...clip('y', 'v1', 'old', 10, 20), name: '开场' };
    const seq = sequence([named, renamed]);
    const fromLibrary = ok(
      planAssetReplace({ sequence: seq, asset: asset('old', 'video', 100), source: { from: 'library', asset: asset('new', 'video', 100) } }),
    );
    expect(op(fromLibrary, 'insertItems')!.items.map((item) => item.name)).toEqual(['new.mp4', '开场']);
    const fromFile = ok(
      planAssetReplace({
        sequence: seq,
        asset: asset('old', 'video', 100),
        source: { from: 'file', path: '/Users/me/new.mov', name: 'new.mov', kind: 'video' },
      }),
    );
    expect(op(fromFile, 'insertItems')!.items.map((item) => item.name)).toEqual(['new.mov', '开场']);
  });

  it('audio: shortening cuts whole frames, fade in/out fits the new length, envelope points beyond it are removed, same-track audio after it shifts by frames', () => {
    const voice = (id: string, assetId: string, fromFrame: number, samples: number): AudioItem => ({
      id,
      trackId: 'a1',
      type: 'audio',
      enabled: true,
      locked: false,
      paintOrder: 1,
      followPolicy: { kind: 'sequence-fixed' },
      assetRef: { id: assetId, revision: 'r1' },
      fromFrame,
      subframeOffset: { ticks: '0', timescale: 1 },
      playDuration: { ticks: String(samples), timescale: 48000 },
      timeMap: { kind: 'linear', sourceIn: { ticks: '24000', timescale: 48000 }, rate: { num: 1, den: 1 } },
      mix: {
        volume: 0.5,
        fadeIn: { ticks: '1', timescale: 1 },
        fadeOut: { ticks: '2', timescale: 1 },
        envelope: [
          { at: { ticks: '1', timescale: 2 }, volume: 0.7, ease: 'linear' },
          { at: { ticks: '4', timescale: 1 }, volume: 1, ease: 'linear' },
        ],
      },
    });
    const seq = sequence([voice('m', 'music', 0, 48000 * 5), voice('n', 'other', 150, 48000)], [track('a1', 'audio')]);
    const plan = ok(planAssetReplace({ sequence: seq, asset: asset('music', 'audio', 60), source: { from: 'library', asset: asset('song', 'audio', 2.51) } }));
    const written = op(plan, 'insertItems')!.items[0] as AudioItem;
    // 5 s → 2.51 s does not fit: shorter by ceil(2.49 × 30) = 75 frames, new length 2.5 s.
    expect(written.playDuration).toEqual({ ticks: '5', timescale: 2 });
    expect(written.timeMap).toMatchObject({ sourceIn: { ticks: '0', timescale: 48000 } });
    expect(written.mix).toEqual({
      volume: 0.5,
      fadeIn: { ticks: '1', timescale: 2 },
      fadeOut: { ticks: '2', timescale: 1 },
      envelope: [{ at: { ticks: '1', timescale: 2 }, volume: 0.7, ease: 'linear' }],
    });
    expect(op(plan, 'moveItems')!.moves).toEqual([{ itemId: 'n', offset: { unit: 'frames', value: -75 } }]);
  });

  it('links that deleting and writing back would lose are counted precisely: transitions, subtitles projected from it, ducking pointing at it', () => {
    const items: SequenceItem[] = [
      ...lane(),
      {
        id: 'cap',
        trackId: 's1',
        type: 'caption',
        enabled: true,
        locked: false,
        paintOrder: 1,
        followPolicy: { kind: 'sequence-fixed' },
        span: { fromFrame: 0, durationFrames: 100 },
        documentId: 'doc',
        scopeItemIds: ['a', 'b'],
      } satisfies CaptionItem,
    ];
    const seq: Sequence = {
      ...sequence(items),
      transitions: [
        { id: 't', leftItemId: 'a', rightItemId: 'b', kind: 'dissolve', durationFrames: 10, easing: 'linear', placement: 'center' },
      ],
      ducking: [
        {
          id: 'd',
          enabled: true,
          trigger: { kind: 'items', trackIds: ['v2'] },
          target: { itemIds: ['b'] },
          depth: 12,
          attack: { ticks: '0', timescale: 1 },
          release: { ticks: '0', timescale: 1 },
        },
      ],
    };
    const plan = planAssetReplace({ sequence: seq, asset: asset('main', 'video', 206), source: { from: 'library', asset: asset('x', 'video', 50) } });
    expect(plan).toMatchObject({ transitions: 1, captions: 1, ducking: 1 });
    expect(replaceSideEffects(plan)).toHaveLength(3);
  });
});
