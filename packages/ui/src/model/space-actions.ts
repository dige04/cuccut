import { live, type Id, type SpaceEntry, type SpaceEntryReference, type SpaceReference } from '@cuccut/protocol';
import { fromVideoId, KIND_LABEL, kindOfFileName } from './space.ts';
import { M } from './space-actions-copy.ts';

/**
 * Whether an action on a Space item can be done, and if not, why (product design §4.6, §4.7, §4.9; architecture design §5.5, §5.7).
 * A button that cannot be done is greyed out with one real reason (following tools-gallery's plannedReason); it does not pretend the action was done.
 */

/**
 * Where secondary editing goes (product design §4.6; prototype model-space.js editRoute):
 * a video goes straight into the editor; a finished cut or product with a source video goes back to that source video; a finished cut or video material with no source video creates a new video using it as material;
 * subtitles and documents edit their text; images, audio, and templates are saved as a copy first and then edited. Video packages (portable packages) have no secondary editing.
 * This is only a guess at the destination from the item; where it really goes is answered by `space.openForEdit`.
 */
export type EditRoute = 'video' | 'source-video' | 'new-video' | 'text' | 'version';

export function editRoute(entry: Pick<SpaceEntry, 'kind' | 'origin'>): EditRoute | null {
  if (entry.kind === 'video') return 'video';
  if (entry.origin?.videoId) return 'source-video';
  if (entry.kind === 'export' || entry.kind === 'video-file') return 'new-video';
  if (entry.kind === 'subtitle' || entry.kind === 'document') return 'text';
  if (entry.kind === 'image' || entry.kind === 'audio' || entry.kind === 'template') return 'version';
  return null;
}

export const EDIT_LABEL: Record<EditRoute, string> = live(() => M.edit);

/** A failed generation placeholder: it has no file, so it can only be cleared (`space.purge` clears it directly). */
export function isFailedPlaceholder(entry: Pick<SpaceEntry, 'status' | 'ref'>): boolean {
  return entry.status === 'failed' && !!entry.ref && 'jobId' in entry.ref;
}

/** The task for this item: the placeholder's task, or the task that generated or exported it (the task page can also locate it by jobId). */
export function entryJobId(entry: Pick<SpaceEntry, 'ref' | 'origin'>): Id | null {
  if (entry.ref && 'jobId' in entry.ref) return entry.ref.jobId;
  return entry.origin?.jobId ?? null;
}

/** Which session the item came from: for bytes, look at the source in the session working directory; for products, look at `origin`. */
export function entryConversationId(entry: Pick<SpaceEntry, 'source' | 'origin'>): Id | null {
  return entry.source.conversationId ?? entry.origin?.conversationId ?? null;
}

/** Edits blocked by state: in the trash, generating, missing, or failed. null when not blocked. */
function stateBlock(entry: Pick<SpaceEntry, 'status' | 'user'>): string | null {
  if (entry.user.trashedAt) return M.trashed;
  if (entry.status === 'generating') return M.editGenerating;
  if (entry.status === 'missing') return M.editMissing;
  if (entry.status === 'failed') return M.editFailed;
  return null;
}

/**
 * Why secondary editing cannot be done; null when it can. `path` is the item's absolute path on disk (only known for files in a source directory).
 * - Subtitles and documents: the Runtime has no command yet to save a new version (products are immutable, so the original item cannot be overwritten).
 * - Images, audio, and templates: manual editing is not yet open (model-assisted editing is P1).
 * - Creating a new video from it as material: needs the file's path to import; products outside the project or session directories (Artifact Store, exports outside the directory) do not give the UI a path.
 */
export function editBlock(entry: Pick<SpaceEntry, 'kind' | 'origin' | 'status' | 'user' | 'source'>, path: string | null): string | null {
  const route = editRoute(entry);
  if (!route) return M.editPackage;
  const blocked = stateBlock(entry);
  if (blocked) return blocked;
  if (route === 'text') return M.editText;
  if (route === 'version') return M.editVersion;
  if (route === 'new-video' && (!path || (!entry.source.projectId && !entry.source.conversationId))) {
    return M.newVideoOutside;
  }
  return null;
}

/**
 * Why “open as new video” from a portable package cannot be done (architecture design §5.8 `videos.importPackage`); null when it can.
 * The new video is built in the project or session working directory where the package is, so the package's path on disk and the directory it belongs to must be known.
 */
export function packageBlock(entry: Pick<SpaceEntry, 'status' | 'user' | 'source'>, path: string | null): string | null {
  if (entry.user.trashedAt) return M.trashed;
  if (entry.status === 'generating') return M.packageGenerating;
  if (entry.status === 'missing') return M.packageMissing;
  if (entry.status === 'failed') return M.packageFailed;
  if (!path || (!entry.source.projectId && !entry.source.conversationId)) return M.packageOutside;
  return null;
}

