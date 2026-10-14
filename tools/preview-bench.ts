// Frame-by-frame benchmark of the preview kernel (optional check in the dev workflow §2): in Node, using the compiled preview WASM (the same `RenderPlanner` as the editor), render N frames in a row,
// recording time per stage: computing the plan (planAt), sending the picture (setPicture, including premultiplication), drawing the frame (bc_render, which includes computing the plan again inside the WASM and the result JSON), and fetching the frame (copying it out of WASM memory, equivalent to the one copy putImageData makes). Then ablate per layer (disable one layer, or turn captions off and redraw) to get each layer's rasterization cost.
//
// Scenes:
// - By default, a synthetic scene taken from the parity fixture (`crates/frame-render/tests/fixtures/parity.json`; the picture is vertical bars), scaled up and drawn at `--size`;
// - `--video <video directory>` (repeatable): local videos (copies only), frozen via the engine host's `videos.open` and `exports.plan`. The video layer's source pictures are decoded by ffmpeg (sized to the preview's pixel-read size, looping over a short segment); captions and transcript are sent as frozen in the export. Run `cargo build -p engine-host` first.
//
// Usage: node tools/preview-bench.ts [--video <directory>]... [--at <seconds>] [--frames 60] [--size 1920x1080,960x540]
//       [--playback] (draws another set using the size rule for preview playback) [--wasm <preview WASM>]... [--no-ablate] [--json <output file>]
// When `--wasm` is given two or more times, frames are drawn in turn (same scene, same size), to compare before and after a change. When the machine is busy, absolute values drift, but ratios from alternating draws are still reliable.
// The output records the load at the time (loadavg and core count).
// Environment: CARGO_TARGET_DIR (to find engine-host), CUCCUT_FFMPEG / CUCCUT_FFPROBE (default to ffmpeg and ffprobe on PATH).

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { RenderPlanner, type FrozenDocument } from '../packages/ui/src/render/render-planner.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WASM = join(ROOT, 'packages/ui/src/render/generated/preview.wasm');
const FONTS = join(ROOT, 'crates/render-raster/assets/fonts');
const FIXTURE = join(ROOT, 'crates/frame-render/tests/fixtures/parity.json');
const FFMPEG = process.env.CUCCUT_FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.CUCCUT_FFPROBE ?? 'ffprobe';

interface Options {
  videos: string[];
  at: number | null;
  frames: number;
  sizes: { width: number; height: number }[];
  playback: boolean;
  json: string | null;
  ablate: boolean;
  wasms: string[];
}

function parseOptions(argv: string[]): Options {
  const options: Options = { videos: [], at: null, frames: 60, sizes: [], playback: false, json: null, ablate: true, wasms: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--video') options.videos.push(resolve(argv[++i]!));
    else if (arg === '--at') options.at = Number(argv[++i]);
    else if (arg === '--frames') options.frames = Number(argv[++i]);
    else if (arg === '--size')
      options.sizes = argv[++i]!.split(',').map((size) => {
        const [width, height] = size.split('x').map(Number);
        return { width: width!, height: height! };
      });
    else if (arg === '--playback') options.playback = true;
    else if (arg === '--no-ablate') options.ablate = false;
    else if (arg === '--json') options.json = resolve(argv[++i]!);
    else if (arg === '--wasm') options.wasms.push(resolve(argv[++i]!));
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

/** One benchmark scene: the video, the document, the asset bytes, and each layer's source picture for every frame. */
interface Scene {
  name: string;
  fps: number;
  canvas: { width: number; height: number };
  start: number;
  video: { sequence: any; assets: Record<string, any> };
  documents: FrozenDocument[];
  assets: { asset: { id: string; revision: string }; bytes: Uint8Array }[];
  audioSpectra: { asset: { id: string; revision: string }; bytes: Uint8Array }[];
  /** The asset's file (the waveform needs the asset's spectrum, computed from its audio); none for synthetic scenes. */
  file?(asset: { id: string; revision: string }): string | null;
  /** A layer's source picture: frame `index`, instance, and output size → RGBA. */
  picture(itemId: string, kind: string, asset: { id: string; revision: string }, index: number, seconds: number, out: Size): Picture | null;
  close(): void;
}

interface Size {
  width: number;
  height: number;
}

interface Picture {
  rgba: Uint8Array;
  width: number;
  height: number;
}

// ---------- Synthetic scene ----------

type Rgba = [number, number, number, number];

function bands(width: number, height: number, colours: Rgba[]): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const row = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) row.set(colours[Math.floor((x * colours.length) / width)]!, x * 4);
  for (let y = 0; y < height; y++) out.set(row, y * width * 4);
  return out;
}

