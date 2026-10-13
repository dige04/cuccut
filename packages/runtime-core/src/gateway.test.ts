import net from 'node:net';
import { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { PROTOCOL_VERSION, RUNTIME_VERSION, type RuntimeInfo } from '@cuccut/protocol';
import { Gateway } from './gateway.ts';
import type { RpcHandlers } from './handlers.ts';

const runtime: RuntimeInfo = {
  instanceId: 'rt_test',
  epoch: 'rt_test',
  runtimeVersion: RUNTIME_VERSION,
  protocolVersion: PROTOCOL_VERSION,
  home: '/nonexistent',
  projectsDir: '/nonexistent/projects',
  logsDir: '/nonexistent/logs',
  pid: process.pid,
  startedAt: new Date().toISOString(),
  launchedBy: null,
};

function newGateway(): Gateway {
  return new Gateway({ token: 'token', runtime, handlers: {} as RpcHandlers, log: silentLogger });
}

/** Not settled within the deadline counts as a failure: before the fix, a listen failure left the Promise pending forever. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${ms} 毫秒内没有落定`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type HandleCounts = { servers: number; timers: number };

/** Number of live listening ports and timers in this process. */
function handleCounts(): HandleCounts {
  const info = process.getActiveResourcesInfo();
  return { servers: info.filter((t) => t === 'TCPServerWrap').length, timers: info.filter((t) => t === 'Timeout').length };
}

/** Closing a handle takes effect only on the next turn of the event loop: wait until the counts match, or if the deadline passes, report the last count. */
async function settledCounts(expected: HandleCounts, ms = 1_000): Promise<HandleCounts> {
  const deadline = Date.now() + ms;
  for (;;) {
    await new Promise((resolve) => setImmediate(resolve));
    const counts = handleCounts();
    if ((counts.servers === expected.servers && counts.timers === expected.timers) || Date.now() > deadline) return counts;
  }
}

describe('网关', () => {
  it('rejects unlisted development origins while opaque desktop origins still require the token', async () => {
    const gateway = newGateway();
    const endpoint = await gateway.listen();
    async function connect(origin: string, token = 'token') {
      const socket = new WebSocket(endpoint, { origin });
      const result = within(new Promise<Record<string, unknown>>((resolve, reject) => {
        socket.once('error', reject);
        socket.once('open', () => socket.send(JSON.stringify({
          type: 'hello', token, protocolVersion: PROTOCOL_VERSION,
          client: { kind: 'desktop', name: 'fixture', version: RUNTIME_VERSION },
        })));
        socket.once('message', (data) => resolve(JSON.parse(data.toString())));
        socket.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      }), 2_000);
      try {
        return await result;
      } finally {
        socket.terminate();
      }
    }
    try {
      expect(await connect('http://localhost:5174')).toEqual({ code: 1008, reason: 'origin not allowed' });
      expect(await connect('null')).toMatchObject({ type: 'welcome' });
      expect(await connect('null', 'wrong-token')).toMatchObject({ type: 'fatal', error: { code: 'unauthenticated' } });
    } finally {
      await gateway.close();
    }
  });

  it('端口被占用：listen 带着原始错误拒绝，不留下监听或心跳定时器', async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const taken = (blocker.address() as net.AddressInfo).port;
    try {
      const before = await settledCounts({ servers: 1, timers: 0 });
      const gateway = newGateway();
      const error = await within(gateway.listen('127.0.0.1', taken), 2_000).then(
        () => null,
        (e: unknown) => e as NodeJS.ErrnoException,
      );
      expect(error).toMatchObject({ code: 'EADDRINUSE' });
      expect(error?.message).toContain(String(taken));
      expect(await settledCounts(before)).toEqual(before);
      // close is also safe after a failure.
      await gateway.close();
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });

  it('监听成功后 close 释放端口与心跳定时器', async () => {
    const before = await settledCounts({ servers: 0, timers: 0 });
    const gateway = newGateway();
    const endpoint = await gateway.listen('127.0.0.1', 0);
    expect(endpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
    const listening = { servers: before.servers + 1, timers: before.timers + 1 };
    expect(await settledCounts(listening)).toEqual(listening);
    await gateway.close();
    expect(await settledCounts(before)).toEqual(before);
  });
});
