import { setLocale } from '@cuccut/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFETTI_STYLES, confettiDefaults, normalizeConfetti } from '../render/confetti.ts';
import { knownShape } from '../render/elements.ts';
import { STICKER_TEMPLATES } from '../render/sticker-templates.ts';
import { PROGRESS_STYLES } from '../render/progress.ts';
import { WAVE_STYLES } from '../render/visualizer.ts';
import {
  COUNTER_STYLE,
  ELEMENT_TILES,
  PROGRESS_KINDS,
  SHAPE_CHOICES,
  VISUALIZER_PEEK,
  WAVE_KINDS,
  elementSections,
} from './element-catalog.ts';
import { poseOf, type PlacedItem } from './stage-pose.ts';

const canvas = { width: 1920, height: 1080 };
const layerOf = (key: string) => ELEMENT_TILES.find((tile) => tile.key === key)!.layer(canvas);
/** This layer's box on the canvas (pixels; center and width/height), derived the same way as the stage and the frame plan. */
const boxOf = (key: string, size = canvas) => {
  const { cx, cy, w, h } = poseOf(ELEMENT_TILES.find((tile) => tile.key === key)!.layer(size) as unknown as PlacedItem, size);
  return { cx, cy, w, h };
};

describe('element catalog', () => {
  it('cell counts per category: stickers 10, confetti 10, shapes 23, progress 14, timer 2, waveform 10', () => {
    const count = (group: string) => ELEMENT_TILES.filter((tile) => tile.group === group).length;
    expect([count('sticker'), count('confetti'), count('shape'), count('progress'), count('counter'), count('wave')]).toEqual([10, 10, 23, 14, 2, 10]);
    expect(new Set(ELEMENT_TILES.map((tile) => tile.key)).size).toBe(ELEMENT_TILES.length);
  });

  it('all stickers are in the template catalog, and all shapes can be drawn', () => {
    for (const tile of ELEMENT_TILES) {
      const layer = tile.layer(canvas);
      if (tile.group === 'sticker') {
        expect(layer.type).toBe('sticker');
        if (layer.type === 'sticker') expect(STICKER_TEMPLATES[layer.sticker.templateId!]).toBeDefined();
      }
      if (layer.type === 'shape') expect(knownShape(layer.shape.shape)).toBe(true);
    }
    expect(SHAPE_CHOICES.every((choice) => knownShape(choice.key))).toBe(true);
  });

  it('colors are taken by cell index: skipped arrows also occupy a cell', () => {
    expect(layerOf('shape.0.rect')).toMatchObject({ shape: { fill: '#FF4C45', stroke: '#E43A33', strokeWidth: 3 } });
    expect(layerOf('shape.1.rect')).toMatchObject({
      name: '形状 · 圆角矩形',
      shape: { fill: '#3CADFF', cornerRadius: [14.4, 14.4, 14.4, 14.4] },
    });
    expect(layerOf('shape.11.tick')).toMatchObject({ shape: { fill: '#3CADFF' } });
    expect(ELEMENT_TILES.some((tile) => tile.key.endsWith('.arrow'))).toBe(false);
  });

  it('default placement: shapes 15% wide and square, stickers 18%; progress and waveform use the category\'s default frame (progress bar 80%×5%, waveform along the bottom full width), not changed to square by style', () => {
    expect(layerOf('shape.2.ellipse').place).toEqual({ x: 50, y: 50, w: 15 });
    expect(boxOf('shape.2.ellipse')).toEqual({ cx: 960, cy: 540, w: 288, h: 288 });
    expect(layerOf('sticker.heart').place).toEqual({ x: 50, y: 50, w: 18 });
    for (const key of ['progress.rounded', 'progress.donut', 'progress.border']) {
      expect(layerOf(key).place).toEqual({ x: 50, y: 50, w: 80 });
      expect(boxOf(key)).toEqual({ cx: 960, cy: 540, w: 1536, h: 54 });
    }
    for (const key of ['wave.bars', 'wave.pulse_rings']) {
      expect(layerOf(key).place).toEqual({ x: 50, y: 85, w: 100 });
      expect(boxOf(key)).toEqual({ cx: 960, cy: 918, w: 1920, h: 216 });
    }
    // Placement is independent of aspect ratio: portrait uses the same set of percentages.
    const portrait = ELEMENT_TILES.find((tile) => tile.key === 'wave.ring_bars')!.layer({ width: 1080, height: 1920 });
    expect(portrait.place).toEqual({ x: 50, y: 85, w: 100 });
  });

  it('all progress and waveform styles can be drawn; default colors and dB windows come from each style; only the two bar styles span two columns', () => {
    expect(PROGRESS_KINDS.map((kind) => kind.key)).toEqual(Object.keys(PROGRESS_STYLES));
    expect(WAVE_KINDS.map((kind) => kind.key)).toEqual(Object.keys(WAVE_STYLES));
    // Palette names are UI copy, and the count follows the recipe (the two rainbow-border styles have none).
    for (const kind of PROGRESS_KINDS) expect(kind.colors).toHaveLength(PROGRESS_STYLES[kind.key]!.numColors);
    for (const kind of WAVE_KINDS) expect(kind.colors).toHaveLength(WAVE_STYLES[kind.key]!.numColors);
    expect(ELEMENT_TILES.filter((tile) => tile.wide).map((tile) => tile.key)).toEqual(['progress.rounded', 'progress.normal']);
    expect(layerOf('progress.strobe_border')).toMatchObject({
      type: 'progress',
      name: '进度条 · 频闪边框',
      progress: { style: 'strobe_border', mainColor: '#FF4C45', secondaryColor: '#A46CFF' },
    });
    expect(layerOf('wave.oscilloscope')).toMatchObject({
      type: 'visualizer',
      name: '声波 · 示波器',
      visualizer: { style: 'oscilloscope', mainColor: '#46E1FF', minDb: -120, maxDb: -10 },
    });
    expect(VISUALIZER_PEEK.every((key) => ELEMENT_TILES.some((tile) => tile.key === key))).toBe(true);
  });

  it('visualization order: progress grid (the two timer cells sit between the wander and wander-rotate), then waveform', () => {
    const visual = elementSections()
      .find((section) => section.key === 'visualizer')!
      .tiles.map((tile) => tile.key);
    expect(visual.slice(9, 15)).toEqual([
      'progress.reverse_strobe_border',
      'progress.snake',
      'counter.countdown',
      'counter.countup',
      'progress.snake_spin',
      'progress.snake_rainbow',
    ]);
    expect(visual[16]).toBe('wave.bars');
  });

  it('confetti: ten styles in recipe order, fill the frame, 5 seconds; parameters are that style\'s defaults plus one random seed; emission parameters that follow the recipe are not written', () => {
    const tiles = ELEMENT_TILES.filter((tile) => tile.group === 'confetti');
    expect(tiles.map((tile) => tile.confetti)).toEqual(CONFETTI_STYLES.map((style) => style.key));
    const tile = tiles.find((t) => t.key === 'confetti.hearts-petals')!;
    expect(tile.seconds).toBe(5);
    const a = tile.layer(canvas);
    const b = tile.layer(canvas);
    expect(a).toMatchObject({ type: 'confetti', name: '彩纸 · 爱心花瓣', place: { x: 50, y: 50, w: 100 } });
    expect(boxOf('confetti.hearts-petals')).toEqual({ cx: 960, cy: 540, w: 1920, h: 1080 });
    const values = (a.type === 'confetti' ? a.confetti : {}) as Record<string, unknown>;
    const { seed, ...rest } = values;
    const { seed: _, origin: __, angle: ___, spread: ____, ...defaults } = confettiDefaults('hearts-petals');
    expect(rest).toEqual(defaults);
    expect(Number.isSafeInteger(seed) && (seed as number) > 0).toBe(true);
    expect(seed).not.toBe((b.type === 'confetti' ? (b.confetti as unknown as Record<string, unknown>) : {}).seed);
    expect(normalizeConfetti(values).origin).toBeNull();
  });

  it('timer is text with a timing readout (28% wide), 10 seconds long; progress and waveform follow the whole film', () => {
    const counter = ELEMENT_TILES.find((tile) => tile.key === 'counter.countdown')!;
    expect(counter.seconds).toBe(10);
    expect(counter.layer(canvas)).toMatchObject({
      type: 'text',
      place: { x: 50, y: 50, w: 28 },
      counter: { mode: 'countdown' },
      style: COUNTER_STYLE,
    });
    expect(counter.layer(canvas)).not.toHaveProperty('text');
    const film = ELEMENT_TILES.filter((tile) => tile.seconds === 'film').map((tile) => tile.group);
    expect(film).toHaveLength(24);
    expect(film.every((group) => group === 'progress' || group === 'wave')).toBe(true);
  });

  it('search: by cell name or category name', () => {
    expect(elementSections().map((section) => [section.key, section.tiles.length])).toEqual([
      ['sticker', 10],
      ['dynamic', 10],
      ['shape', 23],
      ['visualizer', 26],
    ]);
    expect(elementSections('粒子').map((section) => [section.key, section.tiles.length])).toEqual([['dynamic', 10]]);
    expect(elementSections('彩带').map((section) => section.tiles.map((tile) => tile.key))).toEqual([['confetti.neon-streamers', 'confetti.curling-ribbons']]);
    expect(elementSections('心形').map((section) => [section.key, section.tiles.length])).toEqual([
      ['sticker', 1],
      ['shape', 2],
    ]);
    expect(elementSections('声波').map((section) => section.tiles.length)).toEqual([10]);
    expect(elementSections('彩虹').map((section) => section.tiles.map((tile) => tile.key))).toEqual([
      ['progress.rainbow_border', 'progress.reverse_rainbow_border', 'progress.snake_rainbow', 'progress.snake_spin_rainbow'],
    ]);
    expect(elementSections('没有这个')).toEqual([]);
    // When a brand-library sticker matches, that section stays; the built-in tiles are still filtered by keyword (none here).
    expect(elementSections('没有这个', ['sticker', 'dynamic']).map((section) => [section.key, section.tiles.length])).toEqual([
      ['sticker', 0],
      ['dynamic', 0],
    ]);
    expect(elementSections('', ['sticker']).map((section) => section.key)).toEqual(['sticker', 'dynamic', 'shape', 'visualizer']);
  });
});

describe('English interface', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('cell names, palette names, section titles and new instance names follow the language (same even if the catalog was first read in Chinese)', () => {
    const rounded = ELEMENT_TILES.find((tile) => tile.key === 'shape.1.rect')!;
    expect(rounded.label).toBe('圆角矩形');
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(rounded.label).toBe('Rounded rectangle');
    expect(rounded.layer({ width: 1920, height: 1080 }).name).toBe('Shape · Rounded rectangle');
    expect(PROGRESS_KINDS.find((kind) => kind.key === 'strobe_border')).toMatchObject({ label: 'Strobe border', colors: ['Color 1', 'Color 2'] });
    expect(SHAPE_CHOICES[0]!.label).toBe('Rectangle');
    expect(ELEMENT_TILES.find((tile) => tile.key === 'counter.countdown')!.label).toBe('Countdown');
    expect(elementSections('shape').map((section) => [section.key, section.title])).toEqual([['shape', 'Shapes']]);
  });
});
