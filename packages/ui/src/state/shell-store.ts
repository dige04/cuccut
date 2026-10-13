import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  AGENT_MODES,
  TEMPLATE_ID_PATTERN,
  CALENDAR_VIEWS,
  fileTargetQuery,
  isCivilDate,
  isLanguagePreference,
  newId,
  type AgentMode,
  type CalendarView,
  type FileTarget,
  type MediaTarget,
  type Id,
  type LanguagePreference,
} from '@cuccut/protocol';
import { parseAgentChoice, type AgentChoice } from '../model/agent-choice.ts';
import { readQueuedMessage, type QueuedMessage } from '../model/message-queue.ts';
import {
  isModelCategory,
  isModelPage,
  isSettingsSection,
  legacyAgentSection,
  settingsSub,
  type ModelCategory,
  type ModelPage,
  type SettingsSection,
} from '../model/settings-nav.ts';
import type { SidebarSort } from '../model/sidebar.ts';
import { SPACE_CATEGORIES, type SpaceCategory, type SpaceSort } from '../model/space.ts';
import { toolIdOf, type ToolId } from '../model/tool-catalog.ts';
import {
  CONVERSATION_TAB,
  DEFAULT_VIEW,
  DOCK_DEFAULT,
  EMPTY_WORKSPACE,
  clampDock,
  closeTab,
  fullViewEntry,
  itemKey,
  moveTab,
  narrowShowsConversation,
  reconcileTabs,
  replaceTab,
  restoreKey,
  resizeSplit,
  tabsButton,
  updateWebUrl,
  workspaceKey,
  workspaceMode,
  type WorkspaceItem,
  type WorkspaceTabs,
  type WorkspaceView,
} from '../model/workspace.ts';

export type { SettingsSection } from '../model/settings-nav.ts';
export { SETTINGS_SECTIONS } from '../model/settings-nav.ts';

/** Top-level entry (App rail, product design §2.1, revised by user). */
/** `welcome` is the full-screen interview (docs/cuccut/m2-profile-rules.md §2.3): its own route, with no rail entry of its own (it belongs to Home). */
export type Tab = 'home' | 'space' | 'calendar' | 'tasks' | 'models' | 'services' | 'tools' | 'settings' | 'welcome';

/**
 * Home's `pane`: the current tab of the conversation's right-side panel (video, files, project files, web page); the other tabs of the same conversation are recorded in `workspaces`.
 * Space's `video`: the video opened in Space (product design §5.1), with the editor plus a floating conversation; closing returns to the list.
 */
export type Route =
  /** `template`: the start page with "All templates" open on this template (`/home?template=<id>`; the pack page links there). */
  | { tab: 'home'; conversationId: Id | null; projectId: Id | null; pane?: WorkspaceItem; template?: string }
  /** `from`: show only videos derived from this video ("Watch these in Space" on the short-video result page, and "View cut short videos" in the viewer). */
  | { tab: 'space'; category: SpaceCategory; projectId: Id | null; video?: FileTarget; from?: Id }
  /** `sub`: a page inside the section (`/settings/packs/<sub>`: `import`, `export` or a pack id; `/settings/skills/<skill id>`; see `settingsSub`). */
  | { tab: 'settings'; section: SettingsSection; sub?: string }
  /**
   * The publication calendar (design `docs/cuccut/m2-publishing.md` §2.2): `projectId` scopes it to one project, `view` and `day` (a civil date in the
   * workspace timezone) say what it shows, and `publicationId` opens that publication's dialog (a deep link).
   */
  | { tab: 'calendar'; projectId?: Id; view?: CalendarView; day?: string; publicationId?: Id }
  | { tab: 'models'; category: ModelCategory; page?: ModelPage }
  | { tab: 'tasks'; taskId?: Id }
  | { tab: 'services'; service?: string }
  | { tab: 'tools'; tool?: ToolId }
  | { tab: 'welcome' };

export type ColorScheme = 'system' | 'light' | 'dark';

export const SIDEBAR_DEFAULT = 240;
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 420;
const HISTORY_MAX = 50;

/** Draft key for a new conversation. */
export const NEW_DRAFT = 'new';

export const HOME: Route = { tab: 'home', conversationId: null, projectId: null };
/** The full-screen interview (`/welcome`). */
export const WELCOME: Route = { tab: 'welcome' };

/**
 * UI state that belongs only to this machine and this window: routing and back/forward, the last place each entry was left, the sidebar, drafts, and preferences.
 * Business state does not go here; it comes from the Runtime.
 */
