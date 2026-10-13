import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  RpcError,
  newId,
  type DocumentContent,
  type EditOperation,
  type EditResult,
  type Id,
  type VideoChange,
  type VideoCreated,
  type VideoOpenResult,
  type VideoSnapshot,
  type Rate,
  type AssetRevision,
  type DocumentRecord,
  type Sequence,
  itemAssetRef,
  itemTimeMap,
  localizeText,
  mediaTimeToSeconds,
} from '@cuccut/protocol';
import {
  EditorWasmError,
  sourceChapters,
  type SourceChapterAnchor,
  type SourceChapterRow,
  type SourceChapterStatus,
  type SourceChaptersResult,
} from '@cuccut/editor-wasm';
import {
  CAPTION_DOCUMENT_REF,
  EditorWasmUnavailable,
  PipelineStepError,
  generatedImportOperation,
  linkImportAssetOperation,
  planCaptionLayer,
  sourceSentences,
  type CaptionSource,
} from '@cuccut/jobs';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { MediaAnalysis } from '../media-analysis.ts';
import type { FaceDetector } from '../face-detection.ts';
import type { PackageImporter } from '../videos/package-import.ts';
import type { VideoService } from '../videos/video-service.ts';
import { deriveVideo, prepareDerive, type DeriveDeps } from '../videos/video-derive.ts';
import { clockLabel } from './derive-plan.ts';
import { EDIT_OPERATIONS, OPERATION_FAMILIES, OPERATION_TYPES, describeOperation } from './edit-ops.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { assetSegments, projectChapters, type ProjectedChapter } from './source-chapters.ts';
import { fillTranslationAlignments } from './translation-alignment.ts';
import { syncTranslationCaptions } from './translation-captions.ts';
import { OperationShapeError, digestVideo, digestReceipt, normalizeOperations } from './video-digest.ts';
import {
  DEFAULT_MIN_SHOT,
  DEFAULT_SCENE_THRESHOLD,
  MAX_SHOTS_RANGE_SECONDS,
  SHOTS_NOTE,
  detectShots,
  shotsToolError,
} from './video-shots.ts';
import {
  DEFAULT_RANGE_COUNT,
  FRAMES_DIR,
  FRAMES_NOTE,
  MAX_FRAMES,
  frameSourceAt,
  frameTimes,
  framesDirectory,
  withFaces,
  writeFrame,
} from './video-frames.ts';

/**
 * The video tool catalog (architecture design §3.5): what agents call over MCP. Every call goes back to the same
 * `VideoService` as the UI: the same engine, the same revision checks and undo; the actor is built from the caller's
 * identity (§4.2) and the session's task ID is filled in by the Runtime.
 *
 * Permissions and scope are checked on every call (`ToolScope`): agents in a session can use the tools only while a task
 * is in progress, and plan mode is read-only (`AgentScope`); external service clients follow the access policy
 * (`ServiceScope`, §4.8).
 */

export interface VideoToolsDeps {
  videos: VideoService;
  scope: ToolScope;
  /** Frame grabbing (`videos_frames`): the same cache and ffmpeg as the asset library thumbnails. */
  analysis: MediaAnalysis;
  /** Marks faces on grabbed frames (`faces` of `videos_frames`); when absent, `detector` is null. */
  faces?: FaceDetector;
  /** Opens portable packages (`videos_import_package`): the same entry point as `videos.importPackage`. */
  packages: PackageImporter;
  /** When deriving a child video (`videos_derive`), finds an existing child via the Space index; when absent, only the folders next to the parent video are checked. */
  findDerived?: DeriveDeps['findDerived'];
}

export const videoArg = z.string().min(1).max(1000).describe('Video: a path or videoId from videos_list');
const revisionArg = z.string().regex(/^\d+$/);
export const commandIdArg = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);

/** Layout profiles of the captions and translation core (`layout_profile.rs` in `crates/speech-doc`). Both use the same source-side cue segmentation parameters and differ only in the maximum number of rendered lines. */
const LAYOUT_PROFILES = ['default', 'two-line'] as const;

/** A decimal seconds string (a moment on the timeline). */
const secondsText = z.string().regex(/^\d+(\.\d+)?$/);

/** How operations write times and sequences, shared by the `edits_apply` description and the `edits_ops` result. */
const TIME_CONVENTIONS =
  'Times are in seconds (a number, e.g. 1.5); {"unit":"frames","value":30} also works. sequenceId defaults to the root sequence when omitted; alignment defaults to nearest-frame.';

const PROJECT_DESCRIPTION =
  'Optional. The project to create it in: a project id (projectId from videos_list), or the absolute path of a registered project folder. In a session, when omitted it is created in the session\'s project (or the session\'s working directory), and when given it can only be the session\'s project; required for external services';

