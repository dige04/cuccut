import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SequenceItem, Track, VideoItem, VideoSnapshot } from '@cuccut/protocol';
import { silentLogger } from '@cuccut/harness';
import { MediaAnalysis, type SceneCut } from '../media-analysis.ts';
import { ShotsError, detectShots, shotSegments, shotsRange, shotsToolError } from './video-shots.ts';

const track = (id: string, order: number): Track => ({
  id,
  order,
  kind: 'visual',
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: 'visual' },
});

function clip(id: string, fromFrame: number, durationFrames: number, sourceSeconds: number, extra: Partial<VideoItem> = {}): VideoItem {
  return {
    enabled: true,
    locked: false,
    followPolicy: { kind: 'sequence-fixed' },
    id,
    trackId: 'trk_v1',
    paintOrder: 0,
    type: 'video',
    span: { fromFrame, durationFrames },
    place: {},
    assetRef: { id: 'asset_v', revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: String(Math.round(sourceSeconds * 3000)), timescale: 3000 }, rate: { num: 1, den: 1 } },
    embeddedAudio: { enabled: true, volume: 1 },
    ...extra,
  };
}

function video(items: SequenceItem[]): VideoSnapshot {
  return {
    format: 'cuccut.video',
    schemaVersion: 3,
    timeContractVersion: 1,
    id: 'video_1',
    name: 'V',
    revision: '3',
    rootSequenceId: 'seq_1',
    sequences: {
      seq_1: {
        id: 'seq_1',
        revision: '3',
        name: 'Main',
        fps: { num: 30, den: 1 },
        canvas: { width: 320, height: 180, workingSpace: 'srgb', background: '#000000' },
        durationPolicy: { kind: 'derived' },
        tracks: [track('trk_v1', 0), track('trk_v2', 1)],
        items,
        animationBindings: [],
        transitions: [],
        markers: [],
        ducking: [],
      },
    },
    assets: {
      asset_v: {
        id: 'asset_v',
        kind: 'video',
        name: 'cat.mp4',
        currentRevision: '1',
        revisions: {
          '1': {
            revision: '1',
            contentHash: `sha256:${'ab'.repeat(32)}`,
            byteLength: 10,
            mediaType: 'video/mp4',
            storage: { mode: 'linked', locator: { path: 'cat.mp4' }, frozen: false },
            duration: { ticks: '11', timescale: 2 },
            video: { width: 320, height: 180 },
          },
        },
      },
    },
    documents: {},
    fonts: {},
    localizationSets: {},
    canvasVariants: {},
    syncGroups: {},
    protections: {},
    checkpoints: {},
    links: [],
  } as unknown as VideoSnapshot;
}

/** 假的分析：记下每次的源区间，按给定的源时刻回切换点。 */
function fakeAnalysis(sceneAt: SceneCut[]) {
  const calls: { fromSec: number; durSec: number; threshold: number }[] = [];
  const analysis = {
    sceneCuts: async (_asset: unknown, options: { fromSec: number; durSec: number; threshold: number }) => {
      calls.push(options);
      return sceneAt.filter((c) => c.at >= options.fromSec && c.at < options.fromSec + options.durSec);
    },
  } as unknown as MediaAnalysis;
  return { calls, deps: { analysis, assetFile: async () => ({ root: '/', file: 'x' }) } };
}

