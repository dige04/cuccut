import type { Id } from '@cuccut/protocol';

/**
 * Stall diagnostics for the preview: the engine hands over a snapshot every so often; if it stays on the same step for longer than `STALL_MS`, it logs one `console.warn` naming the step it is stuck at
 * (during development the Electron main process forwards it to the terminal), and at the same time notifies subscribers (the stall hint on the stage, product design §5.1 “preview loading and stalls”).
 * A given stall is reported only once; when there is progress (the step is passed, or it moves to another step), timing starts again. For media waiting for the Runtime to prepare a compatible copy: if the progress is moving, that counts as progress;
 * when the Runtime doesn't know the progress, it is not counted as stalled (conversion has its own timeout, and on failure it falls through to the card for media the main element can't play).
 *
 * Uses a timer for polling, not requestAnimationFrame: rAF does not run when the window is obscured or hidden. No timing is done while the page is hidden (not drawing while hidden is normal).
 */

/** Which step is stuck. */
export type StallStep =
  /** The render kernel (the WASM and the fonts shipped with it) has not finished loading. */
  | 'planner-loading'
  /** The kernel is ready, but the video has not been handed to it yet. */
  | 'no-video'
  /** An error occurred when handing the video to the kernel; it has not been matched to elements yet. */
  | 'video-error'
  /** The kernel and video are both ready, but no plan has been computed yet (most likely an unexpected error was thrown while computing the plan; see `lastError`). */
  | 'no-plan'
  /** The media layers to draw or elements to play at this moment have stayed unready (no element, can't load, seek doesn't land); see `media`. */
  | 'media-pending'
  /** All needed media is waiting for compatible copies, and conversion progress has not moved; see `media`. */
  | 'media-preparing'
  /** Document bodies the caption layer needs have not been fetched; see `documents`. */
  | 'documents-pending'
  /** Local fonts have not finished fetching; see `fonts`. */
  | 'fonts-loading'
  /** A frame needs drawing but the canvas has not changed (an unexpected error was thrown while drawing; see `lastError`). */
  | 'not-painted'
  /** A frame needs drawing, but there is no canvas yet. */
  | 'no-canvas';

/** Why the media is not ready yet. */
export type MediaWait =
  /** The element is not on the page (most likely the asset address hasn't been fetched yet, e.g. the Runtime isn't connected). */
  | 'no-element'
  /** No element yet: the Runtime is preparing a compatible copy (the browser can't play this WebM); see `progress`. */
  | 'preparing'
  /** The element failed to load or decode. */
  | 'error'
  /** No picture for this moment yet (`readyState` is below HAVE_CURRENT_DATA). */
  | 'no-data'
  /** The seek has not landed yet. */
  | 'seeking'
  /** There is a picture, but not for the moment needed. */
  | 'position'
  /** Images decoded in the kernel (SVG, GIF): the bytes are still being fetched, or cannot be fetched. */
  | 'bytes-loading'
  | 'bytes-missing';

/** A media layer or sound that is not ready. The address is not recorded: it may contain access credentials. */
export interface MediaProbe {
  itemId: Id;
  /** The asset supplying picture or sound (the UI uses it to name “which media is being waited on”). */
  assetId?: Id;
  kind: 'video' | 'image' | 'audio';
  wait: MediaWait;
  /** The source time needed, in seconds; images have none. */
  wantedSeconds: number | null;
  /** During `preparing`, how far the compatible copy's encoding has got (0–1); null if the Runtime does not know yet. */
  progress?: number | null;
  /** Element state; null when there is no element or it does not go through an element (images decoded by the kernel). */
  element: {
    readyState: number | null;
    networkState: number | null;
    errorCode: number | null;
    seeking: boolean;
    currentTime: number | null;
    hasSource: boolean;
  } | null;
}

/** Snapshot handed over by the engine. */
export interface PreviewSnapshot {
  status: 'loading' | 'ready' | 'error';
  planner: 'loading' | 'ready';
  video: boolean;
  videoError: string | null;
  plan: boolean;
  canvas: boolean;
  playing: boolean;
  /** The most recently drawn frame on the canvas: a new object is created for each frame drawn, and progress is checked by object identity. */
  painted: object | null;
  /** A frame needs drawing (during playback, a redraw is queued, something changed, or the plan is not yet on the canvas). */
  paintWanted: boolean;
  media: MediaProbe[];
  documents: Id[];
  fonts: string[];
}

export interface StallReport extends Omit<PreviewSnapshot, 'painted'> {
  step: StallStep;
  /** How long it has been stuck at this step (ms, counting only time the page is visible). */
  stalledMs: number;
  /** When it started being stuck at this step (the diagnostic clock, default `performance.now()`); the UI uses it to count “how long it has been waiting” second by second. */
  since: number;
  /** The most recent unexpected error that was caught (thrown in a playback tick, a redraw, or a media event). */
  lastError: string | null;
  /** Still stalled; becomes false once there is progress. */
  ongoing: boolean;
}

