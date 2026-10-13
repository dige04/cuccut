#!/usr/bin/env node
/**
 * Finds Chinese text in the source that has not yet entered the copy catalogs (repo convention §5): CJK characters outside comments and regex literals all count.
 *
 * Exempt:
 * - translation files `*.<语言>.ts` (for example `foo-copy.zh-Hans.ts`), tests (`*.test.*`), and the `testing/` directory;
 * - lines where `i18n-ignore` appears on the same line or the line above, with the reason stated (for example “语言的自称” (the language's self-name), “给模型的提示词” (prompt text for the model), “解析中文标点” (parsing Chinese punctuation));
 * - lines between `i18n-ignore-start` and `i18n-ignore-end`;
 * - the whole file, if `i18n-ignore-file` appears in its first 20 lines.
 *
 * Usage: `node tools/i18n-scan.mjs [directory or file…]`; with no arguments, it scans `SCAN_ROOTS`. Exits with code 1 when leftovers remain.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCAN_ROOTS = ['packages', 'apps'];
const SKIP_DIRS = new Set(['node_modules', 'generated', 'testing', 'out', 'dist', 'target']);
const TRANSLATION_FILE = /\.(zh-Hans|zh-Hant|ja|ko|es|fr|de|nl|pt-BR|it|ru|pl|tr|vi)\.tsx?$/;
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯＀-￯]/;

/** The line numbers (1-based, de-duplicated) of every CJK character in a source file that falls in code, strings, templates, or JSX text. Comments and regex literals do not count. */
export function cjkLines(source) {
  const lines = new Set();
  let line = 1;
  let i = 0;
  const n = source.length;
  // Nesting of `${` in template strings: the stack records, for each template level, the brace depth at which that template began.
  const templates = [];
  let braces = 0;
  let prev = ''; // The last meaningful code character, used to tell division apart from a regex
  const hit = (ch) => {
    if (CJK.test(ch)) lines.add(line);
  };
  const regexAllowed = () => prev === '' || '(,=:[!&|?{};+-*%~^'.includes(prev) || /\breturn$|\btypeof$|\bcase$/.test(source.slice(Math.max(0, i - 7), i).trimEnd());

  const readString = (quote, resume = false) => {
    if (!resume) i++;
    while (i < n) {
      const ch = source[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '\n') line++;
      if (ch === quote) {
        i++;
        return;
      }
      if (quote === '`' && ch === '$' && source[i + 1] === '{') {
        templates.push(braces);
        braces++;
        i += 2;
        return 'interp';
      }
      hit(ch);
      i++;
    }
  };

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (ch === '/' && regexAllowed()) {
      // Regex literal: skip to the next `/` that is not inside a character class.
      i++;
      let inClass = false;
      while (i < n && source[i] !== '\n') {
        const c = source[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(source[i])) i++;
      prev = '/';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      readString(ch);
      prev = 'a';
      continue;
    }
    if (ch === '{') braces++;
    if (ch === '}') {
      braces--;
      if (templates.length && braces === templates[templates.length - 1]) {
        templates.pop();
        // Return to reading the outer template string.
        i++;
        readString('`', true);
        prev = 'a';
        continue;
      }
    }
    hit(ch);
    if (!/\s/.test(ch)) prev = ch;
    i++;
  }
  return [...lines].sort((a, b) => a - b);
}

/** The lines left after exemptions: `[{ line, text }]`. */
export function findings(source) {
  const rows = source.split('\n');
  if (rows.slice(0, 20).some((r) => r.includes('i18n-ignore-file'))) return [];
  const ignored = new Set();
  let block = false;
  rows.forEach((r, idx) => {
    if (r.includes('i18n-ignore-start')) block = true;
    if (block || r.includes('i18n-ignore')) ignored.add(idx + 1);
    if (/i18n-ignore(?!-(start|end|file))/.test(r)) ignored.add(idx + 2);
    if (r.includes('i18n-ignore-end')) block = false;
  });
  return cjkLines(source)
    .filter((l) => !ignored.has(l))
    .map((l) => ({ line: l, text: rows[l - 1].trim() }));
}

export function isScannedFile(file) {
  const base = path.basename(file);
  if (!/\.(ts|tsx|mts|cts|js|mjs|jsx)$/.test(base)) return false;
  if (/\.test\.|\.d\.ts$/.test(base) || TRANSLATION_FILE.test(base)) return false;
  return !file.split(path.sep).some((part) => SKIP_DIRS.has(part));
}

export function* walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (isScannedFile(target)) yield target;
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    yield* walk(path.join(target, entry.name));
  }
}

/** Scans a set of paths and returns `[{ file, line, text }]`. `apps/*` and `packages/*` only check their own `src/`. */
export function scan(targets, root = process.cwd()) {
  const out = [];
  for (const target of targets) {
    const abs = path.resolve(root, target);
    const dirs =
      SCAN_ROOTS.includes(target) && fs.statSync(abs).isDirectory()
        ? fs.readdirSync(abs).map((d) => path.join(abs, d, 'src')).filter((d) => fs.existsSync(d))
        : [abs];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        for (const f of findings(fs.readFileSync(file, 'utf8'))) out.push({ file: path.relative(root, file), ...f });
      }
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const targets = process.argv.slice(2);
  const found = scan(targets.length ? targets : SCAN_ROOTS);
  for (const f of found) console.log(`${f.file}:${f.line}: ${f.text}`);
  const files = new Set(found.map((f) => f.file)).size;
  console.error(found.length ? `${found.length} lines in ${files} files still carry untranslated CJK text.` : 'No untranslated CJK text.');
  process.exitCode = found.length ? 1 : 0;
}
