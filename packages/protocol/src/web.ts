import type { FileTarget, RpcMethod } from './methods.ts';

/**
 * Web service (architecture design §4.8, §12.8): the client in the local browser. The browser gets a scope-limited gateway connection: methods and topics are filtered by an allowlist, and the operator is the user themselves (`user_local`), not `external:web`.
 *
 * - Login: the desktop UI or CLI calls `services.web.createAccessLink` to get a link carrying a one-time code (the code is in the URL fragment, so it does not go into server logs or Referer). The page exchanges the code for a session cookie (HttpOnly, SameSite=Strict). The code is invalid once used or after it expires.
 * - The capability set is a method allowlist (method name or `<namespace>.*`), default `WEB_DEFAULT_METHODS`. Service configuration can only narrow it within that set, or make it read-only (leaving only `WEB_READ_METHODS`). Settings, credentials, management of external services and nodes are not in it, and configuration cannot add them.
 */

/** Default port of the Web service (loopback). Adjacent to the MCP service (47620) and the model API service (47621). If the port is occupied, the service enters `error` and does not switch ports. */
export const WEB_DEFAULT_PORT = 47622;
/** Validity period of the one-time code in an access link. */
export const WEB_ACCESS_CODE_TTL_MS = 2 * 60_000;
/** Validity period of a browser session (counted from login). All sessions are invalidated when the service stops. */
export const WEB_SESSION_TTL_MS = 12 * 60 * 60_000;

/**
 * Default capability set: the desktop UI's protocol, minus changes to settings, model service configuration and credentials, management of external services (`services.*`, including `services.mcp.*`, `services.modelApi.*` and issuing access links), and node pairing and sharing.
 * Content namespaces are open as a whole (when methods are added to these namespaces later, confirm under §12.8 that they do not go beyond the project directory). Management namespaces are listed one by one.
 * Methods with path parameters have further constraints in the Web service's handlers: `projects.open`; the asset paths of `edits.apply`; the target directory of `exports.create`; the file for `space.import` (must be a file in the project directory); and the portable package for `videos.importPackage` (must be a file in the project or session working directory).
 *
 * Fixed pipelines (`pipelines.*`) are not in it. The input and `outDir` of file transcoding are arbitrary absolute paths, not bound to the project directory. To open them, first add the same path constraint as `exports.create`. Names not listed here cannot be called from the browser at all.
 *
 * Installation management of local model packages (`models.install`, `models.repair`, `models.cancelInstall`, `models.remove`, `models.test`) is also not in it. Installing and repairing make this machine download several hundred MB from the network and write into the model directory, and deletion makes local transcription unavailable. This is management of this machine, and like the configuration of model services, it is done only in the desktop UI and CLI. The browser can see status and progress in `models.list` and the `models` topic. `jobs.cancel` can stop an install job (equivalent to pausing; the staging area is kept). The model directory (`models.getDir`, `models.inspectDir`, `models.setDir`) is likewise not exposed: changing it moves several GB of files and picks a local folder, and the result contains a local path. The settings page in the browser does not show the model directory card.
 *
 * Managed external tools (`externalTools.*`, §12.9) are not in it at all, not even `list`. Installation, specifying paths and consent decisions determine which third-party program this machine downloads and runs, and the status contains local paths. Import from a link (`link-import` of `pipelines.start`) is not exposed, together with `pipelines.*`.
 */
