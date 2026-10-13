import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PACK_LIMITS, RpcError } from '@cuccut/protocol';
import { readLibraryImport } from '@cuccut/runtime-storage/library';
import { loadSkill } from '../skills/skill-catalog.ts';
import { FAKE_GITHUB_SHA, fakeGithub, fakeGithubOptions } from '../skills/testing/github-fake.ts';
import { loadTemplate } from '../templates/template-catalog.ts';
import { parsePackSource, readPackSource, type PackSourceOptions } from './pack-source.ts';
import { SAMPLE_PACK_DIR, fakePackHost, readFolder, writeFilesIndex, writePack } from './testing/pack-fixtures.ts';

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

const details = (error: RpcError) => error.details as { code: string; issues?: string[]; source?: string };

let root: string;
let staging: string;
let offline: boolean;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pack-source-'));
  staging = path.join(root, 'staging');
  await fs.mkdir(staging);
  offline = false;
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const options = (extra: Partial<PackSourceOptions> = {}): PackSourceOptions => ({ offlineStrict: () => offline, ...extra });
const stagedFiles = async () => Object.keys(await readFolder(staging)).sort();

describe('classifying a source', () => {
  it('reads folders, GitHub addresses and https base addresses', () => {
    expect(parsePackSource('/Users/me/packs/news-desk')).toEqual({ kind: 'local', path: path.resolve('/Users/me/packs/news-desk') });
    expect(parsePackSource('~/packs/x', '/home/me')).toEqual({ kind: 'local', path: path.join('/home/me', 'packs/x') });
    expect(parsePackSource('  https://github.com/o/r/tree/main/packs/news-desk ')).toMatchObject({
      kind: 'github',
      github: { owner: 'o', repo: 'r', ref: 'main', path: 'packs/news-desk' },
    });
    expect(parsePackSource('github.com/o/r')).toMatchObject({ kind: 'github', github: { owner: 'o', repo: 'r', ref: null } });
    expect(parsePackSource('o/r')).toMatchObject({ kind: 'github', github: { owner: 'o', repo: 'r' } });
    expect(parsePackSource('https://cdn.example.com/packs/news-desk')).toEqual({ kind: 'url', url: 'https://cdn.example.com/packs/news-desk/' });
    expect(parsePackSource('https://cdn.example.com/packs/news-desk/pack.json#top')).toEqual({
      kind: 'url',
      url: 'https://cdn.example.com/packs/news-desk/',
    });
  });

  it('refuses what cannot be read, with PACK_URL_INVALID', () => {
    for (const bad of ['', '   ', 'http://cdn.example.com/p/', 'ftp://x/y', 'https://u:p@cdn.example.com/p/', 'https://cdn.example.com/p/?v=1', './x', 'x']) {
      let caught: unknown;
      try {
        parsePackSource(bad);
      } catch (error) {
        caught = error;
      }
      expect(caught, bad).toBeInstanceOf(RpcError);
      expect(details(caught as RpcError).code, bad).toBe('PACK_URL_INVALID');
    }
    expect(() => parsePackSource('https://github.com/o/r/blob/main/pack.json')).toThrow(RpcError);
  });
});

