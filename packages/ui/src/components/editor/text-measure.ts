import type { MeasureText } from '../../model/text-presets.ts';
import { loadRenderPlanner } from '../../render/preview-wasm.ts';
import { PlanFailure, type RenderPlanner } from '../../render/render-planner.ts';

type Size = { width: number; height: number };

/** The part of the render kernel (`RenderPlanner`) used to measure text boxes. */
export type TextKernel = Pick<RenderPlanner, 'measureText' | 'recovered'>;

/** If the kernel fails several times in a row inside `build`, stop waiting (so that when the same input keeps tripping it, the wait does not go on forever). */
const ATTEMPTS = 3;

/**
 * Measuring the box when a new text is created: waits for the render kernel to load (including fonts), then hands the measuring routine for a given sequence canvas to `build` (the box and the rendered text use the same typesetting engine and the same fonts, `frame_render::text_measure`).
 * If the kernel is reloading (`PLANNER_CRASHED`), wait until it is ready and rerun all of `build`, rather than using a partially measured result. There is no approximate measuring method: if the kernel fails to load, reject and do not create the box.
 */
export async function withTextMeasure<T>(
  build: (measureOn: (canvas: Size) => MeasureText) => T,
  load: () => Promise<TextKernel> = loadRenderPlanner,
): Promise<T> {
  const kernel = await load();
  const measureOn =
    (canvas: Size): MeasureText =>
    (text, style, wrapWidth) =>
      kernel.measureText(text, style, wrapWidth, canvas);
  for (let attempt = 1; ; attempt++) {
    try {
      return build(measureOn);
    } catch (error) {
      if (!(error instanceof PlanFailure) || error.code !== 'PLANNER_CRASHED' || attempt >= ATTEMPTS) throw error;
      await kernel.recovered();
    }
  }
}
