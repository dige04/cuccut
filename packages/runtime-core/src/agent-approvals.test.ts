import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import {
  AGENT_MODES,
  RpcError,
  newId,
  type AgentMode,
  type ApprovalRequest,
  type ApprovalVerdict,
  type DriverModel,
  type Id,
  type Project,
  type TimelineItem,
} from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from './runtime.ts';
import { ToolDriver, until, type ToolSession } from './agent-tools/testing/fake-agent.ts';

/**
 * End to end (architecture design §3.12, product design §3.2.4): real Runtime, gateway, MCP endpoint and client, with the Driver replaced by a fake. Covers approvals sent by the Driver (access mode × command, file changes, tools), “Always allow” rules, image attachment upload and sending, model and effort validation, and pass-through of the failure reason (errorCode). CucCut's own tools are approved by mode, and settling on stop and interrupt is covered in agent-tools/agent-tools.test.ts. No engine is needed.
 */

type Approval = Extract<TimelineItem, { kind: 'approval' }>;

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001', 'hex');

const MODELS: DriverModel[] = [
  {
    id: 'model-a',
    label: 'A',
    description: null,
    tier: null,
    isDefault: true,
    efforts: [
      { id: 'low', label: '低' },
      { id: 'high', label: '高' },
    ],
    defaultEffort: 'low',
  },
  { id: 'model-b', label: 'B', description: null, tier: null, isDefault: false, efforts: [], defaultEffort: null },
];

