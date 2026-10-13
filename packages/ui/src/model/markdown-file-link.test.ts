import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import type { SpaceEntry } from '@cuccut/protocol';
import { markdownFileOutsideScope, markdownFilePath, markdownFileTarget, markdownOpenAction } from './markdown-file-link.ts';

describe('Markdown artifact path', () => {
  it.each([
    ['/Users/me/Downloads/春日慢慢玩-2010-04-03.mp4', '/Users/me/Downloads/春日慢慢玩-2010-04-03.mp4'],
    ['./out/clip%20one.mp4', './out/clip one.mp4'],
    ['clip.mp4', 'clip.mp4'],
    ['README', 'README'],
    ['说明.abc', '说明.abc'],
    ['../out/report.pdf', '../out/report.pdf'],
    ['file:///Users/me/%E6%88%90%E7%89%87.mp4', '/Users/me/成片.mp4'],
    ['file://localhost/C:/Exports/clip%20one.mp4', 'C:/Exports/clip one.mp4'],
    ['C:\\Exports\\clip.mp4', 'C:\\Exports\\clip.mp4'],
    ['src/main.ts:12:3', 'src/main.ts'],
    ['notes.md#chapter', 'notes.md'],
  ])('%s keeps the file-locating meaning', (href, expected) => {
    expect(markdownFilePath(href)).toBe(expected);
  });

  it.each(['', '#chapter', '?page=2', 'https://example.com/clip.mp4', '//example.com/clip.mp4',
    'mailto:me@example.com', 'javascript:alert(1)', 'data:text/plain,test.txt', 'file://server/share/clip.mp4',
    '/settings/models/image', '/settings', '/out/bad%ZZ.mp4', '/out/bad%00.mp4'])('does not treat %s as a local file', (href) => {
    expect(markdownFilePath(href)).toBeNull();
  });

  it('Chinese and space paths encoded in Markdown are still recognized; file URL is kept only on the link', () => {
    const paths: string[] = [];
    const html = renderToStaticMarkup(createElement(Markdown, {
      urlTransform: (url, key) => key === 'href' && markdownFilePath(url) ? url : defaultUrlTransform(url),
      components: { a: ({ href, children }) => {
        paths.push(markdownFilePath(href!)!);
        return createElement('span', null, children);
      } },
      children: '[下载 Vlog 成片](</Users/me/Downloads/春日 慢慢玩.mp4>) [文件](file:///tmp/clip.mp4) ![图片](file:///tmp/image.png)',
    }));
    expect(paths).toEqual(['/Users/me/Downloads/春日 慢慢玩.mp4', '/tmp/clip.mp4']);
    expect(html).not.toContain('file:');
  });
});

