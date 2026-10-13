import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import type { RuntimeDiscovery } from '@cuccut/protocol';
import { isProcessAlive, readDiscovery, type RuntimeHome } from '@cuccut/runtime-storage';
import { M } from './main-copy.ts';
import { packagedResourceEnv, type PackagedResources } from './packaged-resources.ts';
import { stopChild } from './stop-child.ts';

export interface ConnectionTarget {
  endpoint: string;
  token: string;
}

export interface RuntimeSupervisorOptions {
  home: RuntimeHome;
  /** Launch history migration for the default desktop Home (including dev mode). Off by default when an explicit sandbox is set. */
  legacyAutoDetect?: boolean;
  /** The built Runtime entry point (out/main/runtime.js). */
  script: string;
  allowedOrigins: string[];
  /** Also writes the Runtime's logs to the main process's stderr (for development). */
  echoLogs: boolean;
  /**
   * Credential backend (architecture design §6.8): release builds use the system's secure storage (through `credential-helper` in `<resources>/bin`); development uses a plaintext file.
   * It is determined by the build type, not by a user setting.
   */
  credentialStore: 'file' | 'keychain';
  /**
   * What a packaged app ships with (`packaged-resources.ts`): native programs (the Worker, the credential helper), built-in templates (template package specification §6), built-in agent skills
   * (architecture design §3.8), model data read by path (the Model Worker reads it, so it is outside the asar), and the web client. All of these are under `<resources>`, and the main process tells the Runtime about them via
   * environment variables. In development this is null, and the Runtime finds them itself in the repository.
   */
  resources: PackagedResources | null;
  /**
   * The system's Downloads folder (Electron's `app.getPath('downloads')`): used for imports from a link when no download directory is set. It recognises the known folders that Windows has moved and the Linux XDG directories
   * (for example `~/下载`); the Runtime alone can only guess `~/Downloads`. null if it cannot be obtained.
   */
  downloadsDir: string | null;
  /**
   * The system's Documents folder (`app.getPath('documents')`): the default directory offered when importing legacy projects is under it (architecture design §2.7). null if it cannot be obtained,
   * in which case the Runtime uses `~/Documents`.
   */
  documentsDir: string | null;
  /** The OS preferred languages (BCP 47, in priority order). When the UI language follows the system, the Runtime chooses its language from these. Read only at launch. */
  systemLanguages: () => readonly string[];
}

const READY_TIMEOUT_MS = 20_000;

/**
 * Finds or starts the Runtime (architecture design §2.2).
 *
 * It first reads the discovery file; if the process is alive, it uses it directly. Otherwise it starts one with Electron's bundled Node, and reads the discovery file again after the Runtime reports ready.
 * The token is passed to the renderer process only through the discovery file and IPC. It does not go into a URL or into command-line arguments.
 */
export class RuntimeSupervisor {
  readonly #options: RuntimeSupervisorOptions;
  #child: ChildProcess | null = null;
  #ensuring: Promise<ConnectionTarget> | null = null;
  /** After the app starts quitting (`stop` has been called), the Runtime is no longer launched. */
  #stopped = false;

  constructor(options: RuntimeSupervisorOptions) {
    this.#options = options;
  }

