import type { Sequence, TransactionReceipt } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ToastQueue } from '@react-spectrum/s2';
import {
  addChapterOperation,
  moveChapterOperation,
  removeChapterOperation,
  renameChapterOperation,
  sequenceChapters,
  type ChapterSpan,
} from '../../model/chapters.ts';
import { CHAPTER_COPY as C } from './chapter-copy.ts';
import type { EditorActions } from './editor-context.tsx';

/**
 * Chapter editing commands: shared by the chapter bar, the context menu and the chapter header line in the transcript. Each step is one edit transaction (`apply`), named on the undo stack. After adding, renaming or deleting, a toast with “Undo” appears, which undoes that one operation (not the top of the stack). Dragging a start point, like dragging a clip edge, shows no toast.
 */

const TOAST_MS = 2500;

/** The previous toast with undo: when a new one appears, the old one is closed (S2 toasts with actions do not dismiss themselves). */
let closeUndoToast: (() => void) | null = null;

function undoToast(actions: EditorActions, message: string, receipt: TransactionReceipt): void {
  closeUndoToast?.();
  const close = ToastQueue.positive(message, {
    actionLabel: C.undo,
    onAction: () => void actions.undo({ transaction: receipt.transactionId }),
    shouldCloseOnAction: true,
    onClose: () => {
      if (closeUndoToast === close) closeUndoToast = null;
    },
  });
  closeUndoToast = close;
}

export async function addChapter(actions: EditorActions, sequence: Sequence, frame: number, title: string): Promise<boolean> {
  const result = addChapterOperation(sequence, sequenceChapters(sequence), frame, title);
  if (!result.ok) {
    ToastQueue.neutral(C.refusal[result.reason], { timeout: TOAST_MS });
    return false;
  }
  const receipt = await actions.apply([result.operation], EditLabel.addChapter());
  if (receipt) undoToast(actions, C.added(title.trim()), receipt);
  return !!receipt;
}

export async function renameChapter(actions: EditorActions, sequence: Sequence, chapter: ChapterSpan, title: string): Promise<boolean> {
  const operation = renameChapterOperation(sequence.id, chapter, title);
  if (!operation) return false;
  const receipt = await actions.apply([operation], EditLabel.renameChapter());
  if (receipt) undoToast(actions, C.renamed(title.trim()), receipt);
  return !!receipt;
}

export async function removeChapter(actions: EditorActions, sequence: Sequence, chapter: ChapterSpan): Promise<boolean> {
  const receipt = await actions.apply([removeChapterOperation(sequence.id, chapter)], EditLabel.removeChapter());
  if (receipt) undoToast(actions, C.removed(chapter.title), receipt);
  return !!receipt;
}

/** Moves the start point (the caller has already clamped it with `startBounds`). */
export async function moveChapter(actions: EditorActions, sequence: Sequence, chapter: ChapterSpan, frame: number): Promise<boolean> {
  const operation = moveChapterOperation(sequence.id, chapter, frame);
  if (!operation) return false;
  return !!(await actions.apply([operation], EditLabel.moveChapter()));
}
