import { describe, expect, it } from 'vitest';
import type { ProjectFileEntry } from '@cuccut/protocol';
import { breadcrumbs, entryAction, entryFolder, entryMeta, parentDir, projectFileTarget } from './project-files.ts';

const entry = (over: Partial<ProjectFileEntry>): ProjectFileEntry => ({
  path: 'a.mp4',
  name: 'a.mp4',
  isDir: false,
  size: null,
  modifiedAt: null,
  kind: null,
  ...over,
});

describe('project file browsing', () => {
  it('breadcrumb and parent folder', () => {
    expect(breadcrumbs('', '我的项目')).toEqual([{ label: '我的项目', dir: '' }]);
    expect(breadcrumbs('a/b', '我的项目')).toEqual([
      { label: '我的项目', dir: '' },
      { label: 'a', dir: 'a' },
      { label: 'b', dir: 'a/b' },
    ]);
    expect(parentDir('')).toBeNull();
    expect(parentDir('a')).toBe('');
    expect(parentDir('a/b')).toBe('a');
  });

  it('current folder', () => {
    expect(entryFolder('a.mp4')).toBe('');
    expect(entryFolder('scenes/day 1/a.mp4')).toBe('scenes/day 1');
  });

  it('each row\'s description: type · size · time', () => {
    const now = Date.parse('2026-10-03T12:00:00Z');
    expect(entryMeta(entry({ kind: 'video-file', size: 2048, modifiedAt: '2026-10-03T11:55:00Z' }), now)).toBe('视频素材 · 2.0 KB · 5 分钟前');
    expect(entryMeta(entry({ isDir: true }), now)).toBe('文件夹');
    expect(entryMeta(entry({ isDir: true, kind: 'video' }), now)).toBe('视频');
    expect(entryMeta(entry({ size: 10 }), now)).toBe('文件 · 10 B');
  });

  it('open: video folders go to the video tab, slide, design and design-system folders go to their own tabs, plain folders are entered, everything else is a file; the location is the relative path within the session', () => {
    expect(entryAction({ isDir: true, kind: 'video' })).toBe('video');
    expect(entryAction({ isDir: true, kind: 'slides' })).toBe('slides');
    expect(entryAction({ isDir: true, kind: 'design' })).toBe('design');
    expect(entryAction({ isDir: true, kind: 'design-system' })).toBe('design-system');
    expect(entryAction({ isDir: true, kind: null })).toBe('enter');
    expect(entryAction({ isDir: false, kind: 'image' })).toBe('file');
    expect(projectFileTarget('conv_1', { path: 'scenes/a.mp4' })).toEqual({ conversationId: 'conv_1', path: 'scenes/a.mp4' });
  });
});
