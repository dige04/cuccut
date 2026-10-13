import os from 'node:os';
import path from 'node:path';

/**
 * The layout of the Runtime Home. One Runtime Home corresponds to one Runtime instance (architecture design §2.1).
 *
 * ```text
 * <home>/
 *   runtime.json          discovery info (0600)
 *   runtime.lock          instance lock
 *   store/projects.json   project registry
 *   store/space.json      Space's user marks (favorites, display names, trash) and deleted videos
 *   store/space-artifacts.json  Space's artifact records: derived facts about the tasks that produced artifacts, plus the artifact references kept only for artifact-library sweeps
 *                         and the sweep starting point; not lost when the Job Ledger is pruned
 *   store/conversations/<id>.jsonl  conversations: append-only logs with a header, a snapshot, and item/meta lines; compacted when they grow (architecture design §3.10)
 *   store/jobs.jsonl      background job ledger (transcription, etc.): append-only, fsync on every append, compacted when it grows (architecture design §7.3)
 *   store/applications.jsonl application ledger: records of task results applied to videos, same format as above
 *   store/node-share.json sharing this computer: the switch, node identity, token hashes of paired clients (0600)
 *   store/nodes.json      using other computers: this machine's clientId and paired nodes (tokens are in credential storage) (0600)
 *   store/model-services.json   model service config: each Provider's switch and endpoint, each capability's defaults (0600)
 *   store/model-credentials.json file-backend credentials: Provider keys and node tokens, secrets only (0600)
 *   store/usage.jsonl     usage ledger for online calls: one line per call, append-only (0600, architecture design §6.10)
 *   store/settings.json   preferences held by the Runtime: stores only values that differ from the defaults (architecture design §5.10)
 *   store/services.json   external service config: started with the Runtime, port, access policy, hashes of client tokens (architecture design §4.8) (0600)
 *   store/review-criteria.json the user's review standard: measured checks and judged questions a finished video is held to (docs/cuccut/m2-review-gate.md)
 *   store/agent-probes.json Agent probe cache: each Driver's machine facts from its most recent probe, used first at startup (architecture design §3.11)
 *   staging/jobs/<id>/    Worker output for a task in progress, deleted when it ends
 *   staging/node-jobs/<id>/ remote tasks submitted by other machines: uploaded media and results, deleted with the task
 *   artifacts/<sha256>.<extension>  content-addressed artifact library: transcription results, synthesized audio and images, exported files, etc. The `artifactId` with
 *                         `sha256:` removed is the file name. The Runtime sweeps in the background: files that neither the ledger nor the Space artifact records reference, whose modification time is over 1 hour old,
 *                         and that are not earlier than the sweep starting point, are deleted. Leftover `.tmp` files older than 1 hour are deleted (architecture design §7.3)
 *   models/<org>/<repo>/  default location of local model files (the `models.dir` setting can change it; `CUCCUT_MODELS_DIR` takes precedence)
 *   scratch/<id>/         where older versions put the working directories of sessions without a project; moved to `scratchDir` at startup (architecture design §3.10)
 *   cache/                derived cache, with a total size limit (setting `cache.maxSizeMiB`, default 2048 MiB). When over the limit, the oldest by modification time are deleted,
 *                         down to 90% of the limit. `content-index/` and `cuccut-composition-host/` are not deleted (`cache-limit.ts`)
 *   cache/media/<digest>/    analysis results for media (waveform peaks, thumbnails, frames), stored by content digest; they are regenerated if deleted. `cache/media/playback/`
 *                         holds playback transcodes, and `cache/media/files/` holds file frames
 *   cache/content-index/index.db content index for cross-video search: SQLite + FTS5 (architecture design §5.11). If deleted, it is re-read. Not deleted while running
 *   cache/cuccut-composition-host/ scripts for the code-picture host
 *   library/<glossaries|voices|brand>/<id>/ user library entries (architecture design §5.9): the entry header, each version's content, and files named by digest
 *   logs/runtime.log
 * ```
 *
 * The directories of “New project” are not in Home; they are in `projectsDir`: by default `~/CucCut`.
 * When `CUCCUT_HOME` is set (development, testing), they follow it to `<home>/projects`. `CUCCUT_PROJECTS_DIR` can override this.
 * Working directories of sessions without a project (`scratchDir`, one subdirectory per session, where videos can stay indefinitely) are placed in the system's application data directory (`defaultSessionsDir`).
 * When Home is not the default `~/.cuccut` (development, testing), they follow it to `<home>/scratch`. `CUCCUT_SESSIONS_DIR` can override this. The choice follows the location of Home, not
 * whether `CUCCUT_HOME` is given. The desktop app always supplies it when it launches the Runtime.
 */
