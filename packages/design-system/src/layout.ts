/**
 * File layout and detection of a design system directory (docs/design/canvas §10.1). The format is the original format (`design-system.json` v3, `layout: "files"`) as it sits on disk:
 *
 *   <system>/design-system.json     index
 *   <system>/README.md, *.md, tokens.json, components/, assets/<group>/, fonts/, archived/   content
 *   <system>/manifest.json, tokens.css, api/   generated when the editor saves
 *   <system>/_blobs/<id>.<ext>      uploaded assets (managed by DeckStore, not listed, not watched)
 *
 * What the editor sees and can write: regular files whose paths satisfy the original format's rules (`explainDesignSystemPath`), plus the index itself; files under `_blobs/`, dotfiles
 * and symlinks do not count. Storage and routing reuse `@cuccut/slides`' DeckStore / SlidesServer; this module supplies the layout (`DESIGN_SYSTEM_LAYOUT`).
 * Path rules copy the original `isValidDesignSystemPath`, `explainToolConfigurationPath`, `explainReservedSystemPath` and the runtime path check
 * `validateFilePath`; the original runtime rejects saves by these rules, so the check (`checkDesignSystem`) and the layout share one set, to avoid "check passes, save fails".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeckLayout } from '@cuccut/slides';
import type { DesignSystemInfo } from '@cuccut/protocol';

/** The index of a design system directory. */
export const DESIGN_SYSTEM_FILE = 'design-system.json';
/** Directory for uploaded assets (in the original format `assets/<group>/` is a content path, so this is not called assets). */
export const BLOBS_DIR = '_blobs';

/**
 * Limits of the original format (§10.1): a version holds at most 1,024 files (16 reserved for the original platform's type files, 1,008 of our own), 256 MiB in total,
 * 15 MiB per file, 16 MiB per publish; one uploaded asset 20 MiB, SVG 2 MiB (original `BLOB_STORAGE_LIMITS`).
 */
export const DESIGN_SYSTEM_LIMITS = {
  files: 1024,
  ownFiles: 1008,
  totalBytes: 256 * 1024 * 1024,
  fileBytes: 15 * 1024 * 1024,
  publishBytes: 16 * 1024 * 1024,
  uploadBytes: 20 * 1024 * 1024,
  svgUploadBytes: 2 * 1024 * 1024,
} as const;

/** Fixed paths in a design system (original `DESIGN_SYSTEM_PATHS`). */
export const DESIGN_SYSTEM_PATHS = {
  readme: 'README.md',
  tokens: 'tokens.json',
  manifest: 'manifest.json',
  componentsDir: 'components/',
  libDir: 'components/lib/',
  bundleJs: 'components/bundle.js',
  bundleCss: 'components/bundle.css',
  indexDts: 'components/index.d.ts',
  fontsDir: 'fonts/',
  assetsDir: 'assets/',
  archivedDir: 'archived/',
} as const;

/** Files generated when the editor saves (`design_system_check` does not check them; listed in `notChecked`). */
export const GENERATED_TOKENS_CSS_PATH = 'tokens.css';
export const GENERATED_API_PATH_PATTERN = /^api\/(?:icons\.md|tokens\.md|(?:tokens|components|assets)\/[^/]+\.md)$/;
/** The editor's own files (migration manifest etc.): readable and writable, not content. */
export const EDITOR_OWN_FILES = ['migration.json', 'design-system.before-files.json', 'publish-progress.json', 'migration-map.json'] as const;

/** Component names and the component bundle's global name (original `COMPONENT_NAME_PATTERN` / `WINDOW_NAMESPACE_PATTERN`). */
export const WINDOW_NAMESPACE_PATTERN = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
export const COMPONENT_NAME_PATTERN = WINDOW_NAMESPACE_PATTERN;

const MAX_DESIGN_SYSTEM_PATH_LENGTH = 300;
/** UTF-8 byte limit of a runtime path (`project/<path>`) (original `MAX_FILE_PATH_UTF8_BYTES`). */
const MAX_RUNTIME_PATH_UTF8_BYTES = 512;
const UNSAFE_PATH_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2028\u2029\u2060-\u206f\u2215\u2044\ufeff\uff0f]/;
/** Characters a runtime path must not contain (original `validateFilePath`). */
const RUNTIME_PATH_RESERVED_CHARACTERS = /[%;:\\]/;
const INVISIBLE_PATH_CHARACTER_PATTERN = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const RESERVED_PROTOTYPE_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const REFUSED_TOOL_DIRECTORIES = new Set(['node_modules']);
const REFUSED_TOOL_FILENAMES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'bunfig.toml',
  'tsconfig.json',
  'jsconfig.json',
  'deno.json',
  'deno.jsonc',
  'claude.md',
  'claude.local.md',
  'agents.md',
]);
const WINDOWS_SHORT_NAME_PATTERN = /~\d/;
const IMAGE_SLOT_STATE_FILENAME = '.image-slots.state.json';

