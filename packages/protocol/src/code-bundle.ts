import type { Id } from './domain.ts';
import type { CodeEdit, MediaTime, Rate, Revision, VersionRef } from './video.ts';
import type { MediaHandle } from './methods.ts';

/**
 * Wire types for code bundles (code bundle spec §2, §6, §7; architecture design §8).
 *
 * The meaning of the manifest follows the code bundle spec; this is a hand-written mirror of it. The verification report, the bake records, and the error codes are the shapes passed between the Runtime and the client in phase one (import, verify, frame fetch, bake).
 */

export const CODE_BUNDLE_FORMAT = 'cuccut.code-bundle';
export const CODE_BUNDLE_SCHEMA_VERSION = 1;

/**
 * Identifiers of the browser authoring contract (code bundle spec §4.1, §4.7).
 *
 * - `cuccut/1`: CucCut's own contract; the page exposes `AuthoredComposition` on `window.__cuccutCompositions[<compositionId>]` (`initialize` / `renderAt(time, params)` / `dispose`).
 * - `hyperframes/1`: HyperFrames' public contract (Apache-2.0): the root element carries `data-*` attributes such as `data-composition-id`, and `window.__timelines[<compositionId>]` is a paused timeline that can be `seek(seconds)`.
 */
export const CODE_BUNDLE_CONTRACTS = ['cuccut/1', 'hyperframes/1'] as const;
export type CodeBundleContract = (typeof CODE_BUNDLE_CONTRACTS)[number];

export interface CodeBundleFileEntry {
  /** A path relative to the package, `/`-separated. */
  path: string;
  /** Byte count. */
  size: number;
  /** Lowercase hex. */
  sha256: string;
}

/**
 * The prefix of `contentHash`. Its value is `'sha256-' + sha256(JSON.stringify(entries))`: `entries` is a `CodeBundleFileEntry[]` sorted by `path` (key order `path`, `size`, `sha256`, compact JSON), without the files in `CODE_BUNDLE_UNHASHED_FILES`;
 * the content of `files.manifest.json` is exactly this `entries`.
 */
export const CODE_BUNDLE_HASH_PREFIX = 'sha256-';

/**
 * Files that do not take part in `contentHash`: the manifest and the verification report reference this digest, and the file list records its own digests, so all three would be circular.
 * Consistent with the algorithm that `skills/cuccut/built-in-skills/motion-graphics/scripts/build-bundle.mjs` uses to write packages.
 */
export const CODE_BUNDLE_UNHASHED_FILES = ['bundle.manifest.json', 'files.manifest.json', 'verification.json'] as const;

export type CodeBundleRuntime =
  | { engine: 'browser'; contract: CodeBundleContract | string; entry: string; frameworkHints: string[] }
  | { engine: 'remotion'; entry: string; compositionId: string };

export type CodeBundleTimeDependency =
  | { kind: 'local-only' }
  | { kind: 'placement' }
  | { kind: 'cue-track'; ref: VersionRef }
  | { kind: 'sequence-clock' };

/** Code bundle spec §2.1. */
export interface CodeBundleManifest {
  format: typeof CODE_BUNDLE_FORMAT;
  schemaVersion: typeof CODE_BUNDLE_SCHEMA_VERSION;
  bundleId: Id;
  revision: Revision;
  contentHash: string;
  runtime: CodeBundleRuntime;
  source: { filesManifest: string; dependencyLock: string; buildRecipe: string };
  intrinsic: { width: number; height: number; fps: Rate; durationFrames: number };
  output: { alpha: boolean; colorSpace: string; audio: 'none' | 'stems' | 'mixed' };
  timing: { access: 'random' | 'sequential' | 'checkpointed'; fixedStep?: Rate };
  timeDependencies?: CodeBundleTimeDependency[];
  parametersSchemaRef?: string;
  exposedLayers?: Array<{ id: Id; isolation: 'independent' | 'requires-backdrop' }>;
  permissions: { network: 'deny'; assetIds: Id[] };
}

