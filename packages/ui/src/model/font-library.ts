import type {
  DownloadedFontFace,
  FontCategory,
  FontFamilyState,
  FontFamilyStatus,
  FontLicence,
  FontScript,
  FontUsageFamily,
  JobRecord,
  JobWarning,
} from '@cuccut/protocol';
import { defineMessages, intlLocale, live, localizeText, onLocaleChange } from '@cuccut/protocol';
import { jobLive } from './task-list.ts';
import { zhHans } from './font-library.zh-Hans.ts';
import { zhHant } from './font-library.zh-Hant.ts';
import { ja } from './font-library.ja.ts';
import { ko } from './font-library.ko.ts';
import { es } from './font-library.es.ts';
import { fr } from './font-library.fr.ts';
import { de } from './font-library.de.ts';
import { nl } from './font-library.nl.ts';
import { ptBR } from './font-library.pt-BR.ts';
import { it } from './font-library.it.ts';
import { ru } from './font-library.ru.ts';
import { pl } from './font-library.pl.ts';
import { tr } from './font-library.tr.ts';
import { vi } from './font-library.vi.ts';

const fontsN = (n: number) => (n === 1 ? '1 font' : `${n} fonts`);
const familiesN = (n: number) => (n === 1 ? '1 family' : `${n} families`);

