import type { ArrangeDirection, Id, Localized, Sequence, SequenceItem, TransactionReceipt, VideoItem, VideoSnapshot } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ToastQueue } from '@react-spectrum/s2';
import { TIMELINE_EDIT_COPY as COPY } from '../../copy.ts';
import { frameAt, itemFrames, itemLabel, rootSequence } from '../../model/editor.ts';
import { detachAudioOperations } from '../../model/detach-audio.ts';
import { arrangeOperation, deletableItemIds, itemsAtFrame, moveOperation, nudgeDelta, splitOperations } from '../../model/editor-ops.ts';
import { pasteOperations } from '../../model/item-clipboard.ts';
import { createdItemIds } from '../../model/new-items.ts';
import { fallbackUndoOperations, mutedItemsOf } from '../../model/dub-undo.ts';
import { dubGroups, muteOperations } from '../../model/timeline-dub.ts';
import { gapsAfterDelete, rippleOperations, selectionSpans, shiftFrame, type FrameSpan } from '../../model/timeline-ripple.ts';
import { langName } from '../../model/tools-models.ts';
import { useClipboard } from '../../state/clipboard-store.ts';
import { useEditor, type NudgeDraft } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { TIMELINE_DUB_COPY as DUB } from './dub-copy.ts';
import type { EditorActions } from './editor-context.tsx';
import { TIMELINE_RIPPLE_COPY as RIPPLE } from './timeline-ripple-copy.ts';

/**
 * Commands on selected clips on the timeline: keyboard shortcuts (video-editor's useEditorKeys) and the context menu (timeline-menu) share the same set, with the same undo record and the same notices (prototype editor-keys.jsx clipboard, `ctx.clipboard` in timeline-menu.jsx).
 * Both read the latest video and selection inside the event, rather than relying on closures from render time.
 */

/** Modifier key: ⌘ on macOS, Ctrl+ elsewhere. */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+';

const TOAST_MS = 2500;
/** Merge window for repeated ⌥←/→ presses: the change is committed only after this long without input (prototype history merge rule). */
export const NUDGE_WINDOW_MS = 900;

interface Live {
  videoId: Id;
  snapshot: VideoSnapshot;
  sequence: Sequence;
  editable: boolean;
}

function live(): Live | null {
  const video = useVideo.getState().video;
  const snapshot = video?.state?.video;
  const sequence = snapshot ? rootSequence(snapshot) : null;
  if (!video?.videoId || !snapshot || !sequence) return null;
  return { videoId: video.videoId, snapshot, sequence, editable: canEdit(video) };
}

/** Selected clips, ordered by track from bottom to top and by time: on paste the lower layers are placed first, so newly created tracks keep their original vertical order. */
function picked(sequence: Sequence): SequenceItem[] {
  const ids = new Set(useEditor.getState().selection);
  const order = new Map(sequence.tracks.map((track) => [track.id, track.order]));
  return sequence.items
    .filter((item) => ids.has(item.id))
    .sort(
      (a, b) =>
        (order.get(a.trackId) ?? 0) - (order.get(b.trackId) ?? 0) ||
        itemFrames(a, sequence.fps).start - itemFrames(b, sequence.fps).start,
    );
}

function say(message: string): void {
  ToastQueue.neutral(message, { timeout: TOAST_MS });
}

/** The previous notice with Undo: S2 notices with actions do not disappear on their own (leaving time for screen readers); when a new one appears, the old one is dismissed so they do not pile up. */
let closeUndoToast: (() => void) | null = null;

/** Notice with “Undo”: undoes this transaction, not the top of the stack (other things may have happened in the meantime). */
function undoToast(actions: EditorActions, message: string, receipt: TransactionReceipt): void {
  closeUndoToast?.();
  const close = ToastQueue.positive(message, {
    actionLabel: COPY.undo,
    onAction: () => void actions.undo({ transaction: receipt.transactionId }),
    shouldCloseOnAction: true,
    onClose: () => {
      if (closeUndoToast === close) closeUndoToast = null;
    },
  });
  closeUndoToast = close;
}

/** ⌘C: puts the selected clips on the clipboard. Returns how many were copied. */
export function copySelection(): number {
  const ctx = live();
  if (!ctx) return 0;
  const items = picked(ctx.sequence);
  if (!items.length) {
    say(COPY.pick(COPY.copy));
    return 0;
  }
  useClipboard.getState().put(ctx.videoId, items);
  ToastQueue.positive(COPY.copied(items.length), { timeout: TOAST_MS });
  return items.length;
}

