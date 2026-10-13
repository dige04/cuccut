import { defineMessages } from '@cuccut/protocol';
import { languageName } from './caption-tracks.ts';
import { kindOfFileName } from './space.ts';
import { langName } from './tools-models.ts';
import { TARGET_LANGUAGES as TARGET_TAGS } from './translate-setup.ts';
import { zhHans } from './new-flow.zh-Hans.ts';
import { zhHant } from './new-flow.zh-Hant.ts';
import { ja } from './new-flow.ja.ts';
import { ko } from './new-flow.ko.ts';
import { es } from './new-flow.es.ts';
import { fr } from './new-flow.fr.ts';
import { de } from './new-flow.de.ts';
import { nl } from './new-flow.nl.ts';
import { ptBR } from './new-flow.pt-BR.ts';
import { it } from './new-flow.it.ts';
import { ru } from './new-flow.ru.ts';
import { pl } from './new-flow.pl.ts';
import { tr } from './new-flow.tr.ts';
import { vi } from './new-flow.vi.ts';

/** Copy for the link card and translation follow-up (translations are in `new-flow.<lang>.ts`). */
const en = {
  bilibili: 'Bilibili',
  directLink: 'Direct link',
  webPage: 'Web page',
  videoLink: (site: string) => `${site} video link`,
  /** Primary button “Translate into English”. */
  into: (name: string) => `Translate into ${name}`,
  translated: (language: string) => `Translation done · ${language} subtitles are on the video`,
};
export type NewFlowMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The parts still used by the pure logic of the former fixed home-page flow (design draft page-new.jsx ②, model-newproject.js, model-media.js): the kinds of material, whether a link looks like a link and the facts on the link card, the frame size and background color, the target language, and the “whether to transcribe” and “translate after transcription” that the link-import follow-up (components/start/flow-runner.ts) needs.
 * The home page's fixed flow has been retired (the start page now has only the input box, quick start and templates).
 */

export type FlowKey = 'sub' | 'a2v' | 'trans' | 'clean' | 'blank';
export type MediaKind = 'video' | 'audio' | 'other';
export type Ratio = '16:9' | '9:16' | '1:1';
export type BgHue = 'gray' | 'blue' | 'purple' | 'green' | 'orange' | 'magenta';

// ---- Material ----

/** The last segment of the path. */
export function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** Video / audio / other: same table as the Runtime's Space categories. */
export function mediaKindOf(name: string): MediaKind {
  const kind = kindOfFileName(fileNameOf(name));
  return kind === 'video-file' ? 'video' : kind === 'audio' ? 'audio' : 'other';
}

// ---- Link ----

/** Whether an address looks like an address: whether the card appears and whether the primary button can be pressed both use this one check (design draft `urlValid`). */
export function urlValid(url: string): boolean {
  return /^https?:\/\/\S+\.\S+/.test(url.trim());
}

export function hostOf(url: string): string {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url.trim());
  return match
    ? match[1]!
        .replace(/^www\./i, '')
        .replace(/:\d+$/, '')
        .toLowerCase()
    : '';
}

const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'];

/** File extension of a direct link (where the end of the address is a media file); page addresses return an empty string. */
export function directExt(url: string): string {
  const match = /\/([^/?#]+)\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url.trim());
  const ext = match ? match[2]!.toLowerCase() : '';
  return VIDEO_EXT.includes(ext) || AUDIO_EXT.includes(ext) ? ext : '';
}

const SITES: { host: RegExp; readonly name: string }[] = [
  { host: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, name: 'YouTube' },
  {
    host: /(^|\.)bilibili\.com$|(^|\.)b23\.tv$/,
    get name() {
      return M.bilibili;
    },
  },
  { host: /(^|\.)vimeo\.com$/, name: 'Vimeo' },
  { host: /(^|\.)twitch\.tv$/, name: 'Twitch' },
];

export interface LinkFacts {
  /** Site name (known sites write their Chinese or brand name, others the hostname); direct links write “Direct link”. */
  site: string;
  direct: boolean;
  host: string;
  /** Card title: for a direct link it is the file name; for a page it is “YouTube video link”. The real title is only known after parsing, so it is not made up here. */
  title: string;
}

/** Facts the card can show after the address is pasted and before starting: only what can be seen from the address itself (design draft `probeUrl` with the demo fake metadata removed). */
export function linkFacts(url: string): LinkFacts {
  const trimmed = url.trim();
  const host = hostOf(trimmed);
  const direct = directExt(trimmed) !== '';
  if (direct) {
    const match = /\/([^/?#]+)(?:[?#]|$)/.exec(trimmed);
    let name = match ? match[1]! : host;
    try {
      name = decodeURIComponent(name);
    } catch {
      // Keep as is.
    }
    return { site: M.directLink, direct, host, title: name };
  }
  const site = SITES.find((s) => s.host.test(host))?.name ?? (host || M.webPage);
  return { site, direct, host, title: M.videoLink(site) };
}

// ---- Frame and background ----

export const RATIO_SIZE: Record<Ratio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

/**
 * Six background-board colors → canvas base color (design draft `bgToken`: gray uses 300, the rest use 400). Colors on the canvas are video content and do not change with the UI theme, so they are written as the values of these tokens under the light theme.
 */
export const BG_COLOR: Record<BgHue, string> = {
  gray: '#DADADA',
  blue: '#ACCFFD',
  purple: '#DDC1F6',
  green: '#6BE3A2',
  orange: '#FFC15E',
  magenta: '#FFB9D0',
};

// ---- Target language ----

export interface TargetLanguage {
  /** BCP 47。 */
  code: string;
  /** The language's own spelling (the primary button reads “Translate into English”). */
  name: string;
  /** Chinese name. */
  native: string;
}

/** Languages it can translate into: same as the subtitle panel's “Translate into…” (model/translate-setup.ts); Chinese is split into Simplified and Traditional. */
export const TARGET_LANGUAGES: readonly TargetLanguage[] = TARGET_TAGS.map((code) => ({
  code,
  name: languageName(code),
  get native() {
    return langName(code);
  },
}));

export function targetLanguage(code: string): TargetLanguage {
  return TARGET_LANGUAGES.find((l) => l.code === code) ?? TARGET_LANGUAGES[0]!;
}

/** “Translate into English”: a space before a Latin-alphabet name (design draft `into`). */
export function into(name: string): string {
  return M.into(name);
}

// ---- Follow-up for link import ----

/** Whether this flow should transcribe. */
export function needsTranscribe(flow: FlowKey, subs: boolean): boolean {
  if (flow === 'blank' || flow === 'clean') return false;
  return flow !== 'a2v' || subs;
}

/** Follow-on chain (design draft `chainOf`): the one started automatically after transcription completes; only translation has one. */
export function chainOf(flow: FlowKey, target: TargetLanguage): { title: string; doneToast: string } | null {
  if (flow !== 'trans') return null;
  return { title: into(target.name), doneToast: M.translated(target.native) };
}
