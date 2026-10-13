import fs from 'node:fs/promises';
import path from 'node:path';
import { RpcError, newId, type Id, type JobRecord, type JobSubmitter, type Project, type VideoOpenResult } from '@cuccut/protocol';
import type { Harness } from '@cuccut/harness';
import { locateArtifact, type JobManager } from '@cuccut/jobs';
import type { TrustedPrincipal } from '../gateway.ts';
import type { VideoService } from '../videos/video-service.ts';
import { scanDirectory, type SpaceCatalog } from '../space-catalog.ts';
import { grantRequiredDetails, GRANT_NEXT } from '../grants/grant-errors.ts';
import { ToolError } from './tool-catalog.ts';
import {
  scopedProject,
  type ExportBase,
  type LocalPrincipal,
  type ScopedProject,
  type ToolAccess,
  type ToolApprovalNote,
  type ToolConfirmation,
  type ToolPrincipal,
  type ToolScope,
  type VideoRoot,
  type VisibleArtifact,
} from './tool-scope.ts';

/**
 * Permissions and scope of the user themselves in a terminal (architecture design §3.5; agent surface design §3): the
 * CLI (or a desktop connection) calls catalog tools by name through the gateway's `catalog.call`.
 *
 * - **Scope**: everything the user can access. A video is named by videoId, video directory (absolute or relative to
 *   cwd) or Space entry id, resolved in the order directory -> videoId -> entry; videos not yet open are opened by the
 *   Runtime and attached to the calling connection, and are not force-closed after the call (they are released when the
 *   connection drops, the same as videos opened by the UI).
 * - **Confirmation**: CucCut's approvals are not used; confirmation is the job of the agent host (or the user in the
 *   terminal). Outbound data works as in the desktop UI: enabled online Providers already have a default grant; calls not
 *   covered by a grant (the user revoked it) are refused with `GRANT_REQUIRED`, and no grant is issued here on the
 *   user's behalf.
 * - **Writes**: the actor is `user_local` (`actorOf` treats it as neither agent nor external service) and shares the undo
 *   stack with the desktop UI; the job submitter is the calling connection (`{ kind: 'connection', id }`), the same as
 *   jobs submitted by a desktop connection. All jobs and artifacts are visible and cancellable (same as the job center).
 * - **Paths**: asset imports, export targets and artifact saves resolve relative paths against cwd and accept absolute
 *   paths, with no directory restriction; keeping video directories and `.ccut` unwritable is the engine's and export's
 *   protection, not done here.
 * - **Projects**: new videos go into `projectDir` (given explicitly, or found by walking up from cwd); without one they
 *   go into the `CLI` project under the default projects directory, and the result says so.
 */

export interface LocalAccess extends ToolAccess {
  readonly principal: LocalPrincipal;
}

export interface LocalScopeDeps {
  harness: Harness;
  videos: VideoService;
  jobs: JobManager;
  /** The Space catalog is built after the tool catalog: read it at call time. */
  space: () => SpaceCatalog;
  /** Default projects directory (`CUCCUT_PROJECTS_DIR`, see `RuntimeHome.projectsDir`). */
  projectsDir: string;
}

/** The project new videos go into when the current directory is in no project (under the default projects directory). */
export const LOCAL_DEFAULT_PROJECT_DIR = 'CLI';

const PROJECT_MARKER = path.join('.ccut', 'project.json');

/**
 * Gateway connection + `catalog.call` params -> the principal of this call. `cwd` and `project` are absolute paths (the
 * protocol schema already checked; the CLI resolves a relative `--project` against cwd); a path that does not exist or
 * is not a directory is refused with `INVALID_ARGUMENTS`. Without `project`, walks up from cwd looking for
 * `.ccut/project.json`. This only finds, it does not register: registering the project (writing the marker) waits until
 * the project is actually needed (creating a video, opening a video by directory).
 */
export async function resolveLocalPrincipal(
  connection: TrustedPrincipal,
  params: { cwd: string; project?: string | null },
): Promise<LocalPrincipal> {
  const cwd = await realDirectory(params.cwd, 'cwd');
  const projectDir = params.project ? await realDirectory(params.project, 'project') : await findProjectDir(cwd);
  return {
    kind: 'local',
    connectionId: connection.connectionId,
    name: connection.name,
    client: connection.kind === 'desktop' ? 'desktop' : 'cli',
    cwd,
    projectDir,
  };
}

