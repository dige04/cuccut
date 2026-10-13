import { describe, expect, it } from 'vitest';
import { RpcError, type JobRecord, type ModelBundleStatus, type ModelComponentStatus, type ModelInstallPlan } from '@cuccut/protocol';
import {
  bundleActions,
  canDownload,
  downloadableBundle,
  downloadView,
  inlineInstallMode,
  installFailure,
  installPlanView,
  installProgressView,
  modelProblem,
  removalBody,
  removalEstimate,
  removedToast,
  rpcProblem,
  separationDownload,
} from './models-install.ts';
import { installingPlacement, isBundleInstalled, localGroups } from './models-local.ts';
import { bundle } from './models-test-fixtures.ts';
import { fmtSize } from './task-facts.ts';

const MB = 1024 * 1024;
const GB = 1024 * MB;
const QWEN = 'qwen3-asr-0.6b@mlx-4bit';

function plan(patch: Partial<ModelInstallPlan> = {}): ModelInstallPlan {
  return {
    bundleId: QWEN,
    components: [
      { component: 'asr', repo: 'Qwen/Qwen3-ASR-0.6B', revision: 'abc', action: 'download', files: ['a', 'b'], bytes: 1.2 * GB },
      { component: 'vad', repo: 'silero/vad', revision: 'def', action: 'keep', files: [], bytes: null },
    ],
    downloadBytes: 1.2 * GB,
    estimatedBytes: 1.2 * GB,
    confirmBytes: 1.2 * GB,
    resumedBytes: 0,
    availableBytes: 20 * GB,
    source: 'https://huggingface.co',
    upToDate: false,
    ...patch,
  };
}

function component(repo: string, patch: Partial<ModelComponentStatus> = {}): ModelComponentStatus {
  return { component: 'asr', repo, revision: 'r', state: 'installed', bytes: 100 * MB, sharedWith: [], ...patch };
}

function job(patch: Partial<JobRecord>): JobRecord {
  return {
    jobId: 'job_1',
    kind: 'modelInstall',
    state: 'failed',
    phase: 'downloading',
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:0',
    providerId: 'local',
    modelId: QWEN,
    bundleId: QWEN,
    inputHash: 'sha256:0',
    submitter: { kind: 'app' },
    attempt: 1,
    createdAt: '2026-10-03T10:00:00.000Z',
    updatedAt: '2026-10-03T10:00:00.000Z',
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    ...patch,
  } as JobRecord;
}

describe('confirm dialog', () => {
  it('exact size, available space, source and each component', () => {
    const view = installPlanView(plan());
    expect(view.size).toBe('要下载 1.2 GB');
    expect(view.amount).toBe('1.2 GB');
    expect(view.space).toBe('磁盘可用 20.0 GB');
    expect(view.noSpace).toBeNull();
    expect(view.resumed).toBeNull();
    expect(view.source).toBe('https://huggingface.co');
    expect(view.lines.map((l) => l.value)).toEqual(['1.2 GB · 2 个文件', '已装好，不动']);
  });

  it('when size is unknown, say it is an estimate; state partial downloads that can be resumed', () => {
    const view = installPlanView(plan({ downloadBytes: null, resumedBytes: 300 * MB }));
    expect(view.size).toBe('约 1.2 GB（有文件大小未知，按登记的估计）');
    expect(view.amount).toBe('约 1.2 GB');
    expect(view.resumed).toBe('上次已经下载的 300 MB 接着用，不再重下。');
  });

  it('not enough disk: explain first, do not allow confirmation', () => {
    const view = installPlanView(plan({ availableBytes: 500 * MB }));
    expect(view.noSpace).toBe('磁盘空间不够：这次要 1.2 GB，模型目录所在的磁盘只剩 500 MB。先清理出空间再下载。');
  });

  it('when available space cannot be found, do not make it up', () => {
    const view = installPlanView(plan({ availableBytes: null }));
    expect(view.space).toBeNull();
    expect(view.noSpace).toBeNull();
  });
});

