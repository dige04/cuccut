import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError, type DocumentRecord, type EditOperation, type JobRecord, type TransactionReceipt, type VideoSnapshot } from '@cuccut/protocol';
import { useJobs } from '../../state/jobs-store.ts';
import { useVideo, type OpenVideo } from '../../state/video-store.ts';
import { DUB_REGEN_COPY as C } from './dub-copy.ts';

// Toasts use S2's ToastQueue: swapped for a recorder in tests.
const toasts = vi.hoisted(() => [] as Array<{ kind: string; message: string; onAction?: () => void }>);
vi.mock('@react-spectrum/s2', () => {
  const push = (kind: string) => (message: string, options?: { onAction?: () => void }) => {
    toasts.push({ kind, message, onAction: options?.onAction });
    return () => {};
  };
  return { ToastQueue: { positive: push('positive'), negative: push('negative'), neutral: push('neutral'), info: push('info') } };
});

const { regenerateUnits, resetDubRegen, retextAndRegenerate, useDubRegen, openDubFit, closeDubFit } = await import('./dub-regen.ts');

const revision = (createdAt: string, createdBy: string) => ({ revision: createdAt, contentHash: '', byteLength: 0, createdAt, createdBy });

function planRecord(extra: Record<string, ReturnType<typeof revision>> = {}): DocumentRecord {
  return {
    id: 'plan',
    kind: 'dubbing-plan',
    name: '配音计划（en）',
    currentRevision: '1',
    revisions: { '1': revision('2026-10-03T10:00:00Z', 'tx-dub'), ...extra },
  } as unknown as DocumentRecord;
}

const translationRecord = {
  id: 't-en',
  kind: 'translation',
  name: '英语译文',
  currentRevision: 'r1',
  revisions: { r1: { ...revision('2026-10-03T09:00:00Z', 'tx-tr'), summary: { language: 'en', unitCount: 2 } } },
} as unknown as DocumentRecord;

function open(documents: Record<string, DocumentRecord>): void {
  const video = { id: 'vid', revision: '1', rootSequenceId: 'seq', sequences: {}, assets: {}, documents } as unknown as VideoSnapshot;
  useVideo.setState({ video: { videoId: 'vid', state: { video, eventSeq: 1 }, status: 'ready' } as unknown as OpenVideo });
}

function job(state: JobRecord['state'], summary: unknown = null, error: JobRecord['error'] = null, jobId = 'p1'): JobRecord {
  return {
    jobId,
    kind: 'pipeline',
    state,
    videoId: 'vid',
    endedAt: state === 'running' || state === 'queued' ? null : 'e1',
    error,
    pipeline: { name: 'dub', params: { videoId: 'vid', regroup: { groupId: 'dub_p1', units: ['u1', 'u2'] } }, summary },
  } as unknown as JobRecord;
}

const regroupSummary = (units: Array<{ unitId: string; status: string }>) => ({
  videoId: 'vid',
  planDocumentId: 'plan',
  groupId: 'dub_p1',
  units: { total: units.length },
  regroup: { seed: 7, units: units.map((u) => ({ ...u, take: 2, seed: 7 })) },
});

function fake() {
  const applied: EditOperation[][] = [];
  const deps = {
    runtime: {
      startDub: vi.fn(async () => 'p1'),
      readDocument: vi.fn(async () => ({
        document: translationRecord,
        revision: 'r1',
        body: {
          schema: 'cuccut.translation/2',
          language: 'en',
          sourceBasis: {},
          units: [
            { id: 'u1', sourceSentenceId: 's1', sourceFingerprint: 'f1', naturalText: 'Hello there.', alignment: null, status: 'draft' },
            { id: 'u2', sourceSentenceId: 's2', sourceFingerprint: 'f2', naturalText: 'A very long sentence.', alignment: null, status: 'draft' },
          ],
        },
      })),
    },
    apply: vi.fn(async (operations: EditOperation[]) => {
      applied.push(operations);
      return { transactionId: `tx${applied.length}` } as unknown as TransactionReceipt;
    }),
    undo: vi.fn(async () => ({ transactionId: 'undo' }) as unknown as TransactionReceipt),
  };
  return { deps, applied };
}

