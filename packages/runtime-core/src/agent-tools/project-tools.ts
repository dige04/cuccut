import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Harness } from '@cuccut/harness';
import { RpcError, type RiskLevel } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { VideoService } from '../videos/video-service.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import type { AgentPrincipal } from './grants.ts';
import { approvalField, confirmSummary, scopedProject, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * Project tools (agent surface design §4.3): list registered projects within scope (`projects_list`), and create and
 * register a project on a directory (`projects_create`).
 *
 * - `projects_list` is on all three surfaces; its scope comes from `ToolScope.listProjects`: a session sees only the
 *   project it belongs to, an external service sees only the projects of videos within its scope (all registered
 *   projects, without paths, when it has all videos), and the terminal sees everything.
 * - `projects_create` is only on the tool bridge and the CLI (external services do not create projects). `path` is
 *   relative to the session's working directory or the terminal's cwd (`ToolScope.saveRoot`); absolute paths are
 *   accepted. A missing directory is created; an existing one is registered as is (same as `projects.open`, writing
 *   `.ccut/project.json`). In a session it is `edit` inside the working directory and outside it, it counts as writing
 *   outside the project directory (`high`), confirmed according to the access mode; the terminal skips approval. An already
 *   registered project is returned as is, without confirmation or renaming.
 * - `projects_adopt_session` is only on the tool bridge: when the user explicitly asks for a project, it moves a session
 *   that belongs to no project into a new project under the default projects directory (named by default after the
 *   session's earliest video, `Harness.ensureConversationProject`, architecture design §3.10); the session's videos and
 *   files move there and work continues inside the project. It only writes a newly created directory under CucCut's
 *   projects directory and moves the session's own working directory, overwriting no files, so it is confirmed as
 *   `edit`. A session that already belongs to a project gets that project back as is. If videos in the working
 *   directory are still open in the UI, a task or another connection, it refuses (`VIDEO_IN_USE`) and changes nothing.
 */

export interface ProjectToolsDeps {
  harness: Pick<Harness, 'listProjects' | 'openProject' | 'updateProject' | 'getConversation' | 'ensureConversationProject'>;
  videos: Pick<VideoService, 'claimProjectVideos' | 'openRefs' | 'close'>;
  scope: ToolScope;
}

const schemas = {
  projects_list: z.strictObject({}),
  projects_create: z.strictObject({
    path: z.string().min(1).max(1000).describe('Project directory: relative to the working directory (the current directory in the terminal), or absolute; created if missing, an existing directory is registered as is'),
    name: z.string().trim().min(1).max(200).optional().describe('Optional. Display name of the project; defaults to the directory name'),
  }),
  projects_adopt_session: z.strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. Project name; defaults to the name of the earliest video created in the session, or the session title if there are no videos yet. Only pass it when the user gave a name'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  projects_list: {
    title: 'List projects',
    description: [
      'List the CucCut projects you can use.',
      'Each project: projectId, name, directory (not given to external services) and the number of videos in it (when it can be counted). Use the projectId from here for videos_create\'s project argument (the directory in the terminal).',
      'In a session there is only the project this session belongs to (a session with no project has none; its videos live in its own working directory); external services list only the projects of videos within their access scope.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'List projects', args: {} }],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  projects_create: {
    title: 'Create project',
    description: [
      'Create and register a CucCut project on a directory.',
      'path is relative to the working directory (the current directory in the terminal), or absolute; a missing directory is created, an existing one is registered as is (writing .ccut/project.json and touching no other files). An existing project is returned as is.',
      'In a session: inside the working directory it is confirmed as a normal edit, outside as high risk; the new project appears in the user\'s project list, but this session keeps working in its original working directory. When the user just says "make a project" without giving a directory, use projects_adopt_session.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [
      { title: 'Create a project under the current directory', args: { path: 'my-show' } },
      { title: 'With a name', args: { path: '/Users/me/Videos/episode-12', name: 'Episode 12' } },
    ],
    surfaces: ['agent', 'cli'],
    positional: 'path',
  },
  projects_adopt_session: {
    title: 'Move session into a new project',
    description: [
      'Move this session into a new project, only when the user explicitly asks.',
      'For requests like "make a project" or "put this in a project": creates a project under CucCut\'s projects directory, moves this session\'s videos and files into it, and from then on the session belongs to it.',
      'Without a name, the project is named after the earliest video created in the session (or the session title if there are no videos yet). Do not call it unless the user asked: a session with no project can still create, download and edit videos, which simply stay in the session\'s working directory.',
      'If the session already belongs to a project, that project is returned as is. After the move, the session\'s working directory becomes the project directory. If videos in the working directory are still open in the editor, a task or another connection, it refuses (VIDEO_IN_USE) and changes nothing: ask the user to close those videos and try again.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [
      { title: 'Name it after the video', args: {} },
      { title: 'The user gave a name', args: { name: 'Episode 12' } },
    ],
    surfaces: ['agent'],
  },
};

/** Next step when projects were listed: use one to create a video. */
const LIST_NEXT: Record<ToolPrincipal['kind'], string> = {
  agent: 'When creating a video, pass the projectId as videos_create\'s project; list videos with videos_list.',
  local: 'When creating a video, pass the project directory (path) as videos_create\'s project; list videos with videos_list.',
  service: 'When creating a video, pass the projectId as the project of videos_create (or of a new video from download or transcribe); list videos with videos_list.',
};

/** The way forward when there are no projects at all: each surface can do different things (external services cannot create projects). */
const EMPTY_NEXT: Record<ToolPrincipal['kind'], string> = {
  agent:
    'This session does not belong to any project: for new videos from videos_create or download, omit project and they are created in the session\'s working directory; there is no need to create a project first. When the user explicitly asks for a project, use projects_adopt_session (named after the video by default).',
  local:
    'No projects registered yet: when videos_create gets no project, the video is created in the project the current directory belongs to, or, if there is none, in the CLI project registered under the default projects directory; to put it in a specific directory, first create and register a project there with projects_create.',
  service:
    'There are no projects within the access scope, and external services cannot create projects, so new videos can only be created in registered projects: ask the user to register a project in CucCut (or run cuccut projects create <directory> in a terminal; when CucCut has no projects at all, cuccut mcp install registers the default CLI project); if the access scope is a list of videos, also ask the user to add videos from the project to the scope. Then call projects_list again.',
};

export class ProjectTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: ProjectToolsDeps;

  constructor(deps: ProjectToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'projects_list':
        return this.#list(principal);
      case 'projects_create':
        return this.#create(args as Args<'projects_create'>, principal);
      case 'projects_adopt_session':
        return this.#adoptSession(args as Args<'projects_adopt_session'>, principal);
      default:
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    }
  }

  async #list(principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    const projects = await scope.listProjects(access);
    return { projects, next: projects.length === 0 ? EMPTY_NEXT[principal.kind] : LIST_NEXT[principal.kind] };
  }

  async #create(args: Args<'projects_create'>, principal: ToolPrincipal) {
    const { scope, harness, videos } = this.#deps;
    const access = scope.authorize(principal, true);
    const base = scope.saveRoot(access);
    const target = path.resolve(base, args.path);
    const stat = await fs.stat(target).catch(() => null);
    if (stat && !stat.isDirectory()) {
      throw new ToolError('INVALID_ARGUMENTS', `Not a directory: ${args.path}`, { issues: [{ path: 'path', message: 'Exists but is not a directory' }] });
    }
    const real = stat ? await fs.realpath(target) : null;
    const registered = real ? harness.listProjects().find((p) => p.path === real) : undefined;
    if (registered) {
      return { ...scopedProject(registered), created: false, existing: true, next: nextAfterCreate(principal) };
    }
    const baseReal = await fs.realpath(base).catch(() => path.resolve(base));
    const risk: RiskLevel = inside(real ?? (await nearestReal(target)), baseReal) ? 'edit' : 'high';
    const approval = await scope.confirm(access, {
      tool: 'projects_create',
      targets: [target],
      ...confirmSummary(
        (stat ? RcAgentTools.registerProjectSummary : RcAgentTools.createProjectSummary)({ path: target, name: args.name ?? null }),
      ),
      risk,
    });
    if (!stat) await fs.mkdir(target, { recursive: true });
    let project = await harness.openProject(target);
    // Videos in a copy get new identities in the background (same as `projects.open`).
    void videos.claimProjectVideos(project).catch(() => {});
    if (args.name && args.name !== project.name) project = await harness.updateProject({ projectId: project.id, name: args.name });
    return { ...scopedProject(project), created: !stat, existing: false, ...approvalField(approval), next: nextAfterCreate(principal) };
  }

  async #adoptSession(args: Args<'projects_adopt_session'>, principal: ToolPrincipal) {
    const { scope, harness, videos } = this.#deps;
    const access = scope.authorize(principal, true);
    if (principal.kind !== 'agent') {
      throw new ToolError('UNKNOWN_TOOL', 'No such tool: projects_adopt_session');
    }
    const conversationId = (principal as AgentPrincipal).conversationId;
    const { conversation } = harness.getConversation(conversationId);
    const owned = conversation.projectId ? harness.listProjects().find((p) => p.id === conversation.projectId) : undefined;
    if (owned) return { ...scopedProject(owned), created: false, existing: true, next: ADOPT_NEXT };
    const approval = await scope.confirm(access, {
      tool: 'projects_adopt_session',
      targets: [conversation.cwd],
      ...confirmSummary(RcAgentTools.adoptSessionSummary({ name: args.name ?? null })),
      risk: 'edit',
    });
    // First release videos in the working directory that this agent itself has open, so they can move along; for ones still open in the UI or a task, the Harness refuses to bind (`VIDEO_IN_USE`).
    const cwd = await fs.realpath(conversation.cwd).catch(() => conversation.cwd);
    for (const ref of videos.openRefs()) {
      if (inside(ref.path, cwd)) await videos.close(ref.videoId, principal).catch(() => {});
    }
    let project;
    try {
      project = await harness.ensureConversationProject(conversationId, args.name ? { name: args.name } : {});
    } catch (error) {
      if (error instanceof RpcError && (error.details as { code?: unknown } | undefined)?.code === 'VIDEO_IN_USE') {
        const { videos: names } = error.details as { videos?: unknown };
        throw new ToolError('VIDEO_IN_USE', error.message, { ...(Array.isArray(names) ? { videos: names } : {}), next: ADOPT_BUSY_NEXT });
      }
      throw error;
    }
    return { ...scopedProject(project), created: true, existing: false, ...approvalField(approval), next: ADOPT_NEXT };
  }
}