describe('progress', () => {
  it('give percentage when total is known; do not fabricate when unknown', () => {
    expect(installProgressView({ jobId: 'j', state: 'downloading', receivedBytes: 300 * MB, totalBytes: 1200 * MB })).toEqual({
      state: 'downloading',
      label: '正在下载 300 MB / 1.2 GB',
      percent: 25,
      running: true,
    });
    const unknown = installProgressView({ jobId: 'j', state: 'downloading', receivedBytes: 300 * MB, totalBytes: null });
    expect(unknown.percent).toBeNull();
    expect(unknown.label).toBe('正在下载 · 已收到 300 MB');
  });

  it('during queueing and verification the progress bar is indeterminate; can resume when paused', () => {
    expect(installProgressView({ jobId: 'j', state: 'queued', receivedBytes: 0, totalBytes: 10 })).toMatchObject({ percent: null, running: true });
    expect(installProgressView({ jobId: 'j', state: 'verifying', receivedBytes: 10, totalBytes: 10 })).toMatchObject({ percent: null, running: true });
    expect(installProgressView({ jobId: null, state: 'paused', receivedBytes: 300 * MB, totalBytes: 1200 * MB })).toEqual({
      state: 'paused',
      label: '已暂停 · 留着 300 MB / 1.2 GB，继续时接着下',
      percent: 25,
      running: false,
    });
  });
});

describe('failures and remedies', () => {
  it('disk full: state how much is needed and how much is left, and say downloaded parts will be kept', () => {
    const problem = modelProblem('MODEL_DOWNLOAD_NO_SPACE', '模型目录所在的磁盘空间不足', { requiredBytes: 2 * GB, availableBytes: 1 * GB });
    expect(problem.remedy).toBe('这次要 2.0 GB，只剩 1.0 GB。清理出磁盘空间后再下载；已经下载的部分会留着，下次接着下。');
  });

  it('RPC rejection is recognized by details.code; unrecognized uses the remedy given by Runtime, and if none, only the original words', () => {
    expect(rpcProblem(new RpcError('conflict', '严格离线模式下不下载模型', { code: 'OFFLINE_STRICT' })).remedy).toMatch(/严格离线/);
    expect(rpcProblem(new RpcError('conflict', '奇怪', { code: 'X', remedy: '这样办' }))).toEqual({ message: '奇怪', remedy: '这样办' });
    expect(rpcProblem(new Error('断了'))).toEqual({ message: '断了', remedy: null });
  });

  it('install task failed and not currently installing: give the reason; cancellation does not count', () => {
    const failed = job({ error: { code: 'MODEL_DOWNLOAD_NETWORK', message: '下载 a 失败：timeout' } });
    const idle = bundle(QWEN, { state: 'not-installed' });
    expect(installFailure(idle, [failed])?.message).toBe('下载 a 失败：timeout');
    expect(installFailure(idle, [job({ state: 'cancelled' })])).toBeNull();
    const again = bundle(QWEN, { state: 'downloading', install: { jobId: 'job_2', state: 'downloading', receivedBytes: 1, totalBytes: 2 } });
    expect(installFailure(again, [failed])).toBeNull();
  });

  it('remedy for a download source is named as on the settings page, not the settings key', () => {
    for (const code of ['MODEL_DOWNLOAD_NETWORK', 'MODEL_DOWNLOAD_INTEGRITY', 'MODEL_DOWNLOAD_SOURCE']) {
      const { remedy } = modelProblem(code, '下载失败', {});
      expect(remedy, code).toContain('「设置 › 通用」的「模型下载来源」');
      expect(remedy, code).not.toMatch(/models\.\w+/);
    }
  });
});

describe('deletion estimate', () => {
  it('components also used by other installed model packs are kept; the rest counts as freed space', () => {
    const target = bundle(QWEN, {
      components: [component('Qwen/Qwen3-ASR-0.6B'), component('silero/vad', { component: 'vad', sharedWith: ['b@mlx', 'c@mlx'] })],
    });
    const bundles = [target, bundle('b@mlx'), bundle('c@mlx', { state: 'not-installed' })];
    const estimate = removalEstimate(target, bundles);
    expect(estimate).toEqual({ frees: 100 * MB, kept: [{ repo: 'silero/vad', usedBy: ['b@mlx'] }] });
    expect(removalBody(estimate)).toBe('大约腾出 100 MB。silero/vad 还有 b@mlx 在用，保留。要再用时重新下载。');
  });

  it('when there is no component info, do not fabricate numbers', () => {
    expect(removalBody(removalEstimate(bundle(QWEN), [bundle(QWEN)]))).toBe('删掉这个模型包独有的文件。要再用时重新下载。');
  });

  it('after deletion, report per Runtime\'s result', () => {
    expect(removedToast(QWEN, { removed: ['a'], kept: [] })).toBe(`已删除 ${QWEN}`);
    expect(removedToast(QWEN, { removed: [], kept: [{ repo: 'silero/vad', usedBy: ['b@mlx'] }] })).toBe(
      `已删除 ${QWEN} · silero/vad 还有别的模型包在用，保留`,
    );
  });
});

