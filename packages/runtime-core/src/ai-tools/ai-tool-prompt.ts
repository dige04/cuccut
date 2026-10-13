import type { AiToolKind, TextMessage } from '@cuccut/protocol';

/**
 * Messages that the AI tools' "call the model directly" path (product design §5.10) hands to a text model: the system prompt is the attached skills (`skillSystemPrompt`), the user's interface language (when given), plus the output format
 * this tool needs; the user message is the text from the prompt box plus this video's context (transcript, attachments). Polish gets numbered words (edits are strictly one word to one word);
 * the other tools get a Markdown transcript with timecodes and speakers (written the same way as the exported transcript).
 */

/**
 * Output language for the prose tools: the same order the built-in skills use, so it holds without a skill too. The
 * interface language is a step only when it is given.
 */
function proseLanguage(uiLanguage: string | undefined): string {
  const order = ['the language the request names', 'the language of the request'];
  if (uiLanguage) order.push('the user\'s interface language');
  order.push('the transcript\'s language');
  return `Write in ${order.join('; otherwise in ')}.`;
}

const PROSE_TOOLS: ReadonlySet<AiToolKind> = new Set(['summary', 'blog', 'title', 'desc']);

/** What each tool asks the model to return (appended at the end of the system prompt). */
const OUTPUT: Record<AiToolKind, string> = {
  polish: [
    'Output: corrections to a transcript, as JSON {"edits":[{"n":<word number>,"text":"<corrected word text>"}]}.',
    'The transcript is given as numbered words, one per line ("n<TAB>text"); a blank line starts a new paragraph.',
    'List only the words whose text you change. Change a word only into its corrected spelling, with punctuation attached to it; never merge, split, add, remove or reorder words, and never make a word empty.',
    'Keep the transcript language; do not translate or rewrite. If nothing needs changing, return {"edits":[]}.',
  ].join('\n'),
  chapters: [
    'Output: the chapters of the whole video, as JSON {"chapters":[{"at":"<timestamp>","title":"<title>","summary":"<one sentence>"}]}.',
    'Each chapter starts at the beginning of a paragraph: copy that paragraph\'s timestamp from the transcript exactly as written. The first chapter starts at the first paragraph. Times strictly increase.',
    'Titles and summaries are non-empty, distinct and in the transcript\'s language unless the user asks for another.',
  ].join('\n'),
  summary: 'Output: the summary itself, in Markdown. No preamble, no closing remarks.',
  blog: 'Output: the blog post itself, in Markdown. No preamble, no closing remarks.',
  title: 'Output: the candidate titles as a numbered Markdown list, one title per item. No preamble, no closing remarks.',
  desc: 'Output: the description itself, ready to paste. No preamble, no closing remarks.',
};

/** JSON Schema for structured output (polish and chapters); the other tools return prose. */
export function outputSchema(tool: AiToolKind): Record<string, unknown> | null {
  if (tool === 'polish') {
    return {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: { n: { type: 'integer' }, text: { type: 'string' } },
            required: ['n', 'text'],
            additionalProperties: false,
          },
        },
      },
      required: ['edits'],
      additionalProperties: false,
    };
  }
  if (tool === 'chapters') {
    return {
      type: 'object',
      properties: {
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: { at: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' } },
            required: ['at', 'title', 'summary'],
            additionalProperties: false,
          },
        },
      },
      required: ['chapters'],
      additionalProperties: false,
    };
  }
  return null;
}

/** One word for polish: its id and text in the transcript, whether it starts a paragraph, and its start on the timeline (seconds). */
export interface ContextWord {
  id: string;
  text: string;
  paragraphStart: boolean;
  start: number;
}

/** An attachment included in full. */
export interface ContextAttachment {
  name: string;
  content: string;
}

export interface AiToolMessageInput {
  tool: AiToolKind;
  /** System prompt assembled from skills (an empty string when there are none). */
  system: string;
  prompt: string;
  /** Markdown transcript with timecodes (unused for polish). */
  transcript: string | null;
  /** Words in this polish batch (numbered from `offset + 1`). */
  words?: { items: readonly ContextWord[]; offset: number; total: number };
  attachments: readonly ContextAttachment[];
  /** The user's interface language (BCP 47); stated in the system prompt when given, while the output language is decided by the skill and the output format. */
  uiLanguage?: string;
}

/** Messages for the model: one system, one user. */
export function aiToolMessages(input: AiToolMessageInput): TextMessage[] {
  const language = input.uiLanguage ? `The user's interface language is ${input.uiLanguage}.` : '';
  const output = PROSE_TOOLS.has(input.tool) ? `${OUTPUT[input.tool]}\n${proseLanguage(input.uiLanguage)}` : OUTPUT[input.tool];
  const system = [input.system.trim(), language, output].filter(Boolean).join('\n\n');
  const parts: string[] = [];
  parts.push(input.prompt.trim() ? `<request>\n${input.prompt.trim()}\n</request>` : '<request />');
  if (input.words) {
    const { items, offset, total } = input.words;
    const lines = items.map((w, i) => `${i > 0 && w.paragraphStart ? '\n' : ''}${offset + i + 1}\t${w.text}`);
    parts.push(
      `<transcript words="${offset + 1}-${offset + items.length}" total="${total}">\n${lines.join('\n')}\n</transcript>`,
    );
  } else if (input.transcript !== null) {
    parts.push(`<transcript>\n${input.transcript.trim()}\n</transcript>`);
  }
  for (const a of input.attachments) parts.push(`<attachment name="${a.name.replace(/"/g, "'")}">\n${a.content}\n</attachment>`);
  return [
    { role: 'system', content: system },
    { role: 'user', content: parts.join('\n\n') },
  ];
}

