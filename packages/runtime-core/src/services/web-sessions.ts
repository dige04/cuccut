import crypto from 'node:crypto';
import { WEB_ACCESS_CODE_TTL_MS, WEB_SESSION_TTL_MS, newId, nowIso, type WebSession } from '@cuccut/protocol';

/**
 * Login state of the web service (architecture design §4.8, §12.8): the one-time codes in access links and the browser sessions, held only in memory.
 *
 * - A code is 32 random bytes encoded as base64url, and only its `sha256` is stored. It is invalidated at the first exchange attempt (whether or not that succeeds), and also when it expires.
 *   There is a limit on simultaneously valid codes. When it is exceeded, the earliest-issued code is dropped.
 * - A session token is `<sessionId>.<secret>`. `secret` is likewise 32 bytes and only its hash is stored, compared with `timingSafeEqual`. The token exists only in the cookie.
 * - Everything is cleared when the service stops. Tokens are regenerated on each service start (§12.8).
 */

const SECRET_BYTES = 32;
const MAX_CODES = 20;
const USER_AGENT_MAX = 200;

interface StoredSession {
  sessionId: string;
  hash: Buffer;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: number;
  userAgent: string | null;
  connections: number;
}

export interface WebSessionsOptions {
  codeTtlMs?: number;
  sessionTtlMs?: number;
}

export class WebSessions {
  readonly codeTtlMs: number;
  readonly sessionTtlMs: number;
  /** sha256(code) → expiry time. In insertion order, earliest first. */
  readonly #codes = new Map<string, number>();
  readonly #sessions = new Map<string, StoredSession>();

  constructor(options: WebSessionsOptions = {}) {
    this.codeTtlMs = options.codeTtlMs ?? WEB_ACCESS_CODE_TTL_MS;
    this.sessionTtlMs = options.sessionTtlMs ?? WEB_SESSION_TTL_MS;
  }

  /** Issues a one-time code. The plaintext is returned only here. */
  issueCode(): { code: string; expiresAt: string } {
    this.#prune();
    while (this.#codes.size >= MAX_CODES) {
      const oldest = this.#codes.keys().next().value;
      if (oldest === undefined) break;
      this.#codes.delete(oldest);
    }
    const code = crypto.randomBytes(SECRET_BYTES).toString('base64url');
    const expiresAt = Date.now() + this.codeTtlMs;
    this.#codes.set(hashText(code), expiresAt);
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Exchanges a code for a session. Returns null when the code is unknown, already used, or expired. In every case, the code is invalidated from then on. */
  exchange(code: string, userAgent: string | undefined): { sessionId: string; token: string; maxAgeSec: number } | null {
    const key = hashText(code);
    const expiresAt = this.#codes.get(key);
    this.#codes.delete(key);
    if (expiresAt === undefined || expiresAt <= Date.now()) return null;
    const sessionId = newId('wses');
    const secret = crypto.randomBytes(SECRET_BYTES);
    const now = nowIso();
    this.#sessions.set(sessionId, {
      sessionId,
      hash: crypto.createHash('sha256').update(secret).digest(),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: Date.now() + this.sessionTtlMs,
      userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX) : null,
      connections: 0,
    });
    return { sessionId, token: `${sessionId}.${secret.toString('base64url')}`, maxAgeSec: Math.floor(this.sessionTtlMs / 1000) };
  }

  /** Session token → session ID. Returns null when unknown, revoked, expired, or malformed. Records the time of most recent use. */
  verify(token: string): string | null {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const session = this.#sessions.get(token.slice(0, dot));
    const text = token.slice(dot + 1);
    const secret = Buffer.from(text, 'base64url');
    if (!session || secret.length !== SECRET_BYTES || secret.toString('base64url') !== text) return null;
    const actual = crypto.createHash('sha256').update(secret).digest();
    if (!crypto.timingSafeEqual(actual, session.hash)) return null;
    if (session.expiresAt <= Date.now()) {
      this.#sessions.delete(session.sessionId);
      return null;
    }
    session.lastUsedAt = nowIso();
    return session.sessionId;
  }

  /** Whether the session is still valid. Checked for every request on a connection: an expired session no longer executes any method. */
  alive(sessionId: string): boolean {
    const session = this.#sessions.get(sessionId);
    if (!session) return false;
    if (session.expiresAt > Date.now()) return true;
    this.#sessions.delete(sessionId);
    return false;
  }

  connected(sessionId: string, delta: 1 | -1): void {
    const session = this.#sessions.get(sessionId);
    if (session) session.connections = Math.max(0, session.connections + delta);
  }

  revoke(sessionId: string): boolean {
    return this.#sessions.delete(sessionId);
  }

  list(): WebSession[] {
    this.#prune();
    return [...this.#sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: new Date(s.expiresAt).toISOString(),
      connections: s.connections,
      userAgent: s.userAgent,
    }));
  }

  clear(): void {
    this.#codes.clear();
    this.#sessions.clear();
  }

  #prune(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.#codes) if (expiresAt <= now) this.#codes.delete(key);
    for (const [id, session] of this.#sessions) if (session.expiresAt <= now) this.#sessions.delete(id);
  }
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
