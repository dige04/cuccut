/**
 * 编辑器页面（iframe 里的宿主 shim）与 CucCut 界面（父窗口）之间的 postMessage 协议（docs/design/slides §5、§8.2）。
 * 幻灯片与设计稿编辑器用同一套消息（docs/design/canvas §5），父窗口按消息来自哪个 iframe 区分。
 * 两边都只认这里列出的消息类型；消息里只有标注要的位置与文字，不带 deck 或设计稿文件的内容。
 * 例外是设计稿编辑器导出的文件（`editor:save-file`）：运行时的 `downloads` 能力把导出结果交给父窗口保存（docs/design/canvas §4、§8.3）。
 *
 * - iframe → 父窗口用 `targetOrigin: "*"`（桌面端父页面是 file://，origin 为 null），父窗口按
 *   `event.source === iframe.contentWindow` 认消息；父窗口 → iframe 指定编辑器地址的 origin，shim 按
 *   `event.source === window.parent` 认消息。
 * - 本文件不依赖 DOM 与 Node，界面与编辑器两边都能导入（`@cuccut/slides/editor-messages`）。
 */

/** 批注框旁边要的位置：iframe 视口里的坐标（CSS 像素）。 */
export interface EditorPoint {
  x: number;
  y: number;
}

/**
 * 运行时为一处标注给出的描述。`label` 给人看，`detail` 给模型看，`area` 表示框选的区域。
 * `section` 是设计系统编辑器里目标所在的章节 id（docs/design/canvas §10.6）：章节按需挂载，跳回去时要先到那一章；幻灯片与设计稿不给。
 */
export interface AnchorDescription {
  label: string;
  detail?: string;
  area?: boolean;
  section?: string;
}

/** 编辑器里画编号标记用的一条标注：`n` 是在整份草稿里的序号（与 composer 列表一致）；`section` 同 `AnchorDescription`。 */
export interface EditorThread {
  id: string;
  anchor: string;
  n: number;
  section?: string;
}

/** iframe → 父窗口。 */
export type EditorToHostMessage =
  /** 运行时启动了；`canEdit` 为 false 时编辑器只读（Web 服务的只读模式）。 */
  | { type: 'editor:ready'; canEdit: boolean }
  /** 标注模式开关变了（运行时自己的按钮、快捷键 C，或父窗口的 `editor:set-mode`）。 */
  | { type: 'editor:mode'; on: boolean }
  /** 用户点了一个元素或框了一块区域：父窗口在 `point` 旁弹出批注框，并回 `editor:compose-result`。 */
  | ({ type: 'editor:compose'; requestId: string; anchor: string; point: EditorPoint } & AnchorDescription)
  /** 回应 `editor:flush`：未保存的改动都发布完了（`saved` 为 false 表示有改动没能保存）。 */
  | { type: 'editor:flushed'; requestId: string; saved: boolean }
  /** deck 被编辑器以外的东西改了，编辑器要重新载入。 */
  | { type: 'editor:external-change'; paths: string[] }
  /** 运行时请父窗口把一段提示放进这个会话的输入框（「让智能体修好这页」等），父窗口回 `editor:suggest-prompt-result`。 */
  | { type: 'editor:suggest-prompt'; requestId: string; prompt: string }
  /** 设计稿编辑器导出了一个文件，请父窗口保存（Web 交给浏览器下载，桌面端弹存储对话框），父窗口回 `editor:save-file-result`。 */
  | { type: 'editor:save-file'; requestId: string; filename: string; data: ArrayBuffer | Blob };