/**
 * Synthetic scene: the scene is picked from the fixture by name, and its instances and documents are merged into one sequence (merged directly when the scenes' tracks and instance IDs do not clash). The picture is vertical bars.
 * The video layer's source picture is given at 1920×1080 (the same upload size as real 1080p footage).
 */
function syntheticScenes(): Scene[] {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const byName = new Map<string, any>(fixture.scenes.map((scene: any) => [scene.name, scene]));
  const merge = (name: string, parts: string[]): Scene => {
    const scenes = parts.map((part) => {
      const scene = byName.get(part);
      if (!scene) throw new Error(`no scene ${part} in the fixture`);
      return scene;
    });
    const base = structuredClone(scenes[0].video.sequences[fixture.sequenceId]);
    const assets: Record<string, any> = { ...scenes[0].video.assets };
    for (const scene of scenes.slice(1)) {
      const sequence = scene.video.sequences[fixture.sequenceId];
      for (const track of sequence.tracks ?? []) if (!base.tracks.some((t: any) => t.id === track.id)) base.tracks.push(track);
      for (const item of sequence.items) if (!base.items.some((i: any) => i.id === item.id)) base.items.push(item);
      if (sequence.animationBindings?.length) base.animationBindings = [...(base.animationBindings ?? []), ...sequence.animationBindings];
      Object.assign(assets, scene.video.assets);
    }
    const pictures = new Map<string, { width: number; height: number; bands: Rgba[] }>();
    for (const scene of scenes) for (const picture of scene.pictures) pictures.set(picture.itemId, picture);
    const big = new Map<string, Picture>();
    return {
      name,
      fps: fixture.fps,
      canvas: { width: base.canvas.width, height: base.canvas.height },
      start: 0,
      video: { sequence: base, assets },
      documents: scenes.flatMap((scene) => scene.documents),
      assets: scenes.flatMap((scene) =>
        scene.assets.map((asset: any) => {
          const [id, revision] = asset.key.split('@');
          const bytes = asset.hex === undefined ? new TextEncoder().encode(asset.text) : new Uint8Array(Buffer.from(asset.hex, 'hex'));
          return { asset: { id, revision }, bytes };
        }),
      ),
      audioSpectra: scenes.flatMap((scene) =>
        scene.audioSpectra.map((spectrum: any) => {
          const [id, revision] = spectrum.key.split('@');
          return { asset: { id, revision }, bytes: new Uint8Array(Buffer.from(spectrum.hex, 'hex')) };
        }),
      ),
      picture(itemId, _kind, _asset, _index, _seconds, out) {
        const source = pictures.get(itemId);
        if (!source) return null;
        // Preview pixel-read rule: never larger than the output; scaled down to cover the output (the source is treated as 16:9 1080p).
        const fit = Math.min(1, Math.max(out.width / 1920, out.height / 1080));
        const width = Math.max(1, Math.round(1920 * fit));
        const height = Math.max(1, Math.round(1080 * fit));
        const key = `${itemId}:${width}x${height}`;
        if (!big.has(key)) big.set(key, { rgba: bands(width, height, source.bands), width, height });
        return big.get(key)!;
      },
      close() {},
    };
  };
  return [
    merge('composite: video + bilingual captions', ['video-source-time', 'captions-bilingual']),
    merge('composite: video + mixed elements', [
      'video-source-time',
      'text-styled',
      'shape-rounded',
      'progress',
      'counter',
      'visualizer-spectrum',
      'sticker-lottie',
      'captions-studio',
    ]),
  ];
}

// ---------- Local video (copies) ----------

