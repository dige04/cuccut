import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';
import {
  alignedScrollTop,
  anchorShift,
  layoutRows,
  rowAt,
  rowHeight,
  rowRange,
  rowSegments,
  type Align,
  type RowLayout,
  type RowSegment,
} from '../../model/virtual-rows.ts';

export type { Align, RowSegment };

/** Before the viewport height has been measured, rows are laid out at this height (replaced with the real height in a layout effect at mount, so it is never drawn). */
const FALLBACK_VIEWPORT = 800;
/** After how long a scrollTop we wrote is no longer treated as a program scroll. When the panel is hidden, scroll events do not arrive, so the recorded value would linger. */
const PROGRAMMATIC_TTL = 500;
/** scrollToIndex: estimate, measure, correct, at most this many round trips. */
const MAX_SETTLE = 8;
/** A height difference this small does not count as a change (measured heights are fractions, e.g. 67.390625). */
const EPSILON = 0.01;

export interface VirtualRowsOptions {
  /** Scroll container. Rows are laid out in normal document flow inside it (the container's top padding is treated as 0); there must be no margin between rows. */
  scrollRef: RefObject<HTMLElement | null>;
  /** A stable key per row (rows follow their key when added or removed: height cache, pinning, anchoring). */
  keys: readonly string[];
  /** Estimated height (border-box) of rows not yet measured; `width` is the container's content width. Changing the function's identity re-lays-out everything (used when row content changes). */
  estimate: (index: number, width: number) => number;
  /** Extra screens mounted before and after the viewport, default 1. */
  overscan?: number;
  /** Rows that stay mounted regardless of the window (being edited, search hits, ...); null skips this. */
  pinned?: readonly (string | null | undefined)[];
  /**
   * Indices of sticky rows (`position: sticky` group headers), ascending. The nearest such row at or before the top of the viewport is always mounted, so a header stuck to the top does not vanish when it scrolls out of the window.
   */
  sticky?: readonly number[];
  /**
   * How rows are drawn (e.g. the transcript view or the translation language). When this changes, the height of the same key changes too, so the measured heights of unmounted rows are discarded and reset to the new estimate. Content changes (editing words, cutting) do not need this: the changed rows are usually mounted and get measured again.
   */
  measureKey?: string;
}

export interface VirtualRows {
  /** Segments in index order: an empty span renders as an empty div of that height (`aria-hidden`); a row span renders that row. */
  segments: RowSegment[];
  /**
   * Outer ref of a row: cached by key, so the same key gets the same function (memoized row components can take it directly). The outer row element must also carry `role="listitem"`, `aria-setsize` (row count), and `aria-posinset` (index + 1).
   */
  measureRef(key: string): (element: HTMLElement | null) => void;
  /** Scroll row `index` into the viewport: first jump by the estimate, then, after it mounts and is measured, correct. resolve(true) once the row is mounted, measured and aligned; resolve(false) if the user scrolls or another request interrupts it. */
  scrollToIndex(index: number, options?: { align?: Align }): Promise<boolean>;
  /** Program-scroll to `top` (recorded as a program scroll). Used to align a given element within a row afterwards. */
  scrollTo(top: number): void;
  /** Top edge of row `index` in the current layout (total height when `index` equals the row count). The panel uses it when splitting empty spans by group; same layout as `segments`. */
  rowTop(index: number): number;
  /**
   * A child component inside a row may require that the row not be unmounted (a menu is open, an inline input is active, ...). This is a per-key switch: the row's outer element passes it to children via `RowHoldContext`, and children call `useHoldRow(condition)`. When several parts request it, it is released only when all of them release it.
   */
  holdRow(key: string): (on: boolean) => void;
  /** What the scroll container carries: the list role; focus in and out (the focused row and one row before and after it are pinned); and turning off the browser's own scroll anchoring, since compensation is done manually here. */
  containerProps: {
    role: 'list';
    style: CSSProperties;
    onFocus(event: FocusEvent<HTMLElement>): void;
    onBlur(event: FocusEvent<HTMLElement>): void;
  };
}

interface Pending {
  key: string;
  align: Align;
  tries: number;
  resolve(done: boolean): void;
}

interface View {
  top: number;
  height: number;
  width: number;
  /** Whether the container has been measured. If not (just mounted, container not yet present), no rows are mounted, so that rows are not mounted at guessed sizes and immediately replaced. */
  known: boolean;
}

