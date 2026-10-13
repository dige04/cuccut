import { z } from 'zod';
import { CODE_BUNDLE_CONTRACTS, COMPOSITION_INLINE_LIMITS, type EditResult, type VideoOpenResult } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { VideoService } from '../videos/video-service.ts';
import { videoChangeOf, type CompositionEdit, type CompositionService } from '../compositions/composition-service.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolApprovalNote, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { FRAMES_DIR, MAX_FRAMES, framesDirectory } from './video-frames.ts';
import { commandIdArg, videoArg } from './video-tools.ts';

/**
 * Code-graphics tools (architecture design §8, code bundle spec §2, §6, §7): import a browser composition (code bundle)
 * written by the agent into a video, verify it, bake it into a prerendered stand-in with alpha, and place it on the
 * timeline; frames can be sampled at local times both before and after import.
 *
 * The import and preview logic lives in `CompositionService` (shared with the UI's `compositions.*`); this is the tool
 * entry point: scope authorization and confirmation, opening the video, relative paths and the frame directory, and
 * the change card for each edit (`recordChange`).
 */

export interface CompositionToolsDeps {
  videos: VideoService;
  scope: ToolScope;
  /** The import and preview logic (shared with the UI's `compositions.*`). */
  compositions: CompositionService;
}

const secondsText = z.string().regex(/^\d+(\.\d+)?$/);

/** Per-file limit for inline files: hand-written pages and scripts from the agent, not an asset library (same limit as `compositions.*`). */
const MAX_INLINE_BYTES = COMPOSITION_INLINE_LIMITS.maxFileBytes;
const MAX_INLINE_FILES = COMPOSITION_INLINE_LIMITS.maxFiles;

const inlineFiles = z
  .array(
    z.strictObject({
      path: z.string().min(1).max(512).describe('Path relative to the bundle (/-separated), e.g. index.html, assets/logo.svg'),
      content: z.string().max(MAX_INLINE_BYTES).optional().describe('Text content (UTF-8); give exactly one of this and contentBase64'),
      contentBase64: z
        .string()
        .max(MAX_INLINE_BYTES * 2)
        .optional()
        .describe('Base64 of binary content (images, fonts); give exactly one of this and content'),
    }),
  )
  .min(1)
  .max(MAX_INLINE_FILES);

const manifestOverrides = z
  .strictObject({
    width: z.number().int().min(16).max(8192).optional().describe('Frame width (pixels)'),
    height: z.number().int().min(16).max(8192).optional().describe('Frame height (pixels)'),
    fps: z.number().positive().max(240).optional().describe('Frame rate; 29.97, 23.976 and 59.94 are treated as NTSC rates'),
    durationSeconds: z.number().positive().max(3600).optional().describe('Duration (seconds); requires fps as well'),
    alpha: z.boolean().optional().describe('Output with alpha (overlay); when omitted, reads data-alpha on the root element, then defaults to true. Pass false for full-frame opaque graphics'),
    bundleId: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,100}$/)
      .optional()
      .describe('Bundle ID (letters, digits, . _ -); generated from the content when omitted'),
    revision: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,50}$/)
      .optional()
      .describe('Bundle revision, default 1'),
    entry: z.string().min(1).max(512).optional().describe('Bundle path of the entry HTML; defaults to index.html (or the only HTML file)'),
    contract: z
      .enum(CODE_BUNDLE_CONTRACTS)
      .optional()
      .describe('Authoring contract: hyperframes/1 or cuccut/1; when omitted, a page that mentions __cuccutCompositions is treated as cuccut/1, otherwise hyperframes/1'),
  })
  .optional()
  .describe(
    `Optional. Only used when the bundle has no bundle.manifest.json: overrides width, height, fps, durationSeconds and alpha read from the root element's data-* attributes, as well as bundleId, revision, entry and contract (${CODE_BUNDLE_CONTRACTS.join(', ')})`,
  );

const PATH_DESCRIPTION = 'Code bundle directory: a path relative to the working directory, or absolute; give exactly one of this and files';
const FILES_DESCRIPTION = `Inline bundle files (at most ${MAX_INLINE_FILES}): each a path plus content (text) or contentBase64 (binary); must include at least the entry HTML; give exactly one of this and path`;

