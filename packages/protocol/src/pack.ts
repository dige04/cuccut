/**
 * Packs (pack spec docs/spec/pack-spec.md): a folder that carries a way of making videos to another machine: scene templates, skills, library items, a style guide with
 * reference images and videos, and quick actions. Installing copies the content into the places CucCut already reads (`<home>/templates`, `<home>/skills`, the user library)
 * and records what came from which pack.
 *
 * This file holds the types, constants and dependency-free checks, and it ships with the main entry into the UI. The zod schemas (manifest and `packs.*` parameters) are in
 * `pack-schemas.ts`, exported through `@cuccut/protocol/schemas`; the text scan is in `pack-scan.ts`.
 */

import type { LibraryName } from './library.ts';
import { ProtocolPacks as PP } from './messages/protocol/protocol-packs.ts';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';
import type { TemplateCategory, TemplateKind } from './template.ts';

/** The `format` of `pack.json`. A manifest without it (an agentcut pack) or with another value is refused (`PACK_FOREIGN_FORMAT`). */
export const PACK_FORMAT = 'cuccut.pack';
/** The manifest format version (`schema`). Other values: `PACK_UNSUPPORTED_SCHEMA`. */
export const PACK_SCHEMA_VERSION = 1;
/** The manifest file in the root of a pack folder. */
export const PACK_MANIFEST_FILE = 'pack.json';
/** CucCut's record of an installed pack, in `<home>/packs/<id>/`. A dot file, like `.cuccut-skill.json`, so it is never part of the pack's content. */
export const PACK_RECORD_FILE = '.cuccut-pack.json';
/** The style guide's usual name (`style` in the manifest may name another `.md` file in the root). */
export const PACK_STYLE_FILE = 'STYLE.md';
/** The reserved review standard's usual name. */
export const PACK_REVIEW_FILE = 'review.json';
/** Folders inside a pack. */
export const PACK_DIRS = {
  templates: 'templates',
  skills: 'skills',
  library: 'library',
  examples: 'examples',
  rules: 'rules',
} as const;
/** The version written when the manifest gives none. */
export const PACK_DEFAULT_VERSION = '1.0.0';
/** The placeholder in a quick action's text: the selected timeline item's name in quotes, or "this video". */
export const PACK_SELECTION_PLACEHOLDER = '{selection}';

/**
 * Pack id: starts with a lowercase letter; lowercase letters, digits and single dashes. It is the folder name under `<home>/packs/<id>/` and the last segment of
 * `/settings/packs/<id>`.
 */
export const PACK_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Ids a pack can't take: they are the routes of the settings pages beside the pack pages. */
export const PACK_RESERVED_IDS = ['import', 'export'] as const;
/** A rule id in the reserved `rules` field. */
export const PACK_RULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A version: letters, digits, dots, dashes and plus signs (semver in practice, not enforced). */
export const PACK_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
/** A `files[].sha256`: lowercase hexadecimal. */
export const PACK_SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Characters in a style guide, about a page. It reaches every session, so it cannot crowd out the owner's own instructions. */
export const PACK_STYLE_MAX_CHARS = 4000;

/** Limits. Character counts are in UTF-16 code units. */
export const PACK_LIMITS = {
  id: 64,
  name: 80,
  version: 32,
  description: 400,
  author: 80,
  license: 60,
  templates: 32,
  skills: 32,
  library: 64,
  /** A library item's display name (`library[].name`). */
  libraryName: 100,
  examples: 12,
  exampleTitle: 80,
  exampleNote: 300,
  quickActions: 12,
  quickActionLabel: 40,
  quickActionText: 2000,
  rules: 64,
  styleChars: PACK_STYLE_MAX_CHARS,
  /** Files in the whole pack, `pack.json` included (dot files are neither counted nor read). */
  files: 500,
  /** Bytes of all files together. */
  totalBytes: 200 * 1024 * 1024,
  /** A relative path inside the pack. */
  path: 300,
  /** `pack.json` itself. */
  manifestBytes: 1024 * 1024,
  /** A text file `packs_read` returns at once. */
  readFileBytes: 256 * 1024,
} as const;

