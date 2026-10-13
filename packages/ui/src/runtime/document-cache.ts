import type { DocumentContent, Id, Revision } from '@cuccut/protocol';

type Entry = { state: 'loading' } | { state: 'ready'; body: unknown } | { state: 'failed'; at: number };

/** After a failed fetch, wait this long before fetching again (the connection drops and the Runtime restarts, so fetches fail for a while). */
const RETRY_MS = 3000;

/**
 * Cache of document bodies (video format spec §4.4: bodies are stored per version and are not sent with the snapshot). The body of one version never changes, so it is remembered under “document@version”;
 * previews and the timeline share one copy, and subscribers are notified to redraw when it arrives.
 */
export class DocumentCache {
  readonly #read: (documentId: Id, revision: Revision) => Promise<DocumentContent>;
  readonly #entries = new Map<string, Entry>();
  readonly #listeners = new Set<() => void>();
  #generation = 0;

  constructor(read: (documentId: Id, revision: Revision) => Promise<DocumentContent>) {
    this.#read = read;
  }

  /** The body if it has already been fetched; undefined until then. Sends no request (also callable during React rendering). */
  peek(documentId: Id, revision: Revision): unknown {
    const entry = this.#entries.get(key(documentId, revision));
    return entry?.state === 'ready' ? entry.body : undefined;
  }

  /** Fetch it if there is none yet; do not send a duplicate while a fetch is in progress or has just failed. */
  load(documentId: Id, revision: Revision): void {
    const k = key(documentId, revision);
    const entry = this.#entries.get(k);
    if (entry && (entry.state !== 'failed' || performance.now() - entry.at < RETRY_MS)) return;
    const generation = this.#generation;
    const pending: Entry = { state: 'loading' };
    this.#entries.set(k, pending);
    this.#read(documentId, revision).then(
      (content) => this.#settle(generation, k, pending, { state: 'ready', body: content.body }),
      () => this.#settle(generation, k, pending, { state: 'failed', at: performance.now() }),
    );
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Video changed: bodies of the old video are no longer needed, and in-flight requests are ignored when they return. */
  clear(): void {
    this.#generation++;
    this.#entries.clear();
  }

  /** Forget in-flight requests (the “retry” when a preview is stuck): the next request is sent anew, and in-flight responses are ignored when they return; bodies already fetched are kept. */
  forgetPending(): void {
    for (const [k, entry] of [...this.#entries]) if (entry.state === 'loading') this.#entries.delete(k);
  }

  #settle(generation: number, k: string, pending: Entry, entry: Entry): void {
    if (generation !== this.#generation || this.#entries.get(k) !== pending) return;
    this.#entries.set(k, entry);
    for (const listener of this.#listeners) listener();
  }
}

function key(documentId: Id, revision: Revision): string {
  return `${documentId}@${revision}`;
}