export const WEB_DEFAULT_METHODS: readonly string[] = [
  'runtime.info',
  'agents.list',
  'agents.respondToApproval',
  'agents.interrupt',
  'projects.list',
  // Can only open registered projects (the Web service checks again in its handler).
  'projects.open',
  'projects.create',
  'projects.update',
  // Project file browsing and creation (architecture design §11.2 “Project file browsing”): only within the project directory (or the working directory of a session with no project). Judged by real path, never escaping the root directory. File contents go through the controlled handles of `media.*`. Creation is exclusive (create only, no overwrite) (§12.8).
  'projects.files.list',
  'projects.files.create',
  'conversations.*',
  'attachments.prepare',
  'tasks.*',
  'space.*',
  'media.*',
  // Slides (docs/design/slides §6.1): can only be opened by real path within the source directory. They can still be opened under read-only configuration, but publishing is rejected by the router.
  'slides.open',
  // Design canvases (docs/design/canvas §6.1): same as slides. The editor is on another loopback hostname, and the router only accepts a grant (§6.2).
  'design.open',
  // Design systems (docs/design/canvas §10.4): same as design canvases. The editor is on the same isolated hostname.
  'designSystem.open',
  'videos.*',
  'documents.*',
  'edits.*',
  // Code view (architecture design §8): listed one by one. Directory parameters can only be within the video's source directory (the project directory, or the working directory of a session that does not belong to a project), checked by real path.
  // Preview frames are written under `.cuccut-out/frames/` in the source directory (§12.8).
  'compositions.preview',
  'compositions.import',
  // Includes `jobs.reconcile` (architecture design §7.5). Reconciliation is the user's decision, and the user in the browser can make it too. Not exposed in read-only mode.
  'jobs.*',
  'artifacts.*',
  'exports.*',
  'models.list',
  'models.capabilities',
  'models.transcribe',
  'models.synthesizeSpeech',
  'models.generateImage',
  'models.generateMusic',
  'models.generateText',
  // Usage (§6.10) is read-only, contains no keys or local paths, and is also in the read-only set. Account write methods (`models.addAccount` etc.) are not exposed, the same as `models.configure`.
  'models.usage',
  // The tool catalog and candidate inputs (§7.9) are read-only and listed one by one (not `tools.*`). Tools whose execution methods are not in the allowlist are marked unavailable in the catalog.
  'tools.list',
  'tools.candidates',
  'nodes.list',
  'nodes.discover',
  'settings.get',
  // The creation template catalog (template package spec §6) is read-only. Handles are only issued for bundled files listed in the manifest.
  'templates.*',
  // Agent skills (§3.8): viewing and toggling are listed one by one. Adding, importing and removing (`skills.add`, `skills.importGithub`, `skills.remove`, §12.9) are not exposed. They write to or delete directories in the Runtime Home, and take content from an arbitrary local folder or the network. Like the installation of managed external tools, they are done only in the desktop UI and CLI.
  'skills.list',
  'skills.get',
  'skills.readFile',
  'skills.setEnabled',
  // The user's profile (docs/cuccut/m2-profile-rules.md §4): read only. Preferences and rules are changed in the desktop UI and the CLI, like settings.
  'profile.get',
  'profile.getProject',
  // The review gate (docs/cuccut/m2-review-gate.md §4.5): reading the standard, checking and running reviews, and the per-video decisions
  // (waivers and severities are ordinary edits of the video, like `edits.*`). Listed one by one: `review.criteria.set` (the user's standard,
  // like settings) is not exposed, so the browser's Settings › Review is read-only ("Desktop only").
  'review.catalogue',
  'review.criteria.get',
  'review.check',
  'review.run',
  'review.get',
  'review.waive',
  'review.unwaive',
  'review.severity',
  // Packs (pack spec §8): the list, the pack page (with handles for its reference stills and videos), the active style guide and a project's style choice, listed one by
  // one. Inspect, install, remove, restore, export and editing the guide or its reference files (`packs.inspect`, `packs.install`, `packs.remove`, `packs.restore`,
  // `packs.export`, `packs.setStyle`, `packs.addExample`, `packs.updateExample`, `packs.removeExample`, `packs.restoreExample`) are not exposed: like adding a skill, they
  // write to the Runtime Home or to an arbitrary folder, read from the network or the disk, and decide what text every later agent follows. They are done only in the
  // desktop UI and CLI.
  'packs.list',
  'packs.get',
  'packs.openHandle',
  'packs.active',
  'packs.choose',
];

/** Methods still available under read-only configuration (listed one by one: methods added later are not exposed under read-only by default). */
export const WEB_READ_METHODS: readonly RpcMethod[] = [
  'runtime.info',
  'models.usage',
  'agents.list',
  'projects.list',
  'projects.files.list',
  'conversations.list',
  'conversations.get',
  'tasks.getContract',
  'tasks.listContracts',
  'tasks.listChecks',
  'space.list',
  'space.get',
  'space.search',
  'space.openForEdit',
  'space.thumbnail',
  'media.resolve',
  'media.playback',
  'media.subtitles',
  'media.peaks',
  'media.thumbnail',
  'slides.open',
  'design.open',
  'designSystem.open',
  'videos.open',
  'videos.close',
  'videos.history',
  'videos.assetStatus',
  'documents.read',
  'edits.undoState',
  'exports.get',
  'exports.list',
  'exports.renderText',
  'models.list',
  'models.capabilities',
  'jobs.list',
  'jobs.inspect',
  'jobs.resources',
  'artifacts.openHandle',
  'tools.list',
  'tools.candidates',
  'nodes.list',
  'nodes.discover',
  'settings.get',
  'templates.list',
  'templates.get',
  'templates.openHandle',
  'skills.list',
  'skills.get',
  'skills.readFile',
  'profile.get',
  'profile.getProject',
  'review.catalogue',
  'review.criteria.get',
  'review.get',
  'review.check',
  'packs.list',
  'packs.get',
  'packs.openHandle',
  'packs.active',
];

