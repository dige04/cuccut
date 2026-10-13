import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ELEMENT_TILES } from '../../model/element-catalog.ts';
import { TEXT_PRESETS } from '../../model/text-presets.ts';
import { RenderPlanner } from '../../render/render-planner.ts';
import { opaqueBounds, thumbSequence } from '../../render/thumbnails.ts';
import { CAPTION_BEAT, captionFrame, captionSample, captionThumb, confettiThumb, layerThumb, lottieMeta, lottieThumb, presetThumb, type ThumbPicture } from './thumb-scenes.ts';

// Thumbnails are drawn by the compiled preview WASM (the same kernel as export); Node has no ImageData, so supply one that holds the pixels.
vi.stubGlobal('ImageData', function (data: Uint8ClampedArray, width: number, height: number) {
  return { data, width, height };
});

const wasm = fileURLToPath(new URL('../../render/generated/preview.wasm', import.meta.url));
const fonts = fileURLToPath(new URL('../../../../../crates/render-raster/assets/fonts/', import.meta.url));
const lottie = fileURLToPath(new URL('../../../../../crates/render-raster/tests/fixtures/lottie/cases/shapes.json', import.meta.url));
const built = existsSync(wasm);
if (!built) console.warn('没有找到预览 WASM，跳过缩略图测试：先运行 npm run build:wasm');

const canvas = { width: 1920, height: 1080 };
let planner: RenderPlanner;

/** Number of opaque pixels in the first picture piece that was pasted onto the cell. */
function opaque(picture: ThumbPicture, index = 0): number {
  const { data } = picture.blits[index]!.image;
  let count = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count++;
  return count;
}

describe('thumbnail scenes', () => {
  it('arranged sequence: one track per layer, starting at 0, stacking order follows the array, with delays and animations removed', () => {
    const sequence = thumbSequence({
      canvas: { width: 160.4, height: 90 },
      layers: [
        { type: 'shape', delayFrames: 9, animate: { enter: {} } },
        { type: 'caption', documentId: 'd' },
      ],
      seconds: 1,
      duration: 2,
    });
    expect(sequence.canvas).toMatchObject({ width: 160, height: 90 });
    expect(sequence.tracks.map((track) => track.kind)).toEqual(['visual', 'subtitle']);
    expect(sequence.items.map((item) => [item.trackId, item.paintOrder, (item as { span?: unknown }).span])).toEqual([
      ['thumb_track_0', 0, { fromFrame: 0, durationFrames: 60 }],
      ['thumb_track_1', 1, { fromFrame: 0, durationFrames: 60 }],
    ]);
    expect(sequence.items[0]).not.toHaveProperty('delayFrames');
    expect(sequence.items[0]).not.toHaveProperty('animate');
  });

  it('Lottie file header: duration and size, null when unreadable', () => {
    expect(lottieMeta(new TextEncoder().encode('{"ip":0,"op":60,"fr":30,"w":200,"h":100}'))).toEqual({
      seconds: 2,
      width: 200,
      height: 100,
    });
    expect(lottieMeta(new TextEncoder().encode('{"ip":0}'))).toBeNull();
    expect(lottieMeta(new TextEncoder().encode('not json'))).toBeNull();
  });
});