/** Segment name for comparison (original `normalizePathSegmentForComparison`): strip invisible characters and anything after `:`, NFC, lowercase, strip trailing dots and spaces. */
function comparableSegment(segment: string): string {
  let normalized = segment.replace(INVISIBLE_PATH_CHARACTER_PATTERN, '');
  const colon = normalized.indexOf(':');
  if (colon >= 0) normalized = normalized.slice(0, colon);
  return normalized.normalize('NFC').toUpperCase().toLowerCase().replace(/[. ]+$/, '');
}

function comparablePath(rel: string): string {
  return rel.split('/').map(comparableSegment).join('/');
}

function isImageSlotStatePath(rel: string): boolean {
  const parts = rel.split('/');
  return parts[parts.length - 1] === IMAGE_SLOT_STATE_FILENAME && !parts.slice(0, -1).some(p => comparableSegment(p).startsWith('.'));
}

/** Original `explainToolConfigurationPath`: segments starting with a dot, toolchain and agent instruction files, Windows short names. */
function explainToolConfigurationPath(rel: string): string | null {
  const parts = rel.split('/').map(comparableSegment);
  if (parts.some(p => p.startsWith('.')) && !isImageSlotStatePath(rel)) {
    return 'is a dot-file or dot-directory (tool, editor, VCS or agent configuration); never part of a design system';
  }
  if (REFUSED_TOOL_FILENAMES.has(parts[parts.length - 1] ?? '') || parts.some(p => REFUSED_TOOL_DIRECTORIES.has(p))) {
    return 'is a package-manager, toolchain or agent-instruction file that tools auto-load from a working directory; never part of a design system';
  }
  if (parts.some(p => WINDOWS_SHORT_NAME_PATTERN.test(p))) {
    return 'has a path segment shaped like a Windows 8.3 short name (NAME~1); rename it without the "~digit"';
  }
  return null;
}

/** Original `explainReservedSystemPath`: names taken by the original platform's pages and type files (alias-aware: case, trailing dots). */
function explainReservedSystemPath(rel: string): string | null {
  const normalized = comparablePath(rel);
  const under = (name: string) => normalized === name || normalized.startsWith(`${name}/`);
  if (under(DESIGN_SYSTEM_FILE)) return `is reserved: ${DESIGN_SYSTEM_FILE} is the index; rename the file`;
  if (under('index.html')) return 'is reserved: index.html is the page itself in the original format; rename the file';
  if (under('skill.md') || under('artifact-type')) {
    return 'is reserved: SKILL.md and artifact-type/ are the design system type’s own files in the original format; rename the file';
  }
  return null;
}

/**
 * Why a relative path (`/`-separated) in a design system breaks the original format's rules; null when it is valid. Ignores `_blobs/` and the index itself (the layout handles those separately).
 * Rules: ≤300 characters, runtime path ≤512 bytes; no control, invisible or slash-lookalike characters, none of `% ; : \`; no empty or dots-only segments,
 * no segment named like a prototype key (`__proto__` etc.); does not end with `.cmekshadow`; not tool configuration (`explainToolConfigurationPath`); no reserved names.
 */
export function explainDesignSystemPath(rel: string): string | null {
  if (rel.length === 0 || rel.length > MAX_DESIGN_SYSTEM_PATH_LENGTH || Buffer.byteLength(`project/${rel}`, 'utf8') > MAX_RUNTIME_PATH_UTF8_BYTES) {
    return `is empty or longer than ${MAX_DESIGN_SYSTEM_PATH_LENGTH} characters; rename it`;
  }
  if (rel.startsWith('/') || UNSAFE_PATH_CHARACTER_PATTERN.test(rel) || RUNTIME_PATH_RESERVED_CHARACTERS.test(rel)) {
    return 'has a character a design system path cannot hold (a control or invisible character, a look-alike slash, % ; : or \\); rename it';
  }
  if (rel.endsWith('.cmekshadow')) return 'ends in .cmekshadow, which is reserved; rename it';
  for (const part of rel.split('/')) {
    if (part === '' || part === '.' || part === '..') return 'has an empty path segment or one that is only dots; rename it';
    if (RESERVED_PROTOTYPE_NAMES.has(part)) return `uses "${part}" as a path segment, which is reserved; rename it`;
  }
  return explainToolConfigurationPath(rel) ?? explainReservedSystemPath(rel);
}

/** Whether the path is the uploaded-assets directory or something under it. */
export function isBlobsPath(rel: string): boolean {
  return rel === BLOBS_DIR || rel.startsWith(`${BLOBS_DIR}/`);
}

/** Whether a relative path in a design system directory is a file the editor can see and write: the index, or a file outside `_blobs/` that satisfies the path rules. */
export function isDesignSystemFile(rel: string): boolean {
  if (rel === DESIGN_SYSTEM_FILE) return true;
  return !isBlobsPath(rel) && explainDesignSystemPath(rel) === null;
}

/** Whether listing and watching descend into this subdirectory. */
function descendInto(rel: string): boolean {
  return !isBlobsPath(rel) && explainDesignSystemPath(rel) === null;
}