export interface ShellStore {
  route: Route;
  back: Route[];
  forward: Route[];
  /** The last place each entry was left: clicking the rail returns there (product design §2.1). */
  lastRoute: Partial<Record<Tab, Route>>;
  sidebarWidth: number;
  sidebarHidden: boolean;
  drafts: Record<string, string>;
  /** Access mode chosen for a new conversation not yet created (draft key). The access mode of a created conversation lives in the Runtime, not here. */
  draftAccessModes: Record<string, AgentMode>;
  expandedProjects: Id[];
  /** Home sidebar "Organize sidebar": group by project, or put all conversations in one list. */
  sidebarGrouping: 'project' | 'flat';
  sidebarSort: SidebarSort;
  colorScheme: ColorScheme;
  /** UI language (Settings › General): `system` follows the OS. The desktop app also writes it to the Runtime's `ui.language` (state/locale.ts). */
  language: LanguagePreference;
  spaceView: 'grid' | 'list';
  spaceSort: SpaceSort;
  /** Side panel tabs for each conversation (new conversations by project) (product design §3.3, revised by user). */
  workspaces: Record<string, WorkspaceTabs>;
  /**
   * The view of each conversation (new conversations by draft key): side panel collapsed, and full view (product design §2.5, §3.3, revised by user). Switching conversations does not change other conversations' views.
   * In the single tab strip (narrow window, full view), collapsing means selecting the conversation tab (`showConversation`). Recorded on this machine.
   */
  views: Record<string, WorkspaceView>;
  /** Width of the Home conversation column (shares one width with the right-side tabs, prototype `dockW`). */
  dockWidth: number;
  /**
   * Narrow window (no room for the conversation column and the editor, product design §2.5, §3.3): single column, with the conversation as the fixed first tab in the tab strip.
   * HomePage measures and writes it here; the title bar lays out accordingly.
   */
  workspaceNarrow: boolean;
  /** Whether the user had collapsed the side panel before switching to a narrow window: when switching back to side-by-side, it stays collapsed only if this is true and it has stayed on the conversation tab. Not recorded on this machine. */
  hiddenBeforeNarrow: boolean;
  /** Page title of a web tab (keyed by tab id), used as the tab name; not recorded on this machine, reported again when the page loads after reopening. */
  webTitles: Record<string, string>;
  /** The tab last open for each category on the models page. */
  modelPages: Partial<Record<ModelCategory, ModelPage>>;
  /** Agent, model and reasoning effort chosen for a new conversation not yet created (draft key); the choices of a created conversation are in the Runtime. */
  draftAgents: Record<string, AgentChoice>;
  /** Messages queued for each conversation while it is busy, to be sent after the current task ends. */
  queues: Record<Id, QueuedMessage[]>;
  /**
   * The conversation most recently started from the floating conversation at the bottom-right of a video opened in Space (keyed by the video's `targetKey`): the status dot on the minimized icon reads it, and the tool page's "Hand to Agent" continues it.
   * The input box itself always starts a new conversation (product design §5.1). Remembered only for this run.
   */
  videoChats: Record<string, Id>;
  /** The floating conversation minimized to an icon; expanded by default, and the minimized state is recorded on this machine. */
  videoChatMin: boolean;
  navigate(href: string): void;
  go(route: Route): void;
  /** Replace the current location without adding a history entry (in-place switches such as filters and categories). */
  replace(route: Route): void;
  goBack(): void;
  goForward(): void;
  /** Click the rail: go to where this entry was last left; if already in this entry, return to its start. */
  goTab(tab: Tab): void;
  /** Open a video in the current entry (Home or Space); on other pages, go to Home. */
  openVideo(video: FileTarget, from?: { conversationId?: Id | null; projectId?: Id | null }): void;
  /** Close the video and return to where it was opened from (Home: closes this tab, and the neighbouring tab takes over). */
  closeVideo(): void;
  /** Open a tab in the side panel of the current Home conversation; when not in Home, go to Home. */
  openPane(item: WorkspaceItem, from?: { conversationId?: Id | null; projectId?: Id | null }): void;
  selectPane(key: string): void;
  replaceFilePane(key: string, target: MediaTarget): void;
  /**
   * Replace tab `key` of the current Home conversation in place with `item` (tool cards on the new-tab start page: new web page, browse project files): the position stays, the route moves to the new tab, and there is no history entry;
   * if `item` is already open elsewhere, it is moved to this position (model/workspace.ts `replaceTab`). If there is no tab `key`, it is the same as `openPane`.
   */
  replaceWorkspaceTab(key: string, item: WorkspaceItem): void;
  closePane(key: string): void;
  movePane(key: string, target: string, after: boolean): void;
  /** When a new conversation sends its first message and becomes a real conversation, carry over the tabs and views open on the start page. */
  carryWorkspace(from: string, to: Id): void;
  /**
   * The title bar "Tabs" button (model/workspace.ts `tabsButton`): with no tabs, opens a new tab page (a web tab with an empty address) and shows split view;
   * in full view, returns to split view; while split view is shown, collapses it; when collapsed, returns to the current, pre-collapse, or last tab.
   */
  toggleWorkspace(): void;
  /** Enter or exit full view. On entry, the on-screen layout is kept (`fullViewEntry`); on exit the conversation returns to the left and the last tab returns to the right. This button does not appear in narrow windows. */
  toggleWorkspaceFull(): void;
  /** The list of open tab pages: selects this tab and shows split view; with `full`, enters full view directly. */
  showWorkspaceTab(key: string, full: boolean): void;
  /** Select the conversation tab (in the single tab strip): only collapses the side panel; route, tabs and editor state are unchanged. */
  showConversation(): void;
  /** Bring the conversation into view: in a narrow window, select the conversation tab and leave full view for split view; do nothing if the conversation is already visible. */
  revealConversation(): void;
  setDockWidth(width: number): void;
  resizeWorkspace(width: number, contentWidth: number): void;
  /**
   * The measured narrow or wide state. If the mode has not changed, do nothing; `initial` (the first measurement after mounting) only records the mode and does not switch tabs.
   * Side by side → single column: if focus is in the conversation area (`focusInConversation`) or the side panel was already collapsed, select the conversation tab; otherwise stay on the current tab.
   * Single column → side by side: the conversation column and the last tab come back; it stays collapsed only if it was collapsed before the switch and has stayed on the conversation tab.
   */
  setWorkspaceNarrow(narrow: boolean, options?: { focusInConversation?: boolean; initial?: boolean }): void;
  /** The page in a web tab changed address: update `url` in that group of tabs without switching the current tab; if it is the current tab, replace the route in place (no history entry). */
  setWebUrl(book: string, id: string, url: string): void;
  setWebTitle(id: string, title: string): void;
  setModelPage(category: ModelCategory, page: ModelPage): void;
  setSidebarWidth(width: number): void;
  toggleSidebar(): void;
  setDraft(key: string, text: string): void;
  setDraftAccessMode(key: string, mode: AgentMode | null): void;
  setDraftAgent(key: string, choice: AgentChoice | null): void;
  /** Update according to the latest queue; if it becomes empty, delete this conversation's queue. */
  setQueue(conversationId: Id, update: (queue: readonly QueuedMessage[]) => QueuedMessage[]): void;
  setVideoChat(key: string, conversationId: Id | null): void;
  setVideoChatMin(min: boolean): void;
  setExpandedProjects(ids: Id[]): void;
  setSidebarGrouping(grouping: 'project' | 'flat'): void;
  setSidebarSort(sort: SidebarSort): void;
  setColorScheme(scheme: ColorScheme): void;
  setLanguage(language: LanguagePreference): void;
  setSpaceView(view: 'grid' | 'list'): void;
  setSpaceSort(sort: SpaceSort): void;
}

