import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RpcError,
  SKILL_DEFAULT_ENABLED,
  SKILL_FILE,
  SKILL_LIMITS,
  SKILL_SOURCE_FILE,
  normalizeSkillId,
  type Localized,
  type SkillChangeResult,
  type SkillDetail,
  type SkillDiagnostic,
  type SkillFileContent,
  type SkillFileEntry,
  type SkillListResult,
  type SkillOrigin,
  type SkillSource,
  type SkillSummary,
} from '@cuccut/protocol';
import type { SkillPrefsStore } from '@cuccut/runtime-storage';
import type { AgentSkillPage } from './agent-skill-renderer.ts';
import { parseSkillFrontmatter } from './skill-frontmatter.ts';
import { RcSkills } from '@cuccut/protocol/messages/runtime-core';

/**
 * The agent's skill catalog (architecture design §3.8): the built-in catalog (shipped with the app) and `<Runtime Home>/skills/` (added, imported, or placed by the user).
 *
 * - Each subdirectory is one skill. Its id is derived from the directory name (`normalizeSkillId`). Bad directories are skipped with a diagnostic recorded, without affecting the rest.
 * - No caching: every `list`, `get` and `require` re-reads the directories, so a new directory the user drops in appears on the next list.
 * - Symbolic links are not followed. If the skill directory is itself a link, or the directory contains links or special files, the whole thing is skipped, so nothing outside the directory is read.
 * - When a built-in and a user directory share an id, the built-in one wins, and the user's copy is recorded as `builtin-conflict`.
 * - Enabled state = the source's default (`SKILL_DEFAULT_ENABLED`) plus the delta in `SkillPrefsStore`.
 * - Guide pages (`setGuidePages`, Agent surface design §8.6): the catalog pages rendered from `skills/cuccut/` for the tool-bridge surface, along with the approach overview and conventions, are held in memory and not in any directory. They are part of the session guidance: always in the index at session start, and readable via `skills_read`. But they are not included in `list()` (the skill list in settings and `skills_list`), and they cannot be toggled. A built-in directory or user-directory skill with the same id yields to them.
 */

/** A skill that loaded successfully. `dir` is the absolute path of the skill directory. */
export interface LoadedSkill {
  id: string;
  name: string;
  description: string;
  version: string | null;
  scope: 'builtin' | 'user';
  origin: SkillOrigin;
  dir: string;
  source: SkillSource | null;
  /** All files in the directory (relative paths, `/`-separated, sorted by path), including `SKILL.md` and excluding dot-prefixed ones. */
  files: { path: string; size: number }[];
  /** Full text of `SKILL.md`. */
  content: string;
  /** The body after the front matter. */
  body: string;
  updatedAt: string;
  /** Guide page (in memory; it has only `SKILL.md`, which is `content`). */
  guide?: true;
}

export interface SkillScan {
  skills: LoadedSkill[];
  diagnostics: SkillDiagnostic[];
}

export interface SkillCatalogOptions {
  /** Built-in skill directory. null means none. */
  builtinDir: string | null;
  /** `<Runtime Home>/skills`. Treated as an empty directory when absent. */
  userDir: string;
  prefs: SkillPrefsStore;
}

/** Location of the built-in skills relative to the repository root (`<resources>` when packaged): the `built-in-skills/` under the instruction manual's `skills/cuccut/`. */
const BUILTIN_SKILLS_PATH = path.join('skills', 'cuccut', 'built-in-skills');

/**
 * Finds the built-in skill directory. It checks the `CUCCUT_SKILLS_DIR` environment variable. In the packaged app it is `<resources>/skills/cuccut/built-in-skills`. In development, it walks up from
 * this module to find `skills/cuccut/built-in-skills/` under the repository root. Null if none is found.
 */
export function resolveBuiltinSkillsDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CUCCUT_SKILLS_DIR) return env.CUCCUT_SKILLS_DIR;
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = path.join(resources, BUILTIN_SKILLS_PATH);
    if (isDirectory(bundled)) return bundled;
  }
  return findRepoDir(BUILTIN_SKILLS_PATH);
}

