import { refOf, type Localized, type MessageRef, type SynthesizeSpeechRequest } from '@cuccut/protocol';
import { ModelsSpeechSelfTest as M } from '@cuccut/protocol/messages/models/speech-self-test.ts';
import type { BundleDefinition } from './bundle-registry.ts';

/**
 * Self-test for local speech synthesis model packages (architecture design §6.3, Model Worker protocol spec §4.3): synthesises a fixed short sentence with the model's own default voice, and checks that the output is a decodable WAV, has a reasonable duration, is not silent, and does not clip. It does not judge whether the reading is correct (that would need another recognition model); it only proves that the whole synthesis chain can produce sound.
 */

/** One sentence per language (keyed by the BCP 47 primary language subtag). When the model does not list these languages, or accepts any language, the English sentence is used. */
export const SPEECH_SELF_TEST_SENTENCES: Readonly<Record<string, string>> = {
  // i18n-ignore-start: self-test reading samples (fixed sentences handed to the model for synthesis, one per language)
  zh: '这是一段语音合成的自检。',
  en: 'This is a short speech synthesis check.',
  ja: 'これは音声合成の短いテストです。',
  ko: '이것은 음성 합성 점검입니다.',
  es: 'Esta es una breve prueba de síntesis de voz.',
  fr: 'Ceci est un court test de synthèse vocale.',
  de: 'Dies ist ein kurzer Test der Sprachsynthese.',
  it: 'Questa è una breve prova di sintesi vocale.',
  pt: 'Este é um breve teste de síntese de voz.',
  ru: 'Это короткая проверка синтеза речи.',
  ar: 'هذا اختبار قصير لتوليد الكلام.',
  // i18n-ignore-end
};
const FALLBACK_LANGUAGE = 'en';

/** Thresholds for the verdict (written in Model Worker protocol spec §4.3). */
export const SPEECH_SELF_TEST_LIMITS = {
  /** Lower and upper bounds on the duration of a synthesised short sentence (seconds). */
  minDurationSec: 0.3,
  maxDurationSec: 30,
  /** If the RMS of the whole clip (full scale = 1) is below this value, it counts as silence (about -60 dBFS). */
  minRms: 0.001,
  /** If the proportion of samples at full scale (|x| ≥ `clipLevel`) out of all samples is above this value, it counts as clipping. */
  clipLevel: 0.999,
  maxClippedRatio: 0.001,
} as const;

/** The self-test request: the first language the model lists that has a sentence; when it accepts any language, or none of its languages has a sentence, English is used. The voice is the model's default voice (not specified). */
export function speechSelfTestRequest(def: BundleDefinition): SynthesizeSpeechRequest & { language: string } {
  const listed = def.speech?.languages;
  const language =
    listed && listed !== 'any'
      ? (listed.find((l) => SPEECH_SELF_TEST_SENTENCES[l.toLowerCase().split('-')[0]!]) ?? FALLBACK_LANGUAGE)
      : FALLBACK_LANGUAGE;
  const primary = language.toLowerCase().split('-')[0]!;
  return { text: SPEECH_SELF_TEST_SENTENCES[primary] ?? SPEECH_SELF_TEST_SENTENCES[FALLBACK_LANGUAGE]!, language };
}

export interface WavFacts {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** `pcm`: integer PCM; `float`: IEEE float. */
  encoding: 'pcm' | 'float';
  durationSec: number;
  /** RMS over all channels together, full scale = 1. */
  rms: number;
  /** Maximum absolute value across all samples, full scale = 1. */
  peak: number;
  /** Proportion of samples at full scale (|x| ≥ 0.999) out of all samples. */
  clippedRatio: number;
}

/** Parses a WAV (RIFF/WAVE, PCM 16/24/32-bit or 32-bit float); gives the reason when the format is not acceptable. */
export function inspectWav(bytes: Buffer): { ok: true; wav: WavFacts } | { ok: false; problem: string } {
  const parsed = parseWav(bytes);
  return parsed.ok ? parsed : { ok: false, problem: parsed.problem.text };
}

