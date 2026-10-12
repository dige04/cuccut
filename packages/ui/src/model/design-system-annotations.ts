import { DESIGN_SYSTEM_ANNOTATION_LIMITS, type DesignSystemAnnotation, type FileTarget } from '@cuccut/protocol';
import type { EditorThread } from '@cuccut/slides/editor-messages';
import { targetKey } from './workspace.ts';

/**
 * 会话里的设计系统标注（docs/design/canvas §10.6）：草稿的增删、编辑器里的编号标记与发送时交出去的那一份。
 * 移植自原型 designs/cuccut/app/model-home-design-system-notes.js（`add`、`remove`、`pins`），与设计稿标注（design-annotations.ts）
 * 同一套规则。纯函数，无 React、无 DOM。编号是在这个会话的设计系统标注草稿里的序号；幻灯片、设计稿标注各自编号。
 */

/** 草稿里的一条：协议的 `DesignSystemAnnotation` 加一个只在界面里用的 id（删除、编辑器的编号标记、跳转用）。 */
export type DraftDesignSystemAnnotation = DesignSystemAnnotation & { id: string };

/** 加不进去的原因：空的、超长的、超过条数的。 */
export type DesignSystemAnnotationError = 'empty' | 'too-long' | 'too-many';

/** 新加一条：批注去掉首尾空白；空的、超长的、超过条数的都不收。 */
export function addDesignSystemAnnotation(
  list: readonly DraftDesignSystemAnnotation[],
  note: DraftDesignSystemAnnotation,
): { list: readonly DraftDesignSystemAnnotation[]; error: DesignSystemAnnotationError | null } {
  const text = note.text.trim();
  if (!text) return { list, error: 'empty' };
  if (text.length > DESIGN_SYSTEM_ANNOTATION_LIMITS.text) return { list, error: 'too-long' };
  if (list.length >= DESIGN_SYSTEM_ANNOTATION_LIMITS.perMessage) return { list, error: 'too-many' };
  return { list: [...list, { ...note, text }], error: null };
}

export function removeDesignSystemAnnotation(list: readonly DraftDesignSystemAnnotation[], id: string): readonly DraftDesignSystemAnnotation[] {
  return list.some((n) => n.id === id) ? list.filter((n) => n.id !== id) : list;
}

/** 编辑器里这套设计系统的编号标记：编号是在整份草稿里的序号，与 composer 列表一致；带上章节，跳回去时先到那一章。 */
export function systemThreads(list: readonly DraftDesignSystemAnnotation[], system: FileTarget): EditorThread[] {
  const key = targetKey(system);
  return list.flatMap((n, i) =>
    targetKey(n.system) === key ? [{ id: n.id, anchor: n.anchor, n: i + 1, ...(n.section ? { section: n.section } : {}) }] : [],
  );
}

/** 随消息交出去的那一份：去掉界面里的 id，字段按协议排。 */
export function sentDesignSystemAnnotations(list: readonly DraftDesignSystemAnnotation[]): DesignSystemAnnotation[] {
  return list.map(({ system, anchor, section, label, detail, text }) => ({
    system,
    anchor,
    ...(section ? { section } : {}),
    label,
    ...(detail ? { detail } : {}),
    text,
  }));
}
