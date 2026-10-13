import { describe, expect, it } from 'vitest';
import type { AssetRecord, Crop, Sequence, SequenceItem } from '@cuccut/protocol';
import { cropOperations, gestureOperations, gesturePatch, memberOf, panGesture, stepGesture } from './stage-gesture.ts';
import { isPannable, panCrop, sourceSize, type PannableVideo } from './stage-pose.ts';
import { applyFramingToAll, framingPieces, shotSeconds, showsShotChip } from './stage-shots.ts';
import { patchItem } from './item-draft.ts';

/** 9:16 sub-video canvas, 16:9 source: the crop window is exactly 9:16 (width 0.3164), filling the canvas with `cover`. */
const canvas = { width: 1080, height: 1920 };
const window916 = (left: number): Crop => ({ left, top: 0, right: +(1 - 0.3164 - left).toFixed(4), bottom: 0 });
const assets = {
  a1: {
    id: 'a1',
    kind: 'video',
    revisions: { r1: { video: { displayWidth: 1920, displayHeight: 1080, rotation: 0, pixelAspectRatio: { num: 1, den: 1 } } } },
  },
} as unknown as Record<string, AssetRecord>;

const piece = (id: string, fromFrame: number, durationFrames: number, crop: Crop | undefined, over: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'video',
    trackId: 'v1',
    mode: 'fullscreen',
    fit: 'cover',
    place: {},
    span: { fromFrame, durationFrames },
    assetRef: { id: 'a1', revision: 'r1' },
    ...(crop ? { crop } : {}),
    ...over,
  }) as unknown as SequenceItem;

const seq = (items: SequenceItem[]) => ({ id: 's1', fps: { num: 30, den: 1 }, canvas, items }) as unknown as Sequence;

describe('平移取景', () => {
  it('只认铺满、cover、带裁剪的视频', () => {
    expect(isPannable(piece('a', 0, 30, window916(0.2)))).toBe(true);
    expect(isPannable(piece('a', 0, 30, window916(0.2), { fit: undefined }))).toBe(true);
    expect(isPannable(piece('a', 0, 30, undefined))).toBe(false);
    expect(isPannable(piece('a', 0, 30, window916(0.2), { fit: 'contain' }))).toBe(false);
    expect(isPannable(piece('a', 0, 30, window916(0.2), { mode: 'pip' }))).toBe(false);
  });

  it('水平拖动只挪窗口：左右之和不变，往右拖窗口往左挪', () => {
    const crop = window916(0.3);
    // Window 0.3164 × 1920 = 607.5 source pixels fill 1080 canvas pixels: dragging 108 canvas pixels is 60.75 source pixels, i.e. 0.0316 of the source width.
    const moved = panCrop(crop, 108, 0, canvas, { width: 1920, height: 1080 });
    expect(moved.left).toBeCloseTo(0.3 - 0.0316, 4);
    expect(moved.left + moved.right).toBeCloseTo(crop.left + crop.right, 4);
    expect(moved.top).toBe(0);
    expect(moved.bottom).toBe(0);
    // When the source size is unknown, it is computed as if the window exactly fills the canvas; the result is the same.
    expect(panCrop(crop, 108, 0, canvas, null).left).toBeCloseTo(moved.left, 4);
  });

  it('夹在源画面里：拖过头停在边上', () => {
    const crop = window916(0.1);
    expect(panCrop(crop, 5000, 0, canvas, null)).toEqual({ left: 0, top: 0, right: crop.right + 0.1, bottom: 0 });
    const far = panCrop(crop, -5000, 0, canvas, null);
    expect(far.left).toBeCloseTo(1 - 0.3164, 4);
    expect(far.right).toBe(0);
  });

  it('窗口与源一样高时竖直方向不动；矮于源时上下也能挪', () => {
    const crop = window916(0.3);
    expect(panCrop(crop, 0, 300, canvas, null)).toBe(crop);
    const short: Crop = { left: 0.2, top: 0.1, right: 0.2, bottom: 0.3 };
    const down = panCrop(short, 0, -200, canvas, null);
    expect(down.top).toBeGreaterThan(0.1);
    expect(down.top + down.bottom).toBeCloseTo(0.4, 4);
    expect(down.left).toBe(0.2);
  });

  it('手势：盒不动，草稿叠裁剪，松手写一笔 setStyle；没动不提交', () => {
    const item = piece('a', 0, 30, window916(0.3)) as PannableVideo;
    expect(sourceSize(item, assets)).toEqual({ width: 1920, height: 1080 });
    const g = panGesture(item, { x: 540, y: 960 }, canvas, assets);
    const env = { canvas, others: [], pxScale: 1 };
    const frame = stepGesture(g, { x: 648, y: 960 }, { shift: false, alt: false }, env);
    expect(frame.poses[0]).toEqual(memberOf(item, canvas, assets).start);
    expect(frame.crop!.left).toBeCloseTo(0.2684, 4);
    expect(gesturePatch(item, frame.poses[0]!, 1, canvas, assets, frame.crop)).toEqual({ crop: frame.crop });
    expect(patchItem(item, { crop: frame.crop! })).toMatchObject({ crop: frame.crop });
    expect(cropOperations('s1', item, frame.crop!)).toEqual([{ type: 'setStyle', sequenceId: 's1', itemId: 'a', crop: frame.crop }]);
    expect(cropOperations('s1', item, item.crop)).toEqual([]);
    // A full-frame video has no movable box: the generic move gesture cannot write anything.
    expect(gestureOperations('s1', [g.member], frame.poses, 1, canvas)).toEqual([]);
  });
});

describe('按镜头分段取景的小牌', () => {
  const a = piece('a', 0, 225, window916(0.1));
  const b = piece('b', 225, 300, window916(0.5));
  const overlay = piece('o', 0, 90, window916(0.2), { assetRef: { id: 'a2', revision: 'r1' } });
  const plain = piece('p', 525, 60, undefined);

  it('同一素材拆成不止一段取景、选中其中一段时才出', () => {
    const s = seq([b, a, overlay, plain]);
    expect(framingPieces(s, b).map((x) => x.id)).toEqual(['a', 'b']);
    expect(showsShotChip(s, a)).toBe(true);
    expect(showsShotChip(s, overlay)).toBe(false);
    expect(showsShotChip(s, plain)).toBe(false);
    expect(showsShotChip(seq([a, plain]), a)).toBe(false);
  });

  it('秒是子视频时间线上的起止，取整，至少 1 秒', () => {
    expect(shotSeconds(b as PannableVideo, { fps: { num: 30, den: 1 } })).toEqual({ from: 8, to: 18 });
    expect(shotSeconds(piece('t', 0, 6, window916(0)) as PannableVideo, { fps: { num: 30, den: 1 } })).toEqual({ from: 0, to: 1 });
  });

  it('套到整支：其它几段各写一笔裁剪，已经一样的不写', () => {
    const c = piece('c', 525, 30, window916(0.1));
    const s = seq([a, b, c, overlay]);
    const pieces = framingPieces(s, a);
    expect(applyFramingToAll('s1', a as PannableVideo, pieces)).toEqual([
      { type: 'setStyle', sequenceId: 's1', itemId: 'b', crop: window916(0.1) },
    ]);
    expect(applyFramingToAll('s1', b as PannableVideo, pieces).map((op) => 'itemId' in op && op.itemId)).toEqual(['a', 'c']);
  });
});
