/**
 * Structural check of a design system (the `design_system_check` tool, docs/design/canvas §10.5). Reads files only, renders nothing, and checks item by item against the original format (the design-system skill's
 * SKILL.md and references/format.md; constants taken from the original runtime):
 *   - design-system.json: v3, `layout: "files"`, the `createdOnFiles` / `convertedFrom` marker (without it the editor is read-only), not the old single-file envelope,
 *     the shape of each field, `namespace`, `libraries`, `groups` and `assetGroups`, asset records (`{name, blob, size, type}`, blob in `_blobs/`)
 *   - tokens.json: syntax, list shape and limits (tokens-check.ts)
 *   - path rules (`explainDesignSystemPath` in layout.ts), file count (own ≤1,008), total ≤256 MiB, single file ≤15 MiB
 *   - size by category: README ≤200 KB, section *.md ≤512 KB each and at most 24, component README ≤64 KB, preview.html ≤256 KB, bundle.js ≤6 MB,
 *     bundle.css ≤2 MB, *.d.ts ≤1.5 MB in total, lib/*.js ≤2 MB each, src/** ≤512 KB each, assets/<group>/<file> ≤12 MB each, anything else ≤512 KB
 *     (original `DESIGN_SYSTEM_INLINE_LIMITS`; the original editor no longer caps the files layout by category, but format.md still lists them as format rules, so this follows format.md)
 *   - preview.html: first line `<!-- @dsCard … -->`, no iframe / frame / object / embed / portal / noscript, no links to bundle.js or libraries
 *   - bundle.js: classic script (no import / export), assigns `window.<namespace>`, no network access, no `</script` or `<!--`; the `@ds-bundle` header line
 *   - fonts: only woff2 / woff / ttf / otf in fonts/, extension matches the file header, everything listed in tokens.json `type.fonts` exists and everything present is listed
 *   - scripts, styles and images in previews and lib/ that point to the web (CucCut's CSP does not allow CDNs, §10.2); every `/_blob/<id>` reference exists in `_blobs/`
 * manifest.json, tokens.css and api/ are generated when the editor saves and are not checked (`notChecked`). Whether components render is out of scope. Issues are English text for agents and do not go into the UI copy catalogs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { BLOB_ID_PATTERN } from '@cuccut/slides';
import {
  BLOBS_DIR,
  COMPONENT_NAME_PATTERN,
  DESIGN_SYSTEM_FILE,
  DESIGN_SYSTEM_LIMITS,
  DESIGN_SYSTEM_PATHS,
  EDITOR_OWN_FILES,
  GENERATED_API_PATH_PATTERN,
  GENERATED_TOKENS_CSS_PATH,
  MAX_DESIGN_SYSTEM_INDEX_CHARS,
  WINDOW_NAMESPACE_PATTERN,
  designSystemTitle,
  explainDesignSystemPath,
  hasDesignSystemMarker,
  isDesignSystemIndex,
  isRecord,
} from './layout.ts';
import { TOKENS_LIMITS, checkTokensText, tokenFontFiles } from './tokens-check.ts';

export interface DesignSystemIssue {
  /** File relative to the design system directory (`/`-separated); issues about the whole directory use `.`. */
  file: string;
  message: string;
  /** The few issues that need handling by kind carry a code (`DESIGN_SYSTEM_ISSUE_CODES`); the rest have none. */
  code?: DesignSystemIssueCode;
}

/**
 * Issues with a code:
 * - `ASSET_RECORD_MISSING_UPLOAD`: an asset record in the index (`assetGroups.<group>.files.*` or `blobs.*`) points to an upload that is not in `_blobs/`,
 *   and there is no file at the path it restores to either, so the asset cannot be opened in the editor (`/_blob/<id>` returns 404).
 */
export const DESIGN_SYSTEM_ISSUE_CODES = ['ASSET_RECORD_MISSING_UPLOAD'] as const;
export type DesignSystemIssueCode = (typeof DESIGN_SYSTEM_ISSUE_CODES)[number];

export interface DesignSystemCheckResult {
  /** Title from the index (the directory name when missing). */
  title: string;
  /** The index's `namespace` (null when missing or invalid). */
  namespace: string | null;
  issues: DesignSystemIssue[];
  /**
   * Notes: things the original reads fine and that need no change, but that the editor does not show or will rewrite (keys in tokens.json that are not token families; asset records whose path already has a file:
   * the file wins and the editor drops the record on its next save). Not issues; the check still passes when `issues` is empty.
   */
  notes: DesignSystemIssue[];
  /** Files generated when the editor saves; not checked. */
  notChecked: string[];
}

/** Generated files that are not checked (§10.5). */
export const DESIGN_SYSTEM_NOT_CHECKED = [DESIGN_SYSTEM_PATHS.manifest, GENERATED_TOKENS_CSS_PATH, 'api/'] as const;

const KIB = 1024;
const MIB = 1024 * 1024;
/** Size limits by category (original `DESIGN_SYSTEM_INLINE_LIMITS`). */
export const DESIGN_SYSTEM_FILE_LIMITS = {
  readme: 200 * KIB,
  tokens: 512 * KIB,
  bundleJs: 6 * MIB,
  bundleCss: 2 * MIB,
  dtsTotal: 1.5 * MIB,
  preview: 256 * KIB,
  componentReadme: 64 * KIB,
  componentLib: 2 * MIB,
  asset: 12 * MIB,
  other: 512 * KIB,
} as const;
/** At most how many sections (*.md other than README) are shown (original `MAX_DISPLAYED_DOCUMENTS`). */
export const MAX_SECTION_DOCUMENTS = 24;

