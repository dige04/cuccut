import { describe, expect, it } from 'vitest';
import { chapter, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { chapterPieces } from './export-range.ts';
import {
  addChapterOperation,
  addChapterRefusal,
  bandSegments,
  chapterAt,
  chapterRows,
  cutChapterOperations,
  defaultChapterTitle,
  moveChapterOperation,
  moveParagraphPlan,
  nextChapterStart,
  paragraphSpan,
  prevChapterStart,
  removeChapterOperation,
  renameChapterOperation,
  sequenceChapters,
  startBounds,
  visibleChapters,
  type ChapterRow,
} from './chapters.ts';

// A 60-second clip (30 fps); three chapters at 0, 20 and 45 seconds; the third chapter has no name.
const seq = sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 1800)], {
  markers: [chapter('m3', 1350, '  '), chapter('m1', 0, '开场'), chapter('m2', 600, '正文'), { id: 'n1', frame: 300, label: '备注', kind: 'note' }],
});
const chapters = sequenceChapters(seq);

describe('chapters: ranges', () => {
  it('sorted by start, runs to the next chapter, last chapter runs to the end; unnamed ones written as \'Chapter N\', other markers not counted', () => {
    expect(chapters.map((c) => [c.id, c.index, c.title, c.start, c.end, c.startFrame, c.endFrame])).toEqual([
      ['m1', 0, '开场', 0, 20, 0, 600],
      ['m2', 1, '正文', 20, 45, 600, 1350],
      ['m3', 2, '第 3 章', 45, 60, 1350, 1800],
    ]);
  });

  it('same basis as the chapter ranges on the export page', () => {
    expect(visibleChapters(chapters).map((c) => [c.id, c.title, c.start, c.end])).toEqual(chapterPieces(seq).map((p) => [p.id, p.label, p.start, p.end]));
  });

  it('chapters starting after the end are kept, length 0, not drawn on the bar', () => {
    const late = sequenceChapters(
      sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 300)], { markers: [chapter('a', 0, 'A'), chapter('b', 600, 'B')] }),
    );
    expect(late.map((c) => [c.id, c.start, c.end])).toEqual([
      ['a', 0, 10],
      ['b', 20, 20],
    ]);
    expect(visibleChapters(late).map((c) => c.id)).toEqual(['a']);
  });

  it('which chapter the playhead is in: left-closed right-open, last chapter includes the end; before the first chapter is -1', () => {
    expect(chapterAt(chapters, 0)).toBe(0);
    expect(chapterAt(chapters, 19.99)).toBe(0);
    expect(chapterAt(chapters, 20)).toBe(1);
    expect(chapterAt(chapters, 60)).toBe(2);
    const late = sequenceChapters(sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 1800)], { markers: [chapter('a', 300, 'A')] }));
    expect(chapterAt(late, 5)).toBe(-1);
    expect(chapterAt([], 5)).toBe(-1);
  });
});

describe('chapters: previous / next chapter', () => {
  it('previous: mid-chapter first returns to this chapter\'s start, near the start goes to the previous chapter; at the very beginning returns to 0', () => {
    expect(prevChapterStart(chapters, 30)).toBe(20);
    expect(prevChapterStart(chapters, 20.03)).toBe(0);
    expect(prevChapterStart(chapters, 20)).toBe(0);
    expect(prevChapterStart(chapters, 0)).toBe(0);
    expect(prevChapterStart([], 12)).toBe(0);
  });

  it('next: nearest later chapter start; in the last chapter goes to the end; no chapters, no move', () => {
    expect(nextChapterStart(chapters, 0)).toBe(20);
    expect(nextChapterStart(chapters, 19.97)).toBe(45);
    expect(nextChapterStart(chapters, 50)).toBe(60);
    expect(nextChapterStart([], 12)).toBe(12);
  });
});

describe('chapter bar', () => {
  it('chapters fill the clip length; gaps before the first chapter and between chapters are filled as segments without a chapter', () => {
    const gap = sequenceChapters(
      sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 1800)], {
        markers: [chapter('a', 300, 'A', { durationFrames: 300 }), chapter('b', 900, 'B')],
      }),
    );
    expect(bandSegments(gap, 60).map((s) => [s.chapter?.id ?? null, s.start, s.end])).toEqual([
      [null, 0, 10],
      ['a', 10, 20],
      [null, 20, 30],
      ['b', 30, 60],
    ]);
  });

  it('no chapters means one whole segment of playback progress; when length is 0 nothing is drawn', () => {
    expect(bandSegments([], 12).map((s) => [s.chapter, s.start, s.end])).toEqual([[null, 0, 12]]);
    expect(bandSegments(chapters, 0)).toEqual([]);
  });

  it('dragging a start: later than the previous chapter, earlier than the next, not past the end; first chapter earliest is 0', () => {
    expect(startBounds(chapters, 0, 1800)).toEqual({ min: 0, max: 599 });
    expect(startBounds(chapters, 1, 1800)).toEqual({ min: 1, max: 1349 });
    expect(startBounds(chapters, 2, 1800)).toEqual({ min: 601, max: 1799 });
  });
});

