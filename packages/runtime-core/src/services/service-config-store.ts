import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { z } from 'zod';
import {
  DEFAULT_SERVICE_POLICY,
  MCP_DEFAULT_PORT,
  MODEL_API_DEFAULT_PORT,
  MODEL_API_MAX_CONCURRENT_LIMIT,
  ONLINE_CAPABILITIES,
  SERVICE_LEVELS,
  WEB_DEFAULT_PORT,
  WEB_METHOD_PATTERN,
  newId,
  nowIso,
  type Id,
  type ModelApiAlias,
  type ModelApiRouting,
  type ServiceClient,
  type ServiceId,
  type ServicePolicy,
  type WebServiceAccess,
} from '@cuccut/protocol';
import { RcServices } from '@cuccut/protocol/messages/runtime-core';
import { modelApiAlias } from '@cuccut/protocol/schemas';
import { readJson, writeJsonAtomic } from '@cuccut/runtime-storage';

/**
 * Config for external services (architecture design §4.8): `store/services.json`, permission 0600, atomic write. It is read in when the Runtime starts, and services are restored according to `autostart`.
 *
 * - Per service: whether it starts with the Runtime, the port, the access policy, and the issued clients. The node service's config is in `node-share.json`, not here.
 * - The model API service has its own routing switches, alias table, and per-client concurrency limit (`modelApi`); when never stored, the service uses defaults.
 * - A client token is `<clientId>.<secret>`, where `secret` is 32 random bytes in base64url. Only the salt and `sha256(salt ‖ secret)` are stored,
 *   and comparison uses `crypto.timingSafeEqual`. Plaintext is returned only once, at issuance.
 */

/** Services that have their own config (excluding the node service). */
export type ConfigurableServiceId = Exclude<ServiceId, 'node'>;

export interface StoredClient extends ServiceClient {
  salt: string;
  hash: string;
}

/** The model API service's own config (§4.8). */
export interface ModelApiConfig {
  routing: ModelApiRouting;
  aliases: ModelApiAlias[];
  maxConcurrentPerClient: number;
}

export interface ServiceConfig {
  autostart: boolean;
  port: number;
  policy: ServicePolicy;
  clients: StoredClient[];
  /** Only the model API service has this; undefined when never stored. */
  modelApi?: ModelApiConfig;
  /** Only the Web service uses this: the read-only switch and method allowlist (if not given, read-only is off and the default set applies). */
  web?: WebServiceAccess;
}

const SECRET_BYTES = 32;

const DEFAULT_PORTS: Record<ConfigurableServiceId, number> = {
  mcp: MCP_DEFAULT_PORT,
  'model-api': MODEL_API_DEFAULT_PORT,
  web: WEB_DEFAULT_PORT,
};

const clientSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  name: z.string().min(1).max(100),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  salt: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});

const configSchema = z.object({
  autostart: z.boolean().optional(),
  port: z.number().int().min(0).max(65_535).optional(),
  policy: z
    .object({
      videos: z.union([z.literal('all'), z.object({ ids: z.array(z.string().min(1).max(200)) })]),
      level: z.enum(SERVICE_LEVELS),
    })
    .optional(),
  clients: z.array(clientSchema).optional(),
  modelApi: z
    .object({
      routing: z.object({ online: z.boolean(), nodes: z.boolean(), agent: z.boolean() }),
      aliases: z.array(
        z.object({
          alias: modelApiAlias,
          capability: z.enum(ONLINE_CAPABILITIES as [ModelApiAlias['capability'], ...ModelApiAlias['capability'][]]),
          providerId: z.string().min(1).max(200),
          modelId: z.string().min(1).max(200).nullable(),
        }),
      ),
      maxConcurrentPerClient: z.number().int().min(1).max(MODEL_API_MAX_CONCURRENT_LIMIT),
    })
    .optional(),
  web: z
    .object({
      readOnly: z.boolean(),
      methods: z.array(z.string().max(100).regex(WEB_METHOD_PATTERN)).max(200).nullable(),
    })
    .optional(),
});

const fileSchema = z.object({
  version: z.literal(1),
  services: z.record(z.string(), configSchema),
});

function defaults(serviceId: ConfigurableServiceId): ServiceConfig {
  return { autostart: false, port: DEFAULT_PORTS[serviceId], policy: structuredClone(DEFAULT_SERVICE_POLICY), clients: [] };
}

export class ServiceConfigStore {
  readonly #file: string;
  readonly #configs = new Map<ConfigurableServiceId, ServiceConfig>();
  #writing: Promise<void> = Promise.resolve();

  constructor(file: string) {
    this.#file = file;
  }

