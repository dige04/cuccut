import { refOf, type DriverInstallOption, type Localized, type MessageRef } from '@cuccut/protocol';
import { DriversCommon } from '@cuccut/protocol/messages/agent-drivers';

/**
 * Human-facing text emitted by the Driver: text CucCut writes itself is a `Localized` (the text in the current language plus a message reference, message-ref.ts);
 * text from the Agent or a third-party CLI is a plain string. When emitting events or writing probe results, the text still goes in `message` / `error` / `detail`;
 * an additional `xxxRef` alongside it lets the UI regenerate it in its own language.
 */
export type DriverText = Localized | string;

export function isLocalized(value: unknown): value is Localized {
  return typeof value === 'object' && value !== null && typeof (value as Localized).key === 'string';
}

/** The text itself (in the current language). */
export function textOf(value: DriverText): string;
export function textOf(value: DriverText | null | undefined): string | null;
export function textOf(value: DriverText | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** `{ [key]: ref }`; when the value is not `Localized` (raw text, or empty), it is an empty object, so spreading it leaves no `undefined` keys. */
export function refField<K extends string>(key: K, value: DriverText | null | undefined): { [P in K]?: MessageRef } {
  return isLocalized(value) ? ({ [key]: refOf(value) } as { [P in K]?: MessageRef }) : {};
}

/** Install method for the official script: the name is text written by CucCut, and `labelRef` is given alongside it. Call it when needed rather than storing it as a module-level constant. */
export function officialScript(command: string, upgrade: string): DriverInstallOption {
  const label = DriversCommon.officialScript();
  return { kind: 'script', label: String(label), labelRef: refOf(label), needs: null, command, upgrade };
}

/** An Error carrying a message reference: a reason written by CucCut (for example, process exit); when later emitted as an event's `error` / `message`, the reference goes with it. */
export class LocalizedError extends Error {
  readonly messageRef: MessageRef;

  constructor(text: Localized) {
    super(String(text));
    this.name = 'LocalizedError';
    this.messageRef = refOf(text);
  }
}

/** The reference field of errors: `LocalizedError` carries a reference; others (the Agent's raw text) are empty objects. */
export function errorRefField<K extends string>(key: K, error: unknown): { [P in K]?: MessageRef } {
  return error instanceof LocalizedError ? ({ [key]: error.messageRef } as { [P in K]?: MessageRef }) : {};
}
