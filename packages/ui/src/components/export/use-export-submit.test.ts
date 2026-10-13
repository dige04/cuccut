import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportSettings } from '@cuccut/protocol';
import { useExportSubmit, type ExportEnv } from './use-export-submit.ts';

const mocks = vi.hoisted(() => ({
  pickSavePath: vi.fn(), pickDirectory: vi.fn(), createExport: vi.fn(), negative: vi.fn(),
}));
// Tests the submit entry point directly; rendering of state is outside the scope of this group of tests.
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (value: unknown) => [value, vi.fn()],
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock('@react-spectrum/s2', () => ({ ToastQueue: { negative: mocks.negative, neutral: vi.fn() } }));
vi.mock('../../runtime/context.tsx', () => ({ useRuntime: () => ({
  host: { platform: 'darwin', pickSavePath: mocks.pickSavePath, pickDirectory: mocks.pickDirectory },
  createExport: mocks.createExport,
}) }));
vi.mock('../../state/export-store.ts', () => ({ useExportPlaces: (select: (s: unknown) => unknown) => select({ dirs: {} }) }));

const env = { videoId: 'vid_test', videoName: '访谈', documents: {}, sequence: { tracks: {}, items: {} }, sourceDir: '/source' } as unknown as ExportEnv;
const settings: ExportSettings = { kind: 'video', format: 'mp4', burnCaptions: false };

describe('confirm the file before submitting the export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pickSavePath.mockResolvedValue('/chosen/改名.mp4');
    mocks.pickDirectory.mockResolvedValue('/chosen');
    mocks.createExport.mockResolvedValue('job_test');
  });
  it('no task created before the save window is confirmed; repeated clicks open the window only once', async () => {
    let confirm!: (file: string | null) => void;
    mocks.pickSavePath.mockImplementation(() => new Promise((resolve) => { confirm = resolve; }));
    const started = vi.fn();
    const submitter = useExportSubmit(env, started);
    const first = submitter.submit(settings);
    await submitter.submit(settings);
    expect(mocks.pickSavePath).toHaveBeenCalledTimes(1);
    expect(mocks.createExport).not.toHaveBeenCalled();
    confirm('/chosen/改名.mp4');
    await first;
    expect(mocks.createExport).toHaveBeenCalledExactlyOnceWith({ videoId: env.videoId, settings,
      destination: { dir: '/chosen', fileName: '改名.mp4', overwrite: true } });
    expect(started).toHaveBeenCalledExactlyOnceWith('job_test', 'video');
  });
  it('cancelling or failing the save window creates no task, and export can still be retried afterward', async () => {
    const submitter = useExportSubmit(env, vi.fn());
    mocks.pickSavePath.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('dialog failed'));
    await submitter.submit(settings);
    await submitter.submit(settings);
    expect(mocks.createExport).not.toHaveBeenCalled();
    expect(mocks.negative).toHaveBeenCalledTimes(1);
    await submitter.submit(settings);
    expect(mocks.createExport).toHaveBeenCalledTimes(1);
  });
  it('multiple tasks share the chosen directory and keep each file name; cancelling the directory choice creates no task', async () => {
    const submitter = useExportSubmit(env, vi.fn());
    const parts = [{ settings, fileName: 'one.mp4' }, { settings, fileName: 'two.mp4' }];
    mocks.pickDirectory.mockResolvedValueOnce(null);
    await submitter.submitEach(parts);
    expect(mocks.createExport).not.toHaveBeenCalled();
    await submitter.submitEach(parts);
    expect(mocks.pickSavePath).not.toHaveBeenCalled();
    expect(mocks.createExport.mock.calls.map(([request]) => request.destination)).toEqual([
      { dir: '/chosen', fileName: 'one.mp4' }, { dir: '/chosen', fileName: 'two.mp4' },
    ]);
  });
});
