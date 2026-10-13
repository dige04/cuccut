import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@agentclientprotocol/sdk';
import { silentLogger } from '@cuccut/harness';
import { createFakeAcp, type FakeAcp } from '../testing/fake-acp.ts';
import { AcpProcess } from './acp-connection.ts';

/**
 * When the agent process ends, the processes it spawned end with it (on POSIX, the whole process group). The fake agent, in the `helper` scenario, spawns a child process that ignores SIGTERM, like the rg that cursor-agent runs at startup. If only the agent itself is ended, that child is left behind as an orphan.
 */

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function until(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe.skipIf(process.platform === 'win32')('AcpProcess leaves no agent-spawned processes when it ends', () => {
  let dir: string;
  let fake: FakeAcp;
  const open: AcpProcess[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-acp-process-'));
    fake = await createFakeAcp(path.join(dir, 'fake'), { helper: true });
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((proc) => proc.close()));
    // Do not leave the test's own processes behind, even when an assertion fails.
    for (const pid of helpers()) if (alive(pid)) process.kill(pid, 'SIGKILL');
    await fs.rm(dir, { recursive: true, force: true });
  });

  const helpers = () => fake.log().flatMap((e) => (e.kind === 'start' && e.helper ? [e.helper] : []));

  async function start(): Promise<AcpProcess> {
    const install = (await fake.locate())!;
    const proc = await AcpProcess.start({
      command: install.command,
      args: ['acp'],
      cwd: dir,
      env: install.env,
      log: silentLogger,
      label: 'Fake',
      client: {} as Client,
    });
    open.push(proc);
    return proc;
  }

  it('close: spawned processes still alive after SIGTERM are force-killed; close waits until they all exit', async () => {
    const proc = await start();
    const [helper] = helpers();
    expect(alive(helper!)).toBe(true);

    await proc.close();
    expect(alive(helper!)).toBe(false);
    expect(alive(proc.child.pid!)).toBe(false);
  });

  it('agent exits on its own: processes it left behind are force-killed immediately, without waiting for close', async () => {
    const proc = await start();
    const [helper] = helpers();
    // The fake agent exits when stdin is closed.
    proc.child.stdin!.end();
    expect(await proc.exited).toBeNull();
    await until(() => !alive(helper!), 2_000);
  });

  it('exits before initialize: start fails, and the processes it spawned have also ended', async () => {
    fake.scenario({ exitOnInitialize: true });
    await expect(start()).rejects.toThrow();
    const [helper] = helpers();
    expect(helper).toBeDefined();
    expect(alive(helper!)).toBe(false);
  });
});
