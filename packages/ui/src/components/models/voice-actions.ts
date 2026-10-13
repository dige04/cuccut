import type { LibraryEntrySummary, LibraryExportResult, MediaHandle, VoiceCloneRemoveResult } from '@cuccut/protocol';
import type { RuntimeSession } from '../../runtime/session.ts';
import {
  clonesToRemove,
  createVoiceRequest,
  editVoiceRequest,
  errorCode,
  rpcErrorText,
  type VoiceEntry,
  type VoiceForm,
} from '../../model/voices-library.ts';

/**
 * Commands for My Voices (architecture design §5.9): all go through thin methods on `RuntimeSession`; changes to the list are sent back by the `library` topic, and this code does not change local state.
 * Cloning uploads the reference recording to a third party, so it is only called after the user confirms (a notice is shown first in my-voices.tsx).
 */

type Session = Pick<
  RuntimeSession,
  | 'getLibraryEntry'
  | 'putLibraryEntry'
  | 'removeLibraryEntry'
  | 'importLibraryFile'
  | 'exportLibraryEntry'
  | 'openLibraryHandle'
  | 'createVoiceClone'
  | 'removeVoiceClone'
>;

export async function loadVoice(session: Session, id: string): Promise<VoiceEntry> {
  return (await session.getLibraryEntry({ library: 'voices', id })) as VoiceEntry;
}

/** Create from an audio file. */
export async function createVoice(session: Session, form: VoiceForm, path: string): Promise<VoiceEntry> {
  const { entry } = await session.putLibraryEntry(createVoiceRequest(form, path));
  return entry as VoiceEntry;
}

export type SaveOutcome = { kind: 'saved'; entry: VoiceEntry; changed: boolean } | { kind: 'conflict'; entry: VoiceEntry; message: string };

/**
 * Change the name, language, transcript or declarations. If it was changed elsewhere first (`LIBRARY_VERSION_CONFLICT`), the latest version is fetched and handed to the dialog to review again, rather than retrying automatically with the new version number, which would silently overwrite the other change.
 */
export async function saveVoice(session: Session, form: VoiceForm, entry: VoiceEntry): Promise<SaveOutcome> {
  try {
    const result = await session.putLibraryEntry(editVoiceRequest(form, entry));
    return { kind: 'saved', entry: result.entry as VoiceEntry, changed: result.changed };
  } catch (error) {
    if (errorCode(error) !== 'LIBRARY_VERSION_CONFLICT') throw error;
    return { kind: 'conflict', entry: await loadVoice(session, entry.id), message: rpcErrorText(error) };
  }
}

export type DeleteOutcome =
  | { kind: 'deleted'; clones: { providerId: string; remote: VoiceCloneRemoveResult['remote'] }[] }
  /** The remote clone was not deleted: the voice is not deleted either (deleting only the entry would leave the clone in the other party's account, with no way to find it in the UI). */
  | { kind: 'clone-failed'; providerId: string; message: string };

/**
 * Delete a voice: first delete each of its clones on each Provider, and only delete the entry once all are deleted. If a remote one cannot be deleted, stop and do not delete the entry.
 * `localOnly`: the user explicitly chose “只删本机记录”(Delete only the local record) — the clone record is cleared only locally (clones in the other party's account are kept), and then the entry is deleted.
 */
export async function deleteVoice(session: Session, voice: LibraryEntrySummary, localOnly = false): Promise<DeleteOutcome> {
  const clones: { providerId: string; remote: VoiceCloneRemoveResult['remote'] }[] = [];
  for (const providerId of clonesToRemove(voice)) {
    try {
      const result = await session.removeVoiceClone(voice.id, providerId, localOnly);
      clones.push({ providerId, remote: result.remote });
    } catch (error) {
      // The record is already gone (just deleted elsewhere): treated as deleted.
      if ((error as { code?: unknown }).code === 'not-found') continue;
      return { kind: 'clone-failed', providerId, message: rpcErrorText(error) };
    }
  }
  await session.removeLibraryEntry('voices', voice.id);
  return { kind: 'deleted', clones };
}

/** Import a voice package (`.bcvoice`; the Runtime identifies it by content). */
export async function importVoicePackage(session: Session, path: string): Promise<VoiceEntry> {
  return (await session.importLibraryFile(path)) as VoiceEntry;
}

/** Export as a voice package; when the target already exists the Runtime does not overwrite (`conflict`), and the error is thrown as-is. */
export async function exportVoice(session: Session, voice: LibraryEntrySummary, path: string): Promise<LibraryExportResult> {
  return session.exportLibraryEntry({ library: 'voices', id: voice.id }, path);
}

/** Create a clone on one Provider: upload the reference recording, return the task ID. */
export async function cloneVoice(session: Session, voice: LibraryEntrySummary, providerId: string): Promise<string> {
  return session.createVoiceClone(voice.id, providerId);
}

/** Delete a clone: delete the remote one first; if that fails, report it with the Provider's error code. `localOnly` only clears the local record. */
export async function removeClone(session: Session, voice: LibraryEntrySummary, providerId: string, localOnly = false): Promise<VoiceCloneRemoveResult> {
  return session.removeVoiceClone(voice.id, providerId, localOnly);
}

/** URL needed for trial listen: if the one in hand has not expired (keeping a 30-second margin), reuse it; otherwise request a new one. */
export async function auditionHandle(session: Session, voice: LibraryEntrySummary, cached: MediaHandle | null, now = Date.now()): Promise<MediaHandle> {
  if (cached && Date.parse(cached.expiresAt) - now > 30_000) return cached;
  return session.openLibraryHandle({ library: 'voices', id: voice.id });
}
