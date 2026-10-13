import type { Localized } from '@cuccut/protocol';
import { JobsSubtitleFile } from '@cuccut/protocol/messages/jobs/subtitle-file.ts';
import { LocalizedError, type JobText } from '../job-text.ts';
import { joinWords } from './translation-document.ts';

/**
 * Strict reading and writing of subtitle files (SRT, WebVTT), for translating subtitle files (`translate-subtitles`, architecture design §7.9): timecodes are kept as they are,
 * only the text is replaced, and cues are neither merged nor split. Unlike the lenient parsing used for player overlay display (`subtitles.ts` in `packages/ui`: sorts, drops empty and bad cues),
 * a file that cannot be read exactly is always rejected here, with its line number reported; nothing is guessed.
 *
 * Accepted forms: UTF-8 (BOM allowed), UTF-16 (with BOM), GB18030 when the input is not valid UTF-8; CRLF and CR line endings; multi-line text; cues with empty text;
 * SRT index lines may be omitted; VTT header, cue identifiers, cue settings, and NOTE, STYLE, REGION blocks. Rejected: a block with text but no timing line,
 * a timing line appearing inside text (usually a missing blank line between two cues), milliseconds that are not three digits, minutes or seconds out of range, end before start, no cues at all, or exceeding the size and cue-count limits.
 *
 * Inline markup (SRT `<i>`, `<font>`, `{\an8}`; VTT `<c.x>`, `<v 说话人>`, timestamp tags and character entities) is stripped before the text is sent to the model,
 * and the output text does not carry it either; the caller records how many cues had markup removed.
 */

export type SubtitleFormat = 'srt' | 'vtt';

/** Upper limit on file size (bytes). */
export const MAX_SUBTITLE_BYTES = 4 * 1024 * 1024;
/** Upper limit on the number of cues. */
export const MAX_SUBTITLE_CUES = 10_000;
/** Upper limit on the number of characters in one cue's text. */
export const MAX_CUE_CHARS = 1000;

export interface SubtitleCue {
  /** The SRT index line or VTT cue identifier; null when absent. */
  id: string | null;
  /** The timing line as written (trimmed; for VTT, includes cue settings). */
  timing: string;
  startMs: number;
  endMs: number;
  /** The part after the end time (VTT cue settings, or the coordinates occasionally seen in SRT); empty string when absent. */
  settings: string;
  /** The text lines as written (may be none). */
  lines: string[];
  /** Line number of the timing line in the file (1-based). */
  line: number;
}

export interface SubtitleDocument {
  format: SubtitleFormat;
  /** The VTT header block (the `WEBVTT` line and the header lines after it); null for SRT. */
  header: string | null;
  cues: SubtitleCue[];
  /** VTT NOTE, STYLE and REGION blocks, unchanged; `before` is the index of the cue that follows the block (equal to the cue count when it comes after all cues). */
  blocks: Array<{ before: number; text: string }>;
}

/** A subtitle file that could not be read exactly. `code` is the error code from command and protocol spec §11.3; when `message` is catalog text, its reference is recorded in `messageRef`. */
export class SubtitleFileError extends LocalizedError {
  readonly code: 'SUBTITLE_FILE_INVALID' | 'SUBTITLE_FILE_TOO_LARGE';
  readonly details: Record<string, unknown>;

  constructor(code: SubtitleFileError['code'], message: JobText, details: Record<string, unknown>) {
    super(message);
    this.name = 'SubtitleFileError';
    this.code = code;
    this.details = details;
  }
}

/** Detects the format by file extension; null when it is not .srt or .vtt. */
export function subtitleFormatOf(file: string): SubtitleFormat | null {
  const ext = /\.([^./\\]+)$/.exec(file)?.[1]?.toLowerCase();
  return ext === 'srt' || ext === 'vtt' ? ext : null;
}

/** Bytes to text: a UTF-16 BOM is decoded as UTF-16; otherwise UTF-8 (BOM allowed), and GB18030 when the input is not valid UTF-8. */
export function decodeSubtitleBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}

/** Reads a subtitle file's bytes: checks the size, decodes, and parses strictly. */
export function readSubtitleBytes(bytes: Uint8Array, format: SubtitleFormat): SubtitleDocument {
  if (bytes.byteLength > MAX_SUBTITLE_BYTES) {
    throw new SubtitleFileError('SUBTITLE_FILE_TOO_LARGE', JobsSubtitleFile.tooLarge({ bytes: bytes.byteLength, limit: MAX_SUBTITLE_BYTES }), {
      bytes: bytes.byteLength,
      limit: MAX_SUBTITLE_BYTES,
    });
  }
  return parseSubtitles(decodeSubtitleBytes(bytes), format);
}

/**
 * The body of a subtitle file with timecodes and inline markup removed (used as text when a tool's Space entry is the input, architecture design §7.9): one line per cue, empty cues dropped.
 * When the file cannot be read exactly, it throws `SubtitleFileError`, as `readSubtitleBytes` does.
 */
