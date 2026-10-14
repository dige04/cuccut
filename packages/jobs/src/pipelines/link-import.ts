import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  nowIso,
  type EditOperation,
  type GeneratedOutput,
  type Id,
  type JobRecord,
  type LinkImportParams,
  type LinkImportSummary,
  type PipelineCreateTarget,
} from '@cuccut/protocol';
import { JobsLinkImport } from '@cuccut/protocol/messages/jobs/link-import.ts';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';
import { captionsStep, captionsSummary, type CaptionLayerOutput, type CaptionVideos } from './caption-layer.ts';
import { downloadTranscript } from './download-transcript.ts';
import { probeMedia, type MediaToolResolver } from './ffmpeg.ts';
import { checkLink, checkResolvedHost, redactUrl, systemLookup, type HostLookup } from './link-url.ts';
import type { LinkSources } from './link-sources.ts';
import { ParamReader, invalid } from './params.ts';
import { PipelineStepError, type PipelineDefinition, type PipelineStepContext } from './pipeline.ts';
import { publishFile } from './transcode.ts';
import { createHeldVideo, importMedia, transcribeInVideo, type MediaVideos, type PipelineTranscriber } from './video-create.ts';
import { createScopeOf, readCreateTarget, targetSchema, targetStep, type PipelineTargets } from './video-target.ts';
import {
  COOKIE_BROWSERS,
  linkFailureRemedy,
  type CookieBrowser,
  ProgressTracker,
  classifyFailure,
  cookieAttemptsFailure,
  downloadArgs,
  parseMetadata,
  parseProgressLine,
  resolveArgs,
  runYtDlp,
  sanitizeFileName,
  worthAnotherCookieBrowser,
  type LinkMetadata,
} from './yt-dlp.ts';

/**
 * Import from a link (architecture design §7.9): resolve target → resolve link → download → validate → publish → (when creating a video) create the video → (when a target is given) import into the video →
 * (optional) transcribe.
 *
 * - Parameters are validated and frozen at submission: link normalization and redaction (`link-url.ts`); the original link lives only in `LinkSources`; the download directory is fixed at submission.
 * - The download tool comes from `tool()`: before each step it re-confirms that the tool is installed and that consent is still valid (after withdrawal, retry is also rejected). Refused in strict offline mode.
 * - Browser cookies (`cookieBrowsers`): when resolving the link, they are tried in order; if no cookie can be read or the site still asks for login, the next browser is tried; other failures do not switch. The one used is recorded in the resolve result; the download follows it, and a download failure does not switch browsers again.
 * - The download is written to a fixed place in staging (`<staging>/dl/media.<ext>`). On publish, the file name comes from the title (cleaned) and is checked by real path to fall inside the download directory; existing files are not overwritten. On cancel, the process is killed (the whole process group) and staging is deleted; on failure and interruption it is kept, and on retry yt-dlp resumes from `.part`.
 * - The imported video is link material (the file stays in the download directory). Its source (`origin: 'link-import'`) records the redacted link, the platform metadata, the tool and its version, and the download time.
 * - Target (`target`): `{ videoId }`, `{ entryId }` (resolved by `PipelineRunner` at submission), or `{ create }`. A new video is created after publish; its name defaults to the page title, and it is created in the project directory or the session's source directory (same path as `videos.create`); the pipeline holds its lease. On import, the same transaction puts the material on the main track, starting at 0 and covering the whole media. Once creation has finished, a retry does not create again. When importing into an existing video, if its timeline is still empty (no clips on the root sequence) the material is also put on the main track; if it already has clips, only the material is imported.
 * - Transcription (`transcribe`): language, Provider and model, prompt, speakers and the transcription pipeline (`transcribe.ts`) share the same parameter names. The Provider and model are chosen and frozen at submission. When transcribed into the video, the video's enabled transcription glossary is applied (not applied when started by the external service). When `captions` is on, the caption layer is built too (same step as in the transcription pipeline).
 */

export const LINK_IMPORT_PIPELINE = 'link-import';

/** Extensions accepted for media and subtitle files; other files (the tool's temporary files) are not published. */
const MEDIA_EXTENSIONS = new Set(['mp4', 'm4v', 'mkv', 'webm', 'mov', 'm4a', 'mp3', 'opus', 'ogg', 'oga', 'wav', 'flac', 'aac']);
const SUBTITLE_EXTENSIONS = new Set(['vtt', 'srt', 'ass', 'ssa', 'ttml']);
const MEDIA_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
};
const LANGUAGE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8}){0,3}$/;
/** Upper limit for recognition hints, same as the `hint` of the transcription pipeline. */
const HINT_MAX = 1200;
const PROGRESS_INTERVAL_MS = 250;

/** The download tool used by the pipeline: installed and consent valid; otherwise throws `RpcError('conflict')` (`details.code` is `TOOL_*`). */
export interface LinkImportTool {
  command: string;
  args?: readonly string[];
  version: string;
  source: string;
  env?: NodeJS.ProcessEnv;
}

