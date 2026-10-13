import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webVideoHref, type FileTarget } from '@cuccut/protocol';
import { HOME, WELCOME, defaultRoute, hasSidebar, hrefFor, migrateShell, parseHref, railTabOf, useShell, type Route } from './shell-store.ts';
import { itemKey } from '../model/workspace.ts';

// Node has no usable localStorage: give persistence an in-memory version, loaded before the store module.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
});

const routes: Route[] = [
  HOME,
  { tab: 'home', conversationId: 'c1', projectId: null },
  { tab: 'home', conversationId: null, projectId: 'p1' },
  { tab: 'space', category: 'all', projectId: null },
  { tab: 'space', category: 'favorite', projectId: 'p1' },
  { tab: 'home', conversationId: 'c1', projectId: null, pane: { kind: 'video', target: { projectId: 'p1', path: '我的 视频/第一部' } } },
  { tab: 'home', conversationId: null, projectId: null, pane: { kind: 'video', target: { conversationId: 'c1', path: 'a?b=c&d' } } },
  { tab: 'home', conversationId: 'c1', projectId: null, pane: { kind: 'file', target: { conversationId: 'c1', path: 'notes.md' } } },
  { tab: 'home', conversationId: null, projectId: 'p1', pane: { kind: 'files' } },
  { tab: 'home', conversationId: 'c1', projectId: null, pane: { kind: 'slides', target: { conversationId: 'c1', path: 'decks/季度 回顾' } } },
  { tab: 'home', conversationId: null, projectId: 'p1', pane: { kind: 'slides', target: { projectId: 'p1', path: 'talk' } } },
  { tab: 'home', conversationId: 'c1', projectId: null, pane: { kind: 'design', target: { conversationId: 'c1', path: 'designs/落地 页' } } },
  { tab: 'home', conversationId: null, projectId: 'p1', pane: { kind: 'design', target: { entryId: 'e2' } } },
  { tab: 'home', conversationId: 'c1', projectId: null, pane: { kind: 'design-system', target: { conversationId: 'c1', path: 'design-systems/品牌 系统' } } },
  { tab: 'home', conversationId: null, projectId: 'p1', pane: { kind: 'design-system', target: { projectId: 'p1', path: 'brand' } } },
  { tab: 'home', conversationId: 'c1', projectId: null, pane: { kind: 'web', id: 'w1', url: 'https://example.com/a?b=1&c=2' } },
  { tab: 'space', category: 'video', projectId: null, video: { entryId: 'e1' } },
  { tab: 'settings', section: 'diagnostics' },
  { tab: 'settings', section: 'agent' },
  { tab: 'settings', section: 'skills' },
  { tab: 'settings', section: 'privacy' },
  { tab: 'settings', section: 'packs' },
  { tab: 'settings', section: 'packs', sub: 'import' },
  { tab: 'settings', section: 'packs', sub: 'export' },
  { tab: 'settings', section: 'packs', sub: 'news-desk' },
  { tab: 'settings', section: 'publishing' },
  { tab: 'models', category: 'asr' },
  { tab: 'models', category: 'tts', page: 'voices' },
  { tab: 'tasks' },
  { tab: 'tasks', taskId: 't/1' },
  { tab: 'tools' },
  { tab: 'tools', tool: 'translate-subtitles' },
  { tab: 'services' },
  { tab: 'services', service: 'runtime' },
  { tab: 'welcome' },
  { tab: 'calendar' },
  { tab: 'calendar', projectId: 'p1', view: 'week', day: '2026-10-14', publicationId: 'pub 1' },
  { tab: 'calendar', view: 'agenda' },
  { tab: 'calendar', publicationId: 'pub_2' },
];

