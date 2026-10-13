import { describe, expect, it } from 'vitest';
import type { JobRecord, ModelCapabilitiesView, PipelineStepState, SpaceEntry, TimelineItem } from '@cuccut/protocol';
import { conversationOutputs } from './conversation-outputs.ts';
import { buildThread } from './thread.ts';
import {
  asrFacts,
  asrLine,
  asrModelName,
  cardRows,
  conversationJobVideos,
  conversationVideoJobs,
  downloadCardView,
  foldRows,
  jobRowView,
  needsAction,
  threadCards,
  videoStatus,
  type JobRowView,
} from './video-cards.ts';

const CONV = 'conv_1';
const at = (s: number) => new Date(Date.UTC(2026, 9, 2, 0, 0, s)).toISOString();

const user = (id: string, taskId: string, sent = 0): TimelineItem => ({
  kind: 'user-message',
  id,
  createdAt: at(sent),
  taskId,
  text: '你好',
});
const reply = (id: string, taskId: string): TimelineItem => ({
  kind: 'agent-message',
  id,
  createdAt: at(0),
  taskId,
  text: '好的',
  streaming: false,
});
const tool = (id: string, taskId: string, title = 'cuccut.transcribe'): TimelineItem => ({
  kind: 'tool-call',
  id,
  createdAt: at(0),
  taskId,
  tool: 'mcp',
  title,
  detail: null,
  output: '',
  status: 'completed',
  exitCode: null,
  durationMs: null,
});
const created = (videoId: string, taskId: string): TimelineItem => ({
  kind: 'video-created',
  id: `created/${videoId}`,
  createdAt: at(0),
  taskId,
  videoId,
  videoName: `新视频 ${videoId}`,
  target: { conversationId: CONV, path: `新视频 ${videoId}` },
  videoRevision: '1',
});
const change = (id: string, videoId: string, taskId: string): TimelineItem => ({
  kind: 'video-change',
  id: `change/${id}`,
  createdAt: at(0),
  taskId,
  videoId,
  videoName: '样片',
  target: { projectId: 'p1', path: '样片' },
  transactionId: id,
  label: '剪掉口误',
  previousRevision: '1',
  videoRevision: '2',
  createdIds: [],
  updatedIds: [],
  deletedIds: [],
  durationSeconds: { before: 10, after: 8 },
  undoOf: null,
});

const step = (name: string, status: PipelineStepState['status'], extra: Partial<PipelineStepState> = {}): PipelineStepState => ({
  name,
  label: name,
  status,
  jobId: null,
  attempts: 1,
  output: null,
  ...extra,
});

let n = 0;
function job(patch: Partial<JobRecord> = {}): JobRecord {
  n++;
  return {
    jobId: `job_${n}`,
    kind: 'transcribe',
    state: 'running',
    phase: 'transcribing',
    progress: null,
    videoId: 'mov_1',
    assetId: null,
    assetRevision: null,
    contentHash: '',
    providerId: 'local',
    modelId: 'large-v3',
    bundleId: null,
    inputHash: '',
    submitter: { kind: 'agent', id: CONV, taskId: 't1' },
    attempt: 1,
    createdAt: at(n),
    updatedAt: at(n),
    startedAt: at(n),
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    ...patch,
  } as JobRecord;
}

function linkJob(patch: Partial<JobRecord> = {}): JobRecord {
  return job({
    kind: 'pipeline',
    phase: 'downloading',
    videoId: null,
    providerId: 'yt-dlp',
    pipeline: {
      name: 'link-import',
      params: { url: 'https://www.youtube.com/watch?v=abc', host: 'youtube.com', audioOnly: false, outDir: '/d' },
      steps: [step('resolve', 'completed'), step('download', 'running', { jobId: 'job_dl' }), step('publish', 'pending')],
      current: 1,
      stoppedAt: null,
      summary: null,
    },
    ...patch,
  });
}

function translateJob(patch: Partial<JobRecord> = {}): JobRecord {
  return job({
    kind: 'pipeline',
    phase: 'generating',
    providerId: 'openai',
    modelId: 'gpt-5',
    pipeline: {
      name: 'translate',
      params: { videoId: 'mov_1', documentId: 'doc_speech', targetLanguage: 'en' },
      steps: [step('freeze-source', 'completed'), step('translate', 'running', { label: '翻译' }), step('assemble', 'pending'), step('write', 'pending')],
      current: 1,
      stoppedAt: null,
      summary: null,
    },
    ...patch,
  });
}

/** The agent's own translation in the session (`agentTranslate`): no steps, no percentage. */
function agentTranslateJob(patch: Partial<JobRecord> = {}): JobRecord {
  return job({
    kind: 'agentTranslate',
    phase: 'generating',
    providerId: 'agent:codex',
    modelId: 'codex',
    translation: { sourceDocumentId: 'doc_speech', targetLanguage: 'en', sentences: 62 },
    ...patch,
  });
}

const cards = (items: TimelineItem[], jobs: JobRecord[], entries: SpaceEntry[] = []) => {
  const blocks = buildThread(items);
  const map = threadCards({ blocks, items, jobs, conversationId: CONV, entries });
  return Object.fromEntries(
    [...map].map(([id, list]) => [
      id,
      list.map((c) => (c.kind === 'video' ? `video:${c.video.id}[${c.jobIds.join(',')}]` : `download:${c.jobId}`)),
    ]),
  );
};

