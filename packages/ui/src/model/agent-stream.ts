/**
 * Character-by-character display of agent replies and Markdown chunking (product design §3.2.2). Pure functions; the view is in components/thread/agent-markdown.tsx.
 *
 * Reply text arrives in lumps (the Runtime merges it within a window of about 60 ms before sending it), so the UI does not jump to the arrival rhythm. It releases the text at a steady pace instead:
 * the number of characters released per frame is proportional to the backlog, so a larger backlog catches up faster and a smaller one advances slowly. The full text stays in the store, and the view renders only the part released so far.
 *
 * - `revealStep`: how many characters to release in this frame
 * - `safeCut` / `advanceCut`: cut points land on grapheme cluster boundaries, so a character is never split in two
 * - `splitBlocks`: splits by Markdown block; while streaming, only the last block changes
 * - `closeStreamingTail`: completes any unfinished markers in the last block first, so asterisks and backticks do not flash on screen while rendering
 */

/** The time over which the backlog is released. */
export const REVEAL_HORIZON_MS = 150;
/** The gap between two frames is capped at this much, so after the page is hidden and then shown again, the text is not released all at once. */
const MAX_ELAPSED_MS = 250;

/** How many characters to release in this frame: proportional to the backlog, with a minimum of 1 and a maximum of the backlog. elapsed is capped at 250 ms first; when it is no shorter than horizon, everything is released. */
export function revealStep(input: { backlog: number; elapsedMs: number; horizonMs?: number }): number {
  const backlog = Math.max(0, Math.floor(input.backlog || 0));
  if (!backlog) return 0;
  const horizon = input.horizonMs && input.horizonMs > 0 ? input.horizonMs : REVEAL_HORIZON_MS;
  const elapsed = Math.min(MAX_ELAPSED_MS, Math.max(0, Number(input.elapsedMs) || 0));
  if (elapsed >= horizon) return backlog;
  return Math.min(backlog, Math.max(1, Math.ceil((backlog * elapsed) / horizon)));
}

/* Intl.Segmenter is looked up on every call: tests temporarily remove it, so the cache follows the constructor. */
let segCache: { ctor: typeof Intl.Segmenter; seg: Intl.Segmenter } | null = null;
function segmenter(): Intl.Segmenter | null {
  const Seg = typeof Intl !== 'undefined' ? (Intl.Segmenter as typeof Intl.Segmenter | undefined) : undefined;
  if (typeof Seg !== 'function') return null;
  if (!segCache || segCache.ctor !== Seg) segCache = { ctor: Seg, seg: new Seg(undefined, { granularity: 'grapheme' }) };
  return segCache.seg;
}

/** Pulls the cut point back to the start of its grapheme cluster; returned unchanged when there is no Intl.Segmenter. */
export function safeCut(text: string, index: number): number {
  const i = Math.max(0, Math.min(text.length, Math.floor(index) || 0));
  if (i === 0 || i === text.length) return i;
  const seg = segmenter();
  if (!seg) return i;
  const hit = seg.segment(text).containing(i);
  return hit ? hit.index : i;
}

/** Releases `step` characters from `from` onward, guaranteeing progress of at least one complete grapheme cluster (safeCut may pull the cut point back to where it started). */
export function advanceCut(text: string, from: number, step: number): number {
  const start = Math.max(0, Math.min(text.length, from || 0));
  if (start >= text.length) return text.length;
  const target = Math.min(text.length, start + Math.max(1, Math.floor(step) || 1));
  const cut = safeCut(text, target);
  if (cut > start) return cut;
  const seg = segmenter();
  const hit = seg ? seg.segment(text).containing(start) : undefined;
  return hit ? Math.min(text.length, hit.index + hit.segment.length) : target;
}

// ---- Fenced code blocks ----

