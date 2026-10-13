import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateAsrResult, type AsrResult, type TranscribeRun, type TranscribeSink } from '@cuccut/models';
import type { DeclaredModel } from '@cuccut/protocol';
import { CompatibleAdapter } from './openai-compatible/compatible-adapter.ts';
import { OnlineTranscriber } from './online-transcriber.ts';
import { openAiTranscriptionReply, startFakeProviderServer, type FakeProviderServer } from './testing/fake-provider-server.ts';

/**
 * Integration of the online transcription executor with real ffmpeg: decoding, slicing at silences, submitting chunk by chunk, and mapping times back to the media clock. The provider is a local fake service.
 */

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!hasFfmpeg) console.warn('跳过在线转写的 ffmpeg 集成测试：没有 ffmpeg');

const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_SEC = 32_000;

describe.skipIf(!hasFfmpeg)('OnlineTranscriber（真实 ffmpeg + 假的兼容端点）', () => {
  let dir: string;
  let server: FakeProviderServer;
  /** 2 s tone · 1 s silence · 2 s tone · 1 s silence · 2 s tone, 8 s in total. */
  let speech: string;
  let videoOnly: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-online-'));
    speech = path.join(dir, 'speech.m4a');
    const tone = 'sine=frequency=440:duration=2';
    const gap = 'anullsrc=r=16000:cl=mono:d=1';
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y'],
      ...[
        '-f',
        'lavfi',
        '-i',
        tone,
        '-f',
        'lavfi',
        '-i',
        gap,
        '-f',
        'lavfi',
        '-i',
        tone,
        '-f',
        'lavfi',
        '-i',
        gap,
        '-f',
        'lavfi',
        '-i',
        tone,
      ],
      ...['-filter_complex', '[0][1][2][3][4]concat=n=5:v=0:a=1', '-ar', '16000', '-ac', '1', '-c:a', 'aac', speech],
    ]);
    videoOnly = path.join(dir, 'video-only.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=64x64:rate=10:duration=1', '-c:v', 'mpeg4', videoOnly]);
    server = await startFakeProviderServer((request) => openAiTranscriptionReply(request, 'hello world'));
  });

  afterAll(async () => {
    await server?.close();
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  const transcriber = (declared: DeclaredModel) =>
    new OnlineTranscriber({
      providerId: 'custom:local-whisper',
      label: '本机 Whisper',
      adapter: new CompatibleAdapter(() => '本机 Whisper'),
      config: async () => ({ providerId: 'custom:local-whisper', baseUrl: `${server.origin}/v1`, credential: null, declared: [declared] }),
      ffmpeg: async () => ({ command: 'ffmpeg', env: process.env }),
      http: { backoffMs: () => 5 },
    });

  const run = async (file: string, extra: Partial<TranscribeRun> = {}) => {
    const staging = await fs.mkdtemp(path.join(dir, 'staging-'));
    const events: string[] = [];
    const progress: number[] = [];
    const sink: TranscribeSink = {
      loading: () => events.push('loading'),
      phase: (phase) => events.push(phase),
      progress: (p) => progress.push(p.done),
      segment: () => events.push('segment'),
      warning: (w) => events.push(`warning:${w.code}`),
      language: (tag) => events.push(`language:${tag}`),
    };
    const input: TranscribeRun = {
      jobId: 'job-1',
      runGeneration: 1,
      providerId: 'custom:local-whisper',
      modelId: 'whisper-large',
      bundleId: null,
      input: { file, contentHash: 'sha256:test', track: 0 },
      options: { language: { mode: 'prefer', tag: null }, diarize: false, timescale: 48_000 },
      staging,
      ...extra,
    };
    const attempt = await transcriber({ modelId: 'whisper-large', maxInputBytes: 150_000 }).transcribe(
      input,
      sink,
      new AbortController().signal,
    );
    expect(attempt.outcome).toBe('completed');
    const result = JSON.parse(await fs.readFile(path.join(staging, 'result.json'), 'utf8')) as AsrResult;
    const leftovers = await fs.readdir(staging);
    return { result, events, progress, leftovers };
  };

  it('超过单次请求的上限：在静音处切成几块，每块不超过上限，段的时间按块的起点换回素材时钟', async () => {
    const before = server.requests.length;
    const { result, events, progress, leftovers } = await run(speech);
    const uploads = server.requests.slice(before);
    expect(uploads.length).toBeGreaterThanOrEqual(2);
    for (const upload of uploads) {
      expect(upload.path).toBe('/v1/audio/transcriptions');
      expect(upload.headers.authorization).toBeUndefined();
      expect(upload.file).toMatchObject({ type: 'audio/wav' });
      expect(upload.file!.size).toBeLessThanOrEqual(150_000);
      expect(upload.fields.model).toEqual(['whisper-large']);
      expect(upload.fields.response_format).toEqual(['verbose_json']);
    }
    // Each chunk's start = the sum of the durations of the chunks before it (estimated from WAV byte counts; ffmpeg's header may add a few dozen bytes, so the comparison tolerance is 10 ms);
    // the fake service returns one segment of 0.1–0.9 seconds for each chunk.
    let cursor = 0;
    const expectedStarts = uploads.map((upload) => {
      const start = cursor;
      cursor += (upload.file!.size - WAV_HEADER_BYTES) / WAV_BYTES_PER_SEC;
      return Math.round((start + 0.1) * 48_000);
    });
    expect(cursor).toBeCloseTo(8, 1);
    // The cut points fall within the silences (between 2–3 s and 5–6 s), not in the middle of a tone.
    const cuts = expectedStarts.slice(1).map((ticks) => ticks / 48_000 - 0.1);
    for (const cut of cuts) expect([2, 5].some((s) => cut > s - 0.1 && cut < s + 1.1)).toBe(true);
    expect(result.segments.map((s) => s.start)).toEqual(expectedStarts.map((t) => expect.closeTo(t, -3)));
    expect(result.segments.every((s, i) => i === 0 || s.start > result.segments[i - 1]!.end)).toBe(true);
    expect(result.segments.flatMap((s) => s.words).every((w) => w.timingQuality === 'provider')).toBe(true);
    expect(result).toMatchObject({ outcome: 'transcribed', timescale: 48_000, coverage: [{ start: 0 }] });
    expect(result.duration).toBeGreaterThan(7.9 * 48_000);
    expect(result.provenance).toMatchObject({ provider: 'custom:local-whisper', models: { asr: { revision: 'whisper-large' } } });
    expect(validateAsrResult(result, { runGeneration: 1 })).toMatchObject({ ok: true });
    expect(events).toEqual(['decoding', 'transcribing', 'language:en', 'finalizing', ...result.segments.map(() => 'segment')]);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBeCloseTo(8, 1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(leftovers).toEqual(['result.json']);
  });

  it('请求的范围：从范围起点解码，时间加回偏移；超出结尾的部分记 range-clamped', async () => {
    const before = server.requests.length;
    const { result, events } = await run(speech, {
      input: { file: speech, contentHash: 'sha256:test', track: 0, range: { start: 6 * 1000, end: 20 * 1000, timescale: 1000 } },
    });
    expect(server.requests.length - before).toBe(1);
    expect(result.coverage).toEqual([{ start: 6 * 48_000, end: result.duration }]);
    expect(result.duration).toBeCloseTo(8 * 48_000, -4);
    expect(result.segments[0]!.start).toBe(Math.round(6.1 * 48_000));
    expect(result.warnings.map((w) => w.code)).toContain('range-clamped');
    expect(events).toContain('warning:range-clamped');
    expect(validateAsrResult(result, { runGeneration: 1 })).toMatchObject({ ok: true });
  });

  it('没有音轨：不请求供应商，结果是 no-audio-track', async () => {
    const before = server.requests.length;
    const { result, leftovers } = await run(videoOnly);
    expect(server.requests.length).toBe(before);
    expect(result).toMatchObject({ outcome: 'no-audio-track', duration: 0, coverage: [], segments: [] });
    expect(validateAsrResult(result, { runGeneration: 1 })).toMatchObject({ ok: true });
    expect(leftovers).toEqual(['result.json']);
  });
});
