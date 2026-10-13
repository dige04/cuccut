import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import {
  SPACE_SORTS,
  countByCategory,
  derivedCount,
  derivedFrom,
  entryPath,
  filesAttention,
  filesOf,
  filesSummary,
  formatBytes,
  fromVideoId,
  groupEntries,
  hitsText,
  hostVideoOf,
  inCategory,
  measureText,
  parentVideoOf,
  previewKind,
  projectOptions,
  recentVideos,
  sourceLabel,
  statusText,
  videoNamesOf,
  viewEntries,
  visibleCategories,
} from './space.ts';

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

const dirs = { projects: [{ id: 'p1', name: '宣传片', path: '/work/promo/' }], conversations: [{ id: 'c1', title: '', cwd: '/tmp/c1' }] };

describe('categories', () => {
  it('the trash only contains items moved into it; other categories exclude trashed items', () => {
    const trashed = entry('a', {}, { trashedAt: '2026-10-01T00:00:00.000Z', favorite: true });
    expect(inCategory(trashed, 'trash')).toBe(true);
    expect(inCategory(trashed, 'all')).toBe(false);
    expect(inCategory(trashed, 'favorite')).toBe(false);
    expect(inCategory(trashed, 'video-file')).toBe(false);
  });

  it('counts and sidebar: only types with entries appear; All, Favorites, and Trash always appear', () => {
    const counts = countByCategory([entry('a'), entry('b', { kind: 'image' }, { favorite: true })]);
    expect(counts.all).toBe(2);
    expect(counts['video-file']).toBe(1);
    expect(counts.favorite).toBe(1);
    expect(counts.audio).toBe(0);
    expect(visibleCategories(counts).map((c) => c.key)).toEqual(['all', 'video-file', 'image', 'favorite', 'trash']);
  });

  it('design systems are their own category, placed after designs and before templates', () => {
    const counts = countByCategory([
      entry('t', { kind: 'template' }),
      entry('s', { kind: 'design-system', name: '品牌设计系统' }),
      entry('d', { kind: 'design', canvas: { boardCount: 2 } }),
    ]);
    expect(counts['design-system']).toBe(1);
    expect(visibleCategories(counts).map((c) => c.key)).toEqual(['all', 'design', 'design-system', 'template', 'favorite', 'trash']);
    expect(visibleCategories(counts).find((c) => c.key === 'design-system')?.label).toBe('设计系统');
    expect(inCategory(entry('s', { kind: 'design-system' }), 'design-system')).toBe(true);
  });
});

