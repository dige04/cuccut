import { useEffect, useRef, useState, type RefObject } from 'react';
import type { RenderPlanner } from '../../render/render-planner.ts';
import { drawImage, scheduleThumb, thumbnailPlanner } from '../../render/thumbnails.ts';
import type { ThumbPicture } from './thumb-scenes.ts';

/** Draws one thumbnail: the size is the cell's device pixels, `ratio` is the pixel density. Returns null when there is nothing to draw yet (the cell stays empty). */
export type ThumbDraw = (planner: RenderPlanner, width: number, height: number, ratio: number) => ThumbPicture | null;

/** Background fill laid down first under the thumbnail (device pixels). */
export type ThumbBackdrop = (context: CanvasRenderingContext2D, width: number, height: number) => void;

type Size = { width: number; height: number };

let loaded: RenderPlanner | null = null;

/** Shared render kernel instance for thumbnails: null until loaded (including fonts). */
export function useThumbPlanner(): RenderPlanner | null {
  const [planner, setPlanner] = useState(loaded);
  useEffect(() => {
    if (planner) return;
    let live = true;
    thumbnailPlanner().then(
      (value) => {
        loaded = value;
        if (live) setPlanner(value);
      },
      (error: unknown) => console.warn('thumbnail render kernel failed to load', error), // i18n-ignore: dev log
    );
    return () => {
      live = false;
    };
  }, [planner]);
  return planner;
}

/** The canvas's CSS size (follows ResizeObserver; the same object while unchanged); null until measured. */
export function useCanvasSize(ref: RefObject<HTMLCanvasElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.contentRect;
      setSize((old) => (old && old.width === box.width && old.height === box.height ? old : { width: box.width, height: box.height }));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * Thumbnail canvas drawn by the render kernel: fills the device pixels at its own CSS size, and redraws when the size or `draw` changes. Normally draws are queued
 * (so dozens of cells on screen don't freeze the UI all at once); when `live` (hover playback, where `draw` changes every frame) it draws immediately. Cells stay empty until the kernel loads.
 */
export function KernelThumb({ draw, live = false, backdrop }: { draw: ThumbDraw; live?: boolean; backdrop?: ThumbBackdrop }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const planner = useThumbPlanner();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size || size.width <= 0 || size.height <= 0) return;
    const paint = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(size.width * ratio);
      const height = Math.round(size.height * ratio);
      let picture: ThumbPicture | null = null;
      if (planner) {
        try {
          picture = draw(planner, width, height, ratio);
        } catch (error) {
          console.warn('thumbnail could not be drawn', error); // i18n-ignore: dev log
        }
      }
      // Don't reset the size when it hasn't changed (resetting reallocates the bitmap): during hover playback it redraws every frame.
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, width, height);
      backdrop?.(context, width, height);
      for (const blit of picture?.blits ?? []) drawImage(context, blit.image, blit.source, blit.target);
    };
    if (live || !planner) {
      paint();
      return;
    }
    return scheduleThumb(paint);
  }, [draw, planner, size, live, backdrop]);
  return <canvas ref={ref} aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />;
}