/** At most this many entries are looked at when scanning the directory (beyond that only the file-count limit is reported). */
const MAX_SCAN_ENTRIES = 20_000;
/** Read limit for checking content: anything larger is only reported by size. */
const MAX_READ_BYTES = 8 * MIB;
const FONT_EXTENSIONS: Record<string, string> = { woff2: 'WOFF2', woff: 'WOFF', ttf: 'TrueType', otf: 'OpenType' };
const FORBIDDEN_PREVIEW_ELEMENTS = ['iframe', 'frame', 'object', 'embed', 'portal', 'noscript'];
/** Original `COMPONENT_CARD_HEADER_PATTERN`. */
const CARD_HEADER_PATTERN = /^[ \t]*<!--\s*@dsCard\b((?:(?!--)[^\r\n])*)(?:[\r\n]\s*)?-->/;
const ASSET_TILE_SIZES = new Set(['xs', 's', 'm', 'l', 'xl']);
const MAX_ASSET_GROUP_NAME_LENGTH = 80;
const RESERVED_PROTOTYPE_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const TEXT_EXTENSIONS = new Set(['md', 'mdx', 'markdown', 'txt', 'json', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'svg', 'xml', 'csv', 'yml', 'yaml', 'toml']);
/** The original `blob` record only accepts ids handed out by uploads; CucCut ids are 32 lowercase hex characters (docs/design/canvas §2.1). */
const BLOB_ID = BLOB_ID_PATTERN;

type FileKind =
  | 'index'
  | 'own'
  | 'generated'
  | 'readme'
  | 'tokens'
  | 'doc'
  | 'bundleJs'
  | 'bundleCss'
  | 'dts'
  | 'preview'
  | 'componentReadme'
  | 'componentSource'
  | 'componentLib'
  | 'componentOther'
  | 'font'
  | 'asset'
  | 'archived'
  | 'other';

function extensionOf(rel: string): string {
  const base = rel.slice(rel.lastIndexOf('/') + 1).toLowerCase();
  if (base.endsWith('.d.ts')) return 'd.ts';
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1);
}

/** Original `isAdditionalMarkdownPath`, additionally excluding the generated api/ cards. */
function isSectionDocument(rel: string): boolean {
  return (
    rel !== DESIGN_SYSTEM_PATHS.readme &&
    !rel.startsWith(DESIGN_SYSTEM_PATHS.componentsDir) &&
    !rel.startsWith(DESIGN_SYSTEM_PATHS.assetsDir) &&
    !rel.startsWith(DESIGN_SYSTEM_PATHS.fontsDir) &&
    !rel.startsWith(DESIGN_SYSTEM_PATHS.archivedDir) &&
    !GENERATED_API_PATH_PATTERN.test(rel) &&
    /\.(?:mdx?|markdown)$/i.test(rel)
  );
}

/** Original `classifyDesignSystemFile`, additionally separating the index, the editor's own files, generated files and archived/. */
function classify(rel: string): FileKind {
  if (rel === DESIGN_SYSTEM_FILE) return 'index';
  if ((EDITOR_OWN_FILES as readonly string[]).includes(rel)) return 'own';
  if (rel === DESIGN_SYSTEM_PATHS.manifest || rel === GENERATED_TOKENS_CSS_PATH || rel.startsWith('api/')) return 'generated';
  if (rel === DESIGN_SYSTEM_PATHS.readme) return 'readme';
  if (rel === DESIGN_SYSTEM_PATHS.tokens) return 'tokens';
  if (rel.startsWith(DESIGN_SYSTEM_PATHS.archivedDir)) return 'archived';
  if (isSectionDocument(rel)) return 'doc';
  if (rel === DESIGN_SYSTEM_PATHS.bundleJs) return 'bundleJs';
  if (rel === DESIGN_SYSTEM_PATHS.bundleCss) return 'bundleCss';
  if (rel.startsWith(DESIGN_SYSTEM_PATHS.componentsDir)) {
    if (rel.startsWith(DESIGN_SYSTEM_PATHS.libDir)) return 'componentLib';
    if (extensionOf(rel) === 'd.ts') return 'dts';
    const parts = rel.slice(DESIGN_SYSTEM_PATHS.componentsDir.length).split('/');
    if (parts.length === 2 && parts[1] === 'preview.html') return 'preview';
    if (parts.length === 2 && parts[1] === 'README.md') return 'componentReadme';
    if (parts[0] === 'src' && parts.length >= 2) return 'componentSource';
    return 'componentOther';
  }
  if (rel.startsWith(DESIGN_SYSTEM_PATHS.fontsDir)) return 'font';
  if (rel.startsWith(DESIGN_SYSTEM_PATHS.assetsDir)) return 'asset';
  if (extensionOf(rel) === 'd.ts') return 'dts';
  return 'other';
}

