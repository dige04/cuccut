import { describe, expect, it } from 'vitest';
import type { JobRecord, Sequence, SequenceItem, Track, VideoSnapshot } from '@cuccut/protocol';
import { countWords, exportMetrics, latestVideoExport, metricDocumentIds, projectMetrics } from './review-metrics.ts';

/** 30 fps: 30 frames are one second. */
const FPS = { num: 30, den: 1 };
const sec = (s: number) => Math.round(s * 30);

const track = (id: string, kind: Track['kind'], order: number, over: Partial<Track> = {}): Track => ({
  id,
  order,
  kind,
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: kind === 'audio' ? 'audio' : 'visual' },
  ...over,
});

const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'follow-cuts' } } as const;
const asset = { id: 'a1', revision: 'r1' };
const linear = { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } } as const;

const videoClip = (id: string, trackId: string, from: number, to: number): SequenceItem => ({
  ...base,
  id,
  trackId,
  type: 'video',
  span: { fromFrame: sec(from), durationFrames: sec(to - from) },
  place: {},
  assetRef: asset,
  timeMap: { ...linear, sourceIn: { ticks: String(from), timescale: 1 } },
  embeddedAudio: { enabled: true, volume: 1 },
});
const text = (id: string, trackId: string, from: number, to: number, value: string, place = {}): SequenceItem => ({
  ...base,
  id,
  trackId,
  type: 'text',
  text: value,
  span: { fromFrame: sec(from), durationFrames: sec(to - from) },
  place,
});
const placeholder = (id: string, trackId: string, from: number, to: number, filled = false): SequenceItem => ({
  ...base,
  id,
  trackId,
  type: 'placeholder',
  span: { fromFrame: sec(from), durationFrames: sec(to - from) },
  place: {},
  placeholder: { variant: 'media' },
  ...(filled ? { assetRef: asset } : {}),
});
const caption = (id: string, trackId: string, from: number, to: number, documentId: string, scopeItemIds?: string[]): SequenceItem => ({
  ...base,
  id,
  trackId,
  type: 'caption',
  span: { fromFrame: sec(from), durationFrames: sec(to - from) },
  documentId,
  ...(scopeItemIds ? { scopeItemIds } : {}),
});

