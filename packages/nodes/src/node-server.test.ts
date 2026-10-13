import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NodeErrorBody, NodeHealth, NodePairResponse } from '@cuccut/protocol';
import type { NodeJobs } from './node-jobs.ts';
import { createNodeRequestHandler, parseRange } from './node-server.ts';

/**
 * Order of the three gates (spec §2): source → version → token. The health check passes neither the version gate nor the token gate; pairing passes the version gate but not the token gate.
 * The service listens only on 127.0.0.1. The source address is rewritten before the handler runs, to simulate a peer on another subnet.
 */

const GOOD_TOKEN = 'client-a.good';

describe('three gates for request handling', () => {
  let server: http.Server;
  let baseUrl: string;
  let remoteAddress: string;
  let allowAnySource: boolean;
  let calls: string[];

  beforeEach(async () => {
    remoteAddress = '192.168.1.20';
    allowAnySource = false;
    calls = [];
    const jobs = {
      get: (clientId: string, jobId: string) => {
        calls.push(`get ${clientId} ${jobId}`);
        return { jobId };
      },
    } as unknown as NodeJobs;
    const handler = createNodeRequestHandler({
      jobs,
      health: async () => {
        calls.push('health');
        return { schema: 'cuccut.node-health/v1' } as NodeHealth;
      },
      pair: async (code, clientId) => {
        calls.push(`pair ${code} ${clientId}`);
        return { nodeId: 'node_1', name: 'n', token: `${clientId}.x` } satisfies NodePairResponse;
      },
      authenticate: (token) => (token === GOOD_TOKEN ? 'client-a' : null),
      allowAnySource: () => allowAnySource,
    });
    server = http.createServer((request, response) => {
      Object.defineProperty(request.socket, 'remoteAddress', { value: remoteAddress, configurable: true });
      handler(request, response);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const send = async (pathname: string, headers: Record<string, string> = {}, init: RequestInit = {}) => {
    const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: text ? (JSON.parse(text) as NodeErrorBody & Record<string, unknown>) : null,
    };
  };
  const V = { 'X-CucCut-Node-Protocol': '1' };
  const AUTH = { authorization: `Bearer ${GOOD_TOKEN}` };
  const pairInit: RequestInit = { method: 'POST', body: JSON.stringify({ code: '123456', clientId: 'client-a', clientName: 'A' }) };

  it('source gate first: disallowed sources are rejected even for health checks, and version and token are not checked', async () => {
    remoteAddress = '8.8.8.8';
    for (const [pathname, headers, init] of [
      ['/v1/health', {}, {}],
      ['/v1/pair', {}, pairInit],
      ['/v1/jobs/job_1', {}, {}],
      ['/v1/jobs/job_1', { ...V, ...AUTH }, {}],
      ['/nope', {}, {}],
    ] as const) {
      const response = await send(pathname, headers, init);
      expect(response.status, pathname).toBe(403);
      expect(response.body?.error.code).toBe('SOURCE_NOT_ALLOWED');
    }
    expect(calls).toEqual([]);
  });

  it('IPv4-mapped IPv6 sources are judged as IPv4', async () => {
    remoteAddress = '::ffff:10.0.0.5';
    expect((await send('/v1/health')).status).toBe(200);
    remoteAddress = '::ffff:8.8.8.8';
    expect((await send('/v1/health')).status).toBe(403);
  });

  it('with allowAnySource on, any source is allowed; the other two gates still apply', async () => {
    remoteAddress = '8.8.8.8';
    allowAnySource = true;
    expect((await send('/v1/health')).status).toBe(200);
    expect((await send('/v1/jobs/job_1', V)).status).toBe(401);
    expect((await send('/v1/jobs/job_1', { ...V, ...AUTH })).status).toBe(200);
  });

  it('version gate second: missing, too low or non-numeric gives 426, with the required version; health checks don\'t pass this gate', async () => {
    for (const headers of [
      {} as Record<string, string>,
      { 'X-CucCut-Node-Protocol': '0' },
      { 'X-CucCut-Node-Protocol': 'v1' },
      { 'X-CucCut-Node-Protocol': '1.5' },
    ]) {
      // The version is reported first even without a token.
      const response = await send('/v1/jobs/job_1', headers);
      expect(response.status).toBe(426);
      expect(response.body?.error).toMatchObject({ code: 'PROTOCOL_VERSION_UNSUPPORTED', details: { required: 1 } });
    }
    expect((await send('/v1/pair', {}, pairInit)).status).toBe(426);
    expect((await send('/v1/health')).status).toBe(200);
    // A higher version is not rejected (forward compatibility is governed by the node's minimum version).
    expect((await send('/v1/jobs/job_1', { 'X-CucCut-Node-Protocol': '2', ...AUTH })).status).toBe(200);
    expect(calls).toEqual(['health', 'get client-a job_1']);
  });

  it('token gate last: missing or invalid gives 401; pairing does not pass this gate', async () => {
    for (const headers of [
      V,
      { ...V, authorization: 'Bearer nope' },
      { ...V, authorization: GOOD_TOKEN },
      { ...V, authorization: 'Basic abc' },
    ]) {
      const response = await send('/v1/jobs/job_1', headers);
      expect(response.status).toBe(401);
      expect(response.body?.error.code).toBe('UNAUTHORIZED');
    }
    const paired = await send('/v1/pair', V, pairInit);
    expect(paired.status).toBe(200);
    expect(calls).toEqual(['pair 123456 client-a']);
  });

  it('after passing the three gates: unknown endpoint 404, unsupported method 405 (both INVALID_REQUEST)', async () => {
    const headers = { ...V, ...AUTH };
    const unknown = await send('/v1/nope', headers);
    expect(unknown.status).toBe(404);
    expect(unknown.body?.error.code).toBe('INVALID_REQUEST');
    const wrongMethod = await send('/v1/jobs/job_1/result', headers, { method: 'POST' });
    expect(wrongMethod.status).toBe(405);
    // Only GET /v1/health is exempt from the version and token gates; other methods pass all three gates as usual.
    expect((await send('/v1/health', {}, { method: 'POST' })).status).toBe(426);
    expect((await send('/v1/health', headers, { method: 'POST' })).status).toBe(405);
    // Without authentication, the same request is stopped first by the token gate.
    expect((await send('/v1/nope', V)).status).toBe(401);
  });

  it('malformed pairing request: 400', async () => {
    for (const body of ['{', JSON.stringify({ code: '123456', clientId: 'a.b', clientName: 'A' }), JSON.stringify({ code: '123456' })]) {
      const response = await send('/v1/pair', V, { method: 'POST', body });
      expect(response.status).toBe(400);
      expect(response.body?.error.code).toBe('INVALID_REQUEST');
    }
    expect(calls).toEqual([]);
  });
});

describe('Range parsing', () => {
  it.each([
    [undefined, 100, null],
    ['', 100, null],
    ['bytes=0-9', 100, { start: 0, end: 9 }],
    ['bytes=10-', 100, { start: 10, end: 99 }],
    ['bytes=90-200', 100, { start: 90, end: 99 }],
    ['bytes=-10', 100, { start: 90, end: 99 }],
    ['bytes=-200', 100, { start: 0, end: 99 }],
    ['bytes=99-99', 100, { start: 99, end: 99 }],
    ['bytes=100-', 100, 'unsatisfiable'],
    ['bytes=5-4', 100, 'unsatisfiable'],
    ['bytes=-0', 100, 'unsatisfiable'],
    ['bytes=0-', 0, 'unsatisfiable'],
    ['bytes=-', 100, null],
    ['bytes=0-1,5-6', 100, null],
    ['items=0-1', 100, null],
  ] as const)('%s (%d bytes total)', (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
});
