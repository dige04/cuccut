import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import {
  inspectorBeside,
  CONVERSATION_TAB,
  DOCK_DEFAULT,
  EDITOR_MIN_WIDTH,
  EMPTY_WORKSPACE,
  clampDock,
  closeTab,
  dockFor,
  dragOffsets,
  dragTarget,
  entryOfTarget,
  fullViewEntry,
  isNarrow,
  isVideoReferenced,
  itemKey,
  moveTab,
  openTab,
  narrowShowsConversation,
  reconcileTabs,
  replaceTab,
  restoreKey,
  resizeSplit,
  safeUrl,
  tabKeyIndex,
  tabsButton,
  targetKey,
  updateWebUrl,
  workspaceMode,
  workspaceTitle,
  type WorkspaceItem,
} from './workspace.ts';

const video: WorkspaceItem = { kind: 'video', target: { projectId: 'p1', path: '视频/第一部' } };
const file: WorkspaceItem = { kind: 'file', target: { conversationId: 'c1', path: 'notes.md' } };
const files: WorkspaceItem = { kind: 'files' };
const web: WorkspaceItem = { kind: 'web', id: 'w1', url: '' };

describe('tab opening, closing and ordering', () => {
  it('opening a tab with the same key replaces it in place, without duplicating; closing the current tab selects the next one at the same position', () => {
    let state = openTab(openTab(openTab(EMPTY_WORKSPACE, video), file), files);
    state = openTab(state, video);
    expect(state.tabs).toEqual([video, file, files]);
    expect(state.active).toBe(itemKey(video));
    state = closeTab(state, itemKey(video));
    expect(state).toEqual({ tabs: [file, files], active: itemKey(file) });
    expect(closeTab(state, 'nope')).toBe(state);
  });

  it('replaceTab replaces a tab in place and selects it; if the new tab is already open, it is moved over; when the tab does not exist it is equivalent to opening', () => {
    const state = { tabs: [video, web, file], active: itemKey(web) };
    expect(replaceTab(state, itemKey(web), files)).toEqual({ tabs: [video, files, file], active: 'files' });
    expect(replaceTab(state, itemKey(web), file)).toEqual({ tabs: [video, file], active: itemKey(file) });
    expect(replaceTab(state, 'nope', files)).toEqual(openTab(state, files));
  });

  it('moveTab moves to before or after the target; returns the original object when nothing changed', () => {
    const state = { tabs: [video, file, files], active: null };
    expect(moveTab(state, 'files', itemKey(video)).tabs).toEqual([files, video, file]);
    expect(moveTab(state, itemKey(video), 'files', true).tabs).toEqual([file, files, video]);
    expect(moveTab(state, itemKey(video), itemKey(file))).toBe(state);
  });
});

describe('collapsing and restoring the right-side area', () => {
  it('leaving a tab by route collapses and remembers the tab just left; \'show right area\' returns to it', () => {
    const open = { tabs: [video, file, files], active: itemKey(file) };
    const collapsed = reconcileTabs(open, undefined);
    expect(collapsed).toEqual({ tabs: open.tabs, active: null, last: itemKey(file) });
    expect(reconcileTabs(collapsed, undefined)).toBe(collapsed);
    expect(restoreKey(collapsed)).toBe(itemKey(file));
    expect(restoreKey(open)).toBe(itemKey(file));
  });

  it('if the remembered tab was closed, returns to the last one; null when there are none', () => {
    const collapsed = { tabs: [video, file], active: null, last: 'files' };
    expect(restoreKey(collapsed)).toBe(itemKey(file));
    expect(closeTab({ tabs: [video, file], active: null, last: itemKey(file) }, itemKey(file))).toEqual({ tabs: [video], active: null });
    expect(closeTab({ tabs: [video, file], active: null, last: itemKey(file) }, itemKey(video)).last).toBe(itemKey(file));
    expect(restoreKey(EMPTY_WORKSPACE)).toBeNull();
  });

  it('reopening a tab no longer carries the remembered tab', () => {
    const collapsed = { tabs: [video], active: null, last: itemKey(video) };
    expect(reconcileTabs(collapsed, files)).toEqual({ tabs: [video, files], active: 'files' });
  });
});

