import { describe, expect, it } from 'vitest';
import type { PublishBatch, PublishResult, UploadResult } from '../file-protocol.ts';
import { createEditorHost, createHttpBackend, encodeWireBatch, LOCAL_USER, readSessionCanEdit, type Backend } from './editor-host.ts';
import { flushEdits } from './index.ts';

/** Fake fetch that records requests and returns preset responses. */
function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  };
  return { impl, calls };
}

describe('encodeWireBatch', () => {
  it('strings converted to base64 as UTF-8, Blobs as raw bytes; contentType and ifMatch kept (null too)', async () => {
    const wire = await encodeWireBatch({
      'project/a.html': { content: '中文 ✓', contentType: 'text/html', ifMatch: 'a'.repeat(64) },
      'project/b.bin': { content: new Blob([new Uint8Array([0, 255])]), contentType: 'application/octet-stream' },
      'project/c.css': { content: 'a{}', contentType: 'text/css', ifMatch: null },
    });
    expect(wire.files['project/a.html']).toEqual({
      base64: Buffer.from('中文 ✓').toString('base64'),
      contentType: 'text/html',
      ifMatch: 'a'.repeat(64),
    });
    expect(wire.files['project/b.bin']).toEqual({ base64: 'AP8=', contentType: 'application/octet-stream', ifMatch: undefined });
    expect(wire.files['project/c.css']).toEqual({ base64: Buffer.from('a{}').toString('base64'), contentType: 'text/css', ifMatch: null });
  });

  it('delete items passed through unchanged', async () => {
    const wire = await encodeWireBatch({ 'project/x': { delete: true, ifMatch: 'b'.repeat(64) }, 'project/y': null });
    expect(wire.files).toEqual({ 'project/x': { delete: true, ifMatch: 'b'.repeat(64) }, 'project/y': null });
  });

  it('large file chunked encoding does not overflow the stack', async () => {
    const big = 'x'.repeat(200_000);
    const wire = await encodeWireBatch({ 'project/big.txt': { content: big, contentType: 'text/plain' } });
    const entry = wire.files['project/big.txt'];
    expect(entry && 'base64' in entry).toBe(true);
    if (entry && 'base64' in entry) expect(Buffer.from(entry.base64, 'base64').toString()).toBe(big);
  });
});

describe('createHttpBackend', () => {
  it('POST to <base>__deck/publish; on success returns the route\'s PublishResult', async () => {
    const result: PublishResult = { version: 'local-1', seq: 1, shas: {} };
    const { impl, calls } = fakeFetch(() => Response.json(result));
    const backend = createHttpBackend('/slides/g1/', impl);
    expect(await backend.publish({ 'project/a': { content: 'x', contentType: 'text/plain' } })).toEqual(result);
    expect(calls[0]!.url).toBe('/slides/g1/__deck/publish');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ files: { 'project/a': { base64: 'eA==', contentType: 'text/plain' } } });
  });

  it('when the route returns PublishError it is thrown unchanged; runtime handles it by code', async () => {
    const conflict = { code: 'conflict', live: 'v2', paths: [] };
    const { impl } = fakeFetch(() => Response.json(conflict, { status: 409 }));
    await expect(createHttpBackend('/', impl).publish({})).rejects.toEqual(conflict);
  });

  it('when the response is not a PublishError (e.g. a proxy\'s HTML error page) throws upstream_error', async () => {
    const { impl } = fakeFetch(() => new Response('<h1>Bad Gateway</h1>', { status: 502 }));
    await expect(createHttpBackend('/', impl).publish({})).rejects.toEqual({ code: 'upstream_error', message: 'publish failed: HTTP 502' });
  });

  it('upload uses options.type, then file.type as Content-Type, sent to <base>__deck/assets', async () => {
    const uploaded: UploadResult = { id: 'c'.repeat(32), url: `/_blob/${'c'.repeat(32)}` };
    const { impl, calls } = fakeFetch(() => Response.json(uploaded));
    const backend = createHttpBackend('/s/', impl);
    expect(await backend.upload(new Blob(['x'], { type: 'image/png' }))).toEqual(uploaded);
    await backend.upload(new Blob(['x'], { type: 'image/png' }), { type: 'image/webp' });
    expect(calls.map(c => c.url)).toEqual(['/s/__deck/assets', '/s/__deck/assets']);
    expect(calls.map(c => (c.init.headers as Record<string, string>)['Content-Type'])).toEqual(['image/png', 'image/webp']);
  });

  it('upload failure: PublishError thrown as is (read-only mode); not thrown as upstream_error', async () => {
    const readOnly = { code: 'not_writer', message: 'read only' };
    await expect(createHttpBackend('/', fakeFetch(() => Response.json(readOnly, { status: 403 })).impl).upload(new Blob(['x']))).rejects.toEqual(readOnly);
    await expect(createHttpBackend('/', fakeFetch(() => new Response(null, { status: 413 })).impl).upload(new Blob(['x']))).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });

  it('idle waits for all still-pending requests to finish; failed ones count as finished', async () => {
    const gates: (() => void)[] = [];
    const { impl } = fakeFetch(
      (url) => new Promise<Response>(resolve => gates.push(() => resolve(url.endsWith('publish') ? Response.json({ version: 'v' }) : new Response(null, { status: 500 })))),
    );
    const backend = createHttpBackend('/', impl);
    const publish = backend.publish({});
    const upload = backend.upload(new Blob(['x'])).catch(() => 'failed');
    let idle = false;
    const waiting = backend.idle().then(() => (idle = true));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(idle).toBe(false);
    for (const open of gates) open();
    await waiting;
    expect(idle).toBe(true);
    await publish;
    expect(await upload).toBe('failed');
  });
});

