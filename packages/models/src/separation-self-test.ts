import { refOf, type Localized, type MessageRef } from '@cuccut/protocol';
import { ModelsSeparationSelfTest as M } from '@cuccut/protocol/messages/models/separation-self-test.ts';
import { parseWav, SPEECH_SELF_TEST_LIMITS, type WavFacts } from './speech-self-test.ts';

/**
 * Self-test for separation model packages (`models.test`, Model Worker protocol spec §4.3): separates the whole of the English reading sample used for the recognition self-test (vocals only), and judges the two output streams. The thresholds are written in the protocol spec.
 */
export const SEPARATION_SELF_TEST_LIMITS = {
  /** Upper limit on the difference between each output stream's duration and the sample's duration (seconds; one audio frame is 20 ms). */
  durationToleranceSec: 0.02,
  /** A vocal RMS below this value counts as silence (same as the synthesis self-test). */
  minVocalsRms: SPEECH_SELF_TEST_LIMITS.minRms,
  /** The sample is vocals only: the vocal RMS must be at least this many times the background (about 6 dB). */
  minVocalsToBackground: 2,
} as const;

export type SeparationSelfTestVerdict =
  | { passed: true; vocals: WavFacts; background: WavFacts }
  | { passed: false; problem: string; problemRef?: MessageRef; vocals?: WavFacts; background?: WavFacts };

/**
 * Verdict: both streams decode, are stereo, have the same sample rate, and match the sample's length; the vocals are not silent and are clearly louder than the background. If it fails, `problem` is the text in the current language, and `problemRef` is its message reference.
 */
export function separationSelfTestVerdict(
  stems: { vocals: Buffer; background: Buffer },
  sampleDurationSec: number,
): SeparationSelfTestVerdict {
  const limits = SEPARATION_SELF_TEST_LIMITS;
  const failed = (problem: Localized, facts: { vocals?: WavFacts; background?: WavFacts } = {}) => ({
    passed: false as const,
    problem: problem.text,
    problemRef: refOf(problem),
    ...facts,
  });
  const vocals = parseWav(stems.vocals);
  if (!vocals.ok) return failed(M.vocalsUndecodable({ problem: vocals.problem }));
  const background = parseWav(stems.background);
  if (!background.ok) return failed(M.backgroundUndecodable({ problem: background.problem }), { vocals: vocals.wav });
  const facts = { vocals: vocals.wav, background: background.wav };
  for (const [stem, wav] of [
    [M.vocals(), vocals.wav],
    [M.background(), background.wav],
  ] as const) {
    if (wav.channels !== 2) return failed(M.notStereo({ stem, channels: wav.channels }), facts);
    if (Math.abs(wav.durationSec - sampleDurationSec) > limits.durationToleranceSec) {
      return failed(
        M.durationMismatch({ stem, duration: wav.durationSec.toFixed(3), sample: sampleDurationSec.toFixed(3) }),
        facts,
      );
    }
  }
  if (vocals.wav.sampleRate !== background.wav.sampleRate) {
    return failed(M.sampleRateMismatch({ vocals: vocals.wav.sampleRate, background: background.wav.sampleRate }), facts);
  }
  if (vocals.wav.rms < limits.minVocalsRms) return failed(M.vocalsSilent(), facts);
  if (vocals.wav.rms < background.wav.rms * limits.minVocalsToBackground) {
    return failed(M.vocalsNotLouder({ vocals: vocals.wav.rms.toFixed(4), background: background.wav.rms.toFixed(4) }), facts);
  }
  return { passed: true, ...facts };
}