export const useShell = create<ShellStore>()(
  persist(
    (set, get) => ({
      route: HOME,
      back: [],
      forward: [],
      lastRoute: {},
      sidebarWidth: SIDEBAR_DEFAULT,
      // The sessions drawer starts closed (agentcut's session view opens on the work, not on a list).
      sidebarHidden: true,
      drafts: {},
      draftAccessModes: {},
      expandedProjects: [],
      sidebarGrouping: 'project',
      sidebarSort: 'recent',
      colorScheme: 'system',
      language: 'system',
      spaceView: 'grid',
      spaceSort: 'recent',
      workspaces: {},
      views: {},
      dockWidth: DOCK_DEFAULT,
      workspaceNarrow: false,
      hiddenBeforeNarrow: false,
      webTitles: {},
      modelPages: {},
      draftAgents: {},
      queues: {},
      videoChats: {},
      videoChatMin: false,
      navigate: (href) => get().go(parseHref(href)),
      go: (route) =>
        set((s) => {
          if (sameRoute(s.route, route)) return {};
          return {
            route,
            back: [...s.back, s.route].slice(-HISTORY_MAX),
            forward: [],
            lastRoute: remember(s.lastRoute, route),
            ...arrive(s, route),
          };
        }),
      replace: (route) => set((s) => ({ route, lastRoute: remember(s.lastRoute, route), ...arrive(s, route) })),
      goBack: () =>
        set((s) => {
          const previous = s.back.at(-1);
          if (!previous) return {};
          return {
            route: previous,
            back: s.back.slice(0, -1),
            forward: [s.route, ...s.forward],
            lastRoute: remember(s.lastRoute, previous),
            ...arrive(s, previous),
          };
        }),
      goForward: () =>
        set((s) => {
          const next = s.forward[0];
          if (!next) return {};
          return {
            route: next,
            back: [...s.back, s.route],
            forward: s.forward.slice(1),
            lastRoute: remember(s.lastRoute, next),
            ...arrive(s, next),
          };
        }),
      goTab: (tab) => {
        const { route, lastRoute, go } = get();
        const key = tab === 'models' ? 'settings' : tab;
        go(railTabOf(route) === key ? defaultRoute(key) : (lastRoute[key] ?? defaultRoute(key)));
      },
      openVideo: (video, from) => {
        const { route, go, openPane } = get();
        if (route.tab === 'space' && !from) go({ ...route, video });
        else openPane({ kind: 'video', target: video }, from);
      },
      closeVideo: () => {
        const { route, go, closePane } = get();
        if (route.tab === 'space' && route.video) {
          const { video: _video, ...rest } = route;
          go(rest);
        } else if (route.tab === 'home' && route.pane?.kind === 'video') closePane(itemKey(route.pane));
      },
      openPane: (pane, from) => {
        const { route, go } = get();
        if (route.tab === 'home' && !from) go({ ...route, pane });
        else go({ tab: 'home', conversationId: from?.conversationId ?? null, projectId: from?.projectId ?? null, pane });
        set((s) => ({ ...patchView(s, { hidden: false }), hiddenBeforeNarrow: false }));
      },
      selectPane: (key) => {
        const { route, workspaces, replace } = get();
        if (route.tab !== 'home') return;
        const pane = (workspaces[workspaceKey(route.conversationId, route.projectId)] ?? EMPTY_WORKSPACE).tabs.find((t) => itemKey(t) === key);
        if (pane) replace({ ...route, pane });
        set((s) => ({ ...patchView(s, { hidden: false }), hiddenBeforeNarrow: false }));
      },
      replaceFilePane: (key, target) => {
        const { route, workspaces } = get();
        if (route.tab !== 'home') return;
        const previous = workspaces[workspaceKey(route.conversationId, route.projectId)] ?? EMPTY_WORKSPACE;
        if (!previous.tabs.some(item => itemKey(item) === key && item.kind === 'file')) return;
        get().replaceWorkspaceTab(key, { kind: 'file', target });
      },
      replaceWorkspaceTab: (key, item) => {
        const { route, workspaces, openPane } = get();
        if (route.tab !== 'home') return;
        const book = workspaceKey(route.conversationId, route.projectId);
        const previous = workspaces[book] ?? EMPTY_WORKSPACE;
        if (!previous.tabs.some((t) => itemKey(t) === key)) return openPane(item);
        set((s) => ({ workspaces: { ...s.workspaces, [book]: replaceTab(previous, key, item) } }));
        get().replace({ ...route, pane: item });
      },
      closePane: (key) => {
        const { route, workspaces } = get();
        if (route.tab !== 'home') return;
        const book = workspaceKey(route.conversationId, route.projectId);
        const next = closeTab(workspaces[book] ?? EMPTY_WORKSPACE, key);
        const pane = next.tabs.find((t) => itemKey(t) === next.active);
        const { pane: _pane, ...rest } = route;
        // Closing the last tab leaves full view and returns to conversation only. When the conversation tab is selected, closing the tab after it does not carry the view over to the neighbour (`hidden` is unchanged).
        set((s) => ({ workspaces: { ...s.workspaces, [book]: next }, ...(next.tabs.length ? {} : patchView(s, DEFAULT_VIEW)) }));
        get().replace(pane ? { ...rest, pane } : rest);
      },
      movePane: (key, target, after) => {
        const { route } = get();
        if (route.tab !== 'home') return;
        const book = workspaceKey(route.conversationId, route.projectId);
        set((s) => ({ workspaces: { ...s.workspaces, [book]: moveTab(s.workspaces[book] ?? EMPTY_WORKSPACE, key, target, after) } }));
      },
      carryWorkspace: (from, to) =>
        set((s) => {
          const tabs = s.workspaces[from];
          const view = s.views[from];
          if (!tabs && !view) return {};
          const { [from]: _moved, ...workspaces } = s.workspaces;
          const { [from]: _view, ...views } = s.views;
          return {
            ...(tabs ? { workspaces: { ...workspaces, [to]: tabs } } : {}),
            ...(view ? { views: { ...views, [to]: view } } : {}),
          };
        }),
      toggleWorkspace: () => {
        const state = get();
        const mode = homeMode(state);
        if (!mode) return;
        const action = tabsButton({ count: mode.count, visible: mode.visible, full: mode.full }).action;
        if (action === 'open') state.openPane({ kind: 'web', id: newId('web'), url: '' });
        else if (action === 'split') exitFull(get, set);
        else if (action === 'hide') set((s) => ({ ...patchView(s, { hidden: true }), hiddenBeforeNarrow: false }));
        else showRemembered(get, set);
      },
      toggleWorkspaceFull: () => {
        const state = get();
        const mode = homeMode(state);
        if (!mode) return;
        if (mode.full) return exitFull(get, set);
        if (!mode.count) return;
        const active = state.route.tab === 'home' && state.route.pane ? itemKey(state.route.pane) : null;
        set((s) => patchView(s, { full: true, hidden: fullViewEntry(mode.visible, active) === CONVERSATION_TAB }));
      },
      showWorkspaceTab: (key, full) => {
        const { route, workspaces, replace } = get();
        if (route.tab !== 'home') return;
        const pane = (workspaces[workspaceKey(route.conversationId, route.projectId)] ?? EMPTY_WORKSPACE).tabs.find((t) => itemKey(t) === key);
        if (!pane) return;
        replace({ ...route, pane });
        set((s) => ({ ...patchView(s, { hidden: false, full }), hiddenBeforeNarrow: false }));
      },
      showConversation: () => set((s) => patchView(s, { hidden: true })),
      revealConversation: () => {
        const state = get();
        const mode = homeMode(state);
        if (!mode) return;
        if (state.workspaceNarrow) state.showConversation();
        else if (mode.full) exitFull(get, set);
      },
      setDockWidth: (width) => set({ dockWidth: clampDock(width) }),
      resizeWorkspace: (width, contentWidth) => {
        if (!Number.isFinite(width) || !Number.isFinite(contentWidth) || contentWidth <= 0) return;
        const next = resizeSplit(width, contentWidth);
        set((s) => ({
          ...(!next.hidden ? { dockWidth: next.width } : {}),
          ...patchView(s, { hidden: next.hidden, full: false }),
          hiddenBeforeNarrow: false,
        }));
      },
      setWebUrl: (book, id, url) => {
        const current = get().workspaces[book];
        if (!current) return;
        const next = updateWebUrl(current, id, url);
        if (next === current) return;
        set((s) => ({ workspaces: { ...s.workspaces, [book]: next } }));
        const { route, replace } = get();
        if (route.tab === 'home' && route.pane?.kind === 'web' && route.pane.id === id && workspaceKey(route.conversationId, route.projectId) === book)
          replace({ ...route, pane: { ...route.pane, url } });
      },
      setWebTitle: (id, title) => set((s) => (s.webTitles[id] === title ? {} : { webTitles: { ...s.webTitles, [id]: title } })),
      setWorkspaceNarrow: (narrow, options = {}) =>
        set((s) => {
          if (s.workspaceNarrow === narrow) return {};
          if (options.initial) return { workspaceNarrow: narrow, hiddenBeforeNarrow: false };
          const hidden = currentView(s).hidden;
          if (narrow) {
            const paneVisible = s.route.tab === 'home' && !!s.route.pane && !hidden;
            const conversation = narrowShowsConversation(!!options.focusInConversation, paneVisible);
            return { workspaceNarrow: true, hiddenBeforeNarrow: hidden, ...(conversation ? patchView(s, { hidden: true }) : {}) };
          }
          return { workspaceNarrow: false, hiddenBeforeNarrow: false, ...patchView(s, { hidden: s.hiddenBeforeNarrow && hidden }) };
        }),
      setModelPage: (category, page) => set((s) => ({ modelPages: { ...s.modelPages, [category]: page } })),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width))) }),
      toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
      setDraft: (key, text) =>
        set((s) => {
          const drafts = { ...s.drafts };
          if (text) drafts[key] = text;
          else delete drafts[key];
          return { drafts };
        }),
      setDraftAccessMode: (key, mode) =>
        set((s) => {
          const draftAccessModes = { ...s.draftAccessModes };
          if (mode) draftAccessModes[key] = mode;
          else delete draftAccessModes[key];
          return { draftAccessModes };
        }),
      setDraftAgent: (key, choice) =>
        set((s) => {
          const draftAgents = { ...s.draftAgents };
          if (choice) draftAgents[key] = choice;
          else delete draftAgents[key];
          return { draftAgents };
        }),
      setQueue: (conversationId, update) =>
        set((s) => {
          const next = update(s.queues[conversationId] ?? []);
          const queues = { ...s.queues };
          if (next.length) queues[conversationId] = next;
          else delete queues[conversationId];
          return { queues };
        }),
      setExpandedProjects: (ids) => set({ expandedProjects: ids }),
      setSidebarGrouping: (sidebarGrouping) => set({ sidebarGrouping }),
      setSidebarSort: (sidebarSort) => set({ sidebarSort }),
      setVideoChat: (key, conversationId) =>
        set((s) => {
          const videoChats = { ...s.videoChats };
          if (conversationId) videoChats[key] = conversationId;
          else delete videoChats[key];
          return { videoChats };
        }),
      setVideoChatMin: (videoChatMin) => set({ videoChatMin }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setLanguage: (language) => set({ language }),
      setSpaceView: (spaceView) => set({ spaceView }),
      setSpaceSort: (spaceSort) => set({ spaceSort }),
    }),
    {
      name: 'cuccut.shell',
      version: 6,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sidebarWidth: s.sidebarWidth,
        sidebarHidden: s.sidebarHidden,
        drafts: s.drafts,
        draftAccessModes: s.draftAccessModes,
        expandedProjects: s.expandedProjects,
        sidebarGrouping: s.sidebarGrouping,
        sidebarSort: s.sidebarSort,
        colorScheme: s.colorScheme,
        language: s.language,
        spaceView: s.spaceView,
        spaceSort: s.spaceSort,
        workspaces: s.workspaces,
        views: s.views,
        dockWidth: s.dockWidth,
        modelPages: s.modelPages,
        draftAgents: s.draftAgents,
        queues: s.queues,
        videoChatMin: s.videoChatMin,
      }),
      migrate: (persisted, version) => migrateShell(persisted, version),
    },
  ),
);

