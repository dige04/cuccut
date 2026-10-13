import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { relativeImagePath, siblingMediaTarget } from './document-image.ts';

const dirs = { projects: [{ id: 'p1', name: '', path: '/projects/one' }], conversations: [{ id: 'c1', title: '', cwd: '/scratch/c1' }] };
const entry = (over: Partial<SpaceEntry>): SpaceEntry => ({
  id: 'e1', kind: 'document', name: 'post.md', fileName: 'post.md', relPath: 'post.md',
  source: { projectId: null, conversationId: null }, size: 1, lastActivityAt: '', status: null,
  user: { favorite: false, displayName: null, trashedAt: null }, ...over,
});

describe('relative images in a Markdown article', () => {
  it.each([
    ['talk.blog.at-12500ms.png', 'talk.blog.at-12500ms.png'],
    ['./img/a%20b.png', 'img/a b.png'],
    ['../shared/c.png?x=1#y', '../shared/c.png'],
  ])('%s is a relative path', (src, expected) => {
    expect(relativeImagePath(src)).toBe(expected);
  });

  it.each(['https://example.com/a.png', '//example.com/a.png', 'data:image/png;base64,AAAA', 'file:///tmp/a.png', '/etc/a.png',
    'C:\\img\\a.png', '\\\\server\\share\\a.png', '', 'bad%ZZ.png'])('does not treat %s as a relative path', (src) => {
    expect(relativeImagePath(src)).toBeNull();
  });

  const context = (entries: SpaceEntry[] = [], desktop = true) => ({ entries, dirs, desktop });

  it('session, project and local article: adjacent paths under the same locator', () => {
    expect(siblingMediaTarget({ conversationId: 'c1', path: 'out/post.md' }, 'a.png', context())).toEqual({ conversationId: 'c1', path: 'out/a.png' });
    expect(siblingMediaTarget({ projectId: 'p1', path: 'post.md' }, './img/a.png', context())).toEqual({ projectId: 'p1', path: 'img/a.png' });
    expect(siblingMediaTarget({ localPath: '/Volumes/SSD/Downie/talk.blog.zh-CN.md' }, 'talk.blog.at-12500ms.png', context()))
      .toEqual({ localPath: '/Volumes/SSD/Downie/talk.blog.at-12500ms.png' });
    expect(siblingMediaTarget({ localPath: 'D:\\Downie\\talk.md' }, 'img/a.png', context())).toEqual({ localPath: 'D:\\Downie\\img\\a.png' });
    expect(siblingMediaTarget({ videoId: 'v', assetId: 'a' }, 'a.png', context())).toBeNull();
    expect(siblingMediaTarget({ conversationId: 'c1', attachmentId: 'att' }, 'a.png', context())).toBeNull();
  });

  it('Space item: joined from the source directory; outside the source directory, first look for registered adjacent items, then on desktop fall back to the local path, which the browser cannot fetch', () => {
    const inProject = entry({ source: { projectId: 'p1', conversationId: null }, relPath: 'notes/post.md' });
    expect(siblingMediaTarget({ entryId: 'e1' }, 'a.png', context([inProject]))).toEqual({ projectId: 'p1', path: 'notes/a.png' });
    const inConversation = entry({ source: { projectId: null, conversationId: 'c1' } });
    expect(siblingMediaTarget({ entryId: 'e1' }, 'a.png', context([inConversation]))).toEqual({ conversationId: 'c1', path: 'a.png' });

    const delivered = entry({ file: { path: '/Volumes/SSD/Downie/talk.md' } });
    const image = entry({ id: 'img', kind: 'image', fileName: 'a.png', relPath: 'a.png', file: { path: '/Volumes/SSD/Downie/a.png' } });
    expect(siblingMediaTarget({ entryId: 'e1' }, 'a.png', context([delivered, image], false))).toEqual({ entryId: 'img' });
    expect(siblingMediaTarget({ entryId: 'e1' }, 'b.png', context([delivered, image], true))).toEqual({ localPath: '/Volumes/SSD/Downie/b.png' });
    expect(siblingMediaTarget({ entryId: 'e1' }, 'b.png', context([delivered, image], false))).toBeNull();
    expect(siblingMediaTarget({ entryId: 'missing' }, 'b.png', context([delivered]))).toBeNull();
  });
});