describe('chapters: editing operations', () => {
  it('add a chapter: committed by frame, exact-frame; prefilled \'Chapter N\'', () => {
    expect(defaultChapterTitle(chapters, 900)).toBe('第 3 章');
    expect(defaultChapterTitle([], 0)).toBe('第 1 章');
    expect(addChapterOperation(seq, chapters, 900, ' 插曲 ')).toEqual({
      ok: true,
      operation: { type: 'upsertChapter', sequenceId: 'seq', at: { unit: 'frames', value: 900 }, alignment: 'exact-frame', title: '插曲' },
    });
  });

  it('add a chapter fails: that frame already has a chapter, falls at the end, or the name is blank', () => {
    expect(addChapterOperation(seq, chapters, 600, 'x')).toEqual({ ok: false, reason: 'exists' });
    expect(addChapterOperation(seq, chapters, 1800, 'x')).toEqual({ ok: false, reason: 'beyond' });
    expect(addChapterOperation(seq, chapters, 900, '   ')).toEqual({ ok: false, reason: 'blank' });
    expect([addChapterRefusal(seq, chapters, 600), addChapterRefusal(seq, chapters, 1800), addChapterRefusal(seq, chapters, 900)]).toEqual([
      'exists',
      'beyond',
      null,
    ]);
  });

  it('rename: trim whitespace; blank or unchanged is not written; titles longer than 200 characters truncated', () => {
    const second = chapters[1]!;
    expect(renameChapterOperation('seq', second, ' 正片 ')).toEqual({ type: 'upsertChapter', sequenceId: 'seq', chapterId: 'm2', title: '正片' });
    expect(renameChapterOperation('seq', second, '正文')).toBeNull();
    expect(renameChapterOperation('seq', second, '  ')).toBeNull();
    const long = renameChapterOperation('seq', second, '长'.repeat(300));
    expect(long && 'title' in long ? long.title?.length : 0).toBe(200);
  });

  it('moving a start and deleting', () => {
    const second = chapters[1]!;
    expect(moveChapterOperation('seq', second, 750)).toEqual({
      type: 'upsertChapter',
      sequenceId: 'seq',
      chapterId: 'm2',
      at: { unit: 'frames', value: 750 },
      alignment: 'exact-frame',
    });
    expect(moveChapterOperation('seq', second, 600)).toBeNull();
    expect(removeChapterOperation('seq', second)).toEqual({ type: 'removeChapter', sequenceId: 'seq', chapterId: 'm2' });
  });
});

describe('transcript grouped by chapter', () => {
  const brief = (rows: ChapterRow[]) => rows.map((r) => (r.kind === 'chapter' ? `#${r.chapter?.id ?? '-'}:${r.count}` : r.index));

  it('a segment goes to the chapter where its midpoint falls; the header row is inserted when the chapter changes', () => {
    const paras = [
      { start: 0, end: 8 },
      { start: 8, end: 22 },
      { start: 22, end: 40 },
      { start: 46, end: 58 },
    ];
    expect(brief(chapterRows(chapters, paras, true))).toEqual(['#m1:2', 0, 1, '#m2:1', 2, '#m3:1', 3]);
  });

  it('segments cut entirely go with the previous segment, leading ones go with the next', () => {
    const paras = [null, { start: 2, end: 6 }, null, { start: 25, end: 30 }];
    expect(brief(chapterRows(chapters, paras, false))).toEqual(['#m1:3', 0, 1, 2, '#m2:1', 3]);
  });

  it('chapters without paragraphs: with only one transcript, header rows still shown (start, middle, end); with several transcripts, not listed', () => {
    const paras = [{ start: 25, end: 30 }];
    expect(brief(chapterRows(chapters, paras, true))).toEqual(['#m1:0', '#m2:1', 0, '#m3:0']);
    expect(brief(chapterRows(chapters, paras, false))).toEqual(['#m2:1', 0]);
  });

  it('segments before the first chapter get no header row; after a clip is moved back before the first chapter, insert \'before first chapter\'', () => {
    const late = sequenceChapters(sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 1800)], { markers: [chapter('a', 300, 'A')] }));
    const paras = [
      { start: 0, end: 4 },
      { start: 12, end: 20 },
      { start: 2, end: 6 },
    ];
    expect(brief(chapterRows(late, paras, true))).toEqual([0, '#a:1', 1, '#-:1', 2]);
  });

  it('after a clip is moved and the chapter number jumps back, headers are inserted in order; chapters with paragraphs are no longer filled as empty chapters', () => {
    const paras = [
      { start: 2, end: 6 },
      { start: 50, end: 55 },
      { start: 25, end: 30 },
    ];
    expect(brief(chapterRows(chapters, paras, true))).toEqual(['#m1:1', 0, '#m3:1', 1, '#m2:1', 2]);
  });

  it('segment range: from the start of the first remaining word to the end of the last remaining word; null when entirely cut', () => {
    const at = (start: number, end: number) => ({ start, end });
    expect(paragraphSpan([{ placements: [] }, { placements: [at(2, 3)] }, { placements: [at(4, 5), at(9, 10)] }, { placements: [] }])).toEqual(at(2, 5));
    expect(paragraphSpan([{ placements: [] }])).toBeNull();
  });

  it('no chapters, no header rows', () => {
    expect(brief(chapterRows([], [{ start: 0, end: 1 }, null], true))).toEqual([0, 1]);
  });
});

