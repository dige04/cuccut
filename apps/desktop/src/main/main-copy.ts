import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './main-copy.zh-Hans.ts';
import { zhHant } from './main-copy.zh-Hant.ts';
import { ja } from './main-copy.ja.ts';
import { ko } from './main-copy.ko.ts';
import { es } from './main-copy.es.ts';
import { fr } from './main-copy.fr.ts';
import { de } from './main-copy.de.ts';
import { nl } from './main-copy.nl.ts';
import { ptBR } from './main-copy.pt-BR.ts';
import { it } from './main-copy.it.ts';
import { ru } from './main-copy.ru.ts';
import { pl } from './main-copy.pl.ts';
import { tr } from './main-copy.tr.ts';
import { vi } from './main-copy.vi.ts';

/**
 * Copy for the desktop main process: the app menu, the open / save dialogs, and errors for when the Runtime fails to start or for web tabs. English is the source of keys and types; translations are in
 * `main-copy.<language>.ts`. Menu items use each platform's fixed wording (the English of Electron's default menu). When the UI language changes, the main process rebuilds the menu (index.ts).
 */
const en = {
  // ---- App menu (app-menu.ts) ----
  about: (app: string) => `About ${app}`,
  services: 'Services',
  hide: (app: string) => `Hide ${app}`,
  hideOthers: 'Hide Others',
  showAll: 'Show All',
  quit: (app: string) => `Quit ${app}`,
  exit: 'Exit',
  fileMenu: 'File',
  closeWindow: 'Close Window',
  close: 'Close',
  editMenu: 'Edit',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  pasteAndMatchStyle: 'Paste and Match Style',
  delete: 'Delete',
  selectAll: 'Select All',
  speech: 'Speech',
  startSpeaking: 'Start Speaking',
  stopSpeaking: 'Stop Speaking',
  viewMenu: 'View',
  reload: 'Reload',
  forceReload: 'Force Reload',
  toggleDevTools: 'Toggle Developer Tools',
  actualSize: 'Actual Size',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  toggleFullScreen: 'Toggle Full Screen',
  windowMenu: 'Window',
  minimize: 'Minimize',
  zoom: 'Zoom',
  bringAllToFront: 'Bring All to Front',

  // ---- Dialogs (index.ts) ----
  openProjectTitle: 'Open project folder',
  open: 'Open',
  choose: 'Choose',
  importAssetsTitle: 'Import assets',
  importButton: 'Import',
  mediaFilter: 'Videos, audio, and images',
  allFilesFilter: 'All files',
  openFileTitle: 'Open file',
  save: 'Save',

  // ---- Runtime fails to start or is no longer launched (runtime-supervisor.ts, reaching the UI via `getConnection`) ----
  runtimeNoDiscovery: 'Runtime started but didn’t write its discovery file',
  runtimeTimeout: 'Runtime took too long to start',
  runtimeExited: (code: number | null) => `Runtime failed to start (exit code ${code})`,
  runtimeQuitting: 'The app is quitting',

  // ---- Web tabs (web-tabs.ts) ----
  webCreateNotWindow: 'Only app windows can create web tabs',
  webTooManyTabs: 'Too many web tabs are open',
  webTabMissing: 'This web tab no longer exists',
  webClearNotWindow: 'Only app windows can clear web data',
  webOpenNotWindow: 'Only app windows can open external links',
  webOpenScheme: 'Only http and https URLs can be opened',
};

export type MainMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
