import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { killProcessTree, taskkillPath } from './process-tree.ts';
import type { SpawnProcess } from './system-terminal.ts';

/** The Windows branch uses an injected spawn and platform and does not really call taskkill; the POSIX branch uses a real `sh` process group. */

function fakeChild(pid: number | undefined) {
  const kills: NodeJS.Signals[] = [];
  const kill = (signal?: NodeJS.Signals | number) => {
    kills.push(signal as NodeJS.Signals);
    return true;
  };
  return { kills, child: { pid, kill } };
}

function fakeSpawn(fail: 'error' | 'throw' | null = null) {
  const calls: { command: string; args: readonly string[]; options: SpawnOptions }[] = [];
  const spawnFn: SpawnProcess = (command, args, options) => {
    calls.push({ command, args, options });
    if (fail === 'throw') throw new Error('spawn EPERM');
    const proc = new EventEmitter() as ChildProcess;
    if (fail === 'error') setTimeout(() => proc.emit('error', new Error('spawn ENOENT')), 1);
    return proc;
  };
  return { calls, spawn: spawnFn };
}

describe('killProcessTree', () => {
  it('Windows: ends the whole tree with System32\'s taskkill /T /F', () => {
    const fake = fakeSpawn();
    const { child, kills } = fakeChild(4321);
    killProcessTree(child, 'SIGTERM', { platform: 'win32', spawn: fake.spawn, env: { SystemRoot: 'D:\\Win' } });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.command).toBe('D:\\Win\\System32\\taskkill.exe');
    expect(fake.calls[0]!.args).toEqual(['/PID', '4321', '/T', '/F']);
    expect(fake.calls[0]!.options).toMatchObject({ stdio: 'ignore', windowsHide: true });
    expect(kills).toEqual([]);
  });

  it('Windows: falls back to ending the direct child process when taskkill cannot start', async () => {
    const errored = fakeSpawn('error');
    const a = fakeChild(1);
    killProcessTree(a.child, 'SIGKILL', { platform: 'win32', spawn: errored.spawn, env: {} });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(a.kills).toEqual(['SIGKILL']);

    const thrown = fakeSpawn('throw');
    const b = fakeChild(2);
    killProcessTree(b.child, 'SIGTERM', { platform: 'win32', spawn: thrown.spawn, env: {} });
    expect(b.kills).toEqual(['SIGTERM']);
  });

  it('does not call taskkill when there is no pid (failed to start)', () => {
    const fake = fakeSpawn();
    const { child, kills } = fakeChild(undefined);
    killProcessTree(child, 'SIGTERM', { platform: 'win32', spawn: fake.spawn });
    expect(fake.calls).toEqual([]);
    expect(kills).toEqual(['SIGTERM']);
  });

  it('taskkill path: uses C:\\Windows when neither SystemRoot nor windir is set', () => {
    expect(taskkillPath({ windir: 'E:\\W' })).toBe('E:\\W\\System32\\taskkill.exe');
    expect(taskkillPath({})).toBe('C:\\Windows\\System32\\taskkill.exe');
  });

  it.skipIf(process.platform === 'win32')('POSIX: signal is sent to the whole process group, grandchild processes end too', async () => {
    const child = spawn('/bin/sh', ['-c', 'sleep 30 & echo $!; wait'], { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
    const grandchild = await new Promise<number>((resolve) => child.stdout!.once('data', (chunk: Buffer) => resolve(Number(String(chunk).trim()))));
    const closed = new Promise((resolve) => child.once('close', resolve));
    killProcessTree(child, 'SIGKILL');
    await closed;
    let alive = true;
    for (let i = 0; i < 50 && alive; i++) {
      try {
        process.kill(grandchild, 0);
        await new Promise((resolve) => setTimeout(resolve, 20));
      } catch {
        alive = false;
      }
    }
    expect(alive).toBe(false);
  });
});
