import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobRecord, PipelineStepState, SpeakersSummary, TransactionReceipt, UndoTarget } from '@cuccut/protocol';
import { useJobs } from '../../state/jobs-store.ts';
import { useVideo, type OpenVideo } from '../../state/video-store.ts';
import {
  applySpeakers,
  awaitInstall,
  bindSpeakers,
  closeSpeakers,
  redoSpeakers,
  renameSpeaker,
  resetSpeakers,
  retrySpeakers,
  startSpeakers,
  undoSpeakers,
  useSpeakersRun,
  type SpeakersDeps,
} from './speakers-run.ts';

const summary: SpeakersSummary = {
  videoId: 'vid',
  source: { documentId: 'speech', revision: '1' },
  timescale: 1000,
  speakers: [
    {
      id: 'a',
      name: '说话人 1',
      isNew: false,
      words: 3,
      seconds: 1.5,
      sentences: 2,
      clips: [{ sentenceId: 's-w0', start: 0, end: 1400, text: 'Hello there,' }],
    },
    { id: 'spk-2', name: '说话人 2', isNew: true, words: 3, seconds: 0.9, sentences: 1, clips: [] },
  ],
  relabeled: 3,
  translationsSplit: 1,
  skippedTranslations: 0,
  proposalArtifactId: 'art_1',
  bundleId: 'speaker-diarization@mlx',
  diarizeMs: 9200,
};

const step = (name: string, status: PipelineStepState['status']): PipelineStepState => ({
  name,
  label: name,
  status,
  jobId: null,
  attempts: 1,
  output: null,
});

function job(jobId: string, state: JobRecord['state'], extra: Partial<JobRecord> = {}): JobRecord {
  return {
    jobId,
    kind: 'pipeline',
    state,
    phase: state === 'completed' ? 'done' : 'starting',
    progress: null,
    videoId: 'vid',
    updatedAt: 'u1',
    endedAt: state === 'running' || state === 'queued' ? null : 'e1',
    error: null,
    pipeline: {
      name: 'speakers',
      params: { videoId: 'vid' },
      steps: [step('diarize', 'completed'), step('propose', state === 'completed' ? 'completed' : 'pending')],
      current: null,
      stoppedAt: null,
      summary: state === 'completed' ? (summary as unknown as Record<string, unknown>) : null,
    },
    ...extra,
  } as JobRecord;
}

function open(): void {
  useVideo.setState({
    video: { videoId: 'vid', status: 'ready', inFlight: 0, commandError: null, state: null } as unknown as OpenVideo,
  });
}

function fake() {
  const toasts: string[] = [];
  const undone: UndoTarget[] = [];
  let next = 0;
  let tx = 0;
  const receipt = (available = true) => ({ transactionId: `tx${++tx}`, undo: { available } }) as unknown as TransactionReceipt;
  const deps = {
    runtime: {
      startPipeline: vi.fn(async () => `p${++next}`),
      retryPipeline: vi.fn(async () => {}),
      cancelJob: vi.fn(async () => {}),
      videos: {
        applySpeakers: vi.fn(async () => receipt()),
        undo: vi.fn(async (target: UndoTarget) => {
          undone.push(target);
          return receipt();
        }),
      },
    },
    toast: (_kind: string, message: string) => {
      toasts.push(message);
    },
  } satisfies SpeakersDeps;
  bindSpeakers(deps);
  return { deps, toasts, undone, receipt };
}

beforeEach(() => {
  resetSpeakers();
  useJobs.setState({ ready: true, jobs: [] });
  open();
});

afterEach(() => resetSpeakers());