  /** Reads the config. If the file does not exist, all values take defaults. Throws if it is not a valid config (not overwritten, so issued clients are not lost). */
  async load(): Promise<void> {
    const raw = await readJson<unknown>(this.#file);
    this.#configs.clear();
    if (raw === null) return;
    const parsed = fileSchema.safeParse(raw);
    if (!parsed.success) throw new Error(RcServices.configFileInvalid({ file: this.#file }).text);
    for (const [serviceId, stored] of Object.entries(parsed.data.services)) {
      if (!(serviceId in DEFAULT_PORTS)) continue;
      const base = defaults(serviceId as ConfigurableServiceId);
      this.#configs.set(serviceId as ConfigurableServiceId, {
        autostart: stored.autostart ?? base.autostart,
        port: stored.port ?? base.port,
        policy: stored.policy ?? base.policy,
        clients: stored.clients ?? [],
        ...(stored.modelApi ? { modelApi: stored.modelApi } : {}),
        ...(stored.web ? { web: stored.web } : {}),
      });
    }
  }

  /** One service's config (a copy). */
  get(serviceId: ConfigurableServiceId): ServiceConfig {
    return structuredClone(this.#configs.get(serviceId) ?? defaults(serviceId));
  }

  /** Changes the config and persists it; if persisting fails, the in-memory config is unchanged. */
  async update(serviceId: ConfigurableServiceId, patch: Partial<Omit<ServiceConfig, 'clients'>>): Promise<ServiceConfig> {
    await this.#mutate(serviceId, (config) => ({ ...config, ...structuredClone(patch) }));
    return this.get(serviceId);
  }

  /**
   * Adds a video to the service's video list (a video the service itself created). It is modified according to the config at that time, inside the write queue, so concurrent creations do not overwrite each other.
   * If the policy is all videos, or the list already contains it, nothing changes. Returns whether it changed.
   */
  async allowVideo(serviceId: ConfigurableServiceId, videoId: Id): Promise<boolean> {
    let changed = false;
    await this.#mutate(serviceId, (config) => {
      const videos = config.policy.videos;
      if (videos === 'all' || videos.ids.includes(videoId)) return config;
      changed = true;
      return { ...config, policy: { ...config.policy, videos: { ids: [...videos.ids, videoId] } } };
    });
    return changed;
  }

  /** Issues a client: the plaintext token is returned only here. */
  async createClient(serviceId: ConfigurableServiceId, name: string): Promise<{ client: ServiceClient; token: string }> {
    const clientId = newId('mcl');
    const secret = crypto.randomBytes(SECRET_BYTES);
    const salt = crypto.randomBytes(16);
    const stored: StoredClient = {
      clientId,
      name,
      createdAt: nowIso(),
      lastUsedAt: null,
      salt: salt.toString('base64'),
      hash: digest(salt, secret).toString('hex'),
    };
    await this.#mutate(serviceId, (config) => ({ ...config, clients: [...config.clients, stored] }));
    return { client: publicClient(stored), token: `${clientId}.${secret.toString('base64url')}` };
  }

  /** Revokes a client. Returns false if there is no such client. */
  async revokeClient(serviceId: ConfigurableServiceId, clientId: string): Promise<boolean> {
    let found = false;
    await this.#mutate(serviceId, (config) => {
      const clients = config.clients.filter((c) => c.clientId !== clientId);
      found = clients.length !== config.clients.length;
      return { ...config, clients };
    });
    return found;
  }

  clients(serviceId: ConfigurableServiceId): ServiceClient[] {
    return (this.#configs.get(serviceId)?.clients ?? []).map(publicClient);
  }

  /** The token after `Bearer` → client; empty if unrecognized, revoked, or malformed. Only the most recent use time is recorded, in memory. */
  verify(serviceId: ConfigurableServiceId, token: string): ServiceClient | null {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const clientId = token.slice(0, dot);
    const text = token.slice(dot + 1);
    const client = this.#configs.get(serviceId)?.clients.find((c) => c.clientId === clientId);
    const secret = Buffer.from(text, 'base64url');
    // Accept only canonical base64url: a given sequence of bytes has only one spelling.
    if (!client || secret.length !== SECRET_BYTES || secret.toString('base64url') !== text) return null;
    const expected = Buffer.from(client.hash, 'hex');
    const actual = digest(Buffer.from(client.salt, 'base64'), secret);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    client.lastUsedAt = nowIso();
    return publicClient(client);
  }

  /** Writes the in-memory last-used times back (when the service stops). */
  async flush(serviceId: ConfigurableServiceId): Promise<void> {
    if (this.#configs.has(serviceId)) await this.#mutate(serviceId, (config) => config);
  }

  /** Write queue: each change is based on the config as persisted after the previous write, so concurrent changes do not overwrite each other. */
  async #mutate(serviceId: ConfigurableServiceId, change: (config: ServiceConfig) => ServiceConfig): Promise<void> {
    const run = this.#writing.then(async () => {
      const config = change(this.get(serviceId));
      const all = new Map(this.#configs);
      all.set(serviceId, config);
      await writeJsonAtomic(this.#file, { version: 1, services: Object.fromEntries(all) }, { mode: 0o600 });
      // For a file that already exists, the permissions after rename are taken from the temp file; confirm them again here.
      await fs.chmod(this.#file, 0o600);
      this.#configs.set(serviceId, config);
    });
    this.#writing = run.catch(() => {});
    return run;
  }
}

function publicClient(client: StoredClient): ServiceClient {
  return { clientId: client.clientId, name: client.name, createdAt: client.createdAt, lastUsedAt: client.lastUsedAt };
}

function digest(salt: Buffer, secret: Buffer): Buffer {
  return crypto.createHash('sha256').update(salt).update(secret).digest();
}
