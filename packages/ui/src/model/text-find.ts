/**
 * Find-and-replace matcher (following the prototype `model-find.js`): the three switches, case-sensitive, whole word and regex, have only this one implementation,
 * shared by the subtitle list and later by transcripts. Ranges are UTF-16 offsets (the convention of `String.slice`).
 */

export interface FindOptions {
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface TextRange {
  start: number;
  end: number;
}

const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;
/** Word boundaries use a Unicode property class: `\b` only recognizes ASCII, so “全词” (“whole word”) matching for Chinese would treat every gap between characters as a boundary. */
const NOT_WORD = '[^\\p{L}\\p{N}]';

/** Compiled once: `{re}` or `{error}` (a wrong regex must be reported, not silently match nothing). When the query is empty, neither is set. */
export function compileFind(query: string, options: FindOptions): { re?: RegExp; error?: string } {
  if (!query) return {};
  let source = options.regex ? query : query.replace(RE_ESCAPE, '\\$&');
  if (options.wholeWord) source = `(?:^|${NOT_WORD})(${source})(?=$|${NOT_WORD})`;
  try {
    return { re: new RegExp(source, `g${options.matchCase ? '' : 'i'}u`) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** All matches in a piece of text. */
export function findRanges(text: string, re: RegExp, wholeWord: boolean): TextRange[] {
  const out: TextRange[] = [];
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    // Whole-word mode wraps the match in group 1; the outer layer is the boundary.
    const grouped = wholeWord && match[1] !== undefined;
    const hit = grouped ? match[1]! : match[0];
    const start = grouped ? match.index + match[0].indexOf(hit) : match.index;
    if (!hit.length) {
      re.lastIndex++;
      continue;
    }
    out.push({ start, end: start + hit.length });
    if (re.lastIndex <= start) re.lastIndex = start + hit.length;
  }
  return out;
}

/** Applies several replacements within a piece of text (applied from the end backwards, so earlier ranges do not shift). The replacement text is inserted literally; `$1` is not parsed. */
export function replaceRanges(text: string, ranges: readonly TextRange[], replacement: string): { text: string; changed: number } {
  let next = text;
  let changed = 0;
  for (const range of [...ranges].sort((a, b) => b.start - a.start)) {
    if (range.start < 0 || range.end < range.start || range.end > next.length) continue;
    if (next.slice(range.start, range.end) !== replacement) changed++;
    next = next.slice(0, range.start) + replacement + next.slice(range.end);
  }
  return { text: next, changed };
}

/** Previous / next; wraps around at the ends. */
export function stepIndex(index: number, length: number, direction: 1 | -1): number {
  if (!length) return 0;
  const at = Math.min(Math.max(0, index), length - 1);
  return (((at + direction) % length) + length) % length;
}
