import {
  ASR_RESULT_SCHEMA,
  canonicalLanguageTag,
  estimateWords,
  fixWordTimes,
  isHanIdeograph,
  secondsToTicks,
  type AsrCost,
  type AsrResult,
  type AsrWarning,
  type LanguageOption,
  type Segment,
  type Word,
} from '@cuccut/models';
import type { ChunkTranscript } from './adapter.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

/**
 * Joins each chunk's transcript into `cuccut.asr-result/v1` (architecture design §6.4, §6.6). Times are converted back to integer ticks on the source clock. Word times from the provider are marked `provider`; segments without word times are interpolated by character length and marked `estimated` (the same rule as the Model Worker, see `word-timing.ts`).
 *
 * - With segments: each word goes to the segment containing its midpoint (words outside every segment go to the nearest one);
 * - Words only: split by pauses (> 0.8 seconds), sentence-ending punctuation, and segment length (> 30 seconds);
 * - Text only: the whole chunk becomes one segment;
 * - A segment that overlaps the previous one starts at the end of the previous one. Segments with no length after conversion are dropped and recorded as `segment-degenerate`;
 * - Segments whose word timing was corrected are recorded as `timing-adjusted`.
 */

export interface ChunkResult {
  /** Start and end of this chunk in the decoded audio (seconds, relative to the decode start). */
  startSec: number;
  endSec: number;
  transcript: ChunkTranscript;
}

export interface ResultContext {
  providerId: string;
  modelId: string;
  workerVersion: string;
  contentHash: string;
  runGeneration: number;
  timescale: number;
  language: LanguageOption;
  /** Position of the decode start on the source clock (seconds). When a range was requested, this is the start of that range. */
  offsetSec: number;
}

interface RawWord {
  start: number;
  end: number;
  text: string;
  confidence: number | null;
}

interface RawSegment {
  start: number;
  end: number;
  text: string;
  words: RawWord[];
}

const SEGMENT_GAP_SEC = 0.8;
const SEGMENT_MAX_SEC = 30;
const SENTENCE_END = /[。！？!?…]$|[^.]\.$/u;

export function buildAsrResult(input: {
  chunks: readonly ChunkResult[];
  context: ResultContext;
  /** Actual length of the decoded audio (seconds). */
  decodedSec: number;
  warnings?: AsrWarning[];
}): AsrResult {
  const { context } = input;
  const ticks = (seconds: number) => secondsToTicks(context.offsetSec + seconds, context.timescale);
  const duration = ticks(input.decodedSec);
  const warnings: AsrWarning[] = [...(input.warnings ?? [])];
  const raw = input.chunks.flatMap(chunkSegments).sort((a, b) => a.start - b.start || a.end - b.end);
  const languageHint = context.language.tag ?? firstDetected(input.chunks);

  const segments: Segment[] = [];
  let previousEnd = 0;
  for (const s of raw) {
    const start = Math.max(ticks(s.start), previousEnd);
    const end = Math.min(ticks(s.end), duration);
    if (end <= start) {
      warnings.push({ code: 'segment-degenerate', detail: PH.segmentDropped({ text: s.text.slice(0, 40) }).text });
      continue;
    }
    const id = `seg-${String(segments.length + 1).padStart(4, '0')}`;
    const words: Word[] =
      s.words.length > 0
        ? s.words.map((w) => ({
            start: ticks(w.start),
            end: ticks(w.end),
            text: w.text,
            confidence: w.confidence,
            timingQuality: 'provider' as const,
          }))
        : estimateWords(s.text, languageHint, start, end).map((w) => ({
            start: Math.round(w.start),
            end: Math.round(w.end),
            text: w.text,
            confidence: null,
            timingQuality: 'estimated' as const,
          }));
    const segment: Segment = { id, start, end, text: s.text, speakerId: null, words };
    if (fixWordTimes(segment)) warnings.push({ code: 'timing-adjusted', segmentId: id });
    segments.push(segment);
    previousEnd = end;
  }

  return {
    schema: ASR_RESULT_SCHEMA,
    outcome: segments.length > 0 ? 'transcribed' : 'no-speech',
    timescale: context.timescale,
    clock: 'source-asset',
    duration,
    language: languageOf(context.language, input.chunks),
    segments,
    speakers: [],
    coverage: [{ start: Math.min(ticks(0), duration), end: duration }],
    warnings,
    provenance: provenanceOf(context, costOf(input.chunks)),
  };
}

/** Result when the source has no selected audio track. */
export function noAudioResult(context: ResultContext): AsrResult {
  return {
    schema: ASR_RESULT_SCHEMA,
    outcome: 'no-audio-track',
    timescale: context.timescale,
    clock: 'source-asset',
    duration: 0,
    language: languageOf(context.language, []),
    segments: [],
    speakers: [],
    coverage: [],
    warnings: [],
    provenance: provenanceOf(context, { status: 'unknown' }),
  };
}

