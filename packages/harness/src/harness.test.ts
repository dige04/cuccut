import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError } from '@cuccut/protocol';
import { HarnessProjects as HP } from '@cuccut/protocol/messages/harness';
import {
  ConversationStore,
  ProjectStore,
  projectMarkerPath,
  readProjectMarker,
  resolveRuntimeHome,
  type RuntimeHome,
} from '@cuccut/runtime-storage';
import { DriverRegistry } from './agent-manager.ts';
import { Harness, withEditorContext } from './harness.ts';
import { silentLogger } from './logger.ts';

/** Decision order for the project marker `.ccut/project.json` and `openProject` (architecture design §5.1). All in a temp directory. */

let dir: string;
let home: RuntimeHome;
let harness: Harness;

async function open(): Promise<Harness> {
  return Harness.open({
    home,
    conversations: new ConversationStore(home.conversationsDir),
    projects: new ProjectStore(home.projectsFile),
    drivers: new DriverRegistry(),
    log: silentLogger,
  });
}

async function markerId(project: string): Promise<string | null> {
  const read = await readProjectMarker(project);
  return read.kind === 'ok' ? read.marker.projectId : null;
}

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

async function mkdir(name: string): Promise<string> {
  const target = path.join(dir, name);
  await fs.mkdir(target, { recursive: true });
  return fs.realpath(target);
}

beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-harness-')));
  home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  harness = await open();
});

