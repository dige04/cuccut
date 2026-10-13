import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEMPLATE_CATEGORIES, type TemplateManifest, type TemplateSummary } from '@cuccut/protocol';
import { packOriginLabel } from './agent-skills.ts';
import {
  SHELF_DEFAULT,
  SHELF_MAX,
  TEMPLATES_PER_PAGE,
  categoryLabel,
  findTemplates,
  homeTemplateOf,
  pageOf,
  shelfAfterPick,
  templateAssets,
  templateByline,
  templateCatalogOf,
  templateCategories,
  templateLength,
  templateMeta,
  templateOriginLabel,
  templateOf,
  templateShelf,
  templateSlotFields,
  templateSources,
  templateSpecLine,
} from './home-templates.ts';

/** Built-in templates from the top-level templates/ folder of the repo, wrapped in the shape of `templates.list`. */
const TEMPLATES_DIR = path.resolve(import.meta.dirname, '../../../../templates');
const BUILTIN: TemplateSummary[] = fs
  .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
  .map((d) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, d.name, 'template.json'), 'utf8')) as TemplateManifest;
    return { manifest, origin: 'builtin', languages: [manifest.language], files: { cover: false, preview: false, assets: manifest.assets?.length ?? 0 }, pack: null };
  });

function summary(patch: Partial<TemplateManifest>, extra: Partial<Omit<TemplateSummary, 'manifest'>> = {}): TemplateSummary {
  const manifest: TemplateManifest = {
    schema: 1,
    id: 'my-template',
    version: '1.0.0',
    kind: 'scene',
    title: '我的模板',
    summary: '一句话',
    description: '一小段',
    language: 'zh-CN',
    category: 'explainer',
    ratio: '1:1',
    durationSeconds: 45,
    brief: '讲讲{{宠物}}，给{{受众}}看',
    fields: [{ label: '宠物', hint: '讲谁', example: '我的猫' }, { label: '受众' }],
    skills: ['video-production'],
    author: '某人',
    source: 'official',
    license: 'CC-BY-4.0',
    tags: ['猫'],
    cover: { tone: 'green', figure: 'cards', kicker: 'MINE' },
    preview: { beats: ['一', '二', '三'] },
    ...patch,
  };
  return { manifest, origin: 'user', languages: [manifest.language], files: { cover: false, preview: false, assets: manifest.assets?.length ?? 0 }, pack: null, ...extra } as TemplateSummary;
}

const catalog = templateCatalogOf(BUILTIN);

describe('directory converted to the shape the UI uses', () => {
  it('24 built-in: 12 scene templates and 12 work examples, sorted by id', () => {
    expect(catalog).toHaveLength(24);
    expect(findTemplates(catalog, '', { kind: 'scene' })).toHaveLength(12);
    expect(findTemplates(catalog, '', { kind: 'example' })).toHaveLength(12);
    const ids = catalog.map((t) => t.id);
    expect(ids).toEqual([...ids].sort());
    expect(catalog.every((t) => t.source === 'builtin')).toBe(true);
  });

  it('durations in seconds; unspecified aspect ratio, duration and sample input are auto / empty', () => {
    const promo = templateOf(catalog, 'promo-ad')!;
    expect(promo).toMatchObject({ language: 'en', kind: 'scene', ratio: '9:16', length: 30, tone: 'magenta', figure: 'ring', kicker: 'AD' });
    expect(promo.sample).not.toBe('');
    const launch = templateOf(catalog, 'white-ui-launch')!;
    expect(launch).toMatchObject({ kind: 'example', ratio: null, length: null, sample: '', brief: '' });
    expect(launch.fields.length).toBeGreaterThan(0);
    expect(templateLength(90)).toBe(90);
    expect(templateLength(undefined)).toBeNull();
  });

  it('sample sentence built from brief and fields: placeholders replaced with examples, label used when there is no example; brief, fields and skills carried over as is', () => {
    const mine = homeTemplateOf(summary({}));
    expect(mine.sample).toBe('讲讲我的猫，给受众看');
    expect(mine.brief).toBe('讲讲{{宠物}}，给{{受众}}看');
    expect(mine.fields.map((f) => f.label)).toEqual(['宠物', '受众']);
    expect(mine.skills).toEqual(['video-production']);
    expect(templateOf(catalog, 'promo-ad')!.sample).not.toContain('{{');
  });

  it('cover image and preview video: used only when the manifest lists them and the Runtime says the file exists; without scenes, the title stands in for one scene', () => {
    const withFiles = homeTemplateOf(
      summary(
        { cover: { file: 'cover.png', tone: 'blue' }, preview: { file: 'preview.mp4' } },
        { files: { cover: true, preview: true, assets: 0 } },
      ),
    );
    expect(withFiles).toMatchObject({ cover: 'cover.png', preview: 'preview.mp4', beats: ['我的模板'], figure: 'bars' });
    const missing = homeTemplateOf(summary({ cover: { file: 'cover.png', tone: 'blue', figure: 'ring' } }));
    expect(missing.cover).toBeNull();
  });

  it('user-directory templates come after built-in ones; a manifest that says community counts as community', () => {
    const mixed = templateCatalogOf([
      summary({ id: 'zz-mine' }),
      summary({ id: 'aa-shared', source: 'community' }),
      ...BUILTIN.slice(0, 2),
    ]);
    expect(mixed.map((t) => t.source)).toEqual(['builtin', 'builtin', 'user', 'community']);
  });
});

