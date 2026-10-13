import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PACK_MANIFEST_FILE, RpcError, SKILL_SOURCE_FILE, type PackExportParams, type PackManifest } from '@cuccut/protocol';
import { uniqueFileName } from './pack-export.ts';
import { checkStagedPack } from './pack-source.ts';
import { SAMPLE_PACK_DIR, packWorld, type PackWorld } from './testing/pack-fixtures.ts';

/**
 * Export (pack spec §6.4): what travels, the `files` index, the target rules (empty, or an earlier export of the same id whose `.git` and README stay), refusals, and a
 * round trip: the exported folder inspects and installs into a second home.
 */

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

let root: string;
let world: PackWorld;
let out: string;

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pack-export-')));
  world = await packWorld(path.join(root, 'a'));
  out = path.join(root, 'out', 'my-kit');
  // The sample pack brings a template, a skill, two library entries, a guide with a reference image and quick actions; the user has their own template and skill.
  const preview = await world.installer.inspect({ source: SAMPLE_PACK_DIR });
  await world.installer.install({ token: preview.token });
  await world.writeTemplate(world.templatesDir, 'my-promo');
  await world.writeSkillDir(world.skillsDir, 'my-skill');
  await world.writeTemplate(world.builtinTemplates, 'builtin-one');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function params(extra: Partial<PackExportParams> = {}): PackExportParams {
  return {
    dir: out,
    manifest: { id: 'my-kit', name: 'My kit', author: 'Me', description: 'How I make news shorts.' },
    templates: ['my-promo', 'news-desk-daily'],
    skills: ['my-skill', 'news-desk-headlines'],
    library: [...world.library.entries.values()].map((e) => ({ library: e.library as 'glossaries' | 'brand', id: e.id })),
    quickActions: [{ label: 'Tighten', text: 'Tighten {selection}.' }],
    stylePack: 'news-desk',
    ...extra,
  };
}

const readManifest = async (dir: string) => JSON.parse(await fs.readFile(path.join(dir, PACK_MANIFEST_FILE), 'utf8')) as PackManifest;

