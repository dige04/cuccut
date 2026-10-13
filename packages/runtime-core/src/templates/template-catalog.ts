import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCALES,
  RpcError,
  TEMPLATE_FILE_MAX_BYTES,
  TEMPLATE_LIMITS,
  TEMPLATE_LOCALES_DIR,
  TEMPLATE_MANIFEST_FILE,
  TEMPLATE_PROMPT_FILE,
  getLocale,
  localeOfTag,
  localizeTemplateManifest,
  pickTemplateLanguage,
  templatePromptSlotProblems,
  templateTranslationFile,
  templateTranslationFiles,
  type Locale,
  type PackRef,
  type TemplateDetail,
  type TemplateDiagnostic,
  type TemplateListResult,
  type TemplateManifest,
  type TemplateOrigin,
  type TemplateSummary,
  type TemplateTranslation,
} from '@cuccut/protocol';
import { parseTemplateManifest, parseTemplateTranslation } from '@cuccut/protocol/schemas';
import { RcTemplates } from '@cuccut/protocol/messages/runtime-core';

/**
 * Creative template catalog (template package spec §6): the built-in catalog (distributed with the app) and the `templates/` under the Runtime Home (placed there by the user).
 *
 * - Validates directory by directory. A bad template is skipped with one diagnostic recorded, without affecting the other templates.
 * - No caching: every `list`, `get` and `locate` reads the directories again. Reading a few dozen small files is negligible. A new template placed by the user shows up on the next list, and `get` and handle issuing never use a stale manifest.
 * - When the built-in and user directories have the same id, the built-in one wins, and the user's copy is recorded as `builtin-conflict` (spec §6).
 * - Language versions (spec §3.6): the translations in `locales/` are all validated on load. If any one is non-compliant, the whole template is skipped. `list`, `get` and sending pick one according to the requested language (default: the Runtime's UI language), and apply it to the manifest.
 */

/** Size limit for the manifest file. Each manifest item has a length cap, and a normal manifest is far smaller than this; anything larger is not read into memory. */
const MANIFEST_MAX_BYTES = 64 * 1024;
/** Maximum number of entries (including subdirectories) examined in one template directory. A template that exceeds it is judged non-compliant as a whole, so one huge directory cannot slow down the list. */
const MAX_TEMPLATE_ENTRIES = 256;

/** A successfully loaded template. `dir` is the absolute path of the template directory. `manifest` and `prompt` are `template.json` and `prompt.md` as they are. */
export interface LoadedTemplate {
  manifest: TemplateManifest;
  origin: TemplateOrigin;
  dir: string;
  prompt: string;
  /** Translations in `locales/`, in the order of `LOCALES`. */
  translations: ReadonlyMap<Locale, TemplateTranslationEntry>;
}

/** Translation for one language: the copy from `locales/<language>.json` and the prompt from `locales/<language>.md`. */
export interface TemplateTranslationEntry {
  translation: TemplateTranslation;
  prompt: string;
}

/** A template in some language: the manifest with the translation applied, and the prompt replaced with the translation. Without a suitable translation, it is `template.json` and `prompt.md`. */
export interface LocalizedTemplate {
  manifest: TemplateManifest;
  prompt: string;
  /** Which language versions exist: the `language` of `template.json` first, then the translations in the order of `LOCALES`. */
  languages: string[];
}

/** Picks the language version by `language` (default: the Runtime's UI language) (spec §3.6). */
export function localizeTemplate(template: LoadedTemplate, language?: string | null): LocalizedTemplate {
  const { manifest, translations } = template;
  const available = [...translations.keys()];
  const languages = [manifest.language, ...available];
  const locale = pickTemplateLanguage(manifest.language, available, language ?? getLocale());
  const entry = locale ? translations.get(locale) : undefined;
  if (!locale || !entry) return { manifest, prompt: template.prompt, languages };
  return { manifest: localizeTemplateManifest(manifest, locale, entry.translation), prompt: entry.prompt, languages };
}

export interface TemplateScan {
  templates: LoadedTemplate[];
  diagnostics: TemplateDiagnostic[];
}

