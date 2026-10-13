import { describe, expect, it } from 'vitest';
import type { JobRecord } from '@cuccut/protocol';
import { exportSpeed, SPEED_WINDOW_MS, trackSpeed, type SpeedTrack } from './export-speed.ts';

type Rec = Pick<JobRecord, 'kind' | 'state' | 'phase' | 'progress' | 'updatedAt'>;

const T0 = Date.parse('2026-10-08T08:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
const frames = (ms: number, done: number, total = 6000): Rec => ({
  kind: 'export',
  state: 'running',
  phase: 'generating',
  progress: { done, total, unit: 'frames' },
  updatedAt: at(ms),
});

function feed(records: readonly Rec[]): SpeedTrack | undefined {
  return records.reduce<SpeedTrack | undefined>((track, job) => trackSpeed(track, job), undefined);
}

describe('export speed and remaining time', () => {
  it('computes fps and remaining time from progress over the last few seconds', () => {
    const jobs = [frames(0, 0), frames(500, 30), frames(1000, 60), frames(2000, 120)];
    const speed = exportSpeed(feed(jobs), jobs[jobs.length - 1]!);
    expect(speed?.fps).toBeCloseTo(60);
    expect(speed?.secondsLeft).toBeCloseTo((6000 - 120) / 60);
  });

  it('cannot be computed when the sample is under one second or there is no progress', () => {
    const early = [frames(0, 0), frames(400, 24)];
    expect(exportSpeed(feed(early), early[1]!)).toBeNull();
    const stalled = [frames(0, 50), frames(3000, 50)];
    expect(exportSpeed(feed(stalled), stalled[1]!)).toBeNull();
  });

  it('looks only at the recent window: when it was slow earlier and fast later, uses the later speed', () => {
    const jobs: Rec[] = [];
    for (let s = 0; s <= 10; s++) jobs.push(frames(s * 1000, s <= 5 ? s * 10 : 50 + (s - 5) * 100));
    const track = feed(jobs)!;
    expect(track.samples[0]!.at).toBe(T0 + 10000 - SPEED_WINDOW_MS);
    expect(exportSpeed(track, jobs[jobs.length - 1]!)?.fps).toBeCloseTo(100);
  });

  it('restarts recording when the total changes or the number goes backward; not recorded outside the render stage (downloading fonts, saving files)', () => {
    const running = feed([frames(0, 0), frames(2000, 100)])!;
    expect(trackSpeed(running, frames(3000, 10))?.samples).toEqual([{ at: T0 + 3000, done: 10 }]);
    expect(trackSpeed(running, frames(3000, 150, 9000))?.samples).toHaveLength(1);
    const publishing: Rec = { ...frames(3000, 0), phase: 'publishing', progress: { done: 0, total: 2, unit: 'outputs' } };
    expect(trackSpeed(running, publishing)).toBeUndefined();
    expect(exportSpeed(running, publishing)).toBeNull();
    const fonts: Rec = { ...frames(3000, 0), phase: 'downloading', progress: { done: 1e5, total: 1e6, unit: 'bytes' } };
    expect(trackSpeed(undefined, fonts)).toBeUndefined();
  });

  it('not recorded when not running, not an export, or with no total; when the unit is not frames, only remaining time is shown', () => {
    expect(trackSpeed(undefined, { ...frames(0, 0), state: 'completed' })).toBeUndefined();
    expect(trackSpeed(undefined, { ...frames(0, 0), kind: 'transcribe' })).toBeUndefined();
    expect(trackSpeed(undefined, { ...frames(0, 0), progress: { done: 0, total: null, unit: 'frames' } })).toBeUndefined();
    const audio = (ms: number, done: number): Rec => ({ ...frames(ms, 0), progress: { done, total: 120, unit: 'seconds' } });
    const jobs = [audio(0, 0), audio(2000, 20)];
    expect(exportSpeed(feed(jobs), jobs[1]!)).toEqual({ rate: 10, fps: null, secondsLeft: 10 });
  });

  it('unchanged when the same sample arrives again', () => {
    const track = feed([frames(0, 0), frames(1500, 90)]);
    expect(trackSpeed(track, frames(1500, 90))).toBe(track);
  });
});
