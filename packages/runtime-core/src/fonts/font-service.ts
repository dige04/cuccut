import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { type JobManager, type TaskRun, TaskFailure, canonicalJson, isTerminal, sha256Hex } from '@cuccut/jobs';
import type { Logger } from '@cuccut/harness';
import {
  refOf,
  RpcError,
  type DownloadedFontFace,
  type FontDownloadErrorCode,
  type FontDownloadResult,
  type FontFaceQuery,
  type FontFaceStyle,
  type FontFamilyState,
  type FontFamilyStatus,
  type FontRemoveResult,
  type FontSampleFormat,
  type FontSampleResult,
  type FontsCatalogueParams,
  type FontsUsageResult,
  type FontsCatalogueResult,
  type FontsResolveResult,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type MessageRef,
} from '@cuccut/protocol';
import type { LocalFontFaces, VideoService } from '../videos/video-service.ts';
import { isBundledFamily, BUNDLED_FONT_FAMILIES } from './bundled-fonts.ts';
import { FontCache, faceKey, familySlug, type FontCacheEntry } from './font-cache.ts';
import { FontCatalogue, defaultFaces, snapFace, type CatalogueFamily } from './font-catalogue.ts';
import { FontDownloadError, fetchFontFile, fetchFontText, type FontDownloadOptions } from './font-download.ts';
import {
  CSS_USER_AGENT,
  DEFAULT_CSS_ENDPOINT,
  DEFAULT_FILE_ENDPOINT,
  cssUrl,
  parseFontFaceCss,
  underEndpoint,
} from './google-fonts-css.ts';
import { RcFonts } from '@cuccut/protocol/messages/runtime-core';

/**
 * Downloaded fonts (architecture design §9.1): font catalogue, download cache, download tasks, and freezing for export when used.
 *
 * - Resolution order: fonts shipped with the kernel → locally installed fonts → download cache → download. If the family is installed locally, nothing is downloaded. The requested weight is mapped via the catalogue to a weight the family actually has (the same CSS matching as the engine's face selection); if that face is already cached, nothing is downloaded.
 * - Downloads are tasks (`kind: 'fontDownload'`, several faces per family, progress through the `jobs` topic). Export downloads within its own task (progress and cancellation follow the export).
 *   The same face is downloaded only once at a time: later requests wait for the same download.
 * - Download: the CSS endpoint gets only the family name, weight, and italic (fixed User-Agent, no other information sent). Files come only from the configured file host (https). After download, the engine verifies the file with the same parsing used for rendering (it can read the font, the family name matches, and the size is within the limit), and only then is it renamed into the cache. Logs record the family name only, never the URL.
 * - Faces in use by an unfinished export (frozen files, faces waiting on a download) are not deleted (`FONT_IN_USE`); this is released when the task ends.
 */

/** Upper limit for a CSS response. */
/** Upper limit for a sample (a few characters containing only the family name): a few KB for Latin letters; CJK is just a few characters. */
const MAX_SAMPLE_BYTES = 1024 * 1024;
/** Fetches at most this many samples at once (the font picker requests a dozen or more rows together). */
const SAMPLE_CONCURRENCY = 4;

const MAX_CSS_BYTES = 256 * 1024;
/** Upper limit for a single font file (below the engine's 96 MB extraction limit; a whole CJK font file is about 10–20 MB). */
export const MAX_FONT_FILE_BYTES = 64 * 1024 * 1024;
/** After an automatic download fails, no automatic retry for this long (manual downloads are not limited). */
const FAILURE_COOLDOWN_MS = 10 * 60_000;
const DOWNLOAD_QUEUE = { key: 'font-download', concurrency: 2 };
const PROGRESS_INTERVAL_MS = 250;
const DEFAULT_PAGE = 100;

export interface FontSettings {
  autoDownload: boolean;
  cssEndpoint: string | null;
  fileEndpoint: string | null;
  offlineStrict: boolean;
}

export interface FontServiceOptions {
  /** `<home>/fonts`。 */
  dir: string;
  jobs: JobManager;
  videos: Pick<VideoService, 'fontFaces' | 'fontFamilies' | 'inspectFont'>;
  log: Logger;
  settings: () => FontSettings;
  /** Font catalogue injected by tests. */
  catalogue?: FontCatalogue;
  /** fetch and backoff injected by tests. */
  download?: FontDownloadOptions;
}

/** Download cancelled (task cancelled, deleted, or export cancelled). */
class FontDownloadCancelled extends Error {
  constructor() {
    super(RcFonts.downloadCancelled().text);
    this.name = 'FontDownloadCancelled';
  }
}

/** A face being downloaded (or queued to download). */
interface Inflight {
  key: string;
  entry: CatalogueFamily;
  face: FontFaceStyle;
  /** The task responsible for the download: a `fontDownload` task or an export task. */
  jobId: Id | null;
  controller: AbortController;
  promise: Promise<FontCacheEntry>;
  received: number;
  total: number | null;
  begin(): Promise<FontCacheEntry>;
  /** Task ended without running (cancelled while queued): anything that never started counts as cancelled. */
  abandon(): void;
}

interface Failure {
  code: FontDownloadErrorCode | 'CANCELLED';
  message: string;
  messageRef?: MessageRef;
  at: string;
  time: number;
}

/** How a face is obtained: handed to the engine (shipped with the kernel, local, already in the cache, or not in the catalogue), or it must be downloaded. */
type FacePlan = { kind: 'engine' } | { kind: 'download'; entry: CatalogueFamily; face: FontFaceStyle; key: string };

