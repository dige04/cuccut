import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {
  DEFAULT_TEXT_CONCURRENCY,
  MAX_TEXT_CONCURRENCY,
  MODEL_SERVICE_CAPABILITIES,
  RpcError,
  TEXT_EFFORTS,
  type DeclaredModel,
  type ModelRef,
  type ModelServiceCapability,
  type ProviderAccountStatus,
  type ProviderAccountView,
  type ProviderConfigView,
  type ProviderRefreshStatus,
  type SpeechVoice,
  type TextCapabilityParameters,
  type TextEffort,
} from '@cuccut/protocol';
import { ModelsModelServiceStore as M } from '@cuccut/protocol/messages/models/model-service-store.ts';
import {
  CredentialStoreError,
  credentialProblem,
  providerCredentialKey,
  JsonStoreFile,
  type CredentialStore,
  type StoreLog,
} from '@cuccut/runtime-storage';

/**
 * Model service configuration (architecture design §6.8).
 *
 * - `<home>/store/model-services.json` (0600, temp file plus rename, `formatVersion: 2`): per-provider switches, enable times, endpoints and
 *   (for custom endpoints) declared models, accounts (ordered), the most recent model and voice lists fetched from the vendor, the default for each capability
 *   `{ providerId, modelId } | null`, and defaults for capability parameters (`generateText`'s reasoning effort and concurrency cap).
 * - A provider can have multiple accounts (one key per account). Keys are read and written through `CredentialStore`, with key `provider:<providerId>/<accountId>`
 *   (development builds use `model-credentials.json`, release builds use the keychain). The config file stores for each account only the mask computed at write time
 *   (first 3 + … + last 4; if 8 characters or fewer, all •), never the key.
 * - Selection (§6.2): a call uses the first enabled account that has a key (`resolveCredential()`); on failure it does not switch accounts. An account's `status` records only the result of the most recent call
 *   (`recordAccountResult()`) and does not trigger automatic switching.
 * - Migration: version 1 files keep keys at `provider:<providerId>`. On open, for each provider with an old key, create account `main`: first write the new key
 *   `provider:<providerId>/main`, then write the version 2 config file, and finally delete the old key (same for both backends). If the credential store cannot be read, record the reason and keep the pending
 *   marker (`legacyCredential`), try again on the next open, and do not treat it as having no key; if interrupted midway, running again gives the same result.
 *
 * Methods that read the config report only `credential: 'set' | 'missing'` and the account's mask; whether each account has a key is checked once at open and kept in memory, and the key itself
 * is fetched only via `resolveCredential()` when a request is sent, handed to the adapter, and not cached. When the credential store is unavailable, the reason is reported as-is (`credentialProblem()`),
 * with no fallback to another storage. The in-memory config is authoritative and the file is its snapshot; writes are serialized. Defaults pointing to a provider that has been deleted are still kept (§6.8).
 */

/** An account (no key). */
export interface StoredAccount {
  accountId: string;
  label: string | null;
  masked: string;
  enabled: boolean;
  region?: string;
  endpoint?: string;
  addedAt: string;
  lastUsedAt?: string;
  status: ProviderAccountStatus;
}

export interface StoredProvider {
  enabled: boolean;
  /** Time of the most recent enable (enabling is a standing authorization, §6.2); cleared on disable. */
  enabledAt: string | null;
  endpoint?: string;
  label?: string;
  /** Models declared by a custom endpoint. */
  models?: DeclaredModel[];
  /** Result of the most recent `models.refreshProvider`. */
  discovered?: DiscoveredList;
  /** Accounts (ordered). */
  accounts: StoredAccount[];
  /** The version 1 key (`provider:<providerId>`) has not yet been migrated into an account: the credential store could not be read at the last open; try again on the next open. */
  legacyCredential?: true;
}

/**
 * List fetched from the vendor (§6.8): `ok` has `models` (the vendor's model IDs) and optional `voices` (voices on the account); when it cannot be fetched, only the time
 * and reason are recorded, and the built-in list continues to be used.
 */
export interface DiscoveredList {
  at: string;
  ok: boolean;
  models?: string[];
  voices?: SpeechVoice[];
  error?: string;
}