/**
 * In development, walks up from this module to find the repository root (the `package.json` named `cuccut`), then the `<name>` directory under it (which may be a multi-level relative path). Shared by the built-in skills
 * (`skills/cuccut/built-in-skills/`) and the instruction manual (`skills/`). Null if not found.
 */
export function findRepoDir(name: string, from: string = path.dirname(fileURLToPath(import.meta.url))): string | null {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, name);
    if (isDirectory(candidate) && isRepoRoot(dir)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Repository root: the `package.json` named `cuccut`. Only this is accepted, so that a `skills/` directory that happens to exist outside the repository is not mistaken for the built-in directory. */
function isRepoRoot(dir: string): boolean {
  try {
    return (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: unknown }).name === 'cuccut';
  } catch {
    return false;
  }
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export class SkillCatalog {
  readonly #options: SkillCatalogOptions;
  #guide: LoadedSkill[] = [];

  constructor(options: SkillCatalogOptions) {
    this.#options = { ...options, userDir: path.resolve(options.userDir) };
  }

  get builtinDir(): string | null {
    return this.#options.builtinDir;
  }

  get userDir(): string {
    return this.#options.userDir;
  }

  get prefs(): SkillPrefsStore {
    return this.#options.prefs;
  }

  /**
   * Registers the guide pages (the `pages` rendered by `guidance.ts`) as built-in skills. `sourceDir` is the instruction manual directory. Each page's `dir` is recorded as the directory containing its source file.
   * Each call replaces the whole set.
   */
  setGuidePages(pages: readonly AgentSkillPage[], sourceDir: string, updatedAt: string = new Date().toISOString()): void {
    this.#guide = pages.map((page) => guidePageSkill(page, sourceDir, updatedAt));
  }

  /** Sources merged together: guide pages first, then the built-in catalog. Built-in and user-directory entries with the same id as earlier ones are skipped. */
  async scan(): Promise<SkillScan> {
    const scanned = this.#options.builtinDir ? await scanSkillDir(this.#options.builtinDir, 'builtin') : { skills: [], diagnostics: [] };
    const user = await scanSkillDir(this.#options.userDir, 'user');
    const guideIds = new Set(this.#guide.map((s) => s.id));
    const builtin = { skills: [] as LoadedSkill[], diagnostics: [...scanned.diagnostics] };
    for (const skill of scanned.skills) {
      if (guideIds.has(skill.id)) {
        builtin.diagnostics.push(
          diagnostic('builtin-conflict', 'builtin', skill.dir, RcSkills.guideIdConflict({ id: skill.id }), []),
        );
      } else {
        builtin.skills.push(skill);
      }
    }
    const taken = new Set([...guideIds, ...builtin.skills.map((s) => s.id)]);
    const skills = [...this.#guide, ...builtin.skills];
    const diagnostics = [...builtin.diagnostics, ...user.diagnostics];
    for (const skill of user.skills) {
      if (taken.has(skill.id)) {
        diagnostics.push(
          diagnostic(
            'builtin-conflict',
            'user',
            skill.dir,
            RcSkills.builtinConflict({ id: skill.id }),
            [],
          ),
        );
      } else {
        skills.push(skill);
      }
    }
    return { skills, diagnostics };
  }

  /** Skills listed in settings and by `skills_list`. Excludes guide pages. */
  async list(): Promise<SkillListResult> {
    const { skills, diagnostics } = await this.scan();
    return { skills: skills.filter((s) => !s.guide).map((s) => this.summaryOf(s)), diagnostics };
  }

  /** Gets an available skill by id. Returns `not-found` if there is none (or it failed to load). */
  async require(id: string): Promise<LoadedSkill> {
    const found = (await this.scan()).skills.find((s) => s.id === id);
    if (!found) throw new RpcError('not-found', RcSkills.skillNotFound({ id }), { code: 'SKILL_NOT_FOUND', skillId: id });
    return found;
  }

  async get(id: string): Promise<SkillDetail> {
    const skill = await this.require(id);
    const files: SkillFileEntry[] = [];
    for (const file of skill.files) {
      files.push({
        path: file.path,
        size: file.size,
        text: file.size <= SKILL_LIMITS.readFileBytes && (await readText(skill, file.path)) !== null,
      });
    }
    return { skill: this.summaryOf(skill), content: skill.content, files };
  }

  /** Reads a text file in the skill directory. Only paths in the file manifest are accepted. */
  async readFile(id: string, file: string): Promise<SkillFileContent> {
    return readSkillFile(await this.require(id), file);
  }

  async setEnabled(id: string, enabled: boolean): Promise<SkillChangeResult> {
    const skill = await this.require(id);
    // Guide pages are part of the guidance and cannot be toggled. To settings and the CLI, they do not exist.
    if (skill.guide) throw new RpcError('not-found', RcSkills.skillNotFound({ id }), { code: 'SKILL_NOT_FOUND', skillId: id });
    await this.#options.prefs.set(id, enabled, SKILL_DEFAULT_ENABLED[skill.origin]);
    const list = await this.list();
    return { ...list, skill: list.skills.find((s) => s.id === id) ?? this.summaryOf(skill) };
  }

  /** Enabled skills (used for the index at session start). */
  async enabled(): Promise<LoadedSkill[]> {
    return (await this.scan()).skills.filter((s) => this.isEnabled(s));
  }

  isEnabled(skill: LoadedSkill): boolean {
    if (skill.guide) return true;
    return this.#options.prefs.override(skill.id) ?? SKILL_DEFAULT_ENABLED[skill.origin];
  }

  summaryOf(skill: LoadedSkill): SkillSummary {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      origin: skill.origin,
      enabled: this.isEnabled(skill),
      defaultEnabled: SKILL_DEFAULT_ENABLED[skill.origin],
      removable: skill.scope === 'user',
      path: skill.dir,
      source: skill.source,
      fileCount: skill.files.length,
      updatedAt: skill.updatedAt,
    };
  }
}

/** Reads a text file registered in the file manifest. Not in the manifest gives `not-found`. Too large, or not UTF-8 text, gives `invalid-request`. */
export async function readSkillFile(skill: LoadedSkill, file: string): Promise<SkillFileContent> {
  const entry = skill.files.find((f) => f.path === file);
  if (!entry) {
    throw new RpcError('not-found', RcSkills.fileNotInSkill({ id: skill.id, file }), {
      code: 'SKILL_FILE_NOT_FOUND',
      skillId: skill.id,
      path: file,
    });
  }
  if (entry.size > SKILL_LIMITS.readFileBytes) {
    throw new RpcError('invalid-request', RcSkills.fileTooLargeToShow({ file, limit: SKILL_LIMITS.readFileBytes }), {
      code: 'SKILL_FILE_TOO_LARGE',
      skillId: skill.id,
      path: file,
      size: entry.size,
      limit: SKILL_LIMITS.readFileBytes,
    });
  }
  const content = await readText(skill, file);
  if (content === null) {
    throw new RpcError('invalid-request', RcSkills.fileNotText({ file }), { code: 'SKILL_FILE_NOT_TEXT', skillId: skill.id, path: file });
  }
  return { path: file, size: Buffer.byteLength(content), content };
}

/** Reads a manifest file as UTF-8 text. Before reading, confirms it is still a regular file in the directory (not a link swapped in later). Returns null if it is not text. */
async function readText(skill: LoadedSkill, file: string): Promise<string | null> {
  if (skill.guide) return file === SKILL_FILE ? skill.content : null;
  const abs = path.join(skill.dir, ...file.split('/'));
  if (!inside(skill.dir, abs)) return null;
  try {
    const stat = await fsp.lstat(abs);
    if (!stat.isFile()) return null;
    const bytes = await readCapped(abs, SKILL_LIMITS.readFileBytes);
    if (bytes === null) return null;
    const text = decodeUtf8(bytes);
    return text !== null && !text.includes('\u0000') ? text : null;
  } catch {
    return null;
  }
}

/** In-memory form of a guide page: only one `SKILL.md` (the rendered body, without front matter). */
function guidePageSkill(page: AgentSkillPage, sourceDir: string, updatedAt: string): LoadedSkill {
  return {
    id: page.id,
    name: page.name,
    description: page.description,
    version: null,
    scope: 'builtin',
    origin: 'builtin',
    dir: path.dirname(path.join(sourceDir, ...page.file.split('/'))),
    source: null,
    files: [{ path: SKILL_FILE, size: Buffer.byteLength(page.body) }],
    content: page.body,
    body: page.body,
    updatedAt,
    guide: true,
  };
}

/**
 * Reads a directory source, where each subdirectory is one skill. Non-directory entries and dot-prefixed entries are ignored. Symbolic links are not followed (a diagnostic is recorded). Within the same source, entries whose normalized ids are equal are all skipped. Empty if the directory does not exist.
 */
export async function scanSkillDir(dir: string, scope: 'builtin' | 'user'): Promise<SkillScan> {
  const root = path.resolve(dir);
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
  const diagnostics: SkillDiagnostic[] = [];
  const loaded: LoadedSkill[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      diagnostics.push(diagnostic('invalid', scope, abs, RcSkills.skillDirIsSymlink(), []));
      continue;
    }
    if (!entry.isDirectory()) continue;
    const result = await loadSkill(abs, scope);
    if ('code' in result) diagnostics.push(result);
    else loaded.push(result);
  }
  const counts = new Map<string, number>();
  for (const s of loaded) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
  const skills: LoadedSkill[] = [];
  for (const s of loaded) {
    if ((counts.get(s.id) ?? 0) > 1) {
      diagnostics.push(diagnostic('duplicate-id', scope, s.dir, RcSkills.duplicateId({ id: s.id }), []));
    } else {
      skills.push(s);
    }
  }
  return { skills, diagnostics };
}

function diagnostic(
  code: SkillDiagnostic['code'],
  scope: 'builtin' | 'user',
  dir: string,
  message: Localized,
  issues: Localized[],
): SkillDiagnostic {
  return { code, scope, dir: path.basename(dir), path: dir, message: message.text, issues: issues.map((issue) => issue.text) };
}

/**
 * Reads and validates one skill directory. The id must be normalizable from the directory name. Files must not exceed the limit and must all be regular files. The root must have `SKILL.md` (UTF-8, not exceeding the limit).
 * The front matter must have `name` and `description`, and they must not be too long. If noncompliant, returns diagnostics.
 */
export async function loadSkill(dir: string, scope: 'builtin' | 'user'): Promise<LoadedSkill | SkillDiagnostic> {
  const invalid = (issues: Localized[]) => diagnostic('invalid', scope, dir, RcSkills.skillInvalid(), issues);
  const id = normalizeSkillId(path.basename(dir));
  if (!id) return invalid([RcSkills.noIdFromFolder({ name: path.basename(dir) })]);

  const listing = await listSkillFiles(dir);
  if ('problem' in listing) return invalid([listing.problem]);
  const { files } = listing;
  if (!files.some((f) => f.path === SKILL_FILE)) return invalid([RcSkills.missingRootFile({ file: SKILL_FILE })]);

  const parsed = await readSkillFileMeta(path.join(dir, SKILL_FILE));
  if ('problem' in parsed) return invalid(parsed.issues);

  let source: SkillSource | null = null;
  if (scope === 'user') source = await readSkillSource(dir);
  const origin: SkillOrigin = scope === 'builtin' ? 'builtin' : source?.kind === 'github' ? 'third-party' : 'personal';
  const stat = await fsp.stat(path.join(dir, SKILL_FILE));
  return { id, ...parsed.meta, scope, origin, dir, source, files, updatedAt: stat.mtime.toISOString() };
}

/** Reads `SKILL.md` and validates its front matter. The add and import paths also use it to validate the staging directory. */
export async function readSkillFileMeta(
  file: string,
): Promise<{ meta: Pick<LoadedSkill, 'name' | 'description' | 'version' | 'content' | 'body'> } | { problem: true; issues: Localized[] }> {
  const fail = (issues: Localized[]) => ({ problem: true as const, issues });
  let bytes: Buffer | null;
  try {
    bytes = await readCapped(file, SKILL_LIMITS.skillFileBytes);
  } catch {
    return fail([RcSkills.cannotReadFile({ file: SKILL_FILE })]);
  }
  if (bytes === null) return fail([RcSkills.fileOverBytes({ file: SKILL_FILE, limit: SKILL_LIMITS.skillFileBytes })]);
  const content = decodeUtf8(bytes);
  if (content === null) return fail([RcSkills.fileNotUtf8({ file: SKILL_FILE })]);
  const fm = parseSkillFrontmatter(content);
  if (!fm.ok) return fail([RcSkills.fileProblem({ file: SKILL_FILE, problem: fm.problem })]);
  const issues: Localized[] = [];
  const name = fm.fields.get('name')?.trim() ?? '';
  const description = fm.fields.get('description')?.trim() ?? '';
  const version = fm.fields.get('version')?.trim() || null;
  if (!name) issues.push(RcSkills.frontmatterMissingField({ file: SKILL_FILE, field: 'name' }));
  else if (name.length > SKILL_LIMITS.name) issues.push(RcSkills.fieldTooLong({ field: 'name', limit: SKILL_LIMITS.name }));
  if (!description) issues.push(RcSkills.frontmatterMissingField({ file: SKILL_FILE, field: 'description' }));
  else if (description.length > SKILL_LIMITS.description) issues.push(RcSkills.fieldTooLong({ field: 'description', limit: SKILL_LIMITS.description }));
  if (version && version.length > SKILL_LIMITS.version) issues.push(RcSkills.fieldTooLong({ field: 'version', limit: SKILL_LIMITS.version }));
  if (issues.length) return fail(issues);
  return { meta: { name, description, version, content, body: fm.body } };
}

/** The source CucCut recorded. null when absent or unreadable (treated as placed by the user). */
async function readSkillSource(dir: string): Promise<SkillSource | null> {
  try {
    const stat = await fsp.lstat(path.join(dir, SKILL_SOURCE_FILE));
    if (!stat.isFile() || stat.size > 16 * 1024) return null;
    const raw = JSON.parse(await fsp.readFile(path.join(dir, SKILL_SOURCE_FILE), 'utf8')) as Record<string, unknown>;
    const s = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : null);
    if (raw.kind === 'local' && s('path') && s('addedAt')) return { kind: 'local', path: s('path')!, addedAt: s('addedAt')! };
    if (raw.kind === 'github') {
      const [url, owner, repo, ref, commit, importedAt] = ['url', 'owner', 'repo', 'ref', 'commit', 'importedAt'].map(s);
      const sub = typeof raw.path === 'string' ? raw.path : '';
      if (url && owner && repo && ref && commit && importedAt)
        return { kind: 'github', url, owner, repo, ref, commit, path: sub, importedAt };
    }
  } catch {
    // No source record, or it is corrupted: treat it as placed by the user.
  }
  return null;
}

/**
 * All regular files in the skill directory (relative paths, `/`-separated, sorted by path). Dot-prefixed entries are ignored. Symbolic links, special files, or too many files make the whole thing noncompliant.
 */
export async function listSkillFiles(dir: string): Promise<{ files: { path: string; size: number }[] } | { problem: Localized; tooMany?: true }> {
  const files: { path: string; size: number }[] = [];
  let tooMany = false;
  const walk = async (abs: string, rel: string): Promise<Localized | null> => {
    const entries = await fsp.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (relPath.length > SKILL_LIMITS.path) return RcSkills.pathTooLong({ path: relPath.slice(0, 80) });
      if (entry.isSymbolicLink()) return RcSkills.noSymlinks({ path: relPath });
      if (entry.isDirectory()) {
        const problem = await walk(path.join(abs, entry.name), relPath);
        if (problem) return problem;
      } else if (entry.isFile()) {
        if (files.length >= SKILL_LIMITS.files) {
          tooMany = true;
          return RcSkills.tooManyFiles({ limit: SKILL_LIMITS.files });
        }
        files.push({ path: relPath, size: (await fsp.lstat(path.join(abs, entry.name))).size });
      } else {
        return RcSkills.notRegularFile({ path: relPath });
      }
    }
    return null;
  };
  try {
    const problem = await walk(dir, '');
    return problem ? { problem, ...(tooMany ? { tooMany: true as const } : {}) } : { files: files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) };
  } catch (error) {
    return { problem: RcSkills.cannotReadSkillDir({ code: (error as NodeJS.ErrnoException).code ?? 'error' }) };
  }
}

function inside(dir: string, file: string): boolean {
  const resolved = path.resolve(file);
  return resolved.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
}

/** Reads a file. Returns null if it exceeds `max` bytes (reads only up to `max + 1` bytes). */
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
