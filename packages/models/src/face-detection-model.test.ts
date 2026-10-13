import crypto from 'node:crypto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACE_DETECTION_MODEL, faceDetectionModelFile } from './face-detection-model.ts';

describe('face detection model shipped with the app', () => {
  it('is in the model data directory, its content matches the registered SHA-256, and its source and license sit alongside it', () => {
    const file = faceDetectionModelFile({});
    expect(file).not.toBeNull();
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file!)).digest('hex');
    expect(digest).toBe(FACE_DETECTION_MODEL.sha256);
    const copying = fs.readFileSync(file!.replace(/yunet-2023mar\.onnx$/, 'COPYING.txt'), 'utf8');
    expect(copying).toContain(FACE_DETECTION_MODEL.sha256);
    expect(copying).toContain('MIT License');
  });
});
