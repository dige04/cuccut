import { previewEngineOf, useShell, type PlaybackStats, type StallReport } from '@cuccut/ui/diagnostics';

/** Parameters of one playback benchmark: which video to open (its relative path in the project), where to start, and how long to play. */
export interface PreviewBenchInput {
  projectId: string;
  path: string;
  /** Where to start playing (seconds). */
  at: number;
  /** How long to play (seconds). */
  seconds: number;
  /** Time limit for opening the video and waiting for the preview to be ready (milliseconds). */
  openTimeoutMs: number;
}

export interface PreviewBenchResult {
  /** Pixel size of the sequence canvas and the drawn frames. */
  canvas: { width: number; height: number };
  size: { width: number; height: number } | null;
  devicePixelRatio: number;
  visibility: DocumentVisibilityState;
  /** From opening the video to the preview being ready. */
  openMs: number;
  /** From opening the video to the exact first frame being drawn (all media has arrived). */
  openExactMs: number | null;
  /** From pressing play to the first frame being drawn. */
  firstFrameMs: number | null;
  /** How long playback ran (milliseconds) and the frames drawn during that time. */
  elapsedMs: number;
  presented: number;
  /** Distinct video frames drawn, frames the video advanced through in that time, and frames not drawn. */
  distinctFrames: number;
  spannedFrames: number;
  droppedFrames: number;
  presentedFps: number;
  /** The video's own frame rate (computed from the frames advanced and the time). */
  sourceFps: number;
  stats: Omit<PlaybackStats, 'tickMs' | 'uploadMs' | 'renderMs' | 'drift' | 'frames'>;
  tickMs: Quantiles;
  uploadMs: Quantiles;
  renderMs: Quantiles;
  /** Interval of requestAnimationFrame (the page's refresh rhythm; it grows when the main thread is busy). */
  rafIntervalMs: Quantiles;
  /** Long tasks over 50 ms: the count and the longest one (the first second of playback is recorded separately). */
  longTasks: { count: number; maxMs: number; firstSecond: number };
  /** Deviation of the media element from the plan (milliseconds). */
  driftMs: Quantiles;
  /** Number of times the media element reports `waiting` (waiting for data, audio stalled). */
  waiting: number;
  /** Dragging the playhead while paused: milliseconds until the new frame is drawn after each seek. */
  scrubMs: Quantiles;
  /** Milliseconds for each drag, in order; a seek whose frame never gets drawn is recorded as `null`. */
  scrubSteps: (number | null)[];
  /** Milliseconds from the last drag to the exact frame being drawn (the same frame as in export). */
  scrubSettleMs: number | null;
  /** While paused, jumping to a distant moment (clicking the timeline): milliseconds to the first frame drawn, and to the exact frame being drawn. */
  jumpMs: { first: number | null; exact: number | null };
  /** Diagnostics of the preview's most recent stall (the engine's `stallReport`); null if it never stalled. */
  stall: StallReport | null;
}

interface Quantiles {
  p50: number;
  p95: number;
  max: number;
}

declare global {
  var cuccutPreviewBench: ((input: PreviewBenchInput) => Promise<PreviewBenchResult>) | undefined;
}

function quantiles(values: number[]): Quantiles {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : 0);
  const round = (value: number) => Math.round(value * 100) / 100;
  return { p50: round(at(0.5)), p95: round(at(0.95)), max: round(sorted.at(-1) ?? 0) };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(probe: () => T | null | undefined, timeoutMs: number, what: string): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    // i18n-ignore: diagnostic output of a development benchmark, not shown in the UI
    if (performance.now() > deadline) throw new Error(`等 ${what} 超过 ${timeoutMs} ms`);
    await delay(20);
  }
}

/** The moment of the next draw onto the preview canvas (`putImageData` or `drawImage`). */
function nextPresent(canvas: HTMLCanvasElement): Promise<number> {
  return new Promise((resolve) => {
    const context = canvas.getContext('2d')!;
    const methods = ['putImageData', 'drawImage'] as const;
    const originals = methods.map((name) => context[name]);
    methods.forEach((name, index) => {
      (context as any)[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        methods.forEach((method, i) => ((context as any)[method] = originals[i]));
        const result = (originals[index] as any).apply(this, args);
        resolve(performance.now());
        return result;
      };
    });
  });
}

