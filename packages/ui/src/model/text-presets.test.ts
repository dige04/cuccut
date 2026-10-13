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

describe('text presets', () => {
  it('51 entries: simple 13, title 10, lower third 20, other 8; text styles and shapes carry no schema', () => {
    expect(TEXT_PRESETS).toHaveLength(51);
    expect(['simple', 'title', 'lower', 'other'].map((c) => presetsOf(c as 'simple').length)).toEqual([13, 10, 20, 8]);
    for (const preset of TEXT_PRESETS) {
      for (const layer of preset.layers) {
        if (layer.kind === 'text') expect(layer.style?.schema).toBeUndefined();
        else expect(layer.shape ?? {}).not.toHaveProperty('schema');
      }
    }
  });

  it('when text has no width, the measured width sets the box (a percentage of the frame width), centered at the frame percentage', () => {
    const [layer] = presetLayers(byId('simple.02'), canvas, fps, measure);
    // Six characters, 60 pixels wide: 3.125% of 1920, to one decimal place.
    expect(layer).toMatchObject({ type: 'text', text: 'Simple', place: { x: 50, y: 50, w: 3.1 } });
  });

  it('multi-layer: the shape writes w and h into shape.h, text with a given width sets its box by it, members stagger by delay', () => {
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

  it('the rotated strip carries the angle', () => {
    const preset = TEXT_PRESETS.find((p) => p.layers.some((layer) => layer.place.rot))!;
    const index = preset.layers.findIndex((layer) => layer.place.rot);
    expect(presetLayers(preset, canvas, fps, measure)[index]!.place.rot).toBe(preset.layers[index]!.place.rot);
  });

  it('add text box: positioned above the frame\'s center line, sized by its text', () => {
    expect(blankTextLayer(canvas, measure)).toMatchObject({
      type: 'text',
      text: '输入文字',
      // Four characters, 40 pixels wide: 2.08% of 1920.
      place: { x: 50, y: 40, w: 2.1 },
    });
  });
});
