import crypto from 'node:crypto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACE_DETECTION_MODEL, faceDetectionModelFile } from './face-detection-model.ts';

describe('随应用分发的人脸检测模型', () => {
  it('在模型数据目录里，内容与登记的 SHA-256 一致，旁边有来源与许可', () => {
    const file = faceDetectionModelFile({});
    expect(file).not.toBeNull();
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file!)).digest('hex');
    expect(digest).toBe(FACE_DETECTION_MODEL.sha256);
    const copying = fs.readFileSync(file!.replace(/yunet-2023mar\.onnx$/, 'COPYING.txt'), 'utf8');
    expect(copying).toContain(FACE_DETECTION_MODEL.sha256);
    expect(copying).toContain('MIT License');
  });
});
