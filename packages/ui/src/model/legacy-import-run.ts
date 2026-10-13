import {
  defineMessages,
  type Id,
  type LegacyImportItem,
  type LegacyImportProblem,
  type LegacyImportRun,
} from '@cuccut/protocol';
import { TASK_VIEW_COPY } from '../copy.ts';
import { displayDirectory } from './legacy-import.ts';
import { kindLabel, type TaskRow } from './task-list.ts';
import { zhHans } from './legacy-import-run.zh-Hans.ts';
import { zhHant } from './legacy-import-run.zh-Hant.ts';
import { ja } from './legacy-import-run.ja.ts';
import { ko } from './legacy-import-run.ko.ts';
import { es } from './legacy-import-run.es.ts';
import { fr } from './legacy-import-run.fr.ts';
import { de } from './legacy-import-run.de.ts';
import { nl } from './legacy-import-run.nl.ts';
import { ptBR } from './legacy-import-run.pt-BR.ts';
import { it } from './legacy-import-run.it.ts';
import { ru } from './legacy-import-run.ru.ts';
import { pl } from './legacy-import-run.pl.ts';
import { tr } from './legacy-import-run.tr.ts';
import { vi } from './legacy-import-run.vi.ts';

/*
 * Progress and result of a legacy project import (design draft model-legacy-import-run.js; architecture design §2.7). Pure functions: they read the `LegacyImportRun` pushed by the Runtime and compute the row on the task page, the reason and what to do on the card, the groups in details, the item at the top of Home, and the toast shown when the run finishes.
 * Items that were not imported are grouped by reason: one group per disconnected drive, one group for files not at their original location, one group for projects that cannot be read, one group for errors midway through the import.
 * Each group carries one sentence of reason (why) and one sentence of what to do (fix); views do not write their own.
 */

const en = {
  offlineTitle: (name: string) => `Drive “${name}” isn’t connected`,
  offlineWhy: (n: number, root: string) =>
    n === 1
      ? `The videos this project uses are on this drive (${root}), which can’t be read right now.`
      : `The videos these ${n} projects use are on this drive (${root}), which can’t be read right now.`,
  offlineFix:
    'Connect the drive, then click “Retry”. If you leave it, CucCut tries again the next time it starts. If you no longer need the footage, click “Skip” and it won’t be imported.',
  offlineShort: (n: number, name: string) =>
    n === 1 ? `1 project’s footage is on “${name}”, which isn’t connected` : `${n} projects’ footage is on “${name}”, which isn’t connected`,
  missingTitle: 'Media files aren’t where they were',
  missingWhy: 'Files the project uses were moved, renamed or deleted, so the paths saved in the earlier project no longer find them.',
  missingFix: 'Put the files back where they were, then click “Retry”. If you can’t get them back, click “Skip”.',
  missingShort: (n: number) => (n === 1 ? '1 project’s media files can’t be found' : `${n} projects’ media files can’t be found`),
  unreadableTitle: 'The earlier project file can’t be read',
  unreadableWhy: 'The earlier project file may be damaged, so retrying probably won’t help.',
  unreadableFix:
    'Show it in the folder to check that the original is still there and opens in the earlier version. If you don’t need it, click “Skip”.',
  unreadableShort: (n: number) => (n === 1 ? '1 project file can’t be read' : `${n} project files can’t be read`),
  failedTitle: 'Importing stopped partway',
  failedWhy: 'The project was read, but importing it stopped partway. The import report records what happened.',
  failedFix: 'Click “Retry” to try again. If it still fails, show the report in the folder. If you don’t need the project, click “Skip”.',
  failedShort: (n: number) => (n === 1 ? '1 project stopped partway through importing' : `${n} projects stopped partway through importing`),
  missingMany: (n: number, first: string) => `${n} files missing, for example ${first}`,
  missingOne: (file: string) => `Missing ${file}`,
  missingNone: 'Media files can’t be found',
  failedReport: (report: string) => `Import report: ${report}`,
  failedNoReport: 'No import report was written',
  /** The sentence on the card: the short sentences of several groups joined together. */
  note: (parts: string[]) => `${parts.join('; ')}.`,
  hintOffline: (name: string) =>
    `Connect “${name}”, then click “Retry all”. If you leave it, CucCut tries again the next time it starts. To handle them one by one, open the details.`,
  hintOther: 'The reason and what to do for each one are in the details. You can skip the ones you don’t need.',
  subProgress: (done: number, total: number) => `Imported ${done}/${total}`,
  subImported: (n: number) => `Imported ${n}`,
  subPending: (n: number) => `To resolve ${n}`,
  subSkipped: (n: number) => `Skipped ${n}`,
  subDest: (dest: string) => `To ${dest}`,
  attention: (n: number) => `${n} to resolve`,
  phaseImporting: 'Importing',
  phaseWaiting: 'Waiting for other tasks',
  detailImporting: (title: string) => `Importing “${title}”`,
  detailWaiting: 'Other tasks are running, so importing is paused. It continues automatically when they finish.',
  bannerRunning: (done: number, total: number) => `Importing earlier projects · ${done}/${total}`,
  bannerResult: (imported: number, pending: number) => `Earlier projects import finished: ${imported} imported, ${pending} not imported`,
  doneAll: (n: number) => (n === 1 ? '1 earlier project imported' : `${n} earlier projects imported`),
  doneSome: (imported: number, pending: number) => `Import finished: ${imported} imported, ${pending} not imported`,
  retriedAll: (n: number) => (n === 1 ? 'The retried project was imported' : `All ${n} retried projects were imported`),
  retriedSome: (n: number, ok: number) => `Of the ${n} retried, ${ok} imported and ${n - ok} still not imported`,
  retriedNone: (n: number) => (n === 1 ? 'The retried project still wasn’t imported' : `The ${n} retried projects still weren’t imported`),
  retrying: (n: number) => (n === 1 ? 'Importing 1 project again' : `Importing ${n} projects again`),
  skipped: (n: number) =>
    n === 1 ? 'Skipped 1 project. It won’t be imported automatically.' : `Skipped ${n} projects. They won’t be imported automatically.`,
  actionFailed: (message: string) => `Couldn’t do that: ${message}`,
  undo: 'Undo',
  viewReasons: 'See why',
  viewInSpace: 'View in Library',
  viewProgress: 'View progress',
  close: 'Close',
  retryAll: 'Retry all',
  skipAll: 'Skip all',
  retry: 'Retry',
  skip: 'Skip',
  reveal: 'Show in folder',
  importInstead: 'Import',
  statImported: 'Imported',
  statPending: 'Not imported',
  statSkipped: 'Skipped',
  statLive: 'Not imported yet',
  pendingSection: 'Projects not imported',
  pendingHint: 'If you leave them, CucCut tries again the next time it starts. Skipped ones aren’t imported.',
  howTo: 'What to do: ',
  groupTitle: (title: string, n: number) => `${title} · ${n}`,
  liveSection: 'Importing',
  importingChip: 'Importing',
  queuedChip: 'Queued',
  importedSection: 'Imported',
  skippedSection: 'Skipped',
  skippedHint: 'They won’t be imported automatically. The original files stay where they are.',
  expand: (n: number) => `Show ${n} more`,
  collapse: 'Show less',
};

