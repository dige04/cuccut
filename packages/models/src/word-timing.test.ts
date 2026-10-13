import { describe, expect, it } from 'vitest';
import type { Segment } from './worker-contract.ts';
import { estimateWords, fixWordTimes, secondsToTicks, splitIntoWordPairs } from './word-timing.ts';

/** The same cases as the tests for `word_timing.rs` and `text_prep.rs` on the Rust side, plus the edge cases on the TS side. */

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('estimateWords', () => {
  it('interpolates by character length, punctuation attaches to the previous word, the last word ends at the segment end', () => {
    const words = estimateWords('ab abcd, ab', 'en', 1.0, 2.6);
    expect(words.map((w) => w.text)).toEqual(['ab', 'abcd,', 'ab']);
    expect(close(words[0]!.start, 1.0) && close(words[0]!.end, 1.4)).toBe(true);
    expect(close(words[1]!.start, 1.4) && close(words[1]!.end, 2.2)).toBe(true);
    expect(words[2]).toEqual({ text: 'ab', start: words[1]!.end, end: 2.6 });
  });

  it('Chinese characters form words one by one, sentence-final punctuation attaches to the last character', () => {
    const words = estimateWords('你好。', 'zh', 0, 1);
    expect(words.map((w) => w.text)).toEqual(['你', '好。']);
    expect(words[1]!.end).toBe(1);
  });

  it('degenerate input: whitespace has no words; when only punctuation, the whole segment counts as one word; an inverted segment collapses to a point', () => {
    expect(estimateWords('   ', null, 0, 1)).toEqual([]);
    expect(estimateWords('?!', null, 0.5, 0.75)).toEqual([{ text: '?!', start: 0.5, end: 0.75 }]);
    const collapsed = estimateWords('a b', null, 2, 1);
    expect(collapsed.every((w) => w.start === 2 && w.end === 2)).toBe(true);
  });

  it('standalone punctuation merges into the previous word; apostrophes count as letters', () => {
    expect(splitIntoWordPairs("don't — stop", 'en')).toEqual([
      { surface: "don't—", cleaned: "don't" },
      { surface: 'stop', cleaned: 'stop' },
    ]);
  });

  it('mixed Chinese and English: non-Han prefixes before Han characters merge into them, Latin letters after Han characters form their own words', () => {
    expect(splitIntoWordPairs('“你好AI', 'zh')).toEqual([
      { surface: '“你', cleaned: '你' },
      { surface: '好', cleaned: '好' },
      { surface: 'AI', cleaned: 'AI' },
    ]);
  });

  it('Japanese is segmented with a dictionary (when the language is given or judged by kana), trailing punctuation attaches to the word', () => {
    const byLanguage = splitIntoWordPairs('今日は晴れ。', 'ja');
    const byScript = splitIntoWordPairs('今日は晴れ。', null);
    expect(byLanguage).toEqual(byScript);
    expect(byLanguage.length).toBeGreaterThan(1);
    expect(byLanguage.at(-1)!.surface.endsWith('。')).toBe(true);
    expect(byLanguage.map((p) => p.cleaned).join('')).toBe('今日は晴れ');
  });
});

describe('fixWordTimes', () => {
  const segment = (words: Segment['words']): Segment => ({ id: 's', start: 100, end: 200, text: 'x', speakerId: null, words });

  it('words that cross segments, are inverted or overlap are pulled into the segment and kept monotonic, reporting that they were changed', () => {
    const s = segment([
      { start: 90, end: 120, text: 'a', confidence: null, timingQuality: 'provider' },
      { start: 110, end: 105, text: 'b', confidence: null, timingQuality: 'provider' },
      { start: 150, end: 260, text: 'c', confidence: null, timingQuality: 'provider' },
      { start: 170, end: 180, text: 'd', confidence: null, timingQuality: 'missing' },
    ]);
    expect(fixWordTimes(s)).toBe(true);
    expect(s.words.map((w) => [w.start, w.end])).toEqual([
      [100, 120],
      [120, 120],
      [150, 200],
      [100, 100],
    ]);
    expect(s.words[0]!.timingQuality).toBe('provider');
  });

  it('already valid words are left unchanged', () => {
    const s = segment([{ start: 100, end: 150, text: 'a', confidence: null, timingQuality: 'estimated' }]);
    expect(fixWordTimes(s)).toBe(false);
  });
});

describe('secondsToTicks', () => {
  it('rounds; negative and non-finite values are 0', () => {
    expect(secondsToTicks(1.2345678, 1_000_000)).toBe(1_234_568);
    expect(secondsToTicks(-1, 1000)).toBe(0);
    expect(secondsToTicks(Number.NaN, 1000)).toBe(0);
    expect(secondsToTicks(Number.POSITIVE_INFINITY, 1000)).toBe(0);
  });
});
