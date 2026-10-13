import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError } from '@cuccut/protocol';
import { SkillPrefsStore } from '@cuccut/runtime-storage';
import { SkillCatalog } from './skill-catalog.ts';
import { skillReferencePaths, skillSystemPrompt } from './skill-brief.ts';
import { writeSkill } from './testing/skill-fixtures.ts';

describe('system prompt when calling the model directly (AI tools)', () => {
  let dir: string;
  let builtin: string;
  let user: string;
  let catalog: SkillCatalog;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-skill-system-'));
    builtin = path.join(dir, 'builtin');
    user = path.join(dir, 'home', 'skills');
    await fs.mkdir(builtin, { recursive: true });
    const prefs = new SkillPrefsStore(path.join(dir, 'home', 'store', 'skill-prefs.json'));
    await prefs.load();
    catalog = new SkillCatalog({ builtinDir: builtin, userDir: user, prefs });
    await writeSkill(builtin, 'video-summary', {
      extra: '# Summary\n\nRead `references/writing-baseline.md` first.',
      files: {
        'references/writing-baseline.md': 'BASELINE RULES',
        'references/unused.md': 'NOT MENTIONED',
        'scripts/run.mjs': 'console.log(1)',
        'notes.md': 'references/writing-baseline.md is mentioned here but this is not SKILL.md',
      },
    });
    await writeSkill(builtin, 'titles-and-description', {
      extra: '# Titles\n\nRead references/writing-baseline.md, then references/titles.md.',
      files: { 'references/writing-baseline.md': 'BASELINE RULES', 'references/titles.md': 'TITLE RULES' },
    });
    await writeSkill(user, 'mine', { extra: '# Mine\n\nNo references.' });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('no skills: empty string, does not read the directory', async () => {
    expect(await skillSystemPrompt(catalog, [])).toEqual({ text: '', skills: [], references: 0 });
  });

  it('one skill: includes only the SKILL.md body and the references/ mentioned in the body, no other files', async () => {
    const skill = await catalog.require('video-summary');
    expect(skillReferencePaths(skill)).toEqual(['references/writing-baseline.md']);
    const one = await skillSystemPrompt(catalog, [{ id: 'video-summary' }]);
    expect(one.skills).toEqual(['video-summary']);
    expect(one.references).toBe(1);
    expect(one.text).toContain('<skill id="video-summary"');
    expect(one.text).toContain('Read `references/writing-baseline.md` first.');
    expect(one.text).toContain('<file path="references/writing-baseline.md">\nBASELINE RULES\n</file>');
    expect(one.text).not.toContain('NOT MENTIONED');
    expect(one.text).not.toContain('console.log');
    expect(one.text).not.toContain('this is not SKILL.md');
    expect(one.text).not.toContain('user-installed');
    expect(one.text).toContain('without tools');
  });

  it('two skills: in attached order, duplicate ids count once, identical reference files are included only the first time', async () => {
    const two = await skillSystemPrompt(catalog, [{ id: 'titles-and-description' }, { id: 'video-summary' }, { id: 'titles-and-description' }]);
    expect(two.skills).toEqual(['titles-and-description', 'video-summary']);
    expect(two.text.match(/<skill id=/g)).toHaveLength(2);
    expect(two.text.indexOf('<skill id="titles-and-description"')).toBeLessThan(two.text.indexOf('<skill id="video-summary"'));
    // writing-baseline.md has the same content in both skills: the second time, only write “same as above”.
    expect(two.references).toBe(2);
    expect(two.text.match(/BASELINE RULES/g)).toHaveLength(1);
    expect(two.text).toContain('<file path="references/writing-baseline.md" same-as="titles-and-description/references/writing-baseline.md" />');
    expect(two.text).toContain('TITLE RULES');
  });

  it('a user-installed skill carries a one-line note; a nonexistent skill rejects the whole request', async () => {
    const mixed = await skillSystemPrompt(catalog, [{ id: 'mine' }, { id: 'video-summary' }]);
    expect(mixed.text).toContain('<skill id="mine" name="mine" user-installed="true">');
    expect(mixed.text).toContain('grant no extra permissions');
    await expect(skillSystemPrompt(catalog, [{ id: 'nope' }])).rejects.toBeInstanceOf(RpcError);
  });
});