class EngineHost {
  readonly #child;
  readonly #pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  #next = 1;
  constructor(binary: string) {
    this.#child = spawn(binary, [], { env: { ...process.env, CUCCUT_FFPROBE: FFPROBE }, stdio: ['pipe', 'pipe', 'inherit'] });
    createInterface({ input: this.#child.stdout! }).on('line', (line) => {
      const message = JSON.parse(line);
      const waiting = message.id == null ? undefined : this.#pending.get(message.id);
      if (!waiting) return;
      this.#pending.delete(message.id);
      if (message.error) waiting.reject(new Error(`${message.error.code} ${message.error.message}`));
      else waiting.resolve(message.result);
    });
  }
  request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = this.#next++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#child.stdin!.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }
  close(): void {
    this.#child.stdin!.end();
  }
}

const probed = new Map<string, Size>();

/** The display size of the source (width and height after rotation), remembered per path: it is needed every frame, so an ffprobe must not be started each time. */
function probe(file: string): Size {
  const known = probed.get(file);
  if (known) return known;
  const result = spawnSync(
    FFPROBE,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  const stream = JSON.parse(result.stdout).streams[0];
  const rotation = Math.abs(Number(stream.side_data_list?.find((d: any) => d.rotation !== undefined)?.rotation ?? 0));
  const size =
    rotation === 90 || rotation === 270 ? { width: stream.height, height: stream.width } : { width: stream.width, height: stream.height };
  probed.set(file, size);
  return size;
}

/** Decodes `count` frames starting at `seconds`, scaled to `width`×`height` RGBA. */
function decodeRun(file: string, seconds: number, count: number, width: number, height: number): Uint8Array[] {
  const result = spawnSync(
    FFMPEG,
    [
      '-v',
      'error',
      '-ss',
      seconds.toFixed(3),
      '-i',
      file,
      '-frames:v',
      String(count),
      '-vf',
      `scale=${width}:${height}`,
      '-an',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      'pipe:1',
    ],
    { maxBuffer: 4 * 1024 * 1024 * 1024 },
  );
  const size = width * height * 4;
  const frames: Uint8Array[] = [];
  for (let offset = 0; offset + size <= result.stdout.length; offset += size)
    frames.push(new Uint8Array(result.stdout.subarray(offset, offset + size)));
  return frames;
}

/** Decodes the asset's sound to 48 kHz mono f32 (the preview decodes it with Web Audio and sends it into the same analysis). */
function decodeAudio(file: string): Float32Array {
  const result = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1'], {
    maxBuffer: 4 * 1024 * 1024 * 1024,
  });
  const bytes = result.stdout;
  return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 4)).slice();
}

/** Real-video waveforms: draw one frame to see which asset spectra are missing, then compute them the way the preview does and put them into the scene. Without this, waveforms are drawn static and cannot be measured. */
async function addAudioSpectra(base: RenderPlanner, scene: Scene): Promise<void> {
  if (!scene.file) return;
  const planner = await prepare(base, scene);
  const wanted = new Map<string, { id: string; revision: string }>();
  for (let seconds = scene.start; seconds < scene.start + 2; seconds += 0.5) {
    for (const { asset } of planner.render(seconds, 64, 36).spectra) wanted.set(`${asset.id}@${asset.revision}`, asset);
  }
  for (const asset of wanted.values()) {
    const file = scene.file(asset);
    if (!file) continue;
    scene.audioSpectra.push({ asset, bytes: await base.analyzeAudio([decodeAudio(file)]) });
  }
}