/**
 * 1 → 2 only added fields: old values are used as they are, and new fields take their defaults (later added fields are handled the same way, without bumping the version).
 * 2 → 3: autonomous modes (plan / controlled / authorized) are replaced by access modes, and the modes of created conversations were moved to the Runtime.
 * Old values are not translated: choices on drafts are dropped and fall back to the initial values given by the Runtime; unrecognized values are never kept (when in doubt, ask).
 * 3 → 4: added the Agent choice on new-conversation drafts (`draftAgents`) and busy-time queues (`queues`); old data does not have them, so defaults are used.
 * When these two are present, each entry is validated, and entries of the wrong shape are dropped (when the version is bumped later, old data is also cleaned here).
 * `dockWidth` (conversation column width), the group's `last` (the tab before collapse), `videoChatMin` (floating conversation minimized) and `language` (UI language), added within v4, are optional fields: if old data lacks them, defaults are used, without bumping the version.
 * 4 → 5: the collapse and full view of the side panel changed from a global switch to one per conversation (`views`), recorded on this machine. v4's global switch was never recorded on this machine,
 * so if it appears on read-back it is also dropped, and each conversation starts from the default view; when `views` is present each entry is validated, keeping only boolean `hidden` / `full`.
 */
export function migrateShell(persisted: unknown, version: number): Partial<ShellStore> {
  const state = { ...(persisted as Record<string, unknown>) };
  if (version < 3) delete state.autonomy;
  // 5 -> 6: the docked page sidebar became the session view's sessions drawer, closed by default; forget the old choice.
  if (version < 6) delete state.sidebarHidden;
  const modes = state.draftAccessModes;
  state.draftAccessModes =
    modes && typeof modes === 'object'
      ? Object.fromEntries(Object.entries(modes).filter(([, mode]) => (AGENT_MODES as readonly unknown[]).includes(mode)))
      : {};
  if ('draftAgents' in state) state.draftAgents = cleanDraftAgents(state.draftAgents);
  if ('queues' in state) state.queues = cleanQueues(state.queues);
  if ('videoChatMin' in state && typeof state.videoChatMin !== 'boolean') delete state.videoChatMin;
  if ('language' in state && !isLanguagePreference(state.language)) delete state.language;
  delete state.workspaceHidden;
  delete state.workspaceFull;
  if ('views' in state) state.views = cleanViews(state.views);
  return state as Partial<ShellStore>;
}

