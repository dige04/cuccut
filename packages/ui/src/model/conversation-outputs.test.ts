import { describe, expect, it } from 'vitest';
import type { JobRecord, SpaceEntry, TimelineItem, VideoItem, VideoSnapshot } from '@cuccut/protocol';
import {
  conversationOutputs,
  outputSourceMissing,
  outputsByMessage,
  posterFrame,
  type ConversationOutput,
} from './conversation-outputs.ts';

const reply = (id: string, taskId: string, text: string): TimelineItem => ({
  kind: 'agent-message',
  id,
  createdAt: '2026-10-02T00:00:00.000Z',
  taskId,
  text,
  streaming: false,
});

const fileChange = (id: string, taskId: string, detail: string): TimelineItem => ({
  kind: 'tool-call',
  id,
  createdAt: '2026-10-02T00:00:00.000Z',
  taskId,
  tool: 'file-change',
  title: '修改文件',
  detail,
  output: '',
  status: 'completed',
  exitCode: null,
  durationMs: null,
});

const entry = (id: string, patch: Partial<SpaceEntry> = {}, trashedAt: string | null = null): SpaceEntry => ({
  id,
  kind: 'video-file',
  name: `${id}.mp4`,
  fileName: `${id}.mp4`,
  source: { projectId: 'p1', conversationId: null },
  relPath: `${id}.mp4`,
  size: 1024,
  lastActivityAt: '2026-10-01T00:00:00.000Z',
  status: null,
  ...patch,
  user: { favorite: false, displayName: null, trashedAt },
});

const change = (
  id: string,
  videoId: string,
  createdAt: string,
  target: { projectId: string; path: string } | { conversationId: string; path: string },
): TimelineItem => ({
  kind: 'video-change',
  id,
  createdAt,
  taskId: 't1',
  videoId,
  videoName: `旧名 ${videoId}`,
  target,
  transactionId: id,
  label: '剪短开头',
  previousRevision: '1',
  videoRevision: '2',
  createdIds: [],
  updatedIds: [],
  deletedIds: [],
  durationSeconds: { before: 12, after: Number(id.slice(-1)) },
  undoOf: null,
});

