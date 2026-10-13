import type { Id } from '@cuccut/protocol';
import { TASK_PILL_COPY, TASK_VIEW_COPY } from '../copy.ts';
import { agoLabel } from './format.ts';
import type { TaskRow } from './task-list.ts';

/**
 * Task pill and hover card (prototype model-task-pill.js). One invariant: **the “+N” on the pill and the rows in the card come from the same table**.
 * The pill shows the head entry, and “+N” is the count of the rest; the card draws the whole table, up to CARD_MAX rows, with the remainder as one line, “N more”.
 *
 * The prototype's “this project” is here the video open in the editor (`videoId`): a Job records its video, while an agent task belongs to a session and has no video,
 * so with `mineOnly` agent tasks do not go into the pill (they are in the adjacent session).
 */

export const CARD_MAX = 5;

export interface PillOptions {
  /** The video open in the editor. */
  videoId?: Id | null;
  /** Report only this video's tasks. */
  mineOnly?: boolean;
  /** The task whose details are being viewed, sorted first. */
  focusId?: Id | null;
}

const isMine = (row: TaskRow, videoId: Id | null | undefined) => !!videoId && row.videoId === videoId;

/**
 * The table shared by the pill and the card: live tasks (running, queued, waiting for approval); this video's exports are not in the table (the export button shows their progress itself).
 * Order: the one being viewed → this video's → other running ones → queued ones; within a tier, later ones first.
 */
export function pillList(rows: readonly TaskRow[], options: PillOptions = {}): TaskRow[] {
  const { videoId, mineOnly, focusId } = options;
  const rank = (row: TaskRow) => {
    if (focusId && row.id === focusId) return 0;
    if (isMine(row, videoId)) return 1;
    return row.queued ? 3 : 2;
  };
  return rows
    .filter((row) => row.live)
    .filter((row) => !(isMine(row, videoId) && row.kind === 'export'))
    .filter((row) => !mineOnly || isMine(row, videoId))
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row) - rank(b.row) || Date.parse(b.row.startedAt) - Date.parse(a.row.startedAt) || a.index - b.index)
    .map(({ row }) => row);
}

/** The cell on the right: percentage / queued / needs your confirmation / stopping; empty when progress is not determinate. */
export function pillState(row: TaskRow): string {
  if (row.waiting) return TASK_VIEW_COPY.awaitingApproval;
  if (row.queued) return TASK_VIEW_COPY.queued;
  if (row.origin === 'task' && !row.action) return row.label;
  return row.pct == null ? '' : `${row.pct}%`;
}

/** Text on the pill: `转录 · 37%`. */
export function pillLabel(row: TaskRow): string {
  const tail = pillState(row);
  return tail ? `${row.kindText} · ${tail}` : row.kindText;
}

export interface PillFace {
  head: TaskRow;
  label: string;
  more: number;
}

/** What the pill looks like: the head entry plus the count of the rest; nothing is drawn when the table is empty. */
export function pillFace(list: readonly TaskRow[]): PillFace | null {
  const head = list[0];
  if (!head) return null;
  return { head, label: pillLabel(head), more: list.length - 1 };
}

export interface PillCardRow {
  id: Id;
  title: string;
  detail: string;
  meta: string;
  state: string;
  /** A number is determinate progress; `indet` spins; null draws nothing (queued, waiting for approval). */
  progress: number | 'indet' | null;
  cancellable: boolean;
}

/** One row of the card. */
export function pillRow(row: TaskRow, videoId: Id | null | undefined, now: number): PillCardRow {
  // Under one minute (same threshold as “just now” in `agoLabel`) is written as “just started”, without relying on comparing displayed text.
  const justStarted = Math.max(0, now - Date.parse(row.startedAt)) < 60_000;
  const when = justStarted ? TASK_PILL_COPY.justStarted : TASK_PILL_COPY.startedAt(agoLabel(row.startedAt, now));
  return {
    id: row.id,
    title: row.title || row.kindText,
    detail: [row.phase, row.where].filter(Boolean).join(' · '),
    meta: [row.queued ? null : when, isMine(row, videoId) ? TASK_PILL_COPY.mine : null].filter(Boolean).join(' · '),
    state: pillState(row),
    progress: row.queued || row.waiting ? null : (row.pct ?? 'indet'),
    cancellable: row.action !== null,
  };
}

export interface PillCard {
  multi: boolean;
  title: string | null;
  rows: PillCardRow[];
  overflow: number;
}

/** The whole card: with one entry, that entry's details; with several, a count header plus the row table plus an overflow line. */
export function pillCard(list: readonly TaskRow[], videoId: Id | null | undefined, now: number): PillCard {
  return {
    multi: list.length > 1,
    title: list.length > 1 ? TASK_PILL_COPY.count(list.length) : null,
    rows: list.slice(0, CARD_MAX).map((row) => pillRow(row, videoId, now)),
    overflow: Math.max(0, list.length - CARD_MAX),
  };
}
