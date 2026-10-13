import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './time.zh-Hans.ts';
import { zhHant } from './time.zh-Hant.ts';
import { ja } from './time.ja.ts';
import { ko } from './time.ko.ts';
import { es } from './time.es.ts';
import { fr } from './time.fr.ts';
import { de } from './time.de.ts';
import { nl } from './time.nl.ts';
import { ptBR } from './time.pt-BR.ts';
import { it } from './time.it.ts';
import { ru } from './time.ru.ts';
import { pl } from './time.pl.ts';
import { tr } from './time.tr.ts';
import { vi } from './time.vi.ts';

/** The parameter is a scalar, or a nested reference (the text after expansion). */
type P<K extends string> = Record<K, string | number>;

/**
 * Time input errors from `crates/editor-semantics` (carried through the parameters of engine errors).
 * The English entries match the Rust `msg!` templates word for word (checked by `tools/rust-messages.test.ts`). When the English changes, change both sides together. Keys are not renamed or reused after release.
 */
const en = {
  rateNotPositive: 'Frame rate numerator and denominator must be positive',
  rateNotReduced: 'Frame rate must be in lowest terms',
  timescaleNotPositive: 'timescale must be greater than 0',
  notInteger: (p: P<'text'>) => `Not a decimal integer: "${p.text}"`,
  leadingZero: 'Integers cannot have leading zeros',
  notDecimalSeconds: (p: P<'text'>) => `Not decimal seconds: "${p.text}"`,
  negativePosition: 'An absolute position cannot be negative',
};

export type TimeMessages = typeof en;

export const timeMessages = defineCatalog('time', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
