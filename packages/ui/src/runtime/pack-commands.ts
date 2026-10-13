import {
  newId,
  type Id,
  type PackActiveStyle,
  type PackChangeResult,
  type PackChooseResult,
  type MediaHandle,
  type PackDetail,
  type PackExampleRemoveResult,
  type PackExportParams,
  type PackExportResult,
  type PackPreview,
  type PackRemoveResult,
} from '@cuccut/protocol';
import { usePacks } from '../state/packs-store.ts';
import type { RuntimeSession } from './session.ts';
import { loadSkills } from './skill-commands.ts';
import { loadTemplates } from './template-commands.ts';

/**
 * Packs (`packs.*`, pack design §4.3, §6): one path for the list, the pack page, inspect, install, remove and restore,
 * the project's style choice, the guide and export. The list goes into state/packs-store; install, remove and restore return the
 * whole list, which is written back, and then the template and skill catalogs are fetched again, since a pack brings
 * and takes both (there is no topic). Kept in its own file so the session channel does not grow.
 */

type Session = Pick<RuntimeSession, 'client'>;

let listing: Promise<void> | null = null;
/** Read handles for reference files, by `<pack>:<path>`; renewed a minute before they expire. */
const handles = new Map<string, Promise<MediaHandle>>();
const HANDLE_MARGIN_MS = 60_000;

/** Fetch the list once; do not send a duplicate while already fetching. The old list keeps displaying while the fetch is in progress. */
export function loadPacks(session: Session): Promise<void> {
  if (listing) return listing;
  usePacks.getState().begin();
  listing = session.client
    .request('packs.list', {})
    .then(
      (result) => usePacks.getState().succeed(result),
      (error: Error) => usePacks.getState().fail(error.message),
    )
    .finally(() => {
      listing = null;
    });
  return listing;
}

/** Write a changed list back, then refresh what the pack brought or took away (templates and skills). */
async function changed<T extends PackChangeResult | PackRemoveResult>(session: Session, pending: Promise<T>): Promise<T> {
  const result = await pending;
  usePacks.getState().succeed(result);
  void loadTemplates(session);
  void loadSkills(session);
  return result;
}

/** The pack page: summary, style guide, reference files, quick actions, item states and reserved texts. */
export function getPack(session: Session, id: string): Promise<PackDetail> {
  return session.client.request('packs.get', { id });
}

/** Read a pack from a folder, a GitHub address or an `https://` address without installing it; the preview is kept for the import page. A new read ends the last notice. */
export async function inspectPack(session: Session, source: string): Promise<PackPreview> {
  usePacks.getState().setPreview(null);
  usePacks.getState().setNotice(null);
  const preview = await session.client.request('packs.inspect', { source: source.trim(), commandId: newId('cmd') });
  usePacks.getState().setPreview(preview);
  return preview;
}

/** Forget the preview (Cancel, or leaving the import page). */
export function clearPackPreview(): void {
  usePacks.getState().setPreview(null);
}

/**
 * Install exactly what a preview read (its token). `replace`: the user's own items with a clashing id go to the trash
 * first. On success the preview is forgotten and the list says "Installed X." once.
 */
export async function installPack(session: Session, preview: Pick<PackPreview, 'token'>, replace = false): Promise<PackChangeResult> {
  const result = await changed(session, session.client.request('packs.install', { token: preview.token, replace, commandId: newId('cmd') }));
  const store = usePacks.getState();
  store.setPreview(null);
  store.setNotice({ kind: 'installed', name: result.pack.name });
  return result;
}

/** Delete a pack at once: it and its unchanged templates and skills go to the trash; `trashId` is the Undo. */
export async function removePack(session: Session, id: string): Promise<PackRemoveResult> {
  const result = await changed(session, session.client.request('packs.remove', { id }));
  usePacks.getState().setNotice(null);
  return result;
}

/** Undo a removal. */
export function restorePack(session: Session, trashId: string): Promise<PackChangeResult> {
  return changed(session, session.client.request('packs.restore', { trashId }));
}

/** The style guide a conversation (or a project) uses now, and why. */
export function activePackStyle(session: Session, target: { conversationId: Id } | { projectId: Id }): Promise<PackActiveStyle> {
  return session.client.request('packs.active', target);
}

/** A project's style choice: a pack id, `'none'`, or null (decide on its own). The Video menu's Style guide calls it, as `packs_choose_style` does. */
export function choosePackStyle(session: Session, projectId: Id, pack: string | null): Promise<PackChooseResult> {
  return session.client.request('packs.choose', { projectId, pack });
}

/** Save a pack's style guide (empty text removes it). `expectedHash` guards against a newer save. The list's summary of that pack is updated in place. */
export async function setPackStyle(session: Session, id: string, text: string, expectedHash?: string): Promise<PackDetail> {
  const detail = await session.client.request('packs.setStyle', { id, text, ...(expectedHash !== undefined ? { expectedHash } : {}) });
  usePacks.getState().patch(detail.pack);
  return detail;
}

/** A media URL for a reference file or its still (`packs.openHandle`). */
export function packFileUrl(session: Session, id: string, path: string): Promise<string> {
  const key = `${id}:${path}`;
  const cached = handles.get(key);
  if (cached) return cached.then((handle) => (Date.parse(handle.expiresAt) - Date.now() > HANDLE_MARGIN_MS ? handle.url : renew()));
  return renew();

  function renew(): Promise<string> {
    const pending = session.client.request('packs.openHandle', { id, path });
    handles.set(key, pending);
    pending.catch(() => handles.delete(key));
    return pending.then((handle) => handle.url);
  }
}

/** The file could not be fetched, or it changed: drop its handle so the next read asks again. */
export function forgetPackFile(id: string, path: string): void {
  handles.delete(`${id}:${path}`);
}

/** Keeps the list's summary of the pack in step with its page (the count of reference files). */
function paged<T extends PackDetail>(detail: T): T {
  usePacks.getState().patch(detail.pack);
  return detail;
}

/** Add a reference image or video from a file on this computer; a video gets a still when the Runtime has ffmpeg. */
export async function addPackExample(session: Session, id: string, draft: { path: string; title: string; note: string }): Promise<PackDetail> {
  return paged(await session.client.request('packs.addExample', { id, path: draft.path.trim(), title: draft.title.trim(), note: draft.note.trim() }));
}

/** Save a reference's title and note. */
export async function updatePackExample(session: Session, id: string, file: string, details: { title: string; note: string }): Promise<PackDetail> {
  return paged(await session.client.request('packs.updateExample', { id, file, title: details.title.trim(), note: details.note.trim() }));
}

/** Remove a reference at once; `trashId` is the Undo (`restorePackExample`). */
export async function removePackExample(session: Session, id: string, example: { file: string; still?: string }): Promise<PackExampleRemoveResult> {
  const result = paged(await session.client.request('packs.removeExample', { id, file: example.file }));
  forgetPackFile(id, example.file);
  if (example.still) forgetPackFile(id, example.still);
  return result;
}

/** Undo a reference's removal: it comes back where it was. */
export async function restorePackExample(session: Session, id: string, trashId: string): Promise<PackDetail> {
  return paged(await session.client.request('packs.restoreExample', { id, trashId }));
}

/** Write a pack folder (`packs.export`); the list then says where it went, once. Nothing installed changes. */
export async function exportPack(session: Session, params: PackExportParams): Promise<PackExportResult> {
  const result = await session.client.request('packs.export', params);
  usePacks.getState().setNotice({ kind: 'exported', dir: result.dir });
  return result;
}

/** For tests: clear in-progress requests. */
export function resetPackCommands(): void {
  listing = null;
  handles.clear();
}
