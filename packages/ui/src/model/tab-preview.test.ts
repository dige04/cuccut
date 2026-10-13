import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { TAB_PREVIEW_DELAY_MS, tabPreviewPosition, tabPreviewSubtitle } from './tab-preview.ts';

describe('页签悬停缩略卡', () => {
  it('页签停留 500 ms 出缩略卡', () => {
    expect(TAB_PREVIEW_DELAY_MS).toBe(500);
  });

  it('左缘对齐页签并夹在视口里，顶在页签下方 8', () => {
    expect(tabPreviewPosition({ left: 300, bottom: 80 }, 1280)).toEqual({ left: 300, top: 88 });
    expect(tabPreviewPosition({ left: 2, bottom: 80 }, 1280)).toEqual({ left: 8, top: 88 });
    expect(tabPreviewPosition({ left: 1200, bottom: 80 }, 1280)).toEqual({ left: 992, top: 88 });
  });

  const words = { title: '标题', conversation: '会话', newTab: '新标签页', entries: [] as SpaceEntry[] };

  it('副标题：网页写地址或新标签页，会话写「会话」', () => {
    expect(tabPreviewSubtitle('conversation', words)).toBe('会话');
    expect(tabPreviewSubtitle({ kind: 'web', id: 'w', url: 'https://example.com/a' }, words)).toBe('https://example.com/a');
    expect(tabPreviewSubtitle({ kind: 'web', id: 'w', url: '' }, words)).toBe('新标签页');
  });

  it('副标题：文件与视频写项目内路径，按条目打开的用条目的相对路径，找不到用标题', () => {
    expect(tabPreviewSubtitle({ kind: 'file', target: { projectId: 'p', path: 'docs/a.md' } }, words)).toBe('docs/a.md');
    expect(tabPreviewSubtitle({ kind: 'video', target: { conversationId: 'c', path: 'out/v.mp4' } }, words)).toBe('out/v.mp4');
    const entries = [{ id: 'e1', relPath: 'media/clip.mp4' } as SpaceEntry];
    expect(tabPreviewSubtitle({ kind: 'video', target: { entryId: 'e1' } }, { ...words, entries })).toBe('media/clip.mp4');
    expect(tabPreviewSubtitle({ kind: 'video', target: { entryId: 'missing' } }, words)).toBe('标题');
    expect(tabPreviewSubtitle({ kind: 'files' }, words)).toBe('标题');
  });
});