/** The moment the next exact frame (`engine.exact`) is drawn; `null` on timeout. */
async function nextExact(canvas: HTMLCanvasElement, engine: { readonly exact: boolean }, timeoutMs: number): Promise<number | null> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const left = deadline - performance.now();
    if (left <= 0) return null;
    const painted = await Promise.race([nextPresent(canvas), delay(left).then(() => null)]);
    if (painted === null) return null;
    if (engine.exact) return painted;
  }
}

// Find elements by structure rather than by UI text: the UI's aria-label changes with the UI language.
const PREVIEW_CANVAS = 'canvas[data-preview-status]';
const PREVIEW_READY = 'canvas[data-preview-status="ready"]';
const PLAY_BUTTON = 'button.cc-transport-play';

/**
 * End-to-end benchmark of preview playback (`npm run bench:preview`, `tools/preview-bench.mjs`): built along with the output, and the app itself does not load it.
 * After the benchmark script opens the real UI in a hidden window and connects to an isolated Runtime, it dynamically imports this file and calls `cuccutPreviewBench()`: it opens a video through the shell,
 * drags the playhead a few times while paused, then presses “play” and plays for a while, and summarizes the engine's counters with the page's long tasks, refresh intervals and the media element's `waiting` events.
 */
globalThis.cuccutPreviewBench = async (input) => {
  // Leave the editor first and wait for the previous video's preview canvas to be torn down, so it is not mistaken for this one's.
  useShell.getState().navigate('/space');
  // i18n-ignore: diagnostic output of a development benchmark (names of the items being waited on), not shown in the UI
  await waitFor(() => !document.querySelector(PREVIEW_CANVAS), input.openTimeoutMs, '上一个预览关掉');
  const opened = performance.now();
  useShell.getState().openVideo({ projectId: input.projectId, path: input.path });
  const canvas = await waitFor(
    () => document.querySelector<HTMLCanvasElement>(PREVIEW_READY),
    input.openTimeoutMs,
    // i18n-ignore: diagnostic output of a development benchmark (names of the items being waited on), not shown in the UI
    '预览就绪',
  ).catch((error: unknown) => {
    // If readiness never comes, include the engine's stall diagnostics (which step it is stuck on).
    const stuck = document.querySelector<HTMLCanvasElement>(PREVIEW_CANVAS);
    const report = stuck ? previewEngineOf(stuck)?.stallReport : undefined;
    throw report ? new Error(`${error instanceof Error ? error.message : String(error)}: ${JSON.stringify(report)}`) : error;
  });
  // i18n-ignore: diagnostic output of a development benchmark (names of the items being waited on), not shown in the UI
  const engine = await waitFor(() => previewEngineOf(canvas), input.openTimeoutMs, '预览引擎');
  // i18n-ignore: same as above
  await waitFor(() => engine.plan, input.openTimeoutMs, '帧计划');
  const openMs = performance.now() - opened;
  // Wait until the first frame is drawn (all media has arrived) before dragging; otherwise what gets measured is loading.
  const openExact = engine.exact ? performance.now() : await nextExact(canvas, engine, input.openTimeoutMs);
  const openExactMs = openExact === null ? null : Math.round(openExact - opened);

  // Dragging the playhead while paused: after each frame is drawn, seek again 50 ms later and record the time until that frame is drawn; after the last drag, record the time until the exact frame is drawn.
  const scrub: (number | null)[] = [];
  let scrubSettleMs: number | null = null;
  for (let i = 0; i < 8; i++) {
    const painted = nextPresent(canvas);
    const start = performance.now();
    engine.seek(input.at + i * 0.4);
    const end = await Promise.race([painted, delay(2000).then(() => null)]);
    scrub.push(end === null ? null : Math.round(end - start));
    if (i < 7) await delay(50);
    else {
      const exact = await nextExact(canvas, engine, 3000);
      scrubSettleMs = exact === null ? null : Math.round(exact - start);
    }
  }
  // After stopping, jump a few seconds away (clicking the timeline, most likely landing between keyframes), then go back to the start to prepare for playback.
  await delay(300);
  const jumpFirst = nextPresent(canvas);
  const jumped = performance.now();
  engine.seek(input.at + 5.3);
  const jumpPainted = await Promise.race([jumpFirst, delay(3000).then(() => null)]);
  const jumpExact = engine.exact ? jumpPainted : await nextExact(canvas, engine, 3000);
  const jumpMs = {
    first: jumpPainted === null ? null : Math.round(jumpPainted - jumped),
    exact: jumpExact === null ? null : Math.round(jumpExact - jumped),
  };
  engine.seek(input.at);
  await nextExact(canvas, engine, 3000);
  await delay(1000);

  const longTasks: { start: number; duration: number }[] = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, duration: entry.duration });
  });
  observer.observe({ type: 'longtask', buffered: false });
  let waiting = 0;
  const onWaiting = () => waiting++;
  const media = [...document.querySelectorAll<HTMLMediaElement>('video, audio')];
  for (const element of media) element.addEventListener('waiting', onWaiting);
  const intervals: number[] = [];
  let last = 0;
  let measuring = true;
  const frame = (now: number) => {
    if (last) intervals.push(now - last);
    last = now;
    if (measuring) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // i18n-ignore: diagnostic output of a development benchmark (names of the items being waited on), not shown in the UI
  const play = await waitFor(() => document.querySelector<HTMLButtonElement>(PLAY_BUTTON), 5000, '播放按钮');
  const firstPresent = nextPresent(canvas);
  const started = performance.now();
  play.click();
  const first = await Promise.race([firstPresent, delay(input.seconds * 1000).then(() => null)]);
  await delay(Math.max(0, input.seconds * 1000 - (performance.now() - started)));
  const stats = structuredClone(engine.stats);
  const elapsedMs = performance.now() - started;
  // While playing, the same key means “pause”.
  document.querySelector<HTMLButtonElement>(PLAY_BUTTON)?.click();
  measuring = false;
  observer.disconnect();
  for (const element of media) element.removeEventListener('waiting', onWaiting);

  const plan = engine.plan!;
  const frames = stats.frames;
  const distinct = new Set(frames).size;
  const spanned = frames.length ? Math.max(...frames) - Math.min(...frames) + 1 : 0;
  const { tickMs, uploadMs, renderMs, drift, frames: _frames, ...counts } = stats;
  return {
    canvas: { width: plan.canvas.width, height: plan.canvas.height },
    size: stats.size,
    devicePixelRatio: window.devicePixelRatio,
    visibility: document.visibilityState,
    openMs: Math.round(openMs),
    openExactMs,
    firstFrameMs: first === null ? null : Math.round(first - started),
    elapsedMs: Math.round(elapsedMs),
    presented: stats.presented,
    distinctFrames: distinct,
    spannedFrames: spanned,
    droppedFrames: Math.max(0, spanned - distinct),
    presentedFps: Math.round((stats.presented / elapsedMs) * 1000 * 10) / 10,
    sourceFps: Math.round((spanned / elapsedMs) * 1000 * 10) / 10,
    stats: counts,
    tickMs: quantiles(tickMs),
    uploadMs: quantiles(uploadMs),
    renderMs: quantiles(renderMs),
    rafIntervalMs: quantiles(intervals),
    longTasks: {
      count: longTasks.length,
      maxMs: Math.round(Math.max(0, ...longTasks.map((task) => task.duration))),
      firstSecond: longTasks.filter((task) => task.start < started + 1000).length,
    },
    driftMs: quantiles(drift.map((seconds) => seconds * 1000)),
    waiting,
    scrubMs: quantiles(scrub.filter((ms) => ms !== null)),
    scrubSteps: scrub,
    scrubSettleMs,
    jumpMs,
    stall: engine.stallReport,
  };
};
