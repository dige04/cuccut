import { describe, expect, it } from 'vitest';
import type { ExternalToolStatus, JobRecord, PipelineStepState } from '@cuccut/protocol';
import {
  downloadDirLabel,
  downloadProgress,
  isLinkImport,
  linkFrozen,
  linkHeading,
  linkIssue,
  linkMeta,
  linkProvenance,
  linkStages,
  linkSummary,
  linkTitle,
  rejectionCode,
  toolCard,
  toolReady,
} from './link-import.ts';

const step = (name: string, status: PipelineStepState['status'], extra: Partial<PipelineStepState> = {}): PipelineStepState => ({
  name,
  label: name,
  status,
  jobId: null,
  attempts: status === 'pending' ? 0 : 1,
  output: null,
  ...extra,
});

function job(patch: Partial<JobRecord> & { steps?: PipelineStepState[]; summary?: Record<string, unknown> | null } = {}): JobRecord {
  const { steps, summary, ...rest } = patch;
  return {
    jobId: 'job_1',
    kind: 'pipeline',
    state: 'running',
    phase: 'downloading',
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: '',
    providerId: 'yt-dlp',
    modelId: '2026.01.01',
    bundleId: null,
    inputHash: '',
    submitter: { kind: 'connection', id: 'app' },
    attempt: 1,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    startedAt: '2026-10-01T00:00:00Z',
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    pipeline: {
      name: 'link-import',
      params: { url: 'https://www.youtube.com/watch?v=abc', host: 'youtube.com', audioOnly: false, outDir: '/Users/me/p/downloads' },
      steps: steps ?? [step('resolve', 'completed'), step('download', 'running', { jobId: 'job_dl' }), step('verify', 'pending'), step('publish', 'pending')],
      current: 1,
      stoppedAt: null,
      summary: summary ?? null,
    },
    ...rest,
  };
}

const SUMMARY = {
  url: 'https://www.youtube.com/watch?v=abc',
  title: '访谈第一集',
  platform: 'youtube',
  uploader: 'me',
  durationSec: 300,
  files: { media: '/Users/me/p/downloads/访谈第一集.mp4', subtitles: [] },
  tool: { name: 'yt-dlp', version: '2026.01.01', source: 'managed' },
  downloadedAt: '2026-10-01T00:01:00Z',
  videoId: null,
  assetId: null,
  transcribeJobId: null,
};

describe('recognize and read', () => {
  it('recognizes only link-import parent tasks', () => {
    expect(isLinkImport(job())).toBe(true);
    expect(isLinkImport({ kind: 'pipeline', pipeline: { ...job().pipeline!, name: 'translate' } })).toBe(false);
    expect(isLinkImport({ kind: 'transcribe' })).toBe(false);
    expect(isLinkImport(null)).toBe(false);
  });

  it('frozen parameters and summary', () => {
    expect(linkFrozen(job())).toEqual({
      url: 'https://www.youtube.com/watch?v=abc',
      host: 'youtube.com',
      audioOnly: false,
      outDir: '/Users/me/p/downloads',
      videoId: null,
    });
    expect(linkSummary(job())).toBeNull();
    expect(linkSummary(job({ summary: SUMMARY }))?.files.media).toBe('/Users/me/p/downloads/访谈第一集.mp4');
    expect(linkSummary(job({ summary: { title: 'x' } }))).toBeNull();
    // Browser used: earlier versions did not have this item; an unrecognized value is treated as anonymous.
    expect(linkSummary(job({ summary: SUMMARY }))?.cookieBrowser).toBeNull();
    expect(linkSummary(job({ summary: { ...SUMMARY, cookieBrowser: 'edge' } }))?.cookieBrowser).toBe('edge');
    expect(linkSummary(job({ summary: { ...SUMMARY, cookieBrowser: 'netscape' } }))?.cookieBrowser).toBeNull();
  });

  it('title: the host name is written before parsing completes', () => {
    expect(linkTitle(job())).toBe('从链接导入 · youtube.com');
    const resolved = job({ steps: [step('resolve', 'completed', { output: { metadata: { title: '访谈', platform: 'youtube', durationSec: 12 } } })] });
    expect(linkMeta(resolved)).toEqual({ title: '访谈', platform: 'youtube', durationSec: 12 });
    expect(linkTitle(resolved)).toBe('从链接导入 · 访谈');
    expect(linkTitle(job({ summary: SUMMARY }))).toBe('从链接导入 · 访谈第一集');
  });
});

describe('source', () => {
  it('the source recorded for media when a video is created from Home has the same shape as when the flow imports it itself; when the summary has none, the parse step is used', () => {
    expect(linkProvenance(job())).toBeNull();
    const metadata = { title: '访谈', platform: 'youtube', webpageUrl: 'https://www.youtube.com/watch?v=abc', mediaId: 'abc', uploadDate: '20260930' };
    const done = job({ jobId: 'job_9', summary: SUMMARY, steps: [step('resolve', 'completed', { output: { metadata } })] });
    expect(linkProvenance(done)).toEqual({
      origin: 'link-import',
      source: {
        url: 'https://www.youtube.com/watch?v=abc',
        webpageUrl: 'https://www.youtube.com/watch?v=abc',
        platform: 'youtube',
        mediaId: 'abc',
        title: '访谈第一集',
        uploader: 'me',
        uploadDate: '20260930',
        durationSec: 300,
        tool: { name: 'yt-dlp', version: '2026.01.01', source: 'managed' },
        downloadedAt: '2026-10-01T00:01:00Z',
        jobId: 'job_9',
      },
    });
  });
});

