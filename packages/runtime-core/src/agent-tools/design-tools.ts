import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { RpcError } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { checkCanvas, readCanvasInfo } from '@cuccut/design';
import { contentTypeOf } from '@cuccut/slides';
import { resolveDeckDir, type SlidesService } from '../slides.ts';
import { inside } from './artifact-save.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * 会话里的设计稿（docs/design/canvas §7.2）：设计稿的文件由智能体用 Driver 自带的文件工具写，这两个工具补上它自己做不到的。
 *
 * - `design_check`：按原格式的规则做结构校验（`@cuccut/design` 的 `checkCanvas`，不渲染），返回问题清单。没有问题时在会话里
 *   记一条 `design-created`（同一份设计稿只有一条，再次通过时更新标题与画板数），线程里出现设计稿卡片。只读文件，风险 `read`。
 * - `design_import_asset`：把工作目录里的一张图片或一个字体拷进设计稿的 `assets/`（按内容寻址，同一份只存一份），返回写进画板的
 *   `/_blob/<id>`。编辑器开着这份设计稿时与它共用存储，素材登记与发布串行。写设计稿目录，风险 `edit`。
 *
 * 设计稿必须在会话的来源目录里（卡片按来源目录与相对路径打开）。只给会话里的智能体（`surfaces` 只有 `agent`）。
 */

/** 一个素材文件的上限（图片与字体）；再大的图片先缩小。 */
export const DESIGN_ASSET_MAX_BYTES = 20 * 1024 * 1024;

/** 结果里至多列这么多条问题；其余只给条数。 */
const MAX_LISTED_ISSUES = 200;

export interface DesignToolsDeps {
  scope: ToolScope;
  design: Pick<SlidesService, 'designStore'>;
}

