import type { Locale } from '@cuccut/protocol';

/** Native capabilities provided by the host (the Electron preload script). The UI package does not depend on Electron directly. */
export interface HostBridge {
  platform: string;
  /** False when the web service does not open attachment upload; the desktop gateway supports it by default. */
  supportsImageAttachments?: boolean;
  /** Same-origin, authenticated upload support for ordinary documents/media. */
  supportsFileAttachments?: boolean;
  getConnection(): Promise<{ endpoint: string; token: string }>;
  /**
   * Pick a local directory; null when cancelled. `title` is the dialog title (for example when choosing a save location); when not given it is “Open project directory”.
   * In the browser it cannot be picked; a hint is shown and then null is returned.
   */
  pickDirectory(options?: { title?: string }): Promise<string | null>;
  /** Pick material files to import (video, audio, images). Returns an empty array when cancelled. */
  pickMediaFiles(): Promise<string[]>;
  /** The on-disk path of a file dragged into the window; returns an empty string when it is not a local file. */
  pathForFile(file: File): string;
  revealPath(target: string): Promise<void>;
  /** Open a local document or media with the system's default app; null means unsupported, an empty string means success, anything else is a system error. The web has no such capability. */
  openFile?(target: string): Promise<string | null>;
  /** Embedded web pages (desktop only). Not present in browser preview: web tabs show “This environment cannot embed web pages”. */
  web?: WebHost;
  /** Open an http/https address in the system browser (desktop only). */
  openExternal?(url: string): Promise<void>;
  /** Pick files to open by type (the system open dialog). Returns an empty array when cancelled. In hosts without it, the UI greys out the entry points that need it. */
  pickFiles?(options: PickFilesOptions): Promise<string[]>;
  /** The unified picker for conversation attachments: local files and directories; supported images may carry their raw bytes. The web has no local-path capability. */
  pickMessageFiles?(options: PickMessageFilesOptions): Promise<MessageFile[]>;
  /** Pick a save location (the system save dialog). Returns null when cancelled. Without it, native “Save as” is unavailable; video export can still be handed to the Runtime to save. */
  pickSavePath?(options: PickSavePathOptions): Promise<string | null>;
  /**
   * Save the file bytes the UI holds to the location the user picks in the system save dialog (both the dialog and the write happen in the main process), and return the saved path; null when cancelled, and throws when the write fails.
   * Desktop only; the web does not have it, and the UI hands the file to the browser to download instead (design canvas export, docs/design/canvas §8.3).
   */
  saveFile?(options: SaveFileOptions): Promise<string | null>;
  /** App auto-update (architecture design §2.6, desktop only). In hosts without it, no update-related UI appears at all. */
  updates?: UpdatesHost;
  /** The UI language changed (also called once at startup): the host switches the language of native menus and dialogs accordingly. Hosts without it do nothing. */
  setLocale?(locale: Locale): void;
}

/** A set of file types in the open / save dialog: extensions without the dot; `*` means all files. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PickFilesOptions {
  title?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  /** Allow multiple selection; single selection by default. */
  multiple?: boolean;
}

export interface MessageFile {
  path: string;
  kind: 'file' | 'directory';
  /** Only images the user has just selected that meet the attachment size and format limits. */
  image?: { mimeType: string; bytes: Uint8Array };
}

export interface PickMessageFilesOptions {
  title: string;
  filesLabel: string;
  foldersLabel: string;
  cancelLabel: string;
  /** Image bytes are read only when the agent can accept images; otherwise only a local reference is passed. */
  images: boolean;
}

export interface PickSavePathOptions {
  title?: string;
  buttonLabel?: string;
  /** Suggested file name (only the file-name part is used; the directory is decided by the system dialog). */
  defaultName?: string;
  /** The absolute directory the system save dialog opens at first; when not given, the system's default location is used. */
  defaultDir?: string;
  filters?: FileFilter[];
}

export interface SaveFileOptions extends PickSavePathOptions {
  /** The content to write. */
  data: Uint8Array;
}

/**
 * Web tabs (architecture design §12.10): the host gives each tab its own native web view (`persist:web` partition, sandboxed, no preload script).
 * The view sits above the UI, and its position is reported to the host by the UI through `setBounds` (CSS pixels within the window).
 */
export interface WebHost {
  /** Create a new web view, hidden at first; returns the tab id. */
  create(): Promise<string>;
  /** Open a URL. If a rule refuses it, it is not opened, and a status carrying `blocked` is pushed. */
  navigate(id: string, url: string): Promise<WebNavigateResult>;
  back(id: string): void;
  forward(id: string): void;
  reload(id: string, ignoreCache?: boolean): void;
  find(id: string, query: string, options?: { forward?: boolean; next?: boolean }): void;
  stopFind(id: string): void;
  setViewport(id: string, size: { width: number; height: number } | null): void;
  onShortcut(listener: (event: { id: string; action: 'focus-address' | 'find' | 'reload' | 'force-reload' }) => void): () => void;
  stop(id: string): void;
  /** Zoom percentage; the host clamps it to 50–200. */
  setZoom(id: string, percent: number): void;
  setBounds(id: string, bounds: { x: number; y: number; width: number; height: number }): void;
  setVisible(id: string, visible: boolean): void;
  destroy(id: string): void;
  /** Status changes for all tabs; returns an unsubscribe function. */
  onState(listener: (state: WebTabState) => void): () => void;
  /** Clear cookies, storage and cache in the web partition (for the button on the settings page). */
  clearData(): Promise<void>;
}