const schemas = {
  videos_list: z.strictObject({}),
  videos_create: z.strictObject({
    name: z.string().min(1).max(200).describe('Video name, also used as the video folder name'),
    width: z.number().int().min(16).max(8192).optional().describe('Canvas width, default 1920'),
    height: z.number().int().min(16).max(8192).optional().describe('Canvas height, default 1080'),
    fps: z.number().positive().max(240).optional().describe('Frame rate, default 30; 29.97, 23.976 and 59.94 are treated as NTSC rates'),
    project: z.string().min(1).max(1000).optional().describe(PROJECT_DESCRIPTION),
  }),
  videos_inspect: z.strictObject({
    video: videoArg,
    fromSeconds: z.number().nonnegative().optional().describe('List only items intersecting this span: start (seconds)'),
    toSeconds: z.number().positive().optional().describe('List only items intersecting this span: end (seconds)'),
    limit: z.number().int().min(1).max(1000).optional().describe('Maximum number of items to list, default 200'),
  }),
  videos_frames: z.strictObject({
    video: videoArg,
    at: z
      .array(secondsText)
      .min(1)
      .max(MAX_FRAMES)
      .optional()
      .describe(`Moments to grab frames at: timeline seconds (decimal strings, e.g. "12.5"), at most ${MAX_FRAMES}; give exactly one of this and range`),
    range: z
      .string()
      .regex(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
      .optional()
      .describe('A span "start:end" (seconds, e.g. "10:20"); grabs count evenly spaced frames starting at the start; give exactly one of this and at'),
    count: z
      .number()
      .int()
      .min(1)
      .max(MAX_FRAMES)
      .optional()
      .describe(`Only with range: number of frames, default ${DEFAULT_RANGE_COUNT}, at most ${MAX_FRAMES}`),
    format: z.enum(['png', 'jpeg']).optional().describe('Image format: png (default) or jpeg'),
    maxWidth: z
      .number()
      .int()
      .min(16)
      .max(1920)
      .optional()
      .describe('Optional. Maximum frame width (pixels); scales down proportionally, never up; when omitted the long edge is at most 1280'),
  }),
  videos_shots: z.strictObject({
    video: videoArg,
    range: z
      .string()
      .regex(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
      .optional()
      .describe(`Optional. A span "start:end" (seconds on the edited timeline, e.g. "10:20"), at most ${MAX_SHOTS_RANGE_SECONDS / 60} minutes; the whole timeline when omitted`),
    threshold: z
      .number()
      .gt(0)
      .max(1)
      .optional()
      .describe(`Optional. Scene score threshold (0-1); a score above it counts as a cut; default ${DEFAULT_SCENE_THRESHOLD}. Lower it when cuts are missed, raise it when there are false cuts`),
    minShot: z
      .number()
      .min(0)
      .max(60)
      .optional()
      .describe(`Optional. Shortest shot (seconds); shorter shots are merged into the previous one; default ${DEFAULT_MIN_SHOT}`),
  }),
  videos_history: z.strictObject({
    video: videoArg,
    limit: z.number().int().min(1).max(200).optional().describe('Maximum number of edits to list (most recent first), default 20'),
  }),
  videos_import_package: z.strictObject({
    file: z.string().min(1).max(4096).describe('Portable package (.cuccut file): a path relative to the working directory, or absolute'),
    project: z.string().min(1).max(1000).optional().describe(PROJECT_DESCRIPTION),
    name: z.string().min(1).max(200).optional().describe('Optional. Name of the new video, also used as the video folder name; the video name in the package when omitted'),
  }),
  documents_read: z.strictObject({
    video: videoArg,
    documentId: z.string().min(1).max(200).describe('A documentId from the documents in videos_inspect'),
    revision: revisionArg.optional().describe('Optional. Document revision (a decimal number string); reads the current revision when omitted'),
    translateTo: z
      .string()
      .min(1)
      .max(35)
      .optional()
      .describe('Optional. Give it when you read a transcript in order to translate it yourself into this language (BCP 47, e.g. en, zh-CN): CucCut shows "Translating" until a translation in this language is written'),
  }),
  documents_put: z.strictObject({
    video: videoArg,
    document: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. The documentId of the document to replace (from the documents in videos_inspect); when omitted a new document is created, and kind is then required'),
    kind: z
      .string()
      .regex(/^[a-z0-9./-]{1,64}$/)
      .optional()
      .describe('Document kind when creating, e.g. speech (transcript), translation; not needed when replacing, and if given it must match the existing one'),
    name: z.string().min(1).max(200).optional().describe('Optional. Document name; kind is used when omitted on creation'),
    language: z.string().min(1).max(35).optional().describe('Document language (BCP 47, e.g. en, zh-CN); required when creating a translation'),
    sourceDocument: z.string().min(1).max(200).optional().describe('The documentId of the source document; required when creating a translation (the transcript it translates)'),
    sourceAsset: z.string().min(1).max(200).optional().describe('Optional. The assetId of the source asset (the asset the transcript belongs to)'),
    body: z
      .record(z.string(), z.unknown())
      .describe(
        'The complete body object; replaces the whole body, not a delta: for a transcript, edit the body read with documents_read; for the shape of a translation (cuccut.translation/2), see the documents_read description',
      ),
    revision: revisionArg
      .optional()
      .describe(
        'Optional. The current revision of the video (revision from videos_inspect or the last receipt; not the document revision in the documents_read result); nothing is written when it does not match; the latest revision is used when omitted',
      ),
    label: z.string().min(1).max(120).optional().describe('Optional. Description of this edit, shown in history and undo; generated from the document when omitted'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same edit so the engine does not commit it twice'),
  }),
  assets_import: z.strictObject({
    video: videoArg,
    path: z.string().min(1).max(4096).optional().describe('Media file: a path relative to the working directory, or absolute; give exactly one of this and artifactId'),
    artifactId: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('A generated artifact (an artifactId from the outputs of jobs_inspect), not regenerated; give exactly one of this and path'),
    name: z.string().min(1).max(200).optional().describe('Optional. Asset name; the file name when omitted'),
    storage: z
      .enum(['linked', 'managed'])
      .optional()
      .describe('Only with path: linked (default; the file stays where it is and the video only records its location) or managed (copies the bytes into the video folder); artifacts are always managed'),
    place: z
      .strictObject({
        track: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe('main (default: the first unlocked track of the matching kind; video and images on a visual track, audio on an audio track) or a track ID'),
        at: z
          .string()
          .regex(/^(\d+(\.\d+)?|end)$/)
          .optional()
          .describe('Start time: timeline seconds (a decimal string), or end (default: appended to the end of the track)'),
      })
      .optional()
      .describe('Optional. Place it on the timeline after importing: track is main (default) or a track ID, at is seconds or end (default); when omitted it is only registered as an asset'),
    revision: revisionArg
      .optional()
      .describe('Optional. The current revision of the video (revision from videos_inspect or the last receipt); nothing is imported when it does not match; the latest revision is used when omitted'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same edit so the engine does not commit it twice'),
  }),
  assets_prune: z.strictObject({
    video: videoArg,
    assetIds: z
      .array(z.string().min(1).max(200))
      .min(1)
      .max(500)
      .optional()
      .describe('Optional. Only consider (and, with apply, only remove) these assets; all unreferenced assets when omitted. A code bundle and its prerender proxy are handled as a pair: listing one brings the other along'),
    apply: z.boolean().optional().describe('Optional. true actually removes them (the user is asked to confirm); default false only lists the removable assets without changing the video'),
    revision: revisionArg
      .optional()
      .describe('Optional. Only with apply: the current revision of the video (revision from videos_inspect or the last receipt); nothing is removed when it does not match; the latest revision is used when omitted'),
    commandId: commandIdArg.optional().describe('Optional. Only with apply: pass the same value when retrying the same edit so the engine does not commit it twice'),
  }),
  chapters_adopt: z.strictObject({
    video: videoArg,
    asset: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. The asset the chapters come from (assetId); when omitted, the only asset in the video with source chapters (or a timestamped outline in its description)'),
    document: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. The transcript to snap to (documentId of kind speech); when omitted, the only transcript of this asset; no snapping when there is no transcript'),
    outline: z
      .union([
        z
          .array(
            z.strictObject({
              at: z.number().nonnegative().describe('Chapter start time: seconds of asset (source) time, not timeline seconds'),
              title: z.string().min(1).max(160).describe('Title'),
            }),
          )
          .min(1)
          .max(400),
        z.string().min(1).max(20_000),
      ])
      .optional()
      .describe(
        'Optional. An explicit outline that takes precedence over the asset source: [{ at, title }] (seconds of asset time), or timestamped raw text (e.g. a description pasted by the user, one "0:00 Title" per line, at least two lines)',
      ),
    label: z.string().min(1).max(120).optional().describe('Optional. A short description of this edit, shown in history and undo; "Adopt source chapters" when omitted'),
    revision: revisionArg
      .optional()
      .describe('Optional. The current revision of the video (revision from videos_inspect or the last receipt); nothing changes when it does not match; the latest revision is used when omitted'),
    dryRun: z.boolean().optional().describe('Optional. true only returns the plan (the snapping and projection results) without changing the video or asking for confirmation'),
  }),
  edits_ops: z.strictObject({
    op: z
      .enum(OPERATION_TYPES)
      .optional()
      .describe(`Optional. Show only this operation; when omitted, all operations are listed by family. Operations: ${OPERATION_TYPES.join(', ')}`),
  }),
  edits_apply: z.strictObject({
    video: videoArg,
    expectedRevision: revisionArg.describe('The revision given by videos_inspect or the last receipt'),
    label: z.string().min(1).max(120).describe('A short description of this edit, shown in history and undo, e.g. "Place demo.mp4 at 1 s"'),
    operations: z
      .array(z.looseObject({ type: z.enum(OPERATION_TYPES) }))
      .min(1)
      .max(200)
      .describe('Operations executed in order; see the tool description for the format'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same edit so the engine does not commit it twice'),
    dryRun: z
      .boolean()
      .optional()
      .describe(
        'Optional. true only preflights without committing: checks the shape and arguments of the operations, whether the referenced objects and media files exist, and whether expectedRevision is current, and returns the completed operations and their impact; same-track overlaps, locks and protections are checked by the engine only on an actual commit',
      ),
  }),
  edits_undo: z.strictObject({
    video: videoArg,
    transactionId: z.string().min(1).max(200).optional().describe('The edit to undo; when omitted, your own most recent edit is undone'),
    expectedRevision: revisionArg.optional().describe('Optional. The current revision of the video; nothing is undone when it does not match'),
  }),
  videos_derive: z.strictObject({
    video: videoArg,
    start: z.number().nonnegative().describe('Range start: seconds on the edited timeline (matching the times shown by videos_inspect and the player)'),
    end: z.number().positive().describe('Range end: seconds on the edited timeline, greater than start; clamped to the duration when beyond it'),
    name: z.string().trim().min(1).max(100).optional().describe('Optional. Child video name, also the first part of the folder name; "<parent video name> · mm:ss–mm:ss" when omitted'),
    width: z.number().int().min(16).max(8192).optional().describe('Optional. Child video canvas width; inherited from the parent video when omitted'),
    height: z.number().int().min(16).max(8192).optional().describe('Optional. Child video canvas height; inherited from the parent video when omitted'),
    fit: z.enum(['cover', 'contain']).optional().describe('Optional. How video items are placed when the canvas aspect ratio changes: cover (fill, cropping the excess) or contain (show in full, letterboxed); unchanged when omitted'),
    crop: z
      .strictObject({
        left: z.number().min(0).lt(1),
        top: z.number().min(0).lt(1),
        right: z.number().min(0).lt(1),
        bottom: z.number().min(0).lt(1),
      })
      .refine((c) => c.left + c.right < 1 && c.top + c.bottom < 1)
      .optional()
      .describe('Optional. Fraction cropped from each edge of the video items (0 to 1, with left + right and top + bottom each below 1)'),
    crops: z
      .array(
        z
          .strictObject({
            from: z.number().nonnegative(),
            to: z.number().positive(),
            left: z.number().min(0).lt(1),
            top: z.number().min(0).lt(1),
            right: z.number().min(0).lt(1),
            bottom: z.number().min(0).lt(1),
          })
          .refine((c) => c.to > c.from && c.left + c.right < 1 && c.top + c.bottom < 1),
      )
      .max(64)
      .refine((list) => [...list].sort((a, b) => a.from - b.from).every((c, n, all) => n === 0 || c.from >= all[n - 1]!.to))
      .optional()
      .describe(
        'Optional. Per-shot framing: each segment\'s from and to are seconds on the parent video\'s edited timeline (the same clock as start and end; the shots from videos_shots can be used directly), plus that segment\'s crop fractions for the four edges (as in crop); at most 64 segments, non-overlapping. Gaps under 0.5 seconds at the start and end of the range (when a range boundary falls in a pause and is snapped a few frames wider than requested) are covered automatically by extending the first and last segments; larger gaps and uncovered stretches in between use crop',
      ),
    captions: z.boolean().optional().describe('Optional. Build an original-language caption layer for the child video from the copied transcripts, default true'),
    translations: z.boolean().optional().describe('Optional. Copy the parent video\'s translations, default true'),
    chapters: z.boolean().optional().describe('Optional. Copy the parent video\'s chapters, default true'),
    hook: z.string().trim().min(1).max(300).optional().describe('Optional. The hook: the opening line of this clip, shown on the result page card; the first sentence of the child video\'s kept range when omitted'),
    reason: z.string().trim().min(1).max(500).optional().describe('Optional. Why this range was picked, in a sentence or two, shown on the result page card'),
    notes: z
      .array(z.string().trim().min(1).max(80))
      .max(8)
      .optional()
      .describe('Optional. Notes: a few short reminders for the user (e.g. "Opens on a reaction shot"), each shown as a small tag on the result page card'),
  }),
  captions_create: z.strictObject({
    video: videoArg,
    documentId: z.string().min(1).max(200).describe('The documentId of a transcript (kind speech) or translation (kind translation)'),
    bilingual: z
      .boolean()
      .optional()
      .describe('Translations only: true shows the translation together with the original (translation primary, original secondary, sharing one caption style); default false shows only the translation'),
    layoutProfileId: z
      .enum(LAYOUT_PROFILES)
      .optional()
      .describe('Optional. The layout profile used to segment captions into cues, default default; the existing default and two-line profiles use the same segmentation parameters and produce the same cues'),
  }),
};

type ToolName = keyof typeof schemas;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  videos_list: {
    title: 'List videos',
    description: 'Lists the videos in the working directory (subfolders containing a video.db). For those already open, it also gives the videoId and name.',
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'List videos', args: {} }],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  videos_create: {
    title: 'Create video',
    description: [
      'Creates an empty video (one visual track, one audio track).',
      'Without project it is created in the working directory (the session\'s project, or the session\'s working directory); with project, it can only be the session\'s project. Returns the same digest as videos_inspect.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Create a 1080p landscape video', args: { name: 'Product launch' } },
      { title: 'Create a vertical video', args: { name: 'Vertical short', width: 1080, height: 1920, fps: 30 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'name',
  },
  videos_inspect: {
    title: 'Inspect video',
    description: [
      'Reads the current state of a video.',
      'Includes the revision, sequence (frame rate, canvas, duration), tracks, items on the timeline (with placement, volume, effects and crop), transitions, chapters, ducking rules, the asset library, documents (transcripts, translations, captions, etc.; headers only, without bodies) and recent edit history.',
      'Assets imported from a link (or whose provenance carries platform information) have source: platform, webpageUrl, uploader, uploadDate, title, description (truncated to 1200 characters; descriptionTruncated says whether it was) and the author chapters [{ at, title }] (seconds of asset time; chapters provided by the platform, or else a timestamped outline from the description; not snapped). Use it as background (names, terminology) when polishing a transcript or identifying speakers; to adopt the author chapters, use chapters_adopt.',
      'An item\'s place is in percentages of the frame: x, y are the box center, w is the box width as a percentage of the frame width; only fields that are set are listed. For visual media such as video and images, mode is fullscreen (fills the canvas; position and width have no effect) or pip (picture in picture). Volume is a linear multiplier, 1 being the original volume.',
      'Call it before editing to get the revision and object IDs. Items are sorted by start time; with many items, read a span with fromSeconds/toSeconds.',
      'Next: assets_import to import media and place it on the timeline, documents_put to write documents (transcripts, translations), videos_frames to look at the picture, chapters_adopt to adopt chapters that come with an asset source, and edits_apply for other edits; videos_history for the full edit history and checkpoints.',
      'Times are given in both seconds and frames; frames are the engine\'s authoritative unit.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Inspect a video', args: { video: 'demo' } },
      { title: 'Only items in the first 30 seconds', args: { video: 'demo', fromSeconds: 0, toSeconds: 30, limit: 50 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  documents_read: {
    title: 'Read document',
    description: [
      'Reads the body of a document in a video. Documents include transcripts, translations and captions.',
      'Returns the document header (kind, name, language, source asset and source document, revisions), the revision read and the body.',
      'To change a document, read the current revision first, then write the new complete body with documents_put (with document set to this documentId).',
      'A transcript (kind speech) also carries translationBasis: the sourceBasis needed to write a translation and the sentences segmented by the rules (id, fingerprint, text, wordIds, plus start and end: seconds on the asset clock, from the start of the first visible word to the end of the last visible word; when the parent video plays this asset from 0 seconds at normal speed with no cuts, these are the start and end for videos_derive; otherwise convert via the timeline first). This is enough for finding sentence boundaries; there is no need to read the whole body. When you will translate it yourself, read the transcript with translateTo (the target language): CucCut shows "Translating" on the video card and in the captions panel until a translation in that language is written with documents_put (translationJob in the result is the jobId of this progress record). After translating, create the translation with documents_put: kind "translation", language set to the target language, sourceDocument set to the documentId of this transcript, and body {"schema":"cuccut.translation/2","language":<target language>,"sourceBasis":translationBasis.sourceBasis,"units":[one per sentence: {"id":"t-<sentence id>","sourceSentenceId":<sentence id>,"sourceFingerprint":<sentence fingerprint>,"naturalText":<translation>,"alignment":{"basis":"natural","correspondence":"sentence","blocks":[],"sourceWordIds":<sentence wordIds>},"status":"draft"}]}, with exactly these fields.',
      'alignment is the source words this translated sentence corresponds to (sentence-level alignment): exporting bilingual subtitles and building caption layers both take their timing from it. textHash ("sha256:" plus the SHA-256 of naturalText) need not be computed; the Runtime fills it in on write. Where alignment is written as null and the sentence and fingerprint check out, the Runtime likewise fills in sentence-level alignment (filledAlignments in the receipt is how many sentences were filled).',
      'To show a transcript or translation on screen, build a caption layer with captions_create; do not write caption documents yourself.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Read a transcript', args: { video: 'demo', documentId: 'doc_speech_1' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  videos_frames: {
    title: 'Grab video frames',
    description: [
      'Grabs moments on the timeline as image files, to look at the picture.',
      `at lists the moments, or range gives a span and count the number of frames (evenly spaced, starting at the start); at most ${MAX_FRAMES} frames per call. For each moment it takes the topmost video item in the picture (enabled, on a visible track; higher visual tracks win), converts the moment to asset time through that item's time map and grabs that frame of the asset; when there is no video item at that moment, file is null and no error is raised.`,
      'Frames are not the composited picture (composited: false): captions, text, stickers and overlaid elements are not included, and picture-in-picture position, crop and effects are not applied.',
      `Files are written under the output directory (the working directory for sessions and the terminal, the project's exports for external services) in ${FRAMES_DIR}/<videoId>/, named at-<milliseconds>ms.png (or .jpg); grabbing the same moment again overwrites it. Default png with the long edge at most 1280 pixels; maxWidth scales down by width.`,
      'Each frame that has a file also gets face detection (the YuNet model shipped with the app, run on this machine): faces is a list of face boxes [{x, y, w, h, score}], where x, y is the top-left corner of the box, x, y, w, h are all normalized to 0-1 by this frame\'s width and height, and score is a 0-1 confidence, sorted by score from high to low; coordinates refer to the asset picture (without picture-in-picture or crop applied). The top-level detector is "yunet"; when the detector is unavailable it is null and every faces is an empty array, which does not mean there are no people in the picture.',
      'Returns frames (for each frame: at, file, width, height, faces, plus the item and asset it was taken from), detector, composited and note.',
    ].join('\n'),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [
      { title: 'Grab frames at two moments', args: { video: 'demo', at: ['1', '12.5'] } },
      { title: '6 evenly spaced frames from the first 30 seconds', args: { video: 'demo', range: '0:30', count: 6, format: 'jpeg', maxWidth: 640 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  videos_shots: {
    title: 'Find shot changes',
    description: [
      'Finds where the picture changes (shot changes) within a span of the timeline. Use it to look at and frame each shot separately. Read-only; writes no files.',
      `range is "start:end" (seconds) on the edited timeline, at most ${MAX_SHOTS_RANGE_SECONDS / 60} minutes; the whole timeline when omitted. The span is segmented by the same rule as frame grabbing (the topmost enabled video item on a visible track): where the item changes and the source picture does not continue, there is a cut of kind "edit" (score null); within each segment the source picture is checked with the ffmpeg scene score, and frames above threshold (default ${DEFAULT_SCENE_THRESHOLD}) are cuts of kind "scene". Shots shorter than minShot seconds (default ${DEFAULT_MIN_SHOT}) are merged into the previous one.`,
      'It only looks for abrupt picture changes and does not recognize people: dissolves, zooms and slow pans can be missed, and flashes or fast motion can cause false cuts; when the result looks wrong, adjust threshold, or check the frames before and after a cut with videos_frames.',
      'Returns range (the span actually checked after snapping to frames), cuts [{at, score, kind}] (at is timeline seconds, snapped to a frame: the first frame of the new shot), shots [{start, end, sampleAt}] (sampleAt is 3 moments at 20%, 50% and 80% of the shot, usable directly as the at of videos_frames), threshold, minShot, detector ("ffmpeg-scene") and note.',
      'It decodes the whole span: long spans take a while; asking again for the same asset, span and threshold uses the cache.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Find shot changes in a span', args: { video: 'demo', range: '1477.8:1532.5' } },
      { title: 'Search again with a lower threshold', args: { video: 'demo', range: '0:60', threshold: 0.2, minShot: 0.5 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  videos_history: {
    title: 'View edit history',
    description: [
      'Lists the edit history and checkpoints of a video.',
      'History is listed most recent first: each edit\'s transactionId, label, who made it (by: user, agent or system), the resulting revision, time, whether it has been undone (undone), whether it is itself an undo (undoOf) and whether it can be undone now (undoAvailable). Checkpoints are those left by createCheckpoint (name, revision, time and note).',
      'To undo an edit, pass its transactionId to edits_undo.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'See recent edits', args: { video: 'demo' } },
      { title: 'See the last 50 edits', args: { video: 'demo', limit: 50 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  videos_import_package: {
    title: 'Open portable package',
    description: [
      'Opens a portable package (.cuccut file) as a new video.',
      'Unpacks it while verifying (format and version, each file\'s length and sha256) into a new video folder (a new videoId, with all assets collected into the video); if any step fails, no video folder is left behind.',
      'Without project it is created in the working directory (the session\'s project, or the session\'s working directory); with project, it can only be the session\'s project. The folder is named after name, or the video name in the package when omitted, with a number appended on a name clash. Returns the same digest as videos_inspect.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Open a portable package', args: { file: 'exports/Product launch.cuccut' } },
      { title: 'Open and rename', args: { file: '/Users/me/Downloads/demo.cuccut', name: 'Launch event (review)' } },
    ],
    surfaces: ['agent', 'cli'],
    positional: 'file',
  },
  documents_put: {
    title: 'Write document',
    description: [
      'Writes a new revision of a document, or creates a new one. Documents include transcripts and translations.',
      'Compiles to one putDocument operation: a single undoable edit. body is the complete body object: when replacing, read the current body with documents_read first, change it, and give document; when creating, omit document and give kind.',
      'Creating a translation: kind "translation", language set to the target language, sourceDocument set to the transcript it translates, and body filled in from the translationBasis returned by documents_read (see the documents_read description for the shape); when alignment is written as null, the Runtime fills in sentence-level alignment by sentence (filledAlignments in the result is how many sentences were filled). Afterwards, turn the translation into captions with captions_create.',
      'Changing an existing translation (with document): in the same edit, the Runtime replaces only the cues of the changed sentences in caption layers generated from it, keeping their timing (syncedCaptions in the result is how many caption documents were updated along with it); do not build another caption layer.',
      'No new revision is created when the body is unchanged. The latest revision is used when revision is omitted.',
      'Returns the same receipt as edits_apply, plus the documentId of the document.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Create an English translation',
        args: {
          video: 'demo',
          kind: 'translation',
          language: 'en',
          sourceDocument: 'doc_speech_1',
          body: {
            schema: 'cuccut.translation/2',
            language: 'en',
            sourceBasis: {
              speechRef: { id: 'doc_speech_1', revision: '3' },
              sequenceId: 'seq_1',
              scopeLineage: [],
              editViewHash: 'sha256:…',
            },
            units: [
              {
                id: 't-s1',
                sourceSentenceId: 's1',
                sourceFingerprint: 'sha256:…',
                naturalText: 'Hello, everyone.',
                alignment: null,
                status: 'draft',
              },
            ],
          },
        },
      },
      {
        title: 'Replace the body of a transcript',
        args: {
          video: 'demo',
          document: 'doc_speech_1',
          revision: '12',
          body: {
            schema: 'cuccut.speech/1',
            clock: 'source-asset',
            timescale: 1000,
            speakers: [],
            words: [],
            sentences: null,
            chapters: [],
          },
          label: 'Fix typos in the transcript',
        },
      },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  assets_import: {
    title: 'Import asset',
    description: [
      'Imports a media file or a generated artifact as a video asset. It can also place it on the timeline in the same call.',
      'Compiles to importAsset (plus an addItem when place is given): a single undoable edit. path defaults to linked: the file stays where it is, so moving or deleting it later leaves the asset missing; give storage "managed" when the user asks for it to be copied into the video, or the file is a temporary file that will be cleaned up later. artifactId is an artifact from the outputs of jobs_inspect, whose bytes are always collected into the video.',
      'With place.track main (default) it goes on the first unlocked track of the matching kind (video and images on a visual track, audio on an audio track); a track ID can also be given. place.at is seconds, or end (default: appended to the end of the track).',
      'Returns the same receipt as edits_apply, plus assetId and itemId (itemId is null when it was not placed on the timeline).',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Import and append to the end of the main track', args: { video: 'demo', path: 'clips/intro.mp4', place: {} } },
      { title: 'Import background music at 0 seconds', args: { video: 'demo', path: 'music/bgm.mp3', storage: 'managed', place: { at: '0' } } },
      { title: 'Import a generated image (register only)', args: { video: 'demo', artifactId: 'sha256:3f2a…' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  assets_prune: {
    title: 'Remove unused assets',
    description: [
      'Lists and removes assets that nothing in the video references any more. That is, no item on any sequence or its prerender proxy, no chapter thumbnail and no document source (transcript, cut set, editorial proposal) points to them. References are determined by the engine.',
      'By default it only lists (no change to the video, no confirmation): each entry has assetId, name, kind, mediaType, byteLength (bytes of the current revision), storage (managed is in the video folder, linked files stay where they are) and pairedWith (the other half of a pair). apply: true compiles to removeAssets to remove them (a single undoable edit), and the user is asked to confirm.',
      'A code bundle and the prerender proxy baked from it are handled as a pair: after compositions_import with replace swaps a revision, the old code bundle and its proxy are both unreferenced, and removing one brings the other along.',
      'Only asset records are removed: managed bytes are reclaimed later by cleanup according to references (kept while undo or checkpoints still need them), and the original files of linked assets are untouched. Assets still referenced are not removed (INVALID_OPERATION, details.rule is asset-in-use, details.usedBy lists what uses them); to remove one, first delete or replace the items using it.',
      'Use it only when the user wants a cleanup, or for old revisions you replaced yourself (e.g. a code graphic replaced after a copy change) that are no longer needed; media the user imported but has not yet placed on the timeline may still be wanted, so ask the user first.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'See which assets are unused', args: { video: 'demo' } },
      { title: 'Remove a replaced old code graphic', args: { video: 'demo', assetIds: ['asset_01J…'], apply: true } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  chapters_adopt: {
    title: 'Adopt source chapters',
    description: [
      'Adopts the chapters that come with an asset source as the video chapters. They are snapped to the transcript and projected onto the timeline, replacing the whole chapter list of the video.',
      'The chapters come from the chapters the platform provided when importing from a link, or else a timestamped outline from the description; or from the outline you give. Compiles to one setChapters (a single undoable edit), and the user is asked to confirm.',
      'Snapping: author timestamps are only accurate to the second and often a few seconds before the topic actually starts, so each chapter (at time t) snaps to the nearest structural start in the transcript. First, within [t-1, t+2] seconds, it looks for paragraph, sentence and cue starts in that order, and the first tier with candidates decides: a single candidate is matched, several are ambiguous (the one nearest t wins; on a tie, the one after t); if none, it widens to [t-4, t+6] seconds, accepting only paragraph and sentence starts, and takes the nearest (snapped); if still none, it looks for word starts within [t-1, t+2] seconds (matched or ambiguous); failing all that, the original time is kept (unanchored). Without a transcript, all chapters are unanchored. The receipt gives only the chosen anchor; check the ambiguous chapters against the transcript.',
      'Cleanup: drops empty titles, sorts by time, keeps one chapter per moment, clamps the first chapter to 0, and drops chapters that are not strictly increasing. Projection: asset time is converted to timeline seconds (through this asset\'s items on the timeline; when the same stretch of the asset is placed several times, the earliest wins); chapters falling in a removed part are marked offTimeline and recorded as unanchored, and land on the start of the nearest following item (or the nearest preceding one if there is none after); of chapters landing on the same frame, only the first is kept.',
      'The receipt is the same as for edits_apply, plus sourceChapters: entries (number of source chapters), matched / ambiguous / snapped / unanchored (status counts of the adopted chapters) and rows (per chapter: title, timeline seconds at, asset seconds sourceAt, status, anchor { tier, snippet }, offTimeline). dryRun: true returns only the same plan without changing the video.',
      'Rejected when the asset has no source chapters and no outline is given (NO_SOURCE_CHAPTERS), or when the asset is not on the timeline (ASSET_NOT_PLACED). Only titles and times are adopted, no summaries; to change individual chapters or add summaries, use upsertChapter of edits_apply afterwards.',
      'Before adopting, look at the plan with dryRun first: check the ambiguous and unanchored chapters against the transcript, and if needed adjust the outline and call again.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Look at the plan first', args: { video: 'demo', dryRun: true } },
      { title: 'Adopt the chapters of an asset imported from a link', args: { video: 'demo', asset: 'asset_01J…' } },
      { title: 'Use an outline pasted by the user', args: { video: 'demo', outline: '0:00 Intro\n1:42 Product demo\n5:10 Q&A' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  edits_ops: {
    title: 'List edit operations',
    description: [
      'Lists the operations edits_apply accepts, grouped by family. Each comes with its description, the JSON Schema of its arguments and an example.',
      'With op, shows only that one. The schema is the shape you write: times in seconds, sequenceId and alignment optional; field values and where they apply are still validated by the engine.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'List all operations', args: {} },
      { title: 'Show only setTransition', args: { op: 'setTransition' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'op',
  },
  edits_apply: {
    title: 'Edit video',
    description: [
      'Commits one edit to a video.',
      'operations run in order and are committed only if all succeed; if any step fails, the whole edit has no effect and the video is unchanged.',
      'Returns a receipt: the new revision, IDs of created/updated/deleted objects, the duration change, and how times were snapped to frames. Only what is in the receipt was actually changed.',
      '',
      TIME_CONVENTIONS,
      '',
      'Operations (look up each operation\'s argument JSON Schema and example with edits_ops):',
      ...EDIT_OPERATIONS.flatMap((spec) => spec.doc),
      '',
      'Items on the same track cannot overlap; locked items and tracks cannot be changed. A revision conflict (PROJECT_REVISION_CONFLICT) means the video was just changed: run videos_inspect again and then decide.',
      '',
      'dryRun: true only preflights without committing (the video is unchanged and nothing enters the history): mismatched shapes, arguments, referenced objects and files, or revisions give the same errors as a real commit; on success it returns the completed operations and their impact (committed: false). Overlaps, locks and task protections are only known at commit time.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Import media and place it at 1 second',
        args: {
          video: 'demo',
          expectedRevision: '12',
          label: 'Place demo.mp4 at 1 s',
          operations: [
            { type: 'importAsset', path: 'demo.mp4', ref: 'clip' },
            { type: 'addItem', asset: { ref: 'clip' }, at: 1 },
          ],
        },
      },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  edits_undo: {
    title: 'Undo edit',
    description: 'Undoes an edit. By default it is your own most recent edit; a transactionId can also be given. The undo is itself a new edit and returns the same kind of receipt.',
    effect: 'mutation',
    examples: [{ title: 'Undo your own most recent edit', args: { video: 'demo' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  videos_derive: {
    title: 'Derive child video',
    description: [
      'Builds a child video from a range of the parent video. It copies the parent video and cuts away everything outside the range; the cut parts can be restored in the child video.',
      'The child video is created next to the parent video (in the same folder level) as an independent video (a new videoId); the parent video is unchanged. It copies the whole timeline (assets are the same files: those collected into the parent video are collected into the child too, and linked ones still link to the original files), the transcripts and translations in full, and the parent video\'s existing cuts and chapters. start and end are seconds on the edited timeline and are first snapped to frames (start rounded down, end rounded up; when rounding would cross a pause between sentences and take in the last word of the previous sentence or the first word of the next, it rounds the other way so the boundary stays in the pause; range in the result is the range actually used). The parts outside the range are then removed with cuts: the child video\'s timeline contains only this range, speech outside the range shows as cut in the transcript panel, and restoring cuts (restoreCut) extends the item outward. Caption layers are not copied but rebuilt on the child video\'s edited timeline (not built with captions: false): one original-language caption layer per transcript, plus one layer for each translation that has a caption layer in the parent video (bilingual when the parent\'s original captions are shown). Translations imported from older projects (cuccut.translation/1) are converted to cuccut.translation/2 by the transcript sentences before copying; those that cannot be converted are not copied, and warnings include translations-skipped (documentId is the translation in the parent video).',
      'The first version supports only single-primary-asset timelines: cuts are recorded only on the asset played most on the timeline (the primary asset); other assets and text/graphic items move and shorten with the cuts, and those falling entirely inside a removed range are deleted and do not come back when the cuts are restored. When the parent video has several media assets, warnings include multiple-assets; when parts outside the range that the primary asset does not cover were not removed, range-not-exact (count is in frames); items that will be deleted and cannot be restored give items-not-restorable. Rejected when the parent video has code graphics (composition) (DERIVE_UNSUPPORTED_ITEM), when the range is empty after snapping to frames (DERIVE_RANGE_EMPTY), and when the parent video is itself the project or session folder (DERIVE_PARENT_UNPLACED).',
      'Per-shot framing (crops): each segment\'s start and end are snapped to the nearest frame and clipped to the range (segments clipped or left empty are dropped; warnings include crops-adjusted, with count the number of segments); the primary asset\'s video items are split at the frames where the framing changes, each with its own crop (entrance animations stay only on the first piece and exit animations only on the last, and likewise for embedded audio fades; looping animations and volume envelopes restart on each piece, with animation-split in warnings). Gaps under 0.5 seconds at the start and end of the range are covered by extending the first and last segments outward (not counted in crops-adjusted); the parts before and after the range use the framing of the first and last segments, so when speech at either end is restored, the picture follows that segment. framing in the result is the segments actually used; settings.crops of the derivation document records the same, and framing records their positions on the primary asset\'s source clock. crops is part of the idempotency key only when given.',
      'hook, reason and notes are written into the derivation document so the shorts result page can show the opening line, why the range was picked and the notes; like name, they are not part of the idempotency key and are not rewritten when an existing child video is reused.',
      'Idempotent: calling again with the same parent revision, range and settings returns the existing child video (reused is true) without copying again. The user is asked to confirm.',
      'Returns video (the child video\'s videoId, name and location), reused, key, the frame-snapped range, primaryAssetId, cuts (cuts outside the range: seconds on the primary asset\'s source clock), itemCount, framing (when crops is given), derivationDocumentId (the derivation document), hook, reason, notes (the selection notes recorded in the derivation document, echoed as is and omitted when absent; when reused, the original ones), speech, translations, captions (per caption layer: documentId, sourceDocumentId and cueCount; captions are segmented from the whole transcript, and cueCount counts only cues inside the kept range that are visible in the child video; null when an existing layer is reused) and warnings. Then read the child video with videos_inspect.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Derive 1:00–2:30 as a child video', args: { video: 'demo', start: 60, end: 150 } },
      { title: 'Derive a vertical short', args: { video: 'demo', start: 12.5, end: 48, name: 'Vertical clip', width: 1080, height: 1920, fit: 'cover' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  captions_create: {
    title: 'Create caption layer',
    description: [
      'Turns a transcript or translation into captions shown on screen.',
      'Creates a caption document (kind caption) and places it on a caption track: a single undoable edit.',
      'A transcript (kind speech) gives original-language captions: segmented into cues by word timing and display width, placed on an empty caption track (a new one is created if there is none); when original captions for the same asset are already shown, the new layer is placed disabled.',
      'A translation (kind translation) gives captions in that language: each translated sentence takes the timing of its source sentence through sentence-level alignment (alignment.sourceWordIds), is segmented into cues by display width, and goes on a new caption track; for translation only, the paired original captions are taken off screen (disabled, not deleted); with bilingual true, translation is primary and original secondary, the two layers share one caption style, and the original is put back on screen. Rejected when the translation has sentences whose alignment is null (TRANSLATION_UNALIGNED): write the translation again with documents_put, and the Runtime will fill in the alignment by sentence.',
      'When the same document already has a caption layer, it is not overwritten; a new layer is created anyway (existing in the result points to the existing layer; if the existing one is shown, the new layer is placed disabled). Nothing is built when the asset is not on the timeline (CAPTIONS_NOT_ON_TIMELINE) or there are no displayable cues (CAPTIONS_EMPTY).',
      'For bilingual (bilingual: true), when the timeline has no original caption layer for the transcript yet, the same call first builds the original caption layer for the transcript and then the translation layer (one edit, undone together); there is no need to call it on the transcript first.',
      'Returns: transactionId, the documentId of the new caption document, trackId, the itemIds of the caption instances, the cue count cueCount, whether it is shown (enabled) and the new revision; translations also have bilingual and the paired original caption layer pairedOriginal { documentId, itemIds, created } (created true means it was built along with this call; null when there is no paired original, explained by bilingualNote).',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Build original captions for a transcript', args: { video: 'demo', documentId: 'doc_speech_1' } },
      { title: 'Build bilingual captions for a translation', args: { video: 'demo', documentId: 'doc_translation_1', bilingual: true } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
};

/** Frame rate: common fractional NTSC rates become exact fractions. */
function rateOf(fps: number): Rate {
  const ntsc: Record<string, Rate> = {
    '23.976': { num: 24000, den: 1001 },
    '29.97': { num: 30000, den: 1001 },
    '59.94': { num: 60000, den: 1001 },
  };
  const key = String(Math.round(fps * 1000) / 1000);
  if (ntsc[key]) return ntsc[key];
  if (Number.isInteger(fps)) return { num: fps, den: 1 };
  return { num: Math.round(fps * 1000), den: 1000 };
}

export class VideoTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #videos: VideoService;
  readonly #scope: ToolScope;
  readonly #deps: VideoToolsDeps;

  constructor(deps: VideoToolsDeps) {
    this.#videos = deps.videos;
    this.#scope = deps.scope;
    // Frame grabbing and package opening are resolved only when used (catalog consistency tests construct without calling).
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'videos_list':
        return this.#list(principal);
      case 'videos_create':
        return this.#create(args as z.infer<(typeof schemas)['videos_create']>, principal);
      case 'videos_inspect':
        return this.#inspect(args as z.infer<(typeof schemas)['videos_inspect']>, principal);
      case 'documents_read':
        return this.#readDocument(args as z.infer<(typeof schemas)['documents_read']>, principal);
      case 'edits_apply':
        return this.#apply(args as z.infer<(typeof schemas)['edits_apply']>, principal);
      case 'edits_undo':
        return this.#undo(args as z.infer<(typeof schemas)['edits_undo']>, principal);
      case 'videos_derive':
        return this.#derive(args as z.infer<(typeof schemas)['videos_derive']>, principal);
      case 'captions_create':
        return this.#captions(args as z.infer<(typeof schemas)['captions_create']>, principal);
      case 'videos_frames':
        return this.#frames(args as z.infer<(typeof schemas)['videos_frames']>, principal);
      case 'videos_shots':
        return this.#shots(args as z.infer<(typeof schemas)['videos_shots']>, principal);
      case 'videos_history':
        return this.#history(args as z.infer<(typeof schemas)['videos_history']>, principal);
      case 'videos_import_package':
        return this.#importPackage(args as z.infer<(typeof schemas)['videos_import_package']>, principal);
      case 'documents_put':
        return this.#putDocument(args as z.infer<(typeof schemas)['documents_put']>, principal);
      case 'assets_import':
        return this.#importAsset(args as z.infer<(typeof schemas)['assets_import']>, principal);
      case 'assets_prune':
        return this.#pruneAssets(args as z.infer<(typeof schemas)['assets_prune']>, principal);
      case 'chapters_adopt':
        return this.#adoptChapters(args as z.infer<(typeof schemas)['chapters_adopt']>, principal);
      case 'edits_ops':
        return Promise.resolve(this.#operations(args as z.infer<(typeof schemas)['edits_ops']>, principal));
    }
  }

  // ---- Tools ----

  async #list(principal: ToolPrincipal) {
    return this.#scope.listVideos(this.#scope.authorize(principal, false));
  }

  async #create(args: z.infer<(typeof schemas)['videos_create']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    // Resolve the location first (no confirmation prompt for an external service missing project, or a project it cannot see); prepare for creation (the terminal registers the project) only after confirmation.
    await this.#scope.createRoot(access, args.project, { locate: true });
    const approval = await this.#scope.confirm(access, {
      tool: 'videos_create',
      ...confirmSummary(RcAgentTools.createVideoSummary({ name: args.name })),
    });
    const { root, scope, note } = await this.#scope.createRoot(access, args.project);
    const opened = await this.#videos.create(
      {
        name: args.name,
        ...(args.width ? { width: args.width } : {}),
        ...(args.height ? { height: args.height } : {}),
        ...(args.fps ? { fps: rateOf(args.fps) } : {}),
        commandId: newId('cmd'),
      },
      root,
      scope,
      principal,
    );
    const created: VideoCreated = {
      videoId: opened.ref.videoId,
      videoName: opened.snapshot.video.name,
      target: { ...scope, path: opened.ref.relPath },
      videoRevision: opened.snapshot.video.revision,
    };
    await this.#scope.recordCreated?.(access, created);
    return { ...digestVideo(opened.snapshot.video, opened.ref.relPath, []), ...(note ? { note } : {}), ...approvalField(approval) };
  }

  /** Derives a child video: the same implementation as `videos.derive` (`video-derive.ts`); built only after confirmation. */
  async #derive(args: z.infer<(typeof schemas)['videos_derive']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    // Open the parent video and align the range first: the confirmation card shows the child video's real name and frame-snapped range, and an invalid range need not be confirmed by the user.
    const opened = await this.#scope.open(args.video, access);
    const { video: _video, ...params } = args;
    const parent = this.#videos.mirror(opened.ref.videoId)?.video ?? opened.snapshot.video;
    let resolved: Awaited<ReturnType<typeof prepareDerive>>;
    try {
      resolved = await prepareDerive(this.#videos, parent, params);
    } catch (error) {
      throw deriveToolError(error);
    }
    const approval = await this.#scope.confirm(access, {
      tool: 'videos_derive',
      video: args.video,
      ...confirmSummary(
        RcAgentTools.deriveVideoSummary({ name: resolved.name, from: clockLabel(resolved.range.start), to: clockLabel(resolved.range.end) }),
      ),
    });
    let derived: Awaited<ReturnType<typeof deriveVideo>>;
    try {
      derived = await deriveVideo(
        { videos: this.#videos, ...(this.#deps.findDerived ? { findDerived: this.#deps.findDerived } : {}) },
        { videoId: opened.ref.videoId, ...params },
        principal,
        { ...taskOf(access), protections: (videoId) => this.#scope.protections?.(access, videoId) ?? [] },
      );
    } catch (error) {
      throw deriveToolError(error);
    }
    const { result } = derived;
    if (result.reused) await this.#scope.adoptCreatedVideo?.(access, result.video.videoId);
    else await this.#scope.recordCreated?.(access, result.video);
    return { ...result, ...approvalField(approval) };
  }

  async #inspect(args: z.infer<(typeof schemas)['videos_inspect']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, false);
    const opened = await this.#scope.open(args.video, access);
    const { entries } = await this.#videos.history(opened.ref.videoId, 10);
    // Edits may land between opening and reading the history: the digest uses the latest mirror.
    const snapshot = this.#videos.mirror(opened.ref.videoId)?.video ?? opened.snapshot.video;
    return digestVideo(snapshot, opened.ref.relPath, entries, {
      ...(args.fromSeconds !== undefined ? { from: args.fromSeconds } : {}),
      ...(args.toSeconds !== undefined ? { to: args.toSeconds } : {}),
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
    });
  }

  async #readDocument(args: z.infer<(typeof schemas)['documents_read']>, principal: ToolPrincipal) {
    // Declaring a translation (translateTo) is an intent to write: not recorded in plan mode.
    const access = this.#scope.authorize(principal, args.translateTo !== undefined);
    const opened = await this.#scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    if (!this.#videos.mirror(videoId)?.video.documents[args.documentId]) {
      throw new ToolError('DOCUMENT_NOT_FOUND', `This video has no document ${args.documentId}: use a documentId from the documents in videos_inspect`);
    }
    const content = await this.#videos.document(videoId, args.documentId, args.revision);
    const sequenceId = this.#videos.mirror(videoId)?.video.rootSequenceId ?? opened.snapshot.video.rootSequenceId;
    const basis = translationBasis(content, sequenceId);
    if (args.translateTo === undefined) return { videoId, ...content, ...basis };
    if (content.document.kind !== 'speech') {
      throw new ToolError('INVALID_ARGUMENTS', `translateTo applies only to transcripts (kind speech); document ${args.documentId} is ${content.document.kind}`);
    }
    const sentences = (basis.translationBasis?.sentences as unknown[] | undefined)?.length ?? 0;
    const jobId = this.#scope.translationStarted?.(access, {
      videoId,
      sourceDocumentId: content.document.id,
      language: args.translateTo,
      sentences,
      sourceRevision: content.revision,
    });
    return { videoId, ...content, ...basis, ...(jobId ? { translationJob: jobId } : {}) };
  }

  async #apply(args: z.infer<(typeof schemas)['edits_apply']>, principal: ToolPrincipal) {
    if (args.dryRun) return this.#preflight(args, principal);
    const access = this.#scope.authorize(principal, true);
    const approval = await this.#scope.confirm(access, {
      tool: 'edits_apply',
      video: args.video,
      ...confirmSummary(
        RcAgentTools.editsSummary({
          label: args.label,
          count: args.operations.length,
          types: [...new Set(args.operations.map((op) => op.type))].join(RcAgentTools.listSeparator().text),
        }),
      ),
    });
    const opened = await this.#scope.open(args.video, access);
    const submitted = await this.#submit(access, opened, principal, {
      expectedRevision: args.expectedRevision,
      label: args.label,
      operations: args.operations,
      commandId: args.commandId,
    });
    return {
      ...submitted.digest,
      ...(submitted.filledAlignments ? { filledAlignments: submitted.filledAlignments } : {}),
      ...(submitted.syncedCaptions ? { syncedCaptions: submitted.syncedCaptions } : {}),
      ...approvalField(approval),
    };
  }

  /**
   * Preflight of `edits_apply` (`dryRun`, agent surface design §3.3): runs every step of the commit path before the engine
   * (artifacts become import operations, operations are completed, external-service path restrictions), then checks each
   * operation's arguments against the `edits_ops` schema, whether referenced object IDs and imported files exist, and whether
   * `expectedRevision` is current. No commit, no history, no confirmation (nothing is written). `prepareBatch` from command
   * and protocol spec §7.2 (domain validation by the engine against a frozen revision) is not implemented yet: same-track
   * overlaps, locks and task protections are checked by the engine only on commit, and the result's `note` says so.
   */
  async #preflight(args: z.infer<(typeof schemas)['edits_apply']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, false);
    const opened = await this.#scope.open(args.video, access);
    const video = this.#current(opened);
    const issues: { index: number; path: string; message: string }[] = [];
    for (const [index, op] of args.operations.entries()) {
      const spec = EDIT_OPERATIONS.find((s) => s.type === op.type)!;
      const parsed = spec.schema.safeParse(op);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) issues.push({ index, path: issue.path.join('.'), message: issue.message });
      }
    }
    if (issues.length > 0) throw preflightError(issues);
    const resolved = await this.#resolveArtifacts(args.operations, access);
    const base = this.#scope.importBase(access, opened);
    const operations = normalizeOperations(resolved, video.rootSequenceId, base.cwd);
    if (base.confine) await confineImports(operations, base.confine);
    const known = knownIds(video);
    const touched = new Set<string>();
    const imports: string[] = [];
    for (const [index, op] of operations.entries()) {
      for (const { path: at, id } of referencedIds(op)) {
        if (known.has(id)) touched.add(id);
        else issues.push({ index, path: at, message: `This video has no ${id}` });
      }
      if (op.type === 'importAsset' && typeof op.path === 'string') {
        const found = await fs.stat(op.path).then(
          () => true,
          () => false,
        );
        if (found) imports.push(op.path);
        else issues.push({ index, path: 'path', message: `Cannot read the file to import: ${op.path}` });
      }
    }
    if (issues.length > 0) throw preflightError(issues);
    if (args.expectedRevision !== video.revision) {
      throw new ToolError('PROJECT_REVISION_CONFLICT', `The video is now at revision ${video.revision}, not ${args.expectedRevision}`, {
        expectedRevision: args.expectedRevision,
        currentRevision: video.revision,
        next: 'Read it again with videos_inspect and decide from the new state whether and how to edit',
      });
    }
    const counts: Record<string, number> = {};
    for (const op of operations) counts[op.type as string] = (counts[op.type as string] ?? 0) + 1;
    return {
      dryRun: true,
      committed: false,
      videoId: opened.ref.videoId,
      revision: video.revision,
      label: args.label,
      operations,
      impact: { operations: counts, touched: [...touched].sort(), imports },
      note: 'Preflight only; the video was not changed. Same-track overlaps, locks and task protections are checked by the engine only on commit; call again without dryRun and with the same expectedRevision to commit.',
    };
  }

  /**
   * Commits one edit: the same path as `edits_apply` (artifacts become import operations, seconds become the engine's shape,
   * external services' asset paths are confined to the project, translations get sentence-level alignment filled in);
   * `documents_put` and `assets_import` also come through here after compiling their operations.
   */
  async #submit(
    access: ToolAccess,
    opened: VideoOpenResult,
    principal: ToolPrincipal,
    edit: { expectedRevision: string; label: string; operations: Record<string, unknown>[]; commandId: string | undefined },
  ) {
    const resolved = await this.#resolveArtifacts(edit.operations, access);
    const base = this.#scope.importBase(access, opened);
    const operations = normalizeOperations(resolved, opened.snapshot.video.rootSequenceId, base.cwd);
    if (base.confine) await confineImports(operations, base.confine);
    // Translations written by agents: units whose alignment is null or missing get sentence-level alignment filled in by sentence (video format spec §5.3).
    const documents = (this.#videos.mirror(opened.ref.videoId)?.video ?? opened.snapshot.video).documents;
    const readBody = async (documentId: Id, revision?: string) => (await this.#videos.document(opened.ref.videoId, documentId, revision)).body;
    const filledAlignments = await fillTranslationAlignments(operations, documents, readBody);
    // An existing translation was changed: caption layers generated from it get the cues of the changed sentences replaced in the same edit.
    const syncedCaptions = await syncTranslationCaptions(operations, documents, readBody);
    const result = await this.#videos.apply(
      {
        videoId: opened.ref.videoId,
        commandId: this.#scope.commandId(access, edit.commandId),
        expectedRevision: edit.expectedRevision,
        operations: operations as never,
        label: edit.label,
      },
      principal,
      { ...taskOf(access), protections: this.#scope.protections?.(access, opened.ref.videoId) ?? [] },
    );
    // A translation was written: the progress record of the agent's own translation (translateTo of `documents_read`) completes with it.
    for (const op of operations) {
      const source = (op.sourceDocument as { documentId?: unknown } | undefined)?.documentId;
      if (op.type !== 'putDocument' || op.kind !== 'translation' || typeof source !== 'string' || typeof op.language !== 'string') continue;
      const documentId =
        typeof op.documentId === 'string' ? op.documentId : typeof op.ref === 'string' ? (result.receipt.refs?.[op.ref] ?? null) : null;
      this.#scope.translationWritten?.(access, { videoId: opened.ref.videoId, sourceDocumentId: source, language: op.language, documentId });
    }
    return { result, digest: this.#receipt(opened, result, access), filledAlignments, syncedCaptions };
  }

  /** The current video: the latest state in the mirror, or the snapshot taken at open when there is no mirror. */
  #current(opened: VideoOpenResult): VideoSnapshot {
    return this.#videos.mirror(opened.ref.videoId)?.video ?? opened.snapshot.video;
  }

  /**
   * Frame grabbing (agent surface design §4.3): timeline moment -> topmost video item -> asset time -> a frame of the asset
   * (`video-frames.ts`). Reads the video without changing it, but writes files: into `.cuccut-out/frames/<videoId>/` under the
   * output directory given by the scope (the project's `exports/` for external services).
   */
  async #frames(args: z.infer<(typeof schemas)['videos_frames']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, false);
    const times = frameTimes(args);
    const opened = await this.#scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    const video = this.#current(opened);
    const dir = await framesDirectory(this.#scope.saveRoot(access, opened), videoId, this.#scope.importBase(access, opened).confine);
    const format = args.format ?? 'png';
    const taken = [];
    for (const at of times) {
      const source = frameSourceAt(video, Number(at));
      if (!source) {
        taken.push({ at, file: null });
        continue;
      }
      const written = await writeFrame(
        this.#deps.analysis,
        source,
        () => this.#videos.assetFile(videoId, source.assetId, source.revision),
        { dir, at, format, maxWidth: args.maxWidth },
      );
      taken.push({ at, ...written, item: source.item.id, asset: source.assetId });
    }
    const { detector, frames } = await withFaces(this.#deps.faces, taken);
    return { videoId, revision: video.revision, frames, detector, composited: false, note: FRAMES_NOTE };
  }

  /** Shot changes (`video-shots.ts`): read-only, no video changes, no files written; the same implementation as `videos.shots`. */
  async #shots(args: z.infer<(typeof schemas)['videos_shots']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, false);
    const [start, end] = args.range ? (args.range.split(':').map(Number) as [number, number]) : [undefined, undefined];
    const opened = await this.#scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    const video = this.#current(opened);
    try {
      const result = await detectShots(
        { analysis: this.#deps.analysis, assetFile: (assetId, revision) => this.#videos.assetFile(videoId, assetId, revision) },
        video,
        { start, end, threshold: args.threshold, minShot: args.minShot },
      );
      return { videoId, ...result, note: SHOTS_NOTE };
    } catch (error) {
      throw shotsToolError(error);
    }
  }

  async #history(args: z.infer<(typeof schemas)['videos_history']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, false);
    const opened = await this.#scope.open(args.video, access);
    const { entries } = await this.#videos.history(opened.ref.videoId, args.limit ?? 20);
    const video = this.#current(opened);
    return {
      videoId: opened.ref.videoId,
      revision: video.revision,
      entries: entries.map((entry) => ({
        transactionId: entry.transactionId,
        label: localizeText(entry.label, entry.labelRef),
        by: entry.actor.kind,
        revision: entry.videoRevision,
        committedAt: entry.committedAt,
        undone: Boolean(entry.undoneBy),
        ...(entry.undoOf ? { undoOf: entry.undoOf } : {}),
        undoAvailable: entry.undoAvailable,
      })),
      checkpoints: Object.values(video.checkpoints)
        .sort((a, b) => Number(b.videoRevision) - Number(a.videoRevision))
        .map((c) => ({ id: c.id, name: c.name, revision: c.videoRevision, createdAt: c.createdAt, ...(c.note ? { note: c.note } : {}) })),
    };
  }

  /** Opens a portable package (the same entry point as `videos.importPackage`, video format spec §8): location as for `videos_create`; when name is given, the folder uses it and the video is renamed. */
  async #importPackage(args: z.infer<(typeof schemas)['videos_import_package']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    await this.#scope.createRoot(access, args.project, { locate: true });
    const approval = await this.#scope.confirm(access, {
      tool: 'videos_import_package',
      ...confirmSummary(RcAgentTools.importPackageSummary({ file: path.basename(args.file) })),
    });
    const { root, scope, note } = await this.#scope.createRoot(access, args.project);
    const file = path.resolve(this.#scope.saveRoot(access), args.file);
    let opened = await this.#deps.packages.import({ ...scope, path: file }, root, scope, principal, {
      ...(args.name ? { name: args.name } : {}),
    });
    if (args.name && opened.snapshot.video.name !== args.name.trim()) {
      await this.#videos.apply(
        {
          videoId: opened.ref.videoId,
          commandId: newId('cmd'),
          expectedRevision: opened.snapshot.video.revision,
          operations: [{ type: 'renameVideo', name: args.name.trim() }] as never,
          label: RcAgentTools.renameVideoLabel().text,
        },
        principal,
        { ...taskOf(access) },
      );
      opened = { ...opened, snapshot: { ...opened.snapshot, video: this.#current(opened) } };
    }
    const created: VideoCreated = {
      videoId: opened.ref.videoId,
      videoName: opened.snapshot.video.name,
      target: { ...scope, path: opened.ref.relPath },
      videoRevision: opened.snapshot.video.revision,
    };
    await this.#scope.recordCreated?.(access, created);
    return { ...digestVideo(opened.snapshot.video, opened.ref.relPath, []), ...(note ? { note } : {}), ...approvalField(approval) };
  }

  /** `documents_put`: compiles to one `putDocument` (keeping the existing kind when replacing) and goes down the same path as `edits_apply`. */
  async #putDocument(args: z.infer<(typeof schemas)['documents_put']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const approval = await this.#scope.confirm(access, {
      tool: 'documents_put',
      video: args.video,
      ...confirmSummary(
        args.document
          ? RcAgentTools.putDocumentSummary({ documentId: args.document })
          : RcAgentTools.newDocumentSummary({ kind: args.kind ?? '?' }),
      ),
    });
    const opened = await this.#scope.open(args.video, access);
    const video = this.#current(opened);
    let kind: string;
    let label: string;
    if (args.document !== undefined) {
      const record = video.documents[args.document];
      if (!record) {
        throw new ToolError(
          'DOCUMENT_NOT_FOUND',
          `This video has no document ${args.document}: use a documentId from the documents in videos_inspect; omit document to create one`,
        );
      }
      if (args.kind !== undefined && args.kind !== record.kind) {
        throw new ToolError('INVALID_ARGUMENTS', `Document ${args.document} is ${record.kind} and cannot become ${args.kind}: create a new document for a different kind`);
      }
      kind = record.kind;
      label = args.label ?? RcAgentTools.updateDocumentLabel({ name: args.name ?? record.name }).text;
    } else {
      if (args.kind === undefined)
        throw new ToolError('INVALID_ARGUMENTS', 'Creating a document requires kind (e.g. translation); to replace an existing document, give document');
      if (args.kind === 'translation' && (args.language === undefined || args.sourceDocument === undefined)) {
        throw new ToolError('INVALID_ARGUMENTS', 'Creating a translation requires language (the target language) and sourceDocument (the documentId of the transcript it translates)');
      }
      kind = args.kind;
      label =
        args.label ??
        RcAgentTools.newDocumentLabel({
          name: args.name ?? (kind === 'translation' ? RcAgentTools.translationDocumentName({ language: String(args.language) }).text : kind),
        }).text;
    }
    if (args.sourceDocument !== undefined && !video.documents[args.sourceDocument]) {
      throw new ToolError('DOCUMENT_NOT_FOUND', `This video has no document ${args.sourceDocument} (sourceDocument)`);
    }
    const operation: Record<string, unknown> = {
      type: 'putDocument',
      ...(args.document !== undefined ? { documentId: args.document } : {}),
      kind,
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.language !== undefined ? { language: args.language } : {}),
      ...(args.sourceAsset !== undefined ? { sourceAsset: { assetId: args.sourceAsset } } : {}),
      ...(args.sourceDocument !== undefined ? { sourceDocument: { documentId: args.sourceDocument } } : {}),
      body: args.body,
      ref: PUT_DOCUMENT_REF,
    };
    const submitted = await this.#submit(access, opened, principal, {
      expectedRevision: args.revision ?? video.revision,
      label,
      operations: [operation],
      commandId: args.commandId,
    });
    return {
      ...submitted.digest,
      documentId: submitted.result.receipt.refs?.[PUT_DOCUMENT_REF] ?? args.document ?? null,
      ...(submitted.filledAlignments ? { filledAlignments: submitted.filledAlignments } : {}),
      ...(submitted.syncedCaptions ? { syncedCaptions: submitted.syncedCaptions } : {}),
      ...approvalField(approval),
    };
  }

  /** `assets_import`: compiles to `importAsset` (plus `addItem` when place is given), in one transaction. */
  async #importAsset(args: z.infer<(typeof schemas)['assets_import']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    if ((args.path === undefined) === (args.artifactId === undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', 'Give exactly one of path and artifactId');
    }
    if (args.artifactId !== undefined && args.storage === 'linked') {
      throw new ToolError('INVALID_ARGUMENTS', 'Artifacts are always collected into the video (managed) and cannot be linked');
    }
    const what = args.path !== undefined ? path.basename(args.path) : args.artifactId!;
    const approval = await this.#scope.confirm(access, {
      tool: 'assets_import',
      video: args.video,
      ...confirmSummary(RcAgentTools.importAssetSummary({ name: what, place: Boolean(args.place) })),
    });
    const opened = await this.#scope.open(args.video, access);
    const video = this.#current(opened);
    const operations: Record<string, unknown>[] = [
      {
        type: 'importAsset',
        ...(args.path !== undefined ? { path: args.path } : { artifactId: args.artifactId }),
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.storage !== undefined && args.path !== undefined ? { storage: args.storage } : {}),
        ref: IMPORT_ASSET_REF,
      },
    ];
    if (args.place) {
      const track = args.place.track;
      const at = args.place.at;
      operations.push({
        type: 'addItem',
        asset: { ref: IMPORT_ASSET_REF },
        ...(track !== undefined && track !== 'main' ? { trackId: track } : {}),
        ...(at !== undefined && at !== 'end' ? { at: Number(at) } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
      });
    }
    const submitted = await this.#submit(access, opened, principal, {
      expectedRevision: args.revision ?? video.revision,
      label: RcAgentTools.importAssetLabel({ name: what, place: Boolean(args.place) }).text,
      operations,
      commandId: args.commandId,
    });
    const { receipt } = submitted.result;
    const after = this.#current(opened);
    const created = new Set(receipt.createdIds);
    const item = args.place ? (after.sequences[after.rootSequenceId]?.items.find((it) => created.has(it.id)) ?? null) : null;
    return {
      ...submitted.digest,
      assetId: receipt.refs?.[IMPORT_ASSET_REF] ?? null,
      itemId: item?.id ?? null,
      ...approvalField(approval),
    };
  }

  /**
   * `assets_prune`: unreferenced assets are listed by the engine (`videos.unusedAssets`, the same reference rules as
   * `removeAssets`). By default it only lists, without confirmation; with `apply` it compiles to one `removeAssets`, a single
   * undoable transaction. Paired code bundles and prerender proxies are brought along here, so the list matches what the
   * engine removes.
   */
  async #pruneAssets(args: z.infer<(typeof schemas)['assets_prune']>, principal: ToolPrincipal) {
    const apply = args.apply === true;
    const access = this.#scope.authorize(principal, apply);
    const opened = await this.#scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    const video = this.#current(opened);
    const { unused } = await this.#videos.unusedAssets(videoId);
    const byId = new Map(unused.map((asset) => [asset.assetId, asset]));
    const requested = args.assetIds ? [...new Set(args.assetIds)] : [...byId.keys()];
    const missing = requested.filter((id) => !video.assets[id]);
    const inUse = requested.filter((id) => video.assets[id] && !byId.has(id));
    const selected = new Set(requested.filter((id) => byId.has(id)));
    for (const id of [...selected]) for (const partner of byId.get(id)!.pairedWith ?? []) selected.add(partner);
    const assets = unused.filter((asset) => selected.has(asset.assetId));
    const managedBytes = assets.reduce((sum, asset) => sum + (asset.storage === 'managed' ? asset.byteLength : 0), 0);
    const listing = { videoId, revision: video.revision, assets, managedBytes };
    if (!apply) {
      return {
        ...listing,
        ...(missing.length ? { notFound: missing } : {}),
        ...(inUse.length ? { inUse } : {}),
        next: assets.length
          ? 'Nothing references these assets. Once you are sure they are not needed, remove them with apply: true (give assetIds to remove only some of them); ask the user first about media they imported but have not yet placed on the timeline.'
          : 'There are no assets to clean up.',
      };
    }
    if (missing.length) {
      throw new ToolError('ENTITY_NOT_FOUND', `The video has no such assets: ${missing.join(', ')}`, { assetIds: missing });
    }
    if (inUse.length) {
      throw new ToolError('INVALID_OPERATION', `These assets are still referenced and cannot be removed: ${inUse.join(', ')}`, {
        details: { rule: 'asset-in-use', assetIds: inUse },
        next: 'Call without apply first to see what can be removed; to remove assets still in use, first delete or replace the items and chapter thumbnails using them with edits_apply',
      });
    }
    if (!assets.length) return { ...listing, removed: [], next: 'There are no assets to clean up; the video was not changed.' };
    const shown = assets.slice(0, 5).map((asset) => asset.name);
    const approval = await this.#scope.confirm(access, {
      tool: 'assets_prune',
      video: args.video,
      ...confirmSummary(
        RcAgentTools.pruneAssetsSummary({
          count: assets.length,
          names: shown.join(RcAgentTools.listSeparator().text) + (assets.length > shown.length ? '…' : ''),
        }),
      ),
    });
    const submitted = await this.#submit(access, opened, principal, {
      expectedRevision: args.revision ?? video.revision,
      label: RcAgentTools.pruneAssetsLabel({ count: assets.length }).text,
      operations: [{ type: 'removeAssets', assetIds: [...selected].sort() }],
      commandId: args.commandId,
    });
    return {
      ...submitted.digest,
      removed: assets,
      managedBytes,
      ...approvalField(approval),
      note: 'Only the asset records were removed; this can be undone with edits_undo. Managed bytes are reclaimed later by cleanup according to references; the original files of linked assets were not touched.',
    };
  }

  /**
   * `chapters_adopt` (architecture design §7.9): the chapters that come with an asset source (or an explicit outline) are
   * parsed and snapped to the transcript by the captions and translation core (`bc_source_chapters`, in source time); here
   * they are projected onto the timeline (`source-chapters.ts`) and compiled to one `setChapters`, a single undoable
   * transaction. With `dryRun` only the plan is returned.
   */
  async #adoptChapters(args: z.infer<(typeof schemas)['chapters_adopt']>, principal: ToolPrincipal) {
    const dryRun = args.dryRun === true;
    const access = this.#scope.authorize(principal, !dryRun);
    const opened = await this.#scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    const video = this.#current(opened);
    const sequence = video.sequences[video.rootSequenceId]!;
    const assetId = adoptedAsset(video, sequence, args);
    const asset = video.assets[assetId]!;
    const revision = asset.revisions[asset.currentRevision];
    const speechDocument = adoptedSpeech(video, assetId, args.document);
    const speech = speechDocument ? (await this.#videos.document(videoId, speechDocument.id)).body : undefined;
    const durationSeconds = revision?.duration ? mediaTimeToSeconds(revision.duration) : lastWordEnd(speech);
    let plan: SourceChaptersResult;
    try {
      plan = sourceChapters({
        ...(speech !== undefined ? { speech } : {}),
        ...(revision?.provenance.source !== undefined ? { source: revision.provenance.source } : {}),
        ...(args.outline !== undefined ? { outline: args.outline } : {}),
        durationSeconds,
      });
    } catch (error) {
      if (error instanceof EditorWasmUnavailable)
        throw new ToolError('TOOL_UNAVAILABLE', 'The captions and translation core (editor-wasm) is not built, so source chapters cannot be parsed');
      if (error instanceof EditorWasmError) {
        throw new ToolError(
          error.code === 'INVALID_SPEECH' ? 'INVALID_OPERATION' : 'INVALID_ARGUMENTS',
          `Cannot understand the source chapters: ${error.message}`,
          {
            details: { rule: error.code },
          },
        );
      }
      throw error;
    }
    if (!plan.rows.length) {
      throw new ToolError(
        'NO_SOURCE_CHAPTERS',
        args.outline !== undefined
          ? 'The given outline has no usable chapters (each needs a time and a title; raw text needs at least two timestamped lines)'
          : `The source of asset ${assetId} has no chapters, and its description has no timestamped outline`,
        {
          assetId,
          next: 'Check assets[].source in videos_inspect; if the user has an outline, give it as outline; otherwise split chapters yourself from the transcript and use setChapters of edits_apply',
        },
      );
    }
    const segments = assetSegments(sequence, assetId);
    if (!segments.length) {
      throw new ToolError('ASSET_NOT_PLACED', `Asset ${assetId} is not on the timeline, so the chapters have nowhere to land`, {
        assetId,
        next: 'First place the asset on the timeline with assets_import or addItem of edits_apply',
      });
    }
    const { kept, dropped } = projectChapters(
      plan.rows.map((row, index) => ({
        title: row.title,
        start: row.start,
        row: { status: row.status, anchor: rowAnchor(plan, index, row) },
      })),
      segments,
      sequence.fps,
    );
    const rows = kept.map(adoptedRow);
    const counts = { matched: 0, ambiguous: 0, snapped: 0, unanchored: 0 };
    for (const row of rows) counts[row.status] += 1;
    const report = {
      entries: plan.summary.entries,
      ...counts,
      rows,
      ...(dropped.length ? { dropped: dropped.map(adoptedRow) } : {}),
    };
    const chapters = kept.map((chapter) => ({ at: chapter.at, title: chapter.title }));
    const existing = sequence.markers.filter((marker) => marker.kind === 'chapter').length;
    const notes = [
      ...(speechDocument
        ? []
        : ['The asset has no transcript, so the chapters were not snapped and all keep their original source times (unanchored). Transcribe first, then adopt, to align with where topics start.']),
      ...(dropped.length
        ? ['Some chapters landed on the same frame as the previous chapter after projection onto the timeline (usually the same start right after a cut) and were not adopted; see dropped.']
        : []),
      ...(existing ? [`This replaces all ${existing} existing chapters of the video.`] : []),
    ];
    if (dryRun) {
      return {
        videoId,
        revision: video.revision,
        committed: false,
        assetId,
        ...(speechDocument ? { documentId: speechDocument.id } : {}),
        chapters: chapters.map((chapter) => ({ ...chapter, at: roundSeconds(chapter.at) })),
        sourceChapters: report,
        ...(notes.length ? { notes } : {}),
        next: 'After checking the ambiguous and unanchored chapters, call again without dryRun; to change times or titles, give them as outline.',
      };
    }
    const approval = await this.#scope.confirm(access, {
      tool: 'chapters_adopt',
      video: args.video,
      ...confirmSummary(RcAgentTools.adoptChaptersSummary({ count: chapters.length, existing, asset: asset.name })),
    });
    const submitted = await this.#submit(access, opened, principal, {
      expectedRevision: args.revision ?? video.revision,
      label: args.label ?? RcAgentTools.adoptChaptersLabel().text,
      operations: [{ type: 'setChapters', chapters }],
      commandId: undefined,
    });
    return {
      ...submitted.digest,
      assetId,
      ...(speechDocument ? { documentId: speechDocument.id } : {}),
      sourceChapters: report,
      ...(notes.length ? { notes } : {}),
      ...approvalField(approval),
    };
  }

  /** `edits_ops`: operation families with each operation's description, JSON Schema and example (`edit-ops.ts`). Reads no video; only checks that the caller may use the catalog. */
  #operations(args: z.infer<(typeof schemas)['edits_ops']>, principal: ToolPrincipal) {
    this.#scope.authorize(principal, false);
    if (args.op !== undefined) {
      const spec = EDIT_OPERATIONS.find((s) => s.type === args.op)!;
      return { conventions: TIME_CONVENTIONS, operation: describeOperation(spec) };
    }
    return editOperationsCatalog();
  }

  /**
   * Builds a caption layer for a transcript or translation (architecture design §7.9, "the operation for agents to build
   * caption layers"): the same algorithm (`planCaptionLayer`) as the `captions` step of the fixed pipeline, with translations
   * segmented by sentence-level alignment (no Worker). It is computed against the mirror's revision before committing; if the
   * video changes in the meantime, it reads and computes again.
   */
  async #captions(args: z.infer<(typeof schemas)['captions_create']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const approval = await this.#scope.confirm(access, {
      tool: 'captions_create',
      video: args.video,
      ...confirmSummary(RcAgentTools.captionsSummary({ documentId: args.documentId, bilingual: args.bilingual ?? false })),
    });
    const opened = await this.#scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    const layoutProfileId = args.layoutProfileId ?? 'default';
    const reader = {
      document: async (v: Id, d: Id, revision?: string) => {
        const content = await this.#videos.document(v, d, revision);
        return { revision: content.revision, body: content.body };
      },
    };
    for (let attempt = 1; ; attempt++) {
      const video = this.#videos.mirror(videoId)?.video ?? opened.snapshot.video;
      const record = video.documents[args.documentId];
      if (!record) {
        throw new ToolError('DOCUMENT_NOT_FOUND', `This video has no document ${args.documentId}: use a documentId from the documents in videos_inspect`);
      }
      if (record.kind !== 'speech' && record.kind !== 'translation') {
        throw new ToolError(
          'INVALID_ARGUMENTS',
          `Document ${args.documentId} is ${record.kind}: caption layers can only be built for transcripts (speech) or translations (translation)`,
        );
      }
      if (record.kind === 'speech' && args.bilingual) {
        throw new ToolError('INVALID_ARGUMENTS', 'bilingual applies only to translations: a transcript builds original-language captions; for bilingual captions, give the documentId of a translation');
      }
      const sequence = video.sequences[video.rootSequenceId]!;
      const source: CaptionSource =
        record.kind === 'speech'
          ? { kind: 'speech', documentId: record.id }
          : { kind: 'translation', documentId: record.id, bilingual: args.bilingual ?? false, cues: 'sentence-alignment' };
      const plan = await planCaptionLayer(reader, { videoId, sequence, documents: video.documents, source, pairOriginal: true }).catch(
        (error: unknown) => {
          throw captionError(error);
        },
      );
      if ('reason' in plan) {
        throw plan.reason === 'empty'
          ? new ToolError('CAPTIONS_EMPTY', 'The document has no displayable cues: no caption layer was created')
          : new ToolError('CAPTIONS_NOT_ON_TIMELINE', 'No item on the timeline uses the asset of this document, so the captions cannot be projected onto the picture: no caption layer was created', {
              next: 'First place the asset on the timeline with assets_import (place) or addItem of edits_apply, then build the caption layer',
            });
      }
      let result: EditResult;
      try {
        result = await this.#videos.apply(
          {
            videoId,
            commandId: this.#scope.commandId(access, undefined),
            expectedRevision: video.revision,
            operations: plan.operations as never,
            // Written to the video's history and undo: in the current language.
            label: RcAgentTools.captionsLabel().text,
          },
          principal,
          { ...taskOf(access), protections: this.#scope.protections?.(access, videoId) ?? [] },
        );
      } catch (error) {
        // The video changed between read and write: recompute from the new state and commit again with a new command.
        if (revisionConflict(error) && attempt < CAPTION_ATTEMPTS) continue;
        throw error;
      }
      const digest = this.#receipt(opened, result, access);
      const refs = result.receipt.refs ?? {};
      const documentId = refs[CAPTION_DOCUMENT_REF] ?? null;
      const originalId = plan.original ? (refs[plan.original.documentRef] ?? null) : null;
      const created = captionItemsCreated(
        result.receipt.createdIds,
        refs,
        this.#videos.mirror(videoId)?.video ?? null,
        documentId,
        originalId,
      );
      const translation = source.kind === 'translation';
      // The paired original caption layer: the existing one, or one built along with this edit (created); null when neither, with a note that only the translation is shown.
      const pairedOriginal = plan.paired
        ? { ...plan.paired, created: false }
        : originalId
          ? { documentId: originalId, itemIds: created.original, created: true }
          : null;
      return {
        transactionId: digest.transactionId,
        revision: digest.revision,
        documentId,
        trackId: insertedTrack(plan.operations, refs),
        itemIds: created.items,
        cueCount: plan.cueCount,
        enabled: plan.enabled,
        ...(translation ? { bilingual: source.bilingual } : {}),
        layoutProfileId,
        existing: plan.existing,
        ...(plan.existing
          ? {
              note: plan.enabled
                ? 'This document already has a caption layer (existing); it was not overwritten and a new layer was created alongside it; delete the one you do not want with deleteItems of edits_apply'
                : 'This document already has a caption layer (existing) that is shown; it was not overwritten, and the new layer was placed next to it disabled; to switch, toggle enabled with updateItem of edits_apply',
            }
          : {}),
        ...(translation
          ? {
              pairedOriginal,
              ...(source.bilingual && !pairedOriginal
                ? {
                    bilingualNote: plan.enabled
                      ? 'The timeline has no original caption layer for this transcript, and none could be built along with this call: only the translation is shown. For bilingual captions, call captions_create on the transcript first, then undo this edit and call again on the translation'
                      : 'This translation already has a layer that is shown, so the new layer was placed disabled and no original caption layer was built along with it: for bilingual captions, call captions_create on the transcript first',
                  }
                : {}),
            }
          : {}),
        undoAvailable: digest.undoAvailable,
        ...approvalField(approval),
      };
    }
  }

  async #undo(args: z.infer<(typeof schemas)['edits_undo']>, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    const approval = await this.#scope.confirm(access, {
      tool: 'edits_undo',
      video: args.video,
      ...confirmSummary(
        args.transactionId ? RcAgentTools.undoSummary({ transactionId: args.transactionId }) : RcAgentTools.undoLatestSummary(),
      ),
    });
    const opened = await this.#scope.open(args.video, access);
    const result = await this.#videos.undo(
      {
        videoId: opened.ref.videoId,
        commandId: newId('cmd'),
        target: args.transactionId ? { transaction: args.transactionId } : 'undo',
        ...(args.expectedRevision ? { expectedRevision: args.expectedRevision } : {}),
      },
      principal,
      { protections: this.#scope.protections?.(access, opened.ref.videoId) ?? [] },
    );
    return { ...this.#receipt(opened, result, access), ...approvalField(approval) };
  }

  /**
   * The other source for `importAsset`: an artifact (`artifactId`). Only outputs generated by jobs visible to this call are
   * accepted; it becomes the same operation as importing from the artifact store, with the bytes collected into the video
   * (`managed`) and the provenance exactly as when a job running with the video imports it (job, provider, model, parameter
   * summary). Nothing is regenerated. Media downloaded by a link import (download only) also works: the file is in the
   * download folder (content verified), and the provenance records `origin: 'link-import'`, the same as when the pipeline
   * imports it itself.
   */
  async #resolveArtifacts(operations: Record<string, unknown>[], access: ToolAccess): Promise<Record<string, unknown>[]> {
    const resolved: Record<string, unknown>[] = [];
    for (const [index, op] of operations.entries()) {
      if (op.type !== 'importAsset' || op.artifactId === undefined) {
        resolved.push(op);
        continue;
      }
      const { artifactId, name, ref, storage, ...rest } = op as Record<string, unknown>;
      delete rest.type;
      if (typeof artifactId !== 'string') throw new OperationShapeError(index, 'artifactId must be a string (from the outputs of jobs_inspect)');
      if (rest.path !== undefined) throw new OperationShapeError(index, 'Give only one of path and artifactId');
      const extra = Object.keys(rest);
      if (extra.length > 0) throw new OperationShapeError(index, `Importing from an artifact accepts only artifactId, name and ref; unknown: ${extra.join(', ')}`);
      if (storage !== undefined && storage !== 'managed') throw new OperationShapeError(index, 'Artifacts are always collected into the video (managed) and cannot be linked');
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) throw new OperationShapeError(index, 'name must be a non-empty string');
      if (ref !== undefined && typeof ref !== 'string') throw new OperationShapeError(index, 'ref must be a string');
      const { record, output, file } = await this.#scope.visibleArtifact(artifactId, access);
      const outputs = record.result?.outputs ?? [];
      const downloaded = linkImportAssetOperation(
        record,
        { artifactId, file },
        {
          ...(typeof name === 'string' ? { name: name.trim() } : {}),
          ...(typeof ref === 'string' ? { ref } : {}),
        },
      );
      if (downloaded) {
        resolved.push(downloaded);
        continue;
      }
      if (!output || !record.generation) {
        throw new ToolError('ARTIFACT_NOT_MEDIA', 'This artifact is a transcription result, not media, and cannot be imported as an asset');
      }
      const imported = generatedImportOperation(
        record,
        { artifactId, file, index: outputs.indexOf(output), total: outputs.length },
        { ...(ref !== undefined ? { ref } : {}) },
      );
      resolved.push(name !== undefined ? { ...imported, name: (name as string).trim() } : imported);
    }
    return resolved;
  }

  /** The receipt digest goes to the caller; in a session, the same receipt also posts a change card (product design §6.5). */
  #receipt(opened: VideoOpenResult, result: EditResult, access: ToolAccess) {
    const video = opened.snapshot.video;
    const fps = video.sequences[video.rootSequenceId]!.fps;
    const digest = digestReceipt(result.receipt, fps, result.replayed);
    const { ref } = opened;
    const change: VideoChange = {
      videoId: ref.videoId,
      videoName: this.#videos.ref(ref.videoId)?.name ?? ref.name,
      // For videos without a recorded session, the scope fills in the caller's session.
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
    this.#scope.recordChange(access, change);
    return digest;
  }
}

