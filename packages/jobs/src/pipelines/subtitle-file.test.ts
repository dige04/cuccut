import { describe, expect, it } from 'vitest';
import {
  MAX_SUBTITLE_BYTES,
  MAX_SUBTITLE_CUES,
  SubtitleFileError,
  clock,
  cueText,
  decodeSubtitleBytes,
  parseSubtitles,
  plainLines,
  readSubtitleBytes,
  renderSubtitles,
  translationLines,
  type SubtitleDocument,
} from './subtitle-file.ts';

const SRT = [
  '1',
  '00:00:01,000 --> 00:00:02,500',
  'Hello <i>there</i>,',
  'my friend.',
  '',
  '2',
  '00:00:03,000 --> 00:00:04,000',
  '{\\an8}Up top',
  '',
  '3',
  '00:00:05,000 --> 00:00:05,000',
  '',
  '4',
  '01:02:03,456 --> 01:02:04,000',
  'Last line',
  '',
].join('\n');

const VTT = [
  'WEBVTT - demo',
  'Kind: captions',
  '',
  'STYLE',
  '::cue { color: yellow }',
  '',
  'NOTE written by hand',
  '',
  'intro',
  '00:01.000 --> 00:02.000 align:start position:10%',
  '<v Alice>Hi &amp; welcome</v>',
  '',
  '00:00:03.000 --> 00:00:04.250',
  '<c.loud>Two</c>',
  'lines',
  '',
  'NOTE trailing',
  '',
].join('\n');

function texts(doc: SubtitleDocument, fn: (lines: string[], i: number) => string[]): string[][] {
  return doc.cues.map((cue, i) => fn(plainLines(cue, doc.format).lines, i));
}

function invalidOf(source: string, format: 'srt' | 'vtt'): SubtitleFileError {
  try {
    parseSubtitles(source, format);
  } catch (error) {
    if (error instanceof SubtitleFileError) return error;
    throw error;
  }
  throw new Error('应当拒绝');
}

describe('strict subtitle file parsing', () => {
  it('SRT: index, timing, multi-line text and empty cues are read as is', () => {
    const doc = parseSubtitles(SRT, 'srt');
    expect(doc.cues.map((c) => [c.id, c.startMs, c.endMs, c.lines.length])).toEqual([
      ['1', 1000, 2500, 2],
      ['2', 3000, 4000, 1],
      ['3', 5000, 5000, 0],
      ['4', 3_723_456, 3_724_000, 1],
    ]);
    expect(doc.cues[0]!.line).toBe(2);
  });

  it('BOM and CRLF: same result as LF', () => {
    const crlf = `﻿${SRT.replace(/\n/g, '\r\n')}`;
    expect(parseSubtitles(crlf, 'srt')).toEqual(parseSubtitles(SRT, 'srt'));
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(SRT.replace(/\n/g, '\r\n'))]);
    expect(readSubtitleBytes(bytes, 'srt').cues).toHaveLength(4);
  });

  it('decoding: UTF-16 BOM; when not UTF-8, decoded as GB18030', () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(SRT, 'utf16le')]);
    expect(decodeSubtitleBytes(utf16).replace(/^﻿/, '')).toBe(SRT);
    // GBK encoding of “你好”
    expect(decodeSubtitleBytes(Buffer.from([0xc4, 0xe3, 0xba, 0xc3]))).toBe('你好');
  });

  it('VTT: header, identifiers, cue settings, STYLE and NOTE blocks', () => {
    const doc = parseSubtitles(VTT, 'vtt');
    expect(doc.header).toBe('WEBVTT - demo\nKind: captions');
    expect(doc.cues.map((c) => [c.id, c.startMs, c.endMs, c.settings])).toEqual([
      ['intro', 1000, 2000, 'align:start position:10%'],
      [null, 3000, 4250, ''],
    ]);
    expect(doc.blocks).toEqual([
      { before: 0, text: 'STYLE\n::cue { color: yellow }' },
      { before: 0, text: 'NOTE written by hand' },
      { before: 2, text: 'NOTE trailing' },
    ]);
  });

  it('inline markup: stripped before sending to the model, and the presence of markup is recorded', () => {
    const srt = parseSubtitles(SRT, 'srt');
    expect(plainLines(srt.cues[0]!, 'srt')).toEqual({ lines: ['Hello there,', 'my friend.'], marked: true });
    expect(plainLines(srt.cues[1]!, 'srt')).toEqual({ lines: ['Up top'], marked: true });
    expect(plainLines(srt.cues[3]!, 'srt')).toEqual({ lines: ['Last line'], marked: false });
    const vtt = parseSubtitles(VTT, 'vtt');
    expect(plainLines(vtt.cues[0]!, 'vtt')).toEqual({ lines: ['Hi & welcome'], marked: true });
    expect(cueText(['Hello there,', 'my friend.'])).toBe('Hello there, my friend.');
    expect(cueText(['你好，', '朋友'])).toBe('你好，朋友');
    // Keep angle brackets in SRT that are not tags
    expect(plainLines({ ...srt.cues[3]!, lines: ['a < b > c'] }, 'srt').lines).toEqual(['a < b > c']);
  });

  it.each([
    ['有文本却没有时间行', '1\n00:00:01,000 --> 00:00:02,000\nA\n\nstray text\n', 5],
    ['两条之间少了空行', '1\n00:00:01,000 --> 00:00:02,000\nA\n2\n00:00:03,000 --> 00:00:04,000\nB\n', 5],
    ['毫秒不是三位', '1\n00:00:01,5 --> 00:00:02,000\nA\n', 2],
    ['结束早于开始', '1\n00:00:03,000 --> 00:00:02,000\nA\n', 2],
    ['秒越界', '1\n00:00:61,000 --> 00:01:02,000\nA\n', 2],
    ['序号不是数字', 'one\n00:00:01,000 --> 00:00:02,000\nA\n', 1],
    ['没有字幕', '\n\n', 1],
  ])('SRT rejection: %s', (_, source, line) => {
    const error = invalidOf(source, 'srt');
    expect(error.code).toBe('SUBTITLE_FILE_INVALID');
    expect(error.details.line).toBe(line);
  });

  it.each([
    ['没有 WEBVTT', '00:01.000 --> 00:02.000\nA\n'],
    ['头部之后没空行', 'WEBVTT\n00:01.000 --> 00:02.000\nA\n'],
    ['逗号的毫秒', 'WEBVTT\n\n00:00:01,000 --> 00:00:02,000\nA\n'],
  ])('VTT rejection: %s', (_, source) => {
    expect(invalidOf(source, 'vtt').code).toBe('SUBTITLE_FILE_INVALID');
  });

  it('limits: size and cue count', () => {
    const big = Buffer.alloc(MAX_SUBTITLE_BYTES + 1, 0x41);
    expect(() => readSubtitleBytes(big, 'srt')).toThrow(expect.objectContaining({ code: 'SUBTITLE_FILE_TOO_LARGE' }));
    const many = Array.from({ length: MAX_SUBTITLE_CUES + 1 }, (_, i) => `${clock(i * 10, 'srt')} --> ${clock(i * 10 + 5, 'srt')}\nx`);
    expect(invalidOf(many.join('\n\n'), 'srt').code).toBe('SUBTITLE_FILE_TOO_LARGE');
  });
});