/** What happens to a face when an export freezes: handed to the engine, downloaded within the task, or not downloaded (`reason` explains why). */
export type ExportFacePlan = { kind: 'engine' } | { kind: 'download' } | { kind: 'skip'; reason: string };

export class FontService {
  readonly cache: FontCache;
  readonly catalogue: FontCatalogue;
  readonly #options: FontServiceOptions;
  readonly #inflight = new Map<string, Inflight>();
  /** Most recent failure for each face (per face); most recent failure for each family (for the font picker). */
  readonly #failures = new Map<string, Failure>();
  readonly #familyFailures = new Map<string, Failure>();
  /** Used by unfinished exports: frozen cache files and faces waiting on a download. */
  readonly #pins = new Map<Id, { files: Set<string>; faces: Set<string> }>();
  /** Samples being fetched (one fetch per family at a time) and samples queued to be fetched. */
  readonly #samples = new Map<string, Promise<FontSampleResult>>();
  #sampleSlots = SAMPLE_CONCURRENCY;
  readonly #sampleQueue: (() => void)[] = [];

  constructor(options: FontServiceOptions) {
    this.#options = options;
    this.cache = new FontCache(options.dir, { log: options.log });
    // `CUCCUT_FONT_DOWNLOADS=off` (the test default, see vitest.config.ts): no font catalogue, nothing is downloaded, and only local fonts are used.
    this.catalogue =
      options.catalogue ??
      (process.env.CUCCUT_FONT_DOWNLOADS === 'off'
        ? FontCatalogue.parse({ schema: 'cuccut.google-fonts-catalogue/1', families: [] })
        : FontCatalogue.builtin());
  }

  // ---- Resolution (preview and export) ----

  /**
   * `fonts.resolve`: resolves per face (families shipped with the kernel never ask). With `download`, faces that are in the font catalogue but not yet downloaded are downloaded automatically per settings and marked `downloading`. Faces already downloading are also marked `downloading`, and are not filled in from another weight in the cache (once the download finishes, asking again gives the requested face).
   */
  async resolve(faces: FontFaceQuery[], options: { download: boolean; submitter: JobSubmitter }): Promise<LocalFontFaces> {
    const settings = this.#options.settings();
    const local = await this.#localFamilies();
    const ask: FontFaceQuery[] = [];
    const reasons = new Map<string, Pick<FontsResolveResult['missing'][number], 'reason' | 'code'>>();
    const pending: LocalFontFaces['missing'] = [];
    const toDownload = new Map<string, { entry: CatalogueFamily; faces: FontFaceStyle[]; queries: FontFaceQuery[] }>();
    for (const query of faces) {
      const plan = await this.#plan(query, local);
      if (plan.kind === 'engine') {
        ask.push(query);
        continue;
      }
      const running = this.#inflight.get(plan.key);
      if (running) {
        pending.push({ ...query, reason: 'downloading', ...(running.jobId ? { jobId: running.jobId } : {}) });
        continue;
      }
      const failure = this.#recentFailure(plan.key);
      if (options.download && settings.autoDownload && !settings.offlineStrict && !failure) {
        const group = toDownload.get(plan.entry.family) ?? { entry: plan.entry, faces: [], queries: [] };
        if (!group.faces.some((f) => f.weight === plan.face.weight && f.italic === plan.face.italic)) group.faces.push(plan.face);
        group.queries.push(query);
        toDownload.set(plan.entry.family, group);
        continue;
      }
      // Without download: if the cache holds another weight of this family, it is still returned (closer than a fallback font). Otherwise, the reason is stated.
      ask.push(query);
      reasons.set(queryKey(query), failure ? { reason: 'download-failed', code: failure.code } : { reason: 'downloadable' });
    }
    for (const { entry, faces: styles, queries } of toDownload.values()) {
      const jobId = this.#submitJob(entry, styles, options.submitter);
      for (const query of queries) pending.push({ ...query, reason: 'downloading', jobId });
    }
    const resolved = ask.length > 0 ? await this.#options.videos.fontFaces(ask) : { faces: [], missing: [] };
    return {
      faces: resolved.faces,
      missing: [
        ...resolved.missing.map((m) => (m.reason === 'not-found' && reasons.has(queryKey(m)) ? { ...m, ...reasons.get(queryKey(m)) } : m)),
        ...pending,
      ],
    };
  }

  /** When an export freezes: each face is handed to the engine, downloaded within the export task, or not downloaded (auto-download off, or strict offline). */
  async planExport(faces: readonly FontFaceQuery[]): Promise<Map<string, ExportFacePlan>> {
    const settings = this.#options.settings();
    const local = await this.#localFamilies();
    const plans = new Map<string, ExportFacePlan>();
    for (const query of faces) {
      const plan = await this.#plan(query, local);
      if (plan.kind === 'engine') plans.set(queryKey(query), { kind: 'engine' });
      else if (settings.offlineStrict) plans.set(queryKey(query), { kind: 'skip', reason: RcFonts.offlineStrict().text });
      else if (!settings.autoDownload)
        plans.set(queryKey(query), { kind: 'skip', reason: RcFonts.autoDownloadOff().text });
      else plans.set(queryKey(query), { kind: 'download' });
    }
    return plans;
  }