/** The refs `documents_put` and `assets_import` use in their compiled operations; the new objects' IDs are taken from `refs` in the receipt. */
const PUT_DOCUMENT_REF = 'document';
const IMPORT_ASSET_REF = 'asset';

/** How many times `captions_create` recomputes and resubmits on a revision conflict (the same as the `captions` step of the fixed pipeline). */
const CAPTION_ATTEMPTS = 3;

/** Errors thrown by the caption layer algorithm, handed to the agent: with error code and details; unaligned translations get a next step. */
function captionError(error: unknown): unknown {
  if (!(error instanceof PipelineStepError)) return error;
  return new ToolError(error.code, error.message, {
    ...(error.details ? { details: error.details } : {}),
    ...(error.code === 'TRANSLATION_UNALIGNED'
      ? {
          next: 'Read the translation with documents_read and write it back unchanged with documents_put (alignment may be sentence-level alignment or null; the Runtime fills it in by sentence), then build the caption layer',
        }
      : {}),
  });
}

function revisionConflict(error: unknown): boolean {
  if (!(error instanceof RpcError)) return false;
  const code = (error.details as { code?: unknown } | null | undefined)?.code;
  return error.code === 'conflict' || code === 'PROJECT_REVISION_CONFLICT';
}

/** The track the caption layer being built (the instance whose document ref is `caption`) goes on: the given track ID if there is one, otherwise the new track's ID taken from the receipt by `ref`. */
function insertedTrack(operations: EditOperation[], refs: Record<string, Id>): Id | null {
  const inserted = operations.flatMap((op) =>
    op.type === 'insertItems' ? (op.items as Array<{ trackId?: Id; trackRef?: string; documentRef?: string }>) : [],
  );
  const item = inserted.find((it) => it.documentRef === CAPTION_DOCUMENT_REF);
  if (item?.trackId) return item.trackId;
  return item?.trackRef ? (refs[item.trackRef] ?? null) : null;
}

