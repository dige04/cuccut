import { describe, expect, it } from 'vitest';
import { job, task } from '../testing/task-records.ts';
import { agentRow, clip, jobPercent, jobRow, runsOnLabel, taskGroups, taskRows, type TaskContext } from './task-list.ts';

const ctx: TaskContext = {
  projects: [{ id: 'p1', name: '产品发布会' }],
  conversations: [
    { id: 'c1', projectId: 'p1', activity: 'idle' },
    { id: 'c2', projectId: 'p1', activity: 'awaiting-approval' },
  ],
  video: { videoId: 'v1', name: '主视频', projectId: 'p1', assets: { a1: { name: 'interview.mp4' } } },
};

describe('jobPercent', () => {
  it('floors done/total to a percentage when the total is known, clamped to 0–100', () => {
    expect(jobPercent({ progress: { done: 45, total: 100, unit: 'seconds' } })).toBe(45);
    expect(jobPercent({ progress: { done: 99.9, total: 100, unit: 'seconds' } })).toBe(99);
    expect(jobPercent({ progress: { done: 120, total: 100, unit: 'seconds' } })).toBe(100);
  });
  it('null when the total is unknown, 0, or there is no progress (no fake percentage)', () => {
    expect(jobPercent({ progress: { done: 3, total: null, unit: 'segments' } })).toBeNull();
    expect(jobPercent({ progress: { done: 0, total: 0, unit: 'outputs' } })).toBeNull();
    expect(jobPercent({ progress: null })).toBeNull();
  });
});

describe('runsOnLabel', () => {
  it('local, remote node, local agent, cloud', () => {
    expect(runsOnLabel('local')).toBe('本机');
    expect(runsOnLabel('node:studio')).toBe('远端节点');
    expect(runsOnLabel('agent:codex')).toBe('本机 · Codex');
    expect(runsOnLabel('openai')).toBe('云端');
    expect(runsOnLabel('custom:my-gateway')).toBe('云端');
  });
});

describe('clip', () => {
  it('truncates by code point and appends an ellipsis', () => {
    expect(clip('  一只橘猫  ', 40)).toBe('一只橘猫');
    expect(clip('一二三四五', 3)).toBe('一二三…');
  });
});

