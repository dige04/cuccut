import { expect } from 'vitest';
import type { AgentDriver, AgentEvent, AgentImage, AgentInput, AgentSession, ApprovalResponse, CreateSessionOptions } from '@cuccut/harness';
import { newId, nowIso, type AgentErrorCode, type ApprovalRequest, type DriverModel, type DriverProbe } from '@cuccut/protocol';

/**
 * A fake native agent for tests: once a turn starts it stays open, and the test uses its session token to call tools on
 * its behalf through the real MCP endpoint.
 */

const capabilities: DriverProbe['capabilities'] = { steer: false, approvals: true, resume: false, images: false };

/** An "available" probe result for the fake Driver. */
export function fakeProbe(capabilitiesOverride: DriverProbe['capabilities'] = capabilities, models: DriverModel[] = []): DriverProbe {
  return {
    id: 'codex',
    name: 'Fake',
    command: 'fake',
    state: 'ready',
    status: 'available',
    version: '0',
    minVersion: '0',
    latestVersion: null,
    unavailableReason: null,
    detail: null,
    executable: null,
    realExecutable: null,
    account: null,
    plan: '',
    loginCommand: null,
    install: [],
    models,
    configModel: null,
    configModelKnown: null,
    checkedAt: nowIso(),
    verified: true,
    tested: true,
    capabilities: capabilitiesOverride,
  };
}

/** Stays open after a turn starts until the test calls `finish()`; meanwhile the test calls tools on the agent's behalf. */
export class ToolSession implements AgentSession {
  readonly id = newId('fake');
  readonly capabilities: DriverProbe['capabilities'];
  readonly inputs: string[] = [];
  /** Images received each time (startTurn and steer); not one-to-one with `inputs`. */
  readonly images: AgentImage[][] = [];
  /** The Harness's responses to approvals: auto-approved, clicked by the user, or cancelled by the stop barrier. */
  readonly responses: { approvalId: string; decision: ApprovalResponse['decision'] }[] = [];
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  #turn = 0;
  turnId: string | null = null;
  readonly options: CreateSessionOptions;

  constructor(options: CreateSessionOptions, caps: DriverProbe['capabilities'] = capabilities) {
    this.options = options;
    this.capabilities = caps;
  }

  startTurn(input: AgentInput): Promise<{ turnId: string }> {
    const turnId = `turn-${++this.#turn}`;
    this.turnId = turnId;
    this.inputs.push(input.text);
    if (input.images) this.images.push(input.images);
    setTimeout(() => this.#emit({ type: 'turn.started', turnId }), 1);
    return Promise.resolve({ turnId });
  }

  async steer(_turnId: string, input: AgentInput): Promise<'accepted' | 'unavailable'> {
    if (!this.capabilities.steer) return 'unavailable';
    this.inputs.push(input.text);
    if (input.images) this.images.push(input.images);
    return 'accepted';
  }

  finish(outcome: 'completed' | 'interrupted' | 'failed' = 'completed', errorCode: AgentErrorCode | null = null) {
    if (this.turnId) {
      this.#emit({
        type: 'turn.completed',
        turnId: this.turnId,
        outcome,
        error: outcome === 'failed' ? 'Turn failed' : null,
        ...(errorCode ? { errorCode } : {}),
      });
    }
    this.turnId = null;
  }

  /** The native side sends an approval (a command, a file change, the agent's own tool); returns the approval id. */
  requestApproval(request: ApprovalRequest): string {
    const approvalId = newId('appr');
    this.#emit({ type: 'approval.requested', turnId: this.turnId ?? 'turn', approvalId, request });
    return approvalId;
  }

  /** Other events from the native side (session.error and the like). */
  emit(event: AgentEvent) {
    this.#emit(event);
  }

  /** An interrupt request is only recorded, not acted on immediately: tests need to observe the window between the stop barrier and the end of the turn. */
  async interrupt() {
    return { status: 'requested' as const };
  }

  async respondToApproval(approvalId: string, response: ApprovalResponse) {
    this.responses.push({ approvalId, decision: response.decision });
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  describePersistence() {
    return null;
  }

  async close() {}

  #emit(event: AgentEvent) {
    for (const listener of this.#listeners) listener(event);
  }
}

export class ToolDriver implements AgentDriver {
  readonly id = 'codex' as const;
  readonly sessions: ToolSession[] = [];
  readonly #capabilities: DriverProbe['capabilities'];
  readonly #models: DriverModel[];

  constructor(options: { capabilities?: Partial<DriverProbe['capabilities']>; models?: DriverModel[] } = {}) {
    this.#capabilities = { ...capabilities, ...options.capabilities };
    this.#models = options.models ?? [];
  }

  async probe(): Promise<DriverProbe> {
    return fakeProbe(this.#capabilities, this.#models);
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const session = new ToolSession(options, this.#capabilities);
    this.sessions.push(session);
    return session;
  }
}

export async function until<T>(
  read: () => T | undefined | null | false | Promise<T | undefined | null | false>,
  timeoutMs = 5000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

let rpcId = 0;

export async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });
}

/** Calls an MCP method as this native session. */
export async function mcp(session: ToolSession, method: string, params: Record<string, unknown> = {}) {
  const server = session.options.mcpServers!.cuccut!;
  const response = await post(server.url, server.headers, { jsonrpc: '2.0', id: ++rpcId, method, params });
  expect(response.status).toBe(200);
  return (await response.json()) as { result?: Record<string, unknown>; error?: { code: number; message: string } };
}

/** Tool result shapes vary by tool; tests pick fields as needed. */
export type Loose = any;

export async function tool(session: ToolSession, name: string, args: Record<string, unknown>): Promise<{ isError: boolean; body: Loose }> {
  const { result } = await mcp(session, 'tools/call', { name, arguments: args });
  const content = result!.content as { type: string; text: string }[];
  return { isError: Boolean(result!.isError), body: JSON.parse(content[0]!.text) };
}