describe('threadCards: placement', () => {
  it('internal check exports never enter cards or outputs in any state; formal 1-second segments and legacy records still display', () => {
    const items = [user('u1', 't1'), tool('c1', 't1', 'cuccut.export'), reply('a1', 't1')];
    const preview = (state: JobRecord['state']) => job({
      kind: 'export', state,
      export: { settings: { kind: 'video', format: 'mp4', purpose: 'preview', ranges: [{ start: 1.7, end: 2.7 }, { start: 29.5, end: 30.5 }, { start: 46, end: 47 }] } } as JobRecord['export'],
    });
    const hidden = ['queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted'].map((s) => preview(s as JobRecord['state']));
    expect(cards(items, hidden)).toEqual({});
    expect(conversationVideoJobs('mov_1', hidden, CONV)).toEqual([]);
    expect(conversationJobVideos(hidden, CONV)).toEqual([]);
    expect(cardRows(hidden.map((j) => j.jobId), hidden)).toEqual([]);
    const delivered = job({ kind: 'export', state: 'completed', export: { settings: { kind: 'video', format: 'mp4', purpose: 'deliverable', ranges: [{ start: 0, end: 1 }] } } as JobRecord['export'] });
    const legacy = job({ kind: 'export', state: 'completed', export: { settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 1 } } } as JobRecord['export'] });
    const jobs = [delivered, legacy, ...hidden];
    expect(cards(items, jobs)).toEqual({ 'steps/c1': [`video:mov_1[${delivered.jobId},${legacy.jobId}]`] });
    expect(conversationVideoJobs('mov_1', jobs, CONV)).toEqual([delivered.jobId, legacy.jobId]);
    const rows = cardRows(jobs.map((j) => j.jobId), jobs).map((j) => jobRowView(j, jobs, 0));
    expect(foldRows(rows).earlier.map((r) => r.jobId)).toEqual([delivered.jobId]);
  });

  it('one card per video per turn, attached after the last block in that turn that references it', () => {
    const items = [
      user('u1', 't1'),
      tool('c1', 't1'),
      change('x1', 'mov_1', 't1'),
      reply('a1', 't1'),
      tool('c2', 't1'),
      change('x2', 'mov_1', 't1'),
    ];
    // Receipt and steps are one group: the card hangs after the second group of steps
    expect(cards(items, [])).toEqual({ 'steps/c2': ['video:mov_1[]'] });
  });

  it('a record for a newly created video attaches after the nearest preceding block; a later transcription Job moves the card to the task\'s last group of steps', () => {
    const t = job({ videoId: 'mov_2' });
    const items = [
      user('u1', 't1'),
      tool('c1', 't1', 'cuccut.videos_create'),
      created('mov_2', 't1'),
      reply('a1', 't1'),
      tool('c2', 't1'),
      reply('a2', 't1'),
    ];
    expect(cards(items, [t])).toEqual({ 'steps/c2': [`video:mov_2[${t.jobId}]`] });
    // Before there is a Job, the card sits after the create step.
    expect(cards(items, [])).toEqual({ 'steps/c1': ['video:mov_2[]'] });
  });

  it('jobs from other sessions and jobs the user submitted themselves do not enter the card; pipeline steps do not get their own row', () => {
    const other = job({ submitter: { kind: 'agent', id: 'conv_2', taskId: 't1' } });
    const mine = job({ submitter: { kind: 'connection', id: 'app' } });
    const items = [user('u1', 't1'), tool('c1', 't1'), reply('a1', 't1')];
    expect(cards(items, [other, mine])).toEqual({});
  });

  it('download card: one while the parent task has no video yet; once the video is created, the same position is replaced by a video card, and the transcription submitted by the pipeline becomes a row', () => {
    const items = [user('u1', 't1'), tool('c1', 't1', 'cuccut.download'), reply('a1', 't1')];
    const parent = linkJob();
    const dl = job({
      jobId: 'job_dl',
      kind: 'pipeline',
      parentJobId: parent.jobId,
      submitter: { kind: 'pipeline', id: parent.jobId },
    } as Partial<JobRecord>);
    expect(cards(items, [parent, dl])).toEqual({ 'steps/c1': [`download:${parent.jobId}`] });

    const withVideo = { ...parent, videoId: 'mov_9', phase: 'transcribing' as const };
    const tr = job({ videoId: 'mov_9', submitter: { kind: 'pipeline', id: parent.jobId } });
    expect(cards(items, [withVideo, dl, tr])).toEqual({ 'steps/c1': [`video:mov_9[${parent.jobId},${tr.jobId}]`] });
  });

  it('several cards at the same position are ordered by first reference', () => {
    const items = [user('u1', 't1'), change('x1', 'mov_b', 't1'), change('x2', 'mov_a', 't1'), tool('c1', 't1'), reply('a1', 't1')];
    const a = job({ videoId: 'mov_a' });
    const b = job({ videoId: 'mov_b' });
    expect(cards(items, [a, b])).toEqual({ 'steps/change/x1': [`video:mov_b[${b.jobId}]`, `video:mov_a[${a.jobId}]`] });
  });
});

