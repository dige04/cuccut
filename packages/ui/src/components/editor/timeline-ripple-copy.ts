import { defineMessages } from '@cuccut/protocol';
import { secondsLabel } from './transcript-copy.ts';
import { zhHans } from './timeline-ripple-copy.zh-Hans.ts';
import { zhHant } from './timeline-ripple-copy.zh-Hant.ts';
import { ja } from './timeline-ripple-copy.ja.ts';
import { ko } from './timeline-ripple-copy.ko.ts';
import { es } from './timeline-ripple-copy.es.ts';
import { fr } from './timeline-ripple-copy.fr.ts';
import { de } from './timeline-ripple-copy.de.ts';
import { nl } from './timeline-ripple-copy.nl.ts';
import { ptBR } from './timeline-ripple-copy.pt-BR.ts';
import { it } from './timeline-ripple-copy.it.ts';
import { ru } from './timeline-ripple-copy.ru.ts';
import { pl } from './timeline-ripple-copy.pl.ts';
import { tr } from './timeline-ripple-copy.tr.ts';
import { vi } from './timeline-ripple-copy.vi.ts';

/**
 * Copy for “delete a range and shift the rest forward” on the timeline (prototype editor-keys.jsx `del` / `removeRange`, and the item in timeline-menu.jsx): the hint shown after deleting and closing the gap; the context menu item and ⇧Delete's “Delete this range from all tracks”. The translations are in `timeline-ripple-copy.zh-Hans.ts`.
 */
const en = {
  /** One item in the right-click menu. */
  removeSpan: 'Delete span from all tracks',
  removeSpanHint: 'Later content moves up · total gets shorter',
  /** When only subtitles are selected: subtitles fill the whole track, so their range is not taken. */
  removeSpanCaptions: 'Subtitles span the whole video · Select a clip',
  /** The gap was closed after deleting; `deleted` is the sentence “N clips deleted”. */
  closed: (deleted: string, seconds: number) => `${deleted} · Closed the ${secondsLabel(seconds)} gap`,
  /** Deleted, but the gap is followed by a locked track or clip, so it was not closed. */
  gapKept: (deleted: string) => `${deleted} · Gap kept: a track or clip after it is locked`,
  removed: (seconds: number) => `Deleted ${secondsLabel(seconds)} from all tracks · Later content moved up`,
  pickSpan: 'Select a clip on the timeline first, then delete its span from all tracks',
  locked: 'A track or clip after this span is locked · Unlock it first',
};

export type TimelineRippleMessages = typeof en;
export const TIMELINE_RIPPLE_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
