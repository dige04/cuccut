import type { AssetDecoder } from './asset-source.ts';
import type { RenderPlanner } from './render-planner.ts';

/**
 * Size limit (in bytes) for audio sources analyzed in preview: larger sources are too memory-heavy to read into the page and decode into samples, so preview skips analysis, draws the waveform as if static, and reports it.
 * Export is not subject to this limit (the Render Worker decodes from the file).
 */
export const SPECTRUM_MAX_BYTES = 512 * 1024 * 1024;

/** Decoded per-channel samples (48 kHz). */
export type DecodeAudio = (bytes: ArrayBuffer) => Promise<Float32Array[]>;

/**
 * Spectrum decoder for source media (the source cache computes it once per source version): the browser decodes the source's audio into 48 kHz samples, then passes them to the same analysis the export uses, in the preview WASM, to produce BCS1. Sources with no audio cannot be decoded; the cache records a failure, and the waveform is drawn as static and reported.
 */
export function spectrumDecoder(
  planner: Pick<RenderPlanner, 'analyzeAudio'>,
  decode: DecodeAudio = decodeWithWebAudio,
): AssetDecoder<Uint8Array> {
  return {
    name: 'spectrum',
    decode: async (response) => planner.analyzeAudio(await decode(await response.arrayBuffer())),
  };
}

/** Web Audio decoding: resamples to the context's 48 kHz while decoding, channels kept as they are. */
export async function decodeWithWebAudio(bytes: ArrayBuffer): Promise<Float32Array[]> {
  const context = new OfflineAudioContext(1, 1, 48_000);
  const buffer = await context.decodeAudioData(bytes);
  return Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
}