afterEach(async () => {
  await harness.shutdown();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('project marker', () => {
  it('a marker is written when a new directory is opened, and reopening it is the same project; newly created projects also have a marker', async () => {
    const work = await mkdir('作品');
    const first = await harness.openProject(work);
    const marker = JSON.parse(await fs.readFile(projectMarkerPath(work), 'utf8'));
    expect(marker).toEqual({ format: 'cuccut.project', schemaVersion: 1, projectId: first.id, createdAt: first.createdAt });
    const again = await harness.openProject(path.join(work, '.'));
    expect(again.id).toBe(first.id);
    expect(harness.listProjects()).toHaveLength(1);

    const created = await harness.createProject({ name: '新片' });
    expect(await markerId(created.path)).toBe(created.id);
  });

  it('after moving, it is recognized by its marker: the id stays the same, the path and the name that follows the directory are updated, and the session remains with the working directory following it', async () => {
    const a = await mkdir('旧名');
    const project = await harness.openProject(a);
    const conversation = await harness.createConversation({ projectId: project.id });
    const b = path.join(dir, '新名');
    await fs.rename(a, b);

    const moved = await harness.openProject(b);
    expect(moved).toMatchObject({ id: project.id, path: b, name: '新名', createdAt: project.createdAt });
    expect(harness.listProjects()).toHaveLength(1);
    const after = harness.getConversation(conversation.id).conversation;
    expect(after).toMatchObject({ projectId: project.id, cwd: b });

    // A name the user changed is kept.
    await harness.updateProject({ projectId: project.id, name: '我的片子' });
    const c = path.join(dir, '再换一次');
    await fs.rename(b, c);
    expect(await harness.openProject(c)).toMatchObject({ id: project.id, path: c, name: '我的片子' });
  });

  it('a copied directory is a new project: the copy gets a new identifier, and the original project and its sessions are unaffected', async () => {
    const original = await mkdir('原片');
    const project = await harness.openProject(original);
    const conversation = await harness.createConversation({ projectId: project.id });
    const copy = path.join(dir, '原片 副本');
    await fs.cp(original, copy, { recursive: true });
    expect(await markerId(copy)).toBe(project.id);

    const opened = await harness.openProject(copy);
    expect(opened.id).not.toBe(project.id);
    expect(opened).toMatchObject({ path: copy, name: '原片 副本' });
    expect(await markerId(copy)).toBe(opened.id);
    expect(await markerId(original)).toBe(project.id);
    expect(harness.listProjects().find((p) => p.id === project.id)?.path).toBe(original);
    expect(harness.getConversation(conversation.id).conversation).toMatchObject({ projectId: project.id, cwd: original });

    // Each side stays stable when reopened.
    expect((await harness.openProject(original)).id).toBe(project.id);
    expect((await harness.openProject(copy)).id).toBe(opened.id);
  });

  it('marker deleted: if the registry has this path, the original id is kept (upgrade path), otherwise it is a new project', async () => {
    const work = await mkdir('作品');
    const project = await harness.openProject(work);
    await fs.rm(path.join(work, '.ccut'), { recursive: true });
    expect((await harness.openProject(work)).id).toBe(project.id);
    expect(await markerId(work)).toBe(project.id);

    // Move to an unregistered location, then delete the marker: new project.
    const elsewhere = path.join(dir, '别处');
    await fs.rename(work, elsewhere);
    await fs.rm(path.join(elsewhere, '.ccut'), { recursive: true });
    const fresh = await harness.openProject(elsewhere);
    expect(fresh.id).not.toBe(project.id);
  });

  it('an unrecognized marker is renamed and kept, then treated as absent; a marker from a newer version is refused and not rewritten', async () => {
    const broken = await mkdir('坏标记');
    await fs.mkdir(path.join(broken, '.ccut'));
    await fs.writeFile(projectMarkerPath(broken), '{ 不是 JSON');
    const project = await harness.openProject(broken);
    const kept = (await fs.readdir(path.join(broken, '.ccut'))).filter((name) => name.startsWith('project.json.corrupt-'));
    expect(kept).toHaveLength(1);
    expect(await fs.readFile(path.join(broken, '.ccut', kept[0]!), 'utf8')).toBe('{ 不是 JSON');
    expect(await markerId(broken)).toBe(project.id);

    const foreign = await mkdir('别的格式');
    await fs.mkdir(path.join(foreign, '.ccut'));
    await fs.writeFile(projectMarkerPath(foreign), JSON.stringify({ format: 'other', schemaVersion: 1, projectId: 'proj_x' }));
    const other = await harness.openProject(foreign);
    expect(other.id).not.toBe('proj_x');
    expect((await fs.readdir(path.join(foreign, '.ccut'))).some((name) => name.startsWith('project.json.corrupt-'))).toBe(true);

    const future = await mkdir('未来');
    await fs.mkdir(path.join(future, '.ccut'));
    const text = JSON.stringify({
      format: 'cuccut.project',
      schemaVersion: 2,
      projectId: 'proj_future',
      createdAt: '2030-01-01T00:00:00Z',
    });
    await fs.writeFile(projectMarkerPath(future), text);
    const error = await rejection(harness.openProject(future));
    expect(error.code).toBe('conflict');
    expect(error.details).toMatchObject({ code: 'PROJECT_MARKER_UNSUPPORTED', schemaVersion: 2 });
    expect(await fs.readFile(projectMarkerPath(future), 'utf8')).toBe(text);
    expect(harness.listProjects().some((p) => p.path === future)).toBe(false);
  });

  it.skipIf(process.getuid?.() === 0)('directory not writable: reports a clear error and does not register a project without a marker', async () => {
    const locked = await mkdir('只读');
    await fs.chmod(locked, 0o555);
    try {
      const error = await rejection(harness.openProject(locked));
      expect(error.code).toBe('forbidden');
      expect(error.details).toMatchObject({ code: 'PROJECT_DIR_READ_ONLY' });
      expect(harness.listProjects()).toHaveLength(0);
    } finally {
      await fs.chmod(locked, 0o755);
    }
  });

  it('registry lost: the id is rebuilt from the marker; loading the registry at startup does not write markers', async () => {
    const work = await mkdir('作品');
    const project = await harness.openProject(work);
    await harness.shutdown();
    await fs.rm(home.projectsFile);
    harness = await open();
    expect(harness.listProjects()).toHaveLength(0);
    const rebuilt = await harness.openProject(work);
    expect(rebuilt).toMatchObject({ id: project.id, createdAt: project.createdAt, path: work });

    // Registration from before the upgrade (no marker in the directory): not written on load; on open, reuse the registered id and write it.
    const legacy = await mkdir('旧项目');
    await harness.shutdown();
    const now = new Date().toISOString();
    const entry = { id: 'proj_legacy', name: '旧项目', path: legacy, createdAt: now, lastActiveAt: now, pinned: false, archived: false };
    await fs.writeFile(home.projectsFile, JSON.stringify({ schemaVersion: 1, projects: [entry] }));
    harness = await open();
    expect(harness.listProjects().map((p) => p.id)).toEqual(['proj_legacy']);
    expect(await markerId(legacy)).toBeNull();
    expect((await harness.openProject(legacy)).id).toBe('proj_legacy');
    expect(await markerId(legacy)).toBe('proj_legacy');
  });
});

/** Videos in a session without a project stay in its working directory; a project is created and bound only when the user creates one or deletes the session (architecture design §3.10), along with the migration at startup. */
describe('binds a project to a session without a project', () => {
  /** A fake video directory: any directory with `video.db` counts as a video (video format spec §1). */
  async function fakeVideo(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'video.db'), 'db');
  }

  const exists = (p: string) =>
    fs.lstat(p).then(
      () => true,
      () => false,
    );

  it('first binding creates a project (the name comes from the title when there is no video), changes the working directory, and moves the contents; repeated and concurrent calls get back the same project', async () => {
    const conversation = await harness.createConversation({ title: '我的片子' });
    expect(conversation.projectId).toBeNull();
    expect(conversation.cwd).toBe(path.join(home.scratchDir, conversation.id));
    await fs.writeFile(path.join(conversation.cwd, 'notes.txt'), '笔记');

    const [a, b] = await Promise.all([harness.ensureConversationProject(conversation.id), harness.ensureConversationProject(conversation.id)]);
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ name: '我的片子', path: path.join(home.projectsDir, '我的片子') });
    expect(await markerId(a.path)).toBe(a.id);
    expect(harness.getConversation(conversation.id).conversation).toMatchObject({ projectId: a.id, cwd: a.path });
    expect(await fs.readFile(path.join(a.path, 'notes.txt'), 'utf8')).toBe('笔记');
    // No turn is using the old working directory: delete it.
    expect(await exists(conversation.cwd)).toBe(false);

    expect((await harness.ensureConversationProject(conversation.id)).id).toBe(a.id);
    expect(harness.listProjects()).toHaveLength(1);

    // Binding is written to disk: still there after restart.
    await harness.shutdown();
    harness = await open();
    expect(harness.getConversation(conversation.id).conversation).toMatchObject({ projectId: a.id, cwd: a.path });
    expect((await harness.ensureConversationProject(conversation.id)).id).toBe(a.id);
    expect(harness.listProjects()).toHaveLength(1);

    // Without a title, use the default name.
    const untitled = await harness.createConversation({});
    expect((await harness.ensureConversationProject(untitled.id)).name).toBe(HP.untitledProject().text);
  });

  it('the project name is taken from the earliest-created video in the working directory; a given name is used when provided', async () => {
    const conversation = await harness.createConversation({ title: '帮我加字幕' });
    await fakeVideo(path.join(conversation.cwd, '访谈'));
    await new Promise((r) => setTimeout(r, 20));
    await fakeVideo(path.join(conversation.cwd, 'downloads', '花絮'));
    const project = await harness.ensureConversationProject(conversation.id);
    expect(project).toMatchObject({ name: '访谈', path: path.join(home.projectsDir, '访谈') });
    expect(await exists(path.join(project.path, '访谈', 'video.db'))).toBe(true);
    expect(await exists(path.join(project.path, 'downloads', '花絮', 'video.db'))).toBe(true);

    const named = await harness.createConversation({ title: '另一个' });
    await fakeVideo(path.join(named.cwd, '素材'));
    expect((await harness.ensureConversationProject(named.id, { name: '第 12 期' })).name).toBe('第 12 期');
  });

  it('crash recovery: exit after the project directory is chosen and before the session is bound; next time the same directory is reused, and no second project is created', async () => {
    const conversation = await harness.createConversation({ title: '半途' });
    // Simulate a binding interrupted halfway: the chosen directory was recorded, created and registered, but the session is not yet bound.
    const chosen = path.join(home.projectsDir, '半途');
    await fs.writeFile(path.join(conversation.cwd, '.cuccut-binding.json'), JSON.stringify({ path: chosen }));
    const half = await harness.createProject({ name: '半途' });
    expect(half.path).toBe(chosen);

    const project = await harness.ensureConversationProject(conversation.id);
    expect(project.id).toBe(half.id);
    expect(harness.listProjects()).toHaveLength(1);
    expect(await exists(path.join(project.path, '.cuccut-binding.json'))).toBe(false);
    expect(await exists(conversation.cwd)).toBe(false);
  });

  it('startup migration: working directories and videos of sessions without a project are left alone; directories without a session are moved into \'Recovered videos\' (named in the UI language, and reused on later startups); those without videos are deleted', async () => {
    const live = await harness.createConversation({ title: '旧会话' });
    await fakeVideo(path.join(live.cwd, '旧视频'));
    await fs.writeFile(path.join(live.cwd, 'exports.txt'), 'x');
    const plain = await harness.createConversation({ title: '只聊天' });
    await fs.writeFile(path.join(plain.cwd, 'draft.txt'), 'x');
    const orphan = path.join(home.scratchDir, 'conv_gone');
    await fakeVideo(path.join(orphan, '孤儿视频'));
    await fs.writeFile(path.join(orphan, '.hidden'), 'x');
    const empty = path.join(home.scratchDir, 'conv_empty');
    await fs.mkdir(empty, { recursive: true });
    await fs.writeFile(path.join(empty, 'scrap.txt'), 'x');

    const result = await harness.migrateScratch();
    expect(result).toEqual({ moved: 0, folded: 0, recovered: 1, removed: 1 });

    // A project-less session with videos does not get a project: the videos stay in its working directory.
    expect(harness.getConversation(live.id).conversation).toMatchObject({ projectId: null, cwd: live.cwd });
    expect(await exists(path.join(live.cwd, '旧视频', 'video.db'))).toBe(true);
    expect(await exists(path.join(live.cwd, 'exports.txt'))).toBe(true);
    expect(harness.getConversation(plain.id).conversation).toMatchObject({ projectId: null, cwd: plain.cwd });
    expect(await exists(path.join(plain.cwd, 'draft.txt'))).toBe(true);

    const recovered = harness.listProjects().find((p) => p.name === HP.recoveredVideos().text)!;
    expect(recovered).toBeTruthy();
    expect(await exists(path.join(recovered.path, '孤儿视频', 'video.db'))).toBe(true);
    expect(await exists(path.join(recovered.path, '.hidden'))).toBe(false);
    expect(await exists(orphan)).toBe(false);
    expect(await exists(empty)).toBe(false);

    // Another one without a session: collected into the same "Recovered videos" project, with duplicate names numbered.
    const another = path.join(home.scratchDir, 'conv_gone2');
    await fakeVideo(path.join(another, '孤儿视频'));
    await harness.shutdown();
    harness = await open();
    expect(await harness.migrateScratch()).toMatchObject({ recovered: 1 });
    expect(harness.listProjects().filter((p) => p.name.startsWith(HP.recoveredVideos().text))).toHaveLength(1);
    expect(await exists(path.join(recovered.path, '孤儿视频 2', 'video.db'))).toBe(true);
  });

  it('startup migration: working directories still left by sessions that belong to a project (links left after binding during a turn, or leftover files) are cleaned up', async () => {
    const conversation = await harness.createConversation({ title: '收尾' });
    const project = await harness.ensureConversationProject(conversation.id);
    const scratch = path.join(home.scratchDir, conversation.id);
    await fs.mkdir(scratch, { recursive: true });
    await fs.writeFile(path.join(scratch, 'late.txt'), 'x');
    await harness.migrateScratch();
    expect(await exists(scratch)).toBe(false);
    expect(await exists(path.join(project.path, 'late.txt'))).toBe(true);

    await fs.symlink(project.path, scratch, 'dir');
    await harness.migrateScratch();
    expect(await exists(scratch)).toBe(false);
    expect(await exists(path.join(project.path, 'late.txt'))).toBe(true);
  });

  it('deleting a session whose working directory still has videos: first create a project named after the video, move them in, then delete, so no video is lost; working directories without videos are deleted with the session', async () => {
    const legacy = await harness.createConversation({ title: '要删的' });
    await fakeVideo(path.join(legacy.cwd, '留下的视频'));
    await harness.deleteConversation(legacy.id);
    const project = harness.listProjects().find((p) => p.name === '留下的视频')!;
    expect(project).toBeTruthy();
    expect(await exists(path.join(project.path, '留下的视频', 'video.db'))).toBe(true);
    expect(await exists(legacy.cwd)).toBe(false);

    const chat = await harness.createConversation({ title: '闲聊' });
    await fs.writeFile(path.join(chat.cwd, 'a.txt'), 'x');
    await harness.deleteConversation(chat.id);
    expect(await exists(chat.cwd)).toBe(false);
    expect(harness.listProjects()).toHaveLength(1);
  });

  it('working directories from an older version stored in Runtime Home: moved to the new location at startup, and the session follows; those belonging to a project or without a session are cleaned up as before', async () => {
    await harness.shutdown();
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home'), CUCCUT_SESSIONS_DIR: path.join(dir, 'sessions') });
    const legacyDir = home.legacyScratchDir!;
    expect(legacyDir).toBe(path.join(dir, 'home', 'scratch'));
    // First create the session at the old location: open with a Home in the old layout.
    const oldHome = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
    harness = await Harness.open({
      home: oldHome,
      conversations: new ConversationStore(oldHome.conversationsDir),
      projects: new ProjectStore(oldHome.projectsFile),
      drivers: new DriverRegistry(),
      log: silentLogger,
    });
    const kept = await harness.createConversation({ title: '留着' });
    await fakeVideo(path.join(kept.cwd, '旧视频'));
    const gone = await harness.createConversation({ title: '目录没了' });
    await fs.rm(gone.cwd, { recursive: true });
    const orphan = path.join(legacyDir, 'conv_gone');
    await fakeVideo(path.join(orphan, '孤儿视频'));
    await harness.shutdown();

    harness = await open();
    const result = await harness.migrateScratch();
    expect(result).toMatchObject({ moved: 2, recovered: 1 });
    const moved = harness.getConversation(kept.id).conversation;
    expect(moved).toMatchObject({ projectId: null, cwd: path.join(home.scratchDir, kept.id) });
    expect(await exists(path.join(moved.cwd, '旧视频', 'video.db'))).toBe(true);
    expect(harness.getConversation(gone.id).conversation.cwd).toBe(path.join(home.scratchDir, gone.id));
    expect(await exists(path.join(home.scratchDir, gone.id))).toBe(true);
    expect(await exists(legacyDir)).toBe(false);

    // Persisted: after restart it is still at the new location, and running again does nothing.
    await harness.shutdown();
    harness = await open();
    expect(harness.getConversation(kept.id).conversation.cwd).toBe(moved.cwd);
    expect(await harness.migrateScratch()).toEqual({ moved: 0, folded: 0, recovered: 0, removed: 0 });
  });

  it('a video still open is not put into a project: refused (VIDEO_IN_USE), with no project created, bound or moved; deleting the session is refused too; after it is closed it is put in as usual', async () => {
    await harness.shutdown();
    let busy: string[] = [];
    const idleClosed: string[] = [];
    harness = await Harness.open({
      home,
      conversations: new ConversationStore(home.conversationsDir),
      projects: new ProjectStore(home.projectsFile),
      drivers: new DriverRegistry(),
      log: silentLogger,
      openVideoDirs: () => busy,
      closeIdleVideos: async (dir) => void idleClosed.push(dir),
    });
    const conversation = await harness.createConversation({ title: '开着' });
    await fakeVideo(path.join(conversation.cwd, '开着的'));
    await fs.writeFile(path.join(conversation.cwd, 'b.txt'), 'x');
    const real = await fs.realpath(conversation.cwd);
    busy = [path.join(real, '开着的')];
    const projectsBefore = harness.listProjects().length;

    const refused = await rejection(harness.ensureConversationProject(conversation.id));
    expect(refused.code).toBe('conflict');
    expect(refused.details).toMatchObject({ code: 'VIDEO_IN_USE', videos: ['开着的'] });
    // First close the ones only waiting to close in the grace period, then check whether any are still open.
    expect(idleClosed).toEqual([real]);
    expect(harness.listProjects()).toHaveLength(projectsBefore);
    expect(harness.getConversation(conversation.id).conversation).toMatchObject({ projectId: null, cwd: conversation.cwd });
    expect(await exists(path.join(conversation.cwd, '开着的', 'video.db'))).toBe(true);
    expect(await exists(path.join(conversation.cwd, 'b.txt'))).toBe(true);

    // Deleting a session must first move its videos into the project: likewise rejected, and the session record and working directory are left as they are.
    expect((await rejection(harness.deleteConversation(conversation.id))).details).toMatchObject({ code: 'VIDEO_IN_USE' });
    expect(harness.getConversation(conversation.id).conversation.projectId).toBeNull();
    expect(await exists(path.join(conversation.cwd, '开着的', 'video.db'))).toBe(true);

    busy = [];
    const project = await harness.ensureConversationProject(conversation.id);
    expect(await exists(path.join(project.path, '开着的', 'video.db'))).toBe(true);
    expect(await exists(path.join(project.path, 'b.txt'))).toBe(true);
    expect(await exists(conversation.cwd)).toBe(false);
  });

  it('a video opened after the check (race): the rest are moved, it stays in the working directory, and is moved after it is closed', async () => {
    await harness.shutdown();
    let busy: string[] = [];
    let checked = false;
    harness = await Harness.open({
      home,
      conversations: new ConversationStore(home.conversationsDir),
      projects: new ProjectStore(home.projectsFile),
      drivers: new DriverRegistry(),
      log: silentLogger,
      // The first time is the check before binding: at that point nothing was open.
      openVideoDirs: () => (checked ? busy : ((checked = true), [])),
    });
    const conversation = await harness.createConversation({ title: '开着' });
    await fakeVideo(path.join(conversation.cwd, '开着的'));
    await fs.writeFile(path.join(conversation.cwd, 'b.txt'), 'x');
    busy = [path.join(await fs.realpath(conversation.cwd), '开着的')];
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const project = await harness.ensureConversationProject(conversation.id);
      expect(await exists(path.join(project.path, 'b.txt'))).toBe(true);
      expect(await exists(path.join(conversation.cwd, '开着的', 'video.db'))).toBe(true);
      // Timers are fake, file operations are real: yield the event loop and wait for them to finish.
      const until = async (done: () => boolean | Promise<boolean>) => {
        for (let i = 0; i < 5000 && !(await done()); i++) await new Promise((r) => setImmediate(r));
      };
      // Still open: don't move at the scheduled time, wait for the next one.
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(30_000);
      await until(() => vi.getTimerCount() === 1);
      expect(await exists(path.join(conversation.cwd, '开着的', 'video.db'))).toBe(true);
      // After the video is closed, it moves itself later (no need to wait for the next startup).
      busy = [];
      await vi.advanceTimersByTimeAsync(30_000);
      await until(async () => !(await exists(conversation.cwd)));
      expect(await exists(conversation.cwd)).toBe(false);
      expect(await exists(path.join(project.path, '开着的', 'video.db'))).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shared working directory (folderOf): a new session goes into that session\'s working directory; the shared one is always the one that has its own directory; when that one belongs to a project, it is created inside the project', async () => {
    const owner = await harness.createConversation({ title: '原来的' });
    const guest = await harness.createConversation({ title: '切片', folderOf: owner.id });
    expect(guest).toMatchObject({ projectId: null, cwd: owner.cwd, folderOf: owner.id });
    // Opening from a shared session: it still uses the original one.
    expect(await harness.createConversation({ folderOf: guest.id })).toMatchObject({ cwd: owner.cwd, folderOf: owner.id });
    expect(await exists(path.join(home.scratchDir, guest.id))).toBe(false);

    const project = await harness.createProject({ name: '有项目的' });
    const inProject = await harness.createConversation({ projectId: project.id });
    const follower = await harness.createConversation({ folderOf: inProject.id });
    expect(follower).toMatchObject({ projectId: project.id, cwd: project.path });
    expect(follower.folderOf).toBeUndefined();

    // Persisted: still there after restart.
    await harness.shutdown();
    harness = await open();
    expect(harness.getConversation(guest.id).conversation).toMatchObject({ cwd: owner.cwd, folderOf: owner.id });
  });

  it('putting a shared session into a project: the session is moved in, sessions sharing it move along, and the card now points to the project; deleting a shared session does not touch the directory', async () => {
    const owner = await harness.createConversation({ title: '原来的' });
    await fakeVideo(path.join(owner.cwd, '访谈'));
    const guest = await harness.createConversation({ title: '切片', folderOf: owner.id });
    const other = await harness.createConversation({ title: '再切', folderOf: owner.id });
    harness.recordVideoCreated(guest.id, null, {
      videoId: 'vid_1',
      videoName: '片段',
      target: { conversationId: owner.id, path: '访谈 片段' },
      videoRevision: '1',
    });
    await fakeVideo(path.join(owner.cwd, '访谈 片段'));

    // Delete one shared session: the directory and videos remain.
    await harness.deleteConversation(other.id);
    expect(await exists(path.join(owner.cwd, '访谈', 'video.db'))).toBe(true);

    const project = await harness.ensureConversationProject(guest.id);
    expect(project.name).toBe('访谈');
    expect(harness.getConversation(owner.id).conversation).toMatchObject({ projectId: project.id, cwd: project.path });
    const moved = harness.getConversation(guest.id);
    expect(moved.conversation).toMatchObject({ projectId: project.id, cwd: project.path });
    expect(moved.conversation.folderOf).toBeUndefined();
    expect(moved.items.find((item) => item.kind === 'video-created')).toMatchObject({ target: { projectId: project.id, path: '访谈 片段' } });
    expect(await exists(path.join(project.path, '访谈 片段', 'video.db'))).toBe(true);
    expect(await exists(owner.cwd)).toBe(false);
  });

  it('deleting the one whose directory other sessions share: first moved into a project, the sharing sessions move with it, and the directory is not lost', async () => {
    const owner = await harness.createConversation({ title: '原来的' });
    await fs.writeFile(path.join(owner.cwd, 'notes.txt'), '笔记');
    const guest = await harness.createConversation({ title: '切片', folderOf: owner.id });
    await harness.deleteConversation(owner.id);
    const { conversation } = harness.getConversation(guest.id);
    expect(conversation.projectId).not.toBeNull();
    expect(conversation.folderOf).toBeUndefined();
    expect(await fs.readFile(path.join(conversation.cwd, 'notes.txt'), 'utf8')).toBe('笔记');
  });

  it('at startup, follow that session: if it is already in a project, the rest move in too; if it is gone, the first one takes over the directory and the others share it', async () => {
    const owner = await harness.createConversation({ title: '原来的' });
    await fakeVideo(path.join(owner.cwd, '访谈'));
    const first = await harness.createConversation({ title: '一', folderOf: owner.id });
    const second = await harness.createConversation({ title: '二', folderOf: owner.id });
    const bound = await harness.createConversation({ title: '有项目的' });
    const boundGuest = await harness.createConversation({ title: '跟着', folderOf: bound.id });
    await harness.shutdown();
    // Simulate a record left by a crash: the record of one session is gone (there was no time to update the one sharing it); the other went into the project, and the one sharing it has not been updated yet.
    await fs.rm(path.join(home.conversationsDir, `${owner.id}.jsonl`), { force: true });
    harness = await open();
    const project = await harness.ensureConversationProject(bound.id);
    await harness.shutdown();
    await rewriteGuest(boundGuest.id, bound.id);
    harness = await open();
    await harness.migrateScratch();

    // The earliest-created one takes over the directory (two may have been created in the same millisecond; then by id).
    const [heir, other] = [first, second].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id));
    const a = harness.getConversation(heir!.id).conversation;
    expect(a).toMatchObject({ cwd: path.join(home.scratchDir, heir!.id), projectId: null });
    expect(a.folderOf).toBeUndefined();
    expect(await exists(path.join(a.cwd, '访谈', 'video.db'))).toBe(true);
    expect(harness.getConversation(other!.id).conversation).toMatchObject({ cwd: a.cwd, folderOf: heir!.id });
    const b = harness.getConversation(boundGuest.id).conversation;
    expect(b).toMatchObject({ projectId: project.id, cwd: project.path });
    expect(b.folderOf).toBeUndefined();
  });

  /** Change the shared session's record back to "not yet caught up": it still shares `ownerId`, and its working directory is its old working directory (simulating binding stopping before it could update it). */
  async function rewriteGuest(guestId: string, ownerId: string): Promise<void> {
    const file = path.join(home.conversationsDir, `${guestId}.jsonl`);
    const lines = (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
    for (const line of lines) {
      const conversation = line.snapshot?.conversation ?? line.conversation;
      if (conversation) Object.assign(conversation, { projectId: null, cwd: path.join(home.scratchDir, ownerId), folderOf: ownerId });
    }
    await fs.writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  }
});

