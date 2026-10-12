import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-slides.zh-Hans.ts';
import { zhHant } from './rc-slides.zh-Hant.ts';
import { ja } from './rc-slides.ja.ts';
import { ko } from './rc-slides.ko.ts';
import { es } from './rc-slides.es.ts';
import { fr } from './rc-slides.fr.ts';
import { de } from './rc-slides.de.ts';
import { nl } from './rc-slides.nl.ts';
import { ptBR } from './rc-slides.pt-BR.ts';
import { it } from './rc-slides.it.ts';
import { ru } from './rc-slides.ru.ts';
import { pl } from './rc-slides.pl.ts';
import { tr } from './rc-slides.tr.ts';
import { vi } from './rc-slides.vi.ts';

/** 会话里的幻灯片（docs/design/slides）。英文是键与类型的来源，译文在 `rc-slides.<语言>.ts`。 */
const en = {
  notADeck: "This folder isn't a slide deck: it has no valid deck.json",
};

export type RcSlidesMessages = typeof en;

export const RcSlides = defineCatalog('rcSlides', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
