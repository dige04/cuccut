import { DEFAULT_CAPTION_STYLE } from '../../model/property-values.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RpcError,
  type DocumentRecord,
  type EditOperation,
  type JobRecord,
  type PipelineCaptionsSummary,
  type PipelineStepState,
  type Sequence,
  type TransactionReceipt,
  type VideoItem,
  type VideoSnapshot,
} from '@cuccut/protocol';
import type { HostBridge } from '../../host.ts';
import { readSpeechWords } from '../../model/speech-cues.ts';
import { pairRows, readTranslation, speechSentences } from '../../model/translation-doc.ts';
import { RuntimeSession } from '../../runtime/session.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useVideo, type OpenVideo } from '../../state/video-store.ts';
import { resetTranscribe, useSubtitleRun } from './transcribe-run.ts';
import {
  bindTranslate,
  editTranslation,
  markTranslation,
  putOnScreen,
  resetTranslate,
  retryTranslate,
  startRefresh,
  startTranslate,
  undoReceipt,
  useTranslateRun,
  type TranslateDeps,
  type TranslateProblem,
} from './translate-run.ts';

const item: VideoItem = {
  id: 'clip',
  trackId: 'v1',
  type: 'video',
  enabled: true,
  locked: false,
  paintOrder: 0,
  followPolicy: { kind: 'sequence-fixed' },
  span: { fromFrame: 0, durationFrames: 300 },
  place: {},
  mode: 'fullscreen',
  assetRef: { id: 'asset', revision: '1' },
  timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1000 }, rate: { num: 1, den: 1 } },
  fit: 'contain',
  embeddedAudio: { enabled: true, volume: 1 },
};

const sequence: Sequence = {
  id: 'seq',
  revision: '1',
  name: '主序列',
  fps: { num: 30, den: 1 },
  canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
  durationPolicy: { kind: 'derived' },
  tracks: [{ id: 'v1', order: 1, kind: 'visual', locked: false, visible: true, muted: false, solo: { enabled: false, group: 'visual' } }],
  items: [item],
  animationBindings: [],
  transitions: [],
  markers: [],
  ducking: [],
};

const speechRecord: DocumentRecord = {
  id: 'speech',
  kind: 'speech',
  name: '访谈 转写',
  language: 'zh',
  sourceAssetId: 'asset',
  currentRevision: 'r1',
  revisions: {},
};
const speechBody = {
  schema: 'cuccut.speech/1',
  clock: 'source-asset',
  timescale: 1000,
  speakers: [],
  sentences: null,
  words: [
    { id: 'w1', start: 0, end: 400, text: '你好' },
    { id: 'w2', start: 400, end: 900, text: '世界。' },
    { id: 'w3', start: 3000, end: 3500, text: '再见。' },
  ],
};

const unit = (id: string, sentence: string, words: string[], text: string) => ({
  id,
  sourceSentenceId: sentence,
  sourceFingerprint: 'sha256:x',
  naturalText: text,
  alignment: { basis: 'natural', correspondence: 'sentence', blocks: [], sourceWordIds: words, textHash: 'sha256:y' },
  status: 'draft',
});
const translationBody = {
  schema: 'cuccut.translation/2',
  language: 'en',
  sourceBasis: { speechRef: { id: 'speech', revision: 'r1' }, sequenceId: 'seq', scopeLineage: [], editViewHash: '' },
  units: [unit('t-s-w1', 's-w1', ['w1', 'w2'], 'Hello world.'), unit('t-s-w3', 's-w3', ['w3'], 'Goodbye.')],
};
const translationRecord: DocumentRecord = {
  id: 'tr',
  kind: 'translation',
  name: '译文 en',
  language: 'en',
  sourceDocumentId: 'speech',
  currentRevision: '1',
  revisions: { '1': { revision: '1', contentHash: '', byteLength: 0, createdAt: '', createdBy: 'tx', summary: { unitCount: 2, sourceRevision: 'r1' } } },
} as DocumentRecord;