/** Reasons the host refuses: not a URL, not http/https, a loopback local address, or the app's own page. */
export type WebBlockReason = 'invalid' | 'scheme' | 'loopback' | 'app-origin';

export type WebNavigateResult = { ok: true; url: string } | { ok: false; reason: WebBlockReason };

export type WebTabError =
  | { kind: 'blocked'; reason: WebBlockReason; url: string }
  | { kind: 'failed'; code: number; description: string; url: string }
  | { kind: 'crashed' };

export interface WebTabState {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  error: WebTabError | null;
  find?: { query: string; active: number; matches: number };
  notice?: { serial: number; kind: 'popup' | 'download' | 'permission' } | null;
}

/**
 * App auto-update (architecture design §2.6, design draft §17.7): checking the update source, background download, verifying size and digest, and swapping the package all happen in the host's main process,
 * and the Runtime does not take part. The state machine is also in the main process (`apps/desktop/src/main/app-update-rules.ts`); the UI only mirrors the state it pushes and starts actions, and passes the stop barrier before installing (asks the user first when there are active tasks). Download completion never restarts automatically; when something is downloaded, the app exits normally, and the main process installs it on the way out and does not reopen it.
 */
export interface UpdatesHost {
  /** The current state. */
  get(): Promise<AppUpdateSnapshot>;
  /** Push a full copy whenever the state changes; returns an unsubscribe function. */
  onState(listener: (snapshot: AppUpdateSnapshot) => void): () => void;
  /** Notices to show after an automatic check (toast); returns an unsubscribe function. */
  onNotice(listener: (notice: AppUpdateNotice) => void): () => void;
  /** Update preferences (`updates.autoCheck` / `updates.autoDownload` held by the Runtime, §5.10). The main process does no automatic checks until it receives them. */
  configure(prefs: AppUpdatePrefs): void;
  /** Manual check (the “Check for updates” on the About page and “Retry” after an error). */
  check(): Promise<void>;
  /** Download and verify (“Download and install”, and “Retry” after a download error): after the download reaches 100%, it is verified and put in place first, then enters “Downloaded”. */
  download(): Promise<void>;
  /** Cancel the download in progress (including the verification phase after 100%), returning to “New version available”. */
  cancel(): Promise<void>;
  /** “Restart and update”: starts the package-swap program, then the app exits normally, and reopens after the swap. The UI passes the stop barrier before calling it. */
  install(): Promise<void>;
  /** Open the download page in the system browser. */
  openDownloadPage(): Promise<void>;
}

export interface AppUpdatePrefs {
  autoCheck: boolean;
  autoDownload: boolean;
}

/** Installer package forms: the notarised ZIP for macOS (the main path) and DMG (for compatibility), and the installer for Windows. */
export type AppUpdateFormat = 'zip' | 'dmg' | 'exe';

/** Information about this version from the schema-1 update manifest (verified by the main process). The UI picks the language of the notes. */
export interface AppUpdateInfo {
  version: string;
  build: number;
  date: string;
  /** The minimum OS version the new version requires (compared on macOS only). */
  minimumSystemVersion: string | null;
  notes: string;
  /** Notes in each language; the keys are language codes (`zh-Hans`, `en`, …). */
  notesLocalized: Record<string, string>;
  format: AppUpdateFormat;
  url: string;
  size: number;
  /** 64-digit hexadecimal, lowercase. */
  sha256: string;
}

/**
 * Error categories; the UI shows its copy according to these: the check failed, the download did not finish, verification failed (file deleted), the signature does not match the current app,
 * the install did not finish, or this machine cannot swap the package itself (the installer has been shown and the download page opened).
 */
export type AppUpdateFailure = 'check' | 'download' | 'verify' | 'signature' | 'install' | 'manual';

/**
 * Update state (the state machine in design draft model-app-update.js). `available.bg` / `ready.bg` are silent checks in flight (when an automatic check starts while a new version is already available or downloaded, the displayed state does not change); `systemUnmet` is a macOS version the new version requires and this machine does not meet. After `pct` of `downloading` reaches 100, it is the verification phase (checking, unpacking, verifying the signature), and only then does it enter `ready`.
 */
export type AppUpdateState =
  | { k: 'unsupported'; why: 'dev' | 'appStore' }
  | { k: 'idle' }
  | { k: 'checking' }
  | { k: 'upToDate' }
  | { k: 'available'; info: AppUpdateInfo; systemUnmet?: string; bg?: boolean }
  | { k: 'downloading'; info: AppUpdateInfo; pct: number }
  | { k: 'ready'; info: AppUpdateInfo; path: string; bg?: boolean }
  | { k: 'installing'; info: AppUpdateInfo }
  | { k: 'error'; failure: AppUpdateFailure; info: AppUpdateInfo | null };

export interface AppUpdateSnapshot {
  state: AppUpdateState;
  /** Time of the last check (unix seconds); null when no check has been made since this launch. */
  lastCheckAt: number | null;
  /** The version currently running. */
  current: { version: string; build: number };
}

/** Reminders after an automatic check: “Update available” when auto-download is off, and “Downloaded” when the background download has finished (once per build). */
export type AppUpdateNotice = { kind: 'available'; info: AppUpdateInfo } | { kind: 'ready'; info: AppUpdateInfo };
