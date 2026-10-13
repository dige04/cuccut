import { describe, expect, it } from 'vitest';
import type { AssetRecord, CaptionItem, DocumentRecord, Sequence, Track, VideoItem } from '@cuccut/protocol';
import {
  IDLE_MS,
  PLAYER_KEYS,
  captionAvailability,
  captionModes,
  captionView,
  chapterTicks,
  chromeHidden,
  cycleCaptionMode,
  defaultCaptionMode,
  effectiveCaptionMode,
  holdingVisible,
  percentTime,
  previewSize,
  resolvePlayerKey,
  seekFraction,
  seekFrame,
  stepTime,
  timeAt,
  type PlayerAction,
} from './player.ts';

const track = (id: string, order: number, kind: Track['kind'], extra: Partial<Track> = {}): Track => ({
  id,
  order,
  kind,
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: 'visual' },
  ...extra,
});

const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };
const caption = (id: string, trackId: string, documentId: string, extra: Partial<CaptionItem> = {}): CaptionItem => ({
  ...base,
  id,
  trackId,
  type: 'caption',
  span: { fromFrame: 0, durationFrames: 300 },
  documentId,
  ...extra,
});

const linear = (seconds: number): VideoItem['timeMap'] => ({
  kind: 'linear',
  sourceIn: { ticks: String(seconds * 1000), timescale: 1000 },
  rate: { num: 1, den: 1 },
});
const clip = (id: string, trackId: string, fromFrame: number, durationFrames: number, assetId: string, timeMap = linear(0), enabled = true) =>
  ({ ...base, id, type: 'video', trackId, enabled, span: { fromFrame, durationFrames }, assetRef: { id: assetId, revision: '1' }, timeMap }) as unknown as VideoItem;

function sequence(tracks: Track[], items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps: { num: 30, den: 1 },
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

const doc = (id: string, kind: string, extra: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id,
  kind,
  name: id,
  currentRevision: '1',
  revisions: {},
  ...extra,
});
const documents: Record<string, DocumentRecord> = {
  speech: doc('speech', 'speech'),
  trans: doc('trans', 'translation', { language: 'en' }),
  orig: doc('orig', 'caption', { sourceDocumentId: 'speech' }),
  en: doc('en', 'caption', { sourceDocumentId: 'trans', language: 'en' }),
};

describe('criteria for hiding the controls', () => {
  const idle = { playing: true, hovering: false, holding: false, idleMs: IDLE_MS };
  it('hides only when playing, not over the bar, not held, and idle for 3 seconds', () => {
    expect(chromeHidden(idle)).toBe(true);
    expect(chromeHidden({ ...idle, idleMs: IDLE_MS - 1 })).toBe(false);
    expect(chromeHidden({ ...idle, playing: false })).toBe(false);
    expect(chromeHidden({ ...idle, hovering: true })).toBe(false);
    expect(chromeHidden({ ...idle, holding: true })).toBe(false);
  });

  it('dragging the progress bar, an open popover, or dragging the volume all count as held', () => {
    const none = { scrubbing: false, popup: false, volumeDragging: false };
    expect(holdingVisible(none)).toBe(false);
    expect(holdingVisible({ ...none, scrubbing: true })).toBe(true);
    expect(holdingVisible({ ...none, popup: true })).toBe(true);
    expect(holdingVisible({ ...none, volumeDragging: true })).toBe(true);
  });
});

