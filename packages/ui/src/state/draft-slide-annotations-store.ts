import { create } from 'zustand';
import type { Id } from '@cuccut/protocol';
import { addSlideAnnotation, removeSlideAnnotation, type DraftSlideAnnotation, type SlideAnnotationError } from '../model/slide-annotations.ts';

/**
 * 幻灯片标签里加进对话的标注（docs/design/slides §8.2），按会话 id 分；composer 上显示「幻灯片标注 · N 条」，
 * 发送时随消息交出去。只在这个窗口里，不持久化（同点选的 skill 与附图）。
 * 标注只加在建好的会话上：幻灯片标签所在的位置还没有会话时不收（标签页自己提示）。
 */
interface DraftSlideAnnotationsStore {
  /** 会话 id → 按添加顺序的标注。 */
  annotations: Record<Id, readonly DraftSlideAnnotation[]>;
  /** 接在后面加一条；加不进去时返回原因，草稿不变。 */
  add(conversationId: Id, note: DraftSlideAnnotation): SlideAnnotationError | null;
  remove(conversationId: Id, id: string): void;
  clear(conversationId: Id): void;
  /** 发出去了：摘掉发出去的那几条（发送期间新加的留着）。 */
  sent(conversationId: Id, ids: readonly string[]): void;
}

const EMPTY: readonly DraftSlideAnnotation[] = [];

export const useDraftSlideAnnotations = create<DraftSlideAnnotationsStore>()((set, get) => {
  const write = (conversationId: Id, next: readonly DraftSlideAnnotation[]) =>
    set((s) => {
      if (next === (s.annotations[conversationId] ?? EMPTY)) return {};
      const annotations = { ...s.annotations };
      if (next.length) annotations[conversationId] = next;
      else delete annotations[conversationId];
      return { annotations };
    });
  return {
    annotations: {},
    add: (conversationId, note) => {
      const { list, error } = addSlideAnnotation(get().annotations[conversationId] ?? EMPTY, note);
      if (!error) write(conversationId, list);
      return error;
    },
    remove: (conversationId, id) => write(conversationId, removeSlideAnnotation(get().annotations[conversationId] ?? EMPTY, id)),
    clear: (conversationId) => write(conversationId, EMPTY),
    sent: (conversationId, ids) => {
      const gone = new Set(ids);
      const before = get().annotations[conversationId] ?? EMPTY;
      const after = before.filter((n) => !gone.has(n.id));
      write(conversationId, after.length === before.length ? before : after);
    },
  };
});

/** 这个会话草稿里的标注；没有时是同一个空数组（订阅不抖）。 */
export function useDraftSlideAnnotationList(conversationId: Id | null): readonly DraftSlideAnnotation[] {
  return useDraftSlideAnnotations((s) => (conversationId ? (s.annotations[conversationId] ?? EMPTY) : EMPTY));
}
