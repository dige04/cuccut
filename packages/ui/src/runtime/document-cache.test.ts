import { describe, expect, it, vi } from 'vitest';
import type { DocumentContent } from '@cuccut/protocol';
import { DocumentCache } from './document-cache.ts';

function setup() {
  const pending: { resolve(body: unknown): void }[] = [];
  const read = vi.fn(
    () => new Promise<DocumentContent>((resolve) => pending.push({ resolve: (body) => resolve({ body } as DocumentContent) })),
  );
  const cache = new DocumentCache(read);
  const listener = vi.fn();
  cache.subscribe(listener);
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { cache, read, pending, listener, settle };
}

describe('document body cache', () => {
  it('an in-progress fetch is not sent again; notify once fetched', async () => {
    const { cache, read, pending, listener, settle } = setup();
    cache.load('doc', 'r1');
    cache.load('doc', 'r1');
    expect(read).toHaveBeenCalledTimes(1);
    pending[0]!.resolve({ cues: [] });
    await settle();
    expect(cache.peek('doc', 'r1')).toEqual({ cues: [] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preview retry: forget in-flight requests, a new request sends again, late ones are not kept; fetched content is still kept', async () => {
    const { cache, read, pending, settle } = setup();
    cache.load('doc', 'r1');
    cache.load('kept', 'r1');
    pending[1]!.resolve('kept body');
    await settle();

    cache.forgetPending();
    expect(cache.peek('kept', 'r1')).toBe('kept body');
    cache.load('doc', 'r1');
    expect(read).toHaveBeenCalledTimes(3);
    pending[0]!.resolve('late');
    await settle();
    expect(cache.peek('doc', 'r1')).toBeUndefined();
    pending[2]!.resolve('fresh');
    await settle();
    expect(cache.peek('doc', 'r1')).toBe('fresh');
  });
});