function cleanViews(value: unknown): Record<string, WorkspaceView> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, raw]) => {
      if (!raw || typeof raw !== 'object') return [];
      const { hidden, full } = raw as Record<string, unknown>;
      const view = { hidden: hidden === true, full: full === true };
      return view.hidden || view.full ? [[key, view]] : [];
    }),
  );
}

/** View key of the current Home location; null when not in Home. */
function currentKey(s: Pick<ShellStore, 'route'>): string | null {
  return s.route.tab === 'home' ? workspaceKey(s.route.conversationId, s.route.projectId) : null;
}

function currentView(s: Pick<ShellStore, 'route' | 'views'>): WorkspaceView {
  const key = currentKey(s);
  return (key && s.views[key]) || DEFAULT_VIEW;
}

/** Change the view of the current Home location (no change when not in Home); returns an empty patch when nothing changed. */
function patchView(s: Pick<ShellStore, 'route' | 'views'>, patch: Partial<WorkspaceView>): Partial<ShellStore> {
  const key = currentKey(s);
  if (!key) return {};
  const old = s.views[key] ?? DEFAULT_VIEW;
  const view = { ...old, ...patch };
  if (view.hidden === old.hidden && view.full === old.full) return {};
  const { [key]: _old, ...rest } = s.views;
  return { views: view.hidden || view.full ? { ...rest, [key]: view } : rest };
}