const ADOPT_NEXT =
  'The session now belongs to this project: new videos without project are created in the project, and videos and files are in the project directory (relative paths unchanged). Tell the user the project\'s name and location.';
const ADOPT_BUSY_NEXT =
  'No project was created; the session and videos stay as they were and work as usual. Tell the user which videos are still open and ask them to close those in the editor (or wait for the task to finish) and then ask again; do not keep retrying on your own.';

function nextAfterCreate(principal: ToolPrincipal): string {
  return principal.kind === 'agent'
    ? 'The project is registered and the user can see it in CucCut\'s project list; this session keeps working in its original working directory, and videos_create cannot create videos in the new project. Tell the user where the project is; to move this session and its videos into a project, use projects_adopt_session.'
    : 'The project is registered: pass this project directory (path) as videos_create\'s project to create videos in it.';
}

/** A path that does not exist yet: find the first existing ancestor, take its real path and append the rest (used to tell whether it is inside the working directory). */
async function nearestReal(target: string): Promise<string> {
  const rest: string[] = [];
  for (let dir = target; ; dir = path.dirname(dir)) {
    const real = await fs.realpath(dir).catch(() => null);
    if (real) return path.join(real, ...rest.reverse());
    if (path.dirname(dir) === dir) return target;
    rest.push(path.basename(dir));
  }
}

function inside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}
