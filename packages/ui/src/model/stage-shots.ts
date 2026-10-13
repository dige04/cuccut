import { framesToSeconds, type EditOperation, type Id, type Sequence, type SequenceItem } from '@cuccut/protocol';
import { cropOperations } from './stage-gesture.ts';
import { isPannable, type PannableVideo } from './stage-pose.ts';

/**
 * Shot-by-shot framing (product design §5.10 “Edit a short video”; `shotBadge` in the prototype model-shorts-cut.js and `ShotChip` in stage-objects.jsx): in a sub-video framed shot by shot when cut into a short video, the main footage is split into several video segments by shot, each with its own crop (written by `videos_derive`). When one of these segments is selected on the canvas, a small badge is attached to make clear which segment is being dragged; the “Apply to whole clip” on the badge writes this segment's crop to every segment of the same asset.
 */

/** The segments framed together with `item`: videos from the same asset that are full-frame, `cover`, and cropped, ordered by timeline position. When `item` itself is not this kind of video, the table is empty. */
export function framingPieces(sequence: Sequence, item: SequenceItem): PannableVideo[] {
  if (!isPannable(item)) return [];
  const asset = item.assetRef.id;
  return sequence.items
    .filter((other): other is PannableVideo => isPannable(other) && other.assetRef.id === asset)
    .sort((a, b) => a.span.fromFrame - b.span.fromFrame);
}

/** Whether to show the badge: this video's main footage is split into more than one framed segment, and one of them is selected. */
export function showsShotChip(sequence: Sequence, item: SequenceItem): boolean {
  const pieces = framingPieces(sequence, item);
  return pieces.length > 1 && pieces.some((piece) => piece.id === item.id);
}

/** Seconds shown on the badge: the start and end of this segment on the sub-video timeline, rounded; the end is at least 1 second after the start (`shotBadge` in the prototype). */
export function shotSeconds(item: PannableVideo, sequence: Pick<Sequence, 'fps'>): { from: number; to: number } {
  const from = Math.round(framesToSeconds(item.span.fromFrame, sequence.fps));
  const to = Math.max(from + 1, Math.round(framesToSeconds(item.span.fromFrame + item.span.durationFrames, sequence.fps)));
  return { from, to };
}

/** “Apply to whole clip”: writes `item`'s current crop to the other segments of the same asset (one transaction); segments that already match are not written. */
export function applyFramingToAll(sequenceId: Id, item: PannableVideo, pieces: readonly PannableVideo[]): EditOperation[] {
  return pieces.filter((piece) => piece.id !== item.id).flatMap((piece) => cropOperations(sequenceId, piece, item.crop));
}
