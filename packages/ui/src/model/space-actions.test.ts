import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import {
  continueBlock,
  editBlock,
  editRoute,
  entryConversationId,
  entryJobId,
  entryMenuKey,
  importSummary,
  isFailedPlaceholder,
  packageBlock,
  packageScope,
  placeKindOf,
  purgeBlock,
  referenceDescription,
  referencesText,
  relatedEntries,
  videoNameOf,
} from './space-actions.ts';

const entry = (id: string, patch: Partial<SpaceEntry> = {}, user: Partial<SpaceEntry['user']> = {}): SpaceEntry => ({
  id,
  kind: 'video-file',
  name: `${id}.mp4`,
  fileName: `${id}.mp4`,
  source: { projectId: 'p1', conversationId: null },
  relPath: `${id}.mp4`,
  size: 1024,
  lastActivityAt: '2026-10-01T00:00:00.000Z',
  status: null,
  ...patch,
  user: { favorite: false, displayName: null, trashedAt: null, ...user },
});

const artifact = (id: string, patch: Partial<SpaceEntry> = {}) =>
  entry(id, { source: { projectId: null, conversationId: null }, ref: { artifactId: id }, ...patch });

describe('where re-editing goes', () => {
  it('videos open in the editor; items with a source video go back to the source video; exports and video media without a source create a new video', () => {
    expect(editRoute(entry('v', { kind: 'video' }))).toBe('video');
    expect(editRoute(entry('e', { kind: 'export', origin: { source: 'exported', videoId: 'vid1' } }))).toBe('source-video');
    expect(editRoute(entry('e', { kind: 'export' }))).toBe('new-video');
    expect(editRoute(entry('f'))).toBe('new-video');
    expect(editRoute(entry('s', { kind: 'subtitle' }))).toBe('text');
    expect(editRoute(entry('i', { kind: 'image' }))).toBe('version');
    expect(editRoute(entry('p', { kind: 'package' }))).toBeNull();
  });

  it('actions that cannot be done state the reason: status, editing not yet available, outputs without a path', () => {
    expect(editBlock(entry('v', { kind: 'video' }), null)).toBeNull();
    expect(editBlock(entry('f'), '/work/f.mp4')).toBeNull();
    expect(editBlock(entry('f'), null)).toMatch('不在项目或会话的目录里');
    expect(editBlock(artifact('a', { kind: 'export' }), null)).toMatch('不在项目或会话的目录里');
    expect(editBlock(entry('f', {}, { trashedAt: '2026-10-01T00:00:00.000Z' }), '/work/f.mp4')).toMatch('先恢复');
    expect(editBlock(entry('f', { status: 'missing' }), '/work/f.mp4')).toMatch('找不到文件');
    expect(editBlock(entry('f', { status: 'generating' }), '/work/f.mp4')).toMatch('还在生成');
    expect(editBlock(entry('s', { kind: 'subtitle' }), '/work/s.srt')).toMatch('在会话中继续');
    expect(editBlock(entry('i', { kind: 'image' }), '/work/i.png')).toMatch('还没有开放');
    expect(editBlock(entry('e', { kind: 'export', origin: { source: 'exported', videoId: 'vid1' } }), null)).toBeNull();
  });
});

describe('continue and delete', () => {
  it('items in the trash must be restored before they can be brought into a session', () => {
    expect(continueBlock(entry('a'))).toBeNull();
    expect(continueBlock(entry('a', {}, { trashedAt: '2026-10-01T00:00:00.000Z' }))).toMatch('先恢复');
  });

  it('permanent delete is only offered for trashed items; failed placeholders are cleared directly; items being generated are canceled first', () => {
    expect(purgeBlock(entry('a'))).toMatch('先移入回收站');
    expect(purgeBlock(entry('a', {}, { trashedAt: '2026-10-01T00:00:00.000Z' }))).toBeNull();
    const failed = entry('j1', { status: 'failed', ref: { jobId: 'j1' }, source: { projectId: null, conversationId: null } });
    expect(isFailedPlaceholder(failed)).toBe(true);
    expect(purgeBlock(failed)).toBeNull();
    expect(purgeBlock(entry('j2', { status: 'generating', ref: { jobId: 'j2' } }))).toMatch('先在任务页取消');
  });

  it('deleting a video lists the entries it exported or generated (excluding the video itself and items in the trash)', () => {
    const rows = [
      entry('v', { kind: 'video', ref: { videoId: 'vid1' } }),
      artifact('x', { kind: 'export', origin: { source: 'exported', videoId: 'vid1' } }),
      artifact('y', { kind: 'image', origin: { source: 'generated', videoId: 'vid1' } }),
      artifact('z', { kind: 'image', origin: { source: 'generated', videoId: 'vid2' } }),
    ];
    rows.push(entry('t', { origin: { source: 'generated', videoId: 'vid1' } }, { trashedAt: '2026-10-01T00:00:00.000Z' }));
    expect(relatedEntries(rows, 'vid1').map((e) => e.id)).toEqual(['x', 'y']);
  });

  it('task and source session: placeholders look at their own task, outputs look at origin', () => {
    expect(entryJobId(entry('j', { ref: { jobId: 'j' } }))).toBe('j');
    expect(entryJobId(artifact('a', { origin: { source: 'generated', jobId: 'job9' } }))).toBe('job9');
    expect(entryJobId(entry('f'))).toBeNull();
    expect(entryConversationId(entry('c', { source: { projectId: null, conversationId: 'c1' } }))).toBe('c1');
    expect(entryConversationId(artifact('a', { origin: { source: 'generated', conversationId: 'c2' } }))).toBe('c2');
  });
});

