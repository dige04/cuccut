import { defineMessages, live as liveMessages, type TaskStatus, type TimelineItem } from '@cuccut/protocol';
import { formatClock } from './format.ts';
import { relativePath, type ThreadBlock } from './thread.ts';
import { zhHans } from './agent-turn.zh-Hans.ts';
import { zhHant } from './agent-turn.zh-Hant.ts';
import { ja } from './agent-turn.ja.ts';
import { ko } from './agent-turn.ko.ts';
import { es } from './agent-turn.es.ts';
import { fr } from './agent-turn.fr.ts';
import { de } from './agent-turn.de.ts';
import { nl } from './agent-turn.nl.ts';
import { ptBR } from './agent-turn.pt-BR.ts';
import { it } from './agent-turn.it.ts';
import { ru } from './agent-turn.ru.ts';
import { pl } from './agent-turn.pl.ts';
import { tr } from './agent-turn.tr.ts';
import { vi } from './agent-turn.vi.ts';

/** Copy for the turn footer and steps in the session thread (the English is the source of keys and types; translations are in `agent-turn.zh-Hans.ts`). */
const en = {
  waiting: 'Waiting for your approval',
  working: 'Working',
  stopping: 'Stopping',
  worked: (span: string) => `Worked for ${span}`,
  stoppedAfter: (span: string) => `Stopped · worked for ${span}`,
  stopped: 'Stopped',
  failed: (error: string | null) => `Failed · ${error ?? 'unknown reason'}`,
  stepStatus: { declined: 'Declined', interrupted: 'Interrupted' } as Partial<Record<ToolCall['status'], string>>,
  exitCode: (code: number) => `Exit code ${code}`,
  stepDeclined: 'This step was declined',
  commandExited: (code: number) => `The command exited with code ${code}`,
  stepIncomplete: 'This step didn’t finish',
  lineRange: (path: string, line: number, end: number) => `${path} · lines ${line}–${end}`,
  lineCol: (path: string, line: number, col: number) => `${path} · line ${line}, column ${col}`,
  line: (path: string, line: number) => `${path} · line ${line}`,
};
export type AgentTurnMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The “computed things” in the Agent session thread (product design §3.2.2): row spacing, turns and footers, diffs of step output, and file paths in the body text.
 * Pure functions; the tool step categories and group header summaries are in thread.ts (`toolStep` / `stepsSummary`).
 */

type Task = Extract<TimelineItem, { kind: 'task' }>;

// ---- Spacing ----

/** The kind of a row in the thread. `block` is a Markdown block in the same reply; `footer` is the turn footer. */
export type RowKind = 'user' | 'assistant' | 'tool' | 'approval' | 'notice' | 'block' | 'footer';

const GAPS: Partial<Record<`${RowKind}>${RowKind}`, number>> = {
  'user>user': 4,
  'user>assistant': 0,
  'tool>tool': 0,
  'user>tool': 16,
  'assistant>tool': 4,
  'tool>assistant': 4,
  'block>block': 12,
};

/** The spacing between adjacent rows: 24 after a card, 4 from any row to the footer, 0 for the first row, and the rest looked up by kind. */
export function gapBetween(prev: RowKind | null, next: RowKind, prevHasCards = false): number {
  if (!prev) return 0;
  if (next === 'footer') return 4;
  if (prevHasCards) return 24;
  return GAPS[`${prev}>${next}`] ?? 16;
}

/** The row kind for thread blocks: a tool-step group counts as tool; a task status row counts as footer. */
export function rowKind(block: ThreadBlock): RowKind {
  switch (block.type) {
    case 'user':
      return 'user';
    case 'agent':
      return 'assistant';
    case 'steps':
      return 'tool';
    case 'task':
      return 'footer';
    default:
      return block.type;
  }
}

// ---- Turns ----

