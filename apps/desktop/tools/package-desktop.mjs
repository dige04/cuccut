// Desktop packaging: Windows x64 produces unsigned NSIS / ZIP; Apple Silicon produces signed, notarized ZIP / DMG; Mac --local produces a locally, temporarily signed package (including Intel Metal).
// Both platforms share the staging and Runtime resource layout. Mac requires --build, --sign-sha1, a fresh output directory and a clean commit; the signing flow is in macos-distribution.mjs.
// Mac options: --platform mac, --notary-profile, --sign-keychain, --metallib; the Windows-specific options and flow are as follows.
//
// Prerequisites: `npm run build` (out/), `npm run build:web` (apps/web/dist), `npm run build:slides-editor` (apps/slides-editor/dist),
// `npm run build:design-editor` (apps/design-editor/dist) and `npm run build:design-system-editor` (apps/design-system-editor/dist);
// the root package:win script runs them first.
// Steps:
// 1. Build the Workers: `cargo build --release --locked --target <triple>`. The Model Worker picks its backend by variant (the standard build uses candle CPU and whisper.cpp's
//    Whisper; the CUDA build uses CUDA for both candle and Whisper; the Vulkan build uses Vulkan for Whisper);
//    `--bin-dir <directory>` uses already-built executables instead (for smoke tests of local cross-compilation).
// 2. In a temporary directory outside the repository, assemble an app containing only the build output: out/, a package.json generated from the third-party packages that out actually requires at runtime, and their node_modules.
//    Do not package apps/desktop directly: its dependencies include workspace TypeScript packages and React meant only for the renderer, which would be packed into the asar as-is.
// 3. Resources are placed under `<resources>` according to `src/main/packaged-resources.ts` (the same one the main process uses when it starts the Runtime): bin/ (Workers, credential helpers;
//    the CUDA build also carries the NVIDIA runtime libraries), templates/, skills/ (manuals and built-in skills), model-assets/, web/, slides-editor/, design-editor/,
//    design-system-editor/. All of these are outside the asar, since child processes read them by path.
// 4. electron-builder produces the package. It downloads Electron's win32-x64 distribution and the NSIS tooling into its own cache directory (~/Library/Caches/electron-builder, etc.).
// 5. Verify the unpacked package: every item in resources is present, and the asar contains the main process, the Runtime and editor.wasm. On Windows, check-packaged-app.mjs runs it for real as well.
// 6. Write the release report `<artifact name>-release.json`: version, build, variant, installer and zip file names, sizes and sha256. When --download-base-url is given, also write `appcast-<target>[-<variant>].json` in the app's update-source format (schema-1, releaseManifest in app-update-rules.ts), then read it back with the app's own parser.
//
// Options: --variant cpu|cuda|vulkan (default cpu), --target <triple> (default x86_64-pc-windows-msvc), --bin-dir <directory>, --cuda-redist <directory>
// (default $CUDA_PATH/bin/x64 or $CUDA_PATH/bin), --worker-features <a,b> (extra features for the Model Worker), --out <directory> (default apps/desktop/dist/<variant>,
// already ignored by .gitignore), --targets nsis,zip, --keep-staging, --build <positive integer> (the release build number, written into the app's package.json and the artifact name;
// if not given, build is 0 and the app does not check for updates), --download-base-url <https address> (the directory the installer is uploaded to; requires --build and nsis),
// --rollout-hours <n> (staged rollout: automatic checks open up gradually over n hours; requires --download-base-url; the update source also records `releasedAt` = the time of generation;
// the rollout is counted from that moment. If the upload is late, change it to the actual release time; it is not covered by any digest). Exit codes: 0 success, 1 failure.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { BUNDLE_ID, PRODUCT_NAME, feedFileName, feedTarget, parseManifest, releaseManifest } from '../src/main/app-update-rules.ts';
import { BUNDLED_EXECUTABLES, RESOURCE_DIRS } from '../src/main/packaged-resources.ts';
import { ensureCargo } from '../../../tools/cargo-path.mjs';
import { DISTRIBUTED_NOTICES } from '../../../tools/third-party-notices.ts';
import { distributeMac, runMac, signingPreflight } from './macos-distribution.mjs';
import { macElectronLanguages, shareMacFonts } from './macos-package-resources.mjs';
import { macPackagePlan } from './macos-package-plan.mjs';
import { LOCALES } from '../../../packages/protocol/src/i18n.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, '..');
const ROOT = path.resolve(DESKTOP, '../..');

/** The bundle identifier the app update recognizes; the product name determines the file names of the exe and the NSIS uninstaller (the app recognizes an installed copy by `Uninstall CucCut.exe`). */
const APP_ID = BUNDLE_ID;
/** The target of the app update source (the one the app computes as win32 / x64; unrelated to the --target used when building the Workers). */
let FEED_TARGET;