/** How long a preview (`packs.inspect`) stays installable. */
export const PACK_PREVIEW_TTL_MS = 30 * 60_000;
/** How long a removed pack is kept for Undo (`packs.restore`); purged at startup after that. */
export const PACK_TRASH_TTL_MS = 24 * 60 * 60_000;
/** The whole read of a pack from the network (GitHub or `https://`). */
export const PACK_DOWNLOAD_TIMEOUT_MS = 2 * 60_000;

/** Kinds of reference file, with their extensions (lowercase). */
export const PACK_EXAMPLE_KINDS = ['image', 'video'] as const;
export type PackExampleKind = (typeof PACK_EXAMPLE_KINDS)[number];
export const PACK_EXAMPLE_EXTENSIONS: Readonly<Record<PackExampleKind, readonly string[]>> = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  video: ['mp4', 'webm', 'mov'],
};
/** Library files that a pack can't carry: a voice package needs its owner's consent, which cannot travel. Recognised by extension here and by content at inspect. */
export const PACK_REFUSED_LIBRARY_EXTENSIONS = ['bcvoice'] as const;
/** Manifest fields a CucCut pack refuses with `PACK_UNSUPPORTED_FIELD`: agentcut's edit-time code. */
export const PACK_UNSUPPORTED_FIELDS = ['recipes', 'recipeFiles'] as const;
/** Root files that may sit in a pack without being named by the manifest (a GitHub repository usually has them). They are never installed or read by an agent. */
export const PACK_DOC_FILE_PATTERN = /^(?:readme|license|licence|notice|changelog|authors)(?:\.[a-z0-9]+)?$/i;

/** `details.code` of `packs.*` errors (pack spec §8). */
export const PACK_ERROR_CODES = [
  'PACK_NOT_FOUND',
  'PACK_SOURCE_NOT_FOUND',
  'PACK_URL_INVALID',
  'PACK_INVALID',
  'PACK_UNSUPPORTED_SCHEMA',
  'PACK_FOREIGN_FORMAT',
  'PACK_UNSUPPORTED_FIELD',
  'PACK_TOO_LARGE',
  'PACK_ID_RESERVED',
  'PACK_BLOCKED',
  'PACK_STYLE_TOO_LONG',
  'PACK_PREVIEW_EXPIRED',
  'PACK_RESTORE_CONFLICT',
  'PACK_TRASH_EXPIRED',
  'PACK_EXPORT_TARGET_NOT_EMPTY',
  'PACK_STYLE_CHANGED',
  'PACK_NETWORK',
  'OFFLINE_STRICT',
  'PACK_EXAMPLE_NOT_FOUND',
  'PACK_EXAMPLE_UNSUPPORTED',
  'PACK_EXAMPLE_LIMIT',
] as const;
export type PackErrorCode = (typeof PACK_ERROR_CODES)[number];

// ---- The manifest (pack.json) ----

/** A library item: a file under `library/` that `library.import` accepts (glossary, colour or caption style, image, video, sticker, font), never a voice. */
export interface PackLibraryItem {
  /** `library/<file>`. */
  file: string;
  /** The name shown in the preview; the library entry keeps the name the file carries. */
  name?: string;
}

/** A reference image or video: what a finished video in this style looks like, with what to take from it. */
export interface PackExample {
  /** `examples/<file>`. */
  file: string;
  kind: PackExampleKind;
  title: string;
  /** What to notice in it. */
  note: string;
  /** For a video: a still image beside it (`examples/<file>.jpg`), which is what an agent opens. Written by CucCut when ffmpeg is there. */
  still?: string;
}