interface Fence {
  ch: string;
  len: number;
}
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})([^`]*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

function fenceOpen(line: string): Fence | null {
  const m = FENCE_OPEN.exec(line);
  if (!m) return null;
  const marks = m[1]!;
  if (marks[0] === '`' && m[2]!.includes('`')) return null;
  return { ch: marks[0]!, len: marks.length };
}

function fenceCloses(line: string, open: Fence): boolean {
  const m = FENCE_CLOSE.exec(line);
  return !!m && m[1]![0] === open.ch && m[1]!.length >= open.len;
}

const LIST_ITEM = /^ {0,3}([*+-]|\d{1,9}[.)])(\s+|$)/;
const blank = (line: string) => /^[ \t]*$/.test(line);

/** Splits by Markdown block (separated by blank lines). Blank lines inside a fenced code block, or inside a list, do not split. Blank lines at the end of a block are not counted as part of it. */
export function splitBlocks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: Fence | null = null;
  const flush = () => {
    while (cur.length && blank(cur[cur.length - 1]!)) cur.pop();
    if (cur.length) blocks.push(cur.join('\n'));
    cur = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (fence) {
      cur.push(line);
      if (fenceCloses(line, fence)) fence = null;
      continue;
    }
    if (blank(line)) {
      if (!cur.length) continue;
      let j = i + 1;
      while (j < lines.length && blank(lines[j]!)) j++;
      const next = j < lines.length ? lines[j]! : null;
      const inList = LIST_ITEM.test(cur[0]!);
      // A blank line inside a list: if the next line is still a list item or an indented continuation, it stays in the same block; anything not yet arrived is held.
      if (inList && (next === null || LIST_ITEM.test(next) || /^[ \t]{2,}\S/.test(next))) {
        cur.push(line);
        continue;
      }
      if (next === null) {
        cur.push(line);
        continue;
      }
      flush();
      continue;
    }
    const open = fenceOpen(line);
    if (open) {
      // A fence can interrupt a paragraph: the paragraph before it forms its own block.
      if (cur.length && !LIST_ITEM.test(cur[0]!)) flush();
      fence = open;
    }
    cur.push(line);
  }
  flush();
  return blocks;
}

// ---- Completing the streaming tail ----

type Span = [start: number, end: number];

/** The ranges of inline code ([start, end), where end includes the closing backtick); the last one, if unclosed, is returned separately. */
function codeSpans(s: string): { spans: Span[]; open: { start: number; len: number } | null } {
  const spans: Span[] = [];
  let open: { start: number; len: number } | null = null;
  for (let i = 0; i < s.length;) {
    if (s[i] === '\\' && open === null) {
      i += 2;
      continue;
    }
    if (s[i] !== '`') {
      i++;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] === '`') j++;
    const len = j - i;
    if (open === null) open = { start: i, len };
    else if (open.len === len) {
      spans.push([open.start, j]);
      open = null;
    }
    i = j;
  }
  return { spans, open };
}

const inSpans = (spans: Span[], i: number) => spans.some(([a, b]) => i >= a && i < b);

/** An unfinished image is hidden entirely; an unfinished link shows only its text. Square brackets inside inline code do not count. */
function fixLinks(s: string): string {
  const { spans, open } = codeSpans(s);
  const masked = (i: number) => inSpans(spans, i) || (open !== null && i >= open.start);
  for (let i = s.lastIndexOf('!['); i >= 0; i = i > 0 ? s.lastIndexOf('![', i - 1) : -1) {
    if (masked(i)) continue;
    if (!/^!\[[^\]]*\]\([^)]*\)/.test(s.slice(i))) return fixLinks(s.slice(0, i));
    break;
  }
  for (let i = s.lastIndexOf('['); i >= 0; i = i > 0 ? s.lastIndexOf('[', i - 1) : -1) {
    if (masked(i) || s[i - 1] === '\\') continue;
    const rest = s.slice(i);
    const m = /^\[([^\]]*)$/.exec(rest) ?? /^\[([^\]]*)\]$/.exec(rest) ?? /^\[([^\]]*)\]\([^)]*$/.exec(rest);
    return m ? s.slice(0, i) + m[1] : s;
  }
  return s;
}

