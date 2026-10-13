import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PACK_LIMITS,
  expandQuickAction,
  isPackId,
  packFileRole,
  packMissingFiles,
  packPathProblem,
  slugPackId,
  type PackManifest,
} from './pack.ts';
import { PACK_PARAM_SCHEMAS, parsePackManifest } from './pack-schemas.ts';

const base = { format: 'cuccut.pack', schema: 1, id: 'news-desk', name: 'News desk' };
const sha = 'a'.repeat(64);

function parsed(value: unknown): PackManifest {
  const result = parsePackManifest(value);
  if (!result.ok) throw new Error(`${result.code}: ${result.issues.join('; ')}`);
  return result.manifest;
}

function code(value: unknown): string | null {
  const result = parsePackManifest(value);
  return result.ok ? null : result.code;
}

describe('pack.json', () => {
  it('fills the defaults of a minimal manifest', () => {
    expect(parsed(base)).toEqual({
      ...base,
      version: '1.0.0',
      description: '',
      author: '',
      license: '',
      templates: [],
      skills: [],
      library: [],
      style: '',
      examples: [],
      quickActions: [],
      rules: [],
      review: '',
    });
  });

  it('parses the sample pack in packs/news-desk', () => {
    const raw = JSON.parse(fs.readFileSync(new URL('../../../packs/news-desk/pack.json', import.meta.url), 'utf8'));
    const manifest = parsed(raw);
    expect(manifest).toMatchObject({ id: 'news-desk', templates: ['news-desk-daily'], skills: ['news-desk-headlines'], style: 'STYLE.md' });
    expect(manifest.library).toHaveLength(2);
    expect(manifest.examples).toHaveLength(1);
    expect(manifest.quickActions).toHaveLength(3);
    expect(manifest.quickActions.every((q) => q.text.includes('{selection}'))).toBe(true);
    // Every file in the folder is named by the manifest, and everything the manifest names is there.
    const root = new URL('../../../packs/news-desk/', import.meta.url);
    const files = (fs.readdirSync(root, { recursive: true }) as string[])
      .map((f) => f.split('\\').join('/'))
      .filter((f) => fs.statSync(new URL(f, root)).isFile() && !f.split('/').some((seg) => seg.startsWith('.')));
    for (const file of files) expect(packFileRole(manifest, file), file).not.toBeNull();
    expect(packMissingFiles(manifest, new Set(files))).toEqual([]);
  });

  it('tells an agentcut manifest, another format and a missing format apart', () => {
    const agentcut = { id: 'streamer-kit', name: 'Streamer kit', templates: ['stream-look'], rules: ['gaming'], glossary: [] };
    expect(code(agentcut)).toBe('PACK_FOREIGN_FORMAT');
    expect(code({ ...base, format: 'agentcut.pack' })).toBe('PACK_FOREIGN_FORMAT');
    expect(code({ schema: 1, id: 'x', name: 'X' })).toBe('PACK_INVALID');
    expect(code(null)).toBe('PACK_INVALID');
    expect(code([base])).toBe('PACK_INVALID');
  });

  it('refuses recipes, other schemas and reserved ids with their own codes', () => {
    expect(code({ ...base, recipes: [] })).toBe('PACK_UNSUPPORTED_FIELD');
    expect(code({ ...base, recipeFiles: ['recipes/lib.mjs'] })).toBe('PACK_UNSUPPORTED_FIELD');
    expect(code({ ...base, schema: 2 })).toBe('PACK_UNSUPPORTED_SCHEMA');
    expect(code({ ...base, schema: undefined })).toBe('PACK_UNSUPPORTED_SCHEMA');
    expect(code({ ...base, id: 'import' })).toBe('PACK_ID_RESERVED');
    expect(code({ ...base, id: 'export' })).toBe('PACK_ID_RESERVED');
  });

  it('checks ids, unknown fields and limits', () => {
    for (const id of ['News', '1st', 'a--b', 'a_b', '-a', 'a-', 'x'.repeat(PACK_LIMITS.id + 1)]) expect(code({ ...base, id }), id).toBe('PACK_INVALID');
    expect(code({ ...base, id: 'a1-b2' })).toBeNull();
    expect(code({ ...base, glossary: [] })).toBe('PACK_INVALID');
    expect(code({ ...base, name: ' padded' })).toBe('PACK_INVALID');
    expect(code({ ...base, name: 'x'.repeat(PACK_LIMITS.name + 1) })).toBe('PACK_INVALID');
    expect(code({ ...base, templates: ['Bad Id'] })).toBe('PACK_INVALID');
    expect(code({ ...base, templates: Array.from({ length: PACK_LIMITS.templates + 1 }, (_, i) => `t${i}`) })).toBe('PACK_INVALID');
    expect(code({ ...base, templates: ['a', 'a'] })).toBe('PACK_INVALID');
    expect(code({ ...base, skills: ['字幕-流程'] })).toBeNull();
    expect(code({ ...base, quickActions: [{ label: 'x'.repeat(PACK_LIMITS.quickActionLabel + 1), text: 'go' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, quickActions: [{ label: 'A', text: 'go' }, { label: 'A', text: 'again' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, quickActions: Array.from({ length: PACK_LIMITS.quickActions + 1 }, (_, i) => ({ label: `q${i}`, text: 't' })) })).toBe(
      'PACK_INVALID',
    );
  });

  it('keeps library, references and the style guide in their places', () => {
    expect(code({ ...base, library: [{ file: 'library/terms.md' }] })).toBeNull();
    expect(code({ ...base, library: [{ file: 'terms.md' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, library: [{ file: 'library/narrator.bcvoice' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, library: [{ file: 'library/../pack.json' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, library: [{ file: 'library/.hidden' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, style: 'STYLE.md' })).toBeNull();
    expect(code({ ...base, style: 'docs/STYLE.md' })).toBe('PACK_INVALID');
    expect(code({ ...base, style: 'STYLE.txt' })).toBe('PACK_INVALID');
    expect(code({ ...base, review: 'review.json' })).toBeNull();
    expect(code({ ...base, review: 'review.md' })).toBe('PACK_INVALID');
    const example = { file: 'examples/take.mp4', kind: 'video', title: 'Take', note: 'Look at the hook.', still: 'examples/take.mp4.jpg' };
    expect(code({ ...base, examples: [example] })).toBeNull();
    expect(code({ ...base, examples: [{ ...example, kind: 'image' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, examples: [{ ...example, still: 'examples/take.gif.mp4' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, examples: [{ ...example, file: 'take.mp4' }] })).toBe('PACK_INVALID');
    expect(code({ ...base, examples: [{ ...example, note: 'x'.repeat(PACK_LIMITS.exampleNote + 1) }] })).toBe('PACK_INVALID');
    expect(parsed({ ...base, examples: [{ file: 'examples/a.png', kind: 'image' }] }).examples[0]).toEqual({
      file: 'examples/a.png',
      kind: 'image',
      title: '',
      note: '',
    });
  });

  it('checks the files index', () => {
    expect(code({ ...base, files: [{ path: 'pack.json', size: 10, sha256: sha }] })).toBeNull();
    expect(code({ ...base, files: [{ path: 'pack.json', size: 10, sha256: 'A'.repeat(64) }] })).toBe('PACK_INVALID');
    expect(code({ ...base, files: [{ path: '/etc/passwd', size: 10, sha256: sha }] })).toBe('PACK_INVALID');
    expect(code({ ...base, files: [{ path: 'a', size: 1, sha256: sha }, { path: 'a', size: 1, sha256: sha }] })).toBe('PACK_INVALID');
    expect(code({ ...base, files: [{ path: 'a', size: PACK_LIMITS.totalBytes + 1, sha256: sha }] })).toBe('PACK_INVALID');
    expect(code({ ...base, files: [{ path: 'a', size: -1, sha256: sha }] })).toBe('PACK_INVALID');
  });

  it('reports issues as path: message', () => {
    const result = parsePackManifest({ ...base, templates: ['Bad Id'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toMatch(/^templates\.0: /);
  });
});

describe('pack paths and ids', () => {
  it('accepts relative paths inside the pack only', () => {
    expect(packPathProblem('templates/a/prompt.md')).toBeNull();
    for (const bad of ['', '/abs', 'C:/x', '~/x', 'a//b', 'a/./b', '../x', 'a\\b', 'a/.git/config', '.env', 'x'.repeat(PACK_LIMITS.path + 1)]) {
      expect(packPathProblem(bad), bad).not.toBeNull();
    }
  });

  it('names what each file is by the manifest', () => {
    const manifest = parsed({
      ...base,
      templates: ['scene'],
      skills: ['craft'],
      library: [{ file: 'library/terms.md' }],
      style: 'STYLE.md',
      examples: [{ file: 'examples/a.mp4', kind: 'video', still: 'examples/a.mp4.jpg' }],
      rules: ['gaming'],
      review: 'review.json',
    });
    expect(packFileRole(manifest, 'pack.json')).toBe('manifest');
    expect(packFileRole(manifest, 'templates/scene/template.json')).toBe('template');
    expect(packFileRole(manifest, 'templates/scene/assets/a.png')).toBe('template');
    expect(packFileRole(manifest, 'templates/other/template.json')).toBeNull();
    expect(packFileRole(manifest, 'templates/scene')).toBeNull();
    expect(packFileRole(manifest, 'skills/craft/SKILL.md')).toBe('skill');
    expect(packFileRole(manifest, 'library/terms.md')).toBe('library');
    expect(packFileRole(manifest, 'library/other.md')).toBeNull();
    expect(packFileRole(manifest, 'STYLE.md')).toBe('style');
    expect(packFileRole(manifest, 'examples/a.mp4')).toBe('example');
    expect(packFileRole(manifest, 'examples/a.mp4.jpg')).toBe('still');
    expect(packFileRole(manifest, 'rules/gaming.json')).toBe('rules');
    expect(packFileRole(manifest, 'review.json')).toBe('review');
    expect(packFileRole(manifest, 'README.md')).toBe('doc');
    expect(packFileRole(manifest, 'LICENSE')).toBe('doc');
    expect(packFileRole(manifest, 'docs/README.md')).toBeNull();
    expect(packFileRole(parsed(base), 'rules/gaming.json')).toBeNull();
    expect(packMissingFiles(manifest, new Set(['pack.json', 'templates/scene/template.json', 'STYLE.md']))).toEqual([
      'skills/craft/',
      'library/terms.md',
      'examples/a.mp4',
      'examples/a.mp4.jpg',
      'review.json',
    ]);
  });

  it('slugs a name into an id and keeps the reserved ids free', () => {
    expect(slugPackId('News desk')).toBe('news-desk');
    expect(slugPackId('Bản tin Đà Nẵng!')).toBe('ban-tin-da-nang');
    expect(slugPackId('2024 recap')).toBe('recap');
    expect(slugPackId('Import')).toBe('import-pack');
    expect(slugPackId('字幕')).toBeNull();
    expect(isPackId('news-desk')).toBe(true);
    expect(isPackId('export')).toBe(false);
    expect(isPackId('News')).toBe(false);
  });

  it('expands every {selection} in a quick action', () => {
    expect(expandQuickAction('Cut {selection}, then caption {selection}.', '“Intro”')).toBe('Cut “Intro”, then caption “Intro”.');
    expect(expandQuickAction('No placeholder', 'x')).toBe('No placeholder');
  });
});

describe('packs.* parameters', () => {
  it('takes a token or a source for install, never both', () => {
    const install = PACK_PARAM_SCHEMAS['packs.install'];
    expect(install.safeParse({ token: 'abcdefgh12' }).success).toBe(true);
    expect(install.safeParse({ source: '/Users/me/packs/news-desk', replace: true, commandId: 'c1' }).success).toBe(true);
    expect(install.safeParse({ token: 'abcdefgh12', source: '/x' }).success).toBe(false);
    expect(install.safeParse({}).success).toBe(false);
    expect(install.safeParse({ token: 'bad token!' }).success).toBe(false);
  });

  it('takes a pack id, none or null as a project choice', () => {
    const choose = PACK_PARAM_SCHEMAS['packs.choose'];
    for (const pack of ['news-desk', 'none', null]) expect(choose.safeParse({ projectId: 'p1', pack }).success).toBe(true);
    expect(choose.safeParse({ projectId: 'p1', pack: 'News' }).success).toBe(false);
    expect(choose.safeParse({ projectId: 'p1' }).success).toBe(false);
    const active = PACK_PARAM_SCHEMAS['packs.active'];
    expect(active.safeParse({ conversationId: 'c1' }).success).toBe(true);
    expect(active.safeParse({ projectId: 'p1' }).success).toBe(true);
    expect(active.safeParse({}).success).toBe(false);
  });

  it('checks export input: absolute folder, free id, no voices', () => {
    const exportSchema = PACK_PARAM_SCHEMAS['packs.export'];
    const input = {
      dir: '/Users/me/CucCut/Packs/news-desk',
      manifest: { id: 'news-desk', name: 'News desk' },
      templates: ['news-desk-daily'],
      skills: ['news-desk-headlines'],
      library: [{ library: 'glossaries', id: 'g1' }],
      quickActions: [{ label: 'Tighten', text: 'Tighten {selection}.' }],
    };
    expect(exportSchema.safeParse(input).success).toBe(true);
    expect(exportSchema.safeParse({ ...input, dir: 'relative/dir' }).success).toBe(false);
    expect(exportSchema.safeParse({ ...input, manifest: { id: 'import', name: 'X' } }).success).toBe(false);
    expect(exportSchema.safeParse({ ...input, library: [{ library: 'voices', id: 'v1' }] }).success).toBe(false);
  });

  it('refuses paths outside the pack for handles and references', () => {
    expect(PACK_PARAM_SCHEMAS['packs.openHandle'].safeParse({ id: 'news-desk', path: 'examples/a.png' }).success).toBe(true);
    expect(PACK_PARAM_SCHEMAS['packs.openHandle'].safeParse({ id: 'news-desk', path: '../secret' }).success).toBe(false);
    expect(PACK_PARAM_SCHEMAS['packs.removeExample'].safeParse({ id: 'news-desk', file: '/abs.png' }).success).toBe(false);
    expect(PACK_PARAM_SCHEMAS['packs.addExample'].safeParse({ id: 'news-desk', path: 'rel.png' }).success).toBe(false);
  });
});
