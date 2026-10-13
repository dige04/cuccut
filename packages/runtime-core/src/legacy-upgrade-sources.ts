import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { readJson } from '@cuccut/runtime-storage';
import { readLegacyKeychainSecret } from './legacy-upgrade-keychain.ts';

const execute = promisify(execFile);
export type LegacyObject = Record<string, any>;
export interface LegacySource {
  root: string;
  config: LegacyObject;
  preferences: LegacyObject;
  cloud: LegacyObject;
  projects: { path: string; entry: LegacyObject }[];
  v1PreferenceFiles?: string[];
}

/** Custom homes stay isolated; the default desktop launcher explicitly enables historical detection. */
export function legacyRoots(env = process.env, platform = process.platform, userHome = os.homedir()): string[] {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  if (env.CUCCUT_LEGACY_ROOT) return [paths.resolve(env.CUCCUT_LEGACY_ROOT)];
  const root = env.CUCCUT_HOME ? paths.resolve(env.CUCCUT_HOME) : null;
  const defaultRoot = paths.join(userHome, '.cuccut');
  if (
    env.CUCCUT_LEGACY_AUTO_DETECT !== '1' &&
    root &&
    (platform === 'win32' ? root.toLowerCase() !== defaultRoot.toLowerCase() : root !== defaultRoot)
  )
    return [];
  if (platform === 'darwin') {
    const support = paths.join(userHome, 'Library', 'Application Support');
    return [paths.join(support, 'CucCut'), paths.join(support, 'CucCut', 'cli'), paths.join(support, 'ccut')];
  }
  if (platform === 'win32') return env.APPDATA ? [paths.join(env.APPDATA, 'ccut'), paths.join(env.APPDATA, 'CucCut')] : [];
  return [paths.join(env.XDG_CONFIG_HOME || paths.join(userHome, '.config'), 'ccut')];
}

export function legacyPath(value: unknown, base: string, userHome = os.homedir(), platform = process.platform): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const text = value.trim();
  return paths.resolve(base, text === '~' ? userHome : /^~[/\\]/.test(text) ? paths.join(userHome, text.slice(2)) : text);
}

/** Windows shipped v2 only; a doc.json there must never trigger the macOS v1 adapter. */
export async function legacyProjectVersion(dir: string, platform = process.platform): Promise<1 | 2 | null> {
  if (await isFile(path.join(dir, 'project.json'))) return 2;
  if (platform !== 'win32' && (await isFile(path.join(dir, 'doc.json')))) return 1;
  return null;
}

export async function isFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function readLegacySource(
  root: string,
  platform = process.platform,
  options: { discoverProjects?: boolean } = {},
): Promise<LegacySource | null> {
  try {
    if (!(await fs.stat(root)).isDirectory()) return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const tomlFile = path.join(root, 'config.toml');
  const toml = (await isFile(tomlFile)) ? parseToml(await fs.readFile(tomlFile, 'utf8')) : {};
  const flattened: LegacyObject = {};
  const flatten = (value: LegacyObject, prefix = '') => {
    for (const [name, item] of Object.entries(value)) {
      const key = prefix ? `${prefix}.${name}` : name;
      if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, key);
      else flattened[key] = item;
    }
  };
  flatten(toml);
  const config = { ...flattened, ...(await readJson<LegacyObject>(path.join(root, 'config.json')))?.values };
  const preferences = (await readJson<LegacyObject>(path.join(root, 'app-v2-settings.json'))) ?? {};
  const cloud = (await readJson<LegacyObject>(path.join(root, 'cloud-settings.json'))) ?? {};
  const source: LegacySource = { root, config, preferences, cloud, projects: [] };
  if (options.discoverProjects !== false) source.projects = await discoverLegacyProjects(source, platform);
  return source;
}

