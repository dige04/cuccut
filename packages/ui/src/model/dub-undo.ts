import type { DocumentRecord, EditOperation, Id, Sequence } from '@cuccut/protocol';

/**
 * “撤销这组配音” (undo this dub group) on the translated-dub receipt. The Runtime applies a dub group in one transaction: the imported synthesized audio, the new dub track, instances with `groupId`, the dub plan document, `mute` for the original-sentence instances, and `duck` for a ducking rule. So the preferred step is to undo that whole transaction (`videos.undo`), which removes the track and the document together. If the video has changed since and the undo is refused (`UNDO_CONFLICT`), it falls back to what can still be done: delete this group's instances (including the separated background), restore the instances this dub muted, and remove the ducking triggered by the dub track. The protocol has no operation to delete a track or a document, so the (empty) dub track and the dub plan document are left behind.
 */

export const DUB_EXTENSION = 'cuccut.dub';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The transaction that wrote the dub plan: the `createdBy` of the document's earliest version (written when the dub was applied; later in-place edits are later versions). */
export function planTransaction(record: Pick<DocumentRecord, 'revisions'> | undefined): Id | null {
  if (!record) return null;
  let first: { createdAt: string; createdBy: Id } | null = null;
  for (const revision of Object.values(record.revisions)) {
    if (!revision?.createdBy) continue;
    if (!first || revision.createdAt < first.createdAt) first = revision;
  }
  return first?.createdBy ?? null;
}

/** The instances muted by this action, recorded in the dub plan (those already muted before are not in it). */
export function mutedItemsOf(planBody: unknown): Id[] {
  if (!isObject(planBody) || !isObject(planBody.extensions)) return [];
  const own = planBody.extensions[DUB_EXTENSION];
  if (!isObject(own) || !Array.isArray(own.mutedItemIds)) return [];
  return own.mutedItemIds.filter((id): id is Id => typeof id === 'string' && id !== '');
}

/** Whether an instance belongs to this dub group. Both the dub and the separated background carry `extensions['cuccut.dub'].groupId`. */
export function inDubGroup(item: { extensions?: Record<string, unknown> }, groupId: string): boolean {
  const own = item.extensions?.[DUB_EXTENSION];
  return isObject(own) && own.groupId === groupId;
}

export interface FallbackUndo {
  operations: EditOperation[];
  /** The counts of deleted instances, instances whose sound was restored, and ducking rules removed. */
  removed: number;
  unmuted: number;
  ducking: number;
}

/**
 * Partial undo when the whole transaction cannot be undone: in one transaction, delete this group's instances (locked ones are still listed; if the whole transaction is rejected, the editor gives the reason), restore the sound of instances still muted by this action (the ones the user already restored by hand are left alone), and remove the ducking triggered by this dub track. If nothing is left, the operation is empty.
 */
export function fallbackUndoOperations(sequence: Sequence, group: { groupId: string; trackId: Id }, mutedItemIds: readonly Id[]): FallbackUndo {
  const operations: EditOperation[] = [];
  const itemIds = sequence.items.filter((item) => inDubGroup(item, group.groupId)).map((item) => item.id);
  if (itemIds.length > 0) operations.push({ type: 'deleteItems', sequenceId: sequence.id, itemIds });
  const muted = new Set(mutedItemIds);
  let unmuted = 0;
  for (const item of sequence.items) {
    if (!muted.has(item.id)) continue;
    const silent = item.type === 'audio' ? item.mix.muted === true : item.type === 'video' ? !item.embeddedAudio.enabled : false;
    if (!silent) continue;
    operations.push({ type: 'setAudioMix', sequenceId: sequence.id, itemId: item.id, muted: false });
    unmuted++;
  }
  const rules = (sequence.ducking ?? []).filter((rule) => rule.trigger.kind === 'items' && rule.trigger.trackIds?.includes(group.trackId));
  for (const rule of rules) operations.push({ type: 'removeDucking', sequenceId: sequence.id, ruleId: rule.id });
  return { operations, removed: itemIds.length, unmuted, ducking: rules.length };
}
