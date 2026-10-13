import { ModelsAsrResult as M } from '@cuccut/protocol/messages/models/asr-result.ts';
import type { Localized } from '@cuccut/protocol';
import { ASR_RESULT_SCHEMA, ASR_WARNING_CODES, TIMING_QUALITIES, type AsrResult } from './worker-contract.ts';

/**
 * Validation of `cuccut.asr-result/v1` (Model Worker protocol spec §6). The Runtime runs it before publishing the artifact. A failure is `MODEL_OUTPUT_INVALID`, and the same input is not retried.
 *
 * Two checks are not performed. The first: `aligned` words require the ASR itself to have word-level timing capability. The Runtime cannot tell this, so it only accepts them when there is no aligner. The second: `provenance.inputHash`. `job.run` does not carry an input hash, so the Worker cannot fill it in (see the final report).
 */

export interface AsrExpectations {
  /** The language asserted in the request: when `language.source === 'asserted'`, the result must equal it. */
  assertedLanguage?: string;
  /** The `runGeneration` of this attempt. The result's `provenance.runGeneration` must be echoed back unchanged. */
  runGeneration?: number;
}

export type AsrValidation = { ok: true; result: AsrResult } | { ok: false; problems: string[] };

const MAX_PROBLEMS = 20;

/** Returns the canonical form of a valid BCP 47 tag, otherwise null. */
export function canonicalLanguageTag(tag: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    return canonical ?? null;
  } catch {
    return null;
  }
}

