import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './rail-copy.zh-Hans.ts';
import { zhHant } from './rail-copy.zh-Hant.ts';
import { ja } from './rail-copy.ja.ts';
import { ko } from './rail-copy.ko.ts';
import { es } from './rail-copy.es.ts';
import { fr } from './rail-copy.fr.ts';
import { de } from './rail-copy.de.ts';
import { nl } from './rail-copy.nl.ts';
import { ptBR } from './rail-copy.pt-BR.ts';
import { it } from './rail-copy.it.ts';
import { ru } from './rail-copy.ru.ts';
import { pl } from './rail-copy.pl.ts';
import { tr } from './rail-copy.tr.ts';
import { vi } from './rail-copy.vi.ts';

const count = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

/** Copy for the page rails and section headers of Tasks, Tools and Services. Translations live in `rail-copy.<locale>.ts`. */
const en = {
  running: (n: number) => `${n} running`,
  finished: (n: number) => `${n} finished`,
  nothingYet: 'Nothing yet',
  tasksBlurb: 'Transcription, translation, exports and agent work, all in one list. Open a task to see its steps and results.',
  toolCount: (n: number) => count(n, 'tool', 'tools'),
  /** Under the rail's finished tasks when only the most recent are listed there. */
  moreFinished: (n: number) => `${n} more in All tasks`,
};

export type RailMessages = typeof en;

export const RAIL_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
