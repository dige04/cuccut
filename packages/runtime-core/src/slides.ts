import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import {
  RpcError,
  type DesignAnnotation,
  type DesignOpenResult,
  type DesignSystemAnnotation,
  type DesignSystemOpenResult,
  type FileTarget,
  type SlideAnnotation,
  type SlidesOpenResult,
} from '@cuccut/protocol';
import { RcDesign, RcDesignSystem, RcRuntime, RcSlides } from '@cuccut/protocol/messages/runtime-core';
import type { Logger, ResolvedDesignAnnotation, ResolvedDesignSystemAnnotation, ResolvedSlideAnnotation } from '@cuccut/harness';
import { CANVAS_LAYOUT, readCanvasInfo, resolveDesignEditorDist } from '@cuccut/design';
import { DESIGN_SYSTEM_LAYOUT, readDesignSystemInfo, resolveDesignSystemEditorDist } from '@cuccut/design-system';
import {
  compilerAvailable,
  DeckStore,
  loadSlidesCompiler,
  readDeckSummary,
  resolveSlidesEditorDist,
  localUserName,
  SlidesServer,
  type SlidesRuntime,
} from '@cuccut/slides';
import { isIgnoredName } from './space-catalog.ts';

/**
 * Slides, design canvases and design systems in a session (docs/design/slides §6, docs/design/canvas §6, §10.4): `slides.open`, `design.open` and
 * `designSystem.open` send the editor address, and `/slides/<grant>/…`, `/design/<grant>/…`, `/design-system/<grant>/…` and `/_blob/<id>` are handled by
 * the SlidesServer in `@cuccut/slides` (design canvases follow `CANVAS_LAYOUT` from `@cuccut/design`, design systems follow
 * `DESIGN_SYSTEM_LAYOUT` from `@cuccut/design-system`). The gateway and the Web service share one SlidesServer: there is only one store per directory (publishing is serialized).
 */

/** Entry point for the handler functions: the base address differs (the gateway is `http://127.0.0.1:<port>`, the Web service is a same-origin relative address). */
export interface SlidesOpener {
  /** Opens the deck directory `rel` inside the source directory `root`. */
  open(root: string, rel: string): Promise<SlidesOpenResult>;
}

function isInside(rootReal: string, target: string): boolean {
  if (target === rootReal) return true;
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  return target.startsWith(prefix);
}

/** Entry point for opening a design canvas; the address base is the same as `SlidesOpener`. */
export interface DesignOpener {
  /** Opens the design canvas directory `rel` inside the source directory `root`. */
  open(root: string, rel: string): Promise<DesignOpenResult>;
}

/** Entry point for opening a design system; the address base is the same as `SlidesOpener`. */
export interface DesignSystemOpener {
  /** Opens the design system directory `rel` inside the source directory `root`. */
  open(root: string, rel: string): Promise<DesignSystemOpenResult>;
}

/** The deck directory inside the source directory: guards against escaping it (checked by real path), excludes hidden and dependency directories, and must be a directory with a valid deck.json. Returns the real path. */
export async function resolveDeckDir(root: string, rel: string): Promise<string> {
  if (rel.includes('\0')) throw new RpcError('invalid-request', RcRuntime.folderPathInvalid());
  if (path.isAbsolute(rel)) throw new RpcError('invalid-request', RcRuntime.folderPathMustBeRelative());
  const relNative = path.relative(root, path.resolve(root, rel));
  if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) {
    throw new RpcError('invalid-request', RcRuntime.folderOutsideProject());
  }
  if (relNative.split(path.sep).filter(Boolean).some(isIgnoredName)) throw new RpcError('invalid-request', RcRuntime.folderNotBrowsable());
  let rootReal: string;
  let real: string;
  try {
    rootReal = await fsp.realpath(root);
    real = await fsp.realpath(path.join(root, relNative));
  } catch {
    throw new RpcError('not-found', RcRuntime.folderNotFound());
  }
  if (!isInside(rootReal, real)) throw new RpcError('invalid-request', RcRuntime.folderOutsideProject());
  const stat = await fsp.stat(real).catch(() => null);
  if (!stat) throw new RpcError('not-found', RcRuntime.folderNotFound());
  if (!stat.isDirectory()) throw new RpcError('invalid-request', RcRuntime.notAFolder());
  return real;
}