export interface LinkImportDeps {
  tool(): Promise<LinkImportTool>;
  /**
   * Download directory (absolute path): by default from settings; with `saveTo: 'project'` it is the directory inside the owning project (see `LinkImportParams.saveTo`).
   * A project or session that does not exist gives `not-found`.
   */
  destination(target: { projectId?: Id; conversationId?: Id; videoId?: Id; saveTo?: 'project' }): Promise<string>;
  sources: LinkSources;
  /** For import; `rootSequence` checks whether the existing video's timeline is empty (if so, the material goes on the main track); also used to build the caption layer. */
  videos: MediaVideos & CaptionVideos;
  /** New video (`target.create`). When absent, `create` is rejected. */
  targets?: Pick<PipelineTargets, 'reserve' | 'create'>;
  ffprobe: MediaToolResolver;
  /** The ffmpeg used by yt-dlp to merge audio and video (passed only when explicitly specified); null means yt-dlp finds it on PATH itself. */
  ffmpegLocation?: () => Promise<string | null>;
  offlineStrict(): boolean;
  /** Transcription: config check before submission (`CAPABILITY_NOT_CONFIGURED`), submission and waiting. When absent, `transcribe: true` is rejected. */
  transcribe?: PipelineTranscriber;
  /** The transcription glossary enabled in the video and still in the library at this moment (same as the transcription pipeline); when not given, no glossary is applied. */
  enabledGlossaries?: (videoId: Id) => Promise<Id[]>;
  lookup?: HostLookup;
  /** On publish, try a hard link first (see `publishFile`). */
  hardLink?: boolean;
}

/** Frozen parameters: the link is redacted and the download directory is fixed. */
export interface FrozenLinkImportParams {
  url: string;
  /** Reference to the original link in `LinkSources`; null when normalization did not change the link. */
  sourceRef: string | null;
  host: string;
  projectId?: Id;
  conversationId?: Id;
  videoId?: Id;
  /** New video (`target.create`): in this project's or session's source directory; when no name is given, the page title is used. */
  create?: PipelineCreateTarget;
  /** Browser cookies to try, in order; none when cookies are not used. */
  cookieBrowsers?: CookieBrowser[];
  /** Earlier versions froze a single browser (equivalent to having only that one as `cookieBrowsers`). */
  cookieBrowser?: CookieBrowser;
  transcription?: { providerId: string; modelId: string };
  audioOnly: boolean;
  subtitleLanguages: string[];
  transcribe: boolean;
  /** The transcription's assertion language, prompt and speakers (see `LinkImportParams`); earlier versions did not have these. */
  language?: string;
  hint?: string;
  diarize?: boolean;
  /** Builds the caption layer after transcription; earlier versions did not have it (so none was built). */
  captions?: boolean;
  /** When transcribed into the video, applies the transcription glossary enabled in the video: not applied when the client is started by the external service. Earlier versions did not have it (not applied). */
  videoGlossaries?: boolean;
  outDir: string;
}

/** Validated parameters, not yet frozen (the original link is still present). */
interface CheckedLinkImportParams extends Omit<LinkImportParams, 'target' | 'cookieBrowser'> {
  create?: PipelineCreateTarget;
  raw: string;
  canonical: string;
  host: string;
}

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    // i18n-ignore-start: parameter descriptions (JSON Schema for agents)
    url: { type: 'string', description: 'Link to the video page (http/https)' },
    projectId: { type: 'string', description: 'Project the import belongs to; does not affect the download directory' },
    conversationId: { type: 'string', description: 'Conversation the import belongs to; does not affect the download directory' },
    videoId: { type: 'string', description: 'Import this open video after downloading (same as target: { videoId })' },
    target: targetSchema('Import target: an open video, a video entry in Space, or a new video (placed on the timeline); when omitted, only download', {
      projectId: 'Create in this project',
      conversationId: 'Create in the source directory of this conversation (the project of the conversation when it belongs to one); give this or projectId, not both',
      name: 'Name of the video; defaults to the page title',
    }),
    audioOnly: { type: 'boolean', default: false },
    subtitleLanguages: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Subtitle languages to download alongside' },
    cookieBrowsers: {
      type: 'array',
      items: { type: 'string', enum: COOKIE_BROWSERS },
      uniqueItems: true,
      maxItems: COOKIE_BROWSERS.length,
      description: 'This download tries the login info of these browsers in order: move to the next one when no cookie can be read or the site still asks for login; anonymous when omitted',
    },
    cookieBrowser: { type: 'string', enum: COOKIE_BROWSERS, description: 'Legacy form: use only this one browser, same as cookieBrowsers: [this one]' },
    transcribe: { type: 'boolean', default: false, description: 'Transcribe after downloading; without a video target, save TXT and SRT' },
    language: { type: 'string', description: 'Asserted language of the transcript (BCP 47); auto-detected when omitted. Only give with transcribe' },
    provider: { type: 'string', description: 'Transcription provider; the default when omitted. Only give with transcribe' },
    model: { type: 'string', description: 'Transcription model; the default model of the provider when omitted. Only give with transcribe' },
    hint: { type: 'string', maxLength: HINT_MAX, description: 'Recognition hint (same as hint in models.transcribe; not passed to models that take no hints, and the transcription job records a hint-ignored notice). Only give with transcribe' },
    diarize: { type: 'boolean', description: 'Tell speakers apart; decided by the model when omitted. Only give with transcribe and a video target' },
    captions: { type: 'boolean', default: false, description: 'Create a subtitle layer after transcribing. Only give with transcribe and a video target' },
    saveTo: {
      type: 'string',
      enum: ['downloads', 'project'],
      default: 'downloads',
      description:
        'Where the file goes: downloads is the download directory; project is the downloads/ folder of the owning project (the project of the import or new video); without a project it is still the download directory',
    },
    // i18n-ignore-end
  },
  required: ['url'],
  additionalProperties: false,
};

interface ResolveOutput extends Record<string, unknown> {
  metadata: LinkMetadata;
  tool: { version: string; source: string };
  /** The browser cookie used when resolution succeeded; null when anonymous. Earlier versions did not have it (the first of the frozen parameters was used). */
  cookieBrowser?: CookieBrowser | null;
}

