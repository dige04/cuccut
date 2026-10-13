import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { VideoSnapshot } from '@cuccut/protocol';
import { PlanFailure, RenderPlanner } from './render-planner.ts';

// The WASM compiled from the same fixture video gives a plan byte-identical to native Rust (the gold standard is maintained by `cargo test -p render-graph`).
const wasm = fileURLToPath(new URL('./generated/preview.wasm', import.meta.url));
const fixtures = fileURLToPath(new URL('../../../../crates/render-graph/tests/fixtures/', import.meta.url));
const fonts = fileURLToPath(new URL('../../../../crates/render-raster/assets/fonts/', import.meta.url));
const probeFont = fileURLToPath(new URL('../../../../crates/render-raster/tests/fixtures/fonts/ColrProbe.ttf', import.meta.url));
const built = existsSync(wasm);
if (!built) console.warn('没有找到预览 WASM，跳过一致性测试：先运行 npm run build:wasm');

async function setup(): Promise<{ planner: RenderPlanner; video: VideoSnapshot }> {
  const planner = await RenderPlanner.instantiate(readFileSync(wasm));
  const video = JSON.parse(readFileSync(`${fixtures}video.json`, 'utf8')) as VideoSnapshot;
  planner.setVideo({ sequence: video.sequences[video.rootSequenceId]!, assets: video.assets });
  return { planner, video };
}