describe('groups and what each row can do', () => {
  it('own files on disk means installed: those under repair and whose weights are present but missing components are; those downloading for the first time and those with only public components installed by others are downloadable', () => {
    const fresh = bundle('a@mlx', { state: 'downloading', components: [component('x', { state: 'missing', bytes: null })] });
    const repairing = bundle('b@mlx', { state: 'downloading', components: [component('y')] });
    const partial = bundle('c@mlx', { state: 'not-installed', reason: 'incomplete', components: [component('c'), component('z', { state: 'missing' })] });
    const unsupported = bundle('d@candle', { state: 'error', reason: 'unsupported', components: [component('w', { state: 'missing' })] });
    // y is a shared component installed by b; e's own v has not been downloaded yet.
    const borrowed = bundle('e@mlx', { state: 'not-installed', reason: 'incomplete', components: [component('y'), component('v', { state: 'missing' })] });
    const groups = localGroups([fresh, repairing, partial, unsupported, borrowed], 'asr');
    expect(groups.installed.map((b) => b.bundleId)).toEqual(['b@mlx', 'c@mlx']);
    expect(groups.available.map((b) => b.bundleId)).toEqual(['a@mlx', 'd@candle', 'e@mlx']);
    expect(isBundleInstalled(partial)).toBe(false);
    expect(isBundleInstalled(bundle('f@mlx', { state: 'downloading' }))).toBe(false);
  });

  it('rows being downloaded do not switch groups: placed by the remembered group, grouped by file after the download finishes', () => {
    const running = { jobId: 'j', state: 'downloading' as const, receivedBytes: 5, totalBytes: 10 };
    const start = bundle('a@mlx', { state: 'downloading', install: running, components: [component('w', { state: 'missing' }), component('v', { state: 'missing' })] });
    const placed = installingPlacement(localGroups([start], 'asr'));
    expect(placed).toEqual(new Map([['a@mlx', false]]));
    // Weights installed first: still downloadable, and the group does not jump while downloading.
    const midway = { ...start, components: [component('w'), component('v', { state: 'missing' })] };
    expect(localGroups([midway], 'asr').installed.map((b) => b.bundleId)).toEqual(['a@mlx']);
    expect(localGroups([midway], 'asr', placed).available.map((b) => b.bundleId)).toEqual(['a@mlx']);
    // Download finished: no longer looks at what was recorded.
    const done = bundle('a@mlx', { state: 'installed', components: [component('w'), component('v')] });
    expect(localGroups([done], 'asr', placed).installed.map((b) => b.bundleId)).toEqual(['a@mlx']);
    expect(installingPlacement(localGroups([done], 'asr', placed))).toEqual(new Map());
  });

  it('not installed: can download; paused: resume or discard; installing: can only stop', () => {
    expect(bundleActions(bundle(QWEN, { state: 'not-installed' }))).toMatchObject({ install: true, resume: false, remove: false });
    const paused = bundle(QWEN, { state: 'not-installed', install: { jobId: null, state: 'paused', receivedBytes: 5, totalBytes: 10 } });
    expect(bundleActions(paused)).toMatchObject({ install: false, resume: true, discard: true, stop: false });
    const running = bundle(QWEN, { state: 'downloading', install: { jobId: 'j', state: 'downloading', receivedBytes: 5, totalBytes: 10 } });
    expect(bundleActions(running)).toEqual({
      install: false,
      complete: false,
      resume: false,
      stop: true,
      discard: false,
      repair: false,
      remove: false,
    });
  });

  it('installed ones can be repaired and deleted; ones this computer does not support cannot be downloaded', () => {
    expect(bundleActions(bundle(QWEN, { state: 'ready' }))).toMatchObject({ repair: true, remove: true, install: false });
    expect(bundleActions(bundle(QWEN, { state: 'not-installed', reason: 'hash-mismatch', components: [component('x')] }))).toMatchObject({
      repair: true,
    });
    expect(bundleActions(bundle('d@candle', { state: 'error', reason: 'unsupported', components: [component('w', { state: 'missing' })] }))).toMatchObject({
      install: false,
      remove: false,
    });
  });

  it('installed with missing optional components: can complete (download only the missing), not counted as not installed; installing, paused, or unable to run do not offer completion', () => {
    const aligner = component('aufklarer/aligner', { component: 'aligner', optional: true, state: 'missing', bytes: null });
    const half = bundle(QWEN, { state: 'ready', components: [component('w'), aligner] });
    expect(isBundleInstalled(half)).toBe(true);
    expect(bundleActions(half)).toMatchObject({ complete: true, install: false, repair: true, remove: true });
    expect(bundleActions(bundle(QWEN, { state: 'ready', components: [component('w'), { ...aligner, state: 'installed' }] })).complete).toBe(false);
    const running = { ...half, install: { jobId: 'j', state: 'downloading' as const, receivedBytes: 5, totalBytes: 10 } };
    expect(bundleActions(running)).toMatchObject({ complete: false, stop: true });
    const paused = { ...half, install: { jobId: null, state: 'paused' as const, receivedBytes: 5, totalBytes: 10 } };
    expect(bundleActions(paused)).toMatchObject({ complete: false, resume: true });
    expect(bundleActions({ ...half, state: 'error', reason: 'worker-missing' }).complete).toBe(false);
    // A required component is missing: not installed properly, so it goes through “download”, not “fill in”
    const partial = bundle(QWEN, { state: 'not-installed', reason: 'incomplete', components: [component('w', { state: 'missing' }), aligner] });
    expect(bundleActions(partial)).toMatchObject({ complete: false, install: true });
  });

  it('weights present, missing public components (ownFiles): offer completion, not download; can repair and delete; only those with public components installed by others go to download and cannot be deleted', () => {
    const vad = component('silero/vad', { component: 'vad', state: 'missing', bytes: null });
    const half = bundle(QWEN, { state: 'not-installed', reason: 'incomplete', components: [component('w'), vad] });
    expect(bundleActions(half, true)).toEqual({
      install: false,
      complete: true,
      resume: false,
      stop: false,
      discard: false,
      repair: true,
      remove: true,
    });
    // Without ownFiles, it is treated as not installed.
    expect(bundleActions(half)).toMatchObject({ install: true, complete: false, repair: false, remove: false });
    // Models that cannot run are not offered fill-in or repair, but can still be deleted.
    expect(bundleActions({ ...half, state: 'error', reason: 'worker-missing' }, true)).toMatchObject({
      install: false,
      complete: false,
      repair: false,
      remove: true,
    });
    const borrowed = bundle(QWEN, { state: 'not-installed', reason: 'incomplete', components: [component('w', { state: 'missing' }), { ...vad, state: 'installed' }] });
    expect(bundleActions(borrowed, false)).toMatchObject({ install: true, complete: false, repair: false, remove: false });
  });
});

