import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './runtime-copy.zh-Hans.ts';
import { zhHant } from './runtime-copy.zh-Hant.ts';
import { ja } from './runtime-copy.ja.ts';
import { ko } from './runtime-copy.ko.ts';
import { es } from './runtime-copy.es.ts';
import { fr } from './runtime-copy.fr.ts';
import { de } from './runtime-copy.de.ts';
import { nl } from './runtime-copy.nl.ts';
import { ptBR } from './runtime-copy.pt-BR.ts';
import { it } from './runtime-copy.it.ts';
import { ru } from './runtime-copy.ru.ts';
import { pl } from './runtime-copy.pl.ts';
import { tr } from './runtime-copy.tr.ts';
import { vi } from './runtime-copy.vi.ts';

/** Copy for the connection layer between the UI and the Runtime (creating videos, open videos, media cache). The English is written here; the translations are in `runtime-copy.zh-Hans.ts`. */
const en = {
  missingContext: 'RuntimeContext is missing',
  mediaStatus: (status: number) => `The media service returned ${status}`,
  noRootSequence: 'The new video has no main sequence',
  /** Name for a newly created waveform instance. */
  waveformName: 'Waveform',
  noDuration: 'The video has no length yet, so the waveform wasn’t added',
  noOpenVideo: 'No video is open',
  notCaughtUp: 'The video hasn’t caught up yet and can’t be changed right now',
};

export type RuntimeMessages = typeof en;

export const RT = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