describe('jobRow', () => {
  it('running transcription: stage · percentage, determinate progress, cancel action; an open video gives the title', () => {
    const row = jobRow(job({ jobId: 'j1', progress: { done: 45, total: 100, unit: 'seconds' } }), ctx);
    expect(row).toMatchObject({
      kind: 'transcribe',
      title: '转录 · 主视频 · interview.mp4',
      where: 'whisper-large-v3 · 本机',
      label: '识别中 · 45%',
      tone: 'accent',
      phase: '识别中',
      pct: 45,
      progress: 45,
      live: true,
      action: { type: 'cancel', jobId: 'j1' },
      chip: 'cli',
      projectId: 'p1',
    });
  });

  it('unknown total only reads the stage, progress bar spins', () => {
    const row = jobRow(job({ jobId: 'j1', phase: 'loading', progress: { done: 0, total: null, unit: 'seconds' } }), ctx);
    expect(row.label).toBe('加载模型');
    expect(row.progress).toBe('indet');
  });

  it('queued: reads "排队中", spins, cancellable; start time uses the submit time', () => {
    const row = jobRow(job({ jobId: 'j2', state: 'queued', phase: 'queued', startedAt: null, createdAt: '2026-10-01T08:00:00Z' }), ctx);
    expect(row).toMatchObject({ label: '排队中', tone: 'info', queued: true, progress: 'indet', startedAt: '2026-10-01T08:00:00Z' });
    expect(row.action).toEqual({ type: 'cancel', jobId: 'j2' });
  });

  it('queued waiting for resources: the detail line gives the reason the Runtime recorded', () => {
    const wait = { reason: 'resources' as const, dimensions: ['memory' as const], detail: '等待资源：内存不够', since: '2026-10-01T08:00:00Z' };
    expect(jobRow(job({ jobId: 'j3', state: 'queued', phase: 'queued', startedAt: null, wait }), ctx).phase).toBe('等待资源：内存不够');
    expect(jobRow(job({ jobId: 'j4', state: 'queued', phase: 'queued', startedAt: null }), ctx).phase).toBeNull();
  });

  it('finished: completed / failed / cancelled / interrupted, no actions or progress bar', () => {
    const states = ['completed', 'failed', 'cancelled', 'interrupted'] as const;
    const rows = states.map((state) => jobRow(job({ jobId: state, state, phase: 'done', endedAt: '2026-10-01T09:10:00Z' }), ctx));
    expect(rows.map((r) => [r.label, r.tone])).toEqual([
      ['已完成', 'positive'],
      ['失败', 'negative'],
      ['已取消', 'neutral'],
      ['已中断', 'neutral'],
    ]);
    expect(rows.every((r) => r.action === null && r.progress === null && !r.live)).toBe(true);
  });

  it('auto-rerunning after a crash (interrupted, no endedAt) still counts as in progress: cancellable, indeterminate progress', () => {
    const row = jobRow(job({ jobId: 'r', state: 'interrupted', phase: 'transcribing', endedAt: null }), ctx);
    expect(row).toMatchObject({ label: '出错后自动重试', tone: 'accent', live: true, progress: 'indet' });
    expect(row.action).toEqual({ type: 'cancel', jobId: 'r' });
  });

  it('source chip: agent → "Agent" and links back to the session; connection → "命令行"; system and node are not shown', () => {
    const agent = jobRow(job({ jobId: 'j', submitter: { kind: 'agent', id: 'c2', taskId: 't9' }, videoId: null }), ctx);
    expect(agent).toMatchObject({ chip: 'agent', conversationId: 'c2', projectId: 'p1' });
    expect(jobRow(job({ jobId: 'j', submitter: { kind: 'connection', id: 'x' } }), ctx).chip).toBe('cli');
    expect(jobRow(job({ jobId: 'j', submitter: { kind: 'system', id: 'runtime' } }), ctx).chip).toBeNull();
    expect(jobRow(job({ jobId: 'j', submitter: { kind: 'node', id: 'peer' } }), ctx).chip).toBeNull();
  });

  it('generation task titles use the first 40 characters of the prompt or source text; transcription not in the open video only reads its kind', () => {
    const prompt = '一只橘猫趴在老城区的窗台上晒太阳，窗外是层层叠叠的灰瓦屋顶，水彩风格，暖色调，笔触松弛，留白多一些';
    const image = jobRow(
      job({
        jobId: 'g',
        kind: 'generateImage',
        generation: { capability: 'generateImage', prompt, size: null, aspectRatio: '1:1', count: 1, format: 'png', seed: null },
      }),
      ctx,
    );
    expect(image.title).toBe(`${Array.from(prompt).slice(0, 40).join('')}…`);
    const speech = jobRow(
      job({
        jobId: 's',
        kind: 'synthesizeSpeech',
        generation: { capability: 'synthesizeSpeech', text: '大家好', voice: 'alloy', language: 'zh', format: 'mp3', instructions: null, speed: null, seed: null },
      }),
      ctx,
    );
    expect(speech.title).toBe('大家好');
    expect(jobRow(job({ jobId: 't', videoId: 'other' }), ctx).title).toBe('转录');
  });

  it('export: the title reads the kind and format plus the video name, the location is the export folder, the stage is described by kind', () => {
    const row = jobRow(
      job({
        jobId: 'x1',
        kind: 'export',
        phase: 'generating',
        modelId: 'export:video',
        progress: { done: 1200, total: 3600, unit: 'frames' },
        export: {
          settings: { kind: 'video', format: 'mp4' },
          snapshotArtifactId: 'snap',
          videoRevision: '3',
          sequenceId: 'seq',
          destination: { dir: '/Users/me/Movies/发布会/exports', files: ['主视频.mp4'], overwrite: false },
        },
      }),
      ctx,
    );
    expect(row).toMatchObject({
      kind: 'export',
      title: '导出视频 · MP4 · 主视频',
      where: '~/Movies/发布会/exports · 本机',
      phase: '编码中',
      label: '编码中 · 33%',
    });
  });

  it('import from link: the title is the parsed video title, or the site before parsing', () => {
    const pipeline = {
      name: 'link-import',
      params: { url: 'https://www.youtube.com/watch?v=abc', host: 'youtube.com' },
      steps: [],
      current: 0,
      stoppedAt: null,
      summary: null,
    };
    const early = job({ jobId: 'j9', kind: 'pipeline', videoId: null, assetId: null, pipeline });
    expect(jobRow(early, ctx).title).toBe('从链接导入 · youtube.com');
    const summary = { title: '访谈第一集', files: { media: '/m.mp4', subtitles: [] } };
    const done = job({ jobId: 'j9', kind: 'pipeline', videoId: null, assetId: null, pipeline: { ...pipeline, summary } });
    expect(jobRow(done, ctx).title).toBe('从链接导入 · 访谈第一集');
  });

  it('link import and tool and font tasks run locally: the location is the tool and version · local, never reads "云端"; import stages use the workflow\'s wording', () => {
    const pipeline = {
      name: 'link-import',
      params: { url: 'https://www.youtube.com/watch?v=abc', host: 'youtube.com' },
      steps: [],
      current: 0,
      stoppedAt: null,
      summary: null,
    };
    const link = jobRow(
      job({ jobId: 'j9', kind: 'pipeline', providerId: 'yt-dlp', modelId: '2026.08.19', phase: 'transcribing', pipeline }),
      ctx,
    );
    expect(link).toMatchObject({ where: 'yt-dlp 2026.08.19 · 本机', phase: '提交转录' });
    expect(jobRow(job({ jobId: 't1', kind: 'toolInstall', providerId: 'yt-dlp', modelId: '2026.09.01' }), ctx).where).toBe(
      'yt-dlp 2026.09.01 · 本机',
    );
    expect(jobRow(job({ jobId: 't2', kind: 'toolUpdate', providerId: 'ffmpeg', modelId: '7.1' }), ctx).where).toBe('ffmpeg 7.1 · 本机');
    expect(jobRow(job({ jobId: 'f1', kind: 'fontDownload', providerId: 'google-fonts', modelId: 'Inter' }), ctx).where).toBe(
      'Inter · 本机',
    );
  });
});

