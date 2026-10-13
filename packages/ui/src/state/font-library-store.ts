import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CucCutClient } from '@cuccut/client';
import type { DownloadedFontFace, FontFamilyStatus, FontSampleResult, FontsUsageResult, Id, JobRecord } from '@cuccut/protocol';
import { batchFamilies, canDownload, familyKey, liveFontJobs, pushRecent, type FontBatch } from '../model/font-library.ts';
import { jobLive } from '../model/task-list.ts';
import { useJobs } from './jobs-store.ts';
import { recentOf } from './home-templates-store.ts';

/**
 * Font library state (product design §5.9 "Fonts"; architecture design §9.1; prototype font-library-store.jsx). The font picker, the font strip, the export panel and
 * Settings › Fonts all share it. The authority is the Runtime: family state comes from `fonts.catalogue`, the fonts a video uses come from `fonts.usage`, and progress comes from the `fontDownload` task in the `jobs`
 * topic. Here we only cache and advance requests, and when a task ends, state is fetched again per family. The computations are in model/font-library.ts.
 */

type Client = Pick<CucCutClient, 'request'>;

/** How many to fetch per page (the `fonts.catalogue` limit). */
const PAGE = 500;

export type SampleState = { state: 'loading' } | { state: 'ready'; css: string } | { state: 'none' };

interface FontLibraryState {
  /** Family state (by `familyKey`) and the order the Runtime gave (from the last full-list fetch). */
  statuses: Record<string, FontFamilyStatus>;
  order: string[];
  loaded: boolean;
  /** Fonts used by the open video (`fonts.usage`, the whole video, subtitles included). */
  usage: Record<Id, FontsUsageResult>;
  /** Fonts used by this export in the export panel (`fonts.usage` with the "burn subtitles" choice), by `exportUsageKey`. */
  exportUsage: Record<string, FontsUsageResult>;
  /** The batch for the open video (the font strip). */
  batch: FontBatch | null;
  samples: Record<string, SampleState>;
  downloaded: { faces: DownloadedFontFace[]; totalBytes: number; inUse: string[] } | null;
}

export const useFontLibrary = create<FontLibraryState>()(() => ({
  statuses: {},
  order: [],
  loaded: false,
  usage: {},
  exportUsage: {},
  batch: null,
  samples: {},
  downloaded: null,
}));

/** Recently used families, remembered on this computer (the prototype's recent). */
export const useFontRecent = create<{ recent: string[]; use(family: string): void }>()(
  persist(
    (set) => ({
      recent: [],
      use: (family) => set((s) => ({ recent: pushRecent(s.recent, family) })),
    }),
    {
      name: 'cuccut.fontRecent',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ recent: s.recent }),
      merge: (persisted, current) => ({ ...current, recent: recentOf(persisted) }),
    },
  ),
);

function putStatuses(list: readonly FontFamilyStatus[], appendOrder = false): void {
  useFontLibrary.setState((s) => {
    const statuses = { ...s.statuses };
    const order = appendOrder ? [...s.order] : s.order;
    for (const status of list) {
      const key = familyKey(status.family);
      if (appendOrder && !(key in statuses)) order.push(key);
      statuses[key] = status;
    }
    return { statuses, order };
  });
}

let loading: Promise<void> | null = null;

