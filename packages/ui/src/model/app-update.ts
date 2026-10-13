import { defineMessages, getLocale, live, onLocaleChange, type JobRecord, type TaskSummary } from '@cuccut/protocol';
import type { AppUpdateFailure, AppUpdateInfo, AppUpdateState } from '../host.ts';
import { TASK_VIEW_COPY } from '../copy.ts';
import { jobRow, type TaskAction } from './task-list.ts';
import { zhHans } from './app-update.zh-Hans.ts';
import { zhHant } from './app-update.zh-Hant.ts';
import { ja } from './app-update.ja.ts';
import { ko } from './app-update.ko.ts';
import { es } from './app-update.es.ts';
import { fr } from './app-update.fr.ts';
import { de } from './app-update.de.ts';
import { nl } from './app-update.nl.ts';
import { ptBR } from './app-update.pt-BR.ts';
import { it } from './app-update.it.ts';
import { ru } from './app-update.ru.ts';
import { pl } from './app-update.pl.ts';
import { tr } from './app-update.tr.ts';
import { vi } from './app-update.vi.ts';

/** Copy for app updates (the English is the source of the keys and types; translations are in `app-update.zh-Hans.ts`). */
const en = {
  justNow: 'Just now',
  minutesAgo: (n: number) => (n === 1 ? '1 minute ago' : `${n} minutes ago`),
  hoursAgo: (n: number) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
  daysAgo: (n: number) => (n === 1 ? '1 day ago' : `${n} days ago`),
  failure: {
    check: 'Can’t reach the update server. Check your network and try again.',
    download: 'The download didn’t finish. Check your network and try again.',
    verify: 'The downloaded file didn’t pass verification and was deleted.',
    signature: 'The new version’s signature doesn’t match this app, so it wasn’t installed. Install it manually from the download page.',
    install: 'The installation couldn’t finish. Install it manually from the download page.',
    manual: 'This copy of CucCut can’t replace itself. The downloaded file and the download page are open; install it manually.',
  } as Record<AppUpdateFailure, string>,
  version: (version: string, build: number) => `${version} (Build ${build})`,
  appStore: 'App Store versions are updated by the App Store',
  devBuild: 'Development builds don’t check for updates',
  checking: 'Checking…',
  upToDate: 'You’re up to date',
  checkForUpdates: 'Check for Updates',
  available: (version: string) => `New version ${version} available`,
  needsMacOS: (version: string) => `Requires macOS ${version}`,
  downloadAndInstall: 'Download and install',
  verifyingVersion: (version: string) => `Verifying ${version}…`,
  downloadingVersion: (version: string, pct: number) => `Downloading ${version} · ${pct}%`,
  cancel: 'Cancel',
  readyWaiting: (version: string) => `${version} downloaded; it will install when background tasks finish`,
  restartAndUpdate: 'Restart and update',
  stopWaiting: 'Don’t wait',
  readyOnQuit: (version: string) => `${version} downloaded; it will install automatically when you quit CucCut`,
  installing: 'Installing…',
  retry: 'Try again',
  downloadPage: 'Go to download page',
  lastCheck: (when: string) => `Last checked: ${when}`,
  waitingRunning: (n: number) =>
    `${n === 1 ? '1 background task is' : `${n} background tasks are`} still running; the update installs automatically when ${n === 1 ? 'it finishes' : 'they all finish'}.`,
  waitingDone: 'Background tasks have finished. Installing…',
  tipAvailable: (version: string) => `New version · CucCut ${version}`,
  tipVerifying: 'Verifying update…',
  tipDownloading: (pct: number) => `Downloading update · ${pct}%`,
  tipReady: 'Update downloaded · Installs when you quit',
  tipError: 'Update failed · Click to view',
  later: 'Later',
  verifying: 'Verifying…',
  downloading: (pct: number) => `Downloading · ${pct}%`,
  titleReady: 'Update downloaded',
  titleAvailable: 'New version available',
  current: (version: string) => `You’re using CucCut ${version}.`,
  noteOnQuit: 'It will install automatically when you quit CucCut; no need to restart now.',
  notesTitle: 'What’s new',
  readyToast: (version: string) => `CucCut ${version} downloaded; it will install automatically when you quit`,
  availableToast: (version: string) => `CucCut ${version} is ready to update`,
  view: 'View',
  restartTitle: 'Restart and update now?',
  restartBody: (n: number) =>
    `${n === 1 ? '1 background task is' : `${n} background tasks are`} running. Restarting will interrupt ${n === 1 ? 'it' : 'them'}; you can start ${n === 1 ? 'it' : 'them'} again afterward.`,
  remoteTitle: 'These run remotely. After stopping, they may keep running or incurring charges on the provider’s side:',
  stopAndInstall: 'Stop now and install',
  waitAndInstall: 'Install when tasks finish',
  autoRow: {
    label: 'Automatically check for and download updates',
    desc: 'Checks at launch and every 6 hours after that. Downloaded updates install the next time you quit, or you can restart to update right away. CucCut never restarts on its own.',
  },
};
export type AppUpdateMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/*
 * UI model for automatic app updates (design spec model-app-update.js, §17.7): the status block under Settings › About, the update button on the rail, the update window, toasts,
 * the pre-install stop barrier (architecture design §2.6), and the switches under Settings › General. The state machine lives in the main process (app-update-rules.ts in apps/desktop);
 * this layer only turns the mirrored state into what to show. Copy follows the design spec word for word; the caller passes `now` (unix seconds), so this layer does not read the clock.
 */