export interface TemplateCatalogOptions {
  /** Built-in template catalog. `null` means there is none (the directory bundled with the package cannot be found). */
  builtinDir: string | null;
  /** User template directory `<CUCCUT_HOME>/templates`. If it does not exist it is treated as empty, and it is not created on the user's behalf. */
  userDir: string;
  /**
   * Which installed pack a user template came from (pack spec §6), backed by the pack registry. Read once per `list` / `get`, so a list reads the pack records once.
   * Absent: no template has a pack.
   */
  packOwner?: () => Promise<PackOwnerLookup>;
}

/** A pack registry snapshot as a lookup: the pack a template or skill id came from, or null. */
export type PackOwnerLookup = (kind: 'template' | 'skill', id: string) => PackRef | null;

const NO_PACKS: PackOwnerLookup = () => null;

/**
 * Finds the built-in template directory. Checks the `CUCCUT_TEMPLATES_DIR` environment variable. In a packaged app it is `<resources>/templates`. In development, it walks up from this module to find a directory that has both a `package.json` and a `templates/` (the repository root). `null` if none.
 */
export function resolveBuiltinTemplatesDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CUCCUT_TEMPLATES_DIR) return env.CUCCUT_TEMPLATES_DIR;
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, 'templates');
    if (isDirectory(bundled)) return bundled;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, 'templates');
    if (fs.existsSync(path.join(dir, 'package.json')) && isDirectory(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export class TemplateCatalog {
  readonly #options: TemplateCatalogOptions;

  constructor(options: TemplateCatalogOptions) {
    this.#options = options;
  }

  get builtinDir(): string | null {
    return this.#options.builtinDir;
  }

  get userDir(): string {
    return this.#options.userDir;
  }

  /** Merges the two sources: built-in first. In the user directory, entries with the same id as a built-in one are skipped. */
  async scan(): Promise<TemplateScan> {
    const builtin = this.#options.builtinDir ? await scanTemplateDir(this.#options.builtinDir, 'builtin') : EMPTY_SCAN;
    const user = await scanTemplateDir(this.#options.userDir, 'user');
    const taken = new Set(builtin.templates.map((t) => t.manifest.id));
    const templates = [...builtin.templates];
    const diagnostics = [...builtin.diagnostics, ...user.diagnostics];
    for (const template of user.templates) {
      if (taken.has(template.manifest.id)) {
        diagnostics.push({
          code: 'builtin-conflict',
          origin: 'user',
          dir: path.basename(template.dir),
          path: template.dir,
          message: RcTemplates.builtinConflict({ id: template.manifest.id }).text,
          issues: [],
        });
      } else {
        templates.push(template);
      }
    }
    return { templates, diagnostics };
  }

  /** Directory. Each template is replaced with the language version picked by `language` (default: the Runtime's UI language). */
  async list(language?: string | null): Promise<TemplateListResult> {
    const { templates, diagnostics } = await this.scan();
    const owner = await this.#packOwner();
    return { templates: templates.map((t) => summaryOf(t, language, packOfTemplate(t, owner))), diagnostics };
  }

  /** The installed pack a template came from (pack spec §6); null for built-in templates (built-in wins on an id clash) and the user's own. */
  async packOf(id: string, origin: TemplateOrigin): Promise<PackRef | null> {
    return origin === 'user' ? (await this.#packOwner())('template', id) : null;
  }

  async #packOwner(): Promise<PackOwnerLookup> {
    return this.#options.packOwner ? this.#options.packOwner() : NO_PACKS;
  }

  /** Gets an available template by id. `not-found` if there is none (or it could not be loaded). */
  async require(id: string): Promise<LoadedTemplate> {
    const found = (await this.scan()).templates.find((t) => t.manifest.id === id);
    if (!found) throw new RpcError('not-found', RcTemplates.templateNotFound({ id }), { code: 'TEMPLATE_NOT_FOUND', templateId: id });
    return found;
  }

  async get(id: string, language?: string | null): Promise<TemplateDetail> {
    const template = await this.require(id);
    return { template: summaryOf(template, language, await this.packOf(template.manifest.id, template.origin)), prompt: localizeTemplate(template, language).prompt };
  }

  /**
   * Location of a template's accompanying files. Only `cover.file`, `preview.file` and `assets[].path`, as registered in the manifest, are recognized. A real-path check is done again when the media channel issues a handle.
   */
  async locate(id: string, file: string): Promise<{ root: string; file: string }> {
    const template = await this.require(id);
    if (!registeredFiles(template.manifest).includes(file)) {
      throw new RpcError('not-found', RcTemplates.fileNotRegistered({ id, file }), {
        code: 'TEMPLATE_FILE_NOT_FOUND',
        templateId: id,
        path: file,
      });
    }
    return { root: template.dir, file };
  }
}

const EMPTY_SCAN: TemplateScan = { templates: [], diagnostics: [] };

export function summaryOf(template: LoadedTemplate, language?: string | null, pack: PackRef | null = null): TemplateSummary {
  const { manifest, origin } = template;
  const localized = localizeTemplate(template, language);
  return {
    manifest: localized.manifest,
    origin,
    languages: localized.languages,
    files: { cover: manifest.cover.file != null, preview: manifest.preview.file != null, assets: manifest.assets?.length ?? 0 },
    pack,
  };
}

function packOfTemplate(template: Pick<LoadedTemplate, 'manifest' | 'origin'>, owner: PackOwnerLookup): PackRef | null {
  return template.origin === 'user' ? owner('template', template.manifest.id) : null;
}

/** Accompanying files registered in the manifest (excluding the manifest and `prompt.md`). */
function registeredFiles(manifest: TemplateManifest): string[] {
  return [manifest.cover.file, manifest.preview.file, ...(manifest.assets ?? []).map((a) => a.path)].filter((f): f is string => f != null);
}

/**
 * Reads a directory source (spec §6): each subdirectory is one template. Entries that are not directories, and hidden entries, are ignored. Symbolic links are not followed (a diagnostic is recorded explaining why it did not appear). If two in the same source have a duplicate id, both are skipped. A nonexistent directory is treated as empty.
 */
export async function scanTemplateDir(dir: string, origin: TemplateOrigin): Promise<TemplateScan> {
  // Relative paths (for example, ones written in an environment variable) are first resolved to absolute paths. The diagnostics give absolute paths, and the in-directory checks compare against them.
  const root = path.resolve(dir);
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
  const diagnostics: TemplateDiagnostic[] = [];
  const loaded: LoadedTemplate[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const dir = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      diagnostics.push(diagnostic('invalid', origin, dir, RcTemplates.dirIsSymlink().text, []));
      continue;
    }
    if (!entry.isDirectory()) continue;
    const result = await loadTemplate(dir, origin);
    if ('code' in result) diagnostics.push(result);
    else loaded.push(result);
  }
  const counts = new Map<string, number>();
  for (const t of loaded) counts.set(t.manifest.id, (counts.get(t.manifest.id) ?? 0) + 1);
  const templates: LoadedTemplate[] = [];
  for (const t of loaded) {
    if ((counts.get(t.manifest.id) ?? 0) > 1) {
      diagnostics.push(diagnostic('duplicate-id', origin, t.dir, RcTemplates.duplicateId({ id: t.manifest.id }).text, []));
    } else {
      templates.push(t);
    }
  }
  return { templates, diagnostics };
}

function diagnostic(
  code: TemplateDiagnostic['code'],
  origin: TemplateOrigin,
  dir: string,
  message: string,
  issues: string[],
): TemplateDiagnostic {
  return { code, origin, dir: path.basename(dir), path: dir, message, issues };
}

/**
 * Reads and validates one template directory (spec §2–§4): the manifest complies, the id equals the directory name, `prompt.md` is non-empty UTF-8 and within limits, the placeholders match the to-fill items, all registered files exist, the cover and preview are not over the size cap, the translations in `locales/` come in pairs and are compliant (§3.6), there are no unregistered files, and there are no symbolic links in the directory. Non-compliant directories return diagnostics.
 */
export async function loadTemplate(dir: string, origin: TemplateOrigin): Promise<LoadedTemplate | TemplateDiagnostic> {
  const invalid = (issues: string[]) => diagnostic('invalid', origin, dir, RcTemplates.templateInvalid().text, issues);

  const listing = await listTemplateFiles(dir);
  if ('problem' in listing) return invalid([listing.problem]);
  const { files } = listing;

  if (!files.has(TEMPLATE_MANIFEST_FILE)) return invalid([RcTemplates.missingFile({ file: TEMPLATE_MANIFEST_FILE }).text]);
  const manifestBytes = await readCapped(path.join(dir, TEMPLATE_MANIFEST_FILE), MANIFEST_MAX_BYTES);
  if (manifestBytes === null) return invalid([RcTemplates.fileOverBytes({ file: TEMPLATE_MANIFEST_FILE, limit: MANIFEST_MAX_BYTES }).text]);
  const manifestText = decodeUtf8(manifestBytes);
  if (manifestText === null) return invalid([RcTemplates.fileNotUtf8({ file: TEMPLATE_MANIFEST_FILE }).text]);
  let raw: unknown;
  try {
    raw = JSON.parse(manifestText);
  } catch {
    return invalid([RcTemplates.fileNotJson({ file: TEMPLATE_MANIFEST_FILE }).text]);
  }
  const parsed = parseTemplateManifest(raw, path.basename(dir));
  if (!parsed.ok) {
    return parsed.reason === 'unsupported-schema'
      ? diagnostic('unsupported-schema', origin, dir, RcTemplates.unsupportedSchema().text, parsed.issues)
      : invalid(parsed.issues);
  }
  const { manifest } = parsed;

  const issues: string[] = [];
  // Placeholders (spec §2.2, §5.5): the body of `example` must match `fields`, and the body of `scene` must not contain `{{`.
  const prompt = (await readPrompt(dir, files, TEMPLATE_PROMPT_FILE, issues)) ?? '';
  if (prompt) issues.push(...templatePromptSlotProblems(manifest, prompt));

  const registered = new Set([TEMPLATE_MANIFEST_FILE, TEMPLATE_PROMPT_FILE, ...registeredFiles(manifest)]);
  const translations = await loadTranslations(dir, files, manifest, issues);
  for (const locale of translations.locales) for (const file of Object.values(templateTranslationFiles(locale))) registered.add(file);
  for (const file of registeredFiles(manifest)) {
    if (!files.has(file)) issues.push(RcTemplates.registeredFileMissing({ file }).text);
    else if (!inside(dir, file)) issues.push(RcTemplates.pathOutsideTemplate({ file }).text);
  }
  for (const file of files) if (!registered.has(file)) issues.push(RcTemplates.unregisteredFile({ file }).text);
  for (const [key, file] of [
    ['cover', manifest.cover.file],
    ['preview', manifest.preview.file],
  ] as const) {
    if (file == null || !files.has(file)) continue;
    const { size } = await fsp.stat(path.join(dir, file));
    if (size > TEMPLATE_FILE_MAX_BYTES[key]) issues.push(RcTemplates.fileOverBytesActual({ file, limit: TEMPLATE_FILE_MAX_BYTES[key], size }).text);
  }

  if (issues.length) return invalid(issues);
  return { manifest, origin, dir, prompt, translations: translations.entries };
}

/**
 * Translations in `locales/` (spec §3.6): one pair per shipped language, `<lowercase language>.json` and `.md`. They must not be the same language as `template.json`. The copy is checked against the manifest. The prompt follows the rules for `prompt.md`, and the placeholders are checked against the translation's `fields`. Problems are written to `issues`. `locales` are the recognized languages (their files count as registered), and `entries` are the compliant translations. Files that are not recognized are left to the unregistered-file check.
 */
async function loadTranslations(
  dir: string,
  files: ReadonlySet<string>,
  manifest: TemplateManifest,
  issues: string[],
): Promise<{ locales: Locale[]; entries: Map<Locale, TemplateTranslationEntry> }> {
  const present = new Set<Locale>();
  for (const file of files) {
    if (!file.startsWith(`${TEMPLATE_LOCALES_DIR}/`)) continue;
    const hit = templateTranslationFile(file);
    if (hit) present.add(hit.locale);
  }
  const base = localeOfTag(manifest.language);
  const locales = LOCALES.filter((locale) => present.has(locale));
  const entries = new Map<Locale, TemplateTranslationEntry>();
  for (const locale of locales) {
    const { text: textFile, prompt: promptFile } = templateTranslationFiles(locale);
    if (locale === base) {
      issues.push(RcTemplates.translationForBaseLanguage({ file: textFile, language: manifest.language }).text);
      continue;
    }
    const before = issues.length;
    let translation: TemplateTranslation | null = null;
    const raw = await readJson(dir, files, textFile, issues);
    if (raw !== undefined) {
      const parsed = parseTemplateTranslation(raw, manifest);
      if (parsed.ok) translation = parsed.translation;
      else issues.push(...parsed.issues.map((issue) => `${textFile}: ${issue}`));
    }
    const prompt = await readPrompt(dir, files, promptFile, issues);
    if (prompt && translation)
      issues.push(...templatePromptSlotProblems({ kind: manifest.kind, fields: translation.fields }, prompt).map((issue) => `${promptFile}: ${issue}`));
    if (translation && prompt && issues.length === before) entries.set(locale, { translation, prompt });
  }
  return { locales, entries };
}

/** Reads a prompt (`prompt.md` or a translation's `.md`): it must exist, be non-empty, be valid UTF-8, and not exceed the limit. If it does not comply, records a problem and returns `null`. */
async function readPrompt(dir: string, files: ReadonlySet<string>, file: string, issues: string[]): Promise<string | null> {
  if (!files.has(file)) {
    issues.push(RcTemplates.missingFile({ file }).text);
    return null;
  }
  const bytes = await readCapped(path.join(dir, file), TEMPLATE_LIMITS.promptBytes);
  const text = bytes === null ? null : decodeUtf8(bytes);
  if (bytes === null) issues.push(RcTemplates.fileOverBytes({ file, limit: TEMPLATE_LIMITS.promptBytes }).text);
  else if (text === null) issues.push(RcTemplates.fileNotUtf8({ file }).text);
  else if (!text.trim()) issues.push(RcTemplates.fileEmpty({ file }).text);
  else return text;
  return null;
}

/** Reads a JSON file (translated copy): it must exist, not exceed the manifest's limit, and be valid UTF-8 and JSON. If it does not comply, records a problem and returns `undefined`. */
async function readJson(dir: string, files: ReadonlySet<string>, file: string, issues: string[]): Promise<unknown> {
  if (!files.has(file)) {
    issues.push(RcTemplates.missingFile({ file }).text);
    return undefined;
  }
  const bytes = await readCapped(path.join(dir, file), MANIFEST_MAX_BYTES);
  if (bytes === null) {
    issues.push(RcTemplates.fileOverBytes({ file, limit: MANIFEST_MAX_BYTES }).text);
    return undefined;
  }
  const text = decodeUtf8(bytes);
  if (text === null) {
    issues.push(RcTemplates.fileNotUtf8({ file }).text);
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    issues.push(RcTemplates.fileNotJson({ file }).text);
    return undefined;
  }
}

/**
 * All regular files in the template directory (relative paths, `/` separated). Entries beginning with a dot are ignored. On encountering a symbolic link, another special file, or too many entries, the whole template is non-compliant: links are not followed, so nothing outside the directory is read.
 */
async function listTemplateFiles(dir: string): Promise<{ files: Set<string> } | { problem: string }> {
  const files = new Set<string>();
  let seen = 0;
  const walk = async (abs: string, rel: string): Promise<string | null> => {
    const entries = await fsp.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (++seen > MAX_TEMPLATE_ENTRIES) return RcTemplates.tooManyEntries({ limit: MAX_TEMPLATE_ENTRIES }).text;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) return RcTemplates.noSymlinks({ path: relPath }).text;
      if (entry.isDirectory()) {
        const problem = await walk(path.join(abs, entry.name), relPath);
        if (problem) return problem;
      } else if (entry.isFile()) {
        files.add(relPath);
      } else {
        return RcTemplates.notRegularFile({ path: relPath }).text;
      }
    }
    return null;
  };
  try {
    const problem = await walk(dir, '');
    return problem ? { problem } : { files };
  } catch (error) {
    return { problem: RcTemplates.cannotReadDir({ code: (error as NodeJS.ErrnoException).code ?? 'error' }).text };
  }
}

/** The relative path after resolution is still inside the directory. The manifest validation already blocks `..` and absolute paths; this is a second check. */
function inside(dir: string, file: string): boolean {
  const resolved = path.resolve(dir, file);
  return resolved.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
}

/** Reads a file. Returns `null` if it exceeds `max` bytes (reads at most `max + 1` bytes). */
async function readCapped(file: string, max: number): Promise<Buffer | null> {
  const handle = await fsp.open(file, 'r');
  try {
    const buffer = Buffer.alloc(max + 1);
    let length = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
      if (length > max) return null;
    }
    return buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
