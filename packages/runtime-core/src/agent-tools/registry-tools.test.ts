import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { newId, type CatalogCallResult, type ClientKind, type Id, type JobRecord, type JobSubmitter, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import type { HostedJob } from '@cuccut/jobs';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { writeSkill } from '../skills/testing/skill-fixtures.ts';
import { SAMPLE_PACK_DIR } from '../packs/testing/pack-fixtures.ts';
import { call as mcpCall, type Loose } from '../services/testing/mcp-client.ts';
import { ToolDriver, tool, until, type ToolSession } from './testing/fake-agent.ts';

/**
 * Registry-type tools (agent-surface design §4.3): `jobs_wait` / `jobs_list` / `jobs_retry`, `models_list`, `projects_list` / `projects_create`, `skills_list`, `library_list` / `library_show`. Each of the three principals (session, external service, terminal) goes through its visible scope. Jobs are created directly as managed jobs, without the video engine or models.
 */

describe('登记类工具', () => {
  let dir: string;
  let builtin: string;
  let home: RuntimeHome;
  let driver: ToolDriver;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let cli: CucCutClient;
  let project: Project;
  let hosted: HostedJob[];

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-registry-tools-')));
    hosted = [];
    builtin = path.join(dir, 'builtin-skills');
    await fs.mkdir(builtin);
    await writeSkill(builtin, 'caption-layout', { description: '字幕排版规则。   每行不超过 16 个字' });
    await writeSkill(builtin, 'b-roll');
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
    driver = new ToolDriver();
    runtime = await startRuntime({
      home,
      drivers: () => [driver],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
      skillsDir: builtin,
      initiator: { discoverer: null },
      nodes: { host: '127.0.0.1', advertiser: null },
    });
    client = await connect('desktop');
    cli = await connect('cli');
    ({ project } = await client.request('projects.create', { name: '登记' }));
  });

  afterEach(async () => {
    // Managed jobs must be ended by the host before the Runtime can stop.
    for (const job of hosted) await job.finish('cancelled');
    client?.close();
    cli?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function connect(kind: ClientKind): Promise<CucCutClient> {
    const { endpoint, token } = runtime.discovery;
    const connected = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind, name: 'test', version: '0' },
      reconnect: false,
    });
    await connected.connect();
    return connected;
  }

  /** A session that belongs to `projectId` (not in a project when none is given), and its native session. */
  async function agent(projectId: Id | null = project.id): Promise<{ conversationId: Id; session: ToolSession }> {
    const { conversation } = await client.request('conversations.create', { projectId });
    const before = driver.sessions.length;
    await client.request('conversations.send', { conversationId: conversation.id, text: 'hi', commandId: newId('cmd') });
    const session = await until(() => driver.sessions[before]);
    return { conversationId: conversation.id, session };
  }

  /** An open MCP service and a client token. */
  async function openMcp(): Promise<{ url: string; token: string; clientId: string }> {
    await client.request('services.configure', { serviceId: 'mcp', port: 0, level: 'auto' });
    const { service } = await client.request('services.start', { serviceId: 'mcp' });
    const { client: issued, token } = await client.request('services.mcp.createClient', { name: '测试客户端' });
    return { url: service.endpoint!, token, clientId: issued.clientId };
  }

  async function local(name: string, args: unknown, cwd = dir): Promise<CatalogCallResult> {
    return cli.request('catalog.call', { name, args, cwd });
  }

  async function localOk(name: string, args: unknown, cwd = dir): Promise<Loose> {
    const outcome = await local(name, args, cwd);
    if (!outcome.ok) throw new Error(`${name} 失败：${JSON.stringify(outcome.error)}`);
    return outcome.result;
  }

  /** Create a running managed job. */
  function hostJob(submitter: JobSubmitter, extra: Partial<JobRecord> = {}): HostedJob {
    const now = new Date().toISOString();
    const record: JobRecord = {
      jobId: newId('job'),
      kind: 'transcribe',
      state: 'running',
      phase: 'starting',
      progress: null,
      videoId: null,
      assetId: null,
      assetRevision: null,
      contentHash: `sha256:${'0'.repeat(64)}`,
      providerId: 'local',
      modelId: 'test-model',
      bundleId: null,
      inputHash: `sha256:${'1'.repeat(64)}`,
      submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
      ...extra,
    };
    const job = runtime.models.jobs.host(record, { hosted: 'test', control: { cancel() {}, interrupt() {} } });
    hosted.push(job);
    return job;
  }

  describe('任务', () => {
    it('jobs_wait：等到结束时 settled 为 true，结果与 jobs_inspect 相同；超时不算错，settled 为 false 并提示再调一次', async () => {
      const { conversationId, session } = await agent();
      const job = hostJob({ kind: 'agent', id: conversationId, taskId: newId('task') });

      const timedOut = await tool(session, 'jobs_wait', { jobId: job.jobId, timeoutSec: 1 });
      expect(timedOut.isError).toBe(false);
      expect(timedOut.body).toMatchObject({ jobId: job.jobId, state: 'running', settled: false });
      expect(timedOut.body.next).toContain('jobs_wait');

      const waiting = tool(session, 'jobs_wait', { jobId: job.jobId, timeoutSec: 10 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await job.finish('completed', { result: { documentId: null, artifactId: 'art_test' } });
      const settled = await waiting;
      expect(settled.isError).toBe(false);
      expect(settled.body).toMatchObject({ jobId: job.jobId, state: 'completed', settled: true });
      const { body: inspected } = await tool(session, 'jobs_inspect', { jobId: job.jobId });
      const { settled: flag, ...rest } = settled.body;
      expect(flag).toBe(true);
      expect(rest).toEqual(inspected);

      // A job that has already finished returns immediately; a wait above the 50-second cap is a parameter error.
      expect((await tool(session, 'jobs_wait', { jobId: job.jobId })).body.settled).toBe(true);
      const tooLong = await tool(session, 'jobs_wait', { jobId: job.jobId, timeoutSec: 51 });
      expect(tooLong.isError).toBe(true);
    });

    it('jobs_wait：别的会话的任务看不到', async () => {
      const { conversationId: other } = await agent();
      const { session } = await agent();
      const job = hostJob({ kind: 'agent', id: other, taskId: newId('task') });
      const refused = await tool(session, 'jobs_wait', { jobId: job.jobId, timeoutSec: 1 });
      expect(refused.isError).toBe(true);
      expect(refused.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('jobs_list：会话只看本会话的，对外服务只看本客户端的，终端看全部；子任务折叠，按状态与条数筛选', async () => {
      const { conversationId: mine, session } = await agent();
      const { conversationId: theirs } = await agent();
      const { url, token, clientId } = await openMcp();
      const second = await client.request('services.mcp.createClient', { name: '另一个' });

      const ownJob = hostJob({ kind: 'agent', id: mine, taskId: newId('task') });
      const otherJob = hostJob({ kind: 'agent', id: theirs, taskId: newId('task') });
      const serviceJob = hostJob({ kind: 'service', id: 'mcp', clientId });
      const foreignService = hostJob({ kind: 'service', id: 'mcp', clientId: second.client.clientId });
      const userJob = hostJob({ kind: 'connection', id: 'conn_test' });
      const child = hostJob({ kind: 'pipeline', id: userJob.jobId }, { kind: 'pipeline-step', parentJobId: userJob.jobId });
      await ownJob.finish('failed', { error: { code: 'TEST_FAILED', message: '测试失败' } });

      const agentListed = (await tool(session, 'jobs_list', {})).body;
      expect(agentListed.jobs.map((j: Loose) => j.jobId)).toEqual([ownJob.jobId]);
      expect(agentListed.jobs[0]).toMatchObject({
        kind: 'transcribe',
        state: 'failed',
        submittedBy: 'agent',
        error: { code: 'TEST_FAILED' },
      });

      const serviceListed = await mcpCall(url, token, 'jobs_list', {});
      expect(serviceListed.isError).toBe(false);
      expect(serviceListed.body.jobs.map((j: Loose) => j.jobId)).toEqual([serviceJob.jobId]);
      expect(serviceListed.body.jobs[0].submittedBy).toBe('external');

      const all = await localOk('jobs_list', {});
      const ids = all.jobs.map((j: Loose) => j.jobId);
      expect(ids.sort()).toEqual([ownJob.jobId, otherJob.jobId, serviceJob.jobId, foreignService.jobId, userJob.jobId].sort());
      expect(ids).not.toContain(child.jobId);
      expect(all.total).toBe(5);

      expect((await localOk('jobs_list', { state: 'settled' })).jobs.map((j: Loose) => j.jobId)).toEqual([ownJob.jobId]);
      expect((await localOk('jobs_list', { state: 'running' })).jobs).toHaveLength(4);
      const limited = await localOk('jobs_list', { limit: 2 });
      expect(limited.jobs).toHaveLength(2);
      expect(limited.truncated).toBe(true);
    });

    it('jobs_retry：不是固定流程的任务不能重跑；还在进行的流程也不能', async () => {
      const job = hostJob({ kind: 'connection', id: 'conn_test' });
      await job.finish('failed', { error: { code: 'TEST_FAILED', message: '测试失败' } });
      const refused = await local('jobs_retry', { jobId: job.jobId });
      expect(refused).toMatchObject({ ok: false, error: { code: 'JOB_NOT_RETRYABLE' } });

      const missing = await local('jobs_retry', { jobId: 'job_nope' });
      expect(missing).toMatchObject({ ok: false, error: { code: 'JOB_NOT_FOUND' } });
    });
  });

  describe('项目', () => {
    it('projects_list：会话只有所属的项目，不属于项目的会话没有；对外服务不给路径；终端列出全部', async () => {
      const { project: extra } = await client.request('projects.create', { name: '另一个' });
      const { session } = await agent();
      const inProject = (await tool(session, 'projects_list', {})).body;
      expect(inProject.projects).toEqual([expect.objectContaining({ projectId: project.id, name: '登记', path: project.path })]);

      const { session: loose } = await agent(null);
      const none = (await tool(loose, 'projects_list', {})).body;
      expect(none.projects).toEqual([]);
      expect(none.next).toContain('does not belong to any project');

      const { url, token } = await openMcp();
      const viaService = await mcpCall(url, token, 'projects_list', {});
      expect(viaService.isError).toBe(false);
      const serviceIds = viaService.body.projects.map((p: Loose) => p.projectId);
      expect(serviceIds).toEqual(expect.arrayContaining([project.id, extra.id]));
      expect(viaService.body.projects.every((p: Loose) => p.path === undefined)).toBe(true);
      expect(viaService.body.next).toContain('videos_create');

      // No project within scope: an external service cannot create projects; `next` gives the user's way forward.
      await client.request('services.configure', { serviceId: 'mcp', videos: { ids: [] } });
      const emptyService = await mcpCall(url, token, 'projects_list', {});
      expect(emptyService.body.projects).toEqual([]);
      expect(emptyService.body.next).toContain('cuccut projects create');
      expect(emptyService.body.next).toContain('cuccut mcp install');
      expect(emptyService.body.next).not.toContain('pass the projectId as');

      const all = await localOk('projects_list', {});
      expect(all.projects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: project.id, path: project.path, videoCount: 0 }),
          expect.objectContaining({ projectId: extra.id, path: extra.path }),
        ]),
      );
    });

    it('projects_create：终端里相对 cwd 新建目录并登记、改名；再建一次原样返回；文件不能当项目', async () => {
      const work = path.join(dir, 'work');
      await fs.mkdir(work);
      const created = await localOk('projects_create', { path: 'show/ep1', name: '第一期' }, work);
      const target = path.join(work, 'show', 'ep1');
      expect(created).toMatchObject({ name: '第一期', path: target, created: true, existing: false });
      expect((await fs.stat(path.join(target, '.ccut', 'project.json'))).isFile()).toBe(true);
      expect(runtime.harness.listProjects().find((p) => p.id === created.projectId)?.name).toBe('第一期');

      const again = await localOk('projects_create', { path: target, name: '别的名字' });
      expect(again).toMatchObject({ projectId: created.projectId, name: '第一期', created: false, existing: true });

      await fs.writeFile(path.join(work, 'note.txt'), 'x');
      expect(await local('projects_create', { path: 'note.txt' }, work)).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENTS' } });

      // The external service's catalog has no projects_create.
      const { url, token } = await openMcp();
      expect((await mcpCall(url, token, 'projects_create', { path: target })).isError).toBe(true);
    });
  });

  it('skills_list：id、名字、一行说明与开关；不给路径；skills_read 用这里的 id', async () => {
    await client.request('skills.setEnabled', { id: 'b-roll', enabled: false });
    const { session } = await agent();
    const listed = (await tool(session, 'skills_list', {})).body;
    expect(listed.skills).toEqual([
      expect.objectContaining({ id: 'b-roll', name: 'b-roll', enabled: false, origin: 'builtin', userInstalled: false }),
      expect.objectContaining({ id: 'caption-layout', description: '字幕排版规则。 每行不超过 16 个字', enabled: true }),
    ]);
    expect(JSON.stringify(listed)).not.toContain(builtin);
    expect((await tool(session, 'skills_read', { id: listed.skills[1].id })).isError).toBe(false);

    const viaCli = await localOk('skills_list', {});
    expect(viaCli.skills.map((s: Loose) => s.id)).toEqual(['b-roll', 'caption-layout']);
  });

  it('packs_list / packs_read / packs_choose_style: the packs, the active guide and why, files and a copied image, the choice through every principal', async () => {
    const empty = await localOk('packs_list', {});
    expect(empty).toMatchObject({ packs: [], active: null });
    await client.request('packs.install', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });

    // The session sees its own project's resolution.
    const { conversation } = await client.request('conversations.create', { projectId: project.id, accessMode: 'autoAcceptEdits' });
    const before = driver.sessions.length;
    await client.request('conversations.send', { conversationId: conversation.id, text: 'hi', commandId: newId('cmd') });
    const session = await until(() => driver.sessions[before]);
    const listed = (await tool(session, 'packs_list', {})).body;
    expect(listed.packs).toEqual([
      expect.objectContaining({
        id: 'news-desk',
        name: 'News desk',
        hasStyle: true,
        counts: { templates: 1, skills: 1, library: 2, examples: 1, quickActions: 3 },
        provides: { templates: ['news-desk-daily'], skills: ['news-desk-headlines'] },
      }),
    ]);
    expect(listed.active).toEqual({ packId: 'news-desk', reason: 'only', why: 'It is the only installed pack with a style guide.' });
    expect(JSON.stringify(listed)).not.toContain(home.root);

    const read = (await tool(session, 'packs_read', { id: 'news-desk' })).body;
    expect(read.style).toBe(await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8'));
    expect(read.examples).toEqual([
      expect.objectContaining({ file: 'examples/lower-third.png', kind: 'image', title: 'Lower third', still: 'examples/lower-third.png' }),
    ]);
    // An image is copied into the session's working directory, where a restricted session can open it.
    const image = (await tool(session, 'packs_read', { id: 'news-desk', path: 'examples/lower-third.png' })).body;
    expect(image).toMatchObject({ kind: 'image', mediaType: 'image/png', file: '.ccut/style/news-desk/lower-third.png' });
    expect((await fs.stat(path.join(project.path, '.ccut', 'style', 'news-desk', 'lower-third.png'))).isFile()).toBe(true);
    const manifest = (await tool(session, 'packs_read', { id: 'news-desk', path: 'pack.json' })).body;
    expect(JSON.parse(manifest.content).id).toBe('news-desk');
    for (const hidden of ['.cuccut-pack.json', '../news-desk/pack.json', 'nope.md']) {
      const refused = await tool(session, 'packs_read', { id: 'news-desk', path: hidden });
      expect(refused.isError, hidden).toBe(true);
      expect(refused.body.error.code).toBe('PACK_FILE_NOT_FOUND');
    }
    expect((await tool(session, 'packs_read', { id: 'no-such-pack' })).body.error.code).toBe('PACK_NOT_FOUND');

    const chosen = (await tool(session, 'packs_choose_style', { pack: 'none' })).body;
    expect(chosen).toMatchObject({ projectId: project.id, choice: 'none', active: { packId: null, reason: 'chosen-none' } });
    expect(await client.request('packs.active', { projectId: project.id })).toEqual({ pack: null, reason: 'chosen-none' });
    expect((await tool(session, 'packs_choose_style', { pack: 'no-such-pack' })).body.error.code).toBe('PACK_NOT_FOUND');
    expect((await tool(session, 'packs_choose_style', { pack: null, projectId: 'prj_other' })).body.error.code).toBe('PROJECT_NOT_FOUND');

    // A session outside any project has nothing to choose for.
    const { session: loose } = await agent(null);
    expect((await tool(loose, 'packs_choose_style', { pack: 'news-desk' })).body.error.code).toBe('NO_PROJECT');

    // The terminal: the project of the directory.
    const viaCli = await localOk('packs_list', {}, project.path);
    expect(viaCli.active).toMatchObject({ packId: null, reason: 'chosen-none' });
    expect((await localOk('packs_list', {})).active).toBeNull();
    expect(await localOk('packs_choose_style', { pack: null }, project.path)).toMatchObject({ choice: null, active: { packId: 'news-desk', reason: 'only' } });
    expect((await local('packs_choose_style', { pack: 'none' })).ok).toBe(false);
    const cliImage = await localOk('packs_read', { id: 'news-desk', path: 'examples/lower-third.png' });
    expect(cliImage.file).toBe(path.join(home.packsDir, 'news-desk', 'examples', 'lower-third.png'));

    // An external service lists and reads, gets no paths, and can't choose.
    const { url, token } = await openMcp();
    const viaService = await mcpCall(url, token, 'packs_list', {});
    expect(viaService.body).toMatchObject({ active: null, packs: [expect.objectContaining({ id: 'news-desk' })] });
    const serviceImage = await mcpCall(url, token, 'packs_read', { id: 'news-desk', path: 'examples/lower-third.png' });
    expect(serviceImage.body.file).toBeNull();
    expect(JSON.stringify(serviceImage.body)).not.toContain(home.root);
    expect((await mcpCall(url, token, 'packs_choose_style', { pack: 'none' })).isError).toBe(true);
  });

  it('library_list / library_show：条目摘要与内容；没有的条目报 LIBRARY_ENTRY_NOT_FOUND', async () => {
    const { entry } = await client.request('library.put', {
      library: 'glossaries',
      content: {
        name: '术语',
        kind: 'transcription',
        language: null,
        defaultEnabled: true,
        terms: [{ canonical: 'CucCut', misheard: ['包剪'] }],
      },
    });
    const { session } = await agent();
    const listed = (await tool(session, 'library_list', {})).body;
    expect(listed.entries).toEqual([
      expect.objectContaining({
        library: 'glossaries',
        id: entry.id,
        name: '术语',
        kind: 'transcription',
        termCount: 1,
        defaultEnabled: true,
      }),
    ]);
    expect((await tool(session, 'library_list', { library: 'voices' })).body.entries).toEqual([]);
    expect((await tool(session, 'library_list', { kind: 'translation' })).body.entries).toEqual([]);

    const shown = (await tool(session, 'library_show', { library: 'glossaries', id: entry.id })).body;
    expect(shown).toMatchObject({
      library: 'glossaries',
      id: entry.id,
      name: '术语',
      terms: [{ canonical: 'CucCut', misheard: ['包剪'] }],
    });
    const missing = await tool(session, 'library_show', { library: 'glossaries', id: 'lib_nope' });
    expect(missing.isError).toBe(true);
    expect(missing.body.error.code).toBe('LIBRARY_ENTRY_NOT_FOUND');

    const { url, token } = await openMcp();
    expect((await mcpCall(url, token, 'library_list', {})).body.entries).toHaveLength(1);
  });

  it('profile_show / profile_answer: the same view for sessions, external services and the terminal; preference and rule saves ask at risk high; project level needs a project', async () => {
    await client.request('profile.setPreferences', { own: '- Hooks under three seconds' });
    await client.request('profile.putRule', { rule: { name: 'Gameplay stays clear', when: 'the clip is gameplay', instruction: 'Never cover the game.', note: 'private' } });
    await client.request('profile.setPreferences', { projectId: project.id, own: '- Vertical 9:16' });

    // A session in the project sees the general and the project level; the note to self is never shown.
    const { conversation } = await client.request('conversations.create', { projectId: project.id });
    await client.request('conversations.send', { conversationId: conversation.id, text: 'hi', commandId: newId('cmd'), accessMode: 'autoAcceptEdits' });
    const session = await until(() => driver.sessions.find((s) => s.options.mcpServers && s.inputs.includes('hi')));
    const shown = (await tool(session, 'profile_show', {})).body;
    expect(shown.interview).toMatchObject({ status: 'pending', answers: {} });
    expect(shown.interview.questions.map((q: Loose) => q.id)).toEqual(['who', 'record', 'platforms', 'annoys', 'names']);
    expect(shown.preferences).toEqual({ general: '- Hooks under three seconds', interviewSection: '', project: '- Vertical 9:16' });
    expect(shown.rules.workspace).toEqual([expect.objectContaining({ name: 'Gameplay stays clear', when: 'the clip is gameplay', enabled: true })]);
    expect(shown.rules.workspace[0].note).toBeUndefined();
    expect(shown.rules.project).toEqual([]);
    expect(shown.project).toEqual({ projectId: project.id, name: '登记' });

    // Answers are `edit`: accepted automatically in autoAcceptEdits, and the status does not change.
    const answered = await tool(session, 'profile_answer', { answers: { who: 'Coding tutorials' } });
    expect(answered.isError).toBe(false);
    expect(answered.body).toMatchObject({ status: 'pending', answers: { who: 'Coding tutorials' }, approval: { risk: 'edit', decidedBy: 'auto' } });
    expect((await client.request('profile.get', {})).interview.answers).toEqual({ who: 'Coding tutorials' });

    // Preferences and rules are `high`: asked even in autoAcceptEdits; a denial changes nothing.
    const asked = async (name: string) => {
      const pending = await until(() => runtime.harness.approvals.pending()[0]);
      expect(pending).toMatchObject({ action: { kind: 'tool', name }, risk: 'high' });
      return pending;
    };
    const denied = tool(session, 'profile_preferences_set', { level: 'workspace', text: '- Captions always', mode: 'append' });
    const pending = await asked('profile_preferences_set');
    expect(pending.action.summary).toContain('- Captions always');
    await client.request('approvals.respond', { approvalId: pending.approvalId, decision: 'deny' });
    expect((await denied).body.error).toMatchObject({ code: 'APPROVAL_DENIED', risk: 'high' });
    expect((await client.request('profile.get', {})).preferences.own).toBe('- Hooks under three seconds');

    const appended = tool(session, 'profile_preferences_set', { level: 'workspace', text: '- Captions always', mode: 'append' });
    const appendAsked = await asked('profile_preferences_set');
    // A save made while the approval is open is kept: the append is built from the text as it is when it is written.
    await client.request('profile.setPreferences', { own: '- Hooks under three seconds\n- Music low' });
    await client.request('approvals.respond', { approvalId: appendAsked.approvalId, decision: 'allow' });
    expect((await appended).body).toMatchObject({
      level: 'workspace',
      text: '- Hooks under three seconds\n- Music low\n- Captions always',
      approval: { risk: 'high', decidedBy: 'user' },
    });

    const saved = tool(session, 'profile_rules_save', { level: 'project', rule: { name: 'Outro', when: 'the video ends', instruction: 'Add the subscribe card.' } });
    await client.request('approvals.respond', { approvalId: (await asked('profile_rules_save')).approvalId, decision: 'allow' });
    const savedRule = (await saved).body.rule;
    expect(savedRule).toMatchObject({ name: 'Outro', when: 'the video ends', stage: 'any', enabled: true });
    expect((await client.request('profile.getProject', { projectId: project.id })).rules.map((r) => r.id)).toEqual([savedRule.id]);

    // An incomplete rule is refused before anyone is asked.
    const invalid = await tool(session, 'profile_rules_save', { level: 'workspace', rule: { name: 'Nothing to do', when: 'always' } });
    expect(invalid.body.error.code).toBe('PROFILE_RULE_INVALID');
    expect(runtime.harness.approvals.pending()).toEqual([]);

    const removed = tool(session, 'profile_rules_remove', { level: 'project', id: savedRule.id });
    await client.request('approvals.respond', { approvalId: (await asked('profile_rules_remove')).approvalId, decision: 'allow' });
    expect((await removed).body.removed).toMatchObject({ id: savedRule.id, name: 'Outro' });
    expect((await client.request('profile.getProject', { projectId: project.id })).rules).toEqual([]);

    // A session outside a project has no project level.
    const { session: loose } = await agent(null);
    const looseShown = (await tool(loose, 'profile_show', {})).body;
    expect(looseShown.preferences.project).toBeNull();
    expect(looseShown.project).toBeNull();
    const noProject = await tool(loose, 'profile_rules_save', { level: 'project', rule: { name: 'x', when: 'y', instruction: 'z' } });
    expect(noProject.body.error.code).toBe('PROFILE_NO_PROJECT');

    // External services read the general level only, and have none of the writes.
    const { url, token } = await openMcp();
    const viaService = await mcpCall(url, token, 'profile_show', {});
    expect(viaService.isError).toBe(false);
    expect(viaService.body.preferences).toEqual({ general: '- Hooks under three seconds\n- Music low\n- Captions always', interviewSection: '', project: null });
    expect((await mcpCall(url, token, 'profile_answer', { answers: { who: 'x' } })).isError).toBe(true);
    expect((await client.request('profile.get', {})).interview.answers).toEqual({ who: 'Coding tutorials' });

    // The terminal: the project of the current directory, and writes without CucCut approvals.
    const viaCli = await localOk('profile_show', {}, project.path);
    expect(viaCli.project).toEqual({ projectId: project.id, name: '登记' });
    expect(viaCli.preferences.project).toBe('- Vertical 9:16');
    expect((await localOk('profile_answer', { answers: { record: 'Screen and webcam' } })).answers).toEqual({ who: 'Coding tutorials', record: 'Screen and webcam' });
    const cliNoProject = await local('profile_preferences_set', { level: 'project', text: 'x', mode: 'replace' });
    expect(cliNoProject.ok).toBe(false);
    if (!cliNoProject.ok) expect(cliNoProject.error.code).toBe('PROFILE_NO_PROJECT');
  });

  it('models_list：经对外服务列出模型包，不带本机路径；models_test 不在对外服务里', async () => {
    const { url, token } = await openMcp();
    const listed = await mcpCall(url, token, 'models_list', {});
    expect(listed.isError).toBe(false);
    expect(Array.isArray(listed.body.bundles)).toBe(true);
    expect(JSON.stringify(listed.body)).not.toContain(home.root);
    expect((await mcpCall(url, token, 'models_test', { bundleId: 'any' })).isError).toBe(true);

    const viaCli = await localOk('models_list', {});
    expect(viaCli.bundles).toEqual(listed.body.bundles);
  });
});
