import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { fakeOpenAiHandler, startFakeProviderServer, type FakeProviderServer } from '@cuccut/providers/testing';
import { RpcError, newId, type AgentMode, type Grant, type Id } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, tool, until, type ToolSession } from '../agent-tools/testing/fake-agent.ts';

/**
 * End-to-end test of data outbound grants and budgets (architecture design §12.5, §7.8, §6.8): an agent in the session calls model tools through the real MCP endpoint, and the UI connection submits directly. Both go through the same JobManager admission. Online providers are a fake provider on a loopback address. Keys are strings made up in the test.
 * No video engine is needed. Whether the task completes after submission is unrelated to the grant (without ffprobe, voice tasks fail, but settlement still follows the rules).
 */

const OPENAI_KEY = 'sk-test-ONLY-FOR-TESTS-grants-0123456789';

interface Side {
  dir: string;
  home: RuntimeHome;
  runtime: RunningRuntime;
  driver: ToolDriver;
  client: CucCutClient;
  conversationId: Id;
}

async function boot(dir: string, openai: FakeProviderServer): Promise<Side> {
  const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  const driver = new ToolDriver();
  const runtime = await startRuntime({
    home,
    drivers: () => [driver],
    watchSpace: false,
    engineHost: null,
    modelWorker: null,
    jobIdleMs: 60_000,
    initiator: { discoverer: null },
    nodes: { host: '127.0.0.1', advertiser: null },
    online: { baseUrls: { openai: `${openai.origin}/v1` }, http: { backoffMs: () => 10 } },
  });
  const { endpoint, token } = runtime.discovery;
  const client = new CucCutClient({
    resolve: async () => ({ endpoint, token }),
    client: { kind: 'desktop', name: 'test', version: '0' },
    reconnect: false,
  });
  await client.connect();
  const { project } = await client.request('projects.create', { name: '授权' });
  const {
    conversation: { id: conversationId },
  } = await client.request('conversations.create', { projectId: project.id });
  return { dir, home, runtime, driver, client, conversationId };
}

async function shutdown(side: Side | undefined): Promise<void> {
  if (!side) return;
  side.client.close();
  await side.runtime.close();
}

/** Sends a message (with the given access mode) and waits for the fake agent's turn to start. */
async function send(side: Side, accessMode: AgentMode): Promise<{ taskId: Id; session: ToolSession }> {
  const { taskId } = await side.client.request('conversations.send', {
    conversationId: side.conversationId,
    text: '做点事',
    commandId: newId('cmd'),
    accessMode,
  });
  const session = await until(() => side.driver.sessions[0]);
  await until(() => session.turnId === taskId || session.turnId);
  return { taskId, session };
}

async function grantsOf(side: Side, includeEnded = false): Promise<Grant[]> {
  return (await side.client.request('grants.list', { recipient: 'openai', ...(includeEnded ? { includeEnded } : {}) })).grants;
}

async function revokeDefault(side: Side): Promise<Grant> {
  const [byDefault] = await grantsOf(side);
  expect(byDefault).toMatchObject({ origin: 'provider-enable' });
  await side.client.request('grants.revoke', { grantId: byDefault!.grantId });
  return byDefault!;
}

function rejection(promise: Promise<unknown>): Promise<RpcError> {
  return promise.then(
    () => {
      throw new Error('应当被拒绝');
    },
    (error: unknown) => error as RpcError,
  );
}

