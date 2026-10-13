import { formatRef, PUBLISHING_PREPARE_MAX, type Id, type PublicationRow, type PublishingBatchItemResult } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';

/*
 * The batch dialog (design `docs/cuccut/m2-publishing.md` §2.1 flow 8): prepare one publication per video (or take the Unscheduled selection), page
 * through them with a "Reviewed this publication" tick each, reserve slots for all, then "Send N publications" or "Approve for agent". A tick
 * counts only for the revision it was given for (any change, including a pinned export or a reserved slot, makes a new revision).
 */

/** Where a batch starts: videos to prepare (the shorts result page) or publications that already exist (the calendar's Unscheduled selection). */
export type BatchSource = { kind: 'videos'; videoIds: Id[]; origin?: string } | { kind: 'publications'; publicationIds: Id[] };

/** `reviewed[publicationId]` = the revision the owner ticked "Reviewed this publication" for. */
export type BatchReviews = Record<Id, number>;

/** Splits a list into requests the Runtime accepts (`publishing.prepare` takes at most 50 videos). */
export function chunks<T>(list: readonly T[], size: number = PUBLISHING_PREPARE_MAX): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** The revision the mirror holds for a publication, or null. */
export function rowRevision(rows: readonly PublicationRow[], id: Id): number | null {
  return rows.find((row) => row.id === id)?.revision ?? null;
}

/** Whether the tick still counts: it was given for the revision the publication has now. */
export function isBatchReviewed(id: Id, reviews: BatchReviews, rows: readonly PublicationRow[]): boolean {
  const revision = rowRevision(rows, id);
  return revision !== null && reviews[id] === revision;
}

export function reviewedCount(ids: readonly Id[], reviews: BatchReviews, rows: readonly PublicationRow[]): number {
  return ids.filter((id) => isBatchReviewed(id, reviews, rows)).length;
}

/** The items of a `publishing.batch` call: each publication with the revision read (the mirror's). Missing publications are left out. */
export function batchItems(ids: readonly Id[], rows: readonly PublicationRow[]): { publicationId: Id; revision: number }[] {
  return ids.flatMap((id) => {
    const revision = rowRevision(rows, id);
    return revision === null ? [] : [{ publicationId: id, revision }];
  });
}

export interface BatchContext {
  ids: readonly Id[];
  reviews: BatchReviews;
  rows: readonly PublicationRow[];
  owner: boolean;
  readOnly: boolean;
  busy: boolean;
  /** The publication on screen has unsaved edits. */
  dirty: boolean;
}

/** Why "Send N publications" and "Approve for agent" are not available, or null. Checked in the order the owner fixes them. */
export function batchSendBlock(context: BatchContext): string | null {
  if (!context.ids.length) return PC.batch.empty;
  if (context.busy) return PC.form.busy;
  if (!context.owner) return PC.form.webOnly;
  if (context.readOnly) return PC.form.readOnly;
  if (context.dirty) return PC.form.needsSave;
  if (reviewedCount(context.ids, context.reviews, context.rows) < context.ids.length) return PC.batch.needsReviewAll;
  return null;
}

/** Why "Reserve slots" is not available, or null. */
export function batchReserveBlock(context: Pick<BatchContext, 'ids' | 'readOnly' | 'busy' | 'dirty'> & { slots: number }): string | null {
  if (!context.ids.length) return PC.batch.empty;
  if (context.busy) return PC.form.busy;
  if (context.readOnly) return PC.form.readOnly;
  if (context.dirty) return PC.form.needsSave;
  if (!context.slots) return PC.form.reserveNeedsSlots;
  return null;
}

/** Why the pager cannot leave the publication on screen, or null. */
export function pageBlock(context: { dirty: boolean; busy: boolean }): string | null {
  if (context.busy) return PC.form.busy;
  if (context.dirty) return PC.batch.needsSavePage;
  return null;
}

/** The next page, kept within the list. */
export function stepPage(page: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, page + delta));
}

/** What a batch send or approval did: how many were accepted and one line per refused publication ("label: reason"). */
export function batchOutcome(results: readonly PublishingBatchItemResult[], labelOf: (id: Id) => string): { accepted: number; failures: string[] } {
  const accepted = results.filter((r) => r.ok).length;
  const failures = results
    .filter((r) => !r.ok)
    .map((r) => PC.batch.itemFailed(labelOf(r.publicationId), r.error ? (r.error.messageRef ? formatRef(r.error.messageRef, r.error.message) : r.error.message) : ''));
  return { accepted, failures };
}

/** The list after "Prepare a new release" replaced one publication with its new release (in place, so the page stays). */
export function replaceId(ids: readonly Id[], from: Id, to: Id): Id[] {
  if (ids.includes(to)) return ids.filter((id) => id !== from);
  return ids.map((id) => (id === from ? to : id));
}
