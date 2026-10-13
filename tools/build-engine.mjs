// Builds the native processes: the video engine (engine-host), the Render Worker (export-worker), speech-worker, face detection (face-detect), and the local inference process (model-worker).
// The model-worker's inference backend depends on the platform (architecture design §6.5): on macOS with Apple Silicon, it uses the default features (MLX + Core ML);
// on other platforms, turn off the default features and enable candle and whisper.cpp's Whisper (`whisper-ggml`; the build needs CMake and a C++ compiler).
// CUCCUT_WORKER_FEATURES (comma-separated) appends more features, for example `cuda,whisper-ggml-cuda` on NVIDIA GPUs (candle and Whisper both use CUDA, which needs the CUDA Toolkit; on build machines without a GPU, also set CMAKE_CUDA_ARCHITECTURES). On AMD / Intel GPUs, set `whisper-ggml-vulkan` (needs the Vulkan SDK).
// Other arguments are passed through as-is to both cargo build runs (for example `npm run build:engine -- --release`).
// Both builds always run to completion; if either one fails, exit with a non-zero code, consistent with cargo's --keep-going.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCargo } from './cargo-path.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extra = process.argv.slice(2);

/** Feature arguments for model-worker: on macOS with Apple Silicon, keep the defaults; on other platforms, switch to candle and whisper-ggml; then add the ones from the environment variable. */
function modelWorkerFeatureArgs(platform, arch, workerFeatures) {
  const added = (workerFeatures ?? '')
    .split(',')
    .map((feature) => feature.trim())
    .filter(Boolean);
  if (platform === 'darwin' && arch === 'arm64') return added.length ? ['--features', added.join(',')] : [];
  const base = ['backend-candle', 'whisper-ggml'];
  return ['--no-default-features', '--features', [...base, ...added.filter((f) => !base.includes(f))].join(',')];
}

function cargo(args) {
  console.log(`> cargo ${args.join(' ')}`);
  const result = spawnSync('cargo', args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status === 0;
}

ensureCargo();

// --no-default-features applies to every package in the command, so model-worker is built separately.
const engines = cargo(['build', '--keep-going', '-p', 'engine-host', '-p', 'export-worker', '-p', 'speech-worker', '-p', 'face-detect', ...extra]);
const worker = cargo([
  'build',
  '-p',
  'model-worker',
  ...modelWorkerFeatureArgs(process.platform, process.arch, process.env.CUCCUT_WORKER_FEATURES),
  ...extra,
]);
if (!engines || !worker) process.exit(1);