describe('export', () => {
  it('writes the chosen items, the guide and its references, and a files index a reader accepts', async () => {
    const result = await world.exporter.export(params());
    expect(result.dir).toBe(out);
    const manifest = await readManifest(out);
    expect(manifest).toMatchObject({
      format: 'cuccut.pack',
      schema: 1,
      id: 'my-kit',
      name: 'My kit',
      version: '1.0.0',
      author: 'Me',
      description: 'How I make news shorts.',
      templates: ['my-promo', 'news-desk-daily'],
      skills: ['my-skill', 'news-desk-headlines'],
      style: 'STYLE.md',
      examples: [{ file: 'examples/lower-third.png', kind: 'image', title: 'Lower third' }],
      quickActions: [{ label: 'Tighten', text: 'Tighten {selection}.' }],
      rules: [],
      review: '',
    });
    expect(manifest.library.map((l) => l.name).sort()).toEqual(['News desk red', 'News desk terms']);
    expect(manifest.library.map((l) => l.file).sort()).toEqual(['library/news-desk-red.json', 'library/news-desk-terms.md']);
    expect(await fs.readFile(path.join(out, 'STYLE.md'), 'utf8')).toBe(await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8'));
    // CucCut's own bookkeeping does not travel.
    expect(await exists(path.join(out, 'skills', 'news-desk-headlines', SKILL_SOURCE_FILE))).toBe(false);
    // The index lists every file, and a reader that requires it (an https:// host) accepts the folder.
    const staged = await checkStagedPack(out, { kind: 'local', path: out }, { requireIndex: true });
    expect(manifest.files?.map((f) => f.path)).toEqual(staged.files.filter((f) => f.role !== 'manifest').map((f) => f.path));
    expect(result).toEqual({ dir: out, files: staged.files.length, bytes: staged.bytes });
    // No staging folders are left behind.
    expect((await fs.readdir(out)).filter((n) => n.startsWith('.'))).toEqual([]);
  });

  it('round trip: the exported folder inspects and installs into a second home', async () => {
    await world.exporter.export(params());
    const second = await packWorld(path.join(root, 'b'));
    const preview = await second.installer.inspect({ source: out });
    expect(preview.blocked).toEqual([]);
    expect(preview.templates.map((t) => [t.id, t.state])).toEqual([
      ['my-promo', 'new'],
      ['news-desk-daily', 'new'],
    ]);
    expect(preview.skills.map((s) => [s.id, s.state])).toEqual([
      ['my-skill', 'new'],
      ['news-desk-headlines', 'new'],
    ]);
    const installed = await second.installer.install({ token: preview.token });
    expect(installed.skipped).toEqual([]);
    expect(installed.pack).toMatchObject({
      id: 'my-kit',
      hasStyle: true,
      source: { kind: 'local', path: out },
      counts: { templates: 2, skills: 2, library: 2, examples: 1, quickActions: 1 },
    });
    expect((await second.registry.detail('my-kit')).style?.text).toBe(await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8'));
  });

  it('an empty selection still makes a pack: nothing of its own', async () => {
    const result = await world.exporter.export(params({ templates: [], skills: [], library: [], quickActions: [], stylePack: undefined }));
    expect(result.files).toBe(1);
    expect(await readManifest(out)).toMatchObject({ templates: [], skills: [], library: [], style: '', examples: [], files: [] });
    expect(await fs.readdir(out)).toEqual([PACK_MANIFEST_FILE]);
  });

  it('the target: empty but for dot files and a README; an earlier export of the same id is replaced, keeping .git and README', async () => {
    await fs.mkdir(path.join(out, '.git'), { recursive: true });
    await fs.writeFile(path.join(out, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    await fs.writeFile(path.join(out, 'README.md'), '# My kit\n');
    await world.exporter.export(params());
    expect(await exists(path.join(out, 'templates', 'my-promo'))).toBe(true);

    // Again with less: the dropped template goes, the repository and the README stay.
    await world.exporter.export(params({ templates: ['news-desk-daily'], manifest: { id: 'my-kit', name: 'My kit', version: '1.1.0' } }));
    expect(await exists(path.join(out, 'templates', 'my-promo'))).toBe(false);
    expect((await readManifest(out)).version).toBe('1.1.0');
    expect(await fs.readFile(path.join(out, '.git', 'HEAD'), 'utf8')).toBe('ref: refs/heads/main\n');
    expect(await fs.readFile(path.join(out, 'README.md'), 'utf8')).toBe('# My kit\n');
    await checkStagedPack(out, { kind: 'local', path: out }, { requireIndex: true });
  });

  it('refuses a folder with other files, or an export of another pack, and leaves it as it was', async () => {
    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(path.join(out, 'notes.txt'), 'mine');
    const busy = await rejection(world.exporter.export(params()));
    expect(busy).toMatchObject({ code: 'conflict', details: { code: 'PACK_EXPORT_TARGET_NOT_EMPTY', dir: out } });
    expect(await fs.readdir(out)).toEqual(['notes.txt']);

    await fs.rm(out, { recursive: true });
    await world.exporter.export(params({ manifest: { id: 'other-kit', name: 'Other kit' } }));
    const other = await rejection(world.exporter.export(params()));
    expect(other.details).toMatchObject({ code: 'PACK_EXPORT_TARGET_NOT_EMPTY' });
    expect((await readManifest(out)).id).toBe('other-kit');
  });

  it('refuses an earlier export that holds files it did not write, and deletes none of them', async () => {
    await world.exporter.export(params());
    await fs.mkdir(path.join(out, 'docs'), { recursive: true });
    await fs.writeFile(path.join(out, 'docs', 'notes.md'), 'mine');
    const busy = await rejection(world.exporter.export(params({ templates: ['news-desk-daily'] })));
    expect(busy.details).toMatchObject({ code: 'PACK_EXPORT_TARGET_NOT_EMPTY' });
    expect(await fs.readFile(path.join(out, 'docs', 'notes.md'), 'utf8')).toBe('mine');
    expect(await exists(path.join(out, 'templates', 'my-promo'))).toBe(true);

    // A file of its own inside a directory the export wrote counts too.
    await fs.rm(path.join(out, 'docs'), { recursive: true });
    await fs.writeFile(path.join(out, 'templates', 'my-promo', 'draft.txt'), 'mine');
    expect((await rejection(world.exporter.export(params()))).details).toMatchObject({ code: 'PACK_EXPORT_TARGET_NOT_EMPTY' });
    expect(await fs.readFile(path.join(out, 'templates', 'my-promo', 'draft.txt'), 'utf8')).toBe('mine');
  });

  it('refuses built-in and unknown items and a folder inside CucCut’s own; nothing is written', async () => {
    expect((await rejection(world.exporter.export(params({ templates: ['builtin-one'] })))).details).toMatchObject({ code: 'PACK_INVALID' });
    expect((await rejection(world.exporter.export(params({ templates: ['nope'] })))).details).toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
    expect((await rejection(world.exporter.export(params({ skills: ['nope'] })))).details).toMatchObject({ code: 'SKILL_NOT_FOUND' });
    expect((await rejection(world.exporter.export(params({ stylePack: 'nope' })))).details).toMatchObject({ code: 'PACK_NOT_FOUND' });
    expect(await exists(out)).toBe(false);
    for (const inside of [path.join(world.packsDir, 'my-kit'), path.join(world.templatesDir, 'x'), world.home]) {
      expect((await rejection(world.exporter.export(params({ dir: inside })))).details).toMatchObject({ code: 'PACK_INVALID' });
    }
  });

  it('a failing library write leaves no folder behind', async () => {
    world.library.exportTo = async () => {
      throw new RpcError('internal', 'disk full');
    };
    await rejection(world.exporter.export(params()));
    expect(await exists(out)).toBe(false);
  });
});

describe('uniqueFileName', () => {
  it('slugs the name, keeps the extension, and numbers clashes', () => {
    const taken = new Set<string>();
    expect(uniqueFileName('News desk terms', 'md', taken)).toBe('news-desk-terms.md');
    expect(uniqueFileName('News desk terms', 'md', taken)).toBe('news-desk-terms-2.md');
    expect(uniqueFileName('Từ điển', 'md', taken)).toBe('tu-dien.md');
    expect(uniqueFileName('***', 'json', taken)).toBe('item.json');
    expect(uniqueFileName('x', 'not an ext', taken)).toBe('x');
  });
});
