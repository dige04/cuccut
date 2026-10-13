import { describe, expect, it } from 'vitest';
import { refOf, type ExternalToolStatus, type ExternalToolUpdatePlan } from '@cuccut/protocol';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';
import { exitCodeText, hasUpdateSection, manualUpdateCommands, updateBefore, updateLog, updateSectionCopy, updateSummary } from './tool-update.ts';

/** Update a downloaded tool using its original install method (product design §2.7): whether there is an "Update" section, its copy, the output box text, and the one-line result after finishing. */

const brew: ExternalToolUpdatePlan = {
  method: 'homebrew',
  argv: ['/opt/homebrew/bin/brew', 'upgrade', 'yt-dlp'],
  command: '/opt/homebrew/bin/brew upgrade yt-dlp',
  runnable: true,
  reason: null,
};

const status = (patch: Partial<ExternalToolStatus> = {}): ExternalToolStatus => ({
  name: 'yt-dlp',
  label: 'yt-dlp',
  purpose: '',
  state: 'installed',
  reason: null,
  path: '/opt/homebrew/bin/yt-dlp',
  version: '2026.07.04',
  source: 'system',
  minVersion: null,
  installable: true,
  offer: null,
  consentRequired: true,
  consent: null,
  managed: null,
  userPath: null,
  installJobId: null,
  update: brew,
  updateJobId: null,
  platform: 'darwin',
  remedy: null,
  ...patch,
});

describe('「更新」一节', () => {
  it('系统里、你指定的那一份有；CucCut 下载的副本、没装的、正在安装的没有；正在更新时总有', () => {
    expect(hasUpdateSection(status())).toBe(true);
    expect(hasUpdateSection(status({ source: 'user', update: null }))).toBe(true);
    expect(hasUpdateSection(status({ source: 'managed', update: null }))).toBe(false);
    expect(hasUpdateSection(status({ state: 'missing', path: null, version: null, source: null, update: null }))).toBe(false);
    expect(hasUpdateSection(status({ installJobId: 'job_i' }))).toBe(false);
    expect(hasUpdateSection(status({ state: 'unavailable', version: null, update: null }))).toBe(false);
    expect(hasUpdateSection(status({ source: 'managed', update: null, updateJobId: 'job_u' }))).toBe(true);
    expect(hasUpdateSection(null)).toBe(false);
  });

  it('能代为执行的写安装方式；不能的说原因与下一步，不重复「执行这条命令」', () => {
    expect(updateSectionCopy(brew)).toEqual({ label: '用 Homebrew 更新', hint: null });
    expect(updateSectionCopy({ ...brew, method: 'standalone' }).label).toBe('用 官方独立程序 更新');
    const admin = updateSectionCopy({ ...brew, method: 'standalone', runnable: false, reason: '这份 yt-dlp 所在的 /usr/local/bin 要管理员权限才能改写，CucCut 不替你提权。' });
    expect(admin.label).toBe('在终端里更新');
    expect(admin.hint).toBe('这份 yt-dlp 所在的 /usr/local/bin 要管理员权限才能改写，CucCut 不替你提权。在终端里执行这条命令，完成后点「重新检测」。');
    // When the Runtime's reason (with its reference) already says how to run it, don't repeat it; regenerate the reason in the reader's language.
    const reason = RcExternalTools.chocolateyAdmin();
    const win = updateSectionCopy({ ...brew, runnable: false, reason: 'stale text', reasonRef: refOf(reason) });
    expect(win.hint).toBe(`${reason.text}完成后点「重新检测」。`);
    // The default reason's “cannot run this command on your behalf” isn't about how to run it, so still add “run it in a terminal”.
    expect(updateSectionCopy({ ...brew, runnable: false, reason: null }).hint).toBe('CucCut 不能代为执行这条命令。在终端里执行这条命令，完成后点「重新检测」。');
    expect(updateSectionCopy({ ...brew, method: 'winget' }).label).toBe('用 winget 更新');
    expect(updateSectionCopy({ ...brew, method: 'scoop' }).label).toBe('用 Scoop 更新');
    expect(updateSectionCopy(null).hint).toMatch(/判断不了.*重新检测/);
  });

  it('判断不了安装方式时按 Runtime 所在主机列常用命令', () => {
    expect(manualUpdateCommands('darwin').map((m) => m.label)).toEqual(['Homebrew', 'pip', '官方独立程序']);
    expect(manualUpdateCommands('linux')).toEqual(manualUpdateCommands('darwin'));
    expect(manualUpdateCommands(null)).toEqual(manualUpdateCommands('darwin'));
    expect(manualUpdateCommands('win32').map((m) => m.command)).toEqual([
      'winget upgrade yt-dlp.yt-dlp',
      'scoop update yt-dlp',
      'py -m pip install -U "yt-dlp[default]"',
      'yt-dlp -U',
    ]);
  });
});

