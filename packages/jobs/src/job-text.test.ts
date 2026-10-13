import { RpcError, formatRef, localizeText, setLocale } from '@cuccut/protocol';
import { JobsManager } from '@cuccut/protocol/messages/jobs/job-manager.ts';
import { JobsResourceScheduler } from '@cuccut/protocol/messages/jobs/resource-scheduler.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorText, jobError, jobWarning, joinList, withCause } from './job-text.ts';
import { DIMENSION_LABELS, ResourceExceedsCapacity } from './resource-scheduler.ts';
import { TOOL_CATALOGUE } from './tool-catalogue.ts';

/** Switches to Chinese in the middle of the test: `CUCCUT_LOCALE` takes precedence over `setLocale`; both are switched together. */
function toChinese(): void {
  vi.stubEnv('CUCCUT_LOCALE', 'zh-Hans');
  setLocale('zh-Hans');
}

describe('multilingual task text', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('task errors are generated in the current language, with a reference so the UI can switch language', () => {
    const error = jobError('JOB_INTERRUPTED', JobsManager.interrupted());
    expect(error.message).toBe("The task didn't finish before Runtime stopped; you can submit it again");
    expect(error.messageRef?.key).toBe('jobsManager.interrupted');
    expect(formatRef(error.messageRef!, error.message, 'zh-Hans')).toBe('Runtime 停止时任务没有完成；可以重新提交');
  });

  it('a \'explanation: cause\' nested cause reference: the whole sentence switches together when the language changes', () => {
    const cause = new RpcError('not-found', JobsManager.videoNotOpen());
    const message = withCause(JobsManager.requeueCheckFailed(), cause);
    expect(message.text).toBe("The check before re-queuing failed: The video isn't open");
    const error = jobError('STALE_JOB_INPUT', message);
    expect(formatRef(error.messageRef!, error.message, 'zh-Hans')).toBe('重新排队之前的校验没有通过：视频没有打开');
    // Third-party original text is not quoted: embedded as is.
    expect(String(withCause(JobsManager.requeueCheckFailed(), new Error('ENOENT')))).toBe('The check before re-queuing failed: ENOENT');
  });

  it('warning detail carries detailRef', () => {
    const warning = jobWarning('output-truncated', JobsManager.outputTruncated({ limit: 512 }));
    expect(warning.detail).toBe('The output hit the limit (512 tokens) and was cut off; the content is incomplete');
    expect(localizeText(warning.detail, warning.detailRef)).toBe(warning.detail);
    toChinese();
    expect(localizeText(warning.detail, warning.detailRef)).toBe('输出到了上限（512 token）被截断，内容不完整');
  });

  it('resource scheduling rejection and waiting explanations', () => {
    const exceeded = new ResourceExceedsCapacity([
      { dimension: 'memory', demand: 2, limit: 1 },
      { dimension: 'gpuMemory', demand: 2, limit: 1 },
    ]);
    expect(exceeded.message).toBe('This needs more memory, GPU memory than this machine can provide');
    expect(String(errorText(exceeded))).toBe(exceeded.message);
    expect(formatRef(exceeded.messageRef!, exceeded.message, 'zh-Hans')).toBe('需要的内存、GPU 内存超过了这台机器能给的量');
    expect(DIMENSION_LABELS.scratchDisk).toBe('disk space');
    expect(JobsResourceScheduler.queuedBehind({ ahead: 1 }).text).toBe('Queued: 1 task ahead in the same queue');
  });

  it('tool catalog names and descriptions are generated in the current language when read', () => {
    const transcribe = TOOL_CATALOGUE.find((tool) => tool.id === 'transcribe')!;
    expect(transcribe.label).toBe('Transcribe');
    toChinese();
    expect(transcribe.label).toBe('转录');
  });

  it('list separators follow the language', () => {
    expect(joinList(['a', 'b'])).toBe('a, b');
    toChinese();
    expect(joinList(['a', 'b'])).toBe('a、b');
  });
});
