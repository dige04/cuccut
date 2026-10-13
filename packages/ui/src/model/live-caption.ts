import { sequenceDurationFrames, type CaptionItem, type Sequence, type Track } from '@cuccut/protocol';
import type { FrozenDocument } from '../render/render-planner.ts';
import type { PlacedSegment } from './live-transcript.ts';
import { DEFAULT_CAPTION_STYLE } from './property-values.ts';

/*
 * Temporary captions on screen during transcription (prototype round 220 stage.jsx + model-transcript.js `liveCueView`; product design §5.7).
 *
 * The first transcription has no caption track yet, so the screen shows what has been recognized so far, as in the prototype: when the playhead falls in a recognized paragraph, that paragraph is drawn; parts not yet transcribed draw nothing.
 * Real data has no half-text (the prototype's inflight prefix), so a whole paragraph appears or does not appear.
 *
 * It is drawn by the same path as real captions: the preview engine overlays the one caption layer built here (one caption track, one caption document with `clock: 'sequence'`, default style)
 * onto the sequence sent to the rendering kernel, and the same `frame-render` draws it. This happens only in the preview engine: it is not written into the video, not put in undo, and not exported (export is drawn by the Runtime from the documents in the video). The IDs are all made by the interface, so they never collide with IDs the Runtime sends.
 */

export const LIVE_CAPTION_TRACK_ID = 'cc-live-caption-track';
export const LIVE_CAPTION_ITEM_ID = 'cc-live-caption';
export const LIVE_CAPTION_DOCUMENT_ID = 'cc-live-caption-document';
export const LIVE_CAPTION_STYLE_ID = 'cc-live-caption-style';

/** One sentence on screen (sequence seconds). */
export interface LiveCue {
  key: string;
  start: number;
  end: number;
  text: string;
}

/** Turns the live paragraphs projected onto the sequence into temporary caption sentences: removes blank paragraphs and zero-length blocks, and sorts them by start time. */
export function liveCaptionCues(placed: readonly Pick<PlacedSegment, 'key' | 'start' | 'end' | 'text'>[]): LiveCue[] {
  return placed
    .map((p) => ({ key: p.key, start: p.start, end: p.end, text: p.text.trim() }))
    .filter((cue) => cue.text && cue.end > cue.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Which sentence is on screen at this moment: if the playhead falls inside a paragraph (left-closed, right-open), it is that one; between paragraphs, and in parts not yet transcribed, it is null. */
export function liveCueAt(cues: readonly LiveCue[], seconds: number): LiveCue | null {
  for (const cue of cues) if (cue.start <= seconds && seconds < cue.end) return cue;
  return null;
}

/**
 * The sequence with the temporary caption layer overlaid: a caption track is added on top, with one caption layer covering the sequence's existing duration (the duration is not changed), and the times in the document are sequence times
 * (`scopeItemIds` empty). The sequence's ID and version are kept as they are — when edits are written back, they use the version of the real sequence.
 */
export function withLiveCaption(sequence: Sequence): Sequence {
  const frames = sequenceDurationFrames(sequence);
  if (frames <= 0) return sequence;
  const order = sequence.tracks.reduce((max, track) => Math.max(max, track.order), -1) + 1;
  const paintOrder = sequence.items.reduce((max, item) => Math.max(max, item.paintOrder), -1) + 1;
  const track: Track = {
    id: LIVE_CAPTION_TRACK_ID,
    order,
    kind: 'subtitle',
    locked: true,
    visible: true,
    muted: false,
    solo: { enabled: false, group: 'visual' },
  };
  const item: CaptionItem = {
    id: LIVE_CAPTION_ITEM_ID,
    trackId: LIVE_CAPTION_TRACK_ID,
    type: 'caption',
    enabled: true,
    locked: true,
    paintOrder,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame: 0, durationFrames: frames },
    documentId: LIVE_CAPTION_DOCUMENT_ID,
    styleDocumentId: LIVE_CAPTION_STYLE_ID,
    scopeItemIds: [],
  };
  return { ...sequence, tracks: [...sequence.tracks, track], items: [...sequence.items, item] };
}

/**
 * The two documents the temporary caption layer needs: the caption body (sequence clock, milliseconds) and the style. The style is the default preset `DEFAULT_CAPTION_STYLE`: when the last step of the transcription flow creates captions with no other style, this is the style used (the same as the default when the rendering kernel has no style document).
 */
export function liveCaptionDocuments(cues: readonly LiveCue[]): FrozenDocument[] {
  return [
    {
      documentId: LIVE_CAPTION_DOCUMENT_ID,
      kind: 'caption',
      schema: 'cuccut.caption/1',
      lineKind: 'original',
      body: {
        schema: 'cuccut.caption/1',
        clock: 'sequence',
        timescale: 1000,
        cues: cues.map((cue, index) => ({
          id: `live-${index}`,
          start: Math.round(cue.start * 1000),
          end: Math.max(Math.round(cue.start * 1000) + 1, Math.round(cue.end * 1000)),
          text: cue.text,
        })),
      },
    },
    {
      documentId: LIVE_CAPTION_STYLE_ID,
      kind: 'caption-style',
      schema: String(DEFAULT_CAPTION_STYLE.schema),
      body: DEFAULT_CAPTION_STYLE,
    },
  ];
}