export class LocalScope implements ToolScope<LocalAccess> {
  readonly #deps: LocalScopeDeps;

  constructor(deps: LocalScopeDeps) {
    this.#deps = deps;
  }

  /** Always allowed: the CLI is the user themselves working in a terminal, or a terminal agent the user authorized. */
  authorize(principal: ToolPrincipal, _write: boolean): LocalAccess {
    if (principal.kind !== 'local') throw new ToolError('FORBIDDEN', 'This scope only serves calls from a terminal');
    const submitter: JobSubmitter = { kind: 'connection', id: principal.connectionId };
    return { principal, submitter };
  }

  /**
   * No approvals are created: confirmation is the agent host's job (agent surface design §3.1). Outbound calls not covered
   * by a grant are refused outright: enabling a Provider is a standing grant, and one the user revoked is not reissued
   * here on the user's behalf.
   */
  async confirm(_access: LocalAccess, request: ToolConfirmation): Promise<ToolApprovalNote | void> {
    if (!request.grants?.length) return;
    const { message, details } = grantRequiredDetails(request.grants);
    const { code, remedy, ...extra } = details;
    throw new ToolError(code, message.text, {
      ...extra,
      remedy: {
        ...remedy,
        hint: 'Sending data to this provider needs a grant: re-enable the provider in CucCut\'s settings, or issue it a grant (data kinds, scope and budget), then try again.',
      },
      next: GRANT_NEXT[code],
    });
  }

