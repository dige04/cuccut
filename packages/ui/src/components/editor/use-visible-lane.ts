import { useLayoutEffect, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/** The visible range is rounded to this granularity, so that it repaints less often while scrolling. */
const WINDOW_STEP = 256;

/**
 * The width and horizontal scroll position of one scroll container. Everything on the same container (the timeline, each filmstrip, each subtitle block) shares one measurement and one scroll listener. It is measured once on creation, then updated by scroll events and ResizeObserver callbacks, and broadcast to each consumer.
 */
interface Viewport {
  width: number;
  scrollLeft: number;
  readonly listeners: Set<() => void>;
  readonly dispose: () => void;
}

const viewports = new WeakMap<HTMLElement, Viewport>();

function attach(element: HTMLElement, listener: () => void): Viewport {
  let viewport = viewports.get(element);
  if (!viewport) {
    const listeners = new Set<() => void>();
    const notify = () => {
      for (const each of listeners) each();
    };
    // On user scroll or size change, each consumer's new range is drawn into the DOM together right away (flushSync), so the content drawn in this frame matches the new position.
    // Otherwise React schedules it after this frame, and a scroll of more than one screen at once (a fast wheel flick, dragging the scrollbar) would show a blank frame.
    // A scroll the timeline re-emits in a layout effect (isTrusted false) is already handled synchronously within the commit, so it must not and need not use flushSync again.
    const onScroll = (event: Event) => {
      created.scrollLeft = element.scrollLeft;
      if (event.isTrusted) flushSync(notify);
      else notify();
    };
    const observer = new ResizeObserver(() => {
      created.width = element.clientWidth;
      created.scrollLeft = element.scrollLeft;
      flushSync(notify);
    });
    const created: Viewport = {
      width: element.clientWidth,
      scrollLeft: element.scrollLeft,
      listeners,
      dispose: () => {
        element.removeEventListener('scroll', onScroll);
        observer.disconnect();
        viewports.delete(element);
      },
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(element);
    viewports.set(element, created);
    viewport = created;
  }
  viewport.listeners.add(listener);
  return viewport;
}

function detach(element: HTMLElement, listener: () => void) {
  const viewport = viewports.get(element);
  if (!viewport) return;
  viewport.listeners.delete(listener);
  if (viewport.listeners.size === 0) viewport.dispose();
}

function rangeOf(viewport: Viewport, head: number, margin: number): { left: number; right: number } {
  const width = viewport.width - head;
  return {
    left: Math.floor((viewport.scrollLeft - width * margin) / WINDOW_STEP) * WINDOW_STEP,
    right: Math.ceil((viewport.scrollLeft + width * (1 + margin)) / WINDOW_STEP) * WINDOW_STEP,
  };
}

/**
 * The horizontal visible range of the timeline (relative to the left edge of the track content, in pixels). `margin` extends the range by that many screens on each side: clips and subtitle sentences are drawn one extra screen so that no blank shows while scrolling. Consumers that request data from the Runtime (filmstrips) compute only the visible range.
 *
 * Recomputed immediately on scroll and size change (not through requestAnimationFrame, which does not fire while the window is in the background), rounded to 256px, and not repainted if the cell did not change. After zooming, the timeline sets its scroll position in a layout effect and then re-emits one `scroll`, so each consumer switches to the new range before painting.
 */
export function useVisibleLane(scrollRef: RefObject<HTMLDivElement | null>, head: number, margin = 1): { left: number; right: number } {
  // If the container has already been measured (clips and subtitles mounted mid-scroll), start the range from it directly, so the first render is not drawn with the default range.
  const [range, setRange] = useState(() => {
    const viewport = scrollRef.current ? viewports.get(scrollRef.current) : undefined;
    return viewport ? rangeOf(viewport, head, margin) : { left: 0, right: 4096 };
  });
  // Computed before painting: the first frame is drawn with the real range, not with the default range first (which would show a blank frame).
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      const next = rangeOf(viewport, head, margin);
      setRange((current) => (current.left === next.left && current.right === next.right ? current : next));
    };
    const viewport = attach(element, update);
    update();
    return () => detach(element, update);
  }, [scrollRef, head, margin]);
  return range;
}
