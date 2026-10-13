import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient, applyAgentSetupEvent } from '@cuccut/client';
import type { AgentDriver, AgentSession } from '@cuccut/harness';
import { RpcError, newId, type AgentSetupRun, type AgentSetupSnapshot, type DriverProbe } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { fakeProbe, until } from './agent-tools/testing/fake-agent.ts';
import { startRuntime, type RunningRuntime } from './runtime.ts';

/**
 * End to end (architecture design §12.9): real Runtime, gateway and client, with the Driver's probe results replaced by fakes. The install command points to a small script in a temporary directory, which prints a few lines and exits 0 or non-zero depending on the scenario. It does not touch brew, npm, curl or the network. The system terminal is replaced by a fake that records calls, so no terminal actually opens.
 */

class SetupDriver implements AgentDriver {
  readonly id = 'codex' as const;
  readonly dir: string;
  probes = 0;

  constructor(dir: string) {
    this.dir = dir;
  }

  /** The version is read from a marker file in the temporary directory. The install script writes it, so re-probing sees the new version. */
  async probe(): Promise<DriverProbe> {
    this.probes++;
    const version = await fs.readFile(path.join(this.dir, 'version'), 'utf8').catch(() => null);
    const script = (name: string) => `sh ${path.join(this.dir, name)}`;
    return {
      ...fakeProbe(),
      version: version?.trim() ?? null,
      loginCommand: 'fake login',
      install: [
        { kind: 'brew', label: 'Homebrew', needs: 'Homebrew', command: script('install-ok.sh'), upgrade: script('upgrade-fail.sh') },
        { kind: 'npm', label: 'npm', needs: 'Node.js', command: script('slow.sh'), upgrade: script('slow.sh') },
        { kind: 'script', label: '官方脚本', needs: null, command: 'curl -fsSL https://example.invalid/install.sh | bash', upgrade: 'fake update' },
      ],
    };
  }

  async createSession(): Promise<AgentSession> {
    throw new Error('这个测试不开会话');
  }
}

