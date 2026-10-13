import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  BAKE_PROVENANCE_ORIGIN,
  CODE_BUNDLE_CONTRACTS,
  type BakeRecord,
  type CodeBundleCheck,
  type CodeBundleContract,
  type CodeBundleErrorCode,
  type CodeBundleVerificationReport,
  type CodeEdit,
  type CompositionImportResult,
  type CompositionPlacement,
  type CompositionInlineFile,
  type EditResult,
  type Id,
  type Sequence,
  type VideoChange,
  type VideoOpenResult,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import {
  CodeBundleError,
  CompositionHost,
  bakeComposition,
  frameTicketAt,
  inspectBundle,
  readRootAttributes,
  verifyBundle,
  type BakeResult,
  type CompositionHostOptions,
  type InspectedBundle,
  type SynthesizeOverrides,
} from '@cuccut/code-runtime';
import type { Logger } from '@cuccut/harness';
import type { VideoService } from '../videos/video-service.ts';
import { inside } from '../agent-tools/artifact-save.ts';
import { ToolError, errorBody } from '../agent-tools/tool-catalog.ts';
import { digestReceipt, resolveUserPath } from '../agent-tools/video-digest.ts';
import { frameTimes } from '../agent-tools/video-frames.ts';

/**
 * Code visual service (architecture design §8, code bundle spec §2, §6, §7): import and preview of browser compositions (code bundles). The UI via RPC (`compositions.*`)
 * and agents and external services via tools (`compositions_import` / `compositions_preview`) all go through here; they differ only in the context the caller passes in:
 * how to open the video, where relative paths resolve, confirmation and commit (who the actor is, where the change card goes), and where frames are written.
 *
 * Browser compositions run in an Electron offscreen host (`@cuccut/code-runtime`). The host starts on demand, is shared by all calls and used serially, and is closed when the Runtime stops.
 * Writes to the video go through the same `VideoService.apply` as the UI: the first commit imports two assets, the code bundle and the prerender; the second places a composition instance (the composition's `source.assetRef`
 * and `prerender` only accept revisions of existing assets and cannot reference an `importAsset` ref from the same commit, hence two commits).
 *
 * Errors are thrown as `ToolError` the way tools do (error code, message for the model, and `next`); RPC handlers convert them to `RpcError`.
 */

/** Shared host handle: all entry points in one Runtime (sessions, terminal, external services, UI) share one Electron process, used serially; restarted if it dies. */
export class SharedCompositionHost {
  readonly #options: CompositionHostOptions;
  #host: CompositionHost | null = null;
  #chain: Promise<unknown> = Promise.resolve();
  #closed = false;

  constructor(options: CompositionHostOptions = {}) {
    this.#options = options;
  }

  /** Queues use of the host: the next call waits until the previous one is done (baking and frame capture never compete for the same host). */
  use<T>(fn: (host: CompositionHost) => Promise<T>): Promise<T> {
    const run = this.#chain.then(async () => fn(await this.#acquire()));
    this.#chain = run.catch(() => {});
    return run;
  }