/** ⌘X: copy then delete, one transaction, with an undo notice. */
export async function cutSelection(actions: EditorActions): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const items = picked(ctx.sequence);
  if (!items.length) return say(COPY.pick(COPY.cutItem));
  useClipboard.getState().put(ctx.videoId, items);
  const receipt = await actions.apply(
    [{ type: 'deleteItems', sequenceId: ctx.sequence.id, itemIds: items.map((item) => item.id) }],
    EditLabel.cutClips(),
  );
  if (!receipt) return;
  useEditor.getState().select([]);
  undoToast(actions, COPY.cut(items.length), receipt);
}

/**
 * Delete: deletes the selected clips, and any stretches among the deleted ones where every track is now empty are closed up as well (model/timeline-ripple.ts). Same transaction, one undo record,
 * with an undo notice. Keyboard, transport, inspector and the context menu all go through this one path; which clips can be deleted is determined by `deletableItemIds`.
 */
export async function deleteSelection(actions: EditorActions): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const itemIds = deletableItemIds(ctx.sequence, useEditor.getState().selection);
  if (!itemIds.length) return say(COPY.pick(COPY.remove));
  if (!(await removeItems(actions, ctx, itemIds))) return;
  useEditor.getState().select([]);
}

/**
 * Deletes these items and closes up the gaps they leave. If a locked track or clip sits after a gap to be closed, the gap is not closed (the engine would reject the whole change, and the deletion would be lost along with it); the items are still deleted, and the notice says so.
 * Returns true if the commit succeeds.
 */
async function removeItems(actions: EditorActions, ctx: Live, itemIds: readonly Id[]): Promise<boolean> {
  const plan = rippleOperations(ctx.sequence, gapsAfterDelete(ctx.sequence, itemIds), itemIds);
  const receipt = await actions.apply(
    [{ type: 'deleteItems', sequenceId: ctx.sequence.id, itemIds: [...itemIds] }, ...plan.operations],
    EditLabel.deleteClips(),
  );
  if (!receipt) return false;
  followPlayhead(actions, ctx.sequence, plan.spans);
  const deleted = COPY.deleted(itemIds.length);
  const seconds = (plan.frames * ctx.sequence.fps.den) / ctx.sequence.fps.num;
  undoToast(actions, plan.frames ? RIPPLE.closed(deleted, seconds) : plan.locked.length ? RIPPLE.gapKept(deleted) : deleted, receipt);
  return true;
}

/**
 * ⇧Delete and the context menu's “delete this span from all tracks”: the time covered by the selected clips (subtitle instances excepted) is removed from every track, content and chapters after it move forward,
 * and the total length shrinks, the same as box-selecting all tracks and deleting. One transaction, with an undo notice. If a locked track or clip sits after it, nothing is done, and the notice says to unlock first.
 */
export async function removeSelectionSpan(actions: EditorActions): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const plan = rippleOperations(ctx.sequence, selectionSpans(ctx.sequence, useEditor.getState().selection));
  if (plan.locked.length) return say(RIPPLE.locked);
  if (!plan.operations.length) return say(RIPPLE.pickSpan);
  const receipt = await actions.apply(plan.operations, EditLabel.removeSpan());
  if (!receipt) return;
  followPlayhead(actions, ctx.sequence, plan.spans);
  useEditor.getState().select([]);
  undoToast(actions, RIPPLE.removed((plan.frames * ctx.sequence.fps.den) / ctx.sequence.fps.num), receipt);
}

/** Whether any selected clip can be “delete from all tracks” (whether that context-menu item is greyed out): none when only subtitles are selected. */
export function canRemoveSelectionSpan(sequence: Sequence): boolean {
  return selectionSpans(sequence, useEditor.getState().selection).length > 0;
}

/** When segments are removed, the playhead moves with the content: a playhead after a removed segment shifts forward, and one inside it goes back to the segment's start (prototype `ripple`'s `shiftTime`). */
function followPlayhead(actions: EditorActions, sequence: Sequence, spans: readonly FrameSpan[]): void {
  if (!spans.length) return;
  const perSecond = sequence.fps.num / sequence.fps.den;
  const at = useEditor.getState().playhead;
  const to = shiftFrame(at * perSecond, spans) / perSecond;
  if (to !== at) actions.seek(to);
}

/** ⌘V: pastes the clipboard back into the video it was copied from. */
export async function pasteClipboard(actions: EditorActions): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const { entries, videoId } = useClipboard.getState();
  if (!entries.length) return say(COPY.clipboardEmpty(MOD_KEY));
  if (videoId !== ctx.videoId) return say(COPY.otherVideo);
  await spawn(actions, ctx, entries, EditLabel.pasteClips(), COPY.pasted);
}

