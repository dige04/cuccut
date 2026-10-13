import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MS, installToastAutoDismiss, type ToastOptions, type ToastQueueLike } from './toast-timing.ts';

function fakeQueue() {
  const added: { children: string; options: ToastOptions }[] = [];
  const closed: number[] = [];
  const make = () => (children: string, options: ToastOptions = {}) => {
    const key = added.push({ children, options }) - 1;
    return () => {
      closed.push(key);
      added[key]!.options.onClose?.();
    };
  };
  const queue: ToastQueueLike = { neutral: make(), positive: make(), negative: make(), info: make() };
  return { queue, added, closed };
}

describe('installToastAutoDismiss', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('without a timeout, uses the default of several seconds; a given one is no shorter than 5 seconds', () => {
    const { queue, added } = fakeQueue();
    const uninstall = installToastAutoDismiss(queue, () => false);
    queue.neutral('a');
    queue.info('b', { timeout: 2000 });
    queue.positive('c', { timeout: 8000 });
    expect(added.map((t) => t.options.timeout)).toEqual([DEFAULT_MS, 5000, 8000]);
    uninstall();
  });

  it('a toast with a button is closed here when it times out; one closed earlier no longer runs its timer', () => {
    const { queue, added, closed } = fakeQueue();
    const uninstall = installToastAutoDismiss(queue, () => false);
    const onClose = vi.fn();
    queue.neutral('undo', { actionLabel: '撤销', onClose });
    expect(added[0]!.options.timeout).toBeUndefined();
    vi.advanceTimersByTime(DEFAULT_MS - 1);
    expect(closed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(closed).toEqual([0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    const close = queue.info('later', { actionLabel: '查看', timeout: 6000 });
    close();
    vi.advanceTimersByTime(10_000);
    expect(closed).toEqual([0, 1]);
    uninstall();
  });

  it('the timeout is extended while the pointer or focus is on the toast', () => {
    const { queue, closed } = fakeQueue();
    let held = true;
    const uninstall = installToastAutoDismiss(queue, () => held);
    queue.neutral('undo', { actionLabel: '撤销' });
    vi.advanceTimersByTime(DEFAULT_MS * 3);
    expect(closed).toEqual([]);
    held = false;
    vi.advanceTimersByTime(DEFAULT_MS);
    expect(closed).toEqual([0]);
    uninstall();
  });

  it('the same queue holds it only once', () => {
    const { queue, added } = fakeQueue();
    const uninstall = installToastAutoDismiss(queue, () => false);
    installToastAutoDismiss(queue, () => false);
    queue.neutral('a', { timeout: 7000 });
    expect(added[0]!.options.timeout).toBe(7000);
    uninstall();
  });
});