/** Copy for the font library (the English is the source of keys and types; translations are in `font-library.zh-Hans.ts`). Family names, license names and Google Fonts are not translated. */
const en = {
  state: {
    'built-in': 'Built-in',
    installed: 'Installed',
    downloaded: 'Downloaded',
    downloadable: 'Available to download',
    downloading: 'Downloading',
    failed: 'Failed',
    unavailable: 'Font not found',
  } as Record<FontFamilyState, string>,
  source: {
    'built-in': 'Ships with the app',
    local: 'Installed on this computer',
    'google-fonts': 'Google Fonts',
  } as Record<FontFamilyStatus['source'], string>,
  categories: {
    'sans-serif': 'Sans serif',
    serif: 'Serif',
    display: 'Display',
    handwriting: 'Handwriting',
    monospace: 'Monospace',
  } as Record<FontCategory, string>,
  scripts: {
    chinese: 'Chinese',
    japanese: 'Japanese',
    korean: 'Korean',
    latin: 'Latin',
    cyrillic: 'Cyrillic',
    greek: 'Greek',
    vietnamese: 'Vietnamese',
    arabic: 'Arabic',
    hebrew: 'Hebrew',
    thai: 'Thai',
    devanagari: 'Devanagari',
  } as Record<Exclude<FontScript, 'other'>, string>,
  privacyNote: 'Downloaded from Google Fonts; only the family name and weights are sent. Stored in app data, not in the video folder.',
  offlineNote: 'You’re offline · Downloadable fonts need a network connection to download',
  strictOfflineNote: 'Strict offline mode is on · Fonts aren’t downloaded; downloadable fonts are shown in a fallback font',
  waiting: 'Waiting',
  sections: { search: 'Search results', video: 'Used in this video', recent: 'Recently used', all: 'All fonts' } as Record<
    'search' | 'video' | 'recent' | 'all',
    string
  >,
  cancelled: 'Cancelled',
  downloadFailed: 'Download failed',
  pickToast: (family: string, fallback: string) => `“${family}” is shown in “${fallback}” until it’s downloaded, then switches automatically`,
  alreadyDownloaded: (family: string) => `“${family}” is already downloaded`,
  detail: { status: 'Status', source: 'Source', category: 'Category', weights: 'Weights', size: 'Size', licence: 'License' },
  scriptJoin: (labels: readonly string[]) => labels.join(', '),
  withItalics: ' (with italics)',
  downloadedSize: (size: string) => `${size} downloaded`,
  unknownLicence: 'Unknown (a font on this computer; check for yourself whether it can be used for publishing)',
  mirrorInvalid: 'Not a valid address',
  mirrorHttps: 'Only addresses starting with https:// are accepted',
  mirrorCredentials: 'The address can’t include a username or password',
  mirrorQuery: 'The address can’t include query parameters or #',
  italic: ' italic',
  cleared: (removed: number, freed: string, kept: number) =>
    `Cleared ${familiesN(removed)} and freed ${freed}${kept ? ` · ${kept} in use by exports ${kept === 1 ? 'was' : 'were'} kept` : ''}`,
  clearConfirm: (count: number, size: string, inUse: boolean) =>
    `Delete ${familiesN(count)}, ${size} in total. Videos that use them show a fallback font until they’re downloaded again when needed.` +
    (inUse ? ' Fonts in use by unfinished exports will be kept.' : ''),
  barOff: (total: number) => `This video uses ${fontsN(total)} that ${total === 1 ? 'isn’t' : 'aren’t'} downloaded; showing a fallback font`,
  autoOff: 'Auto-download is off',
  barRunning: 'Downloading fonts used in this video',
  barReady: (total: number) => (total === 1 ? 'The font used in this video is ready' : `All ${total} fonts used in this video are ready`),
  barMissed: (n: number) => `${fontsN(n)} couldn’t be fetched; showing a fallback font`,
  skipped: 'Skipped',
  notDownloaded: 'Not downloaded',
  /** A list of family names (in the export sentences). */
  quoteList: (names: readonly string[]) => new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(names.map((n) => `“${n}”`)),
  exportPending: (names: string, n: number) =>
    `${names} ${n === 1 ? 'is' : 'are'} still downloading · Export waits for ${n === 1 ? 'it' : 'them'} before rendering`,
  exportFailed: (names: string, fallbacks: string) => `${names} didn’t download · ${fallbacks} will be used instead in the export`,
  exportMissingAuto: (names: string, n: number) =>
    `${names} ${n === 1 ? 'isn’t' : 'aren’t'} downloaded yet · ${n === 1 ? 'It’s' : 'They’re'} downloaded when export starts; if that fails, a fallback font is used`,
  exportMissingOff: (names: string, n: number) =>
    `${names} ${n === 1 ? 'isn’t' : 'aren’t'} downloaded (auto-download is off) · The export will use a fallback font`,
  actionRetry: 'Try again',
  actionDownloadNow: 'Download now',
  actionDownload: 'Download',
  exportFallback: (family: string, fallback: string, reason: string) => `“${family}” replaced with “${fallback}” · ${reason}`,
  exportFallbackSeparator: '; ',
  exportPhase: (detail: string | null) => (detail ? `Downloading fonts · ${detail}` : 'Downloading fonts'),
  systemFont: 'System font',
  errorFallback: 'The operation didn’t complete',
  removed: (family: string) => `Deleted the downloaded files for “${family}”`,
  removeInUse: (family: string) => `An unfinished export is using “${family}” · Delete it after the export finishes`,
};
export type FontLibraryMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * How downloadable fonts are presented in the UI (product design §5.9 “字体” (Fonts), §7.6; architecture design §9.1; prototype model-font-library.js).
 *
 * The font picker, the font bar at the top of the editor, the export panel and Settings › Fonts all read the same state: one `FontFamilyStatus` per family (`fonts.catalogue`),
 * with the byte progress of the running `fontDownload` task in the `jobs` topic overlaid (`modelId` is the family name). This file only does the computing: merging tables, sorting, filtering,
 * sectioning, what goes at the end of each row, how progress is read out, whether the mirror address is valid, and what is said when opening a video and when exporting. State transitions happen in state/font-library-store.ts.
 *
 * Differences from the prototype (real data decides):
 * - The font catalogue carries no file sizes: the download button hint does not say “约 X” (about X), and sizes appear in the details only after download. Whether “取消下载” (Cancel download) is offered on selection is decided by the text (CJK fonts are several MB per weight, Latin fonts are one or two hundred KB).
 * - The fallback font is the render kernel's fallback family (`fonts.usage`'s `fallback`, the Source Han Sans bundled with the kernel), not illustrated by category.
 * - Samples draw only the family name (`fonts.sample` carries only the characters in the family name), and do not fill in characters like “永和九年” from the body text.
 */

export const FONT_STATE_LABEL: Record<FontFamilyState, string> = live(() => M.state);

export const FONT_SOURCE_LABEL: Record<FontFamilyStatus['source'], string> = live(() => M.source);

export const FONT_LICENCE_LABEL: Record<FontLicence, string> = {
  'OFL-1.1': 'SIL Open Font License 1.1',
  'Apache-2.0': 'Apache License 2.0',
  'UFL-1.0': 'Ubuntu Font Licence 1.0',
};

export const FONT_CATEGORIES: readonly { key: FontCategory; label: string }[] = (['sans-serif', 'serif', 'display', 'handwriting', 'monospace'] as const).map(
  (key) => ({
    key,
    get label() {
      return M.categories[key];
    },
  }),
);

