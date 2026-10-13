import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { VideoSnapshot } from '@cuccut/protocol';
import { DUB_EXTENSION, sourceSentences } from '@cuccut/jobs';
import { extractContent, type ContentSegment, type ReadContentDocument, type ReadContentResult } from './content-extract.ts';
import { matchTerms, searchSegments, type SearchableVideo } from './content-search.ts';
import { ContentStore, STORE_FILE, STORE_VERSION, termClauses, type CandidateFilter, type StoredVideo } from './content-store.ts';

/** Extraction and search for the content index: no engine needed; search uses a database in a temporary directory. */

function snapshot(extra: Partial<Record<string, unknown>> = {}): VideoSnapshot {
  return {
    rootSequenceId: 'seq',
    sequences: {
      seq: {
        id: 'seq',
        fps: { num: 30, den: 1 },
        items: [{ id: 'i1', type: 'video', assetRef: { id: 'a-used', revision: 'r1' } }],
        markers: [
          { id: 'm1', kind: 'chapter', frame: 300, durationFrames: 150, label: '第二章 开拍', summary: '准备器材' },
          { id: 'm2', kind: 'note', frame: 30, label: '不是章节' },
        ],
      },
    },
    assets: {
      'a-linked': {
        id: 'a-linked',
        name: '素材.mp4',
        revisions: { r1: { storage: { mode: 'linked', locator: { path: '../raw/clip.mp4' } } } },
      },
      'a-used': { id: 'a-used', name: '内置', revisions: { r1: { storage: { mode: 'managed' } } } },
    },
    ...extra,
  } as unknown as VideoSnapshot;
}

function speechDoc(id: string, plan: boolean): ReadContentDocument {
  return {
    documentId: id,
    kind: 'speech',
    name: '转写',
    language: 'zh',
    revision: '1',
    schema: 'cuccut.speech/1',
    sourceAssetId: 'a-used',
    sourceDocumentId: null,
    body: {
      timescale: 1000,
      words: [
        { id: 'w1', text: '今天', start: 1000, end: 1400, speaker: '宝玉' },
        { id: 'w2', text: '剪辑', start: 1400, end: 1800, speaker: '宝玉' },
        { id: 'w3', text: '视频。', start: 1800, end: 2200, speaker: '宝玉' },
        { id: 'w4', text: 'Hello', start: 5000, end: 5400, speaker: 'Guest' },
      ],
      sentences: null,
    },
    plan: plan
      ? {
          sequenceId: 'seq',
          documentId: id,
          unit: 'speech' as const,
          clock: 'sequence' as const,
          scope: { basis: 'root', captionItemIds: [], scopeItemIds: [] },
          range: { startSeconds: 0, endSeconds: 10, durationSeconds: 10 },
          entries: [
            { key: 'w1', id: 'w1', start: 11, end: 11.4, text: '今天', speaker: '宝玉', wordTiming: true },
            { key: 'w2', id: 'w2', start: 11.4, end: 11.8, text: '剪辑', speaker: '宝玉', wordTiming: true },
            { key: 'w3', id: 'w3', start: 11.8, end: 12.2, text: '视频。', speaker: '宝玉', wordTiming: true },
          ],
          sourceCount: 4,
          omittedCount: 1,
        }
      : null,
  };
}

function result(documents: ReadContentResult['documents']): ReadContentResult {
  return { videoId: 'v1', name: '访谈', revision: 'rev-1', snapshot: snapshot(), documents };
}

