import { compareSeq, nextSeq, type Seq, type SequencedEvent, type SubscribeResult } from '@cuccut/protocol';

export interface TopicSubscription<S, E> {
  result: SubscribeResult<S, E>;
  unsubscribe: () => void;
}

/**
 * Ordered event stream of one topic (architecture design §4.4).
 *
 * - State changes and `publish` complete in the same synchronous section, so “snapshot + the events after it” naturally share one watermark.
 * - Keeps a recent window of events for replay after disconnection. When the gap cannot be filled, a snapshot is given instead; it does not continue on a mirror with missing events.
 */
export class TopicLog<S, E> {
  readonly #snapshot: () => S;
  readonly #capacity: number;
  readonly #buffer: SequencedEvent<E>[] = [];
  readonly #listeners = new Set<(event: SequencedEvent<E>) => void>();
  #seq: Seq;

  constructor(snapshot: () => S, initialSeq: Seq, capacity = 2000) {
    this.#snapshot = snapshot;
    this.#seq = initialSeq;
    this.#capacity = capacity;
  }

  get seq(): Seq {
    return this.#seq;
  }

  publish(event: E): Seq {
    this.#seq = nextSeq(this.#seq);
    const sequenced = { seq: this.#seq, event };
    this.#buffer.push(sequenced);
    if (this.#buffer.length > this.#capacity) this.#buffer.splice(0, this.#buffer.length - this.#capacity);
    for (const listener of this.#listeners) listener(sequenced);
    return this.#seq;
  }

  subscribe(afterSeq: Seq | undefined, listener: (event: SequencedEvent<E>) => void): TopicSubscription<S, E> {
    this.#listeners.add(listener);
    return { result: this.#initial(afterSeq), unsubscribe: () => this.#listeners.delete(listener) };
  }

  #initial(afterSeq: Seq | undefined): SubscribeResult<S, E> {
    if (afterSeq !== undefined && compareSeq(afterSeq, this.#seq) <= 0) {
      if (compareSeq(afterSeq, this.#seq) === 0) return { mode: 'replay', seq: this.#seq, events: [] };
      const first = this.#buffer[0];
      if (first && compareSeq(first.seq, nextSeq(afterSeq)) <= 0) {
        return {
          mode: 'replay',
          seq: this.#seq,
          events: this.#buffer.filter((e) => compareSeq(e.seq, afterSeq) > 0),
        };
      }
    }
    return { mode: 'snapshot', seq: this.#seq, snapshot: this.#snapshot() };
  }

  /** When a topic is deleted, all subscribers are disconnected. */
  clear(): void {
    this.#listeners.clear();
  }
}