interface DownloadOutput extends Record<string, unknown> {
  media: string;
  subtitles: Array<{ file: string; language: string; ext: string }>;
  tool: { version: string; source: string };
  downloadedAt: string;
}

interface VerifyOutput extends Record<string, unknown> {
  media: GeneratedOutput['media'];
}

interface PublishOutput extends Record<string, unknown> {
  media: string;
  subtitles: string[];
  output: GeneratedOutput;
}

interface CreateOutput extends Record<string, unknown> {
  videoId: Id;
  place: Record<string, unknown>;
}

interface ImportOutput extends Record<string, unknown> {
  assetId: Id;
}

interface TranscribeOutput extends Record<string, unknown> {
  jobId: Id;
  /** The transcript written when transcribed into the video; earlier versions did not have it. */
  documentId?: Id | null;
  files?: string[];
  outputs?: GeneratedOutput[];
}

export function linkImportPipeline(deps: LinkImportDeps): PipelineDefinition<FrozenLinkImportParams, CheckedLinkImportParams> {
  const lookup = deps.lookup ?? systemLookup;

  const requireOnline = () => {
    if (deps.offlineStrict()) throw new RpcError('conflict', JobsLinkImport.offlineStrict(), { code: 'OFFLINE_STRICT' });
  };

  return {
    name: LINK_IMPORT_PIPELINE,
    label: () => JobsLinkImport.label(),
    description: () => JobsLinkImport.description(),
    paramsSchema: PARAMS_SCHEMA,
    target: { create: { media: false } },
    parse: parseLinkImportParams,
    async prepare(params, { retry, submitter }) {
      requireOnline();
      const tool = await deps.tool();
      if (params.create && !deps.targets) {
        throw new RpcError('invalid-request', JobsLinkImport.cannotCreateVideo(), { code: 'PIPELINE_TARGET_UNSUPPORTED' });
      }
      let transcription;
      if (params.transcribe) {
        if (!deps.transcribe) throw new RpcError('conflict', JobsLinkImport.cannotTranscribe(), { code: 'CAPABILITY_NOT_CONFIGURED' });
        if (!params.videoId && !params.create && !deps.transcribe.submitFile) throw new RpcError('conflict', JobsLinkImport.fileTranscribeUnavailable(), { code: 'CAPABILITY_NOT_CONFIGURED' });
        // On retry, the frozen selection is used; on first submission, the given Provider and model are used (defaults when not given).
        const frozenSelection = retry ? (params as FrozenLinkImportParams).transcription : undefined;
        const given: { provider?: string; model?: string } = retry ? {} : (params as CheckedLinkImportParams);
        transcription = await deps.transcribe.check(
          frozenSelection
            ? { provider: frozenSelection.providerId, model: frozenSelection.modelId }
            : given.provider !== undefined || given.model !== undefined
              ? {
                  ...(given.provider !== undefined ? { provider: given.provider } : {}),
                  ...(given.model !== undefined ? { model: given.model } : {}),
                }
              : undefined,
        );
      }
      if (params.videoId !== undefined && !deps.videos.state(params.videoId)) throw new RpcError('not-found', JobsLinkImport.videoNotOpen());
      await checkResolvedHost(params.host, lookup);
      let frozen: FrozenLinkImportParams;
      if (retry) {
        frozen = params as FrozenLinkImportParams;
        if (frozen.sourceRef && !(await deps.sources.get(frozen.sourceRef))) {
          throw new RpcError('conflict', JobsLinkImport.sourceExpired(), { code: 'LINK_SOURCE_EXPIRED' });
        }
      } else {
        const checked = params as CheckedLinkImportParams;
        const projectId = checked.create ? checked.create.projectId : checked.projectId;
        const conversationId = checked.create ? checked.create.conversationId : checked.conversationId;
        const outDir = await deps.destination({
          ...(projectId !== undefined ? { projectId } : {}),
          ...(conversationId !== undefined ? { conversationId } : {}),
          ...(checked.videoId !== undefined ? { videoId: checked.videoId } : {}),
          ...(checked.saveTo === 'project' ? { saveTo: 'project' as const } : {}),
        });
        const sourceRef = checked.raw === checked.canonical ? null : `sha256:${sha256Hex(checked.raw)}`;
        frozen = {
          url: checked.canonical,
          sourceRef,
          host: checked.host,
          ...(checked.projectId !== undefined ? { projectId: checked.projectId } : {}),
          ...(checked.conversationId !== undefined ? { conversationId: checked.conversationId } : {}),
          ...(checked.videoId !== undefined ? { videoId: checked.videoId } : {}),
          ...(checked.create ? { create: checked.create } : {}),
          ...(checked.cookieBrowsers?.length ? { cookieBrowsers: checked.cookieBrowsers } : {}),
          ...(transcription ? { transcription } : {}),
          audioOnly: checked.audioOnly ?? false,
          subtitleLanguages: checked.subtitleLanguages ?? [],
          transcribe: checked.transcribe ?? false,
          ...(checked.language !== undefined ? { language: checked.language } : {}),
          ...(checked.hint !== undefined ? { hint: checked.hint } : {}),
          ...(checked.diarize !== undefined ? { diarize: checked.diarize } : {}),
          ...(checked.captions ? { captions: true } : {}),
          ...(checked.transcribe && submitter?.kind !== 'service' ? { videoGlossaries: true } : {}),
          outDir,
        };
        // Written last: if the earlier checks fail, the original link is not left behind.
        if (sourceRef) await deps.sources.put(sourceRef, checked.raw);
      }
      return {
        params: frozen,
        providerId: 'yt-dlp',
        modelId: tool.version,
        videoId: frozen.videoId ?? null,
        contentHash: `sha256:${sha256Hex(canonicalJson({ url: frozen.url, sourceRef: frozen.sourceRef }))}`,
      };
    },
    steps: [
      targetStep(),
      {
        name: 'resolve',
        label: () => JobsLinkImport.stepResolve(),
        run: async ({ params, signal, progress }) => {
          requireOnline();
          progress(null, 'probing');
          const tool = await deps.tool();
          const url = await rawUrl(deps, params);
          const browsers = cookieBrowsersOf(params);
          const attempts: Array<{ browser: CookieBrowser; error: PipelineStepError }> = [];
          for (const browser of browsers.length > 0 ? browsers : [null]) {
            const run = await runYtDlp(tool, resolveArgs(url, browser ?? undefined), { signal, keepStdout: true });
            if (run.code === 0) {
              const metadata = parseMetadata(run.stdout);
              if (metadata.webpageUrl) metadata.webpageUrl = redactUrl(metadata.webpageUrl);
              return { output: { metadata, tool: { version: tool.version, source: tool.source }, cookieBrowser: browser } satisfies ResolveOutput };
            }
            const error = classifyFailure(run.stderr, run.code);
            if (browser === null || !worthAnotherCookieBrowser(error)) throw error;
            attempts.push({ browser, error });
          }
          throw cookieAttemptsFailure(attempts);
        },
      },
      {
        name: 'download',
        label: () => JobsLinkImport.stepDownload(),
        run: (context) => download(deps, context, requireOnline),
        reusable: async (output, { staging }) => {
          const out = output as DownloadOutput;
          for (const file of [out.media, ...out.subtitles.map((s) => s.file)]) {
            if (!isInside(file, staging) || !(await fs.stat(file).catch(() => null))) return false;
          }
          return true;
        },
      },
      {
        name: 'verify',
        label: () => JobsLinkImport.stepVerify(),
        // Read once with ffprobe (the same one the engine uses to import material). If ffprobe is not found, it fails with `MEDIA_TOOL_UNAVAILABLE`; the validation is not skipped.
        run: async ({ outputs, signal, progress }) => {
          const downloaded = outputs.download as DownloadOutput;
          progress(null, 'validating');
          let probed;
          try {
            probed = await probeMedia(deps.ffprobe, downloaded.media, signal);
          } catch (error) {
            if (error instanceof PipelineStepError && error.code === 'INPUT_UNREADABLE') {
              throw new PipelineStepError('LINK_DOWNLOAD_UNREADABLE', JobsLinkImport.undecodable(), {
                remedy: JobsLinkImport.undecodableRemedy().text,
              });
            }
            throw error;
          }
          if (!probed.video && !probed.audio) {
            throw new PipelineStepError('LINK_DOWNLOAD_UNREADABLE', JobsLinkImport.noStreams(), {
              remedy: JobsLinkImport.undecodableRemedy().text,
            });
          }
          const media: GeneratedOutput['media'] = probed.video
            ? {
                kind: 'video',
                durationSec: probed.durationSec,
                width: probed.video.width,
                height: probed.video.height,
                videoCodec: probed.video.codec,
                audioCodec: probed.audio?.codec ?? null,
              }
            : { kind: 'audio', durationSec: probed.durationSec, sampleRate: probed.audio!.sampleRate, channels: probed.audio!.channels };
          return { output: { media } satisfies VerifyOutput };
        },
      },
      {
        name: 'publish',
        label: () => JobsLinkImport.stepPublish(),
        run: (context) => publish(deps, context),
        reusable: async (output) => {
          const out = output as PublishOutput;
          for (const file of [out.media, ...out.subtitles]) if (!(await fs.stat(file).catch(() => null))) return false;
          return true;
        },
      },
      {
        name: 'create',
        label: () => JobsLinkImport.stepCreate(),
        holdsVideo: true,
        when: (params) => params.create !== undefined,
        run: (context) => createVideo(deps, context),
      },
      {
        name: 'import',
        label: () => JobsLinkImport.stepImport(),
        when: (params) => params.videoId !== undefined || params.create !== undefined,
        run: (context) => importIntoVideo(deps, context),
      },
      {
        name: 'transcribe',
        label: () => JobsLinkImport.stepTranscribe(),
        when: (params) => params.transcribe,
        run: (context) => transcribe(deps, context),
      },
      captionsStep<FrozenLinkImportParams>(deps.videos, {
        pipeline: LINK_IMPORT_PIPELINE,
        enabled: (params) => params.captions === true,
        videoId: (params, outputs) => (outputs.import ? targetVideo(params, outputs) : null),
        source: (_params, outputs) => {
          const documentId = (outputs.transcribe as TranscribeOutput | undefined)?.documentId;
          return documentId ? { kind: 'speech', documentId } : null;
        },
      }),
    ],
    async complete({ params, outputs }) {
      const resolved = outputs.resolve as ResolveOutput;
      const downloaded = outputs.download as DownloadOutput;
      const published = outputs.publish as PublishOutput;
      const imported = (outputs.import as ImportOutput | null) ?? null;
      const created = (outputs.create as CreateOutput | null) ?? null;
      const transcribed = (outputs.transcribe as TranscribeOutput | null) ?? null;
      const summaryVideo = params.videoId ?? created?.videoId ?? null;
      if (params.sourceRef) await deps.sources.delete(params.sourceRef);
      const summary: LinkImportSummary = {
        url: params.url,
        title: resolved.metadata.title,
        platform: resolved.metadata.platform,
        uploader: resolved.metadata.uploader,
        durationSec: resolved.metadata.durationSec,
        description: summaryDescription(resolved.metadata.description),
        sourceChapters: resolved.metadata.chapters?.length ?? 0,
        files: { media: published.media, subtitles: published.subtitles },
        tool: { name: 'yt-dlp', version: downloaded.tool.version, source: downloaded.tool.source },
        cookieBrowser: usedCookieBrowser(params, resolved),
        downloadedAt: downloaded.downloadedAt,
        videoId: params.videoId ?? created?.videoId ?? null,
        assetId: imported?.assetId ?? null,
        createdVideo: created !== null,
        transcribeJobId: transcribed?.jobId ?? null,
        ...(transcribed?.files ? { transcriptFiles: transcribed.files } : {}),
        ...(transcribed && !transcribed.files ? { documentId: transcribed.documentId ?? null } : {}),
        ...(params.captions && transcribed?.documentId && summaryVideo
          ? {
              captions: captionsSummary(
                deps.videos,
                true,
                (outputs.captions as CaptionLayerOutput | undefined) ?? null,
                summaryVideo,
                transcribed.documentId,
              ),
            }
          : {}),
      };
      const output = { ...published.output, assetId: imported?.assetId ?? null };
      return { summary: { ...summary }, result: { documentId: null, artifactId: output.artifactId, outputs: [output, ...(transcribed?.outputs ?? [])] } };
    },
  };
}

