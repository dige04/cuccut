import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_LOUDNESS_TARGET, RpcError, type ExportDestination, type ExportSettings, type Localized } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { ExportService } from '../exports/export-service.ts';
import { inside, outside, refuseVideoDirectory } from './artifact-save.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ExportBase, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { commandIdArg, videoArg } from './video-tools.ts';

/**
 * Export tool (architecture design §3.5, §9.11): the agent exports subtitles, transcripts, audio, rendered videos, portable
 * packages and NLE projects. It goes through the same `ExportService` as the gateway's `exports.create`: freezing, preflight
 * and queueing live in the service; the tool layer only handles permissions (a write: refused in plan mode, confirmed per call
 * at the external service's `ask` level), video scope (`ToolScope`) and the destination constraint (`ToolScope.exportBase`):
 * in a session the directory is relative to the source directory; for an external service it can only be the video's project's
 * `exports/` or a subdirectory of it. By real path it cannot escape, nor be a video directory or `.ccut`. Returns a jobId
 * immediately; wait for it with `jobs_wait` (details via `jobs_inspect`).
 */

export interface ExportToolsDeps {
  exports: ExportService;
  scope: ToolScope;
}

const rangeArg = z.strictObject({ start: z.number().min(0), end: z.number().positive() });

const schemas = {
  export: z.strictObject({
    video: videoArg,
    kind: z
      .enum(['subtitles', 'transcript', 'audio', 'video', 'portable', 'project'])
      .describe(
        'subtitles, transcript, audio, video (rendered video), portable (portable package: the whole video with its assets in one .cuccut file), project (NLE project: XML for Premiere / Resolve)',
      ),
    format: z
      .enum(['srt', 'vtt', 'ass', 'json', 'md', 'txt', 'wav', 'mp3', 'm4a', 'mp4', 'webm', 'cuccut', 'xmeml'])
      .describe('subtitles: srt, vtt, ass, json; transcript: md, txt, json; audio: wav, mp3, m4a; video: mp4, webm; portable: cuccut; project: xmeml'),
    purpose: z
      .enum(['deliverable', 'preview'])
      .optional()
      .describe('Optional. deliverable (default) is a file to hand over; preview is a temporary preview for the agent to check caption layout, picture or sound internally, and does not appear on the session video card or in the artifact list. A preview or short clip the user asked for is still a deliverable'),
    sequenceId: z.string().min(1).max(200).optional().describe('Optional. Sequence ID; defaults to the main sequence'),
    range: rangeArg.optional().describe('Optional. Export only [start, end) of the timeline (seconds, edited time); defaults to the whole sequence'),
    ranges: z.array(rangeArg).min(1).max(64).optional().describe('Optional. Several ranges, one file each; give either this or range, not both'),
    documentId: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. The primary document for subtitles and transcripts (speech or caption); when omitted one is picked by rule, and if none can be picked the call is refused with the candidates listed'),
    language: z.string().min(1).max(35).optional().describe('Optional. Pick the document by language when documentId is not given (BCP 47)'),
    bilingual: z
      .union([
        z.boolean(),
        z.strictObject({ documentId: z.string().min(1).max(200).optional(), language: z.string().min(1).max(35).optional() }),
      ])
      .optional()
      .describe('Optional. Bilingual merge: true takes the primary document\'s translation; or give another document\'s documentId or language'),
    maxCharsPerLine: z.number().int().min(8).max(200).optional().describe('Optional. Maximum line width (full-width characters count as 2), default 42'),
    timestamps: z.boolean().optional().describe('Optional. In transcripts (md, txt), append each paragraph\'s start time [mm:ss] at its end; off by default'),
    frontmatter: z
      .boolean()
      .optional()
      .describe('Optional. Write YAML front matter at the top of md transcripts (title, source, author, duration, language, speakers, chapters, etc.); off by default; never written for txt and json'),
    chapters: z.boolean().optional().describe('Optional. Write chapter headings in the transcript from the sequence\'s chapter markers; off by default'),
    speakers: z.boolean().optional().describe('Optional. Write the speaker on each transcript paragraph, default true; false omits it'),
    skipCut: z
      .boolean()
      .optional()
      .describe('Optional. Transcript skips cut parts, default true (times are edited timeline times); false exports the original text before cuts, with times in source media time'),
    sampleRate: z
      .union([z.literal(22050), z.literal(32000), z.literal(44100), z.literal(48000)])
      .optional()
      .describe('Optional. Sample rate for audio (and the rendered video\'s sound), default 48000'),
    channels: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .describe('Optional. Channel count, default 2'),
    bitrateKbps: z
      .number()
      .int()
      .min(32)
      .max(320)
      .optional()
      .describe('Optional. Bitrate for mp3 and m4a, default 192; not accepted for wav. For a rendered video it is the audio bitrate (mp4 default 192, webm 128)'),
    loudness: z
      .union([
        z.literal(true),
        z.strictObject({
          integratedLufs: z.number().min(-70).max(0),
          truePeakDb: z.number().min(-20).max(0),
        }),
      ])
      .optional()
      .describe('Optional. Loudness normalization (R128 mastering): true uses -16 LUFS / -1.2 dBTP, or give a target; off by default (audio and the rendered video\'s sound)'),
    codec: z.enum(['h264', 'hevc', 'vp9']).optional().describe('Optional. Video codec for the rendered video: mp4 defaults to h264 (hevc available), webm is vp9'),
    width: z
      .number()
      .int()
      .min(16)
      .max(7680)
      .optional()
      .describe('Optional. Output width of the rendered video; when only width or height is given the other follows the canvas aspect ratio (both rounded to even); defaults to the canvas size'),
    height: z
      .number()
      .int()
      .min(16)
      .max(4320)
      .optional()
      .describe(
        'Optional. Output height of the rendered video. When both width and height are given and their ratio differs from the canvas (e.g. a 9:16 1080x1920 output from a landscape video), the picture is scaled to fit at the canvas ratio and centered, with black bars elsewhere; no cropping, no relayout',
      ),
    fps: z
      .strictObject({ num: z.number().int().min(1).max(240000), den: z.number().int().min(1).max(100000) })
      .optional()
      .describe('Optional. Frame rate of the rendered video (a fraction, e.g. {num:30000,den:1001}); defaults to the sequence frame rate'),
    crf: z
      .number()
      .int()
      .min(0)
      .max(63)
      .optional()
      .describe('Optional. Constant quality for the rendered video (h264 default 20, hevc 23, vp9 32); give either this or videoBitrateKbps, not both'),
    videoBitrateKbps: z.number().int().min(100).max(200000).optional().describe('Optional. Target video bitrate of the rendered video (kbps)'),
    burnCaptions: z.boolean().optional().describe('Optional. Burn the timeline\'s captions into the rendered video, default true'),
    onUnsupported: z
      .enum(['fail', 'skip'])
      .optional()
      .describe(
        'Optional. When the rendered video has content that cannot be drawn: fail (default) refuses and lists each item in items; skip leaves them out (the whole layer is not drawn, the effect is not applied, the transition becomes a hard cut), with one job warning per item. Use skip only after the user agrees',
      ),
    missingAssets: z
      .enum(['fail', 'skip'])
      .optional()
      .describe(
        'Optional. When the portable package has assets that cannot be read: fail (default) refuses and lists each item in items; skip leaves them out of the package and marks them missing in the manifest. Use skip only after the user agrees',
      ),
    source: z
      .union([z.enum(['mix', 'original']), z.strictObject({ dubGroupId: z.string().min(1).max(128) })])
      .optional()
      .describe(
        'Optional. Sound source for audio and the rendered video: mix (default, the timeline mix), original (original sound only: drop the dubs and restore the original sound the dubs muted), {dubGroupId} (only this dub group; the groupId is in the dub track instance\'s extensions["cuccut.dub"]). Affects only this export; does not change the video',
      ),
    dir: z
      .string()
      .min(1)
      .max(1000)
      .optional()
      .describe(
        'Optional. Output directory, which must already exist; in a session it is relative to the working directory (defaults to exports/ under the working directory, or .cuccut-out/exports/ for purpose: preview); for an external service it is relative to the project\'s exports/. Cannot be inside a video directory or .ccut',
      ),
    fileName: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. File name (only when producing a single file); defaults to "video name.kind.extension", with a number appended automatically on a name clash'),
    overwrite: z.boolean().optional().describe('Optional. Replace the file named by fileName if it already exists, default false (refuse if it exists)'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
};

type Args = z.infer<(typeof schemas)['export']>;

const DEFINITIONS: Record<'export', ToolInfo> = {
  export: {
    title: 'Export',
    description: [
      'Exports a video as subtitles, a transcript, audio or a rendered video. It can also export a portable package or an NLE project file.',
      'Subtitles (srt, vtt, ass, json with word timings), transcript (md, txt, json), audio (wav, mp3, m4a, mixed from the timeline, with speed changes and gain as in the preview) or rendered video (mp4, webm: the picture is composited frame by frame on this machine from the same frame plan as the preview; the sound is the same as the audio export).',
      'Times are edited timeline times; cut words do not appear. The current revision of the video is frozen at submission: later edits do not affect this export.',
      'A preflight runs before submission and refuses outright, without creating a job, when there is no exportable document, more than one document (EXPORT_SOURCE_AMBIGUOUS: candidates lists them; pick one with documentId), an asset is missing or changed (ASSET_MISSING / ASSET_CHANGED), the destination already exists, ffmpeg or an encoder is missing (EXPORT_TOOL_MISSING), or the rendered video has content that cannot be drawn (EXPORT_UNSUPPORTED_CONTENT, listed item by item in items).',
      'Returns a jobId immediately: then wait for it with jobs_wait (progress via jobs_inspect); it is done only when state is completed, and outputs holds each file\'s path and validation result. Do not submit the same thing twice.',
      'Rendered-video progress is counted in frames (progress.unit is frames).',
      'When exporting only to grab frames, check caption layout or listen internally, you must pass purpose: preview; files the user asked for (including previews and short clips) use deliverable.',
      'Portable package (kind portable, format cuccut): the whole video (all document revisions and assets, linked assets included) packed into one file that CucCut elsewhere can open; it carries no local paths. NLE project (kind project, format xmeml): one sequence written as XML that Premiere / Resolve can import; assets are referenced by local path, and anything it cannot express (text, captions, transitions, effects, etc.) is recorded item by item as a job warning.',
    ].join('\n'),
    effect: 'job',
    examples: [
      { title: 'Export SRT subtitles', args: { video: 'demo', kind: 'subtitles', format: 'srt' } },
      { title: 'Export bilingual subtitles', args: { video: 'demo', kind: 'subtitles', format: 'srt', bilingual: true } },
      { title: 'Export a vertical video', args: { video: 'demo', kind: 'video', format: 'mp4', width: 1080, height: 1920 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
};

export class ExportTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #exports: ExportService;
  readonly #scope: ToolScope;

  constructor(deps: ExportToolsDeps) {
    this.#exports = deps.exports;
    this.#scope = deps.scope;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    if (name !== 'export') return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    return this.#create(args as Args, principal);
  }

  async #create(args: Args, principal: ToolPrincipal) {
    const access = this.#scope.authorize(principal, true);
    if (args.range && args.ranges) throw new ToolError('INVALID_ARGUMENTS', 'Give either range or ranges, not both');
    const settings = settingsOf(args);
    // Allowing an existing file to be replaced is an irreversible overwrite: `high`, asked even in `auto` mode (architecture design §3.12).
    const approval = await this.#scope.confirm(access, {
      tool: 'export',
      video: args.video,
      ...confirmSummary(summaryOf(args)),
      risk: args.overwrite ? 'high' : 'edit',
    });
    const opened = await this.#scope.open(args.video, access);
    const base = this.#scope.exportBase(access, opened);
    const dir = args.dir !== undefined || base.ownDefault ? await confinedDirectory(base, args.dir ?? '.') : undefined;
    const destination: ExportDestination = {
      ...(dir !== undefined ? { dir } : {}),
      ...(args.fileName !== undefined ? { fileName: plainFileName(args.fileName) } : {}),
      ...(args.overwrite ? { overwrite: true } : {}),
    };
    let jobId: string;
    try {
      ({ jobId } = await this.#exports.create(
        {
          videoId: opened.ref.videoId,
          settings,
          destination,
          ...(args.commandId ? { commandId: this.#scope.commandId(access, args.commandId) } : {}),
        },
        access.submitter,
      ));
    } catch (error) {
      throw toolErrorOf(error);
    }
    const record = this.#exports.get(jobId);
    return {
      jobId,
      kind: record.kind,
      state: record.state,
      videoId: record.videoId,
      videoRevision: record.export?.videoRevision ?? null,
      dir: record.export?.destination.dir ?? null,
      files: record.export?.destination.files ?? [],
      purpose: record.export?.settings.purpose ?? 'deliverable',
      ...approvalField(approval),
      next: 'Export submitted. Wait for it with jobs_wait (progress via jobs_inspect); it is done only when state is completed. Do not submit the same thing twice.',
    };
  }
}

function settingsOf(args: Args): ExportSettings {
  const purpose = args.purpose ? { purpose: args.purpose } : {};
  const scope = {
    ...purpose,
    ...(args.sequenceId ? { sequenceId: args.sequenceId } : {}),
    ...(args.range ? { range: args.range } : {}),
    ...(args.ranges ? { ranges: args.ranges } : {}),
  };
  if (args.source !== undefined && args.kind !== 'audio' && args.kind !== 'video') {
    throw new ToolError('INVALID_ARGUMENTS', 'source applies only to audio and rendered video');
  }
  const source = args.source !== undefined ? { source: args.source } : {};
  if (args.kind === 'portable') {
    if (args.format !== 'cuccut') throw new ToolError('INVALID_ARGUMENTS', 'The portable package format is cuccut');
    if (args.range || args.ranges || args.sequenceId)
      throw new ToolError('INVALID_ARGUMENTS', 'A portable package is the whole video: range, ranges and sequenceId are not accepted');
    return { kind: 'portable', format: 'cuccut', ...purpose, ...(args.missingAssets ? { missingAssets: args.missingAssets } : {}) };
  }
  if (args.kind === 'project') {
    if (args.format !== 'xmeml') throw new ToolError('INVALID_ARGUMENTS', 'The NLE project format is xmeml');
    if (args.range || args.ranges) throw new ToolError('INVALID_ARGUMENTS', 'An NLE project is the whole sequence: range and ranges are not accepted');
    return { kind: 'project', format: 'xmeml', ...purpose, ...(args.sequenceId ? { sequenceId: args.sequenceId } : {}) };
  }
  if (args.kind === 'video') {
    if (args.format !== 'mp4' && args.format !== 'webm') throw new ToolError('INVALID_ARGUMENTS', 'The rendered video format is mp4 or webm');
    if (args.crf !== undefined && args.videoBitrateKbps !== undefined)
      throw new ToolError('INVALID_ARGUMENTS', 'Give either crf or videoBitrateKbps, not both');
    const audio = {
      ...(args.sampleRate ? { sampleRate: args.sampleRate } : {}),
      ...(args.channels ? { channels: args.channels } : {}),
      ...(args.bitrateKbps ? { bitrateKbps: args.bitrateKbps } : {}),
      ...(args.loudness ? { loudness: args.loudness === true ? { ...DEFAULT_LOUDNESS_TARGET } : args.loudness } : {}),
    };
    return {
      kind: 'video',
      format: args.format,
      ...scope,
      ...(args.codec ? { codec: args.codec } : {}),
      ...(args.width !== undefined ? { width: args.width } : {}),
      ...(args.height !== undefined ? { height: args.height } : {}),
      ...(args.fps ? { fps: args.fps } : {}),
      ...(args.crf !== undefined ? { crf: args.crf } : {}),
      ...(args.videoBitrateKbps !== undefined ? { bitrateKbps: args.videoBitrateKbps } : {}),
      ...(args.burnCaptions !== undefined ? { burnCaptions: args.burnCaptions } : {}),
      ...(args.onUnsupported ? { onUnsupported: args.onUnsupported } : {}),
      ...(Object.keys(audio).length > 0 ? { audio } : {}),
      ...source,
    };
  }
  if (args.kind === 'audio') {
    if (args.format !== 'wav' && args.format !== 'mp3' && args.format !== 'm4a') {
      throw new ToolError('INVALID_ARGUMENTS', 'The audio format is wav, mp3 or m4a');
    }
    return {
      kind: 'audio',
      format: args.format,
      ...scope,
      ...(args.sampleRate ? { sampleRate: args.sampleRate } : {}),
      ...(args.channels ? { channels: args.channels } : {}),
      ...(args.bitrateKbps ? { bitrateKbps: args.bitrateKbps } : {}),
      ...(args.loudness ? { loudness: args.loudness === true ? { ...DEFAULT_LOUDNESS_TARGET } : args.loudness } : {}),
      ...source,
    };
  }
  const allowed = args.kind === 'subtitles' ? ['srt', 'vtt', 'ass', 'json'] : ['md', 'txt', 'json'];
  const onlyTranscript = (['frontmatter', 'chapters', 'speakers', 'skipCut'] as const).filter((key) => args[key] !== undefined);
  if (args.kind !== 'transcript' && onlyTranscript.length > 0)
    throw new ToolError('INVALID_ARGUMENTS', `${onlyTranscript.join(', ')} apply only to transcripts (kind transcript)`);
  if (!allowed.includes(args.format)) throw new ToolError('INVALID_ARGUMENTS', `The ${args.kind} format is ${allowed.join(', ')}`);
  return {
    kind: args.kind,
    format: args.format,
    ...scope,
    ...(args.documentId ? { documentId: args.documentId } : {}),
    ...(args.language ? { language: args.language } : {}),
    ...(args.bilingual !== undefined ? { bilingual: args.bilingual } : {}),
    ...(args.maxCharsPerLine ? { maxCharsPerLine: args.maxCharsPerLine } : {}),
    ...(args.timestamps !== undefined ? { timestamps: args.timestamps } : {}),
    ...(args.kind === 'transcript' ? transcriptOptions(args) : {}),
  } as ExportSettings;
}

/** Transcript-only options; refused for subtitles rather than silently dropped. */
function transcriptOptions(args: Args): Record<string, boolean> {
  const options: Record<string, boolean> = {};
  for (const key of ['frontmatter', 'chapters', 'speakers', 'skipCut'] as const) if (args[key] !== undefined) options[key] = args[key];
  return options;
}

/** The one-line summary shown in the service approval. */
function summaryOf(args: Args): Localized {
  return RcAgentTools.exportSummary({
    kind: args.kind,
    format: args.format,
    rangeStart: args.range ? args.range.start : null,
    rangeEnd: args.range ? args.range.end : null,
    rangeCount: !args.range && args.ranges ? args.ranges.length : null,
    width: args.width ?? null,
    height: args.height ?? null,
    originalOnly: args.source === 'original',
    dubGroupId: typeof args.source === 'object' ? args.source.dubGroupId : null,
    fileName: args.fileName ?? null,
    overwrite: args.overwrite ?? false,
  });
}

/**
 * The directory is relative to `base`; by real path it cannot leave `base`, nor be a video directory or `.ccut`. An `ownDefault`
 * `base` (the external service's project `exports/`) is created inside `within` when missing, after confirming (by real path)
 * that it stays inside `within`. When `within` is null (the user themselves in a terminal) there is no directory constraint:
 * absolute paths are accepted and relative ones resolve against `base`; it just cannot be a video directory or `.ccut`.
 */
async function confinedDirectory(base: ExportBase, dir: string): Promise<string> {
  if (base.within === null) {
    const real = await fs.realpath(path.resolve(base.base, dir)).catch(() => null);
    if (!real) throw new ToolError('INVALID_PATH', `Directory does not exist: ${dir} (omit dir to use the exports/ of the video's project)`);
    await refuseVideoDirectory(path.parse(real).root, real, []);
    return real;
  }
  const within = base.within;
  // An external service has no working directory: outside the project's exports/, answer in terms of the project.
  const refuse = () =>
    base.ownDefault
      ? new ToolError('PATH_OUTSIDE_PROJECT', 'You can only export into the exports/ of the video\'s project (a relative path, no .., not through a symlink pointing elsewhere)')
      : outside();
  if (path.isAbsolute(dir)) throw refuse();
  if (base.ownDefault) {
    const withinReal = await fs.realpath(within);
    const target = path.resolve(withinReal, path.relative(within, base.base));
    if (!inside(target, withinReal)) throw refuse();
    await fs.mkdir(target, { recursive: true }).catch(() => {
      throw refuse();
    });
    if (!inside(await fs.realpath(target), withinReal)) throw refuse();
  }
  const rootReal = await fs.realpath(base.base);
  const resolved = path.resolve(rootReal, dir);
  if (!inside(resolved, rootReal)) throw refuse();
  const real = await fs.realpath(resolved).catch(() => null);
  if (!real) throw new ToolError('INVALID_PATH', `Directory does not exist: ${dir} (omit dir to use the default exports/)`);
  if (!inside(real, rootReal)) throw refuse();
  await refuseVideoDirectory(rootReal, real, []);
  return real;
}

function plainFileName(name: string): string {
  if (name !== path.basename(name) || name.startsWith('.')) {
    throw new ToolError('INVALID_PATH', 'fileName is a bare file name: no directories, not starting with . (use dir for the directory)');
  }
  return name;
}

/** Preflight refusals: the error code is in `details.code`; passed to the agent as is, with a next step attached. */
function toolErrorOf(error: unknown): unknown {
  if (!(error instanceof RpcError)) return error;
  const details = (error.details ?? {}) as Record<string, unknown>;
  if (typeof details.code !== 'string') return error;
  const { code, ...rest } = details as { code: string } & Record<string, unknown>;
  // Absolute paths of the destination directory and asset files are not given to the agent (it only uses paths relative to the working directory).
  delete rest.path;
  if (Array.isArray(rest.items)) {
    rest.items = rest.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const { path: _path, ...kept } = item as Record<string, unknown>;
      return kept;
    });
  }
  return new ToolError(code, error.message, { ...rest, ...(EXPORT_NEXT[code] ? { next: EXPORT_NEXT[code] } : {}) });
}

const EXPORT_NEXT: Record<string, string> = {
  EXPORT_SOURCE_AMBIGUOUS: 'Pick one from candidates, specify it with documentId and submit again.',
  EXPORT_SOURCE_NOT_FOUND: 'The video has no subtitles or transcript to export: transcribe first if needed (transcribe), or tell the user.',
  EXPORT_SOURCE_UNSUPPORTED: 'This document cannot be exported as subtitles or a transcript: use a speech or caption document instead.',
  EXPORT_NOTHING_TO_EXPORT: 'There is no text in this range: pick another range, or check whether the document\'s content has all been cut.',
  EXPORT_SOURCE_UNPLACED: 'This document\'s source asset is not on this sequence, so it cannot be projected onto the timeline: use scopeItemIds or another document.',
  EXPORT_SOURCE_INVALID: 'The document\'s content is incomplete (e.g. missing times): tell the user; do not edit the document yourself to work around it.',
  EXPORT_RANGE_EMPTY: 'The range is empty or outside the sequence: check the sequence duration with videos_inspect and pick another range.',
  EXPORT_TOOL_MISSING: 'ffmpeg / ffprobe, an encoder or the Render Worker is missing: pass remedy on to the user and let them install it; do not install or work around it yourself.',
  EXPORT_UNSUPPORTED_CONTENT:
    "items lists the content the rendered video cannot draw: tell the user which; if the user agrees to skip them, submit again with onUnsupported: 'skip', or change that content first.",
  EXPORT_DESTINATION_EXISTS: 'The destination file already exists: use another fileName; if it really should be replaced, ask the user first, then pass overwrite: true.',
  EXPORT_DESTINATION_UNWRITABLE: 'The destination directory is not writable: use another existing directory in the working directory, or tell the user.',
  ASSET_MISSING:
    "An asset file is gone: tell the user and ask them to relink it; do not look for a substitute file yourself. For a portable package, if the user agrees you may submit again with missingAssets: 'skip' (marked missing in the manifest).",
  EXPORT_PACKAGE_LOCAL_PATH: 'The documents listed in items contain local paths in their body, which a portable package cannot carry: tell the user which documents, and let them decide how to change them.',
  EXPORT_PACKAGE_UNSUPPORTED: 'The files listed in items cannot be written into a .cuccut archive (path too long, or a single file of 8 GiB or more): tell the user.',
  EXPORT_INSUFFICIENT_SPACE: 'Not enough space on the disk of the export directory: tell the user the space needed (required), and let them free up space or choose another directory.',
  ASSET_CHANGED: 'A linked asset file has been modified: tell the user and ask them to confirm and relink it; do not work around it yourself.',
  EXPORT_KIND_UNSUPPORTED: 'This version can only export subtitles, transcript, audio, video, portable, project.',
  REVIEW_BLOCKED:
    "findings lists what the user's standard refuses: fix each (fix says how) and export again. If the user wants one to stand, call review_waive with their reason — it asks them. Do not lower severities or switch the gate off to get past it.",
};
