import { describe, expect, it, vi } from 'vitest';
import { RpcError, type SpaceThumbnail } from '@cuccut/protocol';
import { SpaceThumbnailCache, type SpaceThumbnailCacheOptions } from './space-thumbnails.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const picture = (data: string): SpaceThumbnail => ({
  kind: 'image',
  mimeType: 'image/jpeg',
  data,
  width: 320,
  height: 180,
});

/** Timers advanced by hand: retries, re-checks and coalesced notifications are all scheduled here. */
function harness(request: (entryId: string) => Promise<SpaceThumbnail>, options: SpaceThumbnailCacheOptions = {}) {
  let now = 0;
  let timers: { at: number; run: () => void }[] = [];
  const cache = new SpaceThumbnailCache(request, {
    schedule: (run, ms) => void timers.push({ at: now + ms, run }),
    ...options,
  });
  const advance = async (ms: number) => {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const timer of due) timer.run();
    await settle();
  };
  return { cache, advance };
}

describe('Space thumbnail cache', () => {
  it('fetched only once mounted; on fetch, notifies and remembers; the same result returns the same object', async () => {
    const request = vi.fn(async (id: string) => picture(id));
    const { cache, advance } = harness(request);
    const listener = vi.fn();
    cache.subscribe(listener);

    expect(cache.peek('a')).toBeNull();
    expect(request).not.toHaveBeenCalled();
    cache.retain('a', 'image', 'v1');
    await settle();
    expect(request).toHaveBeenCalledWith('a');
    await advance(30);
    expect(listener).toHaveBeenCalledTimes(1);
    const first = cache.peek('a');
    expect(first).toEqual({
      kind: 'image',
      url: 'data:image/jpeg;base64,a',
      width: 320,
      height: 180,
    });
    expect(cache.peek('a')).toBe(first);

    // Unmounted and mounted again with the same version: not fetched again.
    cache.retain('a', 'image', 'v1');
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('only a few at a time, the one mounted later is fetched first; ones scrolled away while still queued are not sent', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<SpaceThumbnail>>>();
    const request = vi.fn((id: string) => {
      const d = deferred<SpaceThumbnail>();
      pending.set(id, d);
      return d.promise;
    });
    const { cache } = harness(request, { concurrency: 2 });
    const releases = ['a', 'b', 'c', 'd', 'e'].map((id) => cache.retain(id, 'image', 'v1'));
    await settle();
    expect(request.mock.calls.map(([id]) => id)).toEqual(['e', 'd']);

    releases[2]!(); // c scrolled away
    pending.get('e')!.resolve(picture('e'));
    pending.get('d')!.resolve(picture('d'));
    await settle();
    expect(request.mock.calls.map(([id]) => id)).toEqual(['e', 'd', 'b', 'a']);

    // Fetch only once c is mounted again.
    cache.retain('c', 'image', 'v1');
    pending.get('b')!.resolve(picture('b'));
    await settle();
    expect(request.mock.calls.map(([id]) => id)).toEqual(['e', 'd', 'b', 'a', 'c']);
  });

  it('the session card and the Space share one request; after one place unmounts, the other still gets the video cover', async () => {
    let ready = false;
    const request = vi.fn(async (): Promise<SpaceThumbnail> => (ready ? picture('poster') : { kind: 'none' }));
    const { cache, advance } = harness(request);
    const releaseCard = cache.retain('video', 'video', 'v1');
    const releaseSpace = cache.retain('video', 'video', 'v1');
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(cache.peek('video')).toEqual({ kind: 'none' });

    releaseSpace();
    ready = true;
    await advance(20_000);
    expect(request).toHaveBeenCalledTimes(2);
    expect(cache.peek('video')).toMatchObject({ kind: 'image', url: 'data:image/jpeg;base64,poster' });
    releaseCard();
  });

  it('when the queue exceeds the limit, drop the earliest queued', async () => {
    const gate = deferred<SpaceThumbnail>();
    const request = vi.fn((id: string) => (id === 'busy' ? gate.promise : Promise.resolve(picture(id))));
    const { cache } = harness(request, { concurrency: 1, maxQueue: 2 });
    cache.retain('busy', 'image', 'v1');
    await settle();
    for (const id of ['a', 'b', 'c']) cache.retain(id, 'image', 'v1');
    gate.resolve(picture('busy'));
    await settle();
    expect(request.mock.calls.map(([id]) => id)).toEqual(['busy', 'c', 'b']);
  });

  it('a version change refetches; the old one is drawn until the new one arrives', async () => {
    let n = 0;
    const gate = deferred<SpaceThumbnail>();
    const request = vi.fn(async () => (++n === 1 ? picture('old') : gate.promise));
    const { cache } = harness(request);
    const release = cache.retain('a', 'video', 'v1');
    await settle();
    const old = cache.peek('a');
    release();

    cache.retain('a', 'video', 'v2');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(cache.peek('a')).toBe(old);
    gate.resolve(picture('new'));
    await settle();
    expect(cache.peek('a')).toMatchObject({
      url: 'data:image/jpeg;base64,new',
    });
  });

  it('not-found and forbidden are treated as absent and not retried', async () => {
    const request = vi.fn(async (id: string): Promise<SpaceThumbnail> => {
      throw new RpcError(id === 'gone' ? 'not-found' : 'forbidden', 'no');
    });
    const { cache, advance } = harness(request);
    cache.retain('gone', 'image', 'v1');
    cache.retain('hidden', 'image', 'v1');
    await settle();
    await advance(120_000);
    expect(request).toHaveBeenCalledTimes(2);
    expect(cache.peek('gone')).toEqual({ kind: 'none' });
    expect(cache.peek('hidden')).toEqual({ kind: 'none' });
  });

  it('other failures are requested again immediately (after a timeout the Runtime has already cached it), then back off; give up after several failures', async () => {
    const request = vi.fn(async (): Promise<SpaceThumbnail> => {
      throw new RpcError('internal', '请求超时：space.thumbnail');
    });
    const { cache, advance } = harness(request);
    cache.retain('a', 'video-file', 'v1');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    await advance(14_999);
    expect(request).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(request).toHaveBeenCalledTimes(3);
    await advance(30_000);
    expect(request).toHaveBeenCalledTimes(4);
    await advance(600_000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(cache.peek('a')).toBeNull();

    // Try again once the entry changes.
    cache.retain('a', 'video-file', 'v2');
    await settle();
    expect(request).toHaveBeenCalledTimes(6);
  });

  it('after reconnecting, requests abandoned during the disconnect are requested again; ones already obtained are not refetched', async () => {
    let connected = false;
    const request = vi.fn(async (id: string): Promise<SpaceThumbnail> => {
      if (!connected && id === 'a') throw new RpcError('internal', '与 Runtime 的连接已断开');
      return picture(id);
    });
    const { cache, advance } = harness(request);
    cache.retain('ok', 'image', 'v1');
    await settle();
    cache.retain('a', 'image', 'v1');
    await settle();
    await advance(15_000);
    await advance(30_000);
    expect(request.mock.calls.filter(([id]) => id === 'a')).toHaveLength(4);
    expect(cache.peek('a')).toBeNull();

    connected = true;
    cache.revive();
    await settle();
    expect(request.mock.calls.filter(([id]) => id === 'a')).toHaveLength(5);
    expect(request.mock.calls.filter(([id]) => id === 'ok')).toHaveLength(1);
    expect(cache.peek('a')).toMatchObject({ kind: 'image' });
  });

  it('after a timeout, requesting again immediately gets it', async () => {
    let n = 0;
    const request = vi.fn(async () => {
      if (++n === 1) throw new RpcError('internal', '请求超时：space.thumbnail');
      return picture('a');
    });
    const { cache } = harness(request);
    cache.retain('a', 'export', 'v1');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(cache.peek('a')).toMatchObject({ kind: 'image' });
  });

  it('when a video answers none (the content index has not caught up yet), re-check after a delay, at most twice; other types are not re-checked', async () => {
    const answers: SpaceThumbnail[] = [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }];
    const request = vi.fn(async (id: string) => (id === 'doc' ? ({ kind: 'none' } as const) : answers.shift()!));
    const { cache, advance } = harness(request);
    cache.retain('v', 'video', 'v1');
    cache.retain('doc', 'document', 'v1');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    await advance(20_000);
    expect(request).toHaveBeenCalledTimes(3);
    await advance(20_000);
    expect(request).toHaveBeenCalledTimes(4);
    await advance(60_000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls.filter(([id]) => id === 'doc')).toHaveLength(1);
  });

  it('remembered entries are capped; the least recently used ones that are not mounted are dropped first', async () => {
    const request = vi.fn(async (id: string) => picture(id));
    const { cache } = harness(request, { maxEntries: 2 });
    const releaseA = cache.retain('a', 'image', 'v1');
    await settle();
    releaseA();
    const releaseB = cache.retain('b', 'image', 'v1');
    await settle();
    releaseB();
    cache.retain('a', 'image', 'v1'); // a is used again
    cache.retain('c', 'image', 'v1');
    await settle();
    expect(cache.peek('a')).not.toBeNull();
    expect(cache.peek('b')).toBeNull();
    expect(cache.peek('c')).not.toBeNull();
  });

  it('after clear, in-flight requests that come back are not kept', async () => {
    const gate = deferred<SpaceThumbnail>();
    const { cache } = harness(() => gate.promise);
    cache.retain('a', 'image', 'v1');
    await settle();
    cache.clear();
    gate.resolve(picture('a'));
    await settle();
    expect(cache.peek('a')).toBeNull();
  });
});