  async #acquire(): Promise<CompositionHost> {
    if (this.#closed) throw new CodeBundleError('COMPOSITION_HOST_UNAVAILABLE', 'The runtime is stopping');
    if (this.#host?.alive) return this.#host;
    if (this.#host) await this.#host.close().catch(() => {});
    this.#host = null;
    this.#host = await CompositionHost.start(this.#options);
    return this.#host;
  }

  /** Runtime stops: close the host (frame captures in progress fail with it); later calls answer `COMPOSITION_HOST_UNAVAILABLE`. */
  async close(): Promise<void> {
    this.#closed = true;
    const host = this.#host;
    this.#host = null;
    if (host) await host.close();
  }
}

export interface CompositionServiceDeps {
  videos: VideoService;
  /** ffmpeg used for baking (absolute path or command name). */
  ffmpeg: () => string | Promise<string>;
  host: SharedCompositionHost;
  log?: Logger;
}

/** Manifest overrides (used when the bundle has no `bundle.manifest.json`). Fields may be explicitly undefined: that is what tool arguments look like after zod parsing. */
export interface CompositionManifestInput {
  width?: number | undefined;
  height?: number | undefined;
  fps?: number | undefined;
  durationSeconds?: number | undefined;
  alpha?: boolean | undefined;
  bundleId?: string | undefined;
  revision?: string | undefined;
  entry?: string | undefined;
  contract?: CodeBundleContract | undefined;
}

interface BundleSourceInput {
  path?: string | undefined;
  files?: CompositionInlineFile[] | undefined;
  compositionId?: string | undefined;
  manifest?: CompositionManifestInput | undefined;
}

export interface CompositionImportRequest extends BundleSourceInput {
  name?: string | undefined;
  place?: { track?: string | undefined; at?: string | undefined } | undefined;
  /** Replace a composition clip already on the timeline in place (code bundle spec §3.3); mutually exclusive with `place` and `register`. */
  replace?: { itemId: string } | undefined;
  register?: boolean | undefined;
  revision?: string | undefined;
  commandId?: string | undefined;
}

export interface CompositionPreviewRequest extends BundleSourceInput {
  assetId?: string | undefined;
  at: string[];
}

/** One edit, committed by the caller (actor, idempotency key, protected scope and change card are all on the caller's side). */
export interface CompositionEdit {
  expectedRevision: string;
  label: string;
  operations: Record<string, unknown>[];
  /** Idempotency key from the caller (the second commit uses `<commandId>-place`); when absent the caller generates a new one. */
  commandId: string | undefined;
}

/** The caller's context: opening the video, and where `path` resolves and whether it may leave that directory. */
export interface CompositionCaller {
  open(): Promise<VideoOpenResult>;
  /** Directory `path` is relative to; when `confine` is set, the directory (by real path) must be inside it. */
  importBase(opened: VideoOpenResult): { cwd: string; confine: string | null };
}

export interface CompositionImportCaller extends CompositionCaller {
  /**
   * Confirmation before side effects (in a session, asks the user according to the access mode); throws on refusal. Calls from the UI pass directly. `replace` is the clip to replace in place
   * (`clip` is its name, or its ID when it has no name).
   */
  confirm(request: { name: string; place: boolean; replace: { itemId: Id; clip: string } | null }): Promise<void>;
  apply(opened: VideoOpenResult, edit: CompositionEdit): Promise<EditResult>;
}

export interface CompositionPreviewCaller extends CompositionCaller {
  /** Directory frames are written to (an existing real path). */
  framesDir(opened: VideoOpenResult): Promise<string>;
}

/** Preview result: frames written as files (`file` is an absolute path); the caller decides how to hand them over (tools give paths, RPC gives media handles). */
export interface CompositionPreview {
  videoId: Id;
  bundleId: string;
  compositionId: string;
  width: number;
  height: number;
  durationSeconds: number;
  alpha: boolean;
  frames: Array<{ at: string; file: string; sampledSeconds: number; clamped: boolean; sha256: string }>;
}

/** Next step for each error code: the agent fixes the bundle accordingly and retries (RPC puts it in `details.next`). */
export const BUNDLE_NEXT: Record<CodeBundleErrorCode, string> = {
  BUNDLE_MANIFEST_INVALID:
    'The manifest is invalid, or the bundle has no manifest and its size, frame rate or duration cannot be read: put data-width, data-height, data-fps and data-duration on the root element (or use the manifest override); if there is a bundle.manifest.json, fix it according to details, or delete it so the import regenerates it',
  BUNDLE_FILE_NOT_ALLOWED:
    'The bundle may only contain allowlisted files such as web pages, scripts, styles, images, fonts and audio/video, and no dotfiles or node_modules: delete the files listed in details and retry',
  BUNDLE_SYMLINK: 'The bundle must not contain symlinks: replace them with real files and retry',
  BUNDLE_TOO_LARGE: 'The bundle is too large (at most 4096 files, 64 MiB per file, 256 MiB in total): delete unused resources or compress them and retry',
  BUNDLE_NETWORK_REFERENCE: 'The code bundle must work offline: put the libraries and fonts it depends on inside the bundle, reference them by relative path, then import; do not use CDNs, web fonts or network requests',
  BUNDLE_HASH_MISMATCH:
    'The contentHash in bundle.manifest.json does not match the files: repackage, or delete bundle.manifest.json and files.manifest.json so the import regenerates them',
  BUNDLE_ENTRY_MISSING: 'No entry HTML found: put an index.html in the bundle, or set the entry with manifest.entry',
  BUNDLE_CONTRACT_UNSUPPORTED: `Only the browser contracts ${CODE_BUNDLE_CONTRACTS.join(', ')} are supported: rewrite the page for one of them`,
  COMPOSITION_ROOT_MISSING:
    'The entry page has no root element with data-composition-id: add it (its value equal to compositionId), and set data-width, data-height, data-fps and data-duration',
  COMPOSITION_TIMELINE_MISSING:
    'hyperframes/1 must register a paused, seekable (seek(seconds)) timeline on window.__timelines[<compositionId>]; cuccut/1 must expose renderAt on window.__cuccutCompositions[<compositionId>]. Fix it and retry',
  COMPOSITION_SEEK_MISMATCH:
    'The time read back after seek does not match, or a request past the end was not clamped to the duration: make time() return the time seeked to, with a duration equal to data-duration',
  COMPOSITION_INTRINSIC_MISMATCH: 'The size, frame rate or duration reported by the page differs from the manifest: make the root element\'s data-* match the manifest (or the manifest override)',
  COMPOSITION_NONDETERMINISTIC:
    'Two captures at the same time differ: the frame must depend only on the time seeked to; do not advance it yourself with Date.now(), performance.now(), Math.random() (use a fixed seed if you need randomness), CSS animations or requestAnimationFrame',
  COMPOSITION_NETWORK_BLOCKED: 'The page made a network request at run time and it was blocked: put the resources it uses inside the bundle and reference them by relative path',
  COMPOSITION_SCRIPT_ERROR: 'A page script failed: fix the script according to message and retry',
  COMPOSITION_RENDER_TIMEOUT: 'The page was not ready in time or a frame capture timed out: reduce the work per frame, and make sure the timeline is registered and the page is not stuck',
  COMPOSITION_HOST_UNAVAILABLE: 'Rendering code visuals needs Electron: install the desktop app or set CUCCUT_ELECTRON',
};

const ALPHA_NEXT = 'The frame is fully opaque: pass manifest.alpha=false (or write data-alpha="false" on the root element), or make the background transparent';

/** The `importAsset` ref: the new asset's ID is taken from the receipt's `refs`. */
const BUNDLE_REF = 'bundle';
const PRERENDER_REF = 'prerender';
const TRACK_REF = 'track';

export class CompositionService {
  readonly #deps: CompositionServiceDeps;

  constructor(deps: CompositionServiceDeps) {
    this.#deps = deps;
  }

  /** Import: verify, bake, two edits (assets, then placement). The returned object is the tool result (the tool adds a note about confirmation). */
  async import(args: CompositionImportRequest, caller: CompositionImportCaller): Promise<CompositionImportResult> {
    const { videos } = this.#deps;
    if ((args.path === undefined) === (args.files === undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', 'Give exactly one of path and files: path is the code bundle directory, files are inline bundle files');
    }
    if (args.replace && (args.place !== undefined || args.register)) {
      throw new ToolError(
        'INVALID_ARGUMENTS',
        'replace cannot be combined with place or register: replace swaps an existing composition clip in place, keeping its track and start',
      );
    }
    const opened = await caller.open();
    const videoId = opened.ref.videoId;
    // Look up the clip to replace first: if it is missing or not a composition clip, there is no need to verify and bake.
    const target = args.replace ? replaceTarget(current(videos, opened), args.replace.itemId) : null;
    const work = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-composition-'));
    try {
      const dir = await sourceDirectory(args, caller.importBase(opened), work);
      const bundle = await inspect(dir, args, work);
      const name = (args.name ?? bundle.manifest.bundleId).trim();
      const register = args.register ?? false;
      await caller.confirm({ name, place: !register, replace: target && { itemId: target.itemId, clip: target.clip } });

      const report = await this.#withHost((host) => verifyBundle(host, bundle));
      if (report.status === 'failed') throw verificationError(report);
      const capabilities = report.capabilities!;

      const before = current(videos, opened);
      // Bake frame rate and seconds-to-frames conversion follow the sequence the clip sits in (code bundle spec §3.3, §7): replacing uses the original clip's sequence, placing uses the root sequence.
      const sequence = before.sequences[target?.sequenceId ?? before.rootSequenceId]!;
      const fps = sequence.fps;
      let bake: BakeResult | null = null;
      if (!register) {
        const outputFile = path.join(work, `${safeName(bundle.manifest.bundleId)}-${safeName(bundle.manifest.revision)}.mov`);
        const ffmpeg = await this.#deps.ffmpeg();
        bake = await this.#withHost((host) =>
          bakeComposition(host, bundle, { fps, outputFile, ffmpeg, alpha: bundle.manifest.output.alpha }),
        ).catch((error: unknown) => {
          if (error instanceof CodeBundleError || error instanceof ToolError) throw error;
          throw new ToolError('COMPOSITION_BAKE_FAILED', `Baking the prerender failed: ${error instanceof Error ? error.message : String(error)}`, {
            next: 'Check that ffmpeg is available (CUCCUT_FFMPEG or ffmpeg on PATH); or register the code bundle only with register: true first',
          });
        });
      }

      // First commit: two assets, the code bundle and the prerender.
      const identity = { id: bundle.manifest.bundleId, revision: bundle.manifest.revision };
      const operations: Record<string, unknown>[] = [
        {
          type: 'importAsset',
          path: bundle.root,
          name,
          storage: 'managed',
          bundle: bundle.manifest,
          provenance: { origin: 'agent-import', source: { verification: report } },
          ref: BUNDLE_REF,
        },
      ];
      if (bake) {
        // The prerender's and code bundle's asset IDs are only known from the receipt: the bake record first stores the identity of the code bundle manifest (the cache identity of code bundle spec §2.3);
        // the actual asset references live on the composition clip's `source.assetRef` and `prerender`, and are also returned in the result.
        const record: BakeRecord = {
          bakedAssetRef: identity,
          sourceBundleRef: identity,
          parameterValuesHash: bake.parameterValuesHash,
          timeMapHash: bake.timeMapHash,
          outputProfileHash: bake.outputProfileHash,
          bakedAt: new Date().toISOString(),
          status: 'current',
          encoding: bake.encoding,
        };
        operations.push({
          type: 'importAsset',
          path: bake.file,
          name: path.basename(bake.file),
          storage: 'managed',
          provenance: { origin: BAKE_PROVENANCE_ORIGIN, source: record },
          ref: PRERENDER_REF,
        });
      }
      const imported = await caller.apply(opened, {
        expectedRevision: args.revision ?? before.revision,
        label: RcAgentTools.importAssetLabel({ name, place: false }).text,
        operations,
        commandId: args.commandId,
      });
      const refs = imported.receipt.refs ?? {};
      const afterImport = current(videos, opened);
      const bundleAssetId = refs[BUNDLE_REF]!;
      const bundleRevision = afterImport.assets[bundleAssetId]!.currentRevision;
      const prerenderAssetId = bake ? refs[PRERENDER_REF]! : null;
      const prerenderRevision = prerenderAssetId ? afterImport.assets[prerenderAssetId]!.currentRevision : null;
      const assets = {
        bundle: { assetId: bundleAssetId, revision: bundleRevision },
        ...(prerenderAssetId ? { prerender: { assetId: prerenderAssetId, revision: prerenderRevision } } : {}),
      };

      // Second commit: place a composition clip whose source is the code bundle asset and whose proxy is the prerender; with replace, swap that clip's code bundle and proxy in place.
      let itemId: Id | null = null;
      let trackId: Id | null = null;
      let replaced: CodeEdit | undefined;
      let after = imported.receipt.videoRevision;
      if (target && bake && prerenderAssetId && prerenderRevision) {
        let swapped: EditResult;
        try {
          swapped = await caller.apply(opened, {
            expectedRevision: after,
            label: RcAgentTools.replaceCompositionLabel({ name }).text,
            operations: [
              {
                type: 'replaceCodeBundle',
                sequenceId: target.sequenceId,
                itemId: target.itemId,
                assetRef: { id: bundleAssetId, revision: bundleRevision },
                prerender: { id: prerenderAssetId, revision: prerenderRevision },
              },
            ],
            commandId: args.commandId !== undefined ? `${args.commandId}-place` : undefined,
          });
        } catch (error) {
          // Fold the engine's message into the sentence above: left in extra it would override it, and the model would not see that the first commit already went through.
          const { message: engineMessage, ...body } = errorBody(error);
          throw new ToolError(body.code, `The code bundle and prerender were imported (first commit done), but replacing clip ${target.itemId} failed: ${engineMessage}`, {
            ...body,
            imported: assets,
            revision: after,
            next:
              body.code === 'TIMELINE_OVERLAP'
                ? 'The new version is longer than the original clip and collides with the next clip on the same track: first move the later clip back with edits_apply moveItem (or delete it with deleteItems), then finish the replacement with edits_apply replaceCodeBundle (assetRef and prerender come from bundle and prerender in imported, written as { id: assetId, revision }); do not import again'
                : 'The assets are imported: fix the error, then finish the replacement with edits_apply replaceCodeBundle (assetRef and prerender come from bundle and prerender in imported, written as { id: assetId, revision }); do not import again',
          });
        }
        after = swapped.receipt.videoRevision;
        replaced = swapped.receipt.impact.codeEdits?.find((edit) => edit.itemId === target.itemId);
        itemId = target.itemId;
        trackId = target.trackId;
      } else if (bake && prerenderAssetId && prerenderRevision) {
        const fromFrame = Math.round((Number(args.place?.at ?? '0') * fps.num) / fps.den);
        const span = { fromFrame, durationFrames: bake.frames };
        const target = placementTrack(afterImport.sequences[sequence.id]!, args.place?.track, span);
        const item = {
          type: 'composition',
          ...('trackId' in target ? { trackId: target.trackId } : { trackRef: TRACK_REF }),
          name,
          span,
          place: {},
          source: { kind: 'bundle', assetRef: { id: bundleAssetId, revision: bundleRevision } },
          parameterValues: {},
          timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: fps.num }, rate: { num: 1, den: 1 } },
          prerender: { id: prerenderAssetId, revision: prerenderRevision },
        };
        const placeOps: Record<string, unknown>[] = [
          ...('trackId' in target ? [] : [{ type: 'addTrack', sequenceId: sequence.id, kind: 'visual', ref: TRACK_REF }]),
          { type: 'insertItems', sequenceId: sequence.id, items: [item] },
        ];
        let placed: EditResult;
        try {
          placed = await caller.apply(opened, {
            expectedRevision: after,
            // For now reuse the import-asset copy ("Import … and place on the timeline") rather than adding a new copy key.
            label: RcAgentTools.importAssetLabel({ name, place: true }).text,
            operations: placeOps,
            commandId: args.commandId !== undefined ? `${args.commandId}-place` : undefined,
          });
        } catch (error) {
          // Fold the engine's message into the sentence above: left in extra it would override it, and the model would not see that the first commit already went through.
          const { message: engineMessage, ...body } = errorBody(error);
          throw new ToolError(body.code, `The code bundle and prerender were imported (first commit done), but placing on the timeline failed: ${engineMessage}`, {
            ...body,
            imported: assets,
            revision: after,
            next: 'The assets are imported: call compositions_import again with a different place (another track or start time); the same code bundle reuses the imported asset by content; the prerender is baked again and reused only if byte-identical to the previous one, otherwise an extra asset is added (the previous one is no longer referenced)',
          });
        }
        after = placed.receipt.videoRevision;
        const placedRefs = placed.receipt.refs ?? {};
        const created = new Set(placed.receipt.createdIds);
        const finalVideo = current(videos, opened);
        const inserted = finalVideo.sequences[sequence.id]?.items.find((it) => created.has(it.id) && it.type === 'composition');
        itemId = inserted?.id ?? null;
        trackId = inserted?.trackId ?? ('trackId' in target ? target.trackId : (placedRefs[TRACK_REF] ?? null));
      }

      const finalVideo = current(videos, opened);
      const prerenderRecord =
        prerenderAssetId && prerenderRevision ? finalVideo.assets[prerenderAssetId]?.revisions[prerenderRevision] : undefined;
      const { manifest } = bundle;
      const intrinsicFps = manifest.intrinsic.fps;
      return {
        status: 'committed',
        videoId,
        revision: { before: imported.receipt.previousRevision, after },
        bundle: {
          assetId: bundleAssetId,
          revision: bundleRevision,
          bundleId: manifest.bundleId,
          manifestRevision: manifest.revision,
          contentHash: manifest.contentHash,
          contract: capabilities.contract,
          compositionId: bundle.compositionId,
          width: manifest.intrinsic.width,
          height: manifest.intrinsic.height,
          fps: intrinsicFps,
          durationFrames: manifest.intrinsic.durationFrames,
          durationSeconds: round((manifest.intrinsic.durationFrames * intrinsicFps.den) / intrinsicFps.num),
          bytes: bundle.totalBytes,
          files: bundle.entries.length,
          synthesizedManifest: bundle.synthesized,
        },
        capabilities,
        verification: { status: report.status, checks: report.checks },
        prerender:
          bake && prerenderAssetId && prerenderRevision
            ? {
                assetId: prerenderAssetId,
                revision: prerenderRevision,
                frames: bake.frames,
                fps: bake.fps,
                encoding: bake.encoding,
                hasAlpha: prerenderRecord?.video?.hasAlpha ?? bake.encoding.alpha,
              }
            : null,
        itemId,
        trackId,
        item: itemId ? placementOf(finalVideo, itemId) : null,
        ...(replaced ? { replaced } : {}),
      };
    } catch (error) {
      throw toolError(error);
    } finally {
      await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** Preview: capture frames at times inside the composition and write them as PNG (capturing the same time again overwrites). Does not change the video, verify or bake. */
  async preview(args: CompositionPreviewRequest, caller: CompositionPreviewCaller): Promise<CompositionPreview> {
    const { videos } = this.#deps;
    const given = [args.path, args.files, args.assetId].filter((v) => v !== undefined).length;
    if (given !== 1) throw new ToolError('INVALID_ARGUMENTS', 'Give exactly one of path, files and assetId');
    const times = frameTimes({ at: args.at });
    const opened = await caller.open();
    const videoId = opened.ref.videoId;
    const dir = await caller.framesDir(opened);
    const work = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-composition-'));
    try {
      let source: string;
      if (args.assetId !== undefined) {
        const asset = current(videos, opened).assets[args.assetId];
        if (!asset || asset.kind !== 'bundle') {
          throw new ToolError('ASSET_NOT_FOUND', `This video has no code bundle asset ${args.assetId}: use bundle.assetId returned by compositions_import`);
        }
        const located = await videos.assetFile(videoId, args.assetId, asset.currentRevision);
        source = path.resolve(located.root, located.file);
      } else {
        source = await sourceDirectory(args, caller.importBase(opened), work);
      }
      const bundle = await inspect(source, args, work);
      const { manifest } = bundle;
      const name = safeName(manifest.bundleId);
      const frames = await this.#withHost(async (host) => {
        const session = await host.open(bundle);
        try {
          const out = [];
          for (const at of times) {
            const ticket = frameTicketAt(bundle, { seconds: Number(at) }, { quality: 'draft' });
            const frame = await session.frame(ticket);
            const file = path.join(dir, `composition-${name}-at-${Math.round(Number(at) * 1000)}ms.png`);
            await writeAtomically(file, frame.png);
            out.push({
              at,
              file,
              sampledSeconds: round(frame.receipt.sampledSeconds),
              clamped: frame.receipt.clampedToDuration,
              sha256: frame.receipt.sha256,
            });
          }
          return { frames: out, page: session.page };
        } finally {
          await session.dispose().catch(() => {});
        }
      });
      return {
        videoId,
        bundleId: manifest.bundleId,
        compositionId: bundle.compositionId,
        width: frames.page.width,
        height: frames.page.height,
        durationSeconds: round(frames.page.durationSeconds),
        alpha: manifest.output.alpha,
        frames: frames.frames,
      };
    } catch (error) {
      throw toolError(error);
    } finally {
      await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    }
  }

