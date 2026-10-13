import type { AssetRecord, AudioItem, EditOperation, Id, MediaTime, Sequence, SequenceItemInput } from '@cuccut/protocol';
import { mediaTimeToSeconds } from '@cuccut/protocol';
import { durationSeconds } from './editor.ts';
import { M } from './tools-music-copy.ts';

/**
 * Music bed fills the video (product design §2.7 “generate soundtrack”, architecture design §7.9 “bed-laying for generated soundtrack”; design draft model-music.js `loopLayout`):
 * when the video is longer than a single generation's cap, only one segment of the cap length is generated; when added to the video, segments are laid end to end in a loop to fill it. The next segment comes in `crossfade` seconds before the previous one ends, and the two crossfade.
 * The last segment is cut at the end of the video, with a fade-out at the end; no stretching, no change of tempo. Instances on the same track cannot overlap (video format spec §3.4), so seams alternate between two music tracks.
 * Fades all fall within instance [0, 5] seconds, and their sum does not exceed the clip length (§3.9).
 * Writing is one transaction: `addTrack` (one or two music tracks) plus one `insertItems`, with one audio instance per segment carrying `playDuration` (this is the cut) and `mix` fades.
 * One undo reverts the whole thing.
 */

export const LOOP = { crossfade: 2, tailFade: 3 } as const;

/** Role of a music instance added to the video (open vocabulary, §3.1). */
export const MUSIC_ROLE = 'music';
/** Extension carried by each segment laid down (the engine does not interpret it): which “generate soundtrack” job laid it. A video keeps only one music bed: when laying a new one, delete the previous one first. */
export const SOUNDTRACK_EXTENSION = 'cuccut.soundtrack';

