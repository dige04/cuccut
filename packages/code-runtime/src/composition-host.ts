import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JsonLineWorker, WorkerExitedError, WorkerRequestError, WorkerTimeoutError, type WorkerEvent } from '@cuccut/process-host';
import { CODE_BUNDLE_ERROR_CODES, type CodeBundleErrorCode, type FrameReceipt, type FrameTicket, type Rate } from '@cuccut/protocol';
import { CodeBundleError, parseRate, type InspectedBundle } from './bundle-inspect.ts';
import { COMPOSITION_ADAPTER_SCRIPT, type AdapterPageInfo } from './composition-adapter.ts';
import { ADAPTER_PLACEHOLDER, COMPOSITION_HOST_SCRIPT } from './composition-host-script.ts';

/**
 * TypeScript side of the Electron off-screen host (architecture design §8.3–§8.4): launches `<Electron> --composition-host host.cjs` (`hostSpawnArgs`), and over a JSON-line protocol opens sessions and fetches frames by ticket.
 *
 * One host process can open multiple sessions (each session has one window and one isolated partition); frame fetches within the same session are serialized in the host.
 * A frame is the PNG from `capturePage()`; `receipt.sha256` is the digest of the PNG bytes. PNG encoding is deterministic within the same Electron version, so the same picture gets the same digest (the digest may change as a whole after changing the Electron version, so digests cannot be compared across versions).
 */

export interface CompositionHostOptions {
  /** Electron executable; if not given, it is found via `resolveElectronBinary`; explicitly passing null means there is none. */
  electron?: string | null;
  /** Directory where the host script is written (default: the system temp directory). */
  cacheDir?: string;
  env?: NodeJS.ProcessEnv;
  /** Each line of the host's stderr. */
  log?: (line: string) => void;
  /** Timeout for startup and for opening a session (default 20 s). */
  openTimeoutMs?: number;
  /** Timeout for one frame capture (default 10 s). */
  frameTimeoutMs?: number;
}

/** Composition info reported by the page and checked against the manifest. */
export interface CompositionPage {
  width: number;
  height: number;
  fps: Rate;
  durationSeconds: number;
  compositionId: string;
}

export interface RenderedFrame {
  receipt: FrameReceipt;
  /** PNG bytes (RGBA; straight alpha when the window is transparent). */
  png: Buffer;
  /** Number of pixels with alpha 0 (always 0 when the window is opaque). */
  transparentPixels: number;
  /** Number of pixels with 0 < alpha < 255. */
  translucentPixels: number;
  /** Capture method: always `capturePage` (the image from the `paint` event may be a stale frame, so it is only used to wait for one repaint). */
  captureMode: 'paint' | 'capturePage';
}

export interface CompositionSession {
  readonly id: string;
  readonly bundle: InspectedBundle;
  readonly page: CompositionPage;
  /** Info as reported by the page, unchanged (fields not provided are null). */
  readonly reportedPage: AdapterPageInfo;
  /** Request URLs intercepted so far (refreshed during opening and after each frame capture). */
  readonly blockedRequests: readonly string[];
  frame(ticket: FrameTicket): Promise<RenderedFrame>;
  dispose(): Promise<void>;
}

export interface OpenSessionOptions {
  compositionId?: string;
  /** If the size, frame rate or duration reported by the page disagree with the manifest, throws `COMPOSITION_INTRINSIC_MISMATCH` (default true). The verification flow turns this off and records each item itself. */
  strictIntrinsic?: boolean;
}

const DEFAULT_OPEN_TIMEOUT_MS = 20_000;
const DEFAULT_FRAME_TIMEOUT_MS = 10_000;
const KNOWN_CODES = new Set<string>(CODE_BUNDLE_ERROR_CODES);

/** Finds Electron: explicit path → Electron host → binary already installed for development; read-only probe, does not trigger a download. */
export function resolveElectronBinary(env: NodeJS.ProcessEnv = process.env, from: string = import.meta.url): string | null {
  if (env.CUCCUT_ELECTRON) return env.CUCCUT_ELECTRON;
  if (process.versions.electron) return process.execPath;
  try {
    // Electron 44's entry point synchronously runs install.js when the binary is missing; Runtime startup and capability probing must not run it.
    const packageDir = path.dirname(createRequire(from).resolve('electron'));
    const pathFile = path.join(packageDir, 'path.txt');
    const executable = fs.existsSync(pathFile) ? fs.readFileSync(pathFile, 'utf8').trim() : '';
    const resolved = env.ELECTRON_OVERRIDE_DIST_PATH
      ? path.join(env.ELECTRON_OVERRIDE_DIST_PATH, executable || 'electron')
      : executable ? path.join(packageDir, 'dist', executable) : null;
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
    // The electron package is not installed, or its install record is unreadable.
  }
  return null;
}