const schemas = {
  compositions_import: z.strictObject({
    video: videoArg,
    path: z.string().min(1).max(4096).optional().describe(PATH_DESCRIPTION),
    files: inlineFiles.optional().describe(FILES_DESCRIPTION),
    name: z.string().min(1).max(200).optional().describe('Optional. Asset name, also used as the clip name on the timeline; defaults to the bundle\'s bundleId'),
    compositionId: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. Composition ID (data-composition-id on the root element); when omitted, reads the first element with data-composition-id in the entry page, then defaults to main'),
    manifest: manifestOverrides,
    place: z
      .strictObject({
        track: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe('Optional. Visual track to place it on (track ID); defaults to the topmost visual track (if it is free over that span and not locked), otherwise a new track is created on top'),
        at: secondsText.optional().describe('Optional. Start time: seconds on the timeline (decimal string), default "0"'),
      })
      .optional()
      .describe('Optional. Where to place it on the timeline; defaults to 0 seconds on the topmost visual track. The graphic fills the canvas'),
    replace: z
      .strictObject({
        itemId: z
          .string()
          .min(1)
          .max(200)
          .describe('The composition clip to replace (the itemId returned by the previous compositions_import, or a clip with type composition in videos_inspect)'),
      })
      .optional()
      .describe(
        'Optional. After changing copy or colors and repackaging (a new revision), replaces the code graphic already on the timeline in place: clip ID, track, start, position and size, opacity, name, effects and keyframes stay the same; only the bundle revision and prerender change. The length follows the new prerender (a shorter one trims the clip; a longer one that runs into a later clip on the same track is rejected with TIMELINE_OVERLAP). When omitted, a new clip is placed on top of the old one. Mutually exclusive with place and register',
      ),
    register: z.boolean().optional().describe('Optional. When true, only verifies and registers the code bundle asset: no baking, nothing placed on the timeline; default false'),
    revision: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .describe('Optional. The video\'s current revision (from videos_inspect or the previous receipt); nothing is imported if it does not match; defaults to the latest revision'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same import so the engine does not commit it twice'),
  }),
  compositions_preview: z.strictObject({
    video: videoArg,
    path: z.string().min(1).max(4096).optional().describe('Code bundle directory: a path relative to the working directory, or absolute; give exactly one of this, files and assetId'),
    files: inlineFiles.optional().describe(`Inline bundle files, same format as compositions_import; give exactly one of this, path and assetId`),
    assetId: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('A code bundle asset already imported into this video (bundle.assetId returned by compositions_import); give exactly one of this, path and files'),
    at: z
      .array(secondsText)
      .min(1)
      .max(MAX_FRAMES)
      .describe(`Times to sample: local time inside the composition (seconds, decimal string, e.g. "1.5"), at most ${MAX_FRAMES}; times past the duration clamp to the last frame`),
    compositionId: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. Composition ID (data-composition-id on the root element); defaults as in compositions_import'),
    manifest: manifestOverrides,
  }),
};

type ToolName = keyof typeof schemas;
type ImportArgs = z.infer<(typeof schemas)['compositions_import']>;
type PreviewArgs = z.infer<(typeof schemas)['compositions_preview']>;

const TINY_OVERLAY = [
  '<!doctype html><html><body style="margin:0;background:transparent">',
  '<div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-fps="30" data-duration="3" data-alpha="true">',
  '<div id="title" style="position:absolute;left:120px;bottom:120px;font:600 64px sans-serif;color:#fff">Hello</div></div>',
  '<script>const el=document.getElementById("title");let t=0;const render=()=>{el.style.opacity=String(Math.min(1,t/0.5));};',
  'window.__timelines={main:{seek(s){t=s;render();},time(){return t;},duration(){return 3;},pause(){},play(){},timeScale(){return 1;}}};render();</script>',
  '</body></html>',
].join('');

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  compositions_import: {
    title: 'Import code graphic',
    description: [
      'Import a web-code animation (code bundle) into a video, placed on the timeline.',
      'The bundle is verified and baked into a prerendered video with alpha before it is placed.',
      'A code bundle is a directory (path) or a few inline files (files): the entry HTML (index.html by default) plus the scripts, styles, images and fonts it uses, all referenced by bundle-relative paths, with no network access (no CDNs, web fonts or fetch).',
      'Pick one authoring contract: hyperframes/1 - the root element has data-composition-id, data-width, data-height, data-fps and data-duration (seconds), and the page background is transparent (without a manifest it is treated as a transparent overlay by default; for full-frame opaque graphics pass manifest.alpha=false or set data-alpha="false"); the page registers a paused timeline on window.__timelines[<compositionId>] (seek(seconds), time(), duration(), pause()), and the frame depends only on the time it was seeked to. cuccut/1 - the page exposes initialize / renderAt(time, params) / dispose on window.__cuccutCompositions[<compositionId>]. If the bundle has a bundle.manifest.json it is used; otherwise a manifest is generated from the root element\'s data-* attributes and the manifest overrides.',
      'Import verifies in an offscreen browser: root element and timeline, seek read-back, last frame clamped to the duration, two samples of the same time match (determinism), transparent pixels actually present when alpha is declared, and no network requests at runtime. On success it bakes a ProRes 4444 prerender with alpha frame by frame at the frame rate of the video\'s root sequence (used by preview and export), adds the code bundle and prerender to the video as assets (first edit), then places a composition clip (second edit; each can be undone separately): by default at 0 seconds, filling the canvas, on the topmost visual track (a new track is created if that one is occupied or locked over that span); place can change the track and start time. With register: true it only verifies and registers the code bundle asset.',
      'To change a code graphic already placed (copy, colors): edit the source files, repackage with a new revision, then import with replace: { itemId } - the second edit uses replaceCodeBundle to swap that clip\'s code bundle and prerender in place, keeping all other settings; without replace you get an extra clip stacked on top.',
      'This is the proper way to add code graphics such as animated titles, lower thirds, charts and transition cards to a video: do not screen-record a browser or render an mp4 with ffmpeg yourself and import that as an asset. Before importing you can sample frames at given times with compositions_preview.',
      'Returns bundle (asset assetId and revision, bundleId, contentHash, size, frame rate, duration, file count), capabilities (measured alpha, random access, etc.), verification (each check), prerender (prerender asset and frame count), itemId and trackId, and item (itemId, trackId, fromFrame, durationFrames, startSeconds, endSeconds; these three are null when only registering); with replace there is also replaced (the old code bundle and prerender that were swapped out, oldDurationFrames and newDurationFrames).',
      'Error codes: BUNDLE_MANIFEST_INVALID (bad manifest, or size, frame rate or duration cannot be read), BUNDLE_FILE_NOT_ALLOWED, BUNDLE_SYMLINK, BUNDLE_TOO_LARGE, BUNDLE_NETWORK_REFERENCE (references the network: put libraries and fonts inside the bundle), BUNDLE_HASH_MISMATCH, BUNDLE_ENTRY_MISSING, BUNDLE_CONTRACT_UNSUPPORTED, COMPOSITION_ROOT_MISSING (no root element with data-composition-id), COMPOSITION_TIMELINE_MISSING (no timeline registered), COMPOSITION_SEEK_MISMATCH, COMPOSITION_INTRINSIC_MISMATCH (page and manifest disagree on size, frame rate or duration), COMPOSITION_NONDETERMINISTIC (the graphic uses Date.now, Math.random or free-running animation), COMPOSITION_ALPHA_MISMATCH (alpha declared but the frames are fully opaque), COMPOSITION_VERIFICATION_FAILED, COMPOSITION_NETWORK_BLOCKED, COMPOSITION_SCRIPT_ERROR, COMPOSITION_RENDER_TIMEOUT, COMPOSITION_HOST_UNAVAILABLE (no Electron). Every error carries next: fix the bundle accordingly and import again.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Inline a transparent title and place it at 1.5 seconds',
        args: { video: 'demo', files: [{ path: 'index.html', content: TINY_OVERLAY }], name: 'Opening title', place: { at: '1.5' } },
      },
      { title: 'Import a packaged directory', args: { video: 'demo', path: 'graphics/lower-third/1' } },
      {
        title: 'After a color change, replace the clip on the timeline in place with revision 2',
        args: { video: 'demo', path: 'graphics/lower-third/2', replace: { itemId: 'item_01J…' } },
      },
    ],
    surfaces: ['agent', 'cli', 'mcp'],
    positional: 'video',
  },
  compositions_preview: {
    title: 'Preview code graphic',
    description: [
      'Render frames of a code graphic at given composition times as PNG files.',
      'Frames are rendered in an offscreen browser; use them to check layout and animation.',
      'Give the code bundle as a directory (path), inline files (files, same format as compositions_import), or a code bundle asset already imported into this video (assetId). at is local time in the composition (seconds); times past the duration clamp to the last frame (clamped: true). Frames show the bundle\'s own output (transparent areas stay transparent), not the result composited with the video; the video is not changed, verified or baked.',
      `Files are written under ${FRAMES_DIR}/<videoId>/ in the output directory (the working directory for sessions and the terminal), named composition-<bundleId>-at-<milliseconds>ms.png; sampling the same time again overwrites the file.`,
      'Returns frames (for each: at, file, the actually sampled sampledSeconds, clamped, and the PNG\'s sha256 - the graphic is deterministic only if two samples of the same time have the same digest), size and duration. Error codes are the same as compositions_import.',
    ].join('\n'),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [
      { title: 'Check a few times before importing', args: { video: 'demo', path: 'graphics/lower-third', at: ['0', '1.2', '3.5'] } },
      { title: 'Check a code bundle already imported', args: { video: 'demo', assetId: 'asset_01J…', at: ['0.5'] } },
    ],
    surfaces: ['agent', 'cli', 'mcp'],
    positional: 'video',
  },
};

