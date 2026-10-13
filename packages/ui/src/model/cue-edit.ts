import { defineMessages, type EditOperation, type Sequence } from '@cuccut/protocol';
import { trackFree } from './editor-ops.ts';
import type { Cue as FileCue } from './subtitles.ts';
import { zhHans } from './cue-edit.zh-Hans.ts';
import { zhHant } from './cue-edit.zh-Hant.ts';
import { ja } from './cue-edit.ja.ts';
import { ko } from './cue-edit.ko.ts';
import { es } from './cue-edit.es.ts';
import { fr } from './cue-edit.fr.ts';
import { de } from './cue-edit.de.ts';
import { nl } from './cue-edit.nl.ts';
import { ptBR } from './cue-edit.pt-BR.ts';
import { it } from './cue-edit.it.ts';
import { ru } from './cue-edit.ru.ts';
import { pl } from './cue-edit.pl.ts';
import { tr } from './cue-edit.tr.ts';
import { vi } from './cue-edit.vi.ts';

/** Copy for caption writes (the English is the source of keys and types; the translations live in `cue-edit.zh-Hans.ts`): the name of a newly created caption track is taken from the UI language at the moment the track is created. */
const en = {
  subtitleTrack: 'Subtitles',
};
export type CueEditMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Writes from the caption panel (following the prototype `model-cueops.js` and the older `cue_edit.rs`): one action changes the body of the caption document and writes a new version.
 * The body is `cuccut.caption/1`: times are integer ticks, and other fields on a cue (speaker, segment start, the translation unit it belongs to, and so on) are carried over as they are;
 * once the text changes, the word-level timings (`words`) no longer match, so they are dropped.
 */

type Json = Record<string, unknown>;

export const CAPTION_SCHEMA = 'cuccut.caption/1';