describe('in-app links', () => {
  it('hrefFor and parseHref are inverses', () => {
    for (const route of routes) expect(parseHref(hrefFor(route))).toEqual(route);
  });

  it('the web access link\'s video address (webVideoHref) goes through parseHref to this video in the Home feature area, and hrefFor again yields the same address', () => {
    const targets: FileTarget[] = [
      { projectId: 'p1', path: '我的 视频/第一部' },
      { conversationId: 'c1', path: 'a?b=c&d#e' },
      { entryId: 'e1' },
    ];
    for (const target of targets) {
      const href = webVideoHref(target);
      const route = parseHref(href);
      expect(route).toEqual({ tab: 'home', conversationId: null, projectId: null, pane: { kind: 'video', target } });
      expect(hrefFor(route)).toBe(href);
    }
  });

  it('unrecognized links return to Home or the starting point of that entry', () => {
    expect(parseHref('/nope')).toEqual(HOME);
    expect(parseHref('/space/bogus')).toEqual({ tab: 'space', category: 'all', projectId: null });
    expect(parseHref('/settings/bogus')).toEqual({ tab: 'settings', section: 'general' });
    expect(parseHref('/settings/packs/Not%20an%20id')).toEqual({ tab: 'settings', section: 'packs' });
    expect(parseHref('/settings/skills/Not%20an%20id')).toEqual({ tab: 'settings', section: 'skills' });
    expect(parseHref('/settings/general/news-desk')).toEqual({ tab: 'settings', section: 'general' });
    expect(hrefFor({ tab: 'settings', section: 'packs', sub: 'news-desk' })).toBe('/settings/packs/news-desk');
    expect(parseHref('/home?template=Bad_Id')).toEqual(HOME);
    expect(parseHref('/tools/bogus')).toEqual({ tab: 'tools' });
  });

  it('the pack page’s item links: a template opens in Home’s template gallery, a skill in its Skills details', () => {
    const template = { tab: 'home', conversationId: null, projectId: null, template: 'news-desk-daily' } as const;
    expect(hrefFor(template)).toBe('/home?template=news-desk-daily');
    expect(parseHref('/home?template=news-desk-daily')).toEqual(template);
    const skill = { tab: 'settings', section: 'skills', sub: 'tiêu-đề' } as const;
    expect(hrefFor(skill)).toBe('/settings/skills/ti%C3%AAu-%C4%91%E1%BB%81');
    expect(parseHref(hrefFor(skill))).toEqual(skill);
    expect(parseHref('/settings/skills/news-desk-headlines')).toEqual({ tab: 'settings', section: 'skills', sub: 'news-desk-headlines' });
  });

  it('publication calendar links: query values are kept, unreadable ones are left out', () => {
    expect(hrefFor({ tab: 'calendar' })).toBe('/calendar');
    expect(hrefFor({ tab: 'calendar', projectId: 'p1', view: 'month', day: '2026-10-01', publicationId: 'x' })).toBe(
      '/calendar?projectId=p1&view=month&day=2026-10-01&publication=x',
    );
    expect(parseHref('/calendar?view=year&day=2026-02-30&projectId=p1')).toEqual({ tab: 'calendar', projectId: 'p1' });
    expect(parseHref('/calendar?publication=pub_1')).toEqual({ tab: 'calendar', publicationId: 'pub_1' });
    expect(hasSidebar({ tab: 'calendar' })).toBe(false);
  });

  it('legacy link migration: the models page in settings goes to the models tab, remote compute in tools goes to services', () => {
    expect(parseHref('/settings/voices')).toEqual({ tab: 'models', category: 'tts', page: 'voices' });
    expect(parseHref('/tools/remote')).toEqual({ tab: 'services', service: 'remote' });
  });

  it('legacy link migration: /settings/agent/<tab> goes to the new location; unrecognized pages fall to Agent providers', () => {
    expect(parseHref('/settings/agent/skills')).toEqual({ tab: 'settings', section: 'skills' });
    expect(parseHref('/settings/agent/permissions')).toEqual({ tab: 'settings', section: 'privacy' });
    expect(parseHref('/settings/agent/advanced')).toEqual({ tab: 'settings', section: 'agent' });
    expect(parseHref('/settings/agent/connect')).toEqual({ tab: 'settings', section: 'agent' });
    expect(parseHref('/settings/agent/bogus')).toEqual({ tab: 'settings', section: 'agent' });
    expect(parseHref('/settings/agent')).toEqual({ tab: 'settings', section: 'agent' });
    expect(parseHref('/settings/skills')).toEqual({ tab: 'settings', section: 'skills' });
  });

  it('legacy link migration: old short names of tools land on the new page for the registry ID', () => {
    expect(parseHref('/tools/translate')).toEqual({ tab: 'tools', tool: 'translate-subtitles' });
    expect(parseHref('/tools/compress')).toEqual({ tab: 'tools', tool: 'compress-video' });
    expect(parseHref('/tools/tts')).toEqual({ tab: 'tools', tool: 'synthesize-speech' });
    expect(parseHref('/tools/link-import')).toEqual({ tab: 'tools', tool: 'link-import' });
  });

  it('except for settings, every entry has a page sidebar; the sidebar remains when a video is opened', () => {
    expect(hasSidebar({ tab: 'space', category: 'video', projectId: null, video: { entryId: 'e1' } })).toBe(true);
    expect(hasSidebar({ tab: 'tasks', taskId: 't1' })).toBe(true);
    expect(hasSidebar({ tab: 'settings', section: 'about' })).toBe(false);
    expect(hasSidebar({ tab: 'models', category: 'llm' })).toBe(false);
    expect(hasSidebar({ tab: 'welcome' })).toBe(false);
  });

  it('/welcome is the full-screen interview, and it belongs to Home', () => {
    expect(parseHref('/welcome')).toEqual({ tab: 'welcome' });
    expect(parseHref('/welcome/extra')).toEqual({ tab: 'welcome' });
    expect(hrefFor({ tab: 'welcome' })).toBe('/welcome');
    expect(railTabOf({ tab: 'welcome' })).toBe('home');
    expect(defaultRoute('welcome')).toEqual(WELCOME);
  });
});

