import { describe, expect, it, vi } from 'vitest';
import type { MediaPeaks, MediaThumbnail, VersionRef } from '@cuccut/protocol';
import { MediaAnalysisCache } from './media-analysis.ts';

const clip: VersionRef = { id: 'asset_a', revision: '1' };
const other: VersionRef = { id: 'asset_b', revision: '1' };

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
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** Timer advanced by hand: polling and coalesced notifications are both scheduled here. */
function harness(
  requests: { peaks?: (asset: VersionRef) => Promise<MediaPeaks>; thumbnail?: (asset: VersionRef, at: number) => Promise<MediaThumbnail> },
  options = {},
) {
  let now = 0;
  let timers: { at: number; run: () => void }[] = [];
  const cache = new MediaAnalysisCache(
    {
      peaks: requests.peaks ?? (async () => ({ status: 'no-audio' })),
      thumbnail: requests.thumbnail ?? (async (_asset, at) => ({ mimeType: 'image/jpeg', data: `t${at}`, at })),
    },
    { now: () => now, schedule: (run, ms) => void timers.push({ at: now + ms, run }), ...options },
  );
  const advance = async (ms: number) => {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const timer of due) timer.run();
    await settle();
  };
  return { cache, advance };
}

describe('media analysis cache: peaks', () => {
  it('when pending, polls again at the interval the Runtime gives; once computed, decodes and notifies', async () => {
    const answers: MediaPeaks[] = [
      { status: 'pending', retryAfterMs: 1000 },
      { status: 'ready', binsPerSecond: 50, peaks: btoa(String.fromCharCode(10, 64, 32)) },
    ];
    const peaks = vi.fn(async () => answers.shift()!);
    const { cache, advance } = harness({ peaks });
    const listener = vi.fn();
    cache.subscribe(listener);

    expect(cache.peaks(clip)).toEqual({ state: 'loading' });
    await settle();
    expect(cache.peaks(clip)).toEqual({ state: 'loading' });
    expect(peaks).toHaveBeenCalledTimes(1);
    await advance(999);
    expect(peaks).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(peaks).toHaveBeenCalledTimes(2);
    await advance(30);
    expect(listener).toHaveBeenCalledTimes(1);
    const state = cache.peaks(clip);
    if (state.state !== 'ready') throw new Error(state.state);
    expect([...state.value.peaks]).toEqual([10, 64, 32]);
    expect(state.value.binsPerSecond).toBe(50);
    // With three cells, the 98th percentile falls on the middle cell.
    expect(state.value.scale).toBeCloseTo(255 / 32);
    expect(peaks).toHaveBeenCalledTimes(2);
  });

  it('media without sound remembers the result and is not queried again', async () => {
    const peaks = vi.fn(async (): Promise<MediaPeaks> => ({ status: 'no-audio' }));
    const { cache } = harness({ peaks });
    cache.peaks(clip);
    await settle();
    expect(cache.peaks(clip)).toEqual({ state: 'no-audio' });
    cache.peaks(clip);
    expect(peaks).toHaveBeenCalledTimes(1);
  });

  it('after a failure, refetch only after a delay; the interval doubles each time', async () => {
    const peaks = vi.fn(async (): Promise<MediaPeaks> => {
      throw new Error('引擎重启中');
    });
    const { cache, advance } = harness({ peaks });
    cache.peaks(clip);
    await settle();
    expect(cache.peaks(clip)).toEqual({ state: 'failed' });
    await advance(2999);
    cache.peaks(clip);
    expect(peaks).toHaveBeenCalledTimes(1);
    await advance(1);
    cache.peaks(clip);
    await settle();
    expect(peaks).toHaveBeenCalledTimes(2);
    await advance(3000);
    cache.peaks(clip);
    expect(peaks).toHaveBeenCalledTimes(2);
    await advance(3000);
    cache.peaks(clip);
    expect(peaks).toHaveBeenCalledTimes(3);
  });

  it('after switching videos, in-flight results are not kept, and polling stops too', async () => {
    const answer = deferred<MediaPeaks>();
    const peaks = vi.fn(() => answer.promise);
    const { cache, advance } = harness({ peaks });
    cache.peaks(clip);
    cache.clear();
    answer.resolve({ status: 'pending', retryAfterMs: 500 });
    await advance(1000);
    expect(peaks).toHaveBeenCalledTimes(1);
  });
});

