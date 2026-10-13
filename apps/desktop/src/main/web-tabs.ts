import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Session,
  type WebContents,
} from 'electron';
import type { HostBridge } from '@cuccut/ui';
import { M } from './main-copy.ts';
import { OpenThrottle, browserUserAgent, checkWebUrl, clampZoom, isRequestAllowed, isWebTabId, parseBounds, parseDeviceSize, parseFindRequest, nativeWebShortcut } from './web-policy.ts';

/**
 * The host side of web tabs (architecture design §12.10).
 *
 * Each tab is one WebContentsView attached to the window that opened it: its own `persist:web` partition, sandboxed, context-isolated,
 * with no Node and no preload script, so a web page gets none of CucCut's capabilities. Only http/https is allowed; loopback addresses, `file:` and the app's own pages
 * are always rejected (checked once before navigation, and again for every request in the partition). New windows and permission requests are always rejected with a notice; downloads are handed to the system browser.
 *
 * Every parameter passed from the renderer process is validated again; tab IDs are generated here, and only the tabs of the window that opened them are recognized.
 */

type WebTabState = Parameters<Parameters<NonNullable<HostBridge['web']>['onState']>[0]>[0];

export const WEB_PARTITION = 'persist:web';
/** Maximum number of web views per window. */
const MAX_TABS_PER_WINDOW = 24;

interface Tab {
  id: string;
  owner: BrowserWindow;
  view: WebContentsView;
  zoom: number;
  error: WebTabState['error'];
  ready: boolean;
  emulating: boolean;
  device: { width: number; height: number } | null;
  bounds: { x: number; y: number; width: number; height: number };
  find: { query: string; active: number; matches: number };
  findRequest: number;
  notice: NonNullable<WebTabState['notice']> | null;
}

export interface WebTabsOptions {
  /** The app's own origin (the renderer dev server during development); web tabs may not open it. */
  appOrigins: readonly string[];
}