describe('back and forward, and entries', () => {
  beforeEach(() => useShell.setState({ route: HOME, back: [], forward: [], lastRoute: {} }));

  it('model configuration belongs to settings: after leaving and returning to settings the category is restored; clicking again returns to General', () => {
    const { go, goTab, replace, goBack, goForward } = useShell.getState();
    const model = { tab: 'models' as const, category: 'tts' as const, page: 'voices' as const };
    go(model);
    expect(useShell.getState().lastRoute.settings).toEqual(model);
    goTab('tools');
    goTab('settings');
    expect(useShell.getState().route).toEqual(model);
    goTab('settings');
    expect(useShell.getState().route).toEqual({ tab: 'settings', section: 'general' });
    replace(model);
    goTab('tools');
    goBack();
    expect(useShell.getState().lastRoute.settings).toEqual(model);
    goForward();
    expect(useShell.getState().route).toEqual({ tab: 'tools' });
  });

  it('the interview is a detour: leaving it, Home goes back to where it was, not to /welcome', () => {
    const { go, goTab, goBack, goForward } = useShell.getState();
    const conversation: Route = { tab: 'home', conversationId: 'c1', projectId: null };
    go(conversation);
    go({ tab: 'settings', section: 'you' });
    go(WELCOME);
    expect(useShell.getState().route).toEqual(WELCOME);
    expect(useShell.getState().lastRoute.home).toEqual(conversation);
    goBack();
    goForward();
    expect(useShell.getState().lastRoute.home).toEqual(conversation);
    goTab('tools');
    goTab('home');
    expect(useShell.getState().route).toEqual(conversation);
    // On /welcome itself, Home is the landing page (the same entry clicked again).
    go(WELCOME);
    goTab('home');
    expect(useShell.getState().route).toEqual(HOME);
  });

  it('go pushes to history, goBack / goForward move back and forth, a new go clears forward', () => {
    const { go, goBack, goForward } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    go({ tab: 'tasks' });
    goBack();
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null });
    goForward();
    expect(useShell.getState().route).toEqual({ tab: 'tasks' });
    goBack();
    go({ tab: 'tools' });
    expect(useShell.getState().forward).toEqual([]);
  });

  it('the same location is not pushed to history twice; replace does not push to history', () => {
    const { go, replace } = useShell.getState();
    go({ tab: 'tasks' });
    go({ tab: 'tasks' });
    replace({ tab: 'space', category: 'image', projectId: null });
    expect(useShell.getState().back).toEqual([HOME]);
  });

  it('clicking the rail returns to where that entry was last; when already in that entry, returns to the starting point', () => {
    const { go, goTab } = useShell.getState();
    go({ tab: 'space', category: 'image', projectId: 'p1' });
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    goTab('space');
    expect(useShell.getState().route).toEqual({ tab: 'space', category: 'image', projectId: 'p1' });
    goTab('space');
    expect(useShell.getState().route).toEqual({ tab: 'space', category: 'all', projectId: null });
  });
});