export interface RuntimeHome {
  root: string;
  discoveryFile: string;
  lockFile: string;
  projectsFile: string;
  spaceFile: string;
  /** Space's artifact records (architecture design §5.7). */
  spaceArtifactsFile: string;
  conversationsDir: string;
  /** Working directory of sessions without a project (architecture design §3.10). */
  scratchDir: string;
  /** The old place for working directories of sessions without a project (`<home>/scratch`). null when it is the same as `scratchDir`. Moved there at startup. */
  legacyScratchDir: string | null;
  cacheDir: string;
  logsDir: string;
  projectsDir: string;
  jobsFile: string;
  nodeShareFile: string;
  /** Initiating side: paired nodes. Tokens are in credential storage (node protocol spec §11). */
  nodesFile: string;
  /** Model service config (architecture design §6.8). */
  modelServicesFile: string;
  /** Credentials for the file backend (Provider keys and node tokens), stored separately from the rest of the config. The keychain backend reads it only during migration (architecture design §6.8). */
  modelCredentialsFile: string;
  /** Preferences (architecture design §5.10). */
  settingsFile: string;
  /** External service config (architecture design §4.8). */
  servicesFile: string;
  /** The ledger of authorizations and budgets for outbound data (architecture design §12.5, §7.8). */
  grantsFile: string;
  /** The usage ledger for online calls (architecture design §6.10). */
  usageFile: string;
  /** Agent preferences: each Driver's default model, permission policy, and “always allow” rules (the default Driver and mode are in Settings). */
  agentPrefsFile: string;
  /** Agent probe cache: each Driver's machine facts from its most recent probe (architecture design §3.11). Deleting it only means the next startup has to probe from scratch. */
  agentProbesFile: string;
  /** ACP agents added by the user (`agents.addProvider`, architecture design §3.11). `env` may contain secrets, so the file is readable and writable only by its owner. */
  agentProvidersFile: string;
  /** Agent skill toggles. Stores only the differences from the source's defaults (architecture design §3.8). */
  skillPrefsFile: string;
  /** The user's review standard (docs/cuccut/m2-review-gate.md §3.3). Missing means the built-in checks only. */
  reviewCriteriaFile: string;
  /** Agent skills added and imported by the user, one subdirectory each (architecture design §3.8, §12.9). */
  skillsDir: string;
  /** Bytes of message attachments (images), in directories by attachment id. */
  attachmentsDir: string;
  stagingDir: string;
  nodeJobsDir: string;
  artifactsDir: string;
  modelsDir: string;
  /** The user library (architecture design §5.9). It is not a Space source directory. */
  libraryDir: string;
}

export function resolveRuntimeHome(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  userHome: string = os.homedir(),
): RuntimeHome {
  const defaultRoot = path.join(userHome, '.cuccut');
  const root = path.resolve(env.CUCCUT_HOME || defaultRoot);
  const projectsDir = env.CUCCUT_PROJECTS_DIR
    ? path.resolve(env.CUCCUT_PROJECTS_DIR)
    : env.CUCCUT_HOME
      ? path.join(root, 'projects')
      : path.join(userHome, 'CucCut');
  const homeScratch = path.join(root, 'scratch');
  const isDefaultRoot = platform === 'win32' ? root.toLowerCase() === defaultRoot.toLowerCase() : root === defaultRoot;
  const scratchDir = env.CUCCUT_SESSIONS_DIR
    ? path.resolve(env.CUCCUT_SESSIONS_DIR)
    : isDefaultRoot
      ? defaultSessionsDir(env, platform, userHome)
      : homeScratch;
  return {
    root,
    discoveryFile: path.join(root, 'runtime.json'),
    lockFile: path.join(root, 'runtime.lock'),
    projectsFile: path.join(root, 'store', 'projects.json'),
    spaceFile: path.join(root, 'store', 'space.json'),
    spaceArtifactsFile: path.join(root, 'store', 'space-artifacts.json'),
    conversationsDir: path.join(root, 'store', 'conversations'),
    scratchDir,
    legacyScratchDir: path.resolve(scratchDir) === path.resolve(homeScratch) ? null : homeScratch,
    cacheDir: path.join(root, 'cache'),
    logsDir: path.join(root, 'logs'),
    projectsDir,
    jobsFile: path.join(root, 'store', 'jobs.jsonl'),
    nodeShareFile: path.join(root, 'store', 'node-share.json'),
    nodesFile: path.join(root, 'store', 'nodes.json'),
    modelServicesFile: path.join(root, 'store', 'model-services.json'),
    modelCredentialsFile: path.join(root, 'store', 'model-credentials.json'),
    settingsFile: path.join(root, 'store', 'settings.json'),
    servicesFile: path.join(root, 'store', 'services.json'),
    grantsFile: path.join(root, 'store', 'grants.json'),
    usageFile: path.join(root, 'store', 'usage.jsonl'),
    agentPrefsFile: path.join(root, 'store', 'agent-prefs.json'),
    agentProbesFile: path.join(root, 'store', 'agent-probes.json'),
    agentProvidersFile: path.join(root, 'store', 'agent-providers.json'),
    skillPrefsFile: path.join(root, 'store', 'skill-prefs.json'),
    reviewCriteriaFile: path.join(root, 'store', 'review-criteria.json'),
    skillsDir: path.join(root, 'skills'),
    attachmentsDir: path.join(root, 'attachments'),
    stagingDir: path.join(root, 'staging'),
    nodeJobsDir: path.join(root, 'staging', 'node-jobs'),
    artifactsDir: path.join(root, 'artifacts'),
    modelsDir: env.CUCCUT_MODELS_DIR ? path.resolve(env.CUCCUT_MODELS_DIR) : path.join(root, 'models'),
    libraryDir: path.join(root, 'library'),
  };
}

/**
 * The place for sessions without a project, in the system's application data directory: on macOS `~/Library/Application Support/CucCut/Sessions`;
 * on Windows `%LOCALAPPDATA%\CucCut\Sessions` (not synced with roaming profiles, because it holds media); elsewhere `${XDG_DATA_HOME:-~/.local/share}/CucCut/Sessions`.
 */
export function defaultSessionsDir(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, userHome = os.homedir()): string {
  if (platform === 'darwin') return path.posix.join(userHome, 'Library', 'Application Support', 'CucCut', 'Sessions');
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(userHome, 'AppData', 'Local'), 'CucCut', 'Sessions');
  return path.posix.join(env.XDG_DATA_HOME || path.posix.join(userHome, '.local', 'share'), 'CucCut', 'Sessions');
}