describe.skipIf(!built)('frame planner (WASM)', () => {
  it('auto-spacing for mixed Chinese and English subtitles matches the actual pixels of explicit spaces', async () => {
    const { planner, video } = await setup();
    planner.addFonts(planner.fontFiles().map((name) => new Uint8Array(readFileSync(`${fonts}${name}`))));
    const sequence = video.sequences[video.rootSequenceId]!;
    planner.setVideo({
      sequence: {
        ...sequence,
        tracks: [{ id: 'trk_caption', order: 0, kind: 'subtitle', locked: false, visible: true, muted: false, solo: { enabled: false, group: 'visual' } }],
        items: [{
          id: 'item_caption', trackId: 'trk_caption', enabled: true, locked: false, paintOrder: 0,
          followPolicy: { kind: 'sequence-fixed' }, span: { fromFrame: 0, durationFrames: 90 },
          type: 'caption', documentId: 'doc_caption', scopeItemIds: [],
        }],
      },
      assets: {},
    });
    const render = (text: string, lineKind: 'original' | 'translation') => {
      planner.setDocuments([{
        documentId: 'doc_caption', kind: 'caption', lineKind,
        body: { schema: 'cuccut.caption/1', clock: 'sequence', timescale: 1000, cues: [{ id: 'c1', start: 0, end: 3000, text }] },
      }]);
      const result = planner.render(1, 640, 360, { transparent: true });
      expect(result.skipped).toEqual([]);
      expect(result.captionHits).toHaveLength(1);
      return new Uint8ClampedArray(planner.frame());
    };
    for (const kind of ['original', 'translation'] as const) {
      const actual = render('让Claude创建一个Artifact', kind);
      expect(actual.some((byte, i) => i % 4 === 3 && byte > 0)).toBe(true);
      expect(Buffer.from(actual).equals(Buffer.from(render('让 Claude 创建一个 Artifact', kind)))).toBe(true);
    }
  });

  it('byte-identical to the native Rust gold standard', async () => {
    const { planner } = await setup();
    const lines = readFileSync(`${fixtures}plan-golden.txt`, 'utf8').trimEnd().split('\n');
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      const [seconds, json] = line.split('\t') as [string, string];
      expect(planner.planJson(Number(seconds)), `t = ${seconds}`).toBe(json);
    }
  });

  it('layers in the plan are ordered by composition order', async () => {
    const { planner } = await setup();
    const plan = planner.planAt(1.5);
    expect(plan.frame).toBe(45);
    expect(plan.layers.map((layer) => layer.itemId)).toEqual(['item_land_a', 'item_port', 'item_logo']);
    expect(plan.voices.map((voice) => voice.itemId)).toEqual(['item_land_a', 'item_music', 'item_hidden']);
  });

  it('errors carry the engine\'s code; a video that cannot be fed in does not replace the previous one', async () => {
    const { planner, video } = await setup();
    const sequence = video.sequences[video.rootSequenceId]!;
    const failure = (() => {
      try {
        planner.setVideo({ sequence: { ...sequence, tracks: 'oops' as never }, assets: video.assets });
      } catch (error) {
        return error;
      }
    })();
    expect(failure).toBeInstanceOf(PlanFailure);
    expect((failure as PlanFailure).code).toBe('INVALID_VIDEO');
    expect(planner.planAt(0).layers).toHaveLength(1);
    expect(() => planner.planAt(Number.NaN)).toThrow(PlanFailure);
  });

  it('an invalid frame rate is an error, not a trap', async () => {
    const { planner, video } = await setup();
    const sequence = video.sequences[video.rootSequenceId]!;
    planner.setVideo({ sequence: { ...sequence, fps: { num: 0, den: 1 } }, assets: video.assets });
    expect(() => planner.planAt(1)).toThrow(expect.objectContaining({ code: 'INVALID_TIME_VALUE' }));
  });

  it('frame drawing and export share one kernel: drawing happens after font injection, the media layer draws the fed-in picture, the whole frame is opaque', async () => {
    const { planner } = await setup();
    expect(() => planner.render(1.5, 320, 180)).toThrow(expect.objectContaining({ code: 'INVALID_PARAMS' }));
    const files = planner.fontFiles();
    expect(files[0]).toBe('NotoSansSC-Variable.ttf');
    planner.addFonts([new Uint8Array(readFileSync(`${fonts}${files[0]}`))]);

    // A landscape video layer is fed a solid red picture.
    const red = new Uint8Array(64 * 36 * 4).map((_, index) => (index % 4 === 0 || index % 4 === 3 ? 255 : 0));
    planner.setPicture('item_land_a', red, 64, 36);
    const rendered = planner.render(1.5, 320, 180);
    expect(rendered.plan.frame).toBe(45);
    const pixels = planner.frame();
    expect(pixels.length).toBe(320 * 180 * 4);
    let opaque = true;
    let reds = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 255) opaque = false;
      if (pixels[i]! > 200 && pixels[i + 1]! < 40 && pixels[i + 2]! < 40) reds++;
    }
    expect(opaque).toBe(true);
    expect(reds).toBeGreaterThan(320 * 180 * 0.1);

    // A picture with the wrong byte count is an error.
    expect(() => planner.setPicture('item_land_a', red, 10, 10)).toThrow(expect.objectContaining({ code: 'INVALID_PICTURE' }));
  });

  it('media spectrum is computed in a temporary instance; the waveform reports which piece is missing, and after it is fed in, draws from the audio', async () => {
    const { planner, video } = await setup();
    planner.addFonts([new Uint8Array(readFileSync(`${fonts}${planner.fontFiles()[0]}`))]);
    // Synthesized audio: one second of 440 Hz. Stereo takes the average of the two channels, which is the same as feeding the averaged mono signal; the same samples twice give the same bytes.
    const left = Float32Array.from({ length: 48_000 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48_000));
    const right = left.map((v) => v * 0.5);
    const mono = left.map((v, i) => (v + right[i]!) / 2);
    const spectrum = await planner.analyzeAudio([left, right]);
    expect(new TextDecoder().decode(spectrum.subarray(0, 4))).toBe('BCS1');
    expect(spectrum.length).toBe(40 + 60 * 640);
    expect(await planner.analyzeAudio([mono])).toEqual(spectrum);
    await expect(planner.analyzeAudio([new Float32Array(0)])).rejects.toMatchObject({ code: 'INVALID_AUDIO' });

    const sequence = video.sequences[video.rootSequenceId]!;
    const viz = {
      id: 'item_viz',
      trackId: 'trk_g1',
      enabled: true,
      locked: false,
      paintOrder: 9,
      followPolicy: { kind: 'sequence-fixed' },
      type: 'visualizer',
      span: { fromFrame: 0, durationFrames: 60 },
      place: { w: 60 },
      visualizer: { style: 'bars', mainColor: '#FFFFFF', audio: 'asset_music' },
    };
    planner.setVideo({ sequence: { ...sequence, items: [...sequence.items, viz] } as never, assets: video.assets });
    const missing = planner.render(1, 160, 90);
    expect(missing.spectra).toEqual([{ itemId: 'item_viz', asset: { id: 'asset_music', revision: 'rev_1' } }]);
    expect(missing.warnings.some((w) => w.detail.startsWith('item_viz：'))).toBe(true);
    const asset = { id: 'asset_music', revision: 'rev_1' };
    expect(planner.setAudioSpectrum(asset, spectrum)).toBe(true);
    expect(planner.setAudioSpectrum(asset, spectrum)).toBe(false);
    const heard = planner.render(1, 160, 90);
    expect(heard.spectra).toEqual([]);
    expect(heard.warnings.some((w) => w.detail.startsWith('item_viz：'))).toBe(false);
    planner.clearAudioSpectra();
    expect(planner.render(1, 160, 90).spectra).toHaveLength(1);
  });

  it('local fonts: reports the missing families and the faces named; after they are fed in nothing is missing, instances already handed out and those handed out later both have them, the UI keeps no bytes', async () => {
    const { planner, video } = await setup();
    planner.addFonts(planner.fontFiles().map((name) => new Uint8Array(readFileSync(`${fonts}${name}`))));
    const sequence = video.sequences[video.rootSequenceId]!;
    const title = {
      id: 'item_title',
      trackId: 'trk_g1',
      enabled: true,
      locked: false,
      paintOrder: 9,
      followPolicy: { kind: 'sequence-fixed' },
      type: 'text',
      span: { fromFrame: 0, durationFrames: 60 },
      place: { x: 50, y: 50, w: 60 },
      text: 'A',
      style: { fontSize: 60, fontFamily: 'ColrProbe', fontWeight: 700 },
    };
    const withTitle = { sequence: { ...sequence, items: [...sequence.items, title] } as never, assets: video.assets };
    planner.setVideo(withTitle);
    const before = planner.render(1, 160, 90);
    expect(before.fonts).toEqual(['ColrProbe']);
    expect(before.faces).toContainEqual({ family: 'ColrProbe', weight: 700, italic: false });
    const early = await planner.fork();
    early.setVideo(withTitle);
    expect(early.render(1, 160, 90).fonts).toEqual(['ColrProbe']);

    let loads = 0;
    const font = { key: 'probe', load: async () => (loads++, new Uint8Array(readFileSync(probeFont))) };
    expect(planner.addLocalFont(font, new Uint8Array(readFileSync(probeFont)))).toBe(true);
    expect(planner.addLocalFont(font, new Uint8Array(readFileSync(probeFont)))).toBe(false);
    expect(planner.render(1, 160, 90).fonts).toEqual([]);
    // A thumbnail instance split off earlier also receives it (no need to ask again).
    expect(early.render(1, 160, 90).fonts).toEqual([]);
    expect(loads).toBe(0);
    // An instance split off later asks for it again through `load`.
    const late = await planner.fork();
    late.setVideo(withTitle);
    expect(late.render(1, 160, 90).fonts).toEqual([]);
    expect(loads).toBe(1);
  });

  it('text boxes are measured by the kernel: same fonts as drawing text, cannot measure when no fonts are injected', async () => {
    const { planner } = await setup();
    const style = { fontSize: 24, fontWeight: 'bold', lineHeight: 1.2, backgroundColor: '#000000CC', backgroundPadding: 14 };
    const canvas = { width: 1920, height: 1080 };
    // Text cannot be measured without fonts injected.
    expect(() => planner.measureText('输入文字', style, null, canvas)).toThrow(expect.objectContaining({ code: 'INVALID_PARAMS' }));
    planner.addFonts(planner.fontFiles().map((name) => new Uint8Array(readFileSync(`${fonts}${name}`))));
    const one = planner.measureText('输入文字', style, null, canvas);
    expect(one.width).toBeGreaterThan(100);
    const wrapped = planner.measureText('输入文字', style, 60, canvas);
    expect(wrapped.width).toBe(60);
    expect(wrapped.height).toBeGreaterThan(one.height * 1.5);
  });
});

