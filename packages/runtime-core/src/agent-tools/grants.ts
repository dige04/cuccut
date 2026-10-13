import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import crypto from 'node:crypto';
import { newId, type Id } from '@cuccut/protocol';
import type { AgentToolAccess, ToolGrant } from '@cuccut/harness';
import type { TrustedPrincipal } from '../gateway.ts';

/** The identity behind a tool call: which session's agent (architecture design §4.2). */
export interface AgentPrincipal extends TrustedPrincipal {
  kind: 'agent';
  conversationId: Id;
}

/**
 * Tool-channel authorization (architecture design §3.5, §12.5). One random token per native session; it identifies only
 * the session and carries no permissions: what it may do is decided on each call from the session's current task. When
 * the session closes, the token is revoked and the videos it opened close after a grace period.
 */
export class AgentGrants implements AgentToolAccess {
  readonly #byToken = new Map<string, AgentPrincipal>();
  readonly #onRevoke: (principal: AgentPrincipal) => void;
  readonly #extra: ((conversationId: Id) => Promise<string>) | null;
  #endpoint: string | null = null;
  #instructions: string | null = null;

  /** `sessionInstructions`: a section appended after the guidance when each native session starts (the index of enabled skills, §3.8). */
  constructor(onRevoke: (principal: AgentPrincipal) => void, sessionInstructions?: (conversationId: Id) => Promise<string>) {
    this.#onRevoke = onRevoke;
    this.#extra = sessionInstructions ?? null;
  }

  /**
   * Developer guidance for each native session (§3.8): the "How to work" section of the agent guide rendered for the
   * tool-bridge surface (`guidance.ts`). It can only be rendered once the tool catalog is built, so the Runtime sets it
   * before opening sessions; opening a session without it is a wiring error and throws, rather than opening a session
   * with empty guidance.
   */
  get instructions(): string {
    if (this.#instructions === null) throw new Error(RcAgentTools.instructionsNotSet().text);
    return this.#instructions;
  }

  setInstructions(text: string): void {
    this.#instructions = text;
  }

  sessionInstructions(conversationId: Id): Promise<string> {
    return this.#extra ? this.#extra(conversationId) : Promise.resolve('');
  }

  /** The address is known only once the gateway is listening. */
  setEndpoint(url: string): void {
    this.#endpoint = url;
  }

  grant(conversationId: Id): ToolGrant {
    if (!this.#endpoint) return { mcpServers: {}, revoke() {} };
    const token = crypto.randomBytes(32).toString('base64url');
    const principal: AgentPrincipal = { connectionId: newId('agt'), kind: 'agent', name: conversationId, conversationId };
    this.#byToken.set(token, principal);
    let revoked = false;
    return {
      mcpServers: { cuccut: { url: this.#endpoint, headers: { Authorization: `Bearer ${token}` } } },
      revoke: () => {
        if (revoked) return;
        revoked = true;
        this.#byToken.delete(token);
        this.#onRevoke(principal);
      },
    };
  }

  /** `Authorization: Bearer <token>` -> identity; null when unknown or revoked. */
  resolve(authorization: string | undefined): AgentPrincipal | null {
    const match = /^Bearer\s+(\S+)$/.exec(authorization ?? '');
    return match ? (this.#byToken.get(match[1]!) ?? null) : null;
  }
}
