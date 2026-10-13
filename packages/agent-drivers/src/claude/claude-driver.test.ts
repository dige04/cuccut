import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { createFakeClaude, createFakeClaudeCli, type FakeClaude, type FakeClaudeCli } from '../testing/fake-claude.ts';
import { claudeExec, claudeSearch, describeClaudeAccount, parseClaudeVersion, parseCmdShimTarget } from './claude-binary.ts';
import { ClaudeDriver } from './claude-driver.ts';
import { FALLBACK_CLAUDE_MODELS } from './claude-models.ts';
import { ClaudeSession } from './claude-session.ts';

/**
 * Claude Driver probing, against a fake claude (`--version`, `auth status`) and a fake Query (`supportedModels()`).
 * It never starts the real claude on this machine.
 */

describe('ClaudeDriver probe (fake claude)', () => {
  let dir: string;
  let cli: FakeClaudeCli;
  let fake: FakeClaude;
  let settingsFile: string;
  let driver: ClaudeDriver;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-claude-driver-'));
    cli = await createFakeClaudeCli(path.join(dir, 'fake'));
    fake = createFakeClaude();
    settingsFile = path.join(dir, 'settings.json');
    driver = new ClaudeDriver(silentLogger, { locate: cli.locate, queryFactory: fake.factory, settingsFile });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reports status by priority: not installed, error, too old, signed out, ready', async () => {
    cli.scenario({ installed: false });
    expect(await driver.probe()).toMatchObject({ state: 'not-installed', status: 'unavailable', unavailableReason: 'not-installed', version: null });

    cli.scenario({ installed: true, version: null });
    expect(await driver.probe()).toMatchObject({ state: 'error', status: 'unavailable', version: null, executable: cli.command });

    cli.scenario({ version: '1.0.99' });
    expect(await driver.probe()).toMatchObject({ state: 'outdated', unavailableReason: 'unsupported', version: '1.0.99', minVersion: '2.0.0' });

    cli.scenario({ version: '2.1.284', auth: { loggedIn: false, authMethod: 'none', apiProvider: 'firstParty' } });
    const signedOut = await driver.probe();
    expect(signedOut).toMatchObject({ state: 'signed-out', unavailableReason: 'not-connected', version: '2.1.284', account: null });
    // The model table is still available when not logged in.
    expect(signedOut.models.length).toBeGreaterThan(0);

    cli.scenario({ auth: { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max', email: 'someone@example.com' } });
    const ready = await driver.probe();
    expect(ready).toMatchObject({
      state: 'ready',
      status: 'available',
      unavailableReason: null,
      account: 'Claude Max 订阅',
      plan: 'Claude Pro 或 Max 订阅',
      loginCommand: 'claude',
      capabilities: { steer: true, approvals: true, resume: true, images: true },
      realExecutable: await fs.realpath(cli.command),
    });
    // The account description has no email.
    expect(JSON.stringify(ready)).not.toContain('someone@example.com');
    expect(ready.install.map((i) => [i.kind, i.command, i.upgrade])).toEqual([
      ['script', 'curl -fsSL https://claude.ai/install.sh | bash', 'claude update'],
      ['brew', 'brew install --cask claude-code', 'brew upgrade --cask claude-code'],
      ['npm', 'npm install -g @anthropic-ai/claude-code', 'npm install -g @anthropic-ai/claude-code@latest'],
    ]);
    expect(cli.calls()).toContainEqual(['auth', 'status']);
  });

  it('old version without auth status: not blocked, account unknown', async () => {
    cli.scenario({ auth: null });
    expect(await driver.probe()).toMatchObject({ state: 'ready', account: null });
  });

  it('the specified executable does not exist: not installed, does not search elsewhere', async () => {
    const missing = path.join(dir, 'nope', 'claude');
    expect(await driver.probe({ executable: missing })).toMatchObject({ state: 'not-installed', executable: missing });
    expect((await driver.probe({ executable: missing })).detail).toContain(missing);
  });

  it('model table comes from supportedModels(): the default row is not listed separately, the model it points to is marked as default; tier, effort; closes after the query; the same claude is not queried again', async () => {
    const probe = await driver.probe();
    expect(probe.models.map((m) => [m.id, m.label, m.tier, m.isDefault])).toEqual([
      ['opus', 'Opus 5.5', 'max', true],
      ['claude-fable-5-1[1m]', 'Fable 5.1', 'max', false],
      ['sonnet', 'Sonnet 5.5', 'balanced', false],
      ['haiku', 'Haiku 4.5', 'fast', false],
    ]);
    const opus = probe.models[0]!;
    expect(opus.description).toBe('Best for everyday, complex tasks · $4/$20 per Mtok');
    expect(opus.efforts.map((e) => e.id)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(opus.defaultEffort).toBeNull();
    expect(probe.models[3]!.efforts).toEqual([]);
    expect(probe.models[0]).not.toHaveProperty('resolvedModel');

    expect(fake.queries).toHaveLength(1);
    const query = fake.last();
    expect(query.options).toMatchObject({
      pathToClaudeCodeExecutable: cli.command,
      settingSources: ['user'],
      settings: { disableAllHooks: true },
      managedSettings: { allowManagedPermissionRulesOnly: true },
      persistSession: false,
    });
    expect(query.closed).toBe(true);
    expect(query.inputs).toEqual([]);

    await driver.probe();
    expect(fake.queries).toHaveLength(1);
  });

  it('model table has no expiry: never re-queried however long passes; re-queried only after a version change, a settings.json change or re-detection', async () => {
    await driver.probe();
    expect(fake.queries).toHaveLength(1);

    const later = Date.now() + 24 * 60 * 60_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await driver.probe();
      expect(fake.queries).toHaveLength(1);
    } finally {
      now.mockRestore();
    }

    cli.scenario({ version: '2.1.300' });
    await driver.probe();
    expect(fake.queries).toHaveLength(2);

    await fs.writeFile(settingsFile, JSON.stringify({ env: {} }));
    await driver.probe();
    expect(fake.queries).toHaveLength(3);
    await driver.probe();
    expect(fake.queries).toHaveLength(3);

    await driver.probe({ force: true });
    expect(fake.queries).toHaveLength(4);
  });

  it('when the model table cannot be fetched, falls back to the built-in reduced table, and the failure is not cached', async () => {
    let calls = 0;
    const failing = new ClaudeDriver(silentLogger, {
      locate: cli.locate,
      settingsFile,
      queryFactory: (params) => {
        calls += 1;
        const query = fake.factory(params);
        query.supportedModels = () => Promise.reject(new Error('spawn failed'));
        return query;
      },
    });
    const probe = await failing.probe();
    expect(probe.state).toBe('ready');
    expect(probe.models.map((m) => m.id)).toEqual(FALLBACK_CLAUDE_MODELS.map((m) => m.id));
    await failing.probe();
    expect(calls).toBe(2);
  });

  it('configModel reads model from settings.json and marks whether it is in the model table', async () => {
    expect(await driver.probe()).toMatchObject({ configModel: null, configModelKnown: null });
    await fs.writeFile(settingsFile, JSON.stringify({ model: 'sonnet' }));
    expect(await driver.probe()).toMatchObject({ configModel: 'sonnet', configModelKnown: true });
    await fs.writeFile(settingsFile, JSON.stringify({ model: 'claude-opus-5-5[1m]' }));
    expect(await driver.probe()).toMatchObject({ configModel: 'claude-opus-5-5[1m]', configModelKnown: true });
    await fs.writeFile(settingsFile, JSON.stringify({ model: 'claude-opus-3' }));
    expect(await driver.probe()).toMatchObject({ configModel: 'claude-opus-3', configModelKnown: false });
    await fs.writeFile(settingsFile, '{ not json');
    expect(await driver.probe()).toMatchObject({ configModel: null, configModelKnown: null });
  });

  it('models specified in settings.json env are merged into the model table: existing ones are not duplicated, tiers are matched by name or by the tier they replace; configModelKnown still checks against the CLI table', async () => {
    await fs.writeFile(
      settingsFile,
      JSON.stringify({
        model: 'gateway-main',
        env: {
          ANTHROPIC_MODEL: 'gateway-main',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'corp-sonnet-proxy',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: '  ',
          ANTHROPIC_SMALL_FAST_MODEL: 'tiny',
          OTHER: 'x',
        },
      }),
    );
    const probe = await driver.probe();
    expect(probe.models.map((m) => [m.id, m.tier])).toEqual([
      ['opus', 'max'],
      ['claude-fable-5-1[1m]', 'max'],
      ['sonnet', 'balanced'],
      ['haiku', 'fast'],
      // claude-opus-5-5 is the full id that opus resolves to, so it is not listed twice.
      ['gateway-main', null],
      ['corp-sonnet-proxy', 'balanced'],
    ]);
    expect(probe.models.at(-1)).toMatchObject({
      label: 'corp-sonnet-proxy',
      description: '来自 Claude Code 设置（env.ANTHROPIC_DEFAULT_SONNET_MODEL）',
      isDefault: false,
      efforts: [],
      defaultEffort: null,
    });
    expect(probe).toMatchObject({ configModel: 'gateway-main', configModelKnown: false });
  });

  it('createSession: reports driver-unavailable when claude is not found; does not start a process immediately when found', async () => {
    cli.scenario({ installed: false });
    await expect(
      driver.createSession({ cwd: dir, accessMode: 'ask', model: null, effort: null, resume: null }),
    ).rejects.toMatchObject({ code: 'driver-unavailable' });
    cli.scenario({ installed: true });
    const session = await driver.createSession({ cwd: dir, accessMode: 'ask', model: null, effort: null, resume: null });
    expect(session).toBeInstanceOf(ClaudeSession);
    expect(fake.queries).toHaveLength(0);
    await session.close();
  });
});

describe('Claude version and account description', () => {
  it('parses --version', () => {
    expect(parseClaudeVersion('2.1.284 (Claude Code)\n')).toBe('2.1.284');
    expect(parseClaudeVersion('nonsense')).toBeNull();
  });

  it('gives an account description by sign-in method', () => {
    expect(describeClaudeAccount({ authMethod: 'claude.ai', subscriptionType: 'pro' })).toBe('Claude Pro 订阅');
    expect(describeClaudeAccount({ authMethod: 'claude.ai', subscriptionType: 'max' })).toBe('Claude Max 订阅');
    expect(describeClaudeAccount({ authMethod: 'claude.ai' })).toBe('Claude 账号');
    expect(describeClaudeAccount({ authMethod: 'api_key', apiProvider: 'firstParty' })).toBe('Anthropic API 密钥');
    expect(describeClaudeAccount({ authMethod: 'third_party', apiProvider: 'bedrock' })).toBe('Amazon Bedrock');
    expect(describeClaudeAccount({ authMethod: 'claude.ai', apiProvider: 'gateway' })).toBe('企业网关');
  });
});

describe('finding claude on Windows (pure function; not verified on Windows)', () => {
  it('file names and common locations: claude.exe and npm\'s claude.cmd; other platforms unchanged', () => {
    expect(claudeSearch('win32', { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'C:\\Users\\me')).toEqual({
      names: ['claude.exe', 'claude.cmd'],
      locations: ['C:\\Users\\me\\.local\\bin\\claude.exe', 'C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd'],
    });
    expect(claudeSearch('win32', {}, 'C:\\Users\\me').locations[1]).toBe('C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd');
    expect(claudeSearch('darwin', {}, '/Users/me')).toEqual({
      names: ['claude'],
      locations: ['/Users/me/.claude/local/claude', '/Users/me/.local/bin/claude', '/opt/homebrew/bin/claude', '/usr/local/bin/claude'],
    });
  });

  it('reads the file actually launched from the npm cmd-shim, skipping node.exe', () => {
    const js = [
      '@ECHO off',
      'GOTO start',
      ':find_dp0',
      'SET dp0=%~dp0',
      'EXIT /b',
      ':start',
      'SETLOCAL',
      'CALL :find_dp0',
      'IF EXIST "%dp0%\\node.exe" (',
      '  SET "_prog=%dp0%\\node.exe"',
      ') ELSE (',
      '  SET "_prog=node"',
      ')',
      'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*',
    ].join('\r\n');
    expect(parseCmdShimTarget(js, 'C:\\Users\\me\\AppData\\Roaming\\npm')).toBe(
      'C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js',
    );
    const exe = '@ECHO off\r\n"%~dp0\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n';
    expect(parseCmdShimTarget(exe, 'C:\\npm')).toBe('C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe');
    expect(parseCmdShimTarget('@ECHO off\r\nclaude %*', 'C:\\npm')).toBeNull();
  });

  it('.js entry is run by node, others run directly', () => {
    expect(claudeExec('C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js')).toEqual({
      file: 'node',
      args: ['C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js'],
    });
    expect(claudeExec('/usr/local/bin/claude')).toEqual({ file: '/usr/local/bin/claude', args: [] });
  });
});
