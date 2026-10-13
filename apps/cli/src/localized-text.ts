import { isMessageRef, localizeText, type MessageRef } from '@cuccut/protocol';

/**
 * Text that the Runtime stores or sends is regenerated in the CLI's current language (message-ref.ts, repo convention §5): if the `fooRef` next to field `foo` is recognized, it is used; otherwise the text is used as-is. Typed fields call `localizeText(x.detail, x.detailRef)` directly; this gathers the several shapes taken from `details: unknown`.
 */

/** Extracts a reference from an unknown shape. */
export function refIn(value: unknown): MessageRef | null {
  return isMessageRef(value) ? value : null;
}

/** The remedy text in string form in error `details` (`remedy` / `remedyRef`); null when it is not a string. */
export function remedyText(details: unknown): string | null {
  const { remedy, remedyRef } = (details ?? {}) as { remedy?: unknown; remedyRef?: unknown };
  return typeof remedy === 'string' ? localizeText(remedy, refIn(remedyRef)) : null;
}

/** The hint in the object-shaped remedy (`{ hint, hintRef, … }`, for denials where authorization or a capability is not configured); null when absent. */
export function remedyHintText(remedy: unknown): string | null {
  const { hint, hintRef } = (remedy ?? {}) as { hint?: unknown; hintRef?: unknown };
  return typeof hint === 'string' ? localizeText(hint, refIn(hintRef)) : null;
}
