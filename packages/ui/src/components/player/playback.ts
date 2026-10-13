import { useSyncExternalStore } from 'react';
import { SeekQueue } from '../../model/seek.ts';
import { P } from './player-copy.ts';

/** Event-driven playback state: changes only when events happen, not on every frame. */
export interface PlaybackStatus {
  ready: boolean;
  paused: boolean;
  ended: boolean;
  waiting: boolean;
  duration: number;
  /** Has a picture (audio files do not). */
  hasPicture: boolean;
  error: string | null;
}

const INITIAL: PlaybackStatus = { ready: false, paused: true, ended: false, waiting: false, duration: 0, hasPicture: false, error: null };

/** MediaError.code → message key (read only on error, following the UI language at that time). */
const MEDIA_ERRORS: Record<number, 'aborted' | 'network' | 'decode' | 'unsupported'> = { 1: 'aborted', 2: 'network', 3: 'decode', 4: 'unsupported' };
const mediaErrorText = (code: number): string => P.mediaError[MEDIA_ERRORS[code] ?? 'other'];

type MediaWithFrames = HTMLMediaElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Playback control for one media element (architecture design §4.5: the playback clock and dragging stay local to the UI).
 *
 * - Time is read once per frame: when there is a picture, it takes the time of “this frame” (requestVideoFrameCallback), so subtitles follow the picture;
 *   audio uses currentTime.
 * - Seeks go through SeekQueue: while dragging, only the latest request is kept, and while seeking, the displayed position is that request (acceptance T30).
 * - Components subscribe on demand: time (per frame) and state (events) are separate, and the subtitle list only subscribes to the sentence index derived from time.
 */
export class PlaybackController {
  readonly media: MediaWithFrames;
  readonly #queue: SeekQueue;
  readonly #timeListeners = new Set<() => void>();
  readonly #statusListeners = new Set<() => void>();
  #time = 0;
  #status: PlaybackStatus = INITIAL;
  #frame: number | null = null;
  #videoFrame: number | null = null;
  readonly #cleanup: () => void;

  constructor(media: HTMLMediaElement) {
    this.media = media as MediaWithFrames;
    this.#queue = new SeekQueue(media);
    const on = (type: string, handler: () => void) => {
      media.addEventListener(type, handler);
      return () => media.removeEventListener(type, handler);
    };
    const offs = [
      on('loadedmetadata', () =>
        this.#update({
          ready: true,
          duration: finite(media.duration),
          hasPicture: media instanceof HTMLVideoElement && media.videoWidth > 0,
        }),
      ),
      on('durationchange', () => this.#update({ duration: finite(media.duration) })),
      on('play', () => {
        this.#update({ paused: false, ended: false });
        this.#startLoop();
      }),
      on('pause', () => {
        this.#update({ paused: true });
        this.#stopLoop();
        this.#readTime();
      }),
      on('ended', () => {
        this.#update({ paused: true, ended: true });
        this.#stopLoop();
        this.#readTime();
      }),
      on('waiting', () => this.#update({ waiting: true })),
      on('playing', () => this.#update({ waiting: false })),
      on('canplay', () => this.#update({ waiting: false })),
      on('seeked', () => {
        this.#queue.settle();
        this.#readTime();
      }),
      on('timeupdate', () => {
        if (this.media.paused) this.#readTime();
      }),
      on('emptied', () => {
        this.#queue.reset();
        this.#update(INITIAL);
      }),
      on('error', () => {
        this.#queue.reset();
        this.#update({ error: mediaErrorText(media.error?.code ?? 0), waiting: false });
      }),
    ];
    this.#cleanup = () => {
      for (const off of offs) off();
      this.#stopLoop();
    };
  }

  dispose(): void {
    this.#cleanup();
  }

  // ---- Read ----

  /** Position for display: while seeking, it is the latest request; otherwise it is the time of the picture (or sound). */
  get time(): number {
    return this.#time;
  }

  get status(): PlaybackStatus {
    return this.#status;
  }

  subscribeTime = (listener: () => void): (() => void) => {
    this.#timeListeners.add(listener);
    return () => this.#timeListeners.delete(listener);
  };

  subscribeStatus = (listener: () => void): (() => void) => {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  };

  // ---- Control ----

  toggle(): void {
    if (this.media.paused) this.play();
    else this.media.pause();
  }

  play(): void {
    if (this.#status.ended) this.seek(0);
    // Called from user gestures. When the call is rejected (e.g. not loaded yet), the state is explained by events, so no error is thrown here.
    void this.media.play().catch(() => {});
  }

  pause(): void {
    this.media.pause();
  }

  seek(time: number): void {
    const duration = this.#status.duration;
    const target = Math.max(0, duration ? Math.min(time, duration) : time);
    if (this.#status.ended && target < duration) this.#update({ ended: false });
    this.#queue.request(target);
    this.#setTime(target);
  }

  nudge(delta: number): void {
    this.seek((this.#queue.target ?? this.#time) + delta);
  }

  // ---- Internal ----

  #readTime(frameTime?: number): void {
    this.#setTime(this.#queue.target ?? frameTime ?? this.media.currentTime);
  }

  #setTime(time: number): void {
    if (time === this.#time) return;
    this.#time = time;
    for (const listener of this.#timeListeners) listener();
  }

  #update(patch: Partial<PlaybackStatus>): void {
    const next = { ...this.#status, ...patch };
    if ((Object.keys(next) as (keyof PlaybackStatus)[]).every((k) => next[k] === this.#status[k])) return;
    this.#status = next;
    for (const listener of this.#statusListeners) listener();
  }

  #startLoop(): void {
    this.#stopLoop();
    const media = this.media;
    if (this.#status.hasPicture && media.requestVideoFrameCallback) {
      const onFrame = (_now: number, metadata: { mediaTime: number }) => {
        this.#readTime(metadata.mediaTime);
        this.#videoFrame = media.requestVideoFrameCallback!(onFrame);
      };
      this.#videoFrame = media.requestVideoFrameCallback(onFrame);
      return;
    }
    const tick = () => {
      this.#readTime();
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #stopLoop(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    if (this.#videoFrame !== null) this.media.cancelVideoFrameCallback?.(this.#videoFrame);
    this.#frame = null;
    this.#videoFrame = null;
  }
}

function finite(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const NO_SUBSCRIBE = () => () => {};

/** Subscribes to values derived from time. `select` should return primitive values (numbers, strings); the component only redraws when that value changes. */
export function usePlaybackTime<T extends string | number | boolean | null>(
  controller: PlaybackController | null,
  select: (time: number) => T,
): T {
  return useSyncExternalStore(controller?.subscribeTime ?? NO_SUBSCRIBE, () => select(controller?.time ?? 0));
}

export function usePlaybackStatus(controller: PlaybackController | null): PlaybackStatus {
  return useSyncExternalStore(controller?.subscribeStatus ?? NO_SUBSCRIBE, () => controller?.status ?? INITIAL);
}