describe('content extraction', () => {
  it('transcription uses the timeline projection (sequence time), falling back to source time when the projection is empty', () => {
    const projected = extractContent(result([speechDoc('d1', true)]), '/p/访谈');
    const speech = projected.segments.filter((s) => s.kind === 'speech');
    expect(speech.length).toBeGreaterThan(0);
    expect(speech.every((s) => s.clock === 'sequence')).toBe(true);
    expect(speech.map((s) => s.text).join('')).toContain('剪辑');
    expect(speech.map((s) => s.text).join('')).not.toContain('Hello');

    const source = extractContent(result([speechDoc('d1', false)]), '/p/访谈');
    const fallback = source.segments.filter((s) => s.kind === 'speech');
    expect(fallback.every((s) => s.clock === 'source')).toBe(true);
    expect(fallback.map((s) => s.text).join('')).toContain('Hello');
    expect(fallback.find((s) => s.text.includes('剪辑'))).toMatchObject({ start: 1, speaker: '宝玉' });
  });

  it('translation /2 borrows transcription timing, stale units are excluded; /1 still uses unit IDs as before', () => {
    const translation2 = {
      documentId: 't2',
      kind: 'translation',
      language: 'en',
      schema: 'cuccut.translation/2',
      sourceDocumentId: 'd1',
      body: {
        schema: 'cuccut.translation/2',
        units: [
          { id: 'u1', sourceSentenceId: 's-w1', naturalText: 'Editing video today.', alignment: { sourceWordIds: ['w1', 'w2', 'w3'] } },
          { id: 'u2', sourceSentenceId: 's-w4', naturalText: 'Old text', status: 'stale' },
          { id: 'u3', sourceSentenceId: 's-w4', naturalText: 'Hi', displayRewrite: { text: 'Hello there' } },
        ],
      },
    };
    const extracted = extractContent(result([speechDoc('d1', false), translation2]), '/p/访谈');
    const units = extracted.segments.filter((s) => s.kind === 'translation');
    expect(units.map((u) => u.text)).toEqual(['Editing video today.', 'Hello there']);
    expect(units[0]).toMatchObject({ clock: 'source', start: 1, end: 2.2, language: 'en', documentId: 't2' });
    expect(units[1]).toMatchObject({ start: 5 });

    const translation1 = {
      documentId: 't1',
      kind: 'translation',
      schema: 'cuccut.translation/1',
      sourceDocumentId: 'd1',
      body: { units: [{ id: 'nope', text: '旧译文' }] },
    };
    const legacy = extractContent(result([translation1]), '/p/访谈');
    expect(legacy.segments).toContainEqual(expect.objectContaining({ kind: 'translation', text: '旧译文', start: 0 }));
  });

  it('chapters take the chapter markers of the root sequence; video facts and unreadable documents', () => {
    const extracted = extractContent(result([{ documentId: 'bad', kind: 'caption', error: '正文坏了' }]), '/p/访谈');
    expect(extracted.segments).toEqual([expect.objectContaining({ kind: 'chapter', text: '第二章 开拍\n准备器材', start: 10, end: 15 })]);
    expect(extracted.problems).toEqual([{ documentId: 'bad', detail: '正文坏了' }]);
    expect(extracted.facts.timelineAssetIds).toEqual(['a-used']);
    expect(extracted.facts.linkedFiles).toEqual([{ assetId: 'a-linked', name: '素材.mp4', path: '/p/raw/clip.mp4' }]);
  });
});

describe('video facts: duration and canvas size', () => {
  it('root sequence: duration is the latest-ending instance (at sequence frame rate), size is the canvas', () => {
    const complete = snapshot({
      sequences: {
        seq: {
          id: 'seq',
          fps: { num: 30000, den: 1001 },
          canvas: { width: 1080, height: 1920, workingSpace: 'srgb', background: '#000000' },
          tracks: [{ id: 't1', visible: true }],
          items: [
            {
              id: 'i1',
              type: 'video',
              trackId: 't1',
              assetRef: { id: 'a-used', revision: 'r1' },
              span: { fromFrame: 0, durationFrames: 90 },
            },
            {
              id: 'i2',
              type: 'image',
              trackId: 't1',
              assetRef: { id: 'a-used', revision: 'r1' },
              span: { fromFrame: 60, durationFrames: 90 },
            },
          ],
          markers: [],
        },
        other: {
          id: 'other',
          fps: { num: 30, den: 1 },
          canvas: { width: 640, height: 360 },
          tracks: [],
          items: [{ id: 'o1', type: 'image', span: { fromFrame: 0, durationFrames: 9000 } }],
        },
      },
    });
    const { facts } = extractContent({ ...result([]), snapshot: complete }, '/p/访谈');
    // 150 frames × 1001 / 30000 = 5.005 seconds; other sequences do not count.
    expect(facts.timeline).toEqual({ durationSec: 5.005, width: 1080, height: 1920 });
  });

  it('none when the snapshot is incomplete (no tracks, canvas or instance ranges)', () => {
    expect(extractContent(result([]), '/p/访谈').facts.timeline).toBeNull();
    const noCanvas = snapshot({
      sequences: { seq: { id: 'seq', fps: { num: 30, den: 1 }, tracks: [], items: [], markers: [] } },
    });
    expect(extractContent({ ...result([]), snapshot: noCanvas }, '/p/访谈').facts.timeline).toBeNull();
  });
});