  /**
   * Called by the renderer process before each (re)connection; if the Runtime is gone, starts another one. Not started while the app is quitting: after its own Runtime has stopped, the window is still open and the UI will ask to connect again on its reconnect backoff.
   * A Runtime started then would have no one to stop it, and would be orphaned once the main process exits.
   */
  connection(): Promise<ConnectionTarget> {
    if (this.#stopped) return Promise.reject(new Error(M.runtimeQuitting));
    this.#ensuring ??= this.#ensure().finally(() => {
      this.#ensuring = null;
    });
    return this.#ensuring;
  }

  async #ensure(): Promise<ConnectionTarget> {
    const existing = await this.#discover();
    if (existing) return existing;
    // Quitting may have started while the discovery file was being read.
    if (this.#stopped) throw new Error(M.runtimeQuitting);
    await this.#spawn();
    const started = await this.#discover();
    if (!started) throw new Error(M.runtimeNoDiscovery);
    return started;
  }

  async #discover(): Promise<ConnectionTarget | null> {
    const discovery: RuntimeDiscovery | null = await readDiscovery(this.#options.home).catch(() => null);
    if (!discovery || !isProcessAlive(discovery.pid)) return null;
    return { endpoint: discovery.endpoint, token: discovery.token };
  }

  #spawn(): Promise<void> {
    const { home, script, allowedOrigins, echoLogs, credentialStore, resources, downloadsDir, documentsDir, systemLanguages } =
      this.#options;
    const args = [script, ...(echoLogs ? [] : ['--quiet']), '--credential-store', credentialStore];
    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        CUCCUT_HOME: home.root,
        CUCCUT_PROJECTS_DIR: home.projectsDir,
        ...(this.#options.legacyAutoDetect ? { CUCCUT_LEGACY_AUTO_DETECT: '1' } : {}),
        CUCCUT_ALLOWED_ORIGINS: allowedOrigins.join(','),
        // A Runtime running in Node mode may not have resourcesPath: the main process tells it where the Worker, the credential helper, the built-in templates and so on are.
        ...(resources ? packagedResourceEnv(resources) : {}),
        // The system's Downloads folder. Not overwritten if the environment already provides one (tests point it to a temporary directory).
        ...(downloadsDir && !process.env.CUCCUT_DOWNLOADS_DIR ? { CUCCUT_DOWNLOADS_DIR: downloadsDir } : {}),
        // The system's Documents folder: same as above.
        ...(documentsDir && !process.env.CUCCUT_DOCUMENTS_DIR ? { CUCCUT_DOCUMENTS_DIR: documentsDir } : {}),
        // Processes launched from the desktop mostly have no LANG set, so the main process tells it the system language.
        CUCCUT_SYSTEM_LANGUAGES: systemLanguages().join(','),
      },
      // The IPC channel is used only to ask the Runtime to stop (see stop). When the main process exits or crashes, the channel closes and the Runtime does not stop with it; the next launch finds it again through the discovery file.
      stdio: ['ignore', 'pipe', echoLogs ? 'inherit' : 'ignore', 'ipc'],
    });
    this.#child = child;
    child.once('exit', () => {
      if (this.#child === child) this.#child = null;
    });

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(M.runtimeTimeout)), READY_TIMEOUT_MS);
      const lines = readline.createInterface({ input: child.stdout! });
      const finish = (error?: Error) => {
        clearTimeout(timer);
        lines.removeAllListeners('line');
        child.removeListener('exit', onExit);
        if (error) reject(error);
        else resolve();
      };
      const onExit = (code: number | null) => {
        // Exit code 3: a Runtime is already running for the same Home (started by another window or the CLI), so reading its discovery file is enough.
        finish(code === 3 ? undefined : new Error(M.runtimeExited(code)));
      };
      child.once('exit', onExit);
      lines.on('line', (line) => {
        try {
          const message = JSON.parse(line) as { type?: string };
          if (message.type === 'ready' || message.type === 'already-running') finish();
        } catch {
          // Not a ready message; ignore it.
        }
      });
    });
  }

  /**
   * Called when the app quits. Stops only the Runtime it started itself; a Runtime connected from elsewhere is left alone. It asks the Runtime through the IPC channel to wind down in stop order (the same on all platforms, since Windows has no SIGTERM that can be handled),
   * and force-kills it after `timeoutMs`. The Runtime has its own 15-second fallback exit. After this, `connection` no longer launches a Runtime.
   */
  async stop(timeoutMs = 8_000): Promise<void> {
    this.#stopped = true;
    const child = this.#child;
    if (!child) return;
    await stopChild(child, timeoutMs);
  }
}
