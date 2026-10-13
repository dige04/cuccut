import { describe, expect, it } from 'vitest';
import { flushEditors, registerEditorFlush, useEditorReveal } from './editor-bridge.ts';

describe('editor-bridge', () => {
  it('发送前只等这几份 deck 打开着的编辑器；返回没保存成的那几份的名字，注销后不再等', async () => {
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

  it('跳转的要求按 deck 存，取走时只认同一次（再点一次是新的）', () => {
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
