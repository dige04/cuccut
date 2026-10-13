import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { CREDENTIAL_UNAVAILABLE } from '@cuccut/models';
import { RpcError } from '@cuccut/protocol';
import { JsonStoreFile, credentialProblem, nodeCredentialKey, type CredentialStore } from '@cuccut/runtime-storage';
import { silentNodeLog, type NodeLogger } from '../node-logger.ts';
import { NodesClient as NC } from '@cuccut/protocol/messages/nodes';

/**
 * Initiator's persistent state (node protocol spec §11): `<home>/store/nodes.json`, permissions 0600.
 *
 * - `clientId`: this Runtime's identifier as seen by all nodes. It is generated the first time the store is opened and never changes after that (nodes use it to tell clients apart;
 *   pairing again with the same `clientId` replaces the old token).
 * - `nodes`: paired nodes (without tokens). Aliases are unique on this machine: the default is the node's name, with `-2`, `-3`… added on conflict. Pairing the same `nodeId`
 *   again replaces the original record and keeps the alias (unless a new alias is given this time).
 * - Tokens are stored in `CredentialStore` under the key `node:<nodeId>` (architecture design §6.8); they are read only when needed and go only into the `Authorization` header.
 *
 * Earlier versions wrote tokens into the records in this file. On open, they are migrated one by one into the credential store, and each successful migration removes the token from the file. A token that cannot be migrated
 * (the credential store is unavailable) stays in the file as is until the next start, but it is not used: there is no fallback to plaintext.
 *
 * Writes use a temporary file followed by a rename, and are serialized. The in-memory state is authoritative; the file is a snapshot of it.
 */

export interface PairedNodeRecord {
  nodeId: string;
  alias: string;
  name: string;
  host: string;
  port: number;
  pairedAt: string;
}

interface StoredNode extends PairedNodeRecord {
  /** Tokens written to the file by older versions that have not yet been migrated into the credential store. */
  token?: string;
}

interface NodesFile {
  formatVersion: 1;
  clientId: string;
  nodes: StoredNode[];
}

/** Node protocol requirement for `clientId` (tokens are `<clientId>.<secret>`, so it cannot contain `.`). */
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALIAS_MAX = 63;

export class NodeStore {
  readonly file: string;
  readonly #file: JsonStoreFile;
  readonly #data: NodesFile;
  readonly #credentials: CredentialStore;
  /** Nodes whose tokens cannot be read, with the reason (no token included). */
  readonly #problems = new Map<string, string>();
  #chain: Promise<void> = Promise.resolve();

  private constructor(file: JsonStoreFile, data: NodesFile, credentials: CredentialStore) {
    this.file = file.file;
    this.#file = file;
    this.#data = data;
    this.#credentials = credentials;
  }

  /**
   * Read the file. If it is missing, generate a new `clientId` and write it to disk immediately. If it is not JSON or is not recognized, first rename it to keep it (`<file>.corrupt-<time>`), then generate a new one.
   * A file written by a newer version, or one that cannot be read, is neither renamed nor overwritten; this run uses a `clientId` that exists only in memory (`store-file.ts`).
   * If the file still holds tokens from an older version, migrate them into the credential store.
   */
  static async open(path: string, credentials: CredentialStore, log: NodeLogger = silentNodeLog): Promise<NodeStore> {
    const file = new JsonStoreFile(path, log);
    const { value: loaded } = await file.read({ version: { key: 'formatVersion', known: 1 }, recognize: parse, tolerateReadErrors: true });
    const store = new NodeStore(file, loaded ?? { formatVersion: 1, clientId: newClientId(), nodes: [] }, credentials);
    if (!loaded) await store.#save();
    else await store.#migrateTokens(log);
    return store;
  }

  get clientId(): string {
    return this.#data.clientId;
  }

  list(): PairedNodeRecord[] {
    return this.#data.nodes.map(record);
  }

  get(nodeId: string): PairedNodeRecord | null {
    const found = this.#data.nodes.find((n) => n.nodeId === nodeId);
    return found ? record(found) : null;
  }

  /** `nodeId` or alias → record (`nodeId` takes priority). */
  resolve(ref: string): PairedNodeRecord | null {
    const found = this.#data.nodes.find((n) => n.nodeId === ref) ?? this.#data.nodes.find((n) => n.alias === ref);
    return found ? record(found) : null;
  }

  /**
   * This node's token, fetched only when a request is made. Null when the credential store has none. Throws `CredentialStoreError` when the credential store is unavailable, and records the reason
   * (`credentialProblem()`).
   */
  async token(nodeId: string): Promise<string | null> {
    try {
      const token = await this.#credentials.get(nodeCredentialKey(nodeId));
      this.#problems.delete(nodeId);
      return token;
    } catch (error) {
      this.#problems.set(nodeId, credentialProblem(error).message);
      throw error;
    }
  }

  /** Reason for the most recent failure to read this node's token; null when there is no problem. */
  credentialProblem(nodeId: string): string | null {
    return this.#problems.get(nodeId) ?? null;
  }

  /** Whether the given alias may be used for `nodeId`: it may not be the same as another node's alias or `nodeId`. Throws `conflict` when it cannot be used. */
  checkAlias(alias: string, nodeId: string): void {
    const taken = this.#data.nodes.some((n) => n.nodeId !== nodeId && (n.alias === alias || n.nodeId === alias));
    if (taken) throw new RpcError('conflict', NC.aliasTaken({ alias }));
  }

