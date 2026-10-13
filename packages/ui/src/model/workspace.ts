import { defineMessages, type FileTarget, type MediaTarget, type Id, type SpaceEntry } from '@cuccut/protocol';
import { zhHans } from './workspace.zh-Hans.ts';
import { zhHant } from './workspace.zh-Hant.ts';
import { ja } from './workspace.ja.ts';
import { ko } from './workspace.ko.ts';
import { es } from './workspace.es.ts';
import { fr } from './workspace.fr.ts';
import { de } from './workspace.de.ts';
import { nl } from './workspace.nl.ts';
import { ptBR } from './workspace.pt-BR.ts';
import { it } from './workspace.it.ts';
import { ru } from './workspace.ru.ts';
import { pl } from './workspace.pl.ts';
import { tr } from './workspace.tr.ts';
import { vi } from './workspace.vi.ts';

/** Fallback text for tab names (translations are in `workspace.<language>.ts`). */
const en = {
  newTab: 'New tab',
  projectFiles: 'Project files',
  videoUnavailable: 'Video unavailable',
  fileUnavailable: 'File unavailable',
  slidesUnavailable: 'Slides unavailable',
  designUnavailable: 'Design unavailable',
  designSystemUnavailable: 'Design system unavailable',
};
export type WorkspaceMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The tabs in the Home workspace area (product design §2.5, §3.3 user revision): videos, single files, project file browsing, web pages, slides (a deck directory, docs/design/slides §8.1),
 * design drafts (directories containing `canvas.json`, docs/design/canvas §8.1), and design systems (directories containing `design-system.json`, §10.6).
 * Each conversation keeps its own set of tabs, and the route carries only the current one. Previewing does not change the conversation's write target.
 */
export type WorkspaceItem =
  | { kind: 'video'; target: FileTarget }
  | { kind: 'file'; target: MediaTarget; name?:string }
  | { kind: 'files' }
  | { kind: 'web'; id: string; url: string }
  | { kind: 'slides'; target: FileTarget }
  | { kind: 'design'; target: FileTarget }
  | { kind: 'design-system'; target: FileTarget };

/** A tab that opens a directory in the editor running in an iframe (`EditorPane`). */
export type EditorKind = 'slides' | 'design' | 'design-system';

/** Editor tabs with annotations. All three kinds have them: slides (docs/design/slides §8.2), design drafts and design systems (docs/design/canvas §8.2, §10.6). */
export type AnnotatedEditorKind = EditorKind;

export interface WorkspaceTabs {
  tabs: WorkspaceItem[];
  /** The key of the current tab. null means the workspace area is collapsed (the conversation takes the main area). */
  active: string | null;
  /** The last current tab before collapsing. “Show right area” returns to it (prototype home-workspace-store.jsx `remembered`). */
  last?: string;
}

export const EMPTY_WORKSPACE: WorkspaceTabs = { tabs: [], active: null };

/** The workspace key for a new conversation (no first sentence yet): inside a project, or not belonging to one. */
export function workspaceKey(conversationId: Id | null, projectId: Id | null): string {
  if (conversationId) return conversationId;
  return projectId ? `new:${projectId}` : 'new';
}

export function itemKey(item: WorkspaceItem): string {
  switch (item.kind) {
    case 'video':
      return `video:${targetKey(item.target)}`;
    case 'file':
      return `file:${targetKey(item.target)}`;
    case 'files':
      return 'files';
    case 'web':
      return `web:${item.id}`;
    case 'slides':
      return `slides:${targetKey(item.target)}`;
    case 'design':
      return `design:${targetKey(item.target)}`;
    case 'design-system':
      return `design-system:${targetKey(item.target)}`;
  }
}

export function targetKey(target: MediaTarget): string {
  if ('attachmentId' in target) return `a:${target.conversationId}:${target.attachmentId}`;
  if ('assetId' in target) return `v:${target.videoId}:${target.assetId}:${target.revision??''}`;
  if ('entryId' in target) return `e:${target.entryId}`;
  if ('localPath' in target) return `l:${target.localPath}`;
  if ('projectId' in target) return `p:${target.projectId}:${target.path}`;
  return `c:${target.conversationId}:${target.path}`;
}

/** Opens (or switches to) a tab. If a tab with the same key exists, it is updated in place; otherwise it is added at the end. */
export function openTab(state: WorkspaceTabs, item: WorkspaceItem): WorkspaceTabs {
  const key = itemKey(item);
  const exists = state.tabs.some((t) => itemKey(t) === key);
  return {
    tabs: exists ? state.tabs.map((t) => (itemKey(t) === key ? item : t)) : [...state.tabs, item],
    active: key,
  };
}

