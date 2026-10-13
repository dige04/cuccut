import { TaskFailure } from '@cuccut/jobs';
import { RpcError, refOf, type Localized, type MessageRef } from '@cuccut/protocol';

/**
 * Two small helpers for Runtime text (repo convention §5) in runtime-core.
 *
 * - `taskFailure`: builds a `TaskFailure` from a text entry in the copy catalog (`Localized`). `TaskFailure` currently accepts only strings. What is recorded in `JobRecord.error` is the text in the language current at emission. The reference is attached as `messageRef`, so once `@cuccut/jobs` writes it into `JobError.messageRef`, the UI can regenerate the text in its own language.
 * - `localizedOf`: uses an existing error (`RpcError`, or one of our own errors with `messageRef`) as an argument to another copy entry. With a reference, the reference is nested (the reader expands it in their own language). Without one, its text is used (third-party wording, old errors).
 */
export function taskFailure(
  code: string,
  message: Localized,
  details?: unknown,
  result: ConstructorParameters<typeof TaskFailure>[3] = null,
): TaskFailure & { messageRef: MessageRef } {
  return Object.assign(new TaskFailure(code, message.text, details, result), { messageRef: refOf(message) });
}

export function localizedOf(error: unknown): Localized | string {
  if (error && typeof error === 'object' && 'message' in error) {
    const { message, messageRef } = error as { message: unknown; messageRef?: MessageRef };
    const text = String(message);
    return messageRef ? { ...messageRef, text, toString: () => text } : text;
  }
  return String(error);
}

/** Wraps an existing `RpcError` again with a copy entry (for example, one built by `libraryError`, which accepts only strings). The code and details are unchanged, and the message now carries a reference. */
export function withLocalized(error: RpcError, message: Localized): RpcError {
  return new RpcError(error.code, message, error.details);
}

/** Converts one kind of error into another (for example `RpcError` → `TaskFailure`), keeping the original message reference. Returned as is when there was none. */
export function withMessageRef<T extends Error>(target: T, source: { messageRef?: MessageRef | undefined }): T {
  return source.messageRef ? Object.assign(target, { messageRef: source.messageRef }) : target;
}

/** `JobError`'s `message` and `messageRef`: the text in the language at emission, together with the reference. */
export function jobMessage(message: Localized): { message: string; messageRef: MessageRef } {
  return { message: message.text, messageRef: refOf(message) };
}

/** Remedy text in an error's `details` or status: the `remedy` text together with the `remedyRef` reference. */
export function remedyOf(remedy: Localized): { remedy: string; remedyRef: MessageRef } {
  return { remedy: remedy.text, remedyRef: refOf(remedy) };
}