describe('threadCards: one card per video per conversation (product design §3.2.2)', () => {
  it('when a later turn references it again, the card moves to the latest reference; earlier turns no longer have it', () => {
    const items = [
      user('u1', 't1', 10),
      change('x1', 'mov_1', 't1'),
      reply('a1', 't1'),
      user('u2', 't2', 20),
      reply('a2', 't2'),
      change('x2', 'mov_1', 't2'),
      user('u3', 't3', 30),
      reply('a3', 't3'),
    ];
    expect(cards(items, [])).toEqual({ 'steps/change/x2': ['video:mov_1[]'] });
    // When only the first round exists, the card sits after the first round's reference
    expect(cards(items.slice(0, 3), [])).toEqual({ 'steps/change/x1': ['video:mov_1[]'] });
  });

  // The first round's task submitted a transcription and the second round is just chat: whether the card follows over depends on whether the transcription had finished when the second round started.
  const twoTurns = [user('u1', 't1', 10), tool('c1', 't1'), reply('a1', 't1'), user('u2', 't2', 20), reply('a2', 't2')];

  it('transcription still running at the next user message: the card attaches to the last block of the latest turn; queued counts as not finished either', () => {
    const running = job({ state: 'running' });
    expect(cards(twoTurns, [running])).toEqual({ a2: [`video:mov_1[${running.jobId}]`] });
    const queued = job({ state: 'queued', startedAt: null });
    expect(cards(twoTurns, [queued])).toEqual({ a2: [`video:mov_1[${queued.jobId}]`] });
    // When a new round has only the user's message, the card hangs after that message
    expect(cards(twoTurns.slice(0, 4), [running])).toEqual({ u2: [`video:mov_1[${running.jobId}]`] });
  });

  it('transcription finished before the next user message: the card stays where it is; failed and cancelled are counted by their end time too', () => {
    const done = job({ state: 'completed', endedAt: at(15) });
    expect(cards(twoTurns, [done])).toEqual({ 'steps/c1': [`video:mov_1[${done.jobId}]`] });
    const failed = job({ state: 'failed', endedAt: at(18) });
    expect(cards(twoTurns, [failed])).toEqual({ 'steps/c1': [`video:mov_1[${failed.jobId}]`] });
  });

  it('agent\'s own translation makes a row on the card; while running, the card follows the latest turn', () => {
    const transcribed = job({ state: 'completed', endedAt: at(15) });
    const translating = agentTranslateJob();
    expect(cards(twoTurns, [transcribed, translating])).toEqual({ a2: [`video:mov_1[${transcribed.jobId},${translating.jobId}]`] });
  });

  it('transcription finished in the second turn: after the third turn starts the card stays in the second turn and does not move back; if still running all along, it follows to the latest turn', () => {
    const three = [...twoTurns, user('u3', 't3', 30), reply('a3', 't3')];
    const ended = job({ state: 'completed', endedAt: at(25) });
    expect(cards(three, [ended])).toEqual({ a2: [`video:mov_1[${ended.jobId}]`] });
    const running = job();
    expect(cards(three, [running])).toEqual({ a3: [`video:mov_1[${running.jobId}]`] });
  });

  it('running work does not move within the turn that references it: the card stays after the last reference', () => {
    const running = job();
    expect(cards(twoTurns.slice(0, 3), [running])).toEqual({ 'steps/c1': [`video:mov_1[${running.jobId}]`] });
  });

  it('turn one\'s transcription still running and it is referenced again mid-turn two: still one card, attached to the last block of turn two', () => {
    const running = job();
    const items = [...twoTurns.slice(0, 4), change('x2', 'mov_1', 't2'), reply('a2', 't2')];
    expect(cards(items, [running])).toEqual({ a2: [`video:mov_1[${running.jobId}]`] });
  });

  it('the card shows all of the conversation\'s work on this video: work from earlier turns that has ended is collapsed into \'N earlier items\'', () => {
    const items = [
      user('u1', 't1', 10),
      tool('c1', 't1'),
      reply('a1', 't1'),
      user('u2', 't2', 20),
      tool('c2', 't2', 'cuccut.export'),
      reply('a2', 't2'),
    ];
    const tx = job({ state: 'completed', endedAt: at(15), result: { documentId: 'doc_1', artifactId: 'art_doc' } });
    const ex = job({ kind: 'export', state: 'running', submitter: { kind: 'agent', id: CONV, taskId: 't2' } });
    const jobs = [tx, ex];
    expect(cards(items, jobs)).toEqual({ 'steps/c2': [`video:mov_1[${tx.jobId},${ex.jobId}]`] });
    expect(conversationVideoJobs('mov_1', jobs, CONV)).toEqual([tx.jobId, ex.jobId]);
    const f = foldRows(cardRows([tx.jobId, ex.jobId], jobs).map((j) => jobRowView(j, jobs, 0)));
    expect([f.shown.map((r) => r.jobId), f.earlier.map((r) => r.jobId)]).toEqual([[ex.jobId], [tx.jobId]]);
  });
});

