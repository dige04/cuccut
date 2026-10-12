import assert from 'node:assert/strict';
import { test } from 'node:test';
import { macPackagePlan } from './macos-package-plan.mjs';

test('local Intel builds select x64 and candle with embedded Whisper Metal instead of MLX', () => {
  const plan = macPackagePlan({ platform: 'mac', local: true, hostPlatform: 'darwin', hostArch: 'x64' });
  assert.equal(plan.target, 'x86_64-apple-darwin');
  assert.equal(plan.electronArch, 'x64');
  assert.equal(plan.directory, 'mac');
  assert.deepEqual(plan.modelWorkerFeatures, ['backend-candle', 'whisper-ggml-metal']);
  assert.equal(plan.noDefaultFeatures, true);
  assert.equal(plan.needsMlxLibrary, false);
});

test('published Apple Silicon configuration retains MLX and default features', () => {
  const plan = macPackagePlan({ hostPlatform: 'darwin', hostArch: 'arm64' });
  assert.equal(plan.target, 'aarch64-apple-darwin');
  assert.equal(plan.directory, 'mac-arm64');
  assert.deepEqual(plan.modelWorkerFeatures, []);
  assert.equal(plan.noDefaultFeatures, false);
  assert.equal(plan.needsMlxLibrary, true);
});

test('rejects public Intel packages, cross builds, non-Mac hosts and Windows GPU variants', () => {
  for (const options of [
    { target: 'x86_64-apple-darwin' },
    { local: true, target: 'aarch64-apple-darwin' },
    { local: true, variant: 'vulkan' },
    { local: true, hostPlatform: 'linux' },
    { local: true, target: 'x86_64-pc-windows-msvc' },
  ]) assert.throws(() => macPackagePlan({ hostPlatform: 'darwin', hostArch: 'x64', ...options }));
});
