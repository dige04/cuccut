import { describe, expect, it } from 'vitest';
import { TEXT_PRESETS, blankTextLayer, preferredLayer, presetLayers, presetsOf, type MeasureText } from './text-presets.ts';

const canvas = { width: 1920, height: 1080 };
const fps = { num: 30, den: 1 };
/** A stand-in for text measurement: each character is 10 pixels wide and a line is 30 pixels high; if a wrap width is given, wrapping follows it. */
const measure: MeasureText = (text, _style, wrap) => {
  const width = Math.max(...text.split('\n').map((line) => line.length * 10));
  const lines = text.split('\n').reduce((n, line) => n + (wrap ? Math.max(1, Math.ceil((line.length * 10) / wrap)) : 1), 0);
  return { width: wrap ?? width, height: lines * 30 };
};
const byId = (id: string) => TEXT_PRESETS.find((preset) => preset.id === id)!;

describe('文字预设', () => {
  it('51 条：简单 13、标题 10、下三分 20、其它 8，文字样式与图形都不带 schema', () => {
    expect(TEXT_PRESETS).toHaveLength(51);
    expect(['simple', 'title', 'lower', 'other'].map((c) => presetsOf(c as 'simple').length)).toEqual([13, 10, 20, 8]);
    for (const preset of TEXT_PRESETS) {
      for (const layer of preset.layers) {
        if (layer.kind === 'text') expect(layer.style?.schema).toBeUndefined();
        else expect(layer.shape ?? {}).not.toHaveProperty('schema');
      }
    }
  });

  it('文字没给宽时按量出来的宽落框（画幅宽的百分比），中心在画幅百分比处', () => {
    const [layer] = presetLayers(byId('simple.02'), canvas, fps, measure);
    // Six characters, 60 pixels wide: 3.125% of 1920, to one decimal place.
    expect(layer).toMatchObject({ type: 'text', text: 'Simple', place: { x: 50, y: 50, w: 3.1 } });
  });

  it('多层：形状按 w、高写进 shape.h，给了宽的文字按它落框，成员按 delay 错峰', () => {
    const preset = byId('lowerThird.01');
    const layers = presetLayers(preset, canvas, fps, measure);
    expect(layers.map((layer) => layer.type)).toEqual(preset.layers.map((layer) => layer.kind));
    const shape = layers[0]!;
    if (shape.type !== 'shape') throw new Error('第一层应是图形');
    expect(shape.place.w).toBe(33.2);
    expect(shape.shape.h).toBeCloseTo(14.92);
    const delayed = preset.layers.findIndex((layer) => layer.delay);
    if (delayed >= 0) expect(layers[delayed]!.delayFrames).toBe(Math.round(preset.layers[delayed]!.delay! * 30));
    const wide = preset.layers.findIndex((layer) => layer.kind === 'text' && layer.place.w !== undefined);
    expect(layers[wide]!.place.w).toBeCloseTo(preset.layers[wide]!.place.w!, 1);
    expect(preferredLayer(preset)).toBe(preset.layers.findIndex((layer) => layer.kind === 'text'));
  });

  it('旋转的那一条带上角度', () => {
    const preset = TEXT_PRESETS.find((p) => p.layers.some((layer) => layer.place.rot))!;
    const index = preset.layers.findIndex((layer) => layer.place.rot);
    expect(presetLayers(preset, canvas, fps, measure)[index]!.place.rot).toBe(preset.layers[index]!.place.rot);
  });

  it('添加文本框：画面中线偏上，按字量框', () => {
    expect(blankTextLayer(canvas, measure)).toMatchObject({
      type: 'text',
      text: '输入文字',
      // Four characters, 40 pixels wide: 2.08% of 1920.
      place: { x: 50, y: 40, w: 2.1 },
    });
  });
});
