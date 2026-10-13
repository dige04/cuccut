import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './protocol-labels.zh-Hans.ts';
import { zhHant } from './protocol-labels.zh-Hant.ts';
import { ja } from './protocol-labels.ja.ts';
import { ko } from './protocol-labels.ko.ts';
import { es } from './protocol-labels.es.ts';
import { fr } from './protocol-labels.fr.ts';
import { de } from './protocol-labels.de.ts';
import { nl } from './protocol-labels.nl.ts';
import { ptBR } from './protocol-labels.pt-BR.ts';
import { it } from './protocol-labels.it.ts';
import { ru } from './protocol-labels.ru.ts';
import { pl } from './protocol-labels.pl.ts';
import { tr } from './protocol-labels.tr.ts';
import { vi } from './protocol-labels.vi.ts';

/** Human-facing names in the protocol: access modes, kinds of data sent externally, and the placeholder in remedy commands. */
const en = {
  modePlan: 'Plan first',
  modeAsk: 'Supervised',
  modeAutoAcceptEdits: 'Auto-accept edits',
  modeAuto: 'Auto',
  modeFullAccess: 'Full access',
  dataTranscript: 'Transcripts and translations',
  dataFrames: 'Frames and thumbnails',
  dataAudio: 'Audio',
  dataVideo: 'Original video',
  dataDocument: 'Text and prompts',
  dataContext: 'Agent conversation context',
  /** Placeholder in `custom:<name>`. */
  customProviderPlaceholder: 'custom:name',
  bundlesCommandNote: '(list local model bundles)',
  pairCommandArgs: '<address[:port]> <pairing-code>',
};

export type ProtocolLabelsMessages = typeof en;

export const ProtocolLabels = defineCatalog('protocolLabels', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
