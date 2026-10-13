import {
  BUILTIN_VOICES,
  FACE_DETECTION_MODEL,
  TRANSCRIBE_SELF_TEST,
  builtinVoiceFile,
  faceDetectionModelFile,
  resolveModelAssetsDir,
  selfTestSampleFile,
} from '@cuccut/models/assets';

/**
 * Self-check entry for the main-process build (`npm run check:model-assets`, `tools/check-model-assets.mjs`). It is built with `out/main`; the app itself does not load it.
 * The check script runs this build with Electron's bundled Node (as the Runtime does, via `ELECTRON_RUN_AS_NODE`). Inside the bundle it calls the same resolution function the Runtime uses, and writes as one line of JSON the paths that the model data directory and each file shipped with the app resolve to (self-test samples, each built-in voice in the directory, and the face-detection model). Whether they exist is checked by the script.
 */
const files = [
  { asset: TRANSCRIBE_SELF_TEST.asset, file: selfTestSampleFile(TRANSCRIBE_SELF_TEST) },
  ...BUILTIN_VOICES.map((voice) => ({ asset: voice.asset, file: builtinVoiceFile(voice) })),
  { asset: FACE_DETECTION_MODEL.asset, file: faceDetectionModelFile() },
];
process.stdout.write(`${JSON.stringify({ dir: resolveModelAssetsDir(), files })}\n`);