  /**
   * Pairing succeeded: first write the token into the credential store, then add or replace the record for this `nodeId`. When the credential store is unavailable, reject with `conflict`
   * (`CREDENTIAL_UNAVAILABLE`), and leave the record unchanged.
   */
  async upsert(
    node: Omit<PairedNodeRecord, 'alias' | 'pairedAt'> & { token: string; alias?: string; pairedAt?: string },
  ): Promise<PairedNodeRecord> {
    const nodes = this.#data.nodes;
    const index = nodes.findIndex((n) => n.nodeId === node.nodeId);
    const previous = index >= 0 ? nodes[index] : undefined;
    let alias: string;
    if (node.alias !== undefined) {
      alias = node.alias.trim();
      if (!alias || alias.length > ALIAS_MAX) throw new RpcError('invalid-request', NC.aliasLength({ max: ALIAS_MAX }));
      this.checkAlias(alias, node.nodeId);
    } else {
      alias = previous?.alias ?? this.#defaultAlias(node.name, node.nodeId);
    }
    await this.#credentialWrite(node.nodeId, () => this.#credentials.set(nodeCredentialKey(node.nodeId), node.token));
    const entry: StoredNode = {
      nodeId: node.nodeId,
      alias,
      name: node.name,
      host: node.host,
      port: node.port,
      pairedAt: node.pairedAt ?? new Date().toISOString(),
    };
    // Another pairing may have changed the list while the credential was being written: look up the position again by nodeId.
    const at = nodes.findIndex((n) => n.nodeId === node.nodeId);
    if (at >= 0) nodes[at] = entry;
    else nodes.push(entry);
    await this.#save();
    return record(entry);
  }

  /**
   * Delete this machine's record and token; returns false when there is no such node. The token is deleted first: when the credential store is unavailable, reject with `conflict` (`CREDENTIAL_UNAVAILABLE`)
   * and leave the record unchanged (so no token is left that cannot be deleted).
   */
  async remove(nodeId: string): Promise<boolean> {
    if (!this.#data.nodes.some((n) => n.nodeId === nodeId)) return false;
    await this.#credentialWrite(nodeId, () => this.#credentials.delete(nodeCredentialKey(nodeId)));
    const index = this.#data.nodes.findIndex((n) => n.nodeId === nodeId);
    if (index < 0) return false;
    this.#data.nodes.splice(index, 1);
    await this.#save();
    return true;
  }

  flush(): Promise<void> {
    return this.#chain;
  }

  #defaultAlias(name: string, nodeId: string): string {
    const base = name.trim().slice(0, ALIAS_MAX) || 'node';
    const taken = (alias: string) => this.#data.nodes.some((n) => n.nodeId !== nodeId && (n.alias === alias || n.nodeId === alias));
    if (!taken(base)) return base;
    for (let i = 2; ; i++) {
      const suffix = `-${i}`;
      const candidate = `${base.slice(0, ALIAS_MAX - suffix.length)}${suffix}`;
      if (!taken(candidate)) return candidate;
    }
  }

  async #credentialWrite(nodeId: string, write: () => Promise<void>): Promise<void> {
    try {
      await write();
      this.#problems.delete(nodeId);
    } catch (error) {
      const { code, message } = credentialProblem(error);
      throw new RpcError('conflict', NC.tokenNotSaved({ message }), { code: CREDENTIAL_UNAVAILABLE, reason: code, nodeId });
    }
  }

  /** Tokens written to the file by older versions: migrate them one by one into the credential store, and remove each from the file once migrated. Logs only the `nodeId` and the reason. */
  async #migrateTokens(log: NodeLogger): Promise<void> {
    let migrated = 0;
    for (const node of this.#data.nodes) {
      if (node.token === undefined) continue;
      try {
        await this.#credentials.set(nodeCredentialKey(node.nodeId), node.token);
        delete node.token;
        migrated++;
      } catch (error) {
        const { code, message } = credentialProblem(error);
        this.#problems.set(node.nodeId, message);
        log.warn('Node token was not migrated to the credential store; left in the original file', { node: node.nodeId, code, reason: message });
      }
    }
    if (migrated > 0) {
      await this.#save();
      log.info('Migrated node tokens to the credential store', { count: migrated });
    }
  }

  #save(): Promise<void> {
    const snapshot = structuredClone(this.#data);
    const next = this.#chain.then(async () => {
      if (this.#file.readOnly) return this.#file.write(snapshot); // Log a warning only once; do not write.
      await this.#file.write(snapshot, { mode: 0o600 });
      // The umask may have loosened the permissions of the new file: tighten them again after the rename.
      await fs.chmod(this.file, 0o600);
    });
    this.#chain = next.catch(() => {});
    return next;
  }
}

function newClientId(): string {
  return `c_${crypto.randomBytes(16).toString('base64url')}`;
}

/** Record as exposed externally: no token. */
function record(node: StoredNode): PairedNodeRecord {
  const { nodeId, alias, name, host, port, pairedAt } = node;
  return { nodeId, alias, name, host, port, pairedAt };
}

function parse(value: Record<string, unknown>): NodesFile | null {
  const data = value as Partial<NodesFile>;
  if (data.formatVersion !== 1 || typeof data.clientId !== 'string' || !CLIENT_ID_PATTERN.test(data.clientId)) return null;
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const valid = nodes.filter(
    (n): n is StoredNode =>
      !!n &&
      typeof n.nodeId === 'string' &&
      typeof n.alias === 'string' &&
      typeof n.name === 'string' &&
      typeof n.host === 'string' &&
      Number.isInteger(n.port) &&
      (n.token === undefined || (typeof n.token === 'string' && n.token !== '')) &&
      typeof n.pairedAt === 'string',
  );
  return {
    formatVersion: 1,
    clientId: data.clientId,
    nodes: valid.map((n) => ({ ...record(n), ...(n.token !== undefined ? { token: n.token } : {}) })),
  };
}
