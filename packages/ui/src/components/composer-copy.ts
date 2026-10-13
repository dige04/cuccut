import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './composer-copy.zh-Hans.ts';
import { zhHant } from './composer-copy.zh-Hant.ts';
import { ja } from './composer-copy.ja.ts';
import { ko } from './composer-copy.ko.ts';
import { es } from './composer-copy.es.ts';
import { fr } from './composer-copy.fr.ts';
import { de } from './composer-copy.de.ts';
import { nl } from './composer-copy.nl.ts';
import { ptBR } from './composer-copy.pt-BR.ts';
import { it } from './composer-copy.it.ts';
import { ru } from './composer-copy.ru.ts';
import { pl } from './composer-copy.pl.ts';
import { tr } from './composer-copy.tr.ts';
import { vi } from './composer-copy.vi.ts';

/**
 * Composer strings that are not in the shared shell catalog (agentcut PromptComposer). English is the source of keys and
 * types; translations live in `composer-copy.<locale>.ts`.
 */
const en = {
  /** The primary button while a run is going and the next message waits in the queue (agentcut: "Queue"). */
  queue: 'Queue',
};

export type ComposerMessages = typeof en;

export const COMPOSER_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
