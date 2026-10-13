import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PACK_PREVIEW_TTL_MS, RpcError } from '@cuccut/protocol';
import { PackPreviews } from './pack-previews.ts';
import { readPackSource } from './pack-source.ts';
import { SAMPLE_PACK_DIR } from './testing/pack-fixtures.ts';

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

let root: string;
let clock: number;
let previews: PackPreviews;
const stageSample = (dir: string) => readPackSource(SAMPLE_PACK_DIR, dir, { offlineStrict: () => false });

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pack-previews-'));
  clock = 1_000_000;
  previews = new PackPreviews({ dir: path.join(root, '.staging'), now: () => clock });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('pack previews', () => {
  it('stages a pack under a token that stays installable for 30 minutes', async () => {
    const entry = await previews.stage(stageSample);
    expect(entry.token).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(entry.expiresAt - entry.createdAt).toBe(PACK_PREVIEW_TTL_MS);
    expect(entry.staged.dir).toBe(path.join(root, '.staging', entry.token));
    expect(entry.staged.manifest.id).toBe('news-desk');
    expect((await previews.get(entry.token)).staged.dir).toBe(entry.staged.dir);

    clock += PACK_PREVIEW_TTL_MS;
    const expired = await rejection(previews.get(entry.token));
    expect(expired.code).toBe('conflict');
    expect(expired.details).toMatchObject({ code: 'PACK_PREVIEW_EXPIRED' });
    // The sweep deleted its folder.
    await expect(fs.access(entry.staged.dir)).rejects.toThrow();
  });

  it('an unknown or released token is expired; release deletes the folder', async () => {
    expect((await rejection(previews.get('unknown-token'))).details).toMatchObject({ code: 'PACK_PREVIEW_EXPIRED' });
    const entry = await previews.stage(stageSample);
    await previews.release(entry.token);
    expect((await rejection(previews.get(entry.token))).details).toMatchObject({ code: 'PACK_PREVIEW_EXPIRED' });
    await expect(fs.access(entry.staged.dir)).rejects.toThrow();
  });

  it('a failed read leaves no folder and no token', async () => {
    const error = await rejection(previews.stage((dir) => readPackSource(path.join(root, 'missing'), dir, { offlineStrict: () => false })));
    expect(error.details).toMatchObject({ code: 'PACK_SOURCE_NOT_FOUND' });
    expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
    expect(previews.tokens()).toEqual([]);
  });

  it('at startup everything staged goes, tokens included', async () => {
    const entry = await previews.stage(stageSample);
    await fs.mkdir(path.join(root, '.staging', 'left-over'), { recursive: true });
    await previews.sweepAll();
    expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
    expect((await rejection(previews.get(entry.token))).details).toMatchObject({ code: 'PACK_PREVIEW_EXPIRED' });
  });
});