  #withHost<T>(fn: (host: CompositionHost) => Promise<T>): Promise<T> {
    return this.#deps.host.use(fn);
  }
}

/** Receipt of one edit -> change card in the session (same as `edits_apply`). For a video not belonging to a project, `conversationId` is left empty for whoever places the card to fill in. */
export function videoChangeOf(videos: VideoService, opened: VideoOpenResult, result: EditResult): VideoChange {
  const videoId = opened.ref.videoId;
  const video = opened.snapshot.video;
  // The receipt's `impact.oldDurationFrames` / `newDurationFrames` are root sequence lengths (the engine's `Video::commit` counts on the root sequence),
  // so convert to seconds with the root sequence's frame rate, not the sequence of the edited clip.
  const digest = digestReceipt(result.receipt, video.sequences[video.rootSequenceId]!.fps, result.replayed);
  const { ref } = opened;
  return {
    videoId,
    videoName: videos.ref(videoId)?.name ?? ref.name,
    target: ref.source.projectId
      ? { projectId: ref.source.projectId, path: ref.relPath }
      : { conversationId: ref.source.conversationId ?? '', path: ref.relPath },
    transactionId: result.receipt.transactionId,
    label: result.receipt.label,
    ...(result.receipt.labelRef ? { labelRef: result.receipt.labelRef } : {}),
    previousRevision: result.receipt.previousRevision,
    videoRevision: result.receipt.videoRevision,
    createdIds: result.receipt.createdIds,
    updatedIds: result.receipt.updatedIds,
    deletedIds: result.receipt.deletedIds,
    durationSeconds: digest.durationSeconds,
    undoOf: result.receipt.undoOf ?? null,
  };
}