/**
 * Layout of a Home location (model/workspace.ts `workspaceMode`): tab count, whether the side panel is shown, full view, single tab strip, and whether the conversation tab is selected.
 * null when not in Home.
 */
export function homeMode(
  s: Pick<ShellStore, 'route' | 'views' | 'workspaces' | 'workspaceNarrow'>,
): (ReturnType<typeof workspaceMode> & { key: string; count: number }) | null {
  const key = currentKey(s);
  if (!key || s.route.tab !== 'home') return null;
  const count = (s.workspaces[key] ?? EMPTY_WORKSPACE).tabs.length;
  const active = s.route.pane ? itemKey(s.route.pane) : null;
  return { key, count, ...workspaceMode({ active, count, view: s.views[key] ?? DEFAULT_VIEW, narrow: s.workspaceNarrow }) };
}

/** This conversation is in Home and visible (not another tab selected in the single tab strip). */
export function conversationVisible(s: Pick<ShellStore, 'route' | 'views' | 'workspaces' | 'workspaceNarrow'>, conversationId: Id): boolean {
  const mode = homeMode(s);
  return !!mode && s.route.tab === 'home' && s.route.conversationId === conversationId && !(mode.single && mode.visible);
}

type Get = () => ShellStore;
type Set = (partial: Partial<ShellStore> | ((s: ShellStore) => Partial<ShellStore>)) => void;

/** Exit full view: the conversation returns to the left and the last tab returns to the right (when the route has no tab, returns to the pre-collapse or last one). */
function exitFull(get: Get, set: Set): void {
  set((s) => ({ ...patchView(s, DEFAULT_VIEW), hiddenBeforeNarrow: false }));
  const { route } = get();
  if (route.tab === 'home' && !route.pane) showRemembered(get, set);
}

/** Show split view: return to the current, pre-collapse, or last tab. */
function showRemembered(get: Get, set: Set): void {
  const { route, workspaces, go } = get();
  if (route.tab !== 'home') return;
  if (!route.pane) {
    const book = workspaces[workspaceKey(route.conversationId, route.projectId)] ?? EMPTY_WORKSPACE;
    const key = restoreKey(book);
    const pane = book.tabs.find((t) => itemKey(t) === key);
    if (!pane) return;
    go({ ...route, pane });
  }
  set((s) => ({ ...patchView(s, { hidden: false }), hiddenBeforeNarrow: false }));
}

function cleanDraftAgents(value: unknown): Record<string, AgentChoice> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, raw]) => {
      const choice = parseAgentChoice(raw);
      return choice ? [[key, choice]] : [];
    }),
  );
}

function cleanQueues(value: unknown): Record<Id, QueuedMessage[]> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([id, raw]) => {
      const queue = Array.isArray(raw) ? raw.flatMap((m) => readQueuedMessage(m) ?? []) : [];
      return queue.length ? [[id, queue]] : [];
    }),
  );
}

/**
 * `models` is an internal content route of Settings, kept for compatibility with existing callers; it does not correspond to a separate Rail entry.
 * `welcome` (the full-screen interview) belongs to Home.
 */
export function railTabOf(route: Route): Exclude<Tab, 'models' | 'welcome'> {
  if (route.tab === 'models') return 'settings';
  if (route.tab === 'welcome') return 'home';
  return route.tab;
}

/** The last place of each rail entry, for `goTab`. The interview is a detour, not a place to come back to: Home keeps where it was. */
function remember(lastRoute: Partial<Record<Tab, Route>>, route: Route): Partial<Record<Tab, Route>> {
  if (route.tab === 'welcome') return lastRoute;
  return { ...lastRoute, [railTabOf(route)]: route };
}

export function defaultRoute(tab: Tab): Route {
  if (tab === 'home') return HOME;
  if (tab === 'space') return { tab, category: 'all', projectId: null };
  if (tab === 'settings') return { tab, section: 'general' };
  if (tab === 'models') return { tab, category: 'asr' };
  if (tab === 'welcome') return WELCOME;
  return { tab };
}

