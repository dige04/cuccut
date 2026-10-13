import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './font-settings-copy.zh-Hans.ts';
import { zhHant } from './font-settings-copy.zh-Hant.ts';
import { ja } from './font-settings-copy.ja.ts';
import { ko } from './font-settings-copy.ko.ts';
import { es } from './font-settings-copy.es.ts';
import { fr } from './font-settings-copy.fr.ts';
import { de } from './font-settings-copy.de.ts';
import { nl } from './font-settings-copy.nl.ts';
import { ptBR } from './font-settings-copy.pt-BR.ts';
import { it } from './font-settings-copy.it.ts';
import { ru } from './font-settings-copy.ru.ts';
import { pl } from './font-settings-copy.pl.ts';
import { tr } from './font-settings-copy.tr.ts';
import { vi } from './font-settings-copy.vi.ts';

/** Copy for Settings › Fonts (font-settings.tsx). English is the source of keys and types; translations live in `font-settings-copy.<language>.ts`. */
const en = {
  /** `total` is the number of families in the Google Fonts catalog; null when the catalog has not been read yet. */
  lead: (total: number | null) =>
    `Fonts come from three sources: those shipped with the app, those installed on this computer, and the Google Fonts directory (${total === null ? 'about two thousand' : `about ${total.toLocaleString(intlLocale())}`} families, open-source licenses, downloaded on demand). Downloads send only the family name and weight and need no account; fonts are stored in app data, not in the video folder.`,
  download: 'Download',
  autoDownload: 'Download fonts automatically',
  autoDownloadDesc:
    "Downloads from Google Fonts when preview, opening a video or export needs a font this computer doesn't have. When off, fallback fonts are used for display and export first, and you can still download by hand when picking a font. Nothing is downloaded in strict offline mode.",
  cssEndpoint: 'Stylesheet URL',
  cssEndpointDesc: 'Base URL of a mirror. Leave empty to use https://fonts.googleapis.com.',
  fileEndpoint: 'Font file URL',
  fileEndpointDesc: 'Font files are only fetched from under this URL. Leave empty to use https://fonts.gstatic.com.',
  downloaded: 'Downloaded fonts',
  summary: (families: number, size: string) => `${families} ${families === 1 ? 'family' : 'families'} · ${size}`,
  none: 'None yet',
  clearAll: 'Clear all',
  empty: 'Fonts downloaded while picking a font, or automatically when opening a video or exporting, are listed here.',
  clearTitle: 'Clear downloaded fonts?',
  clear: 'Clear',
  cancel: 'Cancel',
  removed: (family: string, size: string) => `Deleted “${family}” · Freed ${size}`,
  inUseTip: "An unfinished export is using it; delete it after the export finishes",
  removeTip: "Delete this font's downloaded files",
  /** Accessible name of the delete button: the hint plus the family name. */
  removeLabel: (tip: string, family: string) => `${tip}: ${family}`,
  /** `weights` is the sorted list of font weights; `ago` is a relative time such as “N days ago” (几天前). */
  facts: (weights: string, size: string, licence: string, ago: string | null) =>
    `Weights ${weights} · ${size} · ${licence}${ago ? ` · Downloaded ${ago}` : ''}`,
  inUse: 'Used by export',
};

export type FontSettingsMessages = typeof en;

export const FONT_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
