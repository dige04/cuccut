/**
 * Seek queue (product design §11.1, exit condition for 0.3: “while dragging to seek, an old frame must not overwrite the new request”; architecture design §4.5).
 *
 * A media element can run only one seek at a time. While dragging, new requests arrive faster than seeks complete: only the latest one is kept, and it is sent once the previous seek completes (`seeked`); the requests in between are simply dropped. While seeking, the position the UI shows is the latest request, not the old time reported by the media element; only after everything has landed does it return to the media element's own time.
 */

export interface Seekable {
  currentTime: number;
}

export class SeekQueue {
  readonly #media: Seekable;
  #inFlight: number | null = null;
  #pending: number | null = null;

  constructor(media: Seekable) {
    this.#media = media;
  }

  /** Requests a seek to `time` seconds. */
  request(time: number): void {
    if (this.#inFlight === null) this.#apply(time);
    else this.#pending = time;
  }

  /** The media element's `seeked`. If requests are still queued, sends the next one; returns whether all of them have landed. */
  settle(): boolean {
    if (this.#inFlight === null) return true;
    if (this.#pending !== null) {
      const next = this.#pending;
      this.#pending = null;
      this.#apply(next);
      return false;
    }
    this.#inFlight = null;
    return true;
  }

  /** File changed or loading failed: drops all requests. */
  reset(): void {
    this.#inFlight = null;
    this.#pending = null;
  }

  /** The position to show while seeking (the latest request); null when not seeking. */
  get target(): number | null {
    return this.#pending ?? this.#inFlight;
  }

  #apply(time: number): void {
    this.#inFlight = time;
    this.#media.currentTime = time;
  }
}
