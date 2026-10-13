import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '@cuccut/harness';
import {
  FileCredentialStore,
  KeychainCredentialStore,
  migrateFileCredentials,
  type CredentialHelperCommand,
  type CredentialStore,
  type CredentialStoreKind,
  type RuntimeHome,
} from '@cuccut/runtime-storage';
import { findBundledBinary } from '@cuccut/process-host';

/**
 * Assembly of the credential store (architecture design §6.8). The backend is chosen by build type: development builds use `<home>/store/model-credentials.json`,
 * and release builds use the system's secure storage (via `credential-helper`). Online Provider keys and node tokens share the same instance.
 */

/**
 * Finding the credential helper: the `CUCCUT_CREDENTIAL_HELPER` environment variable; the native program directory shipped with the app (`CUCCUT_BIN_DIR`, the packaged `<resources>/bin`);
 * in development, search upward from this module for `{release,debug}/credential-helper` in the cargo output directory. null if none are found.
 */
export function resolveCredentialHelperCommand(env: NodeJS.ProcessEnv = process.env): CredentialHelperCommand | null {
  if (env.CUCCUT_CREDENTIAL_HELPER) return { command: env.CUCCUT_CREDENTIAL_HELPER };
  const built = findBundledBinary('credential-helper', path.dirname(fileURLToPath(import.meta.url)), env);
  return built ? { command: built } : null;
}

export interface CredentialStoreOptions {
  /** Which backend to use (default `file`), or pass an instance directly (tests). */
  kind?: CredentialStoreKind | CredentialStore;
  /** The helper command for the Keychain backend. If not given, it is found via `resolveCredentialHelperCommand()`; null means there is no helper (every operation reports unavailable). */
  helper?: CredentialHelperCommand | null;
  /** Timeout for one operation of the Keychain backend. */
  timeoutMs?: number;
}

/**
 * Opens the credential store. The Keychain backend first moves keys left over in the plaintext file into it (§6.8). If a key cannot be moved, it stays in the file and is logged, but that file is never read;
 * Providers and nodes honestly report the credentials as unavailable.
 */
export async function openCredentialStore(home: RuntimeHome, log: Logger, options: CredentialStoreOptions = {}): Promise<CredentialStore> {
  const kind = options.kind ?? 'file';
  if (typeof kind !== 'string') return kind;
  const scoped = log.child('credentials');
  const file = new FileCredentialStore(home.modelCredentialsFile, { log: scoped });
  if (kind === 'file') return file;
  const helper = options.helper !== undefined ? options.helper : resolveCredentialHelperCommand();
  if (!helper) scoped.error('Credential helper not found: secrets and node tokens are unavailable');
  const keychain = new KeychainCredentialStore({ helper, ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}) });
  await migrateFileCredentials(file, keychain, scoped);
  return keychain;
}
