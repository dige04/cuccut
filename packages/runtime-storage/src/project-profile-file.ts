import fs from 'node:fs/promises';
import path from 'node:path';
import { PROFILE_LIMITS, clipProfileText, type ProfileRule } from '@cuccut/protocol';
import { PROJECT_MARKER_DIR } from './project-marker.ts';
import { PROFILE_SCHEMA_VERSION, ProfileReadOnlyError, normalizeRules } from './profile-store.ts';
import { JsonStoreFile, type StoreLog, type StoreOptions } from './store-file.ts';

/**
 * A project's own preferences and rules (docs/cuccut/m2-profile-rules.md §3): `<project>/.ccut/profile.json`, next to the project marker.
 *
 * - Read on demand (a session start, `profile.getProject`), with no cache: the folder belongs to the user, and what is on disk is what counts.
 * - Written through one `JsonStoreFile` per path, held in a map, so that writes to the same project stay serialised; each write reads the file again first.
 * - The same rules as the workspace file: not JSON is renamed and kept; a newer `schemaVersion` is read where possible and never rewritten (`ProfileReadOnlyError`).
 * - A project folder that is missing or cannot be written: `ProjectProfileUnavailableError`. The folder is never created here.
 */

export const PROJECT_PROFILE_FILE = 'profile.json';

export function projectProfilePath(dir: string): string {
  return path.join(dir, PROJECT_MARKER_DIR, PROJECT_PROFILE_FILE);
}

export interface StoredProjectProfile {
  preferences: string;
  rules: ProfileRule[];
  /** Written by a newer version, or unreadable: shown but not changed. */
  readOnly: boolean;
}

/** The project's folder is missing or cannot be written. */
export class ProjectProfileUnavailableError extends Error {
  readonly code = 'PROFILE_PROJECT_UNAVAILABLE';
  readonly dir: string;

  constructor(dir: string, cause?: unknown) {
    super(`Project folder is missing or not writable: ${dir}`, cause === undefined ? undefined : { cause });
    this.name = 'ProjectProfileUnavailableError';
    this.dir = dir;
  }
}

/** File-system errors that mean "this folder cannot take the file", rather than a bug. */
const UNAVAILABLE = new Set(['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'EROFS', 'ENOSPC', 'EDQUOT']);

export class ProjectProfileFiles {
  readonly #log: StoreLog | undefined;
  readonly #files = new Map<string, { file: JsonStoreFile; saving: Promise<unknown> }>();

  constructor(options: StoreOptions = {}) {
    this.#log = options.log;
  }

  /** The project's level as it is on disk now. A missing file (or folder) is the empty level. */
  read(dir: string): Promise<StoredProjectProfile> {
    return this.#read(this.#entry(dir).file);
  }

  /**
   * Changes the project's level: re-reads the file, lets `update` edit it (it may throw, and then nothing is written), normalises and writes it.
   * Refused with `ProfileReadOnlyError` for a newer file, and with `ProjectProfileUnavailableError` when the folder is missing or not writable.
   */
  update(dir: string, update: (draft: { preferences: string; rules: ProfileRule[] }) => void): Promise<StoredProjectProfile> {
    const entry = this.#entry(dir);
    const run = entry.saving.catch(() => {}).then(async () => {
      const stat = await fs.stat(dir).catch(() => null);
      if (!stat?.isDirectory()) throw new ProjectProfileUnavailableError(dir);
      const current = await this.#read(entry.file);
      if (current.readOnly) throw new ProfileReadOnlyError(entry.file.file);
      const draft = { preferences: current.preferences, rules: current.rules };
      update(draft);
      const next = normalizeProject(draft);
      try {
        await entry.file.write({ schemaVersion: PROFILE_SCHEMA_VERSION, ...next });
      } catch (error) {
        if (UNAVAILABLE.has((error as NodeJS.ErrnoException).code ?? '')) throw new ProjectProfileUnavailableError(dir, error);
        throw error;
      }
      return { ...next, readOnly: false };
    });
    entry.saving = run;
    return run;
  }

  #entry(dir: string): { file: JsonStoreFile; saving: Promise<unknown> } {
    const file = projectProfilePath(path.resolve(dir));
    let entry = this.#files.get(file);
    if (!entry) {
      entry = { file: new JsonStoreFile(file, this.#log), saving: Promise.resolve() };
      this.#files.set(file, entry);
    }
    return entry;
  }

  async #read(file: JsonStoreFile): Promise<StoredProjectProfile> {
    const { value } = await file.read({ version: null, recognize: (raw) => raw, tolerateReadErrors: true });
    const raw = value ?? {};
    const version = typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion) ? raw.schemaVersion : PROFILE_SCHEMA_VERSION;
    const newer = version > PROFILE_SCHEMA_VERSION;
    if (newer) this.#log?.warn('Project profile was written by a newer version; read only', { file: file.file, version, known: PROFILE_SCHEMA_VERSION });
    return { ...normalizeProject(raw), readOnly: newer || file.readOnly };
  }
}

function normalizeProject(raw: Record<string, unknown> | { preferences: unknown; rules: unknown }): { preferences: string; rules: ProfileRule[] } {
  const preferences = typeof raw.preferences === 'string' ? clipProfileText(raw.preferences, PROFILE_LIMITS.preferences) : '';
  return { preferences, rules: normalizeRules(raw.rules) };
}
