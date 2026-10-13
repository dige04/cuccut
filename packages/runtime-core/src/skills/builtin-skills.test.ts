import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SKILL_LIMITS } from '@cuccut/protocol';
import { SkillPrefsStore } from '@cuccut/runtime-storage';
import { SkillCatalog, resolveBuiltinSkillsDir, type LoadedSkill } from './skill-catalog.ts';

/**
 * Built-in skills shipped with the app, under `skills/cuccut/built-in-skills/` in the repository root. When adding or renaming one, update this file as well as the index in `README.md` there and the “Built-in skills” table in the instruction manual `SKILL.md`.
 */
const EXPECTED_IDS = [
  'cover-and-title',
  'design',
  'design-system',
  'motion-graphics',
  'narration',
  'polish-transcript',
  'shorts-segments',
  'slides',
  'speaker-labeling',
  'subtitle-workflow',
  'talking-head-cut',
  'titles-and-description',
  'translate-subtitles',
  'video-blog',
  'video-chapters',
  'video-production',
  'video-summary',
];

/** Built-in skills only for the in-session agent. The routing in the instruction manual lists them only on the tool-bridge surface, and the “Built-in skills” table on the CLI surface does not list them. */
const AGENT_ONLY_IDS = ['design', 'design-system', 'slides'];

/** The skill index at session start takes only the first 300 characters of description (`skill-brief.ts`). The built-in ones are written within this length. */
const INDEX_DESCRIPTION_CHARS = 300;

describe('built-in skills in the repo', () => {
  let tmp: string;
  let builtinDir: string;
  let skills: LoadedSkill[];
  let catalog: SkillCatalog;

  beforeAll(async () => {
    const resolved = resolveBuiltinSkillsDir({});
    expect(resolved).not.toBeNull();
    builtinDir = resolved!;
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-builtin-skills-'));
    const prefs = new SkillPrefsStore(path.join(tmp, 'store', 'skill-prefs.json'));
    await prefs.load();
    catalog = new SkillCatalog({ builtinDir, userDir: path.join(tmp, 'skills'), prefs });
    const scan = await catalog.scan();
    expect(scan.diagnostics).toEqual([]);
    skills = scan.skills;
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('in development, finds skills/cuccut/built-in-skills/ from the repo root, loads all, no diagnostics', async () => {
    expect(builtinDir.endsWith(path.join('skills', 'cuccut', 'built-in-skills'))).toBe(true);
    expect(skills.map((s) => s.id).sort()).toEqual(EXPECTED_IDS);
    const list = await catalog.list();
    expect(list.diagnostics).toEqual([]);
    for (const summary of list.skills) {
      expect(summary).toMatchObject({ origin: 'builtin', enabled: true, defaultEnabled: true, removable: false, source: null });
    }
  });

  it('front matter is complete and within limits', () => {
    for (const skill of skills) {
      expect(skill.name.trim(), skill.id).not.toBe('');
      expect(skill.name.length, skill.id).toBeLessThanOrEqual(SKILL_LIMITS.name);
      expect(skill.description.length, skill.id).toBeLessThanOrEqual(Math.min(SKILL_LIMITS.description, INDEX_DESCRIPTION_CHARS));
      expect(skill.version, skill.id).toMatch(/^\d+\.\d+\.\d+$/);
      expect(skill.version!.length, skill.id).toBeLessThanOrEqual(SKILL_LIMITS.version);
      expect(skill.body.trim(), skill.id).not.toBe('');
    }
    const names = skills.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('file count and size within limits, all references files mentioned in the body exist', () => {
    for (const skill of skills) {
      const skillFile = skill.files.find((f) => f.path === 'SKILL.md');
      expect(skillFile, skill.id).toBeDefined();
      expect(skillFile!.size, skill.id).toBeLessThanOrEqual(SKILL_LIMITS.skillFileBytes);
      expect(skill.files.length, skill.id).toBeLessThanOrEqual(SKILL_LIMITS.files);
      expect(
        skill.files.reduce((sum, f) => sum + f.size, 0),
        skill.id,
      ).toBeLessThanOrEqual(SKILL_LIMITS.totalBytes);
      const paths = new Set(skill.files.map((f) => f.path));
      for (const match of skill.body.matchAll(/`(references\/[^`]+\.md)`/g)) {
        expect(paths.has(match[1]!), `${skill.id} → ${match[1]}`).toBe(true);
      }
    }
  });

  it('directory README.md index lists all built-in skills, each line linking to its SKILL.md', async () => {
    const readme = await fs.readFile(path.join(builtinDir, 'README.md'), 'utf8');
    const rows = [...readme.matchAll(/^\| \[`([a-z0-9-]+)`\]\(([^)]+)\) \|/gm)];
    expect(rows.map((row) => row[1]).sort()).toEqual(EXPECTED_IDS);
    for (const [, id, target] of rows) expect(target, id).toBe(`${id}/SKILL.md`);
  });

  it('the manual SKILL.md\'s "built-in skills" table (CLI surface only) lists all built-in skills, excluding those only for in-session agents', async () => {
    const manual = await fs.readFile(path.join(builtinDir, '..', 'SKILL.md'), 'utf8');
    const start = manual.indexOf('### Built-in skills');
    expect(start).toBeGreaterThan(0);
    const section = manual.slice(start, manual.indexOf('<!-- /surface -->', start));
    const ids = [...section.matchAll(/^\| \{\{skill:([a-z0-9-]+)\}\} \|/gm)].map((row) => row[1]);
    expect(ids.sort()).toEqual(EXPECTED_IDS.filter((id) => !AGENT_ONLY_IDS.includes(id)));
  });
});
