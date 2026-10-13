import {
  isMessageRef,
  RpcError,
  SERVICE_IDS,
  type MessageRef,
  type ServiceConfigureParams,
  type ServiceId,
  type ServiceState,
  type ServiceStatus,
  type ServicesEvent,
  type ServicesSnapshot,
} from '@cuccut/protocol';
import { RcServices } from '@cuccut/protocol/messages/runtime-core';
import { TopicLog, type Logger } from '@cuccut/harness';
import type { ServiceApprovals } from './service-approvals.ts';

/**
 * Unified management of external services (architecture design §4.8). A service is a `ManagedService`: `start` / `stop` / `status` / `applyConfig`.
 *
 * - The states `off`, `starting`, `on`, `stopping`, and `error` are maintained here. A projected service's state (the node service) comes from its own authority (`nodes.share.*`), and is only relayed here, not stored separately.
 * - The default is `off`; `restore` only starts services configured to start with the Runtime. A failed start (port taken) enters `error` with the reason, does not switch ports, and does not affect the Runtime.
 * - Services not provided in this version are still listed (`available: false`, status always `off`), and starting them is rejected with `SERVICE_NOT_AVAILABLE`.
 * - State changes and service approvals are delivered via the `services` topic.
 */

/** The part the service reports itself: config and runtime info beyond the state. */
export type ServiceReport = Omit<ServiceStatus, 'serviceId' | 'label' | 'available' | 'state' | 'error'> & {
  /** A projected service gives its own state and reason. */
  state?: ServiceState;
  error?: string | null;
};

export interface ManagedService {
  readonly id: ServiceId;
  readonly label: string;
  /** Whether this version provides it. */
  readonly available: boolean;
  /** The state comes from the service's own authority (the node service): `status()` carries `state` and `error`. */
  readonly projected?: boolean;
  /** Starts listening. Throws on failure; the message is the reason shown to the user. */
  start(): Promise<void>;
  /** Stops listening and disconnects existing connections. */
  stop(): Promise<void>;
  status(): ServiceReport;
  /** Changes the config and persists it. Returns true if, while running, the listener must restart with the new config (e.g., the port changed). */
  applyConfig(params: ServiceConfigureParams): Promise<boolean>;
}

/** Services not provided in this version: listed, with status always `off`. */
export class UnavailableService implements ManagedService {
  readonly available = false;
  readonly id: ServiceId;
  readonly label: string;
  readonly #port: number;

  constructor(id: ServiceId, label: string, port: number) {
    this.id = id;
    this.label = label;
    this.#port = port;
  }

  async start(): Promise<void> {
    throw notAvailable(this.id);
  }

  async stop(): Promise<void> {}

  status(): ServiceReport {
    return { autostart: false, port: this.#port, endpoint: null, policy: null, clients: [], recentRequests: [] };
  }

  async applyConfig(): Promise<boolean> {
    throw notAvailable(this.id);
  }
}

export function notAvailable(serviceId: ServiceId): RpcError {
  return new RpcError('conflict', RcServices.serviceNotAvailable({ serviceId }), { code: 'SERVICE_NOT_AVAILABLE', serviceId });
}

export class ServiceManager {
  readonly topic: TopicLog<ServicesSnapshot, ServicesEvent>;
  readonly approvals: ServiceApprovals;
  readonly #services = new Map<ServiceId, ManagedService>();
  readonly #states = new Map<ServiceId, { state: ServiceState; error: string | null; errorRef?: MessageRef }>();
  /** Each service has at most one start, stop, or config change in progress at a time. */
  readonly #queues = new Map<ServiceId, Promise<unknown>>();
  readonly #log: Logger;
  #closed = false;

  constructor(options: { log: Logger; approvals: (manager: ServiceManager) => ServiceApprovals }) {
    this.#log = options.log.child('services');
    this.topic = new TopicLog<ServicesSnapshot, ServicesEvent>(() => this.snapshot(), '0');
    this.approvals = options.approvals(this);
  }

