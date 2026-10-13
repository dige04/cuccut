import path from 'node:path';

/**
 * The unified diff used for the `output` of file-editing steps (architecture design §3.1). It holds the pieces shared by the Claude and ACP Drivers.
 */

/** Splits into lines; a trailing newline does not add an extra empty line. */
export function diffBodyLines(text: string): string[] {
  if (text === '') return [];
  return text.replace(/\r?\n$/, '').split(/\r?\n/);
}

/** The path in the file header: relative to the working directory (with `a/` / `b/` prefixes) when the file is inside it; the original path when it is not, or when there is no working directory. */
export function diffPath(file: string, cwd: string | null): { a: string; b: string } {
  const relative = cwd && path.isAbsolute(file) ? path.relative(cwd, file) : null;
  if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    const posix = relative.split(path.sep).join('/');
    return { a: `a/${posix}`, b: `b/${posix}` };
  }
  if (!path.isAbsolute(file)) return { a: `a/${file}`, b: `b/${file}` };
  return { a: file, b: file };
}

const CONTEXT_LINES = 3;

/**
 * The unified diff between two texts (one hunk): removes the lines common to both ends, and keeps at most 3 lines of context before and after. `oldText` null means a new file (old side `/dev/null`). Line numbers are relative to the text given: when the whole file is given, they are file line numbers; when only a changed fragment is given (some agents do this), they are fragment line numbers. Null when the two are identical.
 */
export function textDiff(file: { a: string; b: string }, oldText: string | null, newText: string): string | null {
  const before = oldText === null ? [] : diffBodyLines(oldText);
  const after = diffBodyLines(newText);
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail])
    tail++;
  if (oldText !== null && head === before.length && head === after.length) return null;
  const start = Math.max(0, head - CONTEXT_LINES);
  const removed = before.slice(head, before.length - tail);
  const added = after.slice(head, after.length - tail);
  const leading = before.slice(start, head);
  const trailing = before.slice(before.length - tail, Math.min(before.length, before.length - tail + CONTEXT_LINES));
  const oldCount = leading.length + removed.length + trailing.length;
  const newCount = leading.length + added.length + trailing.length;
  // unified diff convention: when one side has 0 lines, its start line number is the line before it (an empty file uses 0).
  const oldStart = oldCount === 0 ? start : start + 1;
  const newStart = newCount === 0 ? start : start + 1;
  return [
    oldText === null ? '--- /dev/null' : `--- ${file.a}`,
    `+++ ${file.b}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
    ...leading.map((l) => ` ${l}`),
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
    ...trailing.map((l) => ` ${l}`),
  ].join('\n');
}
