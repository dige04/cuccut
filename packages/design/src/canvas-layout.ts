/**
 * File layout and recognition for the design canvas directory (docs/design/canvas §2.1, §2.2).
 *
 *   <canvas>/canvas.json        index (v3)
 *   <canvas>/<path>.dc.html     board; may be in a subdirectory
 *   <canvas>/ds/<folder>/…      installed design system
 *   <canvas>/<support files>    css, js, json that boards reference by relative path
 *   <canvas>/assets/<id>.<ext>  uploaded assets (managed by DeckStore, not in the manifest)
 *
 * What the editor can see and write is every regular file in the directory, except those under `assets/`, names starting with a dot, symbolic links, and segment names that do not follow the rules.
 * Storage and routes follow DeckStore / SlidesServer of `@cuccut/slides`; this only gives the layout (`CANVAS_LAYOUT`).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS_DIR, type DeckLayout } from '@cuccut/slides';
import type { DesignCanvasInfo } from '@cuccut/protocol';

/** Entry file of the canvas directory. */
export const CANVAS_FILE = 'canvas.json';
/** File suffix of boards. */
export const BOARD_SUFFIX = '.dc.html';
/** Directory where installed design systems live; the `.dc.html` files inside are not boards. */
export const DESIGN_SYSTEMS_DIR = 'ds';

/** Limits of the original format (§2.1): one design canvas has at most 512 files and 256 MB in total, with 16 MB per publish. */
export const CANVAS_LIMITS = {
  files: 512,
  totalBytes: 256 * 1024 * 1024,
  publishBytes: 16 * 1024 * 1024,
} as const;

/** Each segment of a path: starts with a letter, digit or `_`, and contains only those plus `.` and `-`. */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

export function isCanvasSegment(segment: string): boolean {
  return SEGMENT.test(segment);
}

/** Whether a relative path in the design canvas directory (`/`-separated) is a file the editor can see and write. */
export function isCanvasFile(rel: string): boolean {
  const parts = rel.split('/');
  if (parts[0] === ASSETS_DIR) return false;
  return parts.every(isCanvasSegment);
}

/** Whether it is a board file (ends with `.dc.html` and is not in `ds/`). */
export function isBoardPath(rel: string): boolean {
  return rel.endsWith(BOARD_SUFFIX) && rel.split('/')[0] !== DESIGN_SYSTEMS_DIR;
}

/** The design canvas layout in the editor service: the whole directory tree (excluding `assets/` and hidden directories), sorted by name, listing at most 512 files. */
export const CANVAS_LAYOUT: DeckLayout = {
  isFile: isCanvasFile,
  roots: [{ rel: '', descend: true }],
  descendInto: rel => isCanvasFile(rel),
  watches: rel => isCanvasFile(rel),
  maxFiles: CANVAS_LIMITS.files,
  maxPublishBytes: CANVAS_LIMITS.publishBytes,
  readOnlyMessage: p =>
    `${p}: files under assets/, hidden paths and path segments outside [A-Za-z0-9_][A-Za-z0-9_.-]* can't be written`,
};

/** Conditions for recognizing a design canvas (§2.1): `v` is 3, `boards` is an object. Other fields are checked by `checkCanvas`. */
export function isCanvasMetadata(value: unknown): value is { v: 3; boards: Record<string, unknown>; title?: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const canvas = value as { v?: unknown; boards?: unknown };
  return canvas.v === 3 && typeof canvas.boards === 'object' && canvas.boards !== null && !Array.isArray(canvas.boards);
}

/** Upper limit for reading canvas.json: anything larger is not treated as a design canvas (to avoid reading a huge JSON). */
const MAX_CANVAS_JSON_BYTES = 4 * 1024 * 1024;

/** Reads and parses canvas.json; null if it is missing, unreadable, too large, or not JSON. Does not follow symbolic links. */
export async function readCanvasJson(dir: string): Promise<unknown> {
  const file = path.join(dir, CANVAS_FILE);
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > MAX_CANVAS_JSON_BYTES) return null;
    return JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/** Title of the design canvas: `title` in canvas.json with leading and trailing whitespace removed; the directory name if there is none. */
export function canvasTitle(canvas: object, dir: string): string {
  const raw = (canvas as { title?: unknown }).title;
  const title = typeof raw === 'string' ? raw.trim() : '';
  return title || path.basename(dir);
}

/** Reads the overview of a design canvas in a directory. Returns null if it is not a design canvas (missing, unreadable, or not meeting §2.1). Does not follow symbolic links. */
export async function readCanvasInfo(dir: string): Promise<DesignCanvasInfo | null> {
  const parsed = await readCanvasJson(dir);
  if (!isCanvasMetadata(parsed)) return null;
  return { title: canvasTitle(parsed, dir), boardCount: Object.keys(parsed.boards).length };
}

/** Overview of a design canvas directory for Space scanning: size and time are taken the same way as for a deck (regular files in the directory and in its first-level subdirectories). */
export interface CanvasDirStat extends DesignCanvasInfo {
  size: number;
  mtimeMs: number;
  birthtimeMs: number;
}

/** Returns the overview of the directory if it is a design canvas, otherwise null. Does not follow symbolic links; skips files and directories starting with a dot. */
export async function inspectCanvas(dir: string): Promise<CanvasDirStat | null> {
  const info = await readCanvasInfo(dir);
  if (!info) return null;
  const canvasFile = await fs.lstat(path.join(dir, CANVAS_FILE)).catch(() => null);
  if (!canvasFile) return null;
  let size = 0;
  let mtimeMs = canvasFile.mtimeMs;
  const add = async (folder: string, depth: number): Promise<void> => {
    const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (depth === 0) await add(full, 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.lstat(full).catch(() => null);
      if (!stat) continue;
      size += stat.size;
      mtimeMs = Math.max(mtimeMs, stat.mtimeMs);
    }
  };
  await add(dir, 0);
  return { ...info, size, mtimeMs, birthtimeMs: canvasFile.birthtimeMs };
}
