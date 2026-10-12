import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { RpcError } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import {
  DESIGN_SYSTEM_FILE,
  DESIGN_SYSTEM_PATHS,
  checkDesignSystem,
  designSystemUploadLimit,
  encodeIndexKey,
  hasDesignSystemMarker,
  isAssetGroupName,
  isDesignSystemIndex,
  readDesignSystemJson,
} from '@cuccut/design-system';
import { contentTypeOf } from '@cuccut/slides';
import { resolveDeckDir, type SlidesService } from '../slides.ts';
import { inside } from './artifact-save.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * 会话里的设计系统（docs/design/canvas §10.5）：设计系统的文件由智能体用 Driver 自带的文件工具写，这两个工具补上它自己做不到的。
 *
 * - `design_system_check`：按原格式的规则做结构校验（`@cuccut/design-system` 的 `checkDesignSystem`，不渲染），返回问题清单与说明。
 *   没有问题时在会话里记一条 `design-system-created`（同一个设计系统只有一条，再次通过时更新标题），线程里出现设计系统卡片。
 *   只读文件，风险 `read`。
 * - `design_system_import_asset`：把工作目录里的一张图片、一段视频、一份 PDF 或一个字体拷进设计系统的 `_blobs/`（按内容寻址，
 *   同一份只存一份），返回 `/_blob/<id>` 与要写进索引的记录 `{name, blob, size, type}`（原版 `blobRecordForIndex` 的形状，
 *   `blob` 是裸 id）。编辑器开着这个设计系统时与它共用存储，上传与发布串行。写设计系统目录，风险 `edit`。
 *
 * 设计系统必须在会话的来源目录里（卡片按来源目录与相对路径打开）。只给会话里的智能体（`surfaces` 只有 `agent`）。
 */

/**
 * 能导入的类型（原版 `BLOB_STORAGE_MIME_TYPES`，按扩展名判断）：没有 avif、mov 与 ico——原版的上传不收，导进来编辑器也存不回去。
 * 大小按 `designSystemUploadLimit`：SVG 2 MiB，其余 20 MiB（原版 `BLOB_STORAGE_LIMITS`）。
 */
export const DESIGN_SYSTEM_ASSET_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'mp4',
  'webm',
  'pdf',
  'woff2',
  'woff',
  'ttf',
  'otf',
]);

/** 结果里至多列这么多条问题与说明；其余只给条数。 */
const MAX_LISTED_ISSUES = 200;
const MAX_LISTED_NOTES = 50;

export interface DesignSystemToolsDeps {
  scope: ToolScope;
  designSystem: Pick<SlidesService, 'designSystemStore'>;
}

// i18n-ignore-start: 给模型的工具说明、错误与下一步
const systemPath = z.string().min(1).max(1000).describe('设计系统目录（里面有 design-system.json），相对工作目录的路径');

