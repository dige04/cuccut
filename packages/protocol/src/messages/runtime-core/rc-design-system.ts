import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-design-system.zh-Hans.ts';
import { zhHant } from './rc-design-system.zh-Hant.ts';
import { ja } from './rc-design-system.ja.ts';
import { ko } from './rc-design-system.ko.ts';
import { es } from './rc-design-system.es.ts';
import { fr } from './rc-design-system.fr.ts';
import { de } from './rc-design-system.de.ts';
import { nl } from './rc-design-system.nl.ts';
import { ptBR } from './rc-design-system.pt-BR.ts';
import { it } from './rc-design-system.it.ts';
import { ru } from './rc-design-system.ru.ts';
import { pl } from './rc-design-system.pl.ts';
import { tr } from './rc-design-system.tr.ts';
import { vi } from './rc-design-system.vi.ts';

/** 会话里的设计系统（docs/design/canvas §10）。英文是键与类型的来源，译文在 `rc-design-system.<语言>.ts`。 */
const en = {
  notASystem: "This folder isn't a design system: it has no valid design-system.json",
};

export type RcDesignSystemMessages = typeof en;

export const RcDesignSystem = defineCatalog('rcDesignSystem', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
