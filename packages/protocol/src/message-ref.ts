import { getLocale, type Translations } from './i18n.ts';

/**
 * Localizable text (architecture design §5.10, command and protocol spec §11.3). Besides the text in the current language, the text the Runtime shows people also carries a message reference (`key` + `params`), stored together with records and events. The UI regenerates the text from the reference in its own current language, so after a language switch, stored error reasons and task descriptions change too. When a reference is not recognized (a new key from a newer Runtime) or absent (old records, third-party verbatim text), the text is used as is.
 *
 * Convention: a text field `foo` is accompanied by `fooRef?: MessageRef` next to it (for example `message` / `messageRef`, `detail` / `detailRef`).
 */

/**
 * Parameters: a scalar, or another reference. A nested reference is expanded in the reader's language; when it is not recognized, its `text` from generation time is used. Content such as a provider's verbatim words or file names is passed as a string parameter unchanged.
 */
export type MessageParam = string | number | boolean | null | NestedRef;
export type NestedRef = MessageRef & { text?: string };

export interface MessageRef {
  /** `<area>.<name>`, for example `jobs.modelLoadFailed`. Not renamed or reused after release. */
  key: string;
  params?: Record<string, MessageParam>;
}

/** A text already generated in the current language, carrying its reference too. `String(x)` and template strings give `text`. */
export interface Localized extends MessageRef {
  readonly text: string;
  toString(): string;
}

type Entry = string | ((params: never) => string);
type ParamsOf<E> = E extends (params: infer P) => string ? P : never;
/** A caller may pass a nested `Localized` to a parameter declared as a string. The reference stores the reference, and the text uses its text. */
type ParamsIn<P> = { [K in keyof P]: P[K] | (string extends P[K] ? Localized : never) };
export type MessageBuilders<T> = {
  readonly [K in keyof T]: T[K] extends string ? () => Localized : (params: ParamsIn<ParamsOf<T[K]>>) => Localized;
};

const registry = new Map<string, { en: Record<string, Entry>; translations: Record<string, Record<string, Entry>> }>();

export function isMessageRef(value: unknown): value is MessageRef {
  return !!value && typeof value === 'object' && typeof (value as MessageRef).key === 'string';
}

function render(entry: Entry | undefined, params: Record<string, MessageParam> | undefined, locale: string): string | null {
  if (entry === undefined) return null;
  if (typeof entry === 'string') return entry;
  const plain: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params ?? {})) plain[name] = isMessageRef(value) ? formatRef(value, (value as NestedRef).text ?? '', locale) : value;
  return (entry as (p: unknown) => string)(plain);
}

function lookup(key: string, locale: string): Entry | undefined {
  const dot = key.indexOf('.');
  const area = registry.get(key.slice(0, dot));
  if (!area) return undefined;
  const name = key.slice(dot + 1);
  return area.translations[locale]?.[name] ?? area.en[name];
}

/** Expands a reference in the reader's language (the current language by default). Uses `fallback` when the reference is not recognized. */
export function formatRef(ref: MessageRef, fallback: string, locale: string = getLocale()): string {
  try {
    return render(lookup(ref.key, locale), ref.params, locale) ?? fallback;
  } catch {
    return fallback;
  }
}

/** For a field `text` and its neighboring `ref`: if a recognizable reference exists, the text is regenerated in the current language. Otherwise the text is used as is. */
export function localizeText(text: string, ref?: MessageRef | null): string;
export function localizeText(text: string | null | undefined, ref?: MessageRef | null): string | null | undefined;
export function localizeText(text: string | null | undefined, ref?: MessageRef | null): string | null | undefined {
  return ref ? formatRef(ref, text ?? '') : text;
}

/**
 * Puts the stored text and its neighboring reference back together as a `Localized`, which can again be passed as a nested parameter to a catalog message (the reader expands it in their own language). Without a reference, it is just the text.
 */
export function withRef(text: string, ref?: MessageRef | null): string | Localized {
  return ref ? { ...refOf(ref), text, toString: () => text } : text;
}

/** Only the reference (for storage and wire use), without `text` and methods. */
export function refOf(value: Localized | MessageRef): MessageRef {
  return value.params && Object.keys(value.params).length ? { key: value.key, params: value.params } : { key: value.key };
}

function nested(value: MessageRef & { text?: string }): NestedRef {
  const ref: NestedRef = refOf(value);
  if (typeof value.text === 'string') ref.text = value.text;
  return ref;
}

/**
 * The Runtime message catalog for one area: `defineCatalog('jobs', en, { 'zh-Hans': zh })`. It returns a constructor for each message; calling it gives a `Localized` (the text in the current language plus the reference). Catalogs are registered at load time. The UI, the CLI and the Runtime all load every catalog through `messages/index.ts`.
 */
export function defineCatalog<T extends Record<string, Entry>>(area: string, en: T, translations: Translations<T>): MessageBuilders<T> {
  // A catalog registered later for the same area overrides the earlier one: hot reload in development re-runs the catalog module.
  registry.set(area, { en, translations: translations as unknown as Record<string, Record<string, Entry>> });
  const builders: Record<string, (params?: Record<string, unknown>) => Localized> = {};
  for (const name of Object.keys(en)) {
    const key = `${area}.${name}`;
    builders[name] = (params) => {
      const stored: Record<string, MessageParam> = {};
      for (const [k, v] of Object.entries(params ?? {})) stored[k] = isMessageRef(v) ? nested(v) : (v as MessageParam);
      const ref: MessageRef = Object.keys(stored).length ? { key, params: stored } : { key };
      const text = formatRef(ref, key);
      return { ...ref, text, toString: () => text };
    };
  }
  return builders as unknown as MessageBuilders<T>;
}
