// Times in the old format are decimal seconds (JSON floats). On import they are first converted exactly to microseconds from their decimal text, then mapped onto the new format's two kinds of time:
// picture spans snap to the frame grid, while sound and source times keep microsecond precision (video format spec §2).
// `insertItems` stores the given frames and exact times as is without quantizing again, so items are quantized here, by the engine's rule: nearest frame, ties go to the earlier one.

export type Rate = { num: number; den: number };

export type MediaTime = { ticks: string; timescale: number };

const MICROS = 1_000_000n;

/** Decimal seconds -> microseconds. Rounds from the value's shortest decimal representation (round half up), without floating-point multiplication. */
export function micros(seconds: number): bigint {
  if (!Number.isFinite(seconds)) throw new Error(`Not a finite time: ${seconds}`);
  const text = String(seconds);
  if (/e/i.test(text)) return BigInt(Math.round(seconds * 1e6));
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const digits = (fraction + '0000000').slice(0, 7);
  let value = BigInt(whole) * MICROS + BigInt(digits.slice(0, 6));
  if (digits[6]! >= '5') value += 1n;
  return negative ? -value : value;
}

export function mediaTime(us: bigint): MediaTime {
  return reduce(us, MICROS);
}

export function seconds(us: bigint): number {
  return Number(us) / 1e6;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

/** The canonical MediaTime for `num / den` seconds (after reducing). */
export function reduce(num: bigint, den: bigint): MediaTime {
  if (den <= 0n) throw new Error('timescale must be positive');
  const g = gcd(num, den) || 1n;
  const timescale = den / g;
  if (timescale > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('timescale exceeds the safe integer range');
  return { ticks: String(num / g), timescale: Number(timescale) };
}

function divRound(num: bigint, den: bigint, mode: 'nearest' | 'floor' | 'ceil'): bigint {
  const q = num / den;
  const r = num % den;
  if (r === 0n) return q;
  const below = num < 0n ? q - 1n : q;
  if (mode === 'floor') return below;
  if (mode === 'ceil') return below + 1n;
  // Ties go to the earlier frame (video format spec §2.6).
  const rest = num - below * den;
  return rest * 2n > den ? below + 1n : below;
}

/** Which frame a microsecond instant falls in. */
export function frameAt(us: bigint, fps: Rate, mode: 'nearest' | 'floor' | 'ceil' = 'nearest'): number {
  return Number(divRound(us * BigInt(fps.num), BigInt(fps.den) * MICROS, mode));
}

/** Start of frame `frame` (microseconds, rounded to the nearest whole microsecond; only for reporting error and converting source times). */
export function frameStart(frame: number, fps: Rate): bigint {
  return divRound(BigInt(frame) * BigInt(fps.den) * MICROS, BigInt(fps.num), 'nearest');
}

/** Start position of audio: its frame plus the exact offset within the frame (§2.10). */
export function audioStart(us: bigint, fps: Rate): { fromFrame: number; subframeOffset: MediaTime } {
  const fromFrame = frameAt(us, fps, 'floor');
  const num = us * BigInt(fps.num) - BigInt(fromFrame) * BigInt(fps.den) * MICROS;
  return { fromFrame, subframeOffset: reduce(num, MICROS * BigInt(fps.num)) };
}

const KNOWN_RATES: Rate[] = [
  { num: 24000, den: 1001 },
  { num: 24, den: 1 },
  { num: 25, den: 1 },
  { num: 30000, den: 1001 },
  { num: 30, den: 1 },
  { num: 50, den: 1 },
  { num: 60000, den: 1001 },
  { num: 60, den: 1 },
];

/** The old format stores frame rates as floats (29.97002997…): snap to a common exact frame rate, or use an integer frame rate when far off. */
export function snapFps(value: number | null | undefined): { rate: Rate; snapped: boolean } | null {
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  for (const rate of KNOWN_RATES) {
    if (Math.abs(rate.num / rate.den - value) < 0.005) return { rate, snapped: true };
  }
  return { rate: { num: Math.max(1, Math.round(value)), den: 1 }, snapped: false };
}

/** Decimal speed (1.19) -> exact rational number. */
export function rateOf(value: number | null | undefined): Rate {
  if (!value || !Number.isFinite(value) || value <= 0) return { num: 1, den: 1 };
  const us = micros(value);
  const g = gcd(us, MICROS);
  return { num: Number(us / g), den: Number(MICROS / g) };
}

/** Exact rational `num / den` (`den` is a power of 10) for decimal seconds, read from the value's shortest decimal representation, without rounding. */
export function decimal(value: number): { num: bigint; den: bigint } {
  if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
  const text = decimalText(value);
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const num = BigInt(whole + fraction);
  return { num: negative ? -num : num, den: 10n ** BigInt(fraction.length) };
}

/** The value's shortest decimal representation, without exponent notation (the engine's decimal-seconds strings do not accept `1e-7`). */
export function decimalText(value: number): string {
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/i.exec(text);
  if (!match) return text;
  const [, sign = '', int = '', frac = '', exp] = match;
  const digits = int + frac;
  const point = int.length + Number(exp);
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** dB -> linear gain (volume in external projects is in dB). */
export function linearOfDb(db: number): number {
  return Math.round(10 ** (db / 20) * 1e6) / 1e6;
}
