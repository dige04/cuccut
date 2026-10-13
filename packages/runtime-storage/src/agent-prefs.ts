import {
  isDriverId,
  type AgentDriverPreferences,
  type AgentPolicy,
  type AgentPreferences,
  type DriverId,
} from '@cuccut/protocol';
import { JsonStoreFile, type StoreOptions } from './store-file.ts';

interface AgentPrefsFile extends AgentPreferences {
  schemaVersion: 1;
}

export const DEFAULT_AGENT_POLICY: AgentPolicy = { read: true, ccutro: true, loop: true };

export const DEFAULT_DRIVER_PREFERENCES: AgentDriverPreferences = {
  enabled: true,
  defaultModel: null,
  defaultEffort: null,
  executable: null,
};

export function defaultAgentPreferences(): AgentPreferences {
  return { drivers: {}, policy: { ...DEFAULT_AGENT_POLICY }, modelAutoUpdate: true, rules: [] };
}

/**
 * Agent preferences (Settings › Agent providers). The whole file is read into memory; each change writes once. Writes are serial, and a later write overwrites an earlier one.
 * Unrecognized or broken fields in the file fall back to defaults, so a hand-broken file does not block Runtime startup. If the whole file is not JSON, it is renamed to keep it and defaults are used.
 * Content written by a newer version is not rewritten (`store-file.ts`).
 */
export class AgentPrefsStore {
  readonly #file: JsonStoreFile;
  #prefs: AgentPreferences = defaultAgentPreferences();
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<AgentPreferences> {
    const { value } = await this.#file.read({ recognize: (raw) => raw as Partial<AgentPrefsFile>, tolerateReadErrors: true });
    this.#prefs = normalize(value ?? {});
    return this.get();
  }

  get(): AgentPreferences {
    return structuredClone(this.#prefs);
  }

  driver(id: DriverId): AgentDriverPreferences {
    return { ...DEFAULT_DRIVER_PREFERENCES, ...this.#prefs.drivers[id] };
  }

  /** Changes one preference and writes it to disk. `update` receives a copy and returns the new complete preferences. */
  async update(update: (prefs: AgentPreferences) => void): Promise<AgentPreferences> {
    const next = this.get();
    update(next);
    this.#prefs = normalize(next);
    const snapshot: AgentPrefsFile = { schemaVersion: 1, ...this.#prefs };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    await this.#saving;
    return this.get();
  }

  flush(): Promise<void> {
    return this.#saving;
  }
}

function normalize(data: Partial<AgentPreferences>): AgentPreferences {
  const base = defaultAgentPreferences();
  const drivers: AgentPreferences['drivers'] = {};
  for (const id of Object.keys(data.drivers ?? {}).filter(isDriverId)) {
    const raw = data.drivers?.[id];
    if (!raw || typeof raw !== 'object') continue;
    drivers[id] = {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      defaultModel: typeof raw.defaultModel === 'string' && raw.defaultModel ? raw.defaultModel : null,
      defaultEffort: typeof raw.defaultEffort === 'string' && raw.defaultEffort ? raw.defaultEffort : null,
      executable: typeof raw.executable === 'string' && raw.executable ? raw.executable : null,
    };
  }
  const policy = { ...base.policy };
  for (const key of Object.keys(policy) as (keyof AgentPolicy)[]) {
    if (typeof data.policy?.[key] === 'boolean') policy[key] = data.policy[key];
  }
  const rules = Array.isArray(data.rules) ? [...new Set(data.rules.filter((r): r is string => typeof r === 'string' && r.length > 0))] : [];
  return {
    drivers,
    policy,
    modelAutoUpdate: typeof data.modelAutoUpdate === 'boolean' ? data.modelAutoUpdate : base.modelAutoUpdate,
    rules,
  };
}