describe('更新的结果', () => {
  const base = { exitCode: 0, error: null, before: '2026.07.04', after: '2026.09.30' };

  it('成功：版本变了说更新到哪个版本，没变说已是最新', () => {
    expect(updateSummary({ ...base, state: 'completed' })).toEqual({ tone: 'positive', title: '已更新到 2026.09.30', body: null });
    expect(updateSummary({ ...base, state: 'completed', after: '2026.07.04' })).toEqual({ tone: 'neutral', title: '已是最新版本 2026.07.04', body: null });
    expect(updateSummary({ ...base, state: 'completed', before: null, after: null }).title).toBe('已是最新版本');
  });

  it('失败说退出码；没有退出码时说任务的错误；停止的不猜结果', () => {
    const failed = updateSummary({ ...base, state: 'failed', exitCode: 1 });
    expect(failed).toMatchObject({ tone: 'negative', title: '更新没有完成（退出码 1）' });
    expect(failed.body).toMatch(/^原来的 yt-dlp 不受影响/);
    const timeout = updateSummary({ ...base, state: 'failed', exitCode: null, error: '更新命令超过 15 分钟没有结束，已经停止' });
    expect(timeout.title).toBe('更新没有完成');
    expect(timeout.body).toMatch(/^更新命令超过 15 分钟没有结束，已经停止。原来的/);
    expect(updateSummary({ ...base, state: 'cancelled', exitCode: null })).toMatchObject({ tone: 'notice', title: '已停止更新' });
  });

  it('输出框：结束后补退出码或「已停止」，截掉过前面时先说一句，还没有输出时是省略号', () => {
    const cmd = { line: brew.command, output: '==> Upgrading\nyt-dlp 2026.07.04 -> 2026.09.30\n', lines: 2, truncated: false, exitCode: null };
    expect(updateLog(cmd, 'running', true)).toBe('==> Upgrading\nyt-dlp 2026.07.04 -> 2026.09.30');
    expect(updateLog({ ...cmd, exitCode: 0 }, 'completed', false)).toBe('==> Upgrading\nyt-dlp 2026.07.04 -> 2026.09.30\n（退出码 0）');
    expect(updateLog(cmd, 'cancelled', false)).toMatch(/\n（已停止）$/);
    expect(updateLog({ ...cmd, truncated: true }, 'running', true)).toMatch(/^…（前面的输出已省略/);
    expect(updateLog(null, null, true)).toBe('…');
    expect(updateLog({ ...cmd, output: '', exitCode: 127 }, 'failed', false)).toBe('（退出码 127）');
    // winget has no version to upgrade to: the Runtime counts it as success, and the exit code is written in hex.
    expect(updateLog({ ...cmd, output: 'No available upgrade found.\n', exitCode: 0x8a15002b }, 'completed', false)).toBe('No available upgrade found.\n（退出码 0x8A15002B）');
  });

  it('退出码：Windows 的 HRESULT 一类按十六进制写，负数按无符号数看', () => {
    expect(exitCodeText(0)).toBe('0');
    expect(exitCodeText(255)).toBe('255');
    expect(exitCodeText(2316632107)).toBe('0x8A15002B');
    expect(exitCodeText(-1978335189)).toBe('0x8A15002B');
    expect(updateSummary({ state: 'failed', exitCode: 0x8a150014, error: null, before: null, after: null }).title).toBe('更新没有完成（退出码 0x8A150014）');
  });

  it('更新前的版本：点执行时记下的优先，否则读任务记录', () => {
    expect(updateBefore('2026.07.04', { modelId: '2026.01.01' })).toBe('2026.07.04');
    expect(updateBefore(null, { modelId: '2026.01.01' })).toBe('2026.01.01');
    expect(updateBefore(null, { modelId: 'unknown' })).toBeNull();
    expect(updateBefore(null, null)).toBeNull();
  });
});
