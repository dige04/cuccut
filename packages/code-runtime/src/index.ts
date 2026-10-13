/**
 * Code-package runtime (architecture design §8, §13.1 `code-runtime`): import validation, off-screen execution, frame capture and baking for browser compositions.
 *
 * - `bundle-inspect.ts`: reads the directory, rejects symbolic links and files outside the allowlist, computes `contentHash`, validates or synthesizes the manifest, and statically scans for network references.
 * - `composition-host.ts`: the host process for Electron off-screen windows (a JSON-line child process), which intercepts every request other than `file:` / `data:`.
 * - `composition-adapter.ts`: the unified frame-capture script in the page for the two author contracts (`cuccut/1`, `hyperframes/1`).
 * - `bundle-verify.ts`: the verification items of the code-package spec §6.2, producing `CodeBundleVerificationReport`.
 * - `composition-bake.ts`: captures PNGs frame by frame at the output frame rate, encodes them via ffmpeg into an alpha QuickTime, and produces the asset-side fields of `BakeRecord`.
 */

export {
  CodeBundleError,
  computeContentHash,
  inspectBundle,
  listBundleFiles,
  scanNetworkReferences,
  synthesizeManifest,
  parseRate,
  readRootAttributes,
  toRate,
  type BundleLimits,
  type InspectBundleOptions,
  type InspectedBundle,
  type ListBundleFilesOptions,
  type NetworkReference,
  type SynthesizeManifestInput,
  type SynthesizeOverrides,
} from './bundle-inspect.ts';
export {
  CompositionHost,
  frameTicketAt,
  intrinsicMismatches,
  resolveElectronBinary,
  type CompositionHostOptions,
  type CompositionPage,
  type CompositionSession,
  type OpenSessionOptions,
  type RenderedFrame,
} from './composition-host.ts';
export { COMPOSITION_ADAPTER_SCRIPT, type AdapterPageInfo } from './composition-adapter.ts';
export { verifyBundle, type VerifyBundleOptions } from './bundle-verify.ts';
export { bakeComposition, ffprobePathFor, resolveFfmpeg, type BakeOptions, type BakeResult } from './composition-bake.ts';