describe('in the transcript, change and cut chapters', () => {
  // Chapter one has two segments, chapter two has two, chapter three has one.
  const paras = [
    { start: 0, end: 8 },
    { start: 8.5, end: 18 },
    { start: 22, end: 30 },
    { start: 31.02, end: 40 },
    { start: 46, end: 58 },
  ];

  it('moving later: the next chapter\'s start moves to the beginning of this segment (rounded down to a frame), later segments on the same side move with it', () => {
    expect(moveParagraphPlan(seq, chapters, paras, 1, 1)).toMatchObject({
      from: { id: 'm1' },
      to: { id: 'm2' },
      frame: 255,
      moved: 1,
      operation: { type: 'upsertChapter', chapterId: 'm2', at: { unit: 'frames', value: 255 }, alignment: 'exact-frame' },
    });
  });

  it('moving earlier: this chapter\'s start moves to the beginning of the next segment in the same chapter', () => {
    expect(moveParagraphPlan(seq, chapters, paras, 2, -1)).toMatchObject({
      from: { id: 'm2' },
      to: { id: 'm1' },
      frame: 930,
      moved: 1,
      operation: { chapterId: 'm2', at: { unit: 'frames', value: 930 } },
    });
  });

  it('not allowed: would empty this chapter, no chapter before or after, the whole segment cut, or before the first chapter', () => {
    expect(moveParagraphPlan(seq, chapters, paras, 0, 1)).toBeNull();
    expect(moveParagraphPlan(seq, chapters, paras, 3, -1)).toBeNull();
    expect(moveParagraphPlan(seq, chapters, paras, 0, -1)).toBeNull();
    expect(moveParagraphPlan(seq, chapters, paras, 4, 1)).toBeNull();
    expect(moveParagraphPlan(seq, chapters, [null, ...paras], 0, 1)).toBeNull();
    const late = sequenceChapters(
      sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 1800)], { markers: [chapter('a', 300, 'A'), chapter('b', 900, 'B')] }),
    );
    expect(
      moveParagraphPlan(
        seq,
        late,
        [
          { start: 0, end: 4 },
          { start: 5, end: 8 },
        ],
        1,
        1,
      ),
    ).toBeNull();
  });

  it('cut a chapter: delete range, delete markers, later chapters shift earlier in ascending order by this chapter\'s length, one transaction', () => {
    expect(cutChapterOperations(seq, chapters, chapters[0]!, ['v1'])).toEqual({
      ok: true,
      frames: 600,
      operations: [
        {
          type: 'removeRange',
          sequenceId: 'seq',
          from: { unit: 'frames', value: 0 },
          to: { unit: 'frames', value: 600 },
          trackIds: ['v1'],
          alignment: 'exact-frame',
        },
        { type: 'removeChapter', sequenceId: 'seq', chapterId: 'm1' },
        { type: 'upsertChapter', sequenceId: 'seq', chapterId: 'm2', at: { unit: 'frames', value: 0 }, alignment: 'exact-frame' },
        { type: 'upsertChapter', sequenceId: 'seq', chapterId: 'm3', at: { unit: 'frames', value: 750 }, alignment: 'exact-frame' },
      ],
    });
    const last = cutChapterOperations(seq, chapters, chapters[2]!, ['v1']);
    expect(last.ok && last.operations.map((op) => op.type)).toEqual(['removeRange', 'removeChapter']);
  });

  it('cut a chapter not allowed: the video has only this chapter, no length, no track to cut', () => {
    const only = sequence([track('v1', 'visual', 1)], [videoItem('c1', 'v1', 0, 1800)], { markers: [chapter('a', 0, 'A'), chapter('z', 1800, 'Z')] });
    const list = sequenceChapters(only);
    expect(cutChapterOperations(only, list, list[0]!, ['v1'])).toEqual({ ok: false, reason: 'whole' });
    expect(cutChapterOperations(only, list, list[1]!, ['v1'])).toEqual({ ok: false, reason: 'empty' });
    expect(cutChapterOperations(seq, chapters, chapters[1]!, [])).toEqual({ ok: false, reason: 'no-tracks' });
  });
});
