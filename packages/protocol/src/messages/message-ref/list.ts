import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './list.zh-Hans.ts';
import { zhHant } from './list.zh-Hant.ts';
import { ja } from './list.ja.ts';
import { ko } from './list.ko.ts';
import { es } from './list.es.ts';
import { fr } from './list.fr.ts';
import { de } from './list.de.ts';
import { nl } from './list.nl.ts';
import { ptBR } from './list.pt-BR.ts';
import { it } from './list.it.ts';
import { ru } from './list.ru.ts';
import { pl } from './list.pl.ts';
import { tr } from './list.tr.ts';
import { vi } from './list.vi.ts';

/** The parameter is a scalar, or a nested reference (the text after expansion). */
type P<K extends string> = Record<K, string | number>;

/**
 * The generic join for `crates/message-ref` (`message_ref::join`).
 * The English entries match the Rust `msg!` templates word for word (checked by `tools/rust-messages.test.ts`). When the English changes, change both sides together. Keys are not renamed or reused after release.
 */
const en = {
  join: (p: P<'head' | 'tail'>) => `${p.head}; ${p.tail}`,
};

export type ListMessages = typeof en;

export const listMessages = defineCatalog('list', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