describe('download progress', () => {
  it('reads the byte count of the download sub-task', () => {
    const child = { ...job(), jobId: 'job_dl', kind: 'pipeline-step', progress: { done: 1024 * 1024, total: 4 * 1024 * 1024, unit: 'bytes' } } as JobRecord;
    expect(downloadProgress(job(), [child])).toEqual({ pct: 25, text: '1.0 MB / 4.0 MB' });
    expect(downloadProgress(job(), [{ ...child, progress: { done: 2048, total: null, unit: 'bytes' } }])).toEqual({ pct: null, text: '已下载 2.0 KB' });
    expect(downloadProgress(job(), [])).toBeNull();
  });
});

describe('three steps', () => {
  const states = (j: JobRecord, follow: Parameters<typeof linkStages>[1]) => linkStages(j, follow).map((s) => s.state);

  it('downloading: step one in progress', () => {
    expect(states(job(), null)).toEqual(['current', 'pending', 'pending']);
  });

  it('download failed: step one fails, later steps do not move', () => {
    const failed = job({
      state: 'failed',
      steps: [step('resolve', 'completed'), step('download', 'failed'), step('verify', 'pending'), step('publish', 'pending')],
    });
    expect(states(failed, null)).toEqual(['failed', 'pending', 'pending']);
  });

  it('after the flow completes, video creation and transcription continue in the Home executor', () => {
    const done = job({ state: 'completed', steps: ['resolve', 'download', 'verify', 'publish'].map((n) => step(n, 'completed')), summary: SUMMARY });
    expect(states(done, { video: 'running', subs: 'pending' })).toEqual(['done', 'current', 'pending']);
    expect(states(done, { video: 'done', subs: 'running' })).toEqual(['done', 'done', 'current']);
    expect(states(done, { video: 'done', subs: 'skipped' })).toEqual(['done', 'done', 'skipped']);
    expect(states(done, { video: 'failed', subs: 'pending' })).toEqual(['done', 'failed', 'pending']);
    // No follow-up record (the app was restarted, or it was started elsewhere): wait for the user to create the video themselves.
    expect(states(done, null)).toEqual(['done', 'current', 'pending']);
  });

  it('import started with a videoId: import and transcription are the flow\'s own steps', () => {
    const own = job({
      state: 'running',
      steps: [...['resolve', 'download', 'verify', 'publish', 'import'].map((n) => step(n, 'completed')), step('transcribe', 'running')],
    });
    expect(states(own, null)).toEqual(['done', 'done', 'current']);
  });

  it('headline', () => {
    expect(linkHeading({ state: 'running' }, null)).toBe('把这条链接变成可编辑的视频');
    expect(linkHeading({ state: 'cancelled' }, null)).toBe('导入已停止');
    expect(linkHeading({ state: 'completed' }, { video: 'done', subs: 'running' })).toBe('视频已就绪，正在生成字幕');
    expect(linkHeading({ state: 'completed' }, { video: 'done', subs: 'done' })).toBe('字幕准备好了');
  });
});

describe('failure wording', () => {
  it('a recognized code gets a remedy button, with the download tool\'s original words', () => {
    const issue = linkIssue({ code: 'LINK_NETWORK_ERROR', message: 'x', details: { stderr: 'ERROR: timed out', remedy: 'r', step: 'download' } });
    expect(issue).toMatchObject({ title: '连接中断了', actions: ['retry', 'use-file'], diag: 'ERROR: timed out' });
    expect(linkIssue({ code: 'LINK_LOGIN_REQUIRED', message: 'x' })!.actions[0]).toBe('use-file');
    expect(linkIssue({ code: 'TOOL_CONSENT_REQUIRED', message: 'x' })!.actions).toEqual(['tools']);
    expect(linkIssue({ code: 'LINK_SOURCE_EXPIRED', message: 'x' })!.actions).toEqual(['restart']);
  });

  it('an unrecognized code is shown with its original words; an interruption without an error code also has wording; null when there is no error', () => {
    expect(linkIssue({ code: 'WHATEVER', message: '出错了', details: { remedy: '换个办法' } })).toMatchObject({
      title: '导入没有完成',
      body: '出错了。换个办法',
    });
    expect(linkIssue(null, 'interrupted')).toMatchObject({ code: 'INTERRUPTED', actions: ['retry'] });
    expect(linkIssue(null, 'completed')).toBeNull();
  });

  it('reads the code when submission is rejected', () => {
    expect(rejectionCode({ details: { code: 'TOOL_NOT_INSTALLED' } })).toBe('TOOL_NOT_INSTALLED');
    expect(rejectionCode(new Error('x'))).toBeNull();
  });
});

