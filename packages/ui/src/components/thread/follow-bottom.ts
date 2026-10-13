/**
 * State machine for “跟到底” (follow to bottom) in the session thread. Does not depend on the DOM.
 *
 * - Detach: currently following, scrollTop is smaller than last time, and there is recent evidence of user input upward (wheel, keyboard, dragging the scrollbar, touch).
 *   When scrollTop gets smaller without any input evidence (a block above collapses, the window gets shorter, or the content shrinks and the browser clamps it), following is kept.
 * - Re-follow: scrollTop is larger than last time, and the distance to the bottom is ≤ REFOLLOW_PX. The viewport being passively carried to the bottom by content shrinking does not count.
 * - In other cases the current value is kept.
 */

/** The validity window for upward-input evidence. */
export const UPWARD_INTENT_WINDOW_MS = 100;
/** Distance from the bottom required to re-follow, allowing for sub-pixel error. */
export const REFOLLOW_PX = 1;
/** “接近底部” (near the bottom): used only for display decisions; it plays no part in detaching or re-following. */
export const NEAR_BOTTOM_PX = 64;

export interface FollowState {
  following: boolean;
  /** The scrollTop observed at the last scroll event; null means not yet observed. */
  lastScrollTop: number | null;
  /** Timestamp (ms) of the most recent upward input; null means none. */
  upwardIntentAt: number | null;
  /** Dragging the scrollbar: a drag can last well beyond the time window, so during it there is always counted as upward-input evidence. */
  scrollbarDrag: boolean;
}

export interface ScrollSample {
  scrollTop: number;
  /** scrollHeight - scrollTop - clientHeight; can be negative during elastic overscroll. */
  distanceFromBottom: number;
  now: number;
}

export function initialFollowState(): FollowState {
  return { following: true, lastScrollTop: null, upwardIntentAt: null, scrollbarDrag: false };
}

export function recordUpwardIntent(state: FollowState, now: number): FollowState {
  return { ...state, upwardIntentAt: now };
}

export function beginScrollbarDrag(state: FollowState): FollowState {
  return state.scrollbarDrag ? state : { ...state, scrollbarDrag: true };
}

export function endScrollbarDrag(state: FollowState): FollowState {
  return state.scrollbarDrag ? { ...state, scrollbarDrag: false } : state;
}

export function hasUpwardIntent(state: FollowState, now: number): boolean {
  if (state.scrollbarDrag) return true;
  return state.upwardIntentAt !== null && now - state.upwardIntentAt <= UPWARD_INTENT_WINDOW_MS;
}

/** How long (ms) until the upward input within the time window expires; 0 if there is none. Scrollbar dragging is not counted. */
export function upwardIntentRemaining(state: FollowState, now: number): number {
  if (state.upwardIntentAt === null) return 0;
  return Math.max(0, UPWARD_INTENT_WINDOW_MS - (now - state.upwardIntentAt));
}

export function nextFollowState(state: FollowState, sample: ScrollSample): FollowState {
  const last = state.lastScrollTop;
  let following = state.following;
  if (last !== null) {
    if (following && sample.scrollTop < last && hasUpwardIntent(state, sample.now)) following = false;
    else if (!following && sample.scrollTop > last && sample.distanceFromBottom <= REFOLLOW_PX) following = true;
  }
  return { ...state, following, lastScrollTop: sample.scrollTop };
}

/** Whether, while following, the viewport should be pinned to the bottom: when there was recent upward input, don't pin yet, so as not to override a user scroll whose scroll event has not been dispatched. */
export function shouldPin(state: FollowState, now: number): boolean {
  return state.following && !hasUpwardIntent(state, now);
}

export function isNearBottom(distanceFromBottom: number): boolean {
  return distanceFromBottom <= NEAR_BOTTOM_PX;
}

/**
 * Keys that scroll the area upward: ArrowUp, PageUp, Home (including Cmd/Ctrl combinations, “到顶” (go to top)), and Shift+Space.
 * Whether the focus is inside an editable element is decided by the caller.
 */
export function isUpwardKey(event: { key: string; shiftKey: boolean }): boolean {
  if (event.key === ' ' || event.key === 'Spacebar') return event.shiftKey;
  return event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home';
}
