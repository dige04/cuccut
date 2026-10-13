import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SkillPrefsStore } from './skill-prefs.ts';

describe('skill toggles', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-skill-prefs-'));
    file = path.join(dir, 'store', 'skill-prefs.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('no file means no deltas', async () => {
    const store = new SkillPrefsStore(file);
    expect(await store.load()).toEqual({ enabled: {} });
    expect(store.override('a')).toBeUndefined();
  });

  it('only stores deltas that differ from the default, deleted when returning to the default; reads back the same after writing to disk', async () => {
    const store = new SkillPrefsStore(file);
    await store.load();
    await store.set('caption-layout', false, true);
    await store.set('podcast-chapters', true, false);
    await store.set('channel-intro', true, true);
    expect(store.get()).toEqual({ enabled: { 'caption-layout': false, 'podcast-chapters': true } });
    await store.set('caption-layout', true, true);
    const again = new SkillPrefsStore(file);
    expect(await again.load()).toEqual({ enabled: { 'podcast-chapters': true } });
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toMatchObject({ schemaVersion: 1 });
    await again.forget('podcast-chapters');
    expect(await new SkillPrefsStore(file).load()).toEqual({ enabled: {} });
  });

  it('corrupted or unknown entries dropped', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ schemaVersion: 1, enabled: { ok: false, 'Bad Id': true, 字幕: true, x: 'yes' } }));
    expect(await new SkillPrefsStore(file).load()).toEqual({ enabled: { ok: false, 字幕: true } });
    await fs.writeFile(file, '{ not json');
    expect(await new SkillPrefsStore(file).load()).toEqual({ enabled: {} });
  });
});