describe('conversationOutputs', () => {
  it('internal check exports are not pulled back from a plain file scan into the outputs list; matched by recorded source or real path, not guessed by name and duration', () => {
    for (const cwd of ['/work/c1', 'C:\\work\\c1']) {
      const source = { projectId: null, conversationId: 'c1' };
      const preview = {
        jobId: 'preview', kind: 'export', videoId: 'm1', createdAt: '2026-10-02T00:00:00.000Z',
        submitter: { kind: 'agent', id: 'c1', taskId: 't1' },
        export: { settings: { kind: 'video', format: 'mp4', purpose: 'preview' } },
        result: { outputs: [{ path: `${cwd}/exports/sample.part1.mp4` }] },
      } as unknown as JobRecord;
      const entries = [
        entry('path', { source, relPath: 'exports/sample.part1.mp4' }),
        entry('origin', { source, origin: { source: 'exported', jobId: 'preview' } }),
        entry('file', { source, file: { path: `${cwd}/exports/sample.part1.mp4` } }),
        entry('real', { source, relPath: 'elsewhere/sample.part1.mp4', media: { durationSec: 1 } }),
      ];
      const outputs = conversationOutputs({ id: 'c1', projectId: null, cwd }, [], entries, Infinity, [preview]);
      expect(outputs.map((o) => o.id)).toEqual(['real']);
      const delivered = {
        ...preview, jobId: 'delivery', createdAt: '2026-10-02T00:01:00.000Z',
        export: { settings: { kind: 'video', format: 'mp4', purpose: 'deliverable' } },
      } as JobRecord;
      const replaced = conversationOutputs({ id: 'c1', projectId: null, cwd }, [], entries, Infinity, [delivered, preview]);
      expect(replaced.map((o) => o.id)).toEqual(['m1', 'path', 'file', 'real']);
      const legacy = { ...preview, export: { settings: { kind: 'video', format: 'mp4' } } } as JobRecord;
      expect(conversationOutputs({ id: 'c1', projectId: null, cwd }, [], entries, Infinity, [legacy]).map((o) => o.id))
        .toEqual(['m1', 'path', 'origin', 'file', 'real']);
    }
  });

  it('project session: the same video edited several times is listed once, using the duration of the latest; the name follows the one in Space', () => {
    const items = [
      change('x1', 'm1', '2026-10-02T01:00:00.000Z', { projectId: 'p1', path: '预告' }),
      change('x2', 'm2', '2026-10-02T02:00:00.000Z', { projectId: 'p1', path: '花絮' }),
      change('x3', 'm1', '2026-10-02T03:00:00.000Z', { projectId: 'p1', path: '预告' }),
    ];
    const entries = [entry('e1', { kind: 'video', name: '发布会预告', relPath: '预告' }), entry('loose')];
    const outputs = conversationOutputs({ id: 'c1', projectId: 'p1' }, items, entries);
    expect(outputs.map((o) => [o.id, o.name, o.durationSeconds])).toEqual([
      ['m1', '发布会预告', 3],
      ['m2', '旧名 m2', 2],
    ]);
    expect(outputs[0]!.video).toEqual({ projectId: 'p1', path: '预告' });
  });

  it('videos in the trash are not listed', () => {
    const items = [change('x1', 'm1', '2026-10-02T01:00:00.000Z', { projectId: 'p1', path: '预告' })];
    const entries = [entry('e1', { kind: 'video', relPath: '预告' }, '2026-10-02T02:00:00.000Z')];
    expect(conversationOutputs({ id: 'c1', projectId: 'p1' }, items, entries)).toEqual([]);
  });

  it('sessions not in a project: files in their own working directory are added, the video not duplicated', () => {
    const source = { projectId: null, conversationId: 'c1' };
    const items = [change('x1', 'm1', '2026-10-02T03:00:00.000Z', { conversationId: 'c1', path: '样片' })];
    const entries = [
      entry('video', { kind: 'video', source, relPath: '样片', lastActivityAt: '2026-10-02T03:00:00.000Z' }),
      entry('clip', { source, lastActivityAt: '2026-10-02T02:00:00.000Z' }),
      entry('old', { source }, '2026-10-02T00:00:00.000Z'),
      entry('other', { source: { projectId: null, conversationId: 'c2' } }),
    ];
    const outputs = conversationOutputs({ id: 'c1', projectId: null }, items, entries);
    expect(outputs.map((o) => o.id)).toEqual(['m1', 'clip']);
    expect(outputs[1]!.video).toBeNull();
  });

  it('record the task that produced it: video takes the latest modification, file takes the file-change step that changed it (absolute or relative path both recognized)', () => {
    const source = { projectId: null, conversationId: 'c1' };
    const items: TimelineItem[] = [
      { ...change('x1', 'm1', '2026-10-02T01:00:00.000Z', { conversationId: 'c1', path: '样片' }), taskId: 't1' },
      { ...change('x2', 'm1', '2026-10-02T02:00:00.000Z', { conversationId: 'c1', path: '样片' }), taskId: 't2' },
      fileChange('f1', 't1', 'add /work/c1/out/a.srt'),
      fileChange('f2', 't2', 'Edit ./b.md\ndelete gone.txt'),
    ];
    const entries = [
      entry('a', { source, relPath: 'out/a.srt', kind: 'subtitle' }),
      entry('b', { source, relPath: 'b.md', kind: 'document' }),
      entry('gone', { source, relPath: 'gone.txt', kind: 'document' }),
    ];
    const outputs = conversationOutputs({ id: 'c1', projectId: null, cwd: '/work/c1/' }, items, entries);
    expect(Object.fromEntries(outputs.map((o) => [o.id, o.taskId]))).toEqual({ m1: 't2', a: 't1', b: 't2', gone: null });
  });

  it('videos created by the agent (video-created) and videos pointed to by Jobs it submitted are listed too; Jobs from other sessions don\'t count', () => {
    const items: TimelineItem[] = [
      {
        kind: 'video-created',
        id: 'created/m1',
        createdAt: '2026-10-02T01:00:00.000Z',
        taskId: 't1',
        videoId: 'm1',
        videoName: '新视频',
        target: { projectId: 'p1', path: '新视频' },
        videoRevision: '1',
      },
    ];
    const job = (videoId: string, conversationId: string, createdAt: string) =>
      ({
        jobId: `job_${videoId}_${conversationId}`,
        kind: 'transcribe',
        videoId,
        parentJobId: null,
        submitter: { kind: 'agent', id: conversationId, taskId: 't2' },
        createdAt,
      }) as unknown as JobRecord;
    const entries = [entry('e2', { kind: 'video', name: '访谈', relPath: 'videos/访谈', ref: { videoId: 'm2' } } as Partial<SpaceEntry>)];
    const jobs = [job('m2', 'c1', '2026-10-02T02:00:00.000Z'), job('m3', 'c2', '2026-10-02T03:00:00.000Z')];
    const outputs = conversationOutputs({ id: 'c1', projectId: 'p1' }, items, entries, undefined, jobs);
    expect(outputs.map((o) => [o.id, o.name, o.video])).toEqual([
      ['m2', '访谈', { projectId: 'p1', path: 'videos/访谈' }],
      ['m1', '新视频', { projectId: 'p1', path: '新视频' }],
    ]);
  });

  it('slides made by the agent (slides-created): one item each, title, page count and task taken from the receipt; when Space has an entry, use the entry id, no duplicate in the working directory', () => {
    const source = { projectId: null, conversationId: 'c1' };
    const receipt = (id: string, path: string, title: string): TimelineItem => ({
      kind: 'slides-created',
      id,
      createdAt: '2026-10-02T02:00:00.000Z',
      taskId: 't2',
      target: { conversationId: 'c1', path },
      title,
      slideCount: 8,
    });
    const items = [receipt('s1', 'decks/talk', '季度回顾'), receipt('s2', 'drafts/plan', '')];
    const entries = [
      entry('deck', { kind: 'slides', name: '旧标题', source, relPath: 'decks/talk', deck: { slideCount: 7 } }),
      entry('loose', { kind: 'slides', name: '没校验的', source, relPath: 'loose', deck: { slideCount: 2 }, lastActivityAt: '2026-10-01T00:00:00.000Z' }),
    ];
    const outputs = conversationOutputs({ id: 'c1', projectId: null }, items, entries);
    expect(outputs.map((o) => [o.id, o.name, o.taskId, o.slides])).toEqual([
      ['deck', '季度回顾', 't2', { target: { conversationId: 'c1', path: 'decks/talk' }, slideCount: 8 }],
      ['s2', 'plan', 't2', { target: { conversationId: 'c1', path: 'drafts/plan' }, slideCount: 8 }],
      ['loose', '没校验的', null, { target: { conversationId: 'c1', path: 'loose' }, slideCount: 2 }],
    ]);
    expect(outputs.every((o) => o.kind === 'slides' && o.video === null)).toBe(true);
  });

  it('design drafts made by the agent (design-created): same as slides, artboard count from the receipt; when Space has an entry, use the entry id, no duplicate in the working directory', () => {
    const source = { projectId: null, conversationId: 'c1' };
    const items: TimelineItem[] = [
      {
        kind: 'design-created',
        id: 'd1',
        createdAt: '2026-10-02T02:00:00.000Z',
        taskId: 't3',
        target: { conversationId: 'c1', path: 'designs/landing' },
        title: '课程落地页',
        boardCount: 3,
      },
    ];
    const entries = [
      entry('canvas', { kind: 'design', name: '旧标题', source, relPath: 'designs/landing', canvas: { boardCount: 2 } }),
      entry('draft', { kind: 'design', name: '草图', source, relPath: 'sketch', canvas: { boardCount: 1 }, lastActivityAt: '2026-10-01T00:00:00.000Z' }),
    ];
    const outputs = conversationOutputs({ id: 'c1', projectId: null }, items, entries);
    expect(outputs.map((o) => [o.id, o.name, o.taskId, o.design])).toEqual([
      ['canvas', '课程落地页', 't3', { target: { conversationId: 'c1', path: 'designs/landing' }, boardCount: 3 }],
      ['draft', '草图', null, { target: { conversationId: 'c1', path: 'sketch' }, boardCount: 1 }],
    ]);
    expect(outputs.every((o) => o.kind === 'design' && o.video === null && !o.slides)).toBe(true);
  });

  it('design systems made by the agent (design-system-created): same as design drafts, no count; when Space has an entry, use the entry id, no duplicate in the working directory', () => {
    const source = { projectId: null, conversationId: 'c1' };
    const items: TimelineItem[] = [
      {
        kind: 'design-system-created',
        id: 's1',
        createdAt: '2026-10-02T02:00:00.000Z',
        taskId: 't4',
        target: { conversationId: 'c1', path: 'systems/brand' },
        title: '品牌设计系统',
      },
      {
        kind: 'design-system-created',
        id: 's2',
        createdAt: '2026-10-02T01:00:00.000Z',
        taskId: 't5',
        target: { conversationId: 'c1', path: 'systems/untitled' },
        title: '',
      },
    ];
    const entries = [
      entry('brand', { kind: 'design-system', name: '旧标题', source, relPath: 'systems/brand' }),
      // A design draft entry on the same path does not count as this design system.
      entry('canvas', { kind: 'design', name: '落地页', source, relPath: 'systems/untitled', canvas: { boardCount: 1 } }),
      entry('kit', { kind: 'design-system', name: '组件库', source, relPath: 'kit', lastActivityAt: '2026-10-01T00:00:00.000Z' }),
    ];
    const outputs = conversationOutputs({ id: 'c1', projectId: null }, items, entries).filter((o) => o.kind === 'design-system');
    expect(outputs.map((o) => [o.id, o.name, o.taskId, o.designSystem])).toEqual([
      ['brand', '品牌设计系统', 't4', { target: { conversationId: 'c1', path: 'systems/brand' } }],
      ['s2', 'untitled', 't5', { target: { conversationId: 'c1', path: 'systems/untitled' } }],
      ['kit', '组件库', null, { target: { conversationId: 'c1', path: 'kit' } }],
    ]);
    expect(outputs.every((o) => o.video === null && !o.slides && !o.design)).toBe(true);
  });

  it('limit: session header shows at most 30 items; can be untruncated when grouped by reply', () => {
    const source = { projectId: null, conversationId: 'c1' };
    const entries = Array.from({ length: 35 }, (_, i) => entry(`e${i}`, { source }));
    expect(conversationOutputs({ id: 'c1', projectId: null }, [], entries)).toHaveLength(30);
    expect(conversationOutputs({ id: 'c1', projectId: null }, [], entries, Infinity)).toHaveLength(35);
  });
});