describe('web tab changes address', () => {
  it('changes the url in place, without changing the current tab or order; returned as is when the tab does not exist or nothing changed', () => {
    const state = { tabs: [web, video], active: itemKey(video) };
    const next = updateWebUrl(state, 'w1', 'https://example.com/');
    expect(next).toEqual({ tabs: [{ ...web, url: 'https://example.com/' }, video], active: itemKey(video) });
    expect(updateWebUrl(next, 'w1', 'https://example.com/')).toBe(next);
    expect(updateWebUrl(state, 'nope', 'https://example.com/')).toBe(state);
  });
});

describe('which conversations\' tabs still reference a video', () => {
  it('a video is not closed while any tab group still contains it', () => {
    const key = targetKey(video.kind === 'video' ? video.target : { entryId: '' });
    expect(isVideoReferenced({ c1: { tabs: [file], active: null }, c2: { tabs: [video], active: null } }, key)).toBe(true);
    expect(isVideoReferenced({ c1: { tabs: [file], active: null } }, key)).toBe(false);
    // A “file” tab at the same path does not count as a video.
    expect(isVideoReferenced({ c1: { tabs: [{ kind: 'file', target: { projectId: 'p1', path: '视频/第一部' } }], active: null } }, key)).toBe(false);
  });
});

describe('conversation column width and narrow window', () => {
  it('width is at least 320, rounded, and is no longer stuck at 560', () => {
    expect(clampDock(100)).toBe(320);
    expect(clampDock(900)).toBe(900);
    expect(clampDock(400.4)).toBe(400);
    expect(clampDock(NaN)).toBe(DOCK_DEFAULT);
    expect(DOCK_DEFAULT).toBe(380);
  });

  it('the conversation column keeps 320 on the right, but can exceed the previous 45%', () => {
    expect(dockFor(2000, 380)).toBe(380);
    expect(dockFor(1400, 1000)).toBe(1000);
    expect(dockFor(1000, 900)).toBe(680);
    expect(dockFor(600, 380)).toBe(320);
  });

  it('after dragging past the right side\'s minimum width, tracking continues; it hides only at the 160 threshold, and can expand when dragged back', () => {
    expect(resizeSplit(800, 1400)).toEqual({ width: 800, hidden: false });
    expect(resizeSplit(1240, 1400)).toEqual({ width: 1080, hidden: false });
    expect(resizeSplit(1241, 1400)).toEqual({ width: 1080, hidden: true });
    expect(resizeSplit(1700, 1400)).toEqual({ width: 1080, hidden: true });
    expect(resizeSplit(950, 1400)).toEqual({ width: 950, hidden: false });
    expect(resizeSplit(100, 1400)).toEqual({ width: 320, hidden: false });
  });

  it('narrow mode depends only on the container and does not change with the conversation width while dragging', () => {
    expect(EDITOR_MIN_WIDTH).toBe(695);
    expect(isNarrow(1400)).toBe(false);
    expect(isNarrow(1015)).toBe(false);
    expect(isNarrow(1014)).toBe(true);
    expect(isNarrow(960)).toBe(true);
    for (const width of [0, -1, NaN, Infinity]) expect(isNarrow(width)).toBe(false);
  });

  it('switching to a single column: if focus is in the conversation area or feature area, collapses and selects the conversation, otherwise stays on the current tab', () => {
    expect(narrowShowsConversation(true, true)).toBe(true);
    expect(narrowShowsConversation(false, false)).toBe(true);
    expect(narrowShowsConversation(false, true)).toBe(false);
  });
});

