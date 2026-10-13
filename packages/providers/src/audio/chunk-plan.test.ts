import { describe, expect, it } from 'vitest';
import { chunkLimitSec, parseSilences, planChunks, type PlannedChunk } from './chunk-plan.ts';

/** Every chunk is no larger than the cap, the chunks are contiguous end to end, and they cover the whole span. */
function expectValid(chunks: PlannedChunk[], duration: number, max: number) {
  expect(chunks[0]!.start).toBe(0);
  expect(chunks.at(-1)!.end).toBe(duration);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    expect(c.end).toBeGreaterThan(c.start);
    expect(c.end - c.start).toBeLessThanOrEqual(max + 1e-9);
    if (i > 0) expect(c.start).toBe(chunks[i - 1]!.end);
  }
}

describe('planChunks', () => {
  it('one chunk when not over the limit', () => {
    expect(planChunks({ durationSec: 60, maxChunkSec: 60, silences: [] })).toEqual([{ start: 0, end: 60 }]);
    expect(planChunks({ durationSec: 0, maxChunkSec: 10, silences: [] })).toEqual([{ start: 0, end: 0 }]);
  });

  it('hard cut at the limit when there is no silence', () => {
    const chunks = planChunks({ durationSec: 250, maxChunkSec: 100, silences: [] });
    expect(chunks).toEqual([
      { start: 0, end: 100 },
      { start: 100, end: 200 },
      { start: 200, end: 250 },
    ]);
  });

  it('cuts at the midpoint of the latest silence in the window', () => {
    const chunks = planChunks({
      durationSec: 180,
      maxChunkSec: 100,
      silences: [
        { start: 30, end: 31 }, // Before the window (50–100); not used
        { start: 60, end: 62 },
        { start: 80, end: 84 },
        { start: 140, end: 141 },
      ],
    });
    expect(chunks).toEqual([
      { start: 0, end: 82 },
      { start: 82, end: 180 },
    ]);
  });

  it('a silence straddling the window edge uses the point clamped into the window', () => {
    // The midpoint 102.5 of silence 95–110 is outside the window, so it is clamped to the window end, 100.
    expect(planChunks({ durationSec: 150, maxChunkSec: 100, silences: [{ start: 95, end: 110 }] })[0]).toEqual({ start: 0, end: 100 });
    // The midpoint 46 of silence 40–52 is before the window, so it is clamped to the window start, 50.
    expect(planChunks({ durationSec: 150, maxChunkSec: 100, silences: [{ start: 40, end: 52 }] })[0]).toEqual({ start: 0, end: 50 });
  });

  it('leading silence does not affect cut points', () => {
    const chunks = planChunks({ durationSec: 150, maxChunkSec: 100, silences: [{ start: 0, end: 5 }] });
    expect(chunks[0]).toEqual({ start: 0, end: 100 });
  });

  it('does not leave a last chunk that is too short', () => {
    const chunks = planChunks({ durationSec: 100.2, maxChunkSec: 100, silences: [] });
    expectValid(chunks, 100.2, 100);
    expect(chunks.at(-1)!.end - chunks.at(-1)!.start).toBeGreaterThanOrEqual(1);
  });

  it('same input gives the same plan (silence order does not matter)', () => {
    const silences = [
      { start: 70, end: 72 },
      { start: 55, end: 57 },
      { start: 170, end: 171 },
    ];
    const a = planChunks({ durationSec: 300, maxChunkSec: 100, silences });
    const b = planChunks({ durationSec: 300, maxChunkSec: 100, silences: [...silences].reverse() });
    expect(a).toEqual(b);
    expectValid(a, 300, 100);
  });

  it('long audio and dense silences: every chunk is within the limit and together they cover the whole range', () => {
    const silences = Array.from({ length: 400 }, (_, i) => ({ start: i * 9.3, end: i * 9.3 + 0.5 }));
    const chunks = planChunks({ durationSec: 3600, maxChunkSec: 540, silences });
    expectValid(chunks, 3600, 540);
    // Every cut point falls within some silence.
    for (const c of chunks.slice(0, -1)) expect(silences.some((s) => s.start <= c.end && c.end <= s.end)).toBe(true);
  });

  it('errors when the limit is invalid', () => {
    expect(() => planChunks({ durationSec: 10, maxChunkSec: 0, silences: [] })).toThrow();
  });
});

describe('chunkLimitSec', () => {
  it('takes the smaller of the duration and byte limits, then applies the margin', () => {
    expect(chunkLimitSec({ maxDurationSec: 1800, maxInputBytes: null, bytesPerSec: 32000 })).toBeCloseTo(1620);
    expect(chunkLimitSec({ maxDurationSec: null, maxInputBytes: 3_200_000, bytesPerSec: 32000 })).toBeCloseTo(90);
    expect(chunkLimitSec({ maxDurationSec: 60, maxInputBytes: 3_200_000, bytesPerSec: 32000 })).toBeCloseTo(54);
  });

  it('uses the preferred chunk length when it is shorter; unlimited when neither is set', () => {
    expect(chunkLimitSec({ maxDurationSec: null, maxInputBytes: 25_000_000, bytesPerSec: 8000, preferredSec: 120 })).toBe(120);
    expect(chunkLimitSec({ maxDurationSec: null, maxInputBytes: null, bytesPerSec: 8000 })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('parseSilences', () => {
  it('reads silencedetect start and end; a silence without an end runs to the end', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 1.5',
      '[silencedetect @ 0x1] silence_end: 2.25 | silence_duration: 0.75',
      'size=N/A time=00:00:05.00',
      '[silencedetect @ 0x1] silence_start: -0.01',
      '[silencedetect @ 0x1] silence_end: 0.4 | silence_duration: 0.41',
      '[silencedetect @ 0x1] silence_start: 9',
    ].join('\n');
    expect(parseSilences(stderr, 10)).toEqual([
      { start: 1.5, end: 2.25 },
      { start: 0, end: 0.4 },
      { start: 9, end: 10 },
    ]);
  });
});
