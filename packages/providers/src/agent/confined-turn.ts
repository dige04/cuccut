import type { AgentDriver, AgentEvent, AgentSession } from '@cuccut/harness';
import { ProvidersAgent as PA } from '@cuccut/protocol/messages/providers';

/**
 * One confined turn of an installed agent (architecture design §6.9): the run behind the agent image provider and the profile writer
 * (docs/cuccut/m2-profile-rules.md §4).
 *
 * - A dedicated native session that belongs to no user session: no video context, no history and no MCP services (no CucCut tools). The working
 *   directory is the caller's scratch directory, and the session may write only there (`confinement: 'cwd-write-only'`).
 * - Approval requests are always declined, since there is no one to approve them.
 * - One turn is sent. The session is closed when the turn ends: completed, failed, interrupted, the process exited, timed out or cancelled. On a
 *   timeout or a cancel the turn is interrupted first.
 * - What the session wrote is the caller's business; the agent's text replies are returned for error messages only.
 */

export interface ConfinedTurnOptions {
  driver: AgentDriver;
  /** Executable the user specified manually; null lets the Driver find it. */
  executable?: string | null;
  /** The working directory: the only place the session may write. */
  cwd: string;
  /** Developer instructions: the task, the files to read and write, and the prohibitions. */
  instructions: string;
  /** The turn's input. */
  text: string;
  /** Deadline for the turn (milliseconds). */
  timeoutMs: number;
  signal?: AbortSignal;
  /** Every event of the session, for progress (called before the turn logic sees it). */
  onEvent?: (event: AgentEvent) => void;
}

export type ConfinedTurnResult =
  | { kind: 'completed' }
  | { kind: 'failed'; message: string }
  | { kind: 'interrupted' }
  | { kind: 'exited'; message: string }
  | { kind: 'timeout' }
  | { kind: 'cancelled' };

export type ConfinedTurnOutcome =
  /** The session could not be created (`error` is what the Driver threw). */
  | { started: false; error: unknown }
  | {
      started: true;
      result: ConfinedTurnResult;
      /** The agent's non-empty text replies, in order. */
      replies: string[];
      /** How many approval requests were declined. */
      declined: number;
    };

/** Opens a confined session, runs one turn and closes the session. Never throws for a failure of the agent: the outcome says what happened. */
export async function runConfinedTurn(options: ConfinedTurnOptions): Promise<ConfinedTurnOutcome> {
  let session: AgentSession;
  try {
    session = await options.driver.createSession({
      cwd: options.cwd,
      // The policy of a confined session is fixed, so the access mode has no effect. The model and effort use the Agent's own defaults.
      accessMode: 'fullAccess',
      model: null,
      effort: null,
      executable: options.executable ?? null,
      resume: null,
      developerInstructions: options.instructions,
      confinement: 'cwd-write-only',
    });
  } catch (error) {
    return { started: false, error };
  }
  try {
    return { started: true, ...(await confinedTurn(session, options)) };
  } finally {
    await session.close().catch(() => {});
  }
}

/** Sends one turn and waits for it to end, fail, the session to exit, time out, or be cancelled. On cancel or timeout, the turn is interrupted (the session is closed afterwards by the caller). */
async function confinedTurn(
  session: AgentSession,
  options: ConfinedTurnOptions,
): Promise<{ result: ConfinedTurnResult; replies: string[]; declined: number }> {
  const { signal } = options;
  const replies: string[] = [];
  const errors: string[] = [];
  let declined = 0;
  let settle!: (result: ConfinedTurnResult) => void;
  const done = new Promise<ConfinedTurnResult>((resolve) => (settle = resolve));
  const unsubscribe = session.subscribe((event) => {
    try {
      options.onEvent?.(event);
    } catch {
      // Progress must not break the turn.
    }
    switch (event.type) {
      case 'item.completed':
        if (event.item.kind === 'agent-message' && event.item.text.trim()) replies.push(event.item.text.trim());
        return;
      case 'approval.requested':
        // There is no one to approve, so out-of-bounds actions are all declined.
        declined++;
        void session.respondToApproval(event.approvalId, { decision: 'decline' }).catch(() => {});
        return;
      case 'session.error':
        if (!event.willRetry) errors.push(event.message);
        return;
      case 'turn.completed':
        if (event.outcome === 'completed') settle({ kind: 'completed' });
        else if (event.outcome === 'interrupted') settle({ kind: 'interrupted' });
        else settle({ kind: 'failed', message: event.error ?? errors.at(-1) ?? PA.unknownError().text });
        return;
      case 'session.exited':
        settle({ kind: 'exited', message: event.error ?? errors.at(-1) ?? PA.processExited().text });
        return;
      default:
        return;
    }
  });
  const onAbort = () => settle({ kind: 'cancelled' });
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => settle({ kind: 'timeout' }), options.timeoutMs);
  let turnId: string | null = null;
  try {
    if (signal?.aborted) return { result: { kind: 'cancelled' }, replies, declined };
    try {
      turnId = (await session.startTurn({ text: options.text }, { accessMode: 'fullAccess', model: null, effort: null })).turnId;
    } catch (error) {
      settle({ kind: 'exited', message: PA.turnNotStarted({ error: error instanceof Error ? error.message : String(error) }).text });
    }
    const result = await done;
    if ((result.kind === 'cancelled' || result.kind === 'timeout') && turnId) await session.interrupt(turnId).catch(() => {});
    return { result, replies, declined };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    unsubscribe();
  }
}