/** A message sent to the agent with one click. `{selection}` becomes the selected item's name, or "this video". */
export interface PackQuickAction {
  label: string;
  text: string;
}

/** One file in the `files` index: what export wrote, checked on every read. Required for packs served from an `https://` address. */
export interface PackFileEntry {
  path: string;
  size: number;
  /** Lowercase hexadecimal sha256 of the bytes. */
  sha256: string;
}

/** `pack.json` after validation (defaults filled in). */
export interface PackManifest {
  format: typeof PACK_FORMAT;
  schema: typeof PACK_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  /** Template ids; each is `templates/<id>/`, a CucCut template directory (template spec). */
  templates: string[];
  /** Skill ids; each is `skills/<id>/` with a `SKILL.md`. */
  skills: string[];
  library: PackLibraryItem[];
  /** The style guide: a Markdown file in the root, or `""` for none. */
  style: string;
  examples: PackExample[];
  quickActions: PackQuickAction[];
  /** Reserved for the Rules module: rule ids, each `rules/<id>.*`. Kept with the pack, not applied. */
  rules: string[];
  /** Reserved for the Review-gate module: a JSON file in the root, or `""`. Kept with the pack, not applied. */
  review: string;
  files?: PackFileEntry[];
}

/** What a file in a pack folder is, by the manifest. `doc` is a root README / LICENSE kind of file that is allowed but never installed. */
export type PackFileRole = 'manifest' | 'template' | 'skill' | 'library' | 'style' | 'example' | 'still' | 'rules' | 'review' | 'doc';

/** Dependency-free check of a relative path inside a pack (`/`-separated). Returns the problem, or null. */
export function packPathProblem(path: string): string | null {
  if (!path) return V.pathEmpty().text;
  if (path.length > PACK_LIMITS.path) return V.pathTooLong().text;
  if (/[\\\u0000-\u001f]/.test(path)) return V.pathBadChars().text;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.startsWith('~')) return PP.pathRelative().text;
  const segments = path.split('/');
  if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) return V.pathBadSegments().text;
  if (segments.some((seg) => seg.startsWith('.'))) return PP.pathHidden().text;
  return null;
}

/** The lowercase extension of a path, without the dot (`""` when there is none). */
export function packFileExtension(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * What a file is, by the manifest: the manifest itself, a file inside a named template or skill directory, a named library file, the style guide, a reference file or its
 * still, a file under `rules/` (when the manifest names rules), the review file, or a root documentation file. null: the manifest does not name it, and the pack is refused
 * (pack spec §3.3, like template spec §2.1).
 */
export function packFileRole(manifest: Pick<PackManifest, 'templates' | 'skills' | 'library' | 'style' | 'examples' | 'rules' | 'review'>, path: string): PackFileRole | null {
  if (path === PACK_MANIFEST_FILE) return 'manifest';
  const [top, item] = path.split('/');
  if (top === PACK_DIRS.templates && item && path.length > top.length + item.length + 1 && manifest.templates.includes(item)) return 'template';
  if (top === PACK_DIRS.skills && item && path.length > top.length + item.length + 1 && manifest.skills.includes(item)) return 'skill';
  if (manifest.library.some((l) => l.file === path)) return 'library';
  if (manifest.style && manifest.style === path) return 'style';
  if (manifest.examples.some((e) => e.file === path)) return 'example';
  if (manifest.examples.some((e) => e.still === path)) return 'still';
  if (top === PACK_DIRS.rules && manifest.rules.length > 0 && path.length > top.length + 1) return 'rules';
  if (manifest.review && manifest.review === path) return 'review';
  if (!path.includes('/') && PACK_DOC_FILE_PATTERN.test(path)) return 'doc';
  return null;
}

/**
 * Files a manifest names that a folder listing lacks: each template and skill needs at least its directory, each library, style, reference and review file itself.
 * Returns `/`-separated paths; directories end with `/`.
 */
export function packMissingFiles(manifest: PackManifest, present: ReadonlySet<string>): string[] {
  const missing: string[] = [];
  const dirs = new Set<string>();
  for (const file of present) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  for (const id of manifest.templates) if (!dirs.has(`${PACK_DIRS.templates}/${id}`)) missing.push(`${PACK_DIRS.templates}/${id}/`);
  for (const id of manifest.skills) if (!dirs.has(`${PACK_DIRS.skills}/${id}`)) missing.push(`${PACK_DIRS.skills}/${id}/`);
  const files = [
    ...manifest.library.map((l) => l.file),
    ...(manifest.style ? [manifest.style] : []),
    ...manifest.examples.flatMap((e) => [e.file, ...(e.still ? [e.still] : [])]),
    ...(manifest.review ? [manifest.review] : []),
  ];
  for (const file of files) if (!present.has(file)) missing.push(file);
  return missing;
}

/** Whether an id is free for a pack (pattern, length and not reserved). */
export function isPackId(id: string): boolean {
  return id.length <= PACK_LIMITS.id && PACK_ID_PATTERN.test(id) && !(PACK_RESERVED_IDS as readonly string[]).includes(id);
}

/** A name → a pack id (export's default): lowercase ASCII, other runs become one dash, leading digits dropped. null when nothing is left. */
export function slugPackId(name: string): string | null {
  const id = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[-0-9]+|-+$/g, '')
    .slice(0, PACK_LIMITS.id)
    .replace(/-+$/, '');
  if (!id || !PACK_ID_PATTERN.test(id)) return null;
  return (PACK_RESERVED_IDS as readonly string[]).includes(id) ? `${id}-pack` : id;
}

