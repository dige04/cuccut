import {
  RpcError,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  type FrozenSettings,
  type SettingKey,
  type SettingSource,
  type SettingValues,
  type SettingsReader,
  type SettingsSnapshot,
  type SettingsView,
} from '@cuccut/protocol';
import { settingValueSchemas, settingsPatchSchema } from '@cuccut/protocol/schemas';
import { JsonStoreFile, isPlainObject, type StoreOptions } from './store-file.ts';
import { RuntimeStorageFiles as SF } from '@cuccut/protocol/messages/runtime-storage';

interface SettingsFile {
  schemaVersion: 1;
  /** Only stores values that differ from the defaults. Unknown keys (written by a newer version) are kept as-is but have no effect. */
  values: Record<string, unknown>;
}

export type SettingsChange = Partial<SettingValues>;

/**
 * Preferences held by the Runtime (architecture design §5.10). The file is `<runtime-home>/store/settings.json`.
 *
 * - Writes are validated as a whole batch and run serially: validate → write a temporary file, then rename it → swap the memory copy → notify. If the disk write fails, memory is unchanged. A crash does not leave a half-written file.
 * - Values in the file that do not match the schema (broken by hand edits) fall back to defaults, so the Runtime still starts. If the whole file is not valid JSON or cannot be recognized, it is renamed and kept, and all values use defaults. Files written by a newer version are not rewritten, and changes stay only in memory (`store-file.ts`, consistent with the other Runtime Store files).
 */
export class SettingsStore implements SettingsReader {
  readonly #file: JsonStoreFile;
  #raw: Record<string, unknown> = {};
  #queue: Promise<unknown> = Promise.resolve();
  readonly #listeners = new Set<(changed: SettingsChange) => void>();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<void> {
    const { value } = await this.#file.read({ recognize: (raw) => (isPlainObject(raw.values) ? raw.values : null) });
    this.#raw = { ...value };
  }

  /** The effective value of a key: the user-set value if it matches the schema, otherwise the default. */
  get<K extends SettingKey>(key: K): SettingValues[K] {
    return structuredClone(this.#effective(this.#raw, key));
  }

  /** Effective values and defaults for all keys (or for the given keys). */
  view(keys?: readonly SettingKey[]): SettingsView {
    const settings: Record<string, unknown> = {};
    const defaults: Record<string, unknown> = {};
    for (const key of keys ?? SETTING_KEYS) {
      settings[key] = this.#effective(this.#raw, key);
      defaults[key] = SETTING_DEFAULTS[key];
    }
    return structuredClone({ settings, defaults }) as SettingsView;
  }

  snapshotAll(): SettingsSnapshot {
    return this.view() as SettingsSnapshot;
  }

  /** When a task is created, freeze the values it uses and their sources (§5.10). Returns a copy. Later setting changes do not affect it. */
  snapshot<K extends SettingKey>(keys: readonly K[]): FrozenSettings<K> {
    const values = {} as Pick<SettingValues, K>;
    const sources = {} as Record<K, SettingSource>;
    for (const key of keys) {
      values[key] = structuredClone(this.#effective(this.#raw, key));
      sources[key] = this.#userValue(this.#raw, key) === undefined ? 'default' : 'user';
    }
    return { values, sources };
  }

  /**
   * Changes a group of settings. `patch` is validated as a whole batch: unknown keys or values that do not match the schema are rejected with `invalid-request`, and nothing is saved.
   * `null` restores the default. Values equal to the default are not stored separately. Returns the new full view and the keys whose effective values changed.
   */
  set(patch: unknown): Promise<{ snapshot: SettingsSnapshot; changed: SettingsChange }> {
    const run = this.#queue.then(() => this.#apply(patch));
    this.#queue = run.catch(() => {});
    return run;
  }

  /** Notifies when effective values change (after the disk write). Carries only the changed keys. */
  onChange(listener: (changed: SettingsChange) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #apply(patch: unknown): Promise<{ snapshot: SettingsSnapshot; changed: SettingsChange }> {
    const parsed = settingsPatchSchema.safeParse(patch);
    if (!parsed.success) throw new RpcError('invalid-request', SF.settingsInvalid(), parsed.error.issues);

    const next = { ...this.#raw };
    for (const [key, value] of Object.entries(parsed.data) as [SettingKey, unknown][]) {
      if (value === undefined) continue;
      if (value === null || sameValue(value, SETTING_DEFAULTS[key])) delete next[key];
      else next[key] = value;
    }
    const changed: Record<string, unknown> = {};
    for (const key of SETTING_KEYS) {
      const after = this.#effective(next, key);
      if (!sameValue(this.#effective(this.#raw, key), after)) changed[key] = structuredClone(after);
    }
    if (!sameValue(next, this.#raw)) {
      const file: SettingsFile = { schemaVersion: 1, values: next };
      await this.#file.write(file);
    }
    this.#raw = next;
    if (Object.keys(changed).length > 0) {
      for (const listener of this.#listeners) {
        try {
          listener(structuredClone(changed));
        } catch {
          // Subscriber errors do not affect changes already written to disk.
        }
      }
    }
    return { snapshot: this.snapshotAll(), changed: changed as SettingsChange };
  }

  #userValue<K extends SettingKey>(raw: Record<string, unknown>, key: K): SettingValues[K] | undefined {
    if (!Object.hasOwn(raw, key)) return undefined;
    const checked = settingValueSchemas[key].safeParse(raw[key]);
    return checked.success ? (checked.data as SettingValues[K]) : undefined;
  }

  #effective<K extends SettingKey>(raw: Record<string, unknown>, key: K): SettingValues[K] {
    return this.#userValue(raw, key) ?? SETTING_DEFAULTS[key];
  }
}

/** Structural equality of JSON values (object key order is ignored). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
