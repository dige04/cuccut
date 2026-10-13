import { modelAssetPath } from './model-assets.ts';

/**
 * Fixed sample for the model package self-test (`models.test`, architecture design §6.3): a bundled English reading (about 3.7 seconds, 16 kHz mono WAV), the same file used by the Model Worker's integration tests. The self-test runs the full Worker flow; the result must conform to `cuccut.asr-result/v1`, and the recognised text (ignoring case and punctuation; single-digit English number words count as equal to digits) must contain `expected`.
 */
export interface SelfTestSample {
  /** Relative path within the model data directory (`model-assets.ts`); the absolute path is resolved with `selfTestSampleFile` at the point of use. */
  asset: string;
  /** Text the recognition result must contain (lowercase, words separated by spaces). */
  expected: string;
  /** Language of the sample (passed to the Worker as a preference; not asserted). */
  language: string;
}

export const TRANSCRIBE_SELF_TEST: SelfTestSample = {
  asset: 'self-test-sample.wav',
  expected: 'testing one two three',
  language: 'en',
};

/** Absolute path of the sample; null when the model data directory cannot be found (reading it reports `APP_FILE_MISSING`). */
export function selfTestSampleFile(sample: SelfTestSample, env: NodeJS.ProcessEnv = process.env): string | null {
  return modelAssetPath(sample.asset, env);
}

/** Normalises recognised text to lowercase, with single spaces between words. */
export function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

/** After normalising, also converts single-digit English number words to digits: some models (Whisper) write "one two three" as "1, 2, 3". */
function withDigits(text: string): string {
  return normalizeTranscript(text)
    .split(' ')
    .map((word) => DIGIT_WORDS[word] ?? word)
    .join(' ');
}

/** Whether the recognition result contains the sample's expected text (digits written as Arabic numerals also count). */
export function selfTestMatches(text: string, sample: SelfTestSample): boolean {
  return ` ${withDigits(text)} `.includes(` ${withDigits(sample.expected)} `);
}
