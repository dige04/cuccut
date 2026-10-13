import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  WEB_READ_METHODS,
  webMethodAccess,
  webTopicAllowed,
  refOf,
  type Localized,
  type RpcMethod,
  type RpcParams,
  type ToolProblem,
  type ToolStatus,
  type WebServiceAccess,
} from '@cuccut/protocol';
import { RcWeb } from '@cuccut/protocol/messages/runtime-core';
import type { Harness } from '@cuccut/harness';
import type { TrustedPrincipal } from '../gateway.ts';
import { sourceRoot as exportSourceRoot } from '../exports/export-publish.ts';
import type { RpcHandlers } from '../handlers.ts';
import type { VideoService } from '../videos/video-service.ts';

/**
 * Restrictions the web service adds on top of the gateway handlers (architecture design §4.8, §12.8). The handlers are the same set the desktop UI uses; only these extra rules apply:
 *
 * - **Allowlist** (`webAuthorize`): checks the method and the subscribed topic before gateway dispatch. Anything outside the allowlist gets `forbidden`. Configuration changes take effect immediately.
 * - **No file access outside the project directory**: `projects.open` only accepts registered projects. The paths of `importAsset` / `relinkAsset` in `edits.apply` (relative to the video directory or absolute) must, by real path, lie inside the project directory of the video (or the working directory of a session that does not belong to a project).
 *   The target directory of `exports.create` must likewise lie inside that directory, and must not be the video directory or `.ccut` (when not given, it defaults to the project's `exports/`).
 *   The files of `space.import` must, by real path, lie inside the project directory. The portable packages of `videos.importPackage` must, by real path, lie inside the source directory of the new video (the project directory, or the working directory of a session that does not belong to a project). Exporting portable packages and projects also goes through the target-directory constraint of `exports.create`.
 * - **Audit**: write-type calls record one recent request (method, target video and result), not the parameter bodies.
 */

export function webAuthorize(method: RpcMethod, params: unknown, access: WebServiceAccess): RpcError | null {
  const verdict = webMethodAccess(method, access);
  if (verdict === 'read-only') {
    return new RpcError('forbidden', RcWeb.webReadOnly({ method }), { code: 'WEB_READ_ONLY', method });
  }
  if (verdict === 'not-allowed') {
    return new RpcError('forbidden', RcWeb.methodNotAllowed({ method }), {
      code: 'WEB_METHOD_NOT_ALLOWED',
      method,
    });
  }
  if (method === 'subscribe') {
    const topic = (params as { topic: string }).topic;
    if (!webTopicAllowed(topic, access)) {
      return new RpcError('forbidden', RcWeb.topicNotAllowed({ topic }), { code: 'WEB_TOPIC_NOT_ALLOWED', topic });
    }
  }
  return null;
}

export interface WebHandlerDeps {
  uploadUrl?: (sessionId: string, url: string) => string;
  harness: Harness;
  videos: VideoService;
  /** End of a write-type call: method, body, target video and result (`ok` or error code). */
  record: (method: RpcMethod, principal: TrustedPrincipal, videoId: string | null, outcome: string) => void;
  /** The current access configuration (allowlist and read-only). The tool catalog uses it to mark tools that cannot be used in the browser. */
  access: () => WebServiceAccess;
}

const READ = new Set<string>(WEB_READ_METHODS);