/**
 * Backends of the Model Worker, in three tiers by graphics card:
 * - Standard: candle CPU on all platforms and whisper.cpp's Whisper (CPU); machines without a suitable graphics card use this one.
 * - CUDA (NVIDIA only, Ampere / RTX 30 and later): both the candle CUDA feature (`cuda`) and Whisper's ggml CUDA backend (`whisper-ggml-cuda`) are enabled.
 *   The exe statically links ggml-cuda and dynamically links cudart / cublas, so it will not start on machines without an NVIDIA driver (candle's cudarc behaves the same way).
 * - Vulkan: Whisper uses Vulkan GPU (AMD / Intel, and NVIDIA cards that do not support CUDA 13); candle stays on the CPU (as in the v2 Vulkan build).
 *   The build machine needs the Vulkan SDK; at runtime only vulkan-1.dll, which the graphics driver supplies, is needed, and it is not shipped in the package.
 * Choosing CUDA or Vulkan at runtime from a single installer is not possible yet (architecture design §14, “single GPU installer chooses its backend at runtime”). The CUDA build's Whisper and the Vulkan build are both untested.
 * The macOS default MLX / CoreML are not included. Other Workers use the default features.
 */
const VARIANTS = {
  cpu: { suffix: '', modelWorkerFeatures: ['backend-candle', 'whisper-ggml'] },
  cuda: { suffix: '-cuda', modelWorkerFeatures: ['backend-candle', 'cuda', 'whisper-ggml-cuda'] },
  vulkan: { suffix: '-vulkan', modelWorkerFeatures: ['backend-candle', 'whisper-ggml-vulkan'] },
};

/**
 * NVIDIA runtime libraries shipped with the CUDA build (CUDA 13.x, placed next to model-worker.exe; the user only needs the graphics driver): cudart / cublas / curand / nvrtc.
 * cublas pulls in cublasLt, and NVRTC loads nvrtc-builtins. The manifest follows the v2 Windows CUDA release (both use candle 0.11); when the toolchain version changes, this must be updated too.
 * Whisper's ggml-cuda (whisper-rs-sys 0.15, built without GGML_STATIC) links cudart and cublas (with cublasLt) and the driver's cuda (nvcuda.dll, supplied by the graphics driver). All of these are either in the manifest or not shipped, so no libraries need to be added. Checked against whisper-rs-sys's build.rs and ggml-cuda's CMakeLists; untested
 * (the workflow's dumpbin step lists the actual dependencies).
 */
const CUDA_REDIST_DLLS = [
  'cudart64_13.dll',
  'cublas64_13.dll',
  'cublasLt64_13.dll',
  'curand64_10.dll',
  'nvrtc64_130_0.dll',
  'nvrtc-builtins64_131.dll',
];
const CUDA_NOTICE = [
  'This package bundles unmodified NVIDIA CUDA runtime libraries (the DLLs next',
  'to model-worker.exe). They are redistributed under the NVIDIA CUDA Toolkit End User',
  'License Agreement (https://docs.nvidia.com/cuda/eula/index.html) and are not',
  'covered by the CucCut license.',
  'GPU inference requires an NVIDIA GPU with compute capability >= 8.0',
  '(Ampere / RTX 30 series or newer) and a recent NVIDIA driver.',
  'No CUDA Toolkit installation is required. Machines without such a GPU should',
  'use the standard package.',
  '',
].join('\n');

const { values: options } = parseArgs({
  options: {
    variant: { type: 'string', default: 'cpu' },
    platform: { type: 'string', default: 'win' },
    local: { type: 'boolean', default: false },
    target: { type: 'string' },
    'sign-sha1': { type: 'string' },
    'notary-profile': { type: 'string', default: process.env.CUCCUT_NOTARY_PROFILE || 'cuccut-notary' },
    'sign-keychain': { type: 'string' },
    metallib: { type: 'string' },
    'bin-dir': { type: 'string' },
    'cuda-redist': { type: 'string' },
    'worker-features': { type: 'string', default: '' },
    out: { type: 'string' },
    targets: { type: 'string' },
    'keep-staging': { type: 'boolean', default: false },
    build: { type: 'string' },
    'download-base-url': { type: 'string' },
    'rollout-hours': { type: 'string' },
  },
});

function fail(message) {
  console.error(`Packaging failed: ${message}`);
  process.exit(1);
}

