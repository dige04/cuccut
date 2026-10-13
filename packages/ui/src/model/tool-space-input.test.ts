import { describe, expect, it } from 'vitest';
import type { SpaceEntry } from '@cuccut/protocol';
import { entryReason, inputKindOf, SPACE_INPUT_COPY, spaceKindsText, spaceRows, toolsForEntry } from './tool-space-input.ts';
import type { PickerRow } from './tool-targets.ts';

const entry = (id: string, patch: Partial<SpaceEntry> = {}, trashedAt: string | null = null): SpaceEntry => ({
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
  user: { favorite: false, displayName: null, trashedAt },
});

const videoRow = (entryId: string, patch: Partial<PickerRow> = {}): PickerRow => ({
  entryId,
  videoId: `v-${entryId}`,
  name: entryId,
  projectId: 'p1',
  lastActivityAt: '2026-10-02T00:00:00.000Z',
  indexed: true,
  documents: [],
  tags: [],
  eligible: true,
  reason: null,
  ...patch,
});

describe('Space picker candidates', () => {
  const entries = [
    entry('clip'),
    entry('final', { kind: 'export', name: '成片.mp4', lastActivityAt: '2026-10-03T00:00:00.000Z' }),
    entry('voice', { kind: 'audio', name: 'voice.m4a', fileName: 'voice.m4a' }),
    entry('notes', { kind: 'document', name: 'notes.md', fileName: 'notes.md' }),
    entry('old', {}, '2026-09-01T00:00:00.000Z'),
    entry('busy', { status: 'generating', lastActivityAt: '2026-10-05T00:00:00.000Z' }),
    entry('movie', { kind: 'video', name: 'movie' }),
  ];

  it('lists only the kinds the tool accepts, trash excluded; selectable ones first, within a group by most recent activity', () => {
    const rows = spaceRows('compress-video', entries, []);
    expect(rows.map((r) => r.entryId)).toEqual(['final', 'clip', 'busy']);
    expect(rows.at(-1)).toMatchObject({ eligible: false, reason: SPACE_INPUT_COPY.generating });
  });

  it('video rows come from candidates (with script and greyed-out reasons), only given to tools that accept videos', () => {
    const videos = [videoRow('movie'), videoRow('raw', { eligible: false, reason: '还没有文稿' })];
    const rows = spaceRows('transcribe', entries, videos);
    expect(rows.map((r) => r.entryId)).toEqual(['final', 'movie', 'clip', 'voice', 'busy', 'raw']);
    expect(rows.find((r) => r.entryId === 'movie')).toMatchObject({ kind: 'video', kindLabel: '视频', video: videos[0] });
    expect(spaceRows('extract-audio', entries, videos).some((r) => r.kind === 'video')).toBe(false);
  });

  it('searches by name, case-insensitive', () => {
    expect(spaceRows('transcribe', entries, [videoRow('Movie')], 'MOV').map((r) => r.entryId)).toEqual(['Movie']);
    expect(spaceRows('synthesize-speech', entries, [], 'note').map((r) => r.entryId)).toEqual(['notes']);
  });

  it('item-level reasons: generating, missing, failed, unreadable document and subtitle format', () => {
    expect(entryReason(entry('a', { status: 'missing' }))).toBe(SPACE_INPUT_COPY.missing);
    expect(entryReason(entry('a', { status: 'failed' }))).toBe(SPACE_INPUT_COPY.failed);
    expect(entryReason(entry('a', { kind: 'document', fileName: 'a.pdf' }))).toBe(SPACE_INPUT_COPY.textOnly);
    expect(entryReason(entry('a', { kind: 'document', fileName: 'a.TXT' }))).toBeNull();
    expect(entryReason(entry('a', { kind: 'subtitle', fileName: 'a.ass' }))).toBe(SPACE_INPUT_COPY.subtitleOnly);
    expect(entryReason(entry('a', { kind: 'subtitle', fileName: 'a.vtt' }))).toBeNull();
    expect(entryReason(entry('a', {}, '2026-09-01T00:00:00.000Z'))).toBe(SPACE_INPUT_COPY.trashed);
  });

  it('the accepted kinds are written as one sentence', () => {
    expect(spaceKindsText('transcribe')).toBe('视频、视频素材、成片、音频');
    expect(spaceKindsText('generate-image')).toBe('');
  });
});

describe('which input an item is submitted as', () => {
  it('videos are written into it; generated speech and text-generated documents are assets; the rest are files', () => {
    expect(inputKindOf('transcribe', 'video')).toBe('video');
    expect(inputKindOf('transcribe', 'audio')).toBe('file');
    expect(inputKindOf('translate-subtitles', 'subtitle')).toBe('file');
    expect(inputKindOf('synthesize-speech', 'subtitle')).toBe('document');
    expect(inputKindOf('generate-text', 'document')).toBe('document');
    expect(inputKindOf('merge-video', 'export')).toBe('file');
  });
});

describe('item → tools that accept it', () => {
  it('in catalog order; none from trash', () => {
    expect(toolsForEntry(entry('a', { kind: 'audio' }))).toEqual(['transcribe', 'extract-audio']);
    expect(toolsForEntry(entry('a', { kind: 'subtitle' }))).toEqual(['translate-subtitles', 'synthesize-speech', 'generate-text']);
    expect(toolsForEntry(entry('a', { kind: 'video' }))).toEqual(['transcribe', 'translate-subtitles', 'dub']);
    expect(toolsForEntry(entry('a', { kind: 'image' }))).toEqual([]);
    expect(toolsForEntry(entry('a', { kind: 'export' }, '2026-09-01T00:00:00.000Z'))).toEqual([]);
  });
});