describe('slide receipt', () => {
  it('one entry per deck: when validation passes again, the title, page count and task are updated and the id and position stay the same; the original task is kept when there is no task', async () => {
    const conversation = await harness.createConversation({ title: '做幻灯片' });
    const target = { conversationId: conversation.id, path: 'decks/talk' };
    harness.recordSlidesCreated(conversation.id, 'task_1', { target, title: '初稿', slideCount: 3 });
    harness.recordSlidesCreated(conversation.id, 'task_1', { target: { conversationId: conversation.id, path: 'other' }, title: '另一份', slideCount: 1 });
    const slides = () => harness.getConversation(conversation.id).items.filter((item) => item.kind === 'slides-created');
    const [first, other] = slides();
    expect(first).toMatchObject({ target, title: '初稿', slideCount: 3, taskId: 'task_1' });

    harness.recordSlidesCreated(conversation.id, 'task_2', { target, title: '定稿', slideCount: 5 });
    expect(slides()).toEqual([{ ...first, title: '定稿', slideCount: 5, taskId: 'task_2' }, other]);
    harness.recordSlidesCreated(conversation.id, null, { target, title: '定稿', slideCount: 6 });
    expect(slides()[0]).toMatchObject({ id: first!.id, slideCount: 6, taskId: 'task_2' });
  });
});

describe('withEditorContext', () => {
  const base = { videoId: 'vid', videoName: '样片', videoPath: 'videos/样片', revision: '3', selection: [], playheadSeconds: 1.5 };

  it('writes one line in the context block when the UI language is given', () => {
    const text = withEditorContext('剪一下', { ...base, uiLanguage: 'zh-Hans' });
    expect(text).toContain('<cuccut-editor-context>');
    expect(text).toContain('\n用户的界面语言是 zh-Hans。\n');
  });

  it('does not write this line when an older client gives no UI language', () => {
    expect(withEditorContext('剪一下', base)).not.toContain('界面语言');
  });
});
