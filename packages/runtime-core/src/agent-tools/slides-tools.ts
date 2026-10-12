import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { RpcError } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { checkDeck, contentTypeOf, problemCount, readDeckSummary, type CheckReport } from '@cuccut/slides';
import { resolveDeckDir, type SlidesService } from '../slides.ts';
import { inside } from './artifact-save.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * 会话里的幻灯片（docs/design/slides §7.2）：deck 的文件由智能体用 Driver 自带的文件工具写，这两个工具补上它自己做不到的。
 *
 * - `slides_check`：用编辑器构建里的编译器逐页校验 deck（`@cuccut/slides` 的 `checkDeck`），返回问题清单。没有问题时在会话里
 *   记一条 `slides-created`（同一份 deck 只有一条，再次通过时更新标题与页数），线程里出现幻灯片卡片。只读文件，风险 `read`。
 * - `slides_import_asset`：把工作目录里的一张图片或一个字体拷进 deck 的 `assets/`（按内容寻址，同一份只存一份），返回写进
 *   `<img src>` 或 deck.json `faces` 的 `src` 的 `/_blob/<id>`。编辑器开着这份 deck 时与它共用存储，素材登记与发布串行。写 deck 目录，
 *   风险 `edit`。
 *
 * deck 必须在会话的来源目录里（卡片按来源目录与相对路径打开）。只给会话里的智能体（`surfaces` 只有 `agent`）。
 */

/** 一个素材文件的上限（图片与字体）：幻灯片里的图片几百 KB 到几 MB，再大的先缩小；中日韩字体文件也在这之内。 */
export const SLIDES_ASSET_MAX_BYTES = 20 * 1024 * 1024;

export interface SlidesToolsDeps {
  scope: ToolScope;
  slides: Pick<SlidesService, 'compiler' | 'store'>;
}