beforeEach(() => {
  resetDubRegen();
  toasts.length = 0;
  useJobs.setState({ ready: true, jobs: [] });
  open({ plan: planRecord(), 't-en': translationRecord });
});
afterEach(() => resetDubRegen());

describe('regenerate these lines', () => {
  it('submit dub regroup (new seed), record the plan\'s existing versions; on completion, report how many lines were swapped and which were not, and undo reverts the entry Runtime wrote back', async () => {
    const { deps } = fake();
    const request = { videoId: 'vid', groupId: 'dub_p1', units: ['u1', 'u2'], planDocumentId: 'plan' };
    expect(await regenerateUnits(deps, request)).toBe('p1');
    expect(deps.runtime.startDub).toHaveBeenCalledWith({ videoId: 'vid', regroup: { groupId: 'dub_p1', units: ['u1', 'u2'], seed: 'new' } });
    expect(useDubRegen.getState().pending.p1).toMatchObject({ groupId: 'dub_p1', revisions: ['1'] });
    expect(useDubRegen.getState().busy).toEqual({});
    expect(toasts).toEqual([{ kind: 'neutral', message: C.submitted(2), onAction: undefined }]);

    // Still running: do not wrap up.
    useJobs.setState({ jobs: [job('running')] });
    expect(toasts).toHaveLength(1);

    // Runtime writeback: the plan gained one version (the earlier one is the writeback; the user edited again afterwards).
    open({
      plan: planRecord({ '3': revision('2026-10-03T10:09:00Z', 'tx-user'), '2': revision('2026-10-03T10:05:00Z', 'tx-regroup') }),
      't-en': translationRecord,
    });
    useJobs.setState({
      jobs: [
        job(
          'completed',
          regroupSummary([
            { unitId: 'u1', status: 'replaced' },
            { unitId: 'u2', status: 'overlong' },
          ]),
        ),
      ],
    });
    expect(useDubRegen.getState().pending).toEqual({});
    const done = toasts[1]!;
    expect(done).toMatchObject({ kind: 'positive', message: `${C.done(1, 2)} · ${C.notPlaced('overlong', 1)}` });
    done.onAction!();
    expect(deps.undo).toHaveBeenCalledWith({ transaction: 'tx-regroup' });

    // A task event arriving again for the same task does not notify again.
    useJobs.setState({ jobs: [job('completed', regroupSummary([{ unitId: 'u1', status: 'replaced' }]))] });
    expect(toasts).toHaveLength(2);
  });

  it('when no line is swapped, a neutral notice with no undo; failures and cancellations are reported as they happened', async () => {
    const { deps } = fake();
    const request = { videoId: 'vid', groupId: 'dub_p1', units: ['u2'], planDocumentId: 'plan' };
    await regenerateUnits(deps, request);
    useJobs.setState({ jobs: [job('completed', regroupSummary([{ unitId: 'u2', status: 'stale' }]))] });
    expect(toasts[1]).toEqual({ kind: 'neutral', message: `${C.doneNone} · ${C.notPlaced('stale', 1)}`, onAction: undefined });

    deps.runtime.startDub.mockResolvedValueOnce('p2');
    await regenerateUnits(deps, request);
    useJobs.setState({ jobs: [job('failed', null, { code: 'DUB_NOTHING_PLACED', message: '一句也没放上', retryable: false } as JobRecord['error'], 'p2')] });
    expect(toasts[3]).toMatchObject({ kind: 'negative', message: C.failed('一句也没放上') });

    deps.runtime.startDub.mockResolvedValueOnce('p3');
    await regenerateUnits(deps, request);
    useJobs.setState({ jobs: [job('cancelled', null, null, 'p3')] });
    expect(toasts[5]).toMatchObject({ kind: 'neutral', message: C.cancelled });
  });

  it('missing grant rejected: say which provider\'s grant is missing, record no task; with no lines, do nothing', async () => {
    const { deps } = fake();
    deps.runtime.startDub.mockRejectedValueOnce(
      new RpcError('forbidden', '把译文交给 elevenlabs 需要用户授权', {
        code: 'GRANT_REQUIRED',
        recipient: 'elevenlabs',
        dataKinds: ['transcript'],
        videoId: 'vid',
        remedy: { action: 'create-grant', hint: '数据外发要用户授权', commands: [] },
      }),
    );
    expect(await regenerateUnits(deps, { videoId: 'vid', groupId: 'dub_p1', units: ['u1'], planDocumentId: 'plan' })).toBeNull();
    expect(toasts).toEqual([{ kind: 'negative', message: C.grantRefused('elevenlabs'), onAction: undefined }]);
    expect(useDubRegen.getState().pending).toEqual({});
    expect(useDubRegen.getState().busy).toEqual({});

    expect(await regenerateUnits(deps, { videoId: 'vid', groupId: 'dub_p1', units: [], planDocumentId: 'plan' })).toBeNull();
    expect(deps.runtime.startDub).toHaveBeenCalledTimes(1);
  });
});

