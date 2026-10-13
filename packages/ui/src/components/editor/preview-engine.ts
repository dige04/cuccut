import type { AssetRecord, DocumentRecord, FontFaceQuery, Id, Revision, Sequence, VersionRef } from '@cuccut/protocol';
import { durationSeconds, videoSlots } from '../../model/editor.ts';
import { LIVE_CAPTION_ITEM_ID, liveCaptionCues, liveCaptionDocuments, withLiveCaption, type LiveCue } from '../../model/live-caption.ts';
import { captionView, type CaptionMode } from '../../model/player.ts';
import type { AssetDecoder, AssetSource } from '../../render/asset-source.ts';
import { SPECTRUM_MAX_BYTES, spectrumDecoder } from '../../render/audio-spectrum.ts';
import { isMediaLayer, type FramePlan, type MediaLayer, type VisualLayer } from '../../render/frame-plan.ts';
import type { FontSource, LoadedFace } from '../../render/local-fonts.ts';
import { paintSize } from '../../render/playback-quality.ts';
import { loadRenderPlanner } from '../../render/preview-wasm.ts';
import {
  PlanFailure,
  type CaptionHit,
  type FrozenDocument,
  type MissingSpectrum,
  type RenderPlanner,
  type RenderedFrame,
  type SpeechTranscript,
} from '../../render/render-planner.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { PreviewWatch, probeElement, type MediaProbe, type PreviewSnapshot, type StallReport } from './preview-watch.ts';

/**
 * Playback driver for the preview (product design §5.4 “current working draft”, architecture design §9.4 Interactive tier).
 *
 * At each moment it first asks the frame planner (the WASM built from Rust `render-graph`) which layers this frame has, how they are placed, what time each source is taken at, and which sounds are playing,
 * then drives the hidden media elements according to the plan. The picture is drawn by `frame-render` in the same WASM (the same implementation as export): the UI only passes in the media elements' picture at this moment, the body of subtitle documents, the bytes of Lottie, SVG and GIF images, and the asset spectra that waveforms need; it gets back one RGBA frame and puts it on the canvas. During playback the playhead advances by the wall clock,
 * and the media elements are corrected when they drift too far; this tier allows dropped frames, and strict frame-by-frame output is the job of export.
 *
 * Video elements are slotted by asset: the same asset appearing in several places at the same moment needs several elements (each seeks on its own). Instances try to stay in their original slot,
 * so that a split into two segments still connects. Each instance on an audio track uses its own element; images share one per asset.
 *
 * A video layer does not necessarily come from a video instance (a composition with a pre-rendered stand-in also produces picture and sound as a video layer): which asset is used depends only on the layer in the plan and the `asset` the sound carries itself, and instances are not looked up again.
 */

export type MediaKey = string;

export function videoKey(asset: VersionRef, slot: number): MediaKey {
  return `v:${asset.id}:${asset.revision}#${slot}`;
}

export function imageKey(asset: VersionRef): MediaKey {
  return `i:${asset.id}:${asset.revision}`;
}

export function audioKey(itemId: Id): MediaKey {
  return `a:${itemId}`;
}

/** `problems`: things in this frame that cannot be drawn (unrecognized styles, code bundles with no pre-render, etc.); the picture still comes out as usual, and these are reported separately. */
export type PreviewStatus = { kind: 'loading' } | { kind: 'ready'; problems?: string[] } | { kind: 'error'; message: string };

/** Where document bodies come from (in the UI, the video's document cache). */
export interface DocumentSource {
  /** Bodies already fetched; undefined if not yet. */
  peek(documentId: Id, revision: Revision): unknown;
  /** If not present, fetch it; once fetched, the cache notifies a redraw. */
  load(documentId: Id, revision: Revision): void;
}

/** Document bodies the preview needs (subtitles and subtitle styles): notify a redraw once fetched. */
export interface PreviewDocuments extends DocumentSource {
  subscribe(listener: () => void): () => void;
  /** Forget requests still in flight (the “Retry” when the preview is stuck): the next request is sent anew, and responses to the old ones are discarded. */
  forgetPending?(): void;
}

/** Asset content the preview needs (bytes of Lottie, SVG and GIF images, asset spectra for waveforms): notify a redraw once fetched. */
export interface PreviewAssets extends AssetSource {
  subscribe(listener: () => void): () => void;
  /** Same as `PreviewDocuments.forgetPending`. */
  forgetPending?(): void;
}

/**
 * Whether the media the preview needs is waiting for a compatible copy (WebM the browser cannot play; the Runtime is converting it, and `media.playback` returns pending): how far the conversion has got
 * (0–1; null if the Runtime does not know yet), undefined when not waiting. The stall diagnostics use this to tell “converting” apart from “waiting for media”.
 */
export type PreviewPreparing = (asset: VersionRef) => number | null | undefined;

/** Source element for a video or image layer. */
export type SourceElement = HTMLVideoElement | HTMLImageElement;

/** Raw bytes of the asset (Lottie, SVG and GIF images are decoded by WASM itself). */
const BYTES: AssetDecoder<Uint8Array> = {
  name: 'bytes',
  decode: async (response) => new Uint8Array(await response.arrayBuffer()),
};

/**
 * Counters for the most recent playback (architecture design §9.12, read by `npm run bench:preview`): accumulated from `play()`, kept after stopping until the next playback.
 * At most `STATS_SAMPLES` per-tick samples are kept.
 */
export interface PlaybackStats {
  /** Playback ticks (one per requestAnimationFrame callback). */
  ticks: number;
  /** Ticks where it is still on the same video frame and the canvas already shows that frame, so nothing is redrawn. */
  repeated: number;
  /** Frames drawn onto the canvas. */
  presented: number;
  /** Ticks where some layer is still seeking, so the previous frame is kept. */
  held: number;
  /** Number of times media elements were re-seeked during playback: each one makes the sound drop out briefly. */
  resyncs: number;
  /** Milliseconds spent per tick on the main thread (syncing elements, sending the picture, drawing, putting it on the canvas, plus the UI updates that run synchronously when the playhead is notified). */
  tickMs: number[];
  /** Which video frame each drawn frame is (the plan's `frame`): lets you count which frames were dropped. */
  frames: number[];
  /** Milliseconds spent sending the picture for drawn frames (including reading pixels from media elements) and drawing in WASM. */
  uploadMs: number[];
  renderMs: number[];
  /** Absolute deviation, in seconds, of each media element that produces sound or picture from the plan, one per element per tick. */
  drift: number[];
  /** Pixel size used for drawing frames (most recent frame). */
  size: { width: number; height: number } | null;
}

const STATS_SAMPLES = 20_000;

function emptyStats(): PlaybackStats {
  return {
    ticks: 0,
    repeated: 0,
    presented: 0,
    held: 0,
    resyncs: 0,
    tickMs: [],
    frames: [],
    uploadMs: [],
    renderMs: [],
    drift: [],
    size: null,
  };
}

function sample(values: number[], value: number): void {
  if (values.length < STATS_SAMPLES) values.push(value);
}

/** Canvas → the engine that draws to it (for diagnostics and benchmarks: finds the engine from the preview canvas on the page). */
const enginesByCanvas = new WeakMap<HTMLCanvasElement, PreviewEngine>();

export function previewEngineOf(canvas: HTMLCanvasElement): PreviewEngine | undefined {
  return enginesByCanvas.get(canvas);
}

export interface PreviewCallbacks {
  /** The playhead has advanced (called once per frame during playback). */
  onTime(seconds: number): void;
  /** Playback reached the end and stopped on its own. */
  onEnded(): void;
}

