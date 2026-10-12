import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import type { AppUpdateNotice, AppUpdateSnapshot, HostBridge, UpdatesHost } from '@cuccut/ui';

type WebHost = NonNullable<HostBridge['web']>;
type WebTabState = Parameters<Parameters<WebHost['onState']>[0]>[0];

/**
 * 网页标签（架构设计 §12.10）：视图在主进程里，这里只转发调用与状态。参数在主进程里重新校验。
 */
const web: WebHost = {
  create: () => ipcRenderer.invoke('cuccut:web-create'),
  navigate: (id, url) => ipcRenderer.invoke('cuccut:web-navigate', id, url),
  back: (id) => ipcRenderer.send('cuccut:web-back', id),
  forward: (id) => ipcRenderer.send('cuccut:web-forward', id),
  reload: (id, ignoreCache) => ipcRenderer.send('cuccut:web-reload', id, ignoreCache === true),
  find: (id, query, options) => ipcRenderer.send('cuccut:web-find', id, { query, forward: options?.forward, next: options?.next }),
  stopFind: (id) => ipcRenderer.send('cuccut:web-find-stop', id),
  setViewport: (id, size) => ipcRenderer.send('cuccut:web-viewport', id, size ? { width: size.width, height: size.height } : null),
  onShortcut: (listener) => {
    const handler = (_event: IpcRendererEvent, value: Parameters<typeof listener>[0]) => listener(value);
    ipcRenderer.on('cuccut:web-shortcut', handler);
    return () => void ipcRenderer.removeListener('cuccut:web-shortcut', handler);
  },
  stop: (id) => ipcRenderer.send('cuccut:web-stop', id),
  setZoom: (id, percent) => ipcRenderer.send('cuccut:web-zoom', id, percent),
  setBounds: (id, bounds) =>
    ipcRenderer.send('cuccut:web-bounds', id, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }),
  setVisible: (id, visible) => ipcRenderer.send('cuccut:web-visible', id, visible),
  destroy: (id) => ipcRenderer.send('cuccut:web-destroy', id),
  onState: (listener) => {
    const handler = (_event: IpcRendererEvent, state: WebTabState) => listener(state);
    ipcRenderer.on('cuccut:web-state', handler);
    return () => void ipcRenderer.removeListener('cuccut:web-state', handler);
  },
  clearData: () => ipcRenderer.invoke('cuccut:web-clear-data'),
};

/**
 * 应用自动更新（架构设计 §2.6）：检查、下载、校验、换包都在主进程里，这里只转发调用并订阅状态与提醒。
 */
const updates: UpdatesHost = {
  get: () => ipcRenderer.invoke('cuccut:updates-get'),
  onState: (listener) => {
    const handler = (_event: IpcRendererEvent, snapshot: AppUpdateSnapshot) => listener(snapshot);
    ipcRenderer.on('cuccut:updates-state', handler);
    return () => void ipcRenderer.removeListener('cuccut:updates-state', handler);
  },
  onNotice: (listener) => {
    const handler = (_event: IpcRendererEvent, notice: AppUpdateNotice) => listener(notice);
    ipcRenderer.on('cuccut:updates-notice', handler);
    return () => void ipcRenderer.removeListener('cuccut:updates-notice', handler);
  },
  configure: (prefs) => ipcRenderer.send('cuccut:updates-configure', { autoCheck: prefs.autoCheck, autoDownload: prefs.autoDownload }),
  check: () => ipcRenderer.invoke('cuccut:updates-check'),
  download: () => ipcRenderer.invoke('cuccut:updates-download'),
  cancel: () => ipcRenderer.invoke('cuccut:updates-cancel'),
  install: () => ipcRenderer.invoke('cuccut:updates-install'),
  openDownloadPage: () => ipcRenderer.invoke('cuccut:updates-open-download-page'),
};

/**
 * 渲染进程能用的全部原生能力。保持最小：业务请求不经过这里，界面直连 Runtime。
 * 形状与 @cuccut/ui 的 HostBridge 一致。
 */
contextBridge.exposeInMainWorld('cuccut', {
  platform: process.platform,
  getConnection: () => ipcRenderer.invoke('cuccut:connection'),
  pickDirectory: (options?: { title?: string }) => ipcRenderer.invoke('cuccut:pick-directory', options),
  pickMediaFiles: () => ipcRenderer.invoke('cuccut:pick-media'),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  revealPath: (target: string) => ipcRenderer.invoke('cuccut:reveal', target),
  openFile: (target: string) => ipcRenderer.invoke('cuccut:open-file', target),
  web,
  updates,
  openExternal: (url: string) => ipcRenderer.invoke('cuccut:open-external', url),
  pickMessageFiles: (options) => ipcRenderer.invoke('cuccut:pick-message-files', options),
  pickFiles: (options) => ipcRenderer.invoke('cuccut:pick-files', options),
  pickSavePath: (options) => ipcRenderer.invoke('cuccut:pick-save-path', options),
  saveFile: (options) => ipcRenderer.invoke('cuccut:save-file', options),
  // 界面语言：主进程据此换应用菜单与对话框的语言（参数在主进程里重新校验）。
  setLocale: (locale) => ipcRenderer.send('cuccut:set-locale', locale),
} satisfies HostBridge);