describe('agent install, upgrade and login (fake driver)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let driver: SetupDriver;
  let client: CucCutClient;
  let terminal: string[];
  let terminalStatus: 'opened' | 'unsupported';
  let mirror: AgentSetupSnapshot;
  let stop: () => void;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-setup-'));
    await fs.writeFile(path.join(dir, 'install-ok.sh'), `echo "==> 下载"\necho "警告" >&2\necho 2.0.0 > "${path.join(dir, 'version')}"\necho "==> 完成"\nexit 0\n`);
    await fs.writeFile(path.join(dir, 'upgrade-fail.sh'), `echo "Password:"\necho "sudo: a terminal is required" >&2\nexit 7\n`);
    await fs.writeFile(path.join(dir, 'slow.sh'), `echo start\nsleep 30\necho never\n`);
    driver = new SetupDriver(dir);
    terminal = [];
    terminalStatus = 'opened';
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
      agentSetup: {
        env: async () => ({ PATH: process.env.PATH }),
        openTerminal: async (command) => {
          terminal.push(command);
          return { status: terminalStatus, detail: terminalStatus === 'opened' ? null : '测试' };
        },
        flushMs: 10,
      },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'desktop', name: 'test', version: '0' }, reconnect: false });
    await client.connect();
    mirror = { runs: [] };
    stop = client.subscribeAgentSetup({
      snapshot: (snapshot) => (mirror = snapshot),
      event: (event) => (mirror = applyAgentSetupEvent(mirror, event)),
    });
  });

  afterEach(async () => {
    stop();
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function rejection(promise: Promise<unknown>): Promise<RpcError> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RpcError);
    return error as RpcError;
  }

  /** “Re-check”: forces a probe and returns only after the probe finishes (§3.11), so the next `agents.list` gives the new result. */
  async function detect() {
    await client.request('agents.detect', { driverId: 'codex' });
  }

  /** Waits for this run in the mirror to reach a terminal state. */
  function finished(runId: string): Promise<AgentSetupRun> {
    return until(() => {
      const run = mirror.runs.find((r) => r.runId === runId);
      return run && run.state !== 'running' ? run : null;
    });
  }

  it('install succeeds: output delivered line by line, exit code 0, re-probed before finishing, agents.list shows the new version', async () => {
    expect((await client.request('agents.list', {})).drivers[0]!.version).toBeNull();
    const probesBefore = driver.probes;
    const { run } = await client.request('agents.runSetup', { driverId: 'codex', action: 'install', kind: 'brew', commandId: newId('cmd') });
    expect(run).toMatchObject({ state: 'running', command: `sh ${path.join(dir, 'install-ok.sh')}`, action: 'install', kind: 'brew' });
    const done = await finished(run.runId);
    expect(done).toMatchObject({ state: 'completed', exitCode: 0, error: null });
    expect(done.output.filter((line) => line.startsWith('==>'))).toEqual(['==> 下载', '==> 完成']);
    expect(done.output).toContain('警告');
    expect(driver.probes).toBeGreaterThan(probesBefore);
    // When the terminal state arrives, the cache already holds the new probe result.
    expect((await client.request('agents.list', {})).drivers[0]!.version).toBe('2.0.0');
  });

  it('upgrade fails: non-zero exit code and output (including stderr)', async () => {
    const { run } = await client.request('agents.runSetup', { driverId: 'codex', action: 'upgrade', kind: 'brew', commandId: newId('cmd') });
    expect(run.command).toBe(`sh ${path.join(dir, 'upgrade-fail.sh')}`);
    const done = await finished(run.runId);
    expect(done).toMatchObject({ state: 'failed', exitCode: 7 });
    expect([...done.output].sort()).toEqual(['Password:', 'sudo: a terminal is required']);
  });

  it('cancel: the running command is ended, status cancelled; starting again on the same agent while running is busy; the same commandId returns the same run', async () => {
    const commandId = newId('cmd');
    const { run } = await client.request('agents.runSetup', { driverId: 'codex', action: 'install', kind: 'npm', commandId });
    await until(() => mirror.runs.find((r) => r.runId === run.runId)?.output.includes('start'));
    const again = await client.request('agents.runSetup', { driverId: 'codex', action: 'install', kind: 'npm', commandId });
    expect(again.run.runId).toBe(run.runId);
    expect((await rejection(client.request('agents.runSetup', { driverId: 'codex', action: 'install', kind: 'brew', commandId: newId('cmd') }))).code).toBe('busy');
    expect(await client.request('agents.cancelSetup', { runId: run.runId })).toEqual({ status: 'requested' });
    const done = await finished(run.runId);
    expect(done.state).toBe('cancelled');
    expect(done.output).not.toContain('never');
    expect(await client.request('agents.cancelSetup', { runId: run.runId })).toEqual({ status: 'not-running' });
    expect((await rejection(client.request('agents.cancelSetup', { runId: 'setup_nope' }))).code).toBe('not-found');
  });

  it('script kind, a method not in the probe, commands smuggled in arguments: all rejected, not run', async () => {
    const script = await rejection(client.request('agents.runSetup', { driverId: 'codex', action: 'install', kind: 'script', commandId: newId('cmd') }));
    expect(script.code).toBe('invalid-request');
    // Only codex is registered.
    expect((await rejection(client.request('agents.runSetup', { driverId: 'claude', action: 'install', kind: 'brew', commandId: newId('cmd') }))).code).toBe(
      'driver-unavailable',
    );
    const unknownKind = await rejection(
      client.request('agents.runSetup', { driverId: 'codex', action: 'install', kind: 'pip' as 'brew', commandId: newId('cmd') }),
    );
    expect(unknownKind.code).toBe('invalid-request');
    const smuggled = await rejection(
      client.request('agents.runSetup', {
        driverId: 'codex',
        action: 'install',
        kind: 'brew',
        commandId: newId('cmd'),
        command: 'rm -rf ~',
      } as never),
    );
    expect(smuggled.code).toBe('invalid-request');
    expect(mirror.runs).toEqual([]);
  });

  it('invalid-request when the probe result has no such method', async () => {
    const original = driver.probe.bind(driver);
    driver.probe = async () => ({ ...(await original()), install: [] });
    await detect();
    const error = await rejection(client.request('agents.runSetup', { driverId: 'codex', action: 'upgrade', kind: 'brew', commandId: newId('cmd') }));
    expect(error.code).toBe('invalid-request');
  });

  it('openTerminal: login uses loginCommand, install and upgrade take the command by kind (script kind also allowed); unsupported with the command returned when it cannot open', async () => {
    expect(await client.request('agents.openTerminal', { driverId: 'codex', action: 'login' })).toEqual({ status: 'opened', command: 'fake login' });
    expect(await client.request('agents.openTerminal', { driverId: 'codex', action: 'install', kind: 'script' })).toEqual({
      status: 'opened',
      command: 'curl -fsSL https://example.invalid/install.sh | bash',
    });
    expect(await client.request('agents.openTerminal', { driverId: 'codex', action: 'upgrade', kind: 'brew' })).toMatchObject({ status: 'opened' });
    expect(terminal).toEqual(['fake login', 'curl -fsSL https://example.invalid/install.sh | bash', `sh ${path.join(dir, 'upgrade-fail.sh')}`]);

    terminalStatus = 'unsupported';
    expect(await client.request('agents.openTerminal', { driverId: 'codex', action: 'login' })).toEqual({ status: 'unsupported', command: 'fake login' });

    expect((await rejection(client.request('agents.openTerminal', { driverId: 'codex', action: 'upgrade' }))).code).toBe('invalid-request');
    const original = driver.probe.bind(driver);
    driver.probe = async () => ({ ...(await original()), loginCommand: null });
    await detect();
    expect((await rejection(client.request('agents.openTerminal', { driverId: 'codex', action: 'login' }))).code).toBe('invalid-request');
  });

  it('ends still-running commands when the Runtime stops', async () => {
    const { run } = await client.request('agents.runSetup', { driverId: 'codex', action: 'upgrade', kind: 'npm', commandId: newId('cmd') });
    await until(() => mirror.runs.find((r) => r.runId === run.runId)?.output.includes('start'));
    const started = Date.now();
    await runtime.close();
    expect(Date.now() - started).toBeLessThan(6000);
  });
});