describe('video facts: derived source', () => {
  const derivation = (summary: unknown) =>
    snapshot({
      documents: {
        doc_d: { id: 'doc_d', kind: 'derivation', name: '派生来源', currentRevision: '2', revisions: { '1': { summary: null }, '2': { summary } } },
      },
    });

  it('takes the summary of the current version of the derivation document: parent video, version, idempotency key and range', () => {
    const summary = { schema: 'cuccut.derivation/1', parentVideoId: 'v_parent', parentRevision: '7', key: 'abc123def456', range: { start: 1.5, end: 4.5 }, cuts: [] };
    const { facts } = extractContent({ ...result([]), snapshot: derivation(summary) }, '/p/访谈');
    expect(facts.origin).toEqual({ parentVideoId: 'v_parent', parentRevision: '7', key: 'abc123def456', range: { start: 1.5, end: 4.5 } });
  });

  it('a video that is not derived, and a summary with the wrong shape, are null', () => {
    expect(extractContent(result([]), '/p/访谈').facts.origin).toBeNull();
    const wrong = { schema: 'cuccut.derivation/2', parentVideoId: 'v_parent', parentRevision: '7', key: 'k', range: { start: 0, end: 1 } };
    expect(extractContent({ ...result([]), snapshot: derivation(wrong) }, '/p/访谈').facts.origin).toBeNull();
  });
});