/** Writes the host script to the cache directory. The filename carries a content digest, and concurrent hosts each write a temp file and then rename it, so no one reads a half-written script. */
function writeHostScript(cacheDir: string | undefined): string {
  const source = COMPOSITION_HOST_SCRIPT.replace(ADAPTER_PLACEHOLDER, () => JSON.stringify(COMPOSITION_ADAPTER_SCRIPT));
  const digest = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
  const dir = path.join(cacheDir ?? os.tmpdir(), 'cuccut-composition-host');
  const file = path.join(dir, `host-${digest}.cjs`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, source);
  fs.renameSync(temp, file);
  return file;
}

/**
 * Arguments for launching the host: the switch and the script are two separate arguments (not written as `--composition-host=<script>`).
 * - The packaged app (the Runtime runs under `ELECTRON_RUN_AS_NODE` in the app's own executable, which is what `resolveElectronBinary` returns) does not recognize a script on the command line; it always loads the main-process entry inside the asar. On seeing this switch, the entry runs only the script that follows (`apps/desktop/src/main/composition-host-entry.ts`).
 * - Development Electron (default_app) skips unknown arguments starting with `-` and treats the next argument that does not start with `-` as the app file; the script is still loaded directly.
 */
export function hostSpawnArgs(script: string): string[] {
  return ['--composition-host', script];
}

const isCode = (code: string): code is CodeBundleErrorCode => KNOWN_CODES.has(code);

/** Child-process error → `CodeBundleError`. */
function mapError(error: unknown, worker: JsonLineWorker): CodeBundleError {
  if (error instanceof CodeBundleError) return error;
  if (error instanceof WorkerRequestError) {
    const code = isCode(error.code) ? error.code : 'COMPOSITION_SCRIPT_ERROR';
    return new CodeBundleError(code, error.body.message, error.body.details);
  }
  if (error instanceof WorkerTimeoutError) {
    return new CodeBundleError(
      'COMPOSITION_RENDER_TIMEOUT',
      `Composition host did not answer "${error.method}" within ${error.timeoutMs} ms`,
    );
  }
  if (error instanceof WorkerExitedError) {
    return new CodeBundleError('COMPOSITION_HOST_UNAVAILABLE', `Composition host exited: ${error.message}`, {
      stderr: worker.stderrTail().slice(-4000),
    });
  }
  return new CodeBundleError('COMPOSITION_SCRIPT_ERROR', error instanceof Error ? error.message : String(error));
}

interface OpenResult {
  sessionId: string;
  page: AdapterPageInfo;
  blockedRequests: string[];
}

interface FrameResult {
  png: string;
  width: number;
  height: number;
  sampledSeconds: number;
  targetSeconds: number;
  clamped: boolean;
  captureMode: 'paint' | 'capturePage';
  paintObserved: boolean;
  transparentPixels: number;
  translucentPixels: number;
  blockedRequests: string[];
}

const sameRate = (a: Rate, b: Rate) => a.num * b.den === b.num * a.den;

/** Compares the page report with the manifest item by item; returns the mismatched items. */
export function intrinsicMismatches(
  bundle: InspectedBundle,
  page: CompositionPage,
): Array<{ field: string; manifest: unknown; page: unknown }> {
  const { intrinsic } = bundle.manifest;
  const out: Array<{ field: string; manifest: unknown; page: unknown }> = [];
  if (page.width !== intrinsic.width) out.push({ field: 'width', manifest: intrinsic.width, page: page.width });
  if (page.height !== intrinsic.height) out.push({ field: 'height', manifest: intrinsic.height, page: page.height });
  if (!sameRate(page.fps, intrinsic.fps)) out.push({ field: 'fps', manifest: intrinsic.fps, page: page.fps });
  const manifestSeconds = (intrinsic.durationFrames * intrinsic.fps.den) / intrinsic.fps.num;
  const frameSeconds = intrinsic.fps.den / intrinsic.fps.num;
  if (Math.abs(page.durationSeconds - manifestSeconds) > frameSeconds + 1e-9) {
    out.push({ field: 'duration', manifest: manifestSeconds, page: page.durationSeconds });
  }
  return out;
}