describe('threadCards: video brought in with the first message (product design §3.2.2, §5.1)', () => {
  const opened = (id: string, taskId: string, sent: number, videoId = 'mov_1'): TimelineItem => ({
    kind: 'user-message',
    id,
    createdAt: at(sent),
    taskId,
    text: '把口癖剪掉',
    context: { videoId, videoName: '访谈第一集', videoPath: 'videos/访谈第一集', revision: '3', selection: [], playheadSeconds: 0 },
  });

  it('the first message carries editor state: the video card attaches after this message, named from the message', () => {
    const items = [opened('u1', 't1', 10), reply('a1', 't1')];
    expect(cards(items, [])).toEqual({ u1: ['video:mov_1[]'] });
    const card = [...threadCards({ blocks: buildThread(items), items, jobs: [], conversationId: CONV, entries: [] }).values()][0]![0]!;
    expect(card.kind === 'video' ? card.video : null).toMatchObject({ name: '访谈第一集', at: at(10) });
  });

  it('agent later edited this video: still one card, moved to the last reference', () => {
    expect(cards([opened('u1', 't1', 10), change('x1', 'mov_1', 't1'), reply('a1', 't1')], [])).toEqual({ 'steps/change/x1': ['video:mov_1[]'] });
  });

  it('only the first counts: later messages carrying editor state produce no card and do not move it', () => {
    expect(cards([user('u1', 't1', 10), reply('a1', 't1'), opened('u2', 't2', 20), reply('a2', 't2')], [])).toEqual({});
    expect(cards([opened('u1', 't1', 10), reply('a1', 't1'), opened('u2', 't2', 20), reply('a2', 't2')], [])).toEqual({ u1: ['video:mov_1[]'] });
  });

  it('the conversation summary\'s outputs also list this video', () => {
    const outputs = conversationOutputs({ id: CONV, projectId: 'p1' }, [opened('u1', 't1', 10), reply('a1', 't1')], [], Infinity, []);
    expect(outputs.map((o) => [o.kind, o.id, o.name])).toEqual([['video', 'mov_1', '访谈第一集']]);
  });
});

describe('videoOutput (via threadCards)', () => {
  it('a video created by a pipeline finds its name and position by the Space entry\'s ref.videoId; position is null when not found', () => {
    const items = [user('u1', 't1'), tool('c1', 't1'), reply('a1', 't1')];
    const tr = job({ videoId: 'mov_9' });
    const entry = {
      id: 'e1',
      kind: 'video',
      name: '访谈第一集',
      fileName: '访谈第一集',
      source: { projectId: 'p1', conversationId: null },
      relPath: 'videos/访谈第一集',
      size: 1,
      lastActivityAt: at(0),
      status: null,
      ref: { videoId: 'mov_9' },
      user: { favorite: false, displayName: null, trashedAt: null },
    } as unknown as SpaceEntry;
    const first = (entries: SpaceEntry[]) => {
      const blocks = buildThread(items);
      const card = [...threadCards({ blocks, items, jobs: [tr], conversationId: CONV, entries }).values()][0]![0]!;
      return card.kind === 'video' ? card.video : null;
    };
    expect(first([entry])).toMatchObject({ name: '访谈第一集', video: { projectId: 'p1', path: 'videos/访谈第一集' } });
    expect(first([])).toMatchObject({ name: '视频', video: null });
  });
});

describe('videoStatus', () => {
  it('running transcription first, with percentage; queued; has a transcript is transcribed; has failed is failed; not shown when unknown', () => {
    expect(videoStatus('mov_1', [job({ progress: { done: 45, total: 100, unit: 'seconds' } })], false)?.text).toBe('转录中 · 45%');
    expect(videoStatus('mov_1', [job({ progress: { done: 3, total: null, unit: 'segments' } })], false)?.text).toBe('转录中');
    expect(videoStatus('mov_1', [job({ state: 'queued' })], false)?.text).toBe('排队中');
    const done = job({ state: 'completed', result: { documentId: 'doc_1', artifactId: 'art_doc' } });
    expect(videoStatus('mov_1', [done], false)?.key).toBe('transcribed');
    expect(videoStatus('mov_1', [], true)?.key).toBe('transcribed');
    const failed = job({ state: 'failed', error: { code: 'X', message: '模型崩了', details: null } as JobRecord['error'] });
    expect(videoStatus('mov_1', [failed], false)?.text).toBe('失败');
    expect(videoStatus('mov_1', [failed, done], false)?.key).toBe('transcribed');
    expect(videoStatus('mov_1', [], false)).toBeNull();
    expect(videoStatus('mov_1', [job({ kind: 'export' })], false)).toBeNull();
  });

  it('when no transcription is running and a translation is, it is translating: percentage only when there is a single translation pipeline; agent\'s own translation has no percentage', () => {
    const done = job({ state: 'completed', result: { documentId: 'doc_1', artifactId: 'art_doc' } });
    const pipeline = translateJob();
    expect(videoStatus('mov_1', [done, pipeline], false)).toEqual({ key: 'translating', text: '翻译中 · 5%' });
    expect(videoStatus('mov_1', [done, agentTranslateJob()], true)).toEqual({ key: 'translating', text: '翻译中' });
    // Two things running at once: no percentage is written.
    expect(videoStatus('mov_1', [pipeline, agentTranslateJob()], false)?.text).toBe('翻译中');
    // A pipeline with no steps yet does not show 0%.
    const fresh = translateJob({ pipeline: { ...pipeline.pipeline!, steps: [] } });
    expect(videoStatus('mov_1', [fresh], false)?.text).toBe('翻译中');
    // While the transcription is running or queued, it takes precedence; a translation that is queued or has ended does not count.
    expect(videoStatus('mov_1', [job(), agentTranslateJob()], false)?.key).toBe('transcribing');
    expect(videoStatus('mov_1', [job({ state: 'queued' }), agentTranslateJob()], false)?.key).toBe('queued');
    expect(videoStatus('mov_1', [done, translateJob({ state: 'queued' })], false)?.key).toBe('transcribed');
    expect(videoStatus('mov_1', [done, agentTranslateJob({ state: 'completed', endedAt: at(9) })], false)?.key).toBe('transcribed');
    // Translations of other videos do not count.
    expect(videoStatus('mov_1', [agentTranslateJob({ videoId: 'mov_2' })], false)).toBeNull();
  });
});