function open(videoId: string, documents: Record<string, DocumentRecord> = {}, items: Sequence['items'] = sequence.items): void {
  const video = {
    id: videoId,
    revision: '1',
    rootSequenceId: 'seq',
    sequences: { seq: { ...sequence, items } },
    assets: { asset: { id: 'asset', kind: 'video', name: '访谈.mp4', currentRevision: '1', revisions: {} } },
    documents,
  } as unknown as VideoSnapshot;
  useVideo.setState({
    video: {
      target: { sourceKey: 'local', path: 'a.cuccut' },
      videoId,
      ref: null,
      state: { video, eventSeq: 1 },
      status: 'ready',
      error: null,
      inFlight: 0,
      lastReceipt: null,
      lastChange: null,
      commandError: null,
      undo: {},
    } as unknown as OpenVideo,
  });
}

const step = (name: string, status: PipelineStepState['status']): PipelineStepState => ({
  name,
  label: name,
  status,
  jobId: null,
  attempts: 1,
  output: null,
});

function job(state: JobRecord['state'], extra: Partial<JobRecord> & { stoppedAt?: string } = {}): JobRecord {
  const { stoppedAt = null, ...rest } = extra;
  return {
    jobId: 'p1',
    kind: 'pipeline',
    state,
    phase: state === 'completed' ? 'done' : 'starting',
    progress: null,
    videoId: 'vid',
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:0',
    providerId: 'openai',
    modelId: 'gpt-5',
    bundleId: null,
    inputHash: 'sha256:0',
    submitter: { kind: 'connection' } as JobRecord['submitter'],
    attempt: 1,
    createdAt: '',
    updatedAt: 'u1',
    startedAt: null,
    endedAt: state === 'running' || state === 'queued' ? null : 'e1',
    error: null,
    result: null,
    warnings: [],
    pipeline: {
      name: 'translate',
      params: { videoId: 'vid', documentId: 'speech', targetLanguage: 'en' },
      steps: [step('freeze-source', 'completed'), step('translate', stoppedAt === 'translate' ? 'failed' : 'completed'), step('assemble', 'completed'), step('write', 'completed')],
      current: null,
      stoppedAt,
      summary: null,
    },
    ...rest,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const created: PipelineCaptionsSummary = {
  status: 'created',
  documentId: 'cap-en',
  cueCount: 2,
  enabled: true,
  bilingual: true,
  transactionId: 'tx-cap',
};

/** Summary when the translation flow completes. `captions` absent means an old record without that step. */
const summary = (captions?: PipelineCaptionsSummary) =>
  ({
    videoId: 'vid',
    documentId: 'tr',
    source: { documentId: 'speech', revision: 'r1' },
    targetLanguage: 'en',
    unitCount: 2,
    providerId: 'openai',
    modelId: 'gpt-5',
    ...(captions ? { captions } : {}),
  }) as unknown as Record<string, unknown>;

function fake() {
  const applied: EditOperation[][] = [];
  const toasts: Array<[string, string, boolean]> = [];
  const bodies: Record<string, { document: DocumentRecord; revision: string; body: unknown }> = {
    tr: { document: translationRecord, revision: '1', body: translationBody },
    speech: { document: speechRecord, revision: 'r1', body: speechBody },
  };
  let next = 0;
  const deps: TranslateDeps = {
    runtime: {
      startTranslate: vi.fn(async () => `p${++next}`),
      retryPipeline: vi.fn(async () => {}),
      cancelJob: vi.fn(async () => {}),
      readDocument: vi.fn(async (_videoId: string, documentId: string) => {
        const found = bodies[documentId];
        if (!found) throw new Error(`没有 ${documentId}`);
        return found;
      }),
      videos: {
        apply: vi.fn(async (operations: EditOperation[]) => {
          applied.push(operations);
          return { transactionId: `tx${applied.length}`, refs: { 'translation-caption': 'cap-en' } } as unknown as TransactionReceipt;
        }),
        undo: vi.fn(async () => ({ transactionId: 'undo' }) as unknown as TransactionReceipt),
      },
    },
    toast: (kind, message, undo) => toasts.push([kind, message, !!undo]),
  };
  return { deps, applied, toasts, bodies };
}

const setup = {
  videoId: 'vid',
  speechDocumentId: 'speech',
  targetLanguage: 'en',
  style: '',
  model: { providerId: 'openai', modelId: 'gpt-5' },
  bilingual: true,
};

beforeEach(() => {
  resetTranslate();
  resetTranscribe();
  useJobs.setState({ ready: true, jobs: [] });
  open('vid', { speech: speechRecord });
});
afterEach(() => {
  resetTranslate();
  resetTranscribe();
});

describe('submit translation', () => {
  it('real session: pipelines.start receives the flow name, parameters containing only keys the flow recognizes, and commandId', async () => {
    const session = new RuntimeSession({} as HostBridge);
    const calls: Array<[string, unknown]> = [];
    vi.spyOn(session.client, 'request').mockImplementation((async (method: string, params: unknown) => {
      calls.push([method, params]);
      return { jobId: 'p1' };
    }) as never);
    bindTranslate({ runtime: session, toast: () => {} });
    expect(await startTranslate({ ...setup, style: ' 口语 ' })).toBe(true);
    expect(calls).toHaveLength(1);
    const [method, params] = calls[0]!;
    expect(method).toBe('pipelines.start');
    expect(params).toEqual({
      pipeline: 'translate',
      params: {
        videoId: 'vid',
        documentId: 'speech',
        targetLanguage: 'en',
        style: '口语',
        provider: 'openai',
        model: 'gpt-5',
        // The caption layer is created by the flow, and bilingual follows the user's choice.
        captions: true,
        bilingual: true,
        captionStyle: DEFAULT_CAPTION_STYLE,
      },
      commandId: expect.stringMatching(/^cmd_/),
    });
    expect(useTranslateRun.getState().runs.vid).toMatchObject({ jobId: 'p1', status: 'running', targetLanguage: 'en' });
    // Only one language can be translated per video at a time.
    expect(await startTranslate({ ...setup, targetLanguage: 'ja' })).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('no text model configured: submission rejected, reason, hint and route to the models page given in place, no run state kept', async () => {
    const { deps } = fake();
    deps.runtime.startTranslate = vi.fn(async () => {
      throw new RpcError('conflict', '没有可用的文本模型', {
        code: 'CAPABILITY_NOT_CONFIGURED',
        capability: 'generateText',
        reason: 'missing-credential',
        providerId: 'openai',
        remedy: { action: 'configure-provider', capability: 'generateText', providerId: 'openai', hint: '在模型页填 OpenAI 的密钥。' },
      });
    });
    bindTranslate(deps);
    expect(await startTranslate(setup)).toBe(false);
    const state = useTranslateRun.getState();
    expect(state.runs.vid).toBeUndefined();
    expect(state.problems.vid).toMatchObject({
      kind: 'not-configured',
      title: '还不能翻译 · 文本模型的服务商还没有填密钥',
      message: '在模型页填 OpenAI 的密钥。',
      remedy: { target: { tab: 'models' } },
      retry: null,
    });
  });
});

describe('translation completed', () => {
  it('flow created the subtitle layer: keep a receipt per summary.captions (undo follows that transaction), the list matches it and selects the new layer; the editor no longer writes on its own; later events are not received again', async () => {
    const { deps, applied } = fake();
    bindTranslate(deps);
    await startTranslate(setup);

    const done = (updatedAt: string) =>
      job('completed', {
        result: { documentId: 'tr', artifactId: 'a' },
        updatedAt,
        pipeline: { ...job('completed').pipeline!, summary: summary(created) },
      });
    useJobs.setState({ jobs: [done('u1')] });
    await flush();
    useJobs.setState({ jobs: [done('later')] });
    await flush();

    expect(applied).toEqual([]);
    expect(deps.runtime.readDocument).not.toHaveBeenCalled();
    const state = useTranslateRun.getState();
    expect(state.runs.vid).toBeUndefined();
    expect(state.problems.vid).toBeUndefined();
    expect(state.receipts.vid).toEqual({
      transactionId: 'tx-cap',
      language: 'English',
      translationDocumentId: 'tr',
      count: 2,
      bilingual: true,
      undone: false,
    });
    expect(state.compare.vid).toEqual({ mode: 'bi', documentId: 'tr' });
    expect(useSubtitleRun.getState().focus.vid).toBe('cap-en');

    await undoReceipt('vid');
    expect(deps.runtime.videos.undo).toHaveBeenCalledWith({ transaction: 'tx-cap' });
  });

  it('no subtitle layer created: when it cannot be shown on screen or the flow did not create one, leave one line to check the list and place it; when there are no displayable sentences, say so accurately', async () => {
    const { deps, applied } = fake();
    bindTranslate(deps);
    const cases: Array<[PipelineCaptionsSummary | undefined, Partial<TranslateProblem>]> = [
      [
        { status: 'not-on-timeline', documentId: null, cueCount: null, enabled: null },
        { kind: 'pending', message: expect.stringContaining('时间线上没有') },
      ],
      [undefined, { kind: 'pending', title: '译文已完成，还没放到画面上' }],
      [
        { status: 'empty', documentId: null, cueCount: null, enabled: null },
        { kind: 'empty', title: '译文没有可以放到画面上的句子' },
      ],
    ];
    for (const [n, [captions, problem]] of cases.entries()) {
      await startTranslate(setup);
      const jobId = `p${n + 1}`;
      useJobs.setState({
        jobs: [
          job('completed', {
            jobId,
            result: { documentId: 'tr', artifactId: 'a' },
            pipeline: { ...job('completed').pipeline!, summary: summary(captions) },
          }),
        ],
      });
      await flush();
      expect(useTranslateRun.getState().runs.vid).toBeUndefined();
      expect(useTranslateRun.getState().receipts.vid).toBeUndefined();
      expect(useTranslateRun.getState().problems.vid).toMatchObject(problem);
    }
    expect(applied).toEqual([]);
  });

  it('undo on the receipt: revert the entry placed on screen; when it cannot be reverted, say so accurately', async () => {
    const { deps, toasts } = fake();
    bindTranslate(deps);
    useTranslateRun.setState({
      receipts: { vid: { transactionId: 'tx9', language: 'English', translationDocumentId: 'tr', count: 2, bilingual: true, undone: false } },
    });
    await undoReceipt('vid');
    expect(deps.runtime.videos.undo).toHaveBeenCalledWith({ transaction: 'tx9' });
    expect(useTranslateRun.getState().receipts.vid?.undone).toBe(true);

    useTranslateRun.setState({
      receipts: { vid: { transactionId: 'tx10', language: 'English', translationDocumentId: 'tr', count: 2, bilingual: true, undone: false } },
    });
    deps.runtime.videos.undo = vi.fn(async () => null);
    await undoReceipt('vid');
    expect(useTranslateRun.getState().receipts.vid?.undone).toBe(false);
    expect(toasts.at(-1)?.[0]).toBe('negative');
  });

  it('translations already in the video: placed on screen, notice with undo', async () => {
    const { deps, applied, toasts } = fake();
    bindTranslate(deps);
    open('vid', { speech: speechRecord, tr: translationRecord });
    await putOnScreen('vid', 'tr', false);
    expect(applied).toHaveLength(1);
    expect(toasts).toEqual([['positive', '已把English译文放到画面上 · 2 条字幕', true]]);
    expect(useSubtitleRun.getState().focus.vid).toBe('cap-en');
  });
});

describe('failure, interruption and retry', () => {
  it('stopped at the translation step: give the reason and retry, noting it will be billed again; retry the same task, old records are not received again as results', async () => {
    const { deps, applied } = fake();
    bindTranslate(deps);
    await startTranslate(setup);
    const failed = job('failed', { stoppedAt: 'translate', error: { code: 'MODEL_OUTPUT_INVALID', message: '模型回的不是合法的 JSON' } });
    useJobs.setState({ jobs: [failed] });
    await flush();
    expect(useTranslateRun.getState().runs.vid).toBeUndefined();
    expect(useTranslateRun.getState().problems.vid).toMatchObject({
      kind: 'failed',
      title: '翻译失败',
      message: '模型回的不是合法的 JSON',
      retry: { jobId: 'p1', note: 'charges', intent: { targetLanguage: 'en', bilingual: true } },
    });

    await retryTranslate('vid');
    expect(deps.runtime.retryPipeline).toHaveBeenCalledWith('p1');
    expect(useTranslateRun.getState().runs.vid).toMatchObject({ jobId: 'p1', status: 'running', retriedAt: 'u1' });
    expect(useTranslateRun.getState().problems.vid).toBeUndefined();
    // Events from another task arrive while the mirror still holds the old failed record: do not wrap up.
    useJobs.setState({ jobs: [failed, job('running', { jobId: 'other', kind: 'transcribe', pipeline: undefined })] });
    await flush();
    expect(useTranslateRun.getState().runs.vid?.status).toBe('running');
    expect(useTranslateRun.getState().problems.vid).toBeUndefined();

    // The re-run finished (the flow created the caption layer): leave a receipt.
    useJobs.setState({ jobs: [job('running', { updatedAt: 'u2' })] });
    await flush();
    useJobs.setState({
      jobs: [
        job('completed', {
          updatedAt: 'u3',
          result: { documentId: 'tr', artifactId: 'a' },
          pipeline: { ...job('completed').pipeline!, summary: summary(created) },
        }),
      ],
    });
    await flush();
    expect(applied).toEqual([]);
    expect(useTranslateRun.getState().receipts.vid).toMatchObject({ translationDocumentId: 'tr', transactionId: 'tx-cap' });
  });

  it('interruption and cancel: interrupted gives retry (stopped after translation, no more model calls); cancelled shows one line only', async () => {
    const { deps, toasts } = fake();
    bindTranslate(deps);
    await startTranslate(setup);
    useJobs.setState({ jobs: [job('interrupted', { stoppedAt: 'write', error: { code: 'INTERRUPTED', message: 'Runtime 重启了' } })] });
    await flush();
    expect(useTranslateRun.getState().problems.vid).toMatchObject({ title: '翻译中断了', retry: { note: 'free' } });

    await startTranslate(setup);
    expect(useTranslateRun.getState().problems.vid).toBeUndefined();
    useJobs.setState({ jobs: [job('cancelled', { jobId: 'p2' })] });
    await flush();
    expect(useTranslateRun.getState().runs.vid).toBeUndefined();
    expect(useTranslateRun.getState().problems.vid).toBeUndefined();
    expect(toasts.at(-1)).toEqual(['neutral', '已取消翻译', false]);
  });
});

describe('edit one translation line', () => {
  it('one transaction: new version of the translation document together with the subtitle entries for this line generated from it; other entries untouched', async () => {
    const { deps, applied, toasts, bodies } = fake();
    bindTranslate(deps);
    const captionRecord = {
      id: 'cap-en',
      kind: 'caption',
      name: 'English',
      language: 'en',
      sourceDocumentId: 'tr',
      currentRevision: '1',
      revisions: { '1': { revision: '1', contentHash: '', byteLength: 0, createdAt: '', createdBy: 'tx', summary: { cueCount: 2 } } },
      extensions: { 'cuccut.translationCues': { translationDocumentId: 'tr' } },
    } as unknown as DocumentRecord;
    bodies['cap-en'] = {
      document: captionRecord,
      revision: '1',
      body: {
        schema: 'cuccut.caption/1',
        clock: 'source-asset',
        timescale: 1000,
        cues: [
          { id: 'q-t-s-w1', start: 0, end: 900, text: 'Hello world.' },
          { id: 'q-t-s-w3', start: 3000, end: 3500, text: '手改过的 Goodbye.' },
        ],
      },
    };
    const sentences = speechSentences(speechBody)!;
    const body = readTranslation(translationBody)!;
    // The fingerprint matches the current source sentence, so the pair is two normal sentences.
    body.units = body.units.map((u, i) => ({ ...u, sourceFingerprint: sentences[i]!.fingerprint }));
    const rows = pairRows(sentences, body);
    const documents = { speech: speechRecord, tr: translationRecord, 'cap-en': captionRecord };

    const next = await editTranslation({
      videoId: 'vid',
      record: translationRecord,
      body,
      sentences,
      row: rows[0]!,
      text: 'Hi there, world.',
      speech: readSpeechWords(speechBody)!,
      documents,
    });
    expect(next?.units[0]).toMatchObject({ naturalText: 'Hi there, world.', status: 'reviewed' });
    expect(applied).toHaveLength(1);
    const [translationPut, captionPut] = applied[0]! as Array<Extract<EditOperation, { type: 'putDocument' }>>;
    expect(translationPut).toMatchObject({ documentId: 'tr', kind: 'translation', summary: { unitCount: 2, sourceRevision: 'r1' } });
    expect(captionPut).toMatchObject({
      documentId: 'cap-en',
      kind: 'caption',
      summary: { cueCount: 2 },
      body: {
        cues: [
          { id: 'q-t-s-w1', start: 0, end: 900, text: 'Hi there, world.' },
          { id: 'q-t-s-w3', text: '手改过的 Goodbye.' },
        ],
      },
    });
    expect(toasts).toEqual([['positive', '已改写这一句译文', true]]);

    // The text is unchanged: do not write.
    expect(
      await editTranslation({
        videoId: 'vid',
        record: translationRecord,
        body,
        sentences,
        row: rows[1]!,
        text: ' Goodbye. ',
        speech: readSpeechWords(speechBody)!,
        documents,
      }),
    ).toBeNull();
    expect(applied).toHaveLength(1);
  });
});

describe('retranslate stale sentences in place', () => {
  it('retranslate only the named sentences: parameters include translationId and sentences, no subtitle layer created; on completion a notice with undo, which reverts the entry the flow wrote', async () => {
    const { deps, toasts } = fake();
    const undos: Array<() => void> = [];
    bindTranslate({ ...deps, toast: (kind, message, undo) => (deps.toast(kind, message, undo), undo && undos.push(undo)) });
    const model = { providerId: 'openai', modelId: 'gpt-5' };
    expect(await startRefresh({ videoId: 'vid', record: translationRecord, language: 'en', sentences: ['s-w3'], count: 1, model })).toBe(true);
    expect(deps.runtime.startTranslate).toHaveBeenCalledWith({
      videoId: 'vid',
      documentId: 'speech',
      targetLanguage: 'en',
      translationId: 'tr',
      sentences: ['s-w3'],
      provider: 'openai',
      model: 'gpt-5',
    });
    expect(useTranslateRun.getState().refreshes.tr).toMatchObject({ jobId: 'p1', count: 1 });
    // The same translation is refreshed only once at a time.
    expect(await startRefresh({ videoId: 'vid', record: translationRecord, language: 'en', count: 2, model })).toBe(false);
    // This is not a new translation, so it does not take up the translation's running state.
    expect(useTranslateRun.getState().runs.vid).toBeUndefined();

    const refresh = { revision: '2', sentences: ['s-w3'], removedUnitIds: [], captionDocumentIds: ['cap-en'], transactionId: 'tx-refresh' };
    const done = job('completed', {
      pipeline: { ...job('completed').pipeline!, params: { videoId: 'vid', targetLanguage: 'en', translationId: 'tr', sentences: ['s-w3'] }, summary: { ...summary(), refresh } },
    });
    useJobs.setState({ jobs: [done] });
    await flush();
    expect(useTranslateRun.getState().refreshes.tr).toBeUndefined();
    expect(useTranslateRun.getState().receipts.vid).toBeUndefined();
    expect(toasts).toEqual([['positive', '已重译 1 句 · 字幕跟着更新', true]]);
    // Undo on the notice: undoes the transaction in which the flow wrote the translation and created the caption layer.
    undos[0]!();
    expect(deps.runtime.videos.undo).toHaveBeenCalledWith({ transaction: 'tx-refresh' });
  });

  it('when no sentences are named, Runtime picks; on failure attach an issue card (no retry, start again from the menu)', async () => {
    const { deps } = fake();
    bindTranslate(deps);
    await startRefresh({ videoId: 'vid', record: translationRecord, language: 'en', count: 2, model: null });
    expect(deps.runtime.startTranslate).toHaveBeenCalledWith({ videoId: 'vid', documentId: 'speech', targetLanguage: 'en', translationId: 'tr' });
    useJobs.setState({ jobs: [job('failed', { stoppedAt: 'translate', error: { code: 'MODEL_OUTPUT_INVALID', message: '模型回的不是合法的 JSON' } })] });
    await flush();
    expect(useTranslateRun.getState().refreshes.tr).toBeUndefined();
    // Carries which translation document it is for. The tool page that refreshes outdated translations only attaches in-place refresh issues, not new-translation issues.
    expect(useTranslateRun.getState().problems.vid).toMatchObject({ kind: 'failed', title: '重译失败', message: '模型回的不是合法的 JSON', retry: null, refresh: 'tr' });
  });

  it('submission rejected: the issue card also carries which translation it belongs to', async () => {
    const { deps } = fake();
    deps.runtime.startTranslate = vi.fn(async () => {
      throw new Error('模型不支持结构化输出');
    });
    bindTranslate(deps);
    expect(await startRefresh({ videoId: 'vid', record: translationRecord, language: 'en', count: 2, model: null })).toBe(false);
    expect(useTranslateRun.getState().refreshes.tr).toBeUndefined();
    expect(useTranslateRun.getState().problems.vid).toMatchObject({ kind: 'failed', message: '模型不支持结构化输出', refresh: 'tr' });
  });
});

describe('mark as stale and clear the stale mark', () => {
  const captionRecord = {
    id: 'cap-en',
    kind: 'caption',
    name: 'English',
    language: 'en',
    sourceDocumentId: 'tr',
    currentRevision: '1',
    revisions: { '1': { revision: '1', contentHash: '', byteLength: 0, createdAt: '', createdBy: 'tx', summary: { cueCount: 2 } } },
    extensions: { 'cuccut.translationCues': { translationDocumentId: 'tr' } },
  } as unknown as DocumentRecord;
  const documents = { speech: speechRecord, tr: translationRecord, 'cap-en': captionRecord };
  const captionBody = {
    schema: 'cuccut.caption/1',
    clock: 'source-asset',
    timescale: 1000,
    cues: [
      { id: 'q-t-s-w1', start: 0, end: 900, text: 'Hello world.' },
      { id: 'q-t-s-w3', start: 3000, end: 3500, text: 'Goodbye.' },
    ],
  };

  it('marking as stale only writes the translation document (subtitle text unchanged), entering undo history; already stale ones are not written again', async () => {
    const { deps, applied, toasts, bodies } = fake();
    bodies['cap-en'] = { document: captionRecord, revision: '1', body: captionBody };
    bindTranslate(deps);
    const sentences = speechSentences(speechBody)!;
    const body = readTranslation(structuredClone(translationBody))!;
    body.units = body.units.map((u, i) => ({ ...u, sourceFingerprint: sentences[i]!.fingerprint }));
    const rows = pairRows(sentences, body);
    const edit = { videoId: 'vid', record: translationRecord, body, row: rows[0]!, speech: readSpeechWords(speechBody)!, documents };

    const next = await markTranslation({ ...edit, on: true });
    expect(next?.units[0]).toMatchObject({ status: 'stale', naturalText: 'Hello world.' });
    expect(applied).toHaveLength(1);
    expect(applied[0]).toHaveLength(1);
    expect(applied[0]![0]).toMatchObject({ type: 'putDocument', documentId: 'tr' });
    expect(deps.runtime.videos.apply).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ key: 'editLabel.markTranslationStale' }));
    expect(toasts).toEqual([['positive', '已标为过期 · 重译时会一起重译这一句', true]]);

    const marked = pairRows(sentences, next!);
    expect(await markTranslation({ ...edit, body: next!, row: marked[0]!, on: true })).toBeNull();
    expect(applied).toHaveLength(1);
  });

  it('clear the stale mark: units whose source sentence changed are rebound to the new words, and this sentence\'s subtitle entries are re-split accordingly; same transaction', async () => {
    const { deps, applied, toasts, bodies } = fake();
    bodies['cap-en'] = { document: captionRecord, revision: '1', body: captionBody };
    bindTranslate(deps);
    const sentences = speechSentences(speechBody)!;
    const body = readTranslation(structuredClone(translationBody))!;
    // The second sentence's fingerprint matches but the first sentence's is old: the source was edited.
    body.units = body.units.map((u, i) => ({ ...u, sourceFingerprint: i === 1 ? sentences[1]!.fingerprint : 'sha256:old' }));
    const rows = pairRows(sentences, body);
    expect(rows[0]!.state).toBe('source-changed');

    const next = await markTranslation({ videoId: 'vid', record: translationRecord, body, row: rows[0]!, speech: readSpeechWords(speechBody)!, documents, on: false });
    expect(next?.units[0]).toMatchObject({ status: 'reviewed', sourceFingerprint: sentences[0]!.fingerprint });
    expect(applied).toHaveLength(1);
    const [translationPut, captionPut] = applied[0]! as Array<Extract<EditOperation, { type: 'putDocument' }>>;
    expect(translationPut).toMatchObject({ documentId: 'tr' });
    expect(captionPut).toMatchObject({ documentId: 'cap-en', body: { cues: [{ id: 'q-t-s-w1', text: 'Hello world.' }, { id: 'q-t-s-w3', text: 'Goodbye.' }] } });
    expect(toasts).toEqual([['positive', '已去掉过期标记', true]]);
  });
});