describe('progress and seeking', () => {
  it('ratio is clamped to 0–1; always 0 when the duration is 0', () => {
    expect(seekFraction(5, 10)).toBe(0.5);
    expect(seekFraction(15, 10)).toBe(1);
    expect(seekFraction(-1, 10)).toBe(0);
    expect(seekFraction(3, 0)).toBe(0);
  });

  it('x position converted to seconds, clamped to [0, duration]', () => {
    const rect = { left: 100, width: 200 };
    expect(timeAt(200, rect, 60)).toBe(30);
    expect(timeAt(0, rect, 60)).toBe(0);
    expect(timeAt(400, rect, 60)).toBe(60);
    expect(timeAt(200, { left: 0, width: 0 }, 60)).toBe(0);
  });

  it('step is clamped to [0, duration]; 0–9 are 0%–90% of the duration', () => {
    expect(stepTime(3, -5, 60)).toBe(0);
    expect(stepTime(58, 5, 60)).toBe(60);
    expect(stepTime(10, 10, 60)).toBe(20);
    expect(percentTime(0, 60)).toBe(0);
    expect(percentTime(5, 60)).toBe(30);
    expect(percentTime(9, 60)).toBeCloseTo(54);
    expect(percentTime(5, 0)).toBe(0);
  });

  it('chapter ticks skip the first chapter\'s 0 and any at or after the end credits', () => {
    expect(chapterTicks([{ start: 0 }, { start: 15 }, { start: 30 }, { start: 60 }], 60)).toEqual([0.25, 0.5]);
    expect(chapterTicks([{ start: 15 }], 0)).toEqual([]);
  });

  it('preview cell width 160 follows the canvas ratio; portrait height is at most 120', () => {
    expect(previewSize({ width: 1920, height: 1080 })).toEqual({ width: 160, height: 90 });
    expect(previewSize({ width: 1080, height: 1920 })).toEqual({ width: 68, height: 120 });
  });
});

describe('frame of the cell under the hover bubble', () => {
  const assets = {
    movie: { revisions: { '1': { video: { displayWidth: 1920 } } } },
    cover: { revisions: { '1': { video: { displayWidth: 1920 } } } },
    sound: { revisions: { '1': {} } },
  } as unknown as Record<string, AssetRecord>;

  it('takes the topmost enabled video clip at this moment on a visible track with picture, mapped to the source time of the media', () => {
    const seq = sequence(
      [track('v1', 1, 'visual'), track('v2', 2, 'visual'), track('v3', 3, 'visual', { visible: false })],
      [
        clip('main', 'v1', 0, 3000, 'movie', linear(10)),
        clip('top', 'v2', 300, 300, 'cover', linear(2)),
        clip('hidden', 'v3', 0, 3000, 'cover'),
        clip('off', 'v2', 0, 300, 'cover', linear(0), false),
      ],
    );
    // A 100-second piece rounded to 1 second: 4.6 s falls in the 4 s cell.
    expect(seekFrame(seq, assets, 4.6)).toEqual({ asset: { id: 'movie', revision: '1' }, at: 14 });
    expect(seekFrame(seq, assets, 12.5)).toEqual({ asset: { id: 'cover', revision: '1' }, at: 4 });
    expect(seekFrame(seq, assets, 120)).toBeNull();
  });

  it('when the rounded time falls before the clip start, takes the frame from the clip start', () => {
    const seq = sequence([track('v1', 1, 'visual')], [clip('a', 'v1', 0, 15, 'movie'), clip('b', 'v1', 15, 2985, 'movie', linear(40))]);
    expect(seekFrame(seq, assets, 0.9)).toEqual({ asset: { id: 'movie', revision: '1' }, at: 40 });
  });

  it('takes no frame when the media has no picture', () => {
    const seq = sequence([track('v1', 1, 'visual')], [clip('a', 'v1', 0, 300, 'sound')]);
    expect(seekFrame(seq, assets, 1)).toBeNull();
  });
});

