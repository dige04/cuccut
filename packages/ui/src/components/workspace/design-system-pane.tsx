import { DESIGN_SYSTEM_ANNOTATION_LIMITS, type FileTarget, type Id } from '@cuccut/protocol';
import ColorHarmony from '@react-spectrum/s2/icons/ColorHarmony';
import { iconStyle } from '@react-spectrum/s2/style' with { type: 'macro' };
import { systemThreads, type DesignSystemAnnotationError } from '../../model/design-system-annotations.ts';
import { DESIGN_SYSTEM } from '../../model/design-system-copy.ts';
import { DESIGN_SYSTEM_PATH_PARAM, designFrameUrl, designSystemPath } from '../../model/design-frame.ts';
import { useDraftDesignSystemAnnotationList, useDraftDesignSystemAnnotations } from '../../state/draft-design-system-annotations-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { EditorPane, type EditorPaneKind } from './editor-pane.tsx';

const headIcon = iconStyle({ size: 'M' });

const ERROR_TEXT: Record<DesignSystemAnnotationError, () => string> = {
  empty: () => DESIGN_SYSTEM.empty,
  'too-long': () => DESIGN_SYSTEM.tooLong(DESIGN_SYSTEM_ANNOTATION_LIMITS.text),
  'too-many': () => DESIGN_SYSTEM.tooMany(DESIGN_SYSTEM_ANNOTATION_LIMITS.perMessage),
};

/**
 * The items for the design-system tab (docs/design/canvas §10): `designSystem.open`; the address carries `?path=`, computed at open time (§10.4); the design-system annotation draft (§10.6). There is no count, so `entryCount` and `countText` are not given.
 * The location the editor gives is 章节 › 种类 “名字” (section › kind “name”); the design system's name is put in front of it.
 */
const DESIGN_SYSTEM_PANE: EditorPaneKind = {
  kind: 'design-system',
  icon: <ColorHarmony styles={headIcon} />,
  copy: DESIGN_SYSTEM,
  open: async (runtime, target) => {
    const result = await runtime.client.request('designSystem.open', target);
    const path = designSystemPath(target, useSpace.getState().entries);
    return {
      url: result.url,
      editorAvailable: result.editorAvailable,
      title: result.system.title,
      count: null,
      ...(path ? { params: { [DESIGN_SYSTEM_PATH_PARAM]: path } } : {}),
    };
  },
  frameUrl: (address) => designFrameUrl(address, window.location),
  // Copy is read when used: it follows the current UI language.
  get blocked() {
    return { title: DESIGN_SYSTEM.hostBlockedTitle, body: DESIGN_SYSTEM.hostBlockedBody };
  },
  annotations: {
    copy: DESIGN_SYSTEM,
    textLimit: DESIGN_SYSTEM_ANNOTATION_LIMITS.text,
    label: (label, title) => DESIGN_SYSTEM.where(title, label),
    useThreads: (conversationId, target) => systemThreads(useDraftDesignSystemAnnotationList(conversationId), target),
    add: (conversationId, system, { anchor, label, detail, section }, text) => {
      const error = useDraftDesignSystemAnnotations.getState().add(conversationId, {
        id: crypto.randomUUID(),
        system,
        anchor,
        ...(section ? { section } : {}),
        label,
        ...(detail ? { detail } : {}),
        text,
      });
      return error ? ERROR_TEXT[error]() : null;
    },
    draftCount: (conversationId) => useDraftDesignSystemAnnotations.getState().annotations[conversationId]?.length ?? 0,
  },
};

/**
 * The design-system tab in the feature pane (docs/design/canvas §10): the design-system editor's iframe with annotations (§10.6). The header has the title, the “annotations” switch, and “show in Space”.
 * The generic parts of the tab (opening, message exchange, saving before sending, jumping, note box) are in `EditorPane`.
 */
export function DesignSystemPane({ target, conversationId, active }: { target: FileTarget; conversationId: Id | null; active: boolean }) {
  return <EditorPane spec={DESIGN_SYSTEM_PANE} target={target} conversationId={conversationId} active={active} />;
}
