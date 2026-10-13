import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadedFontFace, FontFamilyStatus, FontsUsageResult } from '@cuccut/protocol';
import { job } from '../testing/task-records.ts';
import {
  chooseFamily,
  exportUsageKey,
  loadCatalogue,
  openVideoFonts,
  refreshExportUsage,
  requestSample,
  skipCurrent,
  startFontLibrarySync,
  useFontLibrary,
  useFontRecent,
} from './font-library-store.ts';
import { useJobs } from './jobs-store.ts';

// Node has no usable localStorage: give the "recently used" persistence an in-memory version, loaded before the store module.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
});

const status = (family: string, patch: Partial<FontFamilyStatus> = {}): FontFamilyStatus => ({
  family,
  state: 'downloadable',
  category: 'display',
  subsets: ['latin'],
  scripts: ['latin'],
  weights: [400],
  italics: [],
  variable: false,
  licence: 'OFL-1.1',
  source: 'google-fonts',
  downloaded: [],
  job: null,
  error: null,
  ...patch,
});

/** Fake Runtime: records requests and replies by method. */
function fakeClient(handlers: Record<string, (params: Record<string, unknown>) => unknown>) {
  const calls: [string, Record<string, unknown>][] = [];
  return {
    calls,
    request: (async (method: string, params: Record<string, unknown>) => {
      calls.push([method, params]);
      const handler = handlers[method];
      if (!handler) throw new Error(`没有 ${method}`);
      return handler(params);
    }) as never,
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  useFontLibrary.setState({
    statuses: {},
    order: [],
    loaded: false,
    usage: {},
    exportUsage: {},
    batch: null,
    samples: {},
    downloaded: null,
  });
  useFontRecent.setState({ recent: [] });
  useJobs.setState({ ready: true, jobs: [] });
});

