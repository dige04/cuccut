import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import { DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import { silentLogger } from '@cuccut/harness';
import { ACP_PRESETS, loginAdvice } from './acp/acp-presets.ts';
import { describeClaudeAccount } from './claude/claude-binary.ts';
import { ClaudeDriver } from './claude/claude-driver.ts';
import { describeCodexAccount } from './codex/codex-binary.ts';
import { CodexDriver } from './codex/codex-driver.ts';
import { OpenCodeDriver } from './opencode/opencode-driver.ts';
import { PiDriver } from './pi/pi-driver.ts';
import { piAccessWarning } from './pi/pi-session.ts';

/** When the UI language is English, the text the Driver writes for people (probe notes, account, install method, session hints) is in English and carries message references. */
describe('agent-drivers English copy', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('common copy', () => {
    expect(String(DriversCommon.turnInProgress())).toBe("The previous turn hasn't finished yet");
    expect(String(DriversCommon.resumeFailed({ name: 'Codex', error: '' }))).not.toMatch(/[一-龥]/);
  });

  it('account description', () => {
    expect(describeClaudeAccount({ authMethod: 'claude.ai', subscriptionType: 'pro' } as never)).toBe('Claude Pro subscription');
    expect(describeCodexAccount('Logged in using ChatGPT')).toBe('ChatGPT account');
    expect(describeCodexAccount('Logged in using an API key - sk-***')).toBe('OpenAI API key');
  });

  it('preset tables follow the current language: subscription notes, install methods, login hints', () => {
    expect(String(ACP_PRESETS.cursor.plan)).toBe('Cursor subscription');
    expect(ACP_PRESETS.cursor.install?.[0]).toMatchObject({ label: 'Official script', labelRef: { key: 'driversCommon.officialScript' } });
    expect(String(loginAdvice(ACP_PRESETS.copilot))).not.toMatch(/[一-龥]/);
    expect(String(piAccessWarning())).toContain('"Full access"');
  });

  it('describe() plan carries planRef', () => {
    const claude = new ClaudeDriver(silentLogger).describe();
    expect(claude.plan).toBe('Claude Pro or Max subscription');
    expect(claude.planRef).toMatchObject({ key: 'driversClaude.plan' });
    expect(new CodexDriver(silentLogger).describe()).toMatchObject({
      plan: 'ChatGPT Plus or Pro subscription',
      planRef: { key: 'driversCodex.plan' },
    });
  });

  it('probe explanation when not installed is in English, with detailRef', async () => {
    const locate = async () => null;
    const codex = await new CodexDriver(silentLogger, { locate }).probe();
    expect(codex.detail).toBe("Couldn't find the codex command. Install Codex CLI, or set its location in Settings.");
    expect(codex.detailRef).toMatchObject({ key: 'driversCommon.commandMissing' });
    const opencode = await new OpenCodeDriver(silentLogger, { locate }).probe();
    expect(opencode.detail).toContain('Install 2.x with npm install -g @opencode/cli');
    const pi = await new PiDriver(silentLogger, { locate }).probe();
    expect(pi.detail).not.toMatch(/[一-龥]/);
    expect(pi.planRef).toMatchObject({ key: 'driversPi.plan' });
  });
});
