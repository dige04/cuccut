import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Logger } from '@cuccut/harness';
import { faceDetectionModelFile } from '@cuccut/models';
import { withFaces } from './agent-tools/video-frames.ts';
import { createFaceDetector, resolveFaceDetectCommand, type FaceDetector } from './face-detection.ts';

/**
 * Face detection (`faces` of `videos_frames`): falls back to null without raising an error when unavailable. When the `face-detect` build artifact is present (`npm run build:engine`), it runs for real against the bundled YuNet model. Samples containing faces are not committed to the repository: the “finds a face” test runs only when `CUCCUT_FACE_FIXTURE` (a PNG or JPEG with a face) is set.
 */

function recordingLogger(): Logger & { lines: Array<{ level: string; message: string; fields?: Record<string, unknown> }> } {
  const lines: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
  const at =
    (level: string) =>
    (message: string, fields?: Record<string, unknown>) =>
      lines.push({ level, message, ...(fields ? { fields } : {}) });
  const logger = { lines, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error'), child: () => logger };
  return logger;
}

const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const command = resolveFaceDetectCommand();

describe('人脸检测不可用时', () => {
  it('找不到 face-detect 或模型：整次退回 null，只记一次日志', async () => {
    const log = recordingLogger();
    const noBinary = createFaceDetector({ log, command: null });
    expect(await noBinary.detect(['/x.png'])).toBeNull();
    expect(await noBinary.detect(['/x.png'])).toBeNull();
    expect(log.lines.filter((l) => l.message === 'Face detection unavailable')).toHaveLength(1);

    const noModel = createFaceDetector({ log: recordingLogger(), command: '/bin/true', model: path.join(os.tmpdir(), 'no-such-model.onnx') });
    expect(await noModel.detect(['/x.png'])).toBeNull();
  });

  it('进程起不来：null', async () => {
    const detector = createFaceDetector({ log: recordingLogger(), command: path.join(os.tmpdir(), 'no-such-face-detect'), model: faceDetectionModelFile() });
    expect(await detector.detect(['/x.png'])).toBeNull();
  });
});

describe('给帧标人脸（withFaces）', () => {
  const frames = [
    { at: '0', file: '/a.png', width: 10 },
    { at: '1', file: null },
    { at: '2', file: '/b.png', width: 10 },
  ];

  it('有文件的帧按顺序拿到各自的 faces，没有文件的帧不加', async () => {
    const seen: string[][] = [];
    const detector: FaceDetector = {
      async detect(files) {
        seen.push([...files]);
        return { detector: 'yunet', faces: [[{ x: 0.1, y: 0.2, w: 0.3, h: 0.4, score: 0.9 }], []] };
      },
    };
    const result = await withFaces(detector, frames);
    expect(seen).toEqual([['/a.png', '/b.png']]);
    expect(result).toEqual({
      detector: 'yunet',
      frames: [
        { at: '0', file: '/a.png', width: 10, faces: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4, score: 0.9 }] },
        { at: '1', file: null },
        { at: '2', file: '/b.png', width: 10, faces: [] },
      ],
    });
  });

  it('没有检测器或检测失败：detector 为 null，faces 是空数组', async () => {
    const failing: FaceDetector = { detect: async () => null };
    for (const detector of [undefined, failing]) {
      const result = await withFaces(detector, frames);
      expect(result.detector).toBeNull();
      expect(result.frames.map((f) => ('faces' in f ? f.faces : 'none'))).toEqual([[], 'none', []]);
    }
  });
});

describe.skipIf(!command || !ffmpeg)('face-detect 与随附的 YuNet 模型（真实进程）', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-face-detect-'));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('纯色与测试图案上没有脸；读不了的文件让整次退回 null', async () => {
    const blank = path.join(dir, 'blank.png');
    const pattern = path.join(dir, 'pattern.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=640x360', '-frames:v', '1', blank]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720', '-frames:v', '1', pattern]);
    const log = recordingLogger();
    const detector = createFaceDetector({ log });
    expect(await detector.detect([blank, pattern])).toEqual({ detector: 'yunet', faces: [[], []] });
    const timing = log.lines.find((l) => l.message === 'Detected faces');
    expect(timing?.fields).toMatchObject({ frames: 2, loadMs: expect.any(Number), detectMs: [expect.any(Number), expect.any(Number)] });

    expect(await detector.detect([blank, path.join(dir, 'missing.png')])).toBeNull();
    expect(log.lines.some((l) => l.level === 'warn' && l.message === 'Face detection failed')).toBe(true);
  });

  it.skipIf(!process.env.CUCCUT_FACE_FIXTURE)('真实的人脸帧（CUCCUT_FACE_FIXTURE）：至少一张脸，框在 0–1 之内', async () => {
    const found = await createFaceDetector({ log: recordingLogger() }).detect([process.env.CUCCUT_FACE_FIXTURE!]);
    expect(found?.detector).toBe('yunet');
    const faces = found!.faces[0]!;
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(Object.keys(face).sort()).toEqual(['h', 'score', 'w', 'x', 'y']);
      expect(face.x).toBeGreaterThanOrEqual(0);
      expect(face.y).toBeGreaterThanOrEqual(0);
      expect(face.x + face.w).toBeLessThanOrEqual(1.0001);
      expect(face.y + face.h).toBeLessThanOrEqual(1.0001);
      expect(face.score).toBeGreaterThan(0.5);
    }
  });
});
