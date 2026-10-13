/**
 * Interface language (architecture design §5.10 `ui.language`, repository convention §5): the interface, the Runtime and the CLI share one set of text shown to people.
 *
 * - The shipped languages are in `LOCALES`. English is the default and the fallback: when the system language has no matching shipped language, English is used, and when a translation lacks an entry, it falls back to English.
 * - A process has only one current language (`getLocale`). The interface resolves it from its preference and the system language, then calls `setLocale`; the Runtime follows the `ui.language` setting; the CLI follows the environment.
 *   The environment variable `CUCCUT_LOCALE` takes precedence over everything (for tests and troubleshooting).
 * - Message catalogs are written per module: `defineMessages(en, { 'zh-Hans': zh })`. The English catalog defines the keys and types, and other languages must match it key for key. An entry can be a string or a function
 *   (each language handles word order and plurals itself). The returned object picks the current language on every property read, so **do not read it at module top level**
 *   (that would freeze the text in the language that was current at load time).
 */

/** The shipped languages, in the order of the language list under Settings › General (design file page-settings.jsx). */
export const LOCALES = ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'nl', 'pt-BR', 'it', 'ru', 'pl', 'tr', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];

/** Interface language preference: `system` follows the system; otherwise, one shipped language. */
export type LanguagePreference = 'system' | Locale;
export const LANGUAGE_PREFERENCES = ['system', ...LOCALES] as const satisfies readonly LanguagePreference[];

export const DEFAULT_LOCALE: Locale = 'en';

/** A language's self-name: it does not change with the interface language. */
export const LOCALE_NATIVE_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  // i18n-ignore-start: language self-names
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  nl: 'Nederlands',
  'pt-BR': 'Português (BR)',
  it: 'Italiano',
  ru: 'Русский',
  pl: 'Polski',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  // i18n-ignore-end
};

/** BCP 47 tag for `Intl`, React Spectrum's `Provider`, and `<html lang>`. */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = { 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', nl: 'nl-NL', 'pt-BR': 'pt-BR', it: 'it-IT', ru: 'ru-RU', pl: 'pl-PL', tr: 'tr-TR', vi: 'vi-VN' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isLocale(value);
}

function shipped(code: string): Locale | null {
  return LOCALES.find((locale) => locale.toLowerCase() === code) ?? null;
}

/**
 * The shipped language for a BCP 47 / POSIX tag; null when there is none. Chinese is split by script: a tag that specifies `Hant`, or whose region is Taiwan, Hong Kong or Macau (`zh-TW`, `zh_HK.UTF-8`), maps to Traditional;
 * a tag that specifies `Hans`, and the other forms, map to Simplified. All regions of Portuguese map to `pt-BR`: reading Brazilian Portuguese is closer than reading English. Others follow the primary language.
 */
export function localeOfTag(tag: string | null | undefined): Locale | null {
  const lower = (tag ?? '').trim().toLowerCase();
  if (!lower || lower === 'c' || lower === 'posix') return null;
  const [primary = '', ...rest] = lower.split(/[-_.@]/);
  if (primary === 'zh') {
    const traditional = !rest.includes('hans') && rest.some((part) => ['hant', 'tw', 'hk', 'mo'].includes(part));
    return (traditional ? shipped('zh-hant') : null) ?? shipped('zh-hans');
  }
  if (primary === 'pt') return shipped('pt-br');
  return shipped(primary);
}

/** Among the system languages in priority order, the first one that has a shipped language; English if none does. */
export function matchLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    const hit = localeOfTag(tag);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

export function resolveLanguage(preference: LanguagePreference | null | undefined, systemTags: readonly (string | null | undefined)[]): Locale {
  return isLocale(preference) ? preference : matchLocale(systemTags);
}

/** The language specified by `CUCCUT_LOCALE`; null if it is unset or not recognized. */
export function localeOverride(): Locale | null {
  const env = typeof process === 'undefined' ? undefined : process.env?.CUCCUT_LOCALE;
  return env ? localeOfTag(env) : null;
}

/**
 * The system language as seen by non-interface processes (the Runtime, the CLI), in priority order: `CUCCUT_SYSTEM_LANGUAGES` (comma-separated, taken from the OS preferred languages), which the desktop app passes when it launches the Runtime;
 * POSIX `LC_ALL` / `LC_MESSAGES` / `LANG`; and finally the `Intl` default language.
 */
export function processLanguageTags(): string[] {
  const env = typeof process === 'undefined' ? {} : (process.env ?? {});
  const tags = (env.CUCCUT_SYSTEM_LANGUAGES ?? '').split(',').map((t) => t.trim());
  tags.push(env.LC_ALL ?? '', env.LC_MESSAGES ?? '', env.LANG ?? '');
  try {
    tags.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    // Environments without Intl: take the value from the list above.
  }
  return tags.filter(Boolean);
}

let current: Locale = localeOverride() ?? DEFAULT_LOCALE;
const listeners = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return current;
}

/** Changes the current language. When `CUCCUT_LOCALE` is set, it takes precedence and the value passed here is ignored. */
export function setLocale(locale: Locale): void {
  const next = localeOverride() ?? locale;
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener(next);
}

export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** BCP 47 tag of the current language, for `Intl.*` and `localeCompare`. */
export function intlLocale(locale: Locale = current): string {
  return LOCALE_TAGS[locale];
}

/**
 * Picks the word form by the language's plural rules, for sentences in translations that contain a count: the keys of `forms` are `Intl.PluralRules` categories, and a missing category falls back to `other`.
 * The language is passed explicitly (a translation file belongs to one language, for example `pluralForm('ru', n, { one: 'видео', few: …, many: …, other: … })`); the current language is not read.
 */
export function pluralForm<T>(locale: string, n: number, forms: { readonly [K in Intl.LDMLPluralRule]?: T } & { readonly other: T }): T {
  let category: Intl.LDMLPluralRule = 'other';
  try {
    category = new Intl.PluralRules(locale).select(n);
  } catch {
    // Unrecognized language tag: use other.
  }
  return forms[category] ?? forms.other;
}

/** Translations for every shipped language except English. The type follows the English catalog: missing keys and extra keys are both type errors. */
export type Translations<T> = { readonly [L in Exclude<Locale, 'en'>]: NoInfer<T> };

/**
 * A module's message catalog. The returned object has the same shape as the English catalog, and each property read returns the entry in the current language. If a language lacks this entry (which only happens with catalogs assembled at runtime),
 * it falls back to English.
 */
export function defineMessages<T extends object>(en: T, translations: Translations<T>): T {
  const tables: Record<Locale, T> = { en, ...translations };
  const out = {} as T;
  for (const key of Object.keys(en) as (keyof T & string)[]) {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => {
        const table = tables[current] as Partial<T> | undefined;
        return table && key in table ? table[key] : en[key];
      },
    });
  }
  return Object.freeze(out);
}

/**
 * Translations for only some of the languages: used for temporary directories in tests, where the missing languages fall back to English at runtime. Do not use it for shipped catalogs; a missing language should be a type error.
 */
export function partialTranslations<T>(translations: Partial<Translations<T>>): Translations<T> {
  return translations as Translations<T>;
}

/**
 * Wraps an object that must read the current language on every access in a stable reference. Used when a module wants to keep an old named export (for example `Record<Mode, string>`):
 * `export const MODE_LABEL = live(() => M.modeLabel)`. Only reads are forwarded; writes are not supported.
 */
export function live<T extends object>(read: () => T): T {
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(read(), key),
    has: (_, key) => Reflect.has(read(), key),
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(read(), key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
}
