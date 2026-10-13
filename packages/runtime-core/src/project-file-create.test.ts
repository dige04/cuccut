import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import type { AgentDriver, AgentSession } from '@cuccut/harness';
import { RpcError, type DriverProbe } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { fakeProbe } from './agent-tools/testing/fake-agent.ts';
import { createProjectFile, numberedName } from './project-file-create.ts';
import { startRuntime, type RunningRuntime } from './runtime.ts';

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

async function write(file: string, content = 'x'): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

const PAGE = '<!doctype html>\n<title>短片</title>\n';

describe('create project file (projects.files.create)', () => {
  let dir: string;
  let root: string;
  const scope = { projectId: 'proj_a' };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-create-'));
    root = path.join(dir, 'project');
    await write(path.join(root, 'notes.md'));
    await write(path.join(root, 'pages', 'keep.txt'));
    await write(path.join(root, 'Intro.video', 'video.db'), 'db');
    await write(path.join(root, 'Intro.video', 'blobs', 'x.bin'));
    await write(path.join(root, '.ccut', 'project.json'));
    await write(path.join(root, 'node_modules', 'pkg', 'index.js'));
    await write(path.join(dir, 'outside', 'secret.txt'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes UTF-8 text in the root directory, returns path relative to project and entry', async () => {
    const result = await createProjectFile(root, scope, { name: '新网页.html', content: PAGE });
    expect(result.target).toEqual({ projectId: 'proj_a', path: '新网页.html' });
    expect(result.entry).toMatchObject({ path: '新网页.html', name: '新网页.html', isDir: false, kind: 'document' });
    expect(result.entry.size).toBe(Buffer.byteLength(PAGE));
    expect(result.entry.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await fs.readFile(path.join(root, '新网页.html'), 'utf8')).toBe(PAGE);
  });

  it('subdirectory: path relative to root, separated by /; name takes only the last segment', async () => {
    const result = await createProjectFile(root, scope, { name: '../../escape/page.html', content: 'a', dir: 'pages/' });
    expect(result.target).toEqual({ projectId: 'proj_a', path: 'pages/page.html' });
    expect(await fs.readFile(path.join(root, 'pages', 'page.html'), 'utf8')).toBe('a');
    await expect(fs.stat(path.join(dir, 'escape'))).rejects.toThrow();
  });

  it('name collision does not overwrite: tries \'name 2.ext\', then \'name 3.ext\'', async () => {
    const first = await createProjectFile(root, scope, { name: 'page.html', content: '1' });
    const second = await createProjectFile(root, scope, { name: 'page.html', content: '2' });
    const third = await createProjectFile(root, scope, { name: 'page.html', content: '3' });
    expect([first, second, third].map((r) => r.entry.name)).toEqual(['page.html', 'page 2.html', 'page 3.html']);
    expect(await fs.readFile(path.join(root, 'page.html'), 'utf8')).toBe('1');
    expect(await fs.readFile(path.join(root, 'page 3.html'), 'utf8')).toBe('3');
    // Also skips a directory with the same name.
    const dirClash = await createProjectFile(root, scope, { name: 'pages', content: 'x' });
    expect(dirClash.entry.name).toBe('pages 2');
    expect(numberedName('archive.tar.gz', 2)).toBe('archive.tar 2.gz');
    expect(numberedName('README', 3)).toBe('README 3');
  });

  it('dir escapes, absolute path, nonexistent, not a directory, hidden / dependency / video directory: rejected', async () => {
    const reject = async (dirParam: string) =>
      (await rejection(createProjectFile(root, scope, { name: 'a.html', content: '', dir: dirParam }))).code;
    expect(await reject('..')).toBe('invalid-request');
    expect(await reject('../outside')).toBe('invalid-request');
    expect(await reject(path.join(dir, 'outside'))).toBe('invalid-request');
    expect(await reject('.ccut')).toBe('invalid-request');
    expect(await reject('node_modules/pkg')).toBe('invalid-request');
    expect(await reject('Intro.video')).toBe('invalid-request');
    expect(await reject('Intro.video/blobs')).toBe('invalid-request');
    expect(await reject('missing')).toBe('not-found');
    expect(await reject('notes.md')).toBe('invalid-request');
    await expect(fs.stat(path.join(root, 'Intro.video', 'blobs', 'a.html'))).rejects.toThrow();
  });

  it('symbolic link: a directory pointing out of root cannot be written; one pointing inside root is written normally', async () => {
    await fs.symlink(path.join(dir, 'outside'), path.join(root, 'out-link'));
    await fs.symlink(path.join(root, 'pages'), path.join(root, 'pages-link'));
    expect((await rejection(createProjectFile(root, scope, { name: 'a.html', content: '', dir: 'out-link' }))).code).toBe(
      'invalid-request',
    );
    const inside = await createProjectFile(root, scope, { name: 'b.html', content: 'b', dir: 'pages-link' });
    expect(inside.target).toEqual({ projectId: 'proj_a', path: 'pages-link/b.html' });
    expect(await fs.readFile(path.join(root, 'pages', 'b.html'), 'utf8')).toBe('b');
  });

  it('empty name, ., .., names starting with a dot, dependency directory names, control characters: rejected', async () => {
    for (const name of ['', '   ', '.', '..', 'sub/..', '.env', '.ccut', 'node_modules', 'a\u0000b.html', 'a\nb.html']) {
      expect((await rejection(createProjectFile(root, scope, { name, content: '' }))).code).toBe('invalid-request');
    }
    await expect(fs.stat(path.join(root, '.env'))).rejects.toThrow();
  });

  it('root directory does not exist: not-found', async () => {
    expect((await rejection(createProjectFile(path.join(dir, 'gone'), scope, { name: 'a.html', content: '' }))).code).toBe('not-found');
  });
});