export type LegacyImportRunMessages = typeof en;

export const LR = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** The ID of this import on the task page: one per start, following the `runId` given by the Runtime. */
export const LEGACY_TASK_PREFIX = 'legacy-import:';
export const legacyTaskId = (runId: string): Id => `${LEGACY_TASK_PREFIX}${runId}`;

export interface RunCounts {
  imported: number;
  /** Not imported, waiting for the user to handle (excluding skipped). */
  pending: number;
  skipped: number;
  queued: number;
  importing: number;
  /** Not yet reached, or being imported right now. */
  live: number;
  /** Items in this run to import: already imported, not imported, and still running (skipped ones are not counted). */
  total: number;
}

export function runCounts(run: Pick<LegacyImportRun, 'items'> | null): RunCounts {
  const items = run?.items ?? [];
  const n = (state: LegacyImportItem['state']) => items.filter((it) => it.state === state).length;
  const c = { imported: n('imported'), pending: n('not-imported'), skipped: n('skipped'), queued: n('queued'), importing: n('importing') };
  const live = c.queued + c.importing;
  return { ...c, live, total: c.imported + c.pending + live };
}

/** Still importing (including waiting for other tasks). */
export const runLive = (run: Pick<LegacyImportRun, 'state'> | null): boolean => !!run && run.state !== 'finished';

export const currentItem = (run: LegacyImportRun | null): LegacyImportItem | null =>
  run?.items.find((it) => it.state === 'importing') ?? null;

/** 0–100, rounded down: an unfinished import never reads 100%. */
export function runPercent(run: LegacyImportRun): number {
  const c = runCounts(run);
  if (!c.total) return runLive(run) ? 0 : 100;
  return Math.floor(((c.total - c.live) / c.total) * 100);
}

export type ProblemKind = LegacyImportProblem['kind'];