/** The stack for pairing emphasis markers: returns the opening markers that are still unclosed, in order of appearance. A list marker at the start of a line, and an asterisk with whitespace on both sides, do not count. */
function openMarkers(s: string, spans: Span[]): { mark: string; at: number }[] {
  const stack: { mark: string; at: number }[] = [];
  let lineStart = 0;
  for (let i = 0; i < s.length;) {
    const c = s[i]!;
    if (c === '\n') {
      lineStart = i + 1;
      i++;
      continue;
    }
    if (c === '\\') {
      i += 2;
      continue;
    }
    if ((c !== '*' && c !== '~') || inSpans(spans, i)) {
      i++;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] === c) j++;
    let len = j - i;
    const prev = i > 0 ? s[i - 1]! : '';
    const next = j < s.length ? s[j]! : '';
    const prevSpace = !prev || /\s/.test(prev);
    const nextSpace = !next || /\s/.test(next);
    const listMark = c === '*' && len === 1 && /^[ \t]*$/.test(s.slice(lineStart, i)) && next === ' ';
    if (listMark || (prevSpace && nextSpace)) {
      i = j;
      continue;
    }
    if (c === '~') {
      if (len >= 2) {
        const top = stack[stack.length - 1];
        if (top && top.mark === '~~' && !prevSpace) stack.pop();
        else if (!nextSpace) stack.push({ mark: '~~', at: i });
      }
      i = j;
      continue;
    }
    // First treat each as a closer: match from the top of the stack downward.
    while (len > 0 && !prevSpace) {
      const top = stack[stack.length - 1];
      if (!top || top.mark[0] !== '*' || top.mark.length > len) break;
      stack.pop();
      len -= top.mark.length;
    }
    // The rest are treated as openers.
    if (len > 0 && !nextSpace) {
      if (len >= 2) {
        stack.push({ mark: '**', at: i });
        len -= 2;
      }
      if (len >= 1) stack.push({ mark: '*', at: i });
    }
    i = j;
  }
  return stack;
}

/**
 * Completes the last block while streaming: only the last segment is changed, and nothing is done inside an unclosed fence. Unclosed `**`, `*`, `~~`, and inline code are completed; a stray marker at the end is removed; an unfinished link shows only its text; an unfinished image is hidden. This is a preprocessing step on the string before rendering, since the parser has no delimiter hooks.
 */
export function closeStreamingTail(markdown: string): string {
  const lines = markdown.split('\n');
  let fence: Fence | null = null;
  let tailStart = 0;
  let pos = 0;
  for (const line of lines) {
    const end = pos + line.length + 1;
    if (fence) {
      if (fenceCloses(line, fence)) {
        fence = null;
        tailStart = end;
      }
    } else if (blank(line)) tailStart = end;
    else {
      const open = fenceOpen(line);
      if (open) fence = open;
    }
    pos = end;
  }
  if (fence) return markdown;
  tailStart = Math.min(tailStart, markdown.length);
  const head = markdown.slice(0, tailStart);
  let tail = markdown.slice(tailStart);
  if (!tail) return markdown;

  tail = fixLinks(tail);
  // A stray marker at the end is removed outright (`_` only when preceded by whitespace). A half-written closing marker is removed too, and all of them are completed below.
  const strip = (s: string) => s.replace(/[*~]+$/, '').replace(/(^|\s)_+$/, '$1');
  let code = codeSpans(tail);
  if (code.open && code.open.start + code.open.len === tail.length) {
    // Only the opening backtick has arrived: not shown yet.
    tail = strip(tail.slice(0, code.open.start));
    code = codeSpans(tail);
  } else if (!code.open) {
    tail = strip(tail);
    code = codeSpans(tail);
  }
  let closers = '';
  let scan = tail;
  if (code.open) {
    // Asterisks inside inline code do not count as emphasis: close the code first, then close the emphasis outside it.
    closers += '`'.repeat(code.open.len);
    scan = tail.slice(0, code.open.start);
  }
  const markers = openMarkers(scan, code.spans);
  for (let k = markers.length - 1; k >= 0; k--) closers += markers[k]!.mark;
  if (!closers) return head + tail;
  const trail = /\s*$/.exec(tail)![0];
  return head + tail.slice(0, tail.length - trail.length) + closers + trail;
}
