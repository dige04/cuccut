import { useEffect, useRef } from 'react';
import { THUMB_BACKDROP } from '../../model/caption-presets.ts';
import type { Json, LineKind } from '../../render/text-style.ts';
import { drawImage, scheduleThumb } from '../../render/thumbnails.ts';
import { CaptionLoop, type LoopCell } from './caption-loop.ts';
import { useCanvasSize, useThumbPlanner } from './kernel-thumb.tsx';
import { captionFrame, captionSample, type CaptionSample } from './thumb-scenes.ts';

/** The gray background of the thumbnail (the gradient of prototype .sthumb). */
function backdrop(context: CanvasRenderingContext2D, width: number, height: number): void {
  const fill = context.createLinearGradient(0, 0, width, height);
  fill.addColorStop(0, THUMB_BACKDROP[0]);
  fill.addColorStop(1, THUMB_BACKDROP[1]);
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);
}

/* ---------- Shared clock ----------
   Dozens of cards on a screen share one requestAnimationFrame and one origin: at the same moment, each card speaks the same word (the shared metronome of the prototype gallery). A card that is not animating stops on its own. When the page is hidden, the browser does not call rAF, so nothing is drawn. */

/** `seconds` is the clock counted from the origin. When `spare()` is false, this tick's budget for kernel frame rendering is already used up, so the frame does not advance yet. */
type Tick = (seconds: number, spare: () => boolean) => void;

const ticks = new Set<Tick>();
let request = 0;
const epoch = performance.now();
/** The maximum total milliseconds all cards may spend calling the render kernel in one tick: cards that go over keep the previous cell and are drawn on the next tick, so the whole page is not held up. */
const TICK_BUDGET = 6;

function run(now: number): void {
  request = requestAnimationFrame(run);
  const start = performance.now();
  const spare = () => performance.now() - start < TICK_BUDGET;
  for (const tick of ticks) tick((now - epoch) / 1000, spare);
}

function onTick(tick: Tick): () => void {
  ticks.add(tick);
  request ||= requestAnimationFrame(run);
  return () => {
    ticks.delete(tick);
    if (ticks.size || !request) return;
    cancelAnimationFrame(request);
    request = 0;
  };
}

/**
 * One caption style thumbnail (prototype `SubThumb`): on a gray background, draws sample English and Chinese lines in this style, rendered by the render kernel (the same fonts, strokes, backing panel and shadows as preview and export). The large line is `px` pixels; if it does not fit, the whole thing scales down rather than wrapping.
 *
 * The original line is spoken one word per beat following this style's per-word animation, pauses a beat after finishing, then starts over (prototype `useSubBeat`). Only cards in view follow the clock; once a lap's frames have been drawn they are stored and looped as bitmaps (`CaptionLoop`); cards that scroll out of view are dropped; cards without per-word animation stop after one lap.
 * Under `prefers-reduced-motion` nothing moves; it stays at the cell where the second word is 35% spoken.
 */
export function CaptionThumb({ root, kinds, px }: { root: Json; kinds: readonly LineKind[]; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const planner = useThumbPlanner();
  const key = kinds.join(',');
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size || size.width <= 0 || size.height <= 0 || !planner) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(size.width * ratio);
    const height = Math.round(size.height * ratio);
    const lines = key ? (key.split(',') as LineKind[]) : [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let sample: CaptionSample | null = null;
    let loop: CaptionLoop | null = null;
    let shown = -1;
    /** The cell pasted onto the canvas: if the next cell is the same frame (within a beat of per-word color change), it is not pasted again. */
    let painted: LoopCell | null = null;
    let visible = false;
    let stop: (() => void) | null = null;

    const paint = (cell: LoopCell | null) => {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, width, height);
      backdrop(context, width, height);
      if (cell?.image) drawImage(context, cell.image, { x: 0, y: 0, width: cell.image.width, height: cell.image.height }, cell.at);
    };
    const frame = (seconds: number): ImageData | null => {
      try {
        return captionFrame(planner, sample!, seconds, width, height).blits[0]!.image;
      } catch (error) {
        console.warn('thumbnail could not be drawn', error); // i18n-ignore: dev log
        return null;
      }
    };
    const still = () => {
      if (!sample) return;
      const image = frame(sample.still);
      paint(image && { image, at: { x: 0, y: 0, width, height } });
      shown = -1;
      painted = null;
    };
    const tick: Tick = (seconds, spare) => {
      if (!loop) return;
      const index = loop.index(seconds);
      if (index === shown) return;
      let cell = loop.get(index);
      if (!cell) {
        if (!spare()) return;
        const image = frame(loop.time(index));
        if (!image) {
          // Could not draw (already reported): keep the previous cell and stop following the clock.
          loop = null;
          sync();
          return;
        }
        cell = loop.put(index, image);
      }
      if (cell !== painted) paint(cell);
      painted = cell;
      shown = index;
      // All cells in a lap are the same frame (this style has no per-word animation): stay on this cell.
      if (loop.still) {
        loop = null;
        sync();
      }
    };
    const sync = () => {
      const moving = !!loop && visible && !reduced.matches;
      if (moving && !stop) stop = onTick(tick);
      if (!moving && stop) {
        stop();
        stop = null;
      }
    };
    const onMotion = () => {
      sync();
      if (reduced.matches) still();
    };

    const first = scheduleThumb(() => {
      try {
        sample = captionSample(planner, root, lines, px * ratio, width, height);
      } catch (error) {
        console.warn('thumbnail could not be drawn', error); // i18n-ignore: dev log
        paint(null);
        return;
      }
      still();
      if (sample.period > 0) loop = new CaptionLoop(sample.period);
      sync();
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry!.isIntersecting;
      // Cards scrolled out of view keep no frames: dozens of off-screen cards do not hold memory, and they are drawn again when scrolled back.
      if (!visible) loop?.clear();
      sync();
    });
    observer.observe(canvas);
    reduced.addEventListener('change', onMotion);
    return () => {
      first();
      observer.disconnect();
      reduced.removeEventListener('change', onMotion);
      stop?.();
    };
  }, [planner, size, root, key, px]);
  return <canvas ref={ref} aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />;
}