/**
 * A hand-written small module, with only the exports used for measuring text and feeding fonts. When input exceeds 100 bytes, the `bc_measure_text` trap (`unreachable`) fires; otherwise it answers a fixed box.
 * Reloading after a trap does not depend on the compiled preview WASM.
 */
function trappingModule(): WebAssembly.Module {
  const answer = [...new TextEncoder().encode('{"width":12,"height":34}')];
  const uleb = (value: number): number[] => {
    const out: number[] = [];
    do {
      let byte = value & 0x7f;
      value >>>= 7;
      if (value) byte |= 0x80;
      out.push(byte);
    } while (value);
    return out;
  };
  const vec = (items: number[][]): number[] => [...uleb(items.length), ...items.flat()];
  const section = (id: number, body: number[]): number[] => [id, ...uleb(body.length), ...body];
  const name = (text: string): number[] => [...uleb(text.length), ...new TextEncoder().encode(text)];
  const [i32, fn] = [0x7f, 0x60];
  const body = (code: number[]): number[] => [...uleb(code.length + 1), 0, ...code];
  const exported = ['bc_alloc', 'bc_free', 'bc_output_ptr', 'bc_output_len', 'bc_measure_text', 'bc_add_font'];
  return new WebAssembly.Module(
    new Uint8Array([
      ...[0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
      // Types: (i32)→i32, (i32 i32)→(), ()→i32, (i32 i32)→i32
      ...section(
        1,
        vec([
          [fn, 1, i32, 1, i32],
          [fn, 2, i32, i32, 0],
          [fn, 0, 1, i32],
          [fn, 2, i32, i32, 1, i32],
        ]),
      ),
      ...section(3, vec([[0], [1], [2], [2], [3], [3]])),
      ...section(5, vec([[0x00, 1]])),
      ...section(7, vec([[...name('memory'), 0x02, 0], ...exported.map((text, index) => [...name(text), 0x00, index])])),
      ...section(
        10,
        vec([
          body([0x41, ...uleb(1024), 0x0b]), // bc_alloc: fixed at 1024
          body([0x0b]), // bc_free
          body([0x41, 0, 0x0b]), // bc_output_ptr: the answer is at 0
          body([0x41, answer.length, 0x0b]), // bc_output_len
          // bc_measure_text: unreachable when len > 100, otherwise returns 0
          body([0x20, 1, 0x41, 0xe4, 0x00, 0x4a, 0x04, 0x40, 0x00, 0x0b, 0x41, 0, 0x0b]),
          body([0x41, 0, 0x0b]), // bc_add_font: accepts it
        ]),
      ),
      ...section(11, vec([[0, 0x41, 0, 0x0b, ...uleb(answer.length), ...answer]])),
    ]),
  );
}

describe('frame planner reload', () => {
  it('after a trap, throws PLANNER_CRASHED; `recovered()` resolves once the reload is done, `onRecovered` is still called', async () => {
    const planner = await RenderPlanner.instantiate(trappingModule());
    const canvas = { width: 1920, height: 1080 };
    await planner.recovered();
    expect(planner.measureText('字', {}, null, canvas)).toEqual({ width: 12, height: 34 });

    const onRecovered = vi.fn();
    planner.onRecovered = onRecovered;
    const long = '字'.repeat(60);
    expect(() => planner.measureText(long, {}, null, canvas)).toThrow(expect.objectContaining({ code: 'PLANNER_CRASHED' }));
    // Calls made during reloading still throw PLANNER_CRASHED.
    expect(() => planner.measureText('字', {}, null, canvas)).toThrow(expect.objectContaining({ code: 'PLANNER_CRASHED' }));
    let ready = false;
    const waiting = planner.recovered().then(() => {
      ready = true;
      // Those waiting are settled only after `onRecovered`.
      expect(onRecovered).toHaveBeenCalledTimes(1);
    });
    expect(ready).toBe(false);
    await waiting;
    expect(planner.measureText('字', {}, null, canvas)).toEqual({ width: 12, height: 34 });
  });

  it('local fonts keep no bytes: on reload they are requested again via `load` (including those fed in during the request), and it counts as done only after all come back; ones that cannot be obtained are skipped', async () => {
    const planner = await RenderPlanner.instantiate(trappingModule());
    const canvas = { width: 1920, height: 1080 };
    const loads: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const font = (key: string, fail = false) => ({
      key,
      load: async () => {
        loads.push(key);
        await gate;
        if (fail) throw new Error('取不到');
        return new Uint8Array([1, 2, 3]);
      },
    });
    planner.addLocalFont(font('a'), new Uint8Array([1]));
    planner.addLocalFont(font('gone', true), new Uint8Array([1]));
    const onRecovered = vi.fn();
    planner.onRecovered = onRecovered;
    expect(() => planner.measureText('字'.repeat(60), {}, null, canvas)).toThrow(expect.objectContaining({ code: 'PLANNER_CRASHED' }));
    const recovered = planner.recovered();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(loads).toEqual(['a', 'gone']);
    // Anything sent during reloading is only recorded, and requested back together with the reload.
    expect(planner.addLocalFont(font('b'), new Uint8Array([1]))).toBe(true);
    expect(onRecovered).not.toHaveBeenCalled();
    release();
    await recovered;
    expect(loads).toEqual(['a', 'gone', 'b']);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(planner.measureText('字', {}, null, canvas)).toEqual({ width: 12, height: 34 });
  });

  it('reload failure: both the `recovered()` calls already waiting and those that start waiting later reject, so nothing waits forever', async () => {
    const planner = await RenderPlanner.instantiate(trappingModule());
    const canvas = { width: 1920, height: 1080 };
    const instantiate = vi.spyOn(WebAssembly, 'instantiate').mockRejectedValueOnce(new Error('重新实例化失败'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => planner.measureText('字'.repeat(60), {}, null, canvas)).toThrow(expect.objectContaining({ code: 'PLANNER_CRASHED' }));
      await expect(planner.recovered()).rejects.toThrow('重新实例化失败');
      await expect(planner.recovered()).rejects.toThrow('重新实例化失败');
      expect(() => planner.measureText('字', {}, null, canvas)).toThrow(expect.objectContaining({ code: 'PLANNER_CRASHED' }));
      expect(warn).toHaveBeenCalled();
    } finally {
      instantiate.mockRestore();
      warn.mockRestore();
    }
  });
});