describe('outputsByMessage', () => {
  const output = (id: string, taskId: string | null, at: string): ConversationOutput => ({
    id,
    kind: 'document',
    name: id,
    video: null,
    entry: null,
    durationSeconds: null,
    at,
    taskId,
  });

  it('attached under the reply shown last in the task, in order; tasks with no reply and tasks not recognized are not attached', () => {
    const items: TimelineItem[] = [
      reply('r1', 't1', '先看看'),
      reply('r2', 't1', '改好了'),
      reply('r3', 't1', '   '),
      reply('r4', 't2', '第二轮'),
    ];
    const outputs = [
      output('late', 't1', '2026-10-02T03:00:00.000Z'),
      output('early', 't1', '2026-10-02T01:00:00.000Z'),
      output('second', 't2', '2026-10-02T02:00:00.000Z'),
      output('silent', 't3', '2026-10-02T02:00:00.000Z'),
      output('unknown', null, '2026-10-02T02:00:00.000Z'),
    ];
    const byMessage = outputsByMessage(items, outputs);
    expect([...byMessage.keys()]).toEqual(['r2', 'r4']);
    expect(byMessage.get('r2')!.map((o) => o.id)).toEqual(['early', 'late']);
    expect(byMessage.get('r4')!.map((o) => o.id)).toEqual(['second']);
  });

  it('empty replies during streaming also count (outputs are attached under it before the reply is finished)', () => {
    const streaming: TimelineItem = { kind: 'agent-message', id: 'r2', createdAt: '2026-10-02T00:00:00.000Z', taskId: 't1', text: '', streaming: true };
    const items: TimelineItem[] = [reply('r1', 't1', '好'), streaming];
    expect([...outputsByMessage(items, [output('a', 't1', '2026-10-02T01:00:00.000Z')]).keys()]).toEqual(['r2']);
  });
});

