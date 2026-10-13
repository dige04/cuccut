import { spawn, type ChildProcess } from 'node:child_process';
import { killProcessTree, type SpawnProcess } from '@cuccut/process-host';
import { LINK_COOKIE_BROWSERS, type LinkCookieBrowser, type Localized } from '@cuccut/protocol';
import { JobsYtDlp } from '@cuccut/protocol/messages/jobs/yt-dlp.ts';
import type { JobText } from '../job-text.ts';
import { COOKIE_BROWSER_LABELS } from './cookie-browsers.ts';
import { PipelineStepError } from './pipeline.ts';
import { redactUrlsInText } from './link-url.ts';

/**
 * Parsing and downloading with yt-dlp (architecture design §7.9, §12.9).
 *
 * - Arguments are always an array and do not go through a shell. The link goes after `--`, so it is never taken as an option.
 * - Always passes `--ignore-config` (does not read the user's config file, where `--exec` could be written), `--no-plugin-dirs` (does not load plugins), `--no-cache-dir`, and `--no-playlist`. The output template is fixed inside staging, and the file name is not taken from the web page.
 * - Progress uses only the byte counts the tool itself reports (`--progress-template`). When the total is unknown, no total is reported.
 * - On abort, SIGTERM is sent to the whole process group, then SIGKILL after a grace period (yt-dlp starts ffmpeg child processes when merging). It returns only after the process has exited.
 *   On Windows there are no process groups: the whole process tree is ended with taskkill /T /F (the PyInstaller-packaged yt-dlp.exe also spawns child processes itself).
 */

const KILL_GRACE_MS = 2000;
const STDERR_TAIL = 6000;
const STDOUT_LIMIT = 64 * 1024 * 1024;

/** Prefix of a progress line. The template fields are, in order, downloaded, total, and estimated total (`NA` when unknown). */
export const PROGRESS_PREFIX = 'ccut-progress';
const PROGRESS_TEMPLATE = `download:${PROGRESS_PREFIX} %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s`;

const COMMON_ARGS = ['--ignore-config', '--no-plugin-dirs', '--no-cache-dir', '--no-playlist', '--no-colors'];

export interface YtDlpTool {
  command: string;
  /** Fixed arguments when running a script through an interpreter. Likewise not through a shell. */
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
}

export const COOKIE_BROWSERS = LINK_COOKIE_BROWSERS;
export type CookieBrowser = LinkCookieBrowser;
function cookieArgs(browser?: CookieBrowser): string[] {
  if (!browser) return [];
  if (!COOKIE_BROWSERS.includes(browser)) throw new Error(`Unsupported cookie browser: ${browser}`);
  return ['--cookies-from-browser', browser];
}

/** Resolves a link: fetches only the metadata (a single JSON), without downloading. */
export function resolveArgs(url: string, browser?: CookieBrowser): string[] {
  return [...COMMON_ARGS, ...cookieArgs(browser), '--dump-single-json', '--skip-download', '--', url];
}

export interface DownloadOptions {
  cookieBrowser?: CookieBrowser;
  /** Output template (absolute path inside staging, with `%(ext)s`). */
  output: string;
  audioOnly: boolean;
  subtitleLanguages: readonly string[];
  /** When given, this ffmpeg is used to merge audio and video. */
  ffmpegLocation?: string | null;
}

