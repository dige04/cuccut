import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './stage-bar-copy.zh-Hans.ts';
import { zhHant } from './stage-bar-copy.zh-Hant.ts';
import { ja } from './stage-bar-copy.ja.ts';
import { ko } from './stage-bar-copy.ko.ts';
import { es } from './stage-bar-copy.es.ts';
import { fr } from './stage-bar-copy.fr.ts';
import { de } from './stage-bar-copy.de.ts';
import { nl } from './stage-bar-copy.nl.ts';
import { ptBR } from './stage-bar-copy.pt-BR.ts';
import { it } from './stage-bar-copy.it.ts';
import { ru } from './stage-bar-copy.ru.ts';
import { pl } from './stage-bar-copy.pl.ts';
import { tr } from './stage-bar-copy.tr.ts';
import { vi } from './stage-bar-copy.vi.ts';

/**
 * Copy for the stage bottom toolbar (stage-bar.tsx). Mute and volume use the media player's copy (player-copy); captions and fullscreen use the fullscreen player's copy.
 * English is written here; translations are in `stage-bar-copy.zh-Hans.ts` and others.
 */
const en = {
  ratio: 'Aspect ratio',
  ratioReadOnly: 'Aspect ratio · the video is read-only',
  /** Notice shown after applying a custom aspect ratio. */
  ratioApplied: (ratio: string) => `Aspect ratio changed to ${ratio}`,
  original: 'Original',
  originalHint: (ratio: string) => `Matches the video file · ${ratio}`,
  originalNone: 'There’s no video file to match',
  custom: 'Custom…',
  customTitle: 'Custom aspect ratio',
  customWidth: 'Width',
  customHeight: 'Height',
  customSize: (width: number, height: number) => `The short side stays the same · new size ${width} × ${height}`,
  customInvalid: 'Enter two numbers greater than 0',
  customTooLong: (max: number) => `The long side would be over ${max} pixels · try a less extreme ratio`,
  apply: 'Apply',
  safeArea: 'Platform safe area',
  safeAreaHint: 'Marks where the platform’s buttons and text cover the picture',
  safeAreaPortraitOnly: 'Only portrait frames have platform buttons in the way',
  /** Labels for the three obscured areas on the safe-area overlay. */
  safeZones: { top: 'Status bar', right: 'Like · comment · share', bottom: 'Account · caption · comments' },
  showCaptions: 'Show subtitles',
  hideCaptions: 'Hide subtitles',
};

export type StageBarMessages = typeof en;

export const STAGE_BAR_COPY = defineMessages(en, {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ja,
  ko,
  es,
  fr,
  de,
  nl,
  'pt-BR': ptBR,
  it,
  ru,
  pl,
  tr,
  vi,
});