function snapshot(items: SequenceItem[], over: Partial<Sequence> = {}, documents: VideoSnapshot['documents'] = {}): VideoSnapshot {
  const sequence: Sequence = {
    id: 's1',
    revision: 'r',
    name: 'Main',
    fps: FPS,
    canvas: { width: 1080, height: 1920, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    animationBindings: [],
    tracks: [track('main', 'visual', 0), track('over', 'visual', 1), track('subs', 'subtitle', 2), track('music', 'audio', 3)],
    items,
    transitions: [],
    markers: [],
    ducking: [],
    ...over,
  };
  return {
    format: 'cuccut.video',
    schemaVersion: 3,
    timeContractVersion: 1,
    id: 'v1',
    name: 'Video',
    revision: 'rev1',
    rootSequenceId: 's1',
    sequences: { s1: sequence },
    assets: {},
    documents,
    fonts: {},
    localizationSets: {},
    canvasVariants: {},
    syncGroups: {},
    protections: {},
    checkpoints: {},
    links: [],
  };
}

const doc = (id: string, kind: string) => ({ id, kind, name: id, currentRevision: 'r', revisions: {} });

describe('project metrics', () => {
  it('measures length, shots, cuts, blanks and layers off the sequence', () => {
    const bag = projectMetrics(
      snapshot([videoClip('c1', 'main', 0, 4), videoClip('c2', 'main', 4, 10), videoClip('c3', 'main', 12, 15), text('t1', 'over', 5, 6, 'Later title')]),
      's1',
      {},
    );
    expect(bag).toMatchObject({
      'video.durationSec': 15,
      'video.shortSidePx': 1080,
      'video.shots': 3,
      'video.cutsPerMin': 8,
      'video.longestShotSec': 6,
      'video.longestBlankSec': 2,
      'captions.on': false,
      'hook.present': false,
      'text.offCanvas': false,
      'items.placeholders': 0,
      'transitions.count': 0,
      'layers.max': 1,
    });
    expect(bag['captions.wordsPerSec']).toBeUndefined();
    expect(bag['hook.words']).toBeUndefined();
  });

  it('counts unfilled placeholder boxes, and a hidden track does not cover a gap', () => {
    const bag = projectMetrics(
      snapshot([videoClip('c1', 'main', 0, 3), placeholder('p1', 'over', 3, 6), placeholder('p2', 'over', 6, 8, true)], {
        tracks: [track('main', 'visual', 0), track('over', 'visual', 1, { visible: false })],
      }),
      's1',
      {},
    );
    expect(bag['items.placeholders']).toBe(1);
    expect(bag['video.longestBlankSec']).toBe(5);
  });

  it('counts caption words inside the caption span, through the scope item when there is one', () => {
    const body = {
      schema: 'cuccut.caption/1',
      timescale: 1000,
      clock: 'source-asset',
      cues: [
        { id: 'a', start: 0, end: 1000, text: 'one two three' },
        { id: 'b', start: 5000, end: 6000, text: 'four five' },
        { id: 'c', start: 30_000, end: 31_000, text: 'never drawn' },
      ],
    };
    const sequenceBody = { ...body, clock: 'sequence' };
    const scoped = snapshot([videoClip('c1', 'main', 0, 10), caption('cap', 'subs', 0, 10, 'd1', ['c1'])], {}, { d1: doc('d1', 'caption') });
    expect(metricDocumentIds(scoped, 's1')).toEqual(['d1']);
    const bag = projectMetrics(scoped, 's1', new Map([['d1', body]]));
    expect(bag['captions.on']).toBe(true);
    expect(bag['captions.wordsPerSec']).toBe(0.5);
    const plain = snapshot([videoClip('c1', 'main', 0, 10), caption('cap', 'subs', 0, 5.5, 'd1')], {}, { d1: doc('d1', 'caption') });
    expect(projectMetrics(plain, 's1', { d1: sequenceBody })['captions.wordsPerSec']).toBe(0.5);
  });

  it('leaves out what cannot be read rather than counting it as zero', () => {
    const video = snapshot([videoClip('c1', 'main', 0, 10), caption('cap', 'subs', 0, 10, 'd1')], {}, { d1: doc('d1', 'caption') });
    const bag = projectMetrics(video, 's1', {});
    expect(bag['captions.on']).toBe(true);
    expect('captions.wordsPerSec' in bag).toBe(false);
    expect(projectMetrics(video, 'nope', {})).toEqual({});
    const hidden = snapshot([videoClip('c1', 'main', 0, 10), caption('cap', 'subs', 0, 10, 'd1')], {
      tracks: [track('main', 'visual', 0), track('subs', 'subtitle', 1, { visible: false })],
    });
    expect(projectMetrics(hidden, 's1', {})['captions.on']).toBe(false);
  });

  it('takes the hook from the derivation document, else early text', () => {
    const derived = snapshot([videoClip('c1', 'main', 0, 10), text('t1', 'over', 0.5, 2, 'Early words here')], {}, { dv: doc('dv', 'derivation') });
    expect(metricDocumentIds(derived, 's1')).toEqual(['dv']);
    expect(projectMetrics(derived, 's1', { dv: { schema: 'cuccut.derivation/1', hook: 'Wait for the ending' } })).toMatchObject({
      'hook.present': true,
      'hook.words': 4,
    });
    expect(projectMetrics(derived, 's1', { dv: { schema: 'cuccut.derivation/1' } })).toMatchObject({ 'hook.present': true, 'hook.words': 3 });
    const late = snapshot([videoClip('c1', 'main', 0, 10), text('t1', 'over', 2.5, 4, 'Too late')]);
    expect(projectMetrics(late, 's1', {})['hook.present']).toBe(false);
  });

  it('flags text whose box leaves the canvas sideways', () => {
    const inside = snapshot([text('t1', 'over', 0, 2, 'ok', { x: 50, w: 80 })]);
    const outside = snapshot([text('t1', 'over', 0, 2, 'wide', { x: 80, w: 30, scale: 2 })]);
    expect(projectMetrics(inside, 's1', {})['text.offCanvas']).toBe(false);
    expect(projectMetrics(outside, 's1', {})['text.offCanvas']).toBe(true);
  });

  it('counts words in spaced and unspaced scripts', () => {
    expect(countWords('one two  three')).toBe(3);
    expect(countWords('你好世界')).toBe(4);
    expect(countWords('Hello 世界 — ok')).toBe(4);
  });
});

describe('export metrics', () => {
  const job = (over: Partial<JobRecord>): JobRecord =>
    ({
      jobId: 'j1',
      kind: 'export',
      state: 'completed',
      videoId: 'v1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      endedAt: '2026-01-01T00:01:00Z',
      export: { settings: { kind: 'video', format: 'mp4' }, snapshotArtifactId: 'x', videoRevision: 'rev0', sequenceId: 's1', destination: { dir: '/', files: [], overwrite: false } },
      result: {
        documentId: null,
        artifactId: 'a',
        outputs: [
          {
            artifactId: 'a',
            mediaType: 'video/mp4',
            byteLength: 1,
            assetId: null,
            media: { kind: 'video', durationSec: 12.0004, width: 1080, height: 1920, videoCodec: 'h264', audioCodec: 'aac' },
            validation: {
              checks: [],
              expectedDurationSec: 12,
              durationSec: 12,
              toleranceSec: 0.1,
              loudness: { target: { integratedLufs: -16, truePeakDb: -1.2 }, measured: { inputLufs: -20, integratedLufs: -16.04, truePeakDb: -1.5 }, gainDb: 4 },
            },
          },
        ],
      },
      ...over,
    }) as JobRecord;

  it('reads duration, size and loudness from the newest finished-video export of the sequence', () => {
    const older = job({ jobId: 'old', endedAt: '2025-12-01T00:00:00Z' });
    const audio = job({ jobId: 'audio', endedAt: '2026-02-01T00:00:00Z', export: { ...job({}).export!, settings: { kind: 'audio', format: 'wav' } } });
    const failed = job({ jobId: 'failed', state: 'failed', endedAt: '2026-02-01T00:00:00Z' });
    const other = job({ jobId: 'other', endedAt: '2026-02-01T00:00:00Z', export: { ...job({}).export!, sequenceId: 's2' } });
    const newest = job({});
    expect(latestVideoExport([older, audio, failed, other, newest], 'v1', 's1')?.jobId).toBe('j1');
    expect(latestVideoExport([audio, failed], 'v1', 's1')).toBeNull();
    expect(exportMetrics(newest)).toEqual({
      'export.durationSec': 12,
      'export.width': 1080,
      'export.height': 1920,
      'export.loudnessLufs': -16.04,
      'export.truePeakDb': -1.5,
    });
    const quiet = job({});
    // Only whole-sequence deliverable exports count: a newer preview or range export describes a fragment.
    const settings = (over: object) => ({ ...job({}).export!, settings: { kind: 'video', format: 'mp4', ...over } }) as JobRecord['export'];
    const preview = job({ jobId: 'preview', endedAt: '2026-03-01T00:00:00Z', export: settings({ purpose: 'preview' }) });
    const range = job({ jobId: 'range', endedAt: '2026-03-01T00:00:00Z', export: settings({ range: { start: 0, end: 5 } }) });
    const ranges = job({ jobId: 'ranges', endedAt: '2026-03-01T00:00:00Z', export: settings({ ranges: [{ start: 0, end: 5 }] }) });
    const deliverable = job({ jobId: 'deliverable', export: settings({ purpose: 'deliverable', ranges: [] }) });
    expect(latestVideoExport([older, preview, range, ranges, newest], 'v1', 's1')?.jobId).toBe('j1');
    expect(latestVideoExport([preview, range, ranges, deliverable], 'v1', 's1')?.jobId).toBe('deliverable');
    expect(latestVideoExport([preview, range, ranges], 'v1', 's1')).toBeNull();
    delete quiet.result!.outputs![0]!.validation!.loudness;
    expect('export.loudnessLufs' in exportMetrics(quiet)).toBe(false);
  });
});