export function subtitleText(bytes: Uint8Array, format: SubtitleFormat): string {
  const document = readSubtitleBytes(bytes, format);
  return document.cues
    .map((cue) => cueText(plainLines(cue, format).lines))
    .filter((text) => text !== '')
    .join('\n');
}

const SRT_TIME = String.raw`(\d{1,3}):(\d{2}):(\d{2})[,.](\d{3})`;
const VTT_TIME = String.raw`(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})`;
const SRT_TIMING = new RegExp(String.raw`^${SRT_TIME}[ \t]*-->[ \t]*${SRT_TIME}(?:[ \t]+(.*))?$`);
const VTT_TIMING = new RegExp(String.raw`^${VTT_TIME}[ \t]+-->[ \t]+${VTT_TIME}(?:[ \t]+(.*))?$`);

interface Block {
  lines: string[];
  /** Line number of the first line (1-based). */
  line: number;
}

/** Strict parsing: throws `SubtitleFileError` when the input cannot be read exactly. */
export function parseSubtitles(source: string, format: SubtitleFormat): SubtitleDocument {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (text.includes('\u0000')) throw invalidAt(1, JobsSubtitleFile.nul());
  const blocks = splitBlocks(text);
  const cues: SubtitleCue[] = [];
  const extras: SubtitleDocument['blocks'] = [];
  let header: string | null = null;
  let rest = blocks;
  if (format === 'vtt') {
    const first = blocks[0];
    if (!first || !/^WEBVTT(?:[ \t].*)?$/.test(first.lines[0]!) || first.line !== 1) {
      throw invalidAt(first?.line ?? 1, JobsSubtitleFile.vttHeader());
    }
    first.lines.forEach((l, i) => {
      if (l.includes('-->')) throw invalidAt(first.line + i, JobsSubtitleFile.vttHeaderBlank());
    });
    header = first.lines.join('\n');
    rest = blocks.slice(1);
  }
  for (const block of rest) {
    if (format === 'vtt' && /^(?:NOTE(?:[ \t].*)?|STYLE|REGION)$/.test(block.lines[0]!.trimEnd())) {
      extras.push({ before: cues.length, text: block.lines.join('\n') });
      continue;
    }
    cues.push(parseCue(block, format));
    if (cues.length > MAX_SUBTITLE_CUES) {
      throw new SubtitleFileError('SUBTITLE_FILE_TOO_LARGE', JobsSubtitleFile.tooManyCues({ limit: MAX_SUBTITLE_CUES }), { limit: MAX_SUBTITLE_CUES });
    }
  }
  if (cues.length === 0) throw invalidAt(1, JobsSubtitleFile.empty());
  return { format, header, cues, blocks: extras };
}

/** Splits into blocks at blank lines (lines containing only whitespace). */
function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  text.split('\n').forEach((line, i) => {
    if (line.trim() === '') {
      current = null;
      return;
    }
    if (!current) {
      current = { lines: [], line: i + 1 };
      blocks.push(current);
    }
    current.lines.push(line);
  });
  return blocks;
}

function parseCue(block: Block, format: SubtitleFormat): SubtitleCue {
  const pattern = format === 'srt' ? SRT_TIMING : VTT_TIMING;
  const timingAt = block.lines.findIndex((l) => l.includes('-->'));
  if (timingAt === -1) throw invalidAt(block.line, JobsSubtitleFile.noTiming());
  if (timingAt > 1) throw invalidAt(block.line, JobsSubtitleFile.tooManyIdLines());
  const id = timingAt === 1 ? block.lines[0]!.trim() : null;
  if (format === 'srt' && id !== null && !/^\d+$/.test(id)) throw invalidAt(block.line, JobsSubtitleFile.srtIndex({ id }));
  const lineNo = block.line + timingAt;
  const timing = block.lines[timingAt]!.trim();
  const match = pattern.exec(timing);
  if (!match) throw invalidAt(lineNo, JobsSubtitleFile.badTiming({ timing }));
  const startMs = toMs(match.slice(1, 5), lineNo);
  const endMs = toMs(match.slice(5, 9), lineNo);
  if (endMs < startMs) throw invalidAt(lineNo, JobsSubtitleFile.endBeforeStart());
  const lines = block.lines.slice(timingAt + 1);
  lines.forEach((l, i) => {
    if (l.includes('-->')) throw invalidAt(lineNo + 1 + i, JobsSubtitleFile.timingInText());
  });
  if (lines.join('\n').length > MAX_CUE_CHARS) throw invalidAt(lineNo, JobsSubtitleFile.cueTooLong({ max: MAX_CUE_CHARS }));
  return { id, timing, startMs, endMs, settings: (match[9] ?? '').trim(), lines, line: lineNo };
}

function toMs([h, m, s, ms]: Array<string | undefined>, line: number): number {
  const minutes = Number(m);
  const seconds = Number(s);
  if (minutes >= 60 || seconds >= 60) throw invalidAt(line, JobsSubtitleFile.minuteSecondRange());
  return ((Number(h ?? 0) * 60 + minutes) * 60 + seconds) * 1000 + Number(ms);
}

