import { intlLocale, type Locale } from '../../i18n.ts';

/** The name of a language tag in some interface language (`Intl.DisplayNames`), used for the language parameter in change names; when the tag is not recognized, it is used as is, and an empty tag gives an empty string. */
export function languageName(locale: Locale, tag: string): string {
  if (!tag) return '';
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