describe('jobRowView', () => {
  const now = Date.parse(at(0)) + 90_000;

  it('transcription running: stage and per-second count, percentage, elapsed time, can cancel; no \'estimated remaining\'', () => {
    const j = job({ progress: { done: 62, total: 206, unit: 'seconds' }, startedAt: at(0) });
    const row = jobRowView(j, [j], now);
    expect(row).toMatchObject({
      name: '转录',
      state: 'running',
      tail: '30%',
      pct: 30,
      elapsed: '已用 1:30',
      canCancel: true,
      canRetry: false,
    });
    expect(row.line).toContain('已识别 1:02 / 3:26');
  });

  it('no percentage without a total; counted by segments', () => {
    const j = job({ progress: { done: 12, total: null, unit: 'segments' } });
    const row = jobRowView(j, [j], now);
    expect(row.pct).toBeNull();
    expect(row.tail).toBeNull();
    expect(row.line).toContain('已识别 12 段');
  });

  it('a video previously transcribed is called re-transcribe', () => {
    const old = job({ state: 'completed', endedAt: at(1) });
    const again = job();
    expect(jobRowView(again, [old, again], now).name).toBe('重新转录');
    expect(jobRowView(old, [old, again], now).name).toBe('转录');
  });

  it('completed shows result facts and warnings, no cancel', () => {
    const j = job({
      state: 'completed',
      endedAt: at(9),
      result: { documentId: 'doc_1', artifactId: 'art_doc' },
      warnings: [{ code: 'diarization-unavailable' }] as JobRecord['warnings'],
    });
    expect(jobRowView(j, [j], now)).toMatchObject({
      state: 'done',
      tail: '完成',
      facts: ['文稿已写进视频'],
      warnings: ['这个模型不能区分说话人'],
      canCancel: false,
      elapsed: null,
    });
  });

  it('failed shows the reason, with a remedy when there is a clear destination; interrupted transcription can be retried, failed cannot', () => {
    const failed = job({
      state: 'failed',
      endedAt: at(9),
      error: { code: 'MODEL_NOT_READY', message: '模型没装好', details: null } as JobRecord['error'],
    });
    const row = jobRowView(failed, [failed], now);
    expect(row).toMatchObject({ state: 'failed', error: '模型没装好', canRetry: false });
    expect(row.remedy?.target).toEqual({ tab: 'models', category: 'asr', page: 'local' });
    const interrupted = job({ state: 'interrupted', endedAt: at(9) });
    expect(jobRowView(interrupted, [interrupted], now)).toMatchObject({
      state: 'interrupted',
      tail: '已中断',
      canRetry: true,
      remedy: null,
    });
    const retrying = job({ state: 'interrupted', endedAt: null });
    expect(jobRowView(retrying, [retrying], now)).toMatchObject({ state: 'running', canRetry: false, canCancel: false });
  });

  it('agent\'s own translation: one row \'translation · language\', indeterminate progress, writes the total sentence count, no cancel; completed shows the language', () => {
    const j = agentTranslateJob({ startedAt: at(0) });
    expect(jobRowView(j, [j], now)).toMatchObject({
      kind: 'translate',
      name: '翻译 · en',
      state: 'running',
      tail: null,
      pct: null,
      line: 'Agent 逐句翻译 · 共 62 句',
      canCancel: false,
      canRetry: false,
    });
    const done = agentTranslateJob({ state: 'completed', endedAt: at(9), result: { documentId: 'doc_tr', artifactId: '' } });
    expect(jobRowView(done, [done], now)).toMatchObject({ state: 'done', tail: '完成', facts: ['en'], canCancel: false });
    const stopped = agentTranslateJob({ state: 'interrupted', endedAt: at(9) });
    expect(jobRowView(stopped, [stopped], now)).toMatchObject({ state: 'interrupted', canRetry: false });
  });

  it('translation pipeline running: steps and percentage, can cancel', () => {
    const j = translateJob();
    expect(jobRowView(j, [j], now)).toMatchObject({ kind: 'translate', name: '翻译 · en', tail: '5%', pct: 5, line: '翻译', canCancel: true });
  });

  it('cancelled shows \'cancelled\', no button', () => {
    const j = job({ state: 'cancelled', endedAt: at(9) });
    expect(jobRowView(j, [j], now)).toMatchObject({ tail: '已取消', canCancel: false, canRetry: false, remedy: null, error: null });
  });

  it('export completed lists files; the final video can play, the portable package cannot', () => {
    const j = job({
      kind: 'export',
      state: 'completed',
      endedAt: at(9),
      export: {
        settings: { kind: 'video', format: 'mp4' },
        destination: { dir: '/out', files: ['访谈.mp4'] },
      } as unknown as JobRecord['export'],
      result: {
        documentId: null,
        artifactId: null,
        outputs: [
          {
            artifactId: 'art_1',
            path: '/out/访谈.mp4',
            byteLength: 2_000_000,
            media: { kind: 'video', width: 1920, height: 1080, durationSec: 206 },
          },
          {
            artifactId: 'art_2',
            path: '/out/访谈.cuccut',
            byteLength: 1000,
            media: { kind: 'package', files: 3, assets: 2, missingAssets: 0 },
          },
        ],
      } as unknown as JobRecord['result'],
    });
    const row = jobRowView(j, [j], now);
    expect(row.files.map((f) => f.name)).toEqual(['访谈.mp4', '访谈.cuccut']);
    expect(row.files[0]!.meta).toContain('1920×1080');
    expect(row.playable).toEqual({ [row.files[0]!.key]: 'art_1' });
  });

  it('only the final video and audio can play: subtitles and AVI files the browser cannot play are only shown in the folder (product design §3.2.2)', () => {
    const out = (artifactId: string, path: string, media: object) => ({ artifactId, path, byteLength: 1000, media });
    const j = job({
      kind: 'export',
      state: 'completed',
      endedAt: at(9),
      result: {
        documentId: null,
        artifactId: null,
        outputs: [
          out('art_srt', '/out/访谈-en.srt', { kind: 'text', entries: 40, durationSec: 206 }),
          out('art_m4a', '/out/旁白.m4a', { kind: 'audio', durationSec: 206, sampleRate: 48000, channels: 2 }),
          out('art_avi', '/out/访谈.avi', {
            kind: 'video',
            durationSec: 206,
            width: 1920,
            height: 1080,
            videoCodec: 'mpeg4',
            audioCodec: null,
          }),
        ],
      } as unknown as JobRecord['result'],
    });
    const row = jobRowView(j, [j], now);
    expect(row.files.map((f) => !!f.path)).toEqual([true, true, true]);
    expect(row.playable).toEqual({ [row.files[1]!.key]: 'art_m4a' });
  });
});