describe('import results', () => {
  it('states how many were copied into imports/ and how many were not imported', () => {
    expect(importSummary([{ ok: true, copied: true }])).toEqual({ text: '已导入 1 个素材 · 复制进了项目的 imports/', tone: 'positive' });
    expect(importSummary([{ ok: true, copied: false }, { ok: true, copied: true }, { ok: false, error: '认不出' }])).toEqual({
      text: '已导入 2 个素材 · 1 个复制进了项目的 imports/ · 1 个没有导入',
      tone: 'neutral',
    });
    expect(importSummary([{ ok: false, error: '文件不存在' }])).toEqual({ text: '没有导入：文件不存在', tone: 'negative' });
  });
});

describe('creating a video from a file', () => {
  it('only video, audio, and images can be placed on the timeline', () => {
    expect(placeKindOf('a.MOV')).toBe('video');
    expect(placeKindOf('b.wav')).toBe('audio');
    expect(placeKindOf('c.png')).toBe('image');
    expect(placeKindOf('d.srt')).toBeNull();
    expect(placeKindOf('noext')).toBeNull();
  });

  it('the video name is the file name without its extension', () => {
    expect(videoNameOf('/Users/me/Movies/采访 01.mp4')).toBe('采访 01');
    expect(videoNameOf('C:\\clips\\b-roll.mov')).toBe('b-roll');
    expect(videoNameOf('/x/.hidden')).toBe('.hidden');
    expect(videoNameOf('/x/plain')).toBe('plain');
  });
});

describe('entries attached to a message', () => {
  it('at most two names are written', () => {
    expect(referencesText([{ name: '成片' }])).toBe('资料库条目 「成片」');
    expect(referencesText([{ name: 'a' }, { name: 'b' }])).toBe('资料库条目 「a」「b」');
    expect(referencesText([{ name: 'a' }, { name: 'b' }, { name: 'c' }])).toBe('资料库条目 「a」「b」等 3 个');
  });

  it('the description states the type and location', () => {
    expect(referenceDescription({ kind: 'image', relPath: 'imports/封面.png' })).toBe('图片 · imports/封面.png');
    expect(referenceDescription({ kind: 'audio', relPath: null })).toBe('音频 · 产物');
  });
});

describe('opening a portable pack creates a new video', () => {
  const pkg = (patch: Partial<SpaceEntry> = {}, user: Partial<SpaceEntry['user']> = {}) =>
    entry('p', { kind: 'package', name: 'p.cuccut', fileName: 'p.cuccut', relPath: 'exports/p.cuccut', ...patch }, user);

  it('packs in a project or session folder can be opened; the new video is created in the pack\'s folder', () => {
    expect(packageBlock(pkg(), '/work/exports/p.cuccut')).toBeNull();
    expect(packageScope(pkg())).toEqual({ projectId: 'p1' });
    expect(packageScope(pkg({ source: { projectId: null, conversationId: 'c1' } }))).toEqual({ conversationId: 'c1' });
  });

  it('packs in the trash, being exported, missing, failed, or outside the source folder cannot be opened, and the reason is stated', () => {
    expect(packageBlock(pkg({}, { trashedAt: '2026-10-01T00:00:00.000Z' }), '/work/p.cuccut')).toMatch('先恢复');
    expect(packageBlock(pkg({ status: 'generating' }), '/work/p.cuccut')).toMatch('还在导出');
    expect(packageBlock(pkg({ status: 'missing' }), '/work/p.cuccut')).toMatch('找不到');
    expect(packageBlock(pkg({ status: 'failed' }), '/work/p.cuccut')).toMatch('导出失败');
    expect(packageBlock(pkg(), null)).toMatch('不在项目或会话的目录里');
    expect(packageBlock(pkg({ source: { projectId: null, conversationId: null } }), '/a/p.cuccut')).toMatch('不在项目或会话的目录里');
    expect(packageScope(pkg({ source: { projectId: null, conversationId: null } }))).toBeNull();
  });
});

describe('list and card collections depend on keys', () => {
  const entries = [entry('a', { kind: 'video' }), entry('b')];
  const reveal = () => true;

  it('with the same entries array, the key changes when the transcription action arrives (null → redo), so the menu re-renders with \'Re-transcribe…\'', () => {
    const before = entryMenuKey(entries, reveal, () => null);
    const after = entryMenuKey(entries, reveal, (e) => (e.kind === 'video' ? 'redo' : null));
    expect(after).not.toBe(before);
    expect(entryMenuKey(entries, reveal, (e) => (e.kind === 'video' ? 'redo' : null))).toBe(after);
  });

  it('the key changes when \'show in folder\' availability or the source column changes; the key stays the same when results are unchanged (the cache is not invalidated on every render)', () => {
    const none = () => null;
    const base = entryMenuKey(entries, reveal, none, () => '项目一');
    expect(
      entryMenuKey(
        entries,
        () => false,
        none,
        () => '项目一',
      ),
    ).not.toBe(base);
    expect(entryMenuKey(entries, reveal, none, () => '项目二')).not.toBe(base);
    expect(entryMenuKey([...entries], reveal, none, () => '项目一')).toBe(base);
  });
});
