import { SLIDE_ANNOTATION_LIMITS, type FileTarget, type Id } from '@cuccut/protocol';
import Layout from '@react-spectrum/s2/icons/Layout';
import { iconStyle } from '@react-spectrum/s2/style' with { type: 'macro' };
import { deckThreads, slideIdOfDetail, type SlideAnnotationError } from '../../model/slide-annotations.ts';
import { SLIDES } from '../../model/slides-copy.ts';
import { useDraftSlideAnnotationList, useDraftSlideAnnotations } from '../../state/draft-slide-annotations-store.ts';
import { EditorPane, type EditorPaneKind } from './editor-pane.tsx';

const headIcon = iconStyle({ size: 'M' });

const ERROR_TEXT: Record<SlideAnnotationError, () => string> = {
  empty: () => SLIDES.empty,
  'too-long': () => SLIDES.tooLong(SLIDE_ANNOTATION_LIMITS.text),
  'too-many': () => SLIDES.tooMany(SLIDE_ANNOTATION_LIMITS.perMessage),
};

/** The pieces of the slides tab: `slides.open`, “N pages”, and the draft slide annotations (docs/design/slides §8). */
const SLIDES_PANE: EditorPaneKind = {
  kind: 'slides',
  icon: <Layout styles={headIcon} />,
  copy: SLIDES,
  open: async (runtime, target) => {
    const result = await runtime.client.request('slides.open', target);
    return { url: result.url, editorAvailable: result.editorAvailable, title: result.deck.title, count: result.deck.slideCount };
  },
  entryCount: (entry) => entry.deck?.slideCount ?? null,
  countText: (n) => SLIDES.pages(n),
  annotations: {
    copy: SLIDES,
    textLimit: SLIDE_ANNOTATION_LIMITS.text,
    useThreads: (conversationId, target) => deckThreads(useDraftSlideAnnotationList(conversationId), target),
    add: (conversationId, deck, { anchor, label, detail, area }, text) => {
      const slideId = slideIdOfDetail(detail);
      const error = useDraftSlideAnnotations.getState().add(conversationId, {
        id: crypto.randomUUID(),
        deck,
        anchor,
        ...(slideId ? { slideId } : {}),
        label,
        ...(detail ? { detail } : {}),
        ...(area ? { area: true } : {}),
        text,
      });
      return error ? ERROR_TEXT[error]() : null;
    },
    draftCount: (conversationId) => useDraftSlideAnnotations.getState().annotations[conversationId]?.length ?? 0,
  },
};

/**
 * The slides tab in the workspace area (docs/design/slides §8.1): the Slides editor's iframe plus annotations (§8.2).
 * The tab's shared parts (open, message exchange, save before sending, jump, comment boxes) live in `EditorPane`.
 */
export function SlidesPane({ target, conversationId, active }: { target: FileTarget; conversationId: Id | null; active: boolean }) {
  return <EditorPane spec={SLIDES_PANE} target={target} conversationId={conversationId} active={active} />;
}
