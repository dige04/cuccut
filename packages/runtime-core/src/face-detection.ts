import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '@cuccut/harness';
import { FACE_DETECTION_MODEL, faceDetectionModelFile } from '@cuccut/models';
import { JsonLineWorker, findBundledBinary } from '@cuccut/process-host';

/**
 * 帧上的人脸（`videos_frames` 的 `faces`）：随应用分发的 YuNet 模型（`@cuccut/models` 的 `FACE_DETECTION_MODEL`）由
 * `face-detect` 进程（`crates/face-detect`，纯 Rust 推理，Windows 与 macOS 同一份实现）载入，一次调用起一个进程、载入一次模型、
 * 逐帧问。进程或模型缺失、起不来、中途出错都不报错：整次调用退回 `null`（结果里 `detector: null`），帧照常返回。
 */

/** 一张脸：框的左上角与宽高，按帧的宽高归一化到 0–1；`score` 是 0–1 的置信度。 */
export interface DetectedFace {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface FaceDetection {
  detector: typeof FACE_DETECTION_MODEL.id;
  /** 与传入的文件一一对应。 */
  faces: DetectedFace[][];
}

export interface FaceDetector {
  /** 检测这几张图（PNG 或 JPEG 的绝对路径）。不可用或失败时 null。 */
  detect(files: readonly string[]): Promise<FaceDetection | null>;
}

/** 指定 `face-detect` 路径的环境变量（开发与测试用）。 */
export const FACE_DETECT_ENV = 'CUCCUT_FACE_DETECT';

/** 单帧的时限：一帧通常几十毫秒，留足机器繁忙时的余量。 */
const DETECT_TIMEOUT_MS = 15_000;

/** `face-detect` 的位置：`CUCCUT_FACE_DETECT`；随应用分发的原生程序目录；或从本模块往上找 cargo 产物目录。 */
export function resolveFaceDetectCommand(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env[FACE_DETECT_ENV]) return env[FACE_DETECT_ENV];
  return findBundledBinary('face-detect', path.dirname(fileURLToPath(import.meta.url)), env);
}

export interface FaceDetectorOptions {
  log: Logger;
  env?: NodeJS.ProcessEnv;
  /** 测试用：代替 `resolveFaceDetectCommand` 与 `faceDetectionModelFile`。 */
  command?: string | null;
  model?: string | null;
}

/** 起 `face-detect` 进程的检测器。进程与模型每次调用时再找（找不到时只记一次日志）。 */
export function createFaceDetector(options: FaceDetectorOptions): FaceDetector {
  const log = options.log;
  const env = options.env ?? process.env;
  let reported = false;
  const unavailable = (reason: string, fields: Record<string, unknown> = {}) => {
    if (!reported) log.info('Face detection unavailable', { reason, ...fields });
    reported = true;
    return null;
  };
  return {
    async detect(files) {
      if (files.length === 0) return { detector: FACE_DETECTION_MODEL.id, faces: [] };
      const command = options.command !== undefined ? options.command : resolveFaceDetectCommand(env);
      if (!command) return unavailable('face-detect not found');
      const model = options.model !== undefined ? options.model : faceDetectionModelFile(env);
      if (!model || !isFile(model)) return unavailable('model missing', { model });
      const started = Date.now();
      let loadMs: number | null = null;
      let worker: JsonLineWorker;
      try {
        worker = await JsonLineWorker.start({ command, args: [model], env });
      } catch (error) {
        return unavailable('face-detect failed to start', { error: (error as Error).message });
      }
      worker.onEvent((event) => {
        if (event.event === 'ready') loadMs = (event.params as { loadMs?: number } | null)?.loadMs ?? null;
      });
      try {
        const faces: DetectedFace[][] = [];
        const timings: number[] = [];
        for (const file of files) {
          const result = await worker.request<{ faces: DetectedFace[]; ms: number }>('detect', { file }, { timeoutMs: DETECT_TIMEOUT_MS });
          faces.push(result.faces.map(face));
          timings.push(result.ms);
        }
        log.info('Detected faces', {
          frames: files.length,
          loadMs,
          detectMs: timings,
          totalMs: Date.now() - started,
        });
        return { detector: FACE_DETECTION_MODEL.id, faces };
      } catch (error) {
        log.warn('Face detection failed', { error: (error as Error).message, stderr: worker.stderrTail().slice(-2000) });
        return null;
      } finally {
        await worker.close().catch(() => {});
      }
    },
  };
}

/** 只留约定的五个字段（进程以后多报的不往外传）。 */
function face(raw: DetectedFace): DetectedFace {
  return { x: raw.x, y: raw.y, w: raw.w, h: raw.h, score: raw.score };
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
