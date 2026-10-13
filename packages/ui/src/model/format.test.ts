import { describe, expect, it } from 'vitest';
import { formatTenths, shortenPath } from './format.ts';

describe('shortenPath', () => {
  it('macOS and Linux home directories are shortened to ~', () => {
    expect(shortenPath('/Users/me')).toBe('~');
    expect(shortenPath('/Users/me/CucCut/models')).toBe('~/CucCut/models');
    expect(shortenPath('/home/me/CucCut')).toBe('~/CucCut');
    expect(shortenPath('/Volumes/ExtremeSSD/CucCut')).toBe('/Volumes/ExtremeSSD/CucCut');
  });

  it('Windows home directory: any drive letter, case-insensitive, trailing separators kept as they are', () => {
    expect(shortenPath('C:\\Users\\me')).toBe('~');
    expect(shortenPath('C:\\Users\\me\\CucCut\\models')).toBe('~\\CucCut\\models');
    expect(shortenPath('c:\\users\\Me\\CucCut')).toBe('~\\CucCut');
    expect(shortenPath('E:/Users/me/CucCut')).toBe('~/CucCut');
    expect(shortenPath('D:\\Models\\cuccut')).toBe('D:\\Models\\cuccut');
  });
});

describe('formatTenths (prototype model-time.test.js timecode)', () => {
  it('one decimal place, carries over at one hour', () => {
    expect(formatTenths(0)).toBe('00:00.0');
    expect(formatTenths(12.4)).toBe('00:12.4');
    expect(formatTenths(206)).toBe('03:26.0');
    expect(formatTenths(3599.9)).toBe('59:59.9');
    expect(formatTenths(3600)).toBe('1:00:00.0');
    expect(formatTenths(3723.5)).toBe('1:02:03.5');
    expect(formatTenths(-5.5)).toBe('-00:05.5');
    // Quantize first, then split into fields: subtracting two float seconds (22.4 − 12.4) gives 9.999999999999998, which must not be written as “00:010.0”.
    expect(formatTenths(22.4 - 12.4)).toBe('00:10.0');
    expect(formatTenths(9.999999)).toBe('00:10.0');
    // A carry from seconds rolls into minutes; a carry from minutes rolls into hours.
    expect(formatTenths(59.99)).toBe('01:00.0');
    expect(formatTenths(3599.99)).toBe('1:00:00.0');
  });

  it('decimals: 0 drops the decimal places', () => {
    expect(formatTenths(12.4, { decimals: 0 })).toBe('00:12');
    expect(formatTenths(3723.5, { decimals: 0 })).toBe('1:02:04');
  });
});
