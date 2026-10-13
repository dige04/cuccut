import { isMessageRef, localizeText, type MessageRef } from '@cuccut/protocol';

/**
 * Text the Runtime stores is regenerated in the current interface language when displayed (message-ref.ts, repository convention §5): if a `fooRef` next to field `foo` is recognized, it is used; otherwise the text is used as is.
 * This covers a few common shapes; for typed fields, call `localizeText(x.detail, x.detailRef)` directly.
 */

/** Takes a reference from an unknown shape such as `details: unknown`. */
export function refIn(value: unknown): MessageRef | null {
  return isMessageRef(value) ? value : null;
}

/** The error of a task (the `message` / `messageRef` of `JobError`). */
export function jobErrorText(error: { message: string; messageRef?: MessageRef }): string;
export function jobErrorText(error: { message: string; messageRef?: MessageRef } | null | undefined): string | null;
export function jobErrorText(error: { message: string; messageRef?: MessageRef } | null | undefined): string | null {
  return error ? localizeText(error.message, error.messageRef) : null;
}

/** What it is waiting for while queued (`JobRecord.wait`, or the `wait` of a waiter in the resource snapshot: `detail` / `detailRef`); null when absent. */
export function jobWaitText(wait: { detail: string; detailRef?: MessageRef } | null | undefined): string | null {
  return wait ? localizeText(wait.detail, wait.detailRef) : null;
}

/** The remedy explanation in string form inside error `details` (`remedy` / `remedyRef`); null when it is not a string or is empty. */
export function remedyText(details: unknown): string | null {
  const { remedy, remedyRef } = (details ?? {}) as { remedy?: unknown; remedyRef?: unknown };
  return typeof remedy === 'string' && remedy ? localizeText(remedy, refIn(remedyRef)) : null;
}

/** The hint in an object-shaped remedy (`{ hint, hintRef, … }`, for rejections of authorization and unconfigured capabilities); null when absent or empty. */
export function remedyHintText(remedy: unknown): string | null {
  const { hint, hintRef } = (remedy ?? {}) as { hint?: unknown; hintRef?: unknown };
  return typeof hint === 'string' && hint ? localizeText(hint, refIn(hintRef)) : null;
}
