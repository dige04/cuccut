import { describe, expect, it } from 'vitest';
import { FULL_VOLUME, monitorGain, monitorLevel, stepMonitor, toggleMute } from './preview-volume.ts';

describe('preview listening volume', () => {
  it('one step is 10, clamped to 0–100', () => {
    expect(stepMonitor(FULL_VOLUME, 1)).toEqual({ volume: 100, muted: false });
    expect(stepMonitor(FULL_VOLUME, -1)).toEqual({ volume: 90, muted: false });
    expect(stepMonitor({ volume: 4, muted: false }, -1)).toEqual({ volume: 0, muted: true });
  });

  it('stepping up cancels mute; stepping down counts as muted only at 0 (prototype stepVol)', () => {
    expect(stepMonitor({ volume: 60, muted: true }, 1)).toEqual({ volume: 70, muted: false });
    expect(stepMonitor({ volume: 60, muted: true }, -1)).toEqual({ volume: 50, muted: false });
    expect(stepMonitor({ volume: 10, muted: false }, -1)).toEqual({ volume: 0, muted: true });
    expect(stepMonitor({ volume: 0, muted: true }, 1)).toEqual({ volume: 10, muted: false });
  });

  it('M only toggles mute; the volume is still remembered', () => {
    expect(toggleMute({ volume: 40, muted: false })).toEqual({ volume: 40, muted: true });
    expect(toggleMute({ volume: 40, muted: true })).toEqual({ volume: 40, muted: false });
  });

  it('converts to and from the engine\'s 0–1 multiplier', () => {
    expect(monitorGain({ volume: 70, muted: true })).toEqual({ volume: 0.7, muted: true });
    expect(monitorLevel({ volume: 0.7, muted: false })).toEqual({ volume: 70, muted: false });
    expect(monitorLevel({ volume: 3, muted: false })).toEqual({ volume: 100, muted: false });
  });
});
