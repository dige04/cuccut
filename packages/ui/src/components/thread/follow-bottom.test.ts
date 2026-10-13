import { describe, expect, it } from 'vitest';
import {
  UPWARD_INTENT_WINDOW_MS,
  beginScrollbarDrag,
  endScrollbarDrag,
  initialFollowState,
  isNearBottom,
  isUpwardKey,
  nextFollowState,
  recordUpwardIntent,
  shouldPin,
  upwardIntentRemaining,
  type FollowState,
} from './follow-bottom.ts';

/** Observe scrollTop once first, as the baseline for later comparisons. */
function settled(scrollTop: number, following = true): FollowState {
  const state = { ...initialFollowState(), following };
  return nextFollowState(state, { scrollTop, distanceFromBottom: following ? 0 : 300, now: 0 });
}

describe('nextFollowState', () => {
  it('layout shrinks scrollTop without upward input: does not unhook', () => {
    const next = nextFollowState(settled(1000), { scrollTop: 700, distanceFromBottom: 0, now: 1000 });
    expect(next.following).toBe(true);
    expect(next.lastScrollTop).toBe(700);
  });

  it('scrollTop shrinks within 100ms after wheel up: unhooks', () => {
    const state = recordUpwardIntent(settled(1000), 1000);
    const next = nextFollowState(state, { scrollTop: 900, distanceFromBottom: 100, now: 1000 + UPWARD_INTENT_WINDOW_MS });
    expect(next.following).toBe(false);
  });

  it('scrollTop shrinks after upward input has exceeded the window: does not unhook', () => {
    const state = recordUpwardIntent(settled(1000), 1000);
    const next = nextFollowState(state, { scrollTop: 900, distanceFromBottom: 100, now: 1000 + UPWARD_INTENT_WINDOW_MS + 1 });
    expect(next.following).toBe(true);
  });

  it('during a scrollbar drag, upward input still counts beyond the time window', () => {
    const state = beginScrollbarDrag(settled(1000));
    const next = nextFollowState(state, { scrollTop: 600, distanceFromBottom: 400, now: 5000 });
    expect(next.following).toBe(false);
    const released = nextFollowState(endScrollbarDrag(settled(1000)), { scrollTop: 600, distanceFromBottom: 400, now: 5000 });
    expect(released.following).toBe(true);
  });

  it('scrolling back to within 1px of the bottom resumes following', () => {
    const next = nextFollowState(settled(500, false), { scrollTop: 799.5, distanceFromBottom: 0.5, now: 10 });
    expect(next.following).toBe(true);
  });

  it('scrolling down without reaching the bottom does not resume following', () => {
    const next = nextFollowState(settled(500, false), { scrollTop: 700, distanceFromBottom: 30, now: 10 });
    expect(next.following).toBe(false);
  });

  it('not following, within 1px of the bottom but scrollTop did not grow (content shrank and passively reached the bottom): does not resume following', () => {
    const shrunk = nextFollowState(settled(500, false), { scrollTop: 400, distanceFromBottom: 0, now: 10 });
    expect(shrunk.following).toBe(false);
    const same = nextFollowState(settled(500, false), { scrollTop: 500, distanceFromBottom: 0, now: 10 });
    expect(same.following).toBe(false);
  });

  it('first observation only records the baseline and does not change following', () => {
    const next = nextFollowState(recordUpwardIntent(initialFollowState(), 0), { scrollTop: 0, distanceFromBottom: 500, now: 0 });
    expect(next.following).toBe(true);
    expect(next.lastScrollTop).toBe(0);
  });
});

describe('shouldPin', () => {
  it('pins to the bottom only when following and there is no recent upward input', () => {
    const state = settled(1000);
    expect(shouldPin(state, 0)).toBe(true);
    expect(shouldPin(recordUpwardIntent(state, 100), 150)).toBe(false);
    expect(upwardIntentRemaining(recordUpwardIntent(state, 100), 150)).toBe(UPWARD_INTENT_WINDOW_MS - 50);
    expect(shouldPin(recordUpwardIntent(state, 100), 100 + UPWARD_INTENT_WINDOW_MS + 1)).toBe(true);
    expect(shouldPin(settled(500, false), 0)).toBe(false);
  });
});

describe('isUpwardKey / isNearBottom', () => {
  it('recognizes upward keys', () => {
    expect(isUpwardKey({ key: 'ArrowUp', shiftKey: false })).toBe(true);
    expect(isUpwardKey({ key: 'PageUp', shiftKey: false })).toBe(true);
    expect(isUpwardKey({ key: 'Home', shiftKey: false })).toBe(true);
    expect(isUpwardKey({ key: ' ', shiftKey: true })).toBe(true);
    expect(isUpwardKey({ key: ' ', shiftKey: false })).toBe(false);
    expect(isUpwardKey({ key: 'ArrowDown', shiftKey: false })).toBe(false);
  });

  it('within 64px counts as near the bottom', () => {
    expect(isNearBottom(64)).toBe(true);
    expect(isNearBottom(65)).toBe(false);
  });
});
