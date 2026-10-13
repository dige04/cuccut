import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES, localeOfTag } from './i18n.ts';
import { methodParamSchemas } from './schemas.ts';
import { parseTemplateManifest, parseTemplateTranslation, templateManifestSchema, templateSendRefSchema } from './template-schemas.ts';
import {
  localizeTemplateManifest,
  pickTemplateLanguage,
  TEMPLATE_FILE_MAX_BYTES,
  TEMPLATE_LIMITS,
  TEMPLATE_MANIFEST_FILE,
  TEMPLATE_PROMPT_FILE,
  templateExampleText,
  templatePathProblem,
  templatePromptSlotProblems,
  templateSlotProblems,
  templateSlots,
  templateTranslationFile,
  templateTranslationFiles,
  templateUnfilledText,
  type TemplateManifest,
  type TemplateTranslation,
  type TemplateVerification,
} from './template.ts';

/** `templates/` at the repo root: three levels up from this file (packages/protocol/src). */
const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../templates');

const base: TemplateManifest = {
  schema: 1,
  id: 'sample-scene',
  version: '1.0.0',
  kind: 'scene',
  title: '示例',
  summary: '一句话。',
  description: '一小段。',
  language: 'zh-CN',
  category: 'explainer',
  ratio: '16:9',
  durationSeconds: 60,
  brief: '给 {{主题}} 做一条讲解，受众是 {{受众}}。',
  fields: [
    { label: '主题', hint: '讲什么', example: '光合作用' },
    { label: '受众', example: '高中生' },
  ],
  skills: ['video-production', 'narration'],
  author: 'CucCut',
  source: 'official',
  license: 'Apache-2.0',
  tags: ['讲解'],
  cover: { tone: 'blue', figure: 'steps', kicker: '01' },
  preview: { beats: ['一', '二', '三'] },
};

