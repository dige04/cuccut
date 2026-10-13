import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './chrome-copy.zh-Hans.ts';
import { zhHant } from './chrome-copy.zh-Hant.ts';
import { ja } from './chrome-copy.ja.ts';
import { ko } from './chrome-copy.ko.ts';
import { es } from './chrome-copy.es.ts';
import { fr } from './chrome-copy.fr.ts';
import { de } from './chrome-copy.de.ts';
import { nl } from './chrome-copy.nl.ts';
import { ptBR } from './chrome-copy.pt-BR.ts';
import { it } from './chrome-copy.it.ts';
import { ru } from './chrome-copy.ru.ts';
import { pl } from './chrome-copy.pl.ts';
import { tr } from './chrome-copy.tr.ts';
import { vi } from './chrome-copy.vi.ts';

/** Copy for the page chrome: the navigation bar on the landing page and the back header on every other page. */
const en = {
  workspace: 'Local workspace',
  library: 'Library',
  /** The publication calendar in the navigation. */
  calendar: 'Calendar',
  backHome: 'Back to home',
  stayLocal: 'Projects and media stay on this computer.',
};

export type ChromeMessages = typeof en;

export const CHROME_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
