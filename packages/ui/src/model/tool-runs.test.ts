import { describe, expect, it } from 'vitest';
import { RpcError, type GrantCreateParams, type GrantRequestItem, type JobRecord, type PipelineStepState, type ToolStatus } from '@cuccut/protocol';
import {
  ambiguousAssets,
  dubEngineKey,
  dubParams,
  fallbackTitle,
  grantLoopText,
  grantAndRestart,
  grantKey,
  grantLines,
  isRunOf,
  linkParams,
  opensMovie,
  pct,
  pendingGrantsOf,
  phase,
  resultLines,
  runInput,
  runOpts,
  runsOf,
  runView,
  startTool,
  stepNote,
  toolOfJob,
  toolRequest,
  toolRunOf,
  transcribeFileParams,
  transcribeParams,
  transcriptEditedOf,
  transcriptSwitchOf,
  translateModelOptions,
  translateVideoParams,
  withAsset,
  type ToolStartSession,
} from './tool-runs.ts';
import { textView } from './models-test-fixtures.ts';

const step = (name: string, status: PipelineStepState['status'], extra: Partial<PipelineStepState> = {}): PipelineStepState => ({
  name,
  label: { target: '解析目标', create: '新建视频', transcribe: '转写', captions: '建立字幕层' }[name] ?? name,
  status,
  jobId: null,
  attempts: status === 'pending' ? 0 : 1,
  output: null,
  ...extra,
});

function job(
  patch: Partial<JobRecord> & { name?: string; params?: Record<string, unknown>; steps?: PipelineStepState[]; summary?: Record<string, unknown> | null } = {},
): JobRecord {
  const { name, params, steps, summary, ...rest } = patch;
  return {
    jobId: 'job_1',
    kind: 'pipeline',
    state: 'running',
    phase: null,
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: '',
    providerId: 'local',
    modelId: 'whisper',
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
      name: name ?? 'transcribe',
      params: params ?? { target: { create: { projectId: 'prj_1', media: '/Users/me/访谈.mp4' } } },
      steps: steps ?? [
        step('target', 'skipped'),
        step('create', 'completed'),
        step('transcribe', 'running', { jobId: 'job_asr' }),
        step('captions', 'pending'),
      ],
      current: 2,
      stoppedAt: null,
      summary: summary ?? null,
    },
    ...rest,
  } as JobRecord;
}

const ITEM: GrantRequestItem = {
  capability: 'transcribe',
  dataKinds: ['audio'],
  recipient: 'openai',
  videoId: null,
  purpose: '转录',
  reason: 'none',
  cost: 'unknown',
  estimate: null,
  maxCalls: null,
};