/** Limit for one uploaded asset (bytes): SVG 2 MiB, everything else 20 MiB. */
export function designSystemUploadLimit(contentType: string): number {
  const type = contentType.split(';')[0]!.trim().toLowerCase();
  return type === 'image/svg+xml' ? DESIGN_SYSTEM_LIMITS.svgUploadBytes : DESIGN_SYSTEM_LIMITS.uploadBytes;
}

/** Design system layout in the editor service: the whole directory tree (minus `_blobs/` and hidden directories), at most 1,024 files after sorting by name; uploads go to `_blobs/`. */
export const DESIGN_SYSTEM_LAYOUT: DeckLayout = {
  blobDir: BLOBS_DIR,
  isFile: isDesignSystemFile,
  roots: [{ rel: '', descend: true }],
  descendInto,
  watches: rel => isDesignSystemFile(rel) || descendInto(rel),
  maxFiles: DESIGN_SYSTEM_LIMITS.files,
  maxPublishBytes: DESIGN_SYSTEM_LIMITS.publishBytes,
  maxFileBytes: DESIGN_SYSTEM_LIMITS.fileBytes,
  maxBlobBytes: designSystemUploadLimit,
  readOnlyMessage: p => {
    const rel = p.startsWith('project/') ? p.slice('project/'.length) : p;
    if (isBlobsPath(rel)) return `${p}: ${BLOBS_DIR}/ holds uploads and can't be written; upload the file instead`;
    return `${p}: ${explainDesignSystemPath(rel) ?? 'is not a design system file'}`;
  },
};

/** Read limit for the index: anything larger is not treated as a design system (the original's index is at most 2,000,000 characters). */
const MAX_INDEX_BYTES = 8 * 1024 * 1024;
/** Original `MAX_DESIGN_SYSTEM_INDEX_CHARS`. */
export const MAX_DESIGN_SYSTEM_INDEX_CHARS = 2_000_000;

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * When a directory counts as a design system (§10.1, original `isFilesIndex`): the index is an object, `content` is not an object (that is the old single-file format), and it carries a migration marker,
 * or `v` ≥ 3 and `layout` is `"files"`. The remaining fields are checked by `checkDesignSystem`.
 */
export function isDesignSystemIndex(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    !isRecord(value.content) &&
    (hasDesignSystemMarker(value) || (typeof value.v === 'number' && value.v >= 3 && value.layout === 'files'))
  );
}

/** Whether the index carries the original's migration marker (a `createdOnFiles` or `convertedFrom` object); without it the original editor opens it read-only. */
export function hasDesignSystemMarker(index: Record<string, unknown>): boolean {
  return isRecord(index.createdOnFiles) || isRecord(index.convertedFrom);
}

/** Reads and parses design-system.json; null when missing, unreadable, too large or not JSON. Does not follow symlinks. */
export async function readDesignSystemJson(dir: string): Promise<unknown> {
  const file = path.join(dir, DESIGN_SYSTEM_FILE);
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > MAX_INDEX_BYTES) return null;
    return JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/** Title of the design system: the index's `title` trimmed, or the directory name when missing. */
export function designSystemTitle(index: object, dir: string): string {
  const raw = (index as { title?: unknown }).title;
  const title = typeof raw === 'string' ? raw.trim() : '';
  return title || path.basename(dir);
}

/** The index's `namespace`: a string that satisfies the global-name rule, otherwise null. */
export function designSystemNamespace(index: object): string | null {
  const raw = (index as { namespace?: unknown }).namespace;
  return typeof raw === 'string' && WINDOW_NAMESPACE_PATTERN.test(raw) ? raw : null;
}

/** Reads the design system summary of a directory; null when it is not a design system (no index, unreadable, not §10.1). Does not follow symlinks. */
export async function readDesignSystemInfo(dir: string): Promise<DesignSystemInfo | null> {
  const parsed = await readDesignSystemJson(dir);
  if (!isDesignSystemIndex(parsed)) return null;
  return { title: designSystemTitle(parsed, dir), namespace: designSystemNamespace(parsed) };
}

/** Design system directory summary for the Space scan: size and time are taken the same way as for designs (regular files in the directory and its first-level subdirectories). */
export interface DesignSystemDirStat extends DesignSystemInfo {
  size: number;
  mtimeMs: number;
  birthtimeMs: number;
}

/** Returns the summary when the directory is a design system, otherwise null. Does not follow symlinks; skips dotfiles and dot-directories. */
export async function inspectDesignSystem(dir: string): Promise<DesignSystemDirStat | null> {
  const info = await readDesignSystemInfo(dir);
  if (!info) return null;
  const indexFile = await fs.lstat(path.join(dir, DESIGN_SYSTEM_FILE)).catch(() => null);
  if (!indexFile) return null;
  let size = 0;
  let mtimeMs = indexFile.mtimeMs;
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
  return { ...info, size, mtimeMs, birthtimeMs: indexFile.birthtimeMs };
}
