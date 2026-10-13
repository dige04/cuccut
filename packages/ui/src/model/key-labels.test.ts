import { describe, expect, it } from 'vitest';
import { keyLabel } from './key-labels.ts';

describe('keyLabel', () => {
  it('macOS shows as is', () => {
    expect(keyLabel('⌘Z / ⇧⌘Z', true)).toBe('⌘Z / ⇧⌘Z');
    expect(keyLabel('⌥← / ⌥→', true)).toBe('⌥← / ⌥→');
  });

  it('Windows and Linux use Ctrl+ / Shift+ / Alt+', () => {
    expect(keyLabel('⌘Z / ⇧⌘Z', false)).toBe('Ctrl+Z / Shift+Ctrl+Z');
    expect(keyLabel('⌥← / ⌥→', false)).toBe('Alt+← / Alt+→');
    expect(keyLabel('⇧← / ⇧→', false)).toBe('Shift+← / Shift+→');
  });

  it('a modifier key written alone followed by a space gets no "+"', () => {
    expect(keyLabel('方向键（⇧ 走 5%，⌥↑ / ⌥↓ 走 0.1%）', false)).toBe('方向键（Shift 走 5%，Alt+↑ / Alt+↓ 走 0.1%）');
  });

  it('keys without modifiers are unchanged', () => {
    expect(keyLabel('Space / K', false)).toBe('Space / K');
    expect(keyLabel('?', false)).toBe('?');
  });
});
