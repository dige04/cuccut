import { credentialProblem, type CredentialErrorCode, type CredentialStore } from './credential-store.ts';
import type { FileCredentialStore } from './file-credential-store.ts';

/** The logging interface used by migration; the Harness's `Logger` satisfies it structurally. The fields hold only keys, never secrets. */
export interface CredentialMigrationLog {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

export interface CredentialMigrationResult {
  migrated: string[];
  failed: { key: string; code: CredentialErrorCode }[];
}

/**
 * When switching to the system's secure storage (architecture design §6.8): write each secret in the plaintext file into `to`, and delete from the file each one that was written successfully. Once all have been moved, delete the file.
 * On partial failure, the secrets not yet moved stay in the file and are retried at the next startup. Secrets in the file are not read by `to` (no fallback to plaintext). The log records only keys and reasons.
 */
export async function migrateFileCredentials(
  from: FileCredentialStore,
  to: CredentialStore,
  log?: CredentialMigrationLog,
): Promise<CredentialMigrationResult> {
  const result: CredentialMigrationResult = { migrated: [], failed: [] };
  let keys: string[];
  try {
    keys = await from.keys();
  } catch (error) {
    // The file cannot be read or its contents are not recognized: leave it as is, migrate and delete nothing (the keychain still works), and log.
    const { code, message } = credentialProblem(error);
    log?.warn('Credential file could not be read; nothing migrated and the file was left in place', { code, reason: message });
    return result;
  }
  // No secrets to migrate (no file): do nothing.
  if (keys.length === 0) return result;
  for (const key of keys) {
    try {
      const secret = await from.get(key);
      if (secret !== null) await to.set(key, secret);
      await from.delete(key);
      result.migrated.push(key);
    } catch (error) {
      const { code, message } = credentialProblem(error);
      result.failed.push({ key, code });
      log?.warn('Credential was not migrated to secure storage; left in the original file', { key, code, reason: message });
    }
  }
  if (result.failed.length === 0) await from.removeIfEmpty();
  if (result.migrated.length > 0) log?.info('Migrated credentials to secure storage', { keys: result.migrated });
  return result;
}
