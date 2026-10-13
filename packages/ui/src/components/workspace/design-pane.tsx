import { DESIGN_ANNOTATION_LIMITS, type FileTarget, type Id } from '@cuccut/protocol';
import Shapes from '@react-spectrum/s2/icons/Shapes';
import { iconStyle } from '@react-spectrum/s2/style' with { type: 'macro' };
import { boardOfDetail, canvasThreads, type DesignAnnotationError } from '../../model/design-annotations.ts';
import { DESIGN } from '../../model/design-copy.ts';
import { designFrameUrl } from '../../model/design-frame.ts';
import { useDraftDesignAnnotationList, useDraftDesignAnnotations } from '../../state/draft-design-annotations-store.ts';
import { EditorPane, type EditorPaneKind } from './editor-pane.tsx';

const headIcon = iconStyle({ size: 'M' });

const ERROR_TEXT: Record<DesignAnnotationError, () => string> = {
  empty: () => DESIGN.empty,
  'too-long': () => DESIGN.tooLong(DESIGN_ANNOTATION_LIMITS.text),
  'too-many': () => DESIGN.tooMany(DESIGN_ANNOTATION_LIMITS.perMessage),
};

/** The items for the design tab: `design.open`, “N artboards”, the design annotation draft, and export (docs/design/canvas §8). */
const DESIGN_PANE: EditorPaneKind = {
  kind: 'design',
  icon: <Shapes styles={headIcon} />,
  copy: DESIGN,
  open: async (runtime, target) => {
    const result = await runtime.client.request('design.open', target);
    return { url: result.url, editorAvailable: result.editorAvailable, title: result.canvas.title, count: result.canvas.boardCount };
  },
  entryCount: (entry) => entry.canvas?.boardCount ?? null,
  countText: (n) => DESIGN.boards(n),
  frameUrl: (address) => designFrameUrl(address, window.location),
  // Copy is read when used: it follows the current UI language.
  get blocked() {
    return { title: DESIGN.hostBlockedTitle, body: DESIGN.hostBlockedBody };
  },
  // The whole-document export and the export in the editor both go through CucCut's save (§8.3)
  exports: DESIGN,
  annotations: {
    copy: DESIGN,
    textLimit: DESIGN_ANNOTATION_LIMITS.text,
    useThreads: (conversationId, target) => canvasThreads(useDraftDesignAnnotationList(conversationId), target),
    add: (conversationId, canvas, { anchor, label, detail, area }, text) => {
      const board = boardOfDetail(detail);
      const error = useDraftDesignAnnotations.getState().add(conversationId, {
        id: crypto.randomUUID(),
        canvas,
        anchor,
        ...(board ? { board } : {}),
        label,
        ...(detail ? { detail } : {}),
        ...(area ? { area: true } : {}),
        text,
      });
      return error ? ERROR_TEXT[error]() : null;
    },
    draftCount: (conversationId) => useDraftDesignAnnotations.getState().annotations[conversationId]?.length ?? 0,
  },
};

/**
 * The design tab in the feature pane (docs/design/canvas §8.1): the design editor's iframe with annotations (§8.2).
 * The generic parts of the tab (opening, message exchange, saving before sending, jumping, note box) are in `EditorPane`.
 */
export function DesignPane({ target, conversationId, active }: { target: FileTarget; conversationId: Id | null; active: boolean }) {
  return <EditorPane spec={DESIGN_PANE} target={target} conversationId={conversationId} active={active} />;
}
