import path from 'node:path';
import type { AppUpdateFailure, AppUpdateFormat, AppUpdateInfo, AppUpdateState } from '@cuccut/ui';

/*
 * Criteria for app auto-update (architecture design §2.6, design doc §17.7 and model-app-update.js): parsing the schema-1 manifest, when updates are enabled,
 * the cadence of automatic checks, staged rollout, the state machine, what follows a check, progress throttling, and the macOS swap script and parsing of several command outputs.
 * All are pure functions. Fetching the manifest, downloading, verification and the swap are in app-update-service.ts / app-update-install.ts, and the wiring is in app-update-ipc.ts.
 * The rules are ported from CucCut's Rust implementation (apps/cuccut/src/host/app_update.rs); the state machine follows the `reduce` in the design doc.
 */

/** Environment variable that overrides the update source: `https://…`, `file:///…` or an absolute path (for drills and tests; a dev build that sets it also enables updates). */
export const APPCAST_ENV = 'CUCCUT_UPDATE_APPCAST';
/** Bundle identifier of the release build. The `CFBundleIdentifier` of a new build must be exactly this; the Windows installer's appId is also this (the packaging script reads it from here). */
export const BUNDLE_ID = 'com.cuccut.app';
/** Product name: on Windows, the file names of the executable and the NSIS uninstaller are both derived from it (the packaging script reads it from here). */
export const PRODUCT_NAME = 'CucCut';
/** The uninstaller that electron-builder's NSIS installer places next to the exe (`UNINSTALL_FILENAME` in the common.nsh template). Its presence means this is an installed build. */
export const NSIS_UNINSTALLER = `Uninstall ${PRODUCT_NAME}.exe`;
/** Variant name of the standard build (`--variant cpu` in the packaging script); its update source file name has no suffix. */
export const STANDARD_VARIANT = 'cpu';
/** Download page: opened when automatic installation does not work. */
export const DOWNLOAD_PAGE = 'https://github.com/hieudinh/cuccut/releases';
/** How long after launch the first automatic check runs (seconds). */
export const FIRST_CHECK_DELAY_S = 15;
/** Interval between two automatic checks (seconds). */
export const CHECK_INTERVAL_S = 6 * 3600;
/** Metronome period (seconds): each tick checks whether a check is due. Ticks are shorter than the interval, so after sleep/wake or when automatic checks have just been turned on, there is no need to wait the full 6 hours. */
export const TICK_S = 30 * 60;
/** Maximum time to wait for install-on-quit (milliseconds): only cheap work remains, such as writing the swap script and recording the installer. On timeout, quit as usual so that quitting is not blocked. */
export const QUIT_INSTALL_DEADLINE_MS = 5000;

// ---- Update source ----

export type FeedTarget = 'aarch64-apple-darwin' | 'x86_64-pc-windows-msvc';

/** Which update source this build reads. Platforms with no published artifacts return null (same as a dev build). */
export function feedTarget(platform: string, arch: string): FeedTarget | null {
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-apple-darwin';
  if (platform === 'win32' && arch === 'x64') return 'x86_64-pc-windows-msvc';
  return null;
}

/**
 * Update source file name: `appcast-<target>.json`. Windows CUDA and Vulkan builds each have their own (`appcast-<target>-<variant>.json`).
 * The three installers share one appId, so reading the wrong file would install another variant. An invalid variant name falls back to the standard build.
 */
export function feedFileName(target: FeedTarget, variant: string | null): string {
  const suffix = variant && variant !== STANDARD_VARIANT && /^[a-z0-9]+$/.test(variant) ? `-${variant}` : '';
  return `appcast-${target}${suffix}.json`;
}

export function feedUrl(target: FeedTarget, variant: string | null = null): string {
  return `https://raw.githubusercontent.com/hieudinh/cuccut/main/apps/desktop/releases/${feedFileName(target, variant)}`;
}

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:[\\/]/;

