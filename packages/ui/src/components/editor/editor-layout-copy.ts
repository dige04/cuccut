import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './editor-layout-copy.zh-Hans.ts';
import { zhHant } from './editor-layout-copy.zh-Hant.ts';
import { ja } from './editor-layout-copy.ja.ts';
import { ko } from './editor-layout-copy.ko.ts';
import { es } from './editor-layout-copy.es.ts';
import { fr } from './editor-layout-copy.fr.ts';
import { de } from './editor-layout-copy.de.ts';
import { nl } from './editor-layout-copy.nl.ts';
import { ptBR } from './editor-layout-copy.pt-BR.ts';
import { it } from './editor-layout-copy.it.ts';
import { ru } from './editor-layout-copy.ru.ts';
import { pl } from './editor-layout-copy.pl.ts';
import { tr } from './editor-layout-copy.tr.ts';
import { vi } from './editor-layout-copy.vi.ts';

/** The editor's layout chrome: the panel card on the left, the bar under the frame, the timeline card and the inspector. */
const en = {
  panels: 'Editor panels',
  groupScript: 'Script',
  groupMedia: 'Media',
  groupElements: 'Elements',
  groupAi: 'AI',
  groupTabs: (group: string) => `${group} panels`,
  hidePanels: 'Hide panels',
  showPanels: 'Show panels',
  pickHint: 'Pick something on the frame or the timeline to edit it.',
  timeline: 'Timeline',
  add: 'Add',
  addText: 'Text',
  addTextTip: 'A text box at the playhead',
  addImage: 'Image',
  addImageTip: 'Pictures from this video, your library or a generator',
  addMusic: 'Music',
  addMusicTip: 'Music and sound, on their own track',
  addElement: 'Element',
  addElementTip: 'Shapes, stickers and animated elements',
  addCaptions: 'Captions',
  addCaptionsTip: 'Subtitles made from the transcript',
  timelineHint: 'Drag clips to move them · Drag an edge to trim · Drop media on a track to place it',
  inspector: 'Selection properties',
  nothingPicked: 'Nothing picked. A clip’s properties appear here, and its everyday controls in the bar under the frame.',
  videoWhole: 'The video as a whole — canvas, background, format — is in Video settings.',
  videoSettings: 'Video settings',
  styleGuide: 'Style guide…',
  videoMenu: 'Video',
  shortcuts: 'Keyboard shortcuts',
  more: 'More actions',
  clearSelection: 'Clear selection',
  moreControls: 'More controls',
  readOnlyAdd: 'This video is read-only, so nothing can be added',
};

export type EditorLayoutMessages = typeof en;
export const EDITOR_LAYOUT_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
