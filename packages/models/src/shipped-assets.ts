/**
 * Narrow entry point for model data shipped with the app and read by path (`@cuccut/models/assets`): resolution functions, the self-test sample, the built-in voice catalogue and the face detection model, without the rest of the model package modules. The desktop build's check entry (`apps/desktop/src/main/model-assets-check.ts`) imports only this, so the whole model package does not get pulled into a shared chunk.
 */
export { MODEL_ASSETS_ENV, modelAssetPath, resolveModelAssetsDir } from './model-assets.ts';
export { TRANSCRIBE_SELF_TEST, selfTestSampleFile, type SelfTestSample } from './self-test-sample.ts';
export { BUILTIN_VOICES, builtinVoiceFile, type BuiltinVoice } from './speech-voices.ts';
export { FACE_DETECTION_MODEL, faceDetectionModelFile, type FaceDetectionModel } from './face-detection-model.ts';