describe('Home feature area tabs', () => {
  beforeEach(() => useShell.setState({ route: HOME, back: [], forward: [], lastRoute: {}, workspaces: {} }));
  const video = { kind: 'video', target: { projectId: 'p1', path: 'v' } } as const;
  const files = { kind: 'files' } as const;

  it('open tabs are recorded under the session; switching sessions and coming back, the tabs are still there', () => {
    const { go, openPane } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(video);
    openPane(files);
    go({ tab: 'home', conversationId: 'c2', projectId: null });
    expect(useShell.getState().workspaces.c2).toBeUndefined();
    useShell.getState().goBack();
    expect(useShell.getState().workspaces.c1?.tabs).toEqual([video, files]);
  });

  it('closing the current tab, the neighbor takes over; closing the last one returns to only the session', () => {
    const { go, openPane, closePane } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(video);
    openPane(files);
    closePane('files');
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: video });
    useShell.getState().closeVideo();
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null });
    expect(useShell.getState().workspaces.c1).toEqual({ tabs: [], active: null });
  });

  const view = (key = 'c1') => useShell.getState().views[key];
  const hidden = (key = 'c1') => view(key)?.hidden ?? false;

  it('show / hide tabs: when shown, collapses, clicking again brings it back; when there is no tab on the route, returns to the one from before collapsing', () => {
    useShell.setState({ views: {}, workspaceNarrow: false, hiddenBeforeNarrow: false });
    const { go, openPane, toggleWorkspace } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(video);
    openPane(files);
    toggleWorkspace();
    expect(view()).toEqual({ hidden: true, full: false });
    toggleWorkspace();
    expect(view()).toBeUndefined();
    // Returning to a conversation-only position from the sidebar: the tab group records files; showing it again returns to that position.
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    expect(useShell.getState().workspaces.c1).toEqual({ tabs: [video, files], active: null, last: 'files' });
    useShell.getState().toggleWorkspace();
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: files });
  });

  it('without tabs, the tabs button opens a blank web tab and shows the split view; the full-view button is unchanged', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, toggleWorkspace, toggleWorkspaceFull } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    toggleWorkspaceFull();
    expect(view()).toBeUndefined();
    toggleWorkspace();
    const route = useShell.getState().route;
    expect(route.tab === 'home' && route.pane).toMatchObject({ kind: 'web', url: '' });
    expect(useShell.getState().workspaces.c1?.tabs).toHaveLength(1);
    expect(view()).toBeUndefined();
  });

  it('the view is remembered per workspace: switching sessions does not carry it over; it is still there when coming back', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, openPane, toggleWorkspace } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(video);
    toggleWorkspace();
    go({ tab: 'home', conversationId: 'c2', projectId: null });
    openPane(files);
    expect(view('c2')).toBeUndefined();
    useShell.getState().goBack();
    useShell.getState().goBack();
    expect(view()).toEqual({ hidden: true, full: false });
  });

  it('entering full view keeps the cell on screen; on exit the session returns to the left and the last tab returns to the right', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, openPane, toggleWorkspace, toggleWorkspaceFull } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(video);
    openPane(files);
    // Split view visible: in full view, it is the current tab.
    toggleWorkspaceFull();
    expect(view()).toEqual({ hidden: false, full: true });
    // In full view, the tabs button returns to split view.
    toggleWorkspace();
    expect(view()).toBeUndefined();
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: files });
    // Side panel collapsed: in full view it is the conversation; after exiting, split view comes back.
    toggleWorkspace();
    toggleWorkspaceFull();
    expect(view()).toEqual({ hidden: true, full: true });
    toggleWorkspaceFull();
    expect(view()).toBeUndefined();
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: files });
    // With no tab on the route, entering full view selects the conversation; on exit it returns to the recorded tab.
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    toggleWorkspaceFull();
    expect(view()).toEqual({ hidden: true, full: true });
    toggleWorkspaceFull();
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: files });
  });

  it('tab list: a row opens in split view, the trailing item opens in full view; closing the last tab leaves full view', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, openPane, toggleWorkspace, showWorkspaceTab, closePane } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(video);
    openPane(files);
    toggleWorkspace();
    const back = useShell.getState().back.length;
    showWorkspaceTab(itemKey(video), false);
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: video });
    expect(view()).toBeUndefined();
    expect(useShell.getState().back.length).toBe(back);
    toggleWorkspace();
    showWorkspaceTab('files', true);
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: files });
    expect(view()).toEqual({ hidden: false, full: true });
    showWorkspaceTab('missing', false);
    expect(view()).toEqual({ hidden: false, full: true });
    closePane('files');
    expect(view()).toEqual({ hidden: false, full: true });
    closePane(itemKey(video));
    expect(view()).toBeUndefined();
  });

  it('a tool card on the start page replaces the new-tab page in place: position and tab count unchanged, route switches to the new tab, no history entry; if the new tab is already open, it is moved here', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, openPane, replaceWorkspaceTab } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: 'p1' });
    const start = { kind: 'web', id: 'w1', url: '' } as const;
    const page = { kind: 'file', target: { projectId: 'p1', path: '新网页.html' } } as const;
    openPane(video);
    openPane(start);
    openPane({ kind: 'web', id: 'w2', url: 'https://example.com/' });
    useShell.getState().selectPane(itemKey(start));
    const back = useShell.getState().back.length;
    replaceWorkspaceTab(itemKey(start), files);
    expect(useShell.getState().workspaces.c1).toMatchObject({ tabs: [video, files, { id: 'w2' }], active: 'files' });
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: 'p1', pane: files });
    expect(useShell.getState().back.length).toBe(back);

    // Opening a new tab page and switching to a tab that is already open: move it to the start page's position so there are no two copies.
    const second = { kind: 'web', id: 'w3', url: '' } as const;
    openPane(second);
    useShell.getState().movePane(itemKey(second), itemKey(video), false);
    replaceWorkspaceTab(itemKey(second), files);
    expect(useShell.getState().workspaces.c1?.tabs.map(itemKey)).toEqual(['files', itemKey(video), 'web:w2']);
    expect(useShell.getState().route).toMatchObject({ pane: files });

    // The start page is already gone (e.g. closed): open as usual.
    replaceWorkspaceTab('web:gone', page);
    expect(useShell.getState().workspaces.c1?.tabs.map(itemKey)).toEqual(['files', itemKey(video), 'web:w2', itemKey(page)]);
    expect(useShell.getState().route).toMatchObject({ pane: page });
  });

  it('a draft that opened tabs and then became a session: tabs and view carry over together', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, openPane, toggleWorkspaceFull, carryWorkspace } = useShell.getState();
    go({ tab: 'home', conversationId: null, projectId: 'p1' });
    openPane(files);
    toggleWorkspaceFull();
    carryWorkspace('new:p1', 'c9');
    expect(view('new:p1')).toBeUndefined();
    expect(view('c9')).toEqual({ hidden: false, full: true });
    expect(useShell.getState().workspaces.c9?.tabs).toEqual([files]);
  });

  it('when the session must be revealed: full view falls back to split, and on a narrow window the session tab is selected', () => {
    useShell.setState({ views: {}, workspaceNarrow: false });
    const { go, openPane, toggleWorkspaceFull, revealConversation } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(files);
    toggleWorkspaceFull();
    revealConversation();
    expect(view()).toBeUndefined();
    useShell.setState({ workspaceNarrow: true });
    revealConversation();
    expect(view()).toEqual({ hidden: true, full: false });
    useShell.setState({ workspaceNarrow: false });
  });

  describe('narrow window: the session is the fixed first tab', () => {
    const wide = () => useShell.setState({ workspaceNarrow: false, views: {}, hiddenBeforeNarrow: false });
    const at = () => {
      const { go, openPane } = useShell.getState();
      go({ tab: 'home', conversationId: 'c1', projectId: null });
      openPane(video);
    };

    it('the first measurement after mounting only records the mode; deep-linked tabs still show', () => {
      wide();
      at();
      useShell.getState().setWorkspaceNarrow(true, { initial: true });
      expect(useShell.getState().workspaceNarrow).toBe(true);
      expect(hidden()).toBe(false);
    });

    it('switching from side-by-side to single column: focus in the session area selects the session tab; focus on the right stays on the current tab', () => {
      wide();
      at();
      useShell.getState().setWorkspaceNarrow(true, { focusInConversation: true });
      expect(useShell.getState().workspaceNarrow).toBe(true);
      expect(hidden()).toBe(true);
      wide();
      useShell.getState().setWorkspaceNarrow(true, { focusInConversation: false });
      expect(useShell.getState().workspaceNarrow).toBe(true);
      expect(hidden()).toBe(false);
    });

    it('the session tab is selected when the feature area was already collapsed; it stays there, and switching back to side-by-side is still collapsed', () => {
      wide();
      at();
      useShell.getState().toggleWorkspace();
      useShell.getState().setWorkspaceNarrow(true);
      expect(hidden()).toBe(true);
      useShell.getState().setWorkspaceNarrow(false);
      expect(useShell.getState().workspaceNarrow).toBe(false);
      expect(hidden()).toBe(true);
    });

    it('after collapsing, a tab was clicked in single column: switching back to side-by-side brings back both the session column and that tab', () => {
      wide();
      at();
      useShell.getState().toggleWorkspace();
      useShell.getState().setWorkspaceNarrow(true);
      useShell.getState().selectPane(itemKey(video));
      useShell.getState().showConversation();
      useShell.getState().setWorkspaceNarrow(false);
      expect(useShell.getState().workspaceNarrow).toBe(false);
      expect(hidden()).toBe(false);
    });

    it('because focus selected the session tab: switching back to side-by-side restores two columns', () => {
      wide();
      at();
      useShell.getState().setWorkspaceNarrow(true, { focusInConversation: true });
      useShell.getState().setWorkspaceNarrow(false);
      expect(useShell.getState().workspaceNarrow).toBe(false);
      expect(hidden()).toBe(false);
    });

    it('after selecting the session tab, clicking a tab is what switches to it', () => {
      wide();
      at();
      useShell.getState().setWorkspaceNarrow(true, { focusInConversation: true });
      expect(hidden()).toBe(true);
      useShell.getState().selectPane(itemKey(video));
      expect(hidden()).toBe(false);
      wide();
    });
  });

  it('web address change: a background tab only changes the tab group, does not switch or push history; the current tab swaps its route in place', () => {
    const web = { kind: 'web', id: 'w1', url: '' } as const;
    const { go, openPane, selectPane, setWebUrl } = useShell.getState();
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(web);
    openPane(files);
    const back = useShell.getState().back.length;
    setWebUrl('c1', 'w1', 'https://example.com/');
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: files });
    expect(useShell.getState().workspaces.c1).toMatchObject({ tabs: [{ ...web, url: 'https://example.com/' }, files], active: 'files' });
    selectPane('web:w1');
    setWebUrl('c1', 'w1', 'https://example.com/next');
    expect(useShell.getState().route).toEqual({ tab: 'home', conversationId: 'c1', projectId: null, pane: { ...web, url: 'https://example.com/next' } });
    expect(useShell.getState().back.length).toBe(back);
    useShell.getState().setWebTitle('w1', '示例');
    expect(useShell.getState().webTitles.w1).toBe('示例');
  });

  it('dragging to collapse keeps width, route and tabs; pulling back or the button re-expands', () => {
    const { go, openPane, resizeWorkspace, toggleWorkspace } = useShell.getState();
    useShell.setState({ workspaceNarrow: false, views: {} });
    go({ tab: 'home', conversationId: 'c1', projectId: null });
    openPane(files);
    const route = useShell.getState().route;
    const workspaces = useShell.getState().workspaces;
    resizeWorkspace(1000, 1400);
    expect(useShell.getState()).toMatchObject({ dockWidth: 1000, workspaceNarrow: false });
    expect(view()).toBeUndefined();
    resizeWorkspace(1241, 1400);
    expect(useShell.getState().dockWidth).toBe(1000);
    expect(view()).toEqual({ hidden: true, full: false });
    expect(useShell.getState().route).toBe(route);
    expect(useShell.getState().workspaces).toBe(workspaces);
    resizeWorkspace(950, 1400);
    expect(useShell.getState().dockWidth).toBe(950);
    expect(view()).toBeUndefined();
    resizeWorkspace(1500, 1400);
    toggleWorkspace();
    expect(useShell.getState().dockWidth).toBe(950);
    expect(view()).toBeUndefined();
    resizeWorkspace(NaN, 1400);
    expect(useShell.getState().dockWidth).toBe(950);
    const saved = JSON.parse(localStorage.getItem('cuccut.shell')!) as { state: Record<string, unknown> };
    expect(saved.state.views).toEqual({});
  });

  it('session column width is at least 320, no longer stuck at 560, recorded on this machine', () => {
    useShell.getState().setDockWidth(900);
    expect(useShell.getState().dockWidth).toBe(900);
    useShell.getState().setDockWidth(200);
    expect(useShell.getState().dockWidth).toBe(320);
    const saved = JSON.parse(localStorage.getItem('cuccut.shell')!) as { state: Record<string, unknown> };
    expect(saved.state.dockWidth).toBe(320);
    expect(saved.state.workspaceNarrow).toBeUndefined();
  });
});