const tool = (patch: Partial<ExternalToolStatus> = {}): ExternalToolStatus => ({
  name: 'yt-dlp',
  label: 'yt-dlp',
  purpose: '从链接导入',
  state: 'missing',
  reason: '没有找到',
  path: null,
  version: null,
  source: null,
  minVersion: '2025.01.01',
  installable: true,
  offer: {
    version: '2026.01.01',
    fileName: 'yt-dlp_macos',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/yt-dlp_macos',
    sizeBytes: 35 * 1024 * 1024,
    estimatedBytes: 35 * 1024 * 1024,
    sha256: 'abc',
    license: 'Unlicense',
    homepage: 'https://github.com/yt-dlp/yt-dlp',
    blockedReason: null,
  },
  consentRequired: true,
  consent: null,
  managed: null,
  userPath: null,
  installJobId: null,
  update: null,
  updateJobId: null,
  platform: 'darwin',
  remedy: null,
  ...patch,
});

describe('download tool card', () => {
  const card = (status: ExternalToolStatus | null, o: Partial<{ checking: boolean; installing: boolean; updating: boolean }> = {}) =>
    toolCard(status, { checking: false, installing: false, ...o });

  it('checking, not registered', () => {
    expect(card(null, { checking: true }).state).toBe('checking');
    expect(card(null).state).toBe('unknown');
  });

  it('not installed: when downloadable, offers "Agree and install" with source, size and license', () => {
    const c = card(tool());
    expect(c).toMatchObject({ state: 'install', action: '同意并安装' });
    expect(c.facts[0]).toBe('版本 2026.01.01 · 约 35 MB');
    expect(c.facts[1]).toBe('从 github.com 下载 · Unlicense 许可');
  });

  it('manifest incomplete or platform unsupported: cannot install, states the reason', () => {
    const c = card(tool({ offer: { ...tool().offer!, blockedReason: '清单里没有这个平台的摘要。' } }));
    expect(c).toMatchObject({ state: 'blocked', action: null });
    expect(c.body).toContain('清单里没有这个平台的摘要');
  });

  it('installing', () => {
    expect(card(tool({ installJobId: 'job_i' })).state).toBe('installing');
    expect(card(tool(), { installing: true }).state).toBe('installing');
  });

  const brew = { method: 'homebrew' as const, argv: ['/opt/homebrew/bin/brew', 'upgrade', 'yt-dlp'], command: '/opt/homebrew/bin/brew upgrade yt-dlp', runnable: true, reason: null };

  it('version outdated: CucCut-downloaded copies can be updated; system-installed copies are updated by their original install method (when it can run on its own, points to the command below)', () => {
    expect(card(tool({ state: 'outdated', source: 'managed', version: '2024.01.01' }))).toMatchObject({ state: 'update', action: '同意并更新' });
    const system = card(tool({ state: 'outdated', source: 'system', version: '2024.01.01' }));
    expect(system).toMatchObject({ state: 'blocked', action: null });
    expect(system.body).toContain('按下面的说明在终端里更新');
    expect(card(tool({ state: 'outdated', source: 'system', version: '2024.01.01', update: brew })).body).toContain('可以用下面这条命令按原安装方式更新');
  });

  it('updating: the card says it is updating, facts unchanged', () => {
    const installed = tool({ state: 'installed', reason: null, path: '/opt/homebrew/bin/yt-dlp', version: '2026.01.01', source: 'system', update: brew });
    expect(card({ ...installed, updateJobId: 'job_u' })).toMatchObject({ state: 'updating', action: null });
    expect(card(installed, { updating: true }).facts).toEqual(['yt-dlp 2026.01.01 · 系统里装的 · Homebrew 安装', '/opt/homebrew/bin/yt-dlp']);
  });

  it('installed: consent required if not given; ready once consented', () => {
    const installed = tool({ state: 'installed', reason: null, path: '/opt/homebrew/bin/yt-dlp', version: '2026.01.01', source: 'system' });
    expect(card(installed)).toMatchObject({ state: 'consent', action: '同意使用' });
    expect(card(installed).facts).toEqual(['yt-dlp 2026.01.01 · 系统里装的', '/opt/homebrew/bin/yt-dlp']);
    expect(card({ ...installed, consent: { state: 'revoked', at: '', via: 'app' } }).title).toContain('撤回');
    const granted = { ...installed, consent: { state: 'granted' as const, at: '', via: 'app' as const } };
    expect(card(granted).state).toBe('ready');
    expect(toolReady(granted)).toBe(true);
    expect(toolReady(installed)).toBe(false);
    expect(toolReady(null)).toBe(false);
  });

  it('download location', () => {
    expect(downloadDirLabel('/Users/me/Downloads', '/Users/me/p')).toBe('~/Downloads');
    expect(downloadDirLabel(null, '/Users/me/p/')).toBe('~/Downloads');
    expect(downloadDirLabel(null, null)).toBe('~/Downloads');
  });
});
