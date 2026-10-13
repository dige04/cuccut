import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GenerationParameters, ModelBundleStatus } from '@cuccut/protocol';
import { BUNDLES } from './bundle-registry.ts';
import { IMAGE_BUNDLES, QWEN_IMAGE_ASPECTS } from './image-bundles.ts';
import { IMAGE_SELF_TEST, imageSelfTestParameters, imageSelfTestVerdict, inspectPng } from './image-self-test.ts';
import { imageRunOf, localImageModelInfo, localImageSeed } from './local-image.ts';
import { ModelCatalog } from './model-catalog.ts';
import { repoManifestFor } from './repo-manifests.ts';

/** Tests for local text-to-image bundle registration, model descriptions, the conversion of frozen parameters, and the self-check verdict (architecture design §6.1, §6.3; Model Worker protocol spec §2.5.3, §4.3). */

type ImageParameters = Extract<GenerationParameters, { capability: 'generateImage' }>;
const QWEN = IMAGE_BUNDLES[0]!;
const QWEN_CANDLE = IMAGE_BUNDLES[1]!;
const GiB = 1024 * 1024 * 1024;

describe('local text-to-image model bundle registration', () => {
  it('the MLX and candle bundles are in the master registry as image bundles; the whole repository is one image component, with a license and a name', () => {
    expect(IMAGE_BUNDLES.map((b) => b.bundleId)).toEqual(['qwen-image-2.1@mlx-4bit', 'qwen-image-2.1@candle']);
    expect(BUNDLES).toContain(QWEN);
    expect(BUNDLES).toContain(QWEN_CANDLE);
    expect(QWEN).toMatchObject({ capability: 'image', backend: 'mlx', device: 'metal', label: 'Qwen-Image-2.1' });
    expect(Object.keys(QWEN.components)).toEqual(['image']);
    expect(QWEN.components.image!.family).toBe(QWEN.image!.family);
    expect(QWEN.license).toMatchObject({ commercialUse: false });
  });

  it('the candle variant reads the same repository revision (dequantised at load), with the same name, license, sizes and steps, differing only in backend and peak', () => {
    expect(QWEN_CANDLE).toMatchObject({ capability: 'image', backend: 'candle', device: 'cpu', label: QWEN.label });
    expect(QWEN_CANDLE.components).toEqual(QWEN.components);
    expect(QWEN_CANDLE.license).toBe(QWEN.license);
    const { peakBytes, devicePeakBytes, ...profile } = QWEN_CANDLE.image!;
    const { peakBytes: mlxPeak, ...mlxProfile } = QWEN.image!;
    expect(profile).toEqual(mlxProfile);
    expect(mlxPeak).toBe(2 * GiB);
    expect(peakBytes).toBe(6 * GiB);
    expect(devicePeakBytes).toEqual({ cuda: 4 * GiB });
  });

  it('built-in manifest: all 20 files have sha256 and size, estimated bytes equal the sum of sizes; the weights, tokenizer tables and scheduler configs for all three stages are present', () => {
    const source = QWEN.components.image!;
    const manifest = repoManifestFor(source.repo, source.revision)!;
    expect(manifest).not.toBeNull();
    expect(manifest.files).toHaveLength(20);
    let total = 0;
    for (const file of manifest.files) {
      expect(file.sha256, file.path).toMatch(/^[0-9a-f]{64}$/);
      expect(file.size, file.path).toBeGreaterThan(0);
      total += file.size!;
    }
    expect(manifest.estimatedBytes).toBe(total);
    const paths = manifest.files.map((f) => f.path);
    for (const required of [
      'processor/tokenizer.json',
      'scheduler/scheduler_config.json',
      'text_encoder/model.safetensors',
      'transformer/model.safetensors',
      'vae/model.safetensors',
      'vae/config.json',
    ]) {
      expect(paths).toContain(required);
    }
  });

  it('every listed size follows the Worker\'s rules: a multiple of 32, long side at most 1536, long-to-short ratio at most 3; the first is 1:1', () => {
    expect(QWEN.image!.aspects).toBe(QWEN_IMAGE_ASPECTS);
    expect(QWEN_IMAGE_ASPECTS[0]).toEqual({ ratio: '1:1', size: '1024x1024' });
    for (const { size } of [...QWEN_IMAGE_ASPECTS, { size: `${IMAGE_SELF_TEST.width}x${IMAGE_SELF_TEST.height}` }]) {
      const [w, h] = size.split('x').map(Number) as [number, number];
      expect(w % 32, size).toBe(0);
      expect(h % 32, size).toBe(0);
      expect(Math.max(w, h), size).toBeLessThanOrEqual(1536);
      expect(Math.max(w, h) / Math.min(w, h), size).toBeLessThanOrEqual(3);
    }
  });

  describe('statuses in the directory', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-image-bundles-'));
    });
    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('on Apple Silicon only MLX bundles are listed, and a missing one is not-installed; other platforms list only candle bundles; an MLX bundle registered directly is error / unsupported', async () => {
      const mac = new ModelCatalog({ root: dir, platform: 'darwin', arch: 'arm64', workerAvailable: () => true });
      expect(
        mac
          .definitions()
          .filter((d) => d.capability === 'image')
          .map((d) => d.bundleId),
      ).toEqual([QWEN.bundleId]);
      expect(await mac.status(QWEN.bundleId)).toMatchObject({ capability: 'image', state: 'not-installed', label: 'Qwen-Image-2.1' });
      expect(await mac.status(QWEN_CANDLE.bundleId)).toBeNull();
      for (const [platform, arch] of [
        ['win32', 'x64'],
        ['linux', 'x64'],
        ['linux', 'arm64'],
        ['darwin', 'x64'],
      ] as const) {
        const other = new ModelCatalog({ root: dir, platform, arch, workerAvailable: () => true });
        expect(
          other
            .definitions()
            .filter((d) => d.capability === 'image')
            .map((d) => d.bundleId),
          `${platform}/${arch}`,
        ).toEqual([QWEN_CANDLE.bundleId]);
        expect(await other.status(QWEN.bundleId), `${platform}/${arch}`).toBeNull();
        expect(await other.status(QWEN_CANDLE.bundleId), `${platform}/${arch}`).toMatchObject({
          capability: 'image',
          state: 'not-installed',
          backend: 'candle',
          device: 'cpu',
        });
      }
      const forced = new ModelCatalog({ root: dir, platform: 'win32', arch: 'x64', workerAvailable: () => true, bundles: IMAGE_BUNDLES });
      expect(await forced.status(QWEN.bundleId)).toMatchObject({ state: 'error', reason: 'unsupported' });
    });

    it('the Worker\'s peak is pooled by the registered peakBytes and the device: MLX counts GPU memory, candle counts memory on CPU and GPU memory on CUDA', async () => {
      const mac = new ModelCatalog({ root: dir, platform: 'darwin', arch: 'arm64', workerAvailable: () => true });
      mac.setWorkerDevice('candle', 'cuda');
      // Resident-size estimates for recognition (including candle's per-device conversion) do not apply to text-to-image bundles.
      expect(await mac.workerFootprint(QWEN.bundleId)).toBeNull();
      expect(await mac.workerWeightBytes(QWEN.bundleId)).toBeNull();
      expect(mac.definition(QWEN.bundleId)!.image!.peakBytes).toBe(2 * GiB);
      expect(mac.imagePeak(QWEN.bundleId)).toEqual({ bytes: 2 * GiB, pool: 'gpuMemory' });
      expect(mac.imagePeak('qwen3-asr-0.6b@mlx-4bit')).toBeNull();
      expect(mac.imagePeak('no-such-bundle')).toBeNull();

      const win = new ModelCatalog({ root: dir, platform: 'win32', arch: 'x64', workerAvailable: () => true });
      expect(await win.workerFootprint(QWEN_CANDLE.bundleId)).toBeNull();
      expect(win.imagePeak(QWEN_CANDLE.bundleId)).toEqual({ bytes: QWEN_CANDLE.image!.peakBytes, pool: 'memory' });
      win.setWorkerDevice('candle', 'cuda');
      expect(win.imagePeak(QWEN_CANDLE.bundleId)).toEqual({ bytes: QWEN_CANDLE.image!.devicePeakBytes!.cuda, pool: 'gpuMemory' });
      expect((await win.status(QWEN_CANDLE.bundleId))!.device).toBe('cuda');
      win.setWorkerDevice('candle', null);
      expect(win.imagePeak(QWEN_CANDLE.bundleId)!.pool).toBe('memory');
    });
  });
});

