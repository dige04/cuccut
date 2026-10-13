import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import {
  RpcError,
  newId,
  type EditOperation,
  type ExportCreateRequest,
  type ExportSnapshot,
  type JobRecord,
  type Project,
  type SequenceItem,
} from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { FontCatalogue } from '../fonts/font-catalogue.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import {
  checkVideo,
  resolveExportWorkerCommand,
  workerInput,
  type ProbedVideo,
  type VideoOutput,
  type VideoPlanResult,
} from './video-export.ts';

/**
 * Video export (architecture design §9.13). End to end: a real Runtime, video engine, Render Worker, and ffmpeg. The assets are solid-colour frames with a sine tone, generated on the spot by ffmpeg. Import → cut → overlay an image → cross-fade → export MP4. Read the streams and frame count with ffprobe, decode back and check colours per pixel and sound frequencies. Edits made during export don't affect the result (frozen). Cancellation leaves no half-written file. Content that can't be drawn is rejected by default, and with `skip` it is skipped with a warning.
 * The end-to-end part is skipped when engine-host, export-worker, or ffmpeg is missing.
 */

const engine = resolveEngineHostCommand();
const worker = resolveExportWorkerCommand(engine);
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!engine || !worker) console.warn('跳过成片导出端到端测试：没有构建 engine-host / export-worker（npm run build:engine）');
if (!ffmpeg) console.warn('跳过成片导出端到端测试：没有 ffmpeg / ffprobe');

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const SAMPLE_RATE = 48000;

describe('成片的输出尺寸与校验', () => {
  it('Worker 的输入：画面的位置随输出带上；计划里有说话人的区间时原样带上，没有时不写', () => {
    const range = { start: { ticks: '0', timescale: 1 }, end: { ticks: '1', timescale: 1 } };
    const plan = { sequenceId: 'seq', document: {}, documents: [], parts: [{ video: { range } }] } as unknown as VideoPlanResult;
    const output: VideoOutput = {
      format: 'mp4',
      codec: 'h264',
      width: 320,
      height: 320,
      picture: { x: 0, y: 70, width: 320, height: 180 },
      fps: { num: 30, den: 1 },
      crf: null,
      bitrateKbps: null,
      audioBitrateKbps: 192,
    };
    const input = (plan: VideoPlanResult) =>
      workerInput({
        plan,
        part: 0,
        assets: new Map(),
        output,
        outputPath: 'out.mp4',
        audioPath: null,
        burnCaptions: true,
        onUnsupported: 'fail',
        ffmpeg: 'ffmpeg',
        ffprobe: 'ffprobe',
      }) as Record<string, unknown>;
    expect(input(plan).output).toMatchObject({ width: 320, height: 320, picture: { x: 0, y: 70, width: 320, height: 180 } });
    expect(input(plan)).not.toHaveProperty('speakers');
    const speakers = { spk_a: [[0.2, 0.8]] as Array<[number, number]> };
    expect(input({ ...plan, speakers }).speakers).toEqual(speakers);
  });

  it('流、帧数（差一帧以内）、尺寸、帧率、编码与声音的时长', () => {
    const output: VideoOutput = {
      format: 'mp4',
      codec: 'h264',
      width: 320,
      height: 180,
      picture: { x: 0, y: 0, width: 320, height: 180 },
      fps: { num: 30, den: 1 },
      crf: null,
      bitrateKbps: null,
      audioBitrateKbps: 192,
    };
    const good: ProbedVideo = {
      durationSec: 4,
      frames: 120,
      width: 320,
      height: 180,
      fps: '30/1',
      codec: 'h264',
      videoDurationSec: 4,
      audio: { codec: 'aac', durationSec: 4.01 },
      colorSpace: 'bt709',
    };
    const ok = checkVideo(good, { frames: 120, output, audio: true });
    expect(ok.problems).toEqual([]);
    expect(ok.media).toMatchObject({ kind: 'video', frames: 120, videoCodec: 'h264', audioCodec: 'aac' });
    expect(ok.validation.video).toMatchObject({ expectedFrames: 120, streams: ['video', 'audio'] });
    const bad = checkVideo(
      { ...good, frames: 110, width: 640, fps: '25/1', codec: 'hevc', videoDurationSec: 3.6, audio: null },
      { frames: 120, output, audio: true },
    );
    expect(bad.problems).toHaveLength(6);
  });
});

async function until<T>(read: () => T | undefined | null | false | Promise<T | undefined | null | false>, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

/** A video asset of solid-colour frames with a sine tone (H.264 depends too much on the local encoder, so use mpeg4 at high quality). */
function colorClip(file: string, color: string, frequency: number, seconds: number): void {
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:size=320x180:rate=30:duration=${seconds}`],
    ...['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${seconds}:sample_rate=${SAMPLE_RATE}`],
    ...['-c:v', 'mpeg4', '-q:v', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file],
  ]);
}

/** The RGB of frame `k` (whole frame, rgb24). */
function frameAt(file: string, k: number, fps: number, width: number, height: number): Buffer {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${k})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 26 },
  );
  expect(raw.length, `第 ${k} 帧（${(k / fps).toFixed(2)} 秒）`).toBe(width * height * 3);
  return raw;
}

function pixel(frame: Buffer, width: number, x: number, y: number): [number, number, number] {
  const i = (y * width + x) * 3;
  return [frame[i]!, frame[i + 1]!, frame[i + 2]!];
}

function samples(file: string): Float32Array {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-'], {
    maxBuffer: 1 << 28,
  });
  const ints = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  return Float32Array.from(ints, (v) => v / 32768);
}

/** The amplitude of the component at frequency `f` within 50 ms around `at` seconds. */
function tone(pcm: Float32Array, f: number, at: number): number {
  const from = Math.round((at - 0.025) * SAMPLE_RATE);
  const n = Math.round(0.05 * SAMPLE_RATE);
  let re = 0;
  let im = 0;
  for (let i = 0; i < n; i++) {
    const phase = (2 * Math.PI * f * (from + i)) / SAMPLE_RATE;
    re += pcm[from + i]! * Math.cos(phase);
    im += pcm[from + i]! * Math.sin(phase);
  }
  return (2 * Math.hypot(re, im)) / n;
}

function probe(file: string): {
  streams: Array<{ codec_type: string; codec_name: string; pix_fmt?: string; color_space?: string; width?: number; height?: number }>;
} {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file]).toString()) as ReturnType<typeof probe>;
}