/** Maximum number of description lines shown on the About page. */
export const NOTES_MAX_LINES = 6;

/** Release notes are picked by UI language (`notesLocalized` uses the app's language code). */
export let NOTES_LANG: string = getLocale();
onLocaleChange((locale) => {
  NOTES_LANG = locale;
});

/**
 * Which language a note is taken in (same rules as `notes_for` in the App): exact code → another code with the same primary language → `en` → the language-neutral `notes`.
 * A blank note counts as missing.
 */
export function notesText(info: Pick<AppUpdateInfo, 'notes' | 'notesLocalized'>, lang: string): string {
  const pick = (key: string) => {
    const text = info.notesLocalized[key];
    return text && text.trim() ? text : null;
  };
  const primary = lang.split('-')[0];
  const sibling = Object.entries(info.notesLocalized).find(([key, text]) => key.split('-')[0] === primary && text.trim())?.[1];
  return pick(lang) ?? sibling ?? pick('en') ?? info.notes;
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Notes on the About page: at most 6 lines; `more` means the text was cut. */
export function notesFor(info: AppUpdateInfo | null, lang: string): { lines: string[]; more: boolean } {
  if (!info) return { lines: [], more: false };
  const all = lines(notesText(info, lang));
  return { lines: all.slice(0, NOTES_MAX_LINES), more: all.length > NOTES_MAX_LINES };
}

/** All notes in the update window (not truncated); list markers already at the start of a line are stripped, since the window draws its own bullets. */
export function notesAll(info: AppUpdateInfo | null, lang: string): string[] {
  if (!info) return [];
  return lines(notesText(info, lang))
    .map((line) => line.replace(/^[•\-*]\s*/u, ''))
    .filter(Boolean);
}

/** Relative time for “Last checked: …”. */
export function relTime(thenSec: number, nowSec: number): string {
  const d = Math.max(0, Math.floor(nowSec - thenSec));
  if (d < 60) return M.justNow;
  if (d < 3600) return M.minutesAgo(Math.floor(d / 60));
  if (d < 86400) return M.hoursAgo(Math.floor(d / 3600));
  return M.daysAgo(Math.floor(d / 86400));
}

/** The error-state sentence: the main process reports only the category, and the copy lives on the UI side (the check and verification sentences follow the design spec). */
export const FAILURE_TEXT: Record<AppUpdateFailure, string> = live(() => M.failure);

const verOf = (info: Pick<AppUpdateInfo, 'version' | 'build'>) => M.version(info.version, info.build);

/**
 * UI actions: `later` only closes the window; `restart` goes through the stop barrier and then installs; `retry` re-checks or re-downloads depending on which step failed;
 * `stopWaiting` stops waiting for background tasks to finish.
 */
export type UpdateAction = 'check' | 'download' | 'cancel' | 'restart' | 'install' | 'retry' | 'downloadPage' | 'later' | 'stopWaiting';

export interface UpdateButton {
  k: UpdateAction;
  label: string;
  variant: 'accent' | 'secondary';
  disabled: boolean;
}

const btn = (k: UpdateAction, label: string, variant: UpdateButton['variant'] = 'secondary', disabled = false): UpdateButton => ({
  k,
  label,
  variant,
  disabled,
});

export interface StatusView {
  line: string | null;
  tone?: 'muted' | 'positive' | 'negative' | 'strong';
  notes?: { lines: string[]; more: boolean };
  /** The line shown in red when the OS version is too old. */
  warn?: string;
  progress?: number;
  actions: UpdateButton[];
  link?: { k: UpdateAction; label: string };
  sub?: string | null;
}

export interface ViewContext {
  lang: string;
  lastCheck: number | null;
  now: number;
  /** Installing after background tasks finish: how many are still running; null when not waiting. */
  waiting?: number | null;
}

/** The short step after download reaches 100% and before it becomes “downloaded”: verification (macOS unpacks, checks the signature and notarization; architecture design §2.6). */
export function verifying(st: AppUpdateState): boolean {
  return st.k === 'downloading' && st.pct >= 100;
}

/** The status block under Settings › About: a one-line status (with its tone), release notes, progress, buttons and links (design spec `view`). */
export function view(st: AppUpdateState, ctx: ViewContext): StatusView {
  switch (st.k) {
    case 'unsupported':
      return { line: st.why === 'appStore' ? M.appStore : M.devBuild, tone: 'muted', actions: [] };
    case 'checking':
      return { line: null, actions: [btn('check', M.checking, 'secondary', true)] };
    case 'upToDate':
      return { line: M.upToDate, tone: 'positive', actions: [btn('check', M.checkForUpdates)] };
    case 'available':
      return st.systemUnmet
        ? { line: M.available(verOf(st.info)), tone: 'strong', notes: notesFor(st.info, ctx.lang), warn: M.needsMacOS(st.systemUnmet), actions: [] }
        : { line: M.available(verOf(st.info)), tone: 'strong', notes: notesFor(st.info, ctx.lang), actions: [btn('download', M.downloadAndInstall, 'accent')] };
    case 'downloading':
      return {
        line: verifying(st) ? M.verifyingVersion(st.info.version) : M.downloadingVersion(st.info.version, st.pct),
        progress: st.pct,
        actions: [btn('cancel', M.cancel)],
      };
    case 'ready':
      return ctx.waiting != null
        ? {
            line: M.readyWaiting(st.info.version),
            tone: 'strong',
            actions: [btn('restart', M.restartAndUpdate, 'accent')],
            link: { k: 'stopWaiting', label: M.stopWaiting },
            sub: waitingText(ctx.waiting),
          }
        : { line: M.readyOnQuit(st.info.version), tone: 'strong', actions: [btn('restart', M.restartAndUpdate, 'accent')] };
    case 'installing':
      return { line: null, actions: [btn('install', M.installing, 'accent', true)] };
    case 'error':
      return { line: FAILURE_TEXT[st.failure], tone: 'negative', actions: [btn('retry', M.retry)], link: { k: 'downloadPage', label: M.downloadPage } };
    case 'idle':
      return {
        line: null,
        actions: [btn('check', M.checkForUpdates)],
        sub: ctx.lastCheck != null ? M.lastCheck(relTime(ctx.lastCheck, ctx.now)) : null,
      };
  }
}

function waitingText(running: number): string {
  return running > 0 ? M.waitingRunning(running) : M.waitingDone;
}

/** Which step “Retry” redoes in the error state: download, verify and install failures that carry version info are re-downloaded; a check failure with none is re-checked. */
export function retryAction(st: AppUpdateState): 'download' | 'check' {
  return st.k === 'error' && st.info ? 'download' : 'check';
}

// ---- Update button on the rail ----

export type SideButton =
  | { visible: false }
  | { visible: true; glyph: 'download' | 'ring' | 'check'; pct?: number; dot: 'white' | 'positive' | 'negative' | null; tip: string };

const HIDDEN: SideButton = { visible: false };

/**
 * The accent square button above “Settings” on the rail: shown only when there is something to do — a new version is available (OS version is sufficient), downloading, downloaded, or an error that carries version info;
 * it is hidden when the OS version is too old, when the check failed, and in all other states (design spec `sideButton`).
 */
export function sideButton(st: AppUpdateState): SideButton {
  switch (st.k) {
    case 'available':
      return st.systemUnmet ? HIDDEN : { visible: true, glyph: 'download', dot: 'white', tip: M.tipAvailable(st.info.version) };
    case 'downloading':
      return { visible: true, glyph: 'ring', pct: st.pct, dot: null, tip: verifying(st) ? M.tipVerifying : M.tipDownloading(st.pct) };
    case 'ready':
      return { visible: true, glyph: 'check', dot: 'positive', tip: M.tipReady };
    case 'error':
      return st.info ? { visible: true, glyph: 'download', dot: 'negative', tip: M.tipError } : HIDDEN;
    default:
      return HIDDEN;
  }
}

// ---- Update window ----

export interface DialogView {
  title: string;
  sub: string;
  current: string | null;
  /** Downloaded and not waiting on background tasks: one extra sentence, saying it will also be installed on quit. */
  note: string | null;
  notesTitle: string;
  notes: string[];
  footer: {
    left: null | { progress: number; text: string } | { error: string } | { note: string };
    buttons: { k: UpdateAction; label: string; variant: 'accent' | 'secondary' }[];
  };
}

/**
 * Update window (480 wide): every state in which the sidebar button should not show returns null — the view takes null to mean “the window closes automatically” (design spec `dialog`).
 * `current` is the running version; `waiting` is the same as `view`. When downloaded, one extra `note` is added (it will also be installed on quit); it is not written while waiting on background tasks —
 * read next to the footer line “Install automatically once everything finishes”, it would sound like two different claims. For the verification step after the download reaches 100%,
 * the footer's left side shows “Verifying…”.
 */
export function dialog(
  st: AppUpdateState,
  ctx: { lang: string; current: { version: string; build: number } | null; waiting?: number | null },
): DialogView | null {
  if (!sideButton(st).visible) return null;
  if (st.k !== 'available' && st.k !== 'downloading' && st.k !== 'ready' && st.k !== 'error') return null;
  const info = st.info;
  if (!info) return null;
  const b = (k: UpdateAction, label: string, variant: 'accent' | 'secondary' = 'secondary') => ({ k, label, variant });
  const later = b('later', M.later);
  const footer: DialogView['footer'] =
    st.k === 'available'
      ? { left: null, buttons: [later, b('download', M.downloadAndInstall, 'accent')] }
      : st.k === 'downloading'
        ? { left: { progress: st.pct, text: verifying(st) ? M.verifying : M.downloading(st.pct) }, buttons: [b('cancel', M.cancel)] }
        : st.k === 'ready'
          ? ctx.waiting != null
            ? { left: { note: waitingText(ctx.waiting) }, buttons: [b('stopWaiting', M.stopWaiting), b('restart', M.restartAndUpdate, 'accent')] }
            : { left: null, buttons: [later, b('restart', M.restartAndUpdate, 'accent')] }
          : { left: { error: FAILURE_TEXT[st.failure] }, buttons: [b('downloadPage', M.downloadPage), b('retry', M.retry, 'accent')] };
  return {
    title: st.k === 'ready' ? M.titleReady : M.titleAvailable,
    sub: `CucCut ${info.version} · Build ${info.build}`,
    current: ctx.current ? M.current(verOf(ctx.current)) : null,
    note: st.k === 'ready' && ctx.waiting == null ? M.noteOnQuit : null,
    notesTitle: M.notesTitle,
    notes: notesAll(info, ctx.lang),
    footer,
  };
}

// ---- toast ----

/** The automatic check finished downloading in the background (the main process ensures it shows only once per build). */
export function readyToast(info: AppUpdateInfo): { text: string; action: string } {
  return { text: M.readyToast(info.version), action: M.restartAndUpdate };
}

/** With automatic download off, the automatic check found a new version. “View” opens the update window. */
export function availableToast(info: AppUpdateInfo): { text: string; action: string } {
  return { text: M.availableToast(info.version), action: M.view };
}

// ---- Pre-install stop barrier (architecture design §2.6) ----

export interface BarrierTask {
  id: string;
  title: string;
  /** Model · where it runs. */
  where: string;
  /** Runs on a remote node or in the cloud: after it is stopped, it may keep running and keep billing there. */
  remote: boolean;
  /** How it is stopped; an Agent task that is already stopping has none (it is left to finish stopping on its own). */
  action: TaskAction | null;
}

/** Jobs running outside this machine: remote nodes and cloud providers (this machine and the agent providers on it do not count). */
export function runsRemotely(providerId: string): boolean {
  return providerId !== 'local' && !providerId.startsWith('agent:');
}

/** Background tasks still running: Agent tasks (running or stopping) and Jobs (queued, running, or re-running after a crash). */
export function barrierTasks(jobs: readonly JobRecord[], tasks: readonly TaskSummary[], jobLive: (job: JobRecord) => boolean): BarrierTask[] {
  const ctx = { projects: [], conversations: [], video: null };
  const fromTasks = tasks
    .filter((task) => task.status === 'running' || task.status === 'stopping')
    .map(
      (task): BarrierTask => ({
        id: task.taskId,
        title: task.goal,
        where: TASK_VIEW_COPY.local,
        remote: false,
        action: task.status === 'running' ? { type: 'stop', taskId: task.taskId } : null,
      }),
    );
  const fromJobs = jobs.filter(jobLive).map((job): BarrierTask => {
    const row = jobRow(job, ctx);
    return { id: job.jobId, title: row.title, where: row.where, remote: runsRemotely(job.providerId), action: { type: 'cancel', jobId: job.jobId } };
  });
  return [...fromTasks, ...fromJobs];
}

export interface RestartAsk {
  title: string;
  body: string;
  /** Tasks running remotely that may keep running or keep billing after stopping; null when there are none. */
  remoteTitle: string | null;
  remote: { id: string; title: string; where: string }[];
  stopLabel: string;
  waitLabel: string;
  cancelLabel: string;
}

/**
 * When “Restart and update” is clicked, ask first if background tasks are running (the title and body come from design spec `restartAsk`), letting the user choose “Install after tasks finish” or
 * “Stop now and install”, and list the tasks that may still run or bill remotely after stopping. Returns null when no task is running, and the install proceeds directly.
 */
export function restartAsk(tasks: readonly BarrierTask[]): RestartAsk | null {
  const n = tasks.length;
  if (!n) return null;
  const remote = tasks.filter((task) => task.remote).map(({ id, title, where }) => ({ id, title, where }));
  return {
    title: M.restartTitle,
    body: M.restartBody(n),
    remoteTitle: remote.length ? M.remoteTitle : null,
    remote,
    stopLabel: M.stopAndInstall,
    waitLabel: M.waitAndInstall,
    cancelLabel: M.later,
  };
}

// ---- Switches under Settings › General (`updates.autoCheck`, `updates.autoDownload`) ----

export const AUTO_ROW: AppUpdateMessages['autoRow'] = live(() => M.autoRow);

/**
 * Which keys are written when the switch is flipped (same meaning as `app_auto_update` in the App): when on, both are enabled; when off, only automatic download is turned off — checks still run on schedule,
 * and when a new version is found it reminds the user “Ready to update”, without downloading in the background.
 */
export function autoUpdatePatch(on: boolean): { 'updates.autoCheck'?: boolean; 'updates.autoDownload': boolean } {
  return on ? { 'updates.autoCheck': true, 'updates.autoDownload': true } : { 'updates.autoDownload': false };
}