/** Downloads the media (and optional subtitles). */
export function downloadArgs(url: string, options: DownloadOptions): string[] {
  // Metadata can advertise CDN formats that are no longer downloadable. Let yt-dlp reject them before selecting a stream.
  const args = [...COMMON_ARGS, ...cookieArgs(options.cookieBrowser), '--check-formats', '--newline', '--progress-template', PROGRESS_TEMPLATE, '--no-mtime', '-o', options.output];
  // Defaults to MP4: video and audio prefer MP4 / M4A streams, merged into MP4 so the browser and Electron can play them directly without converting first. When the site has none, falls back to the best format of any kind;
  // when merging, codecs MP4 cannot hold (such as VP9 + Opus) go into WebM, and failing that, into MKV.
  args.push('-f', options.audioOnly ? 'ba[ext=m4a]/ba/b' : 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b');
  if (!options.audioOnly) args.push('--merge-output-format', 'mp4/webm/mkv');
  if (options.ffmpegLocation) args.push('--ffmpeg-location', options.ffmpegLocation);
  if (options.subtitleLanguages.length > 0) args.push('--write-subs', '--sub-langs', options.subtitleLanguages.join(','));
  args.push('--', url);
  return args;
}

/** One progress line: downloaded bytes and total (null when the total is unknown). null when the line is not a progress line. */
export function parseProgressLine(line: string): { downloaded: number; total: number | null } | null {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== PROGRESS_PREFIX || parts.length < 4) return null;
  const num = (s: string | undefined) => {
    const n = Number(s);
    return s !== undefined && s !== 'NA' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const downloaded = num(parts[1]);
  if (downloaded === null) return null;
  return { downloaded, total: num(parts[2]) ?? num(parts[3]) };
}

/**
 * Byte progress accumulated across streams. yt-dlp downloads video and audio separately, and each stream's count starts from 0. When a stream finishes, its byte count is added to the base. The total is given only when the current stream's total is known (base plus the current stream's total); it does not guess in advance how much remains.
 */
export class ProgressTracker {
  #base = 0;
  #current = 0;

  update(sample: { downloaded: number; total: number | null }): { done: number; total: number | null } {
    if (sample.downloaded < this.#current) this.#base += this.#current;
    this.#current = sample.downloaded;
    return {
      done: this.#base + this.#current,
      total: sample.total === null ? null : this.#base + Math.max(sample.total, sample.downloaded),
    };
  }
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs yt-dlp once. `onLine` receives standard output line by line (during download; while parsing, the whole output is collected at once). */
export async function runYtDlp(
  tool: YtDlpTool,
  args: string[],
  options: {
    signal: AbortSignal;
    onLine?: (line: string) => void;
    keepStdout?: boolean;
    /** Injected for tests. */
    platform?: NodeJS.Platform;
    spawn?: SpawnProcess;
  },
): Promise<RunResult> {
  const { signal } = options;
  signal.throwIfAborted();
  const platform = options.platform ?? process.platform;
  const run = options.spawn ?? spawn;
  return await new Promise<RunResult>((resolve, reject) => {
    const child: ChildProcess = run(tool.command, [...(tool.args ?? []), ...args], {
      env: tool.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: platform !== 'win32',
      windowsHide: true,
    });
    let stdout = '';
    let pending = '';
    let stderr = '';
    let killTimer: NodeJS.Timeout | null = null;
    const kill = (sig: NodeJS.Signals) => killProcessTree(child, sig, { platform, spawn: run });
    const onAbort = () => {
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), KILL_GRACE_MS);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    child.stdout!.setEncoding('utf8');
    child.stderr!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      if (options.keepStdout && stdout.length < STDOUT_LIMIT) stdout += chunk;
      if (!options.onLine) return;
      pending += chunk;
      const lines = pending.split(/\r?\n|\r/);
      pending = lines.pop() ?? '';
      for (const line of lines) options.onLine(line);
    });
    child.stderr!.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-STDERR_TAIL);
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      signal.removeEventListener('abort', onAbort);
      if (error.code === 'ENOENT' || error.code === 'EACCES') {
        reject(new PipelineStepError('TOOL_NOT_INSTALLED', JobsYtDlp.toolNotFound({ code: error.code }), { tool: 'yt-dlp' }));
      } else reject(error);
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (killTimer) clearTimeout(killTimer);
      if (pending && options.onLine) options.onLine(pending);
      if (signal.aborted) reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
      else resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Failure kinds and the remedy shown to people (command and protocol spec §11.3), recorded in the error's `details.remedy` as text generated in the current language (`details` has no reference field).
 * undefined for unrecognized kinds.
 */
export function linkFailureRemedy(code: string): string | undefined {
  const remedies: Record<string, () => Localized> = {
    LINK_UNSUPPORTED: JobsYtDlp.remedyUnsupported,
    LINK_LOGIN_REQUIRED: JobsYtDlp.remedyLoginRequired,
    LINK_COOKIES_UNAVAILABLE: JobsYtDlp.remedyCookiesUnavailable,
    LINK_TOOL_UPDATE_REQUIRED: JobsYtDlp.remedyToolUpdateRequired,
    LINK_UNAVAILABLE: JobsYtDlp.remedyUnavailable,
    LINK_NETWORK_ERROR: JobsYtDlp.remedyNetworkError,
    LINK_DISK_FULL: JobsYtDlp.remedyDiskFull,
    LINK_DOWNLOAD_FAILED: JobsYtDlp.remedyDownloadFailed,
  };
  return remedies[code]?.().text;
}

/** Classifies the failure from yt-dlp's error (the end of standard error). Links are always redacted in errors. */
export function classifyFailure(stderr: string, exitCode: number | null): PipelineStepError {
  const text = redactUrlsInText(stderr).trim();
  const errorLine =
    text
      .split('\n')
      .filter((l) => l.startsWith('ERROR:'))
      .at(-1) ??
    text.split('\n').at(-1) ??
    '';
  const code = (() => {
    if (/No space left on device|Errno 28|ENOSPC|disk quota/i.test(text)) return 'LINK_DISK_FULL';
    if (/could not (copy|find).*cookie|failed to decrypt|cookie.*database|keyring|safe storage|keychain|(operation not permitted|permission denied).*cookies/i.test(text)) {
      return 'LINK_COOKIES_UNAVAILABLE';
    }
    if (/update.*yt-dlp|yt-dlp.*outdated|signature extraction failed|nsig extraction failed|Unable to extract/i.test(errorLine)) return 'LINK_TOOL_UPDATE_REQUIRED';
    if (/Unsupported URL|is not a valid URL|no suitable extractor/i.test(errorLine)) return 'LINK_UNSUPPORTED';
    // Old extractors often hit a CDN 403 after reading the metadata. When the tool clearly reports that it is outdated, update first, and do not mislead the user into handing over browser cookies.
    if (
      /Your yt-dlp version .+ is older than \d+ days|yt-dlp.*outdated/i.test(text) &&
      /HTTP Error 403|403: Forbidden/i.test(errorLine) &&
      !/sign in|log ?in|login required|cookies|members[- ]only|private video|confirm your age|age[- ]restricted|not a bot|authentication/i.test(errorLine)
    ) return 'LINK_TOOL_UPDATE_REQUIRED';
    if (
      /HTTP Error 401|sign in|log ?in|login required|cookies|members[- ]only|private video|confirm your age|age[- ]restricted|not a bot|authentication/i.test(
        errorLine,
      )
    ) {
      return 'LINK_LOGIN_REQUIRED';
    }
    // A CDN 403 alone does not establish that authentication is required.
    if (/HTTP Error 403|403: Forbidden/i.test(errorLine)) return 'LINK_DOWNLOAD_FAILED';
    if (
      /not available in your (country|region)|geo|video unavailable|has been removed|Requested format is not available|no video formats/i.test(
        errorLine,
      )
    ) {
      return 'LINK_UNAVAILABLE';
    }
    if (
      /unable to download|HTTP Error 5\d\d|HTTP Error 429|timed? ?out|connection|getaddrinfo|name or service not known|nodename nor servname|temporary failure in name resolution|network is unreachable|SSL|EOF occurred|Unable to connect/i.test(
        errorLine,
      )
    ) {
      return 'LINK_NETWORK_ERROR';
    }
    return 'LINK_DOWNLOAD_FAILED';
  })();
  // Use the tool's own words as they are. When there are none, state the exit code.
  const message: JobText = errorLine.replace(/^ERROR:\s*/, '').slice(0, 300) || JobsYtDlp.exited({ code: exitCode });
  return new PipelineStepError(code, message, { exitCode, stderr: text.slice(-1000), remedy: linkFailureRemedy(code) });
}

/** Failures for which trying the next browser's cookies may help: this browser's cookies cannot be read, or the site still requires login. Other failures are the same whichever browser is tried. */
export function worthAnotherCookieBrowser(error: PipelineStepError): boolean {
  return error.code === 'LINK_COOKIES_UNAVAILABLE' || error.code === 'LINK_LOGIN_REQUIRED';
}

/**
 * Every browser tried failed (each time with `worthAnotherCookieBrowser`). If any of them failed because the site required login, report it as a login requirement (the cookies were read, but the user was not logged in). Otherwise report that the cookies could not be read. `details.attempts` holds each browser's result. When only one browser was tried, report that failure as it was.
 */
export function cookieAttemptsFailure(attempts: ReadonlyArray<{ browser: CookieBrowser; error: PipelineStepError }>): PipelineStepError {
  const last = attempts.at(-1)!.error;
  if (attempts.length === 1) return last;
  const code = attempts.some((a) => a.error.code === 'LINK_LOGIN_REQUIRED') ? 'LINK_LOGIN_REQUIRED' : 'LINK_COOKIES_UNAVAILABLE';
  const reason = (a: { browser: CookieBrowser; error: PipelineStepError }) =>
    (a.error.code === 'LINK_LOGIN_REQUIRED' ? JobsYtDlp.cookieLoginRequired : JobsYtDlp.cookieUnreadable)({ browser: COOKIE_BROWSER_LABELS[a.browser] }).text;
  const reasons = attempts.map(reason).join(JobsYtDlp.reasonSeparator().text);
  return new PipelineStepError(code, JobsYtDlp.cookieAttemptsFailed({ count: attempts.length, reasons }), {
    ...last.details,
    attempts: attempts.map((a) => ({ browser: a.browser, code: a.error.code, message: a.error.message })),
    remedy: linkFailureRemedy(code),
  });
}

/**
 * File name for publishing: removes control characters and path and reserved characters (`/ \ : * ? " < > |`), does not start with a dot, collapses whitespace, and is at most 120 characters. When nothing remains, uses `download`. Spaces and single quotes are kept (arguments do not go through a shell).
 */
export function sanitizeFileName(title: string | null | undefined): string {
  const cleaned = [...(title ?? '')]
    .map((ch) => (/[\u0000-\u001f\u007f/\\:*?"<>|]/.test(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s-]+/, '')
    .replace(/[.\s]+$/, '');
  const limited = [...cleaned].slice(0, 120).join('').trim();
  return limited || 'download';
}

/** The parts of the parsed metadata that the pipeline uses (any of them may be missing). */
export interface LinkMetadata {
  title: string | null;
  platform: string | null;
  mediaId: string | null;
  uploader: string | null;
  uploadDate: string | null;
  durationSec: number | null;
  webpageUrl: string | null;
  /** Video description (trimmed, at most 20000 characters): background for polishing and speaker identification. When the video has no chapters of its own, a timestamp outline is parsed from it. Earlier versions did not have this field. */
  description: string | null;
  /** Chapters provided by the platform (`chapters[]` in the info JSON, source time in seconds): sorted by start, duplicates with the same start removed, at most 400 entries. null when there are none. Earlier versions did not have this field. */
  chapters: LinkChapter[] | null;
}

/** One chapter provided by the platform: the author's title and start (seconds). Includes `end` when the platform provides one. */
export interface LinkChapter {
  start: number;
  end?: number;
  title: string;
}

/** Maximum number of characters kept from the description. */
const MAX_DESCRIPTION_CHARS = 20_000;
/** Maximum number of chapters kept and maximum title length (the same as `source_chapters` in the subtitle and translation core). */
const MAX_CHAPTERS = 400;
const MAX_CHAPTER_TITLE_CHARS = 160;

/** Truncates by character (code point), without splitting a surrogate pair. */
function clipChars(text: string, max: number): string {
  return text.length <= max ? text : [...text].slice(0, max).join('');
}

/** `chapters[]` of the info JSON: drops entries whose start is not a finite non-negative number or whose title is empty. The end is omitted when it is not later than the start. */
export function parseChapters(raw: unknown): LinkChapter[] | null {
  if (!Array.isArray(raw)) return null;
  const chapters: LinkChapter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { start_time: start, end_time: end, title } = item as Record<string, unknown>;
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) continue;
    const text = typeof title === 'string' ? clipChars(title.replace(/\s+/g, ' ').trim(), MAX_CHAPTER_TITLE_CHARS).trim() : '';
    if (!text) continue;
    chapters.push({ start, ...(typeof end === 'number' && Number.isFinite(end) && end > start ? { end } : {}), title: text });
  }
  chapters.sort((a, b) => a.start - b.start);
  const unique = chapters.filter((chapter, index) => index === 0 || chapter.start !== chapters[index - 1]!.start).slice(0, MAX_CHAPTERS);
  return unique.length > 0 ? unique : null;
}

/** Reads the output of `--dump-single-json`. When it is not a single video (a playlist or a live stream), throws `LINK_UNSUPPORTED`. */
export function parseMetadata(stdout: string): LinkMetadata {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    throw new PipelineStepError('LINK_DOWNLOAD_FAILED', JobsYtDlp.metadataUnreadable(), { remedy: linkFailureRemedy('LINK_DOWNLOAD_FAILED') });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new PipelineStepError('LINK_DOWNLOAD_FAILED', JobsYtDlp.metadataNotObject(), {
      remedy: linkFailureRemedy('LINK_DOWNLOAD_FAILED'),
    });
  }
  if (data._type === 'playlist' || data._type === 'multi_video') {
    throw new PipelineStepError('LINK_UNSUPPORTED', JobsYtDlp.playlist(), {
      remedy: linkFailureRemedy('LINK_UNSUPPORTED'),
    });
  }
  if (data.is_live === true || data.live_status === 'is_live' || data.live_status === 'is_upcoming') {
    throw new PipelineStepError('LINK_UNSUPPORTED', JobsYtDlp.live(), { remedy: linkFailureRemedy('LINK_UNSUPPORTED') });
  }
  const str = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const duration = typeof data.duration === 'number' && Number.isFinite(data.duration) && data.duration >= 0 ? data.duration : null;
  return {
    title: str(data.title),
    platform: str(data.extractor_key, 100) ?? str(data.extractor, 100),
    mediaId: str(data.id, 200),
    uploader: str(data.uploader, 200) ?? str(data.channel, 200),
    uploadDate: str(data.upload_date, 20),
    durationSec: duration,
    webpageUrl: str(data.webpage_url, 2000),
    description:
      typeof data.description === 'string' && data.description.trim() ? clipChars(data.description.trim(), MAX_DESCRIPTION_CHARS) : null,
    chapters: parseChapters(data.chapters),
  };
}