/** The caller's code bundle: a directory (resolved against `base`, must not leave `confine` when set) or inline files (written to a temp directory). */
async function sourceDirectory(
  args: { path?: string | undefined; files?: CompositionInlineFile[] | undefined },
  base: { cwd: string; confine: string | null },
  work: string,
): Promise<string> {
  if (args.files !== undefined) return writeInlineFiles(args.files, path.join(work, 'source'));
  const resolved = resolveUserPath(args.path!, base.cwd);
  const real = await fs.realpath(resolved).catch(() => null);
  if (!real)
    throw new ToolError('BUNDLE_ENTRY_MISSING', `Cannot read the code bundle directory ${args.path}`, {
      next: 'path must be the code bundle directory (relative to the working directory, or absolute)',
    });
  if (base.confine !== null && !inside(real, await fs.realpath(base.confine))) {
    throw new ToolError('PATH_OUTSIDE_PROJECT', 'The code bundle directory must be inside the project directory of the video (a path relative to the project directory)');
  }
  const stat = await fs.stat(real);
  if (!stat.isDirectory()) {
    throw new ToolError(
      'INVALID_ARGUMENTS',
      `${args.path} is not a directory: a code bundle is a directory (the entry HTML and the files it uses); inline a single HTML with files`,
    );
  }
  return real;
}