export function parseLinkImportParams(raw: Record<string, unknown>): CheckedLinkImportParams {
  const reader = new ParamReader(raw, [
    'url',
    'projectId',
    'conversationId',
    'videoId',
    'target',
    'audioOnly',
    'subtitleLanguages',
    'transcribe',
    'cookieBrowsers',
    'cookieBrowser',
    'saveTo',
    'language',
    'provider',
    'model',
    'hint',
    'diarize',
    'captions',
  ]);
  const url = reader.string('url', { max: 4096 });
  const checked = checkLink(url);
  const projectId = reader.string('projectId', { max: 200, optional: true });
  const conversationId = reader.string('conversationId', { max: 200, optional: true });
  const videoId = reader.string('videoId', { max: 200, optional: true });
  const audioOnly = bool(raw, 'audioOnly');
  const transcribe = bool(raw, 'transcribe');
  const cookieBrowser = reader.string('cookieBrowser', { optional: true }) as CookieBrowser | undefined;
  if (cookieBrowser !== undefined && !COOKIE_BROWSERS.includes(cookieBrowser)) throw invalid('cookieBrowser', JobsLinkImport.unsupportedBrowser());
  const browserList = reader.array('cookieBrowsers', { max: COOKIE_BROWSERS.length, optional: true });
  if (browserList !== undefined && cookieBrowser !== undefined) throw invalid('cookieBrowsers', JobsParams.onlyOneOf({ other: 'cookieBrowser' }));
  const cookieBrowsers = browserList?.map((browser) => {
    if (typeof browser !== 'string' || !COOKIE_BROWSERS.includes(browser as CookieBrowser)) throw invalid('cookieBrowsers', JobsLinkImport.browserItems());
    return browser as CookieBrowser;
  }) ?? (cookieBrowser !== undefined ? [cookieBrowser] : undefined);
  if (cookieBrowsers && new Set(cookieBrowsers).size !== cookieBrowsers.length) throw invalid('cookieBrowsers', JobsLinkImport.noDuplicates());
  const saveTo = reader.string('saveTo', { optional: true });
  if (saveTo !== undefined && saveTo !== 'downloads' && saveTo !== 'project') throw invalid('saveTo', JobsLinkImport.saveToInvalid());
  const languages = reader.array('subtitleLanguages', { max: 10, optional: true });
  const subtitleLanguages = languages?.map((lang) => {
    if (typeof lang !== 'string' || !LANGUAGE.test(lang)) throw invalid('subtitleLanguages', JobsLinkImport.languageItems());
    return lang;
  });
  // Targets `{ videoId }` and `{ entryId }` were swapped for the top-level `videoId` by PipelineRunner; only creation remains here.
  const create = raw.target === undefined ? undefined : createOf(raw.target);
  // Transcription parameters: given only together with transcribe; speakers and the caption layer need a video.
  const language = reader.string('language', { max: 35, optional: true });
  if (language !== undefined && !LANGUAGE.test(language)) throw invalid('language', JobsLinkImport.languageTag());
  const provider = reader.string('provider', { max: 200, optional: true });
  const model = reader.string('model', { max: 200, optional: true });
  const hint = reader.string('hint', { max: HINT_MAX, optional: true })?.trim();
  const diarize = bool(raw, 'diarize');
  const captions = bool(raw, 'captions');
  const recognition = { language, provider, model, hint, diarize, captions };
  if (!transcribe) {
    const given = Object.entries(recognition).find(([, value]) => value !== undefined);
    if (given) throw invalid(given[0], JobsLinkImport.requiresTranscribe());
  }
  if (videoId === undefined && !create) {
    if (diarize !== undefined) throw invalid('diarize', JobsLinkImport.noVideoDiarize());
    if (captions !== undefined) throw invalid('captions', JobsLinkImport.noVideoCaptions());
  }
  if (create && videoId !== undefined) throw invalid('target', JobsParams.createExcludesVideoId());
  // When creating a video, the top-level project or session may be omitted; if given, it must match the one the new video is in.
  if (create && projectId !== undefined && projectId !== create.projectId) throw invalid('projectId', JobsLinkImport.projectMismatch());
  if (create && conversationId !== undefined && conversationId !== create.conversationId) {
    throw invalid('conversationId', JobsLinkImport.conversationMismatch());
  }
  if (projectId !== undefined && conversationId !== undefined) throw invalid('conversationId', JobsParams.onlyOneOf({ other: 'projectId' }));
  return {
    url: checked.canonical,
    raw: checked.raw,
    canonical: checked.canonical,
    host: checked.host,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(conversationId !== undefined ? { conversationId } : {}),
    ...(videoId !== undefined ? { videoId } : {}),
    ...(create ? { create } : {}),
    ...(audioOnly !== undefined ? { audioOnly } : {}),
    ...(subtitleLanguages !== undefined ? { subtitleLanguages } : {}),
    ...(transcribe !== undefined ? { transcribe } : {}),
    ...(language !== undefined ? { language } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(hint ? { hint } : {}),
    ...(diarize !== undefined ? { diarize } : {}),
    ...(captions !== undefined ? { captions } : {}),
    ...(cookieBrowsers?.length ? { cookieBrowsers } : {}),
    ...(saveTo !== undefined ? { saveTo: saveTo as 'downloads' | 'project' } : {}),
  };
}

/** Browsers to try in order, from the frozen parameters. Earlier versions had only one `cookieBrowser`. Empty when cookies are not used. */
function cookieBrowsersOf(params: FrozenLinkImportParams): CookieBrowser[] {
  return params.cookieBrowsers ?? (params.cookieBrowser ? [params.cookieBrowser] : []);
}

/** The browser used: recorded in the resolve result. Earlier versions did not record it, so the first of the frozen parameters is used. */
function usedCookieBrowser(params: FrozenLinkImportParams, resolved: ResolveOutput): CookieBrowser | null {
  return resolved.cookieBrowser !== undefined ? resolved.cookieBrowser : (cookieBrowsersOf(params)[0] ?? null);
}

function createOf(target: unknown): PipelineCreateTarget {
  if (typeof target !== 'object' || target === null || Array.isArray(target) || Object.keys(target).join() !== 'create') {
    throw invalid('target', JobsParams.targetShape());
  }
  return readCreateTarget((target as { create: unknown }).create, false);
}

function bool(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalid(key, JobsParams.mustBeBoolean());
  return value;
}

async function rawUrl(deps: LinkImportDeps, params: FrozenLinkImportParams): Promise<string> {
  if (!params.sourceRef) return params.url;
  const raw = await deps.sources.get(params.sourceRef);
  if (!raw) throw new PipelineStepError('LINK_SOURCE_EXPIRED', JobsLinkImport.sourceExpired(), {});
  return raw;
}

async function download(
  deps: LinkImportDeps,
  { params, outputs, signal, progress, staging }: PipelineStepContext<FrozenLinkImportParams>,
  requireOnline: () => void,
): Promise<{ output: DownloadOutput }> {
  requireOnline();
  const tool = await deps.tool();
  const url = await rawUrl(deps, params);
  const dir = path.join(staging, 'dl');
  await fs.mkdir(dir, { recursive: true });
  const ffmpegLocation = (await deps.ffmpegLocation?.()) ?? null;
  const cookieBrowser = usedCookieBrowser(params, outputs.resolve as ResolveOutput);
  const args = downloadArgs(url, {
    output: path.join(dir, 'media.%(ext)s'),
    audioOnly: params.audioOnly,
    subtitleLanguages: params.subtitleLanguages,
    ffmpegLocation,
    ...(cookieBrowser ? { cookieBrowser } : {}),
  });
  const tracker = new ProgressTracker();
  let last = 0;
  progress(null, 'downloading');
  const run = await runYtDlp(tool, args, {
    signal,
    onLine: (line) => {
      const sample = parseProgressLine(line);
      if (!sample) return;
      const now = Date.now();
      const value = tracker.update(sample);
      if (now - last < PROGRESS_INTERVAL_MS) return;
      last = now;
      progress({ done: value.done, total: value.total, unit: 'bytes' }, 'downloading');
    },
  });
  if (run.code !== 0) throw classifyFailure(run.stderr, run.code);
  const files = await collectDownloads(dir);
  if (!files.media) {
    throw new PipelineStepError('LINK_DOWNLOAD_FAILED', JobsLinkImport.noMediaFile(), { remedy: linkFailureRemedy('LINK_DOWNLOAD_FAILED') });
  }
  const output: DownloadOutput = {
    media: files.media,
    subtitles: files.subtitles,
    tool: { version: tool.version, source: tool.source },
    downloadedAt: nowIso(),
  };
  return { output };
}

/** The file downloaded into staging: only a regular file is accepted (symbolic links are not followed), with a fixed name and an allowed extension; the real path is inside staging. */
async function collectDownloads(dir: string): Promise<{ media: string | null; subtitles: DownloadOutput['subtitles'] }> {
  const real = await fs.realpath(dir);
  let media: string | null = null;
  const subtitles: DownloadOutput['subtitles'] = [];
  for (const name of (await fs.readdir(dir)).sort()) {
    const file = path.join(dir, name);
    const stat = await fs.lstat(file);
    if (!stat.isFile()) continue;
    if (!isInside(await fs.realpath(file), real)) continue;
    const match = /^media\.(?:([A-Za-z0-9_-]{1,32})\.)?([a-z0-9]{2,5})$/.exec(name);
    if (!match) continue;
    const [, language, ext] = match;
    if (!language && MEDIA_EXTENSIONS.has(ext!)) {
      // After merging only one remains; if there are several (when there was no ffmpeg merge), the largest is taken.
      if (!media || stat.size > (await fs.stat(media)).size) media = file;
    } else if (language && SUBTITLE_EXTENSIONS.has(ext!)) {
      subtitles.push({ file, language, ext: ext! });
    }
  }
  return { media, subtitles };
}

async function publish(
  deps: LinkImportDeps,
  { params, outputs, progress, jobId, signal }: PipelineStepContext<FrozenLinkImportParams>,
): Promise<{ output: PublishOutput; result: NonNullable<JobRecord['result']> }> {
  const resolved = outputs.resolve as ResolveOutput;
  const downloaded = outputs.download as DownloadOutput;
  const verified = outputs.verify as VerifyOutput;
  progress(null, 'publishing');
  try {
    await fs.mkdir(params.outDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOSPC') throw diskFull();
    throw new PipelineStepError('LINK_DESTINATION_UNAVAILABLE', JobsLinkImport.destinationUnwritable({ dir: params.outDir }), {
      remedy: JobsLinkImport.destinationRemedy().text,
    });
  }
  const realDir = await fs.realpath(params.outDir);
  const stem = sanitizeFileName(resolved.metadata.title ?? resolved.metadata.mediaId);
  const ext = path.extname(downloaded.media);
  const hardLink = deps.hardLink ?? true;
  const placed: string[] = [];
  const place = async (source: string, name: string, extension: string): Promise<string> => {
    signal.throwIfAborted();
    let file: string;
    try {
      file = await publishFile(source, realDir, name, extension, jobId, hardLink);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOSPC') throw diskFull();
      throw error;
    }
    placed.push(file);
    if (!isInside(await fs.realpath(file), realDir)) {
      await fs.rm(file, { force: true });
      throw new PipelineStepError('LINK_DESTINATION_UNAVAILABLE', JobsLinkImport.publishedOutside(), {});
    }
    return file;
  };
  try {
    const media = await place(downloaded.media, stem, ext);
    const base = path.basename(media, ext);
    const subtitles: string[] = [];
    for (const sub of downloaded.subtitles) subtitles.push(await place(sub.file, `${base}.${sub.language}`, `.${sub.ext}`));
    const { size, digest } = await digestFile(media);
    const output: GeneratedOutput = {
      artifactId: `sha256:${digest}`,
      mediaType: MEDIA_TYPES[ext.slice(1)] ?? 'application/octet-stream',
      byteLength: size,
      assetId: null,
      media: verified.media,
      path: media,
    };
    return { output: { media, subtitles, output }, result: { documentId: null, artifactId: output.artifactId, outputs: [output] } };
  } catch (error) {
    for (const file of placed) await fs.rm(file, { force: true }).catch(() => {});
    throw error;
  }
}

/** New video (`target.create`): created in the project's or session's source directory and handed to the pipeline to hold. When no name is given, the page title is used; if there is none, the downloaded file name. */
async function createVideo(deps: LinkImportDeps, context: PipelineStepContext<FrozenLinkImportParams>): Promise<{ output: CreateOutput }> {
  const { params, outputs, progress } = context;
  const create = params.create!;
  if (!deps.targets) throw new PipelineStepError('PIPELINE_TARGET_UNSUPPORTED', JobsLinkImport.cannotCreateVideo(), {});
  const resolved = outputs.resolve as ResolveOutput;
  const published = outputs.publish as PublishOutput;
  progress(null, 'applying');
  const name = create.name ?? resolved.metadata.title?.trim() ?? path.basename(published.media, path.extname(published.media));
  const lease = await createHeldVideo(deps.targets, context, {
    ...createScopeOf(create),
    name: name || path.basename(published.media),
  });
  return { output: { videoId: lease.videoId, place: lease.place } };
}

/** The video to import into: either the given one (`videoId`) or the one created this time. */
function targetVideo(params: FrozenLinkImportParams, outputs: PipelineStepContext<FrozenLinkImportParams>['outputs']): Id {
  return params.videoId ?? (outputs.create as CreateOutput).videoId;
}

async function importIntoVideo(
  deps: LinkImportDeps,
  context: PipelineStepContext<FrozenLinkImportParams>,
): Promise<{ output: ImportOutput }> {
  const { params, outputs, parentJobId, progress } = context;
  const resolved = outputs.resolve as ResolveOutput;
  const downloaded = outputs.download as DownloadOutput;
  const published = outputs.publish as PublishOutput;
  progress(null, 'applying');
  // For a newly created video, the same transaction puts the material on the main track (the first track of its kind), starting at 0 and covering the whole media. It is also placed when an existing video's timeline is still empty (the external service calls `videos_create` first and then downloads into it, architecture design §4.8); when it already has clips, only the material is imported.
  const { assetId } = await importMedia(deps.videos, context, {
    videoId: targetVideo(params, outputs),
    file: published.media,
    name: resolved.metadata.title ?? path.basename(published.media),
    place: params.create !== undefined ? true : 'if-empty',
    label: JobsLinkImport.label().text,
    provenance: linkImportProvenance(params.url, resolved.metadata, downloaded, parentJobId),
  });
  return { output: { assetId } };
}

/** Maximum number of characters of the description kept in the summary (the full one is in the material's source). */
const SUMMARY_DESCRIPTION_CHARS = 1200;

/** The description in the summary: cut to 1200 characters (counted by code point; an ellipsis is added at the end when cut); null when there is none. */
function summaryDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const chars = [...description];
  return chars.length <= SUMMARY_DESCRIPTION_CHARS ? description : `${chars.slice(0, SUMMARY_DESCRIPTION_CHARS).join('')}…`;
}

/** The source of the downloaded material (video format spec §4.5): the pipeline's own import and the import later recorded per artifact (`linkImportAssetOperation`) write exactly the same thing. */
function linkImportProvenance(
  url: string,
  meta: LinkMetadata,
  downloaded: Pick<DownloadOutput, 'tool' | 'downloadedAt'>,
  jobId: Id,
): { origin: string; source: Record<string, unknown> } {
  return {
    origin: 'link-import',
    source: {
      url,
      webpageUrl: meta.webpageUrl,
      platform: meta.platform,
      mediaId: meta.mediaId,
      title: meta.title,
      uploader: meta.uploader,
      uploadDate: meta.uploadDate,
      durationSec: meta.durationSec,
      // The description and platform chapters: polishing, speaker recognition and adopting source chapters (`chapters_adopt`) read them. Earlier run records do not have them; when absent, nothing is written.
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.chapters?.length ? { chapters: meta.chapters } : {}),
      tool: { name: 'yt-dlp', version: downloaded.tool.version, source: downloaded.tool.source },
      downloadedAt: downloaded.downloadedAt,
      jobId,
    },
  };
}