/**
 * Splits the caption instances created by this edit by caption document: `items` belong to the caption layer being built,
 * `original` to the original caption layer built along with it. Split by the document each instance references in the
 * post-commit mirror (the engine emits events before the receipt, so the mirror is already post-commit); without a mirror,
 * falls back to "every new ID that is not a ref is a caption instance".
 */
function captionItemsCreated(
  createdIds: readonly Id[],
  refs: Record<string, Id>,
  video: VideoSnapshot | null,
  documentId: Id | null,
  originalId: Id | null,
): { items: Id[]; original: Id[] } {
  const made = new Set(Object.values(refs));
  const fresh = createdIds.filter((id) => !made.has(id));
  const captions = video?.sequences[video.rootSequenceId]?.items.filter((it) => it.type === 'caption') ?? null;
  if (!captions || (originalId && !captions.some((it) => it.documentId === originalId))) return { items: fresh, original: [] };
  const byDocument = new Map(captions.map((it) => [it.id, it.documentId]));
  return {
    items: fresh.filter((id) => byDocument.get(id) === documentId),
    original: originalId ? fresh.filter((id) => byDocument.get(id) === originalId) : [],
  };
}

const DERIVE_TOOL_MESSAGES: Record<string, string> = {
  DERIVE_RANGE_EMPTY: 'The range is empty after snapping to frames: start and end are seconds on the edited timeline; check the duration with videos_inspect first',
  DERIVE_UNSUPPORTED_ITEM: 'The parent video has items that cannot be copied to a child video (code graphics or linked media that cannot be copied; details say which); the first version does not support deriving these',
  DERIVE_PARENT_UNPLACED: 'This video is itself the project or session folder (or was not opened from a project or session), so there is no place next to it for a child video',
};

