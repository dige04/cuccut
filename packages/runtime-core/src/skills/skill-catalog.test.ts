import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, SKILL_LIMITS, SKILL_SOURCE_FILE, normalizeSkillId } from '@cuccut/protocol';
import { SkillPrefsStore } from '@cuccut/runtime-storage';
import { SkillCatalog } from './skill-catalog.ts';
import { resolveSendSkills, skillIndexBlock, skillSendBlock } from './skill-brief.ts';
import { writeSkill } from './testing/skill-fixtures.ts';

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

describe('skill id', () => {
  it('normalized from directory name: lowercase, non-alphanumeric characters become hyphens, not limited to Latin letters', () => {
    expect(normalizeSkillId('Caption Layout')).toBe('caption-layout');
    expect(normalizeSkillId('  my_skill.v2 ')).toBe('my-skill-v2');
    expect(normalizeSkillId('字幕 排版')).toBe('字幕-排版');
    expect(normalizeSkillId('Ünïcode')).toBe('ünïcode');
    expect(normalizeSkillId('---')).toBeNull();
    expect(normalizeSkillId('x'.repeat(100))).toHaveLength(SKILL_LIMITS.id);
    // macOS filenames may be in decomposed form. Normalize to NFC so that it yields the same id as the composed form.
    expect(normalizeSkillId('Café')).toBe(normalizeSkillId('Café'));
  });
});