  /**
   * Before the export task starts drawing: downloads these faces (faces already downloading are awaited together with the same download). Progress is reported by bytes; stops when `signal` aborts. Returns a result for each face: null if it was downloaded (or was already present), otherwise a human-readable reason.
   */
  async ensureForExport(
    faces: readonly FontFaceQuery[],
    jobId: Id,
    signal: AbortSignal,
    onProgress: (done: number, total: number | null) => void,
  ): Promise<Map<string, string | null>> {
    const local = await this.#localFamilies();
    const outcomes = new Map<string, string | null>();
    const waits: { query: FontFaceQuery; inflight: Inflight }[] = [];
    for (const query of faces) {
      const plan = await this.#plan(query, local);
      if (plan.kind === 'engine') {
        outcomes.set(queryKey(query), null);
        continue;
      }
      let inflight = this.#inflight.get(plan.key);
      if (!inflight) {
        inflight = this.#register(plan.entry, plan.face, jobId);
        this.#pinFace(jobId, plan.key);
        void inflight.begin().catch(() => {});
      }
      waits.push({ query, inflight });
    }
    const unique = [...new Set(waits.map((w) => w.inflight))];
    const owned = unique.filter((i) => i.jobId === jobId);
    const onAbort = () => {
      for (const inflight of owned) inflight.controller.abort(new FontDownloadCancelled());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    // A failed face is no longer counted in progress: a 404 (which never returned a size) should not leave the export's progress with only bytes and no percentage.
    const failed = new Set<Inflight>();
    for (const inflight of unique) inflight.promise.catch(() => failed.add(inflight));
    const timer = setInterval(() => report(), PROGRESS_INTERVAL_MS);
    const report = () => {
      const counted = unique.filter((i) => !failed.has(i));
      const done = counted.reduce((sum, i) => sum + i.received, 0);
      const total = counted.every((i) => i.total !== null) ? counted.reduce((sum, i) => sum + i.total!, 0) : null;
      onProgress(done, total);
    };
    try {
      const aborted = new Promise<never>((_, reject) => {
        if (signal.aborted) reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      aborted.catch(() => {});
      for (const { query, inflight } of waits) {
        try {
          const entry = await Promise.race([inflight.promise, aborted]);
          this.#pinFile(jobId, this.cache.pathOf(entry));
          outcomes.set(queryKey(query), null);
        } catch (error) {
          if (signal.aborted) throw signal.reason;
          outcomes.set(queryKey(query), RcFonts.downloadFailedOutcome({ reason: error instanceof Error ? error.message : String(error) }).text);
        }
      }
      report();
      return outcomes;
    } finally {
      clearInterval(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  /** An export has frozen a file from the download cache, or faces waiting on a download: not deleted until the task finishes (`FONT_IN_USE`). */
  pin(jobId: Id, use: { files?: readonly string[]; faces?: readonly FontFaceQuery[] }): void {
    for (const file of use.files ?? []) this.#pinFile(jobId, file);
    for (const face of use.faces ?? []) {
      const entry = this.catalogue.get(face.family);
      if (entry) this.#pinFace(jobId, faceKey({ family: entry.family, ...snapFace(entry, face.weight, face.italic) }));
    }
  }

  /** Whether this is a file in the download cache. */
  isCached(file: string): boolean {
    const relative = path.relative(this.cache.filesDir, file);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  // ---- Picker list and cache ----

  async catalogueList(params: FontsCatalogueParams): Promise<FontsCatalogueResult> {
    const local = await this.#localFamilies();
    const cached = groupBy(await this.cache.list(), (face) => face.family.toLowerCase());
    const statuses: FontFamilyStatus[] = [];
    const seen = new Set<string>();
    const add = (status: FontFamilyStatus) => {
      const key = status.family.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      statuses.push(status);
    };
    if (params.families) {
      for (const name of params.families) add(this.#statusOf(name, local, cached));
    } else {
      // Those shipped with the kernel and already downloaded come first; the rest follow catalogue popularity; locally installed fonts not in the catalogue come last (by name).
      for (const name of BUNDLED_FONT_FAMILIES) add(this.#statusOf(name, local, cached));
      for (const name of [...cached.keys()].sort()) add(this.#statusOf(cached.get(name)![0]!.family, local, cached));
      for (const entry of this.catalogue.families()) add(this.#statusOf(entry.family, local, cached));
      for (const name of [...local.values()].sort((a, b) => a.localeCompare(b))) add(this.#statusOf(name, local, cached));
    }
    const query = params.query?.trim().toLowerCase() ?? '';
    const filtered = statuses.filter(
      (s) =>
        (!query || s.family.toLowerCase().includes(query)) &&
        (!params.category || s.category === params.category) &&
        (!params.script || s.scripts.includes(params.script)) &&
        (!params.states || params.states.includes(s.state)),
    );
    const offset = params.families ? 0 : (params.offset ?? 0);
    const limit = params.families ? filtered.length : (params.limit ?? DEFAULT_PAGE);
    return { total: filtered.length, families: filtered.slice(offset, offset + limit), catalogueDate: this.catalogue.date };
  }

  /** `fonts.download`: downloads a family (by default, the upright regular and bold). Calling it again after a failure is a retry. */
  async download(
    params: { family: string; faces?: FontFaceStyle[]; commandId?: Id },
    submitter: JobSubmitter,
  ): Promise<FontDownloadResult> {
    const entry = this.catalogue.get(params.family);
    if (!entry) {
      throw new RpcError('not-found', RcFonts.notInCatalogue({ family: params.family }), { code: 'FONT_NOT_IN_CATALOGUE', family: params.family });
    }
    const local = await this.#localFamilies();
    if (isBundledFamily(entry.family) || local.has(entry.family.toLowerCase())) {
      throw new RpcError('conflict', RcFonts.noNeedToDownload({ family: entry.family, bundled: isBundledFamily(entry.family) }), {
        code: 'FONT_NOT_DOWNLOADABLE',
        family: entry.family,
      });
    }
    if (this.#options.settings().offlineStrict) {
      throw new RpcError('conflict', RcFonts.offlineStrict(), { code: 'OFFLINE_STRICT', family: entry.family });
    }
    const faces = uniqueFaces((params.faces ?? defaultFaces(entry)).map((f) => snapFace(entry, f.weight, f.italic)));
    if (params.commandId) {
      const existing = this.#options.jobs.jobForCommand(params.commandId);
      if (existing) return { family: entry.family, faces, jobId: existing, status: await this.#status(entry.family) };
    }
    this.#familyFailures.delete(entry.family.toLowerCase());
    const needed: FontFaceStyle[] = [];
    let running: Id | null = null;
    for (const face of faces) {
      const key = faceKey({ family: entry.family, ...face });
      this.#failures.delete(key);
      const inflight = this.#inflight.get(key);
      if (inflight) running ??= inflight.jobId;
      else if (!(await this.cache.find(entry.family, face.weight, face.italic))) needed.push(face);
    }
    const jobId = needed.length > 0 ? this.#submitJob(entry, needed, submitter, params.commandId) : running;
    return { family: entry.family, faces, jobId, status: await this.#status(entry.family) };
  }

  async downloaded(): Promise<{ faces: DownloadedFontFace[]; totalBytes: number; inUse: string[] }> {
    const entries = await this.cache.list();
    const faces = entries.map(publicFace);
    const inUse = [...new Set(entries.filter((e) => this.#usersOf(e).length > 0).map((e) => e.family))];
    return { faces, totalBytes: faces.reduce((sum, f) => sum + f.sizeBytes, 0), inUse };
  }

  // ---- Fonts used by video, and samples ----

  /**
   * `fonts.usage`: groups the faces the Render Worker censused (`census`) by family. Each family carries its current status and what the kernel is drawing it with right now.
   * For `download`, faces not yet downloaded follow the same rules as `resolve` (auto-download, strict offline, faces that failed in the last ten minutes are not retried automatically, and cancellations do not count as failures).
   */
  async usage(
    census: { faces: readonly { family: string; weight: number; italic: boolean; bundled: boolean }[]; fallback: string },
    options: { download: boolean; submitter: JobSubmitter },
  ): Promise<FontsUsageResult> {
    const groups = new Map<string, { family: string; faces: FontFaceStyle[]; bundled: boolean }>();
    for (const face of census.faces) {
      const key = face.family.trim().toLowerCase();
      const group = groups.get(key) ?? { family: face.family.trim(), faces: [], bundled: face.bundled };
      if (!group.faces.some((f) => f.weight === face.weight && f.italic === face.italic)) {
        group.faces.push({ weight: face.weight, italic: face.italic });
      }
      groups.set(key, group);
    }
    const started: string[] = [];
    if (options.download) {
      const before = new Set([...this.#inflight.values()].map((i) => i.entry.family.toLowerCase()));
      const queries = [...groups.values()].filter((g) => !g.bundled).flatMap((g) => g.faces.map((f) => ({ family: g.family, ...f })));
      if (queries.length > 0) await this.resolve(queries, { download: true, submitter: options.submitter });
      for (const inflight of this.#inflight.values()) {
        const key = inflight.entry.family.toLowerCase();
        if (groups.has(key) && !before.has(key) && !started.includes(inflight.entry.family)) started.push(inflight.entry.family);
      }
    }
    const local = await this.#localFamilies();
    const cached = groupBy(await this.cache.list(), (face) => face.family.toLowerCase());
    const families = [...groups.values()]
      .sort((a, b) => a.family.localeCompare(b.family, 'en'))
      .map((group) => {
        const status = this.#statusOf(group.family, local, cached);
        const drawn = group.bundled || status.state === 'built-in' || status.state === 'installed' || status.downloaded.length > 0;
        return {
          family: status.family,
          faces: group.faces.sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight),
          status,
          fallback: drawn ? null : census.fallback,
        };
      });
    return { families, fallback: census.fallback, started };
  }

  /**
   * `fonts.sample`: a subset containing only the characters of the family name (the CSS endpoint's `text` parameter), so the font picker can draw the family name in that family. Same endpoint settings, file-host restriction, size limit, and no-redirect policy as downloads. Not fetched in strict offline mode. Fetched samples are stored in `<font cache>/samples/` and read directly next time.
   */
  async sample(params: { family: string }): Promise<FontSampleResult> {
    const entry = this.catalogue.get(params.family);
    const name = entry?.family ?? params.family.trim();
    const text = sampleText(name);
    if (!entry) return { family: name, text, data: null, format: null, reason: 'not-in-catalogue' };
    const settings = this.#options.settings();
    const face = snapFace(entry, 400, false);
    const file = path.join(
      this.cache.root,
      'samples',
      `${familySlug(entry.family)}-${sha256Hex(`${entry.family}\u0000${face.weight}\u0000${face.italic}\u0000${text}`).slice(0, 16)}`,
    );
    const cached = await readSample(file);
    if (cached) return { family: entry.family, text, ...cached };
    if (settings.offlineStrict) return { family: entry.family, text, data: null, format: null, reason: 'offline-strict' };
    const key = entry.family.toLowerCase();
    let pending = this.#samples.get(key);
    if (!pending) {
      pending = this.#withSampleSlot(() => this.#fetchSample(entry, face, text, file)).finally(() => this.#samples.delete(key));
      this.#samples.set(key, pending);
    }
    try {
      return await pending;
    } catch (error) {
      if (error instanceof FontDownloadError) {
        throw new RpcError(
          'conflict',
          error.message,
          { code: error.code, family: entry.family, remedy: error.remedy, remedyRef: error.remedyRef },
          error.messageRef,
        );
      }
      throw error;
    }
  }

  async #withSampleSlot<T>(run: () => Promise<T>): Promise<T> {
    if (this.#sampleSlots === 0) await new Promise<void>((resolve) => this.#sampleQueue.push(resolve));
    else this.#sampleSlots--;
    try {
      return await run();
    } finally {
      const next = this.#sampleQueue.shift();
      if (next) next();
      else this.#sampleSlots++;
    }
  }

  async #fetchSample(entry: CatalogueFamily, face: FontFaceStyle, text: string, file: string): Promise<FontSampleResult> {
    const settings = this.#options.settings();
    const cssBase = settings.cssEndpoint ?? DEFAULT_CSS_ENDPOINT;
    const fileBase = settings.fileEndpoint ?? DEFAULT_FILE_ENDPOINT;
    const label = RcFonts.sampleLabel({ family: entry.family });
    const signal = AbortSignal.timeout(60_000);
    const css = await fetchFontText(
      {
        url: `${cssUrl(cssBase, entry.family, [face])}&text=${encodeURIComponent(text)}`,
        headers: { 'User-Agent': CSS_USER_AGENT },
        what: RcFonts.sampleCss({ label }),
        maxBytes: MAX_CSS_BYTES,
        signal,
      },
      this.#options.download,
    );
    const block = parseFontFaceCss(css).find((b) => b.family.toLowerCase() === entry.family.toLowerCase());
    if (!block) throw new FontDownloadError('FONT_DOWNLOAD_SOURCE', RcFonts.noSampleBlock({ label }));
    if (!underEndpoint(block.url, fileBase)) throw new FontDownloadError('FONT_DOWNLOAD_SOURCE', RcFonts.sampleNotOnHost({ label }));
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });
    const temp = path.join(dir, `.${randomUUID()}.part`);
    try {
      await fetchFontFile(
        { url: block.url, headers: { 'User-Agent': CSS_USER_AGENT }, what: label, maxBytes: MAX_SAMPLE_BYTES, signal },
        temp,
        this.#options.download,
      );
      const bytes = await fs.readFile(temp);
      const format = sniffFontFormat(bytes);
      if (!format) throw new FontDownloadError('FONT_DOWNLOAD_INTEGRITY', RcFonts.sampleNotUsable({ label }));
      // TrueType / OpenType files are then checked again with the same parsing used for rendering. WOFF and WOFF2 are compressed and the engine cannot read them, so only the file header is checked (the browser in the UI decodes them itself).
      if (format === 'truetype' || format === 'opentype') {
        try {
          if ((await this.#options.videos.inspectFont(temp)).length === 0) throw new Error('empty');
        } catch {
          throw new FontDownloadError('FONT_DOWNLOAD_INTEGRITY', RcFonts.sampleNotUsable({ label }));
        }
      }
      await fs.rename(temp, `${file}.${format}`);
      return { family: entry.family, text, data: bytes.toString('base64'), format };
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  /** `fonts.remove`: deletes the files of a family's downloaded faces. Rejected while an unfinished export is using them; a download in progress is cancelled first. */
  async remove(params: { family: string; faces?: FontFaceStyle[] }): Promise<FontRemoveResult> {
    const family = params.family.trim().toLowerCase();
    const matches = (face: { family: string; weight: number; italic: boolean }) =>
      face.family.toLowerCase() === family &&
      (!params.faces || params.faces.some((f) => f.weight === face.weight && f.italic === face.italic));
    const entries = (await this.cache.list()).filter(matches);
    const running = [...this.#inflight.values()].filter((i) => matches({ family: i.entry.family, ...i.face }));
    const busy = new Set([...entries.flatMap((e) => this.#usersOf(e)), ...running.flatMap((i) => this.#usersOfFace(i.key))]);
    if (busy.size > 0) {
      throw new RpcError('conflict', RcFonts.inUseByExport({ family: params.family }), {
        code: 'FONT_IN_USE',
        family: params.family,
        jobIds: [...busy],
      });
    }
    await this.#cancel(running);
    await this.cache.remove(entries);
    for (const key of [...this.#failures.keys()]) if (key.startsWith(`${family}\u0000`)) this.#failures.delete(key);
    this.#familyFailures.delete(family);
    if (entries.length > 0) this.#options.log.info('Deleted downloaded font', { family: params.family, faces: entries.length });
    return { removed: entries.map(publicFace), freedBytes: sum(entries), kept: [] };
  }

  /** `fonts.clear`: empties the download cache; faces used by an unfinished export are kept. */
  async clear(): Promise<FontRemoveResult> {
    const entries = await this.cache.list();
    const kept = entries.filter((e) => this.#usersOf(e).length > 0);
    const removed = entries.filter((e) => !kept.includes(e));
    await this.#cancel([...this.#inflight.values()].filter((i) => this.#usersOfFace(i.key).length === 0));
    await this.cache.remove(removed);
    this.#failures.clear();
    this.#familyFailures.clear();
    this.#options.log.info('Cleared downloaded fonts', { removed: removed.length, kept: kept.length });
    return { removed: removed.map(publicFace), freedBytes: sum(removed), kept: kept.map(publicFace) };
  }

  // ---- Internal ----

  /** Families installed locally (lowercase → original name). */
  async #localFamilies(): Promise<Map<string, string>> {
    const families = await this.#options.videos.fontFamilies();
    return new Map(families.filter((f) => !isBundledFamily(f)).map((f) => [f.toLowerCase(), f]));
  }

  async #plan(query: FontFaceQuery, local: Map<string, string>): Promise<FacePlan> {
    const family = query.family.trim();
    if (isBundledFamily(family) || local.has(family.toLowerCase())) return { kind: 'engine' };
    const entry = this.catalogue.get(family);
    if (!entry) return { kind: 'engine' };
    const face = snapFace(entry, query.weight, query.italic);
    if (await this.cache.find(entry.family, face.weight, face.italic)) return { kind: 'engine' };
    return { kind: 'download', entry, face, key: faceKey({ family: entry.family, ...face }) };
  }

  /**
   * Faces whose automatic download failed within the last ten minutes are not automatically downloaded again. Cancellation (cancelling a download, cancelling an export, or deletion) is not a failure: the picker still records “已取消” (cancelled), but it does not block the next automatic download.
   */
  #recentFailure(key: string): Failure | null {
    const failure = this.#failures.get(key);
    return failure && failure.code !== 'CANCELLED' && Date.now() - failure.time < FAILURE_COOLDOWN_MS ? failure : null;
  }

  /** Registers a face's download (not yet started); `begin` starts it. When it ends (success or failure), the registration is removed and any failure is recorded. */
  #register(entry: CatalogueFamily, face: FontFaceStyle, jobId: Id | null): Inflight {
    const key = faceKey({ family: entry.family, ...face });
    let settle!: { resolve: (value: FontCacheEntry) => void; reject: (error: unknown) => void };
    const promise = new Promise<FontCacheEntry>((resolve, reject) => {
      settle = { resolve, reject };
    });
    promise.catch(() => {});
    let begun = false;
    const inflight: Inflight = {
      key,
      entry,
      face,
      jobId,
      controller: new AbortController(),
      promise,
      received: 0,
      total: null,
      begin: () => {
        if (!begun) {
          begun = true;
          this.#fetchFace(inflight).then(settle.resolve, settle.reject);
        }
        return promise;
      },
      abandon: () => {
        if (!begun) {
          begun = true;
          settle.reject(new FontDownloadCancelled());
        }
      },
    };
    this.#inflight.set(key, inflight);
    promise.then(
      () => {
        this.#failures.delete(key);
        if (this.#inflight.get(key) === inflight) this.#inflight.delete(key);
      },
      (error: unknown) => {
        const cancelled = error instanceof FontDownloadCancelled || inflight.controller.signal.aborted;
        const messageRef = cancelled ? refOf(RcFonts.cancelled()) : error instanceof FontDownloadError ? error.messageRef : undefined;
        const failure: Failure = {
          code: cancelled ? 'CANCELLED' : error instanceof FontDownloadError ? error.code : 'FONT_DOWNLOAD_NETWORK',
          message: cancelled ? RcFonts.cancelled().text : error instanceof Error ? error.message : String(error),
          ...(messageRef ? { messageRef } : {}),
          at: new Date().toISOString(),
          time: Date.now(),
        };
        this.#failures.set(key, failure);
        this.#familyFailures.set(entry.family.toLowerCase(), failure);
        if (this.#inflight.get(key) === inflight) this.#inflight.delete(key);
      },
    );
    return inflight;
  }

  /** Submits a family's download task (several faces). Faces are registered at submission; later requests for the same face wait on this task. */
  #submitJob(entry: CatalogueFamily, faces: FontFaceStyle[], submitter: JobSubmitter, commandId?: Id): Id {
    const spec = { task: 'fontDownload' as const, family: entry.family, faces };
    const hash = `sha256:${sha256Hex(canonicalJson(spec))}`;
    const inflights = faces.map((face) => this.#register(entry, face, null));
    let jobId: Id;
    try {
      ({ jobId } = this.#options.jobs.submitTask(
        {
          kind: 'fontDownload',
          spec,
          videoId: null,
          contentHash: hash,
          inputHash: hash,
          providerId: 'google-fonts',
          modelId: entry.family,
          ...(commandId ? { commandId } : {}),
          queue: DOWNLOAD_QUEUE,
          run: (run) => this.#runJob(run, entry, inflights),
        },
        submitter,
      ));
    } catch (error) {
      for (const inflight of inflights) inflight.abandon();
      throw error;
    }
    for (const inflight of inflights) inflight.jobId = jobId;
    void this.#options.jobs.settled(jobId).then(
      () => inflights.forEach((i) => i.abandon()),
      () => inflights.forEach((i) => i.abandon()),
    );
    this.#options.log.info('Font download submitted', { family: entry.family, faces: faces.length, jobId });
    return jobId;
  }

  async #runJob(run: TaskRun, entry: CatalogueFamily, inflights: Inflight[]): Promise<NonNullable<JobRecord['result']>> {
    const onAbort = () => inflights.forEach((i) => i.controller.abort(new FontDownloadCancelled()));
    run.signal.addEventListener('abort', onAbort, { once: true });
    const report = () => {
      const done = inflights.reduce((s, i) => s + i.received, 0);
      const total = inflights.every((i) => i.total !== null) ? inflights.reduce((s, i) => s + i.total!, 0) : null;
      run.phase('downloading', { done, total, unit: 'bytes' });
    };
    report();
    const timer = setInterval(report, PROGRESS_INTERVAL_MS);
    let results: PromiseSettledResult<FontCacheEntry>[];
    try {
      results = await Promise.allSettled(inflights.map((i) => i.begin()));
    } finally {
      clearInterval(timer);
      run.signal.removeEventListener('abort', onAbort);
    }
    if (run.signal.aborted) throw run.signal.reason;
    report();
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) {
      const error = failed.reason;
      if (error instanceof FontDownloadError) {
        throw Object.assign(
          new TaskFailure(error.code, error.message, {
            ...error.details,
            family: entry.family,
            remedy: error.remedy,
            remedyRef: error.remedyRef,
          }),
          { messageRef: error.messageRef },
        );
      }
      throw error;
    }
    const faces = results.map((r) => (r as PromiseFulfilledResult<FontCacheEntry>).value);
    const { artifactId } = await this.#options.jobs.artifacts.put(
      Buffer.from(
        canonicalJson({
          schema: 'cuccut.font-download/1',
          family: entry.family,
          licence: entry.licence,
          faces: faces.map((f) => ({ weight: f.weight, italic: f.italic, sha256: f.sha256, sizeBytes: f.sizeBytes })),
          downloadedAt: new Date().toISOString(),
        }),
      ),
      'json',
    );
    this.#options.log.info('Font download finished', { family: entry.family, faces: faces.length, jobId: run.jobId });
    return { documentId: null, artifactId };
  }

  /** Downloads one face: CSS → file → engine verification → rename into the cache. */
  async #fetchFace(inflight: Inflight): Promise<FontCacheEntry> {
    const { entry, face } = inflight;
    const signal = inflight.controller.signal;
    const settings = this.#options.settings();
    if (settings.offlineStrict) throw new FontDownloadError('FONT_DOWNLOAD_NETWORK', RcFonts.offlineStrict());
    const cssBase = settings.cssEndpoint ?? DEFAULT_CSS_ENDPOINT;
    const fileBase = settings.fileEndpoint ?? DEFAULT_FILE_ENDPOINT;
    const label = RcFonts.faceLabel({ family: entry.family, weight: face.weight, italic: face.italic });
    const css = await fetchFontText(
      {
        url: cssUrl(cssBase, entry.family, [face]),
        headers: { 'User-Agent': CSS_USER_AGENT },
        what: RcFonts.faceCss({ label }),
        maxBytes: MAX_CSS_BYTES,
        signal,
      },
      this.#options.download,
    );
    const blocks = parseFontFaceCss(css).filter(
      (b) =>
        b.family.toLowerCase() === entry.family.toLowerCase() &&
        b.italic === face.italic &&
        b.weight[0] <= face.weight &&
        face.weight <= b.weight[1],
    );
    if (blocks.length === 0) throw new FontDownloadError('FONT_DOWNLOAD_SOURCE', RcFonts.noFaceBlock({ label }));
    if (blocks.length > 1 || blocks[0]!.partial) {
      throw new FontDownloadError('FONT_DOWNLOAD_SOURCE', RcFonts.faceSplit({ label }));
    }
    const block = blocks[0]!;
    if (!underEndpoint(block.url, fileBase)) {
      throw new FontDownloadError('FONT_DOWNLOAD_SOURCE', RcFonts.faceNotOnHost({ label }));
    }
    await fs.mkdir(this.cache.stagingDir, { recursive: true });
    const temp = path.join(this.cache.stagingDir, `${randomUUID()}.part`);
    try {
      const { size, sha256 } = await fetchFontFile(
        {
          url: block.url,
          headers: { 'User-Agent': CSS_USER_AGENT },
          what: label,
          maxBytes: MAX_FONT_FILE_BYTES,
          signal,
          onBytes: (received, total) => {
            inflight.received = received;
            inflight.total = total;
          },
        },
        temp,
        this.#options.download,
      );
      signal.throwIfAborted();
      let inspected;
      try {
        inspected = await this.#options.videos.inspectFont(temp);
      } catch {
        throw new FontDownloadError('FONT_DOWNLOAD_INTEGRITY', RcFonts.faceNotUsable({ label }));
      }
      const wanted = entry.family.toLowerCase();
      if (!inspected.some((f) => f.families.some((name) => name.toLowerCase() === wanted))) {
        throw new FontDownloadError('FONT_DOWNLOAD_INTEGRITY', RcFonts.familyMismatch({ label }), {
          families: [...new Set(inspected.flatMap((f) => f.families))].slice(0, 5),
        });
      }
      signal.throwIfAborted();
      const added = await this.cache.add(temp, { family: entry.family, ...face, licence: entry.licence, sha256, sizeBytes: size });
      this.#options.log.info('Font downloaded', { family: entry.family, weight: face.weight, italic: face.italic, bytes: size });
      return added;
    } catch (error) {
      if (signal.aborted) throw new FontDownloadCancelled();
      if (!(error instanceof FontDownloadError)) this.#options.log.warn('Font download failed', { family: entry.family, error: String(error) });
      else this.#options.log.warn('Font download failed', { family: entry.family, code: error.code });
      throw error;
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  async #cancel(inflights: readonly Inflight[]): Promise<void> {
    const jobIds = new Set<Id>();
    for (const inflight of inflights) {
      inflight.controller.abort(new FontDownloadCancelled());
      inflight.abandon();
      if (inflight.jobId) jobIds.add(inflight.jobId);
    }
    for (const jobId of jobIds) {
      const job = this.#options.jobs.list().find((j) => j.jobId === jobId);
      if (job?.kind === 'fontDownload') await this.#options.jobs.cancel(jobId).catch(() => {});
    }
    await Promise.allSettled(inflights.map((i) => i.promise));
  }

  #pinFile(jobId: Id, file: string): void {
    this.#pinsOf(jobId).files.add(file);
  }

  #pinFace(jobId: Id, key: string): void {
    this.#pinsOf(jobId).faces.add(key);
  }

  #pinsOf(jobId: Id): { files: Set<string>; faces: Set<string> } {
    let pins = this.#pins.get(jobId);
    if (!pins) {
      pins = { files: new Set(), faces: new Set() };
      this.#pins.set(jobId, pins);
      const release = () => this.#pins.delete(jobId);
      void this.#options.jobs.settled(jobId).then(release, release);
    }
    return pins;
  }

  #usersOf(entry: FontCacheEntry): Id[] {
    const file = this.cache.pathOf(entry);
    const key = faceKey(entry);
    return this.#livePins()
      .filter(([, pins]) => pins.files.has(file) || pins.faces.has(key))
      .map(([jobId]) => jobId);
  }

  #usersOfFace(key: string): Id[] {
    return this.#livePins()
      .filter(([, pins]) => pins.faces.has(key))
      .map(([jobId]) => jobId);
  }

  /**
   * Pins for unfinished tasks. A task counts as `settled` only after its terminal state has been published and written to disk (the pin is released only then). When a client receives the terminal state and fetches the downloaded list or deletes, a task that has just ended in between is no longer counted as in use.
   */
  #livePins(): [Id, { files: Set<string>; faces: Set<string> }][] {
    return [...this.#pins].filter(([jobId]) => {
      try {
        return !isTerminal(this.#options.jobs.inspect(jobId).state);
      } catch {
        return false;
      }
    });
  }

  async #status(family: string): Promise<FontFamilyStatus> {
    const local = await this.#localFamilies();
    const cached = groupBy(await this.cache.list(), (face) => face.family.toLowerCase());
    return this.#statusOf(family, local, cached);
  }

  #statusOf(name: string, local: Map<string, string>, cached: Map<string, FontCacheEntry[]>): FontFamilyStatus {
    const entry = this.catalogue.get(name);
    const family = entry?.family ?? local.get(name.trim().toLowerCase()) ?? name.trim();
    const key = family.toLowerCase();
    const downloaded = (cached.get(key) ?? []).map((f) => ({ weight: f.weight, italic: f.italic, sizeBytes: f.sizeBytes }));
    const running = [...this.#inflight.values()].filter((i) => i.entry.family.toLowerCase() === key);
    const failure = this.#familyFailures.get(key) ?? null;
    const bundled = isBundledFamily(family);
    const installed = local.has(key);
    let state: FontFamilyState;
    if (bundled) state = 'built-in';
    else if (installed) state = 'installed';
    else if (running.length > 0) state = 'downloading';
    else if (downloaded.length > 0) state = 'downloaded';
    else if (!entry) state = 'unavailable';
    else if (failure) state = 'failed';
    else state = 'downloadable';
    const jobId = running.find((i) => i.jobId)?.jobId ?? null;
    return {
      family,
      state,
      category: entry?.category ?? null,
      subsets: entry ? [...entry.subsets] : [],
      scripts: entry ? [...entry.scripts] : [],
      weights: entry ? [...entry.weights] : [],
      italics: entry ? [...entry.italics] : [],
      variable: entry?.variable ?? false,
      licence: entry?.licence ?? null,
      source: bundled ? 'built-in' : installed || !entry ? 'local' : 'google-fonts',
      downloaded,
      job:
        jobId && running.length > 0
          ? {
              jobId,
              doneBytes: running.reduce((s, i) => s + i.received, 0),
              totalBytes: running.every((i) => i.total !== null) ? running.reduce((s, i) => s + i.total!, 0) : null,
            }
          : null,
      error:
        failure && state !== 'downloading'
          ? { code: failure.code, message: failure.message, ...(failure.messageRef ? { messageRef: failure.messageRef } : {}), at: failure.at }
          : null,
    };
  }
}

/** Characters in a sample: the family name with whitespace and duplicate characters removed (in order of appearance). */
export function sampleText(family: string): string {
  return [...new Set([...family.replace(/\s+/g, '')])].join('');
}

/** Identifies the font format from the file header. */
export function sniffFontFormat(bytes: Uint8Array): FontSampleFormat | null {
  if (bytes.length < 4) return null;
  const tag = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'opentype';
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'truetype';
  return null;
}

/** A cached sample (the file extension gives the format). */
async function readSample(file: string): Promise<Pick<FontSampleResult, 'data' | 'format'> | null> {
  for (const format of ['truetype', 'opentype', 'woff2', 'woff'] as const) {
    try {
      const bytes = await fs.readFile(`${file}.${format}`);
      return { data: bytes.toString('base64'), format };
    } catch {
      // Not of this format
    }
  }
  return null;
}

export function queryKey(face: { family: string; weight: number; italic: boolean }): string {
  return `${face.family.trim()}\u0000${face.weight}\u0000${face.italic ? 1 : 0}`;
}

function publicFace(entry: FontCacheEntry): DownloadedFontFace {
  const { file: _file, ...face } = entry;
  return face;
}

function sum(entries: readonly FontCacheEntry[]): number {
  return entries.reduce((total, e) => total + e.sizeBytes, 0);
}

function uniqueFaces(faces: FontFaceStyle[]): FontFaceStyle[] {
  return faces.filter((f, i) => faces.findIndex((g) => g.weight === f.weight && g.italic === f.italic) === i);
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k) ?? [];
    list.push(item);
    groups.set(k, list);
  }
  return groups;
}