/** ⌘D: duplicates the selected clips as they are (without going through the clipboard). */
export async function duplicateSelection(actions: EditorActions): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const items = picked(ctx.sequence);
  if (!items.length) return say(COPY.pick(COPY.duplicate));
  await spawn(actions, ctx, items, EditLabel.duplicateClips(), COPY.duplicated);
}

/** Create copies (prototype spawn): the whole batch is one transaction and one undo record, and the new copies are selected afterwards. */
async function spawn(
  actions: EditorActions,
  ctx: Live,
  entries: readonly SequenceItem[],
  label: Localized,
  message: (n: number) => string,
): Promise<void> {
  const generation = useClipboard.getState().nextGeneration();
  const { assets, documents } = ctx.snapshot;
  const plan = pasteOperations(ctx.sequence, entries, {
    playheadFrame: frameAt(useEditor.getState().playhead, ctx.sequence.fps),
    generation,
    labelOf: (item) => itemLabel(item, assets, documents),
  });
  if (!plan.count) return;
  const receipt = await actions.apply(plan.operations, label);
  if (!receipt) return;
  const fresh = live()?.sequence ?? ctx.sequence;
  useEditor.getState().select(createdItemIds(receipt.createdIds, fresh));
  undoToast(actions, message(plan.count), receipt);
}

/** Split at the playhead: if clips are given, only split those; otherwise split by selection (with nothing selected, split every clip that crosses the playhead). */
export function splitAtPlayhead(actions: EditorActions, itemIds?: readonly Id[]): void {
  const ctx = live();
  if (!ctx?.editable) return;
  const splits = splitOperations(ctx.sequence, itemIds ?? useEditor.getState().selection, frameAt(useEditor.getState().playhead, ctx.sequence.fps));
  if (splits.length) void actions.apply(splits, EditLabel.splitClip());
}

/** Whether this clip can be split at the playhead (that context-menu item). */
export function canSplitAt(sequence: Sequence, itemId: Id, playhead: number): boolean {
  return splitOperations(sequence, [itemId], frameAt(playhead, sequence.fps)).length > 0;
}

/**
 * Disables or enables a clip: it stays on the timeline, and both the picture and export skip it (`updateItem.enabled`).
 * If `notice` is given, an undo notice appears after the commit (disabling from the canvas toolbar makes the clip vanish from the picture, so the notice must explain where to re-enable it).
 */
export async function setItemEnabled(actions: EditorActions, itemId: Id, enabled: boolean, notice?: string): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const receipt = await actions.apply([{ type: 'updateItem', sequenceId: ctx.sequence.id, itemId, enabled }], enabled ? EditLabel.enableClip() : EditLabel.disableClip());
  if (receipt && notice) undoToast(actions, notice, receipt);
}

/** Detach audio (canvas toolbar): in one change, create an audio track carrying this clip's sound and mute the video's own sound (detach-audio.ts); with an undo notice. */
export async function detachAudio(actions: EditorActions, sequence: Sequence, item: VideoItem, notice: string): Promise<void> {
  if (!live()?.editable) return;
  const receipt = await actions.apply(detachAudioOperations(sequence, item), EditLabel.detachAudio());
  if (receipt) undoToast(actions, notice, receipt);
}

/** ⌘A: selects the clips under the playhead (prototype selectAll). */
export function selectAtPlayhead(): void {
  const ctx = live();
  if (!ctx) return;
  const ids = itemsAtFrame(ctx.sequence, frameAt(useEditor.getState().playhead, ctx.sequence.fps));
  useEditor.getState().select(ids);
  say(ids.length ? COPY.selectedAtPlayhead(ids.length) : COPY.nothingAtPlayhead);
}

// ---- ⌥←/→: repeated presses combined into one change ----
// Each press only changes the draft in the editor (the timeline draws the offset from it). The draft is committed only after 900ms without input, or when another key is pressed, the user clicks elsewhere, the selection changes, or the editor is left,
// so a run of nudges takes up only one undo record. If ⌘Z is pressed before the draft is committed, the draft is simply discarded.

let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

