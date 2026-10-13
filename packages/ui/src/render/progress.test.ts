import { describe, expect, it } from 'vitest';
import { PROGRESS_STYLES } from './progress.ts';

describe('progress bar styles', () => {
  it('14 styles; key order is the order of the property page directory', () => {
    expect(Object.keys(PROGRESS_STYLES)).toEqual([
      'normal',
      'rounded',
      'circle',
      'donut',
      'border',
      'reverse_border',
      'rainbow_border',
      'reverse_rainbow_border',
      'strobe_border',
      'reverse_strobe_border',
      'snake',
      'snake_spin',
      'snake_rainbow',
      'snake_spin_rainbow',
    ]);
  });
});
