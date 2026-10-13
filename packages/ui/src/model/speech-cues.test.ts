import { describe, expect, it } from 'vitest';
import { itemRangeSeconds, mediaTimeToSeconds, type AudioItem, type Sequence, type Track, type VideoItem } from '@cuccut/protocol';
import {
  clauseEndChar,
  countSentences,
  deriveCues,
  displayWidth,
  joinWords,
  projectSpeech,
  readSpeechWords,
  sentenceEnd,
  speechCaptionBody,
  speechCaptionOperations,
  splitUntimed,
  TakenIntervals,
  type PlacedWord,
  type SpeechWord,
} from './speech-cues.ts';

const fps = { num: 30, den: 1 };
const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };

function video(id: string, fromFrame: number, durationFrames: number, sourceIn: number, rate = 1, asset = 'asset_a'): VideoItem {
  return {
    ...base,
    id,
    trackId: 'v1',
    type: 'video',
    span: { fromFrame, durationFrames },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: asset, revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(Math.round(sourceIn * 1000)), timescale: 1000 }, rate: { num: rate, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

function audio(id: string, fromFrame: number, seconds: number, asset = 'asset_a'): AudioItem {
  return {
    ...base,
    id,
    trackId: 'a1',
    type: 'audio',
    assetRef: { id: asset, revision: '1' },
    fromFrame,
    subframeOffset: { ticks: '0', timescale: 48000 },
    playDuration: { ticks: String(seconds * 48000), timescale: 48000 },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 48000 }, rate: { num: 1, den: 1 } },
    mix: { volume: 1 },
  };
}

const track = (id: string, order: number, kind: Track['kind'], extra: Partial<Track> = {}): Track => ({
  id,
  order,
  kind,
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: 'visual' },
  ...extra,
});

function sequence(items: Sequence['items'], tracks: Track[] = []): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps,
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks,
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  };
}

type W = [id: string, start: number, end: number, text: string, speaker?: string];

/** Words already on the sequence (the same effect instance). */
function placed(list: W[], extra: Partial<PlacedWord>[] = []): PlacedWord[] {
  return list.map(([id, start, end, text, speaker], i) => ({
    id,
    start,
    end,
    text,
    ...(speaker ? { speaker } : {}),
    paragraphStart: false,
    key: `v:${id}`,
    scopeItemId: 'v',
    ...extra[i],
  }));
}

/** A run of words whose times join end to end, with no gap. */
function contiguous(tokens: string[], step: number, prefix = 'w'): PlacedWord[] {
  return placed(tokens.map((text, i): W => [`${prefix}${i}`, i * step, (i + 1) * step, text]));
}

/** Chinese is split per character, with punctuation attached to the character before it (the cue.rs fixtures are split this way). */
function cjkTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const char of text) {
    if (/[。，！？、；：]/.test(char) && tokens.length) tokens[tokens.length - 1] += char;
    else tokens.push(char);
  }
  return tokens;
}

/** Transcript text: seconds written on a millisecond scale. */
function speechBody(list: Array<W | [string, number, number, string, string | undefined, { hidden?: boolean; timingQuality?: string }]>, more: Record<string, unknown> = {}) {
  return {
    schema: 'cuccut.speech/1',
    clock: 'source-asset',
    timescale: 1000,
    speakers: [
      { id: 'S1', name: '主持人' },
      { id: 'S2', name: '嘉宾' },
    ],
    words: list.map(([id, start, end, text, speaker, flags]) => ({
      id,
      start: Math.round(start * 1000),
      end: Math.round(end * 1000),
      text,
      ...(speaker ? { speaker } : {}),
      ...(flags ?? {}),
    })),
    sentences: null,
    ...more,
  };
}

const texts = (cues: { text: string }[]) => cues.map((cue) => cue.text);

