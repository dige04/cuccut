import { SLIDE_ANNOTATION_LIMITS, type FileTarget, type SlideAnnotation } from '@cuccut/protocol';
import type { EditorThread } from '@cuccut/slides/editor-messages';
import { targetKey } from './workspace.ts';

/**
 * 会话里的幻灯片标注（docs/design/slides §8.2、§9）：草稿的增删、编辑器里的编号标记与发送时交出去的那一份。
 * 移植自原型 designs/cuccut/app/model-home-slides.js（`add`、`remove`、`pins`）。纯函数，无 React、无 DOM。
 *
 * 草稿挂在会话上（草稿键是会话 id）：幻灯片标签往里加，composer 读它显示「幻灯片标注 · N 条」，发送后随消息记入会话，
 * 草稿清空，编辑器里的编号标记随之消失。编号是在整份草稿里的序号，composer 列表、编辑器标记与给智能体的那段文字一致。
 */

/** 草稿里的一条：协议的 `SlideAnnotation` 加一个只在界面里用的 id（删除、编辑器的编号标记、跳转用）。 */
export type DraftSlideAnnotation = SlideAnnotation & { id: string };

/** 加不进去的原因：空的、超长的、超过条数的。 */
export type SlideAnnotationError = 'empty' | 'too-long' | 'too-many';

/** 新加一条：批注去掉首尾空白；空的、超长的、超过条数的都不收。 */
export function addSlideAnnotation(
  list: readonly DraftSlideAnnotation[],
  note: DraftSlideAnnotation,
): { list: readonly DraftSlideAnnotation[]; error: SlideAnnotationError | null } {
  const text = note.text.trim();
  if (!text) return { list, error: 'empty' };
  if (text.length > SLIDE_ANNOTATION_LIMITS.text) return { list, error: 'too-long' };
  if (list.length >= SLIDE_ANNOTATION_LIMITS.perMessage) return { list, error: 'too-many' };
  return { list: [...list, { ...note, text }], error: null };
}

export function removeSlideAnnotation(list: readonly DraftSlideAnnotation[], id: string): readonly DraftSlideAnnotation[] {
  return list.some((n) => n.id === id) ? list.filter((n) => n.id !== id) : list;
}

/** 编辑器里这份 deck 的编号标记：编号是在整份草稿里的序号，与 composer 列表一致。 */
export function deckThreads(list: readonly DraftSlideAnnotation[], deck: FileTarget): EditorThread[] {
  const key = targetKey(deck);
  return list.flatMap((n, i) => (targetKey(n.deck) === key ? [{ id: n.id, anchor: n.anchor, n: i + 1 }] : []));
}

/** 随消息交出去的那一份：去掉界面里的 id，字段按协议排。 */
export function sentSlideAnnotations(list: readonly DraftSlideAnnotation[]): SlideAnnotation[] {
  return list.map(({ deck, anchor, slideId, label, detail, area, text }) => ({
    deck,
    anchor,
    ...(slideId ? { slideId } : {}),
    label,
    ...(detail ? { detail } : {}),
    ...(area ? { area } : {}),
    text,
  }));
}

/**
 * 运行时给模型的定位描述里带的 slide id（`Slide 3 #s03 …`、`Area on slide 3 #s03 …`）；没有时 undefined。
 * 只有 deck 里写了 id 的页才有。
 */
export function slideIdOfDetail(detail: string | undefined): string | undefined {
  return detail?.match(/\b[Ss]lide \d+ #([A-Za-z0-9][\w-]{0,199})/)?.[1];
}

/** 已发送消息里的一条在编辑器里跳转用的 id：消息 id 加序号（发出去的不在草稿里，没有草稿 id）。 */
export function sentAnnotationId(messageId: string, index: number): string {
  return `${messageId}:${index}`;
}
