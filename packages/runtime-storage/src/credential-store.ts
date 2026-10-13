import { RuntimeStorageCredentials as SC } from '@cuccut/protocol/messages/runtime-storage';
import type { Localized } from '@cuccut/protocol';
/**
 * Credential storage (architecture design §6.8): the API keys of online Providers and the tokens of paired nodes are read and written through this interface.
 *
 * - A key is a namespaced stable string: `provider:<providerId>` (such as `provider:openai`, `provider:custom:<slug>`), or `node:<nodeId>`. The interface has no method to list all keys.
 * - The build type decides the backend. Development builds use a local file (`FileCredentialStore`); release builds use the system's secure storage (`KeychainCredentialStore`, macOS Keychain only in the first version). When a backend is unavailable, report the error honestly, and do not quietly switch to another backend.
 * - The errors are a closed set, and their messages contain no secrets.
 */
export interface CredentialStore {
  readonly kind: CredentialStoreKind;
  /** null when there is no such key. */
  get(key: string): Promise<string | null>;
  /** Adds or replaces. The secret must not be empty. */
  set(key: string, secret: string): Promise<void>;
  /** Does nothing when there is no such key. */
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

export type CredentialStoreKind = 'file' | 'keychain';

/**
 * Reasons a credential read or write fails:
 * - `denied`: the user or the system refused access;
 * - `unavailable`: storage is unavailable at the moment (the helper program is missing or fails to start, the keychain is locked, timeout);
 * - `unsupported`: this platform is not implemented;
 * - `internal`: other errors (a non-conforming response, a file read or write failure).
 *
 * “No such key” is not an error: `get` returns null, and `delete` completes as usual.
 */
export type CredentialErrorCode = 'denied' | 'unavailable' | 'unsupported' | 'internal';

export class CredentialStoreError extends Error {
  readonly code: CredentialErrorCode;

  constructor(code: CredentialErrorCode, message: string) {
    super(message);
    this.name = 'CredentialStoreError';
    this.code = code;
  }
}

const REASONS: Record<CredentialErrorCode, () => Localized> = {
  denied: () => SC.denied(),
  unavailable: () => SC.unavailable(),
  unsupported: () => SC.unsupported(),
  internal: () => SC.internal(),
};

/** One human-readable reason (no secrets), used for the Provider's unavailability notice and gateway errors. */
export function credentialProblem(error: unknown): { code: CredentialErrorCode; message: string } {
  if (error instanceof CredentialStoreError) return { code: error.code, message: SC.problem({ reason: REASONS[error.code](), message: error.message }).text };
  return { code: 'internal', message: REASONS.internal().text };
}

const KEY_PATTERN = /^(provider|node):[^\s\p{Cc}]{1,256}$/u;

export function providerCredentialKey(providerId: string): string {
  return `provider:${providerId}`;
}

export function nodeCredentialKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/** Validates the key and the shape of the secret. A non-conforming one is the caller's error. */
export function checkCredentialKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new TypeError(`Invalid credential key: ${JSON.stringify(key.slice(0, 80))}`);
}

export function checkCredentialSecret(secret: string): void {
  if (typeof secret !== 'string' || secret === '') throw new TypeError('Credential secret must not be empty');
}