export const FONT_SCRIPTS: readonly { key: FontScript; label: string }[] = (
  ['chinese', 'japanese', 'korean', 'latin', 'cyrillic', 'greek', 'vietnamese', 'arabic', 'hebrew', 'thai', 'devanagari'] as const
).map((key) => ({
  key,
  get label() {
    return M.scripts[key];
  },
}));

/**
 * Fallback family of the render kernel: `fonts.usage` reports the authoritative one (given by the Render Worker); before the inventory has run (a family just picked in the font picker), the same value is used.
 */
export const KERNEL_FALLBACK = 'Noto Sans SC';

/** “系统字体” (System font): the value used when text has no font set (the render kernel uses its default font); not in the font catalogue. */
export const SYSTEM_FONT = 'system';

/** Privacy note (details page, original prototype text). */
export let FONT_PRIVACY_NOTE: string = M.privacyNote;
export let FONT_OFFLINE_NOTE: string = M.offlineNote;
/** When strict offline mode is on (the prototype has no such mode: the real app's Runtime does not download fonts or fetch samples then). */
export let FONT_STRICT_OFFLINE_NOTE: string = M.strictOfflineNote;
onLocaleChange(() => {
  FONT_PRIVACY_NOTE = M.privacyNote;
  FONT_OFFLINE_NOTE = M.offlineNote;
  FONT_STRICT_OFFLINE_NOTE = M.strictOfflineNote;
});

export interface FontProgress {
  done: number;
  total: number | null;
}

/** One row: the Runtime's status, with the progress of the running download task overlaid. */
export interface FontRow extends FontFamilyStatus {
  progress: FontProgress | null;
  /** A download task queued behind the concurrent-download limit and not yet started (the task record's `wait.reason === 'concurrency'`). */
  waiting: boolean;
}

/** What a downloading row reads right now: rows queued behind the limit read “等待中” (Waiting); started rows read the progress, and when no bytes have arrived yet and the total size is unknown they read “下载中” (Downloading). */
export function downloadingLabel(f: Pick<FontRow, 'progress' | 'waiting'>): string {
  if (f.waiting) return M.waiting;
  return progressText(f.progress) || FONT_STATE_LABEL.downloading;
}

