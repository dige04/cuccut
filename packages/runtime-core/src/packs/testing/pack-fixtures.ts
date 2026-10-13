import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACK_MANIFEST_FILE, RpcError, type LibraryName, type PackFileEntry } from '@cuccut/protocol';
import { SkillPrefsStore } from '@cuccut/runtime-storage';
import { readLibraryImport } from '@cuccut/runtime-storage/library';
import { SkillCatalog } from '../../skills/skill-catalog.ts';
import { TemplateCatalog } from '../../templates/template-catalog.ts';
import { PackExporter, type PackExportLibrary } from '../pack-export.ts';
import { PackInstaller, type PackInstallStep, type PackLibrary } from '../pack-installer.ts';
import { PackPreviews } from '../pack-previews.ts';
import { PackRegistry } from '../pack-registry.ts';

/** For tests: pack folders and a fake static host. */

/** The sample pack at the repository root (`packs/news-desk`): five levels up from this file (packages/runtime-core/src/packs/testing). */
export const SAMPLE_PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../packs/news-desk');

/** A valid scene template directory for a pack (English copy). */
export function templateFiles(id: string, extra: Record<string, unknown> = {}): Record<string, string> {
  const manifest = {
    schema: 1,
    id,
    version: '1.0.0',
    kind: 'scene',
    title: 'Sample scene',
    summary: 'One sentence about it.',
    description: 'A short paragraph about it.',
    language: 'en',
    category: 'explainer',
    ratio: '16:9',
    durationSeconds: 60,
    brief: 'Make an explainer about {{topic}}.',
    fields: [{ label: 'topic', example: 'photosynthesis' }],
    author: 'CucCut',
    source: 'community',
    license: 'CC-BY-4.0',
    tags: [],
    cover: { tone: 'blue', figure: 'steps' },
    preview: { beats: ['One', 'Two', 'Three'] },
    ...extra,
  };
  return { 'template.json': JSON.stringify(manifest, null, 2), 'prompt.md': 'You are making a short explainer.\n' };
}

/** A valid `SKILL.md`. */
export function skillFile(name: string, body = '# Steps\n\nDo it step by step.\n'): string {
  return `---\nname: ${name}\ndescription: Use when testing packs - ${name}.\n---\n\n${body}`;
}

export interface PackFixture {
  /** Merged over `{ format, schema, id, name }`; `templates` / `skills` default to the keys of `templates` / `skills` below. */
  manifest?: Record<string, unknown>;
  /** Template id → files inside its directory (default: `templateFiles(id)`). */
  templates?: Record<string, Record<string, string | Uint8Array> | null>;
  /** Skill id → files inside its directory (default: a `SKILL.md`). */
  skills?: Record<string, Record<string, string | Uint8Array> | null>;
  /** Other files by pack-relative path (library files, STYLE.md, examples, README…). */
  files?: Record<string, string | Uint8Array>;
  /** Write the `files` index into pack.json, as export does. */
  index?: boolean;
}

/** Writes a pack folder `root/<dirName>` and returns its path. */
export async function writePack(root: string, dirName: string, fixture: PackFixture = {}): Promise<string> {
  const dir = path.join(root, dirName);
  await fs.mkdir(dir, { recursive: true });
  const all = packFixtureFiles(dirName, fixture);
  for (const [rel, body] of Object.entries(all)) {
    await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), body);
  }
  if (fixture.index) await writeFilesIndex(dir);
  return dir;
}

/** The files of a fixture by pack-relative path, `pack.json` included (without an index). */
export function packFixtureFiles(id: string, fixture: PackFixture = {}): Record<string, string | Uint8Array> {
  const templates = fixture.templates ?? {};
  const skills = fixture.skills ?? {};
  const manifest = {
    format: 'cuccut.pack',
    schema: 1,
    id,
    name: 'Sample pack',
    templates: Object.keys(templates),
    skills: Object.keys(skills),
    ...fixture.manifest,
  };
  const out: Record<string, string | Uint8Array> = { [PACK_MANIFEST_FILE]: JSON.stringify(manifest, null, 2) };
  for (const [templateId, files] of Object.entries(templates)) {
    for (const [rel, body] of Object.entries(files ?? templateFiles(templateId))) out[`templates/${templateId}/${rel}`] = body;
  }
  for (const [skillId, files] of Object.entries(skills)) {
    for (const [rel, body] of Object.entries(files ?? { 'SKILL.md': skillFile(skillId) })) out[`skills/${skillId}/${rel}`] = body;
  }
  return { ...out, ...fixture.files };
}

/** The `files` index of a folder: every file but pack.json and dot files, sorted, with size and sha256. */
export async function filesIndex(dir: string): Promise<PackFileEntry[]> {
  const out: PackFileEntry[] = [];
  const walk = async (abs: string, rel: string) => {
    for (const entry of await fs.readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), relPath);
      else if (relPath !== PACK_MANIFEST_FILE) {
        const bytes = await fs.readFile(path.join(abs, entry.name));
        out.push({ path: relPath, size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  };
  await walk(dir, '');
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** Rewrites a folder's pack.json with its `files` index. */
export async function writeFilesIndex(dir: string): Promise<PackFileEntry[]> {
  const file = path.join(dir, PACK_MANIFEST_FILE);
  const manifest = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
  const files = await filesIndex(dir);
  await fs.writeFile(file, JSON.stringify({ ...manifest, files }, null, 2));
  return files;
}

/**
 * A fake static host for `https://` packs: serves `files` (path → bytes) under `base` (ending in `/`). `override` replaces a response by path. Records the requested URLs.
 */
export function fakePackHost(base: string, files: Record<string, string | Uint8Array>, override: Record<string, () => Response> = {}) {
  const requests: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (!url.startsWith(base)) return new Response('', { status: 404 });
    const rel = url.slice(base.length).split('/').map(decodeURIComponent).join('/');
    if (override[rel]) return override[rel]!();
    const body = files[rel];
    return body === undefined ? new Response('', { status: 404 }) : new Response(body as BodyInit);
  }) as typeof fetch;
  return { fetch: fetchFn, requests };
}

/** Reads a folder into a path → bytes map (dot files skipped), for serving it from a fake host. */
export async function readFolder(dir: string): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  const walk = async (abs: string, rel: string) => {
    for (const entry of await fs.readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), relPath);
      else out[relPath] = await fs.readFile(path.join(abs, entry.name));
    }
  };
  await walk(dir, '');
  return out;
}