describe('template manifest validation', () => {
  it('valid scene templates and example works', () => {
    expect(parseTemplateManifest(base, 'sample-scene')).toEqual({ ok: true, manifest: base });
    const { ratio: _r, durationSeconds: _d, brief: _b, ...rest } = base;
    expect(templateManifestSchema.safeParse({ ...rest, kind: 'example' }).success).toBe(true);
  });

  it('scene templates must give aspect ratio, duration and brief; example works must not have a brief', () => {
    expect(templateManifestSchema.safeParse({ ...base, kind: 'example' }).success).toBe(false);
    for (const key of ['ratio', 'durationSeconds', 'brief'] as const) {
      const { [key]: _omit, ...rest } = base;
      expect(templateManifestSchema.safeParse(rest).success, key).toBe(false);
    }
  });

  it('placeholders in the brief match fields: all declared, all referenced, no duplicate labels', () => {
    const ok = (patch: Partial<TemplateManifest>) => templateManifestSchema.safeParse({ ...base, ...patch }).success;
    expect(ok({ brief: '给 {{主题}} 做一条讲解，受众是 {{受众}}，再讲一遍 {{主题}}。' })).toBe(true);
    expect(ok({ brief: '给 {{主题}} 做一条讲解。' }), '受众没被引用').toBe(false);
    expect(ok({ brief: '给 {{主题}} 做一条讲解，受众是 {{受众}}，时长 {{时长}}。' }), '时长没声明').toBe(false);
    expect(ok({ brief: '给 {{主题}} 做一条讲解，受众是 {{受众}}，{{ 不成对。' })).toBe(false);
    expect(ok({ brief: '做一条讲解。', fields: [] })).toBe(true);
    expect(ok({ brief: '做一条讲解。' }), '声明了却没用').toBe(false);
    expect(ok({ brief: 'x'.repeat(TEMPLATE_LIMITS.brief + 1) })).toBe(false);
    expect(ok({ fields: [...base.fields!, { label: '主题' }] })).toBe(false);
    for (const label of ['a{b', 'a}b', 'a\nb', '', ' 主题', 'x'.repeat(TEMPLATE_LIMITS.fieldLabel + 1)])
      expect(ok({ brief: `{{${label}}}`, fields: [{ label }] }), JSON.stringify(label)).toBe(false);
    expect(ok({ fields: [{ label: '主题', example: '光合作用', note: '多余' } as never, { label: '受众' }] })).toBe(false);
    expect(ok({ fields: [{ label: '主题', hint: 'x'.repeat(TEMPLATE_LIMITS.fieldHint + 1) }, { label: '受众' }] })).toBe(false);
    const many = Array.from({ length: TEMPLATE_LIMITS.fields + 1 }, (_, i) => ({ label: `项${i}` }));
    expect(ok({ brief: many.map((f) => `{{${f.label}}}`).join(''), fields: many })).toBe(false);
  });

  it('skills: kebab-case, no duplicates, at most 4 entries', () => {
    const ok = (skills: unknown) => templateManifestSchema.safeParse({ ...base, skills }).success;
    expect(ok([])).toBe(true);
    expect(ok(['video-production', 'video-production'])).toBe(false);
    expect(ok(['Narration'])).toBe(false);
    expect(ok(['a', 'b', 'c', 'd', 'e'])).toBe(false);
  });

  it('duration 5–600 seconds, step 5; 3–5 beats', () => {
    for (const durationSeconds of [0, 3, 7, 605, 12.5])
      expect(templateManifestSchema.safeParse({ ...base, durationSeconds }).success).toBe(false);
    for (const durationSeconds of [5, 600, 185]) expect(templateManifestSchema.safeParse({ ...base, durationSeconds }).success).toBe(true);
    expect(templateManifestSchema.safeParse({ ...base, preview: { beats: ['一', '二'] } }).success).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, preview: { beats: ['1', '2', '3', '4', '5', '6'] } }).success).toBe(false);
  });

  it('unknown fields are rejected; unrecognized schema is reported separately', () => {
    expect(templateManifestSchema.safeParse({ ...base, mode: 'quality' }).success).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, cover: { ...base.cover, color: 'red' } }).success).toBe(false);
    expect(parseTemplateManifest({ ...base, schema: 2 })).toMatchObject({ ok: false, reason: 'unsupported-schema' });
    expect(parseTemplateManifest(null)).toMatchObject({ ok: false, reason: 'unsupported-schema' });
    expect(parseTemplateManifest(base, 'other-name')).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('formats of id, version, language and license', () => {
    for (const id of ['Promo', 'promo_ad', '-promo', 'promo--ad', '1promo'])
      expect(templateManifestSchema.safeParse({ ...base, id }).success, id).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, version: '1.0' }).success).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, language: 'Chinese' }).success).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, license: 'MIT OR Apache-2.0' }).success).toBe(true);
  });

  it('paths must be relative paths inside the directory; cover, preview and assets each have their own location', () => {
    for (const p of ['', '/etc/passwd', 'C:/x.png', '~/x.png', '../x.png', 'assets/../x.png', 'assets//x.png', 'assets\\x.png', './x.png'])
      expect(templatePathProblem(p), p).not.toBeNull();
    expect(templatePathProblem('assets/logo.svg')).toBeNull();

    const cover = (file: string) => templateManifestSchema.safeParse({ ...base, cover: { file } }).success;
    expect(cover('cover.png')).toBe(true);
    expect(cover('assets/cover.png')).toBe(false);
    expect(cover('poster.png')).toBe(false);
    expect(cover('cover.mp4')).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, cover: { kicker: '01' } }).success).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, preview: { file: 'preview.mp4' } }).success).toBe(true);
    expect(templateManifestSchema.safeParse({ ...base, preview: { file: 'preview.gif' } }).success).toBe(false);
    expect(templateManifestSchema.safeParse({ ...base, preview: {} }).success).toBe(false);
    const { preview: _p, ...noPreview } = base;
    expect(templateManifestSchema.safeParse(noPreview).success).toBe(false);

    const assets = (list: unknown) => templateManifestSchema.safeParse({ ...base, assets: list }).success;
    expect(assets([{ path: 'assets/bgm.mp3', type: 'audio', note: '背景音乐' }])).toBe(true);
    expect(assets([{ path: 'bgm.mp3', type: 'audio', note: '背景音乐' }])).toBe(false);
    expect(assets([{ path: 'assets/bgm.mp3', type: 'image', note: '背景音乐' }])).toBe(false);
    expect(assets([{ path: 'assets/bgm.mp3', type: 'audio', note: '' }])).toBe(false);
    const dup = { path: 'assets/a.svg', type: 'svg', note: '图标' };
    expect(assets([dup, dup])).toBe(false);
  });
});