export function fmtBytes(n: number): string {
  const b = Math.max(0, Number(n) || 0);
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

/** How progress is read out: a percentage when the total is known, otherwise only the number of bytes received. */
export function progressText(p: FontProgress | null): string {
  if (!p) return '';
  if (p.total) return `${Math.min(100, Math.floor((p.done / p.total) * 100))}%`;
  // No bytes received and total size unknown: do not read “0 B” (the row end and the font bar read “下载中” (Downloading), see downloadingLabel).
  return p.done > 0 ? fmtBytes(p.done) : '';
}

export function progressValue(p: FontProgress | null): number | null {
  return p && p.total ? Math.min(100, (p.done / p.total) * 100) : null;
}

/** Comparison key for family names. */
export const familyKey = (family: string) => family.trim().toLowerCase();

/** Running `fontDownload` tasks, keyed by family (`modelId`). */
export function liveFontJobs(jobs: readonly JobRecord[]): Map<string, JobRecord> {
  const out = new Map<string, JobRecord>();
  for (const job of jobs) if (job.kind === 'fontDownload' && jobLive(job)) out.set(familyKey(job.modelId), job);
  return out;
}

/**
 * Overlays the running tasks: a running task means downloading (progress uses the task's byte progress, which is newer than the list snapshot); when the Runtime says it is downloading (a download inside an export task,
 * not a `fontDownload` task), the byte count from the state is used.
 *
 * “等待中” (Waiting) is only given to tasks truly queued behind the concurrent-download limit (the Runtime downloads two at a time, and queued task records carry `wait`). A task just submitted that starts right away
 * first emits a `queued` without `wait`, then `running`: that moment reads as downloading and does not flash “等待中”.
 */
export function liveRow(status: FontFamilyStatus, job: JobRecord | undefined): FontRow {
  if (job && job.state !== 'queued' && job.progress?.unit === 'bytes') {
    return {
      ...status,
      state: 'downloading',
      error: null,
      progress: { done: job.progress.done, total: job.progress.total },
      waiting: false,
    };
  }
  if (job) {
    const waiting = job.state === 'queued' && job.wait?.reason === 'concurrency';
    return { ...status, state: 'downloading', error: null, progress: waiting ? null : { done: 0, total: null }, waiting };
  }
  if (status.state === 'downloading') {
    return { ...status, progress: { done: status.job?.doneBytes ?? 0, total: status.job?.totalBytes ?? null }, waiting: false };
  }
  return { ...status, progress: null, waiting: false };
}

/** Whether it can be downloaded (download starts on selection; the row end offers download or retry). */
export const canDownload = (f: Pick<FontFamilyStatus, 'state'>) => f.state === 'downloadable' || f.state === 'failed';

/** Whether a family can be rendered (available from the kernel, on this machine, or in the download cache). */
export const isReady = (f: Pick<FontFamilyStatus, 'state' | 'downloaded'>) =>
  f.state === 'built-in' || f.state === 'installed' || f.state === 'downloaded' || f.downloaded.length > 0;

/** The order arranged in the font picker, recorded as family name → index: an open picker sorts by it, so a completed download does not move rows (families outside the table go at the end). */
export function orderKey(rows: readonly Pick<FontFamilyStatus, 'family'>[]): Map<string, number> {
  return new Map(rows.map((f, i) => [familyKey(f.family), i]));
}

function sortRows<T extends Pick<FontFamilyStatus, 'family'>>(rows: readonly T[], frozen?: ReadonlyMap<string, number>): T[] {
  if (!frozen) return [...rows];
  const at = (f: T) => frozen.get(familyKey(f.family)) ?? Infinity;
  return [...rows].sort((a, b) => at(a) - at(b) || a.family.localeCompare(b.family, 'en'));
}

export interface FontQuery {
  query?: string;
  category?: FontCategory | null;
  script?: FontScript | null;
}

/** Filters by family name (substring match, case-insensitive), category and sample text. */
export function filterRows<T extends FontFamilyStatus>(rows: readonly T[], q: FontQuery): T[] {
  const query = (q.query ?? '').trim().toLowerCase();
  return rows.filter(
    (f) => (!query || f.family.toLowerCase().includes(query)) && (!q.category || f.category === q.category) && (!q.script || f.scripts.includes(q.script)),
  );
}

export interface FontSection<T> {
  key: 'search' | 'video' | 'recent' | 'all';
  title: string;
  rows: T[];
}

/**
 * Sections of the font picker: “这个视频里用到” (Used in this video), “最近用过” (Recently used), then all fonts (different ways of taking the same table, not de-duplicated). When there is a search term or filter, these merge into one
 * “搜索结果” (Search results) section. The prototype's “品牌字体” (Brand fonts) section is absent: brand library fonts cannot yet be picked in the font picker (library-brand.ts).
 */
export function fontSections<T extends FontFamilyStatus>(
  rows: readonly T[],
  opts: FontQuery & { inVideo?: readonly string[]; recent?: readonly string[]; frozen?: ReadonlyMap<string, number> },
): FontSection<T>[] {
  if ((opts.query ?? '').trim() || opts.category || opts.script) {
    return [{ key: 'search', title: M.sections.search, rows: sortRows(filterRows(rows, opts), opts.frozen) }];
  }
  const byName = new Map(rows.map((f) => [familyKey(f.family), f]));
  const pick = (names: readonly string[] | undefined) => [...new Set((names ?? []).map(familyKey))].map((n) => byName.get(n)).filter((f): f is T => !!f);
  const out: FontSection<T>[] = [];
  const used = pick(opts.inVideo);
  if (used.length) out.push({ key: 'video', title: M.sections.video, rows: used });
  const recent = pick(opts.recent).slice(0, 5);
  if (recent.length) out.push({ key: 'recent', title: M.sections.recent, rows: recent });
  out.push({ key: 'all', title: M.sections.all, rows: sortRows(rows, opts.frozen) });
  return out;
}

/** The N in the list header “全部字体 · 可下载 N 个” (All fonts · N downloadable): families in the font catalogue (catalogue fonts bundled with the kernel or already installed on this machine also count). */
export const catalogueCount = (rows: readonly FontFamilyStatus[]) => rows.filter((f) => f.category !== null).length;

export type RowEnd =
  | { kind: 'badge'; label: string; tone?: 'positive' }
  | { kind: 'download' }
  | { kind: 'progress'; label: string; value: number | null }
  | { kind: 'retry'; label: string; message: string }
  | { kind: 'none' };

/** What goes at the end of each row. */
export function rowEnd(f: FontRow): RowEnd {
  switch (f.state) {
    case 'built-in':
    case 'installed':
      return { kind: 'badge', label: FONT_STATE_LABEL[f.state] };
    case 'downloaded':
      return { kind: 'badge', label: M.state.downloaded, tone: 'positive' };
    case 'downloading':
      return { kind: 'progress', label: downloadingLabel(f), value: progressValue(f.progress) };
    case 'failed': {
      const cancelled = f.error?.code === 'CANCELLED';
      return { kind: 'retry', label: cancelled ? M.cancelled : M.state.failed, message: cancelled ? M.cancelled : (localizeText(f.error?.message, f.error?.messageRef) ?? M.downloadFailed) };
    }
    case 'downloadable':
      return { kind: 'download' };
    case 'unavailable':
      return { kind: 'badge', label: FONT_STATE_LABEL.unavailable };
    default:
      return { kind: 'none' };
  }
}

/** CJK fonts: a single weight is several MB, so the download takes a while. */
export const isLargeFont = (f: Pick<FontFamilyStatus, 'scripts'>) => f.scripts.some((s) => s === 'chinese' || s === 'japanese' || s === 'korean');

/**
 * Hint shown when selecting a family that has not been downloaded yet: it takes effect immediately, showing the fallback font first, then switches automatically once the download finishes. Large (CJK) families get “取消下载” (Cancel download),
 * small ones arrive within a second or two, and the hint disappears by itself.
 */
export function pickToast(f: Pick<FontFamilyStatus, 'family' | 'scripts'>, fallback = KERNEL_FALLBACK): { text: string; cancellable: boolean } {
  return { text: M.pickToast(f.family, fallback), cancellable: isLargeFont(f) };
}

export const alreadyDownloadedText = (family: string) => M.alreadyDownloaded(family);

/** Lines on the details page. */
export function detailRows(f: FontRow): [string, string][] {
  const end = rowEnd(f);
  const category = FONT_CATEGORIES.find((c) => c.key === f.category)?.label;
  const scripts = M.scriptJoin(f.scripts.map((k) => FONT_SCRIPTS.find((s) => s.key === k)?.label).filter((s): s is string => !!s));
  const size = f.downloaded.reduce((s, d) => s + d.sizeBytes, 0);
  const state =
    FONT_STATE_LABEL[f.state] +
    (end.kind === 'progress' && end.label !== FONT_STATE_LABEL.downloading ? ` · ${end.label}` : '') +
    (end.kind === 'retry' && end.message !== M.cancelled ? ` · ${end.message}` : end.kind === 'retry' ? ` · ${M.cancelled}` : '');
  const rows: ([string, string] | null)[] = [
    [M.detail.status, state],
    [M.detail.source, FONT_SOURCE_LABEL[f.source]],
    category || scripts ? [M.detail.category, [category, scripts].filter(Boolean).join(' · ')] : null,
    f.weights.length ? [M.detail.weights, f.weights.join(' · ') + (f.italics.length ? M.withItalics : '')] : null,
    f.source === 'google-fonts' && f.downloaded.length ? [M.detail.size, M.downloadedSize(fmtBytes(size))] : null,
    [M.detail.licence, f.licence ? FONT_LICENCE_LABEL[f.licence] : M.unknownLicence],
  ];
  return rows.filter((r): r is [string, string] => r !== null);
}

/** Mirror address: empty = use the default; otherwise it must be https, with no account, query parameters or fragment. Returns an error message or null. */
export function mirrorError(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return M.mirrorInvalid;
  }
  if (u.protocol !== 'https:') return M.mirrorHttps;
  if (u.username || u.password) return M.mirrorCredentials;
  if (u.search || u.hash || v.includes('?') || v.includes('#')) return M.mirrorQuery;
  return null;
}

