import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, TEMPLATE_FILE_MAX_BYTES, LOCALES, getLocale, type TemplateManifest } from '@cuccut/protocol';
import { TemplateCatalog, resolveBuiltinTemplatesDir, scanTemplateDir } from './template-catalog.ts';

/** The `templates/` at the repository root: four levels up from this file (packages/runtime-core/src/templates). */
const REPO_TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../templates');
/** The `skills/cuccut/built-in-skills/` at the repository root: the crafts named by the built-in template `skills` must all be here. */
const REPO_SKILLS = path.resolve(REPO_TEMPLATES, '../skills/cuccut/built-in-skills');

const manifest = (id: string, extra: Partial<TemplateManifest> = {}): TemplateManifest => ({
  schema: 1,
  id,
  version: '1.0.0',
  kind: 'scene',
  title: '示例模板',
  summary: '一句话。',
  description: '一小段。',
  language: 'zh-CN',
  category: 'explainer',
  ratio: '16:9',
  durationSeconds: 60,
  brief: '给{{主题}}做一条讲解。',
  fields: [{ label: '主题', example: '光合作用' }],
  author: 'CucCut',
  source: 'community',
  license: 'Apache-2.0',
  tags: [],
  cover: { tone: 'blue', figure: 'steps' },
  preview: { beats: ['一', '二', '三'] },
  ...extra,
});

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-templates-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Writes a template under `dir`: a manifest (any value), a prompt and other files. */
async function writeTemplate(dir: string, name: string, value: unknown, files: Record<string, string | Buffer> = {}) {
  const at = path.join(dir, name);
  await fs.mkdir(at, { recursive: true });
  await fs.writeFile(path.join(at, 'template.json'), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const all = { 'prompt.md': '你要做一条视频。\n', ...files };
  for (const [rel, content] of Object.entries(all)) {
    await fs.mkdir(path.dirname(path.join(at, rel)), { recursive: true });
    await fs.writeFile(path.join(at, rel), content);
  }
  return at;
}

describe('template catalog loading', () => {
  it('compliant templates load with their cover and assets; hidden files and non-directory entries are ignored', async () => {
    await writeTemplate(
      root,
      'with-files',
      manifest('with-files', {
        cover: { file: 'cover.png', tone: 'blue' },
        assets: [{ path: 'assets/logos/x.svg', type: 'svg', note: '片尾标志' }],
      }),
      { 'cover.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'assets/logos/x.svg': '<svg/>', '.DS_Store': 'x' },
    );
    await fs.writeFile(path.join(root, 'README.md'), '说明');
    await fs.mkdir(path.join(root, '.hidden'));

    const scan = await scanTemplateDir(root, 'user');
    expect(scan.diagnostics).toEqual([]);
    expect(scan.templates).toHaveLength(1);
    expect(scan.templates[0]).toMatchObject({ origin: 'user', dir: path.join(root, 'with-files'), prompt: '你要做一条视频。\n' });
  });

  it('bad manifest, id not matching directory name, unknown schema: skipped with a diagnostic, others load as usual', async () => {
    await writeTemplate(root, 'good', manifest('good'));
    await writeTemplate(root, 'broken-json', '{ not json');
    await writeTemplate(root, 'mismatch', manifest('other-id'));
    await writeTemplate(root, 'future', { ...manifest('future'), schema: 2 });
    await writeTemplate(root, 'extra-field', { ...manifest('extra-field'), quality: 'high' });

    const scan = await scanTemplateDir(root, 'builtin');
    expect(scan.templates.map((t) => t.manifest.id)).toEqual(['good']);
    const byDir = Object.fromEntries(scan.diagnostics.map((d) => [d.dir, d]));
    expect(byDir['broken-json']).toMatchObject({ code: 'invalid', origin: 'builtin', path: path.join(root, 'broken-json') });
    expect(byDir['mismatch']).toMatchObject({ code: 'invalid' });
    expect(byDir['mismatch']!.issues.join()).toContain('目录名');
    expect(byDir['future']).toMatchObject({ code: 'unsupported-schema' });
    expect(byDir['extra-field']).toMatchObject({ code: 'invalid' });
  });

  it('prompt.md missing, empty, over the limit or not UTF-8 is non-compliant', async () => {
    await writeTemplate(root, 'empty-prompt', manifest('empty-prompt'), { 'prompt.md': '  \n' });
    await writeTemplate(root, 'big-prompt', manifest('big-prompt'), { 'prompt.md': 'x'.repeat(16 * 1024 + 1) });
    await writeTemplate(root, 'bad-utf8', manifest('bad-utf8'), { 'prompt.md': Buffer.from([0xff, 0xfe, 0x41]) });
    const missing = await writeTemplate(root, 'no-prompt', manifest('no-prompt'));
    await fs.rm(path.join(missing, 'prompt.md'));

    const scan = await scanTemplateDir(root, 'user');
    expect(scan.templates).toEqual([]);
    expect(Object.fromEntries(scan.diagnostics.map((d) => [d.dir, d.issues.join()]))).toEqual({
      'empty-prompt': 'prompt.md 是空的',
      'big-prompt': 'prompt.md 超过 16384 字节',
      'bad-utf8': 'prompt.md 不是合法的 UTF-8',
      'no-prompt': '缺少 prompt.md',
    });
  });

  it('placeholders: scene\'s prompt.md must not contain {{, example\'s prompt.md must match fields', async () => {
    const example = (id: string, fields: TemplateManifest['fields']) => {
      const { ratio: _r, durationSeconds: _d, brief: _b, fields: _f, ...rest } = manifest(id);
      return { ...rest, kind: 'example' as const, ...(fields ? { fields } : {}) };
    };
    await writeTemplate(root, 'scene-slot', manifest('scene-slot'), { 'prompt.md': '你要给{{主题}}做一条讲解。\n' });
    await writeTemplate(root, 'example-ok', example('example-ok', [{ label: '主题' }]), { 'prompt.md': '给{{主题}}做一条讲解。\n' });
    await writeTemplate(root, 'example-undeclared', example('example-undeclared', undefined), { 'prompt.md': '给{{主题}}做一条讲解。\n' });
    await writeTemplate(root, 'example-unused', example('example-unused', [{ label: '主题' }, { label: '受众' }]), {
      'prompt.md': '给{{主题}}做一条讲解。\n',
    });

    const scan = await scanTemplateDir(root, 'user');
    expect(scan.templates.map((t) => t.manifest.id)).toEqual(['example-ok']);
    expect(Object.fromEntries(scan.diagnostics.map((d) => [d.dir, d.issues.join()]))).toEqual({
      'scene-slot': '场景模板的 prompt.md 不能含 {{ 占位符，待填项写在 brief 里',
      'example-undeclared': '{{主题}} 没有在 fields 里声明',
      'example-unused': '待填项「受众」没有被引用（{{受众}}）',
    });
  });

  it('registered files must exist, and all files in the directory must be registered', async () => {
    await writeTemplate(root, 'missing-cover', manifest('missing-cover', { cover: { file: 'cover.png', tone: 'blue' } }));
    await writeTemplate(root, 'stray-file', manifest('stray-file'), { 'notes.txt': '草稿', 'assets/x.svg': '<svg/>' });

    const scan = await scanTemplateDir(root, 'user');
    expect(scan.templates).toEqual([]);
    const issues = Object.fromEntries(scan.diagnostics.map((d) => [d.dir, d.issues]));
    expect(issues['missing-cover']).toEqual(['登记的文件不存在：cover.png']);
    expect(issues['stray-file']).toEqual(['目录里有没登记的文件：assets/x.svg', '目录里有没登记的文件：notes.txt']);
  });

  it('cover and preview over the size limit are non-compliant', async () => {
    const cover = { file: 'cover.jpg', tone: 'blue' as const };
    const big = manifest('too-big', { cover, preview: { file: 'preview.mp4' } });
    await writeTemplate(root, 'too-big', big, {
      'cover.jpg': Buffer.alloc(TEMPLATE_FILE_MAX_BYTES.cover + 1),
      'preview.mp4': Buffer.alloc(TEMPLATE_FILE_MAX_BYTES.preview + 1),
    });
    const limit = manifest('at-limit', { cover, preview: { file: 'preview.mp4' } });
    await writeTemplate(root, 'at-limit', limit, {
      'cover.jpg': Buffer.alloc(TEMPLATE_FILE_MAX_BYTES.cover),
      'preview.mp4': Buffer.alloc(TEMPLATE_FILE_MAX_BYTES.preview),
    });

    const scan = await scanTemplateDir(root, 'user');
    expect(scan.templates.map((t) => t.manifest.id)).toEqual(['at-limit']);
    expect(scan.diagnostics.map((d) => [d.dir, d.issues.length])).toEqual([['too-big', 2]]);
    expect(scan.diagnostics[0]!.issues[0]).toMatch(/^cover\.jpg 超过 153600 字节/);
  });

  it('a manifest path that goes outside the template directory is non-compliant', async () => {
    await writeTemplate(root, 'escape', manifest('escape', { assets: [{ path: 'assets/../../secret.svg', type: 'svg', note: '标志' }] }));
    const scan = await scanTemplateDir(root, 'user');
    expect(scan.templates).toEqual([]);
    expect(scan.diagnostics[0]).toMatchObject({ code: 'invalid', dir: 'escape' });
  });

  it('symbolic links are not followed: a link in a template makes it non-compliant, and a template directory that links outward is not loaded', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'secret.svg'), '<svg/>');
      const linked = await writeTemplate(
        root,
        'linked-asset',
        manifest('linked-asset', { assets: [{ path: 'assets/secret.svg', type: 'svg', note: '标志' }] }),
      );
      await fs.mkdir(path.join(linked, 'assets'), { recursive: true });
      await fs.symlink(path.join(outside, 'secret.svg'), path.join(linked, 'assets', 'secret.svg'));
      await writeTemplate(outside, 'elsewhere', manifest('elsewhere'));
      await fs.symlink(path.join(outside, 'elsewhere'), path.join(root, 'elsewhere'));

      const scan = await scanTemplateDir(root, 'user');
      expect(scan.templates).toEqual([]);
      const byDir = Object.fromEntries(scan.diagnostics.map((d) => [d.dir, d]));
      expect(byDir['linked-asset']!.issues).toEqual(['不得含符号链接：assets/secret.svg']);
      expect(byDir['elsewhere']!.message).toContain('符号链接');
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('a relative-path directory loads as usual, diagnostics give the absolute path', async () => {
    await writeTemplate(root, 'good', manifest('good'));
    await writeTemplate(root, 'bad', manifest('other'));
    const scan = await scanTemplateDir(path.relative(process.cwd(), root), 'builtin');
    expect(scan.templates.map((t) => [t.manifest.id, t.dir])).toEqual([['good', path.join(root, 'good')]]);
    expect(scan.diagnostics.map((d) => d.path)).toEqual([path.join(root, 'bad')]);
  });

  it('empty when the directory does not exist', async () => {
    expect(await scanTemplateDir(path.join(root, 'nope'), 'user')).toEqual({ templates: [], diagnostics: [] });
  });
});

describe('language versions', () => {
  const en = {
    title: 'Sample template',
    summary: 'One line.',
    description: 'A short paragraph.',
    brief: 'Make an explainer about {{topic}}.',
    fields: [{ label: 'topic', example: 'photosynthesis' }],
    tags: [],
    preview: { beats: ['One', 'Two', 'Three'] },
  };
  const ja = { ...en, title: 'サンプル', brief: '{{テーマ}}の解説動画を作ります。', fields: [{ label: 'テーマ', example: '光合成' }] };
  const overlays = (extra: Record<string, string> = {}) => ({
    'locales/en.json': JSON.stringify(en),
    'locales/en.md': 'You are making a video.\n',
    'locales/ja.json': JSON.stringify(ja),
    'locales/ja.md': '動画を作ります。\n',
    ...extra,
  });

  it('translations in locales/ count as registered; pick by the wanted language: same language, then another form of the same primary language, then English', async () => {
    await writeTemplate(root, 'multi', manifest('multi'), overlays());
    const scan = await scanTemplateDir(root, 'user');
    expect(scan.diagnostics).toEqual([]);
    const catalog = new TemplateCatalog({ builtinDir: null, userDir: root });

    const titles = async (language?: string) => (await catalog.list(language)).templates.map((t) => [t.manifest.language, t.manifest.title]);
    expect(await titles('ja')).toEqual([['ja', 'サンプル']]);
    expect(await titles('fr')).toEqual([['en', 'Sample template']]);
    expect(await titles('zh-Hans')).toEqual([['zh-CN', '示例模板']]);
    expect(await titles('zh-TW')).toEqual([['zh-CN', '示例模板']]);
    expect((await catalog.list('ja')).templates[0]!.languages).toEqual(['zh-CN', 'en', 'ja']);

    const detail = await catalog.get('multi', 'ja');
    expect(detail.prompt).toBe('動画を作ります。\n');
    expect(detail.template.manifest).toMatchObject({ language: 'ja', brief: ja.brief, fields: ja.fields, ratio: '16:9', version: '1.0.0' });
    expect((await catalog.get('multi', 'zh-Hans')).prompt).toBe('你要做一条视频。\n');
  });

  it('without a language, uses the Runtime\'s UI language', async () => {
    await writeTemplate(root, 'multi', manifest('multi'), overlays());
    const catalog = new TemplateCatalog({ builtinDir: null, userDir: root });
    const expected = getLocale() === 'zh-Hans' ? '示例模板' : getLocale() === 'ja' ? 'サンプル' : 'Sample template';
    expect((await catalog.list()).templates[0]!.manifest.title).toBe(expected);
  });

  it('a non-compliant translation makes the whole template non-compliant: half missing, different item count, mismatched placeholders, same language as the source', async () => {
    await writeTemplate(root, 'half', manifest('half'), { 'locales/en.json': JSON.stringify(en) });
    await writeTemplate(root, 'fields', manifest('fields'), {
      'locales/en.json': JSON.stringify({ ...en, brief: 'Explain {{topic}} to {{audience}}.', fields: [...en.fields, { label: 'audience' }] }),
      'locales/en.md': 'x\n',
    });
    await writeTemplate(root, 'slots', manifest('slots'), {
      'locales/en.json': JSON.stringify({ ...en, brief: 'Make an explainer about {{subject}}.' }),
      'locales/en.md': 'x\n',
    });
    await writeTemplate(root, 'scene-prompt', manifest('scene-prompt'), {
      'locales/en.json': JSON.stringify(en),
      'locales/en.md': 'Make an explainer about {{topic}}.\n',
    });
    await writeTemplate(root, 'same-language', manifest('same-language'), {
      'locales/zh-hans.json': JSON.stringify(en),
      'locales/zh-hans.md': 'x\n',
    });
    await writeTemplate(root, 'unknown-locale', manifest('unknown-locale'), { 'locales/xx.json': '{}' });
    const scan = await scanTemplateDir(root, 'user');
    expect(scan.templates).toEqual([]);
    const issues = Object.fromEntries(scan.diagnostics.map((d) => [d.dir, d.issues]));
    expect(scan.diagnostics.every((d) => d.code === 'invalid')).toBe(true);
    expect(issues['half']).toEqual(['缺少 locales/en.md']);
    expect(issues['fields']).toEqual([expect.stringMatching(/^locales\/en\.json: fields: /)]);
    expect(issues['slots']!.length).toBeGreaterThan(0);
    expect(issues['slots']!.every((issue) => issue.startsWith('locales/en.json: brief: '))).toBe(true);
    expect(issues['scene-prompt']).toEqual([expect.stringMatching(/^locales\/en\.md: /)]);
    expect(issues['same-language']).toEqual([expect.stringContaining('locales/zh-hans.json')]);
    expect(issues['unknown-locale']).toEqual(['目录里有没登记的文件：locales/xx.json']);
  });
});

describe('two sources combined', () => {
  let builtin: string;
  let user: string;

  beforeEach(async () => {
    builtin = path.join(root, 'builtin');
    user = path.join(root, 'user');
    await writeTemplate(builtin, 'shared-id', manifest('shared-id', { title: '内置的' }));
    await writeTemplate(user, 'shared-id', manifest('shared-id', { title: '用户的' }));
    await writeTemplate(user, 'my-own', manifest('my-own'));
  });

  it('with the same id, the built-in one takes precedence and the user\'s copy is recorded as builtin-conflict', async () => {
    const catalog = new TemplateCatalog({ builtinDir: builtin, userDir: user });
    const { templates, diagnostics } = await catalog.list();
    expect(templates.map((t) => [t.manifest.id, t.origin, t.manifest.title])).toEqual([
      ['shared-id', 'builtin', '内置的'],
      ['my-own', 'user', '示例模板'],
    ]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'builtin-conflict', origin: 'user', dir: 'shared-id', path: path.join(user, 'shared-id') }),
    ]);
  });

  it('pack provenance: a user template a pack brought names the pack; built-in templates and the user’s own do not', async () => {
    const asked: string[] = [];
    const catalog = new TemplateCatalog({
      builtinDir: builtin,
      userDir: user,
      packOwner: async () => {
        asked.push('scan');
        return (kind, id) => (kind === 'template' && (id === 'my-own' || id === 'shared-id') ? { id: 'news-desk', name: 'News desk' } : null);
      },
    });
    const { templates } = await catalog.list();
    expect(templates.map((t) => [t.manifest.id, t.origin, t.pack])).toEqual([
      ['shared-id', 'builtin', null],
      ['my-own', 'user', { id: 'news-desk', name: 'News desk' }],
    ]);
    // One read of the pack records per list.
    expect(asked).toEqual(['scan']);
    expect((await catalog.get('my-own')).template.pack).toEqual({ id: 'news-desk', name: 'News desk' });
    expect(await catalog.packOf('shared-id', 'builtin')).toBeNull();
    expect((await new TemplateCatalog({ builtinDir: builtin, userDir: user }).list()).templates.every((t) => t.pack === null)).toBe(true);
  });

  it('not cached: listing again after the user adds a new template or deletes one reflects the change', async () => {
    const catalog = new TemplateCatalog({ builtinDir: builtin, userDir: user });
    expect((await catalog.list()).templates).toHaveLength(2);
    await writeTemplate(user, 'later', manifest('later'));
    expect((await catalog.list()).templates.map((t) => t.manifest.id)).toContain('later');
    await fs.rm(path.join(user, 'my-own'), { recursive: true });
    await expect(catalog.get('my-own')).rejects.toMatchObject({ code: 'not-found', details: { code: 'TEMPLATE_NOT_FOUND' } });
  });

  it('get returns the manifest and body; locate only accepts registered accompanying files', async () => {
    await writeTemplate(
      user,
      'with-cover',
      manifest('with-cover', { cover: { file: 'cover.png', tone: 'blue' }, assets: [{ path: 'assets/x.svg', type: 'svg', note: '标志' }] }),
      { 'cover.png': 'png', 'assets/x.svg': '<svg/>' },
    );
    const catalog = new TemplateCatalog({ builtinDir: null, userDir: user });
    const detail = await catalog.get('with-cover');
    expect(detail.prompt).toBe('你要做一条视频。\n');
    expect(detail.template.files).toEqual({ cover: true, preview: false, assets: 1 });
    expect(await catalog.locate('with-cover', 'assets/x.svg')).toEqual({ root: path.join(user, 'with-cover'), file: 'assets/x.svg' });
    for (const file of ['prompt.md', 'template.json', 'preview.mp4']) {
      const error = await catalog.locate('with-cover', file).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RpcError);
      expect(error).toMatchObject({ code: 'not-found', details: { code: 'TEMPLATE_FILE_NOT_FOUND' } });
    }
  });
});