/** Expands a quick action's text: `{selection}` becomes `selection` (already quoted by the caller), every occurrence. */
export function expandQuickAction(text: string, selection: string): string {
  return text.split(PACK_SELECTION_PLACEHOLDER).join(selection);
}

// ---- Installed state ----

/** Where an installed pack was read from. */
export type PackSource =
  | {
      kind: 'local';
      /** The folder, absolute. Updates are a re-import from it. */
      path: string;
    }
  | {
      kind: 'github';
      /** Normalized to `https://github.com/<owner>/<repo>[/tree/<ref>/<path>]`. */
      url: string;
      owner: string;
      repo: string;
      ref: string;
      /** The commit (full sha) `ref` pointed to when read. */
      commit: string;
      path: string;
    }
  | {
      kind: 'url';
      /** The base address, ending in `/` (`pack.json` is read from beside it). */
      url: string;
    };

/** One template or skill a pack wrote, with the digest it had then (`dirHash`: sha256 over the sorted `(path, \0, bytes, \0)` of the directory, dot files excluded). */
export interface PackInstalledDir {
  id: string;
  dirHash: string;
}

/** One library entry a pack created (or reused, when an entry with the same content already came from an earlier install). */
export interface PackInstalledLibraryItem {
  file: string;
  library: LibraryName;
  entryId: string;
  contentHash: string;
}

/** `.cuccut-pack.json` in `<home>/packs/<id>/` (pack spec §6.2). */
export interface InstalledPackRecord {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  source: PackSource;
  /** sha256 (hex) of the `pack.json` bytes as read. */
  manifestHash: string;
  installedAt: string;
  updatedAt: string;
  /** Everything the manifest names, whether or not installing wrote it: the style of a template is found through its pack even when the user's own copy was kept. */
  provides: { templates: string[]; skills: string[] };
  /** Only what this pack wrote. */
  installed: { templates: PackInstalledDir[]; skills: PackInstalledDir[]; library: PackInstalledLibraryItem[] };
  style: boolean;
  examples: PackExample[];
  quickActions: PackQuickAction[];
  reserved: { rules: number; review: boolean };
}

/** An item a pack brought, as it is now: `changed` since install (its digest differs) or `deleted` since. */
export type PackItemState = 'present' | 'changed' | 'deleted';
export type PackItemKind = 'template' | 'skill' | 'library';