export interface ProblemGroup {
  key: string;
  kind: ProblemKind;
  /** Disconnected drives (present only when `offline`). */
  volume: { root: string; name: string } | null;
  items: LegacyImportItem[];
  title: string;
  why: string;
  fix: string;
  /** One segment of the sentence on the card. */
  short: string;
}

const RANK: Record<ProblemKind, number> = { offline: 0, missing: 1, unreadable: 2, failed: 3 };

function groupText(kind: ProblemKind, n: number, volume: ProblemGroup['volume']): Pick<ProblemGroup, 'title' | 'why' | 'fix' | 'short'> {
  if (kind === 'offline' && volume) {
    return {
      title: LR.offlineTitle(volume.name),
      why: LR.offlineWhy(n, volume.root),
      fix: LR.offlineFix,
      short: LR.offlineShort(n, volume.name),
    };
  }
  if (kind === 'missing' || kind === 'offline') {
    return { title: LR.missingTitle, why: LR.missingWhy, fix: LR.missingFix, short: LR.missingShort(n) };
  }
  if (kind === 'unreadable') {
    return { title: LR.unreadableTitle, why: LR.unreadableWhy, fix: LR.unreadableFix, short: LR.unreadableShort(n) };
  }
  return { title: LR.failedTitle, why: LR.failedWhy, fix: LR.failedFix, short: LR.failedShort(n) };
}

/** Items not imported, grouped by reason: one group per disconnected drive, and the rest one group per reason; the order is drives, files not in place, cannot be read, error midway. */
export function problemGroups(run: LegacyImportRun | null): ProblemGroup[] {
  const out: Omit<ProblemGroup, 'title' | 'why' | 'fix' | 'short'>[] = [];
  for (const item of run?.items ?? []) {
    if (item.state !== 'not-imported' || !item.problem) continue;
    const p = item.problem;
    const key = p.kind === 'offline' ? `offline:${p.volume.root}` : p.kind;
    let group = out.find((g) => g.key === key);
    if (!group) {
      group = { key, kind: p.kind, volume: p.kind === 'offline' ? p.volume : null, items: [] };
      out.push(group);
    }
    group.items.push(item);
  }
  return out
    .sort((a, b) => RANK[a.kind] - RANK[b.kind])
    .map((g) => ({ ...g, ...groupText(g.kind, g.items.length, g.volume) }));
}

/** The sentence under a not-imported project row: how many files are missing and the first missing path; for a project that cannot be read, where the old project is; for an error midway, where the import record is. */
export function itemNote(item: LegacyImportItem): string {
  const p = item.problem;
  if (!p || p.kind === 'unreadable') return item.path;
  if (p.kind === 'failed') return p.report ? LR.failedReport(p.report) : LR.failedNoReport;
  const first = p.missing[0];
  if (!first) return LR.missingNone;
  return p.missingCount > 1 ? LR.missingMany(p.missingCount, first) : LR.missingOne(first);
}

/** Which one “Show in folder” shows: for an error midway, the import record; for a project that cannot be read, the old project; none for missing media (the thing to fix there is the media). */
export function revealTarget(item: LegacyImportItem): string | null {
  const p = item.problem;
  if (p?.kind === 'failed') return p.report ?? item.path;
  if (p?.kind === 'unreadable') return item.path;
  return null;
}

/** A reason sentence on the task page card, e.g. `2 个项目的素材在没接上的“Extreme SSD”上，1 个项目的文件读不出来。` (the media of 2 projects is on the disconnected “Extreme SSD”, and the files of 1 project cannot be read). */
export function cardNote(run: LegacyImportRun | null): string {
  const groups = problemGroups(run);
  return groups.length ? LR.note(groups.map((g) => g.short)) : '';
}

/** The what-to-do sentence right after the reason on the card: if a drive is disconnected, say to connect it first; the rest are checked one by one in details. */
export function cardHint(run: LegacyImportRun | null): string {
  const groups = problemGroups(run);
  if (!groups.length) return '';
  const drive = groups.find((g) => g.volume);
  return drive?.volume ? LR.hintOffline(drive.volume.name) : LR.hintOther;
}