describe('tab names and entries', () => {
  const entry = (id: string, patch: Partial<SpaceEntry>): SpaceEntry => ({
    id,
    kind: 'video',
    name: id,
    fileName: id,
    source: { projectId: 'p1', conversationId: null },
    relPath: id,
    size: 0,
    lastActivityAt: '2026-10-01T00:00:00.000Z',
    status: null,
    user: { favorite: false, displayName: null, trashedAt: null },
    ...patch,
  });

  it('project file, web hostname, entry name; when the entry is not found, uses the last path segment, otherwise it is unavailable', () => {
    expect(workspaceTitle(files)).toBe('项目文件');
    expect(workspaceTitle(web)).toBe('新标签页');
    expect(workspaceTitle({ kind: 'web', id: 'w', url: 'https://example.com/a' })).toBe('example.com');
    // Local files outside the desktop working directory: the tab name is the last segment of the path, and the key is kept separate from the conversation path.
    const local = { kind: 'file' as const, target: { localPath: 'D:\\Downie\\talk.md' } };
    expect(workspaceTitle(local)).toBe('talk.md');
    expect(workspaceTitle({ kind: 'file', target: { localPath: '/Volumes/SSD/talk.md' } })).toBe('talk.md');
    expect(itemKey(local)).toBe('file:l:D:\\Downie\\talk.md');
    expect(workspaceTitle({ kind: 'web', id: 'w', url: 'https://example.com/a' }, '示例页面')).toBe('示例页面');
    expect(workspaceTitle(video, '宣传片')).toBe('宣传片');
    expect(workspaceTitle(video)).toBe('第一部');
    expect(workspaceTitle({ kind: 'video', target: { entryId: 'e1' } })).toBe('视频不可用');
    expect(workspaceTitle({ kind: 'file', target: { entryId: 'e1' } })).toBe('文件不可用');
    // Slides (a deck directory): keyed by directory, kept separate from videos and files in the same directory. The name falls back to the directory name.
    const slides = { kind: 'slides' as const, target: { conversationId: 'c1', path: 'decks/talk/' } };
    expect(itemKey(slides)).toBe(`slides:${targetKey(slides.target)}`);
    expect(workspaceTitle(slides)).toBe('talk');
    expect(workspaceTitle(slides, '季度回顾')).toBe('季度回顾');
    expect(workspaceTitle({ kind: 'slides', target: { entryId: 'e1' } })).toBe('幻灯片不可用');
    // Design systems (directories containing design-system.json): the same approach. The key is kept separate from design drafts in the same directory.
    const system = { kind: 'design-system' as const, target: { projectId: 'p1', path: 'systems/brand' } };
    expect(itemKey(system)).toBe(`design-system:${targetKey(system.target)}`);
    expect(itemKey(system)).not.toBe(itemKey({ kind: 'design', target: system.target }));
    expect(workspaceTitle(system)).toBe('brand');
    expect(workspaceTitle(system, '品牌设计系统')).toBe('品牌设计系统');
    expect(workspaceTitle({ kind: 'design-system', target: { entryId: 'e1' } })).toBe('设计系统不可用');
  });

  it('finds a Space entry by entry id, project path or conversation path', () => {
    const entries = [
      entry('e1', { relPath: '视频/第一部', name: '第一部' }),
      entry('e2', { relPath: 'notes.md', source: { projectId: null, conversationId: 'c1' } }),
    ];
    expect(entryOfTarget(entries, { entryId: 'e2' })?.id).toBe('e2');
    expect(entryOfTarget(entries, { projectId: 'p1', path: '视频/第一部' })?.id).toBe('e1');
    expect(entryOfTarget(entries, { conversationId: 'c1', path: 'notes.md' })?.id).toBe('e2');
    expect(entryOfTarget(entries, { projectId: 'p2', path: '视频/第一部' })).toBeUndefined();
  });
});