/**
 * When entering a Home location, that conversation's tab group changes with the route (the current tab is added, or it collapses). Views (collapsed, full view) are recorded per conversation, and switching conversations does not change them;
 * when the route has no tab, full view stays as it is, and the selected one is the conversation tab. Switching conversations only forgets "was collapsed before switching to a narrow window".
 */
function arrive(s: ShellStore, route: Route): Partial<ShellStore> {
  if (route.tab !== 'home') return {};
  const book = workspaceKey(route.conversationId, route.projectId);
  const current = s.workspaces[book] ?? EMPTY_WORKSPACE;
  const next = reconcileTabs(current, route.pane);
  const moved = s.route.tab !== 'home' || workspaceKey(s.route.conversationId, s.route.projectId) !== book;
  return {
    ...(next === current ? {} : { workspaces: { ...s.workspaces, [book]: next } }),
    ...(moved ? { hiddenBeforeNarrow: false } : {}),
  };
}

/** The video open in the Home side panel (the current Home tab, or the video opened in Space). */
export function routeVideo(route: Route): FileTarget | undefined {
  if (route.tab === 'space') return route.video;
  if (route.tab === 'home' && route.pane?.kind === 'video') return route.pane.target;
  return undefined;
}

function sameRoute(a: Route, b: Route): boolean {
  return hrefFor(a) === hrefFor(b);
}

/**
 * Entries that have a page sidebar: the sidebar open/close button in the title bar appears only on these pages. The sidebar stays when a video is opened, because the video belongs to its entry.
 * Settings (including model configuration) has its own sectioned navigation and no page sidebar.
 */
export function hasSidebar(route: Route): boolean {
  return route.tab !== 'settings' && route.tab !== 'models' && route.tab !== 'calendar' && route.tab !== 'welcome';
}

/**
 * In-app links: `/home`, `/c/<conversation>`, `/p/<project>` (starts a new conversation in this project); the Home side panel tabs go in the query string
 * (`?video=` / `?file=` take a JSON FileTarget, `?files=1`, `?web=<id>&url=<address>`);
 * `/space/<category>[/<project>][?video=]`, `/settings/<section>[/<sub>]`, `/settings/models/<category>[/<page>]`, `/tasks[/<task>]`,
 * `/services[/<service>]`, `/tools[/<tool>]`, `/welcome`, `/calendar?projectId=&view=&day=&publication=`.
 */
export function hrefFor(route: Route): string {
  switch (route.tab) {
    case 'home': {
      const query = route.pane ? `?${paneQuery(route.pane)}` : '';
      if (route.conversationId) return `/c/${route.conversationId}${query}`;
      if (route.projectId) return `/p/${route.projectId}${query}`;
      if (route.template) return `/home${query ? `${query}&` : '?'}template=${encodeURIComponent(route.template)}`;
      return `/home${query}`;
    }
    case 'space': {
      const params = [
        ...(route.from ? [`from=${encodeURIComponent(route.from)}`] : []),
        ...(route.video ? [`video=${encodeURIComponent(JSON.stringify(route.video))}`] : []),
      ];
      return (route.projectId ? `/space/${route.category}/${route.projectId}` : `/space/${route.category}`) + (params.length ? `?${params.join('&')}` : '');
    }
    case 'calendar': {
      const query = new URLSearchParams();
      if (route.projectId) query.set('projectId', route.projectId);
      if (route.view) query.set('view', route.view);
      if (route.day) query.set('day', route.day);
      if (route.publicationId) query.set('publication', route.publicationId);
      const text = query.toString();
      return text ? `/calendar?${text}` : '/calendar';
    }
    case 'settings':
      return route.sub ? `/settings/${route.section}/${encodeURIComponent(route.sub)}` : `/settings/${route.section}`;
    case 'models':
      return route.page ? `/settings/models/${route.category}/${route.page}` : `/settings/models/${route.category}`;
    case 'tasks':
      return route.taskId ? `/tasks/${encodeURIComponent(route.taskId)}` : '/tasks';
    case 'services':
      return route.service ? `/services/${encodeURIComponent(route.service)}` : '/services';
    case 'tools':
      return route.tool ? `/tools/${route.tool}` : '/tools';
    case 'welcome':
      return '/welcome';
  }
}

function paneQuery(pane: WorkspaceItem): string {
  if (pane.kind === 'video') return fileTargetQuery('video', pane.target);
  if (pane.kind === 'slides') return new URLSearchParams({ slides: JSON.stringify(pane.target) }).toString();
  if (pane.kind === 'design') return new URLSearchParams({ design: JSON.stringify(pane.target) }).toString();
  if (pane.kind === 'design-system') return new URLSearchParams({ designSystem: JSON.stringify(pane.target) }).toString();
  if (pane.kind === 'file') return new URLSearchParams({file:JSON.stringify(pane.target),...(pane.name?{fileName:pane.name}:{})}).toString();
  const query = new URLSearchParams();
  if (pane.kind === 'files') query.set('files', '1');
  else {
    query.set('web', pane.id);
    if (pane.url) query.set('url', pane.url);
  }
  return query.toString();
}

