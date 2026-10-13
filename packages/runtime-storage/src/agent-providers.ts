import { isBuiltinDriverId, isDriverId, type CustomAgentProvider } from '@cuccut/protocol';
import { JsonStoreFile, type StoreOptions } from './store-file.ts';

interface AgentProvidersFile {
  schemaVersion: 1;
  providers: CustomAgentProvider[];
}

/**
 * ACP agents added by the user (`<home>/store/agent-providers.json`, architecture design §3.11), in the order they were added.
 * The whole file is read into memory; each change writes once (atomic write; writes are serial, and a later write overwrites an earlier one). `env` may contain secrets, so the file permission is 0600.
 *
 * A broken file is renamed and kept, and treated as absent (it does not block Runtime startup). Content written by a newer version is not rewritten (`store-file.ts`). An invalid entry (malformed id, a name that clashes with a built-in or an earlier entry, an empty command) is dropped.
 */
export class AgentProviderStore {
  readonly #file: JsonStoreFile;
  #providers: CustomAgentProvider[] = [];
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<CustomAgentProvider[]> {
    const { value } = await this.#file.read({
      recognize: (raw) => (Array.isArray(raw.providers) ? (raw.providers as unknown[]) : null),
      tolerateReadErrors: true,
    });
    const raw = value ?? [];
    const seen = new Set<string>();
    this.#providers = [];
    for (const entry of raw) {
      const provider = normalize(entry);
      if (!provider || seen.has(provider.id)) continue;
      seen.add(provider.id);
      this.#providers.push(provider);
    }
    return this.list();
  }

  list(): CustomAgentProvider[] {
    return structuredClone(this.#providers);
  }

  get(id: string): CustomAgentProvider | null {
    const found = this.#providers.find((p) => p.id === id);
    return found ? structuredClone(found) : null;
  }

  /** Adds one entry and writes to disk. Throws if the id already exists (the caller checks first). */
  async add(provider: CustomAgentProvider): Promise<void> {
    const normalized = normalize(provider);
    if (!normalized) throw new Error(`Invalid agent provider config: ${provider.id}`);
    if (this.#providers.some((p) => p.id === normalized.id)) throw new Error(`Agent provider already exists: ${normalized.id}`);
    this.#providers = [...this.#providers, normalized];
    await this.#save();
  }

  /** Deletes one entry and writes to disk. Returns false without writing the file if there is no such entry. */
  async remove(id: string): Promise<boolean> {
    if (!this.#providers.some((p) => p.id === id)) return false;
    this.#providers = this.#providers.filter((p) => p.id !== id);
    await this.#save();
    return true;
  }

  flush(): Promise<void> {
    return this.#saving.catch(() => {});
  }

  #save(): Promise<void> {
    const snapshot: AgentProvidersFile = {
      schemaVersion: 1,
      providers: structuredClone(this.#providers),
    };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot, { mode: 0o600 }));
    return this.#saving;
  }
}

function normalize(raw: unknown): CustomAgentProvider | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isDriverId(r.id) || isBuiltinDriverId(r.id)) return null;
  if (typeof r.name !== 'string' || !r.name.trim()) return null;
  if (!Array.isArray(r.command) || r.command.length === 0 || !r.command.every((a) => typeof a === 'string' && a.length > 0)) return null;
  const env: Record<string, string> = {};
  if (r.env && typeof r.env === 'object') {
    for (const [key, value] of Object.entries(r.env as Record<string, unknown>)) if (typeof value === 'string') env[key] = value;
  }
  return {
    id: r.id,
    name: r.name.trim(),
    command: [...(r.command as string[])],
    ...(Object.keys(env).length ? { env } : {}),
    addedAt: typeof r.addedAt === 'string' && !Number.isNaN(Date.parse(r.addedAt)) ? r.addedAt : new Date(0).toISOString(),
  };
}