describe('video facts: script, translations and voiceover group', () => {
  it('all three are empty when there is no script', () => {
    const { facts } = extractContent(result([]), '/p/访谈');
    expect(facts).toMatchObject({ transcripts: [], translations: [], dubGroups: [] });
  });

  it('transcription language, word-level timing and whether it is on the timeline', () => {
    const estimated = speechDoc('d2', false);
    const body = estimated.body as { words: Array<Record<string, unknown>> };
    body.words[1]!.timingQuality = 'estimated';
    const { facts } = extractContent(result([speechDoc('d1', true), { ...estimated, name: '粗转写', language: 'en' }]), '/p/访谈');
    expect(facts.transcripts).toEqual([
      { documentId: 'd1', name: '转写', language: 'zh', wordTiming: true, onTimeline: true },
      { documentId: 'd2', name: '粗转写', language: 'en', wordTiming: false, onTimeline: false },
    ]);
  });

  it('translation target language, source transcription and stale units', () => {
    const speech = speechDoc('d1', false);
    const read = sourceSentences({ schema: 'cuccut.speech/1', ...(speech.body as object) });
    if (!('sentences' in read)) throw new Error(read.problem);
    const [first, second] = read.sentences;
    const translation = {
      documentId: 't2',
      kind: 'translation',
      name: '英文',
      language: 'en',
      schema: 'cuccut.translation/2',
      sourceDocumentId: 'd1',
      body: {
        units: [
          { id: 'u1', sourceSentenceId: first!.id, sourceFingerprint: first!.fingerprint, naturalText: 'Editing video today.' },
          { id: 'u2', sourceSentenceId: second!.id, sourceFingerprint: 'sha256:old', naturalText: 'Hello' },
          { id: 'u3', sourceSentenceId: second!.id, sourceFingerprint: second!.fingerprint, naturalText: 'Hi', status: 'stale' },
          { id: 'u4', sourceSentenceId: second!.id, sourceFingerprint: second!.fingerprint, naturalText: ' ' },
          { id: 'u5', sourceSentenceId: 's-gone', sourceFingerprint: 'sha256:x', naturalText: 'Gone' },
        ],
      },
    };
    const { facts } = extractContent(result([speech, translation]), '/p/访谈');
    // u2 fingerprint mismatch, u3 marked stale, u4 empty, u5 original sentence gone.
    expect(facts.translations).toEqual([
      { documentId: 't2', name: '英文', language: 'en', sourceDocumentId: 'd1', units: 5, staleUnits: 4 },
    ]);

    // Transcript not in the video: all stale. The /1 translation counts only the ones marked stale and the empty ones.
    const orphan = extractContent(result([translation]), '/p/访谈').facts.translations[0]!;
    expect(orphan.staleUnits).toBe(5);
    const legacy = extractContent(
      result([
        {
          documentId: 't1',
          kind: 'translation',
          schema: 'cuccut.translation/1',
          sourceDocumentId: 'd1',
          body: {
            units: [
              { id: 'a', text: '旧译文' },
              { id: 'b', text: '' },
              { id: 'c', text: '过期', status: 'stale' },
            ],
          },
        },
      ]),
      '/p/访谈',
    ).facts.translations[0]!;
    expect(legacy).toMatchObject({ language: null, sourceDocumentId: 'd1', units: 3, staleUnits: 2 });
  });

  it('voiceover group: voiceover plan and voiceover instances together; background audio is not counted as an instance', () => {
    const snap = snapshot({
      documents: {
        plan1: {
          id: 'plan1',
          kind: 'dubbing-plan',
          name: '英文配音',
          language: 'en',
          sourceDocumentId: 't2',
          currentRevision: 'r1',
          revisions: { r1: { summary: { groupId: 'g1' } } },
        },
      },
    });
    const seq = (snap.sequences as Record<string, { items: unknown[] }>).seq!;
    seq.items.push(
      { id: 'dub1', type: 'audio', extensions: { [DUB_EXTENSION]: { groupId: 'g1', language: 'en', unitId: 'u1' } } },
      { id: 'dub2', type: 'audio', extensions: { [DUB_EXTENSION]: { groupId: 'g1', language: 'en', unitId: 'u2' } } },
      { id: 'bg', type: 'audio', extensions: { [DUB_EXTENSION]: { groupId: 'g1', stem: 'background' } } },
      { id: 'dub3', type: 'audio', extensions: { [DUB_EXTENSION]: { groupId: 'g2', language: 'ja', unitId: 'u1' } } },
    );
    const translation = {
      documentId: 't2',
      kind: 'translation',
      language: 'en',
      schema: 'cuccut.translation/2',
      sourceDocumentId: 'd1',
      body: { units: [] },
    };
    const { facts } = extractContent(
      { videoId: 'v1', name: '访谈', revision: 'rev-1', snapshot: snap, documents: [speechDoc('d1', false), translation] },
      '/p/访谈',
    );
    expect(facts.dubGroups).toEqual([
      { groupId: 'g1', language: 'en', planDocumentId: 'plan1', translationId: 't2', transcriptId: 'd1', items: 2 },
      { groupId: 'g2', language: 'ja', planDocumentId: null, translationId: null, transcriptId: null, items: 1 },
    ]);
  });
});