interface ServicesFile {
  formatVersion: 2;
  providers: Record<string, StoredProvider>;
  defaults: Partial<Record<ModelServiceCapability, ModelRef | null>>;
  /** Defaults for capability parameters; unset fields use factory values. */
  parameters: { generateText?: { effort?: TextEffort; concurrency?: number } };
}

export interface ModelServiceStorePaths {
  modelServicesFile: string;
}

/** `details.code` of the gateway error when a credential store read or write fails (command and protocol spec §11). */
export const CREDENTIAL_UNAVAILABLE = 'CREDENTIAL_UNAVAILABLE';

/** The key in the credential store for an account's key (§6.8). */
export function accountCredentialKey(providerId: string, accountId: string): string {
  return `${providerCredentialKey(providerId)}/${accountId}`;
}

/** Key mask (computed once at write time): first 3 + … + last 4; if 8 characters or fewer, always 8 • (does not reveal the length). */
export function maskCredential(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}

/** The id of the first account, created by migration and by `models.configure`. */
export const MAIN_ACCOUNT_ID = 'main';
/** `lastUsedAt` is persisted to disk at most this often (state changes are persisted immediately). */
const LAST_USED_FLUSH_MS = 60_000;

export interface AccountPatch {
  label?: string | null;
  credential?: string;
  enabled?: boolean;
  region?: string | null;
  endpoint?: string | null;
}

export class ModelServiceStore {
  readonly #file: JsonStoreFile;
  readonly #services: ServicesFile;
  readonly #credentials: CredentialStore;
  /** Accounts with a key (`<providerId>/<accountId>`; checked once at open, then updated on change). */
  readonly #present = new Set<string>();
  /** Providers whose key cannot be checked or fetched, with the reason (no key included). */
  readonly #problems = new Map<string, string>();
  /** Listener for account state changes (`ModelServices` recomputes the view from this). */
  readonly #listeners = new Set<() => void>();
  /** Each account's most recently persisted `lastUsedAt` (milliseconds). */
  readonly #flushedUse = new Map<string, number>();
  /** Providers that could not be migrated at open (the credential store could not be read): the reason is reported until the next open. */
  readonly #migrationFailed = new Set<string>();
  #chain: Promise<void> = Promise.resolve();

  private constructor(file: JsonStoreFile, services: ServicesFile, credentials: CredentialStore) {
    this.#file = file;
    this.#services = services;
    this.#credentials = credentials;
  }

  /**
   * Read the config file (if absent, start from an empty config, written only on the first change; if it is not JSON or unrecognized, rename it to keep it and start empty; a file written by a newer version, or one that cannot be read,
   * is treated as empty and not written again, see `store-file.ts`), migrate version 1 keys into accounts, then check each account in the credential store
   * for a key. If a check fails, record the reason rather than failing the open.
   *
   * Migration order (§6.8): first write the key to the new key `provider:<id>/main`, then write the version 2 config file, and finally delete the old key. If writing the config fails, do not delete the old key;
   * the version 1 file and old key both remain, and migration runs again on the next open. If the old key cannot be deleted, keep the pending marker and delete it on the next open (the account already exists, only the old key is deleted).
   */
  static async open(
    paths: ModelServiceStorePaths,
    credentials: CredentialStore,
    now: () => string = () => new Date().toISOString(),
    options: { log?: StoreLog } = {},
  ): Promise<ModelServiceStore> {
    const file = new JsonStoreFile(paths.modelServicesFile, options.log);
    const { value } = await file.read({
      version: { key: 'formatVersion', known: 2 },
      recognize: (raw) => (raw.formatVersion === 1 || raw.formatVersion === 2 ? raw : null),
      tolerateReadErrors: true,
    });
    const { services, legacy } = parseServices(value);
    const store = new ModelServiceStore(file, services, credentials);
    const pendingDelete: string[] = [];
    let changed = legacy;
    for (const [providerId, provider] of Object.entries(services.providers)) {
      if (!provider.legacyCredential) continue;
      const result = await store.#migrate(providerId, provider, now);
      if (result === 'delete-legacy') pendingDelete.push(providerId);
      if (result !== 'failed') changed = true;
    }
    for (const [providerId, provider] of Object.entries(services.providers)) {
      for (const account of provider.accounts) {
        try {
          if (await credentials.has(accountCredentialKey(providerId, account.accountId))) store.#present.add(presenceKey(providerId, account.accountId));
        } catch (error) {
          store.#problems.set(providerId, credentialProblem(error).message);
        }
      }
    }
    if (!changed) return store;
    try {
      await store.#save();
    } catch {
      return store; // The version 1 file and old key both still exist: migrate again on the next open.
    }
    let cleared = false;
    for (const providerId of pendingDelete) {
      try {
        await credentials.delete(providerCredentialKey(providerId));
        delete services.providers[providerId]!.legacyCredential;
        cleared = true;
      } catch {
        // The old key could not be deleted: keep the marker, delete it on the next open; usage is not affected.
      }
    }
    if (cleared) await store.#save().catch(() => {});
    return store;
  }

