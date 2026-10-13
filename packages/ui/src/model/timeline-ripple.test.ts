import { describe, expect, it } from 'vitest';
import { audioItem, captionItem, chapter, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { gapsAfterDelete, mergeSpans, rippleOperations, selectionSpans, shiftFrame, uncoveredSpans } from './timeline-ripple.ts';

// 30 fps: the video is cut in two at playhead frame 300, the subtitles are also cut in two, and the music track below only covers the first 5 seconds.
const tracks = [track('s1', 'subtitle', 3), track('v1', 'visual', 1), track('a1', 'audio', 2)];
const items = [
  videoItem('vL', 'v1', 0, 300),
  videoItem('vR', 'v1', 300, 600),
  captionItem('cL', 's1', 'doc', 0, 300),
  captionItem('cR', 's1', 'doc', 300, 600),
  audioItem('m', 'a1', 0, 5),
];
const seq = sequence(tracks, items);

describe('ranges', () => {
  it('union: sorted, adjacent ranges merged into one, empty ones dropped', () => {
    expect(
      mergeSpans([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
        { start: 10, end: 20 },
        { start: 50, end: 50 },
      ]),
    ).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });

  it('uncovered parts', () => {
    expect(uncoveredSpans([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 60, end: 120 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 60 },
    ]);
  });

  it('time mapping: times after the range shift earlier, times inside it move to its start, times before it stay put', () => {
    const spans = [
      { start: 100, end: 200 },
      { start: 300, end: 350 },
    ];
    expect(shiftFrame(50, spans)).toBe(50);
    expect(shiftFrame(100, spans)).toBe(100);
    expect(shiftFrame(150, spans)).toBe(100);
    expect(shiftFrame(250, spans)).toBe(150);
    expect(shiftFrame(320, spans)).toBe(200);
    expect(shiftFrame(400, spans)).toBe(250);
  });
});

describe('closes the gap after deletion', () => {
  it('marquee-select all tracks to the left, then delete: the left span becomes empty and closes', () => {
    expect(gapsAfterDelete(seq, ['vL', 'cL', 'm'])).toEqual([{ start: 0, end: 300 }]);
  });

  it('deleting only the video on the left: subtitles still occupy the span, so it does not close', () => {
    expect(gapsAfterDelete(seq, ['vL'])).toEqual([]);
  });

  it('the part still covered by background music does not close; only the part after it closes', () => {
    expect(gapsAfterDelete(seq, ['vL', 'cL'])).toEqual([{ start: 150, end: 300 }]);
  });

  it('instances trailing the sequence end don\'t count as occupying', () => {
    const watermark = videoItem('w', 'v2', 0, 900, { untilSequenceEnd: true });
    const withMark = sequence([...tracks, track('v2', 'visual', 4)], [...items, watermark]);
    expect(gapsAfterDelete(withMark, ['vL', 'cL', 'm'])).toEqual([{ start: 0, end: 300 }]);
  });

  it('a sub-frame gap left by fractional audio frames doesn\'t count', () => {
    const short = sequence(tracks, [videoItem('v', 'v1', 0, 300), audioItem('a', 'a1', 0, 9.99)]);
    expect(gapsAfterDelete(short, ['v'])).toEqual([]);
  });

  it('subtitles attached to a video: when that video\'s span is deleted, the subtitles go too and it closes; subtitles with no acting instance still occupy the span', () => {
    const scoped = sequence(tracks, [
      videoItem('vL', 'v1', 0, 300),
      videoItem('vR', 'v1', 300, 600),
      captionItem('c', 's1', 'doc', 0, 900, { scopeItemIds: ['vL', 'vR'] }),
    ]);
    expect(gapsAfterDelete(scoped, ['vL'])).toEqual([{ start: 0, end: 300 }]);
    const withMusic = sequence(tracks, [...scoped.items, audioItem('m', 'a1', 0, 5)]);
    expect(gapsAfterDelete(withMusic, ['vL']), '用户放的音频照旧占着').toEqual([{ start: 150, end: 300 }]);
    const plain = sequence(tracks, [videoItem('vL', 'v1', 0, 300), videoItem('vR', 'v1', 300, 600), captionItem('c', 's1', 'doc', 0, 900)]);
    expect(gapsAfterDelete(plain, ['vL'])).toEqual([]);
  });

  it('separated background stems from a dub don\'t count as occupying; they\'re removed with the span when closing; dub blocks do count', () => {
    const stem = { 'cuccut.dub': { stem: 'background', groupId: 'g1' } };
    const separated = sequence(tracks, [
      videoItem('vL', 'v1', 0, 300),
      videoItem('vR', 'v1', 300, 600),
      audioItem('bg', 'a1', 0, 30, { extensions: stem }),
    ]);
    expect(gapsAfterDelete(separated, ['vL'])).toEqual([{ start: 0, end: 300 }]);
    expect(rippleOperations(separated, [{ start: 0, end: 300 }], ['vL']).operations[0]).toMatchObject({ trackIds: ['v1', 'a1'] });
    const dubbed = sequence(tracks, [
      videoItem('vL', 'v1', 0, 300),
      videoItem('vR', 'v1', 300, 600),
      audioItem('d', 'a1', 30, 3, { extensions: { 'cuccut.dub': { groupId: 'g1', sentenceId: 's1' } } }),
    ]);
    expect(gapsAfterDelete(dubbed, ['vL'])).toEqual([
      { start: 0, end: 30 },
      { start: 120, end: 300 },
    ]);
  });
});

describe('deletes a span from all tracks', () => {
  it('times covered by the selected clips merge into several spans; subtitle instances don\'t count', () => {
    expect(selectionSpans(seq, ['vL', 'cR'])).toEqual([{ start: 0, end: 300 }]);
    expect(selectionSpans(seq, ['cL', 'cR'])).toEqual([]);
  });

  it('audio fractional frames expand outward to whole frames', () => {
    const odd = sequence(tracks, [audioItem('a', 'a1', 10, 1.01)]);
    expect(selectionSpans(odd, ['a'])).toEqual([{ start: 10, end: 41 }]);
  });
});

describe('removal transaction', () => {
  it('one removeRange per span, right to left; tracks that still have clips after the span start are ordered by track order', () => {
    const plan = rippleOperations(seq, [
      { start: 0, end: 60 },
      { start: 400, end: 500 },
    ]);
    expect(plan.frames).toBe(160);
    expect(plan.spans).toEqual([
      { start: 0, end: 60 },
      { start: 400, end: 500 },
    ]);
    expect(plan.operations).toEqual([
      { type: 'removeRange', sequenceId: 'seq', from: { unit: 'frames', value: 400 }, to: { unit: 'frames', value: 500 }, trackIds: ['v1', 's1'], alignment: 'exact-frame' },
      { type: 'removeRange', sequenceId: 'seq', from: { unit: 'frames', value: 0 }, to: { unit: 'frames', value: 60 }, trackIds: ['v1', 'a1', 's1'], alignment: 'exact-frame' },
    ]);
  });

  it('clips deleted earlier in the same transaction don\'t count on the track; spans with nothing after them need not be removed', () => {
    const plan = rippleOperations(seq, [{ start: 0, end: 300 }], ['vL', 'cL', 'm']);
    expect(plan.operations[0]).toMatchObject({ trackIds: ['v1', 's1'] });
    const tail = rippleOperations(seq, [{ start: 900, end: 960 }]);
    expect(tail).toEqual({ operations: [], spans: [], frames: 0, locked: [] });
  });

  it('locked tracks or clips after the span: the span is not removed and is recorded in locked; an empty locked track doesn\'t block', () => {
    const lockedTrack = sequence([...tracks.slice(0, 2), track('a1', 'audio', 2, { locked: true })], items);
    expect(rippleOperations(lockedTrack, [{ start: 0, end: 60 }]).locked).toEqual([{ start: 0, end: 60 }]);
    expect(rippleOperations(lockedTrack, [{ start: 200, end: 260 }]).spans).toEqual([{ start: 200, end: 260 }]);
    const lockedItem = sequence(tracks, items.map((item) => (item.id === 'vR' ? { ...item, locked: true } : item)));
    const plan = rippleOperations(lockedItem, [{ start: 0, end: 60 }]);
    expect(plan.operations).toEqual([]);
    expect(plan.locked).toEqual([{ start: 0, end: 60 }]);
    const empty = sequence([...tracks, track('v9', 'visual', 9, { locked: true })], items);
    expect(rippleOperations(empty, [{ start: 0, end: 60 }]).spans).toEqual([{ start: 0, end: 60 }]);
  });

  it('chapters after shift earlier; chapters entirely inside the span are deleted, and a chapter landing at the span start keeps the latest-starting one', () => {
    const marked = sequence(tracks, items, {
      markers: [chapter('k0', 0, '开场'), chapter('k1', 120, '一'), chapter('k2', 200, '二'), chapter('k3', 450, '三'), chapter('k4', 600, '四')],
    });
    const plan = rippleOperations(marked, [
      { start: 100, end: 300 },
      { start: 400, end: 500 },
    ]);
    expect(plan.operations.filter((op) => op.type !== 'removeRange')).toEqual([
      { type: 'removeChapter', sequenceId: 'seq', chapterId: 'k1' },
      { type: 'upsertChapter', sequenceId: 'seq', chapterId: 'k2', at: { unit: 'frames', value: 100 }, alignment: 'exact-frame' },
      { type: 'upsertChapter', sequenceId: 'seq', chapterId: 'k3', at: { unit: 'frames', value: 200 }, alignment: 'exact-frame' },
      { type: 'upsertChapter', sequenceId: 'seq', chapterId: 'k4', at: { unit: 'frames', value: 300 }, alignment: 'exact-frame' },
    ]);
  });

  it('a chapter abutting the span start, with the next chapter inside the span: the abutting chapter is removed entirely', () => {
    const marked = sequence(tracks, items, { markers: [chapter('a', 0, 'A'), chapter('b', 100, 'B'), chapter('c', 150, 'C')] });
    const chapterOps = rippleOperations(marked, [{ start: 100, end: 200 }]).operations.filter((op) => op.type !== 'removeRange');
    expect(chapterOps).toEqual([{ type: 'removeChapter', sequenceId: 'seq', chapterId: 'b' }, { type: 'upsertChapter', sequenceId: 'seq', chapterId: 'c', at: { unit: 'frames', value: 100 }, alignment: 'exact-frame' }]);
  });

  it('a span left unremoved because of a lock does not move chapters', () => {
    const marked = sequence([...tracks.slice(0, 2), track('a1', 'audio', 2, { locked: true })], items, { markers: [chapter('a', 400, 'A')] });
    expect(rippleOperations(marked, [{ start: 0, end: 60 }]).operations).toEqual([]);
  });
});