/** Local file: `file://…`, an absolute path, or a Windows drive path. The installer URL in the manifest may be a local file only when the update source has been overridden by the environment variable. */
export function isFileUrl(url: string): boolean {
  return url.startsWith('file://') || url.startsWith('/') || WINDOWS_DRIVE_PATH.test(url);
}

/** `file:///a/b`, `/a/b`, `file:///C:/a`, `C:\a` → local path (percent-decoding of `file://`); anything else returns null. */
export function fileUrlPath(url: string): string | null {
  if (url.startsWith('file://')) {
    const decoded = percentDecode(url.slice('file://'.length));
    // Strip the `/` before the drive letter in `file:///C:/a`.
    return /^\/[A-Za-z]:[\\/]/.test(decoded) ? decoded.slice(1) : decoded;
  }
  return url.startsWith('/') || WINDOWS_DRIVE_PATH.test(url) ? url : null;
}

/** Percent-decodes byte by byte; a malformed `%` is kept as is. */
function percentDecode(text: string): string {
  const src = new TextEncoder().encode(text);
  const out: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const byte = src[i]!;
    if (byte === 0x25 && i + 2 < src.length) {
      const hex = String.fromCharCode(src[i + 1]!, src[i + 2]!);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    out.push(byte);
  }
  return new TextDecoder().decode(new Uint8Array(out));
}

/** Which installer formats this target accepts: macOS accepts ZIP (the main path) and DMG (for compatibility), while Windows accepts only the installer. */
export function acceptedFormats(target: string): AppUpdateFormat[] {
  if (target.endsWith('-apple-darwin')) return ['zip', 'dmg'];
  if (target.includes('-windows-')) return ['exe'];
  return [];
}

// ---- Manifest ----

export type ManifestError = 'decode' | 'schema' | 'release' | 'artifact' | 'target';

/** Staged rollout: within `hours` hours from `releasedAt` (Unix milliseconds), the share released rises linearly from 0 to 1. */
export interface Rollout {
  hours: number;
  releasedAt: number;
}