describe('jobRow: the agent translates itself', () => {
  it('title is "翻译 · 视频 · 语言", location only reads local · Driver, stage is sentence-by-sentence translation, progress spins, no cancel; can open the session', () => {
    const row = jobRow(
      job({
        jobId: 'at1',
        kind: 'agentTranslate',
        videoId: 'v1',
        phase: 'generating',
        providerId: 'agent:codex',
        modelId: 'codex',
        submitter: { kind: 'agent', id: 'c1', taskId: 't1' },
        translation: { sourceDocumentId: 'd1', targetLanguage: 'en', sentences: 62 },
      }),
      ctx,
    );
    expect(row).toMatchObject({
      kind: 'agentTranslate',
      title: '翻译 · 主视频 · 英语',
      where: '本机 · Codex',
      phase: 'Agent 逐句翻译',
      label: 'Agent 逐句翻译',
      pct: null,
      progress: 'indet',
      action: null,
      chip: 'agent',
      conversationId: 'c1',
      projectId: 'p1',
    });
  });
});

describe('agentRow', () => {
  it('running: reuses the task status word, spins, can be stopped', () => {
    const row = agentRow(task({ taskId: 't1', projectId: 'p1', conversationTitle: '剪口播' }), ctx);
    expect(row).toMatchObject({
      kind: 'agent',
      label: '正在工作',
      tone: 'accent',
      progress: 'indet',
      action: { type: 'stop', taskId: 't1' },
      where: '产品发布会 › 剪口播',
      videoId: null,
      chip: null,
    });
  });

  it('session awaiting approval: reads "需要你确认", no progress bar', () => {
    const row = agentRow(task({ taskId: 't2', conversationId: 'c2' }), ctx);
    expect(row).toMatchObject({ waiting: true, label: '需要你确认', tone: 'notice', progress: null, live: true });
  });

  it('stopping still counts as in progress but cannot be stopped again; when the session title matches the goal, only the project is written', () => {
    const row = agentRow(task({ taskId: 't3', status: 'stopping', goal: '剪口播', conversationTitle: '剪口播' }), ctx);
    expect(row).toMatchObject({ live: true, label: '正在停止', action: null, where: '不属于任何项目' });
  });

  it('finished: completed / stopped / failed', () => {
    const tones = (['completed', 'stopped', 'failed'] as const).map((status) => agentRow(task({ taskId: status, status }), ctx));
    expect(tones.map((r) => [r.label, r.tone, r.live])).toEqual([
      ['已完成', 'positive', false],
      ['已停止', 'neutral', false],
      ['失败', 'negative', false],
    ]);
  });
});