/** `details.problem` is text generated in the current language (`details` has no reference field); the reference for the whole sentence is in the error's `messageRef`. */
function invalidAt(line: number, problem: Localized): SubtitleFileError {
  return new SubtitleFileError('SUBTITLE_FILE_INVALID', JobsSubtitleFile.invalidAt({ line, problem }), { line, problem: problem.text });
}

const VTT_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', nbsp: ' ', lrm: '', rlm: '' };

/**
 * The lines of one cue with inline markup removed (trimmed, blank lines dropped). `marked`: the source text contains markup.
 * In VTT every `<…>` is markup (a literal `<` must be written as `&lt;`); in SRT only tags starting with a letter or `/`, and `{\…}`, are recognized.
 */
export function plainLines(cue: SubtitleCue, format: SubtitleFormat): { lines: string[]; marked: boolean } {
  const tags = format === 'vtt' ? VTT_TAG : SRT_TAG;
  let marked = false;
  const lines = cue.lines
    .map((line) => {
      if (OVERRIDE.test(line) || tags.test(line)) marked = true;
      let plain = line.replace(new RegExp(OVERRIDE.source, 'g'), '').replace(new RegExp(tags.source, 'g'), '');
      if (format === 'vtt') {
        plain = plain
          .replace(/&(amp|lt|gt|nbsp|lrm|rlm);/g, (_, name: string) => VTT_ENTITIES[name]!)
          .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
          .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
      }
      return plain.trim();
    })
    .filter((line) => line !== '');
  return { lines, marked };
}

const OVERRIDE = /\{\\[^}]*\}/;
const VTT_TAG = /<[^>]*>/;
const SRT_TAG = /<\/?[A-Za-z][^<>]*>/;

/** The text of one cue sent to the model: its lines with markup removed, joined into one sentence (a space is added between Latin-script words; none is added for Chinese). An empty string means the cue needs no translation. */
export function cueText(lines: string[]): string {
  return joinWords(lines);
}

/** Turns a translation into subtitle text lines: split at newlines, trimmed, blank lines dropped, and `-->` replaced with an arrow (it cannot appear in subtitle text). */
export function translationLines(text: string): string[] {
  return text
    .split(/\r\n?|\n/)
    .map((l) => l.replace(/-->/g, '→').trim())
    .filter((l) => l !== '');
}

export interface RenderedSubtitles {
  text: string;
  /** Counts of the cue settings and of NOTE, STYLE and REGION blocks dropped when converting VTT to SRT. */
  droppedSettings: number;
  droppedBlocks: number;
}

/**
 * Writes a subtitle file (UTF-8, LF, no BOM): each cue's timecode is unchanged, and its text is replaced with the lines of `texts[i]`.
 * In the same format, the index or identifier and the timing line (including cue settings) are copied as they are; the VTT header and the NOTE, STYLE and REGION blocks stay in place;
 * when the format changes, timecodes are rewritten from milliseconds (SRT uses `,`, VTT uses `.` with the hours padded to two digits). VTT to SRT: identifiers are used as index numbers when they are all positive integers, otherwise cues are numbered in order;
 * cue settings and blocks such as NOTE, which SRT cannot hold, are dropped and counted.
 */
export function renderSubtitles(source: SubtitleDocument, texts: string[][], format: SubtitleFormat): RenderedSubtitles {
  const same = format === source.format;
  const out: string[] = [];
  let droppedSettings = 0;
  let droppedBlocks = 0;
  const numericIds = source.cues.every((c) => c.id !== null && /^[1-9]\d*$/.test(c.id));
  const escape = (l: string) => (format === 'vtt' ? l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : l);
  if (format === 'vtt') out.push(same ? source.header! : 'WEBVTT');
  const pushBlocks = (before: number) => {
    for (const block of source.blocks) {
      if (block.before !== before) continue;
      if (format === 'vtt') out.push(block.text);
      else droppedBlocks++;
    }
  };
  source.cues.forEach((cue, i) => {
    pushBlocks(i);
    const lines: string[] = [];
    if (format === 'srt') lines.push(same ? (cue.id ?? String(i + 1)) : numericIds ? cue.id! : String(i + 1));
    else if (cue.id !== null) lines.push(cue.id);
    if (same) {
      lines.push(cue.timing);
    } else {
      if (format === 'srt' && cue.settings !== '') droppedSettings++;
      lines.push(`${clock(cue.startMs, format)} --> ${clock(cue.endMs, format)}`);
    }
    lines.push(...texts[i]!.map(escape));
    out.push(lines.join('\n'));
  });
  pushBlocks(source.cues.length);
  return { text: `${out.join('\n\n')}\n`, droppedSettings, droppedBlocks };
}

/** `hh:mm:ss,ttt` (SRT) or `hh:mm:ss.ttt` (VTT). */
export function clock(ms: number, format: SubtitleFormat): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}${format === 'srt' ? ',' : '.'}${pad(ms % 1000, 3)}`;
}