export interface LoopPiece {
  /** Start point and length on the sequence (seconds, precise to milliseconds). */
  start: number;
  dur: number;
  /** The two alternating music tracks: 0 / 1. */
  lane: 0 | 1;
  fadeIn: number;
  fadeOut: number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** Round down to milliseconds: the length laid must not exceed the source and must not go past the end of the sequence. */
const floorMs = (n: number) => Math.floor(n * 1000 + 1e-6) / 1000;

/**
 * A `pieceSec`-second piece of music fills `totalSec` seconds: each segment plays from the start of the music, and the next comes in `crossfade` seconds before the previous one ends.
 * The last segment is cut at the end of the video and has a fade-out; if the music is longer than the video, there is only one segment. Empty table if the duration does not hold.
 */
export function loopLayout(pieceSec: number, totalSec: number, opts: Partial<typeof LOOP> = {}): LoopPiece[] {
  const o = { ...LOOP, ...opts };
  const piece = Number(pieceSec);
  const total = Number(totalSec);
  if (!(piece > 0) || !(total > 0)) return [];
  const xf = Math.min(o.crossfade, piece / 4);
  const out: LoopPiece[] = [];
  let start = 0;
  for (;;) {
    const dur = Math.min(piece, total - start);
    out.push({ start: r3(start), dur: r3(dur), lane: out.length % 2 === 0 ? 0 : 1, fadeIn: out.length ? r3(xf) : 0, fadeOut: 0 });
    if (start + piece >= total) break;
    start += piece - xf;
  }
  out.forEach((s, i) => {
    if (i < out.length - 1) s.fadeOut = r3(xf);
  });
  const last = out[out.length - 1]!;
  last.fadeOut = r3(Math.min(o.tailFade, Math.max(0, last.dur - last.fadeIn)));
  return out;
}

/** One sentence after adding to the video: “Looped 3 segments to fill 742 s · 2 s crossfade at seams · 3 s fade-out at end”; with only one segment, only the end fade-out is mentioned. */
export function loopSummary(layout: readonly LoopPiece[], totalSec: number): string {
  if (!layout.length) return '';
  const tail = M.tailFade(layout[layout.length - 1]!.fadeOut);
  if (layout.length === 1) return tail;
  return [M.loopPieces(layout.length, r3(totalSec)), M.seamCrossfade(layout[1]!.fadeIn), tail].join(' · ');
}

/** Actual duration (seconds) of the current version of the source; the music's length is what was produced, not the requested target. */
export function pieceSeconds(asset: AssetRecord): number | null {
  const duration = asset.revisions[asset.currentRevision]?.duration;
  return duration ? mediaTimeToSeconds(duration) : null;
}

/** Writes integer milliseconds as an exact time. */
const ms = (seconds: number): MediaTime => ({ ticks: String(Math.round(seconds * 1000)), timescale: 1000 });

/** `ref` of the new music track in the same transaction. */
const trackRef = (lane: 0 | 1) => `music-bed-${lane}`;

/** Music bed instances already laid on the timeline (with `SOUNDTRACK_EXTENSION`). */
export function soundtrackBedItems(sequence: Sequence): AudioItem[] {
  return sequence.items.filter((item): item is AudioItem => item.type === 'audio' && !!item.extensions?.[SOUNDTRACK_EXTENSION]);
}

/** Which jobs these music bed instances on the timeline come from. */
export function placedSoundtrackJobs(sequence: Sequence): Set<Id> {
  const out = new Set<Id>();
  for (const item of soundtrackBedItems(sequence)) {
    const mark = item.extensions?.[SOUNDTRACK_EXTENSION];
    const jobId = typeof mark === 'object' && mark !== null ? (mark as { jobId?: unknown }).jobId : undefined;
    if (typeof jobId === 'string') out.add(jobId);
  }
  return out;
}

/** Replace the previous music bed: delete its instances; the music tracks that held only them are deleted too (tracks with other content are kept). */
function replaceOperations(sequence: Sequence): EditOperation[] {
  const olds = soundtrackBedItems(sequence);
  if (!olds.length) return [];
  const ids = new Set(olds.map((o) => o.id));
  const emptied = sequence.tracks.filter((t) => t.kind === 'audio' && !t.locked && sequence.items.some((i) => i.trackId === t.id) && sequence.items.every((i) => i.trackId !== t.id || ids.has(i.id)));
  return [
    { type: 'deleteItems', sequenceId: sequence.id, itemIds: olds.map((o) => o.id) },
    ...emptied.map((t): EditOperation => ({ type: 'deleteTrack', sequenceId: sequence.id, trackId: t.id })),
  ];
}

/**
 * The single operation that loops this music across the whole video: computes the laying from the actual duration, creates the music track(s) needed (one or two), and one audio instance per segment
 * (from the start of the music, `playDuration` cuts it to the segment length, fades per the laying, with a `jobId` extension). The previous music bed is replaced in the same operation.
 * Duration is rounded down to milliseconds: the length laid does not exceed the source and does not go past the end of the sequence. null if the video has no duration, or the source is not audio or has no duration.
 */
export function musicBedOperations(sequence: Sequence, asset: AssetRecord, jobId: Id): { operations: EditOperation[]; layout: LoopPiece[]; totalSec: number } | null {
  if (asset.kind !== 'audio') return null;
  const piece = pieceSeconds(asset);
  const total = floorMs(durationSeconds(sequence));
  if (piece === null || !(piece > 0) || !(total > 0)) return null;
  const layout = loopLayout(floorMs(piece), total);
  if (!layout.length) return null;
  const { num, den } = sequence.fps;
  const lanes = [...new Set(layout.map((p) => p.lane))].sort();
  const items: SequenceItemInput[] = layout.map((p) => {
    // Split the start point into frames and an in-frame offset (video format spec §2.10): both are computed as integer milliseconds, with no floating point.
    const startMs = Math.round(p.start * 1000);
    const fromFrame = Math.floor((startMs * num) / (1000 * den));
    const subframeTicks = startMs * num - fromFrame * den * 1000;
    return {
      type: 'audio',
      trackRef: trackRef(p.lane),
      assetRef: { id: asset.id, revision: asset.currentRevision },
      fromFrame,
      subframeOffset: { ticks: String(subframeTicks), timescale: 1000 * num },
      playDuration: ms(p.dur),
      timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } },
      mix: { volume: 1, ...(p.fadeIn > 0 ? { fadeIn: ms(p.fadeIn) } : {}), ...(p.fadeOut > 0 ? { fadeOut: ms(p.fadeOut) } : {}) },
      name: asset.name,
      role: MUSIC_ROLE,
      extensions: { [SOUNDTRACK_EXTENSION]: { jobId } },
    };
  });
  const operations: EditOperation[] = [
    ...replaceOperations(sequence),
    ...lanes.map((lane): EditOperation => ({ type: 'addTrack', sequenceId: sequence.id, kind: 'audio', ref: trackRef(lane), name: M.musicTrack(lane + 1) })),
    { type: 'insertItems', sequenceId: sequence.id, items },
  ];
  return { operations, layout, totalSec: total };
}

/** This source is already on the timeline (the user placed it themselves): no automatic laying. */
export function assetOnTimeline(sequence: Sequence, assetId: Id): boolean {
  return sequence.items.some((item) => item.type === 'audio' && item.assetRef.id === assetId);
}