describe('fill-in fields', () => {
  const fields = [{ label: '产品', example: '线上瑜伽课' }, { label: '受众' }];

  it('placeholders are taken out and replaced with the example or "[label]"', () => {
    const text = '给 {{产品}} 做推广，受众是 {{受众}}，{{产品}} 要出现两次；{单个花括号}不算。';
    expect(templateSlots(text)).toEqual(['产品', '受众', '产品']);
    expect(templateExampleText(text, fields)).toBe('给 线上瑜伽课 做推广，受众是 受众，线上瑜伽课 要出现两次；{单个花括号}不算。');
    expect(templateUnfilledText(text)).toBe('给 [产品] 做推广，受众是 [受众]，[产品] 要出现两次；{单个花括号}不算。');
  });

  it('checks against declarations to find problems; scene body must have no placeholders, example body must match fields', () => {
    expect(templateSlotProblems('给 {{产品}}，受众 {{受众}}。', fields)).toEqual([]);
    expect(templateSlotProblems('给 {{产品}}，时长 {{时长}}。', fields)).toHaveLength(2);
    expect(templateSlotProblems('给 {{产品}}，受众 {{受众}}，{{坏的', fields)).toHaveLength(1);
    expect(templatePromptSlotProblems({ kind: 'scene', fields }, '你要做一条推广短片。')).toEqual([]);
    expect(templatePromptSlotProblems({ kind: 'scene', fields }, '你要给 {{产品}} 做推广。')).toHaveLength(1);
    expect(templatePromptSlotProblems({ kind: 'example', fields }, '给 {{产品}} 做推广，受众是 {{受众}}。')).toEqual([]);
    expect(templatePromptSlotProblems({ kind: 'example' }, '做一条推广。')).toEqual([]);
    expect(templatePromptSlotProblems({ kind: 'example', fields }, '给 {{产品}} 做推广。')).toHaveLength(1);
  });
});

describe('language versions', () => {
  const en: TemplateTranslation = {
    title: 'Sample',
    summary: 'One line.',
    description: 'A short paragraph.',
    brief: 'Explain {{topic}} for {{audience}}.',
    fields: [
      { label: 'topic', hint: 'What to explain', example: 'photosynthesis' },
      { label: 'audience', example: 'high school students' },
    ],
    tags: ['explainer'],
    preview: { beats: ['One', 'Two', 'Three'] },
  };

  it('translation file names: locales/<lowercase language>.json and .md, only shipped languages are recognized', () => {
    expect(templateTranslationFiles('pt-BR')).toEqual({ text: 'locales/pt-br.json', prompt: 'locales/pt-br.md' });
    expect(templateTranslationFile('locales/zh-hant.md')).toEqual({ locale: 'zh-Hant', part: 'prompt' });
    expect(templateTranslationFile('locales/en.json')).toEqual({ locale: 'en', part: 'text' });
    for (const file of ['locales/pt-BR.json', 'locales/xx.json', 'locales/en.txt', 'locales/en/x.json', 'en.json'])
      expect(templateTranslationFile(file), file).toBeNull();
  });

  it('valid translations; unknown fields, overlong values and duplicates are rejected', () => {
    expect(parseTemplateTranslation(en, base)).toEqual({ ok: true, translation: en });
    expect(parseTemplateTranslation({ ...en, ratio: '9:16' }, base).ok).toBe(false);
    expect(parseTemplateTranslation({ ...en, title: 'x'.repeat(TEMPLATE_LIMITS.title + 1) }, base).ok).toBe(false);
    expect(parseTemplateTranslation({ ...en, tags: ['a', 'a'] }, base).ok).toBe(false);
    expect(parseTemplateTranslation({ ...en, cover: { tone: 'red' } }, base).ok).toBe(false);
  });

  it('checked against template.json: brief and fields match, same item count, assets registered', () => {
    const issues = (value: unknown, manifest: TemplateManifest = base) => {
      const result = parseTemplateTranslation(value, manifest);
      return result.ok ? [] : result.issues;
    };
    expect(issues({ ...en, brief: undefined })).toEqual([expect.stringMatching(/^brief: /)]);
    expect(issues({ ...en, brief: 'Explain {{subject}} for {{audience}}.' }).length).toBeGreaterThan(0);
    expect(issues({ ...en, fields: [en.fields![0]!], brief: 'Explain {{topic}}.' })).toEqual([expect.stringMatching(/^fields: /)]);
    expect(issues({ ...en, preview: { beats: ['One', 'Two', 'Three', 'Four'] } })).toEqual([expect.stringMatching(/^preview\.beats: /)]);
    expect(issues({ ...en, assets: [{ path: 'assets/logo.svg', note: 'Logo' }] })).toEqual([expect.stringMatching(/^assets: /)]);
    const example: TemplateManifest = { ...base, kind: 'example', brief: undefined, ratio: undefined, durationSeconds: undefined };
    expect(issues({ ...en, brief: undefined }, example)).toEqual([]);
    expect(issues(en, example)).toEqual([expect.stringMatching(/^brief: /)]);
  });

  it('applying a translation replaces the copy and language; other fields and untranslated parts stay unchanged', () => {
    const withAssets: TemplateManifest = { ...base, assets: [{ path: 'assets/a.svg', type: 'svg', note: '图标' }, { path: 'assets/b.png', type: 'image', note: '底图' }] };
    const localized = localizeTemplateManifest(withAssets, 'en', { ...en, cover: { kicker: 'STEP' }, assets: [{ path: 'assets/a.svg', note: 'Icon' }] });
    expect(localized).toMatchObject({ id: base.id, version: base.version, language: 'en', title: 'Sample', brief: en.brief, fields: en.fields, tags: ['explainer'], ratio: '16:9' });
    expect(localized.cover).toEqual({ ...base.cover, kicker: 'STEP' });
    expect(localized.preview).toEqual({ ...base.preview, beats: ['One', 'Two', 'Three'] });
    expect(localized.assets!.map((a) => a.note)).toEqual(['Icon', '底图']);
    expect(localizeTemplateManifest(base, 'en', { ...en, cover: undefined }).cover).toEqual(base.cover);
  });

  it('language selection: same language, then another spelling of the same primary language, then English, finally template.json', () => {
    const all = ['en', 'ja', 'zh-Hant', 'pt-BR'] as const;
    expect(pickTemplateLanguage('zh-CN', all, 'ja')).toBe('ja');
    expect(pickTemplateLanguage('zh-CN', all, 'ja-JP')).toBe('ja');
    expect(pickTemplateLanguage('zh-CN', all, 'zh-TW')).toBe('zh-Hant');
    expect(pickTemplateLanguage('zh-CN', all, 'zh-Hans')).toBeNull();
    expect(pickTemplateLanguage('zh-CN', all, 'pt')).toBe('pt-BR');
    expect(pickTemplateLanguage('zh-CN', all, 'fr')).toBe('en');
    expect(pickTemplateLanguage('zh-CN', all, null)).toBe('en');
    expect(pickTemplateLanguage('zh-CN', [], 'fr')).toBeNull();
    expect(pickTemplateLanguage('zh-Hant', ['zh-Hans', 'en'], 'zh-Hans')).toBe('zh-Hans');
    expect(pickTemplateLanguage('zh-Hant', ['zh-Hans', 'en'], 'zh-HK')).toBeNull();
    expect(pickTemplateLanguage('en', ['zh-Hans'], 'fr')).toBeNull();
  });
});

