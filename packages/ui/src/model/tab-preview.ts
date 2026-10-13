import type { FileTarget, MediaTarget, SpaceEntry } from '@cuccut/protocol';
import { entryOfTarget, type WorkspaceItem } from './workspace.ts';

/**
 * Pure logic for the tab thumbnail card (product design §3.3 “tab strip”; prototype home-shell-chrome.jsx `WorkspaceTabPreview`).
 * Timing and position live here; the component only wires DOM events.
 */

/** How long the pointer must rest on a tab before the thumbnail card is shown. */
export const TAB_PREVIEW_DELAY_MS = 500;
/** Width of the thumbnail card, and its distance from the viewport edge and from the tab. */
export const TAB_PREVIEW_WIDTH = 280;
export const TAB_PREVIEW_MARGIN = 8;

/** Position of the thumbnail card: left edge aligned with the tab, clamped within the viewport (8 kept on each side), placed 8 below the tab. */
export function tabPreviewPosition(tab: { left: number; bottom: number }, viewportWidth: number) {
  const max = viewportWidth - TAB_PREVIEW_WIDTH - TAB_PREVIEW_MARGIN;
  return { left: Math.max(TAB_PREVIEW_MARGIN, Math.min(tab.left, max)), top: tab.bottom + TAB_PREVIEW_MARGIN };
}

/**
 * Subtitle of the thumbnail card: web pages show the address (blank pages show “新标签页” (“New Tab”)), files and videos show the path inside the project, session tabs show “会话” (“Session”);
 * when no path is found, the title is used. The caller supplies the text in the current language.
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
