import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId, type Id } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, tool, until, type ToolSession } from '../agent-tools/testing/fake-agent.ts';
import { writeSkill } from './testing/skill-fixtures.ts';

/**
 * Agent skill 端到端（架构设计 §3.8、§12.9）：经真实的 RPC 网关管理 skill，假智能体收到会话开始的索引、点选 skill 的正文，
 * 并经真实的 MCP 端点调用 `skills_read`。内置目录是测试里建的临时目录。
 */

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

describe('Agent skill 端到端', () => {
  let dir: string;
  let builtin: string;
  let home: RuntimeHome;
  let driver: ToolDriver;
  let runtime: RunningRuntime;
  let client: CucCutClient;

  async function boot(): Promise<void> {
    driver = new ToolDriver();
    runtime = await startRuntime({ home, drivers: () => [driver], watchSpace: false, skillsDir: builtin });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
  }

  async function send(text: string, skill?: string, skills?: string[]): Promise<{ conversationId: Id; session: ToolSession }> {
    const { conversation } = await client.request('conversations.create', {});
    const before = driver.sessions.length;
    await client.request('conversations.send', {
      conversationId: conversation.id,
      text,
      commandId: newId('cmd'),
      ...(skill ? { skill: { id: skill } } : {}),
      ...(skills ? { skills: skills.map((id) => ({ id })) } : {}),
    });
    // 每个对话一个原生会话：新出现的那个就是这条消息的。
    const session = await until(() => driver.sessions[before]);
    await until(() => session.inputs.length > 0);
    return { conversationId: conversation.id, session };
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-skill-runtime-'));
    builtin = path.join(dir, 'builtin-skills');
    await fs.mkdir(builtin);
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('会话指导是说明书按工具桥面渲染的正文；没有 craft 时索引里只有说明书页', async () => {
    await boot();
    const { session } = await send('你好');
    const instructions = session.options.developerInstructions!;
    // 真实的 skills/cuccut/：SKILL.md 正文在前，skill 索引附在后面。
    expect(instructions.startsWith('# CucCut\n')).toBe(true);
    expect(instructions).toContain('### The three baselines');
    expect(instructions).toContain('`<cuccut-editor-context>`');
    expect(instructions).toContain('Wait with `jobs_wait`: at most 50 seconds per call');
    expect(instructions).not.toMatch(/(?<![.\w])cuccut [a-z]|--yes|\b[Ee]xit codes?\b|\{\{/);
    const index = instructions.slice(instructions.indexOf('<cuccut-skills>'));
    expect(index).toMatch(/the first \d+ are the manual pages referenced by the guidance above/);
    for (const id of ['cuccut-catalog-media', 'cuccut-catalog-subtitles', 'cuccut-workflows', 'cuccut-conventions']) {
      expect(index).toContain(`- ${id}: `);
    }
    expect(session.inputs[0]).toBe('你好');
    // 说明书页不进设置里的列表，不能开关。
    expect((await client.request('skills.list', {})).skills).toEqual([]);
    expect(await rejection(client.request('skills.setEnabled', { id: 'cuccut-workflows', enabled: false }))).toMatchObject({
      code: 'not-found',
      details: { code: 'SKILL_NOT_FOUND' },
    });
  });

  it('skills_read 能读说明书页；同 id 的用户 skill 让位', async () => {
    await writeSkill(home.skillsDir, 'cuccut-conventions');
    await boot();
    const { session } = await send('开始');
    const page = await tool(session, 'skills_read', { id: 'cuccut-conventions' });
    expect(page.isError).toBe(false);
    expect(page.body).toMatchObject({
      id: 'cuccut-conventions',
      origin: 'builtin',
      userInstalled: false,
      path: 'SKILL.md',
      files: ['SKILL.md'],
    });
    expect(page.body.content).toContain('# Conventions');
    expect(page.body.content).toContain('`jobs_wait`');
    expect(page.body.content).not.toContain('{{');
    const other = await tool(session, 'skills_read', { id: 'cuccut-conventions', path: 'references/x.md' });
    expect(JSON.stringify(other.body)).toContain('SKILL_FILE_NOT_FOUND');
    const list = await client.request('skills.list', {});
    expect(list.diagnostics).toEqual([expect.objectContaining({ code: 'builtin-conflict', scope: 'user', dir: 'cuccut-conventions' })]);
    // 终端与 MCP 不读工具桥面的页：它们有装好的 CucCut skill。
    const outside = await client.request('catalog.call', { name: 'skills_read', args: { id: 'cuccut-conventions' }, cwd: dir });
    expect(outside).toMatchObject({ ok: false, error: { code: 'SKILL_NOT_FOUND' } });
  });

  it('开着的 skill 出现在会话开始的索引里，关着的不出现；开关经 RPC 持久', async () => {
    await writeSkill(builtin, 'caption-layout', { description: '字幕排版规则' });
    await writeSkill(builtin, 'b-roll');
    await boot();
    const off = await client.request('skills.setEnabled', { id: 'b-roll', enabled: false });
    expect(off.skill).toMatchObject({ id: 'b-roll', enabled: false });
    expect(off.skills.map((s) => [s.id, s.enabled])).toEqual([
      ['b-roll', false],
      ['caption-layout', true],
    ]);
    const { session } = await send('排一下字幕');
    expect(session.options.developerInstructions).toContain('<cuccut-skills>');
    expect(session.options.developerInstructions).toContain('- caption-layout: caption-layout — 字幕排版规则');
    expect(session.options.developerInstructions).not.toContain('b-roll');
    expect(JSON.parse(await fs.readFile(home.skillPrefsFile, 'utf8'))).toMatchObject({ enabled: { 'b-roll': false } });
  });

  it('点选 skill 发送：智能体拿到正文，消息带 skill 标记；关着的也能点选；不存在时拒绝', async () => {
    await writeSkill(builtin, 'caption-layout', { extra: '# 字幕\n\n每行不超过 16 个字。', files: { 'references/fonts.md': '字体表' } });
    await boot();
    await client.request('skills.setEnabled', { id: 'caption-layout', enabled: false });
    const { conversationId, session } = await send('排一下字幕', 'caption-layout');
    const turn = session.inputs[0]!;
    expect(turn.startsWith('排一下字幕\n\n<cuccut-skill id="caption-layout">')).toBe(true);
    expect(turn).toContain('每行不超过 16 个字。');
    expect(turn).toContain('references/fonts.md');
    const message = runtime.harness.getConversation(conversationId).items.find((i) => i.kind === 'user-message');
    expect(message).toMatchObject({ text: '排一下字幕', skills: [{ id: 'caption-layout', name: 'caption-layout', origin: 'builtin' }] });

    const { conversation } = await client.request('conversations.create', {});
    const missing = await rejection(
      client.request('conversations.send', { conversationId: conversation.id, text: 'x', commandId: newId('cmd'), skill: { id: 'nope' } }),
    );
    expect(missing).toMatchObject({ code: 'not-found', details: { code: 'SKILL_NOT_FOUND' } });
  });

  it('一条消息点选几个 skill：按挂上的顺序各一段，旧写法的 skill 排在最前，重复的只算一次', async () => {
    await writeSkill(builtin, 'caption-layout');
    await writeSkill(builtin, 'b-roll');
    await boot();
    const { conversationId, session } = await send('剪一下', 'b-roll', ['caption-layout', 'b-roll']);
    const turn = session.inputs[0]!;
    expect(turn.indexOf('<cuccut-skill id="b-roll">')).toBeGreaterThan(0);
    expect(turn.indexOf('<cuccut-skill id="caption-layout">')).toBeGreaterThan(turn.indexOf('<cuccut-skill id="b-roll">'));
    expect(turn.match(/<cuccut-skill id=/g)).toHaveLength(2);
    const message = runtime.harness.getConversation(conversationId).items.find((i) => i.kind === 'user-message');
    expect(message).toMatchObject({ skills: [{ id: 'b-roll' }, { id: 'caption-layout' }] });

    const { conversation } = await client.request('conversations.create', {});
    const missing = await rejection(
      client.request('conversations.send', {
        conversationId: conversation.id,
        text: 'x',
        commandId: newId('cmd'),
        skills: [{ id: 'caption-layout' }, { id: 'nope' }],
      }),
    );
    expect(missing).toMatchObject({ code: 'not-found', details: { code: 'SKILL_NOT_FOUND' } });
  });

  it('skills_read：取正文与同目录文件；路径穿越与不存在的 skill 返回工具错误', async () => {
    await writeSkill(builtin, 'caption-layout', { files: { 'references/fonts.md': '字体表' } });
    await boot();
    const { session } = await send('开始');
    const main = await tool(session, 'skills_read', { id: 'caption-layout' });
    expect(main.isError).toBe(false);
    expect(main.body).toMatchObject({ id: 'caption-layout', origin: 'builtin', userInstalled: false, path: 'SKILL.md' });
    expect(main.body.content).toContain('name: caption-layout');
    expect(main.body.files).toEqual(['SKILL.md', 'references/fonts.md']);
    expect((await tool(session, 'skills_read', { id: 'caption-layout', path: 'references/fonts.md' })).body).toMatchObject({
      content: '字体表',
    });
    const escape = await tool(session, 'skills_read', { id: 'caption-layout', path: '../../store/skill-prefs.json' });
    expect(escape.isError).toBe(true);
    expect(JSON.stringify(escape.body)).toContain('SKILL_FILE_NOT_FOUND');
    const unknown = await tool(session, 'skills_read', { id: 'nope' });
    expect(unknown.isError).toBe(true);
    expect(JSON.stringify(unknown.body)).toContain('SKILL_NOT_FOUND');
  });

  it('经 RPC 添加、查看、读文件、移除；readFile 拒绝路径穿越', async () => {
    await boot();
    const source = await writeSkill(path.join(dir, 'src'), 'My Notes', { files: { 'notes.md': '笔记' } });
    const added = await client.request('skills.add', { path: source, commandId: newId('cmd') });
    expect(added.skill).toMatchObject({ id: 'my-notes', origin: 'personal', enabled: true, path: path.join(home.skillsDir, 'my-notes') });
    expect((await client.request('skills.get', { id: 'my-notes' })).files.map((f) => f.path)).toEqual(['SKILL.md', 'notes.md']);
    expect(await client.request('skills.readFile', { id: 'my-notes', path: 'notes.md' })).toMatchObject({ content: '笔记' });
    expect((await rejection(client.request('skills.readFile', { id: 'my-notes', path: '../x' }))).code).toBe('invalid-request');
    expect((await rejection(client.request('skills.add', { path: source }))).details).toMatchObject({ code: 'SKILL_EXISTS' });

    // 用户安装的 skill 在点选段与索引里带信任说明。
    const { session } = await send('整理笔记', 'my-notes');
    expect(session.options.developerInstructions).toContain(' (user-installed)');
    expect(session.inputs[0]).toContain('user-installed skill');

    const removed = await client.request('skills.remove', { id: 'my-notes' });
    expect(removed.removed).toEqual({ id: 'my-notes', path: path.join(home.skillsDir, 'my-notes') });
    expect(removed.skills).toEqual([]);
  });
});

describe('会话指导的说明书', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-agent-guidance-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('找不到或渲染不了时 Runtime 启动失败，不带着空指导开会话', async () => {
    const home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
    const start = (agentSkillsDir: string | null) =>
      startRuntime({ home, drivers: () => [new ToolDriver()], watchSpace: false, skillsDir: null, agentSkillsDir });
    await expect(start(null)).rejects.toThrow(/Agent guide directory skills\/ not found/);
    await expect(start(path.join(dir, 'missing'))).rejects.toThrow(/Agent guide directory does not exist/);
    const broken = path.join(dir, 'skills', 'cuccut');
    await fs.mkdir(broken, { recursive: true });
    await fs.writeFile(path.join(broken, 'SKILL.md'), '# CucCut\n\n<!-- surface: agent -->\n没有闭合\n');
    await expect(start(path.join(dir, 'skills'))).rejects.toThrow(/Failed to render session guidance.*SKILL\.md:3：surface 标记没有闭合/);
    await fs.writeFile(path.join(broken, 'SKILL.md'), '# CucCut\n\n先 {{tool:no_such_tool}}。\n');
    await expect(start(path.join(dir, 'skills'))).rejects.toThrow(/工具桥面的目录里没有这个工具/);
  });
});