// ---- A pack world: catalogs, registry, previews and installer over a temporary home ----

/**
 * An in-memory library: imports read the file with the library's own reader (so voices and unknown files fail as they would), entries get `lib_<n>` ids. Export writes
 * the imported file back as it was.
 */
export class FakePackLibrary implements PackLibrary, PackExportLibrary {
  readonly entries = new Map<string, { library: LibraryName; id: string; name: string; file: string; bytes: Uint8Array }>();
  readonly imports: string[] = [];
  #next = 0;

  async import(file: string): Promise<{ library: LibraryName; id: string }> {
    const candidate = await readLibraryImport(file);
    const id = `lib_${++this.#next}`;
    const bytes = await fs.readFile(file);
    this.entries.set(`${candidate.library}:${id}`, { library: candidate.library, id, name: candidate.content.name, file, bytes });
    this.imports.push(file);
    return { library: candidate.library, id };
  }

  async remove(library: LibraryName, id: string): Promise<void> {
    this.entries.delete(`${library}:${id}`);
  }

  entry(library: LibraryName, id: string): { name: string } | null {
    const found = this.entries.get(`${library}:${id}`);
    return found ? { name: found.name } : null;
  }

  exportInfo(library: Exclude<LibraryName, 'voices'>, id: string): { name: string; extension: string } {
    const found = this.entries.get(`${library}:${id}`);
    if (!found) throw new RpcError('not-found', 'no such entry');
    return { name: found.name, extension: path.extname(found.file).slice(1).toLowerCase() };
  }

  async exportTo(library: Exclude<LibraryName, 'voices'>, id: string, target: string): Promise<void> {
    const found = this.entries.get(`${library}:${id}`);
    if (!found) throw new RpcError('not-found', 'no such entry');
    await fs.writeFile(target, found.bytes, { flag: 'wx' });
  }
}

export interface PackWorldOptions {
  now?: () => Date;
  previewNow?: () => number;
  onStep?: (step: PackInstallStep) => void | Promise<void>;
}

/** Template, skill and pack folders under `root`, with built-in catalogs of their own, a fake library and the pack services wired as the Runtime wires them. */
export async function packWorld(root: string, options: PackWorldOptions = {}) {
  const builtinTemplates = path.join(root, 'builtin-templates');
  const builtinSkills = path.join(root, 'builtin-skills');
  const home = path.join(root, 'home');
  const templatesDir = path.join(home, 'templates');
  const skillsDir = path.join(home, 'skills');
  const packsDir = path.join(home, 'packs');
  await fs.mkdir(builtinTemplates, { recursive: true });
  await fs.mkdir(builtinSkills, { recursive: true });
  const prefs = new SkillPrefsStore(path.join(home, 'store', 'skill-prefs.json'));
  await prefs.load();
  const skills = new SkillCatalog({ builtinDir: builtinSkills, userDir: skillsDir, prefs });
  const library = new FakePackLibrary();
  const registry = new PackRegistry({ dir: packsDir, templatesDir, skillsDir, library });
  const templates = new TemplateCatalog({ builtinDir: builtinTemplates, userDir: templatesDir, packOwner: () => registry.owners() });
  const previews = new PackPreviews({ dir: path.join(packsDir, '.staging'), ...(options.previewNow ? { now: options.previewNow } : {}) });
  const installer = new PackInstaller({
    registry,
    previews,
    templates,
    skills,
    library,
    source: { offlineStrict: () => false },
    ...(options.now ? { now: options.now } : {}),
    ...(options.onStep ? { onStep: options.onStep } : {}),
  });
  const exporter = new PackExporter({ registry, templates, skills, library, exclusive: (run) => installer.exclusive(run) });
  /** Writes a template directory (default files) into a folder. */
  const writeTemplate = async (dir: string, id: string, extra: Record<string, unknown> = {}) => {
    for (const [rel, body] of Object.entries(templateFiles(id, extra))) {
      await fs.mkdir(path.join(dir, id), { recursive: true });
      await fs.writeFile(path.join(dir, id, rel), body);
    }
    return path.join(dir, id);
  };
  /** Writes a skill directory into a folder. */
  const writeSkillDir = async (dir: string, id: string, body?: string) => {
    await fs.mkdir(path.join(dir, id), { recursive: true });
    await fs.writeFile(path.join(dir, id, 'SKILL.md'), skillFile(id, body));
    return path.join(dir, id);
  };
  return {
    root,
    home,
    builtinTemplates,
    builtinSkills,
    templatesDir,
    skillsDir,
    packsDir,
    prefs,
    skills,
    library,
    registry,
    templates,
    previews,
    installer,
    exporter,
    writeTemplate,
    writeSkillDir,
  };
}

export type PackWorld = Awaited<ReturnType<typeof packWorld>>;