const sameIds = (a: readonly Id[], b: readonly Id[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** Moves the selected clips by another `step` frames in time (no change if they cannot move). */
export function nudgeTime(actions: EditorActions, step: number): void {
  const ctx = live();
  if (!ctx?.editable) return;
  const { selection, nudge, setNudge } = useEditor.getState();
  if (!selection.length) return;
  let base: NudgeDraft | null = nudge;
  if (base && (base.committing || base.revision !== ctx.snapshot.revision || !sameIds(base.itemIds, selection))) {
    flushNudge(actions);
    base = null;
  }
  const delta = base?.deltaFrames ?? 0;
  const next = nudgeDelta(ctx.sequence, selection, delta, step);
  if (next !== delta) setNudge({ itemIds: [...selection], deltaFrames: next, revision: ctx.snapshot.revision, committing: false });
  if (!base && next === delta) return;
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => flushNudge(actions), NUDGE_WINDOW_MS);
}

/** Commits the accumulated nudges. The draft is cleared only after the commit lands (the video version changes), so the timeline does not snap back to its original position before jumping to the new one. */
export function flushNudge(actions: EditorActions): void {
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = null;
  const draft = useEditor.getState().nudge;
  if (!draft || draft.committing) return;
  const ctx = live();
  const operation =
    ctx?.editable && draft.deltaFrames
      ? moveOperation(ctx.sequence, { itemId: draft.itemIds[0]!, itemIds: draft.itemIds, deltaFrames: draft.deltaFrames, trackId: null })
      : null;
  if (!operation) {
    useEditor.getState().setNudge(null);
    return;
  }
  const committing: NudgeDraft = { ...draft, committing: true };
  const clear = () => {
    if (useEditor.getState().nudge === committing) useEditor.getState().setNudge(null);
  };
  useEditor.getState().setNudge(committing);
  void actions.apply([operation], EditLabel.nudgeClip()).then((receipt) => {
    if (!receipt || useVideo.getState().video?.state?.video.revision !== draft.revision) return clear();
    const stop = useVideo.subscribe((state) => {
      if (state.video?.state?.video.revision === draft.revision) return;
      stop();
      clear();
    });
  });
}

/** Discards uncommitted nudges (⌘Z). Returns true if something was discarded; a commit already in progress does not count. */
export function dropNudge(): boolean {
  const draft = useEditor.getState().nudge;
  if (!draft || draft.committing) return false;
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = null;
  useEditor.getState().setNudge(null);
  return true;
}

// ---- Canvas floating toolbar and multi-select page ----
// The toolbar only acts on the one item inside the selection box: the selection may still include the main video (if ⇧-clicked), so act by clip ID, not by selection.

/** The toolbar's “duplicate”: duplicates these items as they are, along the same path as ⌘D (one transaction, the new copies selected, with an undo notice). */
export async function duplicateItems(actions: EditorActions, itemIds: readonly Id[]): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const entries = ctx.sequence.items.filter((item) => itemIds.includes(item.id));
  if (!entries.length) return say(COPY.pick(COPY.duplicate));
  await spawn(actions, ctx, entries, EditLabel.duplicateClips(), COPY.duplicated);
}

/**
 * “layer order” on the canvas (toolbar menu and F / B / ⌘↑ / ⌘↓): changing layer is one change, undone with ⌘Z. The stacking order is the track order from top to bottom; the engine splits tracks or moves whole tracks as needed
 * (command protocol spec §4.2 `arrangeItem`); if already at the front / back, nothing happens (that menu item is greyed out).
 */
export function arrangeItem(actions: EditorActions, itemId: Id, direction: ArrangeDirection): void {
  const ctx = live();
  if (!ctx?.editable) return;
  const operation = arrangeOperation(ctx.sequence, itemId, direction);
  if (operation) void actions.apply([operation], EditLabel.changeStacking());
}

/**
 * Shortcuts for “layer order”: handled when the selection is exactly one item on the canvas (returns true); in other cases (nothing selected, several selected, or the selection is audio or subtitles) the key is passed on to its original binding
 * (F is fullscreen playback). If something is selected but cannot be changed (video is read-only), it still counts as handled, and does not go fullscreen.
 */
export function arrangeSelection(actions: EditorActions, direction: ArrangeDirection): boolean {
  const ctx = live();
  if (!ctx) return false;
  const { selection } = useEditor.getState();
  if (selection.length !== 1) return false;
  const item = ctx.sequence.items.find((candidate) => candidate.id === selection[0]);
  if (!item || item.type === 'audio' || item.type === 'caption') return false;
  arrangeItem(actions, item.id, direction);
  return true;
}

/** The toolbar's “delete”: deletes these items (the gaps they leave are closed up, as with Delete), removes them from the selection, with an undo notice. */
export async function deleteItems(actions: EditorActions, itemIds: readonly Id[]): Promise<void> {
  const ctx = live();
  if (!ctx?.editable || !itemIds.length) return;
  if (!(await removeItems(actions, ctx, itemIds))) return;
  const { selection, select } = useEditor.getState();
  select(selection.filter((id) => !itemIds.includes(id)));
}

