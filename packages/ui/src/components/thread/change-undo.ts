import { RpcError, isEngineErrorBody, newId, type FileTarget, type Id } from '@cuccut/protocol';
import type { CucCutClient } from '@cuccut/client';

export interface BackgroundUndoDeps {
  request: CucCutClient['request'];
  /**
   * The editor in this window is holding this video right now (it is opening it, or already has it open). If so, the undo does not close it on the editor's behalf:
   * the Runtime records who opened the video per connection; closing it once on the same connection would also drop the editor's open.
   */
  editorHolds: (target: FileTarget, videoId: Id) => boolean;
}

export type BackgroundUndoResult =
  /** Undone: `transactionId` is the newly written compensating transaction. */
  | { kind: 'undone'; transactionId: Id }
  /** Already undone earlier (in another window, or by the agent itself): `transactionId` is that undo. */
  | { kind: 'already-undone'; transactionId: Id };

/**
 * Undo for a change card when the video is not open in the editor: open the video in the background, undo the transaction, then close it again (the `{ transaction }` target in command and protocol spec §8).
 * Undo conflicts (the same objects were edited afterwards) are judged by the engine and thrown to the caller unchanged.
 *
 * Unverified: if the editor happens to start opening the same video while it is open in the background, this close may reach the Runtime before the editor's open. The editor would then receive `video.closed` and reopen the video itself (already handled by video-controller). The picture flickers, but no data is lost.
 */
export async function undoInBackground(deps: BackgroundUndoDeps, target: FileTarget, transaction: Id): Promise<BackgroundUndoResult> {
  const { ref } = await deps.request('videos.open', target);
  try {
    const { receipt } = await deps.request('edits.undo', { videoId: ref.videoId, commandId: newId('cmd'), target: { transaction } });
    return { kind: 'undone', transactionId: receipt.transactionId };
  } catch (error) {
    const undoneBy = alreadyUndoneBy(error);
    if (undoneBy) return { kind: 'already-undone', transactionId: undoneBy };
    throw error;
  } finally {
    if (!deps.editorHolds(target, ref.videoId)) await deps.request('videos.close', { videoId: ref.videoId }).catch(() => {});
  }
}

/** The engine's `UNDO_UNAVAILABLE` (“this change has already been undone”) carries the undo that did it (`details.undoneBy`). */
export function alreadyUndoneBy(error: unknown): Id | null {
  if (!(error instanceof RpcError) || !isEngineErrorBody(error.details)) return null;
  const body = error.details;
  if (body.code !== 'UNDO_UNAVAILABLE') return null;
  const by = (body.details as { undoneBy?: unknown } | null | undefined)?.undoneBy;
  return typeof by === 'string' && by ? by : null;
}