export function webHandlers(base: RpcHandlers, deps: WebHandlerDeps): RpcHandlers {
  const methods = { ...base.methods } as Record<string, (params: unknown, principal: TrustedPrincipal) => unknown>;

  methods['attachments.prepare'] = async (params, principal) => {
    if (!principal.sessionId || !deps.uploadUrl) throw new RpcError('forbidden', RcWeb.loginRequired());
    const result = await base.methods['attachments.prepare'](params as RpcParams<'attachments.prepare'>, principal);
    return { ...result, uploadUrl: deps.uploadUrl(principal.sessionId, result.uploadUrl) };
  };
  const openProject = base.methods['projects.open'];
  methods['projects.open'] = async (params, principal) => {
    const p = params as RpcParams<'projects.open'>;
    if (!(await registeredProject(deps.harness, p.path))) {
      throw new RpcError('forbidden', RcWeb.projectNotRegistered(), {
        code: 'PROJECT_NOT_REGISTERED',
      });
    }
    return openProject(p, principal);
  };

  const apply = base.methods['edits.apply'];
  methods['edits.apply'] = async (params, principal) => {
    const p = params as RpcParams<'edits.apply'>;
    return apply({ ...p, operations: await confinePaths(deps, p) }, principal);
  };

  const createExport = base.methods['exports.create'];
  methods['exports.create'] = async (params, principal) => {
    const p = params as RpcParams<'exports.create'>;
    const dir = await confineExportDir(deps, p);
    return createExport(dir === undefined ? p : { ...p, destination: { ...p.destination, dir } }, principal);
  };

  const importFile = base.methods['space.import'];
  methods['space.import'] = async (params, principal) => {
    const p = params as RpcParams<'space.import'>;
    return importFile({ ...p, path: await confineImport(deps, p) }, principal);
  };

  // Tool catalog (§7.9): tools whose execution method cannot be called from the browser are marked unavailable (for example the fixed-flow `pipelines.*` is not in the default set).
  // When the save location is not inside any registered project directory, flows that write results to the save location are marked (the browser cannot reach files there).
  const listTools = base.methods['tools.list'];
  methods['tools.list'] = async (params, principal) => {
    const result = await listTools(params as RpcParams<'tools.list'>, principal);
    const access = deps.access();
    const saveOutside = result.saveDirectory !== undefined && !(await insideRegisteredProject(deps.harness, result.saveDirectory));
    // The description of an external tool may contain a local machine path (the reason a probe failed). The browser only gets the error code and tool name, the same way `externalTools.*` is not exposed to the browser.
    const confine = (problems: ToolProblem[]): ToolProblem[] =>
      problems.map((p) => (p.tool ? { ...problemOf(p.code, RcWeb.externalToolUnavailable({ tool: p.tool })), tool: p.tool } : p));
    return {
      tools: result.tools.map((listed) => {
        let tool = { ...listed, problems: confine(listed.problems), limitations: confine(listed.limitations) };
        if (saveOutside) tool = gateSaveLocation(tool);
        const verdict = webMethodAccess(tool.execution.method, access);
        if (verdict === 'allowed') return tool;
        const problem =
          verdict === 'read-only'
            ? problemOf('WEB_READ_ONLY', RcWeb.webReadOnly({ method: tool.execution.method }))
            : problemOf('WEB_METHOD_NOT_ALLOWED', RcWeb.toolMethodNotAllowed({ method: tool.execution.method }));
        return { ...tool, available: false, problems: [...tool.problems, problem] };
      }),
    };
  };

  // The `saveDir` of a direct task (§7.9): the browser can only make the copy write into a registered project directory.
  for (const name of ['models.synthesizeSpeech', 'models.generateImage', 'models.generateMusic', 'models.generateText'] as const) {
    const submit = base.methods[name] as (params: unknown, principal: TrustedPrincipal) => unknown;
    methods[name] = async (params, principal) => {
      const saveDir = (params as { saveDir?: unknown }).saveDir;
      if (typeof saveDir === 'string' && !(await insideRegisteredProject(deps.harness, saveDir))) {
        throw new RpcError('forbidden', RcWeb.saveDirOutsideProject(), { code: 'PATH_OUTSIDE_PROJECT' });
      }
      return submit(params, principal);
    };
  }

  const importPackage = base.methods['videos.importPackage'];
  methods['videos.importPackage'] = async (params, principal) => {
    const p = params as RpcParams<'videos.importPackage'>;
    return importPackage({ ...p, path: await confinePackage(deps, p) }, principal);
  };

  for (const [name, handler] of Object.entries(methods)) {
    if (READ.has(name)) continue;
    methods[name] = async (params, principal) => {
      const videoId = videoIdOf(params);
      try {
        const result = await handler(params, principal);
        deps.record(name as RpcMethod, principal, videoId, 'ok');
        return result;
      } catch (error) {
        deps.record(name as RpcMethod, principal, videoId, outcomeOf(error));
        throw error;
      }
    };
  }
  return { methods: methods as unknown as RpcHandlers['methods'], subscribe: base.subscribe };
}

function saveLocationProblem(): ToolProblem {
  return problemOf('PATH_OUTSIDE_PROJECT', RcWeb.saveLocationOutsideProject());
}

/** The reason for one unavailable item: the text plus a reference. The browser regenerates the text in its own UI language, which may differ from the Runtime's language. */
function problemOf(code: string, message: Localized): ToolProblem {
  return { code, message: message.text, messageRef: refOf(message) };
}

