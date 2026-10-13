import { describe, expect, it } from 'vitest';
import { BUILTIN_DRIVER_IDS, isBuiltinDriverId, isDriverId } from './domain.ts';
import { methodParamSchemas } from './schemas.ts';
import { WEB_DEFAULT_METHODS, WEB_READ_METHODS } from './web.ts';

describe('DriverId', () => {
  it('the nine built-in engines: the five permanently in the main list, plus the four connected via ACP', () => {
    expect(BUILTIN_DRIVER_IDS).toEqual(['claude', 'codex', 'copilot', 'pi', 'opencode', 'gemini', 'cursor', 'grok', 'kimi']);
    expect(isBuiltinDriverId('pi')).toBe(true);
    expect(isBuiltinDriverId('my-agent')).toBe(false);
  });

  it('protocol parameters accept built-in and well-formed custom ids, reject malformed ones (whether registered is decided by the Runtime)', () => {
    const setDefault = methodParamSchemas['agents.setDefault'];
    for (const driverId of BUILTIN_DRIVER_IDS) expect(setDefault.safeParse({ driverId }).success).toBe(true);
    expect(setDefault.safeParse({ driverId: 'my-agent2' }).success).toBe(true);
    for (const driverId of ['', 'OpenCode', '1abc', '-abc', 'a_b', 'a.b', 'a b', 'a'.repeat(64)]) {
      expect(setDefault.safeParse({ driverId }).success, driverId).toBe(false);
      expect(isDriverId(driverId)).toBe(false);
    }
  });

  it('agents.addProvider: custom id must not clash with a built-in one, command has at least one element, environment variable names are valid', () => {
    const add = methodParamSchemas['agents.addProvider'];
    const ok = { id: 'gemini-pinned', name: 'Gemini 0.52', command: ['npx', '-y', '@google/gemini-cli@0.52.0', '--acp'] };
    expect(add.safeParse(ok).success).toBe(true);
    expect(add.safeParse({ ...ok, env: { GEMINI_API_KEY: 'x' } }).success).toBe(true);
    expect(add.safeParse({ ...ok, id: 'gemini' }).success).toBe(false);
    expect(add.safeParse({ ...ok, id: 'Bad_Id' }).success).toBe(false);
    expect(add.safeParse({ ...ok, command: [] }).success).toBe(false);
    expect(add.safeParse({ ...ok, command: [''] }).success).toBe(false);
    expect(add.safeParse({ ...ok, name: '  ' }).success).toBe(false);
    expect(add.safeParse({ ...ok, env: { 'BAD-NAME': 'x' } }).success).toBe(false);
    expect(add.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(methodParamSchemas['agents.removeProvider'].safeParse({ id: 'gemini-pinned' }).success).toBe(true);
  });

  it('adding and removing are not exposed to the browser: it decides which commands run on this computer, the settings page in the browser only says to go to the desktop app', () => {
    for (const method of ['agents.addProvider', 'agents.removeProvider']) {
      expect(WEB_DEFAULT_METHODS).not.toContain(method);
      expect(WEB_READ_METHODS).not.toContain(method);
    }
  });

  it('the profile is readable from the browser; its writes are desktop only, like settings', () => {
    expect(WEB_DEFAULT_METHODS).toContain('profile.get');
    expect(WEB_READ_METHODS).toContain('profile.get');
    for (const method of ['profile.saveAnswers', 'profile.writeFromAnswers', 'profile.setPreferences', 'profile.putRule', 'profile.removeRule', 'profile.reorderRules']) {
      expect(WEB_DEFAULT_METHODS).not.toContain(method);
      expect(WEB_READ_METHODS).not.toContain(method);
    }
  });
});