/** Capabilities measured by testing (architecture design §8.3): when they disagree with the manifest's declaration, these take precedence. */
export interface VerifiedCapabilities {
  contract: CodeBundleContract;
  /** Frames can be fetched in any order; proven by sampling out of order and getting the same frame when the same moment is fetched twice. */
  randomAccess: boolean;
  /** Transparent pixels were actually observed (false when the manifest declares `output.alpha` but the measured output is fully opaque). */
  alpha: boolean;
  audio: 'none' | 'stems' | 'mixed';
  /** Actual width, height, frame rate and duration (cross-checked from the manifest and the root element). */
  width: number;
  height: number;
  fps: Rate;
  durationFrames: number;
  /** Execution environment: in phase one, only the Electron offscreen window. */
  host: 'electron-offscreen';
  /** Sandbox state: whether the network was actually blocked. */
  networkIsolated: boolean;
}

/** A ticket for one frame fetch (the phase-one subset of architecture design §8.4). */
export interface FrameTicket {
  requestId: Id;
  /** A preview taken before import has no material version yet, so it is null. */
  bundleRef: VersionRef | null;
  compositionId: string;
  /** Local time inside the composition. */
  localTime: MediaTime;
  /** Output frame number and frame rate (frames are fetched by sequence or export frame rate, not the package's local frame rate). */
  frameIndex: number;
  fps: Rate;
  width: number;
  height: number;
  parametersHash: string;
  quality: 'draft' | 'interactive' | 'export-exact';
}

/** Frame fetch receipt: the actual sampled time and pixel information. */
export interface FrameReceipt {
  requestId: Id;
  /** The actual time (seconds) read back from the page. */
  sampledSeconds: number;
  /** The requested time (seconds). */
  requestedSeconds: number;
  /** The last frame was clamped to the duration. */
  clampedToDuration: boolean;
  width: number;
  height: number;
  pixelFormat: 'rgba8' | 'png';
  alphaMode: 'straight' | 'opaque';
  /** sha256 of the frame bytes (lowercase hex), for deterministic checks. */
  sha256: string;
}

export type CodeBundleCheckId =
  | 'manifest'
  | 'files'
  | 'content-hash'
  | 'network-static'
  | 'network-runtime'
  | 'root'
  | 'timeline'
  | 'seek'
  | 'determinism'
  | 'alpha'
  | 'duration';

export interface CodeBundleCheck {
  id: CodeBundleCheckId;
  status: 'passed' | 'failed' | 'skipped';
  /** Error code on failure (`CodeBundleErrorCode`). */
  code?: CodeBundleErrorCode;
  detail?: string;
}

/** The verification report of code bundle spec §6.2 (`verification.json`). */
export interface CodeBundleVerificationReport {
  format: 'cuccut.code-bundle-verification';
  schemaVersion: 1;
  bundleId: Id;
  revision: Revision;
  contentHash: string;
  verifiedAt: string;
  status: 'passed' | 'failed';
  capabilities: VerifiedCapabilities | null;
  checks: CodeBundleCheck[];
  /** Frames taken during verification (time and digest), for review. */
  sampledFrames: Array<{ seconds: number; sha256: string }>;
}

/** Code bundle spec §7. */
export interface BakeRecord {
  bakedAssetRef: VersionRef;
  sourceBundleRef: VersionRef;
  parameterValuesHash: string;
  timeMapHash: string;
  outputProfileHash: string;
  bakedAt: string;
  status: 'current' | 'stale';
  /** Encoding of the bake output (phase one: a PNG frame sequence wrapped in QuickTime; `prores_ks` 4444 when there is alpha). */
  encoding: { container: 'mov'; codec: string; pixelFormat: string; alpha: boolean; fps: Rate; frames: number };
}

/** Values of `provenance.origin` for pre-rendered material; `provenance.source` is a `BakeRecord`. */
export const BAKE_PROVENANCE_ORIGIN = 'composition-bake';