/** Turns a `videos.derive` rejection (an RPC error whose `details.code` is `DERIVE_*`) into a tool error. */
function deriveToolError(error: unknown): unknown {
  if (!(error instanceof RpcError)) return error;
  const details = (error.details ?? {}) as Record<string, unknown>;
  const code = typeof details.code === 'string' ? details.code : '';
  const message = DERIVE_TOOL_MESSAGES[code];
  if (!message) return error;
  const { code: _code, ...extra } = details;
  return new ToolError(code, message, extra);
}

/** Session calls carry the in-progress task ID (recorded as the transaction's origin); external service calls do not. */
function taskOf(access: ToolAccess): { taskId?: string } {
  const taskId = (access as { taskId?: unknown }).taskId;
  return typeof taskId === 'string' ? { taskId } : {};
}

/** The `edits_ops` result without `op`: operation families with each operation's description, JSON Schema and example. The CLI's offline snapshot also uses it (`spec edits.<op>`). */
export function editOperationsCatalog() {
  return {
    conventions: TIME_CONVENTIONS,
    families: OPERATION_FAMILIES.map((family) => ({
      family,
      operations: EDIT_OPERATIONS.filter((s) => s.family === family).map(describeOperation),
    })),
  };
}

/** Problems found by preflight: the same error code as when the engine rejects an edit, with the first failing operation and all issues. */
function preflightError(issues: { index: number; path: string; message: string }[]): ToolError {
  const first = issues[0]!;
  return new ToolError('INVALID_OPERATION', `Operation ${first.index + 1}: ${first.path ? `${first.path} ` : ''}${first.message}`, {
    operationIndex: first.index,
    issues,
    next: 'Fix the operations according to issues (look up each operation\'s arguments with edits_ops), then preflight or commit again',
  });
}

