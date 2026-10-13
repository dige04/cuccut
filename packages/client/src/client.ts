import {
  PROTOCOL_VERSION,
  RpcError,
  compareSeq,
  conversationTopic,
  isNextSeq,
  videoTopic,
  type AgentSetupEvent,
  type AgentsEvent,
  type AgentsSnapshot,
  type LegacyImportEvent,
  type LegacyImportSnapshot,
  type ProfileEvent,
  type ProfileSnapshot,
  type AgentSetupSnapshot,
  type ClientKind,
  type ConversationEvent,
  type ConversationSnapshot,
  type DirectoryEvent,
  type DirectorySnapshot,
  type Id,
  type VideoTopicEvent,
  type VideoTopicSnapshot,
  type RpcMethod,
  type RpcParams,
  type RpcResult,
  type RuntimeInfo,
  type Seq,
  type SequencedEvent,
  type ServerFrame,
  type SpaceEvent,
  type SpaceSnapshot,
  type TasksEvent,
  type TasksSnapshot,
  type JobsEvent,
  type JobsSnapshot,
  type ModelsEvent,
  type ModelsSnapshot,
  type SettingsEvent,
  type SettingsSnapshot,
  type ServicesEvent,
  type ServicesSnapshot,
  type Topic,
} from '@cuccut/protocol';
import { ClientConnection as C } from '@cuccut/protocol/messages/client';

export interface ConnectionTarget {
  endpoint: string;
  token: string;
}

export interface ClientOptions {
  /** Called before every (re)connection. The Runtime's port and token change when it restarts, so the discovery info must be read again. */
  resolve: () => Promise<ConnectionTarget>;
  client: { kind: ClientKind; name: string; version: string };
  /** Automatically reconnects after a disconnect. One-shot CLI commands can turn this off. */
  reconnect?: boolean;
  requestTimeoutMs?: number;
  WebSocket?: typeof WebSocket;
}

/** Options for a single request. */
export interface RequestOptions {
  /** The timeout for this call (milliseconds), overriding `ClientOptions.requestTimeoutMs`. */
  timeoutMs?: number;
}

export type ConnectionState =
  | { status: 'connecting'; attempt: number }
  | { status: 'connected'; runtime: RuntimeInfo; connectionId: Id }
  | { status: 'disconnected'; reason: string; retryInMs: number | null }
  /** Protocol incompatible: do not retry; wait for the user to update (architecture design §13.3). */
  | { status: 'incompatible'; reason: string }
  | { status: 'closed' };

export interface TopicHandlers<S, E> {
  /** A snapshot at the same watermark arrived: replace the local mirror as a whole. */
  snapshot(snapshot: S, seq: Seq): void;
  /** Incremental events, arriving in order. */
  event(event: E, seq: Seq): void;
}

interface TopicEntry {
  topic: Topic;
  handlers: TopicHandlers<unknown, unknown>;
  /** The watermark the local mirror is at; null means a snapshot is needed. */
  seq: Seq | null;
  /** A subscription request is in flight. Events that arrive before the response is handled are applied in order after the snapshot or replay. */
  pending: boolean;
  buffered: SequencedEvent<unknown>[];
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

const BACKOFF_MS = [250, 500, 1000, 2000, 5000];

/**
 * The Runtime client: handshake, requests, topic subscriptions and recovery after disconnect (architecture design §4.4).
 *
 * Subscription guarantee: the handler only ever sees "a snapshot, then continuous events". Events with a duplicate sequence number are dropped. On a gap, or when the Runtime changes its run epoch, the snapshot is fetched again rather than continuing on a mirror that is missing events.
 */
export class CucCutClient {
  readonly #options: ClientOptions;
  readonly #WebSocket: typeof WebSocket;
  readonly #topics = new Map<Topic, TopicEntry>();
  readonly #pending = new Map<string, PendingRequest>();
  readonly #stateListeners = new Set<(state: ConnectionState) => void>();
  readonly #readyWaiters = new Set<{ resolve: () => void; reject: (error: unknown) => void }>();
  #socket: WebSocket | null = null;
  #state: ConnectionState = { status: 'connecting', attempt: 0 };
  #epoch: string | null = null;
  #nextId = 1;
  #attempt = 0;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;
  #started = false;

