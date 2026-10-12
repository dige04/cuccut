import { DESIGN_ANNOTATION_LIMITS, type DesignAnnotation, type FileTarget } from '@cuccut/protocol';
import type { EditorThread } from '@cuccut/slides/editor-messages';
import { targetKey } from './workspace.ts';

/**
 * 会话里的设计稿标注（docs/design/canvas §8.2、§9）：草稿的增删、编辑器里的编号标记与发送时交出去的那一份。
 * 移植自原型 designs/cuccut/app/model-home-design.js（`add`、`remove`、`pins`），与幻灯片标注（slide-annotations.ts）同一套规则。
 * 纯函数，无 React、无 DOM。编号是在这个会话的设计稿标注草稿里的序号；幻灯片标注各自编号。
 */

/** 草稿里的一条：协议的 `DesignAnnotation` 加一个只在界面里用的 id（删除、编辑器的编号标记、跳转用）。 */
export type DraftDesignAnnotation = DesignAnnotation & { id: string };

/** 加不进去的原因：空的、超长的、超过条数的。 */
export type DesignAnnotationError = 'empty' | 'too-long' | 'too-many';

/** 新加一条：批注去掉首尾空白；空的、超长的、超过条数的都不收。 */
export function addDesignAnnotation(
  list: readonly DraftDesignAnnotation[],
  note: DraftDesignAnnotation,
): { list: readonly DraftDesignAnnotation[]; error: DesignAnnotationError | null } {
  const text = note.text.trim();
  if (!text) return { list, error: 'empty' };
  if (text.length > DESIGN_ANNOTATION_LIMITS.text) return { list, error: 'too-long' };
  if (list.length >= DESIGN_ANNOTATION_LIMITS.perMessage) return { list, error: 'too-many' };
  return { list: [...list, { ...note, text }], error: null };
}

export function removeDesignAnnotation(list: readonly DraftDesignAnnotation[], id: string): readonly DraftDesignAnnotation[] {
  return list.some((n) => n.id === id) ? list.filter((n) => n.id !== id) : list;
}

/** 编辑器里这份设计稿的编号标记：编号是在整份草稿里的序号，与 composer 列表一致。 */
export function canvasThreads(list: readonly DraftDesignAnnotation[], canvas: FileTarget): EditorThread[] {
  const key = targetKey(canvas);
  return list.flatMap((n, i) => (targetKey(n.canvas) === key ? [{ id: n.id, anchor: n.anchor, n: i + 1 }] : []));
}

/** 随消息交出去的那一份：去掉界面里的 id，字段按协议排。 */
export function sentDesignAnnotations(list: readonly DraftDesignAnnotation[]): DesignAnnotation[] {
  return list.map(({ canvas, anchor, board, label, detail, area, text }) => ({
    canvas,
    anchor,
    ...(board ? { board } : {}),
    label,
    ...(detail ? { detail } : {}),
    ...(area ? { area } : {}),
    text,
  }));
}

/** 画板文件的路径（相对设计稿目录）：每段以字母、数字或 `_` 开头，以 `.dc.html` 结尾（设计稿的格式，skill design SKILL.md）。 */
const BOARD = String.raw`(?:[A-Za-z0-9_][A-Za-z0-9_.-]*/)*[A-Za-z0-9_][A-Za-z0-9_.-]*\.dc\.html`;
const ELEMENT_DETAIL = new RegExp(`^(${BOARD})(?::\\s|$)`);
const AREA_DETAIL = new RegExp(`^Area over (${BOARD}) \\([^)]*\\)(?::[^;]*)?$`);

/**
 * 运行时给模型的定位描述里的画板文件：元素与整块画板是 `Main.dc.html: #… button "…"` / `Main.dc.html`，
 * 只落在一块画板上的区域是 `Area over Main.dc.html (part): …`（运行时 comments/labels.ts）。
 * 跨几块画板的区域、画布上的空白处与便签没有单一的画板，返回 undefined。
 */
export function boardOfDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail.match(ELEMENT_DETAIL)?.[1] ?? detail.match(AREA_DETAIL)?.[1];
}