/** Project discovery can touch slow external volumes; only call after Runtime readiness. */
export async function discoverLegacyProjects(source: LegacySource, platform = process.platform): Promise<LegacySource['projects']> {
  const { root, config } = source;
  const registry = await readJson<LegacyObject | LegacyObject[]>(path.join(root, 'projects.json'));
  const liveEntries: LegacyObject[] = Array.isArray(registry) ? registry : (registry?.projects ?? []);
  const archive = (await readJson<LegacyObject[]>(path.join(root, 'archive', 'projects.json'))) ?? [];
  if (!Array.isArray(archive) || !Array.isArray(liveEntries)) throw new Error('Invalid legacy project registry');
  const entries = [...archive, ...liveEntries];
  if (!Array.isArray(entries)) throw new Error('Invalid legacy project registry');
  const projects = new Map<string, LegacyObject>();
  for (const entry of entries) {
    const dir =
      legacyPath(entry.path, root) ??
      (typeof entry.id === 'string' && /^[^/\\.][^/\\]*$/.test(entry.id) ? path.join(root, 'projects', entry.id) : null);
    if (dir) projects.set(dir, entry);
  }
  const dirs = [path.join(root, 'projects'), legacyPath(config['projects.dir'], root)].filter((p): p is string => p !== null);
  for (const dir of new Set(dirs)) {
    let children;
    try {
      children = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const child of children) {
      if ((!child.isDirectory() && !child.isSymbolicLink()) || child.name.startsWith('.')) continue;
      const target = path.join(dir, child.name);
      if (await legacyProjectVersion(target, platform)) {
        if (!projects.has(target)) projects.set(target, {});
      }
    }
  }
  return [...projects].map(([path, entry]) => ({ path, entry }));
}

/**
 * One row in the import prompt (§2.7). The old title comes from the index entry; if there is none, read v2's `project.json`; if there is none, use the directory name. The last edit is the modification time of the project file.
 * Only read when the prompt is shown. Failing to read is not an error.
 */
export async function summarizeLegacyProject(
  dir: string,
  entry: LegacyObject,
  platform = process.platform,
): Promise<{ path: string; title: string; editedAt: string | null }> {
  const named = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');
  let title = named(entry.title);
  let editedAt: string | null = null;
  for (const name of platform === 'win32' ? ['project.json'] : ['project.json', 'doc.json']) {
    const file = path.join(dir, name);
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile()) continue;
      editedAt = stat.mtime.toISOString();
      if (!title && name === 'project.json') title = named((await readJson<LegacyObject>(file))?.title);
      break;
    } catch {
      /* If it cannot be read, use the directory name, and give no time */
    }
  }
  return { path: dir, title: title || path.basename(dir), editedAt };
}

/**
 * Recent activity of an old project (§2.7): the last-opened time in the old index (v2 `lastOpenedAt` is Unix seconds; v1 records `modifiedAt`) and the modification time of the project file, whichever is later.
 * null when neither can be read.
 */
export async function legacyActivityAt(dir: string, entry: LegacyObject, platform = process.platform): Promise<Date | null> {
  const { editedAt } = await summarizeLegacyProject(dir, entry, platform);
  const times = [entry.lastOpenedAt, entry.modifiedAt, editedAt].map(instant).filter((at): at is number => at !== null);
  return times.length ? new Date(Math.max(...times)) : null;
}

/** Times in the index: a number below 1e11 is seconds, otherwise milliseconds. Strings are parsed as ISO. */
function instant(value: unknown): number | null {
  const at = typeof value === 'number' ? (value < 1e11 ? value * 1000 : value) : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(at) && at > 0 ? at : null;
}

/** plutil supports XML and binary plists; never export or log secret-bearing preferences. */
export async function readV1Preferences(file: string): Promise<LegacyObject> {
  if (!(await isFile(file))) return {};
  try {
    await execute('/usr/bin/plutil', ['-lint', file], { timeout: 5000 });
    const result: LegacyObject = {};
    for (const key of [
      'vk-lang',
      'vk-models-dir',
      'vk-url-savedir',
      'vk-download-source',
      'vk-custom-mirror',
      'vk-ai-last-provider',
      'vk-ai-last-model',
    ]) {
      try {
        const { stdout } = await execute('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', file], { timeout: 5000 });
        result[key] = stdout.trimEnd();
      } catch (error) {
        if ((error as { code?: number }).code !== 1) throw error;
      }
    }
    return result;
  } catch {
    throw new Error('legacy-preferences-unavailable');
  }
}

/** Read only known CucCut accounts. Errors intentionally omit child stdout/stderr. */
export async function readLegacyKeychain(service: string, account: string): Promise<LegacyObject | null> {
  try {
    const secret = await readLegacyKeychainSecret(service, account);
    return secret === null ? null : JSON.parse(secret);
  } catch {
    throw new Error('legacy-credential-unavailable');
  }
}

export async function readV1PreferenceValue(file: string, key: string): Promise<string | null> {
  if (!(await isFile(file))) return null;
  try {
    const { stdout } = await execute('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', file], { timeout: 5000 });
    return stdout.trimEnd();
  } catch (error) {
    if ((error as { code?: number }).code === 1) return null;
    throw new Error('legacy-preference-unavailable');
  }
}
