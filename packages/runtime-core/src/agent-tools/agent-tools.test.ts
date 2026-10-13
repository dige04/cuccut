import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { newId, type AgentMode, type Autonomy, type EditorContext, type Id, type VideoEvent, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { allToolNames } from './all-tool-sets.ts';
import { ToolDriver, mcp, post, tool, until } from './testing/fake-agent.ts';

/**
 * End to end: a fake agent holding a session token calls the video tools through the real MCP endpoint. The changes land in the real Rust engine, and the video topic in the UI and the change card in the session must keep up. Needs engine-host and ffmpeg; skipped if they are missing.
 */

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!engine || !ffmpeg)('agent tools (real engine)', () => {
  let fixtures: string;
  let clip: string;
  let dir: string;
  let runtime: RunningRuntime;
  let driver: ToolDriver;
  let client: CucCutClient;
  let project: Project;
  let conversationId: Id;
  let videoId: Id;
  let videoPath: string;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fixtures-'));
    clip = path.join(fixtures, 'clip.mp4');
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=2'],
      ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', clip],
    ]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    driver = new ToolDriver();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '工具测试' }));
    await fs.copyFile(clip, path.join(project.path, 'clip.mp4'));
    const opened = await client.request('videos.create', { projectId: project.id, name: '样片' });
    videoId = opened.ref.videoId;
    videoPath = opened.ref.relPath;
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** Sends a message and waits for the fake agent's turn to start. */
  async function send(text: string, options: { autonomy?: Autonomy; accessMode?: AgentMode; context?: EditorContext } = {}) {
    const { taskId } = await client.request('conversations.send', { conversationId, text, commandId: newId('cmd'), ...options });
    const session = await until(() => driver.sessions[0]);
    await until(() => session.turnId);
    return { taskId, session };
  }

  async function items() {
    return (await client.request('conversations.get', { conversationId })).items;
  }

  it('session is set up with the tool channel and guidance; the endpoint accepts only tokens and rejects web pages', async () => {
    const { session } = await send('hi');
    const server = session.options.mcpServers?.cuccut;
    expect(server?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    expect(session.options.developerInstructions).toContain('videos_inspect');

    const init = await mcp(session, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 't', version: '0' },
    });
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'cuccut' }, capabilities: { tools: {} } });
    const listed = await mcp(session, 'tools/list');
    const tools = listed.result!.tools as { name: string; inputSchema: { type: string } }[];
    // The tool bridge lists every tool in the directory (each entry's surfaces include agent).
    expect(tools.map((t) => t.name).sort()).toEqual(allToolNames());
    expect(tools.every((t) => t.inputSchema.type === 'object')).toBe(true);

    const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    expect((await post(server!.url, {}, body)).status).toBe(401);
    expect((await post(server!.url, { Authorization: 'Bearer nope' }, body)).status).toBe(401);
    expect((await post(server!.url, { ...server!.headers, Origin: 'https://evil.example' }, body)).status).toBe(403);
    expect((await fetch(server!.url, { headers: server!.headers })).status).toBe(405);
    const notification = await post(server!.url, server!.headers, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(notification.status).toBe(202);
    expect((await mcp(session, 'resources/list')).error?.code).toBe(-32601);
  });

  it('agent edits a video through tools: receipt, UI theme, change card and task source all match', async () => {
    const videoEvents: VideoEvent[] = [];
    client.subscribeVideo(videoId, {
      snapshot: () => {},
      event: (event) => {
        if (event.type === 'video.event') videoEvents.push(event.event);
      },
    });
    const context: EditorContext = { videoId, videoName: '样片', videoPath, revision: '0', selection: [], playheadSeconds: 0, uiLanguage: 'zh-Hans' };
    const { taskId, session } = await send('把 clip.mp4 放到 1 秒处', { context });
    expect(session.inputs[0]).toContain('<cuccut-editor-context>');
    expect(session.inputs[0]).toContain('用户的界面语言是 zh-Hans。');
    expect((await items()).find((i) => i.kind === 'user-message')).toMatchObject({ text: '把 clip.mp4 放到 1 秒处', context });

    const listed = await tool(session, 'videos_list', {});
    expect(listed.body.videos).toEqual([{ path: videoPath, videoId, name: '样片', open: true }]);

    const inspected = await tool(session, 'videos_inspect', { video: videoPath });
    expect(inspected.isError).toBe(false);
    expect(inspected.body).toMatchObject({ videoId, items: [], sequence: { fps: '30' } });

    const applied = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: inspected.body.revision,
      label: '放入 clip.mp4',
      operations: [
        { type: 'importAsset', path: 'clip.mp4', ref: 'c' },
        { type: 'addItem', asset: { ref: 'c' }, at: 1 },
      ],
    });
    expect(applied.isError).toBe(false);
    expect(applied.body).toMatchObject({ status: 'committed', label: '放入 clip.mp4', durationSeconds: { before: 0, after: 3 } });
    expect(applied.body.timeResolution[0]).toMatchObject({ actualFrame: 30, actualSeconds: 1 });

    // UI side: the same video's topic receives the change; the operator is this session's agent; the task number is the current task.
    const event = await until(() => videoEvents.find((e) => e.transactionId === applied.body.transactionId));
    expect(event.actor).toEqual({ kind: 'agent', id: `agent:${conversationId}` });
    expect(event.taskId).toBe(taskId);
    const mirror = runtime.videos.mirror(videoId)!.video;
    const placed = mirror.sequences[mirror.rootSequenceId]!.items.find((item) => item.type === 'video');
    expect(placed).toMatchObject({ span: { fromFrame: 30, durationFrames: 60 } });

    // In the session: one change card, with content taken from the receipt.
    const card = (await items()).find((i) => i.kind === 'video-change');
    expect(card).toMatchObject({
      taskId,
      videoId,
      videoName: '样片',
      target: { projectId: project.id, path: videoPath },
      transactionId: applied.body.transactionId,
      previousRevision: inspected.body.revision,
      videoRevision: applied.body.revision.after,
      durationSeconds: { before: 0, after: 3 },
      undoOf: null,
    });

    // A change based on an old version is rejected, and the video is unchanged.
    const stale = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: inspected.body.revision,
      label: '删掉',
      operations: [{ type: 'deleteItems', itemIds: applied.body.createdIds }],
    });
    expect(stale.isError).toBe(true);
    expect(stale.body.error).toMatchObject({ code: 'PROJECT_REVISION_CONFLICT', retryability: 'after-refresh' });

    // Undoing one's own step is also a change, and it also gets a change card.
    const undone = await tool(session, 'edits_undo', { video: videoId });
    expect(undone.body).toMatchObject({ undoOf: applied.body.transactionId, durationSeconds: { before: 3, after: 0 } });
    await until(() => runtime.videos.mirror(videoId)!.video.sequences[mirror.rootSequenceId]!.items.length === 0);
    expect((await items()).filter((i) => i.kind === 'video-change')).toHaveLength(2);

    // Wrong parameters or operation: reported as is, not submitted.
    const bad = await tool(session, 'edits_apply', { video: videoId, label: 'x', operations: [] });
    expect(bad.body.error.code).toBe('INVALID_ARGUMENTS');
    const badTime = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: undone.body.revision.after,
      label: 'x',
      operations: [{ type: 'moveItem', itemId: 'nope', at: 'soon' }],
    });
    expect(badTime.body.error).toMatchObject({ code: 'INVALID_OPERATION', operationIndex: 0 });
    const missing = await tool(session, 'videos_inspect', { video: '../elsewhere' });
    expect(missing.body.error.code).toMatch(/VIDEO_NOT_FOUND|VIDEO_OUTSIDE_WORKSPACE/);

    // After the turn ends, the tools are unavailable.
    session.finish();
    await until(() => runtime.harness.agentRun(conversationId).taskId === null);
    const after = await tool(session, 'videos_inspect', { video: videoId });
    expect(after.body.error.code).toBe('NO_ACTIVE_TASK');
  });

  it('videos_create records a video-created entry in the session after creating a video: the editor open location and the version at creation', async () => {
    const { taskId, session } = await send('新建一部视频');
    const created = await tool(session, 'videos_create', { name: '新片' });
    expect(created.isError, JSON.stringify(created.body)).toBe(false);
    const record = (await items()).find((i) => i.kind === 'video-created');
    expect(record).toEqual({
      kind: 'video-created',
      id: `created/${created.body.videoId}`,
      createdAt: expect.any(String),
      taskId,
      videoId: created.body.videoId,
      videoName: '新片',
      target: { projectId: project.id, path: created.body.video },
      videoRevision: created.body.revision,
    });
    // Creating is not a change: no change card.
    expect((await items()).some((i) => i.kind === 'video-change')).toBe(false);

    // A session that does not belong to a project (architecture design §3.10): the video is built in its working directory and no project is created. Space lists it by session source.
    const { conversation: looseConversation } = await client.request('conversations.create', { projectId: null, title: '帮我加字幕' });
    const loose = looseConversation.id;
    const scratch = looseConversation.cwd;
    await fs.writeFile(path.join(scratch, 'notes.txt'), '笔记');
    const projectsBefore = runtime.harness.listProjects().length;
    const { taskId: looseTask } = await client.request('conversations.send', {
      conversationId: loose,
      text: '也建一部',
      commandId: newId('cmd'),
    });
    const looseSession = await until(() => driver.sessions[1]);
    await until(() => looseSession.turnId);
    const looseCreated = await tool(looseSession, 'videos_create', { name: '会话里的片' });
    expect(looseCreated.isError, JSON.stringify(looseCreated.body)).toBe(false);
    expect((await client.request('conversations.get', { conversationId: loose })).conversation).toMatchObject({ projectId: null, cwd: scratch });
    expect(runtime.harness.listProjects()).toHaveLength(projectsBefore);
    await fs.access(path.join(scratch, looseCreated.body.video, 'video.db'));
    expect((await client.request('conversations.get', { conversationId: loose })).items.find((i) => i.kind === 'video-created')).toMatchObject({
      taskId: looseTask,
      videoId: looseCreated.body.videoId,
      target: { conversationId: loose, path: looseCreated.body.video },
    });
    const second = await tool(looseSession, 'videos_create', { name: '第二部' });
    expect(second.isError, JSON.stringify(second.body)).toBe(false);
    expect(runtime.harness.listProjects()).toHaveLength(projectsBefore);
    const listedLoose = await tool(looseSession, 'videos_list', {});
    expect(listedLoose.body.workspace).toBe(await fs.realpath(scratch));
    await until(async () => {
      const entries = (await client.request('space.list', { kind: ['video'] })).entries.filter((e) => e.source.conversationId === loose);
      return entries.length === 2 && entries.every((e) => e.source.projectId === null);
    });

    // Opening a new session from this video (`folderOf`, §3.10) shares its working directory and can open the original video. A newly created video is recorded at the position of the original session, so Space does not gain an extra source.
    const { conversation: guestConversation } = await client.request('conversations.create', { folderOf: loose, title: '剪成短视频' });
    expect(guestConversation).toMatchObject({ projectId: null, cwd: scratch, folderOf: loose });
    const guest = guestConversation.id;
    await client.request('conversations.send', { conversationId: guest, text: '切几段', commandId: newId('cmd') });
    const guestSession = await until(() => driver.sessions[2]);
    await until(() => guestSession.turnId);
    const guestInspected = await tool(guestSession, 'videos_inspect', { video: looseCreated.body.videoId });
    expect(guestInspected.isError, JSON.stringify(guestInspected.body)).toBe(false);
    expect((await tool(guestSession, 'videos_list', {})).body.workspace).toBe(await fs.realpath(scratch));
    const guestCreated = await tool(guestSession, 'videos_create', { name: '切片' });
    expect(guestCreated.isError, JSON.stringify(guestCreated.body)).toBe(false);
    await fs.access(path.join(scratch, guestCreated.body.video, 'video.db'));
    expect((await client.request('conversations.get', { conversationId: guest })).items.find((i) => i.kind === 'video-created')).toMatchObject({
      target: { conversationId: loose, path: guestCreated.body.video },
    });
    await until(async () => {
      const entries = (await client.request('space.list', { kind: ['video'] })).entries;
      return entries.filter((e) => e.source.conversationId === loose).length === 3 && !entries.some((e) => e.source.conversationId === guest);
    });
    // The turn ended, but the native session is idle (its agent still has the video open). When it is put into a project, close it first; it does not count as open elsewhere.
    guestSession.finish();

    // The user explicitly asks to create a project: projects_adopt_session names it after the earliest-created video, binds the session to it, and moves the videos and files into the project (agents that still hold them release them first).
    const adopted = await tool(looseSession, 'projects_adopt_session', {});
    expect(adopted.isError, JSON.stringify(adopted.body)).toBe(false);
    expect(adopted.body).toMatchObject({ name: '会话里的片', created: true });
    const bound = (await client.request('conversations.get', { conversationId: loose })).conversation;
    const boundProject = runtime.harness.listProjects().find((p) => p.id === bound.projectId)!;
    expect(boundProject).toMatchObject({ id: adopted.body.projectId, name: '会话里的片' });
    expect(path.dirname(boundProject.path)).toBe(await fs.realpath(path.join(dir, 'projects')));
    expect(bound.cwd).toBe(boundProject.path);
    expect(runtime.harness.listProjects()).toHaveLength(projectsBefore + 1);
    await fs.access(path.join(boundProject.path, looseCreated.body.video, 'video.db'));
    await fs.access(path.join(boundProject.path, second.body.video, 'video.db'));
    expect(await fs.readFile(path.join(boundProject.path, 'notes.txt'), 'utf8')).toBe('笔记');
    const looseItems = (await client.request('conversations.get', { conversationId: loose })).items;
    expect(looseItems.find((i) => i.kind === 'video-created')).toMatchObject({
      videoId: looseCreated.body.videoId,
      target: { projectId: boundProject.id, path: looseCreated.body.video },
    });
    // Sessions that share the working directory follow into the project, and their cards now point to the project.
    const followed = await client.request('conversations.get', { conversationId: guest });
    expect(followed.conversation).toMatchObject({ projectId: boundProject.id, cwd: boundProject.path });
    expect(followed.conversation.folderOf).toBeUndefined();
    expect(followed.items.find((i) => i.kind === 'video-created')).toMatchObject({ target: { projectId: boundProject.id, path: guestCreated.body.video } });
    // Calling again returns the same result. Later new videos are created in the project.
    expect((await tool(looseSession, 'projects_adopt_session', {})).body).toMatchObject({ projectId: boundProject.id, created: false });
    const third = await tool(looseSession, 'videos_create', { name: '第三部' });
    expect(third.isError, JSON.stringify(third.body)).toBe(false);
    expect(runtime.harness.listProjects()).toHaveLength(projectsBefore + 1);
    const listedBound = await tool(looseSession, 'videos_list', {});
    expect(listedBound.body.workspace).toBe(boundProject.path);
    expect(listedBound.body.videos).toHaveLength(4);
    // Space: video entries are under the project source, and the old session source is gone.
    await until(async () => {
      const entries = (await client.request('space.list', { kind: ['video'], projectId: boundProject.id })).entries;
      return entries.length === 4 && entries.every((e) => e.source.projectId === boundProject.id && e.source.conversationId === null);
    });
    // Turn ended: the old paths in the turn that pointed to the project are deleted.
    looseSession.finish();
    await until(async () => !(await fs.lstat(scratch).then(() => true, () => false)));
    // Deleting the session: the project and its videos remain.
    await client.request('conversations.delete', { conversationId: loose });
    await fs.access(path.join(boundProject.path, looseCreated.body.video, 'video.db'));
    expect(runtime.harness.listProjects().some((p) => p.id === boundProject.id)).toBe(true);
  });

  it('deleting a projectless session that still has videos: the videos move into a new project named after the video and do not disappear with the session', async () => {
    const { conversation } = await client.request('conversations.create', { projectId: null, title: '临时' });
    await client.request('conversations.send', { conversationId: conversation.id, text: '建一部', commandId: newId('cmd') });
    const session = await until(() => driver.sessions.at(-1)?.turnId ? driver.sessions.at(-1) : undefined);
    const created = await tool(session!, 'videos_create', { name: '留下来' });
    expect(created.isError, JSON.stringify(created.body)).toBe(false);
    session!.finish();
    await client.request('conversations.delete', { conversationId: conversation.id });
    const project = runtime.harness.listProjects().find((p) => p.name === '留下来');
    expect(project).toBeTruthy();
    await until(() => fs.access(path.join(project!.path, created.body.video, 'video.db')).then(() => true, () => false));
  });

  it('agent sets transitions, effects, chapters and ducking; when a clip is deleted, the receipt explains why its transition is gone', async () => {
    const { session } = await send('加个转场和章节');
    const inspected = await tool(session, 'videos_inspect', { video: videoId });
    const visualTrack = inspected.body.tracks.find((t: { kind: string }) => t.kind === 'visual').id;
    const audioTrack = inspected.body.tracks.find((t: { kind: string }) => t.kind === 'audio').id;
    const placed = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: inspected.body.revision,
      label: '放入并切开',
      operations: [
        { type: 'importAsset', path: 'clip.mp4', ref: 'c' },
        { type: 'addItem', asset: { ref: 'c' }, at: 0, trackId: visualTrack },
      ],
    });
    const [itemId] = placed.body.createdIds.filter((id: string) => id.startsWith('item'));
    const split = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: placed.body.revision.after,
      label: '切开',
      operations: [{ type: 'splitItem', itemId, at: 1 }],
    });
    const rightId = split.body.createdIds.find((id: string) => id.startsWith('item'));

    const applied = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: split.body.revision.after,
      label: '转场、效果、章节与闪避',
      operations: [
        { type: 'setTransition', leftItemId: itemId, rightItemId: rightId, kind: 'dissolve', duration: 0.2, audioCrossfade: true },
        { type: 'setEffects', itemId: rightId, fx: { saturation: -1 } },
        {
          type: 'setChapters',
          chapters: [
            { at: 0, title: '开场' },
            { at: 1.02, title: '后半' },
          ],
        },
        { type: 'setDucking', trigger: { kind: 'items', trackIds: [visualTrack] }, target: { trackIds: [audioTrack] }, attack: 0.1 },
      ],
    });
    expect(applied.isError).toBe(false);

    const after = await tool(session, 'videos_inspect', { video: videoId });
    expect(after.body.transitions).toEqual([
      expect.objectContaining({ leftItemId: itemId, rightItemId: rightId, kind: 'dissolve', durationFrames: 6, audioCrossfade: true }),
    ]);
    expect(after.body.chapters.map((c: { title: string; atFrame: number }) => [c.title, c.atFrame])).toEqual([
      ['开场', 0],
      ['后半', 31],
    ]);
    expect(after.body.ducking).toEqual([
      expect.objectContaining({ trigger: { kind: 'items', trackIds: [visualTrack] }, depth: 10, attackSeconds: 0.1, releaseSeconds: 0.35 }),
    ]);
    expect(after.body.items.find((i: { id: string }) => i.id === rightId).fx).toEqual(['saturation']);
    // The UI and the Runtime's mirror receive the same object through events.
    await until(() => runtime.videos.mirror(videoId)!.video.sequences[after.body.sequence.id]!.transitions.length === 1);
    const mirrored = runtime.videos.mirror(videoId)!.video.sequences[after.body.sequence.id]!;
    expect(mirrored.markers.map((m) => m.label)).toEqual(['开场', '后半']);
    expect(mirrored.ducking).toHaveLength(1);

    const deleted = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: after.body.revision,
      label: '删掉后半',
      operations: [{ type: 'deleteItems', itemIds: [rightId] }],
    });
    expect(deleted.body.removedTransitions).toEqual([{ id: after.body.transitions[0].id, reason: 'item-deleted' }]);
    await until(() => runtime.videos.mirror(videoId)!.video.sequences[after.body.sequence.id]!.transitions.length === 0);
  });

  it('agent switches a clip between full-canvas and picture-in-picture with setStyle, keeping the picture-in-picture position', async () => {
    const { session } = await send('把视频改成画中画');
    const inspected = await tool(session, 'videos_inspect', { video: videoId });
    const placed = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: inspected.body.revision,
      label: '放入并铺满',
      operations: [
        { type: 'importAsset', path: 'clip.mp4', ref: 'c' },
        { type: 'addItem', asset: { ref: 'c' }, at: 0 },
      ],
    });
    const itemId = placed.body.createdIds.find((id: string) => id.startsWith('item'));
    const full = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: placed.body.revision.after,
      label: '铺满',
      operations: [{ type: 'setStyle', itemId, mode: 'fullscreen', fit: 'contain', bg: 'blur' }],
    });
    expect(full.isError).toBe(false);
    const digest = async () =>
      (await tool(session, 'videos_inspect', { video: videoId })).body.items.find((i: { id: string }) => i.id === itemId);
    expect(await digest()).toMatchObject({ place: { mode: 'fullscreen' } });

    const pip = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: full.body.revision.after,
      label: '画中画',
      operations: [
        { type: 'setStyle', itemId, mode: 'pip' },
        { type: 'setTransform', itemId, x: 80, y: 80, w: 30 },
      ],
    });
    expect(pip.isError).toBe(false);
    expect(await digest()).toMatchObject({ place: { mode: 'pip', x: 80, y: 80, w: 30 } });

    // An opacity outside [0, 1] makes the whole change take no effect.
    const bad = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: pip.body.revision.after,
      label: '不透明度',
      operations: [{ type: 'setStyle', itemId, opacity: 2 }],
    });
    expect(bad.isError).toBe(true);
  });

  it('cleanup: deleteTrack deletes only empty tracks; assets_prune lists unreferenced media first, deletes on apply, and rejects media still in use', async () => {
    const { session } = await send('清理一下没用的轨道和素材');
    await fs.writeFile(path.join(project.path, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
    const inspected = await tool(session, 'videos_inspect', { video: videoId });
    const placed = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: inspected.body.revision,
      label: '放一段、多导一份、加两条轨道',
      operations: [
        { type: 'importAsset', path: 'clip.mp4', ref: 'used' },
        { type: 'addItem', asset: { ref: 'used' }, at: 0 },
        { type: 'importAsset', path: 'logo.svg', name: '没放上去', storage: 'managed' },
        { type: 'addTrack', kind: 'visual', name: '空轨', ref: 'empty' },
        { type: 'addTrack', kind: 'audio', name: '音乐' },
      ],
    });
    expect(placed.isError).toBe(false);
    const after = await tool(session, 'videos_inspect', { video: videoId });
    const used = after.body.items.find((i: { type: string }) => i.type === 'video');
    const emptyTrack = after.body.tracks.find((t: { name?: string }) => t.name === '空轨').id;

    // A track that has clips: rejected, and details give the clips and the next operations.
    const busy = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: after.body.revision,
      label: '删轨道',
      operations: [{ type: 'deleteTrack', trackId: used.trackId }],
    });
    expect(busy.body.error).toMatchObject({
      code: 'INVALID_OPERATION',
      details: { rule: 'track-not-empty', itemIds: [used.id], next: ['deleteItems', 'moveItem'] },
    });
    const dropped = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: after.body.revision,
      label: '删空轨道',
      operations: [{ type: 'deleteTrack', trackId: emptyTrack }],
    });
    expect(dropped.body).toMatchObject({ status: 'committed', deletedIds: [emptyTrack], removedTracks: [emptyTrack] });

    // List only: only the copy that was not placed remains, and the video is unchanged.
    const listed = await tool(session, 'assets_prune', { video: videoId });
    expect(listed.isError).toBe(false);
    expect(listed.body.assets).toEqual([
      expect.objectContaining({ name: '没放上去', kind: 'image', storage: 'managed', byteLength: expect.any(Number) }),
    ]);
    expect(listed.body.revision).toBe(dropped.body.revision.after);
    const spare = listed.body.assets[0].assetId;

    // Asset still in use: rejected, with no confirmation prompt and no submission.
    const refused = await tool(session, 'assets_prune', { video: videoId, assetIds: [used.asset.id], apply: true });
    expect(refused.body.error).toMatchObject({ code: 'INVALID_OPERATION', details: { rule: 'asset-in-use', assetIds: [used.asset.id] } });

    const pruned = await tool(session, 'assets_prune', { video: videoId, apply: true });
    expect(pruned.body).toMatchObject({ status: 'committed', deletedIds: [spare], removedAssets: [spare] });
    await until(() => !runtime.videos.mirror(videoId)!.video.assets[spare]);
    expect((await tool(session, 'assets_prune', { video: videoId })).body.assets).toEqual([]);
  });

  it('space_list / space_search: an agent in a session sees only entries in that session\'s source directory (project), also available in plan mode', async () => {
    const { project: other } = await client.request('projects.create', { name: '别的项目' });
    const elsewhere = await client.request('videos.create', { projectId: other.id, name: '别处' });
    await client.request('space.rescan', {});
    await runtime.space.idle();
    expect((await client.request('space.list', { kind: ['video'] })).entries).toHaveLength(2);

    const { session } = await send('列一下', { accessMode: 'plan' });
    const listed = await tool(session, 'space_list', { kind: ['video'] });
    expect(listed.isError).toBe(false);
    expect(listed.body.entries).toEqual([
      expect.objectContaining({ kind: 'video', name: '样片', projectId: project.id, videoId, path: videoPath }),
    ]);
    expect((await tool(session, 'space_list', { videoId: elsewhere.ref.videoId })).body.entries).toEqual([]);
    const searched = await tool(session, 'space_search', { query: '剪辑' });
    expect(searched.body).toMatchObject({ hits: [], truncated: false });
    expect((await tool(session, 'space_search', { query: ' ' })).isError).toBe(true);
  });

  it('plan mode is read-only; everything is rejected after stop', async () => {
    const { taskId, session } = await send('看看', { autonomy: 'plan' });
    const inspected = await tool(session, 'videos_inspect', { video: videoPath });
    expect(inspected.isError).toBe(false);
    const refused = await tool(session, 'edits_apply', {
      video: videoPath,
      expectedRevision: inspected.body.revision,
      label: '加轨道',
      operations: [{ type: 'addTrack', kind: 'visual' }],
    });
    expect(refused.body.error.code).toBe('PLAN_ONLY');
    expect((await tool(session, 'videos_create', { name: '另一部' })).body.error.code).toBe('PLAN_ONLY');
    expect((await items()).some((i) => i.kind === 'video-created')).toBe(false);

    await client.request('tasks.stop', { taskId });
    const stopped = await tool(session, 'videos_inspect', { video: videoPath });
    expect(stopped.body.error.code).toBe('TASK_STOPPED');
    expect(runtime.videos.mirror(videoId)!.video.revision).toBe(inspected.body.revision);
  });

  it('access mode: edits are automatically allowed, asked or denied per the decision table; executed after allow, and denial, interruption and stop each return a clear error; a mid-session switch applies to later calls', async () => {
    const { taskId, session } = await send('加几条轨道', { accessMode: 'ask' });
    const revision = () => runtime.videos.mirror(videoId)!.video.revision;
    const addTrack = () =>
      tool(session, 'edits_apply', {
        video: videoPath,
        expectedRevision: revision(),
        label: '加轨道',
        operations: [{ type: 'addTrack', kind: 'visual' }],
      });
    /** Waits for the next pending approval (the unified list and the approval card in the session share the same id). */
    const nextPending = async () => {
      const pending = await until(() => runtime.harness.approvals.pending()[0]);
      expect(pending).toMatchObject({
        subject: { kind: 'conversation', conversationId, taskId },
        action: { kind: 'tool', name: 'edits_apply', targets: [videoPath] },
        risk: 'edit',
        expiresAt: null,
      });
      const card = (await items()).find((i) => i.kind === 'approval' && i.approvalId === pending.approvalId);
      expect(card).toMatchObject({ status: 'pending', request: { kind: 'tool', tool: 'edits_apply', files: [videoPath] }, risk: 'edit' });
      return pending;
    };

    // ask: changes ask first. Approve with the old flow (agents.respondToApproval), and then it runs.
    const before = revision();
    const first = addTrack();
    const asked = await nextPending();
    expect(revision()).toBe(before);
    expect(await client.request('agents.respondToApproval', { conversationId, approvalId: asked.approvalId, decision: 'accept' })).toEqual({
      status: 'accepted',
    });
    const allowed = await first;
    expect(allowed.isError).toBe(false);
    expect(allowed.body).toMatchObject({ status: 'committed', approval: { mode: 'ask', risk: 'edit', decidedBy: 'user' } });
    expect(revision()).not.toBe(before);

    // Reject with the unified approvals.respond: the tool returns APPROVAL_DENIED and the video is not changed.
    const afterFirst = revision();
    const second = addTrack();
    await client.request('approvals.respond', { approvalId: (await nextPending()).approvalId, decision: 'deny' });
    expect((await second).body.error).toMatchObject({ code: 'APPROVAL_DENIED', mode: 'ask', risk: 'edit' });
    expect(revision()).toBe(afterFirst);

    // Interrupt reply: the pending one is cancelled, and the tool returns APPROVAL_CANCELLED.
    const third = addTrack();
    await nextPending();
    await client.request('agents.interrupt', { conversationId });
    expect((await third).body.error).toMatchObject({ code: 'APPROVAL_CANCELLED', mode: 'ask', risk: 'edit' });
    expect(runtime.harness.approvals.pending()).toEqual([]);

    // Switched to “auto accept changes” mid-task: later changes no longer ask, and a notice is recorded in the session.
    await client.request('conversations.update', { conversationId, accessMode: 'autoAcceptEdits' });
    const auto = await addTrack();
    expect(auto.body).toMatchObject({ status: 'committed', approval: { mode: 'autoAcceptEdits', risk: 'edit', decidedBy: 'auto' } });
    expect((await items()).find((i) => i.kind === 'notice' && i.modeChange)).toMatchObject({
      taskId,
      modeChange: { from: 'ask', to: 'autoAcceptEdits' },
    });
    expect((await client.request('conversations.get', { conversationId })).conversation.accessMode).toBe('autoAcceptEdits');

    // Switched back to ask (the old value was controlled), and it asks again. The main stop cancels the pending ones.
    await client.request('conversations.update', { conversationId, accessMode: 'controlled' });
    const fourth = addTrack();
    const last = await nextPending();
    await client.request('tasks.stop', { taskId });
    expect((await fourth).body.error).toMatchObject({ code: 'APPROVAL_CANCELLED' });
    expect((await items()).find((i) => i.kind === 'approval' && i.approvalId === last.approvalId)).toMatchObject({ status: 'cancelled' });
    expect(
      (await items()).filter((i) => i.kind === 'approval').map((i) => i.kind === 'approval' && [i.status, i.decidedBy ?? null]),
    ).toEqual([
      ['accepted', 'user'],
      ['declined', 'user'],
      ['cancelled', null],
      ['cancelled', null],
    ]);
  });

  it('videos_inspect by videoId: a closed video is found in its source directory and opened; not found in other directories', async () => {
    const { session } = await send('看看视频');
    // Two closed videos (this is the state after creating them in the flow and releasing the lease): the first lookup by videoId scans the session source directories, and it also records each video's directory that it sees.
    const closed: { videoId: Id; relPath: string; name: string }[] = [];
    for (const name of ['流程新建的', '另一个']) {
      const created = await client.request('videos.create', { projectId: project.id, name });
      await client.request('videos.close', { videoId: created.ref.videoId });
      closed.push({ videoId: created.ref.videoId, relPath: created.ref.relPath, name });
    }
    await until(() => closed.every((v) => runtime.videos.ref(v.videoId) === null));

    for (const { videoId: closedId, relPath, name } of closed) {
      const inspected = await tool(session, 'videos_inspect', { video: closedId });
      expect(inspected.isError, JSON.stringify(inspected.body)).toBe(false);
      expect(inspected.body).toMatchObject({ videoId: closedId, name });
      expect(runtime.videos.ref(closedId)?.relPath).toBe(relPath);
    }

    // Not in the session source directories: not found, and not opened.
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-other-'));
    try {
      const outside = await client.request('videos.create', {
        projectId: (await client.request('projects.open', { path: other })).project.id,
      });
      await client.request('videos.close', { videoId: outside.ref.videoId });
      await until(() => runtime.videos.ref(outside.ref.videoId) === null);
      const missing = await tool(session, 'videos_inspect', { video: outside.ref.videoId });
      expect(missing.body.error).toMatchObject({ code: 'VIDEO_NOT_FOUND' });
      expect(runtime.videos.ref(outside.ref.videoId)).toBeNull();
      const nonsense = await tool(session, 'videos_inspect', { video: newId('video') });
      expect(nonsense.body.error.code).toBe('VIDEO_NOT_FOUND');
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('videos_delete: risk high, still asks even when edits are auto-accepted; denial changes nothing, allow moves it to the trash; videos outside the source directory are not found', async () => {
    const { session } = await send('删掉样片', { accessMode: 'autoAcceptEdits' });
    // Deleting is rejected while the UI has the video open (VIDEO_IN_USE): close it first.
    await client.request('videos.close', { videoId });
    const dir = path.join(project.path, videoPath);
    const asked = async () => {
      const pending = await until(() => runtime.harness.approvals.pending()[0]);
      expect(pending).toMatchObject({ action: { kind: 'tool', name: 'videos_delete', targets: [videoPath] }, risk: 'high' });
      return pending;
    };

    const denied = tool(session, 'videos_delete', { video: videoPath });
    await client.request('approvals.respond', { approvalId: (await asked()).approvalId, decision: 'deny' });
    expect((await denied).body.error).toMatchObject({ code: 'APPROVAL_DENIED', risk: 'high' });
    await fs.access(path.join(dir, 'video.db'));

    const allowed = tool(session, 'videos_delete', { video: videoPath });
    await client.request('approvals.respond', { approvalId: (await asked()).approvalId, decision: 'allow' });
    const done = await allowed;
    expect(done.isError).toBe(false);
    expect(done.body).toMatchObject({ status: 'trashed', videoId, name: '样片', approval: { risk: 'high', decidedBy: 'user' } });
    await expect(fs.stat(dir)).rejects.toThrow();
    expect((await client.request('space.list', { trash: 'only' })).entries.map((e) => e.id)).toEqual([done.body.entryId]);

    // Not in the session source directories (or nonexistent): not asked, just not found.
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-other-'));
    try {
      const outside = await client.request('videos.create', {
        projectId: (await client.request('projects.open', { path: other })).project.id,
      });
      const missing = await tool(session, 'videos_delete', { video: path.join(other, outside.ref.relPath) });
      expect(missing.body.error).toMatchObject({ code: 'VIDEO_NOT_FOUND' });
      expect(runtime.harness.approvals.pending()).toEqual([]);
      await client.request('videos.close', { videoId: outside.ref.videoId });
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('after a session is deleted its token is invalidated, and videos the agent opened close after the grace period', async () => {
    const { session } = await send('读一下');
    // The UI closed it first, so only the agent still has it open.
    await client.request('videos.close', { videoId });
    await tool(session, 'videos_inspect', { video: videoPath });
    expect(runtime.videos.ref(videoId)).not.toBeNull();

    session.finish();
    await client.request('conversations.delete', { conversationId });
    const server = session.options.mcpServers!.cuccut!;
    expect((await post(server.url, server.headers, { jsonrpc: '2.0', id: 1, method: 'ping' })).status).toBe(401);
    await until(() => runtime.videos.ref(videoId) === null);
  });
});
