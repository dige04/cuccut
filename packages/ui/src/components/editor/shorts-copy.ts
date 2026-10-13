import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './shorts-copy.zh-Hans.ts';
import { zhHant } from './shorts-copy.zh-Hant.ts';
import { ja } from './shorts-copy.ja.ts';
import { ko } from './shorts-copy.ko.ts';
import { es } from './shorts-copy.es.ts';
import { fr } from './shorts-copy.fr.ts';
import { de } from './shorts-copy.de.ts';
import { nl } from './shorts-copy.nl.ts';
import { ptBR } from './shorts-copy.pt-BR.ts';
import { it } from './shorts-copy.it.ts';
import { ru } from './shorts-copy.ru.ts';
import { pl } from './shorts-copy.pl.ts';
import { tr } from './shorts-copy.tr.ts';
import { vi } from './shorts-copy.vi.ts';

/**
 * Copy for the shorts cut from a video after “剪成短视频”(cut into shorts) (product design §5.10; prototypes panel-aitools-shorts-result.jsx, shorts-source.jsx, panel-transcript-cut.jsx):
 * the result page, the banner at the top of child videos, and the cut seams outside clips in the script. Translations are in `shorts-copy.<语言>.ts`.
 */
const en = {
  // Result page
  created: (n: number) => `${n} created`,
  pager: (k: number, n: number) => `${k} of ${n}`,
  prev: 'Previous short',
  next: 'Next short',
  lead: 'Open a short to edit it right here. What’s outside the clip is struck out in the transcript; click a sentence to bring it back. You can rename each one.',
  working: 'The Agent is still finding and creating shorts. They show up here as they’re created.',
  none: 'This session hasn’t created any shorts.',
  allTrashed: 'These shorts are all in Trash. Restore them from Trash in Library, or cut a few more.',
  watching: 'Viewing',
  open: 'Open',
  discard: 'Don’t keep',
  discarded: (name: string) => `Moved to Trash · ${name}`,
  undo: 'Undo',
  span: (from: string, to: string, length: string) => `${from} – ${to} · ${length}`,
  hookLabel: 'Opens with',
  reasonLabel: 'Why this one',
  /** The “取景”(framing) line on the card (prototype `frameText`): when framing is split by shot, it says how many shots there are and which segment to drag on the canvas to adjust. */
  framingLabel: 'Framing',
  framingShots: (n: number) => `Framed per shot (${n} shots) · Open it and drag a part on the canvas to change`,
  rename: 'Click to rename',
  renameLabel: 'Short title',
  failed: (reason: string) => `Couldn’t do that: ${reason}`,
  nextHead: 'Next',
  more: 'Cut a few more',
  moreSub: 'Back to settings; parts already cut are skipped',
  inSpace: 'See these in Library',
  inSpaceSub: (name: string) => `Filtered by source · shorts cut from “${name}”`,
  exportAll: 'Export all…',
  exportAllSub: (n: number) => (n === 1 ? 'Exports it as a video' : `Exports each of the ${n} as its own video`),
  exporting: 'Starting the exports…',
  exportStarted: (n: number) => (n === 1 ? 'Started 1 export · progress is in Background tasks' : `Started ${n} exports · progress is in Background tasks`),
  exportSkipOpening: 'it’s still opening',
  exportSkipped: (n: number, detail: string) => (n === 1 ? `Skipped 1 short · ${detail}` : `Skipped ${n} shorts · ${detail}`),
  exportSkippedItem: (name: string, reason: string) => `“${name}”: ${reason}`,
  exportSkippedSeparator: '; ',
  hint: 'Each short is a separate video that uses the same original footage and transcript. Move the ones you don’t want to Trash; you can restore them.',
  backTo: (name: string) => `Back to “${name}”`,

  // Banner at the top of child videos
  bannerFrom: (name: string) => `Short cut from “${name}”`,
  bannerMissing: 'Short · the source video is no longer in the library',
  bannerBack: 'Back to original',

  // Adjusting the cut's start and end from the script: the banner cell, the “正在看”(currently viewing) card on the result page, and the script's hint
  cutAdjust: 'Adjust in transcript',
  cutAdjustTip: 'Bring back text outside the clip in the transcript, or cut a few more sentences',
  cutTrim: 'Trim',
  cutTrimTip: 'Go to the transcript: bring back text outside the clip, or cut a few more sentences',
  cutBack: (label: string) => `Back to ${label}`,
  cutBackTip: 'Back to the panel you were on before the transcript',
  cutBackResult: 'Back to results',
  cutResult: 'See results',
  cutResultTip: 'Open the results of this Cut into shorts session',
  cutHint: 'Text outside the clip is struck out; click it to bring it back',

  // Cut seams outside clips in the script
  foldBefore: (length: string) => `${length} earlier is cut`,
  foldAfter: (length: string) => `${length} later is cut`,
  foldBeforeOpen: (n: number) => (n === 1 ? 'The 1 struck sentence before is shown' : `All ${n} struck sentences before are shown`),
  foldAfterOpen: (n: number) => (n === 1 ? 'The 1 struck sentence after is shown' : `All ${n} struck sentences after are shown`),
  expand: (n: number) => (n === 1 ? 'Show 1 sentence' : `Show ${n} sentences`),
  expandMore: (n: number) => (n === 1 ? 'Show 1 more' : `Show ${n} more`),
  collapse: 'Collapse',
  outsideWord: 'Outside the clip · click to bring it back into this short',

  // The “切出的短视频”(shorts cut from this video) group in the parent video's panel
  madeTitle: 'Shorts cut from this video',
  madeCount: (n: number) => (n === 1 ? '1 short' : `${n} shorts`),
  madeFoot: 'Each short is a separate video that uses the same original footage. Click one to open it and keep editing there.',
  madeOpen: (name: string) => `Open “${name}”`,
  madeMore: (n: number) => (n === 1 ? '1 more short' : `${n} more shorts`),
};

export type ShortsMessages = typeof en;
export const SHORTS_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