/** During playback, re-seek only when the drift exceeds this amount; small drift is corrected by adjusting playback rate. */
const RESYNC_SECONDS = 0.25;
/** When paused, must align frame by frame. */
const EXACT_SECONDS = 1e-3;
/** Playback rate the media element can accept (the browser's playbackRate range). */
const MIN_RATE = 0.0625;
const MAX_RATE = 16;
/** While a layer is still seeking, don't draw (keep the previous frame), but wait at most this long; after that, draw anyway so it doesn't stay stuck on the old picture. */
const HOLD_PLAYING_MS = 250;
const HOLD_PAUSED_MS = 1000;
/** Hint for a waveform with `speaker` set, when there is no transcript or the transcript has no such speaker (reported by the kernel; see frame-render). */
// i18n-ignore: matches the hint text as reported by the render kernel (frame-render); update here whenever the kernel text changes
const SPEAKER_NOTE = /：(视频里没有转写，听不出说话人|转写里没有说话人) /;
/**
 * How long after the last seek while stopped, with no further seek, before it counts as stopped. In the meantime, a video still seeking uses its previous picture (without waiting for the seek to land); consecutive seeks (dragging the playhead,
 * holding a frame-step) are drawn at playback resolution. Neither is the exact frame; once stopped, it is drawn at original size.
 */
const SCRUB_SETTLE_MS = 200;

interface Target {
  seconds: number;
  rate: number;
  muted: boolean;
  volume: number;
}

type Readiness = 'ready' | 'pending' | 'absent';

export class PreviewEngine {
  readonly #elements = new Map<MediaKey, SourceElement | HTMLAudioElement>();
  readonly #callbacks: PreviewCallbacks;
  readonly #load: (options?: { fresh?: boolean }) => Promise<RenderPlanner>;
  readonly #statusListeners = new Set<(status: PreviewStatus) => void>();
  #status: PreviewStatus = { kind: 'loading' };
  #planner: RenderPlanner | null = null;
  #video: { sequence: Sequence; assets: Record<Id, AssetRecord> } | null = null;
  #videoError: string | null = null;
  #slotCounts = new Map<string, number>();
  /** For an instance that produces a video layer or carries its own sound (a video, or a composition with a pre-rendered stand-in) → the element it occupies. */
  readonly #slotOf = new Map<Id, MediaKey>();
  #plan: FramePlan | null = null;
  #captionHits: readonly CaptionHit[] = [];
  readonly #captionListeners = new Set<(hits: readonly CaptionHit[]) => void>();
  readonly #planListeners = new Set<(plan: FramePlan) => void>();
  #context: CanvasRenderingContext2D | null = null;
  #scale = 1;
  #time = 0;
  #playing = false;
  #tick = 0;
  #clockStart = 0;
  #timeStart = 0;
  #paintTimer: ReturnType<typeof setTimeout> | null = null;
  #holdSince: number | null = null;
  /** Which frame is currently on the canvas (sequence version and frame number); during playback the same frame is not redrawn. */
  #painted: { revision: string; frame: number } | null = null;
  /** During playback, something changed (document, asset, font, size, media element state): this frame must be redrawn. */
  #dirty = false;
  /** After seeking while paused, not yet settled (see `SCRUB_SETTLE_MS`); when the time comes, the timer finishes up and draws the exact frame. */
  #scrubTimer: ReturnType<typeof setTimeout> | null = null;
  /** Seeked again before settling (while dragging). */
  #dragging = false;
  /** The most recent picture read from each media element: used while dragging, while the element is still seeking (the picture arrives late, content unchanged). */
  readonly #lastPictures = new WeakMap<SourceElement, ImageData>();
  /** Whether the canvas shows a frame drawn at original size at the moment of stopping, with all media ready (the same frame as export). */
  #exact = false;
  /** Whether a frame has ever been put on the canvas with no media still incoming (not a black frame while waiting for media); after a retry or switching to another video, counting starts over. */
  #pictured = false;
  readonly #pictureListeners = new Set<(pictured: boolean) => void>();
  #disposed = false;
  readonly #documents: PreviewDocuments | null;
  readonly #assets: PreviewAssets | null;
  #documentRecords: Record<Id, DocumentRecord> = {};
  /** The document last sent to WASM (compared by body object; the body object changes when the draft changes). */
  #sentDocuments: FrozenDocument[] | null = null;
  /** The transcript last sent to WASM (compared by body object). */
  #sentSpeech: SpeechTranscript[] = [];
  /** Canvas used to read pixels from media elements. */
  #scratch: CanvasRenderingContext2D | null = null;
  #stats: PlaybackStats = emptyStats();
  /** Dev log naming the step where it is stuck (see preview-watch). */
  readonly #watch = new PreviewWatch(() => this.#snapshot());
  #unwatch: (() => void)[] | null = null;
  /** Which render-kernel attachment this is: after a retry, late results from the earlier attempt are discarded. */
  #attach = 0;
  #problems: string[] = [];
  /** Some of the transcripts needed have not been fetched yet: the waveform speaker hint is not reported yet (until fetched, the kernel treats it as no transcript). */
  #speechLoading = false;
  /** Decoder for asset spectra (analysis uses the planner's module), created the first time a spectrum is needed. */
  #spectrum: AssetDecoder<Uint8Array> | null = null;
  /** Monitoring volume (shortcuts ↑/↓, M; see model/preview-volume): multiplied onto every sound; affects only how loud this window is. */
  #monitor = { volume: 1, muted: false };
  readonly #monitorListeners = new Set<(monitor: { volume: number; muted: boolean }) => void>();
  /** Playback speed (the same value shared by the stage toolbar and the fullscreen player's speed menu): the clock and media elements are both multiplied by it; it only affects how fast this window plays. */
  #rate = 1;
  /**
   * Caption level (model/player `captionView`): one of the fullscreen player's four levels, or `off` when the stage toolbar hides captions. It temporarily disables the captions that should not show on the sequence sent for drawing,
   * and `off` also suppresses live temporary captions during transcription; `null` draws the video as it is.
   */
  #captionMode: CaptionMode | null = null;
  readonly #fonts: FontSource | null;
  readonly #preparing: PreviewPreparing | null;
  /** Font families reported missing (kept permanently: after the render kernel reloads, the same list is still used to request them). */
  readonly #fontsMissing = new Set<string>();
  /** Local-font faces already asked about (each asked only once; keyed by family name, weight and italic), and the families of faces still being fetched. */
  readonly #fontsAsked = new Set<string>();
  #fontsLoading = new Map<string, number>();
  /** Temporary captions on the picture during transcription (`setLiveCaption`), keyed by transcription Job; drawn only in the preview, not into the video. */
  readonly #liveCues = new Map<Id, readonly LiveCue[]>();
  /** The two documents of the temporary caption layer: rebuilt only when the sentences change; not re-sent if the body object is unchanged. */
  #liveDocuments: FrozenDocument[] | null = null;

  constructor(
    callbacks: PreviewCallbacks,
    load: (options?: { fresh?: boolean }) => Promise<RenderPlanner> = loadRenderPlanner,
    documents: PreviewDocuments | null = null,
    assets: PreviewAssets | null = null,
    fonts: FontSource | null = null,
    preparing: PreviewPreparing | null = null,
  ) {
    this.#callbacks = callbacks;
    this.#load = load;
    this.#documents = documents;
    this.#assets = assets;
    this.#fonts = fonts;
    this.#preparing = preparing;
    this.#watchSources();
    this.#watch.start();
    this.#attachPlanner();
  }

