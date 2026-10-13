import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '@cuccut/harness';
import { FACE_DETECTION_MODEL, faceDetectionModelFile } from '@cuccut/models';
import { JsonLineWorker, findBundledBinary } from '@cuccut/process-host';

/**
 * Faces on frames (`faces` of `videos_frames`): the YuNet model shipped with the app (`FACE_DETECTION_MODEL` from `@cuccut/models`) is loaded by the `face-detect` process (`crates/face-detect`, pure Rust inference, one implementation for both Windows and macOS). Each call starts one process, loads the model once, and queries frame by frame. If the process or model is missing, fails to start, or errors midway, nothing is thrown: the whole call falls back to `null` (`detector: null` in the result), and the frames are still returned.
 */

/** A face: the top-left corner of the box and its width and height, normalized to the frame's width and height (0–1); `score` is the confidence, 0–1. */
export interface DetectedFace {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface FaceDetection {
  detector: typeof FACE_DETECTION_MODEL.id;
  /** One-to-one with the files passed in. */
  faces: DetectedFace[][];
}

export interface FaceDetector {
  /** Detects faces in these images (absolute paths to PNG or JPEG files). `null` when unavailable or on failure. */
  detect(files: readonly string[]): Promise<FaceDetection | null>;
}

/** Environment variable that sets the `face-detect` path (for development and tests). */
export const FACE_DETECT_ENV = 'CUCCUT_FACE_DETECT';

/** Per-frame time limit: a frame usually takes a few tens of milliseconds, leaving headroom for a busy machine. */
const DETECT_TIMEOUT_MS = 15_000;

/** Location of `face-detect`: `CUCCUT_FACE_DETECT`; the native program directory shipped with the app; or the cargo output directory found by walking up from this module. */
export function resolveFaceDetectCommand(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env[FACE_DETECT_ENV]) return env[FACE_DETECT_ENV];
  return findBundledBinary('face-detect', path.dirname(fileURLToPath(import.meta.url)), env);
}

export interface FaceDetectorOptions {
  log: Logger;
  env?: NodeJS.ProcessEnv;
  /** For tests: replaces `resolveFaceDetectCommand` and `faceDetectionModelFile`. */
  command?: string | null;
  model?: string | null;
}

/** Detector that starts the `face-detect` process. The process and model are looked up again on each call (when not found, logs only once). */
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

/** Keeps only the five agreed-upon fields (fields the process reports beyond these are not passed on). */
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