describe('tab bar keyboard and dragging', () => {
  it('left and right wrap around; Home / End go to the ends', () => {
    expect(tabKeyIndex('ArrowRight', 2, 3)).toBe(0);
    expect(tabKeyIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(tabKeyIndex('Home', 2, 3)).toBe(0);
    expect(tabKeyIndex('End', 0, 3)).toBe(2);
    expect(tabKeyIndex('Enter', 0, 3)).toBeNull();
    expect(tabKeyIndex('ArrowRight', 0, 0)).toBeNull();
  });

  it('dragging determines the target by untransformed slots; neighbors shift to the order after drop', () => {
    const rects = [
      { key: 'a', left: 0, width: 100 },
      { key: 'b', left: 104, width: 100 },
      { key: 'c', left: 208, width: 100 },
    ];
    expect(dragTarget(rects, 'a', 180)).toEqual({ key: 'c', after: false });
    expect(dragTarget(rects, 'a', 300)).toEqual({ key: 'c', after: true });
    expect(dragOffsets(rects, 'a', { key: 'c', after: true })).toEqual({ b: -104, c: -104, a: 208 });
  });
});

describe('workspace view', () => {
  const view = (hidden: boolean, full: boolean) => ({ hidden, full });

  it('full view requires tabs; single = narrow window or full view; in single, a collapsed feature area means the conversation is selected', () => {
    expect(workspaceMode({ active: 'a', count: 1, view: view(false, false), narrow: false })).toEqual({
      visible: true,
      full: false,
      single: false,
      conversation: false,
    });
    expect(workspaceMode({ active: null, count: 0, view: view(false, true), narrow: false })).toEqual({
      visible: false,
      full: false,
      single: false,
      conversation: false,
    });
    expect(workspaceMode({ active: null, count: 2, view: view(true, true), narrow: false })).toEqual({
      visible: false,
      full: true,
      single: true,
      conversation: true,
    });
    expect(workspaceMode({ active: 'a', count: 2, view: view(false, false), narrow: true })).toMatchObject({ single: true, conversation: false });
  });

  it('entering full view keeps the slot on screen: if split is visible it is the current tab, otherwise the conversation', () => {
    expect(fullViewEntry(true, 'web:1')).toBe('web:1');
    expect(fullViewEntry(false, 'web:1')).toBe(CONVERSATION_TAB);
    expect(fullViewEntry(true, null)).toBe(CONVERSATION_TAB);
  });

  it('tabs button: no tabs → open; full view → split; split visible → hide; collapsed → show and list tabs', () => {
    expect(tabsButton({ count: 0, visible: false, full: false })).toEqual({ action: 'open', glyph: 'tabs-plus', listed: false });
    expect(tabsButton({ count: 3, visible: true, full: true })).toEqual({ action: 'split', glyph: 'hide-tabs', listed: false });
    expect(tabsButton({ count: 3, visible: false, full: true })).toEqual({ action: 'split', glyph: 'hide-tabs', listed: false });
    expect(tabsButton({ count: 3, visible: true, full: false })).toEqual({ action: 'hide', glyph: 'hide-tabs', listed: false });
    expect(tabsButton({ count: 3, visible: false, full: false })).toEqual({ action: 'show', glyph: 'count', badge: '3', listed: true });
    expect(tabsButton({ count: 9, visible: false, full: false }).badge).toBe('9');
    expect(tabsButton({ count: 10, visible: false, full: false }).badge).toBe('9+');
  });
});

describe('address bar input', () => {
  it('only http/https is recognized; localhost and host:port get the protocol added', () => {
    expect(safeUrl('example.com')).toBe('https://example.com/');
    expect(safeUrl('localhost:3000')).toBe('http://localhost:3000/');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://u:p@example.com')).toBeNull();
  });
});

describe('inspector beside the docked conversation', () => {
  it('sits beside only when the editor keeps its minimum width', () => {
    // 1280 window: 1248 content, 380 dock -> 1248 - 380 - 312 = 556 < 695.
    expect(inspectorBeside(1248, 380)).toBe(false);
    // 1600 window: 1568 content -> 876 left for the editor.
    expect(inspectorBeside(1568, 380)).toBe(true);
    // A wider conversation column takes the room back.
    expect(inspectorBeside(1568, 600)).toBe(false);
    expect(inspectorBeside(0, 380)).toBe(false);
    expect(inspectorBeside(Number.NaN, 380)).toBe(false);
  });
});