  /** Registers a service. The same ID can be registered only once. */
  register(service: ManagedService): void {
    if (this.#services.has(service.id)) throw new Error(`Service ${service.id} is already registered`);
    this.#services.set(service.id, service);
    this.#states.set(service.id, { state: 'off', error: null });
  }

  snapshot(): ServicesSnapshot {
    return { services: this.list(), approvals: this.approvals.pending() };
  }

  /** All services, in the order of `SERVICE_IDS`. */
  list(): ServiceStatus[] {
    return SERVICE_IDS.flatMap((id) => (this.#services.has(id) ? [this.status(id)] : []));
  }

  status(serviceId: ServiceId): ServiceStatus {
    const service = this.#get(serviceId);
    const report = service.status();
    const own = this.#states.get(serviceId)!;
    const { state: projectedState, error: projectedError, ...rest } = report;
    const state = service.projected ? (projectedState ?? 'off') : own.state;
    // Projected services also report transitional states while starting and stopping.
    const transitional = own.state === 'starting' || own.state === 'stopping' ? own.state : null;
    return {
      serviceId,
      label: service.label,
      available: service.available,
      state: service.projected ? (transitional ?? state) : state,
      error: service.projected ? (projectedError ?? null) : own.error,
      ...(!service.projected && own.errorRef ? { errorRef: own.errorRef } : {}),
      ...rest,
    };
  }

  /** The service's state or config changed (the projected service's authority was modified, or clients or recent requests changed): send one `service.updated`. */
  refresh(serviceId: ServiceId): void {
    if (!this.#services.has(serviceId)) return;
    this.topic.publish({ type: 'service.updated', service: this.status(serviceId) });
  }

  start(serviceId: ServiceId): Promise<ServiceStatus> {
    const service = this.#get(serviceId);
    if (!service.available) return Promise.reject(notAvailable(serviceId));
    return this.#serialize(serviceId, async () => {
      if (this.#closed) throw new RpcError('busy', RcServices.runtimeStopping());
      if (this.status(serviceId).state === 'on') return this.status(serviceId);
      await this.#run(service);
      return this.status(serviceId);
    });
  }

  stop(serviceId: ServiceId): Promise<ServiceStatus> {
    const service = this.#get(serviceId);
    return this.#serialize(serviceId, async () => {
      await this.#halt(service);
      return this.status(serviceId);
    });
  }

  configure(params: ServiceConfigureParams): Promise<ServiceStatus> {
    const service = this.#get(params.serviceId);
    if (!service.available) return Promise.reject(notAvailable(params.serviceId));
    return this.#serialize(params.serviceId, async () => {
      const restart = await service.applyConfig(params);
      const state = this.status(params.serviceId).state;
      // If it is running (or the start failed), restart with the new config: if the port changed, try the new port.
      if (restart && !this.#closed && (state === 'on' || state === 'error')) {
        await this.#halt(service);
        await this.#run(service);
      } else {
        this.refresh(params.serviceId);
      }
      return this.status(params.serviceId);
    });
  }

  /** On Runtime start: starts the services configured to start with the Runtime. A failure only affects that service's state. */
  async restore(): Promise<void> {
    for (const service of this.#services.values()) {
      if (!service.available || service.projected || !service.status().autostart) continue;
      await this.start(service.id).catch((error: unknown) =>
        this.#log.warn('Service failed to start with Runtime', { serviceId: service.id, error: String(error) }),
      );
    }
  }

  /** Runtime stop: stops the running services (projected services are stopped by their own authority), and cancels all pending approvals. */
  async close(): Promise<void> {
    this.#closed = true;
    await Promise.all(
      [...this.#services.values()]
        .filter((service) => !service.projected)
        .map((service) => this.#serialize(service.id, () => this.#halt(service)).catch(() => {})),
    );
  }

  async #run(service: ManagedService): Promise<void> {
    this.#set(service.id, 'starting', null);
    try {
      await service.start();
      this.#set(service.id, 'on', null);
      this.#log.info('Service started', { serviceId: service.id });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#log.warn('Service failed to start', { serviceId: service.id, error: reason });
      // A projected service's failure is recorded by its own authority (e.g., when the port is taken, the node service does not throw, and the reason is in its state); what is thrown is the request's own error, passed to the caller as is.
      if (service.projected) {
        this.#set(service.id, 'off', null);
        throw error;
      }
      const ref = (error as { messageRef?: unknown } | null)?.messageRef;
      this.#set(service.id, 'error', reason, isMessageRef(ref) ? ref : undefined);
    }
  }

  async #halt(service: ManagedService): Promise<void> {
    const before = this.status(service.id).state;
    if (before === 'off' && !service.projected) return;
    this.approvals.cancelService(service.id);
    this.#set(service.id, 'stopping', null);
    try {
      await service.stop();
    } finally {
      this.#set(service.id, 'off', null);
      this.#log.info('Service stopped', { serviceId: service.id });
    }
  }

  #set(serviceId: ServiceId, state: ServiceState, error: string | null, errorRef?: MessageRef): void {
    this.#states.set(serviceId, errorRef ? { state, error, errorRef } : { state, error });
    this.refresh(serviceId);
  }

  #serialize<T>(serviceId: ServiceId, task: () => Promise<T>): Promise<T> {
    const previous = this.#queues.get(serviceId) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.#queues.set(
      serviceId,
      run.catch(() => {}),
    );
    return run;
  }

  #get(serviceId: ServiceId): ManagedService {
    const service = this.#services.get(serviceId);
    if (!service) throw new RpcError('not-found', RcServices.serviceNotFound({ serviceId }));
    return service;
  }
}