/** Limit and wording for each category; null for categories without their own limit (only the 15 MiB per-file limit applies). */
function limitOf(kind: FileKind): { bytes: number; label: string } | null {
  switch (kind) {
    case 'readme':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.readme, label: 'README.md' };
    case 'tokens':
      return { bytes: TOKENS_LIMITS.bytes, label: 'tokens.json' };
    case 'doc':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.other, label: 'a section document' };
    case 'bundleJs':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.bundleJs, label: 'bundle.js' };
    case 'bundleCss':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.bundleCss, label: 'bundle.css' };
    case 'preview':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.preview, label: 'a preview.html' };
    case 'componentReadme':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.componentReadme, label: "a component's README.md" };
    case 'componentLib':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.componentLib, label: 'a components/lib/ file' };
    case 'componentSource':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.other, label: 'a components/src/ file' };
    case 'componentOther':
    case 'other':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.other, label: 'a file the format has no place for' };
    case 'asset':
      return { bytes: DESIGN_SYSTEM_FILE_LIMITS.asset, label: 'an asset' };
    default:
      return null;
  }
}

interface SystemTree {
  /** Files the editor can see (relative path) -> byte size. Excludes `_blobs/`. */
  files: Map<string, number>;
  /** Asset ids in `_blobs/`. */
  blobs: Set<string>;
  /** Total bytes of files outside `_blobs/`. */
  totalBytes: number;
  truncated: boolean;
}

async function scanTree(dir: string, issues: DesignSystemIssue[]): Promise<SystemTree> {
  const tree: SystemTree = { files: new Map(), blobs: new Set(), totalBytes: 0, truncated: false };
  let seen = 0;
  const visit = async (rel: string): Promise<void> => {
    const full = rel === '' ? dir : path.join(dir, ...rel.split('/'));
    const entries = await fs.readdir(full, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (++seen > MAX_SCAN_ENTRIES) {
        tree.truncated = true;
        return;
      }
      // Dotfiles (.DS_Store, .git) are invisible to the editor and rejected by the original format: not listed, not reported
      if (entry.name.startsWith('.')) continue;
      const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (rel === '' && entry.name === BLOBS_DIR && entry.isDirectory()) {
        await scanBlobs(path.join(dir, BLOBS_DIR), tree);
        continue;
      }
      if (entry.isSymbolicLink()) {
        issues.push({ file: child, message: 'is a symbolic link; the editor ignores symbolic links. Replace it with a regular file or folder' });
        continue;
      }
      if (child !== DESIGN_SYSTEM_FILE) {
        const reason = explainDesignSystemPath(child);
        if (reason !== null) {
          issues.push({ file: child, message: `${reason}. The editor can't see it` });
          continue;
        }
      }
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) {
        const stat = await fs.lstat(path.join(full, entry.name)).catch(() => null);
        const size = stat?.size ?? 0;
        tree.files.set(child, size);
        tree.totalBytes += size;
      }
    }
  };
  await visit('');
  return tree;
}

async function scanBlobs(dir: string, tree: SystemTree): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const id = entry.name.split('.')[0]!;
    if (BLOB_ID.test(id)) tree.blobs.add(id);
  }
}