describe('writing subtitle files', () => {
  it('SRT round-trip as is: indices and timing lines copied verbatim, line endings normalized to LF', () => {
    const doc = parseSubtitles(SRT, 'srt');
    const out = renderSubtitles(
      doc,
      texts(doc, (lines) => lines),
      'srt',
    );
    const back = parseSubtitles(out.text, 'srt');
    expect(back.cues.map((c) => [c.id, c.timing])).toEqual(doc.cues.map((c) => [c.id, c.timing]));
    expect(out.text).not.toContain('\r');
    expect(out.text.startsWith('1\n00:00:01,000 --> 00:00:02,500\nHello there,\nmy friend.\n\n')).toBe(true);
  });

  it('VTT round-trip as is: header, cue settings, identifiers and NOTE blocks stay in place; text escaping', () => {
    const doc = parseSubtitles(VTT, 'vtt');
    const out = renderSubtitles(
      doc,
      texts(doc, (lines) => lines.map((l) => `${l} <ok>`)),
      'vtt',
    );
    expect(out.text).toBe(
      [
        'WEBVTT - demo',
        'Kind: captions',
        '',
        'STYLE',
        '::cue { color: yellow }',
        '',
        'NOTE written by hand',
        '',
        'intro',
        '00:01.000 --> 00:02.000 align:start position:10%',
        'Hi &amp; welcome &lt;ok&gt;',
        '',
        '00:00:03.000 --> 00:00:04.250',
        'Two &lt;ok&gt;',
        'lines &lt;ok&gt;',
        '',
        'NOTE trailing',
        '',
      ].join('\n'),
    );
    expect(parseSubtitles(out.text, 'vtt').cues.map((c) => c.timing)).toEqual(doc.cues.map((c) => c.timing));
  });

  it('SRT to VTT: timecodes rewritten in milliseconds', () => {
    const doc = parseSubtitles(SRT, 'srt');
    const out = renderSubtitles(
      doc,
      texts(doc, (lines) => lines),
      'vtt',
    );
    const back = parseSubtitles(out.text, 'vtt');
    expect(back.cues.map((c) => [c.startMs, c.endMs])).toEqual(doc.cues.map((c) => [c.startMs, c.endMs]));
    expect(back.cues[3]!.timing).toBe('01:02:03.456 --> 01:02:04.000');
  });

  it('VTT to SRT: drops blocks such as cue settings and NOTE and counts them, renumbers in order', () => {
    const doc = parseSubtitles(VTT, 'vtt');
    const out = renderSubtitles(
      doc,
      texts(doc, (lines) => lines),
      'srt',
    );
    expect(out.droppedSettings).toBe(1);
    expect(out.droppedBlocks).toBe(3);
    const back = parseSubtitles(out.text, 'srt');
    expect(back.cues.map((c) => [c.id, c.timing])).toEqual([
      ['1', '00:00:01,000 --> 00:00:02,000'],
      ['2', '00:00:03,000 --> 00:00:04,250'],
    ]);
  });

  it('translation tidying: splits lines, removes empty lines, `-->` replaced with an arrow', () => {
    expect(translationLines('  第一行 \r\n\n第二行 --> 继续\n')).toEqual(['第一行', '第二行 → 继续']);
  });
});
