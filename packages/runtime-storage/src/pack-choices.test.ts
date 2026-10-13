import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PackChoicesStore } from './pack-choices.ts';

describe('style guide choices per project', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pack-choices-'));
    file = path.join(dir, 'store', 'pack-choices.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('starts with no choices: every project decides on its own', async () => {
    const store = new PackChoicesStore(file);
    expect(await store.load()).toEqual({ projects: {} });
    expect(store.choice('p1')).toBeNull();
    await expect(fs.access(file)).rejects.toThrow();
  });

  it('stores only the projects that chose, and forgets on null', async () => {
    const store = new PackChoicesStore(file);
    await store.load();
    await store.set('p1', 'news-desk');
    await store.set('p2', 'none');
    await store.set('p3', null);
    expect(store.get()).toEqual({ projects: { p1: 'news-desk', p2: 'none' } });
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ schemaVersion: 1, projects: { p1: 'news-desk', p2: 'none' } });

    const again = new PackChoicesStore(file);
    await again.load();
    expect(again.choice('p1')).toBe('news-desk');
    expect(again.choice('p2')).toBe('none');
    await again.set('p1', null);
    await again.forget('p2');
    expect(await new PackChoicesStore(file).load()).toEqual({ projects: {} });
  });

  it('keeps a choice that names a pack removed since', async () => {
    const store = new PackChoicesStore(file);
    await store.load();
    await store.set('p1', 'gone-pack');
    expect((await new PackChoicesStore(file).load()).projects).toEqual({ p1: 'gone-pack' });
  });

  it('writes nothing when a choice is unchanged', async () => {
    const store = new PackChoicesStore(file);
    await store.load();
    await store.set('p1', null);
    await store.forget('p1');
    await expect(fs.access(file)).rejects.toThrow();
    await store.set('p1', 'news-desk');
    // A marker written behind the store's back survives a set that changes nothing.
    await fs.writeFile(file, JSON.stringify({ schemaVersion: 1, projects: { p1: 'news-desk', marker: 'none' } }));
    await store.set('p1', 'news-desk');
    expect(JSON.parse(await fs.readFile(file, 'utf8')).projects.marker).toBe('none');
  });

  it('drops broken entries and keeps a broken file aside', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({ schemaVersion: 1, projects: { ok: 'news-desk', none: 'none', bad: 'News Desk', reserved: 'import', num: 3, '': 'news-desk' } }),
    );
    expect(await new PackChoicesStore(file).load()).toEqual({ projects: { ok: 'news-desk', none: 'none' } });

    await fs.writeFile(file, '{ not json');
    const store = new PackChoicesStore(file);
    expect(await store.load()).toEqual({ projects: {} });
    const kept = (await fs.readdir(path.dirname(file))).filter((name) => name.startsWith('pack-choices.json.corrupt-'));
    expect(kept).toHaveLength(1);
    expect(await fs.readFile(path.join(path.dirname(file), kept[0]!), 'utf8')).toBe('{ not json');
    await store.set('p1', 'none');
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ schemaVersion: 1, projects: { p1: 'none' } });
  });

  it('does not rewrite a file from a newer version', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const newer = JSON.stringify({ schemaVersion: 2, projects: { p1: { pack: 'news-desk' } } });
    await fs.writeFile(file, newer);
    const store = new PackChoicesStore(file);
    expect(await store.load()).toEqual({ projects: {} });
    await store.set('p1', 'none');
    expect(store.choice('p1')).toBe('none');
    expect(await fs.readFile(file, 'utf8')).toBe(newer);
  });
});
