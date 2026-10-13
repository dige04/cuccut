import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFakeYtDlp, type FakeYtDlp } from '../testing/fake-tools.ts';
import {
  ProgressTracker,
  classifyFailure,
  cookieAttemptsFailure,
  downloadArgs,
  parseMetadata,
  parseProgressLine,
  resolveArgs,
  runYtDlp,
  sanitizeFileName,
  worthAnotherCookieBrowser,
} from './yt-dlp.ts';

/** yt-dlp arguments, progress, failure classification and file names (architecture design §7.9). The process runs only the fake yt-dlp from the tests. */

describe('arguments', () => {
  it('uses only the explicitly chosen browser; resolve and download arguments match', () => {
    expect(resolveArgs('https://example.com/v')).not.toContain('--cookies-from-browser');
    for (const args of [resolveArgs('https://example.com/v', 'firefox'), downloadArgs('https://example.com/v', { output: '/tmp/media.%(ext)s', audioOnly: false, subtitleLanguages: [], cookieBrowser: 'firefox' })]) {
      expect(args[args.indexOf('--cookies-from-browser') + 1]).toBe('firefox');
    }
    expect(() => resolveArgs('https://example.com/v', '--exec=id' as never)).toThrow();
  });
  it('the URL comes after -- and last; always skips reading config and loading plugins', () => {
    const url = '--exec=touch /tmp/pwned';
    for (const args of [
      resolveArgs(url),
      downloadArgs(url, {
        output: '/s/dl/media.%(ext)s',
        audioOnly: false,
        subtitleLanguages: ['en', 'zh-Hans'],
        ffmpegLocation: '/ff/ffmpeg',
      }),
    ]) {
      expect(args.at(-1)).toBe(url);
      expect(args.at(-2)).toBe('--');
      expect(args.indexOf('--')).toBe(args.length - 2);
      expect(args).toEqual(expect.arrayContaining(['--ignore-config', '--no-plugin-dirs', '--no-playlist']));
    }
    const download = downloadArgs('https://v.example.com/a', { output: '/s/dl/media.%(ext)s', audioOnly: true, subtitleLanguages: [] });
    expect(download[download.indexOf('-f') + 1]).toBe('ba[ext=m4a]/ba/b');
    expect(download).not.toContain('--merge-output-format');
    expect(download).toContain('--check-formats');
    expect(download).not.toContain('--write-subs');
    expect(download[download.indexOf('-o') + 1]).toBe('/s/dl/media.%(ext)s');
  });

  it('defaults to MP4: prefers MP4 video and M4A audio merged into MP4, falling back to the best available format', () => {
    const args = downloadArgs('https://v.example.com/a', { output: '/s/dl/media.%(ext)s', audioOnly: false, subtitleLanguages: [] });
    expect(args[args.indexOf('-f') + 1]).toBe('bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b');
    expect(args[args.indexOf('--merge-output-format') + 1]).toBe('mp4/webm/mkv');
  });

  it('progress lines match only their own prefix; progress accumulates across streams and is not reported when the total is unknown', () => {
    expect(parseProgressLine('ccut-progress 100 1000 NA')).toEqual({ downloaded: 100, total: 1000 });
    expect(parseProgressLine('ccut-progress 100 NA 2000.5')).toEqual({ downloaded: 100, total: 2001 });
    expect(parseProgressLine('ccut-progress 100 NA NA')).toEqual({ downloaded: 100, total: null });
    expect(parseProgressLine('[download]  50.0% of 10MiB')).toBeNull();
    const tracker = new ProgressTracker();
    expect(tracker.update({ downloaded: 500, total: 1000 })).toEqual({ done: 500, total: 1000 });
    expect(tracker.update({ downloaded: 1000, total: 1000 })).toEqual({ done: 1000, total: 1000 });
    expect(tracker.update({ downloaded: 10, total: null })).toEqual({ done: 1010, total: null });
    expect(tracker.update({ downloaded: 20, total: 200 })).toEqual({ done: 1020, total: 1200 });
  });

  it('failures are classified from the error output; URLs in error details are redacted', () => {
    const cases: Array<[string, string]> = [
      ['ERROR: [youtube] x: Sign in to confirm you are not a bot', 'LINK_LOGIN_REQUIRED'],
      ['ERROR: [youtube] x: Private video', 'LINK_LOGIN_REQUIRED'],
      ['ERROR: Unsupported URL: https://v.example.com/x', 'LINK_UNSUPPORTED'],
      ['ERROR: [x] y: Video unavailable', 'LINK_UNAVAILABLE'],
      ['ERROR: unable to download video data: <urlopen error timed out>', 'LINK_NETWORK_ERROR'],
      ['ERROR: unable to write data: [Errno 28] No space left on device', 'LINK_DISK_FULL'],
      ['ERROR: could not copy Chrome cookie database', 'LINK_COOKIES_UNAVAILABLE'],
      [`ERROR: [Errno 1] Operation not permitted: '/Users/a/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies'`, 'LINK_COOKIES_UNAVAILABLE'],
      ['ERROR: nsig extraction failed', 'LINK_TOOL_UPDATE_REQUIRED'],
      ['ERROR: HTTP Error 403: Forbidden', 'LINK_DOWNLOAD_FAILED'],
      ['ERROR: unable to download video data: HTTP Error 403: Forbidden', 'LINK_DOWNLOAD_FAILED'],
      ['ERROR: HTTP Error 403: Sign in to confirm your age', 'LINK_LOGIN_REQUIRED'],
      ["WARNING: Your yt-dlp version (2026.07.04) is older than 90 days!\nERROR: unable to download video data: HTTP Error 403: Forbidden", 'LINK_TOOL_UPDATE_REQUIRED'],
      ["WARNING: Your yt-dlp version (2026.07.04) is older than 90 days!\nERROR: HTTP Error 403: Sign in to confirm you are not a bot", 'LINK_LOGIN_REQUIRED'],
      ['ERROR: something else', 'LINK_DOWNLOAD_FAILED'],
    ];
    for (const [stderr, code] of cases) expect(classifyFailure(stderr, 1).code, stderr).toBe(code);
    const failure = classifyFailure('ERROR: unable to download https://cdn.example.com/v.mp4?sig=secret-token timed out', 1);
    expect(JSON.stringify(failure.details)).not.toContain('secret-token');
    expect(failure.message).not.toContain('secret-token');
  });

  it('only cookie-read failures and login-required errors are worth switching browsers; when none succeed, reports based on whether login was required, including each browser\'s result', () => {
    const cookies = classifyFailure('ERROR: could not copy Chrome cookie database', 1);
    const login = classifyFailure('ERROR: [youtube] x: Sign in to confirm you are not a bot', 1);
    expect([cookies, login].every(worthAnotherCookieBrowser)).toBe(true);
    for (const stderr of ['ERROR: unable to download video data: <urlopen error timed out>', 'ERROR: unable to write data: [Errno 28] No space left on device', 'ERROR: Unsupported URL: https://v.example.com/x', 'ERROR: nsig extraction failed']) {
      expect(worthAnotherCookieBrowser(classifyFailure(stderr, 1)), stderr).toBe(false);
    }
    expect(cookieAttemptsFailure([{ browser: 'chrome', error: cookies }])).toBe(cookies);
    const both = cookieAttemptsFailure([{ browser: 'chrome', error: cookies }, { browser: 'safari', error: login }]);
    expect(both).toMatchObject({ code: 'LINK_LOGIN_REQUIRED', message: '试了 2 个浏览器的 Cookie 都没成功（Chrome：读不到 Cookie；Safari：网站仍要求登录）' });
    expect(both.details).toMatchObject({ attempts: [{ browser: 'chrome', code: 'LINK_COOKIES_UNAVAILABLE' }, { browser: 'safari', code: 'LINK_LOGIN_REQUIRED' }] });
    expect(cookieAttemptsFailure([{ browser: 'chrome', error: cookies }, { browser: 'edge', error: cookies }]).code).toBe('LINK_COOKIES_UNAVAILABLE');
  });

  it('file names: strip paths and reserved characters, do not start with a dot or -; spaces and single quotes are kept', () => {
    expect(sanitizeFileName(`-rf "Fake clip": one/two  it's <ok>`)).toBe(`rf Fake clip one two it's ok`);
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc passwd');
    expect(sanitizeFileName('a\u0000b\nc')).toBe('a b c');
    expect(sanitizeFileName('...')).toBe('download');
    expect(sanitizeFileName(null)).toBe('download');
    expect([...sanitizeFileName('长'.repeat(300))]).toHaveLength(120);
  });

  it('metadata: playlists and live streams are rejected', () => {
    expect(parseMetadata(JSON.stringify({ id: 'a', title: ' T ', duration: 3, extractor_key: 'Generic' }))).toMatchObject({
      title: 'T',
      mediaId: 'a',
      durationSec: 3,
      platform: 'Generic',
    });
    expect(() => parseMetadata(JSON.stringify({ _type: 'playlist' }))).toThrow(expect.objectContaining({ code: 'LINK_UNSUPPORTED' }));
    expect(() => parseMetadata(JSON.stringify({ is_live: true }))).toThrow(expect.objectContaining({ code: 'LINK_UNSUPPORTED' }));
    expect(() => parseMetadata('not json')).toThrow(expect.objectContaining({ code: 'LINK_DOWNLOAD_FAILED' }));
  });

  it('metadata: description is trimmed to at most 20000 characters; null when there is no description and no chapters', () => {
    const bare = parseMetadata(JSON.stringify({ id: 'a', title: 'T', description: '   ', chapters: [] }));
    expect(bare).toMatchObject({ description: null, chapters: null });
    expect(parseMetadata(JSON.stringify({ id: 'a' }))).toMatchObject({ description: null, chapters: null });
    const long = parseMetadata(JSON.stringify({ id: 'a', description: `  ${'字'.repeat(25_000)}  ` }));
    expect([...long.description!]).toHaveLength(20_000);
    expect(parseMetadata(JSON.stringify({ id: 'a', description: ' Line one\n0:00 Intro \n' })).description).toBe('Line one\n0:00 Intro');
  });

  it('metadata: platform chapters drop non-finite or negative start times and empty titles, sort by start, dedupe equal starts, and truncate titles to 160 characters', () => {
    const meta = parseMetadata(
      JSON.stringify({
        id: 'a',
        chapters: [
          { start_time: 120, end_time: 300, title: 'Second' },
          { start_time: 0, end_time: 120, title: '  Intro\n part  ' },
          { start_time: -5, title: 'Negative' },
          { start_time: 'x', title: 'Not a number' },
          { end_time: 10, title: 'No start' },
          { start_time: 120, title: 'Duplicate' },
          { start_time: 200, end_time: 150, title: 'Backwards end' },
          { start_time: 250, title: '' },
          null,
          { start_time: 400, title: '长'.repeat(200) },
        ],
      }),
    );
    expect(meta.chapters).toEqual([
      { start: 0, end: 120, title: 'Intro part' },
      { start: 120, end: 300, title: 'Second' },
      { start: 200, title: 'Backwards end' },
      { start: 400, title: '长'.repeat(160) },
    ]);
    const many = parseMetadata(
      JSON.stringify({ id: 'a', chapters: Array.from({ length: 450 }, (_, i) => ({ start_time: i, title: `C${i}` })) }),
    );
    expect(many.chapters).toHaveLength(400);
    expect(parseMetadata(JSON.stringify({ id: 'a', chapters: [{ start_time: 1, title: ' ' }] })).chapters).toBeNull();
  });
});