/** Subscribing to these topics requires the matching read method in the allowlist. Other topics (directories, sessions, tasks, Space, videos) are open with the session. */
export const WEB_TOPIC_METHODS: Readonly<Record<string, RpcMethod>> = {
  settings: 'settings.get',
  services: 'services.list',
  models: 'models.capabilities',
  jobs: 'jobs.list',
  // The user library (§5.9) is not yet exposed to the browser. `library.*` is not in the default set, so topics cannot be subscribed to either.
  library: 'library.list',
  // Authorizations and budgets for data egress (§12.5) are not exposed to the browser. `grants.*` is not in the default set, so topics cannot be subscribed to either. Grants are issued and revoked only in the desktop and CLI.
  grants: 'grants.list',
  // Agent probe results and preferences (§3.11): the same view as `agents.list`.
  agents: 'agents.list',
  // The import prompts and import progress for legacy projects (§2.7) are only for the desktop UI. `legacyImport.*` is not in the default set, so topics cannot be subscribed to either.
  'legacy-import': 'legacyImport.get',
  // The user's profile: the same view as `profile.get`.
  profile: 'profile.get',
  // The review gate (§4.5): the user's standard and the summaries of reviewed videos, the same data as `review.get`.
  review: 'review.get',
};

/** One item in the allowlist: a method name, or `<namespace>.*` (including deeper sub-namespaces). */
export const WEB_METHOD_PATTERN = /^[A-Za-z]+(\.[A-Za-z]+)*(\.\*)?$/;

export function methodMatches(pattern: string, method: string): boolean {
  return pattern.endsWith('.*') ? method.startsWith(pattern.slice(0, -1)) : pattern === method;
}

/** Access configuration of the Web service. */
export interface WebServiceAccess {
  /** Read-only: only `WEB_READ_METHODS` remains (intersected with the allowlist). */
  readOnly: boolean;
  /** Configured allowlist. null means the default set `WEB_DEFAULT_METHODS`. */
  methods: string[] | null;
}

/**
 * Whether a method is available to a browser session. `subscribe` / `unsubscribe` are always available (topics are checked separately, see `webTopicAllowed`).
 * The configured allowlist can only narrow: a method must be in both the default set and the configuration.
 */
export function webMethodAccess(method: string, access: WebServiceAccess): 'allowed' | 'not-allowed' | 'read-only' {
  if (method === 'subscribe' || method === 'unsubscribe') return 'allowed';
  const inDefault = WEB_DEFAULT_METHODS.some((p) => methodMatches(p, method));
  const inConfig = access.methods === null || access.methods.some((p) => methodMatches(p, method));
  if (!inDefault || !inConfig) return 'not-allowed';
  if (access.readOnly && !(WEB_READ_METHODS as readonly string[]).includes(method)) return 'read-only';
  return 'allowed';
}

export function webTopicAllowed(topic: string, access: WebServiceAccess): boolean {
  const method = WEB_TOPIC_METHODS[topic];
  return method === undefined || webMethodAccess(method, access) === 'allowed';
}

/** Metadata of one browser session. The session token is only in the cookie. The Runtime stores only its hash. */
export interface WebSession {
  sessionId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  /** Number of gateway connections this session has right now. */
  connections: number;
  /** The browser's User-Agent at login (truncated), used to recognize which browser it is. */
  userAgent: string | null;
}

/** Result of `services.web.createAccessLink`. The code in `url` can be used only once, and it is invalid after `expiresAt`. */
export interface WebAccessLink {
  url: string;
  expiresAt: string;
}

/**
 * Format of a file target in the query string of an in-app link: after `video=` / `file=` comes the FileTarget as JSON (URL-encoded). The UI's routing (the shell-store in `packages/ui`) and the Web service's access links both use it, rather than each building its own copy.
 */
export function fileTargetQuery(kind: 'video' | 'file', target: FileTarget): string {
  return new URLSearchParams({ [kind]: JSON.stringify(target) }).toString();
}

/**
 * In-app link that opens a video's editor directly: Home's feature area has this video open (`/home?video=<JSON FileTarget>`), the same as `hrefFor({ tab: 'home', conversationId: null, projectId: null, pane: { kind: 'video', target } })` in the UI.
 * `services.web.createAccessLink { video }` puts it in the link's path and query (the code is still only in the fragment).
 */
export function webVideoHref(target: FileTarget): string {
  return `/home?${fileTargetQuery('video', target)}`;
}
