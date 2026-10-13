import { SKILL_ID_PATTERN } from '@cuccut/protocol';
import { JsonStoreFile, type StoreOptions } from './store-file.ts';

/** Storage shape of skill toggles: `enabled` holds only the ones the user changed that differ from the source default. */
export interface SkillPrefs {
  enabled: Record<string, boolean>;
}

interface SkillPrefsFile extends SkillPrefs {
  schemaVersion: 1;
}

/**
 * Agent skill toggles (architecture design §3.8). Stores only the delta from the source default. If the default changes later, skills the user has not touched follow the new default.
 * The whole file is read into memory and written once per change. Writes are serialized. Unknown or broken entries in the file are dropped and do not block Runtime startup. If the whole file is not JSON, it is renamed and kept, and the store starts empty. Files written by a newer version are not rewritten (`store-file.ts`).
 */
export class SkillPrefsStore {
  readonly #file: JsonStoreFile;
  #prefs: SkillPrefs = { enabled: {} };
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<SkillPrefs> {
    const { value } = await this.#file.read({ recognize: (raw) => raw as Partial<SkillPrefsFile>, tolerateReadErrors: true });
    this.#prefs = normalize(value ?? {});
    return this.get();
  }

  get(): SkillPrefs {
    return structuredClone(this.#prefs);
  }

  /** The user's toggle. undefined if it was never set (the source default applies). */
  override(id: string): boolean | undefined {
    return Object.hasOwn(this.#prefs.enabled, id) ? this.#prefs.enabled[id] : undefined;
  }

  /** Records a toggle. Deletes the delta when it equals the default. */
  set(id: string, enabled: boolean, defaultEnabled: boolean): Promise<SkillPrefs> {
    return this.#update((prefs) => {
      if (enabled === defaultEnabled) delete prefs.enabled[id];
      else prefs.enabled[id] = enabled;
    });
  }

  /** When a skill is removed, forget its toggle too. Nothing is written if there is no record. */
  async forget(id: string): Promise<SkillPrefs> {
    if (!Object.hasOwn(this.#prefs.enabled, id)) return this.get();
    return this.#update((prefs) => {
      delete prefs.enabled[id];
    });
  }

  flush(): Promise<void> {
    return this.#saving;
  }

  async #update(update: (prefs: SkillPrefs) => void): Promise<SkillPrefs> {
    const next = this.get();
    update(next);
    this.#prefs = normalize(next);
    const snapshot: SkillPrefsFile = { schemaVersion: 1, ...this.#prefs };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    await this.#saving;
    return this.get();
  }
}

function normalize(data: Partial<SkillPrefs>): SkillPrefs {
  const enabled: Record<string, boolean> = {};
  const raw = data.enabled;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === 'boolean' && SKILL_ID_PATTERN.test(id)) enabled[id] = value;
    }
  }
  return { enabled };
}