function status(patch: Partial<ToolStatus> = {}): ToolStatus {
  return {
    id: 'translate-subtitles',
    label: '翻译字幕',
    description: '',
    category: 'speech',
    inputs: ['video', 'document', 'file'],
    results: ['video', 'artifact'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: 'translate', params: { captions: true } },
    executionByInput: { file: { kind: 'pipeline', method: 'pipelines.start', pipeline: 'translate-subtitles' } },
    capabilities: ['generateText'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: 'videos-with-transcript',
    available: true,
    problems: [],
    limitations: [],
    ...patch,
  };
}

describe('run view', () => {
  it('steps follow the Runtime\'s workflow, skipped ones are not listed; the current step\'s subtask progress counts toward total progress', () => {
    const child = { ...job(), jobId: 'job_asr', kind: 'transcribe', progress: { done: 30, total: 60, unit: 'seconds' } } as JobRecord;
    const run = runView(job(), [child])!;
    expect(run.steps.map((s) => [s.name, s.status])).toEqual([
      ['create', 'done'],
      ['transcribe', 'running'],
      ['captions', 'pending'],
    ]);
    expect(run.cur).toBe(1);
    expect(run.steps[1]!.pct).toBe(50);
    expect(pct(run)).toBe(50);
    expect(phase(run)).toBe('正在转写 · 第 2 / 3 步');
    expect(run.steps.map(stepNote)).toEqual(['完成', '50%', '等待']);
  });

  it('failure stops at which step; queued, completed, and cancelled each have their own wording', () => {
    const failed = runView(
      job({
        state: 'failed',
        error: { code: 'APPLY_FAILED', message: '写不进视频' },
        steps: [step('target', 'skipped'), step('create', 'completed'), step('transcribe', 'failed'), step('captions', 'pending')],
      }),
    )!;
    expect(failed.status).toBe('failed');
    expect(phase(failed)).toBe('停在「转写」· 第 2 / 3 步');
    expect(failed.error).toBe('写不进视频');
    expect(failed.errorCode).toBe('APPLY_FAILED');
    expect(stepNote(failed.steps[1]!)).toBe('停在这一步');
    expect(phase(runView(job({ state: 'queued' }))!)).toBe('排队中');
    const done = runView(job({ state: 'completed', steps: [step('create', 'completed'), step('transcribe', 'completed'), step('captions', 'completed')] }))!;
    expect(pct(done)).toBe(100);
    expect(phase(done)).toBe('已完成');
    expect(runView({ ...job(), pipeline: undefined } as JobRecord)).toBeNull();
  });

  it('when speaker separation distinguishes speakers, "转写" is split into "转写" and "识别说话人" steps, separated by the transcription task\'s stages', () => {
    const asr = (phase: JobRecord['phase'], state: JobRecord['state'] = 'running') =>
      ({
        ...job(),
        jobId: 'job_t',
        kind: 'transcribe',
        state,
        phase,
        submitter: { kind: 'pipeline', id: 'job_1' },
        pipeline: undefined,
      }) as JobRecord;
    const names = (r: ReturnType<typeof runView>) => r!.steps.map((s) => [s.name, s.status]);
    expect(names(runView(job(), [asr('transcribing')], { diarizeStep: true }))).toEqual([
      ['create', 'done'],
      ['transcribe', 'running'],
      ['diarize', 'pending'],
      ['captions', 'pending'],
    ]);
    const diarizing = runView(job(), [asr('diarizing')], { diarizeStep: true })!;
    expect(names(diarizing)).toEqual([
      ['create', 'done'],
      ['transcribe', 'done'],
      ['diarize', 'running'],
      ['captions', 'pending'],
    ]);
    expect(phase(diarizing)).toBe('正在识别说话人 · 第 3 / 4 步');
    const stuck = job({ state: 'failed', steps: [step('create', 'completed'), step('transcribe', 'failed'), step('captions', 'pending')] });
    expect(phase(runView(stuck, [asr('diarizing', 'failed')], { diarizeStep: true })!)).toBe('停在「识别说话人」· 第 3 / 4 步');
    expect(phase(runView(stuck, [asr('transcribing', 'failed')], { diarizeStep: true })!)).toBe('停在「转写」· 第 2 / 4 步');
    const done = job({
      state: 'completed',
      steps: [step('create', 'completed'), step('transcribe', 'completed'), step('captions', 'completed')],
    });
    expect(names(runView(done, [], { diarizeStep: true }))).toEqual([
      ['create', 'done'],
      ['transcribe', 'done'],
      ['diarize', 'done'],
      ['captions', 'done'],
    ]);
    // Unchanged when not listed separately.
    expect(runView(job(), [asr('diarizing')])!.steps.map((s) => s.name)).toEqual(['create', 'transcribe', 'captions']);
  });

  it('workflow names resolve to tool pages; the transcription page additionally accepts link imports that download then transcribe', () => {
    expect(toolOfJob(job({ name: 'translate' }))).toBe('translate-subtitles');
    expect(toolOfJob(job({ name: 'translate-subtitles' }))).toBe('translate-subtitles');
    expect(toolOfJob(job({ name: 'transcode', params: { action: 'merge' } }))).toBe('merge-video');
    expect(toolOfJob(job({ name: 'export' }))).toBeNull();
    const linked = job({ jobId: 'l', name: 'link-import', params: { url: 'https://x.test/v', transcribe: true }, createdAt: '2026-10-02T00:00:00Z' });
    expect(isRunOf(linked, 'transcribe')).toBe(true);
    expect(isRunOf(linked, 'link-import')).toBe(true);
    expect(isRunOf(job({ name: 'link-import', params: { url: 'https://x.test/v' } }), 'transcribe')).toBe(false);
    expect(runsOf([job(), linked], 'transcribe').map((j) => j.jobId)).toEqual(['l', 'job_1']);
  });

  it('background task details are drawn as tool runs: transcription, translate subtitles, translate dub; download video also uses the tool run view, transcoding doesn\'t count', () => {
    expect(toolRunOf(job({ name: 'translate' }))).toBe('translate-subtitles');
    expect(toolRunOf(job({ name: 'dub' }))).toBe('dub');
    expect(toolRunOf(job({ name: 'link-import', params: { url: 'https://x.test/v', transcribe: true } }))).toBe('link-import');
    expect(toolRunOf(job({ name: 'transcode' }))).toBeNull();
    expect(toolRunOf({ ...job(), kind: 'transcribe' })).toBeNull();
  });

  it('only results written into a video have "打开编辑"; translated subtitle files and download-only runs that don\'t create a video don\'t', () => {
    expect(opensMovie('translate-subtitles', 'file')).toBe(false);
    expect(opensMovie('link-import', 'link', { target: 'none' })).toBe(false);
    expect(opensMovie('transcribe', 'file')).toBe(true);
  });
});

describe('authorize on the spot', () => {
  it('takes pending approval items from the rejection\'s details; other rejections don\'t count', () => {
    expect(pendingGrantsOf(new RpcError('forbidden', '缺授权', { code: 'GRANT_REQUIRED', pendingGrants: [ITEM, { bogus: true }] }))).toEqual([ITEM]);
    expect(pendingGrantsOf({ details: { pendingGrants: [ITEM] } })).toEqual([ITEM]);
    expect(pendingGrantsOf(new RpcError('forbidden', '缺授权', { code: 'GRANT_REQUIRED' }))).toBeNull();
    expect(pendingGrantsOf(new Error('x'))).toBeNull();
    expect(pendingGrantsOf(new RpcError('forbidden', 'x', { pendingGrants: [] }))).toBeNull();
  });

  it('each authorization card item: who it goes to, content, cost (state honestly when it can\'t be estimated)', () => {
    const labels = new Map([['openai', 'OpenAI']]);
    const lines = grantLines(
      [ITEM, ITEM, { ...ITEM, recipient: 'deepseek', dataKinds: ['transcript'], purpose: '翻译', estimate: { amount: '0.12', currency: 'USD' } }],
      labels,
    );
    expect(lines).toEqual([
      { key: 'openai:audio', recipient: 'OpenAI', what: '音频（转录）', cost: '按 OpenAI 的价目计费，这里估不出金额' },
      { key: 'deepseek:transcript', recipient: 'deepseek', what: '文稿与译文（翻译）', cost: '约 0.12 USD' },
    ]);
    expect(grantKey({ recipient: 'a', dataKinds: ['transcript', 'audio'] })).toBe('a:audio,transcript');
  });

  /** Fake session: the first few submissions are rejected with the given results; records each submitted commandId and each grant issued. */
  function fake(rejections: unknown[]): ToolStartSession & { starts: string[]; grants: GrantCreateParams[] } {
    const starts: string[] = [];
    const grants: GrantCreateParams[] = [];
    return {
      starts,
      grants,
      async startPipelineWithCommand(_pipeline, _params, commandId) {
        starts.push(commandId);
        const next = rejections.shift();
        if (next) throw next;
        return 'job_new';
      },
      async createGrant(params) {
        grants.push(params);
        return {};
      },
    };
  }
  const refusal = () => new RpcError('forbidden', '缺授权', { code: 'GRANT_REQUIRED', pendingGrants: [ITEM] });
  const request = { pipeline: 'transcribe', params: { target: { entryId: 'ent_1' } } };

  it('when rejected, returns the pending approval items; after consent, grants each item and resubmits with the same commandId', async () => {
    const session = fake([refusal()]);
    const first = await startTool(session, request, 'cmd_1');
    expect(first).toEqual({ kind: 'grants', items: [ITEM] });
    expect(session.grants).toEqual([]);
    const granted = new Set<string>();
    const second = await grantAndRestart(session, request, 'cmd_1', [ITEM], granted);
    expect(second).toEqual({ kind: 'started', jobId: 'job_new' });
    expect(session.starts).toEqual(['cmd_1', 'cmd_1']);
    expect(session.grants).toEqual([
      { dataKinds: ['audio'], recipient: 'openai', scope: { videoId: null }, purpose: '转录', budgetMode: 'per-call-unknown-cost', maxCalls: null },
    ]);
  });

  it('still rejected after granting, for the same item: stop and explain, don\'t loop', async () => {
    const session = fake([refusal(), refusal()]);
    await startTool(session, request, 'cmd_1');
    const granted = new Set<string>();
    const second = await grantAndRestart(session, request, 'cmd_1', [ITEM], granted);
    expect(second.kind).toBe('failed');
    expect(second.kind === 'failed' && second.error.message).toBe(grantLoopText());
    const third = await grantAndRestart(session, request, 'cmd_1', [ITEM], granted);
    expect(third.kind === 'failed' && third.error.message).toBe(grantLoopText());
    expect(session.grants).toHaveLength(1);
  });

  it('rejected for replacing an edited transcript (TRANSCRIPT_EDITED): returns edited and waits for user confirmation', async () => {
    const edited = new RpcError('conflict', '文稿改过', { code: 'TRANSCRIPT_EDITED', documentId: 'doc_1' });
    expect(transcriptEditedOf(edited)).toBe(true);
    expect(transcriptEditedOf(new RpcError('conflict', 'x', { code: 'JOB_NOT_RETRYABLE' }))).toBe(false);
    const out = await startTool(fake([edited]), request, 'cmd_1');
    expect(out.kind).toBe('edited');
  });

  it('other failures are returned as-is', async () => {
    const session = fake([new RpcError('not-found', '视频不在了')]);
    const out = await startTool(session, request, 'cmd_1');
    expect(out.kind === 'failed' && out.error.message).toBe('视频不在了');
  });
});

describe('submit parameters', () => {
  it('workflow name and directory fixed parameters come from tools.list; UI parameters are layered on top; no submit when the status hasn\'t arrived', () => {
    expect(toolRequest(status(), 'video', { target: { entryId: 'e' }, bilingual: true })).toEqual({
      pipeline: 'translate',
      params: { captions: true, target: { entryId: 'e' }, bilingual: true },
    });
    expect(toolRequest(status(), 'file', { input: '/a.srt' })).toEqual({ pipeline: 'translate-subtitles', params: { input: '/a.srt' } });
    expect(toolRequest(null, 'video', {})).toBeNull();
    expect(
      toolRequest(status({ execution: { kind: 'job', method: 'models.generateText', capability: 'generateText' }, executionByInput: {} }), 'video', {}),
    ).toBeNull();
  });

  it('parameters of each tool', () => {
    expect(transcribeParams({ create: { projectId: 'p', media: '/m.mp4' } }, { provider: 'local', model: 'whisper', language: '' })).toEqual({
      target: { create: { projectId: 'p', media: '/m.mp4' } },
      provider: 'local',
      model: 'whisper',
    });
    expect(transcribeParams({ entryId: 'e' }, { language: 'zh' }, 'ast_2')).toEqual({ target: { entryId: 'e' }, assetId: 'ast_2', language: 'zh' });
    expect(transcribeParams({ entryId: 'e' }, { diarize: false })).toEqual({ target: { entryId: 'e' }, diarize: false });
    expect(transcribeParams({ entryId: 'e' }, { diarize: true })).toEqual({ target: { entryId: 'e' }, diarize: true });
    // Landing for re-transcription (product design §5.11): a new video takes a name; replace carries translations over; when the user has confirmed a hand-edited transcript, pass acceptEdited.
    expect(transcribeParams({ entryId: 'e' }, {}, null, { destination: 'new-video', name: ' 片花 · 重新转录 ' })).toEqual({
      target: { entryId: 'e' },
      destination: 'new-video',
      name: '片花 · 重新转录',
    });
    expect(transcribeParams({ entryId: 'e' }, {}, null, { destination: 'replace', name: '不用' })).toEqual({
      target: { entryId: 'e' },
      destination: 'replace',
      translations: 'carry',
    });
    expect(transcribeParams({ entryId: 'e' }, {}, null, { destination: 'replace', acceptEdited: true })).toEqual({
      target: { entryId: 'e' },
      destination: 'replace',
      translations: 'carry',
      acceptEdited: true,
    });
    expect(transcribeParams({ create: { projectId: 'p', media: '/m.mp4' } }, {}, null, { destination: 'replace' })).toEqual({
      target: { create: { projectId: 'p', media: '/m.mp4' } },
    });
    expect(linkParams({ url: ' https://x.test/v ', target: 'create', projectId: 'p', transcribe: true })).toEqual({
      url: 'https://x.test/v',
      target: { create: { projectId: 'p' } },
      transcribe: true,
    });
    expect(linkParams({ url: 'https://x.test/v', target: 'video', entryId: 'e' })).toEqual({ url: 'https://x.test/v', target: { entryId: 'e' } });
    expect(linkParams({ url: 'https://x.test/v', target: 'none', projectId: 'p', transcribe: true })).toEqual({ url: 'https://x.test/v', projectId: 'p' });
    expect(translateVideoParams({ entryId: 'e', documentId: 'd', targetLanguage: 'en', bilingual: false })).toEqual({
      target: { entryId: 'e' },
      documentId: 'd',
      targetLanguage: 'en',
    });
    expect(dubParams({ entryId: 'e', translation: { id: 't', documentId: 'd' }, targetLanguage: 'en', originalAudio: 'duck' })).toEqual({
      target: { entryId: 'e' },
      translationId: 't',
      documentId: 'd',
      originalAudio: 'duck',
    });
    expect(dubParams({ entryId: 'e', translation: null, targetLanguage: 'ja', originalAudio: 'mute' })).toMatchObject({ targetLanguage: 'ja' });
    // Translate first: passes the source transcript and the text model used for translation; not passed when an existing translation was chosen.
    expect(
      dubParams({
        entryId: 'e',
        translation: null,
        targetLanguage: 'ja',
        documentId: 'd',
        originalAudio: 'keep',
        provider: 'elevenlabs',
        model: 'v3',
        textProvider: 'openai',
        textModel: 'gpt',
      }),
    ).toEqual({
      target: { entryId: 'e' },
      targetLanguage: 'ja',
      documentId: 'd',
      textProvider: 'openai',
      textModel: 'gpt',
      originalAudio: 'keep',
      provider: 'elevenlabs',
      model: 'v3',
    });
    expect(
      dubParams({
        entryId: 'e',
        translation: { id: 't', documentId: 'd' },
        targetLanguage: null,
        originalAudio: 'duck',
        textProvider: 'openai',
        textModel: 'gpt',
      }),
    ).not.toHaveProperty('textModel');
  });

  it('text models for translation: those without structured output support are listed but unusable', () => {
    const view = textView();
    const options = translateModelOptions(view);
    expect(options.length).toBeGreaterThan(0);
    const first = options[0]!;
    const off = translateModelOptions({
      ...view,
      generateText: {
        ...view.generateText,
        providers: view.generateText.providers.map((p) => ({ ...p, models: p.models.map((m) => ({ ...m, structuredOutput: false })) })),
      },
    }).find((o) => o.key === first.key)!;
    expect(first.usable).toBe(true);
    expect(off).toMatchObject({ usable: false, why: '这只模型不支持结构化输出，翻译用不了' });
  });

  it('when several assets are on the main track, reads out the ones to choose from', () => {
    expect(ambiguousAssets(job({ error: { code: 'TRANSCRIBE_ASSET_AMBIGUOUS', message: 'x', details: { assetIds: ['a', 'b', 3] } } }))).toEqual(['a', 'b']);
    expect(ambiguousAssets(job({ error: { code: 'APPLY_FAILED', message: 'x' } }))).toBeNull();
    expect(ambiguousAssets(null)).toBeNull();
  });

  it('restart with the chosen asset: uses frozen parameters plus assetId; when already written into a video, the target becomes that video', () => {
    const into = job({ name: 'transcribe', params: { target: { entryId: 'e1' }, language: 'zh' }, videoId: 'vid_1' });
    expect(withAsset(into, 'ast_2')).toEqual({ pipeline: 'transcribe', params: { target: { videoId: 'vid_1' }, language: 'zh', assetId: 'ast_2' } });
    const fresh = job({ name: 'transcribe', params: { target: { entryId: 'e1' } } });
    expect(withAsset(fresh, 'ast_2')?.params).toEqual({ target: { entryId: 'e1' }, assetId: 'ast_2' });
  });

  it('infers the input kind and link-import destination from frozen parameters', () => {
    expect(runInput(job())).toBe('file');
    expect(runInput(job({ params: { target: { entryId: 'e' } } }))).toBe('video');
    expect(runInput(job({ name: 'translate-subtitles', params: { input: '/a.srt' } }))).toBe('file');
    expect(runInput(job({ name: 'link-import', params: { url: 'https://x' } }))).toBe('link');
    expect(runOpts(job({ name: 'link-import', params: { url: 'u', projectId: 'p' } }))).toEqual({ target: 'none', transcribe: false });
    expect(runOpts(job({ name: 'link-import', params: { url: 'u', target: { create: { projectId: 'p' } }, transcribe: true } }))).toEqual({
      target: 'create',
      transcribe: true,
    });
    expect(runOpts(job({ name: 'link-import', params: { url: 'u', target: { entryId: 'e' } } }))).toEqual({ target: 'video', transcribe: false });
    expect(runOpts(job())).toEqual({ target: 'create' });
    expect(runOpts(job({ params: { file: '/a.mp4' } }))).toEqual({ target: 'none' });
    expect(runOpts(job({ params: { target: { entryId: 'e' } } }))).toEqual({});
    expect(runInput(job({ params: { file: { entryId: 'e' } } }))).toBe('file');
  });

  it('transcription that outputs only a script: parameters have no speakers or video; the result is two files in the save location, no video opens, and no continue', () => {
    const asr = { provider: 'local', model: 'whisper', language: 'zh', diarize: true };
    expect(transcribeFileParams('/v/访谈.mp4', asr)).toEqual({ file: '/v/访谈.mp4', provider: 'local', model: 'whisper', language: 'zh' });
    expect(transcribeFileParams({ entryId: 'e1' }, { ...asr, language: '' }, '/out')).toEqual({ file: { entryId: 'e1' }, outDir: '/out', provider: 'local', model: 'whisper' });
    expect(opensMovie('transcribe', 'file', { target: 'none' })).toBe(false);
    expect(opensMovie('transcribe', 'file', { target: 'create' })).toBe(true);
    const done = job({
      state: 'completed',
      params: { file: '/v/访谈.mp4' },
      summary: { file: '/v/访谈.mp4', files: ['/out/访谈.txt', '/out/访谈.srt'], transcribeJobId: 'j', language: 'zh', providerId: 'local', modelId: 'whisper' },
    });
    expect(resultLines(done, null, null)).toEqual(['文稿与字幕保存到保存位置：访谈.txt、访谈.srt', '文稿语言：中文（whisper）']);
  });
});

describe('result page', () => {
  it('transcription: wording for creating a new video vs. writing into an existing one; the subtitle layer is described by status', () => {
    const created = job({
      state: 'completed',
      summary: {
        videoId: 'vid_9',
        createdVideo: true,
        language: 'zh',
        modelId: 'whisper',
        target: 'first',
        captions: { status: 'created', documentId: 'cap', cueCount: 12, enabled: true },
      },
    });
    expect(resultLines(created, { tool: 'transcribe', input: 'file', title: '转录 · 访谈.mp4', projectName: '访谈' }, '访谈')).toEqual([
      '新建视频「访谈」，放进「访谈」；素材留在原处，只做链接',
      '文稿语言：中文（whisper）',
      '建立了一条可编辑的字幕层',
    ]);
    const into = job({
      state: 'completed',
      summary: {
        videoId: 'vid_1',
        createdVideo: false,
        language: 'en',
        target: 'first',
        captions: { status: 'existing', documentId: 'c', cueCount: null, enabled: null },
      },
    });
    expect(resultLines(into, null, '片花')).toEqual(['写进「片花」：写入一份文稿', '文稿语言：英语', '这份文稿已经有字幕层，没有再建']);
    const speakers = (diarize: boolean, speakerCount: number | null) =>
      resultLines(
        job({ state: 'completed', params: { target: { entryId: 'e' }, diarize }, summary: { videoId: 'v', language: 'zh', speakerCount } }),
        null,
        '片花',
      );
    expect(speakers(true, 3)).toEqual(['写进「片花」：写入一份文稿', '文稿语言：中文', '区分出 3 位说话人，字幕与文稿都标上了名字']);
    expect(speakers(true, 0)).toHaveLength(2);
    expect(speakers(true, null)).toHaveLength(2);
    expect(speakers(false, 2)).toHaveLength(2);
  });

  it('re-transcribe: creating a new video says the original video is unchanged; replace says it can be undone, carries over per language, and shows a stale hint to refresh', () => {
    const fresh = job({
      state: 'completed',
      params: { target: { entryId: 'e' }, destination: 'new-video' },
      summary: {
        videoId: 'vid_new',
        createdVideo: false,
        language: 'zh',
        target: 'new-video',
        newVideo: { videoId: 'vid_new', name: '片花 · 重新转录' },
        replaced: null,
        translations: [],
        captionPins: null,
        dubs: [],
        captions: { status: 'created', documentId: 'cap', cueCount: 12, enabled: true },
      },
    });
    expect(resultLines(fresh, { tool: 'transcribe', input: 'video', title: 't', videoName: '片花', projectName: '访谈' }, null)).toEqual([
      '新建视频「片花 · 重新转录」，放进「访谈」，链接同一份素材；「片花」和它的译文没动',
      '文稿语言：中文',
      '建立了一条可编辑的字幕层',
    ]);
    expect(transcriptSwitchOf(fresh)).toBeNull();
    const summary = {
      videoId: 'vid_1',
      createdVideo: false,
      language: 'zh',
      target: 'replace',
      newVideo: null,
      replaced: { documentId: 'doc_1', previousVersion: 'v1', transactionId: 'tx_9' },
      translations: [{ language: 'en', documentId: 'tr_en', kept: 54, keptReviewed: 40, stale: 8, unmatched: 2 }],
      captionPins: { reanchored: 11, orphaned: 1 },
      dubs: [{ language: 'en', documentId: 'dub_en', kept: 50, stale: 4 }],
      captions: { status: 'existing', documentId: 'c', cueCount: null, enabled: null },
    };
    const replaced = job({ state: 'completed', params: { target: { entryId: 'e' }, destination: 'replace' }, summary });
    expect(resultLines(replaced, null, '片花')).toEqual([
      '取代「片花」的文稿：一笔事务，可以撤销',
      '文稿语言：中文',
      '这份文稿已经有字幕层，没有再建',
      '英语译文：保留 54 句（已审 40）· 过期 8 句',
      '字幕 pin：重锚 11 处 · orphaned 1 处',
      '英语配音：保留 50 句 · 过期 4 句',
      '过期的译文用「刷新过期译文」重译',
    ]);
    expect(transcriptSwitchOf(replaced)).toEqual({ videoId: 'vid_1', transactionId: 'tx_9', stale: true });
    const bare = job({
      state: 'completed',
      summary: {
        ...summary,
        translations: [],
        captionPins: { reanchored: 0, orphaned: 0 },
        dubs: [],
        replaced: { ...summary.replaced, transactionId: null },
      },
    });
    expect(resultLines(bare, null, '片花').slice(-1)).toEqual(['这部视频没有译文、字幕 pin 与配音，没有要结转的']);
    expect(transcriptSwitchOf(bare)).toEqual({ videoId: 'vid_1', transactionId: null, stale: false });
    expect(transcriptSwitchOf(job({ state: 'running', summary }))).toBeNull();
  });

  it('wording for translation and link import; none when there is no summary', () => {
    const tr = job({
      name: 'translate',
      state: 'completed',
      summary: {
        videoId: 'v',
        targetLanguage: 'en',
        unitCount: 40,
        captions: { status: 'created', documentId: 'c', cueCount: 40, enabled: true, bilingual: true },
      },
    });
    expect(resultLines(tr, { tool: 'translate-subtitles', input: 'video', title: 't', sourceLanguage: 'zh' }, '访谈')).toEqual([
      '写进「访谈」：新增一份英语译文（译自中文文稿），原文没动',
      '共 40 句',
      '建立了英语字幕层，双语显示',
    ]);
    const link = job({
      name: 'link-import',
      state: 'completed',
      summary: { videoId: null, title: '发布会', files: { media: '/dl/发布会.mp4', subtitles: [] }, transcribeJobId: null },
    });
    expect(resultLines(link, null, null)).toEqual(['发布会.mp4 已下载，在 /dl']);
    const withCookies = job({
      name: 'link-import',
      state: 'completed',
      summary: { videoId: null, title: '会员', files: { media: '/dl/会员.mp4', subtitles: [] }, cookieBrowser: 'firefox', transcribeJobId: null },
    });
    expect(resultLines(withCookies, null, null)).toEqual(['会员.mp4 已下载，在 /dl', '用了 Firefox 的 Cookie']);
    expect(resultLines(job(), null, null)).toEqual([]);
    expect(fallbackTitle(job(), '转录', null)).toBe('转录 · 访谈.mp4');
    expect(fallbackTitle(job({ name: 'translate', params: { videoId: 'v', targetLanguage: 'en' } }), '翻译字幕', '片花')).toBe('翻译字幕 · 片花 → 英语');
  });
});

describe('default dub engine', () => {
  const engine = (key: string, usable: boolean, languages: 'any' | string[]) => {
    const [providerId = '', modelId = ''] = key.split('/');
    return { key, providerId, provider: providerId, modelId, label: modelId, connected: usable, usable, why: usable ? null : '未连接', info: { languages } };
  };
  const options = [engine('a/one', true, ['en']), engine('b/two', true, 'any'), engine('c/three', false, 'any')];

  it('uses the previously selected one if it still exists, even if it\'s currently unusable', () => {
    expect(dubEngineKey(options, 'c/three', null, 'ja')).toBe('c/three');
  });

  it('uses the active default if it can speak this language, otherwise switches to one that can', () => {
    expect(dubEngineKey(options, null, { providerId: 'a', modelId: 'one' }, 'en')).toBe('a/one');
    expect(dubEngineKey(options, null, { providerId: 'a', modelId: 'one' }, 'ja')).toBe('b/two');
    expect(dubEngineKey(options, 'gone/x', null, null)).toBe('a/one');
  });

  it('falls back to the first one when none are usable; null when there are no engines', () => {
    expect(dubEngineKey([engine('c/three', false, 'any')], null, null, 'en')).toBe('c/three');
    expect(dubEngineKey([], null, null, 'en')).toBeNull();
  });
});