export type ManifestResult =
  { ok: true; info: AppUpdateInfo; rollout: Rollout | null } | { ok: false; error: ManifestError; detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const optionalString = (value: unknown): value is string | undefined | null => value == null || typeof value === 'string';

/**
 * Parses a schema-1 manifest. `target` is this build's target and determines which `format` values are accepted. If the manifest states a `target`, it must match.
 * If it states a `variant`, it must be this build's variant (a null `variant` means the standard build; a manifest that omits it is not compared, so older manifests are still read).
 * A missing `format` is read as `dmg` (v1). `sha256` must be 64 hex digits (lowercased), and the installer URL must be https (or a local file when `allowFileUrl` is set).
 * Size and build must be greater than 0. Unknown keys are always ignored.
 *
 * The optional `rolloutHours` (a finite number greater than 0) and `releasedAt` (an ISO 8601 time with a time zone) together form the staged rollout. If either is missing or malformed,
 * the release is treated as not staged and the manifest is still read. This differs from the other optional fields (a wrong type rejects the whole manifest): if the staging fields are wrong, it is better to roll out to everyone than to leave everyone without the update.
 */
export function parseManifest(text: string, target: string, allowFileUrl: boolean, variant: string | null = null): ManifestResult {
  const fail = (error: ManifestError, detail: string): ManifestResult => ({ ok: false, error, detail });
  let wire: unknown;
  try {
    wire = JSON.parse(text);
  } catch (error) {
    return fail('decode', String(error));
  }
  if (!isRecord(wire)) return fail('decode', 'manifest is not an object');
  const {
    schema,
    target: declaredTarget,
    variant: declaredVariant,
    version,
    build,
    date,
    minimumSystemVersion,
    notes,
    notesLocalized,
    app,
    rolloutHours,
    releasedAt,
  } = wire;
  if (typeof schema !== 'number' || typeof version !== 'string' || typeof build !== 'number' || !Number.isInteger(build)) {
    return fail('decode', 'schema, version or build has the wrong type');
  }
  if (
    !optionalString(declaredTarget) ||
    !optionalString(declaredVariant) ||
    !optionalString(date) ||
    !optionalString(minimumSystemVersion) ||
    !optionalString(notes)
  ) {
    return fail('decode', 'a text field has the wrong type');
  }
  if (notesLocalized != null && (!isRecord(notesLocalized) || Object.values(notesLocalized).some((v) => typeof v !== 'string'))) {
    return fail('decode', 'notesLocalized has the wrong type');
  }
  if (schema !== 1) return fail('schema', `unsupported manifest schema ${schema}`);
  const declared = declaredTarget?.trim();
  if (declared && declared !== target) return fail('target', `manifest is for ${declared}`);
  const declaredFlavor = declaredVariant?.trim();
  if (declaredFlavor && declaredFlavor !== (variant ?? STANDARD_VARIANT))
    return fail('target', `manifest is for the ${declaredFlavor} variant`);
  if (!version.trim() || build <= 0) return fail('release', 'manifest version or build is invalid');
  if (!isRecord(app)) return fail('artifact', 'manifest has no app');
  const { url, size, sha256, format: rawFormat } = app;
  if (typeof url !== 'string' || typeof size !== 'number' || typeof sha256 !== 'string' || !optionalString(rawFormat)) {
    return fail('artifact', 'app fields have the wrong type');
  }
  const format = rawFormat == null ? 'dmg' : rawFormat.trim().toLowerCase();
  if (!(acceptedFormats(target) as string[]).includes(format)) return fail('artifact', `format ${format} is not for ${target}`);
  const schemeOk = url.toLowerCase().startsWith('https://') || (allowFileUrl && isFileUrl(url));
  if (!Number.isInteger(size) || size <= 0 || !/^[0-9a-fA-F]{64}$/.test(sha256) || !schemeOk) {
    return fail('artifact', 'manifest artifact is invalid');
  }
  return {
    ok: true,
    info: {
      version: version.trim(),
      build,
      date: date ?? '',
      minimumSystemVersion: minimumSystemVersion?.trim() ? minimumSystemVersion : null,
      notes: notes ?? '',
      notesLocalized: { ...((notesLocalized as Record<string, string> | null | undefined) ?? {}) },
      format: format as AppUpdateFormat,
      url,
      size,
      sha256: sha256.toLowerCase(),
    },
    rollout: parseRollout(rolloutHours, releasedAt),
  };
}

/** An ISO 8601 time with a time zone (`Z` or `±hh:mm`). A bare date without a time zone is not accepted, since it is read differently in different places. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

function parseRollout(hours: unknown, releasedAt: unknown): Rollout | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return null;
  if (typeof releasedAt !== 'string' || !ISO_INSTANT.test(releasedAt.trim())) return null;
  const at = Date.parse(releasedAt.trim());
  return Number.isFinite(at) ? { hours, releasedAt: at } : null;
}

/** Facts about one release to be written into the update source (computed from the artifacts by the packaging script). */
export interface ReleaseFacts {
  target: FeedTarget;
  /** Variant. The standard build uses `STANDARD_VARIANT`. */
  variant: string;
  version: string;
  build: number;
  /** `YYYY-MM-DD`。 */
  date: string;
  format: AppUpdateFormat;
  /** https URL of the installer. */
  url: string;
  size: number;
  sha256: string;
  /** Duration of the staged rollout (hours); if omitted, no staged rollout. */
  rolloutHours?: number;
  /** Start of the staged rollout: an ISO 8601 time with a time zone (only meaningful when `rolloutHours` is given). */
  releasedAt?: string;
}

/**
 * A schema-1 manifest (what `parseManifest` reads). The Windows packaging script uses the installer's size and digest to generate
 * `appcast-<target>[-<variant>].json`. The notes (`notes`) are left empty and filled in at release time. The two staged-rollout keys are written only when given.
 */
export function releaseManifest(facts: ReleaseFacts): Record<string, unknown> {
  return {
    schema: 1,
    target: facts.target,
    variant: facts.variant,
    version: facts.version,
    build: facts.build,
    date: facts.date,
    notes: '',
    notesLocalized: {},
    app: { format: facts.format, url: facts.url, size: facts.size, sha256: facts.sha256.toLowerCase() },
    ...(facts.rolloutHours !== undefined ? { rolloutHours: facts.rolloutHours } : {}),
    ...(facts.releasedAt !== undefined ? { releasedAt: facts.releasedAt } : {}),
  };
}

/**
 * File name used when downloading to the cache directory: the last segment of the URL. If it contains a path separator, starts with a dot, contains control characters, or is empty,
 * `CucCut-<build>.<ext>` is used instead, so the manifest does not decide which directory is written to.
 */
export function fileName(info: Pick<AppUpdateInfo, 'url' | 'build' | 'format'>): string {
  const last = percentDecode((info.url.split(/[?#]/)[0] ?? '').split('/').pop() ?? '');
  const safe = last !== '' && !last.startsWith('.') && !/[/\\:]/.test(last) && !/[\u0000-\u001f\u007f-\u009f]/.test(last);
  return safe ? last : `CucCut-${info.build}.${info.format}`;
}

/** Compares dotted version numbers (`14.0` < `14.2.1`; a missing segment counts as 0, and an unreadable segment counts as 0). Returns -1, 0 or 1 for less than, equal to, or greater than. */
export function compareVersions(left: string, right: string): number {
  const parts = (text: string) =>
    text
      .trim()
      .split('.')
      .map((part) => (/^\d+$/.test(part.trim()) ? Number(part.trim()) : 0));
  const a = parts(left);
  const b = parts(right);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * The OS version required by the new release is higher than this machine's. Only compared on macOS (Windows minimum versions are kernel numbers, which the installer checks itself).
 * If the manifest does not state it, or the local version cannot be read, nothing is blocked. Returns the required version; the UI shows “Requires macOS X”.
 */
export function systemRequirementUnmet(info: Pick<AppUpdateInfo, 'minimumSystemVersion'>, currentSystem: string | null, macos: boolean): string | null {
  if (!macos) return null;
  const required = info.minimumSystemVersion;
  if (!required || !currentSystem?.trim()) return null;
  return compareVersions(currentSystem, required) < 0 ? required : null;
}

/** The manifest counts as an update only if it is newer than this machine. Only the build number is compared. */
export function isNewer(info: Pick<AppUpdateInfo, 'build'>, currentBuild: number): boolean {
  return info.build > currentBuild;
}

// ---- When enabled ----

export interface UpdateEnvironment {
  /** Mac App Store channel. CucCut is distributed only through its website, so this is always false for now. It is kept to match the design doc's “App Store 版本” copy (App Store version). */
  appStore: boolean;
  /** This build's build number (written into the app's package.json at packaging; 0 if absent). */
  build: number;
  /** If `CUCCUT_UPDATE_APPCAST` is set, updates are enabled even in a dev build. */
  feedOverride: boolean;
  /** This build has published artifacts (`feedTarget` is non-empty). */
  hasFeedTarget: boolean;
  /** A packaged release build (Electron's `app.isPackaged`). */
  packaged: boolean;
  windows: boolean;
  /** The `CFBundleIdentifier` of the running bundle on macOS; null if it cannot be read. */
  bundleId: string | null;
  /** The executable is inside `<X>.app/Contents/MacOS/`. */
  exeInAppBundle: boolean;
}

/**
 * Why updates are not checked; null when enabled. A bundle without a build number (a CI trial bundle) is not a release: every version is newer than it, and it stays 0 after installing,
 * so it would update forever. For that reason it is not checked, same as a dev build (but it is checked when the update source is overridden, for drills).
 */
export function availability(env: UpdateEnvironment): 'dev' | 'appStore' | null {
  if (env.appStore) return 'appStore';
  if (env.feedOverride) return null;
  if (!env.hasFeedTarget || !env.packaged || env.build <= 0) return 'dev';
  if (env.windows) return null;
  return env.bundleId === BUNDLE_ID && env.exeInAppBundle ? null : 'dev';
}

/** Whether the executable path is `<X>.app/Contents/MacOS/<exe>`. */
export function exeInAppBundle(executable: string): boolean {
  const macos = path.dirname(executable);
  const contents = path.dirname(macos);
  const bundle = path.dirname(contents);
  return path.basename(macos) === 'MacOS' && path.basename(contents) === 'Contents' && path.extname(bundle).toLowerCase() === '.app';
}

/** The nearest enclosing `.app` of the executable; null if it is not inside a bundle. */
export function appBundleFromExecutable(executable: string): string | null {
  let current = executable;
  for (;;) {
    if (path.extname(current).toLowerCase() === '.app') return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Update cache directory: macOS `~/Library/Caches/CucCut/Updates`, Windows `%LOCALAPPDATA%\CucCut\Updates`, otherwise `~/.cache/CucCut/Updates`. */
export function cacheDirectory(platform: string, home: string, env: Readonly<Record<string, string | undefined>>): string | null {
  if (!home) return null;
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches', 'CucCut', 'Updates');
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'CucCut', 'Updates');
  return path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), 'CucCut', 'Updates');
}

// ---- Cadence ----

/**
 * Whether this tick should run an automatic check (times are Unix seconds). The first tick after launch always checks; after that, it checks only if there has never been a check or at least 6 hours have passed since the last one.
 * A clock set backwards (last check in the future) counts as due, so a single clock change does not stop automatic checks.
 */
export function shouldAutoCheck(firstTick: boolean, lastCheck: number | null, now: number): boolean {
  if (firstTick || lastCheck === null || lastCheck > now) return true;
  return now - lastCheck >= CHECK_INTERVAL_S;
}

// ---- Staged rollout ----

/**
 * How much is released now (0–1): 1 when not staged; 0 before `releasedAt`; after that, it rises linearly to 1 with the elapsed time.
 */
export function rolloutFraction(rollout: Rollout | null, nowMs: number): number {
  if (!rollout) return 1;
  const elapsed = nowMs - rollout.releasedAt;
  if (elapsed <= 0) return 0;
  return Math.min(1, elapsed / (rollout.hours * 3600 * 1000));
}

/** The release is offered only if this machine's `bucket` position ([0, 1), fixed per install) falls within the released portion. */
export function rolloutAdmits(fraction: number, bucket: number): boolean {
  return bucket < fraction;
}

/** This machine's install identifier: a random UUID, stored in the user data directory. */
export function isInstallationId(text: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

/** Install identifier → position: the leading 8 hex digits (all 32 bits of a UUID v4 are random) divided by 2^32, giving a value in [0, 1). */
export function bucketFromId(id: string): number {
  return parseInt(id.slice(0, 8), 16) / 2 ** 32;
}

// ---- State machine (design doc model-app-update.js `reduce`) ----

export type UpdateEvent =
  | { type: 'check'; auto?: boolean }
  /** The check found a new version. `systemUnmet`: this machine's OS is not new enough. `cached`: a file for the same build that is already downloaded and whose digest has been re-verified (it still needs to be verified and staged). */
  | { type: 'found'; info: AppUpdateInfo; systemUnmet?: string | null; cached?: string | null }
  /** The update source has nothing newer than this machine. `heldBack`: there is a newer version, but this rollout round did not include this machine. */
  | { type: 'none'; heldBack?: boolean }
  | { type: 'fail'; failure: AppUpdateFailure }
  | { type: 'download' }
  | { type: 'progress'; pct: number }
  | { type: 'downloaded'; path: string }
  | { type: 'cancel' }
  | { type: 'install' };

const BUSY = new Set<AppUpdateState['k']>(['checking', 'downloading', 'installing']);

/** Information about the version carried by the state. */
export function stateInfo(st: AppUpdateState): AppUpdateInfo | null {
  return 'info' in st ? st.info : null;
}

/** Starting point for a silent check: an update is available and downloaded. The displayed state does not change; only `bg` is attached. */
function quietStart(st: AppUpdateState): st is Extract<AppUpdateState, { k: 'available' | 'ready' }> {
  return st.k === 'available' || st.k === 'ready';
}

/** A silent check in flight: an automatic check was started while an update was already available or downloaded. The displayed state does not change; only `bg` is attached. */
function quietInFlight(st: AppUpdateState): st is Extract<AppUpdateState, { k: 'available' | 'ready' }> {
  return quietStart(st) && st.bg === true;
}

/** Clears the in-flight marker of the silent check. */
function settle(st: Extract<AppUpdateState, { k: 'available' | 'ready' }>): AppUpdateState {
  const { bg: _bg, ...settled } = st;
  return settled;
}

/** Whether this tick may start an automatic check: no check if updates are not checked, if a check, download or install is in progress, or if a silent check is already in flight. */
export function mayAutoCheck(st: AppUpdateState): boolean {
  return st.k !== 'unsupported' && !BUSY.has(st.k) && !quietInFlight(st);
}

/**
 * A check is waiting for its result: a manual check in `checking`, or a silent check with `bg` on “update available” or “downloaded”. In any other state (for example, the user started a download or clicked restart in the meantime),
 * a late check result is discarded, so that a failed check cannot turn an in-flight download into an error state.
 */
export function checkPending(st: AppUpdateState): boolean {
  return st.k === 'checking' || quietInFlight(st);
}

/**
 * State transitions. An automatic check is silent while in “update available” or “downloaded”: it sets `bg`, and the displayed state does not change. A failed silent check keeps the original state, so one network hiccup
 * does not discard an update already found or downloaded. A manual check still enters `checking` as before.
 *
 * Silent check while “downloaded” (2026-10-05): same build → stays downloaded. A newer build, but this machine's OS is too old → stays downloaded (the version in hand is already verified and installable, and it is newer than the running one).
 * Another build (newer, or older than the downloaded one but still newer than the running one, i.e. the downloaded release was withdrawn) → the old download is discarded and replaced with “update available”.
 * Nothing newer than the running one → already up to date; the withdrawn release is not installed (the service then deletes the downloaded package).
 *
 * When this rollout round did not include this machine (`none` with `heldBack`), a silent check whose starting point already holds a version newer than the running one keeps the original state and only clears `bg`.
 * Other starting points go to “up to date” as usual.
 *
 * One addition beyond the design doc: when `found` carries the intact cached copy of the same build, it goes straight to the verification stage after the download reaches 100%, and reaches “downloaded” only once verification and staging are complete.
 */
export function reduce(st: AppUpdateState, ev: UpdateEvent): AppUpdateState {
  if (st.k === 'unsupported') return st;
  switch (ev.type) {
    case 'check':
      if (ev.auto) {
        if (!mayAutoCheck(st)) return st;
        if (quietStart(st)) return { ...st, bg: true };
      }
      return BUSY.has(st.k) ? st : { k: 'checking' };
    case 'found':
      if (!checkPending(st)) return st;
      if (st.k === 'ready') {
        const same = ev.info.build === st.info.build;
        if (same || (ev.systemUnmet && ev.info.build > st.info.build)) return settle(st);
      }
      if (ev.systemUnmet) return { k: 'available', info: ev.info, systemUnmet: ev.systemUnmet };
      if (ev.cached) return { k: 'downloading', info: ev.info, pct: 100 };
      return { k: 'available', info: ev.info };
    case 'none':
      if (ev.heldBack && quietInFlight(st)) return settle(st);
      return checkPending(st) ? { k: 'upToDate' } : st;
    case 'fail':
      if (quietInFlight(st)) return settle(st);
      return { k: 'error', failure: ev.failure, info: stateInfo(st) };
    case 'download':
      if (st.k === 'available' && !st.systemUnmet) return { k: 'downloading', info: st.info, pct: 0 };
      if (st.k === 'error' && st.info) return { k: 'downloading', info: st.info, pct: 0 };
      return st;
    case 'progress': {
      if (st.k !== 'downloading') return st;
      const pct = Math.max(0, Math.min(100, Math.round(ev.pct)));
      return pct === st.pct ? st : { ...st, pct };
    }
    case 'downloaded':
      return st.k === 'downloading' ? { k: 'ready', info: st.info, path: ev.path } : st;
    case 'cancel':
      return st.k === 'downloading' ? { k: 'available', info: st.info } : st;
    case 'install':
      return st.k === 'ready' ? { k: 'installing', info: st.info } : st;
  }
}

/** Verification stage after the download reaches 100% and before “downloaded” (the UI shows “verifying”). */
export function verifying(st: AppUpdateState): boolean {
  return st.k === 'downloading' && st.pct >= 100;
}

// ---- After a check ----

export type Origin = 'auto' | 'manual';

export interface CheckReport {
  /** The version newer than this machine. null means there is none (or this round did not include this machine; see `heldBack`). */
  info: AppUpdateInfo | null;
  /** The update source has a version newer than this machine, but this rollout round did not include this machine (automatic checks only). */
  heldBack: boolean;
  /** A file for the same build that is downloaded and whose digest has been re-verified. */
  cached: string | null;
  /** Whether this machine can swap the package without manual action by the user. */
  canAutoInstall: boolean;
  /** The new version requires a macOS version that this machine does not meet: it stays at “update available”, with no download and no reminder. */
  systemUnmet: string | null;
}

export type Followup = 'none' | 'verify' | 'download' | 'toastAvailable';

/**
 * What follows once the check result has landed (`next` is the state after landing) (design doc `afterCheck`): if the cache already holds this version and it has entered the verification stage, verify it
 * (an automatic check reminds “downloaded” when verification completes). When an automatic check lands on a downloadable “update available”, if automatic download is on and automatic swapping is possible, download in the background; otherwise remind “you can update now”.
 * Staying downloaded, an unmet OS version, and manual checks do not follow up.
 */
export function followup(origin: Origin, autoDownload: boolean, report: CheckReport, next: AppUpdateState): Followup {
  if (report.cached && verifying(next)) return 'verify';
  if (origin === 'manual' || next.k !== 'available' || next.systemUnmet) return 'none';
  return autoDownload && report.canAutoInstall ? 'download' : 'toastAvailable';
}

/** Whether to push download progress: the percentage has changed and at least 250 ms have passed since the last push, or it reached 100. */
export function progressDue(lastPct: number | null, pct: number, sinceLastMs: number): boolean {
  if (lastPct === null) return true;
  if (pct === lastPct) return false;
  if (pct >= 100) return true;
  return sinceLastMs >= 250;
}

/** Bytes received → percentage (0–100, rounded down). */
export function percent(received: number, total: number): number {
  if (total <= 0) return 0;
  return Math.floor((Math.min(received, total) * 100) / total);
}

// ---- Command output and swap script (macOS) ----

/** Output of `codesign -dv --verbose=2` (on stderr) → Team ID. `not set` (ad-hoc signature) and an empty value both count as no Team ID. */
export function teamIdentifier(codesignStderr: string): string | null {
  for (const line of codesignStderr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TeamIdentifier=')) continue;
    const value = trimmed.slice('TeamIdentifier='.length).trim();
    return value && value.toLowerCase() !== 'not set' ? value : null;
  }
  return null;
}

/** Output of `hdiutil attach` → mount point: the last tab-separated column that starts with `/Volumes/` (a mount point may contain spaces). */
export function mountPath(output: string): string | null {
  const lines = output.split('\n').reverse();
  for (const line of lines) {
    const column = (line.split('\t').pop() ?? '').trim();
    if (column.startsWith('/Volumes/')) return column;
  }
  return null;
}

/** Single-quote escaping: `'` → `'\''`, and the whole string is wrapped in single quotes. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export interface InstallerPlan {
  pid: number;
  /** The verified new `.app` (in the directory extracted from the ZIP, or in the DMG mount point). */
  newApp: string;
  /** The running `.app` (the one to be replaced). */
  target: string;
  /** The DMG mount point; a ZIP has none. */
  mount: string | null;
  /** The downloaded installer package; deleted after the swap. */
  archive: string;
  /** Temporary directory the ZIP was extracted to; deleted after the swap. */
  unpacked: string | null;
  /** The script itself; deleted after it runs. */
  script: string;
  /** Whether to open the app after the swap (or after a rollback). On for “restart and update”; off for install-on-quit, since the user is quitting. */
  relaunch: boolean;
}

/**
 * Swap script: wait for the app to quit → `ditto` to `.<name>.incoming` → remove the quarantine attribute → move the old bundle to `.<name>.previous` → put the new bundle in place
 * (rolling back on failure) → open the new app. When `relaunch` is false (install on quit), nothing is opened, on success or rollback. It refuses a target that is not a `.app`, whose parent is `/`,
 * or that is not an absolute path. All paths are single-quote escaped.
 */
export function installerScript(plan: InstallerPlan): { ok: true; script: string } | { ok: false; error: string } {
  const target = plan.target;
  const parent = path.dirname(target);
  const name = path.basename(target);
  if (!name || !name.toLowerCase().endsWith('.app') || parent === '/' || !parent || parent === target || !path.isAbsolute(target)) {
    return { ok: false, error: `unsafe replacement target: ${target}` };
  }
  const staging = path.join(parent, `.${name}.incoming`);
  const backup = path.join(parent, `.${name}.previous`);
  const detach = plan.mount !== null ? '/usr/bin/hdiutil detach "$MOUNT" -quiet 2>/dev/null\n' : '';
  const cleanup = plan.unpacked !== null ? '/bin/rm -rf "$UNPACKED" 2>/dev/null\n' : '';
  const reopen = plan.relaunch ? '/usr/bin/open "$TARGET"; ' : '';
  let vars =
    `PID=${Math.trunc(plan.pid)}\nNEW_APP=${shellQuote(plan.newApp)}\nTARGET=${shellQuote(target)}\nSTAGING=${shellQuote(staging)}\n` +
    `BACKUP=${shellQuote(backup)}\nARCHIVE=${shellQuote(plan.archive)}\nSELF=${shellQuote(plan.script)}\n`;
  if (plan.mount !== null) vars += `MOUNT=${shellQuote(plan.mount)}\n`;
  if (plan.unpacked !== null) vars += `UNPACKED=${shellQuote(plan.unpacked)}\n`;
  const script = `#!/bin/bash
set +e
${vars}for _ in $(seq 1 200); do kill -0 "$PID" 2>/dev/null || break; sleep 0.25; done
sleep 0.4
/bin/rm -rf "$STAGING"
if ! /usr/bin/ditto "$NEW_APP" "$STAGING"; then
  /bin/rm -rf "$STAGING"
  ${detach}${cleanup}  ${reopen}exit 1
fi
/usr/bin/xattr -dr com.apple.quarantine "$STAGING" 2>/dev/null
/bin/rm -rf "$BACKUP"
if ! /bin/mv "$TARGET" "$BACKUP"; then
  /bin/rm -rf "$STAGING"
  ${detach}${cleanup}  ${reopen}exit 1
fi
if /bin/mv "$STAGING" "$TARGET"; then
  /bin/rm -rf "$BACKUP"
else
  /bin/mv "$BACKUP" "$TARGET"
  ${detach}${cleanup}  ${reopen}exit 1
fi
${detach}${cleanup}/bin/rm -f "$ARCHIVE" 2>/dev/null
${plan.relaunch ? '/usr/bin/open "$TARGET"\n' : ''}/bin/rm -f "$SELF" 2>/dev/null
`;
  return { ok: true, script };
}
