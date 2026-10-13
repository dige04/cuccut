import type { GenerationParameters } from '@cuccut/protocol';
import { speechSelfTestVerdict, type WavFacts } from './speech-self-test.ts';
import type { MessageRef } from '@cuccut/protocol';

/**
 * Self-test of local music generation model packages (architecture design §6.3, Model Worker protocol spec §4.4): generates a short piece of instrumental music with a fixed style and seed, with no orchestration, few steps and a short cap, then checks that the output is a decodable WAV, has a reasonable duration, is not silent, and does not clip (the same verdict as speech synthesis). It does not judge whether the music sounds good; it only proves that the engine and weights can produce sound.
 */

type MusicParameters = Extract<GenerationParameters, { capability: 'generateMusic' }>;

/** Fixed input for the self-test: a few seconds of instrumental music, no orchestration, few steps. The seed is fixed, so on the same machine it produces the same piece every time. */
export const MUSIC_SELF_TEST = {
  mode: 'instrumental',
  // i18n-ignore: English style description handed to the model, not interface text
  style: 'calm solo piano, slow tempo',
  maxDurationSec: 8,
  seed: 7,
  steps: 4,
} as const;

/** Frozen parameters of the self-test (same shape as a formal submission; the step count is set separately by `MUSIC_SELF_TEST.steps`). */
export function musicSelfTestParameters(): MusicParameters {
  const { mode, style, maxDurationSec, seed } = MUSIC_SELF_TEST;
  return { capability: 'generateMusic', mode, style, lyrics: null, targetDurationSec: null, maxDurationSec, planning: 'off', format: 'wav', seed };
}

/** Verdict: decodable, 0.3–30 seconds, not silent, not clipping (the thresholds of `speechSelfTestVerdict`). */
export function musicSelfTestVerdict(
  bytes: Buffer,
): { passed: true; wav: WavFacts } | { passed: false; problem: string; problemRef?: MessageRef; wav?: WavFacts } {
  return speechSelfTestVerdict(bytes);
}