describe('verification records', () => {
  const verification: TemplateVerification = {
    date: '2026-10-04',
    version: '1.0.0',
    engine: 'codex',
    input: '按提示词原样。',
    materials: [{ title: '城市夜景', url: 'https://example.org/photo/1', license: 'CC0-1.0', note: '第二幕背景' }],
    capabilities: ['synthesizeSpeech', 'generateMusic'],
    outcome: 'partial',
    output: { ratio: '16:9', durationSeconds: 15.2 },
    notes: '没有旁白。',
  };
  const ok = (v: unknown) => templateManifestSchema.safeParse({ ...base, verification: v }).success;

  it('valid records; cover image, preview video and placeholder fields may coexist', () => {
    expect(ok(verification)).toBe(true);
    expect(ok({ ...verification, materials: [], capabilities: [] })).toBe(true);
    const full = {
      ...base,
      cover: { file: 'cover.jpg', tone: 'blue', figure: 'ring', kicker: 'REEL' },
      preview: { file: 'preview.mp4', beats: ['一', '二', '三'] },
    };
    expect(templateManifestSchema.safeParse({ ...full, verification }).success).toBe(true);
  });

  it('allowed values for date, version, engine, verdict and capabilities', () => {
    for (const date of ['2026-13-01', '2026-02-30', '2026/10/04', '20261004']) expect(ok({ ...verification, date }), date).toBe(false);
    expect(ok({ ...verification, version: '1.0' })).toBe(false);
    expect(ok({ ...verification, engine: 'Codex 0.159' })).toBe(false);
    expect(ok({ ...verification, outcome: 'ok' })).toBe(false);
    expect(ok({ ...verification, capabilities: ['speech'] })).toBe(false);
    expect(ok({ ...verification, capabilities: ['generateMusic', 'generateMusic'] })).toBe(false);
  });

  it('when a final video exists, measured aspect ratio and duration must be given; fail may omit them', () => {
    const { output: _o, ...noOutput } = verification;
    expect(ok(noOutput)).toBe(false);
    expect(ok({ ...noOutput, outcome: 'fail' })).toBe(true);
    expect(ok({ ...verification, output: { ratio: '16x9', durationSeconds: 15 } })).toBe(false);
    expect(ok({ ...verification, output: { ratio: '16:9', durationSeconds: 0 } })).toBe(false);
  });

  it('assets need an https address and a license; unknown fields are rejected', () => {
    const material = verification.materials[0]!;
    expect(ok({ ...verification, materials: [{ ...material, url: 'http://example.org/x' }] })).toBe(false);
    expect(ok({ ...verification, materials: [{ ...material, license: '' }] })).toBe(false);
    expect(ok({ ...verification, materials: [{ ...material, author: '某人' }] })).toBe(false);
    expect(ok({ ...verification, model: 'x' })).toBe(false);
    expect(ok({ ...verification, notes: '' })).toBe(false);
  });
});

