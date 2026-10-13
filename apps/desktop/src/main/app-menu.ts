import type { MenuItemConstructorOptions } from 'electron';
import { M } from './main-copy.ts';

/**
 * Template for the app menu: the same groups as Electron's default menu (app, File, Edit, View, Window), except that the labels are taken in the current UI language, while shortcuts and behaviour are still set by each item's role. The default menu's “Help” holds only links to Electron's own website, which are not included here.
 * It does not depend on the Electron runtime, so it is easy to test; when the UI language changes, the main process regenerates it and sets it (index.ts).
 */
export function appMenuTemplate(platform: NodeJS.Platform, appName: string): MenuItemConstructorOptions[] {
  const mac = platform === 'darwin';
  const separator: MenuItemConstructorOptions = { type: 'separator' };
  const quit: MenuItemConstructorOptions = { role: 'quit', label: platform === 'win32' ? M.exit : M.quit(appName) };

  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { role: 'about', label: M.about(appName) },
      separator,
      { role: 'services', label: M.services },
      separator,
      { role: 'hide', label: M.hide(appName) },
      { role: 'hideOthers', label: M.hideOthers },
      { role: 'unhide', label: M.showAll },
      separator,
      quit,
    ],
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: M.fileMenu,
    submenu: [mac ? { role: 'close', label: M.closeWindow } : quit],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: M.editMenu,
    submenu: [
      { role: 'undo', label: M.undo },
      { role: 'redo', label: M.redo },
      separator,
      { role: 'cut', label: M.cut },
      { role: 'copy', label: M.copy },
      { role: 'paste', label: M.paste },
      ...(mac
        ? ([
            { role: 'pasteAndMatchStyle', label: M.pasteAndMatchStyle },
            { role: 'delete', label: M.delete },
            { role: 'selectAll', label: M.selectAll },
            separator,
            {
              label: M.speech,
              submenu: [
                { role: 'startSpeaking', label: M.startSpeaking },
                { role: 'stopSpeaking', label: M.stopSpeaking },
              ],
            },
          ] satisfies MenuItemConstructorOptions[])
        : ([{ role: 'delete', label: M.delete }, separator, { role: 'selectAll', label: M.selectAll }] satisfies MenuItemConstructorOptions[])),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: M.viewMenu,
    submenu: [
      { role: 'reload', label: M.reload },
      { role: 'forceReload', label: M.forceReload },
      { role: 'toggleDevTools', label: M.toggleDevTools },
      separator,
      { role: 'resetZoom', label: M.actualSize },
      { role: 'zoomIn', label: M.zoomIn },
      { role: 'zoomOut', label: M.zoomOut },
      separator,
      { role: 'togglefullscreen', label: M.toggleFullScreen },
    ],
  };

  // role 'window': macOS treats it as the “Window” menu and lists the open windows at the end.
  const windowMenu: MenuItemConstructorOptions = {
    label: M.windowMenu,
    ...(mac ? { role: 'window' as const } : {}),
    submenu: [
      { role: 'minimize', label: M.minimize },
      { role: 'zoom', label: M.zoom },
      ...(mac
        ? ([separator, { role: 'front', label: M.bringAllToFront }] satisfies MenuItemConstructorOptions[])
        : ([{ role: 'close', label: M.close }] satisfies MenuItemConstructorOptions[])),
    ],
  };

  return [...(mac ? [appMenu] : []), fileMenu, editMenu, viewMenu, windowMenu];
}
