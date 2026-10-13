import { z } from 'zod';
import { LINK_IMPORT_PIPELINE, checkLink, isTerminal, type JobManager, type PipelineRunner } from '@cuccut/jobs';
import { RpcError, type ExternalToolStatus, type Id, type JobRecord, type PipelineVideoTarget } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { ExternalToolService } from '../external-tools/external-tool-service.ts';
import { YT_DLP } from '../external-tools/tool-manifests.ts';
import { isGrantErrorDetails } from '../grants/grant-errors.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { commandIdArg, videoArg } from './video-tools.ts';

/**
 * Downloading from a link (architecture design §7.9, §12.9; agent surface design §4.2): one tool, `download`, which takes one of
 * three confirmations depending on the tool's current state. `transcribe` given a `url` goes through the same path
 * (`startLinkImport`).
 *
 * - yt-dlp installed and consent valid: confirmed as `download` (`command`), then the `link-import` pipeline starts.
 * - Not installed (or too old): confirmed as `external_tools_install` (`high`), with source, version, size and license in the
 *   summary; when the user agrees, consent is recorded and an install job submitted, and the install job id is returned. Once
 *   installed, the agent calls again.
 * - Installed but no consent (or consent revoked): confirmed as `external_tools_consent` (`high`); after consent the pipeline
 *   starts directly without asking a second time.
 *
 * The three approvals use different tool names: "Allow for this session" is stored by tool name, so allowing a download is not
 * allowing an install. In strict offline mode, with an incomplete manifest, or when the user-specified path is unusable, no
 * confirmation is shown; the call is refused outright with a remedy.
 *
 * One of three destinations (with none, it only downloads to the downloads directory):
 *
 * - `video`: import into an existing video in scope (a linked asset); if its timeline is still empty it is also placed on the
 *   main track (an external service first calls `videos_create`, then downloads into it);
 * - `newVideo`: create a new video and place it on the timeline, in the same place as `videos_create` (`project`; defaults to
 *   the session's project or the session's working directory, or the project found from cwd in a terminal), visible afterwards
 *   to `videos_list` and `videos_inspect`; creating a video does not raise the risk (`edit` is below the download's `command`);
 * - `project`: download only, with the files put into that project.
 *
 * Where files go: as in the UI and CLI, by default into the downloads directory (setting `downloads.directory`, defaulting to
 * the host's Downloads folder); `video` and `newVideo` import assets linked there; with only `project`, into that project's
 * `downloads/` (the pipeline's `saveTo: 'project'`). An external service can only write into projects, so its destinations
 * always go into the owning project's `downloads/`. When the owner is a session without a project, files still go to the
 * downloads directory (the user cannot see the session's working directory). With no destination and `transcribe` true, TXT
 * and SRT transcripts are generated next to the media; the media's `artifactId` from the result can later be imported into a
 * video through `edits_apply`'s `importAsset`.
 *
 * For an external service (MCP, §4.8, §12.8, §12.9) the destination can only be an in-scope `video` or a registered `project`:
 * `newVideo` requires `project` too (as `videos_create` does), and the video the pipeline creates is added to the service's
 * scope as soon as it appears (the parent job records `videoId`) (`ToolScope.adoptCreatedVideo`; unchanged when the scope is all
 * videos), becoming visible to `videos_list` and `videos_inspect`; no destination, or `newVideo` without `project`, is refused
 * with `INVALID_ARGUMENTS`. If yt-dlp is not installed or the user has not consented, the call is refused outright, with no
 * install or consent on the user's behalf (downloading and running a third-party program is the user's decision in CucCut).
 *
 * `transcribe` given a `url` also carries transcription arguments (language, provider and model, hint, speakers) and
 * `captions` (create a caption layer after transcribing), passed to the pipeline as is; `download` carries none of them, so
 * transcription uses defaults and creates no caption layer.
 */

export interface LinkImportToolsDeps {
  tools: ExternalToolService;
  pipelines: PipelineRunner;
  /** Job changes: when an external service creates a video, wait for the parent job to record `videoId` and add it to the service's scope. */
  jobs: Pick<JobManager, 'onChange' | 'inspect'>;
  offlineStrict: () => boolean;
  scope: ToolScope;
}

