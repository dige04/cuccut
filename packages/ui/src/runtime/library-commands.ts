import {
  newId,
  type AssetRecord,
  type Id,
  type LibraryApplyParams,
  type LibraryApplyResult,
  type LibraryEntry,
  type LibraryEntryRef,
  type LibraryExportResult,
  type LibraryName,
  type LibraryPutParams,
  type MediaHandle,
} from '@cuccut/protocol';
import { entryKey } from '../model/library-entry.ts';
import { useVideo } from '../state/video-store.ts';
import type { RuntimeSession } from './session.ts';

/**
 * Commands for the user library (architecture design §5.9, `library.*`). Settings › Glossary & Editor › Brand sharing. The list of entries comes from the `library` topic
 * (state/library-store); this file holds only reads and writes. The reads and writes themselves use the user-library methods on the session; this file adds the per-version cache and file-handle reuse;
 * `library.applyToVideo`, which the session does not have, is sent from here. It lives in its own file so the session channel does not grow.
 */

/** The content of one version of an entry never changes, so it is remembered under “library/ID@version” (along with in-flight requests, so the same entry requested from several places at once is not sent twice). */
const entries = new Map<string, Promise<LibraryEntry>>();
/** File handles expire: stop using one 30 seconds before it expires. */
const handles = new Map<string, Promise<MediaHandle>>();
const HANDLE_MARGIN_MS = 30_000;

/** Read one entry. When a version is given, use the cache; failures are not recorded, so the next call fetches again. */
export function getLibraryEntry(session: RuntimeSession, ref: LibraryEntryRef): Promise<LibraryEntry> {
  if (ref.version === undefined) return session.getLibraryEntry(ref).then(remember);
  const key = entryKey({ library: ref.library, id: ref.id, version: ref.version });
  const cached = entries.get(key);
  if (cached) return cached;
  const pending = session.getLibraryEntry(ref);
  entries.set(key, pending);
  pending.catch(() => entries.delete(key));
  return pending;
}

function remember(entry: LibraryEntry): LibraryEntry {
  entries.set(entryKey(entry), Promise.resolve(entry));
  return entry;
}

/** Create or update. An update passes `expectedVersion`; if it was changed elsewhere first, the result is `LIBRARY_VERSION_CONFLICT`. */
export async function putLibraryEntry(
  session: RuntimeSession,
  params: Omit<LibraryPutParams, 'commandId'>,
): Promise<{ entry: LibraryEntry; created: boolean; changed: boolean }> {
  const result = await session.putLibraryEntry(params);
  remember(result.entry);
  return result;
}

export function removeLibraryEntry(session: RuntimeSession, library: LibraryName, id: Id): Promise<void> {
  return session.removeLibraryEntry(library, id);
}

/** Import from a file: the Runtime detects the format from the content and decides which library it goes into. */
export async function importLibraryFile(session: RuntimeSession, path: string): Promise<LibraryEntry> {
  return remember(await session.importLibraryFile(path));
}

/** Export to a new file; if the target already exists, the Runtime does not overwrite it (`conflict`). */
export function exportLibraryEntry(session: RuntimeSession, entry: LibraryEntryRef, path: string): Promise<LibraryExportResult> {
  return session.exportLibraryEntry(entry, path);
}

/** Read address for entries that carry a file (images, videos, stickers, fonts); the same version reuses it until the handle expires. */
export function openLibraryHandle(session: RuntimeSession, ref: LibraryEntryRef & { version: number }): Promise<MediaHandle> {
  const key = entryKey(ref);
  const cached = handles.get(key);
  if (cached) return cached;
  const pending = session.openLibraryHandle(ref);
  handles.set(key, pending);
  pending.then(
    (handle) => {
      const left = Date.parse(handle.expiresAt) - Date.now() - HANDLE_MARGIN_MS;
      setTimeout(() => {
        if (handles.get(key) === pending) handles.delete(key);
      }, Math.max(0, Number.isFinite(left) ? left : 0));
    },
    () => handles.delete(key),
  );
  return pending;
}

/**
 * Put the entry into the video (a copy is made, so later changes in the library do not affect the video). This write does not go through the editor's command queue, so first wait until the queued edits have results;
 * `expectedRevision` is not given, so the Runtime uses the video's current revision.
 */
export async function applyLibraryEntry(
  session: RuntimeSession,
  params: Omit<LibraryApplyParams, 'commandId' | 'expectedRevision'>,
): Promise<LibraryApplyResult> {
  await session.videos.settled();
  return session.client.request('library.applyToVideo', { ...params, commandId: newId('cmd') });
}

/**
 * Wait until the newly imported asset appears in the editor's video mirror (the video topic's event has arrived). A timeline edit submitted after this uses the new version number.
 * Returns null on timeout.
 */
export function waitForAsset(assetId: Id, timeoutMs = 5000): Promise<AssetRecord | null> {
  const find = () => useVideo.getState().video?.state?.video.assets[assetId] ?? null;
  const found = find();
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);
    const unsubscribe = useVideo.subscribe(() => {
      const asset = find();
      if (!asset) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(asset);
    });
  });
}
