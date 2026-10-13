/**
 * Preview quality (architecture design §9.4): when stopped, the render kernel's original frame is drawn at canvas pixel size (the same as export). During playback, the resolution is reduced to fit the pixel budget; the content drawn is unchanged, and the canvas's CSS size scales it up to the display size.
 */

/** Drawn at full size when stopped; drawn at reduced resolution during playback. */
export type PaintQuality = 'exact' | 'playback';

/**
 * Maximum pixels drawn per frame during playback (960×540). The WASM kernel on the main thread takes about 40 ns per pixel (feeding the picture plus drawing; a 1314×739 frame takes about 40 ms). This budget is about 20 ms per frame, which, plus element and UI updates, fits within two 60 Hz refresh intervals, so 30 fps video can be drawn frame by frame.
 */
export const PLAYBACK_PIXELS = 960 * 540;

export interface PaintSize {
  width: number;
  height: number;
}

/**
 * Size of this frame: the sequence canvas multiplied by `scale` (canvas pixels relative to the sequence canvas), rounded. During playback, anything above `PLAYBACK_PIXELS` is scaled down by the same ratio to fit the budget (never larger than when stopped).
 */
export function paintSize(canvas: PaintSize, scale: number, quality: PaintQuality): PaintSize {
  const pixels = canvas.width * scale * canvas.height * scale;
  const factor = quality === 'playback' && pixels > PLAYBACK_PIXELS ? Math.sqrt(PLAYBACK_PIXELS / pixels) : 1;
  return {
    width: Math.max(1, Math.round(canvas.width * scale * factor)),
    height: Math.max(1, Math.round(canvas.height * scale * factor)),
  };
}
