import { describe, expect, it } from 'vitest';
import { RpcError, type SkillSummary } from '@cuccut/protocol';
import {
  appendSkillId,
  clipLine,
  countSkills,
  filterSkills,
  fileSizeLabel,
  sendFailureMessage,
  skillBody,
  skillErrorCode,
  skillErrorMessage,
  skillMenuItems,
  packOriginLabel,
  SKILL_ORIGIN_LABEL,
  SKILL_TABS,
  skillMetaLine,
  skillOriginLabel,
  skillSourceLine,
  sortSkills,
} from './agent-skills.ts';

function skill(id: string, patch: Partial<SkillSummary> = {}): SkillSummary {
  return {
    id,
    name: id,
    description: `${id} 的说明`,
    version: null,
    origin: 'personal',
    enabled: true,
    defaultEnabled: true,
    removable: true,
    path: `/home/skills/${id}`,
    source: null,
    fileCount: 1,
    updatedAt: '2026-10-01T00:00:00Z',
    ...patch,
  };
}

const list = [
  skill('subtitle-style', { name: 'Subtitle Style', description: 'Line breaks and punctuation for captions' }),
  skill('chapters', { name: '分章方法', description: '按话题切分章节', origin: 'third-party', enabled: false }),
  skill('brand', { name: '品牌规范', origin: 'builtin', removable: false }),
];

describe('list sorting, search and filtering', () => {
  it('sorts by source (built-in, mine, third-party) then by name, not relying on the Runtime\'s order', () => {
    expect(sortSkills([...list].reverse()).map((s) => s.id)).toEqual(['brand', 'subtitle-style', 'chapters']);
  });

  it('searches name, description and id, case-insensitive; assumes no language', () => {
    expect(filterSkills(list, 'subtitle', 'all').map((s) => s.id)).toEqual(['subtitle-style']);
    expect(filterSkills(list, 'PUNCTUATION', 'all').map((s) => s.id)).toEqual(['subtitle-style']);
    expect(filterSkills(list, '章节', 'all').map((s) => s.id)).toEqual(['chapters']);
    expect(filterSkills(list, '  ', 'all')).toHaveLength(3);
  });

  it('filters by source, combined with search; the count follows the search term', () => {
    expect(filterSkills(list, '', 'third-party').map((s) => s.id)).toEqual(['chapters']);
    expect(filterSkills(list, 'subtitle', 'builtin')).toEqual([]);
    expect(countSkills(list, '')).toEqual({ all: 3, builtin: 1, personal: 1, 'third-party': 1, pack: 0 });
    expect(countSkills(list, '品牌')).toEqual({ all: 1, builtin: 1, personal: 0, 'third-party': 0, pack: 0 });
  });
});

