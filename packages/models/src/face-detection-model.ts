import { modelAssetPath } from './model-assets.ts';

/**
 * The face detection model shipped with the app: YuNet (OpenCV Zoo `face_detection_yunet_2023mar.onnx`, MIT, about 230 KB), loaded by the `face-detect` process (`crates/face-detect`). `videos_frames` marks face boxes on each frame. The source, license and checksum are in `packages/models/assets/face-detection/COPYING.txt`.
 */
export interface FaceDetectionModel {
  /** Identifier of the detector, reported with results (`detector` in `videos_frames`). */
  id: 'yunet';
  /** Relative path within the model data directory (`model-assets.ts`). The absolute path is resolved at use time with `faceDetectionModelFile`. */
  asset: string;
  /** The file's SHA-256 (hex). It is checked against the source, and the tests use it to prevent substitution. */
  sha256: string;
}

export const FACE_DETECTION_MODEL: FaceDetectionModel = {
  id: 'yunet',
  asset: 'face-detection/yunet-2023mar.onnx',
  sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
};

/** The model's absolute path. Null when the model data directory cannot be found (does not check whether the file exists). */
export function faceDetectionModelFile(env: NodeJS.ProcessEnv = process.env): string | null {
  return modelAssetPath(FACE_DETECTION_MODEL.asset, env);
}