describe('character rules (match the remote export, except Hangul spaces)', () => {
  it('full-width characters count as 2; a space goes between Western words, none before full-width characters or punctuation; a word with a leading space is joined as is', () => {
    expect(displayWidth('ab中文')).toBe(6);
    expect(joinWords(['Hello', ',', 'world'], false)).toBe('Hello, world');
    expect(joinWords(['我', '用', 'CucCut', '剪', '。'], false)).toBe('我用CucCut剪。');
    expect(joinWords([' Hello', ' world.'], true)).toBe('Hello world.');
    // Korean words are separated by spaces; those next to Chinese characters are not.
    expect(joinWords(['안녕하세요', '여러분', '.'], false)).toBe('안녕하세요 여러분.');
    expect(joinWords(['한국', 'iPhone', '中文'], false)).toBe('한국 iPhone中文');
  });

  it('sentence-end and clause punctuation follow cue.rs: abbreviations and dotted word stems do not end a sentence; at most one closing quote is skipped', () => {
    expect(sentenceEnd('ready.')).toBe(true);
    expect(sentenceEnd('好。')).toBe(true);
    expect(sentenceEnd('done."')).toBe(true);
    expect(sentenceEnd('2.14')).toBe(false);
    expect(sentenceEnd('agents.md')).toBe(false);
    expect(sentenceEnd('Dr.')).toBe(false);
    expect(sentenceEnd('e.g.')).toBe(false);
    expect(sentenceEnd('hello,')).toBe(false);
    expect(clauseEndChar('hello,')).toBe(',');
    expect(clauseEndChar('wait—')).toBe('—');
    expect(clauseEndChar('said,"')).toBe(',');
    expect(clauseEndChar('plain')).toBeNull();
  });
});

describe('cue splitting (cue.rs fixtures)', () => {
  it('a Western line is exactly 42 cells wide', () => {
    const words = placed([
      ['w0', 0, 1, 'abcdefghijklmnopqrst'],
      ['w1', 1, 2, 'abcdefghijklmnopqrstu'],
      ['w2', 2, 3, 'ABCDEFGHIJKLMNOPQRST'],
      ['w3', 3, 4, 'ABCDEFGHIJKLMNOPQRST'],
      ['w4', 4, 5, 'x'],
    ]);
    const cues = deriveCues(words);
    expect(cues.map((cue) => [cue.id, cue.start, cue.end, cue.text])).toEqual([
      ['q-w0', 0, 2, 'abcdefghijklmnopqrst abcdefghijklmnopqrstu'],
      ['q-w2', 2, 4, 'ABCDEFGHIJKLMNOPQRST ABCDEFGHIJKLMNOPQRST'],
      ['q-w4', 4, 5, 'x'],
    ]);
  });

  it('CJK characters count as double width with no spaces: 21 characters per cue, the 22nd starts a new one', () => {
    const cues = deriveCues(contiguous([...'字幕系统需要在中文字符之间保持自然换行规则稳'], 0.1, 'c'));
    expect(cues.map((cue) => [cue.id, cue.text])).toEqual([
      ['q-c0', '字幕系统需要在中文字符之间保持自然换行规则'],
      ['q-c21', '稳'],
    ]);
    expect(cues[0]!.end).toBeCloseTo(2.1);
  });

  it('a period ends a short sentence without swallowing the next one', () => {
    const cues = deriveCues(contiguous('take their job. Maybe they use a new tool.'.split(' '), 0.5));
    expect(texts(cues)).toEqual(['take their job.', 'Maybe they use a new tool.']);
  });

  it('a Chinese full stop breaks the cue', () => {
    const cues = deriveCues(contiguous(cjkTokens('今天我们来聊一聊这个产品的设计。然后再看看它的实现细节究竟如何。'), 0.2));
    expect(cues).toHaveLength(2);
    expect(cues[0]!.text.endsWith('。')).toBe(true);
  });

  it('a speaker change always breaks the cue', () => {
    const cues = deriveCues(
      placed([
        ['w0', 0, 1, '你好', 'A'],
        ['w1', 1, 2, '再见', 'B'],
      ]),
    );
    expect(cues.map((cue) => [cue.text, cue.speaker])).toEqual([
      ['你好', 'A'],
      ['再见', 'B'],
    ]);
  });

  it('clause punctuation: a comma needs a line width of at least 12, a dash at least 6', () => {
    expect(texts(deriveCues(contiguous(['Hello,', 'I', 'am', 'here'], 0.3)))).toEqual(['Hello, I am here']);
    expect(texts(deriveCues(contiguous(['This', 'is', 'a', 'long', 'clause,', 'and', 'more'], 0.3)))).toEqual([
      'This is a long clause,',
      'and more',
    ]);
    expect(texts(deriveCues(contiguous(['wait—', 'no'], 0.3)))).toEqual(['wait— no']);
    expect(texts(deriveCues(contiguous(['Stop', 'it—', 'now'], 0.3)))).toEqual(['Stop it—', 'now']);
  });

  it('pause: breaks only after 0.6 s or more with a line width of at least 20; over 1 s always breaks (remote sentence-split rule)', () => {
    const long = placed([
      ['w0', 0, 1, 'abcdefghij'],
      ['w1', 1, 2, 'klmnopqrst'],
      ['w2', 2.7, 3, 'next'],
    ]);
    expect(texts(deriveCues(long))).toEqual(['abcdefghij klmnopqrst', 'next']);
    const short = placed([
      ['w0', 0, 1, 'short'],
      ['w1', 1.7, 2, 'next'],
    ]);
    expect(texts(deriveCues(short))).toEqual(['short next']);
    const gap = placed([
      ['w0', 0, 1, 'Hi'],
      ['w1', 2.5, 3, 'there'],
    ]);
    expect(texts(deriveCues(gap))).toEqual(['Hi', 'there']);
  });

  it('overflow: the next word is taken in when it ends on punctuation and the total width stays within 50', () => {
    const head = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmn'; // 40
    expect(texts(deriveCues(contiguous([head, 'opq,', 'rest'], 0.3)))).toEqual([`${head} opq,`, 'rest']);
    expect(texts(deriveCues(contiguous([head, 'opqr', 'rest'], 0.3)))).toEqual([head, 'opqr rest']);
  });

  it('a cue lasts no more than 7 seconds (remote export limit)', () => {
    const cues = deriveCues(contiguous(Array.from({ length: 10 }, () => 'a'), 1));
    expect(cues.map((cue) => [cue.start, cue.end])).toEqual([
      [0, 7],
      [7, 10],
    ]);
  });

  it('words with a leading space: joining and line width as is', () => {
    const cues = deriveCues(contiguous([' Hello', ' world.', ' Next'], 0.3));
    expect(texts(cues)).toEqual(['Hello world.', 'Next']);
  });
});