describe('content search', () => {
  const v1: ContentSegment[] = [
    { kind: 'speech', documentId: 'd1', language: 'zh', clock: 'sequence', start: 20, end: 22, text: '我们来剪辑视频', speaker: '宝玉' },
    { kind: 'speech', documentId: 'd1', language: 'zh', clock: 'sequence', start: 3, end: 5, text: '视频剪辑很好玩', speaker: 'Guest' },
    { kind: 'chapter', documentId: null, language: null, clock: 'sequence', start: 3, end: 9, text: '剪辑入门', speaker: null },
  ];
  const v2: ContentSegment[] = [
    { kind: 'caption', documentId: 'c1', language: 'en', clock: 'source', start: 1, end: 2, text: 'ＥＤＩＴ the Video', speaker: null },
  ];
  const videos: SearchableVideo[] = [
    { dir: '/p/访谈', videoId: 'v1', videoName: '访谈', entryId: 'sp_1', projectId: 'p1', revision: 'r1' },
    { dir: '/p/Vlog', videoId: 'v2', videoName: 'Vlog', entryId: 'sp_2', projectId: null, revision: 'r9' },
  ];
  const stored = (video: SearchableVideo): StoredVideo => ({
    dir: video.dir,
    videoId: video.videoId,
    name: video.videoName,
    revision: video.revision,
    mtimeMs: 1,
    indexedAt: '2026-01-01T00:00:00.000Z',
    facts: { timelineAssetIds: [], linkedFiles: [], transcripts: [], translations: [], dubGroups: [] },
    problems: [],
  });

  let tmp: string;
  let store: ContentStore;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'content-store-'));
    store = new ContentStore(tmp);
    store.replace(stored(videos[0]!), v1);
    store.replace(stored(videos[1]!), v2);
  });
  afterEach(async () => {
    store.close();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  /** Records every filter condition given to the database. */
  function spy(): { source: { candidates: (filter: CandidateFilter) => ReturnType<ContentStore['candidates']> }; filters: CandidateFilter[] } {
    const filters: CandidateFilter[] = [];
    return {
      filters,
      source: {
        candidates: (filter) => {
          filters.push(filter);
          return store.candidates(filter);
        },
      },
    };
  }

  it('substring, multi-word AND, case and full-width insensitive; ordered by video order and time', () => {
    const { hits, truncated } = searchSegments(store, videos, { query: '剪辑', limit: 10 });
    expect(truncated).toBe(false);
    expect(hits.map((h) => [h.videoId, h.documentKind, h.time.start])).toEqual([
      ['v1', 'chapter', 3],
      ['v1', 'speech', 3],
      ['v1', 'speech', 20],
    ]);
    expect(hits[2]).toMatchObject({
      snippet: '我们来剪辑视频',
      highlights: [[3, 5]],
      speaker: '宝玉',
      indexedRevision: 'r1',
      entryId: 'sp_1',
    });

    expect(searchSegments(store, videos, { query: 'edit video', limit: 10 }).hits).toEqual([
      expect.objectContaining({ videoId: 'v2', documentKind: 'caption', time: { clock: 'source', start: 1, end: 2 } }),
    ]);
    expect(searchSegments(store, videos, { query: '剪辑 好玩', limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: '剪辑', kinds: ['chapter'], limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: '', speaker: 'guest', limit: 10 }).hits).toEqual([
      expect.objectContaining({ snippet: '视频剪辑很好玩', highlights: [] }),
    ]);
    expect(searchSegments(store, videos, { query: '剪辑', limit: 2 })).toMatchObject({ truncated: true, hits: [{}, {}] });
    // Exactly `limit` rows is not counted as truncated.
    expect(searchSegments(store, videos, { query: '剪辑', limit: 3 })).toMatchObject({ truncated: false });
  });

  it('results follow the caller\'s video order; videos outside the scope do not appear', () => {
    store.replace(stored(videos[1]!), [{ ...v2[0]!, text: '剪辑 the video' }]);
    const reversed = [videos[1]!, videos[0]!];
    expect(searchSegments(store, reversed, { query: '剪辑', limit: 10 }).hits.map((h) => h.videoId)).toEqual(['v2', 'v1', 'v1', 'v1']);
    expect(searchSegments(store, [videos[1]!], { query: '剪辑', limit: 10 }).hits.map((h) => h.videoId)).toEqual(['v2']);
    expect(searchSegments(store, [], { query: '剪辑', limit: 10 })).toEqual({ hits: [], truncated: false });
  });

  it('two-character words use substring filtering, three or more use MATCH; mixed multi-word queries are ANDed within the same segment', () => {
    expect(termClauses(['剪辑'])).toEqual({ match: null, short: ['剪辑'] });
    expect(termClauses(['剪辑视', 'ab', 'say "hi"'])).toEqual({ match: '"剪辑视" AND "say ""hi"""', short: ['ab'] });
    // Counted by code points: two emoji are four UTF-16 units, still too short.
    expect(termClauses(['😀😀'])).toEqual({ match: null, short: ['😀😀'] });

    const { source, filters } = spy();
    expect(searchSegments(source, videos, { query: '剪辑', limit: 10 }).hits).toHaveLength(3);
    expect(searchSegments(source, videos, { query: '剪辑视频', limit: 10 }).hits.map((h) => h.time.start)).toEqual([20]);
    expect(searchSegments(source, videos, { query: '好玩 视频剪辑', limit: 10 }).hits.map((h) => h.snippet)).toEqual(['视频剪辑很好玩']);
    expect(searchSegments(source, videos, { query: '好玩 我们来', limit: 10 }).hits).toEqual([]);
    expect(filters.map((f) => termClauses(f.terms))).toEqual([
      { match: null, short: ['剪辑'] },
      { match: '"剪辑视频"', short: [] },
      { match: '"视频剪辑"', short: ['好玩'] },
      { match: '"我们来"', short: ['好玩'] },
    ]);
    // Wildcards and quotes are matched literally.
    store.replace(stored(videos[1]!), [{ ...v2[0]!, text: '50% off_now "quoted"' }]);
    expect(searchSegments(store, videos, { query: '0%', limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: '%', limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: 'f_n', limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: '"quoted"', limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: 'f%n', limit: 10 }).hits).toHaveLength(0);
  });

  it('filter by kind and speaker', () => {
    expect(searchSegments(store, videos, { query: '剪辑', kinds: ['speech'], limit: 10 }).hits.map((h) => h.time.start)).toEqual([3, 20]);
    expect(searchSegments(store, videos, { query: '视频', kinds: ['chapter', 'caption'], limit: 10 }).hits).toEqual([]);
    expect(searchSegments(store, videos, { query: '剪辑', speaker: '宝', limit: 10 }).hits.map((h) => h.speaker)).toEqual(['宝玉']);
    expect(searchSegments(store, videos, { query: '剪辑', speaker: ' ＧＵＥＳＴ ', limit: 10 }).hits.map((h) => h.speaker)).toEqual(['Guest']);
    expect(searchSegments(store, videos, { query: '剪辑', speaker: 'nobody', limit: 10 }).hits).toEqual([]);
  });

  it('replacing one video\'s segments does not affect other videos; deleted videos are not found', () => {
    store.replace(stored(videos[0]!), [{ ...v1[0]!, text: '换了内容' }]);
    expect(searchSegments(store, videos, { query: '剪辑', limit: 10 }).hits).toEqual([]);
    expect(searchSegments(store, videos, { query: '换了内容', limit: 10 }).hits).toHaveLength(1);
    expect(searchSegments(store, videos, { query: 'video', limit: 10 }).hits).toHaveLength(1);
    store.remove([videos[1]!.dir]);
    expect(searchSegments(store, videos, { query: 'video', limit: 10 }).hits).toEqual([]);
    expect(store.videos().map((v) => v.dir)).toEqual([videos[0]!.dir]);
  });

  it('the library is rebuilt as empty when its format version is wrong, the file is corrupt or it has been deleted', async () => {
    const file = path.join(tmp, STORE_FILE);
    store.close();
    const reopened = new ContentStore(tmp);
    expect(reopened.videos()).toHaveLength(2);
    reopened.close();

    const raw = new DatabaseSync(file);
    raw.exec(`PRAGMA user_version = ${STORE_VERSION + 1}`);
    raw.close();
    store = new ContentStore(tmp);
    expect(store.videos()).toEqual([]);
    expect(searchSegments(store, videos, { query: '剪辑', limit: 10 }).hits).toEqual([]);
    store.replace(stored(videos[0]!), v1);
    expect(searchSegments(store, videos, { query: '剪辑', limit: 10 }).hits).toHaveLength(3);
    store.close();

    await fs.writeFile(file, 'not a database');
    store = new ContentStore(tmp);
    expect(store.videos()).toEqual([]);
    store.close();

    await fs.rm(tmp, { recursive: true, force: true });
    store = new ContentStore(tmp);
    store.replace(stored(videos[1]!), v2);
    expect(searchSegments(store, videos, { query: 'edit', limit: 10 }).hits).toHaveLength(1);
  });

  it('long segments are excerpted around the hit and the position is rewritten', () => {
    const text = `${'前'.repeat(200)}关键词${'后'.repeat(200)}`;
    const found = matchTerms(text, ['关键词'])!;
    expect(found.snippet.startsWith('…')).toBe(true);
    expect(found.snippet.endsWith('…')).toBe(true);
    const [a, b] = found.highlights[0]!;
    expect(found.snippet.slice(a, b)).toBe('关键词');
    expect(matchTerms(text, ['关键词', '没有'])).toBeNull();
  });
});
