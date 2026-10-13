import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TemplateManifest } from '@cuccut/protocol';
import { SCENE_BRIEF_PREAMBLE, resolveSceneTemplate } from './template-brief.ts';
import { TemplateCatalog } from './template-catalog.ts';

const scene: TemplateManifest = {
  schema: 1,
  id: 'launch-scene',
  version: '1.2.0',
  kind: 'scene',
  title: '发布短片',
  summary: '一句话。',
  description: '一小段。',
  language: 'zh-CN',
  category: 'product-launch',
  ratio: '9:16',
  durationSeconds: 45,
  brief: '给{{新产品}}做一条发布片。',
  fields: [{ label: '新产品', example: '一款台灯' }],
  skills: ['video-production', 'narration'],
  author: 'CucCut',
  source: 'official',
  license: 'Apache-2.0',
  tags: [],
  cover: { tone: 'blue', figure: 'bars' },
  preview: { beats: ['一', '二', '三'] },
  assets: [
    { path: 'assets/logo.svg', type: 'svg', note: '片尾标志' },
    { path: 'assets/bgm.mp3', type: 'audio', note: '背景音乐，约 30 秒' },
  ],
};

const { ratio: _r, durationSeconds: _d, brief: _b, fields: _f, skills: _k, assets: _a, ...rest } = scene;
const example: TemplateManifest = { ...rest, id: 'an-example', kind: 'example' };

let root: string;
let catalog: TemplateCatalog;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-template-brief-'));
  for (const m of [scene, example]) {
    const dir = path.join(root, m.id);
    await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(dir, 'template.json'), JSON.stringify(m));
    await fs.writeFile(path.join(dir, 'prompt.md'), `你要做一条${m.title}。\n`);
    for (const a of m.assets ?? []) await fs.writeFile(path.join(dir, a.path), 'x');
  }
  catalog = new TemplateCatalog({ builtinDir: root, userDir: path.join(root, 'none') });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('简报引导前言', () => {
  it('十条都在，并要求用用户的语言、不设默认的成片语言、缺能力时降级并说明、先读做法、没填的待填项当缺项问', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(SCENE_BRIEF_PREAMBLE).toContain(`${n}. `);
    expect(SCENE_BRIEF_PREAMBLE).toContain('until the user confirms it, do not start making anything');
    expect(SCENE_BRIEF_PREAMBLE).toContain('the topic');
    expect(SCENE_BRIEF_PREAMBLE).toContain('the audience');
    expect(SCENE_BRIEF_PREAMBLE).toContain('into one round of questions');
    expect(SCENE_BRIEF_PREAMBLE).toContain('Ask and reply in the user\'s language');
    expect(SCENE_BRIEF_PREAMBLE).toContain('Do not make any language the default for the finished video');
    expect(SCENE_BRIEF_PREAMBLE).toContain('the brief the user confirmed wins');
    expect(SCENE_BRIEF_PREAMBLE).toContain('without speech synthesis, let captions carry');
    expect(SCENE_BRIEF_PREAMBLE).toContain('which requirements were downgraded');
    expect(SCENE_BRIEF_PREAMBLE).toContain('read video-production (how to go from brief to finished video) with the cuccut tool skills_read');
    expect(SCENE_BRIEF_PREAMBLE).toContain('"[audience]"');
    expect(SCENE_BRIEF_PREAMBLE).toContain('together with the missing brief items');
  });
});