describe.skipIf(!built)('thumbnails are drawn by the render kernel', () => {
  beforeAll(async () => {
    planner = await RenderPlanner.instantiate(readFileSync(wasm));
    planner.addFonts(planner.fontFiles().map((file) => new Uint8Array(readFileSync(`${fonts}${file}`))));
  });

  it('element cells: each cell draws something, the box shrinks and centers in the cell', () => {
    for (const tile of ELEMENT_TILES) {
      if (tile.confetti) continue;
      const picture = layerThumb(planner, tile.layer(canvas), canvas, 200, 120);
      expect(opaque(picture), tile.key).toBeGreaterThan(0);
      const { image, target } = picture.blits[0]!;
      const bounds = opaqueBounds(image)!;
      // What is drawn is roughly centered in the cell after it is pasted in, and does not overflow the cell by much (outlines and shadows may extend slightly past the box).
      const sx = target.width / image.width;
      const sy = target.height / image.height;
      const cx = target.x + (bounds.x + bounds.width / 2) * sx;
      const cy = target.y + (bounds.y + bounds.height / 2) * sy;
      expect(Math.abs(cx - 100), tile.key).toBeLessThan(20);
      expect(Math.abs(cy - 60), tile.key).toBeLessThan(20);
      expect(bounds.width * sx, tile.key).toBeLessThan(200 * 1.05);
    }
  });

  it('waveform cells draw with a fake spectrum: no style reports missing spectrum, and the styles draw differently from each other', () => {
    const waves = ELEMENT_TILES.filter((t) => t.group === 'wave').map((tile) => layerThumb(planner, tile.layer(canvas), canvas, 200, 120));
    expect(waves.length).toBeGreaterThan(3);
    for (const picture of waves) expect(picture.problems).toEqual([]);
    expect(new Set(waves.map((picture) => opaque(picture))).size).toBeGreaterThan(waves.length / 2);
  });

  it('confetti cell: the same moment always gives the same image; the picture changes as playback goes on', () => {
    const a = confettiThumb(planner, 'rainbow-paper', 4.5, 160, 160);
    const b = confettiThumb(planner, 'rainbow-paper', 4.5, 160, 160);
    const c = confettiThumb(planner, 'rainbow-paper', 6, 160, 160);
    expect(opaque(a)).toBeGreaterThan(20);
    expect(b.blits[0]!.image.data).toEqual(a.blits[0]!.image.data);
    expect(c.blits[0]!.image.data).not.toEqual(a.blits[0]!.image.data);
  });

  it('subtitle style card: bilingual two lines stacked, when too long the whole thing scales down into the cell, no wrapping', () => {
    const one = captionThumb(planner, {}, ['original'], 26, 320, 132);
    const two = captionThumb(planner, {}, ['original', 'translation'], 26, 320, 132);
    const single = opaqueBounds(one.blits[0]!.image)!;
    const double = opaqueBounds(two.blits[0]!.image)!;
    expect(one.problems).toEqual([]);
    expect(double.height).toBeGreaterThan(single.height * 1.5);
    // With a very large font size, it still fits on one line, scaled down to within 92% of the cell.
    const huge = opaqueBounds(captionThumb(planner, {}, ['original'], 120, 320, 132).blits[0]!.image)!;
    expect(huge.width).toBeLessThanOrEqual(Math.ceil(320 * 0.92) + 2);
    expect(huge.width).toBeGreaterThan(320 * 0.8);
    expect(huge.height).toBeLessThan(single.height * 2.5);
  });

  it('subtitle style card animated: source text one word per beat, a beat of pause after reading; word-by-word animation follows the style\'s own; font size measured in the static state', () => {
    const sample = captionSample(planner, {}, ['original'], 26, 320, 132);
    // English source with three words: one cycle of four beats.
    expect(sample.period).toBeCloseTo(4 * CAPTION_BEAT);
    const at = (seconds: number) => captionFrame(planner, sample, seconds, 320, 132).blits[0]!.image.data;
    // With no per-word animation, the color change drives it: the picture changes when the second word is read, and stays unchanged within the same beat.
    expect(at(0.1)).not.toEqual(at(0.1 + CAPTION_BEAT));
    expect(at(0.1)).toEqual(at(0.4));
    // The still cell freezes at 35% through the second word being read.
    expect(captionThumb(planner, {}, ['original'], 26, 320, 132).blits[0]!.image.data).toEqual(at(1.35 * CAPTION_BEAT));
    // With per-word animation turned off, every frame of the cycle looks the same.
    const none = captionSample(planner, { anim: { name: 'None' } }, ['original'], 26, 320, 132);
    expect(captionFrame(planner, none, 0.1, 320, 132).blits[0]!.image.data).toEqual(
      captionFrame(planner, none, 0.1 + CAPTION_BEAT, 320, 132).blits[0]!.image.data,
    );
    // The drop-in animation makes words grow and shrink: measure the font size without animation, so the same styling scales to the same font size.
    const scale = (root: Record<string, unknown>, px: number) => {
      const style = captionSample(planner, root, ['original'], px, 320, 132).scene.documents![0]!.body as { style: { scale: number } };
      return style.style.scale;
    };
    expect(scale({ anim: { catalogId: 'dropIn' } }, 120)).toBe(scale({}, 120));
    // 120 px does not fit, so it was scaled down; 26 px fits, so it was not scaled.
    expect(scale({}, 120) / scale({}, 26)).toBeLessThan(120 / 26);
  });

  it('brand library Lottie sticker: stops on the middle frame; when played, the picture changes', () => {
    const bytes = new Uint8Array(readFileSync(lottie));
    const still = lottieThumb(planner, 'file://shapes.json', bytes, 0, 120, 120);
    expect(still.problems).toEqual([]);
    expect(opaque(still)).toBeGreaterThan(50);
    const later = lottieThumb(planner, 'file://shapes.json', bytes, 0.4, 120, 120);
    expect(later.blits[0]!.image.data).not.toEqual(still.blits[0]!.image.data);
  });

  it('text preset card: font-sample cards one row per block, scene cards crop the whole frame to the bounding box', () => {
    const stack = TEXT_PRESETS.find((preset) => preset.layout === 'stack')!;
    const rows = stack.layers.filter((layer) => layer.kind === 'text').length;
    const picture = presetThumb(planner, stack, { num: 30, den: 1 }, 2, 360, 200);
    expect(picture.blits).toHaveLength(rows);
    for (const blit of picture.blits) expect(blit.target.width).toBeLessThanOrEqual(360);
    const scene = TEXT_PRESETS.find((preset) => preset.layout !== 'stack')!;
    const framed = presetThumb(planner, scene, { num: 30, den: 1 }, 2, 360, 200);
    expect(framed.blits).toHaveLength(1);
    expect(opaque(framed)).toBeGreaterThan(0);
  });
});