  /**
   * Inside a project (`projectDir`), lists the videos in that project (path relative to the project directory, and the
   * absolute dir); outside a project, lists all videos in Space plus videos already open. Videos whose videoId cannot be
   * read (locked elsewhere) are still listed, just without a videoId.
   */
  async listVideos(access: LocalAccess): Promise<Record<string, unknown>> {
    const { projectDir } = access.principal;
    const open = new Map(this.#deps.videos.openRefs().map((ref) => [ref.path, ref]));
    const next = 'Call videos_inspect with a videoId or video directory to read a video; read before editing to get the revision and object IDs.';
    if (projectDir) {
      const scan = await scanDirectory(projectDir);
      const videos: Record<string, unknown>[] = [];
      for (const file of scan.files) {
        if (file.kind !== 'video') continue;
        const dir = path.join(projectDir, ...file.relPath.split('/'));
        const ref = open.get(dir);
        const seen = ref ?? (await this.#deps.videos.peek(dir).catch(() => null));
        videos.push({ path: file.relPath, dir, ...(seen ? { videoId: seen.videoId, name: seen.name } : {}), open: ref !== undefined });
      }
      return { project: projectDir, videos, ...(scan.issue ? { issue: scan.issue.detail } : {}), next };
    }
    const space = this.#deps.space();
    const listed = new Set<string>();
    const videos: Record<string, unknown>[] = [];
    for (const video of space.videos()) {
      listed.add(video.dir);
      const ref = open.get(video.dir);
      videos.push({
        dir: video.dir,
        ...(video.videoId ? { videoId: video.videoId } : {}),
        name: ref?.name ?? space.get(video.entryId).name,
        projectId: video.projectId,
        entryId: video.entryId,
        open: ref !== undefined,
      });
    }
    for (const ref of open.values()) {
      if (listed.has(ref.path)) continue;
      videos.push({ dir: ref.path, videoId: ref.videoId, name: ref.name, projectId: ref.source.projectId, open: true });
    }
    return { project: null, videos, next };
  }

  /**
   * Creating a video: use the caller's `project` (project directory, absolute or relative to cwd) if given; otherwise
   * `projectDir` (registering it); with neither, the `CLI` project under the default projects directory, with a note.
   */
  async createRoot(access: LocalAccess, project?: string): Promise<VideoRoot> {
    const { cwd, projectDir } = access.principal;
    const chosen = project !== undefined ? await realDirectory(path.resolve(cwd, project), 'project') : projectDir;
    if (chosen) {
      const registered = await this.#register(chosen);
      return { root: registered.path, scope: { projectId: registered.id } };
    }
    const dir = path.join(this.#deps.projectsDir, LOCAL_DEFAULT_PROJECT_DIR);
    await fs.mkdir(dir, { recursive: true });
    const fallback = await this.#register(dir);
    return {
      root: fallback.path,
      scope: { projectId: fallback.id },
      note: `The current directory is not in a CucCut project: the video was created in ${fallback.path} under the default projects directory. To use another project, run from that project's directory or pass --project.`,
    };
  }

  async open(video: string, access: LocalAccess): Promise<VideoOpenResult> {
    const location = await this.#locate(video, access.principal);
    try {
      return await this.#deps.videos.open(location, access.principal);
    } catch (error) {
      if (error instanceof RpcError && (error.code === 'not-found' || error.code === 'forbidden')) throw videoNotFound(video);
      throw error;
    }
  }

  /** `importAsset.path` is relative to cwd; absolute paths are accepted, with no directory restriction. */
  importBase(access: LocalAccess): { cwd: string; confine: string | null } {
    return { cwd: access.principal.cwd, confine: null };
  }

  /** Local files resolve against cwd; absolute paths are accepted. */
  fileBase(access: LocalAccess): string {
    return access.principal.cwd;
  }

  commandId(_access: LocalAccess, given: string | undefined): string {
    return given ?? newId('cmd');
  }

  /** All jobs are visible (same as the job center). */
  async visibleJob(jobId: Id): Promise<JobRecord> {
    try {
      return this.#deps.jobs.inspect(jobId);
    } catch {
      throw new ToolError('JOB_NOT_FOUND', `Job not found: ${jobId}`);
    }
  }

  /** `jobs_list`: all jobs (same as the job center). */
  async visibleJobs(): Promise<JobRecord[]> {
    return this.#deps.jobs.list();
  }

  /** `projects_list`: all registered projects, with video counts from the videos registered in Space (after the first scan finishes). */
  async listProjects(): Promise<ScopedProject[]> {
    const space = this.#deps.space();
    await space.ready;
    const counts = new Map<Id, number>();
    for (const video of space.videos()) {
      if (video.projectId) counts.set(video.projectId, (counts.get(video.projectId) ?? 0) + 1);
    }
    return this.#deps.harness.listProjects().map((project) => scopedProject(project, { videoCount: counts.get(project.id) ?? 0 }));
  }

  async visibleArtifact(artifactId: string): Promise<VisibleArtifact> {
    const record = this.#deps.jobs
      .list()
      .find((r) => r.result?.artifactId === artifactId || r.result?.outputs?.some((o) => o.artifactId === artifactId));
    if (!record) throw new ToolError('ARTIFACT_NOT_FOUND', `Artifact not found: ${artifactId} (use an artifactId from the outputs of jobs_inspect)`);
    const output = record.result?.outputs?.find((o) => o.artifactId === artifactId) ?? null;
    const file = await locateArtifact(this.#deps.jobs.artifacts, artifactId, output);
    if (!file) throw new ToolError('ARTIFACT_NOT_FOUND', `The file for artifact ${artifactId} no longer exists`);
    return { record, output, file };
  }

  /** The user themselves: any job can be cancelled (same as the job center). */
  owns(): boolean {
    return true;
  }

  /** Change cards only go in sessions; terminal edits are in the video history (actor `user_local`). */
  recordChange(): void {}

  /** `artifacts_save` writes to cwd. */
  saveRoot(access: LocalAccess): string {
    return access.principal.cwd;
  }

  /** Export targets resolve against cwd, absolute paths accepted; when omitted, the export service puts the file in `exports/` of the video's source directory (its project). */
  exportBase(access: LocalAccess): ExportBase {
    return { base: access.principal.cwd, within: null, ownDefault: false };
  }

  // ---- Locating ----

  /** Video argument -> where to open it. Resolution order: directory (absolute or relative to cwd) -> videoId -> Space entry id. */
  async #locate(video: string, principal: LocalPrincipal): Promise<{ root: string; file: string; scope: VideoRoot['scope'] }> {
    const asDir = await realDirectoryOrNull(path.resolve(principal.cwd, video));
    if (asDir) return this.#locateDir(asDir, principal, video);
    const dir = await this.#dirOfVideoId(video, principal);
    if (dir) return this.#locateDir(dir, principal, video);
    const space = this.#deps.space();
    let entryExists = true;
    try {
      space.get(video);
    } catch {
      entryExists = false;
    }
    if (entryExists) {
      try {
        return space.locate(video);
      } catch (error) {
        const code = error instanceof RpcError && isRecord(error.details) ? error.details.code : undefined;
        if (typeof code === 'string') throw new ToolError(code, (error as RpcError).message);
        throw videoNotFound(video);
      }
    }
    throw videoNotFound(video);
  }

  /** Video directory -> source: a registered project (the deepest one), a project marker found walking up (registering it), or a session working directory (an entry in Space). */
  async #locateDir(dir: string, principal: LocalPrincipal, video: string) {
    let best: Project | null = null;
    for (const project of this.#deps.harness.listProjects()) {
      const root = await fs.realpath(project.path).catch(() => null);
      if (root && dir !== root && inside(dir, root) && (!best || root.length > best.path.length)) best = { ...project, path: root };
    }
    if (!best) {
      const marked =
        principal.projectDir && dir !== principal.projectDir && inside(dir, principal.projectDir)
          ? principal.projectDir
          : await findProjectDir(path.dirname(dir));
      if (marked) best = await this.#register(marked);
    }
    if (best) return { root: best.path, file: dir, scope: { projectId: best.id } };
    const info = await this.#deps.space().videoEntryAt(dir);
    if (info) return { root: info.root, file: info.dir, scope: info.scope };
    throw new ToolError('VIDEO_NOT_FOUND', `Video directory "${video}" is not in any project: pass --project to name the project it belongs to`);
  }

  /** videoId -> video directory: an open one, one registered in Space, or one in the current project (checking identities one by one, read-only). null if not found. */
  async #dirOfVideoId(videoId: string, principal: LocalPrincipal): Promise<string | null> {
    const ref = this.#deps.videos.ref(videoId);
    if (ref) return ref.path;
    if (!VIDEO_ID.test(videoId)) return null;
    const known = this.#deps
      .space()
      .videos()
      .find((v) => v.videoId === videoId);
    if (known) return known.dir;
    if (!principal.projectDir) return null;
    const scan = await scanDirectory(principal.projectDir);
    for (const file of scan.files) {
      if (file.kind !== 'video') continue;
      const dir = path.join(principal.projectDir, ...file.relPath.split('/'));
      const seen = await this.#deps.videos.peek(dir).catch(() => null);
      if (seen?.videoId === videoId) return dir;
    }
    return null;
  }

  /** Registers (or attaches to an already registered) project, same as `projects.open`: videos in a copy get new identities in the background. */
  async #register(dir: string): Promise<Project> {
    const project = await this.#deps.harness.openProject(dir);
    void this.#deps.videos.claimProjectVideos(project).catch(() => {});
    return project;
  }
}

/** Shape of a videoId: `video_` plus hex (same as AgentScope). */
const VIDEO_ID = /^video_[0-9a-f]{8,32}$/;

/** Walks up from `start` to the directory containing `.ccut/project.json`; null if none up to the root. */
async function findProjectDir(start: string): Promise<string | null> {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const marked = await fs.stat(path.join(dir, PROJECT_MARKER)).then(
      (stat) => stat.isFile(),
      () => false,
    );
    if (marked) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

async function realDirectory(dir: string, field: string): Promise<string> {
  const real = await realDirectoryOrNull(dir);
  if (!real)
    throw new ToolError('INVALID_ARGUMENTS', `${field} does not exist or is not a directory: ${dir}`, { issues: [{ path: field, message: 'Not a directory' }] });
  return real;
}

async function realDirectoryOrNull(dir: string): Promise<string | null> {
  try {
    const real = await fs.realpath(dir);
    return (await fs.stat(real)).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

function inside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function videoNotFound(video: string): ToolError {
  return new ToolError(
    'VIDEO_NOT_FOUND',
    `Video "${video}" not found: give a video directory (absolute or relative to the current directory), a videoId from videos_list, or a Space entry id`,
  );
}