export function installWebTabs({ appOrigins }: WebTabsOptions): void {
  const tabs = new Map<string, Tab>();
  const watchedOwners = new WeakSet<BrowserWindow>();
  const popups = new OpenThrottle(1000);
  let counter = 0;
  let partition: Session | null = null;

  /** The web partition is configured only once: permissions, downloads, request interception, User-Agent. */
  const webSession = (): Session => {
    if (partition) return partition;
    const ses = session.fromPartition(WEB_PARTITION);
    ses.setPermissionRequestHandler((wc, _permission, callback) => {
      callback(false);
      const tab = [...tabs.values()].find(t => t.view.webContents === wc);
      if (tab) notice(tab, 'permission');
    });
    ses.setPermissionCheckHandler(() => false);
    ses.setDevicePermissionHandler(() => false);
    ses.on('will-download', (event, item, wc) => {
      event.preventDefault();
      const target = checkWebUrl(item.getURL(), { appOrigins });
      const tab = [...tabs.values()].find(t => t.view.webContents === wc);
      if (target.ok && tab && popups.allow(tab.id, Date.now())) {
        void shell.openExternal(target.url).then(() => notice(tab, 'download')).catch(() => {});
      }
    });
    // No filter: each request is judged on its own, blocking subresource and WebSocket requests from web pages to local services (including the Runtime gateway).
    ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isRequestAllowed(details.url, appOrigins) }));
    ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
    partition = ses;
    return ses;
  };

  const stateOf = (tab: Tab): WebTabState => {
    const wc = tab.view.webContents;
    return {
      id: tab.id,
      url: wc.getURL(),
      title: wc.getTitle(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      loading: wc.isLoading(),
      error: tab.error,
      find: tab.find,
      notice: tab.notice,
    };
  };

  const emit = (tab: Tab): void => {
    if (tab.owner.isDestroyed() || tab.view.webContents.isDestroyed()) return;
    tab.owner.webContents.send('cuccut:web-state', stateOf(tab));
  };

  const notice = (tab: Tab, kind: 'popup' | 'download' | 'permission'): void => {
    tab.notice = { serial: (tab.notice?.serial ?? 0) + 1, kind };
    emit(tab);
  };
  const applyDevice = (tab: Tab): void => {
    const wc = tab.view.webContents;
    if (!tab.ready) return;
    if (!tab.device) { if (tab.emulating) wc.disableDeviceEmulation(); tab.emulating = false; return; }
    const size = tab.device;
    const scale = Math.min(1, tab.bounds.width / size.width, tab.bounds.height / size.height);
    if (scale <= 0) return;
    wc.enableDeviceEmulation({ screenPosition: 'desktop', screenSize: size, viewPosition: { x: 0, y: 0 },
      deviceScaleFactor: 1, viewSize: size, scale });
    tab.emulating = true;
  };

  const destroy = (tab: Tab): void => {
    tabs.delete(tab.id);
    popups.forget(tab.id);
    if (!tab.owner.isDestroyed()) tab.owner.contentView.removeChildView(tab.view);
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  };

  const destroyAllOf = (owner: BrowserWindow): void => {
    for (const tab of [...tabs.values()]) if (tab.owner === owner) destroy(tab);
  };

  /** When the window closes, the UI reloads or the renderer crashes, the web views it opened are left without an owner, so they are destroyed together. */
  const watchOwner = (owner: BrowserWindow): void => {
    if (watchedOwners.has(owner)) return;
    watchedOwners.add(owner);
    owner.on('closed', () => destroyAllOf(owner));
    owner.webContents.on('did-navigate', () => destroyAllOf(owner));
    owner.webContents.on('render-process-gone', () => destroyAllOf(owner));
  };

  /** Only requests from the UI in the window's main frame are accepted; web views (which have no preload script) and subframes are not. */
  const ownerOf = (event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.webContents !== event.sender) return null;
    if (!event.senderFrame || event.senderFrame.parent !== null) return null;
    return owner;
  };

  const tabOf = (event: IpcMainEvent | IpcMainInvokeEvent, id: unknown): Tab | null => {
    const owner = ownerOf(event);
    if (!owner || !isWebTabId(id)) return null;
    const tab = tabs.get(id);
    return tab && tab.owner === owner && !tab.view.webContents.isDestroyed() ? tab : null;
  };

  const wire = (tab: Tab, wc: WebContents): void => {
    // New windows from web pages are always rejected with a notice; opening externally is triggered only by a user action in the UI.
    wc.setWindowOpenHandler(({ url }) => {
      const target = checkWebUrl(url, { appOrigins });
      // Keep the current page and tell the user; do not let a script pop-up launch an external app automatically.
      if (target.ok) notice(tab, 'popup');
      return { action: 'deny' };
    });
    // Navigations and redirects initiated by the web page itself: the main frame is judged by the rules, and on rejection it stops and pushes a “rejected” status. Subframes are left to request interception.
    const guard = (details: Electron.Event<{ url: string; isMainFrame: boolean }>): void => {
      if (!details.isMainFrame) return;
      const check = checkWebUrl(details.url, { appOrigins });
      if (check.ok) return;
      details.preventDefault();
      tab.error = { kind: 'blocked', reason: check.reason, url: details.url };
      emit(tab);
    };
    wc.on('will-navigate', (details) => guard(details));
    wc.on('will-redirect', (details) => guard(details));
    wc.on('found-in-page', (_event, result) => {
      if (result.requestId !== tab.findRequest) return;
      tab.find = { ...tab.find, active: result.activeMatchOrdinal, matches: result.matches };
      emit(tab);
    });
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const action = nativeWebShortcut(input, process.platform === 'darwin');
      if (!action) return;
      event.preventDefault();
      tab.owner.webContents.focus();
      tab.owner.webContents.send('cuccut:web-shortcut', { id: tab.id, action });
    });
    wc.on('did-start-navigation', (details) => { if (details.isMainFrame && !details.isSameDocument) tab.ready = false; });
    wc.on('dom-ready', () => { tab.ready = true; applyDevice(tab); emit(tab); });
    wc.on('did-start-loading', () => emit(tab));
    wc.on('did-stop-loading', () => emit(tab));
    wc.on('did-navigate', () => {
      // Zoom is recorded per origin in the partition: when the site changes, this tab's zoom has to be reapplied.
      wc.setZoomFactor(tab.zoom / 100);
      applyDevice(tab);
      tab.findRequest = 0;
      tab.find = { query: '', active: 0, matches: 0 };
      tab.error = null;
      emit(tab);
    });
    wc.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
      if (isMainFrame) emit(tab);
    });
    wc.on('page-title-updated', () => emit(tab));
    wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      // -3 (ERR_ABORTED) means stopped, blocked or navigated away, and is not counted as a failure.
      if (!isMainFrame || code === -3) return;
      tab.error = { kind: 'failed', code, description, url };
      emit(tab);
    });
    wc.on('render-process-gone', () => {
      tab.error = { kind: 'crashed' };
      emit(tab);
    });
  };

  ipcMain.handle('cuccut:web-create', (event) => {
    const owner = ownerOf(event);
    if (!owner) throw new Error(M.webCreateNotWindow);
    if ([...tabs.values()].filter((t) => t.owner === owner).length >= MAX_TABS_PER_WINDOW) throw new Error(M.webTooManyTabs);
    watchOwner(owner);
    const view = new WebContentsView({
      webPreferences: {
        session: webSession(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        nodeIntegrationInWorker: false,
        webviewTag: false,
        safeDialogs: true,
        navigateOnDragDrop: false,
        spellcheck: false,
      },
    });
    view.setVisible(false);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    owner.contentView.addChildView(view);
    const tab: Tab = { id: `web_${++counter}_${Math.random().toString(36).slice(2, 10)}`, owner, view, zoom: 100, error: null, ready: false, emulating: false, device: null, bounds: { x: 0, y: 0, width: 0, height: 0 }, find: { query: '', active: 0, matches: 0 }, findRequest: 0, notice: null };
    tabs.set(tab.id, tab);
    wire(tab, view.webContents);
    return tab.id;
  });

  ipcMain.handle('cuccut:web-navigate', (event, id: unknown, url: unknown) => {
    const tab = tabOf(event, id);
    if (!tab) throw new Error(M.webTabMissing);
    // The main process's loadURL does not go through will-navigate, so this is the only gate.
    const check = checkWebUrl(url, { appOrigins });
    if (!check.ok) {
      tab.error = { kind: 'blocked', reason: check.reason, url: typeof url === 'string' ? url.slice(0, 2048) : '' };
      emit(tab);
      return check;
    }
    tab.error = null;
    // Failures are reported to the UI by did-fail-load; nothing is thrown here.
    tab.view.webContents.loadURL(check.url).catch(() => {});
    return check;
  });

  const onTab = (channel: string, act: (tab: Tab, value: unknown) => void): void => {
    ipcMain.on(channel, (event, id: unknown, value: unknown) => {
      const tab = tabOf(event, id);
      if (tab) act(tab, value);
    });
  };

  onTab('cuccut:web-back', (tab) => { if (tab.view.webContents.navigationHistory.canGoBack()) tab.view.webContents.navigationHistory.goBack(); });
  onTab('cuccut:web-forward', (tab) => { if (tab.view.webContents.navigationHistory.canGoForward()) tab.view.webContents.navigationHistory.goForward(); });
  onTab('cuccut:web-reload', (tab, ignoreCache) => {
    tab.error = null;
    if (ignoreCache === true) tab.view.webContents.reloadIgnoringCache();
    else tab.view.webContents.reload();
  });
  onTab('cuccut:web-find', (tab, raw) => {
    const request = parseFindRequest(raw);
    if (!request || !tab.ready) return;
    tab.find = { query: request.query, active: 0, matches: 0 };
    tab.findRequest = tab.view.webContents.findInPage(request.query, { forward: request.forward, findNext: !request.next });
    emit(tab);
  });
  onTab('cuccut:web-find-stop', (tab) => {
    if (tab.findRequest) tab.view.webContents.stopFindInPage('clearSelection');
    tab.findRequest = 0;
    tab.find = { query: '', active: 0, matches: 0 };
    emit(tab);
  });
  onTab('cuccut:web-viewport', (tab, raw) => {
    if (raw !== null) {
      const size = parseDeviceSize(raw);
      if (!size) return;
      tab.device = size;
    } else tab.device = null;
    applyDevice(tab);
  });
  onTab('cuccut:web-stop', (tab) => tab.view.webContents.stop());
  onTab('cuccut:web-zoom', (tab, value) => {
    const zoom = clampZoom(value);
    if (zoom === null) return;
    tab.zoom = zoom;
    tab.view.webContents.setZoomFactor(zoom / 100);
  });
  onTab('cuccut:web-bounds', (tab, value) => {
    const bounds = parseBounds(value);
    if (bounds) { tab.bounds = bounds; tab.view.setBounds(bounds); applyDevice(tab); }
  });
  onTab('cuccut:web-visible', (tab, value) => {
    if (typeof value === 'boolean') {
      if (value) { tab.view.webContents.setZoomFactor(tab.zoom / 100); applyDevice(tab); }
      tab.view.setVisible(value);
    }
  });
  onTab('cuccut:web-destroy', (tab) => destroy(tab));

  ipcMain.handle('cuccut:web-clear-data', async (event) => {
    if (!ownerOf(event)) throw new Error(M.webClearNotWindow);
    const ses = webSession();
    await ses.clearStorageData();
    await ses.clearCache();
    await ses.clearAuthCache();
  });

  // The UI's own “open in browser” action: only http/https is accepted, with the username and password stripped; local addresses (the user's own dev server) may be handed to the system browser.
  ipcMain.handle('cuccut:open-external', async (event, url: unknown) => {
    if (!ownerOf(event)) throw new Error(M.webOpenNotWindow);
    const target = checkWebUrl(url, { allowLoopback: true });
    if (!target.ok) throw new Error(M.webOpenScheme);
    await shell.openExternal(target.url);
  });
}