/** Inspects the code bundle; manifest overrides are converted to `inspectBundle`'s form (duration converted to frames by frame rate). A synthesized manifest is staged in `work` and deleted with it. */
async function inspect(
  dir: string,
  args: { compositionId?: string | undefined; manifest?: CompositionManifestInput | undefined },
  work: string,
): Promise<InspectedBundle> {
  const m = args.manifest;
  const overrides: SynthesizeOverrides = {};
  if (m) {
    if (m.durationSeconds !== undefined && m.fps === undefined) {
      throw new ToolError('INVALID_ARGUMENTS', 'manifest.durationSeconds must be given together with manifest.fps (the duration is converted to frames by frame rate)');
    }
    if (m.width !== undefined) overrides.width = m.width;
    if (m.height !== undefined) overrides.height = m.height;
    if (m.fps !== undefined) overrides.fps = m.fps;
    if (m.durationSeconds !== undefined && m.fps !== undefined)
      overrides.durationFrames = Math.max(1, Math.round(m.durationSeconds * m.fps));
    if (m.bundleId !== undefined) overrides.bundleId = m.bundleId;
    if (m.revision !== undefined) overrides.revision = m.revision;
    if (m.entry !== undefined) overrides.entry = m.entry;
    if (m.contract !== undefined) overrides.contract = m.contract;
  }
  // Durations at NTSC frame rates: fps is treated as n*1000/1001; frame counts are exact only with integer ratios.
  if (m?.durationSeconds !== undefined && m.fps !== undefined && !Number.isInteger(m.fps)) {
    const ntsc = Math.round(m.fps * 1.001);
    if (Math.abs((ntsc * 1000) / 1001 - m.fps) < 0.005)
      overrides.durationFrames = Math.max(1, Math.round((m.durationSeconds * ntsc * 1000) / 1001));
  }
  // Without a manifest, default to compositing as a transparent overlay: true when neither the caller nor the root element's data-alpha says otherwise (pass manifest.alpha=false for full-frame opaque visuals).
  overrides.alpha = m?.alpha ?? (await rootAlpha(dir, m?.entry)) ?? true;
  return inspectBundle(dir, {
    manifest: overrides,
    ...(args.compositionId !== undefined ? { compositionId: args.compositionId } : {}),
    stagingDir: path.join(work, 'bundle'),
  });
}