/** Alignment and distribution on the multi-select page: the whole batch is one transaction and one undo step, with an undo notice; if nothing needs to move, it just says so and does not commit an empty transaction. */
export async function applyArrangement(
  actions: EditorActions,
  operations: Parameters<EditorActions['apply']>[0],
  label: Localized,
  done: string,
  idle: string,
): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  if (!operations.length) return say(idle);
  const receipt = await actions.apply(operations, label);
  if (receipt) undoToast(actions, done, receipt);
}

// ---- Dub blocks (the timeline's block menu, timeline-dub.tsx; design timeline-dub.jsx `DubBlockMenu`) ----
// All of these act only on the selected dub blocks; other instances in the selection are ignored. Each command is one transaction and one undo record.

/** Mutes or unmutes these dub blocks. */
export async function muteDubBlocks(actions: EditorActions, itemIds: readonly Id[], muted: boolean): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const operations = muteOperations(ctx.sequence, itemIds, muted);
  if (!operations.length) return;
  const receipt = await actions.apply(operations, muted ? EditLabel.muteDub() : EditLabel.unmuteDub());
  if (receipt) say(muted ? DUB.muted(itemIds.length) : DUB.unmuted(itemIds.length));
}

/** Deletes these dub blocks (only the instances; the dub plan and other blocks are left alone), with an undo notice. */
export async function deleteDubBlocks(actions: EditorActions, itemIds: readonly Id[]): Promise<void> {
  const ctx = live();
  if (!ctx?.editable) return;
  const present = new Set(ctx.sequence.items.map((item) => item.id));
  const ids = itemIds.filter((id) => present.has(id));
  if (!ids.length) return;
  const receipt = await actions.apply([{ type: 'deleteItems', sequenceId: ctx.sequence.id, itemIds: ids }], EditLabel.removeDub());
  if (!receipt) return;
  useEditor.getState().select(useEditor.getState().selection.filter((id) => !ids.includes(id)));
  undoToast(actions, DUB.removed(ids.length), receipt);
}

/**
 * Removes a whole dub group: the reverse operation used when “undo this dub group” on the translation dub receipt cannot undo it (model/dub-undo.ts). In one transaction it deletes this group's instances
 * (including the separated background sound), restores the original sound that was muted by this, and removes the ducking triggered by the dub track. Which instances were muted is recorded in the dub plan body, and
 * `readPlan` retrieves it; if it cannot be retrieved, the rest proceeds and the notice says the original sound was not restored. Empty dub tracks and the dub plan document are left in place (the protocol has no operations to delete tracks or documents).
 */
export async function deleteDubGroup(actions: EditorActions, groupId: string, readPlan: () => Promise<unknown>): Promise<void> {
  if (!live()?.editable) return;
  let muted: Id[] = [];
  let unread = false;
  try {
    muted = mutedItemsOf(await readPlan());
  } catch {
    unread = true;
  }
  const ctx = live();
  if (!ctx?.editable) return;
  const group = dubGroups(ctx.sequence).find((candidate) => candidate.groupId === groupId);
  if (!group) return;
  const fallback = fallbackUndoOperations(ctx.sequence, { groupId, trackId: group.trackIds[0]! }, muted);
  if (!fallback.operations.length) return;
  const receipt = await actions.apply(fallback.operations, EditLabel.removeDubGroup({ language: group.language ?? '' }));
  if (!receipt) return;
  useEditor.getState().select([]);
  undoToast(actions, DUB.groupRemoved(group.language ? langName(group.language) : ''), receipt);
  if (unread) say(DUB.planUnread);
}

/** The segment currently being previewed: when previewing another segment, first remove the previous listener. */
let stopAudition: (() => void) | null = null;

/**
 * Preview a segment (“listen to this line”): the playhead jumps to the start, starts playing if it was not playing, and stops at the end. If the user pauses midway or jumps out of this segment, stop watching.
 * Playhead updates come from the preview engine and may lag a beat: wait until it is seen to land inside this segment before watching for the end.
 */
export function auditionRange(actions: EditorActions, start: number, end: number): void {
  stopAudition?.();
  actions.seek(start);
  if (!useEditor.getState().playing) actions.togglePlay();
  let armed = false;
  const done = () => {
    stop();
    if (stopAudition === done) stopAudition = null;
  };
  const stop = useEditor.subscribe((state) => {
    if (!state.playing) return done();
    const t = state.playhead;
    if (!armed) {
      armed = t >= start - 0.05 && t < end;
      return;
    }
    if (t < start - 0.05) return done();
    if (t >= end) {
      done();
      actions.pause();
    }
  });
  stopAudition = done;
}
