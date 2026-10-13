#!/usr/bin/env node
/**
 * References to messages on the Rust side (repo convention §5): `msg!("<area>.<name>", "English template", args…)` from the `message-ref` crate generates the English text and a reference, and translations live only in the `packages/protocol/src/messages/` directory. This finds every `msg!` in `crates/` and `bindings/`, and the test (`rust-messages.test.ts`) checks against it: every key is in the TS directory, each English entry matches the Rust template word for word, and the same key always has the same template.
 *
 * Usage: `node tools/rust-messages.mjs` lists all keys and templates (JSON).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUST_ROOTS = ['crates', 'bindings'];
// `tests/` holds integration tests; `msg!` calls in tests are not text meant for people.
const SKIP_DIRS = new Set(['target', 'node_modules', 'generated', 'tests']);

/** The contents of a Rust string literal (handles only the escapes that `msg!` templates use). */
function unescape(body) {
  return body.replace(/\\(u\{([0-9a-fA-F]+)\}|n|t|"|\\|'|\n\s*)/g, (_, esc, hex) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (esc === 'n') return '\n';
    if (esc === 't') return '\t';
    if (esc.startsWith('\n')) return '';
    return esc;
  });
}

const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;
const MSG = new RegExp(String.raw`msg!\(\s*${STRING}\s*,\s*${STRING}`, 'gs');

/** The ranges taken up by `#[cfg(test)]` modules (matched by braces, skipping brackets inside string and char literals). */
function testRanges(source) {
  const ranges = [];
  for (const m of source.matchAll(/#\[cfg\(test\)\]\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+\w+\s*\{/g)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '"') {
        for (i++; i < source.length && source[i] !== '"'; i++) if (source[i] === '\\') i++;
      } else if (ch === "'" && /^'(\\.|[^\\'])'/.test(source.slice(i, i + 4))) {
        i = source.indexOf("'", i + 2);
      } else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
    }
    ranges.push([m.index, i]);
  }
  return ranges;
}

/** One `msg!` call in a Rust source file: `{ key, template, line }`. Calls in comments and in `#[cfg(test)]` modules are not counted. */
export function messagesIn(source) {
  const found = [];
  const tests = testRanges(source);
  for (const m of source.matchAll(MSG)) {
    if (tests.some(([from, to]) => m.index >= from && m.index <= to)) continue;
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    if (source.slice(lineStart, m.index).includes('//')) continue;
    const line = source.slice(0, m.index).split('\n').length;
    found.push({ key: unescape(m[1]), template: unescape(m[2]), line });
  }
  return found;
}

/** Placeholder names in a template (`{name}`; `{{` and `}}` are literal braces). */
export function placeholders(template) {
  return [...template.replace(/\{\{|\}\}/g, '').matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]);
}

function* rustFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* rustFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith('.rs')) {
      yield path.join(dir, entry.name);
    }
  }
}

/** All `msg!` calls in the repo: `{ key, template, file, line }`, with `file` relative to the repo root. */
export function rustMessages(root) {
  const all = [];
  for (const top of RUST_ROOTS) {
    const dir = path.join(root, top);
    if (!fs.existsSync(dir)) continue;
    for (const file of rustFiles(dir)) {
      const rel = path.relative(root, file);
      for (const m of messagesIn(fs.readFileSync(file, 'utf8'))) all.push({ ...m, file: rel });
    }
  }
  return all;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const byKey = new Map();
  for (const m of rustMessages(root)) if (!byKey.has(m.key)) byKey.set(m.key, m.template);
  process.stdout.write(`${JSON.stringify(Object.fromEntries(byKey), null, 2)}\n`);
}