describe('审批、附件与模型校验（假 Agent）', () => {
  let dir: string | null = null;
  let runtime: RunningRuntime | null = null;
  let client: CucCutClient | null = null;
  let driver: ToolDriver;
  let project: Project;

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    client = null;
    runtime = null;
    dir = null;
  });

  async function start(options: ConstructorParameters<typeof ToolDriver>[0] = {}) {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-approvals-'));
    driver = new ToolDriver(options);
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '审批测试' }));
  }

  function rpc() {
    return client!;
  }

  async function rejection(promise: Promise<unknown>): Promise<RpcError> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RpcError);
    return error as RpcError;
  }

  async function create(accessMode: AgentMode): Promise<Id> {
    const { conversation } = await rpc().request('conversations.create', { projectId: project.id, accessMode });
    return conversation.id;
  }

  /** One native session per session: created on the first send, reused afterward. */
  const sessionOf = new Map<Id, ToolSession>();

  /** Sends a message and waits for the fake agent's turn to start. */
  async function send(conversationId: Id, extra: { attachments?: Id[] } = {}) {
    const known = new Set(driver.sessions);
    const { taskId } = await rpc().request('conversations.send', { conversationId, text: 'go', commandId: newId('cmd'), ...extra });
    const session = await until(() => {
      const existing = sessionOf.get(conversationId);
      if (existing) return existing.turnId ? existing : null;
      return driver.sessions.find((s) => !known.has(s) && s.turnId);
    });
    sessionOf.set(conversationId, session);
    return { taskId, session };
  }

  async function begin(accessMode: AgentMode) {
    const conversationId = await create(accessMode);
    return { conversationId, ...(await send(conversationId)) };
  }

  async function finish(conversationId: Id, session: ToolSession) {
    session.finish();
    await until(() => runtime!.harness.agentRun(conversationId).taskId === null);
  }

  async function items(conversationId: Id) {
    return (await rpc().request('conversations.get', { conversationId })).items;
  }

  async function approvals(conversationId: Id): Promise<Approval[]> {
    return (await items(conversationId)).filter((i): i is Approval => i.kind === 'approval');
  }

  async function card(conversationId: Id, approvalId: string): Promise<Approval> {
    return until(async () => (await approvals(conversationId)).find((a) => a.approvalId === approvalId));
  }

  function respond(conversationId: Id, approvalId: string, decision: 'accept' | 'decline' | 'accept-for-session' | 'accept-always') {
    return rpc().request('agents.respondToApproval', { conversationId, approvalId, decision });
  }

  // ---- Approvals: sent by the Driver ----

  it('访问模式 × Driver 送上来的命令、文件修改与工具：按决策表自动允许、拒绝或询问，自动的留一张已决定的卡并回给原生侧', async () => {
    await start();
    const requests = (cwd: string): Record<string, ApprovalRequest> => ({
      command: { kind: 'command', command: 'npm test', cwd: null, reason: null, rule: 'npm test' },
      inside: { kind: 'file-change', reason: null, files: ['src/a.ts', path.join(cwd, 'b.ts')], rule: null },
      outside: { kind: 'file-change', reason: null, files: ['../elsewhere/c.ts'], rule: null },
      tool: { kind: 'tool', tool: 'WebFetch', server: null, reason: '抓取网页', files: [], rule: 'WebFetch' },
    });
    // Risk: commands and the Agent's own tools are `command`; edits inside the working directory are `edit`; edits outside it are `high` (§3.12 decision table).
    const expected: Record<AgentMode, Record<string, ApprovalVerdict>> = {
      plan: { command: 'ask', inside: 'deny', outside: 'deny', tool: 'ask' },
      ask: { command: 'ask', inside: 'ask', outside: 'ask', tool: 'ask' },
      autoAcceptEdits: { command: 'ask', inside: 'allow', outside: 'ask', tool: 'ask' },
      auto: { command: 'allow', inside: 'allow', outside: 'ask', tool: 'allow' },
      fullAccess: { command: 'allow', inside: 'allow', outside: 'allow', tool: 'allow' },
    };

    for (const mode of AGENT_MODES) {
      const { conversationId, session } = await begin(mode);
      const cwd = runtime!.harness.agentRun(conversationId).conversation.cwd;
      for (const [label, request] of Object.entries(requests(cwd))) {
        const approvalId = session.requestApproval(request);
        const item = await card(conversationId, approvalId);
        const responded = session.responses.find((r) => r.approvalId === approvalId);
        const want = expected[mode][label]!;
        if (want === 'ask') {
          expect(item.status, `${mode} ${label}`).toBe('pending');
          expect(responded, `${mode} ${label}`).toBeUndefined();
        } else {
          const status = want === 'allow' ? 'accepted' : 'declined';
          expect(item, `${mode} ${label}`).toMatchObject({ status, decidedBy: 'auto', mode });
          expect(responded, `${mode} ${label}`).toEqual({ approvalId, decision: want === 'allow' ? 'accept' : 'decline' });
        }
      }
      const pending = (await approvals(conversationId)).filter((a) => a.status === 'pending');
      expect((await rpc().request('conversations.get', { conversationId })).conversation.activity).toBe(
        pending.length ? 'awaiting-approval' : 'running',
      );
      expect(runtime!.harness.approvals.pending().filter((a) => a.subject.kind === 'conversation' && a.subject.conversationId === conversationId)).toHaveLength(
        pending.length,
      );
      await finish(conversationId, session);
    }
  });

  it('规则：「总是允许」存进偏好，原生侧只按会话级放行；之后所有会话在「询问」时按规则答应，不放开模式拒绝的；移除后重新问', async () => {
    await start();
    const command: ApprovalRequest = { kind: 'command', command: 'git status', cwd: null, reason: null, rule: 'git status' };

    // “Allow for this session” is handled by the native side, which no longer asks; no rule is stored.
    const first = await begin('ask');
    const asked = first.session.requestApproval(command);
    expect((await card(first.conversationId, asked)).status).toBe('pending');
    expect((await respond(first.conversationId, asked, 'accept-for-session')).status).toBe('accepted');
    expect(first.session.responses).toContainEqual({ approvalId: asked, decision: 'accept-for-session' });
    expect((await rpc().request('agents.list', {})).preferences.rules).toEqual([]);

    // “Always allow”: CucCut stores the rule, and the native side lets the session through.
    const second = await begin('ask');
    const other = second.session.requestApproval(command);
    await respond(second.conversationId, other, 'accept-always');
    expect(second.session.responses).toContainEqual({ approvalId: other, decision: 'accept-for-session' });
    expect(await card(second.conversationId, other)).toMatchObject({ status: 'accepted', decidedBy: 'user', decision: 'accept-always' });
    expect((await rpc().request('agents.list', {})).preferences.rules).toContain('git status');

    const third = await begin('ask');
    const ruled = third.session.requestApproval(command);
    expect(await card(third.conversationId, ruled)).toMatchObject({ status: 'accepted', decidedBy: 'rule' });
    expect(third.session.responses).toContainEqual({ approvalId: ruled, decision: 'accept' });

    // A rule only turns “ask” into allow. A file change that the plan tier already rejected is still rejected.
    const planned = await begin('plan');
    const edit = planned.session.requestApproval({ kind: 'file-change', reason: null, files: ['a.ts'], rule: 'git status' });
    expect(await card(planned.conversationId, edit)).toMatchObject({ status: 'declined', decidedBy: 'auto' });

    await rpc().request('agents.removeRule', { rule: 'git status' });
    const removed = third.session.requestApproval(command);
    expect((await card(third.conversationId, removed)).status).toBe('pending');
  });

  // ---- Attachments ----

  async function upload(bytes: Buffer = PNG, fileName = 'shot.png') {
    const { attachment, uploadUrl } = await rpc().request('attachments.prepare', { fileName, mimeType: 'image/png', size: bytes.length });
    expect(uploadUrl.startsWith(runtime!.discovery.endpoint.replace(/^ws:/, 'http:'))).toBe(true);
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: new Uint8Array(bytes) });
    expect(response.status).toBe(204);
    return attachment;
  }

  it('普通附件以文件上下文交给不支持图片的 Driver，保留附件预览定位',async()=>{
    await start({capabilities:{images:false}});const conversationId=await create('ask');
    const bytes=Buffer.from('name,count\ncover,3');
    const {attachment,uploadUrl}=await rpc().request('attachments.prepare',{fileName:'items.csv',mimeType:'text/csv',size:bytes.length});
    expect((await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':'text/csv'},body:new Uint8Array(bytes)})).status).toBe(204);
    const {session}=await send(conversationId,{attachments:[attachment.id]});
    expect(session.images).toHaveLength(0);expect(session.inputs[0]).toContain('file.csv');
    expect((await items(conversationId)).find(item=>item.kind==='user-message')).toMatchObject({attachments:[{kind:'file',fileName:'items.csv'}]});
  });

  it('附件：prepare → PUT → send，Driver 收到本地图片，时间线上的消息带着附件；steer 同样', async () => {
    await start({ capabilities: { images: true, steer: true } });
    const conversationId = await create('ask');
    const first = await upload();
    const { session } = await send(conversationId, { attachments: [first.id] });
    expect(session.images).toHaveLength(1);
    const [image] = session.images[0]!;
    expect(image!.mimeType).toBe('image/png');
    expect(path.dirname(image!.path)).toBe(path.join(dir!, 'attachments', first.id));
    expect(await fs.readFile(image!.path)).toEqual(PNG);
    const message = (await items(conversationId)).find((i) => i.kind === 'user-message');
    expect(message).toMatchObject({ attachments: [{ id: first.id, kind: 'image', fileName: 'shot.png', mimeType: 'image/png', size: PNG.length }] });

    const second = await upload(PNG, 'second.png');
    const steered = await rpc().request('conversations.steer', { conversationId, text: '再看这张', commandId: newId('cmd'), attachments: [second.id] });
    expect(steered.status).toBe('steered');
    expect(session.images[1]!.map((i) => path.basename(path.dirname(i.path)))).toEqual([second.id]);
    const messages = (await items(conversationId)).filter((i) => i.kind === 'user-message');
    expect(messages.at(-1)).toMatchObject({ text: '再看这张', attachments: [{ id: second.id }] });
    session.finish();
    await until(() => runtime!.harness.agentRun(conversationId).taskId === null);

    // Deleting the session deletes its images too.
    await rpc().request('conversations.delete', { conversationId });
    await until(async () => !(await fs.stat(path.join(dir!, 'attachments', first.id)).catch(() => null)));
    expect(await fs.readdir(path.join(dir!, 'attachments'))).toEqual([]);
  });

  it('附件：media.resolve 按会话与附件 ID 给出只读句柄；别的会话、没发出去的、不认识的都是 not-found', async () => {
    await start({ capabilities: { images: true } });
    const conversationId = await create('ask');
    const sent = await upload(PNG, '截图 1.png');
    const { session } = await send(conversationId, { attachments: [sent.id] });

    const handle = await rpc().request('media.resolve', { conversationId, attachmentId: sent.id });
    // The display uses the file name the user gave, not image.png on disk; the URL carries no local path.
    expect(handle).toMatchObject({ mimeType: 'image/png', size: PNG.length, fileName: '截图 1.png' });
    expect(handle.url).not.toContain(dir!);
    const response = await fetch(handle.url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG);

    // An attachment does not belong to this session: another session cannot fetch it, even with the same ID.
    const other = await create('ask');
    expect((await rejection(rpc().request('media.resolve', { conversationId: other, attachmentId: sent.id }))).code).toBe('not-found');
    // Uploaded but not yet sent: it is in no message, so it cannot be fetched.
    const unsent = await upload(PNG, 'unsent.png');
    expect((await rejection(rpc().request('media.resolve', { conversationId, attachmentId: unsent.id }))).code).toBe('not-found');
    // Unknown ID, nonexistent session.
    expect((await rejection(rpc().request('media.resolve', { conversationId, attachmentId: 'att_nope' }))).code).toBe('not-found');
    expect((await rejection(rpc().request('media.resolve', { conversationId: 'conv_nope', attachmentId: sent.id }))).code).toBe('not-found');
    // Attachment addressing is not mixed with file addressing: a request that also carries a path is rejected by inbound validation.
    const mixed = await rejection(rpc().request('media.resolve', { conversationId, attachmentId: sent.id, path: 'x' } as never));
    expect(mixed.code).toBe('invalid-request');
    await finish(conversationId, session);
  });

  it('附件：太大、格式不对、没上传完、不认识、Agent 不支持图片时如实拒绝，不悄悄丢图', async () => {
    await start();
    const tooBig = await rejection(rpc().request('attachments.prepare', { fileName: 'a.png', mimeType: 'image/png', size: 64 * 1024 * 1024 }));
    expect(tooBig.code).toBe('invalid-request');
    const svg = await rejection(rpc().request('attachments.prepare', { fileName: 'a.svg', mimeType: 'image/svg+xml', size: 10 }));
    expect(svg.code).toBe('invalid-request');

    const conversationId = await create('ask');
    const { attachment } = await rpc().request('attachments.prepare', { fileName: 'a.png', mimeType: 'image/png', size: PNG.length });
    const notUploaded = await rejection(rpc().request('conversations.send', { conversationId, text: 'go', commandId: newId('cmd'), attachments: [attachment.id] }));
    // This Agent does not support images. That is reported before “not finished uploading”.
    expect(notUploaded.code).toBe('invalid-request');
    expect(notUploaded.message).toContain('不支持图片');
    const uploaded = await upload();
    expect((await rejection(rpc().request('conversations.send', { conversationId, text: 'go', commandId: newId('cmd'), attachments: [uploaded.id] }))).message).toContain('不支持图片');
    // A rejected send creates no task.
    expect(runtime!.harness.agentRun(conversationId).taskId).toBeNull();
    expect((await items(conversationId)).filter((i) => i.kind === 'user-message')).toHaveLength(0);
  });

  it('附件：支持图片的 Agent 上，没上传完与不认识的附件分别报错', async () => {
    await start({ capabilities: { images: true } });
    const conversationId = await create('ask');
    const { attachment } = await rpc().request('attachments.prepare', { fileName: 'a.png', mimeType: 'image/png', size: PNG.length });
    const pending = await rejection(rpc().request('conversations.send', { conversationId, text: 'go', commandId: newId('cmd'), attachments: [attachment.id] }));
    expect(pending.code).toBe('invalid-request');
    expect(pending.message).toContain('还没有上传完');
    const unknown = await rejection(
      rpc().request('conversations.send', { conversationId, text: 'go', commandId: newId('cmd'), attachments: ['att_00000000000000000000000000000000'] }),
    );
    expect(unknown.code).toBe('not-found');
    const twice = await upload();
    const duplicate = await rejection(rpc().request('conversations.send', { conversationId, text: 'go', commandId: newId('cmd'), attachments: [twice.id, twice.id] }));
    expect(duplicate.code).toBe('invalid-request');
    expect(runtime!.harness.agentRun(conversationId).taskId).toBeNull();
  });

  // ---- Model and effort ----

  it('模型与强度按模型表校验：新建、修改与默认值；只换模型时不适用的强度回到默认', async () => {
    await start({ models: MODELS });
    const base = { projectId: project.id };
    expect((await rejection(rpc().request('conversations.create', { ...base, model: 'nope' }))).code).toBe('invalid-request');
    expect((await rejection(rpc().request('conversations.create', { ...base, model: 'model-a', effort: 'max' }))).code).toBe('invalid-request');
    expect((await rejection(rpc().request('conversations.create', { ...base, model: 'model-b', effort: 'low' }))).message).toContain('不分推理强度');
    // No model given: effort is looked up against the model a new session uses (the recommended model, here the default the Agent declares).
    expect((await rpc().request('conversations.create', { ...base, effort: 'high' })).conversation).toMatchObject({ effort: 'high' });
    expect((await rejection(rpc().request('conversations.create', { ...base, effort: 'max' }))).code).toBe('invalid-request');

    const { conversation } = await rpc().request('conversations.create', { ...base, model: 'model-a', effort: 'high' });
    expect(conversation).toMatchObject({ model: 'model-a', effort: 'high' });
    const switched = await rpc().request('conversations.update', { conversationId: conversation.id, model: 'model-b' });
    expect(switched.conversation).toMatchObject({ model: 'model-b', effort: null });
    expect((await rejection(rpc().request('conversations.update', { conversationId: conversation.id, effort: 'high' }))).code).toBe('invalid-request');
    expect((await rejection(rpc().request('conversations.update', { conversationId: conversation.id, model: 'nope' }))).code).toBe('invalid-request');

    // Default model and effort.
    expect((await rejection(rpc().request('agents.configure', { driverId: 'codex', defaultModel: 'nope' }))).code).toBe('invalid-request');
    expect((await rejection(rpc().request('agents.configure', { driverId: 'codex', defaultModel: 'model-a', defaultEffort: 'max' }))).code).toBe('invalid-request');
    await rpc().request('agents.configure', { driverId: 'codex', defaultModel: 'model-a', defaultEffort: 'high' });
    expect((await rpc().request('conversations.create', { ...base, driverId: 'codex' })).conversation).toMatchObject({ model: 'model-a', effort: 'high' });
    // Changing only the default model: the old effort does not apply, so it falls back to the model's default.
    const view = await rpc().request('agents.configure', { driverId: 'codex', defaultModel: 'model-b' });
    expect(view.preferences.drivers.codex).toMatchObject({ defaultModel: 'model-b', defaultEffort: null });
  });

  it('模型表为空（Agent 没报模型）时不校验', async () => {
    await start();
    const { conversation } = await rpc().request('conversations.create', { projectId: project.id, model: 'anything', effort: 'whatever' });
    expect(conversation).toMatchObject({ model: 'anything', effort: 'whatever' });
  });

  // ---- Failure reasons ----

  it('失败原因（errorCode）透传到任务卡片：回合结束带的、之前的 session.error 带的、进程退出', async () => {
    await start();
    const taskCard = async (conversationId: Id, taskId: Id) =>
      until(async () => (await items(conversationId)).find((i) => i.kind === 'task' && i.id === taskId && i.status !== 'running'));

    const a = await begin('ask');
    a.session.finish('failed', 'AGENT_MODEL_UNAVAILABLE');
    expect(await taskCard(a.conversationId, a.taskId)).toMatchObject({ status: 'failed', errorCode: 'AGENT_MODEL_UNAVAILABLE' });

    const b = await begin('ask');
    b.session.emit({ type: 'session.error', turnId: b.session.turnId, message: '登录过期', willRetry: false, code: 'AGENT_AUTH_REQUIRED' });
    b.session.finish('failed');
    expect(await taskCard(b.conversationId, b.taskId)).toMatchObject({ status: 'failed', errorCode: 'AGENT_AUTH_REQUIRED' });

    const c = await begin('ask');
    c.session.emit({ type: 'session.exited', error: 'boom' });
    expect(await taskCard(c.conversationId, c.taskId)).toMatchObject({ status: 'failed', errorCode: 'AGENT_EXITED' });

    // A successful turn carries no failure reason, even if a retryable error occurred midway.
    const d = await begin('ask');
    d.session.emit({ type: 'session.error', turnId: d.session.turnId, message: '限流，稍后重试', willRetry: true, code: 'AGENT_RATE_LIMITED' });
    d.session.finish('completed');
    const done = await taskCard(d.conversationId, d.taskId);
    expect(done).toMatchObject({ status: 'completed' });
    expect(done.kind === 'task' && (done.errorCode ?? null)).toBeNull();
  });
});
