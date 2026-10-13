import { describe, expect, it } from 'vitest';
import { flushEditors, registerEditorFlush, useEditorReveal } from './editor-bridge.ts';

describe('editor-bridge', () => {
  it('before sending, waits only for the editors of these decks that are open; returns the names of those not saved; after unregistering, no longer waits', async () => {
    const calls: string[] = [];
    const offA = registerEditorFlush('a', { flush: async () => (calls.push('a'), true), name: () => '甲' });
    const offB = registerEditorFlush('b', { flush: async () => (calls.push('b'), false), name: () => '乙' });
    const offC = registerEditorFlush('c', { flush: () => Promise.reject(new Error('gone')), name: () => '丙' });
    // The same deck open in two tabs: when neither has been saved, the name is still written only once
    const offC2 = registerEditorFlush('c', { flush: async () => false, name: () => '丙' });
    expect(await flushEditors([])).toEqual([]);
    expect(await flushEditors(['a', 'a', 'missing'])).toEqual([]);
    expect(calls).toEqual(['a']);
    expect(await flushEditors(['a', 'b'])).toEqual(['乙']);
    expect(await flushEditors(['c', 'b'])).toEqual(['丙', '乙']);
    offB();
    offC();
    offC2();
    expect(await flushEditors(['b', 'c'])).toEqual([]);
    offA();
  });

  it('jump requests are stored per deck; when taken, only one is honored (clicking again is a new one)', () => {
    const { request } = useEditorReveal.getState();
    request('d1', 'n1', 's01#title');
    const first = useEditorReveal.getState().reveals.d1!;
    request('d1', 'n1', 's01#title');
    const second = useEditorReveal.getState().reveals.d1!;
    expect(second.seq).toBeGreaterThan(first.seq);
    useEditorReveal.getState().take('d1', first.seq);
    expect(useEditorReveal.getState().reveals.d1).toEqual(second);
    useEditorReveal.getState().take('d1', second.seq);
    expect(useEditorReveal.getState().reveals).toEqual({});
  });
});