export const CODE_BUNDLE_ERROR_CODES = [
  // Import and verification (§6.2)
  'BUNDLE_MANIFEST_INVALID',
  'BUNDLE_FILE_NOT_ALLOWED',
  'BUNDLE_SYMLINK',
  'BUNDLE_TOO_LARGE',
  'BUNDLE_NETWORK_REFERENCE',
  'BUNDLE_HASH_MISMATCH',
  'BUNDLE_ENTRY_MISSING',
  'BUNDLE_CONTRACT_UNSUPPORTED',
  // Execution and frame fetch (§4, architecture design §8.4)
  'COMPOSITION_ROOT_MISSING',
  'COMPOSITION_TIMELINE_MISSING',
  'COMPOSITION_SEEK_MISMATCH',
  'COMPOSITION_INTRINSIC_MISMATCH',
  'COMPOSITION_NONDETERMINISTIC',
  'COMPOSITION_NETWORK_BLOCKED',
  'COMPOSITION_SCRIPT_ERROR',
  'COMPOSITION_RENDER_TIMEOUT',
  'COMPOSITION_HOST_UNAVAILABLE',
] as const;
export type CodeBundleErrorCode = (typeof CODE_BUNDLE_ERROR_CODES)[number];

/** Size limit of a package (code bundle spec §6.2). */
export const CODE_BUNDLE_LIMITS = {
  maxFiles: 4096,
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxPathLength: 512,
} as const;

/** File extensions allowed into a package (lowercase, with the dot). */
export const CODE_BUNDLE_ALLOWED_EXTENSIONS = [
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
  '.map',
  '.txt',
  '.md',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.mp4',
  '.webm',
  '.mov',
  '.wasm',
  '.lock',
] as const;

/**
 * The allowed error in seconds for the time read back after `seek`: half a frame at the sampling frame rate, i.e. 1 / (2 × fps) (code bundle spec §4.7).
 * fps is taken from the `fps` of the frame fetch ticket; without a ticket, the package's `intrinsic.fps` is used. At 30 fps it is 1/60 s.
 */
export function seekToleranceSeconds(fps: Rate): number {
  return fps.den / (2 * fps.num);
}

// ---- Direct preview in the UI and import of the code picture (`compositions.preview`, `compositions.import`; the same service as the tools compositions_preview / compositions_import) ----

/** Limits on inline package files: the byte size of each file and the number of files (web pages and scripts written by hand by the agent, not an asset library). One RPC request is also bounded by the gateway's 4 MiB frame limit. */
export const COMPOSITION_INLINE_LIMITS = { maxFiles: 200, maxFileBytes: 4 * 1024 * 1024 } as const;
/** The most frames fetched in one preview (same as `videos_frames`). */
export const COMPOSITION_PREVIEW_MAX_FRAMES = 24;

/** One inline package file: a path relative to the package (`/`-separated) plus text or base64 content; one of the two. */
export interface CompositionInlineFile {
  path: string;
  content?: string;
  contentBase64?: string;
}

/** Override for generating the manifest when the package has no `bundle.manifest.json` (`durationSeconds` must be given together with `fps`). */
export interface CompositionManifestOverrides {
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  alpha?: boolean;
  bundleId?: string;
  revision?: string;
  entry?: string;
  contract?: CodeBundleContract;
}

/**
 * `compositions.preview`: fetches code-picture frames at a time inside the composition, in an offscreen browser. The code bundle is given as inline files (`files`), as a directory (`path`, relative to the video's source directory — the project directory, or the working directory of a session that does not belong to a project — and only inside it), or as a code bundle asset already imported into this video (`assetId`); exactly one of the three is given.
 * `at` is a decimal seconds string; a time past the duration is clamped to the last frame. The video must already be open. It does not change the video, verify, or bake.
 */
export interface CompositionPreviewParams {
  video: Id;
  files?: CompositionInlineFile[];
  path?: string;
  assetId?: Id;
  at: string[];
  compositionId?: string;
  manifest?: CompositionManifestOverrides;
}

