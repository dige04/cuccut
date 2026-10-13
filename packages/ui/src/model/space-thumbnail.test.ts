import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { NO_THUMBNAIL, thumbnailVersion, toThumbnail, wantsThumbnail } from './space-thumbnail.ts';

const entry = (patch: Partial<SpaceEntry> = {}): SpaceEntry => ({
  id: 'e1',
  kind: 'video-file',
  name: 'a.mp4',
  fileName: 'a.mp4',
  source: { projectId: 'p1', conversationId: null },
  relPath: 'a.mp4',
  size: 1024,
  lastActivityAt: '2026-10-01T00:00:00.000Z',
  status: null,
  user: { favorite: false, displayName: null, trashedAt: null },
  ...patch,
});

describe('thumbnail: whether to fetch', () => {
  it('only fetched for types with a picture or body text; audio, packs, and templates are not queried', () => {
    for (const kind of ['video', 'export', 'video-file', 'image', 'document', 'subtitle'] as const) {
      expect(wantsThumbnail(entry({ kind }))).toBe(true);
    }
    for (const kind of ['audio', 'package', 'template'] as const) expect(wantsThumbnail(entry({ kind }))).toBe(false);
  });

  it('missing, generating, and failed items are not fetched (the Runtime answers none for all); items whose source changed or that are in the trash are still fetched', () => {
    expect(wantsThumbnail(entry({ status: 'missing' }))).toBe(false);
    expect(wantsThumbnail(entry({ status: 'generating' }))).toBe(false);
    expect(wantsThumbnail(entry({ status: 'failed' }))).toBe(false);
    expect(wantsThumbnail(entry({ status: 'source-changed' }))).toBe(true);
    expect(
      wantsThumbnail(
        entry({
          user: {
            favorite: false,
            displayName: null,
            trashedAt: '2026-10-02T00:00:00.000Z',
          },
        }),
      ),
    ).toBe(true);
  });
});

describe('thumbnail: version', () => {
  it('the version changes only when last activity, size, status, the linked video, or the path changes; renaming and favoriting do not change it', () => {
    const base = entry({ kind: 'video', ref: { videoId: 'v1' } });
    const v = thumbnailVersion(base);
    expect(
      thumbnailVersion({
        ...base,
        name: '新名字',
        user: { ...base.user, favorite: true, displayName: '新名字' },
      }),
    ).toBe(v);
    expect(thumbnailVersion({ ...base, lastActivityAt: '2026-10-02T00:00:00.000Z' })).not.toBe(v);
    expect(thumbnailVersion({ ...base, size: 2048 })).not.toBe(v);
    expect(thumbnailVersion({ ...base, status: 'missing' })).not.toBe(v);
    expect(thumbnailVersion({ ...base, ref: { videoId: 'v2' } })).not.toBe(v);
    expect(thumbnailVersion({ ...base, relPath: 'b/a.mp4' })).not.toBe(v);
  });
});

describe('thumbnail: Runtime response', () => {
  it('the picture is assembled into a data URL, the summary is kept as is, and an empty summary or none draws a placeholder', () => {
    expect(
      toThumbnail({
        kind: 'image',
        mimeType: 'image/png',
        data: 'AAA=',
        width: 320,
        height: 180,
      }),
    ).toEqual({
      kind: 'image',
      url: 'data:image/png;base64,AAA=',
      width: 320,
      height: 180,
    });
    expect(toThumbnail({ kind: 'text', excerpt: '第一行\n第二行' })).toEqual({
      kind: 'text',
      excerpt: '第一行\n第二行',
    });
    expect(toThumbnail({ kind: 'text', excerpt: '' })).toBe(NO_THUMBNAIL);
    expect(toThumbnail({ kind: 'none' })).toBe(NO_THUMBNAIL);
  });
});
