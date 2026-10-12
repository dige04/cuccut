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
 * 会话里的幻灯片、设计稿与设计系统（docs/design/slides §6、docs/design/canvas §6、§10.4）：`slides.open` / `design.open` /
 * `designSystem.open` 发编辑器地址，`/slides/<grant>/…`、`/design/<grant>/…`、`/design-system/<grant>/…` 与 `/_blob/<id>` 由
 * `@cuccut/slides` 的 SlidesServer 处理（设计稿按 `@cuccut/design` 的 `CANVAS_LAYOUT`，设计系统按 `@cuccut/design-system` 的
 * `DESIGN_SYSTEM_LAYOUT`）。网关与 Web 服务共用一个 SlidesServer：同一个目录只有一个存储（发布串行）。
 */

/** 处理函数用的入口：地址的基址各不相同（网关是 `http://127.0.0.1:<端口>`，Web 服务是同源的相对地址）。 */
export interface SlidesOpener {
  /** 打开来源目录 `root` 里的 deck 目录 `rel`。 */
  open(root: string, rel: string): Promise<SlidesOpenResult>;
}

function isInside(rootReal: string, target: string): boolean {
  if (target === rootReal) return true;
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  return target.startsWith(prefix);
}

/** 打开设计稿的入口，地址的基址同 `SlidesOpener`。 */
export interface DesignOpener {
  /** 打开来源目录 `root` 里的设计稿目录 `rel`。 */
  open(root: string, rel: string): Promise<DesignOpenResult>;
}

/** 打开设计系统的入口，地址的基址同 `SlidesOpener`。 */
export interface DesignSystemOpener {
  /** 打开来源目录 `root` 里的设计系统目录 `rel`。 */
  open(root: string, rel: string): Promise<DesignSystemOpenResult>;
}

/** 来源目录里的 deck 目录：防越界（按真实路径）、不进隐藏与依赖目录、必须是有合法 deck.json 的目录。返回真实路径。 */
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
 * 消息带的幻灯片标注（docs/design/slides §9）：每条的 deck 换成相对会话工作目录的路径（`/` 分隔、以 `/` 结尾），
 * 交给 Harness 拼给智能体。不在工作目录里（例如另一个项目的 Space 条目）时用绝对路径。
 * deck 的位置找不到（Space 条目、项目已不在）时由 `locate` 抛 `not-found`。没有标注时为 undefined。
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
 * 消息带的设计稿标注（docs/design/canvas §9）：与幻灯片标注相同，每条的设计稿换成相对会话工作目录的路径
 * （`/` 分隔、以 `/` 结尾，工作目录外是绝对路径）；找不到时由 `locate` 抛 `not-found`。没有标注时为 undefined。
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
 * 消息带的设计系统标注（docs/design/canvas §10.6）：与设计稿标注相同，每条的设计系统换成相对会话工作目录的路径；
 * 找不到时由 `locate` 抛 `not-found`。没有标注时为 undefined。
 */
export function resolveDesignSystemAnnotations(
  annotations: readonly DesignSystemAnnotation[] | undefined,
  cwd: string,
  locate: (target: FileTarget) => { root: string; file: string },
): ResolvedDesignSystemAnnotation[] | undefined {
  if (!annotations?.length) return undefined;
  return annotations.map((annotation) => ({ annotation, systemPath: dirPathFor(locate(annotation.system), cwd) }));
}

/** 目录相对会话工作目录的写法：`/` 分隔、以 `/` 结尾；不在工作目录里时是绝对路径；就是工作目录时是 `./`。 */
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
    /** 设计系统编辑器的 `user.name()`（`__deck/session.userName`）；默认取本机账户名。 */
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

  /** 网关的 HTTP 基址（监听之后才知道端口）。 */
  setBaseUrl(url: string): void {
    this.#baseUrl = url;
  }

  /** 网关上的路由：桌面界面与 CLI 一侧，能编辑；grant 本身就是凭证（同 `/media/`），桌面界面是 file:// 页面，不限制嵌入。 */
  handle(request: IncomingMessage, response: ServerResponse): boolean {
    return this.server.handle(request, response, { canEdit: true });
  }

  /** 给处理函数用的入口。`baseUrl` 不给时用网关的基址。 */
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

  /** 设计稿的入口（docs/design/canvas §6.1）：校验同 `slides.open`，认不出设计稿时 `DESIGN_NOT_A_CANVAS`。`baseUrl` 同 `opener`。 */
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
   * 设计系统的入口（docs/design/canvas §10.4）：校验同 `slides.open`，认不出设计系统（`design-system.json` 的认法见
   * docs/design/canvas §10.1）时 `DESIGN_SYSTEM_NOT_A_SYSTEM`。`baseUrl` 同 `opener`。
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

  /** `slides_check` 用的编译器（编辑器构建里的 node/compiler.cjs）；没有构建时 null。 */
  compiler(): SlidesRuntime | null {
    const dist = this.#editorDist();
    return compilerAvailable(dist) ? loadSlidesCompiler(dist) : null;
  }

  /** deck 目录（真实路径）的存储：编辑器开着这份 deck 时用它那一个，素材登记与发布串行；否则新建一个。 */
  store(dir: string): DeckStore {
    return this.server.storeOf(dir) ?? new DeckStore(dir);
  }

  /** 设计稿目录（真实路径）的存储，规则同 `store`，布局按设计稿。 */
  designStore(dir: string): DeckStore {
    return this.server.storeOf(dir, 'design') ?? this.server.createStore(dir, 'design');
  }

  /** 设计系统目录（真实路径）的存储，规则同 `store`，布局按设计系统（上传写进 `_blobs/`）。 */
  designSystemStore(dir: string): DeckStore {
    return this.server.storeOf(dir, 'design-system') ?? this.server.createStore(dir, 'design-system');
  }

  close(): void {
    this.server.close();
  }
}
