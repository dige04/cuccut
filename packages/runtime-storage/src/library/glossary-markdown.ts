import type { GlossaryContent } from '@cuccut/protocol';
import { normalizeGlossary } from './library-content.ts';
import { formatInvalid } from './library-errors.ts';
import { RuntimeStorageLibrary as SL } from '@cuccut/protocol/messages/runtime-storage';

/**
 * Exchange format for glossaries (architecture design §5.9): Markdown with front matter, with one table in the body.
 *
 * ```markdown
 * ---
 * format: cuccut.glossary
 * version: 1
 * name: "产品术语"
 * kind: transcription          # or translation
 * language: zh                 # transcription: applicable language, may be omitted
 * source: zh                   # translation: source language, may be omitted
 * target: en                   # translation: target language, required
 * default: true                # whether new videos enable it by default
 * ---
 *
 * | Term | Misheard |           # transcription: canonical spelling | common mishearings (separated by commas or 、(enumeration comma))
 * | --- | --- |
 * | CucCut | 宝卡特, 包cut |
 *
 * | Source | Target | Note |    # translation: source term | translation | note (may be empty)
 * ```
 *
 * - The identifier is `format: cuccut.glossary` in the front matter, independent of the file extension. `version` is 1 for now, and higher versions are rejected.
 * - Values may be written as JSON strings (in double quotes). When written out, the name is always a JSON string.
 * - In cells, write `|` and `\\` as `\\|` and `\\\\`. Separators inside mishearings, `,`, `，` and `、` themselves, are written as `\\,` and so on.
 * - Header matching is case-insensitive, and the number of columns must match exactly. A title and explanatory text may come before the table, but the body may contain only one table.
 */

export const GLOSSARY_FORMAT = 'cuccut.glossary';
export const GLOSSARY_FORMAT_VERSION = 1;
/** Upper limit for a glossary file. */
export const GLOSSARY_MAX_BYTES = 4 * 1024 * 1024;

const TRANSCRIPTION_COLUMNS = ['term', 'misheard'];
const TRANSLATION_COLUMNS = ['source', 'target', 'note'];
// i18n-ignore: parses the mishearing words the user wrote, recognizes both Chinese and English separators
const MISHEARD_SEPARATORS = [',', '，', '、'];