describe('reading transcription', () => {
  const one = sequence([video('v', 0, 300, 0)]);

  it('hidden words stay out of subtitles (cue.rs contract)', () => {
    const body = speechBody([
      ['w0', 0, 0.2, 'Um', undefined, { hidden: true }],
      ['w1', 0.2, 0.7, 'Hello'],
      ['w2', 0.7, 0.9, 'secret', undefined, { hidden: true }],
      ['w3', 0.9, 1.4, 'world.'],
    ]);
    const words = readSpeechWords(body)!.words;
    const cues = deriveCues(projectSpeech(one, 'asset_a', words));
    expect(cues.map((cue) => [cue.id, cue.text, cue.wordIds])).toEqual([['q-w1', 'Hello world.', ['w1', 'w3']]]);
    expect(cues[0]!.start).toBeCloseTo(0.2);
    expect(cues[0]!.end).toBeCloseTo(1.4);
  });

  it('all words hidden means no subtitles; a value that is not transcript body returns null', () => {
    const body = speechBody([
      ['w0', 0, 0.5, 'Hidden', undefined, { hidden: true }],
      ['w1', 0.5, 1, 'line.', undefined, { hidden: true }],
    ]);
    expect(deriveCues(projectSpeech(one, 'asset_a', readSpeechWords(body)!.words))).toEqual([]);
    expect(readSpeechWords({ schema: 'cuccut.caption/1', cues: [] })).toBeNull();
  });

  it('a segment without word timing: split on whitespace and punctuation, cut over-wide pieces by width, interpolate times by width; a dot inside a number does not break', () => {
    const pieces = splitUntimed('今天聊产品设计，然后看实现。接着讲 2.14 版', 10, 30, 42);
    expect(pieces.map((p) => p.text)).toEqual(['今天聊产品设计，', '然后看实现。', '接着讲', '2.14', '版']);
    expect(pieces[0]!.start).toBe(10);
    expect(pieces.at(-1)!.end).toBe(30);
    pieces.slice(1).forEach((p, i) => expect(p.start).toBeCloseTo(pieces[i]!.end));
    expect(pieces[0]!.end - pieces[0]!.start).toBeCloseTo((20 * 16) / 40);

    const wide = splitUntimed('一二三四五六七八九十一二三四五六七八九十一二三四五', 0, 5, 20);
    expect(wide.map((p) => p.text)).toEqual(['一二三四五六七八', '九十一二三四五六', '七八九十一二三四五']);
    expect(splitUntimed('好', 0, 1, 42)).toEqual([{ text: '好', start: 0, end: 1 }]);

    // Split when read in: the IDs get ~2 and ~3 in turn; the segment start is marked only on the first piece.
    const body = speechBody([
      ['w1', 0, 8, 'Hello there. This is a long untimed segment, with many words', undefined, { timingQuality: 'missing' }],
      ['w2', 8, 8.5, 'Done.'],
    ]);
    const words = readSpeechWords(body)!.words;
    expect(words.slice(0, 3).map((w) => [w.id, w.text])).toEqual([
      ['w1', 'Hello'],
      ['w1~2', 'there.'],
      ['w1~3', 'This'],
    ]);
    const cues = deriveCues(projectSpeech(one, 'asset_a', words));
    expect(cues.map((cue) => cue.text)).toEqual(['Hello there.', 'This is a long untimed segment,', 'with many words Done.']);
    expect(cues.every((cue) => cue.end - cue.start <= 7)).toBe(true);
  });

  it('zero-length words are kept: when a gap follows, they take a short slice (at most 0.08 s); words directly before the next word merge into their neighbour', () => {
    const long = sequence([video('v', 0, 600, 0)]);
    // Real sample: the aligner resolved the start and end of “ask—you” to the same cell, and a 0.24-second gap follows.
    const gap = readSpeechWords(
      speechBody([
        ['w1', 14.716, 14.956, 'just'],
        ['w2', 14.956, 14.956, 'ask—you'],
        ['w3', 15.196, 15.436, 'know,'],
      ]),
    )!.words;
    expect(gap.map((w) => [w.id, w.text])).toEqual([
      ['w1', 'just'],
      ['w2', 'ask—you'],
      ['w3', 'know,'],
    ]);
    expect(gap[1]!.start).toBeCloseTo(14.956);
    expect(gap[1]!.end).toBeCloseTo(15.036);
    const cues = deriveCues(projectSpeech(long, 'asset_a', gap));
    expect(cues.map((cue) => [cue.text, cue.wordIds])).toEqual([['just ask—you know,', ['w1', 'w2', 'w3']]]);

    // No gap: if there is a word before, the text attaches to the previous word; if there is no word yet, it attaches to the front of the next word. Hidden words' times still count as gap boundaries (w4 starts at 1.3).
    const merged = readSpeechWords(
      speechBody([
        ['w1', 1, 1, 'to'],
        ['w2', 1, 1.3, 'be'],
        ['w3', 1.3, 1.3, 'frank,'],
        ['w4', 1.3, 1.5, 'um', undefined, { hidden: true }],
        ['w5', 1.5, 1.8, 'yes.'],
      ]),
    )!.words;
    expect(merged.map((w) => [w.id, w.text, w.start, w.end])).toEqual([
      ['w2', 'to be frank,', 1, 1.3],
      ['w5', 'yes.', 1.5, 1.8],
    ]);
    // A zero-duration word at the end of a line gets a nominal duration.
    const tail = readSpeechWords(
      speechBody([
        ['w1', 0, 0.5, 'Hi'],
        ['w2', 0.5, 0.5, 'there.'],
      ]),
    )!.words;
    expect(tail[1]!.end).toBeCloseTo(0.58);
  });

  it('with stored sentences, break by sentence: "Dr." inside a sentence does not break, a sentence change breaks, the segment start is set on the sentence\'s first member', () => {
    const list: W[] = [
      ['w0', 0, 0.3, 'Dr.'],
      ['w1', 0.3, 0.6, 'Smith'],
      ['w2', 0.6, 0.9, 'arrived'],
      ['w3', 0.9, 1.2, 'ok'],
      ['w4', 1.2, 1.5, 'fine'],
    ];
    const body = speechBody(list, {
      sentences: [
        { id: 's1', wordIds: ['w0', 'w1', 'w2'] },
        { id: 's2', first: 'w3', last: 'w4', paragraphStart: true },
      ],
    });
    const read = readSpeechWords(body)!;
    expect(read.words.map((word) => [word.sentenceId, word.paragraphStart])).toEqual([
      ['s1', false],
      ['s1', false],
      ['s1', false],
      ['s2', true],
      ['s2', false],
    ]);
    expect(texts(deriveCues(projectSpeech(one, 'asset_a', read.words)))).toEqual(['Dr. Smith arrived', 'ok fine']);
    // When no sentences are stored, split with the remote's sentence-end regex (“Dr.” counts too), consistent with the export.
    const bare = readSpeechWords(speechBody(list))!;
    expect(texts(deriveCues(projectSpeech(one, 'asset_a', bare.words)))).toEqual(['Dr.', 'Smith arrived ok fine']);
  });
});

