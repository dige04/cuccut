import { useEffect, useRef, type RefObject } from 'react';
import { useEditor } from '../../state/editor-store.ts';

/**
 * Playback-follow switch for the subtitle list and the translation comparison list (product design §5.7, same rule as the transcript): during playback, if the user scrolls away manually, it turns off. It is restored when seeking in this panel (clicking a time, clicking a card, search jump), or when playback restarts from pause. The lists themselves decide where and how to follow (both only scroll into view, not centered).
 *
 * Manual scroll-away counts only user input, the same rule as the transcript panel (`leaveFollow` in transcript-panel.tsx) and the prototype: wheel, touch drag, and pressing on the scroll container itself (that is, the scrollbar). Scroll events are not used. Scrolling that the virtual list does itself (writing scrollTop to compensate anchors or align) does not count, and neither does the scroll caused by focus() when opening a half-visible card for editing. Keyboard paging (PageDown etc.) does not count either, same as the transcript. Input while paused does not count (paused never follows anyway).
 */
export function usePlaybackFollow(scrollRef: RefObject<HTMLElement | null>): { off: RefObject<boolean>; resume(): void } {
  const off = useRef(false);
  const playing = useEditor((s) => s.playing);
  const resume = useRef(() => {
    off.current = false;
  }).current;
  // Must come before the list's own follow effect (in the same commit, restore first, then follow): the caller calls this hook first.
  useEffect(() => {
    if (playing) resume();
  }, [playing, resume]);

  // The scroll container may appear after this hook (the panel first draws “Loading…”): check after every commit, and re-attach if it changed.
  const attached = useRef<{ el: HTMLElement; detach(): void } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (attached.current?.el === el) return;
    attached.current?.detach();
    attached.current = null;
    if (!el) return;
    const leave = () => {
      if (useEditor.getState().playing) off.current = true;
    };
    // Pressed on the container itself (not on a card inside it): this can only be the scrollbar.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === el) leave();
    };
    el.addEventListener('wheel', leave, { passive: true });
    el.addEventListener('touchmove', leave, { passive: true });
    el.addEventListener('pointerdown', onPointerDown);
    attached.current = {
      el,
      detach: () => {
        el.removeEventListener('wheel', leave);
        el.removeEventListener('touchmove', leave);
        el.removeEventListener('pointerdown', onPointerDown);
      },
    };
  });
  useEffect(
    () => () => {
      attached.current?.detach();
      attached.current = null;
    },
    [],
  );
  return { off, resume };
}