/**
 * When the save location is outside the project directory (§7.9; the browser only touches registered project directories), results written only to the save location are unavailable. Results that can still be written into the video (transcription, translated subtitles) remain available, with file input and writing restricted. The results of direct tasks are in the asset library, which the browser can still read, so they are unaffected.
 */
function gateSaveLocation<T extends Pick<ToolStatus, 'execution' | 'results' | 'problems' | 'limitations' | 'available'>>(tool: T): T {
  if (tool.execution.kind !== 'pipeline' || !tool.results.includes('artifact')) return tool;
  if (tool.results.includes('video')) return { ...tool, limitations: [...tool.limitations, saveLocationProblem()] };
  return { ...tool, available: false, problems: [...tool.problems, saveLocationProblem()] };
}

/** The directory (it may not exist yet; its real path is taken from the nearest existing ancestor) is inside a registered project directory. */
async function insideRegisteredProject(harness: Harness, dir: string): Promise<boolean> {
  if (!path.isAbsolute(dir)) return false;
  let existing = path.resolve(dir);
  let rest = '';
  let real: string | null = null;
  for (;;) {
    real = await fs.realpath(existing).catch(() => null);
    if (real || path.dirname(existing) === existing) break;
    rest = path.join(path.basename(existing), rest);
    existing = path.dirname(existing);
  }
  if (!real) return false;
  const target = path.join(real, rest);
  for (const project of harness.listProjects()) {
    const root = await fs.realpath(project.path).catch(() => null);
    if (root && within(target, root)) return true;
  }
  return false;
}

/** Registered projects (compared by real path). */
async function registeredProject(harness: Harness, target: string): Promise<boolean> {
  if (!path.isAbsolute(target)) return false;
  const real = await fs.realpath(target).catch(() => null);
  if (!real) return false;
  for (const project of harness.listProjects()) {
    if ((await fs.realpath(project.path).catch(() => null)) === real) return true;
  }
  return false;
}

/**
 * Files for `space.import`: relative to the project directory or absolute. By real path they must lie inside the project directory (the browser cannot copy files from outside the project).
 * The real path is handed to the handler, so no symbolic link is traversed between the check and the use.
 */
async function confineImport(deps: WebHandlerDeps, params: RpcParams<'space.import'>): Promise<string> {
  const project = deps.harness.listProjects().find((p) => p.id === params.projectId);
  if (!project) throw new RpcError('not-found', RcWeb.projectNotFound());
  const rootReal = await fs.realpath(project.path).catch(() => null);
  const real = await fs.realpath(path.resolve(project.path, params.path)).catch(() => null);
  if (!rootReal || !real) throw new RpcError('not-found', RcWeb.fileMissing());
  if (real === rootReal || !within(real, rootReal)) {
    throw new RpcError('forbidden', RcWeb.importOutsideProject(), { code: 'PATH_OUTSIDE_PROJECT' });
  }
  return real;
}

/**
 * The package for `videos.importPackage`: relative to the source directory or absolute. By real path it must lie inside the source directory of the new video (the browser cannot read files outside the project, nor can it follow a symbolic link elsewhere).
 * The real path is handed to the handler.
 */
async function confinePackage(deps: WebHandlerDeps, params: RpcParams<'videos.importPackage'>): Promise<string> {
  let root: string;
  if (params.projectId) {
    const project = deps.harness.listProjects().find((p) => p.id === params.projectId);
    if (!project) throw new RpcError('not-found', RcWeb.projectNotFound());
    root = project.path;
  } else {
    const { conversation } = deps.harness.getConversation(params.conversationId!);
    root = conversation.projectId
      ? sourceRoot(deps.harness, { projectId: conversation.projectId, conversationId: null })
      : conversation.cwd;
  }
  const rootReal = await fs.realpath(root).catch(() => null);
  const real = await fs.realpath(path.isAbsolute(params.path) ? params.path : path.resolve(root, params.path)).catch(() => null);
  if (!rootReal || !real) throw new RpcError('not-found', RcWeb.packageNotFound(), { code: 'PACKAGE_NOT_FOUND' });
  if (real === rootReal || !within(real, rootReal)) {
    throw new RpcError('forbidden', RcWeb.packageOutsideProject(), { code: 'PATH_OUTSIDE_PROJECT' });
  }
  return real;
}