describe('execution (fake yt-dlp)', () => {
  let dir: string;
  let fake: FakeYtDlp;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-ytdlp-'));
    fake = await writeFakeYtDlp(path.join(dir, 'bin'));
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('arguments are passed to the process unchanged (no shell), and a URL starting with - is not treated as an option', async () => {
    const signal = new AbortController().signal;
    const run = await runYtDlp(
      { ...fake.nodeTool, env: { ...fake.nodeTool.env, PATH: path.join(dir, 'empty') } },
      resolveArgs('https://v.example.com/a b"c'),
      {
        signal,
        keepStdout: true,
      },
    );
    expect(run.code).toBe(0);
    expect(JSON.parse(run.stdout).webpage_url).toBe('https://v.example.com/a b"c');
    const calls = await fake.calls();
    expect(calls.at(-1)!.argv!.at(-1)).toBe('https://v.example.com/a b"c');
  });

  it('a missing executable is TOOL_NOT_INSTALLED', async () => {
    await expect(
      runYtDlp({ command: path.join(dir, 'missing', 'yt-dlp') }, ['--version'], { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: 'TOOL_NOT_INSTALLED' });
  });

  it('Windows: abort ends the whole process tree with taskkill /T /F (the ffmpeg used for merging is ended too)', async () => {
    const calls: { command: string; args: readonly string[]; options: SpawnOptions }[] = [];
    const child = Object.assign(new EventEmitter(), { pid: 91, stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true }) as unknown as ChildProcess;
    const spawnFn = (command: string, args: readonly string[], options: SpawnOptions) => {
      calls.push({ command, args, options });
      if (calls.length === 1) return child;
      setTimeout(() => child.emit('close', 1, null), 1);
      return new EventEmitter() as ChildProcess;
    };
    const controller = new AbortController();
    const running = runYtDlp({ command: 'C:\\tools\\yt-dlp.exe' }, ['--version'], { signal: controller.signal, platform: 'win32', spawn: spawnFn });
    controller.abort();
    await expect(running).rejects.toBeDefined();
    expect(calls[0]!.options.detached).toBe(false);
    expect(calls[1]!.command).toMatch(/[\\/]System32[\\/]taskkill\.exe$/);
    expect(calls[1]!.args).toEqual(['/PID', '91', '/T', '/F']);
  });
});
