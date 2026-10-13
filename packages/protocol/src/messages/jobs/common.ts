import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './common.zh-Hans.ts';
import { zhHant } from './common.zh-Hant.ts';
import { ja } from './common.ja.ts';
import { ko } from './common.ko.ts';
import { es } from './common.es.ts';
import { fr } from './common.fr.ts';
import { de } from './common.de.ts';
import { nl } from './common.nl.ts';
import { ptBR } from './common.pt-BR.ts';
import { it } from './common.it.ts';
import { ru } from './common.ru.ts';
import { pl } from './common.pl.ts';
import { tr } from './common.tr.ts';
import { vi } from './common.vi.ts';

/** Fragments shared across `packages/jobs`: list separators, and combined sentences such as “explanation: reason”. */
const en = {
  /** Separator used when several IDs or names are joined into a list (read when used). */
  listSeparator: ', ',
  /** Appends a reason after a sentence of explanation. The reason can be another message reference, or verbatim third-party text. */
  withCause: (p: { message: string; cause: string }) => `${p.message}: ${p.cause}`,
};

export type JobsCommonMessages = typeof en;

export const JobsCommon = defineCatalog('jobsCommon', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