describe('a local folder', () => {
  it('reads the sample pack, and every item in it loads with the catalogs CucCut already has', async () => {
    const staged = await readPackSource(SAMPLE_PACK_DIR, staging, options());
    expect(staged.manifest.id).toBe('news-desk');
    expect(staged.source).toEqual({ kind: 'local', path: SAMPLE_PACK_DIR });
    expect(staged.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(staged.files.map((f) => [f.path, f.role])).toEqual([
      ['STYLE.md', 'style'],
      ['examples/lower-third.png', 'example'],
      ['library/news-desk-red.json', 'library'],
      ['library/news-desk-terms.md', 'library'],
      ['pack.json', 'manifest'],
      ['skills/news-desk-headlines/SKILL.md', 'skill'],
      ['templates/news-desk-daily/prompt.md', 'template'],
      ['templates/news-desk-daily/template.json', 'template'],
    ]);
    expect(staged.bytes).toBe(staged.files.reduce((sum, f) => sum + f.size, 0));
    expect(await stagedFiles()).toEqual(staged.files.map((f) => f.path));

    const template = await loadTemplate(path.join(staging, 'templates', 'news-desk-daily'), 'user');
    expect('code' in template ? template.issues : []).toEqual([]);
    const skill = await loadSkill(path.join(staging, 'skills', 'news-desk-headlines'), 'user');
    expect('code' in skill ? skill.issues : []).toEqual([]);
    const glossary = await readLibraryImport(path.join(staging, 'library', 'news-desk-terms.md'));
    expect(glossary).toMatchObject({ library: 'glossaries', content: { name: 'News desk terms', kind: 'transcription' } });
    const colour = await readLibraryImport(path.join(staging, 'library', 'news-desk-red.json'));
    expect(colour).toMatchObject({ library: 'brand', content: { kind: 'color', value: '#C8102E' } });
  });

  it('keeps documentation files, skips dot files, and refuses files the manifest does not name', async () => {
    const dir = await writePack(root, 'docs', {
      templates: { scene: null },
      files: { 'README.md': '# Docs', LICENSE: 'CC-BY-4.0', '.DS_Store': 'x', '.git/config': 'x', 'templates/scene/.hidden': 'x' },
    });
    const staged = await readPackSource(dir, staging, options());
    expect(staged.files.map((f) => f.path)).toEqual(['LICENSE', 'README.md', 'pack.json', 'templates/scene/prompt.md', 'templates/scene/template.json']);
    expect(staged.files.find((f) => f.path === 'README.md')?.role).toBe('doc');

    await fs.writeFile(path.join(dir, 'notes.txt'), 'stray');
    const fresh = path.join(root, 'staging-2');
    await fs.mkdir(fresh);
    const error = await rejection(readPackSource(dir, fresh, options()));
    expect(details(error)).toMatchObject({ code: 'PACK_INVALID', source: dir });
    expect(details(error).issues!.join('\n')).toContain('notes.txt');
  });

  it('refuses a pack that lacks what its manifest names', async () => {
    const dir = await writePack(root, 'lacking', {
      manifest: { templates: ['scene'], library: [{ file: 'library/terms.md' }], style: 'STYLE.md' },
    });
    const error = await rejection(readPackSource(dir, staging, options()));
    expect(details(error).code).toBe('PACK_INVALID');
    expect(details(error).issues).toHaveLength(3);
  });

  it('refuses symbolic links and folders over the limits before copying', async () => {
    const linked = await writePack(root, 'linked', { files: { 'README.md': 'x' } });
    await fs.symlink(path.join(linked, 'README.md'), path.join(linked, 'LICENSE'));
    expect(details(await rejection(readPackSource(linked, staging, options()))).code).toBe('PACK_INVALID');
    expect(await stagedFiles()).toEqual([]);

    const files: Record<string, string> = {};
    for (let i = 0; i < PACK_LIMITS.files; i++) files[`skills/big/f${i}.md`] = 'x';
    const big = await writePack(root, 'big', { skills: { big: null }, files });
    const error = await rejection(readPackSource(big, staging, options()));
    expect(error.details).toMatchObject({ code: 'PACK_TOO_LARGE', limit: { files: PACK_LIMITS.files } });
    expect(await stagedFiles()).toEqual([]);
  });

  it('refuses a missing folder, a folder without pack.json, and the packs folder itself', async () => {
    expect(details(await rejection(readPackSource(path.join(root, 'nope'), staging, options()))).code).toBe('PACK_SOURCE_NOT_FOUND');
    const empty = path.join(root, 'empty');
    await fs.mkdir(empty);
    expect(details(await rejection(readPackSource(empty, staging, options()))).code).toBe('PACK_SOURCE_NOT_FOUND');

    const packsDir = path.join(root, 'home', 'packs');
    const installed = await writePack(packsDir, 'news-desk');
    expect(details(await rejection(readPackSource(installed, staging, options({ packsDir })))).code).toBe('PACK_INVALID');
    expect(details(await rejection(readPackSource(root, staging, options()))).code).toBe('PACK_INVALID');
  });

  it('refuses foreign manifests and code with their own codes, before copying anything', async () => {
    const agentcut = await writePack(root, 'agentcut');
    await fs.writeFile(path.join(agentcut, 'pack.json'), JSON.stringify({ id: 'streamer-kit', name: 'Streamer kit', templates: ['x'], rules: [] }));
    expect(details(await rejection(readPackSource(agentcut, staging, options()))).code).toBe('PACK_FOREIGN_FORMAT');
    const recipes = await writePack(root, 'recipes', { manifest: { recipes: [] }, files: { 'README.md': 'x' } });
    expect(details(await rejection(readPackSource(recipes, staging, options()))).code).toBe('PACK_UNSUPPORTED_FIELD');
    const reserved = await writePack(root, 'reserved', { manifest: { id: 'import' } });
    expect(details(await rejection(readPackSource(reserved, staging, options()))).code).toBe('PACK_ID_RESERVED');
    const newer = await writePack(root, 'newer', { manifest: { schema: 2 } });
    expect(details(await rejection(readPackSource(newer, staging, options()))).code).toBe('PACK_UNSUPPORTED_SCHEMA');
    const broken = await writePack(root, 'broken');
    await fs.writeFile(path.join(broken, 'pack.json'), '{ not json');
    expect(details(await rejection(readPackSource(broken, staging, options()))).code).toBe('PACK_INVALID');
    expect(await stagedFiles()).toEqual([]);
  });

  it('checks the files index when the folder has one', async () => {
    const dir = await writePack(root, 'indexed', { templates: { scene: null }, files: { 'STYLE.md': 'Calm.' }, manifest: { style: 'STYLE.md' }, index: true });
    const staged = await readPackSource(dir, staging, options());
    expect(staged.manifest.files?.map((f) => f.path)).toEqual(['STYLE.md', 'templates/scene/prompt.md', 'templates/scene/template.json']);

    await fs.writeFile(path.join(dir, 'STYLE.md'), 'Edited after export.');
    const again = path.join(root, 'staging-2');
    await fs.mkdir(again);
    const error = await rejection(readPackSource(dir, again, options()));
    expect(details(error).code).toBe('PACK_INVALID');
    expect(details(error).issues!.join('\n')).toContain('STYLE.md');

    await writeFilesIndex(dir);
    await fs.writeFile(path.join(dir, 'README.md'), 'Docs need no index entry.');
    await fs.writeFile(path.join(dir, 'templates', 'scene', 'cover.png'), 'unlisted');
    const third = path.join(root, 'staging-3');
    await fs.mkdir(third);
    expect(details(await rejection(readPackSource(dir, third, options()))).issues!.join('\n')).toContain('templates/scene/cover.png');
  });
});

describe('a GitHub address', () => {
  const github = async (files: Record<string, string | Uint8Array>, extra: Parameters<typeof fakeGithub>[1] = {}) => {
    const fake = fakeGithub(files, extra);
    return { fake, opts: options({ github: fakeGithubOptions(fake) }) };
  };

  it('reads a pack at the root or in a subfolder, at one commit', async () => {
    const sample = await readFolder(SAMPLE_PACK_DIR);
    const { fake, opts } = await github({ ...sample, '.github/workflows/ci.yml': 'x' });
    const staged = await readPackSource('o/r', staging, opts);
    expect(staged.source).toEqual({ kind: 'github', url: 'https://github.com/o/r', owner: 'o', repo: 'r', ref: 'main', commit: FAKE_GITHUB_SHA, path: '' });
    expect(staged.manifest.id).toBe('news-desk');
    expect(fake.requests.some((u) => u.includes('.github'))).toBe(false);

    const nested: Record<string, Uint8Array> = {};
    for (const [rel, body] of Object.entries(sample)) nested[`packs/news-desk/${rel}`] = body;
    const sub = await github({ ...nested, 'README.md': 'repo readme' });
    const again = path.join(root, 'staging-2');
    await fs.mkdir(again);
    const inSub = await readPackSource('https://github.com/o/r/tree/main/packs/news-desk', again, sub.opts);
    expect(inSub.source).toMatchObject({ kind: 'github', path: 'packs/news-desk', commit: FAKE_GITHUB_SHA });
    expect(sub.fake.requests.some((u) => u.endsWith('/README.md'))).toBe(false);
  });

  it('refuses before downloading: no pack.json, too many files, a missing folder', async () => {
    const missing = await github({ 'README.md': 'x', 'sub/pack.json': '{}' });
    const noManifest = await rejection(readPackSource('o/r', staging, missing.opts));
    expect(details(noManifest)).toMatchObject({ code: 'PACK_INVALID', source: 'https://github.com/o/r' });
    expect(missing.fake.requests.some((u) => u.startsWith('https://raw.test'))).toBe(false);

    const files: Record<string, string> = { 'pack.json': '{}' };
    for (let i = 0; i < PACK_LIMITS.files; i++) files[`skills/big/f${i}.md`] = 'x';
    const tooMany = await github(files);
    expect(details(await rejection(readPackSource('o/r', staging, tooMany.opts))).code).toBe('PACK_TOO_LARGE');
    expect(tooMany.fake.requests.some((u) => u.startsWith('https://raw.test'))).toBe(false);

    const folder = await github({ 'pack.json': '{}' });
    expect(details(await rejection(readPackSource('https://github.com/o/r/tree/main/nope', staging, folder.opts))).code).toBe(
      'PACK_SOURCE_NOT_FOUND',
    );
  });

  it('checks the downloaded pack like a folder', async () => {
    const { opts } = await github({ 'pack.json': JSON.stringify({ id: 'kit', name: 'Kit', templates: ['x'] }) });
    expect(details(await rejection(readPackSource('o/r', staging, opts))).code).toBe('PACK_FOREIGN_FORMAT');
  });

  it('reports a used-up rate limit as a network refusal, and reads nothing in strict offline mode', async () => {
    const limited = await github({ 'pack.json': '{}' }, { rateLimited: true });
    expect(details(await rejection(readPackSource('o/r', staging, limited.opts))).code).toBe('PACK_NETWORK');
    offline = true;
    const strict = await github({ 'pack.json': '{}' });
    expect(details(await rejection(readPackSource('o/r', staging, strict.opts))).code).toBe('OFFLINE_STRICT');
    expect(strict.fake.requests).toEqual([]);
  });
});

describe('an https:// address', () => {
  const base = 'https://cdn.test/packs/news-desk/';
  let served: Record<string, Uint8Array>;

  beforeEach(async () => {
    const copy = path.join(root, 'served');
    await fs.cp(SAMPLE_PACK_DIR, copy, { recursive: true });
    await writeFilesIndex(copy);
    served = await readFolder(copy);
  });

  it('reads pack.json, then each listed file, and checks them', async () => {
    const host = fakePackHost(base, served);
    const staged = await readPackSource(`${base}pack.json`, staging, options({ fetch: host.fetch }));
    expect(staged.source).toEqual({ kind: 'url', url: base });
    expect(staged.manifest.files).toHaveLength(7);
    expect(host.requests[0]).toBe(`${base}pack.json`);
    expect(host.requests).toHaveLength(8);
    expect(await stagedFiles()).toEqual(Object.keys(served).sort());
  });

  it('refuses a file whose size or sha256 differs from the index', async () => {
    const longer = fakePackHost(base, { ...served, 'STYLE.md': Buffer.concat([served['STYLE.md']!, Buffer.from('!')]) });
    const error = await rejection(readPackSource(base, staging, options({ fetch: longer.fetch })));
    expect(details(error).code).toBe('PACK_INVALID');
    expect(details(error).issues!.join('\n')).toContain('STYLE.md');

    const tampered = Buffer.from(served['STYLE.md']!);
    tampered[0] = tampered[0] === 0x23 ? 0x24 : 0x23;
    const same = fakePackHost(base, { ...served, 'STYLE.md': tampered });
    const fresh = path.join(root, 'staging-2');
    await fs.mkdir(fresh);
    expect(details(await rejection(readPackSource(base, fresh, options({ fetch: same.fetch })))).issues!.join('\n')).toContain('STYLE.md');
  });

  it('needs the files index, and refuses unnamed entries before downloading them', async () => {
    const manifest = JSON.parse(Buffer.from(served['pack.json']!).toString('utf8')) as Record<string, unknown>;
    const { files: _files, ...withoutIndex } = manifest;
    const bare = fakePackHost(base, { ...served, 'pack.json': JSON.stringify(withoutIndex) });
    expect(details(await rejection(readPackSource(base, staging, options({ fetch: bare.fetch })))).code).toBe('PACK_INVALID');
    expect(bare.requests).toEqual([`${base}pack.json`]);

    const stray = { ...manifest, files: [...(manifest.files as object[]), { path: 'tools/run.sh', size: 3, sha256: 'a'.repeat(64) }] };
    const host = fakePackHost(base, { ...served, 'pack.json': JSON.stringify(stray) });
    const fresh = path.join(root, 'staging-2');
    await fs.mkdir(fresh);
    const error = await rejection(readPackSource(base, fresh, options({ fetch: host.fetch })));
    expect(details(error).code).toBe('PACK_INVALID');
    expect(host.requests).toEqual([`${base}pack.json`]);
  });

  it('refuses an index over the limits before downloading', async () => {
    const manifest = JSON.parse(Buffer.from(served['pack.json']!).toString('utf8')) as { files: { path: string; size: number }[] };
    manifest.files[0]!.size = PACK_LIMITS.totalBytes;
    const host = fakePackHost(base, { ...served, 'pack.json': JSON.stringify(manifest) });
    expect(details(await rejection(readPackSource(base, staging, options({ fetch: host.fetch })))).code).toBe('PACK_TOO_LARGE');
    expect(host.requests).toHaveLength(1);
  });

  it('maps missing files and host failures to their codes', async () => {
    const none = fakePackHost(base, {});
    expect(details(await rejection(readPackSource(base, staging, options({ fetch: none.fetch })))).code).toBe('PACK_SOURCE_NOT_FOUND');

    const { 'STYLE.md': _style, ...rest } = served;
    const gap = fakePackHost(base, rest);
    let fresh = path.join(root, 'staging-2');
    await fs.mkdir(fresh);
    expect(details(await rejection(readPackSource(base, fresh, options({ fetch: gap.fetch })))).code).toBe('PACK_INVALID');

    const failing = fakePackHost(base, served, { 'pack.json': () => new Response('', { status: 503 }) });
    fresh = path.join(root, 'staging-3');
    await fs.mkdir(fresh);
    expect(details(await rejection(readPackSource(base, fresh, options({ fetch: failing.fetch })))).code).toBe('PACK_NETWORK');

    const unreachable = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(details(await rejection(readPackSource(base, fresh, options({ fetch: unreachable })))).code).toBe('PACK_NETWORK');
  });

  it('reads nothing in strict offline mode', async () => {
    offline = true;
    const host = fakePackHost(base, served);
    expect(details(await rejection(readPackSource(base, staging, options({ fetch: host.fetch })))).code).toBe('OFFLINE_STRICT');
    expect(host.requests).toEqual([]);
  });
});
