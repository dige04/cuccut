import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  newId,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type Project,
  type ServiceId,
  type ServicePolicy,
  type VideoCreated,
  type VideoOpenResult,
} from '@cuccut/protocol';
import type { Harness } from '@cuccut/harness';
import { locateArtifact, type JobManager } from '@cuccut/jobs';
import type { VideoService } from '../videos/video-service.ts';
import { scanDirectory } from '../space-catalog.ts';
import { ToolError } from '../agent-tools/tool-catalog.ts';
import {
  scopedProject,
  toolRisk,
  type ScopedProject,
  type ServicePrincipal,
  type ToolApprovalNote,
  type ToolAccess,
  type ToolConfirmation,
  type ToolPrincipal,
  type ToolScope,
  type VisibleArtifact,
} from '../agent-tools/tool-scope.ts';
import type { ServiceApprovals } from './service-approvals.ts';
import { GRANT_NEXT, grantRequiredDetails } from '../grants/grant-errors.ts';

/**
 * Permissions and scope for external services (architecture design §4.8, §12.8): an external request has no session and no TaskContract; the access policy takes their place.
 *
 * - **Scope**: videos in registered projects, either all of them or a list of videoIds. Videos outside the scope do not exist for this service: they are not in lists, and access by ID or by path both answer `VIDEO_NOT_FOUND`, and nothing is opened or sent for approval because of them. The check uses the engine's read-only view and does not take the write lock.
 * - **Level**: `read` only allows queries (write tools are not in the catalog, but are rejected again here); at `ask`, writes, jobs, and generations each require a service approval,
 *   which has a time limit; timeout, rejection, and cancellation all answer `SERVICE_APPROVAL_DENIED`; `auto` executes directly.
 * - **Jobs**: the submitter is `{ kind: 'service', id: <serviceId>, clientId }`; a client sees only the jobs it submitted and their outputs.
 *   Idempotency keys are separated per client, so they never collide with another client's submissions.
 * - **Files**: `importAsset.path` is relative to the project directory containing the video, and cannot point outside it; exports are written only into the project's `exports/`.
 * - **New videos**: `videos_create` must be given the id (or directory) of a registered project, and creates the video there; the new video is added to the service's video list (`allowVideo`).
 * - Writes use `external:<serviceId>` as the operator and go through the same command entry as the UI; no change card is placed in any session (audit is recorded in the service).
 */

export interface ServiceAccess extends ToolAccess {
  readonly principal: ServicePrincipal;
  readonly policy: ServicePolicy;
}

export interface ServiceScopeDeps {
  harness: Harness;
  videos: VideoService;
  jobs: JobManager;
  approvals: ServiceApprovals;
  /** The service's current access policy: config changes take effect immediately. */
  policy: (serviceId: ServiceId) => ServicePolicy;
  /** Adds a video the service itself created to its scope (if the policy is a list, it is written into the list and persisted). */
  allowVideo?: (serviceId: ServiceId, videoId: Id) => Promise<void>;
}

/** Where a video within the scope is. */
interface Located {
  project: Project;
  dir: string;
  videoId: Id;
  name: string;
}

export class ServiceScope implements ToolScope<ServiceAccess> {
  readonly #deps: ServiceScopeDeps;
  /** videoId → video directory: recorded when listing and when accessing by path; checked first when accessing by ID. */
  readonly #index = new Map<Id, { projectId: Id; dir: string }>();

  constructor(deps: ServiceScopeDeps) {
    this.#deps = deps;
  }

  authorize(principal: ToolPrincipal, write: boolean): ServiceAccess {
    if (principal.kind !== 'service') throw new ToolError('FORBIDDEN', 'This endpoint serves only external service clients');
    const policy = this.#deps.policy(principal.serviceId);
    if (write && policy.level === 'read') throw new ToolError('UNKNOWN_TOOL', 'This service is open for queries only');
    const submitter: JobSubmitter = { kind: 'service', id: principal.serviceId, clientId: principal.clientId };
    return { principal, policy, submitter };
  }

