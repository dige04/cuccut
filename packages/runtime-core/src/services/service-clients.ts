import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RpcError, refOf, type ServiceClient, type ServiceRequestRecord } from '@cuccut/protocol';
import { RcServices } from '@cuccut/protocol/messages/runtime-core';
import type { Logger } from '@cuccut/harness';
import type { ConfigurableServiceId, ServiceConfigStore } from './service-config-store.ts';

/**
 * Clients and listeners shared by external services (architecture design §4.8, §12.8), with one copy each for the MCP service and the model API service:
 *
 * - Clients: one token per external app (`Authorization: Bearer <token>`); plaintext is returned only once, at issuance, and only the salted hash is stored in config.
 *   Revocation takes effect immediately. Issuance and revocation are logged (only the clientId is recorded), and the service is notified that its state changed.
 * - Listener: only on the loopback address. If the port is taken, the reason is given (the service enters `error`), and ports are not switched. On stop, existing connections are disconnected immediately.
 * - Recent requests: caller, tool or endpoint, target and result, newest first, at most 20 entries; no tokens or bodies.
 */

export const LOOPBACK_HOST = '127.0.0.1';
const RECENT_LIMIT = 20;

export class ServiceClients {
  readonly #store: ServiceConfigStore;
  readonly #serviceId: ConfigurableServiceId;
  readonly #log: Logger;
  readonly #label: string;
  readonly #onChange: () => void;

  constructor(options: { store: ServiceConfigStore; serviceId: ConfigurableServiceId; label: string; log: Logger; onChange: () => void }) {
    this.#store = options.store;
    this.#serviceId = options.serviceId;
    this.#label = options.label;
    this.#log = options.log;
    this.#onChange = options.onChange;
  }

  async create(name: string): Promise<{ client: ServiceClient; token: string }> {
    const created = await this.#store.createClient(this.#serviceId, name);
    this.#log.info(`Issued ${this.#label} client`,{ clientId: created.client.clientId });
    this.#onChange();
    return created;
  }

  list(): ServiceClient[] {
    return this.#store.clients(this.#serviceId);
  }

  async revoke(clientId: string): Promise<ServiceClient[]> {
    if (!(await this.#store.revokeClient(this.#serviceId, clientId))) throw new RpcError('not-found', RcServices.clientNotFound());
    this.#log.info(`Revoked ${this.#label} client`, { clientId });
    this.#onChange();
    return this.list();
  }

  /** When `clientId` is given, finds that client (connection info names the client); `not-found` if there is no such client. */
  find(clientId: string | undefined): ServiceClient | undefined {
    if (clientId === undefined) return undefined;
    const client = this.list().find((c) => c.clientId === clientId);
    if (!client) throw new RpcError('not-found', RcServices.clientNotFound());
    return client;
  }

  /** `Authorization: Bearer <token>` → client; null if the header is missing, malformed, unrecognized, or revoked. */
  authenticate(request: IncomingMessage): ServiceClient | null {
    const match = /^Bearer\s+(\S+)$/.exec(request.headers.authorization ?? '');
    return match ? this.#store.verify(this.#serviceId, match[1]!) : null;
  }
}

/** Starts listening on the loopback address and returns the actual port. On failure, throws a reason fit for the user to read (port taken, and so on). */
export async function listenLoopback(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(listenError(port, error));
    });
    server.listen(port, LOOPBACK_HOST, () => resolve());
  });
  return (server.address() as AddressInfo).port;
}

/** The reason a listen failed (shown to the user; displayed when the service enters `error`): the port is taken, or the reason the system gives. */
export function listenError(port: number, error: NodeJS.ErrnoException): Error {
  const message = error.code === 'EADDRINUSE' ? RcServices.portInUse({ port }) : RcServices.cannotListen({ port, reason: error.message });
  return Object.assign(new Error(message.text), { messageRef: refOf(message) });
}

/** Immediately disconnects existing connections and stops listening (§12.8). */
export async function closeLoopback(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

/** Recent external requests (audit, §12.8): newest first, at most 20. */
export class RecentRequests {
  #records: ServiceRequestRecord[] = [];

  add(record: ServiceRequestRecord): void {
    this.#records = [record, ...this.#records].slice(0, RECENT_LIMIT);
  }

  list(): ServiceRequestRecord[] {
    return this.#records.map((r) => ({ ...r }));
  }
}
