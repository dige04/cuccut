import { describe, expect, it, vi } from 'vitest';
import type { MediaHandle, VersionRef } from '@cuccut/protocol';
import { MediaUrlCache } from './media-url-cache.ts';

const asset = { id: 'asset_a', revision: '1' };
const HOUR = 3_600_000;

function setup() {
  let now = Date.parse('2026-10-06T00:00:00Z');
  let serial = 0;
  const pending: { resolve(handle: MediaHandle): void; reject(error: Error): void; progress(progress: number | null): void }[] = [];
  const resolve = vi.fn(
    (_videoId: string, _asset: VersionRef, _signal: AbortSignal, onProgress: (progress: number | null) => void) =>
      new Promise<MediaHandle>((resolve, reject) => pending.push({ resolve, reject, progress: onProgress })),
  );
  const cache = new MediaUrlCache(resolve, { now: () => now });
  /** A new handle: the address differs each time, and it expires after `ttl`. */
  const handle = (ttl = HOUR): MediaHandle => ({
    url: `http://media/grant-${++serial}`,
    mimeType: 'audio/wav',
    size: 1,
    fileName: 'a.wav',
    expiresAt: new Date(now + ttl).toISOString(),
  });
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { cache, resolve, pending, handle, settle, advance: (ms: number) => (now += ms) };
}

