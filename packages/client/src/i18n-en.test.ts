import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError, setLocale } from '@cuccut/protocol';
import { CucCutClient } from './client.ts';

/** When the UI language is English, the connection errors the client writes itself are in English, and include a message reference. */
describe('client English copy', () => {
  beforeEach(() => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('requests after close: English error with a reference', async () => {
    const client = new CucCutClient({
      resolve: async () => ({ endpoint: 'ws://127.0.0.1:1', token: 't' }),
      client: { kind: 'cli', name: 'test', version: '0' },
      reconnect: false,
    });
    client.close();
    const error = await client.request('runtime.info' as never, {} as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).message).toBe('The client is closed');
    expect((error as RpcError).messageRef?.key).toBe('clientConnection.closed');
  });
});