/**
 * Replaces a tab in place (prototype model-home-workspace.js `replace`). The new tab takes the position of `key` and becomes current, like a browser navigating within the same tab page.
 * If the new tab is already open elsewhere, it is moved over rather than kept twice. If there is no tab with `key`, this equals `openTab`.
 */
export function replaceTab(state: WorkspaceTabs, key: string, item: WorkspaceItem): WorkspaceTabs {
  if (!state.tabs.some((t) => itemKey(t) === key)) return openTab(state, item);
  const next = itemKey(item);
  const tabs = state.tabs.filter((t) => itemKey(t) !== next || itemKey(t) === key).map((t) => (itemKey(t) === key ? item : t));
  return { tabs, active: next };
}

/** Closes a tab. If the current tab is closed, the next one in the same position takes over (or the previous one if there is none). */
export function closeTab(state: WorkspaceTabs, key: string): WorkspaceTabs {
  const index = state.tabs.findIndex((t) => itemKey(t) === key);
  if (index < 0) return state;
  const tabs = state.tabs.filter((_, i) => i !== index);
  const next = tabs[Math.min(index, tabs.length - 1)];
  const active = state.active === key ? (next ? itemKey(next) : null) : state.active;
  return state.last && state.last !== key ? { tabs, active, last: state.last } : { tabs, active };
}

/** Moves `key` in front of `targetKey` (after it when `after`). */
export function moveTab(state: WorkspaceTabs, key: string, target: string, after = false): WorkspaceTabs {
  if (key === target) return state;
  const item = state.tabs.find((t) => itemKey(t) === key);
  if (!item || !state.tabs.some((t) => itemKey(t) === target)) return state;
  const tabs = state.tabs.filter((t) => t !== item);
  tabs.splice(tabs.findIndex((t) => itemKey(t) === target) + (after ? 1 : 0), 0, item);
  return tabs.every((t, i) => t === state.tabs[i]) ? state : { ...state, tabs };
}

/** Whether any conversation's tab group still has this video open (`key` is `targetKey`). It is only really closed when none does. */
export function isVideoReferenced(workspaces: Record<string, WorkspaceTabs>, key: string): boolean {
  return Object.values(workspaces).some((book) => book.tabs.some((t) => t.kind === 'video' && targetKey(t.target) === key));
}

/** When the route switches to one of this conversation's tabs (or to none), the tab group follows. When collapsing, the tab that was just current is remembered. Returns the original object when nothing changes. */
export function reconcileTabs(state: WorkspaceTabs, pane: WorkspaceItem | undefined): WorkspaceTabs {
  const next = pane ? openTab(state, pane) : state.active === null ? state : { tabs: state.tabs, active: null, last: state.active };
  return JSON.stringify(next) === JSON.stringify(state) ? state : next;
}

/** Which tab “Show right area” returns to: the current one, the one before collapsing, or the last one if neither exists (prototype `toggleWorkspace`). */
export function restoreKey(state: WorkspaceTabs): string | null {
  const has = (key: string | null | undefined): key is string => !!key && state.tabs.some((t) => itemKey(t) === key);
  if (has(state.active)) return state.active;
  if (has(state.last)) return state.last;
  const tail = state.tabs.at(-1);
  return tail ? itemKey(tail) : null;
}

/**
 * Turns address bar input into a URL that can be opened. Returns null when the input is not a URL (the caller turns it into a search).
 * Only http and https are allowed. Every form except the plain URL forms is rejected. localhost and `host:port` get the protocol added.
 */