describe('artifact link target', () => {
  it('unregistered copies outside the directory go to the system app; files inside the directory still open on the right', () => {
    expect(markdownFileOutsideScope('/Downloads/成片.mp4', '/scratch/c1')).toBe(true);
    expect(markdownFileOutsideScope('../c10/成片.mp4', '/scratch/c1')).toBe(true);
    expect(markdownFileOutsideScope('./exports/成片.mp4', '/scratch/c1')).toBe(false);
    expect(markdownFileOutsideScope('C:\\work\\clip.mp4', 'C:\\work')).toBe(false);
  });
  const scope = { conversationId: 'c1', cwd: '/scratch/c1' };
  const dirs = { projects: [{ id: 'p1', name: '', path: '/projects/one' }], conversations: [{ id: 'c1', title: '', cwd: scope.cwd }] };
  const exported: SpaceEntry = {
    id: 'export1', kind: 'export', name: '成片', fileName: '成片.mp4', relPath: '成片.mp4',
    source: { projectId: null, conversationId: null }, file: { path: '/Downloads/成片.mp4' },
    size: 100, lastActivityAt: '', status: null,
    user: { favorite: false, displayName: null, trashedAt: null },
  };
  it('a finished video outside the working directory uses its registered entry, avoiding the session directory\'s forbidden', () => {
    expect(markdownFileTarget('/Downloads/成片.mp4', scope, [exported], dirs)).toEqual({ entryId: 'export1' });
    expect(markdownFileTarget('../../Downloads/成片.mp4', scope, [exported], dirs)).toEqual({ entryId: 'export1' });
  });
  it('project and session files both match; does not guess by file name alone', () => {
    const entry = { ...exported, source: { projectId: null, conversationId: 'c1' } };
    expect(markdownFileTarget('./成片.mp4', scope, [entry], dirs)).toEqual({ entryId: 'export1' });
    expect(markdownFileTarget('/projects/one/成片.mp4', scope, [{ ...entry, source: { projectId: 'p1', conversationId: null } }], dirs)).toEqual({ entryId: 'export1' });
    expect(markdownFileTarget('成片.mp4', scope, [exported], dirs)).toEqual({ conversationId: 'c1', path: '成片.mp4' });
  });
  it('unregistered and deleted files still go to the Runtime for permission checks; the media channel is not relaxed', () => {
    expect(markdownFileTarget('/Downloads/成片.mp4', scope, [{ ...exported, user: { ...exported.user, trashedAt: 'now' } }], dirs))
      .toEqual({ conversationId: 'c1', path: '/Downloads/成片.mp4' });
  });
  it('Windows file URLs and disk paths use the same matching', () => {
    const file = { ...exported, file: { path: 'C:\\Exports\\成片.mp4' } };
    expect(markdownFileTarget(markdownFilePath('file:///C:/Exports/%E6%88%90%E7%89%87.mp4')!, scope, [file], dirs)).toEqual({ entryId: 'export1' });
  });

  describe('how it opens after clicking', () => {
    const desktop = { desktop: true };
    const web = { desktop: false };
    it('registered deliverables (including those in the downloads directory) open by entry in a file tab, same on desktop and browser', () => {
      const delivered = { ...exported, id: 'sha256:md', kind: 'document' as const, fileName: 'talk.blog.zh-CN.md', file: { path: '/Volumes/SSD/Downie/talk.blog.zh-CN.md' } };
      for (const host of [desktop, web]) {
        expect(markdownOpenAction('/Volumes/SSD/Downie/talk.blog.zh-CN.md', scope, [delivered], dirs, host))
          .toEqual({ kind: 'pane', target: { entryId: 'sha256:md' } });
      }
    });
    it('files in the working directory open by session path, regardless of host', () => {
      for (const host of [desktop, web]) {
        expect(markdownOpenAction('./out/notes.md', scope, [], dirs, host)).toEqual({ kind: 'pane', target: { conversationId: 'c1', path: './out/notes.md' } });
      }
    });
    it('desktop: documents and media outside the working directory without an entry preview in a file tab by local path; relative paths are completed to absolute paths', () => {
      expect(markdownOpenAction('/Volumes/SSD/Downie/talk.blog.zh-CN.md', scope, [], dirs, desktop))
        .toEqual({ kind: 'pane', target: { localPath: '/Volumes/SSD/Downie/talk.blog.zh-CN.md' } });
      expect(markdownOpenAction('../c2/clip.mp4', scope, [], dirs, desktop)).toEqual({ kind: 'pane', target: { localPath: '/scratch/c2/clip.mp4' } });
      expect(markdownOpenAction('C:\\Exports\\成片.mp4', { conversationId: 'c1', cwd: 'C:\\work' }, [], dirs, desktop))
        .toEqual({ kind: 'pane', target: { localPath: 'C:\\Exports\\成片.mp4' } });
      // Entries in the trash do not count as registered: they are likewise previewed read-only by local path.
      expect(markdownOpenAction('/Downloads/成片.mp4', scope, [{ ...exported, user: { ...exported.user, trashedAt: 'now' } }], dirs, desktop))
        .toEqual({ kind: 'pane', target: { localPath: '/Downloads/成片.mp4' } });
    });
    it('desktop: only types the viewer does not support go to the system default app', () => {
      expect(markdownOpenAction('/Downloads/raw.mkv', scope, [], dirs, desktop)).toEqual({ kind: 'system', path: '/Downloads/raw.mkv' });
      expect(markdownOpenAction('/Downloads/slides.key', scope, [], dirs, desktop)).toEqual({ kind: 'system', path: '/Downloads/slides.key' });
    });
    it('browser: outside the working directory still requests by session path, the Runtime reports it unavailable, no local path is sent', () => {
      expect(markdownOpenAction('/Volumes/SSD/Downie/talk.blog.zh-CN.md', scope, [], dirs, web))
        .toEqual({ kind: 'pane', target: { conversationId: 'c1', path: '/Volumes/SSD/Downie/talk.blog.zh-CN.md' } });
      expect(markdownOpenAction('/Downloads/raw.mkv', scope, [], dirs, web)).toEqual({ kind: 'pane', target: { conversationId: 'c1', path: '/Downloads/raw.mkv' } });
    });
  });

  describe('images in reply body (ThreadMediaPreview gets its handle using the same check)', () => {
    const desktop = { desktop: true };
    const web = { desktop: false };
    const image = (src: string, host: { desktop: boolean }, entries: SpaceEntry[] = []) => markdownOpenAction(markdownFilePath(src)!, scope, entries, dirs, host);
    it('desktop: images outside the working directory without an entry get a handle by local path; file URL and relative path work the same', () => {
      expect(image('/Volumes/SSD/shots/cover%20one.png', desktop)).toEqual({ kind: 'pane', target: { localPath: '/Volumes/SSD/shots/cover one.png' } });
      expect(image('file:///Volumes/SSD/shots/cover.webp', desktop)).toEqual({ kind: 'pane', target: { localPath: '/Volumes/SSD/shots/cover.webp' } });
      expect(image('../c2/frame.jpg', desktop)).toEqual({ kind: 'pane', target: { localPath: '/scratch/c2/frame.jpg' } });
    });
    it('browser: images outside the working directory still request by session path; the Runtime reports them unavailable', () => {
      expect(image('/Volumes/SSD/shots/cover.png', web)).toEqual({ kind: 'pane', target: { conversationId: 'c1', path: '/Volumes/SSD/shots/cover.png' } });
    });
    it('images in the working directory and registered images work the same on desktop and browser', () => {
      const shot = { ...exported, id: 'img1', kind: 'image' as const, fileName: 'cover.png', file: { path: '/Volumes/SSD/shots/cover.png' } };
      for (const host of [desktop, web]) {
        expect(image('./out/frame.png', host)).toEqual({ kind: 'pane', target: { conversationId: 'c1', path: './out/frame.png' } });
        expect(image('/Volumes/SSD/shots/cover.png', host, [shot])).toEqual({ kind: 'pane', target: { entryId: 'img1' } });
      }
    });
  });
});
