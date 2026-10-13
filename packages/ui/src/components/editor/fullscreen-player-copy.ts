import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './fullscreen-player-copy.zh-Hans.ts';
import { zhHant } from './fullscreen-player-copy.zh-Hant.ts';
import { ja } from './fullscreen-player-copy.ja.ts';
import { ko } from './fullscreen-player-copy.ko.ts';
import { es } from './fullscreen-player-copy.es.ts';
import { fr } from './fullscreen-player-copy.fr.ts';
import { de } from './fullscreen-player-copy.de.ts';
import { nl } from './fullscreen-player-copy.nl.ts';
import { ptBR } from './fullscreen-player-copy.pt-BR.ts';
import { it } from './fullscreen-player-copy.it.ts';
import { ru } from './fullscreen-player-copy.ru.ts';
import { pl } from './fullscreen-player-copy.pl.ts';
import { tr } from './fullscreen-player-copy.tr.ts';
import { vi } from './fullscreen-player-copy.vi.ts';

/**
 * Copy for the editor's fullscreen player (fullscreen-player.tsx). Common terms such as play, mute, playback speed and exit fullscreen use the media player's copy (player-copy); previous and next chapter use chapter-copy. English is written here; translations are in `fullscreen-player-copy.zh-Hans.ts` and so on.
 */
const en = {
  /** Screen-reader names for the fullscreen player. */
  region: 'Full-screen player',
  /** The entry button at the top of the preview. */
  enter: 'Full-screen playback',
  enterTip: 'Full-screen playback (F)',
  captions: 'Subtitles',
  captionsTip: (mode: string) => `Subtitles: ${mode} (C)`,
  captionMode: { off: 'Subtitles off', source: 'Original', trans: 'Translation', both: 'Bilingual' },
  keysTip: 'Keyboard shortcuts (?)',
  keysTitle: 'Keyboard shortcuts',
  /** The line under the key table: shown only when Esc returns to the player (the browser granted keyboard lock). */
  keysFooter: 'Press Esc to close this sheet, then Esc again to leave full screen.',
  /** The rows of the key table (`PLAYER_KEYS` in model/player, taken by action). */
  keys: {
    play: 'Play / pause (same as a single click on the picture)',
    exit: 'Leave full screen (same as a double click on the picture)',
    back: 'Back / forward 5 seconds',
    back10: 'Back / forward 10 seconds',
    prevChapter: 'Previous / next chapter',
    volUp: 'Volume ±10 (unmutes automatically)',
    mute: 'Mute / unmute',
    captions: 'Cycle the subtitle mode',
    start: 'Jump to the start / end',
    percent: 'Jump to 0% – 90% of the video',
    keys: 'This sheet',
  },
};

export type FullscreenPlayerMessages = typeof en;

export const FULLSCREEN_PLAYER_COPY = defineMessages(en, {
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