/** IDs of the existing objects in the video: sequences, tracks, items, transitions, assets, documents and checkpoints. */
function knownIds(video: VideoSnapshot): Set<string> {
  const ids = new Set<string>([
    ...Object.keys(video.sequences),
    ...Object.keys(video.assets),
    ...Object.keys(video.documents),
    ...Object.keys(video.checkpoints),
  ]);
  for (const sequence of Object.values(video.sequences)) {
    for (const track of sequence.tracks) ids.add(track.id);
    for (const item of sequence.items) ids.add(item.id);
    for (const transition of sequence.transitions) ids.add(transition.id);
  }
  return ids;
}

/** ID fields that preflight checks (`ref` / `trackRef` / `documentRef` within the same edit do not count). */
const ID_FIELD = /^(sequenceId|trackId|itemId|assetId|documentId|transitionId|checkpointId)$/;
const ID_LIST_FIELD = /^(itemIds|assetIds|trackIds|documentIds)$/;

/** IDs of existing objects referenced by a (completed) operation, by field path (a document's `body` is skipped). */
function referencedIds(value: unknown, at = ''): { path: string; id: string }[] {
  if (Array.isArray(value)) return value.flatMap((entry, i) => referencedIds(entry, at ? `${at}.${i}` : String(i)));
  if (typeof value !== 'object' || value === null) return [];
  const found: { path: string; id: string }[] = [];
  for (const [key, entry] of Object.entries(value)) {
    // IDs inside a document body belong to the body itself (words, sentences, units), not to objects in the video.
    if (key === 'body') continue;
    const here = at ? `${at}.${key}` : key;
    if (ID_FIELD.test(key) && typeof entry === 'string') found.push({ path: here, id: entry });
    else if (ID_LIST_FIELD.test(key) && Array.isArray(entry)) {
      for (const [i, id] of entry.entries()) if (typeof id === 'string') found.push({ path: `${here}.${i}`, id });
    } else found.push(...referencedIds(entry, here));
  }
  return found;
}

