import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNarrow } from './use-narrow.ts';

vi.mock('react', () => ({ useEffect: vi.fn(), useState: vi.fn() }));

describe('useNarrow', () => {
  const setNarrow = vi.fn();
  const observe = vi.fn();
  const disconnect = vi.fn();
  let receive: ResizeObserverCallback;
  let cleanup: (() => void) | undefined;
  let outerWidth: number;
  const element = { getBoundingClientRect: () => ({ width: outerWidth }) } as HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = undefined;
    outerWidth = 556;
    vi.mocked(useState).mockReturnValue([false, setNarrow]);
    vi.mocked(useEffect).mockImplementation((effect) => {
      const dispose = effect();
      if (dispose) cleanup = () => { dispose(); };
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { receive = callback; }
      observe = observe;
      disconnect = disconnect;
    });
  });

  afterEach(() => {
    cleanup?.();
    vi.unstubAllGlobals();
  });

  function resize(contentWidth: number, borderBox = true) {
    const entry = {
      target: element,
      contentRect: { width: contentWidth },
      borderBoxSize: borderBox ? [{ inlineSize: outerWidth }] : [],
    } as unknown as ResizeObserverEntry;
    receive([entry], {} as ResizeObserver);
  }

  it('after input padding shrinks from 24px to 12px, the threshold width stays compact and does not flip back and forth', () => {
    useNarrow({ current: element }, 520 + 24 * 2, 'border-box');
    expect(observe).toHaveBeenCalledWith(element, { box: 'border-box' });
    let compact = false;
    const modes: boolean[] = [];
    for (let frame = 0; frame < 8; frame++) {
      resize(outerWidth - 2 * (compact ? 12 : 24));
      compact = setNarrow.mock.lastCall![0];
      modes.push(compact);
    }
    expect(modes).toEqual(Array(8).fill(true));
  });

  it('switches only when the actual outer width crosses the breakpoint; equal to the breakpoint uses the normal layout', () => {
    useNarrow({ current: element }, 568, 'border-box');
    outerWidth = 567;
    resize(543);
    expect(setNarrow).toHaveBeenLastCalledWith(true);
    outerWidth = 568;
    resize(544);
    expect(setNarrow).toHaveBeenLastCalledWith(false);
    outerWidth = 620;
    resize(572);
    expect(setNarrow).toHaveBeenLastCalledWith(false);
  });

  it('without borderBoxSize, still judges by the border-box width', () => {
    useNarrow({ current: element }, 568, 'border-box');
    resize(532, false);
    expect(setNarrow).toHaveBeenLastCalledWith(true);
    outerWidth = 600;
    resize(552, false);
    expect(setNarrow).toHaveBeenLastCalledWith(false);
  });

  it('other callers still judge by content width by default, and stop observing on unmount', () => {
    useNarrow({ current: element }, 520);
    expect(observe).toHaveBeenCalledWith(element, { box: 'content-box' });
    resize(508);
    expect(setNarrow).toHaveBeenLastCalledWith(true);
    resize(532);
    expect(setNarrow).toHaveBeenLastCalledWith(false);
    cleanup?.();
    cleanup = undefined;
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