describe('templates.* and templates attached when sending', () => {
  it('template reference when sending: id is kebab-case, assets are relative paths inside the directory, no other fields', () => {
    expect(templateSendRefSchema.safeParse({ id: 'launch-film', version: '1.0.0', assets: ['assets/logo.svg'] }).success).toBe(true);
    expect(templateSendRefSchema.safeParse({ id: 'Launch' }).success).toBe(false);
    expect(templateSendRefSchema.safeParse({ id: 'launch-film', assets: ['../x.svg'] }).success).toBe(false);
    expect(templateSendRefSchema.safeParse({ id: 'launch-film', prompt: '自己写的' }).success).toBe(false);
    const send = methodParamSchemas['conversations.send'];
    expect(send.safeParse({ conversationId: 'c', text: 'hi', commandId: 'k', template: { id: 'launch-film' } }).success).toBe(true);
  });

  it('openHandle accepts only relative paths inside the template', () => {
    const open = methodParamSchemas['templates.openHandle'];
    expect(open.safeParse({ id: 'launch-film', path: 'cover.png' }).success).toBe(true);
    for (const p of ['/etc/passwd', '../x.png', 'assets//x.svg'])
      expect(open.safeParse({ id: 'launch-film', path: p }).success, p).toBe(false);
    expect(methodParamSchemas['templates.list'].safeParse({ extra: 1 }).success).toBe(false);
  });

  it('list, single template and sending can carry a requested language', () => {
    expect(methodParamSchemas['templates.list'].safeParse({ language: 'zh-Hant' }).success).toBe(true);
    expect(methodParamSchemas['templates.get'].safeParse({ id: 'launch-film', language: 'pt-BR' }).success).toBe(true);
    expect(templateSendRefSchema.safeParse({ id: 'launch-film', language: 'ja' }).success).toBe(true);
    for (const language of ['', 'EN', 'zh_CN', 'x'.repeat(40)])
      expect(methodParamSchemas['templates.list'].safeParse({ language }).success, language).toBe(false);
  });
});

/** All files in the directory (relative paths, forward slashes). Hidden files starting with a dot are not counted. */
function listFiles(dir: string, prefix = ''): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
    });
}