async function videoScene(host: EngineHost, dir: string, at: number | null, frames: number): Promise<Scene> {
  const opened = await host.request<any>('videos.open', { path: dir });
  const snapshot = opened.snapshot;
  const sequence = snapshot.sequences[snapshot.rootSequenceId];
  const rate = sequence.fps;
  const fps = rate.num / rate.den;
  const plan = await host.request<any>('exports.plan', { videoId: opened.videoId, kind: 'video' });
  await host.request('videos.close', { videoId: opened.videoId });
  const frozen = plan.document.sequences[plan.sequenceId];
  const paths = new Map<string, any>(plan.assets.map((a: any) => [`${a.assetId}@${a.revision}`, a]));
  const assets: Scene['assets'] = [];
  for (const asset of plan.assets) {
    const type = asset.mediaType ?? '';
    if (/json|lottie|svg|gif/.test(type) || /\.(json|lottie|svg|gif)$/i.test(asset.path)) {
      assets.push({ asset: { id: asset.assetId, revision: asset.revision }, bytes: new Uint8Array(readFileSync(asset.path)) });
    }
  }
  const canvas = { width: frozen.canvas.width, height: frozen.canvas.height };
  const decoded = new Map<string, Uint8Array[]>();
  const stills = new Map<string, Picture>();
  // Number of frames the source picture loops over: the real decoded content has little effect on rasterization cost, so not every frame needs to be held in memory.
  const run = Math.min(frames, 24);
  return {
    name: dir.split('/').pop()!,
    fps,
    canvas,
    start: at ?? 0,
    video: { sequence: frozen, assets: plan.document.assets },
    documents: plan.documents,
    assets,
    audioSpectra: [],
    file: (asset) => paths.get(`${asset.id}@${asset.revision}`)?.path ?? null,
    picture(itemId, kind, asset, index, seconds, out) {
      const entry = paths.get(`${asset.id}@${asset.revision}`);
      if (!entry) return null;
      const size = probe(entry.path);
      const fit = Math.min(1, Math.max(out.width / size.width, out.height / size.height));
      const width = Math.max(2, Math.round(size.width * fit));
      const height = Math.max(2, Math.round(size.height * fit));
      if (kind === 'image') {
        const key = `${itemId}:${width}x${height}`;
        if (!stills.has(key)) stills.set(key, { rgba: decodeRun(entry.path, 0, 1, width, height)[0]!, width, height });
        return stills.get(key)!;
      }
      const key = `${itemId}:${width}x${height}`;
      if (!decoded.has(key)) decoded.set(key, decodeRun(entry.path, seconds, run, width, height));
      const list = decoded.get(key)!;
      if (list.length === 0) return null;
      return { rgba: list[index % list.length]!, width, height };
    },
    close() {},
  };
}

// ---------- Timing ----------