describe('create project file via gateway (end to end)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-create-e2e-'));
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') }),
      drivers: () => [new IdleDriver()],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'cli', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('project session and projectId land in the project directory, located by project; sessions without a project land in the working directory, located by session; parameters strictly validated', async () => {
    const projectDir = path.join(dir, 'proj');
    await fs.mkdir(projectDir, { recursive: true });
    const { project } = await client.request('projects.open', { path: projectDir });
    const { conversation } = await client.request('conversations.create', { projectId: project.id });

    const viaConversation = await client.request('projects.files.create', {
      conversationId: conversation.id,
      name: 'page.html',
      content: PAGE,
    });
    expect(viaConversation.target).toEqual({ projectId: project.id, path: 'page.html' });
    const viaProject = await client.request('projects.files.create', { projectId: project.id, name: 'page.html', content: PAGE });
    expect(viaProject.target).toEqual({ projectId: project.id, path: 'page 2.html' });
    expect(await fs.readFile(path.join(project.path, 'page 2.html'), 'utf8')).toBe(PAGE);
    const listed = await client.request('projects.files.list', { conversationId: conversation.id });
    expect(listed.entries.map((e) => e.path)).toEqual(['page 2.html', 'page.html']);

    const handle = await client.request('media.resolve', viaProject.target);
    expect(await (await fetch(handle.url)).text()).toBe(PAGE);

    const loose = await client.request('conversations.create', {});
    const scratch = await client.request('projects.files.create', {
      conversationId: loose.conversation.id,
      name: 'draft.html',
      content: 'x',
    });
    expect(scratch.target).toEqual({ conversationId: loose.conversation.id, path: 'draft.html' });
    expect(await fs.readFile(path.join(loose.conversation.cwd, 'draft.html'), 'utf8')).toBe('x');

    const both = { conversationId: conversation.id, projectId: project.id, name: 'a.html', content: '' } as never;
    expect((await rejection(client.request('projects.files.create', both))).code).toBe('invalid-request');
    const neither = { name: 'a.html', content: '' } as never;
    expect((await rejection(client.request('projects.files.create', neither))).code).toBe('invalid-request');
    expect((await rejection(client.request('projects.files.create', { projectId: project.id, name: '', content: '' }))).code).toBe(
      'invalid-request',
    );
    expect(
      (await rejection(client.request('projects.files.create', { projectId: 'proj_missing', name: 'a.html', content: '' }))).code,
    ).toBe('not-found');
    expect(
      (await rejection(client.request('projects.files.create', { conversationId: 'conv_missing', name: 'a.html', content: '' }))).code,
    ).toBe('not-found');
  });
});

class IdleDriver implements AgentDriver {
  readonly id = 'codex' as const;

  async probe(): Promise<DriverProbe> {
    return fakeProbe();
  }

  async createSession(): Promise<AgentSession> {
    throw new Error('这个测试不开会话');
  }
}