/** Same as `inspectWav`, but the reason carries a message reference (embedded in the self-test verdict sentence). */
export function parseWav(bytes: Buffer): { ok: true; wav: WavFacts } | { ok: false; problem: Localized } {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    return { ok: false, problem: M.notWav() };
  }
  let fmt: { format: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let data: { start: number; length: number } | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && size >= 16 && body + 16 <= bytes.length) {
      let format = bytes.readUInt16LE(body);
      // WAVE_FORMAT_EXTENSIBLE: the real format is in the first two bytes of the sub-format GUID.
      if (format === 0xfffe && size >= 40 && body + 26 <= bytes.length) format = bytes.readUInt16LE(body + 24);
      fmt = {
        format,
        channels: bytes.readUInt16LE(body + 2),
        sampleRate: bytes.readUInt32LE(body + 4),
        bitsPerSample: bytes.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = { start: body, length: Math.min(size, bytes.length - body) };
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!fmt) return { ok: false, problem: M.missingFmt() };
  if (!data) return { ok: false, problem: M.missingData() };
  const { format, channels, sampleRate, bitsPerSample } = fmt;
  const encoding = format === 1 ? 'pcm' : format === 3 ? 'float' : null;
  if (!encoding) return { ok: false, problem: M.unsupportedEncoding({ format }) };
  if (channels < 1 || channels > 2) return { ok: false, problem: M.badChannels({ channels }) };
  if (sampleRate < 8_000 || sampleRate > 192_000) return { ok: false, problem: M.badSampleRate({ sampleRate }) };
  const valid = encoding === 'float' ? bitsPerSample === 32 : bitsPerSample === 16 || bitsPerSample === 24 || bitsPerSample === 32;
  if (!valid) return { ok: false, problem: M.unsupportedBitDepth({ bits: bitsPerSample }) };
  const bytesPerSample = bitsPerSample / 8;
  const samples = Math.floor(data.length / bytesPerSample);
  let sum = 0;
  let peak = 0;
  let clipped = 0;
  for (let i = 0; i < samples; i++) {
    const at = data.start + i * bytesPerSample;
    let value: number;
    if (encoding === 'float') value = bytes.readFloatLE(at);
    else if (bitsPerSample === 16) value = bytes.readInt16LE(at) / 32_768;
    else if (bitsPerSample === 24) value = bytes.readIntLE(at, 3) / 8_388_608;
    else value = bytes.readInt32LE(at) / 2_147_483_648;
    if (!Number.isFinite(value)) return { ok: false, problem: M.nonFinite() };
    sum += value * value;
    const magnitude = Math.abs(value);
    if (magnitude > peak) peak = magnitude;
    if (magnitude >= SPEECH_SELF_TEST_LIMITS.clipLevel) clipped++;
  }
  const frames = Math.floor(samples / channels);
  return {
    ok: true,
    wav: {
      sampleRate,
      channels,
      bitsPerSample,
      encoding,
      durationSec: frames / sampleRate,
      rms: samples > 0 ? Math.sqrt(sum / samples) : 0,
      peak,
      clippedRatio: samples > 0 ? clipped / samples : 0,
    },
  };
}

/**
 * Verdict of the self-test: decodes, duration within range, not silent, does not clip. If it fails, the reason is given: `problem` is the text in the current language, and `problemRef` is its message reference (recorded in the check result's `detailRef` and the task error's `messageRef`).
 */
export function speechSelfTestVerdict(
  bytes: Buffer,
): { passed: true; wav: WavFacts } | { passed: false; problem: string; problemRef?: MessageRef; wav?: WavFacts } {
  const failed = (problem: Localized, wav?: WavFacts) => ({
    passed: false as const,
    problem: problem.text,
    problemRef: refOf(problem),
    ...(wav ? { wav } : {}),
  });
  const parsed = parseWav(bytes);
  if (!parsed.ok) return failed(M.undecodable({ problem: parsed.problem }));
  const { wav } = parsed;
  const limits = SPEECH_SELF_TEST_LIMITS;
  if (wav.durationSec < limits.minDurationSec || wav.durationSec > limits.maxDurationSec) {
    return failed(
      M.durationOutOfRange({ duration: wav.durationSec.toFixed(2), min: limits.minDurationSec, max: limits.maxDurationSec }),
      wav,
    );
  }
  if (wav.rms < limits.minRms) return failed(M.silent(), wav);
  if (wav.clippedRatio > limits.maxClippedRatio) {
    return failed(M.clipped({ ratio: (wav.clippedRatio * 100).toFixed(2), limit: limits.maxClippedRatio * 100 }), wav);
  }
  return { passed: true, wav };
}