export function safeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(text);
    const hostPort = /^[^\s/:?#]+\.[^\s/:?#]+:\d+(?:[/?#]|$)/.test(text);
    const url = new URL(
      local ? `http://${text}` : hostPort ? `https://${text}` : /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`,
    );
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** The name of a web tab: the hostname. When there is no address yet, it is “New tab page”. */
export function webTitle(url: string): string {
  try {
    return new URL(url).hostname || M.newTab;
  } catch {
    return M.newTab;
  }
}

export interface TabRect {
  key: string;
  left: number;
  width: number;
}

/** When dragging a tab, decide where it lands by its untransformed slots. Neighbors that are mid-animation do not push the target away. */
export function dragTarget(rects: TabRect[], key: string, x: number): { key: string; after: boolean } | null {
  const others = rects.filter((r) => r.key !== key);
  if (!others.length) return null;
  const next = others.find((r) => x < r.left + r.width / 2);
  return next ? { key: next.key, after: false } : { key: others.at(-1)!.key, after: true };
}

/** How far each tab shifts during the drag preview so that they line up in the order they will have after dropping. */
export function dragOffsets(
  rects: TabRect[],
  key: string,
  target: { key: string; after: boolean } | null,
  gap = 4,
): Record<string, number> {
  if (!target || !rects.length) return {};
  const from = rects.findIndex((r) => r.key === key);
  const to = rects.findIndex((r) => r.key === target.key);
  if (from < 0 || to < 0) return {};
  const order = rects.filter((r) => r.key !== key);
  order.splice(order.findIndex((r) => r.key === target.key) + (target.after ? 1 : 0), 0, rects[from]!);
  let left = rects[0]!.left;
  const offsets: Record<string, number> = {};
  for (const rect of order) {
    offsets[rect.key] = left - rect.left;
    left += rect.width + gap;
  }
  return offsets;
}

/** The conversation column is at least 320 and defaults to 380. The maximum width is set by the workspace. Double-clicking the seam in the middle returns it to the default. */
export const DOCK_MIN = 320;
export const DOCK_DEFAULT = 380;
export const PANE_MIN_WIDTH = 320;
export const PANE_HIDE_WIDTH = PANE_MIN_WIDTH / 2;

export function clampDock(width: number): number {
  return Number.isFinite(width) ? Math.round(Math.max(DOCK_MIN, width)) : DOCK_DEFAULT;
}

/** In normal split layout, keep a minimum width for the right side. The actual pointer can still cross this boundary (product-design §3.3). */
export function dockFor(contentWidth: number, dock: number): number {
  return Math.max(DOCK_MIN, Math.min(clampDock(dock), contentWidth - PANE_MIN_WIDTH));
}

export function resizeSplit(conversationWidth: number, contentWidth: number): { width: number; hidden: boolean } {
  return { width: dockFor(contentWidth, conversationWidth), hidden: contentWidth - conversationWidth < PANE_HIDE_WIDTH };
}

/** Editor minimum width: toolbar 68 + seam 7 + panel 300 + preview 320. */
export const EDITOR_MIN_WIDTH = 695;

/** Width of the selection inspector when it sits as a column of its own beside the docked conversation. */
export const INSPECTOR_SIDE_WIDTH = 280;

/**
 * Whether the docked layout can put the selection inspector beside the conversation (a column of its own, 16px gaps)
 * and still leave the open tab its minimum editor width; otherwise the inspector stacks under the conversation.
 */
export function inspectorBeside(contentWidth: number, dock: number): boolean {
  if (!Number.isFinite(contentWidth) || contentWidth <= 0) return false;
  return contentWidth - dockFor(contentWidth, dock) - 16 - INSPECTOR_SIDE_WIDTH - 16 >= EDITOR_MIN_WIDTH;
}

/**
 * Narrow mode is decided only by the container width. It must not switch with the width of the dragged conversation column, or dragging would be interrupted before the collapse threshold.
 * The prototype approximates this as 960px. The app reserves 320 for the narrowest conversation plus the actual editor width of 695 (product-design §3.3).
 */
export function isNarrow(contentWidth: number): boolean {
  return Number.isFinite(contentWidth) && contentWidth > 0 && contentWidth < DOCK_MIN + EDITOR_MIN_WIDTH;
}

/**
 * Which tab is chosen at the moment the split switches to a single column (prototype `narrowShowsConversation`). If focus is in the conversation area, or the workspace area was already collapsed, the conversation is chosen.
 * Otherwise it stays on the tab in use.
 */
export function narrowShowsConversation(focusInConversation: boolean, paneVisible: boolean): boolean {
  return focusInConversation || !paneVisible;
}

/** The name on a tab (prototype model-home-workspace.js `title`): project files, the web page title (or the hostname when there is no title yet), or the name of a file, video or slide (a slide falls back to its directory name). */
export function workspaceTitle(item: WorkspaceItem, name?: string | null): string {
  if (item.kind === 'files') return M.projectFiles;
  if (item.kind === 'web') return name || webTitle(item.url);
  if (name) return name;
  if (item.kind==='file'&&item.name) return item.name;
  const path = ('path' in item.target ? item.target.path : 'localPath' in item.target ? item.target.localPath : '').replace(/[\\/]+$/, '');
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  return base || (item.kind === 'video' ? M.videoUnavailable : item.kind === 'slides' ? M.slidesUnavailable : item.kind === 'design' ? M.designUnavailable : item.kind === 'design-system' ? M.designSystemUnavailable : M.fileUnavailable);
}

/** The page in a web tab navigated to a new address: update this tab's `url` in place, without changing the current tab or the order. Returns the original object if there is no such tab or nothing changed. */
export function updateWebUrl(state: WorkspaceTabs, id: string, url: string): WorkspaceTabs {
  const index = state.tabs.findIndex((t) => t.kind === 'web' && t.id === id);
  const tab = state.tabs[index];
  if (!tab || tab.kind !== 'web' || tab.url === url) return state;
  const tabs = state.tabs.slice();
  tabs[index] = { ...tab, url };
  return { ...state, tabs };
}

/** The Space entry for a tab: matched by entry id, or by source directory plus relative path. */
export function entryOfTarget(entries: readonly SpaceEntry[], target: MediaTarget): SpaceEntry | undefined {
  if ('entryId' in target) return entries.find((e) => e.id === target.entryId);
  if ('projectId' in target) return entries.find((e) => e.source.projectId === target.projectId && e.relPath === target.path);
  return 'path' in target ? entries.find((e) => e.source.conversationId === target.conversationId && e.relPath === target.path) : undefined;
}

/** Arrow keys on the tab bar: left and right cycle; Home and End go to the ends. Other keys return null. */
export function tabKeyIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowLeft') return (index + count - 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * The fixed first tab of the conversation in narrow windows and the full view (product design §2.5, §3.3). It is not in `tabs`, so moving, closing, and routing do not see it.
 */
export const CONVERSATION_TAB = '__conversation__';

/** Each conversation's own view (a new conversation is keyed by its draft key): workspace area collapsed (the conversation tab selected), and the full view. */
export interface WorkspaceView {
  hidden: boolean;
  full: boolean;
}

export const DEFAULT_VIEW: WorkspaceView = { hidden: false, full: false };

/**
 * Three layouts (product design §2.5, §3.3 user revision): conversation (workspace area collapsed), split (conversation on the left, tabs on the right), and full view (one tab bar, with the conversation as the fixed first cell).
 * Narrow windows and the full view share one tab bar (`single`). When no tab is shown in that single tab bar, the conversation tab is selected (`conversation`).
 * The full view needs tabs: without any, it does not apply even if `full` was remembered.
 */
export function workspaceMode(input: { active: string | null; count: number; view: WorkspaceView; narrow: boolean }): {
  visible: boolean;
  full: boolean;
  single: boolean;
  conversation: boolean;
} {
  const visible = !!input.active && !input.view.hidden;
  const full = input.view.full && input.count > 0;
  const single = input.narrow || full;
  return { visible, full, single, conversation: single && !visible };
}

/** The cell to choose when entering the full view: keep what is on screen. A tab that is showing stays selected; otherwise the conversation tab is selected. */
export function fullViewEntry(paneVisible: boolean, active: string | null): string {
  return paneVisible && active ? active : CONVERSATION_TAB;
}

export type TabsButtonAction = 'open' | 'split' | 'hide' | 'show';

/** The look and action of the “Tabs” button in the title bar. */
export interface TabsButtonState {
  action: TabsButtonAction;
  /** `tabs-plus`: a small plus sign in the tab box. `hide-tabs`: hides the tabs icon. `count`: the tab box shows the number of tabs. */
  glyph: 'tabs-plus' | 'hide-tabs' | 'count';
  /** Only with `count`: the number in the box. Nine or more is written as “9+”. */
  badge?: string;
  /** Only with `count` (split collapsed): hovering lists the open tabs. */
  listed: boolean;
}

/**
 * The “Tabs” button (rightmost in the title bar's button group): with no tabs, it opens a new tab page. In the full view, it returns to split. When the split is showing, it hides the tabs.
 * When the split is collapsed, it shows the tab count. Clicking shows the tabs; hovering lists the open tabs.
 */
export function tabsButton({ count, visible, full }: { count: number; visible: boolean; full: boolean }): TabsButtonState {
  if (!count) return { action: 'open', glyph: 'tabs-plus', listed: false };
  if (full) return { action: 'split', glyph: 'hide-tabs', listed: false };
  if (visible) return { action: 'hide', glyph: 'hide-tabs', listed: false };
  return { action: 'show', glyph: 'count', badge: count > 9 ? '9+' : String(count), listed: true };
}
