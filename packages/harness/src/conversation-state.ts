import {
  clampOutput,
  nowIso,
  type Conversation,
  type ConversationEvent,
  type ConversationSnapshot,
  type Id,
  type Seq,
  type SequencedEvent,
  type TimelineItem,
} from '@cuccut/protocol';
import type { ConversationRecord } from '@cuccut/runtime-storage';
import { TopicLog, type TopicSubscription } from './topic-log.ts';

/** Default merge window for streaming text deltas (milliseconds). */
export const DEFAULT_APPEND_WINDOW_MS = 60;

/** Merge state for an `itemId + field`: last publish time and deltas pending within the window. */
interface PendingAppend {
  itemId: Id;
  field: 'text' | 'output';
  delta: string;
  lastPublishedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * In-memory state for one session: persistent record + entry index + event stream. Every modification marks dirty synchronously; the sequence number is saved to disk along with the record.
 *
 * Streaming text deltas are merged by `itemId + field` (architecture design §11.3): the text in the record is appended synchronously, while events are "sent immediately at the leading edge, merged within the window, sent once when it expires". Before any non-append event, subscription, or snapshot read, `flush()` is called, so when a client sees a terminal event or gets a snapshot, all earlier text deltas have already been published in order.
 */
export class ConversationState {
  readonly record: ConversationRecord;
  readonly log: TopicLog<ConversationSnapshot, ConversationEvent>;
  readonly #index = new Map<Id, number>();
  readonly #dirty: () => void;
  readonly #onConversationChanged: (conversation: Conversation, previous: Conversation) => void;
  readonly #onTaskChanged: (task: Extract<TimelineItem, { kind: 'task' }>) => void;
  readonly #appendWindowMs: number;
  readonly #appends = new Map<string, PendingAppend>();

  constructor(
    record: ConversationRecord,
    hooks: {
      dirty: () => void;
      conversationChanged: (conversation: Conversation, previous: Conversation) => void;
      taskChanged: (task: Extract<TimelineItem, { kind: 'task' }>) => void;
    },
    options: { appendWindowMs?: number } = {},
  ) {
    this.#appendWindowMs = Math.max(0, options.appendWindowMs ?? DEFAULT_APPEND_WINDOW_MS);
    this.record = record;
    this.#dirty = hooks.dirty;
    this.#onConversationChanged = hooks.conversationChanged;
    this.#onTaskChanged = hooks.taskChanged;
    record.items.forEach((item, i) => this.#index.set(item.id, i));
    this.log = new TopicLog(() => this.snapshot(), record.seq);
  }

  get conversation(): Conversation {
    return this.record.conversation;
  }

  get id(): Id {
    return this.record.conversation.id;
  }

  snapshot(): ConversationSnapshot {
    return { conversation: this.record.conversation, items: this.record.items };
  }

  item(id: Id): TimelineItem | undefined {
    const i = this.#index.get(id);
    return i === undefined ? undefined : this.record.items[i];
  }

  items(): readonly TimelineItem[] {
    return this.record.items;
  }

  upsert(item: TimelineItem): void {
    const i = this.#index.get(item.id);
    if (i === undefined) {
      this.#index.set(item.id, this.record.items.length);
      this.record.items.push(item);
    } else {
      this.record.items[i] = item;
    }
    this.#publishOrdered({ type: 'item.upsert', item });
    if (item.kind === 'task') this.#onTaskChanged(item);
  }

  tasks(): Extract<TimelineItem, { kind: 'task' }>[] {
    return this.record.items.filter((item): item is Extract<TimelineItem, { kind: 'task' }> => item.kind === 'task');
  }

  /** Appends streaming text. When `output` exceeds the limit, only the tail is kept. */
  append(id: Id, field: 'text' | 'output', delta: string): void {
    const item = this.item(id);
    if (!item || !delta) return;
    if (field === 'text' && (item.kind === 'agent-message' || item.kind === 'reasoning')) {
      item.text += delta;
    } else if (field === 'output' && item.kind === 'tool-call') {
      item.output = clampOutput(item.output + delta);
    } else {
      return;
    }
    this.#dirty();
    this.#queueAppend(id, field, delta);
  }

  /** Immediately publishes all pending text deltas, in order. */
  flush(): void {
    for (const entry of this.#appends.values()) this.#publishPending(entry);
  }

  /** Flush before subscribing: the snapshot already contains pending deltas; without a flush, the subscriber would receive the same text again. */
  subscribe(
    afterSeq: Seq | undefined,
    listener: (event: SequencedEvent<ConversationEvent>) => void,
  ): TopicSubscription<ConversationSnapshot, ConversationEvent> {
    this.flush();
    return this.log.subscribe(afterSeq, listener);
  }

  /** Session discarded: clears the timer; unsent deltas are no longer published (subscribers are then disconnected). */
  dispose(): void {
    for (const entry of this.#appends.values()) if (entry.timer) clearTimeout(entry.timer);
    this.#appends.clear();
  }

  /** `touch: false`: organizing actions like pinning or marking as read don't count as activity and don't change the "recent activity" ordering. */
  updateConversation(patch: Partial<Omit<Conversation, 'id'>>, options: { touch?: boolean } = {}): Conversation {
    const previous = this.record.conversation;
    const next = { ...previous, ...patch, updatedAt: options.touch === false ? previous.updatedAt : nowIso() };
    this.record.conversation = next;
    this.#publishOrdered({ type: 'conversation.updated', conversation: next });
    this.#onConversationChanged(next, previous);
    return next;
  }

  #queueAppend(itemId: Id, field: 'text' | 'output', delta: string): void {
    const key = `${itemId}\0${field}`;
    const now = Date.now();
    let entry = this.#appends.get(key);
    if (!entry) {
      this.#prune(now);
      entry = { itemId, field, delta: '', lastPublishedAt: Number.NEGATIVE_INFINITY, timer: null };
      this.#appends.set(key, entry);
    }
    entry.delta += delta;
    if (entry.timer) return; // A pending timer already exists within the window: only merge
    const wait = entry.lastPublishedAt + this.#appendWindowMs - now;
    if (wait <= 0) {
      this.#publishPending(entry);
      return;
    }
    entry.timer = setTimeout(() => this.#publishPending(entry), wait);
    entry.timer.unref?.();
  }

  #publishPending(entry: PendingAppend): void {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (!entry.delta) return;
    const delta = entry.delta;
    entry.delta = '';
    entry.lastPublishedAt = Date.now();
    this.#publish({ type: 'item.append', itemId: entry.itemId, field: entry.field, delta });
  }

  /** Drops entries whose window has long passed and that have nothing pending, so the Map doesn't grow forever in long sessions. */
  #prune(now: number): void {
    if (this.#appends.size < 64) return;
    for (const [key, entry] of this.#appends) {
      if (!entry.timer && !entry.delta && now - entry.lastPublishedAt >= this.#appendWindowMs) this.#appends.delete(key);
    }
  }

  /** Non-append event: a completion boundary; flushes pending deltas first. */
  #publishOrdered(event: ConversationEvent): void {
    this.flush();
    this.#publish(event);
  }

  #publish(event: ConversationEvent): void {
    this.record.seq = this.log.publish(event);
    this.#dirty();
  }
}