/** A chunk's segments, with times converted to seconds relative to the decode start and clamped to this chunk. */
export function chunkSegments(chunk: ChunkResult): RawSegment[] {
  const t = chunk.transcript;
  const length = Math.max(0, chunk.endSec - chunk.startSec);
  const at = (seconds: number) => chunk.startSec + Math.min(Math.max(seconds, 0), length);
  const words: RawWord[] = (t.words ?? [])
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && typeof w.text === 'string' && w.text.trim() !== '')
    .map((w) => ({
      start: at(Math.min(w.start, w.end)),
      end: at(Math.max(w.start, w.end)),
      text: w.text.trim(),
      confidence: typeof w.confidence === 'number' && w.confidence >= 0 && w.confidence <= 1 ? w.confidence : null,
    }))
    .sort((a, b) => a.start - b.start);

  const declared = (t.segments ?? [])
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && typeof s.text === 'string' && s.text.trim() !== '')
    .map((s) => ({ start: at(Math.min(s.start, s.end)), end: at(Math.max(s.start, s.end)), text: s.text.trim(), words: [] as RawWord[] }))
    .sort((a, b) => a.start - b.start);
  if (declared.length > 0) {
    for (const word of words) nearestSegment(declared, (word.start + word.end) / 2).words.push(word);
    return declared;
  }
  if (words.length > 0) return groupWords(words);
  const text = t.text.trim();
  return text ? [{ start: chunk.startSec, end: chunk.startSec + length, text, words: [] }] : [];
}

function nearestSegment(segments: RawSegment[], point: number): RawSegment {
  let best = segments[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const segment of segments) {
    const distance = point < segment.start ? segment.start - point : point > segment.end ? point - segment.end : 0;
    if (distance < bestDistance) {
      best = segment;
      bestDistance = distance;
    }
  }
  return best;
}

/** Words only: split by pauses, sentence-ending punctuation, and segment length. */
export function groupWords(words: readonly RawWord[]): RawSegment[] {
  const segments: RawSegment[] = [];
  let current: RawWord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    segments.push({
      start: current[0]!.start,
      end: Math.max(...current.map((w) => w.end)),
      text: joinWords(current.map((w) => w.text)),
      words: current,
    });
    current = [];
  };
  for (const word of words) {
    const last = current.at(-1);
    if (
      last &&
      (word.start - last.end > SEGMENT_GAP_SEC || SENTENCE_END.test(last.text) || word.end - current[0]!.start > SEGMENT_MAX_SEC)
    ) {
      flush();
    }
    current.push(word);
  }
  flush();
  return segments;
}

/** Joins words back into text: no space between CJK characters or before punctuation; otherwise words are separated by spaces. */
export function joinWords(words: readonly string[]): string {
  let out = '';
  for (const word of words) {
    if (out && needsSpace(out.at(-1)!, word[0]!)) out += ' ';
    out += word;
  }
  return out;
}

function needsSpace(before: string, after: string): boolean {
  if (isCjk(before) || isCjk(after)) return false;
  return !/[,.!?;:%)\]}'’”]/u.test(after);
}

function isCjk(char: string): boolean {
  return isHanIdeograph(char) || /[　-ヿ＀-￯]/u.test(char);
}

function firstDetected(chunks: readonly ChunkResult[]): string | null {
  for (const chunk of chunks) {
    const tag = chunk.transcript.language ? canonicalLanguageTag(chunk.transcript.language) : null;
    if (tag) return tag;
  }
  return null;
}

function languageOf(option: LanguageOption, chunks: readonly ChunkResult[]): AsrResult['language'] {
  if (option.mode === 'assert') return { tag: option.tag, source: 'asserted', confidence: null };
  const detected = firstDetected(chunks);
  if (detected) return { tag: detected, source: 'detected', confidence: null };
  return { tag: option.tag ? canonicalLanguageTag(option.tag) : null, source: 'unknown', confidence: null };
}

/** Usage is `reported` only when every chunk reported it (the single value for one chunk, an array for several). Otherwise it is `unknown`; partial usage is not used as a stand-in. */
function costOf(chunks: readonly ChunkResult[]): AsrCost {
  const usage = chunks.map((c) => c.transcript.usage).filter((u) => u !== undefined && u !== null);
  if (chunks.length === 0 || usage.length !== chunks.length) return { status: 'unknown' };
  return { status: 'reported', usage: usage.length === 1 ? usage[0] : usage };
}

function provenanceOf(context: ResultContext, cost: AsrCost): AsrResult['provenance'] {
  return {
    provider: context.providerId,
    bundleId: null,
    models: { asr: { family: context.providerId, revision: context.modelId } },
    backend: 'online',
    device: 'remote',
    workerVersion: context.workerVersion,
    inputHash: context.contentHash,
    runGeneration: context.runGeneration,
    cost,
  };
}
