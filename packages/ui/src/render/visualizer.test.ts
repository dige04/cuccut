import { describe, expect, it } from 'vitest';
import { WAVE_STYLES, waveStyleKey } from './visualizer.ts';

describe('waveform styles', () => {
  it('10 styles, key order follows the inspector\'s catalog order; old names are merged into the new styles', () => {
    expect(Object.keys(WAVE_STYLES)).toEqual([
      'bars',
      'bars_rounded',
      'bars_bottom',
      'ring_bars',
      'oscilloscope',
      'ring_wave',
      'spectrum_area',
      'dots',
      'pulse_rings',
      'ribbons',
    ]);
    expect(waveStyleKey('beam')).toBe('oscilloscope');
    expect(waveStyleKey('harmony')).toBe('ribbons');
    expect(waveStyleKey('ripple_wave')).toBe('pulse_rings');
    expect(waveStyleKey('formation_circle')).toBe('ring_bars');
    expect(waveStyleKey('static')).toBe('bars_bottom');
    expect(waveStyleKey('bars')).toBe('bars');
    expect(waveStyleKey('nope')).toBeNull();
  });

  it('the two time-domain styles use the narrow −120 / −10 window with no dB control; the spectrum styles use −80 / 40', () => {
    expect(WAVE_STYLES.oscilloscope).toMatchObject({ hasControl: false, minDb: -120, maxDb: -10 });
    expect(WAVE_STYLES.ring_wave).toMatchObject({ hasControl: false, aspect: 'square' });
    expect(WAVE_STYLES.dots).toMatchObject({ hasControl: true, minDb: -80, maxDb: 40, secondaryColor: '#FF4C45' });
  });
});