/** `importAsset.path` for external services (§12.8: no file access outside the project folder): the real path must be inside `root`. */
async function confineImports(operations: Record<string, unknown>[], root: string): Promise<void> {
  const rootReal = await fs.realpath(root);
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  for (const [index, op] of operations.entries()) {
    if (op.type !== 'importAsset' || typeof op.path !== 'string') continue;
    const real = await fs.realpath(op.path).catch(() => null);
    if (!real || (real !== rootReal && !real.startsWith(prefix))) {
      throw new ToolError('PATH_OUTSIDE_PROJECT', `Operation ${index + 1}: the media file must be inside the project folder of the video (a path relative to the project folder)`);
    }
    op.path = real;
  }
}

/**
 * The asset for `chapters_adopt`: `asset` when given; otherwise the only asset in the video with source chapters (or a
 * description), or, when several have them, the only one of those placed on the timeline; with `outline` it can also be the
 * only audio/video asset on the timeline.
 */
function adoptedAsset(video: VideoSnapshot, sequence: Sequence, args: { asset?: string; outline?: unknown }): Id {
  if (args.asset !== undefined) {
    if (!video.assets[args.asset]) throw new ToolError('ENTITY_NOT_FOUND', `The video has no asset ${args.asset}`, { assetId: args.asset });
    return args.asset;
  }
  const placed = new Set(
    sequence.items.flatMap((item) => (itemTimeMap(item) ? [itemAssetRef(item)?.id] : [])).filter((id) => id !== undefined),
  );
  const sourced = Object.values(video.assets)
    .filter((asset) => hasSourceText(asset.revisions[asset.currentRevision]?.provenance))
    .map((asset) => asset.id);
  const pick = (ids: Id[]): Id | null => (ids.length === 1 ? ids[0]! : null);
  const chosen =
    args.outline === undefined
      ? (pick(sourced) ?? pick(sourced.filter((id) => placed.has(id))))
      : (pick([...placed]) ?? pick(sourced.filter((id) => placed.has(id))));
  if (chosen) return chosen;
  if (args.outline === undefined && !sourced.length) {
    throw new ToolError('NO_SOURCE_CHAPTERS', 'No asset in the video has source chapters or a description', {
      next: 'If the user has an outline, give it as outline; otherwise split chapters yourself from the transcript and use setChapters of edits_apply',
    });
  }
  if (args.outline !== undefined && !placed.size) {
    throw new ToolError('ASSET_NOT_PLACED', 'There is no audio or video asset on the timeline, so the chapters have nowhere to land', { next: 'First place the asset on the timeline' });
  }
  const candidates = args.outline === undefined ? sourced : [...placed];
  throw new ToolError('INVALID_ARGUMENTS', `Several assets qualify; name one with asset: ${candidates.join(', ')}`, { assetIds: candidates });
}