/** One download-from-link request (`download`'s arguments, or assembled by `transcribe` when given a `url`). */
export interface LinkImportRequest {
  url: string;
  video?: string | undefined;
  newVideo?: boolean | undefined;
  project?: string | undefined;
  name?: string | undefined;
  audioOnly?: boolean | undefined;
  subtitleLanguages?: string[] | undefined;
  transcribe?: boolean | undefined;
  /** Transcription arguments (when `transcribe` is given a `url`); `download` has none. */
  language?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  hint?: string | undefined;
  diarize?: boolean | undefined;
  /** Create a caption layer after transcribing (when `transcribe` is given a `url` and creates a new video). */
  captions?: boolean | undefined;
  commandId?: string | undefined;
}

const schemas = {
  download: z.strictObject({
    url: z.string().min(1).max(4000).describe('Link to the video page (http or https). Single videos only, not playlists'),
    project: z
      .string()
      .min(1)
      .max(1000)
      .optional()
      .describe(
        'Optional. Project (a project id or the path of a registered project directory): given alone, it only downloads, putting the files in this project\'s downloads/; given with newVideo, it is the project for the new video. In a session it can only be the session\'s own project',
      ),
    video: videoArg
      .optional()
      .describe(
        'Optional. After downloading, import into this existing video (a path or videoId from videos_list), also placing it on the main track if the timeline is still empty; the file stays in the downloads directory (for an external service, in the downloads/ of the video\'s project); cannot be combined with project or newVideo',
      ),
    newVideo: z
      .boolean()
      .optional()
      .describe(
        'Optional. Create a new video: import the downloaded media and place it on the timeline (main track, from 0, full length), in the same place as videos_create; the file stays in the downloads directory (for an external service, in that project\'s downloads/)',
      ),
    name: z.string().min(1).max(200).optional().describe('Optional. Name of the new video, defaulting to the page title; only with newVideo'),
    transcribe: z
      .boolean()
      .optional()
      .describe('Optional. With video or newVideo, transcribe that asset after importing; otherwise transcribe the downloaded file into TXT and SRT transcripts next to the media'),
    subs: z
      .array(z.string().regex(/^[A-Za-z0-9-]{1,20}$/))
      .max(10)
      .optional()
      .describe('Optional. Also download subtitle files in these languages (e.g. ["en","zh-Hans"]), placed next to the media and not imported into the video; skipped when the platform has none'),
    audioOnly: z.boolean().optional().describe('Optional. Download audio only'),
    commandId: commandIdArg.optional().describe('Optional. Pass the same value when retrying the same submission so no duplicate job is created'),
  }),
};

type Args = z.infer<(typeof schemas)['download']>;