  constructor(options: ClientOptions) {
    this.#options = options;
    this.#WebSocket = options.WebSocket ?? globalThis.WebSocket;
  }

  get state(): ConnectionState {
    return this.#state;
  }

  /** Starts connecting; returns after the first handshake succeeds. */
  connect(): Promise<RuntimeInfo> {
    if (!this.#started) {
      this.#started = true;
      void this.#open();
    }
    return this.#waitReady().then(() => (this.#state as Extract<ConnectionState, { status: 'connected' }>).runtime);
  }

  onState(listener: (state: ConnectionState) => void): () => void {
    this.#stateListeners.add(listener);
    listener(this.#state);
    return () => this.#stateListeners.delete(listener);
  }

  /**
   * Sends one request. `options.timeoutMs` overrides the timeout for this call (default `requestTimeoutMs`, otherwise 30 seconds). Calls that take minutes, such as baking code-frame ones (`compositions.import`), are relaxed by the caller.
   */
  async request<M extends RpcMethod>(method: M, params: RpcParams<M>, options: RequestOptions = {}): Promise<RpcResult<M>> {
    await this.#waitReady();
    return this.#send(method, params, options.timeoutMs) as Promise<RpcResult<M>>;
  }

  subscribe<S, E>(topic: Topic, handlers: TopicHandlers<S, E>): () => void {
    const entry: TopicEntry = { topic, handlers: handlers as TopicHandlers<unknown, unknown>, seq: null, pending: false, buffered: [] };
    this.#topics.set(topic, entry);
    if (this.#state.status === 'connected') this.#resubscribe(entry);
    return () => {
      if (this.#topics.get(topic) !== entry) return;
      this.#topics.delete(topic);
      if (this.#state.status === 'connected') void this.#send('unsubscribe', { topic }).catch(() => {});
    };
  }

  subscribeDirectory(handlers: TopicHandlers<DirectorySnapshot, DirectoryEvent>): () => void {
    return this.subscribe('directory', handlers);
  }

  subscribeConversation(conversationId: Id, handlers: TopicHandlers<ConversationSnapshot, ConversationEvent>): () => void {
    return this.subscribe(conversationTopic(conversationId), handlers);
  }

  subscribeTasks(handlers: TopicHandlers<TasksSnapshot, TasksEvent>): () => void {
    return this.subscribe('tasks', handlers);
  }

  /** Records of background jobs (transcription etc.), for all videos. */
  subscribeJobs(handlers: TopicHandlers<JobsSnapshot, JobsEvent>): () => void {
    return this.subscribe('jobs', handlers);
  }

  /** The capability view of the model service: when the config, defaults, or model bundles or nodes change, the full new view is pushed. */
  subscribeModels(handlers: TopicHandlers<ModelsSnapshot, ModelsEvent>): () => void {
    return this.subscribe('models', handlers);
  }

  /** Preferences: the snapshot holds the effective values and defaults for all keys. Afterwards only changed keys are pushed (`applySettingsEvent` merges them into the snapshot). */
  subscribeSettings(handlers: TopicHandlers<SettingsSnapshot, SettingsEvent>): () => void {
    return this.subscribe('settings', handlers);
  }

  /** External services (architecture design §4.8): the status of all services and the pending service approvals. */
  subscribeServices(handlers: TopicHandlers<ServicesSnapshot, ServicesEvent>): () => void {
    return this.subscribe('services', handlers);
  }

  /** The status and output of the in-app agent install and upgrade commands (`agents.runSetup`). */
  subscribeAgentSetup(handlers: TopicHandlers<AgentSetupSnapshot, AgentSetupEvent>): () => void {
    return this.subscribe('agent-setup', handlers);
  }

  /** The probe results and preferences of agents (the view from `agents.list`): the snapshot arrives first, and after background probing completes, a new view is sent for each agent. */
  subscribeAgents(handlers: TopicHandlers<AgentsSnapshot, AgentsEvent>): () => void {
    return this.subscribe('agents', handlers);
  }

  /** The import prompt for legacy projects (architecture design §2.7). The snapshot is a prompt awaiting an answer, and it is replaced as a whole when it appears or disappears. Desktop UI only. */
  subscribeLegacyImport(handlers: TopicHandlers<LegacyImportSnapshot, LegacyImportEvent>): () => void {
    return this.subscribe('legacy-import', handlers);
  }

  /** The user's profile (interview, preferences, workspace rules): the snapshot is `profile.get`, and each change sends it whole again (`applyProfileEvent`). */
  subscribeProfile(handlers: TopicHandlers<ProfileSnapshot, ProfileEvent>): () => void {
    return this.subscribe('profile', handlers);
  }

  subscribeSpace(handlers: TopicHandlers<SpaceSnapshot, SpaceEvent>): () => void {
    return this.subscribe('space', handlers);
  }

  /** The projection of an opened video. The video must first be opened via `videos.open` / `videos.create`; if it is not open, the subscription does not retry. */
  subscribeVideo(videoId: Id, handlers: TopicHandlers<VideoTopicSnapshot, VideoTopicEvent>): () => void {
    return this.subscribe(videoTopic(videoId), handlers);
  }

  close(): void {
    this.#closed = true;
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#socket?.close(1000, 'client closed');
    this.#socket = null;
    this.#failPending(new RpcError('internal', C.closed()));
    this.#setState({ status: 'closed' });
    for (const waiter of this.#readyWaiters) waiter.reject(new RpcError('internal', C.closed()));
    this.#readyWaiters.clear();
  }

  // ---- Connection ----

  async #open(): Promise<void> {
    if (this.#closed) return;
    this.#setState({ status: 'connecting', attempt: this.#attempt });
    let target: ConnectionTarget;
    try {
      target = await this.#options.resolve();
    } catch (error) {
      return this.#scheduleReconnect(error instanceof Error ? error.message : String(error));
    }
    if (this.#closed) return;

    const socket = new this.#WebSocket(target.endpoint);
    this.#socket = socket;
    let welcomed = false;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'hello', protocolVersion: PROTOCOL_VERSION, token: target.token, client: this.#options.client }));
    };
    socket.onmessage = (message) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(String(message.data)) as ServerFrame;
      } catch {
        return;
      }
      if (frame.type === 'welcome') {
        welcomed = true;
        this.#onWelcome(frame.runtime, frame.connectionId);
      } else if (frame.type === 'fatal') {
        if (frame.error.code === 'protocol-mismatch') {
          this.#closed = true;
          this.#setState({ status: 'incompatible', reason: frame.error.message });
          for (const waiter of this.#readyWaiters) waiter.reject(RpcError.from(frame.error));
          this.#readyWaiters.clear();
        }
      } else {
        this.#onFrame(frame);
      }
    };
    socket.onclose = (event) => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#failPending(new RpcError('internal', C.disconnected()));
      for (const entry of this.#topics.values()) entry.pending = false;
      if (welcomed) this.#attempt = 0;
      this.#scheduleReconnect(event.reason || (welcomed ? C.connectionLost() : C.cannotConnect()).text);
    };
    socket.onerror = () => {
      // The close event arrives afterwards and is handled uniformly there.
    };
  }

  #onWelcome(runtime: RuntimeInfo, connectionId: Id): void {
    if (this.#epoch !== runtime.epoch) {
      // The Runtime changed its run epoch: old cursors are meaningless, so all snapshots are fetched again.
      for (const entry of this.#topics.values()) entry.seq = null;
      this.#epoch = runtime.epoch;
    }
    this.#setState({ status: 'connected', runtime, connectionId });
    for (const waiter of this.#readyWaiters) waiter.resolve();
    this.#readyWaiters.clear();
    for (const entry of this.#topics.values()) this.#resubscribe(entry);
  }

  #scheduleReconnect(reason: string): void {
    if (this.#closed) return;
    if (this.#options.reconnect === false) {
      this.#setState({ status: 'disconnected', reason, retryInMs: null });
      for (const waiter of this.#readyWaiters) waiter.reject(new RpcError('internal', reason));
      this.#readyWaiters.clear();
      return;
    }
    const delay = BACKOFF_MS[Math.min(this.#attempt, BACKOFF_MS.length - 1)]!;
    this.#attempt++;
    this.#setState({ status: 'disconnected', reason, retryInMs: delay });
    this.#retryTimer = setTimeout(() => void this.#open(), delay);
  }

  #setState(state: ConnectionState): void {
    this.#state = state;
    for (const listener of this.#stateListeners) listener(state);
  }

  #waitReady(): Promise<void> {
    if (this.#state.status === 'connected') return Promise.resolve();
    if (this.#closed) return Promise.reject(new RpcError('internal', C.closed()));
    if (!this.#started) {
      this.#started = true;
      void this.#open();
    }
    return new Promise((resolve, reject) => this.#readyWaiters.add({ resolve, reject }));
  }

  // ---- Requests ----

  #send(method: string, params: unknown, timeoutOverride?: number): Promise<unknown> {
    const socket = this.#socket;
    if (!socket || this.#state.status !== 'connected') {
      return Promise.reject(new RpcError('internal', C.disconnected()));
    }
    const id = String(this.#nextId++);
    return new Promise((resolve, reject) => {
      const timeoutMs = timeoutOverride ?? this.#options.requestTimeoutMs ?? 30_000;
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new RpcError('internal', C.requestTimedOut({ method })));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ type: 'request', id, method, params }));
    });
  }

  #failPending(error: RpcError): void {
    for (const pending of this.#pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #onFrame(frame: ServerFrame): void {
    if (frame.type === 'response') {
      const pending = this.#pending.get(frame.id);
      if (!pending) return;
      this.#pending.delete(frame.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (frame.ok) pending.resolve(frame.result);
      else pending.reject(frame.error ? RpcError.from(frame.error) : new RpcError('internal', C.unknownError()));
    } else if (frame.type === 'event') {
      const entry = this.#topics.get(frame.topic);
      if (!entry) return;
      const event = { seq: frame.seq, event: frame.event };
      if (entry.pending) {
        entry.buffered.push(event);
      } else if (entry.seq !== null) {
        this.#deliver(entry, event);
      }
    }
  }

  // ---- Subscriptions ----

  #resubscribe(entry: TopicEntry): void {
    entry.pending = true;
    entry.buffered = [];
    const params = entry.seq === null ? { topic: entry.topic } : { topic: entry.topic, afterSeq: entry.seq };
    this.#send('subscribe', params).then(
      (raw) => {
        if (this.#topics.get(entry.topic) !== entry) return;
        entry.pending = false;
        const buffered = entry.buffered;
        entry.buffered = [];
        const result = raw as RpcResult<'subscribe'>;
        if (result.mode === 'snapshot') {
          entry.seq = result.seq;
          entry.handlers.snapshot(result.snapshot, result.seq);
        } else {
          for (const event of result.events) {
            if (!this.#deliver(entry, event)) return;
          }
        }
        for (const event of buffered) {
          if (this.#topics.get(entry.topic) !== entry || !this.#deliver(entry, event)) return;
        }
      },
      (error: unknown) => {
        entry.pending = false;
        entry.buffered = [];
        if (this.#topics.get(entry.topic) !== entry) return;
        // The topic does not exist (for example, the session was deleted): the caller learns this from the directory, and it is not retried. Not being allowed to subscribe (outside the Web service's allowlist) is likewise not retried.
        if (error instanceof RpcError && (error.code === 'not-found' || error.code === 'forbidden')) return;
        if (this.#state.status === 'connected') setTimeout(() => this.#resubscribe(entry), 1000);
      },
    );
  }

  /** Delivers one event. Returns false if a gap was found and a snapshot re-fetch has started. */
  #deliver(entry: TopicEntry, event: SequencedEvent<unknown>): boolean {
    if (entry.seq === null) return false;
    if (compareSeq(event.seq, entry.seq) <= 0) return true;
    if (!isNextSeq(entry.seq, event.seq)) {
      entry.seq = null;
      this.#resubscribe(entry);
      return false;
    }
    entry.seq = event.seq;
    entry.handlers.event(event.event, event.seq);
    return true;
  }
}