/**
 * Slide annotations carried by a message (docs/design/slides §9): each deck is replaced with a path relative to the session's working directory (`/`-separated, ending in `/`),
 * handed to the Harness to pass to the agent. When it is not inside the working directory (for example, a Space entry from another project), the absolute path is used.
 * If the deck's location cannot be found (Space entry, project no longer present), `locate` throws `not-found`. Returns undefined when there are no annotations.
 */
export function resolveSlideAnnotations(
  annotations: readonly SlideAnnotation[] | undefined,
  cwd: string,
  locate: (target: FileTarget) => { root: string; file: string },
): ResolvedSlideAnnotation[] | undefined {
  if (!annotations?.length) return undefined;
  return annotations.map((annotation) => ({ annotation, deckPath: dirPathFor(locate(annotation.deck), cwd) }));
}

/**
 * Design canvas annotations carried by a message (docs/design/canvas §9): the same as slide annotations, each design canvas is replaced with a path relative to the session's working directory
 * (`/`-separated, ending in `/`; an absolute path when outside the working directory). If not found, `locate` throws `not-found`. Returns undefined when there are no annotations.
 */
export function resolveDesignAnnotations(
  annotations: readonly DesignAnnotation[] | undefined,
  cwd: string,
  locate: (target: FileTarget) => { root: string; file: string },
): ResolvedDesignAnnotation[] | undefined {
  if (!annotations?.length) return undefined;
  return annotations.map((annotation) => ({ annotation, canvasPath: dirPathFor(locate(annotation.canvas), cwd) }));
}

/**
 * Design system annotations carried by a message (docs/design/canvas §10.6): the same as design canvas annotations, each design system is replaced with a path relative to the session's working directory.
 * If not found, `locate` throws `not-found`. Returns undefined when there are no annotations.
 */
export function resolveDesignSystemAnnotations(
  annotations: readonly DesignSystemAnnotation[] | undefined,
  cwd: string,
  locate: (target: FileTarget) => { root: string; file: string },
): ResolvedDesignSystemAnnotation[] | undefined {
  if (!annotations?.length) return undefined;
  return annotations.map((annotation) => ({ annotation, systemPath: dirPathFor(locate(annotation.system), cwd) }));
}

/** How a directory is written relative to the session's working directory: `/`-separated, ending in `/`; an absolute path when outside the working directory; `./` when it is the working directory itself. */
function dirPathFor({ root, file }: { root: string; file: string }, cwd: string): string {
  const dir = path.resolve(root, file);
  const rel = path.relative(cwd, dir);
  const outside = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  const shown = outside ? dir : rel.split(path.sep).filter(Boolean).join('/');
  return shown ? `${shown.replace(/[\\/]+$/, '')}/` : './';
}

export class SlidesService {
  readonly server: SlidesServer;
  readonly #editorDist: () => string | null;
  readonly #designEditorDist: () => string | null;
  readonly #designSystemEditorDist: () => string | null;
  #baseUrl = '';