/** The entry HTML root element's `data-alpha`; undefined when unreadable or absent (with a manifest the override has no effect, so a misread here is harmless). */
async function rootAlpha(dir: string, entry: string | undefined): Promise<boolean | undefined> {
  const html = await fs.readFile(path.join(dir, ...(entry ?? 'index.html').split('/')), 'utf8').catch(() => null);
  return html === null ? undefined : readRootAttributes(html).alpha;
}

/** Writes inline files into `dir`: paths must be relative paths inside the bundle (no `..`, absolute paths or backslashes), with exactly one of the two content forms. */
async function writeInlineFiles(files: CompositionInlineFile[], dir: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const seen = new Set<string>();
  for (const [index, file] of files.entries()) {
    const segments = file.path.split('/');
    if (
      file.path.startsWith('/') ||
      file.path.includes('\\') ||
      /^[A-Za-z]:/.test(file.path) ||
      segments.some((s) => s === '' || s === '.' || s === '..')
    ) {
      throw new ToolError('INVALID_ARGUMENTS', `files[${index}].path must be a relative path inside the bundle ('/'-separated, without . or ..): ${file.path}`);
    }
    if (seen.has(file.path)) throw new ToolError('INVALID_ARGUMENTS', `${file.path} appears twice in files`);
    seen.add(file.path);
    if ((file.content === undefined) === (file.contentBase64 === undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', `files[${index}] (${file.path}): give exactly one of content and contentBase64`);
    }
    const data = file.content !== undefined ? Buffer.from(file.content, 'utf8') : Buffer.from(file.contentBase64!, 'base64');
    const target = path.join(dir, ...segments);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }
  return dir;
}

/**
 * Which track a composition clip goes on: the given track ID if any; otherwise the topmost visual track (unlocked and empty over this span), else a new track created on top
 * (an overlay must sit above the existing picture).
 */
function placementTrack(
  sequence: Sequence,
  track: string | undefined,
  span: { fromFrame: number; durationFrames: number },
): { trackId: Id } | { trackRef: string } {
  if (track !== undefined) return { trackId: track };
  const top = sequence.tracks.filter((t) => t.kind === 'visual').sort((a, b) => b.order - a.order)[0];
  if (!top || top.locked) return { trackRef: TRACK_REF };
  const end = span.fromFrame + span.durationFrames;
  const busy = sequence.items.some((item) => {
    if (item.trackId !== top.id || !('span' in item)) return false;
    const s = item.span;
    return s.fromFrame < end && span.fromFrame < s.fromFrame + s.durationFrames;
  });
  return busy ? { trackRef: TRACK_REF } : { trackId: top.id };
}

/** The clip `replace` points to: it must be on the timeline and be a composition clip. */
function replaceTarget(video: VideoSnapshot, itemId: string): { sequenceId: Id; itemId: Id; trackId: Id; clip: string } {
  for (const sequence of Object.values(video.sequences)) {
    const item = sequence.items.find((it) => it.id === itemId);
    if (!item) continue;
    if (item.type !== 'composition') {
      throw new ToolError('INVALID_ARGUMENTS', `Clip ${itemId} is ${item.type}, not a composition clip: replace can only replace code visuals`, {
        next: 'Use videos_inspect to find the itemId of a clip whose type is composition, or drop replace and place a new one',
      });
    }
    return { sequenceId: sequence.id, itemId, trackId: item.trackId, clip: item.name?.trim() || itemId };
  }
  throw new ToolError('INVALID_ARGUMENTS', `There is no clip ${itemId} on the timeline`, {
    next: 'For replace.itemId use the itemId returned by the last compositions_import, or a clip whose type is composition in videos_inspect',
  });
}

/** A clip's position on the timeline: frames and seconds in its sequence. */
function placementOf(video: VideoSnapshot, itemId: Id): CompositionPlacement | null {
  for (const sequence of Object.values(video.sequences)) {
    const item = sequence.items.find((it) => it.id === itemId);
    if (!item || !('span' in item)) continue;
    const { fromFrame, durationFrames } = item.span;
    const seconds = (frames: number) => round((frames * sequence.fps.den) / sequence.fps.num);
    return {
      itemId,
      trackId: item.trackId,
      fromFrame,
      durationFrames,
      startSeconds: seconds(fromFrame),
      endSeconds: seconds(fromFrame + durationFrames),
    };
  }
  return null;
}

/** Verification failed: the first failing check supplies the error code and next step; all checks go into the error. */
function verificationError(report: CodeBundleVerificationReport): ToolError {
  const failed = report.checks.filter((c): c is CodeBundleCheck & { status: 'failed' } => c.status === 'failed');
  const first = failed[0];
  const code = first?.code ?? (first?.id === 'alpha' ? 'COMPOSITION_ALPHA_MISMATCH' : 'COMPOSITION_VERIFICATION_FAILED');
  const next = first?.code ? BUNDLE_NEXT[first.code] : first?.id === 'alpha' ? ALPHA_NEXT : 'Fix the code bundle according to the failed items in checks and retry';
  return new ToolError(code, `The code bundle failed verification: ${failed.map((c) => `${c.id}${c.detail ? ` (${c.detail})` : ''}`).join('; ')}`, {
    checks: report.checks,
    next,
  });
}

/** Converts code bundle runtime errors to tool errors: the error code unchanged, with details and next step. */
function toolError(error: unknown): unknown {
  if (!(error instanceof CodeBundleError)) return error;
  return new ToolError(error.code, error.message, {
    ...(error.details !== undefined ? { details: error.details } : {}),
    next: BUNDLE_NEXT[error.code],
  });
}

/** The current video: the latest state in the mirror, or the snapshot from opening when the mirror is absent. */
function current(videos: VideoService, opened: VideoOpenResult): VideoSnapshot {
  return videos.mirror(opened.ref.videoId)?.video ?? opened.snapshot.video;
}

async function writeAtomically(file: string, data: Buffer): Promise<void> {
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file).catch(async (error: unknown) => {
    await fs.rm(tmp, { force: true });
    throw error;
  });
}

/** ID used in file names: keep only letters, digits and . _ -. */
function safeName(text: string): string {
  return text.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'bundle';
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