export interface DownloadedRow {
  family: string;
  weights: string;
  sizeBytes: number;
  licence: string;
  /** Time of the most recent download (ISO). */
  at: string;
  inUse: boolean;
}

/** The downloaded list in Settings: one row per family (weights, size, license, download time, whether an export is using it), plus the total size. */
export function downloadedList(faces: readonly DownloadedFontFace[], inUse: readonly string[]): { rows: DownloadedRow[]; totalBytes: number } {
  const busy = new Set(inUse.map(familyKey));
  const groups = new Map<string, DownloadedFontFace[]>();
  for (const face of faces) {
    const key = familyKey(face.family);
    groups.set(key, [...(groups.get(key) ?? []), face]);
  }
  const rows = [...groups.values()]
    .map((list) => {
      const first = list[0]!;
      const weights = [...list].sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
      return {
        family: first.family,
        weights: weights.map((f) => `${f.weight}${f.italic ? M.italic : ''}`).join(' · '),
        sizeBytes: list.reduce((s, f) => s + f.sizeBytes, 0),
        licence: first.licence,
        at: list
          .map((f) => f.downloadedAt)
          .sort()
          .at(-1)!,
        inUse: busy.has(familyKey(first.family)),
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family, 'en'));
  return { rows, totalBytes: rows.reduce((s, r) => s + r.sizeBytes, 0) };
}

/** "Cleared 3 font families, freed 12.4 MB · the 1 in use for export is kept". */
export function clearedText(removed: readonly { family: string }[], freedBytes: number, kept: readonly { family: string }[]): string {
  const families = (list: readonly { family: string }[]) => new Set(list.map((f) => familyKey(f.family))).size;
  const k = families(kept);
  return M.cleared(families(removed), fmtBytes(freedBytes), k);
}

export function clearConfirmBody(rows: readonly DownloadedRow[], totalBytes: number): string {
  return M.clearConfirm(
    rows.length,
    fmtBytes(totalBytes),
    rows.some((r) => r.inUse),
  );
}

// ---- Font bar when opening a video ----

/** The batch for opening a video: families used in it that need downloading (not yet renderable per `fonts.usage`, but present in the font catalogue). */
export interface FontBatch {
  videoId: string;
  families: string[];
  /** Auto-download is on (the Runtime starts this batch) or off (waits for the user to click “下载” (Download)). */
  mode: 'auto' | 'off';
  /** Families the user skipped with “跳过这个” (Skip this) (cancellation is recorded as `CANCELLED`, and the bar reads “已跳过” (Skipped)). */
  skipped: string[];
  dismissed: boolean;
}

/** Which families are in this batch when a video is opened: those in the font catalogue that cannot be rendered right now (families not in the catalogue cannot be downloaded; the kernel renders them with the fallback font and shows a notice). */
export function batchFamilies(usage: readonly FontUsageFamily[]): string[] {
  return usage.filter((f) => f.fallback !== null && f.status.source === 'google-fonts' && f.status.state !== 'unavailable').map((f) => f.family);
}

export type FontBar =
  | { kind: 'running'; title: string; count: string; current: string; progress: string; value: number | null }
  | { kind: 'ready'; title: string }
  | { kind: 'missed'; title: string; rows: FontBarRow[] }
  | { kind: 'off'; title: string; rows: FontBarRow[] };

export interface FontBarRow {
  family: string;
  fallback: string;
  reason: string;
}

type Outcome = 'ok' | 'pending' | 'failed' | 'cancelled' | 'skipped' | 'idle';

function outcomeOf(f: FontRow | undefined, batch: FontBatch): Outcome {
  if (!f) return 'idle';
  if (isReady(f) && f.state !== 'downloading') return 'ok';
  if (f.state === 'downloading') return 'pending';
  if (f.state === 'failed') {
    if (f.error?.code !== 'CANCELLED') return 'failed';
    return batch.skipped.some((n) => familyKey(n) === familyKey(f.family)) ? 'skipped' : 'cancelled';
  }
  return 'idle';
}

function reasonOf(outcome: Outcome, f: FontRow | undefined): string {
  if (outcome === 'skipped') return M.skipped;
  if (outcome === 'cancelled') return M.cancelled;
  if (outcome === 'failed') return localizeText(f?.error?.message, f?.error?.messageRef) || M.downloadFailed;
  return M.notDownloaded;
}

/**
 * What the font bar shows (null shows nothing). The Runtime downloads in parallel (two at a time), but the bar reads them one by one as in the prototype: which one of how many, which one is downloading now and its progress.
 * - In progress: “正在下载这个视频用到的字体 · 1/3 · 族名 42%” (Downloading the fonts used in this video · 1/3 · family name 42%); the current one can be skipped or all can be cancelled;
 * - All arrived: a single “已就绪” (Ready) line that collapses by itself after 3 seconds;
 * - Some not obtained: “2 个字体没取到，正在用回退字体显示” (2 fonts not obtained, showing with the fallback font); expanding shows family → fallback font · reason, and each can be retried;
 * - Auto-download off: “这个视频用到 2 个没下载的字体，正在用回退字体显示” (This video uses 2 fonts not yet downloaded, showing with the fallback font); they can be downloaded at once, or the user can go to Settings.
 */
export function fontBar(batch: FontBatch | null, byName: ReadonlyMap<string, FontRow>, fallbackOf: (family: string) => string): FontBar | null {
  if (!batch || batch.dismissed || batch.families.length === 0) return null;
  const total = batch.families.length;
  const get = (n: string) => byName.get(familyKey(n));
  const outcomes = batch.families.map((n) => [n, outcomeOf(get(n), batch)] as const);
  if (batch.mode === 'off' && outcomes.every(([, o]) => o === 'idle' || o === 'failed' || o === 'cancelled')) {
    return {
      kind: 'off',
      title: M.barOff(total),
      rows: batch.families.map((n) => ({ family: n, fallback: fallbackOf(n), reason: M.autoOff })),
    };
  }
  const current = outcomes.find(([, o]) => o === 'pending');
  if (current) {
    const settled = outcomes.filter(([, o]) => o !== 'pending').length;
    const f = get(current[0])!;
    return {
      kind: 'running',
      title: M.barRunning,
      count: `${settled + 1}/${total}`,
      current: f.family,
      progress: downloadingLabel(f),
      value: progressValue(f.progress),
    };
  }
  const missed = outcomes.filter(([, o]) => o !== 'ok');
  if (!missed.length) return { kind: 'ready', title: M.barReady(total) };
  return {
    kind: 'missed',
    title: M.barMissed(missed.length),
    rows: missed.map(([n, o]) => ({ family: get(n)?.family ?? n, fallback: fallbackOf(n), reason: reasonOf(o, get(n)) })),
  };
}

// ---- Export ----

export interface ExportFontLine {
  tone: 'info' | 'notice';
  families: string[];
  text: string;
  /** The text of the link at the row end (clicking it downloads these families). */
  action?: string;
}

/**
 * The sentences about fonts in the export panel (video page): among the families used, those still downloading, failed, or not downloaded (auto-download on / off). Export waits for downloads in progress first;
 * families not obtained are rendered with the fallback font, and the export result has a warning (`FONT_NOT_DOWNLOADED`). Export is not blocked, and no substitute font is chosen first.
 */
export function exportFontNote(usage: readonly FontUsageFamily[], byName: ReadonlyMap<string, FontRow>, autoDownload: boolean): ExportFontLine[] {
  const used = usage
    .filter((u) => u.status.source === 'google-fonts')
    .map((u) => ({ row: byName.get(familyKey(u.family)) ?? liveRow(u.status, undefined), fallback: u.fallback }));
  const names = (list: typeof used) => M.quoteList(list.map((f) => f.row.family));
  const pending = used.filter((f) => f.row.state === 'downloading');
  const failed = used.filter((f) => f.row.state === 'failed');
  const missing = used.filter((f) => f.row.state === 'downloadable');
  const lines: ExportFontLine[] = [];
  const families = (list: typeof used) => list.map((f) => f.row.family);
  if (pending.length) lines.push({ tone: 'info', families: families(pending), text: M.exportPending(names(pending), pending.length) });
  if (failed.length) {
    const fallbacks = M.quoteList([...new Set(failed.map((f) => f.fallback ?? KERNEL_FALLBACK))]);
    lines.push({
      tone: 'notice',
      families: families(failed),
      action: M.actionRetry,
      text: M.exportFailed(names(failed), fallbacks),
    });
  }
  if (missing.length && autoDownload) {
    lines.push({
      tone: 'info',
      families: families(missing),
      action: M.actionDownloadNow,
      text: M.exportMissingAuto(names(missing), missing.length),
    });
  } else if (missing.length) {
    lines.push({
      tone: 'notice',
      families: families(missing),
      action: M.actionDownload,
      text: M.exportMissingOff(names(missing), missing.length),
    });
  }
  return lines;
}

/** The line shown when export completes: families not obtained and rendered with the fallback font (`FONT_NOT_DOWNLOADED` warning, one mention per family). */
export function exportFontFallbacks(warnings: readonly JobWarning[]): string | null {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const w of warnings) {
    if (w.code !== 'FONT_NOT_DOWNLOADED') continue;
    if (w.font) {
      const key = familyKey(w.font.family);
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(M.exportFallback(w.font.family, w.font.fallback, w.font.reason));
    } else if (w.detail) parts.push(localizeText(w.detail, w.detailRef));
  }
  return parts.length ? parts.join(M.exportFallbackSeparator) : null;
}

