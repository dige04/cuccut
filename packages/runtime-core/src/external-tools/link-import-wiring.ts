import path from 'node:path';
import { RpcError, type Id } from '@cuccut/protocol';
import {
  LINK_IMPORT_PIPELINE,
  linkImportPipeline,
  type HostLookup,
  type JobManager,
  type LinkSources,
  type PipelineDefinition,
  type ProbeToolResolver,
} from '@cuccut/jobs';
import { withPipelineGrants } from '../grants/pipeline-grants.ts';
import type { ExtraPipelineContext } from '../models/model-jobs.ts';
import type { ExternalToolService } from './external-tool-service.ts';
import { resolveDownloadsDirectory } from './downloads-directory.ts';
import { YT_DLP } from './tool-manifests.ts';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';

/**
 * Wiring of the "download video" flow in the Runtime (architecture design §7.9). The tool comes from the external tool service (installed, consent valid). The download directory is decided by the setting or the host's Downloads. Transcription reuses the submission of `models.transcribe`. The flow is registered when the JobManager is built, but its dependencies here (the external tool service, settings,
 * Harness) only become available in the later steps of Runtime startup, so they are fetched at call time.
 */
export interface LinkImportWiring {
  tools: () => ExternalToolService;
  settings: () => { downloadsDirectory: string | null; offlineStrict: boolean };
  /** Project directory; `not-found` if it does not exist. */
  projectRoot: (projectId: Id) => string;
  /** The session's source directory (the project directory when the session belongs to a project); `not-found` if it does not exist. */
  conversationRoot: (conversationId: Id) => string;
  /** The source (project or session) of the opened video. */
  videoSource: (videoId: Id) => { projectId: Id | null; conversationId: Id | null } | null;
  /** Output root kept for the old wiring; the download directory uses the setting or the host's Downloads. */
  outputsDir: string;
  sources: LinkSources;
  ffprobe: ProbeToolResolver;
  /** When `CUCCUT_FFMPEG` gives an absolute path, it is passed to yt-dlp; otherwise yt-dlp looks for it on PATH itself. */
  ffmpegLocation?: () => Promise<string | null>;
  /** Host name resolution injected by tests (no access to real DNS). */
  lookup?: HostLookup;
}

/** With `saveTo: 'project'`, the directory in the project where downloaded files go (alongside `exports/` and `imports/`). */
export const PROJECT_DOWNLOADS_DIR = 'downloads';

export function linkImportDefinition(wiring: LinkImportWiring, context: ExtraPipelineContext): PipelineDefinition<any, any> {
  const { videos, transcriber, targets, enabledGlossaries } = context;
  return withPipelineGrants(linkImportPipeline({
    tool: () => wiring.tools().resolveForUse(YT_DLP),
    destination: async (target) => {
      // First check whether the project and session exist (a missing one is still rejected), then decide by `saveTo`: a session that belongs to a project uses its `downloads/`; otherwise the download directory.
      let projectDir: string | null = null;
      if (target.projectId !== undefined) projectDir = wiring.projectRoot(target.projectId);
      else if (target.conversationId !== undefined) wiring.conversationRoot(target.conversationId);
      else if (target.videoId !== undefined) {
        const source = wiring.videoSource(target.videoId);
        if (!source) throw new RpcError('not-found', RcExternalTools.videoNotOpen());
        if (source.projectId) projectDir = wiring.projectRoot(source.projectId);
        else if (source.conversationId) wiring.conversationRoot(source.conversationId);
      }
      // The working directory of a session that does not belong to a project is not visible to the user, so files still go into the download directory.
      if (target.saveTo === 'project' && projectDir !== null) return path.join(projectDir, PROJECT_DOWNLOADS_DIR);
      return resolveDownloadsDirectory(wiring.settings().downloadsDirectory);
    },
    sources: wiring.sources,
    videos,
    ...(targets ? { targets } : {}),
    ffprobe: wiring.ffprobe,
    ...(wiring.ffmpegLocation ? { ffmpegLocation: wiring.ffmpegLocation } : {}),
    offlineStrict: () => wiring.settings().offlineStrict,
    transcribe: transcriber,
    ...(enabledGlossaries ? { enabledGlossaries } : {}),
    ...(wiring.lookup ? { lookup: wiring.lookup } : {}),
  }), context.grants, ['audio'], (plan) => plan.params.transcription ? [{ capability: 'transcribe', ...plan.params.transcription, dataKinds: ['audio'] }] : []);
}

/** At Runtime startup, keep raw links only for the import-from-link flow references that can still be retried. */
export async function pruneLinkSources(jobs: JobManager, sources: LinkSources): Promise<void> {
  const keep = new Set<string>();
  for (const record of jobs.list()) {
    // Completed ones were already deleted. Failed, cancelled, and interrupted ones can still be retried.
    if (record.kind !== 'pipeline' || record.pipeline?.name !== LINK_IMPORT_PIPELINE || record.state === 'completed') continue;
    const ref = record.pipeline.params.sourceRef;
    if (typeof ref === 'string') keep.add(ref);
  }
  await sources.prune(keep);
}