  constructor(options: {
    log: Logger;
    editorDist?: () => string | null;
    designEditorDist?: () => string | null;
    designSystemEditorDist?: () => string | null;
    /** `user.name()` for the design system editor (`__deck/session.userName`); defaults to the local machine's account name. */
    userName?: () => string | undefined;
  }) {
    const log = options.log.child('slides');
    this.#editorDist = options.editorDist ?? (() => resolveSlidesEditorDist());
    this.#designEditorDist = options.designEditorDist ?? (() => resolveDesignEditorDist());
    this.#designSystemEditorDist = options.designSystemEditorDist ?? (() => resolveDesignSystemEditorDist());
    this.server = new SlidesServer({
      editorDist: this.#editorDist,
      design: { editorDist: this.#designEditorDist, layout: CANVAS_LAYOUT },
      designSystem: { editorDist: this.#designSystemEditorDist, layout: DESIGN_SYSTEM_LAYOUT, userName: options.userName ?? localUserName },
      onError: (message, error) => log.warn(message, { error: (error as Error)?.name }),
      onWarn: (message) => log.warn(message),
    });
  }

  /** The gateway's HTTP base address (the port is only known after listening). */
  setBaseUrl(url: string): void {
    this.#baseUrl = url;
  }

  /** Routes on the gateway, for the desktop UI and CLI side: editing is allowed. The grant is itself the credential (same as `/media/`). The desktop UI is a file:// page, so embedding is not restricted. */
  handle(request: IncomingMessage, response: ServerResponse): boolean {
    return this.server.handle(request, response, { canEdit: true });
  }

  /** Entry point for the handler functions. Uses the gateway's base address when `baseUrl` is not given. */
  opener(baseUrl: () => string = () => this.#baseUrl): SlidesOpener {
    return {
      open: async (root, rel) => {
        const dir = await resolveDeckDir(root, rel);
        const deck = await readDeckSummary(dir);
        if (!deck) throw new RpcError('invalid-request', RcSlides.notADeck(), { code: 'SLIDES_NOT_A_DECK' });
        const grant = await this.server.open(dir);
        return { url: `${baseUrl()}/slides/${grant}/`, deck, editorAvailable: this.#editorDist() !== null };
      },
    };
  }

  /** Entry point for design canvases (docs/design/canvas §6.1): validation is the same as `slides.open`; `DESIGN_NOT_A_CANVAS` when the directory is not recognized as a design canvas. `baseUrl` is the same as `opener`. */
  designOpener(baseUrl: () => string = () => this.#baseUrl): DesignOpener {
    return {
      open: async (root, rel) => {
        const dir = await resolveDeckDir(root, rel);
        const canvas = await readCanvasInfo(dir);
        if (!canvas) throw new RpcError('invalid-request', RcDesign.notACanvas(), { code: 'DESIGN_NOT_A_CANVAS' });
        const grant = await this.server.open(dir, 'design');
        return { url: `${baseUrl()}/design/${grant}/`, canvas, editorAvailable: this.#designEditorDist() !== null };
      },
    };
  }

  /**
   * Entry point for design systems (docs/design/canvas §10.4): validation is the same as `slides.open`; `DESIGN_SYSTEM_NOT_A_SYSTEM` when the directory is not recognized as a design system (for how `design-system.json` is recognized, see
   * docs/design/canvas §10.1). `baseUrl` is the same as `opener`.
   */
  designSystemOpener(baseUrl: () => string = () => this.#baseUrl): DesignSystemOpener {
    return {
      open: async (root, rel) => {
        const dir = await resolveDeckDir(root, rel);
        const system = await readDesignSystemInfo(dir);
        if (!system) throw new RpcError('invalid-request', RcDesignSystem.notASystem(), { code: 'DESIGN_SYSTEM_NOT_A_SYSTEM' });
        const grant = await this.server.open(dir, 'design-system');
        return { url: `${baseUrl()}/design-system/${grant}/`, system, editorAvailable: this.#designSystemEditorDist() !== null };
      },
    };
  }

  /** The compiler used by `slides_check` (node/compiler.cjs in the editor build); null when there is no build. */
  compiler(): SlidesRuntime | null {
    const dist = this.#editorDist();
    return compilerAvailable(dist) ? loadSlidesCompiler(dist) : null;
  }

  /** Store for a deck directory (real path): when the editor has this deck open, that one is used, and asset registration and publishing are serialized; otherwise a new one is created. */
  store(dir: string): DeckStore {
    return this.server.storeOf(dir) ?? new DeckStore(dir);
  }

  /** Store for a design canvas directory (real path); same rules as `store`, with the layout for design canvases. */
  designStore(dir: string): DeckStore {
    return this.server.storeOf(dir, 'design') ?? this.server.createStore(dir, 'design');
  }

  /** Store for a design system directory (real path); same rules as `store`, with the layout for design systems (uploads are written into `_blobs/`). */
  designSystemStore(dir: string): DeckStore {
    return this.server.storeOf(dir, 'design-system') ?? this.server.createStore(dir, 'design-system');
  }

  close(): void {
    this.server.close();
  }
}
