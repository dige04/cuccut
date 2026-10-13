import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './tools-music-copy.zh-Hans.ts';
import { zhHant } from './tools-music-copy.zh-Hant.ts';
import { ja } from './tools-music-copy.ja.ts';
import { ko } from './tools-music-copy.ko.ts';
import { es } from './tools-music-copy.es.ts';
import { fr } from './tools-music-copy.fr.ts';
import { de } from './tools-music-copy.de.ts';
import { nl } from './tools-music-copy.nl.ts';
import { ptBR } from './tools-music-copy.pt-BR.ts';
import { it } from './tools-music-copy.it.ts';
import { ru } from './tools-music-copy.ru.ts';
import { pl } from './tools-music-copy.pl.ts';
import { tr } from './tools-music-copy.tr.ts';
import { vi } from './tools-music-copy.vi.ts';

/** Copy for local music generation (translations in `tools-music-copy.<语言>.ts`). */
const en = {
  modes: {
    instrumental: { label: 'Instrumental', desc: 'No vocals, just music in the style you describe' },
    song: { label: 'Song', desc: 'Sings your lyrics; describe the voice and singing style in the style field' },
  },
  plannings: {
    full: { label: 'Full arrangement', desc: 'Writes a full score first; the steadiest structure, but slowest' },
    melody: { label: 'Melody first', desc: 'Sets a melody first, then builds on it' },
    off: { label: 'Direct', desc: 'No planning; fastest, structure may be loose' },
  },
  styles: {
    'calm-piano': 'Calm piano',
    'upbeat-pop': 'Upbeat pop',
    lofi: 'Lo-fi beat',
    ambient: 'Ambient electronic',
    acoustic: 'Acoustic guitar',
    epic: 'Epic orchestral',
  },
  pickModel: 'Choose a music model first',
  emptyStyle: 'Describe the style first',
  styleTooLong: (n: number, max: number) => `Style is ${n} characters · this model takes at most ${max}`,
  needLyrics: 'A song needs lyrics; switch to Instrumental if you want no vocals',
  lyricsTooLong: (n: number, max: number) => `Lyrics are ${n} characters · this model takes at most ${max}`,
  modeUnsupported: (mode: string) => `This model can't make ${mode}`,
  durationRange: (min: number, max: number) => `Length must be between ${min} and ${max} seconds`,
  maxBelowTarget: "The limit can't be shorter than the target length",
  seedDigits: 'Seed can only contain digits',
  downloadFirst: (label: string) => `Download ${label} first`,
  eta: (amount: string) => `About ${amount} on this computer`,
  etaCpu: (amount: string) => `Runs on CPU · about ${amount} on this computer`,
  etaSeconds: (n: number) => `${n} s`,
  etaMinutes: (n: number) => `${n} min`,
  tokens: (n: number) => `${n.toLocaleString('en')} semantic tokens`,
  headerChip: (label: string) => `${label} · generated on this computer · offline`,
  headerChipNone: 'Local music model',
  upTo: (sec: number) => `Up to ${sec} s`,
  takesLyrics: 'Sings lyrics',
  takesSeed: 'Takes a seed',
  nonCommercial: 'Non-commercial only',
  sec: (n: number) => `${n} s`,
  seed: (seed: number) => `Seed ${seed}`,
  steps: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`,
  took: (n: number) => `took ${n} s`,
  // Music bed fill (music-bed.ts)
  musicTrack: (n: number) => (n === 1 ? 'Music' : `Music ${n}`),
  tailFade: (sec: number) => `fades out over the last ${sec} s`,
  loopPieces: (n: number, total: number) => `loops ${n} times to fill ${total} s`,
  seamCrossfade: (sec: number) => `${sec} s crossfade at each seam`,
};
export type ToolsMusicMessages = typeof en;
export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
