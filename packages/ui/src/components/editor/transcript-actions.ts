import type { Rate, TransactionReceipt } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import type { RetimePlan } from '../../model/cut-bands.ts';
import type { CutPlan, RestorePlan } from '../../model/transcript-cut.ts';
import { CUT_BAND_COPY } from './cut-band-copy.ts';
import type { EditorActions } from './editor-context.tsx';
import { TRANSCRIPT_COPY as C } from './transcript-copy.ts';

/**
 * Shared submission for the transcript panel and the timeline cut: one transaction, with an “Undo” hint after it lands. When the engine rejects it (track locked `TARGET_LOCKED`, overlap, and so on), the editor reports the error uniformly, so it is not repeated here. Things that can't be done (worked out first in the model layer) say why.
 */

type Actions = Pick<EditorActions, 'apply' | 'undo'>;

function undoable(actions: Actions, receipt: TransactionReceipt, message: string) {
  ToastQueue.positive(message, {
    timeout: 5000,
    actionLabel: C.undo,
    onAction: () => void actions.undo({ transaction: receipt.transactionId }),
    shouldCloseOnAction: true,
  });
}

export async function applyCut(actions: Actions, plan: CutPlan, fps: Rate): Promise<boolean> {
  if (!plan.ok) {
    ToastQueue.neutral(plan.reason === 'nothing' ? C.cutNothing : C.cutTooShort, { timeout: 4000 });
    return false;
  }
  const receipt = await actions.apply(plan.operations, EditLabel.cutText());
  if (!receipt) return false;
  undoable(actions, receipt, C.cutDone((plan.frames * fps.den) / fps.num, plan.ranges.length));
  return true;
}

/**
 * Restoring is a new transaction, not an undo (AT-08): supplementary footage added later isn't affected. A cut that can't find its seam and was only removed from the cut set (`cutsNotRelaid` in the receipt) gets a note saying so.
 */
export async function applyRestore(actions: Actions, plan: RestorePlan): Promise<boolean> {
  if (!plan.ok) {
    ToastQueue.neutral(C.restoreRefused[plan.reason], { timeout: 6000 });
    return false;
  }
  const receipt = await actions.apply(plan.operations, EditLabel.restoreText());
  if (!receipt) return false;
  const done = C.restoreDone(plan.seconds);
  undoable(actions, receipt, receipt.impact.cutsNotRelaid?.length ? `${done} · ${C.restoreNotRelaid}` : done);
  return true;
}

/**
 * Dragging a cut band's edge to change the cut range (prototype editor-cuts.jsx `retime`): restoring this spot plus cutting the new range is one transaction, undone in one step. Dragged to zero width, it is a restore and is reported as one. `before` is the original cut length, in seconds.
 */
export async function applyRetime(actions: Actions, plan: RetimePlan | null, fps: Rate, before: number): Promise<boolean> {
  if (!plan) return false;
  if (!plan.ok) {
    ToastQueue.neutral(C.restoreRefused[plan.reason], { timeout: 6000 });
    return false;
  }
  if (plan.frames === 0) return applyRestore(actions, plan.restore);
  const receipt = await actions.apply(plan.operations, EditLabel.retimeCut());
  if (!receipt) return false;
  undoable(actions, receipt, CUT_BAND_COPY.retimed(before, (plan.frames * fps.den) / fps.num));
  return true;
}

// ---- Transcript find and replace, copy, chapter move, and chapter cut (design draft panels.jsx `TranscriptPanel`, `ParaRow`, `ScopeMenu`) ----
// This file only grows at the end: new imports are written here.

import type { EditOperation } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import type { ChapterCutRefusal, ChapterSpan, ParagraphMove } from '../../model/chapters.ts';
import { TRANSCRIPT_TOOLS_COPY as T } from './transcript-copy.ts';

/** Put on the clipboard. On success it says what was copied (`done`; null means no pop-up, and the caller shows its own indication, such as the check mark in the export preview). If the browser refuses, it says so plainly. */
export async function copyToClipboard(text: string, done: string | null): Promise<boolean> {
  if (!text.trim()) {
    ToastQueue.neutral(T.copyEmpty, { timeout: 3000 });
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ToastQueue.negative(T.copyFailed, { timeout: 5000 });
    return false;
  }
  if (done !== null) ToastQueue.positive(done, { timeout: 3000 });
  return true;
}

/** Find and replace: each of several transcripts gets a new version (`putDocument`), in the same transaction, undone in one step. Audio and picture are untouched. */
export async function applyTextReplace(actions: Actions, operations: EditOperation[], count: number): Promise<boolean> {
  if (!operations.length || !count) {
    ToastQueue.neutral(T.replaceNothing, { timeout: 3000 });
    return false;
  }
  const receipt = await actions.apply(operations, EditLabel.replaceText());
  if (!receipt) return false;
  undoable(actions, receipt, T.replaceDone(count));
  return true;
}

/** Move a paragraph to the adjacent chapter: moves that chapter boundary (`upsertChapter`), and neighbors on the same side move with it. The caller explains first if it can't be moved. */
export async function applyParagraphMove(actions: Actions, move: ParagraphMove): Promise<boolean> {
  const receipt = await actions.apply([move.operation], EditLabel.moveText());
  if (!receipt) return false;
  undoable(actions, receipt, T.moved(move.to.title, move.moved));
  return true;
}

/** Cut a chapter: `removeRange`, plus a delete marker, plus shifting the following chapters forward, as one transaction. */
export async function applyChapterCut(
  actions: Actions,
  chapter: ChapterSpan,
  plan: { ok: true; operations: EditOperation[]; frames: number } | { ok: false; reason: ChapterCutRefusal },
  fps: Rate,
): Promise<boolean> {
  if (!plan.ok) {
    ToastQueue.neutral(T.cutChapterRefused[plan.reason], { timeout: 5000 });
    return false;
  }
  const receipt = await actions.apply(plan.operations, EditLabel.cutChapter());
  if (!receipt) return false;
  undoable(actions, receipt, T.cutChapterDone(chapter.title, (plan.frames * fps.den) / fps.num));
  return true;
}
