import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './session-copy.zh-Hans.ts';
import { zhHant } from './session-copy.zh-Hant.ts';
import { ja } from './session-copy.ja.ts';
import { ko } from './session-copy.ko.ts';
import { es } from './session-copy.es.ts';
import { fr } from './session-copy.fr.ts';
import { de } from './session-copy.de.ts';
import { nl } from './session-copy.nl.ts';
import { ptBR } from './session-copy.pt-BR.ts';
import { it } from './session-copy.it.ts';
import { ru } from './session-copy.ru.ts';
import { pl } from './session-copy.pl.ts';
import { tr } from './session-copy.tr.ts';
import { vi } from './session-copy.vi.ts';

/** Copy for the session layout: its glass header, the sessions drawer and the right column. */
const en = {
  showSessions: 'Show sessions',
  hideSessions: 'Hide sessions',
  sessionsBlurb: 'Pick up where you left off.',
  inspector: 'Selection',
  noProject: 'No project',
};

export type SessionMessages = typeof en;

export const SESSION_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