describe('outputSourceMissing', () => {
  const video = (patch: Partial<ConversationOutput> = {}): ConversationOutput => ({
    id: 'm1',
    kind: 'video',
    name: '样片',
    video: { projectId: 'p1', path: '样片' },
    entry: null,
    durationSeconds: 3,
    at: '2026-10-02T01:00:00.000Z',
    taskId: 't1',
    ...patch,
  });
  const space = { ready: true, scanning: false, issues: [] };

  it('Space scan finished, source scan complete, but no entry for this video: source file not found', () => {
    expect(outputSourceMissing(video(), space)).toBe(true);
    expect(outputSourceMissing(video({ video: { conversationId: 'c1', path: '样片' } }), space)).toBe(true);
  });

  it('when there is an entry, still scanning, scan incomplete, or not a video: no conclusion drawn', () => {
    expect(outputSourceMissing(video({ entry: entry('e1', { kind: 'video' }) }), space)).toBe(false);
    expect(outputSourceMissing(video(), { ...space, ready: false })).toBe(false);
    expect(outputSourceMissing(video(), { ...space, scanning: true })).toBe(false);
    const issues = [{ sourceKey: 'project:p1', kind: 'truncated' as const, detail: '' }];
    expect(outputSourceMissing(video(), { ...space, issues })).toBe(false);
    expect(outputSourceMissing(video({ video: { conversationId: 'c1', path: '样片' } }), { ...space, issues })).toBe(true);
    expect(outputSourceMissing(video({ kind: 'document', video: null }), space)).toBe(false);
  });
});