  /**
   * Migrate one provider's version 1 key: if there is no `main` account yet, write the old key's secret to the new key and create the account (the mask is computed from the key); while the old key still exists, return
   * `delete-legacy`, to be deleted after the config is written. With no old key, clear the marker (a provider without a credential does not create an account). If the credential store cannot be read, record the reason, keep
   * the marker, and return `failed`.
   */
  async #migrate(providerId: string, provider: StoredProvider, now: () => string): Promise<'delete-legacy' | 'done' | 'failed'> {
    try {
      const secret = await this.#credentials.get(providerCredentialKey(providerId));
      if (secret === null) {
        delete provider.legacyCredential;
        return 'done';
      }
      if (!provider.accounts.some((a) => a.accountId === MAIN_ACCOUNT_ID)) {
        await this.#credentials.set(accountCredentialKey(providerId, MAIN_ACCOUNT_ID), secret);
        provider.accounts.unshift(newAccount(MAIN_ACCOUNT_ID, secret, now(), {}));
      }
      return 'delete-legacy';
    } catch (error) {
      this.#problems.set(providerId, credentialProblem(error).message);
      this.#migrationFailed.add(providerId);
      return 'failed';
    }
  }

  /** Providers that have been configured (including disabled ones). */
  providerIds(): string[] {
    return Object.keys(this.#services.providers);
  }

  provider(providerId: string): StoredProvider | null {
    const found = this.#services.providers[providerId];
    return found ? structuredClone(found) : null;
  }

  /** Whether there is at least one enabled account with a key. */
  hasCredential(providerId: string): boolean {
    return (this.#services.providers[providerId]?.accounts ?? []).some(
      (a) => a.enabled && this.#present.has(presenceKey(providerId, a.accountId)),
    );
  }

  /** The first enabled account with a key (does not fetch the key; the description and model listing use its region and endpoint). */
  activeAccount(providerId: string): StoredAccount | null {
    const found = (this.#services.providers[providerId]?.accounts ?? []).find(
      (a) => a.enabled && this.#present.has(presenceKey(providerId, a.accountId)),
    );
    return found ? structuredClone(found) : null;
  }

  /** The reason the credential store could not read this provider's key; null when there is no problem. */
  credentialProblem(providerId: string): string | null {
    return this.#problems.get(providerId) ?? null;
  }

  /** Key for the adapter (of the first enabled account with a key). See `resolveCredential()`. */
  async credential(providerId: string): Promise<string | null> {
    return (await this.resolveCredential(providerId))?.secret ?? null;
  }

  /**
   * The account and key used for this call (§6.2): take the first enabled account that has a key, in order; null if there is none. Fetched only when the request is sent, and not cached elsewhere.
   * When the credential store is unavailable, throw `CredentialStoreError` and record the reason (later views report it); on success, clear any previously recorded problem.
   */
  async resolveCredential(providerId: string): Promise<{ accountId: string; secret: string } | null> {
    const accounts = (this.#services.providers[providerId]?.accounts ?? []).filter((a) => a.enabled);
    try {
      for (const account of accounts) {
        const secret = await this.#credentials.get(accountCredentialKey(providerId, account.accountId));
        const key = presenceKey(providerId, account.accountId);
        if (secret === null) {
          this.#present.delete(key);
          continue;
        }
        this.#present.add(key);
        if (!this.#migrationFailed.has(providerId)) this.#problems.delete(providerId);
        return { accountId: account.accountId, secret };
      }
      // Version 1 key not yet migrated (credential store cannot be read): this is credentials unavailable, not no key (§6.8).
      if (this.#migrationFailed.has(providerId)) {
        throw new CredentialStoreError('unavailable', this.#problems.get(providerId) ?? M.notMigrated().text);
      }
      this.#problems.delete(providerId);
      return null;
    } catch (error) {
      if (error instanceof CredentialStoreError && this.#migrationFailed.has(providerId)) throw error;
      this.#problems.set(providerId, credentialProblem(error).message);
      throw error;
    }
  }

  /** One account's key (used when verifying a saved key); null if none. Throws `CredentialStoreError` and records the reason if the credential store is unavailable. */
  async accountCredential(providerId: string, accountId: string): Promise<string | null> {
    try {
      return await this.#credentials.get(accountCredentialKey(providerId, accountId));
    } catch (error) {
      this.#problems.set(providerId, credentialProblem(error).message);
      throw error;
    }
  }

  /** Read-only view: keys report only whether they exist; accounts show only the mask. */
  configView(providerId: string): ProviderConfigView {
    const stored = this.#services.providers[providerId];
    return {
      enabled: stored?.enabled ?? false,
      enabledAt: stored?.enabledAt ?? null,
      credential: this.hasCredential(providerId) ? 'set' : 'missing',
      accounts: (stored?.accounts ?? []).map((a) => this.#accountView(providerId, a)),
      ...(stored?.endpoint ? { endpoint: stored.endpoint } : {}),
      ...(stored?.discovered ? { refreshed: refreshStatus(stored.discovered) } : {}),
    };
  }

  #accountView(providerId: string, account: StoredAccount): ProviderAccountView {
    return {
      accountId: account.accountId,
      label: account.label,
      masked: account.masked,
      enabled: account.enabled,
      ...(account.region ? { region: account.region } : {}),
      ...(account.endpoint ? { endpoint: account.endpoint } : {}),
      addedAt: account.addedAt,
      ...(account.lastUsedAt ? { lastUsedAt: account.lastUsedAt } : {}),
      credential: this.#present.has(presenceKey(providerId, account.accountId)) ? 'set' : 'missing',
      status: { ...account.status },
    };
  }

  /** Notified when an account's state changes (only when `status.state` changes; `lastUsedAt` does not count). */
  onAccountChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Record the result of a refresh (on success, replace the list; on failure, discard the old list and keep using the built-in one). A provider not yet configured gets a disabled entry created. */
  async setDiscovered(providerId: string, discovered: DiscoveredList): Promise<ProviderRefreshStatus> {
    const current = this.#services.providers[providerId] ?? emptyProvider();
    this.#services.providers[providerId] = { ...current, discovered: structuredClone(discovered) };
    await this.#save();
    return refreshStatus(discovered);
  }

  /** Fill in factory values for the `generateText` parameter defaults. */
  textParameters(): TextCapabilityParameters {
    const stored = this.#services.parameters.generateText ?? {};
    return { effort: stored.effort ?? null, concurrency: stored.concurrency ?? DEFAULT_TEXT_CONCURRENCY };
  }

  /** Change the `generateText` parameter defaults: null restores factory values, undefined leaves them unchanged. */
  async setTextParameters(patch: { effort?: TextEffort | null; concurrency?: number | null }): Promise<TextCapabilityParameters> {
    const next = { ...this.#services.parameters.generateText };
    if (patch.effort === null) delete next.effort;
    else if (patch.effort !== undefined) next.effort = patch.effort;
    if (patch.concurrency === null) delete next.concurrency;
    else if (patch.concurrency !== undefined) next.concurrency = patch.concurrency;
    this.#services.parameters.generateText = next;
    await this.#save();
    return this.textParameters();
  }

  /**
   * Modify a provider's config. `enabled: true` records `enabledAt` (an already-enabled one keeps its value); `false` clears it; `endpoint: null` deletes the overridden endpoint. When `credential` (compatible with `models.configure` and the CLI) is a string, it is written to the first account (creating `main` if there are no accounts); null deletes
   * the first account; undefined leaves it unchanged. The credential is written first: if the credential store is unavailable, reject with `conflict` (`CREDENTIAL_UNAVAILABLE`) and leave the config unchanged.
   */
  async updateProvider(
    providerId: string,
    patch: {
      enabled?: boolean;
      credential?: string | null;
      endpoint?: string | null;
      label?: string;
      models?: DeclaredModel[];
    },
    now: () => string = () => new Date().toISOString(),
  ): Promise<void> {
    const current = this.#services.providers[providerId] ?? emptyProvider();
    const next: StoredProvider = { ...current, accounts: current.accounts.map((a) => ({ ...a })) };
    if (patch.credential !== undefined) {
      const first = next.accounts[0];
      if (patch.credential === null) {
        if (first) {
          await this.#credentialWrite(providerId, () => this.#credentials.delete(accountCredentialKey(providerId, first.accountId)));
          this.#present.delete(presenceKey(providerId, first.accountId));
          next.accounts.shift();
        }
      } else {
        const accountId = first?.accountId ?? this.#freshAccountId(next, MAIN_ACCOUNT_ID);
        const secret = patch.credential;
        await this.#credentialWrite(providerId, () => this.#credentials.set(accountCredentialKey(providerId, accountId), secret));
        this.#present.add(presenceKey(providerId, accountId));
        if (first) Object.assign(first, { masked: maskCredential(secret), status: { state: 'unknown' } });
        else next.accounts.push(newAccount(accountId, secret, now(), {}));
      }
    }
    if (patch.enabled === true && !current.enabled) Object.assign(next, { enabled: true, enabledAt: now() });
    if (patch.enabled === false) Object.assign(next, { enabled: false, enabledAt: null });
    if (patch.endpoint === null) delete next.endpoint;
    else if (patch.endpoint !== undefined) next.endpoint = patch.endpoint;
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.models !== undefined) next.models = structuredClone(patch.models);
    this.#services.providers[providerId] = next;
    await this.#save();
  }

  /**
   * Add an account (appended at the end) and return its id. If the provider has not been configured yet, create one (the switch is not changed). The credential is written first: if the credential store is unavailable, reject with
   * `conflict` (`CREDENTIAL_UNAVAILABLE`) and leave the config unchanged.
   */
  async addAccount(
    providerId: string,
    input: { credential: string; label?: string; region?: string; endpoint?: string },
    now: () => string = () => new Date().toISOString(),
  ): Promise<string> {
    const current = this.#services.providers[providerId] ?? emptyProvider();
    const accountId = current.accounts.length === 0 ? this.#freshAccountId(current, MAIN_ACCOUNT_ID) : this.#freshAccountId(current);
    await this.#credentialWrite(providerId, () => this.#credentials.set(accountCredentialKey(providerId, accountId), input.credential));
    this.#present.add(presenceKey(providerId, accountId));
    const account = newAccount(accountId, input.credential, now(), input);
    this.#services.providers[providerId] = { ...current, accounts: [...current.accounts, account] };
    await this.#save();
    return accountId;
  }

  /** Modify an account; `not-found` if there is no such account. When the key is replaced, the credential is written first and the status returns to `unknown`. */
  async updateAccount(providerId: string, accountId: string, patch: AccountPatch): Promise<void> {
    const provider = this.#services.providers[providerId];
    const index = provider?.accounts.findIndex((a) => a.accountId === accountId) ?? -1;
    if (!provider || index < 0) throw accountNotFound(providerId, accountId);
    const next: StoredAccount = { ...provider.accounts[index]! };
    if (patch.credential !== undefined) {
      const secret = patch.credential;
      await this.#credentialWrite(providerId, () => this.#credentials.set(accountCredentialKey(providerId, accountId), secret));
      this.#present.add(presenceKey(providerId, accountId));
      next.masked = maskCredential(secret);
      next.status = { state: 'unknown' };
    }
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.enabled !== undefined) next.enabled = patch.enabled;
    if (patch.region === null) delete next.region;
    else if (patch.region !== undefined) next.region = patch.region;
    if (patch.endpoint === null) delete next.endpoint;
    else if (patch.endpoint !== undefined) next.endpoint = patch.endpoint;
    const accounts = [...provider.accounts];
    accounts[index] = next;
    this.#services.providers[providerId] = { ...provider, accounts };
    await this.#save();
  }

  /** Delete an account and its key (delete the credential first). `not-found` if there is no such account. Deleting the last account does not remove the provider. */
  async removeAccount(providerId: string, accountId: string): Promise<void> {
    const provider = this.#services.providers[providerId];
    if (!provider?.accounts.some((a) => a.accountId === accountId)) throw accountNotFound(providerId, accountId);
    await this.#credentialWrite(providerId, () => this.#credentials.delete(accountCredentialKey(providerId, accountId)));
    this.#present.delete(presenceKey(providerId, accountId));
    this.#services.providers[providerId] = { ...provider, accounts: provider.accounts.filter((a) => a.accountId !== accountId) };
    await this.#save();
  }

  /** The new order of accounts: must be exactly a permutation of the existing accounts, otherwise `invalid-request`. */
  async arrangeAccounts(providerId: string, order: string[]): Promise<void> {
    const provider = this.#services.providers[providerId] ?? emptyProvider();
    const byId = new Map(provider.accounts.map((a) => [a.accountId, a]));
    if (order.length !== byId.size || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
      throw new RpcError('invalid-request', M.orderMismatch(), { accounts: [...byId.keys()] });
    }
    this.#services.providers[providerId] = { ...provider, accounts: order.map((id) => byId.get(id)!) };
    await this.#save();
  }

  /**
   * Record the result of one call (§6.2: record only, do not switch accounts). When `status` is null, only `lastUsedAt` is updated (e.g., a failure unrelated to the key).
   * On a state change, persist immediately and notify listeners; `lastUsedAt` is persisted at most once per minute. If the account no longer exists, do nothing.
   */
  recordAccountResult(providerId: string, accountId: string, at: string, status: ProviderAccountStatus | null): void {
    const account = this.#services.providers[providerId]?.accounts.find((a) => a.accountId === accountId);
    if (!account) return;
    account.lastUsedAt = at;
    const changed = status !== null && JSON.stringify(status) !== JSON.stringify(account.status);
    const stateChanged = status !== null && status.state !== account.status.state;
    if (status !== null) account.status = { ...status };
    const key = presenceKey(providerId, accountId);
    const atMs = Date.parse(at);
    if (changed || !(atMs - (this.#flushedUse.get(key) ?? 0) < LAST_USED_FLUSH_MS)) {
      this.#flushedUse.set(key, atMs);
      void this.#save().catch(() => {});
    }
    if (stateChanged) for (const listener of this.#listeners) listener();
  }

  /**
   * Delete a provider's config and all of its accounts' keys (and any old version 1 key left behind). Defaults pointing to it are kept. Returns false if it does not exist.
   * Delete the credentials first: if the credential store is unavailable, reject with `conflict` (`CREDENTIAL_UNAVAILABLE`) and leave the config unchanged (so no undeletable keys remain; accounts already deleted are removed from the config, and a retry continues deleting the rest).
   */
  async removeProvider(providerId: string): Promise<boolean> {
    const provider = this.#services.providers[providerId];
    if (!provider) return false;
    for (const account of [...provider.accounts]) {
      try {
        await this.#credentialWrite(providerId, () => this.#credentials.delete(accountCredentialKey(providerId, account.accountId)));
      } catch (error) {
        await this.#save().catch(() => {});
        throw error;
      }
      this.#present.delete(presenceKey(providerId, account.accountId));
      provider.accounts = provider.accounts.filter((a) => a.accountId !== account.accountId);
    }
    await this.#credentialWrite(providerId, () => this.#credentials.delete(providerCredentialKey(providerId)));
    this.#problems.delete(providerId);
    delete this.#services.providers[providerId];
    await this.#save();
    return true;
  }

  getDefault(capability: ModelServiceCapability): ModelRef | null {
    const found = this.#services.defaults[capability];
    return found ? { ...found } : null;
  }

  async setDefault(capability: ModelServiceCapability, ref: ModelRef | null): Promise<void> {
    this.#services.defaults[capability] = ref ? { providerId: ref.providerId, modelId: ref.modelId } : null;
    await this.#save();
  }

  /** Writes waiting in the queue (used in tests and on stop). */
  flush(): Promise<void> {
    return this.#chain;
  }

  /** Id for a new account: use the preferred id if given and not taken, otherwise a random 8-character hex string. */
  #freshAccountId(provider: StoredProvider, preferred?: string): string {
    const taken = new Set(provider.accounts.map((a) => a.accountId));
    if (preferred && !taken.has(preferred)) return preferred;
    for (;;) {
      const id = crypto.randomBytes(4).toString('hex');
      if (!taken.has(id)) return id;
    }
  }

  async #credentialWrite(providerId: string, write: () => Promise<void>): Promise<void> {
    try {
      await write();
      this.#problems.delete(providerId);
    } catch (error) {
      const { code, message } = credentialProblem(error);
      throw new RpcError('conflict', M.credentialNotSaved({ reason: message }), { code: CREDENTIAL_UNAVAILABLE, reason: code, providerId });
    }
  }

  #save(): Promise<void> {
    const services = structuredClone(this.#services);
    // Providers without accounts (agent providers, vendors without a key added yet) do not write `accounts`.
    for (const provider of Object.values(services.providers)) {
      if (provider.accounts.length === 0) delete (provider as Partial<StoredProvider>).accounts;
    }
    const next = this.#chain.then(() => writePrivate(this.#file, services));
    this.#chain = next.catch(() => {});
    return next;
  }
}

async function writePrivate(file: JsonStoreFile, value: unknown): Promise<void> {
  if (file.readOnly) return file.write(value); // Log a warning only once; do not write.
  await file.write(value, { mode: 0o600 });
  // umask may have loosened the new file's permissions: tighten them again after the rename.
  await fs.chmod(file.file, 0o600);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function accountNotFound(providerId: string, accountId: string): RpcError {
  return new RpcError('not-found', M.accountNotFound({ provider: providerId, account: accountId }), {
    code: 'ACCOUNT_NOT_FOUND',
    providerId,
    accountId,
  });
}

function emptyProvider(): StoredProvider {
  return { enabled: false, enabledAt: null, accounts: [] };
}

function presenceKey(providerId: string, accountId: string): string {
  return `${providerId}/${accountId}`;
}

function newAccount(
  accountId: string,
  secret: string,
  at: string,
  input: { label?: string; region?: string; endpoint?: string },
): StoredAccount {
  return {
    accountId,
    label: input.label ?? null,
    masked: maskCredential(secret),
    enabled: true,
    ...(input.region ? { region: input.region } : {}),
    ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    addedAt: at,
    status: { state: 'unknown' },
  };
}

const ACCOUNT_STATES = new Set(['ok', 'invalid-key', 'rate-limited', 'quota-exhausted', 'unknown']);

function parseAccount(raw: unknown): StoredAccount | null {
  if (!isObject(raw) || typeof raw.accountId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(raw.accountId)) return null;
  if (typeof raw.masked !== 'string' || typeof raw.addedAt !== 'string') return null;
  const status: ProviderAccountStatus = { state: 'unknown' };
  if (isObject(raw.status) && typeof raw.status.state === 'string' && ACCOUNT_STATES.has(raw.status.state)) {
    status.state = raw.status.state as ProviderAccountStatus['state'];
    for (const field of ['at', 'until', 'detail'] as const) if (typeof raw.status[field] === 'string') status[field] = raw.status[field];
  }
  return {
    accountId: raw.accountId,
    label: typeof raw.label === 'string' ? raw.label : null,
    masked: raw.masked,
    enabled: raw.enabled !== false,
    ...(typeof raw.region === 'string' ? { region: raw.region } : {}),
    ...(typeof raw.endpoint === 'string' ? { endpoint: raw.endpoint } : {}),
    addedAt: raw.addedAt,
    ...(typeof raw.lastUsedAt === 'string' ? { lastUsedAt: raw.lastUsedAt } : {}),
    status,
  };
}

/** Read version 1 and 2 files. Every provider in a version 1 file is marked pending migration (`legacy` true means the file must be rewritten as version 2). */
function parseServices(value: unknown): { services: ServicesFile; legacy: boolean } {
  const empty: ServicesFile = { formatVersion: 2, providers: {}, defaults: {}, parameters: {} };
  if (!isObject(value) || (value.formatVersion !== 1 && value.formatVersion !== 2)) return { services: empty, legacy: false };
  const legacy = value.formatVersion === 1;
  const providers: Record<string, StoredProvider> = {};
  if (isObject(value.providers)) {
    for (const [id, raw] of Object.entries(value.providers)) {
      if (!isObject(raw) || typeof raw.enabled !== 'boolean') continue;
      const entry: StoredProvider = {
        enabled: raw.enabled,
        enabledAt: raw.enabled && typeof raw.enabledAt === 'string' ? raw.enabledAt : null,
        accounts: [],
      };
      if (typeof raw.endpoint === 'string') entry.endpoint = raw.endpoint;
      if (typeof raw.label === 'string') entry.label = raw.label;
      if (Array.isArray(raw.models)) {
        entry.models = raw.models.filter((m): m is DeclaredModel => isObject(m) && typeof m.modelId === 'string' && m.modelId !== '');
      }
      const discovered = parseDiscovered(raw.discovered);
      if (discovered) entry.discovered = discovered;
      if (!legacy && Array.isArray(raw.accounts)) {
        const seen = new Set<string>();
        for (const candidate of raw.accounts) {
          const account = parseAccount(candidate);
          if (account && !seen.has(account.accountId)) {
            seen.add(account.accountId);
            entry.accounts.push(account);
          }
        }
      }
      if (legacy || raw.legacyCredential === true) entry.legacyCredential = true;
      providers[id] = entry;
    }
  }
  const defaults: ServicesFile['defaults'] = {};
  if (isObject(value.defaults)) {
    for (const capability of MODEL_SERVICE_CAPABILITIES) {
      const ref = value.defaults[capability];
      if (isObject(ref) && typeof ref.providerId === 'string' && typeof ref.modelId === 'string') {
        defaults[capability] = { providerId: ref.providerId, modelId: ref.modelId };
      }
    }
  }
  const parameters: ServicesFile['parameters'] = {};
  const text = isObject(value.parameters) ? value.parameters.generateText : undefined;
  if (isObject(text)) {
    const stored: { effort?: TextEffort; concurrency?: number } = {};
    if ((TEXT_EFFORTS as readonly unknown[]).includes(text.effort)) stored.effort = text.effort as TextEffort;
    const concurrency = text.concurrency;
    if (typeof concurrency === 'number' && Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= MAX_TEXT_CONCURRENCY) {
      stored.concurrency = concurrency;
    }
    parameters.generateText = stored;
  }
  return { services: { formatVersion: 2, providers, defaults, parameters }, legacy };
}

function parseDiscovered(value: unknown): DiscoveredList | null {
  if (!isObject(value) || typeof value.at !== 'string' || typeof value.ok !== 'boolean') return null;
  const list: DiscoveredList = { at: value.at, ok: value.ok };
  if (typeof value.error === 'string') list.error = value.error;
  if (value.ok && Array.isArray(value.models)) list.models = value.models.filter((m): m is string => typeof m === 'string' && m !== '');
  if (value.ok && Array.isArray(value.voices)) {
    list.voices = value.voices.filter(
      (v): v is SpeechVoice => isObject(v) && typeof v.voiceId === 'string' && v.voiceId !== '' && typeof v.label === 'string',
    );
  }
  return list;
}

function refreshStatus(discovered: DiscoveredList): ProviderRefreshStatus {
  return {
    at: discovered.at,
    ok: discovered.ok,
    ...(discovered.models ? { models: discovered.models.length } : {}),
    ...(discovered.voices ? { voices: discovered.voices.length } : {}),
    ...(discovered.error ? { error: discovered.error } : {}),
  };
}