describe('project onto the sequence (text_plan.rs asset-items)', () => {
  const words = readSpeechWords(
    speechBody([
      ['w0', 4.5, 4.9, 'before'],
      ['w1', 5.2, 5.6, 'inside'],
      ['w2', 6.8, 7.2, 'edge'],
      ['w3', 7.5, 8, 'after'],
    ]),
  )!.words;

  it('remapped by in point and trim: items outside the range are dropped, items crossing the out point are cut to the range', () => {
    // The instance is placed at 1–3 seconds, taking source 5–7 seconds.
    const out = projectSpeech(sequence([video('v', 30, 60, 5)]), 'asset_a', words);
    expect(out.map((word) => word.id)).toEqual(['w1', 'w2']);
    expect(out[0]!.start).toBeCloseTo(1.2);
    expect(out[0]!.end).toBeCloseTo(1.6);
    expect(out[1]!.start).toBeCloseTo(2.8);
    expect(out[1]!.end).toBeCloseTo(3);
  });

  it('speed change: source time divided by speed', () => {
    const out = projectSpeech(sequence([video('v', 0, 60, 4, 2)]), 'asset_a', words);
    // Source 4–8 seconds is compressed into 0–2 seconds.
    expect(out.map((word) => [word.id, +word.start.toFixed(3), +word.end.toFixed(3)])).toEqual([
      ['w0', 0.25, 0.45],
      ['w1', 0.6, 0.8],
      ['w2', 1.4, 1.6],
      ['w3', 1.75, 2],
    ]);
  });

  it('freeze frames, other media and images are not projected', () => {
    const hold: VideoItem = { ...video('h', 0, 300, 0), timeMap: { kind: 'hold', sourceAt: { ticks: '0', timescale: 1 } } };
    expect(projectSpeech(sequence([hold, video('o', 0, 300, 0, 1, 'asset_b')]), 'asset_a', words)).toEqual([]);
  });

  it('same media placed twice: projected at both places with different keys and a stable order; subtitles on the media clock are cut as one cue', () => {
    const one = readSpeechWords(speechBody([['w-000001', 0.2, 0.5, 'Hi.']]))!.words;
    const seq = sequence([video('v2', 60, 30, 0), video('v1', 0, 30, 0)]);
    const out = projectSpeech(seq, 'asset_a', one);
    expect(out.map((word) => [word.key, +word.start.toFixed(3)])).toEqual([
      ['v1:w-000001', 0.2],
      ['v2:w-000001', 2.2],
    ]);
    expect(projectSpeech(seq, 'asset_a', one)).toEqual(out);
    expect(deriveCues(one).map((cue) => [cue.id, cue.start])).toEqual([['q-w-000001', 0.2]]);
  });

  it('linked audio and video overlap: the later one takes only the uncovered span, no duplicates', () => {
    const out = projectSpeech(sequence([audio('b-audio', 0, 10), video('a-video', 0, 300, 0)]), 'asset_a', words);
    expect(out.map((word) => word.key)).toEqual(['a-video:w0', 'a-video:w1', 'a-video:w2', 'a-video:w3']);
  });
});

