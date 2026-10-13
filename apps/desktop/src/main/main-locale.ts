import { isLocale, resolveLanguage, type Locale } from '@cuccut/protocol';

/*
 * The main process's UI language (repository convention §5): menus and dialogs use the same language as the UI. At launch the UI has not yet told the main process, so a language is first chosen from the system's preferred language.
 * Afterwards, each time the UI changes language (and once at launch), it tells the main process via `cuccut:set-locale` (preload's `setLocale`, the UI's `useLanguageSync`).
 */

/** The language used before the UI has told the main process: it follows the system's preferred language, and English if there is no matching shipped language. */
export function startupLocale(systemLanguages: readonly string[]): Locale {
  return resolveLanguage('system', systemLanguages);
}

/** Language sent from the renderer process: only shipped languages are accepted. Anything else (wrong type, unrecognised tag) is dropped. */
export function localeFromRenderer(value: unknown): Locale | null {
  return isLocale(value) ? value : null;
}