describe('data egress grants and budget', () => {
  let side: Side | undefined;
  let openai: FakeProviderServer | undefined;
  let dir: string | undefined;

  async function start(): Promise<Side> {
    openai = await startFakeProviderServer(fakeOpenAiHandler());
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-grants-'));
    side = await boot(dir, openai);
    return side;
  }

  afterEach(async () => {
    await shutdown(side);
    await openai?.close();
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    side = openai = dir = undefined;
  });

  it('migration rules: enabling issues the default grant (risk command); after revoking, it is a high-risk approval with egress; one-time and continuous grants', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const [byDefault] = await grantsOf(s);
    expect(byDefault).toMatchObject({
      origin: 'provider-enable',
      recipient: 'openai',
      scope: { videoId: null },
      budgetMode: 'per-call-unknown-cost',
      budgetCap: null,
      maxCalls: null,
      once: false,
    });
    expect([...byDefault!.dataKinds].sort()).toEqual(['audio', 'document', 'transcript']);

    const { taskId, session } = await send(s, 'auto');
    const covered = await tool(session, 'speak', { text: 'hi', provider: 'openai' });
    expect(covered.body).toMatchObject({ approval: { mode: 'auto', risk: 'command', decidedBy: 'auto' } });
    expect(s.runtime.models.jobs.inspect(covered.body.jobId).grant).toMatchObject({ grantId: byDefault!.grantId, dataKinds: ['document'] });

    // After revocation: the same call needs a new grant, risk is high, and the approval lists the data to be handed over.
    await s.client.request('grants.revoke', { grantId: byDefault!.grantId });
    const first = tool(session, 'speak', { text: 'again', provider: 'openai' });
    const asked = await until(() => s.runtime.harness.approvals.pending()[0]);
    expect(asked).toMatchObject({
      risk: 'high',
      action: { name: 'speak' },
      grants: [{ recipient: 'openai', dataKinds: ['document'], capability: 'synthesizeSpeech', reason: 'revoked', cost: 'unknown' }],
    });
    expect((await s.client.request('jobs.list', {})).jobs).toHaveLength(1);
    // No choice given = this time only.
    await s.client.request('approvals.respond', { approvalId: asked.approvalId, decision: 'allow' });
    const once = (await first).body;
    expect(once.approval).toEqual({ mode: 'auto', risk: 'high', decidedBy: 'user' });
    const onceGrantId = s.runtime.models.jobs.inspect(once.jobId).grant!.grantId;
    expect((await grantsOf(s, true)).find((g) => g.grantId === onceGrantId)).toMatchObject({
      once: true,
      origin: 'approval',
      taskId,
      maxCalls: 1,
      usage: { calls: expect.any(Number) },
    });

    // A this-time-only grant does not cover the next call: ask again. This time, issue a persistent grant (all videos).
    const second = tool(session, 'speak', { text: 'third', provider: 'openai' });
    const askedAgain = await until(() => s.runtime.harness.approvals.pending()[0]);
    expect(askedAgain.approvalId).not.toBe(asked.approvalId);
    await s.client.request('approvals.respond', {
      approvalId: askedAgain.approvalId,
      decision: 'allow',
      grant: { persist: true, scope: 'all' },
    });
    expect((await second).isError).toBe(false);
    const persistent = (await grantsOf(s)).find((g) => g.origin === 'approval' && !g.once)!;
    expect(persistent).toMatchObject({ scope: { videoId: null }, taskId: null, maxCalls: null });

    // Once the persistent grant covers it, no longer ask.
    const after = await tool(session, 'speak', { text: 'fourth', provider: 'openai' });
    expect(after.body.approval).toEqual({ mode: 'auto', risk: 'command', decidedBy: 'auto' });
    expect(s.runtime.harness.approvals.pending()).toEqual([]);
    expect(s.runtime.models.jobs.inspect(after.body.jobId).grant!.grantId).toBe(persistent.grantId);

    // An approval that does not involve outbound transfer cannot carry a grant choice.
    await expect(
      s.client.request('approvals.respond', { approvalId: 'apv_none', decision: 'allow', grant: { persist: false } }),
    ).resolves.toEqual({ status: 'already-resolved' });
  });

  it('full access: egress without a grant covering it is automatically allowed once; budget limits still apply (BUDGET_EXCEEDED, not sent to approval)', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await revokeDefault(s);
    const { session } = await send(s, 'fullAccess');

    const auto = await tool(session, 'speak', { text: 'hi', provider: 'openai' });
    expect(auto.body.approval).toEqual({ mode: 'fullAccess', risk: 'high', decidedBy: 'auto' });
    const used = s.runtime.models.jobs.inspect(auto.body.jobId).grant!;
    expect((await grantsOf(s, true)).find((g) => g.grantId === used.grantId)).toMatchObject({ once: true });

    const { grant: capped } = await s.client.request('grants.create', {
      recipient: 'openai',
      dataKinds: ['document'],
      purpose: '配音，最多一次',
      budgetMode: 'per-call-unknown-cost',
      maxCalls: 1,
    });
    expect((await tool(session, 'speak', { text: 'one', provider: 'openai' })).isError).toBe(false);
    const jobs = (await s.client.request('jobs.list', {})).jobs.length;
    const over = await tool(session, 'speak', { text: 'two', provider: 'openai' });
    expect(over.isError).toBe(true);
    expect(over.body.error).toMatchObject({
      code: 'BUDGET_EXCEEDED',
      grantId: capped.grantId,
      measure: 'calls',
      remedy: { action: 'raise-budget', commands: [`cuccut grants update ${capped.grantId} --max-calls <更大的次数>`] },
      next: expect.stringContaining('Do not switch providers'),
    });
    expect(s.runtime.harness.approvals.pending()).toEqual([]);
    expect((await s.client.request('jobs.list', {})).jobs).toHaveLength(jobs);
  });

  it('grants_request: multiple egress items in one task are merged into one approval; grants within a task are capped by count, and later calls no longer ask', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await revokeDefault(s);
    const { taskId, session } = await send(s, 'auto');

    const requesting = tool(session, 'grants_request', {
      items: [
        { capability: 'synthesizeSpeech', provider: 'openai', calls: 2, purpose: '旁白配音' },
        { capability: 'transcribe', provider: 'openai', calls: 1, purpose: '转写采访' },
      ],
    });
    const asked = await until(() => s.runtime.harness.approvals.pending()[0]);
    expect(s.runtime.harness.approvals.pending()).toHaveLength(1);
    expect(asked).toMatchObject({
      risk: 'high',
      action: { name: 'grants_request' },
      grants: [
        { capability: 'synthesizeSpeech', dataKinds: ['document'], maxCalls: 2 },
        { capability: 'transcribe', dataKinds: ['audio'], maxCalls: 1 },
      ],
    });
    await s.client.request('approvals.respond', { approvalId: asked.approvalId, decision: 'allow' });
    const granted = (await requesting).body;
    expect(granted.items).toMatchObject([
      { status: 'granted', recipient: 'openai', dataKinds: ['document'], maxCalls: 2, taskId },
      { status: 'granted', recipient: 'openai', dataKinds: ['audio'], maxCalls: 1, taskId },
    ]);

    for (const text of ['一', '二']) {
      const call = await tool(session, 'speak', { text, provider: 'openai' });
      expect(call.body.approval).toEqual({ mode: 'auto', risk: 'command', decidedBy: 'auto' });
    }
    const over = await tool(session, 'speak', { text: '三', provider: 'openai' });
    expect(over.body.error).toMatchObject({ code: 'BUDGET_EXCEEDED', grantId: granted.items[0].grantId });
    expect(s.runtime.harness.approvals.pending()).toEqual([]);

    const usage = await s.client.request('grants.usage', { grantId: granted.items[0].grantId });
    expect(usage.jobs).toHaveLength(2);
    expect(usage.grant.usage.calls + usage.grant.usage.reservedCalls).toBe(2);

    // Items already covered by an existing grant are not requested again.
    const again = await tool(session, 'grants_request', {
      items: [{ capability: 'transcribe', provider: 'openai', calls: 1, purpose: '转写采访' }],
    });
    expect(again.body.items).toMatchObject([{ status: 'covered', grantId: granted.items[1].grantId }]);
  });

  it('concurrent submission: multiple tasks submitted at once, reservations are atomic and the count limit is never exceeded; excess is rejected with BUDGET_EXCEEDED and no task is created', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await revokeDefault(s);
    const { grant } = await s.client.request('grants.create', {
      recipient: 'openai',
      dataKinds: ['document'],
      purpose: '并发测试',
      budgetMode: 'per-call-unknown-cost',
      maxCalls: 3,
    });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => s.client.request('models.synthesizeSpeech', { text: `第 ${i} 段`, provider: 'openai' })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(3);
    expect(refused).toHaveLength(5);
    for (const r of refused) expect((r.reason as RpcError).details).toMatchObject({ code: 'BUDGET_EXCEEDED', grantId: grant.grantId });
    expect((await s.client.request('jobs.list', {})).jobs).toHaveLength(3);
    const { grant: after } = await s.client.request('grants.usage', { grantId: grant.grantId });
    expect(after.usage.calls + after.usage.reservedCalls).toBe(3);
  });

  it('amount limit but the model has no price: UI submission gives BUDGET_UNVERIFIABLE; in a session, it is an approval of "amount unknown, this time only"', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    await revokeDefault(s);
    const { grant } = await s.client.request('grants.create', {
      recipient: 'openai',
      dataKinds: ['document'],
      purpose: '有金额上限',
      budgetMode: 'estimate-cap',
      budgetCap: { amount: '5', currency: 'USD' },
    });
    const error = await rejection(s.client.request('models.synthesizeSpeech', { text: 'hi', provider: 'openai' }));
    expect(error.code).toBe('conflict');
    expect(error.details).toMatchObject({ code: 'BUDGET_UNVERIFIABLE', grantId: grant.grantId, remedy: { action: 'approve-once' } });

    const { session } = await send(s, 'auto');
    const pending = tool(session, 'speak', { text: 'hi', provider: 'openai' });
    const asked = await until(() => s.runtime.harness.approvals.pending()[0]);
    expect(asked.grants).toMatchObject([{ reason: 'unverifiable', estimate: null, cost: 'unknown' }]);
    await s.client.request('approvals.respond', { approvalId: asked.approvalId, decision: 'allow' });
    const allowed = await pending;
    expect(allowed.isError).toBe(false);
    const use = s.runtime.models.jobs.inspect(allowed.body.jobId).grant!;
    expect(use.grantId).not.toBe(grant.grantId);
    expect(use).toMatchObject({ budgetMode: 'per-call-unknown-cost', reserved: { calls: 1, amount: null } });
    // The grant with an amount cap was not used.
    expect((await s.client.request('grants.usage', { grantId: grant.grantId })).grant.usage).toMatchObject({ calls: 0, reservedCalls: 0 });
  });

  it('task budget: egress within a task is totaled across calls; when exceeded, TASK_BUDGET_EXCEEDED, no task created, not sent to approval; with an amount limit that cannot be estimated, TASK_BUDGET_UNVERIFIABLE', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const created = await s.client.request('tasks.create', {
      conversationId: s.conversationId,
      goal: '配两段音',
      commandId: newId('cmd'),
      accessMode: 'auto',
      contract: { budget: { maxCalls: 1, cap: null } },
    });
    const taskId = created.taskId;
    expect(created.contract).toMatchObject({ taskId, revision: 1, autonomy: 'auto', budgetPolicyRef: expect.any(String) });
    const session = await until(() => s.driver.sessions[0]);
    await until(() => session.turnId);

    const first = await tool(session, 'speak', { text: '第一段', provider: 'openai' });
    expect(first.isError).toBe(false);
    // The grant (default, unlimited count) allows it, but the task budget does not: a clear error code; no task is created, and nothing enters approval.
    const second = await tool(session, 'speak', { text: '第二段', provider: 'openai' });
    expect(second.isError).toBe(true);
    expect(second.body.error).toMatchObject({ code: 'TASK_BUDGET_EXCEEDED', taskId, measure: 'calls', taskBudget: { maxCalls: 1 } });
    expect((await s.client.request('jobs.list', {})).jobs).toHaveLength(1);
    expect(s.runtime.harness.approvals.pending()).toEqual([]);
    // A flow started within a task: its sub-steps find the agent task through the parent task and count toward it in the same way.
    expect(s.runtime.models.grants.taskOf({ kind: 'pipeline', id: first.body.jobId })).toBe(taskId);

    const view = await s.client.request('tasks.getContract', { taskId });
    expect(view.budget!.usage.calls + view.budget!.usage.reservedCalls).toBe(1);
    // The user changed it to an amount cap: the model has no price, so the amount cannot be estimated and the task budget cannot be guaranteed.
    await s.client.request('tasks.updateContract', {
      taskId,
      expectedRevision: view.contract.revision,
      commandId: newId('cmd'),
      patch: { budget: { maxCalls: null, cap: { amount: '5', currency: 'USD' } } },
    });
    const third = await tool(session, 'speak', { text: '第三段', provider: 'openai' });
    expect(third.body.error).toMatchObject({ code: 'TASK_BUDGET_UNVERIFIABLE', taskId });
    expect((await s.client.request('jobs.list', {})).jobs).toHaveLength(1);
    // An agent cannot loosen its own budget.
    const widened = await tool(session, 'tasks_update_contract', {
      expectedRevision: view.contract.revision + 1,
      patch: { budget: { maxCalls: null, cap: null } },
    });
    expect(widened.body.error).toMatchObject({ code: 'CONTRACT_FIELD_READONLY', fields: ['budget'] });

    // Submissions made directly from the UI connection are not inside a task, so task budgets do not limit them.
    await s.client.request('models.synthesizeSpeech', { text: '界面', provider: 'openai' });
    expect((await s.client.request('jobs.list', {})).jobs).toHaveLength(2);
  });

  it('migration rule persistence: a default grant the user revoked is not reissued after restart; disabling and re-enabling issues a new one; older versions without an enabled time also get the default grant', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const byDefault = await revokeDefault(s);
    // The ledger is written later, so wait for it to be flushed before checking the file.
    await s.runtime.models.grants.flush();
    expect((await fs.stat(s.home.grantsFile)).mode & 0o777).toBe(0o600);

    // Restart: revoked grants are not reissued (same enablement).
    await shutdown(s);
    side = await boot(dir!, openai!);
    expect(await grantsOf(side)).toEqual([]);
    expect((await grantsOf(side, true)).find((g) => g.grantId === byDefault.grantId)).toMatchObject({ state: 'revoked' });

    // Disable, then enable again: this is a new enablement, and another grant is issued; disabling revokes it.
    await side.client.request('models.configure', { providerId: 'openai', enabled: false });
    await side.client.request('models.configure', { providerId: 'openai', enabled: true });
    const [fresh] = await until(async () => {
      const active = await grantsOf(side!);
      return active.length > 0 ? active : null;
    });
    expect(fresh).toMatchObject({ origin: 'provider-enable', state: 'active' });
    expect(fresh!.grantId).not.toBe(byDefault.grantId);
    await side.client.request('models.configure', { providerId: 'openai', enabled: false });
    await until(async () => (await grantsOf(side!)).length === 0);

    // Config written by an old version: enabled, but with no enablement time; the grant ledger does not exist yet. After the upgrade, the default grant still applies and the existing calls are unchanged.
    await side.client.request('models.configure', { providerId: 'openai', enabled: true });
    await shutdown(side);
    const services = JSON.parse(await fs.readFile(side.home.modelServicesFile, 'utf8'));
    delete services.providers.openai.enabledAt;
    await fs.writeFile(side.home.modelServicesFile, JSON.stringify(services));
    await fs.rm(side.home.grantsFile);
    side = await boot(dir!, openai!);
    const [legacy] = await until(async () => {
      const active = await grantsOf(side!);
      return active.length > 0 ? active : null;
    });
    expect(legacy).toMatchObject({ origin: 'provider-enable', state: 'active' });
    const { jobId } = await side.client.request('models.synthesizeSpeech', { text: 'hi', provider: 'openai' });
    expect((await side.client.request('jobs.inspect', { jobId })).grant).toMatchObject({ grantId: legacy!.grantId });
  });

  it('grant methods on the gateway: create / update / revoke / usage and the grants topic; tightening increments the generation', async () => {
    const s = await start();
    await s.client.request('models.configure', { providerId: 'openai', enabled: true, credential: OPENAI_KEY });
    const { grant } = await s.client.request('grants.create', {
      recipient: 'openai',
      dataKinds: ['audio', 'document'],
      purpose: '用户发放',
      budgetMode: 'per-call-unknown-cost',
      maxCalls: 10,
    });
    expect(grant).toMatchObject({ origin: 'user', generation: 1, state: 'active' });
    const { grant: widened } = await s.client.request('grants.update', { grantId: grant.grantId, maxCalls: 20 });
    expect(widened.generation).toBe(1);
    const { grant: narrowed } = await s.client.request('grants.update', { grantId: grant.grantId, dataKinds: ['audio'] });
    expect(narrowed.generation).toBe(2);
    const revoked = await s.client.request('grants.revoke', { grantId: grant.grantId });
    expect(revoked.grant).toMatchObject({ state: 'revoked', generation: 3 });
    expect(revoked.note).toEqual(expect.any(String));
    expect((await rejection(s.client.request('grants.usage', { grantId: 'grt_nope' }))).code).toBe('not-found');
    expect(
      (
        await rejection(
          s.client.request('grants.create', { recipient: 'openai', dataKinds: ['audio'], purpose: 'x', budgetMode: 'estimate-cap' }),
        )
      ).code,
    ).toBe('invalid-request');

    const events: unknown[] = [];
    const snapshot = await new Promise<{ grants: Grant[] }>((resolve) => {
      s.client.subscribe('grants', { snapshot: resolve, event: (event: unknown) => events.push(event) });
    });
    expect(snapshot.grants.map((g) => g.grantId)).toContain(grant.grantId);
    await s.client.request('grants.create', {
      recipient: 'openai',
      dataKinds: ['frames'],
      purpose: '缩略图',
      budgetMode: 'per-call-unknown-cost',
    });
    await until(() => events.some((e) => (e as { type: string }).type === 'grant.upsert'));
  });
});