/**
 * The single operation that imports downloaded media into a video, per artifact, after a link import that had no video target (download only) (the agent, via `edits_apply`'s `importAsset` + `artifactId`). The bytes are taken into the video directory (`managed`), the same as generated artifacts: afterwards, if the user moves or deletes the file in the download directory, the video is not affected. The source is the same as when the pipeline imports by itself (`origin: 'link-import'`, with this run). `file` is the file whose content was checked (`locateArtifact`). Null when it is not a record of this pipeline, or when the artifact is not media this pipeline downloaded (for example, a transcript).
 */
export function linkImportAssetOperation(
  record: JobRecord,
  output: { artifactId: string; file: string },
  options: { name?: string; ref?: string } = {},
): EditOperation | null {
  const run = record.pipeline;
  if (record.kind !== 'pipeline' || run?.name !== LINK_IMPORT_PIPELINE) return null;
  const step = (name: string) => run.steps.find((s) => s.name === name && s.status === 'completed')?.output ?? null;
  const resolved = step('resolve') as ResolveOutput | null;
  const downloaded = step('download') as DownloadOutput | null;
  const published = step('publish') as PublishOutput | null;
  if (!resolved || !downloaded || !published || published.output.artifactId !== output.artifactId) return null;
  const url = typeof run.params.url === 'string' ? run.params.url : '';
  return {
    type: 'importAsset',
    path: output.file,
    name: options.name ?? resolved.metadata.title ?? path.basename(published.media),
    ...(options.ref !== undefined ? { ref: options.ref } : {}),
    storage: 'managed',
    provenance: linkImportProvenance(url, resolved.metadata, downloaded, record.jobId),
  };
}

