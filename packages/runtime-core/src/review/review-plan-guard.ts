import { REVIEW_PLAN_KIND, type DocumentRecord, type HistoryEntry, type Id, type UndoState } from '@cuccut/protocol';
import { RcReview } from '@cuccut/protocol/messages/runtime-core';

/**
 * Who may write the review gate's decisions document (kind `review-plan`, docs/cuccut/m2-review-gate.md §5).
 *
 * Letting a finding stand and lowering what it is worth are the user's call. The review service writes the document and
 * asks the user first; a generic edit (`documents_put`, `edits_apply`, `edits.apply` from an agent or an external service)
 * would make the same change without asking, and record it under any name. So generic edits by agents may not write it,
 * and an agent's undo of a review decision that would loosen the gate is asked like `review_waive`.
 */

/** Whether `operations` write the decisions document: a `putDocument` of that kind, or one aimed at the existing document. */
export function writesReviewPlan(operations: readonly unknown[], documents: Readonly<Record<Id, Pick<DocumentRecord, 'kind'>>>): boolean {
  for (const op of operations as { type?: unknown; kind?: unknown; documentId?: unknown }[]) {
    if (op?.type !== 'putDocument') continue;
    if (op.kind === REVIEW_PLAN_KIND) return true;
    if (typeof op.documentId === 'string' && documents[op.documentId]?.kind === REVIEW_PLAN_KIND) return true;
  }
  return false;
}

const WAIVE = RcReview.waiveLabel({ id: '' }).key;
const UNWAIVE = RcReview.unwaiveLabel({ id: '' }).key;
const SEVERITY = RcReview.severityLabel({ id: '' }).key;

/**
 * Whether undoing a transaction would loosen the gate: undoing "hold it again" or redoing "let it stand" brings a waiver
 * back, and undoing or redoing a severity change may lower it (asked either way). `transactionId` is the transaction undone
 * (undoing an undo is a redo of the forward change); without one, the caller's own latest step (`undoState.undo`).
 */
export function undoLoosensReview(
  transactionId: Id | undefined,
  lookup: { history?: readonly HistoryEntry[]; undoState?: UndoState },
): boolean {
  let key: string | undefined;
  let redo = false;
  if (transactionId === undefined) {
    key = lookup.undoState?.undo?.labelRef?.key;
  } else {
    const byId = new Map((lookup.history ?? []).map((entry) => [entry.transactionId, entry]));
    const entry = byId.get(transactionId);
    if (!entry) return false;
    redo = entry.undoDepth % 2 === 1;
    let forward = entry;
    for (let i = 0; forward.undoOf && i < 64; i++) {
      const next = byId.get(forward.undoOf);
      if (!next) break;
      forward = next;
    }
    key = forward.labelRef?.key ?? entry.labelRef?.key;
  }
  if (key === SEVERITY) return true;
  if (key === WAIVE) return redo;
  if (key === UNWAIVE) return !redo;
  return false;
}