describe('template grid below the input box', () => {
  it('all eight defaults are in the built-in directory: six scene templates plus two work examples, covering all seven categories', () => {
    const shelf = templateShelf(catalog, null);
    expect(SHELF_MAX).toBe(8);
    expect(shelf.map((t) => t.id)).toEqual([...SHELF_DEFAULT]);
    expect(shelf.filter((t) => t.kind === 'example')).toHaveLength(2);
    expect(new Set(shelf.map((t) => t.category)).size).toBe(7);
  });

  it('recently used come first; keys no longer in the directory (tips, anim stored by an old version) are dropped and filled with defaults', () => {
    expect(templateShelf(catalog, ['tips', 'white-ui-launch', 'anim', 'white-ui-launch']).map((t) => t.id)).toEqual([
      'white-ui-launch',
      ...SHELF_DEFAULT.slice(0, 7),
    ]);
    expect(templateShelf(catalog, [42, null, 'promo-ad'])).toHaveLength(8);
    expect(templateShelf([], ['promo-ad'])).toEqual([]);
  });

  it('new faces picked from the template library move to the front, pushing out the last one; items already in the grid keep their position; items not in the directory are not added', () => {
    expect(shelfAfterPick(catalog, null, 'data-story')).toEqual([...SHELF_DEFAULT]);
    expect(shelfAfterPick(catalog, ['tips'], 'white-ui-launch')).toEqual(['white-ui-launch', ...SHELF_DEFAULT.slice(0, 7)]);
    expect(shelfAfterPick(catalog, null, 'nope')).toEqual([...SHELF_DEFAULT]);
  });
});

