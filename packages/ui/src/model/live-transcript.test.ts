import type { CaptionItem, DocumentRecord, JobLiveSegment, Sequence, Track, VideoItem } from '@cuccut/protocol';
import { describe, expect, it } from 'vitest';
import { job } from '../testing/task-records.ts';
import {
  assetCaptioned,
  holdSegments,
  liveAt,
  livePending,
  liveRowShown,
  liveTranscriptions,
  liveTranscriptShown,
  placePending,
  placeSegments,
  placeTranscript,
  transcribedBefore,
  transcriptRows,
} from './live-transcript.ts';

const fps = { num: 30, den: 1 };
const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };

/** One instance of material `a1`: on the sequence, starting at `fromFrame` for `durationFrames` frames, taking the material from `sourceIn` seconds onward. */
function video(id: string, fromFrame: number, durationFrames: number, sourceIn: number): VideoItem {
  return {
    ...base,
    id,
    trackId: 'v1',
    type: 'video',
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: 'a1', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(Math.round(sourceIn * 1000)), timescale: 1000 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

const caption = (id: string, documentId: string): CaptionItem => ({
  ...base,
  id,
  trackId: 's1',
  type: 'caption',
  span: { fromFrame: 0, durationFrames: 300 },
  documentId,
});

function sequence(items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps,
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks: [],
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  };
}

const doc = (id: string, kind: string, createdAt: string, sourceAssetId = 'a1'): DocumentRecord => ({
  id,
  kind,
  name: id,
  sourceAssetId,
  currentRevision: '1',
  revisions: { '1': { revision: '1', contentHash: 'sha256:0', byteLength: 1, createdAt, createdBy: 'tx' } },
});

const seg = (start: number, end: number, text = `${start}`): JobLiveSegment => ({ start, end, text });

describe('liveAt / livePending', () => {
  it('transcription position = max(end of last segment, progress seconds), clamped to media duration', () => {
    expect(liveAt([], null, 30)).toBe(0);
    expect(liveAt([seg(0, 4), seg(4, 9)], null, 30)).toBe(9);
    // Progress is reported in seconds: the front edge follows progress when decoding and VAD run ahead of recognition.
    expect(liveAt([seg(0, 4)], { done: 12, total: 30, unit: 'seconds' }, 30)).toBe(12);
    // When the paragraphs are newer than the progress (the progress event has not arrived yet), follow the paragraphs.
    expect(liveAt([seg(0, 14)], { done: 12, total: 30, unit: 'seconds' }, 30)).toBe(14);
    expect(liveAt([], { done: 45, total: 30, unit: 'seconds' }, 30)).toBe(30);
  });

  it('progress reported by VAD segments is only a lower bound: done / total × duration', () => {
    expect(liveAt([], { done: 5, total: 10, unit: 'segments' }, 30)).toBe(15);
    expect(liveAt([seg(0, 20)], { done: 5, total: 10, unit: 'segments' }, 30)).toBe(20);
    // When the total and the duration are unknown, do not convert by segment count.
    expect(liveAt([seg(0, 3)], { done: 5, total: null, unit: 'segments' }, 30)).toBe(3);
    expect(liveAt([seg(0, 3)], { done: 5, total: 10, unit: 'segments' }, null)).toBe(3);
  });

  it('pending band runs from transcription position to media end; no pending band when transcription is done', () => {
    expect(livePending(0, 30)).toEqual({ start: 0, end: 30 });
    expect(livePending(12, 30)).toEqual({ start: 12, end: 30 });
    expect(livePending(30, 30)).toBeNull();
    expect(livePending(12, null)).toEqual({ start: 12, end: Infinity });
    expect(liveAt([seg(0, 4)], null, 30, true)).toBe(30);
    expect(livePending(liveAt([seg(0, 4)], null, 30, true), 30, true)).toBeNull();
  });
});

describe('liveTranscriptions', () => {
  const parent = job({ jobId: 'p1', kind: 'pipeline', assetId: null, submitter: { kind: 'agent', id: 'c1', taskId: 't1' } });
  const step = job({ jobId: 's1', submitter: { kind: 'pipeline', id: 'p1' } });

  it('looks up from the transcription job: includes the flow parent task; other videos and other kinds do not count', () => {
    const found = liveTranscriptions([parent, step, job({ jobId: 'x', videoId: 'v2' }), job({ jobId: 'e', kind: 'export' })], 'v1');
    expect(found).toEqual([{ assetId: 'a1', step, parent, running: true }]);
    expect(liveTranscriptions([parent, step], null)).toEqual([]);
  });

  it('still counts when transcription is done but the parent task is still running (building the subtitle layer), with running false; does not count once the parent task ends', () => {
    const done = { ...step, state: 'completed' as const, endedAt: '2026-10-01T09:05:00Z' };
    expect(liveTranscriptions([parent, done], 'v1')).toEqual([{ assetId: 'a1', step: done, parent, running: false }]);
    const ended = { ...parent, state: 'completed' as const, endedAt: '2026-10-01T09:06:00Z' };
    expect(liveTranscriptions([ended, done], 'v1')).toEqual([]);
    // A transcription submitted directly, with no parent task, ends when it finishes.
    expect(liveTranscriptions([{ ...done, submitter: { kind: 'connection', id: 'x' } }], 'v1')).toEqual([]);
  });

  it('when the same media was retried, the latest attempt is used', () => {
    const retry = job({ jobId: 's2', submitter: { kind: 'pipeline', id: 'p1' }, createdAt: '2026-10-01T09:01:00Z' });
    expect(liveTranscriptions([parent, step, retry], 'v1').map((t) => t.step.jobId)).toEqual(['s2']);
  });
});

describe('temporary row is drawn only for the first transcription; no blank beat at wrap-up', () => {
  it('not drawn when the timeline already has subtitles for this media or a transcript already existed before starting (re-transcription)', () => {
    const documents = { cap: doc('cap', 'caption', '2026-10-01T09:10:00Z'), other: doc('other', 'caption', '2026-10-01T08:00:00Z', 'a2') };
    expect(assetCaptioned(sequence([video('v', 0, 300, 0), caption('c', 'other')]), documents, 'a1')).toBe(false);
    expect(assetCaptioned(sequence([video('v', 0, 300, 0), caption('c', 'cap')]), documents, 'a1')).toBe(true);
    const speech = { sp: doc('sp', 'speech', '2026-10-01T09:05:00Z') };
    expect(transcribedBefore(speech, 'a1', '2026-10-01T09:00:00Z')).toBe(false);
    expect(transcribedBefore(speech, 'a1', '2026-10-01T09:06:00Z')).toBe(true);
    expect(transcribedBefore(speech, 'a2', '2026-10-01T09:06:00Z')).toBe(false);
  });

  it('walks through the real order: recognizing → transcript written to disk, segments dropped but kept → subtitle track appears / flow ends', () => {
    const parent = job({ jobId: 'p1', kind: 'pipeline', assetId: null });
    const running = job({ jobId: 's1', submitter: { kind: 'pipeline', id: 'p1' } });
    const done = {
      ...running,
      state: 'completed' as const,
      endedAt: '2026-10-01T09:05:00Z',
      result: { documentId: 'sp', artifactId: 'x' },
    };
    const segments = [seg(0, 4), seg(4, 9)];
    const first = { captioned: false, transcribedBefore: false };

    // 1. Recognizing: the paragraphs are in liveSegments. Drawn too when there are no paragraphs yet (services that do not stream): only the pending band.
    let held = holdSegments({}, { s1: segments }, {}, [parent, running]);
    expect(held).toEqual({});
    expect(liveRowShown({ running: true, segments: 0, ...first })).toBe(true);
    expect(liveRowShown({ running: true, segments: 2, ...first })).toBe(true);
    expect(liveTranscriptShown({ running: true, segments: 0, documentLanded: false })).toBe(true);

    // 2. Transcription Job completed: the reducer drops its paragraphs, but the parent task is still building the caption layer — keep them, and the temporary line keeps drawing; the script also keeps drawing until the transcript document lands in the video.
    held = holdSegments({ s1: segments }, {}, held, [parent, done]);
    expect(held).toEqual({ s1: segments });
    expect(liveTranscriptions([parent, done], 'v1')[0]!.running).toBe(false);
    expect(liveRowShown({ running: false, segments: held.s1!.length, ...first })).toBe(true);
    expect(liveTranscriptShown({ running: false, segments: 2, documentLanded: false })).toBe(true);
    // Transcript document arrives: the script panel switches to the formal script; the temporary line does not look at the transcript document (this transcription wrote it itself), and only waits for the caption track.
    expect(liveTranscriptShown({ running: false, segments: 2, documentLanded: true })).toBe(false);
    expect(liveRowShown({ running: false, segments: 2, captioned: false, transcribedBefore: false })).toBe(true);

    // 3a. Caption track appears: the temporary line collapses.
    expect(liveRowShown({ running: false, segments: 2, captioned: true, transcribedBefore: false })).toBe(false);

    // 3b. The flow ends (flows that do not build a caption layer also reach here): the retained paragraphs are released, and this transcription no longer counts as in progress.
    const ended = { ...parent, state: 'completed' as const, endedAt: '2026-10-01T09:06:00Z' };
    held = holdSegments({}, {}, held, [ended, done]);
    expect(held).toEqual({});
    expect(liveTranscriptions([ended, done], 'v1')).toEqual([]);
  });

  it('no empty row when transcription finishes with no segments; cancelled or failed segments are not kept', () => {
    expect(liveRowShown({ running: false, segments: 0, captioned: false, transcribedBefore: false })).toBe(false);
    const parent = job({ jobId: 'p1', kind: 'pipeline', assetId: null });
    const cancelled = job({ jobId: 's1', state: 'cancelled', submitter: { kind: 'pipeline', id: 'p1' } });
    expect(holdSegments({ s1: [seg(0, 1)] }, {}, {}, [parent, cancelled])).toEqual({});
  });

  it('returns the same object when nothing changed (subscribers do not redraw)', () => {
    const held = {};
    expect(holdSegments({}, {}, held, [])).toBe(held);
  });
});

describe('projected onto the timeline', () => {
  it('segments projected onto the sequence through instances using this media: trimmed parts do not appear, offset instances are placed correctly', () => {
    // Material 0–10 s placed at sequence 0–5 s (taking 0–5), material 20–30 s placed at sequence 5–10 s.
    const seq = sequence([video('v1', 0, 150, 0), video('v2', 150, 150, 20)]);
    const segments = [seg(1, 3, 'a'), seg(6, 8, 'cut'), seg(21, 24, 'b'), seg(4, 22, 'across')];
    const placed = placeSegments(seq, 'a1', segments);
    expect(placed.map((p) => [p.text, p.index, p.start, p.end])).toEqual([
      ['a', 0, 1, 3],
      ['across', 3, 4, 5],
      ['across', 3, 5, 7],
      ['b', 2, 6, 9],
    ]);
    // Fetching the same batch of paragraphs on the same sequence version again gives the same result.
    expect(placeSegments(seq, 'a1', segments)).toBe(placed);
  });

  it('the pending band is also cut into pieces per instance; when the duration is unknown it extends to the instance end', () => {
    const seq = sequence([video('v1', 0, 150, 0), video('v2', 150, 150, 20)]);
    expect(placePending(seq, 'a1', { start: 3, end: 30 })).toEqual([
      { start: 3, end: 5 },
      { start: 5, end: 10 },
    ]);
    expect(placePending(seq, 'a1', { start: 22, end: Infinity })).toEqual([{ start: 7, end: 10 }]);
    expect(placePending(seq, 'a1', null)).toEqual([]);
  });
});

describe('read-only script row', () => {
  const subtitleTrack: Track = { id: 's1', order: 2, kind: 'subtitle', locked: false, visible: true, muted: false, solo: { enabled: false, group: 'visual' } };
  const speechBody = {
    schema: 'cuccut.speech/1',
    timescale: 1000,
    words: [
      { id: 'w1', text: '第一句。', start: 1000, end: 3000 },
      { id: 'w2', text: '第二句。', start: 21000, end: 24000 },
    ],
    sentences: [
      { id: 's1', wordIds: ['w1'] },
      { id: 's2', wordIds: ['w2'] },
    ],
  };

  it('transcribed with no subtitle tracks at all: one row per used media, using the latest transcript', () => {
    const seq = sequence([video('v1', 0, 150, 0)]);
    const documents = { old: doc('old', 'speech', '2026-01-01'), now: doc('now', 'speech', '2026-02-01'), cap: doc('cap', 'caption', '2026-03-01') };
    expect(transcriptRows(seq, documents, new Set())).toEqual([{ assetId: 'a1', speech: documents.now }]);
  });

  it('not drawn when: has a subtitle track, no transcript, media not on the timeline, or a temporary transcription row is being drawn', () => {
    const seq = sequence([video('v1', 0, 150, 0)]);
    const documents = { now: doc('now', 'speech', '2026-02-01') };
    expect(transcriptRows({ ...seq, tracks: [subtitleTrack] }, documents, new Set())).toEqual([]);
    expect(transcriptRows(seq, { cap: doc('cap', 'caption', '2026-03-01') }, new Set())).toEqual([]);
    expect(transcriptRows(seq, { other: doc('other', 'speech', '2026-02-01', 'a2') }, new Set())).toEqual([]);
    expect(transcriptRows(seq, documents, new Set(['a1']))).toEqual([]);
  });

  it('sentences split by subtitle line breaks, projected onto the sequence through instances: cut parts do not appear', () => {
    // Material 0–5 s placed at sequence 0–5 s, material 20–25 s placed at sequence 5–10 s.
    const seq = sequence([video('v1', 0, 150, 0), video('v2', 150, 150, 20)]);
    const placed = placeTranscript(seq, 'a1', speechBody);
    expect(placed.map((p) => [p.text, p.index, p.start, p.end])).toEqual([
      ['第一句。', 0, 1, 3],
      ['第二句。', 1, 6, 9],
    ]);
    expect(placeTranscript(seq, 'a1', undefined)).toEqual([]);
    expect(placeTranscript(seq, 'a1', { schema: 'cuccut.caption/1' })).toEqual([]);
  });
});
