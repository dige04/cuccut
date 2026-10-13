import type { VersionRef } from '@cuccut/protocol';

/** How asset bytes become something drawable. `release` is called when the cache drops it (for example, to destroy a player instance). */
export interface AssetDecoder<T> {
  /** Part of the cache key: the same asset can be decoded separately by different decoders. */
  readonly name: string;
  decode(response: Response): Promise<T>;
  release?(value: T): void;
}

export type AssetState<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed'; message: string };

/** The asset content needed to draw a frame, and where it comes from (in the UI, the video asset cache). If it is not there yet, fetch it; once it is fetched, the cache notification triggers a redraw. */
export interface AssetSource {
  get<T>(asset: VersionRef, decoder: AssetDecoder<T>): AssetState<T>;
}