/** Each side of a split is at least this many seconds long (sentences too short for that are split down the middle). */
const MIN_PIECE = 0.3;
const CJK = /[　-〿぀-ヿ㐀-鿿가-힯豈-﫿＀-￯]/;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const ticksOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** A cue in the list: sorted by start time, with times in seconds on the document clock. */
export interface ListCue {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface CueList {
  clock: 'source-asset' | 'sequence';
  cues: ListCue[];
}

/** Cues in the body; cues without an ID get one (based on their original index, consistent with `readCaptions`), and later writes find them by ID. */
function rawCues(body: Json): Json[] {
  const cues = Array.isArray(body.cues) ? body.cues : [];
  return cues.filter(isObject).map((cue, index) => (typeof cue.id === 'string' ? cue : { ...cue, id: `cue-${index}` }));
}

function timescaleOf(body: Json): number {
  return ticksOf(body.timescale) || 1_000_000;
}

export function isCaptionBody(body: unknown): body is Json {
  return isObject(body) && body.schema === CAPTION_SCHEMA && Array.isArray(body.cues);
}

/** The list view: sorted by start time (ties broken by end time). Returns null when it is not `cuccut.caption/1`. */
export function listCues(body: unknown): CueList | null {
  if (!isCaptionBody(body)) return null;
  const scale = timescaleOf(body);
  const cues = rawCues(body)
    .map((cue): ListCue => {
      const start = ticksOf(cue.start) / scale;
      return {
        id: cue.id as string,
        start,
        end: Math.max(start, ticksOf(cue.end) / scale),
        text: typeof cue.text === 'string' ? cue.text : '',
        ...(typeof cue.speaker === 'string' ? { speaker: cue.speaker } : {}),
      };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  return { clock: body.clock === 'sequence' ? 'sequence' : 'source-asset', cues };
}

function withCues(body: Json, cues: Json[]): Json {
  return { ...body, cues };
}

function retext(cue: Json, text: string): Json {
  if (cue.text === text) return cue;
  const { words: _words, ...rest } = cue;
  return { ...rest, text };
}

/** Changes the text of several cues (`id → new text`). Returns the new body and the number of cues actually changed. */
export function setCueTexts(body: Json, texts: ReadonlyMap<string, string>): { body: Json; changed: number } {
  let changed = 0;
  const cues = rawCues(body).map((cue) => {
    const text = texts.get(cue.id as string);
    if (text === undefined || text === cue.text) return cue;
    changed++;
    return retext(cue, text);
  });
  return { body: changed ? withCues(body, cues) : body, changed };
}

/** What goes between two joined text pieces: CJK text (or text that already has whitespace) is joined directly; otherwise a single space is added. */
export function joiner(a: string, b: string): string {
  if (!a || !b) return '';
  const last = a[a.length - 1]!;
  const first = b[0]!;
  return CJK.test(last) || CJK.test(first) || /\s/.test(last) || /\s/.test(first) ? '' : ' ';
}

/** Splits the text at `at`; it does not count as a split if either side would be empty (cursor at an end). */
export function cutText(text: string, at: number): { left: string; right: string } | null {
  const index = Math.max(0, Math.min(text.length, Math.trunc(at)));
  const left = text.slice(0, index).trim();
  const right = text.slice(index).trim();
  return left && right ? { left, right } : null;
}

/** Split point (tick): divided in proportion to the character counts on each side, each side at least 0.3 s, placed on a 0.01 s step; a sentence too short for that takes its midpoint. */
export function splitTicks(start: number, end: number, leftLength: number, rightLength: number, timescale: number): number {
  const duration = end - start;
  const min = MIN_PIECE * timescale;
  const raw =
    duration <= min * 2
      ? start + duration / 2
      : Math.min(end - min, Math.max(start + min, start + (duration * leftLength) / (leftLength + rightLength)));
  const step = timescale / 100;
  return Math.min(end, Math.max(start, Math.round(Math.round(raw / step) * step)));
}

function freshId(cues: readonly Json[], base: string): string {
  const taken = new Set(cues.map((cue) => cue.id));
  let n = 1;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Splits a cue into two at the cursor. `text` is the text in the edit box at this moment (uncommitted text counts). Returns null when the cursor is at an end. */
export function splitCue(body: Json, id: string, text: string, at: number): { body: Json; id: string } | null {
  const cues = rawCues(body);
  const index = cues.findIndex((cue) => cue.id === id);
  const cut = cutText(text, at);
  if (index < 0 || !cut) return null;
  const cue = cues[index]!;
  const start = ticksOf(cue.start);
  const end = Math.max(start, ticksOf(cue.end));
  const time = splitTicks(start, end, cut.left.length, cut.right.length, timescaleOf(body));
  const { words: _words, paragraphStart: _paragraph, ...rest } = cue;
  const nextId = freshId(cues, id);
  const left = { ...retext(cue, cut.left), end: time };
  const right = { ...rest, id: nextId, text: cut.right, start: time };
  return { body: withCues(body, [...cues.slice(0, index), left, right, ...cues.slice(index + 1)]), id: nextId };
}

export type MergeRefusal = 'edge' | 'speaker';

/**
 * Merges a cue into the adjacent one (`direction` −1 for above / +1 for below, in list order): only merged when they have the same speaker, and the times are joined.
 * Returns the ID of the merged cue and the position of the seam in the new text.
 */
export function mergeCue(
  body: Json,
  id: string,
  text: string | null,
  direction: -1 | 1,
): { body: Json; id: string; caret: number } | { refused: MergeRefusal } {
  const list = listCues(body)?.cues ?? [];
  const at = list.findIndex((cue) => cue.id === id);
  const neighbor = list[at + direction];
  if (at < 0 || !neighbor) return { refused: 'edge' };
  const me = list[at]!;
  if ((me.speaker ?? null) !== (neighbor.speaker ?? null)) return { refused: 'speaker' };
  const cues = rawCues(body);
  const mine = cues.find((cue) => cue.id === id)!;
  const theirs = cues.find((cue) => cue.id === neighbor.id)!;
  const [first, second]: [Json, Json] =
    direction < 0 ? [theirs, { ...mine, text: text ?? mine.text }] : [{ ...mine, text: text ?? mine.text }, theirs];
  const a = typeof first.text === 'string' ? first.text : '';
  const b = typeof second.text === 'string' ? second.text : '';
  const seam = joiner(a, b);
  const { words: _words, ...rest } = first;
  const merged: Json = {
    ...rest,
    text: a + seam + b,
    start: Math.min(ticksOf(first.start), ticksOf(second.start)),
    end: Math.max(ticksOf(first.end), ticksOf(second.end)),
  };
  const next = cues.flatMap((cue) => (cue.id === first.id ? [merged] : cue.id === second.id ? [] : [cue]));
  return { body: withCues(body, next), id: merged.id as string, caret: a.length + seam.length };
}

export type ReadingLevel = 'none' | 'ok' | 'warn' | 'bad';

/** Reading speed (characters per second, not counting whitespace): for CJK and Thai, over 9 counts as fast and 13 as too fast; for the rest, 17 and 21. */
export function readingSpeed(text: string, seconds: number, language: string | undefined): { value: number; level: ReadingLevel } {
  const count = Array.from(text).filter((char) => !/\s/u.test(char)).length;
  const raw = count / Math.max(0.1, seconds || 0);
  const [warn, bad] = /^(zh|ja|ko|th)(?:[-_]|$)/i.test(language ?? '') ? [9, 13] : [17, 21];
  return { value: Math.round(raw * 10) / 10, level: !count ? 'none' : raw > bad ? 'bad' : raw > warn ? 'warn' : 'ok' };
}

/** When the document does not state its language, guesses from the characters: kana → ja, hangul → ko, mostly Han characters → zh; returns undefined when it cannot guess. */
export function guessLanguage(text: string): string | undefined {
  const chars = Array.from(text).filter((char) => !/[\s\p{P}\p{N}]/u.test(char));
  if (!chars.length) return undefined;
  const count = (re: RegExp) => chars.filter((char) => re.test(char)).length;
  if (count(/[぀-ヿ]/) > chars.length * 0.1) return 'ja';
  if (count(/[가-힯]/) > chars.length * 0.3) return 'ko';
  if (count(/[㐀-鿿豈-﫿]/) > chars.length * 0.3) return 'zh';
  return undefined;
}

/** Caption file → body of a caption document: sequence clock, millisecond ticks. */
export function captionBodyOf(cues: readonly FileCue[]): Json {
  return {
    schema: CAPTION_SCHEMA,
    clock: 'sequence',
    timescale: 1000,
    cues: cues.map((cue) => ({
      id: `c${cue.index}`,
      start: Math.round(cue.start * 1000),
      end: Math.round(cue.end * 1000),
      text: cue.text,
    })),
  };
}

const IMPORTED = 'imported-caption';
const NEW_TRACK = 'new-subtitle-track';

/**
 * Transaction for importing a caption file: writes the document and places one caption instance (from 0 to the end of the last cue). It goes onto a caption track with free space that is not locked
 * (searching from the bottom up); if there is none, a new track is created.
 */
export function importCaptionOperations(
  sequence: Sequence,
  cues: readonly FileCue[],
  name: string,
  language: string | undefined,
): EditOperation[] {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const last = Math.max(0, ...cues.map((cue) => cue.end));
  const span = { fromFrame: 0, durationFrames: Math.max(1, Math.ceil(last * perSecond - 1e-6)) };
  const free = sequence.tracks
    .filter((track) => track.kind === 'subtitle' && !track.locked)
    .sort((a, b) => a.order - b.order)
    .find((track) => trackFree(sequence, track.id, span.fromFrame, span.fromFrame + span.durationFrames));
  const operations: EditOperation[] = [];
  if (!free) operations.push({ type: 'addTrack', sequenceId: sequence.id, kind: 'subtitle', ref: NEW_TRACK, name: M.subtitleTrack });
  operations.push({
    type: 'putDocument',
    ref: IMPORTED,
    kind: 'caption',
    name,
    ...(language ? { language } : {}),
    body: captionBodyOf(cues),
    summary: { cueCount: cues.length },
  });
  operations.push({
    type: 'insertItems',
    sequenceId: sequence.id,
    items: [{ type: 'caption', name, span, documentRef: IMPORTED, ...(free ? { trackId: free.id } : { trackRef: NEW_TRACK }) }],
  });
  return operations;
}
