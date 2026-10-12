import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './music-tool-copy.zh-Hans.ts';
import { zhHant } from './music-tool-copy.zh-Hant.ts';
import { ja } from './music-tool-copy.ja.ts';
import { ko } from './music-tool-copy.ko.ts';
import { es } from './music-tool-copy.es.ts';
import { fr } from './music-tool-copy.fr.ts';
import { de } from './music-tool-copy.de.ts';
import { nl } from './music-tool-copy.nl.ts';
import { ptBR } from './music-tool-copy.pt-BR.ts';
import { it } from './music-tool-copy.it.ts';
import { ru } from './music-tool-copy.ru.ts';
import { pl } from './music-tool-copy.pl.ts';
import { tr } from './music-tool-copy.tr.ts';
import { vi } from './music-tool-copy.vi.ts';

/** 工具 › 生成音乐（设计稿 tool-music.jsx）的文案；译文在 `music-tool-copy.<语言>.ts`。 */
const en = {
  title: 'Generate music',
  submit: 'Generate music',
  submitted: 'Queued · this computer makes one clip at a time',
  submittedFor: (name: string) => `Queued · when it’s done it’s added to “${name}”`,
  viewTask: 'View in Background tasks',
  submitFailed: (message: string) => `Didn’t start: ${message}`,
  reused: 'Brought back this version’s style and settings · the seed is left blank to roll again',
  noun: 'music model',
  manage: 'Manage music models…',
  soundtrackTitle: (name: string) => `Soundtrack for “${name}”`,
  soundtrackBody: (seconds: number) => `The length is prefilled from this video: ${seconds} s. When it’s done it goes onto the video’s music track, and it stays in Space too.`,
  soundtrackLoopBody: (videoSec: number, max: number) => `This video is ${videoSec} s, longer than the ${max} s a single clip can be: a ${max} s clip is generated and looped to fill the video, fading out at the end. It stays in Space too.`,
  soundtrackOff: 'Only generate, don’t add to the video',
  mode: 'Form',
  style: 'Style',
  styleAside: 'The model takes an English description: genre, instruments, tempo and mood',
  stylePlaceholder: 'e.g. calm solo piano, slow tempo, soft, cinematic',
  clear: 'Clear',
  lyrics: 'Lyrics',
  lyricsAside: 'One line per phrase; section tags like [verse] and [chorus] are understood',
  lyricsPlaceholder: '[verse]\nFirst verse…\n\n[chorus]\nChorus…',
  duration: 'Length',
  target: 'Target',
  limit: 'Limit',
  followTarget: 'Follow target',
  durationNote: (tokens: number, perSec: number) =>
    `The target is only an intent for the model, not exact; generation stops at the limit, so the ending may be abrupt. The limit sets the budget: ${tokens} semantic tokens (${perSec} per second).`,
  planning: 'Planning',
  seed: 'Seed',
  seedPlaceholder: 'Blank = random',
  seedNote: 'The same seed and settings make the same clip on the same computer; leave it blank for variety.',
  saveNote:
    'Each clip is a WAV in the save location and an audio item in Space, with a JSON file beside it recording the model, style, lyrics and seed; duplicate names get a number.',
  downloadBody: 'Downloading doesn’t use the task queue; once installed, this page’s main button works.',
  downloadBodyPaused:
    'Downloading doesn’t use the task queue; once installed, this page’s main button works. The download stopped partway; resuming continues from there.',
  side: 'Records',
  empty: 'Nothing generated yet',
  emptyBody:
    'Write a style, choose a model and select Generate music. A 30-second clip takes a few minutes on this computer, so you can do something else meanwhile.',
  sideFoot:
    'Generated WAVs are saved in the save location and appear under Audio in Space. Everything runs on this computer, offline. YuE2 weights are for non-commercial use only.',
  copyStyle: 'Copy style description',
  running: (phase: string, eta: string) => `${phase} · ${eta}`,
  truncated: (limit: number) =>
    `It hit the ${limit}-second limit, so the ending may be abrupt; raise the limit and generate again for a natural ending.`,
};
export type MusicToolMessages = typeof en;
export const MUSIC_TOOL_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