/** Polish batches: split at paragraph boundaries, at most `max` words each (a paragraph longer than `max` becomes one batch on its own). */
export function polishBatches(words: readonly ContextWord[], max: number): Array<{ offset: number; items: ContextWord[] }> {
  const batches: Array<{ offset: number; items: ContextWord[] }> = [];
  let current: ContextWord[] = [];
  let offset = 0;
  let paragraph: ContextWord[] = [];
  const flushParagraph = () => {
    if (current.length > 0 && current.length + paragraph.length > max) {
      batches.push({ offset, items: current });
      offset += current.length;
      current = [];
    }
    current.push(...paragraph);
    paragraph = [];
  };
  for (const word of words) {
    if (word.paragraphStart && paragraph.length > 0) flushParagraph();
    paragraph.push(word);
  }
  if (paragraph.length > 0) flushParagraph();
  if (current.length > 0) batches.push({ offset, items: current });
  return batches;
}

/**
 * Validates polish edits: the number is in this batch and the text is not empty; edits equal to the original do not count. Returns word id -> new text; on a mismatched number or empty text
 * returns `{ problem }` and the whole batch is discarded (better no edits than edits that are not one word to one word).
 */
export function polishEdits(
  json: unknown,
  batch: { offset: number; items: readonly ContextWord[] },
): { edits: Map<string, string> } | { problem: string } {
  const list = (json as { edits?: unknown } | null)?.edits;
  if (!Array.isArray(list)) return { problem: 'edits is not an array' };
  const edits = new Map<string, string>();
  for (const raw of list) {
    const n = (raw as { n?: unknown }).n;
    const text = (raw as { text?: unknown }).text;
    if (typeof n !== 'number' || !Number.isInteger(n) || typeof text !== 'string') return { problem: 'edit is malformed' };
    const word = batch.items[n - batch.offset - 1];
    if (!word) return { problem: `word ${n} is not in this batch` };
    const next = text.trim();
    if (!next) return { problem: `word ${n} would be empty` };
    if (/[\n\r\t]/.test(next)) return { problem: `word ${n} contains a line break` };
    if (next !== word.text) edits.set(word.id, next);
    else edits.delete(word.id);
  }
  return { edits };
}

/** Timecode `h:mm:ss`, `mm:ss` (decimals allowed) or plain seconds -> seconds; null when unrecognized. */
export function parseTimestamp(value: string): number | null {
  const text = value.trim().replace(/^\[|\]$/g, '');
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:[.,]\d+)?)$/.exec(text);
  if (!m) return null;
  const seconds = Number(m[3]!.replace(',', '.'));
  const minutes = Number(m[2]);
  if (seconds >= 60 || (m[1] !== undefined && minutes >= 60)) return null;
  return Number(m[1] ?? 0) * 3600 + minutes * 60 + seconds;
}

export interface ChapterDraft {
  at: number;
  title: string;
  summary: string;
}

/**
 * Validates the chapters from the model: the time is recognizable and inside the video, and snaps to the nearest paragraph start (`starts`, timeline seconds, ascending); the title is not empty; of chapters snapping to the same
 * start only the first is kept. Sorted by time. Returns an empty list when no chapter is usable.
 */
export function chapterDrafts(json: unknown, starts: readonly number[], duration: number): ChapterDraft[] {
  const list = (json as { chapters?: unknown } | null)?.chapters;
  if (!Array.isArray(list)) return [];
  const byAt = new Map<number, ChapterDraft>();
  for (const raw of list) {
    const r = raw as { at?: unknown; title?: unknown; summary?: unknown };
    const title = typeof r.title === 'string' ? r.title.replace(/\s+/g, ' ').trim() : '';
    if (!title) continue;
    const parsed = typeof r.at === 'string' ? parseTimestamp(r.at) : typeof r.at === 'number' ? r.at : null;
    if (parsed === null || !Number.isFinite(parsed) || parsed < 0 || (duration > 0 && parsed >= duration)) continue;
    const at = snap(parsed, starts);
    if (byAt.has(at)) continue;
    const summary = typeof r.summary === 'string' ? r.summary.replace(/\s+/g, ' ').trim() : '';
    byAt.set(at, { at, title, summary });
  }
  return [...byAt.values()].sort((a, b) => a.at - b.at);
}

function snap(at: number, starts: readonly number[]): number {
  if (starts.length === 0) return at;
  let best = starts[0]!;
  for (const s of starts) if (Math.abs(s - at) < Math.abs(best - at)) best = s;
  return best;
}
