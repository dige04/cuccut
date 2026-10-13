import fs from 'node:fs/promises';
import {
  CredentialStoreError,
  checkCredentialKey,
  checkCredentialSecret,
  providerCredentialKey,
  type CredentialStore,
} from './credential-store.ts';
import { writeJsonAtomic } from './json-file.ts';
import { readJsonOrQuarantine, type StoreLog } from './store-file.ts';
import { RuntimeStorageCredentials as SC } from '@cuccut/protocol/messages/runtime-storage';

/**
 * Credential storage for development builds (architecture design §6.8): `<home>/store/model-credentials.json`, 0600, written through a temporary file and a rename.
 *
 * - The file is `{ formatVersion: 2, credentials: { "<key>": "<secret>" } }`, with namespaced keys (`provider:openai`, `node:<nodeId>`).
 * - Earlier versions wrote `{ formatVersion: 1, credentials: { "<providerId>": "<secret>" } }`. It is read as is, with each providerId treated as
 *   `provider:<providerId>`; the next write converts it to the new format.
 * - The file is read on the first operation. After that, the in-memory state is authoritative and the file is its snapshot. Writes are serial. If the file does not exist (or is empty), start from empty.
 * - If the file cannot be read, is not JSON, is not recognized, or was written by a newer version, do not start from empty, and do not rename or overwrite it. Every operation fails with
 *   `CredentialStoreError('unavailable')` (Providers and nodes report credentials as unavailable, honestly). The same reason is logged as a warning only once. The next operation re-reads the file,
 *   so once the file is fixed or moved away, it recovers without a restart.
 */
export class FileCredentialStore implements CredentialStore {
  readonly kind = 'file' as const;
  readonly file: string;
  #entries: Map<string, string> | null = null;
  #chain: Promise<unknown> = Promise.resolve();

  readonly #log: StoreLog | undefined;
  /** Reason the last file read failed. The same reason is logged only once. */
  #unreadable: string | null = null;

  constructor(file: string, options: { log?: StoreLog } = {}) {
    this.file = file;
    this.#log = options.log;
  }

  get(key: string): Promise<string | null> {
    checkCredentialKey(key);
    return this.#serial(async (entries) => entries.get(key) ?? null);
  }

  has(key: string): Promise<boolean> {
    checkCredentialKey(key);
    return this.#serial(async (entries) => entries.has(key));
  }

  set(key: string, secret: string): Promise<void> {
    checkCredentialKey(key);
    checkCredentialSecret(secret);
    return this.#serial(async (entries) => {
      // Write the file before changing memory: if the write fails, neither changes.
      await this.#write(new Map(entries).set(key, secret));
      entries.set(key, secret);
    });
  }

  delete(key: string): Promise<void> {
    checkCredentialKey(key);
    return this.#serial(async (entries) => {
      if (!entries.has(key)) return;
      const next = new Map(entries);
      next.delete(key);
      await this.#write(next);
      entries.delete(key);
    });
  }

  /** Which keys are in the file (no secrets). Only for migration; not on the `CredentialStore` interface. */
  keys(): Promise<string[]> {
    return this.#serial(async (entries) => [...entries.keys()]);
  }

  /** Deletes the file once it has no secrets left (after migrating to the keychain). Does nothing while secrets remain. */
  removeIfEmpty(): Promise<boolean> {
    return this.#serial(async (entries) => {
      if (entries.size > 0) return false;
      await fs.rm(this.file, { force: true });
      return true;
    });
  }

  #serial<T>(run: (entries: Map<string, string>) => Promise<T>): Promise<T> {
    const next = this.#chain.then(async () => run(await this.#load()));
    this.#chain = next.catch(() => {});
    return next;
  }

  async #load(): Promise<Map<string, string>> {
    if (this.#entries) return this.#entries;
    let code: string;
    try {
      const read = await readJsonOrQuarantine(this.file, {
        log: this.#unreadable === null ? this.#log : undefined,
        version: { key: 'formatVersion', known: 2 },
        quarantine: false,
        recognize: parse,
      });
      if (read.status === 'ok' || read.status === 'missing' || read.status === 'empty') {
        this.#unreadable = null;
        return (this.#entries = read.value ?? new Map());
      }
      code = read.status;
    } catch (error) {
      code = (error as NodeJS.ErrnoException).code ?? 'unknown';
      if (this.#unreadable !== code) this.#log?.warn('Credential file could not be read; left in place', { code });
    }
    this.#unreadable = code;
    // No caching: every operation reports unavailable, and once the file is fixed, the next operation can read it.
    throw new CredentialStoreError('unavailable', SC.fileUnreadable({ code }).text);
  }

  async #write(entries: Map<string, string>): Promise<void> {
    const credentials = Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    try {
      await writeJsonAtomic(this.file, { formatVersion: 2, credentials }, { mode: 0o600 });
      // The umask may have loosened the new file's permissions, so tighten them once more after the rename.
      await fs.chmod(this.file, 0o600);
    } catch (error) {
      // Filesystem error messages contain only the path and the reason, never secrets.
      throw new CredentialStoreError('internal', SC.fileWriteFailed({ code: (error as NodeJS.ErrnoException).code ?? 'unknown' }).text);
    }
  }
}

function parse(value: Record<string, unknown>): Map<string, string> | null {
  const { formatVersion, credentials } = value;
  if ((formatVersion !== 1 && formatVersion !== 2) || typeof credentials !== 'object' || credentials === null || Array.isArray(credentials)) return null;
  const entries = new Map<string, string>();
  for (const [id, secret] of Object.entries(credentials as Record<string, unknown>)) {
    if (typeof secret !== 'string' || !secret) continue;
    // In version 1, the key is the providerId without a namespace.
    const key = formatVersion === 1 ? providerCredentialKey(id) : id;
    try {
      checkCredentialKey(key);
    } catch {
      continue;
    }
    entries.set(key, secret);
  }
  return entries;
}