describe('镜头切换：分段与切换点（假的分析）', () => {
  it('区间对到帧，空的与超过 20 分钟的拒绝', () => {
    const v = video([clip('a', 0, 300, 0)]);
    expect(shotsRange(v, { start: 1.01, end: 2.99 })).toMatchObject({ from: 30, to: 90 });
    expect(shotsRange(v, {})).toMatchObject({ from: 0, to: 300 });
    expect(() => shotsRange(v, { start: 20, end: 30 })).toThrow(ShotsError);
    const long = video([clip('a', 0, 30 * 60 * 21, 0)]);
    expect(() => shotsRange(long, {})).toThrow(expect.objectContaining({ code: 'SHOTS_RANGE_TOO_LONG' }));
    expect(() => shotsRange(v, { start: 3, end: 2 })).toThrow(expect.objectContaining({ code: 'SHOTS_RANGE_EMPTY' }));
    expect(shotsToolError(new ShotsError('SHOTS_RANGE_TOO_LONG'))).toMatchObject({ code: 'INVALID_ARGUMENTS', extra: { code: 'SHOTS_RANGE_TOO_LONG' } });
    const other = new Error('x');
    expect(shotsToolError(other)).toBe(other);
  });

  it('场景切换按片段的时间映射换回时间线（源起点不为 0、时间线起点不为 0），对到帧', async () => {
    // 时间线 2–6s 播源 10–14s；源 11.5s 与 13.0s 处有切换 → 时间线 3.5s、5s。
    const v = video([clip('a', 60, 120, 10)]);
    const { calls, deps } = fakeAnalysis([
      { at: 11.5, score: 0.6 },
      { at: 13.0, score: 0.4 },
    ]);
    const result = await detectShots(deps, v, { start: 2, end: 6 });
    expect(calls).toEqual([{ fromSec: 10, durSec: 4, threshold: 0.3 }]);
    expect(result.cuts).toEqual([
      { at: 3.5, score: 0.6, kind: 'scene' },
      { at: 5, score: 0.4, kind: 'scene' },
    ]);
    expect(result.shots.map((s) => [s.start, s.end])).toEqual([
      [2, 3.5],
      [3.5, 5],
      [5, 6],
    ]);
    // 取帧时刻在帧的正中：镜头 [2, 3.5) 的 20%、50%、80%。
    expect(result.shots[0]!.sampleAt).toEqual(['2.3167', '2.75', '3.2167']);
  });

  it('换了片段、源画面接不上的地方是 edit；同一素材源时间接续的拆分不算切换', async () => {
    // a：0–2s 播源 0–2s；b：2–4s 播源 2–4s（接续）；c：4–6s 播源 30–32s（跳）。
    const v = video([clip('a', 0, 60, 0), clip('b', 60, 60, 2), clip('c', 120, 60, 30)]);
    const { deps } = fakeAnalysis([]);
    const result = await detectShots(deps, v, {});
    expect(result.cuts).toEqual([{ at: 4, score: null, kind: 'edit' }]);
  });

  it('上层轨道盖住一段：盖住与移开的地方各一处 edit；分段按最上层的片段', async () => {
    const v = video([clip('a', 0, 180, 0), clip('pip', 60, 30, 50, { trackId: 'trk_v2' })]);
    expect(shotSegments(v, 0, 180).map((s) => [s.from, s.to, s.source?.item.id])).toEqual([
      [0, 60, 'a'],
      [60, 90, 'pip'],
      [90, 180, 'a'],
    ]);
    const { calls, deps } = fakeAnalysis([]);
    const result = await detectShots(deps, v, { minShot: 0 });
    expect(result.cuts.map((c) => [c.at, c.kind])).toEqual([
      [2, 'edit'],
      [3, 'edit'],
    ]);
    // 每段各自检测：a 的两截各一次，pip 一次。
    expect(calls.map((c) => [c.fromSec, c.durSec])).toEqual([
      [0, 2],
      [50, 1],
      [3, 3],
    ]);
  });

  it('短于 minShot 的镜头并进前一个，第一个并进后一个', async () => {
    const v = video([clip('a', 0, 300, 0)]);
    const { deps } = fakeAnalysis([
      { at: 0.3, score: 0.5 },
      { at: 4, score: 0.5 },
      { at: 4.5, score: 0.5 },
      { at: 8, score: 0.5 },
    ]);
    const result = await detectShots(deps, v, { minShot: 0.8 });
    // [0, 0.3) 太短并进后一个（去掉 0.3）；[4, 4.5) 太短并进前一个（去掉 4）。
    expect(result.cuts.map((c) => c.at)).toEqual([4.5, 8]);
    expect((await detectShots(deps, v, { minShot: 0 })).cuts.map((c) => c.at)).toEqual([0.3, 4, 4.5, 8]);
  });
});

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasFfmpeg)('镜头切换（真实 ffmpeg）', () => {
  let dir: string;
  let analysis: MediaAnalysis;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-shots-'));
    // testsrc 2s + 纯红 1.5s + 彩条 2s：切换点在源 2s 与 3.5s。关键帧间隔 300，跳转要从头解码到目标附近。
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y'],
      ...['-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=2'],
      ...['-f', 'lavfi', '-i', 'color=c=red:size=320x180:rate=30:duration=1.5'],
      ...['-f', 'lavfi', '-i', 'smptebars=size=320x180:rate=30:duration=2'],
      ...['-filter_complex', '[0][1][2]concat=n=3:v=1:a=0', '-c:v', 'mpeg4', '-g', '300', path.join(dir, 'cat.mp4')],
    ]);
    analysis = new MediaAnalysis({
      cacheDir: path.join(dir, 'cache'),
      log: silentLogger,
      ffmpeg: async () => ({ command: 'ffmpeg', env: process.env }),
    });
  });

  afterAll(async () => {
    analysis.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const deps = () => ({ analysis, assetFile: async () => ({ root: dir, file: 'cat.mp4' }) });

  it('sceneCuts：切换点在源时钟上，跳转的偏移已加回', async () => {
    const asset = { contentHash: `sha256:${'cd'.repeat(32)}`, mediaType: 'video/mp4', durationSec: 5.5 };
    const cuts = await analysis.sceneCuts(asset, { fromSec: 1, durSec: 4, threshold: 0.3 }, async () => ({ root: dir, file: 'cat.mp4' }));
    expect(cuts.map((c) => Math.round(c.at * 30))).toEqual([60, 105]);
    for (const c of cuts) expect(c.score).toBeGreaterThan(0.3);
  });

  it('时间线起点不为 0、源从 1s 起播：切换点 ±1 帧，镜头与取帧时刻落在各自镜头里', async () => {
    // 时间线 3–7.5s 播源 1–5.5s：源 2s、3.5s 的切换 → 时间线 4s、5.5s。
    const v = video([clip('a', 90, 135, 1)]);
    // 前 3 秒是空的：从空到有画面也是一处 edit。
    expect((await detectShots(deps(), v, {})).cuts.map((c) => [c.at, c.kind])[0]).toEqual([3, 'edit']);
    const result = await detectShots(deps(), v, { start: 3 });
    expect(result.cuts.map((c) => c.kind)).toEqual(['scene', 'scene']);
    const frames = result.cuts.map((c) => c.at * 30);
    expect(Math.abs(frames[0]! - 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(frames[1]! - 165)).toBeLessThanOrEqual(1);
    expect(result.shots).toHaveLength(3);
    for (const shot of result.shots) {
      for (const at of shot.sampleAt) {
        expect(Number(at)).toBeGreaterThanOrEqual(shot.start);
        expect(Number(at)).toBeLessThan(shot.end);
      }
    }
  });

  it('两个片段剪在一起：接口处是 edit，各段里的场景切换照常', async () => {
    // a：0–3s 播源 0–3s（含 2s 的切换）；b：3–5s 播源 3.5–5.5s（彩条）。接口处源从 3s 跳到 3.5s。
    const v = video([clip('a', 0, 90, 0), clip('b', 90, 60, 3.5)]);
    const result = await detectShots(deps(), v, {});
    expect(result.cuts.map((c) => [Math.round(c.at * 30), c.kind])).toEqual([
      [60, 'scene'],
      [90, 'edit'],
    ]);
  });
});