async function transcribe(
  deps: LinkImportDeps,
  context: PipelineStepContext<FrozenLinkImportParams>,
): Promise<{ output: TranscribeOutput }> {
  const jobs = deps.transcribe;
  if (!jobs) throw new PipelineStepError('CAPABILITY_NOT_CONFIGURED', JobsLinkImport.cannotTranscribe(), {});
  const { params, outputs } = context;
  if (!params.videoId && !params.create) {
    return { output: await downloadTranscript(jobs, context, {
      file: (outputs.publish as PublishOutput).media, directory: path.dirname((outputs.publish as PublishOutput).media),
      ...(params.transcription ? { provider: params.transcription.providerId, model: params.transcription.modelId } : {}),
      ...(params.language !== undefined ? { language: params.language } : {}),
      ...(params.hint !== undefined ? { hint: params.hint } : {}),
    }) };
  }
  const assetId = (outputs.import as ImportOutput).assetId;
  const videoId = targetVideo(params, outputs);
  // The transcription glossary enabled in the video (§5.9): read when transcription is submitted, the same as in the transcription pipeline; the version is frozen by the transcription Job.
  const glossaries = params.videoGlossaries && deps.enabledGlossaries ? await deps.enabledGlossaries(videoId) : [];
  const { jobId, documentId } = await transcribeInVideo(jobs, context, {
    videoId,
    assetId,
    ...(params.transcription ? { provider: params.transcription.providerId, model: params.transcription.modelId } : {}),
    ...(params.language !== undefined ? { language: { mode: 'assert' as const, tag: params.language } } : {}),
    ...(params.hint !== undefined ? { hint: params.hint } : {}),
    ...(params.diarize !== undefined ? { diarize: params.diarize } : {}),
    ...(glossaries.length ? { glossaries: glossaries.map((id) => ({ id })) } : {}),
  });
  if (params.captions && !documentId) throw new PipelineStepError('APPLY_FAILED', JobsLinkImport.notWrittenToVideo(), { jobId });
  return { output: { jobId, documentId } };
}

function diskFull(): PipelineStepError {
  return new PipelineStepError('LINK_DISK_FULL', JobsLinkImport.diskFull(), { remedy: linkFailureRemedy('LINK_DISK_FULL') });
}

function isInside(file: string, dir: string): boolean {
  const relative = path.relative(dir, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function digestFile(file: string): Promise<{ size: number; digest: string }> {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk as Buffer);
    size += (chunk as Buffer).length;
  }
  return { size, digest: hash.digest('hex') };
}