describe('template library filters', () => {
  it('type, category and search terms can combine; category buttons are All plus the seven canonical categories, each with templates', () => {
    const cats = templateCategories(catalog);
    expect(cats.map((c) => c.key)).toEqual(['all', ...TEMPLATE_CATEGORIES]);
    expect(cats[1]).toEqual({ key: 'marketing', label: '营销推广' });
    for (const c of TEMPLATE_CATEGORIES) expect(findTemplates(catalog, '', { category: c }).length, c).toBeGreaterThan(0);
    const scenesInMarketing = findTemplates(catalog, '', { kind: 'scene', category: 'marketing' });
    expect(scenesInMarketing.every((t) => t.kind === 'scene' && t.category === 'marketing')).toBe(true);
    expect(findTemplates(catalog, 'Promo').map((t) => t.id)).toContain('promo-ad');
    // Tags count too
    expect(findTemplates(catalog, 'conversion').map((t) => t.id)).toEqual(['promo-ad']);
  });

  it('unrecognized category keys are shown by their key name, with one extra category button', () => {
    const odd = templateCatalogOf([summary({ id: 'odd', category: 'gaming' as never })]);
    expect(categoryLabel('gaming')).toBe('gaming');
    expect(templateCategories(odd).at(-1)).toEqual({ key: 'gaming', label: 'gaming' });
  });

  it('no source filter when there is only one source; with user-directory templates, filter by built-in / mine', () => {
    expect(templateSources(catalog)).toEqual([]);
    const mixed = templateCatalogOf([...BUILTIN, summary({})]);
    expect(templateSources(mixed).map((s) => s.label)).toEqual(['全部来源', '内置', '我的']);
    expect(findTemplates(mixed, '', { source: 'user' }).map((t) => t.id)).toEqual(['my-template']);
  });

  it('paging: out-of-range page numbers are clamped to the valid range; an empty list counts as one page', () => {
    const first = pageOf(catalog, 1);
    expect([first.items.length, first.page, first.pages, first.total]).toEqual([TEMPLATES_PER_PAGE, 1, 3, 24]);
    expect(pageOf(catalog, 99).page).toBe(3);
    expect(pageOf(catalog, 99).items).toHaveLength(24 - 2 * TEMPLATES_PER_PAGE);
    expect(pageOf([], 3)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
});

describe('card and detail copy', () => {
  it('scene templates show default aspect ratio and duration; work examples without them say the agent will decide', () => {
    const promo = templateOf(catalog, 'promo-ad')!;
    expect(templateMeta(promo)).toBe('9:16 · 约 30 秒 · 内置');
    expect(templateSpecLine(promo)).toBe('默认 9:16 · 约 30 秒，要改就在消息里说');
    expect(templateByline(promo)).toBe('内置 · 场景模板 · 营销推广');
    const launch = templateOf(catalog, 'white-ui-launch')!;
    expect(templateMeta(launch)).toBe('画幅与时长自动 · 内置');
    expect(templateSpecLine(launch)).toBe('画幅与时长自动，由 Agent 按内容决定');
    expect(templateSpecLine({ kind: 'example', ratio: '16:9', length: null })).toBe('16:9 · 时长自动');
    expect(templateByline(homeTemplateOf(summary({ kind: 'example' })))).toBe('我的 · 某人 · 作品示例 · 知识讲解');
  });

  it('a template a pack brought says which pack in its byline', () => {
    const fromPack = homeTemplateOf(summary({}, { pack: { id: 'news-desk', name: 'News desk' } }));
    expect(fromPack.pack).toEqual({ id: 'news-desk', name: 'News desk' });
    expect(templateOriginLabel(fromPack)).toBe(packOriginLabel('News desk'));
    expect(templateByline(fromPack)).toBe(`${packOriginLabel('News desk')} · 某人 · 场景模板 · 知识讲解`);
    const mine = homeTemplateOf(summary({}));
    expect(mine.pack).toBeNull();
    expect(templateOriginLabel(mine)).toBe('我的');
  });

  it('"Needs your input" lists fill-in fields in the order they appear in the brief, with manifest notes; work examples are not listed', () => {
    const fields = [
      { label: '受众', hint: '谁会看到' },
      { label: '产品', hint: '要推广的是什么', example: '瑜伽课' },
    ];
    expect(templateSlotFields({ kind: 'scene', brief: '给{{产品}}做，面向{{受众}}，再说{{产品}}，{{没写的}}', fields })).toEqual([
      { label: '产品', hint: '要推广的是什么', example: '瑜伽课' },
      { label: '受众', hint: '谁会看到' },
      { label: '没写的' },
    ]);
    expect(templateSlotFields({ kind: 'scene', brief: '', fields })).toEqual([]);
    expect(templateSlotFields({ kind: 'example', brief: '{{产品}}', fields })).toEqual([]);
    const promo = templateOf(catalog, 'promo-ad')!;
    expect(templateSlotFields(promo).map((f) => f.label)).toEqual(promo.fields.map((f) => f.label));
  });

  it('media counted by kind, including video; kinds with none are not listed', () => {
    const t = homeTemplateOf(
      summary({
        assets: [
          { path: 'assets/a.png', type: 'image', note: '图' },
          { path: 'assets/b.png', type: 'image', note: '图' },
          { path: 'assets/c.mp4', type: 'video', note: '片头' },
        ],
      }),
    );
    expect(templateAssets(t)).toEqual([
      { kind: 'image', label: '图片', count: 2 },
      { kind: 'video', label: '视频', count: 1 },
    ]);
    expect(templateAssets(templateOf(catalog, 'promo-ad')!)).toEqual([]);
  });
});
