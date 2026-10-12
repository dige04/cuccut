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
 * 设计系统标签的那几样（docs/design/canvas §10）：`designSystem.open`，地址另带 `?path=`（打开那一刻算好，§10.4），
 * 设计系统标注的草稿（§10.6）；没有计数，所以不给 `entryCount` 与 `countText`。
 * 编辑器给的位置是「章节 › 种类 “名字”」，前面加上是哪套设计系统。
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
  // 取值时才读文案：跟着当前的界面语言。
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
 * 功能区的设计系统标签（docs/design/canvas §10）：设计系统编辑器的 iframe 加标注（§10.6）。头部是标题、「标注」开关与「在 Space 中显示」。
 * 标签的通用部分（打开、消息往来、发送前保存、跳转、批注框）在 `EditorPane`。
 */
export function DesignSystemPane({ target, conversationId, active }: { target: FileTarget; conversationId: Id | null; active: boolean }) {
  return <EditorPane spec={DESIGN_SYSTEM_PANE} target={target} conversationId={conversationId} active={active} />;
}