describe('edit translation and redub', () => {
  it('first write a new translation version in one edit (only the changed lines), then redub only those lines', async () => {
    const { deps, applied } = fake();
    const jobId = await retextAndRegenerate(deps, {
      videoId: 'vid',
      groupId: 'dub_p1',
      units: ['u1', 'u2'],
      planDocumentId: 'plan',
      translationId: 't-en',
      texts: new Map([
        ['u2', 'Long sentence.'],
        ['u1', 'Hello there.'],
      ]),
    });
    expect(jobId).toBe('p1');
    expect(applied).toHaveLength(1);
    const [put] = applied[0]! as Array<Extract<EditOperation, { type: 'putDocument' }>>;
    expect(put).toMatchObject({ type: 'putDocument', documentId: 't-en', kind: 'translation', summary: { language: 'en', unitCount: 2 } });
    const units = (put!.body as { units: Array<{ id: string; naturalText: string; status: string }> }).units;
    expect(units.map((u) => [u.id, u.naturalText, u.status])).toEqual([
      ['u1', 'Hello there.', 'draft'],
      ['u2', 'Long sentence.', 'reviewed'],
    ]);
    expect(deps.apply).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ key: 'editLabel.editDubText' }));
    expect(deps.runtime.startDub).toHaveBeenCalledWith({ videoId: 'vid', regroup: { groupId: 'dub_p1', units: ['u1', 'u2'], seed: 'new' } });
  });

  it('no redub when the translation write edit did not commit; redub directly when no text was changed', async () => {
    const { deps } = fake();
    deps.apply.mockResolvedValueOnce(null as unknown as TransactionReceipt);
    const request = { videoId: 'vid', groupId: 'dub_p1', units: ['u2'], planDocumentId: 'plan', translationId: 't-en' };
    expect(await retextAndRegenerate(deps, { ...request, texts: new Map([['u2', 'Short.']]) })).toBeNull();
    expect(deps.runtime.startDub).not.toHaveBeenCalled();

    expect(await retextAndRegenerate(deps, { ...request, texts: new Map([['u2', ' A very long sentence. ']]) })).toBe('p1');
    expect(deps.apply).toHaveBeenCalledTimes(1);
  });

  it('dialog open and close: does not open when there are no lines', () => {
    openDubFit({ videoId: 'vid', groupId: 'dub_p1', units: [] });
    expect(useDubRegen.getState().fit).toBeNull();
    openDubFit({ videoId: 'vid', groupId: 'dub_p1', units: ['u1'] });
    expect(useDubRegen.getState().fit).toEqual({ videoId: 'vid', groupId: 'dub_p1', units: ['u1'] });
    closeDubFit();
    expect(useDubRegen.getState().fit).toBeNull();
  });
});
