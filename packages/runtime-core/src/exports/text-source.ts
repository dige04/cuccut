import type { TextEntry, TextPlan } from './export-plan.ts';
import type { TextChapter } from './text-export.ts';

/**
 * Script without cut removal (`skipCut: false`, command and protocol spec §4.4): does not go through timeline projection, and takes entries directly from the document body (transcript words, caption sentences), with times on the document's own clock (seconds). The method is the same as `speech_entries` / `caption_entries` in the engine's `text_plan.rs`. Hidden words and blank entries are excluded (hiding removes text from the script, not a cut on the timeline). Zero-duration words take up the gap that follows them, and words with untrustworthy timing are marked.
 */

interface SpeechWord {
  id?: string;
  text?: string;
  start?: number;
  end?: number;
  hidden?: boolean;
  speaker?: string;
  timingQuality?: string;
}

interface SpeechSentence {
  id?: string;
  first?: string;
  last?: string;
  wordIds?: string[];
  paragraphStart?: boolean;
}

interface CaptionCue {
  id?: string;
  text?: string;
  start?: number;
  end?: number;
  speaker?: string;
  paragraphStart?: boolean;
}

interface SourceBody {
  timescale?: number;
  words?: SpeechWord[];
  sentences?: SpeechSentence[] | null;
  cues?: CaptionCue[];
}

/** The stretch a zero-duration word takes up in the gap that follows: up to the next word's start, at most 0.08 seconds. When the next word starts right here, there is none (skipped). */
const ZERO_DURATION_SLOT = 0.08;

function speechEntries(body: SourceBody, seconds: (ticks: number | undefined) => number): TextEntry[] {
  const words = Array.isArray(body.words) ? body.words : [];
  const index = new Map(words.map((w, i) => [w.id, i]));
  const sentenceOf: Array<{ id: string; paragraphStart: boolean } | undefined> = [];
  for (const sentence of body.sentences ?? []) {
    if (typeof sentence.id !== 'string') continue;
    let members: number[] = [];
    if (Array.isArray(sentence.wordIds)) members = sentence.wordIds.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
    else {
      const a = index.get(sentence.first);
      const b = index.get(sentence.last);
      if (a !== undefined && b !== undefined && a <= b) members = Array.from({ length: b - a + 1 }, (_, k) => a + k);
    }
    members.forEach((i, n) => (sentenceOf[i] = { id: sentence.id!, paragraphStart: sentence.paragraphStart === true && n === 0 }));
  }
  const entries: TextEntry[] = [];
  words.forEach((word, i) => {
    const text = word.text ?? '';
    if (word.hidden || !text.trim()) return;
    const start = seconds(word.start);
    let end = seconds(word.end);
    if (end <= start) {
      const next = words.slice(i + 1).find((w) => typeof w.start === 'number');
      const nextStart = next ? seconds(next.start) : null;
      if (nextStart !== null && nextStart <= start) return;
      end = nextStart !== null && nextStart < start + ZERO_DURATION_SLOT ? nextStart : start + ZERO_DURATION_SLOT;
    }
    const id = word.id ?? '';
    const sentence = sentenceOf[i];
    entries.push({
      key: id,
      id,
      start,
      end,
      text,
      ...(word.speaker !== undefined ? { speaker: word.speaker } : {}),
      ...(sentence ? { sentenceId: sentence.id, paragraphStart: sentence.paragraphStart } : {}),
      wordTiming: word.timingQuality !== 'estimated' && word.timingQuality !== 'missing' && !/\s/.test(text.trim()),
    });
  });
  return entries;
}

function captionEntries(body: SourceBody, seconds: (ticks: number | undefined) => number): TextEntry[] {
  const entries: TextEntry[] = [];
  for (const cue of Array.isArray(body.cues) ? body.cues : []) {
    const text = cue.text ?? '';
    const start = seconds(cue.start);
    const end = seconds(cue.end);
    if (!text.trim() || end <= start) continue;
    const id = cue.id ?? '';
    entries.push({
      key: id,
      id,
      start,
      end,
      text,
      ...(cue.speaker !== undefined ? { speaker: cue.speaker } : {}),
      ...(cue.paragraphStart ? { paragraphStart: true } : {}),
      wordTiming: false,
    });
  }
  return entries;
}

/**
 * The plan for a document without projection. `projected` is its projection over this range. `whole` takes the entire document. Otherwise (a range is given), it takes the original text from the first projected entry to the last one (in document order), so cut parts in between are included. The plan's range is `[0, end of the last entry)`.
 */
export function sourcePlan(body: unknown, projected: TextPlan, whole: boolean): TextPlan {
  const source = (body ?? {}) as SourceBody;
  const timescale = typeof source.timescale === 'number' && source.timescale > 0 ? source.timescale : 1;
  const seconds = (ticks: number | undefined) => (typeof ticks === 'number' ? ticks / timescale : 0);
  let entries = projected.unit === 'speech' ? speechEntries(source, seconds) : captionEntries(source, seconds);
  if (!whole) {
    const order = new Map(entries.map((e, i) => [e.id, i]));
    const at = projected.entries.map((e) => order.get(e.id)).filter((i): i is number => i !== undefined);
    entries = at.length > 0 ? entries.slice(Math.min(...at), Math.max(...at) + 1) : [];
  }
  const end = Math.max(0, ...entries.map((e) => e.end));
  return {
    ...projected,
    range: { startSeconds: 0, endSeconds: end, durationSeconds: end },
    entries,
    sourceCount: entries.length,
    omittedCount: 0,
  };
}

/**
 * Maps chapters to the original's clock. Chapter markers are on sequence time (relative to the range start, `chapters`). A chapter's start in the original is the start of the first entry projected after it (the one ending later than the chapter starts). Chapters with no text after them are omitted.
 */
export function sourceChapters(chapters: readonly TextChapter[], projected: TextPlan, source: TextPlan): TextChapter[] {
  const startOf = new Map<string, number>();
  for (const entry of source.entries) if (!startOf.has(entry.id)) startOf.set(entry.id, entry.start);
  const timeline = [...projected.entries].sort((a, b) => a.start - b.start);
  const out: TextChapter[] = [];
  for (const chapter of chapters) {
    const entry = timeline.find((e) => e.end > chapter.start);
    const start = entry ? startOf.get(entry.id) : undefined;
    if (start !== undefined) out.push({ title: chapter.title, start });
  }
  return out.sort((a, b) => a.start - b.start);
}
