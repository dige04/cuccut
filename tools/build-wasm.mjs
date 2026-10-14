// Compile the purely semantic WASM and place it in the package that uses it:
// - The editor preview (bindings/preview-wasm) goes into the UI package; the UI imports it with `?inline`, so neither the dev server nor the packaged file:// page needs to fetch a separate file;
// - The editing semantics shared by the UI and Node (bindings/editor-wasm: sentences and fingerprints, stage frames……) go into @cuccut/editor-wasm; they are inlined in the browser and read from a file in Node.
// The preview and export share the fonts shipped with the render core (crates/render-raster/assets/fonts). The native build compiles them into the binary, but WASM does not include them; they are copied into the UI package, and the UI reads and injects them (the fonts are over 20 MB, so they are not inlined).
// If binaryen's wasm-opt is available, run it again to shrink the output; without it the build still works, just with a larger output.
// On machines that use rustup, install the wasm32-unknown-unknown target first if it is missing.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCargo } from './cargo-path.mjs';

ensureCargo();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = [
  { crate: 'preview-wasm', file: 'preview_wasm.wasm', output: 'packages/ui/src/render/generated/preview.wasm', label: 'preview WASM' },
  { crate: 'editor-wasm', file: 'editor_wasm.wasm', output: 'packages/editor-wasm/src/generated/editor.wasm', label: 'editor semantics WASM' },
];

// Turn on WASM SIMD (tiny-skia's f32x4 and similar use simd128): frame-by-frame preview rasterization becomes several times faster. Chromium, Electron and Node all support it.
// Applies only to the wasm32 target; host build scripts and proc macros are unaffected.
const env = { ...process.env, CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS: '-C target-feature=+simd128' };

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
  if (result.error) throw result.error;
  return result.status === 0;
}

// Look up the toolchain that applies under the repo directory. If there is no rustup (for example, Rust installed by a system package manager), skip this; a missing target is reported by the build below.
const targets = spawnSync('rustup', ['target', 'list', '--installed'], { cwd: root, encoding: 'utf8' });
if (targets.status === 0 && !targets.stdout.split(/\r?\n/).includes('wasm32-unknown-unknown')) {
  console.log('> rustup target add wasm32-unknown-unknown');
  if (!run('rustup', ['target', 'add', 'wasm32-unknown-unknown'])) process.exit(1);
}

const cargo = ['build', ...outputs.flatMap(({ crate }) => ['-p', crate]), '--target', 'wasm32-unknown-unknown', '--profile', 'wasm'];
if (!run('cargo', cargo)) {
  console.error('WASM failed to build. If the target is missing, run first: rustup target add wasm32-unknown-unknown');
  process.exit(1);
}

// The target directory may have been moved elsewhere by .cargo/config.local.toml, so ask cargo for its real location.
const metadata = spawnSync('cargo', ['metadata', '--format-version', '1', '--no-deps'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (metadata.status !== 0) {
  console.error(metadata.stderr);
  process.exit(1);
}
const builtDir = join(JSON.parse(metadata.stdout).target_directory, 'wasm32-unknown-unknown/wasm');

const features = [
  '--enable-bulk-memory',
  '--enable-nontrapping-float-to-int',
  '--enable-sign-ext',
  '--enable-mutable-globals',
  '--enable-simd',
];
let warned = false;
for (const { file, output: relative, label } of outputs) {
  const built = join(builtDir, file);
  const output = join(root, relative);
  mkdirSync(dirname(output), { recursive: true });
  const optimized = spawnSync('wasm-opt', ['-Oz', ...features, built, '-o', output], { cwd: root, stdio: 'inherit' });
  if (optimized.error || optimized.status !== 0) {
    if (optimized.error && !warned) console.warn('wasm-opt not found, using the cargo output directly');
    warned = true;
    copyFileSync(built, output);
  }
  console.log(`${label}: ${output} (${Math.round(statSync(output).size / 1024)} KB)`);
}

const fontSource = join(root, 'crates/render-raster/assets/fonts');
const fontOutput = join(root, 'packages/ui/src/render/generated/fonts');
rmSync(fontOutput, { recursive: true, force: true });
mkdirSync(fontOutput, { recursive: true });
let fontBytes = 0;
const fonts = readdirSync(fontSource).filter((name) => name.endsWith('.ttf'));
for (const name of fonts) {
  copyFileSync(join(fontSource, name), join(fontOutput, name));
  fontBytes += statSync(join(fontOutput, name)).size;
}
console.log(`preview fonts: ${fontOutput} (${fonts.length} files, ${Math.round(fontBytes / 2 ** 20)} MB)`);