describe('the \'+ › Use Skill\' entry in the input', () => {
  it('enabled ones first, keeping original order within the group; disabled ones are listed too (selecting does not check the toggle)', () => {
    const items = skillMenuItems([skill('a', { enabled: false }), skill('b'), skill('c', { enabled: false }), skill('d')]);
    expect(items.map((i) => i.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(items.map((i) => i.enabled)).toEqual([true, true, false, false]);
  });

  it('description folded into one line, long ones truncated with an ellipsis, without breaking supplementary characters', () => {
    expect(clipLine('第一行\n\n第二行   第三段')).toBe('第一行 第二行 第三段');
    expect(clipLine('一二三四五六', 4)).toBe('一二三…');
    expect(clipLine('😀😀😀😀😀', 3)).toBe('😀😀…');
    const [item] = skillMenuItems([skill('long', { description: 'x'.repeat(200) })]);
    expect([...item!.description]).toHaveLength(60);
  });

  it('attached skills are appended, and already-attached ones are not duplicated (a built-in that is removed and re-added is also appended)', () => {
    expect(appendSkillId([], 'a')).toEqual(['a']);
    expect(appendSkillId(['a'], 'b')).toEqual(['a', 'b']);
    expect(appendSkillId(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(appendSkillId(['b'], 'builtin')).toEqual(['b', 'builtin']);
  });
});

describe('card and detail text', () => {
  it('source · version', () => {
    expect(skillMetaLine({ origin: 'builtin', version: '1.2.0' })).toBe('内置 · v1.2.0');
    expect(skillMetaLine({ origin: 'third-party', version: null })).toBe('第三方');
  });

  it('source: a local path, or a GitHub address@ref (commits take the first 7 characters)', () => {
    expect(skillSourceLine(null)).toBeNull();
    expect(skillSourceLine({ kind: 'local', path: '/Users/me/skills/x', addedAt: '2026-10-01T00:00:00Z' })).toBe('/Users/me/skills/x');
    expect(
      skillSourceLine({
        kind: 'github',
        url: 'https://github.com/o/r/tree/main/skills/x',
        owner: 'o',
        repo: 'r',
        ref: 'main',
        commit: '0123456789abcdef',
        path: 'skills/x',
        importedAt: '2026-10-01T00:00:00Z',
      }),
    ).toBe('https://github.com/o/r/tree/main/skills/x@main（0123456）');
  });

  it('a skill a pack installed says which pack, on the card, in the badge and as its source', () => {
    const source = { kind: 'pack', packId: 'news-desk', packName: 'News desk', packVersion: '1.2.0', installedAt: '2026-10-13T08:00:00Z' } as const;
    const label = packOriginLabel('News desk');
    expect(label).toContain('News desk');
    expect(skillOriginLabel({ origin: 'pack', source })).toBe(label);
    expect(skillOriginLabel({ origin: 'personal', source: null })).toBe(SKILL_ORIGIN_LABEL.personal);
    expect(skillMetaLine({ origin: 'pack', version: '2.0.0', source })).toBe(`${label} · v2.0.0`);
    expect(skillSourceLine(source)).toBe(`${label} · v1.2.0`);
    expect(sortSkills([skill('z', { origin: 'pack', source }), skill('a')]).map((s) => s.id)).toEqual(['a', 'z']);
    expect(countSkills([skill('z', { origin: 'pack', source })], '')).toMatchObject({ all: 1, pack: 1 });
    expect(SKILL_TABS.map((t) => t.key)).toEqual(['all', 'builtin', 'personal', 'third-party', 'pack']);
  });

  it('SKILL.md strips the leading front matter, and is returned as-is when there is none', () => {
    expect(skillBody('---\nname: x\ndescription: y\n---\n\n# 标题\n正文')).toBe('# 标题\n正文');
    expect(skillBody('﻿---\r\nname: x\r\n---\r\n正文')).toBe('正文');
    expect(skillBody('# 没有 front matter')).toBe('# 没有 front matter');
  });

  it('file size', () => {
    expect(fileSizeLabel(512)).toBe('512 字节');
    expect(fileSizeLabel(2048)).toBe('2.0 KB');
    expect(fileSizeLabel(300 * 1024)).toBe('300 KB');
    expect(fileSizeLabel(8 * 1024 * 1024)).toBe('8.0 MB');
  });
});

describe('error codes are turned into plain language', () => {
  const err = (code: string, details: Record<string, unknown> = {}) => new RpcError('conflict', 'Runtime 的原话', { code, ...details });

  it('reads details.code; null when the error is not an RpcError or has no sub-code', () => {
    expect(skillErrorCode(err('SKILL_EXISTS'))).toBe('SKILL_EXISTS');
    expect(skillErrorCode(new RpcError('internal', 'x'))).toBeNull();
    expect(skillErrorCode(new Error('x'))).toBeNull();
  });

  it('already exists, malformed, over the limit, wrong address, offline, rate-limited and network errors each have their own wording', () => {
    expect(skillErrorMessage(err('SKILL_EXISTS', { skillId: 'subtitle-style' }), 'add')).toContain('「subtitle-style」');
    expect(skillErrorMessage(err('SKILL_EXISTS'), 'import')).toContain('先移除旧的');
    expect(skillErrorMessage(err('SKILL_INVALID', { issues: ['根目录缺少 SKILL.md'] }), 'add')).toContain('根目录缺少 SKILL.md');
    expect(skillErrorMessage(err('SKILL_TOO_LARGE'), 'import')).toContain('200 个文件');
    expect(skillErrorMessage(err('SKILL_GITHUB_URL_INVALID'), 'import')).toContain('owner/repo');
    expect(skillErrorMessage(err('OFFLINE_STRICT'), 'import')).toContain('严格离线');
    expect(skillErrorMessage(err('SKILL_GITHUB_RATE_LIMITED'), 'import')).toContain('访问次数');
    expect(skillErrorMessage(err('SKILL_GITHUB_NETWORK'), 'import')).toContain('连不上 GitHub');
    expect(skillErrorMessage(err('WEB_METHOD_NOT_ALLOWED'), 'remove')).toContain('桌面应用');
  });

  it('the same \'source not found\' is worded per action: import says it is not on GitHub, add says the folder is gone', () => {
    expect(skillErrorMessage(err('SKILL_SOURCE_NOT_FOUND'), 'import')).toContain('GitHub');
    expect(skillErrorMessage(err('SKILL_SOURCE_NOT_FOUND'), 'add')).toContain('文件夹');
  });

  it('unrecognized ones fall back to the Runtime\'s original message', () => {
    expect(skillErrorMessage(new Error('磁盘满了'), 'add')).toBe('没能添加：磁盘满了');
  });

  it('send failure: a skill error states the skill\'s reason, otherwise unchanged', () => {
    expect(sendFailureMessage(new RpcError('not-found', 'x', { code: 'SKILL_NOT_FOUND' }))).toContain('已经不在了');
    expect(sendFailureMessage(new Error('断线'))).toBe('没能发送：断线');
  });
});
