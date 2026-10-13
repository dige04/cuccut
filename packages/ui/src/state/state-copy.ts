import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './state-copy.zh-Hans.ts';
import { zhHant } from './state-copy.zh-Hant.ts';
import { ja } from './state-copy.ja.ts';
import { ko } from './state-copy.ko.ts';
import { es } from './state-copy.es.ts';
import { fr } from './state-copy.fr.ts';
import { de } from './state-copy.de.ts';
import { nl } from './state-copy.nl.ts';
import { ptBR } from './state-copy.pt-BR.ts';
import { it } from './state-copy.it.ts';
import { ru } from './state-copy.ru.ts';
import { pl } from './state-copy.pl.ts';
import { tr } from './state-copy.tr.ts';
import { vi } from './state-copy.vi.ts';

/** Copy for the UI state layer (task mirror, etc.). English is written here; translations are in `state-copy.zh-Hans.ts`. */
const en = {
  task: {
    running: 'In progress',
    stopping: 'Stopping',
    awaitingApproval: 'Waiting for approval',
  },
};

export type StateMessages = typeof en;

export const SC = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
