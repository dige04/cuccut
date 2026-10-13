import { isDriverId, isMessageRef, type DriverId, type DriverModel, type DriverProbe } from '@cuccut/protocol';
import { JsonStoreFile, type StoreOptions } from './store-file.ts';

/**
 * The facts in a probe result that belong to “this machine” (architecture design §3.11): whether it is installed, which version, where, whether it is logged in, and the model table.
 * A Driver's constants for this version (name, command, minimum version, install method, `verified`, `tested`, capabilities) are not in here: when read back, they are filled in by the Driver's `describe()`,
 * so no stale constants are left behind after changing CucCut versions.
 */
export const DRIVER_PROBE_FACT_KEYS = [
  'state',
  'version',
  'executable',
  'realExecutable',
  'account',
  'accountRef',
  'models',
  'configModel',
  'configModelKnown',
  'latestVersion',
  'detail',
  'detailRef',
  'checkedAt',
] as const satisfies readonly (keyof DriverProbe)[];

export type DriverProbeFacts = Pick<DriverProbe, (typeof DRIVER_PROBE_FACT_KEYS)[number]>;

/** One cache entry: machine facts, plus the user-specified executable used for the probe (the whole entry is invalidated when it differs from the current preference). */
export interface StoredDriverProbe extends DriverProbeFacts {
  executableOverride: string | null;
}

export type StoredDriverProbes = Partial<Record<DriverId, StoredDriverProbe>>;

interface AgentProbesFile {
  schemaVersion: 1;
  drivers: StoredDriverProbes;
}

const STATES = new Set<string>(['ready', 'not-installed', 'outdated', 'signed-out', 'error']);

/** Takes the machine facts to store out of a probe result. */
export function driverProbeFacts(probe: DriverProbe): DriverProbeFacts {
  const facts = {} as Record<string, unknown>;
  for (const key of DRIVER_PROBE_FACT_KEYS) facts[key] = probe[key];
  return structuredClone(facts) as unknown as DriverProbeFacts;
}

/**
 * The Agent probe cache (`<home>/store/agent-probes.json`, architecture design §3.11): each Driver's machine facts from its most recent probe.
 * At Runtime startup it is given to the UI first, and a fresh probe runs in the background. Each completed probe writes once (the whole file is overwritten; writes are serial, and a later write overwrites an earlier one).
 *
 * It is only a cache: a broken file (renamed and kept) or entries with wrong fields are treated as absent and do not block Runtime startup. Content written by a newer version is not rewritten (`store-file.ts`). Entries for unregistered Drivers, or whose executable does not match, are dropped by the caller.
 */
export class AgentProbeStore {
  readonly #file: JsonStoreFile;
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<StoredDriverProbes> {
    const { value } = await this.#file.read({
      recognize: (raw) => (raw.drivers && typeof raw.drivers === 'object' && !Array.isArray(raw.drivers) ? (raw.drivers as object) : null),
      tolerateReadErrors: true,
    });
    const raw = value ?? {};
    const result: StoredDriverProbes = {};
    for (const id of Object.keys(raw).filter(isDriverId)) {
      const entry = normalize((raw as Record<string, unknown>)[id]);
      if (entry) result[id] = entry;
    }
    return result;
  }

  /** Writes the whole file. A failed write only affects whether the cache can be used at the next startup; the caller just logs it. */
  save(drivers: StoredDriverProbes): Promise<void> {
    const snapshot: AgentProbesFile = { schemaVersion: 1, drivers: structuredClone(drivers) };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    return this.#saving;
  }

  flush(): Promise<void> {
    return this.#saving.catch(() => {});
  }
}

function normalize(raw: unknown): StoredDriverProbe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.state !== 'string' || !STATES.has(r.state)) return null;
  if (typeof r.checkedAt !== 'string' || Number.isNaN(Date.parse(r.checkedAt))) return null;
  if (!Array.isArray(r.models) || !r.models.every(isModel)) return null;
  const text = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    state: r.state as StoredDriverProbe['state'],
    version: text(r.version),
    executable: text(r.executable),
    realExecutable: text(r.realExecutable),
    account: text(r.account),
    models: r.models as DriverModel[],
    configModel: text(r.configModel),
    configModelKnown: typeof r.configModelKnown === 'boolean' ? r.configModelKnown : null,
    latestVersion: text(r.latestVersion),
    detail: text(r.detail),
    checkedAt: r.checkedAt,
    executableOverride: typeof r.executableOverride === 'string' && r.executableOverride ? r.executableOverride : null,
    ...(isMessageRef(r.accountRef) ? { accountRef: r.accountRef } : {}),
    ...(isMessageRef(r.detailRef) ? { detailRef: r.detailRef } : {}),
  };
}

function isModel(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.label === 'string' &&
    typeof m.isDefault === 'boolean' &&
    Array.isArray(m.efforts) &&
    m.efforts.every((e) => !!e && typeof e === 'object' && typeof (e as { id?: unknown }).id === 'string')
  );
}
