/**
 * Parsing of subtitle files (product design §11.1, item 0.3: the player overlays subtitle files). Read-only:
 * SRT, WebVTT, and ASS / SSA are parsed into the same sentence list, with times in seconds. Styling and position are not kept,
 * only the text and line breaks; blocks that cannot be understood are skipped rather than failing the whole file.
 */

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export interface Cue {
  /** Sorted index, starting from 1. */
  index: number;
  start: number;
  end: number;
  text: string;
}

export function subtitleFormatOf(fileName: string): SubtitleFormat | null {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'srt') return 'srt';
  if (ext === 'vtt') return 'vtt';
  if (ext === 'ass' || ext === 'ssa') return 'ass';
  return null;
}

/**
 * Converts subtitle file bytes to text. UTF-8 is tried first; if it is not valid UTF-8, GB18030 is used (compatible with GBK, common for Chinese subtitles);
 * a UTF-16 BOM means UTF-16.
 */
export function decodeSubtitleText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}

export function parseSubtitles(source: string, format: SubtitleFormat): Cue[] {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const raw = format === 'ass' ? parseAss(text) : parseBlocks(text, format);
  return raw
    .filter((cue) => cue.text && cue.end > cue.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((cue, i) => ({ ...cue, index: i + 1 }));
}

type RawCue = Omit<Cue, 'index'>;

/** Accepts `01:02:03,456`, `02:03.4` and `1:02:03.45`; missing millisecond digits are padded as decimals. */
const TIME = /(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?/;
const TIMING = new RegExp(`^\\s*${TIME.source}\\s*-->\\s*${TIME.source}`);

function seconds(h: string | undefined, m: string, s: string, frac: string | undefined): number {
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + (frac ? Number(`0.${frac}`) : 0);
}

function parseBlocks(text: string, format: 'srt' | 'vtt'): RawCue[] {
  const cues: RawCue[] = [];
  for (const block of text.split(/\n[ \t]*\n/)) {
    const lines = block.replace(/^\s*\n/, '').split('\n');
    const at = lines.findIndex((line) => TIMING.test(line));
    // VTT header, NOTE, STYLE and REGION blocks have no timing line, so they are skipped naturally.
    if (at < 0 || at > 1) continue;
    const m = TIMING.exec(lines[at]!)!;
    cues.push({
      start: seconds(m[1], m[2]!, m[3]!, m[4]),
      end: seconds(m[5], m[6]!, m[7]!, m[8]),
      text: cleanMarkup(lines.slice(at + 1).join('\n'), format),
    });
  }
  return cues;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', nbsp: ' ', quot: '"', apos: "'", lrm: '‎', rlm: '‏' };

function cleanMarkup(text: string, format: 'srt' | 'vtt'): string {
  let out = text
    .replace(/<[^>\n]*>/g, '')
    // Some SRT files carry ASS positioning tags, such as `{\an8}`.
    .replace(/\{\\[^}]*\}/g, '');
  if (format === 'vtt') out = out.replace(/&(amp|lt|gt|nbsp|quot|apos|lrm|rlm);/g, (_, name: string) => ENTITIES[name]!);
  return out
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/** ASS default columns (when there is no Format line): the first column is Layer (ASS) or Marked (SSA), and the last column is the text. */
const ASS_DEFAULT_FORMAT = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
const ASS_TIME = /^(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/;

function parseAss(text: string): RawCue[] {
  const cues: RawCue[] = [];
  let inEvents = false;
  let format = ASS_DEFAULT_FORMAT;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inEvents = trimmed.toLowerCase() === '[events]';
      continue;
    }
    if (!inEvents) continue;
    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;
    const kind = trimmed.slice(0, colon).toLowerCase();
    const body = trimmed.slice(colon + 1).trim();
    if (kind === 'format') {
      format = body.split(',').map((f) => f.trim().toLowerCase());
      continue;
    }
    if (kind !== 'dialogue') continue;
    // The text is the last column and may contain commas, so only the preceding columns are split off.
    const fields: string[] = [];
    let rest = body;
    for (let i = 0; i < format.length - 1; i++) {
      const comma = rest.indexOf(',');
      if (comma < 0) break;
      fields.push(rest.slice(0, comma).trim());
      rest = rest.slice(comma + 1);
    }
    fields.push(rest);
    if (fields.length !== format.length) continue;
    const start = ASS_TIME.exec(fields[format.indexOf('start')] ?? '');
    const end = ASS_TIME.exec(fields[format.indexOf('end')] ?? '');
    if (!start || !end) continue;
    cues.push({
      start: seconds(start[1], start[2]!, start[3]!, start[4]),
      end: seconds(end[1], end[2]!, end[3]!, end[4]),
      text: cleanAss(fields[format.indexOf('text')] ?? ''),
    });
  }
  return cues;
}

function cleanAss(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Sentences being displayed at `time` (several may overlap), ordered by start time.
 * Sentences are already sorted by start time, so only the segment whose start is not later than `time` is examined.
 */
export function activeCues(cues: readonly Cue[], time: number): Cue[] {
  const active: Cue[] = [];
  for (const cue of cues) {
    if (cue.start > time) break;
    if (time < cue.end) active.push(cue);
  }
  return active;
}

/** Which sentence (index) the list should stop on: the sentence being displayed; between two sentences, the next one; past the last sentence, the last one. null when there are no sentences. */
export function nearIndex(cues: readonly Cue[], time: number): number | null {
  if (!cues.length) return null;
  let next = 0;
  while (next < cues.length && cues[next]!.start <= time) next++;
  const current = cues[next - 1];
  if (current && time < current.end) return current.index;
  return cues[Math.min(next, cues.length - 1)]!.index;
}

/** Where to seek when a sentence is clicked in the subtitle list: a little after the start of the sentence, avoiding the moment that coincides with the end of the previous sentence. */
export function seekTimeOf(cue: Cue): number {
  return Math.min(cue.start + 0.001, cue.end);
}
