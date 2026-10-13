import { refOf, type Localized, type MessageRef } from '@cuccut/protocol';

/**
 * Text for people to read from the model package and Providers (repo convention §5): a `Localized` generated from the catalog (text + message reference), or a string passed through as-is (third-party original wording, Worker error messages). Error classes build with it and record `messageRef`; task records and the UI then regenerate it in the reader's language.
 */
export type ModelText = string | Localized;

/** Message reference of the text (absent for plain strings). */
export function modelTextRef(text: ModelText): MessageRef | undefined {
  return typeof text === 'string' ? undefined : refOf(text);
}

/** Text and its reference, for storing in a status field with `detail` / `detailRef`. */
export function modelDetail(text: ModelText): { detail: string; detailRef?: MessageRef } {
  const ref = modelTextRef(text);
  return ref ? { detail: String(text), detailRef: ref } : { detail: String(text) };
}