describe('a video\'s floating session', () => {
  it('the session is remembered per video, \'new session\' clears it; minimized state is recorded on this machine, the session is not recorded', () => {
    useShell.getState().setVideoChat('p1/a.cuccut', 'c1');
    useShell.getState().setVideoChat('p1/b.cuccut', 'c2');
    expect(useShell.getState().videoChats).toEqual({ 'p1/a.cuccut': 'c1', 'p1/b.cuccut': 'c2' });
    useShell.getState().setVideoChat('p1/a.cuccut', null);
    expect(useShell.getState().videoChats).toEqual({ 'p1/b.cuccut': 'c2' });
    useShell.getState().setVideoChatMin(true);
    const saved = JSON.parse(localStorage.getItem('cuccut.shell')!) as { state: Record<string, unknown> };
    expect(saved.state.videoChatMin).toBe(true);
    expect(saved.state.videoChats).toBeUndefined();
    useShell.getState().setVideoChatMin(false);
    useShell.getState().setVideoChat('p1/b.cuccut', null);
  });

  it('a read-back minimized value that is not a boolean is dropped', () => {
    expect(migrateShell({ videoChatMin: 'yes' }, 4)).toEqual({ draftAccessModes: {} });
    expect(migrateShell({ videoChatMin: true }, 4)).toEqual({ draftAccessModes: {}, videoChatMin: true });
  });
});