/** The full list (about two thousand families, fetched by page). After it has been fetched, it is refreshed per family only. `force` refetches it (the order follows the Runtime's new order). */
export function loadCatalogue(client: Client, force = false): Promise<void> {
  if (useFontLibrary.getState().loaded && !force) return Promise.resolve();
  loading ??= (async () => {
    try {
      const all: FontFamilyStatus[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const page = await client.request('fonts.catalogue', { offset, limit: PAGE });
        all.push(...page.families);
        if (page.families.length < PAGE || all.length >= page.total) break;
      }
      useFontLibrary.setState((s) => ({
        statuses: { ...s.statuses, ...Object.fromEntries(all.map((f) => [familyKey(f.family), f])) },
        order: all.map((f) => familyKey(f.family)),
        loaded: true,
      }));
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Refetch state per family (when a task ends, a download starts, or an export is downloading). */
export async function refreshFamilies(client: Client, families: readonly string[]): Promise<void> {
  const unique = [...new Set(families.map((f) => f.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 200) {
    const { families: list } = await client.request('fonts.catalogue', { families: unique.slice(i, i + 200) });
    putStatuses(
      list.filter((f) => f.state !== 'unavailable' || familyKey(f.family) in useFontLibrary.getState().statuses),
      true,
    );
  }
}

/** Manual download (click download, retry, or select a family not yet downloaded). It ignores the auto-download switch. Returns whether a download started this time. */
export async function downloadFamily(client: Client, family: string): Promise<boolean> {
  const result = await client.request('fonts.download', { family });
  putStatuses([result.status], true);
  return result.jobId !== null;
}

/** The task downloading this family (`fontDownload`). */
function liveJobOf(family: string): JobRecord | undefined {
  return liveFontJobs(useJobs.getState().jobs).get(familyKey(family));
}

/** Cancel a family's download. The Runtime records it as `CANCELLED` (shown as "cancelled" in the list). A download inside an export task is cancelled with the export, and is not handled here. */
export async function cancelFamily(client: Client, family: string): Promise<void> {
  const job = liveJobOf(family) ?? null;
  const jobId = job?.jobId ?? useFontLibrary.getState().statuses[familyKey(family)]?.job?.jobId ?? null;
  if (!jobId) return;
  try {
    await client.request('jobs.cancel', { jobId });
  } finally {
    await refreshFamilies(client, [family]).catch(() => {});
  }
}

/** Select a family: record it in recently used. If it is not yet downloaded (or the last attempt failed or was cancelled), start the download. Returns the state of the family whose download started, or null if none started. */
export async function chooseFamily(client: Client, family: string): Promise<FontFamilyStatus | null> {
  useFontRecent.getState().use(family);
  const status = useFontLibrary.getState().statuses[familyKey(family)];
  if (!status || !canDownload(status) || liveJobOf(family)) return null;
  const started = await downloadFamily(client, family);
  return started ? (useFontLibrary.getState().statuses[familyKey(family)] ?? status) : null;
}

// ---- Video ----

/**
 * Open a video: the Runtime inventories the fonts it uses (`fonts.usage`, `download: true`). Those not yet downloaded start under the auto-download rules, and ones that failed within the last ten minutes
 * are not retried automatically. The font strip records this batch. When auto-download is off, the batch waits for the user to click "Download".
 */
export async function openVideoFonts(client: Client, videoId: Id, autoDownload: boolean): Promise<void> {
  const usage = await client.request('fonts.usage', { videoId, download: true });
  putStatuses(
    usage.families.map((f) => f.status),
    true,
  );
  const families = batchFamilies(usage.families);
  useFontLibrary.setState((s) => ({
    usage: { ...s.usage, [videoId]: usage },
    batch: families.length
      ? { videoId, families, mode: autoDownload || usage.started.length > 0 ? 'auto' : 'off', skipped: [], dismissed: false }
      : s.batch?.videoId === videoId
        ? null
        : s.batch,
  }));
}

/** Inventory again (when the export panel opens; no download). */
export async function refreshUsage(client: Client, videoId: Id): Promise<void> {
  const usage = await client.request('fonts.usage', { videoId });
  putStatuses(
    usage.families.map((f) => f.status),
    true,
  );
  useFontLibrary.setState((s) => ({ usage: { ...s.usage, [videoId]: usage } }));
}

/** The export panel's inventories (video, with or without burned-in subtitles) are each recorded separately. Switching back and forth does not let a late response overwrite the one for the current choice. */
export const exportUsageKey = (videoId: Id, burnCaptions: boolean) => `${videoId}\u0000${burnCaptions ? 'burn' : 'plain'}`;

/**
 * Inventory for the export panel (video page): the same parameters as this export (`burnCaptions`; the sequence is the root sequence, as in export), with no download. When subtitles are not burned into the picture,
 * families used only by subtitles are left out of the list. It is recorded in `exportUsage` and does not touch the whole video's `usage` (the font picker's "used in this video" and the font strip read that).
 */
export async function refreshExportUsage(client: Client, videoId: Id, burnCaptions: boolean): Promise<void> {
  const usage = await client.request('fonts.usage', { videoId, burnCaptions });
  putStatuses(
    usage.families.map((f) => f.status),
    true,
  );
  useFontLibrary.setState((s) => ({ exportUsage: { ...s.exportUsage, [exportUsageKey(videoId, burnCaptions)]: usage } }));
}

export function leaveVideoFonts(videoId: Id): void {
  useFontLibrary.setState((s) => (s.batch?.videoId === videoId ? { batch: null } : s));
}

export function dismissBatch(): void {
  useFontLibrary.setState((s) => (s.batch ? { batch: { ...s.batch, dismissed: true } } : s));
}

const pendingOf = (batch: FontBatch) =>
  batch.families.filter((n) => {
    const status = useFontLibrary.getState().statuses[familyKey(n)];
    return !!liveJobOf(n) || status?.state === 'downloading';
  });

/** The font strip's "skip this": cancel the one currently downloading. That family falls back to the fallback font, and the strip moves on to the next one. */
export async function skipCurrent(client: Client): Promise<void> {
  const batch = useFontLibrary.getState().batch;
  const current = batch ? pendingOf(batch)[0] : undefined;
  if (!batch || !current) return;
  useFontLibrary.setState({ batch: { ...batch, skipped: [...batch.skipped, current] } });
  await cancelFamily(client, current);
}

/** The font strip's ✕: cancel the batch's downloads still in progress. */
export async function cancelBatch(client: Client): Promise<void> {
  const batch = useFontLibrary.getState().batch;
  if (!batch) return;
  await Promise.all(pendingOf(batch).map((n) => cancelFamily(client, n).catch(() => {})));
}

/** On the font strip with auto-download off, "Download": this batch switches to downloading and is submitted one by one (the Runtime downloads two at a time). */
export async function downloadBatch(client: Client): Promise<void> {
  const batch = useFontLibrary.getState().batch;
  if (!batch) return;
  useFontLibrary.setState({ batch: { ...batch, mode: 'auto', skipped: [] } });
  for (const family of batch.families) await downloadFamily(client, family).catch(() => {});
}

// ---- Settings › Fonts ----

export async function loadDownloaded(client: Client): Promise<void> {
  useFontLibrary.setState({ downloaded: await client.request('fonts.downloaded', {}) });
}

export async function removeFamily(client: Client, family: string): Promise<{ freedBytes: number }> {
  try {
    const result = await client.request('fonts.remove', { family });
    return { freedBytes: result.freedBytes };
  } finally {
    await Promise.all([loadDownloaded(client), refreshFamilies(client, [family])]).catch(() => {});
  }
}

export async function clearDownloaded(client: Client) {
  try {
    return await client.request('fonts.clear', {});
  } finally {
    await loadDownloaded(client).catch(() => {});
    await loadCatalogue(client, true).catch(() => {});
  }
}

// ---- Samples ----

/** Install a sample into the interface's font table. Returns the family name used in CSS. Replaced in tests. */
export type FaceRegistrar = (name: string, bytes: ArrayBuffer) => Promise<void>;

const registerInDocument: FaceRegistrar = async (name, bytes) => {
  const face = new FontFace(name, bytes);
  await face.load();
  document.fonts.add(face);
};

function decodeBase64(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * When a row scrolls into view, fetch its sample (`fonts.sample`, a subset containing only the characters of the family name) and install it into the interface's font table. The row is then drawn with it.
 * Families already installed on this machine use the system font itself. Families that ship with the kernel or are in the font catalogue need a sample. If it cannot be fetched (offline, strictly offline, or not in the catalogue), the row is plain text in the interface font.
 */
export async function requestSample(client: Client, family: string, register: FaceRegistrar = registerInDocument): Promise<void> {
  const key = familyKey(family);
  if (useFontLibrary.getState().samples[key]) return;
  const set = (state: SampleState) => useFontLibrary.setState((s) => ({ samples: { ...s.samples, [key]: state } }));
  const status = useFontLibrary.getState().statuses[key];
  if (status?.state === 'installed') return set({ state: 'ready', css: `"${status.family.replace(/"/g, '')}"` });
  if (status && status.category === null) return set({ state: 'none' });
  set({ state: 'loading' });
  let sample: FontSampleResult;
  try {
    sample = await client.request('fonts.sample', { family });
  } catch {
    return set({ state: 'none' });
  }
  if (!sample.data) return set({ state: 'none' });
  const name = `cc-sample-${key.replace(/[^a-z0-9]+/g, '-')}`;
  try {
    await register(name, decodeBase64(sample.data));
    set({ state: 'ready', css: `"${name}"` });
  } catch {
    set({ state: 'none' });
  }
}

// ---- Following tasks ----

let syncUsers = 0;
let stopSync: (() => void) | null = null;

/**
 * Follows the `jobs` topic. When a `fontDownload` task ends (completed, failed or cancelled), state is fetched again per family, and the downloaded list on the settings page is refreshed too. The downloaded list is also refreshed when an export starts and when it ends:
 * an export still in progress pins the fonts it uses ("in use by export", with the delete button disabled). Pinning and unpinning both happen at these two moments.
 * Reference counted: the font picker, the font strip, the export panel and the settings page each attach. When the last one leaves, it unsubscribes.
 */
export function startFontLibrarySync(client: Client): () => void {
  syncUsers++;
  if (!stopSync) {
    const live = new Set<Id>();
    const exporting = new Set<Id>();
    let exports: Set<Id> | null = null;
    const settle = (jobs: readonly JobRecord[]) => {
      const ended: string[] = [];
      const nowExporting = new Set(jobs.filter((j) => j.kind === 'export' && jobLive(j)).map((j) => j.jobId));
      // The first time just records (the settings page fetched once when mounted). After that, the downloaded list is refetched whenever an export starts or ends.
      const pinsChanged = exports !== null && (nowExporting.size !== exports.size || [...nowExporting].some((id) => !exports!.has(id)));
      exports = nowExporting;
      for (const job of jobs) {
        if (job.kind === 'export') {
          // Faces an export downloads itself are not `fontDownload` tasks. When the export leaves the download stage (or ends), refetch the families this export was downloading that are recorded in the state.
          if (jobLive(job) && job.phase === 'downloading') exporting.add(job.jobId);
          else if (exporting.delete(job.jobId)) {
            const { statuses } = useFontLibrary.getState();
            for (const s of Object.values(statuses)) if (s.state === 'downloading' && s.job?.jobId === job.jobId) ended.push(s.family);
          }
          continue;
        }
        if (job.kind !== 'fontDownload') continue;
        if (jobLive(job)) live.add(job.jobId);
        else if (live.delete(job.jobId)) ended.push(job.modelId);
      }
      if (ended.length) void refreshFamilies(client, ended).catch(() => {});
      if ((ended.length || pinsChanged) && useFontLibrary.getState().downloaded) void loadDownloaded(client).catch(() => {});
    };
    settle(useJobs.getState().jobs);
    stopSync = useJobs.subscribe((s) => settle(s.jobs));
  }
  return () => {
    if (--syncUsers > 0 || !stopSync) return;
    stopSync();
    stopSync = null;
  };
}
