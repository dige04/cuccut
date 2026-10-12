import { intlLocale, type Locale } from '../../i18n.ts';

/** 语言标签在某种界面语言里的名字（`Intl.DisplayNames`），修改名里的语言参数用；认不出时照用标签，空标签得到空串。 */
export function languageName(locale: Locale, tag: string): string {
  if (!tag) return '';
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