describe('posterFrame', () => {
  const clip = (id: string, trackId: string, fromFrame: number, assetId: string, timeMap: VideoItem['timeMap'], enabled = true) =>
    ({
      id,
      type: 'video',
      trackId,
      enabled,
      span: { fromFrame, durationFrames: 30 },
      assetRef: { id: assetId, revision: '1' },
      timeMap,
    }) as unknown as VideoItem;
  const snapshot = (items: VideoItem[], hiddenTracks: string[] = []): VideoSnapshot =>
    ({
      rootSequenceId: 's1',
      sequences: {
        s1: {
          id: 's1',
          tracks: ['v1', 'v2'].map((id) => ({ id, visible: !hiddenTracks.includes(id) })),
          items,
        },
      },
      assets: {
        movie: { revisions: { '1': { video: { displayWidth: 1920 } } } },
        sound: { revisions: { '1': {} } },
      },
    }) as unknown as VideoSnapshot;
  const linear = (seconds: number): VideoItem['timeMap'] => ({
    kind: 'linear',
    sourceIn: { ticks: String(seconds * 1000), timescale: 1000 },
    rate: { num: 1, den: 1 },
  });

  it('takes the first frame of the earliest visible, enabled video clip with picture on the root sequence', () => {
    const items = [
      clip('later', 'v1', 60, 'movie', linear(9)),
      clip('noVideo', 'v1', 0, 'sound', linear(1)),
      clip('disabled', 'v1', 0, 'movie', linear(2), false),
      clip('hidden', 'v2', 0, 'movie', linear(3)),
      clip('first', 'v1', 10, 'movie', linear(4)),
    ];
    expect(posterFrame(snapshot(items, ['v2']))).toEqual({ asset: { id: 'movie', revision: '1' }, at: 4 });
  });

  it('null when there is no video clip', () => {
    expect(posterFrame(snapshot([]))).toBeNull();
  });
});