const DEFINITIONS: Record<'download', ToolInfo> = {
  download: {
    title: 'Download from link',
    description: [
      'Downloads media from a video page link with yt-dlp. It can import into a video, or create a new video and transcribe it.',
      'One of three destinations: video imports into an existing video; newVideo creates a new video and places it on the timeline (project and name may be given); project only downloads into the project\'s downloads/. Files are saved to the downloads directory by default (setting downloads.directory, defaulting to the system Downloads folder), and assets imported by video or newVideo link there; with none of them it only downloads and creates no video. Use that only when the user explicitly says they want just the file, not a video.',
      'To transcribe, add captions or translate, default to newVideo (or use transcribe with url directly): it creates the video, imports and places it on the timeline, and transcribes when transcribe is true; afterwards videos_list and videos_inspect can see it. The created video is kept if a later step fails; do not create it again.',
      'Use only when the user explicitly wants a video from a web page link. The user is asked to confirm according to the access mode; if yt-dlp is not installed, the user is asked to agree to download it (showing source, version, size and license), and this call only submits the install and returns installJobId: wait for it to be completed with jobs_wait, then call this tool again.',
      'Returns a jobId immediately. Wait for it with jobs_wait (progress via jobs_inspect, progress.unit is bytes); when state is completed, outputs holds the downloaded files and transcripts (path) and the imported assets (assetId); for a download-only call the media\'s artifactId can be given to edits_apply\'s importAsset (the file must still be in place and unmodified). On failure error.code is LINK_LOGIN_REQUIRED, LINK_UNSUPPORTED, LINK_NETWORK_ERROR, LINK_DISK_FULL, etc., and error.details.remedy explains the remedy; do not work around it another way (do not run a downloader yourself).',
      'For an external service the destination can only be an in-scope video or a registered project; newVideo requires project too (the new video is created in that project and is then within the service\'s scope); files always go into the owning project\'s downloads/.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'job',
    examples: [
      { title: 'Create a video from a link and transcribe it', args: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', newVideo: true, transcribe: true } },
      { title: 'Download into an existing video', args: { url: 'https://example.com/talk', video: 'demo' } },
      { title: 'Download only into a project, with English subtitles', args: { url: 'https://example.com/talk', project: 'prj_1', subs: ['en'] } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'url',
  },
};

export class LinkImportTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: LinkImportToolsDeps;

  constructor(deps: LinkImportToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    if (name !== 'download') return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    const { subs, ...rest } = args as Args;
    return startLinkImport(this.#deps, { ...rest, subtitleLanguages: subs }, principal);
  }
}

/** Download from a link: check the destination and tool state, confirm accordingly, start the `link-import` pipeline (see the file header). Shared by `download` and `transcribe`. */
export function startLinkImport(deps: LinkImportToolsDeps, request: LinkImportRequest, principal: ToolPrincipal): Promise<unknown> {
  return start(deps, request, principal).catch((error: unknown) => {
    throw toolErrorOf(error);
  });
}

async function start(deps: LinkImportToolsDeps, args: LinkImportRequest, principal: ToolPrincipal) {
  const { tools, pipelines, scope } = deps;
  const access = scope.authorize(principal, true);
  if (args.video !== undefined && (args.newVideo || args.project !== undefined)) {
    throw new ToolError('INVALID_ARGUMENTS', 'Give only one destination: video, or project / newVideo');
  }
  if (args.name !== undefined && !args.newVideo) throw new ToolError('INVALID_ARGUMENTS', 'name is only given with newVideo');
  const service = access.principal.kind === 'service';
  if (service && args.video === undefined && args.project === undefined) {
    throw new ToolError(
      'INVALID_ARGUMENTS',
      args.newVideo ? 'An external service creating a video must give project: the registered project to create it in' : 'For an external service the destination can only be an in-scope video or a registered project',
      {
        next: 'Give project (a projectId from the projects_list result): with newVideo the new video is created in that project, without it the call only downloads into the project; or give video (an in-scope video) to import into it.',
      },
    );
  }
  // Check the link locally first (scheme, private address, leading -); invalid links get no confirmation.
  const link = checkLink(args.url);
  if (deps.offlineStrict()) {
    throw new ToolError('OFFLINE_STRICT', 'No downloads from links in strict offline mode: ask the user to turn off strict offline in settings, or to put the file in the source directory and import it');
  }
  const status = await tools.status(YT_DLP);
  if (service && (status.state !== 'installed' || status.consent?.state !== 'granted')) {
    throw new ToolError('TOOL_UNAVAILABLE', `${status.label} is not installed yet, or the user has not yet agreed to use it to download from websites`, {
      tool: status.name,
      state: status.state,
      remedy: `Ask the user to install ${status.label} in CucCut's external tools settings and agree to use it; an external service cannot install or consent on their behalf`,
    });
  }
  if (status.installJobId) {
    return { jobId: null, installJobId: status.installJobId, tool: toolView(status), next: installNext };
  }
  if (status.state === 'unavailable' || (status.state !== 'installed' && !status.installable)) {
    throw new ToolError('TOOL_UNAVAILABLE', `${status.label} cannot be used right now: ${status.reason ?? 'no usable version'}`, {
      tool: status.name,
      state: status.state,
      remedy: status.remedy ?? "Ask the user to install yt-dlp or set its path in CucCut's external tools settings",
    });
  }
  if (status.state !== 'installed') {
    const offer = status.offer;
    if (!offer || offer.blockedReason || !offer.url) {
      throw new ToolError('TOOL_MANIFEST_INCOMPLETE', `Cannot download ${status.label}: ${offer?.blockedReason ?? 'no usable version for this platform'}`, {
        tool: status.name,
        remedy: `Ask the user to install ${status.label} themselves, then set its path in CucCut's external tools settings`,
      });
    }
    const approval = await scope.confirm(access, {
      tool: 'external_tools_install',
      ...confirmSummary(
        RcAgentTools.installToolSummary({
          tool: status.label,
          version: offer.version,
          size: formatBytes(offer.sizeBytes ?? offer.estimatedBytes),
          estimated: offer.sizeBytes === null,
          license: offer.license,
          url: offer.url,
          host: link.host,
        }),
      ),
      risk: 'high',
    });
    const installed = await tools.install(
      {
        name: status.name,
        consent: true,
        via: 'agent-approval',
        ...(args.commandId ? { commandId: scope.commandId(access, `${args.commandId}-install`) } : {}),
      },
      access.submitter,
    );
    return { jobId: null, installJobId: installed.jobId, tool: toolView(installed.tool), ...approvalField(approval), next: installNext };
  }
  // First only locate the destination (no confirmation for out-of-scope or invisible projects); for a new video, resolve it again after confirming (the terminal registers the project only then).
  let target = await targetOf(deps, args, access, { locate: true });
  const placed = args.video !== undefined || args.newVideo === true || args.project !== undefined;
  // Files go into the project's downloads/: an external service can only write into projects (§12.8), so any destination goes
  // there; the agent goes there only with project alone (download only into the project); video imports stay in the downloads
  // directory, as in the UI and CLI.
  const intoProject = service ? placed : args.project !== undefined && !args.newVideo;
  // Spell out where the files go and how the video changes.
  const about = {
    tool: status.label,
    version: status.version ?? '',
    host: link.host,
    url: link.canonical,
    target: args.newVideo ? 'create' : args.video !== undefined ? 'video' : args.project !== undefined ? 'project' : 'download',
    name: args.name ?? null,
    transcribe: args.transcribe ?? false,
    language: args.language ?? null,
    provider: args.provider ?? null,
    model: args.model ?? null,
    captions: args.captions ?? false,
  };
  const approval =
    status.consent?.state === 'granted'
      ? await scope.confirm(access, {
          tool: 'download',
          ...confirmSummary(RcAgentTools.linkImportSummary(about)),
          // Creating a video (`edit`) does not raise the risk: it stays at the download's `command`.
          risk: 'command',
        })
      : await scope.confirm(access, {
          tool: 'external_tools_consent',
          ...confirmSummary(RcAgentTools.linkImportConsentSummary({ ...about, path: status.path ?? '' })),
          risk: 'high',
        });
  if (status.consent?.state !== 'granted') await tools.consent({ name: status.name, grant: true, via: 'agent-approval' });
  if (args.newVideo) target = await targetOf(deps, args, access);
  const { jobId } = await pipelines.start(
    {
      pipeline: LINK_IMPORT_PIPELINE,
      params: {
        url: args.url,
        ...target,
        ...(intoProject ? { saveTo: 'project' } : {}),
        ...(args.audioOnly !== undefined ? { audioOnly: args.audioOnly } : {}),
        ...(args.subtitleLanguages ? { subtitleLanguages: args.subtitleLanguages } : {}),
        ...(args.transcribe !== undefined ? { transcribe: args.transcribe } : {}),
        ...(args.language !== undefined ? { language: args.language } : {}),
        ...(args.provider !== undefined ? { provider: args.provider } : {}),
        ...(args.model !== undefined ? { model: args.model } : {}),
        ...(args.hint !== undefined ? { hint: args.hint } : {}),
        ...(args.diarize !== undefined ? { diarize: args.diarize } : {}),
        ...(args.captions !== undefined ? { captions: args.captions } : {}),
      },
      ...(args.commandId ? { commandId: scope.commandId(access, args.commandId) } : {}),
    },
    access.submitter,
  );
  // A video created for an external service: added to the service's scope as soon as the parent job records videoId (without waiting for the job to end).
  if (service && args.newVideo && scope.adoptCreatedVideo) {
    const adopt = scope.adoptCreatedVideo.bind(scope);
    adoptWhenCreated(deps.jobs, jobId, (videoId) => adopt(access, videoId));
  }
  const where = intoProject ? "the owning project's downloads/ (the downloads directory for a session without a project)" : 'the downloads directory';
  return {
    jobId,
    installJobId: null,
    url: link.canonical,
    ...approvalField(approval),
    next: args.newVideo
      ? `Download submitted; when it finishes, a new video is created and placed on the timeline${args.transcribe ? `, then transcribed${args.captions ? ' and given a caption layer' : ''}` : ''}. Wait for it with jobs_wait (progress via jobs_inspect); when state is completed, videoId is the new video (can be passed straight to videos_inspect) and outputs[0].assetId is the imported asset${
          args.transcribe
            ? args.captions
              ? ', pipeline.summary.documentId is the new transcript (can be passed to documents_read), and summary.captions is the caption layer'
              : ", pipeline.summary.documentId is the new transcript (the text is in the video's speech document; call captions_create if you need a caption layer)"
            : ''
        }. The created video is kept if a later step fails; do not create it again.`
      : args.video !== undefined
        ? `Download submitted. Wait for it with jobs_wait (progress via jobs_inspect); when state is completed, outputs[0].path is the downloaded file (in ${where}) and outputs[0].assetId is the imported asset.`
        : `Download submitted; the file is saved to ${where} and not imported into a video. Wait for it with jobs_wait (progress via jobs_inspect); when state is completed, outputs[0].path is the downloaded media; to put it in a video, pass outputs[0].artifactId to edits_apply's importAsset${args.transcribe ? '; after it, the output with mediaType text/plain is the TXT transcript and application/x-subrip is the SRT subtitles (path is next to the media; artifactId can be used with artifacts_save)' : ''}. Tell the user where the file is.`,
  };
}

/**
 * The destination in the pipeline params: an existing (in-scope) video, a new one (in the same place as `videos_create`), a
 * project (download only), or, with no destination, the caller's source (the session's project or the session, or the
 * terminal's project; files still go to the downloads directory).
 */
async function targetOf(
  deps: LinkImportToolsDeps,
  args: LinkImportRequest,
  access: ToolAccess,
  options: { locate?: boolean } = {},
): Promise<{ videoId: Id } | { target: PipelineVideoTarget } | { projectId: Id } | { conversationId: Id }> {
  const { scope } = deps;
  if (args.video !== undefined) return { videoId: (await scope.open(args.video, access)).ref.videoId };
  // Resolve the creation location only when needed: the terminal scope registers the project (or creates the default one)
  // when resolving it; invisible projects are answered like missing ones. Download-only (no new video) just locates.
  const source = (await scope.createRoot(access, args.project, { locate: options.locate || !args.newVideo })).scope;
  if (args.newVideo) return { target: { create: { ...source, ...(args.name ? { name: args.name } : {}) } } };
  return source;
}

/** Calls `adopt` once the parent job records `videoId` (when the video-creating step takes its lease); stops waiting if the job ends first. Called once; a failure does not affect the job. */
function adoptWhenCreated(jobs: LinkImportToolsDeps['jobs'], jobId: Id, adopt: (videoId: Id) => void | Promise<void>): void {
  let done = false;
  const check = (record: JobRecord) => {
    if (done || record.jobId !== jobId) return;
    if (record.videoId !== null) {
      done = true;
      stop();
      void Promise.resolve()
        .then(() => adopt(record.videoId!))
        .catch(() => {});
    } else if (isTerminal(record.state)) {
      done = true;
      stop();
    }
  };
  const stop = jobs.onChange(check);
  // A repeated submission of the same command returns the existing job, which may have recorded it already.
  try {
    check(jobs.inspect(jobId));
  } catch {
    // The job is gone: stop waiting.
    stop();
  }
}

const installNext =
  'yt-dlp is being installed: wait for the installJobId job with jobs_wait, and once state is completed call download again; on failure error.details.remedy explains the remedy.';

function toolView(status: ExternalToolStatus) {
  return { name: status.name, state: status.state, version: status.version, source: status.source };
}

/**
 * Turns service and pipeline refusals into tool errors: `details.code` (`TOOL_*`, `LINK_*`, `OFFLINE_STRICT`, ...) becomes the
 * tool error code. Unconfigured capabilities and grant or budget refusals are left to the tool catalog to explain in its uniform
 * format (`errorBody` adds `remedy` and `next`).
 */
export function toolErrorOf(error: unknown): unknown {
  if (error instanceof RpcError && typeof error.details === 'object' && error.details !== null) {
    if (isGrantErrorDetails(error.details)) return error;
    const { code, ...rest } = error.details as Record<string, unknown>;
    if (typeof code === 'string' && code !== 'CAPABILITY_NOT_CONFIGURED') return new ToolError(code, error.message, rest);
  }
  return error;
}
