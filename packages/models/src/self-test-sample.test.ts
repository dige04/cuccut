import { describe, expect, it } from 'vitest';
import { TRANSCRIBE_SELF_TEST, selfTestMatches } from './self-test-sample.ts';

describe('expected text for the model pack self-test', () => {
  it('ignores case and punctuation; numbers written as Arabic numerals also count', () => {
    expect(selfTestMatches('Testing one, two, three. CucCut is ready.', TRANSCRIBE_SELF_TEST)).toBe(true);
    expect(selfTestMatches('Testing 1, 2, 3, BayoCut is ready.', TRANSCRIBE_SELF_TEST)).toBe(true);
    expect(selfTestMatches('Testing one 2 three', TRANSCRIBE_SELF_TEST)).toBe(true);
    expect(selfTestMatches('Testing 1, 2, 4', TRANSCRIBE_SELF_TEST)).toBe(false);
    expect(selfTestMatches('Testing 123', TRANSCRIBE_SELF_TEST)).toBe(false);
  });
});
