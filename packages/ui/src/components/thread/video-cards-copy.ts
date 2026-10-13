import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './video-cards-copy.zh-Hans.ts';
import { zhHant } from './video-cards-copy.zh-Hant.ts';
import { ja } from './video-cards-copy.ja.ts';
import { ko } from './video-cards-copy.ko.ts';
import { es } from './video-cards-copy.es.ts';
import { fr } from './video-cards-copy.fr.ts';
import { de } from './video-cards-copy.de.ts';
import { nl } from './video-cards-copy.nl.ts';
import { ptBR } from './video-cards-copy.pt-BR.ts';
import { it } from './video-cards-copy.it.ts';
import { ru } from './video-cards-copy.ru.ts';
import { pl } from './video-cards-copy.pl.ts';
import { tr } from './video-cards-copy.tr.ts';
import { vi } from './video-cards-copy.vi.ts';

/**
 * The collapsed “之前的 N 项” (“N earlier items”) on the video card (product design §3.2.2; prototype agent-cards.jsx `MovieJobRows`). The English is the source of the keys and types;
 * the translations are in `video-cards-copy.<language>.ts`. The rest of the card's text is still in `VIDEO_CARD_COPY` in `copy.ts`.
 */
const en = {
  /** The text of the collapsed row. */
  earlier: (count: number) => `${count} earlier`,
  /** For a collapsed group that contains a failure with a remedy or retry: the text after the warning icon on the right. */
  pending: (count: number) => (count === 1 ? '1 needs attention' : `${count} need attention`),
  /** Screen-reader name of the button when items are pending: the two text segments would run together if read separately, so they are combined into one sentence. */
  earlierWithPending: (count: number, pending: number) =>
    `${count} earlier, ${pending === 1 ? '1 needs attention' : `${pending} need attention`}`,
  /** The expanded list. */
  earlierList: 'Earlier items',
};

export type VideoCardsMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