describe('migration of local UI state', () => {
  it('2 → 3: the old autonomous mode is dropped; access modes on drafts keep only recognized ones', () => {
    expect(migrateShell({ drafts: { a: 'hi' }, autonomy: { a: 'authorized' } }, 2)).toEqual({ drafts: { a: 'hi' }, draftAccessModes: {} });
    expect(migrateShell({ draftAccessModes: { a: 'auto', b: 'controlled', c: 3 } }, 3)).toEqual({ draftAccessModes: { a: 'auto' } });
  });

  it('3 → 4: old data has no agent selection or queue, use defaults; existing ones are validated entry by entry', () => {
    expect(migrateShell({ drafts: { a: 'hi' }, draftAccessModes: { a: 'ask' } }, 3)).toEqual({ drafts: { a: 'hi' }, draftAccessModes: { a: 'ask' } });
    const queued = { id: 'q1', text: '下一步', attachments: [], queuedAt: '2026-10-03T00:00:00Z' };
    expect(
      migrateShell(
        {
          draftAgents: { new: { driverId: 'codex', model: null, effort: 'high' }, p1: { driverId: 'Not Valid' }, p2: 'claude' },
          queues: { c1: [queued, { id: 'bad' }], c2: [{ text: 'x' }], c3: 'oops' },
        },
        3,
      ),
    ).toEqual({ draftAccessModes: {}, draftAgents: { new: { driverId: 'codex', model: null, effort: 'high' } }, queues: { c1: [queued] } });
    expect(migrateShell({ draftAgents: null, queues: [] }, 3)).toEqual({ draftAccessModes: {}, draftAgents: {}, queues: {} });
  });

  it('4 → 5: the global collapse / maximize are dropped; per-workspace views keep only valid ones', () => {
    expect(migrateShell({ drafts: { a: 'hi' }, workspaceHidden: true, workspaceFull: true }, 4)).toEqual({ drafts: { a: 'hi' }, draftAccessModes: {} });
    expect(
      migrateShell(
        { views: { c1: { hidden: true }, c2: { hidden: false, full: false }, c3: 'x', new: { full: true, hidden: 'yes' }, 'new:p1': null } },
        4,
      ),
    ).toEqual({ draftAccessModes: {}, views: { c1: { hidden: true, full: false }, new: { hidden: false, full: true } } });
    expect(migrateShell({ views: [] }, 5)).toEqual({ draftAccessModes: {}, views: {} });
  });

  it('v5 -> v6 forgets the old docked-sidebar choice', () => {
    expect(migrateShell({ sidebarHidden: false }, 5)).toEqual({ draftAccessModes: {} });
    expect(migrateShell({ sidebarHidden: false }, 6)).toEqual({ draftAccessModes: {}, sidebarHidden: false });
  });

  it('reading back v3 local state: existing values are used, new fields are empty, written back as v6', async () => {
    localStorage.setItem(
      'cuccut.shell',
      JSON.stringify({ state: { drafts: { new: '草稿' }, draftAccessModes: { new: 'auto' }, sidebarWidth: 300 }, version: 3 }),
    );
    await useShell.persist.rehydrate();
    const s = useShell.getState();
    expect(s.drafts).toEqual({ new: '草稿' });
    expect(s.draftAccessModes).toEqual({ new: 'auto' });
    expect(s.sidebarWidth).toBe(300);
    expect(s.draftAgents).toEqual({});
    expect(s.queues).toEqual({});
    s.setDraftAgent('new', { driverId: 'claude', model: 'opus' });
    const saved = JSON.parse(localStorage.getItem('cuccut.shell')!) as { version: number; state: Record<string, unknown> };
    expect(saved.version).toBe(6);
    // The sessions drawer starts closed after the move to the session layout.
    expect(s.sidebarHidden).toBe(true);
    expect(saved.state.draftAgents).toEqual({ new: { driverId: 'claude', model: 'opus' } });
    expect(saved.state.views).toEqual({});
  });
});

