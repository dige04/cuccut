import crypto from 'node:crypto';

/**
 * Pairing and tokens (node protocol spec §4).
 *
 * - Pairing code: 6 decimal digits (`crypto.randomInt`), valid for 10 minutes by default, single-use. The pairing code and the lockout live in memory only.
 * - After 5 wrong entries from any source: locked for 10 minutes, and the current pairing code is invalidated. `newCode()` invalidates the old code, clears the lockout and resets the count.
 * - Token: `<clientId>.<secret>`, where `secret` is the base64url of 32 random bytes. Only each client's salt and `sha256(salt ‖ secret)` are stored; comparison uses `crypto.timingSafeEqual`. Pairing the same `clientId` again replaces its previous token.
 *
 * Tokens and pairing codes are not logged: this module writes no logs, and callers record only the `clientId`.
 */

export interface Clock {
  /** Millisecond timestamp. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A paired client persisted in `node-share.json`: no plaintext token. */
export interface PairedClient {
  clientId: string;
  name: string;
  /** base64 */
  salt: string;
  /** Lowercase hex of `sha256(salt ‖ secret)` */
  hash: string;
  pairedAt: string;
  lastSeenAt: string | null;
}

export interface PairingLimits {
  /** Validity period of the pairing code (default 10 minutes). */
  codeTtlMs: number;
  /** Number of wrong entries that triggers a lockout (default 5). */
  maxFailures: number;
  /** Duration of the lockout (default 10 minutes). */
  lockMs: number;
}

export const DEFAULT_PAIRING_LIMITS: PairingLimits = { codeTtlMs: 10 * 60_000, maxFailures: 5, lockMs: 10 * 60_000 };

export type PairOutcome =
  | { ok: true; client: PairedClient; token: string }
  | { ok: false; code: 'PAIRING_CODE_INVALID' }
  | { ok: false; code: 'PAIRING_LOCKED'; retryAfterMs: number };

export type PairingState = { code: string; expiresAt: string } | { lockedUntil: string } | null;

const SECRET_BYTES = 32;

export class Pairing {
  readonly #clock: Clock;
  readonly #limits: PairingLimits;
  readonly #clients = new Map<string, PairedClient>();
  #code: { value: string; expiresAt: number } | null = null;
  #failures = 0;
  #lockedUntil: number | null = null;

  constructor(clients: readonly PairedClient[], options: { clock?: Clock; limits?: Partial<PairingLimits> } = {}) {
    this.#clock = options.clock ?? systemClock;
    this.#limits = { ...DEFAULT_PAIRING_LIMITS, ...options.limits };
    for (const client of clients) this.#clients.set(client.clientId, { ...client });
  }

  /** Invalidates the old pairing code and generates a new one, also clearing the lockout and the wrong-entry count. */
  newCode(): { code: string; expiresAt: string } {
    const value = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = this.#clock.now() + this.#limits.codeTtlMs;
    this.#code = { value, expiresAt };
    this.#failures = 0;
    this.#lockedUntil = null;
    return { code: value, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Invalidates the current pairing code (when sharing is turned off). The lockout is unchanged. */
  clearCode(): void {
    this.#code = null;
  }

  state(): PairingState {
    const now = this.#clock.now();
    this.#expire(now);
    if (this.#lockedUntil !== null) return { lockedUntil: new Date(this.#lockedUntil).toISOString() };
    if (this.#code) return { code: this.#code.value, expiresAt: new Date(this.#code.expiresAt).toISOString() };
    return null;
  }

  /** Exchanges a pairing code for a token. On success the pairing code is used up; the old token of the same `clientId` becomes invalid. */
  pair(code: string, clientId: string, clientName: string): PairOutcome {
    const now = this.#clock.now();
    this.#expire(now);
    if (this.#lockedUntil !== null) return { ok: false, code: 'PAIRING_LOCKED', retryAfterMs: this.#lockedUntil - now };
    if (!this.#code || !sameCode(code, this.#code.value)) {
      this.#failures++;
      if (this.#failures >= this.#limits.maxFailures) {
        this.#lockedUntil = now + this.#limits.lockMs;
        this.#code = null;
        this.#failures = 0;
      }
      return { ok: false, code: 'PAIRING_CODE_INVALID' };
    }
    this.#code = null;
    this.#failures = 0;
    const secret = crypto.randomBytes(SECRET_BYTES);
    const salt = crypto.randomBytes(16);
    const client: PairedClient = {
      clientId,
      name: clientName,
      salt: salt.toString('base64'),
      hash: digest(salt, secret).toString('hex'),
      pairedAt: new Date(now).toISOString(),
      lastSeenAt: null,
    };
    this.#clients.set(clientId, client);
    return { ok: true, client: { ...client }, token: `${clientId}.${secret.toString('base64url')}` };
  }

  /** Verifies a token and returns the client it belongs to (and records when it was last seen); returns null if the token is invalid or revoked. */
  verify(token: string): PairedClient | null {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const client = this.#clients.get(token.slice(0, dot));
    const text = token.slice(dot + 1);
    const secret = Buffer.from(text, 'base64url');
    // Accept only canonical base64url: each byte string has exactly one spelling.
    if (!client || secret.length !== SECRET_BYTES || secret.toString('base64url') !== text) return null;
    const expected = Buffer.from(client.hash, 'hex');
    const actual = digest(Buffer.from(client.salt, 'base64'), secret);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    client.lastSeenAt = new Date(this.#clock.now()).toISOString();
    return { ...client };
  }

  revoke(clientId: string): boolean {
    return this.#clients.delete(clientId);
  }

  has(clientId: string): boolean {
    return this.#clients.has(clientId);
  }

  clients(): PairedClient[] {
    return [...this.#clients.values()].map((c) => ({ ...c }));
  }

  #expire(now: number): void {
    if (this.#lockedUntil !== null && now >= this.#lockedUntil) {
      this.#lockedUntil = null;
      this.#failures = 0;
    }
    if (this.#code && now >= this.#code.expiresAt) this.#code = null;
  }
}

function digest(salt: Buffer, secret: Buffer): Buffer {
  return crypto.createHash('sha256').update(salt).update(secret).digest();
}

/** Constant-time comparison of pairing codes (different lengths are unequal immediately: length is not secret). */
function sameCode(given: string, expected: string): boolean {
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