/** 父窗口 → iframe。 */
export type HostToEditorMessage =
  /** 当前会话草稿里属于这份 deck 的标注，编辑器据此画编号标记。 */
  | { type: 'editor:threads'; threads: EditorThread[] }
  /** 批注框打开了没有（没打开时运行时撤掉选中）。 */
  | { type: 'editor:compose-result'; requestId: string; opened: boolean }
  /** 批注框关了（添加或取消），运行时结束这一次标注。 */
  | { type: 'editor:composer-closed'; requestId: string }
  /** 跳到这条标注所在的页。 */
  | { type: 'editor:reveal'; id: string }
  /** 打开或关上标注模式（标签条上的标注开关）。 */
  | { type: 'editor:set-mode'; on: boolean }
  /** 发送消息前：把编辑器里未保存的改动发布完再回 `editor:flushed`。 */
  | { type: 'editor:flush'; requestId: string }
  /** 回应 `editor:suggest-prompt`：提示放进输入框了没有（标签页不属于会话时为 false，运行时改为复制到剪贴板）。 */
  | { type: 'editor:suggest-prompt-result'; requestId: string; ok: boolean }
  /** 回应 `editor:save-file`：`saved` 交出去了，`declined` 用户在存储对话框里取消了，`failed` 没能保存。 */
  | { type: 'editor:save-file-result'; requestId: string; outcome: SaveFileOutcome };

/** 父窗口保存导出文件的结果（`editor:save-file-result`）。 */
export type SaveFileOutcome = 'saved' | 'declined' | 'failed';

const EDITOR_TYPES = new Set<EditorToHostMessage['type']>([
  'editor:ready',
  'editor:mode',
  'editor:compose',
  'editor:flushed',
  'editor:external-change',
  'editor:suggest-prompt',
  'editor:save-file',
]);
const HOST_TYPES = new Set<HostToEditorMessage['type']>([
  'editor:threads',
  'editor:compose-result',
  'editor:composer-closed',
  'editor:reveal',
  'editor:set-mode',
  'editor:flush',
  'editor:suggest-prompt-result',
  'editor:save-file-result',
]);
const SAVE_FILE_OUTCOMES = new Set<SaveFileOutcome>(['saved', 'declined', 'failed']);

/** `editor:suggest-prompt` 的提示最长多少字符（运行时的修复提示远小于这个数）。 */
export const SUGGESTED_PROMPT_MAX = 20_000;

/** `editor:save-file` 的文件最大多少字节（整份设计稿的 HTML 内嵌画板运行时与素材，远小于这个数）。 */
export const SAVE_FILE_MAX_BYTES = 512 * 1024 * 1024;

/**
 * 父窗口肯保存的扩展名与对应的文件类型：设计稿运行时允许交给宿主保存的那些（packages/design-runtime/src/export/downloads.tsx）。
 * 文件名的其余部分由父窗口清理（`saveFileName`）；浏览器下载时按扩展名给类型，运行时交来的类型不一定对。
 */
export const SAVE_FILE_TYPES: Readonly<Record<string, string>> = {
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain',
  json: 'application/json',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  epub: 'application/epub+zip',
  csv: 'text/csv',
  ttf: 'font/ttf',
  html: 'text/html',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/** 去掉文件名里不能出现在本机文件名里的字符（路径分隔符、Windows 保留字符、控制字符），首尾的空白与点；扩展名不在允许的范围里时返回 null。 */
export function saveFileName(name: string): string | null {
  // eslint-disable-next-line no-control-regex -- 去掉控制字符
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '');
  const dot = cleaned.lastIndexOf('.');
  if (dot <= 0 || !Object.hasOwn(SAVE_FILE_TYPES, cleaned.slice(dot + 1).toLowerCase())) return null;
  return cleaned.length <= 255 ? cleaned : null;
}

const isFileData = (value: unknown): value is ArrayBuffer | Blob =>
  value instanceof ArrayBuffer ? value.byteLength <= SAVE_FILE_MAX_BYTES : typeof Blob === 'function' && value instanceof Blob && value.size <= SAVE_FILE_MAX_BYTES;

/** 编辑器地址上带 CucCut 界面语言的查询参数（值是 `Locale`，如 `zh-Hans`）：标注位置标签按它写（editor/comment-labels.ts）。 */
export const EDITOR_LOCALE_PARAM = 'lang';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length <= max;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** 设计系统章节 id 的长度上限（内置章节与 `family-<名字>`）。 */
const SECTION_MAX = 200;
const isSection = (value: unknown): value is string | undefined => value === undefined || isString(value, SECTION_MAX);