  /** Subtitle document bodies, or bytes of Lottie, SVG or GIF images, have arrived: redraw while stopped (during playback the next frame draws them naturally). */
  #watchSources(): void {
    this.#unwatch ??= [this.#documents, this.#assets].flatMap((source) => (source ? [source.subscribe(() => this.#requestPaint())] : []));
  }

  #attachPlanner(fresh = false): void {
    const attach = ++this.#attach;
    this.#load(fresh ? { fresh } : undefined)
      .then(
        (planner) => {
          if (this.#disposed || attach !== this.#attach) return;
          this.#planner = planner;
          // After a WASM trap the planner reloads itself; check again once it's back.
          planner.onRecovered = () => this.#refresh();
          this.#loadVideo();
          this.#refresh();
        },
        (error: Error) => {
          if (attach === this.#attach) this.#setStatus({ kind: 'error', message: E.rendererFailed(error.message) });
        },
      )
      // i18n-ignore: dev log
      .catch((error: unknown) => this.#watch.noteError('载入渲染内核之后', error));
  }

  /**
   * Can be used again after `dispose`. In React development mode (StrictMode), effects are run through an extra round of cleanup and setup on mount, while the engine is still the same one:
   * if it is not brought back, the preview stays stuck on loading.
   */
  resume(): void {
    if (!this.#disposed) return;
    this.#disposed = false;
    this.#watchSources();
    this.#watch.start();
    if (this.#planner) this.#refresh();
    else this.#attachPlanner();
  }

  onStatus(listener: (status: PreviewStatus) => void): () => void {
    this.#statusListeners.add(listener);
    listener(this.#status);
    return () => this.#statusListeners.delete(listener);
  }

  /** Source elements on the page: video by slot, images by asset, audio by instance (keys: see `videoKey` etc.). */
  register(key: MediaKey, element: SourceElement | HTMLAudioElement | null): void {
    const previous = this.#elements.get(key);
    if (previous === element) return;
    if (previous) this.#listen(previous, false);
    if (element) {
      this.#elements.set(key, element);
      this.#listen(element, true);
    } else this.#elements.delete(key);
    this.#refresh();
  }

  /** Canvas for compositing; `scale` is the ratio of canvas pixels to the sequence canvas. */
  attachCanvas(canvas: HTMLCanvasElement | null, scale = this.#scale): void {
    this.#context = canvas?.getContext('2d') ?? null;
    if (canvas) enginesByCanvas.set(canvas, this);
    this.#scale = scale;
    this.#requestPaint();
  }

  setScale(scale: number): void {
    if (scale === this.#scale || !(scale > 0)) return;
    this.#scale = scale;
    this.#requestPaint();
  }

  setVideo(sequence: Sequence, assets: Record<Id, AssetRecord>, documents: Record<Id, DocumentRecord> = {}): void {
    if (this.#video && this.#video.sequence.id !== sequence.id) this.#setPictured(false);
    this.#video = { sequence, assets };
    this.#documentRecords = documents;
    this.#slotCounts = new Map(videoSlots(sequence).map(({ asset, count }) => [`${asset.id}:${asset.revision}`, count]));
    this.#loadVideo();
    this.#refresh();
  }

  /**
   * Temporary captions on the picture during transcription (product design §5.7, `model/live-caption.ts`): one set of sentences per transcription (in sequence seconds); `null` clears them. They are overlaid on the sequence sent to the render kernel and drawn along the same path as real captions; they do not enter the video, undo history or export, and clicking on the stage cannot select them.
   */
  setLiveCaption(jobId: Id, cues: readonly LiveCue[] | null): void {
    if (cues?.length) this.#liveCues.set(jobId, cues);
    else if (!this.#liveCues.delete(jobId)) return;
    const all = [...this.#liveCues.values()].flat();
    this.#liveDocuments = all.length ? liveCaptionDocuments(liveCaptionCues(all)) : null;
    this.#dirty = true;
    this.#loadVideo();
    this.#refresh();
  }

  get playing(): boolean {
    return this.#playing;
  }

  get time(): number {
    return this.#time;
  }

  /** Whether the canvas shows the exact picture of the moment it stopped: frames drawn during playback, while dragging, while not waiting for seeks, or with media missing are not. */
  get exact(): boolean {
    return this.#exact;
  }

  /**
   * Whether this video's picture has come out at all: whether a frame has ever been put on the canvas with no media still incoming (frames with no media count too; media that failed to load does not count as incoming).
   * Until it comes out the stage is covered by the loading panel (product design §5.1 “preview loading and stalls”), so the black frames shown while waiting for media are not exposed; counting starts over after a retry or switching to another video.
   */
  get pictured(): boolean {
    return this.#pictured;
  }

  /** Notifies when `pictured` changes; gives the current value once on subscribe. */
  onPicture(listener: (pictured: boolean) => void): () => void {
    this.#pictureListeners.add(listener);
    listener(this.#pictured);
    return () => this.#pictureListeners.delete(listener);
  }

  get monitor(): { volume: number; muted: boolean } {
    return this.#monitor;
  }

  /** Change the monitoring volume: while stopped, elements are paused and it takes effect the next time elements are set; during playback it takes effect on the next frame. Not part of the video; does not affect export. */
  setMonitor(monitor: { volume: number; muted: boolean }): void {
    this.#monitor = { volume: Math.max(0, Math.min(1, monitor.volume)), muted: monitor.muted };
    for (const listener of this.#monitorListeners) listener(this.#monitor);
  }

  /** Notifies when the monitoring volume changes (the fullscreen player's volume button and slider); gives the current value once on subscribe. */
  onMonitor(listener: (monitor: { volume: number; muted: boolean }) => void): () => void {
    this.#monitorListeners.add(listener);
    listener(this.#monitor);
    return () => this.#monitorListeners.delete(listener);
  }

  get rate(): number {
    return this.#rate;
  }

  /** Change playback speed: during playback, it runs at the new speed from this moment (the clock restarts counting at this moment), and media elements catch up on the next frame. Not part of the video; does not affect export. */
  setRate(rate: number): void {
    const next = Math.max(MIN_RATE, Math.min(MAX_RATE, rate));
    if (!(next > 0) || next === this.#rate) return;
    if (this.#playing) {
      const now = performance.now();
      this.#timeStart += ((now - this.#clockStart) / 1000) * this.#rate;
      this.#clockStart = now;
    }
    this.#rate = next;
    if (this.#playing) this.#sync();
  }

  /** Caption level (the fullscreen four levels, or `off` for stage-hidden captions): disables the captions that should not show for the level, then hands over to the render kernel; `null` returns to the video as it is. Not part of the video; not in undo; does not affect export. */
  setCaptionView(mode: CaptionMode | null): void {
    if (mode === this.#captionMode) return;
    this.#captionMode = mode;
    this.#dirty = true;
    this.#loadVideo();
    this.#refresh();
  }

  /**
   * These families have just been downloaded (via “Download” in the font bar, on retry, or downloaded during export): faces that were asked for but not fetched are forgotten, and requested again on the next redraw.
   * The preview asks once per face; without this, families reported missing earlier would only be swapped in after the video is reopened.
   */
  retryFonts(families: readonly string[]): void {
    const names = new Set(families.map((f) => f.trim().toLowerCase()));
    let changed = false;
    for (const key of [...this.#fontsAsked]) {
      const family = key.split('\u0000')[0]!;
      if (names.has(family.trim().toLowerCase()) && !this.#fontsLoading.has(family)) {
        this.#fontsAsked.delete(key);
        changed = true;
      }
    }
    if (changed && !this.#disposed) this.#requestPaint();
  }

  /** Counters for the most recent playback (see `PlaybackStats`). */
  get stats(): PlaybackStats {
    return this.#stats;
  }

  /** Diagnosis of the most recent stall (see `StallReport`); null if there has never been a stall. */
  get stallReport(): StallReport | null {
    return this.#watch.report;
  }

  /** The stall still in progress (the stall hint on the stage, product design §5.1 “preview loading and stalls”); null if not stalled. */
  get stall(): StallReport | null {
    return this.#watch.ongoing;
  }

  /** Notifies when a stall is reported and when it ends (same arguments as `stall`); gives the current value once on subscribe. */
  onStall(listener: (stall: StallReport | null) => void): () => void {
    const off = this.#watch.onChange(listener);
    listener(this.#watch.ongoing);
    return off;
  }

  /**
   * “Retry”: only reloads the preview and leaves the video alone. If the render kernel has not finished loading, it does not wait for the one recorded earlier and reloads (one that is already loaded is reused); once it is ready, the video
   * is handed to it again. Documents, asset bytes and local fonts still in flight are forgotten and requested again, and the stall diagnosis starts timing from scratch. Media addresses and source elements are re-requested and re-attached by the UI
   * (`preview.tsx`).
   */
  retry(): void {
    if (this.#disposed) return;
    this.#watch.reset();
    this.#setPictured(false);
    this.#documents?.forgetPending?.();
    this.#assets?.forgetPending?.();
    this.#sentDocuments = null;
    this.#sentSpeech = [];
    // Fonts still being fetched: forget what was asked; on the next frame, request the missing ones again (late results are still injected, they just no longer count as “still fetching”).
    for (const key of [...this.#fontsAsked]) if (this.#fontsLoading.has(key.split('\u0000')[0]!)) this.#fontsAsked.delete(key);
    this.#fontsLoading = new Map();
    this.#dirty = true;
    if (!this.#planner) {
      this.#setStatus({ kind: 'loading' });
      this.#attachPlanner(true);
      return;
    }
    this.#loadVideo();
    this.#refresh();
  }

  /** The frame plan at this moment (stage selection uses its layer geometry); when the planner is not ready or has errored, it is the previous plan or null. */
  get plan(): FramePlan | null {
    return this.#plan;
  }

  get captionHits(): readonly CaptionHit[] {
    return this.#captionHits;
  }

  onCaptionHits(listener: (hits: readonly CaptionHit[]) => void): () => void {
    this.#captionListeners.add(listener);
    listener(this.#captionHits);
    return () => this.#captionListeners.delete(listener);
  }

  #setCaptionHits(hits: readonly CaptionHit[]): void {
    const previous = this.#captionHits;
    if (
      previous.length === hits.length && previous.every((hit, i) => {
        const next = hits[i]!;
        return hit.layerId === next.layerId && hit.itemId === next.itemId && hit.documentId === next.documentId && hit.cueId === next.cueId
          && hit.cx === next.cx && hit.cy === next.cy && hit.w === next.w && hit.h === next.h && hit.rotation === next.rotation;
      })
    ) return;
    this.#captionHits = hits;
    for (const listener of this.#captionListeners) listener(hits);
  }

  /** Notifies each time a new plan is computed (once per frame during playback; listeners deduplicate on their own); on subscribe, gives the existing plan once if there is one. */
  onPlan(listener: (plan: FramePlan) => void): () => void {
    this.#planListeners.add(listener);
    if (this.#plan) listener(this.#plan);
    return () => this.#planListeners.delete(listener);
  }

  /** Seek (driven by the playhead when paused; dragging the playhead during playback also goes through here). */
  seek(seconds: number): void {
    this.#time = Math.max(0, seconds);
    if (this.#playing) {
      this.#clockStart = performance.now();
      this.#timeStart = this.#time;
    } else {
      // Seeking while stopped: don't wait for the seek to land; draw the exact frame only after seeking has been quiet for a while (if it is already that frame, don't draw again).
      const dragging = this.#scrubTimer !== null;
      this.#endScrub();
      this.#dragging = dragging;
      this.#scrubTimer = setTimeout(() => {
        this.#endScrub();
        if (!this.#exact) this.#requestPaint();
      }, SCRUB_SETTLE_MS);
    }
    this.#exact = false;
    this.#refresh();
  }

  play(): void {
    if (this.#playing || !this.#video) return;
    const end = durationSeconds(this.#video.sequence);
    if (end <= 0) return;
    if (this.#time >= end - 1e-3) this.#time = 0;
    this.#playing = true;
    this.#clockStart = performance.now();
    this.#timeStart = this.#time;
    this.#cancelPaint();
    this.#endScrub();
    this.#exact = false;
    this.#stats = emptyStats();
    const step = () => {
      if (!this.#playing || !this.#video) return;
      const started = performance.now();
      const now = this.#timeStart + ((performance.now() - this.#clockStart) / 1000) * this.#rate;
      const limit = durationSeconds(this.#video.sequence);
      if (now >= limit) {
        this.#time = limit;
        this.pause();
        this.#callbacks.onTime(limit);
        this.#callbacks.onEnded();
        return;
      }
      this.#time = now;
      this.#sync();
      const plan = this.#plan;
      const painted = this.#painted;
      // The video frame hasn't changed and nothing else has either: the canvas already shows this frame (when the display refresh rate is higher than the video frame rate, each frame is drawn only once).
      if (!this.#dirty && plan && painted && plan.frame === painted.frame && plan.sequenceRevision === painted.revision)
        this.#stats.repeated++;
      else if (!this.#paint()) this.#stats.held++;
      this.#callbacks.onTime(now);
      this.#stats.ticks++;
      sample(this.#stats.tickMs, performance.now() - started);
      this.#tick = requestAnimationFrame(tick);
    };
    // An unexpected error was thrown during this frame (not a PlanFailure): log it, then schedule the next frame, so playback doesn't stop on a black screen.
    const tick = () => {
      try {
        step();
      } catch (error) {
        this.#watch.noteError('播放', error); // i18n-ignore: dev log
        if (this.#playing) this.#tick = requestAnimationFrame(tick);
      }
    };
    this.#sync();
    this.#tick = requestAnimationFrame(tick);
  }

  pause(): void {
    this.#playing = false;
    cancelAnimationFrame(this.#tick);
    for (const element of this.#elements.values()) if (!(element instanceof HTMLImageElement)) element.pause();
    // After stopping, align frame by frame and draw the paused frame.
    this.#refresh();
  }

  dispose(): void {
    this.#disposed = true;
    this.#watch.stop();
    this.pause();
    this.#cancelPaint();
    this.#endScrub();
    for (const unwatch of this.#unwatch ?? []) unwatch();
    this.#unwatch = null;
    for (const element of this.#elements.values()) this.#listen(element, false);
    this.#elements.clear();
    this.#statusListeners.clear();
    this.#pictureListeners.clear();
    this.#monitorListeners.clear();
  }

  #setStatus(status: PreviewStatus): void {
    if (JSON.stringify(status) === JSON.stringify(this.#status)) return;
    this.#status = status;
    for (const listener of this.#statusListeners) listener(status);
  }

  #setPictured(pictured: boolean): void {
    if (pictured === this.#pictured) return;
    this.#pictured = pictured;
    for (const listener of this.#pictureListeners) listener(pictured);
  }

  #loadVideo(): void {
    if (!this.#planner || !this.#video) return;
    // The caption level first disables captions that should not show; temporary captions during transcription do not distinguish source from translation, and are only suppressed when `off`.
    const video = this.#captionMode
      ? { ...this.#video, sequence: captionView(this.#video.sequence, this.#documentRecords, this.#captionMode) }
      : this.#video;
    try {
      // Temporary captions during transcription are overlaid as one layer; if the kernel does not accept this layer (should not happen), it is dropped and the rest is sent as is, so it doesn't take down the whole preview.
      if (this.#liveDocuments && this.#captionMode !== 'off') {
        try {
          this.#planner.setVideo({ ...video, sequence: withLiveCaption(video.sequence) });
          this.#videoError = null;
          return;
        } catch (error) {
          if (!(error instanceof PlanFailure)) throw error;
          this.#liveCues.clear();
          this.#liveDocuments = null;
        }
      }
      this.#planner.setVideo(video);
      this.#videoError = null;
    } catch (error) {
      if (!(error instanceof PlanFailure)) throw error;
      this.#videoError = error.message;
    }
  }

  /** Re-syncs the elements to the current time once and schedules a redraw. */
  #refresh(): void {
    if (this.#disposed) return;
    this.#sync();
    this.#requestPaint();
  }

  /** Asks the planner for the plan at this moment and makes the media elements match it. */
  #sync(): void {
    const planner = this.#planner;
    if (!planner || !this.#video) return;
    if (this.#videoError) {
      this.#setStatus({ kind: 'error', message: this.#videoError });
      return;
    }
    let plan: FramePlan;
    try {
      this.#sendSpeech(planner);
      plan = planner.planAt(this.#time);
    } catch (error) {
      if (!(error instanceof PlanFailure)) throw error;
      this.#setStatus({ kind: 'error', message: error.message });
      return;
    }
    this.#setStatus(this.#ready());
    if (this.#plan?.sequenceId !== plan.sequenceId || this.#plan?.sequenceRevision !== plan.sequenceRevision || this.#plan?.frame !== plan.frame)
      this.#setCaptionHits([]);
    this.#plan = plan;
    for (const listener of this.#planListeners) listener(plan);

    // Video layers and their own sound (when the track is hidden, only the sound): video instances, or compositions with a pre-rendered stand-in. The asset is the one carried in the plan.
    // The layer on the other side of a transition (outside its own range, taking the picture from handles) also needs an element, muted.
    const videos = new Map<Id, { asset: VersionRef; target: Target }>();
    for (const layer of drawnLayers(plan)) {
      if (layer.kind !== 'video') continue;
      const target = { seconds: layer.sourceSeconds ?? 0, rate: layer.sourceRate ?? 1, muted: true, volume: 1 };
      videos.set(layer.itemId, { asset: layer.asset, target });
    }
    const wanted = new Map<MediaKey, Target>();
    for (const voice of plan.voices) {
      const target = { seconds: voice.sourceSeconds, rate: voice.sourceRate, muted: false, volume: dbToVolume(voice.gainDb) };
      if (voice.source === 'audio') wanted.set(audioKey(voice.itemId), target);
      else videos.set(voice.itemId, { asset: voice.asset, target });
    }
    this.#assignSlots(videos);
    for (const [itemId, { target }] of videos) {
      const key = this.#slotOf.get(itemId);
      if (key) wanted.set(key, target);
    }

    for (const [key, element] of this.#elements) {
      if (element instanceof HTMLImageElement) continue;
      const target = wanted.get(key);
      if (target) this.#drive(element, target);
      else if (!element.paused) element.pause();
    }
  }

  /** Assigns elements to the instances producing video at this moment: those still on screen stay in their original slot, and newcomers take the empty slot closest to the target time (so there is one less seek). */
  #assignSlots(videos: Map<Id, { asset: VersionRef; target: Target }>): void {
    const slotCount = (asset: VersionRef) => this.#slotCounts.get(`${asset.id}:${asset.revision}`) ?? 1;
    const used = new Set<MediaKey>();
    for (const [itemId, key] of this.#slotOf) {
      const video = videos.get(itemId);
      // If the asset version changed, or editing has reduced the number of slots, the original slots no longer count.
      const valid = video && Array.from({ length: slotCount(video.asset) }, (_, slot) => videoKey(video.asset, slot)).includes(key);
      if (valid) used.add(key);
      else this.#slotOf.delete(itemId);
    }
    for (const [itemId, { asset, target }] of videos) {
      if (this.#slotOf.has(itemId)) continue;
      const count = slotCount(asset);
      let best: MediaKey | null = null;
      let bestDistance = Infinity;
      for (let slot = 0; slot < count; slot++) {
        const key = videoKey(asset, slot);
        if (used.has(key)) continue;
        const element = this.#elements.get(key);
        const distance = element instanceof HTMLMediaElement ? Math.abs(element.currentTime - target.seconds) : Infinity;
        if (best === null || distance < bestDistance) {
          best = key;
          bestDistance = distance;
        }
      }
      if (best === null) continue;
      used.add(best);
      this.#slotOf.set(itemId, best);
    }
  }

  #drive(element: HTMLMediaElement, target: Target): void {
    element.muted = target.muted || this.#monitor.muted;
    element.volume = target.volume * this.#monitor.volume;
    // Seeking is only possible once metadata has arrived (come back on loadedmetadata); don't change currentTime before a seek lands, or seeked will never fire.
    if (element.readyState < HTMLMediaElement.HAVE_METADATA || element.seeking) return;
    const playing = this.#playing && target.rate > 0;
    const seconds = clampToMedia(element, target.seconds);
    const drift = element.currentTime - seconds;
    if (playing) sample(this.#stats.drift, Math.abs(drift));
    if (Math.abs(drift) > (playing ? RESYNC_SECONDS : EXACT_SECONDS)) {
      if (!element.paused && !playing) element.pause();
      if (playing) this.#stats.resyncs++;
      element.currentTime = seconds;
      return;
    }
    if (!playing) {
      if (!element.paused) element.pause();
      return;
    }
    // If the drift is small, catch up by adjusting speed (slow down if ahead), without seeking again.
    const correction = Math.abs(drift) > 0.02 ? Math.max(-0.5, Math.min(0.5, -drift * 2)) : 0;
    element.playbackRate = Math.max(MIN_RATE, Math.min(MAX_RATE, target.rate * this.#rate * (1 + correction)));
    if (element.paused) void element.play().catch(() => {});
  }

  #sourceOf(layer: MediaLayer): SourceElement | null {
    const key = layer.kind === 'video' ? this.#slotOf.get(layer.itemId) : imageKey(layer.asset);
    const element = key ? this.#elements.get(key) : undefined;
    return element instanceof HTMLVideoElement || element instanceof HTMLImageElement ? element : null;
  }

  /**
   * Whether a layer can be drawn now: `pending` means still loading or seeking (the picture will come, so keep the previous frame for now); `absent` means there is no element or loading failed,
   * and it is not waited on. While seeking, readyState drops to HAVE_METADATA; that also counts as `pending`, otherwise every jump would flash an empty frame first.
   */
  #readiness(layer: MediaLayer): Readiness {
    if (this.#kernelDecoded(layer)) {
      // SVG images are rasterized in WASM at the longer edge of the output (sticker recoloring is also done there), and GIFs are decoded in WASM into animation frames picked by time: what is waited on is the asset bytes, not the image element.
      const state = this.#assets?.get(layer.asset, BYTES);
      return state?.state === 'ready' ? 'ready' : state?.state === 'loading' ? 'pending' : 'absent';
    }
    const element = this.#sourceOf(layer);
    if (!element) return 'absent';
    if (element instanceof HTMLImageElement) {
      if (!element.complete) return 'pending';
      return element.naturalWidth > 0 ? 'ready' : 'absent';
    }
    if (element.error) return 'absent';
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.seeking) return 'pending';
    const seconds = clampToMedia(element, layer.sourceSeconds ?? 0);
    const tolerance = this.#playing && (layer.sourceRate ?? 1) > 0 ? RESYNC_SECONDS : EXACT_SECONDS;
    return Math.abs(element.currentTime - seconds) <= tolerance ? 'ready' : 'pending';
  }

  /**
   * Draws the current plan. If a layer is still seeking, keep the previous frame for now, and draw anyway once waiting is too long (returns false if nothing was drawn this time). The picture is drawn in WASM at canvas pixels (sequence canvas size times
   * `scale`), and the whole frame is put on the canvas; things that cannot be drawn (skipped layers, effects, transitions done as hard cuts) are reported along with the kernel's hints,
   * and documents and assets still being fetched do not count.
   */
  #paint(): boolean {
    const plan = this.#plan;
    const context = this.#context;
    const planner = this.#planner;
    if (!plan || !context || !planner) return true;
    const layers = drawnLayers(plan);
    const states = new Map(layers.filter(isMediaLayer).map((layer) => [layer.itemId, this.#readiness(layer)]));
    const scrubbing = !this.#playing && this.#scrubTimer !== null;
    // Layers still seeking during a drag: if the element has already read a picture, use that one and don't wait.
    const stale = new Map<Id, ImageData>();
    for (const layer of scrubbing ? layers.filter(isMediaLayer) : []) {
      const element = states.get(layer.itemId) === 'pending' && !this.#kernelDecoded(layer) ? this.#sourceOf(layer) : null;
      const picture = element ? this.#lastPictures.get(element) : undefined;
      if (picture) stale.set(layer.itemId, picture);
    }
    const waiting = [...states].some(([itemId, state]) => state === 'pending' && !stale.has(itemId));
    if (waiting) {
      const now = performance.now();
      this.#holdSince ??= now;
      if (now - this.#holdSince < (this.#playing ? HOLD_PLAYING_MS : HOLD_PAUSED_MS)) return false;
    }
    this.#holdSince = null;
    this.#dirty = false;
    // Draw at reduced resolution during playback, while dragging, and when using an old picture (content unchanged); when stopped, draw at original size, the same frame as export.
    const quality = this.#playing || (scrubbing && (this.#dragging || stale.size > 0)) ? 'playback' : 'exact';
    const { width, height } = paintSize(plan.canvas, this.#scale, quality);
    const pending = new Set<Id>();
    const notes: string[] = [];
    let rendered: RenderedFrame;
    try {
      this.#sendDocuments(planner, layers, pending);
      // When paused, if the transcript arrives it only triggers a redraw and does not re-sync elements: it is sent here, so this frame draws the waveform from the transcript.
      if (this.#speechLoading) this.#sendSpeech(planner);
      this.#sendAssets(planner, layers, pending);
      const start = performance.now();
      this.#sendPictures(planner, layers, states, stale, width, height);
      const uploaded = performance.now();
      rendered = planner.render(this.#time, width, height);
      if (this.#playing) {
        sample(this.#stats.uploadMs, uploaded - start);
        sample(this.#stats.renderMs, performance.now() - uploaded);
      }
      // This frame's waveform still shows placeholder shape: once the spectrum arrives, send it in and draw again (during playback the next frame draws it naturally).
      if (this.#sendSpectra(planner, rendered.spectra, pending, notes)) this.#requestPaint();
      this.#requestFonts(planner, rendered);
    } catch (error) {
      if (!(error instanceof PlanFailure)) throw error;
      this.#setStatus({ kind: 'error', message: error.message });
      return true;
    }
    const { canvas } = context;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.putImageData(new ImageData(planner.frame(), width, height), 0, 0);
    // Temporary captions are not instances in the video: they are not selectable; the kernel's hints about them (skipped, warnings) are not reported, same as for layers still being fetched (recorded in `pending`).
    this.#setCaptionHits((rendered.captionHits ?? []).filter((hit) => hit.itemId !== LIVE_CAPTION_ITEM_ID));
    pending.add(LIVE_CAPTION_ITEM_ID);
    this.#painted = { revision: plan.sequenceRevision, frame: plan.frame };
    this.#exact = quality === 'exact' && [...states.values()].every((state) => state === 'ready');
    // The picture has come out: no media is still incoming. Elements that failed to load and asset bytes that cannot be fetched are no longer waited on (the frame is drawn anyway, skipping them); only elements not yet created are still incoming.
    const coming = layers.filter(isMediaLayer).some((layer) => {
      const state = states.get(layer.itemId);
      return state === 'pending' || (state === 'absent' && !this.#kernelDecoded(layer) && this.#sourceOf(layer) === null);
    });
    if (!coming) this.#setPictured(true);
    if (this.#playing) {
      this.#stats.presented++;
      sample(this.#stats.frames, plan.frame);
    }
    this.#stats.size = { width, height };
    // Families whose local fonts are still being fetched do not report missing fonts (if they can't be fetched, the next frame reports them, consistent with export).
    // i18n-ignore: matches the missing-font hint text as reported by the render kernel
    const loadingFonts = [...this.#fontsLoading.keys()].map((family) => `字体 ${JSON.stringify(family)} `);
    const problems = [
      ...new Set([
        ...rendered.skipped.filter((item) => !pending.has(item.itemId)).map((item) => item.message),
        // The kernel's hints begin with “instance ID:”; waveforms whose spectrum is still being fetched are not reported.
        ...rendered.warnings
          .filter((warning) => !pending.has(warning.detail.split('：')[0]!)) // i18n-ignore: the “instance ID:” separator in kernel hints
          .filter((warning) => !loadingFonts.some((prefix) => warning.detail.includes(prefix)))
          // Transcript still being fetched: don't say there is no transcript yet.
          .filter((warning) => !(this.#speechLoading && SPEAKER_NOTE.test(warning.detail)))
          .map((warning) => warning.detail),
        ...notes,
      ]),
    ];
    if (problems.join('\n') !== this.#problems.join('\n')) {
      this.#problems = problems;
      if (this.#status.kind === 'ready') this.#setStatus(this.#ready());
    }
    return true;
  }

  /**
   * Local fonts (architecture design §9.1): among the missing families, the faces (family name, weight, italic) that typesetting named are requested from the host (using the same resolution and extraction as the frozen export, fetching only that one face); once they arrive they are injected into the planner and drawn again. Each face is requested only once; if they can't be fetched, it is drawn with the fallback font, and the missing-font hint is still reported.
   */
  #requestFonts(planner: RenderPlanner, rendered: RenderedFrame): void {
    for (const family of rendered.fonts ?? []) this.#fontsMissing.add(family);
    const source = this.#fonts;
    const fresh = (rendered.faces ?? []).filter((face) => {
      const family = face.family.trim();
      return family.length > 0 && family.length <= 200 && this.#fontsMissing.has(face.family) && !this.#fontsAsked.has(fontKey(face));
    });
    if (!source || fresh.length === 0) return;
    // Recorded on this moment's table: after a retry swaps in a new table, late results from this batch do not touch the new table's counts.
    const counts = this.#fontsLoading;
    const loading = (face: FontFaceQuery, step: number) => {
      const count = (counts.get(face.family) ?? 0) + step;
      if (count > 0) counts.set(face.family, count);
      else counts.delete(face.family);
    };
    for (const face of fresh) {
      this.#fontsAsked.add(fontKey(face));
      loading(face, 1);
    }
    const inject = (faces: LoadedFace[]) => {
      if (this.#disposed) return;
      for (const { font, bytes } of faces) planner.addLocalFont(font, bytes);
    };
    source
      // Within a batch, those that arrive first (local, already downloaded) are injected and redrawn first, without waiting for ones still downloading.
      .load(
        fresh.map((face) => ({ ...face, family: face.family.trim() })),
        (faces) => {
          inject(faces);
          if (!this.#disposed) this.#requestPaint();
        },
      )
      .then(inject)
      // Not fetchable (or the planner is reloading): draw with the fallback font.
      .catch(() => {})
      .finally(() => {
        for (const face of fresh) loading(face, -1);
        if (!this.#disposed) this.#requestPaint();
      });
  }

  /**
   * Documents a caption layer reads (the subtitle document and style document): fetched ones pass their body, and ones not yet fetched are requested first and pass `null`; layers that use them are recorded in `pending`.
   * If the body object is unchanged, it is not re-sent.
   */
  #sendDocuments(planner: RenderPlanner, layers: VisualLayer[], pending: Set<Id>): void {
    const wanted = new Map<Id, Id[]>();
    for (const layer of layers) {
      if (layer.kind !== 'caption') continue;
      for (const id of [layer.content.documentId, layer.content.styleDocumentId]) {
        if (id) wanted.set(id, [...(wanted.get(id) ?? []), layer.itemId]);
      }
    }
    const documents: FrozenDocument[] = [];
    for (const [documentId, itemIds] of wanted) {
      // The temporary caption layer's document lives in the UI and is not fetched from the Runtime.
      const live = this.#liveDocuments?.find((document) => document.documentId === documentId);
      if (live) {
        documents.push(live);
        continue;
      }
      const record = this.#documentRecords[documentId];
      let body: unknown = null;
      if (record && this.#documents) {
        body = this.#documents.peek(documentId, record.currentRevision);
        if (body === undefined) {
          this.#documents.load(documentId, record.currentRevision);
          for (const itemId of itemIds) pending.add(itemId);
          body = null;
        }
      }
      const parent = record?.sourceDocumentId ? this.#documentRecords[record.sourceDocumentId] : undefined;
      const schema = isRecord(body) && typeof body.schema === 'string' ? body.schema : undefined;
      documents.push({
        documentId,
        ...(record ? { kind: record.kind } : {}),
        ...(schema ? { schema } : {}),
        lineKind: parent?.kind === 'translation' ? 'translation' : 'original',
        ...(record?.sourceDocumentId ? { sourceDocumentId: record.sourceDocumentId } : {}),
        ...(record?.sourceAssetId ? { sourceAssetId: record.sourceAssetId } : {}),
        body,
      });
    }
    const sent = this.#sentDocuments;
    const same =
      sent?.length === documents.length &&
      documents.every((document, index) => {
        const previous = sent[index]!;
        return (
          previous.documentId === document.documentId &&
          previous.body === document.body &&
          previous.lineKind === document.lineKind &&
          previous.sourceDocumentId === document.sourceDocumentId &&
          previous.sourceAssetId === document.sourceAssetId
        );
      });
    if (same) return;
    planner.setDocuments(documents);
    this.#sentDocuments = documents;
  }

  /**
   * Transcripts: the script-triggered ducking and the waveforms with `speaker` set need every transcript in the video; WASM projects them into a valid word stream (giving waveforms per-speaker segments);
   * captions need the transcript their caption document is derived from (word-by-word animation and emphasis advance by the words in the transcript). All of these match export. Those already fetched are sent in; those not yet fetched are
   * requested first, and sent the next time elements are synced after they arrive. If the body object is unchanged, it is not re-sent.
   */
  #sendSpeech(planner: RenderPlanner): void {
    const sequence = this.#video?.sequence;
    const all =
      (sequence?.ducking?.some((rule) => rule.enabled && rule.trigger.kind === 'speech') ?? false) ||
      (sequence?.items.some((item) => item.type === 'visualizer' && !!item.visualizer.speaker) ?? false);
    const forCaptions = new Set<Id>();
    for (const item of sequence?.items ?? []) {
      if (item.type !== 'caption' || !item.enabled) continue;
      const parent = this.#documentRecords[item.documentId]?.sourceDocumentId;
      if (parent && this.#documentRecords[parent]?.kind === 'speech') forCaptions.add(parent);
    }
    const transcripts: SpeechTranscript[] = [];
    let loading = false;
    if ((all || forCaptions.size > 0) && this.#documents) {
      for (const record of Object.values(this.#documentRecords)) {
        if (record.kind !== 'speech' || (!all && !forCaptions.has(record.id))) continue;
        const body = this.#documents.peek(record.id, record.currentRevision);
        if (body === undefined) {
          this.#documents.load(record.id, record.currentRevision);
          loading = true;
          continue;
        }
        transcripts.push({ documentId: record.id, ...(record.sourceAssetId ? { sourceAssetId: record.sourceAssetId } : {}), body });
      }
    }
    this.#speechLoading = loading;
    const sent = this.#sentSpeech;
    const same =
      sent.length === transcripts.length &&
      transcripts.every((transcript, index) => {
        const previous = sent[index]!;
        return (
          previous.documentId === transcript.documentId &&
          previous.sourceAssetId === transcript.sourceAssetId &&
          previous.body === transcript.body
        );
      });
    if (same) return;
    planner.setSpeech(transcripts);
    this.#sentSpeech = transcripts;
  }

  /** Asset bytes for Lottie layers and SVG and GIF image layers: fetched bytes are passed in (each copy is sent only once); layers still being fetched are recorded in `pending`. */
  #sendAssets(planner: RenderPlanner, layers: VisualLayer[], pending: Set<Id>): void {
    for (const layer of layers) {
      let asset: unknown;
      if (layer.kind === 'generator' && layer.content.generator === 'cuccut.lottie') asset = layer.content.parameters.asset;
      else if (isMediaLayer(layer) && this.#kernelDecoded(layer)) asset = layer.asset;
      else continue;
      if (!isVersionRef(asset) || !this.#assets) continue;
      const state = this.#assets.get(asset, BYTES);
      if (state.state === 'ready') planner.setAsset(asset, state.value);
      else if (state.state === 'loading') pending.add(layer.itemId);
    }
  }

  /**
   * Asset spectra needed by waveforms (those the planner reports missing): fetched ones are passed in (returns true, so a redraw is needed); instances still being computed are recorded in `pending`.
   * Assets too large are not analyzed in preview, and a single hint is added to `notes`; sounds that cannot be decoded are reported by the kernel's hints.
   */
  #sendSpectra(planner: RenderPlanner, missing: readonly MissingSpectrum[], pending: Set<Id>, notes: string[]): boolean {
    if (!this.#assets) return false;
    let sent = false;
    for (const { itemId, asset } of missing) {
      const size = this.#video?.assets[asset.id]?.revisions[asset.revision]?.byteLength ?? 0;
      if (size > SPECTRUM_MAX_BYTES) {
        notes.push(E.spectrumTooLarge(itemId, asset.id, SPECTRUM_MAX_BYTES / 1024 / 1024));
        continue;
      }
      this.#spectrum ??= spectrumDecoder(planner);
      const state = this.#assets.get(asset, this.#spectrum);
      if (state.state === 'ready') sent = planner.setAudioSpectrum(asset, state.value) || sent;
      else if (state.state === 'loading') pending.add(itemId);
    }
    return sent;
  }

  /**
   * The picture of a media layer at this moment: pixels are read from the media element and passed in (each element is read only once per frame; the same image can serve several instances). The picture read
   * is no larger than the output (scaled down to fill the output); the source region is cut proportionally in WASM, so a picture read at a different size still works. `stale` marks a layer that, while dragging, uses the element's previous picture.
   * Layers with no picture are not sent, and WASM skips them.
   */
  #sendPictures(
    planner: RenderPlanner,
    layers: VisualLayer[],
    states: Map<Id, Readiness>,
    stale: Map<Id, ImageData>,
    width: number,
    height: number,
  ): void {
    planner.clearPictures();
    const read = new Map<SourceElement, ImageData | null>();
    for (const layer of layers) {
      if (!isMediaLayer(layer) || this.#kernelDecoded(layer)) continue;
      let pixels = stale.get(layer.itemId) ?? null;
      const element = states.get(layer.itemId) === 'ready' ? this.#sourceOf(layer) : null;
      if (element) {
        if (!read.has(element)) {
          const picture = this.#readPixels(element, width, height);
          if (picture) this.#lastPictures.set(element, picture);
          read.set(element, picture);
        }
        pixels = read.get(element) ?? null;
      }
      if (pixels) planner.setPicture(layer.itemId, pixels.data, pixels.width, pixels.height);
    }
  }

  /** The asset of an image layer is SVG or GIF (by the asset version's media type): the picture is rasterized or decoded by WASM from the bytes (same as export), and the image element's pixels are not read. */
  #kernelDecoded(layer: MediaLayer): boolean {
    if (layer.kind !== 'image') return false;
    const mediaType = this.#video?.assets[layer.asset.id]?.revisions[layer.asset.revision]?.mediaType;
    return mediaType === 'image/svg+xml' || mediaType === 'image/gif';
  }

  #readPixels(element: SourceElement, width: number, height: number): ImageData | null {
    const [sourceWidth, sourceHeight] =
      element instanceof HTMLVideoElement ? [element.videoWidth, element.videoHeight] : [element.naturalWidth, element.naturalHeight];
    if (!(sourceWidth > 0 && sourceHeight > 0)) return null;
    const fit = Math.min(1, Math.max(width / sourceWidth, height / sourceHeight));
    const w = Math.max(1, Math.round(sourceWidth * fit));
    const h = Math.max(1, Math.round(sourceHeight * fit));
    this.#scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const scratch = this.#scratch;
    if (!scratch) return null;
    if (scratch.canvas.width !== w || scratch.canvas.height !== h) {
      scratch.canvas.width = w;
      scratch.canvas.height = h;
    }
    scratch.clearRect(0, 0, w, h);
    scratch.drawImage(element, 0, 0, w, h);
    return scratch.getImageData(0, 0, w, h);
  }

  #ready(): PreviewStatus {
    return this.#problems.length > 0 ? { kind: 'ready', problems: this.#problems } : { kind: 'ready' };
  }

  /** State of the media element; when there is no element yet because the Runtime is preparing a compatible copy, it says it is waiting for the copy and includes progress. */
  #probe(element: Parameters<typeof probeElement>[0], asset: VersionRef): Pick<MediaProbe, 'wait' | 'element' | 'progress'> {
    const probe = probeElement(element);
    const progress = probe.wait === 'no-element' ? this.#preparing?.(asset) : undefined;
    return progress === undefined ? probe : { ...probe, wait: 'preparing', progress };
  }

  /** Snapshot for stall diagnostics: which step it is stuck at, which media layers and sounds are not ready, and which documents and fonts are still being fetched. */
  #snapshot(): PreviewSnapshot {
    const plan = this.#plan;
    const painted = this.#painted;
    const media: MediaProbe[] = [];
    const documents = new Set<Id>();
    if (plan) {
      for (const layer of drawnLayers(plan)) {
        if (layer.kind === 'caption') {
          for (const id of [layer.content.documentId, layer.content.styleDocumentId]) {
            const record = id ? this.#documentRecords[id] : undefined;
            if (id && record && this.#documents?.peek(id, record.currentRevision) === undefined) documents.add(id);
          }
        }
        if (!isMediaLayer(layer) || this.#readiness(layer) === 'ready') continue;
        const wantedSeconds = layer.kind === 'video' ? (layer.sourceSeconds ?? 0) : null;
        if (this.#kernelDecoded(layer)) {
          const state = this.#assets?.get(layer.asset, BYTES).state;
          media.push({
            itemId: layer.itemId,
            assetId: layer.asset.id,
            kind: layer.kind,
            wait: state === 'loading' ? 'bytes-loading' : 'bytes-missing',
            wantedSeconds,
            element: null,
          });
        } else media.push({ itemId: layer.itemId, assetId: layer.asset.id, kind: layer.kind, wantedSeconds, ...this.#probe(this.#sourceOf(layer), layer.asset) });
      }
      // Sound-only (audio instances, or video with its track hidden): without data for this moment the element has no sound.
      for (const voice of plan.voices) {
        if (media.some((probe) => probe.itemId === voice.itemId)) continue;
        const key = voice.source === 'audio' ? audioKey(voice.itemId) : this.#slotOf.get(voice.itemId);
        const probe = this.#probe(key ? (this.#elements.get(key) as HTMLMediaElement | undefined) : null, voice.asset);
        if (probe.wait === 'position') continue;
        media.push({
          itemId: voice.itemId,
          assetId: voice.asset.id,
          kind: voice.source === 'audio' ? 'audio' : 'video',
          wantedSeconds: voice.sourceSeconds,
          ...probe,
        });
      }
    }
    return {
      status: this.#status.kind,
      planner: this.#planner ? 'ready' : 'loading',
      video: this.#video !== null,
      videoError: this.#videoError,
      plan: plan !== null,
      canvas: this.#context !== null,
      playing: this.#playing,
      painted,
      paintWanted:
        this.#playing ||
        this.#dirty ||
        this.#paintTimer !== null ||
        (plan !== null && (painted?.frame !== plan.frame || painted.revision !== plan.sequenceRevision)),
      media,
      documents: [...documents],
      fonts: [...this.#fontsLoading.keys()],
    };
  }

  /**
   * Redraw while paused: multiple requests within the same round are merged into one; if still waiting for a seek, try again a little later (media events will also trigger it).
   * requestAnimationFrame is not used: it does not run while the window is obscured, yet the paused frame should be drawn first.
   */
  #requestPaint(delay = 0): void {
    if (this.#disposed) return;
    // During playback the next tick draws it naturally: record that a redraw is needed, and don't skip even the same frame.
    if (this.#playing) {
      this.#dirty = true;
      return;
    }
    if (this.#paintTimer) {
      if (delay > 0) return;
      clearTimeout(this.#paintTimer);
    }
    this.#paintTimer = setTimeout(() => {
      this.#paintTimer = null;
      try {
        if (!this.#playing && !this.#paint()) this.#requestPaint(HOLD_PAUSED_MS);
      } catch (error) {
        // Unexpected error: log it, and the next request draws as usual (no retry here, so the same error isn't logged again every second).
        this.#watch.noteError('重画', error); // i18n-ignore: dev log
      }
    }, delay);
  }

  #cancelPaint(): void {
    if (this.#paintTimer) clearTimeout(this.#paintTimer);
    this.#paintTimer = null;
  }

  #endScrub(): void {
    if (this.#scrubTimer) clearTimeout(this.#scrubTimer);
    this.#scrubTimer = null;
    this.#dragging = false;
  }

  #listen(element: SourceElement | HTMLAudioElement, on: boolean): void {
    const method = on ? 'addEventListener' : 'removeEventListener';
    if (element instanceof HTMLImageElement) {
      element[method]('load', this.#onMediaEvent);
      element[method]('error', this.#onMediaEvent);
      return;
    }
    for (const type of ['loadedmetadata', 'loadeddata', 'seeked', 'error'] as const) element[method](type, this.#onMediaEvent);
  }

  /** Metadata has arrived so seeking is possible, a seek has landed, or a picture is available: re-sync against the latest plan (old seek results won't be drawn over the new ones). */
  readonly #onMediaEvent = () => {
    try {
      this.#refresh();
    } catch (error) {
      this.#watch.noteError('处理媒体事件', error); // i18n-ignore: dev log
    }
  };
}

/** Layers to draw for this frame: the layers in the plan, plus the layer on the other side of a transition. */
/** Key for a local font face: family name, weight and italic. */
function fontKey(face: FontFaceQuery): string {
  return `${face.family}\u0000${face.weight}\u0000${face.italic}`;
}

function drawnLayers(plan: FramePlan): VisualLayer[] {
  return plan.layers.flatMap((layer) => (layer.transition?.partner ? [layer, layer.transition.partner] : [layer]));
}

/** When the source time goes past the asset's duration, stop at the last frame; otherwise every seek would miss its target and retry forever. */
function clampToMedia(element: HTMLMediaElement, seconds: number): number {
  return Number.isFinite(element.duration) ? Math.min(seconds, element.duration) : seconds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVersionRef(value: unknown): value is VersionRef {
  return isRecord(value) && typeof value.id === 'string' && typeof value.revision === 'string';
}

function dbToVolume(db: number): number {
  return Math.max(0, Math.min(1, 10 ** (db / 20)));
}