/** Turns the paths of `importAsset` / `relinkAsset` into real paths and confirms they lie inside the video's source directory. */
async function confinePaths(deps: WebHandlerDeps, params: RpcParams<'edits.apply'>): Promise<RpcParams<'edits.apply'>['operations']> {
  const ops = params.operations as unknown as Record<string, unknown>[];
  if (!ops.some(hasPath)) return params.operations;
  const ref = deps.videos.ref(params.videoId);
  if (!ref) throw new RpcError('not-found', RcWeb.videoNotOpen());
  const root = sourceRoot(deps.harness, ref.source);
  const rootReal = await fs.realpath(root).catch(() => null);
  if (!rootReal) throw new RpcError('not-found', RcWeb.videoProjectDirMissing());
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  const confined: Record<string, unknown>[] = [];
  for (const [index, op] of ops.entries()) {
    if (!hasPath(op)) {
      confined.push(op);
      continue;
    }
    const given = op.path as string;
    const real = await fs.realpath(path.isAbsolute(given) ? given : path.resolve(ref.path, given)).catch(() => null);
    if (!real || (real !== rootReal && !real.startsWith(prefix))) {
      throw new RpcError('forbidden', RcWeb.operationOutsideProject({ ordinal: index + 1 }), {
        code: 'PATH_OUTSIDE_PROJECT',
        index,
      });
    }
    confined.push({ ...op, path: real });
  }
  return confined as unknown as RpcParams<'edits.apply'>['operations'];
}

/**
 * The target directory of `exports.create`: when given, by real path it must lie inside the video's source directory, already exist, and not be inside the video directory (including `video.db`) or `.ccut`. The real path is handed to the export service. When not given, the default `exports/` (if it already exists) is checked so that it does not point elsewhere through a symbolic link.
 */
async function confineExportDir(deps: WebHandlerDeps, params: RpcParams<'exports.create'>): Promise<string | undefined> {
  const ref = deps.videos.ref(params.videoId);
  if (!ref) return undefined; // The video is not open: let the export service answer
  const rootReal = await fs.realpath(sourceRoot(deps.harness, ref.source)).catch(() => null);
  if (!rootReal) throw new RpcError('not-found', RcWeb.videoProjectDirMissing());
  const refuse = () => new RpcError('forbidden', RcWeb.exportOutsideProject(), { code: 'PATH_OUTSIDE_PROJECT' });
  const given = params.destination?.dir;
  if (given === undefined) {
    const real = await fs.realpath(path.join(exportSourceRoot(ref), 'exports')).catch(() => null);
    if (real !== null && !within(real, rootReal)) throw refuse();
    return undefined;
  }
  const target = path.isAbsolute(given) ? given : path.resolve(rootReal, given);
  const real = await fs.realpath(target).catch(() => null);
  if (!real) {
    if (!within(path.resolve(target), rootReal)) throw refuse();
    throw new RpcError('conflict', RcWeb.exportDirMissing(), {
      code: 'EXPORT_DESTINATION_UNWRITABLE',
      recovery: RcWeb.exportDirRecovery().text,
    });
  }
  if (!within(real, rootReal)) throw refuse();
  const relative = path.relative(rootReal, real);
  if (relative.split(path.sep).includes('.ccut')) throw refuse();
  for (let dir = real; ; dir = path.dirname(dir)) {
    if (
      await fs.stat(path.join(dir, 'video.db')).then(
        () => true,
        () => false,
      )
    )
      throw refuse();
    if (dir === rootReal) break;
  }
  return real;
}

function within(real: string, rootReal: string): boolean {
  return real === rootReal || real.startsWith(rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep);
}

function hasPath(op: Record<string, unknown>): boolean {
  return (op.type === 'importAsset' || op.type === 'relinkAsset') && typeof op.path === 'string';
}

function sourceRoot(harness: Harness, source: { projectId: string | null; conversationId: string | null }): string {
  if (source.projectId) {
    const project = harness.listProjects().find((p) => p.id === source.projectId);
    if (project) return project.path;
  }
  if (source.conversationId) return harness.getConversation(source.conversationId).conversation.cwd;
  throw new RpcError('not-found', RcWeb.videoProjectMissing());
}

function videoIdOf(params: unknown): string | null {
  // The video parameter of `compositions.*` is named `video`, the same as in the tools.
  const p = params as { videoId?: unknown; video?: unknown } | null;
  const videoId = p?.videoId ?? p?.video;
  return typeof videoId === 'string' ? videoId : null;
}

function outcomeOf(error: unknown): string {
  if (!(error instanceof RpcError)) return 'internal';
  const code = (error.details as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : error.code;
}