function run(command, args, env = process.env) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit', shell: false });
  if (result.error) fail(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}`);
}

/**
 * The GPU architectures that the CUDA build's Whisper (ggml-cuda) is compiled for, using the same convention as candle's `CUDA_COMPUTE_CAP=80`: compute_80 PTX (from Ampere on; newer cards are JIT-compiled by the driver),
 * plus machine code for each of RTX 30 / 40 / 50 (86, 89, 120; ggml's CMake rewrites 120 to 120a to use the Blackwell-specific instructions).
 * This must be set explicitly: if GGML_NATIVE=ON is set from outside, ggml uses `native`, but the build machine (CI runner) has no GPU, so the architecture CMake detects is a meaningless value; ggml then leaves
 * `native` as is, and nvcc cannot compile on a machine without a GPU. whisper-rs-sys passes environment variables starting with `CMAKE_` through to CMake unchanged, which is how this gets through. Untested.
 */
const DEFAULT_CMAKE_CUDA_ARCHITECTURES = '80-virtual;86-real;89-real;120-real';

/**
 * Environment for building the Model Worker. All three variants build ggml-cpu (the CUDA and Vulkan builds also have CPU operators), and all must turn off `GGML_NATIVE`: it defaults to ON, and on MSVC
 * FindSIMD.cmake actually runs a probe program on the build machine; if it finds AVX-512, it adds `/arch:AVX512` to the whole ggml-cpu, and the program crashes with an illegal instruction on users' CPUs that lack it.
 * It is replaced with a fixed AVX2 baseline (on MSVC, `/arch:AVX2` plus FMA, F16C and BMI2; from Haswell / Zen on). `GGML_AVX2=ON` is set explicitly so as not to depend on ggml's
 * default derivation (when `SOURCE_DATE_EPOCH` is set, it falls back to SSE2). If set externally, the external value is used. whisper-rs-sys passes `GGML_*` environment variables through to CMake, but does not rerun it because of them;
 * when a value changes, its build output must be cleared first (README, “Windows packaging”). Untested.
 *
 * The CUDA build also follows the v2 Windows CUDA release: the PTX target defaults to compute_80 (from Ampere on; candle with CUDA 13 cannot compile older ones); nvcc's host-target object files default to
 * the static CRT (/MT), which does not match Rust's dynamic CRT, so on Windows it is changed to /MD (nvcc, invoked by CMake for ggml-cuda, picks this up too). Whisper's ggml-cuda additionally needs
 * `CMAKE_CUDA_ARCHITECTURES` (the external value is used if one is given). On Windows whisper-rs-sys also needs `CUDA_PATH` to find the import libraries (the CUDA installer and the workflow's
 * CUDA installation step set it).
 */
function modelWorkerBuildEnv() {
  const base = { ...process.env, GGML_NATIVE: process.env.GGML_NATIVE || 'OFF' };
  if (options.target.startsWith('x86_64-')) base.GGML_AVX2 = process.env.GGML_AVX2 || 'ON';
  if (options.variant !== 'cuda') return base;
  const env = {
    ...base,
    CUDA_COMPUTE_CAP: process.env.CUDA_COMPUTE_CAP || '80',
    CMAKE_CUDA_ARCHITECTURES: process.env.CMAKE_CUDA_ARCHITECTURES || DEFAULT_CMAKE_CUDA_ARCHITECTURES,
  };
  if (process.platform === 'win32') {
    const flags = env.NVCC_APPEND_FLAGS ?? '';
    if (/(?:^|[\s,="'])\/(?:MTd?|MDd)(?=$|[\s,"'])/i.test(`${env.NVCC_PREPEND_FLAGS ?? ''} ${flags}`)) {
      fail('NVCC_PREPEND_FLAGS / NVCC_APPEND_FLAGS contain /MT, /MTd or /MDd; the CUDA build needs the dynamic CRT (/MD)');
    }
    if (!/(?:^|[\s,="'])\/MD(?=$|[\s,"'])/i.test(flags)) env.NVCC_APPEND_FLAGS = `${flags} -Xcompiler=/MD`.trim();
  }
  return env;
}

const isMac = options.platform === 'mac';
if (!['win', 'mac'].includes(options.platform)) fail('--platform must be win or mac');
if (options.local && !isMac) fail('--local is only supported for Mac packaging');
let macPlan;
try { if (isMac) macPlan = macPackagePlan(options); } catch (error) { fail(error.message); }
options.target ??= isMac ? macPlan.target : 'x86_64-pc-windows-msvc';
options.targets ??= isMac ? 'dmg,zip' : 'nsis,zip';
FEED_TARGET = feedTarget(isMac ? 'darwin' : 'win32', isMac ? macPlan.electronArch : 'x64');
const variant = VARIANTS[options.variant];
if (!variant) fail(`Unknown variant ${options.variant} (cpu, cuda or vulkan)`);
if (!isMac && !options.target.includes('windows')) fail(`Unsupported target: ${options.target}`);
const exe = (name) => isMac ? name : `${name}.exe`;
const outDir = path.resolve(options.out ?? path.join(DESKTOP, 'dist', isMac ? 'mac' : options.variant));
const packageTargets = options.targets.split(',').filter(Boolean);
const build = options.build === undefined || options.build === '' ? 0 : Number(options.build);
if (!Number.isInteger(build) || build < 0) fail(`--build needs a positive integer, got ${options.build}`);
const downloadBase = options['download-base-url'] || null;
if (options.local && (downloadBase || build || options['sign-sha1'] || options['sign-keychain'])) fail('Local Mac packages cannot specify a public feed, build number or signing identity');
if (downloadBase) {
  if (!/^https:\/\/[^\s?#]+$/.test(downloadBase)) fail(`--download-base-url needs an https address without query parameters, got ${downloadBase}`);
  if (build === 0) fail('--download-base-url also needs --build');
  if (!isMac && !packageTargets.includes('nsis')) fail('--download-base-url needs the nsis installer');
}
const rolloutHours = options['rollout-hours'] === undefined || options['rollout-hours'] === '' ? null : Number(options['rollout-hours']);
if (rolloutHours !== null) {
  if (!Number.isFinite(rolloutHours) || rolloutHours < 0) fail(`--rollout-hours needs a number not less than 0, got ${options['rollout-hours']}`);
  if (!downloadBase) fail('--rollout-hours also needs --download-base-url');
}

let sourceCommit = null;
if (isMac) {
  if ((!options.local && build === 0) || options.targets !== 'dmg,zip') fail('Mac packaging requires --targets dmg,zip; releases also require --build');
  if (existsSync(outDir) && readdirSync(outDir).length) fail('Mac release output directory must be new or empty');
  if (runMac('git', ['status', '--porcelain=v1', '--untracked-files=all']).trim()) fail('Commit source changes before building a Mac release');
  sourceCommit = runMac('git', ['rev-parse', 'HEAD']).trim();
  if (!options.local) signingPreflight(options['sign-sha1'], options['notary-profile'], options['sign-keychain']);
}

for (const required of [
  'out/main/index.js',
  'out/main/runtime.js',
  'out/main/generated/editor.wasm',
  'out/preload/index.js',
  'out/renderer/index.html',
]) {
  if (!existsSync(path.join(DESKTOP, required))) fail(`Missing apps/desktop/${required}: run npm run build first`);
}
if (!existsSync(path.join(ROOT, 'apps/web/dist/index.html'))) fail('Missing apps/web/dist/index.html: run npm run build:web first');
// The slides editor's page and the compiler used by slides_check (docs/design/slides §3).
const SLIDES_EDITOR_DIST = path.join(ROOT, 'apps/slides-editor/dist');
const SLIDES_EDITOR_FILES = ['index.html', 'node/compiler.cjs'];
for (const file of SLIDES_EDITOR_FILES) {
  if (!existsSync(path.join(SLIDES_EDITOR_DIST, file))) fail(`Missing apps/slides-editor/dist/${file}: run npm run build:slides-editor first`);
}
// The design editor's page, the canvas runtime and the quick-edit Worker (docs/design/canvas §3).
const DESIGN_EDITOR_DIST = path.join(ROOT, 'apps/design-editor/dist');
const DESIGN_EDITOR_FILES = ['index.html', 'artifact-type/dc-runtime.js', 'artifact-type/fast-edit-worker.js'];
for (const file of DESIGN_EDITOR_FILES) {
  if (!existsSync(path.join(DESIGN_EDITOR_DIST, file))) fail(`Missing apps/design-editor/dist/${file}: run npm run build:design-editor first`);
}
// The design-system editor's page, its preview page, and the React UMD build used for preview (docs/design/canvas §10.2).
const DESIGN_SYSTEM_EDITOR_DIST = path.join(ROOT, 'apps/design-system-editor/dist');
const DESIGN_SYSTEM_EDITOR_FILES = [
  'index.html',
  'artifact-type/run.html',
  'artifact-type/vendor/react.production.min.js',
  'artifact-type/vendor/react-dom.production.min.js',
];
for (const file of DESIGN_SYSTEM_EDITOR_FILES) {
  if (!existsSync(path.join(DESIGN_SYSTEM_EDITOR_DIST, file))) {
    fail(`Missing apps/design-system-editor/dist/${file}: run npm run build:design-system-editor first`);
  }
}

// 1. Worker。
let binSource;
if (options['bin-dir']) {
  binSource = path.resolve(options['bin-dir']);
} else {
  ensureCargo();
  const cargo = ['build', '--release', '--locked', '--target', options.target];
  run('cargo', [...cargo, ...BUNDLED_EXECUTABLES.filter((name) => name !== 'model-worker').flatMap((name) => ['-p', name]),
    ...(isMac ? ['--features', 'export-worker/external-fonts'] : [])]);
  const features = [...(isMac ? macPlan.modelWorkerFeatures : variant.modelWorkerFeatures), ...options['worker-features'].split(',').filter(Boolean)];
  run('cargo', [...cargo, '-p', 'model-worker', ...(!isMac || macPlan.noDefaultFeatures ? ['--no-default-features'] : []), ...(features.length ? ['--features', features.join(',')] : [])], isMac ? process.env : modelWorkerBuildEnv());
  const metadata = spawnSync('cargo', ['metadata', '--format-version', '1', '--no-deps'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (metadata.status !== 0) fail(`cargo metadata: ${metadata.stderr}`);
  binSource = path.join(JSON.parse(metadata.stdout).target_directory, options.target, 'release');
}

const staging = mkdtempSync(path.join(tmpdir(), 'cuccut-package-'));
const appDir = path.join(staging, 'app');
const resDir = path.join(staging, 'resources');
try {
  // 2. An app containing only the build output.
  const desktop = JSON.parse(readFileSync(path.join(DESKTOP, 'package.json'), 'utf8'));
  mkdirSync(appDir, { recursive: true });
  cpSync(path.join(ROOT, 'LICENSE'), path.join(appDir, 'LICENSE'));
  cpSync(path.join(DESKTOP, 'out'), path.join(appDir, 'out'), { recursive: true });
  const externals = externalPackages(path.join(appDir, 'out'), desktop.dependencies ?? {});
  const dependencies = {};
  for (const name of externals) {
    const dir = resolvePackage(name, ROOT);
    dependencies[name] = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
  }
  copyClosure(externals, ROOT, path.join(appDir, 'node_modules'));
  writeFileSync(
    path.join(appDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'cuccut',
        productName: PRODUCT_NAME,
        version: desktop.version,
        description: 'CucCut',
        author: { name: PRODUCT_NAME },
        license: 'SEE LICENSE IN LICENSE',
        main: 'out/main/index.js',
        // The app update reads these two (app-update-ipc.ts): it compares the build number against the manifest, and the variant decides which update source to read. Packages without a build number do not check for updates.
        ...(build > 0 ? { cuccutBuild: build } : {}),
        ...(isMac ? { cuccutSourceCommit: sourceCommit } : {}),
        cuccutVariant: options.variant,
        dependencies,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `App third-party dependencies: ${
      Object.entries(dependencies)
        .map(([n, v]) => `${n}@${v}`)
        .join(', ') || 'none'
    }`,
  );

  // 3. Resources.
  const bin = path.join(resDir, RESOURCE_DIRS.bin);
  mkdirSync(bin, { recursive: true });
  for (const name of BUNDLED_EXECUTABLES) {
    const file = path.join(binSource, exe(name));
    if (!existsSync(file)) fail(`Missing ${file}`);
    if (isMac) runMac('lipo', [file, '-verify_arch', macPlan.intel ? 'x86_64' : 'arm64']);
    cpSync(file, path.join(bin, exe(name)));
  }
  if (options.variant === 'cuda') {
    const cudaPath = process.env.CUDA_PATH;
    const redist =
      options['cuda-redist'] ??
      (cudaPath ? [path.join(cudaPath, 'bin', 'x64'), path.join(cudaPath, 'bin')].find((dir) => existsSync(dir)) : undefined);
    if (!redist) fail('The CUDA build needs --cuda-redist <dir> or CUDA_PATH');
    for (const dll of CUDA_REDIST_DLLS) {
      const file = path.join(redist, dll);
      if (!existsSync(file) || statSync(file).size === 0) fail(`Missing CUDA runtime library ${file}`);
      cpSync(file, path.join(bin, dll));
    }
    writeFileSync(path.join(bin, 'CUDA-RUNTIME-NOTICE.txt'), CUDA_NOTICE);
  }
  if (isMac && macPlan.needsMlxLibrary) {
    const buildDir = path.join(binSource, 'build');
    const candidates = existsSync(buildDir) ? readdirSync(buildDir).filter((name) => name.startsWith('pmetal-mlx-sys-')).map((name) => path.join(buildDir, name, 'out/build/lib/mlx.metallib')).filter((file) => existsSync(file)) : [];
    const metallib = options.metallib || (candidates.length === 1 ? candidates[0] : null);
    if (!metallib || !existsSync(metallib)) fail('Require exactly one release mlx.metallib or pass --metallib from the same build');
    cpSync(metallib, path.join(bin, 'mlx.metallib'));
  }
  cpSync(path.join(ROOT, 'templates'), path.join(resDir, RESOURCE_DIRS.templates), { recursive: true });
  cpSync(path.join(ROOT, 'skills'), path.join(resDir, RESOURCE_DIRS.skills), { recursive: true });
  cpSync(path.join(ROOT, 'packages/models/assets'), path.join(resDir, RESOURCE_DIRS.modelAssets), { recursive: true });
  cpSync(path.join(ROOT, 'apps/web/dist'), path.join(resDir, RESOURCE_DIRS.web), { recursive: true });
  cpSync(SLIDES_EDITOR_DIST, path.join(resDir, RESOURCE_DIRS.slidesEditor), { recursive: true });
  cpSync(DESIGN_EDITOR_DIST, path.join(resDir, RESOURCE_DIRS.designEditor), { recursive: true });
  cpSync(DESIGN_SYSTEM_EDITOR_DIST, path.join(resDir, RESOURCE_DIRS.designSystemEditor), { recursive: true });
  if (isMac) {
    const fonts = shareMacFonts({ appDir, webDir: path.join(resDir, RESOURCE_DIRS.web),
      fontSource: path.join(ROOT, 'crates/render-raster/assets/fonts'), exportWorker: path.join(bin, 'export-worker') });
    console.log(`Shared ${Object.keys(fonts.manifest).length} fonts; removed ${(fonts.savedBytes / 2 ** 20).toFixed(1)} MiB from app.asar`);
  }

  // 4. electron-builder。
  const { build: buildElectron, Platform, Arch } = await import('electron-builder');
  const electronVersion = JSON.parse(readFileSync(path.join(resolvePackage('electron', ROOT), 'package.json'), 'utf8')).version;
  const onWindows = process.platform === 'win32';
  const buildPart = build > 0 ? `-build.${build}` : '';
  const artifact = `${PRODUCT_NAME}-\${version}${buildPart}-${isMac ? options.target : `win-x64${variant.suffix}`}`;
  await buildElectron({
    projectDir: appDir,
    targets: isMac ? Platform.MAC.createTarget(['dir'], Arch[macPlan.electronArch]) : Platform.WINDOWS.createTarget(packageTargets, Arch.x64),
    publish: 'never',
    config: {
      appId: APP_ID,
      productName: PRODUCT_NAME,
      electronVersion,
      directories: { output: outDir, buildResources: path.join(DESKTOP, 'build') },
      // There are no native Node modules; the third-party dependencies are already set up, so they are not reinstalled or rebuilt.
      npmRebuild: false,
      nodeGypRebuild: false,
      asar: true,
      files: ['out/**', 'package.json', 'LICENSE'],
      extraResources: [
        ...Object.values(RESOURCE_DIRS).map((dir) => ({ from: path.join(resDir, dir), to: dir })),
        ...DISTRIBUTED_NOTICES.map(({ source, fileName }) => ({ from: path.join(ROOT, source), to: fileName })),
      ],
      // Electron's fuses are not changed: the renderer reads file:// modules and fonts through GrantFileProtocolExtraPrivileges, and the Runtime starts in Node mode through RunAsNode
      // (the fonts section of architecture design §9.1). To turn them off, the renderer process must first be changed to be served by a custom protocol.
      mac: {
        electronLanguages: macElectronLanguages(LOCALES),
        icon: path.join(DESKTOP, 'build', 'icon.icns'),
        category: 'public.app-category.video',
        minimumSystemVersion: '14.0',
        bundleVersion: String(build),
        identity: null,
        notarize: false,
        extendInfo: {
          NSLocalNetworkUsageDescription: 'CucCut discovers and connects to local compute devices for transcription and generation.',
          NSMicrophoneUsageDescription: 'CucCut needs microphone access to record audio for transcription.',
          NSBonjourServices: ['_cuccut-node._tcp'],
        },
        extraFiles: [{ from: path.join(DESKTOP, 'build/localizations'), to: 'Resources' }],
      },
      win: {
        icon: path.join(DESKTOP, 'build', 'icon.ico'),
        artifactName: `${artifact}.\${ext}`,
        // Not signed (§14). Changing the exe's icon and version information requires rcedit, which needs Wine on macOS / Linux, so this is done only on Windows.
        signAndEditExecutable: onWindows,
      },
      nsis: {
        oneClick: true,
        perMachine: false,
        artifactName: `${artifact}-setup.\${ext}`,
        deleteAppDataOnUninstall: false,
      },
    },
  });

  // 5. Verify the unpacked package.
  const unpacked = isMac ? path.join(outDir, macPlan.directory, `${PRODUCT_NAME}.app`) : path.join(outDir, 'win-unpacked');
  verifyUnpacked(unpacked, options.variant);
  for (const name of readdirSync(outDir)) {
    const file = path.join(outDir, name);
    if (statSync(file).isFile() && /\.(exe|zip)$/.test(name))
      console.log(`Artifact: ${file} (${Math.round(statSync(file).size / 2 ** 20)} MB)`);
  }

  // 6. Release report and update source.
  if (isMac) {
    const stem = `${PRODUCT_NAME}-${desktop.version}${buildPart}-${options.target}${options.local ? '-local' : ''}`;
    const distribution = await distributeMac({ app: unpacked, output: outDir, stem, version: desktop.version, build, appId: APP_ID,
      local: options.local,
      signingSha1: options['sign-sha1'], profile: options['notary-profile'], keychain: options['sign-keychain'],
      executables: BUNDLED_EXECUTABLES.map((name) => path.join(unpacked, 'Contents/Resources/bin', name)),
      entitlements: path.join(DESKTOP, 'build/entitlements.mac.plist') });
    run(process.execPath, [path.join(HERE, 'check-packaged-app.mjs'), distribution.verifiedApp]);
    run(process.execPath, [path.join(HERE, 'check-file-fonts.mjs'),
      `--out=${path.join(distribution.verifiedApp, 'Contents/Resources/app.asar/out')}`]);
    const report = { schema: 1, product: PRODUCT_NAME, appId: APP_ID, version: desktop.version, build, target: options.target,
      sourceCommit, minimumSystemVersion: '14.0', ...distribution };
    writeFileSync(path.join(outDir, 'app-release.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (downloadBase) {
      const manifest = releaseManifest({ target: FEED_TARGET, variant: 'cpu', version: desktop.version, build, date: new Date().toISOString().slice(0, 10),
        format: 'zip', url: `${downloadBase.replace(/\/+$/, '')}/${distribution.portable.file}`, size: distribution.portable.size, sha256: distribution.portable.sha256 });
      const text = `${JSON.stringify(manifest, null, 2)}\n`;
      if (!parseManifest(text, FEED_TARGET, false).ok) fail('Mac appcast validation failed');
      writeFileSync(path.join(outDir, feedFileName(FEED_TARGET, null)), text);
    }
  } else writeReleaseFiles(`${PRODUCT_NAME}-${desktop.version}${buildPart}-win-x64${variant.suffix}`, desktop.version);
} finally {
  if (options['keep-staging']) console.log(`Temp directory kept: ${staging}`);
  else rmSync(staging, { recursive: true, force: true });
}

/** File size and sha256 (read as a stream, since installers can be hundreds of MB). */
function fileFacts(file) {
  const hash = createHash('sha256');
  const fd = openSync(file, 'r');
  const chunk = Buffer.alloc(4 * 1024 * 1024);
  let size = 0;
  try {
    for (;;) {
      const read = readSync(fd, chunk, 0, chunk.length, null);
      if (read === 0) break;
      hash.update(chunk.subarray(0, read));
      size += read;
    }
  } finally {
    closeSync(fd);
  }
  return { file: path.basename(file), size, sha256: hash.digest('hex') };
}

/**
 * The release report (always written) and the update source (written only when --download-base-url is given). The update source is generated with the app's own releaseManifest and read back with parseManifest,
 * using the same conventions the app follows when it checks for updates.
 */
function writeReleaseFiles(stem, version) {
  const installerPath = path.join(outDir, `${stem}-setup.exe`);
  const zipPath = path.join(outDir, `${stem}.zip`);
  const installer = packageTargets.includes('nsis') ? fileFacts(installerPath) : null;
  const portable = packageTargets.includes('zip') ? fileFacts(zipPath) : null;
  const report = {
    schema: 1,
    product: PRODUCT_NAME,
    appId: APP_ID,
    version,
    build,
    target: FEED_TARGET,
    variant: options.variant,
    unsigned: true,
    installer: installer && { format: 'exe', ...installer },
    portable: portable && { format: 'zip', ...portable },
    feed: feedFileName(FEED_TARGET, options.variant),
  };
  const reportPath = path.join(outDir, `${stem}-release.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Release report: ${reportPath}`);
  if (!downloadBase) return;
  const generatedAt = new Date();
  const manifest = releaseManifest({
    target: FEED_TARGET,
    variant: options.variant,
    version,
    build,
    date: generatedAt.toISOString().slice(0, 10),
    format: 'exe',
    url: `${downloadBase.replace(/\/+$/, '')}/${encodeURIComponent(installer.file)}`,
    size: installer.size,
    sha256: installer.sha256,
    ...(rolloutHours ? { rolloutHours, releasedAt: generatedAt.toISOString() } : {}),
  });
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const parsed = parseManifest(text, FEED_TARGET, false, options.variant);
  if (!parsed.ok) fail(`The generated update feed cannot be read back: ${parsed.error} ${parsed.detail}`);
  if (rolloutHours && !parsed.rollout) fail('The staged-rollout field in the generated update feed cannot be read back');
  const feedPath = path.join(outDir, report.feed);
  writeFileSync(feedPath, text);
  console.log(`Update feed: ${feedPath}`);
}

/** Third-party packages that out/main and out/preload actually require (only those listed in apps/desktop's dependencies count; strings in the code do not). */
function externalPackages(outDir, declared) {
  const builtins = new Set(builtinModules);
  const found = new Set();
  for (const sub of ['main', 'preload']) {
    for (const file of listFiles(path.join(outDir, sub)).filter((f) => f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs'))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/(?:require\(|from\s+|import\()\s*["']([^"'./][^"']*)["']/g)) {
        const spec = match[1];
        if (spec.startsWith('node:') || builtins.has(spec) || spec === 'electron') continue;
        const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (name in declared && !name.startsWith('@cuccut/')) found.add(name);
      }
    }
  }
  return [...found].sort();
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

/** Looks up `node_modules/<name>` from directory `from` upward, the way Node does (without going through exports, since some packages do not export package.json). */
function resolvePackage(name, from, optional = false) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return realpathSync(candidate);
    if (path.dirname(dir) === dir) break;
  }
  if (optional) return null;
  fail(`Dependency not found: ${name}`);
}

/** Copies these packages and their dependencies (production dependencies and installed optional dependencies) into a flat node_modules. Fails immediately on version conflicts; it does not guess. */
function copyClosure(names, fromDir, toModules) {
  const seen = new Map();
  const queue = names.map((name) => ({ name, from: fromDir }));
  while (queue.length > 0) {
    const { name, from } = queue.shift();
    const dir = resolvePackage(name, from);
    const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    if (seen.has(name)) {
      if (seen.get(name) !== manifest.version) fail(`${name} has two versions (${seen.get(name)}, ${manifest.version}); switch to a nested copy`);
      continue;
    }
    seen.set(name, manifest.version);
    cpSync(dir, path.join(toModules, name), { recursive: true, dereference: true });
    for (const dep of Object.keys(manifest.dependencies ?? {})) queue.push({ name: dep, from: dir });
    // Optional dependencies that are not installed are not included.
    for (const dep of Object.keys(manifest.optionalDependencies ?? {}))
      if (resolvePackage(dep, dir, true)) queue.push({ name: dep, from: dir });
  }
}

/** What the unpacked package should contain: checked item by item against the locations the main process gives the Runtime (packaged-resources.ts). */
function verifyUnpacked(dir, variantName) {
  const problems = [];
  const resources = path.join(dir, isMac ? 'Contents/Resources' : 'resources');
  for (const { source, fileName } of DISTRIBUTED_NOTICES) {
    const file = path.join(resources, fileName);
    if (!existsSync(file)) problems.push(`Missing resources/${fileName}`);
    else if (!readFileSync(file).equals(readFileSync(path.join(ROOT, source)))) problems.push(`resources/${fileName} does not match the source declaration`);
  }
  if (!existsSync(path.join(dir, isMac ? `Contents/MacOS/${PRODUCT_NAME}` : `${PRODUCT_NAME}.exe`))) problems.push(`Missing ${PRODUCT_NAME}.exe`);
  for (const name of BUNDLED_EXECUTABLES) {
    if (!existsSync(path.join(resources, RESOURCE_DIRS.bin, exe(name)))) problems.push(`Missing resources/${RESOURCE_DIRS.bin}/${exe(name)}`);
  }
  if (variantName === 'cuda') {
    for (const dll of CUDA_REDIST_DLLS) if (!existsSync(path.join(resources, RESOURCE_DIRS.bin, dll))) problems.push(`Missing ${dll}`);
  }
  for (const sub of Object.values(RESOURCE_DIRS)) if (!existsSync(path.join(resources, sub))) problems.push(`Missing resources/${sub}`);
  if (!existsSync(path.join(resources, RESOURCE_DIRS.web, 'index.html'))) problems.push('Missing resources/web/index.html');
  for (const file of SLIDES_EDITOR_FILES) {
    if (!existsSync(path.join(resources, RESOURCE_DIRS.slidesEditor, file))) problems.push(`Missing resources/${RESOURCE_DIRS.slidesEditor}/${file}`);
  }
  for (const file of DESIGN_EDITOR_FILES) {
    if (!existsSync(path.join(resources, RESOURCE_DIRS.designEditor, file))) problems.push(`Missing resources/${RESOURCE_DIRS.designEditor}/${file}`);
  }
  for (const file of DESIGN_SYSTEM_EDITOR_FILES) {
    if (!existsSync(path.join(resources, RESOURCE_DIRS.designSystemEditor, file))) {
      problems.push(`Missing resources/${RESOURCE_DIRS.designSystemEditor}/${file}`);
    }
  }
  const asar = path.join(resources, 'app.asar');
  if (!existsSync(asar)) problems.push('Missing resources/app.asar');
  else {
    const entries = new Set(asarEntries(asar));
    for (const entry of [
      '/package.json',
      '/LICENSE',
      '/out/main/index.js',
      '/out/main/runtime.js',
      '/out/main/generated/editor.wasm',
      '/out/preload/index.js',
      '/out/renderer/index.html',
    ]) {
      if (!entries.has(entry)) problems.push(`No ${entry} in asar`);
    }
  }
  if (problems.length > 0) fail(`Unpacked package is wrong:\n- ${problems.join('\n- ')}`);
  console.log(`Unpacked package check passed: ${dir}`);
}

/** The asar file listing (the header is JSON wrapped in a Chromium Pickle: its length starts at byte 12, and the JSON itself starts at byte 16). */
function asarEntries(file) {
  const fd = openSync(file, 'r');
  let header;
  try {
    const prefix = Buffer.alloc(16);
    readSync(fd, prefix, 0, 16, 0);
    const json = Buffer.alloc(prefix.readUInt32LE(12));
    readSync(fd, json, 0, json.length, 16);
    header = JSON.parse(json.toString('utf8'));
  } finally {
    closeSync(fd);
  }
  const entries = [];
  const walk = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files ?? {})) {
      const full = `${prefix}/${name}`;
      if (child.files) walk(child, full);
      else entries.push(full);
    }
  };
  walk(header, '');
  return entries;
}
