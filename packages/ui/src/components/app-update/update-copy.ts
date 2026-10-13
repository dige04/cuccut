import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './update-copy.zh-Hans.ts';
import { zhHant } from './update-copy.zh-Hant.ts';
import { ja } from './update-copy.ja.ts';
import { ko } from './update-copy.ko.ts';
import { es } from './update-copy.es.ts';
import { fr } from './update-copy.fr.ts';
import { de } from './update-copy.de.ts';
import { nl } from './update-copy.nl.ts';
import { ptBR } from './update-copy.pt-BR.ts';
import { it } from './update-copy.it.ts';
import { ru } from './update-copy.ru.ts';
import { pl } from './update-copy.pl.ts';
import { tr } from './update-copy.tr.ts';
import { vi } from './update-copy.vi.ts';

/** Which step the update action was on when it failed. */
export type UpdateStep = 'install' | 'check' | 'download' | 'cancel' | 'retry' | 'downloadPage';

const STEP: Record<UpdateStep, string> = {
  install: 'start installing',
  check: 'check for updates',
  download: 'start downloading',
  cancel: 'cancel the download',
  retry: 'retry',
  downloadPage: 'open the download page',
};

/** Copy for app updates (the About page and the update window). English is written here; the translations are in `update-copy.zh-Hans.ts`. */
const en = {
  failed: (step: UpdateStep, message: string) => `Couldn’t ${STEP[step]}: ${message}`,
  progress: 'Download progress',
  notes: 'What’s new in this version',
  close: 'Close',
};

export type UpdateMessages = typeof en;

export const U = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