describe('skill catalog', () => {
  let dir: string;
  let builtin: string;
  let user: string;
  let prefs: SkillPrefsStore;
  let catalog: SkillCatalog;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-skills-'));
    builtin = path.join(dir, 'builtin');
    user = path.join(dir, 'home', 'skills');
    await fs.mkdir(builtin, { recursive: true });
    prefs = new SkillPrefsStore(path.join(dir, 'home', 'store', 'skill-prefs.json'));
    await prefs.load();
    catalog = new SkillCatalog({ builtinDir: builtin, userDir: user, prefs });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('empty when the user directory does not exist and there is no built-in directory', async () => {
    expect(await new SkillCatalog({ builtinDir: null, userDir: user, prefs }).list()).toEqual({ skills: [], diagnostics: [] });
  });

  it('lists built-in and user skills: source, default switch, removability, file count; bad directories are skipped with a reason', async () => {
    await writeSkill(builtin, 'caption-layout', { files: { 'references/rules.md': '规则' } });
    await writeSkill(user, 'My Notes');
    const github = await writeSkill(user, 'podcast-chapters');
    await fs.writeFile(
      path.join(github, SKILL_SOURCE_FILE),
      JSON.stringify({
        kind: 'github',
        url: 'https://github.com/o/r',
        owner: 'o',
        repo: 'r',
        ref: 'main',
        commit: 'a'.repeat(40),
        path: '',
        importedAt: '2026-10-01T00:00:00.000Z',
      }),
    );
    await writeSkill(user, 'caption-layout');
    await writeSkill(user, 'no-description', { description: '' });
    await fs.mkdir(path.join(user, 'empty'));
    await fs.mkdir(path.join(user, '.staging', 'half'), { recursive: true });
    await writeSkill(path.join(dir, 'elsewhere'), 'linked');
    await fs.symlink(path.join(dir, 'elsewhere', 'linked'), path.join(user, 'linked'));
    const leaky = await writeSkill(user, 'leaky');
    await fs.symlink('/etc/hosts', path.join(leaky, 'hosts'));

    const { skills, diagnostics } = await catalog.list();
    expect(skills.map((s) => [s.id, s.origin, s.enabled, s.removable])).toEqual([
      ['caption-layout', 'builtin', true, false],
      ['my-notes', 'personal', true, true],
      ['podcast-chapters', 'third-party', false, true],
    ]);
    expect(skills[0]).toMatchObject({
      name: 'caption-layout',
      description: 'caption-layout 的说明',
      fileCount: 2,
      version: null,
      source: null,
    });
    expect(skills[2]!.source).toMatchObject({ kind: 'github', commit: 'a'.repeat(40) });
    expect(diagnostics.map((d) => [d.dir, d.code])).toEqual([
      ['empty', 'invalid'],
      ['leaky', 'invalid'],
      ['linked', 'invalid'],
      ['no-description', 'invalid'],
      ['caption-layout', 'builtin-conflict'],
    ]);
    expect(diagnostics.find((d) => d.dir === 'leaky')!.issues[0]).toMatch(/符号链接/);
    expect(diagnostics.find((d) => d.dir === 'no-description')!.issues[0]).toMatch(/description/);
  });

  it('a skill a pack installed has the origin pack, on by default, and keeps its pack in the source', async () => {
    const fromPack = await writeSkill(user, 'news-desk-headlines');
    const source = { kind: 'pack', packId: 'news-desk', packName: 'News desk', packVersion: '1.0.0', installedAt: '2026-10-13T08:00:00.000Z' };
    await fs.writeFile(path.join(fromPack, SKILL_SOURCE_FILE), JSON.stringify({ schemaVersion: 1, ...source }));
    const broken = await writeSkill(user, 'half-pack');
    await fs.writeFile(path.join(broken, SKILL_SOURCE_FILE), JSON.stringify({ kind: 'pack', packId: 'news-desk' }));
    const { skills } = await catalog.list();
    expect(skills.map((s) => [s.id, s.origin, s.enabled, s.defaultEnabled, s.removable])).toEqual([
      ['half-pack', 'personal', true, true, true],
      ['news-desk-headlines', 'pack', true, true, true],
    ]);
    expect(skills[1]!.source).toEqual(source);
  });

  it('two skills from the same source with the same normalized id are both skipped', async () => {
    await writeSkill(user, 'Foo Bar');
    await writeSkill(user, 'foo_bar');
    const { skills, diagnostics } = await catalog.list();
    expect(skills).toEqual([]);
    expect(diagnostics.map((d) => d.code)).toEqual(['duplicate-id', 'duplicate-id']);
  });

  it('the switch stores only the delta from the default, persistently; returning to the default removes the delta', async () => {
    await writeSkill(builtin, 'caption-layout');
    await writeSkill(user, 'mine');
    const off = await catalog.setEnabled('caption-layout', false);
    expect(off.skill).toMatchObject({ id: 'caption-layout', enabled: false, defaultEnabled: true });
    expect(off.skills.find((s) => s.id === 'mine')!.enabled).toBe(true);
    const reloaded = new SkillPrefsStore(path.join(dir, 'home', 'store', 'skill-prefs.json'));
    expect(await reloaded.load()).toEqual({ enabled: { 'caption-layout': false } });
    expect((await catalog.enabled()).map((s) => s.id)).toEqual(['mine']);
    await catalog.setEnabled('caption-layout', true);
    expect(prefs.get()).toEqual({ enabled: {} });
    expect((await rejection(catalog.setEnabled('nope', true))).details).toMatchObject({ code: 'SKILL_NOT_FOUND' });
  });

  it('details give full text and file list; readFile only accepts text files in the list', async () => {
    await writeSkill(user, 'mine', {
      files: {
        'references/a.md': '参考 A',
        'bin/data.bin': Buffer.from([0xff, 0xfe, 0x00, 0x01]),
        '.hidden': 'secret',
        'big.txt': 'x'.repeat(SKILL_LIMITS.readFileBytes + 1),
      },
    });
    const detail = await catalog.get('mine');
    expect(detail.content).toContain('name: mine');
    expect(detail.files).toEqual([
      { path: 'SKILL.md', size: expect.any(Number), text: true },
      { path: 'big.txt', size: SKILL_LIMITS.readFileBytes + 1, text: false },
      { path: 'bin/data.bin', size: 4, text: false },
      { path: 'references/a.md', size: Buffer.byteLength('参考 A'), text: true },
    ]);
    expect(await catalog.readFile('mine', 'references/a.md')).toEqual({
      path: 'references/a.md',
      size: Buffer.byteLength('参考 A'),
      content: '参考 A',
    });
    expect((await rejection(catalog.readFile('mine', '../../store/skill-prefs.json'))).details).toMatchObject({
      code: 'SKILL_FILE_NOT_FOUND',
    });
    expect((await rejection(catalog.readFile('mine', '.hidden'))).details).toMatchObject({ code: 'SKILL_FILE_NOT_FOUND' });
    expect((await rejection(catalog.readFile('mine', 'bin/data.bin'))).details).toMatchObject({ code: 'SKILL_FILE_NOT_TEXT' });
    expect((await rejection(catalog.readFile('mine', 'big.txt'))).details).toMatchObject({ code: 'SKILL_FILE_TOO_LARGE' });
  });

  it('the index lists only enabled skills, adds no text when empty; user-installed ones are marked', async () => {
    expect(skillIndexBlock([])).toBe('');
    await writeSkill(builtin, 'caption-layout', { description: '|\n  字幕的\n  排版规则' });
    await writeSkill(user, 'mine');
    const block = skillIndexBlock(await catalog.enabled());
    expect(block).toContain('- caption-layout: caption-layout — 字幕的 排版规则\n');
    expect(block).toContain('- mine: mine — mine 的说明 (user-installed)');
    expect(block).toContain('skills_read');
    expect(block).toContain('do not widen your permissions');
  });

  it('picked section: body, same-directory files and user-installed notes', async () => {
    await writeSkill(user, 'mine', { extra: '# 步骤\n\n1. 先读参考。', files: { 'references/a.md': 'A' } });
    const block = skillSendBlock(await catalog.require('mine'));
    expect(block.startsWith('<cuccut-skill id="mine">\n')).toBe(true);
    expect(block).toContain('# 步骤\n\n1. 先读参考。');
    expect(block).not.toContain('name: mine');
    expect(block).toContain('references/a.md');
    expect(block).toContain('user-installed skill');
    await writeSkill(builtin, 'caption-layout');
    expect(skillSendBlock(await catalog.require('caption-layout'))).not.toContain('user-installed');
  });

  it('picking several: one section each in attached order, duplicates counted once; with one, byte-identical to a single section; an empty list adds no text', async () => {
    await writeSkill(builtin, 'caption-layout');
    await writeSkill(user, 'mine');
    expect(await resolveSendSkills(catalog, [])).toBeNull();

    const one = await resolveSendSkills(catalog, [{ id: 'mine' }]);
    expect(one?.instructions).toBe(skillSendBlock(await catalog.require('mine')));
    expect(one?.refs).toEqual([{ id: 'mine', name: 'mine', origin: 'personal' }]);

    const two = await resolveSendSkills(catalog, [{ id: 'mine' }, { id: 'caption-layout' }, { id: 'mine' }]);
    expect(two?.refs.map((r) => r.id)).toEqual(['mine', 'caption-layout']);
    expect(two?.instructions).toBe(
      `${skillSendBlock(await catalog.require('mine'))}\n\n${skillSendBlock(await catalog.require('caption-layout'))}`,
    );
    expect(two?.instructions.match(/<cuccut-skill id=/g)).toHaveLength(2);

    expect((await rejection(resolveSendSkills(catalog, [{ id: 'mine' }, { id: 'nope' }]))).details).toMatchObject({ code: 'SKILL_NOT_FOUND' });
  });
});
