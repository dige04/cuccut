import { spawn, type StdioOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { stopChild } from './stop-child.ts';

/** Starts a Node child process running `source`; when `ipc` is true it gets an IPC channel (as the main process does when it starts the Runtime). Returns once it reports ready. */
async function child(source: string, ipc: boolean) {
  const stdio: StdioOptions = ['ignore', 'pipe', 'ignore', ...(ipc ? (['ipc'] as const) : [])];
  const proc = spawn(process.execPath, ['-e', `${source}; setInterval(() => {}, 1000); process.stdout.write('ready\\n');`], { stdio });
  await new Promise<void>((resolve) => proc.stdout!.once('data', () => resolve()));
  return proc;
}

describe('stopChild', () => {
  it('asks the child to stop over IPC and waits for it to exit on its own', async () => {
    const proc = await child(`process.on('message', (m) => m.type === 'stop' && setTimeout(() => process.exit(7), 50))`, true);
    expect(await stopChild(proc, 5_000)).toBe('exited');
    expect(proc.exitCode).toBe(7);
  });

  it('kills a child that ignores the request once the grace period ends', async () => {
    const proc = await child(`process.on('message', () => {})`, true);
    const started = performance.now();
    expect(await stopChild(proc, 200)).toBe('killed');
    expect(performance.now() - started).toBeGreaterThanOrEqual(190);
  });

  it('falls back to SIGTERM without an IPC channel', async () => {
    const proc = await child(`process.on('SIGTERM', () => process.exit(0))`, false);
    expect(await stopChild(proc, 5_000)).toBe('exited');
  });

  it('returns at once for a child that already exited', async () => {
    const proc = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
    await new Promise((resolve) => proc.once('exit', resolve));
    expect(await stopChild(proc, 5_000)).toBe('exited');
  });
});
