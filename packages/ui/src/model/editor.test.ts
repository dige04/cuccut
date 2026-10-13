import { describe, expect, it } from 'vitest';
import type {
  AssetRecord,
  CaptionItem,
  CompositionItem,
  DocumentRecord,
  Sequence,
  SequenceItem,
  TextItem,
  Track,
  VideoItem,
} from '@cuccut/protocol';
import {
  clipKind,
  formatTimecode,
  itemFrames,
  itemLabel,
  parseSecondsInput,
  playButtonState,
  rulerLabel,
  rulerStep,
  snapFrame,
  snapTargets,
  timelineRows,
  trackAccepts,
  trackRows,
  videoSlots,
} from './editor.ts';

const fps = { num: 30, den: 1 };

function track(id: string, order: number, kind: Track['kind'], patch: Partial<Track> = {}): Track {
  return {
    id,
    order,
    kind,
    locked: false,
    visible: true,
    muted: false,
    solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' },
    ...patch,
  };
}

function video(id: string, trackId: string, fromFrame: number, durationFrames: number, sourceIn = '0'): VideoItem {
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
    timeMap: { kind: 'linear', sourceIn: { ticks: sourceIn, timescale: 30 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

const itemBase = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };
const fullFrame = { place: {} };

function text(id: string, trackId: string, content: string): TextItem {
  return { ...itemBase, ...fullFrame, id, trackId, type: 'text', span: { fromFrame: 0, durationFrames: 60 }, text: content, style: {} };
}

function composition(id: string, trackId: string, fromFrame: number, source: CompositionItem['source'] = BUNDLE): CompositionItem {
  return {
    ...itemBase,
    ...fullFrame,
    id,
    trackId,
    type: 'composition',
    span: { fromFrame, durationFrames: 30 },
    source,
    parameterValues: {},
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 30 }, rate: { num: 1, den: 1 } },
  };
}

/** A composition has only one source: a code bundle. */
const BUNDLE: CompositionItem['source'] = { kind: 'bundle', assetRef: { id: 'asset_b', revision: '1' } };

/** Element instances (stickers, progress bars, waveforms, ...): only the type and the asset reference are used. */
function element(type: 'sticker' | 'progress' | 'visualizer' | 'confetti', patch: Record<string, unknown> = {}): SequenceItem {
  return {
    ...itemBase,
    ...fullFrame,
    id: 'e',
    trackId: 'v1',
    type,
    span: { fromFrame: 0, durationFrames: 30 },
    ...patch,
  } as unknown as SequenceItem;
}

