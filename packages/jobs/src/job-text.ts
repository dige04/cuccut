import { refOf, type JobError, type JobWarning, type Localized, type MessageRef } from '@cuccut/protocol';
import { JobsCommon } from '@cuccut/protocol/messages/jobs/common.ts';

/**
 * Human-facing text in jobs (repo convention §5): a `Localized` generated from the catalog (text + message reference), or a string as is (third-party original text, old records).
 * Store `fooRef` alongside the field `foo` in `JobRecord`; the UI regenerates it in its own language.
 */
export type JobText = string | Localized;

/** Text generated at use time, such as step names: strings are used directly; a function is called each time and generates text in the current language. */
export type LazyText = string | (() => Localized);

export function resolveText(text: LazyText): JobText {
  return typeof text === 'function' ? text() : text;
}

/** Text and its reference (strings have no reference). */
export function textParts(text: JobText): { text: string; ref: MessageRef | undefined } {
  return typeof text === 'string' ? { text, ref: undefined } : { text: text.text, ref: refOf(text) };
}

/** Message reference carried by errors: `RpcError`, `PipelineStepError` and similar errors constructed with catalog text have `messageRef`. */
export function errorRef(error: unknown): MessageRef | undefined {
  const ref = error && typeof error === 'object' ? (error as { messageRef?: unknown }).messageRef : undefined;
  return ref && typeof ref === 'object' && typeof (ref as MessageRef).key === 'string' ? (ref as MessageRef) : undefined;
}

/** Error text, together with its reference when there is one (it can be embedded as an argument of another catalog entry). */
export function errorText(error: unknown): JobText {
  const message = error instanceof Error ? error.message : String(error);
  const ref = errorRef(error);
  return ref ? asLocalized(message, ref) : message;
}

/** Re-wraps generated text and its reference as `Localized` (used when embedding into another entry); without a reference it is just the text. */
export function asLocalized(text: string, ref: MessageRef | undefined): JobText {
  return ref ? { ...ref, text, toString: () => text } : text;
}

/** Job error: `message` is recorded together with its reference. */
export function jobError(code: string, message: JobText, details?: unknown): JobError {
  const { text, ref } = textParts(message);
  return { code, message: text, ...(ref ? { messageRef: ref } : {}), ...(details === undefined ? {} : { details }) };
}

/** Structured warning: `detail` is recorded together with its reference. */
export function jobWarning(code: string, detail: JobText, extra: Omit<JobWarning, 'code' | 'detail' | 'detailRef'> = {}): JobWarning {
  const { text, ref } = textParts(detail);
  return { code, ...extra, detail: text, ...(ref ? { detailRef: ref } : {}) };
}

/** “Description: cause”: when the cause is another error, its reference is included. */
export function withCause(message: JobText, cause: unknown): Localized {
  return JobsCommon.withCause({ message, cause: errorText(cause) });
}

/** Joins several IDs and names into a string in the current language. */
export function joinList(items: readonly string[]): string {
  return items.join(JobsCommon.listSeparator().text);
}

/** Error with a message reference: when constructed with a `Localized`, the reference is recorded. Inherited by the error classes in the package. */
export class LocalizedError extends Error {
  readonly messageRef: MessageRef | undefined;

  constructor(message: JobText) {
    super(String(message));
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }
}