export class CompositionTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: CompositionToolsDeps;

  constructor(deps: CompositionToolsDeps) {
    // The catalog consistency test only constructs, never calls: dependencies are read when used.
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'compositions_import':
        return this.#import(args as ImportArgs, principal);
      case 'compositions_preview':
        return this.#preview(args as PreviewArgs, principal);
    }
    throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
  }

  async #import(args: ImportArgs, principal: ToolPrincipal) {
    const { scope, compositions } = this.#deps;
    const access = scope.authorize(principal, true);
    let approval: ToolApprovalNote | void = undefined;
    const result = await compositions.import(args, {
      open: () => scope.open(args.video, access),
      importBase: (opened) => scope.importBase(access, opened),
      confirm: async ({ name, place, replace }) => {
        approval = await scope.confirm(access, {
          tool: 'compositions_import',
          video: args.video,
          ...confirmSummary(
            replace
              ? RcAgentTools.replaceCompositionSummary({ name, clip: replace.clip })
              : RcAgentTools.importAssetSummary({ name, place }),
          ),
        });
      },
      apply: (opened, edit) => this.#apply(access, opened, principal, edit),
    });
    return { ...result, ...approvalField(approval) };
  }

  async #preview(args: PreviewArgs, principal: ToolPrincipal) {
    const { scope, compositions } = this.#deps;
    const access = scope.authorize(principal, false);
    const preview = await compositions.preview(args, {
      open: () => scope.open(args.video, access),
      importBase: (opened) => scope.importBase(access, opened),
      framesDir: (opened) => framesDirectory(scope.saveRoot(access, opened), opened.ref.videoId, scope.importBase(access, opened).confine),
    });
    return {
      ...preview,
      note: 'Frames show the bundle\'s own output (transparent areas stay transparent), not the result composited with the video; times past the duration clamp to the last frame (clamped: true).',
    };
  }

  /** Commits one edit and records a change card for the receipt (same as `edits_apply`). */
  async #apply(access: ToolAccess, opened: VideoOpenResult, principal: ToolPrincipal, edit: CompositionEdit): Promise<EditResult> {
    const { videos, scope } = this.#deps;
    const videoId = opened.ref.videoId;
    const result = await videos.apply(
      {
        videoId,
        commandId: scope.commandId(access, edit.commandId),
        expectedRevision: edit.expectedRevision,
        operations: edit.operations as never,
        label: edit.label,
      },
      principal,
      { ...taskOf(access), protections: scope.protections?.(access, videoId) ?? [] },
    );
    scope.recordChange(access, videoChangeOf(videos, opened, result));
    return result;
  }
}

/** Session calls carry the in-progress task ID (recorded as the transaction's source); external service calls do not. */
function taskOf(access: ToolAccess): { taskId?: string } {
  const taskId = (access as { taskId?: unknown }).taskId;
  return typeof taskId === 'string' ? { taskId } : {};
}
