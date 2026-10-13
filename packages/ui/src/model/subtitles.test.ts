import { describe, expect, it } from 'vitest';
import { formatClock } from './format.ts';
import { SeekQueue } from './seek.ts';
import { activeCues, decodeSubtitleText, nearIndex, parseSubtitles, seekTimeOf, subtitleFormatOf } from './subtitles.ts';

describe('subtitle parsing', () => {
  it('SRT: CRLF, BOM, multi-line, tags; bad blocks are skipped; sorted by start time', () => {
    const srt = [
      '﻿1',
      '00:00:05,500 --> 00:00:07,000',
      '<i>第二句</i>',
      '',
      '2',
      '00:00:01,000 --> 00:00:03,250',
      '{\\an8}第一句',
      '第一句的第二行',
      '',
      '3',
      '这不是时间行',
      '跳过',
      '',
      '4',
      '01:02:03,4 --> 01:02:04,45',
      '很后面',
      '',
    ].join('\r\n');
    const cues = parseSubtitles(srt, 'srt');
    expect(cues).toEqual([
      { index: 1, start: 1, end: 3.25, text: '第一句\n第一句的第二行' },
      { index: 2, start: 5.5, end: 7, text: '第二句' },
      { index: 3, start: 3723.4, end: 3724.45, text: '很后面' },
    ]);
  });

  it('WebVTT: file header, NOTE, STYLE, identifier lines, settings, entities and speaker tags', () => {
    const vtt = [
      'WEBVTT - 标题',
      '',
      'NOTE 这是注释',
      '',
      'STYLE',
      '::cue { color: red }',
      '',
      'intro',
      '00:01.000 --> 00:02.500 align:start position:10%',
      '<v 主持人>大家好 &amp; 欢迎</v>',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'Tom &lt;3 <00:00:03.500>Jerry',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt, 'vtt')).toEqual([
      { index: 1, start: 1, end: 2.5, text: '大家好 & 欢迎' },
      { index: 2, start: 3, end: 4, text: 'Tom <3 Jerry' },
    ]);
  });

  it('ASS: columns read by Format, commas in text kept, override tags removed, Comment lines skipped', () => {
    const ass = [
      '[Script Info]',
      'Title: x',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname',
      'Style: Default,Arial',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.50,0:00:02.00,Default,,0,0,0,,{\\b1}你好，世界, 再见{\\b0}\\N第二行',
      'Comment: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,注释',
      'Dialogue: 0,0:00:00.00,0:00:00.80,Default,,0,0,0,,开头\\h了',
    ].join('\n');
    expect(parseSubtitles(ass, 'ass')).toEqual([
      { index: 1, start: 0, end: 0.8, text: '开头 了' },
      { index: 2, start: 1.5, end: 2, text: '你好，世界, 再见\n第二行' },
    ]);
  });

  it('encodings: UTF-8 (with or without BOM), GBK, UTF-16', () => {
    const text = '1\n00:00:01,000 --> 00:00:02,000\n你好\n';
    expect(decodeSubtitleText(new TextEncoder().encode(text))).toBe(text);
    expect(decodeSubtitleText(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('你好')]))).toBe('你好');
    // GBK encoding of “hello”.
    expect(decodeSubtitleText(new Uint8Array([0xc4, 0xe3, 0xba, 0xc3]))).toBe('你好');
    expect(decodeSubtitleText(new Uint8Array([0xff, 0xfe, 0x60, 0x4f, 0x7d, 0x59]))).toBe('你好');
  });

  it('format is detected by file extension; cues whose end is not after start, and cues without text, are dropped', () => {
    expect(subtitleFormatOf('a.SRT')).toBe('srt');
    expect(subtitleFormatOf('a.zh.vtt')).toBe('vtt');
    expect(subtitleFormatOf('a.ssa')).toBe('ass');
    expect(subtitleFormatOf('a.txt')).toBeNull();
    expect(parseSubtitles('1\n00:00:02,000 --> 00:00:01,000\n倒着\n\n2\n00:00:03,000 --> 00:00:04,000\n\n', 'srt')).toEqual([]);
  });

  it('current cue: all overlapping cues count, but not at the exact end moment; clicking a cue seeks to just after its start', () => {
    const cues = parseSubtitles(
      ['1', '00:00:00,000 --> 00:00:10,000', '长句', '', '2', '00:00:02,000 --> 00:00:03,000', '短句', ''].join('\n'),
      'srt',
    );
    expect(activeCues(cues, 2.5).map((c) => c.text)).toEqual(['长句', '短句']);
    expect(activeCues(cues, 3).map((c) => c.text)).toEqual(['长句']);
    expect(activeCues(cues, 10)).toEqual([]);
    expect(seekTimeOf(cues[1]!)).toBeCloseTo(2.001);
    expect(activeCues(cues, seekTimeOf(cues[1]!)).map((c) => c.index)).toContain(2);
  });

  it('list docking: the current cue; in a gap, the next cue; past the end, the last cue', () => {
    const cues = parseSubtitles(
      ['1', '00:00:01,000 --> 00:00:02,000', '一', '', '2', '00:00:04,000 --> 00:00:05,000', '二', ''].join('\n'),
      'srt',
    );
    expect(nearIndex([], 1)).toBeNull();
    expect(nearIndex(cues, 0)).toBe(1);
    expect(nearIndex(cues, 1.5)).toBe(1);
    expect(nearIndex(cues, 3)).toBe(2);
    expect(nearIndex(cues, 4.5)).toBe(2);
    expect(nearIndex(cues, 99)).toBe(2);
  });
});

describe('seek queue', () => {
  it('only one seek is sent at a time; during dragging only the latest request is kept; media time is handed back only after all seeks land', () => {
    const media = { currentTime: 0 };
    const queue = new SeekQueue(media);
    expect(queue.target).toBeNull();

    queue.request(10);
    expect(media.currentTime).toBe(10);
    queue.request(20);
    queue.request(30);
    // The first seek has not finished yet: do not interrupt it, show the latest request.
    expect(media.currentTime).toBe(10);
    expect(queue.target).toBe(30);

    // 10 lands: drop the 20 in between and send 30 directly.
    expect(queue.settle()).toBe(false);
    expect(media.currentTime).toBe(30);
    expect(queue.target).toBe(30);

    expect(queue.settle()).toBe(true);
    expect(queue.target).toBeNull();
    // A seeked event we did not initiate does not affect the state.
    expect(queue.settle()).toBe(true);
  });

  it('reset drops in-flight and queued requests', () => {
    const queue = new SeekQueue({ currentTime: 0 });
    queue.request(1);
    queue.request(2);
    queue.reset();
    expect(queue.target).toBeNull();
    expect(queue.settle()).toBe(true);
  });
});

describe('time display', () => {
  it('truncates down, not showing times not yet reached', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7.99)).toBe('0:07');
    expect(formatClock(65.3, { tenths: true })).toBe('1:05.3');
    expect(formatClock(2.3, { tenths: true })).toBe('0:02.3');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(5, { hours: true })).toBe('0:00:05');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-1)).toBe('0:00');
  });
});