describe('written as a subtitle document', () => {
  const cues = [
    { id: 'q-w0', start: 0.2, end: 1.5, text: '你好', speaker: 'S1', wordIds: ['w0', 'w0b'] },
    { id: 'q-w1', start: 1.4, end: 2.0004, text: '再见', speaker: 'S2', wordIds: ['w1'] },
  ];
  const speakers = new Map([
    ['S1', '主持人'],
    ['S2', '嘉宾'],
  ]);

  it('media clock in milliseconds; a cue does not run into the next one; speaker names are written only with two or more speakers; each cue points from the first to the last transcript word', () => {
    expect(speechCaptionBody(cues, speakers)).toEqual({
      schema: 'cuccut.caption/1',
      clock: 'source-asset',
      timescale: 1000,
      cues: [
        { id: 'q-w0', start: 200, end: 1400, text: '你好', speaker: '主持人', words: { first: 'w0', last: 'w0b' } },
        { id: 'q-w1', start: 1400, end: 2000, text: '再见', speaker: '嘉宾', words: { first: 'w1', last: 'w1' } },
      ],
    });
    const single = speechCaptionBody(
      cues.map((cue) => ({ ...cue, speaker: 'S1' })),
      speakers,
    );
    expect((single.cues as object[]).every((cue) => !('speaker' in cue))).toBe(true);
  });

  it('rounding collision: the end is at least 1 ms after the start, and the next start is pushed to this cue\'s end (remote quantize)', () => {
    const same = [
      { id: 'a', start: 1.0001, end: 1.0002, text: '一', wordIds: ['a'] },
      { id: 'b', start: 1.0003, end: 1.0004, text: '二', wordIds: ['b'] },
      { id: 'c', start: 1.0004, end: 2, text: '三', wordIds: ['c'] },
    ];
    const out = speechCaptionBody(same, new Map()).cues as Array<{ start: number; end: number }>;
    expect(out.map((cue) => [cue.start, cue.end])).toEqual([
      [1000, 1001],
      [1001, 1002],
      [1002, 2000],
    ]);
  });

  it('transaction: records the source transcript and version; with no target instance, the instance covers the first to the last cue; placed on an empty subtitle track if one exists', () => {
    const body = speechCaptionBody(cues, speakers);
    const source = { name: '访谈 字幕', language: 'zh', speechDocumentId: 'doc_s', speechRevision: '3', assetId: 'asset_a', trackName: '字幕' };
    const ops = speechCaptionOperations(sequence([], [track('s1', 1, 'subtitle')]), body, source);
    expect(ops.map((op) => op.type)).toEqual(['putDocument', 'insertItems']);
    expect(ops[0]).toMatchObject({
      kind: 'caption',
      name: '访谈 字幕',
      language: 'zh',
      sourceDocument: { documentId: 'doc_s' },
      summary: { cueCount: 2 },
      extensions: { 'cuccut.speechCues': { speechDocumentId: 'doc_s', speechRevision: '3', assetId: 'asset_a' } },
    });
    // 0.2 s → frame 6; 2.0 s → frame 60.
    expect(ops[1]).toMatchObject({ items: [{ type: 'caption', trackId: 's1', span: { fromFrame: 6, durationFrames: 54 } }] });
    const fresh = speechCaptionOperations(sequence([], [track('s0', 1, 'subtitle', { locked: true })]), body, source);
    expect(fresh[0]).toMatchObject({ type: 'addTrack', kind: 'subtitle', name: '字幕' });
    expect(fresh[2]).toMatchObject({ items: [{ trackRef: 'new-subtitle-track' }] });
  });

  it('transaction: the target instances are the instances that use this media (sorted by start), and the instance covers them; the document records the media', () => {
    const body = speechCaptionBody(cues, speakers);
    const source = { name: '访谈 字幕', speechDocumentId: 'doc_s', speechRevision: '3', assetId: 'asset_a', trackName: '字幕' };
    // Two segments: 3–5 seconds and 1–2 seconds; other assets do not count.
    const seq = sequence(
      [video('late', 90, 60, 10), video('early', 30, 30, 0), video('other', 0, 300, 0, 1, 'asset_b')],
      [track('s1', 1, 'subtitle')],
    );
    const ops = speechCaptionOperations(seq, body, source);
    expect(ops[0]).toMatchObject({ type: 'putDocument', sourceAsset: { assetId: 'asset_a' } });
    expect(ops[1]).toMatchObject({
      items: [{ type: 'caption', trackId: 's1', scopeItemIds: ['early', 'late'], span: { fromFrame: 30, durationFrames: 120 } }],
    });
  });
});

