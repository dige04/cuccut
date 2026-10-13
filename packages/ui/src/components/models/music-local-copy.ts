import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './music-local-copy.zh-Hans.ts';
import { zhHant } from './music-local-copy.zh-Hant.ts';
import { ja } from './music-local-copy.ja.ts';
import { ko } from './music-local-copy.ko.ts';
import { es } from './music-local-copy.es.ts';
import { fr } from './music-local-copy.fr.ts';
import { de } from './music-local-copy.de.ts';
import { nl } from './music-local-copy.nl.ts';
import { ptBR } from './music-local-copy.pt-BR.ts';
import { it } from './music-local-copy.it.ts';
import { ru } from './music-local-copy.ru.ts';
import { pl } from './music-local-copy.pl.ts';
import { tr } from './music-local-copy.tr.ts';
import { vi } from './music-local-copy.vi.ts';

/** Text for Settings › Models › Music generation › Local models (design mock settings-music.jsx); translations are in `music-local-copy.<语言>.ts`. */
const en = {
  defaultDesc: 'Preselected when you generate music; with no default you choose the model yourself, and your choice wins.',
  cloudDefault: (name: string) => `The default is ${name}; choosing a local model here replaces it.`,
  noInstalled: 'No music model is installed yet: download one below first.',
  licenseUse: 'Music made with it can only be used in non-commercial content too; for videos you plan to sell or monetize, use other music.',
  style: 'Style',
  mode: 'Form',
  note: (seconds: number, steps: number | null, eta: string) =>
    `The preview is fixed at ${seconds} s${steps !== null ? `, ${steps} steps` : ''}, with no planning; it only checks that this model and its music engine can make sound. ${eta}.`,
  songNote: 'A song uses a short built-in sample lyric.',
  toolNote: 'For a real soundtrack, use Tools › Generate music.',
  openTool: 'Open Generate music',
  generate: 'Generate preview',
  again: 'Generate again',
  cancel: 'Cancel',
  busy: 'Generating…',
  stalePrefix: 'Previous · ',
  stale: 'This clip came from your previous choice; after changing the style or form, select Generate preview to hear the new one.',
  download: 'Download',
  resultLabel: 'Preview result',
  loadingAudio: 'Loading audio…',
  audioFailed: (message: string) => `Couldn't load the audio: ${message}`,
  downloadFailed: (message: string) => `Couldn't download: ${message}`,
  fileName: (name: string) => `${name} preview.wav`,
};
export type MusicLocalMessages = typeof en;
export const MUSIC_LOCAL_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