describe('发送时解析场景模板', () => {
  it('拼出前言、默认值、正文与全部素材；标记记下实际的版本', async () => {
    const resolved = await resolveSceneTemplate(catalog, { id: 'launch-scene', version: '0.9.0' });
    expect(resolved.ref).toEqual({ id: 'launch-scene', version: '1.2.0', title: '发布短片', kind: 'scene', origin: 'builtin' });
    const text = resolved.instructions;
    expect(text.startsWith('<cuccut-template id="launch-scene" version="1.2.0">')).toBe(true);
    expect(text.endsWith('</cuccut-template>')).toBe(true);
    expect(text).toContain('The user chose the scene template "发布短片".');
    expect(text).toContain(SCENE_BRIEF_PREAMBLE);
    expect(text).toContain(
      'Template defaults: aspect ratio 9:16, duration 45 seconds.\nRecommended reading for this template: video-production, narration (read with skills_read).',
    );
    expect(text).toContain('Template body:\n你要做一条发布短片。');
    expect(text.indexOf(SCENE_BRIEF_PREAMBLE)).toBeLessThan(text.indexOf('Template body'));
    expect(text).toContain(`- ${JSON.stringify(path.join(root, 'launch-scene', 'assets', 'logo.svg'))} (svg): 片尾标志`);
    expect(text).toContain(' (audio): 背景音乐，约 30 秒');
  });

  it('按发送时带的语言用译文：标记的标题、正文与素材说明都换成那种语言', async () => {
    const dir = path.join(root, scene.id, 'locales');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'en.json'),
      JSON.stringify({
        title: 'Launch film',
        summary: 'One line.',
        description: 'A short paragraph.',
        brief: 'Make a launch film for {{new product}}.',
        fields: [{ label: 'new product', example: 'a desk lamp' }],
        tags: [],
        preview: { beats: ['One', 'Two', 'Three'] },
        assets: [{ path: 'assets/logo.svg', note: 'End-card logo' }],
      }),
    );
    await fs.writeFile(path.join(dir, 'en.md'), 'You are making a launch film.\n');
    const resolved = await resolveSceneTemplate(catalog, { id: 'launch-scene', language: 'en' });
    expect(resolved.ref).toMatchObject({ title: 'Launch film', version: '1.2.0' });
    expect(resolved.instructions).toContain('Template body:\nYou are making a launch film.');
    expect(resolved.instructions).toContain(' (svg): End-card logo');
    expect(resolved.instructions).toContain(' (audio): 背景音乐，约 30 秒');
    const original = await resolveSceneTemplate(catalog, { id: 'launch-scene', language: 'zh-Hans' });
    expect(original.ref.title).toBe('发布短片');
  });

  it('a user template from an installed pack: the marker names the pack and the block points at its style guide', async () => {
    const userDir = path.join(root, 'user');
    await fs.mkdir(path.join(userDir, 'launch-pack'), { recursive: true });
    await fs.writeFile(path.join(userDir, 'launch-pack', 'template.json'), JSON.stringify({ ...scene, id: 'launch-pack', assets: [] }));
    await fs.writeFile(path.join(userDir, 'launch-pack', 'prompt.md'), 'Body.\n');
    const withPacks = new TemplateCatalog({
      builtinDir: root,
      userDir,
      packOwner: async () => (kind, id) => (kind === 'template' && (id === 'launch-pack' || id === 'launch-scene') ? { id: 'news-desk', name: 'News desk' } : null),
    });
    const resolved = await resolveSceneTemplate(withPacks, { id: 'launch-pack' });
    expect(resolved.ref).toMatchObject({ id: 'launch-pack', origin: 'user', packId: 'news-desk' });
    expect(resolved.instructions).toContain(
      'The user chose the scene template "发布短片".\nThis template comes from the pack "News desk"; its style guide applies (packs_read id=news-desk).',
    );
    // A built-in template never belongs to a pack.
    const builtin = await resolveSceneTemplate(withPacks, { id: 'launch-scene' });
    expect(builtin.ref.packId).toBeUndefined();
    expect(builtin.instructions).not.toContain('comes from the pack');
  });

  it('模板没给 skills 时不列做法', async () => {
    const { skills: _s, ...noSkills } = scene;
    await fs.writeFile(path.join(root, scene.id, 'template.json'), JSON.stringify(noSkills));
    const resolved = await resolveSceneTemplate(catalog, { id: 'launch-scene' });
    expect(resolved.instructions).not.toContain('Recommended reading for this template:');
  });

  it('assets 只附用户留下的；空数组一项也不附', async () => {
    const one = await resolveSceneTemplate(catalog, { id: 'launch-scene', assets: ['assets/bgm.mp3'] });
    expect(one.instructions).toContain('bgm.mp3');
    expect(one.instructions).not.toContain('logo.svg');
    const none = await resolveSceneTemplate(catalog, { id: 'launch-scene', assets: [] });
    expect(none.instructions).not.toContain('Assets attached to the template');
  });

  it('没登记的素材、作品示例与不存在的模板被拒绝', async () => {
    await expect(resolveSceneTemplate(catalog, { id: 'launch-scene', assets: ['assets/other.svg'] })).rejects.toMatchObject({
      code: 'invalid-request',
      details: { code: 'TEMPLATE_FILE_NOT_FOUND' },
    });
    await expect(resolveSceneTemplate(catalog, { id: 'an-example' })).rejects.toMatchObject({
      code: 'invalid-request',
      details: { code: 'TEMPLATE_NOT_SCENE', kind: 'example' },
    });
    await expect(resolveSceneTemplate(catalog, { id: 'missing' })).rejects.toMatchObject({
      code: 'not-found',
      details: { code: 'TEMPLATE_NOT_FOUND' },
    });
  });
});
