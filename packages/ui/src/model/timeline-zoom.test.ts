import { describe, expect, it } from 'vitest';
import type { Sequence, Track, VideoItem } from '@cuccut/protocol';
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_PAD,
  ZOOM_PLAYHEAD,
  anchoredScroll,
  clampZoom,
  clipSpanAt,
  fitPxPerSecond,
  selectionSpan,
  zoomFloor,
  zoomKey,
  zoomLabel,
  zoomPlan,
  type ZoomView,
} from './timeline-zoom.ts';

const fps = { num: 30, den: 1 };

function track(id: string, order: number, kind: Track['kind'] = 'visual'): Track {
  return {
    id,
    order,
    kind,
    locked: false,
    visible: true,
    muted: false,
    solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' },
  };
}

function video(id: string, trackId: string, fromSeconds: number, seconds: number): VideoItem {
  return {
    id,
    trackId,
    type: 'video',
    enabled: true,
    locked: false,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame: fromSeconds * 30, durationFrames: seconds * 30 },
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

const view = (patch: Partial<ZoomView> = {}): ZoomView => ({
  pxPerSecond: ZOOM_DEFAULT,
  scroll: 0,
  lane: 1000,
  duration: 60,
  playhead: 0,
  ...patch,
});

describe('zoomLabel', () => {
  it('≥10% rounds to an integer, 100% = ZOOM_DEFAULT', () => {
    expect(zoomLabel(ZOOM_DEFAULT)).toBe('100%');
    expect(zoomLabel(8.8)).toBe('22%');
    expect(zoomLabel(ZOOM_MAX)).toBe('1000%');
    expect(zoomLabel(ZOOM_MIN)).toBe('10%');
  });

  it('1–10% keeps one decimal and drops .0', () => {
    expect(zoomLabel(1.76)).toBe('4.4%');
    expect(zoomLabel(2)).toBe('5%');
  });

  it('<1% keeps two significant digits and drops trailing zeros', () => {
    expect(zoomLabel(0.168)).toBe('0.42%');
    expect(zoomLabel(0.02)).toBe('0.05%');
    expect(zoomLabel(0.0048)).toBe('0.012%');
  });

  it('rounding up across a tier doesn\'t render as 10.0% / 1.0%, and an effective zoom never shows 0%', () => {
    expect(zoomLabel((9.96 / 100) * ZOOM_DEFAULT)).toBe('10%');
    expect(zoomLabel((0.996 / 100) * ZOOM_DEFAULT)).toBe('1%');
    expect(zoomLabel(0.0001)).not.toBe('0%');
    expect(zoomLabel(0)).toBe('—');
  });
});

describe('zoom minimum', () => {
  it('short videos stop at ZOOM_MIN', () => {
    expect(zoomFloor(60, 1000)).toBe(ZOOM_MIN);
  });

  it('a two-hour video can zoom out to fit the whole piece in frame, with a label under 1%', () => {
    const floor = zoomFloor(7200, 1000);
    expect(floor).toBeCloseTo((1000 - ZOOM_PAD * 2) / 7200, 10);
    expect(clampZoom(0.001, floor)).toBe(floor);
    expect(zoomLabel(floor)).toBe('0.34%');
  });

  it('fit-to-window exactly equals the minimum and isn\'t clamped', () => {
    const floor = zoomFloor(3960, 900);
    expect(clampZoom(fitPxPerSecond(3960, 900), floor)).toBe(floor);
    expect(zoomPlan('fit', view({ duration: 3960, lane: 900 }))).toMatchObject({ pxPerSecond: floor, scroll: 0 });
  });

  it('without a duration, or before the lane is measured, falls back to ZOOM_MIN', () => {
    expect(zoomFloor(0, 1000)).toBe(ZOOM_MIN);
    expect(zoomFloor(7200, ZOOM_PAD * 2)).toBe(ZOOM_MIN);
  });

  it('maximum is ZOOM_MAX; a minimum above ZOOM_MIN is not raised', () => {
    expect(clampZoom(1e6, ZOOM_MIN)).toBe(ZOOM_MAX);
    expect(clampZoom(ZOOM_MIN, 50)).toBe(ZOOM_MIN);
  });
});

describe('zoomPlan', () => {
  it('zoom in / out anchors on the playhead within the viewport', () => {
    const before = view({ playhead: 10, scroll: 100 });
    const x = ZOOM_PAD + 10 * ZOOM_DEFAULT - 100;
    const plan = zoomPlan('in', before)!;
    expect(plan.pxPerSecond).toBe(ZOOM_DEFAULT * 1.5);
    expect(ZOOM_PAD + 10 * plan.pxPerSecond - plan.scroll).toBeCloseTo(x, 9);
    expect(zoomPlan('out', before)!.pxPerSecond).toBeCloseTo(ZOOM_DEFAULT / 1.5, 9);
  });

  it('when the playhead is outside the viewport, the time at the viewport\'s center stays fixed', () => {
    const plan = zoomPlan('100', view({ playhead: 200, scroll: 0, duration: 300, pxPerSecond: 20 }))!;
    expect(plan.pxPerSecond).toBe(ZOOM_DEFAULT);
    const middle = (500 - ZOOM_PAD) / 20;
    expect(ZOOM_PAD + middle * plan.pxPerSecond - plan.scroll).toBeCloseTo(500, 9);
  });

  it('zooming out does not go past the minimum', () => {
    expect(zoomPlan('out', view({ pxPerSecond: ZOOM_MIN }))!.pxPerSecond).toBe(ZOOM_MIN);
  });

  it('zoom to playhead: 200% and centers the playhead', () => {
    const plan = zoomPlan('playhead', view({ playhead: 30, pxPerSecond: 5 }))!;
    expect(plan.pxPerSecond).toBe(ZOOM_PLAYHEAD);
    expect(ZOOM_PAD + 30 * plan.pxPerSecond - plan.scroll).toBeCloseTo(500, 9);
  });

  it('fit range: fills the lanes and centers; also centers when reaching the maximum', () => {
    const plan = zoomPlan('fitClip', view({ duration: 600 }), { start: 100, end: 120 })!;
    expect(plan.pxPerSecond).toBeCloseTo(fitPxPerSecond(20, 1000), 9);
    expect(ZOOM_PAD + 100 * plan.pxPerSecond - plan.scroll).toBeCloseTo(ZOOM_PAD, 9);
    expect(ZOOM_PAD + 120 * plan.pxPerSecond - plan.scroll).toBeCloseTo(1000 - ZOOM_PAD, 9);
    const tiny = zoomPlan('fitSelection', view(), { start: 10, end: 10.5 })!;
    expect(tiny.pxPerSecond).toBe(ZOOM_MAX);
    expect(ZOOM_PAD + 10.25 * tiny.pxPerSecond - tiny.scroll).toBeCloseTo(500, 9);
  });

  it('returns null when there is no range', () => {
    expect(zoomPlan('fitClip', view(), null)).toBeNull();
    expect(zoomPlan('fitSelection', view())).toBeNull();
  });

  it('scroll offset is not less than 0', () => {
    expect(anchoredScroll(1, 500, 10)).toBe(0);
  });
});

describe('fit range', () => {
  const tracks = [track('v1', 0), track('v2', 1), track('a1', 2, 'audio')];
  const seq = sequence(tracks, [video('base', 'v1', 0, 60), video('top', 'v2', 20, 10), video('later', 'v1', 60, 30)]);

  it('uses the selected clip when it covers the playhead', () => {
    expect(clipSpanAt(seq, ['base'], 25)).toEqual({ start: 0, end: 60 });
  });

  it('otherwise uses the video under the playhead on the top video track', () => {
    expect(clipSpanAt(seq, [], 25)).toEqual({ start: 20, end: 30 });
    expect(clipSpanAt(seq, ['later'], 5)).toEqual({ start: 0, end: 60 });
    expect(clipSpanAt(seq, [], 70)).toEqual({ start: 60, end: 90 });
  });

  it('returns null when no video is under the playhead', () => {
    expect(clipSpanAt(seq, [], 95)).toBeNull();
  });

  it('selected: union; returns null when nothing is selected', () => {
    expect(selectionSpan(seq, ['top', 'later'])).toEqual({ start: 20, end: 90 });
    expect(selectionSpan(seq, [])).toBeNull();
  });
});

describe('zoomKey', () => {
  const key = (k: string, code: string, alt = false, shift = false) => ({ key: k, code, altKey: alt, shiftKey: shift });

  it('⌘= / ⌘− / ⌘0', () => {
    expect(zoomKey(key('=', 'Equal'), true)).toBe('in');
    expect(zoomKey(key('+', 'Equal', false, true), true)).toBe('in');
    expect(zoomKey(key('-', 'Minus'), true)).toBe('out');
    expect(zoomKey(key('0', 'Digit0'), true)).toBe('100');
  });

  it('⌥⌘1–4 matches physical key positions (on macOS, key yields a special character)', () => {
    expect(zoomKey(key('¡', 'Digit1', true), true)).toBe('fit');
    expect(zoomKey(key('™', 'Digit2', true), true)).toBe('fitClip');
    expect(zoomKey(key('£', 'Digit3', true), true)).toBe('playhead');
    expect(zoomKey(key('¢', 'Digit4', true), true)).toBe('fitSelection');
    expect(zoomKey(key('∞', 'Digit5', true), true)).toBeNull();
    expect(zoomKey(key('!', 'Digit1', true, true), true)).toBeNull();
  });

  it('without ⌘ / Ctrl does not count', () => {
    expect(zoomKey(key('=', 'Equal'), false)).toBeNull();
    expect(zoomKey(key('a', 'KeyA'), true)).toBeNull();
  });
});