export function encodeGlossaryMarkdown(content: GlossaryContent): string {
  const lines = ['---', `format: ${GLOSSARY_FORMAT}`, `version: ${GLOSSARY_FORMAT_VERSION}`, `name: ${JSON.stringify(content.name)}`];
  lines.push(`kind: ${content.kind}`);
  if (content.kind === 'transcription') {
    if (content.language) lines.push(`language: ${content.language}`);
  } else {
    if (content.sourceLanguage) lines.push(`source: ${content.sourceLanguage}`);
    lines.push(`target: ${content.targetLanguage}`);
  }
  lines.push(`default: ${content.defaultEnabled}`, '---', '');
  if (content.kind === 'transcription') {
    lines.push('| Term | Misheard |', '| --- | --- |');
    for (const t of content.terms) {
      lines.push(`| ${escapeCell(t.canonical)} | ${t.misheard.map((m) => escapeSeparators(escapeCell(m))).join(', ')} |`);
    }
  } else {
    lines.push('| Source | Target | Note |', '| --- | --- | --- |');
    for (const t of content.terms) lines.push(`| ${escapeCell(t.source)} | ${escapeCell(t.target)} | ${escapeCell(t.note ?? '')} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** Whether the text is a glossary (checks only the front matter identifier). */
export function looksLikeGlossaryMarkdown(text: string): boolean {
  const fm = splitFrontMatter(text);
  return fm !== null && fm.fields.get('format') === GLOSSARY_FORMAT;
}

/** `fallbackName`: the name used when the front matter has no `name` (on import, the file name). */
export function decodeGlossaryMarkdown(text: string, fallbackName?: string): GlossaryContent {
  const fm = splitFrontMatter(text);
  if (!fm) throw formatInvalid(SL.glossaryNoFrontMatter());
  const { fields, body, bodyStartLine } = fm;
  if (fields.get('format') !== GLOSSARY_FORMAT) throw formatInvalid(SL.glossaryNoFormat({ format: GLOSSARY_FORMAT }));
  const version = Number(fields.get('version') ?? '');
  if (!Number.isInteger(version) || version < 1) throw formatInvalid(SL.glossaryVersionInteger());
  if (version > GLOSSARY_FORMAT_VERSION)
    throw formatInvalid(SL.glossaryVersionUnsupported({ version, supported: GLOSSARY_FORMAT_VERSION }));
  const kind = fields.get('kind');
  if (kind !== 'transcription' && kind !== 'translation') throw formatInvalid(SL.glossaryFrontMatterKind());
  const defaultRaw = fields.get('default') ?? 'false';
  if (defaultRaw !== 'true' && defaultRaw !== 'false') throw formatInvalid(SL.glossaryFrontMatterDefault());

  const rows = readTable(body, bodyStartLine, kind === 'transcription' ? TRANSCRIPTION_COLUMNS : TRANSLATION_COLUMNS);
  const name = fields.get('name')?.trim() || fallbackName || '';
  const defaultEnabled = defaultRaw === 'true';
  if (kind === 'transcription') {
    return normalizeGlossary({
      name,
      kind,
      language: fields.get('language') ?? null,
      defaultEnabled,
      terms: rows.map(({ cells }) => ({
        canonical: unescapeCell(cells.term!),
        misheard: splitMisheard(cells.misheard!)
          .map(unescapeCell)
          .filter((m) => m.trim()),
      })),
    });
  }
  return normalizeGlossary({
    name,
    kind,
    sourceLanguage: fields.get('source') ?? null,
    targetLanguage: fields.get('target') ?? '',
    defaultEnabled,
    terms: rows.map(({ cells }) => ({
      source: unescapeCell(cells.source!),
      target: unescapeCell(cells.target!),
      note: unescapeCell(cells.note!),
    })),
  });
}

function splitFrontMatter(raw: string): { fields: Map<string, string>; body: string[]; bodyStartLine: number } | null {
  const lines = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  let start = 0;
  while (start < lines.length && !lines[start]!.trim()) start++;
  if (lines[start]?.trim() !== '---') return null;
  const end = lines.findIndex((line, i) => i > start && line.trim() === '---');
  if (end < 0) return null;
  const fields = new Map<string, string>();
  for (const line of lines.slice(start + 1, end)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const colon = stripped.indexOf(':');
    if (colon <= 0) return null;
    const key = stripped.slice(0, colon).trim().toLowerCase();
    let value = stripped.slice(colon + 1).trim();
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value) as string;
      } catch {
        return null;
      }
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    fields.set(key, value);
  }
  return { fields, body: lines.slice(end + 1), bodyStartLine: end + 2 };
}

function readTable(body: string[], firstLine: number, columns: string[]): { line: number; cells: Record<string, string> }[] {
  const tables: { start: number; lines: string[] }[] = [];
  let current: { start: number; lines: string[] } | null = null;
  body.forEach((line, i) => {
    if (line.trim().startsWith('|')) {
      if (!current) {
        current = { start: firstLine + i, lines: [] };
        tables.push(current);
      }
      current.lines.push(line);
    } else {
      current = null;
    }
  });
  if (tables.length === 0) throw formatInvalid(SL.glossaryNoTable());
  if (tables.length > 1) throw formatInvalid(SL.glossaryOneTable(), { line: tables[1]!.start });
  const [table] = tables;
  const header = splitRow(table!.lines[0]!).map((c) => c.trim().toLowerCase());
  if (header.length !== columns.length || header.some((h, i) => h !== columns[i])) {
    throw formatInvalid(SL.glossaryHeader({ header: columns.map((c) => c[0]!.toUpperCase() + c.slice(1)).join(' | ') }), { line: table!.start });
  }
  const separator = table!.lines[1];
  if (!separator || !splitRow(separator).every((c) => /^\s*:?-{3,}:?\s*$/.test(c))) {
    throw formatInvalid(SL.glossarySeparator(), { line: table!.start + 1 });
  }
  return table!.lines.slice(2).map((line, i) => {
    const cells = splitRow(line);
    const lineNo = table!.start + 2 + i;
    if (cells.length !== columns.length)
      throw formatInvalid(SL.glossaryColumns({ line: lineNo, expected: columns.length, actual: cells.length }), { line: lineNo });
    return { line: lineNo, cells: Object.fromEntries(columns.map((c, j) => [c, cells[j]!.trim()])) };
  });
}

/** Splits a line at unescaped `|`. Escapes stay in the cell as written and are handled by `unescapeCell`. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  const cells: string[] = [];
  let cell = '';
  let closed = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    closed = false;
    if (c === '\\' && i + 1 < s.length) {
      cell += c + s[i + 1];
      i++;
    } else if (c === '|') {
      cells.push(cell);
      cell = '';
      closed = true;
    } else {
      cell += c;
    }
  }
  // A trailing `|` at the end of a line only closes the row. It does not open a new column.
  if (!closed || cell.trim()) cells.push(cell);
  return cells;
}

function splitMisheard(cell: string): string[] {
  const parts: string[] = [];
  let part = '';
  for (let i = 0; i < cell.length; i++) {
    const c = cell[i]!;
    if (c === '\\' && i + 1 < cell.length) {
      part += c + cell[i + 1];
      i++;
    } else if (MISHEARD_SEPARATORS.includes(c)) {
      parts.push(part);
      part = '';
    } else {
      part += c;
    }
  }
  parts.push(part);
  return parts;
}

function unescapeCell(cell: string): string {
  return cell.replace(/\\(.)/g, '$1').trim();
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function escapeSeparators(value: string): string {
  return value.replace(/[,，、]/g, (c) => `\\${c}`);
}
