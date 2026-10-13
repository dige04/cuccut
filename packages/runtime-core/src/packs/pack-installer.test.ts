import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PACK_RECORD_FILE, PACK_TRASH_TTL_MS, RpcError, SKILL_SOURCE_FILE, type InstalledPackRecord } from '@cuccut/protocol';
import { packDirHash, sha256Text } from './pack-registry.ts';
import { SAMPLE_PACK_DIR, packWorld, writePack, type PackWorld, type PackWorldOptions } from './testing/pack-fixtures.ts';
import type { PackInstallStep } from './pack-installer.ts';

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

const exists = (file: string) =>
  fs.access(file).then(
    () => true,
    () => false,
  );
const readRecord = async (world: PackWorld, id: string) =>
  JSON.parse(await fs.readFile(path.join(world.packsDir, id, PACK_RECORD_FILE), 'utf8')) as InstalledPackRecord;

let root: string;
let world: PackWorld;
let clock: number;
let fail: PackInstallStep | null;

async function boot(options: PackWorldOptions = {}) {
  world = await packWorld(root, { now: () => new Date(clock), onStep: (step) => {
    if (step === fail) throw new Error(`failing at ${step}`);
  }, ...options });
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pack-installer-'));
  clock = Date.parse('2026-10-13T08:00:00Z');
  fail = null;
  await boot();
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('install', () => {
  it('writes templates, skills and library entries, then the pack folder and its record', async () => {
    const preview = await world.installer.inspect({ source: SAMPLE_PACK_DIR });
    const result = await world.installer.install({ token: preview.token });
    expect(result.skipped).toEqual([]);
    expect(result.pack).toMatchObject({
      id: 'news-desk',
      name: 'News desk',
      version: '1.0.0',
      hasStyle: true,
      counts: { templates: 1, skills: 1, library: 2, examples: 1, quickActions: 3 },
      provides: { templates: ['news-desk-daily'], skills: ['news-desk-headlines'] },
      path: path.join(world.packsDir, 'news-desk'),
    });
    expect(result.packs.map((p) => p.id)).toEqual(['news-desk']);

    // Template and skill in the places CucCut reads; the skill knows its pack.
    const template = path.join(world.templatesDir, 'news-desk-daily');
    const skill = path.join(world.skillsDir, 'news-desk-headlines');
    expect(await fs.readFile(path.join(template, 'prompt.md'), 'utf8')).toBe(
      await fs.readFile(path.join(SAMPLE_PACK_DIR, 'templates/news-desk-daily/prompt.md'), 'utf8'),
    );
    expect(JSON.parse(await fs.readFile(path.join(skill, SKILL_SOURCE_FILE), 'utf8'))).toEqual({
      schemaVersion: 1,
      kind: 'pack',
      packId: 'news-desk',
      packName: 'News desk',
      packVersion: '1.0.0',
      installedAt: '2026-10-13T08:00:00.000Z',
    });
    const skills = await world.skills.list();
    expect(skills.skills.find((s) => s.id === 'news-desk-headlines')).toMatchObject({ origin: 'pack', enabled: true, defaultEnabled: true });
    const templates = await world.templates.list();
    expect(templates.templates.find((t) => t.manifest.id === 'news-desk-daily')).toMatchObject({ origin: 'user', pack: { id: 'news-desk', name: 'News desk' } });

    // The pack folder holds only the pack's own files and the record.
    const folder = path.join(world.packsDir, 'news-desk');
    expect((await fs.readdir(folder)).sort()).toEqual([PACK_RECORD_FILE, 'STYLE.md', 'examples', 'pack.json']);
    const record = await readRecord(world, 'news-desk');
    expect(record).toMatchObject({
      schemaVersion: 1,
      id: 'news-desk',
      source: { kind: 'local', path: SAMPLE_PACK_DIR },
      installedAt: '2026-10-13T08:00:00.000Z',
      updatedAt: '2026-10-13T08:00:00.000Z',
      installed: {
        templates: [{ id: 'news-desk-daily', dirHash: await packDirHash(template) }],
        skills: [{ id: 'news-desk-headlines', dirHash: await packDirHash(skill) }],
      },
      style: true,
      reserved: { rules: 0, review: false },
    });
    expect(record.installed.library.map((l) => [l.file, l.library])).toEqual([
      ['library/news-desk-terms.md', 'glossaries'],
      ['library/news-desk-red.json', 'brand'],
    ]);
    expect(world.library.imports).toHaveLength(2);

    // The preview is used up, and no scratch space is left.
    expect((await rejection(world.installer.install({ token: preview.token }))).details).toMatchObject({ code: 'PACK_PREVIEW_EXPIRED' });
    expect(await fs.readdir(path.join(world.packsDir, '.staging'))).toEqual([]);
    expect(await fs.readdir(path.join(world.packsDir, '.trash')).catch(() => [])).toEqual([]);
  });

  it('a failing step puts everything back; the preview stays installable', async () => {
    const preview = await world.installer.inspect({ source: SAMPLE_PACK_DIR });
    for (const step of ['library', 'templates', 'skills', 'folder'] as const) {
      fail = step;
      await expect(world.installer.install({ token: preview.token })).rejects.toThrow(`failing at ${step}`);
      expect(await exists(path.join(world.templatesDir, 'news-desk-daily'))).toBe(false);
      expect(await exists(path.join(world.skillsDir, 'news-desk-headlines'))).toBe(false);
      expect(await exists(path.join(world.packsDir, 'news-desk'))).toBe(false);
      expect(world.library.entries.size).toBe(0);
      expect(await fs.readdir(path.join(world.packsDir, '.trash')).catch(() => [])).toEqual([]);
    }
    fail = null;
    const result = await world.installer.install({ token: preview.token });
    expect(result.pack.id).toBe('news-desk');
    expect(await exists(path.join(world.templatesDir, 'news-desk-daily', 'template.json'))).toBe(true);
  });

  it('a failing step during an update puts the earlier version back', async () => {
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    const before = await readRecord(world, 'news-desk');
    const beforeHash = await packDirHash(path.join(world.templatesDir, 'news-desk-daily'));
    fail = 'folder';
    await expect(world.installer.install({ source: SAMPLE_PACK_DIR })).rejects.toThrow('failing at folder');
    expect(await readRecord(world, 'news-desk')).toEqual(before);
    expect(await packDirHash(path.join(world.templatesDir, 'news-desk-daily'))).toBe(beforeHash);
    expect(world.library.entries.size).toBe(2);
  });

  it('the user’s own items are kept unless replace, which moves them to the trash; built-in ids are never installed', async () => {
    const mine = await world.writeTemplate(world.templatesDir, 'tpl-a', { title: 'Mine' });
    await world.writeTemplate(world.builtinTemplates, 'tpl-builtin');
    const source = await writePack(root, 'clash', { templates: { 'tpl-a': null, 'tpl-builtin': null }, skills: { 'skill-a': null } });

    const kept = await world.installer.install({ source });
    expect(kept.skipped).toEqual([
      { kind: 'template', id: 'tpl-a', reason: 'exists' },
      { kind: 'template', id: 'tpl-builtin', reason: 'builtin' },
    ]);
    expect(JSON.parse(await fs.readFile(path.join(mine, 'template.json'), 'utf8')).title).toBe('Mine');
    expect((await readRecord(world, 'clash')).installed.templates).toEqual([]);
    expect(await exists(path.join(world.templatesDir, 'tpl-builtin'))).toBe(false);

    const replaced = await world.installer.install({ source, replace: true });
    expect(replaced.skipped).toEqual([{ kind: 'template', id: 'tpl-builtin', reason: 'builtin' }]);
    expect(JSON.parse(await fs.readFile(path.join(mine, 'template.json'), 'utf8')).title).toBe('Sample scene');
    const trash = await fs.readdir(path.join(world.packsDir, '.trash'));
    expect(trash).toHaveLength(1);
    expect(trash[0]).toMatch(/^replaced-/);
    const moved = path.join(world.packsDir, '.trash', trash[0]!, 'templates', 'tpl-a', 'template.json');
    expect(JSON.parse(await fs.readFile(moved, 'utf8')).title).toBe('Mine');
  });

  it('installing again updates what the pack owns, keeps what the user changed, and drops what the new version left out', async () => {
    const v1 = await writePack(root, 'twice', { templates: { 'tpl-a': null, 'tpl-b': null, 'tpl-c': null } });
    await world.installer.install({ source: v1 });
    await fs.appendFile(path.join(world.templatesDir, 'tpl-b', 'prompt.md'), 'Mine now.\n');
    const changedHash = (await readRecord(world, 'twice')).installed.templates.find((t) => t.id === 'tpl-b')!.dirHash;

    const v2 = await writePack(root, 'twice-v2', {
      manifest: { id: 'twice', version: '2.0.0' },
      templates: {
        'tpl-a': { 'template.json': (await fs.readFile(path.join(v1, 'templates/tpl-a/template.json'), 'utf8')), 'prompt.md': 'Version two.\n' },
        'tpl-b': null,
      },
    });
    clock += 60_000;
    const result = await world.installer.install({ source: v2 });
    expect(result.pack.version).toBe('2.0.0');
    expect(result.skipped).toEqual([{ kind: 'template', id: 'tpl-b', reason: 'changed' }]);
    expect(await fs.readFile(path.join(world.templatesDir, 'tpl-a', 'prompt.md'), 'utf8')).toBe('Version two.\n');
    expect(await fs.readFile(path.join(world.templatesDir, 'tpl-b', 'prompt.md'), 'utf8')).toContain('Mine now.');
    expect(await exists(path.join(world.templatesDir, 'tpl-c'))).toBe(false);
    const record = await readRecord(world, 'twice');
    expect(record.installedAt).toBe('2026-10-13T08:00:00.000Z');
    expect(record.updatedAt).toBe('2026-10-13T08:01:00.000Z');
    expect(record.installed.templates).toEqual([
      { id: 'tpl-a', dirHash: await packDirHash(path.join(world.templatesDir, 'tpl-a')) },
      { id: 'tpl-b', dirHash: changedHash },
    ]);
    const detail = await world.registry.detail('twice');
    expect(detail.items.templates.map((t) => [t.id, t.state])).toEqual([
      ['tpl-a', 'present'],
      ['tpl-b', 'changed'],
    ]);
  });

  it('library entries are imported once, and a retry with the same commandId returns the first result', async () => {
    const first = await world.installer.install({ source: SAMPLE_PACK_DIR, commandId: 'cmd_a' });
    const entries = (await readRecord(world, 'news-desk')).installed.library.map((l) => l.entryId);
    const again = await world.installer.install({ source: SAMPLE_PACK_DIR, commandId: 'cmd_a' });
    expect(again).toBe(first);
    await world.installer.install({ source: SAMPLE_PACK_DIR, commandId: 'cmd_b' });
    expect(world.library.imports).toHaveLength(2);
    expect((await readRecord(world, 'news-desk')).installed.library.map((l) => l.entryId)).toEqual(entries);
  });
});

describe('remove and restore', () => {
  it('remove moves the pack and its unchanged items to the trash; changed items, library entries and toggles stay; restore brings them back', async () => {
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    const extra = await writePack(root, 'extra', { templates: { 'tpl-x': null } });
    await world.installer.install({ source: extra });
    await fs.appendFile(path.join(world.templatesDir, 'tpl-x', 'prompt.md'), 'Changed.\n');
    await world.prefs.set('news-desk-headlines', false, true);

    const removed = await world.installer.remove('extra');
    expect(removed.removed).toEqual({ id: 'extra', name: 'Sample pack' });
    expect(removed.kept).toEqual([{ kind: 'template', id: 'tpl-x' }]);
    expect(removed.moved).toEqual({ templates: 0, skills: 0 });
    expect(await exists(path.join(world.templatesDir, 'tpl-x'))).toBe(true);

    const gone = await world.installer.remove('news-desk');
    expect(gone.packs).toEqual([]);
    expect(gone.kept).toEqual([]);
    expect(gone.moved).toEqual({ templates: 1, skills: 1 });
    expect(await exists(path.join(world.templatesDir, 'news-desk-daily'))).toBe(false);
    expect(await exists(path.join(world.skillsDir, 'news-desk-headlines'))).toBe(false);
    expect(await exists(path.join(world.packsDir, 'news-desk'))).toBe(false);
    expect(world.library.entries.size).toBe(2);
    expect(world.prefs.override('news-desk-headlines')).toBe(false);
    expect((await rejection(world.registry.detail('news-desk'))).details).toMatchObject({ code: 'PACK_NOT_FOUND' });

    const restored = await world.installer.restore(gone.trashId);
    expect(restored.pack.id).toBe('news-desk');
    expect(restored.skipped).toEqual([]);
    expect(await exists(path.join(world.templatesDir, 'news-desk-daily', 'template.json'))).toBe(true);
    expect((await world.skills.list()).skills.find((s) => s.id === 'news-desk-headlines')).toMatchObject({ origin: 'pack', enabled: false });
    expect((await world.registry.detail('news-desk')).items.templates).toEqual([{ kind: 'template', id: 'news-desk-daily', state: 'present' }]);
    // The trash folder went with the restore: a second Undo has nothing left.
    expect((await rejection(world.installer.restore(gone.trashId))).details).toMatchObject({ code: 'PACK_TRASH_EXPIRED' });
  });

  it('restore refuses when the id was taken in the meantime', async () => {
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    const { trashId } = await world.installer.remove('news-desk');
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    const error = await rejection(world.installer.restore(trashId));
    expect(error.code).toBe('conflict');
    expect(error.details).toMatchObject({ code: 'PACK_RESTORE_CONFLICT', id: 'news-desk' });
    // Nothing moved: the trash is still there.
    expect(await exists(path.join(world.packsDir, '.trash', trashId, 'pack'))).toBe(true);
  });

  it('trash older than 24 hours is purged at startup, with the toggles of its skills', async () => {
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    await world.prefs.set('news-desk-headlines', false, true);
    const { trashId } = await world.installer.remove('news-desk');
    await world.installer.startup();
    expect(await exists(path.join(world.packsDir, '.trash', trashId))).toBe(true);

    clock += PACK_TRASH_TTL_MS;
    expect((await rejection(world.installer.restore(trashId))).details).toMatchObject({ code: 'PACK_TRASH_EXPIRED' });
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    const second = await world.installer.remove('news-desk');
    clock += PACK_TRASH_TTL_MS;
    await world.installer.startup();
    expect(await exists(path.join(world.packsDir, '.trash', second.trashId))).toBe(false);
    expect(world.prefs.override('news-desk-headlines')).toBeUndefined();
    expect((await rejection(world.installer.restore(second.trashId))).details).toMatchObject({ code: 'PACK_TRASH_EXPIRED' });
    expect((await rejection(world.installer.restore('not-a-trash-id'))).details).toMatchObject({ code: 'PACK_TRASH_EXPIRED' });
  });
});

describe('registry', () => {
  it('the pack page: style text and digest, references, quick actions, reserved texts', async () => {
    const source = await writePack(root, 'paged', {
      manifest: {
        style: 'STYLE.md',
        examples: [{ file: 'examples/a.png', kind: 'image', title: 'A frame', note: 'Look at the bar.' }],
        quickActions: [{ label: 'Tighten', text: 'Tighten {selection}.' }],
        rules: ['pace'],
        review: 'review.json',
      },
      files: {
        'STYLE.md': '# Style\n\nCalm.\n',
        'examples/a.png': 'png bytes',
        'rules/pace.md': 'Keep it moving.\n',
        'review.json': '{"checks":[]}',
      },
    });
    await world.installer.install({ source });
    const detail = await world.registry.detail('paged');
    expect(detail.style).toEqual({ text: '# Style\n\nCalm.\n', hash: sha256Text('# Style\n\nCalm.\n') });
    expect(detail.examples).toEqual([{ file: 'examples/a.png', kind: 'image', title: 'A frame', note: 'Look at the bar.', hasStill: true, size: 9 }]);
    expect(detail.quickActions).toEqual([{ label: 'Tighten', text: 'Tighten {selection}.' }]);
    expect(detail.reserved).toEqual({ rules: [{ path: 'rules/pace.md', text: 'Keep it moving.\n' }], review: '{"checks":[]}' });
    expect(detail.pack.counts).toEqual({ templates: 0, skills: 0, library: 0, examples: 1, quickActions: 1 });
  });

  it('a folder whose record can’t be read is a diagnostic, not a failure', async () => {
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    await fs.mkdir(path.join(world.packsDir, 'broken'));
    await fs.writeFile(path.join(world.packsDir, 'broken', PACK_RECORD_FILE), '{not json');
    await fs.mkdir(path.join(world.packsDir, 'empty'));
    const list = await world.registry.list();
    expect(list.packs.map((p) => p.id)).toEqual(['news-desk']);
    expect(list.diagnostics.map((d) => d.dir)).toEqual(['broken', 'empty']);
    expect(list.diagnostics[0]!.issues[0]).toContain(PACK_RECORD_FILE);
    expect(await world.registry.get('broken')).toBeNull();
  });

  it('owners: the pack that wrote an item, else the pack that names it', async () => {
    await world.writeTemplate(world.templatesDir, 'news-desk-daily', { title: 'Mine' });
    await world.installer.install({ source: SAMPLE_PACK_DIR });
    const owner = await world.registry.owners();
    // The user's own copy was kept, but the pack names it, so its style still applies.
    expect(owner('template', 'news-desk-daily')).toEqual({ id: 'news-desk', name: 'News desk' });
    expect(owner('skill', 'news-desk-headlines')).toEqual({ id: 'news-desk', name: 'News desk' });
    expect(owner('template', 'other')).toBeNull();
  });
});
