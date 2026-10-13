import { describe, expect, it, vi } from 'vitest';
import { blankTextLayer, type MeasureText } from '../../model/text-presets.ts';
import { PlanFailure } from '../../render/render-planner.ts';
import { withTextMeasure, type TextKernel } from './text-measure.ts';

const canvas = { width: 1920, height: 1080 };
type MeasureOn = (size: typeof canvas) => MeasureText;
const crashed = () => new PlanFailure({ code: 'PLANNER_CRASHED', message: '帧计划器出错，正在重新载入' });

/** Fake kernel: the measured box width is character count × 100; `fail` specifies which measurement call should throw, and what. */
function fakeKernel(fail: (call: number) => Error | null = () => null) {
  let calls = 0;
  let recover: () => void = () => {};
  const kernel: TextKernel & { calls(): number; recover(): void } = {
    measureText: (text, _style, wrapWidth, size) => {
      const error = fail(++calls);
      if (error) throw error;
      return { width: wrapWidth ?? text.length * 100, height: size.height / 10 };
    },
    recovered: () => new Promise<void>((resolve) => (recover = resolve)),
    calls: () => calls,
    recover: () => recover(),
  };
  return kernel;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => ((resolve = ok), (reject = fail)));
  return { promise, resolve, reject };
}

describe('measure the box when creating text', () => {
  it('wait for the kernel while it is not loaded, measure with it after loading, and do not give an approximate box first', async () => {
    const kernel = fakeKernel();
    const loading = deferred<TextKernel>();
    const build = vi.fn((measureOn: MeasureOn) => blankTextLayer(canvas, measureOn(canvas)));
    const made = withTextMeasure(build, () => loading.promise);
    await Promise.resolve();
    expect(build).not.toHaveBeenCalled();
    loading.resolve(kernel);
    const layer = await made;
    expect(build).toHaveBeenCalledTimes(1);
    // “enter text, four characters” → 400 px wide, which is 400/1920 of a 1920-wide canvas.
    expect(layer.place?.w).toBeCloseTo((400 / 1920) * 100, 1);
  });

  it('reject if the kernel fails to load, no box created', async () => {
    const build = vi.fn(() => 1);
    await expect(withTextMeasure(build, () => Promise.reject(new Error('预览渲染模块没有载入')))).rejects.toThrow('预览渲染模块没有载入');
    expect(build).not.toHaveBeenCalled();
  });

  it('kernel trap (PLANNER_CRASHED) during measurement: wait for it to reload, then re-measure the whole group', async () => {
    // Trap on the second measurement: the first layer is measured but the second is not, so the result must not be a partial one.
    const kernel = fakeKernel((call) => (call === 2 ? crashed() : null));
    const build = vi.fn((measureOn: MeasureOn) => [measureOn(canvas)('一', {}, null).width, measureOn(canvas)('一二', {}, null).width]);
    let settled = false;
    const made = withTextMeasure(build, async () => kernel).finally(() => (settled = true));
    await vi.waitFor(() => expect(kernel.calls()).toBe(2));
    // Not yet reloaded: do not retry, and do not return a result.
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
    kernel.recover();
    expect(await made).toEqual([100, 200]);
    expect(build).toHaveBeenCalledTimes(2);
    expect(kernel.calls()).toBe(4);
  });

  it('errors that are not traps are rethrown, not retried', async () => {
    const kernel = fakeKernel(() => new PlanFailure({ code: 'INVALID_PARAMS', message: '还没注入字体' }));
    const build = vi.fn((measureOn: MeasureOn) => measureOn(canvas)('字', {}, null));
    await expect(withTextMeasure(build, async () => kernel)).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('give up after three tries when every attempt traps', async () => {
    const kernel = fakeKernel(() => crashed());
    const recovered = vi.spyOn(kernel, 'recovered').mockResolvedValue(undefined);
    const build = vi.fn((measureOn: MeasureOn) => measureOn(canvas)('字', {}, null));
    await expect(withTextMeasure(build, async () => kernel)).rejects.toMatchObject({ code: 'PLANNER_CRASHED' });
    expect(build).toHaveBeenCalledTimes(3);
    expect(recovered).toHaveBeenCalledTimes(2);
  });

  it('reject when reloading fails', async () => {
    const kernel = fakeKernel(() => crashed());
    vi.spyOn(kernel, 'recovered').mockRejectedValue(new Error('重新实例化失败'));
    await expect(
      withTextMeasure(
        (measureOn) => measureOn(canvas)('字', {}, null),
        async () => kernel,
      ),
    ).rejects.toThrow('重新实例化失败');
  });
});