describe('foldRows / needsAction (product design §3.2.2 \'N earlier items\')', () => {
  type R = { id: string; state: JobRowView['state']; remedy: JobRowView['remedy']; canRetry: boolean };
  const fix = { label: '去设置', hint: '', target: { tab: 'models' } } as unknown as JobRowView['remedy'];
  const row = (id: string, state: R['state'], extra: Partial<R> = {}): R => ({ id, state, remedy: null, canRetry: false, ...extra });
  const ids = (f: { shown: R[]; earlier: R[] }) => [f.shown.map((r) => r.id), f.earlier.map((r) => r.id)];

  it('when work is running or queued: only the in-progress items are expanded (in original order); finished ones, newest first, are collapsed', () => {
    expect(ids(foldRows([row('a', 'done'), row('b', 'cancelled'), row('c', 'done'), row('d', 'failed'), row('e', 'running')]))).toEqual([
      ['e'],
      ['d', 'c', 'b', 'a'],
    ]);
    expect(ids(foldRows([row('a', 'done'), row('b', 'running'), row('c', 'done'), row('d', 'queued')]))).toEqual([
      ['b', 'd'],
      ['c', 'a'],
    ]);
  });

  it('when all are finished, only the last one is expanded; with a single item there is nothing collapsed', () => {
    expect(ids(foldRows([row('a', 'failed'), row('b', 'done'), row('c', 'cancelled')]))).toEqual([['c'], ['b', 'a']]);
    expect(ids(foldRows([row('a', 'done')]))).toEqual([['a'], []]);
    expect(ids(foldRows([row('a', 'running')]))).toEqual([['a'], []]);
    expect(foldRows([])).toEqual({ shown: [], earlier: [], pending: 0 });
  });

  it('pending counts only collapsed items that failed or were interrupted and have a remedy or retry; expanded ones do not count', () => {
    const f = foldRows([
      row('a', 'failed', { remedy: fix }),
      row('b', 'interrupted', { canRetry: true }),
      row('c', 'failed'),
      row('d', 'cancelled'),
      row('e', 'done'),
    ]);
    expect([f.shown.map((r) => r.id), f.pending]).toEqual([['e'], 2]);
    expect(foldRows([row('a', 'done'), row('b', 'failed', { remedy: fix })]).pending).toBe(0);
    expect(foldRows([row('a', 'failed', { canRetry: true }), row('b', 'running')]).pending).toBe(1);
    expect(needsAction(row('x', 'failed', { remedy: fix }))).toBe(true);
    expect(needsAction(row('x', 'failed'))).toBe(false);
    expect(needsAction(row('x', 'cancelled', { canRetry: true }))).toBe(false);
  });

  it('follows cardRows and jobRowView: a previous transcription failure that can be fixed in settings is collapsed, and the card surfaces pending', () => {
    const failed = job({
      state: 'failed',
      endedAt: at(9),
      error: { code: 'MODEL_NOT_READY', message: '模型没装好', details: null } as JobRecord['error'],
    });
    const cancelled = job({ kind: 'export', state: 'cancelled', endedAt: at(9) });
    const jobs = [failed, cancelled];
    const views = cardRows([failed.jobId, cancelled.jobId], jobs).map((j) => jobRowView(j, jobs, 0));
    const f = foldRows(views);
    expect([f.shown.map((r) => r.jobId), f.earlier.map((r) => r.jobId), f.pending]).toEqual([[cancelled.jobId], [failed.jobId], 1]);
  });
});