export interface Turn {
  /** The indexes in the thread blocks of the first block of a turn and of the last content block (task status rows excluded); the footer attaches after `end`. */
  start: number;
  end: number;
  hasUser: boolean;
  /** Has content other than the user's message. */
  replied: boolean;
  /** The assistant's body text for this turn (Markdown source, joined by blank lines), excluding tools and thinking. */
  text: string;
  /** The tasks in this turn (if there are several, the last one is taken). */
  task: Task | null;
  /** Has approvals still awaiting a decision. */
  waiting: boolean;
}

/** Splits thread blocks into turns: from one user message up to just before the next. Task status rows are not content; they are only recorded as this turn's task. */
export function turns(blocks: readonly ThreadBlock[]): Turn[] {
  const out: (Turn & { texts: string[] })[] = [];
  let cur: (Turn & { texts: string[] }) | null = null;
  blocks.forEach((block, i) => {
    if (block.type === 'user' || !cur) {
      cur = { start: i, end: i, hasUser: block.type === 'user', replied: false, text: '', task: null, waiting: false, texts: [] };
      out.push(cur);
    }
    if (block.type === 'task') {
      cur.task = block.item;
      return;
    }
    cur.end = i;
    if (block.type !== 'user') cur.replied = true;
    if (block.type === 'agent' && block.item.text.trim()) cur.texts.push(block.item.text.trim());
    if (block.type === 'approval' && block.item.status === 'pending') cur.waiting = true;
  });
  return out.map(({ texts, ...turn }) => ({ ...turn, text: texts.join('\n\n') }));
}

/** Whether the footer appears: it always appears while in progress. Otherwise there must be a user message, and either a reply, or the turn stopped or failed (the status has to be explained). */
export function showFooter(turn: Turn, live: boolean): boolean {
  if (live) return true;
  if (!turn.hasUser) return false;
  return turn.replied || turn.task?.status === 'stopped' || turn.task?.status === 'failed';
}

/** Duration: 0:42, 1:03, 1:02:05. */
export function elapsedLabel(ms: number): string {
  return formatClock(Math.max(0, ms) / 1000);
}

/** End time: local 24-hour clock, e.g. 14:32. */
export function clockLabel(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Footer copy. In progress: “正在工作 (working) · 0:42”; stopped and waiting for permission: “等你允许 (waiting for your permission) · 0:42”; done: “已工作 (worked) 1:03”.
 * Stop and failure follow the task event. With no task yet (not started), in progress only says “正在工作 (working)”.
 */
export function footerLabel(input: {
  status: TaskStatus | null;
  startedAt?: number | null;
  endedAt?: number | null;
  now: number;
  waiting?: boolean;
  error?: string | null;
}): string {
  const { status, startedAt, endedAt, now, waiting, error } = input;
  const span = startedAt != null ? elapsedLabel((endedAt ?? now) - startedAt) : null;
  const live = (word: string) => (span ? `${word} · ${span}` : word);
  switch (status) {
    case null:
    case 'running':
      return live(waiting ? M.waiting : M.working);
    case 'stopping':
      return live(M.stopping);
    case 'completed':
      return span ? M.worked(span) : '';
    case 'stopped':
      return span ? M.stoppedAfter(span) : M.stopped;
    case 'failed':
      return M.failed(error ?? null);
  }
}

// ---- Tool output ----

export type DiffLineType = 'add' | 'del' | 'hunk' | 'meta' | 'ctx';

/** The classification of each line of a unified diff. */
export function diffLines(text: string): { type: DiffLineType; text: string }[] {
  return text
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      let type: DiffLineType = 'ctx';
      if (/^(\+\+\+|---)(\s|$)/.test(line) || /^(diff |index )/.test(line)) type = 'meta';
      else if (line.startsWith('@@')) type = 'hunk';
      else if (line.startsWith('+')) type = 'add';
      else if (line.startsWith('-')) type = 'del';
      return { type, text: line };
    });
}

/** Whether the output is a unified diff: it has `@@` hunk headers, or paired `---` / `+++` file headers. */
export function looksLikeDiff(text: string): boolean {
  return /^@@ .* @@/m.test(text) || (/^--- \S/m.test(text) && /^\+\+\+ \S/m.test(text));
}