describe('viewEntries', () => {
  const rows = [
    entry('b', { lastActivityAt: '2026-10-01T02:00:00.000Z', kind: 'image', name: '乙.png' }),
    entry('a', { lastActivityAt: '2026-10-01T01:00:00.000Z', name: '甲.mp4', relPath: 'clips/甲.mp4' }),
    entry('c', { source: { projectId: null, conversationId: 'c1' }, lastActivityAt: '2026-10-01T03:00:00.000Z' }),
  ];
  const query = { category: 'all' as const, projectId: null, search: '', sort: 'recent' as const };

  it('sorted by recent activity by default', () => {
    expect(viewEntries(rows, query).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('created and updated times each sort descending; equal times keep their order; unknown and invalid times go last', () => {
    const dated = [
      entry('old', { createdAt: '2026-10-01T01:00:00Z', updatedAt: '2026-10-01T04:00:00Z' }),
      entry('new', { createdAt: '2026-10-01T03:00:00+00:00', updatedAt: '2026-10-01T02:00:00Z' }),
      entry('tie', { createdAt: '2026-10-01T03:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z' }),
      entry('legacy'),
      entry('unknown', { createdAt: null, updatedAt: null }),
      entry('invalid', { createdAt: 'invalid', updatedAt: '' }),
    ];
    expect(viewEntries(dated, { ...query, sort: 'created' }).map((e) => e.id)).toEqual(['new', 'tie', 'old', 'legacy', 'unknown', 'invalid']);
    expect(viewEntries(dated, { ...query, sort: 'updated' }).map((e) => e.id)).toEqual(['old', 'new', 'tie', 'legacy', 'unknown', 'invalid']);
    expect(viewEntries(dated, { ...query, sort: 'created', search: 'old' }).map((e) => e.id)).toEqual(['old']);
    expect(SPACE_SORTS.map((s) => s.key)).toEqual(['recent', 'created', 'updated', 'name', 'kind']);
  });

  it('filter by project; none means not in any project', () => {
    expect(viewEntries(rows, { ...query, projectId: 'p1' }).map((e) => e.id)).toEqual(['b', 'a']);
    expect(viewEntries(rows, { ...query, projectId: 'none' }).map((e) => e.id)).toEqual(['c']);
  });

  it('filter by source: keeps only videos derived from that video; trashed items are still not listed', () => {
    const origin = { source: 'derived' as const, projectId: 'p1', videoId: 'v_parent', videoRevision: '7', capability: 'videos-derive' };
    const family = [
      entry('parent', { kind: 'video', ref: { videoId: 'v_parent' } }),
      entry('s1', { kind: 'video', ref: { videoId: 'v_s1' }, origin }),
      entry('s2', { kind: 'video', ref: { videoId: 'v_s2' }, origin }, { trashedAt: '2026-10-01T00:00:00.000Z' }),
      entry('other', { kind: 'video', ref: { videoId: 'v_other' }, origin: { ...origin, videoId: 'v_else' } }),
    ];
    expect(viewEntries(family, { ...query, from: 'v_parent' }).map((e) => e.id)).toEqual(['s1']);
    expect(viewEntries(family, { ...query, category: 'trash', from: 'v_parent' }).map((e) => e.id)).toEqual(['s2']);
    expect(viewEntries(family, { ...query, from: null }).length).toBe(3);
  });

  it('search names and paths; when sorting by type, video types come first', () => {
    expect(viewEntries(rows, { ...query, search: 'CLIPS' }).map((e) => e.id)).toEqual(['a']);
    expect(viewEntries(rows, { ...query, sort: 'kind' }).map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('project options list only projects that appear; an extra option is added at the end when there are entries from temporary sessions', () => {
    expect(
      projectOptions(rows, [
        { id: 'p1', name: '宣传片' },
        { id: 'p2', name: '没用到' },
      ]),
    ).toEqual([
      { key: 'p1', label: '宣传片' },
      { key: 'none', label: '不属于任何项目' },
    ]);
  });
});

describe('a video appears only once', () => {
  const query = { category: 'all' as const, projectId: null, search: '', sort: 'recent' as const };
  const at = (h: number) => `2026-10-01T${String(h).padStart(2, '0')}:00:00.000Z`;
  const from = (videoId: string) => ({ source: 'exported' as const, projectId: 'p1', videoId });
  // The situation in the screenshot: a video whose transcript was downloaded, together with the downloaded source file, the exported finished cut, the subtitles and the script
  const video = entry('v', { kind: 'video', name: '洗碗机', ref: { videoId: 'vid1' }, lastActivityAt: at(1) });
  const files = [
    entry('mp4', { kind: 'video-file', name: '洗碗机.mp4', origin: { ...from('vid1'), source: 'imported' }, lastActivityAt: at(2) }),
    entry('final', { kind: 'export', name: '洗碗机 · 成片.mp4', origin: from('vid1'), lastActivityAt: at(3) }),
    entry('srt', { kind: 'subtitle', name: '英文字幕.srt', origin: from('vid1'), lastActivityAt: at(4) }),
    entry('md', { kind: 'document', name: 'transcript.md', origin: from('vid1'), lastActivityAt: at(5), status: 'source-changed' }),
  ];
  const other = entry('other', { kind: 'image', name: '海报.png', lastActivityAt: at(3) });
  const list = [video, ...files, other];

  it('in \'All\' and \'Video\', the video absorbs its files and the card count counts it as one; by type, each is still listed separately', () => {
    expect(viewEntries(list, query).map((e) => e.id)).toEqual(['v', 'other']);
    const [row] = viewEntries(list, query);
    expect(row!.files!.map((f) => f.id)).toEqual(['final', 'mp4', 'srt', 'md']);
    expect(row!.activityAt).toBe(at(5));
    expect(viewEntries(list, { ...query, category: 'export' }).map((e) => e.id)).toEqual(['final']);
    const counts = countByCategory(list);
    expect([counts.all, counts.video, counts.export, counts.subtitle, counts.document]).toEqual([2, 1, 1, 1, 1]);
  });

  it('recent activity sorts by the latest of the video and its files; updated time looks only at the video itself', () => {
    const late = entry('late', { kind: 'image', lastActivityAt: at(4) });
    expect(viewEntries([...list, late], query).map((e) => e.id)).toEqual(['v', 'late', 'other']);
  });

  it('search and status pass through files: when only a file matches, record which file it was; \'no status\' looks only at the video itself', () => {
    const [byFile] = viewEntries(list, { ...query, search: 'SRT' });
    expect([byFile!.id, byFile!.hits]).toEqual(['v', ['srt']]);
    expect(hitsText(byFile!)).toBe('找到 英文字幕.srt');
    expect(hitsText({ ...byFile!, hits: ['final', 'mp4'] })).toBe('找到 洗碗机 · 成片.mp4 等 2 个文件');
    const [self] = viewEntries(list, { ...query, search: '洗碗机' });
    expect([self!.id, self!.hits]).toEqual(['v', undefined]);
    expect(viewEntries(list, { ...query, status: 'source-changed' }).map((e) => [e.id, e.hits])).toEqual([['v', ['md']]]);
    expect(viewEntries(list, { ...query, status: 'none' }).map((e) => e.id)).toEqual(['v', 'other']);
  });

  it('card details and status: when the video has no status of its own, speak for the most visible file', () => {
    const [row] = groupEntries(list);
    expect(filesSummary(row!)).toBe('成片 1 · 视频素材 1 · 字幕 1 · 文档 1');
    expect(filesAttention(row!)).toEqual({ status: 'source-changed', text: '文档来源已变' });
    const busy = groupEntries([video, ...files.map((f) => ({ ...f, status: 'missing' as const })), { ...files[1]!, id: 'gen', status: 'generating' as const }]);
    expect(filesAttention(busy[0]!)).toEqual({ status: 'generating', text: '成片生成中' });
    expect(filesAttention(groupEntries([video, ...files.map((f) => ({ ...f, status: 'missing' as const }))])[0]!)!.text).toBe('4 个文件缺失');
    expect(filesAttention({ ...row!, status: 'missing' })).toBeNull();
  });

  it('templates and files in the trash are not included; when a video goes to the trash, its files each appear separately', () => {
    const template = entry('tpl', { kind: 'template', origin: from('vid1') });
    const trashedFile = entry('old', { kind: 'export', origin: from('vid1') }, { trashedAt: at(6) });
    expect(viewEntries([video, template, trashedFile], query).map((e) => e.id)).toEqual(['v', 'tpl']);
    const gone = { ...video, user: { ...video.user, trashedAt: at(6) } };
    expect(viewEntries([gone, ...files], query).map((e) => e.id)).toEqual(['md', 'srt', 'final', 'mp4']);
  });

  it('viewer: the video lists its files, and files return to their owning video; when the same videoId appears twice, it is grouped under the one listed first', () => {
    expect(filesOf(list, 'v').map((f) => f.id)).toEqual(['final', 'mp4', 'srt', 'md']);
    expect(filesOf(list, 'other')).toEqual([]);
    expect(hostVideoOf(list, files[2]!)?.id).toBe('v');
    expect(hostVideoOf(list, other)).toBeNull();
    const copy = entry('v2', { kind: 'video', ref: { videoId: 'vid1' } });
    expect(viewEntries([video, copy, ...files], query).map((e) => [e.id, e.files?.length])).toEqual([
      ['v', 4],
      ['v2', undefined],
    ]);
  });
});

describe('outputs outside the source folder (both source fields are null)', () => {
  const art = entry('art', {
    kind: 'image',
    source: { projectId: null, conversationId: null },
    relPath: 'cover.png',
    ref: { artifactId: 'art' },
    origin: { source: 'generated', projectId: 'p1', videoId: 'vid1', conversationId: 'c1' },
  });
  const loose = entry('loose', {
    source: { projectId: null, conversationId: null },
    origin: { source: 'generated', projectId: null, conversationId: 'c1' },
  });
  const query = { category: 'all' as const, projectId: null, search: '', sort: 'recent' as const };

  it('grouped into projects by origin.projectId: project filter and options both check both places', () => {
    expect(viewEntries([art, loose], { ...query, projectId: 'p1' }).map((e) => e.id)).toEqual(['art']);
    expect(viewEntries([art, loose], { ...query, projectId: 'none' }).map((e) => e.id)).toEqual(['loose']);
    expect(projectOptions([art], [{ id: 'p1', name: '宣传片' }])).toEqual([{ key: 'p1', label: '宣传片' }]);
  });

  it('source shows project · the video that produced it; without a project, shows the session that produced it', () => {
    const names = videoNamesOf([entry('v', { kind: 'video', name: '发布会', ref: { videoId: 'vid1' } })]);
    expect(sourceLabel(art, dirs, '新会话', names)).toBe('宣传片 · 发布会');
    expect(sourceLabel(art, dirs, '新会话')).toBe('宣传片');
    expect(sourceLabel(loose, dirs, '新会话')).toBe('会话「新会话」');
    expect(sourceLabel(entry('x', { source: { projectId: null, conversationId: null } }), dirs, '新会话')).toBe('不属于任何项目');
  });
});

describe('status and duration', () => {
  const query = { category: 'all' as const, projectId: null, search: '', sort: 'recent' as const };
  const rows = [entry('a', { status: 'candidate' }), entry('b'), entry('c', { status: 'missing' })];

  it('filter by status; none means no status', () => {
    expect(viewEntries(rows, { ...query, status: 'candidate' }).map((e) => e.id)).toEqual(['a']);
    expect(viewEntries(rows, { ...query, status: 'none' }).map((e) => e.id)).toEqual(['b']);
    expect(viewEntries(rows, { ...query, status: 'any' })).toHaveLength(3);
  });

  it('status text: generating shows progress', () => {
    expect(statusText({ status: null })).toBeNull();
    expect(statusText({ status: 'source-changed' })).toBe('来源已变');
    expect(statusText({ status: 'generating', statusDetail: { progress: { done: 1, total: 4 } } })).toBe('生成中 · 25%');
    expect(statusText({ status: 'generating', statusDetail: { progress: { done: 1, total: null } } })).toBe('生成中');
  });

  it('duration or size: video shows duration and frame, audio shows duration, images show dimensions, slides show page count; null when there is no media info', () => {
    expect(measureText({ kind: 'export', media: { durationSec: 65, width: 1920, height: 1080 } })).toBe('1:05 · 1920×1080');
    expect(measureText({ kind: 'audio', media: { durationSec: 3, width: 1, height: 1 } })).toBe('0:03');
    expect(measureText({ kind: 'image', media: { width: 640, height: 480 } })).toBe('640×480');
    expect(measureText({ kind: 'image', media: {} })).toBeNull();
    expect(measureText({ kind: 'document' })).toBeNull();
    expect(measureText({ kind: 'slides', deck: { slideCount: 12 } })).toBe('12 页');
    expect(measureText({ kind: 'slides' })).toBeNull();
  });
});

describe('location and source', () => {
  it('project entries are under the project folder, temporary session entries are under the session\'s working folder; null when the source is gone', () => {
    expect(entryPath(entry('a', { relPath: 'clips/a.mp4' }), dirs)).toBe('/work/promo/clips/a.mp4');
    expect(entryPath(entry('c', { source: { projectId: null, conversationId: 'c1' } }), dirs)).toBe('/tmp/c1/c.mp4');
    expect(entryPath(entry('x', { source: { projectId: 'gone', conversationId: null } }), dirs)).toBeNull();
    // Results not in the source directory: files written to the save location (§7.9).
    expect(entryPath(entry('s', { source: { projectId: null, conversationId: null }, file: { path: '/Users/me/Downloads/s.mp3' } }), dirs)).toBe(
      '/Users/me/Downloads/s.mp3',
    );
    expect(entryPath(entry('n', { source: { projectId: null, conversationId: null } }), dirs)).toBeNull();
  });

  it('the source column includes the subfolder; sessions without a title use a placeholder name', () => {
    expect(sourceLabel(entry('a', { relPath: 'clips/a.mp4' }), dirs, '新会话')).toBe('宣传片 · clips');
    expect(sourceLabel(entry('c', { source: { projectId: null, conversationId: 'c1' } }), dirs, '新会话')).toBe('会话「新会话」');
  });

  it('derived child videos: source reads \'from [parent video]\', are not grouped into the parent\'s card, and the parent knows how many were derived', () => {
    const parent = entry('parent', { kind: 'video', name: '发布会', relPath: 'talks/发布会', ref: { videoId: 'v_parent' } });
    const origin = { source: 'derived' as const, projectId: 'p1', videoId: 'v_parent', videoRevision: '7', capability: 'videos-derive' };
    const child = entry('child', { kind: 'video', name: '发布会 · 01:00–02:30', relPath: 'talks/发布会 · 01:00–02:30-abc', ref: { videoId: 'v_child' }, origin });
    const trashed = entry('old', { kind: 'video', ref: { videoId: 'v_old' }, origin }, { trashedAt: '2026-10-01T00:00:00.000Z' });
    const entries = [parent, child, trashed];
    expect(derivedFrom(child)).toBe('v_parent');
    expect(derivedFrom(parent)).toBeNull();
    // The product's origin also points to a video, but it is not a derived video.
    expect(derivedFrom(entry('e', { kind: 'export', origin: { source: 'exported', videoId: 'v_parent' } }))).toBeNull();
    expect(derivedCount(entries, 'v_parent')).toBe(1);
    expect(derivedCount(entries, 'v_child')).toBe(0);
    expect(fromVideoId(child)).toBeNull();
    expect(groupEntries(entries).map((row) => row.id)).toEqual(expect.arrayContaining(['parent', 'child']));
    expect(sourceLabel(child, dirs, '新会话', videoNamesOf(entries))).toBe('宣传片 · talks · 来自「发布会」');
    // When the parent video is not in the list, only the location is written.
    expect(sourceLabel(child, dirs, '新会话', videoNamesOf([child]))).toBe('宣传片 · talks');
    // “View source video” in the view box: shown only when the parent video is still there and not in the trash.
    expect(parentVideoOf(entries, child)?.id).toBe('parent');
    expect(parentVideoOf(entries, parent)).toBeNull();
    expect(parentVideoOf([child], child)).toBeNull();
    const binned = entry('parent', { kind: 'video', ref: { videoId: 'v_parent' } }, { trashedAt: '2026-10-01T00:00:00.000Z' });
    expect(parentVideoOf([binned, child], child)).toBeNull();
  });
});

describe('preview and size', () => {
  it('formats the browser cannot play are stated honestly', () => {
    expect(previewKind({ kind: 'video-file', fileName: 'a.MP4' })).toBe('video');
    expect(previewKind({ kind: 'video-file', fileName: 'a.mkv' })).toBeNull();
    expect(previewKind({ kind: 'image', fileName: 'a.heic' })).toBeNull();
    expect(previewKind({ kind: 'subtitle', fileName: 'a.srt' })).toBe('text');
    expect(previewKind({ kind: 'document', fileName: 'a.md' })).toBe('markdown');
    expect(previewKind({ kind: 'document', fileName: 'a.pdf' })).toBe('pdf');
    expect(previewKind({ kind: 'document', fileName: 'a.csv' })).toBe('table');
    expect(previewKind({ kind: 'document', fileName: 'a.html' })).toBe('html');
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
  });
});

describe('recent videos', () => {
  const video = (id: string, at: string, patch: Partial<SpaceEntry> = {}, user: Partial<SpaceEntry['user']> = {}) =>
    entry(id, { kind: 'video', ref: { videoId: `v-${id}` }, relPath: id, lastActivityAt: at, ...patch }, user);

  it('lists only videos in projects that are still selectable, newest first, up to a few', () => {
    const list = [
      video('old', '2026-09-01T00:00:00.000Z'),
      video('new', '2026-10-02T00:00:00.000Z'),
      video('mid', '2026-09-15T00:00:00.000Z'),
      video('archived', '2026-10-03T00:00:00.000Z', { source: { projectId: 'p2', conversationId: null } }),
      video('chat', '2026-10-03T00:00:00.000Z', { source: { projectId: null, conversationId: 'c1' } }),
      video('trashed', '2026-10-03T00:00:00.000Z', {}, { trashedAt: '2026-10-04T00:00:00.000Z' }),
      video('missing', '2026-10-03T00:00:00.000Z', { status: 'missing' }),
      entry('file', { lastActivityAt: '2026-10-03T00:00:00.000Z' }),
    ];
    expect(recentVideos(list, ['p1']).map((e) => e.id)).toEqual(['new', 'mid', 'old']);
    expect(recentVideos(list, ['p1'], 2).map((e) => e.id)).toEqual(['new', 'mid']);
    expect(recentVideos(list, []).map((e) => e.id)).toEqual([]);
  });
});