describe('speaker recognition run', () => {
  it('submit the speakers flow; on completion, go to the confirmation page (proposal), without writing the video', async () => {
    const { deps } = fake();
    expect(await startSpeakers('vid', 'speech')).toBe(true);
    expect(deps.runtime.startPipeline).toHaveBeenCalledWith('speakers', { videoId: 'vid', documentId: 'speech' });
    expect(useSpeakersRun.getState().runs.vid).toMatchObject({ jobId: 'p1', status: 'running' });
    useJobs.setState({ jobs: [job('p1', 'running')] });
    expect(useSpeakersRun.getState().runs.vid).toBeDefined();
    useJobs.setState({ jobs: [job('p1', 'completed')] });
    expect(useSpeakersRun.getState().runs.vid).toBeUndefined();
    expect(useSpeakersRun.getState().proposals.vid).toMatchObject({ jobId: 'p1', summary: { relabeled: 3 }, applying: false });
    expect(deps.runtime.videos.applySpeakers).not.toHaveBeenCalled();
  });

  it('on failure, give the reason and retry (same task); cancel only shows a notice', async () => {
    const { deps, toasts } = fake();
    await startSpeakers('vid');
    useJobs.setState({
      jobs: [job('p1', 'failed', { error: { code: 'MODEL_LOAD_FAILED', message: '模型载入失败' } as JobRecord['error'] })],
    });
    expect(useSpeakersRun.getState().problems.vid).toMatchObject({ kind: 'failed', message: '模型载入失败', retryJobId: 'p1' });
    await retrySpeakers('vid');
    expect(deps.runtime.retryPipeline).toHaveBeenCalledWith('p1');
    // The mirror still holds the failed record: do not finalize.
    useJobs.setState({ jobs: [job('p1', 'failed')] });
    expect(useSpeakersRun.getState().runs.vid).toMatchObject({ status: 'running' });
    useJobs.setState({ jobs: [job('p1', 'cancelled', { updatedAt: 'u2' })] });
    expect(useSpeakersRun.getState().runs.vid).toBeUndefined();
    expect(toasts).toEqual(['已取消识别说话人']);
  });

  it('submission rejected (e.g. model pack not installed): leave the reason, do not create a run', async () => {
    const { deps } = fake();
    deps.runtime.startPipeline.mockRejectedValueOnce(new Error('「说话人区分」模型还没有装好：先下载'));
    expect(await startSpeakers('vid')).toBe(false);
    expect(useSpeakersRun.getState().runs.vid).toBeUndefined();
    expect(useSpeakersRun.getState().problems.vid).toMatchObject({ kind: 'failed', message: '「说话人区分」模型还没有装好：先下载' });
  });

  it('starts automatically after the model pack download completes; does not start if the download fails', async () => {
    const { deps } = fake();
    awaitInstall('vid', 'inst1');
    useJobs.setState({ jobs: [{ ...job('inst1', 'running'), kind: 'modelInstall' } as JobRecord] });
    expect(deps.runtime.startPipeline).not.toHaveBeenCalled();
    useJobs.setState({ jobs: [{ ...job('inst1', 'completed'), kind: 'modelInstall' } as JobRecord] });
    await Promise.resolve();
    expect(deps.runtime.startPipeline).toHaveBeenCalledTimes(1);
    expect(useSpeakersRun.getState().installs.vid).toBeUndefined();

    resetSpeakers();
    const second = fake();
    awaitInstall('vid', 'inst2');
    useJobs.setState({ jobs: [{ ...job('inst2', 'failed'), kind: 'modelInstall' } as JobRecord] });
    expect(second.deps.runtime.startPipeline).not.toHaveBeenCalled();
    expect(useSpeakersRun.getState().installs.vid).toBeUndefined();
  });
});

describe('confirm and apply', () => {
  async function proposed() {
    const fixture = fake();
    await startSpeakers('vid');
    useJobs.setState({ jobs: [job('p1', 'completed')] });
    return fixture;
  }

  it('apply carries only the renamed names (trimmed of leading and trailing whitespace); the receipt can be undone, and undoing that undo redoes', async () => {
    const { deps, undone } = await proposed();
    renameSpeaker('vid', 'spk-2', ' 嘉宾 ');
    renameSpeaker('vid', 'a', '说话人 1');
    expect(await applySpeakers('vid')).toBe(true);
    expect(deps.runtime.videos.applySpeakers).toHaveBeenCalledWith('p1', { 'spk-2': '嘉宾' });
    expect(useSpeakersRun.getState().proposals.vid).toBeUndefined();
    expect(useSpeakersRun.getState().receipts.vid).toMatchObject({ transactionId: 'tx1', undone: false });

    await undoSpeakers('vid');
    expect(undone).toEqual([{ transaction: 'tx1' }]);
    expect(useSpeakersRun.getState().receipts.vid).toMatchObject({ undone: true, undoTransactionId: 'tx2' });

    await redoSpeakers('vid');
    expect(undone).toEqual([{ transaction: 'tx1' }, { transaction: 'tx2' }]);
    expect(useSpeakersRun.getState().receipts.vid).toMatchObject({ undone: false, transactionId: 'tx3', undoTransactionId: null });

    closeSpeakers('vid');
    expect(useSpeakersRun.getState().receipts.vid).toBeUndefined();
  });

  it('a receipt offers no undo when there are no changes to undo', async () => {
    const { deps, receipt } = await proposed();
    deps.runtime.videos.applySpeakers.mockResolvedValueOnce(receipt(false));
    await applySpeakers('vid');
    expect(useSpeakersRun.getState().receipts.vid?.transactionId).toBeNull();
  });

  it('apply rejected (script changed after recognition): drop the proposal, keep the reason', async () => {
    const { deps } = await proposed();
    deps.runtime.videos.applySpeakers.mockImplementationOnce(async () => {
      useVideo.setState((s) => ({ video: { ...s.video!, commandError: { message: '文稿在识别之后改过', code: null } } }));
      return null as unknown as TransactionReceipt;
    });
    expect(await applySpeakers('vid')).toBe(false);
    expect(useSpeakersRun.getState().proposals.vid).toBeUndefined();
    expect(useSpeakersRun.getState().problems.vid).toMatchObject({ kind: 'apply', message: '文稿在识别之后改过' });
  });
});