type ToolCall = Extract<TimelineItem, { kind: 'tool-call' }>;

/** Step duration: 0.4s, 12s, 1:03. */
export function durationLabel(ms: number): string {
  if (ms < 10_000) return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return elapsedLabel(ms);
}

const STATUS_META: Partial<Record<ToolCall['status'], string>> = liveMessages(() => M.stepStatus);

/** The metadata on the right of a collapsed row: rejected or interrupted, a non-zero exit code (`code`, shown in red on failure), and duration. `status` is the status latched in the UI. */
export function stepMeta(item: ToolCall, status: ToolCall['status']): { text: string; code?: boolean }[] {
  const out: { text: string; code?: boolean }[] = [];
  const word = STATUS_META[status];
  if (word) out.push({ text: word });
  if (item.exitCode !== null && item.exitCode !== 0) out.push({ text: M.exitCode(item.exitCode), code: true });
  if (item.durationMs !== null) out.push({ text: durationLabel(item.durationMs) });
  return out;
}

/** The text of the “error” section shown when a failed or rejected step is expanded. */
export function stepError(item: ToolCall, status: ToolCall['status']): string {
  if (status === 'declined') return M.stepDeclined;
  if (item.exitCode !== null && item.exitCode !== 0) return M.commandExited(item.exitCode);
  return M.stepIncomplete;
}

/** Tool status update: once it has failed, it is not changed back by later updates. */
export function nextToolStatus<S extends string>(prev: S | null, next: S): S {
  return prev === 'failed' ? prev : next;
}

// ---- File paths in the body text ----

/** File extensions recognized as file paths. */
export const FILE_EXT = [
  'pdf', 'html', 'htm', 'csv', 'tsv', 'txt', 'markdown', 'xml', 'sql',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'md',
  'css',
  'rs',
  'py',
  'toml',
  'yaml',
  'yml',
  'srt',
  'vtt',
  'ass',
  'mp4',
  'mov',
  'wav',
  'mp3',
  'png',
  'jpg',
];
const DOMAIN = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

export interface PathToken {
  path: string;
  line: number | null;
  lineEnd: number | null;
  col: number | null;
}

/**
 * Whether inline code looks like a file path: it has a directory prefix (`./` `../` `~/` `/`), or it is a multi-segment path whose last segment is a known extension.
 * It may carry `:line`, `:start-end`, or `:line:column`. Bare file names, URLs, and anything with whitespace or a query string do not count.
 */
export function parsePathToken(text: string): PathToken | null {
  const raw = text.trim();
  if (!raw || /\s/.test(raw) || raw.includes('?') || raw.includes('://')) return null;
  const m = /^(.*?)(?::(\d+)(?:-(\d+)|:(\d+))?)?$/.exec(raw)!;
  const path = m[1]!;
  if (!path) return null;
  const prefixed = /^(\.\.?\/|~\/|\/)/.test(path) && !/^\/\//.test(path) && path.length > 1;
  if (!prefixed) {
    const segs = path.split('/');
    if (segs.length < 2 || segs.some((s, i) => !s && i < segs.length - 1)) return null;
    const ext = /\.([a-z0-9]+)$/i.exec(segs[segs.length - 1]!);
    if (!ext || !FILE_EXT.includes(ext[1]!.toLowerCase())) return null;
    if (DOMAIN.test(segs[0]!)) return null;
  }
  const num = (v: string | undefined) => (v == null ? null : Number(v));
  return { path, line: num(m[2]), lineEnd: num(m[3]), col: num(m[4]) };
}

/** The tooltip text: the relative path and the line range. */
export function pathTip(p: PathToken, cwd?: string | null): string {
  const path = relativePath(p.path, cwd);
  if (p.line == null) return path;
  if (p.lineEnd != null) return M.lineRange(path, p.line, p.lineEnd);
  if (p.col != null) return M.lineCol(path, p.line, p.col);
  return M.line(path, p.line);
}