interface Stages {
  plan: number[];
  upload: number[];
  render: number[];
  readback: number[];
  total: number[];
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function summary(values: number[]): { p50: number; p95: number; max: number } {
  const round = (value: number) => Math.round(value * 100) / 100;
  return { p50: round(quantile(values, 0.5)), p95: round(quantile(values, 0.95)), max: round(Math.max(0, ...values)) };
}

async function prepare(base: RenderPlanner, scene: Scene): Promise<RenderPlanner> {
  const planner = await base.fork();
  planner.setVideo(scene.video);
  planner.setDocuments(scene.documents);
  for (const { asset, bytes } of scene.assets) planner.setAsset(asset, bytes);
  for (const { asset, bytes } of scene.audioSpectra) planner.setAudioSpectrum(asset, bytes);
  return planner;
}

/** Draws one frame with the same WASM calls as a frame in the preview engine (compute plan, send picture, draw, fetch frame), and returns the time for each stage. */
function frame(planner: RenderPlanner, scene: Scene, index: number, seconds: number, size: Size, captions = true) {
  const t0 = performance.now();
  const plan = planner.planAt(seconds);
  const t1 = performance.now();
  planner.clearPictures();
  const layers = plan.layers.flatMap((layer: any) => (layer.transition?.partner ? [layer, layer.transition.partner] : [layer]));
  for (const layer of layers) {
    if (layer.kind !== 'video' && layer.kind !== 'image') continue;
    const picture = scene.picture(layer.itemId, layer.kind, layer.asset, index, layer.sourceSeconds ?? 0, size);
    if (picture) planner.setPicture(layer.itemId, picture.rgba, picture.width, picture.height);
  }
  const t2 = performance.now();
  const rendered = planner.render(seconds, size.width, size.height, { captions });
  const t3 = performance.now();
  const pixels = new Uint8ClampedArray(planner.frame());
  const t4 = performance.now();
  return { plan: t1 - t0, upload: t2 - t1, render: t3 - t2, readback: t4 - t3, total: t4 - t0, layers, rendered, pixels };
}

/** Without `--at`, start from the moment with the most layers (checks the plan every 0.25 seconds, looking at most 20 minutes in). */
async function busiest(base: RenderPlanner, scene: Scene): Promise<number> {
  const planner = await prepare(base, scene);
  let best = { seconds: 0, layers: -1 };
  for (let seconds = 0; seconds < 1200; seconds += 0.25) {
    let plan;
    try {
      plan = planner.planAt(seconds);
    } catch {
      break;
    }
    if (plan.layers.length === 0 && plan.voices.length === 0 && seconds > 0) break;
    const layers = plan.layers.length + plan.layers.filter((layer: any) => layer.transition?.partner).length;
    if (layers > best.layers) best = { seconds, layers };
  }
  return best.seconds;
}

/** One preview WASM: a label (the file name) and a planner with its fonts loaded. */
interface Kernel {
  label: string;
  base: RenderPlanner;
}

/**
 * Measures the time for one scene at one size: each WASM first draws its first frame (recorded separately), then the frames are drawn in turn for `frames` frames, and finally ablation is done per layer.
 * Drawing in turn means the machine's load affects every WASM equally.
 */
async function measure(kernels: Kernel[], scene: Scene, size: Size, frames: number, ablate: boolean) {
  const runs = [];
  for (const kernel of kernels) {
    const planner = await prepare(kernel.base, scene);
    // Warm-up: build the typesetting engine, compile the captions, decode Lottie. The first frame is recorded separately, and only the part the kernel draws is timed, not fetching the picture.
    const firstMs = frame(planner, scene, 0, scene.start, size).render;
    runs.push({
      kernel,
      planner,
      firstMs,
      layerCount: 0,
      stages: { plan: [], upload: [], render: [], readback: [], total: [] } as Stages,
    });
  }
  for (let i = 0; i < frames; i++) {
    const seconds = scene.start + i / scene.fps;
    for (const run of runs) {
      const result = frame(run.planner, scene, i, seconds, size);
      for (const key of ['plan', 'upload', 'render', 'readback', 'total'] as const) run.stages[key].push(result[key]);
      run.layerCount = Math.max(run.layerCount, result.layers.length);
    }
  }
  const results = [];
  for (const run of runs) {
    // Switching between play and pause: first draw one frame at a different size (a downscaled resolution), then switch back to this size and draw the same frame; take the median of three.
    const other = {
      width: Math.max(2, Math.round((size.width * 0.73) / 2) * 2),
      height: Math.max(2, Math.round((size.height * 0.73) / 2) * 2),
    };
    const middle = Math.floor(frames / 2);
    const mid = scene.start + middle / scene.fps;
    // The first draw at a different size (the first play after pausing): that size's renderer is still empty.
    const newSizeMs = frame(run.planner, scene, middle, mid, other).render;
    const switches: number[] = [];
    for (let k = 0; k < 3; k++) {
      frame(run.planner, scene, middle, mid, other);
      switches.push(frame(run.planner, scene, middle, mid, size).total);
    }
    // Ablation: at a middle moment, disable each layer in turn (the caption layer uses a switch), draw several times and take the median; the difference is that layer's rasterization cost.
    const layers: Record<string, number> = {};
    if (ablate) {
      const { planner } = run;
      const median = (once: () => number) => quantile([once(), once(), once(), once(), once()], 0.5);
      const full = median(() => frame(planner, scene, middle, mid, size).render);
      const plan = planner.planAt(mid);
      const captions = plan.layers.some((layer: any) => layer.kind === 'caption');
      if (captions) layers['captions'] = full - median(() => frame(planner, scene, middle, mid, size, false).render);
      for (const layer of plan.layers) {
        if (layer.kind === 'caption') continue;
        const sequence = structuredClone(scene.video.sequence);
        const item = sequence.items.find((candidate: any) => candidate.id === layer.itemId);
        if (!item) continue;
        item.enabled = false;
        const ablated = await prepare(run.kernel.base, { ...scene, video: { sequence, assets: scene.video.assets } });
        frame(ablated, scene, middle, mid, size);
        const without = median(() => frame(ablated, scene, middle, mid, size).render);
        const label = `${layer.kind}${layer.kind === 'generator' ? `:${(layer as any).content.generator.replace('cuccut.', '')}` : ''}:${layer.itemId.slice(0, 6)}`;
        layers[label] = Math.round((full - without) * 100) / 100;
      }
      layers['(whole frame)'] = Math.round(full * 100) / 100;
    }
    results.push({
      scene: scene.name,
      kernel: run.kernel.label,
      start: scene.start,
      size: `${size.width}x${size.height}`,
      fps: Math.round(scene.fps * 100) / 100,
      layers: run.layerCount,
      firstFrameMs: Math.round(run.firstMs),
      newSizeMs: Math.round(newSizeMs),
      switchMs: Math.round(quantile(switches, 0.5) * 10) / 10,
      load: load(),
      stages: Object.fromEntries(Object.entries(run.stages).map(([key, values]) => [key, summary(values)])),
      perLayer: layers,
    });
  }
  return results;
}

/** Current load: the 1-minute loadavg and the core count. Absolute values are not trustworthy when above the core count; look only at the ratios from alternating draws. */
function load(): string {
  return `${loadavg()[0]!.toFixed(1)}/${cpus().length}`;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const wasms = options.wasms.length > 0 ? options.wasms : [WASM];
  const kernels: Kernel[] = [];
  for (const wasm of wasms) {
    if (!existsSync(wasm)) throw new Error(`missing ${wasm}: run npm run build:wasm first`);
    const base = await RenderPlanner.instantiate(readFileSync(wasm));
    base.addFonts(base.fontFiles().map((name) => new Uint8Array(readFileSync(join(FONTS, name)))));
    kernels.push({ label: wasm.split('/').pop()!, base });
  }

  const scenes: Scene[] = [];
  let host: EngineHost | null = null;
  if (options.videos.length > 0) {
    const target = process.env.CARGO_TARGET_DIR ?? join(ROOT, 'target');
    const binary = join(target, 'debug/engine-host');
    if (!existsSync(binary)) throw new Error(`missing ${binary}: run cargo build -p engine-host first`);
    // The engine host's Home is placed in a temp directory, so the real application data is not touched.
    const home = mkdtempSync(join(tmpdir(), 'cuccut-preview-bench-'));
    process.env.CUCCUT_HOME = home;
    host = new EngineHost(binary);
    for (const dir of options.videos) scenes.push(await videoScene(host, dir, options.at, options.frames));
    host.close();
    rmSync(home, { recursive: true, force: true });
  } else scenes.push(...syntheticScenes());

  const results = [];
  for (const scene of scenes) {
    if (options.at === null) scene.start = await busiest(kernels[0]!.base, scene);
    await addAudioSpectra(kernels[0]!.base, scene);
    const sizes = options.sizes.length > 0 ? [...options.sizes] : [scaled(scene.canvas, 1080), scaled(scene.canvas, 540)];
    if (options.playback) {
      // Preview playback size: the tier computed from a typical editor canvas (about 960 CSS pixels wide, at 2× pixel ratio).
      const display = { width: 960, height: Math.round((960 * scene.canvas.height) / scene.canvas.width) };
      sizes.push(display);
    }
    for (const size of sizes) {
      for (const result of await measure(kernels, scene, size, options.frames, options.ablate)) {
        results.push(result);
        print(result, kernels.length > 1);
      }
    }
    scene.close();
  }
  if (options.json) writeFileSync(options.json, JSON.stringify(results, null, 1));
}

/** The sequence canvas is scaled so its short side is `short` pixels (even; the synthetic scene's canvas is small, so it gets upscaled). */
function scaled(canvas: Size, short: number): Size {
  const scale = short / Math.min(canvas.width, canvas.height);
  return {
    width: Math.max(2, Math.round((canvas.width * scale) / 2) * 2),
    height: Math.max(2, Math.round((canvas.height * scale) / 2) * 2),
  };
}

function print(result: Awaited<ReturnType<typeof measure>>[number], labelled: boolean): void {
  const stage = (name: string) => {
    const s = (result.stages as any)[name];
    return `${name} ${s.p50}/${s.p95}`;
  };
  console.log(
    `${result.scene}${labelled ? ` [${result.kernel}]` : ''} @ ${result.size} t=${result.start}s ` +
      `(${result.fps} fps, ${result.layers} layers, first frame ${result.firstFrameMs} ms, first frame at new size ${result.newSizeMs} ms, resize ${result.switchMs} ms, load ${result.load}) ms p50/p95: ` +
      ['plan', 'upload', 'render', 'readback', 'total'].map(stage).join(' · '),
  );
  if (Object.keys(result.perLayer).length > 0) {
    console.log(
      `  per layer (ablation): ${Object.entries(result.perLayer)
        .map(([key, value]) => `${key} ${Math.round(value * 100) / 100}`)
        .join(' · ')}`,
    );
  }
}

await main();