/**
 * The other reminders in the export result: drop `FONT_NOT_DOWNLOADED` (listed separately above), and also drop the missing-font notice the render kernel reports for the same family
 * (`EXPORT_RENDER_NOTE`, “…字体 "X" 在当前字体库中不可用…” (…font "X" is not available in the current font library…)), so a family is not mentioned twice. Missing-font notices for other families are kept.
 */
export function exportOtherWarnings(warnings: readonly JobWarning[]): JobWarning[] {
  const covered = new Set(warnings.flatMap((w) => (w.code === 'FONT_NOT_DOWNLOADED' && w.font ? [familyKey(w.font.family)] : [])));
  return warnings.filter((w) => {
    if (w.code === 'FONT_NOT_DOWNLOADED') return false;
    if (w.code !== 'EXPORT_RENDER_NOTE' || !w.detail) return true;
    // i18n-ignore: matches the verbatim text reported by the render kernel (data, not UI copy)
    const family = /字体 "((?:[^"\\]|\\.)*)" 在当前字体库中不可用/.exec(w.detail)?.[1];
    return family === undefined || !covered.has(familyKey(family.replace(/\\(.)/g, '$1')));
  });
}

/** While downloading fonts in the export preparation phase: “下载字体 · Ma Shan Zheng 42%” (Downloading fonts · Ma Shan Zheng 42%) (the percentage is the byte progress of all fonts the export task is waiting for). */
export function exportFontPhase(job: Pick<JobRecord, 'phase' | 'progress' | 'state'>, downloading: readonly Pick<FontFamilyStatus, 'family'>[]): string | null {
  if (job.state !== 'running' || job.phase !== 'downloading') return null;
  const p = job.progress?.unit === 'bytes' ? job.progress : null;
  const pct = p ? progressText({ done: p.done, total: p.total }) : '';
  const parts = [downloading[0]?.family, pct].filter(Boolean);
  return M.exportPhase(parts.length ? parts.join(' ') : null);
}

