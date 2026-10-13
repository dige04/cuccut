import type { Localized } from '@cuccut/protocol';
import { RcSkills } from '@cuccut/protocol/messages/runtime-core';

/**
 * `SKILL.md` front matter (architecture design §3.8): a YAML block wrapped in `---` at the start of the file. Only top-level string fields are read here. No YAML library is introduced:
 *
 * - `key: value`: scalars are used as-is, with a trailing ` #comment` removed. Values wrapped in single or double quotes are restored using YAML's escape rules.
 * - `key: |` / `key: >` (may carry `-`, `+` and an indentation number): the indented lines below form a block scalar. `|` keeps line breaks, and `>` folds lines into spaces.
 * - A scalar continued on the indented lines below is folded into one line.
 * - Nested mappings and lists under top-level keys (for example `metadata:` and `allowed-tools:`) are skipped entirely, and the value is recorded as an empty string.
 * - Blank lines and `#` comment lines are ignored.
 *
 * A top-level line that cannot be understood makes the whole thing noncompliant. The choice of fields (required, length) is up to the caller.
 */

export type FrontmatterResult = { ok: true; fields: Map<string, string>; body: string } | { ok: false; problem: Localized };

const KEY_LINE = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)[ \t]*:(?:[ \t]+(.*)|[ \t]*)$/;
const BLOCK_HEADER = /^([|>])([+-]?)(\d?)([+-]?)[ \t]*(?:#.*)?$/;

export function parseSkillFrontmatter(raw: string): FrontmatterResult {
  const lines = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  if (lines[0]?.trimEnd() !== '---') return { ok: false, problem: RcSkills.frontmatterMissingStart() };
  const end = lines.findIndex((line, i) => i > 0 && (line.trimEnd() === '---' || line.trimEnd() === '...'));
  if (end < 0) return { ok: false, problem: RcSkills.frontmatterUnclosed() };
  const block = lines.slice(1, end);
  const fields = new Map<string, string>();
  let i = 0;
  while (i < block.length) {
    const line = block[i]!;
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }
    if (/^[ \t]/.test(line)) {
      // The nested content (mappings, lists) of the previous key is not read.
      i++;
      continue;
    }
    const match = KEY_LINE.exec(line);
    if (!match) return { ok: false, problem: RcSkills.frontmatterBadLine({ line: i + 2, text: line.slice(0, 80) }) };
    const key = match[1]!;
    const rest = (match[2] ?? '').trim();
    i++;
    // The indented lines below, including blank lines between them, belong to this key.
    const start = i;
    while (i < block.length && (/^[ \t]/.test(block[i]!) || (!block[i]!.trim() && nextIndented(block, i)))) i++;
    const continuation = block.slice(start, i);
    const header = BLOCK_HEADER.exec(rest);
    if (header) {
      fields.set(key, blockScalar(continuation, header[1] as '|' | '>'));
    } else if (rest.startsWith('"')) {
      fields.set(key, doubleQuoted(rest));
    } else if (rest.startsWith("'")) {
      fields.set(key, singleQuoted(rest));
    } else if (rest === '') {
      // The value is on the next line. Nested mappings or lists are not read. Indented plain text is folded into one line.
      const nested = continuation.some((l) => /^\s*-(\s|$)/.test(l) || /^\s*[A-Za-z0-9_][\w.-]*\s*:(\s|$)/.test(l));
      fields.set(key, nested ? '' : fold(continuation.map((l) => l.trim())));
    } else {
      const plain = stripComment(rest);
      fields.set(key, continuation.length ? fold([plain, ...continuation.map((l) => stripComment(l.trim()))]) : plain);
    }
  }
  return { ok: true, fields, body: lines.slice(end + 1).join('\n') };
}

function nextIndented(block: string[], i: number): boolean {
  for (let j = i + 1; j < block.length; j++) {
    if (block[j]!.trim()) return /^[ \t]/.test(block[j]!);
  }
  return false;
}

/** Block scalar: removes the common indentation. `|` keeps line breaks, and `>` folds adjacent lines into spaces (blank lines are kept as line breaks). Leading and trailing whitespace is removed. */
function blockScalar(lines: string[], style: '|' | '>'): string {
  const indents = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const indent = indents.length ? Math.min(...indents) : 0;
  const body = lines.map((l) => l.slice(indent).trimEnd());
  if (style === '|') return body.join('\n').trim();
  const out: string[] = [];
  let paragraph: string[] = [];
  for (const line of body) {
    if (line) paragraph.push(line);
    else {
      if (paragraph.length) out.push(paragraph.join(' '));
      paragraph = [];
      out.push('');
    }
  }
  if (paragraph.length) out.push(paragraph.join(' '));
  return out
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Multi-line scalar: lines between blank lines are joined with spaces, and blank lines become line breaks. */
function fold(lines: string[]): string {
  return blockScalar(lines, '>');
}

function stripComment(value: string): string {
  return value.replace(/[ \t]+#.*$/, '').trim();
}

function doubleQuoted(value: string): string {
  const close = findClosingQuote(value);
  const literal = close > 0 ? value.slice(0, close + 1) : value;
  try {
    const parsed: unknown = JSON.parse(literal);
    if (typeof parsed === 'string') return parsed;
  } catch {
    // YAML has more escapes than JSON (`\'`, `\x41`, …). When it cannot be parsed, the quotes are removed and the value is used as-is.
  }
  return literal.replace(/^"|"$/g, '');
}

function findClosingQuote(value: string): number {
  for (let i = 1; i < value.length; i++) {
    if (value[i] === '\\') i++;
    else if (value[i] === '"') return i;
  }
  return -1;
}

function singleQuoted(value: string): string {
  let out = '';
  for (let i = 1; i < value.length; i++) {
    if (value[i] === "'") {
      if (value[i + 1] === "'") {
        out += "'";
        i++;
      } else {
        return out;
      }
    } else {
      out += value[i];
    }
  }
  return out;
}