export class CompositionHost {
  readonly #worker: JsonLineWorker;
  readonly #openTimeoutMs: number;
  readonly #frameTimeoutMs: number;

  private constructor(worker: JsonLineWorker, options: CompositionHostOptions) {
    this.#worker = worker;
    this.#openTimeoutMs = options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS;
    this.#frameTimeoutMs = options.frameTimeoutMs ?? DEFAULT_FRAME_TIMEOUT_MS;
  }

  /** Launches the host and waits for it to report `ready`; throws `COMPOSITION_HOST_UNAVAILABLE` if Electron is not found or startup fails. */
  static async start(options: CompositionHostOptions = {}): Promise<CompositionHost> {
    const baseEnv = options.env ?? process.env;
    const electron = options.electron === undefined ? resolveElectronBinary(baseEnv) : options.electron;
    if (!electron) {
      throw new CodeBundleError('COMPOSITION_HOST_UNAVAILABLE', 'Electron was not found; set CUCCUT_ELECTRON to the Electron executable');
    }
    const script = writeHostScript(options.cacheDir);
    const env: NodeJS.ProcessEnv = { ...baseEnv };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_ENABLE_LOGGING;
    let worker: JsonLineWorker;
    try {
      worker = await JsonLineWorker.start({
        command: electron,
        args: hostSpawnArgs(script),
        env,
        ...(options.log ? { onStderrLine: options.log } : {}),
      });
    } catch (error) {
      throw new CodeBundleError('COMPOSITION_HOST_UNAVAILABLE', `Could not start Electron: ${(error as Error).message}`, { electron });
    }
    const timeoutMs = options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS;
    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => finish(false), timeoutMs);
      const offEvent = worker.onEvent((event: WorkerEvent) => {
        if (event.event === 'ready') finish(true);
      });
      const offExit = worker.onExit(() => finish(false));
      function finish(ok: boolean) {
        clearTimeout(timer);
        offEvent();
        offExit();
        resolve(ok);
      }
    });
    if (!ready) {
      await worker.kill();
      throw new CodeBundleError('COMPOSITION_HOST_UNAVAILABLE', 'Electron composition host did not become ready', {
        electron,
        stderr: worker.stderrTail().slice(-4000),
      });
    }
    return new CompositionHost(worker, options);
  }

  get alive(): boolean {
    return this.#worker.alive;
  }

  /** Host event (`networkBlocked {sessionId, url}`), for logs and the UI. */
  onEvent(listener: (event: WorkerEvent) => void): () => void {
    return this.#worker.onEvent(listener);
  }

  async #request<T>(method: string, params: unknown, timeoutMs: number): Promise<T> {
    try {
      return await this.#worker.request<T>(method, params, { timeoutMs });
    } catch (error) {
      throw mapError(error, this.#worker);
    }
  }

  /** Opens a session: loads the entry, injects the adapter script, waits for the contract to be ready, then cross-checks against the manifest. */
  async open(bundle: InspectedBundle, options: OpenSessionOptions = {}): Promise<CompositionSession> {
    const { manifest } = bundle;
    if (manifest.runtime.engine !== 'browser') {
      throw new CodeBundleError('BUNDLE_CONTRACT_UNSUPPORTED', `Runtime engine "${manifest.runtime.engine}" is not supported yet`);
    }
    const compositionId = options.compositionId ?? bundle.compositionId;
    const { intrinsic } = manifest;
    const opened = await this.#request<OpenResult>(
      'open',
      {
        root: bundle.root,
        entry: manifest.runtime.entry,
        compositionId,
        contract: manifest.runtime.contract,
        width: intrinsic.width,
        height: intrinsic.height,
        fps: intrinsic.fps,
        durationFrames: intrinsic.durationFrames,
        alpha: manifest.output.alpha,
        readyTimeoutMs: this.#openTimeoutMs,
      },
      this.#openTimeoutMs + 10_000,
    );
    const reported = opened.page;
    const page: CompositionPage = {
      width: reported.width ?? intrinsic.width,
      height: reported.height ?? intrinsic.height,
      fps: (reported.fps !== null && parseRate(reported.fps)) || intrinsic.fps,
      durationSeconds: reported.durationSeconds,
      compositionId,
    };
    const session = new HostSession(this, opened.sessionId, bundle, page, reported, opened.blockedRequests);
    if (options.strictIntrinsic ?? true) {
      const mismatches = intrinsicMismatches(bundle, page);
      if (mismatches.length > 0) {
        await session.dispose().catch(() => {});
        throw new CodeBundleError(
          'COMPOSITION_INTRINSIC_MISMATCH',
          `The page disagrees with the manifest on ${mismatches.map((m) => m.field).join(', ')}`,
          mismatches,
        );
      }
    }
    return session;
  }

  /** @internal For sessions. */
  requestFrame(params: { sessionId: string; seconds: number; requestId: string; fps: Rate }): Promise<FrameResult> {
    return this.#request<FrameResult>('frame', params, this.#frameTimeoutMs);
  }

  /** @internal For sessions. */
  async closeSession(sessionId: string): Promise<void> {
    if (!this.#worker.alive) return;
    await this.#request('close', { sessionId }, this.#frameTimeoutMs);
  }

  /** Shuts the host down (closes stdin; the host destroys all windows and exits). */
  async close(): Promise<void> {
    await this.#worker.close(5_000);
  }
}