/** The transcript to snap to: `document` when given (it must be this asset's speech); otherwise this asset's only transcript, and no snapping when there is none. */
function adoptedSpeech(video: VideoSnapshot, assetId: Id, documentId: string | undefined): DocumentRecord | null {
  if (documentId !== undefined) {
    const document = video.documents[documentId];
    if (!document) throw new ToolError('DOCUMENT_NOT_FOUND', `The video has no document ${documentId}`, { documentId });
    if (document.kind !== 'speech' || document.sourceAssetId !== assetId) {
      throw new ToolError('INVALID_ARGUMENTS', `Document ${documentId} is not a transcript (kind speech) of asset ${assetId}`, { documentId });
    }
    return document;
  }
  const speeches = Object.values(video.documents).filter((document) => document.kind === 'speech' && document.sourceAssetId === assetId);
  if (speeches.length > 1) {
    const ids = speeches.map((document) => document.id);
    throw new ToolError('INVALID_ARGUMENTS', `Asset ${assetId} has several transcripts; name one with document: ${ids.join(', ')}`, { documentIds: ids });
  }
  return speeches[0] ?? null;
}

/** Whether the source has chapters or a description (which may contain a timestamped outline). */
function hasSourceText(provenance: AssetRevision['provenance'] | undefined): boolean {
  const source = provenance?.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
  const { chapters, description } = source as { chapters?: unknown; description?: unknown };
  return (Array.isArray(chapters) && chapters.length > 0) || (typeof description === 'string' && description.trim() !== '');
}

/** Without an asset duration, the end of the last transcript word serves as the end of the last chapter. */
function lastWordEnd(speech: unknown): number {
  const body = speech as { timescale?: unknown; words?: unknown } | undefined;
  if (!body || typeof body.timescale !== 'number' || body.timescale <= 0 || !Array.isArray(body.words)) return 0;
  const ends = body.words.map((word) => (word as { end?: unknown }).end).filter((end): end is number => typeof end === 'number');
  return ends.length ? Math.max(...ends) / body.timescale : 0;
}

/** The anchor chosen for a cleaned chapter row: the first row (whose start was clamped to 0) takes the earliest entry with that title; the rest match by (title, snapped start). */
function rowAnchor(plan: SourceChaptersResult, index: number, row: SourceChapterRow): SourceChapterAnchor | undefined {
  const sameTitle = plan.entries.filter((entry) => entry.source.title.trim() === row.title);
  const entry =
    index === 0 ? sameTitle.sort((a, b) => a.source.start - b.source.start)[0] : sameTitle.find((candidate) => candidate.at === row.start);
  return entry?.anchor;
}

type AdoptedRow = {
  title: string;
  at: number;
  sourceAt: number;
  status: SourceChapterStatus;
  anchor?: { tier: SourceChapterAnchor['tier']; snippet: string };
  offTimeline?: true;
};

/** One receipt row: chapters falling in a removed part are recorded as unanchored, without an anchor (the speech the anchor was in has been cut). */
function adoptedRow(chapter: ProjectedChapter<{ status: SourceChapterStatus; anchor: SourceChapterAnchor | undefined }>): AdoptedRow {
  const { anchor, status } = chapter.row;
  return {
    title: chapter.title,
    at: roundSeconds(chapter.at),
    sourceAt: roundSeconds(chapter.sourceAt),
    status: chapter.offTimeline ? 'unanchored' : status,
    ...(anchor && !chapter.offTimeline ? { anchor: { tier: anchor.tier, snippet: anchor.snippet } } : {}),
    ...(chapter.offTimeline ? { offTimeline: true as const } : {}),
  };
}

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Converts transcript ticks to seconds, keeping 6 decimal places (microseconds). */
function sourceSeconds(ticks: number, timescale: number): number {
  return Math.round((ticks / timescale) * 1e6) / 1e6;
}

/**
 * The basis for writing a translation of a transcript document (video format spec §5.3): sentences and fingerprints are
 * derived from the words by the rules of the captions and translation core (the same implementation as the translation
 * pipeline and the UI), so an agent translating by itself fills them in as given, without segmenting sentences or computing
 * fingerprints itself. Omitted when the document is not a transcript, its body cannot be read, or the sentence WASM is not built.
 */
function translationBasis(content: DocumentContent, sequenceId: Id): { translationBasis?: Record<string, unknown> } {
  if (content.document.kind !== 'speech') return {};
  let read: ReturnType<typeof sourceSentences>;
  try {
    read = sourceSentences(content.body);
  } catch (error) {
    if (error instanceof EditorWasmUnavailable) return {};
    throw error;
  }
  if ('problem' in read) return {};
  return {
    translationBasis: {
      sourceBasis: {
        speechRef: { id: content.document.id, revision: content.revision },
        sequenceId,
        scopeLineage: [],
        editViewHash: read.editViewHash,
      },
      // start, end: seconds on the asset clock (from the start of the first visible word to the end of the last visible word), so finding sentence boundaries needs no full body read.
      sentences: read.sentences.map((s) => ({
        id: s.id,
        fingerprint: s.fingerprint,
        text: s.text,
        wordIds: s.wordIds,
        start: sourceSeconds(s.start, read.timescale),
        end: sourceSeconds(s.end, read.timescale),
      })),
    },
  };
}
