import { describe, expect, it, vi } from 'vitest';
import { memoryOf, useHomeMemory } from './home-memory-store.ts';

// Node has no usable localStorage: give persistence an in-memory version, loaded before the store module. Pre-load one saved memory.
const data = vi.hoisted(() => {
  const map = new Map<string, string>([['cuccut.homeMemory', JSON.stringify({ state: { project: 'proj_a', target: ' 日文 ' }, version: 1 })]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  });
  return map;
});

describe('start page remembered choices', () => {
  it('reads back the last project and target language; bad data is treated as none', () => {
    expect(useHomeMemory.getState()).toMatchObject({ project: 'proj_a', target: '日文' });
    expect(memoryOf({ project: 3, target: '   ' })).toEqual({ project: null, target: null });
    expect(memoryOf(null)).toEqual({ project: null, target: null });
  });

  it('choosing \'no project\' records null; the entered target language is trimmed before recording; both are written back to this computer', () => {
    useHomeMemory.getState().setProject(null);
    useHomeMemory.getState().setTarget('  English ');
    expect(useHomeMemory.getState()).toMatchObject({ project: null, target: 'English' });
    expect(JSON.parse(data.get('cuccut.homeMemory')!).state).toEqual({ project: null, target: 'English' });
  });
});
