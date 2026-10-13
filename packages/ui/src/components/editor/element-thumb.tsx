import { useCallback, useEffect, useState } from 'react';
import type { LibraryEntrySummary, Rate } from '@cuccut/protocol';
import type { ElementTile } from '../../model/element-catalog.ts';
import type { TextPreset } from '../../model/text-presets.ts';
import { useLibraryFileUrl } from '../use-library-entry.ts';
import { KernelThumb, type ThumbDraw } from './kernel-thumb.tsx';
import { CONFETTI_LOOP, CONFETTI_STILL, confettiThumb, layerThumb, lottieThumb, presetThumb } from './thumb-scenes.ts';
import { ELEMENTS_COPY as EL } from './elements-copy.ts';

type Size = { width: number; height: number };

/** Thumbnail for an element cell: the layer just created is drawn at its true aspect ratio and shrunk into the cell, with a little margin on all sides. The confetti cell goes through `ConfettiThumb`, and `playing` makes it move. */
export function ElementThumb({ tile, canvas, playing = false }: { tile: ElementTile; canvas: Size; playing?: boolean }) {
  if (tile.confetti) return <ConfettiThumb styleKey={tile.confetti} playing={playing} />;
  return <LayerThumb tile={tile} canvas={canvas} />;
}

function LayerThumb({ tile, canvas }: { tile: ElementTile; canvas: Size }) {
  const { width: canvasWidth, height: canvasHeight } = canvas;
  const draw = useCallback<ThumbDraw>(
    (planner, width, height) => {
      const frame = { width: canvasWidth, height: canvasHeight };
      return layerThumb(planner, tile.layer(frame), frame, width, height);
    },
    [tile, canvasWidth, canvasHeight],
  );
  return <KernelThumb draw={draw} />;
}

/** The moment hover plays: starting at `from` seconds, moving forward and looping every `loop` seconds (when `loop` is null, keep moving forward). Not playing: stays at `from`. */
function usePlayhead(playing: boolean, from: number, loop: number | null): number {
  const [time, setTime] = useState(from);
  useEffect(() => {
    if (!playing) {
      setTime(from);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const elapsed = (now - start) / 1000;
      setTime(from + (loop === null ? elapsed : elapsed % loop));
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, from, loop]);
  return time;
}

/**
 * Confetti thumbnail (design `ConfettiTile`): draws one frame at the cell's own pixel size; the same seed always gives the same picture. When `playing`, it loops a 4-second segment starting at 4.5 seconds. The background color comes from the cell outside (bright particles on a dark base).
 */
export function ConfettiThumb({ styleKey, playing = false }: { styleKey: string; playing?: boolean }) {
  const time = usePlayhead(playing, CONFETTI_STILL, CONFETTI_LOOP);
  const draw = useCallback<ThumbDraw>((planner, width, height) => confettiThumb(planner, styleKey, time, width, height), [styleKey, time]);
  return <KernelThumb draw={draw} live={playing} />;
}

/**
 * Thumbnail for a brand-library sticker (elements page “My stickers”): an image is shown directly from its file; a Lottie stops on the middle frame of its animation (the start is often still empty), and when `playing` it loops from that frame. If it cannot be read, the cell is left blank.
 */
export function BrandStickerThumb({
  summary,
  lottie,
  playing = false,
}: {
  summary: LibraryEntrySummary;
  lottie: boolean;
  playing?: boolean;
}) {
  const url = useLibraryFileUrl(summary);
  if (lottie) return <LottieThumb url={url} playing={playing} />;
  return url ? (
    <img src={url} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
  ) : null;
}

function LottieThumb({ url, playing }: { url: string | null; playing: boolean }) {
  const [file, setFile] = useState<{ url: string; bytes: Uint8Array } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(EL.lottieFetchFailed(response.status));
        return response.arrayBuffer();
      })
      .then(
        (buffer) => live && setFile({ url, bytes: new Uint8Array(buffer) }),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [url]);
  const current = file && file.url === url ? file : null;
  const elapsed = usePlayhead(playing && !!current, 0, null);
  const draw = useCallback<ThumbDraw>(
    (planner, width, height) => (current ? lottieThumb(planner, current.url, current.bytes, elapsed, width, height) : null),
    [current, elapsed],
  );
  return <KernelThumb draw={draw} live={playing} />;
}

/** Thumbnail for a text preset card. The frame width is measured by the core instance that draws it (the same measuring method as at creation). */
export function PresetThumb({ preset, fps }: { preset: TextPreset; fps: Rate }) {
  const draw = useCallback<ThumbDraw>(
    (planner, width, height, ratio) => presetThumb(planner, preset, fps, ratio, width, height),
    [preset, fps],
  );
  return <KernelThumb draw={draw} />;
}