export function validateAsrResult(value: unknown, expect: AsrExpectations = {}): AsrValidation {
  const problems: string[] = [];
  // `problems` is human-readable text (callers only receive strings). Text is stored in the language it was generated in, without citations.
  const fail = (message: Localized) => {
    if (problems.length < MAX_PROBLEMS) problems.push(message.text);
  };
  if (!isObject(value)) return { ok: false, problems: [M.notObject().text] };
  const r = value;

  if (r.schema !== ASR_RESULT_SCHEMA) fail(M.schemaShouldBe({ schema: ASR_RESULT_SCHEMA }));
  const outcome = r.outcome;
  if (outcome !== 'transcribed' && outcome !== 'no-audio-track' && outcome !== 'no-speech') fail(M.outcomeOutOfRange());
  if (!isPositiveInt(r.timescale)) fail(M.timescaleInvalid());
  if (r.clock !== 'source-asset') fail(M.clockInvalid());
  const duration = r.duration;
  if (!isNonNegativeInt(duration)) fail(M.durationInvalid());
  const limit = isNonNegativeInt(duration) ? duration : Number.MAX_SAFE_INTEGER;

  // Language
  if (!isObject(r.language)) fail(M.languageNotObject());
  else {
    const { tag, source, confidence } = r.language;
    if (tag !== null && (typeof tag !== 'string' || canonicalLanguageTag(tag) === null)) fail(M.languageTagInvalid());
    if (source !== 'asserted' && source !== 'detected' && source !== 'unknown') fail(M.languageSourceOutOfRange());
    if (confidence !== null && !isUnit(confidence)) fail(M.languageConfidenceInvalid());
    if (source === 'asserted') {
      const wanted = expect.assertedLanguage === undefined ? undefined : canonicalLanguageTag(expect.assertedLanguage);
      const got = typeof tag === 'string' ? canonicalLanguageTag(tag) : null;
      if (wanted === undefined) fail(M.assertedWithoutRequest());
      else if (got !== wanted) fail(M.languageMismatch());
    }
  }

  // Speakers
  const speakerIds = new Set<string>();
  if (!Array.isArray(r.speakers)) fail(M.speakersNotArray());
  else
    for (const speaker of r.speakers) {
      if (!isObject(speaker) || typeof speaker.id !== 'string' || speaker.id === '') fail(M.speakerIdInvalid());
      else if (speakerIds.has(speaker.id)) fail(M.speakerDuplicate({ id: speaker.id }));
      else {
        speakerIds.add(speaker.id);
        if (speaker.label !== null && typeof speaker.label !== 'string') fail(M.speakerLabelInvalid({ id: speaker.id }));
      }
    }

  // Segments and words
  if (!Array.isArray(r.segments)) fail(M.segmentsNotArray());
  else {
    if (outcome !== 'transcribed' && r.segments.length > 0) fail(M.segmentsNotEmpty({ outcome: String(outcome) }));
    const segmentIds = new Set<string>();
    let previousEnd = 0;
    r.segments.forEach((segment: unknown, i: number) => {
      const at = `segments[${i}]`;
      if (!isObject(segment)) return fail(M.notObjectAt({ at }));
      if (typeof segment.id !== 'string' || segment.id === '') fail(M.idInvalid({ at }));
      else if (segmentIds.has(segment.id)) fail(M.idDuplicate({ at }));
      else segmentIds.add(segment.id);
      const { start, end } = segment;
      if (!isNonNegativeInt(start) || !isNonNegativeInt(end)) return fail(M.timeInvalid({ at }));
      if (!(start < end)) fail(M.startNotBeforeEnd({ at }));
      if (end > limit) fail(M.beyondDuration({ at }));
      if (start < previousEnd) fail(M.overlaps({ at }));
      previousEnd = Math.max(previousEnd, end);
      if (typeof segment.text !== 'string' || segment.text.trim() === '') fail(M.textEmpty({ at }));
      if (segment.speakerId !== null && (typeof segment.speakerId !== 'string' || !speakerIds.has(segment.speakerId))) {
        fail(M.speakerUnknown({ at }));
      }
      if (!Array.isArray(segment.words)) return fail(M.wordsNotArray({ at }));
      let wordEnd = start;
      segment.words.forEach((word: unknown, j: number) => {
        const wat = `${at}.words[${j}]`;
        if (!isObject(word)) return fail(M.notObjectAt({ at: wat }));
        if (!isNonNegativeInt(word.start) || !isNonNegativeInt(word.end)) return fail(M.timeInvalid({ at: wat }));
        if (word.start > word.end) fail(M.wordStartAfterEnd({ at: wat }));
        if (word.start < start || word.end > end) fail(M.wordOutsideSegment({ at: wat }));
        if (word.start < wordEnd) fail(M.wordNotMonotonic({ at: wat }));
        wordEnd = Math.max(wordEnd, word.end);
        if (typeof word.text !== 'string' || word.text.trim() === '') fail(M.textEmpty({ at: wat }));
        if (word.confidence !== null && !isUnit(word.confidence)) fail(M.confidenceInvalid({ at: wat }));
        if (word.speakerId !== undefined && (typeof word.speakerId !== 'string' || !speakerIds.has(word.speakerId))) {
          fail(M.speakerUnknown({ at: wat }));
        }
        if (!TIMING_QUALITIES.includes(word.timingQuality as never)) fail(M.timingQualityOutOfRange({ at: wat }));
        if (word.timingQuality === 'missing' && (word.start !== word.end || word.start !== start)) {
          fail(M.missingTimingStart({ at: wat }));
        }
      });
    });
  }

  // Coverage
  if (!Array.isArray(r.coverage)) fail(M.coverageNotArray());
  else
    r.coverage.forEach((range: unknown, i: number) => {
      if (!isObject(range) || !isNonNegativeInt(range.start) || !isNonNegativeInt(range.end)) return fail(M.coverageInvalid({ at: `coverage[${i}]` }));
      if (range.start > range.end || range.end > limit) fail(M.coverageOutOfRange({ at: `coverage[${i}]` }));
    });

  // Warnings
  if (!Array.isArray(r.warnings)) fail(M.warningsNotArray());
  else
    r.warnings.forEach((warning: unknown, i: number) => {
      if (!isObject(warning) || !ASR_WARNING_CODES.includes(warning.code as never)) fail(M.warningCodeOutOfRange({ at: `warnings[${i}]` }));
      else if (warning.segmentId !== undefined && typeof warning.segmentId !== 'string') fail(M.warningSegmentIdInvalid({ at: `warnings[${i}]` }));
    });

  // Source
  if (!isObject(r.provenance)) fail(M.provenanceNotObject());
  else {
    const p = r.provenance;
    for (const key of ['provider', 'backend', 'device', 'workerVersion'] as const) {
      if (typeof p[key] !== 'string' || p[key] === '') fail(M.provenanceFieldEmpty({ key }));
    }
    if (p.bundleId !== null && typeof p.bundleId !== 'string') fail(M.bundleIdInvalid());
    if (!isObject(p.models)) fail(M.modelsNotObject());
    if (!Number.isInteger(p.runGeneration)) fail(M.runGenerationInvalid());
    else if (expect.runGeneration !== undefined && p.runGeneration !== expect.runGeneration)
      fail(M.runGenerationMismatch());
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, result: value as unknown as AsrResult };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isUnit(value: unknown): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