/** Card subline: while running, “imported d/t · importing to …”; when done, “imported d · pending p · skipped s · importing to …”. */
export function runSub(run: LegacyImportRun, platform: string): string {
  const c = runCounts(run);
  const dest = LR.subDest(displayDirectory(run.directory, platform));
  if (runLive(run)) return [LR.subProgress(c.imported, c.total), dest].join(' · ');
  return [
    LR.subImported(c.imported),
    c.pending ? LR.subPending(c.pending) : null,
    c.skipped ? LR.subSkipped(c.skipped) : null,
    dest,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The stage while running and its detail sentence: waiting for other tasks, or which one is being imported. */
export function runPhase(run: LegacyImportRun): { phase: string; detail: string | null } {
  if (run.state === 'waiting') return { phase: LR.phaseWaiting, detail: LR.detailWaiting };
  const now = currentItem(run);
  return { phase: LR.phaseImporting, detail: now ? LR.detailImporting(now.title) : null };
}

/**
 * The row shared by the task page and the sidebar. While running it belongs to “in progress”; when done it goes to history, and if items were left not imported it reads “N pending” in the warning color.
 * It cannot be cancelled (the Runtime's import cannot be stopped midway), and it does not go into the task capsule in the video top bar (it does not belong to any video).
 */
export function legacyTaskRow(run: LegacyImportRun, platform: string): TaskRow {
  const c = runCounts(run);
  const live = runLive(run);
  const pct = runPercent(run);
  const phase = live ? runPhase(run).phase : null;
  const label = live ? `${phase} · ${pct}%` : c.pending ? LR.attention(c.pending) : TASK_VIEW_COPY.completed;
  return {
    id: legacyTaskId(run.runId),
    origin: 'legacy-import',
    kind: 'legacyImport',
    kindText: kindLabel('legacyImport'),
    title: kindLabel('legacyImport'),
    where: runSub(run, platform),
    startedAt: run.startedAt,
    endedAt: run.finishedAt,
    live,
    queued: false,
    waiting: false,
    label,
    tone: live ? 'accent' : c.pending ? 'notice' : 'positive',
    phase,
    pct: live ? pct : null,
    progress: live ? pct : null,
    chip: null,
    action: null,
    conversationId: null,
    projectId: null,
    videoId: null,
    error: null,
  };
}

export interface RunBanner {
  state: 'running' | 'result';
  title: string;
  detail: string;
  pct: number | null;
  /** Which result was dismissed: a new result will show again when there is one. */
  key: string;
}

/**
 * The item at the top of Home (import is global, not part of any one video): while running, it reports progress and which one is being imported; when done with items left not imported, it reports the result and the reason;
 * when everything was imported, nothing is shown (the toast already said so).
 */
export function runBanner(run: LegacyImportRun | null, platform: string): RunBanner | null {
  if (!run) return null;
  const c = runCounts(run);
  if (runLive(run)) {
    const { detail } = runPhase(run);
    const dest = LR.subDest(displayDirectory(run.directory, platform));
    return {
      state: 'running',
      title: LR.bannerRunning(c.total - c.live, c.total),
      detail: run.state === 'waiting' ? LR.detailWaiting : [detail, dest].filter(Boolean).join(' · '),
      pct: runPercent(run),
      key: `${run.runId}:live`,
    };
  }
  if (!c.pending) return null;
  return {
    state: 'result',
    title: LR.bannerResult(c.imported, c.pending),
    detail: cardNote(run),
    pct: null,
    key: `${run.runId}:${run.finishedAt ?? ''}`,
  };
}

export interface FinishToast {
  text: string;
  tone: 'positive' | 'neutral';
  /** `result` goes to task details for the reasons; `open` goes to Space to see the imported projects. */
  action: 'result' | 'open';
}

/**
 * The toast shown when one import (or one retry) finishes. `batch` is the projects this round imported (the UI shows them queuing and importing);
 * if it covered the whole import (excluding skipped), report the whole; otherwise it was a retry, and only the retried ones are reported.
 */
export function finishToast(run: LegacyImportRun, batch: ReadonlySet<string> | null): FinishToast {
  const scope = run.items.filter((it) => it.state !== 'skipped');
  const retried = batch && scope.some((it) => !batch.has(it.path)) ? run.items.filter((it) => batch.has(it.path)) : null;
  if (retried?.length) {
    const n = retried.length;
    const ok = retried.filter((it) => it.state === 'imported').length;
    if (ok === n) return { text: LR.retriedAll(n), tone: 'positive', action: 'open' };
    return { text: ok ? LR.retriedSome(n, ok) : LR.retriedNone(n), tone: 'neutral', action: 'result' };
  }
  const c = runCounts(run);
  if (!c.pending) return { text: LR.doneAll(c.imported), tone: 'positive', action: 'open' };
  return { text: LR.doneSome(c.imported, c.pending), tone: 'neutral', action: 'result' };
}

/** The projects clicked that are not yet imported (`paths` defaults to all not-imported ones): retry and skip count by it. */
export function pendingPaths(run: LegacyImportRun | null, paths?: readonly string[]): string[] {
  return (run?.items ?? [])
    .filter((it) => it.state === 'not-imported' && (!paths || paths.includes(it.path)))
    .map((it) => it.path);
}