describe('agent selection and queue on drafts', () => {
  beforeEach(() => useShell.setState({ draftAgents: {}, queues: {} }));

  it('setDraftAgent records or clears one draft\'s selection', () => {
    useShell.getState().setDraftAgent('p1', { driverId: 'codex' });
    expect(useShell.getState().draftAgents).toEqual({ p1: { driverId: 'codex' } });
    useShell.getState().setDraftAgent('p1', null);
    expect(useShell.getState().draftAgents).toEqual({});
  });

  it('setQueue updates to the latest queue; when emptied, the session entry is deleted', () => {
    const item = (id: string) => ({ id, text: id, attachments: [], queuedAt: '2026-10-03T00:00:00Z' });
    useShell.getState().setQueue('c1', (q) => [...q, item('a')]);
    useShell.getState().setQueue('c1', (q) => [...q, item('b')]);
    expect(useShell.getState().queues.c1!.map((m) => m.id)).toEqual(['a', 'b']);
    useShell.getState().setQueue('c1', () => []);
    expect(useShell.getState().queues).toEqual({});
  });
});

it('switching candidate images replaces the file tab in place, deduplicates and syncs the route', () => {
  const a = { kind: 'file' as const, target: { conversationId: 'c1', path: 'a.png' } };
  const b = { kind: 'file' as const, target: { conversationId: 'c1', path: 'b.png' } };
  const other = { kind: 'files' as const };
  useShell.setState({ route: { tab: 'home', conversationId: 'c1', projectId: null, pane: a }, workspaces: { c1: { tabs: [other, a, b], active: itemKey(a) } } });
  useShell.getState().replaceFilePane(itemKey(a), b.target);
  expect(useShell.getState().workspaces.c1).toMatchObject({ tabs: [other, b], active: itemKey(b) });
  expect(useShell.getState().route).toMatchObject({ pane: b });
});

it('file tabs for sent attachments keep the session permission location and display name',()=>{
  const route = {tab:'home' as const,conversationId:'c1',projectId:null,pane:{kind:'file' as const,target:{conversationId:'c1',attachmentId:'att_a'},name:'报告.pdf'}};
  expect(parseHref(hrefFor(route))).toEqual(route);
});