describe('four subtitle tiers', () => {
  it('tiers are built from the subtitles that exist; by default, everything that can show is shown', () => {
    expect(captionModes(true, true)).toEqual(['off', 'source', 'trans', 'both']);
    expect(captionModes(true, false)).toEqual(['off', 'source']);
    expect(captionModes(false, true)).toEqual(['off', 'trans']);
    expect(captionModes(false, false)).toEqual(['off']);
    expect(defaultCaptionMode(true, true)).toBe('both');
    expect(defaultCaptionMode(true, false)).toBe('source');
    expect(defaultCaptionMode(false, true)).toBe('trans');
    expect(defaultCaptionMode(false, false)).toBe('off');
  });

  it('a selected tier that no longer exists falls back to the default; C cycles, and when not in the table starts from the top', () => {
    expect(effectiveCaptionMode(null, true, true)).toBe('both');
    expect(effectiveCaptionMode('source', true, true)).toBe('source');
    expect(effectiveCaptionMode('both', true, false)).toBe('source');
    expect(cycleCaptionMode('off', true, true)).toBe('source');
    expect(cycleCaptionMode('both', true, true)).toBe('off');
    expect(cycleCaptionMode('trans', true, false)).toBe('source');
    expect(cycleCaptionMode('off', false, false)).toBe('off');
  });

  it('only counts what is on screen: removed items and items on disabled tracks do not count', () => {
    const tracks = [track('s1', 1, 'subtitle'), track('s2', 2, 'subtitle'), track('s3', 3, 'subtitle', { visible: false })];
    expect(captionAvailability(sequence(tracks, [caption('a', 's1', 'orig'), caption('b', 's2', 'en')]), documents)).toEqual({
      hasSource: true,
      hasTranslation: true,
    });
    expect(
      captionAvailability(sequence(tracks, [caption('a', 's1', 'orig', { enabled: false }), caption('b', 's3', 'en')]), documents),
    ).toEqual({ hasSource: false, hasTranslation: false });
  });

  it('disables subtitles that should not show for the tier, never restoring removed ones; returns the input unchanged when nothing needs disabling', () => {
    const tracks = [track('s1', 1, 'subtitle'), track('s2', 2, 'subtitle')];
    const seq = sequence(tracks, [caption('a', 's1', 'orig'), caption('b', 's2', 'en'), caption('c', 's2', 'en', { enabled: false })]);
    const enabled = (s: Sequence) => s.items.map((item) => [item.id, item.enabled]);
    expect(enabled(captionView(seq, documents, 'source'))).toEqual([['a', true], ['b', false], ['c', false]]);
    expect(enabled(captionView(seq, documents, 'trans'))).toEqual([['a', false], ['b', true], ['c', false]]);
    expect(enabled(captionView(seq, documents, 'off'))).toEqual([['a', false], ['b', false], ['c', false]]);
    expect(captionView(seq, documents, 'both')).toBe(seq);
  });
});

describe('keyboard', () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    resolvePlayerKey({ key: k, code: '', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...extra });

  it('⌘ / Ctrl / ⌥ are never handled; ⇧ only changes the left and right keys', () => {
    expect(key(' ', { metaKey: true })).toBeNull();
    expect(key('k', { ctrlKey: true })).toBeNull();
    expect(key('ArrowLeft', { altKey: true })).toBeNull();
    expect(key('ArrowLeft', { shiftKey: true })).toEqual({ action: 'prevChapter' });
    expect(key('ArrowRight', { shiftKey: true })).toEqual({ action: 'nextChapter' });
    expect(key('K', { shiftKey: true })).toEqual({ action: 'play' });
  });

  it('digits use their own value; letters fall back to the physical key when the character is not recognized', () => {
    expect(key('7')).toEqual({ action: 'percent', digit: 7 });
    expect(key('Process', { code: 'KeyM' })).toEqual({ action: 'mute' });
    expect(key('x')).toBeNull();
  });

  it('pressing each row of the key table performs that row\'s action', () => {
    for (const row of PLAYER_KEYS) {
      expect(key(row.probe.key, row.probe)?.action, row.keys).toBe(row.action);
    }
  });

  it('every handled action is in the key table', () => {
    const listed = new Set<PlayerAction>(PLAYER_KEYS.flatMap((row) => [row.action, ...(row.also ?? [])]));
    const keys = [' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', '?', ...'0123456789', ...'abcdefghijklmnopqrstuvwxyz'];
    for (const k of keys)
      for (const shiftKey of [false, true]) {
        const action = key(k, { shiftKey })?.action;
        if (action) expect(listed.has(action), `${shiftKey ? '⇧' : ''}${k} → ${action}`).toBe(true);
      }
  });
});
