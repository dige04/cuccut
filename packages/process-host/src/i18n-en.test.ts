import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import { ffmpegMissingRemedy, ffmpegMissingRemedyMessage } from './install-hint.ts';
import { WorkerTimeoutError } from './json-line-worker.ts';

/** When the interface language is English, the fix for missing ffmpeg and the Worker's errors are in English, with a message reference. */
describe('process-host English copy', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('the fix for missing ffmpeg follows the current language at call time', () => {
    expect(ffmpegMissingRemedy({ platform: 'darwin' })).toBe(
      'Install ffmpeg (for example, brew install ffmpeg), or set its path with CUCCUT_FFMPEG',
    );
    const message = ffmpegMissingRemedyMessage({ ffprobe: true, platform: 'win32' });
    expect(message.text).toContain('winget');
    expect(message.text).not.toMatch(/[一-龥]/);
    expect(message.key).toBe('processHostTools.remedyWithProbe');
  });

  it('Worker timeout: English explanation includes the reference', () => {
    const error = new WorkerTimeoutError('transcribe', 1500);
    expect(error.message).toBe('transcribe timed out (1500 ms)');
    expect(error.messageRef.key).toBe('processHostWorker.timedOut');
  });
});
