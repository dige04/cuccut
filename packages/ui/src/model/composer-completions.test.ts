import { describe, expect, it } from 'vitest';
import type { SpaceEntry, SpaceEntryKind } from '@cuccut/protocol';
import {
  activeCompletion,
  appendMentionAnchor,
  applySlash,
  COMPLETION_TRIGGER,
  mentionCandidates,
  mentionText,
  slashMatches,
  videoMentionCandidates,
} from './composer-completions.ts';

const entry = (id: string, relPath: string, extra: Partial<SpaceEntry> & { kind?: SpaceEntryKind } = {}): SpaceEntry => ({
  id,
  kind: 'document',
  name: relPath.split('/').at(-1)!,
  fileName: relPath.split('/').at(-1)!,
  source: { projectId: 'p1', conversationId: null },
  relPath,
  size: 1,
  lastActivityAt: '2026-10-01T00:00:00Z',
  status: null,
  user: { favorite: false, displayName: null, trashedAt: null },
  ...extra,
});

describe('slash commands', () => {
  it('only recognizes a /token at the start of the body, before a space is typed', () => {
    expect(activeCompletion('/')).toEqual({ kind: 'slash', query: '', raw: '/' });
    expect(activeCompletion('/tra')).toEqual({ kind: 'slash', query: 'tra', raw: '/tra' });
    expect(activeCompletion('/translate ')).toBeNull();
    expect(activeCompletion('说点什么\n/tra')).toBeNull();
    expect(activeCompletion('看看 a/b')).toBeNull();
    expect(activeCompletion('看看 /tmp')).toBeNull();
  });

  it('lists tools connected to an Agent (excluding smart trim and cut into short video), filtered by command prefix or Chinese label', () => {
    expect(slashMatches('').map((c) => c.cmd)).toEqual([
      '/polish',
      '/chapters',
      '/speakers',
      '/retranscribe',
      '/clean',
      '/translate',
      '/refresh',
      '/dub',
      '/summary',
      '/blog',
      '/title',
      '/desc',
      '/cover',
      '/export',
    ]);
    expect(slashMatches('tr').map((c) => c.cmd)).toEqual(['/translate']);
    expect(slashMatches('re').map((c) => c.cmd)).toEqual(['/retranscribe', '/refresh']);
    expect(slashMatches('导出').map((c) => c.cmd)).toEqual(['/export']);
  });

  it('choose from menu: replaces the existing /token at the start, leaving only `/xxx ` in the body', () => {
    expect(applySlash('', '/polish')).toBe('/polish ');
    expect(applySlash('/tr 第二段', '/translate')).toBe('/translate 第二段');
    expect(applySlash('把第二段翻成英文', '/translate')).toBe('/translate 把第二段翻成英文');
  });

  it('trigger regex matches the check: / and @ at start or after whitespace', () => {
    expect(COMPLETION_TRIGGER.test('/x')).toBe(true);
    expect(COMPLETION_TRIGGER.test('a/b')).toBe(false);
    expect(COMPLETION_TRIGGER.test('look up @x')).toBe(true);
    expect(COMPLETION_TRIGGER.test('me@x.com')).toBe(false);
  });
});