export interface PackItemRef {
  kind: PackItemKind;
  /** Template or skill id; for library items, the entry id. */
  id: string;
  /** The display name when known (template title, skill name, library entry name). */
  name?: string;
}

export interface PackItemView extends PackItemRef {
  state: PackItemState;
  /** Library items: which library the entry is in. */
  library?: LibraryName;
}

/** A pack and its name, for labels ("From the pack X"). */
export interface PackRef {
  id: string;
  name: string;
}

/** One installed pack in a list. */
export interface PackSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  source: PackSource;
  installedAt: string;
  updatedAt: string;
  counts: { templates: number; skills: number; library: number; examples: number; quickActions: number };
  hasStyle: boolean;
  quickActions: PackQuickAction[];
  provides: { templates: string[]; skills: string[] };
  /** Absolute path of `<home>/packs/<id>/`. */
  path: string;
}

/** A folder under `<home>/packs/` whose record can't be read: shown, never fatal. */
export interface PackDiagnostic {
  dir: string;
  path: string;
  message: string;
  issues: string[];
}

export interface PackListResult {
  packs: PackSummary[];
  diagnostics: PackDiagnostic[];
}

/** A reference file on the pack page: the manifest entry plus whether its still exists. */
export interface PackExampleView extends PackExample {
  /** Whether `still` (or the image itself) is there to open. */
  hasStill: boolean;
  size: number;
}

/** The reserved files, shown read-only. */
export interface PackReservedTexts {
  rules: { path: string; text: string }[];
  review: string | null;
}

/** `packs.get`: everything the pack page shows. */
export interface PackDetail {
  pack: PackSummary;
  /** The style guide's text, and its digest for `expectedHash`. null: the pack has none. */
  style: { text: string; hash: string } | null;
  examples: PackExampleView[];
  quickActions: PackQuickAction[];
  items: { templates: PackItemView[]; skills: PackItemView[]; library: PackItemView[] };
  reserved: PackReservedTexts;
}

// ---- Inspect (preview before install) ----

/** Where an item of the previewed pack would land. */
export type PackPreviewItemState =
  /** Not on this computer: it will be installed. */
  | 'new'
  /** Installed by this pack before and unchanged: it will be updated. */
  | 'update'
  /** Installed by this pack before and changed since: kept unless `replace`. */
  | 'changed'
  /** The user's own item with this id: kept unless `replace`. */
  | 'exists'
  /** A built-in item with this id: never installed. */
  | 'builtin';

export interface PackPreviewTemplate {
  id: string;
  title: string;
  kind: TemplateKind;
  category: TemplateCategory;
  /** The full `prompt.md`: text an agent will follow. */
  prompt: string;
  state: PackPreviewItemState;
  /** Skills the template recommends that are neither on this computer nor in the pack. */
  missingSkills: string[];
}

export interface PackPreviewSkill {
  id: string;
  name: string;
  description: string;
  /** The full `SKILL.md`. */
  content: string;
  fileCount: number;
  state: PackPreviewItemState;
}

export interface PackPreviewLibraryItem {
  file: string;
  name: string;
  library: LibraryName;
  /** Brand kind (`image`, `color`, …) or glossary kind (`transcription`, `translation`). */
  kind: string;
  size: number;
  /** Already in the library with the same content: not added again. */
  duplicate: boolean;
}

/** Why a line was flagged (pack-scan.ts). */
export type PackScanReason =
  | 'too-long'
  | 'ignore-instructions'
  | 'change-identity'
  | 'reveal-secrets'
  | 'credential'
  | 'command'
  | 'delete-work'
  | 'send-url'
  | 'prompt-boundary';

/** One flagged line. `line` 0 is the whole text (too long). */
export interface PackScanHit {
  line: number;
  /** The line, trimmed and cut to 120 characters. */
  text: string;
  why: PackScanReason;
}