describe('media analysis cache: thumbnails', () => {
  it('the same cell is requested only once; after fetching it is a data URL', async () => {
    const thumbnail = vi.fn(async (_asset: VersionRef, at: number): Promise<MediaThumbnail> => ({
      mimeType: 'image/jpeg',
      data: 'AAAA',
      at,
    }));
    const { cache } = harness({ thumbnail });
    expect(cache.thumbnail(clip, 1.5)).toBeNull();
    expect(cache.thumbnail(clip, 1.5)).toBeNull();
    await settle();
    expect(thumbnail).toHaveBeenCalledTimes(1);
    expect(thumbnail).toHaveBeenCalledWith(clip, 1.5);
    expect(cache.thumbnail(clip, 1.5)).toBe('data:image/jpeg;base64,AAAA');
  });

  it('only a few requests are sent at a time; the most recently requested is fetched first', async () => {
    const pending = new Map<number, ReturnType<typeof deferred<MediaThumbnail>>>();
    const thumbnail = vi.fn((_asset: VersionRef, at: number) => {
      const answer = deferred<MediaThumbnail>();
      pending.set(at, answer);
      return answer.promise;
    });
    const { cache } = harness({ thumbnail }, { concurrency: 2 });
    for (const at of [1, 2, 3, 4]) cache.thumbnail(clip, at);
    await settle();
    expect(thumbnail.mock.calls.map(([, at]) => at)).toEqual([4, 3]);
    pending.get(4)!.resolve({ mimeType: 'image/jpeg', data: 'x', at: 4 });
    await settle();
    expect(thumbnail.mock.calls.map(([, at]) => at)).toEqual([4, 3, 2]);
  });

  it('when the queue gets too long, drop the earliest queued; queue again when it is next drawn', async () => {
    const pending = new Map<number, ReturnType<typeof deferred<MediaThumbnail>>>();
    const thumbnail = vi.fn((_asset: VersionRef, at: number) => {
      const answer = deferred<MediaThumbnail>();
      pending.set(at, answer);
      return answer.promise;
    });
    const { cache } = harness({ thumbnail }, { concurrency: 1, maxQueue: 2 });
    for (const at of [1, 2, 3]) cache.thumbnail(clip, at);
    await settle();
    expect(thumbnail.mock.calls.map(([, at]) => at)).toEqual([3]);
    // After 1 is dropped it is queued again; 2 is still in the queue, so it is not queued twice.
    cache.thumbnail(clip, 1);
    cache.thumbnail(clip, 2);
    for (const at of [3, 1, 2]) {
      pending.get(at)?.resolve({ mimeType: 'image/jpeg', data: 'x', at });
      await settle();
    }
    expect(thumbnail.mock.calls.map(([, at]) => at)).toEqual([3, 1, 2]);
  });

  it('media for which not a single thumbnail was fetched and that fails several times in a row is no longer requested; other media is unaffected', async () => {
    const thumbnail = vi.fn(async (asset: VersionRef, at: number): Promise<MediaThumbnail> => {
      if (asset.id === clip.id) throw new Error('解不了');
      return { mimeType: 'image/jpeg', data: 'ok', at };
    });
    const { cache } = harness({ thumbnail });
    for (const at of [1, 2, 3, 4]) cache.thumbnail(clip, at);
    await settle();
    cache.thumbnail(clip, 5);
    await settle();
    expect(thumbnail).toHaveBeenCalledTimes(4);
    cache.thumbnail(other, 1);
    await settle();
    expect(cache.thumbnail(other, 1)).toBe('data:image/jpeg;base64,ok');
  });

  it('the number of remembered entries is capped; the least recently used are dropped first', async () => {
    const thumbnail = vi.fn(async (_asset: VersionRef, at: number): Promise<MediaThumbnail> => ({
      mimeType: 'image/jpeg',
      data: String(at),
      at,
    }));
    const { cache } = harness({ thumbnail }, { maxThumbnails: 2 });
    cache.thumbnail(clip, 1);
    cache.thumbnail(clip, 2);
    await settle();
    expect(cache.thumbnail(clip, 1)).not.toBeNull();
    cache.thumbnail(clip, 3);
    await settle();
    expect(cache.thumbnail(clip, 1)).not.toBeNull();
    expect(cache.thumbnail(clip, 3)).not.toBeNull();
    expect(cache.thumbnail(clip, 2)).toBeNull();
  });
});