describe('taskRows / taskGroups', () => {
  it('agent tasks and jobs are merged into one table, later ones first; in progress includes queued and stopping', () => {
    const rows = taskRows(
      [task({ taskId: 'a', status: 'completed', startedAt: '2026-10-01T08:00:00Z' }), task({ taskId: 'c', status: 'stopping', startedAt: '2026-10-01T10:00:00Z' })],
      [
        job({ jobId: 'b', state: 'queued', startedAt: null, createdAt: '2026-10-01T09:00:00Z' }),
        job({ jobId: 'd', state: 'failed', startedAt: '2026-10-01T11:00:00Z' }),
      ],
      ctx,
    );
    expect(rows.map((r) => r.id)).toEqual(['d', 'c', 'b', 'a']);
    const [active, history] = taskGroups(rows);
    expect(active.items.map((r) => r.id)).toEqual(['c', 'b']);
    expect(history.items.map((r) => r.id)).toEqual(['d', 'a']);
    expect([active.label, history.label]).toEqual(['进行中', '历史']);
  });

  it('fixed-workflow steps are folded under the parent task and get no row of their own; a running transcription submitted by the workflow merges into one row with it', () => {
    const jobs = [
      job({ jobId: 'parent', kind: 'pipeline' }),
      job({ jobId: 'step', kind: 'pipeline-step', parentJobId: 'parent' }),
      job({ jobId: 'asr', kind: 'transcribe', submitter: { kind: 'pipeline', id: 'parent' } }),
    ];
    expect(taskRows([], jobs, ctx).map((r) => r.id)).toEqual(['parent']);
    expect(
      taskRows([], jobs, ctx, { fold: false })
        .map((r) => r.id)
        .sort(),
    ).toEqual(['asr', 'parent']);
  });

  it('transcription workflow (re-transcribe): merged into one row with its transcript, reads the transcription\'s title, stage and the transcript\'s progress, not "流程" or a 50% based on step count', () => {
    const replace = { documentId: 'd1', revision: '1', fingerprint: 'f', translations: 'carry' };
    const steps = [
      { name: 'target', label: '目标', status: 'skipped' as const, jobId: null, attempts: 0, output: null },
      { name: 'transcribe', label: '转写', status: 'running' as const, jobId: 'step', attempts: 1, output: null },
    ];
    const pipeline = {
      name: 'transcribe',
      params: { videoId: 'v1', landing: { kind: 'replace', assetId: 'a1', replace } },
      steps,
      current: 1,
      stoppedAt: null,
      summary: null,
    };
    const parent = job({
      jobId: 'retx',
      kind: 'pipeline',
      assetId: null,
      modelId: 'qwen3-asr-1.7b@mlx-8bit',
      progress: { done: 2, total: 4, unit: 'steps' },
      submitter: { kind: 'agent', id: 'c1', taskId: 't1' },
      pipeline,
    });
    const asr = job({
      jobId: 'asr',
      kind: 'transcribe',
      modelId: 'qwen3-asr-1.7b@mlx-8bit',
      progress: { done: 1, total: 34, unit: 'segments' },
      submitter: { kind: 'pipeline', id: 'retx' },
    });
    const [row, ...rest] = taskRows([], [parent, asr], ctx);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      id: 'retx',
      title: '转录 · 主视频 · interview.mp4',
      kind: 'transcribe',
      kindText: '转录',
      where: 'qwen3-asr-1.7b@mlx-8bit · 本机',
      label: '识别中 · 2%',
      pct: 2,
      chip: 'agent',
      conversationId: 'c1',
      action: { type: 'cancel', jobId: 'retx' },
    });
    // While the transcription is queued, this row is also queued.
    expect(taskRows([], [parent, { ...asr, state: 'queued', progress: null }], ctx)[0]).toMatchObject({ id: 'retx', queued: true, label: '排队中' });
    // Transcription is done and the pipeline is still writing back: it still shows “Transcription” with its title, not “Pipeline”.
    const writing = taskRows([], [{ ...parent, phase: 'applying', progress: { done: 3, total: 4, unit: 'steps' } }, { ...asr, state: 'completed' }], ctx);
    expect(writing.find((r) => r.id === 'retx')).toMatchObject({ kind: 'transcribe', kindText: '转录', title: '转录 · 主视频 · interview.mp4' });
    // When the editor does not have this video open, only the kind is shown.
    expect(jobRow(parent, { ...ctx, video: null })).toMatchObject({ title: '转录', kindText: '转录' });
  });

  it('link import that reaches transcription: merged into one row with its transcription, keeps the import\'s ID, title and cancel, reads the transcription\'s stage, progress and model · local', () => {
    const pipeline = { name: 'link-import', params: { host: 'youtube.com' }, steps: [], current: 0, stoppedAt: null, summary: null };
    const parent = job({ jobId: 'imp', kind: 'pipeline', providerId: 'yt-dlp', modelId: '2026.08.19', phase: 'transcribing', pipeline });
    const asr = job({
      jobId: 'asr',
      kind: 'transcribe',
      modelId: 'qwen3-asr',
      progress: { done: 62, total: 100, unit: 'seconds' },
      submitter: { kind: 'pipeline', id: 'imp' },
    });
    const [row, ...rest] = taskRows([], [parent, asr], ctx);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      id: 'imp',
      title: '从链接导入 · youtube.com',
      kind: 'transcribe',
      kindText: '转录',
      where: 'qwen3-asr · 本机',
      phase: '识别中',
      pct: 62,
      action: { type: 'cancel', jobId: 'imp' },
    });
    // Task details find the row as-is by ID; after transcription ends (or the import has already ended), each stands on its own.
    expect(
      taskRows([], [parent, asr], ctx, { fold: false })
        .map((r) => r.id)
        .sort(),
    ).toEqual(['asr', 'imp']);
    const ended = taskRows([], [parent, { ...asr, state: 'completed' }], ctx);
    expect(ended.find((r) => r.id === 'imp')).toMatchObject({
      kind: 'pipeline',
      kindText: '从链接导入',
      where: 'yt-dlp 2026.08.19 · 本机',
    });
    expect(ended.map((r) => r.id).sort()).toEqual(['asr', 'imp']);
  });

  it('the link import step that creates the subtitle layer reads "生成字幕", not the imported video', () => {
    const steps = [
      { name: 'import', label: '导入', status: 'completed' as const, jobId: null, attempts: 1, output: null },
      { name: 'captions', label: '字幕层', status: 'running' as const, jobId: null, attempts: 1, output: null },
    ];
    const pipeline = { name: 'link-import', params: { host: 'youtube.com' }, steps, current: 1, stoppedAt: null, summary: null };
    expect(jobRow(job({ jobId: 'cap', kind: 'pipeline', phase: 'applying', pipeline }), ctx).phase).toBe('生成字幕');
  });
});
