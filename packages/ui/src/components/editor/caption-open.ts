import type { CaptionItem } from '@cuccut/protocol';
import { create } from 'zustand';
import { useEditor } from '../../state/editor-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { openGallery } from './caption-gallery.tsx';
import { chooseChip, focusDocument } from './transcribe-run.ts';
import { openFlow, setCompare } from './translate-run.ts';

/**
 * Opens the caption panel from a caption on screen (double-click a caption on the stage, or the Edit button on the caption toolbar): lands on this caption's document, with the translated caption shown alongside its translation; collapses the style library and the translation flow, and reveals the caption list.
 */
export function openCaptionEditor(item: CaptionItem): void {
  const video = useVideo.getState().video;
  if (video?.videoId) {
    const records = video.state?.video.documents ?? {};
    const source = records[item.documentId]?.sourceDocumentId;
    const translation = source && records[source]?.kind === 'translation' ? source : null;
    setCompare(video.videoId, { mode: translation ? 'trans' : 'src', documentId: translation });
    openGallery(video.videoId, false);
    openFlow(video.videoId, false);
    focusDocument(video.videoId, item.documentId);
  }
  useEditor.getState().showPanel('subtitle');
}

/** Opens the caption style library, landing on this caption track chip (the properties page's “Change style”, the caption toolbar's Styles). */
export function openCaptionStyles(chipKey: string | undefined): void {
  const videoId = useVideo.getState().video?.videoId;
  if (videoId && chipKey) {
    chooseChip(videoId, chipKey);
    openGallery(videoId, true);
  }
  useEditor.getState().showPanel('subtitle');
}

/** The section of the properties page to scroll to (the caption toolbar's “Animation” → “Current word”); cleared once the properties page has scrolled. */
export const useCaptionSection = create<{ focus: 'active' | null }>(() => ({ focus: null }));

/** The caption toolbar's “Animation”: selects this caption, opens the properties page, and scrolls to the “Current word” section (for the 倒鸭子 (daoyazi) effect, to that section). */
export function openCaptionActive(item: CaptionItem): void {
  const videoId = useVideo.getState().video?.videoId;
  if (videoId) openGallery(videoId, false);
  useEditor.getState().select([item.id]);
  useCaptionSection.setState({ focus: 'active' });
}
