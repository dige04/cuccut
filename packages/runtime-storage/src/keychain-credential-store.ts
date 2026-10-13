import { spawn } from 'node:child_process';
import {
  CredentialStoreError,
  checkCredentialKey,
  checkCredentialSecret,
  type CredentialErrorCode,
  type CredentialStore,
} from './credential-store.ts';
import { RuntimeStorageCredentials as SC } from '@cuccut/protocol/messages/runtime-storage';

/**
 * Production credential storage (architecture design §6.8): the system's secure storage, accessed through `credential-helper`, which is signed with the app (macOS Keychain / Windows Credential Manager).
 *
 * Each operation starts a helper process: stdin receives one line of JSON request `{ op, key, secret? }`, and stdout returns one line of JSON response `{ ok: true, secret? , exists? }` or `{ ok: false, error, message }`. Secrets pass only through stdin and stdout: not into command-line arguments, environment variables, or logs. The helper's stderr is read and discarded. Operations are serialized.
 *
 * If the helper is missing, fails to start, or times out, report `unavailable`. Never fall back to a plaintext file.
 */

/** The helper's command. Tests use `{ command: process.execPath, args: [fake helper script] }`. */
export interface CredentialHelperCommand {
  command: string;
  args?: string[];
}

export interface KeychainCredentialStoreOptions {
  /** null: the helper program was not found, so every operation fails with `unavailable`. */
  helper: CredentialHelperCommand | null;
  /** Deadline for one operation. The system may show an authorization prompt that waits for the user, so the default is long (60 seconds). */
  timeoutMs?: number;
}

type Op = 'get' | 'set' | 'delete' | 'has';

const HELPER_ERRORS = new Set(['not-found', 'denied', 'unavailable', 'unsupported', 'internal']);
const MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

interface HelperResponse {
  ok: boolean;
  secret?: unknown;
  exists?: unknown;
  error?: unknown;
  message?: unknown;
}

export class KeychainCredentialStore implements CredentialStore {
  readonly kind = 'keychain' as const;
  readonly #helper: CredentialHelperCommand | null;
  readonly #timeoutMs: number;
  #chain: Promise<unknown> = Promise.resolve();

  constructor(options: KeychainCredentialStoreOptions) {
    this.#helper = options.helper;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get(key: string): Promise<string | null> {
    checkCredentialKey(key);
    const response = await this.#call('get', key);
    if (!response.ok) return null;
    if (typeof response.secret !== 'string' || !response.secret) throw new CredentialStoreError('internal', SC.helperBadResponse().text);
    return response.secret;
  }

  async set(key: string, secret: string): Promise<void> {
    checkCredentialKey(key);
    checkCredentialSecret(secret);
    const response = await this.#call('set', key, secret);
    if (!response.ok) throw new CredentialStoreError('internal', SC.helperBadResponse().text);
  }

  async delete(key: string): Promise<void> {
    checkCredentialKey(key);
    await this.#call('delete', key);
  }

  async has(key: string): Promise<boolean> {
    checkCredentialKey(key);
    const response = await this.#call('has', key);
    if (typeof response.exists !== 'boolean') throw new CredentialStoreError('internal', SC.helperBadResponse().text);
    return response.exists;
  }

  /** Runs one operation serially. `not-found` is returned as `{ ok: false }` (`get` and `delete` handle it). Other errors are thrown. */
  #call(op: Op, key: string, secret?: string): Promise<HelperResponse> {
    const next = this.#chain.then(() => this.#run(op, key, secret));
    this.#chain = next.catch(() => {});
    return next;
  }

  #run(op: Op, key: string, secret?: string): Promise<HelperResponse> {
    const helper = this.#helper;
    if (!helper) return Promise.reject(new CredentialStoreError('unavailable', SC.helperNotFound().text));
    const request = `${JSON.stringify(secret === undefined ? { op, key } : { op, key, secret })}\n`;
    return new Promise<HelperResponse>((resolve, reject) => {
      let settled = false;
      const chunks: Buffer[] = [];
      let size = 0;
      const child = spawn(helper.command, helper.args ?? [], { stdio: ['pipe', 'pipe', 'pipe'] });
      const finish = (outcome: { response: HelperResponse } | { error: CredentialStoreError }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        if ('response' in outcome) resolve(outcome.response);
        else reject(outcome.error);
      };
      const timer = setTimeout(
        () => finish({ error: new CredentialStoreError('unavailable', SC.helperTimedOut({ seconds: Math.round(this.#timeoutMs / 1000) }).text) }),
        this.#timeoutMs,
      );
      child.once('error', (error: NodeJS.ErrnoException) => {
        const reason = error.code === 'ENOENT' ? SC.helperMissing().text : SC.helperStartFailed({ code: error.code ?? 'unknown' }).text;
        finish({ error: new CredentialStoreError('unavailable', reason) });
      });
      // The helper's stderr may contain system diagnostics: read it and drop it, do not log it.
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.stdout.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) finish({ error: new CredentialStoreError('internal', SC.helperResponseTooLong().text) });
        else chunks.push(chunk);
      });
      child.once('close', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const line = text.split('\n', 1)[0]!.trim();
        if (!line) {
          finish({ error: new CredentialStoreError('unavailable', SC.helperExitedSilently().text) });
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          finish({ error: new CredentialStoreError('internal', SC.helperBadResponse().text) });
          return;
        }
        finish(interpret(op, parsed, secret));
      });
      child.stdin.end(request);
    });
  }
}

function interpret(op: Op, value: unknown, secret: string | undefined): { response: HelperResponse } | { error: CredentialStoreError } {
  if (typeof value !== 'object' || value === null || typeof (value as HelperResponse).ok !== 'boolean') {
    return { error: new CredentialStoreError('internal', SC.helperBadResponse().text) };
  }
  const response = value as HelperResponse;
  if (response.ok) return { response };
  const code = typeof response.error === 'string' && HELPER_ERRORS.has(response.error) ? response.error : 'internal';
  if (code === 'not-found' && (op === 'get' || op === 'delete')) return { response: { ok: false } };
  const mapped: CredentialErrorCode = code === 'not-found' ? 'internal' : (code as CredentialErrorCode);
  return { error: new CredentialStoreError(mapped, helperMessage(response.message, secret)) };
}

/** The helper's message: truncated, and with this request's secret removed if it appears in it. */
function helperMessage(message: unknown, secret: string | undefined): string {
  let text = typeof message === 'string' && message.trim() ? message.trim().slice(0, 300) : SC.helperReportedError().text;
  if (secret) text = text.split(secret).join(SC.redacted().text);
  return text;
}