export function parseHref(href: string): Route {
  const [pathPart, queryPart = ''] = href.split('?');
  const [, head, a, b, c] = pathPart!.split('/');
  const query = new URLSearchParams(queryPart);
  const video = parseTarget(query.get('video'));
  const pane = parsePane(query);
  const withPane = (route: Extract<Route, { tab: 'home' }>): Route => (pane ? { ...route, pane } : route);
  if (head === 'c' && a) return withPane({ tab: 'home', conversationId: a, projectId: null });
  if (head === 'p' && a) return withPane({ tab: 'home', conversationId: null, projectId: a });
  if (head === 'home') {
    const template = query.get('template');
    const start: Extract<Route, { tab: 'home' }> = { tab: 'home', conversationId: null, projectId: null, ...(template && TEMPLATE_ID_PATTERN.test(template) ? { template } : {}) };
    if (pane || start.template) return withPane(start);
  }
  if (head === 'space') {
    const category = SPACE_CATEGORIES.some((c) => c.key === a) ? (a as SpaceCategory) : 'all';
    const from = query.get('from');
    const route: Route = { tab: 'space', category, projectId: b || null, ...(from ? { from } : {}) };
    return video ? { ...route, video } : route;
  }
  if (head === 'calendar') return parseCalendar(query);
  if (head === 'settings' && a === 'models') {
    const category = isModelCategory(b) ? b : 'asr';
    return isModelPage(c) ? { tab: 'models', category, page: c } : { tab: 'models', category };
  }
  if (head === 'settings') {
    // Old model deep links (local / cloud / my voice) land on the matching model configuration in Settings.
    if (a === 'local' || a === 'cloud' || a === 'voices') return { tab: 'models', category: a === 'voices' ? 'tts' : 'asr', page: a };
    // Old `/settings/agent/<tab>`: skills and permissions each go to their new locations; the rest stay in the Agent provider.
    if (a === 'agent') return { tab: 'settings', section: legacyAgentSection(b) };
    const section = isSettingsSection(a) ? a : 'general';
    const sub = settingsSub(section, b === undefined ? undefined : safeDecode(b));
    return sub ? { tab: 'settings', section, sub } : { tab: 'settings', section };
  }
  if (head === 'models') {
    const category = isModelCategory(a) ? a : 'asr';
    return isModelPage(b) ? { tab: 'models', category, page: b } : { tab: 'models', category };
  }
  if (head === 'tasks') return a ? { tab: 'tasks', taskId: decodeURIComponent(a) } : { tab: 'tasks' };
  if (head === 'welcome') return WELCOME;
  // Old links for remote compute are on the services page.
  if (head === 'tools' && a === 'remote') return { tab: 'services', service: 'remote' };
  if (head === 'services') return a ? { tab: 'services', service: decodeURIComponent(a) } : { tab: 'services' };
  // Old short tool names (translate, tts, ...) map to registry IDs.
  if (head === 'tools') {
    const tool = toolIdOf(a);
    return tool ? { tab: 'tools', tool } : { tab: 'tools' };
  }
  return HOME;
}

/** A path segment decoded (`%E1%BA%A1` → `ạ`); a malformed one is kept as it is, and then fails the check it is given to. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** `/calendar?projectId=&view=&day=&publication=`: values that cannot be read are left out (the calendar then shows its defaults). */
function parseCalendar(query: URLSearchParams): Route {
  const projectId = query.get('projectId');
  const view = query.get('view');
  const day = query.get('day');
  const publicationId = query.get('publication');
  return {
    tab: 'calendar',
    ...(projectId ? { projectId } : {}),
    ...(view && (CALENDAR_VIEWS as readonly string[]).includes(view) ? { view: view as CalendarView } : {}),
    ...(day && isCivilDate(day) ? { day } : {}),
    ...(publicationId ? { publicationId } : {}),
  };
}

function parsePane(query: URLSearchParams): WorkspaceItem | undefined {
  const video = parseTarget(query.get('video'));
  if (video) return { kind: 'video', target: video };
  const slides = parseTarget(query.get('slides'));
  if (slides) return { kind: 'slides', target: slides };
  const design = parseTarget(query.get('design'));
  if (design) return { kind: 'design', target: design };
  const designSystem = parseTarget(query.get('designSystem'));
  if (designSystem) return { kind: 'design-system', target: designSystem };
  const file = parseMediaTarget(query.get('file'));
  if (file) return { kind: 'file', target: file, ...(query.get('fileName')?{name:query.get('fileName')!}:{}) };
  if (query.get('files') === '1') return { kind: 'files' };
  const web = query.get('web');
  if (web) return { kind: 'web', id: web, url: query.get('url') ?? '' };
  return undefined;
}

function parseTarget(value: string | null): FileTarget | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.entryId === 'string') return { entryId: parsed.entryId };
    if (typeof parsed.path !== 'string') return undefined;
    if (typeof parsed.projectId === 'string') return { projectId: parsed.projectId, path: parsed.path };
    if (typeof parsed.conversationId === 'string') return { conversationId: parsed.conversationId, path: parsed.path };
  } catch {
    // Links that cannot be understood are treated as having no such tab.
  }
  return undefined;
}

function parseMediaTarget(value:string|null):MediaTarget|undefined {
  const file=parseTarget(value);if(file)return file;
  try {const p=JSON.parse(value??'null');if(p&&typeof p.conversationId==='string'&&typeof p.attachmentId==='string')return {conversationId:p.conversationId,attachmentId:p.attachmentId};
    if(p&&typeof p.videoId==='string'&&typeof p.assetId==='string')return {videoId:p.videoId,assetId:p.assetId,...(typeof p.revision==='number'?{revision:p.revision}:{})};
  }catch{}return undefined;
}