// ---- Recently used ----

export function pushRecent(recent: readonly string[], family: string, limit = 8): string[] {
  return [family, ...recent.filter((n) => familyKey(n) !== familyKey(family))].slice(0, limit);
}

// ---- Full table of the font picker ----

/** The name shown in the font picker: the family name itself, except for “系统字体” (System font). */
export const fontLabel = (family: string) => (family === SYSTEM_FONT ? M.systemFont : family);

function placeholderStatus(family: string, state: FontFamilyState): FontFamilyStatus {
  return {
    family,
    state,
    category: null,
    subsets: [],
    scripts: [],
    weights: [],
    italics: [],
    variable: false,
    licence: null,
    source: 'local',
    downloaded: [],
    job: null,
    error: null,
  };
}

/**
 * The full table of the font picker: in the order the Runtime gives, with “系统字体” (System font) first (the text's original default, kept as an option); when the current value is not in the table (it is in neither the font catalogue nor on this machine),
 * it is appended as the last row, marked “没有这个字体” (Font not available), so the current value stays visible in the font picker.
 */
export function pickerRows(statuses: Readonly<Record<string, FontFamilyStatus>>, order: readonly string[], current: string): FontFamilyStatus[] {
  const rows: FontFamilyStatus[] = [placeholderStatus(SYSTEM_FONT, 'built-in')];
  for (const key of order) {
    const status = statuses[key];
    if (status) rows.push(status);
  }
  const want = familyKey(current);
  if (current && !rows.some((f) => familyKey(f.family) === want)) rows.push(statuses[want] ?? placeholderStatus(current, 'unavailable'));
  return rows;
}

// ---- Deletion and errors ----

/** Error codes (`details.code`) and descriptions for when the Runtime rejects a request. */
export function fontError(error: unknown): { code: string | null; message: string } {
  const e = error as { message?: unknown; details?: { code?: unknown } } | null;
  const code = typeof e?.details?.code === 'string' ? e.details.code : null;
  return { code, message: typeof e?.message === 'string' && e.message ? e.message : M.errorFallback };
}

/** Hint after deleting a family's downloaded files: when an export still in progress is using it (`FONT_IN_USE`), says when it can be deleted (original prototype text). */
export function removeToast(family: string, error: unknown | null): { text: string; tone: 'neutral' | 'notice' } {
  if (error === null) return { text: M.removed(family), tone: 'neutral' };
  const { code, message } = fontError(error);
  if (code === 'FONT_IN_USE') return { text: M.removeInUse(family), tone: 'notice' };
  return { text: message, tone: 'notice' };
}