describe('cardRows', () => {
  it('parent task imported from a link: the pipeline\'s transcription no longer takes a row once it is out, is not listed when complete, and stays on failure', () => {
    const parent = linkJob({ videoId: 'mov_9' });
    const tr = job({ videoId: 'mov_9', submitter: { kind: 'pipeline', id: parent.jobId } });
    expect(cardRows([parent.jobId], [parent]).map((j) => j.jobId)).toEqual([parent.jobId]);
    expect(cardRows([parent.jobId, tr.jobId], [parent, tr]).map((j) => j.jobId)).toEqual([tr.jobId]);
    expect(cardRows([parent.jobId], [{ ...parent, state: 'completed' }])).toEqual([]);
    const failed = { ...parent, state: 'failed' as const };
    expect(cardRows([failed.jobId], [failed]).map((j) => j.jobId)).toEqual([parent.jobId]);
  });
});

describe('transcription model and parameters (product design §3.2.2 \'transcription and re-transcription get separate rows\')', () => {
  const words = { auto: '自动检测', speakers: '识别说话人' };
  const view = {
    transcribe: {
      providers: [
        { providerId: 'local', kind: 'local', label: '本机', models: [{ modelId: 'moss-transcribe', label: 'MOSS Transcribe' }] },
        { providerId: 'openai', kind: 'online', label: 'OpenAI', models: [{ modelId: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe' }] },
      ],
    },
  } as unknown as ModelCapabilitiesView;
  const bundles = [{ bundleId: 'qwen3-asr-0.6b', label: 'Qwen3-ASR 0.6B' }];
  const line = (j: JobRecord, jobs: JobRecord[] = [j]) => {
    const f = asrFacts(j, jobs);
    return f ? asrLine(f, asrModelName(view, bundles, f.providerId, f.modelId), words) : null;
  };

  it('model name · local or cloud · language · speaker identification; written both while running and after it ends; auto-detect follows the transcription tool\'s wording', () => {
    const run = job({
      providerId: 'local',
      modelId: 'moss-transcribe',
      transcribe: { language: { mode: 'assert', tag: 'zh' }, diarize: true },
    });
    expect(line(run)).toBe('MOSS Transcribe · 本机 · 中文 · 识别说话人');
    const done = { ...run, state: 'completed' as const, endedAt: at(9) };
    expect(line(done)).toBe('MOSS Transcribe · 本机 · 中文 · 识别说话人');
    expect(jobRowView(done, [done], 0).asr).not.toBeNull();
    const cloud = job({
      providerId: 'openai',
      modelId: 'gpt-4o-transcribe',
      bundleId: null,
      transcribe: { language: { mode: 'prefer', tag: null }, diarize: false },
    });
    expect(line(cloud)).toBe('OpenAI · gpt-4o-transcribe · 云端 · 自动检测');
    // The model pack takes its name; when it is not in the capability view, the ID is written as-is
    expect(line(job({ modelId: 'qwen3-asr-0.6b', transcribe: { language: { mode: 'prefer', tag: null }, diarize: false } }))).toBe(
      'Qwen3-ASR 0.6B · 本机 · 自动检测',
    );
    expect(line(job({ modelId: 'mystery-asr', transcribe: { language: { mode: 'prefer', tag: null }, diarize: false } }))).toBe(
      'mystery-asr · 本机 · 自动检测',
    );
  });

  it('speaker identification is not written when the model cannot distinguish speakers (a warning was reported); this segment is not written when an earlier record has no language', () => {
    const asked = job({
      modelId: 'moss-transcribe',
      state: 'completed',
      endedAt: at(9),
      transcribe: { language: { mode: 'prefer', tag: null }, diarize: true },
      warnings: [{ code: 'diarization-unavailable' }] as JobRecord['warnings'],
    });
    expect(line(asked)).toBe('MOSS Transcribe · 本机 · 自动检测');
    expect(line(job({ modelId: 'moss-transcribe' }))).toBe('MOSS Transcribe · 本机');
  });

  it('non-transcription items have no such row', () => {
    expect(asrFacts(job({ kind: 'export' }), [])).toBeNull();
    expect(jobRowView(job({ kind: 'export' }), [], 0).asr).toBeNull();
  });

  it('transcription pipeline: the parent task\'s row takes the transcription Job it submitted; before submission it takes the frozen parameters; for an old record imported from a link, it falls back to the parent task\'s parameters', () => {
    const parent = job({
      kind: 'pipeline',
      providerId: 'local',
      modelId: 'moss-transcribe',
      pipeline: {
        name: 'transcribe',
        params: { videoId: 'mov_1', language: 'en', diarize: true },
        steps: [],
        current: 0,
        stoppedAt: null,
        summary: null,
      },
    });
    expect(line(parent, [parent])).toBe('MOSS Transcribe · 本机 · 英语 · 识别说话人');
    const child = job({
      modelId: 'qwen3-asr-0.6b',
      submitter: { kind: 'pipeline', id: parent.jobId },
      transcribe: { language: { mode: 'assert', tag: 'en' }, diarize: false },
    });
    expect(line(parent, [parent, child])).toBe('Qwen3-ASR 0.6B · 本机 · 英语');
    const link = linkJob({ videoId: 'mov_1' });
    link.pipeline = { ...link.pipeline!, params: { ...link.pipeline!.params, transcribe: true } };
    const old = job({ modelId: 'moss-transcribe', submitter: { kind: 'pipeline', id: link.jobId } });
    expect(line(old, [link, old])).toBe('MOSS Transcribe · 本机 · 自动检测');
  });

  it('a transcription pipeline\'s parent task and the transcription Job it submitted take only one row: when transcription is done but the pipeline fails while building the subtitle layer or later, the parent task\'s row stays', () => {
    const parent = job({
      kind: 'pipeline',
      pipeline: { name: 'transcribe', params: { videoId: 'mov_1' }, steps: [], current: 0, stoppedAt: null, summary: null },
    });
    const ids = (jobs: JobRecord[]) =>
      cardRows(
        jobs.map((j) => j.jobId),
        jobs,
      ).map((j) => j.jobId);
    expect(ids([parent])).toEqual([parent.jobId]);
    const child = job({ submitter: { kind: 'pipeline', id: parent.jobId } });
    expect(ids([parent, child])).toEqual([child.jobId]);
    const childDone = { ...child, state: 'completed' as const, endedAt: at(9) };
    expect(ids([parent, childDone])).toEqual([parent.jobId, child.jobId]);
    expect(ids([{ ...parent, state: 'completed', endedAt: at(9) }, childDone])).toEqual([child.jobId]);
    expect(ids([{ ...parent, state: 'failed', endedAt: at(9) }, childDone])).toEqual([parent.jobId, child.jobId]);
  });
});

describe('downloadCardView', () => {
  const now = Date.parse(at(0)) + 10_000;

  it('downloading: site, link, bytes and percentage, can cancel', () => {
    const parent = linkJob({ startedAt: at(0) });
    const dl = job({
      jobId: 'job_dl',
      kind: 'pipeline',
      parentJobId: parent.jobId,
      progress: { done: 12_000_000, total: 48_000_000, unit: 'bytes' },
    } as Partial<JobRecord>);
    const view = downloadCardView(parent, [parent, dl], now);
    expect(view).toMatchObject({
      state: 'running',
      title: '正在下载视频',
      name: 'youtube.com',
      source: 'https://www.youtube.com/watch?v=abc',
      pct: 25,
      canCancel: true,
      canRetry: false,
    });
    expect(view.line).toContain('MB');
    expect(view.elapsed).toBe('已用 0:10');
  });

  it('failed shows the reason; fixed pipelines offer no retry', () => {
    const parent = linkJob({
      state: 'failed',
      endedAt: at(9),
      error: { code: 'X', message: '网络断了', details: null } as JobRecord['error'],
    });
    const view = downloadCardView(parent, [parent], now);
    expect(view.state).toBe('failed');
    expect(view.error).toBeTruthy();
    expect(view).toMatchObject({ canRetry: false, canCancel: false, pct: null });
  });

  it('download only, no video created: completed writes the saved file', () => {
    const parent = linkJob({ state: 'completed', endedAt: at(9) });
    parent.pipeline = {
      ...parent.pipeline!,
      summary: {
        url: 'https://www.youtube.com/watch?v=abc',
        title: '访谈第一集',
        platform: 'youtube',
        files: { media: '/d/访谈第一集.mp4', subtitles: ['/d/访谈第一集.en.vtt'] },
        tool: { name: 'yt-dlp', version: '1', source: 'managed' },
        downloadedAt: at(9),
        videoId: null,
        assetId: null,
        transcribeJobId: null,
      },
    };
    const view = downloadCardView(parent, [parent], now);
    expect(view).toMatchObject({ state: 'done', title: '下载完成', name: '访谈第一集' });
    expect(view.files).toEqual([
      { name: '访谈第一集.mp4', path: '/d/访谈第一集.mp4' },
      { name: '访谈第一集.en.vtt', path: '/d/访谈第一集.en.vtt' },
    ]);
  });
});

describe('video work in the conversation (outputs popover)', () => {
  it('lists all of the conversation\'s work on this video, including that submitted by pipelines; other conversations\' work is not listed', () => {
    const parent = linkJob({ videoId: 'mov_9', submitter: { kind: 'agent', id: CONV, taskId: 't1' } });
    const tr = job({ videoId: 'mov_9', submitter: { kind: 'pipeline', id: parent.jobId } });
    const ex = job({ kind: 'export', videoId: 'mov_9', submitter: { kind: 'agent', id: CONV, taskId: 't2' } });
    const other = job({ videoId: 'mov_9', submitter: { kind: 'agent', id: 'conv_2', taskId: 't1' } });
    const jobs = [parent, tr, ex, other];
    expect(conversationVideoJobs('mov_9', jobs, CONV)).toEqual([parent.jobId, tr.jobId, ex.jobId]);
    expect(conversationJobVideos(jobs, CONV)).toEqual(['mov_9']);
  });
});
