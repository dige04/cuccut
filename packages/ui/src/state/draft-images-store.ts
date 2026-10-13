import { create } from 'zustand';
import { newId, type AttachmentRef } from '@cuccut/protocol';

/**
 * Images in the input area that have not been sent yet, keyed by draft key (session ID, or the draft key of a new session).
 * Only in this window: File objects and preview URLs cannot be stored in localStorage, so they are gone after a refresh.
 */
export interface DraftImage {
  id: string;
  file: File;
  /** Local address for the thumbnail (object URL), revoked on removal. */
  url: string;
  /** Upload progress 0–100 while uploading. null when not uploading. */
  progress: number | null;
  error: string | null;
  /** Already fully uploaded: do not upload again when sending again. */
  ref: AttachmentRef | null;
}

interface DraftImagesStore {
  images: Record<string, DraftImage[]>;
  /** Images that were added already have an id and a preview address (created by PromptField on paste or drag-and-drop; those chosen from the "+" menu use `imageEntry`). */
  add(draftKey: string, entries: readonly Pick<DraftImage, 'id' | 'file' | 'url'>[]): void;
  remove(draftKey: string, id: string): void;
  patch(draftKey: string, id: string, patch: Partial<Pick<DraftImage, 'progress' | 'error' | 'ref'>>): void;
  /** Sent or abandoned: revoke the preview address. */
  clear(draftKey: string): void;
  /** A new session was created but the first message was not sent: the images move with the text to that session's input box. */
  move(from: string, to: string): void;
}

const EMPTY: DraftImage[] = [];

export const useDraftImages = create<DraftImagesStore>()((set, get) => ({
  images: {},
  add: (draftKey, entries) => {
    if (!entries.length) return;
    const added = entries.map((e) => ({ id: e.id, file: e.file, url: e.url, progress: null, error: null, ref: null }));
    set((s) => ({ images: { ...s.images, [draftKey]: [...(s.images[draftKey] ?? EMPTY), ...added] } }));
  },
  remove: (draftKey, id) => {
    const gone = get().images[draftKey]?.find((i) => i.id === id);
    if (!gone) return;
    URL.revokeObjectURL(gone.url);
    set((s) => {
      const rest = (s.images[draftKey] ?? EMPTY).filter((i) => i.id !== id);
      const images = { ...s.images };
      if (rest.length) images[draftKey] = rest;
      else delete images[draftKey];
      return { images };
    });
  },
  patch: (draftKey, id, patch) =>
    set((s) => {
      const list = s.images[draftKey];
      if (!list?.some((i) => i.id === id)) return {};
      return { images: { ...s.images, [draftKey]: list.map((i) => (i.id === id ? { ...i, ...patch } : i)) } };
    }),
  clear: (draftKey) => {
    const list = get().images[draftKey];
    if (!list) return;
    for (const image of list) URL.revokeObjectURL(image.url);
    set((s) => {
      const images = { ...s.images };
      delete images[draftKey];
      return { images };
    });
  },
  move: (from, to) =>
    set((s) => {
      const list = s.images[from];
      if (!list) return {};
      const images = { ...s.images, [to]: [...(s.images[to] ?? EMPTY), ...list] };
      delete images[from];
      return { images };
    }),
}));

/** A file the user picked: create a preview address for it. */
export function imageEntry(file: File): Pick<DraftImage, 'id' | 'file' | 'url'> {
  return { id: newId('img'), file, url: URL.createObjectURL(file) };
}

export function useDraftImageList(draftKey: string): DraftImage[] {
  return useDraftImages((s) => s.images[draftKey] ?? EMPTY);
}

/**
 * Upload the images in this draft that have not been uploaded yet, and return references for all images (in the order added).
 * Each image's progress and failure are written back to the store. If one fails, throw the first error; images already uploaded are not uploaded again next time.
 */
export async function uploadDraftImages(
  draftKey: string,
  upload: (file: File, onProgress: (percent: number) => void) => Promise<AttachmentRef>,
): Promise<AttachmentRef[]> {
  const store = useDraftImages.getState();
  const list = store.images[draftKey] ?? EMPTY;
  const results = await Promise.allSettled(
    list.map(async (image) => {
      if (image.ref) return image.ref;
      store.patch(draftKey, image.id, { progress: 0, error: null });
      try {
        const ref = await upload(image.file, (progress) => useDraftImages.getState().patch(draftKey, image.id, { progress }));
        useDraftImages.getState().patch(draftKey, image.id, { ref, progress: null });
        return ref;
      } catch (error) {
        useDraftImages.getState().patch(draftKey, image.id, { progress: null, error: (error as Error).message });
        throw error;
      }
    }),
  );
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
  return results.map((r) => (r as PromiseFulfilledResult<AttachmentRef>).value);
}
