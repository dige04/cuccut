import { describe, expect, it } from 'vitest';
import { compileFind, findRanges, replaceRanges, stepIndex } from './text-find.ts';

const plain = { matchCase: false, wholeWord: false, regex: false };
const ranges = (text: string, query: string, options = plain) => {
  const { re } = compileFind(query, options);
  return re ? findRanges(text, re, options.wholeWord) : [];
};

describe('find and replace', () => {
  it('case-insensitive by default, special characters are matched literally', () => {
    expect(ranges('Cat cat CAT', 'cat')).toHaveLength(3);
    expect(ranges('Cat cat CAT', 'cat', { ...plain, matchCase: true })).toEqual([{ start: 4, end: 7 }]);
    expect(ranges('a.b axb', 'a.b')).toEqual([{ start: 0, end: 3 }]);
  });

  it('whole word uses Unicode boundaries; an invalid regex is reported', () => {
    expect(ranges('cat category cat', 'cat', { ...plain, wholeWord: true })).toEqual([
      { start: 0, end: 3 },
      { start: 13, end: 16 },
    ]);
    expect(ranges('a1 b22', '\\d+', { ...plain, regex: true })).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 6 },
    ]);
    expect(compileFind('(', { ...plain, regex: true }).error).toBeTruthy();
    expect(compileFind('', plain)).toEqual({});
  });

  it('replaces from back to front; replacements identical to the original don\'t count', () => {
    expect(replaceRanges('苏黎和苏黎', ranges('苏黎和苏黎', '苏黎'), '苏黎老师')).toEqual({ text: '苏黎老师和苏黎老师', changed: 2 });
    expect(replaceRanges('ab', [{ start: 0, end: 1 }], 'a').changed).toBe(0);
    expect([stepIndex(2, 3, 1), stepIndex(0, 3, -1), stepIndex(5, 0, 1)]).toEqual([0, 2, 0]);
  });
});