describe('built-in templates', () => {
  it('all of the repo\'s templates/ load successfully, with no diagnostics', async () => {
    const catalog = new TemplateCatalog({ builtinDir: REPO_TEMPLATES, userDir: path.join(root, 'none') });
    const { templates, diagnostics } = await catalog.list();
    expect(diagnostics).toEqual([]);
    const dirs = (await fs.readdir(REPO_TEMPLATES, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith('.'));
    expect(templates).toHaveLength(dirs.length);
    expect(templates.length).toBeGreaterThanOrEqual(24);
    expect(templates.every((t) => t.origin === 'builtin' && t.manifest.source === 'official')).toBe(true);
    expect(new Set(templates.map((t) => t.manifest.kind))).toEqual(new Set(['scene', 'example']));
  });

  it('built-in templates have a translation for every other shipped language; copy switches to that language when requested', async () => {
    const catalog = new TemplateCatalog({ builtinDir: REPO_TEMPLATES, userDir: path.join(root, 'none') });
    const base = await catalog.list('en');
    for (const t of base.templates) expect(t.languages, t.manifest.id).toEqual(['en', ...LOCALES.filter((l) => l !== 'en')]);
    for (const locale of LOCALES) {
      const { templates } = await catalog.list(locale);
      expect(templates.every((t) => t.manifest.language === locale), locale).toBe(true);
    }
  });

  it('the skills that built-in templates recommend reading first all exist in the repo root\'s skills/', async () => {
    const { templates } = await new TemplateCatalog({ builtinDir: REPO_TEMPLATES, userDir: path.join(root, 'none') }).list();
    const missing = templates.flatMap((t) =>
      (t.manifest.skills ?? []).filter((id) => !existsSync(path.join(REPO_SKILLS, id, 'SKILL.md'))).map((id) => `${t.manifest.id} → ${id}`),
    );
    expect(missing).toEqual([]);
  });

  it('directory resolution: environment variable takes precedence, in development finds templates/ at the repo root', () => {
    expect(resolveBuiltinTemplatesDir({ CUCCUT_TEMPLATES_DIR: '/opt/x/templates' })).toBe('/opt/x/templates');
    expect(resolveBuiltinTemplatesDir({})).toBe(REPO_TEMPLATES);
  });
});