/** Only report after being stuck on the same step this long. */
export const STALL_MS = 10_000;
/** How often to check. */
export const POLL_MS = 2_000;
/** The same unexpected error is logged only once within this window (so it doesn't flood the console when thrown every frame during playback). */
const ERROR_REPEAT_MS = 10_000;

export interface WatchOptions {
  now?: () => number;
  /** Schedules one check and returns a function that cancels it. */
  schedule?: (run: () => void, ms: number) => () => void;
  visible?: () => boolean;
  warn?: (message: string, report: StallReport) => void;
  error?: (message: string, error: unknown) => void;
}

// i18n-ignore-start: dev log
const STEP_LABELS: Record<StallStep, string> = {
  'planner-loading': '渲染内核还没载入完',
  'no-video': '渲染内核好了，还没交给它视频',
  'video-error': '视频交给渲染内核时出错',
  'no-plan': '还没求出帧计划',
  'media-pending': '在等媒体',
  'media-preparing': '在等兼容副本，转换没有进展',
  'documents-pending': '在等字幕文档',
  'fonts-loading': '在等本机字体',
  'not-painted': '有一帧要画，画布上一直没换',
  'no-canvas': '有一帧要画，还没有画布',
};
// i18n-ignore-end

/** Which step this snapshot is stuck at; `progressed` means the canvas has swapped frames since it was last checked. null if not stalled. */
export function stalledStep(snapshot: PreviewSnapshot, progressed: boolean): StallStep | null {
  // When there is an error, the UI shows a hint, so it does not count as stalled.
  if (snapshot.status === 'error') return null;
  if (snapshot.status === 'loading') {
    if (snapshot.planner === 'loading') return 'planner-loading';
    if (!snapshot.video) return 'no-video';
    if (snapshot.videoError) return 'video-error';
    return 'no-plan';
  }
  if (snapshot.media.length > 0) {
    if (snapshot.media.some((probe) => probe.wait !== 'preparing')) return 'media-pending';
    // All waiting on compatible copies: those with unknown progress don't count as stalled; whether the progress has moved is compared by `PreviewWatch` (see `preparingMark`).
    return snapshot.media.some((probe) => probe.progress == null) ? null : 'media-preparing';
  }
  if (snapshot.documents.length > 0) return 'documents-pending';
  if (snapshot.fonts.length > 0) return 'fonts-loading';
  if (snapshot.paintWanted && !progressed) return snapshot.canvas ? 'not-painted' : 'no-canvas';
  return null;
}

/** The conversion progress marker: uses the raw 0–1 ratio, not the rounded percentage (1% of a long film can take longer than the stall threshold). */
export function preparingMark(snapshot: Pick<PreviewSnapshot, 'media'>): string {
  return snapshot.media
    .filter((probe) => probe.wait === 'preparing')
    .map((probe) => `${probe.assetId ?? probe.itemId}=${probe.progress ?? ''}`)
    .sort()
    .join(',');
}

/** Why the element cannot be used right now (`readyState` and similar follow the HTMLMediaElement constants; 2 is HAVE_CURRENT_DATA). */
export function probeElement(element: Partial<HTMLMediaElement & HTMLImageElement> | null | undefined): {
  wait: MediaWait;
  element: MediaProbe['element'];
} {
  if (!element) return { wait: 'no-element', element: null };
  const isImage = typeof element.complete === 'boolean' && element.readyState === undefined;
  const state = {
    readyState: element.readyState ?? null,
    networkState: element.networkState ?? null,
    errorCode: element.error?.code ?? null,
    seeking: element.seeking ?? false,
    currentTime: element.currentTime ?? null,
    hasSource: Boolean(element.currentSrc || element.src),
  };
  if (isImage) return { wait: element.complete && !(element.naturalWidth! > 0) ? 'error' : 'no-data', element: state };
  if (element.error) return { wait: 'error', element: state };
  if (element.seeking) return { wait: 'seeking', element: state };
  if ((element.readyState ?? 0) < 2) return { wait: 'no-data', element: state };
  return { wait: 'position', element: state };
}

export class PreviewWatch {
  readonly #probe: () => PreviewSnapshot;
  readonly #now: () => number;
  readonly #schedule: (run: () => void, ms: number) => () => void;
  readonly #visible: () => boolean;
  readonly #warn: (message: string, report: StallReport) => void;
  readonly #error: (message: string, error: unknown) => void;
  #running = false;
  #cancel: (() => void) | null = null;
  #step: StallStep | null = null;
  /** Progress marker while stuck on conversion: if it changes, that counts as progress. */
  #mark = '';
  #since = 0;
  #warned = false;
  #lastPainted: object | null = null;
  #report: StallReport | null = null;
  #lastError: { message: string; at: number } | null = null;
  readonly #listeners = new Set<(report: StallReport | null) => void>();