/**
 * One preview frame. The PNG is written under `.cuccut-out/frames/<videoId>/` in the source directory (the same location as the agent's compositions_preview; it is overwritten when the same time is fetched again).
 * `media` is its restricted read handle (the same as `media.resolve`), and `media.url` can be used directly as an image address. The frame is the code bundle's own picture (transparent areas stay transparent), not the picture after it is composited with the video.
 */
export interface CompositionPreviewFrame {
  at: string;
  /** The actual time (seconds) read back from the page. */
  sampledSeconds: number;
  /** The requested moment is past the duration, so it was clamped to the last frame. */
  clamped: boolean;
  /** sha256 of the PNG: two fetches of the same moment have the same digest only if the picture is deterministic. */
  sha256: string;
  width: number;
  height: number;
  media: MediaHandle;
}

export interface CompositionPreviewResult {
  videoId: Id;
  bundleId: string;
  compositionId: string;
  width: number;
  height: number;
  durationSeconds: number;
  alpha: boolean;
  frames: CompositionPreviewFrame[];
}

/**
 * `compositions.import`: imports the code bundle into the video — verify it, bake it at the video's root sequence frame rate into a pre-render with transparency, add the code bundle and the pre-render to the video as material (the first edit), then place a composition clip (the second edit, which can be undone separately). Exactly one of `files` and `path` is given (the `path` constraints are the same as for the preview).
 * With `register: true` it only verifies and registers the code bundle material. If `revision` does not match, nothing is imported. With `commandId`, retrying with the same value does not submit it twice (the second edit uses `<commandId>-place`). When `conversationId` is given, each edit places a change card in that conversation. Baking may take several minutes, so the client relaxes its timeout when it calls.
 *
 * When `replace.itemId` points to an existing composition clip on the timeline, the second edit does not place a new clip; instead it uses `replaceCodeBundle` to swap in place the clip's code bundle version and pre-render (code bundle spec §3.3): the clip ID, track, start, geometry, effects, keyframes and so on stay unchanged, and the length follows the new pre-render. It is mutually exclusive with `place` and `register`.
 */
export interface CompositionImportParams {
  video: Id;
  files?: CompositionInlineFile[];
  path?: string;
  name?: string;
  compositionId?: string;
  manifest?: CompositionManifestOverrides;
  place?: { track?: Id; at?: string };
  replace?: { itemId: Id };
  register?: boolean;
  revision?: Revision;
  commandId?: Id;
  conversationId?: Id;
}

export interface CompositionImportResult {
  status: 'committed';
  videoId: Id;
  revision: { before: Revision; after: Revision };
  bundle: {
    assetId: Id;
    revision: Revision;
    bundleId: string;
    manifestRevision: Revision;
    contentHash: string;
    contract: CodeBundleContract;
    compositionId: string;
    width: number;
    height: number;
    fps: Rate;
    durationFrames: number;
    durationSeconds: number;
    bytes: number;
    files: number;
    synthesizedManifest: boolean;
  };
  capabilities: VerifiedCapabilities;
  verification: { status: CodeBundleVerificationReport['status']; checks: CodeBundleCheck[] };
  /** null when only registering. */
  prerender: {
    assetId: Id;
    revision: Revision;
    frames: number;
    fps: Rate;
    encoding: BakeRecord['encoding'];
    hasAlpha: boolean;
  } | null;
  /** The composition clip placed on the timeline (or replaced in place) and the track it is on; null when only registering. */
  itemId: Id | null;
  trackId: Id | null;
  /** The clip's position on the timeline (root sequence frames and seconds); null when only registering. */
  item: CompositionPlacement | null;
  /** When `replace` is given: the old version that was swapped out, and the lengths before and after (the entry in `impact.codeEdits` of the receipt). */
  replaced?: CodeEdit;
}

export interface CompositionPlacement {
  itemId: Id;
  trackId: Id;
  fromFrame: number;
  durationFrames: number;
  startSeconds: number;
  endSeconds: number;
}
