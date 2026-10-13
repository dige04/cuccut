import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from './json-file.ts';
import { quarantineFile } from './jsonl-file.ts';

/**
 * The unified rules for reading a whole-file JSON Store (architecture design §5.2).
 *
 * - File absent: `missing`. Empty file (or whitespace only): `empty`, treated as absent, logs one warn, and is not renamed (there is no content to keep).
 * - Unreadable (permissions, is a directory, or other filesystem errors): rethrown as-is, not treated as a corrupt file.
 * - Not JSON, top level not an object, or not recognized by `recognize`: renamed to keep it (`<file>.corrupt-<time>`, `quarantineFile`), logs a warn, returns `quarantined`, and the caller starts from empty (defaults).
 * - Version field higher than known (written by a newer CucCut): logs a warn, returns `newer-version`, treated as empty but **not renamed**; `JsonStoreFile` no longer writes this file afterward, so a downgraded runtime does not overwrite data from the newer version. The version check comes before the shape check: a newer version's file may have a different shape, and must not be renamed as a corrupt file.
 * - `quarantine: false` (for credentials and authorization, which must not be silently lost): when not recognized, the file is not renamed and `unrecognized` is returned, so the caller makes startup fail or enters a degraded state.
 */

/** Minimal logging interface for the Store; the Harness `Logger` structurally satisfies it. */
export interface StoreLog {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

export interface StoreOptions {
  log?: StoreLog;
}

export interface StoreFileVersion {
  /** Name of the version field, e.g. `schemaVersion`, `formatVersion`. */
  key: string;
  /** The highest version this release recognizes. */
  known: number;
  /** Turns a field value into a version number; only numbers are accepted by default. Returns null when not recognized (leaves the decision to `recognize`). */
  parse?: (value: unknown) => number | null;
}

export interface ReadStoreFileOptions<T> {
  log?: StoreLog | undefined;
  /** Default `{ key: 'schemaVersion', known: 1 }`; null means the file has no version field. */
  version?: StoreFileVersion | null;
  /** Top-level object → value; null when not recognized. */
  recognize: (raw: Record<string, unknown>) => T | null;
  /** Default true: when not recognized, the file is renamed to keep it. false means no rename; returns `unrecognized`. */
  quarantine?: boolean;
}

export type StoreFileRead<T> =
  | { status: 'ok'; value: T }
  | { status: 'missing' | 'empty' | 'unrecognized'; value: null }
  | { status: 'quarantined'; value: null; renamedTo: string }
  | { status: 'newer-version'; value: null; version: number };

export async function readJsonOrQuarantine<T>(file: string, options: ReadStoreFileOptions<T>): Promise<StoreFileRead<T>> {
  const name = path.basename(file);
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing', value: null };
    throw error;
  }
  if (text.trim() === '') {
    options.log?.warn('Store file is empty; starting from defaults', { file: name });
    return { status: 'empty', value: null };
  }
  const unrecognized = async (reason: string): Promise<StoreFileRead<T>> => {
    if (options.quarantine === false) {
      options.log?.warn('Store file is unrecognized; left in place', { file: name, reason });
      return { status: 'unrecognized', value: null };
    }
    const renamedTo = await quarantineFile(file);
    options.log?.warn('Unrecognized store file renamed; starting from defaults', { file: name, reason, renamedTo: path.basename(renamedTo) });
    return { status: 'quarantined', value: null, renamedTo };
  };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return unrecognized('not-json');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return unrecognized('not-an-object');
  const record = raw as Record<string, unknown>;
  const version = options.version === undefined ? { key: 'schemaVersion', known: 1 } : options.version;
  if (version) {
    const value = record[version.key];
    const parsed = version.parse ? version.parse(value) : typeof value === 'number' && Number.isFinite(value) ? value : null;
    if (parsed !== null && parsed > version.known) {
      options.log?.warn('Store file was written by a newer version; ignored and left untouched', {
        file: name,
        version: parsed,
        known: version.known,
      });
      return { status: 'newer-version', value: null, version: parsed };
    }
  }
  const value = options.recognize(record);
  if (value === null) return unrecognized('unrecognized-shape');
  return { status: 'ok', value };
}

/**
 * A whole-file JSON Store file: read according to the rules above. After reading a file written by a newer version, it becomes read-only: later writes are skipped (changes stay in memory only, with one warn logged), and the file is left as it is.
 */
export class JsonStoreFile {
  readonly file: string;
  readonly #log: StoreLog | undefined;
  #readOnly = false;
  #warned = false;

  constructor(file: string, log?: StoreLog) {
    this.file = file;
    this.#log = log;
  }

  /** A file written by a newer version was read (or could not be read and was treated as empty): do not write it. */
  get readOnly(): boolean {
    return this.#readOnly;
  }

  /**
   * `tolerateReadErrors`: when the filesystem cannot be read (permissions, etc.), do not throw; log a warn, treat as empty, and become read-only (a file that could not be read is not overwritten).
   * For preferences and caches that should not block Runtime startup.
   */
  async read<T>(options: Omit<ReadStoreFileOptions<T>, 'log'> & { tolerateReadErrors?: boolean }): Promise<StoreFileRead<T>> {
    this.#warned = false;
    let result: StoreFileRead<T>;
    try {
      result = await readJsonOrQuarantine(this.file, { ...options, log: this.#log });
    } catch (error) {
      if (!options.tolerateReadErrors) throw error;
      this.#log?.warn('Store file could not be read; starting from defaults', {
        file: path.basename(this.file),
        code: (error as NodeJS.ErrnoException).code ?? String(error),
      });
      this.#readOnly = true;
      return { status: 'unrecognized', value: null };
    }
    this.#readOnly = result.status === 'newer-version';
    return result;
  }

  async write(value: unknown, options: { mode?: number; durable?: boolean } = {}): Promise<void> {
    if (this.#readOnly) {
      if (!this.#warned) {
        this.#warned = true;
        this.#log?.warn('Store file was not loaded (newer version or unreadable); changes are kept in memory only', { file: path.basename(this.file) });
      }
      return;
    }
    await writeJsonAtomic(this.file, value, options);
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