  constructor(probe: () => PreviewSnapshot, options: WatchOptions = {}) {
    this.#probe = probe;
    this.#now = options.now ?? (() => performance.now());
    // Capture the timer at creation time: an engine created before the tests swap in fake timers also stops using the same set.
    const { setTimeout: set, clearTimeout: clear } = globalThis;
    this.#schedule =
      options.schedule ??
      ((run, ms) => {
        const timer = set(run, ms);
        return () => clear(timer);
      });
    this.#visible = options.visible ?? (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
    this.#warn = options.warn ?? ((message, report) => console.warn(message, report)); // i18n-ignore: dev log
    this.#error = options.error ?? ((message, error) => console.error(message, error)); // i18n-ignore: dev log
  }

  /** The most recently reported stall (`ongoing` becomes false once there is progress); null if none has been reported. */
  get report(): StallReport | null {
    return this.#report;
  }

  /** The stall still in progress (the `report` whose `ongoing` is true); null if not stalled. */
  get ongoing(): StallReport | null {
    return this.#report?.ongoing ? this.#report : null;
  }

  /** Notifies when a stall is reported and when it ends (the argument is the stall still in progress, or null when it has ended); returns a function that unsubscribes. */
  onChange(listener: (report: StallReport | null) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Restart timing (after a retry): any current stall counts as ended, and if still stuck afterward, it must reach a full `STALL_MS` before being reported. */
  reset(): void {
    this.#reset();
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#reset();
    this.#arm();
  }

  stop(): void {
    this.#running = false;
    this.#cancel?.();
    this.#cancel = null;
  }

  /** Checks once (called when the timer fires; tests call it directly). */
  check(): void {
    if (!this.#visible()) {
      // Not drawing while hidden is normal: timing restarts once it is visible again.
      this.#reset();
      return;
    }
    const snapshot = this.#probe();
    const progressed = snapshot.painted !== this.#lastPainted;
    this.#lastPainted = snapshot.painted;
    const step = stalledStep(snapshot, progressed);
    const mark = step === 'media-preparing' ? preparingMark(snapshot) : '';
    const now = this.#now();
    if (step !== this.#step || mark !== this.#mark) {
      this.#end();
      this.#step = step;
      this.#mark = mark;
      this.#since = now;
      this.#warned = false;
    }
    if (!step || this.#warned || now - this.#since < STALL_MS) return;
    this.#warned = true;
    const { painted: _painted, ...rest } = snapshot;
    const report: StallReport = {
      ...rest,
      step,
      stalledMs: Math.round(now - this.#since),
      since: this.#since,
      lastError: this.#lastError?.message ?? null,
      ongoing: true,
    };
    this.#report = report;
    // i18n-ignore: dev log
    this.#warn(`[preview] 预览卡住了：${STEP_LABELS[step]}（${Math.round((now - this.#since) / 1000)} 秒）`, report);
    this.#notify(report);
  }

  /** An unexpected error thrown in a playback tick, a redraw, or a media event: caught, logged (the same error is logged only once for a while), and recorded in the next report. */
  noteError(where: string, error: unknown): void {
    const message = `${where}: ${error instanceof Error ? error.message : String(error)}`;
    const now = this.#now();
    const last = this.#lastError;
    this.#lastError = { message, at: last?.message === message && now - last.at < ERROR_REPEAT_MS ? last.at : now };
    if (last?.message === message && now - last.at < ERROR_REPEAT_MS) return;
    // i18n-ignore: dev log
    this.#error(`[preview] ${where}时抛了意外的错，预览接着跑`, error);
  }

  #reset(): void {
    this.#step = null;
    this.#mark = '';
    this.#warned = false;
    this.#end();
  }

  /** The stall currently held is treated as ended. */
  #end(): void {
    if (!this.#report?.ongoing) return;
    this.#report = { ...this.#report, ongoing: false };
    this.#notify(null);
  }

  #notify(report: StallReport | null): void {
    for (const listener of this.#listeners) {
      try {
        listener(report);
      } catch (error) {
        this.noteError('卡住通知', error); // i18n-ignore: dev log
      }
    }
  }

  #arm(): void {
    this.#cancel = this.#schedule(() => {
      if (!this.#running) return;
      try {
        this.check();
      } catch (error) {
        // The diagnostics themselves failing should not affect the preview.
        this.noteError('卡住诊断', error); // i18n-ignore: dev log
      }
      if (this.#running) this.#arm();
    }, POLL_MS);
  }
}
