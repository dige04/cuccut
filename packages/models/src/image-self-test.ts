import { inflateSync } from 'node:zlib';

import { refOf, type GenerationParameters, type Localized, type MessageRef } from '@cuccut/protocol';
import { ModelsImageSelfTest as M } from '@cuccut/protocol/messages/models/image-self-test.ts';

/**
 * Self-test for the local text-to-image model pack (architecture design §6.3, Model Worker protocol spec §4.3): a fixed prompt, size and seed, a small image generated with few steps, and a check that the output is a decodable PNG, the size is right, and it is not a single solid color. It does not judge whether the image is good; it only proves that the whole image-generation chain can produce an image.
 */

type ImageParameters = Extract<GenerationParameters, { capability: 'generateImage' }>;

/** Fixed input for the self-test: small size, few steps, results within tens of seconds. The seed is fixed, so on the same machine it is the same image every time. */
export const IMAGE_SELF_TEST = {
  prompt: 'A red apple on a wooden table',
  width: 256,
  height: 256,
  seed: 7,
  steps: 4,
} as const;

/** Frozen parameters of the self-test (same shape as a real submission; the step count is set separately by `IMAGE_SELF_TEST.steps`). */
export function imageSelfTestParameters(): ImageParameters {
  const { prompt, width, height, seed } = IMAGE_SELF_TEST;
  return { capability: 'generateImage', prompt, size: `${width}x${height}`, aspectRatio: null, count: 1, format: 'png', seed };
}

export interface PngFacts {
  width: number;
  height: number;
  /** Number of distinct pixel values (counted as RGBA), counting up to `DISTINCT_CAP`. */
  distinct: number;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Channels per pixel, according to the PNG color type (only 8-bit is supported). */
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 };
const DISTINCT_CAP = 1024;

/** Parse a PNG (8-bit grayscale, grayscale with alpha, RGB, RGBA, non-interlaced): returns the number of pixels for each distinct color. Gives a reason when the format does not match. */
export function inspectPng(bytes: Buffer): { ok: true; png: PngFacts } | { ok: false; problem: string } {
  const parsed = parsePng(bytes);
  return parsed.ok ? parsed : { ok: false, problem: parsed.problem.text };
}

function parsePng(bytes: Buffer): { ok: true; png: PngFacts } | { ok: false; problem: Localized } {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(SIGNATURE)) return { ok: false, problem: M.notPng() };
  let header: { width: number; height: number; depth: number; color: number; interlace: number } | null = null;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = offset + 8;
    if (body + length > bytes.length) return { ok: false, problem: M.chunkTruncated({ type }) };
    if (type === 'IHDR' && length >= 13) {
      header = {
        width: bytes.readUInt32BE(body),
        height: bytes.readUInt32BE(body + 4),
        depth: bytes[body + 8]!,
        color: bytes[body + 9]!,
        interlace: bytes[body + 12]!,
      };
    } else if (type === 'IDAT') idat.push(bytes.subarray(body, body + length));
    else if (type === 'IEND') break;
    offset = body + length + 4;
  }
  if (!header) return { ok: false, problem: M.missingIhdr() };
  const { width, height, depth, color, interlace } = header;
  const channels = CHANNELS[color];
  if (depth !== 8 || channels === undefined || interlace !== 0) {
    return { ok: false, problem: M.unsupportedPixelFormat({ depth, color, interlace }) };
  }
  if (width === 0 || height === 0) return { ok: false, problem: M.zeroSize() };
  if (idat.length === 0) return { ok: false, problem: M.missingIdat() };
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return { ok: false, problem: M.inflateFailed() };
  }
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return { ok: false, problem: M.pixelDataShort() };
  const pixels = unfilter(raw, width, height, channels);
  if (!pixels) return { ok: false, problem: M.unknownFilter() };
  const seen = new Set<number>();
  for (let i = 0; i < pixels.length && seen.size < DISTINCT_CAP; i += channels) {
    let key = 0;
    for (let c = 0; c < channels; c++) key = key * 256 + pixels[i + c]!;
    seen.add(key);
  }
  return { ok: true, png: { width, height, distinct: seen.size } };
}

/** Remove per-row filtering (PNG spec's None / Sub / Up / Average / Paeth). */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Uint8Array | null {
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp]! : 0;
      const b = y > 0 ? out[prev + x]! : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp]! : 0;
      let predictor: number;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else return null;
      out[row + x] = (raw[src + x]! + predictor) & 0xff;
    }
  }
  return out;
}

/**
 * Self-test verdict: it decodes, the size is the one requested, and there are more than one or two colors. When it fails, it gives a reason: `problem` is the text in the current language, and `problemRef` is its message reference (recorded in the check result's `detailRef` and the task error's `messageRef`).
 */
export function imageSelfTestVerdict(
  bytes: Buffer,
  expected: { width: number; height: number } = IMAGE_SELF_TEST,
): { passed: true; png: PngFacts } | { passed: false; problem: string; problemRef?: MessageRef; png?: PngFacts } {
  const failed = (problem: Localized, png?: PngFacts) => ({
    passed: false as const,
    problem: problem.text,
    problemRef: refOf(problem),
    ...(png ? { png } : {}),
  });
  const parsed = parsePng(bytes);
  if (!parsed.ok) return failed(M.undecodable({ problem: parsed.problem }));
  const { png } = parsed;
  if (png.width !== expected.width || png.height !== expected.height) {
    return failed(
      M.sizeMismatch({ width: png.width, height: png.height, expectedWidth: expected.width, expectedHeight: expected.height }),
      png,
    );
  }
  if (png.distinct < 16) return failed(M.nearlySolid({ distinct: png.distinct }), png);
  return { passed: true, png };
}
