import { isPackId, type PackStyleChoice } from '@cuccut/protocol';
import { JsonStoreFile, type StoreOptions } from './store-file.ts';

/** Storage shape of style choices: one entry per project that chose; a project without one decides on its own. */
export interface PackChoices {
  /** projectId → a pack id or `'none'`. */
  projects: Record<string, string>;
}

interface PackChoicesFile extends PackChoices {
  schemaVersion: 1;
}

/** Longest project id kept (the protocol's id limit). */
const PROJECT_ID_MAX = 200;

/**
 * Each project's style guide choice (pack spec §7, `store/pack-choices.json`). Stores only the projects that chose: an absent key means "decide on its own"
 * (`packs.choose` with `null` deletes it). A choice that names a pack removed since stays as written; the resolver reads it as none and says why.
 * The whole file is read into memory and written once per change; writes are serialized. Broken entries are dropped; a file that is not JSON is renamed and kept, and the
 * store starts empty; a file written by a newer version is not rewritten (`store-file.ts`). None of this blocks Runtime startup.
 */
export class PackChoicesStore {
  readonly #file: JsonStoreFile;
  #choices: PackChoices = { projects: {} };
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<PackChoices> {
    const { value } = await this.#file.read({ recognize: (raw) => raw as Partial<PackChoicesFile>, tolerateReadErrors: true });
    this.#choices = normalize(value ?? {});
    return this.get();
  }

  get(): PackChoices {
    return structuredClone(this.#choices);
  }

  /** The project's choice: a pack id, `'none'`, or null (never chose; decide on its own). */
  choice(projectId: string): PackStyleChoice {
    return Object.hasOwn(this.#choices.projects, projectId) ? this.#choices.projects[projectId]! : null;
  }

  /** Records a choice; null forgets it. Nothing is written when it is unchanged. */
  async set(projectId: string, pack: PackStyleChoice): Promise<PackChoices> {
    if (this.choice(projectId) === pack) return this.get();
    return this.#update((choices) => {
      if (pack === null) delete choices.projects[projectId];
      else choices.projects[projectId] = pack;
    });
  }

  /** When a project is removed, forget its choice too. Nothing is written if there is none. */
  forget(projectId: string): Promise<PackChoices> {
    return this.set(projectId, null);
  }

  flush(): Promise<void> {
    return this.#saving;
  }

  async #update(update: (choices: PackChoices) => void): Promise<PackChoices> {
    const next = this.get();
    update(next);
    this.#choices = normalize(next);
    const snapshot: PackChoicesFile = { schemaVersion: 1, ...this.#choices };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    await this.#saving;
    return this.get();
  }
}

function normalize(data: Partial<PackChoices>): PackChoices {
  const projects: Record<string, string> = {};
  const raw = data.projects;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [projectId, value] of Object.entries(raw)) {
      if (!projectId || projectId.length > PROJECT_ID_MAX || typeof value !== 'string') continue;
      if (value === 'none' || isPackId(value)) projects[projectId] = value;
    }
  }
  return { projects };
}
