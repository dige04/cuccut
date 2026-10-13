import { describe, expect, it } from 'vitest';
import { Pairing } from './pairing.ts';
import { ManualClock } from './testing/test-node.ts';

const MINUTE = 60_000;

function codeOf(pairing: Pairing): string {
  const state = pairing.state();
  if (!state || !('code' in state)) throw new Error('没有配对码');
  return state.code;
}

/** A 6-digit number that is definitely not the current pairing code. */
function wrong(code: string): string {
  return code === '000000' ? '111111' : '000000';
}

describe('pairing', () => {
  it('pairing code is 6 digits, invalidated after one use; token is clientId.secret, only the salt and digest are persisted', () => {
    const clock = new ManualClock();
    const pairing = new Pairing([], { clock });
    const { code, expiresAt } = pairing.newCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(Date.parse(expiresAt)).toBe(clock.now() + 10 * MINUTE);

    const outcome = pairing.pair(code, 'client-a', 'Mac Studio');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.token).toMatch(/^client-a\.[A-Za-z0-9_-]{43}$/);
    const secret = outcome.token.split('.')[1]!;
    const stored = JSON.stringify(pairing.clients());
    expect(stored).not.toContain(secret);
    expect(pairing.clients()).toEqual([
      expect.objectContaining({
        clientId: 'client-a',
        name: 'Mac Studio',
        salt: expect.any(String),
        hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    ]);
    expect(pairing.state()).toBeNull();
    expect(pairing.pair(code, 'client-b', 'Other')).toEqual({ ok: false, code: 'PAIRING_CODE_INVALID' });

    expect(pairing.verify(outcome.token)).toMatchObject({ clientId: 'client-a', lastSeenAt: new Date(clock.now()).toISOString() });
  });

  it('wrong tokens are always invalid', () => {
    const pairing = new Pairing([]);
    const outcome = pairing.pair(pairing.newCode().code, 'client-a', 'A');
    if (!outcome.ok) throw new Error('配对失败');
    const [clientId, secret] = outcome.token.split('.') as [string, string];
    const flipped = (secret[0] === 'A' ? 'B' : 'A') + secret.slice(1);
    for (const token of [
      '',
      'client-a',
      `.${secret}`,
      `client-b.${secret}`,
      `${clientId}.${flipped}`,
      `${clientId}.${secret}x`,
      `${clientId}.${secret.slice(0, -1)}`,
      `${clientId}.${secret}=`,
      `${clientId}.${Buffer.from(secret, 'base64url').toString('base64')}`,
    ]) {
      expect(pairing.verify(token), token).toBeNull();
    }
    expect(pairing.verify(outcome.token)).not.toBeNull();
  });

  it('pairing code is invalid after expiry', () => {
    const clock = new ManualClock();
    const pairing = new Pairing([], { clock });
    const { code } = pairing.newCode();
    clock.advance(10 * MINUTE - 1);
    expect(pairing.state()).toMatchObject({ code });
    clock.advance(1);
    expect(pairing.state()).toBeNull();
    expect(pairing.pair(code, 'client-a', 'A')).toEqual({ ok: false, code: 'PAIRING_CODE_INVALID' });
  });

  it('5 wrong attempts lock for 10 minutes and invalidate the pairing code; after the lock expires a new pairing code is needed', () => {
    const clock = new ManualClock();
    const pairing = new Pairing([], { clock });
    const { code } = pairing.newCode();
    for (let i = 0; i < 4; i++) expect(pairing.pair(wrong(code), 'client-a', 'A')).toEqual({ ok: false, code: 'PAIRING_CODE_INVALID' });
    expect(pairing.state()).toMatchObject({ code });
    expect(pairing.pair(wrong(code), 'client-a', 'A')).toEqual({ ok: false, code: 'PAIRING_CODE_INVALID' });
    expect(pairing.state()).toEqual({ lockedUntil: new Date(clock.now() + 10 * MINUTE).toISOString() });

    // During the lockout, even the correct code is refused, and the caller is told how much longer to wait.
    clock.advance(3 * MINUTE);
    expect(pairing.pair(code, 'client-a', 'A')).toEqual({ ok: false, code: 'PAIRING_LOCKED', retryAfterMs: 7 * MINUTE });

    clock.advance(7 * MINUTE);
    expect(pairing.state()).toBeNull();
    // The old code is void.
    expect(pairing.pair(code, 'client-a', 'A')).toEqual({ ok: false, code: 'PAIRING_CODE_INVALID' });
    const fresh = pairing.newCode();
    expect(pairing.pair(fresh.code, 'client-a', 'A').ok).toBe(true);
  });

  it('generating a new pairing code lifts the lock and resets the count', () => {
    const clock = new ManualClock();
    const pairing = new Pairing([], { clock });
    const { code } = pairing.newCode();
    for (let i = 0; i < 5; i++) pairing.pair(wrong(code), 'client-a', 'A');
    expect(pairing.state()).toHaveProperty('lockedUntil');
    const fresh = pairing.newCode();
    expect(pairing.state()).toMatchObject({ code: fresh.code });
    for (let i = 0; i < 4; i++) pairing.pair(wrong(fresh.code), 'client-a', 'A');
    expect(pairing.pair(fresh.code, 'client-a', 'A').ok).toBe(true);
  });

  it('re-pairing the same clientId replaces the old token; token invalid after revocation', () => {
    const pairing = new Pairing([]);
    const first = pairing.pair(pairing.newCode().code, 'client-a', 'A');
    const second = pairing.pair(pairing.newCode().code, 'client-a', 'A2');
    if (!first.ok || !second.ok) throw new Error('配对失败');
    expect(pairing.verify(first.token)).toBeNull();
    expect(pairing.verify(second.token)).toMatchObject({ clientId: 'client-a', name: 'A2' });
    expect(pairing.clients()).toHaveLength(1);

    expect(pairing.revoke('client-a')).toBe(true);
    expect(pairing.revoke('client-a')).toBe(false);
    expect(pairing.verify(second.token)).toBeNull();
    expect(pairing.has('client-a')).toBe(false);
  });

  it('clients restored from persisted state can still use their original token', () => {
    const pairing = new Pairing([]);
    const outcome = pairing.pair(pairing.newCode().code, 'client-a', 'A');
    if (!outcome.ok) throw new Error('配对失败');
    const restored = new Pairing(JSON.parse(JSON.stringify(pairing.clients())));
    expect(restored.verify(outcome.token)).toMatchObject({ clientId: 'client-a' });
    expect(restored.state()).toBeNull();
  });
});
