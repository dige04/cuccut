import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentModeLabel, localizeText, refOf, RpcError, setLocale } from '@cuccut/protocol';
import { HarnessRuns } from '@cuccut/protocol/messages/harness';
import { DriverRegistry } from './agent-manager.ts';

/** When the UI language is English, the Harness messages written for people, errors and session notices are in English, with message refs (they can be regenerated after the UI language changes). */
describe('harness English copy', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('unregistered Agent: English error includes a reference', () => {
    let caught: unknown;
    try {
      new DriverRegistry().get('nope');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RpcError);
    expect((caught as RpcError).message).toBe('No Agent is registered with id nope');
    expect((caught as RpcError).messageRef?.key).toBe('harnessAgents.noDriver');
  });

  it('mode switch hint: the mode name is passed as a parameter, and after switching back to Chinese it is regenerated from the reference', () => {
    const text = HarnessRuns.modeChanged({ to: agentModeLabel('fullAccess'), from: agentModeLabel('auto') });
    expect(text.text).toContain('"Full access"');
    expect(text.text).not.toMatch(/[一-龥]/);
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
    expect(localizeText(text.text, refOf(text))).toMatch(/[一-龥]/);
  });
});
