import type { Easing, FrameSpan, Sequence, Transition } from '@cuccut/protocol';

/**
 * Transition window and easing (video format spec §3.9), identical to Rust `video-model/src/transition.rs`:
 *
 * - The window of a two-sided transition is placed on the cut point by `placement`: centred starts at `cut − ⌊D/2⌋`, `start-at-cut` starts at the cut point,
 *   and `end-at-cut` ends at the cut point;
 * - An in (right side only) starts at the start of the instance, and an out (left side only) ends at the end of the instance;
 * - The window is `[start, start + D)` (frames).
 */
export function transitionWindow(transition: Transition, left: FrameSpan | undefined, right: FrameSpan | undefined): [number, number] | null {
  const duration = transition.durationFrames;
  let start: number;
  if (left && right) {
    const cut = right.fromFrame;
    start = transition.placement === 'start-at-cut' ? cut : transition.placement === 'end-at-cut' ? cut - duration : cut - Math.floor(duration / 2);
  } else if (right) start = right.fromFrame;
  else if (left) start = left.fromFrame + left.durationFrames - duration;
  else return null;
  return [start, start + duration];
}

/** Easing: maps progress `p` (0–1) to the value used for drawing. */
export function applyEasing(easing: Easing, p: number): number {
  switch (easing) {
    case 'linear':
      return p;
    case 'ease-in':
      return p * p;
    case 'ease-out':
      return 1 - (1 - p) * (1 - p);
    case 'ease-in-out':
      return p * p * (3 - 2 * p);
  }
}

/**
 * A two-sided transition makes an instance draw outside its own range (the left side draws up to the window end, the right side draws from the window start): the extra frame range each instance therefore occupies.
 * The preview uses this to prepare extra elements for the same asset (when two split parts cross-fade, the same asset needs two source times at once).
 */
export function transitionReach(sequence: Sequence): Map<string, [number, number]> {
  const spans = new Map(sequence.items.flatMap((item) => ('span' in item && item.span ? [[item.id, item.span] as const] : [])));
  const reach = new Map<string, [number, number]>();
  const extend = (id: string, from: number, to: number) => {
    const [a, b] = reach.get(id) ?? [from, to];
    reach.set(id, [Math.min(a, from), Math.max(b, to)]);
  };
  for (const transition of sequence.transitions ?? []) {
    if (!transition.leftItemId || !transition.rightItemId) continue;
    const left = spans.get(transition.leftItemId);
    const right = spans.get(transition.rightItemId);
    if (!left || !right) continue;
    const window = transitionWindow(transition, left, right);
    if (!window) continue;
    extend(transition.leftItemId, left.fromFrame, Math.max(left.fromFrame + left.durationFrames, window[1]));
    extend(transition.rightItemId, Math.min(right.fromFrame, window[0]), right.fromFrame + right.durationFrames);
  }
  return reach;
}