describe('createEditorHost', () => {
  const makeBackend = () => {
    const batches: PublishBatch[] = [];
    const backend: Backend = {
      async publish(batch) {
        batches.push(batch);
        return { version: 'v' };
      },
      async upload() {
        return { id: 'd'.repeat(32), url: `/_blob/${'d'.repeat(32)}` };
      },
      async idle() {},
    };
    return { backend, batches };
  };

  it('single user; editable by default and can do everything', async () => {
    const host = createEditorHost(makeBackend().backend);
    expect(await host.user.id()).toBe(LOCAL_USER.id);
    expect(await host.user.canEdit()).toBe(true);
    expect(await host.user.can('comment')).toBe(true);
    expect(await host.user.profiles([LOCAL_USER.id, 'someone'])).toEqual({
      [LOCAL_USER.id]: { name: LOCAL_USER.name },
      someone: { name: 'someone' },
    });
  });

  it('in read-only mode canEdit and can are both false', async () => {
    const host = createEditorHost(makeBackend().backend, { canEdit: async () => false });
    expect(await host.user.canEdit()).toBe(false);
    expect(await host.user.can('edit')).toBe(false);
  });

  it('artifact.publish and self.publish both forwarded to the same backend; use() not provided; comments exist only when given', async () => {
    const { backend, batches } = makeBackend();
    const host = createEditorHost(backend);
    await host.artifact.publish({ 'project/a': null });
    await host.self.publish({ 'project/b': null });
    expect(batches).toEqual([{ 'project/a': null }, { 'project/b': null }]);
    expect((await host.assets.upload(new Blob())).id).toBe('d'.repeat(32));
    expect(host.use).toBeUndefined();
    expect(host.comments).toBeUndefined();
    const comments = { customAnchors: async () => ({}) as never };
    expect(createEditorHost(backend, { comments }).comments).toBe(comments);
  });
});

describe('readSessionCanEdit', () => {
  it('reads __deck/session once and caches it', async () => {
    const { impl, calls } = fakeFetch(() => Response.json({ canEdit: false }));
    const canEdit = readSessionCanEdit('/s/', impl);
    expect(await canEdit()).toBe(false);
    expect(await canEdit()).toBe(false);
    expect(calls.map(c => c.url)).toEqual(['/s/__deck/session']);
  });

  it('when it can\'t be read, treated as editable', async () => {
    expect(await readSessionCanEdit('/', fakeFetch(() => new Response(null, { status: 404 })).impl)()).toBe(true);
    expect(await readSessionCanEdit('/', async () => Promise.reject(new Error('offline')))()).toBe(true);
  });
});

describe('flushEdits', () => {
  /** A fake window: when there are unsaved changes, beforeunload is canceled and a publish starts. */
  function fakeEditor(rounds: number, publishMs = 5) {
    const target = new EventTarget();
    let left = rounds;
    let inflight: Promise<void> | null = null;
    target.addEventListener('beforeunload', event => {
      if (left === 0) return;
      event.preventDefault();
      inflight ??= new Promise<void>(resolve =>
        setTimeout(() => {
          left -= 1;
          inflight = null;
          resolve();
        }, publishMs),
      );
    });
    const backend: Backend = {
      publish: async () => ({ version: 'v' }),
      upload: async () => ({ id: '', url: '' }),
      idle: async () => {
        await inflight;
      },
    };
    return { win: target as unknown as Window & typeof globalThis, backend };
  }

  it('with no unsaved changes, returns true immediately', async () => {
    const { win, backend } = fakeEditor(0);
    expect(await flushEdits(win, backend)).toBe(true);
  });

  it('with changes, waits for publishing to finish before asking, until no longer dirty', async () => {
    const { win, backend } = fakeEditor(2);
    expect(await flushEdits(win, backend)).toBe(true);
  });

  it('returns false on timeout', async () => {
    const { win, backend } = fakeEditor(1, 200);
    expect(await flushEdits(win, backend, 20)).toBe(false);
  });
});