/** The directory the package is in: the new video is built here (`videos.importPackage` needs either projectId or conversationId). */
export function packageScope(entry: Pick<SpaceEntry, 'source'>): { projectId: Id } | { conversationId: Id } | null {
  if (entry.source.projectId) return { projectId: entry.source.projectId };
  if (entry.source.conversationId) return { conversationId: entry.source.conversationId };
  return null;
}

/** Why “continue in session” cannot be done (product design §4.7: items in the trash must be restored before they can be brought in). */
export function continueBlock(entry: Pick<SpaceEntry, 'user'>): string | null {
  return entry.user.trashedAt ? M.continueTrashed : null;
}

/**
 * Why “permanently delete” cannot be done (architecture design §5.5): only items in the trash are deleted; failed placeholders are cleared directly; items being generated have their task cancelled first.
 * When an item is referenced, the Runtime refuses and lists the references; that is only known after the call.
 */
export function purgeBlock(entry: Pick<SpaceEntry, 'status' | 'user' | 'ref'>): string | null {
  if (entry.status === 'generating') return M.purgeGenerating;
  if (isFailedPlaceholder(entry)) return null;
  if (!entry.user.trashedAt) return M.purgeNotTrashed;
  return null;
}

/** Kinds of reference that block deletion (the reference graph in architecture design §5.5). */
export const REFERENCE_KIND_LABEL: Record<SpaceReference['kind'], string> = live(() => M.referenceKind);

/** Items listed together when deleting a video (product design §4.9): items it exported or generated stay in Space. This is the same rule as the one for cards folding files into a video (`fromVideoId`). */
export function relatedEntries(entries: readonly SpaceEntry[], videoId: Id): SpaceEntry[] {
  return entries.filter((entry) => fromVideoId(entry) === videoId);
}

/** The videoId of a video item; null when the item is not a video, or has not been opened yet (no ref). */
export function videoIdOf(entry: Pick<SpaceEntry, 'ref'>): Id | null {
  return entry.ref && 'videoId' in entry.ref ? entry.ref.videoId : null;
}

/** One sentence after importing material: how many succeeded (how many were copied into imports/) and how many failed. */
export function importSummary(results: readonly ({ ok: true; copied: boolean } | { ok: false; error: string })[]): {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
} {
  const ok = results.filter((r): r is { ok: true; copied: boolean } => r.ok);
  const failed = results.length - ok.length;
  const copied = ok.filter((r) => r.copied).length;
  if (!ok.length) {
    const first = results.find((r): r is { ok: false; error: string } => !r.ok);
    return { text: failed > 1 ? M.importAllFailed(failed, first?.error ?? '') : M.importFailed(first?.error ?? ''), tone: 'negative' };
  }
  const parts = [M.imported(ok.length)];
  if (copied) parts.push(copied === ok.length ? M.copiedAll : M.copiedSome(copied));
  if (failed) parts.push(M.notImported(failed));
  return { text: parts.join(' · '), tone: failed ? 'neutral' : 'positive' };
}

/** The kind of material placed on the timeline (`importAndPlace`'s kind): by extension, video, audio, or image; null for other files that cannot be placed on the timeline. */
export function placeKindOf(fileName: string): 'video' | 'audio' | 'image' | null {
  const kind = kindOfFileName(fileName);
  return kind === 'video-file' ? 'video' : kind === 'audio' || kind === 'image' ? kind : null;
}

/**
 * A Space item carried with a message (architecture design §5.7 “continue the session from an item”) written as one line, for the line under the sent message. At most the first two names are written.
 */
export function referencesText(refs: readonly Pick<SpaceEntryReference, 'name'>[]): string {
  return M.references(
    refs.slice(0, 2).map((ref) => ref.name),
    refs.length,
  );
}

/** A description of a reference (the hint on the label above the input box): type and location; products outside the source directory are written as “product”. */
export function referenceDescription(ref: Pick<SpaceEntryReference, 'kind' | 'relPath'>): string {
  return `${KIND_LABEL[ref.kind]} · ${ref.relPath ?? M.referenceOutput}`;
}

/** The filename in the path with its extension removed: used as the video name when creating a video from a file. */
export function videoNameOf(path: string): string {
  const file = path.split(/[\\/]/).pop() || path;
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

/**
 * Collection dependency key for Space lists and cards: react-aria collections cache each item's render per item object, so an unchanged item is not re-rendered. Parts of the menu that change with other data
 * (the transcribe action looks at candidates that arrive later and at `jobs`; “show in folder” looks at the save location; the source column of the table looks at the save location and the video name) are combined into one string, so the cache is invalidated only when they change, not on every render.
 */
export function entryMenuKey(
  entries: readonly SpaceEntry[],
  canReveal: (entry: SpaceEntry) => boolean,
  transcribeAction: (entry: SpaceEntry) => string | null,
  sourceOf?: (entry: SpaceEntry) => string,
): string {
  return entries.map((e) => `${transcribeAction(e) ?? '-'}${canReveal(e) ? 'r' : ''}${sourceOf ? `:${sourceOf(e)}` : ''}`).join('\n');
}