/** A flagged line in a file of the pack: blocking for the style guide, reference titles and notes and quick actions; a warning for template prompts and `SKILL.md`. */
export interface PackFileHit extends PackScanHit {
  /** Pack-relative path, or `pack.json#quickActions[2]` / `pack.json#examples[0]` for manifest text. */
  file: string;
}

export type PackWarning = ({ kind: 'scan' } & PackFileHit) | { kind: 'missing-skill'; template: string; skill: string };

export interface PackPreview {
  /** Pass to `packs.install`: what is installed is exactly what was read. */
  token: string;
  expiresAt: string;
  manifest: Omit<PackManifest, 'files'>;
  source: PackSource;
  /** The version already installed under this id, or null. */
  installed: { version: string } | null;
  templates: PackPreviewTemplate[];
  skills: PackPreviewSkill[];
  library: PackPreviewLibraryItem[];
  style: { text: string; hits: PackScanHit[] } | null;
  examples: PackExample[];
  quickActions: (PackQuickAction & { hits: PackScanHit[] })[];
  reserved: PackReservedTexts;
  warnings: PackWarning[];
  /** Non-empty: the pack will not install (`PACK_BLOCKED`). */
  blocked: PackFileHit[];
  /** Whether an item clashes with one of the user's own (shows "Install and replace mine"). */
  clashes: boolean;
  files: number;
  bytes: number;
}

/** After install or restore: the pack, what was skipped, and the full list. */
export interface PackChangeResult extends PackListResult {
  pack: PackSummary;
  /** Items not written: built-in clashes always, the user's own and changed ones unless `replace`. */
  skipped: (PackItemRef & { reason: 'builtin' | 'exists' | 'changed' })[];
}

export interface PackRemoveResult extends PackListResult {
  removed: PackRef;
  /** Pass to `packs.restore` (Undo). */
  trashId: string;
  /** Items left in place because they changed since install. */
  kept: PackItemRef[];
  /** What went to the trash with the pack. */
  moved: { templates: number; skills: number };
}

/** `packs.removeExample`: the pack page after the removal, and the trash entry that `packs.restoreExample` brings back (kept 24 hours). */
export interface PackExampleRemoveResult extends PackDetail {
  trashId: string;
}

// ---- Style ----

/**
 * Why a style guide is (or isn't) active, in resolution order (pack spec §7):
 * - `chosen`: the project chose this pack; `chosen-none`: the project chose none; `chosen-missing`: the project chose a pack that is no longer installed;
 * - `template`: the conversation used a template this pack owns;
 * - `only`: the only installed pack with a guide;
 * - `ambiguous`: several packs have a guide and nothing chooses between them; `no-guide`: no installed pack has one.
 */
export const PACK_STYLE_REASONS = ['chosen', 'chosen-none', 'chosen-missing', 'template', 'only', 'ambiguous', 'no-guide'] as const;
export type PackStyleReason = (typeof PACK_STYLE_REASONS)[number];

export interface PackActiveStyle {
  pack: PackRef | null;
  reason: PackStyleReason;
}

/** A project's choice: a pack id, `'none'`, or null (decide on its own). */
export type PackStyleChoice = string | 'none' | null;

export interface PackChooseResult {
  choice: PackStyleChoice;
  active: PackActiveStyle;
}

// ---- Export ----

export interface PackExportParams {
  /** The target folder (absolute). Must be empty or an earlier export of the same id. */
  dir: string;
  manifest: { id: string; name: string; version?: string; author?: string; description?: string; license?: string };
  templates: string[];
  skills: string[];
  library: { library: Exclude<LibraryName, 'voices'>; id: string }[];
  quickActions: PackQuickAction[];
  /** An installed pack whose style guide and reference files travel. */
  stylePack?: string;
}

export interface PackExportResult {
  dir: string;
  files: number;
  bytes: number;
}

