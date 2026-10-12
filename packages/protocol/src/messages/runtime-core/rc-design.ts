import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-design.zh-Hans.ts';
import { zhHant } from './rc-design.zh-Hant.ts';
import { ja } from './rc-design.ja.ts';
import { ko } from './rc-design.ko.ts';
import { es } from './rc-design.es.ts';
import { fr } from './rc-design.fr.ts';
import { de } from './rc-design.de.ts';
import { nl } from './rc-design.nl.ts';
import { ptBR } from './rc-design.pt-BR.ts';
import { it } from './rc-design.it.ts';
import { ru } from './rc-design.ru.ts';
import { pl } from './rc-design.pl.ts';
import { tr } from './rc-design.tr.ts';
import { vi } from './rc-design.vi.ts';

/** 会话里的设计稿（docs/design/canvas）。英文是键与类型的来源，译文在 `rc-design.<语言>.ts`。 */
const en = {
  notACanvas: "This folder isn't a design: it has no valid canvas.json",
};

export type RcDesignMessages = typeof en;

export const RcDesign = defineCatalog('rcDesign', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
