import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { FakeAcpLogEntry, FakeAcpScenario } from './fake-acp.ts';

/**
 * Process entry point of the fake ACP agent (see `fake-acp.ts`). Run directly by node, using only Node's built-in modules, not the ACP SDK.
 * The on-wire shapes are hand-written from the protocol, so the tests and the implementation do not share one understanding.
 */

const dir = process.env.FAKE_ACP_DIR;
if (!dir) {
  process.stderr.write('FAKE_ACP_DIR is not set\n');
  process.exit(2);
}
const scenario = JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8')) as FakeAcpScenario;
const logFile = path.join(dir, 'log.jsonl');

function log(entry: Omit<FakeAcpLogEntry, 't' | 'pid'>): void {
  fs.appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), pid: process.pid, ...entry })}\n`);
}

const args = process.argv.slice(2);
if (args[0] === '--version') {
  process.stdout.write(`fake-acp ${scenario.version}\n`);
  process.exit(0);
}
// Like the rg that cursor-agent runs to index @ files: in the agent's process group, it ignores SIGTERM. It says ready only after the signal handler is installed, so a stop request that arrives too early does not simply end it through SIGTERM, which would leave the forced kill untested.
const HELPER = "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000);";
const helper = scenario.helper ? spawn(process.execPath, ['-e', HELPER], { stdio: ['ignore', 'pipe', 'ignore'] }) : null;
if (helper) await once(helper.stdout, 'data');
log({
  kind: 'start',
  cwd: process.cwd(),
  args,
  env: { NO_BROWSER: process.env.NO_BROWSER, NO_OPEN_BROWSER: process.env.NO_OPEN_BROWSER },
  ...(helper ? { helper: helper.pid } : {}),
});

type Message = {
  jsonrpc?: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
};

function send(message: Message): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}
// A non-JSON log line is mixed in: CucCut should ignore it.
process.stdout.write('fake-acp: starting up\n');

let nextId = 5000;
let sessionCount = 0;
let allowAll = 'off';
const pending = new Map<number | string, (message: Message) => void>();
let cancel: (() => void) | null = null;

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line) as Message;
  log({ kind: 'in', msg: message });
  if (message.method && message.id !== undefined) void handleRequest(message);
  else if (message.method) handleNotification(message);
  else if (message.id !== undefined) pending.get(message.id)?.(message);
});
rl.on('close', () => {
  log({ kind: 'exit' });
  process.exit(0);
});

function request(method: string, params: Record<string, unknown>): Promise<Message> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, (message) => {
      pending.delete(id);
      resolve(message);
    });
    send({ id, method, params });
  });
}

function update(sessionId: string, update: Record<string, unknown>): void {
  send({ method: 'session/update', params: { sessionId, update } });
}

function sessionState(): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  const configOptions: unknown[] = [];
  if (scenario.modes && scenario.modesVia === 'modes') {
    state.modes = { availableModes: scenario.modes.map((id) => ({ id, name: id })), currentModeId: 'default' };
  }
  if (scenario.modes && scenario.modesVia === 'config') {
    configOptions.push({
      id: 'mode',
      name: 'Mode',
      type: 'select',
      category: 'mode',
      currentValue: 'default',
      options: scenario.modes.map((value) => ({ value, name: value })),
    });
  }
  if (scenario.models === 'legacy') {
    state.models = {
      availableModels: [
        { modelId: 'fake-pro', name: 'Fake Pro' },
        { modelId: 'fake-flash', name: 'Fake Flash', description: 'Fast' },
      ],
      currentModelId: 'fake-pro',
    };
  }
  if (scenario.models === 'config') {
    configOptions.push({
      id: 'model',
      name: 'Model',
      type: 'select',
      category: 'model',
      currentValue: 'fake-pro',
      options: [
        { group: 'all', name: 'All', options: [{ value: 'fake-pro', name: 'Fake Pro' }] },
        { group: 'fast', name: 'Fast', options: [{ value: 'fake-flash', name: 'Fake Flash' }] },
      ],
    });
  }
  if (scenario.allowAll) {
    configOptions.push({
      id: 'allow_all',
      name: 'Allow All',
      type: 'select',
      category: 'permissions',
      currentValue: allowAll,
      options: [
        { value: 'on', name: 'On' },
        { value: 'off', name: 'Off' },
      ],
    });
  }
  if (configOptions.length > 0) state.configOptions = configOptions;
  return state;
}

const AUTH_REQUIRED = { code: -32000, message: 'Authentication required', data: { details: 'API key is missing' } };

async function handleRequest(message: Message): Promise<void> {
  const id = message.id!;
  const params = message.params ?? {};
  const reply = (result: unknown) => send({ id, result });
  const fail = (error: unknown) => send({ id, error });
  switch (message.method) {
    case 'initialize':
      if (scenario.exitOnInitialize) process.exit(1);
      return reply({
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: scenario.loadSession,
          promptCapabilities: { image: scenario.image },
          mcpCapabilities: { http: scenario.mcpHttp },
          sessionCapabilities: { ...(scenario.resume ? { resume: {} } : {}), close: {} },
        },
        authMethods: [],
      });
    case 'session/new':
      if (!scenario.loggedIn) return fail(AUTH_REQUIRED);
      sessionCount += 1;
      return reply({ sessionId: `sess-${process.pid}-${sessionCount}`, ...sessionState() });
    case 'session/load': {
      if (!scenario.loggedIn) return fail(AUTH_REQUIRED);
      if (scenario.loadFails) return fail({ code: -32603, message: 'session not found' });
      // Replays history: CucCut should not treat it as new content.
      update(String(params.sessionId), { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'OLD HISTORY' } });
      return reply(sessionState());
    }
    case 'session/resume':
      return reply(sessionState());
    case 'session/set_mode':
    case 'session/set_model':
    case 'session/close':
      return reply({});
    case 'session/set_config_option':
      if (params.configId === 'allow_all') allowAll = String(params.value);
      return reply({ configOptions: sessionState().configOptions ?? [] });
    case 'cursor/list_available_models':
      if (!scenario.cursorModels) return fail({ code: -32601, message: 'Method not found' });
      return reply({
        models: [
          { value: 'auto', name: 'Auto', configOptions: [] },
          { value: 'cursor-fast', name: 'Cursor Fast', configOptions: [] },
        ],
      });
    case 'session/prompt':
      return runTurn(String(params.sessionId), reply, fail);
    default:
      return fail({ code: -32601, message: `Method not found: ${message.method}` });
  }
}

function handleNotification(message: Message): void {
  if (message.method === 'session/cancel') cancel?.();
}

async function runTurn(sessionId: string, reply: (result: unknown) => void, fail: (error: unknown) => void): Promise<void> {
  const turn = scenario.turn;
  let cancelled = false;
  const cancelledPromise = new Promise<void>((resolve) => {
    cancel = () => {
      cancelled = true;
      resolve();
    };
  });
  if (turn.error) return fail(turn.error);
  if (turn.thought) update(sessionId, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: turn.thought } });
  if (turn.plan) {
    update(sessionId, {
      sessionUpdate: 'plan',
      entries: turn.plan.map((content, i) => ({ content, priority: 'medium', status: i === 0 ? 'completed' : 'pending' })),
    });
  }
  if (turn.tool) {
    const asks = Math.max(turn.ask ?? 0, 0);
    for (let i = 0; i < Math.max(asks, 1); i++) {
      const toolCallId = `tool-${i + 1}`;
      const toolCall = {
        toolCallId,
        title: turn.tool.title,
        kind: turn.tool.kind,
        status: 'pending',
        rawInput: turn.tool.rawInput,
        locations: (turn.tool.locations ?? []).map((p) => ({ path: p })),
        ...(turn.tool.diffs ? { content: turn.tool.diffs.map((d) => ({ type: 'diff', ...d })) } : {}),
      };
      update(sessionId, { sessionUpdate: 'tool_call', ...toolCall });
      let allowed = true;
      if (asks > 0) {
        const answer = await request('session/request_permission', {
          sessionId,
          toolCall: { toolCallId, title: turn.tool.title, kind: turn.tool.kind, rawInput: turn.tool.rawInput },
          options: [
            { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
            { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
            { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
          ],
        });
        const outcome = (answer.result as { outcome?: { outcome: string; optionId?: string } } | undefined)?.outcome;
        if (outcome?.outcome === 'cancelled' || cancelled) {
          update(sessionId, { sessionUpdate: 'tool_call_update', toolCallId, status: 'failed' });
          return reply({ stopReason: 'cancelled' });
        }
        allowed = outcome?.optionId === 'allow' || outcome?.optionId === 'always';
      }
      update(sessionId, {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: allowed ? 'completed' : 'failed',
        ...(allowed && turn.tool.output ? { content: [{ type: 'content', content: { type: 'text', text: turn.tool.output } }] } : {}),
        ...(allowed ? { rawOutput: { exitCode: 0 } } : {}),
      });
    }
  }
  if (turn.hang) {
    await cancelledPromise;
    return reply({ stopReason: 'cancelled' });
  }
  if (turn.reply) {
    const half = Math.ceil(turn.reply.length / 2);
    update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: turn.reply.slice(0, half) } });
    update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: turn.reply.slice(half) } });
  }
  reply({ stopReason: cancelled ? 'cancelled' : 'end_turn' });
}