const isRemote = (url: string) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url.trim()) && !/^data:/i.test(url.trim());
const isGoogleFonts = (url: string) => /^(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com\//i.test(url.trim());

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)"|([^\\s>]+))`, 'i').exec(attrs);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/** `/_blob/<id>` references in text: ids missing from `_blobs/` or malformed are recorded as issues. */
function checkBlobRefs(file: string, text: string, blobs: ReadonlySet<string>, issues: DesignSystemIssue[]): void {
  const reported = new Set<string>();
  for (const match of text.matchAll(/\/_blob\/([^\s"'()<>?#`\\]*)/g)) {
    const id = match[1]!;
    if (reported.has(id)) continue;
    reported.add(id);
    if (!BLOB_ID.test(id)) {
      issues.push({ file, message: `/_blob/${id} is not a valid upload reference: use the /_blob/<id> that design_system_import_asset returned (32 lowercase hex digits)` });
    } else if (!blobs.has(id)) {
      issues.push({ file, message: `/_blob/${id} is not in ${BLOBS_DIR}/: import the file with design_system_import_asset and use the src it returns` });
    }
  }
}

const NO_CDN = 'CucCut previews load nothing from the network but Google Fonts (no CDN in the page CSP)';

/** Loads in scripts that point to the web: `import()`, `fetch()`, `importScripts()`, assigning a URL to `src`, `<script src>` strings. */
function remoteScriptLoads(code: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\bimportScripts\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\bfetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\.src\s*=\s*['"`]([^'"`]+)['"`]/g,
    /<script\b[^>]*\bsrc\s*=\s*\\?['"]([^'"\\]+)/gi,
    /^\s*import\s+(?:[\w$*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const url = match[1]!;
      if (isRemote(url) && !isGoogleFonts(url) && !urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

/** `@import` and `url()` in CSS that point to the web (Google Fonts excepted). */
function remoteCssLoads(css: string): string[] {
  const urls: string[] = [];
  for (const match of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) urls.push(match[1]!);
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) urls.push((match[1] ?? match[2] ?? match[3] ?? '').trim());
  return [...new Set(urls.filter(url => isRemote(url) && !isGoogleFonts(url)))];
}

/** One preview.html: header line, forbidden elements, links to bundle.js and libraries, scripts / styles / images pointing to the web. */
function checkPreview(file: string, html: string, issues: DesignSystemIssue[]): void {
  const add = (message: string) => issues.push({ file, message });
  const text = html.replace(/^\uFEFF/, '');
  if (!CARD_HEADER_PATTERN.test(text)) {
    add('line 1 must be the marker <!-- @dsCard group="…" height=N … --> (height 40–4000); without it the card has no group or height');
  }
  const markup = text.replace(/<!--[\s\S]*?-->/g, comment => ' '.repeat(comment.length));
  const forbidden = new Set<string>();
  for (const match of markup.matchAll(/<([A-Za-z][A-Za-z0-9-]*)\b/g)) {
    const name = match[1]!.toLowerCase();
    if (FORBIDDEN_PREVIEW_ELEMENTS.includes(name)) forbidden.add(name);
  }
  for (const name of forbidden) add(`uses <${name}>; a preview may not contain <iframe>, <frame>, <object>, <embed>, <portal> or <noscript>`);
  for (const match of markup.matchAll(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi)) {
    const src = attr(match[1] ?? '', 'src');
    if (src !== null) {
      const clean = src.trim();
      if (isRemote(clean)) add(`loads the script ${clean} from the network; ${NO_CDN}. Copy the library into components/lib/ and list it in the index's libraries`);
      else if (/(?:^|\/)(?:bundle\.js|lib\/[^/]+\.js|_vendor\/)/.test(clean.split(/[?#]/)[0]!)) {
        add(`links ${clean}; bundle.js and the libraries are preloaded in every preview, and a preview that links them doesn't load. Remove the <script src>`);
      }
    }
    for (const url of remoteScriptLoads(match[2] ?? '')) add(`its script loads ${url} from the network; ${NO_CDN}`);
  }
  for (const match of markup.matchAll(/<link\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const href = attr(match[1] ?? '', 'href');
    if (href !== null && isRemote(href) && !isGoogleFonts(href)) add(`links ${href.trim()} from the network; ${NO_CDN}`);
  }
  for (const match of markup.matchAll(/<(?:img|source|video|audio)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const src = attr(match[1] ?? '', 'src');
    if (src !== null && isRemote(src)) add(`loads ${src.trim()} from the network; ${NO_CDN}. Put the file under assets/ and use a relative path, or import it with design_system_import_asset`);
  }
  for (const match of markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    for (const url of remoteCssLoads(match[1] ?? '')) add(`its style loads ${url} from the network; ${NO_CDN}`);
  }
}

/** The `@ds-bundle` header line of bundle.js (original `parseBundleHeader`): null when missing, 'invalid' when malformed. */
function bundleHeader(script: string): { namespace: string | null } | 'invalid' | null {
  const prefix = script.slice(0, 262144);
  const offset = prefix.indexOf('@ds-bundle:');
  if (offset < 0) return null;
  const start = prefix.lastIndexOf('/*', offset);
  const end = prefix.indexOf('*/', offset);
  if (start < 0 || end < 0 || prefix.slice(0, start).trim() !== '') return 'invalid';
  try {
    const header: unknown = JSON.parse(prefix.slice(offset + 11, end).trim());
    if (!isRecord(header)) return 'invalid';
    const ns = header.namespace;
    return { namespace: typeof ns === 'string' && WINDOW_NAMESPACE_PATTERN.test(ns) ? ns : null };
  } catch {
    return 'invalid';
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** bundle.js: classic script, assigns `window.<namespace>`, no network access, no `</script` or `<!--`. */
function checkBundle(file: string, code: string, namespace: string | null, issues: DesignSystemIssue[]): void {
  const add = (message: string) => issues.push({ file, message });
  if (/^\s*import\s*(?:[\w$*{},\s]+\s*from\s*)?['"]|^\s*export\s+(?:default\b|\{|\*|const\b|let\b|var\b|function\b|class\b|async\b)|\bimport\.meta\b|\bimport\s*\(/m.test(code)) {
    add('is not a classic script: it uses import / export; bundle it into ONE classic script (an IIFE) that reads window.React and window.ReactDOM');
  }
  if (/<\/script/i.test(code)) add('contains a literal </script, which ends the inline <script> previews and consumers put it in; write it "<\\/script"');
  if (code.includes('<!--')) add('contains a literal <!--, which can escape the inline <script> previews and consumers put it in; write it "\\x3C!--"');
  if (/\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+(?:WebSocket|EventSource)\s*\(|\bsendBeacon\s*\(|\bimportScripts\s*\(/.test(code)) {
    add('makes network requests (fetch / XMLHttpRequest / WebSocket / EventSource / sendBeacon); the bundle fetches nothing');
  }
  const header = bundleHeader(code);
  if (header === 'invalid') add('line 1 has an @ds-bundle header that is not /* @ds-bundle: {JSON} */ at the very start; fix it or remove it');
  const declared = header !== null && header !== 'invalid' ? header.namespace : null;
  if (declared !== null && namespace !== null && declared !== namespace) {
    add(`its @ds-bundle header names the namespace ${declared}, but design-system.json says ${namespace}; make them the same`);
  }
  const ns = namespace ?? declared;
  if (ns === null) return;
  const body = header !== null && header !== 'invalid' ? code.slice(code.indexOf('*/') + 2) : code;
  const name = escapeRegExp(ns);
  if (!new RegExp(`\\.\\s*${name}\\b|\\[\\s*['"\`]${name}['"\`]\\s*\\]|\\bvar\\s+${name}\\b`).test(body)) {
    add(`never assigns window.${ns}: the bundle must set window.${ns} = { …components } (the index's namespace)`);
  }
}

/** Font files: extension and file header (woff2 `wOF2`, woff `wOFF`, the sfnt header for ttf / otf). */
async function checkFont(dir: string, file: string, issues: DesignSystemIssue[]): Promise<void> {
  const ext = extensionOf(file);
  const format = FONT_EXTENSIONS[ext];
  if (format === undefined) {
    issues.push({ file, message: 'fonts/ holds font files only (woff2, woff, ttf, otf); move it elsewhere' });
    return;
  }
  const handle = await fs.open(path.join(dir, ...file.split('/')), 'r').catch(() => null);
  if (handle === null) return;
  try {
    const head = Buffer.alloc(4);
    const { bytesRead } = await handle.read(head, 0, 4, 0);
    const magic = head.subarray(0, bytesRead).toString('latin1');
    const sfnt = magic === '\u0000\u0001\u0000\u0000' || magic === 'OTTO' || magic === 'true' || magic === 'typ1';
    const ok = ext === 'woff2' ? magic === 'wOF2' : ext === 'woff' ? magic === 'wOFF' : sfnt;
    if (!ok) issues.push({ file, message: `is not a ${format} font: its first bytes don't match a .${ext} file. Use the real font file` });
  } finally {
    await handle.close();
  }
}

/** Original `isAssetGroupName`: folder name of an asset group. */
export function isAssetGroupName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_ASSET_GROUP_NAME_LENGTH &&
    !/[/\\\u0000-\u001f\u007f]/.test(name) &&
    name !== '.' &&
    name !== '..' &&
    !RESERVED_PROTOTYPE_NAMES.has(name) &&
    name.trim() === name
  );
}

/** Index keys: UTF-8 bytes outside `[A-Za-z0-9_./-]` are written as `~` plus two lowercase hex digits (original `encodeFileIndexKey`). */
export function encodeIndexKey(key: string): string {
  let encoded = '';
  for (const byte of Buffer.from(key, 'utf8')) {
    const ch = String.fromCharCode(byte);
    encoded += byte < 128 && /[A-Za-z0-9_./-]/.test(ch) ? ch : `~${byte.toString(16).padStart(2, '0')}`;
  }
  return encoded;
}

/** Inverse of `encodeIndexKey` (original `decodeFileIndexKey`): `~` plus two hex digits back to bytes; returned unchanged when malformed. */
export function decodeIndexKey(key: string): string {
  if (!key.includes('~')) return key;
  const bytes: number[] = [];
  for (let i = 0; i < key.length; i++) {
    const hex = key[i] === '~' ? key.slice(i + 1, i + 3) : '';
    if (/^[0-9a-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      for (const byte of Buffer.from(key[i]!, 'utf8')) bytes.push(byte);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

interface IndexContext {
  tree: SystemTree;
  add: (message: string, code?: DesignSystemIssueCode) => void;
  /** Records whose path already has a file (the file wins, see `checkRecord`): combined into a single note at the end. */
  shadowed: string[];
  /** Paths restored from records whose upload is also in `_blobs/`: visible in the editor, counted as files (e.g. fonts listed in tokens.json). */
  restored: Set<string>;
}

/**
 * One asset record `{name, blob, size, type}`; `where` is its position in the index, `filePath` the path it restores to.
 * When opening, the original reads the files first and then restores records (`restoreFilesFromIndex`): if the path already has a file, the file wins, the record is skipped and dropped from the index on the next save
 * (`buildFilesIndex` only writes records for files that are still uploads). Design systems exported by the original look exactly like this: assets are written as files under `assets/<group>/<name>`, the index's
 * records are kept as they are, and there is no `_blobs/`. So such a record only gets a note; it is an issue only when the path has no file and the upload is not in `_blobs/` either.
 */
function checkRecord(ctx: IndexContext, where: string, record: unknown, filePath: (name: string) => string): void {
  const { add, shadowed, restored, tree } = ctx;
  if (!isRecord(record)) {
    add(`${where}: each record is {"name","blob","size","type"}`);
    return;
  }
  const { name, blob, size, type } = record;
  if (typeof name !== 'string' || name === '') {
    add(`${where}: "name" must be the file's path (below the group folder for a group's files)`);
    return;
  }
  const target = filePath(name);
  const reason = explainDesignSystemPath(target);
  if (reason !== null) add(`${where}: ${target} ${reason}; the editor skips the record`);
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) add(`${where}: "size" must be the file's size in bytes`);
  if (typeof type !== 'string' || !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(type)) add(`${where}: "type" must be the file's media type`);
  if (reason === null && tree.files.has(target)) {
    shadowed.push(target);
    return;
  }
  if (typeof blob !== 'string' || !BLOB_ID.test(blob)) {
    add(`${where}: "blob" must be the upload's id (the 32 hex digits after /_blob/ that design_system_import_asset returned)`);
  } else if (tree.blobs.has(blob)) {
    if (reason === null) restored.add(target);
  } else {
    add(
      `${where}: the upload ${blob} is not in ${BLOBS_DIR}/ and there is no file at ${target}, so the asset can't be shown. Put the file at ${target} (and delete the record), or import it with design_system_import_asset`,
      'ASSET_RECORD_MISSING_UPLOAD',
    );
  }
}

/** Fields of design-system.json (markers, shape, namespace, libraries, groups, assetGroups, blobs, docs). */
function checkIndex(index: Record<string, unknown>, ctx: IndexContext, note: (message: string) => void): void {
  checkIndexFields(index, ctx, note);
  const { shadowed } = ctx;
  if (shadowed.length > 0) {
    note(
      `${shadowed.length} asset ${shadowed.length === 1 ? 'record points' : 'records point'} at a path that is a file (${shadowed.slice(0, 3).join(', ')}${shadowed.length > 3 ? ', …' : ''}): the files are used and the records ignored, as in an exported system; the editor drops the records when it next rewrites the index`,
    );
  }
}

/**
 * Shape of each index field. When opening (`restoreFilesFromIndex`) the original reads missing fields as empty values (`libraries` [], `groups` [], `assetGroups` {},
 * `blobs` {}, `sections` {}; a group without `name` takes it from its key), so only fields that are present are checked: a freshly created index with only the marker, title and
 * namespace has no issues. `docs` is written by the editor on save and not read by the original; only its shape is checked.
 */
function checkIndexFields(index: Record<string, unknown>, ctx: IndexContext, note: (message: string) => void): void {
  const { add, tree } = ctx;
  if (isRecord(index.content)) {
    add('has a "content" object: that is the old one-file envelope, not a files index. Move the files out of it into the folder');
  }
  if (!hasDesignSystemMarker(index)) {
    add('has no createdOnFiles or convertedFrom marker: the editor opens it read-only. A system you start gets "createdOnFiles": {"v": 1, "at": "<ISO time>"}');
  }
  if (Object.hasOwn(index, 'title') && typeof index.title !== 'string') add('"title" must be a string (the system\'s name)');
  else if (typeof index.title !== 'string' || index.title.trim() === '') note('has no "title": the system is shown under its folder name; the title is the system\'s name');
  if (Object.hasOwn(index, 'namespace') && (typeof index.namespace !== 'string' || !WINDOW_NAMESPACE_PATTERN.test(index.namespace))) {
    add('"namespace" must be the bundle\'s global: a JavaScript identifier of at most 64 characters (not __proto__, constructor or prototype)');
  }
  if (Object.hasOwn(index, 'libraries') && !Array.isArray(index.libraries)) add('"libraries" must be a list ([] when there is no bundle)');
  else if (Array.isArray(index.libraries)) {
    index.libraries.forEach((library, i) => {
      const where = `libraries[${i}]`;
      if (!isRecord(library) || typeof library.name !== 'string' || typeof library.version !== 'string') {
        add(`${where}: each library is {"name","version","global"?,"file"?}`);
        return;
      }
      const file = library.file;
      if (file !== undefined) {
        if (typeof file !== 'string' || !file.startsWith(DESIGN_SYSTEM_PATHS.libDir)) add(`${where}: "file" must be a path under ${DESIGN_SYSTEM_PATHS.libDir}`);
        else if (!tree.files.has(file)) add(`${where}: ${file} is not in the system`);
        if (library.global !== undefined && (typeof library.global !== 'string' || !WINDOW_NAMESPACE_PATTERN.test(library.global))) {
          add(`${where}: "global" must be the window global the library defines`);
        }
      } else if (library.name !== 'react' && library.name !== 'react-dom') {
        add(`${where}: ${library.name} has no "file", so previews can't load it (${NO_CDN}); copy it into ${DESIGN_SYSTEM_PATHS.libDir} and set "file" and "global"`);
      }
    });
  }
  if (Object.hasOwn(index, 'sections') && (!isRecord(index.sections) || Object.values(index.sections).some(v => typeof v !== 'string'))) {
    add('"sections" must be an object of card titles ({} in a new index)');
  }
  // Keys in groups need not be in assetGroups (the original skips them; a group that is only a folder has no entry)
  if (Object.hasOwn(index, 'groups') && (!Array.isArray(index.groups) || index.groups.some(g => typeof g !== 'string'))) {
    add('"groups" must be a list of asset group keys');
  }
  if (Object.hasOwn(index, 'assetGroups') && !isRecord(index.assetGroups)) add('"assetGroups" must be an object keyed by group');
  for (const [key, group] of Object.entries(isRecord(index.assetGroups) ? index.assetGroups : {})) {
    const where = `assetGroups.${key}`;
    if (!isRecord(group)) {
      add(`${where}: each group is {"name","order","files","tile"?}`);
      continue;
    }
    const name = group.name === undefined ? decodeIndexKey(key) : group.name;
    if (!isAssetGroupName(name)) {
      add(`${where}: "name" must be the group folder's name (at most ${MAX_ASSET_GROUP_NAME_LENGTH} characters, no slashes or control characters)`);
      continue;
    }
    if (group.order !== undefined && (!Array.isArray(group.order) || group.order.some(n => typeof n !== 'string'))) add(`${where}: "order" must be a list of file names`);
    if (group.tile !== undefined && !ASSET_TILE_SIZES.has(group.tile as string)) add(`${where}: "tile" is one of "xs", "s", "m", "l", "xl"`);
    if (group.files === undefined) continue;
    if (!isRecord(group.files)) {
      add(`${where}: "files" must be an object of upload records ({} when the group's files are files)`);
      continue;
    }
    for (const [fileKey, record] of Object.entries(group.files)) {
      checkRecord(ctx, `${where}.files.${fileKey}`, record, n => `${DESIGN_SYSTEM_PATHS.assetsDir}${name}/${n}`);
    }
  }
  if (Object.hasOwn(index, 'blobs') && !isRecord(index.blobs)) add('"blobs" must be an object ({} in a new index)');
  for (const [key, record] of Object.entries(isRecord(index.blobs) ? index.blobs : {})) checkRecord(ctx, `blobs.${key}`, record, n => n);
  const docs = index.docs;
  if (
    docs !== undefined &&
    (!isRecord(docs) ||
      (docs.sections !== undefined && (!Array.isArray(docs.sections) || docs.sections.some(s => typeof s !== 'string'))) ||
      (docs.readme !== undefined && typeof docs.readme !== 'string'))
  ) {
    add('"docs" must be {"readme"?, "sections": […]} ({"sections": []} in a new index)');
  }
}

async function readText(dir: string, rel: string): Promise<string | null> {
  return fs.readFile(path.join(dir, ...rel.split('/')), 'utf8').catch(() => null);
}

/**
 * Checks a design system directory. Issues are given per file; `file` `.` means an issue with the whole directory. When it is not a design system (no index, or not §10.1)
 * the remaining files are still checked and one issue is reported for design-system.json.
 */
export async function checkDesignSystem(dir: string): Promise<DesignSystemCheckResult> {
  const issues: DesignSystemIssue[] = [];
  const notes: DesignSystemIssue[] = [];
  const tree = await scanTree(dir, issues);
  const notChecked = [...DESIGN_SYSTEM_NOT_CHECKED];

  // Index
  let index: Record<string, unknown> | null = null;
  const indexText = tree.files.has(DESIGN_SYSTEM_FILE) ? await readText(dir, DESIGN_SYSTEM_FILE) : null;
  const addIndex = (message: string, code?: DesignSystemIssueCode) => issues.push({ file: DESIGN_SYSTEM_FILE, message, ...(code ? { code } : {}) });
  const noteIndex = (message: string) => notes.push({ file: DESIGN_SYSTEM_FILE, message });
  if (indexText === null) {
    addIndex('missing: a design system needs design-system.json with "v": 3, "layout": "files" and a createdOnFiles marker, written last');
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(indexText);
    } catch (error) {
      addIndex(`is not valid JSON: ${(error as Error).message}`);
    }
    // A marker alone is recognized (original `isFilesIndex`), but authors should write the full format; an old envelope with a "content" object is not recognized, yet each item is still checked and the reason is stated.
    const envelope = isRecord(parsed) && isRecord(parsed.content);
    const fields = isRecord(parsed) && (envelope || isDesignSystemIndex(parsed)) ? parsed : null;
    if (parsed !== undefined && (!fields || typeof fields.v !== 'number' || fields.v < 3 || fields.layout !== 'files')) {
      addIndex('must be an object with "v": 3 and "layout": "files"');
    }
    if (fields) index = fields;
    if (indexText.length > MAX_DESIGN_SYSTEM_INDEX_CHARS) addIndex(`has ${indexText.length} characters; the editor reads at most ${MAX_DESIGN_SYSTEM_INDEX_CHARS}`);
  }
  const restored = new Set<string>();
  if (index) checkIndex(index, { tree, add: addIndex, shadowed: [], restored }, noteIndex);
  const namespace = index && typeof index.namespace === 'string' && WINDOW_NAMESPACE_PATTERN.test(index.namespace) ? index.namespace : null;

  // File count and sizes
  let ownFiles = 0;
  let dtsTotal = 0;
  const sections: string[] = [];
  for (const [file, bytes] of tree.files) {
    const kind = classify(file);
    ownFiles++;
    if (bytes > DESIGN_SYSTEM_LIMITS.fileBytes) {
      issues.push({ file, message: `is ${bytes} bytes; a file can be at most ${DESIGN_SYSTEM_LIMITS.fileBytes} (15 MiB)` });
      continue;
    }
    if (kind === 'dts') dtsTotal += bytes;
    if (kind === 'doc') sections.push(file);
    const limit = limitOf(kind);
    if (limit !== null && bytes > limit.bytes) issues.push({ file, message: `is ${bytes} bytes; ${limit.label} can be at most ${limit.bytes}` });
  }
  if (tree.truncated || ownFiles > DESIGN_SYSTEM_LIMITS.ownFiles) {
    issues.push({
      file: '.',
      message: `${tree.truncated ? `has more than ${MAX_SCAN_ENTRIES}` : `has ${ownFiles}`} files outside ${BLOBS_DIR}/; a design system holds at most ${DESIGN_SYSTEM_LIMITS.ownFiles} (the editor lists only the first ${DESIGN_SYSTEM_LIMITS.files})`,
    });
  }
  if (tree.totalBytes > DESIGN_SYSTEM_LIMITS.totalBytes) {
    issues.push({ file: '.', message: `files outside ${BLOBS_DIR}/ add up to ${tree.totalBytes} bytes; a design system holds at most ${DESIGN_SYSTEM_LIMITS.totalBytes} (256 MiB)` });
  }
  if (dtsTotal > DESIGN_SYSTEM_FILE_LIMITS.dtsTotal) {
    issues.push({ file: DESIGN_SYSTEM_PATHS.componentsDir.slice(0, -1), message: `the .d.ts files add up to ${dtsTotal} bytes; at most ${DESIGN_SYSTEM_FILE_LIMITS.dtsTotal} (1.5 MB)` });
  }
  if (sections.length > MAX_SECTION_DOCUMENTS) {
    issues.push({ file: '.', message: `has ${sections.length} section documents (*.md outside components/, assets/, fonts/ and archived/); the editor shows at most ${MAX_SECTION_DOCUMENTS}, the rest stay files` });
  }

  // Component directory names
  for (const file of tree.files.keys()) {
    if (!file.startsWith(DESIGN_SYSTEM_PATHS.componentsDir)) continue;
    const parts = file.slice(DESIGN_SYSTEM_PATHS.componentsDir.length).split('/');
    if (parts.length === 2 && (parts[1] === 'preview.html' || parts[1] === 'README.md') && !COMPONENT_NAME_PATTERN.test(parts[0]!)) {
      issues.push({ file, message: `components/${parts[0]}/ is not a component name: an ASCII JavaScript identifier of at most 64 characters` });
    }
  }

  // tokens.json and fonts
  const tokensText = tree.files.has(DESIGN_SYSTEM_PATHS.tokens) ? await readText(dir, DESIGN_SYSTEM_PATHS.tokens) : null;
  if (tokensText !== null && (tree.files.get(DESIGN_SYSTEM_PATHS.tokens) ?? 0) <= TOKENS_LIMITS.bytes) {
    const tokens = checkTokensText(tokensText);
    for (const message of tokens.problems) issues.push({ file: DESIGN_SYSTEM_PATHS.tokens, message });
    for (const message of tokens.notes) notes.push({ file: DESIGN_SYSTEM_PATHS.tokens, message });
  }
  const listedFonts = new Set(tokensText === null ? [] : tokenFontFiles(tokensText));
  for (const font of listedFonts) {
    if (!tree.files.has(font) && !restored.has(font)) issues.push({ file: DESIGN_SYSTEM_PATHS.tokens, message: `type.fonts names ${font}, which is not in the system` });
  }
  for (const file of tree.files.keys()) {
    if (classify(file) !== 'font') continue;
    await checkFont(dir, file, issues);
    if (FONT_EXTENSIONS[extensionOf(file)] !== undefined && !listedFonts.has(file)) {
      issues.push({ file, message: 'is not listed in tokens.json type.fonts, so it gets no @font-face; list it ({"family","file","weight","style"})' });
    }
  }

  // Group names under assets/
  for (const file of tree.files.keys()) {
    if (!file.startsWith(DESIGN_SYSTEM_PATHS.assetsDir)) continue;
    const rest = file.slice(DESIGN_SYSTEM_PATHS.assetsDir.length);
    const slash = rest.indexOf('/');
    if (slash > 0 && !isAssetGroupName(rest.slice(0, slash))) {
      issues.push({ file, message: `assets/${rest.slice(0, slash)}/ is not a valid group name (at most ${MAX_ASSET_GROUP_NAME_LENGTH} characters, no leading or trailing spaces)` });
    }
  }

  // Content
  for (const [file, bytes] of tree.files) {
    const kind = classify(file);
    if (kind === 'generated' || kind === 'own' || kind === 'archived' || bytes > MAX_READ_BYTES || bytes > DESIGN_SYSTEM_LIMITS.fileBytes) continue;
    if (!TEXT_EXTENSIONS.has(extensionOf(file)) && kind !== 'componentLib') continue;
    const text = await readText(dir, file);
    if (text === null) continue;
    if (kind !== 'componentLib' && kind !== 'bundleJs') checkBlobRefs(file, text, tree.blobs, issues);
    if (kind === 'preview') checkPreview(file, text, issues);
    else if (kind === 'bundleJs') checkBundle(file, text, namespace, issues);
    else if (kind === 'bundleCss') {
      if (/<\/style/i.test(text)) issues.push({ file, message: 'contains a literal </style, which ends the inline <style> previews put it in' });
      for (const url of remoteCssLoads(text)) issues.push({ file, message: `loads ${url} from the network; ${NO_CDN}` });
    } else if (kind === 'componentLib' && /\.m?js$/i.test(file)) {
      if (/<\/script/i.test(text)) issues.push({ file, message: 'contains a literal </script, which ends the inline <script> previews put it in' });
      for (const url of remoteScriptLoads(text)) issues.push({ file, message: `loads ${url} from the network; ${NO_CDN}. Copy what it loads into components/lib/` });
    }
  }
  if (tree.files.has(DESIGN_SYSTEM_PATHS.bundleJs) && namespace === null && index !== null) {
    const bundle = await readText(dir, DESIGN_SYSTEM_PATHS.bundleJs);
    const header = bundle === null ? null : bundleHeader(bundle);
    if (header === null || header === 'invalid' || header.namespace === null) {
      addIndex('has no "namespace", and bundle.js has no @ds-bundle header naming one: set "namespace" to the bundle\'s window global');
    }
  }

  return { title: index ? designSystemTitle(index, dir) : path.basename(dir), namespace, issues, notes, notChecked };
}