describe('model description and frozen parameters', () => {
  const status = { detail: undefined } as unknown as ModelBundleStatus;

  it('one image at a time, PNG output only, no reference images, accepts seed, free; sizes and aspect ratios come from the bundle, and the hint gives the expected time', () => {
    const info = localImageModelInfo(QWEN, status, true);
    expect(info).toMatchObject({
      modelId: QWEN.bundleId,
      label: 'Qwen-Image-2.1',
      sizes: [...QWEN_IMAGE_ASPECTS.map((a) => a.size), '512x512'],
      aspectRatios: QWEN_IMAGE_ASPECTS,
      defaultSize: '1024x1024',
      maxCount: 1,
      maxPromptChars: 1024,
      formats: ['png'],
      defaultFormat: 'png',
      referenceImages: null,
      acceptsSeed: true,
      cost: 'free-local',
      available: true,
    });
    expect(info.notes).toContain('20 步');
    // The 512² trial size is accepted in addition and is not part of the aspect ratios. The step range is given by the model description.
    expect(info.sizes).toContain('512x512');
    expect(info.aspectRatios.map((a) => a.size)).not.toContain('512x512');
    expect(info.local).toEqual({ steps: { min: 8, max: 40, step: 4, default: 20 } });
  });

  it('candle on CPU honestly warns it can take hours; when the Worker reports CUDA it behaves like MLX', () => {
    const cpu = { device: 'cpu', detail: undefined } as unknown as ModelBundleStatus;
    const cuda = { device: 'cuda', detail: undefined } as unknown as ModelBundleStatus;
    expect(localImageModelInfo(QWEN_CANDLE, cpu, true).notes).toContain('CPU');
    expect(localImageModelInfo(QWEN_CANDLE, cpu, true).notes).toContain('几个小时');
    expect(localImageModelInfo(QWEN_CANDLE, cuda, true).notes).toBe(localImageModelInfo(QWEN, status, true).notes);
  });

  it('seed: used when given; otherwise an integer in 0..2^32-1 is drawn', () => {
    expect(localImageSeed(0)).toBe(0);
    expect(localImageSeed(4_294_967_295)).toBe(4_294_967_295);
    for (let i = 0; i < 20; i++) {
      const seed = localImageSeed(null);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });

  it('frozen parameters to job.run options: split width and height; steps only from the self-test; an unfrozen size or seed is the caller\'s error', () => {
    const parameters: ImageParameters = {
      capability: 'generateImage',
      prompt: 'p',
      size: '1024x576',
      aspectRatio: '16:9',
      count: 1,
      format: 'png',
      seed: 9,
    };
    expect(imageRunOf(parameters)).toEqual({ prompt: 'p', width: 1024, height: 576, steps: null, seed: 9 });
    expect(imageRunOf(imageSelfTestParameters(), IMAGE_SELF_TEST.steps)).toEqual({
      prompt: IMAGE_SELF_TEST.prompt,
      width: 256,
      height: 256,
      steps: 4,
      seed: 7,
    });
    // When steps are frozen, the frozen value is used.
    expect(imageRunOf({ ...parameters, steps: 12 })).toMatchObject({ steps: 12 });
    expect(() => imageRunOf({ ...parameters, size: null })).toThrow();
    expect(() => imageRunOf({ ...parameters, seed: null })).toThrow();
  });
});

/** Encodes an 8-bit PNG using the given per-row filter type. */
function png(width: number, height: number, channels: 3 | 4, pixel: (x: number, y: number) => number[], filters: number[]): Buffer {
  const stride = width * channels;
  const rows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) row.push(...pixel(x, y));
    rows.push(row);
  }
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    const filter = filters[y % filters.length]!;
    raw.push(filter);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? rows[y]![i - channels]! : 0;
      const b = y > 0 ? rows[y - 1]![i]! : 0;
      const c = i >= channels && y > 0 ? rows[y - 1]![i - channels]! : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][filter]!;
      raw.push((rows[y]![i]! - predictor) & 0xff);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(raw))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('image self-check verdicts', () => {
  const gradient = (x: number, y: number) => [x * 8, y * 8, (x * y) & 0xff, 255];

  it('all five row filters decode to the same pixels: a gradient image passes, with size and colour count reported accurately', () => {
    const counts = new Set<number>();
    for (const filters of [[0], [1], [2], [3], [4], [0, 1, 2, 3, 4]]) {
      const parsed = inspectPng(png(32, 32, 4, gradient, filters));
      expect(parsed, JSON.stringify(filters)).toMatchObject({ ok: true, png: { width: 32, height: 32 } });
      if (parsed.ok) counts.add(parsed.png.distinct);
    }
    expect(counts.size).toBe(1);
    expect([...counts][0]).toBeGreaterThan(16);
    expect(
      imageSelfTestVerdict(
        png(32, 32, 3, (x, y) => [x * 8, y * 8, 0], [4]),
        { width: 32, height: 32 },
      ),
    ).toMatchObject({
      passed: true,
    });
  });

  it('solid colour, wrong size, not a PNG, corrupt pixel data: fails with the reason stated', () => {
    expect(
      imageSelfTestVerdict(
        png(32, 32, 4, () => [10, 20, 30, 255], [1]),
        { width: 32, height: 32 },
      ),
    ).toMatchObject({
      passed: false,
      problem: expect.stringContaining('纯色'),
    });
    expect(imageSelfTestVerdict(png(32, 16, 4, gradient, [0]), { width: 32, height: 32 })).toMatchObject({
      passed: false,
      problem: expect.stringContaining('32×16'),
    });
    expect(imageSelfTestVerdict(Buffer.from('RIFF....WAVE'))).toMatchObject({
      passed: false,
      problem: expect.stringContaining('不是 PNG'),
    });
    const broken = png(32, 32, 4, gradient, [0]);
    const idat = broken.indexOf('IDAT');
    broken.fill(0, idat + 4, idat + 12);
    expect(imageSelfTestVerdict(broken, { width: 32, height: 32 })).toMatchObject({ passed: false });
  });
});