/** 父窗口收到的数据是不是一条合法的编辑器消息（字段类型与长度都核对，不信任 iframe）。 */
export function readEditorMessage(data: unknown): EditorToHostMessage | null {
  if (!isRecord(data) || !EDITOR_TYPES.has(data.type as EditorToHostMessage['type'])) return null;
  switch (data.type) {
    case 'editor:ready':
      return typeof data.canEdit === 'boolean' ? { type: data.type, canEdit: data.canEdit } : null;
    case 'editor:mode':
      return typeof data.on === 'boolean' ? { type: data.type, on: data.on } : null;
    case 'editor:compose': {
      const point = data.point;
      if (!isString(data.requestId, 100) || !isString(data.anchor) || !isString(data.label, 1000)) return null;
      if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
      if (data.detail !== undefined && !isString(data.detail)) return null;
      if (data.area !== undefined && typeof data.area !== 'boolean') return null;
      if (!isSection(data.section)) return null;
      return {
        type: data.type,
        requestId: data.requestId,
        anchor: data.anchor,
        point: { x: point.x, y: point.y },
        label: data.label,
        ...(data.detail !== undefined ? { detail: data.detail as string } : {}),
        ...(data.area === true ? { area: true } : {}),
        ...(data.section ? { section: data.section } : {}),
      };
    }
    case 'editor:flushed':
      return isString(data.requestId, 100) && typeof data.saved === 'boolean' ? { type: data.type, requestId: data.requestId, saved: data.saved } : null;
    case 'editor:external-change':
      return Array.isArray(data.paths) && data.paths.length <= 1000 && data.paths.every(p => isString(p, 1000))
        ? { type: data.type, paths: data.paths as string[] }
        : null;
    case 'editor:suggest-prompt':
      return isString(data.requestId, 100) && isString(data.prompt, SUGGESTED_PROMPT_MAX) && data.prompt.trim() !== ''
        ? { type: data.type, requestId: data.requestId, prompt: data.prompt }
        : null;
    case 'editor:save-file':
      return isString(data.requestId, 100) && isString(data.filename, 1000) && data.filename.trim() !== '' && isFileData(data.data)
        ? { type: data.type, requestId: data.requestId, filename: data.filename, data: data.data }
        : null;
    default:
      return null;
  }
}

/** 编辑器收到的数据是不是一条合法的父窗口消息。 */
export function readHostMessage(data: unknown): HostToEditorMessage | null {
  if (!isRecord(data) || !HOST_TYPES.has(data.type as HostToEditorMessage['type'])) return null;
  switch (data.type) {
    case 'editor:threads':
      return Array.isArray(data.threads) &&
        data.threads.every(t => isRecord(t) && isString(t.id, 100) && isString(t.anchor) && isFiniteNumber(t.n) && isSection(t.section))
        ? {
            type: data.type,
            threads: (data.threads as EditorThread[]).map(t => ({ id: t.id, anchor: t.anchor, n: t.n, ...(t.section ? { section: t.section } : {}) })),
          }
        : null;
    case 'editor:compose-result':
      return isString(data.requestId, 100) && typeof data.opened === 'boolean' ? { type: data.type, requestId: data.requestId, opened: data.opened } : null;
    case 'editor:composer-closed':
    case 'editor:flush':
      return isString(data.requestId, 100) ? { type: data.type, requestId: data.requestId } : null;
    case 'editor:reveal':
      return isString(data.id, 100) ? { type: data.type, id: data.id } : null;
    case 'editor:set-mode':
      return typeof data.on === 'boolean' ? { type: data.type, on: data.on } : null;
    case 'editor:suggest-prompt-result':
      return isString(data.requestId, 100) && typeof data.ok === 'boolean' ? { type: data.type, requestId: data.requestId, ok: data.ok } : null;
    case 'editor:save-file-result':
      return isString(data.requestId, 100) && SAVE_FILE_OUTCOMES.has(data.outcome as SaveFileOutcome)
        ? { type: data.type, requestId: data.requestId, outcome: data.outcome as SaveFileOutcome }
        : null;
    default:
      return null;
  }
}