const UNKNOWN: RowLayout = { offsets: new Float64Array(1), total: 0 };

/**
 * Vertical virtual list with variable row heights (pure functions in model/virtual-rows.ts): only the rows within `overscan` screens of the viewport, plus pinned rows, are mounted; the rest are folded into empty divs. Rows stay in normal document flow, with no absolute positioning. Row heights are cached by key from border-box heights measured with ResizeObserver. When the container's content width changes, the old heights of unmounted rows are discarded.
 *
 * Browser scroll anchoring is turned off (`overflow-anchor: none`), and this hook does the compensation. When rows above the viewport measure differently from their estimate, scrollTop is adjusted by the difference in the ResizeObserver callback (after layout, before paint). When rows are added or removed, or the estimate changes, it compensates in a layout effect using the anchor row's key. Correctness does not rely on requestAnimationFrame (it does not fire while the panel is hidden): heights are measured by ResizeObserver and synchronous reads in layout effects, and writing a scroll target updates the window synchronously.
 */
export function useVirtualRows({
  scrollRef,
  keys,
  estimate,
  overscan = 1,
  pinned = [],
  sticky = [],
  measureKey = '',
}: VirtualRowsOptions): VirtualRows {
  const [view, setView] = useState<View>({ top: 0, height: 0, width: 0, known: false });
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const focused = useRef(focusKey);
  focused.current = focusKey;
  /** Rows that children require to stay mounted: key → number of requesters. */
  const [held, setHeld] = useState<ReadonlyMap<string, number>>(() => new Map());
  const holds = useRef(new Map<string, (on: boolean) => void>()).current;

  const heights = useRef(new Map<string, number>()).current;
  const elements = useRef(new Map<string, HTMLElement>()).current;
  const keyOf = useRef(new WeakMap<Element, string>()).current;
  const callbacks = useRef(new Map<string, (element: HTMLElement | null) => void>()).current;
  /** Newly mounted rows not yet measured: measured synchronously in a layout effect (not waiting for ResizeObserver). */
  const fresh = useRef(new Set<string>()).current;
  const observer = useRef<ResizeObserver | null>(null);
  /** The layout the DOM currently reflects (empty spans are drawn from it; mounted rows use their measured heights). Compensation uses it as the “before”. */
  const baseline = useRef<{ keys: readonly string[]; layout: RowLayout } | null>(null);
  const pending = useRef<Pending | null>(null);
  const written = useRef<{ value: number; at: number }[]>([]);
  /** Last known scrollTop (from scroll events, from our own writes, and after each commit's compensation). When content gets shorter, the browser clamps scrollTop to the bottom first, so anchor compensation uses the value from before clamping. */
  const lastTop = useRef(0);
  /** Content width used for measuring (the ResizeObserver callback checks whether the width changed, without waiting for render). */
  const widthRef = useRef(0);

  const width = view.width;
  /** Which drawing mode the measured heights belong to. When it changes (e.g. switching views), the old heights of unmounted rows are discarded. */
  const measuredFor = useRef(measureKey);
  // Estimates are recomputed only when the rows, the estimate function or the width change (counting lines word by word is not cheap for thousands of rows). When a new measured height arrives, only the running sums are recomputed.
  const estimates = useMemo(() => {
    if (measuredFor.current !== measureKey) {
      // When the content of a mounted row changes, ResizeObserver measures it again. Unmounted rows return to the new estimate, so that when scrolling back, the wrong height is not used and the total height does not jump in blocks.
      measuredFor.current = measureKey;
      for (const key of [...heights.keys()]) if (!elements.has(key)) heights.delete(key);
    }
    return view.known ? Float64Array.from(keys, (_, i) => estimate(i, width)) : null;
  }, [keys, estimate, width, view.known, measureKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = useMemo(
    () => (estimates ? layoutRows(keys, heights, (i) => estimates[i]!) : UNKNOWN),
    // version: the measured height changed
    [estimates, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const indexOf = useMemo(() => new Map(keys.map((key, i) => [key, i])), [keys]);
  const viewport = view.height || FALLBACK_VIEWPORT;
  const range = rowRange(layout, view.top, viewport, overscan * viewport);
  const focusIndex = focusKey === null ? undefined : indexOf.get(focusKey);
  const pins: number[] = [];
  for (const key of pinned) {
    const i = key == null ? undefined : indexOf.get(key);
    if (i !== undefined) pins.push(i);
  }
  if (focusIndex !== undefined) pins.push(focusIndex - 1, focusIndex, focusIndex + 1);
  for (const key of held.keys()) {
    const i = indexOf.get(key);
    if (i !== undefined) pins.push(i);
  }
  if (sticky.length && estimates) {
    // The nearest sticky row at or before the top of the viewport (binary search).
    const top = rowAt(layout, view.top);
    let lo = 0;
    let hi = sticky.length - 1;
    let hit = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sticky[mid]! <= top) {
        hit = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (hit >= 0) pins.push(sticky[hit]!);
  }
  const pinKey = pins.join(',');
  const segments = useMemo(
    () => (estimates ? rowSegments(layout, range, pins) : []),
    [layout, range[0], range[1], pinKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Outside render (callbacks, effects), read the latest values.
  const latest = useRef({ keys, layout, indexOf, range, overscan });
  latest.current = { keys, layout, indexOf, range, overscan };

  /** Write scrollTop and record the value read back (the browser clamps it to the bottom). When a scroll event arrives, use this to recognize our own scroll. The window syncs immediately. */
  const write = useCallback(
    (el: HTMLElement, top: number) => {
      const before = el.scrollTop;
      el.scrollTop = top;
      const now = el.scrollTop;
      lastTop.current = now;
      if (Math.abs(now - before) >= 0.5) written.current.push({ value: now, at: performance.now() });
      setView((v) => (v.top === now ? v : { ...v, top: now }));
    },
    [setView],
  );

  /** A batch of measured heights (key → border-box height): compensate anchors against the DOM's current layout, and record them in the cache. Returns whether anything changed. */
  const apply = useCallback(
    (measured: Iterable<[string, number]>): boolean => {
      const base = baseline.current;
      const changed = new Map<string, number>();
      for (const [key, height] of measured) {
        const previous = heights.get(key);
        heights.set(key, height);
        // Compared with this row's height in the DOM's current layout (where unmeasured rows are estimates).
        const index = latest.current.indexOf.get(key);
        const modeled = base && index !== undefined && base.keys[index] === key ? rowHeight(base.layout, index) : previous;
        if (modeled === undefined || Math.abs(modeled - height) > EPSILON) changed.set(key, height);
      }
      if (!changed.size) return false;
      const el = scrollRef.current;
      if (base && el) {
        // DOM now = the previous layout with these rows swapped in at their real heights (empty spans contain only unmounted rows, so they are unchanged).
        const after = layoutRows(base.keys, changed, (i) => rowHeight(base.layout, i));
        if (!pending.current && el.scrollTop > 0) {
          const shift = anchorShift(base.layout, after, rowAt(base.layout, el.scrollTop));
          if (Math.abs(shift) >= 0.5) write(el, el.scrollTop + shift);
        }
        baseline.current = { keys: base.keys, layout: after };
      }
      return true;
    },
    [heights, scrollRef, write],
  );

  /** A scrollToIndex is waiting: recompute the target against the current layout. If it is not aligned, write it; if it is aligned and that row is mounted and measured, resolve. */
  const settle = useCallback(() => {
    const request = pending.current;
    const el = scrollRef.current;
    const base = baseline.current;
    if (!request) return;
    const finish = (done: boolean) => {
      pending.current = null;
      request.resolve(done);
    };
    // Container not yet measured: wait for the commit that measures it.
    if (el && !base) return;
    const index = latest.current.indexOf.get(request.key);
    if (!el || !base || index === undefined || base.keys[index] !== request.key) return finish(false);
    const target = alignedScrollTop(base.layout, index, el.clientHeight, el.scrollTop, request.align);
    const want = Math.min(target, Math.max(0, el.scrollHeight - el.clientHeight));
    const ready = elements.has(request.key) && heights.has(request.key);
    if (Math.abs(el.scrollTop - want) <= 1 && ready) return finish(true);
    if (++request.tries > MAX_SETTLE) return finish(ready);
    if (Math.abs(el.scrollTop - want) > 1) write(el, want);
    // Already aligned, but that row is not mounted yet (window is behind): render again.
    else bump();
  }, [elements, heights, scrollRef, write]);

  const getObserver = useCallback((): ResizeObserver => {
    if (observer.current) return observer.current;
    const ro = new ResizeObserver((entries) => {
      const el = scrollRef.current;
      const measured: [string, number][] = [];
      let resized: View | null = null;
      for (const entry of entries) {
        if (entry.target === el) {
          resized = { top: el.scrollTop, height: el.clientHeight, width: contentWidth(el), known: true };
          continue;
        }
        const key = keyOf.get(entry.target);
        if (key === undefined || !entry.target.isConnected || elements.get(key) !== entry.target) continue;
        measured.push([key, entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height]);
      }
      let changed = false;
      if (resized) {
        const next = resized;
        if (next.width !== widthRef.current) {
          // Content width changed: the old heights of unmounted rows are discarded (back to the estimate for the new width), and mounted rows are re-measured right here.
          widthRef.current = next.width;
          for (const key of [...heights.keys()]) if (!elements.has(key)) heights.delete(key);
          for (const [key, element] of elements) if (element.isConnected) measured.push([key, element.getBoundingClientRect().height]);
          changed = true;
        }
        setView((v) =>
          v.width === next.width && v.height === next.height ? v : { ...v, height: next.height, width: next.width, known: true },
        );
      }
      if (apply(measured)) changed = true;
      if (changed) bump();
      settle();
    });
    observer.current = ro;
    return ro;
  }, [apply, elements, heights, keyOf, scrollRef, settle]);

  const measureRef = useCallback(
    (key: string) => {
      let callback = callbacks.get(key);
      if (!callback) {
        callback = (element: HTMLElement | null) => {
          const previous = elements.get(key);
          if (previous && previous !== element) {
            observer.current?.unobserve(previous);
            elements.delete(key);
          }
          if (!element) return;
          elements.set(key, element);
          keyOf.set(element, key);
          fresh.add(key);
          getObserver().observe(element);
        };
        callbacks.set(key, callback);
      }
      return callback;
    },
    [callbacks, elements, fresh, getObserver, keyOf],
  );

  /** Attach to the scroll container: measure the viewport, listen for scrolling, watch the container's size. Returns the function that detaches all of this. */
  const attach = useCallback(
    (el: HTMLElement) => {
      widthRef.current = contentWidth(el);
      setView({ top: el.scrollTop, height: el.clientHeight, width: widthRef.current, known: true });
      const ro = getObserver();
      ro.observe(el);
      for (const element of elements.values()) ro.observe(element);
      const onScroll = () => {
        const top = el.scrollTop;
        lastTop.current = top;
        const now = performance.now();
        written.current = written.current.filter((w) => now - w.at < PROGRAMMATIC_TTL);
        const hit = written.current.findIndex((w) => Math.abs(w.value - top) <= 1);
        if (hit >= 0) written.current.splice(hit, 1);
        else if (pending.current) {
          // The user scrolled by hand: stop chasing the alignment.
          const request = pending.current;
          pending.current = null;
          request.resolve(false);
        }
        // When the focused element is removed (e.g. an inline input is closed with Esc), browsers fire no blur. So on scroll, check whether focus is still inside the list; if not, stop pinning that row.
        if (focused.current !== null && !el.contains(document.activeElement)) setFocusKey(null);
        const { layout, range, overscan } = latest.current;
        const height = el.clientHeight || FALLBACK_VIEWPORT;
        const next = rowRange(layout, top, height, overscan * height);
        const update = () => setView((v) => (v.top === top ? v : { ...v, top }));
        // The window must change: draw synchronously (scroll events are dispatched before paint), so no blank area shows while the scrollbar is dragged.
        if (next[0] !== range[0] || next[1] !== range[1]) flushSync(update);
        else update();
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => {
        el.removeEventListener('scroll', onScroll);
        ro.disconnect();
        observer.current = null;
      };
    },
    [elements, getObserver],
  );
  // The scroll container may appear after this hook (the panel first draws “Loading…”): check after every commit, and re-attach if it changed.
  const attached = useRef<{ el: HTMLElement; detach(): void } | null>(null);
  useLayoutEffect(
    () => () => {
      attached.current?.detach();
      attached.current = null;
    },
    [],
  );

  // After every commit: if the layout changed (rows added or removed, estimate changed, width changed), compensate using the anchor row's key. Rows just mounted are measured synchronously. Then check whether an alignment is waiting.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (attached.current?.el !== el) {
      attached.current?.detach();
      attached.current = el ? { el, detach: attach(el) } : null;
    }
    const base = baseline.current;
    if (el && base && base.layout !== layout && !pending.current) {
      // When the new layout is shorter than before (e.g. switching to translation-only), the browser has already clamped scrollTop to the bottom after this commit, so the anchor is found using the position from before the clamp.
      const now = el.scrollTop;
      const clamped = lastTop.current > now + 0.5 && now >= el.scrollHeight - el.clientHeight - 1;
      const top = clamped ? lastTop.current : now;
      const anchor = top > 0 ? rowAt(base.layout, top) : -1;
      const index = anchor < 0 ? undefined : indexOf.get(base.keys[anchor]!);
      if (index !== undefined) {
        const target = layout.offsets[index]! + (top - base.layout.offsets[anchor]!);
        if (Math.abs(target - now) >= 0.5) write(el, target);
      }
    }
    // Container not yet measured and no rows mounted: there is no layout to compensate (wait for the commit that measures it).
    baseline.current = estimates ? { keys, layout } : null;
    let changed = false;
    if (fresh.size) {
      const measured: [string, number][] = [];
      for (const key of fresh) {
        const element = elements.get(key);
        if (element?.isConnected) measured.push([key, element.getBoundingClientRect().height]);
      }
      fresh.clear();
      changed = apply(measured);
    }
    if (changed) bump();
    settle();
    if (el) lastTop.current = el.scrollTop;
  });

  const scrollToIndex = useCallback(
    (index: number, options?: { align?: Align }) =>
      new Promise<boolean>((resolve) => {
        pending.current?.resolve(false);
        const key = latest.current.keys[index];
        if (key === undefined) {
          pending.current = null;
          return resolve(false);
        }
        pending.current = { key, align: options?.align ?? 'nearest', tries: 0, resolve };
        // Draw synchronously in a microtask. This is usually called from an effect, where flushSync does not take effect. A microtask still runs before this frame is painted, so the jump does not show a blank area.
        queueMicrotask(() => {
          if (pending.current?.resolve === resolve) flushSync(settle);
        });
      }),
    [settle],
  );

  const scrollTo = useCallback(
    (top: number) => {
      const el = scrollRef.current;
      if (el) write(el, top);
    },
    [scrollRef, write],
  );

  const rowTop = useCallback((index: number) => layout.offsets[Math.max(0, Math.min(index, layout.offsets.length - 1))]!, [layout]);

  const holdRow = useCallback(
    (key: string) => {
      let hold = holds.get(key);
      if (!hold) {
        hold = (on: boolean) =>
          setHeld((map) => {
            const count = (map.get(key) ?? 0) + (on ? 1 : -1);
            const next = new Map(map);
            if (count > 0) next.set(key, count);
            else next.delete(key);
            return next;
          });
        holds.set(key, hold);
      }
      return hold;
    },
    [holds],
  );

  const containerProps = useMemo<VirtualRows['containerProps']>(
    () => ({
      role: 'list',
      style: { overflowAnchor: 'none' },
      onFocus: (event) => {
        let node: Element | null = event.target;
        while (node && node !== event.currentTarget) {
          const key = keyOf.get(node);
          if (key !== undefined) return setFocusKey(key);
          node = node.parentElement;
        }
      },
      onBlur: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusKey(null);
      },
    }),
    [keyOf],
  );

  return { segments, measureRef, scrollToIndex, scrollTo, rowTop, holdRow, containerProps };
}

/** The “do not unmount this row” switch that the row's outer element passes to child components (`VirtualRows.holdRow(key)`); none when not inside the virtual list. */
export const RowHoldContext = createContext<((on: boolean) => void) | null>(null);

/** When `on` is true, keeps the containing row mounted (a menu is open, an inline input is open, ...). Does nothing when not inside the virtual list. */
export function useHoldRow(on: boolean): void {
  const hold = useContext(RowHoldContext);
  useLayoutEffect(() => {
    if (!on || !hold) return;
    hold(true);
    return () => hold(false);
  }, [on, hold]);
}

/** The container's content width (minus padding and scrollbar). */
function contentWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return Math.round(el.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
}