describe('built-in repository templates in templates/', () => {
  const dirs = fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it('has a template directory', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs)('%s: manifest is valid, id equals directory name, prompt is non-empty, referenced files all exist', (dir) => {
    const root = path.join(TEMPLATES_DIR, dir);
    const result = parseTemplateManifest(JSON.parse(fs.readFileSync(path.join(root, TEMPLATE_MANIFEST_FILE), 'utf8')), dir);
    if (!result.ok) throw new Error(`${dir}: ${result.issues.join('; ')}`);
    const manifest = result.manifest;

    const prompt = fs.readFileSync(path.join(root, TEMPLATE_PROMPT_FILE), 'utf8');
    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(Buffer.byteLength(prompt, 'utf8')).toBeLessThanOrEqual(TEMPLATE_LIMITS.promptBytes);
    expect(prompt, '提示词不得含机器路径').not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\/);
    expect(templatePromptSlotProblems(manifest, prompt), `${dir} 的 prompt.md 与 fields 对不上`).toEqual([]);
    expect(manifest.skills ?? [], `${dir} 应建议先读 video-production`).toContain('video-production');

    const declared = [manifest.cover.file, manifest.preview.file, ...(manifest.assets ?? []).map((a) => a.path)].filter(
      (p): p is string => p != null,
    );
    for (const p of declared) expect(fs.existsSync(path.join(root, p)), `${dir}/${p}`).toBe(true);
    if (manifest.cover.file)
      expect(fs.statSync(path.join(root, manifest.cover.file)).size, `${dir} 的封面超过上限`).toBeLessThanOrEqual(
        TEMPLATE_FILE_MAX_BYTES.cover,
      );
    if (manifest.preview.file)
      expect(fs.statSync(path.join(root, manifest.preview.file)).size, `${dir} 的预览超过上限`).toBeLessThanOrEqual(
        TEMPLATE_FILE_MAX_BYTES.preview,
      );

    const allowed = new Set([TEMPLATE_MANIFEST_FILE, TEMPLATE_PROMPT_FILE, ...declared]);
    const stray = listFiles(root).filter((p) => !allowed.has(p) && !templateTranslationFile(p));
    expect(stray, `${dir} 里有清单没登记的文件`).toEqual([]);
    const own = listFiles(root).filter((p) => templateTranslationFile(p)?.locale === localeOfTag(manifest.language));
    expect(own, `${dir} 不该有原文语言的译文`).toEqual([]);
  });

  it('ids are not duplicated', () => {
    const ids = dirs.map((dir) => JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, dir, TEMPLATE_MANIFEST_FILE), 'utf8')).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  /** One test for each built-in template × each other shipped language, named “<id> · <language>”, so a single language can be run on its own: `-t ' · ja'`. */
  const translations = dirs.flatMap((dir) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, dir, TEMPLATE_MANIFEST_FILE), 'utf8')) as TemplateManifest;
    return LOCALES.filter((locale) => locale !== localeOfTag(manifest.language)).map((locale) => [`${dir} · ${locale}`, dir, locale] as const);
  });

  it.each(translations)('%s: translations are complete and valid, match template.json', (_name, dir, locale) => {
    const root = path.join(TEMPLATES_DIR, dir);
    const result = parseTemplateManifest(JSON.parse(fs.readFileSync(path.join(root, TEMPLATE_MANIFEST_FILE), 'utf8')), dir);
    if (!result.ok) throw new Error(`${dir}: ${result.issues.join('; ')}`);
    const manifest = result.manifest;
    const files = templateTranslationFiles(locale);
    for (const file of [files.text, files.prompt]) expect(fs.existsSync(path.join(root, file)), `缺少 ${dir}/${file}`).toBe(true);

    const parsed = parseTemplateTranslation(JSON.parse(fs.readFileSync(path.join(root, files.text), 'utf8')), manifest);
    if (!parsed.ok) throw new Error(`${dir}/${files.text}: ${parsed.issues.join('; ')}`);
    const translation = parsed.translation;
    const prompt = fs.readFileSync(path.join(root, files.prompt), 'utf8');
    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(Buffer.byteLength(prompt, 'utf8')).toBeLessThanOrEqual(TEMPLATE_LIMITS.promptBytes);
    expect(prompt, '提示词不得含机器路径').not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\/);
    expect(templatePromptSlotProblems({ kind: manifest.kind, fields: translation.fields }, prompt), `${files.prompt} 与译文的 fields 对不上`).toEqual([]);

    // Each item corresponds one-to-one with the original: where the original has hints and examples, the translation does too. Where the original has no example (for example the language of the finished cut, spec §4.3), the translation gives none either.
    (manifest.fields ?? []).forEach((field, i) => {
      const translated = translation.fields![i]!;
      expect(translated.hint != null, `fields[${i}].hint`).toBe(field.hint != null);
      expect(translated.example != null, `fields[${i}].example`).toBe(field.example != null);
    });
    // When the original's cover corner label is Chinese, other languages must give their own corner label. An English corner label may be reused.
    if (/\p{Script=Han}/u.test(manifest.cover.kicker ?? '')) expect(translation.cover?.kicker, 'cover.kicker').toBeTruthy();
    // Translations other than Chinese and Japanese should not contain leftover Han characters.
    if (!['zh-Hans', 'zh-Hant', 'ja'].includes(locale)) {
      const leftover = [JSON.stringify(translation), prompt].join('\n').match(/\p{Script=Han}+/gu);
      expect(leftover, '译文里残留汉字').toBeNull();
    }
  });
});