  /**
   * At the `ask` level, generates a service approval and waits. The target video is first resolved against the scope; one outside the scope is answered as nonexistent directly. The approval is created by the unified ApprovalService
   * (§3.12), with the action's risk level attached; the same entry also appears in the pending list under the `tasks` topic.
   */
  async confirm(access: ServiceAccess, request: ToolConfirmation): Promise<ToolApprovalNote | void> {
    const located = request.video !== undefined ? await this.#locate(request.video, access) : null;
    const policy = this.#deps.policy(access.principal.serviceId);
    const outbound = request.grants?.length ? request.grants : null;
    // The auto level skips per-request confirmation, not the authorization for sending data out (§4.8, §12.5): outbound without a covering authorization is rejected directly.
    if (policy.level === 'auto' && outbound) {
      const { message, details } = grantRequiredDetails(outbound);
      const { code, ...extra } = details;
      throw new ToolError(code, message.text, { ...extra, next: GRANT_NEXT[code] });
    }
    if (policy.level === 'auto') return;
    if (policy.level === 'read') throw new ToolError('UNKNOWN_TOOL', 'This service is open for queries only');
    const { principal } = access;
    const risk = toolRisk(request);
    const { outcome, grant } = await this.#deps.approvals.resolve(
      {
        serviceId: principal.serviceId,
        clientId: principal.clientId,
        clientName: principal.clientName,
        tool: request.tool,
        video: located ? { videoId: located.videoId, name: located.name } : null,
        summary: request.summary,
      },
      principal.signal,
      { risk, level: policy.level, ...(outbound ? { grants: outbound } : {}) },
    );
    if (outcome === 'allowed') return outbound ? { mode: null, risk, decidedBy: 'user', grant: grant ?? { persist: false } } : undefined;
    const message =
      outcome === 'denied'
        ? 'The user declined this request in CucCut: do not retry the same request; ask the user first'
        : outcome === 'timeout'
          ? 'The user did not confirm this request in time, so it counts as declined: ask the user to watch for the confirmation in CucCut, then try again'
          : 'This request was cancelled before it was confirmed (the service stopped or the connection dropped)';
    throw new ToolError('SERVICE_APPROVAL_DENIED', message, { serviceId: principal.serviceId, reason: outcome });
  }

  /** Videos within the scope: the video directories of registered projects, each with its videoId (does not open the video). */
  async listVideos(access: ServiceAccess): Promise<Record<string, unknown>> {
    const videos: Record<string, unknown>[] = [];
    let skipped = 0;
    const open = new Map(this.#deps.videos.openRefs().map((ref) => [ref.path, ref]));
    for (const project of (await this.#projects()).values()) {
      const found = await this.#scanProject(project).catch(() => null);
      if (!found) {
        skipped++;
        continue;
      }
      skipped += found.skipped;
      for (const video of found.videos) {
        if (!inPolicy(video.videoId, access.policy)) continue;
        videos.push({
          videoId: video.videoId,
          name: video.name,
          projectId: project.id,
          project: project.name,
          path: `${project.id}/${video.relPath}`,
          open: open.has(video.dir),
        });
      }
    }
    return {
      videos,
      ...(skipped > 0 ? { issue: `${skipped} director${skipped === 1 ? 'y' : 'ies'} could not be read and ${skipped === 1 ? 'is' : 'are'} not listed` } : {}),
      next: 'Call videos_inspect with a videoId to read a video; read before changing it, to get the revision and object IDs.',
    };
  }

  /** Where a new video goes: the registered project given by the caller (its id, or the path of the project directory). If not given, `INVALID_ARGUMENTS`; if there is no such project, `PROJECT_NOT_FOUND`. */
  createRoot(_access: ServiceAccess, project?: string): { root: string; scope: { projectId: Id } } {
    const projects = this.#deps.harness.listProjects();
    if (project === undefined) {
      throw new ToolError('INVALID_ARGUMENTS', 'An external service must give project to create a video: the registered project to create it in', {
        next: 'Give project: a project id (projectId in the videos_list result); the video is created in that project',
      });
    }
    const found =
      projects.find((p) => p.id === project) ??
      (path.isAbsolute(project) ? projects.find((p) => path.resolve(p.path) === path.resolve(project)) : undefined);
    if (!found) throw new ToolError('PROJECT_NOT_FOUND', `Project "${project}" not found: use a projectId from the videos_list result`);
    return { root: found.path, scope: { projectId: found.id } };
  }

  /** A video the service created: added to its scope, and visible afterwards in lists and by ID access. */
  async recordCreated(access: ServiceAccess, created: VideoCreated): Promise<void> {
    access.principal.audit.videoId = created.videoId;
    if (access.policy.videos !== 'all') await this.#deps.allowVideo?.(access.principal.serviceId, created.videoId);
  }

  /** A video created by the service's start flow (downloaded from a link): likewise added to the scope; the call has already returned, so the audit is not changed. */
  async adoptCreatedVideo(access: ServiceAccess, videoId: Id): Promise<void> {
    if (access.policy.videos !== 'all') await this.#deps.allowVideo?.(access.principal.serviceId, videoId);
  }

  async open(video: string, access: ServiceAccess): Promise<VideoOpenResult> {
    const located = await this.#locate(video, access);
    let opened: VideoOpenResult;
    try {
      opened = await this.#deps.videos.open(
        { root: located.project.path, file: located.dir, scope: { projectId: located.project.id } },
        access.principal,
      );
    } catch (error) {
      if (error instanceof RpcError && (error.code === 'not-found' || error.code === 'forbidden')) throw videoNotFound(video);
      throw error;
    }
    // The copy changed its identifier on open: the video after the change must also be in scope.
    if (!inPolicy(opened.ref.videoId, access.policy)) {
      await this.#deps.videos.close(opened.ref.videoId, access.principal);
      throw videoNotFound(video);
    }
    access.principal.audit.videoId = opened.ref.videoId;
    return opened;
  }

  /** `importAsset.path` is relative to the project directory containing the video, and must be a file inside that project directory (§12.8). */
  importBase(_access: ServiceAccess, opened: VideoOpenResult): { cwd: string; confine: string | null } {
    const project = this.#deps.harness.listProjects().find((p) => p.id === opened.ref.source.projectId);
    if (!project) throw videoNotFound(opened.ref.videoId);
    return { cwd: project.path, confine: project.path };
  }

  /** External services have no local-path entry point (§4.8): files can only come in through videos or links within the scope. */
  fileBase(): never {
    throw new ToolError('INVALID_ARGUMENTS', 'An external service cannot give local file paths (file, files, outDir)', {
      next: 'Give video (a video within your scope, a videoId listed by videos_list) or url (a link, landing in video or project); files can only be written into the exports/ of the video\'s project (export).',
    });
  }

  commandId(access: ServiceAccess, given: string | undefined): string {
    return given === undefined ? newId('cmd') : `svc-${access.principal.clientId}-${given}`;
  }

  async visibleJob(jobId: Id, access: ServiceAccess): Promise<JobRecord> {
    let record: JobRecord;
    try {
      record = this.#deps.jobs.inspect(jobId);
    } catch {
      throw jobNotFound(jobId);
    }
    if (!this.owns(record, access)) throw jobNotFound(jobId);
    return record;
  }

  /** `jobs_list`: the jobs this client itself submitted. */
  async visibleJobs(access: ServiceAccess): Promise<JobRecord[]> {
    return this.#deps.jobs.list().filter((record) => this.owns(record, access));
  }

  /**
   * `projects_list`: the projects that the in-scope videos belong to, with the count of in-scope videos. When the access policy is all videos, it lists all registered projects (including those with no videos, since `videos_create` needs their ids).
   * It does not take a project directory path. Projects that cannot be read are still listed under all-videos, without a video count.
   */
  async listProjects(access: ServiceAccess): Promise<ScopedProject[]> {
    const listed: ScopedProject[] = [];
    for (const project of (await this.#projects()).values()) {
      const found = await this.#scanProject(project).catch(() => null);
      const count = found?.videos.filter((v) => inPolicy(v.videoId, access.policy)).length;
      if (access.policy.videos !== 'all' && !count) continue;
      listed.push(scopedProject(project, { path: false, videoCount: count }));
    }
    return listed;
  }

  async visibleArtifact(artifactId: string, access: ServiceAccess): Promise<VisibleArtifact> {
    const record = this.#deps.jobs
      .list()
      .find(
        (r) => this.owns(r, access) && (r.result?.artifactId === artifactId || r.result?.outputs?.some((o) => o.artifactId === artifactId)),
      );
    if (record) {
      const output = record.result?.outputs?.find((o) => o.artifactId === artifactId) ?? null;
      const file = await locateArtifact(this.#deps.jobs.artifacts, artifactId, output);
      if (!file) throw new ToolError('ARTIFACT_NOT_FOUND', `The file of artifact ${artifactId} no longer exists`);
      return { record, output, file };
    }
    throw new ToolError(
      'ARTIFACT_NOT_FOUND',
      `Artifact ${artifactId} not found, or it does not belong to a job you submitted (use an artifactId from the outputs of jobs_inspect)`,
    );
  }

  /** The jobs this client itself submitted. */
  owns(record: JobRecord, access: ServiceAccess): boolean {
    const { submitter } = record;
    return submitter.kind === 'service' && submitter.id === access.principal.serviceId && submitter.clientId === access.principal.clientId;
  }

  recordChange(): void {}

  /** Writes files only for in-scope videos (`videos_frames`): into the `exports/` of the video's project. Those not targeting a video (writing output as a file) are not provided. */
  saveRoot(_access: ServiceAccess, opened?: VideoOpenResult): string {
    if (!opened) throw new ToolError('UNKNOWN_TOOL', 'This service cannot write artifacts out as files');
    const project = this.#deps.harness.listProjects().find((p) => p.id === opened.ref.source.projectId);
    if (!project) throw videoNotFound(opened.ref.videoId);
    return path.join(project.path, 'exports');
  }

  /** Exports can only be written into the `exports/` of the video's project (and its existing subdirectories). */
  exportBase(_access: ServiceAccess, opened: VideoOpenResult): { base: string; within: string; ownDefault: boolean } {
    const project = this.#deps.harness.listProjects().find((p) => p.id === opened.ref.source.projectId);
    if (!project) throw videoNotFound(opened.ref.videoId);
    return { base: path.join(project.path, 'exports'), within: project.path, ownDefault: true };
  }

  // ---- Locating ----

  /** Video parameter → in-scope video. By videoId (one opened or listed earlier; rescanned if not found), or by `<projectId>/<relative path>`. */
  async #locate(video: string, access: ServiceAccess): Promise<Located> {
    const projects = await this.#projects();
    let located: Located | null = null;
    const ref = this.#deps.videos.ref(video);
    if (ref) {
      const project = ref.source.projectId ? projects.get(ref.source.projectId) : undefined;
      if (project && inside(ref.path, project.path)) located = { project, dir: ref.path, videoId: ref.videoId, name: ref.name };
    } else {
      const slash = video.indexOf('/');
      const project = slash > 0 ? projects.get(video.slice(0, slash)) : undefined;
      if (project) {
        located = await this.#peek(project, path.resolve(project.path, video.slice(slash + 1)));
      } else {
        located = await this.#byId(video, projects);
      }
    }
    if (!located || !inPolicy(located.videoId, access.policy)) throw videoNotFound(video);
    return located;
  }

  async #byId(videoId: Id, projects: Map<Id, Project>): Promise<Located | null> {
    const known = this.#index.get(videoId);
    const project = known ? projects.get(known.projectId) : undefined;
    if (known && project) {
      const located = await this.#peek(project, known.dir);
      if (located?.videoId === videoId) return located;
    }
    for (const candidate of projects.values()) {
      const found = await this.#scanProject(candidate).catch(() => null);
      const hit = found?.videos.find((v) => v.videoId === videoId);
      if (hit) return { project: candidate, dir: hit.dir, videoId: hit.videoId, name: hit.name };
    }
    return null;
  }

  /** Registered projects, with paths converted to real paths (video locations are all real paths). */
  async #projects(): Promise<Map<Id, Project>> {
    const projects = new Map<Id, Project>();
    for (const project of this.#deps.harness.listProjects()) {
      const real = await fs.realpath(project.path).catch(() => null);
      if (real) projects.set(project.id, { ...project, path: real });
    }
    return projects;
  }

  /** Reads a video directory (by real path) read-only. Empty if it is not a video directory inside a project. */
  async #peek(project: Project, target: string): Promise<Located | null> {
    const dir = await fs.realpath(target).catch(() => null);
    if (!dir || !inside(dir, project.path) || dir === project.path) return null;
    const open = this.#deps.videos.openRefs().find((ref) => ref.path === dir);
    if (open) return { project, dir, videoId: open.videoId, name: open.name };
    try {
      const seen = await this.#deps.videos.peek(dir);
      this.#index.set(seen.videoId, { projectId: project.id, dir });
      return { project, dir, videoId: seen.videoId, name: seen.name };
    } catch {
      return null;
    }
  }

  async #scanProject(project: Project): Promise<{ videos: (Located & { relPath: string })[]; skipped: number }> {
    const scan = await scanDirectory(project.path);
    const videos: (Located & { relPath: string })[] = [];
    let skipped = scan.issue ? 1 : 0;
    for (const file of scan.files) {
      if (file.kind !== 'video') continue;
      const located = await this.#peek(project, path.join(project.path, ...file.relPath.split('/')));
      if (located) videos.push({ ...located, relPath: file.relPath });
      else skipped++;
    }
    return { videos, skipped };
  }
}

function inPolicy(videoId: Id, policy: ServicePolicy): boolean {
  return policy.videos === 'all' || policy.videos.ids.includes(videoId);
}

function inside(candidate: string, root: string): boolean {
  const base = path.resolve(root);
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  return candidate === base || candidate.startsWith(prefix);
}

function videoNotFound(video: string): ToolError {
  return new ToolError('VIDEO_NOT_FOUND', `Video "${video}" not found: use a videoId given by videos_list`);
}

function jobNotFound(jobId: Id): ToolError {
  return new ToolError('JOB_NOT_FOUND', `Job ${jobId} not found, or you did not submit it`);
}