describe('download in place (tools page, transcription settings, dubbing\'s "Download {size}")', () => {
  const missing = (bundleId: string, patch: Partial<ModelBundleStatus> = {}) =>
    bundle(bundleId, {
      state: 'not-installed',
      components: [component('w', { state: 'missing', estimatedBytes: 1.2 * GB })],
      estimatedBytes: 1.2 * GB,
      ...patch,
    });
  const ready = (bundleId: string) => bundle(bundleId, { state: 'ready', components: [component('w')] });

  it('can download only when not properly installed and this computer can run it', () => {
    expect(canDownload(missing(QWEN))).toBe(true);
    expect(canDownload(ready(QWEN))).toBe(false);
    expect(canDownload(missing(QWEN, { state: 'error', reason: 'unsupported' }))).toBe(false);
    expect(canDownload(missing(QWEN, { state: 'error', reason: 'worker-missing' }))).toBe(false);
  });

  it('recognizes only local models, finds the model pack by model ID; cloud, installed, or not found are null', () => {
    const bundles = [missing(QWEN), ready('kokoro-82m')];
    expect(downloadableBundle(bundles, { providerId: 'local', modelId: QWEN })?.bundleId).toBe(QWEN);
    expect(downloadableBundle(bundles, { providerId: 'openai', modelId: QWEN })).toBeNull();
    expect(downloadableBundle(bundles, { providerId: 'local', modelId: 'kokoro-82m' })).toBeNull();
    expect(downloadableBundle(bundles, { providerId: 'local', modelId: 'gone' })).toBeNull();
    expect(downloadableBundle(bundles, null)).toBeNull();
  });

  it('separated model: picks the first downloadable by ID (same order as Runtime\'s choice of separation default); null when none is downloadable', () => {
    const sep = (bundleId: string, patch: Partial<ModelBundleStatus> = {}) => missing(bundleId, { capability: 'separate', ...patch });
    const list = [missing(QWEN), sep('z@mlx'), sep('a@candle', { state: 'error', reason: 'unsupported' }), sep('b@mlx')];
    expect(separationDownload(list)?.bundleId).toBe('b@mlx');
    expect(separationDownload([missing(QWEN), sep('a@candle', { state: 'error', reason: 'unsupported' })])).toBeNull();
  });

  it('download appearance: size uses the download task\'s total first, then computes from missing components; shows percentage while downloading, paused when halfway', () => {
    expect(downloadView(missing(QWEN))).toEqual({ state: 'idle', size: fmtSize(1.2 * GB), percent: null });
    // Weights present, only shared components missing: writes only the missing item (the same figure as “fill in {size}” on the settings page), not an estimate for the whole model.
    const vad = component('silero/vad', { component: 'vad', state: 'missing', bytes: null, estimatedBytes: 30 * MB });
    const half = missing(QWEN, { components: [component('w', { estimatedBytes: 1.2 * GB }), vad], estimatedBytes: 1.2 * GB + 30 * MB });
    expect(downloadView(half).size).toBe(fmtSize(30 * MB));
    // If a missing component has an unknown size, nothing is written (the settings page does not write it either), and the estimate for the whole model is not used instead.
    const unsized = missing(QWEN, { components: [component('w', { estimatedBytes: 1.2 * GB }), { ...vad, estimatedBytes: null }] });
    expect(downloadView(unsized).size).toBeNull();
    // Old snapshots without component information are estimated from the bundled manifest; when neither is available, nothing is written.
    const { components: _c, ...legacy } = missing(QWEN);
    expect(downloadView(legacy).size).toBe(fmtSize(1.2 * GB));
    const { estimatedBytes: _e, ...unknown } = legacy;
    expect(downloadView(unknown)).toEqual({ state: 'idle', size: null, percent: null });
    const running = missing(QWEN, { install: { jobId: 'j', state: 'downloading', receivedBytes: 0.6 * GB, totalBytes: 2 * GB } });
    expect(downloadView(running)).toEqual({ state: 'running', size: fmtSize(2 * GB), percent: 30 });
    const queued = missing(QWEN, { install: { jobId: 'j', state: 'queued', receivedBytes: 0, totalBytes: null } });
    expect(downloadView(queued)).toEqual({ state: 'running', size: fmtSize(1.2 * GB), percent: null });
    const paused = missing(QWEN, { install: { jobId: null, state: 'paused', receivedBytes: 5, totalBytes: 10 } });
    expect(downloadView(paused).state).toBe('paused');
  });

  it('when weights are already present, in-place download takes completion (same judgment as the settings page): borrows only public components installed by others, and when nothing, goes to download', () => {
    const vad = (state: 'installed' | 'missing') => component('silero/vad', { component: 'vad', state });
    const half = missing('a@mlx', { reason: 'incomplete', components: [component('a'), vad('missing')] });
    const fresh = missing('b@mlx', { components: [component('b', { state: 'missing' }), vad('missing')] });
    const bundles = [half, fresh];
    expect(canDownload(half)).toBe(true);
    expect(inlineInstallMode(half, bundles)).toBe('complete');
    expect(inlineInstallMode(fresh, bundles)).toBe('install');
    // The shared component was installed by another model: its own weights are not present, so it is still a download (license must be asked).
    const borrowed = missing('b@mlx', { components: [component('b', { state: 'missing' }), vad('installed')] });
    expect(inlineInstallMode(borrowed, [borrowed, { ...half, components: [component('a'), vad('installed')] }])).toBe('install');
    // Download stopped halfway with the weights already landed: continuing is also a fill-in (the settings page's “continue download” likewise goes by fill-in).
    const paused = { ...half, install: { jobId: null, state: 'paused' as const, receivedBytes: 5, totalBytes: 10 } };
    expect(inlineInstallMode(paused, [paused, fresh])).toBe('complete');
  });
});