describe('media URL cache', () => {
  it('closing a video or reconnecting terminates unfinished compatibility playback polling', async () => {
    const cache = new MediaUrlCache((_video, _asset, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const pending = cache.get('vid1', asset);
    const stopped = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    cache.clear();
    await stopped;
    expect(cache.peek('vid1', asset)).toBeNull();
  });
  it('a thousand requests for the same media version at the same moment send only one request and all get the same address; readable synchronously once fetched', async () => {
    const { cache, resolve, pending, handle } = setup();
    const waiters = Array.from({ length: 1000 }, () => cache.get('vid1', asset));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(cache.peek('vid1', asset)).toBeNull();
    const granted = handle();
    pending[0]!.resolve(granted);
    expect(new Set(await Promise.all(waiters))).toEqual(new Set([granted.url]));
    expect(cache.peek('vid1', asset)).toBe(granted.url);
    expect(await cache.get('vid1', asset)).toBe(granted.url);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('keyed by \'video:media@version\': a different version or video is requested separately', () => {
    const { cache, resolve } = setup();
    void cache.get('vid1', asset);
    void cache.get('vid1', { id: 'asset_a', revision: '2' });
    void cache.get('vid2', asset);
    void cache.get('vid1', asset);
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('failures are not recorded: those waiting all get the same error, and the next request sends again', async () => {
    const { cache, resolve, pending, handle, settle } = setup();
    const waiters = Array.from({ length: 10 }, () => cache.get('vid1', asset).catch((error: Error) => error));
    const refused = new Error('视频没有打开；先打开它');
    pending[0]!.reject(refused);
    const results = await Promise.all(waiters);
    expect(results.every((result) => result === refused)).toBe(true);
    await settle();
    expect(cache.peek('vid1', asset)).toBeNull();
    const again = cache.get('vid1', asset);
    expect(resolve).toHaveBeenCalledTimes(2);
    const granted = handle();
    pending[1]!.resolve(granted);
    expect(await again).toBe(granted.url);
  });

  it('a handle less than a minute from expiry is no longer used; request again', async () => {
    const { cache, resolve, pending, handle, settle, advance } = setup();
    const first = cache.get('vid1', asset);
    const granted = handle(HOUR);
    pending[0]!.resolve(granted);
    await first;
    advance(HOUR - 61_000);
    expect(cache.peek('vid1', asset)).toBe(granted.url);
    advance(2_000);
    expect(cache.peek('vid1', asset)).toBeNull();
    const refreshed = cache.get('vid1', asset);
    expect(resolve).toHaveBeenCalledTimes(2);
    const next = handle();
    pending[1]!.resolve(next);
    expect(await refreshed).toBe(next.url);
    await settle();
    expect(cache.peek('vid1', asset)).toBe(next.url);
  });

  it('after clear, in-flight requests that come back are not kept: whoever waits on them still gets the result, but the cache does not hold it, and the next request is separate', async () => {
    const { cache, resolve, pending, handle, settle } = setup();
    const before = cache.get('vid1', asset);
    cache.clear();
    const stale = handle();
    pending[0]!.resolve(stale);
    expect(await before).toBe(stale.url);
    await settle();
    expect(cache.peek('vid1', asset)).toBeNull();
    void cache.get('vid1', asset);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('after clear, if a new request for the same key returns before an old one: keep the new; a failing old request does not delete the new', async () => {
    const { cache, pending, handle, settle } = setup();
    void cache.get('vid1', asset).catch(() => {});
    cache.clear();
    const fresh = cache.get('vid1', asset);
    const granted = handle();
    pending[1]!.resolve(granted);
    await fresh;
    pending[0]!.reject(new Error('Runtime 重启了'));
    await settle();
    expect(cache.peek('vid1', asset)).toBe(granted.url);
  });

  it('invalidate deletes only when the remembered address is still the one that fails to play: the one that reports the error first is deleted and requested again, the rest join the same new request', async () => {
    const { cache, resolve, pending, handle, settle } = setup();
    const first = cache.get('vid1', asset);
    const dead = handle();
    pending[0]!.resolve(dead);
    await first;

    cache.invalidate('vid1', asset, 'http://media/other');
    expect(cache.peek('vid1', asset)).toBe(dead.url);

    // When thousands of elements report errors on the same dead address, the first one deletes it and requests a new one; the rest cannot delete the in-flight request, so they follow it.
    cache.invalidate('vid1', asset, dead.url);
    const waiters = [cache.get('vid1', asset)];
    for (let i = 0; i < 999; i++) {
      cache.invalidate('vid1', asset, dead.url);
      waiters.push(cache.get('vid1', asset));
    }
    expect(resolve).toHaveBeenCalledTimes(2);
    const next = handle();
    pending[1]!.resolve(next);
    expect(new Set(await Promise.all(waiters))).toEqual(new Set([next.url]));
    await settle();

    // A late old error arriving after the new address is in place cannot delete it either.
    cache.invalidate('vid1', asset, dead.url);
    expect(cache.peek('vid1', asset)).toBe(next.url);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('preview retry: this video\'s fetched and in-flight entries are all dropped and requested again, a late in-flight one is not kept; other videos are untouched', async () => {
    const { cache, resolve, pending, handle, settle } = setup();
    const other = { id: 'asset_b', revision: '1' };
    void cache.get('vid1', asset);
    void cache.get('vid1', other);
    void cache.get('vid2', asset);
    const kept = handle();
    pending[1]!.resolve(kept);
    pending[2]!.resolve(handle());
    await settle();
    expect(cache.peek('vid1', other)).toBe(kept.url);

    cache.forgetVideo('vid1');
    expect(cache.peek('vid1', other)).toBeNull();
    expect(cache.peek('vid2', asset)).not.toBeNull();
    void cache.get('vid1', asset);
    expect(resolve).toHaveBeenCalledTimes(4);
    // The stuck request finally returns: it is ignored, because what is awaited is the new one.
    pending[0]!.resolve(handle());
    await settle();
    expect(cache.peek('vid1', asset)).toBeNull();
    const fresh = handle();
    pending[3]!.resolve(fresh);
    await settle();
    expect(cache.peek('vid1', asset)).toBe(fresh.url);
  });

  it('converting: record the progress reported by in-flight requests and notify; delete on both success and failure; media not being prepared is undefined', async () => {
    const { cache, pending, handle, settle } = setup();
    const other = { id: 'asset_b', revision: '1' };
    const heard = vi.fn();
    cache.subscribe(heard);
    void cache.get('vid1', asset);
    const failing = cache.get('vid1', other).catch(() => {});
    expect(cache.progress('vid1', asset)).toBeUndefined();
    expect(cache.preparing('vid1')).toEqual([]);

    pending[0]!.progress(null);
    pending[1]!.progress(0.2);
    pending[0]!.progress(0.5);
    // The same progress reported again does not notify.
    pending[0]!.progress(0.5);
    expect(heard).toHaveBeenCalledTimes(3);
    expect(cache.progress('vid1', asset)).toBe(0.5);
    expect(cache.preparing('vid1')).toEqual([
      { assetId: 'asset_a', revision: '1', progress: 0.5 },
      { assetId: 'asset_b', revision: '1', progress: 0.2 },
    ]);
    expect(cache.preparing('vid2')).toEqual([]);

    pending[0]!.resolve(handle());
    pending[1]!.reject(new Error('boom'));
    await failing;
    await settle();
    expect(cache.progress('vid1', asset)).toBeUndefined();
    expect(cache.preparing('vid1')).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(5);
  });

  it('converting: a retry drops the request, which is still polling, its reported progress is not kept; all are deleted when the video closes', async () => {
    const { cache, pending } = setup();
    void cache.get('vid1', asset);
    pending[0]!.progress(0.3);
    cache.forgetVideo('vid1');
    expect(cache.progress('vid1', asset)).toBeUndefined();
    void cache.get('vid1', asset);
    pending[0]!.progress(0.4);
    expect(cache.progress('vid1', asset)).toBeUndefined();
    pending[1]!.progress(0.41);
    expect(cache.progress('vid1', asset)).toBe(0.41);
    cache.clear();
    expect(cache.preparing('vid1')).toEqual([]);
  });
});
