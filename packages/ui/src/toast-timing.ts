/*
 * The toast stays up only a few seconds (user request on 2026-10-08: "toast 只显示几秒即可，不用一直在那里", i.e. "a toast only needs to show for a few seconds, it should not stay there all the time"). S2's ToastQueue has two mismatches:
 * a toast without `timeout` stays up forever; a toast with a button (`actionLabel`) is never auto-dismissed, whether or not `timeout` is given (S2's trade-off per WCAG 2.2.1).
 * Here we wrap it at startup: a toast without `timeout` gets DEFAULT_MS; a toast with a button is timed and dismissed here, and the timer is extended while the pointer is on the toast or focus is inside it,
 * so it does not vanish just as the user is about to click "Undo". The duration is not shorter than S2's 5-second minimum.
 */

export const DEFAULT_MS = 5000;
const MIN_MS = 5000;

type Variant = 'neutral' | 'positive' | 'negative' | 'info';
const VARIANTS: readonly Variant[] = ['neutral', 'positive', 'negative', 'info'];

/** Shape of S2's `ToastQueue` (only the parameters needed from S2's `SpectrumToastOptions` are taken). */
export interface ToastOptions {
  timeout?: number;
  actionLabel?: string;
  onClose?: () => void;
  [key: string]: unknown;
}
export type ToastQueueLike = Record<Variant, (children: string, options?: ToastOptions) => () => void>;

/** The pointer or focus is still on the toast: S2's own timed toasts also pause at this point. */
function toastHeld(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('[role="region"] [role="alertdialog"]:hover, [role="region"] [role="alertdialog"]:focus-within');
}

const installed = new WeakSet<object>();

/** Installs auto-dismiss on the toast queue (S2's `ToastQueue`); each queue is patched only once. Returns a function that removes the patch (for tests). */
export function installToastAutoDismiss(queue: ToastQueueLike, held = toastHeld): () => void {
  if (installed.has(queue)) return () => {};
  installed.add(queue);
  const original = { ...queue };
  for (const variant of VARIANTS) {
    const add = original[variant];
    queue[variant] = (children, options = {}) => {
      const ms = Math.max(options.timeout ?? DEFAULT_MS, MIN_MS);
      if (!options.actionLabel) return add(children, { ...options, timeout: ms });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const close = add(children, {
        ...options,
        onClose: () => {
          clearTimeout(timer);
          options.onClose?.();
        },
      });
      const arm = () => {
        timer = setTimeout(() => (held() ? arm() : close()), ms);
      };
      arm();
      return () => {
        clearTimeout(timer);
        close();
      };
    };
  }
  return () => {
    Object.assign(queue, original);
    installed.delete(queue);
  };
}
