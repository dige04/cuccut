import { modelAssetPath } from './model-assets.ts';

/**
 * 随应用分发的人脸检测模型：YuNet（OpenCV Zoo `face_detection_yunet_2023mar.onnx`，MIT，约 230 KB），由 `face-detect`
 * 进程载入（`crates/face-detect`），`videos_frames` 给每帧标出人脸框。来源、许可与校验和见
 * `packages/models/assets/face-detection/COPYING.txt`。
 */
export interface FaceDetectionModel {
  /** 检测器的标识，随结果报告（`videos_frames` 的 `detector`）。 */
  id: 'yunet';
  /** 模型数据目录里的相对路径（`model-assets.ts`）；绝对路径用 `faceDetectionModelFile` 在用时求。 */
  asset: string;
  /** 文件的 SHA-256（十六进制）：与来源核对，测试据此防止被换掉。 */
  sha256: string;
}

export const FACE_DETECTION_MODEL: FaceDetectionModel = {
  id: 'yunet',
  asset: 'face-detection/yunet-2023mar.onnx',
  sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
};

/** 模型的绝对路径；找不到模型数据目录时 null（不检查文件在不在）。 */
export function faceDetectionModelFile(env: NodeJS.ProcessEnv = process.env): string | null {
  return modelAssetPath(FACE_DETECTION_MODEL.asset, env);
}
