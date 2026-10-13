import { describe, expect, it } from 'vitest';
import { FALLBACK, ICONS, KINDS, THINKING, forKind } from './agent-loader.ts';

/** The real graphic table: if it cannot be loaded (package not installed), the comparison is skipped; other assertions still run. */
const table: Record<string, unknown> | null = await import('@react-spectrum/ai/loader').then(
  (m) => m as Record<string, unknown>,
  () => null,
);

const sequences = (): [string, readonly string[]][] => [['THINKING', THINKING], ['FALLBACK', FALLBACK], ...Object.entries(KINDS)];

describe('agent-loader', () => {
  it('uses only pattern-type shapes, not letter-type shapes', () => {
    const icons = new Set<string>(ICONS);
    expect(icons.size).toBe(ICONS.length);
    for (const [key, names] of sequences()) {
      expect(names.length, key).toBeGreaterThan(0);
      for (const name of names) {
        expect(icons.has(name), `${key}: ${name}`).toBe(true);
        expect(name.startsWith('adobe'), `${key}: ${name}`).toBe(false);
      }
    }
  });

  it('the generic sequence uses every shape once, starting with aiLogo', () => {
    expect([...THINKING].sort()).toEqual([...ICONS].sort());
    expect(THINKING[0]).toBe('aiLogo');
  });

  it('every shape is used in at least one category', () => {
    const used = new Set<string>([...FALLBACK, ...Object.values(KINDS).flat()]);
    expect(ICONS.filter((name) => !used.has(name))).toEqual([]);
  });

  it('the same category always returns the same array; unrecognized categories use FALLBACK', () => {
    for (const kind of Object.keys(KINDS)) expect(forKind(kind)).toBe(forKind(kind));
    expect(forKind('transcribe')).toBe(KINDS.transcribe);
    expect(forKind('no-such-kind')).toBe(FALLBACK);
    expect(forKind('toString')).toBe(FALLBACK);
    expect(forKind('other')).toBe(FALLBACK);
    expect(Object.isFrozen(KINDS.cut)).toBe(true);
  });

  describe.skipIf(!table)('matches @react-spectrum/ai/loader', () => {
    it('ICONS is exactly all single non-letter shapes', () => {
      const singles = Object.entries(table ?? {})
        .filter(([name, v]) => Array.isArray(v) && v.length > 0 && !Array.isArray(v[0]) && !name.startsWith('adobe'))
        .map(([name]) => name);
      expect(singles.sort()).toEqual([...ICONS].sort());
    });
  });
});