class HostSession implements CompositionSession {
  readonly id: string;
  readonly bundle: InspectedBundle;
  readonly page: CompositionPage;
  readonly reportedPage: AdapterPageInfo;
  readonly #host: CompositionHost;
  #blocked: string[];
  #disposed = false;

  constructor(
    host: CompositionHost,
    id: string,
    bundle: InspectedBundle,
    page: CompositionPage,
    reported: AdapterPageInfo,
    blocked: string[],
  ) {
    this.#host = host;
    this.id = id;
    this.bundle = bundle;
    this.page = page;
    this.reportedPage = reported;
    this.#blocked = blocked;
  }

  get blockedRequests(): readonly string[] {
    return this.#blocked;
  }

  /** Captures one frame at the ticket's `localTime` (output size is always the package's intrinsic size; the ticket's width and height are only recorded). */
  async frame(ticket: FrameTicket): Promise<RenderedFrame> {
    if (this.#disposed) throw new CodeBundleError('COMPOSITION_SCRIPT_ERROR', 'The composition session has been disposed');
    const requestedSeconds = Number(ticket.localTime.ticks) / ticket.localTime.timescale;
    const result = await this.#host.requestFrame({
      sessionId: this.id,
      seconds: requestedSeconds,
      requestId: ticket.requestId,
      fps: ticket.fps,
    });
    this.#blocked = result.blockedRequests;
    const png = Buffer.from(result.png, 'base64');
    return {
      receipt: {
        requestId: ticket.requestId,
        sampledSeconds: result.sampledSeconds,
        requestedSeconds,
        clampedToDuration: result.clamped,
        width: result.width,
        height: result.height,
        pixelFormat: 'png',
        alphaMode: this.bundle.manifest.output.alpha ? 'straight' : 'opaque',
        sha256: crypto.createHash('sha256').update(png).digest('hex'),
      },
      png,
      transparentPixels: result.transparentPixels,
      translucentPixels: result.translucentPixels,
      captureMode: result.captureMode,
    };
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await this.#host.closeSession(this.id);
  }
}

/** Builds a capture ticket from seconds (`localTime` is exact when the output frame rate is the time base; otherwise microseconds are used). */
export function frameTicketAt(
  bundle: InspectedBundle,
  time: { frameIndex: number; fps: Rate } | { seconds: number },
  options: { requestId?: string; compositionId?: string; quality?: FrameTicket['quality'] } = {},
): FrameTicket {
  const { intrinsic } = bundle.manifest;
  const exact = 'frameIndex' in time;
  const fps = exact ? time.fps : intrinsic.fps;
  const localTime = exact
    ? { ticks: String(time.frameIndex * time.fps.den), timescale: time.fps.num }
    : { ticks: String(Math.round(time.seconds * 1_000_000)), timescale: 1_000_000 };
  const frameIndex = exact ? time.frameIndex : Math.round((time.seconds * fps.num) / fps.den);
  return {
    requestId: options.requestId ?? `frame_${crypto.randomUUID()}`,
    bundleRef: { id: bundle.manifest.bundleId, revision: bundle.manifest.revision },
    compositionId: options.compositionId ?? bundle.compositionId,
    localTime,
    frameIndex,
    fps,
    width: intrinsic.width,
    height: intrinsic.height,
    parametersHash: crypto.createHash('sha256').update('{}').digest('hex'),
    quality: options.quality ?? 'export-exact',
  };
}
