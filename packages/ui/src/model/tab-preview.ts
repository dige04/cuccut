import type { FileTarget, MediaTarget, SpaceEntry } from '@cuccut/protocol';
import { entryOfTarget, type WorkspaceItem } from './workspace.ts';

/**
 * 页签缩略卡的纯逻辑（产品设计 §3.3「页签条」；原型 home-shell-chrome.jsx `WorkspaceTabPreview`）。
 * 计时与位置都在这里，组件只接 DOM 事件。
 */

/** 指针在页签上停多久显示缩略卡。 */
export const TAB_PREVIEW_DELAY_MS = 500;
/** 缩略卡的宽度与它离视口边缘、离页签的距离。 */
export const TAB_PREVIEW_WIDTH = 280;
export const TAB_PREVIEW_MARGIN = 8;

/** 缩略卡的位置：左缘对齐页签、夹在视口里（两侧各留 8），顶在页签下方 8。 */
export function tabPreviewPosition(tab: { left: number; bottom: number }, viewportWidth: number) {
  const max = viewportWidth - TAB_PREVIEW_WIDTH - TAB_PREVIEW_MARGIN;
  return { left: Math.max(TAB_PREVIEW_MARGIN, Math.min(tab.left, max)), top: tab.bottom + TAB_PREVIEW_MARGIN };
}

/**
 * 缩略卡的副标题：网页写地址（空白页写「新标签页」），文件与视频写项目内路径，会话页签写「会话」；
 * 找不到路径时用标题。文字由调用方按当前语言给。
 */
export function tabPreviewSubtitle(
  item: WorkspaceItem | 'conversation',
  { title, conversation, newTab, entries }: { title: string; conversation: string; newTab: string; entries: readonly SpaceEntry[] },
): string {
  if (item === 'conversation') return conversation;
  if (item.kind === 'web') return item.url || newTab;
  if (item.kind === 'files') return title;
  return targetPath(item.target, entries) || title;
}

function targetPath(target: FileTarget | MediaTarget, entries: readonly SpaceEntry[]): string {
  if ('path' in target) return target.path;
  if ('entryId' in target) return entryOfTarget(entries, target)?.relPath ?? '';
  return '';
}