function caption(id: string, trackId: string, documentId: string): CaptionItem {
  return { ...itemBase, id, trackId, type: 'caption', span: { fromFrame: 15, durationFrames: 45 }, documentId };
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

describe('editor model', () => {
  it('track rows: higher-numbered visual tracks on top, audio below', () => {
    const seq = sequence([track('v1', 0, 'visual'), track('a1', 1, 'audio'), track('v2', 2, 'visual')], []);
    expect(trackRows(seq).map((r) => r.label)).toEqual(['画面 2', '画面 1', '音频']);
  });

  it('track rows: subtitles and video share one stack, ordered by order; when there is more than one of a kind, numbered in sequence', () => {
    const seq = sequence([track('v1', 0, 'visual'), track('a1', 1, 'audio'), track('s1', 2, 'subtitle'), track('s2', 3, 'subtitle')], []);
    expect(trackRows(seq).map((r) => r.label)).toEqual(['字幕 2', '字幕 1', '画面', '音频']);
    const over = sequence([track('s1', 0, 'subtitle'), track('v1', 1, 'visual'), track('s2', 2, 'subtitle'), track('v2', 3, 'visual')], []);
    expect(trackRows(over).map((r) => r.label)).toEqual(['画面 2', '字幕 2', '画面 1', '字幕 1']);
  });

  it('track rows: named tracks show \'category · name\' and are not numbered', () => {
    const seq = sequence(
      [track('s1', 0, 'subtitle', { name: '英文' }), track('s2', 1, 'subtitle'), track('a1', 2, 'audio', { name: '原声' })],
      [],
    );
    expect(trackRows(seq).map((r) => r.label)).toEqual(['字幕 2', '字幕 · 英文', '音频 · 原声']);
  });

  it('track rows: engine default codes V1 and A1 are not treated as names', () => {
    const seq = sequence([track('v1', 0, 'visual', { name: 'V1' }), track('a1', 1, 'audio', { name: 'A1' })], []);
    expect(trackRows(seq).map((r) => r.label)).toEqual(['画面', '音频']);
  });

  it('timeline rows: audio tracks with no name and no instances are not drawn (the video\'s own sound); tracks with instances or names are drawn', () => {
    const bare = sequence([track('v1', 0, 'visual', { name: 'V1' }), track('a1', 1, 'audio', { name: 'A1' })], []);
    expect(timelineRows(bare).map((r) => r.label)).toEqual(['画面']);
    const music = { ...itemBase, id: 'm', trackId: 'a2', type: 'audio' } as unknown as SequenceItem;
    const seq = sequence(
      [track('v1', 0, 'visual'), track('a1', 1, 'audio', { name: 'A1' }), track('a2', 2, 'audio'), track('a3', 3, 'audio', { name: '旁白' })],
      [music],
    );
    expect(timelineRows(seq).map((r) => r.label)).toEqual(['画面', '音频 2', '音频 · 旁白']);
    expect(trackRows(seq)).toHaveLength(4);
  });

  it('which track kind an instance goes on: subtitles go only on subtitle tracks; text, graphics and compositions go on visual tracks', () => {
    const [visual, audio, subtitle] = [track('v1', 0, 'visual'), track('a1', 1, 'audio'), track('s1', 2, 'subtitle')];
    expect((['video', 'image', 'text', 'shape', 'composition'] as const).every((type) => trackAccepts(visual!, { type }))).toBe(true);
    expect(trackAccepts(visual!, { type: 'caption' })).toBe(false);
    expect(trackAccepts(visual!, { type: 'audio' })).toBe(false);
    expect(trackAccepts(audio!, { type: 'audio' })).toBe(true);
    expect(trackAccepts(audio!, { type: 'text' })).toBe(false);
    expect(trackAccepts(subtitle!, { type: 'caption' })).toBe(true);
    expect(trackAccepts(subtitle!, { type: 'video' })).toBe(false);
  });

  it('instance name: its own name first; otherwise the text content, media name, element kind name, or subtitle document name', () => {
    const assets = {
      asset_v: { id: 'asset_v', kind: 'video', name: 'clip.mp4', currentRevision: '1', revisions: {} },
      asset_b: { id: 'asset_b', kind: 'bundle', name: '片头', currentRevision: '1', revisions: {} },
    } satisfies Record<string, AssetRecord>;
    const documents: Record<string, DocumentRecord> = {
      doc_1: { id: 'doc_1', kind: 'caption', name: '中文字幕', currentRevision: '1', revisions: {} },
    };
    const label = (item: Sequence['items'][number]) => itemLabel(item, assets, documents);
    expect(label(video('a', 'v1', 0, 30))).toBe('clip.mp4');
    expect(label({ ...video('a', 'v1', 0, 30), name: '开场' })).toBe('开场');
    expect(label(text('t', 'v1', '第一行\n  第二行'))).toBe('第一行 第二行');
    expect(label(text('t', 'v1', '  '))).toBe('文字');
    expect(
      label({
        ...itemBase,
        ...fullFrame,
        id: 's',
        trackId: 'v1',
        type: 'shape',
        span: { fromFrame: 0, durationFrames: 30 },
        shape: { shape: 'rect' },
      }),
    ).toBe('图形');
    expect(label({ ...text('t', 'v1', ''), text: undefined, counter: { mode: 'countdown' } })).toBe('计数器');
    expect(label(element('sticker', { sticker: { source: 'template', templateId: 'heart' } }))).toBe('贴纸');
    expect(label(element('sticker', { assetRef: { id: 'asset_v', revision: '1' }, sticker: { source: 'asset' } }))).toBe('clip.mp4');
    expect(label(element('visualizer'))).toBe('波形');
    expect(label(element('progress'))).toBe('进度条');
    expect(label(composition('k', 'v1', 0, { kind: 'bundle', assetRef: { id: 'asset_b', revision: '1' } }))).toBe('片头');
    expect(label(composition('k', 'v1', 0, { kind: 'bundle', assetRef: { id: 'gone', revision: '1' } }))).toBe('合成');
    expect(label(caption('c', 's1', 'doc_1'))).toBe('中文字幕');
    expect(label(caption('c', 's1', 'gone'))).toBe('字幕');
    expect(itemFrames(caption('c', 's1', 'doc_1'), fps)).toEqual({ start: 15, end: 60 });
  });

  it('timeline block category: elements by their own type, text with a timing readout counts as a counter, code packages are compositions', () => {
    expect(clipKind(video('a', 'v1', 0, 30))).toBe('video');
    expect(clipKind(text('t', 'v1', 'hi'))).toBe('text');
    expect(clipKind(caption('c', 's1', 'doc_1'))).toBe('caption');
    expect(clipKind({ ...text('t', 'v1', ''), counter: { mode: 'countup' } })).toBe('counter');
    expect((['progress', 'sticker', 'visualizer', 'confetti'] as const).map((type) => clipKind(element(type)))).toEqual([
      'progress',
      'sticker',
      'visualizer',
      'confetti',
    ]);
    expect(clipKind(composition('k', 'v1', 0, { kind: 'bundle', assetRef: { id: 'asset_b', revision: '1' } }))).toBe('composition');
  });

  it('preview video elements: compositions with a pre-rendered proxy also take a proxy-media element; compositions without a proxy do not', () => {
    const prerender = { id: 'asset_p', revision: '1' };
    const seq = sequence(
      [track('v1', 0, 'visual'), track('v2', 1, 'visual')],
      [
        video('a', 'v1', 0, 60),
        { ...composition('k1', 'v2', 0), prerender },
        { ...composition('k2', 'v1', 60), prerender: { id: 'asset_v', revision: '1' } },
        composition('k3', 'v2', 30),
      ],
    );
    expect(videoSlots(seq).map(({ asset, count }) => [asset.id, count])).toEqual([
      ['asset_v', 1],
      ['asset_p', 1],
    ]);
  });

  it('preview video elements: one is needed per use of the same media at the same frame; end-to-end adjacent uses share one', () => {
    const seq = sequence(
      [track('v1', 0, 'visual'), track('v2', 1, 'visual')],
      [video('a', 'v1', 0, 30), video('b', 'v1', 30, 30), video('c', 'v2', 15, 30), { ...video('d', 'v2', 0, 90), enabled: false }],
    );
    expect(videoSlots(seq).map(({ asset, count }) => [asset.id, count])).toEqual([['asset_v', 2]]);
    expect(videoSlots(sequence([track('v1', 0, 'visual')], [video('a', 'v1', 0, 30), video('b', 'v1', 30, 30)]))[0]?.count).toBe(1);
  });

  it('preview video elements: when two split segments have transitions on both sides, the window needs two elements for the same media; a one-sided transition adds none', () => {
    const base = sequence([track('v1', 0, 'visual')], [video('a', 'v1', 0, 30), video('b', 'v1', 30, 30, '30')]);
    const dissolve = {
      id: 't1',
      leftItemId: 'a',
      rightItemId: 'b',
      kind: 'dissolve',
      durationFrames: 10,
      easing: 'linear',
      placement: 'center',
    } as const;
    expect(videoSlots({ ...base, transitions: [dissolve] })[0]?.count).toBe(2);
    expect(videoSlots({ ...base, transitions: [{ ...dissolve, rightItemId: undefined }] })[0]?.count).toBe(1);
  });

  it('snapping: within the threshold, snap to the nearest target; does not snap the instance being dragged', () => {
    const seq = sequence([track('v1', 0, 'visual')], [video('a', 'v1', 0, 30), video('b', 'v1', 60, 30)]);
    const targets = snapTargets(seq, 45, new Set(['b']));
    expect(targets.sort((x, y) => x - y)).toEqual([0, 30, 45]);
    expect(snapFrame(33, targets, 4)).toEqual({ frame: 30, snapped: 30 });
    expect(snapFrame(38, targets, 4)).toEqual({ frame: 38, snapped: null });
  });

  it('ticks and timecode', () => {
    expect(rulerStep(40).major).toBe(2);
    expect(rulerStep(400).major).toBe(0.2);
    expect(rulerLabel(65, 5)).toBe('1:05');
    expect(rulerLabel(1.5, 0.5)).toBe('0:01.5');
    expect(formatTimecode(5 + 12 / 30, fps)).toBe('00:00:05:12');
    // 29.97 fps: 3661 seconds falls in the middle of a frame, which starts at 3660.99 seconds and is displayed by real time (not drop-frame timecode).
    expect(formatTimecode(3661, { num: 30000, den: 1001 })).toBe('01:01:00:29');
  });

  it('play button has three states: while playing it pauses; stopped at the end (within 0.05 seconds) it replays', () => {
    expect(playButtonState({ playing: false, playhead: 0, duration: 10 })).toBe('play');
    expect(playButtonState({ playing: true, playhead: 3, duration: 10 })).toBe('pause');
    // While playing, the button still shows pause at the end: the engine stops only once playback has reached the end.
    expect(playButtonState({ playing: true, playhead: 10, duration: 10 })).toBe('pause');
    expect(playButtonState({ playing: false, playhead: 10, duration: 10 })).toBe('replay');
    expect(playButtonState({ playing: false, playhead: 9.96, duration: 10 })).toBe('replay');
    expect(playButtonState({ playing: false, playhead: 9.9, duration: 10 })).toBe('play');
    // An empty timeline (total length 0) has no end to speak of: show play, not replay.
    expect(playButtonState({ playing: false, playhead: 0, duration: 0 })).toBe('play');
  });

  it('seconds input: decimal strings are passed to the engine as is; \'min:sec\' is converted to seconds', () => {
    expect(parseSecondsInput('10')).toBe('10');
    expect(parseSecondsInput(' 10.010 秒')).toBe('10.010');
    expect(parseSecondsInput('1:05.5')).toBe('65.5');
    expect(parseSecondsInput('007.5')).toBe('7.5');
    expect(parseSecondsInput('-1')).toBeNull();
    expect(parseSecondsInput('abc')).toBeNull();
  });
});
