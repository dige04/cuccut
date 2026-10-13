import fs from 'node:fs/promises';
import { readJsonOrQuarantine, writeJsonAtomic, type StoreLog } from '@cuccut/runtime-storage';
import type { PairedClient } from './pairing.ts';

/**
 * Persistent file for shared state (node protocol spec §11): `<home>/store/node-share.json`, mode 0600.
 * The sharing switch, `nodeId`, name, port, `allowAnySource`, the on/off switch for each capability, and the paired clients (salts and hashes, no plaintext tokens). Pairing codes and lockouts are not written to disk.
 *
 * It holds paired clients, so it must not be silently dropped: if the file cannot be read, is not JSON, is not recognized, or was written by a newer version, it is not renamed and loading does not start from empty. `loadShareFile` returns `unreadable`, the node service enters a degraded state (sharing off, cannot be changed, `ShareStatus.error` explains why), and the file is left in place.
 */

/** A file written before the per-capability switches has no `capabilities`: that version could only share these capabilities, and they were always on. */
const LEGACY_CAPABILITIES = ['transcribe'];

export type ShareCapabilities = Record<string, { enabled: boolean }>;

export interface ShareFile {
  formatVersion: 1;
  enabled: boolean;
  /** Generated the first time sharing is turned on, unchanged afterwards. */
  nodeId: string | null;
  /** null means use the hostname. */
  name: string | null;
  port: number;
  allowAnySource: boolean;
  /**
   * On/off switch for each capability. null means sharing has never been turned on: when it is first turned on, every capability the node supports at that moment is turned on.
   * When not null, a capability missing from the table (added in a later version) counts as off.
   */
  capabilities: ShareCapabilities | null;
  clients: PairedClient[];
}

/** Reads the sharing state: null if there is no file (or it is empty); `{ unreadable: reason }` if it cannot be read or recognized. */
export async function loadShareFile(file: string, log?: StoreLog): Promise<ShareFile | { unreadable: string } | null> {
  try {
    const read = await readJsonOrQuarantine(file, { log, version: { key: 'formatVersion', known: 1 }, quarantine: false, recognize: parseShareFile });
    if (read.status === 'ok') return read.value;
    if (read.status === 'missing' || read.status === 'empty') return null;
    return { unreadable: read.status };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
    log?.warn('Share file could not be read; left in place', { code });
    return { unreadable: code };
  }
}

function parseShareFile(raw: Record<string, unknown>): ShareFile | null {
  const data = raw as unknown as ShareFile;
  if (data.formatVersion !== 1 || typeof data.enabled !== 'boolean' || !Array.isArray(data.clients)) return null;
  const clients = data.clients.filter(
    (c) =>
      c &&
      typeof c.clientId === 'string' &&
      typeof c.salt === 'string' &&
      typeof c.hash === 'string' &&
      typeof c.name === 'string' &&
      typeof c.pairedAt === 'string',
  );
  return {
    formatVersion: 1,
    enabled: data.enabled,
    nodeId: typeof data.nodeId === 'string' ? data.nodeId : null,
    name: typeof data.name === 'string' ? data.name : null,
    port: Number.isInteger(data.port) && data.port >= 0 && data.port <= 65_535 ? data.port : 0,
    allowAnySource: data.allowAnySource === true,
    capabilities: loadCapabilities(data as unknown as Record<string, unknown>),
    clients: clients.map((c) => ({ ...c, lastSeenAt: typeof c.lastSeenAt === 'string' ? c.lastSeenAt : null })),
  };
}

/**
 * - No such key (file from before the per-capability switches): if sharing was ever turned on (there is a `nodeId`), follow that version's rules, where all capabilities at the time were on; if it was never turned on, null;
 * - null: sharing has never been turned on;
 * - table: read `enabled` for each entry; an entry with the wrong shape is dropped (counts as off); if the whole value is not a table, all capabilities are off.
 */
function loadCapabilities(data: Record<string, unknown>): ShareCapabilities | null {
  if (!('capabilities' in data) || data.capabilities === undefined) {
    return typeof data.nodeId === 'string' ? Object.fromEntries(LEGACY_CAPABILITIES.map((c) => [c, { enabled: true }])) : null;
  }
  const raw = data.capabilities;
  if (raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const capabilities: ShareCapabilities = {};
  for (const [capability, entry] of Object.entries(raw as Record<string, unknown>)) {
    const enabled = entry && typeof entry === 'object' ? (entry as { enabled?: unknown }).enabled : undefined;
    if (typeof enabled === 'boolean') capabilities[capability] = { enabled };
  }
  return capabilities;
}

/** Serialized writes: a write started later always lands after the earlier one. */
export class ShareStore {
  readonly file: string;
  #chain: Promise<void> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
  }

  save(data: ShareFile): Promise<void> {
    const snapshot = structuredClone(data);
    const next = this.#chain.then(async () => {
      await writeJsonAtomic(this.file, snapshot, { mode: 0o600 });
      // Files previously created with other permissions are also tightened (rename keeps the temp file's permissions; this is only a safeguard).
      await fs.chmod(this.file, 0o600);
    });
    this.#chain = next.catch(() => {});
    return next;
  }

  flush(): Promise<void> {
    return this.#chain;
  }
}