describe('@ mention', () => {
  it('@ must be preceded by start or whitespace; query cannot contain whitespace or quotes', () => {
    expect(activeCompletion('@')).toEqual({ kind: 'mention', query: '', raw: '@' });
    expect(activeCompletion('参考 @clip')).toEqual({ kind: 'mention', query: 'clip', raw: '@clip' });
    expect(activeCompletion('第一行\n@cl')).toEqual({ kind: 'mention', query: 'cl', raw: '@cl' });
    expect(activeCompletion('me@example.com')).toBeNull();
    expect(activeCompletion('@clip 之后')).toBeNull();
    expect(activeCompletion('@"a b')).toBeNull();
  });

  it('insert text: path gets quotes only when it has whitespace or quotes, quotes escaped', () => {
    expect(mentionText('intro.mp4')).toBe('@intro.mp4');
    expect(mentionText('素材/第一 集.mp4')).toBe('@"素材/第一 集.mp4"');
    expect(mentionText('say "hi".srt')).toBe('@"say \\"hi\\".srt"');
  });

  it('\'+\' menu reference: appends an @ at the end, and a space first if preceded by non-whitespace', () => {
    expect(appendMentionAnchor('')).toBe('@');
    expect(appendMentionAnchor('看看')).toBe('看看 @');
    expect(appendMentionAnchor('看看 ')).toBe('看看 @');
  });

  it('candidates only from this project, not in trash; videos first, by recent activity', () => {
    const entries = [
      entry('a', 'notes.md', { lastActivityAt: '2026-10-02T00:00:00Z' }),
      entry('b', 'trip', { kind: 'video', lastActivityAt: '2026-09-01T00:00:00Z' }),
      entry('c', 'old.md', { lastActivityAt: '2026-08-01T00:00:00Z' }),
      entry('d', 'gone.md', { user: { favorite: false, displayName: null, trashedAt: '2026-10-01T00:00:00Z' } }),
      entry('e', 'other.md', { source: { projectId: 'p2', conversationId: null } }),
    ];
    const scope = { projectId: 'p1', conversationId: 'c1' };
    expect(mentionCandidates(entries, scope, '').map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(mentionCandidates(entries, scope, 'NOTE').map((c) => c.id)).toEqual(['a']);
    expect(mentionCandidates(entries, scope, '')[0]).toMatchObject({ label: 'trip', description: '视频 · trip', insert: '@trip' });
  });

  it('sessions not belonging to a project use their own working directory; a new session without a project has no candidates', () => {
    const entries = [entry('a', 'x.md', { source: { projectId: null, conversationId: 'c1' } }), entry('b', 'y.md')];
    expect(mentionCandidates(entries, { projectId: null, conversationId: 'c1' }, '').map((c) => c.id)).toEqual(['a']);
    expect(mentionCandidates(entries, { projectId: null, conversationId: null }, '')).toEqual([]);
  });
});

describe('@ references this video\'s chapters and speakers', () => {
  const mentions = {
    chapters: [
      { id: 'm1', index: 0, label: '开场', title: '开场', start: 12.4, end: 90.9 },
      { id: 'm2', index: 1, label: ' ', title: '第 2 章', start: 90.9, end: 3725 },
    ],
    speakers: [
      { id: 'd1:s1', name: '主持人' },
      { id: 'd1:s2', name: 'Guest' },
    ],
  };

  it('chapter insertion includes number, name and start/end time; unnamed ones only the number; speakers as their name', () => {
    expect(videoMentionCandidates(mentions, '')).toEqual([
      { id: 'chapter:m1', label: '开场', description: '章节 · 00:12–01:30', insert: '@第 1 章 开场（00:12–01:30）' },
      { id: 'chapter:m2', label: '第 2 章', description: '章节 · 01:30–01:02:05', insert: '@第 2 章（01:30–01:02:05）' },
      { id: 'speaker:d1:s1', label: '主持人', description: '说话人', insert: '@说话人「主持人」' },
      { id: 'speaker:d1:s2', label: 'Guest', description: '说话人', insert: '@说话人「Guest」' },
    ]);
  });

  it('query matches names, and also recognizes \'chapter\', \'speaker\' and \'Chapter N\'', () => {
    const ids = (query: string) => videoMentionCandidates(mentions, query).map((c) => c.id);
    expect(ids('开')).toEqual(['chapter:m1']);
    expect(ids('章节')).toEqual(['chapter:m1', 'chapter:m2']);
    expect(ids('第2章')).toEqual(['chapter:m2']);
    expect(ids('说话')).toEqual(['speaker:d1:s1', 'speaker:d1:s2']);
    expect(ids('guest')).toEqual(['speaker:d1:s2']);
    expect(ids('没有')).toEqual([]);
  });
});
