import { describe, expect, it } from 'vitest';
import { parseSkillFrontmatter } from './skill-frontmatter.ts';

function fields(text: string): Record<string, string> {
  const result = parseSkillFrontmatter(text);
  if (!result.ok) throw new Error(result.problem.text);
  return Object.fromEntries(result.fields);
}

describe('SKILL.md front matter', () => {
  it('reads top-level key: value; body starts after the closing ---', () => {
    const result = parseSkillFrontmatter('---\nname: caption-layout\ndescription: 字幕排版规范 # 注释\nversion: 1.2.0\n---\n\n# 正文\n');
    expect(result).toEqual({
      ok: true,
      fields: new Map([
        ['name', 'caption-layout'],
        ['description', '字幕排版规范'],
        ['version', '1.2.0'],
      ]),
      body: '\n# 正文\n',
    });
  });

  it('quotes, block scalars and multi-line scalars', () => {
    expect(
      fields(
        [
          '---',
          'name: "Talking \\"head\\" cut"',
          "author: 'It''s me'",
          'description: >',
          '  Folded line one',
          '  and two.',
          '',
          '  Next paragraph.',
          'notes: |-',
          '  line 1',
          '    indented',
          'summary: plain start',
          '  continues here',
          '---',
          '',
        ].join('\r\n'),
      ),
    ).toEqual({
      name: 'Talking "head" cut',
      author: "It's me",
      description: 'Folded line one and two.\nNext paragraph.',
      notes: 'line 1\n  indented',
      summary: 'plain start continues here',
    });
  });

  it('nested mappings and lists are skipped, value is an empty string; does not affect later keys', () => {
    expect(
      fields('---\nname: x\nmetadata:\n  author: someone\n  tags: [a, b]\nallowed-tools:\n  - Read\n  - Grep\ndescription: d\n---\n'),
    ).toEqual({ name: 'x', metadata: '', 'allowed-tools': '', description: 'd' });
  });

  it('non-compliant when it does not start with ---, has no end, or has unreadable top-level lines', () => {
    expect(parseSkillFrontmatter('# 没有 front matter\n').ok).toBe(false);
    expect(parseSkillFrontmatter('---\nname: x\n').ok).toBe(false);
    expect(parseSkillFrontmatter('---\nname: x\n- stray\n---\n').ok).toBe(false);
    expect(parseSkillFrontmatter('﻿---\nname: x\n---\n').ok).toBe(true);
  });

  it('name and description kept as is, no language assumed', () => {
    expect(fields('---\nname: 字幕排版\ndescription: Règles de sous-titrage — 日本語も\n---\n')).toEqual({
      name: '字幕排版',
      description: 'Règles de sous-titrage — 日本語も',
    });
  });
});