describe('font library state', () => {
  it('the whole table is fetched by page, in the Runtime\'s order; not fetched again once fetched', async () => {
    const all = Array.from({ length: 1200 }, (_, i) => status(`Family ${i}`));
    const client = fakeClient({
      'fonts.catalogue': (p) => ({
        total: all.length,
        families: all.slice(p.offset as number, (p.offset as number) + (p.limit as number)),
        catalogueDate: '2026-10-04',
      }),
    });
    await loadCatalogue(client);
    await loadCatalogue(client);
    expect(client.calls.map(([, p]) => p.offset)).toEqual([0, 500, 1000]);
    const state = useFontLibrary.getState();
    expect(state.order).toHaveLength(1200);
    expect(state.order[0]).toBe('family 0');
    expect(state.statuses['family 1199']!.family).toBe('Family 1199');
  });

  it('selecting a family not yet downloaded starts the download and records it in recently used; ones already present are not downloaded', async () => {
    useFontLibrary.setState({
      statuses: { lobster: status('Lobster'), inter: status('Inter', { state: 'built-in', source: 'built-in' }) },
      order: ['inter', 'lobster'],
    });
    const client = fakeClient({
      'fonts.download': () => ({
        family: 'Lobster',
        faces: [],
        jobId: 'job_1',
        status: status('Lobster', { state: 'downloading', job: { jobId: 'job_1', doneBytes: 0, totalBytes: null } }),
      }),
    });
    expect(await chooseFamily(client, 'Inter')).toBeNull();
    expect(await chooseFamily(client, 'Lobster')).toMatchObject({ state: 'downloading' });
    expect(client.calls).toEqual([['fonts.download', { family: 'Lobster' }]]);
    expect(useFontRecent.getState().recent).toEqual(['Lobster', 'Inter']);
  });

  it('opening a video: inventory and download per settings, the font bar records the batch to download; skipping the current one cancels its task', async () => {
    const usage: FontsUsageResult = {
      fallback: 'Noto Sans SC',
      started: ['Lobster'],
      families: [
        {
          family: 'Inter',
          faces: [{ weight: 400, italic: false }],
          status: status('Inter', { state: 'built-in', source: 'built-in' }),
          fallback: null,
        },
        {
          family: 'Lobster',
          faces: [{ weight: 400, italic: false }],
          status: status('Lobster', { state: 'downloading', job: { jobId: 'job_1', doneBytes: 0, totalBytes: null } }),
          fallback: 'Noto Sans SC',
        },
      ],
    };
    const client = fakeClient({
      'fonts.usage': () => usage,
      'jobs.cancel': () => ({ state: 'cancelled' }),
      'fonts.catalogue': () => ({
        total: 1,
        families: [status('Lobster', { state: 'failed', error: { code: 'CANCELLED', message: '下载已取消', at: '' } })],
        catalogueDate: '',
      }),
    });
    await openVideoFonts(client, 'v1', true);
    expect(client.calls[0]).toEqual(['fonts.usage', { videoId: 'v1', download: true }]);
    expect(useFontLibrary.getState().batch).toEqual({ videoId: 'v1', families: ['Lobster'], mode: 'auto', skipped: [], dismissed: false });
    useJobs.setState({ jobs: [job({ jobId: 'job_1', kind: 'fontDownload', modelId: 'Lobster', phase: 'downloading' })] });
    await skipCurrent(client);
    expect(client.calls.slice(1, 3)).toEqual([
      ['jobs.cancel', { jobId: 'job_1' }],
      ['fonts.catalogue', { families: ['Lobster'] }],
    ]);
    expect(useFontLibrary.getState().batch!.skipped).toEqual(['Lobster']);
    expect(useFontLibrary.getState().statuses['lobster']!.error!.code).toBe('CANCELLED');
  });

  it('when a download task finishes, refetch the status per family', async () => {
    const client = fakeClient({
      'fonts.catalogue': () => ({ total: 1, families: [status('Lobster', { state: 'downloaded' })], catalogueDate: '' }),
    });
    useJobs.setState({ jobs: [job({ jobId: 'job_1', kind: 'fontDownload', modelId: 'Lobster', phase: 'downloading' })] });
    const stop = startFontLibrarySync(client);
    useJobs.setState({
      jobs: [job({ jobId: 'job_1', kind: 'fontDownload', modelId: 'Lobster', state: 'completed', endedAt: '2026-10-04T00:00:00Z' })],
    });
    await settle();
    stop();
    expect(client.calls).toEqual([['fonts.catalogue', { families: ['Lobster'] }]]);
    expect(useFontLibrary.getState().statuses['lobster']!.state).toBe('downloaded');
  });

  it('when export leaves the download stage, refetch the families it is using (export\'s own downloads have no fontDownload task)', async () => {
    const client = fakeClient({
      'fonts.catalogue': () => ({ total: 1, families: [status('Long Cang', { state: 'downloaded' })], catalogueDate: '' }),
    });
    useFontLibrary.setState({
      statuses: {
        'long cang': status('Long Cang', { state: 'downloading', job: { jobId: 'job_e', doneBytes: 10, totalBytes: 10 } }),
        lobster: status('Lobster', { state: 'downloading', job: { jobId: 'job_other', doneBytes: 1, totalBytes: 10 } }),
      },
    });
    useJobs.setState({ jobs: [job({ jobId: 'job_e', kind: 'export', phase: 'downloading' })] });
    const stop = startFontLibrarySync(client);
    useJobs.setState({ jobs: [job({ jobId: 'job_e', kind: 'export', phase: 'encoding' })] });
    await settle();
    stop();
    expect(client.calls).toEqual([['fonts.catalogue', { families: ['Long Cang'] }]]);
    expect(useFontLibrary.getState().statuses['long cang']!.state).toBe('downloaded');
  });

  it('the downloaded list is refetched when export starts and ends (fonts pinned by export are marked \'in use by export\' and released when it ends)', async () => {
    const lobster: DownloadedFontFace = {
      family: 'Lobster',
      weight: 400,
      italic: false,
      licence: 'OFL-1.1',
      sha256: 'a'.repeat(64),
      sizeBytes: 10,
      downloadedAt: '2026-10-04T00:00:00Z',
    };
    let inUse: string[] = [];
    const client = fakeClient({ 'fonts.downloaded': () => ({ faces: [lobster], totalBytes: 10, inUse }) });
    useFontLibrary.setState({ downloaded: { faces: [lobster], totalBytes: 10, inUse: [] } });
    const stop = startFontLibrarySync(client);
    // Not refetched on mount (the settings page fetched it itself). Changes to other tasks do not refetch.
    useJobs.setState({ jobs: [job({ jobId: 'job_t', kind: 'transcribe' })] });
    await settle();
    expect(client.calls).toEqual([]);
    inUse = ['Lobster'];
    useJobs.setState({ jobs: [job({ jobId: 'job_e', kind: 'export', state: 'queued', phase: 'queued' })] });
    await settle();
    expect(useFontLibrary.getState().downloaded!.inUse).toEqual(['Lobster']);
    // The same export moving on (queued → generating) does not refetch.
    useJobs.setState({ jobs: [job({ jobId: 'job_e', kind: 'export', phase: 'generating' })] });
    await settle();
    expect(client.calls).toHaveLength(1);
    inUse = [];
    useJobs.setState({ jobs: [job({ jobId: 'job_e', kind: 'export', state: 'cancelled', endedAt: '2026-10-04T00:01:00Z' })] });
    await settle();
    stop();
    expect(client.calls).toEqual([
      ['fonts.downloaded', {}],
      ['fonts.downloaded', {}],
    ]);
    expect(useFontLibrary.getState().downloaded!.inUse).toEqual([]);
  });

  it('the export panel\'s inventory includes \'burn in subtitles\': when not burning, families used only by subtitles are not in the list; each keeps its own record, late responses do not cross over, the whole-video inventory is unchanged', async () => {
    const used = (family: string): FontsUsageResult['families'][number] => ({
      family,
      faces: [{ weight: 400, italic: false }],
      status: status(family),
      fallback: 'Noto Sans SC',
    });
    const whole: FontsUsageResult = { families: [used('Lobster'), used('Ma Shan Zheng')], fallback: 'Noto Sans SC', started: [] };
    // Subtitles use Ma Shan Zheng, text uses Lobster. Responses arrive in reverse request order: the one requested first (burn) arrives last.
    const replies: (() => void)[] = [];
    const client = fakeClient({
      'fonts.usage': (p) =>
        new Promise((resolve) => replies.push(() => resolve(p.burnCaptions === false ? { ...whole, families: [used('Lobster')] } : whole))),
    });
    useFontLibrary.setState({ usage: { v1: whole } });
    const burn = refreshExportUsage(client, 'v1', true);
    const plain = refreshExportUsage(client, 'v1', false);
    replies[1]!();
    await plain;
    replies[0]!();
    await burn;
    expect(client.calls).toEqual([
      ['fonts.usage', { videoId: 'v1', burnCaptions: true }],
      ['fonts.usage', { videoId: 'v1', burnCaptions: false }],
    ]);
    const { exportUsage, usage } = useFontLibrary.getState();
    expect(exportUsage[exportUsageKey('v1', false)]!.families.map((f) => f.family)).toEqual(['Lobster']);
    expect(exportUsage[exportUsageKey('v1', true)]!.families.map((f) => f.family)).toEqual(['Lobster', 'Ma Shan Zheng']);
    expect(usage['v1']).toBe(whole);
  });

  it('specimen: local fonts use their own, catalog ones are subset into the font table, and if not obtainable it is plain text', async () => {
    useFontLibrary.setState({
      statuses: {
        lobster: status('Lobster'),
        'pingfang sc': status('PingFang SC', { state: 'installed', source: 'local', category: null }),
        nowhere: status('Nowhere', { state: 'unavailable', source: 'local', category: null }),
        'offline font': status('Offline Font'),
      },
    });
    const registered: [string, number][] = [];
    const client = fakeClient({
      'fonts.sample': (p) =>
        p.family === 'Lobster'
          ? { family: 'Lobster', text: 'Lobster', data: Buffer.from('font').toString('base64'), format: 'truetype' }
          : { family: p.family, text: '', data: null, format: null, reason: 'offline-strict' },
    });
    const register = async (name: string, bytes: ArrayBuffer) => void registered.push([name, bytes.byteLength]);
    await Promise.all(['Lobster', 'PingFang SC', 'Nowhere', 'Offline Font'].map((f) => requestSample(client, f, register)));
    expect(useFontLibrary.getState().samples).toEqual({
      lobster: { state: 'ready', css: '"cc-sample-lobster"' },
      'pingfang sc': { state: 'ready', css: '"PingFang SC"' },
      nowhere: { state: 'none' },
      'offline font': { state: 'none' },
    });
    expect(registered).toEqual([['cc-sample-lobster', 4]]);
    expect(client.calls.map(([, p]) => p.family)).toEqual(['Lobster', 'Offline Font']);
  });
});