// i18n-ignore-start: 给模型的工具说明、错误与下一步
const schemas = {
  design_check: z.strictObject({
    path: z.string().min(1).max(1000).describe('设计稿目录（里面有 canvas.json），相对工作目录的路径'),
  }),
  design_import_asset: z.strictObject({
    canvas: z.string().min(1).max(1000).describe('设计稿目录（里面有 canvas.json），相对工作目录的路径'),
    path: z.string().min(1).max(1000).describe('要导入的文件，相对工作目录的路径：图片 png、jpg、gif、webp、avif、svg，或字体 woff2、woff、ttf、otf'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  design_check: {
    title: '检查设计稿',
    description: [
      '按设计稿格式的规则校验一份设计稿，返回问题清单。只看文件，不渲染、不截图。',
      '检查 canvas.json（v 为 3；boards 每项的 x、y、w、h 与可选字段；order、pages、notes、launch、designSystems 与 ds/<folder>/），boards 与 order 的路径都有文件，ds/ 以外的每个 .dc.html 都登记在 boards 里；每个画板的 support.js 头行、<x-dc>、唯一的 data-dc-script 块（class Component extends DCLogic，没有 import/export）、单引号的 data-props 是合法 JSON 且 $preview 等于 boards 的 w/h；标签闭合、属性加引号、不自闭合、不用大写标签名，{{ }} 只是点号路径；脚本不拼界面、不装全局按键处理、不连网；图片与 url() 用 /_blob/<id>，素材都在 assets/ 里；没有 iframe/object/embed，网上的样式只认 Google Fonts；路径段规则与文件数、大小上限。',
      '画板脚本能不能跑、排版对不对不在检查范围内。写完或改完设计稿必须调用一次。issues 为 0 时，线程里出现这份设计稿的卡片（同一份只有一张，之后更新标题与画板数），用户点开就能预览、编辑与标注；有问题时按 design 里的说明改文件再调用。',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: '检查刚写好的设计稿', args: { path: 'poster' } }],
    // 只给会话里的智能体：卡片记在会话里。
    surfaces: ['agent'],
    positional: 'path',
  },
  design_import_asset: {
    title: '导入设计稿素材',
    description: [
      '把工作目录里的一张图片或一个字体拷进设计稿的 assets/，返回写进画板的地址。',
      `按内容寻址，同一份只存一份；返回的 src 形如 /_blob/<id>，原样写进 <img src="…">、<helmet><style> 里的 url(…) 或 @font-face。只收 png、jpg、gif、webp、avif、svg 与 woff2、woff、ttf、otf，不超过 ${formatBytes(DESIGN_ASSET_MAX_BYTES)}。`,
      'canvas 与 path 都相对工作目录，不能用 .. 或符号链接指到外面；canvas 里要先有 canvas.json。会按访问模式向用户确认。',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: '导入主视觉', args: { canvas: 'poster', path: 'images/hero.jpg' } }],
    surfaces: ['agent'],
  },
};
// i18n-ignore-end

export class DesignTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: DesignToolsDeps;

  constructor(deps: DesignToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'design_check':
        return this.#check(args as Args<'design_check'>, principal);
      case 'design_import_asset':
        return this.#importAsset(args as Args<'design_import_asset'>, principal);
      default:
        // i18n-ignore: 给模型的工具说明、错误与下一步
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `没有这个工具：${name}`));
    }
  }

  async #check(args: Args<'design_check'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    // canvas.json 缺失或不合格式也照样校验：问题记在清单里，智能体按它改。
    const canvas = await this.#canvas(access, args.path, false);
    const result = await checkCanvas(canvas.dir);
    const problems = result.issues.length;
    if (problems === 0) scope.recordDesign?.(access, { target: canvas.target, title: result.title, boardCount: result.boardCount });
    return {
      path: canvas.target.path,
      title: result.title,
      boardCount: result.boardCount,
      problems,
      ...(problems > 0 ? { issues: result.issues.slice(0, MAX_LISTED_ISSUES) } : {}),
      // i18n-ignore-start: 给模型的工具说明、错误与下一步
      ...(problems > MAX_LISTED_ISSUES ? { more: `另有 ${problems - MAX_LISTED_ISSUES} 条没列出：先改这些再校验` } : {}),
      notChecked: '画板脚本能不能跑、排版与视觉效果没有检查（不渲染）。',
      next:
        problems > 0
          ? '按 issues 改文件（file 是相对设计稿目录的路径，"." 是整个目录），再调用 design_check，直到 problems 为 0。'
          : '没有问题：线程里已经出现这份设计稿的卡片，用户点开就能预览、编辑与标注。用一两句话告诉用户做好了什么，不要再贴文件内容。',
      // i18n-ignore-end
    };
  }

  async #importAsset(args: Args<'design_import_asset'>, principal: ToolPrincipal) {
    const { scope, design } = this.#deps;
    const access = scope.authorize(principal, true);
    const canvas = await this.#canvas(access, args.canvas, true);
    const file = await this.#sourceFile(access, args.path);
    const type = contentTypeOf(file.path);
    const approval = await scope.confirm(access, {
      tool: 'design_import_asset',
      targets: [canvas.dir],
      ...confirmSummary(RcAgentTools.designImportAssetSummary({ file: args.path, canvas: canvas.target.path || '.' })),
    });
    const bytes = await fs.readFile(file.path);
    // i18n-ignore: 给模型的工具说明、错误与下一步
    if (bytes.byteLength !== file.size) throw new ToolError('FILE_CHANGED', '文件在确认期间被改了：重新调用一次');
    const uploaded = await design.designStore(canvas.dir).putBlob(bytes, type);
    return {
      src: uploaded.url,
      bytes: uploaded.sizeBytes,
      contentType: type,
      ...approvalField(approval),
      // i18n-ignore-start: 给模型的工具说明、错误与下一步
      next: type.startsWith('font/')
        ? '在用到它的画板的 <helmet><style> 里写 @font-face，src: url(<src>)，原样用这个地址；改完调用 design_check。'
        : '把 src 原样写进 <img src="…"> 或 <helmet><style> 里的 url(…)（不要写成相对路径、文件名或 data: URI，也不要写进行内 style）；改完调用 design_check。',
      // i18n-ignore-end
    };
  }

  /**
   * 调用方给的设计稿目录：相对工作目录，必须在会话的来源目录里。`requireCanvas` 时还必须是设计稿（有合格的 canvas.json）。
   * 返回真实路径与打开它用的 FileTarget（来源目录 + 相对路径，`/` 分隔）。
   */
  async #canvas(access: ToolAccess, given: string, requireCanvas: boolean) {
    const { scope } = this.#deps;
    const { root, scope: source } = await scope.createRoot(access, undefined, { locate: true });
    const absolute = path.resolve(scope.fileBase(access), given);
    const relNative = path.relative(root, absolute);
    if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) throw canvasOutside();
    let dir: string;
    try {
      dir = await resolveDeckDir(root, relNative);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      // i18n-ignore: 给模型的工具说明、错误与下一步
      if (error.code === 'not-found') throw new ToolError('CANVAS_NOT_FOUND', `工作目录里没有这个目录：${given}`);
      throw canvasOutside();
    }
    if (requireCanvas && !(await readCanvasInfo(dir))) {
      // i18n-ignore: 给模型的工具说明、错误与下一步
      throw new ToolError('NOT_A_CANVAS', `${given} 还不是设计稿：先写 canvas.json（其中 v 为 3、boards 是以画板路径为键的对象），再导入素材`);
    }
    const relPath = relNative.split(path.sep).filter(Boolean).join('/');
    return { dir, target: { ...source, path: relPath } };
  }

  /** 要导入的文件：工作目录里的普通文件（按真实路径判断，不经过符号链接），图片或字体，不超过上限。 */
  async #sourceFile(access: ToolAccess, given: string): Promise<{ path: string; size: number }> {
    const base = await fs.realpath(this.#deps.scope.fileBase(access));
    if (path.isAbsolute(given) || path.win32.isAbsolute(given) || given.split(/[\\/]+/).includes('..')) throw fileOutside();
    const resolved = path.resolve(base, given);
    if (resolved === base || !inside(resolved, base)) throw fileOutside();
    const stat = await fs.lstat(resolved).catch(() => null);
    // i18n-ignore-start: 给模型的工具说明、错误与下一步
    if (!stat) throw new ToolError('FILE_NOT_FOUND', `工作目录里没有这个文件：${given}`);
    if (stat.isSymbolicLink()) throw new ToolError('PATH_IS_SYMLINK', 'path 是一个符号链接：给它指向的、在工作目录里的文件');
    if (!stat.isFile()) throw new ToolError('NOT_A_FILE', 'path 要是一个普通文件（不是目录）');
    const dirReal = await fs.realpath(path.dirname(resolved));
    if (!inside(dirReal, base)) throw fileOutside();
    const file = path.join(dirReal, path.basename(resolved));
    const type = contentTypeOf(file);
    if (!type.startsWith('image/') && !type.startsWith('font/')) {
      throw new ToolError(
        'UNSUPPORTED_ASSET_TYPE',
        '只能导入图片（png、jpg、gif、webp、avif、svg）或字体（woff2、woff、ttf、otf），按扩展名判断。css、js、json 这类支持文件直接写进设计稿目录，用相对路径引用',
      );
    }
    if (stat.size > DESIGN_ASSET_MAX_BYTES) {
      throw new ToolError('FILE_TOO_LARGE', `文件有 ${formatBytes(stat.size)}，超过了 ${formatBytes(DESIGN_ASSET_MAX_BYTES)} 的上限：图片先缩小`, {
        bytes: stat.size,
        limit: DESIGN_ASSET_MAX_BYTES,
      });
    }
    // i18n-ignore-end
    return { path: file, size: stat.size };
  }
}

function canvasOutside(): ToolError {
  // i18n-ignore: 给模型的工具说明、错误与下一步
  return new ToolError('PATH_OUTSIDE_WORKSPACE', '设计稿要是会话工作目录里的目录（相对路径，不在隐藏目录或依赖目录里，不经过指向别处的符号链接）');
}

function fileOutside(): ToolError {
  // i18n-ignore: 给模型的工具说明、错误与下一步
  return new ToolError('PATH_OUTSIDE_WORKSPACE', 'path 要是这个会话工作目录里的文件（相对路径，不含 ..，不经过指向别处的符号链接）');
}