describe.skipIf(!engine || !worker || !ffmpeg)('成片导出（真实引擎 + Render Worker + ffmpeg）', () => {
  let fixtures: string;
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-video-export-fixtures-'));
    colorClip(path.join(fixtures, 'red.mp4'), '0xFF0000', 440, 3);
    colorClip(path.join(fixtures, 'blue.mp4'), '0x0000FF', 1000, 3);
    colorClip(path.join(fixtures, 'long.mp4'), '0x808080', 300, 60);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x00FF00:size=32x32',
      '-frames:v',
      '1',
      path.join(fixtures, 'green.png'),
    ]);
    await fs.writeFile(
      path.join(fixtures, 'logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#ff0"/></svg>',
    );
    // For the waveform: silent for the first second, then a 300 Hz mono WAV. Another, a 200 Hz hum.
    const wav = (name: string, expression: string, seconds: number) =>
      execFileSync('ffmpeg', [
        ...['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc=${expression}:s=${SAMPLE_RATE}:d=${seconds}`],
        ...['-c:a', 'pcm_s16le', path.join(fixtures, name)],
      ]);
    wav('tone.wav', 'if(gte(t\\,1)\\,0.6*sin(2*PI*300*t)\\,0)', 3);
    wav('hum.wav', '0.5*sin(2*PI*200*t)', 1);
    // Import doesn't parse SVG (it only checks the extension), so the failure to decode is found only at export preflight.
    await fs.writeFile(path.join(fixtures, 'broken.svg'), 'not an svg');
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-video-export-'));
    const home = resolveRuntimeHome({ CUCCUT_HOME: dir });
    runtime = await startRuntime({ home, drivers: () => [], watchSpace: false, engineHost: engine, videoGraceMs: 100, modelWorker: null });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '成片测试' }));
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function fixture(name: string): Promise<string> {
    const target = path.join(project.path, 'media', name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(fixtures, name), target);
    return target;
  }

  function video(videoId: string) {
    const mirror = runtime.videos.mirror(videoId)!;
    const sequence = mirror.video.sequences[mirror.video.rootSequenceId]!;
    const start = (item: SequenceItem) => ('span' in item ? item.span.fromFrame : 0);
    return {
      revision: mirror.video.revision,
      sequenceId: mirror.video.rootSequenceId,
      fps: sequence.fps,
      tracks: sequence.tracks,
      items: [...sequence.items].sort((a, b) => start(a) - start(b)),
    };
  }

  async function edit(videoId: string, operations: EditOperation[]) {
    return client.request('edits.apply', { videoId, commandId: newId('cmd'), expectedRevision: video(videoId).revision, operations });
  }

  const at = (seconds: number) => ({ unit: 'seconds' as const, value: String(seconds) });

  async function finish(jobId: string): Promise<JobRecord> {
    return until(async () => {
      const job = await client.request('exports.get', { jobId });
      return TERMINAL.has(job.state) && job;
    }, 120_000);
  }

  async function exportOnce(request: Omit<ExportCreateRequest, 'commandId'>): Promise<JobRecord> {
    const { jobId } = await client.request('exports.create', request);
    const job = await finish(jobId);
    if (job.state !== 'completed') throw new Error(`导出没有完成：${job.state} ${JSON.stringify(job.error)}`);
    return job;
  }

  /**
   * Swaps in a Runtime injected with a font directory and a fake download (same Runtime Home). The font directory holds only one family, the probe font ColrProbe, and Google Fonts addresses are rewritten to the local fake service at `origin`.
   */
  async function restartWithFontDownloads(origin: string): Promise<void> {
    client.close();
    await runtime.close();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
      fonts: {
        catalogue: FontCatalogue.parse({
          schema: 'cuccut.google-fonts-catalogue/1',
          families: [{ f: 'ColrProbe', c: 'display', s: ['latin'], w: [400], l: 'OFL-1.1' }],
        }),
        download: {
          fetch: (input, init) => fetch(String(input).replace(/^https:\/\/fonts\.(googleapis|gstatic)\.com/, origin), init),
          retries: 0,
        },
      },
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
  }

  /** Creates a new video with a 320×180 canvas. */
  async function newVideo(name: string): Promise<string> {
    const { ref } = await client.request('videos.create', { projectId: project.id, name });
    await edit(ref.videoId, [{ type: 'updateSequence', sequenceId: video(ref.videoId).sequenceId, canvas: { width: 320, height: 180 } }]);
    return ref.videoId;
  }

  /** Adds a new visual track (placed at the top) and returns its ID. */
  async function overlayTrack(videoId: string): Promise<string> {
    const before = new Set(video(videoId).tracks.map((t) => t.id));
    await edit(videoId, [{ type: 'addTrack', kind: 'visual' }]);
    return video(videoId).tracks.find((t) => !before.has(t.id))!.id;
  }

  /**
   * Red (440 Hz) over [0, 2) and blue (1000 Hz, from the source's 1–3 seconds) over [2, 4) join end to end, with a 0.5-second cross-fade between them. On top, a green image (a 32×32 square) is placed as picture-in-picture: centred at (40, 40) with width 48, so its top-left is at (16, 16) and it is 48×48, over [0, 4).
   * The positions are written as percentages of the frame: x = 40 / 320, y = 40 / 180, w = 48 / 320.
   */
  async function cutVideo(): Promise<{ videoId: string; image: string }> {
    const videoId = await newVideo('成片');
    const red = await fixture('red.mp4');
    const blue = await fixture('blue.mp4');
    const green = await fixture('green.png');
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: red, ref: 'r' },
      { type: 'importAsset', path: blue, ref: 'b' },
      { type: 'addItem', sequenceId, asset: { ref: 'r' }, at: at(0), alignment: 'nearest-frame' },
      { type: 'addItem', sequenceId, asset: { ref: 'b' }, at: at(3), alignment: 'nearest-frame' },
    ]);
    const [r, b] = video(videoId).items;
    await edit(videoId, [
      { type: 'trimItem', sequenceId, itemId: r!.id, edge: 'end', at: at(2), alignment: 'nearest-frame' },
      { type: 'trimItem', sequenceId, itemId: b!.id, edge: 'start', at: at(4), alignment: 'nearest-frame' },
    ]);
    await edit(videoId, [{ type: 'moveItem', sequenceId, itemId: b!.id, at: at(2), alignment: 'nearest-frame' }]);
    await edit(videoId, [
      {
        type: 'setTransition',
        sequenceId,
        leftItemId: r!.id,
        rightItemId: b!.id,
        kind: 'dissolve',
        duration: at(0.5),
        alignment: 'nearest-frame',
        audioCrossfade: true,
      },
    ]);
    const track = await overlayTrack(videoId);
    await edit(videoId, [{ type: 'importAsset', path: green, ref: 'g' }]);
    const assetId = Object.values(runtime.videos.mirror(videoId)!.video.assets).find((a) => a.name.startsWith('green'))!.id;
    await edit(videoId, [{ type: 'addItem', sequenceId, asset: { assetId }, trackId: track, at: at(0), alignment: 'nearest-frame' }]);
    const image = video(videoId).items.find((i) => i.type === 'image')!;
    await edit(videoId, [
      { type: 'trimItem', sequenceId, itemId: image.id, edge: 'end', at: at(4), alignment: 'nearest-frame' },
      { type: 'setStyle', sequenceId, itemId: image.id, mode: 'pip' },
      { type: 'setTransform', sequenceId, itemId: image.id, x: 12.5, y: (40 / 180) * 100, w: 15 },
    ]);
    return { videoId, image: image.id };
  }

  // v2 0d60e31a3 source-encoding regression: the source asset need not match the output encoding, and an uncut clip must not be blocked by native input restrictions.
  it.each([
    ['VP9/AAC MP4', 'libvpx-vp9', 'aac', 'mp4', 'vp9', 'aac'],
    ['VP9/Opus WebM', 'libvpx-vp9', 'libopus', 'webm', 'vp9', 'opus'],
    ['VP8/Vorbis WebM', 'libvpx', 'libvorbis', 'webm', 'vp8', 'vorbis'],
    ['AV1/AAC MP4', 'libaom-av1', 'aac', 'mp4', 'av1', 'aac'],
  ])('默认 MP4 配置导出 %s 源素材，保留画面、声音、尺寸与源文件', async (_label, videoEncoder, audioEncoder, extension, videoCodec, audioCodec) => {
    const videoId = await newVideo('兼容编码');
    const source = path.join(project.path, `source with spaces.${extension}`);
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=0xFF0000:size=320x180:rate=30:duration=1'],
      ...['-f', 'lavfi', '-i', `sine=frequency=440:duration=1:sample_rate=${SAMPLE_RATE}`],
      ...['-c:v', videoEncoder, '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', audioEncoder, source],
    ]);
    const sourceStreams = probe(source).streams;
    expect(sourceStreams.find((s) => s.codec_type === 'video')?.codec_name).toBe(videoCodec);
    expect(sourceStreams.find((s) => s.codec_type === 'audio')?.codec_name).toBe(audioCodec);
    const hash = async () => createHash('sha256').update(await fs.readFile(source)).digest('hex');
    const originalHash = await hash();
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: source, ref: 'source' },
      { type: 'addItem', sequenceId, asset: { ref: 'source' }, at: at(0), alignment: 'nearest-frame' },
    ]);
    const revision = video(videoId).revision;
    // No codec, quality, size, frame rate, or range is given. It goes fully through the Runtime preflight, the Worker, and publish verification.
    const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4' } });
    const output = job.result!.outputs![0]!;
    expect(output.media).toMatchObject({ kind: 'video', width: 320, height: 180, videoCodec: 'h264', audioCodec: 'aac' });
    expect(Math.abs(output.validation!.durationSec - 1)).toBeLessThan(0.1);
    const streams = probe(output.path!).streams;
    expect(streams.find((s) => s.codec_type === 'video')).toMatchObject({ codec_name: 'h264', width: 320, height: 180 });
    expect(streams.find((s) => s.codec_type === 'audio')?.codec_name).toBe('aac');
    const rate = video(videoId).fps.num / video(videoId).fps.den;
    const [red, green, blue] = pixel(frameAt(output.path!, Math.round(0.5 * rate), rate, 320, 180), 320, 160, 90);
    expect(red).toBeGreaterThan(220);
    expect(green).toBeLessThan(30);
    expect(blue).toBeLessThan(30);
    expect(tone(samples(output.path!), 440, 0.5)).toBeGreaterThan(0.08);
    expect(await hash()).toBe(originalHash);
    expect(video(videoId).revision).toBe(revision);
  }, 120_000);

  // Two exports: alone, about 7 seconds. When the whole suite runs together the machine is busy, so leave a margin.
  it('视频 + 图片 + 交叉淡化 + 声音：MP4，流、帧数、颜色与声音都对（A11）', async () => {
    const { videoId } = await cutVideo();
    const { fps } = video(videoId);
    const rate = fps.num / fps.den;
    const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4' } });
    const [out] = job.result!.outputs!;
    expect(out!.path).toBe(path.join(project.path, 'exports', '成片.mp4'));
    expect(out!.mediaType).toBe('video/mp4');
    const frames = Math.ceil(4 * rate);
    expect(out!.media).toMatchObject({ kind: 'video', width: 320, height: 180, frames, videoCodec: 'h264', audioCodec: 'aac' });
    expect(out!.validation!.video).toMatchObject({ expectedFrames: frames, frames, streams: ['video', 'audio'] });

    const streams = probe(out!.path!).streams;
    const v = streams.find((s) => s.codec_type === 'video')!;
    expect(v).toMatchObject({ codec_name: 'h264', pix_fmt: 'yuv420p', color_space: 'bt709', width: 320, height: 180 });
    expect(streams.find((s) => s.codec_type === 'audio')).toMatchObject({ codec_name: 'aac' });

    const near = (rgb: [number, number, number], want: [number, number, number], tol = 40) =>
      expect(
        rgb.every((c, i) => Math.abs(c - want[i]!) <= tol),
        `${rgb} ≈ ${want}`,
      ).toBe(true);
    const red = frameAt(out!.path!, Math.round(0.5 * rate), rate, 320, 180);
    near(pixel(red, 320, 200, 120), [255, 0, 0]);
    near(pixel(red, 320, 40, 40), [0, 255, 0]);
    const blue = frameAt(out!.path!, Math.round(3.5 * rate), rate, 320, 180);
    near(pixel(blue, 320, 200, 120), [0, 0, 255]);
    near(pixel(blue, 320, 40, 40), [0, 255, 0]);
    // The midpoint of the cross-fade: half red and half blue (blended on sRGB-encoded values, consistent with Canvas 2D).
    const middle = frameAt(out!.path!, Math.round(2 * rate), rate, 320, 180);
    near(pixel(middle, 320, 200, 120), [128, 0, 128], 45);

    // ffmpeg's sine amplitude is 1/8.
    const pcm = samples(out!.path!);
    expect(tone(pcm, 440, 0.5)).toBeGreaterThan(0.1);
    expect(tone(pcm, 1000, 0.5)).toBeLessThan(0.01);
    expect(tone(pcm, 1000, 3.5)).toBeGreaterThan(0.1);
    expect(tone(pcm, 440, 3.5)).toBeLessThan(0.01);

    // Range, output height, and frame rate: 1.5–2.5 seconds, 90 high, 15 fps → 15 frames, 160×90. WebM (VP9 + Opus).
    const part = await exportOnce({
      videoId,
      settings: { kind: 'video', format: 'webm', range: { start: 1.5, end: 2.5 }, height: 90, fps: { num: 15, den: 1 } },
    });
    const partOut = part.result!.outputs![0]!;
    expect(partOut.path).toBe(path.join(project.path, 'exports', '成片.webm'));
    expect(partOut.media).toMatchObject({
      kind: 'video',
      width: 160,
      height: 90,
      frames: 15,
      fps: '15/1',
      videoCodec: 'vp9',
      audioCodec: 'opus',
    });

    // Width and height both given, with an aspect ratio different from the canvas: in the 160×160 output, the 160×90 picture is centred (35 of black bar above and below). Placement within the picture scales with the canvas and is not reflowed.
    const boxed = await exportOnce({
      videoId,
      settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 1 }, width: 160, height: 160, fps: { num: 15, den: 1 } },
    });
    const boxedOut = boxed.result!.outputs![0]!;
    expect(boxedOut.media).toMatchObject({ kind: 'video', width: 160, height: 160, frames: 15 });
    expect(boxed.warnings ?? []).not.toContainEqual(expect.objectContaining({ code: 'EXPORT_SIZE_ADJUSTED' }));
    const frame = frameAt(boxedOut.path!, 7, 15, 160, 160);
    near(pixel(frame, 160, 80, 10), [0, 0, 0], 20);
    near(pixel(frame, 160, 80, 150), [0, 0, 0], 20);
    near(pixel(frame, 160, 100, 35 + 60), [255, 0, 0]);
    // The green picture-in-picture image: centred at (40, 40) on the canvas, halved, it lands at (20, 20) in the picture, i.e. (20, 55) in the output.
    near(pixel(frame, 160, 20, 35 + 20), [0, 255, 0]);

    // HEVC: the native writer only encodes H.264, so this path falls back to ffmpeg (libx265) encoding. The output is still complete (skipped when the local ffmpeg has no libx265).
    const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    if (encoders.includes('libx265')) {
      const hevc = await exportOnce({
        videoId,
        settings: { kind: 'video', format: 'mp4', codec: 'hevc', range: { start: 3, end: 4 }, fps: { num: 15, den: 1 } },
      });
      const hevcOut = hevc.result!.outputs![0]!;
      expect(hevcOut.media).toMatchObject({ kind: 'video', width: 320, height: 180, frames: 15, videoCodec: 'hevc', audioCodec: 'aac' });
      near(pixel(frameAt(hevcOut.path!, 7, 15, 320, 180), 320, 200, 120), [0, 0, 255]);
    }
  }, 60_000);

  it('内部检查的三段预览正常渲染、校验与发布，用途保留在快照和任务记录', async () => {
    const { videoId } = await cutVideo();
    const job = await exportOnce({
      videoId,
      settings: {
        kind: 'video',
        format: 'mp4',
        purpose: 'preview',
        ranges: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 3 },
        ],
        width: 160,
        fps: { num: 15, den: 1 },
      },
    });
    expect(job.export!.settings.purpose).toBe('preview');
    const snapshot = JSON.parse(
      (await runtime.models.jobs.artifacts.read(job.export!.snapshotArtifactId))!.toString('utf8'),
    ) as ExportSnapshot;
    expect(snapshot.settings.purpose).toBe('preview');
    expect(job.result!.outputs!.map((o) => path.basename(o.path!))).toEqual(['成片.part1.mp4', '成片.part2.mp4', '成片.part3.mp4']);
    for (const output of job.result!.outputs!) {
      expect(output.media).toMatchObject({ durationSec: 1, frames: 15, width: 160, height: 90 });
      expect(output.validation).toMatchObject({ durationSec: 1, video: { frames: 15, streams: ['video', 'audio'] } });
    }
  }, 60_000);

  // The master runs inside the Worker in a debug build, so it is slower than the other cases.
  it('声音的响度母带：成片的声音做到目标响度与真峰值，实测写进校验', async () => {
    const { videoId } = await cutVideo();
    const job = await exportOnce({
      videoId,
      settings: { kind: 'video', format: 'mp4', audio: { loudness: { integratedLufs: -20, truePeakDb: -2 } } },
    });
    const loudness = job.result!.outputs![0]!.validation!.loudness!;
    expect(loudness.target).toEqual({ integratedLufs: -20, truePeakDb: -2 });
    expect(Math.abs(loudness.measured.integratedLufs + 20)).toBeLessThan(0.5);
    expect(loudness.measured.truePeakDb).toBeLessThanOrEqual(-2);
    expect(job.warnings.map((w) => w.code)).not.toContain('LOUDNESS_NOT_MEASURABLE');
  }, 60_000);

  it('冻结：导出途中删掉所有实例，成片仍是提交时的版本（AT-25）', async () => {
    const { videoId } = await cutVideo();
    const before = video(videoId);
    const { jobId } = await client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4' } });
    await edit(videoId, [{ type: 'deleteItems', sequenceId: before.sequenceId, itemIds: before.items.map((i) => i.id) }]);
    const job = await finish(jobId);
    expect(job.state).toBe('completed');
    expect(job.export!.videoRevision).toBe(before.revision);
    const rate = before.fps.num / before.fps.den;
    const frame = frameAt(job.result!.outputs![0]!.path!, Math.round(0.5 * rate), rate, 320, 180);
    expect(pixel(frame, 320, 200, 120)[0]).toBeGreaterThan(200);
    // The sequence is empty now: the range is empty.
    const empty = await rejection(client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4' } }));
    expect(empty.details).toMatchObject({ code: 'EXPORT_RANGE_EMPTY' });
  });

  it('取消：停下 Worker 与 ffmpeg，清掉 staging，不留半个文件（AT-26）', async () => {
    const videoId = await newVideo('长片');
    const long = await fixture('long.mp4');
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: long, ref: 'l' },
      { type: 'addItem', sequenceId, asset: { ref: 'l' }, at: at(0), alignment: 'nearest-frame' },
    ]);
    const { jobId } = await client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4' } });
    await until(async () => {
      const job = await client.request('exports.get', { jobId });
      return job.progress?.unit === 'frames' && job.progress.done > 0;
    });
    const staging = path.join(resolveRuntimeHome({ CUCCUT_HOME: dir }).stagingDir, 'jobs', jobId);
    await client.request('jobs.cancel', { jobId });
    const cancelled = await finish(jobId);
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.result).toBeNull();
    await until(async () => !(await fs.stat(staging).catch(() => null)));
    expect(await fs.readdir(path.join(project.path, 'exports')).catch(() => [])).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')(
    'Worker 崩溃（被 SIGKILL）：任务失败，staging 清掉，它启动的 ffmpeg 随进程组一起停下',
    async () => {
      // Native encoding and decoding don't start ffmpeg subprocesses. Native is turned off here (`CUCCUT_EXPORT_NATIVE=0`), so the Worker takes the ffmpeg fallback.
      // What is tested is that the subprocesses on the fallback path are reaped along with the process group. The Worker inherits this process's environment.
      const previousNative = process.env.CUCCUT_EXPORT_NATIVE;
      process.env.CUCCUT_EXPORT_NATIVE = '0';
      onTestFinished(() => {
        if (previousNative === undefined) delete process.env.CUCCUT_EXPORT_NATIVE;
        else process.env.CUCCUT_EXPORT_NATIVE = previousNative;
      });
      const videoId = await newVideo('崩溃');
      const long = await fixture('long.mp4');
      const { sequenceId } = video(videoId);
      await edit(videoId, [
        { type: 'importAsset', path: long, ref: 'l' },
        { type: 'addItem', sequenceId, asset: { ref: 'l' }, at: at(0), alignment: 'nearest-frame' },
      ]);
      const { jobId } = await client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4' } });
      await until(async () => {
        const job = await client.request('exports.get', { jobId });
        return job.progress?.unit === 'frames' && job.progress.done > 0;
      });
      // This render's Worker (a child process of this process, in its own process group) and the ffmpeg in that group.
      const processes = () =>
        execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pgid=,command='], { encoding: 'utf8' })
          .split('\n')
          .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
          .filter((m): m is RegExpMatchArray => m !== null)
          .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), pgid: Number(m[3]), command: m[4]! }));
      const renderer = processes().find((p) => p.ppid === process.pid && p.command.includes('export-worker') && / render /.test(p.command));
      expect(renderer, '找不到渲染中的 export-worker').toBeDefined();
      expect(renderer!.pgid).toBe(renderer!.pid);
      const children = processes().filter((p) => p.pgid === renderer!.pid && p.pid !== renderer!.pid);
      expect(children.some((p) => p.command.includes('ffmpeg'))).toBe(true);

      const staging = path.join(resolveRuntimeHome({ CUCCUT_HOME: dir }).stagingDir, 'jobs', jobId);
      // Freeze the ffmpeg first: a frozen process doesn't exit on its own when the pipe breaks, so only the Runtime killing the process group can reap it (otherwise it becomes an orphan).
      for (const child of children) process.kill(child.pid, 'SIGSTOP');
      process.kill(renderer!.pid, 'SIGKILL');
      const alive = (pid: number) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };
      onTestFinished(() => {
        // If the test fails, don't leave the frozen processes on the machine either.
        for (const child of children.filter((c) => alive(c.pid))) process.kill(child.pid, 'SIGKILL');
      });
      const failed = await finish(jobId);
      expect(failed.state).toBe('failed');
      expect(failed.error).toMatchObject({ code: 'EXPORT_RENDER_FAILED' });
      expect(JSON.stringify(failed.error)).toContain('SIGKILL');
      // Once the job ends, the group has already been killed: ffmpeg no longer exists (give the kernel a moment to reclaim it).
      await until(() => children.every((p) => !alive(p.pid)), 3_000);
      await until(async () => !(await fs.stat(staging).catch(() => null)));
      expect(await fs.readdir(path.join(project.path, 'exports')).catch(() => [])).toEqual([]);
    },
  );

  it.skipIf(process.platform === 'win32')('Worker 在提交之后不见了：任务失败，错误指向 Render Worker 而不是叫人装 ffmpeg', async () => {
    // Preflight runs the real Worker and then deletes it, so starting it after the job begins finds nothing (as if the build output were cleared while the job was queued).
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-worker-gone-'));
    const script = path.join(tmp, 'export-worker');
    await fs.writeFile(script, `#!/bin/sh\n"${worker}" "$@"\nstatus=$?\nrm -f "$0"\nexit $status\n`, { mode: 0o755 });
    const previous = process.env.CUCCUT_EXPORT_WORKER;
    process.env.CUCCUT_EXPORT_WORKER = script;
    onTestFinished(async () => {
      if (previous === undefined) delete process.env.CUCCUT_EXPORT_WORKER;
      else process.env.CUCCUT_EXPORT_WORKER = previous;
      await fs.rm(tmp, { recursive: true, force: true });
    });
    const { videoId } = await cutVideo();
    const { jobId } = await client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4' } });
    const failed = await finish(jobId);
    expect(failed.state).toBe('failed');
    expect(failed.error).toMatchObject({ code: 'EXPORT_TOOL_MISSING', details: { missing: 'export-worker' } });
    expect(failed.error!.message).toContain('Render Worker');
    expect(JSON.stringify(failed.error)).toContain('CUCCUT_EXPORT_WORKER');
    expect(JSON.stringify(failed.error)).not.toContain('安装 ffmpeg');
  });

  it('图形与文字：按预览的几何画出来，字体随渲染内核发布（T35）', async () => {
    const videoId = await newVideo('图文');
    const { sequenceId } = video(videoId);
    const track = await overlayTrack(videoId);
    const textTrack = await overlayTrack(videoId);
    const span = { fromFrame: 0, durationFrames: 30 };
    // Positions are percentages of the frame (320×180): x and y are the box centre, and w is the box width.
    const place = (x: number, y: number, w: number) => ({ x: (x / 320) * 100, y: (y / 180) * 100, w: (w / 320) * 100 });
    await edit(videoId, [
      {
        type: 'insertItems',
        sequenceId,
        items: [
          {
            type: 'shape',
            trackId: track,
            span,
            place: place(60, 90, 80),
            shape: { shape: 'rect', fill: '#ff0000' },
          },
          {
            type: 'text',
            trackId: textTrack,
            span,
            place: place(220, 90, 160),
            text: '你好',
            style: { fontSize: 60, fontColor: '#ffffff' },
          },
        ],
      },
    ]);
    const range = { start: 0, end: 0.5 };
    // Fonts ship with the rendering core, so machines without system fonts can still draw text.
    const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range } });
    const rate = video(videoId).fps.num / video(videoId).fps.den;
    const frame = frameAt(job.result!.outputs![0]!.path!, 0, rate, 320, 180);
    // The red square's centre is at canvas (60, 90), with side 80. Outside the square is a black background.
    const [r, g, b] = pixel(frame, 320, 60, 90);
    expect(r > 200 && g < 50 && b < 50, `${[r, g, b]}`).toBe(true);
    expect(pixel(frame, 320, 10, 90)[0]).toBeLessThan(40);
    // The text box's centre is at (220, 90): there are bright strokes inside the box, and outside it is still black.
    let bright = 0;
    for (let y = 60; y < 120; y++) for (let x = 160; x < 280; x++) if (pixel(frame, 320, x, y)[1] > 200) bright++;
    expect(bright).toBeGreaterThan(100);
    expect(pixel(frame, 320, 310, 10)[1]).toBeLessThan(40);
  });

  it('本机字体：内置字体之外的族在本机找到的 face 冻结进快照、画进成片，变了以 FONT_MISSING 失败；预览拿得到同一个 face；找不到的照回退字体画并警告', async () => {
    // The local font library scans only this temp directory (a test hook that the engine and Render Worker take at startup), so the test doesn't depend on what fonts this machine has installed.
    const fonts = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fonts-'));
    const previous = process.env.CUCCUT_FONT_DIRS;
    process.env.CUCCUT_FONT_DIRS = fonts;
    onTestFinished(async () => {
      if (previous === undefined) delete process.env.CUCCUT_FONT_DIRS;
      else process.env.CUCCUT_FONT_DIRS = previous;
      await fs.rm(fonts, { recursive: true, force: true });
    });
    const videoId = await newVideo('本机字体');
    const { sequenceId } = video(videoId);
    const textTrack = await overlayTrack(videoId);
    // The “A” of the probe font ColrProbe (a test fixture of render-raster) is a red diamond plus a blue triangle. A fallback font draws white text.
    await edit(videoId, [
      {
        type: 'insertItems',
        sequenceId,
        items: [
          {
            type: 'text',
            trackId: textTrack,
            span: { fromFrame: 0, durationFrames: 30 },
            place: { x: 50, y: 50, w: 80 },
            text: 'A',
            style: { fontSize: 120, fontColor: '#ffffff', fontFamily: 'ColrProbe' },
          },
        ],
      },
    ]);
    const exported = async () => {
      const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 0.5 } } });
      const rate = video(videoId).fps.num / video(videoId).fps.den;
      const frame = frameAt(job.result!.outputs![0]!.path!, 0, rate, 320, 180);
      let red = 0;
      let white = 0;
      for (let y = 0; y < 180; y++) {
        for (let x = 0; x < 320; x++) {
          const [r, g, b] = pixel(frame, 320, x, y);
          if (r > 180 && g < 70 && b < 70) red++;
          if (r > 200 && g > 200 && b > 200) white++;
        }
      }
      const notes = (job.warnings ?? []).map((w) => w.detail ?? '').filter((d) => d.includes('font "ColrProbe"'));
      return { red, white, notes, job };
    };
    const missing = await exported();
    expect(missing.notes).toHaveLength(1);
    expect(missing.notes[0]).toContain('is not available in the current font library');
    expect(missing.red).toBe(0);
    expect(missing.white).toBeGreaterThan(100);
    await fs.copyFile(
      new URL('../../../../crates/render-raster/tests/fixtures/fonts/ColrProbe.ttf', import.meta.url),
      path.join(fonts, 'probe.ttf'),
    );
    const found = await exported();
    expect(found.notes).toEqual([]);
    // It draws the probe font's coloured shapes, not white text (the picture is small, and after chroma subsampling there are few red pixels).
    expect(found.white).toBeLessThan(missing.white / 4);
    expect(found.red).toBeGreaterThan(5);
    // The frozen snapshot records the face used: the file, its index within the file, and the digest of the whole file. When none is found, a fallback is recorded.
    const probe = await fs.readFile(path.join(fonts, 'probe.ttf'));
    const snapshotOf = async (job: JobRecord) =>
      JSON.parse((await runtime.models.jobs.artifacts.read(job.export!.snapshotArtifactId))!.toString('utf8')) as ExportSnapshot;
    expect((await snapshotOf(missing.job)).fonts).toEqual([{ family: 'ColrProbe', weight: 400, italic: false, fallback: 'not-found' }]);
    expect((await snapshotOf(found.job)).fonts).toEqual([
      {
        family: 'ColrProbe',
        weight: 400,
        italic: false,
        path: path.join(fonts, 'probe.ttf'),
        faceIndex: 0,
        contentHash: `sha256:${createHash('sha256').update(probe).digest('hex')}`,
        byteLength: probe.length,
      },
    ]);
    // The font file changed after freezing: this is detected by digest at execution, and the whole job fails with FONT_MISSING rather than quietly swapping in another font.
    if (process.platform !== 'win32') {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-font-changed-'));
      const script = path.join(tmp, 'export-worker');
      const file = path.join(fonts, 'probe.ttf');
      await fs.writeFile(script, `#!/bin/sh\nif [ "$1" = render ]; then printf x >> "${file}"; fi\nexec "${worker}" "$@"\n`, {
        mode: 0o755,
      });
      const previousWorker = process.env.CUCCUT_EXPORT_WORKER;
      process.env.CUCCUT_EXPORT_WORKER = script;
      onTestFinished(async () => {
        if (previousWorker === undefined) delete process.env.CUCCUT_EXPORT_WORKER;
        else process.env.CUCCUT_EXPORT_WORKER = previousWorker;
        await fs.rm(tmp, { recursive: true, force: true });
      });
      const { jobId } = await client.request('exports.create', {
        videoId,
        settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 0.5 } },
      });
      const failed = await finish(jobId);
      expect(failed.state).toBe('failed');
      expect(failed.error).toMatchObject({ code: 'FONT_MISSING', details: { family: 'ColrProbe', reason: 'changed' } });
      expect(failed.error!.message).toContain('字体无法复现');
      await fs.writeFile(file, probe);
    }
    // The preview asks for fonts by face. The engine uses the same resolution to find the same face in the same file, and sends a read handle and how to draw it. A face that can't be found gives the reason.
    const resolved = await client.request('fonts.resolve', {
      faces: [
        { family: 'ColrProbe', weight: 400, italic: false },
        { family: 'Nowhere Sans', weight: 700, italic: false },
      ],
    });
    expect(resolved.missing).toEqual([{ family: 'Nowhere Sans', weight: 700, italic: false, reason: 'not-found' }]);
    const [face] = resolved.faces;
    expect([face!.family, face!.file.fileName, face!.faceIndex, face!.fileSize]).toEqual(['ColrProbe', 'probe.ttf', 0, probe.length]);
    // Only one table by range: 206, with bytes identical to that section of the file.
    const table = face!.tables[0]!;
    const response = await fetch(face!.file.url, { headers: { Range: `bytes=${table.from}-${table.from + table.length - 1}` } });
    expect(response.status).toBe(206);
    expect(Buffer.from(await response.arrayBuffer()).equals(probe.subarray(table.from, table.from + table.length))).toBe(true);
    await expect(client.request('fonts.resolve', { faces: [] })).rejects.toThrow();
  });

  it('按需下载的字体：目录里有、本机没有的族在导出任务里下载、冻结、画进成片；关了自动下载时照回退字体画并说明原因', async () => {
    // The local font library is an empty temp directory. The font service is a local fake that serves the probe font ColrProbe (the font directory is injected, and it holds only this one family).
    const systemFonts = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fonts-'));
    const previous = process.env.CUCCUT_FONT_DIRS;
    process.env.CUCCUT_FONT_DIRS = systemFonts;
    const probe = await fs.readFile(new URL('../../../../crates/render-raster/tests/fixtures/fonts/ColrProbe.ttf', import.meta.url));
    const requests: string[] = [];
    const server = http.createServer((req, res) => {
      requests.push(req.url!);
      if (req.url!.startsWith('/css2?')) {
        return void res
          .writeHead(200)
          .end(
            "@font-face { font-family: 'ColrProbe'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/colrprobe/v1/a.ttf) format('truetype'); }",
          );
      }
      res.writeHead(200, { 'content-length': probe.length }).end(probe);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    onTestFinished(async () => {
      if (previous === undefined) delete process.env.CUCCUT_FONT_DIRS;
      else process.env.CUCCUT_FONT_DIRS = previous;
      server.closeAllConnections();
      server.close();
      await fs.rm(systemFonts, { recursive: true, force: true });
    });
    await restartWithFontDownloads(origin);
    ({ project } = await client.request('projects.create', { name: '下载字体' }));

    const videoId = await newVideo('下载字体');
    const textTrack = await overlayTrack(videoId);
    await edit(videoId, [
      {
        type: 'insertItems',
        sequenceId: video(videoId).sequenceId,
        items: [
          {
            type: 'text',
            trackId: textTrack,
            span: { fromFrame: 0, durationFrames: 30 },
            place: { x: 50, y: 50, w: 80 },
            text: 'A',
            style: { fontSize: 120, fontColor: '#ffffff', fontFamily: 'ColrProbe' },
          },
        ],
      },
    ]);
    const exported = async () => {
      const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 0.5 } } });
      const rate = video(videoId).fps.num / video(videoId).fps.den;
      const frame = frameAt(job.result!.outputs![0]!.path!, 0, rate, 320, 180);
      let red = 0;
      for (let y = 0; y < 180; y++) {
        for (let x = 0; x < 320; x++) {
          const [r, g, b] = pixel(frame, 320, x, y);
          if (r > 180 && g < 70 && b < 70) red++;
        }
      }
      const snapshot = JSON.parse(
        (await runtime.models.jobs.artifacts.read(job.export!.snapshotArtifactId))!.toString('utf8'),
      ) as ExportSnapshot;
      const warnings = (job.warnings ?? []).filter((w) => w.code === 'FONT_NOT_DOWNLOADED' || w.detail?.includes('ColrProbe'));
      return { red, job, snapshot, warnings };
    };
    // The video's fonts: the Render Worker takes a glyph census (families bundled with the core are included too, along with the fallback families). Without download, nothing is downloaded.
    const before = await client.request('fonts.usage', { videoId });
    expect(before.families.map((f) => [f.family, f.status.state, f.fallback])).toEqual([['ColrProbe', 'downloadable', 'Noto Sans SC']]);
    expect(requests).toEqual([]);
    // First time: at freeze time nothing is downloaded yet, so the snapshot records “to be downloaded”. It is downloaded during the job and frozen into the render, and the picture draws the probe font.
    const first = await exported();
    expect(first.snapshot.fonts).toEqual([{ family: 'ColrProbe', weight: 400, italic: false, download: 'google-fonts' }]);
    expect(first.warnings).toEqual([]);
    expect(first.red).toBeGreaterThan(5);
    expect(requests).toEqual(['/css2?family=ColrProbe:wght@400', '/s/colrprobe/v1/a.ttf']);
    const { faces } = await client.request('fonts.downloaded', {});
    expect(faces).toMatchObject([{ family: 'ColrProbe', weight: 400, italic: false, licence: 'OFL-1.1', sizeBytes: probe.length }]);
    // Second time: the cache already has it, so freezing records the file (`source: 'downloaded'`) and makes no request.
    const second = await exported();
    expect(second.snapshot.fonts).toEqual([
      {
        family: 'ColrProbe',
        weight: 400,
        italic: false,
        path: expect.stringContaining(path.join(dir, 'fonts', 'files')),
        faceIndex: 0,
        contentHash: `sha256:${createHash('sha256').update(probe).digest('hex')}`,
        byteLength: probe.length,
        source: 'downloaded',
      },
    ]);
    expect(second.red).toBeGreaterThan(5);
    expect(requests).toHaveLength(2);
    const resolved = await client.request('fonts.resolve', { faces: [{ family: 'ColrProbe', weight: 400, italic: false }] });
    expect(resolved.faces.map((f) => [f.family, f.source])).toEqual([['ColrProbe', 'downloaded']]);
    // Auto-download is off and the cache is emptied: it draws with the fallback font, and the warning explains why nothing was downloaded.
    await client.request('settings.set', { values: { 'fonts.autoDownload': false } });
    expect(await client.request('fonts.clear', {})).toMatchObject({ removed: [{ family: 'ColrProbe' }], kept: [] });
    const off = await exported();
    expect(off.snapshot.fonts).toEqual([{ family: 'ColrProbe', weight: 400, italic: false, fallback: 'not-downloaded' }]);
    expect(off.red).toBe(0);
    const notDownloaded = off.warnings.find((w) => w.code === 'FONT_NOT_DOWNLOADED');
    expect(notDownloaded?.detail).toContain('自动下载字体已关闭');
    expect(notDownloaded?.font).toEqual({
      family: 'ColrProbe',
      weight: 400,
      italic: false,
      fallback: 'Noto Sans SC',
      reason: expect.stringContaining('自动下载字体已关闭'),
    });
    // The video's fonts (Render Worker census): with auto-download off, download doesn't download either. The status is downloadable, and the fallback family stands in for it.
    const usage = await client.request('fonts.usage', { videoId, download: true });
    expect(usage).toEqual({
      fallback: 'Noto Sans SC',
      started: [],
      families: [
        {
          family: 'ColrProbe',
          faces: [{ weight: 400, italic: false }],
          status: expect.objectContaining({ state: 'downloadable' }),
          fallback: 'Noto Sans SC',
        },
      ],
    });
    expect(requests).toHaveLength(2);
  });

  it('导出还在等字体下载时取消：任务记为取消，下载停下、不留半个文件，族不卡在下载中，之后可以再下载', async () => {
    const systemFonts = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fonts-'));
    const previous = process.env.CUCCUT_FONT_DIRS;
    process.env.CUCCUT_FONT_DIRS = systemFonts;
    const probe = await fs.readFile(new URL('../../../../crates/render-raster/tests/fixtures/fonts/ColrProbe.ttf', import.meta.url));
    // Slow font file: one small chunk every 100 ms (once `slow` is turned off, it is all delivered at once).
    const state = { slow: true, files: 0 };
    const server = http.createServer((req, res) => {
      if (req.url!.startsWith('/css2?')) {
        return void res
          .writeHead(200)
          .end(
            "@font-face { font-family: 'ColrProbe'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/colrprobe/v1/a.ttf) format('truetype'); }",
          );
      }
      state.files++;
      res.writeHead(200, { 'content-length': probe.length });
      if (!state.slow) return void res.end(probe);
      let sent = 0;
      const timer = setInterval(() => {
        if (res.destroyed || sent >= probe.length) {
          clearInterval(timer);
          if (!res.destroyed) res.end();
          return;
        }
        res.write(probe.subarray(sent, sent + 64));
        sent += 64;
      }, 100);
      res.on('close', () => clearInterval(timer));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    onTestFinished(async () => {
      if (previous === undefined) delete process.env.CUCCUT_FONT_DIRS;
      else process.env.CUCCUT_FONT_DIRS = previous;
      server.closeAllConnections();
      server.close();
      await fs.rm(systemFonts, { recursive: true, force: true });
    });
    await restartWithFontDownloads(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    ({ project } = await client.request('projects.create', { name: '取消等字体的导出' }));

    const videoId = await newVideo('取消等字体的导出');
    const textTrack = await overlayTrack(videoId);
    await edit(videoId, [
      {
        type: 'insertItems',
        sequenceId: video(videoId).sequenceId,
        items: [
          {
            type: 'text',
            trackId: textTrack,
            span: { fromFrame: 0, durationFrames: 30 },
            place: { x: 50, y: 50, w: 80 },
            text: 'A',
            style: { fontSize: 120, fontColor: '#ffffff', fontFamily: 'ColrProbe' },
          },
        ],
      },
    ]);
    const status = async () => (await client.request('fonts.catalogue', { families: ['ColrProbe'] })).families[0]!;
    const { jobId } = await client.request('exports.create', {
      videoId,
      settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 0.5 } },
    });
    // The export stops during the font-download stage with bytes already received. The family is downloading, and the download is recorded on the export job.
    await until(async () => {
      const job = await client.request('exports.get', { jobId });
      return job.phase === 'downloading' && job.progress?.unit === 'bytes' && job.progress.done > 0;
    });
    expect(await status()).toMatchObject({ state: 'downloading', job: { jobId } });
    const staging = path.join(dir, 'fonts', '.staging');
    expect(await fs.readdir(staging)).toHaveLength(1);

    await client.request('jobs.cancel', { jobId });
    const cancelled = await finish(jobId);
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.result).toBeNull();
    // The download stops: the temp file is deleted, nothing is in the cache, and the family is no longer downloading (recorded as cancelled, so it can be retried).
    await until(async () => (await fs.readdir(staging)).length === 0);
    expect((await client.request('fonts.downloaded', {})).faces).toEqual([]);
    expect(await status()).toMatchObject({ state: 'failed', job: null, error: { code: 'CANCELLED' } });
    expect(await fs.readdir(path.join(project.path, 'exports')).catch(() => [])).toEqual([]);

    // Download again: starts from the beginning, and goes into the cache once complete.
    state.slow = false;
    const again = await client.request('fonts.download', { family: 'ColrProbe' });
    expect(again.jobId).not.toBeNull();
    expect(await runtime.models.jobs.settled(again.jobId!)).toBe('completed');
    expect(state.files).toBe(2);
    expect((await client.request('fonts.downloaded', {})).faces).toMatchObject([{ family: 'ColrProbe', sizeBytes: probe.length }]);
    expect(await status()).toMatchObject({ state: 'downloaded', job: null, error: null });
  });

  it('只给字幕用的字体：字幕不烧进画面时导出不下载它，烧进画面时下载', async () => {
    const systemFonts = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fonts-'));
    const previous = process.env.CUCCUT_FONT_DIRS;
    process.env.CUCCUT_FONT_DIRS = systemFonts;
    const probe = await fs.readFile(new URL('../../../../crates/render-raster/tests/fixtures/fonts/ColrProbe.ttf', import.meta.url));
    let files = 0;
    const server = http.createServer((req, res) => {
      if (req.url!.startsWith('/css2?')) {
        return void res
          .writeHead(200)
          .end(
            "@font-face { font-family: 'ColrProbe'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/colrprobe/v1/a.ttf) format('truetype'); }",
          );
      }
      files++;
      res.writeHead(200, { 'content-length': probe.length }).end(probe);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    onTestFinished(async () => {
      if (previous === undefined) delete process.env.CUCCUT_FONT_DIRS;
      else process.env.CUCCUT_FONT_DIRS = previous;
      server.closeAllConnections();
      server.close();
      await fs.rm(systemFonts, { recursive: true, force: true });
    });
    await restartWithFontDownloads(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    ({ project } = await client.request('projects.create', { name: '字幕字体' }));

    // Subtitle style uses ColrProbe. There is no other text on the picture.
    const videoId = await newVideo('字幕字体');
    const { sequenceId } = video(videoId);
    const caption = {
      schema: 'cuccut.caption/1',
      clock: 'sequence',
      timescale: 1000,
      cues: [{ id: 'c1', start: 0, end: 2000, text: 'A' }],
    };
    await edit(videoId, [
      { type: 'putDocument', ref: 'cap', kind: 'caption', name: '字幕', language: 'en', body: caption },
      {
        type: 'putDocument',
        ref: 'style',
        kind: 'caption-style',
        name: '字幕样式',
        body: { schema: 'cuccut.legacy-studio-style/0.1', style: { fontFamily: 'ColrProbe' } },
      },
      { type: 'addTrack', kind: 'subtitle', ref: 'subs' },
      {
        type: 'insertItems',
        sequenceId,
        items: [{ type: 'caption', trackRef: 'subs', documentRef: 'cap', span: { fromFrame: 0, durationFrames: 60 } }],
      },
    ]);
    const itemId = video(videoId).items.find((i) => i.type === 'caption')!.id;
    const styleId = Object.values(runtime.videos.mirror(videoId)!.video.documents).find((d) => d.kind === 'caption-style')!.id;
    await edit(videoId, [{ type: 'setCaptionStyle', sequenceId, itemId, styleDocument: { documentId: styleId } }]);
    expect((await client.request('fonts.usage', { videoId, burnCaptions: false })).families).toEqual([]);

    const range = { start: 0, end: 0.5 };
    await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range, burnCaptions: false } });
    expect(files).toBe(0);
    expect((await client.request('fonts.downloaded', {})).faces).toEqual([]);

    await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range } });
    expect(files).toBe(1);
    expect((await client.request('fonts.downloaded', {})).faces).toMatchObject([{ family: 'ColrProbe' }]);
  });

  it('视频用到的字体只看文字与字幕：没有素材、素材文件不见了或变了，fonts.usage 照样给出清单', async () => {
    const videoId = await newVideo('缺素材');
    const textTrack = await overlayTrack(videoId);
    await edit(videoId, [
      {
        type: 'insertItems',
        sequenceId: video(videoId).sequenceId,
        items: [
          {
            type: 'text',
            trackId: textTrack,
            span: { fromFrame: 0, durationFrames: 30 },
            place: { x: 50, y: 50, w: 80 },
            text: 'A',
            style: { fontSize: 120, fontColor: '#ffffff', fontFamily: 'Noto Sans SC' },
          },
        ],
      },
    ]);
    const families = async () => (await client.request('fonts.usage', { videoId })).families.map((f) => [f.family, f.fallback]);
    // No assets at all: only text.
    expect(Object.keys(runtime.videos.mirror(videoId)!.video.assets)).toEqual([]);
    const textOnly = await families();
    expect(textOnly).toEqual([['Noto Sans SC', null]]);
    // Linked video and image assets are put into the sequence, then the files are deleted or changed. The export is rejected with ASSET_MISSING / ASSET_CHANGED, and the font census is unaffected.
    const red = await fixture('red.mp4');
    const green = await fixture('green.png');
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: red, ref: 'r' },
      { type: 'importAsset', path: green, ref: 'g' },
      { type: 'addItem', sequenceId, asset: { ref: 'r' }, at: at(0), alignment: 'nearest-frame' },
      { type: 'addItem', sequenceId, asset: { ref: 'g' }, trackId: textTrack, at: at(1), alignment: 'nearest-frame' },
    ]);
    expect(await families()).toEqual(textOnly);
    await fs.rm(red);
    await fs.writeFile(green, 'changed');
    const refused = await rejection(client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4' } }));
    expect(['ASSET_MISSING', 'ASSET_CHANGED']).toContain((refused.details as { code?: string }).code);
    expect(await families()).toEqual(textOnly);
  });

  it('字幕：缺省烧进画面（锚点在画布 86% 高处），burnCaptions: false 时不画', async () => {
    const videoId = await newVideo('字幕');
    const { sequenceId } = video(videoId);
    const caption = {
      schema: 'cuccut.caption/1',
      clock: 'sequence',
      timescale: 1000,
      cues: [{ id: 'c1', start: 0, end: 2000, text: '你好，世界。' }],
    };
    await edit(videoId, [
      { type: 'putDocument', ref: 'cap', kind: 'caption', name: '字幕', language: 'zh', body: caption },
      { type: 'addTrack', kind: 'subtitle', ref: 'subs' },
      {
        type: 'insertItems',
        sequenceId,
        items: [{ type: 'caption', trackRef: 'subs', documentRef: 'cap', span: { fromFrame: 0, durationFrames: 60 } }],
      },
    ]);
    const range = { start: 0, end: 0.5 };
    const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range } });
    const rate = video(videoId).fps.num / video(videoId).fps.den;
    const bright = (file: string) => {
      const frame = frameAt(file, 0, rate, 320, 180);
      let count = 0;
      for (let y = 130; y < 180; y++) for (let x = 0; x < 320; x++) if (pixel(frame, 320, x, y)[1] > 128) count++;
      return count;
    };
    // Font size 30 (short side 540) on a 180-high canvas is 10 pixels. The text sits near y≈155.
    expect(bright(job.result!.outputs![0]!.path!)).toBeGreaterThan(20);
    // The default file name carries the subtitle language burned into the picture. Without burning in, there is no suffix.
    expect(path.basename(job.result!.outputs![0]!.path!)).toBe('字幕.zh.mp4');
    const off = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range, burnCaptions: false } });
    expect(bright(off.result!.outputs![0]!.path!)).toBe(0);
    expect(path.basename(off.result!.outputs![0]!.path!)).toBe('字幕.mp4');
    // The export panel's font census follows the same selection: when subtitles aren't burned into the picture, families used only for subtitles aren't in the list.
    const families = async (burnCaptions?: boolean) =>
      (await client.request('fonts.usage', { videoId, ...(burnCaptions === undefined ? {} : { burnCaptions }) })).families.map(
        (f) => f.family,
      );
    const burned = await families();
    expect(burned.length).toBeGreaterThan(0);
    expect(await families(true)).toEqual(burned);
    expect(await families(false)).toEqual([]);
  });

  it('SVG 图片按矢量光栅画进成片', async () => {
    const videoId = await newVideo('带矢量图');
    const red = await fixture('red.mp4');
    const svg = await fixture('logo.svg');
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: red, ref: 'r' },
      { type: 'addItem', sequenceId, asset: { ref: 'r' }, at: at(0), alignment: 'nearest-frame' },
    ]);
    const track = await overlayTrack(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: svg, ref: 's' },
      { type: 'addItem', sequenceId, asset: { ref: 's' }, trackId: track, at: at(0), alignment: 'nearest-frame' },
    ]);
    const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range: { start: 0, end: 1 } } });
    const rate = video(videoId).fps.num / video(videoId).fps.den;
    const [r, g, b] = pixel(frameAt(job.result!.outputs![0]!.path!, Math.round(0.5 * rate), rate, 320, 180), 320, 160, 90);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeLessThan(80);
  });

  it('声波：导出从冻结的声音文件算频谱，跟着声音动；范围外的声音也冻结', async () => {
    const videoId = await newVideo('声波');
    const tone = await fixture('tone.wav');
    const hum = await fixture('hum.wav');
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: tone, ref: 't' },
      { type: 'importAsset', path: hum, ref: 'h' },
      { type: 'addItem', sequenceId, asset: { ref: 't' }, at: at(0), alignment: 'nearest-frame' },
      // The hum is outside the export range. The waveform listens to the whole sequence, so its assets must also be frozen and their spectrum computed.
      { type: 'addItem', sequenceId, asset: { ref: 'h' }, at: at(4), alignment: 'nearest-frame' },
    ]);
    const track = await overlayTrack(videoId);
    await edit(videoId, [
      {
        type: 'insertItems',
        sequenceId,
        items: [
          {
            type: 'visualizer',
            trackId: track,
            span: { fromFrame: 0, durationFrames: 150 },
            place: { x: 50, y: 50, w: 80 },
            visualizer: { style: 'bars', mainColor: '#ffffff', smoothing: 0 },
          },
        ],
      },
    ]);
    const viz = video(videoId).items.find((i) => i.type === 'visualizer')!;
    const job = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range: { start: 0.5, end: 1.8 } } });
    expect(job.warnings.filter((w) => w.detail?.includes(viz.id))).toEqual([]);
    const rate = video(videoId).fps.num / video(videoId).fps.den;
    const file = job.result!.outputs![0]!.path!;
    const bright = (frame: Buffer) => {
      let n = 0;
      for (let i = 0; i < frame.length; i += 3) if (frame[i]! > 200 && frame[i + 1]! > 200 && frame[i + 2]! > 200) n++;
      return n;
    };
    // Output frame 0 is sequence time 0.5 seconds (silent), and frame 30 is 1.5 seconds (300 Hz sounding).
    const quiet = bright(frameAt(file, 0, rate, 320, 180));
    const loud = bright(frameAt(file, Math.round(1.0 * rate), rate, 320, 180));
    expect(loud, `${quiet} → ${loud}`).toBeGreaterThan(quiet + 200);
  }, 60_000);

  it('画不出来的内容：默认拒绝并逐项列出，不建任务；skip 时跳过并逐项警告（T35）', async () => {
    const videoId = await newVideo('带坏矢量图');
    const red = await fixture('red.mp4');
    const svg = await fixture('broken.svg');
    const { sequenceId } = video(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: red, ref: 'r' },
      { type: 'addItem', sequenceId, asset: { ref: 'r' }, at: at(0), alignment: 'nearest-frame' },
    ]);
    const track = await overlayTrack(videoId);
    await edit(videoId, [
      { type: 'importAsset', path: svg, ref: 's' },
      { type: 'addItem', sequenceId, asset: { ref: 's' }, trackId: track, at: at(0), alignment: 'nearest-frame' },
    ]);
    const svgItem = video(videoId).items.find((i) => i.type === 'image')!;
    const range = { start: 0, end: 1 };

    const refused = await rejection(client.request('exports.create', { videoId, settings: { kind: 'video', format: 'mp4', range } }));
    expect(refused.details).toMatchObject({
      code: 'EXPORT_UNSUPPORTED_CONTENT',
      items: [{ itemId: svgItem.id, scope: 'asset', layerKind: 'image', reason: 'asset-undecodable' }],
    });
    expect((await client.request('exports.list', { videoId })).jobs).toEqual([]);

    const skipped = await exportOnce({ videoId, settings: { kind: 'video', format: 'mp4', range, onUnsupported: 'skip' } });
    expect(skipped.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'EXPORT_CONTENT_SKIPPED', detail: expect.stringContaining(svgItem.id) })]),
    );
    const rate = video(videoId).fps.num / video(videoId).fps.den;
    const frame = frameAt(skipped.result!.outputs![0]!.path!, Math.round(0.5 * rate), rate, 320, 180);
    expect(pixel(frame, 320, 160, 90)[0]).toBeGreaterThan(200);
  });
});