describe('sentence count', () => {
  it('terminal punctuation ends a sentence; abbreviations, decimals and URLs do not count; an unterminated last segment also counts as a sentence', () => {
    expect(countSentences(['今天聊设计。再看实现。'])).toBe(2);
    expect(countSentences(['Hello world, this is', 'a test. And more'])).toBe(2);
    expect(countSentences(['Dr. Smith is here.'])).toBe(1);
    expect(countSentences(['Pi is 3.14 exactly.'])).toBe(1);
    expect(countSentences(['e.g. this one.', 'Visit a.com now!'])).toBe(2);
    expect(countSentences(['你好？', '“好的。”'])).toBe(2);
    expect(countSentences(['', '……'])).toBe(0);
    expect(countSentences([])).toBe(0);
  });
});

describe('candidate filtering for projected transcription', () => {
  /** The way it was written before: each instance and each word projected pair by pair. */
  function projectAll(seq: Sequence, assetId: string, words: readonly SpeechWord[]): PlacedWord[] {
    const items = seq.items
      .filter((item) => (item.type === 'video' || item.type === 'audio') && item.assetRef.id === assetId)
      .map((item) => ({ item, bounds: itemRangeSeconds(item, seq.fps) }))
      .sort((a, b) => a.bounds.start - b.bounds.start || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
    const taken: Array<[number, number]> = [];
    const placed: PlacedWord[] = [];
    for (const { item, bounds } of items) {
      if ((item.type !== 'video' && item.type !== 'audio') || item.timeMap.kind !== 'linear') continue;
      const rate = item.timeMap.rate.num / item.timeMap.rate.den;
      const sourceIn = mediaTimeToSeconds(item.timeMap.sourceIn);
      if (bounds.end <= bounds.start) continue;
      let windows: Array<[number, number]> = [[bounds.start, bounds.end]];
      for (const [a, b] of taken) {
        windows = windows.flatMap(([x, y]): Array<[number, number]> => {
          if (b <= x || a >= y) return [[x, y]];
          const parts: Array<[number, number]> = [];
          if (a > x) parts.push([x, a]);
          if (b < y) parts.push([b, y]);
          return parts;
        });
      }
      taken.push([bounds.start, bounds.end]);
      for (const word of words) {
        const a = bounds.start + (word.start - sourceIn) / rate;
        const b = bounds.start + (word.end - sourceIn) / rate;
        let piece = 0;
        for (const [from, to] of windows) {
          const start = Math.max(a, from);
          const end = Math.min(b, to);
          if (end <= start) continue;
          piece++;
          const key = `${item.id}:${word.id}`;
          placed.push({ ...word, key: piece === 1 ? key : `${key}#${piece}`, scopeItemId: item.id, start, end });
        }
      }
    }
    return placed.sort((x, y) => x.start - y.start || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  }

  it('matches pairwise projection exactly: interleaved, speed-changed, repeated use of the same source span, long words across a cut point, duplicate IDs', () => {
    let seed = 11;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const items: Sequence['items'] = [];
    for (let k = 0; k < 120; k++) {
      const rate = [1, 2, 0.5, 1.5][next(4)]!;
      items.push(video(`c${k}`, next(9000), 1 + next(300), next(600000) / 1000, rate));
    }
    items.push(audio('dub', 300, 40), video('other', 0, 900, 0, 1, 'asset_b'));
    const words: SpeechWord[] = [];
    for (let k = 0; k < 3000; k++) {
      const start = k * 0.2 + next(100) / 1000;
      const length = k % 211 === 0 ? 30 : 0.05 + next(300) / 1000;
      words.push({ id: k % 97 === 0 ? 'dup' : `w${k}`, start, end: start + length, text: `t${k}`, paragraphStart: false });
    }
    const seq = sequence(items);
    const fast = projectSpeech(seq, 'asset_a', words);
    expect(fast.length).toBeGreaterThan(1000);
    expect(fast).toEqual(projectAll(seq, 'asset_a', words));
  });

  it('subtracting merged occupied spans matches pairwise subtraction: end-to-start adjacency, nesting, same span with different IDs, fully covered by earlier spans, ±0', () => {
    let seed = 23;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const words: SpeechWord[] = [];
    for (let k = 0; k < 3000; k++) {
      const start = k * 0.2 + next(100) / 1000;
      const length = k % 211 === 0 ? 30 : 0.05 + next(300) / 1000;
      words.push({ id: `w${k}`, start, end: start + length, text: `t${k}`, paragraphStart: false });
    }
    const spans: Array<[from: number, len: number]> = [];
    const items: Sequence['items'] = [];
    const add = (from: number, len: number, sourceIn = next(600000) / 1000, rate = [1, 2, 0.5, 1.5][next(4)]!) => {
      const k = items.length;
      spans.push([from, len]);
      items.push(video(`c${String(k).padStart(3, '0')}`, from, len, sourceIn, rate));
    };
    // On both sides of zero: the starts are -0 and 0 in two segments; the earlier segment ends at +0; a word that crosses 0 has its placed start at -0.
    const across = (Math.round(words[50]!.start * 1000) + 10) / 1000;
    add(-0, 40, across, 1);
    add(0, 25, across, 1);
    add(-30, 30);
    // The later instances are all no earlier than 0, so they do not cover the word that crosses 0.
    const grow = (from: number, len: number) => {
      if (from >= 0) add(from, len);
    };
    while (items.length < 480) {
      const pick = spans[next(spans.length)]!;
      const [from, len] = pick;
      switch (next(9)) {
        case 0: // Attached after the previous segment, or after any segment
          grow(next(2) ? spans.at(-1)![0] + spans.at(-1)![1] : from + len, 1 + next(200));
          break;
        case 1: // Nested inside an earlier segment
          if (len > 2) {
            const inner = 1 + next(len - 1);
            grow(from + next(len - inner + 1), inner);
          }
          break;
        case 2: // The same interval as an earlier segment
          grow(from, len);
          break;
        case 3: {
          // Two segments meet end to end, then another crosses the seam and is covered entirely by them
          const second = 2 + next(100);
          grow(from + len, second);
          grow(from + 1, len + second - 2);
          break;
        }
        case 4: // Overlaps the head or the tail of an earlier segment
          grow(from + len - 1 - next(len), 1 + next(150));
          break;
        default:
          grow(next(40000), 1 + next(300));
      }
    }
    const seq = sequence(items);
    const fast = projectSpeech(seq, 'asset_a', words);
    expect(fast.length).toBeGreaterThan(3000);
    expect(fast.some((word) => Object.is(word.start, -0))).toBe(true);
    expect(fast).toEqual(projectAll(seq, 'asset_a', words));
  });

  it('when occupied spans are not added in start order, the subtracted pieces still match pairwise subtraction (overlap, adjacency, nesting, out of order, ±0, NaN)', () => {
    const pairwise = (interval: [number, number], taken: ReadonlyArray<[number, number]>) => {
      let parts = [interval];
      for (const [a, b] of taken) {
        parts = parts.flatMap(([x, y]): Array<[number, number]> => {
          if (b <= x || a >= y) return [[x, y]];
          const kept: Array<[number, number]> = [];
          if (a > x) kept.push([x, a]);
          if (b < y) kept.push([b, y]);
          return kept;
        });
      }
      return parts;
    };
    // ±0: when subtracting pair by pair, equal endpoints keep the one that came in first. Intervals and probes are written as [start, end, start, end, …].
    const pairs = (flat: number[]) => Array.from({ length: flat.length / 2 }, (_, k): [number, number] => [flat[2 * k]!, flat[2 * k + 1]!]);
    const probes = pairs([-10, 10, -0, 10, 0, 10, -10, -0, -10, 0]);
    for (const flat of [
      [-0, 5, 0, 8, -4, -0, -2, 0],
      [0, 8, -0, 5, -2, 0, -4, -0],
      [-4, -0, 3, 6, -0, 1, 0, 2],
      [-2, -0, -4, 0, -0, 3],
    ]) {
      const list = pairs(flat);
      const taken = new TakenIntervals();
      for (const [index, [start, end]] of list.entries()) {
        taken.add(start, end);
        for (const probe of probes) expect(taken.subtract(...probe)).toEqual(pairwise(probe, list.slice(0, index + 1)));
      }
    }
    let seed = 5;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let round = 0; round < 60; round++) {
      const taken = new TakenIntervals();
      const raw: Array<[number, number]> = [];
      for (let step = 0; step < 80; step++) {
        let start: number;
        let end: number;
        const pick = raw.length ? raw[next(raw.length)]! : undefined;
        switch (pick ? next(6) : 5) {
          case 0: // Attached after or before a segment
            start = next(2) ? pick![1] : pick![0] - 1 - next(20);
            end = next(2) ? start + 1 + next(20) : pick![0];
            if (end <= start) end = start + 1;
            break;
          case 1: // Nested inside a segment, or the same interval as a segment
            start = pick![0] + (next(3) ? next(Math.max(1, pick![1] - pick![0])) : 0);
            end = Math.min(pick![1], start + 1 + next(10));
            if (end <= start) end = start + 1;
            break;
          case 2: // Covers a segment
            start = pick![0] - next(15);
            end = pick![1] + next(15);
            break;
          case 3: // Start is -0 or 0
            start = next(2) ? -0 : 0;
            end = start + 1 + next(30);
            break;
          case 4: // End is 0
            start = -1 - next(30);
            end = 0;
            break;
          default:
            start = next(400) - 100;
            end = start + 1 + next(40);
        }
        if (round % 10 === 9 && step === 60) end = NaN;
        const probe: [number, number] = next(3) ? [start, end] : [next(400) - 120, 0];
        if (!(probe[1] > probe[0])) probe[1] = probe[0] + 1 + next(50);
        expect(taken.subtract(...probe)).toEqual(pairwise(probe, raw));
        expect(taken.subtract(start, end)).toEqual(pairwise([start, end], raw));
        taken.add(start, end);
        raw.push([start, end]);
      }
    }
  });

  it('falls back to pairwise subtraction when a span endpoint is NaN', () => {
    const items: Sequence['items'] = [video('c0', 0, 300, 0), video('c1', 200, 300, 5)];
    // playDuration is not a number: the end of the interval is NaN.
    const broken = audio('c2', 400, 1);
    broken.playDuration = { ticks: 'x', timescale: 48000 };
    items.push(broken, video('c3', 600, 300, 10), video('c4', 300, 200, 20), video('c5', 1200, 60, 30));
    const words: SpeechWord[] = [];
    for (let k = 0; k < 400; k++) words.push({ id: `w${k}`, start: k * 0.1, end: k * 0.1 + 0.08, text: `t${k}`, paragraphStart: false });
    const seq = sequence(items);
    // The instance itself with a NaN endpoint: pair-by-pair projection makes every word NaN, and after filtering out words none is placed, so this does not compare against it.
    const usable = (list: PlacedWord[]) => list.filter((word) => word.scopeItemId !== 'c2');
    const fast = projectSpeech(seq, 'asset_a', words);
    // After an instance whose interval end is NaN, subtracting pair by pair leaves no window at all (the union would leave windows for them).
    expect(fast.some((word) => word.scopeItemId === 'c0')).toBe(true);
    expect(fast.some((word) => word.scopeItemId === 'c3')).toBe(false);
    expect(usable(fast)).toEqual(usable(projectAll(seq, 'asset_a', words)));
  });
});
