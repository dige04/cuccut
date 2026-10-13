import { defineMessages } from '@cuccut/protocol';
import { secondsLabel } from './transcript-copy.ts';
import { zhHans } from './cut-band-copy.zh-Hans.ts';
import { zhHant } from './cut-band-copy.zh-Hant.ts';
import { ja } from './cut-band-copy.ja.ts';
import { ko } from './cut-band-copy.ko.ts';
import { es } from './cut-band-copy.es.ts';
import { fr } from './cut-band-copy.fr.ts';
import { de } from './cut-band-copy.de.ts';
import { nl } from './cut-band-copy.nl.ts';
import { ptBR } from './cut-band-copy.pt-BR.ts';
import { it } from './cut-band-copy.it.ts';
import { ru } from './cut-band-copy.ru.ts';
import { pl } from './cut-band-copy.pl.ts';
import { tr } from './cut-band-copy.tr.ts';
import { vi } from './cut-band-copy.vi.ts';

/** When the cut text is too long, only this many leading characters are quoted. */
const QUOTE_MAX = 40;

const quote = (text: string) => `“${text.length > QUOTE_MAX ? `${text.slice(0, QUOTE_MAX - 1)}…` : text}”`;

const cut = (seconds: number, text: string) => (text ? `Cut ${secondsLabel(seconds)}: ${quote(text)}` : `Cut ${secondsLabel(seconds)}`);

/** Copy for the timeline cut bands (prototype timeline-cutbands.jsx, `retime` in editor-cuts.jsx). Translations are in `cut-band-copy.zh-Hans.ts`. */
const en = {
  /** Hover line one: how much was cut, and which words were cut. */
  cut,
  /** Hover line two: how to operate. Hold Alt (Option on macOS) to not snap. */
  hint: (mac: boolean) => `Click to restore · drag the edges to change the range (hold ${mac ? 'Option' : 'Alt'} to turn off snapping)`,
  /** Screen-reader name. */
  label: (seconds: number, text: string) => `Cut, ${cut(seconds, text)}, click to restore`,
  /** Readout that floats over the band while dragging: the new cut length and the word snapped to; dragging to zero width restores it. */
  tag: (seconds: number, edge: 'start' | 'end', word: string | null) =>
    `−${secondsLabel(seconds)}${word ? (edge === 'start' ? ` · from “${word.trim()}”` : ` · to “${word.trim()}”`) : ''}`,
  tagRestore: 'Release to restore',
  retimed: (before: number, after: number) => `Changed cut range · ${secondsLabel(before)} → ${secondsLabel(after)}`,
};

export type CutBandMessages = typeof en;
export const CUT_BAND_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
