import { create } from 'zustand';
import type { Id } from '@cuccut/protocol';
import type { EditorImageDraft } from '../../model/media-generation.ts';
import { BLANK_IMAGE } from '../../model/tools-image.ts';
import { BLANK_TTS, type TtsDraft } from '../../model/tools-tts.ts';

/**
 * Per-video state for the generation pages in the media panel (design drafts editor.jsx `paneView` and panel-image-gen.jsx `J.drafts[scope]`):
 * which sub-page the Audio tab is on, which segment the Image tab is in, the drafts of the two forms, and the task the generated voice view is showing. It lives at module level:
 * selecting something on the timeline switches the right column to “Properties”, and when you come back the sub-pages and drafts are still there; no fields are added to editor-store.
 */

export type AudioSubpage = 'tts' | 'clone';
export type ImageSegment = 'project' | 'gen';

export interface MediaGenState {
  /** Sub-page of the Audio tab; null means the media list. */
  audio: AudioSubpage | null;
  image: ImageSegment;
  tts: TtsDraft;
  /** The task submitted by the generate-voice sub-page (to follow its progress and result); null means the form is still being filled in. */
  ttsJob: Id | null;
  img: EditorImageDraft;
  /** Whether “Recently generated” has been expanded to show all batches. */
  allImages: boolean;
}

export const BLANK_MEDIA_GEN: MediaGenState = {
  audio: null,
  image: 'project',
  tts: BLANK_TTS,
  ttsJob: null,
  img: { ...BLANK_IMAGE, fit: true },
  allImages: false,
};

interface MediaGenStore {
  byVideo: Record<Id, MediaGenState>;
  patch(videoId: Id, patch: Partial<MediaGenState>): void;
  patchTts(videoId: Id, patch: Partial<TtsDraft>): void;
  patchImage(videoId: Id, patch: Partial<EditorImageDraft>): void;
}

export const useMediaGenStore = create<MediaGenStore>()((set) => ({
  byVideo: {},
  patch: (videoId, patch) => set((s) => ({ byVideo: { ...s.byVideo, [videoId]: { ...(s.byVideo[videoId] ?? BLANK_MEDIA_GEN), ...patch } } })),
  patchTts: (videoId, patch) =>
    set((s) => {
      const cur = s.byVideo[videoId] ?? BLANK_MEDIA_GEN;
      return { byVideo: { ...s.byVideo, [videoId]: { ...cur, tts: { ...cur.tts, ...patch } } } };
    }),
  patchImage: (videoId, patch) =>
    set((s) => {
      const cur = s.byVideo[videoId] ?? BLANK_MEDIA_GEN;
      return { byVideo: { ...s.byVideo, [videoId]: { ...cur, img: { ...cur.img, ...patch } } } };
    }),
}));

/** This video's entry (a blank one when nothing has been recorded; the reference is stable). */
export function useMediaGen(videoId: Id | null): MediaGenState {
  return useMediaGenStore((s) => (videoId ? (s.byVideo[videoId] ?? BLANK_MEDIA_GEN) : BLANK_MEDIA_GEN));
}