// i18n-ignore-start: 给模型的工具说明、错误与下一步
const schemas = {
  slides_check: z.strictObject({
    path: z.string().min(1).max(1000).describe('deck 目录（里面有 deck.json），相对工作目录的路径'),
  }),
  slides_import_asset: z.strictObject({
    deck: z.string().min(1).max(1000).describe('deck 目录（里面有 deck.json），相对工作目录的路径'),
    path: z.string().min(1).max(1000).describe('要导入的文件，相对工作目录的路径：图片 png、jpg、gif、webp、avif、svg，或字体 woff2、woff、ttf、otf'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  slides_check: {
    title: '检查幻灯片',
    description: [
      '用幻灯片编辑器的编译器校验一份 deck，返回问题清单。',
      '逐页检查：格式之外的标签、会被丢掉的 CSS、表格行列不齐、页面文件里的 <title>/<link>/<style>、不是 /_blob 的图片地址、引用的 /_blob 素材不存在、序列化往返不稳定；deck.json 的 order、sections、cover 是否指向存在的页，faces 的字体编辑器认不认得、字体文件在不在，designSystems 与 ds/<目录>/ 是否对得上。各页的 notes 是不影响内容的提示，其中「排版」开头的是版面估算（内容超出框、文字互相压住、单词放不下）。',
      '写完或改完 deck 必须调用一次。problems 为 0 时，线程里出现这份幻灯片的卡片（同一份 deck 只有一张，之后更新标题与页数），用户点开就能预览、编辑与标注；有问题时按 slides 里的说明改文件再调用。',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: '检查刚写好的 deck', args: { path: 'talk' } }],
    // 只给会话里的智能体：卡片记在会话里。
    surfaces: ['agent'],
    positional: 'path',
  },
  slides_import_asset: {
    title: '导入幻灯片素材',
    description: [
      '把工作目录里的一张图片或一个字体拷进 deck 的 assets/，返回写进页面或 deck.json 的地址。',
      `按内容寻址，同一份只存一份；返回的 src 形如 /_blob/<id>：图片原样写进 slide 的 <img src="…">，字体原样写进 deck.json 里 faces 那一项的 src。只收 png、jpg、gif、webp、avif、svg 与 woff2、woff、ttf、otf，不超过 ${formatBytes(SLIDES_ASSET_MAX_BYTES)}。`,
      'deck 与 path 都相对工作目录，不能用 .. 或符号链接指到外面。会按访问模式向用户确认。',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: '导入封面图', args: { deck: 'talk', path: 'images/cover.png' } }],
    surfaces: ['agent'],
  },
};
// i18n-ignore-end

export class SlidesTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: SlidesToolsDeps;

  constructor(deps: SlidesToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'slides_check':
        return this.#check(args as Args<'slides_check'>, principal);
      case 'slides_import_asset':
        return this.#importAsset(args as Args<'slides_import_asset'>, principal);
      default:
        // i18n-ignore: 给模型的工具说明、错误与下一步
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `没有这个工具：${name}`));
    }
  }

  async #check(args: Args<'slides_check'>, principal: ToolPrincipal) {
    const { scope, slides } = this.#deps;
    const access = scope.authorize(principal, false);
    const deck = await this.#deck(access, args.path);
    const rt = slides.compiler();
    // i18n-ignore: 给模型的工具说明、错误与下一步
    if (!rt) throw new ToolError('SLIDES_COMPILER_UNAVAILABLE', '这台机器上的 CucCut 没有构建幻灯片编辑器，无法校验，也不能在 CucCut 里打开。deck 文件照样能用，告诉用户这一点');
    let report: CheckReport;
    try {
      // 带上编译器的排版提示（内容超出框、文字压住文字、单词放不下）：没有截图时这是看版面的唯一途径。
      report = checkDeck(rt, deck.dir, { verbose: true });
    } catch (error) {
      // i18n-ignore: 给模型的工具说明、错误与下一步
      throw new ToolError('SLIDES_CHECK_FAILED', `校验没能跑完：${(error as Error).message}。先检查 deck.json 是不是合法的 JSON`);
    }
    const problems = problemCount(report);
    if (problems === 0) scope.recordSlides?.(access, { target: deck.target, title: deck.summary.title, slideCount: deck.summary.slideCount });
    const slidesWithFindings = report.slides
      .filter((slide) => slide.problems.length > 0 || slide.notes.length > 0 || slide.roundTripDrift)
      .map((slide) => ({
        id: slide.id,
        ...(slide.problems.length > 0 ? { problems: slide.problems } : {}),
        ...(slide.notes.length > 0 ? { notes: slide.notes } : {}),
        ...(slide.roundTripDrift ? { roundTripDrift: true } : {}),
      }));
    return {
      path: deck.target.path,
      title: deck.summary.title,
      slideCount: deck.summary.slideCount,
      problems,
      ...(report.deckProblems.length > 0 ? { deckProblems: report.deckProblems } : {}),
      ...(report.orphans.length > 0 ? { orphans: report.orphans } : {}),
      ...(slidesWithFindings.length > 0 ? { slides: slidesWithFindings } : {}),
      // i18n-ignore-start: 给模型的工具说明、错误与下一步
      next:
        problems > 0
          ? '按 deckProblems 与各页的 problems 改文件，再调用 slides_check，直到 problems 为 0。notes 是提示，不影响内容；「排版」开头的尽量一并改掉。'
          : '没有问题：线程里已经出现这份幻灯片的卡片，用户点开就能预览、编辑与标注。用一两句话告诉用户做好了什么，不要再贴文件内容。' +
            (slidesWithFindings.some((slide) => slide.notes?.some((note) => note.startsWith('排版')))
              ? ' 有页面带「排版」提示：版面可能放不下或互相压住，改好再校验一次。'
              : '') +
            (report.orphans.length > 0 ? ' orphans 里的页不在 order 里，不会显示：不需要就删掉。' : ''),
      // i18n-ignore-end
    };
  }

  async #importAsset(args: Args<'slides_import_asset'>, principal: ToolPrincipal) {
    const { scope, slides } = this.#deps;
    const access = scope.authorize(principal, true);
    const deck = await this.#deck(access, args.deck);
    const file = await this.#sourceFile(access, args.path);
    const type = contentTypeOf(file.path);
    const approval = await scope.confirm(access, {
      tool: 'slides_import_asset',
      targets: [deck.dir],
      ...confirmSummary(RcAgentTools.slidesImportAssetSummary({ file: args.path, deck: deck.target.path || '.' })),
    });
    const bytes = await fs.readFile(file.path);
    // i18n-ignore: 给模型的工具说明、错误与下一步
    if (bytes.byteLength !== file.size) throw new ToolError('FILE_CHANGED', '文件在确认期间被改了：重新调用一次');
    const uploaded = await slides.store(deck.dir).putBlob(bytes, type);
    return {
      src: uploaded.url,
      bytes: uploaded.sizeBytes,
      contentType: type,
      ...approvalField(approval),
      // i18n-ignore-start: 给模型的工具说明、错误与下一步
      next: type.startsWith('font/')
        ? '在 deck.json 的 faces 里登记这个字体：{"family": "<页面 font-family 里写的名字>", "src": "<src>"}，原样用这个地址、不写 href；改完调用 slides_check。'
        : '把 src 原样写进 slide 的 <img src="…">（不要写成相对路径或文件名）；改完调用 slides_check。',
      // i18n-ignore-end
    };
  }

  /**
   * 调用方给的 deck 目录：相对工作目录，必须在会话的来源目录里、是 deck（有合法的 deck.json）。返回真实路径、
   * 打开它用的 FileTarget（来源目录 + 相对路径，`/` 分隔）与概况。
   */
  async #deck(access: ToolAccess, given: string) {
    const { scope } = this.#deps;
    const { root, scope: source } = await scope.createRoot(access, undefined, { locate: true });
    const absolute = path.resolve(scope.fileBase(access), given);
    const relNative = path.relative(root, absolute);
    if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) throw deckOutside();
    let dir: string;
    try {
      dir = await resolveDeckDir(root, relNative);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      // i18n-ignore: 给模型的工具说明、错误与下一步
      if (error.code === 'not-found') throw new ToolError('DECK_NOT_FOUND', `工作目录里没有这个目录：${given}`);
      throw deckOutside();
    }
    const summary = await readDeckSummary(dir);
    // i18n-ignore: 给模型的工具说明、错误与下一步
    if (!summary) throw new ToolError('NOT_A_DECK', `${given} 不是 deck 目录：里面要有 deck.json，其中 v 为 4、order 是页 id 的数组`);
    const relPath = relNative.split(path.sep).filter(Boolean).join('/');
    return { dir, summary, target: { ...source, path: relPath } };
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
      throw new ToolError('UNSUPPORTED_ASSET_TYPE', '只能导入图片（png、jpg、gif、webp、avif、svg）或字体（woff2、woff、ttf、otf），按扩展名判断');
    }
    if (stat.size > SLIDES_ASSET_MAX_BYTES) {
      throw new ToolError('FILE_TOO_LARGE', `文件有 ${formatBytes(stat.size)}，超过了 ${formatBytes(SLIDES_ASSET_MAX_BYTES)} 的上限：图片先缩小`, {
        bytes: stat.size,
        limit: SLIDES_ASSET_MAX_BYTES,
      });
    }
    // i18n-ignore-end
    return { path: file, size: stat.size };
  }
}

function deckOutside(): ToolError {
  // i18n-ignore: 给模型的工具说明、错误与下一步
  return new ToolError('PATH_OUTSIDE_WORKSPACE', 'deck 要是会话工作目录里的目录（相对路径，不在隐藏目录或依赖目录里，不经过指向别处的符号链接）');
}

function fileOutside(): ToolError {
  // i18n-ignore: 给模型的工具说明、错误与下一步
  return new ToolError('PATH_OUTSIDE_WORKSPACE', 'path 要是这个会话工作目录里的文件（相对路径，不含 ..，不经过指向别处的符号链接）');
}
