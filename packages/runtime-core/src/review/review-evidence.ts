import path from 'node:path';
import { REVIEW_FRAMES_DIR, REVIEW_PLAN_KIND, type ReviewEvidence, type ReviewQuestion, type RubricAnswer, type VideoSnapshot } from '@cuccut/protocol';
import { RcReview } from '@cuccut/protocol/messages/runtime-core';

/**
 * Evidence of the declared kind (docs/cuccut/m2-review-gate.md §4.4). An answer of "holds" has to point at something
 * that can be found in this video; prose is not evidence. Pure: the caller gathers what the checks need (the
 * duration, the ids, the transcript and caption text, which frame files exist) beforehand.
 *
 * | Kind | Valid when |
 * |---|---|
 * | `timestamp` | `ss(.f)s`, `mm:ss` or `hh:mm:ss` (or a range of two), within `[0, duration]` |
 * | `frame` | a path under `.cuccut-out/frames/` of the video's source root that exists |
 * | `field` | names an item, track, document, marker or sequence id of the snapshot (not the video's own id) |
 * | `quote` | at least three words (eight characters in scripts written without spaces), found with case and whitespace folded in a speech or caption document |
 */

export interface EvidenceContext {
  durationSec: number;
  ids: ReadonlySet<string>;
  /** Text of the video's speech and caption documents. */
  texts: readonly string[];
  /** Frame files that exist, as `.cuccut-out/frames/…` paths relative to the source root (`/`-separated). */
  frames: ReadonlySet<string>;
}

/** Tolerance for a timestamp at the very end of the video. */
const END_SLACK_SEC = 0.5;
/** A quote of fewer words than this points at nothing in particular ("the", "là" are in every transcript). */
const MIN_QUOTE_WORDS = 3;
/** The same for scripts written without spaces between words, counted in characters. */
const MIN_QUOTE_CHARS = 8;
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;

/** `4.2s`, `4s`, `01:05`, `1:02:03.5` → seconds; null when it is none of these. */
export function parseTimestamp(text: string): number | null {
  const value = text.trim();
  const seconds = /^(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?$/i.exec(value);
  if (seconds) return Number(seconds[1]);
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(value);
  if (!clock) return null;
  const [, h, m, s] = clock;
  if (Number(s) >= 60 || (h !== undefined && Number(m) >= 60)) return null;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);
}

/** One timestamp, or two joined by a dash or "to", all inside the video. */
function timestampOk(evidence: string, durationSec: number): boolean {
  const parts = evidence.split(/\s*(?:–|—|\bto\b|\s-\s|-(?=\d))\s*/i).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return false;
  const times = parts.map(parseTimestamp);
  if (times.some((t) => t === null)) return false;
  const [a, b] = times as number[];
  if (b !== undefined && b < a!) return false;
  return times.every((t) => t! >= 0 && t! <= durationSec + END_SLACK_SEC);
}

/**
 * The `.cuccut-out/frames/…` path (relative to `sourceRoot`, `/`-separated) a frame answer points at, or null when it
 * points outside that folder. Absolute paths are accepted when they are inside it.
 */
export function framePathOf(evidence: string, sourceRoot: string): string | null {
  const raw = evidence.trim().replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '');
  if (!raw || raw.includes('\0')) return null;
  const absolute = path.resolve(sourceRoot, raw);
  const relative = path.relative(sourceRoot, absolute).split(path.sep).join('/');
  const prefix = `${REVIEW_FRAMES_DIR}/`;
  if (!relative.startsWith(prefix) || relative.split('/').includes('..') || relative.length === prefix.length) return null;
  return relative;
}

/** Case and whitespace folded away, with typographic quotes around the whole removed. */
export function foldText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^["'“”‘’「」『』«»]+|["'“”‘’「」『』«»]+$/g, '');
}

/** Whether a quote is long enough to point at one place: three words, or eight characters of a script without spaces. */
function quoteLongEnough(evidence: string): boolean {
  const words = evidence.normalize('NFKC').split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length >= MIN_QUOTE_WORDS) return true;
  return [...evidence.normalize('NFKC')].filter((ch) => UNSPACED.test(ch)).length >= MIN_QUOTE_CHARS;
}

function fieldOk(evidence: string, ids: ReadonlySet<string>): boolean {
  if (ids.has(evidence)) return true;
  return evidence.split(/[^A-Za-z0-9_-]+/).some((token) => token && ids.has(token));
}

/** Checks one `holds` answer's evidence against the question's kind: true, or the note to record. */
export function checkEvidence(kind: ReviewEvidence, evidence: string, context: EvidenceContext & { sourceRoot: string }): true | string {
  const invalid = () => RcReview.evidenceInvalid({ kind }).text;
  switch (kind) {
    case 'timestamp':
      return timestampOk(evidence, context.durationSec) || invalid();
    case 'frame': {
      const frame = framePathOf(evidence, context.sourceRoot);
      return (frame !== null && context.frames.has(frame)) || invalid();
    }
    case 'field':
      return fieldOk(evidence.trim(), context.ids) || invalid();
    case 'quote': {
      const needle = foldText(evidence);
      return (quoteLongEnough(evidence) && needle.length > 0 && context.texts.some((text) => foldText(text).includes(needle))) || invalid();
    }
    default:
      return invalid();
  }
}

/** The frame paths `holds` answers point at, so the caller can see which exist before checking them. */
export function frameCandidates(questions: readonly ReviewQuestion[], answers: readonly RubricAnswer[], sourceRoot: string): string[] {
  const kinds = new Map(questions.map((q) => [q.id, q.evidence]));
  const out = new Set<string>();
  for (const answer of answers) {
    if (answer.verdict !== 'holds' || kinds.get(answer.id) !== 'frame') continue;
    const frame = framePathOf(answer.evidence, sourceRoot);
    if (frame) out.add(frame);
  }
  return [...out];
}

/**
 * Every id a `field` answer may name: what is in the video. The video's own id is left out (the agent always has it, so
 * it points at nothing), and so is the review's decisions document.
 */
export function snapshotIds(snapshot: VideoSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const document of Object.values(snapshot.documents)) if (document.kind !== REVIEW_PLAN_KIND) ids.add(document.id);
  for (const sequence of Object.values(snapshot.sequences)) {
    ids.add(sequence.id);
    for (const track of sequence.tracks) ids.add(track.id);
    for (const item of sequence.items) ids.add(item.id);
    for (const marker of sequence.markers) ids.add(marker.id);
  }
  return ids;
}

/** The text of a speech (`cuccut.speech/1`) or caption (`cuccut.caption/1`) body; empty for anything else. */
export function documentText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as { schema?: unknown; words?: unknown; cues?: unknown };
  const pieces = (list: unknown) =>
    Array.isArray(list)
      ? list.flatMap((entry) => (entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string' ? [(entry as { text: string }).text] : []))
      : [];
  if (record.schema === 'cuccut.speech/1') return pieces(record.words).join(' ');
  if (record.schema === 'cuccut.caption/1') return pieces(record.cues).join('\n');
  return '';
}
