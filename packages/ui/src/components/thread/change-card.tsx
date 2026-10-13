import { memo, useState } from 'react';
import { localizeText, type FileTarget, type Id, type TimelineItem } from '@cuccut/protocol';
import { AlertDialog, Button, DialogContainer, ToastQueue } from '@react-spectrum/s2';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import Undo from '@react-spectrum/s2/icons/Undo';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { T } from './thread-copy.ts';
import { CHANGE_COPY } from '../../copy.ts';
import { formatClock } from '../../model/format.ts';
import { changeUndoState, type LocalUndoAction } from '../../model/thread.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { sameTarget } from '../../runtime/video-controller.ts';
import { useShell } from '../../state/shell-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { undoInBackground } from './change-undo.ts';
import { useVideoHistory } from './use-video-history.ts';

type VideoChange = Extract<TimelineItem, { kind: 'video-change' }>;

/**
 * A receipt is one row inside the work-log box (prototype agent-messages.css `.asteps--box .arcpt`): it sets no background or border of its own; the row dividers come from the box. The icon is green while the change is in effect, and turns grey after it is undone.
 */
const row = style({ display: 'flex', flexDirection: 'column', gap: 4, paddingX: 12, paddingY: 4 });
const head = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 32 });
const icon = style({ display: 'flex', flexShrink: 0, color: { default: 'green-1100', isUndone: 'gray-600' } });
const title = style({
  flexGrow: 1,
  flexBasis: 0,
  minWidth: 0,
  font: 'ui-sm',
  fontWeight: 'medium',
  color: { default: 'gray-800', isUndone: 'gray-700' },
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const buttons = style({ display: 'flex', gap: 8, flexShrink: 0 });
const facts = style({ display: 'flex', flexWrap: 'wrap', columnGap: 8, font: 'ui-xs', color: 'gray-600', paddingStart: 28 });

function factsOf(item: VideoChange): string[] {
  const { before, after } = item.durationSeconds;
  return [
    item.createdIds.length ? T.change.added(item.createdIds.length) : '',
    item.updatedIds.length ? T.change.updated(item.updatedIds.length) : '',
    item.deletedIds.length ? T.change.deleted(item.deletedIds.length) : '',
    before === after
      ? T.change.duration(formatClock(after, { tenths: true }))
      : T.change.durationChange(formatClock(before, { tenths: true }), formatClock(after, { tenths: true })),
    T.change.revision(item.previousRevision, item.videoRevision),
  ].filter(Boolean);
}

/** The editor is holding this video right now (it is opening or already open). */
function editorHolds(target: FileTarget, videoId: Id): boolean {
  const video = useVideo.getState().video;
  return video !== null && (video.videoId === videoId || sameTarget(video.target, target));
}

/**
 * Change card (product design §6.5, prototype agent-steps.jsx `ReceiptStep`): one video edit that the agent submitted through a tool, shown as a row inside the expanded work-log box (steps-group.tsx). All content comes from the engine's receipt; the agent's own account is not used.
 *
 * - Undo: confirm first (prototype `ConfirmDialog`). When the editor has this video open, the undo goes through the editor's command queue; when it is not open, the video is opened in the background, undone and closed again (`undoInBackground`), so the video no longer needs to be open alongside. If the editor is in the middle of opening it, wait for that to finish first. Undo conflicts are judged by the engine.
 * - After undo, the card reads “已撤销 · 改动已还原” (Undone · changes reverted). “恢复” (Restore) is offered only when the editor has this video open and this edit's undo is exactly the top of the connection's “重做” (redo) stack. The top of the stack is only visible through `edits.undoState`, which the editor subscribes to. When it is not the top (the video has been edited since, or the undo was done by the agent), the compensating transaction for the undo is not necessarily the same as putting this step back, so no Restore is shown. Restore undoes that one transaction (`{ transaction }`) rather than sending `'redo'`: if the top of the stack has changed by the time it is pressed, it will not redo onto some other change either.
 * - The edit the agent undid itself (`undoOf`) is recorded as one line only, with no undo or restore.
 */
export const ChangeCard = memo(function ChangeCard({
  item,
  undone,
  conversationId,
}: {
  item: VideoChange;
  undone: boolean;
  conversationId: string;
}) {
  const runtime = useRuntime();
  const openHere = useVideo((s) => s.video !== null && (s.video.videoId === item.videoId || sameTarget(s.video.target, item.target)));
  const ready = useVideo((s) => s.video?.videoId === item.videoId && s.video.status === 'ready');
  const redo = useVideo((s) => (s.video?.videoId === item.videoId ? (s.video.undo.redo?.transactionId ?? null) : null));
  const history = useVideoHistory(item.videoId);
  const [local, setLocal] = useState<LocalUndoAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isUndoCard = Boolean(item.undoOf);
  const state = isUndoCard
    ? ({ state: 'applied' } as const)
    : changeUndoState({ transactionId: item.transactionId, undoneInThread: undone, local, history, redo });
  const isUndone = state.state === 'undone';
  const restoreTx = state.state === 'undone' ? state.restore : null;

  const undo = async () => {
    setBusy(true);
    try {
      if (ready) {
        const receipt = await runtime.videos.undo({ transaction: item.transactionId });
        if (!receipt) {
          const message = useVideo.getState().video?.commandError?.message ?? T.change.locked;
          ToastQueue.negative(CHANGE_COPY.undoFailed(message), { timeout: 5000 });
          return;
        }
        setLocal({ kind: 'undo', transactionId: receipt.transactionId });
        ToastQueue.neutral(CHANGE_COPY.undoneToast, { timeout: 3000 });
        return;
      }
      const result = await undoInBackground(
        { request: runtime.client.request.bind(runtime.client), editorHolds },
        item.target,
        item.transactionId,
      );
      setLocal({ kind: 'undo', transactionId: result.transactionId });
      ToastQueue.neutral(result.kind === 'undone' ? CHANGE_COPY.undoneToast : CHANGE_COPY.alreadyUndone, { timeout: 3000 });
    } catch (error) {
      ToastQueue.negative(CHANGE_COPY.undoFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (transaction: Id) => {
    setBusy(true);
    try {
      const receipt = await runtime.videos.undo({ transaction });
      if (!receipt) {
        const message = useVideo.getState().video?.commandError?.message ?? T.change.locked;
        ToastQueue.negative(CHANGE_COPY.restoreFailed(message), { timeout: 5000 });
        return;
      }
      setLocal({ kind: 'restore', transactionId: receipt.transactionId });
      ToastQueue.positive(CHANGE_COPY.restoredToast, { timeout: 3000 });
    } finally {
      setBusy(false);
    }
  };

  // Change names created by the engine carry references and are shown in the interface language; older cards and names supplied by callers are kept as they are (command and protocol spec §3.1).
  const changeLabel = localizeText(item.label, item.labelRef);
  const label = isUndone
    ? CHANGE_COPY.undone
    : (isUndoCard ? T.change.undoStep : T.change.changed)(item.videoName, changeLabel);
  const Icon = isUndone ? Undo : CheckmarkCircle;

  return (
    <li className={row} aria-label={T.change.aria(changeLabel)} data-role="video-change">
      <div className={head}>
        <span className={icon({ isUndone })} aria-hidden>
          <Icon />
        </span>
        <span className={title({ isUndone })} title={isUndone ? T.withDetail(label, changeLabel) : label}>
          {label}
        </span>
        <span className={buttons}>
          {isUndoCard ? null : isUndone ? (
            restoreTx ? (
              <Button
                size="S"
                variant="secondary"
                fillStyle="outline"
                isPending={busy}
                isDisabled={!ready}
                onPress={() => void restore(restoreTx)}>
                {CHANGE_COPY.restore}
              </Button>
            ) : null
          ) : (
            <Button size="S" variant="negative" isPending={busy} isDisabled={openHere && !ready} onPress={() => setConfirming(true)}>
              {CHANGE_COPY.undo}
            </Button>
          )}
          {!openHere ? (
            <Button
              size="S"
              variant="secondary"
              fillStyle="outline"
              onPress={() => useShell.getState().openVideo(item.target, { conversationId, projectId: null })}>
              {CHANGE_COPY.openVideo}
            </Button>
          ) : null}
        </span>
      </div>
      <div className={facts}>
        {factsOf(item).map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </div>
      <DialogContainer onDismiss={() => setConfirming(false)}>
        {confirming ? (
          <AlertDialog
            variant="destructive"
            title={CHANGE_COPY.confirmTitle}
            primaryActionLabel={CHANGE_COPY.undo}
            cancelLabel={CHANGE_COPY.cancel}
            onPrimaryAction={() => void undo()}>
            {CHANGE_COPY.confirmBody}
          </AlertDialog>
        ) : null}
      </DialogContainer>
    </li>
  );
});
