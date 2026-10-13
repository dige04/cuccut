import fs from 'node:fs/promises';
import { z } from 'zod';
import {
  DUB_PIPELINE,
  TRANSCODE_PIPELINE,
  TRANSCRIBE_PIPELINE,
  TRANSLATE_PIPELINE,
  TRANSLATE_SUBTITLES_PIPELINE,
  type PipelineRunner,
} from '@cuccut/jobs';
import { RpcError, type CapabilityNotConfiguredDetails } from '@cuccut/protocol';
import { RcFlowTools } from '@cuccut/protocol/messages/runtime-core';
import { errorBody, ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { startLinkImport, toolErrorOf, type LinkImportToolsDeps } from './link-import-tools.ts';
import { resolveUserPath } from './video-digest.ts';
import { commandIdArg, videoArg } from './video-tools.ts';

/**
 * Top-level verbs (agent surface design §4.2, architecture design §3.5, §7.9): `transcribe`, `translate`, `dub` and `transcode`
 * each start a fixed pipeline and return a `jobId` immediately; the pipeline's steps, outputs and retries live in the pipeline
 * (`pipelines/` in `packages/jobs`). Here we only map tool args to pipeline params, resolve paths and destinations, and confirm
 * according to the access mode. `transcribe` with `url` takes the same path as `download` (`startLinkImport`).
 *
 * Paths: `file`, `files` and `outDir` resolve against `ToolScope.fileBase` (the working directory for a session, cwd for the
 * terminal; `~/` expands to the home directory); the external service (§4.8) has no local paths, so passing one is rejected with
 * `INVALID_ARGUMENTS`, with `next` pointing to `video` / `url`.
 *
 * Outbound grants are checked by the pipeline (`withPipelineGrants`): calls not covered are rejected with `GRANT_REQUIRED`, and the
 * tool catalog adds `next` in the uniform format; we do not issue grants as part of confirmation (the pipeline's check only accepts
 * existing grants).
 *
 * When no text model is configured, `translate` (and `dub` without a translation) is rejected with `CAPABILITY_NOT_CONFIGURED`, with
 * `next` pointing to the agent translating by itself (§4.4): translation is something the agent can do, not something the user has
 * to configure.
 */

export interface FlowToolsDeps {
  pipelines: PipelineRunner;
  scope: ToolScope;
  /** Used by `transcribe` with `url` (the same dependencies as `download`). */
  linkImport: LinkImportToolsDeps;
}

const LANGUAGE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;
const languageArg = z.string().regex(LANGUAGE);
const pathArg = z.string().min(1).max(4000);
const providerArg = z.string().min(1).max(200);
const glossaryArg = z
  .array(
    z.strictObject({
      source: z.string().min(1).max(200).describe('How the term is written in the source'),
      target: z.string().min(1).max(200).describe('Its translation'),
      note: z.string().max(500).optional().describe('Optional. A note (when to translate it this way)'),
    }),
  )
  .max(500);

const schemas = {
  transcribe: z.strictObject({
    video: videoArg.optional().describe('One of three inputs: transcribe an asset in this existing video (the path or videoId from videos_list)'),
    asset: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. Only with video: the asset to transcribe (assetId); if omitted, the only asset on the root sequence main track'),
    file: pathArg
      .optional()
      .describe('One of three inputs: a local audio or video file (relative paths resolve against the working directory). By default creates a new video, imports the file and places it on the timeline; with noVideo, only writes transcript files'),
    url: z
      .string()
      .min(1)
      .max(4000)
      .optional()
      .describe(
        'One of three inputs: a link to a video page, first downloaded with yt-dlp (same as download). By default creates a new video and transcribes it; with noVideo, only downloads and writes TXT and SRT transcripts next to the media',
      ),
    project: z
      .string()
      .min(1)
      .max(1000)
      .optional()
      .describe(
        'Optional. With file or url: the project that holds the new video (or the download-only file) (a project id or the path of a registered project directory); if omitted, the same place as videos_create',
      ),
    name: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Optional. Name of the new video: with file or url, defaults to the file name (the page title for url); with video and destination new-video, defaults to "<original name> · Re-transcribed"',
      ),
    target: z
      .enum(['new-video', 'replace'])
      .optional()
      .describe(
        'Optional. Only with video: where the result goes when the video already has a transcript for this asset. new-video (default) creates a new video in the same project, linked to the same asset; replace replaces the current transcript and carries over translations, captions and dubbing in one undoable transaction. For a video without a transcript, both write directly into it',
      ),
    translations: z
      .enum(['carry', 'discard'])
      .optional()
      .describe('Optional. Only with target: replace: carry (default) carries over translations; sentences whose source text is unchanged keep their translation and review status, changed ones are marked stale; discard does not carry them over'),
    acceptEdited: z
      .boolean()
      .optional()
      .describe(
        'Optional. Only with target: replace: replace even if the user edited the transcript after transcription (those edits are lost; undo brings them back); if omitted, rejected with TRANSCRIPT_EDITED',
      ),
    noVideo: z
      .boolean()
      .optional()
      .describe(
        'Optional. Do not create a video: with file, writes <file name>.txt and .srt into outDir (the downloads directory if omitted); with url, puts the downloaded file and transcripts into the downloads directory (that project\'s downloads/ when project is given)',
      ),
    outDir: pathArg.optional().describe('Optional. Only with file and noVideo: output directory for the transcripts (created if missing)'),
    language: languageArg.optional().describe('Optional. The spoken language (BCP 47, e.g. en, zh-CN); detected automatically if omitted'),
    provider: providerArg.optional().describe('Optional. Transcription provider (a providerId listed by models_capabilities); the default if omitted'),
    model: providerArg.optional().describe('Optional. Transcription model; only with provider'),
    diarize: z.boolean().optional().describe('Optional. Distinguish speakers; if omitted, follows the model (diarizes when the model can)'),
    hint: z
      .string()
      .min(1)
      .max(1000)
      .optional()
      .describe(
        'Optional. Recognition hint: names, terms, proper nouns; the transcription glossary enabled in the video still applies. Only models that accept hints use it (acceptsHint in models_capabilities; MOSS does not): otherwise the hint is ignored and the transcription job records a hint-ignored warning; in that case leave it out and leave names and terms to polishing',
      ),
    noCaptions: z.boolean().optional().describe('Optional. Do not create a caption layer after transcription (created by default)'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  translate: z.strictObject({
    video: videoArg.optional().describe('One of two inputs: translate the transcript in this video (the path or videoId from videos_list)'),
    file: pathArg.optional().describe('One of two inputs: a local subtitle file (.srt or .vtt); the translation is written to a new file without touching any video'),
    to: languageArg.describe('Target language (BCP 47, e.g. zh-CN, en, ja)'),
    document: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. Only with video: the source transcript (documentId of a speech document); may be omitted when the video has only one'),
    style: z.string().min(1).max(500).optional().describe('Optional. Style hint, e.g. "conversational, concise"'),
    glossary: glossaryArg.optional().describe('Optional. Term translations for this run (combined with the translation glossary enabled in the video)'),
    bilingual: z
      .boolean()
      .optional()
      .describe('Optional. Bilingual: with video, the source and translated caption layers share one style (caption layers must be created); with file, each cue shows the source line above the translation'),
    noCaptions: z.boolean().optional().describe('Optional. Only with video: do not create a caption layer after writing the translation (created by default)'),
    from: languageArg.optional().describe('Optional. Only with file: source language (BCP 47); determined by the model if omitted'),
    format: z.enum(['srt', 'vtt']).optional().describe('Optional. Only with file: output format, srt or vtt; same as the input if omitted'),
    outDir: pathArg.optional().describe('Optional. Only with file: output directory (created if missing); the downloads directory if omitted'),
    provider: providerArg.optional().describe('Optional. Text model provider; the default if omitted'),
    model: providerArg.optional().describe('Optional. Text model; only with provider'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  dub: z.strictObject({
    video: videoArg.describe('The video to dub (the path or videoId from videos_list)'),
    to: languageArg.optional().describe('Target language (BCP 47); may be omitted when translation is given'),
    translation: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. An existing translation (documentId of a translation document); if omitted, the text model translates first'),
    document: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. The source transcript (documentId of a speech document); may be omitted when the video has only one or translation is given'),
    voice: z.string().min(1).max(200).optional().describe('Optional. Voice: a voice ID of the model, or library:<id> from the user\'s library; the model\'s default voice if omitted'),
    original: z.enum(['duck', 'mute', 'keep']).optional().describe('Optional. What to do with the original audio: duck lowers it (default), mute silences it, keep leaves it as is'),
    separateBackground: z.boolean().optional().describe('Optional. Separate vocals from the background first, and duck or mute only the vocals, keeping the background'),
    provider: providerArg.optional().describe('Optional. Speech synthesis provider; the default if omitted'),
    model: providerArg.optional().describe('Optional. Speech synthesis model; only with provider'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
  transcode: z.strictObject({
    files: z.array(pathArg).min(1).max(100).describe('Local input files (relative paths resolve against the working directory); merge joins them in this order'),
    merge: z.boolean().optional().describe('Optional. Merge them into one file in order; without merge or extractAudio, each file is compressed separately'),
    extractAudio: z.boolean().optional().describe('Optional. Extract the audio track of each file (stream-copied without re-encoding when possible); cannot be combined with merge'),
    codec: z.enum(['h264', 'hevc']).optional().describe('Optional. Video codec, h264 (default) or hevc'),
    maxHeight: z.number().int().min(16).max(8640).optional().describe('Optional. Maximum frame height in pixels, e.g. 1080'),
    crf: z.number().int().min(0).max(51).optional().describe('Optional. Constant quality (0–51; lower is sharper and produces larger files)'),
    outDir: pathArg.optional().describe('Optional. Output directory (created if missing); the downloads directory if omitted. The original files are left untouched'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
};

type Name = keyof typeof schemas;
type Args<N extends Name> = z.infer<(typeof schemas)[N]>;

const JOB_NOTE =
  'Returns a jobId immediately: use jobs_wait until state is completed; the results are in pipeline.summary and outputs. On failure, follow error and next.';

const DEFINITIONS: Record<Name, ToolInfo> = {
  transcribe: {
    title: 'Transcribe',
    description: [
      'Transcribes into a new transcript and creates a caption layer. Creates a new video first when needed.',
      'One of three inputs: video (an existing video; asset may be given); file (local media: creates a new video, imports it and places it on the timeline); url (a link: downloads it first, same as download, then creates a new video and transcribes it). With noVideo, no video is created; only TXT and SRT transcript files are written.',
      'When video already has a transcript for this asset, a second one is not added to the same video: target defaults to new-video, which creates a new video in the same project (linked to the same asset, named "<original name> · Re-transcribed" by default); target: replace replaces the current transcript and carries over translations, captions and dubbing (translations: discard does not carry over translations). If the user edited the transcript, it is rejected with TRANSCRIPT_EDITED; add acceptEdited: true only once discarding those edits is confirmed. A newly created video is kept if a later step fails; do not create it again.',
      JOB_NOTE,
      'On completion, pipeline.summary.documentId is the new transcript (can be passed to documents_read), summary.captions is the caption layer, and summary.videoId is the video when one was created; summary.target is the destination (new-video, replace, first). With replace, summary.replaced.transactionId can be undone, and summary.translations gives the number of sentences kept and marked stale per language.',
      'The external service cannot pass file or outDir: pass video, or url with project (the new video is created in that registered project and is then within the service\'s scope; with noVideo, it only downloads and writes transcripts).',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'job',
    examples: [
      { title: 'Re-transcribe and replace the current transcript', args: { video: 'demo', target: 'replace' } },
      { title: 'Create a video from a local file and transcribe it', args: { file: '~/Movies/talk.mp4', language: 'en' } },
      { title: 'Create a video from a link and transcribe it', args: { url: 'https://example.com/talk' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
    cliSwitches: [
      { flag: 'replace', field: 'target', value: 'replace' },
      { flag: 'discard-translations', field: 'translations', value: 'discard' },
    ],
  },
  translate: {
    title: 'Translate',
    description: [
      'Translates a transcript or a subtitle file with the configured text model.',
      'Use it only when the user explicitly asks to translate with the configured text model; by default, translate yourself: documents_read (for: translation) -> translate sentence by sentence -> documents_put -> captions_create.',
      'video + to: writes a new translation (translation document) and creates a caption layer in the target language (not with noCaptions). file + to: translates an SRT / VTT subtitle file into a new file without touching any video.',
      JOB_NOTE,
      'When no text model is configured, it is rejected with CAPABILITY_NOT_CONFIGURED: follow next and translate yourself; do not ask the user to configure one.',
      'The external service cannot pass file or outDir: pass video.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'job',
    examples: [
      { title: 'Translate the video transcript into Vietnamese and add a caption layer', args: { video: 'demo', to: 'vi' } },
      { title: 'Bilingual captions', args: { video: 'demo', to: 'ja', bilingual: true, style: 'conversational, concise' } },
      { title: 'Translate a subtitle file', args: { file: 'talk.srt', to: 'es' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  dub: {
    title: 'Translate and dub',
    description: [
      'Translates and dubs a video, placing the result on a new dub track. Translates first when there is no translation, then synthesizes and aligns sentence by sentence.',
      'When a translation already exists (e.g. one you translated yourself and wrote with documents_put), pass translation and no text model is called; otherwise pass to, and the configured text model translates first.',
      'original decides the original audio: duck lowers it (default), mute silences it, keep leaves it as is; separateBackground separates the vocals first and only processes the vocals.',
      JOB_NOTE,
      'On completion, pipeline.summary.trackId is the dub track, and summary.units says how many sentences were placed, how many were not synthesized and why.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'job',
    examples: [
      { title: 'Dub with an existing translation', args: { video: 'demo', translation: 'doc_zh' } },
      { title: 'Translate into English and dub, muting the original audio', args: { video: 'demo', to: 'en', original: 'mute', voice: 'alloy' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  transcode: {
    title: 'Transcode',
    description: [
      'File to file: compresses, merges in order or extracts audio tracks. Creates no video and does not touch the original files.',
      'By default compresses each file (codec h264 or hevc, maxHeight, crf); merge joins them into one file in the order of files (stream copy when the parameters match); extractAudio extracts the audio track of each file.',
      JOB_NOTE,
      'On completion, the paths in outputs (pipeline.summary.files) are the output files: tell the user where they are.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'job',
    examples: [
      { title: 'Compress to 1080p', args: { files: ['talk.mov'], maxHeight: 1080 } },
      { title: 'Merge in order', args: { files: ['part1.mp4', 'part2.mp4'], merge: true } },
      { title: 'Extract the audio track', args: { files: ['talk.mp4'], extractAudio: true, outDir: 'audio' } },
    ],
    // Its only input is local files, so the external service cannot use it (§6.2 does not list it).
    surfaces: ['agent', 'cli'],
    positional: 'files',
  },
};

/** `translate`'s next step when no text model is configured: the agent translates by itself (agent surface design §4.4). */
const SELF_TRANSLATE_NEXT =
  'No text model is configured; do not ask the user to configure one: do the translation yourself. Read the transcript with documents_read (for: translation), translate it sentence by sentence, write it with documents_put as a new document of kind translation (sourceDocument pointing to the source), then put the caption layer on screen with captions_create (bilingual: true for bilingual captions).';
const SELF_TRANSLATE_FILE_NEXT =
  'No text model is configured; do not ask the user to configure one: translate the subtitle file yourself. Read the original file, translate it cue by cue (timecodes unchanged), write a new file in the working directory and tell the user where it is.';
const SELF_TRANSLATE_DUB_NEXT =
  'No text model is configured; do not ask the user to configure one: translate it yourself first (read the transcript with documents_read (for: translation), translate it sentence by sentence and write it with documents_put as a new document of kind translation), then call dub with translation (the documentId of the new translation).';

export class FlowTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: FlowToolsDeps;

  constructor(deps: FlowToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name) {
      case 'transcribe':
        return this.#transcribe(args as Args<'transcribe'>, principal);
      case 'translate':
        return this.#translate(args as Args<'translate'>, principal);
      case 'dub':
        return this.#dub(args as Args<'dub'>, principal);
      case 'transcode':
        return this.#transcode(args as Args<'transcode'>, principal);
      default:
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    }
  }

  async #transcribe(args: Args<'transcribe'>, principal: ToolPrincipal) {
    const inputs = [args.video, args.file, args.url].filter((value) => value !== undefined).length;
    if (inputs !== 1) throw new ToolError('INVALID_ARGUMENTS', 'One of three inputs: give exactly one of video, file, url');
    if (args.asset !== undefined && args.video === undefined) throw new ToolError('INVALID_ARGUMENTS', 'asset is only given with video');
    if (args.video !== undefined && (args.noVideo || args.project !== undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', 'With video, an existing video is transcribed: noVideo and project do not apply');
    }
    if (args.video === undefined && (args.target !== undefined || args.translations !== undefined || args.acceptEdited !== undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', 'target, translations and acceptEdited are only given with video');
    }
    if (args.target === 'replace' && args.name !== undefined) {
      throw new ToolError('INVALID_ARGUMENTS', 'name is only for creating a new video: it does not apply with target: replace');
    }
    if (args.target !== 'replace' && (args.translations !== undefined || args.acceptEdited !== undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', 'translations and acceptEdited are only given with target: replace');
    }
    if (args.outDir !== undefined && !(args.file !== undefined && args.noVideo)) {
      throw new ToolError('INVALID_ARGUMENTS', 'outDir is only given with file and noVideo');
    }
    if (args.model !== undefined && args.provider === undefined) throw new ToolError('INVALID_ARGUMENTS', 'model is only given with provider');
    if (args.url !== undefined) return this.#transcribeLink(args, args.url, principal);

    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const recognition = {
      ...(args.language !== undefined ? { language: args.language } : {}),
      ...(args.provider !== undefined ? { provider: args.provider } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.hint !== undefined ? { hint: args.hint } : {}),
      ...(args.diarize !== undefined ? { diarize: args.diarize } : {}),
    };
    if (args.video !== undefined) {
      const opened = await scope.open(args.video, access);
      const approval = await scope.confirm(access, {
        tool: 'transcribe',
        video: args.video,
        ...confirmSummary(
          args.target === 'replace'
            ? RcFlowTools.transcribeReplaceSummary({ asset: args.asset ?? null, ...providerOf(args) })
            : RcFlowTools.transcribeVideoSummary({ asset: args.asset ?? null, ...providerOf(args), captions: !args.noCaptions }),
        ),
      });
      // The tool's `target` is the pipeline param `destination`.
      const jobId = await this.#start(access, TRANSCRIBE_PIPELINE, args.commandId, {
        videoId: opened.ref.videoId,
        ...(args.asset !== undefined ? { assetId: args.asset } : {}),
        ...recognition,
        captions: !args.noCaptions,
        ...(args.target !== undefined ? { destination: args.target } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.translations !== undefined ? { translations: args.translations } : {}),
        ...(args.acceptEdited !== undefined ? { acceptEdited: args.acceptEdited } : {}),
      });
      return {
        jobId,
        ...approvalField(approval),
        next: 'Transcription submitted. Use jobs_wait until completed: pipeline.summary.documentId is the new transcript (can be passed to documents_read), and summary.captions is the caption layer.',
      };
    }

    // Local file: the external service is rejected here with INVALID_ARGUMENTS (`fileBase`).
    const base = scope.fileBase(access);
    const file = resolveUserPath(args.file as string, base);
    if (args.noVideo) {
      if (args.project !== undefined || args.name !== undefined)
        throw new ToolError('INVALID_ARGUMENTS', 'With noVideo, no video is created: project and name do not apply');
      const outDir = args.outDir !== undefined ? resolveUserPath(args.outDir, base) : undefined;
      const approval = await scope.confirm(access, {
        tool: 'transcribe',
        ...confirmSummary(RcFlowTools.transcribeFileSummary({ file, ...providerOf(args), outDir: outDir ?? null })),
      });
      const jobId = await this.#start(access, TRANSCRIBE_PIPELINE, args.commandId, {
        file,
        ...(outDir !== undefined ? { outDir } : {}),
        ...recognition,
      });
      return {
        jobId,
        ...approvalField(approval),
        next: 'Transcription submitted without creating a video. Use jobs_wait until completed: the paths in outputs (pipeline.summary.files) are the TXT and SRT transcripts; tell the user where they are.',
      };
    }
    await scope.createRoot(access, args.project, { locate: true });
    const approval = await scope.confirm(access, {
      tool: 'transcribe',
      ...confirmSummary(
        RcFlowTools.transcribeCreateSummary({ name: args.name ?? null, file, ...providerOf(args), captions: !args.noCaptions }),
      ),
    });
    // Prepare for creation only after confirmation (the terminal registers the project); a session without a project creates the video in its working directory (§3.10).
    const root = await scope.createRoot(access, args.project);
    // Use the real path: when the session bound a project during the turn, the old path links into the project, and the pipeline later reads the file in the project.
    const media = await fs.realpath(file).catch(() => file);
    const jobId = await this.#start(access, TRANSCRIBE_PIPELINE, args.commandId, {
      target: { create: { ...root.scope, ...(args.name !== undefined ? { name: args.name } : {}), media } },
      ...recognition,
      captions: !args.noCaptions,
    });
    return {
      jobId,
      ...approvalField(approval),
      next: 'Submitted: creating a new video, importing and transcribing. Use jobs_wait until completed: pipeline.summary.videoId is the new video (can be passed to videos_inspect), summary.documentId is the new transcript, and summary.captions is the caption layer. A newly created video is kept if a later step fails; do not create it again.',
    };
  }

  /**
   * `transcribe` with `url`: the same path as `download`; creates a new video, transcribes it and creates a caption layer (with `noVideo`,
   * only downloads and writes transcripts). Language, provider and model, hint and speakers work as with file or video and are handed
   * to the pipeline's transcription step.
   */
  #transcribeLink(args: Args<'transcribe'>, url: string, principal: ToolPrincipal) {
    if (args.noVideo && (args.name !== undefined || args.diarize !== undefined || args.noCaptions !== undefined)) {
      throw new ToolError('INVALID_ARGUMENTS', 'With noVideo, no video is created and only TXT and SRT transcripts are written: name, diarize and noCaptions do not apply', {
        next: 'Remove name, diarize and noCaptions; to get a new video and a caption layer, omit noVideo.',
      });
    }
    return startLinkImport(
      this.#deps.linkImport,
      {
        url,
        ...(args.noVideo ? {} : { newVideo: true, captions: !args.noCaptions }),
        ...(args.project !== undefined ? { project: args.project } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
        transcribe: true,
        ...(args.language !== undefined ? { language: args.language } : {}),
        ...(args.provider !== undefined ? { provider: args.provider } : {}),
        ...(args.model !== undefined ? { model: args.model } : {}),
        ...(args.hint !== undefined ? { hint: args.hint } : {}),
        ...(args.diarize !== undefined ? { diarize: args.diarize } : {}),
        ...(args.commandId !== undefined ? { commandId: args.commandId } : {}),
      },
      principal,
    );
  }

  async #translate(args: Args<'translate'>, principal: ToolPrincipal) {
    if ((args.video === undefined) === (args.file === undefined))
      throw new ToolError('INVALID_ARGUMENTS', 'One of two inputs: give exactly one of video, file');
    if (args.model !== undefined && args.provider === undefined) throw new ToolError('INVALID_ARGUMENTS', 'model is only given with provider');
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const text = {
      targetLanguage: args.to,
      ...(args.style !== undefined ? { style: args.style } : {}),
      ...(args.glossary !== undefined ? { glossary: args.glossary } : {}),
      ...(args.provider !== undefined ? { provider: args.provider } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.bilingual !== undefined ? { bilingual: args.bilingual } : {}),
    };
    if (args.video !== undefined) {
      if (args.from !== undefined || args.format !== undefined || args.outDir !== undefined) {
        throw new ToolError('INVALID_ARGUMENTS', 'from, format and outDir are only given with file');
      }
      if (args.bilingual && args.noCaptions)
        throw new ToolError('INVALID_ARGUMENTS', 'bilingual is a caption layer display mode: it requires creating caption layers and cannot be combined with noCaptions');
      const opened = await scope.open(args.video, access);
      const approval = await scope.confirm(access, {
        tool: 'translate',
        video: args.video,
        ...confirmSummary(
          RcFlowTools.translateVideoSummary({
            to: args.to,
            ...providerOf(args),
            captions: !args.noCaptions,
            bilingual: args.bilingual === true,
          }),
        ),
      });
      const jobId = await this.#start(
        access,
        TRANSLATE_PIPELINE,
        args.commandId,
        {
          videoId: opened.ref.videoId,
          ...(args.document !== undefined ? { documentId: args.document } : {}),
          ...text,
          captions: !args.noCaptions,
        },
        SELF_TRANSLATE_NEXT,
      );
      return {
        jobId,
        ...approvalField(approval),
        next: 'Translation submitted. Use jobs_wait until completed: pipeline.summary.documentId is the new translation (translation document), and summary.captions is the caption layer; use export to get a file.',
      };
    }
    if (args.document !== undefined || args.noCaptions !== undefined)
      throw new ToolError('INVALID_ARGUMENTS', 'document and noCaptions are only given with video');
    const base = scope.fileBase(access);
    const input = resolveUserPath(args.file as string, base);
    const outDir = args.outDir !== undefined ? resolveUserPath(args.outDir, base) : undefined;
    const approval = await scope.confirm(access, {
      tool: 'translate',
      ...confirmSummary(RcFlowTools.translateFileSummary({ input, to: args.to, ...providerOf(args), outDir: outDir ?? null })),
    });
    const jobId = await this.#start(
      access,
      TRANSLATE_SUBTITLES_PIPELINE,
      args.commandId,
      {
        input,
        ...text,
        ...(args.from !== undefined ? { sourceLanguage: args.from } : {}),
        ...(args.format !== undefined ? { format: args.format } : {}),
        ...(outDir !== undefined ? { outDir } : {}),
      },
      SELF_TRANSLATE_FILE_NEXT,
    );
    return {
      jobId,
      ...approvalField(approval),
      next: 'Translation submitted. Use jobs_wait until completed: pipeline.summary.file (outputs[0].path) is the translated subtitle file; tell the user where it is.',
    };
  }

  async #dub(args: Args<'dub'>, principal: ToolPrincipal) {
    if (args.to === undefined && args.translation === undefined) throw new ToolError('INVALID_ARGUMENTS', 'Give at least one of to and translation');
    if (args.model !== undefined && args.provider === undefined) throw new ToolError('INVALID_ARGUMENTS', 'model is only given with provider');
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const opened = await scope.open(args.video, access);
    const approval = await scope.confirm(access, {
      tool: 'dub',
      video: args.video,
      ...confirmSummary(
        RcFlowTools.dubSummary({
          to: args.to ?? null,
          translation: args.translation ?? null,
          ...providerOf(args),
          voice: args.voice ?? null,
          original: args.original ?? 'duck',
        }),
      ),
    });
    const jobId = await this.#start(
      access,
      DUB_PIPELINE,
      args.commandId,
      {
        videoId: opened.ref.videoId,
        ...(args.to !== undefined ? { targetLanguage: args.to } : {}),
        ...(args.translation !== undefined ? { translationId: args.translation } : {}),
        ...(args.document !== undefined ? { documentId: args.document } : {}),
        ...(args.voice !== undefined ? { voice: args.voice } : {}),
        ...(args.provider !== undefined ? { provider: args.provider } : {}),
        ...(args.model !== undefined ? { model: args.model } : {}),
        ...(args.original !== undefined ? { originalAudio: args.original } : {}),
        ...(args.separateBackground !== undefined ? { separateBackground: args.separateBackground } : {}),
      },
      args.translation === undefined ? SELF_TRANSLATE_DUB_NEXT : undefined,
    );
    return {
      jobId,
      ...approvalField(approval),
      next: 'Dubbing submitted. Use jobs_wait until completed: pipeline.summary.trackId is the dub track, and summary.units says how many sentences were placed and how many were not synthesized; use export for the finished video.',
    };
  }

  async #transcode(args: Args<'transcode'>, principal: ToolPrincipal) {
    if (args.merge && args.extractAudio) throw new ToolError('INVALID_ARGUMENTS', 'Give only one of merge and extractAudio');
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const base = scope.fileBase(access);
    const inputs = args.files.map((file) => resolveUserPath(file, base));
    const outDir = args.outDir !== undefined ? resolveUserPath(args.outDir, base) : undefined;
    const action = args.merge ? 'merge' : args.extractAudio ? 'extract-audio' : 'compress';
    const approval = await scope.confirm(access, {
      tool: 'transcode',
      ...confirmSummary(
        RcFlowTools.transcodeSummary({
          action,
          count: inputs.length,
          files: inputs.slice(0, 3).join(RcFlowTools.listSeparator().text),
          truncated: inputs.length > 3,
          outDir: outDir ?? null,
        }),
      ),
    });
    const jobId = await this.#start(access, TRANSCODE_PIPELINE, args.commandId, {
      inputs,
      action,
      ...(args.codec !== undefined ? { codec: args.codec } : {}),
      ...(args.maxHeight !== undefined ? { maxHeight: args.maxHeight } : {}),
      ...(args.crf !== undefined ? { crf: args.crf } : {}),
      ...(outDir !== undefined ? { outDir } : {}),
    });
    return {
      jobId,
      ...approvalField(approval),
      next: 'Transcode submitted. Use jobs_wait until completed: the paths in outputs (pipeline.summary.files) are the output files; tell the user where they are.',
    };
  }

  /** Starts a pipeline; when no text model is configured, replaces `next` with `selfTranslate` (when given). */
  async #start(
    access: ToolAccess,
    pipeline: string,
    commandId: string | undefined,
    params: Record<string, unknown>,
    selfTranslate?: string,
  ): Promise<string> {
    const { pipelines, scope } = this.#deps;
    try {
      const { jobId } = await pipelines.start(
        { pipeline, params, ...(commandId !== undefined ? { commandId: scope.commandId(access, commandId) } : {}) },
        access.submitter,
      );
      return jobId;
    } catch (error) {
      if (selfTranslate && error instanceof RpcError && isTextNotConfigured(error.details)) {
        const { code, message, ...rest } = errorBody(error);
        throw new ToolError(code, message, { ...rest, next: selfTranslate });
      }
      const mapped = toolErrorOf(error);
      if (mapped instanceof ToolError && mapped.code === 'TRANSCRIPT_EDITED') {
        const next =
          'The user edited this transcript after transcription, and replacing it would discard those edits: use target: new-video (the default) to create another video instead; only when the user confirms discarding the edits, call again with acceptEdited: true.';
        throw new ToolError(mapped.code, mapped.message, { ...mapped.extra, next });
      }
      throw mapped;
    }
  }
}

/** Provider and model for the approval summary (null when not given). */
function providerOf(args: { provider?: string | undefined; model?: string | undefined }): { provider: string | null; model: string | null } {
  return { provider: args.provider ?? null, model: args.model ?? null };
}

function isTextNotConfigured(details: unknown): details is CapabilityNotConfiguredDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { code?: unknown }).code === 'CAPABILITY_NOT_CONFIGURED' &&
    (details as { capability?: unknown }).capability === 'generateText'
  );
}
