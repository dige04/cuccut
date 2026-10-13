import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './caption-layer.zh-Hans.ts';
import { zhHant } from './caption-layer.zh-Hant.ts';
import { ja } from './caption-layer.ja.ts';
import { ko } from './caption-layer.ko.ts';
import { es } from './caption-layer.es.ts';
import { fr } from './caption-layer.fr.ts';
import { de } from './caption-layer.de.ts';
import { nl } from './caption-layer.nl.ts';
import { ptBR } from './caption-layer.pt-BR.ts';
import { it } from './caption-layer.it.ts';
import { ru } from './caption-layer.ru.ts';
import { pl } from './caption-layer.pl.ts';
import { tr } from './caption-layer.tr.ts';
import { vi } from './caption-layer.vi.ts';

/** `packages/jobs/src/pipelines/caption-layer.ts`: step names, errors, warnings and names written into the video for the “build caption layer” step. */
const en = {
  /** Step name, also the label of the transaction. */
  label: 'Add subtitle layer',
  noSource: 'There is no document to add a subtitle layer for',
  videoClosed: 'The video was closed, so no subtitle layer was added. Open the video and try again.',
  empty: 'The document has no subtitles to show, so no subtitle layer was added',
  notOnTimeline: "No clip on the timeline uses this asset, so the subtitles can't appear on screen. No subtitle layer was added.",
  noDocumentId: "The subtitle layer was added, but its document ID wasn't returned",
  rejected: 'The transaction to add the subtitle layer was rejected',
  documentGone: 'The document for the subtitle layer is no longer in the video',
  needsOutputStore: "Reading the Speech Worker's subtitles requires the output store",
  notSpeech: 'The document is not a transcript',
  speechUnreadable: "Couldn't read the transcript body",
  translationUnreadable: "Couldn't read the translation body",
  unaligned: (p: { count: number }) =>
    `${p.count} translation units aren't aligned (alignment is null), so their timing can't be worked out`,
  noSourceSpeech: "Couldn't find the transcript this translation was made from",
  /** Names written into the video: the caption track, the caption document and the caption instance. */
  subtitlesName: 'Subtitles',
  /** Name written into the video: the translated caption layer with no language. */
  translationName: 'Translation',
  /** Name written into the video: the caption style document shared by bilingual captions. */
  styleName: 'Subtitle style',
};

export type JobsCaptionLayerMessages = typeof en;

export const JobsCaptionLayer = defineCatalog('jobsCaptionLayer', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