const schemas = {
  design_system_check: z.strictObject({ path: systemPath }),
  design_system_import_asset: z.strictObject({
    system: systemPath,
    path: z
      .string()
      .min(1)
      .max(1000)
      .describe('要导入的文件，相对工作目录的路径：图片 png、jpg、gif、webp、svg，视频 mp4、webm，pdf，或字体 woff2、woff、ttf、otf'),
    group: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe('素材组的名字（assets/<组>/ 的文件夹名，例如 Logos、Icons）；不给时记录写进索引的 blobs'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  design_system_check: {
    title: '检查设计系统',
    description: [
      '按设计系统格式的规则校验一个设计系统，返回问题清单。只看文件，不渲染、不截图。',
      '检查 design-system.json（v 为 3、layout 为 "files"、createdOnFiles 或 convertedFrom 标记，各字段的形状，namespace，libraries，assetGroups 与 blobs 里的记录都有上传或文件）；tokens.json 的语法与上限；路径规则、文件数与大小；每个 preview.html 的 @dsCard 头行、不用 iframe/object/embed/noscript、不链接 bundle.js 与库；bundle.js 是经典脚本、赋值 window.<namespace>、不 import、不连网、不含 </script 与 <!--；fonts/ 里的字体与 tokens.json 的 type.fonts 对得上；预览与 components/lib/ 里不从网上加载脚本、样式与图片；/_blob/<id> 都在 _blobs/ 里。',
      'manifest.json、tokens.css、api/ 由编辑器保存时生成，不查（notChecked）。组件能不能渲染不在检查范围内。写完或改完设计系统必须调用一次。problems 为 0 时，线程里出现这个设计系统的卡片（同一个只有一张，之后更新标题）；notes 是不用改的说明。有问题时按说明改文件再调用。',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: '检查刚写好的设计系统', args: { path: 'acme-design-system' } }],
    // 只给会话里的智能体：卡片记在会话里。
    surfaces: ['agent'],
    positional: 'path',
  },
  design_system_import_asset: {
    title: '导入设计系统素材',
    description: [
      '把工作目录里的一张图片、一段视频、一份 PDF 或一个字体拷进设计系统的 _blobs/，返回它的地址与要写进 design-system.json 的记录。',
      `按内容寻址，同一份只存一份；返回的 src 形如 /_blob/<id>，可以原样写进 README.md、preview.html 等文件；record 是 {name, blob, size, type}，按 indexPath 写进索引（给了 group 时是 assetGroups.<groupKey>.files.<key>，素材显示在 assets/<group>/ 里；不给时是 blobs.<key>）。只收 png、jpg、jpeg、gif、webp、svg、mp4、webm、pdf、woff2、woff、ttf、otf；SVG 不超过 ${formatBytes(designSystemUploadLimit('image/svg+xml'))}，其余不超过 ${formatBytes(designSystemUploadLimit('application/octet-stream'))}。`,
      'system 与 path 都相对工作目录，不能用 .. 或符号链接指到外面；system 是设计系统的目录：新建的设计系统先建好空目录，素材先导入，design-system.json 最后写。会按访问模式向用户确认。',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: '导入标志', args: { system: 'acme-design-system', path: 'brand/logo.svg', group: 'Logos' } }],
    surfaces: ['agent'],
  },
};
// i18n-ignore-end

export class DesignSystemTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: DesignSystemToolsDeps;

  constructor(deps: DesignSystemToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'design_system_check':
        return this.#check(args as Args<'design_system_check'>, principal);
      case 'design_system_import_asset':
        return this.#importAsset(args as Args<'design_system_import_asset'>, principal);
      default:
        // i18n-ignore: 给模型的工具说明、错误与下一步
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `没有这个工具：${name}`));
    }
  }

  async #check(args: Args<'design_system_check'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    // design-system.json 缺失或不合格式也照样校验：问题记在清单里，智能体按它改。
    const system = await this.#system(access, args.path, false);
    const result = await checkDesignSystem(system.dir);
    const problems = result.issues.length;
    if (problems === 0) scope.recordDesignSystem?.(access, { target: system.target, title: result.title });
    return {
      path: system.target.path,
      title: result.title,
      namespace: result.namespace,
      problems,
      ...(problems > 0 ? { issues: result.issues.slice(0, MAX_LISTED_ISSUES) } : {}),
      ...(result.notes.length > 0 ? { notes: result.notes.slice(0, MAX_LISTED_NOTES) } : {}),
      // i18n-ignore-start: 给模型的工具说明、错误与下一步
      ...(problems > MAX_LISTED_ISSUES ? { more: `另有 ${problems - MAX_LISTED_ISSUES} 条没列出：先改这些再校验` } : {}),
      notChecked: `${result.notChecked.join('、')} 由编辑器保存时生成，没有检查；组件能不能渲染、视觉效果没有检查（不渲染）。`,
      next:
        problems > 0
          ? '按 issues 改文件（file 是相对设计系统目录的路径，"." 是整个目录），再调用 design_system_check，直到 problems 为 0。notes 不用改。'
          : '没有问题：线程里已经出现这个设计系统的卡片，用户点开就能查看与编辑。notes 不用改。用一两句话告诉用户做好了什么，不要再贴文件内容。',
      // i18n-ignore-end
    };
  }

  async #importAsset(args: Args<'design_system_import_asset'>, principal: ToolPrincipal) {
    const { scope, designSystem } = this.#deps;
    const access = scope.authorize(principal, true);
    // i18n-ignore-start: 给模型的工具说明、错误与下一步
    if (args.group !== undefined && !isAssetGroupName(args.group)) {
      throw new ToolError('INVALID_GROUP', 'group 要是素材组的文件夹名：至多 80 个字符，不含 / \\ 与控制字符，首尾没有空白，不是 . 或 ..');
    }
    // i18n-ignore-end
    const system = await this.#system(access, args.system, true);
    const file = await this.#sourceFile(access, args.path);
    const type = contentTypeOf(file.path);
    const approval = await scope.confirm(access, {
      tool: 'design_system_import_asset',
      targets: [system.dir],
      ...confirmSummary(RcAgentTools.designSystemImportAssetSummary({ file: args.path, system: system.target.path || '.' })),
    });
    const bytes = await fs.readFile(file.path);
    // i18n-ignore: 给模型的工具说明、错误与下一步
    if (bytes.byteLength !== file.size) throw new ToolError('FILE_CHANGED', '文件在确认期间被改了：重新调用一次');
    const uploaded = await designSystem.designSystemStore(system.dir).putBlob(bytes, type);
    const base = path.basename(file.path);
    // 记录还原到的路径（原版 `restoreFilesFromIndex`）：组里的是 assets/<组>/<name>；blobs 里的 name 就是路径，字体放 fonts/，其余放 assets/。
    const name = args.group !== undefined ? base : `${type.startsWith('font/') ? DESIGN_SYSTEM_PATHS.fontsDir : DESIGN_SYSTEM_PATHS.assetsDir}${base}`;
    const key = encodeIndexKey(name);
    const groupKey = args.group !== undefined ? encodeIndexKey(args.group) : undefined;
    const record = { name, blob: uploaded.id, size: uploaded.sizeBytes, type };
    const restoredAs = args.group !== undefined ? `${DESIGN_SYSTEM_PATHS.assetsDir}${args.group}/${name}` : name;
    return {
      src: uploaded.url,
      record,
      key,
      ...(groupKey !== undefined ? { groupKey } : {}),
      indexPath: groupKey !== undefined ? ['assetGroups', groupKey, 'files', key] : ['blobs', key],
      restoredAs,
      bytes: uploaded.sizeBytes,
      contentType: type,
      ...approvalField(approval),
      // i18n-ignore-start: 给模型的工具说明、错误与下一步
      next:
        (groupKey !== undefined
          ? `把 record 写进 design-system.json 的 assetGroups.${groupKey}.files.${key}（这个组还没有时先建 {"name": ${JSON.stringify(args.group)}, "order": [], "files": {}}，并把 "${groupKey}" 加进 groups）；`
          : `把 record 写进 design-system.json 的 blobs.${key}；`) +
        `素材在编辑器里显示为 ${restoredAs}，不要再在这个路径写同名文件（文件优先，记录会被忽略）。别的文件引用它时原样写 src（${uploaded.url}）。改完调用 design_system_check。`,
      // i18n-ignore-end
    };
  }

  /**
   * 调用方给的设计系统目录：相对工作目录，必须在会话的来源目录里。`requireSystem` 时里面的 design-system.json 要么还没有（正在新建），
   * 要么是带迁移标记的设计系统索引。返回真实路径与打开它用的 FileTarget（来源目录 + 相对路径，`/` 分隔）。
   */
  async #system(access: ToolAccess, given: string, requireSystem: boolean) {
    const { scope } = this.#deps;
    const { root, scope: source } = await scope.createRoot(access, undefined, { locate: true });
    const absolute = path.resolve(scope.fileBase(access), given);
    const relNative = path.relative(root, absolute);
    if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) throw systemOutside();
    let dir: string;
    try {
      dir = await resolveDeckDir(root, relNative);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      // i18n-ignore: 给模型的工具说明、错误与下一步
      if (error.code === 'not-found') throw new ToolError('DESIGN_SYSTEM_NOT_FOUND', `工作目录里没有这个目录：${given}`);
      throw systemOutside();
    }
    // 还没有 design-system.json 的目录是正在新建的设计系统（原版里空的设计系统也能上传）。有这个文件的，要是带迁移标记的索引：
    // 没有标记的编辑器只读打开，skill 也说不往里写（docs/design/canvas §10.1）。
    if (requireSystem && (await fs.lstat(path.join(dir, DESIGN_SYSTEM_FILE)).catch(() => null))) {
      const index = await readDesignSystemJson(dir);
      if (!isDesignSystemIndex(index) || !hasDesignSystemMarker(index)) {
        throw new ToolError(
          'NOT_A_DESIGN_SYSTEM',
          // i18n-ignore: 给模型的工具说明、错误与下一步
          `${given} 里的 design-system.json 不是带 createdOnFiles 或 convertedFrom 标记的设计系统索引：编辑器只读打开它（或认不出），不要往里导入，告诉用户`,
        );
      }
    }
    const relPath = relNative.split(path.sep).filter(Boolean).join('/');
    return { dir, target: { ...source, path: relPath } };
  }

  /** 要导入的文件：工作目录里的普通文件（按真实路径判断，不经过符号链接），类型在允许的集合里，不超过上限。 */
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
    const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
    if (!DESIGN_SYSTEM_ASSET_EXTENSIONS.has(ext) || file.lastIndexOf('.') < 0) {
      throw new ToolError(
        'UNSUPPORTED_ASSET_TYPE',
        '只能导入 png、jpg、jpeg、gif、webp、svg、mp4、webm、pdf、woff2、woff、ttf、otf，按扩展名判断。README、css、js、json 这类文本文件直接写进设计系统目录',
      );
    }
    const limit = designSystemUploadLimit(contentTypeOf(file));
    if (stat.size > limit) {
      throw new ToolError('FILE_TOO_LARGE', `文件有 ${formatBytes(stat.size)}，超过了 ${formatBytes(limit)} 的上限${ext === 'svg' ? '（SVG）' : ''}：先压缩或缩小`, {
        bytes: stat.size,
        limit,
      });
    }
    // i18n-ignore-end
    return { path: file, size: stat.size };
  }
}

function systemOutside(): ToolError {
  // i18n-ignore: 给模型的工具说明、错误与下一步
  return new ToolError('PATH_OUTSIDE_WORKSPACE', '设计系统要是会话工作目录里的目录（相对路径，不在隐藏目录或依赖目录里，不经过指向别处的符号链接）');
}

function fileOutside(): ToolError {
  // i18n-ignore: 给模型的工具说明、错误与下一步
  return new ToolError('PATH_OUTSIDE_WORKSPACE', 'path 要是这个会话工作目录里的文件（相对路径，不含 ..，不经过指向别处的符号链接）');
}
