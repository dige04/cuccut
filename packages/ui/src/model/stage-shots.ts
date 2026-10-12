import { framesToSeconds, type EditOperation, type Id, type Sequence, type SequenceItem } from '@cuccut/protocol';
import { cropOperations } from './stage-gesture.ts';
import { isPannable, type PannableVideo } from './stage-pose.ts';

/**
 * 按镜头分段取景（产品设计 §5.10「改一支短视频」，原型 model-shorts-cut.js 的 `shotBadge` 与 stage-objects.jsx 的 `ShotChip`）：
 * 剪成短视频时按镜头取景的子视频里，主素材按镜头拆成几段视频，各带自己的裁剪（`videos_derive` 写的）。画布上选中其中一段时
 * 挂一枚小牌，说清楚拖的是哪一段；小牌上「套到整支」把这一段的裁剪写到同一素材的每一段。
 */

/** 和 `item` 一起分段取景的那几段：同一素材、铺满、`cover`、带裁剪的视频，按时间线先后排。`item` 本身不是这种视频时空表。 */
export function framingPieces(sequence: Sequence, item: SequenceItem): PannableVideo[] {
  if (!isPannable(item)) return [];
  const asset = item.assetRef.id;
  return sequence.items
    .filter((other): other is PannableVideo => isPannable(other) && other.assetRef.id === asset)
    .sort((a, b) => a.span.fromFrame - b.span.fromFrame);
}

/** 出不出小牌：这支视频的主素材拆成了不止一段取景，选中的是其中一段。 */
export function showsShotChip(sequence: Sequence, item: SequenceItem): boolean {
  const pieces = framingPieces(sequence, item);
  return pieces.length > 1 && pieces.some((piece) => piece.id === item.id);
}

/** 小牌上的秒：这一段在子视频时间线上的起止，取整，止至少比起多 1 秒（原型 `shotBadge`）。 */
export function shotSeconds(item: PannableVideo, sequence: Pick<Sequence, 'fps'>): { from: number; to: number } {
  const from = Math.round(framesToSeconds(item.span.fromFrame, sequence.fps));
  const to = Math.max(from + 1, Math.round(framesToSeconds(item.span.fromFrame + item.span.durationFrames, sequence.fps)));
  return { from, to };
}

/** 「套到整支」：把 `item` 现在的裁剪写到同一素材的其它几段（一笔事务）；已经一样的不写。 */
export function applyFramingToAll(sequenceId: Id, item: PannableVideo, pieces: readonly PannableVideo[]): EditOperation[] {
  return pieces.filter((piece) => piece.id !== item.id).flatMap((piece) => cropOperations(sequenceId, piece, item.crop));
}
